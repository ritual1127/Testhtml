// 모든 예제 회로의 동작을 스크립트로 검증
import { Sim } from '../js/sim.js';
import { EXAMPLES } from '../js/examples.js';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('   FAIL', m); } else console.log('   ok  ', m); };

function mk(id) {
  const ex = EXAMPLES.find((e) => e.id === id);
  const doc = ex.build();
  const sim = new Sim(doc);
  const byTag = (tag, pred = () => true) => doc.components.find((c) => c.props.tag === tag && pred(c));
  const cyl = (tag) => sim.st.get(byTag(tag, (c) => c.type.includes('_cyl_')).id);
  const press = (tag, lx = -1000) => { const c = byTag(tag, (c) => c.type !== 'e_relay'); sim.press(c.id, lx, 0); return c; };
  const release = (tag) => { const c = byTag(tag); sim.release(c.id); };
  const tap = (tag, t = 0.2) => { press(tag); sim.run(t); release(tag); };
  // 조건이 될 때까지 실행, 경과 시간 반환
  const until = (fn, max = 20) => { let t = 0; while (!fn() && t < max) { sim.run(0.02); t += 0.02; } return fn() ? t : Infinity; };
  return { ex, doc, sim, byTag, cyl, press, release, tap, until };
}
const at0 = (s) => s.x < 0.5, atL = (s, L) => s.x > L - 0.5;

function countCycles(T, tag, L, seconds) {
  let n = 0, front = false;
  for (let t = 0; t < seconds; t += 0.02) {
    T.sim.run(0.02);
    const x = T.cyl(tag).x;
    if (!front && x > L - 0.5) { front = true; n++; }
    if (front && x < 0.5) front = false;
  }
  return n;
}

