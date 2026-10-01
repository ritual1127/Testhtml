// 직교 배선 경로 계산
const isV = (d) => d === 'up' || d === 'down';

function corner(p, q, verticalFirst) {
  return verticalFirst ? [p[0], q[1]] : [q[0], p[1]];
}

// a, b: [x,y] 포트 좌표, da/db: 포트 방향, mids: 경유점
export function route(a, da, mids, b, db) {
  const pts = [a, ...(mids || []), b];
  const out = [a];
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p = pts[i], q = pts[i + 1];
    if (p[0] === q[0] || p[1] === q[1]) { out.push(q); continue; }
    const first = i === 0, last = i === n - 2;
    if (first && last) {
      // 포트 → 포트 직접 연결
      if (da === 'none' && db === 'none') out.push(corner(p, q, false));
      else if (isV(da) && isV(db)) {
        let y;
        if (da === 'down' && db === 'down') y = Math.max(p[1], q[1]) + 20;
        else if (da === 'up' && db === 'up') y = Math.min(p[1], q[1]) - 20;
        else y = Math.round((p[1] + q[1]) / 20) * 10;
        out.push([p[0], y], [q[0], y]);
      } else if (!isV(da) && !isV(db) && da !== 'none' && db !== 'none') {
        let x;
        if (da === 'right' && db === 'right') x = Math.max(p[0], q[0]) + 20;
        else if (da === 'left' && db === 'left') x = Math.min(p[0], q[0]) - 20;
        else x = Math.round((p[0] + q[0]) / 20) * 10;
        out.push([x, p[1]], [x, q[1]]);
      } else if (da !== 'none') out.push(corner(p, q, isV(da)));
      else out.push(corner(p, q, !isV(db)));
    } else if (first) out.push(corner(p, q, da === 'none' ? false : isV(da)));
    else if (last) out.push(corner(p, q, db === 'none' ? true : !isV(db)));
    else out.push(corner(p, q, false));
    out.push(q);
  }
  return simplify(out);
}

export function simplify(pts) {
  const r = [];
  for (const p of pts) {
    const l = r[r.length - 1];
    if (l && l[0] === p[0] && l[1] === p[1]) continue;
    r.push(p);
  }
  for (let i = r.length - 2; i >= 1; i--) {
    const a = r[i - 1], b = r[i], c = r[i + 1];
    if ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1])) r.splice(i, 1);
  }
  return r;
}

export const pathD = (pts) => 'M' + pts.map((p) => p[0] + ',' + p[1]).join(' L');

export function nearestOnPolyline(pts, x, y) {
  let best = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const dx = x2 - x1, dy = y2 - y1;
    const L2 = dx * dx + dy * dy || 1;
    let t = ((x - x1) * dx + (y - y1) * dy) / L2;
    t = Math.max(0, Math.min(1, t));
    const px = x1 + t * dx, py = y1 + t * dy;
    const d = Math.hypot(px - x, py - y);
    if (!best || d < best.d) best = { d, x: px, y: py, seg: i };
  }
  return best;
}
