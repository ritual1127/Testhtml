// 앱 컨트롤러: 메뉴/툴바/팔레트/속성창/파일/홈 화면
import { REG, PALETTE, paletteItems, newComp, parseMarks } from './components.js';
import { Editor, SYM_CSS } from './editor.js';
import { Trainer } from './trainer.js';
import { Chart } from './chart.js';
import { EXAMPLES } from './examples.js';
import { initRoomUI } from './roomui.js';
import { to3D, empty3D } from './convert3d.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const gstyle = document.createElement('style');
gstyle.textContent = SYM_CSS;
document.head.appendChild(gstyle);

/* ---------------- 아이콘 ---------------- */
const ICO = {
  new: 'M6 3h8l4 4v14H6zM14 3v4h4',
  open: 'M3 7h6l2 2h10v10H3zM3 7v12',
  save: 'M5 3h12l3 3v15H5zM8 3v6h8V3M8 21v-7h8v7',
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-4',
  redo: 'M15 14l5-5-5-5M20 9H9a5 5 0 000 10h4',
  rotate: 'M20 11a8 8 0 10-2.3 5.7M20 4v7h-7',
  flip: 'M12 3v18M8 7L3 12l5 5zM16 7l5 5-5 5z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  zoomin: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4M11 8v6M8 11h6',
  zoomout: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4M8 11h6',
  fit: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  hand: 'M8 13V5.5a1.5 1.5 0 013 0V11M11 10V4.5a1.5 1.5 0 013 0V11M14 10.5V6a1.5 1.5 0 013 0v7a7 7 0 01-7 7h-.5a6 6 0 01-4.6-2.2L4 15a1.5 1.5 0 012.3-1.9L8 15',
  play: 'M7 4l13 8-13 8z',
  pause: 'M7 4h3v16H7zM14 4h3v16h-3z',
  step: 'M5 4l10 8-10 8zM17 4h3v16h-3z',
  reset: 'M4 12a8 8 0 108-8H8M8 1v6h6',
  stop: 'M6 6h12v12H6z',
  chart: 'M4 20V4M4 20h16M7 16l4-6 3 3 5-7',
};
for (const i of $$('i[data-ico]')) {
  const fill = ['play', 'pause', 'step', 'stop'].includes(i.dataset.ico);
  i.innerHTML = `<svg viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="${fill ? 0 : 1.8}" stroke-linecap="round" stroke-linejoin="round"><path d="${ICO[i.dataset.ico]}"/></svg>`;
}

/* ---------------- 에디터 · 뷰 ---------------- */
const ed = new Editor($('#canvas'));
const trainer = new Trainer($('#trainer'), ed);
const chart = new Chart($('#chart'), ed);
window.__ed = ed;
let R = null;
function room() {
  if (!R) {
    R = initRoomUI({
      modal: (t, h) => modal(t, h),
      thumbSVG: (t, h) => thumbSVG(t, h),
      onHome: () => showHome(),
      onOpen2D: (d3) => {
        if (!d3.src) { modal('2D 회로도', '<p>이 실습은 3D 실습실에서 직접 구성한 것이라 연결된 2D 회로도가 없습니다.<br>예제를 3D로 열면 원본 2D 회로도를 함께 볼 수 있습니다.</p>'); return; }
        R.hide();
        ed.load(d3.src);
        setTab(d3.src.mode || 'pn');
        status('2D 회로 작도실 — 3D 실습의 원본 회로도');
      },
      loadAnswer: (d3) => { const full = to3D(d3.src); R.open(full); },
    });
  }
  return R;
}
function open3D(doc) {
  hideHome();
  closeModal();
  const r = room();
  r.show();
  r.open(doc);
  try { localStorage.setItem('hpt.last', '3d'); } catch (_) { /* 무시 */ }
}

