/* =========================================================
   유압 회로 기호 (ISO 1219 스타일) – SVG 드로잉 & 상태 애니메이션
   ========================================================= */
(function () {
  const { S, d, zigH, zigV, arrowHead, poly, textW, clamp } = U;

  /* ---------- 다이어그램 컨테이너 ---------- */
  class HydDiagram {
    constructor(svg, w, h) {
      this.svg = svg;
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      this.gLines = S('g');
      this.gFlow = S('g');
      this.gSym = S('g');
      this.gDots = S('g');
      this.gTag = S('g');
      svg.append(this.gLines, this.gFlow, this.gSym, this.gDots, this.gTag);
      this.lines = {};
      this.tags = [];
      this.plains = [];
      this.W = w; this.H = h;
    }
    /** 배관 라인: pts 순서가 '기준 방향'(dir=+1) */
    line(id, pts, opt = {}) {
      const dd = typeof pts === 'string' ? pts : d(pts);
      const base = S('path', { d: dd, class: 'hl-base' + (opt.pilot ? ' pilotline' : '') });
      const flow = S('path', { d: dd, class: 'hl-flow', style: 'display:none' });
      this.gLines.append(base);
      this.gFlow.append(flow);
      this.lines[id] = { base, flow, pilot: !!opt.pilot, key: '' };
    }
    /** 라인 상태: s = idle|p|ps|r|rs|lock|pilot|suc, dir = +1/-1/0, v = 흐름 속도 */
    setLine(id, s = 'idle', dir = 0, v = 1) {
      const L = this.lines[id];
      if (!L) return;
      const key = s + '|' + dir + '|' + v.toFixed(2);
      if (L.key === key) return;
      L.key = key;
      L.base.setAttribute('class', 'hl-base' + (L.pilot ? ' pilotline' : '') + (s !== 'idle' ? ' s-' + s : ''));
      if (dir) {
        L.flow.style.display = '';
        L.flow.style.animationDirection = dir > 0 ? 'normal' : 'reverse';
        L.flow.style.animationDuration = (0.85 / Math.max(0.18, v)).toFixed(2) + 's';
      } else {
        L.flow.style.display = 'none';
      }
    }
    applyLines(map) {
      for (const id in this.lines) {
        const st = map[id];
        if (st) this.setLine(id, st[0], st[1] || 0, st[2] == null ? 1 : st[2]);
        else this.setLine(id, 'idle', 0, 1);
      }
    }
    dot(x, y) { this.gDots.append(S('circle', { cx: x, cy: y, r: 4.3, class: 'jdot' })); }
    comp(ref, parent) {
      const g = S('g', { class: 'comp', 'data-ref': ref });
      (parent || this.gSym).append(g);
      return g;
    }
    hit(g, x, y, w, h) {
      g.insertBefore(S('rect', { x, y, width: w, height: h, rx: 7, class: 'hit' }), g.firstChild);
    }
    label(x, y, text, cls = 'svg-label', anchor = 'start') {
      const t = S('text', { x, y, class: cls, 'text-anchor': anchor, text });
      this.gTag.append(t);
      return t;
    }
    /** 번호 태그 (시험지 빈칸) */
    tag({ num, name, x, y, ref, anchor = 'start' }) {
      const g = S('g', { class: 'tag', 'data-ref': ref });
      const bg = S('rect', { y: y - 15, height: 21, rx: 6, class: 'tag-bg' });
      const tn = S('text', { y: y + 1, class: 'tag-num', text: num });
      const tx = S('text', { y, class: 'tag-name', text: name });
      g.append(bg, tn, tx);
      this.gTag.append(g);
      const T = { g, bg, tn, tx, name, num, x, y, anchor, ref };
      this.tags.push(T);
      this._layoutTag(T, name);
      return T;
    }
    _layoutTag(T, name) {
      const numW = 17;
      const w = numW + textW(name, 13) + 14;
      const x0 = T.anchor === 'end' ? T.x - w : T.x;
      T.bg.setAttribute('x', x0);
      T.bg.setAttribute('width', w);
      T.tn.setAttribute('x', x0 + 6);
      T.tx.setAttribute('x', x0 + 6 + numW);
    }
    /** 회색 이름표 (시험지 빈칸이 아닌 부품) */
    plain(text, x, y, ref, anchor = 'start') {
      const t = S('text', { x, y, class: 'plain-name', 'text-anchor': anchor, 'data-ref': ref, text });
      t.style.cursor = 'pointer';
      this.gTag.append(t);
      this.plains.push({ x, y, ref, anchor, el: t, text });
      return t;
    }
    setQuiz(on) {
      for (const T of this.tags) {
        const name = on ? '?' : T.name;
        T.tx.textContent = name;
        T.tx.classList.toggle('q', on);
        this._layoutTag(T, name);
      }
    }
  }

  /* ---------- 공통 작은 기호들 ---------- */
  function tank(D, x, y) {
    D.gSym.append(S('path', { d: `M${x - 11} ${y} L${x - 11} ${y + 12} L${x + 11} ${y + 12} L${x + 11} ${y}`, class: 'sym' }));
  }

  function Check(parent, x, y, dir) {
    const up = dir === 'up';
    const vy = up ? y + 11 : y - 11;
    const ay = up ? y - 3 : y + 3;
    parent.append(S('path', { d: `M${x - 10} ${ay} L${x} ${vy} L${x + 10} ${ay}`, class: 'sym' }));
    const ball = S('circle', { cx: x, cy: y, r: 6.5, class: 'ball' });
    parent.append(ball);
    let last = null;
    return {
      set(open) {
        open = !!open;
        if (open === last) return;
        last = open;
        ball.classList.toggle('open', open);
        ball.style.transform = open ? `translate(0px, ${up ? -6 : 6}px)` : '';
      }
    };
  }

  function throttle(g, x, cy, flip) {
    g.append(S('path', { d: `M${x - 9} ${cy - 16} Q${x + 1} ${cy} ${x - 9} ${cy + 16}`, class: 'sym' }));
    g.append(S('path', { d: `M${x + 9} ${cy - 16} Q${x - 1} ${cy} ${x + 9} ${cy + 16}`, class: 'sym' }));
    const a = flip ? [[x + 18, cy + 13], [x - 20, cy - 13]] : [[x - 18, cy - 13], [x + 21, cy + 15]];
    const ang = Math.atan2(a[1][1] - a[0][1], a[1][0] - a[0][0]);
    g.append(S('line', { x1: a[0][0], y1: a[0][1], x2: a[1][0] - Math.cos(ang) * 6, y2: a[1][1] - Math.sin(ang) * 6, class: 'sym-thin' }));
    g.append(S('polygon', { points: poly(arrowHead(a[1][0], a[1][1], ang, 8, 3.6)), class: 'sym-solid' }));
  }

  /* ---------- 복동 실린더 ---------- */
  function Cylinder(D, c) {
    const { ref = 'cyl', x, y, w, h, stroke, rodOut, headPortX, rodPortX, label = 'A' } = c;
    const g = D.comp(ref);
    const cy = y + h / 2;
    D.hit(g, x - 8, y - 20, w + rodOut + stroke + 18, h + 28);
    const chH = S('rect', { x: x + 2, y: y + 2, height: h - 4, width: 1, class: 'chamber' });
    const chR = S('rect', { x: x + 2, y: y + 2, height: h - 4, width: 1, class: 'chamber' });
    const barrel = S('rect', { x, y, width: w, height: h, class: 'sym' });
    const rod = S('rect', { y: cy - 7, height: 14, width: 1, class: 'rod' });
    const dog = S('rect', { y: cy - 16, width: 20, height: 9, rx: 2, class: 'dog' });
    const clevis = S('circle', { cy, r: 5.5, class: 'sym-fill' });
    const pis = S('rect', { y: y + 2, width: 14, height: h - 4, class: 'piston' });
    const ca = [[x + 6, y + h - 5], [x + 42, y + 5]];
    const cang = Math.atan2(ca[1][1] - ca[0][1], ca[1][0] - ca[0][0]);
    const tri = px => S('polygon', { points: poly([[px, y + h - 8], [px - 5, y + h - 1], [px + 5, y + h - 1]]), class: 'sym-solid' });
    g.append(chH, chR, barrel, rod, dog, clevis, pis,
      S('line', { x1: ca[0][0], y1: ca[0][1], x2: ca[1][0] - Math.cos(cang) * 6, y2: ca[1][1] - Math.sin(cang) * 6, class: 'sym-thin' }),
      S('polygon', { points: poly(arrowHead(ca[1][0], ca[1][1], cang, 8, 3.4)), class: 'sym-solid' }),
      tri(headPortX), tri(rodPortX));
    D.label(x + 4, y - 9, label);
    const rodEnd = s => x + w + rodOut + s * stroke;
    let lastKey = '';
    return {
      rodEnd,
      lsX: s => rodEnd(s) - 12,
      dogTop: cy - 16,
      update(s, chamberHead, chamberRod) {
        const key = s.toFixed(4) + chamberHead + chamberRod;
        if (key === lastKey) return;
        lastKey = key;
        const px = x + 16 + s * stroke;
        const re = rodEnd(s);
        pis.setAttribute('x', px);
        chH.setAttribute('width', Math.max(0, px - (x + 2)));
        chR.setAttribute('x', px + 14);
        chR.setAttribute('width', Math.max(0, x + w - 2 - (px + 14)));
        rod.setAttribute('x', px + 14);
        rod.setAttribute('width', re - (px + 14));
        dog.setAttribute('x', re - 22);
        clevis.setAttribute('cx', re);
        chH.setAttribute('class', 'chamber' + (chamberHead && chamberHead !== 'idle' ? ' c-' + chamberHead : ''));
        chR.setAttribute('class', 'chamber' + (chamberRod && chamberRod !== 'idle' ? ' c-' + chamberRod : ''));
      }
    };
  }

  /* ---------- 리밋 스위치 ---------- */
  function LimitSwitch(D, { ref, x, rollerY, label }) {
    const g = D.comp(ref);
    const bb = rollerY - 40, bt = bb - 30;
    D.hit(g, x - 44, bt - 26, 66, rollerY - bt + 34);
    g.append(S('path', { d: d(zigV(x, bt, bt - 22, 6, 6)), class: 'spring' }));
    const box = S('rect', { x: x - 15, y: bt, width: 30, height: 30, class: 'ls-box' });
    g.append(box);
    g.append(S('line', { x1: x - 15, y1: bb, x2: x + 15, y2: bt, class: 'sym-thin' }));
    g.append(S('path', { d: `M${x - 10} ${bt + 8} L${x - 1} ${bt + 8} L${x + 7} ${bt + 3}`, class: 'sym-thin' }));
    const pl = S('g', { class: 'ls-plunger' });
    const roller = S('circle', { cx: x, cy: rollerY, r: 5, class: 'ls-roller' });
    pl.append(S('line', { x1: x, y1: bb, x2: x, y2: rollerY - 5, class: 'sym' }), roller);
    g.append(pl);
    D.label(x - 21, bt + 21, label, 'svg-label', 'end');
    let last = null;
    return {
      update(on) {
        if (on === last) return;
        last = on;
        pl.style.transform = on ? 'translate(0px,-6px)' : '';
        box.classList.toggle('on', on);
        roller.classList.toggle('on', on);
      }
    };
  }

  /* ---------- 방향 전환 밸브 (n포트 m위치) ----------
     squares: 왼쪽→오른쪽 사각형 목록. 각 항목:
       ['a', from, to]  화살표(흐름)   ['d', p1, p2] 양방향 화살표   ['b', port] 막힘(⊥/⊤)
     ports: { A:[0.25,'t'], ... }  home: 포트에 맞춰진(평상시) 사각형 번호 */
  function DirValve(D, c) {
    const { ref, x0, y, w = 72, h = 52, squares, home, ports, left = [], right = [], labelL, labelR, refL, refR } = c;
    const g = D.comp(ref);
    const body = S('g', { class: 'v-body' });
    g.append(body);
    const sqEls = [];
    const itemEls = [];
    squares.forEach((items, i) => {
      const sg = S('g', { transform: `translate(${x0 + i * w},${y})` });
      const rect = S('rect', { x: 0, y: 0, width: w, height: h, class: 'v-sq' });
      sg.append(rect);
      const its = [];
      for (const it of items) {
        const [type, a, b] = it;
        if (type === 'a' || type === 'd') {
          const pa = ports[a], pb = ports[b];
          const x1 = pa[0] * w, y1 = pa[1] === 't' ? 3 : h - 3;
          const x2 = pb[0] * w, y2 = pb[1] === 't' ? 3 : h - 3;
          const ang = Math.atan2(y2 - y1, x2 - x1);
          const off = 7;
          const sx = type === 'd' ? x1 + Math.cos(ang) * off : x1;
          const sy = type === 'd' ? y1 + Math.sin(ang) * off : y1;
          const ln = S('line', { x1: sx, y1: sy, x2: x2 - Math.cos(ang) * off, y2: y2 - Math.sin(ang) * off, class: 'v-item' });
          const els = [ln, S('polygon', { points: poly(arrowHead(x2, y2, ang)), class: 'v-head' })];
          if (type === 'd') els.push(S('polygon', { points: poly(arrowHead(x1, y1, ang + Math.PI)), class: 'v-head' }));
          sg.append(...els);
          its.push({ keys: type === 'd' ? [a + '>' + b, b + '>' + a] : [a + '>' + b], els });
        } else if (type === 'b') {
          const p = ports[a];
          const px = p[0] * w, top = p[1] === 't';
          const ye = top ? 0 : h, ys = top ? 13 : h - 13;
          const els = [S('line', { x1: px, y1: ye, x2: px, y2: ys, class: 'v-item' }),
            S('line', { x1: px - 8, y1: ys, x2: px + 8, y2: ys, class: 'v-item' })];
          sg.append(...els);
          its.push({ keys: ['x' + a], els });
        }
      }
      body.append(sg);
      sqEls.push(rect);
      itemEls.push(its);
    });
    const midY = y + h / 2;
    const sol = {};
    const addSol = (xa, side, sref) => {
      const sg = sref ? S('g', { class: 'comp', 'data-ref': sref }) : S('g');
      const r = S('rect', { x: xa, y: midY - 15, width: 24, height: 30, class: 'solenoid' });
      sg.append(r, S('line', { x1: xa + 4, y1: midY + 11, x2: xa + 20, y2: midY - 11, class: 'sol-diag' }));
      body.append(sg);
      sol[side] = r;
    };
    let xl = x0;
    for (const k of left) {
      if (k === 'spring') { body.append(S('path', { d: d(zigH(xl, xl - 28, midY, 8, 6)), class: 'spring' })); xl -= 28; }
      else { addSol(xl - 24, 'L', refL); xl -= 24; }
    }
    let xr = x0 + squares.length * w;
    for (const k of right) {
      if (k === 'spring') { body.append(S('path', { d: d(zigH(xr, xr + 28, midY, 8, 6)), class: 'spring' })); xr += 28; }
      else { addSol(xr, 'R', refR); xr += 24; }
    }
    if (labelL) body.append(S('text', { x: xl - 6, y: midY + 6, 'text-anchor': 'end', class: 'svg-label', text: labelL }));
    if (labelR) body.append(S('text', { x: xr + 6, y: midY + 6, 'text-anchor': 'start', class: 'svg-label', text: labelR }));
    body.insertBefore(S('rect', { x: xl - 30, y: y - 5, width: xr - xl + 60, height: h + 10, rx: 7, class: 'hit' }), body.firstChild);
    let lastKey = '';
    return {
      update(pos, solOn = {}, flows = {}) {
        const key = pos + '|' + !!solOn.L + !!solOn.R + '|' + JSON.stringify(flows);
        if (key === lastKey) return;
        lastKey = key;
        body.style.transform = `translate(${(home - pos) * w}px,0px)`;
        sqEls.forEach((r, i) => r.classList.toggle('active', i === pos));
        if (sol.L) sol.L.classList.toggle('on', !!solOn.L);
        if (sol.R) sol.R.classList.toggle('on', !!solOn.R);
        itemEls.forEach((its, i) => its.forEach(it => {
          let f = null;
          if (i === pos) for (const k of it.keys) if (flows[k]) { f = flows[k]; break; }
          for (const e of it.els) e.setAttribute('class', (e.tagName === 'polygon' ? 'v-head' : 'v-item') + (f ? ' f-' + f : ''));
        }));
      }
    };
  }

  /* ---------- 파일럿 작동 체크 밸브 ---------- */
  function PilotCheck(D, { ref, x, yTop, yBot }) {
    const g = D.comp(ref);
    D.hit(g, x - 26, yTop - 3, 52, yBot - yTop + 6);
    g.append(S('rect', { x: x - 22, y: yTop, width: 44, height: yBot - yTop, class: 'sym' }));
    const by = yBot - 20;
    g.append(S('path', { d: d(zigV(x, yTop + 8, by - 8, 8, 7)), class: 'spring' }));
    const chk = Check(g, x, by, 'up');
    return { update(open) { chk.set(open); } };
  }

  /* ---------- 일방향 유량제어 밸브 (교축 + 체크 병렬) ---------- */
  function OneWayFCV(D, { ref, x, cy, box, bypassX, checkDir, flipArrow }) {
    const g = D.comp(ref);
    const [x1, y1, x2, y2] = box;
    D.hit(g, x1 - 3, y1 - 3, x2 - x1 + 6, y2 - y1 + 6);
    g.append(S('rect', { x: x1, y: y1, width: x2 - x1, height: y2 - y1, class: 'sym' }));
    throttle(g, x, cy, flipArrow);
    const chk = Check(g, bypassX, cy, checkDir);
    return { update(open) { chk.set(open); } };
  }

  /* ---------- 압력보상형 유량제어 밸브 ---------- */
  function PCFCV(D, { ref, x, yTop, yBot }) {
    const g = D.comp(ref);
    D.hit(g, x - 24, yTop - 3, 48, yBot - yTop + 6);
    g.append(S('rect', { x: x - 21, y: yTop, width: 42, height: yBot - yTop, class: 'sym' }));
    g.append(S('polygon', { points: poly(arrowHead(x, yTop + 6, -Math.PI / 2, 10, 4.5)), class: 'sym-solid' }));
    throttle(g, x, (yTop + yBot) / 2 + 4, true);
    return { update() {} };
  }

  /* ---------- 압력 릴리프 밸브 ---------- */
  function Relief(D, { ref, orient, x, y }) {
    const g = D.comp(ref);
    const ag = S('g', { class: 'relief-arrow' });
    let pil, shift;
    if (orient === 'v') {
      D.hit(g, x - 34, y - 34, 80, 62);
      g.append(S('rect', { x: x - 18, y: y - 22, width: 36, height: 44, class: 'sym-fill' }));
      ag.append(S('line', { x1: x - 9, y1: y - 16, x2: x - 9, y2: y + 9, class: 'ra-line' }),
        S('polygon', { points: poly(arrowHead(x - 9, y + 17, Math.PI / 2, 9, 4.2)), class: 'ra-head' }));
      g.append(ag);
      g.append(S('path', { d: d(zigH(x + 18, x + 42, y, 7, 6)), class: 'spring' }));
      pil = S('path', { d: `M${x} ${y - 30} L${x - 30} ${y - 30} L${x - 30} ${y - 6} L${x - 18} ${y - 6}`, class: 'sym-dash' });
      shift = 'translate(9px,0px)';
    } else {
      D.hit(g, x - 28, y - 38, 72, 88);
      g.append(S('rect', { x: x - 24, y: y - 20, width: 48, height: 40, class: 'sym-fill' }));
      ag.append(S('line', { x1: x + 16, y1: y - 9, x2: x - 8, y2: y - 9, class: 'ra-line' }),
        S('polygon', { points: poly(arrowHead(x - 16, y - 9, Math.PI, 9, 4.2)), class: 'ra-head' }));
      g.append(ag);
      g.append(S('path', { d: d(zigV(x, y + 20, y + 46, 7, 6)), class: 'spring' }));
      pil = S('path', { d: `M${x + 36} ${y} L${x + 36} ${y - 34} L${x} ${y - 34} L${x} ${y - 20}`, class: 'sym-dash' });
      shift = 'translate(0px,9px)';
    }
    g.append(pil);
    let last = '';
    return {
      update(open, pressurized, returnFlow) {
        const k = !!open + '|' + !!pressurized + '|' + !!returnFlow;
        if (k === last) return;
        last = k;
        ag.classList.toggle('open', !!open);
        ag.classList.toggle('fr', !!returnFlow);
        ag.style.transform = open ? shift : '';
        pil.classList.toggle('on', !!pressurized);
      }
    };
  }

  /* ---------- 압력계 ---------- */
  function Gauge(D, { ref, x, y, r = 13, vx, vy }) {
    const g = D.comp(ref);
    D.hit(g, x - r - 4, y - r - 4, 2 * r + 8, 2 * r + 8);
    g.append(S('circle', { cx: x, cy: y, r, class: 'gauge-face' }));
    for (const a of [-120, -60, 0, 60, 120]) {
      const rad = (a - 90) * Math.PI / 180;
      g.append(S('line', { x1: x + Math.cos(rad) * (r - 4), y1: y + Math.sin(rad) * (r - 4), x2: x + Math.cos(rad) * (r - 1.5), y2: y + Math.sin(rad) * (r - 1.5), class: 'gauge-tick' }));
    }
    const needle = S('line', { x1: x, y1: y, x2: x, y2: y - r + 3, class: 'gauge-needle' });
    needle.style.transformOrigin = `${x}px ${y}px`;
    g.append(needle, S('circle', { cx: x, cy: y, r: 2.2, class: 'sym-solid' }));
    const vg = S('g');
    const bg = S('rect', { x: vx - 30, y: vy - 12, width: 60, height: 18, rx: 6, class: 'val-bg' });
    const tx = S('text', { x: vx, y: vy + 2, 'text-anchor': 'middle', class: 'svg-val', text: '0.0 MPa' });
    vg.append(bg, tx);
    D.gTag.append(vg);
    let last = -1;
    return {
      update(mpa) {
        const v = Math.round(mpa * 10) / 10;
        if (v === last) return;
        last = v;
        needle.style.transform = `rotate(${-120 + clamp(v / 8, 0, 1) * 240}deg)`;
        tx.textContent = v.toFixed(1) + ' MPa';
      }
    };
  }

  /* ---------- 유압 동력 발생장치 + 시스템 릴리프 밸브 + 압력계 ----------
     px: 펌프 x, my: 메인 라인 y.  메인 라인 왼쪽 끝(110, my)에 릴리프 밸브 */
  function Supply(D, { px, my, numbered }) {
    const jy = my + 80, gx = px - 66, ty = my + 226;
    // 라인
    D.line('pu_out', [[px, my + 124], [px, jy]]);
    D.line('pu_up', [[px, jy], [px, my]]);
    D.line('pu_br', [[px, jy], [gx, jy]]);
    D.line('pu_g', [[gx, jy], [gx, jy - 14]]);
    D.line('pu_rin', [[gx, jy], [gx, jy + 22]]);
    D.line('pu_rout', [[gx, jy + 66], [gx, ty - 2]]);
    D.line('suc1', [[px, ty - 2], [px, my + 209]]);
    D.line('suc2', [[px, my + 187], [px, my + 176]]);
    D.line('m_l', [[px, my], [170, my], [110, my]]);
    D.line('g9', [[170, my], [170, my - 23]]);
    D.line('rl_out', [[62, my], [40, my], [40, my + 20]]);
    D.dot(px, my); D.dot(px, jy); D.dot(170, my);
    tank(D, 40, my + 10);

    // 파워 유닛
    const g = D.comp('pu');
    D.hit(g, px - 128, my + 38, 260, 202);
    g.append(S('rect', { x: px - 128, y: my + 38, width: 260, height: 202, rx: 4, class: 'box-dash' }));
    g.append(S('path', { d: `M${px - 110} ${my + 204} L${px - 110} ${ty} L${px + 66} ${ty} L${px + 66} ${my + 204}`, class: 'sym' }));
    g.append(S('circle', { cx: px, cy: my + 150, r: 26, class: 'sym-fill' }));
    g.append(S('polygon', { points: poly([[px, my + 125], [px - 8, my + 138], [px + 8, my + 138]]), class: 'sym-solid' }));
    g.append(S('circle', { cx: px, cy: my + 150, r: 11, class: 'sym-dash spin', style: 'stroke-dasharray:4 4' }));
    // 모터
    const mx = px + 98;
    g.append(S('line', { x1: px + 26, y1: my + 146, x2: mx - 20, y2: my + 146, class: 'sym' }),
      S('line', { x1: px + 26, y1: my + 154, x2: mx - 20, y2: my + 154, class: 'sym' }),
      S('line', { x1: px + 50, y1: my + 141, x2: px + 50, y2: my + 159, class: 'sym' }));
    g.append(S('circle', { cx: mx, cy: my + 150, r: 20, class: 'sym-fill' }));
    g.append(S('text', { x: mx, y: my + 157, 'text-anchor': 'middle', class: 'svg-label', text: 'M', style: 'font-size:19px' }));
    // 필터
    g.append(S('path', { d: `M${px} ${my + 187} L${px + 11} ${my + 198} L${px} ${my + 209} L${px - 11} ${my + 198} Z`, class: 'sym-fill' }));
    g.append(S('line', { x1: px - 9, y1: my + 198, x2: px + 9, y2: my + 198, class: 'sym-dash', style: 'stroke-dasharray:3 2' }));
    // 내부 릴리프 & 압력계
    const ir = Relief(D, { ref: 'pu', orient: 'v', x: gx, y: jy + 44 });
    // Relief()가 만든 그룹을 파워유닛 그룹 안으로
    const irG = D.gSym.lastChild; g.append(irG); irG.removeAttribute('data-ref'); irG.setAttribute('class', '');
    const irHit = irG.querySelector('.hit'); if (irHit) irHit.remove();
    const gpu = Gauge(D, { ref: 'gpu', x: gx, y: jy - 26, r: 12, vx: gx - 46, vy: jy - 26 });

    // 시스템 릴리프 밸브 + 압력계
    const rl = Relief(D, { ref: 'relief', orient: 'h', x: 86, y: my });
    const g9 = Gauge(D, { ref: 'g9', x: 170, y: my - 36, r: 13, vx: 170, vy: my - 62 });

    if (numbered) {
      D.tag({ num: '⑦', name: '압력 릴리프 밸브', x: 8, y: my + 72, ref: 'relief' });
      D.tag({ num: '⑧', name: '유압 동력 발생장치', x: px + 140, y: my + 112, ref: 'pu' });
      D.tag({ num: '⑨', name: '압력계', x: 190, y: my - 30, ref: 'g9' });
    } else {
      D.plain('릴리프 밸브', 8, my + 72, 'relief');
      D.plain('유압 파워 유닛', px + 140, my + 112, 'pu');
      D.plain('압력계', 190, my - 30, 'g9');
    }
    return {
      /** 공급부 라인 상태 적용 */
      lines(L, pump, reliefOpen) {
        L.pu_out = ['p', 1, 1];
        L.pu_up = ['p', 1, 1];
        L.pu_br = ['ps', 0];
        L.pu_g = ['ps', 0];
        L.pu_rin = ['ps', 0];
        L.suc1 = ['suc', 1, 1];
        L.suc2 = ['suc', 1, 1];
        L.m_l = reliefOpen ? ['p', 1, 1] : ['ps', 0];
        L.g9 = ['ps', 0];
        L.rl_out = reliefOpen ? ['r', 1, 1] : ['idle', 0];
      },
      update(pump, reliefOpen) {
        ir.update(false, true);
        rl.update(reliefOpen, true);
        gpu.update(pump);
        g9.update(pump);
      }
    };
  }

  window.HYD = { HydDiagram, Cylinder, LimitSwitch, DirValve, PilotCheck, OneWayFCV, PCFCV, Relief, Gauge, Supply, tank, Check, throttle };
})();
