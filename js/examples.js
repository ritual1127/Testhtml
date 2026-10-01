// 예제 · 과제 회로 (공유압기능사 / 설비보전기사 실기 유형 참고, 독자 구성)
import { newComp, compPorts, compBBox } from './components.js';

function builder(name, mode) {
  const doc = { version: 1, name, mode, components: [], wires: [], task: null };
  let n = 0;
  const b = {
    doc,
    add(type, x, y, props = {}, rot = 0) {
      const c = newComp(type, x, y, 'c' + ++n);
      Object.assign(c.props, props);
      c.rot = rot;
      doc.components.push(c);
      return c.id;
    },
    w(a, ap, bb, bp, pts = []) { doc.wires.push({ id: 'w' + ++n, a: { c: a, p: ap }, b: { c: bb, p: bp }, pts }); },
    pt(id, pid) {
      const c = doc.components.find((q) => q.id === id);
      const p = compPorts(c).find((q) => q.id === pid);
      return [p.wx, p.wy];
    },
    task(title, steps, note) {
      doc.task = { title, html: `<ol>${steps.map((s) => `<li>${s}</li>`).join('')}</ol>${note ? `<p style="margin:8px 0 0;font-size:12px;color:#6b5a1f">💡 ${note}</p>` : ''}` };
    },
    maxX() { return Math.max(...doc.components.map((c) => compBBox(c)[2])); },
  };
  return b;
}

// 공압 공급: 공급원 + 서비스유닛 → 대상 포트들(분기점 자동)
function pnSupply(b, fx, fy, targets) {
  const src = b.add('p_source', fx - 70, fy + 40);
  const frl = b.add('p_frl', fx, fy, { p: 6 });
  b.w(src, '1', frl, '1');
  const ts = targets.map(([id, pid]) => ({ id, pid, x: b.pt(id, pid)[0] })).sort((p, q) => p.x - q.x);
  let prev = [frl, '2'];
  ts.forEach((t, i) => {
    if (i < ts.length - 1) {
      const j = b.add('p_junction', t.x, fy);
      b.w(prev[0], prev[1], j, 'J');
      b.w(j, 'J', t.id, t.pid);
      prev = [j, 'J'];
    } else b.w(prev[0], prev[1], t.id, t.pid);
  });
  return frl;
}

// 유압 파워유닛을 밸브 P/T에 연결
function hyUnit(b, v, props = {}) {
  const [px, py] = b.pt(v, 'P');
  const pu = b.add('h_powerunit', px, py + 60, { q: 8, p: 50, ...props });
  b.w(pu, 'P', v, 'P');
  b.w(pu, 'T', v, 'T');
  return pu;
}

// 실린더 + 밸브(아래) 기본 배치 및 배관 (5/2, 4/x 공용)
function cylValve(b, x, y, cylType, cylProps, vType, vProps, gap = 120) {
  const cyl = b.add(cylType, x, y, cylProps);
  const v = b.add(vType, x + 40, y + gap, vProps);
  const pn = cylType.startsWith('p_');
  const [pa, pb] = pn ? ['4', '2'] : ['A', 'B'];
  b.w(v, pa, cyl, 'A');
  if (!cylType.includes('single')) b.w(v, pb, cyl, 'B');
  return { cyl, v };
}

// 전기 래더 회로 자동 작도. rungs: [[항목...]...], 항목 = [type, props] | {par: [[항목...], [항목...]]}
function ladder(b, X0, Y0, rungs, dx = 80) {
  const hOf = (items) => items.reduce((s, it) => s + (it.par ? 40 + Math.max(...it.par.map((br) => br.length * 60)) : 60), 0);
  const Y1 = Y0 + Math.max(...rungs.map(hOf)) + 30;
  const tx = rungs.length === 1 ? X0 : X0 - 40;
  const plus = b.add('e_24v', tx, Y0 - 10);
  const zero = b.add('e_0v', tx, Y1 + 10);
  let prevTop = [plus, '1'], prevBot = [zero, '1'];
  let x = X0;
  rungs.forEach((items, i) => {
    const last = i === rungs.length - 1;
    let cur;
    if (!last) { const j = b.add('e_junction', x, Y0); b.w(prevTop[0], prevTop[1], j, 'J'); cur = prevTop = [j, 'J']; }
    else cur = prevTop;
    let y = Y0;
    let width = 1;
    for (const it of items) {
      if (it.par) {
        const j1 = b.add('e_junction', x, y + 20);
        b.w(cur[0], cur[1], j1, 'J');
        let maxY = y + 20;
        const ends = [];
        it.par.forEach((br, k) => {
          const bx = x + k * 50;
          let bc = [j1, 'J'];
          let by = y + 20;
          for (const e of br) { const id = b.add(e[0], bx, by + 40, e[1] || {}); b.w(bc[0], bc[1], id, '1'); bc = [id, '2']; by += 60; }
          ends.push(bc);
          maxY = Math.max(maxY, by);
          width = Math.max(width, k + 1);
        });
        const j2 = b.add('e_junction', x, maxY + 20);
        for (const e of ends) b.w(e[0], e[1], j2, 'J');
        cur = [j2, 'J'];
        y = maxY + 20;
      } else {
        const id = b.add(it[0], x, y + 40, it[1] || {});
        b.w(cur[0], cur[1], id, '1');
        cur = [id, '2'];
        y += 60;
      }
    }
    if (!last) { const j = b.add('e_junction', x, Y1); b.w(cur[0], cur[1], j, 'J'); b.w(prevBot[0], prevBot[1], j, 'J'); prevBot = [j, 'J']; }
    else b.w(cur[0], cur[1], prevBot[0], prevBot[1]);
    x += dx + (width - 1) * 50;
  });
}
const E = (t, tag, extra = {}) => [t, { tag, ...extra }];
const PAR = (...brs) => ({ par: brs });