let viewMode = 'circuit';
function setView(v) {
  viewMode = v;
  $('#views').className = 'v-' + v;
  $$('#toolbar [data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
  requestAnimationFrame(() => { if (v !== 'trainer') ed.fit(); trainer.render(); trainer.fit(); });
}

/* ---------------- 팔레트 ---------------- */
let palTab = 'pn';
let armed = null;
function thumbSVG(type, h = 50) {
  const d = REG[type];
  const c = newComp(type, 0, 0, 'thumb');
  const [x0, y0, x1, y1] = d.bbox(c);
  const r = d.draw(c, null, null);
  const m = 6;
  return `<svg viewBox="${x0 - m} ${y0 - m} ${x1 - x0 + 2 * m} ${y1 - y0 + 2 * m}" height="${h}" preserveAspectRatio="xMidYMid meet"><g class="sym">${r.b}</g></svg>`;
}
function renderPalette() {
  const q = $('#psearch').value.trim().toLowerCase();
  const doms = q ? ['pn', 'hy', 'el'] : [palTab];
  let html = '';
  for (const dom of doms) {
    for (const cat of PALETTE[dom].cats) {
      let items = paletteItems(dom, cat);
      if (q) items = items.filter((d) => (d.name + ' ' + (d.desc || '') + ' ' + cat).toLowerCase().includes(q));
      if (!items.length) continue;
      html += `<div class="pcat"><button>${q ? PALETTE[dom].name + ' · ' : ''}${cat}</button><div class="pitems">`;
      for (const d of items) html += `<div class="pitem" draggable="true" data-type="${d.type}" title="${esc(d.name)}\n${esc(d.desc || '')}">${thumbSVG(d.type)}<span>${esc(d.name)}</span></div>`;
      html += '</div></div>';
    }
  }
  $('#plist').innerHTML = html || '<p class="muted" style="padding:10px">검색 결과가 없습니다.</p>';
}
$('#plist').addEventListener('click', (e) => {
  const cat = e.target.closest('.pcat > button');
  if (cat) { cat.parentNode.classList.toggle('closed'); return; }
  const it = e.target.closest('.pitem');
  if (!it) return;
  $$('.pitem.armed').forEach((x) => x.classList.remove('armed'));
  if (armed === it.dataset.type) { armed = null; ed.cancelOps(); return; }
  armed = it.dataset.type;
  it.classList.add('armed');
  ed.beginPlace(armed);
  status(`배치: ${REG[armed].name} — 도면을 클릭하세요 (Shift+클릭: 연속 배치, Esc: 취소)`);
  document.body.classList.remove('pal-open');
});
$('#plist').addEventListener('dragstart', (e) => {
  const it = e.target.closest('.pitem');
  if (it) e.dataTransfer.setData('text/plain', it.dataset.type);
});
$$('.ptabs button').forEach((b) => b.addEventListener('click', () => {
  palTab = b.dataset.tab;
  $$('.ptabs button').forEach((x) => x.classList.toggle('on', x === b));
  $('#psearch').value = '';
  renderPalette();
}));
$('#psearch').addEventListener('input', renderPalette);

/* ---------------- 상태 표시 ---------------- */
function status(m) { $('#stMsg').textContent = m || ''; }
ed.addEventListener('hover', (e) => status(e.detail));
ed.addEventListener('cursor', (e) => { $('#stCursor').textContent = `x ${e.detail.x}, y ${e.detail.y}`; });
ed.addEventListener('view', () => { $('#stZoom').textContent = Math.round(ed.view.k * 100) + '%'; });

/* ---------------- 속성창 ---------------- */
function fieldHTML(c, p, live) {
  const v = c.props[p.k];
  const id = `f_${c.id}_${p.k}`;
  let inp;
  if (p.t === 'sel') inp = `<select id="${id}" data-k="${p.k}">${p.opts.map(([k, l]) => `<option value="${k}"${k === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  else if (p.t === 'bool') inp = `<input type="checkbox" id="${id}" data-k="${p.k}"${v ? ' checked' : ''}>`;
  else if (p.t === 'num') inp = `<div class="unit"><input type="number" id="${id}" data-k="${p.k}" value="${esc(v)}" ${p.min != null ? `min="${p.min}"` : ''} ${p.max != null ? `max="${p.max}"` : ''} step="${p.step || 1}"><span>${p.u || ''}</span></div>`;
  else inp = `<input type="text" id="${id}" data-k="${p.k}" value="${esc(v)}" spellcheck="false">`;
  return `<div class="field"><label for="${id}">${esc(p.l)}</label>${inp}</div>`;
}

function renderInspector() {
  const box = $('#inspector');
  if (ed.sim) { renderSimInspector(true); return; }
  const sel = [...ed.sel];
  let h = '';
  if (sel.length === 1 && sel[0].startsWith('c:')) {
    const c = ed.comp(sel[0].slice(2));
    const d = REG[c.type];
    h += `<div class="isec"><h3><span class="dom ${d.dom}">${PALETTE[d.dom].name}</span>${esc(d.name)}</h3><div class="thumb">${thumbSVG(c.type, 80)}</div><p>${esc(d.desc || '')}</p></div>`;
    if (d.props.length) {
      h += `<div class="isec"><h3>속성</h3><form id="propForm" autocomplete="off">${d.props.map((p) => fieldHTML(c, p)).join('')}</form>`;
      if (c.type.includes('_cyl_')) h += `<p class="muted" style="font-size:11.5px;margin-top:8px">센서/리밋 태그는 리밋 스위치·근접 센서·롤러 밸브의 태그와 같게 입력합니다. 예) 후진끝 <b>LS1</b>, 전진끝 <b>LS2</b>, 중간 <b>LS3@50</b></p>`;
      if (d.valve && (c.props.sol14 !== undefined)) h += `<p class="muted" style="font-size:11.5px;margin-top:8px">솔레노이드 태그는 전기 회로의 솔레노이드 코일 태그(예: Y1)와 같아야 작동합니다.</p>`;
      h += '</div>';
    }
    h += `<div class="isec"><div class="btnrow"><button class="btn" data-act="rotate">↻ 회전 (R)</button><button class="btn" data-act="flip">⇋ 반전 (M)</button><button class="btn" data-act="dup">복제</button><button class="btn danger" data-act="delete">삭제</button></div></div>`;
  } else if (sel.length === 1 && sel[0].startsWith('w:')) {
    const w = ed.wire(sel[0].slice(2));
    const a = ed.portWorld(w.a.c, w.a.p);
    const kind = a ? a.kind : 'pn';
    h += `<div class="isec"><h3><span class="dom ${kind}">${PALETTE[kind].name}</span>${kind === 'el' ? '배선' : '배관'}</h3><p>${esc(compLabel(w.a.c))} [${esc(w.a.p)}] ↔ ${esc(compLabel(w.b.c))} [${esc(w.b.p)}]</p><p class="muted">중간 선분을 끌어서 경로를 조정하고, 더블클릭하면 분기점이 생깁니다.</p><div class="btnrow"><button class="btn" data-act="clearpts">경로 자동 정리</button><button class="btn danger" data-act="delete">삭제</button></div></div>`;
  } else if (sel.length > 1) {
    h += `<div class="isec"><h3>${sel.length}개 선택됨</h3><div class="btnrow"><button class="btn" data-act="rotate">↻ 회전</button><button class="btn" data-act="dup">복제</button><button class="btn danger" data-act="delete">삭제</button></div></div>`;
  } else {
    h += circuitInfoHTML();
  }
  box.innerHTML = h;
}
function compLabel(id) { const c = ed.comp(id); return c ? `${REG[c.type].name}${c.props.tag ? ' ' + c.props.tag : ''}` : id; }

function taskHTML() {
  const t = ed.doc.task;
  if (!t) return '';
  return `<div class="isec"><div class="task"><b>📋 ${esc(t.title || ed.doc.name)}</b>${t.html || ''}</div></div>`;
}
function circuitInfoHTML() {
  const doc = ed.doc;
  const n = doc.components.filter((c) => !REG[c.type].junction).length;
  let h = taskHTML();
  h += `<div class="isec"><h3>회로 정보</h3><div class="kv"><span>부품 수</span><b>${n}</b><span>배관·배선 수</span><b>${doc.wires.length}</b></div><div class="btnrow"><button class="btn pri" data-act="simstart">▶ 시뮬레이션 시작</button><button class="btn" data-act="check">회로 검사</button></div></div>`;
  h += `<div class="isec"><h3>작도 방법</h3><ol class="help-list">
    <li>왼쪽 부품 목록에서 부품을 <b>끌어다 놓기</b></li>
    <li>부품의 <b>포트(작은 원)</b>를 클릭/드래그 → 다른 포트 클릭으로 연결 (빈 곳 클릭 = 꺾임점)</li>
    <li>배관 위에 연결하면 자동으로 <b>분기점</b> 생성</li>
    <li>부품 더블클릭/선택 → 오른쪽에서 속성(태그, 압력, 시간…) 설정</li>
    <li>전기 회로: 솔레노이드 코일 <b>Y1</b> ↔ 밸브 솔레노이드 <b>Y1</b>, 리밋스위치 <b>LS1</b> ↔ 실린더 센서 태그 <b>LS1</b></li>
    <li><b>▶ 시작</b> 후 버튼·스위치·레버를 클릭하여 조작</li></ol></div>`;
  h += `<div class="isec"><h3>시뮬레이션 색상</h3><div class="legend">
    <i style="background:#0645b8"></i><span>공압 가압 관로 (진할수록 고압)</span>
    <i style="background:linear-gradient(90deg,#3d8bff,#e0182d)"></i><span>유압 관로 (저압 → 고압)</span>
    <i style="background:#e11d48"></i><span>전기 통전 (+24V)</span>
    <i style="background:#ff5a5f"></i><span>여자된 코일 / 작동 중인 조작부</span></div></div>`;
  return h;
}

let liveBuilt = false;
function renderSimInspector(full) {
  const box = $('#inspector');
  const sim = ed.sim;
  if (!sim) return;
  if (full || !liveBuilt) {
    let h = taskHTML();
    h += `<div class="isec"><h3>실시간 상태</h3><div id="liveState"></div></div>`;
    const ctl = [];
    for (const c of ed.doc.components) {
      const d = REG[c.type];
      for (const p of d.props) if (p.live && p.t === 'num') ctl.push([c, d, p]);
    }
    if (ctl.length) {
      h += `<div class="isec"><h3>실시간 조정</h3>`;
      for (const [c, d, p] of ctl) {
        const max = p.k === 'open' ? 100 : p.k === 'load' ? Math.max(2000, Math.abs(+c.props[p.k]) * 2) : p.k === 'delay' ? Math.max(10, +c.props.delay * 3) : p.k === 'preset' ? Math.max(10, +c.props.preset * 2) : p.max;
        const min = p.k === 'load' ? -max : p.min;
        h += `<div class="live-ctl"><div class="lc-top"><span>${esc(c.props.tag || d.name)} · ${esc(p.l)}</span><b id="lv_${c.id}_${p.k}">${c.props[p.k]} ${p.u || ''}</b></div><input type="range" data-c="${c.id}" data-k="${p.k}" data-u="${p.u || ''}" min="${min}" max="${max}" step="${p.step || (max - min > 200 ? 1 : 0.5)}" value="${c.props[p.k]}"></div>`;
      }
      h += '</div>';
    }
    h += `<div class="isec"><h3>조작 방법</h3><ul class="help-list"><li>푸시버튼·누름버튼 밸브: <b>누르고 있는 동안</b> 작동</li><li>유지형 스위치·디텐트 레버·비상정지: 클릭할 때마다 전환</li><li>리밋 스위치/롤러: 클릭하면 수동 작동</li><li>솔레노이드 밸브: 클릭하면 수동 오버라이드</li><li>펌프/파워유닛: 클릭하면 ON/OFF</li><li>관로에 마우스를 올리면 압력 표시</li></ul></div>`;
    box.innerHTML = h;
    liveBuilt = true;
  }
  const ls = $('#liveState');
  if (!ls) return;
  let s = '<div class="kv">';
  s += `<span>경과 시간</span><b>${sim.t.toFixed(2)} s</b>`;
  for (const c of sim.cyls) {
    const st = sim.st.get(c.id);
    s += `<span>실린더 ${esc(c.props.tag)}</span><b>${st.x.toFixed(0)} / ${c.props.stroke} mm ${st.v > 0.05 ? '▶ 전진' : st.v < -0.05 ? '◀ 후진' : ''}</b>`;
  }
  for (const c of ed.doc.components) {
    if (c.type === 'h_powerunit' || c.type === 'h_pump') s += `<span>펌프 ${esc(c.props.tag)}</span><b>${sim.st.get(c.id).on ? 'ON' : 'OFF'} · ${sim.pAt(c, 'P').toFixed(1)} bar</b>`;
    if (c.type.endsWith('_gauge')) s += `<span>압력계</span><b>${sim.pAt(c, '1').toFixed(2)} bar</b>`;
    if (c.type.endsWith('_motor')) s += `<span>모터 ${esc(c.props.tag)}</span><b>${(sim.st.get(c.id).w * 60).toFixed(0)} rpm</b>`;
  }
  s += '</div>';
  const pills = (m, label) => {
    const keys = [...m.keys()].sort();
    if (!keys.length) return '';
    return `<div style="margin-top:8px"><span class="muted" style="font-size:11.5px">${label}</span><br>${keys.map((k) => `<span class="pill${m.get(k) ? ' on' : ''}">${esc(k)}</span>`).join('')}</div>`;
  };
  const sols = new Map(), rels = new Map();
  for (const c of ed.doc.components) {
    if (c.type === 'e_sol') sols.set(c.props.tag, !!sim.sol.get(c.props.tag));
    if (c.type === 'e_relay') rels.set(c.props.tag, !!sim.relay.get(c.props.tag));
  }
  s += pills(sols, '솔레노이드') + pills(rels, '릴레이');
  const tm = new Map([...sim.timers].map(([k, t]) => [`${k} ${t.mode === 'on' ? Math.min(t.acc, t.delay).toFixed(1) : t.hold ? t.acc.toFixed(1) : '0.0'}/${t.delay}s`, sim.timerOut(k)]));
  s += pills(tm, '타이머');
  const cn = new Map([...sim.counters].map(([k, t]) => [`${k} ${t.count}/${t.preset}`, t.count >= t.preset]));
  s += pills(cn, '카운터');
  for (const w of sim.warn) s += `<div class="warn">⚠ ${esc(w)}</div>`;
  ls.innerHTML = s;
}

$('#inspector').addEventListener('input', (e) => {
  const t = e.target;
  if (t.type === 'range' && t.dataset.c) {
    const c = ed.comp(t.dataset.c);
    c.props[t.dataset.k] = +t.value;
    $(`#lv_${t.dataset.c}_${t.dataset.k}`).textContent = `${t.value} ${t.dataset.u}`;
    ed.renderComp(c);
  }
});
$('#inspector').addEventListener('change', (e) => {
  const t = e.target;
  const form = t.closest('#propForm');
  if (form && t.dataset.k) {
    const id = [...ed.sel][0].slice(2);
    const c = ed.comp(id);
    const p = REG[c.type].props.find((q) => q.k === t.dataset.k);
    let v = p.t === 'bool' ? t.checked : p.t === 'num' ? +t.value : t.value.trim();
    if (p.t === 'num') { if (p.min != null) v = Math.max(p.min, v); if (p.max != null) v = Math.min(p.max, v); }
    ed.setProp(id, p.k, v);
  }
  if (t.type === 'range' && t.dataset.c) ed.changed();
});
$('#inspector').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const a = b.dataset.act;
  if (a === 'rotate') ed.rotateSel(90);
  if (a === 'flip') ed.flipSel();
  if (a === 'dup') ed.duplicate();
  if (a === 'delete') ed.deleteSel();
  if (a === 'clearpts') ed.clearWirePts();
  if (a === 'simstart') cmd('simstart');
  if (a === 'check') cmd('check');
});

