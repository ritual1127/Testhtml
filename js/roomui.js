// 3D 실습실 UI (상단 바, 하단 부품 분류/트레이, 우측 도구, 속성/상태 패널, 배선 분석)
import { REG } from './components.js';
import { Room3D, termName } from './room3d.js';
import { netSignature } from './convert3d.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const CATS = {
  pn: [
    ['작동기', ['p_cyl_double', 'p_cyl_single', 'p_motor']],
    ['솔레노이드 작동 밸브', ['pv52_sol', 'pv52_dsol', 'pv32_sol_nc', 'pv53_dsol_cc', 'pv22_sol']],
    ['공압 작동 밸브', ['pv32_push_nc', 'pv32_push_no', 'pv52_push', 'pv32_lever_det', 'pv52_lever_det', 'pv32_roller_nc', 'pv32_pilot_nc', 'pv52_pilot', 'pv52_dpilot', 'pv_timer']],
    ['유량 / 압력 제어 밸브', ['p_flow_oneway', 'p_throttle', 'p_check', 'p_shuttle', 'p_twopress', 'p_qexh', 'p_pswitch']],
    ['검지 센서', ['s3_reed', 's3_ls']],
    ['기타', ['p_tee', 'p_gauge']],
  ],
  hy: [
    ['작동기', ['h_cyl_double', 'h_cyl_single', 'h_motor']],
    ['방향 제어 밸브', ['hv42_sol', 'hv42_dsol', 'hv43_sol_tandem', 'hv43_sol_closed', 'hv43_sol_open', 'hv43_sol_float', 'hv42_lever', 'hv43_lever_tandem', 'hv43_lever_closed', 'hv43_lever_float', 'hv22_sol']],
    ['압력 제어 밸브', ['h_relief', 'h_reducing', 'h_sequence', 'h_pswitch']],
    ['유량 제어 밸브', ['h_throttle', 'h_flow_oneway', 'h_fcv']],
    ['체크 밸브', ['h_check', 'h_pocheck']],
    ['검지 센서', ['s3_reed', 's3_ls']],
    ['기타', ['h_tee', 'h_gauge', 'h_filter', 'h_accumulator']],
  ],
};

