// 시뮬레이션 엔진
//  - 유체: 절점 압력 해석 (컨덕턴스 + 노드 용량 + 실린더/모터 속도 미지수), 비선형 요소는 액티브셋 반복
//  - 전기: 접점 그래프(유니온-파인드)로 +24V / 0V 연결 판정, 릴레이 자기유지 수렴 반복
import { REG, MED, valveUpdate, parseMarks } from './components.js';

class UF {
  constructor(n) { this.p = new Int32Array(n); for (let i = 0; i < n; i++) this.p[i] = i; }
  find(i) { while (this.p[i] !== i) { this.p[i] = this.p[this.p[i]]; i = this.p[i]; } return i; }
  union(a, b) { a = this.find(a); b = this.find(b); if (a !== b) this.p[a] = b; }
}

function gauss(A, b, n) {
  // 부분 피벗 가우스 소거 (A: n*n Float64Array, b: Float64Array) → 해를 b에 저장
  for (let k = 0; k < n; k++) {
    let piv = k, max = Math.abs(A[k * n + k]);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(A[i * n + k]);
      if (v > max) { max = v; piv = i; }
    }
    if (max < 1e-14) { A[k * n + k] = 1e-14; piv = k; }
    if (piv !== k) {
      for (let j = k; j < n; j++) { const t = A[k * n + j]; A[k * n + j] = A[piv * n + j]; A[piv * n + j] = t; }
      const t = b[k]; b[k] = b[piv]; b[piv] = t;
    }
    const akk = A[k * n + k];
    for (let i = k + 1; i < n; i++) {
      const m = A[i * n + k] / akk;
      if (m === 0) continue;
      for (let j = k; j < n; j++) A[i * n + j] -= m * A[k * n + j];
      b[i] -= m * b[k];
    }
  }
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < n; j++) s -= A[i * n + j] * b[j];
    b[i] = s / A[i * n + i];
  }
  return b;
}

export class Sim {
  constructor(doc) {
    this.doc = doc;
    this.t = 0;
    this.frame = 0;
    this.st = new Map();
    this.relay = new Map();
    this.sol = new Map();
    this.timers = new Map();
    this.counters = new Map();
    this.btn = new Map();
    this.sw = new Map();
    this.marks = new Map();
    this.manMarks = new Map();
    this.ps = new Map();
    this.modes = new Map();
    this.warn = new Set();
    this.short = false;
    this.hist = [];
    this.histT = -1;
    this.build();
  }

  build() {
    const doc = this.doc;
    this.comps = doc.components.filter((c) => REG[c.type]);
    this.byId = new Map(this.comps.map((c) => [c.id, c]));
    const keys = new Map(); // portKey -> idx
    const info = [];
    for (const c of this.comps) {
      const d0 = REG[c.type];
      for (const p of [...d0.ports(c), ...(d0.jacks ? d0.jacks(c) : [])]) {
        const k = c.id + ':' + p.id;
        keys.set(k, info.length);
        info.push({ c, p, kind: p.kind, wires: 0 });
      }
    }
    const uf = new UF(info.length);
    for (const w of doc.wires) {
      const a = keys.get(w.a.c + ':' + w.a.p), b = keys.get(w.b.c + ':' + w.b.p);
      if (a == null || b == null) continue;
      if (info[a].kind !== info[b].kind) continue;
      uf.union(a, b);
      info[a].wires++;
      info[b].wires++;
    }
    // 유체 / 전기 넷 번호
    const fluidRoot = new Map(), elRoot = new Map();
    this.portNet = new Map();
    this.elPortNet = new Map();
    this.netKind = [];
    this.vents = [];
    for (let i = 0; i < info.length; i++) {
      const r = uf.find(i);
      const { c, p, kind } = info[i];
      const key = c.id + ':' + p.id;
      if (kind === 'el') {
        if (!elRoot.has(r)) elRoot.set(r, elRoot.size);
        this.elPortNet.set(key, elRoot.get(r));
      } else {
        if (!fluidRoot.has(r)) { fluidRoot.set(r, fluidRoot.size); this.netKind.push(kind); }
        const n = fluidRoot.get(r);
        this.portNet.set(key, n);
        // 공압: 미접속 포트는 대기 개방
        if (kind === 'pn' && info[i].wires === 0 && !p.pilot && !REG[c.type].junction && !['p_gauge', 'p_pswitch', 'p_source'].includes(c.type)) {
          this.vents.push({ n, g: MED.pn.Gvent });
        }
      }
    }
    this.nNets = fluidRoot.size;
    this.nEl = elRoot.size;
    this.p = new Float64Array(this.nNets);
    this.elLive = new Uint8Array(this.nEl);
    for (const c of this.comps) {
      const st = {};
      this.st.set(c.id, st);
      const d = REG[c.type];
      if (d.init) d.init(c, st, this);
    }
    this.cyls = this.comps.filter((c) => c.type.includes('_cyl_'));
    this.attached = this.comps.filter((c) => c.props && c.props.cyl);
    this.valves = this.comps.filter((c) => REG[c.type].valve);
    this.fluidComps = this.comps.filter((c) => REG[c.type].fluid);
    this.elComps = this.comps.filter((c) => REG[c.type].elec);
    this.postComps = this.comps.filter((c) => REG[c.type].post);
    this.computeMarks(0);
  }