export const EXAMPLES = [];
const ex = (o) => EXAMPLES.push(o);

/* =================== 공압 기초 =================== */
ex({ id: 'p1', group: '공압 기초', title: '단동 실린더 직접 제어', summary: '3/2 누름버튼 밸브로 단동 실린더를 전진·후진', tags: ['3/2 밸브', '단동'],
  build() {
    const b = builder('단동 실린더 직접 제어', 'pn');
    const cyl = b.add('p_cyl_single', 60, 40, { tag: '1A' });
    const v = b.add('pv32_push_nc', 70, 140, { tag: '1V1' });
    b.w(v, '2', cyl, 'A');
    pnSupply(b, -20, 270, [[v, '1']]);
    b.task('단동 실린더 직접 제어', ['시뮬레이션 시작 후 누름버튼 밸브 <b>1V1</b>을 누르고 있는 동안 실린더 <b>1A</b>가 전진한다.', '버튼을 놓으면 1V1이 스프링 복귀하여 2→3 배기되고, 실린더는 스프링 힘으로 후진한다.'], '밸브를 누르는 동안 1→2 관로가 파랗게(가압) 변하는 것을 확인하세요.');
    return b.doc;
  } });

ex({ id: 'p2', group: '공압 기초', title: '복동 실린더 직접 제어', summary: '5/2 누름버튼 밸브로 복동 실린더 제어', tags: ['5/2 밸브', '복동'],
  build() {
    const b = builder('복동 실린더 직접 제어', 'pn');
    const { v } = cylValve(b, 60, 40, 'p_cyl_double', { tag: '1A' }, 'pv52_push', { tag: '1V1' });
    pnSupply(b, 40, 290, [[v, '1']]);
    b.task('복동 실린더 직접 제어', ['5/2 누름버튼 밸브 <b>1V1</b>을 누르면 1→4로 공기가 공급되어 실린더 <b>1A</b>가 전진한다.', '버튼을 놓으면 1→2로 전환되어 실린더가 후진한다. (4→5 배기)']);
    return b.doc;
  } });

ex({ id: 'p3', group: '공압 기초', title: '속도 제어 회로 (미터아웃)', summary: '일방향 유량제어 밸브로 전진/후진 속도를 각각 조절', tags: ['미터아웃', '속도제어', '디텐트'],
  build() {
    const b = builder('복동 실린더 속도 제어 (미터아웃)', 'pn');
    const cyl = b.add('p_cyl_double', 60, 40, { tag: '1A' });
    const f1 = b.add('p_flow_oneway', 80, 140, { tag: '1V2', open: 60 }, 270);
    const f2 = b.add('p_flow_oneway', 160, 140, { tag: '1V3', open: 25 }, 270);
    const v = b.add('pv52_lever_det', 100, 250, { tag: '1V1' });
    b.w(cyl, 'A', f1, '2');
    b.w(cyl, 'B', f2, '2');
    b.w(f1, '1', v, '4');
    b.w(f2, '1', v, '2');
    pnSupply(b, 40, 380, [[v, '1']]);
    b.task('미터아웃 속도 제어', ['디텐트 레버 밸브 <b>1V1</b>을 클릭하면 실린더가 전진하고, 다시 클릭하면 후진한다.', '전진 속도는 배기측 <b>1V3</b>(25%), 후진 속도는 <b>1V2</b>(60%)의 개도로 조절된다.', '오른쪽 <b>실시간 조정</b> 슬라이더로 개도를 바꾸며 속도 변화를 확인한다.'], '미터아웃은 배기 공기를 교축하므로 부하 변동에도 안정된 속도를 얻을 수 있습니다. 선도(G)로 속도를 비교하세요.');
    return b.doc;
  } });

