// 회로 작도 캔버스 (SVG)
import { REG, newComp, compPorts, compBBox, rotPt } from './components.js';
import { route, pathD, nearestOnPolyline } from './route.js';
import { Sim } from './sim.js';

export const GRID = 10;
const snap = (v) => Math.round(v / GRID) * GRID;
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};

export const SYM_CSS = `
.sym{stroke:#1d232b;fill:none;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}
.sym .fw{fill:#fff}.sym .fk{fill:#1d232b}.sym .fh{fill:#e9eef5}
.sym .dash{stroke-dasharray:4 3}.sym .thin{stroke-width:.8}.sym .mark{stroke:#0b6bcb;stroke-width:1.8}
.sym .on{fill:#ff5a5f;stroke:#a3001b}.sym .onG{fill:#34d17a}.sym .onR{fill:#e11d48}
.sym .live{stroke:#e11d48;stroke-width:2.2}.sym .blade{stroke-width:1.8}.sym line.blade.on{stroke:#e11d48}
.sym .estop{fill:#ef4444}.sym .rot{stroke:#e11d48;stroke-width:2.2}
.sym .lamp-yellow{fill:#ffd600}.sym .lamp-red{fill:#ff3b30}.sym .lamp-green{fill:#22c55e}.sym .lamp-white{fill:#eef6ff}
.sym .stxt{fill:#1d232b;stroke:none;font:700 9px Arial,sans-serif}
.sym .hit{fill:transparent;stroke:none}
.lbl{font:700 11px Arial,'Noto Sans KR',sans-serif;fill:#0f172a}
.tag{font:700 10px Arial,'Noto Sans KR',sans-serif;fill:#3a4658}
.val{font:700 10px Arial,sans-serif;fill:#0b63c4}
.plab{font:500 8px Arial,sans-serif;fill:#7b8796}
.wire{stroke:#1d232b;stroke-width:1.5;fill:none;stroke-linejoin:round}
.wire.k-el{stroke-width:1.2}
.jdot{fill:#1d232b;stroke:none}
`;

function emptyDoc(mode = 'pn') {
  return { version: 1, name: '새 회로', mode, components: [], wires: [], task: null };
}

