/* Shops.js - the big stores get their own architecture.

   HONEST HANK'S MOTORS - a glass showroom with cars on turntables and spec
   cards, a service garage with roll-up doors, a lift and a wall of tires,
   an outdoor lot for the big trucks and a pick-up bay where your new
   vehicle waits for you.

   Plus a storefront kit per store (grocery, equipment warehouse, furniture
   showroom, general store) that dresses the outside of a Town.bldg() box:
   canopies, display windows, carts, pallets, a forklift, rooftop letters. */
import * as THREE from '../../lib/three.module.js';
import { Mesher, signMesh, vcGlowMat } from '../art/Mesher.js';
import { makeCar, bake } from '../art/Props.js';
import { VEHICLES } from '../data/Data.js';

const GLASS = () => new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.4, depthWrite: false });
const STEEL = '#3a3a48', CHROME = '#c8ccd8';

/** bake a model into a mesher, but keep its signs (textured) and see-through parts as real meshes */
export function bakeKeep(T, m, grp) {
  grp.updateMatrixWorld(true);
  bake(m, grp);
  const keep = [];
  grp.traverse(o => { if (o.isMesh && (o.material.map || o.material.transparent)) keep.push(o); });
  for (const o of keep) { const c = new THREE.Mesh(o.geometry, o.material); o.matrixWorld.decompose(c.position, c.quaternion, c.scale); c.castShadow = false; T.root.add(c); }
}

/** a vehicle on display: doors open, everything baked. Returns the built car (for its hold and size). */
function showCar(T, m, style, x, z, ry, y = 0, scale = 1, open = true) {
  const c = makeCar(style);
  if (open) for (const d of c.doors || []) d.pivot.rotation[d.axis] = d.open;
  c.group.position.set(x, y, z); c.group.rotation.y = ry; c.group.scale.setScalar(scale);
  bakeKeep(T, m, c.group);
  return c;
}

/** the spec card on a little stand: NAME / PRICE / CAPACITY / SPEED / STORAGE SIZE. You buy standing in front of it. */
function specCard(T, m, key, car, x, z, ry) {
  const v = VEHICLES[key], H = car && car.hold;
  const vol = H ? Math.max(0.1, H.w * H.l * H.h) : 0;
  const lines = [v.name.toUpperCase(), '$' + v.price.toLocaleString('en-US'), 'CAPACITY: ' + v.cap.toLocaleString('en-US') + ' KG', 'TOP SPEED: ' + Math.round(v.speed * 3.6) + ' KM/H', 'STORAGE: ' + (vol < 1 ? vol.toFixed(2) : vol.toFixed(1)) + ' M3'];
  const s = Math.sin(ry), c = Math.cos(ry);
  m.cyl(x, 0, z, 0.25, 0.06, STEEL, 8);
  m.cyl(x, 0, z, 0.04, 1.05, CHROME, 6);
  m.boxc(x - s * 0.02, 1.45, z - c * 0.02, 1.62, 1.12, 0.05, '#1b1b24', ry);
  T.sign(lines, x + s * 0.01, 1.45, z + c * 0.01, ry, 1.5, 1.02, { bg: '#fffdf4', fg: '#2a1640', stripe: '#d6232a', borderColor: '#1b1b24' });
  T.col.circle(x, z, 0.25, { h: 1.9 });
  (T.shopItems ||= []).push({ cat: 'vehicle', key, x: x + s * 0.95, z: z + c * 0.95 });
}

function turntable(T, m, x, z, r) {
  m.cyl(x, 0.07, z, r + 0.15, 0.08, '#c8a03a', 24);
  m.cyl(x, 0.07, z, r, 0.16, '#2a2238', 24);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; m.box(x + Math.sin(a) * r * 0.92, 0.24, z + Math.cos(a) * r * 0.92, 0.12, 0.02, 0.12, '#fff1b8', 0, 0.01); }
}

/* ======================================================================
   HONEST HANK'S MOTORS (the lot north of the gas station)
   ====================================================================== */