ed.addEventListener('selection', renderInspector);
ed.addEventListener('editprops', () => { renderInspector(); const f = $('#propForm input, #propForm select'); if (f) f.focus(); });

/* ---------------- 변경 · 자동 저장 ---------------- */
let saveT = null;
ed.addEventListener('change', (e) => {
  $('#dirty').textContent = e.detail.dirty ? '● 수정됨' : '';
  $('#docName').value = ed.doc.name;
  const m = ed.doc.mode || 'pn';
  $('#modeBadge').className = 'badge ' + m;
  $('#modeBadge').textContent = m === 'hy' ? '유압' : '공압';
  clearTimeout(saveT);
  saveT = setTimeout(() => { try { localStorage.setItem('hpt.autosave', JSON.stringify(ed.doc)); } catch (_) { /* 저장 불가 */ } }, 400);
  if (!ed.sim) { renderInspector(); trainer.render(); }
});
$('#docName').addEventListener('change', (e) => { ed.doc.name = e.target.value.trim() || '새 회로'; ed.changed(); });

/* ---------------- 시뮬레이션 상태 ---------------- */
let lastInsp = 0;
ed.addEventListener('simstate', () => {
  const on = !!ed.sim;
  document.body.classList.toggle('simulating', on);
  $('#simBanner').classList.toggle('hidden', !on || !ed.running);
  $('#stMode').textContent = on ? (ed.running ? '시뮬레이션 실행 중' : '시뮬레이션 일시정지') : '편집 모드';
  $('#stMode').classList.toggle('sim', on);
  $('#btnStart span').textContent = on && !ed.running ? '계속' : '시작';
  $('#btnStart').disabled = on && ed.running;
  $('#btnPause').disabled = !on || !ed.running;
  $('#btnStop').disabled = !on;
  $('#btnReset').disabled = !on;
  liveBuilt = false;
  if (on) { renderSimInspector(true); trainer.render(); }
  else { $('#simClock').textContent = 't = 0.00 s'; renderInspector(); trainer.render(); chart.draw(); }
});
ed.addEventListener('frame', () => {
  $('#simClock').textContent = `t = ${ed.sim.t.toFixed(2)} s`;
  trainer.update();
  if (!$('#chartPanel').classList.contains('hidden')) chart.draw();
  const now = performance.now();
  if (now - lastInsp > 150) { lastInsp = now; renderSimInspector(false); }
});

