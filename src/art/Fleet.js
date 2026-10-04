/* Fleet.js - the vehicles you can own, each its own build: the Rusty Scooter,
   the Delivery Moped, the Small Delivery Car, the Delivery Van, the Cargo Van,
   the Mafia Transport Truck and the Massive Pizza Transporter.

   Every builder returns the same shape as makeCar: { group, body, wheels, S,
   seats } plus
     hold   - the cargo space { x, y, z, w, l, h } in body coordinates
              (Vehicles.js packs the loaded items into it, so you see them)
     doors  - [{ pivot, axis, open }]: lids, hatches, barn doors, roll-up
              doors; they open when somebody stands at the back
     hideCargoClosed - cargo is only drawn while the doors are open
   +z is the front of the vehicle. */
import * as THREE from '../../lib/three.module.js';
import { geo, part, mat, rot, signMesh } from './Mesher.js';

const TIRE = '#1d1a24', HUB = '#c8c8d8', CHROME = { rough: 0.25, metal: 0.7 }, GLASS = { rough: 0.12, metal: 0.4 };
const glass = () => mat('#2a3550', GLASS);

function base(style, S) { const g = new THREE.Group(), body = new THREE.Group(); g.add(body); return { group: g, body, wheels: [], style, S, seats: [], doors: [] }; }
/** a wheel on its side: rubber, a hub, and (if you like) a worn tread */
function wheel(C, x, y, z, r, w = 0.3, o = {}) {
  const wh = part(geo.cyl(o.n || 12), o.tire || TIRE, x, y, z, r * 2, w, r * 2);
  wh.rotation.z = Math.PI / 2;
  wh.add(part(geo.cyl(8), o.hub || HUB, 0, w * 0.52, 0, 0.55, 0.06, 0.55, CHROME));
  wh.add(part(geo.cyl(8), o.hub || HUB, 0, -w * 0.52, 0, 0.55, 0.06, 0.55, CHROME));
  if (o.tread) for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; wh.add(rot(part(geo.box(), '#2b2833', Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5, 0.06, w * 1.02, 0.12), 'y', -a)); }
  C.group.add(wh); C.wheels.push(wh);
  return wh;
}
/** a hinged door: returns the pivot (add parts to it) */
function hinge(C, x, y, z, axis, open) { const p = new THREE.Group(); p.position.set(x, y, z); C.body.add(p); C.doors.push({ pivot: p, axis, open }); return p; }
function lights(C, L, W, y, rearY, front = true) {
  for (const s of [-1, 1]) {
    if (front) C.body.add(part(geo.box(), '#fff6c8', s * W * 0.36, y, L / 2 + 0.02, 0.3, 0.16, 0.05, { emissive: 0xfff2b0, ei: 0.5 }));
    C.body.add(part(geo.box(), '#c41a1a', s * W * 0.42, rearY, -L / 2 - 0.02, 0.18, 0.22, 0.05, { emissive: 0xff2020, ei: 0.35 }));
  }
}
/** a shell: floor, two sides, roof and a front wall - a box you can see into from the back */
function shell(C, z0, z1, y0, y1, W, color, t = 0.06) {
  const L = z1 - z0, zc = (z0 + z1) / 2, H = y1 - y0;
  C.body.add(part(geo.box(), '#5a5a68', 0, y0 + t / 2, zc, W - 0.02, t, L));
  for (const s of [-1, 1]) C.body.add(part(geo.box(), color, s * (W / 2 - t / 2), y0 + H / 2, zc, t, H, L));
  C.body.add(part(geo.box(), color, 0, y1 - t / 2, zc, W, t, L));
  C.body.add(part(geo.box(), color, 0, y0 + H / 2, z1 - t / 2, W, H, t));
  C.body.add(part(geo.box(), '#3a3a48', 0, y0 + H / 2, z0 + 0.03, W - 0.1, H - 0.1, 0.02));   // the inside of the doorway, dark
}

/* ======================================================================
   THE RUSTY SCOOTER - free, slow, held together by duct tape
   ====================================================================== */