export function dealership(T, cx, cz) {
  const m = T.m(cx, cz - 20), mn = T.mn(cx, cz - 20), mc = T.mc(cx, cz - 20), col = T.col;
  const glass = new Mesher(0);
  (T.paved ||= []).push([47, -113, 113, -84]);   // no grass on the lot
  // the lot: dark asphalt, white lines, a red-and-white curb along the street
  mn.flat(49, -111, 111, -85.5, 0.06, '#6e6888', 4, 0.04);
  for (let x = 49; x < 111; x += 2) mn.box(x + 1, 0.06, -85.6, 2, 0.16, 0.25, (x / 2) % 2 ? '#d6232a' : '#f6f1e6', 0, 0.02);

  /* ---------- the glass showroom ---------- */
  const X0 = 51, X1 = 77, Z0 = -110, Z1 = -93.5, H = 6, DX = 61, DW = 3.2;
  const mid = (X0 + X1) / 2, midz = (Z0 + Z1) / 2;
  for (let i = 0; i < 13; i++) for (let j = 0; j < 8; j++) {
    const x = X0 + 0.3 + i * 1.95, z = Z0 + 0.3 + j * 2.0;
    mn.box(x + 0.97, 0.07, z + 1.0, 1.93, 0.04, 1.98, (i + j) % 2 ? '#f4f2f8' : '#dcd8e8', 0, 0.01);
  }
  // back (north) and east walls are solid: deep plum with a red stripe
  m.box(mid, 0, Z0 + 0.15, X1 - X0, H, 0.3, '#2a2238'); col.box(X0, Z0, X1, Z0 + 0.3, { h: H + 2 });
  m.box(X1 - 0.15, 0, midz, 0.3, H, Z1 - Z0, '#2a2238'); col.box(X1 - 0.3, Z0, X1, Z1, { h: H + 2 });
  mn.box(mid, 2.2, Z0 + 0.32, X1 - X0 - 0.6, 0.35, 0.04, '#d6232a');
  mn.box(X1 - 0.32, 2.2, midz, 0.04, 0.35, Z1 - Z0 - 0.6, '#d6232a');
  T.sign(["HONEST HANK'S", 'MOTORS'], mid - 2, 4.1, Z0 + 0.33, 0, 8, 2.2, { bg: '#2a2238', fg: '#ffd23f', borderColor: '#d6232a' });
  T.sign(['WE PROBABLY', "WON'T LIE"], X0 + 3.4, 3.9, Z0 + 0.33, 0, 3.6, 1.3, { bg: '#ffd23f', fg: '#2a1640' });
  T.sign(['FINANCING:', 'NO.'], X1 - 0.33, 3.8, Z0 + 4.5, -Math.PI / 2, 3, 1.3, { bg: '#ffffff', fg: '#d6232a', stripe: '#2a1640' });
  T.sign(['CAPACITY', 'IS EVERYTHING', '(weigh your stuff)'], X1 - 0.33, 3.8, Z1 - 4.2, -Math.PI / 2, 3, 1.5, { bg: '#c9e8ff', fg: '#1e2a5a' });
  // west and south: glass between steel mullions, a dark plinth, a door with sliding panels standing open
  const glassRun = (x0, z0, x1, z1, gapA, gapB) => {
    const alongX = z0 === z1, len = alongX ? x1 - x0 : z1 - z0, n = Math.round(len / 3.25);
    for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; m.box(x, 0, z, 0.16, H, 0.16, STEEL); }
    m.box((x0 + x1) / 2, H - 0.3, (z0 + z1) / 2, alongX ? len : 0.22, 0.3, alongX ? 0.22 : len, STEEL);
    const segs = gapA == null ? [[0, len]] : [[0, gapA], [gapB, len]];
    for (const [a, b] of segs) {
      const xa = alongX ? x0 + a : x0, xb = alongX ? x0 + b : x0, za = alongX ? z0 : z0 + a, zb = alongX ? z0 : z0 + b;
      m.box((xa + xb) / 2, 0, (za + zb) / 2, alongX ? b - a : 0.3, 0.45, alongX ? 0.3 : b - a, '#2a2238');
      glass.box((xa + xb) / 2, 0.45, (za + zb) / 2, alongX ? b - a : 0.05, H - 0.75, alongX ? 0.05 : b - a, '#bfe4ff');
      col.box(Math.min(xa, xb) - 0.12, Math.min(za, zb) - 0.12, Math.max(xa, xb) + 0.12, Math.max(za, zb) + 0.12, { h: H + 2 });
    }
  };
  glassRun(X0, Z0, X0, Z1);
  glassRun(X0, Z1, X1, Z1, DX - DW / 2 - X0, DX + DW / 2 - X0);
  // the automatic doors, slid open behind the glass, a canopy over them, a welcome mat
  for (const s of [-1, 1]) glass.box(DX + s * (DW / 2 + 0.8), 0.07, Z1 - 0.2, 1.6, 2.6, 0.05, '#d8f0ff');
  m.box(DX, 2.75, Z1, DW + 0.2, 0.18, 0.3, STEEL);
  m.boxc(DX, 3.3, Z1 + 1.3, DW + 2.6, 0.18, 2.8, '#d6232a', 0, -0.12, 0);
  for (const s of [-1, 1]) { m.cyl(DX + s * (DW / 2 + 1.1), 0, Z1 + 2.5, 0.07, 3.2, CHROME, 6); col.circle(DX + s * (DW / 2 + 1.1), Z1 + 2.5, 0.12); }
  mn.box(DX, 0.06, Z1 + 0.9, 2.6, 0.03, 1.4, '#3a3048', 0, 0.01);
  T.sign(['WELCOME!'], DX, 0.1, Z1 + 0.9, 0, 2.2, 0.7, { bg: '#3a3048', fg: '#ffd23f', border: false }).rotation.x = -Math.PI / 2;
  // roof slab, a red fascia, letters on the roof facing the street and the lot
  mn.box(mid, H, midz, X1 - X0 + 0.6, 0.35, Z1 - Z0 + 0.6, '#e8e8f0');
  m.box(mid, H - 0.55, Z1 + 0.15, X1 - X0 + 0.6, 0.6, 0.12, '#d6232a');
  m.box(X0 - 0.15, H - 0.55, midz, 0.12, 0.6, Z1 - Z0 + 0.6, '#d6232a');
  mc.box(mid, H - 0.45, midz, X1 - X0 - 0.4, 0.1, Z1 - Z0 - 0.4, '#f6f6fa');
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) mc.box(X0 + 3.5 + i * 6.3, H - 0.55, Z0 + 3 + j * 5.2, 2.6, 0.05, 0.5, '#fffbe8');
  m.box(mid, H + 0.35, Z1 - 1.2, 16, 2.6, 0.25, STEEL);
  T.sign(["HONEST HANK'S MOTORS"], mid, H + 1.65, Z1 - 1.05, 0, 15.6, 2.3, { bg: '#d6232a', fg: '#ffffff', borderColor: '#ffd23f' });
  T.sign(["HANK'S"], X0 + 0.3, H + 1.65, midz, -Math.PI / 2, 9, 2.3, { bg: '#d6232a', fg: '#ffffff', borderColor: '#ffd23f' });
  m.box(X0 + 0.15, H + 0.35, midz, 0.25, 2.6, 9.4, STEEL);

  /* the cars inside, on turntables, each with its spec card */
  const inside = [
    ['moped', 'moped', 55.5, -98.3, 0.7, 1.7, 55.5, -95.9],
    ['delivery', 'delivery', 63.5, -100.5, -0.5, 2.6, 63.8, -96.9],
    ['smallvan', 'smallvan', 70.5, -99.6, 0.45, 3.1, 73.6, -95.6],
    ['pickup', 'pickup', 57, -105.5, Math.PI / 2 + 0.25, 3.1, 60.8, -102.4],
  ];
  for (const [key, style, x, z, ry, r, sx, sz] of inside) {
    turntable(T, m, x, z, r);
    const c = showCar(T, m, style, x, z, ry, 0.23);
    col.circle(x, z, r * 0.8, { h: 2 });
    specCard(T, m, key, c, sx, sz, 0);
  }
  // Hank's desk: a computer, a nameplate, a bowl of free mints that are not free
  {
    const dx = 66, dz = -107.2;
    m.box(dx, 0, dz, 2.6, 0.78, 0.9, '#5a3a22'); m.box(dx, 0.78, dz, 2.8, 0.06, 1.0, '#8a5a33'); col.boxc(dx, dz, 2.6, 0.9, { h: 1 });
    m.box(dx - 0.6, 0.84, dz - 0.15, 0.6, 0.42, 0.06, '#1b1b24'); m.box(dx - 0.6, 0.88, dz - 0.115, 0.52, 0.32, 0.02, '#3a6ac8');
    m.cyl(dx + 0.7, 0.84, dz + 0.1, 0.18, 0.08, '#c8ccd8', 10); for (let i = 0; i < 6; i++) m.ico(dx + 0.7 + Math.sin(i) * 0.08, 0.95, dz + 0.1 + Math.cos(i) * 0.08, 0.05, 0.03, 0.05, i % 2 ? '#ffffff' : '#ff8fc8');
    T.sign(['HANK', '(honest)'], dx + 0.1, 0.98, dz + 0.51, 0, 0.7, 0.26, { bg: '#c8a03a', fg: '#1b1b24', border: false });
    m.box(dx, 0, dz - 1.0, 0.6, 0.5, 0.6, '#d6232a'); m.box(dx, 0.5, dz - 1.28, 0.6, 0.7, 0.1, '#d6232a');  // his chair
    for (const s of [-1, 1]) { m.box(dx + s * 0.7, 0, dz + 1.1, 0.5, 0.45, 0.5, '#3a3048'); m.box(dx + s * 0.7, 0.45, dz + 1.33, 0.5, 0.5, 0.06, '#3a3048'); }
  }
  T.poi.hank = { x: 66, z: -105.6 };
  // the SPECIAL ORDERS wall: scale models on plinths, the cars Hank only sells to the right people
  T.sign(['SPECIAL', 'ORDERS'], X1 - 0.33, 4.1, -103.8, -Math.PI / 2, 2.6, 1.0, { bg: '#1b1b24', fg: '#ffd23f', borderColor: '#c8a03a' });
  [['getaway', 'getaway', -108.3], ['family', 'family', -105.4], ['icecream', 'icecream', -102.5], ['armored', 'armored', -99.6]].forEach(([key, style, z]) => {
    const x = X1 - 1.1;
    m.box(x, 0, z, 1.3, 0.9, 2.2, '#2a2238'); m.box(x, 0.9, z, 1.4, 0.05, 2.3, '#c8a03a'); col.boxc(x, z, 1.3, 2.2, { h: 1 });
    const c = showCar(T, m, style, x, z, 0, 0.95, 0.38, false);
    specCard(T, m, key, c, x - 1.5, z, -Math.PI / 2);
  });
  // the trade-in corner: the rusty scooter on a pallet, not for sale (please take it)
  m.box(53.6, 0.07, -95.3, 1.6, 0.14, 2.2, '#b8894c');
  showCar(T, m, 'scooter', 53.6, -95.3, 0.4, 0.21, 1, false);
  T.sign(['TRADE-IN SPECIAL', '$0', '(please take it)'], 53.6, 1.6, -94.0, 0, 1.6, 0.8, { bg: '#ffe14a', fg: '#2a1640' });
  // plants, a water cooler, a coffee machine, a rack of keys
  for (const [x, z] of [[X0 + 0.9, Z0 + 0.9], [X0 + 0.9, Z1 - 0.9], [X1 - 0.9, Z1 - 0.9]]) { m.cyl(x, 0.07, z, 0.35, 0.6, '#f6f1e6', 10); m.ico(x, 1.3, z, 1.0, 1.4, 1.0, '#3f8a4a', 1); m.ico(x + 0.2, 1.9, z, 0.6, 0.7, 0.6, '#4fa64f', 1); col.circle(x, z, 0.4); }
  m.box(70, 0.07, Z0 + 0.6, 0.45, 1.0, 0.45, '#e8e8f0'); m.cyl(70, 1.07, Z0 + 0.6, 0.2, 0.45, '#9fd8ff', 10);
  m.box(71.2, 0.07, Z0 + 0.55, 0.8, 0.95, 0.5, '#5a3a22'); m.box(71.2, 1.02, Z0 + 0.55, 0.5, 0.6, 0.4, '#1b1b24'); m.cyl(71.1, 1.05, Z0 + 0.75, 0.06, 0.12, '#ffffff', 8);
  m.box(73.2, 1.4, Z0 + 0.32, 1.2, 0.8, 0.04, '#8a5a33'); for (let i = 0; i < 10; i++) m.box(72.75 + (i % 5) * 0.22, 1.5 + Math.floor(i / 5) * 0.32, Z0 + 0.36, 0.06, 0.16, 0.02, ['#ffd23f', '#d6232a', '#3a7bd5'][i % 3]);
  col.box(69.6, Z0, 74, Z0 + 1, { h: 1.6 });
  T.root.add(glass.build({ material: GLASS(), cast: false, receive: false }));
  (T.interiors ||= []).push({ cx: mid, cz: midz, w: X1 - X0, d: Z1 - Z0, front: 's', kind: 'showroom', info: {}, ih: H - 0.5 });

  /* ---------- the service garage ---------- */
  const G0 = 80, G1 = 96, GZ0 = -110, GZ1 = -97, GH = 5.5, CORR = '#a4aab8', CORR2 = '#8e94a4';
  const gm = (G0 + G1) / 2, gz = (GZ0 + GZ1) / 2;
  mn.flat(G0 + 0.3, GZ0 + 0.3, G1 - 0.3, GZ1, 0.07, '#a8a8b4', 2, 0.03);
  for (const [x, z, r] of [[84, -103, 1.1], [91, -101, 0.7], [87.5, -106, 0.8], [93, -98.5, 0.5]]) mn.cyl(x, 0.075, z, r, 0.01, '#5a5868', 10);
  // corrugated walls: panels with ribs, a steel frame
  const wallC = (x0, z0, x1, z1, y0 = 0, hh = GH) => {
    const alongX = Math.abs(z1 - z0) < 0.5, len = alongX ? x1 - x0 : z1 - z0;
    m.box((x0 + x1) / 2, y0, (z0 + z1) / 2, alongX ? len : 0.25, hh, alongX ? 0.25 : len, CORR);
    for (let t = 0.3; t < len; t += 0.6) m.box(alongX ? x0 + t : (x0 + x1) / 2, y0, alongX ? (z0 + z1) / 2 : z0 + t, alongX ? 0.1 : 0.32, hh, alongX ? 0.32 : 0.1, CORR2, 0, 0.02);
    if (y0 === 0) col.box(Math.min(x0, x1) - 0.15, Math.min(z0, z1) - 0.15, Math.max(x0, x1) + 0.15, Math.max(z0, z1) + 0.15, { h: GH + 2 });
  };
  wallC(G0, GZ0, G1, GZ0); wallC(G0, GZ0, G0, GZ1); wallC(G1, GZ0, G1, GZ1);
  // the front: three pillars, two roll-up doors (one up, one down), a header with hazard stripes
  for (const x of [G0 + 0.4, 88, G1 - 0.4]) { m.box(x, 0, GZ1, 0.8, GH, 0.5, '#5a5a6a'); col.boxc(x, GZ1, 0.8, 0.5, { h: GH + 2 }); }
  m.box(gm, 4.3, GZ1, G1 - G0, GH - 4.3, 0.5, '#5a5a6a');
  for (let i = 0; i < 16; i++) m.boxc(G0 + 0.5 + i, 4.45, GZ1 + 0.27, 0.5, 0.25, 0.02, i % 2 ? '#1b1b24' : '#ffd23f', 0, 0, 0.5);
  m.cyl(84.2, 3.95, GZ1 - 0.2, 0.35, 0.01, STEEL, 8);
  m.boxc(84.2, 3.95, GZ1 - 0.2, 6.6, 0.6, 0.6, '#c8ccd8');                                         // door A, rolled up
  for (let i = 0; i < 12; i++) m.box(91.8, 0.07 + i * 0.35, GZ1, 6.6, 0.37, 0.12, i % 2 ? '#d8dce6' : '#c0c6d2');   // door B, down
  m.box(91.8, 1.4, GZ1 + 0.07, 0.4, 0.08, 0.04, STEEL);
  col.box(88.4, GZ1 - 0.15, 95.2, GZ1 + 0.15, { h: GH + 2 });
  for (const x of [84.2, 91.8]) for (let k = -1; k <= 1; k += 2) m.box(x + k * 3.4, 0, GZ1 + 0.4, 0.2, 1.0, 0.2, '#ffd23f');
  T.sign(['SERVICE'], 84.2, 4.95, GZ1 + 0.27, 0, 4.2, 0.9, { bg: '#1e2a5a', fg: '#ffffff', border: false });
  T.sign(['TIRES - OIL - "REPAIRS"'], 91.8, 4.95, GZ1 + 0.27, 0, 5.6, 0.9, { bg: '#1e2a5a', fg: '#ffd23f', border: false });
  mn.box(gm, GH, gz, G1 - G0 + 0.4, 0.3, GZ1 - GZ0 + 0.4, '#8a84a0');
  mc.box(gm, 4.2, gz, G1 - G0 - 0.5, 0.08, GZ1 - GZ0 - 0.5, '#e6e6ee');
  for (const x of [84, 92]) for (const z of [-107, -101]) mc.box(x, 4.1, z, 2.8, 0.06, 0.25, '#ffffff');
  // the lift: two posts, arms, a car up in the air with its wheels off
  for (const s of [-1, 1]) { m.box(84 + s * 1.7, 0.07, -103.6, 0.4, 3.6, 0.5, '#d6232a'); col.boxc(84 + s * 1.7, -103.6, 0.4, 0.5, { h: 4 }); m.box(84 + s * 1.15, 1.45, -103.6, 0.9, 0.12, 0.25, STEEL); }
  m.box(84, 3.55, -103.6, 3.8, 0.25, 0.5, '#d6232a');
  showCar(T, m, 'civ2', 84, -103.6, 0, 1.6, 1, false);
  T.person({ shirt: '#1e2a5a', pants: '#1e2a5a', hat: 'cap', hatColor: '#d6232a', skin: '#c8865a', hair: '#2a1a14', beard: '#2a1a14' }, 85.6, -101.4, -2.3);
  // a wall of tires, a tire balancing machine, stacks on the floor
  for (let j = 0; j < 3; j++) { m.box(G0 + 0.7, 0.07 + j * 1.25, -104, 0.8, 0.08, 10, STEEL); for (let i = 0; i < 13; i++) m.cyl(G0 + 0.7, 0.4 + j * 1.25, -108.6 + i * 0.75, 0.42, 0.32, '#1d1a24', 10, 0, 0.02); }
  for (const z of [-109, -99]) m.box(G0 + 0.7, 0.07, z, 0.1, 3.8, 0.1, STEEL);
  col.box(G0, -109.2, G0 + 1.2, -98.8, { h: 4 });
  for (const [x, z, n] of [[82, -98.6, 4], [83.3, -98.4, 3]]) { for (let k = 0; k < n; k++) m.cyl(x, 0.07 + k * 0.3, z, 0.42, 0.3, '#1d1a24', 10, 0, 0.02); col.circle(x, z, 0.45, { h: n * 0.3 }); }
  // the back wall: red tool chests, a pegboard of tools, a workbench with a vise
  for (let i = 0; i < 3; i++) { const x = 88.5 + i * 1.3; m.box(x, 0.07, GZ0 + 0.6, 1.1, 1.05, 0.6, '#d6232a'); for (let k = 0; k < 5; k++) m.box(x, 0.2 + k * 0.18, GZ0 + 0.91, 1.0, 0.03, 0.02, '#c8ccd8'); m.box(x, 1.12, GZ0 + 0.6, 1.0, 0.45, 0.5, '#b81a1a'); }
  col.box(87.8, GZ0, 92.6, GZ0 + 1, { h: 1.6 });
  m.box(gm, 1.5, GZ0 + 0.16, 5, 1.6, 0.05, '#c8a070');
  for (let i = 0; i < 14; i++) m.box(gm - 2.2 + (i % 7) * 0.7, 1.75 + Math.floor(i / 7) * 0.7, GZ0 + 0.2, 0.07 + (i % 3) * 0.05, 0.45, 0.04, ['#3a3a48', '#d6232a', '#ffd23f', '#3a7bd5'][i % 4]);
  m.box(93.8, 0.07, GZ0 + 0.7, 3.2, 0.9, 0.9, '#5a5a6a'); m.box(93.8, 0.97, GZ0 + 0.7, 3.3, 0.08, 1.0, '#8a5a33'); m.box(92.8, 1.05, GZ0 + 0.7, 0.3, 0.25, 0.25, '#3a7bd5'); col.box(92.1, GZ0, 95.5, GZ0 + 1.3, { h: 1.1 });
  // oil drums, a compressor, a hose reel, a sign that says the most honest thing in the building
  for (const [x, z, c] of [[G1 - 0.7, -104, '#3a7bd5'], [G1 - 0.7, -103, '#d6232a'], [G1 - 1.5, -103.5, '#3a7bd5']]) { m.cyl(x, 0.07, z, 0.36, 1.0, c, 10); m.cyl(x, 0.4, z, 0.37, 0.04, '#2b2b33', 10); col.circle(x, z, 0.38, { h: 1.1 }); }
  m.box(G1 - 0.8, 0.07, -100, 0.9, 0.8, 1.4, '#ff9f1a'); m.cyl(G1 - 0.8, 0.87, -100.3, 0.3, 0.5, '#ff9f1a', 10); col.boxc(G1 - 0.8, -100, 0.9, 1.4, { h: 1.3 });
  m.cyl(G1 - 0.2, 2.2, -98.6, 0.4, 0.15, '#ffd23f', 12);
  T.sign(['ESTIMATES ARE', 'NOT PROMISES'], G1 - 0.15, 3.0, -106.5, -Math.PI / 2, 2.6, 1.0, { bg: '#ffffff', fg: '#2a1640', stripe: '#ffd23f' });
  (T.interiors ||= []).push({ cx: gm, cz: gz, w: G1 - G0, d: GZ1 - GZ0, front: 's', kind: 'garage', info: {}, ih: 4.2 });

  /* ---------- the outdoor lot: the big trucks, doors open so you can see how much fits ---------- */
  for (const [key, style, x, len] of [['van', 'van', 55.5, 5.8], ['cargo', 'cargo', 68, 7.6], ['transporter', 'transporter', 83.5, 13]]) {
    const z = -89.6;
    mn.flat(x - len / 2 - 0.8, z - 2.2, x + len / 2 + 0.8, z + 2.2, 0.09, '#5a5470', 4, 0.02);
    for (const s of [-1, 1]) mn.box(x + s * (len / 2 + 0.8), 0.09, z, 0.15, 0.02, 4.4, '#f6f1e6', 0, 0.01);
    const c = showCar(T, m, style, x, z, Math.PI / 2, 0.09);
    col.boxc(x, z, len, c.S.wid + 0.2, { h: 3 });
    specCard(T, m, key, c, x + len / 2 - 1.2, z + 2.6, 0);
    // a big price balloon on a string over each one
    m.cyl(x, 0.09, z + 2.0, 0.015, 5.2, '#ffffff', 4);
    m.ico(x, 5.9, z + 2.0, 0.9, 1.05, 0.9, ['#d6232a', '#ffd23f', '#3a7bd5'][key.length % 3], 1);
  }
  // bunting on poles along the street side of the lot
  const poles = [49.5, 64, 78, 96, 110.5];
  for (const x of poles) { m.cyl(x, 0, -86.3, 0.08, 5.5, '#c8ccd8', 6); m.ico(x, 5.55, -86.3, 0.18, 0.18, 0.18, '#ffd23f'); col.circle(x, -86.3, 0.12); }
  for (let p = 0; p < poles.length - 1; p++) {
    const a = poles[p], b = poles[p + 1], n = Math.round((b - a) / 0.9);
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = a + (b - a) * t, y = 5.3 - Math.sin(t * Math.PI) * 0.9; m.cone(x, y - 0.45, -86.3, 0.22, 0.45, ['#d6232a', '#ffd23f', '#3a7bd5', '#43e07a'][i % 4], 3, Math.PI); }
  }
  // the inflatable tube man (mid-wave), forever
  {
    const x = 74.5, z = -91.6, TM = '#ff6a3a';
    m.cyl(x, 0, z, 0.45, 0.5, '#2b2b33', 10); col.circle(x, z, 0.45);
    let px = x, py = 0.5, a = 0;
    for (let i = 0; i < 6; i++) { a += [0.15, -0.3, 0.35, -0.2, 0.3, -0.25][i]; m.boxc(px + Math.sin(a) * 0.4, py + 0.4, z, 0.55, 0.85, 0.55, TM, 0, 0, -a); px += Math.sin(a) * 0.8; py += Math.cos(a) * 0.8; }
    m.ico(px, py + 0.3, z, 0.42, 0.42, 0.42, TM, 1);
    for (const s of [-1, 1]) m.boxc(px + s * 0.5, py - 0.6 + s * 0.4, z, 1.4, 0.22, 0.22, TM, 0, 0, s * 0.8);
    for (const s of [-1, 1]) m.box(px + s * 0.13, py + 0.38, z + 0.38, 0.12, 0.14, 0.04, '#ffffff');
  }
  // the pylon sign at the corner, visible from Garlic Way
  m.box(50.5, 0, -87.5, 0.6, 8.5, 0.6, STEEL); col.circle(50.5, -87.5, 0.45);
  m.box(50.5, 6.2, -87.5, 0.5, 3.0, 4.6, '#d6232a');
  for (const s of [-1, 1]) T.sign(["HANK'S", 'MOTORS', '- HONEST -'], 50.5 + s * 0.27, 7.7, -87.5, s * Math.PI / 2, 4.4, 2.8, { bg: '#d6232a', fg: '#ffffff', borderColor: '#ffd23f' });

  /* ---------- the pick-up bay: your new vehicle waits here ---------- */
  const spots = [100.5, 104.5, 108.5];
  mn.flat(98.4, -110.5, 110.8, -92.5, 0.075, '#5f5878', 4, 0.02);
  for (const x of [98.5, 102.5, 106.5, 110.5]) mn.box(x, 0.08, -101.5, 0.15, 0.02, 17.5, '#f6f1e6', 0, 0.01);
  for (const x of spots) mn.box(x, 0.08, -94.3, 2.6, 0.02, 0.5, '#ffd23f', 0, 0.01);
  m.cyl(98, 0, -93.3, 0.08, 3.2, '#c8ccd8', 6); col.circle(98, -93.3, 0.12);
  T.sign(['NEW OWNER', 'PICK-UP'], 98, 2.8, -93.25, 0, 2.2, 0.9, { bg: '#43a85a', fg: '#ffffff' });
  T.poi.dealerLot = { spots: spots.map(x => ({ x, z: -101.5 })), yaw: 0 };
  T.poi.dealer = { x: DX, z: Z1 + 2 };
  T.biz.hank = { x: DX, z: Z1 + 1.4, ry: 0, info: {} };
}

