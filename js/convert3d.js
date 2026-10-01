// 2D 회로도 → 3D 실습실 변환 (부품 배치 + 호스 + 전기 배선 자동 생성)
import { REG, newComp, compBBox, parseMarks } from './components.js';

export const BOARD = { u0: -73, u1: 73, v0: 2, v1: 82 };
export const SCALE3D = 1.2;
export const RACK = [
  ['m_psu', {}], ['m_pb', { base: 1 }], ['m_pb', { base: 4 }], ['m_sel', {}],
  ['m_relay', { base: 1 }], ['m_relay', { base: 4 }], ['m_timer', {}], ['m_counter', {}], ['m_lamp', {}],
];

export function empty3D(mode = 'pn', name) {
  const doc = { version: 1, kind: '3d', mode, name: name || (mode === 'hy' ? '유압 실습' : '공압 실습'), components: [], wires: [], task: null };
  let n = 0;
  const add = (type, props, b3) => { const c = newComp(type, 0, 0, 'k' + ++n); Object.assign(c.props, props || {}); c.b3 = b3; doc.components.push(c); return c; };
  RACK.forEach(([t, p], i) => add(t, p, { rack: i }));
  if (mode === 'hy') add('h_supply3d', { q: 8, p: 50 }, { u: -63, v: 42, r: 0 });
  else add('p_supply3d', { p: 6 }, { u: -63, v: 42, r: 0 });
  doc._n = n;
  return doc;
}

class UF {
  constructor() { this.p = new Map(); }
  find(a) { if (!this.p.has(a)) this.p.set(a, a); let r = a; while (this.p.get(r) !== r) r = this.p.get(r); this.p.set(a, r); return r; }
  union(a, b) { this.p.set(this.find(a), this.find(b)); }
}

// 2D 네트 (분기점 병합)
function nets2D(doc) {
  const uf = new UF();
  const keys = [];
  for (const c of doc.components) for (const p of REG[c.type].ports(c)) { const k = c.id + ':' + p.id; uf.find(k); keys.push([k, c, p]); }
  for (const w of doc.wires) uf.union(w.a.c + ':' + w.a.p, w.b.c + ':' + w.b.p);
  const nets = new Map();
  for (const [k, c, p] of keys) { const r = uf.find(k); if (!nets.has(r)) nets.set(r, []); nets.get(r).push({ c, p, k }); }
  return [...nets.values()];
}

