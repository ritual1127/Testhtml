// 3D 부품 모델 (단위: cm). 로컬 좌표: X=보드 가로, Y=보드 세로(위), Z=보드 바깥(앞)
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/three/RoundedBoxGeometry.js';
import { REG, newComp } from './components.js';
import { SYM_CSS } from './editor.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const M = {};
let invalidate = () => {};
export function setInvalidate(fn) { invalidate = fn; }

export function initMats() {
  if (M.ok) return;
  const S = (o) => new THREE.MeshStandardMaterial(o);
  const P = (o) => new THREE.MeshPhysicalMaterial(o);
  Object.assign(M, {
    ok: true,
    plate: P({ color: 0xeceff2, roughness: 0.45, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
    plateHy: P({ color: 0xdfe3e8, roughness: 0.4, metalness: 0.15, clearcoat: 0.3 }),
    alu: S({ color: 0xbcc3cb, roughness: 0.34, metalness: 0.85 }),
    aluAnod: S({ color: 0x8e979f, roughness: 0.4, metalness: 0.8 }),
    aluDark: S({ color: 0x7f8891, roughness: 0.4, metalness: 0.75 }),
    chrome: S({ color: 0xffffff, roughness: 0.08, metalness: 1 }),
    steel: S({ color: 0xb3bac2, roughness: 0.25, metalness: 0.92 }),
    brass: S({ color: 0xd8b25a, roughness: 0.3, metalness: 0.9 }),
    dark: S({ color: 0x1c1f23, roughness: 0.55, metalness: 0.2 }),
    black: P({ color: 0x141518, roughness: 0.38, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
    body: P({ color: 0x23272d, roughness: 0.35, metalness: 0.25, clearcoat: 0.5 }),
    bodyBlue: P({ color: 0x3b6ea8, roughness: 0.35, metalness: 0.3, clearcoat: 0.5 }),
    bodyHy: S({ color: 0x2e3540, roughness: 0.32, metalness: 0.6 }),
    paintBlue: P({ color: 0x24497a, roughness: 0.35, metalness: 0.3, clearcoat: 0.6 }),
    tubeHy: P({ color: 0x15181c, roughness: 0.25, metalness: 0.4, clearcoat: 0.8 }),
    fitWhite: P({ color: 0xf2f4f6, roughness: 0.4, clearcoat: 0.4 }),
    fitBlue: P({ color: 0x0f6be0, roughness: 0.35, clearcoat: 0.5 }),
    coupler: S({ color: 0xc9cfd6, roughness: 0.18, metalness: 0.95 }),
    red: P({ color: 0xd22a2a, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
    green: P({ color: 0x18a34a, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
    yellow: P({ color: 0xf5c400, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
    blue: P({ color: 0x1f5fd1, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
    white: P({ color: 0xfafafa, roughness: 0.4, clearcoat: 0.4 }),
    jackRed: P({ color: 0xc8202a, roughness: 0.3, clearcoat: 0.6 }),
    jackBlue: P({ color: 0x1d4fc4, roughness: 0.3, clearcoat: 0.6 }),
    jackBlack: P({ color: 0x18191b, roughness: 0.3, clearcoat: 0.6 }),
    jackYellow: P({ color: 0xe8b800, roughness: 0.3, clearcoat: 0.6 }),
    hole: S({ color: 0x050505, roughness: 1 }),
    glass: P({ color: 0xe8f4ff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.28, clearcoat: 1 }),
    bowl: P({ color: 0xcfe6ff, roughness: 0.05, transparent: true, opacity: 0.5, clearcoat: 1 }),
    tank: P({ color: 0x5f7a96, roughness: 0.38, metalness: 0.45, clearcoat: 0.6 }),
    motor: P({ color: 0x2c6e4c, roughness: 0.4, metalness: 0.35, clearcoat: 0.5 }),
    knobT: P({ color: 0x1f2226, roughness: 0.45, clearcoat: 0.4 }),
    ledOff: S({ color: 0x4a1515, roughness: 0.3 }),
    ledOn: S({ color: 0xff3030, emissive: 0xff1a1a, emissiveIntensity: 3 }),
    ledGOff: S({ color: 0x163420, roughness: 0.3 }),
    ledGOn: S({ color: 0x40ff80, emissive: 0x20ff60, emissiveIntensity: 3 }),
    ledYOn: S({ color: 0xffd84d, emissive: 0xffc400, emissiveIntensity: 2.2 }),
    indOff: S({ color: 0x2a3138, roughness: 0.5 }),
  });
}

/* ---------------- 지오메트리 캐시 ---------------- */
const geo = {};
const G = (k, f) => geo[k] || (geo[k] = f());
const rb = (w, h, d, r, m) => new THREE.Mesh(G(`rb${w}_${h}_${d}_${r}`, () => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01))), m);
const box = (w, h, d, m) => new THREE.Mesh(G(`b${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d)), m);
const cylY = (r, h, m, seg = 28, r2) => new THREE.Mesh(G(`c${r}_${h}_${seg}_${r2}`, () => new THREE.CylinderGeometry(r2 ?? r, r, h, seg)), m);
const cylX = (r, h, m, seg) => { const o = cylY(r, h, m, seg); o.rotation.z = Math.PI / 2; return o; };
const cylZ = (r, h, m, seg, r2) => { const o = cylY(r, h, m, seg, r2); o.rotation.x = Math.PI / 2; return o; };
const sph = (r, m, seg = 20) => new THREE.Mesh(G(`s${r}_${seg}`, () => new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7))), m);
const dome = (r, m) => new THREE.Mesh(G(`d${r}`, () => new THREE.SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2)), m);
const torusZ = (R, r, m) => new THREE.Mesh(G(`t${R}_${r}`, () => new THREE.TorusGeometry(R, r, 10, 32)), m);
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

// 큰 물체만 그림자 투사 (성능)
const shadow = (root) => {
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    o.receiveShadow = true;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    o.castShadow = o.geometry.boundingSphere.radius * Math.max(o.scale.x, o.scale.y, o.scale.z) > 1.1 && !o.material.transparent;
  });
  return root;
};

/* ---------------- 텍스처 ---------------- */
export function canvasTex(wpx, hpx, draw) {
  const cv = document.createElement('canvas');
  cv.width = wpx;
  cv.height = hpx;
  const g = cv.getContext('2d');
  draw(g, wpx, hpx);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { cv, g, tex };
}
const FONT = (px, w = 700) => `${w} ${px}px "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", Arial, sans-serif`;
function texPlane(w, h, draw, ppcm = 40, matOpts = {}) {
  const t = canvasTex(Math.round(w * ppcm), Math.round(h * ppcm), (g, W, H) => draw(g, W, H, ppcm));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t.tex, roughness: 0.55, ...matOpts }));
  m.userData.tex = t;
  return m;
}
function redraw(mesh, draw) {
  const t = mesh.userData.tex;
  draw(t.g, t.cv.width, t.cv.height);
  t.tex.needsUpdate = true;
}

// ISO 기호 이미지 (부품 라벨용, 비동기)
const symCache = new Map();
function symbolImage(type) {
  if (symCache.has(type)) return symCache.get(type);
  const p = new Promise((res) => {
    const d = REG[type];
    const c = newComp(type, 0, 0, 's');
    const [x0, y0, x1, y1] = d.bbox(c);
    const r = d.draw(c, null, null);
    const m = 4;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0 - m} ${y0 - m} ${x1 - x0 + 2 * m} ${y1 - y0 + 2 * m}" width="${(x1 - x0 + 2 * m) * 4}" height="${(y1 - y0 + 2 * m) * 4}"><style>${SYM_CSS}</style><g class="sym">${r.b}</g></svg>`;
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  symCache.set(type, p);
  return p;
}

// 글로우 스프라이트 (LED · 램프)
let glowTex;
function glow(color, size) {
  if (!glowTex) {
    glowTex = canvasTex(64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.25, 'rgba(255,255,255,0.55)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
    }).tex;
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.setScalar(size);
  s.visible = false;
  return s;
}

/* ---------------- 모델 기본 ---------------- */
function newModel(c) {
  initMats();
  return { c, root: new THREE.Group(), ports: {}, jacks: {}, picks: [], body: [], jackList: [], size: [6, 6], update: () => {} };
}
function finish(m) {
  // 잭 인스턴싱 (성능)
  if (m.jackList.length) {
    const byCol = {};
    for (const j of m.jackList) (byCol[j.color] = byCol[j.color] || []).push(j);
    const ringG = G('jackRing', () => { const g = new THREE.CylinderGeometry(0.5, 0.52, 0.56, 18); g.rotateX(Math.PI / 2); g.translate(0, 0, 0.28); return g; });
    const holeG = G('jackHole', () => { const g = new THREE.CylinderGeometry(0.2, 0.2, 0.04, 12); g.rotateX(Math.PI / 2); g.translate(0, 0, 0.575); return g; });
    const sleeveG = G('jackSleeve', () => { const g = new THREE.TorusGeometry(0.27, 0.06, 6, 16); g.translate(0, 0, 0.57); return g; });
    const mtx = new THREE.Matrix4();
    for (const [col, list] of Object.entries(byCol)) {
      const ring = new THREE.InstancedMesh(ringG, M[{ red: 'jackRed', blue: 'jackBlue', black: 'jackBlack', yellow: 'jackYellow' }[col]], list.length);
      list.forEach((j, i) => { mtx.makeTranslation(j.pos.x, j.pos.y, j.pos.z); ring.setMatrixAt(i, mtx); });
      ring.userData.pick = { kind: 'jack', inst: list.map((j) => j.pid) };
      ring.receiveShadow = true;
      ring.computeBoundingSphere();
      m.root.add(ring);
      m.picks.push(ring);
    }
    const holes = new THREE.InstancedMesh(holeG, M.hole, m.jackList.length);
    const sleeves = new THREE.InstancedMesh(sleeveG, M.steel, m.jackList.length);
    m.jackList.forEach((j, i) => { mtx.makeTranslation(j.pos.x, j.pos.y, j.pos.z); holes.setMatrixAt(i, mtx); sleeves.setMatrixAt(i, mtx); });
    m.root.add(holes, sleeves);
  }
  for (const b of m.body) { b.userData.pick = b.userData.pick || { kind: 'comp' }; m.picks.push(b); }
  shadow(m.root);
  m.root.userData.model = m;
  return m;
}

/* ---------------- 피팅 · 잭 ---------------- */
function fitting(model, kind, pid, x, y, z, dir, label) {
  const g = new THREE.Group();
  const d = dir.clone().normalize();
  g.position.set(x, y, z);
  g.quaternion.setFromUnitVectors(V3(0, 1, 0), d);
  let len;
  if (kind === 'hy') {
    g.add(at(cylY(0.9, 0.55, M.steel, 6), 0, 0.28, 0));
    g.add(at(cylY(0.72, 1.4, M.coupler, 24), 0, 1.25, 0));
    g.add(at(cylY(0.8, 0.22, M.coupler, 24), 0, 0.95, 0));
    g.add(at(cylY(0.78, 0.35, M.dark, 24), 0, 1.95, 0));
    len = 2.15;
  } else {
    g.add(at(cylY(0.5, 1.0, M.fitWhite, 20), 0, 0.5, 0));
    g.add(at(cylY(0.64, 0.34, M.fitBlue, 24), 0, 1.12, 0));
    g.add(at(cylY(0.27, 0.06, M.hole, 14), 0, 1.3, 0));
    len = 1.32;
  }
  g.traverse((o) => { if (o.isMesh) { o.userData.pick = { kind: 'port', pid }; model.picks.push(o); } });
  model.root.add(g);
  model.ports[pid] = { pos: V3(x, y, z).addScaledVector(d, len), dir: d, kind, label };
  return g;
}
function jack(model, pid, x, y, z, color = 'black') {
  model.jackList.push({ pid, pos: V3(x, y, z), color });
  model.jacks[pid] = { pos: V3(x, y, z + 0.6), dir: V3(0, 0, 1), color };
}

// 베이스 플레이트 + 하단 라벨(기호 인쇄)
function plateMesh(model, w, h, hy, title, sub, symType, portLabels = []) {
  const p = rb(w, h, 1.0, 0.35, hy ? M.plateHy : M.plate);
  p.position.z = 0.5;
  model.root.add(p);
  model.body.push(p);
  for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    model.root.add(at(cylZ(0.62, 0.55, M.knobT, 20), sx * (w / 2 - 0.85), sy * (h / 2 - 0.85), 1.25));
    model.root.add(at(cylZ(0.35, 0.1, M.steel, 12), sx * (w / 2 - 0.85), sy * (h / 2 - 0.85), 1.55));
  }
  const lw = Math.max(5, w - 3.6), lh = 2.3;
  const draw = (g, W, H, s, img) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#c9d1da';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, W - 3, H - 3);
    let tx = s * 0.35;
    if (img) {
      const ih = H - s * 0.3, iw = Math.min(W * 0.42, (img.width / img.height) * ih);
      g.drawImage(img, s * 0.2, (H - ih) / 2, iw, ih);
      tx = s * 0.4 + iw;
    }
    g.fillStyle = '#1b2633';
    g.textAlign = 'left';
    g.font = FONT(Math.round(s * 0.72));
    g.fillText(title || '', tx, H * 0.45, W - tx - s * 0.2);
    g.font = FONT(Math.round(s * 0.5), 500);
    g.fillStyle = '#5b6775';
    g.fillText(sub || '', tx, H * 0.83, W - tx - s * 0.2);
  };
  const lab = texPlane(lw, lh, (g, W, H, s) => draw(g, W, H, s, null), 46);
  lab.position.set(0, -h / 2 + lh / 2 + 0.55, 1.015);
  model.root.add(lab);
  if (symType) symbolImage(symType).then((img) => { if (img) { redraw(lab, (g, W, H) => draw(g, W, H, 46, img)); invalidate(); } });
  if (portLabels.length) {
    const ph = h - lh - 1.4;
    const pl = texPlane(w - 1.2, ph, (g, W, H, s) => {
      g.clearRect(0, 0, W, H);
      g.fillStyle = '#4b5663';
      g.font = FONT(Math.round(s * 0.62));
      g.textAlign = 'center';
      for (const [lx, ly, t] of portLabels) g.fillText(t, W / 2 + lx * s, H / 2 - (ly - (lh + 0.2) / 2) * s + s * 0.22);
    }, 36, { transparent: true });
    pl.position.set(0, (lh + 0.2) / 2, 1.012);
    model.root.add(pl);
  }
}

/* ---------------- 실린더 ---------------- */
function cylinderModel(c) {
  const m = newModel(c);
  const hy = c.type.startsWith('h_');
  const single = c.type.includes('single');
  const L0 = (+c.props.stroke || 100) / 10;
  const cap = hy ? 5.4 : 3.8, r = hy ? 2.3 : 1.5, rr = hy ? 1.0 : 0.5;
  const tubeLen = L0 + 2.6;
  const total = cap * 2 + tubeLen + L0 + 3;
  const x0 = -total / 2;
  const zc = cap / 2 + 1.2;
  const xr = x0 + cap / 2, xt0 = x0 + cap, xt1 = xt0 + tubeLen, xf = xt1 + cap / 2, xface = xt1 + cap;
  m.size = [total, cap + 2.5];
  for (const xx of [xr, xf]) {
    const b = rb(cap * 0.92, cap + 2.2, 1.0, 0.25, M.aluAnod);
    at(b, xx, 0, 0.5);
    m.root.add(b);
    m.body.push(b);
    for (const sy of [-1, 1]) m.root.add(at(cylZ(0.45, 0.4, M.steel, 6), xx, sy * (cap / 2 + 0.55), 1.15));
  }
  const capM = hy ? M.paintBlue : M.aluAnod;
  for (const xx of [xr, xf]) { const b = rb(cap, cap, cap, hy ? 0.3 : 0.5, capM); at(b, xx, 0, zc); m.root.add(b); m.body.push(b); }
  if (hy) {
    const tube = cylX(r, tubeLen, M.tubeHy, 40);
    at(tube, (xt0 + xt1) / 2, 0, zc);
    m.root.add(tube);
    m.body.push(tube);
    for (const [dy, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      m.root.add(at(cylX(0.28, tubeLen + cap * 2, M.steel, 10), (xr + xf) / 2, dy * (cap / 2 - 0.65), zc + dz * (cap / 2 - 0.65)));
      for (const xx of [x0 - 0.2, xface + 0.2]) m.root.add(at(cylX(0.5, 0.6, M.steel, 6), xx, dy * (cap / 2 - 0.65), zc + dz * (cap / 2 - 0.65)));
    }
  } else {
    const tube = rb(tubeLen + 0.2, r * 2 + 0.4, r * 2 + 0.4, 0.55, M.alu);
    at(tube, (xt0 + xt1) / 2, 0, zc);
    m.root.add(tube);
    m.body.push(tube);
    for (const sy of [-1, 1]) m.root.add(at(box(tubeLen, 0.18, 0.14, M.aluDark), (xt0 + xt1) / 2, sy * 0.55, zc + r + 0.2));
  }
  const rod = new THREE.Group();
  const rodLen = L0 + 4;
  rod.add(at(cylX(rr, rodLen, M.chrome, 24), rodLen / 2, 0, 0));
  rod.add(at(cylX(rr * 1.95, 0.9, M.steel, 6), rodLen + 0.25, 0, 0));
  rod.add(at(rb(0.8, cap + 1.6, 1.6, 0.2, M.aluDark), rodLen + 1.0, -0.8, 0));
  m.root.add(rod);
  const lab = texPlane(Math.min(11, tubeLen - 1.2), 1.4, (g, W, H, s) => {
    g.fillStyle = hy ? '#1a1d22' : '#f1f4f7';
    g.fillRect(0, 0, W, H);
    g.fillStyle = hy ? '#e8edf2' : '#1f2a36';
    g.font = FONT(Math.round(s * 0.8));
    g.textAlign = 'center';
    g.fillText(`${c.props.tag}   ø${c.props.bore} × ${c.props.stroke}`, W / 2, H * 0.74);
  }, 48);
  if (hy) { lab.position.set((xt0 + xt1) / 2, r * 0.5, zc + r * 0.86); lab.rotation.x = -0.55; }
  else lab.position.set((xt0 + xt1) / 2, -0.4, zc + r + 0.22);
  m.root.add(lab);
  fitting(m, hy ? 'hy' : 'pn', 'A', xr, -cap * 0.12, zc + cap / 2, V3(0, -0.5, 1), 'A');
  if (!single) fitting(m, hy ? 'hy' : 'pn', 'B', xf, -cap * 0.12, zc + cap / 2, V3(0, -0.5, 1), 'B');
  else m.root.add(at(cylZ(0.5, 0.4, M.dark, 12), xf, 0, zc + cap / 2 + 0.2));
  m.frame = { xt0, xt1, xface, zc, r, cap, L0, rodLen };
  m.update = (st) => {
    const x = st ? st.x / 10 : ((+c.props.x0 || 0) / 100) * L0;
    rod.position.set(xface - rodLen + 1.6 + x, 0, zc);
  };
  m.update(null);
  m.attachFrame = (kind, pos) => {
    const f = Math.max(0, Math.min(1, pos / (L0 * 10)));
    if (kind === 'reed') return { x: xt0 + 1.3 + f * (tubeLen - 2.6), y: 0.55, z: zc + r + 0.32 };
    return { x: xface + 1.6 + 1.0 + f * L0, y: -(cap / 2 + 2.9), z: zc - 0.5 };
  };
  return finish(m);
}

/* ---------------- 방향제어밸브 ---------------- */
const actWidth = (a, hy) => (a.t === 'sol' ? (hy ? 3.8 : 3.0) : a.t === 'spring' ? 1.8 : a.t === 'roller' ? 2.8 : a.t === 'pilot' ? 1.6 : 2.6);
function valveModel(c, d) {
  const m = newModel(c);
  const spec = d.valve;
  const hy = d.dom === 'hy';
  const n = spec.pos.length;
  const nPorts = Math.max(spec.top.length, spec.bot.length);
  const bl = hy ? 7.5 + n * 1.6 : 4.2 + nPorts * 1.6;
  const bh = hy ? 4.2 : 3.4, bz = hy ? 3.8 : 3.0;
  const aw = (acts) => acts.reduce((s, a) => s + actWidth(a, hy), 0);
  const lw = aw(spec.L), rw = aw(spec.R);
  const W = Math.max(11, bl + lw + rw + 2.8), H = hy ? 13 : 11.5;
  m.size = [W, H];
  const bx = (lw - rw) / 2;
  const by = 1.2;
  const top = 1.0 + bz;
  const lab = d.ports(c).reduce((o, p) => ((o[p.id] = p.lab ?? p.id), o), {});
  const px = (arr, i) => bx - bl / 2 + ((i + 0.5) * bl) / arr.length;
  const pls = [];
  spec.top.forEach(([id], i) => pls.push([px(spec.top, i), by + bh / 2 + 0.75, lab[id]]));
  spec.bot.forEach(([id], i) => pls.push([px(spec.bot, i), by - bh / 2 - 0.65, lab[id]]));
  plateMesh(m, W, H, hy, `${c.props.tag}`, d.name.replace(/\s*\(.*\)/, ''), c.type, pls);
  m.root.add(at(rb(bl + 0.6, bh + 0.8, 0.8, 0.2, hy ? M.aluDark : M.aluAnod), bx, by, 1.4));
  const body = rb(bl, bh, bz - 0.6, 0.35, hy ? M.bodyHy : M.body);
  at(body, bx, by, 1.8 + (bz - 0.6) / 2);
  m.root.add(body);
  m.body.push(body);
  const ind = [];
  for (let i = 0; i < n; i++) {
    const w = (bl - 1.4) / n - 0.3;
    const im = rb(w, 0.7, 0.14, 0.06, M.indOff);
    at(im, bx - bl / 2 + 0.7 + w / 2 + i * (w + 0.3), by, top + 0.25);
    m.root.add(im);
    ind.push(im);
  }
  spec.top.forEach(([id], i) => fitting(m, hy ? 'hy' : 'pn', id, px(spec.top, i), by + bh / 2 - 0.8, top + 0.2, V3(0, 0.6, 1), lab[id]));
  spec.bot.forEach(([id], i) => fitting(m, hy ? 'hy' : 'pn', id, px(spec.bot, i), by - bh / 2 + 0.8, top + 0.2, V3(0, -0.6, 1), lab[id]));
  const leds = {}, caps = {};
  const build = (acts, side) => {
    let o = 0;
    const e = bx + side * (bl / 2);
    for (const a of acts) {
      const w = actWidth(a, hy);
      const cx = e + side * (o + w / 2);
      const zc = 1.8 + (bz - 0.6) / 2;
      const S = side < 0 ? 'L' : 'R';
      if (a.t === 'sol') {
        const coil = rb(w - 0.25, bh + (hy ? 0.6 : 0.3), bz + (hy ? 0.4 : 0.2), 0.4, M.black);
        at(coil, cx, by, zc + 0.15);
        coil.userData.pick = { kind: 'comp', part: S };
        m.root.add(coil);
        m.picks.push(coil);
        m.root.add(at(rb(w - 0.7, 1.6, 1.3, 0.25, hy ? M.aluDark : M.dark), cx, by + 0.2, top + 0.85));
        m.root.add(at(cylZ(0.32, 0.4, M.yellow, 14), cx + side * (w / 2 - 0.55), by - bh / 2 + 0.55, top + 0.42));
        const led = sph(0.3, M.ledOff, 14);
        at(led, cx, by + 0.2, top + 1.55);
        const gl = glow(0xff3030, 3.2);
        gl.position.copy(led.position);
        m.root.add(led, gl);
        leds[S] = { led, gl };
        const k = side < 0 ? 'S14' : 'S12';
        jack(m, k + 'a', cx - 0.65, by + bh / 2 + 1.75, 1.0, 'red');
        jack(m, k + 'b', cx + 0.65, by + bh / 2 + 1.75, 1.0, 'black');
      } else if (a.t === 'spring') {
        m.root.add(at(cylX(1.05, w - 0.25, M.aluAnod, 24), cx, by, zc));
        m.root.add(at(cylX(1.15, 0.3, M.aluDark, 24), cx + side * (w / 2 - 0.4), by, zc));
      } else if (a.t === 'push') {
        m.root.add(at(cylX(0.45, w, M.steel, 14), cx, by, zc));
        const cp = new THREE.Group();
        cp.add(cylX(1.25, 0.9, hy ? M.red : M.green, 28));
        const rim = torusZ(1.0, 0.18, hy ? M.red : M.green);
        rim.rotation.y = Math.PI / 2;
        cp.add(rim);
        cp.position.set(e + side * (o + w - 0.2), by, zc);
        cp.traverse((q) => { if (q.isMesh) { q.userData.pick = { kind: 'comp', part: S }; m.picks.push(q); } });
        m.root.add(cp);
        caps[S] = { mesh: cp, x0: cp.position.x, side };
      } else if (a.t === 'lever' || a.t === 'lever_det') {
        const piv = new THREE.Group();
        piv.position.set(cx, by, top - 0.2);
        piv.add(cylZ(0.6, 0.8, M.aluDark, 16));
        const arm = cylY(0.26, hy ? 7 : 4.6, M.steel, 12);
        arm.position.y = hy ? 3.5 : 2.3;
        const ball = sph(hy ? 0.95 : 0.75, M.red, 24);
        ball.position.y = hy ? 7.3 : 4.75;
        piv.add(arm, ball);
        arm.userData.pick = ball.userData.pick = { kind: 'comp', part: S };
        m.picks.push(arm, ball);
        piv.rotation.x = 1.15;
        m.root.add(piv);
        (m.levers = m.levers || []).push(piv);
      } else if (a.t === 'roller') {
        m.root.add(at(rb(0.45, 2.9, 0.45, 0.1, M.steel), cx, by + 1.4, zc));
        const wh = cylZ(0.85, 0.65, M.dark, 24);
        at(wh, cx, by + 2.9, zc);
        wh.userData.pick = { kind: 'comp', part: 'L' };
        m.root.add(wh);
        m.picks.push(wh);
        m.roller = { wh, y0: wh.position.y };
      } else if (a.t === 'pilot') {
        const pid = side < 0 ? spec.pilotL : spec.pilotR;
        m.root.add(at(rb(w - 0.2, 2, 2, 0.3, hy ? M.bodyHy : M.body), cx, by, zc));
        fitting(m, hy ? 'hy' : 'pn', pid, cx, by + 0.2, zc + 1.0, V3(side * 0.7, 0, 1), pid);
      }
      o += w;
    }
  };
  build(spec.L, -1);
  build(spec.R, 1);
  m.update = (st) => {
    const pos = st ? st.pos : spec.rest;
    ind.forEach((im, i) => { im.material = i === pos ? M.ledYOn : M.indOff; });
    for (const s of ['L', 'R']) if (leds[s]) { const on = !!(st && (s === 'L' ? st.actL : st.actR)); leds[s].led.material = on ? M.ledOn : M.ledOff; leds[s].gl.visible = on; }
    for (const s of ['L', 'R']) if (caps[s]) caps[s].mesh.position.x = caps[s].x0 - caps[s].side * (st && st.man[s] ? 0.55 : 0);
    if (m.levers) for (const lv of m.levers) lv.rotation.z = (n === 2 ? (pos === 0 ? 1 : -1) : 1 - pos) * 0.38;
    if (m.roller) m.roller.wh.position.y = m.roller.y0 - (st && st.actL ? 0.55 : 0);
  };
  m.update(null);
  return finish(m);
}

/* ---------------- 소형 부품 (2D 포트 배치를 3D로) ---------------- */
function genericModel(c, d) {
  const m = newModel(c);
  const hy = d.dom === 'hy';
  const t = c.type;
  const ps = d.ports(c);
  const [x0, y0, x1, y1] = d.bbox(c);
  const s = 0.11;
  const W = Math.max(8, (x1 - x0) * s + 3.2), H = Math.max(8.5, (y1 - y0) * s + 5.2);
  m.size = [W, H];
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const LH = 2.3;
  const oy = LH / 2 + 0.2;
  const P = (p) => [(p.x - cx) * s * 0.85, -(p.y - cy) * s * 0.85 + oy];
  const nm = d.name.replace(/\s*\(.*\)/, '');
  plateMesh(m, W, H, hy, c.props.tag ? `${c.props.tag}` : nm, c.props.tag ? nm : '', t, ps.map((p) => { const [x, y] = P(p); return [x, y + (y >= oy ? 1.5 : -1.35), p.lab ?? '']; }));
  const isGauge = t.endsWith('_gauge');
  const bw = W - 3.2, bh = H - LH - 3.4, bz = hy ? 2.8 : 2.3;
  const body = rb(bw, bh, bz, 0.45, hy ? M.bodyHy : isGauge ? M.aluAnod : M.bodyBlue);
  at(body, 0, oy, 1.0 + bz / 2);
  m.root.add(body);
  m.body.push(body);
  const top = 1.0 + bz;
  const dirOf = (dd) => (dd === 'up' ? V3(0, 0.65, 1) : dd === 'down' ? V3(0, -0.65, 1) : dd === 'left' ? V3(-0.65, 0, 1) : dd === 'right' ? V3(0.65, 0, 1) : V3(0, 0, 1));
  for (const p of ps) {
    const [x, y] = P(p);
    fitting(m, hy ? 'hy' : 'pn', p.id, Math.max(-bw / 2 + 0.8, Math.min(bw / 2 - 0.8, x)), Math.max(oy - bh / 2 + 0.8, Math.min(oy + bh / 2 - 0.8, y)), top, dirOf(p.dir), p.lab);
  }
  if (/throttle|flow_oneway|fcv|relief|reducing|sequence/.test(t)) {
    const k = new THREE.Group();
    const big = /relief|reducing|sequence/.test(t);
    const R = big ? 1.4 : 1.15;
    k.add(cylZ(R, 1.1, M.knobT, 32));
    for (let i = 0; i < 16; i++) { const rib = box(0.18, 0.18, 1.0, M.dark); const a = (i / 16) * Math.PI * 2; rib.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); k.add(rib); }
    const mark = box(0.22, big ? 1.1 : 0.9, 0.1, M.white);
    mark.position.set(0, 0.45, 0.58);
    k.add(mark);
    k.position.set(0, oy, top + 0.6 + (big ? 0.8 : 0));
    if (big) m.root.add(at(cylZ(0.8, 0.9, M.steel, 20), 0, oy, top + 0.4));
    m.root.add(k);
    m.knob = k;
  }
  if (isGauge || t.endsWith('_pswitch')) {
    const gz = top + 1.2;
    const ring = cylZ(2.15, 1.3, M.chrome, 40);
    ring.position.set(0, oy + 0.4, gz);
    const dial = texPlane(3.9, 3.9, () => {}, 64);
    dial.position.set(0, oy + 0.4, gz + 0.66);
    const gl = cylZ(1.98, 0.08, M.glass, 40);
    gl.position.set(0, oy + 0.4, gz + 0.75);
    m.root.add(ring, dial, gl);
    m.dial = dial;
    m.dialMax = hy ? 100 : 10;
    m.lastP = null;
  }
  if (t.endsWith('_pswitch')) {
    jack(m, 'C', -W / 2 + 1.2, H / 2 - 1.3, 1.0, 'black');
    jack(m, 'NO', -W / 2 + 2.5, H / 2 - 1.3, 1.0, 'red');
    jack(m, 'NC', -W / 2 + 3.8, H / 2 - 1.3, 1.0, 'blue');
    m.led = sph(0.3, M.ledOff, 14);
    m.led.position.set(W / 2 - 1.2, H / 2 - 1.3, 1.25);
    m.gl = glow(0xffcc33, 2.8);
    m.gl.position.copy(m.led.position);
    m.root.add(m.led, m.gl);
  }
  if (t === 'h_accumulator') { m.root.add(at(cylY(1.8, 5, M.red, 32), 0, oy + 1, top + 2.2), at(sph(1.8, M.red), 0, oy + 3.5, top + 2.2)); }
  m.update = (st, sim) => {
    if (m.knob && c.props.open != null) m.knob.rotation.z = -(+c.props.open / 100) * Math.PI * 1.5;
    if (m.knob && t === 'h_fcv') m.knob.rotation.z = -(+c.props.q / 20) * Math.PI;
    if (m.knob && /relief|reducing|sequence/.test(t)) m.knob.rotation.z = -(+c.props.p / 100) * Math.PI;
    if (m.dial) {
      const p = sim ? sim.pAt(c, '1') : 0;
      const pr = Math.round(p * 10) / 10;
      if (pr !== m.lastP) { m.lastP = pr; drawDial(m.dial, pr, m.dialMax, t.endsWith('_pswitch') ? +c.props.p : null); }
    }
    if (m.led) { const on = !!(sim && st && st.on); m.led.material = on ? M.ledOn : M.ledOff; m.gl.visible = on; }
  };
  m.update(null, null);
  return finish(m);
}

function drawDial(mesh, p, pmax, setp) {
  redraw(mesh, (g, W, H) => {
    const cx = W / 2, cy = H / 2, r = W * 0.48;
    g.clearRect(0, 0, W, H);
    const bg = g.createRadialGradient(cx, cy * 0.8, r * 0.1, cx, cy, r);
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#e9ecef');
    g.fillStyle = bg;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(220,40,40,.65)'; g.lineWidth = W * 0.03;
    g.beginPath(); g.arc(cx, cy, r * 0.8, (-225 + 270 * 0.85) * Math.PI / 180, 45 * Math.PI / 180); g.stroke();
    g.strokeStyle = '#2b2f35';
    g.fillStyle = '#2b2f35';
    g.font = FONT(Math.round(W * 0.08), 600);
    g.textAlign = 'center';
    for (let i = 0; i <= 50; i++) {
      const a = (-225 + 5.4 * i) * (Math.PI / 180);
      const big = i % 10 === 0, mid = i % 5 === 0;
      g.lineWidth = big ? W * 0.012 : W * 0.006;
      const r1 = r * 0.9, r2 = r * (big ? 0.72 : mid ? 0.78 : 0.83);
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); g.stroke();
      if (big) g.fillText(String((pmax * i) / 50), cx + Math.cos(a) * r * 0.56, cy + Math.sin(a) * r * 0.56 + W * 0.03);
    }
    g.font = FONT(Math.round(W * 0.075), 700);
    g.fillText('bar', cx, cy - r * 0.28);
    g.font = FONT(Math.round(W * 0.1), 700);
    g.fillStyle = '#0b5bd3';
    g.fillText(p.toFixed(pmax > 20 ? 0 : 1), cx, cy + r * 0.6);
    if (setp != null) {
      const a = (-225 + 270 * Math.min(1, setp / pmax)) * (Math.PI / 180);
      g.strokeStyle = '#1e88e5'; g.lineWidth = W * 0.025;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62); g.lineTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92); g.stroke();
    }
    const a = (-225 + 270 * Math.max(0, Math.min(1.04, p / pmax))) * (Math.PI / 180);
    g.strokeStyle = '#d61f1f'; g.lineWidth = W * 0.022; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - Math.cos(a) * r * 0.12, cy - Math.sin(a) * r * 0.12); g.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8); g.stroke();
    g.fillStyle = '#1b1d20'; g.beginPath(); g.arc(cx, cy, W * 0.045, 0, Math.PI * 2); g.fill();
  });
}

/* ---------------- 모터 ---------------- */
function motorModel(c, d) {
  const m = newModel(c);
  const hy = d.dom === 'hy';
  m.size = [12, 14];
  plateMesh(m, 12, 14, hy, c.props.tag, d.name.replace(/\s*\(.*\)/, ''), c.type, [[-2.4, 5.3, 'A'], [2.4, 5.3, 'B']]);
  const b = cylZ(3.6, 3.6, hy ? M.bodyHy : M.bodyBlue, 40);
  b.position.set(0, 1.6, 2.9);
  m.root.add(b, at(cylZ(3.75, 0.5, M.aluAnod, 40), 0, 1.6, 4.6));
  m.body.push(b);
  const sh = new THREE.Group();
  sh.position.set(0, 1.6, 5.0);
  sh.add(cylZ(0.5, 1.3, M.chrome, 16));
  const disc = cylZ(2.6, 0.5, M.white, 40);
  disc.position.z = 0.75;
  sh.add(disc);
  for (let i = 0; i < 2; i++) { const mk = box(0.7, 2.3, 0.1, i ? M.dark : M.red); mk.position.set(0, i ? -1.1 : 1.1, 1.03); sh.add(mk); }
  m.root.add(sh);
  fitting(m, hy ? 'hy' : 'pn', 'A', -2.4, 4.4, 1.2, V3(-0.3, 0.7, 1), 'A');
  fitting(m, hy ? 'hy' : 'pn', 'B', 2.4, 4.4, 1.2, V3(0.3, 0.7, 1), 'B');
  m.update = (st) => { sh.rotation.z = st ? -st.ang : 0; };
  return finish(m);
}

/* ---------------- 분기 티 ---------------- */
function teeModel(c) {
  const m = newModel(c);
  const hy = c.type.startsWith('h_');
  m.size = [4.5, 4.5];
  const b = rb(2.4, 2.4, 1.8, 0.4, hy ? M.steel : M.fitWhite);
  b.position.z = 1.5;
  m.root.add(b, at(cylZ(0.5, 1.2, M.knobT, 12), 0, 0, 0.6));
  m.body.push(b);
  fitting(m, hy ? 'hy' : 'pn', 'a', -1.2, 0, 1.5, V3(-1, 0, 0.35));
  fitting(m, hy ? 'hy' : 'pn', 'b', 1.2, 0, 1.5, V3(1, 0, 0.35));
  fitting(m, hy ? 'hy' : 'pn', 'c', 0, -1.2, 1.5, V3(0, -1, 0.35));
  return finish(m);
}

/* ---------------- 실린더 부착 센서 ---------------- */
function tagPlate(text, w = 2.6) {
  return texPlane(w, 0.8, (g, W, H, s) => { g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.fillStyle = '#111'; g.font = FONT(Math.round(s * 0.55)); g.textAlign = 'center'; g.fillText(text, W / 2, H * 0.75); }, 50);
}
function sensorModel(c) {
  const m = newModel(c);
  m.size = [3, 3];
  if (c.type === 's3_reed') {
    const b = rb(2.6, 0.8, 0.8, 0.2, M.black);
    b.position.z = 0.4;
    m.root.add(b);
    m.body.push(b);
    m.led = sph(0.2, M.ledOff, 12);
    m.led.position.set(0.9, 0, 0.85);
    m.gl = glow(0xff3030, 1.8);
    m.gl.position.copy(m.led.position);
    m.root.add(m.led, m.gl);
    m.root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(-1.3, 0, 0.4), V3(-2.2, 0.6, 0.6), V3(-2.0, 2.4, 0.9), V3(-0.8, 3.0, 1.0)]), 16, 0.16, 6), M.dark));
    const blk = rb(3.0, 1.7, 0.9, 0.25, M.dark);
    blk.position.set(0.4, 3.0, 0.9);
    m.root.add(blk);
    m.body.push(blk);
    jack(m, 'a', -0.2, 3.0, 1.35, 'red');
    jack(m, 'b', 1.1, 3.0, 1.35, 'black');
    const lab = tagPlate(c.props.tag);
    lab.position.set(0.4, 4.35, 0.95);
    m.root.add(lab);
  } else {
    const b = rb(3.2, 2.4, 2.0, 0.35, M.body);
    b.position.z = 1.0;
    m.root.add(b);
    m.body.push(b);
    const arm = new THREE.Group();
    arm.position.set(0, 1.2, 1.0);
    arm.add(at(rb(0.4, 2.4, 0.4, 0.1, M.steel), 0, 1.2, 0), at(cylZ(0.62, 0.55, M.dark, 20), 0, 2.4, 0));
    m.root.add(arm);
    m.arm = arm;
    m.led = sph(0.24, M.ledOff, 12);
    m.led.position.set(1.15, -0.75, 2.05);
    m.gl = glow(0xff3030, 1.8);
    m.gl.position.copy(m.led.position);
    m.root.add(m.led, m.gl);
    jack(m, 'C', -1.0, -0.55, 2.0, 'black');
    jack(m, 'NO', 0.1, -0.55, 2.0, 'red');
    jack(m, 'NC', 0.1, 0.5, 2.0, 'blue');
    const lab = tagPlate(c.props.tag, 2.8);
    lab.position.set(0, -1.65, 1.2);
    m.root.add(lab);
  }
  m.update = (st, sim) => {
    const on = !!(sim && st && (st.att || st.man));
    m.led.material = on ? M.ledOn : M.ledOff;
    m.gl.visible = on;
    if (m.arm) m.arm.rotation.z = on ? 0.45 : 0;
  };
  return finish(m);
}