/* ======================================================================
   STOREFRONTS: dress the outside of a bldg() box by store
   ====================================================================== */
/** a local frame on the front of a building: u along the front, v out from it */
function front(T, cx, cz, w, d, f) {
  const [fx, fz] = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[f];
  const ax = -fz, az = fx, ns = fz !== 0, hd = (fx ? w : d) / 2, fw = fx ? d : w;
  const P = (u, v) => ({ x: cx + fx * (hd + v) + ax * u, z: cz + fz * (hd + v) + az * u });
  const ry = { n: Math.PI, s: 0, e: Math.PI / 2, w: -Math.PI / 2 }[f];
  const m = T.m(cx, cz), mn = T.mn(cx, cz), mc = T.mc(cx, cz);
  const box = (mm, u, v, y, lu, h, lv, c, j) => { const p = P(u, v); mm.box(p.x, y, p.z, ns ? lu : lv, h, ns ? lv : lu, c, 0, j); };
  const solid = (u, v, lu, lv, h = 1.2) => { const p = P(u, v); T.col.boxc(p.x, p.z, ns ? lu : lv, ns ? lv : lu, { h }); };
  const sign = (lines, u, v, y, w2, h2, o) => { const p = P(u, v); return T.sign(lines, p.x, y, p.z, ry, w2, h2, o); };
  return { T, P, ry, m, mn, mc, box, solid, sign, fw, fx, fz, ns };
}