export function to3D(doc2, opts = {}) {
  const mode = doc2.mode === 'hy' ? 'hy' : 'pn';
  const out = empty3D(mode, doc2.name);
  out.task = doc2.task;
  out.src = doc2;
  let n = out._n;
  const warn = [];
  const add = (type, props, b3) => { const c = newComp(type, 0, 0, 'k' + ++n); Object.assign(c.props, props || {}); c.b3 = b3; out.components.push(c); return c; };
  const wire = (a, ap, b, bp, color) => out.wires.push({ id: 'h' + ++n, a: { c: a.id, p: ap }, b: { c: b.id, p: bp }, ...(color ? { color } : {}) });
  const byType = (t, pred = () => true) => out.components.find((c) => c.type === t && pred(c));
  const sup = byType(mode === 'hy' ? 'h_supply3d' : 'p_supply3d');
  // 공급 설정 이전
  for (const c of doc2.components) {
    if (c.type === 'p_frl') sup.props.p = c.props.p;
    if (c.type === 'p_source' && !doc2.components.some((q) => q.type === 'p_frl')) sup.props.p = c.props.p;
    if (c.type === 'h_powerunit' || c.type === 'h_pump') { sup.props.q = c.props.q; if (c.props.p) sup.props.p = c.props.p; }
    if (c.type === 'h_relief') sup.props.p = c.props.p;
  }
  // ---------- 유체 부품 배치 ----------
  const SKIP = new Set(['p_source', 'p_frl', 'p_junction', 'h_junction', 'h_powerunit', 'h_pump', 'h_tank']);
  const map = new Map();
  const fluid = doc2.components.filter((c) => REG[c.type].dom !== 'el' && !SKIP.has(c.type));
  for (const c of fluid) {
    const k = add(c.type, JSON.parse(JSON.stringify(c.props)), { u: 0, v: 0, r: 0 });
    map.set(c.id, k);
  }
  layoutBoard(fluid.map((c) => ({ c2: c, c3: map.get(c.id) })), mode);
  // 롤러 밸브: 실린더에 부착
  const cylOfMark = (tag) => {
    for (const c of doc2.components) if (c.type.includes('_cyl_')) { const mk = parseMarks(c).find((m) => m.tag === tag); if (mk) return { cyl: map.get(c.id), pos: mk.pos }; }
    return null;
  };
  for (const c of fluid) {
    if (REG[c.type].valve && c.props.roll) {
      const a = cylOfMark(c.props.roll);
      if (a) { const k = map.get(c.id); k.props.cyl = a.cyl.id; k.props.pos = a.pos; }
    }
  }
  // ---------- 유체 배관 ----------
  const nets = nets2D(doc2);
  const outlets = { pn: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => 'o' + i), P: [1, 2, 3, 4].map((i) => 'p' + i), T: [1, 2, 3, 4].map((i) => 't' + i) };
  const teeType = mode === 'hy' ? 'h_tee' : 'p_tee';
  const chain = (refs, startRef) => {
    // refs: [{c3, pid}], startRef 가 있으면 그 지점부터
    let list = startRef ? [startRef, ...refs] : refs;
    if (list.length < 2) return;
    if (list.length === 2) { wire(list[0].c3, list[0].pid, list[1].c3, list[1].pid); return; }
    // 티 체인
    let prev = list[0];
    for (let i = 1; i < list.length - 1; i++) {
      const pos = avgPos([prev.c3, list[i].c3]);
      const t = add(teeType, {}, { u: pos.u, v: pos.v - 6, r: 0, float: true });
      wire(prev.c3, prev.pid, t, 'a');
      wire(t, 'b', list[i].c3, list[i].pid);
      prev = { c3: t, pid: 'c' };
    }
    const last = list[list.length - 1];
    wire(prev.c3, prev.pid, last.c3, last.pid);
  };
  for (const net of nets) {
    if (!net.length || net[0].p.kind === 'el') continue;
    let side = null;
    const refs = [];
    for (const { c, p } of net) {
      if (c.type === 'p_frl' && p.id === '2') side = 'pn';
      else if (c.type === 'p_source' && !doc2.components.some((q) => q.type === 'p_frl')) side = 'pn';
      else if ((c.type === 'h_powerunit' && p.id === 'P') || (c.type === 'h_pump' && p.id === 'P')) side = 'P';
      else if ((c.type === 'h_powerunit' && p.id === 'T') || c.type === 'h_tank') side = 'T';
      else if (map.has(c.id)) refs.push({ c3: map.get(c.id), pid: p.id });
    }
    // 릴리프 밸브의 T는 탱크로
    if (!side && mode === 'hy' && net.some(({ c, p }) => c.type === 'h_relief' && p.id === 'T') && refs.length === 1) side = 'T';
    if (side) {
      const pool = outlets[side];
      refs.sort((a, b) => a.c3.b3.u - b.c3.b3.u);
      if (!pool.length) { warn.push('공급 포트 부족'); continue; }
      const nDirect = refs.length <= pool.length ? refs.length : pool.length - 1;
      for (const r of refs.slice(0, nDirect)) wire(sup, pool.shift(), r.c3, r.pid);
      if (nDirect < refs.length) chain(refs.slice(nDirect), { c3: sup, pid: pool.shift() });
    } else if (refs.length >= 2) {
      refs.sort((a, b) => a.c3.b3.u - b.c3.b3.u || b.c3.b3.v - a.c3.b3.v);
      chain(refs);
    }
  }
  // ---------- 전기 ----------
  const els = doc2.components.filter((c) => REG[c.type].dom === 'el');
  if (els.length) mapElectric(doc2, out, els, map, add, wire, warn, cylOfMark);
  // 플로팅 티 위치 정리
  for (const c of out.components) if (c.b3 && c.b3.float) placeFloating(out, c);
  out.warn = warn;
  delete out._n;
  out._seq = n;
  if (opts.exercise) { out.ref = netSignature(out); out.wires = []; }
  return out;
}

