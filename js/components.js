// 부품 라이브러리: 기호(SVG) + 포트 + 속성 + 시뮬레이션 동작
import { L, P, R, C, PG, PL, T, head, arrow, springH, springV, adj, exhaustTri, throttleH, gaugeSym, tankSym, f } from './symbols.js';

// 매체별 물리 상수 (압력 bar, 유량 cm³/s, 면적 cm², 속도 cm/s)
export const MED = {
  pn: { Gopen: 40, Gvent: 40, Cnode: 3, crack: 0.2, Gthr: 40, pilotOn: 2.0, pilotOff: 1.2, pmax: 8 },
  hy: { Gopen: 200, Gvent: 200, Cnode: 0.3, crack: 1.0, Gthr: 20, Gr: 30, pilotOn: 10, pilotOff: 6, pmax: 100 },
};

export const REG = {};
const def = (d) => {
  d.props = d.props || [];
  REG[d.type] = d;
  return d;
};
const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export { DIRV };

const lbl = (x, y, t, c = 'lbl', a = 'middle') => ({ x, y, t, c, a });
const kindOf = (dom) => (dom === 'el' ? 'el' : dom);

// 공용 속성
const P_TAG = (d) => ({ k: 'tag', l: '이름(태그)', t: 'text', d });

/* =====================================================================
 *  방향제어밸브 (일반화)
 * ===================================================================*/
const ACT_W = 22;

function parsePath(p) {
  if (p.endsWith('|')) return { t: 'blk', a: p.slice(0, -1) };
  if (p.startsWith('*')) return { t: 'star', ids: p.slice(1).split(',') };
  const m = p.match(/^(\w+)([>\-])(\w+)$/);
  return { t: m[2] === '>' ? 'arr' : 'con', a: m[1], b: m[3] };
}

function valvePortX(spec, id) {
  for (const [pid, x] of spec.top) if (pid === id) return { x, top: true };
  for (const [pid, x] of spec.bot) if (pid === id) return { x, top: false };
  return null;
}

function boxPaths(spec, paths, bx, H) {
  let s = '';
  const W = spec.W;
  for (const raw of paths) {
    const p = parsePath(raw);
    if (p.t === 'blk') {
      const q = valvePortX(spec, p.a);
      const x = bx + q.x;
      if (q.top) s += L(x, 0, x, 8) + L(x - 5, 8, x + 5, 8);
      else s += L(x, H, x, H - 8) + L(x - 5, H - 8, x + 5, H - 8);
    } else if (p.t === 'star') {
      const cx = bx + W / 2, cy = H / 2;
      for (const id of p.ids) {
        const q = valvePortX(spec, id);
        s += L(bx + q.x, q.top ? 0 : H, cx, cy);
      }
      s += C(cx, cy, 2.2, 'fk');
    } else {
      const qa = valvePortX(spec, p.a), qb = valvePortX(spec, p.b);
      const xa = bx + qa.x, xb = bx + qb.x;
      if (qa.top !== qb.top) {
        const ya = qa.top ? 2 : H - 2, yb = qb.top ? 3 : H - 3;
        s += p.t === 'arr' ? arrow(xa, ya, xb, yb) : L(xa, ya, xb, yb);
      } else {
        const y0 = qa.top ? 0 : H, ym = qa.top ? 13 : H - 13;
        s += PL([[xa, y0], [xa, ym], [xb, ym], [xb, y0]]);
        if (p.t === 'arr') s += head(xb, ym, xb, qa.top ? 2 : H - 2);
      }
    }
  }
  return s;
}

// 조작부 그리기. e: 박스 가장자리 x, sg: -1(왼쪽)/+1(오른쪽)
function drawActs(acts, e, sg, H, on, dom, pilotPortX) {
  let s = '';
  let o = 0;
  const X = (d) => e + sg * (o + d);
  const yc = H / 2;
  for (const a of acts) {
    const active = on && a.t !== 'spring';
    if (a.t === 'spring') {
      s += springH(X(0), X(18), yc, 7, 4);
      o += 20;
    } else if (a.t === 'sol') {
      s += R(Math.min(X(0), X(11)), yc - 10, 11, 20, active ? 'on' : 'fw') + L(X(0), yc + 10, X(11), yc - 10);
      o += 12;
    } else if (a.t === 'push') {
      s += L(X(0), yc, X(8), yc) + P(`M${f(X(8))},${yc - 8} L${f(X(12))},${yc - 8} A8,8 0 0 ${sg < 0 ? 0 : 1} ${f(X(12))},${yc + 8} L${f(X(8))},${yc + 8} Z`, active ? 'on' : 'fw');
      o += 22;
    } else if (a.t === 'lever' || a.t === 'lever_det') {
      s += L(X(0), yc, X(8), yc) + L(X(8), yc + 6, X(18), yc - 12) + C(X(19), yc - 13, 2.4, active ? 'on' : 'fk');
      if (a.t === 'lever_det') s += PL([[X(2), yc - 14], [X(5), yc - 8], [X(8), yc - 14]]);
      o += 22;
    } else if (a.t === 'roller') {
      s += L(X(0), yc, X(6), yc) + L(X(6), yc, X(12), yc - 8) + C(X(16), yc - 10, 5, active ? 'on' : 'fw');
      o += 24;
    } else if (a.t === 'pilot') {
      const tipX = X(0), baseX = X(10);
      s += PG([[tipX, yc], [baseX, yc - 6], [baseX, yc + 6]], active ? 'on' : dom === 'hy' ? 'fk' : 'fw');
      // 파일럿 점선: 포트(고정)까지는 외부에서 그림
      o += 12;
    }
  }
  return s;
}

function actsWidth(acts) {
  let w = 0;
  for (const a of acts) w += a.t === 'spring' ? 20 : a.t === 'sol' ? 12 : a.t === 'pilot' ? 12 : a.t === 'roller' ? 24 : 22;
  return w;
}

function valveDef(o) {
  const spec = o.spec;
  spec.H = 40;
  const n = spec.pos.length;
  const x0 = -spec.rest * spec.W, x1 = (n - spec.rest) * spec.W;
  const hasPilotL = spec.L.some((a) => a.t === 'pilot');
  const hasPilotR = spec.R.some((a) => a.t === 'pilot');
  const lw = actsWidth(spec.L), rw = actsWidth(spec.R);
  const pLx = Math.floor((x0 - lw - 18) / 10) * 10;
  const pRx = Math.ceil((x1 + rw + 18) / 10) * 10;
  spec.pilotLX = pLx;
  spec.pilotRX = pRx;
  const exh = o.dom === 'pn' ? new Set(o.exh || ['3', '5']) : new Set();
  const props = [P_TAG(o.tag || (o.dom === 'pn' ? '1V1' : 'V1'))];
  for (const a of [...spec.L, ...spec.R]) {
    if (a.t === 'sol') props.push({ k: a.k, l: a.lab || '솔레노이드', t: 'text', d: a.d });
    if (a.t === 'roller') props.push({ k: a.k, l: '롤러 태그(실린더 센서)', t: 'text', d: a.d }, { k: 'cyl', l: '작동 실린더(3D)', t: 'cyl', d: '' }, { k: 'pos', l: '작동 위치(3D)', t: 'num', d: 0, min: 0, max: 1000, u: 'mm' });
  }
  if (o.extraProps) props.push(...o.extraProps);
  return def({
    type: o.type, name: o.name, dom: o.dom, cat: o.cat || '방향제어밸브', desc: o.desc,
    valve: spec,
    props,
    ports() {
      const k = kindOf(o.dom);
      const ps = [];
      for (const [id, x] of spec.top) ps.push({ id, x, y: -10, dir: 'up', kind: k, lab: o.plab?.[id] ?? id });
      for (const [id, x] of spec.bot) ps.push({ id, x, y: spec.H + 10, dir: 'down', kind: k, exh: exh.has(id), lab: o.plab?.[id] ?? id });
      if (hasPilotL) ps.push({ id: spec.pilotL, x: pLx, y: 20, dir: 'left', kind: k, pilot: true, lab: spec.pilotL });
      if (hasPilotR) ps.push({ id: spec.pilotR, x: pRx, y: 20, dir: 'right', kind: k, pilot: true, lab: spec.pilotR });
      return ps;
    },
    bbox() {
      return [hasPilotL ? pLx : x0 - lw - 4, -14, hasPilotR ? pRx : x1 + rw + 4, spec.H + 14];
    },
    draw(c, st, sim) {
      const pos = st ? st.pos : spec.rest;
      const sh = (spec.rest - pos) * spec.W;
      const H = spec.H;
      let b = '';
      for (const [, x] of spec.top) b += L(x, -10, x, 0);
      for (const [id, x] of spec.bot) {
        b += L(x, H, x, H + 10);
        if (exh.has(id) && c._open && c._open.has(id)) b += exhaustTri(x, H + 10);
      }
      let g = '';
      for (let i = 0; i < n; i++) {
        const bx = (i - spec.rest) * spec.W;
        g += R(bx, 0, spec.W, H, 'fw') + boxPaths(spec, spec.pos[i], bx, H);
      }
      const onL = st ? st.actL : false, onR = st ? st.actR : false;
      g += drawActs(spec.L, x0, -1, H, onL, o.dom);
      g += drawActs(spec.R, x1, 1, H, onR, o.dom);
      if (o.drawExtra) g += o.drawExtra(c, st, x0, x1);
      b += `<g transform="translate(${sh},0)">${g}</g>`;
      if (hasPilotL) b += L(pLx, 20, x0 + sh - actsWidth(spec.L.filter((a) => a.t !== 'pilot')) - 10, 20, 'dash');
      if (hasPilotR) b += L(pRx, 20, x1 + sh + actsWidth(spec.R.filter((a) => a.t !== 'pilot')) + 10, 20, 'dash');
      const ls = [lbl(x0 + 2, H + 19, c.props.tag, 'lbl', 'start')];
      let ox = 0;
      for (const a of spec.L) {
        const w = actsWidth([a]);
        if (a.k && c.props[a.k]) ls.push(lbl(x0 - ox - w / 2 - 2, -4, c.props[a.k], 'tag'));
        ox += w;
      }
      ox = 0;
      for (const a of spec.R) {
        const w = actsWidth([a]);
        if (a.k && c.props[a.k]) ls.push(lbl(x1 + ox + w / 2 + 2, -4, c.props[a.k], 'tag'));
        ox += w;
      }
      if (o.labelsExtra) ls.push(...o.labelsExtra(c, st, sim, x0, x1));
      return { b, l: ls };
    },
    // 3D 실습실: 솔레노이드 커넥터 잭
    jacks() {
      const js = [];
      if (spec.L.some((a) => a.t === 'sol')) js.push({ id: 'S14a', kind: 'el', lab: '+' }, { id: 'S14b', kind: 'el', lab: '-' });
      if (spec.R.some((a) => a.t === 'sol')) js.push({ id: 'S12a', kind: 'el', lab: '+' }, { id: 'S12b', kind: 'el', lab: '-' });
      return js;
    },
    elec: [...spec.L, ...spec.R].some((a) => a.t === 'sol') ? (c, st, k) => {
      if (spec.L.some((a) => a.t === 'sol')) k.load('S14a', 'S14b', (on) => { st.e14 = on; });
      if (spec.R.some((a) => a.t === 'sol')) k.load('S12a', 'S12b', (on) => { st.e12 = on; });
    } : undefined,
    // 시뮬레이션: 위치에 따른 통로 연결
    fluid(c, st, k) {
      const g = MED[o.dom].Gopen;
      for (const raw of spec.pos[st.pos]) {
        const p = parsePath(raw);
        if (p.t === 'arr' || p.t === 'con') k.G(p.a, p.b, g);
        else if (p.t === 'star') for (let i = 1; i < p.ids.length; i++) k.G(p.ids[0], p.ids[i], g);
      }
      if (o.fluidExtra) o.fluidExtra(c, st, k);
    },
    press(c, st, sim, lx) {
      const side = lx < (x0 + x1) / 2 ? 'L' : 'R';
      const acts = side === 'L' ? spec.L : spec.R;
      if (acts.some((a) => a.t === 'lever_det')) {
        if (n === 2) st.pos = st.pos === 0 ? 1 : 0;
        else st.pos = side === 'L' ? Math.max(0, st.pos - 1) : Math.min(2, st.pos + 1);
        return;
      }
      if (n === 3 && c.props.det) {
        st.pos = side === 'L' ? Math.max(0, st.pos - 1) : Math.min(2, st.pos + 1);
        return;
      }
      st.man[side] = true;
    },
    release(c, st) {
      st.man.L = false;
      st.man.R = false;
    },
    init(c, st) {
      st.pos = spec.rest;
      st.man = { L: false, R: false };
      st.pil = { L: false, R: false };
      st.actL = false;
      st.actR = false;
    },
  });
}