/** big shop windows either side of the door: a lit display case behind real glass, with the goods inside */
function shopWindows(F, h, frame, glow = '#ffe9a8', kind = 'general', y0 = 0.6, depth = 0.8) {
  const { box, m, fw } = F, T = F.T, gm = new Mesher(0);
  const H = Math.min(2.6, h - 1.4), V = depth;
  const pick = (a, i) => a[i % a.length];
  for (const s of [-1, 1]) {
    const u = s * (1.6 + (fw / 2 - 2.4) / 2), lu = fw / 2 - 2.6;
    if (lu < 1.5) continue;
    box(m, u, V / 2, 0, lu + 0.3, y0, V + 0.1, frame);                       // the base
    box(F.mc, u, 0.04, y0, lu, H, 0.06, glow, 0.02);                          // the lit back
    box(m, u, V / 2, y0 + H, lu + 0.3, 0.18, V + 0.1, frame);                 // the top
    for (const k of [-1, 1]) box(m, u + k * (lu / 2 + 0.06), V / 2, y0, 0.12, H, V + 0.1, frame);
    const n = Math.round(lu / 2);
    for (let k = 1; k < n; k++) box(m, u - lu / 2 + k * lu / n, V, y0, 0.08, H, 0.08, frame);
    { const p = F.P(u, V); gm.box(p.x, y0, p.z, F.ns ? lu : 0.04, H, F.ns ? 0.04 : lu, '#cfeaff'); }
    F.solid(u, V / 2, lu + 0.3, V + 0.1, 2.5);
    // what's on display
    if (kind === 'grocery') {
      for (let r = 0; r < 3; r++) {
        const y = y0 + 0.1 + r * H / 3;
        box(m, u, 0.3, y, lu - 0.2, 0.05, 0.4, '#e8e2d2');
        for (let i = 0; i < Math.floor((lu - 0.4) / 0.32); i++) box(m, u - lu / 2 + 0.35 + i * 0.32, 0.3, y + 0.05, 0.24, 0.26 + (i % 3) * 0.06, 0.24, pick(['#d6232a', '#ffd23f', '#43a85a', '#ff8fc8', '#3a7bd5', '#f6f1e6'], i + r + s));
      }
    } else if (kind === 'furniture') {
      box(m, u, 0.4, y0, lu - 0.1, 0.02, V - 0.1, s < 0 ? '#c84a5a' : '#3a7bd5');                                // a rug
      box(m, u - 0.5, 0.42, y0, 1.1, 0.42, 0.6, s < 0 ? '#5a2a3a' : '#2a4a6a'); box(m, u - 0.5, 0.18, y0 + 0.42, 1.1, 0.5, 0.15, s < 0 ? '#5a2a3a' : '#2a4a6a'); // an armchair
      for (const k of [-1, 1]) box(m, u - 0.5 + k * 0.5, 0.42, y0 + 0.42, 0.12, 0.22, 0.6, s < 0 ? '#5a2a3a' : '#2a4a6a');
      { const p = F.P(u + 0.8, 0.4); m.cyl(p.x, y0, p.z, 0.15, 0.04, '#c8a03a', 8); m.cyl(p.x, y0, p.z, 0.025, 1.4, '#c8a03a', 5); m.cone(p.x, y0 + 1.3, p.z, 0.28, 0.35, '#fff1b8', 8); }
      { const p = F.P(u + 0.2, 0.35); m.cyl(p.x, y0, p.z, 0.2, 0.35, '#f6f1e6', 8); m.ico(p.x, y0 + 0.7, p.z, 0.45, 0.6, 0.45, '#4fa64f', 1); }
      box(m, u, 0.08, y0 + 1.2, 0.9, 0.7, 0.04, '#5a3a22'); box(m, u, 0.1, y0 + 1.27, 0.76, 0.56, 0.02, s < 0 ? '#ffd23f' : '#ff8fc8');   // a picture
    } else {
      for (let i = 0; i < Math.floor(lu / 0.55); i++) {
        const uu = u - lu / 2 + 0.35 + i * 0.55, hh = 0.25 + (i % 4) * 0.12;
        box(m, uu, 0.35, y0, 0.4, hh, 0.4, pick(['#ffd23f', '#ff8fc8', '#43e07a', '#3a7bd5', '#ff9f1a'], i + s));
        if (i % 2) { const p = F.P(uu, 0.35); m.ico(p.x, y0 + hh + 0.15, p.z, 0.2, 0.2, 0.2, pick(['#d6232a', '#8a4ac8', '#ffffff'], i)); }
      }
    }
  }
  T.root.add(gm.build({ material: GLASS(), cast: false, receive: false }));
}
const cart = (F, u, v, ang = 0) => {
  const p = F.P(u, v), m = F.m, c = Math.cos(F.ry + ang), s = Math.sin(F.ry + ang);
  m.box(p.x, 0.35, p.z, 0.6, 0.45, 0.85, '#c8ccd8', F.ry + ang); m.box(p.x, 0.25, p.z, 0.5, 0.04, 0.75, '#8a8a98', F.ry + ang);
  m.box(p.x - s * 0.45, 0.7, p.z - c * 0.45, 0.6, 0.06, 0.06, '#d6232a', F.ry + ang);
  for (const [a, b] of [[-0.25, -0.35], [0.25, -0.35], [-0.25, 0.35], [0.25, 0.35]]) m.cyl(p.x + c * a + s * b, 0.04, p.z - s * a + c * b, 0.06, 0.08, '#2b2b33', 6);
};
const pallet = (m, x, z, ry = 0, load) => {
  m.box(x, 0.06, z, 1.2, 0.14, 1.0, '#b8894c', ry);
  if (load === 'boxes') for (let i = 0; i < 4; i++) m.box(x + (i % 2 - 0.5) * 0.55, 0.2 + Math.floor(i / 2) * 0.45, z, 0.52, 0.44, 0.9, i % 3 ? '#c79a5b' : '#a87c44', ry);
  if (load === 'sacks') for (let i = 0; i < 5; i++) m.ico(x + (i % 3 - 1) * 0.38, 0.38 + Math.floor(i / 3) * 0.3, z, 0.42, 0.25, 0.8, '#e8dcc0', 1);
};