function logicExample(id, title, logic, ltag) {
  ex({ id, group: '공압 기초', title, summary: logic === 'p_twopress' ? '두 버튼을 동시에 눌러야 전진 (안전 양수조작)' : '두 위치 중 어느 버튼으로도 전진', tags: [logic === 'p_twopress' ? '2압 밸브' : '셔틀 밸브', '파일럿'],
    build() {
      const b = builder(title, 'pn');
      const { v } = cylValve(b, 60, 40, 'p_cyl_double', { tag: '1A' }, 'pv52_pilot', { tag: '1V1' });
      const lg = b.add(logic, -40, 250, { tag: ltag });
      const s1 = b.add('pv32_push_nc', -120, 320, { tag: '1S1' });
      const s2 = b.add('pv32_push_nc', 20, 320, { tag: '1S2' });
      b.w(lg, 'A', v, '14');
      b.w(s1, '2', lg, 'X');
      b.w(s2, '2', lg, 'Y');
      pnSupply(b, -190, 440, [[s1, '1'], [s2, '1'], [v, '1']]);
      b.task(title, logic === 'p_twopress'
        ? ['누름버튼 밸브 <b>1S1</b>과 <b>1S2</b>를 <b>모두</b> 누르고 있을 때만 2압 밸브(AND) 출력이 나와 실린더가 전진한다.', '하나라도 놓으면 1V1 파일럿이 배기되어 스프링 복귀 → 후진한다.']
        : ['누름버튼 밸브 <b>1S1</b> 또는 <b>1S2</b> 중 어느 것을 눌러도 셔틀 밸브(OR)를 통해 실린더가 전진한다.', '버튼을 놓으면 후진한다.'],
      logic === 'p_twopress' ? '한 개를 누른 상태에서 다른 버튼을 누르려면 시뮬레이션 일시정지 후 누르거나, 실습장비 화면을 함께 사용해 보세요. (실습: 1S1을 디텐트 밸브로 바꿔보기)' : null);
      return b.doc;
    } });
}
logicExample('p4', '양수 조작 회로 (AND)', 'p_twopress', '1V2');
logicExample('p5', 'OR 회로 (셔틀 밸브)', 'p_shuttle', '1V2');

function rollerCycle(id, title, withTimer) {
  ex({ id, group: '공압 기초', title, summary: withTimer ? '전진 끝에서 공압 타이머로 일정 시간 정지 후 복귀' : '롤러 리밋밸브와 양측 파일럿 밸브로 연속 왕복', tags: withTimer ? ['시간지연 밸브', '리밋밸브'] : ['리밋밸브', '연속 왕복', '메모리 밸브'],
    build() {
      const b = builder(title, 'pn');
      const { v } = cylValve(b, 60, 40, 'p_cyl_double', { tag: '1A', sw0: '1S1', sw1: '1S2' }, 'pv52_dpilot', { tag: '1V1' });
      const s1 = b.add('pv32_roller_nc', -60, 300, { tag: '1S1', roll: '1S1' });
      const s0 = b.add(withTimer ? 'pv32_push_nc' : 'pv32_lever_det', -60, 420, { tag: '1S0' });
      b.w(s1, '2', v, '14');
      b.w(s0, '2', s1, '1');
      const tgts = [[s0, '1'], [v, '1']];
      if (withTimer) {
        const tm = b.add('pv_timer', 240, 300, { tag: '1V2', delay: 3 });
        const s2 = b.add('pv32_roller_nc', 330, 420, { tag: '1S2', roll: '1S2' });
        b.w(tm, '2', v, '12');
        b.w(s2, '2', tm, '12', [[340, 380], [150, 380], [150, 320]]);
        tgts.push([tm, '1'], [s2, '1']);
      } else {
        const s2 = b.add('pv32_roller_nc', 220, 300, { tag: '1S2', roll: '1S2' });
        b.w(s2, '2', v, '12');
        tgts.push([s2, '1']);
      }
      pnSupply(b, -140, withTimer ? 560 : 540, tgts);
      if (withTimer) b.task(title, ['시작 버튼 <b>1S0</b>을 누르면 (후진끝 리밋밸브 <b>1S1</b> 작동 중) 1V1의 14 파일럿 → 실린더 전진.', '전진 끝 리밋밸브 <b>1S2</b>가 작동하면 시간지연 밸브 <b>1V2</b>에 신호가 들어가고, <b>3초</b> 후 12 파일럿 → 실린더 후진.', '후진 완료 후 정지 (1사이클).'], '실시간 조정에서 지연 시간을 바꿔 보세요.');
      else b.task(title, ['선택 밸브 <b>1S0</b>(디텐트)을 클릭하여 ON → 실린더가 <b>연속 왕복</b> 운동한다.', '후진끝 <b>1S1</b> 신호 → 14 파일럿(전진), 전진끝 <b>1S2</b> 신호 → 12 파일럿(후진).', '1S0을 OFF 하면 후진 완료 후 정지한다.'], '양측 파일럿 밸브는 신호가 사라져도 위치를 유지하는 메모리 기능이 있습니다.');
      return b.doc;
    } });
}
rollerCycle('p6', '연속 왕복 회로 (리밋 밸브)', false);
rollerCycle('p7', '시간 지연 회로 (공압 타이머)', true);

/* =================== 전기-공압 =================== */
function epBase(b, vType, vProps, cylProps) {
  const r = cylValve(b, 60, 40, 'p_cyl_double', { tag: '1A', ...cylProps }, vType, { tag: '1V1', ...vProps });
  pnSupply(b, 40, 290, [[r.v, '1']]);
  return r;
}

ex({ id: 'ep1', group: '전기-공압', title: '편솔 밸브 직접 제어', summary: '푸시버튼으로 솔레노이드 Y1을 직접 여자', tags: ['편솔', '푸시버튼'],
  build() {
    const b = builder('전기-공압 직접 제어 (편솔)', 'pn');
    epBase(b, 'pv52_sol', { sol14: 'Y1' });
    ladder(b, 440, 40, [[E('e_pb_no', 'PB1'), E('e_sol', 'Y1')]]);
    b.task('편솔 밸브 직접 제어', ['푸시버튼 <b>PB1</b>을 누르는 동안 솔레노이드 <b>Y1</b>이 여자되어 실린더가 전진한다.', 'PB1을 놓으면 Y1이 소자되고 밸브가 스프링 복귀하여 실린더가 후진한다.']);
    return b.doc;
  } });

