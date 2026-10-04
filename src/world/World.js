/* World.js - the world pass: Crumbville gets neighbourhoods and a pulse.

   DOWNTOWN    - office towers behind the hospital, parking meters and
                 newspaper boxes along the central streets
   CRUMB HEIGHTS (rich, north-west) - backyard pools, topiaries, a stone sign
   LOWER CRUMBVILLE (poor, south-east) - a car on blocks, a couch on the
                 lawn, trash bags, a laundry line, weeds
   THE INDUSTRIAL EAST - shipping containers, drums, pallets
   and the set pieces that move (Life.js animates them): a construction
   site with a crane, a utility crew fixing a street lamp, a man in a
   manhole, street vendors, dock workers unloading at the grocery.

   Everything here only goes where there is room (it checks the colliders),
   and registers anything that moves in T.life for Life.js. */
import * as THREE from '../../lib/three.module.js';
import { makeCar } from '../art/Props.js';
import { makeCart, makeUtilityTruck } from '../art/LifeArt.js';
import { geo, part } from '../art/Mesher.js';
import { bakeKeep } from './Shops.js';

const ROADS = [-120, -40, 40, 120], RW = 12, EXT = 205;

export function worldPass(T) {
  T.life = { actors: [], spin: [], picker: null };
  downtown(T);
  streetProps(T);
  wealthy(T, -160, 0);
  poorSide(T);
  industrial(T);
  construction(T, 14, 82, 31, 111);
  utilityWork(T);
  vendors(T);
  dockWorkers(T);
}

/* ---------------- helpers ---------------- */
const isFree = (T, x, z, r = 0.6) => !T.col.solidAt(x, z, r, 0, 1.5) && !(T.paved || []).some(([a, b, c, d]) => x > a - r && x < c + r && z > b - r && z < d + r);
const rectFree = (T, x0, z0, x1, z1) => { for (let x = x0; x <= x1; x += Math.max(1, (x1 - x0) / 4)) for (let z = z0; z <= z1; z += Math.max(1, (z1 - z0) / 4)) if (!isFree(T, x, z, 0.4)) return false; return true; };
const pave = (T, x0, z0, x1, z1) => (T.paved ||= []).push([x0, z0, x1, z1]);
/** a person who does something (Life.js animates them) */
function actor(T, look, x, z, ry, mode, o = {}) {
  const rig = T.person(look, x, z, ry);
  const a = { rig, mode, x, z, ry, y: o.y || 0, t: Math.random() * 10, ...o };
  T.life.actors.push(a);
  if (o.tool === 'hammer') { const h = new THREE.Group(); h.add(part(geo.cyl(5), '#8a5a33', 0, 0, 0.15, 0.05, 0.4, 0.05)); h.children[0].rotation.x = Math.PI / 2; h.add(part(geo.box(), '#5a5a6a', 0, 0, 0.36, 0.1, 0.12, 0.2)); h.position.set(0, -0.62, 0); rig.armR.add(h); }
  if (o.tool === 'clipboard') { const c = part(geo.box(), '#a8743a', 0, -0.62, 0.12, 0.3, 0.4, 0.03); c.add(part(geo.box(), '#ffffff', 0, 0.02, 0.02, 0.85, 0.8, 0.5)); rig.armL.add(c); }
  if (o.carry) { o.carry.position.set(0, 1.15, 0.45); rig.root.add(o.carry); a.carry = o.carry; }
  if (o.hardhat) { const hh = part(geo.sph(10, 6), '#ffd23f', 0, 0.86, 0, 0.78, 0.5, 0.74); rig.head.add(hh); }
  return a;
}
const WORKER = (o = {}) => ({ shirt: '#ff9f1a', pants: '#3a5a9a', skin: '#e0a57c', hair: '#2a1a14', hat: 'bald', belly: 1.1, ...o });

/* ---------------- downtown ---------------- */
function downtown(T) {
  // two office towers on the strip behind the hospital
  T.bldg(-98, 24.5, 22, 11, 24, '#c8d4e6', 's', { kind: 'office', sign: ['CRUMB TOWER'], signBg: '#1e2a5a', signFg: '#ffffff', trim: '#8a98b0', lit: 0.55, floor: '#d8dce6', poster: false });
  T.bldg(-62, 24, 17, 10, 17, '#e6cfb8', 's', { kind: 'office', sign: ['MOZZ & PARTNERS', 'ATTORNEYS (NOT FOR PIZZA)'], signBg: '#2a1640', signFg: '#ffd23f', trim: '#a88a6a', lit: 0.5, floor: '#d8cfc0', poster: false });
  const m = T.m(-80, 24);
  // glass bands and a rooftop antenna on the tall one
  for (let f = 1; f < 7; f++) for (const s of [-1, 1]) m.box(-98, 1.3 + f * 3.2, 24.5 + s * 5.53, 21.6, 0.18, 0.08, '#8a98b0');
  m.cyl(-104, 24.35, 22, 0.15, 6, '#c8c8d8', 6); m.ico(-104, 30.4, 22, 0.35, 0.35, 0.35, '#d6232a');
}