  // ---------- 조회 ----------
  netOf(c, pid) { return this.portNet.get(c.id + ':' + pid); }
  pAt(c, pid) { const n = this.netOf(c, pid); return n == null ? 0 : this.p[n]; }
  solOn(tag) { return !!(tag && this.sol.get(tag)); }
  markOn(tag) { return !!(tag && (this.marks.get(tag) || this.manMarks.get(tag))); }
  timerOut(tag) {
    const t = this.timers.get(tag);
    if (!t) return false;
    return t.mode === 'on' ? t.coil && t.acc >= t.delay - 1e-9 : t.coil || t.hold;
  }
  counterOut(tag) { const t = this.counters.get(tag); return !!t && t.count >= t.preset; }
  actuated(kind, tag) {
    switch (kind) {
      case 'btn': return !!this.btn.get(tag);
      case 'sw': return !!this.sw.get(tag);
      case 'mark': return this.markOn(tag);
      case 'ps': return !!this.ps.get(tag);
      case 'relay': return !!this.relay.get(tag);
      case 'timer': return this.timerOut(tag);
      case 'counter': return this.counterOut(tag);
    }
    return false;
  }
  wireState(w) {
    const c = this.byId.get(w.a.c);
    if (!c) return null;
    const key = w.a.c + ':' + w.a.p;
    if (this.elPortNet.has(key)) return { el: true, live: !!this.elLive[this.elPortNet.get(key)] };
    const n = this.portNet.get(key);
    if (n == null) return null;
    return { el: false, p: this.p[n], kind: this.netKind[n] };
  }

  // ---------- 사용자 조작 ----------
  press(id, lx, ly) {
    const c = this.byId.get(id);
    if (!c) return false;
    const d = REG[c.type];
    if (!d.press) return false;
    d.press(c, this.st.get(id), this, lx, ly);
    return true;
  }
  attachOn(c) { return !!(this.st.get(c.id) || {}).att; }
  release(id) {
    const c = this.byId.get(id);
    if (!c) return;
    const d = REG[c.type];
    if (d.release) d.release(c, this.st.get(id), this);
  }

  // ---------- 코일 게시 (전기 반복 중) ----------
  setCoil(kind, tag, on) {
    if (!tag) return;
    const m = kind === 'relay' ? this._nRelay : this._nSol;
    m.set(tag, (m.get(tag) || false) || on);
  }
  setTimer(tag, on, mode, delay) {
    if (!tag) return;
    let t = this.timers.get(tag);
    if (!t) { t = { coil: false, acc: 0, hold: false, mode, delay }; this.timers.set(tag, t); }
    t.mode = mode;
    t.delay = delay;
    this._nTimer.set(tag, (this._nTimer.get(tag) || false) || on);
  }
  setCounter(tag, inp, rst, preset) {
    if (!tag) return;
    let t = this.counters.get(tag);
    if (!t) { t = { in: false, rst: false, prevIn: false, count: 0, preset: preset || 1 }; this.counters.set(tag, t); }
    if (preset != null) t.preset = preset;
    if (inp != null) this._nCntIn.set(tag, (this._nCntIn.get(tag) || false) || inp);
    if (rst != null) this._nCntRst.set(tag, (this._nCntRst.get(tag) || false) || rst);
  }

