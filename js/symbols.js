// ISO 1219 / KS B 0054 스타일 기호를 그리기 위한 SVG 문자열 헬퍼
export const f = (n) => Math.round(n * 100) / 100;
const cl = (c) => (c ? ` class="${c}"` : '');

export const L = (x1, y1, x2, y2, c) => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"${cl(c)}/>`;
export const P = (d, c) => `<path d="${d}"${cl(c)}/>`;
export const R = (x, y, w, h, c, rx) =>
  `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"${rx ? ` rx="${rx}"` : ''}${cl(c)}/>`;
export const C = (cx, cy, r, c) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"${cl(c)}/>`;
export const PG = (pts, c) => `<polygon points="${pts.map((p) => f(p[0]) + ',' + f(p[1])).join(' ')}"${cl(c)}/>`;
export const PL = (pts, c) => `<polyline points="${pts.map((p) => f(p[0]) + ',' + f(p[1])).join(' ')}"${cl(c)}/>`;
export const T = (x, y, s, c, anchor = 'middle', size) =>
  `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}"${size ? ` font-size="${size}"` : ''}${cl(c || 'stxt')}>${esc(s)}</text>`;
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 화살촉 (x1,y1)->(x2,y2) 방향, 끝점에 위치
export function head(x1, y1, x2, y2, s = 6, c = 'fk') {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const w = s * 0.45;
  const bx = x2 - Math.cos(a) * s, by = y2 - Math.sin(a) * s;
  return PG([[x2, y2], [bx - Math.sin(a) * w, by + Math.cos(a) * w], [bx + Math.sin(a) * w, by - Math.cos(a) * w]], c);
}
export const arrow = (x1, y1, x2, y2, c) => L(x1, y1, x2, y2, c) + head(x1, y1, x2, y2);

// 지그재그 스프링 (x1,y)->(x2,y) 수평
export function springH(x1, x2, yc, amp = 8, n = 4) {
  const pts = [[x1, yc]];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    pts.push([x1 + (x2 - x1) * t, yc + (i % 2 ? amp : -amp)]);
  }
  pts.push([x2, yc]);
  return PL(pts);
}
export function springV(x, y1, y2, amp = 6, n = 4) {
  const pts = [[x, y1]];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    pts.push([x + (i % 2 ? amp : -amp), y1 + (y2 - y1) * t]);
  }
  pts.push([x, y2]);
  return PL(pts);
}

// 가변 표시 사선 화살표 (조정 가능)
export const adj = (cx, cy, r = 14) => arrow(cx - r * 0.7, cy + r * 0.7, cx + r * 0.7, cy - r * 0.7);

// 배기 삼각형 (포트 아래쪽)
export function exhaustTri(x, y, dir = 'down') {
  if (dir === 'down') return PG([[x - 5, y + 8], [x + 5, y + 8], [x, y]], '');
  return PG([[x - 5, y - 8], [x + 5, y - 8], [x, y]], '');
}

// 교축(오리피스) 기호: 수평 두 개의 호
export function throttleH(cx, cy, w = 16) {
  return P(`M${f(cx - w / 2)},${f(cy - 7)} Q${f(cx)},${f(cy - 1)} ${f(cx + w / 2)},${f(cy - 7)}`) +
    P(`M${f(cx - w / 2)},${f(cy + 7)} Q${f(cx)},${f(cy + 1)} ${f(cx + w / 2)},${f(cy + 7)}`);
}

// 체크밸브(볼+시트) 흐름 방향 +x
export function checkH(cx, cy) {
  return C(cx - 2, cy, 5, 'fw') + PL([[cx + 6, cy - 8], [cx + 1, cy], [cx + 6, cy + 8]]);
}
// 체크밸브 흐름 방향 위(-y)
export function checkUp(cx, cy) {
  return C(cx, cy + 2, 5, 'fw') + PL([[cx - 8, cy - 6], [cx, cy - 1], [cx + 8, cy - 6]]);
}

// 압력계 원
export function gaugeSym(cx, cy, r = 11) {
  return C(cx, cy, r, 'fw') + arrow(cx - r * 0.6, cy + r * 0.6, cx + r * 0.6, cy - r * 0.6);
}

// 탱크 (개방형)
export function tankSym(cx, cy, w = 30, h = 14) {
  return PL([[cx - w / 2, cy - h / 2], [cx - w / 2, cy + h / 2], [cx + w / 2, cy + h / 2], [cx + w / 2, cy - h / 2]]);
}