// 밸브 위치 결정 (엔진에서 호출)
export function valveUpdate(c, d, st, sim, k, dt) {
  const spec = d.valve;
  const n = spec.pos.length;
  const med = MED[d.dom];
  const sideOn = (acts, side) => {
    let on = false;
    for (const a of acts) {
      if (a.t === 'sol') on = on || sim.solOn(c.props[a.k]) || st.man[side] || !!(side === 'L' ? st.e14 : st.e12);
      else if (a.t === 'push' || a.t === 'lever') on = on || st.man[side];
      else if (a.t === 'roller') on = on || sim.markOn(c.props[a.k]) || st.man[side] || !!st.att;
      else if (a.t === 'pilot') {
        const pid = side === 'L' ? spec.pilotL : spec.pilotR;
        const p = k.p(pid);
        if (st.pil[side]) st.pil[side] = p > med.pilotOff;
        else st.pil[side] = p >= med.pilotOn;
        if (spec.timer) {
          st.tacc = st.pil[side] ? (st.tacc || 0) + dt : 0;
          on = on || (st.pil[side] && st.tacc >= +c.props.delay);
        } else on = on || st.pil[side];
      }
    }
    return on;
  };
  const lOn = sideOn(spec.L, 'L');
  const rOn = sideOn(spec.R, 'R');
  st.actL = lOn;
  st.actR = rOn;
  const lSpring = spec.L.some((a) => a.t === 'spring');
  const rSpring = spec.R.some((a) => a.t === 'spring');
  if (n === 2) {
    if (rSpring) st.pos = lOn ? 0 : 1;
    else if (lSpring) st.pos = rOn ? 1 : 0;
    else if (lOn && !rOn) st.pos = 0;
    else if (rOn && !lOn) st.pos = 1;
  } else {
    if (lOn && !rOn) st.pos = 0;
    else if (rOn && !lOn) st.pos = 2;
    else if (spec.center === 'spring' && !c.props.det) st.pos = 1;
    else if (spec.center === 'spring' && c.props.det && (lOn || rOn)) st.pos = 1;
  }
}

const A = {
  sol: (k = 'sol14', d = 'Y1', lab) => ({ t: 'sol', k, d, lab }),
  spring: { t: 'spring' },
  push: { t: 'push' },
  lever: { t: 'lever' },
  leverDet: { t: 'lever_det' },
  roller: (d = 'S1') => ({ t: 'roller', k: 'roll', d }),
  pilot: { t: 'pilot' },
};

/* ---------- 공압 방향제어밸브 ---------- */
const PN32 = { W: 40, top: [['2', 10]], bot: [['1', 10], ['3', 30]] };
const nc32 = [['1>2', '3|'], ['2>3', '1|']];
const no32 = [['2>3', '1|'], ['1>2', '3|']];
const PN52 = { W: 60, top: [['4', 20], ['2', 40]], bot: [['5', 10], ['1', 30], ['3', 50]] };
const pos52 = [['1>4', '2>3', '5|'], ['1>2', '4>5', '3|']];

valveDef({ type: 'pv32_push_nc', name: '3/2 밸브 (누름버튼, NC)', dom: 'pn', desc: '누르는 동안 1→2 공급, 놓으면 스프링 복귀(2→3 배기).',
  spec: { ...PN32, pos: nc32, rest: 1, L: [A.push], R: [A.spring] } });
valveDef({ type: 'pv32_push_no', name: '3/2 밸브 (누름버튼, NO)', dom: 'pn', desc: '평상시 1→2 열림, 누르면 차단·배기.',
  spec: { ...PN32, pos: no32, rest: 1, L: [A.push], R: [A.spring] } });
valveDef({ type: 'pv32_roller_nc', name: '3/2 리밋밸브 (롤러, NC)', dom: 'pn', tag: '1S1', desc: '실린더 센서 위치(태그)에 도달하면 작동.',
  spec: { ...PN32, pos: nc32, rest: 1, L: [A.roller('1S1')], R: [A.spring] } });
valveDef({ type: 'pv32_lever_det', name: '3/2 밸브 (수동레버, 디텐트)', dom: 'pn', desc: '클릭하여 위치 전환(유지형 선택 스위치).',
  spec: { ...PN32, pos: nc32, rest: 1, L: [A.leverDet], R: [] } });
valveDef({ type: 'pv32_sol_nc', name: '3/2 솔레노이드 밸브 (편솔, NC)', dom: 'pn', desc: '솔레노이드 여자 시 1→2.',
  spec: { ...PN32, pos: nc32, rest: 1, L: [A.sol('sol14', 'Y1')], R: [A.spring] } });
valveDef({ type: 'pv32_pilot_nc', name: '3/2 공압 파일럿 밸브 (NC)', dom: 'pn', desc: '파일럿(12) 압력으로 작동.',
  spec: { ...PN32, pos: nc32, rest: 1, L: [A.pilot], R: [A.spring], pilotL: '12' } });
valveDef({ type: 'pv52_push', name: '5/2 밸브 (누름버튼)', dom: 'pn', desc: '누르는 동안 1→4, 놓으면 1→2.',
  spec: { ...PN52, pos: pos52, rest: 1, L: [A.push], R: [A.spring] } });
valveDef({ type: 'pv52_lever_det', name: '5/2 밸브 (수동레버, 디텐트)', dom: 'pn', desc: '클릭할 때마다 위치 전환·유지.',
  spec: { ...PN52, pos: pos52, rest: 1, L: [A.leverDet], R: [] } });
valveDef({ type: 'pv52_sol', name: '5/2 솔레노이드 밸브 (편솔)', dom: 'pn', desc: 'Y 여자 시 1→4, 소자 시 스프링 복귀 1→2.',
  spec: { ...PN52, pos: pos52, rest: 1, L: [A.sol('sol14', 'Y1')], R: [A.spring] } });
valveDef({ type: 'pv52_dsol', name: '5/2 솔레노이드 밸브 (양솔)', dom: 'pn', desc: '양쪽 솔레노이드, 기억(메모리) 기능.',
  spec: { ...PN52, pos: pos52, rest: 1, L: [A.sol('sol14', 'Y1', '솔레노이드(14)')], R: [A.sol('sol12', 'Y2', '솔레노이드(12)')] } });
valveDef({ type: 'pv52_pilot', name: '5/2 공압 파일럿 밸브 (편측)', dom: 'pn', desc: '파일럿(14) 압력 시 1→4, 스프링 복귀.',
  spec: { ...PN52, pos: pos52, rest: 1, L: [A.pilot], R: [A.spring], pilotL: '14' } });
valveDef({ type: 'pv52_dpilot', name: '5/2 공압 파일럿 밸브 (양측)', dom: 'pn', desc: '14/12 파일럿 신호로 전환, 기억 기능.',
  spec: { ...PN52, pos: pos52, rest: 1, L: [A.pilot], R: [A.pilot], pilotL: '14', pilotR: '12' } });
valveDef({ type: 'pv53_dsol_cc', name: '5/3 솔레노이드 밸브 (올포트블록)', dom: 'pn', desc: '중립 위치에서 모든 포트 차단(중간 정지).',
  spec: { ...PN52, pos: [pos52[0], ['4|', '2|', '5|', '1|', '3|'], pos52[1]], rest: 1, center: 'spring', L: [A.sol('sol14', 'Y1', '솔레노이드(14)'), A.spring], R: [A.sol('sol12', 'Y2', '솔레노이드(12)'), A.spring] } });

// 공압 시간지연 밸브 (NC) : 파일럿 압력이 설정 시간 유지되면 1→2
valveDef({ type: 'pv_timer', name: '시간지연 밸브 (공압 타이머, NC)', dom: 'pn', cat: '압력·유량·논리', tag: '1V3',
  desc: '파일럿(12) 압력이 설정 시간 이상 유지되면 1→2 열림.',
  spec: { ...PN32, pos: nc32, rest: 1, L: [A.pilot], R: [A.spring], pilotL: '12', timer: true },
  extraProps: [{ k: 'delay', l: '지연 시간', t: 'num', d: 2, min: 0, max: 60, step: 0.1, u: 's', live: true }],
  drawExtra: () => '',
  labelsExtra: (c, st) => [lbl(-60, 48, st && st.tacc != null ? `${Math.min(st.tacc, c.props.delay).toFixed(1)}/${c.props.delay}s` : `${c.props.delay}s`, 'val')],
});

/* ---------- 유압 방향제어밸브 ---------- */
const HY4 = { W: 40, top: [['A', 10], ['B', 30]], bot: [['P', 10], ['T', 30]] };
const h42 = [['P>A', 'B>T'], ['P>B', 'A>T']];
const centers = {
  closed: ['P|', 'T|', 'A|', 'B|'],
  tandem: ['P-T', 'A|', 'B|'],
  open: ['*P,T,A,B'],
  float: ['P|', '*A,B,T'],
};
valveDef({ type: 'hv42_sol', name: '4/2 솔레노이드 밸브 (편솔)', dom: 'hy', desc: 'Y 여자 시 P→A, B→T. 소자 시 P→B, A→T.',
  spec: { ...HY4, pos: h42, rest: 1, L: [A.sol('sol14', 'Y1', '솔레노이드(a)')], R: [A.spring] } });
valveDef({ type: 'hv42_dsol', name: '4/2 솔레노이드 밸브 (양솔)', dom: 'hy', desc: '양솔 디텐트(기억) 형.',
  spec: { ...HY4, pos: h42, rest: 1, L: [A.sol('sol14', 'Y1', '솔레노이드(a)')], R: [A.sol('sol12', 'Y2', '솔레노이드(b)')] } });
valveDef({ type: 'hv42_lever', name: '4/2 수동 레버 밸브 (디텐트)', dom: 'hy', desc: '클릭하여 위치 전환.',
  spec: { ...HY4, pos: h42, rest: 1, L: [A.leverDet], R: [] } });