export function rusty() {
  const S = { len: 1.85, wid: 0.72, h: 0.9, scooter: true };
  const C = base('scooter', S), b = C.body;
  const PAINT = '#7fb0a0', RUST = '#a8542a', RUST2 = '#7a3a1a', TAPE = '#9a9aa8';
  b.add(part(geo.box(), PAINT, 0, 0.42, 0.05, 0.46, 0.3, 1.25, { rough: 0.9 }));                    // the floorboard and frame
  b.add(part(geo.box(), '#5a5a68', 0, 0.3, 0.05, 0.4, 0.06, 1.2));
  for (const [x, y, z, w, h] of [[0.231, 0.44, 0.3, 0.02, 0.14], [-0.231, 0.4, -0.2, 0.02, 0.16], [0.231, 0.5, -0.35, 0.02, 0.1]]) b.add(part(geo.box(), RUST, x, y, z, w, h, 0.22, { rough: 1 }));
  b.add(rot(part(geo.box(), PAINT, 0, 0.78, 0.6, 0.42, 0.75, 0.12, { rough: 0.9 }), 'x', -0.18));     // front shield, dented
  b.add(rot(part(geo.box(), RUST2, 0.12, 0.95, 0.66, 0.12, 0.18, 0.02), 'x', -0.18));
  b.add(rot(part(geo.box(), TAPE, -0.06, 0.7, 0.665, 0.34, 0.07, 0.02), 'z', 0.25));                 // duct tape
  b.add(rot(part(geo.box(), TAPE, -0.06, 0.7, 0.67, 0.07, 0.3, 0.02), 'z', 0.25));
  b.add(rot(part(geo.cyl(6), '#8a8a98', 0, 1.18, 0.66, 0.06, 0.55, 0.06), 'z', Math.PI / 2 + 0.06)); // handlebar, a bit bent
  for (const s of [-1, 1]) b.add(part(geo.cyl(6), '#2b2b33', s * 0.29, 1.19 + s * 0.016, 0.66, 0.07, 0.14, 0.07));
  b.add(part(geo.cyl(6), '#8a8a98', 0, 0.98, 0.66, 0.05, 0.42, 0.05));
  b.add(part(geo.cyl(8), '#fff6c8', 0, 1.06, 0.73, 0.16, 0.06, 0.16, { emissive: 0xfff2b0, ei: 0.3 }));
  b.add(rot(part(geo.box(), '#1b1b24', 0.03, 1.07, 0.766, 0.12, 0.012, 0.01), 'z', 0.7));            // a crack in the headlight
  b.add(rot(part(geo.cyl(6), '#8a8a98', 0.2, 1.38, 0.64, 0.025, 0.3, 0.025), 'z', -0.5));             // one mirror, bent
  b.add(part(geo.box(), '#c8c8d8', 0.27, 1.5, 0.6, 0.1, 0.07, 0.02, CHROME));
  b.add(part(geo.box(), '#6a4a3a', 0, 0.72, -0.18, 0.4, 0.14, 0.6, { rough: 0.95 }));                // seat, cracked
  b.add(part(geo.box(), '#d8c8a8', 0.08, 0.795, -0.12, 0.16, 0.01, 0.06));
  b.add(part(geo.box(), PAINT, 0, 0.55, -0.25, 0.5, 0.28, 0.75, { rough: 0.9 }));                    // engine cover
  b.add(part(geo.box(), RUST, -0.25, 0.55, -0.4, 0.02, 0.2, 0.3, { rough: 1 }));
  b.add(rot(part(geo.cyl(6), '#5a5a68', 0.2, 0.32, -0.62, 0.07, 0.4, 0.07), 'x', Math.PI / 2 + 0.3)); // exhaust
  // the rack and the little wooden delivery crate (open top, a lid on a hinge)
  for (const s of [-1, 1]) b.add(part(geo.box(), '#5a5a68', s * 0.2, 0.84, -0.62, 0.03, 0.2, 0.5));
  b.add(part(geo.box(), '#5a5a68', 0, 0.94, -0.62, 0.44, 0.03, 0.5));
  const cr = '#a87c44';
  b.add(part(geo.box(), cr, 0, 0.97, -0.62, 0.66, 0.04, 0.62));
  for (const s of [-1, 1]) { b.add(part(geo.box(), cr, s * 0.32, 1.17, -0.62, 0.03, 0.4, 0.62)); b.add(part(geo.box(), cr, 0, 1.17, -0.62 + s * 0.3, 0.66, 0.4, 0.03)); }
  b.add(part(geo.box(), '#8a6234', 0, 1.3, -0.32, 0.67, 0.05, 0.04));
  const s1 = signMesh(['PIZZA?'], 0.5, 0.2, { bg: '#d8c8a0', fg: '#8a1a1a', border: false }); s1.position.set(0, 1.15, -0.94); s1.rotation.y = Math.PI; b.add(s1);
  const lid = hinge(C, 0, 1.38, -0.31, 'x', -1.9); lid.add(part(geo.box(), cr, 0, 0.02, -0.31, 0.68, 0.04, 0.64));
  C.hold = { x: 0, y: 1.0, z: -0.62, w: 0.6, l: 0.56, h: 0.55 };
  wheel(C, 0, 0.24, 0.62, 0.24, 0.16, { tire: '#3a3640', tread: true });
  wheel(C, 0, 0.24, -0.62, 0.24, 0.16, { tire: '#3a3640', tread: true });
  b.add(part(geo.box(), '#c41a1a', 0, 0.82, -0.94, 0.14, 0.08, 0.03, { emissive: 0xff2020, ei: 0.3 }));
  C.seats = [{ x: 0, y: 0.78, z: -0.1 }, { x: 0, y: 0.82, z: -0.45 }];
  return C;
}

