/* Props.js - pizzas, kitchen stations, cars and street furniture.
   Dynamic things (a pizza you can hold, an oven whose window glows) are
   small groups of flat-shaded parts; static things go through Mesher. */
import * as THREE from '../../lib/three.module.js';
import { geo, part, mat, Mesher, signMesh, rot } from './Mesher.js';
import { makeTrashBag, makeTrophy } from './Gear.js';
import { FLEET, makeBigBox } from './Fleet.js';
import { LIFE_CARS } from './LifeArt.js';

export const TOP_COLORS = {
  pepperoni: '#b8322c', mushroom: '#e9dcc4', pineapple: '#f6cf3a', olive: '#2a2a22', pepper: '#3fa34d', ham: '#f0a0a0', sausage: '#a8553a',
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
    g.add(rot(part(geo.cyl(5), '#222', 0, 0.7, 0.16, 0.05, 0.05, 0.25), 'x', Math.PI / 2));
    return g;
  }
  if (item.k === 'trash') { g.add(part(geo.ico(0), '#2b2b33', 0, 0.3, 0, 0.6, 0.6, 0.6)); return g; }
  if (item.k === 'bag') return makeTrashBag(); // a big black trash bag, with a very unhappy debtor in it
  if (item.k === 'equip' || item.k === 'furn') return makeBigBox(item);
  if (item.k === 'trophy') { const t = makeTrophy(item.g); t.scale.setScalar(0.7); return t; } // a rival gang's pride and joy
  if (item.k === 'crate') { // a crate of supplies, with a sample of what's inside on top
    g.add(part(geo.box(), '#b8894c', 0, 0.22, 0, 0.62, 0.44, 0.5));
    for (const s of [-1, 1]) g.add(part(geo.box(), '#8a6234', 0, 0.22, s * 0.26, 0.64, 0.08, 0.02));
    const c = { dough: '#f1e6cf', sauce: '#d6232a', cheese: '#ffe14a', ...TOP_COLORS }[item.s] || '#ffffff';
    for (let i = 0; i < 3; i++) g.add(part(item.s === 'sauce' ? geo.cyl(8) : geo.ico(0), c, -0.18 + i * 0.18, 0.5, 0, 0.16, 0.16, 0.16));
    return g;
  }
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