  computeMarks(dt) {
    this.marks.clear();
    for (const c of this.attached) {
      const st = this.st.get(c.id);
      const cs = this.st.get(c.props.cyl);
      const cy = this.byId.get(c.props.cyl);
      if (!cs || !cy) { st.att = false; continue; }
      const Lm = +cy.props.stroke || 100, pos = Math.max(0, Math.min(Lm, +c.props.pos || 0));
      const tol = Math.max(1.5, Math.abs(cs.v || 0) * 10 * dt * 0.75);
      st.att = pos <= 0.5 ? cs.x <= 0.5 : pos >= Lm - 0.5 ? cs.x >= Lm - 0.5 : Math.abs(cs.x - pos) <= tol;
    }
    for (const c of this.cyls) {
      const st = this.st.get(c.id);
      const Lm = +c.props.stroke || 100;
      const tol = Math.max(1.5, Math.abs(st.v || 0) * 10 * dt * 0.75);
      for (const m of parseMarks(c)) {
        let on;
        if (m.pos <= 0) on = st.x <= 0.5;
        else if (m.pos >= Lm) on = st.x >= Lm - 0.5;
        else on = Math.abs(st.x - m.pos) <= tol;
        if (on) this.marks.set(m.tag, true);
      }
    }
  }

  // ---------- 전기 해석 ----------
  solveElec() {
    let plus, zero, uf, loads;
    for (let iter = 0; iter < 40; iter++) {
      this._nRelay = new Map();
      this._nSol = new Map();
      this._nTimer = new Map();
      this._nCntIn = new Map();
      this._nCntRst = new Map();
      uf = new UF(Math.max(1, this.nEl));
      plus = [];
      zero = [];
      loads = [];
      for (const c of this.elComps) {
        const st = this.st.get(c.id);
        const net = (pid) => this.elPortNet.get(c.id + ':' + pid);
        const k = {
          contact: (a, b, closed) => { if (closed) uf.union(net(a), net(b)); },
          supply: (a, s) => (s === '+' ? plus : zero).push(net(a)),
          load: (a, b, cb) => loads.push({ c, st, a: net(a), b: net(b), cb }),
        };
        REG[c.type].elec(c, st, k, this);
      }
      const P = new Set(plus.map((n) => uf.find(n)));
      const Z = new Set(zero.map((n) => uf.find(n)));
      let short = false;
      for (const r of P) if (Z.has(r)) short = true;
      this.short = short;
      for (const L of loads) {
        const ra = uf.find(L.a), rb = uf.find(L.b);
        const on = !short && ((P.has(ra) && Z.has(rb)) || (P.has(rb) && Z.has(ra)));
        if (L.cb) { L.cb(on); continue; }
        L.st.on = on;
        const d = REG[L.c.type];
        if (d.publish) d.publish(L.c, L.st, this);
      }
      const same = (a, b) => {
        const keys = new Set([...a.keys(), ...b.keys()]);
        for (const k of keys) if (!!a.get(k) !== !!b.get(k)) return false;
        return true;
      };
      const curTimer = new Map([...this.timers].map(([k, t]) => [k, t.coil]));
      const stable = same(this._nRelay, this.relay) && same(this._nSol, this.sol) && same(this._nTimer, curTimer);
      this.relay = this._nRelay;
      this.sol = this._nSol;
      for (const [k, t] of this.timers) t.coil = !!this._nTimer.get(k);
      if (stable && iter > 0) break;
    }
    for (const [k, t] of this.counters) {
      t.in = !!this._nCntIn.get(k);
      t.rst = !!this._nCntRst.get(k);
    }
    const P = new Set(plus.map((n) => uf.find(n)));
    for (let i = 0; i < this.nEl; i++) this.elLive[i] = !this.short && P.has(uf.find(i)) ? 1 : 0;
    if (this.short) this.warn.add('전기 회로 단락(+24V와 0V 직결)! 배선을 확인하세요.');
  }