/* ======================================================================
   THE DELIVERY MOPED - shiny, with a big insulated top box
   ====================================================================== */
export function moped() {
  const S = { len: 2.0, wid: 0.76, h: 1.0, scooter: true };
  const C = base('moped', S), b = C.body;
  const RED = '#d6232a', CR = '#c8ccd8';
  b.add(part(geo.box(), RED, 0, 0.45, 0, 0.44, 0.28, 1.2, { rough: 0.35 }));
  b.add(rot(part(geo.box(), RED, 0, 0.82, 0.62, 0.44, 0.8, 0.14, { rough: 0.35 }), 'x', -0.25));
  b.add(rot(part(geo.box(), '#bfe4ff', 0, 1.36, 0.72, 0.42, 0.42, 0.02, { opacity: 0.35, rough: 0.05 }), 'x', -0.35));   // windscreen
  b.add(rot(part(geo.cyl(8), CR, 0, 1.18, 0.72, 0.06, 0.6, 0.06, CHROME), 'z', Math.PI / 2));
  for (const s of [-1, 1]) { b.add(part(geo.cyl(6), '#1b1b24', s * 0.3, 1.18, 0.72, 0.07, 0.15, 0.07)); b.add(rot(part(geo.cyl(6), CR, s * 0.22, 1.36, 0.7, 0.025, 0.3, 0.025, CHROME), 'z', -s * 0.3)); b.add(part(geo.ico(0), CR, s * 0.27, 1.5, 0.68, 0.12, 0.08, 0.04, CHROME)); }
  b.add(part(geo.cyl(10), '#fff6c8', 0, 1.0, 0.8, 0.2, 0.08, 0.2, { emissive: 0xfff2b0, ei: 0.5 }));
  b.add(part(geo.box(), '#1b1b24', 0, 0.74, -0.15, 0.4, 0.16, 0.62));                              // seat
  b.add(part(geo.box(), RED, 0, 0.6, -0.32, 0.5, 0.3, 0.82, { rough: 0.35 }));
  b.add(part(geo.box(), CR, 0, 0.62, 0.0, 0.52, 0.04, 0.2, CHROME));
  b.add(rot(part(geo.cyl(8), CR, 0.22, 0.36, -0.6, 0.08, 0.5, 0.08, CHROME), 'x', Math.PI / 2 + 0.2));
  // the top box: insulated, a lid on a hinge
  b.add(part(geo.box(), '#2b2b33', 0, 0.84, -0.62, 0.4, 0.06, 0.42));
  const TB = '#f6f1e6';
  b.add(part(geo.box(), TB, 0, 0.88, -0.66, 0.74, 0.04, 0.7, { rough: 0.5 }));
  for (const s of [-1, 1]) { b.add(part(geo.box(), TB, s * 0.36, 1.18, -0.66, 0.04, 0.6, 0.7, { rough: 0.5 })); b.add(part(geo.box(), TB, 0, 1.18, -0.66 + s * 0.34, 0.74, 0.6, 0.04, { rough: 0.5 })); }
  const s1 = signMesh(['HOT', 'PIZZA'], 0.5, 0.36, { bg: '#d6232a', fg: '#ffffff', border: false }); s1.position.set(0, 1.18, -1.015); s1.rotation.y = Math.PI; b.add(s1);
  for (const s of [-1, 1]) { const s2 = signMesh(['HOT', 'PIZZA'], 0.46, 0.34, { bg: '#d6232a', fg: '#ffffff', border: false }); s2.position.set(s * 0.385, 1.18, -0.66); s2.rotation.y = s * Math.PI / 2; b.add(s2); }
  const lid = hinge(C, 0, 1.48, -0.31, 'x', -1.7); lid.add(part(geo.box(), TB, 0, 0.03, -0.35, 0.76, 0.06, 0.72, { rough: 0.5 })); lid.add(part(geo.box(), '#d6232a', 0, 0.065, -0.35, 0.6, 0.01, 0.5));
  C.hold = { x: 0, y: 0.91, z: -0.66, w: 0.66, l: 0.62, h: 0.55 };
  wheel(C, 0, 0.28, 0.66, 0.28, 0.18); wheel(C, 0, 0.28, -0.6, 0.28, 0.2);
  b.add(part(geo.box(), '#c41a1a', 0, 0.82, -1.02, 0.2, 0.08, 0.03, { emissive: 0xff2020, ei: 0.35 }));
  C.seats = [{ x: 0, y: 0.8, z: -0.1 }, { x: 0, y: 0.84, z: -0.4 }];
  return C;
}