let _arch = null;
/** a half ring: the stone arch over an oven mouth */
const G_ARCH = () => _arch || (_arch = new THREE.TorusGeometry(0.42, 0.07, 5, 10, Math.PI));

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
    case 'dough': { // a big spiral dough mixer, a bowl of dough, a tray of dough balls
      const steel = { metal: 0.5, rough: 0.35 };
      g.add(part(geo.box(), '#e8e8f0', 0, 0.3, 0.05, 0.8, 0.6, 0.85, steel));
      g.add(part(geo.box(), '#e8e8f0', 0, 0.95, -0.32, 0.5, 1.3, 0.3, steel));
      g.add(part(geo.box(), '#e8e8f0', 0, 1.55, -0.05, 0.5, 0.28, 0.75, steel));
      g.add(part(geo.frust(1.25, 12), '#c8ccd8', 0, 0.82, 0.12, 0.72, 0.45, 0.72, steel));
      g.add(part(geo.ico(1), '#f1dfb8', 0, 1.02, 0.12, 0.6, 0.22, 0.6));
      g.add(part(geo.cyl(6), '#9a9aaa', 0, 1.25, 0.12, 0.05, 0.42, 0.05, steel));
      g.add(part(geo.box(), '#43e07a', 0.15, 1.55, 0.34, 0.08, 0.08, 0.02, { emissive: 0x20ff60, ei: 0.8 }));
      g.add(part(geo.box(), '#d6232a', -0.05, 1.55, 0.34, 0.08, 0.08, 0.02));
      for (let i = 0; i < 4; i++) g.add(part(geo.ico(0), '#f1dfb8', -0.25 + (i % 2) * 0.5, 0.66, -0.05 + Math.floor(i / 2) * 0.3, 0.18, 0.12, 0.18));
      sign(g, ['DOUGH'], 0.5, 0.2, 0, 1.55, 0.35);
      break;
    }
    case 'prep': { // a real prep table: steel frame, butcher-block top, a chilled topping rail, a shelf of dough trays
      const steel = { metal: 0.5, rough: 0.35 };
      for (const [x, z] of [[-0.82, -0.42], [0.82, -0.42], [-0.82, 0.42], [0.82, 0.42]]) g.add(part(geo.box(), '#c8ccd8', x, 0.45, z, 0.06, 0.9, 0.06, steel));
      g.add(part(geo.box(), '#c8ccd8', 0, 0.18, 0, 1.7, 0.04, 0.9, steel));
      for (let i = 0; i < 3; i++) { g.add(part(geo.box(), '#e8e8f0', -0.5 + i * 0.5, 0.24, 0.05, 0.42, 0.08, 0.6)); g.add(part(geo.ico(0), '#f1dfb8', -0.5 + i * 0.5, 0.32, 0.05, 0.2, 0.1, 0.2)); }
      g.add(part(geo.box(), '#e8dcc0', 0.6, 0.3, -0.15, 0.4, 0.22, 0.3)); // flour sack
      g.add(part(geo.box(), '#a8acb8', 0, 0.86, -0.05, 1.82, 0.08, 1.02, steel));
      g.add(part(geo.box(), '#d9a066', 0, 0.93, 0.12, 1.76, 0.06, 0.66)); // butcher block
      // the chilled topping rail, raised at the back, with a pan of every topping
      g.add(part(geo.box(), '#c8ccd8', 0, 1.0, -0.37, 1.82, 0.2, 0.3, steel));
      g.add(part(geo.box(), '#a8acb8', 0, 1.22, -0.5, 1.82, 0.24, 0.04, steel)); // lid hinge back
      [['#d6402a'], ['#fff1b8'], ['#b8322c'], ['#e9dcc4'], ['#f6cf3a'], ['#2a2a22'], ['#3fa34d']].forEach(([c], i) => {
        g.add(part(geo.box(), '#e8e8f0', -0.76 + i * 0.253, 1.1, -0.36, 0.22, 0.03, 0.24));
        g.add(part(geo.ico(0), c, -0.76 + i * 0.253, 1.12, -0.36, 0.2, 0.05, 0.2));
      });
      g.add(rot(part(geo.cyl(6), '#d9b48a', 0.72, 0.98, 0.32, 0.07, 0.5, 0.07), 'z', Math.PI / 2)); // rolling pin
      g.add(part(geo.cyl(8), '#ffffff', -0.72, 0.965, 0.3, 0.3, 0.005, 0.3, { opacity: 0.6 })); // a dusting of flour
      g.add(part(geo.cyl(8), '#c8ccd8', -0.65, 0.98, 0.32, 0.1, 0.02, 0.1, steel)); // pizza cutter wheel
      S.slot.position.set(0, 0.97, 0.12);
      break;
    }
    case 'oven': { // a wood-fired brick dome oven: arch, fire, a stone landing, a flue, a thermometer
      const brick = '#c8643a', stone = '#e0d0b0';
      g.add(part(geo.box(), '#8a5a44', 0, 0.4, 0, 1.6, 0.8, 1.3));
      for (let r = 0; r < 3; r++) g.add(part(geo.box(), '#7a4a36', 0, 0.12 + r * 0.25, 0, 1.62, 0.03, 1.32));
      for (let i = 0; i < 3; i++) { const l = part(geo.cyl(6), '#8a5a33', -0.35 + i * 0.35, 0.18, 0.5, 0.18, 0.5, 0.18); l.rotation.x = Math.PI / 2; g.add(l); }
      g.add(part(geo.sph(12, 8), brick, 0, 0.8, -0.05, 1.5, 1.25, 1.25));
      g.add(part(geo.sph(12, 8), '#b0552f', 0, 0.8, -0.05, 1.52, 0.5, 1.27));
      // the mouth: a dark arched opening with the fire bed glowing at the back of it
      g.add(part(geo.box(), '#140806', 0, 1.0, 0.6, 0.76, 0.36, 0.08));
      g.add(rot(part(geo.cyl(10), '#140806', 0, 1.18, 0.6, 0.76, 0.08, 0.76), 'x', Math.PI / 2));
      const arch = part(G_ARCH(), stone, 0, 1.18, 0.64, 0.95, 0.95, 0.95); g.add(arch);
      for (const s of [-1, 1]) g.add(part(geo.box(), stone, s * 0.4, 1.0, 0.64, 0.13, 0.36, 0.14));
      g.add(part(geo.box(), stone, 0, 0.82, 0.74, 1.05, 0.06, 0.34)); // landing
      S.glow = part(geo.box(), '#331a10', 0, 0.9, 0.645, 0.6, 0.12, 0.01, { emissive: 0xff6a1a, ei: 0 }); g.add(S.glow);
      for (let i = 0; i < 3; i++) { const l = part(geo.cyl(5), '#5a3a22', -0.15 + i * 0.15, 0.88, 0.648, 0.07, 0.3, 0.07); l.rotation.z = Math.PI / 2; g.add(l); }
      g.add(part(geo.cyl(8), '#3a3a44', 0, 1.35, 0.32, 0.22, 0.75, 0.22, { metal: 0.4 }));
      g.add(part(geo.cone(8), '#3a3a44', 0, 1.78, 0.32, 0.36, 0.18, 0.36, { metal: 0.4 }));
      const dial = part(geo.cyl(10), '#ffffff', -0.55, 0.55, 0.66, 0.22, 0.03, 0.22); dial.rotation.x = Math.PI / 2; g.add(dial);
      g.add(part(geo.box(), '#d6232a', -0.52, 0.58, 0.68, 0.02, 0.09, 0.01));
      // a pizza peel leaning on the side
      const peel = new THREE.Group(); peel.position.set(0.86, 0.1, 0.4); peel.rotation.z = -0.25;
      peel.add(part(geo.cyl(6), '#c8a070', 0, 0.75, 0, 0.05, 1.3, 0.05));
      peel.add(part(geo.box(), '#d9b48a', 0, 0.1, 0, 0.36, 0.38, 0.02));
      g.add(peel);
      S.mouth = new THREE.Vector3(0, 1.05, 0.92);
      S.slot.position.set(0, 0.85, 0.76);
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
    case 'box': { // the boxing table: flat-pack boxes, folded boxes, tape, a stamp
      const steel = { metal: 0.5, rough: 0.35 };
      for (const [x, z] of [[-0.62, -0.38], [0.62, -0.38], [-0.62, 0.38], [0.62, 0.38]]) g.add(part(geo.box(), '#c8ccd8', x, 0.45, z, 0.06, 0.9, 0.06, steel));
      g.add(part(geo.box(), '#c8ccd8', 0, 0.2, 0, 1.3, 0.04, 0.8, steel));
      for (let i = 0; i < 5; i++) g.add(part(geo.box(), '#b8894c', 0, 0.24 + i * 0.03, 0, 1.0, 0.025, 0.6)); // flat-packs underneath
      g.add(part(geo.box(), '#e8e2d2', 0, 0.92, 0, 1.44, 0.06, 0.94));
      for (let i = 0; i < 7; i++) g.add(part(geo.box(), i % 2 ? '#c79a5b' : '#b8894c', -0.42, 0.99 + i * 0.07, -0.18, 0.5, 0.06, 0.5));
      g.add(rot(part(geo.tor(10), '#c8a070', 0.5, 0.99, -0.3, 0.18, 0.18, 0.4), 'x', Math.PI / 2)); // tape
      g.add(part(geo.box(), '#d6232a', 0.55, 0.99, 0.25, 0.12, 0.08, 0.12));
      sign(g, ['NOT PIZZA', '(BOXES)'], 0.6, 0.3, -0.42, 1.55, -0.18 + 0.26, 0, { bg: '#c79a5b', fg: '#2a1640' });
      S.slot.position.set(0.25, 0.96, 0.12);
      break;
    }
    case 'shelf': { // the heated pass: steel rack with heat lamps glowing orange
      const steel = { metal: 0.5, rough: 0.35 };
      g.add(part(geo.box(), '#a8acb8', 0, 0.02, 0, 1.8, 0.04, 0.7, steel));
      for (let i = 0; i < 3; i++) g.add(part(geo.box(), '#c8ccd8', 0, 0.5 + i * 0.6, 0, 1.8, 0.04, 0.7, steel));
      for (const x of [-0.88, 0.88]) for (const z of [-0.32, 0.32]) g.add(part(geo.box(), '#a8acb8', x, 1.0, z, 0.05, 2.0, 0.05, steel));
      for (let i = 0; i < 3; i++) { g.add(part(geo.box(), '#3a3a44', -0.6 + i * 0.6, 2.02, 0, 0.4, 0.1, 0.3)); g.add(part(geo.box(), '#ff9f1a', -0.6 + i * 0.6, 1.95, 0, 0.32, 0.04, 0.22, { emissive: 0xff7a20, ei: 0.9 })); }
      S.slots = [];
      for (let i = 0; i < 9; i++) { const o = new THREE.Object3D(); o.position.set(-0.6 + (i % 3) * 0.6, 0.53 + Math.floor(i / 3) * 0.6, 0); g.add(o); S.slots.push(o); }
      sign(g, ['READY'], 0.9, 0.3, 0, 2.3, 0.06);
      break;
    }
    case 'fridge': { // a double-door steel fridge with windows full of ingredients
      const steel = { metal: 0.45, rough: 0.35 };
      g.add(part(geo.box(), '#d8dde6', 0, 1.05, 0, 1.3, 2.1, 0.9, steel));
      g.add(part(geo.box(), '#3a3a44', 0, 2.02, 0.46, 1.2, 0.12, 0.02));
      for (const s of [-1, 1]) {
        g.add(part(geo.box(), '#c8ccd8', s * 0.32, 1.0, 0.455, 0.6, 1.8, 0.02, steel));
        g.add(part(geo.box(), '#2a3550', s * 0.32, 1.3, 0.47, 0.42, 0.8, 0.01, { rough: 0.1 }));
        g.add(part(geo.box(), '#8a98a6', s * 0.06, 1.0, 0.5, 0.04, 0.5, 0.05, steel));
        for (let k = 0; k < 3; k++) g.add(part(geo.ico(0), ['#d6402a', '#fff1b8', '#3fa34d', '#b8322c'][(k + (s > 0 ? 1 : 0)) % 4], s * 0.32 + (k - 1) * 0.12, 1.05 + (k % 2) * 0.35, 0.42, 0.12, 0.12, 0.08));
      }
      sign(g, ['STOCK'], 0.6, 0.22, 0, 1.92, 0.48);
      break;
    }
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
      g.add(rot(part(geo.cyl(6), '#c79a5b', 0.3, 0.6, 0.1, 0.3, 0.12, 0.5), 'z', 0.4));
      break;
    case 'trapdoor':
      g.add(part(geo.box(), '#6a4a2a', 0, 0.02, 0, 1.4, 0.05, 1.4));
      g.add(part(geo.box(), '#3a2a1a', 0, 0.05, 0, 1.2, 0.02, 0.08));
      g.add(rot(part(geo.tor(6), '#888', 0.4, 0.06, 0, 0.18, 0.18, 0.18), 'x', Math.PI / 2));
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
  convertible: { body: '#e8473a', roof: '#f6f1e6', len: 3.4, wid: 1.8, h: 1.0, cab: 1.0, sign: true, open: true },   // the intro's car (the open-top delivery car)
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
  family: { body: '#141418', roof: '#1b1b24', len: 4.9, wid: 1.95, h: 1.05, cab: 0.9 },
  smallvan: { body: '#8fd0c8', roof: '#f6f1e6', len: 3.8, wid: 1.85, h: 1.8, cab: 0.6, van: true },
  pickup: { body: '#c8643a', roof: '#c8643a', len: 4.6, wid: 1.95, h: 1.0, cab: 0.9, pickup: true },
  getaway: { body: '#d6232a', roof: '#1b1b24', len: 4.3, wid: 1.95, h: 0.72, cab: 0.62, stripes: '#ffffff', spoiler: true },
  cargo: { body: '#e8e8f0', roof: '#d6232a', len: 7.2, wid: 2.5, h: 2.8, cab: 1.0, cargo: true },
};

