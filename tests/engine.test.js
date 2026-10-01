// 엔진 단위 테스트: 기본 공압/유압/전기 회로 동작 확인
import { Sim } from '../js/sim.js';
import { newComp } from '../js/components.js';

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
const W = (a, ap, b, bp) => ({ id: 'w' + Math.random().toString(36).slice(2, 7), a: { c: a, p: ap }, b: { c: b, p: bp }, pts: [] });
const mk = (type, id, props = {}) => { const c = newComp(type, 0, 0, id); Object.assign(c.props, props); return c; };

console.log('[1] 공압 5/2 누름버튼 + 복동 실린더');
{
  const doc = { components: [mk('p_source', 'S'), mk('pv52_push', 'V'), mk('p_cyl_double', 'C')], wires: [W('S', '1', 'V', '1'), W('V', '4', 'C', 'A'), W('V', '2', 'C', 'B')] };
  const sim = new Sim(doc);
  sim.run(1);
  const st = sim.st.get('C');
  ok(st.x < 1, `초기 후진 상태 x=${st.x.toFixed(1)}`);
  sim.press('V', -50, 0);
  let t = 0; while (sim.st.get('C').x < 99.9 && t < 5) { sim.run(0.05); t += 0.05; }
  ok(st.x > 99, `누르면 전진 완료 x=${st.x.toFixed(1)} (${t.toFixed(2)}s)`);
  sim.run(0.5);
  ok(Math.abs(sim.pAt(doc.components[2], 'A') - 6) < 0.3, `전진끝 A실 압력 ≈ 6bar: ${sim.pAt(doc.components[2], 'A').toFixed(2)}`);
  sim.release('V');
  t = 0; while (sim.st.get('C').x > 0.1 && t < 5) { sim.run(0.05); t += 0.05; }
  ok(st.x < 0.5, `놓으면 후진 완료 (${t.toFixed(2)}s)`);
}

console.log('[2] 공압 미터아웃 속도제어');
{
  const doc = { components: [mk('p_source', 'S'), mk('pv52_push', 'V'), mk('p_cyl_double', 'C'), mk('p_flow_oneway', 'F', { open: 20 })],
    wires: [W('S', '1', 'V', '1'), W('V', '4', 'C', 'A'), W('V', '2', 'F', '1'), W('F', '2', 'C', 'B')] };
  const sim = new Sim(doc);
  sim.run(0.5);
  sim.press('V', -50, 0);
  let t = 0; while (sim.st.get('C').x < 99.9 && t < 30) { sim.run(0.05); t += 0.05; }
  ok(t > 1.5, `미터아웃 20%: 전진 시간 ${t.toFixed(2)}s (느려야 함)`);
}

console.log('[3] 유압 파워유닛 + 4/3 탠덤 + 복동 실린더 + 릴리프');
{
  const doc = { components: [mk('h_powerunit', 'PU'), mk('hv43_sol_tandem', 'V', { sol14: 'Y1', sol12: 'Y2' }), mk('h_cyl_double', 'C'),
    mk('e_24v', 'E1'), mk('e_sw_no', 'SW', { tag: 'SW1' }), mk('e_sol', 'Y', { tag: 'Y1' }), mk('e_0v', 'E0')],
    wires: [W('PU', 'P', 'V', 'P'), W('PU', 'T', 'V', 'T'), W('V', 'A', 'C', 'A'), W('V', 'B', 'C', 'B'),
      W('E1', '1', 'SW', '1'), W('SW', '2', 'Y', '1'), W('Y', '2', 'E0', '1')] };
  const sim = new Sim(doc);
  sim.run(0.5);
  ok(sim.pAt(doc.components[0], 'P') < 5, `탠덤 중립: 펌프 무부하 P=${sim.pAt(doc.components[0], 'P').toFixed(1)}bar`);
  sim.press('SW');
  let t = 0; while (sim.st.get('C').x < 199.9 && t < 10) { sim.run(0.05); t += 0.05; }
  ok(sim.st.get('C').x > 199, `Y1 여자 → 전진 완료 ${t.toFixed(2)}s (이론 ${(200 / ((8000 / 60) / (Math.PI * 16 / 4) * 10)).toFixed(2)}s)`);
  sim.run(0.5);
  ok(Math.abs(sim.pAt(doc.components[0], 'P') - 50) < 6, `전진끝: 릴리프 압력 ≈ 50bar: ${sim.pAt(doc.components[0], 'P').toFixed(1)}`);
}