/* ======================================================================
   THE SMALL DELIVERY CAR - a hatchback with a PIZZA! sign
   ====================================================================== */
export function hatch() {
  const L = 3.5, W = 1.76, S = { len: L, wid: W, h: 1.0, cab: 0.92, sign: true };
  const C = base('delivery', S), b = C.body;
  const P = '#ff6a3a', P2 = '#e8502a';
  b.add(part(geo.box(), P, 0, 0.58, 0.15, W, 0.5, L - 0.3, { rough: 0.45 }));                       // body
  b.add(rot(part(geo.box(), P, 0, 0.72, L / 2 - 0.35, W - 0.04, 0.24, 0.7, { rough: 0.45 }), 'x', 0.14));   // sloped bonnet
  b.add(part(geo.box(), '#2b2b33', 0, 0.36, L / 2 - 0.03, W * 0.96, 0.18, 0.1));
  b.add(part(geo.box(), '#2b2b33', 0, 0.36, -L / 2 + 0.06, W * 0.96, 0.18, 0.1));
  b.add(part(geo.box(), '#c8ccd8', 0, 0.55, L / 2 + 0.01, 0.8, 0.12, 0.04, CHROME));                // grille
  // the cabin: pillars, a roof, glass all round
  const cz0 = -1.1, cz1 = 0.95, cy0 = 0.83, cy1 = 1.75;
  b.add(part(geo.box(), P2, 0, cy1 - 0.04, (cz0 + cz1) / 2 - 0.05, W * 0.86, 0.08, cz1 - cz0 + 0.1));
  for (const s of [-1, 1]) for (const z of [cz1, -0.1, cz0]) b.add(part(geo.box(), P2, s * W * 0.42, (cy0 + cy1) / 2, z, 0.08, cy1 - cy0, 0.1));
  b.add(rot(part(geo.box(), glass(), 0, 1.3, cz1 + 0.04, W * 0.8, 0.82, 0.04), 'x', -0.3));
  for (const s of [-1, 1]) b.add(part(geo.box(), glass(), s * (W * 0.42 + 0.01), 1.3, (cz0 + cz1) / 2, 0.03, 0.75, cz1 - cz0 - 0.1));
  // the roof sign
  b.add(part(geo.box(), '#ffd23f', 0, cy1 + 0.22, -0.1, 0.95, 0.42, 0.22));
  for (const s of [-1, 1]) { const t = signMesh(['PIZZA!'], 0.9, 0.38, { bg: '#ffd23f', fg: '#c41a1a', border: false }); t.position.set(0, cy1 + 0.22, -0.1 + s * 0.115); t.rotation.y = s > 0 ? 0 : Math.PI; b.add(t); }
  // the trunk: a floor, and the hatch on a hinge at the roof
  b.add(part(geo.box(), '#3a3a48', 0, 0.84, -1.35, W * 0.84, 0.03, 0.75));
  const hh = hinge(C, 0, cy1 - 0.02, cz0 - 0.02, 'x', -1.4);
  hh.add(rot(part(geo.box(), P2, 0, -0.42, -0.2, W * 0.86, 0.9, 0.06), 'x', 0.42));
  hh.add(rot(part(geo.box(), glass(), 0, -0.3, -0.25, W * 0.7, 0.4, 0.02), 'x', 0.42));
  C.hold = { x: 0, y: 0.86, z: -1.36, w: W * 0.8, l: 0.72, h: 0.8 }; C.hideCargoClosed = true;
  lights(C, L, W, 0.62, 0.7);
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) wheel(C, x * W / 2, 0.34, z * L * 0.31, 0.34, 0.28);
  C.seats = [{ x: W * 0.22, y: 0.55, z: 0.15 }, { x: -W * 0.22, y: 0.55, z: 0.15 }, { x: W * 0.22, y: 0.55, z: -0.55 }, { x: -W * 0.22, y: 0.55, z: -0.55 }];
  return C;
}