ex({ id: 'ep2', group: '전기-공압', title: '자기유지 회로 (기동/정지)', summary: 'PB1 기동, PB2 정지 — 릴레이 R1 자기유지', tags: ['자기유지', '릴레이'],
  build() {
    const b = builder('자기유지 회로 (기동/정지)', 'pn');
    epBase(b, 'pv52_sol', { sol14: 'Y1' });
    ladder(b, 440, 40, [
      [PAR([E('e_pb_no', 'PB1')], [E('e_relay_no', 'R1')]), E('e_pb_nc', 'PB2'), E('e_relay', 'R1')],
      [E('e_relay_no', 'R1'), E('e_sol', 'Y1')],
    ]);
    b.task('자기유지 회로', ['기동 버튼 <b>PB1</b>을 눌렀다 놓으면 릴레이 <b>R1</b>이 자기유지되어 <b>Y1</b>이 계속 여자 → 실린더 전진 유지.', '정지 버튼 <b>PB2</b>(b접점)를 누르면 자기유지가 해제되어 실린더가 후진한다.']);
    return b.doc;
  } });

ex({ id: 'ep3', group: '전기-공압', title: '리밋 스위치 자동 복귀 (1사이클)', summary: '전진 끝 LS2에서 자동 후진', tags: ['리밋 스위치', '1사이클'],
  build() {
    const b = builder('리밋 스위치에 의한 자동 복귀', 'pn');
    epBase(b, 'pv52_sol', { sol14: 'Y1' }, { sw0: 'LS1', sw1: 'LS2' });
    ladder(b, 440, 40, [
      [PAR([E('e_pb_no', 'PB1')], [E('e_relay_no', 'R1')]), E('e_ls_nc', 'LS2'), E('e_relay', 'R1')],
      [E('e_relay_no', 'R1'), E('e_sol', 'Y1')],
    ]);
    b.task('1사이클 자동 복귀', ['<b>PB1</b>을 누르면 R1 자기유지 → Y1 여자 → 실린더 전진.', '전진 끝 리밋 스위치 <b>LS2</b>(b접점)가 열리면 R1이 해제되어 실린더가 자동 후진한다.']);
    return b.doc;
  } });

ex({ id: 'ep4', group: '전기-공압', title: '연속 왕복 회로 (양솔)', summary: 'PB1 기동 → 연속 왕복, PB2 정지 → 후진 후 정지', tags: ['양솔', '연속 왕복', '리밋 스위치'],
  build() {
    const b = builder('연속 왕복 회로 (양솔 밸브)', 'pn');
    epBase(b, 'pv52_dsol', { sol14: 'Y1', sol12: 'Y2' }, { sw0: 'LS1', sw1: 'LS2' });
    ladder(b, 440, 40, [
      [PAR([E('e_pb_no', 'PB1')], [E('e_relay_no', 'R1')]), E('e_pb_nc', 'PB2'), E('e_relay', 'R1')],
      [E('e_relay_no', 'R1'), E('e_ls_no', 'LS1'), E('e_sol', 'Y1')],
      [E('e_ls_no', 'LS2'), E('e_sol', 'Y2')],
    ]);
    b.task('연속 왕복', ['<b>PB1</b>을 누르면 R1 자기유지. 후진끝 <b>LS1</b> 작동 시 <b>Y1</b> → 전진.', '전진끝 <b>LS2</b> 작동 시 <b>Y2</b> → 후진. 이를 반복한다.', '<b>PB2</b>를 누르면 R1 해제 → 현재 행정을 마치고 후진 위치에서 정지.']);
    return b.doc;
  } });

ex({ id: 'ep5', group: '전기-공압', title: '타이머 회로 (전진 후 대기)', summary: '전진 끝에서 T1(3초) 대기 후 자동 후진', tags: ['ON 딜레이 타이머', '리밋 스위치'],
  build() {
    const b = builder('타이머 회로 (전진 끝 3초 대기)', 'pn');
    epBase(b, 'pv52_sol', { sol14: 'Y1' }, { sw0: 'LS1', sw1: 'LS2' });
    ladder(b, 440, 40, [
      [PAR([E('e_pb_no', 'PB1')], [E('e_relay_no', 'R1')]), E('e_timer_nc', 'T1'), E('e_relay', 'R1')],
      [E('e_relay_no', 'R1'), E('e_sol', 'Y1')],
      [E('e_ls_no', 'LS2'), E('e_ton', 'T1', { delay: 3 })],
    ]);
    b.task('전진 끝 대기 회로', ['<b>PB1</b> → R1 자기유지 → Y1 → 실린더 전진.', '전진끝 <b>LS2</b>가 작동하면 타이머 <b>T1</b>(3초) 동작 시작.', '3초 후 T1 b접점이 열려 R1 해제 → 실린더 후진.']);
    return b.doc;
  } });