function avgPos(cs) {
  let u = 0, v = 0;
  for (const c of cs) { u += c.b3.u; v += c.b3.v; }
  return { u: Math.round(u / cs.length), v: Math.round(v / cs.length) };
}
function placeFloating(doc, t) {
  const ws = doc.wires.filter((w) => w.a.c === t.id || w.b.c === t.id).map((w) => (w.a.c === t.id ? w.b.c : w.a.c));
  const cs = doc.components.filter((c) => ws.includes(c.id) && c.b3 && !c.b3.float && c.b3.rack == null);
  if (cs.length) { const p = avgPos(cs); t.b3.u = p.u; t.b3.v = Math.max(BOARD.v0 + 3, p.v - 8); }
  delete t.b3.float;
}

// 보드 배치: 2D 회로도의 상대 위치를 축척하여 보드 중앙에 배치 후 겹침 해소
function layoutBoard(items, mode) {
  if (!items.length) return;
  const U0 = -50, U1 = BOARD.u1 - 3, V0 = BOARD.v0 + 4, V1 = BOARD.v1 - 5;
  const its = items.map((it) => { const b = compBBox(it.c2); return { ...it, cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, fp: footprint(it.c3) }; });
  const minX = Math.min(...its.map((i) => i.cx)), maxX = Math.max(...its.map((i) => i.cx));
  const minY = Math.min(...its.map((i) => i.cy)), maxY = Math.max(...its.map((i) => i.cy));
  const s = Math.min(0.24, (U1 - U0 - 34) / Math.max(1, maxX - minX), (V1 - V0 - 20) / Math.max(1, maxY - minY));
  const cu = (U0 + U1) / 2, cv = (V0 + V1) / 2 + 4;
  for (const it of its) {
    it.u = cu + (it.cx - (minX + maxX) / 2) * s;
    it.v = cv - (it.cy - (minY + maxY) / 2) * s;
  }
  // 겹침 해소 (여유 3cm)
  const ov = (a, b) => Math.abs(a.u - b.u) < (a.fp[0] + b.fp[0]) / 2 + 3 && Math.abs(a.v - b.v) < (a.fp[1] + b.fp[1]) / 2 + 3;
  for (let iter = 0; iter < 60; iter++) {
    let moved = false;
    for (let i = 0; i < its.length; i++) for (let j = i + 1; j < its.length; j++) {
      const a = its[i], b = its[j];
      if (!ov(a, b)) continue;
      moved = true;
      const dx = (a.fp[0] + b.fp[0]) / 2 + 3 - Math.abs(a.u - b.u);
      const dy = (a.fp[1] + b.fp[1]) / 2 + 3 - Math.abs(a.v - b.v);
      if (dy <= dx) { const sgn = a.v >= b.v ? 1 : -1; a.v += (sgn * dy) / 2; b.v -= (sgn * dy) / 2; }
      else { const sgn = a.u <= b.u ? -1 : 1; a.u += (sgn * dx) / 2; b.u -= (sgn * dx) / 2; }
    }
    for (const it of its) {
      it.u = Math.max(U0 + it.fp[0] / 2, Math.min(U1 - it.fp[0] / 2, it.u));
      it.v = Math.max(V0 + it.fp[1] / 2, Math.min(V1 - it.fp[1] / 2, it.v));
    }
    if (!moved) break;
  }
  for (const it of its) it.c3.b3 = { u: Math.round(it.u), v: Math.round(it.v / 2.5) * 2.5, r: 0 };
}