for (const [ck, cn] of [['closed', '올포트블록(클로즈드)'], ['tandem', '탠덤 센터'], ['open', '오픈 센터'], ['float', 'ABT 접속(플로트)']]) {
  valveDef({ type: `hv43_sol_${ck}`, name: `4/3 솔레노이드 밸브 (${cn})`, dom: 'hy',
    desc: `양솔 스프링 센터형. 중립: ${cn}.`,
    spec: { ...HY4, pos: [h42[0], centers[ck], h42[1]], rest: 1, center: 'spring', L: [A.sol('sol14', 'Y1', '솔레노이드(a)'), A.spring], R: [A.sol('sol12', 'Y2', '솔레노이드(b)'), A.spring] } });
}
for (const [ck, cn] of [['tandem', '탠덤 센터'], ['closed', '올포트블록'], ['float', 'ABT 접속(플로트)']]) {
  valveDef({ type: `hv43_lever_${ck}`, name: `4/3 수동 레버 밸브 (${cn})`, dom: 'hy',
    desc: '레버를 클릭(누르는 동안)하여 전환. 디텐트 속성 선택 가능.',
    spec: { ...HY4, pos: [h42[0], centers[ck], h42[1]], rest: 1, center: 'spring', L: [A.lever, A.spring], R: [A.lever, A.spring] },
    extraProps: [{ k: 'det', l: '디텐트(위치 유지)', t: 'bool', d: false }] });
}
valveDef({ type: 'hv22_sol', name: '2/2 솔레노이드 밸브 (NC)', dom: 'hy', desc: '여자 시 P→A 열림.',
  spec: { W: 40, top: [['A', 20]], bot: [['P', 20]], pos: [['P>A'], ['P|', 'A|']], rest: 1, L: [A.sol('sol14', 'Y1')], R: [A.spring] } });
valveDef({ type: 'pv22_sol', name: '2/2 솔레노이드 밸브 (NC)', dom: 'pn', exh: [], plab: { A: '2', P: '1' }, desc: '여자 시 1→2 열림.',
  spec: { W: 40, top: [['A', 20]], bot: [['P', 20]], pos: [['P>A'], ['P|', 'A|']], rest: 1, L: [A.sol('sol14', 'Y1')], R: [A.spring] } });

/* =====================================================================
 *  액추에이터
 * ===================================================================*/
export function parseMarks(c) {
  const out = [];
  const L0 = +c.props.stroke || 100;
  if (c.props.sw0) out.push({ tag: c.props.sw0.trim(), pos: 0 });
  if (c.props.sw1) out.push({ tag: c.props.sw1.trim(), pos: L0 });
  if (c.props.swm) {
    for (const part of String(c.props.swm).split(/[,;]/)) {
      const m = part.trim().match(/^([^@:]+)[@:]\s*([\d.]+)$/);
      if (m) out.push({ tag: m[1].trim(), pos: Math.min(L0, +m[2]) });
    }
  }
  return out.filter((m) => m.tag);
}

function cylDef(o) {
  const dom = o.dom;
  const props = [
    P_TAG(dom === 'pn' ? '1A' : 'A1'),
    { k: 'bore', l: '실린더 내경', t: 'num', d: dom === 'pn' ? 20 : 40, min: 6, max: 200, u: 'mm' },
    { k: 'rod', l: '로드 지름', t: 'num', d: dom === 'pn' ? 8 : 22, min: 2, max: 150, u: 'mm' },
    { k: 'stroke', l: '행정 거리', t: 'num', d: dom === 'pn' ? 100 : 200, min: 10, max: 1000, u: 'mm' },
    { k: 'load', l: '부하 (+:전진 저항)', t: 'num', d: 0, min: -20000, max: 20000, u: 'N', live: true },
    { k: 'x0', l: '초기 위치', t: 'num', d: 0, min: 0, max: 100, u: '%' },
    { k: 'sw0', l: '후진끝 센서/리밋 태그', t: 'text', d: '' },
    { k: 'sw1', l: '전진끝 센서/리밋 태그', t: 'text', d: '' },
    { k: 'swm', l: '중간 센서 (태그@mm, ...)', t: 'text', d: '' },
  ];
  return def({
    type: o.type, name: o.name, dom, cat: '액추에이터', desc: o.desc, props,
    ports() {
      const k = kindOf(dom);
      const ps = [{ id: 'A', x: 20, y: 40, dir: 'down', kind: k, lab: dom === 'pn' ? '' : 'A' }];
      if (!o.single) ps.push({ id: 'B', x: 100, y: 40, dir: 'down', kind: k, lab: dom === 'pn' ? '' : 'B' });
      return ps;
    },
    bbox: () => [-2, -34, 250, 44],
    draw(c, st) {
      const L0 = +c.props.stroke || 100;
      const fr = st ? Math.max(0, Math.min(1, st.x / L0)) : (+c.props.x0 || 0) / 100;
      const xp = 4 + fr * 100;
      let b = R(0, 0, 120, 30, dom === 'hy' ? 'fh' : 'fw');
      b += L(20, 30, 20, 40);
      if (!o.single) b += L(100, 30, 100, 40);
      else b += L(100, 30, 100, 34) + L(96, 34, 104, 34);
      if (o.single) b += springH(xp + 8, 117, 15, 9, 6);
      b += R(xp + 6, 12, 134, 6, 'fw') + R(xp, 1, 6, 28, 'fk');
      b += L(xp + 140, 9, xp + 140, 21);
      const ls = [lbl(60, 58, c.props.tag)];
      const marks = parseMarks(c);
      if (marks.length) {
        b += L(144, -6, 244, -6, 'thin');
        for (const m of marks) {
          const mx = 144 + 100 * (m.pos / L0);
          b += L(mx, -2, mx, -12, 'mark');
          ls.push(lbl(mx, -16, m.tag, 'tag'));
        }
      }
      if (st) ls.push(lbl(60, -10, `${st.x.toFixed(0)} mm`, 'val'));
      return { b, l: ls };
    },
    init(c, st) {
      st.x = ((+c.props.x0 || 0) / 100) * (+c.props.stroke || 100);
      st.v = 0;
      st.mode = 0;
    },
    fluid(c, st, k) {
      const bore = +c.props.bore / 10, rod = +c.props.rod / 10; // cm
      const Aa = (Math.PI * bore * bore) / 4;
      const Ab = Aa - (Math.PI * rod * rod) / 4;
      const Lm = +c.props.stroke || 100;
      let F = (+c.props.load || 0) / 10; // N -> bar·cm²
      let cf = dom === 'pn' ? 0.25 * Aa : 0.5 * Aa;
      if (o.single) {
        const fr = st.x / Lm;
        F += dom === 'pn' ? Aa * (1.0 + 1.0 * fr) : Aa * (3 + 3 * fr);
        cf = dom === 'pn' ? 0.15 * Aa : 0.4 * Aa;
      }
      k.cyl('A', o.single ? null : 'B', Aa, o.single ? 0 : Ab, cf, F, st, Lm);
    },
  });
}
cylDef({ type: 'p_cyl_double', name: '복동 실린더', dom: 'pn', desc: '양쪽 포트에 공기를 공급하여 전진/후진.' });
cylDef({ type: 'p_cyl_single', name: '단동 실린더 (스프링 복귀)', dom: 'pn', single: true, desc: '공기 공급 시 전진, 배기 시 스프링으로 후진.' });
cylDef({ type: 'h_cyl_double', name: '복동 실린더', dom: 'hy', desc: '유압 복동 실린더 (편로드).' });
cylDef({ type: 'h_cyl_single', name: '단동 실린더 (스프링 복귀)', dom: 'hy', single: true, desc: '압유 공급 시 전진, 스프링 복귀.' });

function motorDef(o) {
  return def({
    type: o.type, name: o.name, dom: o.dom, cat: '액추에이터', desc: o.desc,
    props: [P_TAG(o.dom === 'pn' ? '1M' : 'M1'), { k: 'disp', l: '배제용적', t: 'num', d: o.dom === 'pn' ? 2 : 8, min: 0.5, max: 200, u: 'cm³/rev' },
      { k: 'torque', l: '부하 토크', t: 'num', d: 0, min: 0, max: 500, u: 'N·m', live: true }],
    ports: () => [
      { id: 'A', x: 0, y: -30, dir: 'up', kind: o.dom, lab: 'A' },
      { id: 'B', x: 0, y: 30, dir: 'down', kind: o.dom, lab: 'B' },
    ],
    bbox: () => [-24, -30, 40, 30],
    draw(c, st) {
      const tri = o.dom === 'hy' ? 'fk' : 'fw';
      let b = L(0, -30, 0, -20) + L(0, 20, 0, 30) + C(0, 0, 20, 'fw');
      b += PG([[0, -10], [-6, -19], [6, -19]], tri) + PG([[0, 10], [-6, 19], [6, 19]], tri);
      b += L(20, -2, 34, -2) + L(20, 2, 34, 2);
      const a = st ? st.ang : 0;
      b += L(0, 0, 9 * Math.cos(a), 9 * Math.sin(a), 'rot') + C(0, 0, 1.8, 'fk');
      const ls = [lbl(-30, 4, c.props.tag, 'lbl', 'end')];
      if (st) ls.push(lbl(30, 22, `${(st.w * 60).toFixed(0)} rpm`, 'val', 'start'));
      return { b, l: ls };
    },
    init(c, st) { st.ang = 0; st.w = 0; },
    fluid(c, st, k) {
      const D = +c.props.disp;
      // 1 bar·cm³ = 0.1 J → 부하토크 T[N·m] 1회전 일 = 2πT[J] = 20πT [bar·cm³]
      const Tq = 20 * Math.PI * (+c.props.torque || 0);
      k.motor('A', 'B', D, o.dom === 'hy' ? 0.3 * D : 0.4 * D, Tq, st);
    },
  });
}
motorDef({ type: 'h_motor', name: '유압 모터 (양방향)', dom: 'hy', desc: 'A→B 또는 B→A 흐름에 따라 회전.' });
motorDef({ type: 'p_motor', name: '공압 모터 (양방향)', dom: 'pn', desc: '공기 흐름 방향에 따라 회전.' });

/* =====================================================================
 *  공압 공급 · 보조 기기
 * ===================================================================*/
