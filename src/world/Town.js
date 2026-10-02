/* Town.js - the whole town of Crumbville, generated in code.

   A grid of four streets each way (every street named after a pizza
   topping, from before the ban), with the town square in the middle, City
   Hall to the north of it, the hospital west, the police east, abandoned
   pizzerias south, houses all round, industry in the east, a forest along
   the north edge and mountains past that.

   Coordinates: x east, z south, y up. Roads run at +-40 and +-120. */
import * as THREE from '../../lib/three.module.js';
import { Mesher, signMesh, textTexture, vcMat, geo, part, mat } from '../art/Mesher.js';
import { makeChar } from '../art/Chars.js';
import { makeCar, makeDumpster } from '../art/Props.js';
import { Colliders } from './Colliders.js';
import { seeded } from '../core/Util.js';

export const ROADS = [-120, -40, 40, 120];
export const RW = 12;            // road width
export const EXT = 205;          // roads run from -EXT to EXT
export const STREET_EW = { '-120': 'Pepper Road', '-40': 'Basil Street', '40': 'Oregano Avenue', '120': 'Mozzarella Boulevard' };
export const STREET_NS = { '-120': 'Crust Lane', '-40': 'Dough Street', '40': 'Garlic Way', '120': 'Anchovy Road' };

// the hideout: an old shoe repair shop on Anchovy Road
export const HQ = {
  x0: 140, x1: 164, z0: 72, z1: 88, split: 152, door: { x: 138.6, z: 80 },
  base: { x0: 136, x1: 168, z0: 62, z1: 98, y: -6 },
  garage: { x: 133, z: 96 },
};
export const HOSPITAL_SET = { x: 600, z: 0 };

const C = {
  grass: '#9ad08a', grass2: '#8cc77e', forest: '#6fae6a', park: '#a6dc92',
  road: '#5b4f7a', line: '#ffd65a', walk: '#d9cdee', curb: '#b7a8d6', plaza: '#efb8d6', plaza2: '#e6a8cc',
  brick: '#7d6aa8', brickDark: '#6a5794', win: '#2f3a63', winLit: '#ffe9a8', door: '#5a3a2a', trim: '#f6f1e6',
};
const WALL_COLORS = ['#f7a8c8', '#8fc1e3', '#f7d26b', '#a8e0c0', '#c9a8f0', '#ffb88a', '#9fd8e8', '#f2e6c8', '#e8a0a0'];
const ROOF_COLORS = ['#c84a5a', '#5a6ac8', '#4a8a6a', '#8a4ac8', '#c87a3a', '#3a3a5a'];

export class Town {
  constructor(scene) {
    this.scene = scene;
    this.col = new Colliders();
    this.chunks = new Map();
    this.root = new THREE.Group(); scene.add(this.root);
    this.dyn = new THREE.Group(); scene.add(this.dyn);
    this.houses = [];
    this.poi = {};
    this.lamps = [];
    this.hideWalls = [];  // hideout walls that cut away when the camera is outside them
    this.rand = seeded(1337);
    this.statics = [];   // [{group, x, z}] characters placed as scenery
  }

  m(x, z) { // the Mesher for the chunk containing (x,z)
    const k = Math.floor((x + 280) / 140) + ',' + Math.floor((z + 280) / 140);
    let c = this.chunks.get(k); if (!c) this.chunks.set(k, c = new Mesher()); return c;
  }

  build() {
    this.ground();
    this.roads();
    this.townSquare(0, 0);
    this.cityHall(0, -80);
    this.hospital(-80, 0);
    this.police(80, 0);
    this.gasStation(80, -80);
    this.shops(-80, -80);
    this.pizzerias(0, 80);
    for (const [bx, bz] of [[-80, 80], [80, 80], [-160, 0], [-160, 80], [-80, 160], [80, 160], [-160, 160]]) this.residential(bx, bz);
    this.mansion(-160, -80);
    this.industry();
    this.hideout();
    this.junkyard(160, 160);
    this.park(0, 160);
    this.forest();
    this.mountains();
    this.lampsAndProps();
    this.streetLife();
    this.hospitalRoom();
    for (const [, me] of this.chunks) this.root.add(me.build());
    // the edge of the world: invisible walls
    for (const s of [-1, 1]) { this.col.box(-230, s * 228, 230, s * 232, { h: 50 }); this.col.box(s * 228, -230, s * 232, 230, { h: 50 }); }
  }

  /* ---------------- ground and roads ---------------- */
  ground() {
    // big faceted grass sheet, with forest and park tints
    for (let x = -280; x < 280; x += 40) for (let z = -280; z < 280; z += 40) {
      const forest = z < -130 || Math.abs(x) > 205 || z > 205;
      const m = this.m(x + 20, z + 20);
      m.flat(x, z, x + 40, z + 40, -0.05, forest ? C.forest : C.grass, 5, 0.09, 0.09);
    }
  }
  roads() {
    for (const r of ROADS) {
      for (let a = -EXT; a < EXT; a += 35) {
        const b = Math.min(EXT, a + 35);
        this.m(r, (a + b) / 2).flat(r - RW / 2, a, r + RW / 2, b, 0.02, C.road, 6, 0.04);
        this.m((a + b) / 2, r).flat(a, r - RW / 2, b, r + RW / 2, 0.025, C.road, 6, 0.04);
      }
      // dashed centre lines, not across junctions
      for (let a = -EXT; a < EXT; a += 6) {
        if (ROADS.some(q => Math.abs(a + 1.5 - q) < RW / 2 + 1)) continue;
        this.m(r, a).box(r, 0.02, a + 1.5, 0.3, 0.02, 3, C.line);
        this.m(a, r).box(a + 1.5, 0.025, r, 3, 0.02, 0.3, C.line);
      }
    }
    // sidewalks: a band round every block
    const edges = [-EXT, ...ROADS, EXT];
    for (let i = 0; i < edges.length - 1; i++) for (let j = 0; j < edges.length - 1; j++) {
      const x0 = edges[i] + (i ? RW / 2 : 0), x1 = edges[i + 1] - (i + 1 < edges.length - 1 ? RW / 2 : 0);
      const z0 = edges[j] + (j ? RW / 2 : 0), z1 = edges[j + 1] - (j + 1 < edges.length - 1 ? RW / 2 : 0);
      if (z1 < -125 && z0 < -150) continue; // the forest row has no sidewalks on its far side
      const w = 3;
      const sw = (a, b, c, d) => this.m((a + c) / 2, (b + d) / 2).box((a + c) / 2, 0, (b + d) / 2, c - a, 0.06, d - b, C.walk, 0, 0.05);
      if (j) sw(x0, z0, x1, z0 + w);
      if (j + 1 < edges.length - 1) sw(x0, z1 - w, x1, z1);
      if (i) sw(x0, z0, x0 + w, z1);
      if (i + 1 < edges.length - 1) sw(x1 - w, z0, x1, z1);
    }
    // street name signs at every junction
    for (const x of ROADS) for (const z of ROADS) {
      const px = x + RW / 2 + 1, pz = z + RW / 2 + 1;
      this.m(px, pz).cyl(px, 0, pz, 0.08, 3.2, '#5a5a6a', 5);
      const a = signMesh([STREET_EW[z]], 2.6, 0.45, { bg: '#2f8a4a', fg: '#ffffff', border: false });
      a.position.set(px, 3.0, pz); a.rotation.y = 0; this.root.add(a);
      const a2 = a.clone(); a2.rotation.y = Math.PI; a2.position.z -= 0.01; this.root.add(a2);
      const b = signMesh([STREET_NS[x]], 2.6, 0.45, { bg: '#2f8a4a', fg: '#ffffff', border: false });
      b.position.set(px, 3.5, pz); b.rotation.y = Math.PI / 2; this.root.add(b);
      const b2 = b.clone(); b2.rotation.y = -Math.PI / 2; b2.position.x -= 0.01; this.root.add(b2);
      this.col.circle(px, pz, 0.2);
    }
  }