/* ---------------- street furniture everywhere ---------------- */
function streetProps(T) {
  const downtownSeg = (r, a) => Math.abs(r) <= 40 && Math.abs(a) < 120;
  for (const r of ROADS) for (let a = -EXT + 9; a < EXT - 6; a += 6.5) {
    if (ROADS.some(q => Math.abs(a - q) < RW / 2 + 4)) continue;
    for (const s of [-1, 1]) {
      // parking bays painted along both sides (not on Pepper Road, the intro needs it plain)
      if (r !== -120) {
        T.mn(r + s * 4.8, a).box(r + s * 4.8, 0.028, a, 2.4, 0.01, 0.12, '#e8e2f2', 0, 0.01);
        T.mn(a, r + s * 4.8).box(a, 0.033, r + s * 4.8, 0.12, 0.01, 2.4, '#e8e2f2', 0, 0.01);
      }
      // parking meters downtown, on the curb
      if (downtownSeg(r, a) && ((a / 6.5) | 0) % 2 === 0) {
        for (const [x, z] of [[r + s * (RW / 2 + 0.45), a + 3], [a + 3, r + s * (RW / 2 + 0.45)]]) {
          if (z < -126 || !isFree(T, x, z, 0.5)) continue;
          const m = T.m(x, z);
          m.cyl(x, 0, z, 0.05, 1.05, '#5a5a6a', 6); m.box(x, 1.05, z, 0.22, 0.32, 0.16, '#3a3a48'); m.box(x, 1.18, z, 0.16, 0.12, 0.17, '#bfe4ff', 0, 0.01);
          T.col.circle(x, z, 0.12, { h: 1.4 });
        }
      }
    }
  }
  // junction corners: newspaper boxes, a utility cabinet, a mailbox, a hydrant
  for (const x of ROADS) for (const z of ROADS) {
    if (z === -120) continue;
    const o = RW / 2 + 1.7;
    const put = (px, pz, fn) => { if (isFree(T, px, pz, 0.8)) fn(T.m(px, pz), px, pz); };
    put(x - o, z + o, (m, px, pz) => {
      [['#3a7bd5', 'NEWS'], ['#d6232a', 'CRUMB TIMES']].forEach(([c, t], i) => { const bx = px + i * 0.7; m.box(bx, 0, pz, 0.55, 1.0, 0.45, c); m.box(bx, 0.55, pz - 0.23, 0.42, 0.3, 0.02, '#bfe4ff', 0, 0.01); });
      T.col.boxc(px + 0.35, pz, 1.3, 0.5, { h: 1 });
    });
    put(x + o, z - o, (m, px, pz) => { m.box(px, 0, pz, 0.9, 1.3, 0.55, '#5f8a6a'); m.box(px, 1.3, pz, 0.95, 0.06, 0.6, '#4a6a52'); m.box(px + 0.2, 0.7, pz - 0.28, 0.08, 0.2, 0.02, '#c8c8d8'); T.col.boxc(px, pz, 0.9, 0.55, { h: 1.3 }); });
    put(x - o, z - o, (m, px, pz) => {
      m.box(px, 0, pz, 0.6, 0.85, 0.5, '#2a4a8a'); m.cyl(px, 0.85, pz, 0.3, 0.5, '#2a4a8a', 10, 0); m.box(px, 0.75, pz - 0.26, 0.4, 0.06, 0.02, '#c8c8d8');
      T.col.boxc(px, pz, 0.6, 0.5, { h: 1.2 });
      m.cyl(px + 1.0, 0, pz, 0.2, 0.7, '#d6232a', 6); m.ico(px + 1.0, 0.72, pz, 0.24, 0.16, 0.24, '#d6232a'); for (const k of [-1, 1]) m.cyl(px + 1.0 + k * 0.24, 0.45, pz, 0.07, 0.12, '#c8c8d8', 6);
      T.col.circle(px + 1.0, pz, 0.25, { h: 0.9 });
    });
  }
}