const tests = {
  p1() { const T = mk('p1'); T.sim.run(0.3); T.press('1V1'); const t = T.until(() => atL(T.cyl('1A'), 100)); ok(t < 3, `누르면 전진 (${t.toFixed(2)}s)`); T.release('1V1'); ok(T.until(() => at0(T.cyl('1A'))) < 4, '놓으면 스프링 후진'); },
  p2() { const T = mk('p2'); T.sim.run(0.3); T.press('1V1'); ok(T.until(() => atL(T.cyl('1A'), 100)) < 3, '전진'); T.release('1V1'); ok(T.until(() => at0(T.cyl('1A'))) < 3, '후진'); },
  p3() { const T = mk('p3'); T.sim.run(0.3); T.press('1V1'); T.release('1V1'); const te = T.until(() => atL(T.cyl('1A'), 100)); T.press('1V1'); T.release('1V1'); const tr = T.until(() => at0(T.cyl('1A'))); ok(te > 1.2 && te < 15, `전진(25%) ${te.toFixed(2)}s`); ok(tr < te, `후진(60%) ${tr.toFixed(2)}s 가 더 빠름`); },
  p4() { const T = mk('p4'); T.sim.run(0.3); T.press('1S1'); T.sim.run(1.5); ok(at0(T.cyl('1A')), '1S1만 누르면 정지 유지 (AND)'); T.press('1S2'); ok(T.until(() => atL(T.cyl('1A'), 100)) < 3, '두 버튼 → 전진'); T.release('1S1'); ok(T.until(() => at0(T.cyl('1A'))) < 3, '하나 놓으면 후진'); },
  p5() { const T = mk('p5'); T.sim.run(0.3); T.press('1S2'); ok(T.until(() => atL(T.cyl('1A'), 100)) < 3, '1S2만으로 전진 (OR)'); T.release('1S2'); ok(T.until(() => at0(T.cyl('1A'))) < 3, '후진'); T.press('1S1'); ok(T.until(() => atL(T.cyl('1A'), 100)) < 3, '1S1만으로 전진'); },
  p6() { const T = mk('p6'); T.sim.run(0.3); T.press('1S0'); T.release('1S0'); const n = countCycles(T, '1A', 100, 8); ok(n >= 3, `셀렉터 ON → 연속 왕복 ${n}회/8s`); T.press('1S0'); T.release('1S0'); T.sim.run(4); ok(at0(T.cyl('1A')), 'OFF → 후진 위치 정지'); T.sim.run(2); ok(at0(T.cyl('1A')), '재기동 없음'); },
  p7() { const T = mk('p7'); T.sim.run(0.3); T.tap('1S0', 0.3); const te = T.until(() => atL(T.cyl('1A'), 100)); ok(te < 3, '전진'); const dwell = T.until(() => T.cyl('1A').x < 99); ok(dwell > 2.6 && dwell < 3.6, `전진끝 대기 ${dwell.toFixed(2)}s (설정 3s)`); ok(T.until(() => at0(T.cyl('1A'))) < 3, '후진'); T.sim.run(2); ok(at0(T.cyl('1A')), '1사이클 후 정지'); },
  ep1() { const T = mk('ep1'); T.sim.run(0.2); T.press('PB1'); ok(T.until(() => atL(T.cyl('1A'), 100)) < 3, 'PB1 → 전진'); T.release('PB1'); ok(T.until(() => at0(T.cyl('1A'))) < 3, '놓으면 후진'); },
  ep2() { const T = mk('ep2'); T.sim.run(0.2); T.tap('PB1'); ok(T.until(() => atL(T.cyl('1A'), 100)) < 3, 'PB1 탭 → 전진'); T.sim.run(1); ok(atL(T.cyl('1A'), 100), '자기유지로 전진 유지'); T.tap('PB2'); ok(T.until(() => at0(T.cyl('1A'))) < 3, 'PB2 → 후진'); },
  ep3() { const T = mk('ep3'); T.sim.run(0.2); T.tap('PB1'); ok(T.until(() => T.cyl('1A').x > 99) < 3, '전진'); ok(T.until(() => at0(T.cyl('1A'))) < 3, 'LS2 → 자동 후진'); T.sim.run(2); ok(at0(T.cyl('1A')), '정지 유지'); },
  ep4() { const T = mk('ep4'); T.sim.run(0.2); T.tap('PB1'); const n = countCycles(T, '1A', 100, 8); ok(n >= 3, `연속 왕복 ${n}회/8s`); T.tap('PB2'); T.sim.run(4); ok(at0(T.cyl('1A')), 'PB2 → 후진 위치 정지'); },
  ep5() { const T = mk('ep5'); T.sim.run(0.2); T.tap('PB1'); ok(T.until(() => atL(T.cyl('1A'), 100)) < 3, '전진'); const d = T.until(() => T.cyl('1A').x < 99); ok(d > 2.6 && d < 3.5, `T1 대기 ${d.toFixed(2)}s`); ok(T.until(() => at0(T.cyl('1A'))) < 3, '후진'); },
  ep6() { const T = mk('ep6'); T.sim.run(0.2); T.tap('PB1'); const n = countCycles(T, '1A', 100, 14); ok(n === 3, `정확히 3회 왕복 (${n})`); ok(at0(T.cyl('1A')), '정지'); ok(T.sim.counters.get('C1').count === 3, 'C1=3'); T.tap('PB2'); T.sim.run(0.1); ok(T.sim.counters.get('C1').count === 0, 'PB2 리셋'); },
  ep7() {
    const T = mk('ep7'); T.sim.run(0.2); T.tap('PB1', 0.3);
    const ev = []; let pa = 0, pb = 0;
    for (let t = 0; t < 10; t += 0.02) {
      T.sim.run(0.02);
      const a = T.cyl('A').x, b = T.cyl('B').x;
      const sa = a > 99.5 ? 1 : a < 0.5 ? 0 : pa, sb = b > 99.5 ? 1 : b < 0.5 ? 0 : pb;
      if (sa !== pa) ev.push('A' + (sa ? '+' : '-'));
      if (sb !== pb) ev.push('B' + (sb ? '+' : '-'));
      pa = sa; pb = sb;
    }
    ok(ev.join(' ') === 'A+ B+ A- B-', `순서: ${ev.join(' ')}`);
  },
  ep8() { const T = mk('ep8'); T.sim.run(0.2); T.tap('PB1'); ok(T.until(() => T.cyl('1A').x > 99) < 3, '전진'); ok(T.until(() => at0(T.cyl('1A'))) < 4, 'PS1 → 자동 후진'); },
  h1() { const T = mk('h1'); T.sim.run(0.3); const pu = T.byTag('PU'); ok(T.sim.pAt(pu, 'P') < 5, `중립 무부하 ${T.sim.pAt(pu, 'P').toFixed(1)}bar`); T.press('V1', -1000); T.sim.run(1); const x1 = T.cyl('A1').x; ok(x1 > 60 && x1 < 140, `1초 전진 ${x1.toFixed(0)}mm`); T.release('V1'); T.sim.run(1); ok(Math.abs(T.cyl('A1').x - x1) < 2, '중립: 위치 유지'); T.press('V1', -1000); T.until(() => atL(T.cyl('A1'), 200)); T.sim.run(0.5); ok(Math.abs(T.sim.pAt(pu, 'P') - 50) < 6, `끝: 릴리프 ${T.sim.pAt(pu, 'P').toFixed(1)}bar`); T.release('V1'); T.press('V1', 1000); ok(T.until(() => at0(T.cyl('A1'))) < 4, '후진'); },
  h2() { const T = mk('h2'); T.sim.run(0.3); T.press('V1', -1000); const t = T.until(() => atL(T.cyl('A1'), 200)); ok(t > 3 && t < 12, `미터인 전진 ${t.toFixed(2)}s (기본 1.9s)`); T.release('V1'); T.press('V1', 1000); const r = T.until(() => at0(T.cyl('A1'))); ok(r < 2.5, `후진 자유흐름 ${r.toFixed(2)}s`); },
  h3() { const T = mk('h3'); T.sim.run(0.3); T.press('V1', -1000); const t = T.until(() => atL(T.cyl('A1'), 200)); ok(t > 3 && t < 12, `미터아웃 전진 ${t.toFixed(2)}s`); T.release('V1'); T.press('V1', 1000); ok(T.until(() => at0(T.cyl('A1'))) < 2.5, '후진'); },
  h4() { const T = mk('h4'); T.sim.run(0.3); T.press('V1', -1000); const t = T.until(() => atL(T.cyl('A1'), 200)); ok(t > 2.4 && t < 12, `블리드오프 전진 ${t.toFixed(2)}s`); },
  h5() { const T = mk('h5'); T.sim.run(0.3); T.press('V1'); T.release('V1'); T.sim.run(5); const g = T.doc.components.find((c) => c.type === 'h_gauge'); const pg = T.sim.pAt(g, '1'), pp = T.sim.pAt(T.byTag('PU'), 'P'); ok(atL(T.cyl('A1'), 200) && atL(T.cyl('A2'), 200), '두 실린더 전진'); ok(Math.abs(pg - 20) < 3, `클램프 압력 ${pg.toFixed(1)}bar ≈ 20`); ok(Math.abs(pp - 60) < 6, `펌프 압력 ${pp.toFixed(1)}bar ≈ 60`); },
  h6() { const T = mk('h6'); T.sim.run(0.3); T.press('V1'); T.release('V1'); T.sim.run(1); ok(T.cyl('A1').x > 50 && T.cyl('A2').x < 1, `A1 먼저 (${T.cyl('A1').x.toFixed(0)}, ${T.cyl('A2').x.toFixed(0)})`); T.sim.run(5); ok(atL(T.cyl('A2'), 200), 'A1 완료 후 A2 전진'); T.press('V1'); T.release('V1'); T.sim.run(5); ok(at0(T.cyl('A1')) && at0(T.cyl('A2')), '모두 후진'); },
  h7() { const T = mk('h7'); T.sim.run(0.3); T.press('V1', -1000); T.sim.run(1.2); T.release('V1'); const x = T.cyl('A1').x; T.sim.run(2); ok(x > 40 && Math.abs(T.cyl('A1').x - x) < 2, `중립에서 위치 유지 (${x.toFixed(0)} → ${T.cyl('A1').x.toFixed(0)}mm)`); T.press('V1', 1000); ok(T.until(() => at0(T.cyl('A1')), 8) < 8, '파일럿으로 열려 후진'); },
  h8() { const T = mk('h8'); T.sim.run(0.3); const m = T.sim.st.get(T.byTag('M1').id); T.press('V1', -1000); T.sim.run(1); ok(m.w > 1, `정회전 ${(m.w * 60).toFixed(0)}rpm`); const w1 = m.w; T.release('V1'); T.press('V1', 1000); T.sim.run(1); ok(m.w < -1, `역회전 ${(m.w * 60).toFixed(0)}rpm`); ok(Math.abs(m.w) > w1, '역회전(자유흐름)이 더 빠름'); },
  eh1() { const T = mk('eh1'); T.sim.run(0.3); T.tap('PB1'); const n = countCycles(T, 'A1', 200, 12); ok(n >= 2, `연속 왕복 ${n}회/12s`); T.tap('PB2'); T.sim.run(6); ok(at0(T.cyl('A1')), '정지'); },
  eh2() { const T = mk('eh2'); T.sim.run(0.3); T.tap('PB1'); ok(T.until(() => atL(T.cyl('A1'), 200)) < 4, '전진'); const lamp = T.sim.st.get(T.byTag('H1').id); ok(lamp.on, 'H1 점등'); const d = T.until(() => T.cyl('A1').x < 199); ok(d > 1.7 && d < 2.6, `가압 유지 ${d.toFixed(2)}s`); ok(T.until(() => at0(T.cyl('A1'))) < 4, '후진'); ok(!lamp.on, 'H1 소등'); },
  eh3() { const T = mk('eh3'); T.sim.run(0.3); T.tap('PB1'); ok(T.until(() => T.cyl('A1').x > 199) < 4, '하강(전진)'); ok(T.until(() => at0(T.cyl('A1'))) < 5, 'PS1 40bar → 자동 상승'); },
};

for (const ex of EXAMPLES) {
  console.log(`[${ex.id}] ${ex.title}`);
  if (!tests[ex.id]) { console.log('   (테스트 없음)'); fails++; continue; }
  try { tests[ex.id](); } catch (e) { fails++; console.log('   ERROR', e.stack); }
}
console.log(fails ? `\n${fails} FAILED` : `\nALL ${EXAMPLES.length} EXAMPLES PASSED`);
process.exit(fails ? 1 : 0);
