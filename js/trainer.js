// 가상 실습장비 뷰: 회로를 실습 패널 위의 모듈로 자동 배치하고 호스로 연결하여 시뮬레이션과 동기화
import { REG, parseMarks, compBBox } from './components.js';

const NS = 'http://www.w3.org/2000/svg';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
const R = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
const Ci = (x, y, r, fill, extra = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
const Tx = (x, y, s, size = 10, fill = '#1f2937', anchor = 'middle', w = 600) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${w}" font-family="Arial,'Noto Sans KR',sans-serif">${esc(s)}</text>`;

const DEFS = `
<linearGradient id="tg-alu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3e7ec"/><stop offset="1" stop-color="#c3cad2"/></linearGradient>
<linearGradient id="tg-chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#a7b0ba"/><stop offset="1" stop-color="#eef1f4"/></linearGradient>
<linearGradient id="tg-bpn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6f8"/><stop offset=".5" stop-color="#b9c2cc"/><stop offset="1" stop-color="#e5e9ee"/></linearGradient>
<linearGradient id="tg-bhy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a6574"/><stop offset=".5" stop-color="#232a33"/><stop offset="1" stop-color="#4b5563"/></linearGradient>
<linearGradient id="tg-valve" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7f9fcc"/><stop offset="1" stop-color="#3c5d8e"/></linearGradient>
<linearGradient id="tg-hvalve" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6d7783"/><stop offset="1" stop-color="#3a424c"/></linearGradient>
<linearGradient id="tg-coil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4a4a"/><stop offset="1" stop-color="#111"/></linearGradient>
<linearGradient id="tg-brass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6dc8c"/><stop offset="1" stop-color="#b6862e"/></linearGradient>
<linearGradient id="tg-tank" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fb0c2"/><stop offset="1" stop-color="#5f6f80"/></linearGradient>
<linearGradient id="tg-motor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fa37a"/><stop offset="1" stop-color="#2f6b48"/></linearGradient>
<linearGradient id="tg-box" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8fafc"/><stop offset="1" stop-color="#dde3ea"/></linearGradient>
<radialGradient id="tg-dial"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e3e8ee"/></radialGradient>
<filter id="tg-sh" x="-10%" y="-10%" width="130%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity=".35"/></filter>
<filter id="tg-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<pattern id="tg-slot" width="60" height="40" patternUnits="userSpaceOnUse"><rect width="60" height="40" fill="#cfd5dc"/><rect y="17" width="60" height="6" fill="#8f99a5"/><rect y="17" width="60" height="1.5" fill="#6f7984"/><rect y="23" width="60" height="1" fill="#eef1f4"/></pattern>
<pattern id="tg-perf" width="25" height="25" patternUnits="userSpaceOnUse"><rect width="25" height="25" fill="#3d4651"/><circle cx="12.5" cy="12.5" r="3.2" fill="#262c33"/></pattern>
`;

const led = (x, y, on, col = '#22e36b', r = 4) => Ci(x, y, r, on ? col : '#3b4048', `stroke="#111" stroke-width="1" ${on ? 'filter="url(#tg-glow)"' : ''}`);
const nipple = (x, y, lab, dir = 'down') => {
  const dy = dir === 'up' ? -1 : 1;
  return R(x - 5, dir === 'up' ? y : y - 7, 10, 7, 'url(#tg-brass)', 'stroke="#7a5a1c" stroke-width=".8"') + (lab ? Tx(x, y - dy * 11 + (dir === 'up' ? 4 : 0), lab, 8, '#e8edf3') : '');
};
const plate = (w, h, fill = 'url(#tg-box)') => R(0, 0, w, h, fill, 'rx="6" stroke="#59626d" stroke-width="1.2" filter="url(#tg-sh)"');
const label = (w, h, t) => (t ? R(w / 2 - 22, h - 15, 44, 12, '#fff', 'rx="2" stroke="#9aa3ad" stroke-width=".6"') + Tx(w / 2, h - 6, t, 8.5, '#111') : '');

/* ---------------- 모듈 정의 ---------------- */
function modCylinder(c, st, sim) {
  const hy = c.type.startsWith('h_');
  const L0 = +c.props.stroke || 100;
  const f = st ? Math.max(0, Math.min(1, st.x / L0)) : (+c.props.x0 || 0) / 100;
  const w = 400, h = 92;
  const px = 40 + 150 * f;
  let s = R(10, 64, 220, 10, '#7d8793', 'rx="2"');
  s += R(18, 30, 196, 34, hy ? 'url(#tg-bhy)' : 'url(#tg-bpn)', 'rx="4" stroke="#4b5563"');
  s += R(12, 26, 18, 42, '#47505c', 'rx="3"') + R(204, 26, 18, 42, '#47505c', 'rx="3"');
  s += R(px - 4, 32, 8, 30, hy ? '#9aa3ad' : '#2a3038', 'opacity=".55"');
  s += R(px, 43, 190 + 0, 8, 'url(#tg-chrome)', 'stroke="#6b7480" stroke-width=".7"');
  s += R(px + 186, 36, 14, 22, '#5d6672', 'rx="2"');
  // 센서
  for (const m of parseMarks(c)) {
    const sx = 40 + 150 * (m.pos / L0);
    const on = sim && sim.markOn(m.tag);
    s += R(sx - 9, 16, 18, 12, '#2f3640', 'rx="2"') + led(sx, 22, on, '#ff3b30', 3) + R(sx - 14, 1, 28, 11, '#fff', 'rx="2" opacity=".9"') + Tx(sx, 10, m.tag, 8.5, '#111');
  }
  s += R(40, 77, 140, 14, '#fff', 'rx="3" opacity=".92"') + Tx(110, 88, `${c.props.tag}  ${hy ? '유압' : '공압'} 실린더 ø${c.props.bore}×${L0}`, 9, '#111');
  const ports = { A: [40, 74, 'down'] };
  s += nipple(40, 74, hy ? 'A' : '');
  if (!c.type.includes('single')) { ports.B = [196, 74, 'down']; s += nipple(196, 74, hy ? 'B' : ''); }
  return { w, h, s, ports, bg: false };
}

function modValve(c, st, sim) {
  const d = REG[c.type];
  const spec = d.valve;
  const hy = d.dom === 'hy';
  const n = spec.pos.length;
  const bw = 34 * n + 16;
  const lA = actW(spec.L), rA = actW(spec.R);
  const w = lA + bw + rA + 20, h = 96;
  const x0 = 10 + lA;
  let s = '';
  s += R(x0, 30, bw, 36, hy ? 'url(#tg-hvalve)' : 'url(#tg-valve)', 'rx="3" stroke="#22324a"');
  // 위치 표시 창
  const pos = st ? st.pos : spec.rest;
  for (let i = 0; i < n; i++) s += R(x0 + 8 + i * 34, 38, 30, 14, i === pos ? '#ffd84d' : '#203048', 'rx="2" stroke="#0e1726" stroke-width=".8"');
  s += Tx(x0 + bw / 2, 63, `${spec.top.length + spec.bot.length}/${n}`, 9, '#e5ecf6');
  const act = (acts, side) => {
    let o = 0;
    const xs = side < 0 ? x0 : x0 + bw;
    for (const a of acts) {
      const ax = side < 0 ? xs - o - actW([a]) : xs + o;
      const aw = actW([a]);
      const on = st && (side < 0 ? st.actL : st.actR);
      if (a.t === 'sol') {
        s += R(ax, 26, aw, 44, 'url(#tg-coil)', 'rx="3"') + led(ax + aw / 2, 34, on && sim && (sim.solOn(c.props[a.k]) || (side < 0 ? st.man.L : st.man.R)), '#ff3b30', 3.5) + Tx(ax + aw / 2, 60, c.props[a.k] || '', 8.5, '#f3f4f6');
      } else if (a.t === 'spring') {
        s += R(ax, 38, aw, 20, '#8892a0', 'rx="3" stroke="#3d4651"');
        for (let i = 0; i < 4; i++) s += `<line x1="${ax + 4 + i * 5}" y1="40" x2="${ax + 6 + i * 5}" y2="56" stroke="#2b323b" stroke-width="1.2"/>`;
      } else if (a.t === 'push') {
        s += R(ax + aw - 8, 40, 8, 16, '#9aa3ad') + `<rect x="${ax + (on ? 6 : 0)}" y="34" width="14" height="28" rx="6" fill="${on ? '#ff6b57' : '#e53935'}" stroke="#7a1010"/>`;
      } else if (a.t === 'lever' || a.t === 'lever_det') {
        const ang = st ? (spec.pos.length === 2 ? (pos === 0 ? -35 : 35) : (pos - 1) * 35) : 35;
        s += R(ax + aw - 10, 40, 10, 16, '#9aa3ad') + `<g transform="translate(${ax + aw - 6},48) rotate(${side < 0 ? ang : -ang})"><rect x="-3" y="-38" width="6" height="38" fill="#30363d"/><circle cx="0" cy="-40" r="7" fill="#e53935" stroke="#7a1010"/></g>`;
      } else if (a.t === 'roller') {
        const ron = sim && (sim.markOn(c.props[a.k]) || st.man.L);
        s += R(ax + 6, 40, aw - 6, 16, '#9aa3ad') + `<line x1="${ax + 10}" y1="48" x2="${ax + 2}" y2="${ron ? 30 : 24}" stroke="#30363d" stroke-width="4"/>` + Ci(ax + 2, ron ? 27 : 21, 6, ron ? '#ffd84d' : '#e8edf2', 'stroke="#30363d" stroke-width="2"') + R(ax - 8, 2, 30, 11, '#fff', 'rx="2" opacity=".9"') + Tx(ax + 7, 11, c.props[a.k] || '', 8.5, '#111');
      } else if (a.t === 'pilot') {
        s += R(ax, 40, aw, 16, 'url(#tg-brass)', 'rx="2"');
      }
      o += aw;
    }
  };
  act(spec.L, -1);
  act(spec.R, 1);
  // 포트
  const ports = {};
  const allTop = spec.top, allBot = spec.bot;
  const place = (arr, y, dir) => arr.forEach(([id], i) => {
    const px = x0 + 14 + ((bw - 28) * (i + 0.5)) / arr.length;
    ports[id] = [px, y, dir];
    s += nipple(px, y, d.ports(c).find((p) => p.id === id)?.lab ?? id, dir);
  });
  place(allTop, 30, 'up');
  place(allBot, 66, 'down');
  if (spec.pilotL) { ports[spec.pilotL] = [x0 - lA + 6, 66, 'down']; s += nipple(x0 - lA + 6, 66, spec.pilotL); }
  if (spec.pilotR && spec.R.some((a) => a.t === 'pilot')) { ports[spec.pilotR] = [x0 + bw + rA - 6, 66, 'down']; s += nipple(x0 + bw + rA - 6, 66, spec.pilotR); }
  s += R(w / 2 - 20, 81, 40, 13, '#fff', 'rx="3" opacity=".92"') + Tx(w / 2, 91, c.props.tag, 9, '#111');
  return { w, h, s, ports };
}
function actW(acts) { let w = 0; for (const a of acts) w += a.t === 'sol' ? 24 : a.t === 'spring' ? 24 : a.t === 'pilot' ? 14 : a.t === 'roller' ? 26 : 22; return w; }

function dial(cx, cy, r, p, pmax, unit = 'bar') {
  const a = (-225 + 270 * Math.max(0, Math.min(1, p / pmax))) * (Math.PI / 180);
  let s = Ci(cx, cy, r + 3, '#2b3037') + Ci(cx, cy, r, 'url(#tg-dial)', 'stroke="#8a95a5"');
  for (let i = 0; i <= 10; i++) {
    const t = (-225 + 27 * i) * (Math.PI / 180);
    s += `<line x1="${cx + Math.cos(t) * (r - 2)}" y1="${cy + Math.sin(t) * (r - 2)}" x2="${cx + Math.cos(t) * (r - (i % 5 ? 5 : 8))}" y2="${cy + Math.sin(t) * (r - (i % 5 ? 5 : 8))}" stroke="#333" stroke-width="${i % 5 ? 0.7 : 1.2}"/>`;
  }
  s += `<line x1="${cx}" y1="${cy}" x2="${cx + Math.cos(a) * (r - 6)}" y2="${cy + Math.sin(a) * (r - 6)}" stroke="#d32f2f" stroke-width="1.8"/>` + Ci(cx, cy, 2.5, '#222');
  s += Tx(cx, cy + r * 0.62, `${p.toFixed(pmax > 20 ? 0 : 1)}`, r > 16 ? 8 : 7, '#111');
  s += Tx(cx, cy - r * 0.35, unit, 6, '#666', 'middle', 400);
  return s;
}

function modGauge(c, st, sim) {
  const hy = c.type.startsWith('h_');
  const p = sim ? sim.pAt(c, '1') : 0;
  const w = 66, h = 80;
  let s = dial(33, 32, 24, p, hy ? 100 : 10) + R(28, 58, 10, 8, '#8a95a5');
  s += nipple(33, 72, '');
  return { w, h, s, ports: { 1: [33, 72, 'down'] }, bg: false };
}

function modBlock(c, st, sim, title, inner, ports, w = 86, h = 58) {
  let s = plate(w, h) + inner;
  const pp = {};
  for (const [id, x, y, dir, lab] of ports) { pp[id] = [x, y, dir]; s += nipple(x, y, lab ?? '', dir); }
  s += Tx(w / 2, 13, title, 8.5, '#334155');
  return { w, h, s, ports: pp };
}
const knob = (x, y, r = 8, rot = 0) => `<g transform="translate(${x},${y}) rotate(${rot})">${Ci(0, 0, r, '#2f343b', 'stroke="#111"')}<rect x="-1.5" y="${-r}" width="3" height="${r * 0.8}" fill="#e5e7eb"/></g>`;

function modGeneric(c, st, sim) {
  const d = REG[c.type];
  const t = c.type;
  const hy = d.dom === 'hy';
  const tag = c.props.tag || '';
  if (t === 'p_source') {
    const w = 130, h = 70;
    let s = plate(w, h, '#f1f5f9') + R(14, 26, 102, 22, 'url(#tg-alu)', 'rx="3" stroke="#6b7480"') + Tx(w / 2, 16, '압축공기 공급', 9, '#334155');
    s += Ci(30, 37, 7, '#1e88e5') + Tx(65, 41, `${c.props.p} bar`, 10, '#0b5bd3');
    s += nipple(100, 26, '', 'up');
    return { w, h, s, ports: { 1: [100, 26, 'up'] } };
  }
  if (t === 'p_frl') {
    const w = 96, h = 120, p = sim ? sim.pAt(c, '2') : 0;
    let s = plate(w, h, '#e9eef3') + Tx(w / 2, 13, '서비스 유닛', 8.5, '#334155');
    s += R(8, 40, 80, 16, 'url(#tg-alu)', 'stroke="#6b7480"');
    s += `<path d="M18 56 h20 v34 q-10 14 -20 0 z" fill="#cfe7ff" stroke="#5a7da8" opacity=".9"/>` + dial(64, 82, 16, p, 10) + knob(64, 30, 8, 30);
    s += nipple(14, 112, '1', 'down') + nipple(82, 112, '2', 'down');
    return { w, h, s, ports: { 1: [14, 112, 'down'], 2: [82, 112, 'down'] } };
  }
  if (t === 'h_powerunit' || t === 'h_pump') {
    const pu = t === 'h_powerunit';
    const w = pu ? 280 : 170, h = pu ? 190 : 150;
    const on = st ? st.on : false;
    const p = sim ? sim.pAt(c, 'P') : 0;
    let s = R(0, 0, w, h, 'url(#tg-tank)', 'rx="8" stroke="#2c3540" stroke-width="1.5" filter="url(#tg-sh)"');
    s += R(10, h - 70, w - 20, 60, '#7c8a99', 'rx="4" stroke="#4a5562"') + R(18, h - 50, 60, 10, '#1f6fd1', 'opacity=".55"') + Tx(48, h - 56, '작동유', 8, '#e2e8f0');
    s += R(20, 30, 70, 50, 'url(#tg-motor)', 'rx="8" stroke="#1e4630"') + Tx(55, 60, 'M', 16, '#e6fff0', 'middle', 700);
    s += R(90, 45, 20, 20, '#9aa3ad') + Ci(128, 55, 18, '#515b67', 'stroke="#222"');
    if (on) s += `<g transform="translate(128,55) rotate(${((sim?.t || 0) * 900) % 360})"><rect x="-2" y="-14" width="4" height="28" fill="#c9d1da"/></g>`;
    s += Tx(128, 85, '펌프', 8, '#e2e8f0');
    s += `<rect x="20" y="96" width="40" height="22" rx="4" fill="${on ? '#22c55e' : '#7f1d1d'}" stroke="#111"/>` + Tx(40, 111, on ? 'ON' : 'OFF', 10, '#fff', 'middle', 700);
    const ports = { P: [pu ? 170 : 128, 0, 'up'] };
    s += nipple(ports.P[0], 0, 'P', 'up');
    if (pu) {
      s += dial(220, 50, 24, p, Math.max(100, +c.props.p * 1.4)) + R(165, 92, 70, 28, '#c7cdd4', 'rx="3" stroke="#59626d"') + knob(180, 106, 8, (+c.props.p) * 2) + Tx(212, 110, `${c.props.p}bar`, 8.5, '#111');
      ports.T = [250, 0, 'up'];
      s += nipple(250, 0, 'T', 'up');
      s += Tx(w / 2, h - 18, `${tag} 유압 파워유닛 ${c.props.q} L/min`, 9, '#f8fafc');
    } else s += Tx(w / 2, h - 18, `${tag} 펌프 ${c.props.q} L/min`, 9, '#f8fafc');
    return { w, h, s, ports, bg: false, press: true };
  }
  if (t === 'h_tank') {
    const w = 120, h = 70;
    return { w, h, s: R(0, 10, w, h - 10, 'url(#tg-tank)', 'rx="6" stroke="#2c3540"') + Tx(60, 50, '탱크', 10, '#f8fafc') + nipple(60, 10, 'T', 'up'), ports: { T: [60, 10, 'up'] }, bg: false };
  }
  if (t === 'h_accumulator') {
    const w = 56, h = 120;
    return { w, h, s: R(10, 4, 36, 96, '#c62828', 'rx="18" stroke="#5c0e0e"') + Tx(28, 56, 'ACC', 8, '#fff') + nipple(28, 108, '', 'down'), ports: { 1: [28, 108, 'down'] }, bg: false };
  }
  if (t.endsWith('_motor')) {
    const w = 100, h = 100;
    const a = st ? (st.ang * 180) / Math.PI : 0;
    let s = plate(w, h) + Ci(50, 50, 30, hy ? '#2f3a46' : '#6b8bb8', 'stroke="#111"') + `<g transform="translate(50,50) rotate(${a})"><rect x="-3" y="-26" width="6" height="26" fill="#ffd84d"/></g>` + Ci(50, 50, 6, '#ddd');
    s += Tx(50, 96, tag, 9);
    s += nipple(20, 86, 'A', 'down') + nipple(80, 86, 'B', 'down');
    return { w, h, s, ports: { A: [20, 86, 'down'], B: [80, 86, 'down'] } };
  }
  const two = (lab1 = '1', lab2 = '2') => [['1', 10, 50, 'down', lab1], ['2', 76, 50, 'down', lab2]];
  if (t.endsWith('_throttle') || t.endsWith('_flow_oneway') || t === 'h_fcv') {
    const val = t === 'h_fcv' ? `${c.props.q}L/m` : `${c.props.open}%`;
    return modBlock(c, st, sim, t.endsWith('oneway') ? '일방향 유량제어' : t === 'h_fcv' ? '유량조절(보상)' : '교축 밸브', R(22, 22, 42, 18, hy ? '#58626e' : '#7f9fcc', 'rx="3"') + knob(43, 31, 8, (+c.props.open || 50) * 2.7) + Tx(43, 51, val, 8.5, '#0b5bd3'), two());
  }
  if (t.endsWith('_check')) return modBlock(c, st, sim, '체크 밸브', R(20, 24, 46, 14, hy ? '#58626e' : '#9fb6d6', 'rx="7"') + `<path d="M50 31 l-10 -5 v10z" fill="#111"/>`, two());
  if (t === 'p_shuttle' || t === 'p_twopress') {
    return modBlock(c, st, sim, t === 'p_shuttle' ? '셔틀(OR)' : '2압(AND)', R(18, 22, 50, 14, '#9fb6d6', 'rx="3"') + Ci(st && st.sel === 'Y' ? 28 : 58, 29, 5, '#333'), [['X', 10, 50, 'down', '1'], ['Y', 76, 50, 'down', '1'], ['A', 43, 22, 'up', '2']]);
  }
  if (t === 'p_qexh') return modBlock(c, st, sim, '급속배기', R(20, 24, 46, 14, '#9fb6d6', 'rx="3"'), two());
  if (t.endsWith('_pswitch')) {
    const on = sim && sim.ps.get(c.props.tag);
    return modBlock(c, st, sim, `압력SW ${tag}`, R(20, 20, 46, 20, '#2f3640', 'rx="3"') + led(33, 30, on, '#ffcc00') + Tx(55, 34, `${c.props.p}`, 9, '#fff'), [['1', 43, 50, 'down', '']]);
  }
  if (t === 'h_relief' || t === 'h_reducing' || t === 'h_sequence') {
    const nm = t === 'h_relief' ? '릴리프' : t === 'h_reducing' ? '감압' : '시퀀스';
    const pp = t === 'h_relief' ? [['P', 14, 72, 'down', 'P'], ['T', 72, 72, 'down', 'T']] : [['P', 14, 72, 'down', 'P'], ['A', 72, 72, 'down', 'A']];
    const act = st && (st.open || st.mode);
    return modBlock(c, st, sim, `${nm} 밸브`, R(18, 20, 50, 40, '#58626e', 'rx="4"') + knob(43, 36, 10, (+c.props.p) * 3) + Tx(43, 58, `${c.props.p}bar`, 8.5, '#fff') + led(72, 24, act, '#ffcc00', 3), pp, 86, 80);
  }
  if (t === 'h_pocheck') return modBlock(c, st, sim, '파일럿 체크', R(18, 22, 50, 16, '#58626e', 'rx="3"') + led(70, 28, st && st.po, '#ffcc00', 3), [['1', 10, 50, 'down', '1'], ['2', 76, 50, 'down', '2'], ['X', 43, 50, 'down', 'X']]);
  if (t === 'h_filter') return modBlock(c, st, sim, '필터', R(28, 18, 30, 26, '#58626e', 'rx="4"'), two());
  // 기타
  const ports = d.ports(c);
  return modBlock(c, st, sim, d.name.slice(0, 10), '', ports.map((p, i) => [p.id, 12 + (i * 62) / Math.max(1, ports.length - 1), 50, 'down', p.lab ?? p.id]));
}

/* ---------------- 전기 제어반 모듈 ---------------- */
function elecGroups(doc) {
  const groups = [];
  const by = new Map();
  const add = (key, kind, c, title) => {
    if (!by.has(key)) { const g = { key, kind, comps: [], title, tag: c.props.tag }; by.set(key, g); groups.push(g); }
    by.get(key).comps.push(c);
  };
  for (const c of doc.components) {
    const t = c.type;
    if (t === 'e_24v' || t === 'e_0v') add('psu', 'psu', c, 'DC 24V 전원');
    else if (t === 'e_pb_no' || t === 'e_pb_nc') add('pb:' + c.props.tag, 'pb', c, '푸시버튼');
    else if (t === 'e_sw_no' || t === 'e_sw_nc') add('sw:' + c.props.tag, 'sw', c, '셀렉터 스위치');
    else if (t === 'e_estop') add('es:' + c.props.tag, 'es', c, '비상정지');
    else if (t === 'e_relay' || t === 'e_relay_no' || t === 'e_relay_nc') add('r:' + c.props.tag, 'relay', c, '릴레이');
    else if (t === 'e_ton' || t === 'e_toff' || t === 'e_timer_no' || t === 'e_timer_nc') add('t:' + c.props.tag, 'timer', c, '타이머');
    else if (t.startsWith('e_counter')) add('c:' + c.props.tag, 'counter', c, '카운터');
    else if (t === 'e_lamp') add('l:' + c.props.tag, 'lamp', c, '표시등');
    else if (t === 'e_buzzer') add('b:' + c.props.tag, 'buzzer', c, '부저');
  }
  return groups;
}

function modElec(g, sim) {
  const w = 92, h = 112;
  let s = R(0, 0, w, h, '#f5f7fa', 'rx="5" stroke="#4a5562" stroke-width="1.2" filter="url(#tg-sh)"');
  s += R(0, 0, w, 18, '#2b3540', 'rx="5"') + R(0, 10, w, 8, '#2b3540') + Tx(w / 2, 13, g.title, 9, '#f1f5f9');
  const tag = g.tag;
  const jack = (x, y, col) => Ci(x, y, 5, col, 'stroke="#111" stroke-width="1"') + Ci(x, y, 2, '#111');
  const jacks = (n) => { let r = ''; for (let i = 0; i < n; i++) r += jack(20 + i * 18, 98, i % 2 ? '#1e40af' : '#c62828'); return r; };
  switch (g.kind) {
    case 'psu':
      s += R(14, 26, 64, 28, '#0f172a', 'rx="3"') + Tx(46, 45, sim ? '24.0 V' : '-- V', 12, sim ? '#4ade80' : '#475569', 'middle', 700);
      s += led(20, 66, !!sim, '#22e36b') + Tx(50, 70, 'POWER', 8, '#334155');
      s += jack(28, 94, '#c62828') + Tx(28, 82, '+24V', 7.5, '#c62828') + jack(64, 94, '#1e40af') + Tx(64, 82, '0V', 7.5, '#1e40af');
      break;
    case 'pb': {
      const on = sim && sim.btn.get(tag);
      const red = g.comps.every((c) => c.type === 'e_pb_nc') || /stop|정지|PB2|OFF/i.test(tag);
      s += Ci(46, 52, 22, '#c3cad2', 'stroke="#59626d"') + Ci(46, 52 + (on ? 1.5 : 0), on ? 15 : 17, red ? (on ? '#ff6b57' : '#e53935') : on ? '#4ade80' : '#16a34a', 'stroke="#111"');
      s += Tx(46, 90, tag, 10, '#111', 'middle', 700) + jacks(4);
      break;
    }
    case 'sw': case 'es': {
      const on = sim && sim.sw.get(tag);
      if (g.kind === 'es') s += Ci(46, 52, 24, '#ffd600', 'stroke="#59626d"') + Ci(46, 52, on ? 14 : 18, on ? '#9b1c1c' : '#ef4444', 'stroke="#111"') + Tx(46, 90, on ? '정지됨' : tag, 9, '#111');
      else s += Ci(46, 50, 20, '#2f343b') + `<g transform="translate(46,50) rotate(${on ? 40 : -40})"><rect x="-4" y="-18" width="8" height="30" rx="3" fill="#e5e7eb"/></g>` + Tx(46, 88, `${tag} ${on ? 'ON' : 'OFF'}`, 9, '#111');
      s += jacks(4);
      break;
    }
    case 'relay': {
      const on = sim && sim.relay.get(tag);
      s += R(16, 26, 60, 40, '#1f2937', 'rx="3"') + R(22, 32, 48, 28, '#eef2f6', 'rx="2"') + Tx(46, 50, tag, 11, '#111', 'middle', 700) + led(46, 74, on, '#ff3b30');
      s += Tx(46, 88, `접점 ${g.comps.filter((c) => c.type !== 'e_relay').length}`, 8, '#475569') + jacks(4);
      break;
    }
    case 'timer': {
      const t = sim && sim.timers.get(tag);
      const coil = g.comps.find((c) => c.type === 'e_ton' || c.type === 'e_toff');
      const delay = coil ? +coil.props.delay : 0;
      const v = t ? (t.mode === 'on' ? Math.min(t.acc, delay) : t.hold ? t.acc : 0) : 0;
      s += R(12, 26, 68, 26, '#0f172a', 'rx="3"') + Tx(46, 45, `${v.toFixed(1)}s`, 13, '#fb923c', 'middle', 700);
      s += Tx(46, 64, `${tag} 설정 ${delay}s ${coil && coil.type === 'e_toff' ? 'OFF' : 'ON'}`, 8, '#334155') + led(20, 76, t && t.coil) + led(72, 76, sim && sim.timerOut(tag), '#ff3b30') + jacks(4);
      break;
    }
    case 'counter': {
      const t = sim && sim.counters.get(tag);
      const coil = g.comps.find((c) => c.type === 'e_counter');
      s += R(12, 26, 68, 26, '#0f172a', 'rx="3"') + Tx(46, 45, `${t ? t.count : 0} / ${coil ? coil.props.preset : '-'}`, 12, '#4ade80', 'middle', 700);
      s += Tx(46, 66, tag, 9, '#111') + led(72, 76, sim && sim.counterOut(tag), '#ff3b30') + jacks(4);
      break;
    }
    case 'lamp': {
      const c = g.comps[0];
      const st = sim && sim.st.get(c.id);
      const on = st && st.on;
      const col = { yellow: '#ffd600', red: '#ff3b30', green: '#22c55e', white: '#f8fafc' }[c.props.color || 'yellow'];
      s += Ci(46, 52, 22, '#9aa3ad') + Ci(46, 52, 17, on ? col : '#4b5058', `stroke="#111" ${on ? 'filter="url(#tg-glow)"' : ''}`) + Tx(46, 90, tag, 10, '#111', 'middle', 700) + jacks(2);
      break;
    }
    case 'buzzer': {
      const st = sim && sim.st.get(g.comps[0].id);
      const on = st && st.on;
      s += Ci(46, 52, 20, '#1f2937') + Ci(46, 52, 8, '#555');
      if (on) s += `<path d="M72 40 q8 12 0 24 M78 34 q12 18 0 36" stroke="#e11d48" stroke-width="2" fill="none"/>`;
      s += Tx(46, 90, tag, 10, '#111', 'middle', 700) + jacks(2);
      break;
    }
  }
  return { w, h, s, ports: {} };
}

/* ---------------- 트레이너 ---------------- */
export class Trainer {
  constructor(svg, ed) {
    this.svg = svg;
    this.ed = ed;
    this.mods = [];
    this.vb = null;
    this.showHose = true;
    svg.innerHTML = `<defs>${DEFS}</defs><g class="t-root"></g>`;
    this.root = svg.querySelector('.t-root');
    this.bind();
  }

  layout() {
    const doc = this.ed.doc;
    const fluid = doc.components.filter((c) => REG[c.type].dom !== 'el' && !REG[c.type].junction);
    // 회로 위치 기준 행 분할
    const items = fluid.map((c) => { const b = compBBox(c); return { c, cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2 }; }).sort((a, b) => a.cy - b.cy);
    const rows = [];
    for (const it of items) {
      const r = rows[rows.length - 1];
      if (r && Math.abs(it.cy - r.y) < 70) { r.items.push(it); r.y = (r.y * (r.items.length - 1) + it.cy) / r.items.length; }
      else rows.push({ y: it.cy, items: [it] });
    }
    const mods = [];
    const PAD = 40;
    let y = 50;
    let maxW = 0;
    for (const r of rows) {
      r.items.sort((a, b) => a.cx - b.cx);
      let x = PAD;
      let rh = 0;
      for (const it of r.items) {
        const m = this.buildMod(it.c);
        m.x = x; m.y = y;
        x += m.w + 30;
        rh = Math.max(rh, m.h);
        mods.push(m);
      }
      // 행 중앙 정렬 높이 보정
      for (const m of mods.filter((q) => q.y === y)) m.y = y + (rh - m.h);
      maxW = Math.max(maxW, x);
      y += rh + 70;
    }
    const plateH = Math.max(300, y);
    const plateW = Math.max(700, maxW + 10);
    // 전기 제어반
    const groups = elecGroups(doc);
    const emods = [];
    if (groups.length) {
      const cols = Math.max(2, Math.min(4, Math.ceil(groups.length / Math.max(1, Math.floor((plateH - 60) / 122)))));
      groups.forEach((g, i) => {
        const m = modElec(g, null);
        m.group = g;
        m.x = plateW + 40 + (i % cols) * 100;
        m.y = 60 + Math.floor(i / cols) * 122;
        emods.push(m);
      });
      this.ebox = { x: plateW + 26, y: 20, w: cols * 100 + 28, h: Math.max(plateH - 20, 60 + Math.ceil(groups.length / cols) * 122) };
    } else this.ebox = null;
    this.plate = { w: plateW, h: plateH };
    this.mods = mods;
    this.emods = emods;
    // 분기점 위치
    this.junc = doc.components.filter((c) => REG[c.type].junction && REG[c.type].dom !== 'el');
  }

  buildMod(c) {
    const sim = this.ed.sim;
    const st = sim ? sim.st.get(c.id) : null;
    const d = REG[c.type];
    let m;
    if (c.type.includes('_cyl_')) m = modCylinder(c, st, sim);
    else if (d.valve) m = modValve(c, st, sim);
    else if (c.type.endsWith('_gauge')) m = modGauge(c, st, sim);
    else m = modGeneric(c, st, sim);
    m.c = c;
    return m;
  }

  portPos(cid, pid) {
    const m = this.mods.find((q) => q.c.id === cid);
    if (m) { const p = m.ports[pid]; if (p) return [m.x + p[0], m.y + p[1], p[2] || 'down']; return [m.x + m.w / 2, m.y + m.h, 'down']; }
    const j = this.jpos && this.jpos.get(cid);
    if (j) return [j[0], j[1], 'none'];
    return null;
  }

  computeJunctions() {
    const doc = this.ed.doc;
    this.jpos = new Map();
    const nb = new Map(this.junc.map((j) => [j.id, []]));
    for (const w of doc.wires) {
      if (nb.has(w.a.c)) nb.get(w.a.c).push(w.b);
      if (nb.has(w.b.c)) nb.get(w.b.c).push(w.a);
    }
    for (const j of this.junc) this.jpos.set(j.id, [this.plate.w / 2, this.plate.h / 2]);
    for (let it = 0; it < 12; it++) {
      for (const j of this.junc) {
        let sx = 0, sy = 0, n = 0;
        for (const e of nb.get(j.id)) {
          const p = this.portPos(e.c, e.p);
          if (p) { sx += p[0]; sy += p[1] + (this.jpos.has(e.c) ? 0 : 26); n++; }
        }
        if (n) this.jpos.set(j.id, [sx / n, sy / n]);
      }
    }
  }

  render() {
    if (this.svg.closest('.pane') && getComputedStyle(this.svg.closest('.pane')).display === 'none') { this.dirty = true; return; }
    this.dirty = false;
    this.layout();
    this.computeJunctions();
    const { w, h } = this.plate;
    let s = '';
    s += R(-30, -30, w + 60 + (this.ebox ? this.ebox.w + 30 : 0), h + 90, '#20262d', 'rx="14"');
    s += R(0, 0, w, h, 'url(#tg-slot)', 'rx="6" stroke="#5c6670" stroke-width="2"');
    s += Tx(14, h + 26, this.ed.doc.mode === 'hy' ? '유압 실습 장비 (가상)' : '공압 실습 장비 (가상)', 13, '#cbd5e1', 'start', 700);
    s += Tx(w, h + 26, '모듈을 클릭하여 조작 · 휠: 확대/축소 · 드래그: 이동', 10.5, '#8b97a6', 'end', 400);
    if (this.ebox) {
      const e = this.ebox;
      s += R(e.x, e.y, e.w, e.h, 'url(#tg-perf)', 'rx="6" stroke="#59626d" stroke-width="2"') + R(e.x, e.y - 18, e.w, 22, '#11161c', 'rx="4"') + Tx(e.x + e.w / 2, e.y - 3, '전기 제어반 (DC 24V)', 10.5, '#e2e8f0');
    }
    s += '<g class="t-hoses"></g><g class="t-mods"></g><g class="t-emods"></g><g class="t-junc"></g>';
    this.root.innerHTML = s;
    this.gh = this.root.querySelector('.t-hoses');
    this.gm = this.root.querySelector('.t-mods');
    this.ge = this.root.querySelector('.t-emods');
    this.gj = this.root.querySelector('.t-junc');
    this.modEls = new Map();
    for (const m of this.mods) {
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('transform', `translate(${m.x},${m.y})`);
      g.setAttribute('class', 't-mod');
      g.dataset.id = m.c.id;
      g.innerHTML = m.s;
      this.gm.appendChild(g);
      this.modEls.set(m.c.id, { g, s: m.s, m });
    }
    this.emodEls = [];
    for (const m of this.emods) {
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('transform', `translate(${m.x},${m.y})`);
      g.setAttribute('class', 't-mod');
      g.dataset.group = m.group.key;
      g.innerHTML = m.s;
      this.ge.appendChild(g);
      this.emodEls.push({ g, s: m.s, m });
    }
    const key = `${this.plate.w}x${this.plate.h}x${this.ebox ? this.ebox.w : 0}`;
    if (key !== this.lastKey) { this.lastKey = key; this.vb = null; }
    let jh = '';
    for (const [, [x, y]] of this.jpos) jh += R(x - 8, y - 6, 16, 12, 'url(#tg-brass)', 'rx="2" stroke="#7a5a1c"');
    this.gj.innerHTML = jh;
    this.drawHoses();
    if (!this.vb) this.fit();
    else this.applyVB();
  }

  drawHoses() {
    const doc = this.ed.doc;
    let s = '';
    this.hoseEls = [];
    for (const w of doc.wires) {
      const a = this.portPos(w.a.c, w.a.p), b = this.portPos(w.b.c, w.b.p);
      if (!a || !b) continue;
      const ca = doc.components.find((c) => c.id === w.a.c);
      if (!ca || REG[ca.type].dom === 'el') continue;
      const hy = REG[ca.type].dom === 'hy';
      const k = Math.max(40, Math.min(160, Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.45));
      const dv = (dir) => (dir === 'up' ? [0, -1] : dir === 'down' ? [0, 1] : dir === 'left' ? [-1, 0] : dir === 'right' ? [1, 0] : [0, 0.6]);
      const da = dv(a[2]), db = dv(b[2]);
      const d = `M${a[0]},${a[1]} C${a[0] + da[0] * k},${a[1] + da[1] * k} ${b[0] + db[0] * k},${b[1] + db[1] * k} ${b[0]},${b[1]}`;
      s += `<path d="${d}" fill="none" stroke="${hy ? '#111' : '#2c6fd6'}" stroke-width="${hy ? 7 : 4.5}" stroke-linecap="round" opacity="${hy ? 1 : 0.75}"/>`;
      s += `<path data-w="${w.id}" d="${d}" fill="none" stroke="transparent" stroke-width="${hy ? 3 : 2}" stroke-linecap="round"/>`;
    }
    this.gh.innerHTML = s;
    this.hoseEls = [...this.gh.querySelectorAll('path[data-w]')];
  }

  update() {
    if (this.dirty) { this.render(); return; }
    const sim = this.ed.sim;
    if (!this.modEls) return;
    for (const [, o] of this.modEls) {
      const m = this.buildMod(o.m.c);
      if (m.s !== o.s) { o.g.innerHTML = m.s; o.s = m.s; }
    }
    for (const o of this.emodEls) {
      const m = modElec(o.m.group, sim);
      if (m.s !== o.s) { o.g.innerHTML = m.s; o.s = m.s; }
    }
    if (sim) {
      for (const p of this.hoseEls) {
        const w = this.ed.wire(p.dataset.w);
        const ws = w && sim.wireState(w);
        let col = 'transparent';
        if (ws && !ws.el) {
          if (ws.kind === 'pn' && ws.p > 0.25) col = `rgba(120,190,255,${Math.min(1, 0.35 + ws.p / 7)})`;
          if (ws.kind === 'hy' && ws.p > 0.8) col = ws.p / this.ed.prefP > 0.6 ? '#ff3b30' : ws.p > 8 ? '#ff9f43' : '#4aa3ff';
        }
        if (p._c !== col) { p.setAttribute('stroke', col); p._c = col; }
      }
    } else for (const p of this.hoseEls) { p.setAttribute('stroke', 'transparent'); p._c = null; }
  }

  // ---------- 뷰 ----------
  bounds() {
    const ex = this.ebox ? this.ebox.w + 30 : 0;
    return [-40, -40, this.plate.w + ex + 80, this.plate.h + 120];
  }
  fit() {
    if (!this.plate) return;
    this.vb = this.bounds();
    this.applyVB();
  }
  applyVB() { this.svg.setAttribute('viewBox', this.vb.join(' ')); }

  bind() {
    const svg = this.svg;
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!this.vb) return;
      const r = svg.getBoundingClientRect();
      const f = e.deltaY < 0 ? 0.88 : 1.14;
      const s = Math.max(this.vb[2] / r.width, this.vb[3] / r.height);
      const ox = (r.width - this.vb[2] / s) / 2, oy = (r.height - this.vb[3] / s) / 2;
      const wx = this.vb[0] + (e.clientX - r.left - ox) * s, wy = this.vb[1] + (e.clientY - r.top - oy) * s;
      this.vb = [wx - (wx - this.vb[0]) * f, wy - (wy - this.vb[1]) * f, this.vb[2] * f, this.vb[3] * f];
      this.applyVB();
    }, { passive: false });
    svg.addEventListener('pointerdown', (e) => {
      const sim = this.ed.sim;
      const mg = e.target.closest('.t-mod');
      if (sim && mg) {
        if (mg.dataset.id) {
          const o = this.modEls.get(mg.dataset.id);
          const r = mg.getBoundingClientRect();
          const lx = (e.clientX - r.left) / r.width < 0.5 ? -1000 : 1000;
          if (sim.press(mg.dataset.id, lx, 0)) { this.pressed = [mg.dataset.id]; this.ed.paintSim(); return; }
          void o;
        } else if (mg.dataset.group) {
          const g = this.emods.find((m) => m.group.key === mg.dataset.group).group;
          const target = g.comps.find((c) => REG[c.type].press);
          if (target && sim.press(target.id, 0, 0)) { this.pressed = [target.id]; this.ed.paintSim(); return; }
        }
      }
      this.drag = { x: e.clientX, y: e.clientY, vb: this.vb.slice() };
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', (e) => {
      if (!this.drag || !this.vb) return;
      const r = svg.getBoundingClientRect();
      const s = Math.max(this.vb[2] / r.width, this.vb[3] / r.height);
      this.vb = [this.drag.vb[0] - (e.clientX - this.drag.x) * s, this.drag.vb[1] - (e.clientY - this.drag.y) * s, this.vb[2], this.vb[3]];
      this.applyVB();
    });
    const up = () => {
      if (this.pressed) { for (const id of this.pressed) this.ed.sim && this.ed.sim.release(id); this.pressed = null; this.ed.paintSim(); }
      this.drag = null;
    };
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
  }
}