/* ======================================================================
   THE DELIVERY VAN - white, a cargo box with two barn doors
   THE CARGO VAN    - longer, high roof, shelves inside
   ====================================================================== */
function cargoVan(style, big) {
  const L = big ? 5.8 : 4.7, W = big ? 2.1 : 1.92, H = big ? 2.75 : 2.2;
  const S = { len: L, wid: W, h: H, cab: 0.6, van: true };
  const C = base(style, S), b = C.body;
  const BODY = big ? '#dcdcea' : '#f2f2f8', TRIM = big ? '#3a7bd5' : '#43a85a';
  const cabL = 1.5, zc = L / 2 - cabL / 2, boxZ0 = -L / 2, boxZ1 = L / 2 - cabL;
  // the cab
  b.add(part(geo.box(), BODY, 0, 0.75, zc, W, 0.8, cabL, { rough: 0.4 }));
  b.add(rot(part(geo.box(), BODY, 0, 1.25, zc + 0.1, W, 0.8, cabL - 0.3, { rough: 0.4 }), 'x', 0.0));
  b.add(rot(part(geo.box(), glass(), 0, 1.45, L / 2 - 0.42, W * 0.86, 0.62, 0.04), 'x', -0.42));
  for (const s of [-1, 1]) b.add(part(geo.box(), glass(), s * (W / 2 + 0.01), 1.45, zc + 0.1, 0.03, 0.5, cabL * 0.55));
  b.add(rot(part(geo.box(), BODY, 0, 1.62, L / 2 - 0.25, W, 0.12, 0.6), 'x', -0.42));
  b.add(part(geo.box(), '#2b2b33', 0, 0.42, L / 2, W * 0.98, 0.24, 0.12));
  b.add(part(geo.box(), '#3a3a48', 0, 0.65, L / 2 + 0.01, W * 0.6, 0.2, 0.04));
  for (const s of [-1, 1]) { b.add(part(geo.box(), '#2b2b33', s * (W / 2 + 0.12), 1.4, L / 2 - 0.55, 0.06, 0.26, 0.14)); b.add(part(geo.box(), '#a8c8e0', s * (W / 2 + 0.12), 1.4, L / 2 - 0.62, 0.05, 0.22, 0.01)); }
  // the cargo box: a shell you can see into
  shell(C, boxZ0, boxZ1, 0.45, H, W, BODY);
  b.add(part(geo.box(), TRIM, 0, 0.95, (boxZ0 + boxZ1) / 2, W + 0.02, 0.18, boxZ1 - boxZ0 - 0.1));
  for (const s of [-1, 1]) { const t = signMesh([big ? 'CRUMB CARGO CO.' : 'TOTALLY NOT PIZZA'], Math.min(2.8, boxZ1 - boxZ0 - 0.4), 0.42, { bg: BODY, fg: TRIM, border: false }); t.position.set(s * (W / 2 + 0.035), 1.55, (boxZ0 + boxZ1) / 2); t.rotation.y = s * Math.PI / 2; b.add(t); }
  if (big) {
    for (const s of [-1, 1]) for (let k = 0; k < 2; k++) b.add(part(geo.box(), '#8a8a98', s * (W / 2 - 0.22), 0.95 + k * 0.7, (boxZ0 + boxZ1) / 2, 0.32, 0.04, boxZ1 - boxZ0 - 0.2));   // shelves
    b.add(part(geo.box(), '#2b2b33', 0, H + 0.04, (boxZ0 + boxZ1) / 2, W * 0.8, 0.06, boxZ1 - boxZ0 - 0.6));   // roof rack
    for (let i = 0; i < 4; i++) b.add(part(geo.box(), '#2b2b33', 0, H + 0.1, boxZ0 + 0.6 + i * (boxZ1 - boxZ0 - 1.2) / 3, W * 0.82, 0.05, 0.06));
  }
  // barn doors at the back
  for (const s of [-1, 1]) {
    const d = hinge(C, s * W / 2, 0.45, boxZ0, 'y', s * 1.95);
    d.add(part(geo.box(), BODY, -s * W / 4, (H - 0.45) / 2, -0.03, W / 2 - 0.02, H - 0.47, 0.06, { rough: 0.4 }));
    d.add(part(geo.box(), glass(), -s * W / 4, (H - 0.45) * 0.72, -0.065, W / 2 - 0.3, 0.42, 0.02));
    d.add(part(geo.box(), '#2b2b33', -s * (W / 2 - 0.12), (H - 0.45) * 0.45, -0.07, 0.04, 0.2, 0.04));
  }
  C.hold = { x: 0, y: 0.5, z: (boxZ0 + boxZ1) / 2, w: big ? W - 0.75 : W - 0.25, l: boxZ1 - boxZ0 - 0.2, h: H - 0.65 };
  lights(C, L, W, 0.75, 0.75);
  const wr = big ? 0.42 : 0.38;
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) wheel(C, x * W / 2, wr, z * L * 0.32, wr, 0.3);
  C.seats = [{ x: W * 0.24, y: 0.65, z: zc }, { x: -W * 0.24, y: 0.65, z: zc }];
  return C;
}
export const deliveryVan = () => cargoVan('smallvan', false);
export const bigVan = () => cargoVan('van', true);