ex({ id: 'ep6', group: '전기-공압', title: '카운터 회로 (3회 왕복 후 정지)', summary: '카운터 C1으로 왕복 횟수 제어, PB2 리셋', tags: ['카운터', '연속 왕복'],
  build() {
    const b = builder('카운터 회로 (3회 왕복)', 'pn');
    epBase(b, 'pv52_dsol', { sol14: 'Y1', sol12: 'Y2' }, { sw0: 'LS1', sw1: 'LS2' });
    ladder(b, 440, 40, [
      [PAR([E('e_pb_no', 'PB1')], [E('e_relay_no', 'R1')]), E('e_counter_nc', 'C1'), E('e_relay', 'R1')],
      [E('e_relay_no', 'R1'), E('e_ls_no', 'LS1'), E('e_sol', 'Y1')],
      [E('e_ls_no', 'LS2'), E('e_sol', 'Y2')],
      [E('e_ls_no', 'LS2'), E('e_counter', 'C1', { preset: 3 })],
      [E('e_pb_no', 'PB2'), E('e_counter_rst', 'C1')],
    ]);
    b.task('횟수 제어 회로', ['<b>PB1</b>을 누르면 실린더가 연속 왕복한다.', '전진끝 <b>LS2</b>마다 카운터 <b>C1</b>이 1씩 증가하고, <b>3회</b>가 되면 C1 b접점이 열려 R1 해제 → 후진 후 정지.', '<b>PB2</b>로 카운터를 리셋한 뒤 다시 기동할 수 있다.']);
    return b.doc;
  } });

ex({ id: 'ep7', group: '전기-공압', title: '2실린더 시퀀스 A+ B+ A- B-', summary: '양솔 밸브 2개와 리밋 스위치 4개로 순차 작동', tags: ['시퀀스', '2실린더', '설비보전'],
  build() {
    const b = builder('2실린더 시퀀스 (A+ B+ A- B-)', 'pn');
    const a = cylValve(b, 60, 40, 'p_cyl_double', { tag: 'A', sw0: 'LS1', sw1: 'LS2' }, 'pv52_dsol', { tag: '1V1', sol14: 'Y1', sol12: 'Y2' });
    const c = cylValve(b, 380, 40, 'p_cyl_double', { tag: 'B', sw0: 'LS3', sw1: 'LS4' }, 'pv52_dsol', { tag: '2V1', sol14: 'Y3', sol12: 'Y4' });
    pnSupply(b, -20, 290, [[a.v, '1'], [c.v, '1']]);
    ladder(b, 760, 40, [
      [E('e_pb_no', 'PB1'), E('e_ls_no', 'LS3'), E('e_sol', 'Y1')],
      [E('e_ls_no', 'LS2'), E('e_sol', 'Y3')],
      [E('e_ls_no', 'LS4'), E('e_sol', 'Y2')],
      [E('e_ls_no', 'LS1'), E('e_sol', 'Y4')],
    ]);
    b.task('A+ B+ A- B- 시퀀스', ['<b>PB1</b> (B 후진끝 LS3 조건) → <b>Y1</b>: 실린더 A 전진 (A+)', 'A 전진끝 <b>LS2</b> → <b>Y3</b>: 실린더 B 전진 (B+)', 'B 전진끝 <b>LS4</b> → <b>Y2</b>: 실린더 A 후진 (A-)', 'A 후진끝 <b>LS1</b> → <b>Y4</b>: 실린더 B 후진 (B-) → 1사이클 종료'], '선도(G)를 열어 변위-단계 선도를 확인하세요.');
    return b.doc;
  } });

ex({ id: 'ep8', group: '전기-공압', title: '압력 스위치 회로', summary: '전진 끝 압력이 5.5bar에 도달하면 자동 후진', tags: ['압력 스위치', '자기유지'],
  build() {
    const b = builder('압력 스위치에 의한 자동 복귀', 'pn');
    const cyl = b.add('p_cyl_double', 60, 40, { tag: '1A' });
    const v = b.add('pv52_sol', 100, 160, { tag: '1V1', sol14: 'Y1' });
    const j = b.add('p_junction', 80, 110);
    const ps = b.add('p_pswitch', 0, 80, { tag: 'PS1', p: 5.5 });
    b.w(v, '4', j, 'J');
    b.w(j, 'J', cyl, 'A');
    b.w(j, 'J', ps, '1');
    b.w(v, '2', cyl, 'B');
    pnSupply(b, 40, 290, [[v, '1']]);
    ladder(b, 440, 40, [
      [PAR([E('e_pb_no', 'PB1')], [E('e_relay_no', 'R1')]), E('e_ps_nc', 'PS1'), E('e_relay', 'R1')],
      [E('e_relay_no', 'R1'), E('e_sol', 'Y1')],
    ]);
    b.task('압력 스위치 회로', ['<b>PB1</b> → R1 자기유지 → Y1 → 실린더 전진.', '전진 끝에서 피스톤측 압력이 상승하여 압력 스위치 <b>PS1</b>(5.5 bar)이 작동하면 R1 해제 → 후진.'], '전진 중에는 압력이 낮고, 끝에 닿아야 압력이 공급압까지 오르는 원리를 관찰하세요.');
    return b.doc;
  } });