export function forklift(T, x, z, ry = 0) {
  const m = T.m(x, z), c = Math.cos(ry), s = Math.sin(ry);
  const at = (a, b) => [x + c * a + s * b, z - s * a + c * b];
  const [bx, bz] = at(0, -0.2);
  m.box(bx, 0.3, bz, 1.2, 0.8, 2.0, '#ffb81a', ry);
  const [cwx, cwz] = at(0, -0.9);
  m.box(cwx, 0.3, cwz, 1.2, 0.9, 0.5, '#3a3a48', ry);   // the counterweight
  m.box(bx, 1.1, bz, 0.5, 0.35, 0.5, '#1b1b24', ry);
  for (const [a, b] of [[-0.5, 0.4], [0.5, 0.4], [-0.5, -0.4], [0.5, -0.4]]) { const [px, pz] = at(a, b - 0.2); m.box(px, 1.1, pz, 0.07, 1.2, 0.07, '#1b1b24', ry); }
  m.box(bx, 2.25, bz, 1.2, 0.08, 1.0, '#1b1b24', ry);
  for (const a of [-0.45, 0.45]) { const [px, pz] = at(a, 0.85); m.box(px, 0.1, pz, 0.08, 2.6, 0.12, '#3a3a48', ry); }
  for (const a of [-0.3, 0.3]) { const [px, pz] = at(a, 1.4); m.box(px, 0.15, pz, 0.14, 0.06, 1.1, '#3a3a48', ry); }
  for (const [a, b] of [[-0.62, 0.45], [0.62, 0.45], [-0.62, -0.75], [0.62, -0.75]]) { const [px, pz] = at(a, b); m.cyl(px, 0, pz, 0.3, 0.6, '#1d1a24', 10, ry + Math.PI / 2); }
  T.col.boxc(x + s * 0.2, z + c * 0.2, Math.abs(c) > 0.5 ? 1.4 : 3.0, Math.abs(c) > 0.5 ? 3.0 : 1.4, { h: 2.4 });
}