def({
  type: 'p_source', name: '공압 공급원', dom: 'pn', cat: '공급원·보조기기', desc: '압축공기 공급원 (설정 압력).',
  props: [{ k: 'p', l: '공급 압력', t: 'num', d: 6, min: 1, max: 10, step: 0.1, u: 'bar', live: true }],
  ports: () => [{ id: '1', x: 0, y: -20, dir: 'up', kind: 'pn' }],
  bbox: () => [-14, -20, 14, 14],
  draw(c) {
    return { b: L(0, -20, 0, -10) + C(0, 0, 10, 'fw') + PG([[0, -6], [-5, 3], [5, 3]], 'fk'), l: [lbl(16, 4, `${c.props.p} bar`, 'val', 'start')] };
  },
  fluid(c, st, k) { k.Gp('1', +c.props.p, 100); },
});
def({
  type: 'p_frl', name: '서비스 유닛 (FRL)', dom: 'pn', cat: '공급원·보조기기', desc: '필터·레귤레이터·압력계. 출구 압력을 설정값으로 조정.',
  props: [{ k: 'p', l: '조정 압력', t: 'num', d: 6, min: 0.5, max: 10, step: 0.1, u: 'bar', live: true }],
  ports: () => [{ id: '1', x: -40, y: 0, dir: 'left', kind: 'pn' }, { id: '2', x: 40, y: 0, dir: 'right', kind: 'pn' }],
  bbox: () => [-40, -38, 40, 18],
  draw(c, st, sim) {
    let b = L(-40, 0, -30, 0) + L(30, 0, 40, 0) + R(-30, -16, 60, 32, 'dash');
    b += PG([[-24, 0], [-14, -10], [-4, 0], [-14, 10]], 'fw') + L(-14, -10, -14, 10, 'dash') + L(-30, 0, -24, 0) + L(-4, 0, 4, 0);
    b += R(4, -10, 20, 20, 'fw') + arrow(14, 8, 14, -8) + springH(24, 30, 0, 4, 2);
    b += L(14, -10, 14, -24) + gaugeSym(14, -28, 8) + L(24, 0, 30, 0);
    const ls = [];
    if (sim) ls.push(lbl(26, -30, `${sim.pAt(c, '2').toFixed(1)} bar`, 'val', 'start'));
    else ls.push(lbl(26, -30, `${c.props.p} bar`, 'val', 'start'));
    return { b, l: ls };
  },
  fluid(c, st, k) { k.reduce('1', '2', 40, +c.props.p, 'r'); },
});

/* 유량 · 압력 · 논리 밸브 (공압 / 유압 공통 생성) */
function throttleDef(dom) {
  return def({
    type: `${dom === 'pn' ? 'p' : 'h'}_throttle`, name: '교축 밸브 (가변)', dom, cat: dom === 'pn' ? '압력·유량·논리' : '유량제어밸브',
    desc: '양방향으로 유량을 제한.',
    props: [P_TAG(dom === 'pn' ? '1V2' : 'V2'), { k: 'open', l: '개도', t: 'num', d: 50, min: 0, max: 100, u: '%', live: true }],
    ports: () => [{ id: '1', x: -30, y: 0, dir: 'left', kind: dom }, { id: '2', x: 30, y: 0, dir: 'right', kind: dom }],
    bbox: () => [-30, -16, 30, 16],
    draw(c) {
      return { b: L(-30, 0, -8, 0) + L(8, 0, 30, 0) + throttleH(0, 0, 16) + adj(0, 0, 13), l: [lbl(0, 28, `${c.props.tag} ${c.props.open}%`, 'val')] };
    },
    fluid(c, st, k) {
      const s = Math.max(0, Math.min(100, +c.props.open)) / 100;
      k.G('1', '2', MED[dom].Gthr * s * s + 1e-6);
    },
  });
}
throttleDef('pn');
throttleDef('hy');

function oneWayDef(dom) {
  return def({
    type: `${dom === 'pn' ? 'p' : 'h'}_flow_oneway`, name: '일방향 유량제어 밸브', dom, cat: dom === 'pn' ? '압력·유량·논리' : '유량제어밸브',
    desc: '1→2 자유흐름(체크), 2→1 교축. 미터인/미터아웃 속도제어용.',
    props: [P_TAG(dom === 'pn' ? '1V2' : 'V2'), { k: 'open', l: '개도', t: 'num', d: 40, min: 0, max: 100, u: '%', live: true }],
    ports: () => [{ id: '1', x: -40, y: 0, dir: 'left', kind: dom }, { id: '2', x: 40, y: 0, dir: 'right', kind: dom }],
    bbox: () => [-40, -16, 40, 30],
    draw(c) {
      let b = L(-40, 0, -8, 0) + L(8, 0, 40, 0) + throttleH(0, 0, 16) + adj(0, 0, 13);
      b += L(-20, 0, -20, 18) + L(-20, 18, -9, 18) + L(9, 18, 20, 18) + L(20, 18, 20, 0);
      b += C(-1, 18, 4.5, 'fw') + PL([[6, 11], [2, 18], [6, 25]]);
      b += R(-28, -14, 56, 40, 'dash');
      return { b, l: [lbl(0, 40, `${c.props.tag} ${c.props.open}%`, 'val')] };
    },
    fluid(c, st, k) {
      const s = Math.max(0, Math.min(100, +c.props.open)) / 100;
      k.G('1', '2', MED[dom].Gthr * s * s + 1e-6);
      k.check('1', '2', MED[dom].Gopen, MED[dom].crack, 'ck');
    },
  });
}
oneWayDef('pn');
oneWayDef('hy');

function checkDef(dom) {
  return def({
    type: `${dom === 'pn' ? 'p' : 'h'}_check`, name: '체크 밸브', dom, cat: dom === 'pn' ? '압력·유량·논리' : '압력제어·체크밸브',
    desc: '1→2 방향으로만 흐름.',
    props: [P_TAG(dom === 'pn' ? '1V4' : 'V3')],
    ports: () => [{ id: '1', x: -20, y: 0, dir: 'left', kind: dom }, { id: '2', x: 20, y: 0, dir: 'right', kind: dom }],
    bbox: () => [-20, -12, 20, 12],
    draw(c) {
      return { b: L(-20, 0, -7, 0) + L(4, 0, 20, 0) + C(-2, 0, 5, 'fw') + PL([[6, -8], [1, 0], [6, 8]]), l: [lbl(0, 24, c.props.tag)] };
    },
    fluid(c, st, k) { k.check('1', '2', MED[dom].Gopen, MED[dom].crack, 'ck'); },
  });
}
checkDef('pn');
checkDef('hy');

function gaugeDef(dom) {
  return def({
    type: `${dom === 'pn' ? 'p' : 'h'}_gauge`, name: '압력계', dom, cat: dom === 'pn' ? '공급원·보조기기' : '공급·보조기기',
    desc: '연결점의 압력을 표시.', props: [],
    ports: () => [{ id: '1', x: 0, y: 20, dir: 'down', kind: dom }],
    bbox: () => [-14, -14, 14, 20],
    draw(c, st, sim) {
      const p = sim ? sim.pAt(c, '1') : null;
      return { b: L(0, 12, 0, 20) + gaugeSym(0, 0, 12), l: [lbl(16, 4, p == null ? '' : `${p.toFixed(1)} bar`, 'val', 'start')] };
    },
  });
}
gaugeDef('pn');
gaugeDef('hy');

function pswitchDef(dom) {
  return def({
    type: `${dom === 'pn' ? 'p' : 'h'}_pswitch`, name: '압력 스위치', dom, cat: dom === 'pn' ? '압력·유량·논리' : '압력제어·체크밸브',
    desc: '설정 압력 이상이면 같은 태그의 압력스위치 접점이 작동.',
    props: [P_TAG('PS1'), { k: 'p', l: '설정 압력', t: 'num', d: dom === 'pn' ? 4 : 30, min: 0.1, max: 300, step: 0.1, u: 'bar', live: true }],
    ports: () => [{ id: '1', x: 0, y: 30, dir: 'down', kind: dom }],
    bbox: () => [-16, -16, 30, 30],
    draw(c, st, sim) {
      let b = L(0, 14, 0, 30) + R(-14, -14, 28, 28, 'fw') + L(-4, 14, -4, 6, 'dash') + PG([[-4, 2], [-8, 8], [0, 8]], dom === 'hy' ? 'fk' : 'fw');
      b += springV(8, -14, -2, 3, 3) + L(-2, -8, 6, -2);
      const on = sim && sim.ps.get(c.props.tag);
      b += PL([[14, 0], [22, 0], [22, -8]], on ? 'live' : '');
      return { b, l: [lbl(18, 26, `${c.props.tag} ${c.props.p}bar`, 'tag', 'start')] };
    },
    jacks: () => [{ id: 'C', kind: 'el', lab: 'COM' }, { id: 'NO', kind: 'el', lab: 'NO' }, { id: 'NC', kind: 'el', lab: 'NC' }],
    elec(c, st, k) { k.contact('C', 'NO', !!st.on); k.contact('C', 'NC', !st.on); },
    post(c, st, sim) {
      const p = sim.pAt(c, '1');
      const was = st.on;
      st.on = was ? p > +c.props.p * 0.95 - 0.05 : p >= +c.props.p;
      if (st.on) sim.ps.set(c.props.tag, true);
    },
  });
}
pswitchDef('pn');
pswitchDef('hy');

def({
  type: 'p_shuttle', name: '셔틀 밸브 (OR)', dom: 'pn', cat: '압력·유량·논리', desc: '두 입력 중 하나라도 압력이 있으면 출력(OR).',
  props: [P_TAG('1V5')],
  ports: () => [
    { id: 'X', x: -30, y: 0, dir: 'left', kind: 'pn', lab: '1' },
    { id: 'Y', x: 30, y: 0, dir: 'right', kind: 'pn', lab: '1' },
    { id: 'A', x: 0, y: -20, dir: 'up', kind: 'pn', lab: '2' },
  ],
  bbox: () => [-30, -20, 30, 12],
  draw(c, st) {
    const bx = st && st.sel === 'Y' ? -5 : 5;
    let b = L(-30, 0, -16, 0) + L(16, 0, 30, 0) + R(-16, -7, 32, 14, 'fw') + L(0, -7, 0, -20);
    b += PL([[-12, -7], [-9, 0], [-12, 7]]) + PL([[12, -7], [9, 0], [12, 7]]) + C(bx, 0, 4.5, 'fw');
    return { b, l: [lbl(0, 24, c.props.tag)] };
  },
  init(c, st) { st.sel = 'X'; },
  fluid(c, st, k) {
    const px = k.p('X'), py = k.p('Y');
    if (py > px + 0.05) st.sel = 'Y';
    else if (px > py + 0.05) st.sel = 'X';
    k.G(st.sel, 'A', MED.pn.Gopen);
  },
});
def({
  type: 'p_twopress', name: '2압 밸브 (AND)', dom: 'pn', cat: '압력·유량·논리', desc: '두 입력 모두 압력이 있어야 출력(AND).',
  props: [P_TAG('1V5')],
  ports: () => [
    { id: 'X', x: -30, y: 0, dir: 'left', kind: 'pn', lab: '1' },
    { id: 'Y', x: 30, y: 0, dir: 'right', kind: 'pn', lab: '1' },
    { id: 'A', x: 0, y: -20, dir: 'up', kind: 'pn', lab: '2' },
  ],
  bbox: () => [-30, -20, 30, 12],
  draw(c, st) {
    let b = L(-30, 0, -16, 0) + L(16, 0, 30, 0) + R(-16, -7, 32, 14, 'fw') + L(0, -7, 0, -20);
    const sx = st && st.sel === 'X' ? 6 : -6;
    b += R(-12, -4, 8, 8, '') + R(4, -4, 8, 8, '') + L(-4, 0, 4, 0) + R(sx - 3, -3, 6, 6, 'fk');
    return { b, l: [lbl(0, 24, c.props.tag)] };
  },
  init(c, st) { st.sel = 'X'; },
  fluid(c, st, k) {
    const px = k.p('X'), py = k.p('Y');
    if (px < py - 0.05) st.sel = 'X';
    else if (py < px - 0.05) st.sel = 'Y';
    k.G(st.sel, 'A', MED.pn.Gopen);
  },
});
def({
  type: 'p_qexh', name: '급속 배기 밸브', dom: 'pn', cat: '압력·유량·논리', desc: '실린더 배기를 직접 대기로 방출하여 속도 증가.',
  props: [P_TAG('1V6')],
  ports: () => [
    { id: '1', x: -30, y: 0, dir: 'left', kind: 'pn' },
    { id: '2', x: 30, y: 0, dir: 'right', kind: 'pn' },
  ],
  bbox: () => [-30, -12, 30, 26],
  draw(c, st) {
    let b = L(-30, 0, -14, 0) + L(14, 0, 30, 0) + R(-14, -8, 28, 16, 'fw') + L(0, 8, 0, 16) + exhaustTri(0, 16);
    b += C(st && st.ex ? 6 : -6, 0, 4, 'fw');
    return { b, l: [lbl(0, -14, c.props.tag)] };
  },
  init(c, st) { st.ex = false; },
  fluid(c, st, k) {
    k.check('1', '2', MED.pn.Gopen, 0.1, 'ck');
    const p1 = k.p('1'), p2 = k.p('2');
    st.ex = p2 > p1 + 0.3;
    if (st.ex) k.G('2', null, MED.pn.Gopen * 2);
  },
});

