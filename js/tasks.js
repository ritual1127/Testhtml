/* =========================================================
   실습과제 1·2·3 정의
   - ladder: 전기 회로 (시험지 그대로)
   - build:  유압 회로도 그리기
   - resolve: 밸브 위치 → 오일 흐름/실린더 동작 계산
   - phase:  현재 단계 판별,  phases: 단계별 설명
   ========================================================= */
(function () {
  const R = (ref, label) => `<span class="ref" data-ref="${ref}">${label || ref}</span>`;
  const P = t => `<span class="c-p">${t}</span>`;
  const B = t => `<span class="c-r">${t}</span>`;
  const PI = t => `<span class="c-pi">${t}</span>`;
  const LK = t => `<span class="c-l">${t}</span>`;
  const C = (ref, kind = 'no', act = 'k', mark = false) => ({ ref, kind, act, mark });

  const PORTS4 = { A: [0.25, 't'], B: [0.75, 't'], P: [0.25, 'b'], T: [0.75, 'b'] };
  const PORTS3 = { A: [0.25, 't'], P: [0.25, 'b'], T: [0.75, 'b'] };

  /** 공급부(펌프·릴리프) 라인 상태 */
  function supplyLines(L, reliefOpen) {
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
  }

  function commonReadouts(sim) {
    const h = sim.hyd;
    return {
      pump: [sim.disp.pump.toFixed(1) + ' MPa', 'p'],
      cyl: [h.status, h.motion > 0 ? 'p' : h.motion < 0 ? 'r' : ''],
      pos: [Math.round(sim.s * 100) + ' %', ''],
      relief: [h.reliefOpen ? '열림 · 남는 오일 탱크로' : '닫힘', h.reliefOpen ? 'warn' : 'ok'],
      rodp: [(sim.disp.rodp || 0).toFixed(1) + ' MPa', (sim.disp.rodp || 0) > 2 ? 'warn' : 'r'],
    };
  }

  const stK = (k) => sim => sim.relays[k].on ? '여자 (코일 ON)' : (sim.relays[k].pend ? '동작 중…' : '소자 (코일 OFF)');
  const stLS = (k) => sim => sim.ls[k] ? '눌림 (ON) · 접점 닫힘' : '해제 (OFF) · 접점 열림';
  const stPB = sim => sim.pb ? '눌림 (ON)' : '안 눌림 (OFF)';
  const stCyl = sim => `위치 ${Math.round(sim.s * 100)}% · ${sim.hyd.status}`;
  const stPump = sim => `펌프 압력 ${sim.disp.pump.toFixed(1)} MPa`;
  const stRelief = sim => sim.hyd.reliefOpen ? `열림 · 압력 ${sim.disp.pump.toFixed(1)} MPa (설정압 도달)` : `닫힘 · 압력 ${sim.disp.pump.toFixed(1)} MPa (설정압 5 MPa 미만)`;

  /* =====================================================================
     실습과제 1
     ===================================================================== */
  const T1 = {
    id: 't1', title: '실습과제 1', name: '파일럿 체크 로킹 + 미터-아웃 전진',
    goal: `PB1을 누르면 실린더 A가 <b>천천히 전진(미터-아웃)</b> → LS2에 닿으면 <b>빠르게 후진</b> → LS1에서 정지. 정지 중에는 ${R('pc', '④ 파일럿 작동 체크 밸브')}가 실린더를 꽉 잡아(로킹) 둡니다.`,
    relays: ['K1', 'K2', 'K3'], sols: ['Y1', 'Y2'],
    ls: { LS1: 0, LS2: 1 },
    signals: ['PB1', 'LS1', 'LS2', 'K1', 'K2', 'K3', 'Y1', 'Y2'],
    readouts: [['pump', '펌프 압력 (⑨)'], ['relief', '⑦ 릴리프 밸브'], ['cyl', '실린더 동작'], ['pos', '로드 위치']],
    readoutValues: commonReadouts,
    ladder: [
      { top: [C('PB1', 'no', 'pb'), C('K1')], ser: [C('K2', 'nc')], coil: { ref: 'K1', kind: 'relay' } },
      { top: [C('LS2', 'no', 'ls'), C('K2')], ser: [C('K3', 'nc')], coil: { ref: 'K2', kind: 'relay' } },
      { top: [C('LS1', 'no', 'ls', true)], ser: [], coil: { ref: 'K3', kind: 'relay' } },
      { top: [C('K1')], ser: [], coil: { ref: 'Y2', kind: 'sol' } },
      { top: [C('K2')], ser: [], coil: { ref: 'Y1', kind: 'sol' } },
    ],
    valves: {
      Y1: { name: 'Y1 밸브(4/2)', home: 1, target: s => s.Y1 ? 0 : 1, posNames: ['교차 위치 (P→B, A→T)', '평행 위치 (P→A, B→T)'] },
      Y2: { name: 'Y2 밸브(3/2)', home: 1, target: s => s.Y2 ? 0 : 1, posNames: ['통전 위치 (P→A, 파일럿 공급)', '스프링 위치 (A→T, 파일럿 배출)'] },
    },
    hydSize: [770, 900],
    build(D) {
      const cyl = HYD.Cylinder(D, { ref: 'cyl', x: 100, y: 140, w: 250, h: 50, stroke: 200, rodOut: 50, headPortX: 112, rodPortX: 340 });
      const ls1 = HYD.LimitSwitch(D, { ref: 'LS1', x: cyl.lsX(0), rollerY: cyl.dogTop - 6, label: 'LS1' });
      const ls2 = HYD.LimitSwitch(D, { ref: 'LS2', x: cyl.lsX(1), rollerY: cyl.dogTop - 6, label: 'LS2' });
      D.line('head', [[304, 530], [304, 500], [112, 500], [112, 190]]);
      D.line('rod_low', [[340, 530], [340, 420]]);
      D.line('pc_in', [[340, 420], [340, 340]]);
      D.line('rod_mid', [[340, 340], [340, 302]]);
      D.line('thr', [[340, 302], [340, 238]]);
      D.line('byp', [[340, 302], [305, 302], [305, 238], [340, 238]]);
      D.line('rod_top', [[340, 238], [340, 190]]);
      D.line('pilot', [[352, 420], [352, 466], [608, 466], [608, 530]], { pilot: true });
      D.line('y1p', [[304, 650], [304, 582]]);
      D.line('y1t', [[340, 582], [340, 604]]);
      D.line('main_r', [[304, 650], [608, 650], [608, 582]]);
      D.line('y2t', [[644, 582], [644, 604]]);
      HYD.tank(D, 340, 596); HYD.tank(D, 644, 596);
      D.dot(340, 238); D.dot(340, 302);
      const fcv = HYD.OneWayFCV(D, { ref: 'fcv', x: 340, cy: 270, box: [290, 222, 384, 318], bypassX: 305, checkDir: 'up' });
      const pc = HYD.PilotCheck(D, { ref: 'pc', x: 340, yTop: 340, yBot: 420 });
      const y1 = HYD.DirValve(D, { ref: 'Y1', x0: 214, y: 530, home: 1, ports: PORTS4,
        squares: [[['a', 'P', 'B'], ['a', 'A', 'T']], [['a', 'P', 'A'], ['a', 'B', 'T']]], left: ['sol'], right: ['spring'], labelL: 'Y1', refL: 'Y1' });
      const y2 = HYD.DirValve(D, { ref: 'Y2', x0: 518, y: 530, home: 1, ports: PORTS3,
        squares: [[['a', 'P', 'A'], ['b', 'T']], [['b', 'P'], ['a', 'A', 'T']]], left: ['sol'], right: ['spring'], labelL: 'Y2', refL: 'Y2' });
      const sup = HYD.Supply(D, { px: 304, my: 650, numbered: true });
      D.tag({ num: '①', name: '복동 실린더', x: 124, y: 126, ref: 'cyl' });
      D.tag({ num: '②', name: '리밋 스위치', x: 612, y: 92, ref: 'LS2' });
      D.tag({ num: '③', name: '일방향 유량제어 밸브', x: 394, y: 275, ref: 'fcv' });
      D.tag({ num: '④', name: '파일럿 작동 체크 밸브', x: 372, y: 386, ref: 'pc' });
      D.tag({ num: '⑤', name: '4/2-way 편솔 밸브', x: 146, y: 522, ref: 'Y1' });
      D.tag({ num: '⑥', name: '3/2-way 편솔 밸브', x: 620, y: 522, ref: 'Y2' });
      return sim => {
        const h = sim.hyd;
        cyl.update(sim.s, h.chambers.head, h.chambers.rod);
        ls1.update(sim.ls.LS1); ls2.update(sim.ls.LS2);
        y1.update(sim.valves.Y1.pos, { L: sim.sols.Y1 }, h.vf.Y1);
        y2.update(sim.valves.Y2.pos, { L: sim.sols.Y2 }, h.vf.Y2);
        pc.update(h.checks.pc); fcv.update(h.checks.fcv);
        sup.update(sim.disp.pump, h.reliefOpen);
        D.applyLines(h.lines);
      };
    },
    resolve(sim) {
      const v1 = sim.valves.Y1.pos, pil = sim.valves.Y2.pos === 0, s = sim.s;
      const L = {}, vf = { Y1: {}, Y2: {} };
      const out = { lines: L, vf, checks: { pc: false, fcv: false }, chambers: { head: 'idle', rod: 'idle' } };
      let motion = 0, speed = 0, relief = true, pump = 5.0, status = '';
      L.main_r = ['ps', 0];
      if (pil) { L.pilot = ['pilot', 0]; vf.Y2['P>A'] = 'pilot'; } else vf.Y2.xP = 'ps';
      if (v1 === 1) { // 평행: P→A(헤드), B→T
        vf.Y1['P>A'] = 'p';
        L.y1p = ['ps', 0]; L.head = ['ps', 0]; out.chambers.head = 'ps';
        if (pil) {
          out.checks.pc = true;
          if (s < 1) {
            motion = 1; speed = 0.42; status = '전진 중 · 미터-아웃 저속';
            const v = speed;
            L.y1p = ['p', 1, v]; L.head = ['p', 1, v];
            L.rod_top = ['r', -1, v]; L.thr = ['r', -1, v]; L.byp = ['rs', 0]; L.rod_mid = ['r', -1, v];
            L.pc_in = ['r', -1, v]; L.rod_low = ['r', -1, v]; L.y1t = ['r', 1, v];
            vf.Y1['B>T'] = 'r';
            out.chambers = { head: 'p', rod: 'r' };
          } else {
            status = '전진 끝 도달';
            for (const k of ['rod_top', 'thr', 'byp', 'rod_mid', 'pc_in', 'rod_low']) L[k] = ['rs', 0];
          }
        } else {
          status = '정지 · 로킹 (④가 로드측 출구 차단)';
          for (const k of ['rod_top', 'thr', 'byp', 'rod_mid', 'pc_in']) L[k] = ['lock', 0];
          out.chambers.rod = 'lock';
        }
      } else { // 교차: P→B(로드), A→T
        vf.Y1['P>B'] = 'p';
        if (s > 0) {
          motion = -1; speed = 1.0; relief = false; pump = 1.6; status = '후진 중 · 고속 복귀';
          const v = speed;
          L.y1p = ['p', 1, v]; L.rod_low = ['p', 1, v]; L.pc_in = ['p', 1, v]; L.rod_mid = ['p', 1, v];
          L.byp = ['p', 1, v]; L.thr = ['ps', 0]; L.rod_top = ['p', 1, v];
          L.head = ['r', -1, v]; L.y1t = ['r', 1, v]; vf.Y1['A>T'] = 'r';
          out.checks = { pc: true, fcv: true }; out.chambers = { head: 'r', rod: 'p' };
        } else {
          status = '후진 끝 도달';
          L.y1p = ['ps', 0];
          for (const k of ['rod_low', 'pc_in', 'rod_mid', 'byp', 'thr', 'rod_top']) L[k] = ['ps', 0];
          out.chambers = { head: 'idle', rod: 'ps' };
        }
      }
      supplyLines(L, relief);
      return Object.assign(out, { motion, speed, reliefOpen: relief, pump, status });
    },
    phase(sim) {
      const K = k => { const r = sim.relays[k]; return r.on || !!(r.pend && r.pend.target); };
      if (K('K2') && (sim.ls.LS1 || K('K3'))) return 4;
      if (K('K2') && sim.motion < 0) return 3;
      if (K('K2')) return 2;
      if (K('K1') && sim.ls.LS2) return 2;
      if (K('K1')) return 1;
      return 0;
    },
    phases: [
      {
        n: '초기 상태', short: '대기 (로킹)', sub: 'LS1 ON → K3 여자', pause: 'settle',
        title: '초기 상태 — 대기 (실린더 로킹)',
        lead: `실린더는 후진 끝에서 ${R('LS1')}을 누르고 있고, 솔레노이드 ${R('Y1')}·${R('Y2')}는 모두 꺼져 있어요. 그런데 헤드 쪽에 압력이 걸려 있는데도 실린더가 <b>꼼짝하지 않아요.</b> 왜일까요?`,
        el: [
          `3번 줄: ${R('LS1')}이 눌려 접점이 닫힘 → ${R('K3')} 코일 여자`,
          `${R('K3')}가 켜져서 2번 줄의 <b>K3 b접점이 열림</b> → K2 회로가 미리 끊겨 있음`,
          `${R('K1')}, ${R('K2')} OFF → 4·5번 줄 a접점 열림 → ${R('Y1')}, ${R('Y2')} 소자`,
        ],
        hy: [
          `${R('Y1', '⑤ Y1')}은 스프링 위치(평행 ↑↓): ${P('P→A')} 로 펌프 압력이 <b>헤드 측</b>에 걸림`,
          `하지만 로드 측 오일은 ${R('pc', '④ 파일럿 체크 밸브')}에 막혀 ${LK('갇혀')} 있음 → 피스톤이 밀리지 못함 = <b>로킹</b>`,
          `${R('Y2', '⑥ Y2')}도 꺼져 있어 파일럿 라인은 A→T로 탱크에 열려 있음(압력 없음)`,
          `갈 곳 없는 펌프 오일은 ${R('relief', '⑦ 릴리프 밸브')}를 밀어 열고 ${B('탱크로 복귀')} → ${R('g9', '⑨ 압력계')} = 설정압(5 MPa)`,
        ],
        tip: '실린더는 <b>들어가는 길</b>과 <b>나가는 길</b>이 모두 열려야 움직여요. 출구(로드 측)가 막혀 있으면 아무리 밀어도 안 움직입니다. 이것이 <b>로킹 회로</b>의 원리!',
      },
      {
        n: '1단계', short: '전진 시작', sub: 'PB1 → K1 → Y2 · 미터-아웃', pause: 'settle',
        title: '1단계 — 전진 시작 (PB1 → K1 자기유지 → Y2 통전)',
        lead: `${R('PB1')}을 누르면 ${R('Y2')}가 파일럿 압력을 보내 ④를 열어 줍니다. 출구가 열렸으니 실린더가 <b>천천히</b> 전진해요. 이때 ${R('Y1')}은 <b>여전히 꺼져 있다</b>는 점이 핵심!`,
        el: [
          `${R('PB1')} 누름 → 1번 줄 통전 (K2 b접점은 닫혀 있음) → ${R('K1')} 여자`,
          `K1 a접점(1번 줄, PB1과 병렬)이 닫힘 → PB1에서 손을 떼도 K1이 계속 ON = <b>자기유지</b>`,
          `K1 a접점(4번 줄) 닫힘 → ${R('Y2')} 통전`,
          `실린더가 출발하면 ${R('LS1')}이 떨어짐 → ${R('K3')} 소자 → 2번 줄 K3 b접점이 다시 닫힘 (LS2 신호를 받을 준비 완료)`,
        ],
        hy: [
          `${R('Y2', '⑥ Y2')} 전환: ${PI('P→A')} → 펌프 압력이 <b>파일럿 라인(주황 점선)</b>으로 전달`,
          `파일럿 압력이 ${R('pc', '④')}의 볼을 강제로 들어 올림 → 로드 측 출구 개방`,
          `헤드 측: 펌프 → ${R('Y1', 'Y1')}(${P('P→A')}) → 헤드 → 피스톤 전진`,
          `로드 측: 오일 → ${R('fcv', '③')}(체크가 막혀 ${B('교축으로만 통과')}) → ④ → Y1(B→T) → 탱크`,
          `<b>빠져나가는 오일</b>을 조여서 속도를 제어 = <b>미터-아웃</b> → 천천히, 일정하게 전진`,
          `남는 펌프 오일은 ${R('relief', '⑦')}로 탱크 복귀 (그래서 ⑨ 압력은 여전히 높음)`,
        ],
        tip: '전진 방향은 Y1이 꺼진 상태(평행 위치)에서 이미 정해져 있어요. Y2는 "출구 잠금장치(④)를 여는 열쇠" 역할만 합니다.',
        deep: ['🔬 왜 미터-아웃은 실린더가 튀어나가지 않을까?', '빠져나가는 쪽에서 유량을 조이면 로드 측에 <b>배압</b>이 생겨 피스톤이 양쪽에서 눌린 상태로 움직여요. 그래서 부하가 갑자기 가벼워지거나 실린더를 앞으로 끌어당겨도(자중, 관성) 튀어나가지 않고 일정 속도를 유지합니다. 노트에 적힌 "오버런 방지"가 바로 이 뜻이에요.'],
      },
      {
        n: '2단계', short: '전진 완료 검출', sub: 'LS2 → K2 → Y1', pause: 'enter',
        title: '2단계 — 전진 완료 검출 (LS2 ON → K2 자기유지 → Y1 통전)',
        lead: `로드 끝의 도그가 ${R('LS2')}를 눌렀어요! 이 신호 하나로 전진 명령(K1)은 꺼지고 후진 명령(K2)이 켜집니다.`,
        el: [
          `${R('LS2')} 눌림 → 2번 줄 통전 (K3 b는 이미 닫혀 있음) → ${R('K2')} 여자`,
          `K2 a접점(2번 줄)으로 <b>자기유지</b> → 실린더가 LS2에서 떨어져도 K2 유지`,
          `K2 <b>b접점(1번 줄) 열림</b> → ${R('K1')} 자기유지 해제 → K1 소자 → 4번 줄 열림 → ${R('Y2')} 소자`,
          `K2 a접점(5번 줄) 닫힘 → ${R('Y1')} 통전`,
        ],
        hy: [
          `${R('Y2')} 소자: 파일럿 라인이 A→T로 탱크에 연결 → 파일럿 압력 해제`,
          `${R('Y1')} 통전: 밸브가 <b>교차(X) 위치</b>로 전환되기 시작`,
          `곧 오일 흐름 방향이 반대로 바뀌며 후진이 시작됨 (다음 단계)`,
        ],
        tip: '1번 줄의 <b>K2 b접점</b>은 "후진이 시작되면 전진 기억(K1)을 지워라"는 뜻이에요. 전진과 후진 명령이 동시에 살아있지 않게 하는 <b>인터록</b>입니다.',
      },
      {
        n: '3단계', short: '후진 (고속)', sub: 'Y1 교차 위치 · 자유 흐름', pause: 'settle',
        title: '3단계 — 후진 복귀 (Y1 교차 위치, 빠른 속도)',
        lead: `${R('Y1')}이 교차 위치로 바뀌어 오일이 <b>로드 측</b>으로 들어가고, 헤드 측 오일이 탱크로 빠져요. 이번에는 교축을 거치지 않아 <b>빠르게</b> 후진합니다.`,
        el: [
          `${R('K2')} 자기유지 중 → 5번 줄 통해 ${R('Y1')} 계속 통전`,
          `${R('K1')}, ${R('Y2')}는 꺼진 상태 유지`,
          `실린더가 출발하면 ${R('LS2')} 해제 (K2는 자기유지라 영향 없음)`,
        ],
        hy: [
          `Y1 교차 위치: ${P('P→B')}, ${B('A→T')}`,
          `펌프 → B → ${R('pc', '④')}: 아래→위는 <b>정방향</b>이라 압력만으로 볼이 열림 (파일럿 불필요)`,
          `→ ${R('fcv', '③')}의 <b>체크 밸브로 자유 흐름</b>(교축 우회) → 로드 측 → 피스톤 후진`,
          `헤드 측 오일 → A → T → ${B('탱크')}`,
          `제어 없는 자유 흐름 + 로드 측 면적이 작음 → 같은 유량이라도 <b>더 빠르게</b> 후진`,
        ],
        tip: '③ 일방향 유량제어 밸브는 <b>한 방향만</b> 속도를 제어해요. 전진(로드 측 배출)은 교축, 후진(로드 측 공급)은 체크 밸브로 자유 흐름.',
      },
      {
        n: '4단계', short: '후진 완료·리셋', sub: 'LS1 → K3 → K2 해제', pause: 'enter',
        title: '4단계 — 후진 완료 & 사이클 종료 (LS1 → K3 → 전체 리셋)',
        lead: `실린더가 돌아와 ${R('LS1')}을 다시 눌렀어요. ${R('K3')}가 ${R('K2')}를 끊어서 모든 것이 처음 상태로 돌아갑니다.`,
        el: [
          `${R('LS1')} 눌림 → 3번 줄 → ${R('K3')} 여자`,
          `K3 <b>b접점(2번 줄) 열림</b> → ${R('K2')} 자기유지 해제 → K2 소자`,
          `5번 줄 K2 a 열림 → ${R('Y1')} 소자`,
        ],
        hy: [
          `${R('Y1')} 스프링 복귀 → 평행 위치: 다시 ${P('P→A')} (헤드 측 가압)`,
          `로드 측 출구는 ${R('pc', '④')}가 막음 → 실린더 ${LK('로킹')}`,
          `펌프 오일은 다시 ${R('relief', '⑦')}로 탱크 복귀`,
        ],
        tip: '모든 릴레이가 초기 상태로 돌아왔어요. PB1을 다시 누르면 같은 사이클이 반복됩니다. (K3는 LS1이 눌려 있는 한 계속 켜져 있어요)',
      },
    ],
    info: {
      cyl: { part: 'cyl', num: '①', state: stCyl, role: `헤드 측(왼쪽 포트)으로 압유가 들어가면 <b>전진</b>, 로드 측(오른쪽 포트)으로 들어가면 <b>후진</b>. 로드 끝의 주황색 <b>도그</b>가 LS1·LS2를 눌러 위치를 전기 회로에 알려줍니다.` },
      LS1: { part: 'ls', num: '②', name: '리밋 스위치 LS1 (후진 끝)', state: stLS('LS1'), role: '실린더가 후진 끝에 있을 때 눌림 → 3번 줄 K3 여자 → "원위치 도착" 신호. 시작할 때 이미 눌려 있어서 전기 회로도에 <b>⇧</b> 표시가 붙어 있어요.' },
      LS2: { part: 'ls', num: '②', name: '리밋 스위치 LS2 (전진 끝)', state: stLS('LS2'), role: '실린더가 전진 끝에 도달하면 눌림 → 2번 줄 K2 여자 → 후진 명령.' },
      fcv: { part: 'fcv', num: '③', state: sim => sim.hyd.checks.fcv ? '체크 밸브 열림 → 자유 흐름' : (sim.hyd.motion > 0 ? '체크 닫힘 → 교축으로만 통과 (속도 제어 중)' : '체크 닫힘'), role: '로드 측 라인에 설치. 전진 때 로드 측에서 <b>빠져나오는</b> 오일(위→아래)은 체크 밸브가 막혀 교축으로만 통과 → <b>미터-아웃</b> 속도 제어. 후진 때 <b>들어가는</b> 오일(아래→위)은 체크 밸브로 자유 흐름.' },
      pc: { part: 'pc', num: '④', state: sim => sim.valves.Y2.pos === 0 ? '파일럿 압력 있음 → 강제 개방 (양방향 통과)' : (sim.hyd.checks.pc ? '정방향 흐름으로 열림' : '닫힘 → 로드측 오일 차단 (로킹)'), role: '평소에는 로드 측 출구(위→아래)를 막아 실린더를 고정(로킹). Y2가 파일럿 압력을 보내야만 강제로 열려 전진할 수 있어요. 후진 때(아래→위)는 정방향이라 그냥 열립니다.' },
      Y1: { part: 'v42', num: '⑤', name: '4/2-way 편솔레노이드 밸브 (Y1)', state: sim => (sim.sols.Y1 ? 'Y1 통전 · ' : 'Y1 소자 · ') + T1.valves.Y1.posNames[sim.valves.Y1.pos], role: '메인 방향 제어 밸브.<br>· <b>소자</b>(스프링 위치) = 평행: P→A(헤드), B→T → 전진 방향<br>· <b>통전</b> = 교차: P→B(로드), A→T → 후진<br><span class="muted small">※ 노트 4쪽의 "양솔레노이드"는 회로도와 달라요. 한쪽은 솔레노이드, 반대쪽은 스프링이므로 <b>편솔레노이드</b>가 맞습니다. 또 노트 2쪽의 "통전 시 헤드 측 공급(전진)"도 회로도 기준으로는 <b>통전 시 후진</b>이에요.</span>' },
      Y2: { part: 'v32', num: '⑥', name: '3/2-way 편솔레노이드 밸브 (Y2)', state: sim => (sim.sols.Y2 ? 'Y2 통전 · ' : 'Y2 소자 · ') + T1.valves.Y2.posNames[sim.valves.Y2.pos], role: '파일럿 신호 공급 전용 밸브(NC형). 통전되면 P→A로 펌프 압력을 파일럿 라인에 보내 ④를 열어 줌. 소자되면 A→T로 파일럿 압력을 빼서 ④가 다시 닫힘.' },
      relief: { part: 'relief', num: '⑦', state: stRelief, role: '회로의 최고 압력을 정함(예: 5 MPa). 실린더가 멈춰 있거나(로킹·행정 끝), 미터-아웃으로 유량을 조일 때 <b>남는 펌프 오일</b>을 탱크로 돌려보냅니다.' },
      pu: { part: 'pu', num: '⑧', state: stPump, role: '모터(M)가 펌프를 돌려 탱크의 오일을 필터로 걸러 빨아들인 뒤 회로로 밀어냄. 점선 박스 안의 릴리프 밸브는 펌프 보호용 안전 밸브(⑦보다 높게 설정).' },
      g9: { part: 'gauge', num: '⑨', state: stPump, role: '펌프 라인 압력 표시. 실린더가 멈추거나 유량을 조일 때는 릴리프 설정압까지 오르고, 고속 후진처럼 막힘 없이 흐를 때는 부하만큼만 낮게 표시돼요.' },
      gpu: { part: 'gauge', name: '압력계 (파워 유닛)', state: stPump, role: '파워 유닛 출구 압력. ⑨와 같은 라인이라 같은 값을 보여요.' },
      PB1: { part: 'pb', state: stPB, role: '누르는 동안만 ON(a접점). 1번 줄에서 K1을 여자시켜 사이클을 시작. 손을 떼도 K1 자기유지 덕분에 계속 동작해요. (회로도의 PB1 접점을 직접 눌러도 됩니다)' },
      K1: { part: 'relay', name: '릴레이 K1 (전진 기억)', state: stK('K1'), role: '1번 줄: PB1로 여자 → 자기 a접점으로 <b>자기유지</b>. 4번 줄 a접점으로 Y2 통전. 1번 줄의 K2 b접점이 열리면 해제.' },
      K2: { part: 'relay', name: '릴레이 K2 (후진 기억)', state: stK('K2'), role: '2번 줄: LS2로 여자 → 자기유지. 1번 줄 <b>b접점으로 K1 해제</b>(인터록), 5번 줄 a접점으로 Y1 통전. 2번 줄 K3 b접점이 열리면 해제.' },
      K3: { part: 'relay', name: '릴레이 K3 (원위치 검출)', state: stK('K3'), role: '3번 줄: LS1이 눌려 있으면 여자. 2번 줄 <b>K3 b접점</b>으로 K2를 끊어 사이클을 마무리. 초기 상태에서도 켜져 있어 K2가 엉뚱하게 켜지는 것을 막아요.' },
    },
    quiz: [
      { ws: true, q: '① 의 이름은?', ref: 'cyl', answer: '복동 실린더', options: ['복동 실린더', '단동 실린더', '요동 액추에이터', '유압 모터'], why: '양쪽 포트에 모두 압유를 넣어 전진·후진을 유압으로 하므로 복동!' },
      { ws: true, q: '② 의 이름은?', ref: 'LS2', answer: '리밋 스위치', options: ['리밋 스위치', '푸시 버튼', '압력 스위치', '근접 센서'], why: '로드 끝 도그가 기계적으로 눌러 ON/OFF 신호를 만들어요.' },
      { ws: true, q: '③ 의 이름은?', ref: 'fcv', answer: '일방향 유량제어 밸브', options: ['일방향 유량제어 밸브', '체크 밸브', '압력 보상 밸브', '감압 밸브'], why: '교축 밸브 + 체크 밸브 병렬 = 한 방향만 유량 제어.' },
      { ws: true, q: '④ 의 이름은?', ref: 'pc', answer: '파일럿 작동 체크 밸브', options: ['파일럿 작동 체크 밸브', '체크 밸브', '시퀀스 밸브', '카운터 밸런스 밸브'], why: '박스 안 체크 밸브 + 점선(파일럿) 연결 = 파일럿 작동 체크 밸브.' },
      { ws: true, q: '⑤ 의 이름은?', ref: 'Y1', answer: '4/2-way 편솔레노이드 밸브', options: ['4/2-way 편솔레노이드 밸브', '4/2-way 양솔레노이드 밸브', '4/3-way 양솔레노이드 밸브', '3/2-way 편솔레노이드 밸브'], why: '포트 4개(P,T,A,B), 위치 2개, 한쪽 솔레노이드 + 반대쪽 스프링.' },
      { ws: true, q: '⑥ 의 이름은?', ref: 'Y2', answer: '3/2-way 편솔레노이드 밸브', options: ['3/2-way 편솔레노이드 밸브', '2/2-way 편솔레노이드 밸브', '4/2-way 편솔레노이드 밸브', '3/2-way 수동 밸브'], why: '포트 3개(P,T,A), 위치 2개, 솔레노이드+스프링. 평소 P가 막힌 NC형.' },
      { ws: true, q: '⑦ 의 이름은?', ref: 'relief', answer: '압력 릴리프 밸브', options: ['압력 릴리프 밸브', '감압 밸브', '시퀀스 밸브', '언로딩 밸브'], why: '입구 압력(점선 파일럿)이 스프링보다 커지면 열려 탱크로 배출.' },
      { ws: true, q: '⑧ 의 이름은?', ref: 'pu', answer: '유압 동력 발생장치 (파워 유닛)', options: ['유압 동력 발생장치 (파워 유닛)', '어큐뮬레이터', '유압 모터', '오일 냉각기'], why: '모터 + 펌프 + 필터 + 탱크 + 안전 릴리프를 한 덩어리로 묶은 것.' },
      { ws: true, q: '⑨ 의 이름은?', ref: 'g9', answer: '압력계', options: ['압력계', '유량계', '온도계', '압력 스위치'], why: '원 안에 대각선 화살표 = 압력계.' },
      { q: '실린더가 <b>전진</b>하는 동안 통전된 솔레노이드는?', answer: 'Y2만', options: ['Y1만', 'Y2만', 'Y1과 Y2 모두', '없음'], why: 'Y1이 꺼진 스프링 위치(평행)가 전진 방향이에요. Y2는 ④를 열어 주는 열쇠.' },
      { q: '이 회로의 <b>전진</b> 속도 제어 방식은?', answer: '미터-아웃', options: ['미터-인', '미터-아웃', '블리드-오프', '제어 없음'], why: '③이 로드 측 "배출" 오일을 조이므로 미터-아웃.' },
      { q: '1번 줄 <b>K2 b접점</b>의 역할은?', answer: 'K2가 켜지면 K1 자기유지를 끊는다', options: ['K2가 켜지면 K1 자기유지를 끊는다', 'K1이 켜지면 K2를 끊는다', 'PB1 대신 K1을 켜 준다', 'Y1을 직접 켠다'], why: '전진 기억을 지우는 인터록.' },
      { q: '실린더가 정지(로킹)해 있을 때 펌프 오일은 어디로 갈까?', answer: '릴리프 밸브를 통해 탱크로', options: ['릴리프 밸브를 통해 탱크로', '실린더 헤드 측으로 계속 들어감', '펌프가 자동으로 멈춤', 'Y2 밸브로 빠짐'], why: '정용량 펌프는 계속 토출하므로 남는 오일은 릴리프로!' },
    ],
  };

  /* =====================================================================
     실습과제 2
     ===================================================================== */
  const T2 = {
    id: 't2', title: '실습과제 2', name: '급속 전진 → 감속(배압) 전진 → 급속 후진',
    goal: `PB1 → <b>1단 급속 전진</b> → LS2에서 ${R('Y3')}가 바이패스를 막아 <b>로드 측에 3 MPa 배압</b> → <b>2단 감속 전진</b> → LS3에서 <b>급속 후진</b> → LS1에서 K4가 전체 리셋, ${R('V43', '4/3 밸브')} 중립(올 포트 블록)으로 정지.`,
    relays: ['K1', 'K2', 'K3', 'K4'], sols: ['Y1', 'Y2', 'Y3'],
    ls: { LS1: 0, LS2: 0.5, LS3: 1 },
    signals: ['PB1', 'LS1', 'LS2', 'LS3', 'K1', 'K2', 'K3', 'K4', 'Y1', 'Y2', 'Y3'],
    readouts: [['pump', '펌프 압력'], ['rodp', '로드측 압력계'], ['cyl', '실린더 동작'], ['pos', '로드 위치']],
    readoutValues: commonReadouts,
    ladder: [
      { top: [C('PB1', 'no', 'pb'), C('K1')], ser: [C('K4', 'nc')], coil: { ref: 'K1', kind: 'relay' } },
      { top: [C('LS2', 'no', 'ls'), C('K2')], ser: [C('K1')], coil: { ref: 'K2', kind: 'relay' } },
      { top: [C('LS3', 'no', 'ls'), C('K3')], ser: [C('K2')], coil: { ref: 'K3', kind: 'relay' } },
      { top: [C('LS1', 'no', 'ls', true), C('K4')], ser: [C('K3')], coil: { ref: 'K4', kind: 'relay' } },
      { top: [C('K1')], ser: [C('K3', 'nc')], coil: { ref: 'Y1', kind: 'sol' } },
      { top: [C('K3')], ser: [], coil: { ref: 'Y2', kind: 'sol' } },
      { top: [C('K2')], ser: [C('K3', 'nc')], coil: { ref: 'Y3', kind: 'sol' } },
    ],
    valves: {
      V43: { name: '4/3 밸브', home: 1, target: s => (s.Y1 && !s.Y2) ? 0 : (s.Y2 && !s.Y1) ? 2 : 1, posNames: ['왼쪽 위치 (P→A, B→T)', '중립 (올 포트 블록)', '오른쪽 위치 (P→B, A→T)'] },
      Y3: { name: 'Y3 밸브(2/2)', home: 1, target: s => s.Y3 ? 0 : 1, posNames: ['닫힘 (차단)', '열림 (통과)'] },
    },
    hydSize: [770, 920],
    build(D) {
      const cyl = HYD.Cylinder(D, { ref: 'cyl', x: 100, y: 140, w: 270, h: 50, stroke: 200, rodOut: 50, headPortX: 112, rodPortX: 358 });
      const ls = ['LS1', 'LS2', 'LS3'].map(k => HYD.LimitSwitch(D, { ref: k, x: cyl.lsX(T2.ls[k]), rollerY: cyl.dogTop - 6, label: k }));
      D.line('head_low', [[322, 560], [322, 530], [112, 530], [112, 360]]);
      D.line('fcv', [[112, 360], [112, 280]]);
      D.line('head_top', [[112, 280], [112, 190]]);
      D.line('rod_low', [[358, 560], [358, 500]]);
      D.line('r3_out', [[358, 500], [358, 424]]);
      D.line('r3_in', [[358, 380], [358, 300]]);
      D.line('rod_top', [[358, 300], [358, 190]]);
      D.line('byp_low', [[358, 500], [600, 500], [600, 440]]);
      D.line('byp_top', [[600, 390], [600, 300], [358, 300]]);
      D.line('g_rod', [[600, 300], [600, 275]]);
      D.line('vp', [[322, 670], [322, 612]]);
      D.line('vt', [[358, 612], [358, 634]]);
      HYD.tank(D, 358, 626);
      D.dot(358, 300); D.dot(358, 500); D.dot(600, 300);
      const pcf = HYD.PCFCV(D, { ref: 'pcfcv', x: 112, yTop: 280, yBot: 360 });
      const bp = HYD.Relief(D, { ref: 'bp', orient: 'v', x: 358, y: 402 });
      const grod = HYD.Gauge(D, { ref: 'grod', x: 600, y: 262, r: 13, vx: 600, vy: 236 });
      const v43 = HYD.DirValve(D, { ref: 'V43', x0: 232, y: 560, home: 1, ports: PORTS4,
        squares: [[['a', 'P', 'A'], ['a', 'B', 'T']], [['b', 'A'], ['b', 'B'], ['b', 'P'], ['b', 'T']], [['a', 'P', 'B'], ['a', 'A', 'T']]],
        left: ['spring', 'sol'], right: ['spring', 'sol'], labelL: 'Y1', labelR: 'Y2', refL: 'Y1', refR: 'Y2' });
      const y3 = HYD.DirValve(D, { ref: 'Y3', x0: 516, y: 390, w: 56, h: 50, home: 1, ports: { U: [0.5, 't'], D: [0.5, 'b'] },
        squares: [[['b', 'U'], ['b', 'D']], [['d', 'D', 'U']]], left: ['sol'], right: ['spring'], labelL: 'Y3', refL: 'Y3' });
      const sup = HYD.Supply(D, { px: 322, my: 670, numbered: false });
      D.label(386, 374, '3±0.5MPa', 'svg-label');
      D.plain('배압용 릴리프 밸브', 370, 456, 'bp');
      D.tag({ num: '①', name: '압력보상형 유량제어 밸브', x: 142, y: 326, ref: 'pcfcv' });
      D.tag({ num: '②', name: '4/3-way 양솔 밸브', x: 128, y: 552, ref: 'V43' });
      D.tag({ num: '③', name: '2/2-way 편솔 밸브', x: 612, y: 472, ref: 'Y3' });
      return sim => {
        const h = sim.hyd;
        cyl.update(sim.s, h.chambers.head, h.chambers.rod);
        ls.forEach((l, i) => l.update(sim.ls['LS' + (i + 1)]));
        v43.update(sim.valves.V43.pos, { L: sim.sols.Y1, R: sim.sols.Y2 }, h.vf.V43);
        y3.update(sim.valves.Y3.pos, { L: sim.sols.Y3 }, h.vf.Y3);
        bp.update(h.bpOpen, (sim.disp.rodp || 0) > 0.4, true);
        grod.update(sim.disp.rodp || 0);
        sup.update(sim.disp.pump, h.reliefOpen);
        D.applyLines(h.lines);
      };
    },
    resolve(sim) {
      const v = sim.valves.V43.pos, y3open = sim.valves.Y3.pos === 1, s = sim.s;
      const L = {}, vf = { V43: {}, Y3: {} };
      const out = { lines: L, vf, checks: {}, chambers: { head: 'idle', rod: 'idle' } };
      let motion = 0, speed = 0, relief = true, pump = 5.0, bpOpen = false, rodp = 0, status = '';
      const CYL = ['head_low', 'fcv', 'head_top', 'rod_low', 'r3_out', 'r3_in', 'rod_top', 'byp_low', 'byp_top', 'g_rod'];
      if (v === 1) {
        vf.V43 = { xP: 'ps', xA: 'lock', xB: 'lock' };
        status = '정지 · 중립(올 포트 블록)으로 고정';
        for (const k of CYL) L[k] = ['lock', 0];
        L.vp = ['ps', 0];
        out.chambers = { head: 'lock', rod: 'lock' };
        if (y3open) vf.Y3['D>U'] = 'lock';
      } else if (v === 0) {
        vf.V43['P>A'] = 'p';
        if (s < 1) {
          motion = 1;
          if (y3open) { speed = 1.0; pump = 2.0; relief = false; rodp = 0.2; status = '1단 급속 전진 · 배압 없음'; }
          else { speed = 0.45; pump = 3.5; relief = false; bpOpen = true; rodp = 3.0; status = '2단 감속 전진 · 로드측 배압 3 MPa'; }
          const sp = speed;
          L.vp = ['p', 1, sp]; L.head_low = ['p', 1, sp]; L.fcv = ['p', 1, sp]; L.head_top = ['p', 1, sp];
          L.rod_top = ['r', -1, sp]; L.rod_low = ['r', -1, sp]; L.vt = ['r', 1, sp];
          vf.V43['B>T'] = 'r';
          if (y3open) {
            L.r3_in = ['rs', 0]; L.r3_out = ['rs', 0]; L.byp_top = ['r', -1, sp]; L.byp_low = ['r', -1, sp]; L.g_rod = ['rs', 0];
            vf.Y3['U>D'] = 'r';
          } else {
            L.r3_in = ['r', -1, sp]; L.r3_out = ['r', -1, sp]; L.byp_top = ['rs', 0]; L.g_rod = ['rs', 0];
            vf.Y3.xU = 'r';
          }
          out.chambers = { head: 'p', rod: 'r' };
        } else {
          status = '전진 끝 도달';
          L.vp = ['ps', 0]; L.head_low = ['ps', 0]; L.fcv = ['ps', 0]; L.head_top = ['ps', 0];
          out.chambers = { head: 'ps', rod: 'idle' };
        }
      } else {
        vf.V43['P>B'] = 'p';
        if (s > 0 && y3open) {
          motion = -1; speed = 1.25; pump = 1.6; relief = false; rodp = 1.6; status = '급속 후진 · Y3 열림';
          const sp = speed;
          L.vp = ['p', 1, sp]; L.rod_low = ['p', 1, sp]; L.byp_low = ['p', 1, sp]; L.byp_top = ['p', 1, sp]; L.rod_top = ['p', 1, sp];
          L.r3_out = ['ps', 0]; L.r3_in = ['ps', 0]; L.g_rod = ['ps', 0];
          L.head_top = ['r', -1, sp]; L.fcv = ['r', -1, sp]; L.head_low = ['r', -1, sp]; L.vt = ['r', 1, sp];
          vf.V43['A>T'] = 'r'; vf.Y3['D>U'] = 'p';
          out.chambers = { head: 'r', rod: 'p' };
        } else {
          status = s <= 0 ? '후진 끝 도달' : '후진 불가 (Y3 닫힘)';
          L.vp = ['ps', 0]; L.rod_low = ['ps', 0]; L.byp_low = ['ps', 0]; L.r3_out = ['ps', 0];
          if (y3open) { L.byp_top = ['ps', 0]; L.rod_top = ['ps', 0]; L.r3_in = ['ps', 0]; L.g_rod = ['ps', 0]; rodp = 5.0; out.chambers = { head: 'idle', rod: 'ps' }; }
        }
      }
      supplyLines(L, relief);
      return Object.assign(out, { motion, speed, reliefOpen: relief, pump, rodp, bpOpen, status });
    },
    phase(sim) {
      const K = k => { const r = sim.relays[k]; return r.on || !!(r.pend && r.pend.target); };
      if (K('K4')) return 4;
      if (K('K3') && sim.ls.LS1) return 4;
      if (K('K3')) return 3;
      if (K('K2') && sim.ls.LS3) return 3;
      if (K('K2')) return 2;
      if (K('K1') && sim.ls.LS2) return 2;
      if (K('K1')) return 1;
      return 0;
    },
    phases: [
      {
        n: '초기 상태', short: '대기 (중립 정지)', sub: 'LS1 ON · 릴레이 모두 OFF', pause: 'settle',
        title: '초기 상태 — 대기 (4/3 밸브 중립)',
        lead: `실린더는 후진 끝에서 ${R('LS1')}을 누르고 있지만, 릴레이·솔레노이드는 <b>모두 꺼져</b> 있어요. ${R('V43', '② 4/3 밸브')}가 가운데(중립)에서 모든 길을 막고 있습니다.`,
        el: [
          `4번 줄: ${R('LS1')}은 눌려 있지만 직렬의 <b>K3 a접점이 열려</b> 있어 ${R('K4')}는 OFF`,
          `${R('K1')}~${R('K4')} 모두 소자 → ${R('Y1')}, ${R('Y2')}, ${R('Y3')} 모두 소자`,
        ],
        hy: [
          `② 4/3 밸브는 양쪽 스프링에 의해 <b>중립(올 포트 블록)</b>: P, T, A, B 모두 막힘`,
          `실린더 양쪽 오일이 ${LK('갇혀')} 있어 그 자리에 정지·고정`,
          `${R('Y3', '③ Y3')}는 소자 상태라 <b>열려 있음</b>(N/O, 평상시 열림)`,
          `펌프 오일은 갈 곳이 없어 ${R('relief', '릴리프 밸브')}로 ${B('탱크 복귀')}`,
        ],
        tip: '<b>올 포트 블록(클로즈드 센터)</b> 중립 = 어떤 위치에서든 실린더를 딱 멈추고 버티게 하는 밸브. 양쪽 솔레노이드가 모두 꺼지면 스프링이 가운데로 돌려놔요.',
      },
      {
        n: '1단계', short: '1단 급속 전진', sub: 'PB1 → K1 → Y1', pause: 'settle',
        title: '1단계 — 1단 급속 전진 (PB1 → K1 → Y1, Y3 열림)',
        lead: `${R('PB1')}으로 ${R('K1')}이 켜지고 ${R('Y1')}이 통전돼 전진합니다. 로드 측 오일은 ${R('Y3')}가 열어 둔 <b>지름길</b>로 저항 없이 빠져나가요.`,
        el: [
          `${R('PB1')} → 1번 줄 (K4 b 닫힘) → ${R('K1')} 여자 + <b>자기유지</b>`,
          `5번 줄: K1 a 닫힘, K3 b 닫힘 → ${R('Y1')} 통전`,
          `2번 줄의 K1 a접점도 닫힘 → LS2 신호를 받을 준비`,
          `실린더가 출발하면 ${R('LS1')} 해제`,
        ],
        hy: [
          `② 4/3 밸브 <b>왼쪽 위치</b>(평행): ${P('P→A')}, ${B('B→T')}`,
          `펌프 → A → ${R('pcfcv', '① 압력보상 밸브')} → 헤드 측 → 전진`,
          `로드 측 오일 → ${R('Y3', '③ Y3')}(열림) → B → T → ${B('탱크')}`,
          `${R('bp', '3 MPa 릴리프')}는 <b>우회(바이패스)</b>돼서 배압이 거의 없음 (로드측 압력계 ≈ 0)`,
        ],
        tip: '압력은 "막는 곳"이 있어야 생겨요. Y3가 열린 지름길 덕분에 로드 측 오일이 저항 없이 빠지니 배압 ≈ 0 → 빠른 전진.',
      },
      {
        n: '2단계', short: '2단 감속(배압) 전진', sub: 'LS2 → K2 → Y3 차단', pause: 'settle',
        title: '2단계 — 2단 감속(배압) 전진 (LS2 → K2 → Y3 통전)',
        lead: `중간 위치의 ${R('LS2')}가 눌리면 ${R('Y3')}가 지름길을 <b>막아요</b>. 이제 로드 측 오일은 <b>3 MPa 릴리프 밸브를 억지로 밀고</b> 나가야 하므로 강한 배압이 생깁니다.`,
        el: [
          `${R('LS2')} 눌림 → 2번 줄 (K1 a 닫힘) → ${R('K2')} 여자 + 자기유지`,
          `7번 줄: K2 a 닫힘, K3 b 닫힘 → ${R('Y3')} 통전`,
          `${R('Y1')}은 계속 통전 (5번 줄 그대로)`,
          `3번 줄의 K2 a접점 닫힘 → LS3 신호를 받을 준비`,
        ],
        hy: [
          `${R('Y3', '③ Y3')} 통전 → <b>닫힘</b>: 바이패스 차단`,
          `로드 측 오일 → ${R('bp', '3±0.5 MPa 릴리프')}를 밀어 열고 통과 → B → T`,
          `로드 측에 <b>3 MPa 배압</b> 형성 (${R('grod', '로드측 압력계')} ≈ 3 MPa)`,
          `피스톤이 반대편에서도 눌리는 "브레이크가 걸린" 상태 → <b>감속·안정 이송</b> (가공 이송 구간)`,
          `헤드 측 공급은 ${R('pcfcv', '① 압력보상 밸브')}가 계속 일정하게 유지`,
        ],
        tip: '배압 회로는 부하가 갑자기 변하거나 실린더가 앞으로 끌려가도 <b>튀어나가지 않게</b> 잡아줘요. (카운터밸런스 효과)',
        deep: ['🤔 노트의 "감속"과 "유량 일정", 서로 모순 아닌가요?', '노트 7쪽은 "압력보상 밸브가 배압이 생겨도 유량을 일정하게 유지한다"고 하고, 6쪽은 "감속 전진"이라고 해요. 이론상 <b>이상적인 압력보상 밸브</b>라면 실린더로 들어가는 유량(=속도)은 거의 그대로이고, 배압의 진짜 효과는 속도를 "뚝" 떨어뜨리는 게 아니라 <b>부하 변동에도 튀지 않는 안정성(브레이크)</b>이에요. 압력보상 밸브가 없는 일반 교축 밸브였다면 배압 순간 공급 유량이 확 줄어 속도가 뚝 떨어지고 불안정해졌을 거예요.<br><br>이 시뮬레이터는 과제의 의도(1단 급속 → 2단 감속)를 보여주려고 2단계 속도를 낮게 표현했어요. 시험에서는 과제지 표현대로 <b>"Y3 차단 → 3 MPa 배압 형성 → 감속 전진"</b>으로 답하면 됩니다.'],
      },
      {
        n: '3단계', short: '급속 후진', sub: 'LS3 → K3 → Y2', pause: 'settle',
        title: '3단계 — 급속 후진 (LS3 → K3 → Y1·Y3 소자, Y2 통전)',
        lead: `전진 끝 ${R('LS3')}가 눌리면 ${R('K3')} 하나가 <b>b접점으로 Y1·Y3를 끄고</b>, <b>a접점으로 Y2를 켜서</b> 방향을 뒤집어요.`,
        el: [
          `${R('LS3')} 눌림 → 3번 줄 (K2 a 닫힘) → ${R('K3')} 여자 + 자기유지`,
          `K3 <b>b접점</b>(5번·7번 줄) 열림 → ${R('Y1')}, ${R('Y3')} 소자`,
          `K3 <b>a접점</b>(6번 줄) 닫힘 → ${R('Y2')} 통전`,
          `4번 줄의 K3 a접점 닫힘 → LS1 신호를 받을 준비`,
        ],
        hy: [
          `② 4/3 밸브 <b>오른쪽 위치</b>(교차): ${P('P→B')}, ${B('A→T')}`,
          `${R('Y3')} 소자 → 다시 <b>열림</b>: 펌프 → B → Y3 → 로드 측 → 후진`,
          `${R('bp', '3 MPa 릴리프')}는 한 방향(위→아래)만 열리므로 이 방향으론 통과 안 함`,
          `헤드 측 오일 → ① → A → T → ${B('탱크')}`,
          `저항 없는 경로 + 작은 로드 측 면적 → <b>급속 후진</b>`,
        ],
        tip: '후진할 때 Y3가 반드시 열려 있어야 해요! 3 MPa 릴리프 밸브는 역방향으로 오일을 보내 주지 못하기 때문에, Y3가 닫혀 있으면 후진할 수 없어요.',
      },
      {
        n: '4단계', short: '후진 완료·정지', sub: 'LS1 → K4 → 전체 리셋', pause: 'enter',
        title: '4단계 — 후진 완료 & 정지 (LS1 → K4 → 도미노 리셋)',
        lead: `${R('LS1')}이 눌리면 ${R('K4')}가 켜지고, 릴레이들이 <b>도미노처럼</b> 차례로 꺼집니다. (릴레이 속도를 "아주 천천히"로 두면 순서가 잘 보여요)`,
        el: [
          `${R('LS1')} 눌림 → 4번 줄 (K3 a 닫힘) → ${R('K4')} 여자`,
          `K4 b접점(1번 줄) 열림 → ${R('K1')} 소자`,
          `→ 2번 줄 K1 a 열림 → ${R('K2')} 소자 → 3번 줄 K2 a 열림 → ${R('K3')} 소자`,
          `→ 4번 줄 K3 a 열림 → ${R('K4')} 소자 / 6번 줄 K3 a 열림 → ${R('Y2')} 소자`,
        ],
        hy: [
          `Y1, Y2 모두 소자 → 양쪽 스프링이 ② 4/3 밸브를 <b>중립</b>으로 복귀`,
          `모든 포트 차단 → 실린더 정지·고정 (${LK('갇힌 오일')})`,
          `펌프 오일 → ${R('relief', '릴리프 밸브')} → 탱크`,
        ],
        tip: 'K4는 "리셋 전용" 릴레이예요. 자신이 켜지면 K1부터 끊고, 결국 자기 자신까지 꺼지면서 회로 전체가 초기 상태로 돌아갑니다.',
      },
    ],
    info: {
      cyl: { part: 'cyl', state: stCyl, name: '복동 실린더 A', role: '헤드 측 공급 → 전진, 로드 측 공급 → 후진. 도그가 LS1(후진 끝), LS2(중간), LS3(전진 끝)를 차례로 눌러요.' },
      LS1: { part: 'ls', name: '리밋 스위치 LS1 (후진 끝)', state: stLS('LS1'), role: '후진 완료 검출. 4번 줄에서 K3 a와 직렬 → 후진이 끝났을 때만 K4를 켜서 전체 리셋. 시작할 때 이미 눌려 있음(⇧).' },
      LS2: { part: 'ls', name: '리밋 스위치 LS2 (중간)', state: stLS('LS2'), role: '감속 전환 위치. 2번 줄 K2 여자 → Y3 통전 → 배압 형성.' },
      LS3: { part: 'ls', name: '리밋 스위치 LS3 (전진 끝)', state: stLS('LS3'), role: '전진 완료 검출. 3번 줄 K3 여자 → 후진 전환.' },
      pcfcv: { part: 'pcfcv', num: '①', state: sim => sim.hyd.motion > 0 ? '설정 유량을 헤드 측에 공급 중' : '대기', role: '헤드 측(공급) 라인에서 실린더로 들어가는 유량을 제어(<b>미터-인</b>). 압력 보상 기능이 있어서 2단계에서 갑자기 3 MPa 배압이 걸려도 공급 유량이 들쭉날쭉하지 않게 일정하게 유지해요.' },
      V43: { part: 'v43', num: '②', name: '4/3-way 양솔레노이드 밸브 (올 포트 블록)', state: sim => T2.valves.V43.posNames[sim.valves.V43.pos], role: 'Y1 통전 → 왼쪽(P→A, B→T) 전진 / Y2 통전 → 오른쪽(P→B, A→T) 후진 / 둘 다 소자 → 스프링 센터 <b>중립: 모든 포트 차단</b> → 정지·고정.' },
      Y1: { part: 'sol', name: '솔레노이드 Y1 (4/3 밸브 왼쪽)', state: sim => sim.sols.Y1 ? '통전 (ON)' : '소자 (OFF)', role: '5번 줄: K1 a & K3 b 직렬. 통전되면 4/3 밸브를 왼쪽 위치로 → 전진. K3가 켜지면 b접점이 끊어 줌.' },
      Y2: { part: 'sol', name: '솔레노이드 Y2 (4/3 밸브 오른쪽)', state: sim => sim.sols.Y2 ? '통전 (ON)' : '소자 (OFF)', role: '6번 줄: K3 a. 통전되면 4/3 밸브를 오른쪽 위치로 → 후진.' },
      Y3: { part: 'v22', num: '③', name: '2/2-way 편솔레노이드 밸브 (N/O)', state: sim => (sim.sols.Y3 ? 'Y3 통전 · ' : 'Y3 소자 · ') + T2.valves.Y3.posNames[sim.valves.Y3.pos], role: '3 MPa 릴리프 밸브를 우회하는 <b>지름길</b>. 평소(소자)에는 열려 있어 배압 없이 통과, 통전되면 닫혀서 오일이 릴리프를 밀고 나가야 함 → 배압 형성. 7번 줄: K2 a & K3 b.' },
      bp: { part: 'relief', name: '압력 릴리프 밸브 (배압용, 3±0.5 MPa)', state: sim => sim.hyd.bpOpen ? '열림 · 로드측 오일 통과 (배압 3 MPa)' : '닫힘', role: '로드 측 라인에 직렬로 설치. Y3가 닫혔을 때 로드 측 오일이 3 MPa 이상으로 밀어야만 열림 → 실린더에 <b>배압(브레이크)</b>을 걸어 줌. 한 방향(위→아래)으로만 통과.' },
      grod: { part: 'gauge', name: '압력계 (로드측)', state: sim => (sim.disp.rodp || 0).toFixed(1) + ' MPa', role: '로드 측 배압을 보여줘요. 1단 전진 ≈ 0, 2단 전진 ≈ 3 MPa, 후진 중에는 공급 압력.' },
      relief: { part: 'relief', name: '압력 릴리프 밸브 (시스템)', state: stRelief, role: '시스템 최고 압력 설정. 중립 정지나 행정 끝처럼 오일이 갈 곳이 없을 때 펌프 오일을 탱크로 돌려보냄.' },
      pu: { part: 'pu', state: stPump, role: '모터 + 펌프 + 필터 + 탱크 + 안전 릴리프. 회로에 압유를 공급하는 심장.' },
      g9: { part: 'gauge', state: stPump, role: '펌프 라인 압력 표시.' },
      gpu: { part: 'gauge', name: '압력계 (파워 유닛)', state: stPump, role: '파워 유닛 출구 압력.' },
      PB1: { part: 'pb', state: stPB, role: '시작 버튼. 1번 줄 K1 여자 → 자기유지.' },
      K1: { part: 'relay', name: '릴레이 K1 (시작·전진)', state: stK('K1'), role: '1번 줄 자기유지. 5번 줄로 Y1 통전, 2번 줄 a접점으로 K2의 조건 제공. K4 b접점이 열리면 해제.' },
      K2: { part: 'relay', name: '릴레이 K2 (감속 기억)', state: stK('K2'), role: 'LS2로 여자·자기유지 (K1이 켜져 있을 때만). 7번 줄로 Y3 통전 → 배압. 3번 줄 a접점으로 K3 조건 제공.' },
      K3: { part: 'relay', name: '릴레이 K3 (후진 기억)', state: stK('K3'), role: 'LS3로 여자·자기유지. b접점으로 Y1·Y3 차단, a접점으로 Y2 통전 → 후진. 4번 줄 a접점으로 K4 조건 제공.' },
      K4: { part: 'relay', name: '릴레이 K4 (리셋)', state: stK('K4'), role: 'LS1 & K3 → 여자. 1번 줄 b접점으로 K1을 끊어 K1→K2→K3→K4 순으로 전체 리셋.' },
    },
    quiz: [
      { ws: true, q: '① 의 이름은?', ref: 'pcfcv', answer: '압력 보상 밸브 (압력보상형 유량제어 밸브)', options: ['압력 보상 밸브 (압력보상형 유량제어 밸브)', '일방향 유량제어 밸브', '체크 밸브', '감압 밸브'], why: '박스 안의 ↑ 화살표 = 압력 보상 기능. 부하가 변해도 유량 일정.' },
      { ws: true, q: '② 의 이름은?', ref: 'V43', answer: '4/3-way 양솔레노이드 밸브 (올 포트 블록형)', options: ['4/3-way 양솔레노이드 밸브 (올 포트 블록형)', '4/3-way 양솔레노이드 밸브 (탠덤 센터형)', '4/2-way 편솔레노이드 밸브', '4/2-way 양솔레노이드 밸브'], why: '사각형 3개(위치 3), 가운데 칸 포트가 모두 ⊥⊤로 막힘 = 올 포트 블록.' },
      { ws: true, q: '③ 의 이름은?', ref: 'Y3', answer: '2/2-way 편솔레노이드 밸브 (N/O형)', options: ['2/2-way 편솔레노이드 밸브 (N/O형)', '2/2-way 편솔레노이드 밸브 (N/C형)', '3/2-way 편솔레노이드 밸브', '체크 밸브'], why: '스프링 쪽(평상시) 칸이 ↕ 열림 = 평상시 열림(N/O).' },
      { q: 'LS2 이후 전진이 느려지는(감속) 이유는? (과제 설명 기준)', answer: 'Y3가 닫혀 로드측에 3 MPa 배압이 생겨서', options: ['Y3가 닫혀 로드측에 3 MPa 배압이 생겨서', 'Y1이 꺼져서', '펌프가 느려져서', '① 밸브가 닫혀서'], why: '로드 측 오일이 릴리프 밸브를 3 MPa로 밀어야만 빠져나가요.' },
      { q: '모든 릴레이를 초기화(리셋)시키는 릴레이는?', answer: 'K4', options: ['K1', 'K2', 'K3', 'K4'], why: 'K4 b접점이 1번 줄을 끊으면 도미노처럼 전부 꺼져요.' },
      { q: '후진할 때 Y3가 <b>열려</b> 있어야 하는 이유는?', answer: '3 MPa 릴리프는 역방향으로 오일을 못 보내서', options: ['3 MPa 릴리프는 역방향으로 오일을 못 보내서', '배압을 더 크게 하려고', '헤드 측 오일을 빼려고', 'K4를 켜려고'], why: '릴리프 밸브는 한 방향으로만 열리는 밸브라 Y3가 유일한 공급 통로.' },
      { q: '4/3 밸브가 중립일 때 실린더는?', answer: '모든 포트가 막혀 그 자리에 정지·고정', options: ['모든 포트가 막혀 그 자리에 정지·고정', '천천히 후진', '자유롭게 손으로 움직일 수 있음', '천천히 전진'], why: '올 포트 블록 = 오일이 들어가지도 나가지도 못함.' },
    ],
  };

  /* =====================================================================
     실습과제 3
     ===================================================================== */
  const T3 = {
    id: 't3', title: '실습과제 3', name: '급속 전진 + 미터-인 후진 (헤드측 파일럿 체크)',
    goal: `PB1 → <b>급속 전진</b>(자유 흐름) → LS2에서 <b>미터-인 감속 후진</b> → LS1에서 정지. 과제 1과 비교하면 파일럿 체크 밸브가 <b>헤드 측</b>, 유량제어 밸브의 체크 방향이 <b>반대</b>예요.`,
    relays: ['K1', 'K2', 'K3'], sols: ['Y1', 'Y2'],
    ls: { LS1: 0, LS2: 1 },
    signals: ['PB1', 'LS1', 'LS2', 'K1', 'K2', 'K3', 'Y1', 'Y2'],
    readouts: [['pump', '펌프 압력'], ['relief', '릴리프 밸브'], ['cyl', '실린더 동작'], ['pos', '로드 위치']],
    readoutValues: commonReadouts,
    ladder: [
      { top: [C('PB1', 'no', 'pb'), C('K1')], ser: [C('K2', 'nc')], coil: { ref: 'K1', kind: 'relay' } },
      { top: [C('LS2', 'no', 'ls'), C('K2')], ser: [C('K3', 'nc')], coil: { ref: 'K2', kind: 'relay' } },
      { top: [C('LS1', 'no', 'ls', true)], ser: [], coil: { ref: 'K3', kind: 'relay' } },
      { top: [C('K1')], ser: [C('K2', 'nc')], coil: { ref: 'Y1', kind: 'sol' } },
      { top: [C('K2')], ser: [], coil: { ref: 'Y2', kind: 'sol' } },
    ],
    valves: {
      Y1: { name: 'Y1 밸브(4/2)', home: 1, target: s => s.Y1 ? 0 : 1, posNames: ['평행 위치 (P→A, B→T)', '교차 위치 (P→B, A→T)'] },
      Y2: { name: 'Y2 밸브(3/2)', home: 1, target: s => s.Y2 ? 0 : 1, posNames: ['통전 위치 (P→A, 파일럿 공급)', '스프링 위치 (A→T, 파일럿 배출)'] },
    },
    hydSize: [770, 900],
    build(D) {
      const cyl = HYD.Cylinder(D, { ref: 'cyl', x: 100, y: 140, w: 250, h: 50, stroke: 200, rodOut: 50, headPortX: 112, rodPortX: 340 });
      const ls1 = HYD.LimitSwitch(D, { ref: 'LS1', x: cyl.lsX(0), rollerY: cyl.dogTop - 6, label: 'LS1' });
      const ls2 = HYD.LimitSwitch(D, { ref: 'LS2', x: cyl.lsX(1), rollerY: cyl.dogTop - 6, label: 'LS2' });
      D.line('head_top', [[112, 320], [112, 190]]);
      D.line('pc_in', [[112, 400], [112, 320]]);
      D.line('head_low', [[304, 530], [304, 500], [112, 500], [112, 400]]);
      D.line('rod_low', [[340, 530], [340, 302]]);
      D.line('thr', [[340, 302], [340, 238]]);
      D.line('byp', [[340, 302], [375, 302], [375, 238], [340, 238]]);
      D.line('rod_top', [[340, 238], [340, 190]]);
      D.line('pilot', 'M124 400 L124 452 L333 452 A7 7 0 0 1 347 452 L608 452 L608 530', { pilot: true });
      D.line('y1p', [[304, 650], [304, 582]]);
      D.line('y1t', [[340, 582], [340, 604]]);
      D.line('main_r', [[304, 650], [608, 650], [608, 582]]);
      D.line('y2t', [[644, 582], [644, 604]]);
      HYD.tank(D, 340, 596); HYD.tank(D, 644, 596);
      D.dot(340, 238); D.dot(340, 302);
      const pc = HYD.PilotCheck(D, { ref: 'pc', x: 112, yTop: 320, yBot: 400 });
      const fcv = HYD.OneWayFCV(D, { ref: 'fcv', x: 340, cy: 270, box: [296, 222, 392, 318], bypassX: 375, checkDir: 'down', flipArrow: true });
      const y1 = HYD.DirValve(D, { ref: 'Y1', x0: 214, y: 530, home: 1, ports: PORTS4,
        squares: [[['a', 'P', 'A'], ['a', 'B', 'T']], [['a', 'P', 'B'], ['a', 'A', 'T']]], left: ['sol'], right: ['spring'], labelL: 'Y1', refL: 'Y1' });
      const y2 = HYD.DirValve(D, { ref: 'Y2', x0: 518, y: 530, home: 1, ports: PORTS3,
        squares: [[['a', 'P', 'A'], ['b', 'T']], [['b', 'P'], ['a', 'A', 'T']]], left: ['sol'], right: ['spring'], labelL: 'Y2', refL: 'Y2' });
      const sup = HYD.Supply(D, { px: 304, my: 650, numbered: false });
      D.plain('파일럿 작동 체크 밸브', 142, 366, 'pc');
      D.plain('일방향 유량제어 밸브', 402, 275, 'fcv');
      D.plain('4/2-way 편솔 밸브', 150, 522, 'Y1');
      D.plain('복동 실린더', 124, 126, 'cyl');
      D.tag({ num: '①', name: '3/2-way 편솔 밸브', x: 620, y: 522, ref: 'Y2' });
      return sim => {
        const h = sim.hyd;
        cyl.update(sim.s, h.chambers.head, h.chambers.rod);
        ls1.update(sim.ls.LS1); ls2.update(sim.ls.LS2);
        y1.update(sim.valves.Y1.pos, { L: sim.sols.Y1 }, h.vf.Y1);
        y2.update(sim.valves.Y2.pos, { L: sim.sols.Y2 }, h.vf.Y2);
        pc.update(h.checks.pc); fcv.update(h.checks.fcv);
        sup.update(sim.disp.pump, h.reliefOpen);
        D.applyLines(h.lines);
      };
    },
    resolve(sim) {
      const v1 = sim.valves.Y1.pos, pil = sim.valves.Y2.pos === 0, s = sim.s;
      const L = {}, vf = { Y1: {}, Y2: {} };
      const out = { lines: L, vf, checks: { pc: false, fcv: false }, chambers: { head: 'idle', rod: 'idle' } };
      let motion = 0, speed = 0, relief = true, pump = 5.0, status = '';
      L.main_r = ['ps', 0];
      if (pil) { L.pilot = ['pilot', 0]; vf.Y2['P>A'] = 'pilot'; out.checks.pc = true; } else vf.Y2.xP = 'ps';
      if (v1 === 0) { // 평행: P→A(헤드), B→T
        vf.Y1['P>A'] = 'p';
        if (s < 1) {
          motion = 1; speed = 1.0; pump = 1.6; relief = false; status = '급속 전진 · 교축 없음';
          const v = speed;
          L.y1p = ['p', 1, v]; L.head_low = ['p', 1, v]; L.pc_in = ['p', 1, v]; L.head_top = ['p', 1, v];
          L.rod_top = ['r', -1, v]; L.byp = ['r', -1, v]; L.thr = ['rs', 0]; L.rod_low = ['r', -1, v]; L.y1t = ['r', 1, v];
          vf.Y1['B>T'] = 'r';
          out.checks = { pc: true, fcv: true }; out.chambers = { head: 'p', rod: 'r' };
        } else {
          status = '전진 끝 도달';
          L.y1p = ['ps', 0]; L.head_low = ['ps', 0]; L.pc_in = ['ps', 0]; L.head_top = ['ps', 0];
          out.chambers = { head: 'ps', rod: 'idle' };
        }
      } else { // 교차: P→B(로드), A→T
        vf.Y1['P>B'] = 'p';
        if (pil && s > 0) {
          motion = -1; speed = 0.38; pump = 5.0; relief = true; status = '후진 중 · 미터-인 저속';
          const v = speed;
          L.y1p = ['p', 1, v]; L.rod_low = ['p', 1, v]; L.thr = ['p', 1, v]; L.byp = ['ps', 0]; L.rod_top = ['p', 1, v];
          L.head_top = ['r', -1, v]; L.pc_in = ['r', -1, v]; L.head_low = ['r', -1, v]; L.y1t = ['r', 1, v];
          vf.Y1['A>T'] = 'r';
          out.checks = { pc: true, fcv: false }; out.chambers = { head: 'r', rod: 'p' };
        } else {
          L.y1p = ['ps', 0];
          for (const k of ['rod_low', 'thr', 'byp', 'rod_top']) L[k] = ['ps', 0];
          out.chambers.rod = 'ps';
          if (pil) status = '후진 끝 도달';
          else {
            status = '정지 · 로킹 (파일럿 체크가 헤드측 출구 차단)';
            L.head_top = ['lock', 0]; L.pc_in = ['lock', 0];
            out.chambers.head = 'lock';
          }
        }
      }
      supplyLines(L, relief);
      return Object.assign(out, { motion, speed, reliefOpen: relief, pump, status });
    },
    phase(sim) {
      const K = k => { const r = sim.relays[k]; return r.on || !!(r.pend && r.pend.target); };
      if (K('K2') && (K('K3') || sim.ls.LS1)) return 3;
      if (K('K2')) return 2;
      if (K('K1') && sim.ls.LS2) return 2;
      if (K('K1')) return 1;
      return 0;
    },
    phases: [
      {
        n: '초기 상태', short: '대기 (로킹)', sub: 'LS1 ON → K3 여자', pause: 'settle',
        title: '초기 상태 — 대기 (헤드측 로킹)',
        lead: `과제 1과 반대로, 이번엔 <b>로드 측</b>에 압력이 걸려 있고 <b>헤드 측</b> 출구를 ${R('pc', '파일럿 체크 밸브')}가 막고 있어요.`,
        el: [
          `3번 줄: ${R('LS1')} 눌림 → ${R('K3')} 여자 → 2번 줄 K3 b접점 열림`,
          `${R('K1')}, ${R('K2')}, ${R('Y1')}, ${R('Y2')} 모두 OFF`,
        ],
        hy: [
          `${R('Y1')} 소자 = 스프링 위치(<b>교차 X</b>): ${P('P→B')} → ${R('fcv', '일방향 유량제어 밸브')}를 거쳐 <b>로드 측</b>에 압력`,
          `헤드 측 오일은 ${R('pc', '파일럿 체크 밸브')}에 막혀 ${LK('갇힘')} → 실린더 로킹 (후진 끝에서 고정)`,
          `남는 펌프 오일 → ${R('relief', '릴리프 밸브')} → ${B('탱크')}`,
        ],
        tip: '과제 3의 Y1은 과제 1과 그림이 반대예요: <b>통전 = 평행(전진)</b>, <b>소자 = 교차(후진 방향)</b>. 밸브 그림에서 스프링 쪽 칸이 평상시 상태!',
      },
      {
        n: '1단계', short: '급속 전진', sub: 'PB1 → K1 → Y1', pause: 'settle',
        title: '1단계 — 급속 전진 (PB1 → K1 → Y1 통전)',
        lead: `${R('Y1')}이 통전되면 헤드 측으로 오일이 들어가요. 들어가는 길(파일럿 체크 정방향)도, 나가는 길(유량제어 밸브의 체크)도 모두 <b>자유 흐름</b>이라 최고 속도로 전진합니다.`,
        el: [
          `${R('PB1')} → 1번 줄 (K2 b 닫힘) → ${R('K1')} 여자 + <b>자기유지</b>`,
          `4번 줄: K1 a 닫힘 + K2 b 닫힘 → ${R('Y1')} 통전`,
          `실린더 출발 → ${R('LS1')} 해제 → ${R('K3')} 소자 → 2번 줄 K3 b 닫힘 (LS2 준비)`,
        ],
        hy: [
          `${R('Y1')} <b>평행 위치</b>: ${P('P→A')}, ${B('B→T')}`,
          `펌프 → A → ${R('pc', '파일럿 체크')}(아래→위 <b>정방향</b>이라 그냥 열림) → 헤드 → 전진`,
          `로드 측 오일(위→아래) → ${R('fcv', '일방향 유량제어 밸브')}의 <b>체크 밸브가 열려 자유 흐름</b> → B → T → ${B('탱크')}`,
          `어디서도 교축되지 않음 → <b>급속 전진</b> (릴리프 닫힘, 압력 낮음)`,
        ],
        tip: '같은 "일방향 유량제어 밸브"라도 <b>체크 밸브 방향</b>에 따라 제어되는 방향이 달라져요. 과제 1(③)과 그림을 비교해 보세요!',
      },
      {
        n: '2단계', short: '미터-인 감속 후진', sub: 'LS2 → K2 → Y2', pause: 'settle',
        title: '2단계 — 후진 전환 & 미터-인 감속 후진 (LS2 → K2 → Y1 소자, Y2 통전)',
        lead: `${R('LS2')}가 눌리면 ${R('Y1')}은 꺼지고 ${R('Y2')}가 켜져요. 로드 측으로 <b>들어가는</b> 오일이 교축을 통과하므로 천천히 후진합니다(<b>미터-인</b>).`,
        el: [
          `${R('LS2')} 눌림 → 2번 줄 (K3 b 닫힘) → ${R('K2')} 여자 + 자기유지`,
          `1번 줄 K2 b 열림 → ${R('K1')} 소자 (자기유지 해제)`,
          `4번 줄: K1 a 열림 <b>+</b> K2 b 열림 → ${R('Y1')} 소자 (이중 차단 = 인터록)`,
          `5번 줄 K2 a 닫힘 → ${R('Y2')} 통전`,
        ],
        hy: [
          `${R('Y1')} 스프링 복귀 → <b>교차 위치</b>: ${P('P→B')}, ${B('A→T')}`,
          `펌프 → B → ${R('fcv', '일방향 유량제어 밸브')}: 아래→위는 체크가 닫혀 <b>교축으로만 통과</b> → 로드 측 = <b>미터-인</b>`,
          `${R('Y2', '① Y2')} 통전 → ${PI('파일럿 압력')} → ${R('pc', '헤드측 파일럿 체크')} 강제 개방`,
          `헤드 측 오일 → 파일럿 체크(위→아래, 강제 개방) → A → T → ${B('탱크')}`,
          `남는 펌프 오일은 ${R('relief', '릴리프 밸브')}로 → 압력계는 높게 표시`,
        ],
        tip: 'Y2가 없으면 헤드 측 오일이 빠져나갈 수 없어 <b>후진 자체가 불가능</b>해요. Y2 = "헤드 측 출구 열쇠".',
        deep: ['🔬 미터-인 vs 미터-아웃 한눈에 비교', '<b>미터-인</b>(과제 3 후진): 실린더로 <b>들어가는</b> 오일을 조임. 구조가 간단하고 밀어내는 일정한 하중에 적합. 다만 부하가 끌어당기면(자중 등) 튀어나갈 수 있음.<br><b>미터-아웃</b>(과제 1 전진): 실린더에서 <b>나가는</b> 오일을 조임. 배압이 생겨 끌려가는 부하에도 안정적 → 가장 널리 사용.'],
      },
      {
        n: '3단계', short: '후진 완료·정지', sub: 'LS1 → K3 → K2 해제', pause: 'enter',
        title: '3단계 — 후진 완료 & 사이클 종료 (LS1 → K3 → K2 해제 → Y2 소자)',
        lead: `${R('LS1')}이 눌리면 ${R('K3')}가 ${R('K2')}를 끊고, ${R('Y2')}가 꺼지면서 파일럿 체크 밸브가 다시 닫혀 실린더를 잠급니다.`,
        el: [
          `${R('LS1')} 눌림 → 3번 줄 → ${R('K3')} 여자`,
          `2번 줄 K3 b 열림 → ${R('K2')} 소자 (자기유지 해제)`,
          `5번 줄 K2 a 열림 → ${R('Y2')} 소자`,
        ],
        hy: [
          `${R('Y2')} 소자 → 파일럿 라인 A→T 배출 → ${R('pc', '파일럿 체크')} 닫힘`,
          `헤드 측 오일이 ${LK('갇혀')} 실린더가 단단히 고정(로킹)`,
          `Y1은 교차 위치 그대로 → 로드 측엔 계속 압력, 남는 오일은 릴리프로`,
        ],
        tip: '초기 상태로 복귀 완료! 4번 줄의 <b>K2 b접점</b>은 Y1(전진)과 Y2(후진)가 동시에 켜지지 않게 막는 안전장치(인터록)예요.',
      },
    ],
    info: {
      cyl: { part: 'cyl', name: '복동 실린더 A', state: stCyl, role: '헤드 측 공급 → 전진(급속), 로드 측 공급 → 후진(미터-인 저속).' },
      LS1: { part: 'ls', name: '리밋 스위치 LS1 (후진 끝)', state: stLS('LS1'), role: '후진 완료 검출 → 3번 줄 K3 여자 → K2 해제. 시작 시 눌려 있음(⇧).' },
      LS2: { part: 'ls', name: '리밋 스위치 LS2 (전진 끝)', state: stLS('LS2'), role: '전진 완료 검출 → 2번 줄 K2 여자 → 후진 전환.' },
      pc: { part: 'pc', name: '파일럿 작동 체크 밸브 (헤드측)', state: sim => sim.valves.Y2.pos === 0 ? '파일럿 압력 있음 → 강제 개방' : (sim.hyd.checks.pc ? '정방향 흐름으로 열림' : '닫힘 → 헤드측 오일 차단 (로킹)'), role: '헤드 측 라인에 설치. 전진 때(아래→위)는 정방향이라 자유롭게 열림. 후진 때 헤드 오일이 빠져나가려면(위→아래) <b>Y2의 파일럿 압력</b>으로 강제로 열어야 해요. 평소에는 헤드 측 오일을 가둬 실린더를 고정.' },
      fcv: { part: 'fcv', name: '일방향 유량제어 밸브 (로드측)', state: sim => sim.hyd.checks.fcv ? '체크 밸브 열림 → 자유 흐름' : (sim.hyd.motion < 0 ? '체크 닫힘 → 교축으로만 통과 (미터-인)' : '체크 닫힘'), role: '체크 밸브 방향이 과제 1과 <b>반대</b>! 전진 때 빠져나오는 오일(위→아래)은 체크로 자유 흐름 → 급속 전진. 후진 때 들어가는 오일(아래→위)은 교축으로만 통과 → <b>미터-인</b> 속도 제어.' },
      Y1: { part: 'v42', name: '4/2-way 편솔레노이드 밸브 (Y1)', state: sim => (sim.sols.Y1 ? 'Y1 통전 · ' : 'Y1 소자 · ') + T3.valves.Y1.posNames[sim.valves.Y1.pos], role: '<b>통전 = 평행</b>(P→A, B→T) → 전진. <b>소자(스프링) = 교차</b>(P→B, A→T) → 후진 방향. 과제 1의 Y1과 그림이 반대이니 주의! 4번 줄: K1 a & K2 b.' },
      Y2: { part: 'v32', num: '①', name: '3/2-way 편솔레노이드 밸브 (Y2, NC형)', state: sim => (sim.sols.Y2 ? 'Y2 통전 · ' : 'Y2 소자 · ') + T3.valves.Y2.posNames[sim.valves.Y2.pos], role: '평상시 닫힘(NC). 통전되면 P→A로 파일럿 압력을 보내 헤드 측 파일럿 체크 밸브를 열어 줌 → 후진 허용. 소자되면 A→T로 파일럿 압력을 빼서 다시 로킹.' },
      relief: { part: 'relief', name: '압력 릴리프 밸브', state: stRelief, role: '시스템 최고 압력 설정. 로킹 정지나 미터-인 저속 후진 때 남는 펌프 오일을 탱크로 보냄.' },
      pu: { part: 'pu', state: stPump, role: '모터 + 펌프 + 필터 + 탱크 + 안전 릴리프.' },
      g9: { part: 'gauge', state: stPump, role: '펌프 라인 압력. 급속 전진 때는 낮고, 미터-인 후진·정지 때는 릴리프 설정압까지 올라가요.' },
      gpu: { part: 'gauge', name: '압력계 (파워 유닛)', state: stPump, role: '파워 유닛 출구 압력.' },
      PB1: { part: 'pb', state: stPB, role: '시작 버튼. 1번 줄 K1 여자 → 자기유지.' },
      K1: { part: 'relay', name: '릴레이 K1 (전진 기억)', state: stK('K1'), role: '1번 줄 자기유지. 4번 줄로 Y1 통전. 1번 줄 K2 b가 열리면 해제.' },
      K2: { part: 'relay', name: '릴레이 K2 (후진 기억)', state: stK('K2'), role: 'LS2로 여자·자기유지. 1번 줄 b → K1 해제, 4번 줄 b → Y1 차단(인터록), 5번 줄 a → Y2 통전. K3 b로 해제.' },
      K3: { part: 'relay', name: '릴레이 K3 (원위치 검출)', state: stK('K3'), role: 'LS1 눌림 → 여자. 2번 줄 K3 b로 K2 해제 → 사이클 종료.' },
    },
    quiz: [
      { ws: true, q: '① 의 이름은?', ref: 'Y2', answer: '3/2-way 편솔레노이드 밸브 (NC형)', options: ['3/2-way 편솔레노이드 밸브 (NC형)', '2/2-way 편솔레노이드 밸브 (NO형)', '4/2-way 편솔레노이드 밸브', '3/2-way 편솔레노이드 밸브 (NO형)'], why: '포트 3개, 위치 2개, 평상시(스프링 칸) P가 ⊥로 막힘 = NC(평상시 닫힘).' },
      { q: '헤드 측 라인에 있는 밸브의 이름은?', ref: 'pc', answer: '파일럿 작동 체크 밸브', options: ['파일럿 작동 체크 밸브', '일방향 유량제어 밸브', '압력 릴리프 밸브', '셔틀 밸브'] },
      { q: '이 회로의 <b>후진</b> 속도 제어 방식은?', answer: '미터-인', options: ['미터-인', '미터-아웃', '블리드-오프', '제어 없음'], why: '로드 측으로 "들어가는" 오일을 교축하므로 미터-인.' },
      { q: '후진할 때 Y2가 꼭 필요한 이유는?', answer: '헤드측 파일럿 체크 밸브를 열어 헤드 오일을 빼려고', options: ['헤드측 파일럿 체크 밸브를 열어 헤드 오일을 빼려고', '로드 측에 압력을 보내려고', 'Y1을 끄려고', '릴리프 밸브를 열려고'], why: '파일럿 체크는 역방향(위→아래)을 파일럿 없이는 절대 열지 않아요.' },
      { q: '4번 줄 K2 b접점의 역할은?', answer: 'Y1과 Y2가 동시에 켜지지 않게 하는 인터록', options: ['Y1과 Y2가 동시에 켜지지 않게 하는 인터록', 'K2를 자기유지시킴', 'LS2를 대신함', 'K3를 켬'] },
      { q: '과제 1의 ③과 과제 3의 일방향 유량제어 밸브의 차이는?', answer: '체크 밸브 방향이 반대라 제어되는 방향이 다르다', options: ['체크 밸브 방향이 반대라 제어되는 방향이 다르다', '완전히 같은 동작이다', '과제 3은 압력보상형이다', '과제 3은 체크 밸브가 없다'], why: '과제 1: 로드측 배출(전진) 제어 / 과제 3: 로드측 공급(후진) 제어.' },
    ],
  };

  window.TASKS = { t1: T1, t2: T2, t3: T3 };
})();