console.log('[4] 전기 자기유지 회로 (PB1 a, PB2 b, R1)');
{
  const doc = { components: [mk('e_24v', 'P'), mk('e_pb_no', 'PB1', { tag: 'PB1' }), mk('e_relay_no', 'R1a', { tag: 'R1' }), mk('e_pb_nc', 'PB2', { tag: 'PB2' }),
    mk('e_relay', 'K', { tag: 'R1' }), mk('e_0v', 'Z'), mk('e_junction', 'J1'), mk('e_junction', 'J2')],
    wires: [W('P', '1', 'J1', 'J'), W('J1', 'J', 'PB1', '1'), W('J1', 'J', 'R1a', '1'), W('PB1', '2', 'J2', 'J'), W('R1a', '2', 'J2', 'J'), W('J2', 'J', 'PB2', '1'), W('PB2', '2', 'K', '1'), W('K', '2', 'Z', '1')] };
  const sim = new Sim(doc);
  sim.run(0.1);
  ok(!sim.relay.get('R1'), '초기 R1 OFF');
  sim.press('PB1'); sim.run(0.1); sim.release('PB1'); sim.run(0.1);
  ok(!!sim.relay.get('R1'), 'PB1 누른 후 놓아도 R1 자기유지');
  sim.press('PB2'); sim.run(0.1); sim.release('PB2'); sim.run(0.1);
  ok(!sim.relay.get('R1'), 'PB2(정지) → R1 해제');
}

console.log('[5] 타이머/카운터');
{
  const doc = { components: [mk('e_24v', 'P'), mk('e_sw_no', 'S', { tag: 'SW1' }), mk('e_ton', 'T', { tag: 'T1', delay: 2 }), mk('e_0v', 'Z'),
    mk('e_24v', 'P2'), mk('e_timer_no', 'Ta', { tag: 'T1' }), mk('e_lamp', 'H', { tag: 'H1' }), mk('e_0v', 'Z2')],
    wires: [W('P', '1', 'S', '1'), W('S', '2', 'T', '1'), W('T', '2', 'Z', '1'), W('P2', '1', 'Ta', '1'), W('Ta', '2', 'H', '1'), W('H', '2', 'Z2', '1')] };
  const sim = new Sim(doc);
  sim.press('S');
  sim.run(1.5);
  ok(!sim.st.get('H').on, '1.5s: 램프 OFF');
  sim.run(0.6);
  ok(!!sim.st.get('H').on, '2.1s: 램프 ON (ON딜레이 2s)');
}

console.log('[6] 유압 미터인 교축 + 시퀀스 밸브');
{
  const doc = { components: [mk('h_powerunit', 'PU', { p: 60 }), mk('hv42_lever', 'V'), mk('h_cyl_double', 'C1'), mk('h_sequence', 'SQ', { p: 30 }), mk('h_cyl_double', 'C2')],
    wires: [W('PU', 'P', 'V', 'P'), W('PU', 'T', 'V', 'T'), W('V', 'A', 'C1', 'A'), W('V', 'A', 'SQ', 'P'), W('SQ', 'A', 'C2', 'A'), W('V', 'B', 'C1', 'B'), W('V', 'B', 'C2', 'B')] };
  const sim = new Sim(doc);
  sim.run(0.3);
  sim.press('V', -40, 0); // 레버 → 왼쪽 위치 (P→A)
  sim.run(0.5);
  const x1 = sim.st.get('C1').x, x2 = sim.st.get('C2').x;
  ok(x1 > 20 && x2 < 1, `시퀀스: 실린더1 먼저 이동 (x1=${x1.toFixed(0)}, x2=${x2.toFixed(0)})`);
  sim.run(4);
  ok(sim.st.get('C1').x > 199 && sim.st.get('C2').x > 199, `실린더1 완료 후 실린더2 이동 (x2=${sim.st.get('C2').x.toFixed(0)})`);
}

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