/* =================== 유압 기초 =================== */
ex({ id: 'h1', group: '유압 기초', title: '유압 기본 회로 (4/3 탠덤 센터)', summary: '파워유닛 + 4/3 수동 밸브 + 복동 실린더', tags: ['4/3 밸브', '탠덤 센터', '릴리프'],
  build() {
    const b = builder('유압 기본 회로', 'hy');
    const { v } = cylValve(b, 60, 40, 'h_cyl_double', { tag: 'A1' }, 'hv43_lever_tandem', { tag: 'V1' });
    hyUnit(b, v);
    b.task('유압 기본 회로', ['4/3 레버 밸브 <b>V1</b>의 왼쪽 레버를 누르고 있으면 P→A: 실린더 전진, 오른쪽은 P→B: 후진.', '레버를 놓으면 탠덤 센터(P→T 무부하)로 실린더가 정지·유지되고 펌프 압력이 낮아진다.', '실린더가 끝에 닿으면 압력이 릴리프 설정압(50 bar)까지 상승하고 여분 유량은 탱크로 귀환한다.'], '파워유닛을 클릭하면 펌프 ON/OFF.');
    return b.doc;
  } });

function hyFlow(id, title, mode) {
  ex({ id, group: '유압 기초', title, summary: { in: '공급측 유량을 교축 — 전진 속도 제어', out: '배출측 유량을 교축 — 부하 변동에 강함', bleed: '공급 유량 일부를 탱크로 바이패스 — 효율 좋음' }[mode], tags: ['속도제어', { in: '미터인', out: '미터아웃', bleed: '블리드오프' }[mode]],
    build() {
      const b = builder(title, 'hy');
      const cyl = b.add('h_cyl_double', 60, 40, { tag: 'A1', load: mode === 'bleed' ? 1000 : 0 });
      const v = b.add('hv43_lever_tandem', 100, 250, { tag: 'V1' });
      if (mode === 'in') {
        const f = b.add('h_flow_oneway', 80, 140, { tag: 'V2', open: 25 }, 90);
        b.w(cyl, 'A', f, '1');
        b.w(f, '2', v, 'A');
        b.w(v, 'B', cyl, 'B');
      } else if (mode === 'out') {
        const f = b.add('h_flow_oneway', 160, 140, { tag: 'V2', open: 15 }, 270);
        b.w(cyl, 'B', f, '2');
        b.w(f, '1', v, 'B');
        b.w(v, 'A', cyl, 'A');
      } else {
        const j = b.add('h_junction', 80, 160);
        const th = b.add('h_throttle', 20, 210, { tag: 'V2', open: 50 }, 90);
        const tk = b.add('h_tank', 20, 290);
        b.w(v, 'A', j, 'J');
        b.w(j, 'J', cyl, 'A');
        b.w(j, 'J', th, '1');
        b.w(th, '2', tk, 'T');
        b.w(v, 'B', cyl, 'B');
      }
      hyUnit(b, v);
      const steps = {
        in: ['왼쪽 레버를 누르면 일방향 유량제어 밸브 <b>V2</b>(25%)를 통해 교축된 유량으로 실린더가 <b>천천히 전진</b>한다.', '남는 펌프 유량은 릴리프 밸브를 통해 탱크로 흐르므로 펌프 압력이 릴리프 압력까지 오른다.', '후진 시에는 체크 밸브로 자유 흐름 → 빠르게 후진.'],
        out: ['왼쪽 레버를 누르면 실린더 로드측(B)에서 나오는 기름이 <b>V2</b>에서 교축되어 천천히 전진한다.', '배압이 걸리므로 부하가 갑자기 줄어도 튀어나가지 않는다.', '후진 시에는 체크 밸브로 자유 흐름.'],
        bleed: ['왼쪽 레버를 누르면 펌프 유량 일부가 교축 밸브 <b>V2</b>를 통해 탱크로 바이패스되어 전진 속도가 줄어든다.', '펌프 압력이 부하 압력 정도로만 오르므로 동력 손실이 적다.', '부하(속성)를 키우면 바이패스량이 늘어 속도가 크게 변하는 것을 확인한다.'],
      }[mode];
      b.task(title, steps, '실시간 조정으로 개도를 바꾸어 속도 변화를 비교하세요.');
      return b.doc;
    } });
}
hyFlow('h2', '미터인 회로', 'in');
hyFlow('h3', '미터아웃 회로', 'out');
hyFlow('h4', '블리드오프 회로', 'bleed');