export function initRoomUI(opts) {
  const host = $('#r3view');
  const room = new Room3D(host);
  window.__room = room;
  const { modal, thumbSVG, onOpen2D, onHome } = opts;
  let cat = -1;
  let dirtyT = null;
  let fontsHooked = false;

  // ---------- 하단 분류 ----------
  function renderCats() {
    const cats = CATS[room.doc.mode === 'hy' ? 'hy' : 'pn'];
    $('#r3cats').innerHTML = cats.map(([n], i) => `<button data-cat="${i}" class="${i === cat ? 'on' : ''}">${n}</button>`).join('');
    if (cat >= 0 && cats[cat]) {
      $('#r3tray').innerHTML = `<div class="r3tray-h"><b>${cats[cat][0]}</b><span>부품을 클릭한 뒤 보드 위를 클릭하여 설치${cats[cat][0] === '검지 센서' ? ' · 센서는 실린더를 클릭하여 부착' : ''}</span><button data-close>✕</button></div><div class="r3items">${cats[cat][1].filter((t) => REG[t]).map((t) => `<button class="r3item" data-type="${t}" title="${esc(REG[t].desc || '')}">${thumbSVG(t, 54)}<span>${esc(REG[t].name)}</span></button>`).join('')}</div>`;
      $('#r3tray').classList.remove('hidden');
    } else $('#r3tray').classList.add('hidden');
  }
  $('#r3cats').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    cat = cat === +b.dataset.cat ? -1 : +b.dataset.cat;
    renderCats();
  });
  $('#r3tray').addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { cat = -1; renderCats(); return; }
  });
  // 클릭 → 보드 클릭으로 설치, 또는 끌어다 놓기
  $('#r3tray').addEventListener('pointerdown', (e) => {
    const it = e.target.closest('.r3item');
    if (!it) return;
    e.preventDefault();
    if (room.sim) { status('시뮬레이션을 정지한 후 부품을 설치하세요.'); return; }
    room.beginPlace(it.dataset.type);
    if (room.mode === 'place') room.placeByDrag = true;
    cat = -1;
    renderCats();
  });

  // ---------- 상단 · 우측 ----------
  $('#r3top').addEventListener('click', (e) => {
    const b = e.target.closest('[data-r]');
    if (!b) return;
    cmd(b.dataset.r);
  });
  $('#r3side').addEventListener('click', (e) => {
    const b = e.target.closest('[data-r],[data-color],[data-view]');
    if (!b) return;
    if (b.dataset.color) { room.wireColor = b.dataset.color; $$('#r3side [data-color]').forEach((x) => x.classList.toggle('on', x === b)); status(`전선 색: ${b.title}`); return; }
    if (b.dataset.view) { room.setView(b.dataset.view); return; }
    cmd(b.dataset.r);
  });
  $('#r3speed').addEventListener('change', (e) => { room.speed = +e.target.value; });
  $('#r3q').value = room.quality;
  $('#r3q').addEventListener('change', (e) => room.setQuality(e.target.value));

  function cmd(c) {
    switch (c) {
      case 'home': onHome(); break;
      case 'new': room.newDoc(room.doc.mode); renderCats(); break;
      case 'newpn': room.newDoc('pn'); renderCats(); break;
      case 'newhy': room.newDoc('hy'); renderCats(); break;
      case 'open': $('#fileInput3').click(); break;
      case 'save': download(`${(room.doc.name || '실습').replace(/[\\/:*?"<>|]/g, '_')}.hpt3d.json`, JSON.stringify(stripDoc(room.doc), null, 1)); break;
      case 'undo': room.undo(); break;
      case 'redo': room.redo(); break;
      case 'start': room.startSim(); break;
      case 'pause': room.pauseSim(); break;
      case 'stop': room.stopSim(); break;
      case 'reset': room.resetSim(); break;
      case 'step': room.stepSim(0.1); break;
      case 'afluid': analysis(false); break;
      case 'aelec': analysis(true); break;
      case 'hoses': room.showHoses = !room.showHoses; room.applyVisibility(); $('[data-r="hoses"]').classList.toggle('off', !room.showHoses); break;
      case 'wires': room.showWires = !room.showWires; room.applyVisibility(); $('[data-r="wires"]').classList.toggle('off', !room.showWires); break;
      case 'delete': room.deleteSel(); break;
      case 'rotate': room.rotateSel(); break;
      case 'shot': { const a = document.createElement('a'); a.href = room.screenshot(); a.download = '실습실.png'; a.click(); break; }
      case '2d': onOpen2D(room.doc); break;
      case 'answer': if (room.doc.ref && room.doc.src) { if (confirm('정답 배선으로 채울까요? (현재 배선은 지워집니다)')) opts.loadAnswer(room.doc); } break;
      case 'clearfluid': if (confirm('모든 호스를 제거할까요?')) room.clearWires('fluid'); break;
      case 'clearel': if (confirm('모든 전선을 제거할까요?')) room.clearWires('el'); break;
      case 'help': help(); break;
    }
  }
  $('#fileInput3').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (d.kind !== '3d') throw new Error('3D 실습실 파일(.hpt3d.json)이 아닙니다');
      room.load(d);
      renderCats();
    } catch (err) { modal('열기 실패', `<p>${esc(err.message)}</p>`); }
    e.target.value = '';
  });

  // ---------- 상태 ----------
  function status(m) { $('#r3status').textContent = m || ''; }
  function infoBox() {
    const d = room.doc;
    const sup = d.components.find((c) => c.type.endsWith('supply3d'));
    if (!sup) { $('#r3info').innerHTML = ''; return; }
    const sim = room.sim;
    const lines = d.mode === 'hy'
      ? [`토출압력(릴리프): ${sup.props.p} bar`, `펌프유량: ${sup.props.q} L/min`, sim ? `P라인 압력: ${sim.pAt(sup, 'p1').toFixed(1)} bar` : '']
      : [`공급압력: ${sup.props.p} bar`, sim ? `공급: ${sim.st.get(sup.id).on ? 'ON' : 'OFF (밸브 잠김)'}` : ''];
    $('#r3info').innerHTML = lines.filter(Boolean).map((l) => `<div>${esc(l)}</div>`).join('');
  }
  room.addEventListener('status', (e) => status(e.detail));
  room.addEventListener('tip', (e) => {
    const t = $('#r3tip');
    if (!e.detail.text) { t.classList.add('hidden'); return; }
    t.textContent = e.detail.text;
    t.classList.remove('hidden');
    const r = host.getBoundingClientRect();
    t.style.left = Math.min(r.width - 260, e.detail.x - r.left + 14) + 'px';
    t.style.top = e.detail.y - r.top + 16 + 'px';
  });
  room.addEventListener('change', (e) => {
    $('#r3dirty').textContent = e.detail.dirty ? '● 수정됨' : '';
    $('#r3title').textContent = `${room.doc.mode === 'hy' ? '유압' : '공압'} 실습실 — ${room.doc.name || ''}`;
    clearTimeout(dirtyT);
    dirtyT = setTimeout(() => { try { localStorage.setItem('hpt.autosave3d', JSON.stringify(stripDoc(room.doc))); } catch (_) { /* 무시 */ } }, 500);
    if (!room.sim) panel();
    infoBox();
  });
  room.addEventListener('select', () => { if (!room.sim) panel(); });
  room.addEventListener('editprops', () => panel());
  room.addEventListener('modechange', () => document.body.classList.toggle('r3placing', room.mode !== 'idle'));
  let lastP = 0;
  room.addEventListener('frame', () => {
    $('#r3clock').textContent = `t = ${room.sim.t.toFixed(2)} s`;
    const now = performance.now();
    if (now - lastP > 160) { lastP = now; livePanel(); infoBox(); }
  });
  room.addEventListener('simstate', () => {
    const on = !!room.sim;
    document.body.classList.toggle('r3sim', on);
    $('[data-r="start"]').classList.toggle('hidden', on && room.running);
    $('[data-r="pause"]').classList.toggle('hidden', !(on && room.running));
    $('#r3simtag').classList.toggle('hidden', !on);
    if (!on) $('#r3clock').textContent = 't = 0.00 s';
    liveBuilt = false;
    panel();
    infoBox();
  });

  // ---------- 패널 ----------
  let liveBuilt = false;
  function panel() {
    const box = $('#r3panel');
    const doc = room.doc;
    if (room.sim) { buildLive(); return; }
    let h = '';
    if (room.sel) {
      const c = room.comp(room.sel);
      const d = REG[c.type];
      h += `<div class="isec"><h3>${esc(d.name)}${c.props.tag && !d.module ? ` <span class="pill">${esc(c.props.tag)}</span>` : ''}</h3><p>${esc(d.desc || '')}</p>`;
      if (d.props.length) h += `<form id="r3form" autocomplete="off">${d.props.filter((p) => !(d.module && p.k === 'base')).map((p) => field(c, p)).join('')}</form>`;
      const fixed = (c.b3 && c.b3.rack != null) || c.type.endsWith('supply3d');
      h += `<div class="btnrow">${!fixed && !(c.b3 && c.b3.att) ? '<button class="btn" data-a="rotate">↻ 회전 (R)</button>' : ''}${!fixed ? '<button class="btn danger" data-a="delete">삭제 (Del)</button>' : ''}</div>`;
      const ws = room.linksOf(c.id);
      if (ws.length) h += `<p class="muted" style="margin-top:8px">연결 ${ws.length}개</p>`;
      h += '</div>';
    } else if (room.selWire) {
      const w = doc.wires.find((q) => q.id === room.selWire);
      if (w) h += `<div class="isec"><h3>${w.color ? '전선' : '호스'}</h3><p>${esc(termName(room.comp(w.a.c), w.a.p))}<br>↔ ${esc(termName(room.comp(w.b.c), w.b.p))}</p><div class="btnrow"><button class="btn danger" data-a="delete">삭제 (Del)</button></div></div>`;
    } else {
      if (doc.task) h += `<div class="isec"><div class="task"><b>📋 ${esc(doc.task.title || doc.name)}</b>${doc.task.html || ''}</div></div>`;
      if (doc.ref) {
        const pr = progress();
        h += `<div class="isec"><h3>배선 과제 진행률</h3><div class="prog"><i style="width:${pr.pct}%"></i></div><p>${pr.ok} / ${pr.total} 연결 그룹 완성 ${pr.extra ? `· <span style="color:#c62828">불필요/오결선 ${pr.extra}</span>` : ''}</p><div class="btnrow"><button class="btn" data-a="afluid">${doc.mode === 'hy' ? '유압' : '공압'}배선 분석</button><button class="btn" data-a="aelec">전기배선 분석</button><button class="btn" data-a="answer">정답 보기</button></div></div>`;
      }
      h += `<div class="isec"><h3>실습 방법</h3><ol class="help-list">
        <li>하단 분류에서 부품을 고르고 <b>보드 위를 클릭</b>하여 설치 (드래그로 이동, R 회전, Del 삭제)</li>
        <li>부품의 <b>피팅(파란 링)</b>을 클릭 → 다른 피팅 클릭: <b>호스</b> 연결</li>
        <li>전기 모듈·솔레노이드·센서의 <b>잭</b>을 클릭 → 다른 잭 클릭: <b>전선</b> 연결 (오른쪽에서 전선 색 선택)</li>
        <li>센서는 <b>실린더를 클릭</b>하여 부착 (후진끝·전진끝)</li>
        <li><b>▶ 시작</b> 후 푸시버튼·스위치·밸브를 클릭하여 조작</li>
        <li>마우스: 왼쪽 드래그 회전 · 휠 확대 · 오른쪽 드래그 이동</li></ol></div>`;
      const nf = doc.wires.filter((w) => !w.color).length, ne = doc.wires.filter((w) => w.color).length;
      h += `<div class="isec"><div class="kv"><span>설치 부품</span><b>${doc.components.filter((c) => !(c.b3 && c.b3.rack != null) && !c.type.endsWith('supply3d')).length}</b><span>호스</span><b>${nf}</b><span>전선</span><b>${ne}</b></div>
        <div class="btnrow"><button class="btn pri" data-a="start">▶ 시뮬레이션 시작</button>${doc.src ? '<button class="btn" data-a="2d">2D 회로도 보기</button>' : ''}</div></div>`;
    }
    box.innerHTML = h;
  }
  function field(c, p) {
    const v = c.props[p.k];
    const id = `r3f_${p.k}`;
    let inp;
    if (p.t === 'sel') inp = `<select id="${id}" data-k="${p.k}">${p.opts.map(([k, l]) => `<option value="${k}"${k === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
    else if (p.t === 'bool') inp = `<input type="checkbox" id="${id}" data-k="${p.k}"${v ? ' checked' : ''}>`;
    else if (p.t === 'cyl') inp = `<select id="${id}" data-k="${p.k}"><option value="">(없음)</option>${room.doc.components.filter((q) => q.type.includes('_cyl_')).map((q) => `<option value="${q.id}"${q.id === v ? ' selected' : ''}>${esc(q.props.tag)}</option>`).join('')}</select>`;
    else if (p.t === 'num') inp = `<div class="unit"><input type="number" id="${id}" data-k="${p.k}" value="${esc(v)}" ${p.min != null ? `min="${p.min}"` : ''} ${p.max != null ? `max="${p.max}"` : ''} step="${p.step || 1}"><span>${p.u || ''}</span></div>`;
    else inp = `<input type="text" id="${id}" data-k="${p.k}" value="${esc(v)}" spellcheck="false">`;
    return `<div class="field"><label for="${id}">${esc(p.l)}</label>${inp}</div>`;
  }
  $('#r3panel').addEventListener('change', (e) => {
    const t = e.target;
    if (t.closest('#r3form') && t.dataset.k) {
      const c = room.comp(room.sel);
      const p = REG[c.type].props.find((q) => q.k === t.dataset.k);
      let v = p.t === 'bool' ? t.checked : p.t === 'num' ? +t.value : t.value.trim();
      if (p.t === 'num') { if (p.min != null) v = Math.max(p.min, v); if (p.max != null) v = Math.min(p.max, v); }
      room.setProp(c.id, p.k, v);
    }
  });
  $('#r3panel').addEventListener('input', (e) => {
    const t = e.target;
    if (t.type === 'range' && t.dataset.c) {
      room.comp(t.dataset.c).props[t.dataset.k] = +t.value;
      const lv = $(`#r3lv_${t.dataset.c}_${t.dataset.k}`);
      if (lv) lv.textContent = `${t.value} ${t.dataset.u}`;
    }
  });
  $('#r3panel').addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a;
    if (a === 'rotate') room.rotateSel();
    if (a === 'delete') room.deleteSel();
    if (a === 'start') room.startSim();
    if (a === 'afluid') analysis(false);
    if (a === 'aelec') analysis(true);
    if (a === 'answer') cmd('answer');
    if (a === '2d') onOpen2D(room.doc);
  });

  function buildLive() {
    const doc = room.doc;
    let h = '';
    if (doc.task) h += `<div class="isec"><div class="task"><b>📋 ${esc(doc.task.title || doc.name)}</b>${doc.task.html || ''}</div></div>`;
    h += `<div class="isec"><h3>실시간 상태</h3><div id="r3live"></div></div>`;
    const ctl = [];
    for (const c of doc.components) for (const p of REG[c.type].props) if (p.live && p.t === 'num') ctl.push([c, p]);
    if (ctl.length) {
      h += '<div class="isec"><h3>실시간 조정</h3>';
      for (const [c, p] of ctl) {
        const max = p.k === 'open' ? 100 : p.k === 'load' ? Math.max(2000, Math.abs(+c.props[p.k]) * 2) : /^d\d$|delay/.test(p.k) ? Math.max(10, +c.props[p.k] * 3) : p.k === 'preset' ? Math.max(10, +c.props.preset * 2) : p.max;
        const min = p.k === 'load' ? -max : p.min;
        const nm = REG[c.type].module ? REG[c.type].name.split(' ')[0] : c.props.tag || REG[c.type].name;
        h += `<div class="live-ctl"><div class="lc-top"><span>${esc(nm)} · ${esc(p.l)}</span><b id="r3lv_${c.id}_${p.k}">${c.props[p.k]} ${p.u || ''}</b></div><input type="range" data-c="${c.id}" data-k="${p.k}" data-u="${p.u || ''}" min="${min}" max="${max}" step="${p.step || (max - min > 200 ? 1 : 0.5)}" value="${c.props[p.k]}"></div>`;
      }
      h += '</div>';
    }
    h += `<div class="isec"><h3>조작</h3><ul class="help-list"><li>푸시버튼·누름 밸브: 누르는 동안 작동</li><li>비상정지·셀렉터·디텐트 레버: 클릭마다 전환</li><li>솔레노이드 코일 클릭: 수동 오버라이드</li><li>공급 유닛 레버 / 파워유닛 버튼: ON·OFF</li><li>센서 클릭: 수동 작동</li></ul></div>`;
    $('#r3panel').innerHTML = h;
    liveBuilt = true;
    livePanel();
  }
  function livePanel() {
    const sim = room.sim;
    const el = $('#r3live');
    if (!sim || !el) return;
    let s = '<div class="kv">';
    s += `<span>경과 시간</span><b>${sim.t.toFixed(2)} s</b>`;
    for (const c of sim.cyls) { const st = sim.st.get(c.id); s += `<span>실린더 ${esc(c.props.tag)}</span><b>${st.x.toFixed(0)} / ${c.props.stroke} mm ${st.v > 0.05 ? '▶' : st.v < -0.05 ? '◀' : ''}</b>`; }
    for (const c of room.doc.components) {
      if (c.type === 'p_supply3d') s += `<span>공급 압력</span><b>${sim.st.get(c.id).on ? c.props.p : 0} bar</b>`;
      if (c.type === 'h_supply3d') s += `<span>펌프</span><b>${sim.st.get(c.id).on ? 'ON' : 'OFF'} · ${sim.pAt(c, 'p1').toFixed(1)} bar</b>`;
      if (c.type.endsWith('_motor')) s += `<span>모터 ${esc(c.props.tag)}</span><b>${(sim.st.get(c.id).w * 60).toFixed(0)} rpm</b>`;
    }
    s += '</div>';
    const on = (m) => [...m].filter(([, v]) => v).map(([k]) => k).sort();
    const rel = on(sim.relay);
    if (rel.length) s += `<div style="margin-top:8px"><span class="muted">릴레이 ON</span><br>${rel.map((k) => `<span class="pill on">${esc(k)}</span>`).join('')}</div>`;
    const sols = [];
    for (const c of room.doc.components) if (REG[c.type].valve) { const st = sim.st.get(c.id); if (st.e14) sols.push(`${c.props.tag}(14)`); if (st.e12) sols.push(`${c.props.tag}(12)`); }
    if (sols.length) s += `<div style="margin-top:6px"><span class="muted">솔레노이드 여자</span><br>${sols.map((k) => `<span class="pill on">${esc(k)}</span>`).join('')}</div>`;
    for (const w of sim.warn) s += `<div class="warn">⚠ ${esc(w)}</div>`;
    el.innerHTML = s;
  }

  // ---------- 배선 분석 ----------
  function sigFilter(doc, el) {
    return (net) => net.some((k) => { const [cid] = k.split(':'); const c = doc.components.find((q) => q.id === cid); return c ? (REG[c.type].dom === 'el' || k.startsWith('PSU') || /:(S1[24][ab]|C|NO|NC)$/.test(k)) === el : k.startsWith('PSU') === el; });
  }
  function nameKey(doc, k) {
    if (k === 'SUP:o') return '공압 공급 분배기';
    if (k === 'SUP:P') return '파워유닛 P';
    if (k === 'SUP:T') return '파워유닛 T(탱크)';
    if (k === 'PSU:+') return '전원 +24V';
    if (k === 'PSU:0') return '전원 0V';
    const i = k.indexOf(':');
    return termName(doc.components.find((c) => c.id === k.slice(0, i)), k.slice(i + 1));
  }
  function progress() {
    const doc = room.doc;
    const cur = netSignature(doc).map((n) => n.join('|'));
    const ref = doc.ref.map((n) => n.join('|'));
    const cs = new Set(cur), rs = new Set(ref);
    const ok = ref.filter((n) => cs.has(n)).length;
    return { ok, total: ref.length, extra: cur.filter((n) => !rs.has(n)).length, pct: ref.length ? Math.round((ok / ref.length) * 100) : 0 };
  }
  function analysis(el) {
    const doc = room.doc;
    const title = el ? '전기배선 분석' : `${doc.mode === 'hy' ? '유압' : '공압'}배선 분석`;
    const nets = netSignature(doc).filter(sigFilter(doc, el));
    let h = '';
    // 미연결 포트
    if (!el) {
      const used = new Set(doc.wires.flatMap((w) => [w.a.c + ':' + w.a.p, w.b.c + ':' + w.b.p]));
      const open = [];
      for (const c of doc.components) {
        const d = REG[c.type];
        if (d.dom === 'el' || c.type.endsWith('supply3d') || c.type.endsWith('_tee')) continue;
        for (const p of d.ports(c)) if (!used.has(c.id + ':' + p.id) && !p.exh && !p.pilot) open.push(termName(c, p.id));
      }
      if (open.length) h += `<p><b>미연결 포트</b> <span class="muted">(배기 포트·파일럿 제외)</span><br>${open.map((t) => `<span class="pill">${esc(t)}</span>`).join('')}</p>`;
    } else {
      const short = nets.some((n) => n.includes('PSU:+') && n.includes('PSU:0'));
      if (short) h += '<div class="warn">⚠ +24V와 0V가 직접 연결되어 있습니다 (단락).</div>';
    }
    if (doc.ref) {
      const ref = doc.ref.filter(sigFilter(doc, el));
      const cur = new Set(nets.map((n) => n.join('|')));
      const rs = new Set(ref.map((n) => n.join('|')));
      const ok = ref.filter((n) => cur.has(n.join('|')));
      const miss = ref.filter((n) => !cur.has(n.join('|')));
      const extra = nets.filter((n) => !rs.has(n.join('|')));
      h += `<h4 style="margin:10px 0 6px">정답 비교 — <span style="color:${miss.length || extra.length ? '#c62828' : '#12a150'}">${ok.length}/${ref.length} 일치</span></h4>`;
      if (!miss.length && !extra.length) h += '<p>✅ 모든 연결이 정답과 일치합니다. ▶ 시작으로 동작을 확인하세요.</p>';
      if (miss.length) h += `<p><b style="color:#c62828">✗ 미완성 / 다르게 연결된 그룹</b></p><ul class="help-list">${miss.map((n) => `<li>${n.map((k) => esc(nameKey(doc, k))).join(' — ')}</li>`).join('')}</ul>`;
      if (extra.length) h += `<p><b style="color:#b45309">⚠ 정답에 없는 연결 그룹</b></p><ul class="help-list">${extra.map((n) => `<li>${n.map((k) => esc(nameKey(doc, k))).join(' — ')}</li>`).join('')}</ul>`;
      if (el) h += '<p class="muted">※ 릴레이·타이머의 다른 접점 번호를 사용해도 동작이 같을 수 있습니다. 최종 확인은 시뮬레이션으로 하세요.</p>';
    }
    h += `<h4 style="margin:12px 0 6px">연결 목록 (${nets.length} 그룹)</h4>`;
    h += nets.length ? `<ol class="help-list">${nets.map((n) => `<li>${n.map((k) => esc(nameKey(doc, k))).join(' — ')}</li>`).join('')}</ol>` : '<p class="muted">연결이 없습니다.</p>';
    modal(title, h);
  }

  function help() {
    modal('3D 실습실 사용 방법', `<div class="help">
      <h4>1. 부품 설치</h4><ul><li>화면 아래 분류(작동기, 솔레노이드 작동 밸브 …)를 눌러 부품을 고르고, 보드 위를 클릭하면 슬롯에 고정됩니다.</li><li>설치한 부품은 드래그로 이동, <kbd>R</kbd> 회전, <kbd>Del</kbd> 삭제. 클릭하면 오른쪽에서 속성(태그, 행정, 압력, 시간)을 바꿀 수 있습니다.</li><li>검지 센서는 실린더를 클릭하여 부착합니다. (후진끝/전진끝 자동 맞춤)</li></ul>
      <h4>2. 호스 연결</h4><ul><li>피팅(파란 링 / 유압 커플러)을 클릭한 뒤 다른 피팅을 클릭하면 호스가 연결됩니다.</li><li>하나의 피팅에는 호스 1개만 꽂을 수 있습니다. 분기가 필요하면 <b>기타 → 분기 티</b>를 사용하세요. 공급 유닛에는 출구가 여러 개 있습니다.</li><li>배기 포트(3, 5)는 막지 않으면 대기로 배기됩니다.</li></ul>
      <h4>3. 전선 연결</h4><ul><li>전기 모듈·솔레노이드 커넥터·센서·압력 스위치의 잭(바나나 단자)을 클릭한 뒤 다른 잭을 클릭합니다. 한 잭에 여러 전선을 꽂을 수 있습니다.</li><li>오른쪽 도구에서 전선 색을 선택하세요. (+24V 빨강, 0V 파랑 권장)</li></ul>
      <h4>4. 시뮬레이션</h4><ul><li>▶ 시작 후 푸시버튼, 셀렉터, 비상정지, 수동 밸브, 공급 레버를 클릭하여 조작합니다. 압력이 걸린 호스는 밝게 빛납니다.</li><li>호스에 마우스를 올리면 압력이 표시됩니다.</li></ul>
      <h4>5. 배선 분석 · 과제</h4><ul><li>예제를 <b>배선 과제</b>로 열면 부품만 설치되어 있습니다. 직접 배선한 뒤 <b>공압/전기배선 분석</b>으로 정답과 비교하세요.</li></ul>
      <h4>조작</h4><table><tbody><tr><td>왼쪽 드래그</td><td>시점 회전</td></tr><tr><td>휠</td><td>확대/축소</td></tr><tr><td>오른쪽 드래그</td><td>시점 이동</td></tr><tr><td>Esc</td><td>연결/설치 취소 · 시뮬레이션 정지</td></tr><tr><td>Ctrl+Z / Ctrl+Y</td><td>실행 취소 / 다시 실행</td></tr></tbody></table></div>`);
  }

  function download(name, data) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  }

  return {
    room,
    open(doc) { room.load(doc); cat = -1; renderCats(); panel(); $('#r3title').textContent = `${room.doc.mode === 'hy' ? '유압' : '공압'} 실습실 — ${room.doc.name || ''}`; },
    show() {
      document.body.classList.add('mode3d');
      room.start();
      requestAnimationFrame(() => room.resize());
      if (!fontsHooked && document.fonts && document.fonts.status !== 'loaded') {
        fontsHooked = true;
        document.fonts.ready.then(() => { if (!room.sim) room.rebuild(); });
      }
    },
    hide() { document.body.classList.remove('mode3d'); room.stop(); room.stopSim(); },
    key: (e) => room.key(e),
    renderCats,
  };
}

export function stripDoc(d) {
  const o = { ...d };
  return o;
}