function mix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.substr(i, 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.substr(i, 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

export class Editor extends EventTarget {
  constructor(svg) {
    super();
    this.svg = svg;
    this.doc = emptyDoc();
    this.sel = new Set();
    this.view = { x: 60, y: 60, k: 1 };
    this.undoStack = [];
    this.redoStack = [];
    this.sim = null;
    this.running = false;
    this.speed = 1;
    this.mode = 'idle';
    this.showGrid = true;
    this.compEls = new Map();
    this.clip = null;
    this.setup();
    this.bind();
  }

  // ======================== DOM ========================
  setup() {
    const svg = this.svg;
    svg.innerHTML = '';
    const defs = el('defs', {}, svg);
    const st = el('style', {}, defs);
    st.textContent = SYM_CSS;
    const pat = el('pattern', { id: 'g10', width: 10, height: 10, patternUnits: 'userSpaceOnUse' }, defs);
    el('path', { d: 'M10 0 L0 0 0 10', fill: 'none', stroke: '#e8edf3', 'stroke-width': 0.6 }, pat);
    const pat2 = el('pattern', { id: 'g50', width: 50, height: 50, patternUnits: 'userSpaceOnUse' }, defs);
    el('rect', { width: 50, height: 50, fill: 'url(#g10)' }, pat2);
    el('path', { d: 'M50 0 L0 0 0 50', fill: 'none', stroke: '#d3dbe6', 'stroke-width': 0.8 }, pat2);
    this.vp = el('g', { id: 'vp' }, svg);
    this.gridRect = el('rect', { x: -20000, y: -20000, width: 40000, height: 40000, fill: 'url(#g50)', class: 'gridbg' }, this.vp);
    this.lw = el('g', { class: 'lw' }, this.vp);
    this.lc = el('g', { class: 'lc' }, this.vp);
    this.lj = el('g', { class: 'lj' }, this.vp);
    this.lp = el('g', { class: 'lp' }, this.vp);
    this.lo = el('g', { class: 'lo' }, this.vp);
    this.applyView();
  }

  applyView() {
    const { x, y, k } = this.view;
    this.vp.setAttribute('transform', `translate(${x},${y}) scale(${k})`);
    this.dispatchEvent(new CustomEvent('view'));
  }

  toWorld(ev) {
    const r = this.svg.getBoundingClientRect();
    return [(ev.clientX - r.left - this.view.x) / this.view.k, (ev.clientY - r.top - this.view.y) / this.view.k];
  }

  // ======================== 문서 ========================
  newId(prefix = 'c') {
    const used = new Set([...this.doc.components.map((c) => c.id), ...this.doc.wires.map((w) => w.id)]);
    let i = used.size + 1;
    while (used.has(prefix + i)) i++;
    return prefix + i;
  }
  comp(id) { return this.doc.components.find((c) => c.id === id); }
  wire(id) { return this.doc.wires.find((w) => w.id === id); }

  load(doc, keepView) {
    this.stopSim();
    this.doc = JSON.parse(JSON.stringify(doc));
    this.doc.components = this.doc.components.filter((c) => REG[c.type]);
    for (const c of this.doc.components) {
      const d = REG[c.type];
      for (const p of d.props) if (!(p.k in c.props)) c.props[p.k] = p.d;
      c.rot = c.rot || 0;
    }
    this.sel.clear();
    this.undoStack = [];
    this.redoStack = [];
    this.renderAll();
    if (!keepView) requestAnimationFrame(() => this.fit());
    this.changed(false);
  }
  newDoc(mode) { this.load(emptyDoc(mode)); this.view = { x: 60, y: 60, k: 1 }; this.applyView(); }

  snap() {
    this.undoStack.push(JSON.stringify({ c: this.doc.components, w: this.doc.wires }));
    if (this.undoStack.length > 150) this.undoStack.shift();
    this.redoStack = [];
  }
  restore(s) {
    const o = JSON.parse(s);
    this.doc.components = o.c;
    this.doc.wires = o.w;
    this.sel = new Set([...this.sel].filter((k) => (k[0] === 'c' ? this.comp(k.slice(2)) : this.wire(k.slice(2)))));
    this.renderAll();
    this.changed();
  }
  undo() {
    if (this.sim || !this.undoStack.length) return;
    this.redoStack.push(JSON.stringify({ c: this.doc.components, w: this.doc.wires }));
    this.restore(this.undoStack.pop());
  }
  redo() {
    if (this.sim || !this.redoStack.length) return;
    this.undoStack.push(JSON.stringify({ c: this.doc.components, w: this.doc.wires }));
    this.restore(this.redoStack.pop());
  }
  changed(dirty = true) {
    this.dispatchEvent(new CustomEvent('change', { detail: { dirty } }));
  }

  // ---------- 태그 자동 부여 ----------
  autoTag(c) {
    const d = REG[c.type];
    const auto = d.load || d.valve || c.type.includes('_cyl_') || c.type.endsWith('_motor') || ['e_pb_no', 'e_pb_nc', 'e_sw_no', 'e_sw_nc', 'p_pswitch', 'h_pswitch'].includes(c.type);
    if (auto && 'tag' in c.props && c.props.tag && !['e_counter_rst'].includes(c.type)) {
      const used = new Set(this.doc.components.filter((o) => o !== c && o.type.split('_')[0] === c.type.split('_')[0]).map((o) => o.props.tag));
      if (used.has(c.props.tag)) {
        const m = String(c.props.tag).match(/^(\D*)(\d+)(.*)$/);
        if (m) {
          let i = +m[2];
          let t;
          do { i++; t = m[1] + i + m[3]; } while (used.has(t));
          c.props.tag = t;
        }
      }
    }
    // 솔레노이드 밸브: 사용하지 않은 Y 번호 부여
    if (d.valve) {
      const usedY = new Set();
      for (const o of this.doc.components) if (o !== c && REG[o.type].valve) { if (o.props.sol14) usedY.add(o.props.sol14); if (o.props.sol12) usedY.add(o.props.sol12); }
      let yi = 1;
      for (const k of ['sol14', 'sol12']) {
        if (k in c.props && usedY.has(c.props[k])) {
          while (usedY.has('Y' + yi)) yi++;
          c.props[k] = 'Y' + yi;
          usedY.add('Y' + yi);
        }
      }
    }
  }

  addComp(type, wx, wy, opts = {}) {
    if (this.sim) return null;
    const d = REG[type];
    const c = newComp(type, 0, 0, this.newId('c'));
    const [x0, y0, x1, y1] = d.bbox(c);
    c.x = snap(wx - (x0 + x1) / 2);
    c.y = snap(wy - (y0 + y1) / 2);
    if (opts.exact) { c.x = snap(wx); c.y = snap(wy); }
    this.snap();
    this.autoTag(c);
    this.doc.components.push(c);
    this.sel = new Set(['c:' + c.id]);
    this.renderAll();
    this.changed();
    this.emitSel();
    return c;
  }

  deleteSel() {
    if (this.sim || !this.sel.size) return;
    this.snap();
    const cids = new Set([...this.sel].filter((k) => k.startsWith('c:')).map((k) => k.slice(2)));
    const wids = new Set([...this.sel].filter((k) => k.startsWith('w:')).map((k) => k.slice(2)));
    this.doc.components = this.doc.components.filter((c) => !cids.has(c.id));
    this.doc.wires = this.doc.wires.filter((w) => !wids.has(w.id) && !cids.has(w.a.c) && !cids.has(w.b.c));
    this.cleanJunctions();
    this.sel.clear();
    this.renderAll();
    this.changed();
    this.emitSel();
  }

  // 연결이 1개 이하인 분기점 제거, 2개면 배선 병합
  cleanJunctions() {
    let again = true;
    while (again) {
      again = false;
      for (const c of [...this.doc.components]) {
        if (!REG[c.type].junction) continue;
        const ws = this.doc.wires.filter((w) => w.a.c === c.id || w.b.c === c.id);
        if (ws.length === 0) { this.doc.components = this.doc.components.filter((o) => o !== c); again = true; }
        else if (ws.length === 2) {
          const [w1, w2] = ws;
          const o1 = w1.a.c === c.id ? w1.b : w1.a;
          const o2 = w2.a.c === c.id ? w2.b : w2.a;
          if (o1.c === c.id || o2.c === c.id) continue;
          const r1 = this.wireRoute(w1), r2 = this.wireRoute(w2);
          const p1 = w1.a.c === c.id ? r1.slice().reverse() : r1;
          const p2 = w2.a.c === c.id ? r2 : r2.slice().reverse();
          const pts = [...p1.slice(1, -1), [c.x, c.y], ...p2.slice(1, -1)];
          this.doc.wires = this.doc.wires.filter((w) => w !== w1 && w !== w2);
          this.doc.wires.push({ id: w1.id, a: o1, b: o2, pts });
          this.doc.components = this.doc.components.filter((o) => o !== c);
          again = true;
        }
      }
    }
  }

  rotateSel(dir = 90) {
    if (this.sim) return;
    const cs = this.selComps();
    if (!cs.length) return;
    this.snap();
    for (const c of cs) {
      if (REG[c.type].junction) continue;
      c.rot = (((c.rot || 0) + dir) % 360 + 360) % 360;
    }
    this.clearWirePtsFor(cs);
    this.renderAll();
    this.changed();
  }
  flipSel() {
    if (this.sim) return;
    const cs = this.selComps();
    if (!cs.length) return;
    this.snap();
    for (const c of cs) c.flip = !c.flip;
    this.clearWirePtsFor(cs);
    this.renderAll();
    this.changed();
  }
  clearWirePtsFor(cs) {
    const ids = new Set(cs.map((c) => c.id));
    for (const w of this.doc.wires) if (ids.has(w.a.c) || ids.has(w.b.c)) w.pts = [];
  }
  selComps() { return [...this.sel].filter((k) => k.startsWith('c:')).map((k) => this.comp(k.slice(2))).filter(Boolean); }
  selectAll() {
    if (this.sim) return;
    this.sel = new Set([...this.doc.components.map((c) => 'c:' + c.id), ...this.doc.wires.map((w) => 'w:' + w.id)]);
    this.renderSel();
    this.emitSel();
  }

  copy() {
    const cs = this.selComps();
    if (!cs.length) return;
    const ids = new Set(cs.map((c) => c.id));
    this.clip = JSON.stringify({ c: cs, w: this.doc.wires.filter((w) => ids.has(w.a.c) && ids.has(w.b.c)) });
  }
  paste(off = 40) {
    if (!this.clip || this.sim) return;
    const o = JSON.parse(this.clip);
    this.snap();
    const map = {};
    const sel = new Set();
    for (const c of o.c) {
      const nid = this.newId('c');
      map[c.id] = nid;
      c.id = nid;
      c.x += off;
      c.y += off;
      this.doc.components.push(c);
      sel.add('c:' + nid);
    }
    for (const w of o.w) {
      w.id = this.newId('w');
      w.a.c = map[w.a.c];
      w.b.c = map[w.b.c];
      w.pts = (w.pts || []).map(([x, y]) => [x + off, y + off]);
      this.doc.wires.push(w);
      sel.add('w:' + w.id);
    }
    this.sel = sel;
    this.renderAll();
    this.changed();
    this.emitSel();
  }
  duplicate() { this.copy(); this.paste(); }

  setProp(id, k, v, live) {
    const c = this.comp(id);
    if (!c) return;
    if (!live) this.snap();
    c.props[k] = v;
    this.renderComp(c);
    this.renderWires();
    this.changed();
  }

  // ======================== 렌더링 ========================
  portWireCount() {
    const m = new Map();
    for (const w of this.doc.wires) for (const e of [w.a, w.b]) { const k = e.c + ':' + e.p; m.set(k, (m.get(k) || 0) + 1); }
    return m;
  }
  portWorld(cid, pid) {
    const c = this.comp(cid);
    if (!c) return null;
    return compPorts(c).find((p) => p.id === pid) || null;
  }
  wireRoute(w) {
    const a = this.portWorld(w.a.c, w.a.p), b = this.portWorld(w.b.c, w.b.p);
    if (!a || !b) return [];
    return route([a.wx, a.wy], a.wdir, w.pts, [b.wx, b.wy], b.wdir);
  }

  renderAll() {
    this.cnt = this.portWireCount();
    const alive = new Set(this.doc.components.map((c) => c.id));
    for (const [id, o] of this.compEls) if (!alive.has(id)) { o.g.remove(); this.compEls.delete(id); }
    for (const c of this.doc.components) this.renderComp(c, true);
    // 순서 유지
    for (const c of this.doc.components) this.lc.appendChild(this.compEls.get(c.id).g);
    this.renderWires();
    this.renderPorts();
    this.renderSel();
  }

  renderComp(c, force) {
    const d = REG[c.type];
    let o = this.compEls.get(c.id);
    if (!o) {
      const g = el('g', { class: 'comp', 'data-id': c.id }, this.lc);
      const inner = el('g', { class: 'sym' }, g);
      const lg = el('g', { class: 'lbls' }, g);
      o = { g, inner, lg, b: null, l: null, tr: null };
      this.compEls.set(c.id, o);
    }
    if (!this.cnt) this.cnt = this.portWireCount();
    c._open = new Set(d.ports(c).filter((p) => !this.cnt.get(c.id + ':' + p.id)).map((p) => p.id));
    const st = this.sim ? this.sim.st.get(c.id) : null;
    const r = d.draw(c, st, this.sim);
    const tr = `translate(${c.x},${c.y})`;
    if (o.tr !== tr) { o.g.setAttribute('transform', tr); o.tr = tr; }
    const itr = `rotate(${c.rot || 0})${c.flip ? ' scale(-1,1)' : ''}`;
    const [x0, y0, x1, y1] = d.bbox(c);
    const body = r.b + `<rect class="hit" x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}"/>`;
    if (force || o.b !== body || o.itr !== itr) {
      o.inner.setAttribute('transform', itr);
      o.inner.innerHTML = body;
      o.b = body;
      o.itr = itr;
    }
    // 라벨 (회전과 무관하게 정립)
    let ls = '';
    const rr = ((c.rot || 0) % 360 + 360) % 360;
    const bb = compBBox({ ...c, x: 0, y: 0 });
    const lab = (x, y, t, cls, a) => {
      if (t == null || t === '') return;
      let [rx, ry] = rotPt(x, y, c.rot || 0, c.flip);
      let anchor = a || 'middle';
      if (c.flip && anchor !== 'middle') anchor = anchor === 'start' ? 'end' : 'start';
      if (rr === 180 && anchor !== 'middle') anchor = anchor === 'start' ? 'end' : 'start';
      if (rr === 90 || rr === 270) {
        if (cls === 'plab') anchor = 'middle';
        else if (Math.abs(rx) > Math.abs(ry) || anchor !== 'middle') {
          // 회전된 부품의 라벨은 기호 옆(바깥)으로 배치
          anchor = rx >= 0 ? 'start' : 'end';
          rx = rx >= 0 ? Math.max(rx, bb[2] + 4) : Math.min(rx, bb[0] - 4);
          ry += 4;
        } else anchor = 'middle';
      }
      ls += `<text x="${Math.round(rx)}" y="${Math.round(ry)}" text-anchor="${anchor}" class="${cls}">${String(t).replace(/</g, '&lt;')}</text>`;
    };
    for (const l of r.l) lab(l.x, l.y, l.t, l.c, l.a);
    if (d.dom !== 'el' && !d.junction) {
      for (const p of d.ports(c)) {
        const t = p.lab ?? p.id;
        if (!t) continue;
        const off = { up: [5, 8, 'start'], down: [5, -3, 'start'], left: [3, -4, 'start'], right: [-3, -4, 'end'] }[p.dir] || [4, -4, 'start'];
        lab(p.x + off[0], p.y + off[1], t, 'plab', off[2]);
      }
    }
    if (o.l !== ls) { o.lg.innerHTML = ls; o.l = ls; }
  }

  renderWires() {
    this.cnt = this.portWireCount();
    let s = '';
    for (const w of this.doc.wires) {
      const pts = this.wireRoute(w);
      if (pts.length < 2) continue;
      const a = this.portWorld(w.a.c, w.a.p);
      const kind = a ? a.kind : 'pn';
      const d = pathD(pts);
      s += `<g class="wg" data-w="${w.id}"><path class="whit" d="${d}"/><path class="wire k-${kind}" d="${d}"/></g>`;
    }
    this.lw.innerHTML = s;
    this.wireEls = new Map();
    for (const g of this.lw.children) this.wireEls.set(g.dataset.w, g.lastChild);
    // 분기 점
    let j = '';
    for (const c of this.doc.components) {
      if (REG[c.type].junction) continue;
      for (const p of compPorts(c)) if ((this.cnt.get(c.id + ':' + p.id) || 0) >= 2) j += `<circle class="jdot" cx="${p.wx}" cy="${p.wy}" r="2.8"/>`;
    }
    this.lj.innerHTML = j;
    for (const c of this.doc.components) {
      const o = this.compEls.get(c.id);
      if (o) { const prev = o.b; this.renderComp(c); if (prev !== o.b) { /* 배기 표시 갱신 */ } }
    }
    if (this.sim) this.paintWires();
    this.renderSel();
  }

  renderPorts() {
    if (this.sim) { this.lp.innerHTML = ''; return; }
    let s = '';
    for (const c of this.doc.components) {
      if (REG[c.type].junction) continue;
      for (const p of compPorts(c)) {
        const n = this.cnt.get(c.id + ':' + p.id) || 0;
        s += `<circle class="port k-${p.kind}${n ? ' conn' : ''}" data-c="${c.id}" data-p="${p.id}" cx="${p.wx}" cy="${p.wy}" r="${n ? 3 : 3.2}"/>`;
      }
    }
    this.lp.innerHTML = s;
  }

  renderSel() {
    for (const [id, o] of this.compEls) o.g.classList.toggle('sel', this.sel.has('c:' + id));
    if (this.wireEls) for (const [id, p] of this.wireEls) p.parentNode.classList.toggle('sel', this.sel.has('w:' + id));
  }

  emitSel() { this.dispatchEvent(new CustomEvent('selection')); }

  fit() {
    const cs = this.doc.components;
    const r = this.svg.getBoundingClientRect();
    if (!cs.length || !r.width) { this.view = { x: 60, y: 60, k: 1 }; this.applyView(); return; }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of cs) {
      const b = compBBox(c);
      x0 = Math.min(x0, b[0] - 20); y0 = Math.min(y0, b[1] - 30); x1 = Math.max(x1, b[2] + 20); y1 = Math.max(y1, b[3] + 30);
    }
    for (const w of this.doc.wires) for (const [x, y] of this.wireRoute(w)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const k = Math.min(2, Math.max(0.2, Math.min((r.width - 40) / (x1 - x0), (r.height - 40) / (y1 - y0))));
    this.view = { k, x: (r.width - (x1 - x0) * k) / 2 - x0 * k, y: (r.height - (y1 - y0) * k) / 2 - y0 * k };
    this.applyView();
  }
  zoom(f, cx, cy) {
    const r = this.svg.getBoundingClientRect();
    if (cx == null) { cx = r.width / 2; cy = r.height / 2; }
    const k = Math.min(4, Math.max(0.15, this.view.k * f));
    this.view.x = cx - ((cx - this.view.x) * k) / this.view.k;
    this.view.y = cy - ((cy - this.view.y) * k) / this.view.k;
    this.view.k = k;
    this.applyView();
  }

  // ======================== 시뮬레이션 ========================
  startSim() {
    if (this.sim && !this.running) { this.running = true; this.last = performance.now(); this.loop(); this.simState(); return; }
    if (this.sim) return;
    this.cancelOps();
    this.sim = new Sim(this.doc);
    this.prefP = Math.max(50, ...this.doc.components.filter((c) => ['h_powerunit', 'h_relief'].includes(c.type)).map((c) => +c.props.p || 0));
    this.sel.clear();
    this.emitSel();
    this.running = true;
    this.svg.classList.add('simmode');
    this.renderPorts();
    this.last = performance.now();
    this.loop();
    this.simState();
  }
  pauseSim() { if (this.sim) { this.running = false; this.simState(); } }
  stopSim() {
    if (!this.sim) return;
    this.running = false;
    this.sim = null;
    this.svg.classList.remove('simmode');
    for (const p of this.lw.querySelectorAll('.wire')) p.removeAttribute('style');
    this.renderAll();
    this.simState();
  }
  stepSim(sec = 0.1) {
    if (!this.sim) { this.startSim(); this.pauseSim(); }
    this.sim.run(sec);
    this.paintSim();
  }
  resetSim() { const r = this.running; this.stopSim(); this.startSim(); if (!r) this.pauseSim(); }
  simState() { this.dispatchEvent(new CustomEvent('simstate')); }

  loop() {
    if (!this.running || !this.sim) return;
    const now = performance.now();
    const dtReal = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const dt = dtReal * this.speed;
    if (dt > 1e-5) {
      const n = Math.max(1, Math.ceil(dt / (1 / 240)));
      for (let i = 0; i < n; i++) this.sim.step(dt / n);
    }
    this.paintSim();
    requestAnimationFrame(() => this.loop());
  }

  paintSim() {
    if (!this.sim) return;
    for (const c of this.doc.components) this.renderComp(c);
    this.paintWires();
    this.dispatchEvent(new CustomEvent('frame'));
  }

  wireColor(ws) {
    if (!ws) return null;
    if (ws.el) return ws.live ? '#e11d48' : null;
    const p = ws.p;
    if (ws.kind === 'pn') return p < 0.25 ? null : mix('#8ab8ff', '#0645b8', Math.min(1, p / 6));
    if (p < 0.8) return null;
    return mix('#3d8bff', '#e0182d', Math.min(1, p / this.prefP));
  }
  paintWires() {
    if (!this.wireEls) return;
    for (const w of this.doc.wires) {
      const p = this.wireEls.get(w.id);
      if (!p) continue;
      const col = this.wireColor(this.sim.wireState(w));
      const s = col ? `stroke:${col};stroke-width:${p.classList.contains('k-el') ? 2 : 2.6}` : '';
      if (p._s !== s) { p.setAttribute('style', s); p._s = s; }
    }
  }

  // ======================== 입력 ========================
  cancelOps() {
    this.mode = 'idle';
    this.wireDraft = null;
    this.placing = null;
    this.lo.innerHTML = '';
    this.svg.style.cursor = '';
  }

  beginPlace(type) {
    if (this.sim) return;
    this.cancelOps();
    this.mode = 'place';
    this.placing = type;
  }

  hitTarget(ev) {
    const t = ev.target;
    if (t.classList && t.classList.contains('port')) return { kind: 'port', c: t.dataset.c, p: t.dataset.p };
    const wg = t.closest && t.closest('.wg');
    if (wg) return { kind: 'wire', w: wg.dataset.w };
    const cg = t.closest && t.closest('.comp');
    if (cg) return { kind: 'comp', c: cg.dataset.id };
    return { kind: 'none' };
  }

  bind() {
    const svg = this.svg;
    svg.addEventListener('contextmenu', (e) => e.preventDefault());
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      this.zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    svg.addEventListener('pointerdown', (e) => this.onDown(e));
    svg.addEventListener('pointermove', (e) => this.onMove(e));
    svg.addEventListener('pointerup', (e) => this.onUp(e));
    svg.addEventListener('pointercancel', (e) => this.onUp(e));
    svg.addEventListener('dblclick', (e) => this.onDbl(e));
    svg.addEventListener('dragover', (e) => e.preventDefault());
    svg.addEventListener('drop', (e) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('text/plain');
      if (REG[type]) { const [x, y] = this.toWorld(e); this.addComp(type, x, y); }
    });
  }

  onDown(e) {
    const [wx, wy] = this.toWorld(e);
    const hit = this.hitTarget(e);
    this.downAt = { x: e.clientX, y: e.clientY, wx, wy, hit, moved: false };
    if (e.button === 1 || e.button === 2 || this.spaceDown || this.panTool) {
      if (e.button === 2 && !this.sim && hit.kind !== 'none' && this.mode === 'idle') { this.ctx(e, hit); return; }
      this.startPan(e);
      return;
    }
    svg_capture(this.svg, e);
    if (this.sim) {
      if (hit.kind === 'comp') {
        const c = this.comp(hit.c);
        const [lx, ly] = this.toLocal(c, wx, wy);
        if (this.sim.press(c.id, lx, ly)) { this.pressed = c.id; this.paintSim(); return; }
      }
      this.startPan(e);
      return;
    }
    if (this.mode === 'place') {
      this.addComp(this.placing, wx, wy);
      if (!e.shiftKey) this.cancelOps();
      return;
    }
    if (this.mode === 'wire') { this.wireClick(hit, wx, wy); return; }
    if (hit.kind === 'port') {
      this.startWire(hit.c, hit.p);
      return;
    }
    if (hit.kind === 'comp') {
      const key = 'c:' + hit.c;
      if (e.shiftKey || e.ctrlKey || e.metaKey) { if (this.sel.has(key)) this.sel.delete(key); else this.sel.add(key); }
      else if (!this.sel.has(key)) this.sel = new Set([key]);
      this.renderSel();
      this.emitSel();
      this.mode = 'drag';
      this.drag = { sx: wx, sy: wy, orig: this.selComps().map((c) => [c, c.x, c.y]), snapped: false };
      const ids = new Set(this.selComps().map((c) => c.id));
      this.drag.wires = this.doc.wires.filter((w) => ids.has(w.a.c) && ids.has(w.b.c)).map((w) => [w, (w.pts || []).map((p) => p.slice())]);
      return;
    }
    if (hit.kind === 'wire') {
      const key = 'w:' + hit.w;
      if (e.shiftKey) { if (this.sel.has(key)) this.sel.delete(key); else this.sel.add(key); }
      else this.sel = new Set([key]);
      this.renderSel();
      this.emitSel();
      // 세그먼트 드래그
      const w = this.wire(hit.w);
      const pts = this.wireRoute(w);
      const nr = nearestOnPolyline(pts, wx, wy);
      if (nr && nr.seg >= 1 && nr.seg <= pts.length - 3) {
        this.mode = 'seg';
        this.segDrag = { w, pts, seg: nr.seg, horiz: pts[nr.seg][1] === pts[nr.seg + 1][1], snapped: false };
      }
      return;
    }
    // 빈 곳: 영역 선택
    if (!e.shiftKey) { this.sel.clear(); this.renderSel(); this.emitSel(); }
    this.mode = 'rubber';
    this.rubber = { x: wx, y: wy };
  }

  startPan(e) {
    this.mode = this.mode === 'wire' || this.mode === 'place' ? this.mode : 'pan';
    this.pan = { x: e.clientX, y: e.clientY, vx: this.view.x, vy: this.view.y, prevMode: this.mode };
    this.panning = true;
    svg_capture(this.svg, e);
    this.svg.style.cursor = 'grabbing';
  }

  toLocal(c, wx, wy) {
    let x = wx - c.x, y = wy - c.y;
    const r = (((c.rot || 0) % 360) + 360) % 360;
    let lx = x, ly = y;
    if (r === 90) { lx = y; ly = -x; } else if (r === 180) { lx = -x; ly = -y; } else if (r === 270) { lx = -y; ly = x; }
    if (c.flip) lx = -lx;
    return [lx, ly];
  }

  onMove(e) {
    const [wx, wy] = this.toWorld(e);
    this.dispatchEvent(new CustomEvent('cursor', { detail: { x: snap(wx), y: snap(wy) } }));
    if (this.downAt && Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) > 3) this.downAt.moved = true;
    if (this.panning) {
      this.view.x = this.pan.vx + e.clientX - this.pan.x;
      this.view.y = this.pan.vy + e.clientY - this.pan.y;
      this.applyView();
      return;
    }
    if (this.sim) { this.hoverInfo(e); return; }
    if (this.mode === 'drag' && this.drag) {
      const dx = snap(wx - this.drag.sx), dy = snap(wy - this.drag.sy);
      if (!this.drag.snapped && (dx || dy)) { this.snap(); this.drag.snapped = true; }
      if (!this.drag.snapped) return;
      for (const [c, x, y] of this.drag.orig) { c.x = x + dx; c.y = y + dy; }
      for (const [w, pts] of this.drag.wires) w.pts = pts.map(([x, y]) => [x + dx, y + dy]);
      for (const [c] of this.drag.orig) this.renderComp(c);
      this.renderWires();
      this.renderPorts();
      return;
    }
    if (this.mode === 'seg' && this.segDrag) {
      const sd = this.segDrag;
      const pts = sd.pts.map((p) => p.slice());
      if (sd.horiz) { pts[sd.seg][1] = snap(wy); pts[sd.seg + 1][1] = snap(wy); }
      else { pts[sd.seg][0] = snap(wx); pts[sd.seg + 1][0] = snap(wx); }
      if (!sd.snapped) { this.snap(); sd.snapped = true; }
      sd.w.pts = pts.slice(1, -1);
      this.renderWires();
      return;
    }
    if (this.mode === 'rubber' && this.rubber) {
      const x = Math.min(this.rubber.x, wx), y = Math.min(this.rubber.y, wy);
      this.lo.innerHTML = `<rect class="rubber" x="${x}" y="${y}" width="${Math.abs(wx - this.rubber.x)}" height="${Math.abs(wy - this.rubber.y)}"/>`;
      return;
    }
    if (this.mode === 'wire' && this.wireDraft) { this.drawDraft(wx, wy, e); return; }
    if (this.mode === 'place' && this.placing) {
      const d = REG[this.placing];
      const c = newComp(this.placing, 0, 0, 'ghost');
      const [x0, y0, x1, y1] = d.bbox(c);
      const gx = snap(wx - (x0 + x1) / 2), gy = snap(wy - (y0 + y1) / 2);
      const r = d.draw(c, null, null);
      this.lo.innerHTML = `<g class="sym ghost" transform="translate(${gx},${gy})">${r.b}</g>`;
    }
  }

  hoverInfo(e) {
    const hit = this.hitTarget(e);
    let msg = '';
    if (hit.kind === 'wire') {
      const ws = this.sim.wireState(this.wire(hit.w));
      if (ws) msg = ws.el ? (ws.live ? '배선: +24V 통전' : '배선: 무전압') : `관로 압력: ${ws.p.toFixed(2)} bar`;
    } else if (hit.kind === 'comp') {
      const c = this.comp(hit.c);
      msg = `${REG[c.type].name} ${c.props.tag || ''}` + (REG[c.type].press ? ' — 클릭하여 조작' : '');
    }
    this.dispatchEvent(new CustomEvent('hover', { detail: msg }));
  }

  onUp(e) {
    const [wx, wy] = this.toWorld(e);
    if (this.panning) {
      this.panning = false;
      this.svg.style.cursor = '';
      if (this.mode === 'pan') this.mode = 'idle';
      if (e.button === 2 && this.downAt && !this.downAt.moved && !this.sim) this.ctx(e, this.downAt.hit);
      this.downAt = null;
      return;
    }
    if (this.pressed) {
      this.sim && this.sim.release(this.pressed);
      this.pressed = null;
      this.paintSim();
      return;
    }
    if (this.mode === 'drag') {
      this.mode = 'idle';
      if (this.drag && this.drag.snapped) { this.renderAll(); this.changed(); }
      this.drag = null;
    } else if (this.mode === 'seg') {
      this.mode = 'idle';
      if (this.segDrag.snapped) this.changed();
      this.segDrag = null;
    } else if (this.mode === 'rubber') {
      const x0 = Math.min(this.rubber.x, wx), x1 = Math.max(this.rubber.x, wx);
      const y0 = Math.min(this.rubber.y, wy), y1 = Math.max(this.rubber.y, wy);
      if (x1 - x0 > 3 || y1 - y0 > 3) {
        for (const c of this.doc.components) {
          const b = compBBox(c);
          if (b[0] >= x0 && b[2] <= x1 && b[1] >= y0 && b[3] <= y1) this.sel.add('c:' + c.id);
        }
        for (const w of this.doc.wires) {
          const pts = this.wireRoute(w);
          if (pts.length && pts.every(([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)) this.sel.add('w:' + w.id);
        }
        this.renderSel();
        this.emitSel();
      }
      this.lo.innerHTML = '';
      this.mode = 'idle';
      this.rubber = null;
    } else if (this.mode === 'wire' && this.wireDraft && this.downAt && this.downAt.moved) {
      // 드래그하여 연결
      const hit = this.hitTarget(e);
      if (hit.kind === 'port' && !(hit.c === this.wireDraft.c && hit.p === this.wireDraft.p)) this.wireClick(hit, wx, wy);
      else if (hit.kind === 'wire') this.wireClick(hit, wx, wy);
    }
    this.downAt = null;
  }

  onDbl(e) {
    if (this.sim) return;
    const hit = this.hitTarget(e);
    if (hit.kind === 'wire') {
      const [wx, wy] = this.toWorld(e);
      this.snap();
      const j = this.splitWire(this.wire(hit.w), wx, wy);
      if (j) { this.sel = new Set(['c:' + j.id]); this.renderAll(); this.changed(); this.emitSel(); }
    } else if (hit.kind === 'comp') {
      this.dispatchEvent(new CustomEvent('editprops', { detail: hit.c }));
    }
  }

  // ---------- 배선 ----------
  startWire(cid, pid) {
    const p = this.portWorld(cid, pid);
    if (!p) return;
    this.mode = 'wire';
    this.wireDraft = { c: cid, p: pid, kind: p.kind, start: [p.wx, p.wy], dir: p.wdir, pts: [] };
    this.svg.style.cursor = 'crosshair';
    this.drawDraft(p.wx, p.wy);
  }
  drawDraft(wx, wy, e) {
    const d = this.wireDraft;
    let end = [snap(wx), snap(wy)], edir = 'none';
    if (e) {
      const hit = this.hitTarget(e);
      if (hit.kind === 'port') { const p = this.portWorld(hit.c, hit.p); if (p) { end = [p.wx, p.wy]; edir = p.wdir; } }
    }
    const pts = route(d.start, d.dir, d.pts, end, edir);
    this.lo.innerHTML = `<path class="draft k-${d.kind}" d="${pathD(pts)}"/>` + d.pts.map(([x, y]) => `<circle class="wp" cx="${x}" cy="${y}" r="2.5"/>`).join('');
  }
  wireClick(hit, wx, wy) {
    const d = this.wireDraft;
    if (hit.kind === 'port') {
      if (hit.c === d.c && hit.p === d.p) { this.cancelOps(); return; }
      const p = this.portWorld(hit.c, hit.p);
      if (!p || p.kind !== d.kind) { this.flash('서로 다른 종류(공압/유압/전기)의 포트는 연결할 수 없습니다.'); return; }
      if (this.doc.wires.some((w) => (w.a.c === d.c && w.a.p === d.p && w.b.c === hit.c && w.b.p === hit.p) || (w.b.c === d.c && w.b.p === d.p && w.a.c === hit.c && w.a.p === hit.p))) { this.cancelOps(); return; }
      this.snap();
      this.doc.wires.push({ id: this.newId('w'), a: { c: d.c, p: d.p }, b: { c: hit.c, p: hit.p }, pts: d.pts });
      this.cancelOps();
      this.renderAll();
      this.changed();
      return;
    }
    if (hit.kind === 'wire') {
      const w = this.wire(hit.w);
      const a = this.portWorld(w.a.c, w.a.p);
      if (!a || a.kind !== d.kind) { this.flash('서로 다른 종류의 배관/배선에는 연결할 수 없습니다.'); return; }
      this.snap();
      const j = this.splitWire(w, wx, wy);
      if (j) this.doc.wires.push({ id: this.newId('w'), a: { c: d.c, p: d.p }, b: { c: j.id, p: 'J' }, pts: d.pts });
      this.cancelOps();
      this.renderAll();
      this.changed();
      return;
    }
    d.pts.push([snap(wx), snap(wy)]);
    this.drawDraft(wx, wy);
  }
  splitWire(w, wx, wy) {
    const pts = this.wireRoute(w);
    const nr = nearestOnPolyline(pts, wx, wy);
    if (!nr) return null;
    let x = snap(nr.x), y = snap(nr.y);
    const [x1, y1] = pts[nr.seg], [x2, y2] = pts[nr.seg + 1];
    if (y1 === y2) y = y1; else if (x1 === x2) x = x1;
    const a = this.portWorld(w.a.c, w.a.p);
    const jt = a.kind === 'el' ? 'e_junction' : a.kind === 'hy' ? 'h_junction' : 'p_junction';
    const j = newComp(jt, x, y, this.newId('c'));
    this.doc.components.push(j);
    const w1 = { id: w.id, a: w.a, b: { c: j.id, p: 'J' }, pts: pts.slice(1, nr.seg + 1) };
    const w2 = { id: this.newId('w'), a: { c: j.id, p: 'J' }, b: w.b, pts: pts.slice(nr.seg + 1, -1) };
    this.doc.wires = this.doc.wires.filter((o) => o !== w);
    this.doc.wires.push(w1, w2);
    return j;
  }
  clearWirePts() {
    const ws = [...this.sel].filter((k) => k.startsWith('w:')).map((k) => this.wire(k.slice(2))).filter(Boolean);
    if (!ws.length) return;
    this.snap();
    for (const w of ws) w.pts = [];
    this.renderWires();
    this.changed();
  }

  flash(msg) { this.dispatchEvent(new CustomEvent('hover', { detail: '⚠ ' + msg })); }

  ctx(e, hit) {
    if (hit.kind === 'comp' && !this.sel.has('c:' + hit.c)) { this.sel = new Set(['c:' + hit.c]); this.renderSel(); this.emitSel(); }
    if (hit.kind === 'wire' && !this.sel.has('w:' + hit.w)) { this.sel = new Set(['w:' + hit.w]); this.renderSel(); this.emitSel(); }
    this.dispatchEvent(new CustomEvent('ctx', { detail: { x: e.clientX, y: e.clientY, hit } }));
  }

  key(e) {
    if (this.sim) {
      if (e.key === 'Escape') this.stopSim();
      return false;
    }
    const k = e.key.toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    if (k === 'escape') { this.cancelOps(); this.sel.clear(); this.renderSel(); this.emitSel(); return true; }
    if (k === 'delete' || k === 'backspace') { this.deleteSel(); return true; }
    if (mod && k === 'z' && !e.shiftKey) { this.undo(); return true; }
    if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { this.redo(); return true; }
    if (mod && k === 'c') { this.copy(); return true; }
    if (mod && k === 'v') { this.paste(); return true; }
    if (mod && k === 'd') { this.duplicate(); return true; }
    if (mod && k === 'a') { this.selectAll(); return true; }
    if (!mod && k === 'r') { this.rotateSel(e.shiftKey ? -90 : 90); return true; }
    if (!mod && k === 'm') { this.flipSel(); return true; }
    if (k.startsWith('arrow')) {
      const cs = this.selComps();
      if (!cs.length) return false;
      this.snap();
      const dx = k === 'arrowleft' ? -GRID : k === 'arrowright' ? GRID : 0;
      const dy = k === 'arrowup' ? -GRID : k === 'arrowdown' ? GRID : 0;
      const ids = new Set(cs.map((c) => c.id));
      for (const c of cs) { c.x += dx; c.y += dy; }
      for (const w of this.doc.wires) if (ids.has(w.a.c) && ids.has(w.b.c)) w.pts = (w.pts || []).map(([x, y]) => [x + dx, y + dy]);
      this.renderAll();
      this.changed();
      return true;
    }
    return false;
  }

  // ---------- 내보내기 ----------
  exportSVG() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of this.doc.components) { const b = compBBox(c); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1] - 20); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3] + 20); }
    if (!isFinite(x0)) { x0 = 0; y0 = 0; x1 = 100; y1 = 100; }
    x0 -= 30; y0 -= 30; x1 += 30; y1 += 30;
    const body = this.lw.innerHTML.replace(/<path class="whit"[^>]*>/g, '') + this.lc.innerHTML.replace(/<rect class="hit"[^>]*>/g, '') + this.lj.innerHTML;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" width="${x1 - x0}" height="${y1 - y0}"><style>${SYM_CSS}</style><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="#fff"/>${body}</svg>`;
  }
}

function svg_capture(svg, e) {
  try { svg.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
}