/* ---------------- CRUMB HEIGHTS: the rich part of town ---------------- */
function wealthy(T, bx, bz) {
  for (let i = 0; i < 3; i++) for (const r of [-1, 1]) {
    const x = bx - 22 + i * 22, z = bz + r * 5.6;
    if (!rectFree(T, x - 4, z - 2.4, x + 4, z + 2.4)) continue;
    const m = T.m(x, z), mn = T.mn(x, z);
    pave(T, x - 4.2, z - 2.6, x + 4.2, z + 2.6);
    mn.flat(x - 4.0, z - 2.4, x + 4.0, z + 2.4, 0.06, '#efe6d6', 1.2, 0.02);
    for (const s of [-1, 1]) { m.box(x, 0.06, z + s * 1.475, 5.8, 0.16, 0.25, '#f6f6fa'); m.box(x + s * 2.775, 0.06, z, 0.25, 0.16, 2.7, '#f6f6fa'); }
    T.mc(x, z).box(x, 0.06, z, 5.32, 0.1, 2.72, '#5ccaf2', 0, 0.02);   // the water, bright in any light
    for (let k = 0; k < 5; k++) T.mc(x, z).box(x - 2 + k, 0.165, z + (k % 2 ? 0.5 : -0.4), 0.6, 0.005, 0.06, '#c8f2ff', 0, 0);
    T.col.boxc(x, z, 5.8, 3.2, { h: 0.5 });
    // a pink flamingo float, two loungers, an umbrella
    m.cyl(x + 1.2, 0.12, z - 0.4, 0.45, 0.12, '#ff8fc8', 10); m.cyl(x + 1.2, 0.2, z - 0.85, 0.06, 0.55, '#ff8fc8', 5); m.ico(x + 1.2, 0.8, z - 0.9, 0.16, 0.14, 0.2, '#ff8fc8');
    for (const k of [-1, 1]) { const lx = x - 3.6, lz = z + k * 1.1; m.box(lx, 0.06, lz, 0.7, 0.3, 1.8, '#ffffff'); m.boxc(lx, 0.55, lz - 0.7, 0.7, 0.06, 0.6, '#ffffff', 0, 0.6); T.col.boxc(lx, lz, 0.7, 1.8, { h: 0.5 }); }
    m.cyl(x + 3.4, 0.06, z + r * 1.5, 0.05, 2.3, '#c8c8d8', 5); m.cone(x + 3.4, 2.1, z + r * 1.5, 1.4, 0.5, '#ffd23f', 8);
  }
  // topiaries by every front door in the block, a stone entrance sign
  for (const h of T.houses) {
    if (Math.abs(h.x - bx) > 30 || Math.abs(h.z - bz) > 30) continue;
    const r2 = Math.sign(h.door.z - h.z), m = T.m(h.x, h.z);
    for (const s of [-1, 1]) { const px = h.x + s * 2.3, pz = h.z + r2 * 6.4; m.cyl(px, 0, pz, 0.3, 0.5, '#c8c0d0', 8); m.ico(px, 0.95, pz, 0.55, 0.55, 0.55, '#3f8a4a', 1); m.ico(px, 1.6, pz, 0.32, 0.32, 0.32, '#4a9a52', 1); T.col.circle(px, pz, 0.35, { h: 1.6 }); }
  }
  const sx = bx + 29, sz = bz + 29;
  if (isFree(T, sx, sz, 1.6)) {
    const m = T.m(sx, sz);
    m.box(sx, 0, sz, 3.6, 1.6, 0.8, '#d8d0c0'); m.box(sx, 1.6, sz, 3.8, 0.15, 0.9, '#c8c0b0');
    T.sign(['CRUMB HEIGHTS', 'est. (money)'], sx, 0.9, sz + 0.41, 0, 3.0, 1.0, { bg: '#2a4a3a', fg: '#e8d8a0', border: false, font: 'Georgia, serif' });
    T.col.boxc(sx, sz, 3.6, 0.8, { h: 1.7 });
  }
}