/* ---------------- 공압 공급 유닛 ---------------- */
function pSupplyModel(c) {
  const m = newModel(c);
  m.size = [17, 36];
  plateMesh(m, 17, 36, false, '공압 공급 유닛', 'FRL + 8구 분배기', 'p_frl');
  const frl = new THREE.Group();
  frl.position.set(-3, 7, 1.0);
  frl.add(at(rb(5.2, 5.6, 5.2, 0.6, M.body), 0, 4.5, 3.4));
  frl.add(at(rb(5.6, 1.2, 5.6, 0.3, M.aluAnod), 0, 1.4, 3.4));
  frl.add(at(cylY(1.9, 5.6, M.bowl, 32, 1.5), 0, -1.9, 3.4));
  frl.add(at(cylY(1.2, 3.2, M.glass, 20), 0, -1.5, 3.4));
  frl.add(at(cylY(0.6, 1.2, M.steel, 16), 0, -5.3, 3.4));
  const knob = new THREE.Group();
  knob.add(cylY(1.5, 1.6, M.knobT, 32));
  for (let i = 0; i < 12; i++) { const r = box(0.25, 1.5, 0.25, M.dark); const a = (i / 12) * Math.PI * 2; r.position.set(Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5); knob.add(r); }
  knob.position.set(0, 8.1, 3.4);
  frl.add(knob);
  const dial = texPlane(4.1, 4.1, () => {}, 64);
  dial.position.set(4.9, 4.5, 4.52);
  frl.add(at(cylZ(2.3, 1.2, M.chrome, 40), 4.9, 4.5, 3.9), dial, at(cylZ(2.15, 0.08, M.glass, 40), 4.9, 4.5, 4.6), at(cylX(0.6, 2.4, M.steel, 12), 2.6, 4.5, 3.4));
  m.dial = dial;
  frl.add(at(cylX(0.85, 3.4, M.aluAnod, 16), -4.2, 4.5, 3.4));
  m.root.add(frl);
  m.root.add(at(rb(2.6, 2.6, 2.6, 0.4, M.brass), -3, -4.8, 2.3));
  const lever = rb(4.6, 0.8, 0.6, 0.25, M.red);
  lever.position.set(-3, -4.8, 3.95);
  lever.userData.pick = { kind: 'comp', part: 0 };
  m.root.add(lever);
  m.picks.push(lever);
  const man = rb(4.4, 23.5, 3.2, 0.5, M.aluAnod);
  man.position.set(5.0, 0, 2.6);
  m.root.add(man);
  m.body.push(man);
  for (let i = 0; i < 8; i++) fitting(m, 'pn', 'o' + (i + 1), 5.0, 9.6 - i * 2.75, 4.2, V3(0.75, 0, 1), '');
  m.root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(-7.4, 11.5, 4.4), V3(-10, 11, 5), V3(-12.5, 4, 8), V3(-12, -18, 9)]), 30, 0.42, 10), M.fitBlue));
  m.lastP = null;
  m.update = (st, sim) => {
    const p = sim ? (st && st.on ? +c.props.p : 0) : 0;
    if (p !== m.lastP) { m.lastP = p; drawDial(dial, p, 10); }
    lever.rotation.z = st && !st.on ? Math.PI / 2 : 0;
  };
  m.update(null, null);
  return finish(m);
}