  // ---------- 유체 해석 ----------
  solveFluid(dt) {
    const N = this.nNets;
    const prims = [];
    for (const c of this.fluidComps) {
      const st = this.st.get(c.id);
      const net = (pid) => (pid == null ? -1 : this.portNet.get(c.id + ':' + pid) ?? -1);
      const mk = (key) => c.id + ':' + key;
      const k = {
        p: (pid) => { const n = net(pid); return n < 0 ? 0 : this.p[n]; },
        G: (a, b, g) => prims.push({ t: 0, a: net(a), b: net(b), g }),
        Gp: (a, p0, g) => prims.push({ t: 1, a: net(a), p0, g }),
        Q: (a, q) => prims.push({ t: 2, a: net(a), q }),
        check: (a, b, g, crack, key) => { prims.push({ t: 3, a: net(a), b: net(b), g, crack, key: mk(key) }); return this.modes.get(mk(key)) === 1; },
        seq: (a, b, g, pset, key) => { prims.push({ t: 4, a: net(a), b: net(b), g, pset, key: mk(key) }); return this.modes.get(mk(key)) || 0; },
        reduce: (a, b, g, pset, key) => { prims.push({ t: 5, a: net(a), b: net(b), g, pset, key: mk(key) }); return this.modes.get(mk(key)) || 0; },
        fcv: (a, b, g, qmax, key) => { prims.push({ t: 6, a: net(a), b: net(b), g, qmax, key: mk(key) }); return this.modes.get(mk(key)) || 0; },
        cyl: (a, b, Aa, Ab, cf, F, st2, Lm) => prims.push({ t: 7, a: net(a), b: net(b), Aa, Ab, cf, F, st: st2, Lm, c }),
        motor: (a, b, D, cf, T, st2) => prims.push({ t: 8, a: net(a), b: net(b), D, cf, T, st: st2 }),
        acc: (a, C, p0) => prims.push({ t: 9, a: net(a), C, p0, key: mk('acc') }),
      };
      REG[c.type].fluid(c, st, k);
    }
    let n = N;
    for (const pr of prims) {
      if (pr.t === 7 || pr.t === 8) pr.k = n++;
      if (pr.t === 7) {
        const x = pr.st.x;
        pr.mode = x >= pr.Lm - 1e-9 ? 1 : x <= 1e-9 ? -1 : 0;
      }
      if (pr.t === 8) {
        // 부하 토크는 회전을 방해하는 방향으로 작용 (마찰성 부하)
        const dp = (pr.a >= 0 ? this.p[pr.a] : 0) - (pr.b >= 0 ? this.p[pr.b] : 0);
        pr.sg = Math.abs(pr.st.w) > 1e-3 ? Math.sign(pr.st.w) : Math.sign(dp) || 1;
        pr.mode = pr.T > 0 && Math.abs(pr.st.w) < 1e-3 && Math.abs(dp) * pr.D <= pr.T ? 1 : 0;
      }
    }
    if (n === 0) return;
    const A = new Float64Array(n * n), b = new Float64Array(n);
    const pPrev = this.p;
    let x = new Float64Array(n);
    const add = (i, j, v) => { if (i >= 0 && j >= 0) A[i * n + j] += v; };
    const rhs = (i, v) => { if (i >= 0) b[i] += v; };
    const stampG = (a, bb, g) => { add(a, a, g); add(bb, bb, g); add(a, bb, -g); add(bb, a, -g); };
    for (let iter = 0; iter < 16; iter++) {
      A.fill(0);
      b.fill(0);
      for (let i = 0; i < N; i++) {
        const C = MED[this.netKind[i]].Cnode / dt;
        A[i * n + i] += C;
        b[i] += C * pPrev[i];
      }
      for (const v of this.vents) add(v.n, v.n, v.g);
      for (const pr of prims) {
        const { a } = pr, bb = pr.b;
        switch (pr.t) {
          case 0: stampG(a, bb, pr.g); break;
          case 1: add(a, a, pr.g); rhs(a, pr.g * pr.p0); break;
          case 2: rhs(a, pr.q); break;
          case 3: if (this.modes.get(pr.key) === 1) { stampG(a, bb, pr.g); rhs(a, pr.g * pr.crack); rhs(bb, -pr.g * pr.crack); } break;
          case 4: {
            const m = this.modes.get(pr.key) || 0;
            if (m === 1) { const g = MED.hy.Gr; add(a, a, g); rhs(a, g * pr.pset); add(bb, a, -g); rhs(bb, -g * pr.pset); }
            else if (m === 2) stampG(a, bb, pr.g);
            break;
          }
          case 5: {
            const m = this.modes.get(pr.key) || 0;
            if (m === 0) stampG(a, bb, pr.g);
            else if (m === 1) { const g = pr.g; add(bb, bb, g); rhs(bb, g * pr.pset); add(a, bb, -g); rhs(a, -g * pr.pset); }
            break;
          }
          case 6: {
            const m = this.modes.get(pr.key) || 0;
            if (m === 0) stampG(a, bb, pr.g);
            else { rhs(a, -m * pr.qmax); rhs(bb, m * pr.qmax); }
            break;
          }
          case 7: {
            const k = pr.k;
            add(a, k, pr.Aa);
            add(bb, k, -pr.Ab);
            if (pr.mode === 0) {
              add(k, a, pr.Aa);
              add(k, bb, -pr.Ab);
              add(k, k, -pr.cf);
              b[k] += pr.F;
            } else {
              A[k * n + k] = 1;
            }
            break;
          }
          case 8: {
            const k = pr.k;
            add(a, k, pr.D);
            add(bb, k, -pr.D);
            if (pr.mode === 1) { A[k * n + k] = 1; break; }
            add(k, a, pr.D);
            add(k, bb, -pr.D);
            add(k, k, -pr.cf);
            b[k] += pr.T * pr.sg;
            break;
          }
          case 9: {
            if (this.modes.get(pr.key) === 1) {
              const g = pr.C / dt;
              add(a, a, g);
              rhs(a, g * Math.max(pPrev[a] || 0, pr.p0));
            }
            break;
          }
        }
      }
      x = gauss(A, b, n);
      // 액티브셋 갱신
      const P = (i) => (i >= 0 ? x[i] : 0);
      let changed = false;
      const setMode = (key, m) => { if ((this.modes.get(key) || 0) !== m) { this.modes.set(key, m); changed = true; } };
      for (const pr of prims) {
        switch (pr.t) {
          case 3: {
            const d = P(pr.a) - P(pr.b);
            const m = this.modes.get(pr.key) === 1;
            if (m && d < pr.crack - 1e-7) setMode(pr.key, 0);
            else if (!m && d > pr.crack + 1e-7) setMode(pr.key, 1);
            break;
          }
          case 4: {
            const m = this.modes.get(pr.key) || 0, pa = P(pr.a), pb = P(pr.b);
            if (m === 0 && pa > pr.pset) setMode(pr.key, pb >= pr.pset ? 2 : 1);
            else if (m === 1) { if (pa < pr.pset - 1e-6) setMode(pr.key, 0); else if (pb > pr.pset) setMode(pr.key, 2); }
            else if (m === 2 && pa < pr.pset - 2) setMode(pr.key, 0);
            break;
          }
          case 5: {
            const m = this.modes.get(pr.key) || 0, pa = P(pr.a), pb = P(pr.b);
            if (m === 0 && pb > pr.pset + 1e-6) setMode(pr.key, 1);
            else if (m === 1) { if (pa < pr.pset - 1e-6) setMode(pr.key, 0); else if (pb > pr.pset + 1e-4) setMode(pr.key, 2); }
            else if (m === 2 && pb < pr.pset - 1e-6) setMode(pr.key, pa >= pr.pset ? 1 : 0);
            break;
          }
          case 6: {
            const m = this.modes.get(pr.key) || 0, d = P(pr.a) - P(pr.b), lim = pr.qmax / pr.g;
            if (m === 0 && d > lim) setMode(pr.key, 1);
            else if (m === 0 && d < -lim) setMode(pr.key, -1);
            else if (m === 1 && d < lim) setMode(pr.key, 0);
            else if (m === -1 && d > -lim) setMode(pr.key, 0);
            break;
          }
          case 7: {
            const v = x[pr.k];
            const F = P(pr.a) * pr.Aa - P(pr.b) * pr.Ab - pr.F;
            const atHi = pr.st.x >= pr.Lm - 1e-9, atLo = pr.st.x <= 1e-9;
            if (pr.mode === 1 && F < 0) { pr.mode = 0; changed = true; }
            else if (pr.mode === -1 && F > 0) { pr.mode = 0; changed = true; }
            else if (pr.mode === 0 && atHi && v > 0) { pr.mode = 1; changed = true; }
            else if (pr.mode === 0 && atLo && v < 0) { pr.mode = -1; changed = true; }
            break;
          }
          case 8: {
            if (pr.T <= 0) break;
            const dp = P(pr.a) - P(pr.b);
            if (pr.mode === 0 && x[pr.k] * pr.sg < 0) { pr.mode = 1; changed = true; }
            else if (pr.mode === 1 && dp * pr.D * pr.sg > pr.T) { pr.mode = 0; changed = true; }
            break;
          }
          case 9: {
            const m = this.modes.get(pr.key) === 1, pa = P(pr.a);
            if (m && pa < pr.p0 - 1e-6) setMode(pr.key, 0);
            else if (!m && pa > pr.p0 + 1e-6) setMode(pr.key, 1);
            break;
          }
        }
      }
      if (!changed) break;
    }
    for (let i = 0; i < n; i++) if (!Number.isFinite(x[i])) x[i] = i < N ? pPrev[i] : 0;
    for (let i = 0; i < N; i++) this.p[i] = Math.max(-1, x[i]);
    for (const pr of prims) {
      if (pr.t === 7) pr.st.v = pr.mode === 0 ? x[pr.k] : 0;
      if (pr.t === 8) pr.st.w = pr.mode === 1 ? 0 : x[pr.k];
      if (pr.t === 3 && pr.key.endsWith(':safety') && this.modes.get(pr.key) === 1) this.warn.add('릴리프 밸브가 없어 펌프 압력이 과도하게 상승했습니다(210bar). 릴리프 밸브를 설치하세요.');
    }
  }