/* ---------------- LOWER CRUMBVILLE: the other side of the tracks ---------------- */
function poorSide(T) {
  const m = T.m(80, 140), mn = T.mn(80, 140);
  // a car on cinder blocks, no wheels
  if (rectFree(T, 66.5, 133, 71.5, 140)) {
    const c = makeCar('civ3'); for (const w of [...c.wheels]) w.parent.remove(w);
    c.group.position.set(69, 0.38, 136.5); c.group.rotation.y = 0.15; bakeKeep(T, m, c.group);
    for (const [dx, dz] of [[-0.8, -1.2], [0.8, -1.2], [-0.8, 1.2], [0.8, 1.2]]) m.box(69 + dx, 0, 136.5 + dz, 0.4, 0.38, 0.3, '#9a9aaa');
    T.col.boxc(69, 136.5, 2.2, 4.2, { h: 1.6 });
    m.ico(68.2, 0.2, 139.4, 0.9, 0.35, 0.9, '#3a3838');   // an oil stain gone solid
  }
  // a couch on the lawn and a TV on a crate facing it
  if (rectFree(T, 89, 131.5, 93.5, 136)) {
    const sx = 91, sz = 134.6, C = '#8a7a5a';
    m.box(sx, 0, sz, 2.2, 0.45, 0.9, C); m.box(sx, 0.45, sz + 0.33, 2.2, 0.5, 0.25, C); for (const k of [-1, 1]) m.box(sx + k * 1.0, 0.45, sz, 0.22, 0.25, 0.9, C);
    m.box(sx - 0.5, 0.45, sz - 0.1, 0.7, 0.04, 0.6, '#6a5a3a');   // the cushion with the stain
    T.col.boxc(sx, sz, 2.2, 0.9, { h: 0.9 });
    m.box(sx, 0, sz - 2.4, 0.7, 0.6, 0.6, '#a87c44'); m.box(sx, 0.6, sz - 2.4, 0.7, 0.5, 0.5, '#2b2b33'); m.box(sx, 0.68, sz - 2.66, 0.55, 0.34, 0.02, '#5a6a8a');
    T.col.boxc(sx, sz - 2.4, 0.7, 0.6, { h: 1.1 });
  }
  // trash bags, a stack of tires, a shopping cart on its side
  for (const [x, z] of [[47.6, 134], [48.4, 134.6], [47.8, 135.3], [113, 136], [112.2, 136.6]]) { if (!isFree(T, x, z, 0.4)) continue; m.ico(x, 0.35, z, 0.75, 0.7, 0.7, '#1b1b24', 1); m.cyl(x, 0.65, z, 0.08, 0.12, '#1b1b24', 5); }
  T.col.circle(48, 134.6, 1.0, { h: 0.8 });
  for (let k = 0; k < 4; k++) m.cyl(110, k * 0.28, 132, 0.4, 0.27, '#1d1a24', 10, 0, 0.02); T.col.circle(110, 132, 0.45, { h: 1.1 });
  m.boxc(52.5, 0.35, 140, 0.85, 0.6, 0.55, '#c8ccd8', 0.4, 0, 1.4);
  // weeds everywhere in the front yards
  for (let i = 0; i < 70; i++) { const x = 49 + ((i * 37) % 62), z = 130 + ((i * 13) % 8); if (!isFree(T, x, z, 0.3)) continue; mn.cone(x, 0, z, 0.12, 0.7 + (i % 4) * 0.2, i % 3 ? '#6a8a3a' : '#8a9a4a', 3, i); }
  // a laundry line behind the houses
  for (const x of [86, 96]) { m.cyl(x, 0, 152, 0.06, 2.2, '#8a8a98', 5); T.col.circle(x, 152, 0.1); }
  m.box(91, 2.1, 152, 10, 0.02, 0.02, '#e8e8f0');
  ['#ffffff', '#d6232a', '#3a7bd5', '#ffd23f', '#ff8fc8', '#ffffff'].forEach((c, i) => m.box(87 + i * 1.6, 1.4, 152, 0.9, 0.7, 0.04, c, 0, 0.04));
  // the welcome sign and a FOR SALE sign
  if (isFree(T, 48.5, 127.5, 1.2)) { m.cyl(47.6, 0, 127.5, 0.06, 1.6, '#7a6a5a', 5); m.cyl(49.4, 0, 127.5, 0.06, 1.6, '#7a6a5a', 5); T.sign(['LOWER CRUMBVILLE', 'pop. some'], 48.5, 1.25, 127.55, 0, 2.2, 0.75, { bg: '#c8b890', fg: '#5a3a2a', border: false }); T.col.box(47.5, 127.4, 49.5, 127.6, { h: 1.6 }); }
  if (isFree(T, 105.5, 131, 0.6)) { m.cyl(105.5, 0, 131, 0.05, 1.3, '#ffffff', 5); T.sign(['FOR SALE', '(PLEASE)', '(ANY OFFER)'], 105.5, 1.2, 131.05, 0, 1.0, 0.75, { bg: '#ffffff', fg: '#d6232a' }); }
}

/* ---------------- the industrial east ---------------- */
function industrial(T) {
  const container = (m, x, z, y, ry, c) => {
    m.box(x, y, z, 6, 2.5, 2.4, c, ry);
    const cs = Math.cos(ry), sn = Math.sin(ry);
    for (let k = -2.7; k <= 2.7; k += 0.45) m.box(x + cs * k, y + 0.05, z - sn * k, 0.08, 2.4, 2.46, c === '#c84a2a' ? '#a83a1a' : c === '#2a5ac8' ? '#1a4aa8' : '#2a7a4a', ry);
    m.box(x + cs * 3.0, y + 0.1, z - sn * 3.0, 0.06, 2.3, 2.3, '#5a5a6a', ry);
  };
  const spots = [[132, -78, 0], [132, -74.8, 0], [132, -76.4, 0, 2.5], [128, -60, Math.PI / 2], [190, -30, Math.PI / 2], [186, -30, Math.PI / 2], [188, -30, Math.PI / 2, 2.5]];
  const C = ['#c84a2a', '#2a5ac8', '#3a9a5a'];
  spots.forEach(([x, z, ry, y = 0], i) => {
    const w = Math.abs(Math.sin(ry)) > 0.5;
    if (!y && !rectFree(T, x - (w ? 1.3 : 3.1), z - (w ? 3.1 : 1.3), x + (w ? 1.3 : 3.1), z + (w ? 3.1 : 1.3))) return;
    container(T.m(x, z), x, z, y, ry, C[i % 3]);
    if (!y) T.col.boxc(x, z, w ? 2.4 : 6, w ? 6 : 2.4, { h: 5 });
  });
  // drum clusters and pallets
  for (const [x, z] of [[137, -66], [192, -44], [128, -88]]) {
    if (!rectFree(T, x - 1.2, z - 1.2, x + 1.2, z + 1.2)) continue;
    const m = T.m(x, z);
    for (let k = 0; k < 5; k++) { const dx = (k % 3 - 1) * 0.75, dz = Math.floor(k / 3) * 0.75; m.cyl(x + dx, 0, z + dz, 0.35, 1.0, ['#3a7bd5', '#d6232a', '#ffd23f'][k % 3], 10); m.cyl(x + dx, 0.95, z + dz, 0.36, 0.05, '#2b2b33', 10); }
    T.col.boxc(x, z + 0.35, 2.4, 1.6, { h: 1 });
  }
  if (isFree(T, 140, -82, 1)) { const m = T.m(140, -82); for (let k = 0; k < 4; k++) m.box(140, k * 0.15, -82, 1.2, 0.14, 1.0, '#b8894c', k * 0.1); T.col.boxc(140, -82, 1.2, 1, { h: 0.6 }); }
}