/* =====================================================================
 *  유압 공급 / 압력제어
 * ===================================================================*/
def({
  type: 'h_powerunit', name: '유압 파워유닛', dom: 'hy', cat: '공급·보조기기',
  desc: '펌프·전동기·릴리프밸브·탱크·압력계 일체형. 시뮬레이션 중 클릭하면 펌프 ON/OFF.',
  props: [P_TAG('PU'), { k: 'q', l: '펌프 토출량', t: 'num', d: 8, min: 0.5, max: 60, step: 0.5, u: 'L/min', live: true },
    { k: 'p', l: '릴리프 설정 압력', t: 'num', d: 50, min: 5, max: 210, u: 'bar', live: true }],
  ports: () => [{ id: 'P', x: 0, y: -10, dir: 'up', kind: 'hy', lab: 'P' }, { id: 'T', x: 60, y: -10, dir: 'up', kind: 'hy', lab: 'T' }],
  bbox: () => [-44, -12, 80, 118],
  draw(c, st, sim) {
    const on = st ? st.on : false;
    let b = R(-40, 0, 116, 116, 'dash');
    b += L(0, -10, 0, 63) + L(60, -10, 60, 106);
    b += C(0, 75, 12, 'fw') + PG([[0, 65], [-5, 72], [5, 72]], 'fk');
    b += L(0, 87, 0, 104) + tankSym(30, 104, 90, 10);
    b += C(-26, 75, 8, on ? 'onG' : 'fw') + L(-18, 73, -12, 73) + L(-18, 77, -12, 77);
    b += L(0, 34, 20, 34) + R(20, 24, 26, 20, 'fw') + arrow(23, 39, 43, 39) + L(46, 34, 60, 34);
    b += springV(33, 24, 14, 4, 3) + L(10, 34, 10, 50, 'dash') + L(10, 50, 33, 50, 'dash') + PG([[33, 44], [29, 50], [37, 50]], 'fk');
    b += L(0, 14, -16, 14) + gaugeSym(-26, 14, 8);
    const ls = [lbl(18, 128, c.props.tag)];
    ls.push(lbl(-26, 92, 'M', 'tag'));
    if (sim) ls.push(lbl(-26, 34, `${sim.pAt(c, 'P').toFixed(0)}bar`, 'val'));
    ls.push(lbl(54, 62, `${c.props.p}bar`, 'val', 'end'));
    ls.push(lbl(-4, 112, `${c.props.q}L/min`, 'val', 'end'));
    return { b, l: ls };
  },
  init(c, st) { st.on = true; },
  press(c, st) { st.on = !st.on; },
  fluid(c, st, k) {
    if (st.on) k.Q('P', (+c.props.q * 1000) / 60);
    k.check('P', null, MED.hy.Gr, +c.props.p, 'rv');
    k.G('T', null, 400);
  },
});
def({
  type: 'h_pump', name: '유압 펌프 (정용량, 전동기)', dom: 'hy', cat: '공급·보조기기',
  desc: '탱크에서 흡입하여 P로 토출. 반드시 릴리프 밸브와 함께 사용. 클릭으로 ON/OFF.',
  props: [P_TAG('P1'), { k: 'q', l: '토출량', t: 'num', d: 8, min: 0.5, max: 60, step: 0.5, u: 'L/min', live: true }],
  ports: () => [{ id: 'P', x: 0, y: -30, dir: 'up', kind: 'hy', lab: 'P' }],
  bbox: () => [-46, -30, 20, 48],
  draw(c, st) {
    const on = st ? st.on : false;
    let b = L(0, -30, 0, -16) + C(0, 0, 16, 'fw') + PG([[0, -15], [-6, -6], [6, -6]], 'fk');
    b += C(-34, 0, 10, on ? 'onG' : 'fw') + L(-24, -2, -16, -2) + L(-24, 2, -16, 2);
    b += L(0, 16, 0, 38) + tankSym(0, 40, 30, 12);
    return { b, l: [lbl(-34, 4, 'M', 'tag'), lbl(22, 4, c.props.tag, 'lbl', 'start')] };
  },
  init(c, st) { st.on = true; },
  press(c, st) { st.on = !st.on; },
  fluid(c, st, k) {
    if (st.on) k.Q('P', (+c.props.q * 1000) / 60);
    k.check('P', null, MED.hy.Gr, 210, 'safety');
  },
});
def({
  type: 'h_tank', name: '탱크 (기름 탱크)', dom: 'hy', cat: '공급·보조기기', desc: '귀환유 탱크 (대기압).', props: [],
  ports: () => [{ id: 'T', x: 0, y: -20, dir: 'up', kind: 'hy', lab: '' }],
  bbox: () => [-16, -20, 16, 14],
  draw() { return { b: L(0, -20, 0, 8) + tankSym(0, 6, 30, 14), l: [] }; },
  fluid(c, st, k) { k.G('T', null, 400); },
});
def({
  type: 'h_filter', name: '필터 (여과기)', dom: 'hy', cat: '공급·보조기기', desc: '작동유 여과.', props: [],
  ports: () => [{ id: '1', x: -30, y: 0, dir: 'left', kind: 'hy' }, { id: '2', x: 30, y: 0, dir: 'right', kind: 'hy' }],
  bbox: () => [-30, -14, 30, 14],
  draw() { return { b: L(-30, 0, -12, 0) + L(12, 0, 30, 0) + PG([[-12, 0], [0, -12], [12, 0], [0, 12]], 'fw') + L(0, -12, 0, 12, 'dash'), l: [] }; },
  fluid(c, st, k) { k.G('1', '2', MED.hy.Gopen); },
});
def({
  type: 'h_accumulator', name: '어큐뮬레이터 (축압기)', dom: 'hy', cat: '공급·보조기기', desc: '가스 봉입 압력 이상에서 압유를 저장/방출.',
  props: [P_TAG('ACC'), { k: 'p0', l: '가스 봉입 압력', t: 'num', d: 20, min: 1, max: 150, u: 'bar' }, { k: 'vol', l: '용량', t: 'num', d: 1, min: 0.1, max: 20, step: 0.1, u: 'L' }],
  ports: () => [{ id: '1', x: 0, y: 40, dir: 'down', kind: 'hy' }],
  bbox: () => [-16, -30, 16, 40],
  draw(c) { return { b: L(0, 28, 0, 40) + R(-13, -28, 26, 56, 'fw', 13) + L(-13, 0, 13, 0) + PG([[0, -16], [-4, -8], [4, -8]], 'fk'), l: [lbl(18, 4, c.props.tag, 'lbl', 'start')] }; },
  fluid(c, st, k) { k.acc('1', (+c.props.vol * 1000) / Math.max(+c.props.p0, 1) * 0.5, +c.props.p0); },
});
def({
  type: 'h_relief', name: '릴리프 밸브 (직동형)', dom: 'hy', cat: '압력제어·체크밸브',
  desc: 'P측 압력이 설정 압력을 넘으면 T(탱크)로 릴리프하여 최고 압력 제한.',
  props: [P_TAG('V0'), { k: 'p', l: '설정 압력', t: 'num', d: 50, min: 1, max: 250, u: 'bar', live: true }],
  ports: () => [{ id: 'P', x: 0, y: -30, dir: 'up', kind: 'hy', lab: 'P' }, { id: 'T', x: 0, y: 30, dir: 'down', kind: 'hy', lab: 'T' }],
  bbox: () => [-30, -30, 34, 30],
  draw(c, st) {
    const open = st && st.open;
    let b = L(0, -30, 0, -20) + L(0, 20, 0, 30) + R(-14, -20, 28, 40, 'fw');
    b += open ? arrow(0, -18, 0, 17) : arrow(7, -16, 7, 16);
    b += springH(14, 28, 0, 6, 4) + L(16, 10, 28, -10) + head(16, 10, 28, -10, 5);
    b += PL([[0, -25], [-22, -25], [-22, 0], [-20, 0]], 'dash') + PG([[-14, 0], [-20, -4], [-20, 4]], 'fk');
    return { b, l: [lbl(-26, 34, `${c.props.p}bar`, 'val', 'end')] };
  },
  init(c, st) { st.open = false; },
  fluid(c, st, k) { st.open = k.check('P', 'T', MED.hy.Gr, +c.props.p, 'rv'); },
});
def({
  type: 'h_reducing', name: '감압 밸브', dom: 'hy', cat: '압력제어·체크밸브',
  desc: '출구(A) 압력을 설정 압력 이하로 유지 (분기 회로의 낮은 압력).',
  props: [P_TAG('V4'), { k: 'p', l: '설정 압력', t: 'num', d: 20, min: 1, max: 250, u: 'bar', live: true }],
  ports: () => [{ id: 'P', x: 0, y: 30, dir: 'down', kind: 'hy', lab: 'P' }, { id: 'A', x: 0, y: -30, dir: 'up', kind: 'hy', lab: 'A' }],
  bbox: () => [-30, -30, 40, 30],
  draw(c, st) {
    let b = L(0, -30, 0, -20) + L(0, 20, 0, 30) + R(-14, -20, 28, 40, 'fw');
    b += st && st.mode === 2 ? arrow(7, 16, 7, -16) : arrow(0, 18, 0, -17);
    b += springH(14, 28, 0, 6, 4) + L(16, 10, 28, -10) + head(16, 10, 28, -10, 5);
    b += PL([[0, -25], [-22, -25], [-22, 0], [-20, 0]], 'dash') + PG([[-14, 0], [-20, -4], [-20, 4]], 'fk');
    b += PL([[14, 16], [34, 16], [34, 24]], 'dash') + tankSym(34, 27, 10, 6);
    return { b, l: [lbl(-26, 34, `${c.props.p}bar`, 'val', 'end')] };
  },
  fluid(c, st, k) { st.mode = k.reduce('P', 'A', MED.hy.Gopen, +c.props.p, 'rd'); },
});
def({
  type: 'h_sequence', name: '시퀀스 밸브 (체크 내장)', dom: 'hy', cat: '압력제어·체크밸브',
  desc: '입구(P) 압력이 설정값에 도달하면 A로 흐름 (순차 작동). A→P 역류는 체크 밸브로 자유흐름.',
  props: [P_TAG('V5'), { k: 'p', l: '설정 압력', t: 'num', d: 30, min: 1, max: 250, u: 'bar', live: true }, { k: 'rck', l: '역류 체크밸브 내장', t: 'bool', d: true }],
  ports: () => [{ id: 'P', x: 0, y: 30, dir: 'down', kind: 'hy', lab: 'P' }, { id: 'A', x: 0, y: -30, dir: 'up', kind: 'hy', lab: 'A' }],
  bbox: () => [-50, -30, 40, 30],
  draw(c, st) {
    let b = L(0, -30, 0, -20) + L(0, 20, 0, 30) + R(-14, -20, 28, 40, 'fw');
    b += st && st.mode ? arrow(0, 18, 0, -17) : arrow(7, 16, 7, -16);
    b += springH(14, 28, 0, 6, 4) + L(16, 10, 28, -10) + head(16, 10, 28, -10, 5);
    b += PL([[0, 25], [-22, 25], [-22, 0], [-20, 0]], 'dash') + PG([[-14, 0], [-20, -4], [-20, 4]], 'fk');
    b += PL([[14, -16], [34, -16], [34, -4]], 'dash') + tankSym(34, -1, 10, 6);
    if (c.props.rck) b += PL([[0, 27], [-40, 27], [-40, 6]]) + PL([[-40, -6], [-40, -27], [0, -27]]) + C(-40, 2, 4, 'fw') + PL([[-46, -6], [-40, -2], [-34, -6]]);
    return { b, l: [lbl(24, 40, `${c.props.p}bar`, 'val', 'start')] };
  },
  fluid(c, st, k) {
    st.mode = k.seq('P', 'A', MED.hy.Gopen, +c.props.p, 'sq');
    if (c.props.rck) k.check('A', 'P', MED.hy.Gopen, MED.hy.crack, 'ck');
  },
});
def({
  type: 'h_pocheck', name: '파일럿 조작 체크 밸브', dom: 'hy', cat: '압력제어·체크밸브',
  desc: '1→2 자유흐름. 파일럿(X)에 압력이 걸리면 역방향(2→1)도 흐름 (로킹 회로).',
  props: [P_TAG('V6')],
  ports: () => [{ id: '1', x: -30, y: 0, dir: 'left', kind: 'hy' }, { id: '2', x: 30, y: 0, dir: 'right', kind: 'hy' }, { id: 'X', x: 0, y: 30, dir: 'down', kind: 'hy', pilot: true, lab: 'X' }],
  bbox: () => [-30, -14, 30, 30],
  draw(c, st) {
    let b = L(-30, 0, -14, 0) + L(14, 0, 30, 0) + R(-14, -12, 28, 24, 'fw') + C(-3, 0, 5, 'fw') + PL([[6, -8], [1, 0], [6, 8]]);
    b += L(0, 30, 0, 12, 'dash');
    if (st && st.po) b += L(-10, 0, 10, 0, 'live');
    return { b, l: [lbl(0, -18, c.props.tag)] };
  },
  init(c, st) { st.po = false; },
  fluid(c, st, k) {
    const px = k.p('X'), p2 = k.p('2');
    st.po = px >= 0.3 * p2 + 3;
    if (st.po) k.G('1', '2', MED.hy.Gopen);
    else k.check('1', '2', MED.hy.Gopen, MED.hy.crack, 'ck');
  },
});
def({
  type: 'h_fcv', name: '유량조절 밸브 (압력보상형)', dom: 'hy', cat: '유량제어밸브',
  desc: '부하 압력이 변해도 설정 유량을 일정하게 유지.',
  props: [P_TAG('V7'), { k: 'q', l: '설정 유량', t: 'num', d: 3, min: 0.1, max: 60, step: 0.1, u: 'L/min', live: true }],
  ports: () => [{ id: '1', x: -30, y: 0, dir: 'left', kind: 'hy' }, { id: '2', x: 30, y: 0, dir: 'right', kind: 'hy' }],
  bbox: () => [-30, -18, 30, 18],
  draw(c) {
    let b = L(-30, 0, -16, 0) + L(16, 0, 30, 0) + R(-16, -16, 32, 32, 'fw') + throttleH(0, 2, 12) + adj(0, 2, 10);
    b += R(-6, -14, 12, 6, '') + arrow(-12, -11, -8, -11);
    return { b, l: [lbl(0, 30, `${c.props.q}L/min`, 'val')] };
  },
  fluid(c, st, k) { k.fcv('1', '2', MED.hy.Gopen * 0.5, (+c.props.q * 1000) / 60, 'fc'); },
});