// ---------- 전기 매핑 ----------
function mapElectric(doc2, out, els, map, add, wire, warn, cylOfMark) {
  const mod = (t, base) => out.components.find((c) => c.type === t && (base == null || +c.props.base === base));
  const psu = mod('m_psu'), pbM = [mod('m_pb', 1), mod('m_pb', 4)], sel = mod('m_sel');
  const ryM = [mod('m_relay', 1), mod('m_relay', 4)], tm = mod('m_timer'), ct = mod('m_counter'), lp = mod('m_lamp');
  const portMap = new Map(); // 2D portKey -> {c3, pid}
  const set = (c, p, c3, pid) => portMap.set(c.id + ':' + p, { c3, pid });
  const pbSlots = new Map(), ryTags = new Map(), ryUsed = new Map(), tmTags = new Map(), tmUsed = new Map();
  let ctUsed = 0, pIdx = 0, nIdx = 0;
  const lampUsed = new Set();
  const pbUsed = new Set();
  const pbSlot = (tag) => {
    if (!pbSlots.has(tag)) {
      const m = String(tag).match(/(\d+)/);
      let idx = m && +m[1] >= 1 && +m[1] <= 6 && ![...pbSlots.values()].includes(+m[1] - 1) ? +m[1] - 1 : null;
      if (idx == null) { idx = 0; while ([...pbSlots.values()].includes(idx)) idx++; }
      pbSlots.set(tag, idx);
    }
    return pbSlots.get(tag);
  };
  const rySlot = (tag) => {
    if (!ryTags.has(tag)) {
      const m = String(tag).match(/(\d+)/);
      let idx = m && +m[1] >= 1 && +m[1] <= 6 && ![...ryTags.values()].includes(+m[1] - 1) ? +m[1] - 1 : null;
      if (idx == null) { idx = 0; while ([...ryTags.values()].includes(idx)) idx++; }
      ryTags.set(tag, idx);
    }
    return ryTags.get(tag);
  };
  const tmSlot = (tag) => { if (!tmTags.has(tag)) tmTags.set(tag, tmTags.size); return tmTags.get(tag); };
  for (const c of els) {
    const t = c.type, tag = c.props.tag;
    if (t === 'e_24v') set(c, '1', psu, 'P' + (pIdx++ % 4));
    else if (t === 'e_0v') set(c, '1', psu, 'N' + (nIdx++ % 4));
    else if (t === 'e_pb_no' || t === 'e_pb_nc') {
      const s = pbSlot(tag);
      if (s > 5) { warn.push(`푸시버튼 부족: ${tag}`); continue; }
      const m = pbM[s < 3 ? 0 : 1], i = s % 3, kind = t === 'e_pb_no' ? 'NO' : 'NC';
      if (pbUsed.has(s + kind)) warn.push(`${tag} ${kind} 접점 중복`);
      pbUsed.add(s + kind);
      set(c, '1', m, `${i}${kind}a`); set(c, '2', m, `${i}${kind}b`);
    } else if (t === 'e_sw_no' || t === 'e_sw_nc') { const k = t === 'e_sw_no' ? 'SNO' : 'SNC'; set(c, '1', sel, k + 'a'); set(c, '2', sel, k + 'b'); }
    else if (t === 'e_estop') { set(c, '1', sel, 'ENCa'); set(c, '2', sel, 'ENCb'); }
    else if (t === 'e_relay' || t === 'e_relay_no' || t === 'e_relay_nc') {
      const s = rySlot(tag);
      if (s > 5) { warn.push(`릴레이 부족: ${tag}`); continue; }
      const m = ryM[s < 3 ? 0 : 1], i = s % 3;
      if (t === 'e_relay') { set(c, '1', m, `${i}A1`); set(c, '2', m, `${i}A2`); }
      else {
        const j = (ryUsed.get(s) || 0) + 1;
        if (j > 4) { warn.push(`${tag} 접점 4개 초과`); continue; }
        ryUsed.set(s, j);
        set(c, '1', m, `${i}C${j}`); set(c, '2', m, `${i}${t === 'e_relay_no' ? 'NO' : 'NC'}${j}`);
      }
    } else if (t === 'e_ton' || t === 'e_toff' || t === 'e_timer_no' || t === 'e_timer_nc') {
      const i = tmSlot(tag);
      if (i > 1) { warn.push(`타이머 부족: ${tag}`); continue; }
      if (t === 'e_ton' || t === 'e_toff') { tm.props['d' + (i + 1)] = c.props.delay; tm.props['m' + (i + 1)] = t === 'e_ton' ? 'on' : 'off'; set(c, '1', tm, `${i}A1`); set(c, '2', tm, `${i}A2`); }
      else {
        const j = (tmUsed.get(i) || 0) + 1;
        if (j > 2) { warn.push(`${tag} 접점 2개 초과`); continue; }
        tmUsed.set(i, j);
        set(c, '1', tm, `${i}C${j}`); set(c, '2', tm, `${i}${t === 'e_timer_no' ? 'NO' : 'NC'}${j}`);
      }
    } else if (t === 'e_counter') { ct.props.preset = c.props.preset; set(c, '1', ct, 'A1'); set(c, '2', ct, 'A2'); }
    else if (t === 'e_counter_rst') { set(c, '1', ct, 'R1'); set(c, '2', ct, 'R2'); }
    else if (t === 'e_counter_no' || t === 'e_counter_nc') {
      const j = ++ctUsed;
      if (j > 2) { warn.push('카운터 접점 초과'); continue; }
      set(c, '1', ct, `C${j}`); set(c, '2', ct, `${t === 'e_counter_no' ? 'NO' : 'NC'}${j}`);
    } else if (t === 'e_sol') {
      let found = false;
      for (const [id2, c3] of map) {
        if (!REG[c3.type].valve) continue;
        if (c3.props.sol14 === tag) { set(c, '1', c3, 'S14a'); set(c, '2', c3, 'S14b'); found = true; break; }
        if (c3.props.sol12 === tag) { set(c, '1', c3, 'S12a'); set(c, '2', c3, 'S12b'); found = true; break; }
      }
      if (!found) warn.push(`솔레노이드 ${tag} 밸브 없음`);
    } else if (t === 'e_ls_no' || t === 'e_ls_nc' || t === 'e_prox') {
      const a = cylOfMark(tag);
      if (!a) { warn.push(`센서 ${tag} 위치 없음`); continue; }
      if (t === 'e_prox') { const s = add('s3_reed', { tag, cyl: a.cyl.id, pos: a.pos }, { att: true }); set(c, '1', s, 'a'); set(c, '2', s, 'b'); }
      else { const s = add('s3_ls', { tag, cyl: a.cyl.id, pos: a.pos }, { att: true }); set(c, '1', s, 'C'); set(c, '2', s, t === 'e_ls_no' ? 'NO' : 'NC'); }
    } else if (t === 'e_ps_no' || t === 'e_ps_nc') {
      const ps = [...map.values()].find((q) => q.type.endsWith('_pswitch') && q.props.tag === tag);
      if (!ps) { warn.push(`압력 스위치 ${tag} 없음`); continue; }
      set(c, '1', ps, 'C'); set(c, '2', ps, t === 'e_ps_no' ? 'NO' : 'NC');
    } else if (t === 'e_lamp') {
      const pref = { red: 0, yellow: 1, green: 2, white: 1 }[c.props.color] ?? 1;
      let i = pref;
      if (lampUsed.has(i)) { i = 0; while (lampUsed.has(i) && i < 3) i++; }
      if (i > 2) { warn.push('램프 부족'); continue; }
      lampUsed.add(i);
      set(c, '1', lp, `${i}a`); set(c, '2', lp, `${i}b`);
    } else if (t === 'e_buzzer') { set(c, '1', lp, 'BZa'); set(c, '2', lp, 'BZb'); }
  }
  // 네트별 체인 배선
  const nets = nets2D(doc2).filter((n) => n[0].p.kind === 'el');
  const rackIdx = (c3) => (c3.b3 && c3.b3.rack != null ? c3.b3.rack : 20);
  let k = 0;
  for (const net of nets) {
    const refs = [];
    const seen = new Set();
    let plus = false, zero = false;
    for (const { c, p } of net) {
      if (c.type === 'e_24v') plus = true;
      if (c.type === 'e_0v') zero = true;
      const r = portMap.get(c.id + ':' + p.id);
      if (r && !seen.has(r.c3.id + ':' + r.pid)) { seen.add(r.c3.id + ':' + r.pid); refs.push(r); }
    }
    if (refs.length < 2) continue;
    refs.sort((a, b) => rackIdx(a.c3) - rackIdx(b.c3));
    const color = plus ? 'red' : zero ? 'blue' : ['black', 'yellow', 'green'][k++ % 3];
    for (let i = 0; i < refs.length - 1; i++) wire(refs[i].c3, refs[i].pid, refs[i + 1].c3, refs[i + 1].pid, color);
  }
}