/* ======================================================================
   THE MAFIA TRANSPORT TRUCK - black and gold, a roll-up door
   ====================================================================== */
export function mafiaTruck() {
  const L = 7.6, W = 2.5, S = { len: L, wid: W, h: 3.2, cab: 1.0, cargo: true };
  const C = base('cargo', S), b = C.body;
  const BLK = '#1b1b24', GOLD = '#d8a83a', g2 = { rough: 0.3, metal: 0.6 };
  const cabL = 2.2, cabZ = L / 2 - cabL / 2 - 0.1, cabH = 1.9;
  // the cab: square, black, gold trim, a chrome grille, exhaust stacks
  b.add(part(geo.box(), BLK, 0, 0.35 + cabH / 2, cabZ, W, cabH, cabL, { rough: 0.35 }));
  b.add(part(geo.box(), glass(), 0, 0.35 + cabH * 0.7, cabZ + cabL / 2 + 0.01, W * 0.84, cabH * 0.36, 0.04));
  for (const s of [-1, 1]) b.add(part(geo.box(), glass(), s * (W / 2 + 0.01), 0.35 + cabH * 0.7, cabZ + 0.15, 0.04, cabH * 0.34, cabL * 0.55));
  b.add(part(geo.box(), '#c8ccd8', 0, 0.85, L / 2 + 0.01, W * 0.7, 0.6, 0.06, CHROME));
  for (let i = 0; i < 5; i++) b.add(part(geo.box(), '#3a3a48', 0, 0.64 + i * 0.1, L / 2 + 0.045, W * 0.66, 0.03, 0.02));
  b.add(part(geo.box(), GOLD, 0, 0.35 + cabH - 0.06, cabZ, W + 0.02, 0.1, cabL + 0.02, g2));
  b.add(part(geo.box(), GOLD, 0, 1.25, cabZ, W + 0.02, 0.06, cabL + 0.02, g2));
  for (const s of [-1, 1]) { b.add(part(geo.cyl(8), '#c8ccd8', s * (W / 2 + 0.12), 1.9, cabZ - cabL / 2 + 0.2, 0.14, 2.0, 0.14, CHROME)); b.add(part(geo.box(), '#3a3a48', s * (W / 2 + 0.12), 0.55, cabZ - 0.3, 0.3, 0.3, 0.9)); }
  b.add(part(geo.box(), '#2b2b33', 0, 0.45, L / 2, W, 0.28, 0.16));
  // the box, with the family crest, shelves inside, and a roll-up door
  const z0 = -L / 2, z1 = cabZ - cabL / 2 - 0.15, top = 3.3;
  shell(C, z0, z1, 0.6, top, W + 0.1, BLK);
  for (const y of [0.62, top - 0.08]) b.add(part(geo.box(), GOLD, 0, y, (z0 + z1) / 2, W + 0.14, 0.1, z1 - z0 + 0.02, g2));
  for (const s of [-1, 1]) {
    const t = signMesh(['FAMIGLIA', 'LOGISTICS'], 3.0, 1.0, { bg: BLK, fg: GOLD, borderColor: GOLD }); t.position.set(s * (W / 2 + 0.1), 2.0, (z0 + z1) / 2); t.rotation.y = s * Math.PI / 2; b.add(t);
    b.add(part(geo.ico(1), GOLD, s * (W / 2 + 0.09), 2.0, (z0 + z1) / 2 - 2.0, 0.06, 0.6, 0.5, g2));   // the crest
    for (let k = 0; k < 2; k++) b.add(part(geo.box(), '#8a8a98', s * (W / 2 - 0.25), 1.3 + k * 0.85, (z0 + z1) / 2, 0.4, 0.05, z1 - z0 - 0.3));
  }
  const door = hinge(C, 0, top - 0.05, z0, 'x', -1.62);
  for (let i = 0; i < 9; i++) door.add(part(geo.box(), i % 2 ? '#2b2b38' : BLK, 0, -0.15 - i * 0.29, -0.03, W + 0.06, 0.28, 0.05));
  door.add(part(geo.box(), GOLD, 0, -2.5, -0.065, 0.5, 0.06, 0.03, g2));
  C.hold = { x: 0, y: 0.66, z: (z0 + z1) / 2, w: W - 1.1, l: z1 - z0 - 0.3, h: top - 1.0 }; C.hideCargoClosed = true;
  lights(C, L, W, 0.8, 0.9);
  for (const z of [L * 0.36, -L * 0.18, -L * 0.34]) for (const s of [-1, 1]) wheel(C, s * W / 2, 0.52, z, 0.52, 0.36, { hub: GOLD });
  C.seats = [{ x: W * 0.22, y: 0.55, z: cabZ }, { x: -W * 0.22, y: 0.55, z: cabZ }];
  return C;
}