/* ---------------- 유압 파워유닛 ---------------- */
function hSupplyModel(c) {
  const m = newModel(c);
  m.size = [15, 32];
  plateMesh(m, 15, 32, true, 'P / T 분배 블록', '파워유닛 연결', null, [[-3.2, 14, 'P'], [3.2, 14, 'T']]);
  const pb = rb(3.8, 21, 3.2, 0.4, M.steel);
  pb.position.set(-3.2, 1.6, 2.6);
  const tb = rb(3.8, 21, 3.2, 0.4, M.aluDark);
  tb.position.set(3.2, 1.6, 2.6);
  m.root.add(pb, tb);
  m.body.push(pb, tb);
  for (let i = 0; i < 4; i++) {
    fitting(m, 'hy', 'p' + (i + 1), -3.2, 9.4 - i * 4.6, 4.2, V3(-0.4, 0, 1), 'P');
    fitting(m, 'hy', 't' + (i + 1), 3.2, 9.4 - i * 4.6, 4.2, V3(0.4, 0, 1), 'T');
  }
  const unit = new THREE.Group();
  unit.add(at(rb(40, 26, 30, 1.6, M.tank), 0, 13, 0), at(rb(42, 2, 32, 0.6, M.aluDark), 0, 27, 0), at(cylY(2.2, 2.5, M.dark, 20), 12, 29, 8));
  unit.add(at(rb(1.6, 10, 0.4, 0.3, M.glass), -15, 12, 15.1), at(box(1.2, 5, 0.3, new THREE.MeshStandardMaterial({ color: 0xd9a400, transparent: true, opacity: 0.8 })), -15, 10, 15.2));
  unit.add(at(cylX(6.2, 16, M.motor, 40), -8, 36, 0));
  for (let i = 0; i < 10; i++) { const f = box(15, 0.4, 13.5, M.motor); f.position.set(-8, 36, 0); f.rotation.x = (i / 10) * Math.PI; unit.add(f); }
  unit.add(at(rb(9, 8, 11, 0.8, M.motor), -8, 31, 0), at(cylX(4.8, 6, M.aluAnod, 32), 3, 36, 0), at(cylX(3.8, 6, M.steel, 28), 9, 36, 0));
  const fan = new THREE.Group();
  fan.position.set(-16.6, 36, 0);
  for (let i = 0; i < 3; i++) { const bl = rb(0.6, 9, 2, 0.2, M.dark); bl.rotation.x = (i / 3) * Math.PI; fan.add(bl); }
  unit.add(fan);
  unit.add(at(rb(15, 11, 1.2, 0.4, M.white), 9, 16, 15.6));
  const btn = cylZ(1.6, 1.4, M.green, 28);
  btn.position.set(5, 14, 16.6);
  btn.userData.pick = { kind: 'comp', part: 0 };
  unit.add(btn);
  m.picks.push(btn);
  const lamp = sph(1.0, M.ledGOff, 20);
  lamp.position.set(5, 18.5, 16.4);
  const lampG = glow(0x40ff80, 6);
  lampG.position.copy(lamp.position);
  unit.add(lamp, lampG, at(cylZ(3.2, 1.3, M.chrome, 40), 12, 15.5, 16.6));
  const dial = texPlane(5.9, 5.9, () => {}, 48);
  dial.position.set(12, 15.5, 17.3);
  unit.add(dial);
  const lab = texPlane(20, 3, (g, W, H, s) => { g.fillStyle = '#132235'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.font = FONT(Math.round(s * 1.45)); g.textAlign = 'center'; g.fillText('유압 파워유닛', W / 2, H * 0.72); }, 24);
  lab.position.set(-8, 21, 15.12);
  unit.add(lab);
  m.unit = unit;
  m.unitPorts = { P: V3(9, 40, 0), T: V3(-14, 28.5, 8) };
  shadow(unit);
  m.lastP = null;
  m.update = (st, sim) => {
    const on = !!(sim && st && st.on);
    lamp.material = on ? M.ledGOn : M.ledGOff;
    lampG.visible = on;
    if (on) fan.rotation.x += 0.5;
    const p = sim ? sim.pAt(c, 'p1') : 0;
    const pr = Math.round(p);
    if (pr !== m.lastP) { m.lastP = pr; drawDial(dial, pr, Math.max(100, Math.ceil((+c.props.p * 1.4) / 50) * 50)); }
  };
  m.update(null, null);
  return finish(m);
}