/* 분기점 */
for (const dom of ['pn', 'hy', 'el']) {
  def({
    type: `${dom === 'pn' ? 'p' : dom === 'hy' ? 'h' : 'e'}_junction`, name: '분기점', dom, cat: dom === 'el' ? '전원·배선' : dom === 'pn' ? '공급원·보조기기' : '공급·보조기기',
    desc: '배관/배선 분기 (T 접속).', props: [], junction: true,
    ports: () => [{ id: 'J', x: 0, y: 0, dir: 'none', kind: dom }],
    bbox: () => [-5, -5, 5, 5],
    draw() { return { b: C(0, 0, 2.8, 'fk jdot'), l: [] }; },
  });
}

/* =====================================================================
 *  전기 (DC 24V 시퀀스)
 * ===================================================================*/
const EP = () => [{ id: '1', x: 0, y: -20, dir: 'up', kind: 'el' }, { id: '2', x: 0, y: 20, dir: 'down', kind: 'el' }];
const EB = () => [-28, -22, 24, 22];

def({
  type: 'e_24v', name: '+24V 전원', dom: 'el', cat: '전원·배선', desc: 'DC +24V 단자.', props: [],
  ports: () => [{ id: '1', x: 0, y: 10, dir: 'down', kind: 'el' }],
  bbox: () => [-14, -14, 14, 10],
  draw(c, st, sim) { return { b: L(0, 3, 0, 10) + C(0, 0, 3.5, sim ? 'onR' : 'fw'), l: [lbl(0, -7, '+24V', 'tag')] }; },
  elec(c, st, k) { k.supply('1', '+'); },
});
def({
  type: 'e_0v', name: '0V 전원', dom: 'el', cat: '전원·배선', desc: 'DC 0V 단자.', props: [],
  ports: () => [{ id: '1', x: 0, y: -10, dir: 'up', kind: 'el' }],
  bbox: () => [-14, -10, 14, 14],
  draw() { return { b: L(0, -10, 0, -3) + C(0, 0, 3.5, 'fw'), l: [lbl(0, 14, '0V', 'tag')] }; },
  elec(c, st, k) { k.supply('1', '0'); },
});

// 접점 기호
function contactBody(nc, closed, act, live) {
  let b = L(0, -20, 0, -8) + L(0, 20, 0, 8);
  if (nc) b += L(0, -8, 7, -8);
  if (closed) b += L(0, 8, nc ? 6 : 1, -9, live ? 'blade on' : 'blade');
  else b += nc ? L(0, 8, -8, -7, 'blade') : L(0, 8, -9, -8, 'blade');
  const mx = -4;
  if (act) {
    b += L(mx, 0, -14, 0, 'dash');
    if (act === 'push') b += PL([[-12, -5], [-16, -5], [-16, 5], [-12, 5]]) + L(-16, 0, -19, 0);
    else if (act === 'sw') b += PL([[-12, -5], [-16, -5], [-16, 5], [-12, 5]]) + PL([[-19, -4], [-22, 0], [-19, 4]]);
    else if (act === 'estop') b += L(-14, -6, -14, 6) + P('M-15,-8 A8,8 0 0 0 -15,8 Z', 'estop');
    else if (act === 'ls') b += L(-14, 0, -18, -5) + C(-20, -7, 3, 'fw');
    else if (act === 'prox') b += PG([[-14, 0], [-19, -5], [-24, 0], [-19, 5]], 'fw') + L(-22, -2, -16, 2);
    else if (act === 'ps') b += R(-24, -5, 10, 10, 'fw') + T(-19, 3.5, 'P', 'stxt', 'middle', 8);
    else if (act === 'ton') b += P('M-14,-5 A6,6 0 0 0 -14,5') + L(-14, -5, -14, 5);
    else if (act === 'toff') b += P('M-20,-5 A6,6 0 0 1 -20,5') + L(-14, -5, -14, 5);
    else if (act === 'cnt') b += T(-18, 3.5, 'C', 'stxt', 'middle', 9);
  }
  return b;
}

function contactDef(o) {
  return def({
    type: o.type, name: o.name, dom: 'el', cat: o.cat, desc: o.desc,
    props: [P_TAG(o.tag)],
    ports: EP, bbox: EB,
    draw(c, st, sim) {
      const closed = sim ? !!st.closed : o.nc;
      return { b: contactBody(o.nc, closed, o.act, !!sim), l: [lbl(10, 4, c.props.tag, 'tag', 'start')] };
    },
    elec(c, st, k, sim) {
      const a = sim.actuated(o.kind, c.props.tag);
      st.closed = o.nc ? !a : a;
      k.contact('1', '2', st.closed);
    },
    press: o.press,
    release: o.release,
  });
}
const pbPress = (c, st, sim) => sim.btn.set(c.props.tag, true);
const pbRelease = (c, st, sim) => sim.btn.set(c.props.tag, false);
const swPress = (c, st, sim) => sim.sw.set(c.props.tag, !sim.sw.get(c.props.tag));
const lsPress = (c, st, sim) => sim.manMarks.set(c.props.tag, true);
const lsRelease = (c, st, sim) => sim.manMarks.set(c.props.tag, false);

