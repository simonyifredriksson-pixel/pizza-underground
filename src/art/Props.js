/* Props.js - pizzas, kitchen stations, cars and street furniture.
   Dynamic things (a pizza you can hold, an oven whose window glows) are
   small groups of flat-shaded parts; static things go through Mesher. */
import * as THREE from '../../lib/three.module.js';
import { geo, part, mat, Mesher, signMesh } from './Mesher.js';

export const TOP_COLORS = {
  pepperoni: '#b8322c', mushroom: '#e9dcc4', pineapple: '#f6cf3a', olive: '#2a2a22', pepper: '#3fa34d', ham: '#f0a0a0',
};

/* ---------------- pizza ---------------- */
// item = {k:'dough'|'base'|'pizza'|'box', sauce, cheese, top:[], cook, soap, square}
export function makeItem(item) {
  const g = new THREE.Group();
  if (!item) return g;
  if (item.k === 'dough') {
    g.add(part(geo.ico(1), '#f1dfb8', 0, 0.12, 0, 0.36, 0.26, 0.36));
    return g;
  }
  if (item.k === 'box') {
    g.add(part(geo.box(), '#c79a5b', 0, 0.07, 0, 0.6, 0.12, 0.6));
    g.add(part(geo.box(), '#a87c44', 0, 0.135, 0, 0.62, 0.02, 0.62));
    const lbl = part(geo.box(), item.burnt ? '#333' : '#f4efe4', 0, 0.15, 0, 0.3, 0.01, 0.14); g.add(lbl);
    return g;
  }
  if (item.k === 'ext') {
    g.add(part(geo.cyl(8), '#d6232a', 0, 0.3, 0, 0.22, 0.6, 0.22, { rough: 0.35 }));
    g.add(part(geo.box(), '#222', 0, 0.66, 0.04, 0.08, 0.12, 0.2));
    g.add(part(geo.cyl(5), '#222', 0, 0.7, 0.16, 0.05, 0.05, 0.25)).rotation.x = Math.PI / 2;
    return g;
  }
  if (item.k === 'trash') { g.add(part(geo.ico(0), '#2b2b33', 0, 0.3, 0, 0.6, 0.6, 0.6)); return g; }
  if (item.k === 'fuse') { g.add(part(geo.cyl(6), '#e8e0c8', 0, 0.1, 0, 0.1, 0.2, 0.1)); return g; }
  // base or pizza
  const c = item.cook || 0;
  const burnt = c > 1.35, cooked = c >= 0.85;
  const crust = burnt ? '#2c211b' : cooked ? (c > 1.15 ? '#a8692c' : '#d9a05a') : '#f0dcb0';
  const sq = item.square;
  const disc = sq ? geo.box() : geo.cyl(12);
  const flat = item.k === 'base' && item.flat != null ? item.flat : 1;
  g.add(part(disc, crust, 0, 0.04, 0, 0.62 * flat + 0.06, 0.07, 0.62 * flat + 0.06));
  if (item.sauce) g.add(part(disc, burnt ? '#3a1712' : cooked ? '#b8331f' : '#d6402a', 0, 0.08, 0, 0.56, 0.02, 0.56));
  if (item.cheese) {
    const ch = burnt ? '#4a3a20' : cooked ? '#f6c84a' : '#fff1b8';
    g.add(part(disc, ch, 0, 0.095, 0, 0.5 + Math.min(item.cheese, 3) * 0.02, 0.02 + (item.cheese - 1) * 0.025, 0.5 + Math.min(item.cheese, 3) * 0.02));
    if (cooked && !burnt) for (let i = 0; i < 4; i++) g.add(part(geo.ico(0), '#e5a32e', Math.sin(i * 2.4) * 0.15, 0.11, Math.cos(i * 2.4) * 0.15, 0.08, 0.02, 0.08));
  }
  if (item.soap) for (let i = 0; i < 5; i++) g.add(part(geo.ico(0), '#bfefff', Math.sin(i * 1.3) * 0.18, 0.14, Math.cos(i * 1.3) * 0.18, 0.12, 0.1, 0.12, { opacity: 0.8 }));
  const tops = item.top || [];
  let n = 0;
  for (const t of tops) {
    const col = burnt ? '#1a1410' : TOP_COLORS[t] || '#888';
    for (let i = 0; i < 6; i++) {
      const a = (n * 1.7 + i * 1.047) % 6.283, r = 0.08 + ((i * 37 + n * 11) % 17) / 17 * 0.17;
      let p;
      if (t === 'pepperoni') p = part(geo.cyl(7), col, Math.sin(a) * r, 0.12, Math.cos(a) * r, 0.13, 0.02, 0.13);
      else if (t === 'olive') p = part(geo.tor(6), col, Math.sin(a) * r, 0.12, Math.cos(a) * r, 0.08, 0.08, 0.08);
      else p = part(geo.ico(0), col, Math.sin(a) * r, 0.12, Math.cos(a) * r, 0.09, 0.04, 0.07);
      if (t === 'olive') p.rotation.x = Math.PI / 2;
      g.add(p);
    }
    n++;
  }
  if (burnt) g.add(part(geo.ico(0), '#111', 0, 0.12, 0, 0.3, 0.06, 0.3));
  return g;
}

