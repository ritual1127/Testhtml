/* SVG / DOM 공용 유틸 */
(function () {
  const NS = 'http://www.w3.org/2000/svg';

  function setAttrs(e, attrs) {
    if (!attrs) return;
    for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
  }
  function append(e, kids) {
    for (const c of kids.flat(Infinity)) {
      if (c == null || c === false) continue;
      e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
  }
  /** SVG 요소 생성 */
  function S(tag, attrs, ...kids) {
    const e = document.createElementNS(NS, tag);
    setAttrs(e, attrs);
    append(e, kids);
    return e;
  }
  /** HTML 요소 생성 */
  function H(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    setAttrs(e, attrs);
    append(e, kids);
    return e;
  }
  /** 점 배열 → path d */
  function d(pts) {
    return pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
  }
  /** 가로 지그재그(스프링) 점 */
  function zigH(x1, x2, y, amp = 7, n = 6) {
    const pts = [[x1, y]];
    for (let i = 1; i < n; i++) pts.push([x1 + (x2 - x1) * i / n, y + (i % 2 ? -amp : amp)]);
    pts.push([x2, y]);
    return pts;
  }
  /** 세로 지그재그(스프링) 점 */
  function zigV(x, y1, y2, amp = 7, n = 6) {
    const pts = [[x, y1]];
    for (let i = 1; i < n; i++) pts.push([x + (i % 2 ? -amp : amp), y1 + (y2 - y1) * i / n]);
    pts.push([x, y2]);
    return pts;
  }
  /** 화살촉 삼각형 (끝점, 방향) */
  function arrowHead(x, y, ang, len = 9, half = 4.2) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const bx = x - c * len, by = y - s * len;
    return [[x, y], [bx - s * half, by + c * half], [bx + s * half, by - c * half]];
  }
  function poly(pts) { return pts.map(p => p.join(',')).join(' '); }
  /** 대략적인 텍스트 폭 (한글/영문 혼합) */
  function textW(str, size = 13) {
    let w = 0;
    for (const ch of str) {
      const c = ch.charCodeAt(0);
      if (c >= 0xac00 && c <= 0xd7a3) w += size * 1.0;
      else if (c >= 0x2460 && c <= 0x24ff) w += size * 1.05;
      else if (/[A-Z0-9]/.test(ch)) w += size * 0.66;
      else if (ch === ' ') w += size * 0.3;
      else w += size * 0.56;
    }
    return w;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  window.U = { S, H, d, zigH, zigV, arrowHead, poly, textW, clamp, lerp };
})();