  /* ---------------- building helpers ---------------- */
  /** front: 'n' faces -z, 's' faces +z, 'e' faces +x, 'w' faces -x. Returns the spot just outside the door. */
  bldg(cx, cz, w, d, h, color, front = 's', o = {}) {
    const m = this.m(cx, cz);
    m.box(cx, 0, cz, w, h, d, color);
    m.box(cx, h, cz, w + 0.4, 0.35, d + 0.4, o.trim || C.trim);   // roof trim
    if (o.gable) {
      m.roof(cx, h + 0.35, cz, w + 0.6, d + 0.6, o.gable, o.roof || ROOF_COLORS[0], (front === 'e' || front === 'w') ? Math.PI / 2 : 0);
      // a chimney
      m.box(cx + w * 0.25, h, cz + d * 0.15, 0.9, o.gable + 1.2, 0.9, '#9a6a5a');
      m.box(cx + w * 0.25, h + o.gable + 1.2, cz + d * 0.15, 1.1, 0.2, 1.1, '#7a4a3a');
    } else {
      m.box(cx, h + 0.35, cz, w - 0.6, 0.2, d - 0.6, '#8a84a0');
      // rooftop clutter: AC units, vents, sometimes a water tower
      const n = 1 + Math.floor(this.rand() * 3);
      for (let i = 0; i < n; i++) {
        const ax = cx + (this.rand() - 0.5) * (w - 3), az = cz + (this.rand() - 0.5) * (d - 3);
        m.box(ax, h + 0.55, az, 1.6, 0.9, 1.2, '#c8c8d8'); m.cyl(ax, h + 1.45, az, 0.45, 0.06, '#5a5a6a', 8);
      }
      if (this.rand() < 0.5) m.cyl(cx - w * 0.3, h + 0.55, cz - d * 0.25, 0.25, 1.2, '#9a9aaa', 6);
      if (h > 7 && this.rand() < 0.5) {
        const tx = cx + w * 0.3, tz = cz - d * 0.2;
        for (const [a, b] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) m.box(tx + a, h + 0.55, tz + b, 0.15, 2, 0.15, '#6a4a3a');
        m.cyl(tx, h + 2.5, tz, 1.3, 2.2, '#a87c54', 10); m.cone(tx, h + 4.7, tz, 1.45, 0.9, '#7a5a3a', 10);
      }
    }
    // a strip of flowers along the front
    if (o.flowers !== false && !o.boarded) {
      const [fx2, fz2] = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[front];
      const span = (fx2 ? d : w) / 2 - 2.6;
      for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
        const along = side * (2.6 + k * span / 3);
        const px = cx + fx2 * (w / 2 + 0.5) + (fx2 ? 0 : along), pz = cz + fz2 * (d / 2 + 0.5) + (fx2 ? along : 0);
        m.ico(px, 0.3, pz, 0.9, 0.55, 0.9, '#5fb85a', 0, k);
        m.ico(px + 0.2, 0.62, pz, 0.28, 0.24, 0.28, ['#ff8fc8', '#ffd23f', '#ff6b6b', '#c9a8f0'][(k + (side > 0 ? 1 : 0)) % 4], 0, k);
      }
    }
    // windows on all four sides
    const floors = Math.max(1, Math.floor((h - 0.5) / 3.2));
    const lit = o.lit ?? 0.3;
    const sides = [['n', 0, -1], ['s', 0, 1], ['e', 1, 0], ['w', -1, 0]];
    for (const [s, nx, nz] of sides) {
      const len = nx ? d : w, n = Math.max(1, Math.floor(len / 3.4));
      for (let f = 0; f < floors; f++) for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n - 0.5;
        if (s === front && f === 0 && Math.abs(t * len) < 1.8) continue; // the door goes there
        if (o.boarded && f === 0 && s === front) {
          const x = cx + (nx ? nx * (w / 2 + 0.06) : t * len), z = cz + (nz ? nz * (d / 2 + 0.06) : t * len);
          m.box(x, 1.0, z, nx ? 0.06 : 1.4, 1.5, nx ? 1.4 : 0.06, '#3a2a30', 0, 0.02);
          for (const r of [-0.55, 0.55]) m.boxc(x + nx * 0.04, 1.75, z + nz * 0.04, nx ? 0.08 : 1.9, 0.26, nx ? 1.9 : 0.08, '#b88a50', 0, nx ? r : 0, nx ? 0 : r);
          continue;
        }
        const y = 1.2 + f * 3.2;
        const x = cx + (nx ? nx * (w / 2 + 0.03) : t * len), z = cz + (nz ? nz * (d / 2 + 0.03) : t * len);
        const wc = this.rand() < lit ? C.winLit : C.win;
        m.box(x, y, z, nx ? 0.08 : 1.4, 1.5, nx ? 1.4 : 0.08, wc, 0, 0.02);
        m.box(x, y - 0.12, z, nx ? 0.2 : 1.7, 0.12, nx ? 1.7 : 0.2, C.trim, 0, 0.02);
      }
    }
    // the door
    const [fx, fz] = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[front];
    const dx = cx + fx * (w / 2 + 0.05), dz = cz + fz * (d / 2 + 0.05);
    m.box(dx, 0, dz, fx ? 0.14 : 1.8, 2.6, fx ? 1.8 : 0.14, o.doorColor || C.door);
    m.box(dx + fx * 0.06, 2.6, dz + fz * 0.06, fx ? 0.2 : 2.2, 0.2, fx ? 2.2 : 0.2, C.trim);
    if (o.awning) {
      const ax = cx + fx * (w / 2 + 1.0), az = cz + fz * (d / 2 + 1.0);
      for (let i = 0; i < 6; i++) {
        const along = (i - 2.5) / 6 * Math.min(w, 12) * (fx ? 0 : 1), along2 = (i - 2.5) / 6 * Math.min(d, 12) * (fx ? 1 : 0);
        m.boxc(ax + along, 3.2, az + along2, fx ? 2 : Math.min(w, 12) / 6, 0.12, fx ? Math.min(d, 12) / 6 : 2, i % 2 ? o.awning : '#ffffff', 0, fz * 0.35, -fx * 0.35);
      }
    }
    if (o.sign) {
      const sg = signMesh(o.sign, Math.min(w * 0.8, 10), 1.6, { bg: o.signBg || '#fff6e0', fg: o.signFg || '#2a1640' });
      const sy = Math.min(h - 1, 4.4);
      sg.position.set(cx + fx * (w / 2 + 0.12), sy, cz + fz * (d / 2 + 0.12));
      sg.rotation.y = { n: Math.PI, s: 0, e: Math.PI / 2, w: -Math.PI / 2 }[front];
      this.root.add(sg);
    }
    if (o.poster !== false && this.rand() < 0.6) this.poster(cx, cz, w, d, front);
    this.col.boxc(cx, cz, w, d, { h: h + 2, tag: o.tag });
    return { x: cx + fx * (w / 2 + 1.4), z: cz + fz * (d / 2 + 1.4), ry: { n: Math.PI, s: 0, e: Math.PI / 2, w: -Math.PI / 2 }[front] };
  }

  /** an anti-pizza propaganda poster on a side wall */
  poster(cx, cz, w, d, front, text) {
    const P = [
      { l: ['PIZZA', 'IS ILLEGAL'], bg: '#fff6e0', ban: false, stripe: '#d6232a' },
      { l: ['REPORT', 'SUSPICIOUS', 'CHEESE ACTIVITY'], bg: '#ffe14a', stripe: '#2a1640' },
      { l: ['DO NOT', 'PURCHASE PIZZA'], bg: '#ffffff', stripe: '#d6232a' },
      { l: [''], ban: true, bg: '#ffffff' },
      { l: ['SMELL OREGANO?', 'SAY SOMETHING'], bg: '#c9e8ff', stripe: '#1e2a5a' },
      { l: ['CHEESE IS A', 'GATEWAY DAIRY'], bg: '#fff6e0', stripe: '#2f8a4a' },
      { l: ['PINEAPPLE:', 'STILL GROSS.', 'ALSO ILLEGAL.'], bg: '#ffe9f2', stripe: '#c84a5a' },
      { l: ['HAVE YOU SEEN', 'THIS FOOD?'], bg: '#ffffff', stripe: '#2a1640' },
      { l: ['FLAT BREAD', 'IS FINE.', 'ROUND BREAD', 'IS NOT.'], bg: '#fff6e0', stripe: '#5a6ac8' },
      { l: ['PIZZA-FREE', 'SINCE THIS MONTH!'], bg: '#ffe14a', stripe: '#d6232a' },
    ];
    const p = text ? { l: text, bg: '#fff6e0', stripe: '#d6232a' } : P[Math.floor(this.rand() * P.length)];
    const side = front === 'n' || front === 's' ? (this.rand() < 0.5 ? 'e' : 'w') : (this.rand() < 0.5 ? 'n' : 's');
    const sg = signMesh(p.l, 1.6, 2.2, { bg: p.bg, stripe: p.stripe, ban: p.ban });
    const [fx, fz] = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[side];
    sg.position.set(cx + fx * (w / 2 + 0.06), 2.0, cz + fz * (d / 2 + 0.06));
    sg.rotation.y = { n: Math.PI, s: 0, e: Math.PI / 2, w: -Math.PI / 2 }[side];
    this.root.add(sg);
  }

  tree(x, z, s = 1, kind) {
    const m = this.m(x, z), r = this.rand();
    kind = kind || (r < 0.45 ? 'round' : r < 0.85 ? 'pine' : 'pink');
    m.cyl(x, 0, z, 0.25 * s, 1.6 * s, '#7a5236', 5);
    if (kind === 'pine') {
      const g = ['#3f8a4a', '#4a9a52', '#357a40'][Math.floor(this.rand() * 3)];
      m.cone(x, 1.0 * s, z, 1.6 * s, 2.4 * s, g, 6, this.rand() * 3);
      m.cone(x, 2.4 * s, z, 1.2 * s, 2.0 * s, g, 6, this.rand() * 3);
      m.cone(x, 3.6 * s, z, 0.8 * s, 1.6 * s, g, 6, this.rand() * 3);
    } else {
      const g = kind === 'pink' ? ['#f2a6c8', '#e58ab8', '#c9a8f0'][Math.floor(this.rand() * 3)] : ['#5fb85a', '#72c46a', '#4fa64f'][Math.floor(this.rand() * 3)];
      m.ico(x, 2.6 * s, z, 2.6 * s, 2.3 * s, 2.6 * s, g, 0, this.rand() * 3, 0.12);
      m.ico(x + 0.6 * s, 3.4 * s, z - 0.3 * s, 1.6 * s, 1.5 * s, 1.6 * s, g, 0, this.rand() * 3, 0.12);
    }
    this.col.circle(x, z, 0.4 * s, { h: 6 });
  }
  bush(x, z, s = 1) { this.m(x, z).ico(x, 0.4 * s, z, 1.4 * s, 1.0 * s, 1.4 * s, ['#5fb85a', '#4fa64f', '#e58ab8'][Math.floor(this.rand() * 3)], 0, this.rand() * 3, 0.12); }
  bench(x, z, ry = 0) {
    const m = this.m(x, z), c = Math.cos(ry), s = Math.sin(ry);
    m.box(x, 0.45, z, 2.2, 0.1, 0.6, '#b07a4a', ry);
    m.boxc(x - s * 0.3, 0.85, z - c * 0.3, 2.2, 0.5, 0.08, '#b07a4a', ry);
    for (const k of [-0.9, 0.9]) m.box(x + c * k, 0, z - s * k, 0.1, 0.45, 0.5, '#3a3a44', ry);
  }
  fence(x0, z0, x1, z1, color = '#f6f1e6', h = 1.1, solid = false) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(len / 1.2), ry = Math.atan2(x1 - x0, z1 - z0);
    const m = this.m((x0 + x1) / 2, (z0 + z1) / 2);
    for (let i = 0; i <= n; i++) { const t = i / n; m.box(x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, 0.14, h, 0.14, color); }
    m.boxc((x0 + x1) / 2, h * 0.7, (z0 + z1) / 2, 0.06, 0.12, len, color, ry);
    if (solid) m.boxc((x0 + x1) / 2, h / 2, (z0 + z1) / 2, 0.05, h, len, color, ry);
    this.col.box(Math.min(x0, x1) - 0.1, Math.min(z0, z1) - 0.1, Math.max(x0, x1) + 0.1, Math.max(z0, z1) + 0.1, { h });
  }
  dumpster(x, z, ry = 0) { makeDumpster(this.m(x, z), x, z, ry); const w = Math.abs(Math.sin(ry)) > 0.5; this.col.boxc(x, z, w ? 1.4 : 2.4, w ? 2.4 : 1.4, { h: 1.4, tag: 'dumpster' }); (this.poi.dumpsters ||= []).push({ x, z }); }
  car(style, x, z, ry) { const c = makeCar(style); c.group.position.set(x, 0, z); c.group.rotation.y = ry; this.dyn.add(c.group); const w = Math.abs(Math.sin(ry)) > 0.5; this.col.boxc(x, z, w ? c.S.len : c.S.wid, w ? c.S.wid : c.S.len, { h: 1.6 }); return c; }
  sign(lines, x, y, z, ry, w, h, o) { const s = signMesh(lines, w, h, o); s.position.set(x, y, z); s.rotation.y = ry; this.root.add(s); return s; }
  /** a billboard on two legs, readable from both sides */
  billboard(lines, x, z, ry, o = {}) {
    const m = this.m(x, z), c = Math.cos(ry), s = Math.sin(ry);
    for (const k of [-3, 3]) m.box(x + c * k, 0, z - s * k, 0.3, 5, 0.3, '#5a5a6a');
    m.boxc(x, 5.2, z, 8.4, 3.4, 0.3, '#3a3048', ry);
    this.sign(lines, x + s * 0.16, 5.2, z + c * 0.16, ry, 8, 3, o);
    this.sign(o.back || lines, x - s * 0.16, 5.2, z - c * 0.16, ry + Math.PI, 8, 3, o);
    this.col.boxc(x, z, Math.abs(c) > 0.5 ? 7 : 0.6, Math.abs(c) > 0.5 ? 0.6 : 7, { h: 1, y0: 0 });
  }
  /** a character standing as scenery (statue, guard) */
  person(o, x, z, ry, key) {
    const r = makeChar(o); r.root.position.set(x, 0, z); r.root.rotation.y = ry; this.dyn.add(r.root);
    if (key) this.poi[key] = { x, z, ry, rig: r };
    return r;
  }

  /* ---------------- districts ---------------- */
  townSquare(cx, cz) {
    const m = this.m(cx, cz);
    m.flat(cx - 31, cz - 31, cx + 31, cz + 31, 0.07, C.plaza, 3.1, 0.1);
    // checker ring round the fountain
    for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2; m.box(cx + Math.sin(t) * 9.5, 0.07, cz + Math.cos(t) * 9.5, 1.6, 0.04, 1.6, a % 2 ? C.plaza2 : '#ffffff', t); }
    // the fountain with the mayor's statue
    m.cyl(cx, 0, cz, 6.2, 0.9, '#d9d2e8', 12);
    m.cyl(cx, 0.6, cz, 5.6, 0.32, '#6ec6e8', 12, 0, 0.03);
    m.cyl(cx, 0, cz, 1.6, 3.2, '#c8c0da', 8);
    const statue = makeChar({ skin: '#b8b8c8', shirt: '#a8a8b8', pants: '#9898a8', shoes: '#888898', hat: 'crown', hair: '#a0a0b0', tie: '#9a9aaa', mustache: '#9a9aaa', scale: 1.7, belly: 1.2 });
    statue.root.position.set(cx, 3.2, cz); statue.root.rotation.y = Math.PI / 6;
    statue.armR.rotation.x = -2.4; statue.armL.rotation.x = -0.5;
    statue.anim(0, { angry: true, point: true });
    for (const o of statue.root.children) o.traverse(n => { if (n.isMesh && n.material.color) n.material = mat('#' + n.material.color.clone().lerp(new THREE.Color('#b0b0c4'), 0.75).getHexString(), { rough: 0.6 }); });
    this.dyn.add(statue.root);
    const no = signMesh(['NO'], 1.2, 1.2, { ban: true, bg: '#ffffff' }); no.position.set(cx + 1.5, 7.4, cz + 1.4); no.rotation.y = Math.PI / 6; this.dyn.add(no);
    this.col.circle(cx, cz, 6.3, { h: 1 });
    this.sign(['MAYOR GORDON CRUMB', 'PROTECTOR OF CRUMBVILLE', 'PIZZA-FREE SINCE THIS MONTH'], cx, 1.9, cz + 1.62, 0, 2.6, 1.0, { bg: '#e8d8a8', fg: '#4a3a20' });
    this.poi.statue = { x: cx, z: cz + 7.5 };
    // benches, planters, billboards
    for (let a = 0; a < 6; a++) { const t = a / 6 * Math.PI * 2 + 0.26; this.bench(cx + Math.sin(t) * 14, cz + Math.cos(t) * 14, t + Math.PI); }
    for (const [x, z] of [[-24, -24], [24, -24], [-24, 24], [24, 24]]) { m.box(cx + x, 0, cz + z, 3.4, 0.7, 3.4, '#c8c0da'); this.tree(cx + x, cz + z, 0.9, 'pink'); }
    this.billboard(['PIZZA IS ILLEGAL'], cx + 20, cz - 26, 0, { bg: '#fff6e0', stripe: '#d6232a', back: ['REPORT SUSPICIOUS', 'CHEESE ACTIVITY'] });
    this.billboard(['DO NOT', 'PURCHASE PIZZA'], cx - 20, cz + 26, Math.PI, { bg: '#ffe14a', stripe: '#2a1640', back: ['THANK YOU FOR', 'NOT HAVING PIZZA'] });
  }

  cityHall(cx, cz) {
    const m = this.m(cx, cz);
    const d = this.bldg(cx, cz - 4, 44, 26, 12, '#efe6d0', 's', { sign: ['CITY HALL'], signBg: '#efe6d0', lit: 0.5, poster: false });
    m.cyl(cx, 12.3, cz - 4, 7, 2, '#efe6d0', 12);
    m.add(geo.sph(12, 6), new THREE.Matrix4().compose(new THREE.Vector3(cx, 14.2, cz - 4), new THREE.Quaternion(), new THREE.Vector3(13, 9, 13)), '#e8c45a');
    m.cyl(cx, 18.5, cz - 4, 0.1, 3, '#666', 5);
    m.box(cx + 1, 20.3, cz - 4, 2, 1.2, 0.05, '#d6232a');
    for (let i = 0; i < 8; i++) { m.cyl(cx - 17.5 + i * 5, 0, cz + 10.5, 0.7, 11, '#ffffff', 8); this.col.circle(cx - 17.5 + i * 5, cz + 10.5, 0.7, { h: 11 }); }
    m.box(cx, 11, cz + 10.5, 40, 1.2, 2.6, '#efe6d0');
    for (let i = 0; i < 3; i++) m.box(cx, 0, cz + 11 + i * 1.2, 36, 0.5 - i * 0.15, 1.6, '#e0d8e8');
    this.sign(['PIZZA-FREE', 'SINCE THIS MONTH!'], cx - 14, 7.5, cz + 9.1, 0, 5, 2.4, { bg: '#ffe14a', stripe: '#d6232a' });
    this.sign(['THE PIZZA BAN', 'IS FOR YOUR OWN GOOD'], cx + 14, 7.5, cz + 9.1, 0, 5, 2.4, { bg: '#fff6e0', stripe: '#1e2a5a' });
    this.poi.cityHallDoor = { x: cx, z: cz + 12.5 };
    this.poi.archive = { x: cx + 12, z: cz - 18.6 };
    m.box(cx + 12, 0, cz - 17.05, 2, 2.6, 0.2, '#3a3a44');
    this.sign(['ARCHIVE', 'STAFF ONLY'], cx + 12, 3.2, cz - 17.2, Math.PI, 2.2, 0.8, { bg: '#ffffff' });
    this.person({ skin: '#e0a57c', shirt: '#2a2a38', pants: '#2a2a38', hat: 'bald', glasses: 'sun', tie: '#111' }, cx + 15, cz - 19.5, Math.PI, 'archiveGuard');
  }

  hospital(cx, cz) {
    this.bldg(cx, cz + 2, 44, 26, 10, '#f6f6fa', 'n', { sign: ['HOSPITAL'], signFg: '#d6232a', lit: 0.5, awning: '#d6232a', poster: false });
    const m = this.m(cx, cz);
    // red cross on the roof edge
    m.box(cx + 16, 7, cz - 11.2, 3.6, 1.2, 0.2, '#d6232a'); m.box(cx + 16, 5.8, cz - 11.2, 1.2, 3.6, 0.2, '#d6232a');
    this.poi.hospitalDoor = { x: cx, z: cz - 13.8, ry: Math.PI };
    this.car('van', cx + 12, cz - 20, Math.PI / 2);
    this.sign(['HOSPITAL', 'Now with 40% fewer', 'pizza-related injuries'], cx - 12, 1.6, cz - 21, Math.PI, 3.2, 1.6, { bg: '#ffffff', stripe: '#d6232a' });
    m.box(cx - 12, 0, cz - 20.9, 0.15, 0.8, 0.15, '#5a5a6a');
    // the records bin round the side
    m.box(cx + 24.5, 0, cz + 6, 1.6, 1.2, 1.2, '#4a6a9a');
    this.sign(['RECORDS', 'DO NOT READ'], cx + 25.32, 0.85, cz + 6, Math.PI / 2, 1.1, 0.6, { bg: '#ffffff' });
    this.col.boxc(cx + 24.5, cz + 6, 1.6, 1.2, { h: 1.2 });
    this.poi.clue_hospital = { x: cx + 26, z: cz + 6, y: 1.6 };
    for (let i = 0; i < 6; i++) this.bush(cx - 20 + i * 8, cz - 12.5, 0.8);
  }

  police(cx, cz) {
    const d = this.bldg(cx, cz - 2, 36, 24, 9, '#6f8fd8', 'n', { sign: ['POLICE'], signBg: '#1e2a5a', signFg: '#ffffff', lit: 0.6 });
    this.poi.policeDoor = { x: cx, z: cz - 15.5 };
    this.car('police', cx - 14, cz + 18, 0);
    this.car('police', cx - 9, cz + 18, 0);
    // the evidence yard behind, fenced
    this.fence(cx + 4, cz + 12, cx + 30, cz + 12, '#9a9aaa', 2.2);
    this.fence(cx + 30, cz + 12, cx + 30, cz + 30, '#9a9aaa', 2.2);
    this.fence(cx + 30, cz + 30, cx + 4, cz + 30, '#9a9aaa', 2.2);
    this.fence(cx + 4, cz + 30, cx + 4, cz + 24, '#9a9aaa', 2.2);
    const m = this.m(cx, cz);
    m.box(cx + 24, 0, cz + 25, 3, 2.2, 1.4, '#5a6a7a');
    this.sign(['EVIDENCE'], cx + 24, 1.6, cz + 24.28, Math.PI, 2, 0.5, { bg: '#ffe14a' });
    this.col.boxc(cx + 24, cz + 25, 3, 1.4, { h: 2.2 });
    this.poi.clue_police = { x: cx + 24, z: cz + 23.6, y: 1.2 };
    this.poi.yardGuard = { x: cx + 12, z: cz + 20 };
    this.poi.copSpawn = { x: cx, z: cz - 19 };
    this.billboard(['WANTED:', 'ANYONE WITH PIZZA'], cx - 22, cz + 26, Math.PI / 2, { bg: '#fff6e0', stripe: '#1e2a5a' });
  }

  gasStation(cx, cz) {
    const m = this.m(cx, cz);
    m.flat(cx - 31, cz - 4, cx + 14, cz + 31, 0.06, '#8a84a0', 4, 0.05);
    m.box(cx - 10, 5, cz + 18, 22, 0.8, 12, '#ffffff');
    m.box(cx - 10, 5.8, cz + 18, 22.4, 0.3, 12.4, '#d6232a');
    for (const [x, z] of [[-19, 13], [-1, 13], [-19, 23], [-1, 23]]) { m.box(cx + x, 0, cz + z, 0.5, 5, 0.5, '#e0e0ea'); this.col.circle(cx + x, cz + z, 0.35); }
    for (const x of [-15, -5]) { m.box(cx + x, 0, cz + 18, 1, 1.8, 0.7, '#d6232a'); m.box(cx + x, 1.8, cz + 18, 1.1, 0.4, 0.8, '#ffffff'); this.col.boxc(cx + x, cz + 18, 1, 0.7, { h: 2 }); }
    this.sign(['GAS'], cx - 10, 5.4, cz + 24.25, 0, 3, 0.7, { bg: '#d6232a', fg: '#ffffff', border: false });
    this.bldg(cx + 18, cz + 16, 18, 12, 4.5, '#ffe9a8', 's', { sign: ["GAS 'N' SAD"], awning: '#3fa34d' });
    this.poi.tony = { x: cx + 22, z: cz + 6.5 };
    this.poi.clue_gas = { x: cx + 12, z: cz + 23.5, y: 1.0 };
    m.box(cx + 12, 0, cz + 23.2, 1.2, 1.0, 0.6, '#3a7bd5');
    this.sign(['NEWS'], cx + 12, 0.7, cz + 23.52, 0, 0.9, 0.35, { bg: '#ffffff' });
    this.dumpster(cx + 26, cz + 4);
    // honest hank's car lot
    m.flat(cx - 31, cz - 31, cx + 31, cz - 8, 0.06, '#9a94b0', 4, 0.05);
    this.bldg(cx + 20, cz - 22, 12, 9, 4, '#ffcf33', 'w', { sign: ["HONEST HANK'S"], awning: '#d6232a', poster: false });
    for (let i = 0; i < 6; i++) { m.cyl(cx - 26 + i * 8, 0, cz - 9, 0.06, 4.5, '#aaa', 4); m.box(cx - 25.6 + i * 8, 3.8, cz - 9, 0.8, 0.6, 0.05, ['#d6232a', '#ffd23f', '#3a7bd5'][i % 3]); }
    for (const [st, x] of [['scooter', -22], ['van', -12], ['icecream', -2], ['sports', 8]]) this.car(st, cx + x, cz - 20, 0.3);
    this.poi.hank = { x: cx + 12, z: cz - 22 };
  }

  shops(cx, cz) {
    const front = cz + 24;
    this.bldg(cx - 23, front, 18, 14, 7, '#8fc1e3', 's', { sign: ["OLEG'S APPLIANCES"], awning: '#3a7bd5' });
    this.bldg(cx, front, 18, 14, 6, '#f7a8c8', 's', { sign: ['MUSTACHE', 'EMPORIUM'], awning: '#2a1640' });
    this.bldg(cx + 23, front, 18, 14, 6.5, '#f7d26b', 's', { sign: ["SHOES 'R' SHOES"], awning: '#d6232a' });
    this.poi.oleg = { x: cx - 23, z: front + 8.4 };
    this.poi.mustache = { x: cx, z: front + 8.4 };
    this.poi.manSpot = { x: cx - 11.5, z: front + 1 };
    this.poi.bigCheese = { x: cx + 11.5, z: cz + 4 };
    // back lot: dumpsters, a laundromat, a tattoo parlour
    const m = this.m(cx, cz);
    m.flat(cx - 31, cz - 31, cx + 31, cz + 16, 0.06, '#9a94b0', 4, 0.05);
    this.dumpster(cx - 11.5, cz + 10);
    this.dumpster(cx + 15, cz + 8, Math.PI / 2);
    this.bldg(cx - 18, cz - 20, 20, 12, 5, '#a8e0c0', 'n', { sign: ['SPIN CYCLE', 'LAUNDROMAT'] });
    this.bldg(cx + 18, cz - 20, 16, 12, 5, '#3a3048', 'n', { sign: ['INK & REGRET'], signBg: '#2a1640', signFg: '#ff8fc8' });
  }

  pizzerias(cx, cz) {
    const front = cz - 22;
    const closed = { signBg: '#5a4a3a', signFg: '#ffd65a', boarded: true, lit: 0, poster: false };
    this.bldg(cx - 22, front, 18, 12, 5.5, '#c8a090', 'n', { ...closed, sign: ['SLICE SLICE BABY'] });
    this.bldg(cx, front, 18, 12, 6, '#b8a8c8', 'n', { ...closed, sign: ["MAMMA MIA'S"] });
    this.bldg(cx + 22, front, 18, 12, 5.5, '#a8b8a0', 'n', { ...closed, sign: ['CRUST FUND'] });
    for (const x of [-22, 0, 22]) {
      this.sign(['CLOSED BY ORDER', 'OF THE MAYOR'], cx + x + 4, 1.6, front - 6.12, Math.PI, 2.4, 1.1, { bg: '#ffe14a', stripe: '#2a1640' });
      const m = this.m(cx + x, front);
      m.boxc(cx + x, 1.4, front - 6.2, 7, 0.25, 0.05, '#ffd23f', 0, 0, 0.18);
      m.boxc(cx + x, 1.4, front - 6.21, 7, 0.25, 0.05, '#ffd23f', 0, 0, -0.18);
    }
    // the bakery behind and doughboy doug
    this.bldg(cx, cz + 16, 22, 12, 5, '#ffe0c0', 's', { sign: ['DOUGH-RE-MI', 'BAKERY (CLOSED)'], boarded: true });
    this.poi.doug = { x: cx - 14, z: cz - 6 };
    this.dumpster(cx - 18, cz - 9);
    this.dumpster(cx + 14, cz - 9);
  }

  residential(bx, bz) {
    const rows = bz >= 150 ? [-1] : [-1, 1];
    for (const r of rows) {
      const roadZ = bz + r * 40;
      const street = STREET_EW[String(roadZ)];
      for (let i = 0; i < 3; i++) {
        const x = bx - 22 + i * 22, z = bz + r * 17;
        const color = WALL_COLORS[Math.floor(this.rand() * WALL_COLORS.length)];
        const roof = ROOF_COLORS[Math.floor(this.rand() * ROOF_COLORS.length)];
        const front = r < 0 ? 'n' : 's';
        const door = this.bldg(x, z, 12, 10, 4, color, front, { gable: 2.6, roof, lit: 0.4, poster: this.rand() < 0.3 });
        const num = (Math.abs(bx) + 7 * i + (r > 0 ? 3 : 0)) % 97 + 1;
        // mailbox with the number, and a little fence
        const mz = z + r * 9.5, mx = x + 3.2;
        const m = this.m(x, z);
        m.box(mx, 0, mz, 0.12, 1.0, 0.12, '#6a5a4a'); m.box(mx, 1.0, mz, 0.5, 0.35, 0.7, '#3a7bd5');
        this.sign([String(num)], mx, 1.17, mz + r * 0.36, r < 0 ? Math.PI : 0, 0.42, 0.3, { bg: '#ffffff', border: false });
        this.fence(x - 6, z + r * 10.5, x - 1.5, z + r * 10.5);
        this.fence(x + 1.5, z + r * 10.5, x + 6, z + r * 10.5);
        if (this.rand() < 0.7) this.tree(x + (this.rand() < 0.5 ? -8.5 : 8.5), z + r * 2, 0.8 + this.rand() * 0.4);
        this.bush(x - 4, z + r * 6.2, 0.6); this.bush(x + 4, z + r * 6.2, 0.6);
        this.houses.push({ id: this.houses.length, num, street, addr: num + ' ' + street, x, z, door: { x: door.x, z: door.z }, ry: door.ry, color });
      }
    }
  }

  mansion(cx, cz) {
    const d = this.bldg(cx, cz - 6, 28, 18, 9, '#f2b5d4', 's', { gable: 4, roof: '#c8a03a', trim: '#ffe9a8', sign: ['CRUMB MANOR'], signBg: '#ffe9a8', lit: 0.7, poster: false });
    const m = this.m(cx, cz);
    for (let i = 0; i < 4; i++) { m.cyl(cx - 9 + i * 6, 0, cz + 4.5, 0.6, 9, '#ffffff', 8); this.col.circle(cx - 9 + i * 6, cz + 4.5, 0.6, { h: 9 }); }
    this.fence(cx - 30, cz + 18, cx - 4, cz + 18, '#c8a03a', 2);
    this.fence(cx + 4, cz + 18, cx + 30, cz + 18, '#c8a03a', 2);
    this.sign(['PRIVATE PROPERTY', 'NO PIZZA. NO EXCEPTIONS.'], cx - 8, 1.4, cz + 18.12, 0, 3.4, 1.2, { bg: '#ffffff', stripe: '#d6232a' });
    m.box(cx + 6, 0, cz + 19.5, 0.14, 1.1, 0.14, '#6a5a4a'); m.box(cx + 6, 1.1, cz + 19.5, 0.6, 0.4, 0.8, '#c8a03a');
    this.poi.clue_mansion = { x: cx + 6, z: cz + 20.4, y: 1.4 };
    this.car('limo', cx + 18, cz + 8, 0);
    for (let i = 0; i < 6; i++) this.bush(cx - 25 + i * 10, cz + 15, 1);
    this.tree(cx - 26, cz - 24, 1.3, 'pink'); this.tree(cx + 26, cz - 24, 1.3, 'pink');
  }

  industry() {
    // east column: warehouses, a factory, sal ami's loading dock
    const wh = (x, z, w, d, h, c, front, sign) => this.bldg(x, z, w, d, h, c, front, { sign, gable: 1.2, roof: '#5a6070', lit: 0.1 });
    wh(150, -96, 30, 18, 8, '#9aa0b8', 'w', ['WAREHOUSE 2']);
    wh(178, -62, 18, 22, 7, '#b8a890', 'w', ['DEFINITELY NOT', 'A WAREHOUSE']);
    wh(148, -60, 14, 12, 6, '#8a90a8', 's', ['LOADING']);
    this.poi.sal = { x: 148, z: -51 };
    this.dumpster(158, -52);
    // the cardboard factory
    this.bldg(162, -2, 40, 28, 10, '#c8b090', 'w', { sign: ['CRUMBVILLE', 'CARDBOARD CO.'], lit: 0.2 });
    const m = this.m(170, 0);
    m.cyl(176, 10, 4, 2, 12, '#8a6a5a', 8); m.cyl(176, 22, 4, 2.3, 0.6, '#5a4a3a', 8);
    m.cyl(168, 10, 8, 1.6, 9, '#8a6a5a', 8);
    this.poi.chimney = { x: 176, y: 23, z: 4 };
    // warehouses round the hideout
    wh(184, 70, 14, 30, 7, '#a0a8b8', 'w', ['STORAGE']);
    wh(150, 104, 22, 12, 6, '#b0a0c0', 'n', ['TOTALLY LEGAL', 'IMPORTS']);
  }

  hideout() {
    const H = HQ, m = this.m(152, 80);
    const wallH = 4.6, t = 0.5;
    const brick = (x0, z0, x1, z1, y0 = 0, h = wallH, key) => {
      // a wall gets its own mesh so it can cut away
      const me = new Mesher(0.12);
      const w = x1 - x0, d = z1 - z0;
      me.box((x0 + x1) / 2, y0, (z0 + z1) / 2, w, h, d, C.brick);
      // brick rows: thin darker stripes
      for (let y = y0 + 0.6; y < y0 + h; y += 0.6) me.box((x0 + x1) / 2, y, (z0 + z1) / 2, w + 0.02, 0.05, d + 0.02, C.brickDark, 0, 0.02);
      const mesh = me.build();
      this.root.add(mesh);
      this.col.box(x0, z0, x1, z1, { h, y0, floor: y0 < -1 ? 1 : 0, tag: 'hq' });
      return mesh;
    };
    // floor: purple and pink checker tiles, like an old pizzeria
    const fl = new Mesher(0.06);
    for (let x = H.x0; x < H.x1; x += 2) for (let z = H.z0; z < H.z1; z += 2) fl.flat(x, z, x + 2, z + 2, 0.08, ((x + z) / 2) % 2 ? '#b8a0d8' : '#e8c8e0', 2, 0.06);
    const flm = fl.build({ cast: false }); this.root.add(flm);
    // outer walls (west wall has the door gap at z 78.5-81.5)
    const W = [];
    W.push({ mesh: brick(H.x0 - t, H.z0 - t, H.x1 + t, H.z0), axis: 'z', at: H.z0, out: -1 });                 // north
    W.push({ mesh: brick(H.x0 - t, H.z1, H.x1 + t, H.z1 + t), axis: 'z', at: H.z1, out: 1 });                  // south
    W.push({ mesh: brick(H.x1, H.z0, H.x1 + t, H.z1), axis: 'x', at: H.x1, out: 1 });                          // east
    W.push({ mesh: brick(H.x0 - t, H.z0, H.x0, 78.5), axis: 'x', at: H.x0, out: -1 });                        // west, north of door
    W.push({ mesh: brick(H.x0 - t, 81.5, H.x0, H.z1), axis: 'x', at: H.x0, out: -1 });                        // west, south of door
    W.push({ mesh: brick(H.x0 - t, 78.5, H.x0, 81.5, 3, 1.6), axis: 'x', at: H.x0, out: -1 });                 // lintel
    // the partition to the back room, with a doorway that is boarded until level 2
    W.push({ mesh: brick(H.split - 0.25, H.z0, H.split + 0.25, 78.5), axis: 'x', at: H.split, out: 0 });
    W.push({ mesh: brick(H.split - 0.25, 81.5, H.split + 0.25, H.z1), axis: 'x', at: H.split, out: 0 });
    W.push({ mesh: brick(H.split - 0.25, 78.5, H.split + 0.25, 81.5, 3, 1.6), axis: 'x', at: H.split, out: 0 });
    this.hideWalls = W;
    const boards = new Mesher(0.1);
    for (let i = 0; i < 5; i++) boards.boxc(H.split, 0.5 + i * 0.55, 80, 0.15, 0.3, 3.2, '#a87c44', 0, (i % 2 ? 0.1 : -0.1));
    this.boarded = boards.build(); this.root.add(this.boarded);
    this.boardCol = this.col.box(H.split - 0.3, 78.5, H.split + 0.3, 81.5, { h: 3, tag: 'hq' });
    // the roof (hidden while you are inside)
    const rf = new Mesher(0.08);
    rf.box((H.x0 + H.x1) / 2, wallH, (H.z0 + H.z1) / 2, H.x1 - H.x0 + 1.4, 0.4, H.z1 - H.z0 + 1.4, '#5a4a6a');
    rf.box(158, wallH + 0.4, 76, 2, 1.2, 2, '#8a8aa0');
    this.hqRoof = rf.build({ cast: false }); this.root.add(this.hqRoof);
    // hanging lamps under the roof (seen from inside in first person)
    for (const [x, z] of [[146, 76], [146, 84], [158, 76], [158, 84]]) {
      this.root.add(part(geo.cyl(6), '#2a2238', x, 3.9, z, 0.05, 0.7, 0.05));
      this.root.add(part(geo.cone(6), '#ff8fc8', x, 3.55, z, 0.7, 0.35, 0.7));
      this.root.add(part(geo.ico(0), '#fff6c8', x, 3.4, z, 0.25, 0.2, 0.25, { emissive: 0xfff2b0, ei: 1 }));
    }
    // front: the sign, a boarded window, the door frame
    this.hqSign = this.sign(['OLD SHOE REPAIR', '(CLOSED)'], H.x0 - 0.55, 3.9, 80, -Math.PI / 2, 4.6, 1.0, { bg: '#5a4a3a', fg: '#ffd65a' });
    for (const wz of [75, 85]) {
      m.box(H.x0 - 0.55, 1.0, wz, 0.06, 1.5, 1.6, '#3a2a30', 0, 0.02);
      for (const r of [-0.6, 0.6]) m.boxc(H.x0 - 0.62, 1.75, wz, 0.08, 0.26, 2.0, '#b88a50', 0, r);
    }
    m.flat(126, 64, H.x0 - 0.6, 104, 0.06, '#9a94b0', 4, 0.05);  // the yard / parking
    this.dumpster(134, 70, Math.PI / 2);
    this.poi.hqDoor = { x: H.door.x, z: H.door.z };
    this.poi.garage = H.garage;

    // the basement: dug out under the whole lot
    const B = H.base, by = B.y;
    const bf = new Mesher(0.06);
    for (let x = B.x0; x < B.x1; x += 2) for (let z = B.z0; z < B.z1; z += 2) bf.flat(x, z, x + 2, z + 2, by + 0.05, ((x + z) / 2) % 2 ? '#7a6aa0' : '#c8a8d0', 2, 0.06);
    this.root.add(bf.build({ cast: false }));
    const ceil = new Mesher(0.08); ceil.box((B.x0 + B.x1) / 2, by + 5.6, (B.z0 + B.z1) / 2, B.x1 - B.x0 + 1, 0.3, B.z1 - B.z0 + 1, '#4a3a5a');
    const cm = ceil.build({ cast: false }); cm.material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, side: THREE.BackSide }); this.root.add(cm);
    const bw = [];
    bw.push({ mesh: brick(B.x0 - t, B.z0 - t, B.x1 + t, B.z0, by, 5.6), axis: 'z', at: B.z0, out: -1 });
    bw.push({ mesh: brick(B.x0 - t, B.z1, B.x1 + t, B.z1 + t, by, 5.6), axis: 'z', at: B.z1, out: 1 });
    bw.push({ mesh: brick(B.x0 - t, B.z0, B.x0, B.z1, by, 5.6), axis: 'x', at: B.x0, out: -1 });
    bw.push({ mesh: brick(B.x1, B.z0, B.x1 + t, B.z1, by, 5.6), axis: 'x', at: B.x1, out: 1 });
    this.baseWalls = bw;
    // basement clutter: flour sacks, crates, a couch, a dartboard, pipes
    const bd = new Mesher(0.1);
    for (const [x, z, n] of [[138.5, 95.5, 3], [141, 96, 2], [166.5, 95.5, 4], [166.6, 92.6, 2]]) for (let i = 0; i < n; i++) bd.box(x + (i % 2) * 0.2, by + 0.05 + i * 0.9, z, 1.2, 0.9, 1.2, i % 2 ? '#a87c44' : '#c8995a', i * 0.3);
    for (let i = 0; i < 5; i++) { bd.ico(162 + (i % 3) * 0.9, by + 0.5, 64.2 + Math.floor(i / 3) * 1.0, 0.9, 1.0, 0.8, '#f1e6cf', 0, i); }
    bd.box(160.5, by + 0.05, 92, 3.2, 0.5, 1.2, '#c84a8a'); bd.box(160.5, by + 0.55, 92.5, 3.2, 0.8, 0.3, '#c84a8a');
    bd.box(159, by + 0.55, 92, 0.3, 0.5, 1.2, '#a83a7a'); bd.box(162, by + 0.55, 92, 0.3, 0.5, 1.2, '#a83a7a');
    bd.box(156.5, by + 0.05, 92, 1.4, 0.45, 0.8, '#6a4a2a');
    for (const z of [66, 80, 94]) bd.box(152, by + 5.3, z, 32, 0.25, 0.25, '#8a8aa0');
    this.root.add(bd.build());
    this.sign(['EMPLOYEE OF', 'THE MONTH:', 'DEZ (AGAIN)'], 167.7, by + 2.6, 76, -Math.PI / 2, 1.4, 1.4, { bg: '#ffe14a' });
    this.sign(['PIZZA IS', 'LOVE'], 136.3, by + 2.8, 84, Math.PI / 2, 2.2, 1.4, { bg: '#ff8fc8', fg: '#2a1640' });
    this.sign(['NO COPS', 'ALLOWED', '(EXCEPT DISGUISED ONES)'], 136.3, by + 2.8, 88.5, Math.PI / 2, 2.2, 1.2, { bg: '#ffffff', stripe: '#d6232a' });
    this.col.boxc(139.5, 95.7, 4, 2, { floor: 1, y0: by, h: 4 }); this.col.boxc(166.5, 94, 1.6, 4.5, { floor: 1, y0: by, h: 4 });
    this.col.boxc(160.5, 92.2, 3.4, 1.4, { floor: 1, y0: by, h: 1.5 }); this.col.boxc(163, 64.6, 3, 2, { floor: 1, y0: by, h: 1.2 });
    // neon in the basement
    this.baseNeon = this.sign(['PIZZA', 'UNDERGROUND'], 152, by + 3.8, B.z0 + 0.3, 0, 6, 2, { bg: '#2a1640', fg: '#ff8fc8', borderColor: '#43e0ff' });
    this.baseNeon.material = new THREE.MeshBasicMaterial({ map: this.baseNeon.material.map });
    this.baseLamps = [];
    for (const [x, z] of [[144, 72], [160, 72], [144, 88], [160, 88]]) {
      const l = part(geo.cyl(6), '#fff6c8', x, by + 5.2, z, 0.8, 0.2, 0.8, { emissive: 0xfff2b0, ei: 1 }); this.root.add(l);
    }
  }

  junkyard(cx, cz) {
    // the north fence is in two halves: the gap between them is the gate
    this.fence(cx - 30, cz - 26, cx - 5, cz - 26, '#7a7a8a', 2.4, true);
    this.fence(cx + 5, cz - 26, cx + 30, cz - 26, '#7a7a8a', 2.4, true);
    this.fence(cx - 30, cz - 26, cx - 30, cz + 30, '#7a7a8a', 2.4, true);
    this.fence(cx + 30, cz - 26, cx + 30, cz + 30, '#7a7a8a', 2.4, true);
    this.sign(["JUNK 'N' STUFF"], cx - 12, 3.2, cz - 26.2, Math.PI, 5, 1, { bg: '#ffd23f' });
    const styles = ['civ1', 'civ2', 'civ3', 'civ4', 'van'];
    for (let i = 0; i < 9; i++) {
      const x = cx - 20 + (i % 3) * 18, z = cz - 10 + Math.floor(i / 3) * 14;
      if (i === 4) continue;
      for (let k = 0; k < 3; k++) {
        const c = makeCar(styles[(i + k) % 5]); c.group.position.set(x, k * 1.3, z); c.group.rotation.set(0, i + k, k * 0.1);
        c.group.traverse(n => { if (n.isMesh) n.material = mat('#' + n.material.color.clone().lerp(new THREE.Color('#6a5a50'), 0.5).getHexString()); });
        this.dyn.add(c.group);
      }
      this.col.circle(x, z, 2.6, { h: 4 });
    }
    // the mayor's limo, crumpled, with the crash still on it
    const limo = makeCar('limo'); limo.group.position.set(cx + 2, 0, cz + 4); limo.group.rotation.set(0, 0.6, 0.06);
    limo.body.scale.set(1, 0.9, 0.85); this.dyn.add(limo.group);
    this.sign(['MAYOR 1'], cx + 2 + Math.sin(0.6) * -2.65, 0.6, cz + 4 - Math.cos(0.6) * 2.65, 0.6 + Math.PI, 0.9, 0.3, { bg: '#ffffff' });
    this.col.circle(cx + 2, cz + 4, 2.6, { h: 2 });
    this.poi.clue_junk = { x: cx + 2 + Math.sin(0.6) * 3.3, z: cz + 4 + Math.cos(0.6) * 3.3, y: 1.2 };
  }

  park(cx, cz) {
    const m = this.m(cx, cz);
    m.flat(cx - 31, cz - 31, cx + 31, cz + 31, 0.0, C.park, 4, 0.08, 0.05);
    // a pond
    m.cyl(cx + 12, -0.2, cz + 12, 10, 0.28, '#6ec6e8', 14, 0, 0.04);
    this.col.circle(cx + 12, cz + 12, 9.6, { h: 0.5 });
    for (let i = 0; i < 14; i++) { const a = this.rand() * 6.28, r = 12 + this.rand() * 16; const x = cx + Math.sin(a) * r - 6, z = cz + Math.cos(a) * r - 6; if (Math.abs(x - cx) < 30 && Math.abs(z - cz) < 30) this.tree(x, z, 0.8 + this.rand() * 0.5); }
    this.bench(cx - 20, cz - 20, 0); this.bench(cx - 8, cz - 24, 0);
    this.poi.larry = { x: cx - 20, z: cz - 18.8 };
    this.poi.pete = { x: cx + 4, z: cz - 4 };
    this.sign(['CRUMBVILLE PARK', 'No pizza. No picnics with pizza.', 'No thinking about pizza.'], cx - 24, 1.6, cz - 30, Math.PI, 3.6, 1.6, { bg: '#2f8a4a', fg: '#ffffff' });
    m.box(cx - 24, 0, cz - 29.9, 0.15, 0.8, 0.15, '#5a5a6a');
  }

  forest() {
    const r = this.rand;
    for (let i = 0; i < 520; i++) {
      const x = -240 + r() * 480, z = -250 + r() * 115;
      if (ROADS.some(q => Math.abs(x - q) < 9) || Math.abs(z + 120) < 10) continue;
      if (Math.hypot(x + 60, z + 165) < 14 || Math.hypot(x - 100, z + 170) < 10) continue; // clearings
      this.tree(x, z, 0.9 + r() * 0.7, r() < 0.6 ? 'pine' : 'round');
    }
    // side forests and the far south
    for (let i = 0; i < 260; i++) {
      const side = r() < 0.5 ? -1 : 1, x = side * (210 + r() * 40), z = -130 + r() * 380;
      this.tree(x, z, 0.9 + r() * 0.6, r() < 0.5 ? 'pine' : 'round');
    }
    for (let i = 0; i < 160; i++) {
      const x = -210 + r() * 420, z = 207 + r() * 40;
      if (ROADS.some(q => Math.abs(x - q) < 8)) continue;
      this.tree(x, z, 0.9 + r() * 0.6, r() < 0.5 ? 'pine' : 'round');
    }
    // the mushroom clearing
    this.poi.funguy = { x: -60, z: -165 };
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; this.m(-60, -165).ico(-60 + Math.sin(a) * 8, 0.3, -165 + Math.cos(a) * 8, 1.0, 0.7, 1.0, '#c8473f', 0, a); }
    // the radio tower
    const m = this.m(100, -170);
    for (let i = 0; i < 8; i++) { const s = 1 - i * 0.1; m.box(100, i * 4, -170, 3 * s, 0.2, 3 * s, '#c8c8d8'); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.box(100 + a * 1.5 * s, i * 4, -170 + b * 1.5 * s, 0.2, 4, 0.2, '#d6232a'); }
    m.box(100, 32, -170, 0.6, 0.6, 0.6, '#ff3030');
    m.box(104, 0, -168, 4, 2.6, 3, '#e0e0ea');
    this.col.boxc(100, -170, 3.2, 3.2, { h: 32 }); this.col.boxc(104, -168, 4, 3, { h: 3 });
    this.poi.clue_radio = { x: 104, z: -166.2, y: 1.4 };
    this.sign(['KRUM RADIO', '"All the news. None of the pizza."'], 104, 2.0, -166.48, 0, 3.4, 0.8, { bg: '#ffffff' });
    this.poi.tower = { x: 100, y: 32.5, z: -170 };
    // the crash site on pepper road: skid marks
    const s = this.m(40, -120);
    for (let i = 0; i < 6; i++) s.boxc(30 + i * 1.8, 0.04, -117 + Math.sin(i) * 0.6, 1.8, 0.02, 0.3, '#2a2238', 0.2 * i);
    this.poi.crash = { x: 40, z: -117 };
  }

  mountains() {
    const r = this.rand;
    for (let i = 0; i < 40; i++) {
      const a = i / 40 * Math.PI * 2, d = 300 + r() * 40;
      const x = Math.sin(a) * d, z = Math.cos(a) * d, h = 40 + r() * 50;
      const m = this.m(Math.max(-270, Math.min(270, x)), Math.max(-270, Math.min(270, z)));
      m.cone(x, -2, z, 30 + r() * 20, h, ['#9a8ac8', '#8a7ab8', '#b0a0d8'][i % 3], 6, r() * 3, 0.1);
      if (h > 70) m.cone(x, h * 0.62 - 2, z, (30) * 0.38, h * 0.38, '#ffffff', 6, r() * 3, 0.05);
    }
  }

  lampsAndProps() {
    for (const rd of ROADS) for (let a = -EXT + 10; a < EXT; a += 26) {
      if (ROADS.some(q => Math.abs(a - q) < 10)) continue;
      for (const [x, z] of [[rd + RW / 2 + 1.5, a], [a, rd + RW / 2 + 1.5]]) {
        if (z < -128 && x !== rd + RW / 2 + 1.5) continue;
        const m = this.m(x, z);
        m.cyl(x, 0, z, 0.1, 4.4, '#4a4a5a', 5);
        m.box(x, 4.4, z, 0.5, 0.3, 0.5, '#4a4a5a');
        this.lamps.push({ x, y: 4.3, z });
        this.col.circle(x, z, 0.18);
      }
    }
    // hydrants and trash cans here and there
    for (let i = 0; i < 40; i++) {
      const rd = ROADS[i % 4], a = -110 + (i * 37) % 220;
      if (ROADS.some(q => Math.abs(a - q) < 9)) continue;
      const x = rd - RW / 2 - 1.5, z = a;
      this.m(x, z).cyl(x, 0, z, 0.22, 0.8, '#d6232a', 6);
      this.col.circle(x, z, 0.25);
    }
  }

  /** crosswalks, street trees in planters, and cars parked along the curbs */
  streetLife() {
    const nearJunction = a => ROADS.some(q => Math.abs(a - q) < 15);
    for (const x of ROADS) for (const z of ROADS) {
      // zebra crossings on all four sides of every junction
      for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const m = this.m(x, z);
        for (let i = -2; i <= 2; i++) {
          if (dx === 0) m.box(x + i * 2.2, 0.03, z + dz * (RW / 2 + 1.4), 1.2, 0.02, 2.4, '#f6f1e6', 0, 0.02);
          else m.box(x + dx * (RW / 2 + 1.4), 0.03, z + i * 2.2, 2.4, 0.02, 1.2, '#f6f1e6', 0, 0.02);
        }
      }
    }
    const styles = ['civ1', 'civ2', 'civ3', 'civ4', 'van', 'civ1', 'civ3'];
    for (const r of ROADS) for (let a = -EXT + 12; a < EXT - 8; a += 13) {
      if (nearJunction(a) || nearJunction(a - 6.5)) continue;
      // street trees in little planters, at the curb edge of the sidewalk
      for (const [x, z, side] of [[r + RW / 2 + 0.9, a + 6.5, 1], [r - RW / 2 - 0.9, a + 6.5, -1], [a + 6.5, r + RW / 2 + 0.9, 1], [a + 6.5, r - RW / 2 - 0.9, -1]]) {
        if (z < -128 || (Math.abs(x) < 34 && Math.abs(z) < 34)) continue;
        if ((a / 13 | 0) % 2) continue;
        const m = this.m(x, z);
        m.box(x, 0, z, 1.3, 0.35, 1.3, '#b7a8d6');
        m.flat(x - 0.5, z - 0.5, x + 0.5, z + 0.5, 0.36, '#6a4a3a', 1);
        this.tree(x, z, 0.6, this.rand() < 0.3 ? 'pink' : 'round');
      }
      // parked cars, right side of the road, not on pepper road (the intro needs it empty)
      if (r === -120) continue;
      for (const [x, z, yaw] of [[r + 4.8, a, Math.PI], [r - 4.8, a, 0], [a, r + 4.8, Math.PI / 2], [a, r - 4.8, -Math.PI / 2]]) {
        if (this.rand() > 0.22 || z < -128) continue;
        if (Math.abs(x - 120) < 7 && z > 60 && z < 100) continue; // keep the hideout curb clear
        const c = makeCar(styles[Math.floor(this.rand() * styles.length)]);
        c.group.position.set(x, 0, z); c.group.rotation.y = yaw; c.group.updateMatrixWorld(true);
        const m = this.m(x, z);
        c.group.traverse(o => { if (o.isMesh && o.material.color && !o.material.transparent) m.add(o.geometry, o.matrixWorld, '#' + o.material.color.getHexString(), 0.03); });
        const along = Math.abs(Math.sin(yaw)) > 0.5;
        this.col.boxc(x, z, along ? c.S.len : c.S.wid, along ? c.S.wid : c.S.len, { h: 1.6 });
      }
    }
  }

  /* ---------------- the hospital room (a separate set, off the map) ---------------- */
  hospitalRoom() {
    const { x: X, z: Z } = HOSPITAL_SET;
    const m = new Mesher(0.06);
    m.flat(X - 8, Z - 6, X + 8, Z + 6, 0, '#d8e8f0', 2, 0.05);
    const wall = (x0, z0, x1, z1) => { m.box((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0, 7, z1 - z0, '#bfe0d8'); this.col.box(x0, z0, x1, z1, { h: 7 }); };
    // the ceiling, lit as if by hospital tubes (you stare at it when you wake up)
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(16.8, 12.8), new THREE.MeshBasicMaterial({ color: '#dfe8ec' }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(X, 6.9, Z); this.root.add(ceil);
    for (const tx of [-4, 0, 4]) { const tube = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 0.4), new THREE.MeshBasicMaterial({ color: '#ffffff' })); tube.position.set(X + tx, 6.85, Z - 2); this.root.add(tube); }
    wall(X - 8.4, Z - 6.4, X + 8.4, Z - 6); wall(X - 8.4, Z + 6, X + 8.4, Z + 6.4);
    wall(X - 8.4, Z - 6, X - 8, Z + 6); wall(X + 8, Z - 6, X + 8.4, Z - 2); wall(X + 8, Z + 2, X + 8.4, Z + 6);
    m.box(X + 8.2, 0, Z, 0.1, 2.8, 4, '#6a8aa8');  // the door
    m.box(X + 8.2, 2.8, Z, 0.4, 4.2, 4, '#bfe0d8'); // wall over the door
    m.box(X, 0, Z - 6, 16, 1.0, 0.1, '#9ac8c0');     // dado
    // beds along the north wall
    this.poi.beds = [];
    for (let i = 0; i < 4; i++) {
      const bx = X - 6 + i * 3.4, bz = Z - 4.2;
      m.box(bx, 0, bz, 1.6, 0.6, 2.8, '#e0e0ea'); m.box(bx, 0.6, bz, 1.5, 0.2, 2.7, '#ffffff');
      m.box(bx, 0.8, bz - 1.1, 1.2, 0.2, 0.5, '#f6f6fa'); m.box(bx, 0.62, bz + 0.4, 1.52, 0.22, 1.7, '#9ac8e8');
      m.box(bx, 0, bz - 1.45, 1.7, 1.2, 0.1, '#c8c8d8');
      this.col.boxc(bx, bz, 1.6, 2.8, { h: 0.8 });
      this.poi.beds.push({ x: bx, z: bz });
      // heart monitor
      m.box(bx + 1.2, 0, bz - 1.2, 0.5, 1.4, 0.4, '#5a6a7a');
      m.box(bx + 1.2, 1.4, bz - 1.2, 0.5, 0.4, 0.05, '#43e07a');
    }
    // a wall with a person-shaped hole in it, very slightly
    this.poi.wallGuy = { x: X - 8.1, z: Z + 2.5 };
    this.sign(['GET WELL SOON', '(PIZZA NOT INCLUDED)'], X + 2, 2.6, Z + 5.98, Math.PI, 3.4, 1.0, { bg: '#ffffff', stripe: '#d6232a' });
    this.poi.hospExit = { x: X + 7.4, z: Z };
    this.root.add(m.build({ cast: false }));
  }

  /* ---------------- per frame ---------------- */
  /** cut away hideout walls between the camera and the inside */
  cutaway(cam, inside, inBase) {
    this.hqRoof.visible = !inside;
    for (const w of this.hideWalls) {
      let show = true;
      if (inside && w.out) { const c = w.axis === 'x' ? cam.x : cam.z; show = w.out < 0 ? c > w.at - 0.3 : c < w.at + 0.3; }
      w.mesh.visible = show;
    }
    for (const w of this.baseWalls) {
      let show = true;
      if (inBase) { const c = w.axis === 'x' ? cam.x : cam.z; show = w.out < 0 ? c > w.at - 0.3 : c < w.at + 0.3; }
      w.mesh.visible = show;
    }
  }
}