/* ---------------- the construction site (another bank) ---------------- */
function construction(T, x0, z0, x1, z1) {
  if (!rectFree(T, x0 + 1, z0 + 1, x1 - 1, z1 - 1)) return;
  pave(T, x0, z0, x1, z1);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, m = T.m(cx, cz), mn = T.mn(cx, cz), col = T.col;
  mn.flat(x0, z0, x1, z1, 0.05, '#b8a888', 2, 0.12, 0.08);   // dirt
  // the plywood hoarding, with a gate on the north side
  const PLY = '#c8a070';
  const hoard = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az) + Math.PI / 2;
    m.box((ax + bx) / 2, 0, (az + bz) / 2, len, 2.3, 0.1, PLY, ry);
    for (let t = 0; t <= len; t += 2.4) { const x = ax + (bx - ax) * t / len, z = az + (bz - az) * t / len; m.box(x, 0, z, 0.14, 2.4, 0.2, '#8a6a4a', ry); }
    col.box(Math.min(ax, bx) - 0.1, Math.min(az, bz) - 0.1, Math.max(ax, bx) + 0.1, Math.max(az, bz) + 0.1, { h: 2.5 });
  };
  hoard(x0, z0, cx - 2.5, z0); hoard(cx + 2.5, z0, x1, z0); hoard(x0, z0, x0, z1); hoard(x1, z0, x1, z1); hoard(x0, z1, x1, z1);
  T.sign(['COMING SOON:', 'ANOTHER BANK'], x0 + 4, 1.4, z0 - 0.07, Math.PI, 4.4, 1.6, { bg: '#1e2a5a', fg: '#ffffff', stripe: '#ffd23f' });
  T.sign(['HARD HAT AREA', '(we have one hat)'], x1 - 3.5, 1.4, z0 - 0.07, Math.PI, 3.2, 1.2, { bg: '#ffd23f', fg: '#1b1b24' });
  T.sign(['NO PIZZA', 'ON SITE'], x0 - 0.07, 1.4, cz, -Math.PI / 2, 2.4, 1.0, { bg: '#ffffff', fg: '#d6232a', stripe: '#d6232a' });
  // the slab and the steel frame (two floors, the second one half built)
  const fx0 = cx - 4, fx1 = cx + 5, fz0 = cz - 4, fz1 = cz + 9, STEEL = '#c84a2a';
  m.box((fx0 + fx1) / 2, 0.05, (fz0 + fz1) / 2, fx1 - fx0 + 1, 0.3, fz1 - fz0 + 1, '#b8b8c0');
  for (let i = 0; i <= 2; i++) for (let j = 0; j <= 3; j++) {
    const x = fx0 + i * (fx1 - fx0) / 2, z = fz0 + j * (fz1 - fz0) / 3, top = j < 2 ? 8 : 4.3;
    m.box(x, 0.35, z, 0.3, top - 0.35, 0.3, STEEL); col.boxc(x, z, 0.35, 0.35, { h: top });
  }
  for (const y of [4.1, 7.8]) {
    const zEnd = y > 5 ? fz0 + (fz1 - fz0) / 3 : fz1;
    for (let i = 0; i <= 2; i++) m.box(fx0 + i * (fx1 - fx0) / 2, y, (fz0 + zEnd) / 2, 0.25, 0.35, zEnd - fz0, STEEL);
    for (let j = 0; j <= 3; j++) { const z = fz0 + j * (fz1 - fz0) / 3; if (z > zEnd + 0.1) continue; m.box((fx0 + fx1) / 2, y, z, fx1 - fx0, 0.35, 0.25, STEEL); }
  }
  m.box((fx0 + fx1) / 2, 4.45, fz0 + (fz1 - fz0) / 3, fx1 - fx0, 0.2, (fz1 - fz0) * 2 / 3, '#a8a8b0');   // a floor deck, half done
  // scaffolding on the west side
  for (let k = 0; k <= 4; k++) for (const dx of [0, 1.2]) m.cyl(fx0 - 1.6 + dx, 0.05, fz0 + k * (fz1 - fz0) / 4, 0.04, 6.5, '#9a9aaa', 5);
  for (const y of [2.2, 4.4]) { m.box(fx0 - 1.0, y, (fz0 + fz1) / 2, 1.3, 0.06, fz1 - fz0, '#b8894c'); m.box(fx0 - 1.6, y + 1.0, (fz0 + fz1) / 2, 0.05, 0.05, fz1 - fz0, '#9a9aaa'); }
  col.box(fx0 - 1.75, fz0, fx0 - 0.35, fz1, { h: 6.5 });
  // the crane: a lattice tower, a cab, and a jib that turns (Life.js turns it)
  const tx = x0 + 2.5, tz = z1 - 3;
  for (const [dx, dz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) m.box(tx + dx, 0, tz + dz, 0.16, 24, 0.16, '#ffd23f');
  for (let y = 1; y < 24; y += 2) { m.boxc(tx, y + 1, tz - 0.7, 1.5, 0.08, 0.08, '#e8b82a', 0, 0, 0.9); m.boxc(tx, y + 1, tz + 0.7, 1.5, 0.08, 0.08, '#e8b82a', 0, 0, -0.9); m.boxc(tx - 0.7, y + 1, tz, 0.08, 0.08, 1.5, '#e8b82a', 0, 0.9); m.boxc(tx + 0.7, y + 1, tz, 0.08, 0.08, 1.5, '#e8b82a', 0, -0.9); }
  m.box(tx, 0, tz, 2.4, 0.6, 2.4, '#8a8a98'); col.boxc(tx, tz, 2.4, 2.4, { h: 24 });
  const jib = new THREE.Group(); jib.position.set(tx, 24, tz);
  jib.add(part(geo.box(), '#ffd23f', 0, 0.5, 7.5, 0.9, 0.9, 18));                        // the arm
  jib.add(part(geo.box(), '#ffd23f', 0, 0.5, -3.5, 0.9, 0.9, 6));                        // the counter arm
  jib.add(part(geo.box(), '#9a9aaa', 0, 0.2, -5.5, 1.6, 1.4, 2.0));                      // concrete counterweights
  jib.add(part(geo.box(), '#e8e8f0', 0.8, 0.1, 0.8, 1.2, 1.4, 1.4));                     // the operator's cab
  jib.add(part(geo.box(), '#2a3550', 0.8, 0.4, 1.52, 1.0, 0.7, 0.04));
  jib.add(part(geo.box(), '#ffd23f', 0, 2.6, 0, 0.5, 4.2, 0.5));                         // the tower top
  const hook = new THREE.Group(); hook.position.set(0, 0, 13); jib.add(hook);
  hook.add(part(geo.cyl(4), '#2b2b33', 0, -6, 0, 0.04, 12, 0.04));
  hook.add(part(geo.box(), '#ffd23f', 0, -12.2, 0, 0.4, 0.5, 0.3));
  hook.add(part(geo.box(), '#c84a2a', 0, -12.8, 0, 0.3, 0.3, 4));                        // a steel beam on the hook
  T.dyn.add(jib); T.life.spin.push({ obj: jib, axis: 'y', swing: 0.9, speed: 0.11, base: -2.2 });
  // a cement mixer that turns, sand, planks, rebar, a porta-potty, cones, a wheelbarrow
  const mx = x1 - 3.5, mz = z0 + 4;
  m.box(mx, 0, mz, 1.6, 0.9, 2.2, '#5a5a6a'); col.boxc(mx, mz, 1.6, 2.2, { h: 2.4 });
  const drum = new THREE.Group(); drum.position.set(mx, 1.7, mz); drum.rotation.x = 0.35;
  drum.add(part(geo.cyl(10), '#ff9f1a', 0, 0, 0, 1.3, 1.8, 1.3)); drum.add(part(geo.cone(10), '#ff9f1a', 0, 1.2, 0, 1.0, 0.7, 1.0));
  for (let k = 0; k < 3; k++) { const s = part(geo.box(), '#d8d8e0', 0, 0, 0, 1.34, 0.12, 0.2); s.rotation.y = k * 1.05; drum.add(s); }
  drum.rotation.order = 'ZXY';
  T.dyn.add(drum); T.life.spin.push({ obj: drum, axis: 'y', speed: 1.4 });
  m.ico(x1 - 3, 0.05, z1 - 5, 3.2, 1.4, 2.6, '#e0c890', 1); col.circle(x1 - 3, z1 - 5, 1.3, { h: 1.2 });
  for (let k = 0; k < 6; k++) m.box(x0 + 3, 0.05 + k * 0.12, z0 + 5, 0.9, 0.11, 3.2, k % 2 ? '#c8a070' : '#b8946a'); col.boxc(x0 + 3, z0 + 5, 0.9, 3.2, { h: 0.8 });
  for (let k = 0; k < 8; k++) m.boxc(x0 + 5, 0.15 + (k % 2) * 0.08, z0 + 3.8 + k * 0.12, 0.05, 0.05, 4, '#7a5a4a', 0, 0, 0);
  m.box(x1 - 1.3, 0.05, z1 - 9.5, 1.2, 2.3, 1.2, '#3a7bd5'); m.box(x1 - 1.3, 2.35, z1 - 9.5, 1.3, 0.1, 1.3, '#ffffff');
  T.sign(['OCCUPIED'], x1 - 1.92, 1.9, z1 - 9.5, -Math.PI / 2, 0.6, 0.18, { bg: '#d6232a', fg: '#ffffff', border: false });
  col.boxc(x1 - 1.3, z1 - 9.5, 1.2, 1.2, { h: 2.4 });
  for (const [x, z] of [[cx - 2.5, z0 - 0.8], [cx + 2.5, z0 - 0.8], [cx, z0 + 1.2]]) { m.cone(x, 0, z, 0.25, 0.7, '#ff6a1a', 8); m.box(x, 0, z, 0.5, 0.05, 0.5, '#2b2b33'); m.box(x, 0.35, z, 0.3, 0.1, 0.3, '#ffffff'); }
  m.box(cx + 1, 0.3, z0 + 6, 0.6, 0.3, 1.0, '#3a7bd5', 0.4); m.cyl(cx + 1.2, 0.05, z0 + 6.6, 0.18, 0.12, '#1d1a24', 8);
  // the crew
  const HAT = { hardhat: true };
  actor(T, WORKER({ shirt: '#ff9f1a', skin: '#c8865a' }), fx0 + 0.6, fz0 + 2.0, Math.PI / 2, 'hammer', { tool: 'hammer', ...HAT, line: 'Measure twice. Hammer... a lot.' });
  actor(T, WORKER({ shirt: '#ffd23f', skin: '#f2c29b', beard: '#8a5a2a' }), fx1 - 0.6, fz0 + 3.0, -Math.PI / 2, 'hammer', { tool: 'hammer', y: 4.55, ...HAT, line: 'Don\'t look down. I never look down. That\'s my secret.' });
  actor(T, WORKER({ shirt: '#ff6a1a', skin: '#e0a57c', belly: 1.3 }), (fx0 + fx1) / 2, fz0 + 1.2, 0, 'sit', { y: 4.55, line: 'Lunch break. It\'s been lunch break since Tuesday.', ...HAT });
  const plank = new THREE.Group(); plank.add(part(geo.box(), '#c8a070', 0, 0, 0, 0.25, 0.08, 2.6));
  actor(T, WORKER({ shirt: '#3a7bd5', skin: '#8a5a3a', hair: '#1a1410' }), x0 + 3, z0 + 7.2, 0, 'carry', { path: [[x0 + 3, z0 + 7.2], [fx0 - 2.4, fz0 + 6]], speed: 1.4, carry: plank, ...HAT, line: 'Lift with your legs! ...Whose legs? MY legs.' });
  actor(T, WORKER({ shirt: '#f6f1e6', pants: '#3a3048', skin: '#f2c29b', hat: 'default', hair: '#c8c8c8', glasses: 'round', tie: '#1e2a5a', belly: 1.25 }), cx, z0 + 3.4, Math.PI, 'point', { tool: 'clipboard', ...HAT, line: 'It\'s going to be a bank. Another one. The town needs more banks. Says the bank.' });
  T.poi.construction = { x: cx, z: z0 - 2 };
}