/* ---------------- 명령 ---------------- */
function download(name, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
const fname = (ext) => (ed.doc.name || '회로').replace(/[\\/:*?"<>|]/g, '_') + ext;

function exportPNG() {
  const svg = ed.exportSVG();
  const img = new Image();
  const m = svg.match(/width="([\d.]+)" height="([\d.]+)"/);
  const w = +m[1], h = +m[2];
  img.onload = () => {
    const cv = document.createElement('canvas');
    cv.width = w * 2;
    cv.height = h * 2;
    const g = cv.getContext('2d');
    g.scale(2, 2);
    g.drawImage(img, 0, 0, w, h);
    cv.toBlob((b) => download(fname('.png'), b), 'image/png');
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function checkCircuit() {
  const doc = ed.doc;
  const issues = [];
  const cnt = ed.portWireCount();
  const tags = (types) => new Set(doc.components.filter((c) => types.includes(c.type)).map((c) => c.props.tag));
  const markTags = new Set(doc.components.filter((c) => c.type.includes('_cyl_')).flatMap((c) => parseMarks(c).map((m) => m.tag)));
  const solCoils = tags(['e_sol']);
  const valveSols = new Set();
  for (const c of doc.components) {
    const d = REG[c.type];
    for (const p of d.ports(c)) {
      if (d.junction) continue;
      if (!cnt.get(c.id + ':' + p.id) && (p.kind === 'hy' || p.kind === 'el') && !p.pilot)
        issues.push(['경고', `${compLabel(c.id)} — 포트 ${p.lab || p.id} 미연결${p.kind === 'hy' ? ' (유압: 막힘으로 처리)' : ''}`]);
    }
    if (d.valve) {
      for (const k of ['sol14', 'sol12']) if (c.props[k]) { valveSols.add(c.props[k]); if (!solCoils.has(c.props[k])) issues.push(['오류', `${compLabel(c.id)} 솔레노이드 ${c.props[k]} 에 해당하는 전기 솔레노이드 코일(Y)이 없습니다.`]); }
      if (c.props.roll && !markTags.has(c.props.roll)) issues.push(['오류', `롤러 밸브 ${c.props.roll} 위치가 어느 실린더 센서 태그에도 없습니다.`]);
    }
  }
  for (const t of solCoils) if (!valveSols.has(t)) issues.push(['경고', `솔레노이드 코일 ${t} 를 사용하는 밸브가 없습니다.`]);
  const check = (contactTypes, coilTypes, label) => {
    const coils = tags(coilTypes);
    for (const c of doc.components) if (contactTypes.includes(c.type) && !coils.has(c.props.tag)) issues.push(['오류', `${label} 접점 ${c.props.tag} 에 해당하는 코일이 없습니다.`]);
  };
  check(['e_relay_no', 'e_relay_nc'], ['e_relay'], '릴레이');
  check(['e_timer_no', 'e_timer_nc'], ['e_ton', 'e_toff'], '타이머');
  check(['e_counter_no', 'e_counter_nc'], ['e_counter'], '카운터');
  check(['e_ps_no', 'e_ps_nc'], ['p_pswitch', 'h_pswitch'], '압력 스위치');
  for (const c of doc.components) if (['e_ls_no', 'e_ls_nc', 'e_prox'].includes(c.type) && !markTags.has(c.props.tag)) issues.push(['오류', `${compLabel(c.id)} — 태그 ${c.props.tag} 가 실린더 센서 태그에 없습니다. (실린더 속성의 센서 태그 확인)`]);
  const has = (t) => doc.components.some((c) => t.includes(c.type));
  if (has(['h_pump']) && !has(['h_relief'])) issues.push(['오류', '유압 펌프가 있지만 릴리프 밸브가 없습니다.']);
  const fluidPn = doc.components.some((c) => REG[c.type].dom === 'pn' && !REG[c.type].junction);
  if (fluidPn && !has(['p_source'])) issues.push(['오류', '공압 공급원이 없습니다.']);
  const elLoads = doc.components.some((c) => REG[c.type].load);
  if (elLoads && (!has(['e_24v']) || !has(['e_0v']))) issues.push(['오류', '전기 부하가 있지만 +24V / 0V 전원 단자가 없습니다.']);
  const err = issues.filter((i) => i[0] === '오류').length;
  modal('회로 검사', issues.length
    ? `<p>${err ? `<b style="color:#c62828">오류 ${err}건</b>, ` : ''}경고 ${issues.length - err}건</p><table class="help"><tbody>${issues.map(([k, m]) => `<tr><td style="width:46px;color:${k === '오류' ? '#c62828' : '#b45309'}"><b>${k}</b></td><td>${esc(m)}</td></tr>`).join('')}</tbody></table>`
    : '<p>✅ 문제가 발견되지 않았습니다. 시뮬레이션을 시작해 보세요.</p>');
}

function cmd(c) {
  switch (c) {
    case 'new': case 'new-pn': case 'new-hy': {
      const m = c === 'new-hy' ? 'hy' : c === 'new-pn' ? 'pn' : ed.doc.mode || 'pn';
      ed.newDoc(m);
      setTab(m);
      break;
    }
    case 'open': $('#fileInput').click(); break;
    case 'save': download(fname('.hpt.json'), JSON.stringify(ed.doc, null, 1), 'application/json'); $('#dirty').textContent = ''; break;
    case 'svg': download(fname('.svg'), ed.exportSVG(), 'image/svg+xml'); break;
    case 'png': exportPNG(); break;
    case 'print': setView('circuit'); setTimeout(() => window.print(), 100); break;
    case 'home': showHome(); break;
    case 'undo': ed.undo(); break;
    case 'redo': ed.redo(); break;
    case 'copy': ed.copy(); break;
    case 'paste': ed.paste(); break;
    case 'dup': ed.duplicate(); break;
    case 'delete': ed.deleteSel(); break;
    case 'selall': ed.selectAll(); break;
    case 'rotate': ed.rotateSel(90); break;
    case 'rotateccw': ed.rotateSel(-90); break;
    case 'flip': ed.flipSel(); break;
    case 'clearpts': ed.clearWirePts(); break;
    case 'zoomin': ed.zoom(1.25); break;
    case 'zoomout': ed.zoom(0.8); break;
    case 'fit': ed.fit(); trainer.fit(); break;
    case 'pan': ed.panTool = !ed.panTool; $('#btnPan').classList.toggle('on', ed.panTool); break;
    case 'simstart': ed.startSim(); break;
    case 'simpause': ed.pauseSim(); break;
    case 'simstep': ed.stepSim(0.1); ed.simState(); break;
    case 'simreset': ed.resetSim(); chart.draw(); break;
    case 'simstop': ed.stopSim(); break;
    case 'check': checkCircuit(); break;
    case 'chart': toggleChart(); break;
    case 'v-circuit': setView('circuit'); break;
    case 'v-split': setView('split'); break;
    case 'v-trainer': setView('trainer'); break;
    case 'examples': showExamples(); break;
    case 'to3d': ed.stopSim(); open3D(to3D(ed.doc)); break;
    case 'help': showHelp(); break;
    case 'keys': showKeys(); break;
    case 'about': showAbout(); break;
  }
}
function toggleChart(force) {
  const p = $('#chartPanel');
  const show = force ?? p.classList.contains('hidden');
  p.classList.toggle('hidden', !show);
  $('#btnChart').classList.toggle('on', show);
  requestAnimationFrame(() => { chart.resize(); chart.draw(); trainer.fit(); });
}
$('#chartClose').addEventListener('click', () => toggleChart(false));

$$('#toolbar [data-cmd]').forEach((b) => b.addEventListener('click', () => cmd(b.dataset.cmd)));
$$('#toolbar [data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
$('#speed').addEventListener('change', (e) => { ed.speed = +e.target.value; });

$('#fileInput').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const doc = JSON.parse(await f.text());
    if (!doc.components || !doc.wires) throw new Error('형식 오류');
    ed.load(doc);
    setTab(doc.mode || 'pn');
    hideHome();
  } catch (err) {
    modal('열기 실패', `<p>회로 파일을 읽을 수 없습니다: ${esc(err.message)}</p>`);
  }
  e.target.value = '';
});

/* ---------------- 메뉴 ---------------- */
const MENUS = [
  ['파일', [['새 공압 회로', 'new-pn', 'Ctrl+N'], ['새 유압 회로', 'new-hy'], ['열기…', 'open', 'Ctrl+O'], ['저장 (파일로 내려받기)', 'save', 'Ctrl+S'], '-', ['SVG로 내보내기', 'svg'], ['PNG 이미지로 내보내기', 'png'], ['인쇄', 'print', 'Ctrl+P'], '-', ['메인 화면', 'home']]],
  ['편집', [['실행 취소', 'undo', 'Ctrl+Z'], ['다시 실행', 'redo', 'Ctrl+Y'], '-', ['복사', 'copy', 'Ctrl+C'], ['붙여넣기', 'paste', 'Ctrl+V'], ['복제', 'dup', 'Ctrl+D'], ['삭제', 'delete', 'Del'], ['전체 선택', 'selall', 'Ctrl+A'], '-', ['시계 방향 회전', 'rotate', 'R'], ['반시계 방향 회전', 'rotateccw', 'Shift+R'], ['좌우 반전', 'flip', 'M'], ['배관 경로 자동 정리', 'clearpts']]],
  ['보기', [['3D 실습실로 보내기 (자동 배치·배선)', 'to3d'], '-', ['확대', 'zoomin', '휠↑'], ['축소', 'zoomout', '휠↓'], ['화면 맞춤', 'fit', 'F'], '-', ['변위-시간 선도', 'chart', 'G']]],
  ['시뮬레이션', [['시작 / 계속', 'simstart', 'F9'], ['일시 정지', 'simpause', 'F8'], ['단계 실행 (0.1초)', 'simstep', 'F10'], ['초기화 후 재시작', 'simreset'], ['정지 (편집 모드)', 'simstop', 'Esc'], '-', ['회로 검사', 'check']]],
  ['예제·과제', null],
  ['도움말', [['사용 방법', 'help', 'F1'], ['단축키', 'keys'], ['프로그램 정보', 'about']]],
];
function buildMenus() {
  const bar = $('#menubar');
  bar.innerHTML = '';
  for (const [name, items] of MENUS) {
    const m = document.createElement('div');
    m.className = 'menu';
    let html = `<button>${name}</button><div class="drop">`;
    if (items) {
      for (const it of items) html += it === '-' ? '<hr>' : `<button data-cmd="${it[1]}">${it[0]}${it[2] ? `<kbd>${it[2]}</kbd>` : ''}</button>`;
    } else {
      html += `<button data-cmd="examples"><b>예제·과제 전체 보기…</b></button><hr>`;
      let g = '';
      for (const ex of EXAMPLES) {
        if (ex.group !== g) { g = ex.group; html += `<div class="sub">${esc(g)}</div>`; }
        html += `<button data-ex="${ex.id}">${esc(ex.title)}</button>`;
      }
    }
    html += '</div>';
    m.innerHTML = html;
    bar.appendChild(m);
  }
  bar.addEventListener('click', (e) => {
    const top = e.target.closest('.menu > button');
    if (top) {
      const m = top.parentNode;
      const open = m.classList.contains('open');
      $$('.menu.open').forEach((x) => x.classList.remove('open'));
      if (!open) m.classList.add('open');
      return;
    }
    const b = e.target.closest('.drop button');
    if (b) {
      $$('.menu.open').forEach((x) => x.classList.remove('open'));
      if (b.dataset.cmd) cmd(b.dataset.cmd);
      if (b.dataset.ex) loadExample(b.dataset.ex);
    }
  });
  bar.addEventListener('mouseover', (e) => {
    const m = e.target.closest('.menu');
    if (m && $('.menu.open') && !m.classList.contains('open')) { $$('.menu.open').forEach((x) => x.classList.remove('open')); m.classList.add('open'); }
  });
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#menubar')) $$('.menu.open').forEach((x) => x.classList.remove('open')); if (!e.target.closest('#ctxmenu')) $('#ctxmenu').classList.add('hidden'); });
}

/* ---------------- 컨텍스트 메뉴 ---------------- */
ed.addEventListener('ctx', (e) => {
  const { x, y, hit } = e.detail;
  const m = $('#ctxmenu');
  let items;
  if (hit.kind === 'comp') items = [['회전', 'rotate', 'R'], ['좌우 반전', 'flip', 'M'], ['복제', 'dup', 'Ctrl+D'], ['복사', 'copy', 'Ctrl+C'], ['삭제', 'delete', 'Del']];
  else if (hit.kind === 'wire') items = [['경로 자동 정리', 'clearpts'], ['삭제', 'delete', 'Del']];
  else items = [['붙여넣기', 'paste', 'Ctrl+V'], ['전체 선택', 'selall', 'Ctrl+A'], ['화면 맞춤', 'fit'], ['회로 검사', 'check']];
  m.innerHTML = items.map(([l, c, k]) => `<button data-cmd="${c}">${l}${k ? `<kbd>${k}</kbd>` : ''}</button>`).join('');
  m.classList.remove('hidden');
  m.style.left = Math.min(x, innerWidth - 200) + 'px';
  m.style.top = Math.min(y, innerHeight - 220) + 'px';
});
$('#ctxmenu').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { $('#ctxmenu').classList.add('hidden'); cmd(b.dataset.cmd); } });

/* ---------------- 키보드 ---------------- */
document.addEventListener('keydown', (e) => {
  const typing = e.target.matches('input, select, textarea');
  if (document.body.classList.contains('mode3d')) {
    if (typing) return;
    if (e.key === 'Escape' && !$('#modal').classList.contains('hidden')) { closeModal(); return; }
    if (e.key === 'F9') { e.preventDefault(); R.room.startSim(); return; }
    if (R && R.key(e)) e.preventDefault();
    return;
  }
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (e.key === 'F9') { e.preventDefault(); cmd('simstart'); return; }
  if (e.key === 'F8') { e.preventDefault(); cmd('simpause'); return; }
  if (e.key === 'F10') { e.preventDefault(); cmd('simstep'); return; }
  if (e.key === 'F1') { e.preventDefault(); cmd('help'); return; }
  if (mod && k === 's') { e.preventDefault(); cmd('save'); return; }
  if (mod && k === 'o') { e.preventDefault(); cmd('open'); return; }
  if (mod && k === 'p') { e.preventDefault(); cmd('print'); return; }
  if (mod && k === 'n') { e.preventDefault(); cmd('new'); return; }
  if (typing) return;
  if (e.key === 'Escape') { $$('.pitem.armed').forEach((x) => x.classList.remove('armed')); armed = null; if (!$('#modal').classList.contains('hidden')) { closeModal(); return; } }
  if (e.key === ' ') { ed.spaceDown = true; e.preventDefault(); return; }
  if (!mod && !ed.sim) {
    if (k === 'f') { cmd('fit'); return; }
    if (k === '3') { cmd('to3d'); return; }
  }
  if (!mod && k === 'g') { toggleChart(); return; }
  if (ed.key(e)) e.preventDefault();
});
document.addEventListener('keyup', (e) => { if (e.key === ' ') ed.spaceDown = false; });

/* ---------------- 모달 ---------------- */
function modal(title, html) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = html;
  $('#modal').classList.remove('hidden');
}
function closeModal() { $('#modal').classList.add('hidden'); }
$('#modalClose').addEventListener('click', closeModal);
$('#modal').addEventListener('click', (e) => {
  if (e.target.id === 'modal') closeModal();
  const ex = e.target.closest('[data-ex]');
  if (ex) { closeModal(); loadExample(ex.dataset.ex, ex.dataset.how); }
});