/** CRUMB GROCERY: a glass front under a long green canopy, produce stands, a cart corral, letters on the roof */
export function groceryFront(T, b) {
  const F = front(T, b.cx, b.cz, b.w, b.d, b.front), { box, m, mn, fw, solid, sign } = F;
  shopWindows(F, b.h, '#2f6a3a', '#fff6d0', 'grocery');
  // the long canopy along the whole front, on posts
  box(m, 0, 2.2, 3.3, fw + 0.4, 0.22, 4.4, '#3fa34d');
  box(m, 0, 4.35, 3.15, fw + 0.4, 0.2, 0.08, '#ffffff');
  for (let k = 0; k < 8; k++) box(m, -fw / 2 + 0.2 + (k + 0.5) * fw / 8, 4.4, 3.0, fw / 8 - 0.05, 0.15, 0.04, k % 2 ? '#3fa34d' : '#ffffff');
  for (const u of [-fw / 2 + 0.5, -fw / 6, fw / 6, fw / 2 - 0.5]) { box(m, u, 4.2, 0, 0.18, 3.3, 0.18, '#2f6a3a'); solid(u, 4.2, 0.2, 0.2, 3); }
  // produce stands: slanted crates of tomatoes, peppers, lettuce, lemons
  const PRO = [['#d6232a', 'TOMATOES $2'], ['#43a85a', 'BASIL $1'], ['#ffd23f', 'LEMONS $3'], ['#ff6a3a', 'PEPPERS $2']];
  PRO.forEach(([c, label], i) => {
    const u = (i < 2 ? -1 : 1) * (3.2 + (i % 2) * 2.4);
    box(m, u, 1.8, 0, 2.0, 0.7, 1.0, '#a87c44'); solid(u, 1.8, 2.0, 1.0, 1);
    for (const k of [-1, 1]) box(m, u + k * 0.95, 1.8, 0, 0.1, 1.4, 1.0, '#8a6234');
    for (let k = 0; k < 10; k++) { const p = F.P(u - 0.8 + (k % 5) * 0.4, 1.6 + Math.floor(k / 5) * 0.4); m.ico(p.x, 0.82 + Math.floor(k / 5) * 0.1, p.z, 0.3, 0.26, 0.3, c, 0, k); }
    box(m, u, 1.3, 1.4, 2.0, 0.04, 0.04, '#8a6234');
    sign([label], u, 2.32, 1.15, 1.5, 0.35, { bg: '#2a2a30', fg: '#ffffff', border: false, font: '"Comic Sans MS", cursive' });
  });
  // the cart corral
  for (let k = 0; k < 4; k++) cart(F, fw / 2 - 1.6, 2.6 + k * 0.45 - 0.7);
  box(m, fw / 2 - 1.6, 2.6, 0, 0.06, 0.9, 2.4, '#c8ccd8'); box(m, fw / 2 - 0.9, 2.6, 0, 0.06, 0.9, 2.4, '#c8ccd8');
  solid(fw / 2 - 1.25, 2.6, 0.9, 2.4, 1);
  sign(['CARTS'], fw / 2 - 1.25, 1.35, 1.3, 1.0, 0.3, { bg: '#3fa34d', fg: '#ffffff', border: false });
  // a chalkboard of specials, ice and a firewood box
  box(m, -fw / 2 + 1.0, 1.9, 0, 0.8, 1.0, 0.6, '#9fd8ff'); solid(-fw / 2 + 1.0, 1.9, 0.8, 0.6, 1);
  sign(['ICE'], -fw / 2 + 1.0, 2.22, 0.65, 0.6, 0.3, { bg: '#ffffff', fg: '#3a7bd5', border: false });
  // a chalkboard on an easel
  for (const k of [-0.6, 0.6]) box(m, -fw / 2 + 2.6 + k, 1.75, 0, 0.06, 1.6, 0.06, '#8a6234');
  box(m, -fw / 2 + 2.6, 1.72, 0.55, 1.6, 1.1, 0.04, '#8a6234');
  sign(['TODAY:', 'FLOUR (for bread)', 'CHEESE (for bread)', 'TOMATOES (for... salad)'], -fw / 2 + 2.6, 1.75, 1.1, 1.5, 1.0, { bg: '#2a2a30', fg: '#ffffff', border: false, font: '"Comic Sans MS", cursive' });
  solid(-fw / 2 + 2.6, 1.72, 1.4, 0.3, 1.6);
  // big letters on the roof
  const p = F.P(0, -1.2);
  m.box(p.x, b.h + 0.4, p.z, F.ns ? 12 : 0.3, 0.3, F.ns ? 0.3 : 12, STEEL);
  for (const s of [-4, 4]) { const q = F.P(s, -1.4); m.box(q.x, b.h + 0.4, q.z, 0.12, 2.2, 0.12, STEEL); }
  T.sign(['CRUMB GROCERY'], p.x + (F.fx || 0) * 0.1, b.h + 1.6, p.z + (F.fz || 0) * 0.1, F.ry, 12, 1.8, { bg: '#3fa34d', fg: '#ffffff', borderColor: '#ffd23f' });
  return F;
}
/** the loading dock round the side: a dock door, bumpers, a box truck backed up, pallets of flour */
export function loadingDock(T, x, z, ry) {
  const m = T.m(x, z), c = Math.cos(ry), s = Math.sin(ry);
  m.box(x, 0, z, 3.4, 1.0, 0.4, '#8a84a0', ry);
  m.box(x - s * 0.05, 1.0, z - c * 0.05, 3.2, 3.0, 0.1, '#c0c6d2', ry);
  for (let i = 0; i < 8; i++) m.box(x + s * 0.02, 1.05 + i * 0.37, z + c * 0.02, 3.1, 0.03, 0.12, '#a4aab8', ry);
  for (const k of [-1.3, 1.3]) m.box(x + c * k + s * 0.25, 0.6, z - s * k + c * 0.25, 0.3, 0.35, 0.2, '#1b1b24', ry);
  T.sign(['DELIVERIES'], x + s * 0.2, 4.4, z + c * 0.2, ry, 2.4, 0.5, { bg: '#ffd23f', fg: '#1b1b24', border: false });
  for (let i = 0; i < 6; i++) m.boxc(x + c * (-1.6 + i * 0.64) + s * 1.5, 0.03, z - s * (-1.6 + i * 0.64) + c * 1.5, 0.3, 0.02, 2.0, i % 2 ? '#ffd23f' : '#1b1b24', ry);
  pallet(m, x + c * 2.8 + s * 1.2, z - s * 2.8 + c * 1.2, ry, 'sacks'); T.col.circle(x + c * 2.8 + s * 1.2, z - s * 2.8 + c * 1.2, 0.7, { h: 1 });
  pallet(m, x + c * 2.8 + s * 2.6, z - s * 2.8 + c * 2.6, ry + 0.2, 'boxes'); T.col.circle(x + c * 2.8 + s * 2.6, z - s * 2.8 + c * 2.6, 0.7, { h: 1 });
}

