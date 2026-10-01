/* =========================================================
   부품 사전 – 설명 데이터 + 미니 인터랙티브 데모
   ========================================================= */
(function () {
  const { S, H } = U;

  const PARTS = {
    cyl: {
      name: '복동 실린더', en: 'Double-acting Cylinder', cat: '액추에이터', used: ['t1', 't2', 't3'],
      summary: '유압 에너지(압력·유량)를 <b>직선 왕복 운동</b>으로 바꾸는 장치. 피스톤 양쪽에 포트가 있어 전진·후진 모두 유압의 힘으로 움직여요.',
      how: [
        '<b>헤드 측</b>(피스톤 쪽) 포트에 압유 → 피스톤이 밀려 <b>전진</b>, 로드 측 오일은 밀려 나감',
        '<b>로드 측</b> 포트에 압유 → <b>후진</b>, 헤드 측 오일은 밀려 나감',
        '힘 F = 압력 P × 면적 A → 헤드 측 면적이 더 커서 <b>전진 힘이 더 큼</b>',
        '속도 v = 유량 Q ÷ 면적 A → 로드 측 면적이 작아 같은 유량이면 <b>후진이 더 빠름</b>',
        '들어가는 길과 나가는 길이 <b>둘 다</b> 열려야 움직임 (한쪽이 막히면 로킹)',
      ],
      symbol: '긴 사각형(튜브) 안에 피스톤, 한쪽으로 로드가 나와 있어요. 피스톤 쪽의 대각선 화살표는 행정 끝 충격을 줄이는 <b>쿠션 조절</b> 표시.',
    },
    ls: {
      name: '리밋 스위치', en: 'Limit Switch', cat: '센서·스위치', used: ['t1', 't2', 't3'],
      summary: '실린더 로드 끝의 <b>도그</b>(돌기)가 롤러를 누르면 내부 접점이 바뀌어 <b>전기 신호(ON/OFF)</b>를 만드는 위치 센서.',
      how: [
        '도그가 롤러를 누름 → 접점 ON → 래더 회로의 LS 접점이 닫힘',
        '도그가 지나가거나 떨어지면 → 스프링으로 복귀 → 접점 OFF',
        '시퀀스 제어에서 "실린더가 여기까지 왔다"를 알려 다음 동작을 시작하게 함',
        '래더 회로의 <b>⇧</b> 표시 = 시작할 때 이미 눌려 있는 스위치 (예: 후진 끝의 LS1)',
      ],
      symbol: '사각형 안 대각선(접점) + 위쪽 스프링 + 아래쪽 롤러 플런저.',
    },
    fcv: {
      name: '일방향 유량제어 밸브', en: 'One-way Flow Control Valve (Throttle-check Valve)', cat: '유량 제어', used: ['t1', 't3'],
      summary: '<b>교축 밸브</b>(좁은 틈)와 <b>체크 밸브</b>를 병렬로 묶은 밸브. 한쪽 방향은 유량을 제어하고, 반대 방향은 자유롭게 흘려보내요.',
      how: [
        '체크 밸브가 <b>막는 방향</b> → 오일이 교축(좁은 틈)으로만 통과 → 유량 제한 → <b>속도 제어</b>',
        '체크 밸브가 <b>열리는 방향</b> → 교축을 우회해 자유 흐름 → 빠른 속도',
        '실린더로 들어가는 쪽을 제어하면 <b>미터-인</b>, 나오는 쪽을 제어하면 <b>미터-아웃</b>',
        '과제 1(로드측, 전진 시 배출 제어 = 미터-아웃)과 과제 3(로드측, 후진 시 공급 제어 = 미터-인)은 체크 방향이 서로 반대!',
      ],
      symbol: '박스 안에 ")(" 모양 교축 + 조절 화살표, 옆 가지에 볼과 V자 시트(체크 밸브). <b>V자의 뾰족한 쪽 → 볼 쪽</b>으로 흐를 때 체크가 열려요.',
    },
    pcfcv: {
      name: '압력보상형 유량제어 밸브', en: 'Pressure-compensated Flow Control Valve', cat: '유량 제어', used: ['t2'],
      summary: '부하(압력)가 변해도 통과 유량을 <b>항상 일정</b>하게 유지해서 실린더 속도를 일정하게 만드는 밸브. 노트에서는 "압력 보상 밸브".',
      how: [
        '일반 교축 밸브는 앞뒤 압력차가 바뀌면 유량도 바뀜 (압력차↓ → 유량↓)',
        '압력보상형은 내부 보상기가 교축 앞뒤 <b>압력차를 일정하게</b> 자동 조절 → 유량 일정',
        '과제 2: 2단계에서 로드 측에 3 MPa 배압이 갑자기 걸려도 공급 유량이 들쭉날쭉하지 않음',
      ],
      symbol: '박스 안 교축 기호 + <b>↑ 화살표</b>(압력 보상 = 흐름 방향 표시).',
    },
    check: {
      name: '체크 밸브', en: 'Check Valve (Non-return Valve)', cat: '방향 제어', used: ['t1', 't3'],
      summary: '오일을 <b>한 방향으로만</b> 흐르게 하는 밸브. 반대 방향은 볼이 시트에 밀착돼 완전히 막혀요.',
      how: [
        '정방향: 오일이 볼을 시트에서 밀어내 → 열림',
        '역방향: 오일이 볼을 시트로 밀어붙임 → 닫힘(차단)',
        '일방향 유량제어 밸브 안에도 들어 있어요',
      ],
      symbol: '원(볼) + V자(시트). V자 꼭짓점 쪽에서 볼 쪽으로 흐를 때 열림.',
    },
    pc: {
      name: '파일럿 작동 체크 밸브', en: 'Pilot-operated Check Valve', cat: '방향 제어', used: ['t1', 't3'],
      summary: '평소에는 체크 밸브처럼 한 방향만 흐르지만, <b>파일럿 포트에 압력</b>이 들어오면 볼을 강제로 밀어 <b>역방향도 열리는</b> 밸브.',
      how: [
        '정방향: 언제나 열림 (일반 체크 밸브와 같음)',
        '역방향: 평소에는 <b>완전 차단</b> (누설이 거의 없음) → 실린더를 그 자리에 고정 = <b>로킹</b>',
        '파일럿 압력(점선)이 들어오면 → 역방향도 열려 오일이 빠져나갈 수 있음',
        '용도: 실린더 위치 유지, 자중에 의한 낙하(크리프) 방지, 배관 파손 시 낙하 방지',
        '과제 1: 로드 측(전진 허용 열쇠 = Y2) / 과제 3: 헤드 측(후진 허용 열쇠 = Y2)',
      ],
      symbol: '박스 안에 스프링 + 볼 + 시트(체크 밸브), 박스에 <b>점선(파일럿 라인)</b>이 연결됨.',
    },
    v42: {
      name: '4/2-way 편솔레노이드 밸브', en: '4/2-way Single Solenoid Valve (Spring Return)', cat: '방향 제어', used: ['t1', 't3'],
      summary: '<b>포트 4개</b>(P 펌프, T 탱크, A·B 실린더)와 <b>위치 2개</b>를 가진 방향 전환 밸브. 한쪽은 솔레노이드, 반대쪽은 스프링.',
      how: [
        '<b>스프링 쪽 사각형</b> = 전원 OFF일 때(평상시)의 연결',
        '솔레노이드 ON → 사각형이 밀려 <b>다른 사각형의 연결</b>로 바뀜 (평행 ↔ 교차)',
        '솔레노이드 OFF → 스프링이 원위치로 되돌림 → 전기가 끊기면 원래대로!',
        '그래서 동작을 유지하려면 릴레이 <b>자기유지</b>로 계속 통전해 줘야 해요',
        '평행(↑↓): P→A, B→T  /  교차(X): P→B, A→T',
      ],
      symbol: '사각형 2개 = 위치 2개. 사각형 안 화살표 = 오일 흐름 길, ⊥ = 막힘. 포트 선은 평상시 사각형(스프링 쪽)에 그려져 있어요.',
    },
    v43: {
      name: '4/3-way 양솔레노이드 밸브 (올 포트 블록)', en: '4/3-way Double Solenoid Valve, Closed Center', cat: '방향 제어', used: ['t2'],
      summary: '위치 3개(왼쪽·중립·오른쪽), 양쪽에 솔레노이드와 스프링. 둘 다 꺼지면 스프링이 <b>중립</b>으로 돌려놓는 스프링 센터형.',
      how: [
        '왼쪽 솔레노이드 ON → 왼쪽 사각형 연결 (예: P→A, B→T 전진)',
        '오른쪽 솔레노이드 ON → 오른쪽 사각형 연결 (예: P→B, A→T 후진)',
        '둘 다 OFF → 중립. <b>올 포트 블록</b>(클로즈드 센터): P·T·A·B 모두 차단',
        '중립에서 실린더 양쪽 오일이 갇혀 <b>어느 위치에서든 정지·유지</b> 가능',
        '이때 펌프 오일은 갈 곳이 없어 릴리프 밸브로 탱크에 돌아감',
      ],
      symbol: '사각형 3개. 가운데 사각형 안 모든 포트가 ⊥⊤ 로 막힘 = 올 포트 블록.',
    },
    v32: {
      name: '3/2-way 편솔레노이드 밸브 (NC)', en: '3/2-way Single Solenoid Valve, Normally Closed', cat: '방향 제어', used: ['t1', 't3'],
      summary: '포트 3개(P, A, T), 위치 2개. 평상시 P가 막혀 있는 <b>NC(Normally Closed)</b>형.',
      how: [
        '전원 OFF(스프링 위치): P 차단, A→T로 배출 (작동 쪽 잔류 압력을 탱크로 빼 줌)',
        '전원 ON: P→A로 압유 공급, T 차단',
        '이 과제들에서는 <b>파일럿 체크 밸브를 여는 파일럿 신호 공급용</b>으로 사용',
      ],
      symbol: '오른쪽(스프링) 사각형: P 위치에 ⊥(막힘), A→T 대각선 화살표. 왼쪽 사각형: P→A ↑, T 막힘.',
    },
    v22: {
      name: '2/2-way 편솔레노이드 밸브 (N/O)', en: '2/2-way Single Solenoid Valve, Normally Open', cat: '방향 제어', used: ['t2'],
      summary: '포트 2개(입구·출구), 위치 2개. 평상시 <b>열려 있는 N/O</b>형 — 전원이 들어오면 닫혀요.',
      how: [
        '전원 OFF: 스프링 힘으로 열림 → 오일이 저항 없이 통과(<b>바이패스</b>)',
        '전원 ON: 닫힘 → 흐름 완전 차단',
        '과제 2: 3 MPa 릴리프 밸브를 우회하는 지름길. 닫히면 배압이 생김',
      ],
      symbol: '스프링 쪽 사각형에 ↕ (열림), 솔레노이드 쪽 사각형에 ⊥⊤ (막힘).',
    },
    relief: {
      name: '압력 릴리프 밸브', en: 'Pressure Relief Valve', cat: '압력 제어', used: ['t1', 't2', 't3'],
      summary: '입구 압력이 스프링 설정값을 넘으면 열려서 오일을 탱크로 흘려보내 <b>회로 최고 압력을 제한</b>하는 안전 밸브.',
      how: [
        '입구 압력(점선 파일럿)이 화살표를 밀고, 스프링이 반대로 버팀',
        '압력 < 설정압 → 닫힘  /  압력 ≥ 설정압 → 열림 → 탱크로 배출',
        '실린더가 멈추거나 유량을 조일 때 남는 펌프 오일의 탈출구 (펌프·배관 보호)',
        '과제 2에서는 로드 측 라인에 직렬로 넣어 <b>배압(3 MPa)</b>을 만드는 데도 사용',
      ],
      symbol: '사각형 안 화살표가 포트와 <b>어긋나 있음</b> = 평상시 닫힘. 점선(파일럿)이 화살표를 밀어 정렬되면 열림. 반대쪽엔 스프링.',
    },
    pu: {
      name: '유압 동력 발생장치 (파워 유닛)', en: 'Hydraulic Power Unit', cat: '공급·계측', used: ['t1', 't2', 't3'],
      summary: '전기 에너지를 유압 에너지로 바꿔 회로 전체에 압유를 공급하는 <b>심장</b>. 점선 박스로 묶어 표시해요.',
      how: [
        '<b>전동기(M)</b>: 전기 → 회전 운동으로 펌프 구동',
        '<b>유압 펌프</b>: 탱크 오일을 빨아들여 회로로 계속 토출 (정용량 펌프 = 항상 같은 양)',
        '<b>흡입 필터(스트레이너)</b>: 이물질을 걸러 펌프·밸브 보호',
        '<b>안전 릴리프 밸브 + 압력계</b>: 펌프 보호, 압력 감시',
        '<b>오일 탱크</b>: 오일 저장, 열 방출, 기포·이물질 침전',
      ],
      symbol: '원 + 꼭짓점 삼각형 = 펌프, 원 + M = 전동기, 마름모 + 점선 = 필터, 위가 열린 사각형 = 탱크.',
    },
    gauge: {
      name: '압력계', en: 'Pressure Gauge', cat: '공급·계측', used: ['t1', 't2', 't3'],
      summary: '라인의 압력을 보여주는 <b>유압 시스템의 눈</b>. 릴리프 설정 확인과 정상 작동 여부 점검에 사용.',
      how: [
        '실린더가 막힘 없이 움직일 때 → 부하만큼의 낮은 압력',
        '실린더가 멈추거나 유량을 조일 때 → 릴리프 설정압까지 상승',
        '과제 2의 로드측 압력계 → 배압 3 MPa 확인용',
      ],
      symbol: '원 안에 대각선 화살표(바늘).',
    },
    pb: {
      name: '푸시버튼 스위치 (a접점)', en: 'Push Button (Normally Open)', cat: '전기', used: ['t1', 't2', 't3'],
      summary: '누르는 동안만 접점이 닫히고, 손을 떼면 스프링으로 다시 열리는 <b>모멘터리</b> 스위치.',
      how: [
        '누름 → 접점 닫힘(ON) → 전류 흐름',
        '뗌 → 접점 열림(OFF)',
        '잠깐 누른 신호를 계속 유지하려면 릴레이 <b>자기유지 회로</b>가 필요',
      ],
      symbol: '"E-" 모양(누름 조작) + 점선 + a접점.',
    },
    relay: {
      name: '릴레이 (K)', en: 'Control Relay', cat: '전기', used: ['t1', 't2', 't3'],
      summary: '코일에 전류가 흐르면(<b>여자</b>) 전자석이 여러 접점을 <b>동시에</b> 바꾸는 전기 스위치. 시퀀스 회로의 "기억·판단" 담당.',
      how: [
        '<b>a접점</b>(NO, 평소 열림): 여자되면 닫힘',
        '<b>b접점</b>(NC, 평소 닫힘): 여자되면 열림',
        '같은 이름의 접점(K1)은 모두 K1 코일 하나가 움직임 → 여러 줄을 한 번에 제어',
        '<b>자기유지</b>: 자기 a접점을 시작 버튼과 병렬로 연결 → 버튼을 떼도 계속 ON',
        '<b>인터록</b>: 상대 릴레이의 b접점을 직렬로 넣어 동시에 켜지지 않게 함',
      ],
      symbol: '코일: 사각형 □. 접점: a = 떨어진 날, b = 닿아 있는 날(작은 턱 표시).',
    },
    sol: {
      name: '솔레노이드 (Y)', en: 'Solenoid Coil', cat: '전기', used: ['t1', 't2', 't3'],
      summary: '전기가 들어오면 전자석 힘으로 밸브의 스풀(사각형)을 밀어 위치를 바꾸는 코일. <b>전기 회로와 유압 회로를 잇는 다리</b>.',
      how: [
        '래더 회로의 Y1 코일 = 유압 회로 밸브 옆의 Y1 솔레노이드 (같은 부품!)',
        '통전(ON) → 밸브 전환  /  소자(OFF) → 스프링 복귀',
        '이 시뮬레이터에서 Y 코일에 마우스를 올리면 유압 회로의 해당 밸브가 함께 강조돼요',
      ],
      symbol: '래더: 사각형 안 대각선 + 밸브 표시. 유압: 밸브 끝의 사각형 안 대각선.',
    },
  };

  /* ---------------- 미니 데모들 ---------------- */
  function valveDemo(host, cap, cfg) {
    const svg = S('svg');
    host.prepend(svg);
    const D = new HYD.HydDiagram(svg, cfg.w, cfg.h);
    for (const k in cfg.stubs) D.line(k, cfg.stubs[k]);
    const v = HYD.DirValve(D, cfg.valve);
    for (const [t, x, y] of cfg.labels) D.label(x, y, t, 'svg-label', 'middle');
    let i = 0;
    const apply = () => {
      const st = cfg.states[i];
      v.update(st.pos, st.sol || {}, st.flows || {});
      D.applyLines(st.lines || {});
      cap.innerHTML = st.label;
    };
    apply();
    return { next() { i = (i + 1) % cfg.states.length; apply(); }, btn: cfg.btn };
  }
  const P4 = { A: [0.25, 't'], B: [0.75, 't'], P: [0.25, 'b'], T: [0.75, 'b'] };
  const P3 = { A: [0.25, 't'], P: [0.25, 'b'], T: [0.75, 'b'] };
  const stub4 = (a, b) => ({ A: [[a, 60], [a, 26]], B: [[b, 60], [b, 26]], P: [[a, 112], [a, 146]], T: [[b, 112], [b, 146]] });
  const lab4 = (a, b) => [['A', a, 20], ['B', b, 20], ['P', a, 164], ['T', b, 164]];

  const DEMOS = {
    v42: (host, cap) => valveDemo(host, cap, {
      w: 340, h: 172, btn: '솔레노이드 ON/OFF',
      valve: { ref: 'demo', x0: 70, y: 60, home: 1, ports: P4, squares: [[['a', 'P', 'B'], ['a', 'A', 'T']], [['a', 'P', 'A'], ['a', 'B', 'T']]], left: ['sol'], right: ['spring'], labelL: 'Y' },
      stubs: stub4(160, 196), labels: lab4(160, 196),
      states: [
        { label: '<b>소자(OFF)</b> · 스프링 위치 = <b>평행</b>: P→A, B→T', pos: 1, flows: { 'P>A': 'p', 'B>T': 'r' }, lines: { P: ['p', -1], A: ['p', 1], B: ['r', -1], T: ['r', 1] } },
        { label: '<b>통전(ON)</b> · 사각형이 밀려 <b>교차</b>: P→B, A→T', pos: 0, sol: { L: true }, flows: { 'P>B': 'p', 'A>T': 'r' }, lines: { P: ['p', -1], B: ['p', 1], A: ['r', -1], T: ['r', 1] } },
      ],
    }),
    v43: (host, cap) => valveDemo(host, cap, {
      w: 480, h: 172, btn: '다음 위치 ▶',
      valve: { ref: 'demo', x0: 130, y: 60, home: 1, ports: P4,
        squares: [[['a', 'P', 'A'], ['a', 'B', 'T']], [['b', 'A'], ['b', 'B'], ['b', 'P'], ['b', 'T']], [['a', 'P', 'B'], ['a', 'A', 'T']]],
        left: ['spring', 'sol'], right: ['spring', 'sol'], labelL: 'Y1', labelR: 'Y2' },
      stubs: stub4(220, 256), labels: lab4(220, 256),
      states: [
        { label: '<b>모두 OFF</b> · 중립(올 포트 블록): 전부 막힘', pos: 1, flows: { xP: 'ps', xA: 'lock', xB: 'lock' }, lines: { P: ['ps', 0], A: ['lock', 0], B: ['lock', 0] } },
        { label: '<b>Y1 ON</b> · 왼쪽 위치: P→A, B→T', pos: 0, sol: { L: true }, flows: { 'P>A': 'p', 'B>T': 'r' }, lines: { P: ['p', -1], A: ['p', 1], B: ['r', -1], T: ['r', 1] } },
        { label: '<b>모두 OFF</b> · 스프링이 다시 중립으로', pos: 1, flows: { xP: 'ps', xA: 'lock', xB: 'lock' }, lines: { P: ['ps', 0], A: ['lock', 0], B: ['lock', 0] } },
        { label: '<b>Y2 ON</b> · 오른쪽 위치: P→B, A→T', pos: 2, sol: { R: true }, flows: { 'P>B': 'p', 'A>T': 'r' }, lines: { P: ['p', -1], B: ['p', 1], A: ['r', -1], T: ['r', 1] } },
      ],
    }),
    v32: (host, cap) => valveDemo(host, cap, {
      w: 340, h: 172, btn: '솔레노이드 ON/OFF',
      valve: { ref: 'demo', x0: 70, y: 60, home: 1, ports: P3, squares: [[['a', 'P', 'A'], ['b', 'T']], [['b', 'P'], ['a', 'A', 'T']]], left: ['sol'], right: ['spring'], labelL: 'Y' },
      stubs: { A: [[160, 60], [160, 26]], P: [[160, 112], [160, 146]], T: [[196, 112], [196, 146]] },
      labels: [['A', 160, 20], ['P', 160, 164], ['T', 196, 164]],
      states: [
        { label: '<b>소자(OFF)</b> · NC: P 막힘, A→T 배출', pos: 1, flows: { xP: 'ps' }, lines: { P: ['ps', 0] } },
        { label: '<b>통전(ON)</b> · P→A 공급 (파일럿 신호 ON)', pos: 0, sol: { L: true }, flows: { 'P>A': 'pilot' }, lines: { P: ['p', -1], A: ['pilot', 0] } },
      ],
    }),
    v22: (host, cap) => valveDemo(host, cap, {
      w: 320, h: 172, btn: '솔레노이드 ON/OFF',
      valve: { ref: 'demo', x0: 100, y: 60, w: 56, h: 50, home: 1, ports: { U: [0.5, 't'], D: [0.5, 'b'] }, squares: [[['b', 'U'], ['b', 'D']], [['d', 'D', 'U']]], left: ['sol'], right: ['spring'], labelL: 'Y' },
      stubs: { U: [[184, 60], [184, 26]], D: [[184, 110], [184, 146]] },
      labels: [['출구', 184, 20], ['입구', 184, 164]],
      states: [
        { label: '<b>소자(OFF)</b> · N/O: 열림, 자유 통과', pos: 1, flows: { 'D>U': 'p' }, lines: { D: ['p', -1], U: ['p', 1] } },
        { label: '<b>통전(ON)</b> · 닫힘: 흐름 차단', pos: 0, sol: { L: true }, flows: { xD: 'ps' }, lines: { D: ['ps', 0] } },
      ],
    }),
    pc: (host, cap) => checkDemo(host, cap, true),
    check: (host, cap) => checkDemo(host, cap, false),
    fcv: (host, cap) => {
      const svg = S('svg'); host.prepend(svg);
      const D = new HYD.HydDiagram(svg, 300, 220);
      D.line('bot', [[150, 205], [150, 142]]);
      D.line('thr', [[150, 142], [150, 78]]);
      D.line('byp', [[150, 142], [115, 142], [115, 78], [150, 78]]);
      D.line('top', [[150, 78], [150, 15]]);
      D.dot(150, 78); D.dot(150, 142);
      const f = HYD.OneWayFCV(D, { ref: 'demo', x: 150, cy: 110, box: [100, 62, 194, 158], bypassX: 115, checkDir: 'up' });
      D.label(214, 30, '실린더 쪽', 'svg-small'); D.label(214, 200, '밸브 쪽', 'svg-small');
      let up = true;
      const apply = () => {
        f.update(up);
        if (up) D.applyLines({ bot: ['p', 1, 1], byp: ['p', 1, 1], thr: ['ps', 0], top: ['p', 1, 1] });
        else D.applyLines({ top: ['r', -1, 0.35], thr: ['r', -1, 0.35], byp: ['rs', 0], bot: ['r', -1, 0.35] });
        cap.innerHTML = up ? '<b>아래→위</b>: 체크 밸브가 열려 <b>자유 흐름</b> (빠름)' : '<b>위→아래</b>: 체크가 막혀 <b>교축으로만</b> 통과 → 유량 제한 (느림)';
      };
      apply();
      return { next() { up = !up; apply(); }, btn: '흐름 방향 바꾸기' };
    },
    relief: (host, cap) => {
      const svg = S('svg'); host.prepend(svg);
      const D = new HYD.HydDiagram(svg, 300, 200);
      D.line('in', [[150, 18], [150, 70]]);
      D.line('out', [[150, 114], [150, 168]]);
      HYD.tank(D, 150, 160);
      const r = HYD.Relief(D, { ref: 'demo', orient: 'v', x: 150, y: 92 });
      const g = HYD.Gauge(D, { ref: 'g', x: 240, y: 40, r: 14, vx: 240, vy: 76 });
      D.line('gl', [[150, 40], [226, 40]]);
      D.label(200, 140, '설정압 5 MPa', 'svg-small');
      const wrap = H('div', { class: 'slider-row', style: 'margin:6px 8px 0' });
      const inp = H('input', { type: 'range', min: 0, max: 8, step: 0.1, value: 2 });
      const out = H('output', { text: '2.0 MPa' });
      wrap.append(H('span', { text: '입구 압력' }), inp, out);
      host.append(wrap);
      const apply = () => {
        const p = +inp.value, open = p >= 5;
        const shown = Math.min(p, 5);
        out.textContent = p.toFixed(1) + ' MPa';
        r.update(open, true); g.update(shown);
        D.applyLines({ in: open ? ['p', 1, 1] : ['ps', 0], out: open ? ['r', 1, 1] : ['idle', 0], gl: ['ps', 0] });
        cap.innerHTML = open ? `<b>열림!</b> 압력이 설정압에 도달 → 탱크로 배출해 <b>5 MPa 이상 오르지 않음</b>` : `<b>닫힘</b> · ${shown.toFixed(1)} MPa < 설정압 5 MPa`;
      };
      inp.addEventListener('input', apply);
      apply();
      return null;
    },
    cyl: (host, cap) => {
      const svg = S('svg'); host.prepend(svg);
      const D = new HYD.HydDiagram(svg, 470, 170);
      D.line('head', [[52, 150], [52, 92]]);
      D.line('rod', [[228, 150], [228, 92]]);
      const c = HYD.Cylinder(D, { ref: 'demo', x: 40, y: 48, w: 200, h: 44, stroke: 150, rodOut: 40, headPortX: 52, rodPortX: 228, label: '' });
      D.label(52, 166, '헤드 측', 'svg-small', 'middle'); D.label(228, 166, '로드 측', 'svg-small', 'middle');
      let s = 0, dir = 1, raf = null, last = 0;
      const draw = () => {
        c.update(s, dir > 0 ? 'p' : 'r', dir > 0 ? 'r' : 'p');
        const moving = (dir > 0 && s < 1) || (dir < 0 && s > 0);
        D.applyLines(dir > 0 ? { head: ['p', moving ? 1 : 0], rod: moving ? ['r', -1] : ['idle', 0] } : { rod: ['p', moving ? 1 : 0], head: moving ? ['r', -1] : ['idle', 0] });
      };
      const loop = t => {
        const dt = last ? Math.min(0.05, (t - last) / 1000) : 0; last = t;
        s = Math.max(0, Math.min(1, s + dir * dt * (dir > 0 ? 0.5 : 0.75)));
        draw();
        if ((dir > 0 && s < 1) || (dir < 0 && s > 0)) raf = requestAnimationFrame(loop); else { raf = null; last = 0; }
      };
      const go = () => { if (!raf) raf = requestAnimationFrame(loop); };
      const setCap = () => { cap.innerHTML = dir > 0 ? '<b>헤드 측</b>에 압유 → 전진 (면적 큼 → 힘 큼, 속도 느림)' : '<b>로드 측</b>에 압유 → 후진 (면적 작음 → 힘 작음, 속도 빠름)'; };
      draw(); setCap(); go();
      return { next() { dir = -dir; setCap(); go(); }, btn: '방향 바꾸기' };
    },
    ls: (host, cap) => {
      const svg = S('svg'); host.prepend(svg);
      const D = new HYD.HydDiagram(svg, 300, 170);
      const l = HYD.LimitSwitch(D, { ref: 'demo', x: 150, rollerY: 132, label: 'LS' });
      const dog = S('rect', { x: 60, y: 139, width: 26, height: 10, rx: 2, class: 'dog' });
      const rod = S('rect', { x: 0, y: 149, width: 86, height: 12, class: 'rod' });
      D.gSym.append(rod, dog);
      let on = false;
      const apply = () => {
        l.update(on);
        dog.setAttribute('x', on ? 137 : 60); rod.setAttribute('width', on ? 163 : 86);
        cap.innerHTML = on ? '도그가 롤러를 누름 → <b>접점 ON</b> (래더의 LS 접점 닫힘)' : '도그가 떨어져 있음 → <b>접점 OFF</b>';
      };
      apply();
      return { next() { on = !on; apply(); }, btn: '도그 이동' };
    },
    pcfcv: (host, cap) => {
      const svg = S('svg'); host.prepend(svg);
      const D = new HYD.HydDiagram(svg, 300, 200);
      D.line('a', [[150, 190], [150, 140]]); D.line('b', [[150, 140], [150, 60]]); D.line('c', [[150, 60], [150, 10]]);
      HYD.PCFCV(D, { ref: 'demo', x: 150, yTop: 60, yBot: 140 });
      const t = D.label(190, 100, '', 'svg-small');
      let hi = false;
      const apply = () => {
        D.applyLines({ a: ['p', 1, 0.6], b: ['p', 1, 0.6], c: ['p', 1, 0.6] });
        t.textContent = hi ? '부하 4 MPa → 유량 Q' : '부하 1 MPa → 유량 Q';
        cap.innerHTML = hi ? '부하 압력이 커져도 <b>유량(=속도)은 그대로!</b> 보상기가 압력차를 자동 조절' : '설정 유량 Q로 실린더에 공급';
      };
      apply();
      return { next() { hi = !hi; apply(); }, btn: '부하 압력 바꾸기' };
    },
    gauge: (host, cap) => {
      const svg = S('svg'); host.prepend(svg);
      const D = new HYD.HydDiagram(svg, 300, 150);
      const g = HYD.Gauge(D, { ref: 'demo', x: 150, y: 62, r: 34, vx: 150, vy: 122 });
      const wrap = H('div', { class: 'slider-row', style: 'margin:6px 8px 0' });
      const inp = H('input', { type: 'range', min: 0, max: 8, step: 0.1, value: 3 });
      wrap.append(H('span', { text: '압력' }), inp, H('span'));
      host.append(wrap);
      const apply = () => { g.update(+inp.value); cap.textContent = '슬라이더로 압력을 바꿔 보세요'; };
      inp.addEventListener('input', apply);
      apply();
      return null;
    },
    pu: (host, cap) => {
      const svg = S('svg', { viewBox: '0 0 320 210' }); host.prepend(svg);
      const px = 140, my = 0;
      const g = S('g');
      g.append(S('path', { d: `M30 150 L30 190 L250 190 L250 150`, class: 'sym' }));
      g.append(S('line', { x1: px, y1: 186, x2: px, y2: 156, class: 'hl-base s-suc' }));
      g.append(S('line', { x1: px, y1: 132, x2: px, y2: 116, class: 'hl-base s-suc' }));
      g.append(S('path', { d: `M${px} 132 L${px + 12} 144 L${px} 156 L${px - 12} 144 Z`, class: 'sym-fill' }));
      g.append(S('line', { x1: px - 9, y1: 144, x2: px + 9, y2: 144, class: 'sym-dash', style: 'stroke-dasharray:3 2' }));
      g.append(S('line', { x1: px, y1: 64, x2: px, y2: 14, class: 'hl-base s-p' }));
      g.append(S('circle', { cx: px, cy: 90, r: 26, class: 'sym-fill' }));
      g.append(S('polygon', { points: `${px},65 ${px - 8},78 ${px + 8},78`, class: 'sym-solid' }));
      g.append(S('circle', { cx: px, cy: 90, r: 11, class: 'sym-dash spin', style: 'stroke-dasharray:4 4' }));
      g.append(S('line', { x1: px + 26, y1: 86, x2: px + 78, y2: 86, class: 'sym' }), S('line', { x1: px + 26, y1: 94, x2: px + 78, y2: 94, class: 'sym' }));
      g.append(S('circle', { cx: px + 98, cy: 90, r: 20, class: 'sym-fill' }), S('text', { x: px + 98, y: 97, 'text-anchor': 'middle', class: 'svg-label', text: 'M', style: 'font-size:19px' }));
      const lb = (x, y, t, a = 'start') => g.append(S('text', { x, y, class: 'svg-small', 'text-anchor': a, text: t }));
      lb(px - 34, 94, '펌프', 'end'); lb(px + 98, 128, '전동기', 'middle'); lb(px - 18, 148, '필터', 'end'); lb(40, 205, '오일 탱크'); lb(px + 8, 22, '→ 회로로 토출');
      svg.append(g);
      cap.innerHTML = '모터가 펌프를 돌리면 탱크 오일이 필터를 지나 빨려 올라와 회로로 밀려 나가요.';
      return null;
    },
    pb: (host, cap) => ladderDemo(host, cap, 'pb'),
    relay: (host, cap) => ladderDemo(host, cap, 'relay'),
    sol: (host, cap) => DEMOS.v42(host, cap),
  };

  function checkDemo(host, cap, pilot) {
    const svg = S('svg'); host.prepend(svg);
    const D = new HYD.HydDiagram(svg, 300, 220);
    D.line('bot', [[150, 205], [150, 150]]);
    D.line('mid', [[150, 150], [150, 70]]);
    D.line('top', [[150, 70], [150, 15]]);
    let pc, chk;
    if (pilot) {
      D.line('pil', [[162, 150], [162, 178], [236, 178], [236, 30]], { pilot: true });
      D.label(244, 24, '파일럿', 'svg-small');
      pc = HYD.PilotCheck(D, { ref: 'demo', x: 150, yTop: 70, yBot: 150 });
    } else {
      chk = HYD.Check(D.gSym, 150, 112, 'up');
    }
    D.label(176, 24, '위', 'svg-small'); D.label(176, 204, '아래', 'svg-small');
    let up = true, pil = false;
    const apply = () => {
      const pass = up || pil;
      if (pc) pc.update(pass); else chk.set(pass);
      if (up) D.applyLines({ bot: ['p', 1], mid: ['p', 1], top: ['p', 1], pil: pil ? ['pilot', 0] : ['idle', 0] });
      else if (pass) D.applyLines({ top: ['p', -1], mid: ['p', -1], bot: ['p', -1], pil: ['pilot', 0] });
      else D.applyLines({ top: ['ps', 0], mid: ['ps', 0], pil: ['idle', 0] });
      cap.innerHTML = (up ? '<b>아래→위</b>(정방향): ' : '<b>위→아래</b>(역방향): ') +
        (pass ? (up ? '볼이 밀려 <b>통과 ✅</b>' : '파일럿 압력이 볼을 강제로 열어 <b>통과 ✅</b>') : '볼이 시트에 밀착 <b>차단 ⛔</b>' + (pilot ? ' (파일럿 OFF)' : ''));
    };
    apply();
    const extra = [];
    if (pilot) {
      const b = H('button', { class: 'btn', text: '파일럿 ON/OFF', onclick: () => { pil = !pil; apply(); } });
      extra.push(b);
    }
    return { next() { up = !up; apply(); }, btn: '흐름 방향 바꾸기', extra };
  }

  function ladderDemo(host, cap, kind) {
    const svg = S('svg'); host.prepend(svg);
    const st = { S: false, K: false };
    let rungs;
    if (kind === 'pb') {
      rungs = [{ top: [{ ref: 'PB', kind: 'no', act: 'pb' }], ser: [], coil: { ref: 'L', kind: 'lamp' } }];
    } else {
      rungs = [
        { top: [{ ref: 'S', kind: 'no', act: 'pb' }], ser: [], coil: { ref: 'K', kind: 'relay' } },
        { top: [{ ref: 'K', kind: 'no', act: 'k' }], ser: [], coil: { ref: 'L1', kind: 'lamp' } },
        { top: [{ ref: 'K', kind: 'nc', act: 'k' }], ser: [], coil: { ref: 'L2', kind: 'lamp' } },
      ];
    }
    const sim = {
      closed: el => { const a = el.ref === 'K' ? st.K : st.S; return el.kind === 'nc' ? !a : a; },
      coilOn: ref => ref === 'K' ? st.K : ref === 'L' ? st.S : ref === 'L1' ? st.K : !st.K,
      coilPending: () => false,
    };
    let lad;
    const apply = () => {
      st.K = st.S;
      lad.update(sim);
      if (kind === 'pb') cap.innerHTML = st.S ? '누르는 동안 <b>접점 닫힘 → 램프 ON</b>' : '손을 떼면 <b>접점 열림 → 램프 OFF</b>';
      else cap.innerHTML = st.K ? '코일 K 여자 → <b>a접점 닫힘(L1 ON)</b>, <b>b접점 열림(L2 OFF)</b>' : '코일 K 소자 → a접점 열림(L1 OFF), b접점 닫힘(L2 ON)';
    };
    lad = new Ladder(svg, rungs, { onPB: down => { st.S = down; apply(); } });
    svg.style.maxHeight = '200px';
    apply();
    return { next() { st.S = !st.S; apply(); }, btn: kind === 'pb' ? '누르기/떼기' : '코일 K ON/OFF' };
  }

  /* ---------------- 부품 사전 페이지 ---------------- */
  const TASK_NAMES = { t1: '실습과제 1', t2: '실습과제 2', t3: '실습과제 3' };
  function buildPartsPage(root) {
    root.innerHTML = '';
    root.append(H('div', { class: 'page-head' }, H('h1', { text: '📚 부품 사전' }),
      H('p', { html: '과제에 나오는 모든 부품을 <b>기호 · 동작 원리 · 쓰이는 곳</b>으로 정리했어요. 기호 아래 버튼을 누르면 직접 움직여 볼 수 있어요.' })));
    const cats = ['전체', ...new Set(Object.values(PARTS).map(p => p.cat))];
    const filt = H('div', { class: 'parts-filter seg', style: 'display:inline-flex;flex-wrap:wrap' });
    const grid = H('div', { class: 'parts-grid' });
    const cards = [];
    cats.forEach((c, i) => {
      const b = H('button', { text: c, class: i === 0 ? 'on' : '', onclick: () => {
        [...filt.children].forEach(x => x.classList.toggle('on', x === b));
        cards.forEach(cd => { cd.el.style.display = (c === '전체' || cd.p.cat === c) ? '' : 'none'; });
      } });
      filt.append(b);
    });
    root.append(H('div', { style: 'margin-bottom:12px' }, filt));
    for (const key in PARTS) {
      const p = PARTS[key];
      const symArea = H('div', { class: 'sym-area' });
      const cap = H('div', { class: 'small muted', style: 'padding:6px 14px 0;min-height:28px' });
      const el = H('div', { class: 'card part', id: 'part-' + key },
        symArea, cap,
        H('div', { class: 'pb' },
          H('h3', { text: p.name }), H('div', { class: 'en', text: p.en }),
          H('p', { html: p.summary }),
          H('ul', null, p.how.map(x => H('li', { html: x }))),
          H('p', { class: 'small muted', html: '<b>기호 읽기:</b> ' + p.symbol }),
          H('div', { class: 'used' }, H('span', { class: 'pill', text: p.cat }), p.used.map(t => H('a', { class: 'pill', href: '#' + t, text: '→ ' + TASK_NAMES[t] })))));
      grid.append(el);
      cards.push({ el, p });
      if (DEMOS[key]) {
        const ctl = DEMOS[key](symArea, cap);
        if (ctl && ctl.btn) {
          const row = H('div', { style: 'position:absolute;right:8px;bottom:8px;display:flex;gap:6px' });
          (ctl.extra || []).forEach(b => { b.style.position = 'static'; row.append(b); });
          const b = H('button', { class: 'btn', text: ctl.btn, onclick: () => ctl.next() });
          b.style.position = 'static';
          row.append(b);
          symArea.append(row);
          symArea.style.paddingBottom = '46px';
        }
      }
    }
    root.append(grid);
  }

  window.PARTS = PARTS;
  window.buildPartsPage = buildPartsPage;
  window.PART_DEMOS = DEMOS;
})();