function showExamples() {
  let h = '<p class="muted">공유압기능사 · 설비보전기사 실기 유형을 참고하여 구성한 회로입니다. <b>3D 실습실(완성)</b>은 부품·호스·전선이 모두 연결된 상태로, <b>3D 배선 과제</b>는 부품만 설치된 상태로 열려 직접 배선한 뒤 정답과 비교할 수 있습니다.</p>';
  let g = '';
  for (const ex of EXAMPLES) {
    if (ex.group !== g) { if (g) h += '</div></div>'; g = ex.group; h += `<div class="exgroup"><h4>${esc(g)}</h4><div class="exgrid">`; }
    h += `<div class="excard"><b>${esc(ex.title)}</b><span>${esc(ex.summary)}</span><div class="tags">${(ex.tags || []).map((t) => `<em>${esc(t)}</em>`).join('')}</div><div class="exbtns"><button class="b3" data-ex="${ex.id}" data-how="3d">3D 실습실 (완성)</button><button data-ex="${ex.id}" data-how="ex3d">3D 배선 과제</button><button data-ex="${ex.id}" data-how="2d">2D 회로도</button></div></div>`;
  }
  h += '</div></div>';
  modal('예제 · 과제', h);
}
function loadExample(id, how = '2d') {
  const ex = EXAMPLES.find((e) => e.id === id);
  if (!ex) return;
  const doc = ex.build();
  if (how === '3d' || how === 'ex3d') {
    const d3 = to3D(doc, { exercise: how === 'ex3d' });
    if (how === 'ex3d') { d3.name = doc.name + ' (배선 과제)'; }
    open3D(d3);
    return;
  }
  if (R) R.hide();
  ed.load(doc);
  setTab(doc.mode);
  hideHome();
  status(`예제 불러옴: ${ex.title}`);
}