  // ---------- 1 스텝 ----------
  step(dt) {
    if (!(dt > 1e-6)) return;
    this.t += dt;
    this.frame++;
    this.computeMarks(dt);
    this.solveElec();
    for (const c of this.valves) {
      const st = this.st.get(c.id);
      const net = (pid) => this.portNet.get(c.id + ':' + pid);
      valveUpdate(c, REG[c.type], st, this, { p: (pid) => { const n = net(pid); return n == null ? 0 : this.p[n]; } }, dt);
    }
    this.solveFluid(dt);
    for (const c of this.cyls) {
      const st = this.st.get(c.id);
      const Lm = +c.props.stroke || 100;
      st.x += st.v * 10 * dt;
      if (st.x >= Lm) { st.x = Lm; if (st.v > 0) st.v = 0; }
      if (st.x <= 0) { st.x = 0; if (st.v < 0) st.v = 0; }
    }
    for (const c of this.comps) {
      if (c.type.endsWith('_motor')) {
        const st = this.st.get(c.id);
        st.ang += st.w * 2 * Math.PI * dt;
      }
    }
    this.ps.clear();
    for (const c of this.postComps) REG[c.type].post(c, this.st.get(c.id), this, dt);
    for (const t of this.timers.values()) {
      if (t.mode === 'on') t.acc = t.coil ? t.acc + dt : 0;
      else if (t.coil) { t.acc = 0; t.hold = true; }
      else if (t.hold) { t.acc += dt; if (t.acc >= t.delay) { t.hold = false; t.acc = 0; } }
    }
    for (const t of this.counters.values()) {
      if (t.rst) t.count = 0;
      else if (t.in && !t.prevIn) t.count++;
      t.prevIn = t.in;
    }
    if (this.t - this.histT >= 0.04) {
      this.histT = this.t;
      this.record();
    }
  }

  record() {
    const row = { t: this.t, cyl: {}, sol: {}, relay: {} };
    for (const c of this.cyls) row.cyl[c.props.tag || c.id] = this.st.get(c.id).x / (+c.props.stroke || 100);
    for (const [k, v] of this.sol) if (v) row.sol[k] = 1;
    for (const [k, v] of this.relay) if (v) row.relay[k] = 1;
    this.hist.push(row);
    if (this.hist.length > 6000) this.hist.splice(0, 1000);
  }

  run(seconds, sub = 1 / 240) {
    const steps = Math.round(seconds / sub);
    for (let i = 0; i < steps; i++) this.step(sub);
  }
}
