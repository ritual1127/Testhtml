/* =========================================================
   전기(릴레이) 래더 회로도 – 접점 개폐, 전압/전류 경로 표시
   rung: { top:[contact, (병렬 contact)], ser:[contact], coil:{ref, kind:'relay'|'sol'} }
   contact: { ref, kind:'no'|'nc', act:'pb'|'ls'|'k', mark:true(초기 작동 표시 ⇧) }
   ========================================================= */
(function () {
  const { S, d } = U;
  const RT = 42, R1T = 88, R1B = 128, JY = 168, R2T = 206, R2B = 246, CT = 300, CB = 326, RB = 384, PAR = 58;

  class Ladder {
    constructor(svg, rungs, opts = {}) {
      this.svg = svg;
      this.rungs = rungs;
      this.opts = opts;
      this.wires = [];
      this.contacts = [];
      this.coils = [];
      this.labels = [];
      const gW = S('g'), gF = S('g'), gC = S('g'), gT = S('g');
      this.gW = gW; this.gF = gF;
      svg.append(gW, gF, gC, gT);

      // 레이아웃
      let x = 34;
      const xs = [];
      for (const r of rungs) {
        const main = r.top[0];
        const lp = Math.max(main.act === 'k' ? 40 : 66, r.ser.length ? 40 : 0, 36);
        x += lp;
        xs.push(x);
        x += (r.top.length > 1 ? PAR : 0) + (r.coil.kind === 'sol' ? 48 : 24);
      }
      const W = x + 8, Hh = 410;
      svg.setAttribute('viewBox', `0 0 ${W} ${Hh}`);
      this.W = W;
      const lastX = xs[xs.length - 1] + (rungs[rungs.length - 1].top.length > 1 ? PAR : 0);

      // 레일
      gW.append(S('line', { x1: 20, y1: RT, x2: lastX, y2: RT, class: 'rail' }));
      gW.append(S('line', { x1: 20, y1: RB, x2: lastX, y2: RB, class: 'rail0' }));
      gT.append(S('circle', { cx: 16, cy: RT, r: 4.5, class: 'sym-fill' }), S('circle', { cx: 16, cy: RB, r: 4.5, class: 'sym-fill' }));
      gT.append(S('text', { x: 8, y: RT - 12, class: 'lad-rail-label', text: '+24V' }), S('text', { x: 8, y: RB + 20, class: 'lad-rail-label', text: '0V' }));

      rungs.forEach((r, i) => {
        const X = xs[i];
        r._x = X;
        gT.append(S('text', { x: X, y: RB + 20, 'text-anchor': 'middle', class: 'rung-no', text: String(i + 1) }));
        const dotsAt = [[X, RT], [X, RB]];
        const W_ = (pts, fn) => { this._wire(pts, fn); };
        const hasPar = r.top.length > 1, hasSer = r.ser.length > 0;
        // 메인 상단 접점
        W_([[X, RT], [X, R1T]], st => st.cur && st.c[0] ? 'cur' : 'live');
        this._contact(gC, gT, X, R1T, r.top[0], i, 0);
        if (hasPar) {
          const P = X + PAR;
          dotsAt.push([P, RT], [X, JY]);
          W_([[P, RT], [P, R1T]], st => st.cur && st.c[1] ? 'cur' : 'live');
          this._contact(gC, gT, P, R1T, r.top[1], i, 1);
          W_([[X, R1B], [X, JY]], st => st.c[0] ? (st.cur ? 'cur' : 'live') : 'dead');
          W_([[P, R1B], [P, JY], [X, JY]], st => st.c[1] ? (st.cur ? 'cur' : 'live') : 'dead');
          if (hasSer) {
            W_([[X, JY], [X, R2T]], st => st.j ? (st.cur ? 'cur' : 'live') : 'dead');
            this._contact(gC, gT, X, R2T, r.ser[0], i, 2);
            W_([[X, R2B], [X, CT]], st => st.cur ? 'cur' : (st.top ? 'live' : 'dead'));
          } else {
            W_([[X, JY], [X, CT]], st => st.cur ? 'cur' : (st.j ? 'live' : 'dead'));
          }
        } else if (hasSer) {
          W_([[X, R1B], [X, R2T]], st => st.c[0] ? (st.cur ? 'cur' : 'live') : 'dead');
          this._contact(gC, gT, X, R2T, r.ser[0], i, 2);
          W_([[X, R2B], [X, CT]], st => st.cur ? 'cur' : (st.top ? 'live' : 'dead'));
        } else {
          W_([[X, R1B], [X, CT]], st => st.cur ? 'cur' : (st.top ? 'live' : 'dead'));
        }
        W_([[X, CB], [X, RB]], st => st.cur ? 'cur' : 'dead');
        this._coil(gC, gT, X, r.coil, i);
        for (const [dx, dy] of dotsAt) gT.append(S('circle', { cx: dx, cy: dy, r: 4, class: 'jdot' }));
      });
      this.rungState = rungs.map(() => ({ c: [false, false, false], j: false, top: false, cur: false }));
    }

    _wire(pts, fn) {
      const dd = d(pts);
      const base = S('path', { d: dd, class: 'lw' });
      const flow = S('path', { d: dd, class: 'lw-flow', style: 'display:none' });
      this.gW.append(base);
      this.gF.append(flow);
      this.wires.push({ base, flow, fn, rung: this._curRung, last: '' });
    }

    _contact(gC, gT, x, yt, el, ri, slot) {
      const yb = yt + 40, ym = yt + 20;
      const isPB = el.act === 'pb';
      const g = S('g', { class: 'lcomp' + (isPB ? ' pbtn' : ''), 'data-ref': el.ref });
      const leftExt = el.act === 'k' ? 34 : 62;
      g.append(S('rect', { x: x - leftExt, y: yt - 3, width: leftExt + 22, height: 46, rx: 6, class: 'hit' }));
      const t1 = S('line', { x1: x, y1: yt, x2: x, y2: yt + 9, class: 'term' });
      const t2 = S('line', { x1: x, y1: yb - 9, x2: x, y2: yb, class: 'term' });
      g.append(t1, t2);
      if (el.kind === 'nc') g.append(S('line', { x1: x, y1: yt + 9, x2: x + 9, y2: yt + 9, class: 'term' }));
      const blade = S('line', { x1: x, y1: yb - 9, x2: x, y2: yt + 9, class: 'blade' });
      blade.style.transformOrigin = `${x}px ${yb - 9}px`;
      g.append(blade);
      if (el.act === 'pb') {
        g.append(S('path', { d: `M${x - 22} ${ym - 7} L${x - 27} ${ym - 7} L${x - 27} ${ym + 7} L${x - 22} ${ym + 7} M${x - 27} ${ym} L${x - 24} ${ym}`, class: 'act' }));
        g.append(S('line', { x1: x - 22, y1: ym, x2: x - 5, y2: ym, class: 'act-dash' }));
      } else if (el.act === 'ls') {
        g.append(S('circle', { cx: x - 30, cy: ym, r: 5, class: 'act' }));
        g.append(S('line', { x1: x - 25, y1: ym, x2: x - 5, y2: ym, class: 'act-dash' }));
        if (el.mark) {
          g.append(S('path', { d: `M${x - 30} ${ym - 8} L${x - 30} ${ym - 22} M${x - 35} ${ym - 16} L${x - 30} ${ym - 23} L${x - 25} ${ym - 16}`, class: 'act' }));
        }
      }
      const lx = el.act === 'k' ? x - 10 : x - 40;
      const lt = S('text', { x: lx, y: ym + 5, 'text-anchor': 'end', class: 'lad-label', text: el.ref, 'data-ref': el.ref });
      const ab = S('text', { x: x + 12, y: yb - 3, class: 'lad-ab', text: el.kind === 'nc' ? 'b' : 'a' });
      gT.append(lt, ab);
      this.labels.push({ ref: el.ref, x: lx, y: ym + 5, el: lt, ab, g, ri, slot, kind: el.kind });
      gC.append(g);
      if (isPB && this.opts.onPB) {
        const dn = e => { e.preventDefault(); this.opts.onPB(true, el.ref); };
        const up = () => this.opts.onPB(false, el.ref);
        g.addEventListener('pointerdown', dn);
        g.addEventListener('pointerup', up);
        g.addEventListener('pointerleave', up);
        g.addEventListener('pointercancel', up);
      }
      this.contacts.push({ el, blade, t1, t2, ri, slot, last: '' });
    }

    _coil(gC, gT, x, coil, ri) {
      const g = S('g', { class: 'lcomp', 'data-ref': coil.ref });
      g.append(S('rect', { x: x - 44, y: CT - 6, width: coil.kind === 'sol' ? 92 : 66, height: 38, rx: 6, class: 'hit' }));
      const m0 = (CT + CB) / 2;
      const rect = coil.kind === 'lamp'
        ? S('circle', { cx: x, cy: m0, r: 14, class: 'coil' })
        : S('rect', { x: x - 17, y: CT, width: 34, height: CB - CT, class: 'coil' });
      g.append(rect);
      if (coil.kind === 'lamp') {
        g.append(S('line', { x1: x - 9, y1: m0 - 9, x2: x + 9, y2: m0 + 9, class: 'coil-diag' }), S('line', { x1: x - 9, y1: m0 + 9, x2: x + 9, y2: m0 - 9, class: 'coil-diag' }));
      }
      if (coil.kind === 'sol') {
        g.append(S('line', { x1: x - 11, y1: CB - 4, x2: x + 11, y2: CT + 4, class: 'coil-diag' }));
        const m = (CT + CB) / 2;
        g.append(S('line', { x1: x + 17, y1: m, x2: x + 26, y2: m, class: 'act-dash' }));
        g.append(S('path', { d: `M${x + 26} ${CT + 1} L${x + 38} ${CT + 1} L${x + 26} ${CB - 1} L${x + 38} ${CB - 1} Z`, class: 'act' }));
        g.append(S('line', { x1: x + 32, y1: CT - 5, x2: x + 32, y2: CT + 1, class: 'act' }), S('line', { x1: x + 32, y1: CB - 1, x2: x + 32, y2: CB + 5, class: 'act' }));
      }
      const lt = S('text', { x: x - 23, y: CT + 18, 'text-anchor': 'end', class: 'lad-label', text: coil.ref, 'data-ref': coil.ref });
      gT.append(lt);
      this.labels.push({ ref: coil.ref, x: x - 23, y: CT + 18, el: lt, g, ri, slot: 'c', kind: coil.kind });
      gC.append(g);
      this.coils.push({ coil, rect, ri, last: '' });
    }

    /** sim: { closed(el), coilOn(ref), coilPending(ref) } */
    update(sim) {
      this.rungs.forEach((r, i) => {
        const st = this.rungState[i];
        st.c[0] = sim.closed(r.top[0]);
        st.c[1] = r.top[1] ? sim.closed(r.top[1]) : false;
        st.j = st.c[0] || st.c[1];
        st.c[2] = r.ser[0] ? sim.closed(r.ser[0]) : true;
        st.top = st.j && st.c[2];
        st.cur = st.top;
      });
      // 배선 – 어떤 rung에 속하는지: 생성 순서대로 rung별 묶음
      let wi = 0;
      this.rungs.forEach((r, i) => {
        const n = this._wireCount(r);
        for (let k = 0; k < n; k++, wi++) {
          const w = this.wires[wi];
          const cls = w.fn(this.rungState[i]);
          if (cls !== w.last) {
            w.last = cls;
            w.base.setAttribute('class', 'lw ' + cls);
            w.flow.style.display = cls === 'cur' ? '' : 'none';
          }
        }
      });
      for (const c of this.contacts) {
        const closed = sim.closed(c.el);
        const st = this.rungState[c.ri];
        const onPath = st.cur && closed && (c.slot === 2 || st.c[c.slot]);
        const key = closed + '|' + onPath;
        if (key === c.last) continue;
        c.last = key;
        const ang = c.el.kind === 'nc' ? (closed ? 24 : -14) : (closed ? 0 : -28);
        c.blade.style.transform = `rotate(${ang}deg)`;
        c.blade.setAttribute('class', 'blade' + (onPath ? ' cur' : ''));
        c.t1.setAttribute('class', 'term' + (onPath ? ' cur' : ''));
        c.t2.setAttribute('class', 'term' + (onPath ? ' cur' : ''));
      }
      for (const c of this.coils) {
        const on = sim.coilOn(c.coil.ref);
        const pend = sim.coilPending(c.coil.ref);
        const key = on + '|' + pend;
        if (key === c.last) continue;
        c.last = key;
        c.rect.setAttribute('class', 'coil' + (on ? ' on' : '') + (pend ? ' pend' : ''));
      }
    }
    _wireCount(r) {
      const hasPar = r.top.length > 1, hasSer = r.ser.length > 0;
      if (hasPar) return 4 + (hasSer ? 2 : 1) + 1;
      return 1 + (hasSer ? 2 : 1) + 1;
    }
  }

  window.Ladder = Ladder;
})();