/** EQUIP-O-RAMA: an industrial shed. Corrugated cladding, a roll-up door, hazard stripes, a forklift, pallets */
export function equipmentFront(T, b) {
  const F = front(T, b.cx, b.cz, b.w, b.d, b.front), { box, m, fw, solid, sign } = F;
  // corrugated ribs over the whole front
  for (let u = -fw / 2 + 0.3; u < fw / 2; u += 0.55) { if (Math.abs(u) < 1.3) continue; box(m, u, 0.02, 0, 0.12, b.h, 0.08, '#e88a2a', 0.02); }
  box(m, 0, 0.02, b.h - 0.5, fw + 0.2, 0.5, 0.16, '#3a3a48');
  for (let k = 0; k < Math.floor(fw / 0.8); k++) { const p = F.P(-fw / 2 + 0.4 + k * 0.8, 0.12); m.boxc(p.x, 0.25, p.z, F.ns ? 0.4 : 0.04, 0.5, F.ns ? 0.04 : 0.4, k % 2 ? '#1b1b24' : '#ffd23f', 0, F.ns ? 0 : 0.5, F.ns ? 0.5 : 0); }
  // a big roll-up loading door (closed), and a steel canopy over the entrance
  const du = fw / 2 - 3.2;
  box(m, du, 0.05, 0, 4.2, 3.8, 0.1, '#5a5a6a');
  for (let i = 0; i < 10; i++) box(m, du, 0.1, 0.1 + i * 0.37, 4.0, 0.33, 0.06, i % 2 ? '#c0c6d2' : '#a4aab8');
  sign(['LOADING', 'BAY 1'], du, 0.15, 4.45, 1.8, 0.6, { bg: '#ffd23f', fg: '#1b1b24', border: false });
  box(m, 0, 1.2, 3.0, 4.2, 0.15, 2.4, '#3a3a48');
  for (const s of [-1, 1]) { box(m, s * 1.9, 2.3, 0, 0.14, 3.0, 0.14, '#3a3a48'); solid(s * 1.9, 2.3, 0.2, 0.2, 3); }
  // pallets, a forklift, a stack of crates with OVEN written on them
  const p1 = F.P(-fw / 2 + 2.0, 2.4); pallet(m, p1.x, p1.z, F.ry, 'boxes'); T.col.circle(p1.x, p1.z, 0.7, { h: 1 });
  const p2 = F.P(-fw / 2 + 3.6, 2.6); pallet(m, p2.x, p2.z, F.ry + 0.15, 'boxes'); T.col.circle(p2.x, p2.z, 0.7, { h: 1 });
  const fp = F.P(du, 4.5); forklift(T, fp.x, fp.z, F.ry + Math.PI);
  sign(['PROFESSIONAL', 'KITCHEN EQUIPMENT', '(for bread)'], -fw / 2 + 2.8, 0.2, 2.2, 2.6, 1.2, { bg: '#1b1b24', fg: '#ff9f1a', borderColor: '#ff9f1a' });
  // a rooftop sign box, lit
  const p = F.P(0, -1.0);
  T.sign(['EQUIP-O-RAMA'], p.x + (F.fx || 0) * 0.15, b.h + 1.3, p.z + (F.fz || 0) * 0.15, F.ry, 9, 1.5, { bg: '#1b1b24', fg: '#ff9f1a', borderColor: '#ff9f1a' });
  m.box(p.x, b.h + 0.3, p.z, F.ns ? 9.2 : 0.3, 1.8, F.ns ? 0.3 : 9.2, '#3a3a48');
  return F;
}

/** CASA CRUMB FURNITURE: wood slats, tall display windows with a little room set behind each, planters */
export function furnitureFront(T, b) {
  const F = front(T, b.cx, b.cz, b.w, b.d, b.front), { box, m, fw, solid, sign } = F;
  for (let u = -fw / 2 + 0.25; u < fw / 2; u += 0.4) { if (Math.abs(u) < 1.4) continue; box(m, u, 0.03, 3.4, 0.22, b.h - 3.4, 0.06, '#a8743a', 0.02); }
  box(m, 0, 0.02, 0, fw + 0.1, 0.35, 0.14, '#2a2238');
  shopWindows(F, 4.0, '#2a2238', '#fff1d0', 'furniture', 0.35, 1.1);
  for (const s of [-1, 1]) {
    const u = s * (1.6 + (fw / 2 - 2.4) / 2), lu = fw / 2 - 2.8;
    // planters
    box(m, u, 1.75, 0, lu, 0.55, 0.8, '#3a3048'); solid(u, 1.75, lu, 0.8, 0.6);
    for (let k = 0; k < 5; k++) { const p = F.P(u - lu / 2 + 0.4 + k * (lu - 0.8) / 4, 1.75); m.ico(p.x, 0.75, p.z, 0.55, 0.5, 0.55, k % 2 ? '#4fa64f' : '#3f8a4a', 0, k); }
  }
  // a modern flat canopy and a sign in a nice font
  box(m, 0, 0.0, 3.4, 4.0, 0.12, 1.8, '#2a2238');
  sign(['Casa Crumb', 'FURNITURE · DECOR · VIBES'], 0, 0.2, b.h - 1.4, Math.min(9, fw - 2), 1.6, { bg: '#2a2238', fg: '#ffe9c8', border: false, font: 'Georgia, serif' });
  sign(['NEW: THE JUKEBOX'], -fw / 4 - 0.6, 0.12, 2.8, 2.0, 0.4, { bg: '#ff8fc8', fg: '#2a1640', border: false });
  return F;
}

/** any other shop in town: display cases with goods, a hanging blade sign, lamps by the door, a doormat */
export const SHOPLIKE = new Set(['appliance', 'mustache', 'shoes', 'laundry', 'tattoo', 'store', 'gasshop', 'bakery']);
export function shopDress(T, b, o) {
  const F = front(T, b.cx, b.cz, b.w, b.d, b.front), { box, m, fw, sign } = F;
  const trim = o.awning || '#3a3048';
  shopWindows(F, 3.6, trim, '#fff1c8', o.kind === 'appliance' ? 'grocery' : 'general', 0.5, 0.7);
  // the blade sign, sticking out over the sidewalk on an iron bracket
  const bu = fw / 2 - 0.5;
  box(m, bu, 0.6, 3.9, 0.06, 0.06, 1.2, '#2b2b33');
  box(m, bu, 0.3, 3.45, 0.04, 0.5, 0.04, '#2b2b33');
  const p = F.P(bu, 0.75), side = F.ry + Math.PI / 2;
  for (const k of [0, Math.PI]) T.sign([o.sign[0]], p.x + Math.sin(side + k) * 0.03, 3.35, p.z + Math.cos(side + k) * 0.03, side + k, 1.25, 0.75, { bg: o.signBg || '#fff6e0', fg: o.signFg || '#2a1640', borderColor: trim });
  // lamps either side of the door, a doormat
  for (const k of [-1, 1]) { box(m, k * 1.35, 0.06, 2.3, 0.14, 0.25, 0.12, '#2b2b33'); box(F.mc, k * 1.35, 0.14, 2.35, 0.12, 0.2, 0.1, '#fff1b8'); }
  box(F.mn, 0, 0.6, 0.065, 1.6, 0.03, 0.9, trim, 0.01);
}

/** a neon sign: dark board, glowing letters (the text is its own light) */
export function neonSign(T, lines, x, y, z, ry, w, h, color) {
  const s = T.sign(lines, x, y, z, ry, w, h, { bg: '#120c18', fg: color, borderColor: color, font: '"Luckiest Guy", Impact, sans-serif' });
  s.material = s.material.clone(); s.material.emissive = new THREE.Color('#ffffff'); s.material.emissiveMap = s.material.map; s.material.emissiveIntensity = 0.9;
  return s;
}

/** THE UNDERGROUND MARKET, polished: a runner rug down the aisle, brass on every table, string lights,
    a chandelier, neon on the walls, paintings in gold frames, velvet ropes by the Broker */