contactDef({ type: 'e_pb_no', name: '푸시버튼 스위치 (a접점)', cat: '입력 (스위치·센서)', tag: 'PB1', act: 'push', kind: 'btn', nc: false, press: pbPress, release: pbRelease, desc: '누르는 동안 닫힘 (시작 버튼).' });
contactDef({ type: 'e_pb_nc', name: '푸시버튼 스위치 (b접점)', cat: '입력 (스위치·센서)', tag: 'PB2', act: 'push', kind: 'btn', nc: true, press: pbPress, release: pbRelease, desc: '누르는 동안 열림 (정지 버튼).' });
contactDef({ type: 'e_sw_no', name: '유지형 스위치 (a접점)', cat: '입력 (스위치·센서)', tag: 'SW1', act: 'sw', kind: 'sw', nc: false, press: swPress, desc: '클릭할 때마다 ON/OFF 유지 (셀렉터/토글).' });
contactDef({ type: 'e_sw_nc', name: '유지형 스위치 (b접점)', cat: '입력 (스위치·센서)', tag: 'SW1', act: 'sw', kind: 'sw', nc: true, press: swPress, desc: '유지형 스위치의 b접점.' });
contactDef({ type: 'e_estop', name: '비상정지 스위치 (b접점)', cat: '입력 (스위치·센서)', tag: 'EMG', act: 'estop', kind: 'sw', nc: true, press: swPress, desc: '누르면 회로 차단 및 유지. 다시 클릭하면 해제.' });
contactDef({ type: 'e_ls_no', name: '리밋 스위치 (a접점)', cat: '입력 (스위치·센서)', tag: 'LS1', act: 'ls', kind: 'mark', nc: false, press: lsPress, release: lsRelease, desc: '실린더 센서 위치(태그)에서 닫힘.' });
contactDef({ type: 'e_ls_nc', name: '리밋 스위치 (b접점)', cat: '입력 (스위치·센서)', tag: 'LS1', act: 'ls', kind: 'mark', nc: true, press: lsPress, release: lsRelease, desc: '실린더 센서 위치(태그)에서 열림.' });
contactDef({ type: 'e_prox', name: '근접 센서 (a접점)', cat: '입력 (스위치·센서)', tag: 'S1', act: 'prox', kind: 'mark', nc: false, press: lsPress, release: lsRelease, desc: '실린더 센서 위치에서 감지(닫힘).' });
contactDef({ type: 'e_ps_no', name: '압력 스위치 접점 (a접점)', cat: '입력 (스위치·센서)', tag: 'PS1', act: 'ps', kind: 'ps', nc: false, desc: '같은 태그 압력 스위치가 설정 압력 도달 시 닫힘.' });
contactDef({ type: 'e_ps_nc', name: '압력 스위치 접점 (b접점)', cat: '입력 (스위치·센서)', tag: 'PS1', act: 'ps', kind: 'ps', nc: true, desc: '설정 압력 도달 시 열림.' });
contactDef({ type: 'e_relay_no', name: '릴레이 a접점', cat: '릴레이·타이머·카운터', tag: 'R1', kind: 'relay', nc: false, desc: '같은 태그 릴레이 코일 여자 시 닫힘.' });
contactDef({ type: 'e_relay_nc', name: '릴레이 b접점', cat: '릴레이·타이머·카운터', tag: 'R1', kind: 'relay', nc: true, desc: '릴레이 코일 여자 시 열림.' });
contactDef({ type: 'e_timer_no', name: '타이머 a접점 (한시)', cat: '릴레이·타이머·카운터', tag: 'T1', act: 'ton', kind: 'timer', nc: false, desc: '타이머 설정 시간 경과 후 닫힘.' });
contactDef({ type: 'e_timer_nc', name: '타이머 b접점 (한시)', cat: '릴레이·타이머·카운터', tag: 'T1', act: 'ton', kind: 'timer', nc: true, desc: '타이머 설정 시간 경과 후 열림.' });
contactDef({ type: 'e_counter_no', name: '카운터 a접점', cat: '릴레이·타이머·카운터', tag: 'C1', act: 'cnt', kind: 'counter', nc: false, desc: '카운트값이 설정값 이상이면 닫힘.' });
contactDef({ type: 'e_counter_nc', name: '카운터 b접점', cat: '릴레이·타이머·카운터', tag: 'C1', act: 'cnt', kind: 'counter', nc: true, desc: '카운트값이 설정값 이상이면 열림.' });

// 부하(코일/램프)
function loadDef(o) {
  return def({
    type: o.type, name: o.name, dom: 'el', cat: o.cat, desc: o.desc,
    props: [P_TAG(o.tag), ...(o.props || [])],
    ports: EP, bbox: () => [-28, -22, 34, 22],
    load: true,
    draw(c, st, sim) {
      const on = st && st.on;
      const ls = [lbl(14, 4, c.props.tag, 'tag', 'start')];
      if (o.extraLabel) { const x = o.extraLabel(c, st, sim); if (x) ls.push(lbl(14, 16, x, 'val', 'start')); }
      return { b: o.body(on, c, st), l: ls };
    },
    elec(c, st, k) { k.load('1', '2'); },
    publish: o.publish,
  });
}
const coilBox = (on, inner = '') => L(0, -20, 0, -12) + L(0, 12, 0, 20) + R(-9, -12, 18, 24, on ? 'on' : 'fw') + inner;
loadDef({ type: 'e_relay', name: '릴레이 코일', cat: '릴레이·타이머·카운터', tag: 'R1', desc: '여자 시 같은 태그의 a접점 닫힘, b접점 열림.',
  body: (on) => coilBox(on), publish: (c, st, sim) => sim.setCoil('relay', c.props.tag, st.on) });
loadDef({ type: 'e_ton', name: '타이머 코일 (ON 딜레이)', cat: '릴레이·타이머·카운터', tag: 'T1', desc: '여자 후 설정 시간이 지나면 접점 동작.',
  props: [{ k: 'delay', l: '설정 시간', t: 'num', d: 3, min: 0, max: 600, step: 0.1, u: 's', live: true }],
  body: (on) => coilBox(on, PG([[-9, -12], [9, -12], [0, 0]], 'fk')),
  extraLabel: (c, st, sim) => { const t = sim && sim.timers.get(c.props.tag); return t ? `${Math.min(t.acc, +c.props.delay).toFixed(1)}/${c.props.delay}s` : `${c.props.delay}s`; },
  publish: (c, st, sim) => sim.setTimer(c.props.tag, st.on, 'on', +c.props.delay) });
loadDef({ type: 'e_toff', name: '타이머 코일 (OFF 딜레이)', cat: '릴레이·타이머·카운터', tag: 'T2', desc: '여자 즉시 접점 동작, 소자 후 설정 시간 뒤 복귀.',
  props: [{ k: 'delay', l: '설정 시간', t: 'num', d: 3, min: 0, max: 600, step: 0.1, u: 's', live: true }],
  body: (on) => coilBox(on, PG([[-9, 12], [9, 12], [0, 0]], 'fk')),
  extraLabel: (c, st, sim) => { const t = sim && sim.timers.get(c.props.tag); return t && t.hold ? `${t.acc.toFixed(1)}/${c.props.delay}s` : `${c.props.delay}s`; },
  publish: (c, st, sim) => sim.setTimer(c.props.tag, st.on, 'off', +c.props.delay) });
loadDef({ type: 'e_counter', name: '카운터 코일 (가산)', cat: '릴레이·타이머·카운터', tag: 'C1', desc: '입력 펄스(상승)마다 1 증가, 설정값 도달 시 접점 동작.',
  props: [{ k: 'preset', l: '설정값', t: 'num', d: 3, min: 1, max: 9999, live: true }],
  body: (on) => coilBox(on, T(0, 4, 'C', 'stxt', 'middle', 10)),
  extraLabel: (c, st, sim) => { const t = sim && sim.counters.get(c.props.tag); return `${t ? t.count : 0}/${c.props.preset}`; },
  publish: (c, st, sim) => sim.setCounter(c.props.tag, st.on, null, +c.props.preset) });
loadDef({ type: 'e_counter_rst', name: '카운터 리셋 코일', cat: '릴레이·타이머·카운터', tag: 'C1', desc: '여자 시 카운터 값을 0으로 리셋.',
  body: (on) => coilBox(on, T(0, 4, 'R', 'stxt', 'middle', 10)),
  publish: (c, st, sim) => sim.setCounter(c.props.tag, null, st.on, null) });
loadDef({ type: 'e_sol', name: '솔레노이드 코일', cat: '출력 (솔레노이드·램프)', tag: 'Y1', desc: '같은 태그의 솔레노이드 밸브를 작동.',
  body: (on) => coilBox(on, L(-9, 12, 9, -12)), publish: (c, st, sim) => sim.setCoil('sol', c.props.tag, st.on) });
loadDef({ type: 'e_lamp', name: '표시등 (램프)', cat: '출력 (솔레노이드·램프)', tag: 'H1', desc: '통전 시 점등.',
  props: [{ k: 'color', l: '색상', t: 'sel', d: 'yellow', opts: [['yellow', '황색'], ['red', '적색'], ['green', '녹색'], ['white', '백색']] }],
  body: (on, c) => L(0, -20, 0, -10) + L(0, 10, 0, 20) + C(0, 0, 10, on ? `lamp-${c.props.color || 'yellow'}` : 'fw') + L(-7, -7, 7, 7) + L(-7, 7, 7, -7) });
loadDef({ type: 'e_buzzer', name: '부저', cat: '출력 (솔레노이드·램프)', tag: 'BZ', desc: '통전 시 울림.',
  body: (on) => L(0, -20, 0, -10) + L(0, 10, 0, 20) + P('M-10,-10 L-10,10 L10,10 L10,-10 A10,10 0 0 0 -10,-10 Z', on ? 'on' : 'fw') + (on ? P('M14,-8 Q20,0 14,8') + P('M18,-12 Q27,0 18,12') : '') });

/* =====================================================================
 *  3D 실습실 전용: 공급 유닛, 분기 티, 실린더 부착 센서, 전기 모듈(랙)
 * ===================================================================*/
const boxDraw = (w, h, title) => () => ({ b: R(-w / 2, -h / 2, w, h, 'fw') + T(0, 4, title, 'stxt', 'middle', 9), l: [] });
const elJ = (ids) => ids.map((id) => ({ id, x: 0, y: 0, dir: 'none', kind: 'el', lab: id }));

def({
  type: 'p_supply3d', name: '공압 공급 유닛 (FRL+분배기)', dom: 'pn', cat: '3d', three: true,
  desc: '서비스 유닛(필터·레귤레이터·압력계)과 8구 분배기. 출구 압력 설정.',
  props: [{ k: 'p', l: '공급 압력', t: 'num', d: 6, min: 1, max: 10, step: 0.1, u: 'bar', live: true }],
  ports: () => Array.from({ length: 8 }, (_, i) => ({ id: 'o' + (i + 1), x: -35 + i * 10, y: 20, dir: 'down', kind: 'pn', lab: '' })),
  bbox: () => [-40, -20, 40, 20], draw: boxDraw(80, 40, '공압 공급 유닛'),
  init(c, st) { st.on = true; },
  press(c, st) { st.on = !st.on; },
  fluid(c, st, k) { if (st.on) for (let i = 1; i <= 8; i++) k.Gp('o' + i, +c.props.p, 60); },
});
def({
  type: 'h_supply3d', name: '유압 파워유닛 (P/T 분배블록)', dom: 'hy', cat: '3d', three: true,
  desc: '펌프·전동기·릴리프·탱크와 P/T 분배블록(각 4구). 클릭으로 펌프 ON/OFF.',
  props: [{ k: 'q', l: '펌프 토출량', t: 'num', d: 8, min: 0.5, max: 60, step: 0.5, u: 'L/min', live: true },
    { k: 'p', l: '릴리프 설정 압력', t: 'num', d: 50, min: 5, max: 210, u: 'bar', live: true }],
  ports: () => [...[1, 2, 3, 4].map((i) => ({ id: 'p' + i, x: -40 + i * 10, y: 20, dir: 'down', kind: 'hy', lab: 'P' })), ...[1, 2, 3, 4].map((i) => ({ id: 't' + i, x: i * 10, y: 20, dir: 'down', kind: 'hy', lab: 'T' }))],
  bbox: () => [-40, -20, 40, 20], draw: boxDraw(80, 40, '유압 파워유닛'),
  init(c, st) { st.on = true; },
  press(c, st) { st.on = !st.on; },
  fluid(c, st, k) {
    if (st.on) k.Q('p1', (+c.props.q * 1000) / 60);
    for (let i = 2; i <= 4; i++) k.G('p1', 'p' + i, 400);
    k.check('p1', null, MED.hy.Gr, +c.props.p, 'rv');
    for (let i = 1; i <= 4; i++) k.G('t' + i, null, 400);
  },
});
for (const dom of ['pn', 'hy']) {
  def({
    type: `${dom === 'pn' ? 'p' : 'h'}_tee`, name: '분기 티 (T 커넥터)', dom, cat: '3d', three: true, desc: '호스를 3방향으로 분기.', props: [],
    ports: () => [{ id: 'a', x: -10, y: 0, dir: 'left', kind: dom, lab: '' }, { id: 'b', x: 10, y: 0, dir: 'right', kind: dom, lab: '' }, { id: 'c', x: 0, y: 10, dir: 'down', kind: dom, lab: '' }],
    bbox: () => [-10, -6, 10, 10], draw: () => ({ b: L(-10, 0, 10, 0) + L(0, 0, 0, 10) + C(0, 0, 2.5, 'fk'), l: [] }),
    fluid(c, st, k) { const g = MED[dom].Gopen * 2; k.G('a', 'b', g); k.G('a', 'c', g); },
  });
}
// 실린더 부착 센서: props.cyl(실린더 id), props.pos(mm)
def({
  type: 's3_reed', name: '근접 센서 (리드 스위치)', dom: 'el', cat: '3d', three: true, desc: '실린더 튜브에 부착. 피스톤이 위치에 오면 접점 닫힘 (2선식).',
  props: [P_TAG('S1'), { k: 'cyl', l: '부착 실린더', t: 'cyl', d: '' }, { k: 'pos', l: '감지 위치', t: 'num', d: 0, min: 0, max: 1000, u: 'mm' }],
  ports: () => elJ(['a', 'b']), bbox: () => [-10, -10, 10, 10], draw: boxDraw(20, 20, 'S'),
  elec(c, st, k) { k.contact('a', 'b', !!(st.att || st.man)); },
  press(c, st) { st.man = true; }, release(c, st) { st.man = false; },
});
def({
  type: 's3_ls', name: '리밋 스위치 (롤러 레버형)', dom: 'el', cat: '3d', three: true, desc: '실린더 로드 끝 도그가 닿으면 작동 (COM-NO 닫힘, COM-NC 열림).',
  props: [P_TAG('LS1'), { k: 'cyl', l: '작동 실린더', t: 'cyl', d: '' }, { k: 'pos', l: '작동 위치', t: 'num', d: 0, min: 0, max: 1000, u: 'mm' }],
  ports: () => elJ(['C', 'NO', 'NC']), bbox: () => [-10, -10, 10, 10], draw: boxDraw(20, 20, 'LS'),
  elec(c, st, k) { const a = !!(st.att || st.man); k.contact('C', 'NO', a); k.contact('C', 'NC', !a); },
  press(c, st) { st.man = true; }, release(c, st) { st.man = false; },
});

