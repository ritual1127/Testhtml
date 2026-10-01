// 3D 실습실: 실습 테이블(슬롯 보드) + 전기 모듈 랙 + 부품 배치 + 호스/전선 연결 + 시뮬레이션
import * as THREE from 'three';
import { OrbitControls } from '../vendor/three/OrbitControls.js';
import { RoomEnvironment } from '../vendor/three/RoomEnvironment.js';
import { REG, newComp } from './components.js';
import { buildModel, initMats, M, MOD_W, MOD_H, canvasTex, setInvalidate } from './models3d.js';
import { Sim } from './sim.js';
import { BOARD, empty3D, footprint, SCALE3D } from './convert3d.js';

const TILT = THREE.MathUtils.degToRad(16);
const BOARD_Y = 84;
const BW = 150, BH = 84;
const MOD_S = 0.88;
const SLOT = 2.5;
const RACK_N = 9, RACK_GAP = 0.8;
let PLUG_G = null, TIP_G = null;
const WIRE_COLORS = { red: 0xd32f2f, blue: 0x1e4fc2, black: 0x1d1d1d, yellow: 0xe6b800, green: 0x1e9e4a, white: 0xf2f2f2 };

export class Room3D extends EventTarget {
  constructor(host) {
    super();
    this.host = host;
    this.doc = empty3D('pn');
    this.models = new Map();
    this.links = new Map();
    this.sel = null;
    this.selWire = null;
    this.mode = 'idle';
    this.wireColor = 'red';
    this.showHoses = true;
    this.showWires = true;
    this.sim = null;
    this.running = false;
    this.speed = 1;
    this.undoStack = [];
    this.redoStack = [];
    this.active = false;
    this.quality = (() => { try { return localStorage.getItem('hpt.q3d') || 'high'; } catch (_) { return 'high'; } })();
    this.dirty = true;
    initMats();
    setInvalidate(() => this.invalidate());
    this.initScene();
    this.bind();
  }
  invalidate(shadow = true) { this.dirty = true; if (shadow) this.shadowDirty = true; }
  setQuality(q) {
    this.quality = q;
    try { localStorage.setItem('hpt.q3d', q); } catch (_) { /* 무시 */ }
    const pr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(q === 'high' ? Math.min(pr, 2) : q === 'mid' ? Math.min(pr, 1.25) : 1);
    this.renderer.shadowMap.enabled = q !== 'low';
    const sz = q === 'high' ? 4096 : 2048;
    if (this.sun.shadow.mapSize.x !== sz) { this.sun.shadow.mapSize.set(sz, sz); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } }
    this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    this.resize();
    this.invalidate();
  }

  // ======================== 장면 ========================
  initScene() {
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 2 : this.quality === 'mid' ? 1.25 : 1));
    r.shadowMap.autoUpdate = false;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.host.appendChild(r.domElement);
    r.domElement.className = 'r3-canvas';
    const scene = (this.scene = new THREE.Scene());
    const bgT = canvasTex(4, 256, (g, W, H) => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#9fb0c4'); gr.addColorStop(0.55, '#dfe5ec'); gr.addColorStop(1, '#c4ccd6'); g.fillStyle = gr; g.fillRect(0, 0, W, H); });
    scene.background = bgT.tex;
    const pm = new THREE.PMREMGenerator(r);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.42;
    this.camera = new THREE.PerspectiveCamera(38, 1, 2, 4000);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.minDistance = 25;
    this.controls.maxDistance = 600;
    this.controls.maxPolarAngle = Math.PI * 0.62;
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.controls.screenSpacePanning = true;
    // 조명
    scene.add(new THREE.HemisphereLight(0xffffff, 0x7a8693, 0.85));
    const sun = (this.sun = new THREE.DirectionalLight(0xfff6ea, 2.8));
    sun.position.set(-110, 330, 260);
    sun.target.position.set(0, 120, -10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(this.quality === 'high' ? 4096 : 2048, this.quality === 'high' ? 4096 : 2048);
    Object.assign(sun.shadow.camera, { left: -140, right: 140, top: 150, bottom: -60, near: 50, far: 800 });
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.4;
    sun.shadow.radius = 3;
    r.shadowMap.enabled = this.quality !== 'low';
    scene.add(sun, sun.target);
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.7);
    fill.position.set(200, 160, 220);
    scene.add(fill);
    // 바닥 · 벽
    const ft = canvasTex(256, 256, (g, W, H) => { g.fillStyle = '#b9c1ca'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(80,90,105,.25)'; g.lineWidth = 3; g.strokeRect(0, 0, W, H); });
    ft.tex.wrapS = ft.tex.wrapT = THREE.RepeatWrapping;
    ft.tex.repeat.set(50, 50);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ map: ft.tex, roughness: 0.8, metalness: 0.05 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(3000, 900), new THREE.MeshStandardMaterial({ color: 0xe3e8ee, roughness: 0.95 }));
    wall.position.set(0, 450, -220);
    scene.add(wall);
    this.buildBench();
    this.root = new THREE.Group();
    scene.add(this.root);
    this.linkG = new THREE.Group();
    scene.add(this.linkG);
    this.helperG = new THREE.Group();
    scene.add(this.helperG);
    this.hoverMark = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.75, depthTest: false }));
    this.hoverMark.renderOrder = 999;
    this.hoverMark.visible = false;
    scene.add(this.hoverMark);
    this.ray = new THREE.Raycaster();
    this.ptr = new THREE.Vector2();
    this.setView('all', true);
    this.clock = new THREE.Clock();
  }

  buildBench() {
    const S = (o) => new THREE.MeshStandardMaterial(o);
    const frameM = S({ color: 0xb9c0c8, metalness: 0.8, roughness: 0.32 });
    const darkM = S({ color: 0x4a525c, metalness: 0.4, roughness: 0.5 });
    const bench = (this.bench = new THREE.Group());
    const add = (m, x, y, z) => { m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; bench.add(m); return m; };
    // 다리/프레임
    for (const sx of [-1, 1]) {
      add(new THREE.Mesh(new THREE.BoxGeometry(4.5, BOARD_Y + 6, 4.5), frameM), sx * (BW / 2 + 3), (BOARD_Y + 6) / 2, 14);
      add(new THREE.Mesh(new THREE.BoxGeometry(4.5, BOARD_Y + 120, 4.5), frameM), sx * (BW / 2 + 3), (BOARD_Y + 120) / 2, -30);
      add(new THREE.Mesh(new THREE.BoxGeometry(4.5, 4.5, 48), frameM), sx * (BW / 2 + 3), 12, -8);
      add(new THREE.Mesh(new THREE.BoxGeometry(4.5, 4.5, 48), frameM), sx * (BW / 2 + 3), BOARD_Y - 2, -8);
    }
    add(new THREE.Mesh(new THREE.BoxGeometry(BW + 10, 4.5, 4.5), frameM), 0, 12, 14);
    add(new THREE.Mesh(new THREE.BoxGeometry(BW + 10, 4.5, 4.5), frameM), 0, 12, -30);
    // 하부 선반 + 캐비닛
    add(new THREE.Mesh(new THREE.BoxGeometry(BW + 4, 2, 44), darkM), 0, 15, -8);
    add(new THREE.Mesh(new THREE.BoxGeometry(BW + 6, 3, 50), S({ color: 0xe9edf1, roughness: 0.6 })), 0, BOARD_Y - 4, -6);
    // 슬롯 보드
    const t = canvasTex(16, 128, (g, W, H) => {
      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#c9cfd5'); grad.addColorStop(0.5, '#b2b9c1'); grad.addColorStop(0.58, '#3a4048'); grad.addColorStop(0.7, '#262b31');
      grad.addColorStop(0.78, '#6f7881'); grad.addColorStop(0.86, '#d5dadf'); grad.addColorStop(1, '#bfc6cd');
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
    });
    t.tex.wrapS = t.tex.wrapT = THREE.RepeatWrapping;
    t.tex.repeat.set(1, BH / SLOT);
    const boardM = S({ map: t.tex, bumpMap: t.tex, bumpScale: 0.5, metalness: 0.55, roughness: 0.38 });
    const bg = (this.boardG = new THREE.Group());
    bg.position.set(0, BOARD_Y, 0);
    bg.rotation.x = -TILT;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(BW, BH, 2.4), [frameM, frameM, frameM, frameM, boardM, frameM]);
    plate.position.set(0, BH / 2, -1.2);
    plate.receiveShadow = true;
    plate.userData.pick = { kind: 'board' };
    bg.add(plate);
    this.boardPlate = plate;
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(3, BH + 3, 4), frameM); e.position.set(sx * (BW / 2 + 1.5), BH / 2, -1); e.castShadow = true; bg.add(e); }
    for (const sy of [0, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(BW + 6, 3, 4), frameM); e.position.set(0, sy * BH + (sy ? 1.5 : -1.5), -1); e.castShadow = true; bg.add(e); }
    bench.add(bg);
    // 랙
    const topY = BOARD_Y + BH * Math.cos(TILT), topZ = -BH * Math.sin(TILT);
    const MH = MOD_H * MOD_S;
    this.rackY = topY + 5 + MH / 2;
    this.rackZ = topZ - 7;
    const rw = Math.max(BW, RACK_N * (MOD_W + RACK_GAP) * MOD_S + 4);
    add(new THREE.Mesh(new THREE.BoxGeometry(rw + 6, 3, 6), frameM), 0, this.rackY - MH / 2 - 1.8, this.rackZ - 1);
    add(new THREE.Mesh(new THREE.BoxGeometry(rw + 6, 3, 6), frameM), 0, this.rackY + MH / 2 + 1.8, this.rackZ - 1);
    add(new THREE.Mesh(new THREE.BoxGeometry(rw, MH + 4, 1), darkM), 0, this.rackY, this.rackZ - 2.2);
    for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(4.5, MH + 12, 4.5), frameM), sx * (rw / 2 + 3), this.rackY, this.rackZ - 1);
    for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(4.5, 4.5, Math.abs(this.rackZ + 30) + 2), frameM), sx * (BW / 2 + 3), this.rackY - MH / 2 - 1.8, (this.rackZ - 30) / 2);
    this.rackW = rw;
    this.scene.add(bench);
    this.boardNormal = new THREE.Vector3(0, Math.sin(TILT), Math.cos(TILT));
    this.boardWorldPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(this.boardNormal, new THREE.Vector3(0, BOARD_Y, 0));
  }

  focusOn(cid) {
    const m = this.models.get(cid);
    if (!m) return;
    const b = new THREE.Box3().setFromObject(m.root);
    const c = b.getCenter(new THREE.Vector3());
    const r = Math.max(14, b.getSize(new THREE.Vector3()).length() * 0.9);
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.camAnim = { p0: this.camera.position.clone(), t0: this.controls.target.clone(), p: c.clone().addScaledVector(dir, r * 2.2), t: c, k: 0 };
  }
  setView(v, instant) {
    const views = {
      all: [new THREE.Vector3(-4, 170, 142), new THREE.Vector3(-4, 141, -14)],
      board: [new THREE.Vector3(0, 150, 104), new THREE.Vector3(0, 122, -8)],
      rack: [new THREE.Vector3(0, this.rackY + 3, this.rackZ + 92), new THREE.Vector3(0, this.rackY, this.rackZ)],
      left: [new THREE.Vector3(-150, 160, 150), new THREE.Vector3(-20, 130, -12)],
      right: [new THREE.Vector3(150, 160, 150), new THREE.Vector3(20, 130, -12)],
      top: [new THREE.Vector3(0, 300, 40), new THREE.Vector3(0, 120, -12)],
    };
    const [p, t] = views[v] || views.all;
    if (instant) { this.camera.position.copy(p); this.controls.target.copy(t); this.controls.update(); return; }
    this.camAnim = { p0: this.camera.position.clone(), t0: this.controls.target.clone(), p, t, k: 0 };
  }

  // ======================== 문서 ========================
  load(doc, keepView) {
    this.stopSim();
    this.doc = JSON.parse(JSON.stringify(doc));
    // 랙/공급 유닛 보장
    const base = empty3D(this.doc.mode || 'pn');
    for (const c of base.components) {
      if (!this.doc.components.some((q) => q.type === c.type && (c.props.base == null || +q.props.base === +c.props.base))) { c.id = this.newId(); this.doc.components.push(c); }
    }
    for (const c of this.doc.components) { const d = REG[c.type]; if (d) for (const p of d.props) if (!(p.k in c.props)) c.props[p.k] = p.d; }
    this.sel = null;
    this.selWire = null;
    this.undoStack = [];
    this.redoStack = [];
    this.rebuild();
    if (!keepView) this.setView('all', true);
    this.emit('change', { dirty: false });
    this.emit('select');
  }
  newDoc(mode) { this.load(empty3D(mode)); }
  newId(p = 'k') {
    const used = new Set([...this.doc.components.map((c) => c.id), ...this.doc.wires.map((w) => w.id)]);
    let i = (this.doc._seq || used.size) + 1;
    while (used.has(p + i)) i++;
    this.doc._seq = i;
    return p + i;
  }
  comp(id) { return this.doc.components.find((c) => c.id === id); }
  snap() {
    this.undoStack.push(JSON.stringify({ c: this.doc.components, w: this.doc.wires }));
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = [];
  }
  undo() { if (this.sim || !this.undoStack.length) return; this.redoStack.push(JSON.stringify({ c: this.doc.components, w: this.doc.wires })); const o = JSON.parse(this.undoStack.pop()); this.doc.components = o.c; this.doc.wires = o.w; this.sel = null; this.rebuild(); this.changed(); }
  redo() { if (this.sim || !this.redoStack.length) return; this.undoStack.push(JSON.stringify({ c: this.doc.components, w: this.doc.wires })); const o = JSON.parse(this.redoStack.pop()); this.doc.components = o.c; this.doc.wires = o.w; this.sel = null; this.rebuild(); this.changed(); }
  changed() { this.emit('change', { dirty: true }); }
  emit(t, detail) { this.dispatchEvent(new CustomEvent(t, { detail })); }

  // ======================== 모델 배치 ========================
  rebuild() {
    for (const m of this.models.values()) { m.root.parent && m.root.parent.remove(m.root); if (m.unit) m.unit.parent && m.unit.parent.remove(m.unit); }
    this.models.clear();
    for (const c of this.doc.components) if (REG[c.type]) this.models.set(c.id, buildModel(c));
    for (const c of this.doc.components) this.place(c);
    this.rebuildLinks();
    this.updateSelBox();
    this.refreshPicks();
    this.invalidate();
  }
  place(c) {
    this.invalidate();
    const m = this.models.get(c.id);
    if (!m) return;
    const b = c.b3 || (c.b3 = { u: 0, v: 40, r: 0 });
    if (b.rack != null) {
      const pitch = (MOD_W + RACK_GAP) * MOD_S;
      const x0 = -((RACK_N - 1) * pitch) / 2;
      m.root.position.set(x0 + b.rack * pitch, this.rackY, this.rackZ);
      m.root.rotation.set(0, 0, 0);
      m.root.scale.setScalar(MOD_S);
      this.scene.add(m.root);
      return;
    }
    if (c.props.cyl && (c.type.startsWith('s3_') || REG[c.type].valve)) {
      const cm = this.models.get(c.props.cyl);
      if (cm && cm.attachFrame) {
        if (c.type.startsWith('s3_')) {
          const f = cm.attachFrame(c.type === 's3_reed' ? 'reed' : 'ls', +c.props.pos || 0);
          m.root.position.set(f.x, f.y, f.z);
          m.root.rotation.set(0, 0, c.type === 's3_ls' ? 0 : 0);
          cm.root.add(m.root);
          return;
        }
        // 롤러 밸브: 실린더 로드 도그 아래에 롤러가 오도록 보드 위치 계산
        const cc = this.comp(c.props.cyl);
        const f = cm.attachFrame('ls', +c.props.pos || 0);
        const fp = footprint(c);
        const rr = THREE.MathUtils.degToRad(cc.b3.r || 0);
        const fx = (f.x * Math.cos(rr) - f.y * Math.sin(rr)) * SCALE3D, fy = (f.x * Math.sin(rr) + f.y * Math.cos(rr)) * SCALE3D;
        b.u = cc.b3.u + fx + fp[0] / 2 - 2.6 * SCALE3D;
        b.v = cc.b3.v + fy - 3.2 * SCALE3D;
        b.r = 0;
      }
    }
    if (c.type === 'h_supply3d' && m.unit) {
      m.unit.position.set(-BW / 2 - 24, 44, 22);
      m.unit.rotation.y = 0.35;
      m.unit.scale.setScalar(0.8);
      this.scene.add(m.unit);
      if (!this.unitStand) {
        const st = new THREE.Mesh(new THREE.BoxGeometry(44, 44, 40), new THREE.MeshStandardMaterial({ color: 0x5b6672, roughness: 0.6, metalness: 0.3 }));
        st.position.set(-BW / 2 - 24, 22, 22);
        st.rotation.y = 0.35;
        st.castShadow = st.receiveShadow = true;
        this.unitStand = st;
      }
      this.scene.add(this.unitStand);
    } else if (c.type === 'p_supply3d' && this.unitStand) this.scene.remove(this.unitStand);
    m.root.position.set(b.u, b.v, 0.05);
    m.root.rotation.set(0, 0, THREE.MathUtils.degToRad(b.r || 0));
    m.root.scale.setScalar(SCALE3D);
    this.boardG.add(m.root);
  }

  refreshPicks() {
    this.picks = [this.boardPlate];
    for (const m of this.models.values()) this.picks.push(...m.picks);
    for (const l of this.links.values()) this.picks.push(l.mesh);
  }

  // ======================== 호스 · 전선 ========================
  endpoint(e) {
    const m = this.models.get(e.c);
    if (!m) return null;
    const p = m.ports[e.p] || m.jacks[e.p];
    if (!p) return null;
    m.root.updateWorldMatrix(true, false);
    const pos = p.pos.clone().applyMatrix4(m.root.matrixWorld);
    const dir = p.dir.clone().transformDirection(m.root.matrixWorld);
    return { pos, dir, fluid: !!m.ports[e.p], kind: m.ports[e.p] ? m.ports[e.p].kind : 'el' };
  }
  linkCurve(A, B, el) {
    const L = A.pos.distanceTo(B.pos);
    const k = el ? 2.2 : Math.min(14, 3 + L * 0.18);
    const a1 = A.pos.clone().addScaledVector(A.dir, el ? 1.6 : 1.2);
    const b1 = B.pos.clone().addScaledVector(B.dir, el ? 1.6 : 1.2);
    const a2 = A.pos.clone().addScaledVector(A.dir, k);
    const b2 = B.pos.clone().addScaledVector(B.dir, k);
    const mid = a2.clone().add(b2).multiplyScalar(0.5);
    mid.y -= (el ? 0.22 : 0.1) * L + (el ? 3 : 1);
    mid.addScaledVector(this.boardNormal, el ? 3 + L * 0.06 : 2.5 + L * 0.05);
    return new THREE.CatmullRomCurve3([A.pos, a1, a2, mid, b2, b1, B.pos], false, 'centripetal', 0.5);
  }
  rebuildLinks() {
    for (const l of this.links.values()) { this.linkG.remove(l.group); l.mesh.geometry.dispose(); }
    this.links.clear();
    for (const w of this.doc.wires) this.buildLink(w);
    // 유압 파워유닛 → 분배블록 고정 호스(장식)
    if (this.unitHoses) for (const h of this.unitHoses) this.linkG.remove(h);
    this.unitHoses = [];
    const sup = this.doc.components.find((c) => c.type === 'h_supply3d');
    const sm = sup && this.models.get(sup.id);
    if (sm && sm.unit) {
      sm.unit.updateWorldMatrix(true, true);
      sm.root.updateWorldMatrix(true, true);
      const mk = (from, to) => {
        const a = { pos: from.clone().applyMatrix4(sm.unit.matrixWorld), dir: new THREE.Vector3(0, 1, 0) };
        const b = { pos: to.clone().applyMatrix4(sm.root.matrixWorld), dir: new THREE.Vector3(-1, 0, 0.3).normalize() };
        const h = new THREE.Mesh(new THREE.TubeGeometry(this.linkCurve(a, b, false), 40, 1.0, 10), M.dark);
        h.castShadow = true;
        this.linkG.add(h);
        this.unitHoses.push(h);
      };
      mk(sm.unitPorts.P, new THREE.Vector3(-4.8, -10, 2.4));
      mk(sm.unitPorts.T, new THREE.Vector3(4.8, -10, 2.4));
    }
    this.applyVisibility();
  }
  buildLink(w) {
    const A = this.endpoint(w.a), B = this.endpoint(w.b);
    if (!A || !B) return;
    const el = !A.fluid;
    const hy = A.kind === 'hy';
    const curve = this.linkCurve(A, B, el);
    const r = el ? 0.2 : hy ? 0.75 : 0.36;
    const mat = el ? new THREE.MeshPhysicalMaterial({ color: WIRE_COLORS[w.color || 'red'] ?? 0xd32f2f, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 })
      : hy ? new THREE.MeshPhysicalMaterial({ color: 0x151515, roughness: 0.5, clearcoat: 0.3 })
      : new THREE.MeshPhysicalMaterial({ color: 0x2a7de6, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.15, transparent: true, opacity: 0.94 });
    const segs = Math.min(140, Math.max(24, Math.round(curve.getLength() / 1.2)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, r, el ? 8 : 12), mat);
    mesh.castShadow = true;
    mesh.userData.pick = { kind: 'link', wid: w.id };
    const group = new THREE.Group();
    group.add(mesh);
    if (el) {
      for (const E of [A, B]) {
        const plug = new THREE.Mesh(PLUG_G || (PLUG_G = new THREE.CylinderGeometry(0.44, 0.38, 1.9, 14)), mat);
        plug.position.copy(E.pos).addScaledVector(E.dir, 0.95);
        plug.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), E.dir);
        const tip = new THREE.Mesh(TIP_G || (TIP_G = new THREE.CylinderGeometry(0.2, 0.2, 0.5, 10)), M.steel);
        tip.position.copy(E.pos).addScaledVector(E.dir, -0.1);
        tip.quaternion.copy(plug.quaternion);
        group.add(plug, tip);
      }
    }
    this.linkG.add(group);
    this.links.set(w.id, { w, mesh, group, el, hy, mat, base: mat.color.getHex() });
  }
  linksOf(cid) { return this.doc.wires.filter((w) => w.a.c === cid || w.b.c === cid); }
  updateLinksFor(cids) {
    const set = new Set(cids);
    for (const w of this.doc.wires) {
      if (!set.has(w.a.c) && !set.has(w.b.c)) continue;
      const l = this.links.get(w.id);
      if (l) { this.linkG.remove(l.group); l.mesh.geometry.dispose(); this.links.delete(w.id); }
      this.buildLink(w);
    }
    this.refreshPicks();
    this.applyVisibility();
  }
  applyVisibility() {
    for (const l of this.links.values()) l.group.visible = l.el ? this.showWires : this.showHoses;
    this.invalidate();
  }

  // ======================== 시뮬레이션 ========================
  startSim() {
    if (this.sim && !this.running) { this.running = true; this.emit('simstate'); return; }
    if (this.sim) return;
    this.cancel();
    this.sim = new Sim(this.doc);
    this.running = true;
    this.setSel(null);
    this.emit('simstate');
  }
  pauseSim() { if (this.sim) { this.running = false; this.emit('simstate'); } }
  stopSim() {
    if (!this.sim) return;
    this.sim = null;
    this.running = false;
    for (const [id, m] of this.models) m.update(null, null);
    for (const l of this.links.values()) { l.mat.color.setHex(l.base); if (l.mat.emissive) l.mat.emissive.setHex(0); }
    this.invalidate();
    this.emit('simstate');
  }
  resetSim() { const r = this.running; this.stopSim(); this.startSim(); if (!r) this.pauseSim(); }
  stepSim(sec = 0.1) { if (!this.sim) { this.startSim(); this.pauseSim(); } this.sim.run(sec); this.paint(); this.invalidate(); this.emit('frame'); }

  paint() {
    const sim = this.sim;
    for (const [id, m] of this.models) m.update(sim ? sim.st.get(id) : null, sim);
    if (!sim) return;
    const pref = Math.max(50, ...this.doc.components.filter((c) => c.type === 'h_supply3d').map((c) => +c.props.p));
    for (const l of this.links.values()) {
      const ws = sim.wireState(l.w);
      if (!ws) continue;
      if (l.el) {
        continue;
      } else if (l.hy) {
        const f = Math.min(1, ws.p / pref);
        l.mat.color.setHex(ws.p > 1 ? 0x2a0c0c : l.base);
        l.mat.emissive.setRGB(ws.p > 1 ? 0.25 + f * 0.75 : 0, ws.p > 1 ? 0.03 : 0, ws.p > 1 ? 0.02 + (1 - f) * 0.25 : 0);
      } else {
        const f = Math.min(1, ws.p / 6);
        if (ws.p > 0.25) { l.mat.color.setRGB(0.05, 0.55 + 0.25 * f, 1); l.mat.emissive.setRGB(0, 0.18 + 0.3 * f, 0.55 + 0.45 * f); }
        else { l.mat.color.setHex(l.base); l.mat.emissive.setHex(0); }
      }
    }
  }

  // ======================== 렌더 루프 ========================
  resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }
  start() {
    this.active = true;
    this.resize();
    this.clock.getDelta();
    const loop = () => {
      if (!this.active) return;
      const dtReal = Math.min(0.1, this.clock.getDelta());
      if (this.camAnim) {
        const a = this.camAnim;
        a.k = Math.min(1, a.k + dtReal * 2.6);
        const e = 1 - Math.pow(1 - a.k, 3);
        this.camera.position.lerpVectors(a.p0, a.p, e);
        this.controls.target.lerpVectors(a.t0, a.t, e);
        if (a.k >= 1) this.camAnim = null;
      }
      if (this.controls.update()) this.dirty = true;
      if (this.camAnim) this.dirty = true;
      if (this.sim && this.running) {
        const dt = dtReal * this.speed;
        if (dt > 1e-5) { const n = Math.max(1, Math.ceil(dt / (1 / 240))); for (let i = 0; i < n; i++) this.sim.step(dt / n); }
        this.paint();
        this.emit('frame');
        this.dirty = true;
        this.shadowDirty = true;
      }
      if (this.dirty) {
        if (this.shadowDirty && this.renderer.shadowMap.enabled) { this.renderer.shadowMap.needsUpdate = true; this.shadowDirty = false; }
        this.renderer.render(this.scene, this.camera);
        this.dirty = false;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  stop() { this.active = false; }

  // ======================== 입력 ========================
  pick(ev, kinds) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ptr, this.camera);
    const hits = this.ray.intersectObjects(this.picks, false);
    for (const h of hits) {
      const o = h.object;
      if (!o.visible || !isVisible(o)) continue;
      let p = o.userData.pick;
      if (!p) continue;
      if (p.inst) p = { ...p, pid: p.inst[h.instanceId] };
      if (kinds && !kinds.includes(p.kind)) continue;
      return { ...p, point: h.point, object: o };
    }
    return null;
  }
  boardPoint(ev) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ptr, this.camera);
    const p = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.boardWorldPlane, p)) return null;
    const inv = new THREE.Matrix4().copy(this.boardG.matrixWorld).invert();
    const l = p.clone().applyMatrix4(inv);
    return { world: p, u: l.x, v: l.y };
  }

  bind() {
    const el = this.renderer.domElement;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    this.host.addEventListener('pointerdown', (e) => this.onDown(e), true);
    el.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    el.addEventListener('dblclick', (e) => {
      const h = this.pick(e, ['comp', 'port', 'jack']);
      if (!h || !h.cid) return;
      this.focusOn(h.cid);
      if (!this.sim) this.emit('editprops', h.cid);
    });
    new ResizeObserver(() => this.resize()).observe(this.host);
  }

  onDown(e) {
    if (e.target !== this.renderer.domElement) return;
    this.down = { x: e.clientX, y: e.clientY, moved: false };
    if (e.button !== 0) return;
    const hit = this.pick(e);
    if (this.sim) {
      if (hit && hit.cid) {
        const c = this.comp(hit.cid);
        const d = REG[c.type];
        if (d.press) {
          let part = hit.part;
          if (d.valve) {
            if (part == null) { const l = this.models.get(c.id).root.worldToLocal(hit.point.clone()); part = l.x < 0 ? 'L' : 'R'; }
            part = part === 'L' ? -1000 : 1000;
          }
          this.controls.enabled = false;
          this.sim.press(c.id, part ?? 0, 0);
          this.pressed = c.id;
          this.paint();
          this.invalidate();
        }
      }
      return;
    }
    if (this.mode === 'place') { this.commitPlace(e); this.controls.enabled = false; return; }
    if (this.mode === 'attach') { this.commitAttach(e); this.controls.enabled = false; return; }
    if (hit && (hit.kind === 'port' || hit.kind === 'jack')) {
      this.controls.enabled = false;
      if (this.mode === 'connect') this.finishConnect(hit);
      else { this.beginConnect(hit); this.connectByDrag = true; }
      return;
    }
    if (this.mode === 'connect') { this.cancel(); return; }
    if (hit && hit.kind === 'link') { this.setSelWire(hit.wid); this.controls.enabled = false; return; }
    if (hit && hit.kind === 'comp' && hit.cid) {
      const c = this.comp(hit.cid);
      this.setSel(c.id);
      if (c.b3 && c.b3.rack == null && !c.b3.att && !(c.props.cyl && REG[c.type].valve)) {
        this.controls.enabled = false;
        this.drag = { c, start: this.boardPoint(e), u0: c.b3.u, v0: c.b3.v, moved: false };
      }
      return;
    }
    this.setSel(null);
  }
  onMove(e) {
    if (this.down && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 4) this.down.moved = true;
    if (this.drag) {
      const p = this.boardPoint(e);
      if (!p || !this.drag.start) return;
      const c = this.drag.c;
      if (!this.drag.moved && this.down && this.down.moved) { this.snap(); this.drag.moved = true; }
      if (!this.drag.moved) return;
      c.b3.u = clampU(Math.round(this.drag.u0 + p.u - this.drag.start.u), c);
      c.b3.v = clampV(Math.round((this.drag.v0 + p.v - this.drag.start.v) / SLOT) * SLOT, c);
      this.place(c);
      for (const o of this.doc.components) if (o.props.cyl === c.id && REG[o.type].valve) this.place(o);
      this.updateLinksFor([c.id, ...this.doc.components.filter((o) => o.props.cyl === c.id).map((o) => o.id)]);
      this.updateSelBox();
      return;
    }
    if (this.mode === 'place' && this.placing) {
      this.placeMoved = (this.placeMoved || 0) + 1;
      const p = this.boardPoint(e);
      if (p) {
        const c = this.placing;
        c.b3.u = clampU(Math.round(p.u), c);
        c.b3.v = clampV(Math.round(p.v / SLOT) * SLOT, c);
        this.place(c);
      }
      return;
    }
    if (e.buttons && this.mode === 'connect') { this.updatePreview(e); return; }
    if (e.buttons) return;
    // 호버
    const hit = this.pick(e);
    let tip = '';
    this.hoverMark.visible = false;
    let cursor = '';
    if (hit) {
      const c = hit.cid && this.comp(hit.cid);
      if ((hit.kind === 'port' || hit.kind === 'jack') && !this.sim) {
        const E = this.endpoint({ c: hit.cid, p: hit.pid });
        if (E) { this.hoverMark.position.copy(E.pos); this.hoverMark.visible = true; }
        cursor = 'crosshair';
        tip = `${termName(c, hit.pid)}${hit.kind === 'port' && this.doc.wires.some((w) => (w.a.c === c.id && w.a.p === hit.pid) || (w.b.c === c.id && w.b.p === hit.pid)) ? ' (연결됨)' : ''}`;
      } else if (hit.kind === 'link') {
        const l = this.links.get(hit.wid);
        cursor = 'pointer';
        if (this.sim && l) { const ws = this.sim.wireState(l.w); tip = ws ? (ws.el ? (ws.live ? '전선: +24V 통전' : '전선') : `호스 압력 ${ws.p.toFixed(ws.kind === 'hy' ? 1 : 2)} bar`) : ''; }
        else if (l) tip = `${l.el ? '전선' : '호스'}: ${termName(this.comp(l.w.a.c), l.w.a.p)} ↔ ${termName(this.comp(l.w.b.c), l.w.b.p)}`;
      } else if (c) {
        const d = REG[c.type];
        cursor = this.sim ? (d.press ? 'pointer' : '') : c.b3 && c.b3.rack == null ? 'move' : 'pointer';
        tip = `${d.name}${c.props.tag && !d.module ? ' ' + c.props.tag : ''}${this.sim && d.press ? ' — 클릭하여 조작' : ''}`;
      }
    }
    if (this.mode === 'connect') {
      this.updatePreview(e);
      cursor = 'crosshair';
    }
    this.renderer.domElement.style.cursor = cursor;
    if (this.hoverMark.visible || this._hv) this.invalidate(false);
    this._hv = this.hoverMark.visible;
    this.emit('tip', { x: e.clientX, y: e.clientY, text: tip });
  }
  onUp(e) {
    this.controls.enabled = true;
    this.invalidate();
    if (this.mode === 'place' && this.placeByDrag) {
      this.placeByDrag = false;
      if (e.target === this.renderer.domElement && this.placeMoved > 2) { this.commitPlace(e); return; }
    }
    if (this.mode === 'connect' && this.down && this.down.moved && this.connectByDrag) {
      const hit = this.pick(e, ['port', 'jack']);
      this.connectByDrag = false;
      if (hit && !(hit.cid === this.pending.cid && hit.pid === this.pending.pid)) { this.finishConnect(hit); this.down = null; return; }
    }
    this.connectByDrag = false;
    if (this.pressed) { this.sim && this.sim.release(this.pressed); this.pressed = null; this.paint(); }
    if (this.drag) { if (this.drag.moved) { this.changed(); this.emit('select'); } this.drag = null; }
    this.down = null;
  }

  // ---------- 연결 ----------
  beginConnect(hit) {
    this.mode = 'connect';
    this.pending = hit;
    this.setSel(null);
    const E = this.endpoint({ c: hit.cid, p: hit.pid });
    this.pendingPos = E.pos;
    this.emit('status', hit.kind === 'port' ? '호스 연결: 연결할 다른 피팅(포트)을 클릭하세요 (Esc 취소)' : '전선 연결: 연결할 다른 잭을 클릭하세요 (Esc 취소)');
  }
  updatePreview(e) {
    if (!this.preview) {
      this.preview = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: 0xffd400, dashSize: 1.2, gapSize: 0.8, depthTest: false }));
      this.preview.renderOrder = 998;
      this.helperG.add(this.preview);
    }
    const hit = this.pick(e, ['port', 'jack', 'comp', 'board', 'link']);
    const to = hit ? hit.point : this.boardPoint(e)?.world;
    if (!to) return;
    this.preview.geometry.setFromPoints([this.pendingPos, to]);
    this.preview.computeLineDistances();
    this.invalidate(false);
  }
  finishConnect(hit) {
    const a = this.pending;
    if (a.cid === hit.cid && a.pid === hit.pid) { this.cancel(); return; }
    if (a.kind !== hit.kind) { this.emit('status', '⚠ 호스(공·유압 포트)와 전선(전기 잭)은 서로 연결할 수 없습니다.'); return; }
    const has = (cid, pid) => this.doc.wires.some((w) => (w.a.c === cid && w.a.p === pid) || (w.b.c === cid && w.b.p === pid));
    if (a.kind === 'port') {
      const ka = this.endpoint({ c: a.cid, p: a.pid }).kind, kb = this.endpoint({ c: hit.cid, p: hit.pid }).kind;
      if (ka !== kb) { this.emit('status', '⚠ 공압과 유압 포트는 연결할 수 없습니다.'); return; }
      if (has(a.cid, a.pid) || has(hit.cid, hit.pid)) { this.emit('status', '⚠ 이미 호스가 연결된 포트입니다. 분기가 필요하면 기타 → 분기 티(T)를 사용하세요.'); return; }
    }
    if (this.doc.wires.some((w) => (w.a.c === a.cid && w.a.p === a.pid && w.b.c === hit.cid && w.b.p === hit.pid) || (w.b.c === a.cid && w.b.p === a.pid && w.a.c === hit.cid && w.a.p === hit.pid))) { this.cancel(); return; }
    this.snap();
    const w = { id: this.newId('h'), a: { c: a.cid, p: a.pid }, b: { c: hit.cid, p: hit.pid } };
    if (a.kind === 'jack') w.color = this.wireColor;
    this.doc.wires.push(w);
    this.buildLink(w);
    this.refreshPicks();
    this.applyVisibility();
    this.cancel();
    this.changed();
    this.emit('status', `${a.kind === 'port' ? '호스' : '전선'} 연결: ${termName(this.comp(w.a.c), w.a.p)} ↔ ${termName(this.comp(w.b.c), w.b.p)}`);
  }
  cancel() {
    if (this.mode === 'place' && this.placing) {
      const m = this.models.get(this.placing.id);
      if (m) m.root.parent && m.root.parent.remove(m.root);
      this.models.delete(this.placing.id);
      this.doc.components = this.doc.components.filter((c) => c !== this.placing);
      this.refreshPicks();
    }
    this.mode = 'idle';
    this.pending = null;
    this.placing = null;
    if (this.preview) { this.helperG.remove(this.preview); this.preview = null; }
    this.invalidate(false);
    this.emit('status', '');
    this.emit('modechange');
  }

  // ---------- 배치 ----------
  beginPlace(type) {
    if (this.sim) return;
    this.cancel();
    if (type === 's3_reed' || type === 's3_ls') {
      this.mode = 'attach';
      this.attachType = type;
      this.emit('status', '센서를 부착할 실린더를 클릭하세요 (클릭한 위치 근처의 후진끝/전진끝/중간 위치에 부착, Esc 취소)');
      this.emit('modechange');
      return;
    }
    const c = newComp(type, 0, 0, this.newId());
    c.b3 = { u: 0, v: 46, r: 0 };
    autoTag(this.doc, c);
    this.doc.components.push(c);
    this.models.set(c.id, buildModel(c));
    this.place(c);
    this.placing = c;
    this.placeMoved = 0;
    this.mode = 'place';
    this.emit('status', `${REG[type].name}: 보드 위 원하는 위치를 클릭하여 고정하세요 (Esc 취소)`);
    this.emit('modechange');
  }
  commitPlace(e) {
    const c = this.placing;
    if (!c) return;
    const d = REG[c.type];
    // 롤러 밸브를 실린더 위에 놓으면 부착
    if (d.valve && d.valve.L.some((a) => a.t === 'roller')) {
      const h = this.pick(e, ['comp']);
      const cc = h && this.comp(h.cid);
      if (cc && cc.type.includes('_cyl_')) { c.props.cyl = cc.id; c.props.pos = this.posOnCyl(cc, h.point); }
    }
    const placed = c;
    this.placing = null;
    this.mode = 'idle';
    this.undoStack.push(JSON.stringify({ c: this.doc.components.filter((q) => q !== placed), w: this.doc.wires }));
    this.redoStack = [];
    this.place(placed);
    this.refreshPicks();
    this.setSel(placed.id);
    this.changed();
    this.emit('status', `${d.name} 배치 완료 — 피팅을 클릭하여 호스를 연결하세요`);
    this.emit('modechange');
  }
  posOnCyl(cc, point) {
    const m = this.models.get(cc.id);
    const l = m.root.worldToLocal(point.clone());
    const f = m.frame;
    const L = +cc.props.stroke || 100;
    let pos = ((l.x - f.xt0 - 1.2) / (f.xt1 - f.xt0 - 2.4)) * L;
    if (l.x > f.xface) pos = ((l.x - f.xface - 2.5) / f.L0) * L;
    pos = Math.max(0, Math.min(L, pos));
    if (pos < L * 0.2) pos = 0;
    else if (pos > L * 0.8) pos = L;
    else pos = Math.round(pos / 5) * 5;
    return pos;
  }
  commitAttach(e) {
    const h = this.pick(e, ['comp']);
    const cc = h && this.comp(h.cid);
    if (!cc || !cc.type.includes('_cyl_')) { this.emit('status', '⚠ 실린더를 클릭하세요. (Esc 취소)'); return; }
    this.snap();
    const c = newComp(this.attachType, 0, 0, this.newId());
    c.props.cyl = cc.id;
    c.props.pos = this.posOnCyl(cc, h.point);
    c.b3 = { att: true };
    autoTag(this.doc, c);
    this.doc.components.push(c);
    this.models.set(c.id, buildModel(c));
    this.place(c);
    this.refreshPicks();
    this.mode = 'idle';
    this.setSel(c.id);
    this.changed();
    this.emit('status', `${REG[c.type].name} ${c.props.tag} 부착: ${cc.props.tag} ${c.props.pos}mm 위치 — 잭에 전선을 연결하세요`);
    this.emit('modechange');
  }

  // ---------- 선택 · 편집 ----------
  setSel(id) {
    this.sel = id;
    this.selWire = null;
    for (const l of this.links.values()) l.mat.emissive && !this.sim && l.mat.emissive.setHex(0);
    this.updateSelBox();
    this.emit('select');
  }
  setSelWire(wid) {
    this.sel = null;
    this.selWire = wid;
    for (const l of this.links.values()) if (l.mat.emissive) l.mat.emissive.setHex(l.w.id === wid ? 0x665500 : 0);
    this.updateSelBox();
    this.emit('select');
  }
  updateSelBox() {
    this.invalidate(false);
    if (this.selBox) { this.helperG.remove(this.selBox); this.selBox = null; }
    const m = this.sel && this.models.get(this.sel);
    if (!m) return;
    this.selBox = new THREE.BoxHelper(m.root, 0x1a73e8);
    this.selBox.material.depthTest = false;
    this.selBox.renderOrder = 997;
    this.helperG.add(this.selBox);
  }
  deleteSel() {
    if (this.sim) return;
    if (this.selWire) {
      this.snap();
      this.doc.wires = this.doc.wires.filter((w) => w.id !== this.selWire);
      const l = this.links.get(this.selWire);
      if (l) { this.linkG.remove(l.group); this.links.delete(this.selWire); }
      this.selWire = null;
      this.refreshPicks();
      this.changed();
      this.emit('select');
      return;
    }
    const c = this.sel && this.comp(this.sel);
    if (!c || (c.b3 && c.b3.rack != null) || c.type.endsWith('supply3d')) { if (c) this.emit('status', '⚠ 랙 모듈과 공급 유닛은 삭제할 수 없습니다.'); return; }
    this.snap();
    const ids = new Set([c.id, ...this.doc.components.filter((o) => o.props.cyl === c.id && o.type.startsWith('s3_')).map((o) => o.id)]);
    for (const o of this.doc.components) if (o.props.cyl === c.id && REG[o.type].valve) o.props.cyl = '';
    this.doc.components = this.doc.components.filter((o) => !ids.has(o.id));
    this.doc.wires = this.doc.wires.filter((w) => !ids.has(w.a.c) && !ids.has(w.b.c));
    this.sel = null;
    this.rebuild();
    this.changed();
    this.emit('select');
  }
  rotateSel() {
    const c = this.sel && this.comp(this.sel);
    if (!c || this.sim || !c.b3 || c.b3.rack != null || c.b3.att) return;
    this.snap();
    c.b3.r = ((c.b3.r || 0) + 90) % 360;
    this.place(c);
    for (const o of this.doc.components) if (o.props.cyl === c.id && REG[o.type].valve) this.place(o);
    this.updateLinksFor([c.id, ...this.doc.components.filter((o) => o.props.cyl === c.id).map((o) => o.id)]);
    this.updateSelBox();
    this.changed();
  }
  setProp(id, k, v, live) {
    const c = this.comp(id);
    if (!c) return;
    if (!live) this.snap();
    c.props[k] = v;
    if (live && this.sim) return;
    // 모델 재생성 (태그·행정 등)
    const old = this.models.get(id);
    if (old) { old.root.parent && old.root.parent.remove(old.root); if (old.unit) old.unit.parent && old.unit.parent.remove(old.unit); }
    this.models.set(id, buildModel(c));
    this.place(c);
    for (const o of this.doc.components) if (o.props.cyl === id) { const om = this.models.get(o.id); if (om) { om.root.parent && om.root.parent.remove(om.root); } this.models.set(o.id, buildModel(o)); this.place(o); }
    this.rebuildLinks();
    this.refreshPicks();
    this.updateSelBox();
    this.changed();
  }
  clearWires(kind) {
    if (this.sim) return;
    this.snap();
    this.doc.wires = this.doc.wires.filter((w) => { const e = this.endpoint(w.a); return kind === 'el' ? e && e.fluid : e && !e.fluid; });
    this.rebuildLinks();
    this.refreshPicks();
    this.changed();
  }
  key(e) {
    const k = e.key.toLowerCase();
    if (k === 'escape') { if (this.mode !== 'idle') this.cancel(); else if (this.sim) this.stopSim(); else this.setSel(null); return true; }
    if (this.sim) return false;
    if (k === 'delete' || k === 'backspace') { this.deleteSel(); return true; }
    if (k === 'r' && !e.ctrlKey && !e.metaKey) { this.rotateSel(); return true; }
    if ((e.ctrlKey || e.metaKey) && k === 'z') { this.undo(); return true; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { this.redo(); return true; }
    return false;
  }
  // 테스트/자동화용: 포트·잭·부품의 화면 좌표
  project(v) {
    const p = v.clone().project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return [r.left + ((p.x + 1) / 2) * r.width, r.top + ((1 - p.y) / 2) * r.height];
  }
  projectBoard(u, v) { this.boardG.updateWorldMatrix(true, false); return this.project(new THREE.Vector3(u, v, 0).applyMatrix4(this.boardG.matrixWorld)); }
  projectEnd(cid, pid) { const e = this.endpoint({ c: cid, p: pid }); return e && this.project(e.pos); }
  projectMesh(cid, pred) {
    const m = this.models.get(cid);
    let tgt = null;
    m.root.traverse((o) => { if (!tgt && o.isMesh && o.userData.pick && pred(o.userData.pick)) tgt = o; });
    if (!tgt) return null;
    const b = new THREE.Box3().setFromObject(tgt);
    return this.project(b.getCenter(new THREE.Vector3()));
  }
  screenshot() { this.renderer.shadowMap.needsUpdate = true; this.renderer.render(this.scene, this.camera); return this.renderer.domElement.toDataURL('image/png'); }
}