/* ---------------- kitchen stations ----------------
   Each returns { group, slot:Object3D (where an item sits), glow?, door? } */
export function makeStation(type) {
  const g = new THREE.Group();
  const S = { group: g, slot: new THREE.Object3D() };
  g.add(S.slot);
  const counterTop = (w = 1.6, d = 0.9, top = '#e8e2f2', base = '#7b5ea7') => {
    g.add(part(geo.box(), base, 0, 0.45, 0, w, 0.9, d));
    g.add(part(geo.box(), top, 0, 0.93, 0, w + 0.08, 0.07, d + 0.08));
    S.slot.position.set(0, 0.97, 0);
  };
  switch (type) {
    case 'dough':
      g.add(part(geo.frust(1.15, 9), '#6aa7c9', 0, 0.45, 0, 1.0, 0.9, 1.0));
      g.add(part(geo.ico(1), '#f1dfb8', 0, 0.86, 0, 0.85, 0.32, 0.85));
      g.add(part(geo.ico(0), '#f1dfb8', 0.2, 1.0, 0.1, 0.3, 0.2, 0.3));
      sign(g, ['DOUGH'], 0.9, 0.32, 0, 0.45, 0.52);
      break;
    case 'prep':
      counterTop(1.8, 1.0, '#f2ecd8', '#7b5ea7');
      g.add(part(geo.cyl(6), '#d9b48a', 0.7, 0.99, -0.3, 0.08, 0.5, 0.08)).rotation.z = Math.PI / 2; // rolling pin
      // little bowls of toppings along the back
      [['#d6402a'], ['#fff1b8'], ['#b8322c'], ['#e9dcc4'], ['#f6cf3a'], ['#2a2a22'], ['#3fa34d']].forEach(([c], i) => {
        g.add(part(geo.frust(1.3, 7), '#ffffff', -0.78 + i * 0.26, 0.97, -0.38, 0.2, 0.08, 0.2));
        g.add(part(geo.ico(0), c, -0.78 + i * 0.26, 1.02, -0.38, 0.16, 0.06, 0.16));
      });
      S.slot.position.set(0, 0.97, 0.1);
      break;
    case 'oven': {
      g.add(part(geo.box(), '#b8b8c8', 0, 0.75, 0, 1.6, 1.5, 1.3, { metal: 0.3, rough: 0.45 }));
      g.add(part(geo.box(), '#8a8aa0', 0, 1.56, 0, 1.66, 0.12, 1.36, { metal: 0.3, rough: 0.45 }));
      g.add(part(geo.cyl(6), '#6a6a80', 0.5, 1.6, -0.35, 0.25, 0.9, 0.25)); // chimney stub
      const door = new THREE.Group(); door.position.set(0, 0.42, 0.66);
      door.add(part(geo.box(), '#9a9ab0', 0, 0.36, 0, 1.3, 0.72, 0.06, { metal: 0.3, rough: 0.4 }));
      S.glow = part(geo.box(), '#331a10', 0, 0.38, 0.035, 0.9, 0.38, 0.02, { emissive: 0xff6a1a, ei: 0 });
      door.add(S.glow);
      door.add(part(geo.box(), '#2b2b33', 0, 0.68, 0.08, 0.8, 0.06, 0.06));
      g.add(door); S.door = door;
      for (let i = 0; i < 3; i++) g.add(part(geo.cyl(8), '#2b2b33', -0.45 + i * 0.45, 1.3, 0.67, 0.16, 0.06, 0.16)).rotation.x = Math.PI / 2;
      S.slot.position.set(0, 0.6, 0.0);
      break;
    }
    case 'bigoven': { // level 4 conveyor oven: three slots, fast
      g.add(part(geo.box(), '#d0a040', 0, 0.85, 0, 3.4, 1.0, 1.3, { metal: 0.4, rough: 0.4 }));
      g.add(part(geo.box(), '#2b2b33', 0, 0.62, 0, 4.2, 0.08, 1.0));
      S.glow = part(geo.box(), '#331a10', 0, 0.85, 0.66, 3.0, 0.5, 0.02, { emissive: 0xff6a1a, ei: 0 }); g.add(S.glow);
      sign(g, ['TURBO OVEN 9000'], 2.2, 0.4, 0, 1.55, 0.67);
      S.slots = [-1.1, 0, 1.1].map(x => { const o = new THREE.Object3D(); o.position.set(x, 0.7, 0); g.add(o); return o; });
      S.slot.position.set(0, 0.7, 0);
      break;
    }
    case 'box':
      counterTop(1.4, 0.9, '#e8e2f2', '#5e8a6a');
      for (let i = 0; i < 6; i++) g.add(part(geo.box(), '#c79a5b', -0.45, 0.98 + i * 0.07, -0.2, 0.5, 0.06, 0.5));
      sign(g, ['BOXES'], 0.7, 0.26, 0, 0.6, 0.46);
      S.slot.position.set(0.25, 0.97, 0.1);
      break;
    case 'shelf': // ready shelf: holds up to 8 boxes
      g.add(part(geo.box(), '#6b4a8a', 0, 0.02, 0, 1.8, 0.04, 0.7));
      for (let i = 0; i < 3; i++) g.add(part(geo.box(), '#e8e2f2', 0, 0.5 + i * 0.6, 0, 1.8, 0.05, 0.7));
      for (const x of [-0.88, 0.88]) g.add(part(geo.box(), '#6b4a8a', x, 0.95, 0, 0.05, 1.9, 0.7));
      S.slots = [];
      for (let i = 0; i < 9; i++) { const o = new THREE.Object3D(); o.position.set(-0.6 + (i % 3) * 0.6, 0.53 + Math.floor(i / 3) * 0.6, 0); g.add(o); S.slots.push(o); }
      sign(g, ['READY'], 0.9, 0.3, 0, 2.05, 0.36);
      break;
    case 'fridge':
      g.add(part(geo.box(), '#e8f2f8', 0, 1.05, 0, 1.3, 2.1, 0.9, { rough: 0.35 }));
      g.add(part(geo.box(), '#c4d2dc', 0, 1.3, 0.46, 1.24, 0.03, 0.03));
      g.add(part(geo.box(), '#8a98a6', 0.5, 1.5, 0.47, 0.06, 0.4, 0.05));
      sign(g, ['STOCK'], 0.8, 0.3, 0, 1.85, 0.46);
      break;
    case 'stash': // the "hidden fridge": a fridge with a sign that says shoes
      g.add(part(geo.box(), '#7a8a6a', 0, 0.9, 0, 1.2, 1.8, 0.8, { rough: 0.5 }));
      g.add(part(geo.box(), '#5a6a4a', 0.45, 1.0, 0.41, 0.06, 0.4, 0.05));
      sign(g, ['DEFINITELY', 'SHOES'], 0.9, 0.5, 0, 1.3, 0.41);
      break;
    case 'ext':
      g.add(part(geo.box(), '#e8e2f2', 0, 1.2, -0.05, 0.5, 0.9, 0.08));
      S.slot.position.set(0, 0.8, 0.12);
      break;
    case 'laptop':
      counterTop(1.2, 0.8, '#3a3048', '#2a2238');
      g.add(part(geo.box(), '#2b2b33', 0, 0.98, 0, 0.6, 0.03, 0.42));
      { const scr = part(geo.box(), '#2b2b33', 0, 1.2, -0.22, 0.6, 0.42, 0.03); scr.rotation.x = -0.25; g.add(scr);
        const glow = part(geo.box(), '#1a1a1a', 0, 1.2, -0.2, 0.52, 0.34, 0.01, { emissive: 0x43e07a, ei: 0.9 }); glow.rotation.x = -0.25; g.add(glow); }
      break;
    case 'fuse':
      g.add(part(geo.box(), '#8a8a9a', 0, 1.5, -0.05, 0.6, 0.8, 0.15, { metal: 0.4 }));
      S.glow = part(geo.box(), '#300', 0.15, 1.75, 0.04, 0.08, 0.08, 0.02, { emissive: 0xff2020, ei: 1 }); g.add(S.glow);
      g.add(part(geo.box(), '#2b2b33', -0.1, 1.45, 0.05, 0.12, 0.25, 0.05));
      break;
    case 'trashcan':
      g.add(part(geo.frust(1.15, 8), '#4a5a4a', 0, 0.45, 0, 0.7, 0.9, 0.7));
      g.add(part(geo.cyl(8), '#3a4a3a', 0, 0.92, 0, 0.82, 0.06, 0.82));
      break;
    case 'trashpile':
      for (let i = 0; i < 5; i++) g.add(part(geo.ico(0), ['#3a3a44', '#5a4a3a', '#2b2b33', '#6a5a4a'][i % 4], Math.sin(i * 2.1) * 0.5, 0.2 + (i % 2) * 0.2, Math.cos(i * 2.1) * 0.5, 0.6 + (i % 3) * 0.15, 0.5, 0.6));
      g.add(part(geo.cyl(6), '#c79a5b', 0.3, 0.6, 0.1, 0.3, 0.12, 0.5)).rotation.z = 0.4;
      break;
    case 'trapdoor':
      g.add(part(geo.box(), '#6a4a2a', 0, 0.02, 0, 1.4, 0.05, 1.4));
      g.add(part(geo.box(), '#3a2a1a', 0, 0.05, 0, 1.2, 0.02, 0.08));
      g.add(part(geo.tor(6), '#888', 0.4, 0.06, 0, 0.18, 0.18, 0.18)).rotation.x = Math.PI / 2;
      break;
    case 'stairs':
      for (let i = 0; i < 8; i++) g.add(part(geo.box(), '#6a4a2a', 0, i * 0.6 + 0.3, -i * 0.5, 1.4, 0.15, 0.5));
      break;
    case 'door': // the hideout front door marker (invisible)
      break;
    default:
      counterTop();
  }
  return S;
}