export function makeCar(style) {
  if (FLEET[style]) return FLEET[style]();   // the vehicles you can own: each its own build (Fleet.js)
  if (LIFE_CARS[style]) return LIFE_CARS[style]();   // the garbage truck, the utility truck (LifeArt.js)
  const S = CAR_STYLES[style] || CAR_STYLES.civ1;
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const C = { group: g, body, wheels: [], style, S, seats: [] };
  const L = S.len, W = S.wid;
  if (S.scooter) {
    body.add(part(geo.box(), S.body, 0, 0.45, 0, 0.5, 0.35, 1.3));
    body.add(part(geo.box(), '#2b2b33', 0, 0.72, -0.15, 0.45, 0.12, 0.7));
    body.add(part(geo.box(), S.body, 0, 0.75, 0.6, 0.4, 0.7, 0.2));
    body.add(rot(part(geo.cyl(5), '#aaa', 0, 1.15, 0.65, 0.05, 0.6, 0.05), 'z', Math.PI / 2));
    body.add(part(geo.box(), '#c79a5b', 0, 0.95, -0.55, 0.6, 0.4, 0.5)); // pizza box on the back
    for (const z of [-0.6, 0.62]) { const w = part(geo.cyl(10), '#1d1a24', 0, 0.25, z, 0.5, 0.18, 0.5); w.rotation.z = Math.PI / 2; g.add(w); C.wheels.push(w); }
    C.seats = [{ x: 0, y: 0.75, z: -0.1 }, { x: 0, y: 0.8, z: -0.5 }];
    C.bed = { x: 0, y: 1.15, z: -0.55, w: 0.6, l: 0.5, cols: 1 };
    return C;
  }
  const wheelsAt = (wr, zs) => { for (const z of zs) for (const sx of [-1, 1]) { const w = part(geo.cyl(10), '#1d1a24', sx * (W / 2), wr, z, wr * 2, 0.32, wr * 2); w.rotation.z = Math.PI / 2; w.add(part(geo.cyl(6), '#c8c8d8', 0, 0.17, 0, 0.5, 0.05, 0.5)); g.add(w); C.wheels.push(w); } };
  const glassM = mat('#2a3550', { rough: 0.15, metal: 0.4 });
  if (S.pickup || S.cargo) {
    // a cab up front, and behind it either an open bed (pickup) or a big box (cargo truck)
    const cabL = S.cargo ? 2.2 : L * 0.42, cabZ = L / 2 - cabL / 2 - 0.1, cabH = S.cargo ? 1.9 : 1.55;
    body.add(part(geo.box(), S.cargo ? '#d6232a' : S.body, 0, 0.35 + cabH / 2, cabZ, W, cabH, cabL));
    body.add(part(geo.box(), glassM, 0, 0.35 + cabH * 0.68, cabZ + cabL / 2 + 0.01, W * 0.82, cabH * 0.38, 0.04));
    for (const s of [-1, 1]) body.add(part(geo.box(), glassM, s * (W / 2 + 0.01), 0.35 + cabH * 0.68, cabZ + 0.1, 0.04, cabH * 0.36, cabL * 0.6));
    for (const s of [-1, 1]) body.add(part(geo.box(), '#fff6c8', s * W * 0.34, 0.75, L / 2 + 0.02, 0.32, 0.18, 0.04, { emissive: 0xfff2b0, ei: 0.4 }));
    body.add(part(geo.box(), '#2b2b33', 0, 0.45, L / 2, W * 0.98, 0.22, 0.14));
    const bedL = L - cabL - 0.3, bedZ = -L / 2 + bedL / 2;
    if (S.pickup) {
      body.add(part(geo.box(), S.body, 0, 0.62, bedZ, W, 0.12, bedL));
      for (const s of [-1, 1]) body.add(part(geo.box(), S.body, s * (W / 2 - 0.05), 0.9, bedZ, 0.1, 0.5, bedL));
      body.add(part(geo.box(), S.body, 0, 0.9, -L / 2 + 0.05, W, 0.5, 0.1));
      body.add(part(geo.box(), '#c8c8d8', 0, 1.95, cabZ - cabL / 2 - 0.05, W * 0.9, 0.08, 0.08, { metal: 0.5 }));
      C.bed = { x: 0, y: 0.68, z: bedZ, w: W - 0.3, l: bedL - 0.2, cols: 3 };
    } else {
      body.add(part(geo.box(), S.body, 0, 0.45 + 1.4, bedZ, W + 0.1, 2.8, bedL));
      body.add(part(geo.box(), '#d6232a', 0, 2.1, bedZ, W + 0.12, 0.5, bedL - 0.4));
      body.add(part(geo.box(), '#2b2b33', 0, 0.45, -L / 2, W, 0.22, 0.14));
    }
    for (const s of [-1, 1]) body.add(part(geo.box(), '#c41a1a', s * W * 0.4, 0.75, -L / 2 - 0.02, 0.24, 0.14, 0.04, { emissive: 0xff2020, ei: 0.3 }));
    wheelsAt(S.cargo ? 0.5 : 0.42, S.cargo ? [L * 0.36, -L * 0.2, -L * 0.36] : [L * 0.32, -L * 0.3]);
    const sy = 0.55;
    if (C.bed) {   // the open bed: cargo in plain sight, a tailgate that drops
      C.hold = { x: 0, y: C.bed.y, z: C.bed.z, w: C.bed.w, l: C.bed.l, h: 1.0 };
      const tg = new THREE.Group(); tg.position.set(0, 0.68, -L / 2 + 0.05); body.add(tg);
      tg.add(part(geo.box(), S.body, 0, 0.25, 0, W - 0.2, 0.5, 0.08));
      C.doors = [{ pivot: tg, axis: 'x', open: -1.5 }];
    }
    C.seats = [{ x: W * 0.22, y: sy, z: cabZ }, { x: -W * 0.22, y: sy, z: cabZ }, ...(S.pickup ? [{ x: -W * 0.25, y: 0.75, z: bedZ }, { x: W * 0.25, y: 0.75, z: bedZ }] : [])];
    return C;
  }
  const bodyH = S.van ? S.h * 0.55 : S.h * 0.55;
  if (S.stripes) for (const s of [-0.18, 0.18]) body.add(part(geo.box(), S.stripes, s, 0.36 + bodyH, 0, 0.16, 0.02, L + 0.02));
  if (S.spoiler) { body.add(part(geo.box(), '#1b1b24', 0, 0.36 + bodyH + 0.32, -L / 2 + 0.2, W * 0.9, 0.06, 0.4)); for (const s of [-1, 1]) body.add(part(geo.box(), '#1b1b24', s * W * 0.35, 0.36 + bodyH + 0.15, -L / 2 + 0.2, 0.06, 0.3, 0.1)); }
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
    body.add(rot(part(geo.cone(8), '#e2b06a', 0, 0.35 + S.h + 0.5, 0, 0.6, 1.0, 0.6), 'x', Math.PI));
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
  // a trunk: a lid on a hinge behind the cabin, the cargo on the deck under it
  if (!S.van && !S.open && !S.police) {
    const top = 0.35 + bodyH, tz1 = cabZ - cabL / 2, tz0 = -L / 2 + 0.08;
    C.hold = { x: 0, y: top, z: (tz0 + tz1) / 2, w: W * 0.78, l: tz1 - tz0 - 0.1, h: 0.55 };
    const lid = new THREE.Group(); lid.position.set(0, top + 0.02, tz1); body.add(lid);
    lid.add(part(geo.box(), S.body, 0, 0.03, -(tz1 - tz0) / 2, W * 0.94, 0.06, tz1 - tz0));
    C.doors = [{ pivot: lid, axis: 'x', open: -1.25 }];
    C.hideCargoClosed = true;
  } else if (S.van) {   // vans: barn doors at the back (the cargo stays in the dark inside)
    C.hold = { x: 0, y: 0.45, z: -L * 0.2, w: W * 0.8, l: L * 0.5, h: S.h * 0.6 };
    C.doors = [];
    for (const s of [-1, 1]) { const d = new THREE.Group(); d.position.set(s * W / 2, 0.4, -L / 2 - 0.02); body.add(d); d.add(part(geo.box(), S.body, -s * W / 4, S.h * 0.38, -0.03, W / 2 - 0.02, S.h * 0.72, 0.05)); C.doors.push({ pivot: d, axis: 'y', open: s * 1.9 }); }
    C.hideCargoClosed = true;
  }
  C.seats = [{ x: W * 0.22, y: sy, z: cabZ + cabL * 0.12 }, { x: -W * 0.22, y: sy, z: cabZ + cabL * 0.12 }, { x: -W * 0.22, y: sy, z: cabZ - cabL * 0.3 }, { x: W * 0.22, y: sy, z: cabZ - cabL * 0.3 }];
  return C;
}