function showHelp() {
  modal('사용 방법', `<div class="help">
  <h4>1. 회로 작도실 (2D 회로도)</h4>
  <ul><li>왼쪽 <b>공압 / 유압 / 전기</b> 탭에서 부품을 끌어다 놓습니다. (클릭 후 도면 클릭으로도 배치, Shift+클릭으로 연속 배치)</li>
  <li>부품의 포트(작은 원)를 클릭하거나 드래그하여 다른 포트까지 연결합니다. 빈 곳을 클릭하면 꺾임점이 추가되고, 기존 배관/배선 위를 클릭하면 분기점이 자동 생성됩니다.</li>
  <li>배관 중간 선분은 끌어서 위치를 조정할 수 있으며, 배관을 더블클릭하면 분기점이 생깁니다.</li>
  <li>부품을 선택하면 오른쪽 속성창에서 태그(이름), 압력, 개도, 시간, 행정 등을 설정합니다.</li></ul>
  <h4>2. 태그 연결 규칙 (전기 ↔ 공유압)</h4>
  <table><tbody>
  <tr><td>솔레노이드 코일 <b>Y1</b></td><td>밸브 속성의 솔레노이드 태그 <b>Y1</b> 이 작동</td></tr>
  <tr><td>리밋 스위치 / 근접 센서 <b>LS1</b>, 롤러 밸브 <b>1S1</b></td><td>실린더 속성의 후진끝·전진끝·중간 센서 태그와 일치하면 해당 위치에서 작동</td></tr>
  <tr><td>릴레이 코일 <b>R1</b></td><td>릴레이 a접점/b접점 <b>R1</b></td></tr>
  <tr><td>타이머 코일 <b>T1</b> (ON/OFF 딜레이)</td><td>타이머 a/b접점 <b>T1</b></td></tr>
  <tr><td>카운터 코일 <b>C1</b> (+ 리셋 코일 C1)</td><td>카운터 a/b접점 <b>C1</b></td></tr>
  <tr><td>압력 스위치(공압/유압) <b>PS1</b></td><td>압력 스위치 접점 <b>PS1</b></td></tr>
  <tr><td>푸시버튼 <b>PB1</b></td><td>같은 태그의 a접점과 b접점은 기계적으로 연동</td></tr>
  </tbody></table>
  <h4>3. 시뮬레이션</h4>
  <ul><li><b>▶ 시작</b>을 누르면 압력이 있는 관로는 색으로 표시되고(공압: 파랑, 유압: 파랑→빨강), 통전된 전선은 빨간색이 됩니다.</li>
  <li>푸시버튼·누름 밸브는 누르고 있는 동안, 유지형 스위치·디텐트 레버는 클릭할 때마다 동작합니다. 펌프/파워유닛을 클릭하면 ON/OFF 됩니다.</li>
  <li>오른쪽 <b>실시간 조정</b>에서 교축 밸브 개도, 릴리프 압력, 타이머 시간, 부하 등을 바꾸며 결과를 비교할 수 있습니다.</li>
  <li><b>3D 실습실 ▶</b> 버튼을 누르면 회로가 3D 실습 장비에 자동으로 설치·배관·배선되어 동일하게 동작합니다.</li>
  <li><b>선도</b> 버튼으로 실린더의 변위-시간 선도와 솔레노이드/릴레이 동작을 확인합니다.</li></ul>
  <h4>4. 저장</h4>
  <ul><li>작업 내용은 브라우저에 자동 저장되며(메인 화면 → 이어서 하기), 파일 → 저장으로 .json 파일을 내려받아 보관/제출할 수 있습니다.</li></ul></div>`);
}
function showKeys() {
  modal('단축키', `<div class="help"><table><tbody>
  ${[['Ctrl+Z / Ctrl+Y', '실행 취소 / 다시 실행'], ['Ctrl+C / Ctrl+V / Ctrl+D', '복사 / 붙여넣기 / 복제'], ['Delete', '삭제'], ['R / Shift+R', '회전'], ['M', '좌우 반전'], ['방향키', '선택 부품 이동'], ['휠 / Space+드래그 / 우클릭 드래그', '확대·축소 / 화면 이동'], ['F', '화면 맞춤'], ['3', '3D 실습실로 보내기'], ['G', '변위-시간 선도'], ['F9 / F8 / F10', '시작 / 일시정지 / 단계 실행'], ['Esc', '취소 · 시뮬레이션 정지'], ['Ctrl+S / Ctrl+O', '저장 / 열기']].map(([k, v]) => `<tr><td><kbd>${k}</kbd></td><td>${v}</td></tr>`).join('')}
  </tbody></table></div>`);
}
function showAbout() {
  modal('프로그램 정보', `<p><b>공유압 실습실</b> — 웹 기반 공압·유압·전기 시퀀스 회로 작도 및 시뮬레이션 교육 프로그램입니다.</p>
  <ul class="help-list"><li>회로 작도실: ISO 1219 / KS B 0054 기호(교육용 단순화) ${Object.keys(REG).length}종 부품</li>
  <li>시뮬레이션: 관로 압력·유량 해석, 실린더/모터 운동, 릴리프·감압·시퀀스·체크·유량제어 밸브, 릴레이·타이머·카운터 전기 시퀀스</li>
  <li>가상 실습장비 뷰, 변위-시간 선도, 예제 과제 ${EXAMPLES.length}종</li></ul>
  <p class="muted">교육용 독자 구현이며 특정 상용 소프트웨어의 코드·자산을 사용하지 않았습니다. 수치는 교육용 근사 모델입니다.</p>`);
}