function twoCylHy(id, title, kind) {
  ex({ id, group: '유압 기초', title, summary: kind === 'reduce' ? '감압 밸브로 클램프 실린더 압력을 20bar로 제한' : '시퀀스 밸브로 클램프 후 가공 실린더 순차 작동', tags: kind === 'reduce' ? ['감압 밸브', '압력계'] : ['시퀀스 밸브', '순차 작동'],
    build() {
      const b = builder(title, 'hy');
      const c1 = b.add('h_cyl_double', 60, 40, { tag: 'A1' });
      const c2 = b.add('h_cyl_double', 380, 40, { tag: 'A2', load: kind === 'reduce' ? 0 : 2000 });
      const v = b.add('hv42_lever', 240, 300, { tag: 'V1' });
      const j2 = b.add('h_junction', 250, 250);
      const j3 = b.add('h_junction', 270, 270);
      b.w(v, 'A', j2, 'J');
      b.w(v, 'B', j3, 'J');
      if (kind === 'reduce') {
        const rd = b.add('h_reducing', 80, 180, { tag: 'V2', p: 20 });
        const j = b.add('h_junction', 80, 120);
        const g = b.add('h_gauge', 30, 100);
        b.w(j2, 'J', rd, 'P');
        b.w(rd, 'A', j, 'J');
        b.w(j, 'J', c1, 'A');
        b.w(j, 'J', g, '1');
        b.w(j2, 'J', c2, 'A');
      } else {
        const sq = b.add('h_sequence', 400, 180, { tag: 'V2', p: 30 });
        b.w(j2, 'J', c1, 'A');
        b.w(j2, 'J', sq, 'P');
        b.w(sq, 'A', c2, 'A');
      }
      b.w(j3, 'J', c1, 'B');
      b.w(j3, 'J', c2, 'B');
      hyUnit(b, v, { p: 60 });
      if (kind === 'reduce') b.task(title, ['레버 밸브 <b>V1</b>을 클릭(전진 위치)하면 두 실린더가 전진한다.', '클램프 실린더 <b>A1</b>은 감압 밸브 <b>V2</b>(20 bar)를 거치므로 끝에서도 압력계가 약 20 bar를 넘지 않는다.', '실린더 <b>A2</b>와 펌프 압력은 릴리프 설정압(60 bar)까지 오른다.']);
      else b.task(title, ['레버 밸브 <b>V1</b>을 클릭하면 먼저 클램프 실린더 <b>A1</b>이 전진한다.', 'A1이 끝에 닿아 압력이 시퀀스 밸브 <b>V2</b> 설정압(30 bar)에 도달하면 <b>A2</b>가 전진한다.', '다시 클릭하면 두 실린더가 후진한다 (V2 내장 체크밸브로 역류).'], '부하(2000 N)가 있는 A2는 전진 중에도 압력이 필요합니다.');
      return b.doc;
    } });
}
twoCylHy('h5', '감압 밸브 회로', 'reduce');
twoCylHy('h6', '시퀀스 밸브 회로', 'seq');

ex({ id: 'h7', group: '유압 기초', title: '로킹 회로 (파일럿 체크 밸브)', summary: '중립에서 부하에 의한 하강을 파일럿 체크로 방지', tags: ['파일럿 체크', '로킹', '플로트 센터'],
  build() {
    const b = builder('파일럿 체크 밸브 로킹 회로', 'hy');
    const cyl = b.add('h_cyl_double', 60, 40, { tag: 'A1', load: 1500 });
    const po = b.add('h_pocheck', 80, 140, { tag: 'V2' }, 270);
    const v = b.add('hv43_lever_float', 100, 250, { tag: 'V1' });
    const j = b.add('h_junction', 130, 200);
    b.w(cyl, 'A', po, '2');
    b.w(po, '1', v, 'A');
    b.w(v, 'B', j, 'J');
    b.w(j, 'J', cyl, 'B');
    b.w(j, 'J', po, 'X');
    hyUnit(b, v);
    b.task('로킹 회로', ['실린더에는 후진 방향으로 1500 N의 부하가 걸려 있다.', '왼쪽 레버로 전진시키다가 놓으면 중립(ABT 접속)이 되지만, 파일럿 체크 밸브 <b>V2</b>가 피스톤측 기름을 막아 <b>위치가 유지</b>된다.', '오른쪽 레버로 후진하면 B 라인 압력이 V2의 파일럿(X)을 열어 실린더가 후진한다.'], 'V2를 일반 체크 밸브나 직결로 바꾸면 중립에서 부하로 후진하는 것을 비교해 보세요.');
    return b.doc;
  } });

ex({ id: 'h8', group: '유압 기초', title: '유압 모터 속도 제어', summary: '4/3 밸브로 정·역회전, 미터인으로 회전수 제어', tags: ['유압 모터', '미터인'],
  build() {
    const b = builder('유압 모터 정역회전 및 속도 제어', 'hy');
    const m = b.add('h_motor', 120, 60, { tag: 'M1' });
    const f = b.add('h_flow_oneway', 40, 110, { tag: 'V2', open: 20 }, 90);
    const v = b.add('hv43_lever_tandem', 100, 250, { tag: 'V1' });
    b.w(v, 'A', f, '2', [[110, 200], [40, 200]]);
    b.w(f, '1', m, 'A', [[40, 10], [120, 10]]);
    b.w(v, 'B', m, 'B');
    hyUnit(b, v);
    b.task('유압 모터 회로', ['왼쪽 레버: P→A, 모터 정회전 (유량제어 밸브 V2로 회전수 제어).', '오른쪽 레버: P→B, 모터 역회전 (V2는 체크밸브로 자유흐름 → 빠름).', '레버를 놓으면 탠덤 센터로 정지하고 펌프는 무부하.']);
    return b.doc;
  } });

