// 3D 실습실 E2E: 빈 보드에서 부품 설치 → 호스/전선 연결 → 시뮬레이션 → 푸시버튼 조작
//   NODE_PATH=$(npm root -g) node tests/e2e3d.test.cjs [스크린샷 폴더]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OUT = process.argv[2];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('   FAIL', m); } else console.log('   ok  ', m); };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) errs.push(m.text()); });
  const shot = async (n) => { if (OUT) await page.screenshot({ path: path.join(OUT, n + '.png') }); };
  const R = (fn, arg) => page.evaluate(fn, arg);
  const click = async (xy, hold = 60) => { await page.mouse.move(xy[0], xy[1]); await page.mouse.down(); await page.waitForTimeout(hold); await page.mouse.up(); await page.waitForTimeout(120); };
  const compId = (type) => R((t) => window.__room.doc.components.find((c) => c.type === t).id, type);
  const end = (cid, pid) => R(([c, p]) => window.__room.projectEnd(c, p), [cid, pid]);

  console.log('[1] 빈 공압 실습실 열기');
  await page.goto(base + '/index.html?room=pn');
  await page.waitForTimeout(1500);
  await page.selectOption('#r3q', 'low');
  await page.waitForTimeout(800);
  ok(await page.evaluate(() => document.body.classList.contains('mode3d')), '3D 실습실 표시');
  ok(await R(() => window.__room.doc.components.filter((c) => c.b3 && c.b3.rack != null).length) === 9, '전기 모듈 9개 랙 장착');

  console.log('[2] 하단 분류에서 부품 설치');
  const place = async (cat, type, u, v) => {
    await page.click(`#r3cats [data-cat="${cat}"]`);
    await page.waitForTimeout(150);
    await page.click(`.r3item[data-type="${type}"]`);
    await page.waitForTimeout(150);
    const xy = await R(([u, v]) => window.__room.projectBoard(u, v), [u, v]);
    await page.mouse.move(xy[0] - 20, xy[1] - 10);
    await page.mouse.move(xy[0], xy[1]);
    await page.waitForTimeout(150);
    await click(xy);
  };
  await place(0, 'p_cyl_double', 10, 62);
  await place(1, 'pv52_sol', 0, 32);
  const nComp = await R(() => window.__room.doc.components.filter((c) => !(c.b3 && c.b3.rack != null) && !c.type.endsWith('supply3d')).length);
  ok(nComp === 2, `실린더·밸브 설치 (${nComp})`);
  const cyl = await compId('p_cyl_double'), val = await compId('pv52_sol'), sup = await compId('p_supply3d'), psu = await compId('m_psu'), pb = await R(() => window.__room.doc.components.find((c) => c.type === 'm_pb' && +c.props.base === 1).id);
  ok(Math.abs((await R((id) => window.__room.doc.components.find((c) => c.id === id).b3.v, cyl)) - 62.5) < 3, '보드 슬롯에 스냅');

  console.log('[3] 피팅 클릭으로 호스 연결');
  const hose = async (a, ap, b, bp) => { await click(await end(a, ap)); await click(await end(b, bp)); };
  await hose(sup, 'o1', val, '1');
  await hose(val, '4', cyl, 'A');
  await hose(val, '2', cyl, 'B');
  ok(await R(() => window.__room.doc.wires.length) === 3, '호스 3개 연결');
  // 이미 연결된 포트에 추가 연결 거부
  await click(await end(val, '4'));
  await click(await end(cyl, 'B'));
  ok(await R(() => window.__room.doc.wires.length) === 3, '연결된 피팅에는 추가 호스 불가');
  await page.keyboard.press('Escape');

  console.log('[4] 잭 클릭으로 전선 연결');
  await R(() => window.__room.setView('all', true));
  await page.waitForTimeout(300);
  const wire = async (a, ap, b, bp) => { await click(await end(a, ap)); await click(await end(b, bp)); };
  await wire(psu, 'P0', pb, '0NOa');
  await page.click('#r3side [data-color="black"]');
  await wire(pb, '0NOb', val, 'S14a');
  await page.click('#r3side [data-color="blue"]');
  await wire(val, 'S14b', psu, 'N0');
  const ws = await R(() => window.__room.doc.wires.filter((w) => w.color).map((w) => w.color).join(','));
  ok(ws === 'red,black,blue', `전선 3개 (${ws})`);
  await shot('e3d-01-built');

  console.log('[5] 시뮬레이션: 랙의 PB1 누름 → 실린더 전진');
  await page.click('#r3top [data-r="start"]');
  await page.waitForTimeout(400);
  const btn = await R((id) => window.__room.projectMesh(id, (p) => p.part === 0), pb);
  await page.mouse.move(btn[0], btn[1]);
  await page.mouse.down();
  let x = 0;
  for (let i = 0; i < 40 && x < 99; i++) { await page.waitForTimeout(250); x = await R((id) => window.__room.sim.st.get(id).x, cyl); }
  ok(x > 99, `PB1 누르는 동안 전진 완료 (x=${x.toFixed(0)}mm)`);
  await shot('e3d-02-sim');
  await page.mouse.up();
  for (let i = 0; i < 40 && x > 1; i++) { await page.waitForTimeout(250); x = await R((id) => window.__room.sim.st.get(id).x, cyl); }
  ok(x < 1, '놓으면 후진');
  await page.click('#r3top [data-r="stop"]');

  console.log('[6] 예제 배선 과제 + 분석');
  await page.goto(base + '/index.html?ex=ep2&mode=ex3d');
  await page.waitForTimeout(2500);
  ok(await R(() => window.__room.doc.wires.length) === 0 && await R(() => !!window.__room.doc.ref), '과제 모드: 부품만 설치');
  await page.click('#r3top [data-r="afluid"]');
  await page.waitForTimeout(200);
  ok((await page.textContent('#modalBody')).includes('정답 비교'), '배선 분석 · 정답 비교 표시');
  await page.click('#modalClose');
  ok(errs.length === 0, '페이지 오류 없음' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await browser.close();
  server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nE2E 3D PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