// ---- 전기 모듈 (랙 장착) ----
const MOD = (o) => def({ dom: 'el', cat: 'module', three: true, module: true, bbox: () => [-20, -20, 20, 20], draw: boxDraw(40, 40, o.short || 'M'), ...o });
const range = (n) => Array.from({ length: n }, (_, i) => i);
MOD({
  type: 'm_psu', name: 'DC 24V 전원 공급기', short: 'PSU', props: [],
  ports: () => elJ([...range(4).map((i) => 'P' + i), ...range(4).map((i) => 'N' + i)]),
  elec(c, st, k) { for (const i of range(4)) { k.supply('P' + i, '+'); k.supply('N' + i, '0'); } },
});
MOD({
  type: 'm_pb', name: '푸시버튼 스위치 모듈', short: 'PB', props: [{ k: 'base', l: '시작 번호', t: 'num', d: 1 }],
  tags: (c) => range(3).map((i) => 'PB' + (+c.props.base + i)),
  ports: () => elJ(range(3).flatMap((i) => [`${i}NOa`, `${i}NOb`, `${i}NCa`, `${i}NCb`])),
  elec(c, st, k, sim) {
    range(3).forEach((i) => { const a = !!sim.btn.get('PB' + (+c.props.base + i)); k.contact(`${i}NOa`, `${i}NOb`, a); k.contact(`${i}NCa`, `${i}NCb`, !a); });
  },
  press(c, st, sim, part) { if (part >= 0 && part < 3) sim.btn.set('PB' + (+c.props.base + part), true); },
  release(c, st, sim) { range(3).forEach((i) => sim.btn.set('PB' + (+c.props.base + i), false)); },
});
MOD({
  type: 'm_sel', name: '비상정지 · 셀렉터 스위치 모듈', short: 'SEL', props: [],
  ports: () => elJ(['ENCa', 'ENCb', 'ENOa', 'ENOb', 'SNOa', 'SNOb', 'SNCa', 'SNCb']),
  elec(c, st, k, sim) {
    const e = !!sim.sw.get('EMG'), s = !!sim.sw.get('SS1');
    k.contact('ENCa', 'ENCb', !e); k.contact('ENOa', 'ENOb', e);
    k.contact('SNOa', 'SNOb', s); k.contact('SNCa', 'SNCb', !s);
  },
  press(c, st, sim, part) { const t = part === 0 ? 'EMG' : 'SS1'; sim.sw.set(t, !sim.sw.get(t)); },
});
MOD({
  type: 'm_relay', name: '릴레이 모듈 (4c × 3)', short: 'RY', props: [{ k: 'base', l: '시작 번호', t: 'num', d: 1 }],
  ports: () => elJ(range(3).flatMap((i) => [`${i}A1`, `${i}A2`, ...[1, 2, 3, 4].flatMap((j) => [`${i}C${j}`, `${i}NO${j}`, `${i}NC${j}`])])),
  elec(c, st, k, sim) {
    range(3).forEach((i) => {
      const tag = 'R' + (+c.props.base + i);
      k.load(`${i}A1`, `${i}A2`, (on) => sim.setCoil('relay', tag, on));
      const a = !!sim.relay.get(tag);
      for (const j of [1, 2, 3, 4]) { k.contact(`${i}C${j}`, `${i}NO${j}`, a); k.contact(`${i}C${j}`, `${i}NC${j}`, !a); }
    });
  },
});
MOD({
  type: 'm_timer', name: '타이머 모듈 (2회로)', short: 'TM',
  props: [{ k: 'd1', l: 'T1 설정 시간', t: 'num', d: 3, min: 0, max: 600, step: 0.1, u: 's', live: true }, { k: 'm1', l: 'T1 동작', t: 'sel', d: 'on', opts: [['on', 'ON 딜레이'], ['off', 'OFF 딜레이']] },
    { k: 'd2', l: 'T2 설정 시간', t: 'num', d: 5, min: 0, max: 600, step: 0.1, u: 's', live: true }, { k: 'm2', l: 'T2 동작', t: 'sel', d: 'on', opts: [['on', 'ON 딜레이'], ['off', 'OFF 딜레이']] }],
  ports: () => elJ(range(2).flatMap((i) => [`${i}A1`, `${i}A2`, ...[1, 2].flatMap((j) => [`${i}C${j}`, `${i}NO${j}`, `${i}NC${j}`])])),
  elec(c, st, k, sim) {
    range(2).forEach((i) => {
      const tag = 'T' + (i + 1);
      k.load(`${i}A1`, `${i}A2`, (on) => sim.setTimer(tag, on, c.props['m' + (i + 1)] || 'on', +c.props['d' + (i + 1)]));
      if (!sim.timers.has(tag)) sim.setTimer(tag, false, c.props['m' + (i + 1)] || 'on', +c.props['d' + (i + 1)]);
      const a = sim.timerOut(tag);
      for (const j of [1, 2]) { k.contact(`${i}C${j}`, `${i}NO${j}`, a); k.contact(`${i}C${j}`, `${i}NC${j}`, !a); }
    });
  },
});
MOD({
  type: 'm_counter', name: '카운터 모듈', short: 'CT', props: [{ k: 'preset', l: 'C1 설정값', t: 'num', d: 3, min: 1, max: 9999, live: true }],
  ports: () => elJ(['A1', 'A2', 'R1', 'R2', ...[1, 2].flatMap((j) => [`C${j}`, `NO${j}`, `NC${j}`])]),
  elec(c, st, k, sim) {
    k.load('A1', 'A2', (on) => sim.setCounter('C1', on, null, +c.props.preset));
    k.load('R1', 'R2', (on) => sim.setCounter('C1', null, on, null));
    if (!sim.counters.has('C1')) sim.setCounter('C1', null, null, +c.props.preset);
    const a = sim.counterOut('C1');
    for (const j of [1, 2]) { k.contact(`C${j}`, `NO${j}`, a); k.contact(`C${j}`, `NC${j}`, !a); }
  },
});
MOD({
  type: 'm_lamp', name: '표시등 · 부저 모듈', short: 'LP', props: [],
  ports: () => elJ([...range(3).flatMap((i) => [`${i}a`, `${i}b`]), 'BZa', 'BZb']),
  init(c, st) { st.lamp = [false, false, false]; st.bz = false; },
  elec(c, st, k) {
    range(3).forEach((i) => k.load(`${i}a`, `${i}b`, (on) => { st.lamp[i] = on; }));
    k.load('BZa', 'BZb', (on) => { st.bz = on; });
  },
});

// 팔레트 정의
export const PALETTE = {
  pn: { name: '공압', cats: ['공급원·보조기기', '액추에이터', '방향제어밸브', '압력·유량·논리'] },
  hy: { name: '유압', cats: ['공급·보조기기', '액추에이터', '방향제어밸브', '압력제어·체크밸브', '유량제어밸브'] },
  el: { name: '전기', cats: ['전원·배선', '입력 (스위치·센서)', '릴레이·타이머·카운터', '출력 (솔레노이드·램프)'] },
};
const ORDER = { h_powerunit: -10, h_pump: -9, h_tank: -8, p_source: -10, p_frl: -9, e_24v: -10, e_0v: -9, e_relay: -10, e_relay_no: -9, e_relay_nc: -8 };
export function paletteItems(dom, cat) {
  return Object.values(REG).filter((d) => d.dom === dom && d.cat === cat).sort((a, b) => (ORDER[a.type] || 0) - (ORDER[b.type] || 0));
}

export function newComp(type, x, y, id) {
  const d = REG[type];
  const props = {};
  for (const p of d.props) props[p.k] = p.d;
  return { id, type, x, y, rot: 0, props };
}

// 포트(회전 반영, 월드 좌표)
export function rotPt(x, y, rot, flip) {
  if (flip) x = -x;
  switch (((rot % 360) + 360) % 360) {
    case 90: return [-y, x];
    case 180: return [-x, -y];
    case 270: return [y, -x];
    default: return [x, y];
  }
}
const ROT_DIR = { up: 'right', right: 'down', down: 'left', left: 'up', none: 'none' };
const FLIP_DIR = { left: 'right', right: 'left', up: 'up', down: 'down', none: 'none' };
export function rotDir(d, rot, flip) {
  if (flip) d = FLIP_DIR[d];
  let n = (((rot % 360) + 360) % 360) / 90;
  while (n-- > 0) d = ROT_DIR[d];
  return d;
}
export function compPorts(c) {
  const d = REG[c.type];
  return d.ports(c).map((p) => {
    const [x, y] = rotPt(p.x, p.y, c.rot, c.flip);
    return { ...p, wx: c.x + x, wy: c.y + y, wdir: rotDir(p.dir, c.rot, c.flip) };
  });
}
export function compBBox(c) {
  const [x0, y0, x1, y1] = REG[c.type].bbox(c);
  const pts = [rotPt(x0, y0, c.rot, c.flip), rotPt(x1, y0, c.rot, c.flip), rotPt(x0, y1, c.rot, c.flip), rotPt(x1, y1, c.rot, c.flip)];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return [c.x + Math.min(...xs), c.y + Math.min(...ys), c.x + Math.max(...xs), c.y + Math.max(...ys)];
}
