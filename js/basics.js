/* =========================================================
   기초 원리 페이지 – 개념 + 미니 실습
   ========================================================= */
(function () {
  const { S, H } = U;

  function section(num, title, textHtml, demoBuilder) {
    const demo = H('div', { class: 'demo' });
    const cap = H('div', { class: 'small', style: 'margin-top:6px;min-height:22px;color:var(--ink2)' });
    const ctl = H('div', { class: 'demo-ctl' });
    demo.append(cap, ctl);
    const card = H('section', { class: 'card concept' },
      H('div', { class: 'card-h' }, H('span', { class: 'num', text: num }), H('h2', { text: title })),
      H('div', { class: 'card-b' }, H('div', { class: 'text', html: textHtml }), demo));
    if (demoBuilder) demoBuilder(demo, cap, ctl);
    return card;
  }

  function bigPicture() {
    const row = (items) => H('div', { style: 'display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:6px 0' },
      items.map((it, i) => [i ? H('span', { style: 'color:var(--muted);font-weight:800', text: '→' }) : null,
        H('span', { class: 'pill', style: `padding:6px 10px;font-size:13px;background:${it[1]};color:#fff`, html: it[0] })]));
    const wrap = H('div');
    wrap.append(H('div', { class: 'small muted', text: '⚡ 전기 회로 = 두뇌 (판단·기억)' }),
      row([['입력<br><b>PB1 · LS</b>', '#3b7d4f'], ['판단·기억<br><b>릴레이 K</b>', '#8a6d00'], ['출력<br><b>솔레노이드 Y</b>', '#b4610a']]),
      H('div', { class: 'small muted', style: 'margin-top:10px', text: '💧 유압 회로 = 근육 (힘·움직임)' }),
      row([['동력<br><b>모터 → 펌프</b>', '#b8323f'], ['제어<br><b>방향·유량·압력 밸브</b>', '#6b4bb8'], ['일<br><b>실린더</b>', '#2d6fc4'], ['복귀<br><b>탱크</b>', '#2a7f8f']]),
      H('div', { class: 'small', style: 'margin-top:10px;color:var(--ink2)', html: '🔁 <b>되먹임(피드백):</b> 실린더가 움직여 LS를 누르면 → 다시 전기 회로의 입력이 되어 다음 동작이 결정돼요. 이 순환이 바로 <b>시퀀스 제어</b>!' }));
    return wrap;
  }

  function buildBasics(root) {
    root.innerHTML = '';
    root.append(H('div', { class: 'page-head' }, H('h1', { text: '📘 기초 원리' }),
      H('p', { html: '과제를 이해하는 데 꼭 필요한 개념만 골랐어요. 오른쪽 상자의 버튼을 눌러 직접 움직여 보세요.' })));

    // 1. 큰 그림
    root.append(section('1', '유압 시퀀스 회로의 큰 그림',
      `<p>실습과제 회로는 <b>두 개의 회로가 한 팀</b>으로 일해요.</p>
       <ul>
         <li><b>전기 회로(래더)</b>: 버튼·리밋 스위치 신호를 받아 릴레이로 "지금 무엇을 할지" 판단하고, 솔레노이드(Y)에 전기를 보냄</li>
         <li><b>유압 회로</b>: 솔레노이드가 밸브를 바꾸면 오일 길이 바뀌고, 실린더가 전진·후진</li>
         <li><b>연결 고리</b>: 래더의 Y1 코일 = 유압 밸브의 Y1 솔레노이드, 유압 회로의 LS1 = 래더의 LS1 접점</li>
       </ul>
       <p class="small muted">시뮬레이터에서 Y1이나 LS1에 마우스를 올리면 두 회로에서 동시에 강조돼요.</p>`,
      demo => { demo.prepend(bigPicture()); }));

    // 2. 밸브 기호
    root.append(section('2', '방향 전환 밸브 기호 읽는 법',
      `<ol>
        <li><b>사각형 1개 = 밸브의 위치 1개.</b> 사각형이 2개면 2위치, 3개면 3위치</li>
        <li><b>포트 수</b>(밖으로 나온 선): <b>P</b>=펌프(압력), <b>T</b>=탱크, <b>A·B</b>=실린더로 가는 길</li>
        <li><b>"4/2-way"</b> = 포트 4개 / 위치 2개</li>
        <li>사각형 안 <b>화살표</b> = 오일이 통하는 길, <b>⊥ ⊤</b> = 막힌 길</li>
        <li><b>스프링 쪽 사각형</b> = 전기가 꺼진 평상시 상태 (포트 선이 이 사각형에 연결되어 그려짐)</li>
        <li>솔레노이드 ON → 사각형 묶음이 <b>통째로 밀려서</b> 옆 사각형이 포트에 맞춰짐</li>
       </ol>
       <p class="small muted">팁: 화살표 두 개가 나란히(↑↓) = <b>평행</b>, X자로 엇갈림 = <b>교차</b>. 평행/교차가 바뀌면 실린더 방향이 바뀌어요.</p>`,
      (demo, cap, ctl) => {
        const host = H('div');
        demo.prepend(host);
        const c = PART_DEMOS.v42(host, cap);
        ctl.append(H('button', { class: 'btn primary', text: '솔레노이드 Y ON/OFF', onclick: () => c.next() }));
      }));

    // 3. 접점 & 자기유지
    root.append(section('3', '릴레이 a접점 · b접점 · 자기유지',
      `<p><b>릴레이</b>는 코일에 전기가 들어오면(<b>여자</b>) 연결된 접점을 한꺼번에 바꾸는 스위치예요.</p>
       <ul>
        <li><b>a접점</b>(NO): 평소 열림 → 여자되면 <b>닫힘</b></li>
        <li><b>b접점</b>(NC): 평소 닫힘 → 여자되면 <b>열림</b></li>
       </ul>
       <p><b>자기유지 회로</b>: START 버튼과 <b>나란히(병렬)</b> 자기 자신의 a접점을 붙여 두면, 버튼을 떼도 a접점을 통해 전기가 계속 흘러 ON 상태가 <b>기억</b>돼요. 끊을 때는 직렬로 넣은 <b>b접점</b>(STOP)을 열어 줍니다.</p>
       <p class="small muted">과제에서 STOP 역할을 하는 것: 과제 1의 1번 줄 <b>K2 b</b>, 2번 줄 <b>K3 b</b> / 과제 2의 <b>K4 b</b> 등.</p>
       <p class="small"><b>실습:</b> START를 눌렀다 떼 보고, STOP을 눌러 보세요. (회로도 속 버튼 접점을 직접 눌러도 돼요)</p>`,
      (demo, cap, ctl) => {
        const svg = S('svg');
        demo.prepend(svg);
        const st = { START: false, STOP: false, K: false };
        const rungs = [
          { top: [{ ref: 'START', kind: 'no', act: 'pb' }, { ref: 'K', kind: 'no', act: 'k' }], ser: [{ ref: 'STOP', kind: 'nc', act: 'pb' }], coil: { ref: 'K', kind: 'relay' } },
          { top: [{ ref: 'K', kind: 'no', act: 'k' }], ser: [], coil: { ref: 'L1', kind: 'lamp' } },
          { top: [{ ref: 'K', kind: 'nc', act: 'k' }], ser: [], coil: { ref: 'L2', kind: 'lamp' } },
        ];
        const sim = {
          closed: el => { const a = st[el.ref]; return el.kind === 'nc' ? !a : a; },
          coilOn: ref => ref === 'K' ? st.K : ref === 'L1' ? st.K : !st.K,
          coilPending: () => false,
        };
        let lad;
        const apply = () => {
          for (let i = 0; i < 3; i++) st.K = (st.START || st.K) && !st.STOP;
          lad.update(sim);
          if (st.STOP) cap.innerHTML = 'STOP(b접점)을 누름 → 회로가 끊겨 <b>K 소자</b> → 자기유지 해제';
          else if (st.START) cap.innerHTML = 'START 누름 → <b>K 여자</b> → K a접점(병렬)도 닫힘';
          else if (st.K) cap.innerHTML = 'START에서 손을 뗐는데도 <b>K a접점을 통해 계속 ON</b> = 자기유지! (L1 켜짐, L2 꺼짐)';
          else cap.innerHTML = '대기 상태: K OFF → a접점 열림(L1 꺼짐), b접점 닫힘(L2 켜짐)';
        };
        lad = new Ladder(svg, rungs, { onPB: (down, ref) => { st[ref] = down; apply(); } });
        apply();
        const hold = (ref, label, cls) => {
          const b = H('button', { class: 'btn ' + cls, text: label });
          const dn = e => { e.preventDefault(); st[ref] = true; apply(); };
          const up = () => { st[ref] = false; apply(); };
          b.addEventListener('pointerdown', dn); b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up);
          return b;
        };
        ctl.append(hold('START', '● START 누르기', 'pb'), hold('STOP', '■ STOP 누르기', ''));
      }));

    // 4. 체크 & 파일럿 체크
    root.append(section('4', '체크 밸브와 파일럿 작동 체크 밸브',
      `<p><b>체크 밸브</b>는 한 방향만 통과시키는 "일방통행" 밸브예요. 볼이 V자 시트에 앉아 있다가 정방향 흐름에만 밀려 열려요.</p>
       <p><b>파일럿 작동 체크 밸브</b>는 여기에 <b>파일럿 포트(점선)</b>가 추가된 것. 파일럿 압력이 들어오면 역방향도 강제로 열려요.</p>
       <ul>
        <li>파일럿 없음 + 역방향 → <b>완전 차단</b> → 실린더 오일이 빠져나가지 못해 <b>로킹</b></li>
        <li>파일럿 있음 → 역방향 통과 → 실린더가 움직일 수 있음</li>
       </ul>
       <p class="small muted">과제 1·3에서 파일럿 압력을 보내 주는 밸브가 바로 <b>Y2(3/2-way)</b>예요.</p>`,
      (demo, cap, ctl) => {
        const host = H('div'); demo.prepend(host);
        const c = PART_DEMOS.pc(host, cap);
        ctl.append(H('button', { class: 'btn primary', text: '흐름 방향 바꾸기', onclick: () => c.next() }), ...c.extra);
      }));

    // 5. 미터-인 / 미터-아웃
    root.append(H('section', { class: 'card concept' },
      H('div', { class: 'card-h' }, H('span', { class: 'num', text: '5' }), H('h2', { text: '속도 제어: 미터-인 vs 미터-아웃' })),
      H('div', { class: 'card-b', style: 'display:block' },
        H('p', { html: '실린더 속도 = <b>들어가는(나오는) 오일의 양</b>으로 결정돼요. 유량제어 밸브를 <b>어느 쪽</b>에 다느냐에 따라 이름이 달라집니다.' }),
        H('div', { style: 'overflow-x:auto' }, H('table', { class: 'cmp', html: `
          <tr><th></th><th>미터-인 (Meter-in)</th><th>미터-아웃 (Meter-out)</th></tr>
          <tr><td><b>제어하는 오일</b></td><td>실린더로 <b>들어가는</b> 오일</td><td>실린더에서 <b>나오는</b> 오일</td></tr>
          <tr><td><b>특징</b></td><td>구조 간단, 밀어내는 일정한 부하에 적합. 부하가 끌어당기면 튀어나갈 수 있음</td><td>배압이 생겨 끌려가는 부하에도 <b>안정적</b>(오버런 방지). 가장 널리 사용</td></tr>
          <tr><td><b>남는 오일</b></td><td colspan="2">정용량 펌프의 남는 오일은 <b>릴리프 밸브</b>로 탱크에 돌아감 → 그래서 압력계가 높게 표시</td></tr>
          <tr><td><b>과제에서</b></td><td>과제 2 전진(① 압력보상 밸브, 헤드 공급측)<br>과제 3 <b>후진</b>(로드측 공급)</td><td>과제 1 <b>전진</b>(③, 로드측 배출)</td></tr>` })),
        H('p', { class: 'small muted', style: 'margin-top:8px', html: '같은 "일방향 유량제어 밸브"라도 체크 밸브가 막는 방향이 곧 <b>제어되는 방향</b>이에요. 과제 1의 ③과 과제 3의 밸브를 나란히 비교해 보세요!' }))));

    // 6. 힘과 속도
    root.append(section('6', '힘과 속도: F = P × A,  v = Q ÷ A',
      `<p>복동 실린더는 양쪽 면적이 달라요.</p>
       <ul>
        <li><b>헤드 측 면적</b> A₁ = π·D²/4 (피스톤 전체)</li>
        <li><b>로드 측 면적</b> A₂ = π·(D² − d²)/4 (로드가 차지한 만큼 작음)</li>
       </ul>
       <p>그래서 같은 압력·같은 유량이면</p>
       <ul>
        <li><b>전진</b>: 면적 큼 → <b>힘 큼, 속도 느림</b></li>
        <li><b>후진</b>: 면적 작음 → <b>힘 작음, 속도 빠름</b></li>
       </ul>
       <p class="small muted">슬라이더로 값을 바꿔 보세요. 과제 1·2의 "후진이 더 빠른" 이유가 여기 있어요.</p>`,
      (demo, cap) => {
        const mk = (label, min, max, step, val, unit) => {
          const inp = H('input', { type: 'range', min, max, step, value: val });
          const out = H('output');
          const row = H('div', { class: 'slider-row' }, H('span', { text: label }), inp, out);
          return { row, inp, out, unit };
        };
        const D_ = mk('피스톤 지름 D', 20, 100, 1, 40, 'mm');
        const d_ = mk('로드 지름 d', 10, 70, 1, 22, 'mm');
        const P_ = mk('압력 P', 0.5, 10, 0.1, 5, 'MPa');
        const Q_ = mk('유량 Q', 1, 20, 0.5, 6, 'L/min');
        const o = {};
        const ro = (k, label) => { const v = H('div', { class: 'v' }); o[k] = v; return H('div', { class: 'ro' }, H('div', { class: 'k', text: label }), v); };
        const grid = H('div', { class: 'calc-out' }, ro('a1', '헤드 측 면적 A₁'), ro('a2', '로드 측 면적 A₂'), ro('f1', '전진 힘 F₁ = P·A₁'), ro('f2', '후진 힘 F₂ = P·A₂'), ro('v1', '전진 속도 v₁ = Q/A₁'), ro('v2', '후진 속도 v₂ = Q/A₂'));
        demo.prepend(D_.row, d_.row, P_.row, Q_.row, grid);
        const calc = () => {
          let D = +D_.inp.value, d = +d_.inp.value;
          if (d >= D - 4) { d = D - 4; d_.inp.value = d; }
          const P = +P_.inp.value, Q = +Q_.inp.value;
          D_.out.textContent = D + ' mm'; d_.out.textContent = d + ' mm'; P_.out.textContent = P.toFixed(1) + ' MPa'; Q_.out.textContent = Q + ' L/min';
          const A1 = Math.PI * D * D / 4, A2 = Math.PI * (D * D - d * d) / 4;
          const q = Q * 1e6 / 60; // mm³/s
          o.a1.textContent = (A1 / 100).toFixed(1) + ' cm²';
          o.a2.textContent = (A2 / 100).toFixed(1) + ' cm²';
          o.f1.textContent = (P * A1 / 1000).toFixed(2) + ' kN'; o.f1.className = 'v p';
          o.f2.textContent = (P * A2 / 1000).toFixed(2) + ' kN';
          o.v1.textContent = (q / A1).toFixed(0) + ' mm/s';
          o.v2.textContent = (q / A2).toFixed(0) + ' mm/s'; o.v2.className = 'v r';
          cap.innerHTML = `후진이 전진보다 <b>${(A1 / A2).toFixed(2)}배 빠르고</b>, 전진이 후진보다 <b>${(A1 / A2).toFixed(2)}배 힘이 세요</b> (면적비 A₁/A₂).`;
        };
        [D_, d_, P_, Q_].forEach(x => x.inp.addEventListener('input', calc));
        calc();
      }));

    // 7. 압력과 릴리프
    root.append(section('7', '압력은 "막힐 때" 생긴다 — 릴리프 밸브',
      `<p>펌프는 압력이 아니라 <b>오일의 양(유량)</b>을 밀어내요. 압력은 오일이 <b>저항(부하·교축·막힘)</b>을 만날 때 생깁니다.</p>
       <ul>
        <li>실린더가 가볍게 움직임 → 압력 낮음</li>
        <li>실린더가 끝에 닿거나 밸브가 막힘 → 오일이 갈 곳이 없어 압력이 <b>계속 상승</b></li>
        <li>설정압에 도달하면 <b>릴리프 밸브가 열려</b> 탱크로 흘려보냄 → 압력이 더 오르지 않음 (펌프·배관 보호)</li>
       </ul>
       <p class="small muted">그래서 시뮬레이터에서 실린더가 멈춰 있을 때마다 압력계가 5 MPa(설정압)를 가리키고, 릴리프 밸브의 화살표가 빨갛게 정렬돼요.</p>`,
      (demo, cap) => { const host = H('div'); demo.prepend(host); PART_DEMOS.relief(host, cap); }));

    // 8. 래더 읽는 법
    root.append(H('section', { class: 'card concept' },
      H('div', { class: 'card-h' }, H('span', { class: 'num', text: '8' }), H('h2', { text: '전기 회로도(래더) 읽는 순서' })),
      H('div', { class: 'card-b', style: 'display:block' }, H('ol', { html: `
        <li>위쪽 선 = <b>+24V</b>, 아래쪽 선 = <b>0V</b>. 전류는 위에서 아래로 흘러요.</li>
        <li>세로줄 하나하나가 <b>줄(라인)</b>. 왼쪽부터 1번, 2번… (시뮬레이터 아래쪽 숫자)</li>
        <li>한 줄의 접점이 <b>모두 연결</b>되어야 맨 아래 코일(K, Y)에 전류가 흘러요. 직렬 = AND, 병렬 = OR</li>
        <li><b>같은 이름</b>의 접점은 같은 릴레이 코일이 움직여요. (K2 코일이 켜지면 1번 줄 K2 b, 2번 줄 K2 a, 5번 줄 K2 a가 <b>동시에</b> 바뀜)</li>
        <li>K = 릴레이(기억·판단), Y = 솔레노이드(밸브 구동), LS = 리밋 스위치(위치 입력), PB = 푸시버튼(사람 입력)</li>
        <li>시뮬레이터 색: <span style="color:var(--cur);font-weight:800">노랑</span> = 전류가 흐르는 길, <span style="color:var(--live);font-weight:800">어두운 노랑</span> = 전압은 왔지만 열린 접점에서 막힘</li>` }))));
  }

  window.buildBasics = buildBasics;
})();
