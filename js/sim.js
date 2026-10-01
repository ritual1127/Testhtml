/* =========================================================
   시뮬레이션 엔진 + 과제 화면(TaskView)
   ========================================================= */
(function () {
  const { H, S, clamp } = U;
  const BASE_RATE = 1 / 2.4; // 속도 1.0일 때 초당 행정 비율

  /* ---------------- 시뮬레이션 엔진 ---------------- */
  class Sim {
    constructor(task) {
      this.task = task;
      this.relayDelay = 0.22;
      this.valveDelay = 0.16;
      this.listeners = [];
      this.reset();
    }
    on(fn) { this.listeners.push(fn); }
    emit(kind, text) {
      const e = { t: this.t, kind, text };
      this.log.push(e);
      for (const f of this.listeners) f(e);
    }
    reset() {
      const T = this.task;
      this.t = 0;
      this.pb = false; this.pbHeld = false; this.pbMinUntil = 0;
      this.relays = {}; T.relays.forEach(k => { this.relays[k] = { on: false, pend: null }; });
      this.sols = {}; T.sols.forEach(k => { this.sols[k] = false; });
      this.valves = {};
      for (const id in T.valves) { const v = T.valves[id]; this.valves[id] = { pos: v.home, target: v.home, at: 0 }; }
      this.s = 0; this.motion = 0; this.log = []; this.cycles = 0;
      this.ls = {}; for (const k in T.ls) this.ls[k] = this.lsHit(k);
      for (let i = 0; i < 30; i++) if (!this.evalLadder(true)) break;
      for (const id in T.valves) { const tg = T.valves[id].target(this.sols); this.valves[id].pos = this.valves[id].target = tg; }
      this.hyd = T.resolve(this);
      this.disp = { pump: this.hyd.pump, rodp: this.hyd.rodp || 0 };
      this.phase = T.phase(this);
      this.idleSince = 0;
    }
    lsHit(k) {
      const p = this.task.ls[k], s = this.s;
      if (p <= 0) return s <= 0.015;
      if (p >= 1) return s >= 0.985;
      return Math.abs(s - p) <= 0.05;
    }
    isActuated(ref) {
      if (ref === 'PB1') return this.pb;
      if (ref in this.ls) return this.ls[ref];
      if (ref in this.relays) return this.relays[ref].on;
      return false;
    }
    closed(el) { const a = this.isActuated(el.ref); return el.kind === 'nc' ? !a : a; }
    coilOn(ref) { return ref in this.relays ? this.relays[ref].on : !!this.sols[ref]; }
    coilPending(ref) { const R = this.relays[ref]; return !!(R && R.pend); }
    rungOn(r) {
      return (this.closed(r.top[0]) || (!!r.top[1] && this.closed(r.top[1]))) && r.ser.every(e => this.closed(e));
    }
    /** 래더 평가 (동시 평가). 릴레이는 지연 후 동작, 솔레노이드는 즉시 */
    evalLadder(instant) {
      let changed = false;
      const res = this.task.ladder.map(r => this.rungOn(r));
      this.task.ladder.forEach((r, i) => {
        const on = res[i], ref = r.coil.ref;
        if (r.coil.kind === 'relay') {
          const R = this.relays[ref];
          if (instant) { if (R.on !== on) { R.on = on; changed = true; } R.pend = null; return; }
          if (on && !R.on) { if (!R.pend) R.pend = { target: true, at: this.t + this.relayDelay }; }
          else if (!on && R.on) { if (!R.pend) R.pend = { target: false, at: this.t + this.relayDelay }; }
          else if (on && R.on && R.pend && R.pend.target === false) R.pend = null;
        } else if (this.sols[ref] !== on) {
          this.sols[ref] = on; changed = true;
          if (!instant) this.emit('sol', `${ref} ${on ? '통전 (ON)' : '소자 (OFF)'}`);
        }
      });
      return changed;
    }
    pressPB(down) {
      if (down) {
        this.pbHeld = true;
        if (!this.pb) { this.pb = true; this.pbMinUntil = this.t + 0.35; this.emit('in', 'PB1 누름 (ON)'); }
      } else this.pbHeld = false;
    }
    tapPB() { this.pressPB(true); this.pbHeld = false; }
    step(dt) {
      this.t += dt;
      if (this.pb && !this.pbHeld && this.t >= this.pbMinUntil) { this.pb = false; this.emit('in', 'PB1 뗌 (OFF)'); }
      for (const k in this.ls) {
        const v = this.lsHit(k);
        if (v !== this.ls[k]) { this.ls[k] = v; this.emit('in', `${k} ${v ? '눌림 (ON)' : '해제 (OFF)'}`); }
      }
      for (let it = 0; it < 6; it++) {
        this.evalLadder(false);
        let fired = false;
        for (const k in this.relays) {
          const R = this.relays[k];
          if (R.pend && this.t >= R.pend.at) {
            R.on = R.pend.target; R.pend = null; fired = true;
            this.emit('relay', `${k} ${R.on ? '여자 (코일 ON)' : '소자 (코일 OFF)'}`);
          }
        }
        if (!fired) break;
      }
      for (const id in this.task.valves) {
        const def = this.task.valves[id], V = this.valves[id];
        const tg = def.target(this.sols);
        if (tg !== V.target) { V.target = tg; V.at = this.t + this.valveDelay; }
        if (V.pos !== V.target && this.t >= V.at) { V.pos = V.target; this.emit('valve', `${def.name} → ${def.posNames[V.pos]}`); }
      }
      this.hyd = this.task.resolve(this);
      const a = Math.min(1, dt * 6);
      this.disp.pump += (this.hyd.pump - this.disp.pump) * a;
      this.disp.rodp += ((this.hyd.rodp || 0) - this.disp.rodp) * a;
      const m = this.hyd.motion;
      if (m) this.s = clamp(this.s + m * this.hyd.speed * BASE_RATE * dt, 0, 1);
      if (m !== this.motion) {
        this.motion = m;
        this.emit('cyl', m > 0 ? '실린더 전진 시작' : m < 0 ? '실린더 후진 시작' : '실린더 정지');
      }
      const ph = this.task.phase(this);
      if (ph !== this.phase) {
        const prev = this.phase;
        this.phase = ph;
        if (ph === 0 && prev !== 0) this.cycles++;
        this.emit('phase', '▶ ' + this.task.phases[ph].title);
        if (this.onPhase) this.onPhase(ph, prev);
      }
      if (this.phase === 0 && this.settled()) this.idleSince += dt; else this.idleSince = 0;
    }
    settled() {
      for (const k in this.relays) if (this.relays[k].pend) return false;
      for (const id in this.valves) if (this.valves[id].pos !== this.valves[id].target) return false;
      return !this.pb;
    }
  }

  /* ---------------- 과제 화면 ---------------- */
  class TaskView {
    constructor(root, task) {
      this.root = root;
      this.task = task;
      this.sim = new Sim(task);
      this.mode = 'step';
      this.running = false;
      this.speedMul = 1;
      this.viewPhase = null;
      this.pendingPause = null;
      this.autoRepeat = true;
      this.selected = null;
      this.build();
      this.sim.on(e => this.onEvent(e));
      this.sim.onPhase = (ph, prev) => this.onPhaseChange(ph, prev);
      this.renderTimeline();
      this.renderNarr();
      this.renderInfo();
      this.render(true);
    }

    /* ----- DOM 구성 ----- */
    build() {
      const T = this.task, root = this.root;
      root.innerHTML = '';
      root.append(H('div', { class: 'task-top' },
        H('div', null,
          H('h1', { text: `${T.title} · ${T.name}` }),
          H('div', { class: 'goal', html: T.goal }))));

      // 타임라인
      this.tl = H('div', { class: 'timeline' });
      this.tlItems = T.phases.map((p, i) => {
        const b = H('button', { class: 'tl-item', title: '이 단계 설명 보기', onclick: () => { this.viewPhase = i === this.sim.phase ? null : i; this.renderTimeline(); this.renderNarr(); } },
          H('div', { class: 'n', text: p.n }), H('div', { class: 't', text: p.short }), H('div', { class: 'd', text: p.sub }));
        this.tl.append(b);
        return b;
      });
      root.append(this.tl);

      // 컨트롤
      const c = H('div', { class: 'card controls' });
      this.btnNext = H('button', { class: 'btn primary', onclick: () => this.next() }, '다음 단계 ▶');
      this.btnPlay = H('button', { class: 'btn', onclick: () => this.togglePlay() }, '▶ 재생');
      this.btnPB = H('button', { class: 'btn pb', title: '누르고 있는 동안 ON (클릭하면 잠깐 눌림)' }, '● PB1 시작');
      const pbDown = e => { e.preventDefault(); this.btnPB.classList.add('down'); this.sim.pressPB(true); if (!this.running) this.play(); };
      const pbUp = () => { this.btnPB.classList.remove('down'); this.sim.pressPB(false); };
      this.btnPB.addEventListener('pointerdown', pbDown);
      this.btnPB.addEventListener('pointerup', pbUp);
      this.btnPB.addEventListener('pointerleave', pbUp);
      this.btnPB.addEventListener('pointercancel', pbUp);
      this.btnPB.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.sim.tapPB(); if (!this.running) this.play(); } });
      const btnReset = H('button', { class: 'btn', onclick: () => this.reset() }, '⟲ 처음으로');

      this.modeSeg = H('div', { class: 'seg' });
      [['step', '단계별'], ['cont', '연속']].forEach(([k, l]) => {
        this.modeSeg.append(H('button', { 'data-k': k, onclick: () => this.setMode(k) }, l));
      });
      const spdOut = H('span', { text: '1.0×' });
      const spd = H('input', { type: 'range', min: '0.25', max: '2', step: '0.25', value: '1' });
      spd.addEventListener('input', () => { this.speedMul = +spd.value; spdOut.textContent = (+spd.value).toFixed(2).replace(/0$/, '') + '×'; });
      this.relaySeg = H('div', { class: 'seg', title: '릴레이·밸브가 바뀌는 속도 (슬로모션)' });
      [['fast', '실제', 0.04, 0.06], ['mid', '천천히', 0.22, 0.16], ['slow', '아주 천천히', 0.7, 0.4]].forEach(([k, l, rd, vd]) => {
        this.relaySeg.append(H('button', { 'data-k': k, onclick: () => { this.sim.relayDelay = rd; this.sim.valveDelay = vd; this.relayMode = k; this.syncSegs(); } }, l));
      });
      this.relayMode = 'mid';
      const quizChk = H('input', { type: 'checkbox' });
      quizChk.addEventListener('change', () => { this.D.setQuiz(quizChk.checked); });
      this.repChk = H('input', { type: 'checkbox', checked: 'checked' });
      this.repChk.addEventListener('change', () => { this.autoRepeat = this.repChk.checked; });
      this.repLabel = H('label', { class: 'chk', title: '연속 모드에서 사이클이 끝나면 자동으로 PB1을 다시 누름' }, this.repChk, '자동 반복');
      this.runState = H('span', { class: 'run-state' });
      this.simTime = H('span', { class: 'simtime' });
      c.append(this.btnNext, this.btnPlay, this.btnPB, btnReset, H('span', { class: 'sep' }),
        this.modeSeg, H('span', { class: 'ctl-group' }, '속도', spd, spdOut),
        H('span', { class: 'ctl-group' }, '릴레이', this.relaySeg),
        H('label', { class: 'chk', title: '회로도의 부품 이름을 가리고 시험지처럼 연습' }, quizChk, '빈칸 모드'),
        this.repLabel, this.runState, this.simTime);
      root.append(c);
      if (window.ResizeObserver) new ResizeObserver(() => root.style.setProperty('--ctl-h', c.offsetHeight + 'px')).observe(c);

      // 메인 그리드
      const grid = H('div', { class: 'task-grid' });
      const hydSvg = S('svg', { role: 'img', 'aria-label': '유압 회로도' });
      this.D = new HYD.HydDiagram(hydSvg, T.hydSize[0], T.hydSize[1]);
      this.hydUpdate = T.build(this.D);
      const hydCard = H('div', { class: 'card diagram-card hyd-card' },
        H('div', { class: 'card-h' }, '💧 유압 회로도', H('span', { class: 'spacer' }), H('span', { class: 'hint', text: '부품 클릭 → 설명' })),
        H('div', { class: 'svgwrap' }, hydSvg),
        this.legend());
      const ladSvg = S('svg', { role: 'img', 'aria-label': '전기 회로도' });
      this.ladder = new Ladder(ladSvg, T.ladder, { onPB: down => { this.sim.pressPB(down); if (down && !this.running) this.play(); } });
      const ladCard = H('div', { class: 'card diagram-card' },
        H('div', { class: 'card-h' }, '⚡ 전기 회로도 (릴레이 시퀀스)', H('span', { class: 'spacer' }), H('span', { class: 'hint', text: 'PB1 접점을 직접 눌러도 됨' })),
        H('div', { class: 'svgwrap' }, ladSvg),
        H('div', { class: 'card-b small muted', style: 'padding:8px 14px;border-top:1px solid var(--line)', html:
          '<span style="color:var(--cur);font-weight:800">━</span> 전류가 흐르는 길 &nbsp; <span style="color:var(--live);font-weight:800">━</span> 전압만 걸림(끊긴 곳에서 멈춤) &nbsp; <b>a</b>=a접점(평소 열림) <b>b</b>=b접점(평소 닫힘)' }));

      // 상태
      this.sigEls = {};
      const sg = H('div', { class: 'status-grid' });
      for (const k of T.signals) {
        const kind = (k === 'PB1' || k.startsWith('LS')) ? 'in' : 'out';
        const sub = k === 'PB1' ? '버튼' : k.startsWith('LS') ? '리밋SW' : k.startsWith('K') ? '릴레이' : '솔레노이드';
        const el = H('div', { class: 'sig ' + kind, 'data-ref': k }, H('span', { class: 'led' }), H('span', { class: 'lbl' }, k, H('small', { text: sub })));
        this.sigEls[k] = el;
        sg.append(el);
      }
      this.roEls = {};
      const ro = H('div', { class: 'readouts' });
      for (const [k, label] of T.readouts) {
        const v = H('div', { class: 'v', text: '-' });
        this.roEls[k] = v;
        ro.append(H('div', { class: 'ro' }, H('div', { class: 'k', text: label }), v));
      }
      // 위치 바
      this.posFill = H('div', { class: 'fill' });
      const track = H('div', { class: 'track' }, this.posFill);
      this.lsMarks = {};
      for (const k in T.ls) {
        const p = T.ls[k];
        const mk = H('div', { class: 'mk' + (p >= 1 ? ' last' : ''), style: `left:calc(${p * 100}% - ${p >= 1 ? 2 : 0}px)` }, H('span', { text: k }));
        this.lsMarks[k] = mk;
        track.append(mk);
      }
      const posbar = H('div', { class: 'posbar' }, track, H('div', { class: 'cap' }, H('span', { text: '◀ 후진 끝' }), H('span', { text: '실린더 로드 위치' }), H('span', { text: '전진 끝 ▶' })));
      const stCard = H('div', { class: 'card' }, H('div', { class: 'card-h' }, '📟 실시간 상태', H('span', { class: 'spacer' }), H('span', { class: 'sub', text: '압력·속도는 이해를 돕는 예시값' })),
        H('div', { class: 'card-b' }, sg, ro, posbar));

      this.narrEl = H('div', { class: 'card-b narr' });
      const narrCard = H('div', { class: 'card' }, H('div', { class: 'card-h' }, '📖 지금 무슨 일이 일어나고 있나?'), this.narrEl);

      grid.append(H('div', { class: 'col-l' }, hydCard), H('div', { class: 'col-r' }, ladCard, stCard, narrCard));
      root.append(grid);

      // 하단
      this.infoEl = H('div', { class: 'card-b info' });
      this.logEl = H('div', { class: 'log' });
      this.quizEl = H('div', { class: 'card-b' });
      root.append(H('div', { class: 'lower3' },
        H('div', { class: 'card' }, H('div', { class: 'card-h' }, '🔍 부품 설명'), this.infoEl),
        H('div', { class: 'card' }, H('div', { class: 'card-h' }, '📝 빈칸·개념 연습', H('span', { class: 'spacer' }), H('span', { class: 'sub', text: '시험지 번호 그대로' })), this.quizEl),
        H('div', { class: 'card' }, H('div', { class: 'card-h' }, '🧾 동작 기록', H('span', { class: 'spacer' }), H('span', { class: 'sub', text: '최신이 위' })), H('div', { class: 'card-b', style: 'padding:6px 10px' }, this.logEl))));
      this.renderQuiz();

      // 하이라이트 & 선택
      root.addEventListener('pointerover', e => {
        const t = e.target.closest('[data-ref]');
        this.highlight(t ? t.getAttribute('data-ref') : null);
      });
      root.addEventListener('pointerleave', () => this.highlight(null));
      root.addEventListener('click', e => {
        const t = e.target.closest('[data-ref]');
        if (!t || t.closest('.lcomp.pbtn')) return;
        if (t.closest('.status-grid') && !T.info[t.getAttribute('data-ref')]) return;
        this.select(t.getAttribute('data-ref'));
      });
      this.syncSegs();
    }

    legend() {
      const item = (col, dash, label) => H('span', { class: 'lg' },
        S('svg', { width: 26, height: 10 }, S('line', { x1: 1, y1: 5, x2: 25, y2: 5, stroke: col, 'stroke-width': 4, 'stroke-dasharray': dash || null })), label);
      return H('div', { class: 'card-b legend', style: 'padding:9px 14px;border-top:1px solid var(--line)' },
        item('var(--p)', null, '압력(공급)'), item('var(--r)', null, '복귀(탱크로)'), item('var(--pilot)', '6 4', '파일럿 신호'),
        item('var(--lock)', null, '갇힌 오일(로킹)'), item('var(--sym)', null, '흐름 없음'),
        H('span', { class: 'lg muted', text: '··· 움직이는 점 = 오일 흐름 방향' }));
    }

    syncSegs() {
      for (const b of this.modeSeg.children) b.classList.toggle('on', b.dataset.k === this.mode);
      for (const b of this.relaySeg.children) b.classList.toggle('on', b.dataset.k === this.relayMode);
      this.btnNext.style.display = this.mode === 'step' ? '' : 'none';
      this.repLabel.style.display = this.mode === 'cont' ? '' : 'none';
    }

    /* ----- 실행 제어 ----- */
    setMode(k) { this.mode = k; this.pendingPause = null; this.syncSegs(); this.render(true); }
    play() { this.running = true; this.render(true); }
    pause() { this.running = false; this.pendingPause = null; this.render(true); }
    togglePlay() { this.running ? this.pause() : this.play(); }
    next() {
      if (this.sim.phase === 0 && this.sim.settled() && !this.sim.pb) this.sim.tapPB();
      this.pendingPause = null;
      this.play();
    }
    reset() {
      this.sim.reset();
      this.running = false;
      this.pendingPause = null;
      this.viewPhase = null;
      this.logEl.innerHTML = '';
      this.renderTimeline();
      this.renderNarr();
      this.render(true);
    }
    onPhaseChange(ph) {
      this.viewPhase = null;
      this.renderTimeline();
      this.renderNarr();
      if (this.mode === 'step' && this.running) {
        const p = this.task.phases[ph];
        if (p.pause === 'enter') { this.running = false; this.pendingPause = null; }
        else this.pendingPause = { at: null };
      }
    }
    tick(realDt) {
      if (this.running) {
        const total = Math.min(realDt, 0.1) * this.speedMul;
        const n = Math.max(1, Math.ceil(total / 0.008));
        const dt = total / n;
        for (let i = 0; i < n && this.running; i++) {
          this.sim.step(dt);
          if (this.pendingPause && this.mode === 'step') {
            if (this.sim.settled()) {
              if (this.pendingPause.at == null) this.pendingPause.at = this.sim.t + (this.sim.phase === 0 ? 0 : 0.4);
              else if (this.sim.t >= this.pendingPause.at) { this.running = false; this.pendingPause = null; }
            }
          }
          if (this.mode === 'cont' && this.autoRepeat && this.sim.phase === 0 && this.sim.idleSince > 1.4 && this.sim.cycles > 0) {
            this.sim.tapPB();
            this.sim.idleSince = 0;
          }
        }
      }
      this.render(false);
    }

    /* ----- 렌더링 ----- */
    render() {
      const sim = this.sim, T = this.task;
      this.hydUpdate(sim);
      this.ladder.update(sim);
      for (const k in this.sigEls) {
        const el = this.sigEls[k];
        const on = sim.isActuated(k) || !!sim.sols[k];
        const pend = sim.coilPending(k);
        const key = on + '|' + pend;
        if (el._k !== key) { el._k = key; el.classList.toggle('on', on); el.classList.toggle('pend', pend); }
      }
      const vals = T.readoutValues(sim);
      for (const k in this.roEls) {
        const v = vals[k] || ['-', ''];
        const el = this.roEls[k];
        const key = v[0] + v[1];
        if (el._k !== key) { el._k = key; el.textContent = v[0]; el.className = 'v ' + (v[1] || ''); }
      }
      this.posFill.style.width = (sim.s * 100).toFixed(1) + '%';
      for (const k in this.lsMarks) this.lsMarks[k].classList.toggle('on', !!sim.ls[k]);
      this.simTime.textContent = 't = ' + sim.t.toFixed(1) + 's';
      const rs = this.running ? ['run', '● 실행 중'] : (sim.t === 0 ? ['pause', '대기'] : ['pause', '⏸ 멈춤']);
      if (this.runState._k !== rs[1]) { this.runState._k = rs[1]; this.runState.className = 'run-state ' + rs[0]; this.runState.textContent = rs[1]; }
      const playTxt = this.running ? '⏸ 일시정지' : '▶ 재생';
      if (this.btnPlay.textContent !== playTxt) this.btnPlay.textContent = playTxt;
      const waitPB = sim.phase === 0 && sim.settled() && !sim.pb;
      this.btnPB.classList.toggle('pulse', waitPB);
      const nextTxt = waitPB ? 'PB1 누르고 시작 ▶' : '다음 단계 ▶';
      if (this.btnNext.textContent !== nextTxt) this.btnNext.textContent = nextTxt;
      this.btnNext.disabled = this.running;
      if (this.selected && T.info[this.selected]) {
        const st = T.info[this.selected].state;
        if (st && this.infoState) { const txt = st(sim); if (this.infoState.textContent !== txt) this.infoState.textContent = txt; }
      }
    }

    renderTimeline() {
      const cur = this.sim.phase;
      this.tlItems.forEach((b, i) => {
        b.classList.toggle('current', i === cur);
        b.classList.toggle('viewing', i === this.viewPhase);
      });
    }

    renderNarr() {
      const T = this.task;
      const i = this.viewPhase != null ? this.viewPhase : this.sim.phase;
      const p = T.phases[i];
      const el = this.narrEl;
      el.innerHTML = '';
      if (this.viewPhase != null) {
        el.append(H('div', { class: 'viewing-note' }, `👀 ${p.n} 설명을 미리 보는 중 (시뮬레이션은 ${T.phases[this.sim.phase].n})`,
          H('button', { class: 'btn', onclick: () => { this.viewPhase = null; this.renderTimeline(); this.renderNarr(); } }, '현재 단계로')));
      }
      el.append(H('h2', { text: p.title }), H('p', { class: 'lead', html: p.lead }));
      const box = (cls, title, items) => H('div', { class: 'box ' + cls }, H('h4', { html: title }), H('ol', null, items.map(x => H('li', { html: x }))));
      el.append(H('div', { class: 'cols' }, box('el', '⚡ 전기 회로에서는', p.el), box('hy', '💧 유압 회로에서는', p.hy)));
      if (p.tip) el.append(H('div', { class: 'tip', html: '💡 ' + p.tip }));
      if (p.deep) el.append(H('details', { class: 'deep' }, H('summary', { html: p.deep[0] }), H('div', { html: p.deep[1] })));
    }

    renderInfo() {
      const el = this.infoEl;
      el.innerHTML = '';
      this.infoState = null;
      const ref = this.selected;
      const inf = ref && this.task.info[ref];
      if (!inf) {
        el.append(H('div', { class: 'info-empty', html: '회로도에서 <b>부품</b>이나 <b>접점·코일</b>, 설명 속 <span class="ref">K1</span> 같은 칩을 <b>클릭</b>하면 여기에 역할과 원리가 나와요.<br><br>마우스를 올리면 전기 회로와 유압 회로에서 <b>같은 부품</b>이 함께 강조돼요. (예: Y1 코일 ↔ Y1 밸브)' }));
        return;
      }
      const part = PARTS[inf.part] || {};
      el.append(H('h3', { text: (inf.num ? inf.num + ' ' : '') + (inf.name || part.name) }));
      el.append(H('div', { class: 'en', text: part.en || '' }));
      if (inf.state) { this.infoState = H('span', { class: 'pill state', text: inf.state(this.sim) }); el.append(this.infoState); }
      if (inf.role) el.append(H('div', { class: 'role', html: '<b>이 회로에서의 역할</b><br>' + inf.role }));
      if (part.how) { el.append(H('h5', { text: '동작 원리' })); el.append(H('ul', null, part.how.map(x => H('li', { html: x })))); }
      if (part.symbol) { el.append(H('h5', { text: '기호 읽는 법' })); el.append(H('p', { html: part.symbol })); }
      if (inf.part) el.append(H('p', { class: 'small' }, H('a', { href: '#parts', onclick: () => { window.APP && APP.flashPart(inf.part); } }, '📚 부품 사전에서 크게 보기 →')));
    }

    renderQuiz() {
      const el = this.quizEl;
      el.innerHTML = '';
      const qs = this.task.quiz;
      let solved = 0;
      const score = H('div', { class: 'quiz-score' });
      const upd = () => { score.textContent = `맞힌 문제 ${solved} / ${qs.length}`; };
      const wrap = H('div', { class: 'quiz' });
      qs.forEach(q => {
        const box = H('div', { class: 'qz' });
        const opts = H('div', { class: 'opts' });
        const fb = H('div', { class: 'fb' });
        const order = q.options.slice().sort(() => Math.random() - 0.5);
        let done = false;
        for (const o of order) {
          const b = H('button', { text: o, onclick: () => {
            if (done) return;
            if (o === q.answer) { b.classList.add('right'); done = true; box.classList.add('solved'); solved++; upd(); fb.innerHTML = '✅ 정답! ' + (q.why || ''); }
            else { b.classList.add('wrong'); fb.innerHTML = '❌ 다시 생각해 보세요. ' + (q.hint || ''); }
          } });
          opts.append(b);
        }
        box.append(H('div', { class: 'q' }, q.ws ? H('span', { class: 'badge-ws', text: '시험지 빈칸' }) : null,
          H('span', { html: q.q }), q.ref ? H('span', { class: 'ref', 'data-ref': q.ref, text: '위치 보기' }) : null), opts, fb);
        wrap.append(box);
      });
      el.append(score, wrap, H('div', { style: 'margin-top:8px' }, H('button', { class: 'btn', onclick: () => this.renderQuiz() }, '↻ 다시 풀기')));
      upd();
    }

    onEvent(e) {
      if (e.kind === 'valve' && !this.showValveLog) { /* 밸브 이벤트도 표시 */ }
      const row = H('div', { class: 'row k-' + e.kind + (e.kind === 'phase' ? ' phase' : '') },
        H('span', { class: 't', text: e.t.toFixed(2) + 's' }), H('span', { class: 'm', text: e.text }));
      this.logEl.prepend(row);
      while (this.logEl.childElementCount > 160) this.logEl.lastChild.remove();
    }

    highlight(ref) {
      if (ref === this._hl) return;
      this._hl = ref;
      this.root.querySelectorAll('.hl').forEach(e => e.classList.remove('hl'));
      if (!ref) return;
      this.root.querySelectorAll(`[data-ref="${ref}"]`).forEach(e => e.classList.add('hl'));
    }
    select(ref) {
      this.selected = ref;
      this.root.querySelectorAll('.sel').forEach(e => e.classList.remove('sel'));
      this.root.querySelectorAll(`.comp[data-ref="${ref}"]`).forEach(e => e.classList.add('sel'));
      this.renderInfo();
      if (window.innerWidth < 1180) {
        const r = this.infoEl.getBoundingClientRect();
        if (r.top > window.innerHeight || r.bottom < 0) this.infoEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  window.Sim = Sim;
  window.TaskView = TaskView;
})();