/* ---------------- the utility crew and the man in the manhole ---------------- */
function utilityWork(T) {
  // a street lamp that needs fixing on Basil Street, the truck under it, its bucket up
  let lamp = null;
  for (const L of T.lamps) if (Math.abs(L.z + 32.5) < 0.1 && L.x < -60 && L.x > -110) { lamp = L; break; }
  if (lamp) {
    const x = lamp.x + 1.6, z = -35.2;
    const C = makeUtilityTruck(); C.group.position.set(x, 0, z); C.group.rotation.y = -Math.PI / 2; T.dyn.add(C.group);
    T.col.boxc(x, z, C.S.len, C.S.wid, { h: 2.6 });
    // point the turret at the lamp
    C.group.updateMatrixWorld(true);
    const tp = new THREE.Vector3(); C.turret.getWorldPosition(tp);
    C.turret.rotation.y = Math.atan2(lamp.x - tp.x, lamp.z - tp.z) - C.group.rotation.y;
    T.life.picker = { C, reach: Math.hypot(lamp.x - tp.x, lamp.z - tp.z) };
    const m = T.m(x, z);
    for (const k of [-4, 4]) { const cx = x + k, cz = z + 1.6; m.cone(cx, 0, cz, 0.25, 0.7, '#ff6a1a', 8); m.box(cx, 0.35, cz, 0.3, 0.1, 0.3, '#ffffff'); m.box(cx, 0, cz, 0.5, 0.05, 0.5, '#2b2b33'); }
    T.life.actors.push({ rig: C.guy, mode: 'hammer', x: 0, z: 0, y: 0, local: true, t: 0, line: 'Don\'t mind me. Fixing the light. It\'s been broken for six years.' });
  }
  // a man in a manhole on Garlic Way, an orange tent, cones
  for (const z of [100, 92, 108, 76]) {
    const x = 44.6;
    if (!isFree(T, x, z, 1.4)) continue;
    const m = T.m(x, z);
    m.cyl(x, 0.02, z, 0.55, 0.04, '#1b1b24', 10);
    for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) m.cyl(x + dx, 0, z + dz, 0.03, 1.5, '#5a5a6a', 4);
    m.box(x, 1.5, z, 1.7, 0.1, 1.7, '#ff6a1a'); m.cone(x, 1.6, z, 1.2, 0.5, '#ff6a1a', 4, Math.PI / 4);
    for (const s of [-1, 1]) m.box(x + s * 0.85, 0.6, z, 0.04, 0.9, 1.6, '#ff8a3a', 0, 0.02);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, cx = x + Math.sin(a) * 1.8, cz = z + Math.cos(a) * 1.8; m.cone(cx, 0, cz, 0.22, 0.6, '#ff6a1a', 8); m.box(cx, 0.3, cz, 0.26, 0.08, 0.26, '#ffffff'); }
    T.sign(['MEN AT WORK', '(one man)'], x, 2.4, z - 0.86, Math.PI, 1.6, 0.6, { bg: '#ffd23f', fg: '#1b1b24' });
    T.col.circle(x, z, 1.9, { h: 1.6 });
    actor(T, WORKER({ shirt: '#ff9f1a', skin: '#c8865a', mustache: true, hat: 'cap', hatColor: '#ffd23f' }), x, z, Math.PI, 'manhole', { line: 'Hello from the underground. No, not THAT underground.' });
    break;
  }
}