/* =================== 전기-유압 =================== */
function ehBase(b, vType, vProps, cylProps) {
  const r = cylValve(b, 60, 40, 'h_cyl_double', { tag: 'A1', ...cylProps }, vType, { tag: 'V1', ...vProps });
  hyUnit(b, r.v);
  return r;
}
ex({ id: 'eh1', group: '전기-유압', title: '연속 왕복 회로 (4/3 양솔)', summary: '릴레이 자기유지로 4/3 스프링 센터 밸브 연속 왕복', tags: ['4/3 양솔', '연속 왕복', '릴레이'],
  build() {
    const b = builder('전기-유압 연속 왕복 (4/3 양솔)', 'hy');
    ehBase(b, 'hv43_sol_tandem', { sol14: 'Y1', sol12: 'Y2' }, { sw0: 'LS1', sw1: 'LS2' });
    ladder(b, 440, 40, [
      [PAR([E('e_pb_no', 'PB1')], [E('e_relay_no', 'R1')]), E('e_pb_nc', 'PB2'), E('e_relay', 'R1')],
      [PAR([E('e_relay_no', 'R1'), E('e_ls_no', 'LS1')], [E('e_relay_no', 'R2')]), E('e_ls_nc', 'LS2'), E('e_relay', 'R2')],
      [E('e_relay_no', 'R2'), E('e_sol', 'Y1')],
      [PAR([E('e_ls_no', 'LS2')], [E('e_relay_no', 'R3')]), E('e_ls_nc', 'LS1'), E('e_relay', 'R3')],
      [E('e_relay_no', 'R3'), E('e_sol', 'Y2')],
    ]);
    b.task('4/3 양솔 연속 왕복', ['<b>PB1</b> → R1(운전) 자기유지.', '후진끝 <b>LS1</b> → R2 자기유지 → <b>Y1</b>: 전진. 전진끝 <b>LS2</b>에서 R2 해제.', '<b>LS2</b> → R3 자기유지 → <b>Y2</b>: 후진. 후진끝 LS1에서 R3 해제 → 다시 전진 (반복).', '<b>PB2</b> → R1 해제: 현재 사이클을 마치고 후진 끝에서 정지.'], '4/3 스프링 센터 밸브는 솔레노이드가 계속 여자되어야 하므로 릴레이로 신호를 유지합니다.');
    return b.doc;
  } });

ex({ id: 'eh2', group: '전기-유압', title: '타이머 회로 (가압 유지)', summary: '전진 끝에서 2초 가압 후 자동 후진', tags: ['4/2 편솔', '타이머'],
  build() {
    const b = builder('전기-유압 타이머 회로', 'hy');
    ehBase(b, 'hv42_sol', { sol14: 'Y1' }, { sw0: 'LS1', sw1: 'LS2' });
    ladder(b, 440, 40, [
      [PAR([E('e_pb_no', 'PB1')], [E('e_relay_no', 'R1')]), E('e_timer_nc', 'T1'), E('e_relay', 'R1')],
      [E('e_relay_no', 'R1'), E('e_sol', 'Y1')],
      [E('e_ls_no', 'LS2'), E('e_ton', 'T1', { delay: 2 })],
      [E('e_relay_no', 'R1'), E('e_lamp', 'H1', { color: 'green' })],
    ]);
    b.task('가압 유지 회로', ['<b>PB1</b> → R1 자기유지 → <b>Y1</b>: 실린더 전진, 운전 표시등 <b>H1</b> 점등.', '전진끝 <b>LS2</b> → 타이머 <b>T1</b>(2초) 동안 가압 유지 (압력 = 릴리프 설정압).', 'T1 b접점이 열리면 R1 해제 → 후진, H1 소등.']);
    return b.doc;
  } });

ex({ id: 'eh3', group: '전기-유압', title: '압력 스위치 회로 (프레스)', summary: '설정 압력 40bar 도달 시 자동 후진', tags: ['압력 스위치', '프레스'],
  build() {
    const b = builder('전기-유압 프레스 회로 (압력 스위치)', 'hy');
    const cyl = b.add('h_cyl_double', 60, 40, { tag: 'A1' });
    const v = b.add('hv42_sol', 100, 160, { tag: 'V1', sol14: 'Y1' });
    const j = b.add('h_junction', 80, 110);
    const ps = b.add('h_pswitch', 0, 80, { tag: 'PS1', p: 40 });
    b.w(v, 'A', j, 'J');
    b.w(j, 'J', cyl, 'A');
    b.w(j, 'J', ps, '1');
    b.w(v, 'B', cyl, 'B');
    hyUnit(b, v);
    ladder(b, 440, 40, [
      [PAR([E('e_pb_no', 'PB1')], [E('e_relay_no', 'R1')]), E('e_ps_nc', 'PS1'), E('e_relay', 'R1')],
      [E('e_relay_no', 'R1'), E('e_sol', 'Y1')],
    ]);
    b.task('압력 스위치 프레스 회로', ['<b>PB1</b> → R1 자기유지 → <b>Y1</b>: 프레스 실린더 하강(전진).', '공작물에 닿아(전진 끝) 압력이 <b>40 bar</b>에 도달하면 압력 스위치 <b>PS1</b>이 R1을 해제 → 자동 상승(후진).'], '릴리프 압력(50 bar)과 압력 스위치 설정(40 bar)의 관계를 생각해 보세요.');
    return b.doc;
  } });