/* ======================================================================
   THE MASSIVE PIZZA TRANSPORTER - a semi truck and a pizza-box trailer
   ====================================================================== */
export function transporter() {
  const L = 13, W = 2.6, S = { len: L, wid: W, h: 3.4, cab: 1.0, cargo: true };
  const C = base('transporter', S), b = C.body;
  const RED = '#c41a1a', CARD = '#c79a5b', CARD2 = '#a87c44';
  const cabL = 2.2, cabZ = L / 2 - cabL / 2 - 0.1, cabH = 1.9;
  // the tractor: a long nose, a tall cab, chrome everything
  b.add(part(geo.box(), RED, 0, 1.0, L / 2 - 0.9, W * 0.82, 1.1, 1.8, { rough: 0.3 }));
  b.add(part(geo.box(), '#c8ccd8', 0, 1.0, L / 2 + 0.02, W * 0.7, 0.95, 0.06, CHROME));
  b.add(part(geo.box(), RED, 0, 0.35 + cabH / 2 + 0.3, cabZ - 1.0, W, cabH + 0.6, cabL - 0.6, { rough: 0.3 }));
  b.add(part(geo.box(), glass(), 0, 2.2, cabZ - 0.69, W * 0.84, 0.7, 0.04));
  for (const s of [-1, 1]) { b.add(part(geo.box(), glass(), s * (W / 2 + 0.01), 2.2, cabZ - 1.0, 0.04, 0.6, 0.9)); b.add(part(geo.cyl(8), '#c8ccd8', s * (W / 2 - 0.05), 2.6, cabZ - 1.75, 0.18, 2.8, 0.18, CHROME)); b.add(part(geo.cyl(10), '#c8ccd8', s * (W / 2 + 0.05), 0.75, cabZ - 0.2, 0.7, 1.2, 0.7, CHROME)); }
  b.add(part(geo.box(), '#ffd23f', 0, 2.95, cabZ - 1.0, W * 0.6, 0.18, 0.4, { emissive: 0xffc020, ei: 0.4 }));
  b.add(part(geo.box(), '#2b2b33', 0, 0.45, L / 2, W, 0.3, 0.2));
  // the trailer: a GIANT pizza box. The lid is the door.
  const z0 = -L / 2, z1 = cabZ - 2.2, y0 = 1.0, y1 = 3.3;
  shell(C, z0, z1, y0, y1 - 0.12, W, CARD);
  for (const s of [-1, 1]) {
    const t = signMesh(['PIZZA'], 4.5, 1.2, { bg: CARD, fg: RED, border: false }); t.position.set(s * (W / 2 + 0.04), 2.15, (z0 + z1) / 2); t.rotation.y = s * Math.PI / 2; b.add(t);
    b.add(part(geo.box(), CARD2, s * (W / 2 + 0.035), 1.25, (z0 + z1) / 2, 0.02, 0.06, z1 - z0 - 0.4));
  }
  b.add(part(geo.box(), '#3a3a48', 0, 0.7, (z0 + z1) / 2, W * 0.6, 0.3, z1 - z0));   // chassis
  const lid = hinge(C, 0, y1 - 0.12, z1, 'x', 1.5);
  lid.add(part(geo.box(), CARD, 0, 0.06, -(z1 - z0) / 2, W + 0.12, 0.12, z1 - z0 + 0.06));
  const top = signMesh(['GIANT', 'PIZZA', '(REAL)'], W * 0.9, 3.2, { bg: CARD, fg: RED, border: false }); top.rotation.x = -Math.PI / 2; top.rotation.z = Math.PI / 2; top.position.set(0, 0.125, -(z1 - z0) / 2); lid.add(top);
  // a slice of pizza poking out
  b.add(rot(part(geo.cone(3), '#ffd23f', 0, y1 - 0.2, z0 + 0.2, 1.2, 0.08, 1.2), 'x', 0));
  C.hold = { x: 0, y: y0 + 0.08, z: (z0 + z1) / 2, w: W - 0.3, l: z1 - z0 - 0.3, h: y1 - y0 - 0.4 }; C.hideCargoClosed = true;
  lights(C, L, W, 0.9, 1.1);
  for (const z of [L / 2 - 1.2, cabZ - 1.8, cabZ - 2.9, -L / 2 + 1.0, -L / 2 + 2.1]) for (const s of [-1, 1]) wheel(C, s * W / 2, 0.55, z, 0.55, 0.4);
  C.seats = [{ x: W * 0.22, y: 0.9, z: cabZ - 1.0 }, { x: -W * 0.22, y: 0.9, z: cabZ - 1.0 }];
  return C;
}

