// 브라우저 E2E 테스트 (Playwright 필요: NODE_PATH 에 playwright 경로 지정)
//   NODE_PATH=$(npm root -g) node tests/e2e.test.cjs [스크린샷 폴더]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = process.argv[2];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
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
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) errs.push(m.text()); });
  const shot = async (n) => { if (OUT) await page.screenshot({ path: path.join(OUT, n + '.png') }); };
  // 컴포넌트 중심의 화면 좌표
  const compXY = (tag, pred = '') => page.evaluate(([tag, pred]) => {
    const ed = window.__ed;
    const c = ed.doc.components.find((q) => q.props.tag === tag && (!pred || q.type.includes(pred)));
    const g = document.querySelector(`#canvas .comp[data-id="${c.id}"] .hit`);
    const r = g.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2, r.left, r.right];
  }, [tag, pred]);
  const cylX = (tag) => page.evaluate((tag) => { const ed = window.__ed; const c = ed.doc.components.find((q) => q.props.tag === tag && q.type.includes('_cyl_')); return ed.sim.st.get(c.id).x; }, tag);

  console.log('[1] 홈 화면 / 예제 로드 / 시뮬레이션 (ep4 연속 왕복)');
  await page.goto(base + '/index.html');
  await page.waitForTimeout(500);
  ok(await page.isVisible('#home'), '홈 화면 표시');
  await shot('e2e-00-home');
  await page.click('[data-home="examples"]');
  await page.waitForTimeout(200);
  ok((await page.$$('.excard')).length >= 20, '예제 목록 표시');
  await page.click('.excard[data-ex="ep4"]');
  await page.waitForTimeout(500);
  ok((await page.inputValue('#docName')).includes('연속 왕복'), '예제 로드됨');
  await page.click('#btnStart');
  await page.waitForTimeout(300);
  const [px, py] = await compXY('PB1', 'e_pb');
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.waitForTimeout(250);
  await page.mouse.up();
  await page.waitForTimeout(500);
  const x1 = await cylX('1A');
  ok(x1 > 10, `PB1 클릭 → 실린더 전진 시작 (x=${x1.toFixed(0)})`);
  await shot('e2e-01-sim-circuit');
  await page.click('[data-view="split"]');
  await page.waitForTimeout(1200);
  await shot('e2e-02-split');
  await page.click('[data-view="trainer"]');
  await page.click('#btnChart');
  await page.waitForTimeout(1500);
  await shot('e2e-03-trainer-chart');
  ok(await page.evaluate(() => document.querySelectorAll('#trainer .t-mod').length) >= 5, '실습장비 모듈 렌더링');
  // 실습장비의 PB2 (정지) 클릭
  const pb2 = await page.evaluate(() => { const g = [...document.querySelectorAll('#trainer .t-mod')].find((e) => e.dataset.group === 'pb:PB2'); const r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.move(pb2[0], pb2[1]);
  await page.mouse.down();
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.waitForTimeout(3500);
  ok((await cylX('1A')) < 1, '실습장비에서 PB2 클릭 → 후진 위치 정지');
  await page.click('#btnStop');
  await page.waitForTimeout(200);
  ok(!(await page.evaluate(() => !!window.__ed.sim)), '정지 → 편집 모드');

  console.log('[2] 새 회로 작도: 드래그 배치 + 배선 + 시뮬레이션');
  await page.click('[data-view="circuit"]');
  await page.click('#btnChart');
  await page.evaluate(() => { window.__ed.newDoc('pn'); });
  await page.waitForTimeout(200);
  const canvas = await page.$('#canvas');
  const cb = await canvas.boundingBox();
  const place = async (type, x, y) => {
    await page.click(`.pitem[data-type="${type}"]`);
    await page.mouse.click(cb.x + x, cb.y + y);
    await page.waitForTimeout(100);
  };
  await place('p_cyl_double', 300, 150);
  await place('pv52_push', 330, 330);
  await place('p_source', 150, 520);
  ok(await page.evaluate(() => window.__ed.doc.components.length) === 3, '부품 3개 배치');
  const portXY = (type, pid) => page.evaluate(([type, pid]) => {
    const c = window.__ed.doc.components.find((q) => q.type === type);
    const e = document.querySelector(`#canvas .port[data-c="${c.id}"][data-p="${pid}"]`);
    const r = e.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }, [type, pid]);
  const connect = async (t1, p1, t2, p2) => {
    const a = await portXY(t1, p1), b = await portXY(t2, p2);
    await page.mouse.click(a[0], a[1]);
    await page.waitForTimeout(60);
    await page.mouse.move(b[0], b[1]);
    await page.mouse.click(b[0], b[1]);
    await page.waitForTimeout(80);
  };
  await connect('pv52_push', '4', 'p_cyl_double', 'A');
  await connect('pv52_push', '2', 'p_cyl_double', 'B');
  await connect('p_source', '1', 'pv52_push', '1');
  ok(await page.evaluate(() => window.__ed.doc.wires.length) === 3, '배관 3개 연결 (포트 클릭)');
  await shot('e2e-04-drawn');
  // 실행 취소 / 다시 실행
  await page.keyboard.press('Control+z');
  ok(await page.evaluate(() => window.__ed.doc.wires.length) === 2, 'Ctrl+Z 실행 취소');
  await page.keyboard.press('Control+y');
  ok(await page.evaluate(() => window.__ed.doc.wires.length) === 3, 'Ctrl+Y 다시 실행');
  await page.click('#btnStart');
  await page.waitForTimeout(300);
  const v = await page.evaluate(() => { const c = window.__ed.doc.components.find((q) => q.type === 'pv52_push'); const r = document.querySelector(`#canvas .comp[data-id="${c.id}"] .hit`).getBoundingClientRect(); return [r.left + 12, r.top + r.height / 2]; });
  await page.mouse.move(v[0], v[1]);
  await page.mouse.down();
  await page.waitForTimeout(1500);
  const xd = await page.evaluate(() => { const c = window.__ed.doc.components.find((q) => q.type === 'p_cyl_double'); return window.__ed.sim.st.get(c.id).x; });
  await shot('e2e-05-drawn-sim');
  await page.mouse.up();
  ok(xd > 99, `작도한 회로: 버튼 누름 → 전진 완료 (x=${xd.toFixed(0)})`);
  await page.click('#btnStop');

  console.log('[3] 유압 예제 실습장비 렌더링');
  await page.goto(base + '/index.html?ex=eh2&view=split');
  await page.waitForTimeout(600);
  await page.click('#btnStart');
  const [qx, qy] = await compXY('PB1', 'e_pb');
  await page.mouse.move(qx, qy);
  await page.mouse.down();
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.waitForTimeout(2600);
  await shot('e2e-06-hy-split');
  ok((await cylX('A1')) > 150, '유압 실린더 전진');

  console.log('[4] 회로 검사 · 내보내기');
  await page.click('#btnStop');
  await page.evaluate(() => document.querySelector('[data-cmd="check"]').click());
  await page.waitForTimeout(200);
  ok(await page.isVisible('#modal'), '회로 검사 결과 표시');
  ok((await page.textContent('#modalBody')).includes('문제가 발견되지 않았습니다'), '예제 회로: 오류 없음');
  await page.click('#modalClose');
  const svg = await page.evaluate(() => window.__ed.exportSVG());
  ok(svg.startsWith('<svg') && svg.length > 5000, 'SVG 내보내기');

  ok(errs.length === 0, '페이지 오류 없음' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await browser.close();
  server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nE2E PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