/* ---------------- 전기 모듈 (랙) ---------------- */
export const MOD_W = 16, MOD_H = 30;
const BTN_COL = [['green', 'red', 'yellow'], ['green', 'red', 'blue']];
const PP = 40;
function faceplate(m, title, draw) {
  const frame = rb(MOD_W, MOD_H, 1.2, 0.35, M.aluAnod);
  frame.position.z = -0.1;
  m.root.add(frame);
  const fp = texPlane(MOD_W - 0.5, MOD_H - 0.5, (g, W, H, s) => {
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#f4f6f8'); bg.addColorStop(1, '#e3e7ec');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#16314f';
    g.fillRect(0, 0, W, s * 2.0);
    g.fillStyle = '#ffffff';
    g.font = FONT(Math.round(s * 0.85));
    g.textAlign = 'center';
    g.fillText(title, W / 2, s * 1.35);
    g.fillStyle = '#8c97a3';
    g.font = FONT(Math.round(s * 0.42), 600);
    g.fillText('HP-TRAINER  DC24V', W / 2, H - s * 0.4);
    g.textAlign = 'center';
    draw(g, s);
  }, PP);
  fp.position.z = 0.52;
  m.root.add(fp);
  for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) m.root.add(at(cylZ(0.32, 0.25, M.steel, 12), sx * (MOD_W / 2 - 0.55), sy * (MOD_H / 2 - 0.55), 0.6));
  m.body.push(frame, fp);
}
const P2 = (x, y) => [x - MOD_W / 2, MOD_H / 2 - y];
const txt = (g, s, t, x, y, px = 0.62, col = '#25303c', w = 700) => { g.fillStyle = col; g.font = FONT(Math.round(s * Math.max(px, 0.5) * 1.08), Math.max(w, 700)); g.fillText(t, (x - 0.25) * s, (y - 0.25) * s); };
function symNO(g, s, x, y) { const X = (x - 0.25) * s, Y = (y - 0.25) * s; g.strokeStyle = '#2a333d'; g.lineWidth = s * 0.11; g.beginPath(); g.moveTo(X, Y - s * 0.8); g.lineTo(X, Y - s * 0.35); g.moveTo(X, Y + s * 0.8); g.lineTo(X, Y + s * 0.35); g.lineTo(X - s * 0.5, Y - s * 0.45); g.stroke(); }
function symNC(g, s, x, y) { const X = (x - 0.25) * s, Y = (y - 0.25) * s; g.strokeStyle = '#2a333d'; g.lineWidth = s * 0.11; g.beginPath(); g.moveTo(X, Y - s * 0.8); g.lineTo(X, Y - s * 0.35); g.lineTo(X + s * 0.45, Y - s * 0.35); g.moveTo(X, Y + s * 0.8); g.lineTo(X, Y + s * 0.35); g.lineTo(X + s * 0.45, Y - s * 0.5); g.stroke(); }
function symCoil(g, s, x, y) { g.strokeStyle = '#2a333d'; g.lineWidth = s * 0.11; g.strokeRect((x - 0.25 - 0.5) * s, (y - 0.25 - 0.35) * s, s, s * 0.7); }
function lcd(m, x, y, w, h) {
  const [lx, ly] = P2(x, y);
  m.root.add(at(rb(w + 0.5, h + 0.5, 0.5, 0.15, M.dark), lx, ly, 0.6));
  const p = texPlane(w, h, (g, W, H) => { g.fillStyle = '#0a1a10'; g.fillRect(0, 0, W, H); }, 40);
  p.material.emissive = new THREE.Color(0xffffff);
  p.material.emissiveMap = p.material.map;
  p.material.emissiveIntensity = 0;
  p.position.set(lx, ly, 0.87);
  m.root.add(p);
  return p;
}
function lcdText(p, t, col = '#5dff8a', on = true) {
  const k = t + col + on;
  if (p.userData.last === k) return;
  p.userData.last = k;
  p.material.emissiveIntensity = on ? 0.9 : 0;
  redraw(p, (g, W, H) => { g.fillStyle = on ? '#071309' : '#0c120e'; g.fillRect(0, 0, W, H); if (!on) return; g.fillStyle = col; g.font = `700 ${Math.round(H * 0.6)}px ui-monospace, Consolas, monospace`; g.textAlign = 'center'; g.fillText(t, W / 2, H * 0.76); });
}
function button3d(m, x, y, color, part, r = 1.35) {
  const [lx, ly] = P2(x, y);
  m.root.add(at(torusZ(r + 0.35, 0.28, M.chrome), lx, ly, 0.8), at(cylZ(r + 0.3, 0.6, M.dark, 32), lx, ly, 0.75));
  const b = new THREE.Group();
  b.position.set(lx, ly, 1.35);
  b.add(cylZ(r, 0.9, M[color], 36));
  const top = dome(r * 0.98, M[color]);
  top.rotation.x = Math.PI / 2;
  top.scale.set(1, 1, 0.25);
  top.position.z = 0.45;
  b.add(top);
  b.traverse((q) => { if (q.isMesh) { q.userData.pick = { kind: 'comp', part }; m.picks.push(q); } });
  m.root.add(b);
  return b;
}
function led3d(m, x, y, col = 0xff3030, onMat = 'ledOn', offMat = 'ledOff') {
  const [lx, ly] = P2(x, y);
  m.root.add(at(cylZ(0.5, 0.3, M.steel, 16), lx, ly, 0.65));
  const l = sph(0.38, M[offMat], 16);
  l.position.set(lx, ly, 0.85);
  const gl = glow(col, 3.2);
  gl.position.set(lx, ly, 1.1);
  m.root.add(l, gl);
  return { set(on) { l.material = on ? M[onMat] : M[offMat]; gl.visible = on; } };
}