/* ---------------- street vendors ---------------- */
function vendors(T) {
  const LINES = {
    bread: ['HOT BREAD! Just bread! Nothing on it!', 'Round bread! ...Normal round. Not suspicious round.', 'No toppings. Toppings are illegal. I checked twice.'],
    icecream: ['Ice cream! Cold! Completely legal!', 'One scoop or two? Two is a felony. Kidding. Mostly.', 'Brain freeze is free.'],
    flowers: ['Flowers! For your mother! Or your getaway driver!', 'Roses are red, violets are... I forgot. Buy a rose.', 'These smell nicer than your car, pal.'],
  };
  for (const [kind, x, z, ry, look] of [
    ['bread', 19, -15, -Math.PI / 2, { shirt: '#ffffff', apron: true, pants: '#2b2b38', skin: '#e0a57c', hat: 'beanie', hatColor: '#d6232a', mustache: true, belly: 1.25 }],
    ['icecream', -12, 151, 0, { shirt: '#ff8fc8', pants: '#ffffff', skin: '#f7d6b8', hairStyle: 'bun', hair: '#5a3a1a' }],
    ['flowers', -84, 72.5, Math.PI / 2, { shirt: '#a8e0c0', pants: '#3a3048', skin: '#8a5a3a', hairStyle: 'big', hair: '#1a1410', glasses: 'round' }],
  ]) {
    if (!isFree(T, x, z, 1.4)) continue;
    const g = makeCart(kind); g.position.set(x, 0, z); g.rotation.y = ry; bakeKeep(T, T.m(x, z), g);
    T.col.boxc(x, z, Math.abs(Math.sin(ry)) > 0.5 ? 1.0 : 1.9, Math.abs(Math.sin(ry)) > 0.5 ? 1.9 : 1.0, { h: 1.3 });
    const bx = x - Math.sin(ry) * 1.0, bz = z - Math.cos(ry) * 1.0;
    actor(T, look, bx, bz, ry, 'vendor', { lines: LINES[kind] });
  }
}