/* ---------------- mafia equipment ----------------
   Each returns a group standing on y = 0. bake() pours a group into a Mesher
   so a room full of money bags costs nothing. */
export function bake(m, group) {
  group.updateMatrixWorld(true);
  group.traverse(o => { if (o.isMesh && o.material.color && !o.material.map && !o.material.transparent) m.add(o.geometry, o.matrixWorld, '#' + o.material.color.getHexString(), 0.04); });
}
export const MAFIA = {
  moneyBag() {
    const g = new THREE.Group();
    g.add(part(geo.ico(1), '#d8c89a', 0, 0.38, 0, 0.7, 0.75, 0.7));
    g.add(part(geo.cyl(6), '#b8a87a', 0, 0.78, 0, 0.22, 0.12, 0.22));
    g.add(part(geo.cone(6), '#d8c89a', 0, 0.88, 0, 0.3, 0.2, 0.3));
    g.add(part(geo.box(), '#2f8a4a', 0, 0.42, 0.34, 0.2, 0.26, 0.04)); // the $
    g.add(part(geo.box(), '#2f8a4a', 0, 0.42, 0.35, 0.05, 0.36, 0.04));
    return g;
  },
  bat() {
    const g = new THREE.Group();
    const b = part(geo.frust(2.2, 8), '#c8a070', 0, 0.5, 0, 0.12, 1.0, 0.12); g.add(b);
    g.add(part(geo.cyl(8), '#2b2b33', 0, 0.06, 0, 0.07, 0.12, 0.07));
    g.add(part(geo.box(), '#ffffff', 0, 0.75, 0.13, 0.08, 0.3, 0.01)); // "FOAM"
    return g;
  },
  briefcase(open = false) {
    const g = new THREE.Group();
    g.add(part(geo.box(), '#1b1b24', 0, 0.07, 0, 0.7, 0.14, 0.45));
    g.add(part(geo.box(), '#c8a03a', 0, 0.15, 0.24, 0.16, 0.04, 0.04, { metal: 0.6 }));
    if (open) {
      for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) g.add(part(geo.box(), '#6fbf6a', -0.24 + i * 0.16, 0.16, -0.08 + k * 0.17, 0.14, 0.05, 0.15));
      const lid = part(geo.box(), '#1b1b24', 0, 0.36, -0.24, 0.7, 0.45, 0.04); lid.rotation.x = -0.2; g.add(lid);
    } else g.add(part(geo.box(), '#2b2b38', 0, 0.15, 0, 0.72, 0.02, 0.47));
    return g;
  },
  walkie() {
    const g = new THREE.Group();
    g.add(part(geo.box(), '#2b2b33', 0, 0.14, 0, 0.12, 0.28, 0.06));
    g.add(part(geo.cyl(5), '#2b2b33', 0.035, 0.38, 0, 0.02, 0.22, 0.02));
    g.add(part(geo.box(), '#43e07a', 0, 0.2, 0.031, 0.06, 0.04, 0.005, { emissive: 0x20ff60, ei: 0.7 }));
    return g;
  },
  oldPhone() { // a rotary phone, very mafia
    const g = new THREE.Group();
    g.add(part(geo.frust(0.75, 8), '#1b1b24', 0, 0.08, 0, 0.36, 0.16, 0.3));
    const dial = part(geo.cyl(10), '#e8e2d2', 0, 0.17, 0.05, 0.18, 0.02, 0.18); g.add(dial);
    const hs = part(geo.box(), '#1b1b24', 0, 0.21, -0.05, 0.38, 0.06, 0.08); g.add(hs);
    for (const s of [-1, 1]) g.add(part(geo.box(), '#1b1b24', s * 0.17, 0.24, -0.05, 0.08, 0.07, 0.11));
    return g;
  },
  crate(label) {
    const g = new THREE.Group();
    g.add(part(geo.box(), '#b8894c', 0, 0.45, 0, 0.9, 0.9, 0.9));
    for (const y of [0.12, 0.45, 0.78]) for (const s of [-1, 1]) g.add(part(geo.box(), '#8a6234', 0, y, s * 0.455, 0.92, 0.1, 0.02));
    for (const s of [-1, 1]) g.add(part(geo.box(), '#8a6234', s * 0.455, 0.45, 0, 0.02, 0.92, 0.92));
    if (label) sign(g, [label], 0.7, 0.24, 0, 0.6, 0.47, 0, { bg: '#e8dcc0', fg: '#2a1640', border: false });
    return g;
  },
  safe() {
    const g = new THREE.Group();
    g.add(part(geo.box(), '#5a6070', 0, 0.6, 0, 1.0, 1.2, 0.9, { metal: 0.6, rough: 0.3 }));
    g.add(part(geo.box(), '#6a7080', 0, 0.6, 0.46, 0.84, 1.04, 0.04, { metal: 0.6, rough: 0.3 }));
    const d = part(geo.cyl(12), '#c8c8d8', 0.15, 0.7, 0.5, 0.26, 0.06, 0.26, { metal: 0.7 }); d.rotation.x = Math.PI / 2; g.add(d);
    g.add(part(geo.box(), '#c8c8d8', -0.25, 0.6, 0.5, 0.06, 0.3, 0.06, { metal: 0.7 }));
    for (const x of [-0.35, 0.35]) g.add(part(geo.box(), '#2b2b33', x, 0.04, 0, 0.12, 0.08, 0.7));
    return g;
  },
  cashStack() {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) g.add(part(geo.box(), '#6fbf6a', (i % 2) * 0.05, 0.03 + i * 0.06, 0, 0.32, 0.05, 0.16));
    g.add(part(geo.box(), '#f6f1e6', 0, 0.12, 0, 0.06, 0.24, 0.17));
    return g;
  },
};