/* ---------------- 홈 화면 ---------------- */
function setTab(m) {
  palTab = m === 'hy' ? 'hy' : 'pn';
  $$('.ptabs button').forEach((x) => x.classList.toggle('on', x.dataset.tab === palTab));
  renderPalette();
}
function showHome() {
  let saved = null;
  try {
    const k = localStorage.getItem('hpt.last') === '3d' && localStorage.getItem('hpt.autosave3d') ? 'hpt.autosave3d' : 'hpt.autosave';
    saved = JSON.parse(localStorage.getItem(k) || 'null');
  } catch (_) { saved = null; }
  const has = saved && saved.components && saved.components.length;
  $('#homeResume').disabled = !has;
  $('#resumeInfo').textContent = has ? `"${saved.name}" (${saved.components.length}개 부품)` : '저장된 작업이 없습니다';
  $('#home').classList.remove('hidden');
}
function hideHome() { $('#home').classList.add('hidden'); }
$('#home').addEventListener('click', (e) => {
  const b = e.target.closest('[data-home]');
  if (!b) { if (e.target.id === 'home' && ed.doc.components.length) hideHome(); return; }
  const a = b.dataset.home;
  if (a === 'pn3d' || a === 'hy3d') { open3D(empty3D(a === 'hy3d' ? 'hy' : 'pn')); return; }
  if (a === 'pn' || a === 'hy') { if (R) R.hide(); ed.newDoc(a); ed.doc.name = a === 'hy' ? '새 유압 회로' : '새 공압 회로'; ed.changed(false); setTab(a); hideHome(); try { localStorage.setItem('hpt.last', '2d'); } catch (_) { /* 무시 */ } }
  if (a === 'examples') { hideHome(); showExamples(); }
  if (a === 'resume') {
    try {
      if (localStorage.getItem('hpt.last') === '3d' && localStorage.getItem('hpt.autosave3d')) { open3D(JSON.parse(localStorage.getItem('hpt.autosave3d'))); return; }
      const d = JSON.parse(localStorage.getItem('hpt.autosave')); if (R) R.hide(); ed.load(d); setTab(d.mode || 'pn'); hideHome();
    } catch (_) { /* 무시 */ }
  }
  if (a === 'help') showHelp();
});
$('#btnHome').addEventListener('click', showHome);

/* ---------------- 시작 ---------------- */
buildMenus();
renderPalette();
renderInspector();
ed.simState();
const qs = new URLSearchParams(location.search);
if (qs.get('ex')) { loadExample(qs.get('ex'), qs.get('mode') || '2d'); if (qs.get('view')) setView(qs.get('view')); }
else if (qs.get('room')) open3D(empty3D(qs.get('room') === 'hy' ? 'hy' : 'pn'));
else showHome();
window.addEventListener('resize', () => { chart.resize(); chart.draw(); trainer.fit(); });
