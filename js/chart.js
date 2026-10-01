// 변위-시간 선도 (실린더 변위 + 솔레노이드/릴레이 동작)
export class Chart {
  constructor(canvas, ed) {
    this.cv = canvas;
    this.ed = ed;
    this.hist = [];
    this.resize();
  }
  resize() {
    const r = this.cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.w = Math.max(10, r.width);
    this.h = Math.max(10, r.height);
    this.cv.width = this.w * dpr;
    this.cv.height = this.h * dpr;
    this.g = this.cv.getContext('2d');
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  draw() {
    const g = this.g;
    if (!g) return;
    if (this.ed.sim) this.hist = this.ed.sim.hist;
    const H = this.hist;
    const { w, h } = this;
    g.clearRect(0, 0, w, h);
    g.font = '11px "Noto Sans KR", sans-serif';
    if (!H.length) {
      g.fillStyle = '#8a95a5';
      g.fillText('시뮬레이션을 시작하면 실린더 변위와 솔레노이드·릴레이 동작이 시간에 따라 그려집니다.', 16, 26);
      return;
    }
    const cyl = Object.keys(H[H.length - 1].cyl);
    const sol = [...new Set(H.flatMap((r) => Object.keys(r.sol)))].sort();
    const rel = [...new Set(H.flatMap((r) => Object.keys(r.relay)))].sort();
    const tEnd = H[H.length - 1].t;
    const span = Math.max(10, Math.min(30, tEnd));
    const t0 = Math.max(0, tEnd - span);
    const L = 64, R = 12, T = 8;
    const binH = 14;
    const nBin = sol.length + rel.length;
    const avail = h - T - 22 - nBin * (binH + 3);
    const cylH = cyl.length ? Math.max(24, Math.min(60, avail / cyl.length - 8)) : 0;
    const X = (t) => L + ((t - t0) / span) * (w - L - R);
    // 시간 격자
    g.strokeStyle = '#eef1f5';
    g.fillStyle = '#8a95a5';
    g.lineWidth = 1;
    const step = span > 20 ? 5 : span > 10 ? 2 : 1;
    for (let t = Math.ceil(t0 / step) * step; t <= t0 + span; t += step) {
      const x = X(t);
      g.beginPath(); g.moveTo(x, T); g.lineTo(x, h - 18); g.stroke();
      g.fillText(t.toFixed(0) + 's', x - 6, h - 5);
    }
    let y = T;
    const first = H.findIndex((r) => r.t >= t0);
    const rows = first < 0 ? H : H.slice(Math.max(0, first - 1));
    for (const k of cyl) {
      g.fillStyle = '#18212d';
      g.font = 'bold 11px sans-serif';
      g.fillText(k, 8, y + cylH / 2 + 4);
      g.font = '9px sans-serif';
      g.fillStyle = '#8a95a5';
      g.fillText('1', L - 10, y + 8);
      g.fillText('0', L - 10, y + cylH);
      g.strokeStyle = '#d3dbe6';
      g.strokeRect(L, y, w - L - R, cylH);
      g.strokeStyle = '#1a73e8';
      g.lineWidth = 2;
      g.beginPath();
      rows.forEach((r, i) => {
        const v = r.cyl[k] ?? 0;
        const px = X(Math.max(t0, r.t)), py = y + cylH - v * (cylH - 4) - 2;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      });
      g.stroke();
      g.lineWidth = 1;
      y += cylH + 8;
    }
    const bin = (keys, field, col) => {
      for (const k of keys) {
        g.fillStyle = '#4a5667';
        g.font = '10px sans-serif';
        g.fillText(k, 8, y + 11);
        g.fillStyle = '#f3f5f8';
        g.fillRect(L, y, w - L - R, binH);
        g.fillStyle = col;
        let on = null;
        for (const r of rows) {
          const v = !!r[field][k];
          if (v && on == null) on = Math.max(t0, r.t);
          if (!v && on != null) { g.fillRect(X(on), y + 2, X(r.t) - X(on), binH - 4); on = null; }
        }
        if (on != null) g.fillRect(X(on), y + 2, X(tEnd) - X(on), binH - 4);
        y += binH + 3;
      }
    };
    bin(sol, 'sol', '#ef4444');
    bin(rel, 'relay', '#f59e0b');
  }
}