/** the "non-essential property" a debtor loses until they pay */
export const VALUABLES = ['TV', 'Lawn Flamingo', 'Garden Gnome Army', 'Jukebox', 'Grandfather Clock', 'Giant Teddy Bear', 'Gaming Chair', 'Inflatable Hot Tub', 'Golf Clubs', 'Lava Lamp Collection'];
export function makeValuable(kind) {
  const g = new THREE.Group();
  switch (kind) {
    case 'TV':
      g.add(part(geo.box(), '#6a4a3a', 0, 0.3, 0, 1.4, 0.6, 0.5));
      g.add(part(geo.box(), '#1b1b24', 0, 1.05, 0, 1.6, 0.9, 0.08));
      g.add(part(geo.box(), '#3a6ac8', 0, 1.05, 0.045, 1.46, 0.76, 0.01, { emissive: 0x2a4aa8, ei: 0.6 }));
      break;
    case 'Lawn Flamingo':
      for (const x of [-0.06, 0.06]) g.add(part(geo.cyl(4), '#2b2b33', x, 0.35, 0, 0.02, 0.7, 0.02));
      g.add(part(geo.ico(1), '#ff6fb0', 0, 0.85, 0, 0.5, 0.35, 0.3));
      g.add(part(geo.cyl(5), '#ff6fb0', 0.2, 1.15, 0, 0.06, 0.5, 0.06));
      g.add(part(geo.ico(0), '#ff6fb0', 0.2, 1.42, 0.05, 0.16, 0.14, 0.16));
      g.add(rot(part(geo.cone(4), '#2b2b33', 0.25, 1.38, 0.15, 0.06, 0.14, 0.06), 'x', 1.6));
      break;
    case 'Garden Gnome Army':
      for (let i = 0; i < 5; i++) { const x = (i - 2) * 0.35; g.add(part(geo.frust(0.7, 6), '#3a7bd5', x, 0.15, (i % 2) * 0.2, 0.22, 0.3, 0.22)); g.add(part(geo.ico(0), '#f2c29b', x, 0.36, (i % 2) * 0.2, 0.15, 0.14, 0.15)); g.add(part(geo.cone(6), '#d6232a', x, 0.42, (i % 2) * 0.2, 0.16, 0.3, 0.16)); g.add(part(geo.ico(0), '#ffffff', x, 0.3, (i % 2) * 0.2 + 0.07, 0.14, 0.12, 0.06)); }
      break;
    case 'Jukebox':
      g.add(part(geo.box(), '#c84a5a', 0, 0.65, 0, 0.9, 1.3, 0.6));
      g.add(rot(part(geo.cyl(12), '#ffd23f', 0, 1.3, 0, 0.9, 0.6, 0.6, { emissive: 0xffa020, ei: 0.4 }), 'x', Math.PI / 2));
      for (let i = 0; i < 3; i++) g.add(part(geo.box(), ['#43e07a', '#ff8fc8', '#43c0ff'][i], -0.25 + i * 0.25, 0.7, 0.31, 0.12, 0.6, 0.02, { emissive: [0x20ff60, 0xff60a0, 0x20a0ff][i], ei: 0.6 }));
      break;
    case 'Grandfather Clock':
      g.add(part(geo.box(), '#6a3a22', 0, 1.0, 0, 0.6, 2.0, 0.4));
      g.add(rot(part(geo.cyl(12), '#f6f1e6', 0, 1.65, 0.21, 0.4, 0.02, 0.4), 'x', Math.PI / 2));
      g.add(part(geo.box(), '#c8a03a', 0, 0.8, 0.21, 0.08, 0.6, 0.02, { metal: 0.6 }));
      g.add(rot(part(geo.cyl(10), '#c8a03a', 0, 0.45, 0.21, 0.2, 0.02, 0.2, { metal: 0.6 }), 'x', Math.PI / 2));
      break;
    case 'Giant Teddy Bear':
      g.add(part(geo.ico(1), '#a8743a', 0, 0.6, 0, 1.0, 1.0, 0.8));
      g.add(part(geo.ico(1), '#a8743a', 0, 1.35, 0, 0.7, 0.65, 0.6));
      for (const s of [-1, 1]) { g.add(part(geo.ico(0), '#a8743a', s * 0.28, 1.65, 0, 0.22, 0.22, 0.12)); g.add(part(geo.ico(0), '#a8743a', s * 0.5, 0.7, 0.15, 0.3, 0.45, 0.3)); g.add(part(geo.ico(0), '#14101c', s * 0.12, 1.42, 0.3, 0.07, 0.07, 0.04)); }
      g.add(part(geo.ico(0), '#e8c89a', 0, 1.28, 0.3, 0.22, 0.16, 0.12));
      g.add(part(geo.box(), '#d6232a', 0, 1.06, 0.3, 0.3, 0.1, 0.06));
      break;
    case 'Gaming Chair':
      g.add(part(geo.cyl(5), '#2b2b33', 0, 0.25, 0, 0.06, 0.5, 0.06));
      g.add(part(geo.box(), '#d6232a', 0, 0.55, 0, 0.6, 0.12, 0.6));
      g.add(part(geo.box(), '#d6232a', 0, 1.05, -0.28, 0.6, 1.0, 0.12));
      g.add(part(geo.box(), '#1b1b24', 0, 1.05, -0.21, 0.3, 0.9, 0.02));
      for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; g.add(rot(part(geo.box(), '#2b2b33', Math.sin(a) * 0.25, 0.04, Math.cos(a) * 0.25, 0.08, 0.06, 0.3), 'y', a)); }
      break;
    case 'Inflatable Hot Tub':
      g.add(part(geo.cyl(14), '#3a7bd5', 0, 0.35, 0, 2.0, 0.7, 2.0));
      g.add(part(geo.cyl(14), '#8fe0ff', 0, 0.66, 0, 1.7, 0.06, 1.7, { emissive: 0x2a8ac8, ei: 0.3 }));
      g.add(part(geo.ico(0), '#ffd23f', 0.4, 0.75, 0.2, 0.18, 0.16, 0.18)); // rubber duck
      break;
    case 'Golf Clubs':
      g.add(part(geo.cyl(8), '#2f8a4a', 0, 0.45, 0, 0.32, 0.9, 0.32));
      for (let i = 0; i < 4; i++) { g.add(part(geo.cyl(4), '#c8c8d8', -0.08 + i * 0.05, 1.05, 0, 0.02, 0.5, 0.02)); g.add(part(geo.box(), '#c8c8d8', -0.08 + i * 0.05, 1.3, 0.04, 0.05, 0.05, 0.1)); }
      break;
    case 'Lava Lamp Collection':
      for (let i = 0; i < 4; i++) { const x = (i - 1.5) * 0.3; g.add(part(geo.cone(8), '#c8a03a', x, 0.05, 0, 0.18, 0.15, 0.18)); g.add(part(geo.frust(0.6, 8), ['#ff6fb0', '#43e07a', '#ff9f1a', '#43c0ff'][i], x, 0.38, 0, 0.16, 0.5, 0.16, { emissive: [0xff4090, 0x20c060, 0xff8020, 0x2090ff][i], ei: 0.7 })); }
      break;
    default:
      g.add(part(geo.box(), '#c8a03a', 0, 0.4, 0, 0.8, 0.8, 0.8));
  }
  return g;
}
/** valuables that stand in the front yard rather than inside */
export const OUTDOOR_VALUABLES = new Set(['Lawn Flamingo', 'Garden Gnome Army', 'Inflatable Hot Tub']);

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