function sign(g, lines, w, h, x, y, z, ry = 0, o = {}) {
  const s = signMesh(lines, w, h, { size: undefined, ...o });
  s.position.set(x, y, z); s.rotation.y = ry;
  g.add(s); return s;
}
export { sign };

/* ---------------- vehicles ---------------- */
export const CAR_STYLES = {
  delivery: { body: '#e8473a', roof: '#f6f1e6', len: 3.4, wid: 1.8, h: 1.0, cab: 1.0, sign: true, open: true },
  limo: { body: '#1b1b24', roof: '#26263a', len: 5.2, wid: 2.0, h: 0.95, cab: 0.8 },
  scooter: { body: '#3fb8af', len: 1.8, wid: 0.7, h: 0.8, scooter: true },
  van: { body: '#f2f2f8', roof: '#e0e0ea', len: 4.4, wid: 2.1, h: 1.9, cab: 0.6, van: true },
  icecream: { body: '#ffd1e8', roof: '#8fe0ff', len: 4.6, wid: 2.1, h: 2.0, cab: 0.6, van: true, cone: true },
  sports: { body: '#ffcf33', roof: '#1b1b24', len: 4.2, wid: 1.9, h: 0.75, cab: 0.65, open: true },
  armored: { body: '#4a5a3a', roof: '#3a4a2a', len: 5.0, wid: 2.3, h: 2.1, cab: 0.6, van: true, armored: true },
  police: { body: '#1e2a5a', roof: '#ffffff', len: 3.9, wid: 1.9, h: 1.0, cab: 0.9, police: true },
  civ1: { body: '#7bc96f', roof: '#7bc96f', len: 3.6, wid: 1.8, h: 1.0, cab: 0.9 },
  civ2: { body: '#7f8cff', roof: '#7f8cff', len: 3.6, wid: 1.8, h: 1.0, cab: 0.9 },
  civ3: { body: '#ff9f5a', roof: '#ff9f5a', len: 3.8, wid: 1.8, h: 1.1, cab: 1.0 },
  civ4: { body: '#c98aff', roof: '#f6f1e6', len: 3.4, wid: 1.7, h: 1.0, cab: 0.9 },
  fire: { body: '#d6232a', roof: '#f6f1e6', len: 6, wid: 2.3, h: 2.2, cab: 0.5, van: true },
};