export const FLEET = { scooter: rusty, moped, delivery: hatch, smallvan: deliveryVan, van: bigVan, cargo: mafiaTruck, transporter };

/** a big boxed thing you carry: equipment and furniture from the shops */
export function makeBigBox(it) {
  const g = new THREE.Group(), [w, l, h] = it.size || [1, 1, 1];
  const wood = it.k === 'equip';
  g.add(part(geo.box(), wood ? '#b8894c' : '#c79a5b', 0, h / 2, 0, w, h, l, { rough: 0.9 }));
  if (wood) for (const y of [0.1, h - 0.1]) for (const s of [-1, 1]) g.add(part(geo.box(), '#8a6234', 0, y, s * (l / 2 + 0.01), w + 0.02, 0.1, 0.03));
  else g.add(part(geo.box(), '#d8b878', 0, h + 0.005, 0, 0.12, 0.01, l + 0.02));   // packing tape
  for (const s of [-1, 1]) { const t = signMesh([(it.label || 'BOX').toUpperCase().slice(0, 18), (it.kg || '') + ' KG'], Math.min(w * 0.9, 1.4), Math.min(h * 0.5, 0.5), { bg: wood ? '#e8d8b0' : '#f6f1e6', fg: '#2a1640', border: false }); t.position.set(0, h * 0.55, s * (l / 2 + 0.02)); t.rotation.y = s > 0 ? 0 : Math.PI; g.add(t); }
  g.add(part(geo.box(), '#2a1640', w * 0.3, h * 0.85, l / 2 + 0.021, 0.16, 0.12, 0.01));   // THIS WAY UP arrow
  return g;
}