// ---------- 배선 비교용 네트 시그니처 ----------
const isPassive = (t) => t === 'p_tee' || t === 'h_tee';
export function terminalKey(doc, cid, pid) {
  const c = doc.components.find((q) => q.id === cid);
  if (!c) return null;
  if (c.type === 'p_supply3d') return 'SUP:o';
  if (c.type === 'h_supply3d') return pid[0] === 'p' ? 'SUP:P' : 'SUP:T';
  if (c.type === 'm_psu') return pid[0] === 'P' ? 'PSU:+' : 'PSU:0';
  return cid + ':' + pid;
}
export function netSignature(doc) {
  const uf = new UF();
  const term = new Set();
  for (const w of doc.wires) {
    const ka = keyOf(doc, w.a), kb = keyOf(doc, w.b);
    uf.union(ka, kb);
    for (const k of [ka, kb]) if (!k.startsWith('#')) term.add(k);
  }
  // 수동 티 내부 연결
  for (const c of doc.components) if (isPassive(c.type)) { uf.union('#' + c.id + ':a', '#' + c.id + ':b'); uf.union('#' + c.id + ':a', '#' + c.id + ':c'); }
  const groups = new Map();
  for (const k of term) { const r = uf.find(k); if (!groups.has(r)) groups.set(r, new Set()); groups.get(r).add(k); }
  return [...groups.values()].filter((s) => s.size >= 2).map((s) => [...s].sort());
}
function keyOf(doc, e) {
  const c = doc.components.find((q) => q.id === e.c);
  if (c && isPassive(c.type)) return '#' + c.id + ':' + e.p;
  return terminalKey(doc, e.c, e.p) || e.c + ':' + e.p;
}