function isVisible(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }
const clampU = (u, c) => { const w = footprint(c)[0] / 2; return Math.max(-BW / 2 + w + 1, Math.min(BW / 2 - w - 1, u)); };
const clampV = (v, c) => { const h = footprint(c)[1] / 2; return Math.max(h + 1, Math.min(BH - h - 1, v)); };

export function autoTag(doc, c) {
  if (!('tag' in c.props) || !c.props.tag) return;
  const fam = c.type.includes('_cyl_') ? 'cyl' : REG[c.type].valve ? 'valve' : c.type;
  const used = new Set(doc.components.filter((o) => o !== c && (o.type.includes('_cyl_') ? 'cyl' : REG[o.type].valve ? 'valve' : o.type) === fam).map((o) => o.props.tag));
  if (fam === 'cyl') { let i = 1; while (used.has(i + 'A')) i++; c.props.tag = (c.type.startsWith('h_') ? 'A' : '') + i + (c.type.startsWith('h_') ? '' : 'A'); return; }
  if (fam === 'valve') { let i = 1; while (used.has((c.type.startsWith('hv') ? 'V' : '1V') + i)) i++; c.props.tag = (c.type.startsWith('hv') ? 'V' : '1V') + i; return; }
  const m = String(c.props.tag).match(/^(\D*)(\d+)(.*)$/);
  if (m && used.has(c.props.tag)) { let i = +m[2]; let t; do { i++; t = m[1] + i + m[3]; } while (used.has(t)); c.props.tag = t; }
}