function moduleModel(c) {
  const m = newModel(c);
  m.size = [MOD_W, MOD_H];
  const J = (pid, x, y, col) => { const [lx, ly] = P2(x, y); jack(m, pid, lx, ly, 0.5, col); };
  const t = c.type;
  if (t === 'm_psu') {
    faceplate(m, 'DC 24V 전원', (g, s) => {
      txt(g, s, 'POWER', 4.5, 12.0, 0.5);
      txt(g, s, '+24V', 4.5, 14.6, 0.72, '#c62828');
      txt(g, s, '0V', 11.5, 14.6, 0.72, '#1e4fc2');
      g.lineWidth = s * 0.06;
      g.strokeStyle = '#c62828'; g.strokeRect(2.2 * s, 15.0 * s, 4.2 * s, 12.6 * s);
      g.strokeStyle = '#1e4fc2'; g.strokeRect(9.2 * s, 15.0 * s, 4.2 * s, 12.6 * s);
    });
    m.lcd = lcd(m, 8, 5.6, 10, 3);
    m.led = led3d(m, 11.5, 10.6, 0x40ff80, 'ledGOn', 'ledGOff');
    const [sx, sy] = P2(4.5, 10.2);
    m.root.add(at(rb(2.2, 1.4, 0.6, 0.2, M.dark), sx, sy, 0.75));
    m.sw = at(rb(0.9, 1.0, 0.6, 0.15, M.red), sx, sy, 1.2);
    m.root.add(m.sw);
    for (let i = 0; i < 4; i++) { J('P' + i, 4.5, 16.8 + i * 3.1, 'red'); J('N' + i, 11.5, 16.8 + i * 3.1, 'blue'); }
    m.update = (st, sim) => { lcdText(m.lcd, '24.0V', '#5dff8a', !!sim); m.led.set(!!sim); m.sw.rotation.x = sim ? -0.4 : 0.4; };
  } else if (t === 'm_pb') {
    const base = +c.props.base;
    const cols = BTN_COL[base > 1 ? 1 : 0];
    faceplate(m, `푸시버튼 PB${base}~${base + 2}`, (g, s) => {
      for (let i = 0; i < 3; i++) {
        const y = 6.6 + i * 8;
        txt(g, s, 'PB' + (base + i), 3.7, y + 3.7, 0.62);
        txt(g, s, 'a', 9, y - 2.4, 0.55, '#c62828');
        txt(g, s, 'b', 13, y - 2.4, 0.55, '#1e4fc2');
        symNO(g, s, 10.3, y);
        symNC(g, s, 14.3, y);
      }
    });
    m.btns = [0, 1, 2].map((i) => button3d(m, 3.7, 6.6 + i * 8, cols[i], i));
    for (let i = 0; i < 3; i++) {
      const y = 6.6 + i * 8;
      J(`${i}NOa`, 9, y - 1.5, 'red'); J(`${i}NOb`, 9, y + 1.6, 'red');
      J(`${i}NCa`, 13, y - 1.5, 'blue'); J(`${i}NCb`, 13, y + 1.6, 'blue');
    }
    m.update = (st, sim) => m.btns.forEach((b, i) => { b.position.z = sim && sim.btn.get('PB' + (base + i)) ? 0.95 : 1.35; });
  } else if (t === 'm_sel') {
    faceplate(m, '비상정지 · 셀렉터', (g, s) => {
      txt(g, s, '비상정지 EMG', 5, 12.8, 0.48, '#c62828');
      txt(g, s, 'b', 11, 4.4, 0.55, '#1e4fc2'); txt(g, s, 'a', 14, 4.4, 0.55, '#c62828');
      txt(g, s, 'SS1', 5, 24.8, 0.6);
      txt(g, s, 'OFF', 3.2, 16.4, 0.42, '#56606b', 600); txt(g, s, 'ON', 7.0, 16.4, 0.42, '#56606b', 600);
      txt(g, s, 'a', 11, 16.4, 0.55, '#c62828'); txt(g, s, 'b', 14, 16.4, 0.55, '#1e4fc2');
    });
    const [ex, ey] = P2(5, 7.6);
    m.root.add(at(cylZ(3.0, 0.5, M.yellow, 40), ex, ey, 0.75));
    const mush = new THREE.Group();
    mush.position.set(ex, ey, 1.0);
    mush.add(cylZ(1.0, 1.4, M.dark, 20));
    const head = dome(2.3, M.red);
    head.rotation.x = Math.PI / 2;
    head.scale.set(1, 1, 0.6);
    head.position.z = 0.8;
    mush.add(head);
    mush.traverse((q) => { if (q.isMesh) { q.userData.pick = { kind: 'comp', part: 0 }; m.picks.push(q); } });
    m.root.add(mush);
    const [sx, sy] = P2(5, 19.6);
    m.root.add(at(cylZ(2.1, 0.6, M.chrome, 32), sx, sy, 0.7));
    const knob = new THREE.Group();
    knob.position.set(sx, sy, 1.2);
    knob.add(cylZ(1.8, 0.8, M.dark, 32), at(rb(0.9, 3.4, 1.1, 0.3, M.dark), 0, 0, 0.6), at(box(0.25, 1.2, 0.05, M.white), 0, 1.0, 1.18));
    knob.traverse((q) => { if (q.isMesh) { q.userData.pick = { kind: 'comp', part: 1 }; m.picks.push(q); } });
    m.root.add(knob);
    J('ENCa', 11, 5.9, 'blue'); J('ENCb', 11, 9.2, 'blue'); J('ENOa', 14, 5.9, 'red'); J('ENOb', 14, 9.2, 'red');
    J('SNOa', 11, 17.9, 'red'); J('SNOb', 11, 21.2, 'red'); J('SNCa', 14, 17.9, 'blue'); J('SNCb', 14, 21.2, 'blue');
    m.update = (st, sim) => {
      mush.position.z = sim && sim.sw.get('EMG') ? 0.45 : 1.0;
      knob.rotation.z = sim && sim.sw.get('SS1') ? -0.7 : 0.7;
    };
  } else if (t === 'm_relay') {
    const base = +c.props.base;
    faceplate(m, `릴레이 R${base}~R${base + 2}`, (g, s) => {
      for (let i = 0; i < 3; i++) {
        const x = 2.95 + i * 5.05;
        txt(g, s, 'R' + (base + i), x - 0.4, 4.3, 0.72);
        symCoil(g, s, x, 7.1);
        txt(g, s, 'A1', x - 1.6, 7.35, 0.38, '#56606b', 600); txt(g, s, 'A2', x + 1.6, 7.35, 0.38, '#56606b', 600);
        for (let j = 0; j < 4; j++) {
          const y = 12.4 + j * 4.15;
          txt(g, s, 'C', x - 1.6, y - 1.15, 0.38, '#3a4450', 700); txt(g, s, 'NO', x, y - 1.15, 0.38, '#c62828', 700); txt(g, s, 'NC', x + 1.6, y - 1.15, 0.38, '#1e4fc2', 700);
        }
        if (i) { g.strokeStyle = '#c9d1da'; g.lineWidth = s * 0.05; g.beginPath(); g.moveTo((x - 2.75) * s, 3 * s); g.lineTo((x - 2.75) * s, 28 * s); g.stroke(); }
      }
    });
    m.leds = [];
    for (let i = 0; i < 3; i++) {
      const x = 2.95 + i * 5.05;
      m.leds.push(led3d(m, x + 1.6, 3.9));
      J(`${i}A1`, x - 0.9, 9.2, 'red'); J(`${i}A2`, x + 0.9, 9.2, 'blue');
      for (let j = 1; j <= 4; j++) {
        const y = 12.4 + (j - 1) * 4.15 + 0.65;
        J(`${i}C${j}`, x - 1.6, y, 'black'); J(`${i}NO${j}`, x, y, 'red'); J(`${i}NC${j}`, x + 1.6, y, 'blue');
      }
    }
    m.update = (st, sim) => m.leds.forEach((l, i) => l.set(!!(sim && sim.relay.get('R' + (base + i)))));
  } else if (t === 'm_timer') {
    faceplate(m, '타이머 T1 · T2', (g, s) => {
      for (let i = 0; i < 2; i++) {
        const x = 4.3 + i * 7.4;
        txt(g, s, 'T' + (i + 1), x - 0.6, 4.3, 0.75);
        symCoil(g, s, x, 11.2);
        txt(g, s, 'A1', x - 1.9, 11.45, 0.38, '#56606b', 600); txt(g, s, 'A2', x + 1.9, 11.45, 0.38, '#56606b', 600);
        for (let j = 0; j < 2; j++) { const y = 17 + j * 4.6; txt(g, s, 'C', x - 1.7, y - 1.15, 0.38, '#3a4450', 700); txt(g, s, 'NO', x, y - 1.15, 0.38, '#c62828', 700); txt(g, s, 'NC', x + 1.7, y - 1.15, 0.38, '#1e4fc2', 700); }
      }
    });
    m.lcds = [lcd(m, 4.3, 7.4, 6.2, 2.4), lcd(m, 11.7, 7.4, 6.2, 2.4)];
    m.leds = [];
    for (let i = 0; i < 2; i++) {
      const x = 4.3 + i * 7.4;
      m.leds.push(led3d(m, x + 2.3, 4.0));
      J(`${i}A1`, x - 1, 13.2, 'red'); J(`${i}A2`, x + 1, 13.2, 'blue');
      for (let j = 1; j <= 2; j++) { const y = 17 + (j - 1) * 4.6 + 0.65; J(`${i}C${j}`, x - 1.7, y, 'black'); J(`${i}NO${j}`, x, y, 'red'); J(`${i}NC${j}`, x + 1.7, y, 'blue'); }
    }
    m.update = (st, sim) => {
      for (let i = 0; i < 2; i++) {
        const tag = 'T' + (i + 1);
        const tm = sim && sim.timers.get(tag);
        const d = +c.props['d' + (i + 1)];
        const v = tm ? (tm.mode === 'on' ? Math.min(tm.acc, d) : tm.hold ? tm.acc : 0) : 0;
        lcdText(m.lcds[i], sim ? `${v.toFixed(1)}s` : `${d}s`, '#ffb347', true);
        m.leds[i].set(!!(sim && sim.timerOut(tag)));
      }
    };
  } else if (t === 'm_counter') {
    faceplate(m, '카운터 C1', (g, s) => {
      txt(g, s, '계수 입력', 4.5, 11.2, 0.45); txt(g, s, '리셋', 11.5, 11.2, 0.45);
      txt(g, s, 'A1', 3.4, 13.0, 0.36, '#56606b', 600); txt(g, s, 'A2', 5.6, 13.0, 0.36, '#56606b', 600);
      txt(g, s, 'R1', 10.4, 13.0, 0.36, '#56606b', 600); txt(g, s, 'R2', 12.6, 13.0, 0.36, '#56606b', 600);
      for (let j = 0; j < 2; j++) { const y = 20.6 + j * 4.6; txt(g, s, 'C', 6.3, y - 1.15, 0.38, '#3a4450', 700); txt(g, s, 'NO', 8, y - 1.15, 0.38, '#c62828', 700); txt(g, s, 'NC', 9.7, y - 1.15, 0.38, '#1e4fc2', 700); }
    });
    m.lcd = lcd(m, 8, 6.4, 12, 3.4);
    m.led = led3d(m, 14, 3.9);
    J('A1', 3.4, 14.4, 'red'); J('A2', 5.6, 14.4, 'blue'); J('R1', 10.4, 14.4, 'red'); J('R2', 12.6, 14.4, 'blue');
    for (let j = 1; j <= 2; j++) { const y = 20.6 + (j - 1) * 4.6 + 0.65; J(`C${j}`, 6.3, y, 'black'); J(`NO${j}`, 8, y, 'red'); J(`NC${j}`, 9.7, y, 'blue'); }
    m.update = (st, sim) => {
      const ct = sim && sim.counters.get('C1');
      lcdText(m.lcd, `${ct ? ct.count : 0}/${c.props.preset}`, '#5dff8a', true);
      m.led.set(!!(sim && sim.counterOut('C1')));
    };
  } else if (t === 'm_lamp') {
    faceplate(m, '표시등 · 부저', (g, s) => {
      ['L1 적색', 'L2 황색', 'L3 녹색'].forEach((n, i) => txt(g, s, n, 3.5 + i * 4.5, 10.6, 0.42));
      txt(g, s, '부저 BZ', 8, 25.9, 0.5);
    });
    const cols = [[0xd32f2f, 0xff2a2a], [0xf2c200, 0xffcc00], [0x1e9e4a, 0x22ff66]];
    m.lamps = cols.map(([c0, c1], i) => {
      const [lx, ly] = P2(3.5 + i * 4.5, 6.3);
      m.root.add(at(torusZ(1.75, 0.3, M.chrome), lx, ly, 0.75));
      const mat = new THREE.MeshPhysicalMaterial({ color: c0, roughness: 0.15, transparent: true, opacity: 0.9, clearcoat: 1, emissive: c1, emissiveIntensity: 0 });
      const d = dome(1.45, mat);
      d.rotation.x = Math.PI / 2;
      d.position.set(lx, ly, 0.85);
      const gl = glow(c1, 9);
      gl.position.set(lx, ly, 1.8);
      m.root.add(d, gl);
      J(`${i}a`, 3.5 + i * 4.5, 12.5, 'red');
      J(`${i}b`, 3.5 + i * 4.5, 15.4, 'blue');
      return { mat, gl };
    });
    const [bx, by] = P2(8, 20.6);
    const bz = cylZ(2.3, 1.6, M.black, 40);
    bz.position.set(bx, by, 1.0);
    m.root.add(bz);
    for (let i = 0; i < 3; i++) m.root.add(at(torusZ(0.5 + i * 0.55, 0.1, M.dark), bx, by, 1.82));
    m.bz = bz;
    J('BZa', 6.5, 27.4, 'red'); J('BZb', 9.5, 27.4, 'blue');
    m.update = (st, sim) => {
      m.lamps.forEach((l, i) => {
        const on = !!(sim && st && st.lamp && st.lamp[i]);
        l.mat.emissiveIntensity = on ? 2.6 : 0;
        l.gl.visible = on;
      });
      const on = !!(sim && st && st.bz);
      m.bz.scale.setScalar(on ? 1 + 0.05 * Math.sin(performance.now() / 25) : 1);
      m.animating = on;
    };
  }
  m.update(null, null);
  return finish(m);
}

export function buildModel(c) {
  const d = REG[c.type];
  let m;
  if (c.type.includes('_cyl_')) m = cylinderModel(c);
  else if (d.valve) m = valveModel(c, d);
  else if (c.type === 'p_supply3d') m = pSupplyModel(c);
  else if (c.type === 'h_supply3d') m = hSupplyModel(c);
  else if (c.type.endsWith('_tee')) m = teeModel(c);
  else if (c.type.endsWith('_motor')) m = motorModel(c, d);
  else if (c.type === 's3_reed' || c.type === 's3_ls') m = sensorModel(c);
  else if (d.module) m = moduleModel(c);
  else m = genericModel(c, d);
  for (const p of m.picks) p.userData.pick = { ...(p.userData.pick || { kind: 'comp' }), cid: c.id };
  return m;
}