// 배치 계산용 크기 (모델 생성 없이)
export function footprint(c) {
  const f = footprint0(c);
  return [f[0] * SCALE3D, f[1] * SCALE3D];
}
function footprint0(c) {
  const d = REG[c.type];
  if (c.type.includes('_cyl_')) {
    const hy = c.type.startsWith('h_');
    const L0 = (+c.props.stroke || 100) / 10;
    const cap = hy ? 5.4 : 3.6;
    return [cap * 2 + L0 + 2.2 + L0 + 3, cap + 2.5];
  }
  if (d.valve) {
    const spec = d.valve;
    const hy = d.dom === 'hy';
    const n = spec.pos.length;
    const nPorts = Math.max(spec.top.length, spec.bot.length);
    const bl = hy ? 7 + n * 1.6 : 3.8 + nPorts * 1.5;
    const aw = (acts) => acts.reduce((s, a) => s + (a.t === 'sol' ? (hy ? 3.6 : 2.8) : a.t === 'spring' ? 1.6 : a.t === 'roller' ? 2.6 : a.t === 'pilot' ? 1.4 : 2.4), 0);
    return [bl + aw(spec.L) + aw(spec.R) + 2.4, hy ? 10.5 : 9];
  }
  if (c.type === 'p_supply3d') return [16, 34];
  if (c.type === 'h_supply3d') return [14, 30];
  if (c.type.endsWith('_tee')) return [4, 4];
  if (c.type.endsWith('_motor')) return [11, 11];
  if (c.type.startsWith('s3_')) return [3, 3];
  const [x0, y0, x1, y1] = d.bbox(c);
  return [Math.max(6.5, (x1 - x0) * 0.11 + 2.6), Math.max(6, (y1 - y0) * 0.11 + 2.6)];
}