// 단자 이름 (분석/툴팁)
export function termName(c, pid) {
  if (!c) return pid;
  const d = REG[c.type];
  const t = c.type;
  const tag = c.props.tag || '';
  if (t === 'm_psu') return pid[0] === 'P' ? '전원 +24V' : '전원 0V';
  if (t === 'm_pb') { const i = +pid[0]; return `PB${+c.props.base + i} ${pid.includes('NO') ? 'a접점' : 'b접점'}(${pid.slice(-1) === 'a' ? '1' : '2'})`; }
  if (t === 'm_sel') return { ENCa: '비상정지 b(1)', ENCb: '비상정지 b(2)', ENOa: '비상정지 a(1)', ENOb: '비상정지 a(2)', SNOa: 'SS1 a(1)', SNOb: 'SS1 a(2)', SNCa: 'SS1 b(1)', SNCb: 'SS1 b(2)' }[pid] || pid;
  if (t === 'm_relay') return `릴레이 R${+c.props.base + +pid[0]} ${pid.slice(1)}`;
  if (t === 'm_timer') return `타이머 T${+pid[0] + 1} ${pid.slice(1)}`;
  if (t === 'm_counter') return `카운터 C1 ${pid}`;
  if (t === 'm_lamp') return pid.startsWith('BZ') ? `부저 ${pid.slice(2)}` : `표시등 L${+pid[0] + 1} (${pid.slice(1)})`;
  if (t === 'p_supply3d') return `공압 공급 분배기 출구${pid.slice(1)}`;
  if (t === 'h_supply3d') return `파워유닛 ${pid[0].toUpperCase()}${pid.slice(1)}`;
  if (t.endsWith('_tee')) return '분기 티';
  if (pid.startsWith('S14') || pid.startsWith('S12')) return `${tag} 솔레노이드(${pid.slice(1, 3)}) ${pid.endsWith('a') ? '+' : '-'}`;
  const p = d.ports(c).find((q) => q.id === pid);
  const lab = p ? p.lab || p.id : pid;
  return `${tag || d.name} [${lab}]`;
}