export function polishMarket(T, X, Z, W, D, H) {
  const m = new Mesher(0.03), glow = new Mesher(0);
  const X0 = X - W / 2, X1 = X + W / 2, Z0 = Z - D / 2, Z1 = Z + D / 2;
  // the runner: deep red, a gold border, navy diamonds
  m.box(X, 0.06, Z, W - 6, 0.02, 3.0, '#6a1424');
  for (const s of [-1, 1]) m.box(X, 0.065, Z + s * 1.35, W - 6.2, 0.02, 0.14, '#c8a03a');
  for (const s of [-1, 1]) m.box(X + s * (W / 2 - 3.1), 0.065, Z, 0.14, 0.02, 2.84, '#c8a03a');
  for (let x = X0 + 4.5; x < X1 - 4; x += 2.2) { m.box(x, 0.07, Z, 0.75, 0.02, 0.75, '#1e2a5a', Math.PI / 4); m.box(x, 0.072, Z, 0.3, 0.02, 0.3, '#c8a03a', Math.PI / 4); }
  // brass trim on the twelve tables
  for (const t of T.poi.marketTables || []) {
    for (const s of [-1, 1]) m.box(t.x, 0.86, t.z + s * 0.56, 1.84, 0.04, 0.04, '#e8b83a');
    for (const a of [-1, 1]) for (const b of [-1, 1]) m.cyl(t.x + a * 0.88, 0, t.z + b * 0.52, 0.05, 0.9, '#c8a03a', 6);
  }
  // string lights: five strands across the room, warm bulbs that glow
  const bulbs = [];
  for (let k = 0; k < 5; k++) {
    const za = Z0 + 2 + k * (D - 4) / 4, zb = Z0 + 2 + ((k + 2) % 5) * (D - 4) / 4;
    const n = 26;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = X0 + 0.5 + (W - 1) * t, z = za + (zb - za) * t, y = H - 0.5 - Math.sin(t * Math.PI) * 0.8;
      if (i < n) { const t2 = (i + 1) / n, x2 = X0 + 0.5 + (W - 1) * t2, z2 = za + (zb - za) * t2, y2 = H - 0.5 - Math.sin(t2 * Math.PI) * 0.8; m.boxc((x + x2) / 2, (y + y2) / 2, (z + z2) / 2, Math.hypot(x2 - x, z2 - z) + 0.02, 0.02, 0.02, '#1b1b24', Math.atan2(x2 - x, z2 - z) + Math.PI / 2); }
      if (i % 2 === 0) bulbs.push([x, y - 0.1, z, ['#ffd890', '#ff9ac8', '#9ae0ff', '#c8ff9a'][(i / 2 + k) % 4]]);
    }
  }
  for (const [x, y, z, c] of bulbs) glow.ico(x, y, z, 0.13, 0.15, 0.13, c);
  // the chandelier over the middle of the aisle
  const cx = X, cz = Z, cy = H - 1.2;
  m.cyl(cx, cy + 0.3, cz, 0.03, H - cy - 0.3, '#c8a03a', 5);
  m.cyl(cx, cy, cz, 1.1, 0.08, '#e8b83a', 16); m.cyl(cx, cy - 0.3, cz, 0.6, 0.08, '#e8b83a', 12);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; glow.ico(cx + Math.sin(a) * 1.05, cy + 0.15, cz + Math.cos(a) * 1.05, 0.1, 0.16, 0.1, '#fff1c8'); m.ico(cx + Math.sin(a) * 0.95, cy - 0.15, cz + Math.cos(a) * 0.95, 0.07, 0.22, 0.07, '#cfefff'); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; glow.ico(cx + Math.sin(a) * 0.55, cy - 0.15, cz + Math.cos(a) * 0.55, 0.09, 0.14, 0.09, '#fff1c8'); }
  m.ico(cx, cy - 0.6, cz, 0.18, 0.35, 0.18, '#cfefff');
  // neon on the walls
  neonSign(T, ['CASH ONLY'], X1 - 9, 3.2, Z1 - 0.08, Math.PI, 3.2, 0.8, '#43e07a');
  neonSign(T, ['PIZZA?', 'NEVER HEARD OF IT'], X0 + 0.08, 3.4, Z + 6, Math.PI / 2, 3.0, 1.0, '#ff5aa8');
  neonSign(T, ['WE NEVER MET'], X - 6, 3.2, Z1 - 0.08, Math.PI, 3.0, 0.7, '#5ad8ff');
  // paintings in gold frames on the south wall
  for (const [x, lines, bg] of [[X0 + 5, ['MONA PIZZA'], '#3a5a3a'], [X0 + 9, ['THE LAST', 'SLICE'], '#4a2a3a']]) {
    m.box(x, 1.9, Z1 - 0.1, 2.1, 1.5, 0.08, '#c8a03a');
    T.sign(lines, x, 2.65, Z1 - 0.16, Math.PI, 1.8, 1.2, { bg, fg: '#ffd890', border: false, font: 'Georgia, serif' });
  }
  // velvet ropes either side of the Broker's counter
  const bx = X - 2, bz = Z0 + 3.4;
  for (const [a, b] of [[bx - 5.2, bx - 3.8], [bx + 3.8, bx + 5.2]]) {
    for (const x of [a, b]) { m.cyl(x, 0, bz + 1.6, 0.18, 0.05, '#c8a03a', 10); m.cyl(x, 0.05, bz + 1.6, 0.04, 0.9, '#e8b83a', 6); m.ico(x, 0.98, bz + 1.6, 0.07, 0.07, 0.07, '#e8b83a'); }
    for (let i = 0; i < 6; i++) { const t = (i + 0.5) / 6, y = 0.85 - Math.sin(t * Math.PI) * 0.18; m.box(a + (b - a) * t, y, bz + 1.6, (b - a) / 6 + 0.02, 0.05, 0.05, '#a81a2a'); }
  }
  T.root.add(m.build({ cast: false }));
  T.root.add(glow.build({ cast: false, material: vcGlowMat() }));
}

/** the GENERAL STORE: a striped awning, bargain bins, a gumball machine */
export function generalFront(T, b) {
  const F = front(T, b.cx, b.cz, b.w, b.d, b.front), { box, m, fw, solid, sign } = F;
  shopWindows(F, 3.6, '#5a3a7a', '#ffe9a8', 'general', 0.5, 0.7);
  for (const s of [-1, 1]) {
    const u = s * (fw / 2 - 2.2);
    box(m, u, 1.6, 0, 1.8, 0.75, 0.9, '#8a4ac8'); solid(u, 1.6, 1.8, 0.9, 0.9);
    for (let k = 0; k < 8; k++) { const p = F.P(u - 0.65 + (k % 4) * 0.43, 1.4 + Math.floor(k / 4) * 0.4); m.box(p.x, 0.75, p.z, 0.3, 0.2 + (k % 3) * 0.08, 0.25, ['#ffd23f', '#ff8fc8', '#43e07a', '#3a7bd5'][k % 4], k); }
    sign([s < 0 ? 'BARGAINS!' : 'EVERYTHING $1*'], u, 2.08, 0.95, 1.6, 0.35, { bg: '#ffd23f', fg: '#2a1640', border: false });
  }
  const g = F.P(2.2, 1.4);
  m.cyl(g.x, 0, g.z, 0.12, 0.8, '#d6232a', 8); m.ico(g.x, 1.1, g.z, 0.55, 0.55, 0.55, '#bfe4ff', 1); m.cyl(g.x, 0.75, g.z, 0.25, 0.12, '#d6232a', 10);
  for (let k = 0; k < 9; k++) m.ico(g.x + Math.sin(k * 2.1) * 0.13, 0.98 + (k % 3) * 0.08, g.z + Math.cos(k * 2.1) * 0.13, 0.08, 0.08, 0.08, ['#ff6a3a', '#ffd23f', '#43e07a', '#ff8fc8'][k % 4]);
  T.col.circle(g.x, g.z, 0.3, { h: 1.4 });
  sign(['*not everything'], fw / 2 - 2.2, 2.08, 1.1, 1.0, 0.2, { bg: '#ffffff', fg: '#2a1640', border: false });
  return F;
}