/* ---------------- unloading at the grocery's dock ---------------- */
function dockWorkers(T) {
  const x = -59.6, z = 57.4;
  if (!rectFree(T, x - 2.4, z - 1, x + 2.4, z + 1)) return;
  const c = makeCar('smallvan'); for (const d of c.doors) d.pivot.rotation[d.axis] = d.open;
  c.group.position.set(x, 0, z); c.group.rotation.y = Math.PI / 2; bakeKeep(T, T.m(x, z), c.group);
  T.col.boxc(x, z, c.S.len, c.S.wid + 0.2, { h: 2.4 });
  const box = new THREE.Group(); box.add(part(geo.box(), '#c79a5b', 0, 0, 0, 0.6, 0.45, 0.5));
  actor(T, WORKER({ shirt: '#3fa34d', skin: '#f2c29b', hat: 'cap', hatColor: '#3fa34d', hair: '#c8742a' }), -62.6, 56.2, -Math.PI / 2, 'carry', { path: [[-62.4, 56.0], [-63.9, 56.0]], speed: 0.9, carry: box, line: 'Flour. Cheese. Tomatoes. For BREAD. Stop looking at me like that.' });
  actor(T, WORKER({ shirt: '#3fa34d', skin: '#8a5a3a', hat: 'cap', hatColor: '#3fa34d', belly: 1.3 }), -63.3, 60.6, -2.6, 'idle', { line: 'I supervise. It\'s a skill.' });
}