export function makeCar(style) {
  const S = CAR_STYLES[style] || CAR_STYLES.civ1;
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const C = { group: g, body, wheels: [], style, S, seats: [] };
  const L = S.len, W = S.wid;
  if (S.scooter) {
    body.add(part(geo.box(), S.body, 0, 0.45, 0, 0.5, 0.35, 1.3));
    body.add(part(geo.box(), '#2b2b33', 0, 0.72, -0.15, 0.45, 0.12, 0.7));
    body.add(part(geo.box(), S.body, 0, 0.75, 0.6, 0.4, 0.7, 0.2));
    body.add(part(geo.cyl(5), '#aaa', 0, 1.15, 0.65, 0.05, 0.6, 0.05)).rotation.z = Math.PI / 2;
    body.add(part(geo.box(), '#c79a5b', 0, 0.95, -0.55, 0.6, 0.4, 0.5)); // pizza box on the back
    for (const z of [-0.6, 0.62]) { const w = part(geo.cyl(10), '#1d1a24', 0, 0.25, z, 0.5, 0.18, 0.5); w.rotation.z = Math.PI / 2; g.add(w); C.wheels.push(w); }
    C.seats = [{ x: 0, y: 0.75, z: -0.1 }, { x: 0, y: 0.8, z: -0.5 }];
    return C;
  }
  const bodyH = S.van ? S.h * 0.55 : S.h * 0.55;
  body.add(part(geo.box(), S.body, 0, 0.35 + bodyH / 2, 0, W, bodyH, L));
  // bumpers
  body.add(part(geo.box(), '#2b2b33', 0, 0.42, L / 2, W * 0.96, 0.18, 0.12));
  body.add(part(geo.box(), '#2b2b33', 0, 0.42, -L / 2, W * 0.96, 0.18, 0.12));
  // cabin
  const cabH = S.van ? S.h - bodyH : S.cab;
  const cabL = S.van ? L * 0.95 : L * 0.55;
  const cabZ = S.van ? -L * 0.02 : -L * 0.06;
  const glass = mat('#2a3550', { rough: 0.15, metal: 0.4 });
  const wy = 0.35 + bodyH + cabH * 0.5;
  if (S.open) {
    // open top: seats, a see-through windshield in a frame, a roll bar
    const top = 0.35 + bodyH;
    body.add(part(geo.box(), '#3a3048', 0, top + 0.05, cabZ, W * 0.84, 0.1, cabL));
    for (const sx of [-1, 1]) { body.add(part(geo.box(), '#8a6aa8', sx * W * 0.22, top + 0.22, cabZ - cabL * 0.18, W * 0.34, 0.4, 0.16)); }
    const ws = part(geo.box(), '#bfe4ff', 0, top + cabH * 0.32, cabZ + cabL / 2, W * 0.86, cabH * 0.6, 0.04, { opacity: 0.25, rough: 0.1 });
    ws.rotation.x = -0.35; ws.castShadow = false; body.add(ws);
    for (const sx of [-1, 1]) body.add(part(geo.box(), S.roof || '#f6f1e6', sx * W * 0.43, top + cabH * 0.32, cabZ + cabL / 2, 0.08, cabH * 0.62, 0.08));
    body.add(part(geo.box(), S.roof || '#f6f1e6', 0, top + cabH * 0.62, cabZ + cabL / 2 - 0.1, W * 0.9, 0.08, 0.08));
    for (const sx of [-1, 1]) body.add(part(geo.box(), '#c8c8d8', sx * W * 0.4, top + 0.55, cabZ - cabL * 0.42, 0.08, 1.1, 0.08, { metal: 0.5 }));
    body.add(part(geo.box(), '#c8c8d8', 0, top + 1.08, cabZ - cabL * 0.42, W * 0.82, 0.08, 0.08, { metal: 0.5 }));
  } else body.add(part(geo.box(), S.roof || S.body, 0, 0.35 + bodyH + cabH / 2, cabZ, W * 0.88, cabH, cabL));
  // windows (dark glass) on all sides of the cabin
  if (S.open) { /* none */ } else if (S.van) {
    body.add(part(geo.box(), glass, 0, wy + cabH * 0.1, cabZ + cabL / 2 + 0.01, W * 0.8, cabH * 0.45, 0.04));
  } else {
    body.add(part(geo.box(), glass, 0, wy, cabZ + cabL / 2 + 0.01, W * 0.8, cabH * 0.7, 0.04));
    body.add(part(geo.box(), glass, 0, wy, cabZ - cabL / 2 - 0.01, W * 0.8, cabH * 0.7, 0.04));
  }
  if (!S.open) for (const s of [-1, 1]) body.add(part(geo.box(), glass, s * (W * 0.44 + 0.01), wy + (S.van ? cabH * 0.1 : 0), cabZ + (S.van ? cabL * 0.35 : 0), 0.04, cabH * (S.van ? 0.45 : 0.7), S.van ? cabL * 0.2 : cabL * 0.85));
  // lights
  for (const s of [-1, 1]) {
    body.add(part(geo.box(), '#fff6c8', s * W * 0.34, 0.6, L / 2 + 0.02, 0.32, 0.16, 0.04, { emissive: 0xfff2b0, ei: 0.4 }));
    body.add(part(geo.box(), '#c41a1a', s * W * 0.36, 0.62, -L / 2 - 0.02, 0.26, 0.12, 0.04, { emissive: 0xff2020, ei: 0.3 }));
  }
  if (S.sign) { // the pizza delivery sign, on the roll bar
    const sy = S.open ? 0.35 + bodyH + 1.35 : 0.35 + bodyH + cabH + 0.2, sz = S.open ? cabZ - cabL * 0.42 : cabZ;
    body.add(part(geo.box(), '#ffd23f', 0, sy, sz, 0.9, 0.4, 0.2));
    const t = signMesh(['PIZZA!'], 0.86, 0.36, { bg: '#ffd23f', fg: '#c41a1a', border: false });
    t.position.set(0, sy, sz + 0.11); body.add(t);
    const t2 = t.clone(); t2.rotation.y = Math.PI; t2.position.z = sz - 0.11; body.add(t2);
  }
  if (S.police) {
    body.add(part(geo.box(), '#ffffff', 0, 0.35 + bodyH / 2, 0, W + 0.02, bodyH * 0.4, L * 0.5));
    C.lightR = part(geo.box(), '#c41a1a', -0.3, 0.35 + bodyH + cabH + 0.08, cabZ, 0.5, 0.16, 0.3, { emissive: 0xff2020, ei: 1 });
    C.lightB = part(geo.box(), '#1a3ac4', 0.3, 0.35 + bodyH + cabH + 0.08, cabZ, 0.5, 0.16, 0.3, { emissive: 0x2040ff, ei: 1 });
    body.add(C.lightR, C.lightB);
  }
  if (S.cone) { // ice cream truck: a giant cone on top
    body.add(part(geo.cone(8), '#e2b06a', 0, 0.35 + S.h + 0.5, 0, 0.6, 1.0, 0.6)).rotation.x = Math.PI;
    body.add(part(geo.ico(1), '#ff8fc8', 0, 0.35 + S.h + 1.05, 0, 0.75, 0.6, 0.75));
  }
  if (S.armored) for (let i = 0; i < 4; i++) body.add(part(geo.box(), '#2b3a20', 0, 0.6 + i * 0.4, 0, W + 0.04, 0.06, L * 0.9));
  if (style === 'fire') { body.add(part(geo.box(), '#aaa', 0, 0.35 + S.h + 0.1, -0.6, 0.4, 0.2, 3.5)); }
  // wheels
  const wr = S.van ? 0.42 : 0.36;
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const w = part(geo.cyl(10), '#1d1a24', sx * (W / 2), wr, sz * L * 0.32, wr * 2, 0.3, wr * 2);
    w.rotation.z = Math.PI / 2;
    w.add(part(geo.cyl(6), '#c8c8d8', 0, 0.16, 0, 0.5, 0.05, 0.5));
    g.add(w); C.wheels.push(w);
  }
  const sy = 0.35 + bodyH * 0.35;
  C.seats = [{ x: -W * 0.22, y: sy, z: cabZ + cabL * 0.12 }, { x: W * 0.22, y: sy, z: cabZ + cabL * 0.12 }, { x: -W * 0.22, y: sy, z: cabZ - cabL * 0.3 }, { x: W * 0.22, y: sy, z: cabZ - cabL * 0.3 }];
  return C;
}

/* ---------------- misc dynamic props ---------------- */
export function makeClue() {
  const g = new THREE.Group();
  const paper = part(geo.box(), '#fff6d8', 0, 0, 0, 0.5, 0.65, 0.03, { emissive: 0xfff2a0, ei: 0.5 });
  g.add(paper);
  for (let i = 0; i < 4; i++) paper.add(part(geo.box(), '#665', 0, 0.2 - i * 0.12, 0.02, 0.6, 0.04, 0.2));
  const q = signMesh(['?'], 0.5, 0.5, { bg: '#ffd23f', fg: '#2a1640', border: false });
  q.position.set(0, 0.6, 0); g.add(q);
  return g;
}

export function makeDumpster(m, x, z, ry = 0) {
  m.box(x, 0, z, 2.4, 1.3, 1.4, '#3e7a4a', ry);
  m.boxc(x, 1.35, z, 2.5, 0.1, 1.5, '#2f5f3a', ry, 0, 0.0);
  m.box(x, 0, z, 2.5, 0.25, 1.5, '#2b2b33', ry);
}
