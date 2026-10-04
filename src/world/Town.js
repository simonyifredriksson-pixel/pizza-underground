/* Town.js - the whole town of Crumbville, generated in code.

   A grid of four streets each way (every street named after a pizza
   topping, from before the ban), with the town square in the middle, City
   Hall to the north of it, the hospital west, the police east, abandoned
   pizzerias south, houses all round, industry in the east, a forest along
   the north edge and mountains past that.

   Coordinates: x east, z south, y up. Roads run at +-40 and +-120. */
import * as THREE from '../../lib/three.module.js';
import { Mesher, signMesh, textTexture, vcMat, vcGlowMat, geo, part, mat, rot } from '../art/Mesher.js';
import { makeChar } from '../art/Chars.js';
import { makeCar, makeDumpster, MAFIA, bake, makeValuable, VALUABLES, OUTDOOR_VALUABLES, makeStation, makeItem } from '../art/Props.js';
import { GROCERY, EQUIPMENT, GENERAL, VEHICLES } from '../data/Data.js';
import { GEAR_ORDER } from '../data/BlackMarket.js';
import { makeHood, makeCuff, makeTrophy, makePolaroid } from '../art/Gear.js';
import { GANGS as RIVAL_LOOKS } from '../data/Rivals.js';
import { furnish } from './Interiors.js';
import { dealership, groceryFront, equipmentFront, furnitureFront, generalFront, loadingDock, shopDress, SHOPLIKE, polishMarket } from './Shops.js';
import { FURNITURE } from '../data/Data.js';
import { worldPass } from './World.js';
import { makeFurniture } from '../art/Furniture.js';
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
    this.biz = {};       // business name -> { x, z (outside the door), info.sign }
  }

  m(x, z) { // the Mesher for the chunk containing (x,z)
    const k = Math.floor((x + 280) / 140) + ',' + Math.floor((z + 280) / 140);
    let c = this.chunks.get(k); if (!c) this.chunks.set(k, c = new Mesher()); return c;
  }
  /** unlit (always bright): ceilings, so rooms never look like caves */
  mc(x, z) {
    const k = 'c' + Math.floor((x + 280) / 140) + ',' + Math.floor((z + 280) / 140);
    let c = this.chunks.get(k); if (!c) this.chunks.set(k, c = new Mesher(0.02)); c.noCast = true; c.unlit = true; return c;
  }
  /** same, but for things that must not cast shadows (roofs, ceilings, floors: so interiors are lit) */
  mn(x, z) {
    const k = 'n' + Math.floor((x + 280) / 140) + ',' + Math.floor((z + 280) / 140);
    let c = this.chunks.get(k); if (!c) this.chunks.set(k, c = new Mesher()); c.noCast = true; return c;
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
    for (const [bx, bz] of [[80, 80], [-160, 0], [-160, 80], [-80, 160], [80, 160], [-160, 160]]) this.residential(bx, bz);
    this.mall(-80, 80);
    this.mansion(-160, -80);
    this.industry();
    this.hideout();
    this.junkyard(160, 160);
    this.park(0, 160);
    this.forest();
    this.mountains();
    this.lampsAndProps();
    this.streetLife();
    worldPass(this);      // neighbourhoods, street props, the set pieces that move (World.js)
    this.prettify();
    this.hospitalRoom();
    this.storageRoom();
    this.bookshop(-79, -100);
    this.blackMarket();
    polishMarket(this, 800, 0, 34, 26, 5.2);   // rugs, brass, string lights, a chandelier, neon (Shops.js)
    this.rivalPlaces();
    for (const [, me] of this.chunks) this.root.add(me.build({ cast: !me.noCast, material: me.unlit ? vcGlowMat() : undefined }));
    // the edge of the world: invisible walls
    for (const s of [-1, 1]) { this.col.box(-230, s * 228, 230, s * 232, { h: 50 }); this.col.box(s * 228, -230, s * 232, 230, { h: 50 }); }
  }

  /* ---------------- ground and roads ---------------- */
  ground() {
    // big faceted grass sheet, with forest and park tints
    for (let x = -280; x < 280; x += 40) for (let z = -280; z < 280; z += 40) {
      const forest = z < -130 || Math.abs(x) > 205 || z > 205;
      const m = this.mn(x + 20, z + 20);
      m.flat(x, z, x + 40, z + 40, -0.05, forest ? C.forest : C.grass, 5, 0.09, 0.09);
    }
  }
  roads() {
    for (const r of ROADS) {
      for (let a = -EXT; a < EXT; a += 35) {
        const b = Math.min(EXT, a + 35);
        this.mn(r, (a + b) / 2).flat(r - RW / 2, a, r + RW / 2, b, 0.02, C.road, 6, 0.04);
        this.mn((a + b) / 2, r).flat(a, r - RW / 2, b, r + RW / 2, 0.025, C.road, 6, 0.04);
      }
      // dashed centre lines, white edge lines, manholes and patches - not across junctions
      for (let a = -EXT; a < EXT; a += 6) {
        if (ROADS.some(q => Math.abs(a + 1.5 - q) < RW / 2 + 1)) continue;
        this.mn(r, a).box(r, 0.02, a + 1.5, 0.3, 0.02, 3, C.line);
        this.mn(a, r).box(a + 1.5, 0.025, r, 3, 0.02, 0.3, C.line);
        for (const s of [-1, 1]) {
          this.mn(r, a).box(r + s * (RW / 2 - 0.5), 0.022, a + 3, 0.14, 0.02, 6, '#e8e2f2', 0, 0.02);
          this.mn(a, r).box(a + 3, 0.027, r + s * (RW / 2 - 0.5), 6, 0.02, 0.14, '#e8e2f2', 0, 0.02);
        }
        if (this.rand() < 0.12) this.mn(r, a).cyl(r + (this.rand() - 0.5) * 6, 0.025, a + 3, 0.45, 0.02, '#3a3048', 10);
        if (this.rand() < 0.08) this.mn(a, r).box(a + 3, 0.03, r + (this.rand() - 0.5) * 7, 1.5 + this.rand() * 2, 0.01, 1 + this.rand(), '#4e4470', this.rand(), 0.02);
      }
    }
    // sidewalks: a band round every block
    const edges = [-EXT, ...ROADS, EXT];
    for (let i = 0; i < edges.length - 1; i++) for (let j = 0; j < edges.length - 1; j++) {
      const x0 = edges[i] + (i ? RW / 2 : 0), x1 = edges[i + 1] - (i + 1 < edges.length - 1 ? RW / 2 : 0);
      const z0 = edges[j] + (j ? RW / 2 : 0), z1 = edges[j + 1] - (j + 1 < edges.length - 1 ? RW / 2 : 0);
      if (z1 < -125 && z0 < -150) continue; // the forest row has no sidewalks on its far side
      const w = 3;
      // paving slabs in two tones with a raised curb on the road side
      const sw = (a, b, c, d, side) => {
        const me = this.mn((a + c) / 2, (b + d) / 2), horiz = side === 'n' || side === 's';
        const n = Math.max(1, Math.round((horiz ? c - a : d - b) / 1.5));
        for (let k = 0; k < n; k++) {
          const t0 = k / n, t1 = (k + 1) / n;
          const xa = horiz ? a + (c - a) * t0 : a, xb = horiz ? a + (c - a) * t1 : c, za = horiz ? b : b + (d - b) * t0, zb = horiz ? d : b + (d - b) * t1;
          me.box((xa + xb) / 2, 0, (za + zb) / 2, xb - xa - 0.06, 0.07, zb - za - 0.06, k % 2 ? C.walk : '#e4daf2', 0, 0.03);
        }
        me.box((a + c) / 2, 0, (b + d) / 2, c - a, 0.05, d - b, '#a898c8', 0, 0.02); // grout under the slabs
        const cw = 0.22;
        if (side === 'n') me.box((a + c) / 2, 0, b + cw / 2, c - a, 0.13, cw, C.curb, 0, 0.02);
        if (side === 's') me.box((a + c) / 2, 0, d - cw / 2, c - a, 0.13, cw, C.curb, 0, 0.02);
        if (side === 'w') me.box(a + cw / 2, 0, (b + d) / 2, cw, 0.13, d - b, C.curb, 0, 0.02);
        if (side === 'e') me.box(c - cw / 2, 0, (b + d) / 2, cw, 0.13, d - b, C.curb, 0, 0.02);
      };
      if (j) sw(x0, z0, x1, z0 + w, 'n');
      if (j + 1 < edges.length - 1) sw(x0, z1 - w, x1, z1, 's');
      if (i) sw(x0, z0, x0 + w, z1, 'w');
      if (i + 1 < edges.length - 1) sw(x1 - w, z0, x1, z1, 'e');
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
    const mw = this.m(cx, cz);           // walls: cast shadows
    const m = this.mn(cx, cz);           // roof, ceiling, floor: don't (the inside stays lit)
    const [fx, fz] = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[front];
    const t = 0.3, gap = 2.0, ih = Math.min(h - 0.15, o.gable ? h : 4.4);
    const inner = o.inner || '#f2ecdf';
    const dress = !o.storefront && !o.boarded && o.sign && SHOPLIKE.has(o.kind);   // an ordinary shop: Shops.shopDress does the front
    if (dress) o = { ...o, storefront: true, flowers: false };
    // ---- the shell: four walls, the front one with a doorway ----
    const wallSeg = (x0, z0, x1, z1, y0 = 0, hh = h) => {
      mw.box((x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, hh, z1 - z0, color);
      if (y0 === 0) this.col.box(x0, z0, x1, z1, { h: hh + 2, tag: o.tag });
    };
    const innerSeg = (x0, z0, x1, z1) => m.box((x0 + x1) / 2, 0.07, (z0 + z1) / 2, x1 - x0, ih - 0.07, z1 - z0, inner);
    const X0 = cx - w / 2, X1 = cx + w / 2, Z0 = cz - d / 2, Z1 = cz + d / 2;
    (this.paved ||= []).push([X0 - 0.5, Z0 - 0.5, X1 + 0.5, Z1 + 0.5]);
    for (const s of ['n', 's', 'e', 'w']) {
      const isF = s === front;
      if (s === 'n' || s === 's') {
        const za = s === 'n' ? Z0 : Z1 - t, zb = za + t, zi = s === 'n' ? zb : za - 0.04;
        if (isF) {
          wallSeg(X0, za, cx - gap / 2, zb); wallSeg(cx + gap / 2, za, X1, zb); wallSeg(cx - gap / 2, za, cx + gap / 2, zb, 2.7, h - 2.7);
          innerSeg(X0 + t, zi, cx - gap / 2, zi + 0.04); innerSeg(cx + gap / 2, zi, X1 - t, zi + 0.04);
        } else { wallSeg(X0, za, X1, zb); innerSeg(X0 + t, zi, X1 - t, zi + 0.04); }
      } else {
        const xa = s === 'w' ? X0 : X1 - t, xb = xa + t, xi = s === 'w' ? xb : xa - 0.04;
        if (isF) {
          wallSeg(xa, Z0 + t, xb, cz - gap / 2); wallSeg(xa, cz + gap / 2, xb, Z1 - t); wallSeg(xa, cz - gap / 2, xb, cz + gap / 2, 2.7, h - 2.7);
          innerSeg(xi, Z0 + t, xi + 0.04, cz - gap / 2); innerSeg(xi, cz + gap / 2, xi + 0.04, Z1 - t);
        } else { wallSeg(xa, Z0 + t, xb, Z1 - t); innerSeg(xi, Z0 + t, xi + 0.04, Z1 - t); }
      }
    }
    // floor and ceiling
    m.flat(X0 + t, Z0 + t, X1 - t, Z1 - t, 0.07, o.floor || ['#c8a070', '#b8946a', '#d8c8b0', '#a8b8c8'][Math.floor(this.rand() * 4)], 2, 0.05);
    this.mc(cx, cz).box(cx, ih, cz, w - 2 * t, 0.12, d - 2 * t, o.ceiling || '#e6e0ec');
    if (h > ih + 0.5) m.box(cx, ih + 0.12, cz, w - 2 * t, h - ih - 0.12, d - 2 * t, color); // the floors above are not open
    // the inside
    const A = (fz ? w : d) / 2 - t, B = (fz ? d : w) / 2 - t;
    const info = furnish(this, o.kind || 'default', { cx, cz, f: [fx, fz], A, B, ih, m: mw, rand: this.rand, ...(o.extra || {}) }) || {};
    // the door, swung open into the room
    const hx = cx + fx * (fz ? 0 : w / 2 - t) + (fz ? gap / 2 - 0.05 : 0), hz = cz + fz * (fx ? 0 : d / 2 - t) + (fx ? gap / 2 - 0.05 : 0);
    mw.box(hx - fx * 0.85, 0.07, hz - fz * 0.85, fz ? 0.08 : 1.7, 2.5, fz ? 1.7 : 0.08, o.doorColor || C.door);
    m.box(hx - fx * 0.85 - (fz ? 0.06 : 0), 1.15, hz - fz * 0.85 - (fx ? 0.06 : 0), 0.08, 0.08, 0.08, '#c8a03a');
    m.box(cx + fx * (fz ? 0 : w / 2), 2.7, cz + fz * (fx ? 0 : d / 2), fx ? 0.4 : gap + 0.3, 0.2, fx ? gap + 0.3 : 0.4, C.trim); // lintel trim
    this.interiors = this.interiors || [];
    this.interiors.push({ cx, cz, w, d, front, kind: o.kind, info, ih });
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
        if (s === front && o.storefront && f * 3.2 < 3.6) continue;        // a storefront dresses its own front
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
        // and the same window from the inside: sky-blue glass in a frame
        if (y + 1.5 < ih) {
          const xi = cx + (nx ? nx * (w / 2 - t - 0.06) : t * len), zi = cz + (nz ? nz * (d / 2 - t - 0.06) : t * len);
          m.box(xi, y, zi, nx ? 0.05 : 1.4, 1.5, nx ? 1.4 : 0.05, '#bfe4ff', 0, 0.02);
          m.box(xi, y - 0.1, zi, nx ? 0.18 : 1.6, 0.1, nx ? 1.6 : 0.18, C.trim, 0, 0.02);
          m.box(xi, y, zi, nx ? 0.07 : 0.06, 1.5, nx ? 0.06 : 0.07, C.trim, 0, 0.02);
        }
      }
    }
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
      this.root.add(sg); info.sign = sg;
    }
    if (dress) shopDress(this, { cx, cz, w, d, h, front }, o);
    if (o.poster !== false && this.rand() < 0.6) this.poster(cx, cz, w, d, front);
    return { x: cx + fx * (w / 2 + 1.4), z: cz + fz * (d / 2 + 1.4), ry: { n: Math.PI, s: 0, e: Math.PI / 2, w: -Math.PI / 2 }[front], info };
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
    // before you know about the ban, the posters are just posters
    const N = [['LOST CAT', 'ANSWERS TO', '"MR. WHISKERS"'], ['YARD SALE', 'SATURDAY'], ['CRUMBVILLE', 'A NICE TOWN'], ['BAND NIGHT', 'IN THE PARK'], ['FREE HUGS?', 'NO.'], ['VOTE CRUMB', 'HE CARES'], ['GUITAR LESSONS', 'ASK FOR STEVE'], ['DOG WALKER', 'WANTED'], ['NEW: CRUMB MALL', 'NOW OPEN']];
    this.secret(sg, N[Math.floor(this.rand() * N.length)], { bg: '#fff6e0', stripe: ['#3a7bd5', '#43a85a', '#c84a8a'][Math.floor(this.rand() * 3)] });
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
  sign(lines, x, y, z, ry, w, h, o = {}) {
    const s = signMesh(lines, w, h, o); s.position.set(x, y, z); s.rotation.y = ry; this.root.add(s);
    if (o.before) this.secret(s, o.before, o);
    if (o.revealOnly) (this.revealOnly ||= []).push(s);
    return s;
  }
  /** a sign that says something innocent until you learn pizza is banned */
  secret(mesh, before, o = {}) {
    const img = mesh.material.map.image;
    const t = textTexture(before, { w: img.width, h: img.height, bg: o.bg, fg: o.fg, stripe: o.stripe, borderColor: o.borderColor });
    (this.secrets ||= []).push({ mesh, a: t, b: mesh.material.map });
  }
  /** swap every propaganda sign between its innocent and its real text */
  setReveal(on) {
    this.revealed = on;
    for (const s of this.secrets || []) { s.mesh.material.map = on ? s.b : s.a; s.mesh.material.needsUpdate = true; }
    for (const m of this.revealOnly || []) m.visible = on;
  }
  /** a billboard on two legs, readable from both sides */
  billboard(lines, x, z, ry, o = {}) {
    const m = this.m(x, z), c = Math.cos(ry), s = Math.sin(ry);
    for (const k of [-3, 3]) m.box(x + c * k, 0, z - s * k, 0.3, 5, 0.3, '#5a5a6a');
    m.boxc(x, 5.2, z, 8.4, 3.4, 0.3, '#3a3048', ry);
    this.sign(lines, x + s * 0.16, 5.2, z + c * 0.16, ry, 8, 3, o);
    this.sign(o.back || lines, x - s * 0.16, 5.2, z - c * 0.16, ry + Math.PI, 8, 3, { ...o, before: o.backBefore || o.before });
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
    (this.revealOnly ||= []).push(no);
    this.col.circle(cx, cz, 6.3, { h: 1 });
    this.sign(['MAYOR GORDON CRUMB', 'PROTECTOR OF CRUMBVILLE', 'PIZZA-FREE SINCE THIS MONTH'], cx, 1.9, cz + 1.62, 0, 2.6, 1.0, { bg: '#e8d8a8', fg: '#4a3a20', before: ['MAYOR GORDON CRUMB', 'PROTECTOR OF CRUMBVILLE', '(a very good mayor)'] });
    this.poi.statue = { x: cx, z: cz + 7.5 };
    // benches, planters, billboards
    for (let a = 0; a < 6; a++) { const t = a / 6 * Math.PI * 2 + 0.26; this.bench(cx + Math.sin(t) * 14, cz + Math.cos(t) * 14, t + Math.PI); }
    for (const [x, z] of [[-24, -24], [24, -24], [-24, 24], [24, 24]]) { m.box(cx + x, 0, cz + z, 3.4, 0.7, 3.4, '#c8c0da'); this.tree(cx + x, cz + z, 0.9, 'pink'); }
    this.billboard(['PIZZA IS ILLEGAL'], cx + 20, cz - 26, 0, { bg: '#fff6e0', stripe: '#d6232a', back: ['REPORT SUSPICIOUS', 'CHEESE ACTIVITY'], before: ['CRUMBVILLE', 'A NICE TOWN'], backBefore: ['VISIT THE NEW', 'CRUMB MALL!'] });
    this.billboard(['DO NOT', 'PURCHASE PIZZA'], cx - 20, cz + 26, Math.PI, { bg: '#ffe14a', stripe: '#2a1640', back: ['THANK YOU FOR', 'NOT HAVING PIZZA'], before: ['VOTE CRUMB', 'HE CARES'], backBefore: ['LOST CAT', 'ANSWERS TO "MR. WHISKERS"'] });
  }

  cityHall(cx, cz) {
    const m = this.m(cx, cz);
    const d = this.bldg(cx, cz - 4, 44, 26, 12, '#efe6d0', 's', { kind: 'hall', floor: '#e8e2f0', inner: '#f6f1e6', sign: ['CITY HALL'], signBg: '#efe6d0', lit: 0.5, poster: false });
    m.cyl(cx, 12.3, cz - 4, 7, 2, '#efe6d0', 12);
    m.add(geo.sph(12, 6), new THREE.Matrix4().compose(new THREE.Vector3(cx, 14.2, cz - 4), new THREE.Quaternion(), new THREE.Vector3(13, 9, 13)), '#e8c45a');
    m.cyl(cx, 18.5, cz - 4, 0.1, 3, '#666', 5);
    m.box(cx + 1, 20.3, cz - 4, 2, 1.2, 0.05, '#d6232a');
    for (let i = 0; i < 8; i++) { m.cyl(cx - 17.5 + i * 5, 0, cz + 10.5, 0.7, 11, '#ffffff', 8); this.col.circle(cx - 17.5 + i * 5, cz + 10.5, 0.7, { h: 11 }); }
    m.box(cx, 11, cz + 10.5, 40, 1.2, 2.6, '#efe6d0');
    for (let i = 0; i < 3; i++) m.box(cx, 0, cz + 11 + i * 1.2, 36, 0.5 - i * 0.15, 1.6, '#e0d8e8');
    this.sign(['PIZZA-FREE', 'SINCE THIS MONTH!'], cx - 14, 7.5, cz + 9.1, 0, 5, 2.4, { bg: '#ffe14a', stripe: '#d6232a', before: ['WELCOME TO', 'CITY HALL'] });
    this.sign(['THE PIZZA BAN', 'IS FOR YOUR OWN GOOD'], cx + 14, 7.5, cz + 9.1, 0, 5, 2.4, { bg: '#fff6e0', stripe: '#1e2a5a', before: ['PLEASE WIPE', 'YOUR FEET'] });
    this.poi.cityHallDoor = { x: cx, z: cz + 12.5 };
    this.poi.archive = { x: cx + 12, z: cz - 18.6 };
    m.box(cx + 12, 0, cz - 17.05, 2, 2.6, 0.2, '#3a3a44');
    this.sign(['ARCHIVE', 'STAFF ONLY'], cx + 12, 3.2, cz - 17.2, Math.PI, 2.2, 0.8, { bg: '#ffffff' });
    this.person({ skin: '#e0a57c', shirt: '#2a2a38', pants: '#2a2a38', hat: 'bald', glasses: 'sun', tie: '#111' }, cx + 15, cz - 19.5, Math.PI, 'archiveGuard');
  }

  hospital(cx, cz) {
    this.bldg(cx, cz + 2, 44, 26, 10, '#f6f6fa', 'n', { kind: 'hospital', floor: '#e0ecf0', inner: '#f6f6fa', sign: ['HOSPITAL'], signFg: '#d6232a', lit: 0.5, awning: '#d6232a', poster: false });
    const m = this.m(cx, cz);
    // red cross on the roof edge
    m.box(cx + 16, 7, cz - 11.2, 3.6, 1.2, 0.2, '#d6232a'); m.box(cx + 16, 5.8, cz - 11.2, 1.2, 3.6, 0.2, '#d6232a');
    this.poi.hospitalDoor = { x: cx, z: cz - 13.8, ry: Math.PI };
    this.car('van', cx + 12, cz - 20, Math.PI / 2);
    this.sign(['HOSPITAL', 'Now with 40% fewer', 'pizza-related injuries'], cx - 12, 1.6, cz - 21, Math.PI, 3.2, 1.6, { bg: '#ffffff', stripe: '#d6232a', before: ['HOSPITAL', 'Now with 40% fewer', 'hospital-related injuries'] });
    m.box(cx - 12, 0, cz - 20.9, 0.15, 0.8, 0.15, '#5a5a6a');
    // the records bin round the side
    m.box(cx + 24.5, 0, cz + 6, 1.6, 1.2, 1.2, '#4a6a9a');
    this.sign(['RECORDS', 'DO NOT READ'], cx + 25.32, 0.85, cz + 6, Math.PI / 2, 1.1, 0.6, { bg: '#ffffff' });
    this.col.boxc(cx + 24.5, cz + 6, 1.6, 1.2, { h: 1.2 });
    this.poi.clue_hospital = { x: cx + 26, z: cz + 6, y: 1.6 };
    for (let i = 0; i < 6; i++) this.bush(cx - 20 + i * 8, cz - 12.5, 0.8);
  }

  police(cx, cz) {
    const d = this.bldg(cx, cz - 2, 36, 24, 9, '#6f8fd8', 'n', { kind: 'police', floor: '#a8b8c8', inner: '#dfe6f0', sign: ['POLICE'], signBg: '#1e2a5a', signFg: '#ffffff', lit: 0.6 });
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
    this.billboard(['WANTED:', 'ANYONE WITH PIZZA'], cx - 22, cz + 26, Math.PI / 2, { bg: '#fff6e0', stripe: '#1e2a5a', before: ['POLICE: HERE', 'TO HELP (MOSTLY)'] });
  }

  gasStation(cx, cz) {
    const m = this.m(cx, cz);
    m.flat(cx - 31, cz - 4, cx + 14, cz + 31, 0.06, '#8a84a0', 4, 0.05);
    m.box(cx - 10, 5, cz + 18, 22, 0.8, 12, '#ffffff');
    m.box(cx - 10, 5.8, cz + 18, 22.4, 0.3, 12.4, '#d6232a');
    for (const [x, z] of [[-19, 13], [-1, 13], [-19, 23], [-1, 23]]) { m.box(cx + x, 0, cz + z, 0.5, 5, 0.5, '#e0e0ea'); this.col.circle(cx + x, cz + z, 0.35); }
    for (const x of [-15, -5]) { m.box(cx + x, 0, cz + 18, 1, 1.8, 0.7, '#d6232a'); m.box(cx + x, 1.8, cz + 18, 1.1, 0.4, 0.8, '#ffffff'); this.col.boxc(cx + x, cz + 18, 1, 0.7, { h: 2 }); }
    this.sign(['GAS'], cx - 10, 5.4, cz + 24.25, 0, 3, 0.7, { bg: '#d6232a', fg: '#ffffff', border: false });
    this.biz.gas = this.bldg(cx + 18, cz + 16, 18, 12, 4.5, '#ffe9a8', 's', { kind: 'store', floor: '#e0e0e8', sign: ["GAS 'N' SAD"], awning: '#3fa34d' });
    this.poi.tony = { x: cx + 22, z: cz + 6.5 };
    this.poi.clue_gas = { x: cx + 12, z: cz + 23.5, y: 1.0 };
    m.box(cx + 12, 0, cz + 23.2, 1.2, 1.0, 0.6, '#3a7bd5');
    this.sign(['NEWS'], cx + 12, 0.7, cz + 23.52, 0, 0.9, 0.35, { bg: '#ffffff' });
    this.dumpster(cx + 26, cz + 4);
    // honest hank's motors: showroom, service garage, the truck lot, the pick-up bay (Shops.js)
    dealership(this, cx, cz);
  }

  shops(cx, cz) {
    const front = cz + 24;
    this.biz.oleg = this.bldg(cx - 23, front, 18, 14, 7, '#8fc1e3', 's', { kind: 'appliance', floor: '#e0e0e8', sign: ["OLEG'S APPLIANCES"], awning: '#3a7bd5' });
    this.biz.mustache = this.bldg(cx, front, 18, 14, 6, '#f7a8c8', 's', { kind: 'mustache', inner: '#ffe0ee', sign: ['MUSTACHE', 'EMPORIUM'], awning: '#2a1640' });
    this.biz.shoes = this.bldg(cx + 23, front, 18, 14, 6.5, '#f7d26b', 's', { kind: 'shoes', inner: '#fff6d0', sign: ["SHOES 'R' SHOES"], awning: '#d6232a' });
    this.poi.oleg = { x: cx - 23, z: front + 8.4 };
    this.poi.mustache = { x: cx, z: front + 8.4 };
    this.poi.manSpot = { x: cx - 11.5, z: front + 1 };
    this.poi.bigCheese = { x: cx + 11.5, z: cz + 4 };
    // back lot: dumpsters, a laundromat, a tattoo parlour
    const m = this.m(cx, cz);
    m.flat(cx - 31, cz - 31, cx + 31, cz + 16, 0.06, '#9a94b0', 4, 0.05);
    this.dumpster(cx - 11.5, cz + 10);
    this.dumpster(cx + 15, cz + 8, Math.PI / 2);
    this.biz.laundry = this.bldg(cx - 18, cz - 20, 20, 12, 5, '#a8e0c0', 'n', { kind: 'laundry', floor: '#d8e8f0', sign: ['SPIN CYCLE', 'LAUNDROMAT'] });
    this.biz.tattoo = this.bldg(cx + 18, cz - 20, 16, 12, 5, '#3a3048', 'n', { kind: 'tattoo', floor: '#3a3048', inner: '#4a3a5a', sign: ['INK & REGRET'], signBg: '#2a1640', signFg: '#ff8fc8' });
  }

  pizzerias(cx, cz) {
    const front = cz - 22;
    const closed = { signBg: '#5a4a3a', signFg: '#ffd65a', boarded: true, lit: 0, poster: false };
    this.bldg(cx - 22, front, 18, 12, 5.5, '#c8a090', 'n', { ...closed, kind: 'oldpizza', floor: '#a89888', inner: '#d8c8b0', sign: ['SLICE SLICE BABY'] });
    this.bldg(cx, front, 18, 12, 6, '#b8a8c8', 'n', { ...closed, kind: 'oldpizza', floor: '#a89888', inner: '#d8c8b0', sign: ["MAMMA MIA'S"] });
    this.bldg(cx + 22, front, 18, 12, 5.5, '#a8b8a0', 'n', { ...closed, kind: 'oldpizza', floor: '#a89888', inner: '#d8c8b0', sign: ['CRUST FUND'] });
    for (const x of [-22, 0, 22]) {
      this.sign(['CLOSED BY ORDER', 'OF THE MAYOR'], cx + x + 4, 1.6, front - 6.12, Math.PI, 2.4, 1.1, { bg: '#ffe14a', stripe: '#2a1640', before: ['CLOSED', 'FOR RENOVATION'] });
      const m = this.m(cx + x, front);
      m.boxc(cx + x, 1.4, front - 6.2, 7, 0.25, 0.05, '#ffd23f', 0, 0, 0.18);
      m.boxc(cx + x, 1.4, front - 6.21, 7, 0.25, 0.05, '#ffd23f', 0, 0, -0.18);
    }
    // the bakery behind and doughboy doug
    this.bldg(cx, cz + 16, 22, 12, 5, '#ffe0c0', 's', { kind: 'bakery', sign: ['DOUGH-RE-MI', 'BAKERY (CLOSED)'], boarded: true });
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
        const door = this.bldg(x, z, 12, 10, 4, color, front, { kind: 'house', gable: 2.6, roof, lit: 0.4, poster: this.rand() < 0.3 });
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
        // the thing the family loves most (and the first thing a debt collector takes)
        const id = this.houses.length, vk = VALUABLES[(num * 7 + id) % VALUABLES.length];
        const vg = makeValuable(vk);
        if (OUTDOOR_VALUABLES.has(vk)) { vg.position.set(x - 2.8, 0.05, z + r * 8.1); vg.rotation.y = door.ry; }
        else { const p = door.info.valuableIn; vg.position.set(p.x, 0.07, p.z); vg.rotation.y = door.ry + Math.PI; }
        this.dyn.add(vg);
        this.houses.push({ id, num, street, addr: num + ' ' + street, x, z, door: { x: door.x, z: door.z }, ry: door.ry, color, valuable: vk, vgroup: vg });
      }
    }
  }

  mansion(cx, cz) {
    const d = this.bldg(cx, cz - 6, 28, 18, 9, '#f2b5d4', 's', { kind: 'mansion', floor: '#e8d8b0', inner: '#fff0f6', gable: 4, roof: '#c8a03a', trim: '#ffe9a8', sign: ['CRUMB MANOR'], signBg: '#ffe9a8', lit: 0.7, poster: false });
    const m = this.m(cx, cz);
    for (let i = 0; i < 4; i++) { m.cyl(cx - 9 + i * 6, 0, cz + 4.5, 0.6, 9, '#ffffff', 8); this.col.circle(cx - 9 + i * 6, cz + 4.5, 0.6, { h: 9 }); }
    this.fence(cx - 30, cz + 18, cx - 4, cz + 18, '#c8a03a', 2);
    this.fence(cx + 4, cz + 18, cx + 30, cz + 18, '#c8a03a', 2);
    this.sign(['PRIVATE PROPERTY', 'NO PIZZA. NO EXCEPTIONS.'], cx - 8, 1.4, cz + 18.12, 0, 3.4, 1.2, { bg: '#ffffff', stripe: '#d6232a', before: ['PRIVATE PROPERTY', 'NO SOLICITORS'] });
    m.box(cx + 6, 0, cz + 19.5, 0.14, 1.1, 0.14, '#6a5a4a'); m.box(cx + 6, 1.1, cz + 19.5, 0.6, 0.4, 0.8, '#c8a03a');
    this.poi.clue_mansion = { x: cx + 6, z: cz + 20.4, y: 1.4 };
    this.car('limo', cx + 18, cz + 8, 0);
    for (let i = 0; i < 6; i++) this.bush(cx - 25 + i * 10, cz + 15, 1);
    this.tree(cx - 26, cz - 24, 1.3, 'pink'); this.tree(cx + 26, cz - 24, 1.3, 'pink');
  }

  industry() {
    // east column: warehouses, a factory, sal ami's loading dock
    const wh = (x, z, w, d, h, c, front, sign) => this.bldg(x, z, w, d, h, c, front, { kind: 'warehouse', floor: '#9a9aaa', inner: '#c8c8d0', sign, gable: 1.2, roof: '#5a6070', lit: 0.1 });
    wh(150, -96, 30, 18, 8, '#9aa0b8', 'w', ['WAREHOUSE 2']);
    wh(178, -62, 18, 22, 7, '#b8a890', 'w', ['DEFINITELY NOT', 'A WAREHOUSE']);
    wh(148, -60, 14, 12, 6, '#8a90a8', 's', ['LOADING']);
    this.poi.sal = { x: 148, z: -51 };
    this.dumpster(158, -52);
    // the cardboard factory
    this.bldg(162, -2, 40, 28, 10, '#c8b090', 'w', { kind: 'factory', floor: '#9a9aaa', inner: '#d8d0c0', sign: ['CRUMBVILLE', 'CARDBOARD CO.'], lit: 0.2 });
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
    this.hideoutDecor(m);

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

  /** everything that makes the shoe shop look like a real (illegal) pizza kitchen */
  hideoutDecor(m) {
    const put = (g, x, y, z, ry = 0) => { g.position.set(x, y, z); g.rotation.y = ry; bake(m, g); };
    const steel = '#c8ccd8';
    // the sink by the door: cabinet, steel basin, tall faucet
    m.box(140.62, 0.08, 83.4, 0.75, 0.82, 1.1, '#f6f1e6'); m.box(140.62, 0.9, 83.4, 0.8, 0.06, 1.16, steel);
    m.box(140.66, 0.86, 83.4, 0.5, 0.08, 0.7, '#8a98a6'); m.box(140.35, 0.9, 83.4, 0.06, 0.55, 0.06, steel); m.box(140.5, 1.42, 83.4, 0.35, 0.05, 0.05, steel);
    this.col.boxc(140.62, 83.4, 0.8, 1.15, { h: 1 });
    this.sign(['EMPLOYEES MUST', 'WASH HANDS', '(AND EVIDENCE)'], 140.27, 2.2, 83.4, Math.PI / 2, 1.2, 0.7, { bg: '#ffffff', stripe: '#3a7bd5' });
    // wall shelves full of supplies above the stations
    for (const [z, x0, x1] of [[72.42, 142, 151.6], [87.58, 141.2, 151.4]]) {
      const s = z < 80 ? 1 : -1;
      m.box((x0 + x1) / 2, 2.35, z + s * 0.17, x1 - x0, 0.05, 0.36, '#a87c44');
      for (let x = x0 + 0.3; x < x1 - 0.2; x += 0.42) {
        const k = Math.floor(x * 7) % 4;
        if (k === 0) { m.cyl(x, 2.4, z + s * 0.17, 0.11, 0.28, '#d6232a', 8); m.cyl(x, 2.58, z + s * 0.17, 0.11, 0.04, '#c8c8d8', 8); }   // tomato cans
        else if (k === 1) m.box(x, 2.4, z + s * 0.17, 0.3, 0.38, 0.24, '#e8dcc0');  // flour
        else if (k === 2) { m.cyl(x, 2.4, z + s * 0.17, 0.09, 0.26, '#3fa34d', 6); m.cyl(x, 2.66, z + s * 0.17, 0.04, 0.1, '#2a5a2a', 5); } // olive oil
        else m.box(x, 2.4, z + s * 0.17, 0.32, 0.12, 0.3, '#c79a5b');   // boxes
      }
    }
    this.specialsBoard = this.sign(["TODAY'S SPECIALS", '(ALL ILLEGAL)', 'Margherita... $1,500', 'Pepperoni... $1,800'], 146.2, 3.4, 72.33, 0, 2.6, 1.2, { bg: '#1b1b24', fg: '#ffffff', borderColor: '#c8a070' });
    // police tape across the door (shown while the police have shut you down)
    this.hqTape = new THREE.Group();
    for (const r of [-0.45, 0.45]) { const t = part(geo.box(), '#ffd23f', 139.4, 1.5, 80, 0.04, 0.22, 3.6, { emissive: 0x806010, ei: 0.4 }); t.rotation.x = r; this.hqTape.add(t); }
    this.hqTape.add(this.sign(['POLICE LINE', 'DO NOT CROSS'], 139.35, 2.5, 80, -Math.PI / 2, 2, 0.6, { bg: '#ffd23f' }));
    this.hqTape.visible = false; this.root.add(this.hqTape);
    // a cloth over the stock fridge that says ONLY SHOES (shown while the ingredients are hidden)
    this.fridgeCover = new THREE.Group();
    this.fridgeCover.add(part(geo.box(), '#e8dcc0', 142.1, 1.1, 86.88, 1.4, 2.2, 0.06));
    this.fridgeCover.add(this.sign(['ONLY', 'SHOES'], 142.1, 1.4, 86.84, Math.PI, 1.0, 0.6, { bg: '#ffffff', fg: '#c84a5a' }));
    this.fridgeCover.visible = false; this.root.add(this.fridgeCover);
    // a clock on the partition
    m.box(151.74, 2.85, 84.5, 0.05, 0.7, 0.7, '#f6f1e6'); m.box(151.7, 3.15, 84.5, 0.02, 0.3, 0.04, '#2a1640'); m.box(151.7, 3.2, 84.6, 0.02, 0.04, 0.22, '#2a1640');
    // the crew table: rotary phone, walkie-talkies, a briefcase of cash, a money bag
    m.cyl(149.1, 0.08, 83.6, 0.06, 0.7, '#3a3048', 6); m.cyl(149.1, 0.78, 83.6, 0.6, 0.05, '#a87c44', 12);
    for (const [x, z] of [[148.2, 83.6], [150, 83.6]]) { m.cyl(x, 0.08, z, 0.05, 0.45, '#3a3048', 5); m.cyl(x, 0.53, z, 0.22, 0.06, '#d6232a', 8); }
    this.col.circle(149.1, 83.6, 0.6, { h: 0.85 });
    put(MAFIA.oldPhone(), 148.95, 0.83, 83.45, 0.4);
    put(MAFIA.walkie(), 149.4, 0.83, 83.85, 0.2); put(MAFIA.walkie(), 149.5, 0.83, 83.6, -0.3);
    put(MAFIA.briefcase(true), 151.2, 0.08, 86.3, -1.2);
    put(MAFIA.moneyBag(), 151.4, 0.08, 77.2); put(MAFIA.moneyBag(), 150.8, 0.08, 77.5, 1);
    const bat = MAFIA.bat(); bat.rotation.z = 0.15; put(bat, 151.65, 0.1, 87.55);
    // the front door, swung open; boarded windows seen from inside
    m.box(141.0, 0.08, 81.35, 1.7, 2.5, 0.08, '#5a3a2a'); m.box(140.3, 1.2, 81.25, 0.08, 0.08, 0.08, '#c8a03a');
    for (const wz of [75, 85]) { m.box(140.06, 1.0, wz, 0.04, 1.5, 1.6, '#2a2238'); for (const r of [-0.6, 0.6]) m.boxc(140.1, 1.75, wz, 0.06, 0.24, 2.0, '#b88a50', 0, r); }
    // the back room (level 2): fake delivery boxes, crates, a planning table
    put(MAFIA.crate('NOT PIZZA'), 162.9, 0.08, 87.2); put(MAFIA.crate('SHOES (NO)'), 162.9, 0.98, 87.2); put(MAFIA.crate('DEFINITELY SHOES'), 161.9, 0.08, 87.3, 0.1);
    this.col.boxc(162.4, 87.2, 2, 1, { h: 2 });
    m.box(155, 0.08, 81.8, 1.6, 0.72, 1.0, '#6a4a3a'); m.box(155, 0.8, 81.8, 1.7, 0.05, 1.1, '#a87c44'); this.col.boxc(155, 81.8, 1.7, 1.1, { h: 0.85 });
    m.box(155, 0.86, 81.8, 1.1, 0.01, 0.7, '#e8dcc0'); // a map of town, with "TARGETS" circled
    put(MAFIA.cashStack(), 154.6, 0.85, 81.6); put(MAFIA.oldPhone(), 155.5, 0.85, 82.0, -0.5);
    // the yard: a cellar hatch down to the hidden storage room
    m.box(136.6, 0.07, 65.6, 1.6, 0.08, 1.6, '#5a4a3a'); m.box(136.6, 0.15, 65.6, 1.4, 0.03, 0.1, '#3a2a1a');
    this.poi.storageHatch = { x: 136.6, z: 65.6 };
    this.sign(['NOTHING', 'DOWN HERE'], 136.6, 0.9, 64.6, 0, 1.1, 0.5, { bg: '#ffe14a' });
    m.box(136.6, 0, 64.62, 0.08, 0.7, 0.08, '#5a5a6a');
  }

  /** the hidden storage room: a separate set, reached by the yard hatch */
  storageRoom() {
    const X = 700, Z = 0, m = new Mesher(0.08);
    const W = 16, D = 12;
    m.flat(X - W / 2, Z - D / 2, X + W / 2, Z + D / 2, 0, '#8a8a9a', 2, 0.06);
    const wall = (x0, z0, x1, z1) => { m.box((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0, 4.5, z1 - z0, C.brick); for (let y = 0.6; y < 4.5; y += 0.6) m.box((x0 + x1) / 2, y, (z0 + z1) / 2, x1 - x0 + 0.02, 0.05, z1 - z0 + 0.02, C.brickDark, 0, 0.02); this.col.box(x0, z0, x1, z1, { h: 5 }); };
    wall(X - W / 2 - 0.4, Z - D / 2 - 0.4, X + W / 2 + 0.4, Z - D / 2); wall(X - W / 2 - 0.4, Z + D / 2, X + W / 2 + 0.4, Z + D / 2 + 0.4);
    wall(X - W / 2 - 0.4, Z - D / 2, X - W / 2, Z + D / 2); wall(X + W / 2, Z - D / 2, X + W / 2 + 0.4, Z + D / 2);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshBasicMaterial({ color: '#5a4a6a' }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(X, 4.5, Z); this.root.add(ceil);
    for (const x of [-4, 0, 4]) { m.box(X + x, 4.2, Z, 0.08, 0.3, 0.08, '#2a2238'); this.root.add(part(geo.ico(0), '#fff6c8', X + x, 4.0, Z, 0.35, 0.3, 0.35, { emissive: 0xfff2b0, ei: 1 })); }
    const put = (g, x, y, z, ry = 0) => { g.position.set(x, y, z); g.rotation.y = ry; bake(m, g); };
    // crates and fake delivery boxes along the left wall
    for (let i = 0; i < 6; i++) put(MAFIA.crate(['NOT PIZZA', 'SHOES', 'TOTALLY LEGAL', 'DO NOT OPEN', 'GRANDMA\'S', 'NOT PIZZA'][i]), X - W / 2 + 0.6, (i % 2) * 0.9, Z - 4 + Math.floor(i / 2) * 1.1, Math.PI / 2);
    this.col.boxc(X - W / 2 + 0.6, Z - 2.9, 1, 3.4, { h: 2 });
    for (let i = 0; i < 8; i++) m.box(X - W / 2 + 2, 0.02 + i * 0.13, Z + 4.6, 0.6, 0.12, 0.6, '#c79a5b');
    // the planning table: phones, walkie-talkies, a map, a lamp
    m.box(X, 0, Z + 1, 3, 0.75, 1.4, '#5a3a22'); m.box(X, 0.75, Z + 1, 3.1, 0.06, 1.5, '#a87c44'); this.col.boxc(X, Z + 1, 3.1, 1.5, { h: 0.85 });
    m.box(X, 0.82, Z + 1, 2, 0.01, 1.0, '#e8dcc0');
    put(MAFIA.oldPhone(), X - 1.1, 0.81, Z + 0.7, 0.5); put(MAFIA.walkie(), X + 1.0, 0.81, Z + 0.8); put(MAFIA.walkie(), X + 1.2, 0.81, Z + 1.2, 0.6); put(MAFIA.briefcase(true), X + 0.3, 0.81, Z + 1.4, 0.2);
    for (const [x, z] of [[-1.2, 0], [0, -0.2], [1.2, 0], [-1.2, 2.1], [1.2, 2.1]]) { m.box(X + x, 0, Z + 1 + (z - 1) * 1.1, 0.45, 0.45, 0.45, '#2b2b38'); }
    put(MAFIA.bat(), X + 2.2, 0, Z + 1.5);
    this.sign(['THE FAMILY BUSINESS', '(PIZZA)'], X, 3.2, Z - D / 2 + 0.05, 0, 4, 1.2, { bg: '#1b1b24', fg: '#ffd23f', borderColor: '#c8a03a' });
    this.sign(['CONFISCATED', '(UNTIL THEY PAY)'], X + 3.5, 3.3, Z + D / 2 - 0.05, Math.PI, 3.2, 0.9, { bg: '#ffe14a' });
    // the ladder out
    for (let i = 0; i < 8; i++) m.box(X + W / 2 - 0.5, 0.3 + i * 0.5, Z - 4.5, 0.06, 0.06, 0.8, '#8a8aa0');
    for (const s of [-1, 1]) m.box(X + W / 2 - 0.5, 0, Z - 4.5 + s * 0.4, 0.08, 4.5, 0.08, '#8a8aa0');
    // the Time-Out Chair: a comfy chair under one bare bulb
    const cx2 = X - 4.6, cz2 = Z + 2.2;
    m.box(cx2, 0, cz2, 0.9, 0.5, 0.9, '#c8323a'); m.box(cx2 - 0.4, 0.5, cz2, 0.12, 0.9, 0.9, '#c8323a');
    for (const s of [-1, 1]) m.box(cx2, 0.5, cz2 + s * 0.42, 0.9, 0.3, 0.1, '#a8222a');
    this.col.boxc(cx2, cz2, 0.9, 0.9, { h: 0.6 });
    // a little table with a spare hood, a spare pair of cuffs, and a very small sign
    m.box(cx2 + 2.2, 0, cz2 - 1.2, 0.7, 0.75, 0.6, '#5a3a22'); m.box(cx2 + 2.2, 0.75, cz2 - 1.2, 0.76, 0.04, 0.66, '#7a5236');
    this.col.boxc(cx2 + 2.2, cz2 - 1.2, 0.7, 0.6, { h: 0.8 });
    { const hd = makeHood(1); hd.position.set(cx2 + 2.1, 0.75, cz2 - 1.25); hd.rotation.y = 0.6; hd.scale.setScalar(0.8); bake(m, hd);
      const cf = makeCuff(); cf.position.set(cx2 + 2.4, 0.8, cz2 - 1.1); cf.rotation.x = Math.PI / 2; bake(m, cf); }
    this.sign(['(RENTAL HOOD)', '(PLEASE RETURN)'], cx2 + 2.2, 1.0, cz2 - 1.51, Math.PI, 0.7, 0.24, { bg: '#ffffff', fg: '#1b1b24', border: false });
    this.sign(['THE TIME-OUT', 'CHAIR'], cx2 - 0.9, 2.6, cz2, Math.PI / 2, 2.0, 0.7, { bg: '#ffe14a' });
    this.root.add(part(geo.ico(0), '#fff6c8', cx2 + 0.6, 2.8, cz2, 0.35, 0.3, 0.35, { emissive: 0xfff2b0, ei: 1 }));
    this.poi.storageChair = { x: cx2, z: cz2 };
    this.root.add(m.build({ cast: false }));
    this.poi.storageExit = { x: X + W / 2 - 1.3, z: Z - 4.5 };
    this.poi.storageIn = { x: X + W / 2 - 2, z: Z - 3 };
    this.poi.storageSafe = { x: X - 5, z: Z - D / 2 + 1 };
    this.poi.storageSlots = Array.from({ length: 8 }, (_, i) => ({ x: X - 0.5 + (i % 4) * 2, z: Z + 4.2 - Math.floor(i / 4) * 1.9 }));
    this.poi.storageBags = { x: X + 5, z: Z - 3.5 };
    this.poi.storage = { x0: X - W / 2, x1: X + W / 2, z0: Z - D / 2, z1: Z + D / 2 };
  }

  /* ---------------- Pages & Pages: a bookshop with a secret ----------------
     The back of the shop is a wall of bookshelves. One of them is a door:
     behind it a hidden room and stairs going down to the Underground Market.
     The secret shelf is its own mesh on a hinge (BlackMarket.js swings it). */
  bookshop(cx, cz) {
    const w = 14, d = 12, ih = 4.4;
    const door = this.bldg(cx, cz, w, d, 5.5, '#7a6a8a', 'n', { kind: 'books', floor: '#8a6a4a', inner: '#e8d8c0', sign: ['PAGES & PAGES', 'USED BOOKS (NO QUESTIONS)'], signBg: '#2a1a24', signFg: '#ffd23f', awning: '#3a2a4a', poster: false, lit: 0.6 });
    this.biz.books = door;
    const m = this.m(cx, cz), mn = this.mn(cx, cz);
    const zf = cz - d / 2 + 0.3, zb = cz + d / 2 - 0.3, x0 = cx - w / 2 + 0.3, x1 = cx + w / 2 - 0.3;
    const zp = zb - 2.6;                                   // the wall of shelves; the secret is behind it
    const ox0 = cx + 2.6, ox1 = cx + 4.2, ocx = (ox0 + ox1) / 2;  // the opening the secret shelf covers
    const WALL = '#e8d8c0', BOOK = ['#8a2a2a', '#2a4a8a', '#2a6a3a', '#c8a03a', '#6a2a6a', '#d8c8a0', '#3a3a48', '#a8542a', '#4a7a8a'];
    m.box((x0 + ox0) / 2, 0.07, zp, ox0 - x0, ih, 0.2, WALL); this.col.box(x0, zp - 0.1, ox0, zp + 0.1, { h: 5 });
    m.box((ox1 + x1) / 2, 0.07, zp, x1 - ox1, ih, 0.2, WALL); this.col.box(ox1, zp - 0.1, x1, zp + 0.1, { h: 5 });
    m.box(ocx, 2.6, zp, ox1 - ox0, ih - 2.53, 0.2, WALL);
    // one bookcase facing the shop (-z), its back at z: frame, shelves, and rows of spines
    const bookcase = (me, x, z, len, h = 2.5) => {
      me.box(x, 0.07, z - 0.2, len, h, 0.4, '#5a3a22');
      me.box(x, 0.07 + h, z - 0.2, len + 0.08, 0.08, 0.46, '#7a5236');
      for (let k = 0; k < 4; k++) {
        const y = 0.2 + k * 0.58;
        me.box(x, y - 0.04, z - 0.42, len, 0.04, 0.05, '#7a5236');
        let t = -len / 2 + 0.08;
        while (t < len / 2 - 0.14) {
          const bw = 0.07 + this.rand() * 0.08, bh = 0.32 + this.rand() * 0.16, lean = this.rand() < 0.08 ? 0.25 : 0;
          if (lean) me.boxc(x + t + bw / 2, y + bh / 2, z - 0.41, bw, bh, 0.03, BOOK[Math.floor(this.rand() * BOOK.length)], 0, 0, lean);
          else me.box(x + t + bw / 2, y, z - 0.41, bw, bh, 0.03, BOOK[Math.floor(this.rand() * BOOK.length)]);
          t += bw + 0.012 + (this.rand() < 0.1 ? 0.12 : 0);
        }
      }
    };
    for (let x = ox0 - 0.8; x > x0 + 0.7; x -= 1.6) { bookcase(m, x, zp - 0.1, 1.56); this.col.box(x - 0.8, zp - 0.55, x + 0.8, zp - 0.1, { h: 3 }); }
    bookcase(m, (ox1 + x1) / 2, zp - 0.1, x1 - ox1 - 0.04); this.col.box(ox1, zp - 0.55, x1, zp - 0.1, { h: 3 });
    this.sign(['FICTION', '(ALL OF IT)'], cx - 3, 2.95, zp - 0.12, Math.PI, 1.6, 0.5, { bg: '#f6f1e6', fg: '#2a1640' });
    this.sign(['HISTORY'], cx + 0.2, 2.95, zp - 0.12, Math.PI, 1.3, 0.4, { bg: '#f6f1e6', fg: '#2a1640' });
    this.sign(['MYSTERY'], ocx, 2.95, zp - 0.12, Math.PI, 1.3, 0.4, { bg: '#f6f1e6', fg: '#2a1640' });

    // the secret shelf: the same bookcase, on a hinge at its back right corner
    const pivot = new THREE.Group(); pivot.position.set(ox1, 0, zp + 0.1); this.root.add(pivot);
    const sm = new Mesher(0.04);
    const len = ox1 - ox0;
    sm.box(-len / 2, 0.07, -0.3, len, 2.5, 0.56, '#5a3a22');
    sm.box(-len / 2, 2.57, -0.3, len + 0.08, 0.08, 0.6, '#7a5236');
    for (let k = 0; k < 4; k++) {
      const y = 0.2 + k * 0.58;
      sm.box(-len / 2, y - 0.04, -0.62, len, 0.04, 0.05, '#7a5236');
      let t = -len + 0.08;
      while (t < -0.14) {
        const bw = 0.07 + this.rand() * 0.08, bh = 0.32 + this.rand() * 0.16;
        if (!(k === 2 && t > -0.75 && t < -0.55)) sm.box(t + bw / 2, y, -0.61, bw, bh, 0.03, BOOK[Math.floor(this.rand() * BOOK.length)]);
        t += bw + 0.012;
      }
    }
    sm.box(-len / 2, 0.07, 0.0, len, 2.5, 0.04, '#3a2a1a');           // the back: plain boards and a cobweb
    pivot.add(sm.build({ cast: true }));
    // the red book you pull
    const book = new THREE.Group(); book.position.set(-0.65, 0.2 + 2 * 0.58, -0.6); pivot.add(book);
    book.add(part(geo.box(), '#d6232a', 0, 0.22, 0, 0.13, 0.44, 0.06));
    book.add(part(geo.box(), '#ffd23f', 0, 0.3, 0.032, 0.09, 0.03, 0.005));
    const shelfCol = this.col.box(ox0, zp - 0.45, ox1, zp + 0.1, { h: 3 });

    // the hidden room behind: dark panelling, dusty boards, one bulb, stairs going down into the dark
    mn.box(cx, 0.075, (zp + zb) / 2, w - 0.7, 0.02, zb - zp - 0.1, '#5a4030', 0, 0.06);
    m.box(cx, 0.07, zb - 0.04, w - 0.62, ih, 0.06, '#3a2a30');                                   // back wall
    m.box((x0 + ox0) / 2, 0.07, zp + 0.13, ox0 - x0, ih, 0.04, '#3a2a30');                         // the back of the shelf wall
    m.box((ox1 + x1) / 2, 0.07, zp + 0.13, x1 - ox1, ih, 0.04, '#3a2a30');
    for (const x of [x0 + 0.03, x1 - 0.03]) m.box(x, 0.07, (zp + zb) / 2, 0.06, ih, zb - zp, '#3a2a30');
    mn.box(cx, ih - 0.06, (zp + zb) / 2, w - 0.62, 0.05, zb - zp - 0.05, '#241a22');             // a low dark ceiling
    for (let i = 0; i < 6; i++) m.box(x0 + 1.5 + i * 2.1, 0.07, zb - 0.09, 0.12, ih - 0.1, 0.04, '#2a1e24'); // battens
    const sx1 = ox0 - 0.25, sx0 = sx1 - 4.6, sz0 = zp + 0.35, sz1 = zb - 0.12, smz = (sz0 + sz1) / 2;
    for (let i = 0; i < 9; i++) {
      const c = new THREE.Color('#8a6a4a').lerp(new THREE.Color('#0b0808'), i / 8);
      mn.box(sx1 - 0.25 - i * 0.5, 0.098, smz, 0.5, 0.012, sz1 - sz0, '#' + c.getHexString(), 0, 0.02);
      mn.box(sx1 - 0.5 - i * 0.5, 0.098, smz, 0.03, 0.016, sz1 - sz0, '#0b0808', 0, 0);   // the edge of each step
    }
    for (const z of [sz0, sz1]) {
      m.boxc((sx0 + sx1) / 2, 0.62, z, 4.7, 0.06, 0.06, '#8a8aa0', 0, 0, 0.17);           // handrails sloping down
      for (let i = 0; i < 4; i++) { const x = sx1 - 0.2 - i * 1.4, top = 1.02 - i * 0.26; m.box(x, 0.07, z, 0.05, top, 0.05, '#8a8aa0'); }
    }
    this.root.add(part(geo.box(), '#ff9a3a', sx0 + 0.3, 0.085, smz, 0.6, 0.01, sz1 - sz0 - 0.1, { emissive: 0xff7a20, ei: 1.3 })); // warm light from below
    this.col.box(sx0 - 0.2, sz0 - 0.1, sx1 + 0.05, sz1 + 0.1, { h: 1.2 });
    // right opposite the secret shelf: the first thing you see when it swings open
    this.sign(['UNDERGROUND MARKET', '<<< DOWNSTAIRS'], ocx - 0.2, 2.1, zb - 0.1, Math.PI, 2.4, 0.75, { bg: '#ff3a8a', fg: '#ffffff', border: false });
    {
      const lx = ocx - 0.4, lz = (zp + zb) / 2, add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide };
      m.box(lx, ih - 0.45, lz, 0.03, 0.4, 0.03, '#1b1b24');
      this.root.add(part(geo.ico(0), '#fff1c0', lx, ih - 0.6, lz, 0.2, 0.22, 0.2, { emissive: 0xffd890, ei: 1.4 }));
      const b = new THREE.Mesh(new THREE.ConeGeometry(1.3, ih - 0.6, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#ffcc66', opacity: 0.06, ...add }));
      b.position.set(lx, (ih - 0.6) / 2, lz); this.root.add(b);
      const p = new THREE.Mesh(new THREE.CircleGeometry(1.25, 16), new THREE.MeshBasicMaterial({ color: '#ffb84a', opacity: 0.18, ...add }));
      p.rotation.x = -Math.PI / 2; p.position.set(lx, 0.11, lz); this.root.add(p);
    }
    this.sign(['STAFF ONLY', '(VERY STAFF)'], cx - 5, 2.0, zb - 0.06, Math.PI, 1.6, 0.6, { bg: '#ffe14a', fg: '#2a1640' });
    m.box(cx, ih - 0.6, (zp + zb) / 2, 0.03, 0.6, 0.03, '#1b1b24');
    this.root.add(part(geo.ico(0), '#fff1c0', cx, ih - 0.75, (zp + zb) / 2, 0.22, 0.24, 0.22, { emissive: 0xffd890, ei: 1.2 }));
    for (let i = 0; i < 3; i++) put3(this, MAFIA.crate(['BOOKS', 'MORE BOOKS', '"BOOKS"'][i]), x0 + 0.6, (i % 2) * 0.88, zp + 0.9 + Math.floor(i / 2) * 0.95, Math.PI / 2);
    this.col.box(x0, zp + 0.3, x0 + 1.2, zp + 2.2, { h: 2 });
    for (const [x, s] of [[x0 + 0.1, 1], [x1 - 0.1, -1]]) m.boxc(x + s * 0.3, ih - 0.3, zb - 0.3, 0.8, 0.02, 0.8, '#d8d8e0', 0, 0.6, s * 0.6); // cobwebs

    this.poi.books = {
      door, shelf: { pivot, book, col: shelfCol }, zp, ocx,
      vito: { x: cx - 5.9, z: zf + 3.3 },
      vitoPath: [{ x: cx - 5.9, z: zf + 5.0 }, { x: cx - 4.0, z: zp - 1.15 }, { x: ocx, z: zp - 1.15 }],
      stairs: { x: sx1 + 0.2, z: smz }, landing: { x: ocx, z: zp + 1.2 },
      cam1: { x: cx - 4.4, y: 1.95, z: zf + 3.3 }, cam2: { x: cx + 0.8, y: 2.3, z: zp - 3.6 },
    };

    function put3(T, g, x, y, z, ry) { g.position.set(x, y, z); g.rotation.y = ry; bake(T.m(x, z), g); }
  }

  /* ---------------- the Underground Market ----------------
     A big dim cellar off the map: crates, shelves of jars, cash, a cork
     board of secret documents, glass cases, a cheese wheel with teeth, a
     machine nobody understands, a VIP room behind a bead curtain, a steel
     door nobody opens, the broker's counter and twelve tables of gear. */
  blackMarket() {
    const X = 800, Z = 0, W = 34, D = 26, H = 5.2, m = new Mesher(0.06);
    const X0 = X - W / 2, X1 = X + W / 2, Z0 = Z - D / 2, Z1 = Z + D / 2;
    const BRICK = '#4a3448', MORTAR = '#38283a';
    // floor tiles, walls with a wood wainscot, the ceiling and its pipes
    for (let x = X0; x < X1; x += 2) for (let z = Z0; z < Z1; z += 2) m.box(x + 1, 0, z + 1, 1.98, 0.06, 1.98, ((x + z) / 2) % 2 ? '#3a3040' : '#2e2636', 0, 0.08);
    const wall = (x0, z0, x1, z1) => {
      m.box((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0, H, z1 - z0, BRICK);
      for (let y = 1.4; y < H; y += 0.5) m.box((x0 + x1) / 2, y, (z0 + z1) / 2, x1 - x0 + 0.03, 0.05, z1 - z0 + 0.03, MORTAR, 0, 0.02);
      this.col.box(x0, z0, x1, z1, { h: 6 });
    };
    wall(X0 - 0.4, Z0 - 0.4, X1 + 0.4, Z0); wall(X0 - 0.4, Z1, X1 + 0.4, Z1 + 0.4); wall(X0 - 0.4, Z0, X0, Z1); wall(X1, Z0, X1 + 0.4, Z1);
    m.box(X, 0, Z0 + 0.06, W, 1.1, 0.12, '#4a3020'); m.box(X, 0, Z1 - 0.06, W, 1.1, 0.12, '#4a3020');
    m.box(X0 + 0.06, 0, Z, 0.12, 1.1, D, '#4a3020'); m.box(X1 - 0.06, 0, Z, 0.12, 1.1, D, '#4a3020');
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshBasicMaterial({ color: '#140f1a' }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(X, H, Z); this.root.add(ceil);
    for (const z of [-8, 2, 9]) m.boxc(X, H - 0.35, z, W, 0.22, 0.22, '#5a5a6a', 0, 0, 0);
    for (const x of [790, 806]) m.boxc(x, H - 0.6, Z, 0.16, 0.16, D, '#7a5a3a', 0, 0, 0);
    const put = (g, x, y, z, ry = 0, s = 1) => { g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(s); bake(m, g); };
    const lamp = (x, z, y = 3.6, beam = 2.2) => {
      m.box(x, y + 0.25, z, 0.03, H - y - 0.25, 0.03, '#1b1b24');
      m.cone(x, y, z, 0.45, 0.35, '#2f5a3a', 8);
      this.root.add(part(geo.ico(0), '#fff1c0', x, y - 0.04, z, 0.22, 0.22, 0.22, { emissive: 0xffd890, ei: 1.5 }));
      const add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide };
      const b = new THREE.Mesh(new THREE.ConeGeometry(beam, y, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#ffcc66', opacity: 0.05, ...add }));
      b.position.set(x, y / 2, z); this.root.add(b);
      const p = new THREE.Mesh(new THREE.CircleGeometry(beam * 1.05, 18), new THREE.MeshBasicMaterial({ color: '#ffb84a', opacity: 0.16, ...add }));
      p.rotation.x = -Math.PI / 2; p.position.set(x, 0.08, z); this.root.add(p);
    };

    // the stairs down from the bookshop (north-east corner)
    for (let i = 0; i < 9; i++) { m.box(X1 - 5.2 + i * 0.55, 0, Z0 + 1.4, 0.56, 0.5 + i * 0.5, 2.6, i % 2 ? '#5a4030' : '#4a3424'); }
    this.col.box(X1 - 5.5, Z0, X1, Z0 + 2.8, { h: 6 });
    m.boxc(X1 - 2.9, 2.6, Z0 + 2.75, 5.2, 0.07, 0.07, '#8a8aa0', 0, 0, 0.75);
    this.sign(['EXIT', '(UP TO THE BOOKS)'], X1 - 6.0, 2.4, Z0 + 1.4, -Math.PI / 2, 1.5, 0.6, { bg: '#43e07a', fg: '#1b1b24', border: false });

    // the broker's counter, north wall: cash, a register, a bell, a neon sign
    const bx = X - 2, bz = Z0 + 3.4;
    m.box(bx, 0, bz, 7, 1.0, 1.0, '#3a2418'); m.box(bx, 1.0, bz, 7.2, 0.08, 1.15, '#7a5236');
    this.col.box(bx - 3.6, bz - 0.6, bx + 3.6, bz + 0.6, { h: 1.1 });
    m.box(bx - 2.4, 1.08, bz, 0.6, 0.35, 0.45, '#2b2b33'); m.box(bx - 2.4, 1.43, bz - 0.1, 0.5, 0.18, 0.12, '#3a3a48');
    for (let i = 0; i < 7; i++) m.box(bx + 0.4 + (i % 4) * 0.36, 1.08 + Math.floor(i / 4) * 0.13, bz + 0.1 - (i % 2) * 0.15, 0.32, 0.12, 0.16, '#3f9a52');
    m.cyl(bx + 2.6, 1.08, bz + 0.2, 0.1, 0.06, '#e8b83a', 8); m.ico(bx + 2.6, 1.17, bz + 0.2, 0.08, 0.06, 0.08, '#e8b83a');
    this.sign(['THE UNDERGROUND MARKET'], bx, 3.7, Z0 + 0.06, 0, 6, 0.9, { bg: '#1b1b24', fg: '#ff3a8a', borderColor: '#ff3a8a' });
    this.sign(['NO REFUNDS', 'NO RECEIPTS', 'NO QUESTIONS'], bx + 4.6, 2.4, Z0 + 0.06, 0, 1.8, 0.9, { bg: '#ffe14a', fg: '#1b1b24' });
    for (let i = 0; i < 4; i++) put(MAFIA.moneyBag(), bx - 4.6 + (i % 2) * 0.7, Math.floor(i / 2) * 0.7, Z0 + 1.0 + (i % 2) * 0.3, i);
    // a pallet of cash bricks
    m.box(bx + 5.6, 0, Z0 + 1.2, 1.6, 0.14, 1.2, '#a87c44');
    for (let i = 0; i < 18; i++) m.box(bx + 5.0 + (i % 3) * 0.5, 0.14 + Math.floor(i / 6) * 0.22, Z0 + 0.85 + Math.floor((i % 6) / 3) * 0.55, 0.46, 0.2, 0.5, i % 2 ? '#3f9a52' : '#4aa85e');
    this.col.box(bx + 4.7, Z0 + 0.5, bx + 6.5, Z0 + 1.9, { h: 1 });

    // twelve tables of gear in two rows facing the middle aisle
    this.poi.marketTables = [];
    const shop = (it) => (this.shopItems = this.shopItems || []).push(it);
    for (let i = 0; i < 12; i++) {
      const row = i < 6 ? -1 : 1, x = X - 12.5 + (i % 6) * 5, z = Z + row * 3.6;
      m.box(x, 0, z, 1.7, 0.82, 1.0, '#5a3a22');
      m.box(x, 0.82, z, 1.8, 0.05, 1.1, '#8a1a2a');                       // red velvet
      m.box(x, 0.4, z - row * 0.5, 1.8, 0.44, 0.03, '#8a1a2a');            // the cloth hanging down the front
      m.cyl(x, 0.87, z, 0.38, 0.06, '#c8a03a', 12);                      // a little turntable
      this.col.boxc(x, z, 1.8, 1.1, { h: 1 });
      this.poi.marketTables.push({ x, z, y: 0.93, ry: row < 0 ? 0 : Math.PI, i });
      shop({ cat: 'bm', key: GEAR_ORDER[i], x, z: z - row * 1.4 });
    }
    // lamps over the tables, the counter, the corners
    for (const x of [789, 800, 811]) for (const z of [-3.6, 3.6]) lamp(x, z);
    lamp(bx, bz, 3.4, 1.8); lamp(X + 1, Z1 - 3, 3.4, 2.0);

    // west wall: suspicious shelves of jars and boxes with question marks
    for (let s = 0; s < 3; s++) {
      const z = Z0 + 4 + s * 3.2;
      m.box(X0 + 0.45, 0, z, 0.8, 2.6, 2.8, '#3a2418');
      for (let k = 0; k < 4; k++) {
        const y = 0.25 + k * 0.6;
        m.box(X0 + 0.5, y - 0.04, z, 0.82, 0.04, 2.8, '#6a4a2a');
        for (let j = 0; j < 5; j++) {
          const jz = z - 1.1 + j * 0.55, c = ['#8a4ac8', '#43a85a', '#d6232a', '#ffd23f', '#43c0ff'][(s + k + j) % 5];
          if ((j + k) % 3) { m.cyl(X0 + 0.7, y, jz, 0.13, 0.34, c, 8); m.cyl(X0 + 0.7, y + 0.34, jz, 0.1, 0.05, '#c8c8d8', 8); }
          else m.box(X0 + 0.7, y, jz, 0.3, 0.3, 0.38, '#c79a5b');
        }
      }
      this.col.box(X0, z - 1.4, X0 + 0.9, z + 1.4, { h: 3 });
    }
    this.sign(['PICKLED', '???'], X0 + 0.92, 2.95, Z0 + 4, Math.PI / 2, 1.2, 0.5, { bg: '#f6f1e6', fg: '#2a1640' });
    // crates, stacked, south-east corner and by the stairs
    const crate = (label, x, y, z, ry) => put(MAFIA.crate(label), x, y, z, ry);
    const L = ['FOAM', 'RUBBER CHICKENS', 'NOT CONTRABAND', 'DEFINITELY BOOKS', 'FRAGILE (BONK)', 'MUSTACHES', 'PARTY FOG', 'EMPTY BOXES'];
    for (let i = 0; i < 8; i++) crate(L[i], X1 - 1.2 - (i % 3) * 1.15, Math.floor(i / 3) * 0.9, Z1 - 1.0 - (i % 2) * 1.1, (i % 2) * 0.2);
    this.col.box(X1 - 4.0, Z1 - 2.2, X1, Z1, { h: 3 });
    for (let i = 0; i < 4; i++) crate(L[(i + 3) % 8], X1 - 1.1, (i % 2) * 0.9, Z0 + 4.2 + Math.floor(i / 2) * 1.1, Math.PI / 2);
    this.col.box(X1 - 1.8, Z0 + 3.6, X1, Z0 + 6.0, { h: 2 });

    // east wall: three locked glass cases (a trophy, a diamond, a golden slice)
    for (let k = 0; k < 3; k++) {
      const z = Z - 2.5 + k * 3.3, x = X1 - 0.8;
      m.box(x, 0, z, 1.0, 0.9, 1.4, '#2b2b38'); m.box(x, 2.3, z, 1.05, 0.08, 1.45, '#2b2b38');
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.box(x + a * 0.48, 0.9, z + b * 0.66, 0.05, 1.4, 0.05, '#c8a03a');
      const glass = part(geo.box(), '#bfe4ff', x, 1.6, z, 0.98, 1.38, 1.38, { opacity: 0.18, rough: 0.05 }); glass.castShadow = false; this.root.add(glass);
      m.box(x - 0.55, 0.62, z, 0.06, 0.2, 0.16, '#e8b83a'); m.box(x - 0.55, 0.78, z, 0.04, 0.08, 0.1, '#c8c8d8'); // the padlock
      if (k === 0) { m.cyl(x, 0.9, z, 0.18, 0.1, '#e8b83a', 8); m.cyl(x, 1.0, z, 0.05, 0.35, '#e8b83a', 6); m.cone(x, 1.35, z, 0.22, 0.4, '#e8b83a', 8); }
      if (k === 1) m.ico(x, 1.4, z, 0.45, 0.55, 0.45, '#7ae8ff', 0, 0.5, 0.15);
      if (k === 2) { m.boxc(x, 1.15, z, 0.1, 0.05, 0.7, '#e8b83a', 0, 0, 0); m.cone(x, 1.12, z, 0.38, 0.06, '#ffd23f', 3); }
      this.col.box(x - 0.55, z - 0.75, x + 0.55, z + 0.75, { h: 2.4 });
    }
    this.sign(['WORLD\'S OK-EST', 'MOBSTER'], X1 - 0.06, 2.75, Z - 2.5, -Math.PI / 2, 1.3, 0.45, { bg: '#e8b83a', fg: '#1b1b24', border: false });
    this.sign(['DO NOT TOUCH', '(IT KNOWS)'], X1 - 0.06, 2.75, Z + 0.8, -Math.PI / 2, 1.3, 0.45, { bg: '#ffffff', fg: '#d6232a', border: false });
    // a steel door nobody opens
    m.box(X1 - 0.1, 0, Z + 7.8, 0.2, 2.6, 1.6, '#6a6a7a'); m.box(X1 - 0.2, 1.2, Z + 7.3, 0.06, 0.12, 0.2, '#c8c8d8');
    m.box(X1 - 0.22, 1.9, Z + 7.8, 0.02, 0.12, 0.4, '#1b1b24');
    this.sign(['DO NOT LOOK IN', 'THE BACK ROOM'], X1 - 0.06, 3.0, Z + 7.8, -Math.PI / 2, 1.6, 0.6, { bg: '#d6232a', fg: '#ffffff', border: false });

    // the cork board of secret documents and red string, south wall
    const cbx = X + 2, cbz = Z1 - 0.08;
    m.box(cbx, 1.3, cbz, 4.2, 2.0, 0.06, '#c8955a');
    const pins = [[-1.6, 2.7], [-0.4, 2.1], [0.9, 2.8], [1.6, 1.8], [-1.2, 1.6], [0.2, 1.55]];
    for (const [i, [px, py]] of pins.entries()) { m.box(cbx + px, py - 0.25, cbz - 0.05, 0.45, 0.55, 0.01, i % 2 ? '#f6f1e6' : '#fff6c8'); m.ico(cbx + px, py + 0.24, cbz - 0.07, 0.05, 0.05, 0.03, '#d6232a'); }
    for (let i = 0; i < pins.length; i++) {
      const [ax, ay] = pins[i], [bxx, by] = pins[(i + 2) % pins.length], len = Math.hypot(bxx - ax, by - ay);
      m.boxc(cbx + (ax + bxx) / 2, (ay + by) / 2 + 0.24, cbz - 0.08, len, 0.02, 0.01, '#d6232a', 0, 0, Math.atan2(by - ay, bxx - ax));
    }
    this.sign(['WHO ATE', 'THE MAYOR\'S', 'SANDWICH?'], cbx, 3.55, cbz - 0.02, Math.PI, 1.8, 0.7, { bg: '#1b1b24', fg: '#ffe14a', border: false });
    // a table of secret paperwork
    m.box(X + 2, 0, Z1 - 2.4, 2.2, 0.76, 1.0, '#5a3a22'); this.col.boxc(X + 2, Z1 - 2.4, 2.2, 1.0, { h: 0.8 });
    for (let i = 0; i < 4; i++) m.box(X + 1.3 + i * 0.5, 0.76, Z1 - 2.4 + (i % 2) * 0.15, 0.42, 0.06 + i * 0.05, 0.55, '#f6f1e6');
    const stamp = signMesh(['TOP', 'SECRET'], 0.42, 0.3, { bg: '#ffffff', fg: '#d6232a', borderColor: '#d6232a' }); stamp.rotation.x = -Math.PI / 2; stamp.position.set(X + 2.8, 0.97, Z1 - 2.25); this.root.add(stamp);

    // strange equipment: the DOUGH-TRON 3000, and the cheese wheel that bites
    const dx = X - 6, dz = Z1 - 2.2;
    m.box(dx, 0, dz, 2.4, 2.2, 1.4, '#7a8a9a'); m.box(dx, 2.2, dz, 1.6, 0.4, 1.0, '#5a6a7a');
    m.cone(dx + 0.6, 2.6, dz, 0.4, 0.6, '#c8c8d8', 8); m.cyl(dx - 0.7, 2.2, dz, 0.15, 1.6, '#c8c8d8', 6);
    m.boxc(dx - 0.2, 3.8, dz, 1.1, 0.12, 0.12, '#c8c8d8', 0, 0, 0);
    for (let i = 0; i < 4; i++) m.cyl(dx - 0.8 + i * 0.5, 1.5, dz - 0.72, 0.13, 0.05, ['#ffd23f', '#ff8fc8', '#43c0ff', '#43e07a'][i], 8);
    for (let i = 0; i < 3; i++) this.root.add(part(geo.box(), ['#ff3a3a', '#43e07a', '#ffd23f'][i], dx - 0.6 + i * 0.6, 1.05, dz - 0.71, 0.18, 0.12, 0.03, { emissive: [0xff2020, 0x20ff60, 0xffd020][i], ei: 1 }));
    this.col.boxc(dx, dz, 2.4, 1.4, { h: 3 });
    this.sign(['DOUGH-TRON 3000', '(DO NOT ASK)'], dx, 1.95, dz - 0.72, Math.PI, 1.8, 0.45, { bg: '#1b1b24', fg: '#43e07a', border: false });
    const cw = { x: X - 2, z: Z1 - 2.5 };
    m.cyl(cw.x, 0, cw.z, 0.9, 0.6, '#5a4a6a', 12);
    m.cyl(cw.x, 0.6, cw.z, 0.85, 0.7, '#ffd23f', 14);
    for (let i = 0; i < 5; i++) m.cyl(cw.x + Math.sin(i * 1.3) * 0.5, 0.95 + (i % 2) * 0.2, cw.z + Math.cos(i * 1.3) * 0.5, 0.08, 0.02, '#e8b830', 6);
    for (const s of [-1, 1]) { m.ico(cw.x + s * 0.28, 1.15, cw.z - 0.78, 0.26, 0.3, 0.12, '#ffffff'); m.ico(cw.x + s * 0.26, 1.15, cw.z - 0.86, 0.1, 0.12, 0.05, '#14101c'); }
    m.box(cw.x, 0.8, cw.z - 0.84, 0.5, 0.08, 0.04, '#3a0f1a');
    for (let i = 0; i < 5; i++) m.cone(cw.x - 0.2 + i * 0.1, 0.82, cw.z - 0.86, 0.035, 0.07, '#ffffff', 4);
    this.col.circle(cw.x, cw.z, 0.95, { h: 1.4 });
    this.sign(['DO NOT', 'FEED'], cw.x, 1.9, cw.z - 0.2, Math.PI, 0.9, 0.45, { bg: '#ffffff', fg: '#d6232a' });
    this.poi.cheeseWheel = cw;

    // the VIP room behind a bead curtain, south-west corner
    const vx0 = X0, vx1 = X0 + 8, vz0 = Z1 - 7;
    wall(vx0, vz0, vx0 + 3, vz0 + 0.3); wall(vx0 + 5, vz0, vx1, vz0 + 0.3); wall(vx1 - 0.3, vz0, vx1, Z1);
    m.box(vx0 + 4, 2.6, vz0 + 0.15, 2, H - 2.6, 0.3, BRICK);
    for (let i = 0; i < 14; i++) for (let k = 0; k < 9; k++) m.ico(vx0 + 3.07 + i * 0.14, 0.3 + k * 0.26, vz0 + 0.15, 0.07, 0.11, 0.07, ['#ff3a8a', '#ffd23f', '#43c0ff', '#c9a8f0'][(i + k) % 4], 0, 0, 0.02);
    this.sign(['VIP LOUNGE', '(VERY IMPORTANT PIZZA)'], vx0 + 4, 3.3, vz0 - 0.02, Math.PI, 2.6, 0.7, { bg: '#2a1640', fg: '#ffd23f', borderColor: '#ffd23f' });
    const pt = { x: vx0 + 4, z: Z1 - 3.4 };
    m.cyl(pt.x, 0, pt.z, 0.25, 0.72, '#3a2418', 8); m.cyl(pt.x, 0.72, pt.z, 1.2, 0.08, '#2f8a4a', 14); m.cyl(pt.x, 0.68, pt.z, 1.28, 0.06, '#5a3a22', 14);
    for (let i = 0; i < 5; i++) m.box(pt.x - 0.5 + i * 0.25, 0.81, pt.z + (i % 2) * 0.2, 0.18, 0.01, 0.26, i % 2 ? '#d6232a' : '#ffffff', i);
    for (let i = 0; i < 6; i++) m.cyl(pt.x + 0.5, 0.81 + i * 0.03, pt.z - 0.3, 0.09, 0.03, ['#d6232a', '#1b1b24', '#ffffff'][i % 3], 10);
    this.col.circle(pt.x, pt.z, 1.3, { h: 0.9 });
    for (const [a, z] of [[1, pt.z], [-1, pt.z]]) { m.box(pt.x + a * 1.9, 0, z, 0.5, 0.48, 0.5, '#5a1a2a'); m.box(pt.x + a * 2.1, 0.48, z, 0.1, 0.6, 0.5, '#5a1a2a'); }
    lamp(pt.x, pt.z, 2.9, 1.4);

    // the regulars: who stands where, doing what (BlackMarket.js brings them to life)
    this.poi.marketNpcs = [
      { x: X - 9, z: Z, ry: Math.PI / 2, look: { hat: 'fedora', coat: '#8a6a4a', glasses: 'sun', skin: '#e0a57c', mustache: '#2a1a14' }, pose: 'talk' },
      { x: X - 7.6, z: Z, ry: -Math.PI / 2, look: { hat: 'beanie', hatColor: '#d6232a', shirt: '#2b2b38', pants: '#2b2b38', skin: '#c98a5e', glasses: 'round', belly: 1.3 }, pose: 'talk', briefcase: true },
      { x: X + 6, z: Z + 0.4, ry: 0.3, look: { hat: 'bald', shirt: '#f7a8c8', pants: '#3a5a9a', skin: '#f2c29b', mustache: true, beard: '#5a3a1a', belly: 1.2 }, pose: 'talk' },
      { x: X + 7.2, z: Z + 1.2, ry: -2.6, look: { hat: 'chef', shirt: '#ffffff', pants: '#2b2b38', glasses: 'sun', skin: '#e0a57c', mustache: '#1a1410' }, pose: 'talk' },
      { x: X1 - 6.8, z: Z0 + 4.0, ry: -2.4, look: { hat: 'fedora', hatColor: '#1b1b24', coat: '#1b1b24', skin: '#f7d6b8', hair: '#c8742a' }, pose: 'paper' },
      { x: pt.x + 1.9, z: pt.z, ry: -Math.PI / 2, look: { hat: 'cowboy', shirt: '#ffcf33', pants: '#3a5a9a', skin: '#e0a57c', glasses: 'sun' }, pose: 'sit' },
      { x: pt.x - 1.9, z: pt.z, ry: Math.PI / 2, look: { hat: 'crown', shirt: '#8a4ac8', pants: '#2a1640', skin: '#c98a5e', mustache: '#e0e0e0', hair: '#e0e0e0' }, pose: 'sit' },
    ];
    this.poi.broker = { x: bx, z: bz - 1.0 };
    this.poi.marketIn = { x: X1 - 6.4, z: Z0 + 1.6, ry: -Math.PI / 2 };
    this.poi.marketExit = { x: X1 - 5.6, z: Z0 + 1.5 };
    this.poi.market = { x0: X0, x1: X1, z0: Z0, z1: Z1 };
    this.root.add(m.build({ cast: true }));
  }

  /* ---------------- the rival pizza gangs ----------------
     Each gang has a building in town (outside: a sign, a door, a back door, a
     back alley camera) and an inside off the map at x = 900 / 1030 / 1160:
     a main hall with things to sabotage, an office with the boss, and a back
     room (where you end up if they catch you). Rivals.js runs it all. */
  rivalPlaces() {
    const P = this.poi.rv = {};
    const spots = {
      italian: { x: 187, z: -92, w: 15, d: 11, h: 5, front: 'w', color: '#b8a088', X: 900 },
      delivery: { x: 80, z: 181, w: 20, d: 12, h: 6, front: 'n', color: '#ff9f1a', X: 1030 },
      frozen: { x: -79, z: 181, w: 17, d: 12, h: 5.5, front: 'n', color: '#9ad8f8', X: 1160 },
    };
    for (const [k, s] of Object.entries(spots)) P[k] = { ...this._rivalOutside(k, s), ...this._rivalInside(k, s.X) };
    // your own cameras (Security Cameras upgrade) and the monitor
    const cam = (id, name, x, y, z, lx, lz, room) => ({ id, name, x, y, z, yaw: Math.atan2(lx - x, lz - z), pitch: 0.42, fov: 1.35, range: 14, room });
    this.poi.hqCams = [
      cam('front', 'FRONT DOOR CAMERA', 134.6, 3.3, 73.6, 139, 80),
      cam('kitchen', 'KITCHEN CAMERA', 151.4, 3.9, 87.4, 144.5, 79),
      cam('alley', 'BACK ALLEY CAMERA', 129.5, 3.3, 61.5, 135, 70),
      cam('back', 'BACK ROOM CAMERA', 163.5, 3.9, 72.6, 156, 82, 2),
    ];
    const pole = (x, z) => { const m = this.m(x, z); m.cyl(x, 0, z, 0.09, 3.4, '#5a5a6a', 6); this.col.circle(x, z, 0.15, { h: 3 }); };
    pole(134.6, 73.6); pole(129.5, 61.5);
    const mon = { x: 140.62, z: 83.3 }; this.poi.monitor = mon;
    const mm = this.m(mon.x, mon.z);
    mm.box(mon.x + 0.05, 1.25, mon.z, 0.1, 0.85, 1.35, '#1b1b24');
    mm.box(mon.x + 0.35, 0, mon.z, 0.6, 0.75, 1.2, '#4a3a2a'); this.col.boxc(mon.x + 0.35, mon.z, 0.6, 1.2, { h: 0.8 });
    this.root.add(part(geo.box(), '#23384a', mon.x + 0.11, 1.68, mon.z, 0.02, 0.72, 1.2, { emissive: 0x1a4a3a, ei: 0.9 }));
    for (let i = 0; i < 4; i++) this.root.add(part(geo.box(), '#3a6a5a', mon.x + 0.125, 1.85 - Math.floor(i / 2) * 0.34, mon.z - 0.29 + (i % 2) * 0.58, 0.01, 0.3, 0.56, { emissive: 0x2a6a4a, ei: 0.6 }));
    this.sign(['SECURITY'], mon.x + 0.12, 2.25, mon.z, Math.PI / 2, 0.9, 0.22, { bg: '#1b1b24', fg: '#43e07a', border: false });
    // a pop-up stand spot "two blocks away", and the dead pizzerias (secret kitchens, the takeover)
    this.poi.popup = { x: 128, z: 52, ry: -Math.PI / 2 };
    this.poi.deadPizzerias = [{ x: -22, z: 58, name: 'SLICE SLICE BABY' }, { x: 0, z: 58, name: "MAMMA MIA'S" }, { x: 22, z: 58, name: 'CRUST FUND' }];
    this.poi.takeover = { x: 0, z: 51.2 };
    this.poi.policeDesk = { x: 80, z: -9.5 };
  }

  /** a rival's building in town */
  _rivalOutside(k, s) {
    const G = RIVAL_LOOKS[k], m = this.m(s.x, s.z), mn = this.mn(s.x, s.z);
    const [fx, fz] = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[s.front];
    const ax = -fz, az = fx;                                // along the front
    const W2 = (fz ? s.w : s.d) / 2, D2 = (fz ? s.d : s.w) / 2;   // half along front, half depth
    const P = (u, v) => ({ x: s.x + fx * (D2 - v) + ax * u, z: s.z + fz * (D2 - v) + az * u });   // u along front, v inward from the front wall
    const ry = Math.atan2(fx, fz);
    // the shell
    m.box(s.x, 0, s.z, s.w, s.h, s.d, s.color); this.col.boxc(s.x, s.z, s.w, s.d, { h: s.h + 1 });
    mn.box(s.x, s.h, s.z, s.w + 0.6, 0.3, s.d + 0.6, '#5a4a5a');
    m.box(s.x, 0, s.z, s.w + 0.04, 0.5, s.d + 0.04, '#5a4a5a');                     // a dark plinth
    mn.flat(Math.min(P(-W2 - 3, -9).x, P(W2 + 3, 2).x), Math.min(P(-W2 - 3, -9).z, P(W2 + 3, 2).z), Math.max(P(-W2 - 3, -9).x, P(W2 + 3, 2).x), Math.max(P(-W2 - 3, -9).z, P(W2 + 3, 2).z), 0.05, '#8a84a0', 4, 0.05);
    const door = P(0, -0.06), dpos = P(0, -1.6);
    if (k === 'italian') {   // a rolled-up garage door that doesn't roll, and a small door in it
      const q = P(0, -0.08); m.box(q.x, 0, q.z, fz ? 6 : 0.12, 3.6, fz ? 0.12 : 6, '#8a8478');
      for (let i = 0; i < 9; i++) m.box(q.x, 0.2 + i * 0.38, q.z, fz ? 6.05 : 0.14, 0.05, fz ? 0.14 : 6.05, '#6a6458');
      m.box(q.x + ax * 1.2 + fx * 0.02, 0.6, q.z + az * 1.2 + fz * 0.02, fz ? 0.8 : 0.14, 0.4, fz ? 0.14 : 0.8, '#5a5448');   // a dent
    }
    m.box(door.x, 0, door.z, fz ? 1.3 : 0.1, 2.3, fz ? 0.1 : 1.3, k === 'frozen' ? '#e8f4ff' : '#3a2a20');
    m.box(door.x + ax * 0.45 + fx * 0.03, 1.1, door.z + az * 0.45 + fz * 0.03, 0.08, 0.08, 0.08, '#c8a03a');
    const sg = signMesh(G.sign, Math.min(s.w * 0.7, 7), 1.5, { bg: G.signBg, fg: G.signFg }); const sp = P(0, -0.12); sg.position.set(sp.x, Math.min(s.h - 0.9, 4.0), sp.z); sg.rotation.y = ry; this.root.add(sg);
    for (const u of [-W2 + 1.6, W2 - 1.6]) { const w = P(u, -0.04); m.box(w.x, 1.1, w.z, fz ? 1.6 : 0.08, 1.4, fz ? 0.08 : 1.6, k === 'frozen' ? '#bfe8ff' : '#2f3a63'); }
    // gang flavour outside
    if (k === 'italian') { for (let i = 0; i < 3; i++) { const t = P(-W2 - 1.6, -2 - i * 1.4); m.cyl(t.x, 0, t.z, 0.45, 0.9, '#2b2b33', 10); m.cyl(t.x, 0.9, t.z, 0.45, 0.06, '#d6232a', 10); } const c = P(W2 + 2.2, -3); this.car('civ3', c.x, c.z, ry + 0.4); }
    if (k === 'delivery') {
      for (let i = 0; i < 3; i++) {
        const c = P(-W2 + 3 + i * 6.5, -6), car = this.car('smallvan', c.x, c.z, ry + Math.PI);
        car.group.traverse(n => { if (n.isMesh && n.material.color && n.material.color.getHexString() === 'f2f2f8') n.material = mat('#ff9f1a'); });
      }
    }
    if (k === 'frozen') { for (let i = 0; i < 9; i++) { const a = P(-W2 + 0.6 + i * (2 * W2 - 1.2) / 8, -0.1); m.cone(a.x, s.h - 0.75, a.z, 0.14, 0.7, '#e8f8ff', 5, 0, 0.02); } for (let i = 0; i < 2; i++) { const f = P(W2 + 1.4, -2 - i * 1.6); m.box(f.x, 0, f.z, 1.2, 1.0, 1.2, '#f6f6fa'); this.col.boxc(f.x, f.z, 1.2, 1.2, { h: 1 }); } }
    // the back: a back door, a dumpster, the back alley camera on the wall
    const bdoor = P(W2 * 0.4, 2 * D2 + 0.06), bdpos = P(W2 * 0.4, 2 * D2 + 1.6);
    m.box(bdoor.x, 0, bdoor.z, fz ? 1.1 : 0.1, 2.2, fz ? 0.1 : 1.1, '#4a4a58');
    this.sign(['STAFF', 'ONLY'], bdoor.x - fx * 0.04, 2.55, bdoor.z - fz * 0.04, ry + Math.PI, 0.9, 0.42, { bg: '#ffffff', fg: '#d6232a' });
    const dmp = P(-W2 * 0.4, 2 * D2 + 1.6); this.dumpster(dmp.x, dmp.z, fz ? 0 : Math.PI / 2);
    const cp = P(-W2 * 0.05, 2 * D2 + 0.12), look = P(W2 * 0.25, 2 * D2 + 6);
    const alley = { id: 'alley', name: 'BACK ALLEY CAMERA', x: cp.x, y: 3.2, z: cp.z, yaw: Math.atan2(look.x - cp.x, look.z - cp.z), pitch: 0.42, fov: 1.4, range: 13, outside: true };
    // growth: extra pieces appear with the gang's level (Rivals.js switches them on)
    const grow = [];
    for (let lv = 2; lv <= 5; lv++) {
      const gm = new Mesher(0.06), gr = new THREE.Group();
      if (lv === 2) { const p = P(0, -0.15); const n = signMesh([G.short.toUpperCase() + '!'], 3.4, 0.6, { bg: '#1b1b24', fg: G.color, border: false }); n.position.set(p.x, s.h - 0.25, p.z); n.rotation.y = ry; gr.add(n); for (let i = 0; i < 4; i++) { const b = P(-W2 - 1.2, -0.8 - i * 0.7); gm.box(b.x, 0, b.z, 0.6, 0.12 + i * 0.1, 0.6, '#c79a5b'); } }
      if (lv === 3) { const a = P(W2 + 4.2, D2); gm.box(a.x, 0, a.z, 6, 3.2, 7, G.color2 === '#ffffff' ? '#d8eef8' : '#a8988a'); gm.box(a.x, 3.2, a.z, 6.4, 0.2, 7.4, '#5a4a5a'); const sgn = signMesh(['ANNEX'], 2, 0.5, { bg: G.color, fg: '#ffffff', border: false }); const q = P(W2 + 4.2, -0.02 + D2 - 3.5); sgn.position.set(q.x, 2.4, q.z); sgn.rotation.y = ry; gr.add(sgn); }
      if (lv === 4) { const b = P(0, D2); for (const u of [-2.5, 2.5]) { const q = P(u, D2); gm.box(q.x, s.h, q.z, 0.2, 2.2, 0.2, '#5a5a6a'); } const bb = signMesh([G.name.toUpperCase(), 'NOW HIRING (NOT YOU)'], 6, 2, { bg: '#ffffff', fg: G.color }); bb.position.set(b.x, s.h + 2.6, b.z); bb.rotation.y = ry; gr.add(bb); }
      if (lv === 5) { const c = P(0, D2); gm.cyl(c.x, s.h + 0.2, c.z, 2.4, 0.4, '#e8b05a', 16); gm.cyl(c.x, s.h + 0.6, c.z, 2.1, 0.12, '#d6232a', 16); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; gm.cyl(c.x + Math.sin(a) * 1.2, s.h + 0.72, c.z + Math.cos(a) * 1.2, 0.3, 0.06, '#8a1a1a', 8); } }
      gr.add(gm.build()); gr.visible = false; this.root.add(gr); grow.push(gr);
    }
    return { name: G.place, out: { door: dpos, back: bdpos, x: s.x, z: s.z, ry }, alley, grow };
  }

  /** a rival's inside, off the map */
  _rivalInside(k, X) {
    const G = RIVAL_LOOKS[k], Z = 0, m = new Mesher(0.06), H = 4.6;
    const X0 = X - 13, X1 = X + 13, Z0 = -9, Z1 = 9;
    const theme = { italian: { floor: '#8a8478', floor2: '#7a7468', wall: '#c8a888', trim: '#2f8a4a' }, delivery: { floor: '#5a5a6a', floor2: '#4a4a5a', wall: '#e8e2d2', trim: '#ff9f1a' }, frozen: { floor: '#dfe8f0', floor2: '#cfdce8', wall: '#bfe4ff', trim: '#43c0ff' } }[k];
    for (let x = X0; x < X1; x += 2) for (let z = Z0; z < Z1; z += 2) m.box(x + 1, 0, z + 1, 1.98, 0.06, 1.98, ((x + z) / 2) % 2 ? theme.floor : theme.floor2, 0, 0.04);
    const wall = (x0, z0, x1, z1, h = H, y0 = 0) => { m.box((x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, h, z1 - z0, theme.wall); if (!y0) this.col.box(x0, z0, x1, z1, { h: 6 }); };
    wall(X0 - 0.3, Z0 - 0.3, X1 + 0.3, Z0); wall(X0 - 0.3, Z1, X1 + 0.3, Z1 + 0.3); wall(X1, Z0, X1 + 0.3, Z1);
    wall(X0 - 0.3, Z0, X0, -1.2); wall(X0 - 0.3, 1.2, X0, Z1); wall(X0 - 0.3, -1.2, X0, 1.2, 2.2, 2.4);
    m.box(X, 0, Z0 + 0.04, 26, 0.9, 0.08, theme.trim); m.box(X, 0, Z1 - 0.04, 26, 0.9, 0.08, theme.trim);
    // office (north-east) and back room (south-east), each with a doorway onto a corridor
    const OX = X + 4;
    wall(OX - 0.15, Z0, OX + 0.15, -2); wall(OX - 0.15, 2, OX + 0.15, Z1);
    wall(OX, -2.15, X + 7.6, -1.85); wall(X + 9.4, -2.15, X1, -1.85); wall(X + 7.6, -2.15, X + 9.4, -1.85, 2.4, 2.2);
    wall(OX, 1.85, X + 7.6, 2.15); wall(X + 9.4, 1.85, X1, 2.15); wall(X + 7.6, 1.85, X + 9.4, 2.15, 2.4, 2.2);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(27, 19), new THREE.MeshBasicMaterial({ color: { italian: '#5a4a40', delivery: '#4a4a58', frozen: '#7a90a8' }[k] }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(X, H, Z); this.root.add(ceil);
    for (let x = X0 + 2; x < X1; x += 4) m.box(x, H - 0.25, 0, 0.25, 0.25, 18, '#3a3442');   // ceiling beams
    const bulb =(x, z, y = 3.7) => { m.box(x, y + 0.2, z, 0.03, H - y - 0.2, 0.03, '#1b1b24'); this.root.add(part(geo.ico(0), '#fff1c0', x, y, z, 0.24, 0.26, 0.24, { emissive: 0xffd890, ei: 1.4 })); };
    for (const [x, z] of [[X - 8, -4], [X - 8, 4], [X - 1, 0], [X + 9, -5.5], [X + 9, 5.5], [X + 8, 0]]) bulb(x, z);
    const put = (g, x, y, z, ry = 0, s = 1) => { g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(s); bake(m, g); };
    const sign = (lines, x, y, z, ry, w, h, o) => this.sign(lines, x, y, z, ry, w, h, o);
    // ---- the main hall ----
    // register counter (north wall)
    m.box(X - 6, 0, -6.6, 3.2, 1.0, 0.9, '#4a3020'); m.box(X - 6, 1.0, -6.6, 3.3, 0.06, 1.0, '#7a5236'); this.col.boxc(X - 6, -6.6, 3.2, 0.9, { h: 1.1 });
    // oven (north-west corner)
    m.box(X - 11, 0, -8.1, 2.2, 1.0, 1.4, k === 'frozen' ? '#f6f6fa' : '#5a5a6a'); this.col.boxc(X - 11, -8.1, 2.2, 1.4, { h: 2 });
    if (k === 'italian') { m.box(X - 11, 1.0, -8.1, 1.6, 0.9, 1.1, '#a8542a'); m.cyl(X - 11, 1.9, -8.4, 0.25, 1.4, '#7a3a1a', 6); }
    if (k === 'delivery') { m.box(X - 11, 1.0, -8.1, 2.2, 0.5, 1.2, '#c8ccd8'); m.box(X - 11, 1.18, -7.4, 2.4, 0.1, 0.3, '#2b2b33'); }
    if (k === 'frozen') { m.box(X - 11, 1.0, -8.1, 1.4, 0.8, 1.0, '#e8e8f0'); m.box(X - 10.7, 1.1, -7.58, 0.7, 0.55, 0.02, '#2a2a38'); for (let i = 0; i < 3; i++) m.box(X - 10.1, 1.2 + i * 0.15, -7.58, 0.12, 0.08, 0.02, '#43e07a'); }
    sign([{ italian: 'NONNA\'S OVEN', delivery: 'SPEED OVEN 9000', frozen: 'MICROWAVE (ARTISAN)' }[k]], X - 11, 2.4, Z0 + 0.06, 0, 2.2, 0.4, { bg: '#ffffff', fg: '#1b1b24' });
    // a shelf you can knock over (north wall, middle) - dynamic
    const shelf = new THREE.Group(); shelf.position.set(X - 2, 0, -8.5); this.root.add(shelf);
    { const sm = new Mesher(0.05); sm.box(0, 0, 0, 2.6, 2.2, 0.06, '#5a3a22'); for (let i = 0; i < 4; i++) { sm.box(0, 0.1 + i * 0.6, 0.3, 2.6, 0.05, 0.6, '#7a5236'); for (let j = 0; j < 6; j++) sm.box(-1.05 + j * 0.42, 0.15 + i * 0.6, 0.32, 0.3, 0.25 + (j % 3) * 0.05, 0.4, k === 'frozen' ? ['#43c0ff', '#ffffff', '#d6232a'][(i + j) % 3] : ['#c79a5b', '#d6232a', '#f6f1e6', '#2f8a4a'][(i + j) % 4]); } shelf.add(sm.build()); }
    this.col.boxc(X - 2, -8.2, 2.6, 0.7, { h: 2.2 });
    // three crates of supplies (south-west) - dynamic
    const crates = [];
    for (let i = 0; i < 3; i++) { const c = MAFIA.crate(['CHEESE', 'PEPPERONI', 'SAUCE'][i] + (k === 'frozen' ? ' (FROZEN)' : '')); c.position.set(X - 11 + i * 1.25, 0, 8.1); c.rotation.y = Math.PI; this.root.add(c); crates.push(c); }
    this.col.box(X - 11.7, 7.4, X - 7.7, 9, { h: 1.2 });
    // the special thing (south wall)
    const special = new THREE.Group(); special.position.set(X - 4, 0, 8.2); this.root.add(special);
    if (k === 'italian') { special.add(part(geo.box(), '#5a5a6a', 0, 0.45, 0, 1.4, 0.9, 0.8)); special.add(part(geo.cyl(12), '#a8a8b8', 0, 1.15, 0, 0.8, 0.5, 0.8, { metal: 0.5, rough: 0.3 })); special.add(part(geo.cyl(12), '#c83a2a', 0, 1.36, 0, 0.7, 0.06, 0.7)); special.add(rot(part(geo.box(), '#8a6a4a', 0.2, 1.6, 0, 0.06, 0.8, 0.06), 'z', -0.4)); }
    if (k === 'delivery') { special.add(part(geo.box(), '#2b2b33', 0, 1.6, -0.3, 1.6, 1.0, 0.06)); for (let i = 0; i < 6; i++) { special.add(part(geo.box(), '#c8c8d8', -0.6 + (i % 3) * 0.6, 1.85 - Math.floor(i / 3) * 0.45, -0.24, 0.05, 0.1, 0.06)); const key = part(geo.box(), '#ffd23f', -0.6 + (i % 3) * 0.6, 1.72 - Math.floor(i / 3) * 0.45, -0.22, 0.08, 0.16, 0.02); key.name = 'key'; special.add(key); } }
    if (k === 'frozen') { special.add(part(geo.box(), '#f6f6fa', 0, 0.5, 0, 2.0, 1.0, 1.0)); special.add(part(geo.box(), '#bfe8ff', 0, 1.02, 0, 1.9, 0.04, 0.9, { opacity: 0.6 })); special.add(part(geo.box(), '#2b2b33', 1.1, 0.3, -0.35, 0.3, 0.06, 0.06)); const plug = part(geo.box(), '#ffd23f', 1.3, 0.28, -0.4, 0.12, 0.12, 0.08); plug.name = 'plug'; special.add(plug); }
    this.col.boxc(X - 4, 8.2, 2.0, 1.0, { h: 1.2 });
    sign([{ italian: 'NONNA\'S SAUCE', delivery: 'VAN KEYS', frozen: 'THE BIG FREEZER' }[k], '(DO NOT TOUCH)'], X - 4, 2.6, Z1 - 0.06, Math.PI, 1.8, 0.6, { bg: '#ffe14a', fg: '#1b1b24' });
    // the trophy on its pedestal
    m.cyl(X + 1.5, 0, 7.4, 0.5, 1.0, '#2b2b33', 10); m.cyl(X + 1.5, 1.0, 7.4, 0.56, 0.06, '#c8a03a', 10); this.col.circle(X + 1.5, 7.4, 0.55, { h: 1.1 });
    const trophy = makeTrophy(k); trophy.position.set(X + 1.5, 1.06, 7.4); this.root.add(trophy);
    sign(['OUR PRIDE'], X + 1.5, 2.4, Z1 - 0.06, Math.PI, 1.1, 0.35, { bg: '#1b1b24', fg: '#ffd23f' });
    // furniture and flavour in the middle
    if (k === 'italian') { for (const [x, z] of [[X - 6, 1], [X - 1, 2.5]]) { m.box(x, 0, z, 1.6, 0.76, 1.2, '#7a5236'); for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) m.box(x - 0.6 + i * 0.4, 0.77, z - 0.4 + j * 0.4, 0.4, 0.01, 0.4, (i + j) % 2 ? '#d6232a' : '#ffffff'); m.cyl(x, 0.78, z, 0.06, 0.35, '#2f8a4a', 6); this.col.boxc(x, z, 1.6, 1.2, { h: 0.8 }); } sign(['LA FAMIGLIA', '(est. last Tuesday)'], X - 8, 2.8, Z0 + 0.06, 0, 2.2, 0.7, { bg: '#2f8a4a', fg: '#ffffff' }); }
    if (k === 'delivery') { for (let i = 0; i < 4; i++) m.cyl(X - 7 + (i % 2) * 0.9, Math.floor(i / 2) * 0.32, 4, 0.4, 0.3, '#1b1b24', 10); this.col.circle(X - 6.5, 4, 1.0, { h: 0.7 }); sign(['DEPOT RECORD', '0:38'], X - 8, 2.8, Z0 + 0.06, 0, 2.2, 0.8, { bg: '#1b1b24', fg: '#ff9f1a' }); m.box(X - 1, 0, 2, 3, 0.8, 1.2, '#5a5a6a'); this.col.boxc(X - 1, 2, 3, 1.2, { h: 0.8 }); for (let i = 0; i < 5; i++) m.box(X - 2 + i * 0.5, 0.8, 2, 0.4, 0.1 + i * 0.03, 0.4, '#c79a5b'); }
    if (k === 'frozen') { for (let i = 0; i < 3; i++) { m.box(X - 7 + i * 2.6, 0, 1.5, 2.0, 0.95, 1.0, '#f6f6fa'); m.box(X - 7 + i * 2.6, 0.95, 1.5, 1.9, 0.04, 0.9, '#bfe8ff'); } this.col.box(X - 8.1, 0.9, X - 0.7, 2.1, { h: 1 }); sign(['FRESH*', '*frozen'], X - 8, 2.8, Z0 + 0.06, 0, 1.8, 0.7, { bg: '#ffffff', fg: '#43c0ff' }); }
    // ---- the office ----
    m.box(X + 9, 0, -6.6, 3.4, 0.8, 1.3, '#3a2418'); m.box(X + 9, 0.8, -6.6, 3.6, 0.08, 1.5, '#6a4a2a'); this.col.boxc(X + 9, -6.6, 3.6, 1.5, { h: 0.9 });
    m.box(X + 9, 0, -8.2, 1.0, 0.5, 0.9, '#5a1a2a'); m.box(X + 9, 0.5, -8.6, 1.0, 1.4, 0.2, '#5a1a2a');
    m.box(X + 9, 0, -4.5, 0.6, 0.45, 0.6, '#3a3a48');
    for (let i = 0; i < 3; i++) m.box(X + 8.2 + i * 0.5, 0.88, -6.4, 0.4, 0.05 + i * 0.06, 0.5, '#f6f1e6');
    sign([G.boss.toUpperCase()], X + 9, 3.2, Z0 + 0.06, 0, 2.8, 0.5, { bg: '#1b1b24', fg: G.color });
    sign(['THE BOSS', '(KNOCK)'], X + 8.5, 2.75, -1.98, Math.PI, 0.9, 0.36, { bg: '#ffffff', fg: '#1b1b24' });
    // ---- the back room: one chair, one bulb ----
    m.box(X + 9, 0, 6.6, 0.8, 0.45, 0.8, '#5a5a6a'); m.box(X + 9, 0.45, 7.0, 0.8, 0.9, 0.1, '#5a5a6a');
    for (let i = 0; i < 3; i++) put(MAFIA.crate('MISC'), X + 12, i * 0.9, 7.8, 0);
    sign(['THE BACK ROOM', '(we don\'t talk about it)'], X + 9, 3.0, Z1 - 0.06, Math.PI, 2.2, 0.6, { bg: '#1b1b24', fg: '#ffffff' });
    this.root.add(m.build({ cast: true }));
    // ---- cameras: data (Rivals.js makes the models) ----
    const cam = (id, name, x, y, z, lx, lz, lvl = 1) => ({ id, name, x, y, z, yaw: Math.atan2(lx - x, lz - z), pitch: 0.45, fov: 1.35, range: 13, lvl });
    const cams = [cam('door', 'FRONT DOOR CAMERA', X0 + 0.35, 3.6, -3.4, X0 + 5, 1.5), cam('register', 'REGISTER CAMERA', X + 3.6, 3.6, -8.6, X - 6, -3), cam('kitchen', 'KITCHEN CAMERA', X0 + 0.35, 3.6, 8.6, X - 4, 3.5, 2), cam('office', 'OFFICE CAMERA', X + 12.6, 3.6, -1.5, X + 6, 0, 3)];
    const st = [
      { id: 'register', kind: 'register', x: X - 6, z: -5.4, label: 'the cash register' },
      { id: 'oven', kind: 'oven', x: X - 11, z: -6.6, label: 'the oven' },
      { id: 'shelf', kind: 'shelf', x: X - 2, z: -7.0, label: 'the shelf' },
      { id: 'crate0', kind: 'crate', i: 0, x: X - 11, z: 7.0 }, { id: 'crate1', kind: 'crate', i: 1, x: X - 9.75, z: 7.0 }, { id: 'crate2', kind: 'crate', i: 2, x: X - 8.5, z: 7.0 },
      { id: 'special', kind: 'special', x: X - 4, z: 7.0 },
      { id: 'trophy', kind: 'trophy', x: X + 1.5, z: 6.2 },
    ];
    return {
      X, inside: { x0: X0, x1: X1, z0: Z0, z1: Z1 }, spawn: { x: X0 + 1.6, z: 0, ry: Math.PI / 2 }, exit: { x: X0 + 0.6, z: 0 },
      backSpawn: { x: X + 11.5, z: 5.0, ry: -Math.PI / 2 },
      st, cams, dyn: { shelf, crates, special, trophy },
      desk: { x: X + 9, z: -5.0 }, boss: { x: X + 9, z: -8.0 }, guards: [{ x: X + 7.2, z: -8.4 }, { x: X + 10.8, z: -8.4 }], frank: { x: X + 12, z: -3.4 },
      meetCam: { x: X + 9, y: 2.0, z: -3.1, lx: X + 9, ly: 1.5, lz: -8 },
      chair: { x: X + 9, z: 6.5 }, caughtCam: { x: X + 9, y: 2.4, z: 2.9, lx: X + 9, ly: 1.0, lz: 6.8 },
      route: [[X - 9, -3.5], [X - 3, -4.5], [X + 1.5, -0.5], [X - 2, 4.5], [X - 8, 4.0], [X - 11.5, 0]],
      route2: [[X + 6, 0], [X + 11.5, 0], [X + 11.5, -4.5], [X + 6, -4.5]],
    };
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
    this.sign(['CRUMBVILLE PARK', 'No pizza. No picnics with pizza.', 'No thinking about pizza.'], cx - 24, 1.6, cz - 30, Math.PI, 3.6, 1.6, { bg: '#2f8a4a', fg: '#ffffff', before: ['CRUMBVILLE PARK', 'Please keep off the grass.', '(the grass is shy)'] });
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
    this.sign(['KRUM RADIO', '"All the news. None of the pizza."'], 104, 2.0, -166.48, 0, 3.4, 0.8, { bg: '#ffffff', before: ['KRUM RADIO', '"All the news. Most of the time."'] });
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

  /** the Crumb Mall: four real stores round a courtyard. Everything is bought off the shelves. */
  mall(cx, cz) {
    const m = this.m(cx, cz);
    this.shopItems = this.shopItems || [];   // Hank's spec cards are already in here
    const shop = (it) => this.shopItems.push(it);
    m.flat(cx - 31, cz - 31, cx + 31, cz + 31, 0.07, '#ead8c0', 2, 0.07);
    // a patterned courtyard: rings of pink tiles, a fountain, benches, trees, flower beds
    const yc = cz + 7;
    for (let a = 0; a < 28; a++) { const t = a / 28 * Math.PI * 2; m.box(cx + Math.sin(t) * 8, 0.07, yc + Math.cos(t) * 8, 1.4, 0.04, 1.4, a % 2 ? '#f2b5d4' : '#ffffff', t); }
    m.cyl(cx, 0, yc, 3.6, 0.7, '#d9d2e8', 12); m.cyl(cx, 0.5, yc, 3.2, 0.22, '#6ec6e8', 12, 0, 0.03); m.cyl(cx, 0, yc, 0.5, 2.0, '#c8c0da', 8); m.cyl(cx, 2.0, yc, 1.2, 0.2, '#c8c0da', 10);
    this.col.circle(cx, yc, 3.7, { h: 1 });
    this.poi.mallFountain = { x: cx, y: 2.3, z: yc };
    for (let a = 0; a < 4; a++) { const t = a / 4 * Math.PI * 2 + Math.PI / 4; this.bench(cx + Math.sin(t) * 10.5, yc + Math.cos(t) * 10.5, t + Math.PI); }
    for (const [dx, dz] of [[-9, -8], [9, -8], [-9, 20], [9, 20]]) { m.box(cx + dx, 0, cz + dz, 2.6, 0.6, 2.6, '#c8c0da'); this.tree(cx + dx, cz + dz, 0.8, 'pink'); for (let k = 0; k < 6; k++) m.ico(cx + dx + Math.sin(k) * 1.05, 0.72, cz + dz + Math.cos(k) * 1.05, 0.28, 0.24, 0.28, ['#ff8fc8', '#ffd23f', '#ffffff'][k % 3], 0, k); }
    // the catalogue each store puts on its shelves
    const eqModel = {
      oven1: () => makeStation('oven').group, bigfridge: () => makeStation('fridge').group, safe: () => MAFIA.safe(),
      camera: () => { const g = new THREE.Group(); g.add(part(geo.box(), '#e8e8f0', 0, 0.5, 0, 0.5, 0.35, 0.8)); g.add(part(geo.cyl(10), '#1b1b24', 0, 0.5, 0.45, 0.25, 0.15, 0.25)); g.add(part(geo.cyl(6), '#c8c8d8', 0, 0.2, 0, 0.08, 0.4, 0.08)); return g; },
      hidden: () => { const g = new THREE.Group(); g.add(part(geo.box(), C.brick, 0, 0.8, 0, 1.4, 1.6, 0.2)); g.add(part(geo.box(), '#5a3a2a', 0.5, 0.8, 0.12, 0.08, 0.2, 0.05)); return g; },
      sprinkler: () => { const g = new THREE.Group(); g.add(part(geo.cyl(6), '#d6232a', 0, 0.7, 0, 0.1, 1.4, 0.1)); g.add(part(geo.cone(8), '#c8c8d8', 0, 1.45, 0, 0.35, 0.2, 0.35)); return g; },
      fastoven: () => { const g = new THREE.Group(); g.add(part(geo.box(), '#c8ccd8', 0, 0.4, 0, 0.8, 0.8, 0.5)); g.add(part(geo.cyl(10), '#ffffff', 0, 0.5, 0.26, 0.4, 0.04, 0.4)); g.add(part(geo.box(), '#d6232a', 0.08, 0.55, 0.29, 0.03, 0.18, 0.02)); return g; },
      shoes: () => { const g = new THREE.Group(); for (let k = 0; k < 3; k++) { g.add(part(geo.box(), '#a87c44', 0, 0.2 + k * 0.45, 0, 1.2, 0.05, 0.4)); for (let i = 0; i < 3; i++) g.add(part(geo.box(), ['#d6232a', '#3a7bd5', '#ffd23f'][i], -0.4 + i * 0.4, 0.3 + k * 0.45, 0, 0.3, 0.14, 0.16)); } return g; },
      purifier: () => { const g = new THREE.Group(); g.add(part(geo.box(), '#f6f6fa', 0, 0.6, 0, 0.6, 1.2, 0.6)); for (let i = 0; i < 5; i++) g.add(part(geo.box(), '#8a98a6', 0, 0.3 + i * 0.18, 0.31, 0.45, 0.04, 0.02)); g.add(part(geo.box(), '#43e07a', 0, 1.1, 0.31, 0.1, 0.06, 0.02, { emissive: 0x20ff60, ei: 0.7 })); return g; },
    };
    const equip = EQUIPMENT.map(e => ({ ...e, model: eqModel[e.key], scale: e.key === 'oven1' || e.key === 'bigfridge' ? 0.55 : 0.8 }));
    const genModel = {
      smoke: () => { const g = new THREE.Group(); for (let i = 0; i < 5; i++) g.add(part(geo.ico(0), '#2b2b33', (i % 3 - 1) * 0.25, 0.15 + Math.floor(i / 3) * 0.2, (i % 2) * 0.15, 0.24, 0.24, 0.24)); return g; },
      energy: () => { const g = new THREE.Group(); for (let i = 0; i < 6; i++) g.add(part(geo.cyl(8), i % 2 ? '#43e07a' : '#ff3a3a', (i % 3 - 1) * 0.2, 0.15, Math.floor(i / 3) * 0.2, 0.15, 0.3, 0.15)); return g; },
      fresh: () => { const g = new THREE.Group(); for (let i = 0; i < 4; i++) g.add(part(geo.cone(4), '#3fa34d', (i - 1.5) * 0.25, 0.25, 0, 0.18, 0.4, 0.04)); return g; },
      license: () => { const g = new THREE.Group(); g.add(part(geo.box(), '#f6f1e6', 0, 0.25, 0, 0.5, 0.35, 0.03)); g.add(part(geo.box(), '#3a7bd5', -0.12, 0.27, 0.02, 0.14, 0.18, 0.01)); return g; },
      mustache: () => { const g = new THREE.Group(); g.add(part(geo.ico(1), '#f2c29b', 0, 0.3, 0, 0.4, 0.45, 0.4)); g.add(part(geo.box(), '#2a1a14', 0, 0.22, 0.2, 0.3, 0.07, 0.06)); return g; },
      coat: () => { const g = new THREE.Group(); g.add(part(geo.frust(0.8, 7), '#8a6a4a', 0, 0.45, 0, 0.6, 0.9, 0.45)); g.add(part(geo.cyl(10), '#4a3b30', 0, 1.0, 0, 0.6, 0.05, 0.6)); return g; },
      suit: () => { const g = new THREE.Group(); g.add(part(geo.frust(0.8, 7), '#1b1b24', 0, 0.45, 0, 0.6, 0.9, 0.45)); g.add(part(geo.box(), '#d6232a', 0, 0.6, 0.22, 0.08, 0.4, 0.02)); g.add(part(geo.box(), '#111018', 0, 1.0, 0.1, 0.4, 0.08, 0.05)); return g; },
      cop: () => { const g = new THREE.Group(); g.add(part(geo.cyl(8), '#1e2a5a', 0, 0.15, 0, 0.6, 0.25, 0.6)); g.add(part(geo.ico(0), '#ffd23f', 0, 0.2, 0.3, 0.14, 0.14, 0.05)); return g; },
      polaroid: () => { const p = makePolaroid(); p.scale.setScalar(1.4); return p; },
      sack: () => { const g = new THREE.Group(); g.add(part(geo.ico(1), '#b8945a', 0, 0.4, 0, 0.7, 0.8, 0.6)); g.add(part(geo.cyl(6), '#8a6a3a', 0, 0.85, 0, 0.2, 0.15, 0.2)); return g; },
    };
    const misc = GENERAL.map(e => ({ ...e, model: genModel[e.key] }));
    const extra = { shop, bake: (mm, gp) => bake(mm, gp) };
    const furn = FURNITURE.map(f => ({ ...f, model: () => makeFurniture(f.key) }));
    const B = (x, z, w, d, h, color, f, o) => { this.bldg(x, z, w, d, h, color, f, { storefront: true, flowers: false, poster: false, ...o }); return { cx: x, cz: z, w, d, h, front: f }; };
    groceryFront(this, B(cx, cz - 20, 30, 16, 6, '#e8f2e0', 's', { kind: 'grocery', sign: ['CRUMB GROCERY', '"We Have Food"'], floor: '#eef0f4', inner: '#f6f1e6', trim: '#3fa34d', extra: { ...extra, goods: GROCERY } }));
    loadingDock(this, cx + 15.2, cz - 23, Math.PI / 2);
    furnitureFront(this, B(cx - 21, cz + 8, 18, 24, 6.5, '#f2e6d8', 'e', { kind: 'furniture', floor: '#c8a070', inner: '#f6efe6', trim: '#2a2238', ceiling: '#fbf6ee', extra: { ...extra, furn } }));
    equipmentFront(this, B(cx + 21, cz + 8, 18, 24, 7, '#c0c6d2', 'w', { kind: 'equipment', sign: ['EQUIP-O-RAMA', 'KITCHEN · INDUSTRIAL'], signBg: '#1b1b24', signFg: '#ff9f1a', floor: '#b8bcc8', inner: '#dde0e8', trim: '#3a3a48', ceiling: '#c8ccd8', extra: { ...extra, equip } }));
    generalFront(this, B(cx, cz + 24, 18, 12, 5, '#c9a8f0', 'n', { kind: 'general', sign: ['GENERAL STORE', '(everything)'], awning: '#8a4ac8', floor: '#e8e2f2', inner: '#f6f1e6', extra: { ...extra, misc } }));
    // arches over the two entrances
    for (const s of [-1, 1]) {
      const ex = cx + s * 31, ez = cz - 8;
      for (const k of [-1, 1]) { m.box(ex, 0, ez + k * 3.6, 0.5, 4.5, 0.5, '#c8a03a'); this.col.circle(ex, ez + k * 3.6, 0.3, { h: 4.5 }); }
      m.box(ex, 4.5, ez, 0.6, 0.5, 7.8, '#c8a03a');
      this.sign(['CRUMB MALL'], ex + s * 0.32, 5.4, ez, s > 0 ? Math.PI / 2 : -Math.PI / 2, 6, 1.2, { bg: '#2a1640', fg: '#ffd23f', borderColor: '#c8a03a' });
      this.sign(['CRUMB MALL'], ex - s * 0.32, 5.4, ez, s > 0 ? -Math.PI / 2 : Math.PI / 2, 6, 1.2, { bg: '#2a1640', fg: '#ffd23f', borderColor: '#c8a03a' });
    }
    this.poi.mall = { x: cx, z: yc };
    this.poi.mallGrocery = { x: cx, z: cz - 10 };
    this.poi.mallEquip = { x: cx + 10.5, z: cz + 8 };
    this.poi.mallLot = { x: cx - 25, z: cz - 8, yaw: -Math.PI / 2 };
  }

  /** the beauty pass: grass tufts and wildflowers, hedges, flower boxes, bins and bus stops, hills, string lights */
  prettify() {
    const r = this.rand, col = this.col;
    const onRoadish = (x, z) => ROADS.some(q => Math.abs(x - q) < RW / 2 + 3.6 || Math.abs(z - q) < RW / 2 + 3.6);
    // tufts of grass and little flowers all over the lawns
    for (let i = 0; i < 4200; i++) {
      const x = -205 + r() * 410, z = -128 + r() * 333;
      if (onRoadish(x, z) || col.solidAt(x, z, 0.3, 0, 1.2)) continue;
      if (Math.abs(x) < 34 && Math.abs(z) < 34) continue; // the plaza
      if (x > -113 && x < -47 && z > 47 && z < 113) continue; // the mall
      if ((this.paved || []).some(([a, b, c, d]) => x > a && x < c && z > b && z < d)) continue; // lots and floors
      const m = this.mn(x, z), k = r();
      if (k < 0.6) { const g = ['#7cc46e', '#8ad07a', '#6ab45e'][Math.floor(r() * 3)]; for (let j = 0; j < 3; j++) m.cone(x + (j - 1) * 0.12, 0, z + (j % 2) * 0.1, 0.07, 0.35 + r() * 0.25, g, 3, r() * 3, 0.1); }
      else if (k < 0.85) { const c = ['#ffffff', '#ffd23f', '#ff8fc8', '#c9a8f0', '#ff6b6b'][Math.floor(r() * 5)]; m.cyl(x, 0, z, 0.02, 0.32, '#4fa64f', 3); m.ico(x, 0.36, z, 0.16, 0.1, 0.16, c, 0, r() * 3, 0.05); m.ico(x, 0.36, z, 0.06, 0.06, 0.06, '#ffd23f', 0, 0, 0); }
      else m.ico(x, 0.05, z, 0.35 + r() * 0.4, 0.2 + r() * 0.15, 0.3 + r() * 0.4, ['#b8b0c8', '#a8a0b8', '#c8c0d0'][Math.floor(r() * 3)], 0, r() * 3, 0.12); // pebbles
    }
    // rolling green hills between the town and the mountains
    for (let i = 0; i < 36; i++) {
      const a = i / 36 * Math.PI * 2, d = 245 + r() * 25;
      const x = Math.sin(a) * d, z = Math.cos(a) * d;
      this.m(Math.max(-270, Math.min(270, x)), Math.max(-270, Math.min(270, z))).ico(x, -6, z, 70 + r() * 40, 22 + r() * 18, 60 + r() * 40, ['#7ab86e', '#8ac47a', '#6aa862'][i % 3], 1, r() * 3, 0.06);
    }
    // bins and benches along the sidewalks, a bus stop on every long street
    for (const rd of ROADS) for (let a = -EXT + 22; a < EXT - 10; a += 52) {
      if (ROADS.some(q => Math.abs(a - q) < 16)) continue;
      for (const [x, z, ry] of [[rd + RW / 2 + 2.6, a, -Math.PI / 2], [a, rd - RW / 2 - 2.6, 0]]) {
        if (z < -128 || col.solidAt(x, z, 0.5, 0, 0.6)) continue;
        const m = this.m(x, z);
        m.cyl(x + 1.2, 0, z + 1.2, 0.28, 0.85, '#3fa34d', 8); m.cyl(x + 1.2, 0.85, z + 1.2, 0.32, 0.06, '#2f7a3a', 8); col.circle(x + 1.2, z + 1.2, 0.3, { h: 1 });
      }
    }
    for (const [x, z, ry] of [[-40 + 8, -20, Math.PI / 2], [40 - 8, 20, -Math.PI / 2], [-20, 40 + 8, Math.PI], [20, -40 - 8, 0], [120 - 8, 30, -Math.PI / 2], [-120 + 8, -30, Math.PI / 2]]) {
      const m = this.m(x, z), c = Math.cos(ry), s = Math.sin(ry);
      // a bus stop: roof, back wall, bench, a sign
      m.boxc(x, 2.6, z, 3.4, 0.12, 1.4, '#3a3048', ry);
      m.boxc(x - s * 0.6, 1.3, z - c * 0.6, 3.4, 2.4, 0.06, '#bfe4ff', ry);
      for (const k of [-1.6, 1.6]) m.box(x + c * k - s * 0.6, 0, z - s * k - c * 0.6, 0.1, 2.6, 0.1, '#3a3048');
      m.boxc(x - s * 0.3, 0.45, z - c * 0.3, 2.6, 0.08, 0.45, '#c8a070', ry);
      this.sign(['BUS', 'every 40 min', '(it never comes)'], x + c * 2.1, 2.3, z - s * 2.1, ry, 0.7, 0.9, { bg: '#3a7bd5', fg: '#ffffff' });
      m.cyl(x + c * 2.1, 0, z - s * 2.1, 0.05, 2.0, '#5a5a6a', 5);
      col.boxc(x - s * 0.6, z - c * 0.6, Math.abs(c) > 0.5 ? 3.4 : 0.2, Math.abs(c) > 0.5 ? 0.2 : 3.4, { h: 2.6 });
    }
    // a phone booth by the square
    { const m = this.m(36, 36); m.box(36, 0, 36, 1.1, 2.5, 1.1, '#d6232a'); m.box(36, 2.5, 36, 1.2, 0.2, 1.2, '#b81a1a'); m.box(36, 0.9, 36.56, 0.8, 1.3, 0.02, '#bfe4ff'); this.col.boxc(36, 36, 1.1, 1.1, { h: 2.6 }); }
    // string lights round the town square
    const corners = [[-31, -31], [31, -31], [31, 31], [-31, 31]];
    this.bulbs = [];
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
      const m = this.m((ax + bx) / 2, (az + bz) / 2);
      m.cyl(ax, 0, az, 0.1, 4.6, '#3a3048', 6);
      const n = 24;
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = 4.4 - Math.sin(t * Math.PI) * 1.1;
        if (k < n) { const t2 = (k + 1) / n, y2 = 4.4 - Math.sin(t2 * Math.PI) * 1.1, x2 = ax + (bx - ax) * t2, z2 = az + (bz - az) * t2; m.boxc((x + x2) / 2, (y + y2) / 2, (z + z2) / 2, Math.hypot(x2 - x, z2 - z) + 0.02, 0.03, 0.03, '#2a2238', Math.atan2(x2 - x, z2 - z) + Math.PI / 2); }
        this.bulbs.push({ x, y: y - 0.12, z, c: ['#ffd23f', '#ff8fc8', '#8fe0ff', '#a8ff8f'][k % 4] });
      }
    }
    const bulbGeo = new THREE.IcosahedronGeometry(0.11, 0);
    const byColor = {};
    for (const b of this.bulbs) (byColor[b.c] ||= []).push(b);
    for (const [c, list] of Object.entries(byColor)) {
      const im = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial({ color: c }), list.length);
      const mm = new THREE.Matrix4();
      list.forEach((b, i) => im.setMatrixAt(i, mm.makeTranslation(b.x, b.y, b.z)));
      this.root.add(im);
    }
    // hedges along the front gardens of the houses, window flower boxes
    for (const h of this.houses) {
      const r2 = Math.sign(h.door.z - h.z);
      const m = this.m(h.x, h.z);
      for (const s of [-1, 1]) m.box(h.x + s * 4.2, 0, h.z + r2 * 9.6, 2.6, 0.9, 0.7, '#4f9a52', 0, 0.12);
      for (const s of [-1, 1]) { m.box(h.x + s * 3.4, 0.9, h.z + r2 * 5.15, 1.5, 0.25, 0.3, '#8a5a33'); for (let k = 0; k < 4; k++) m.ico(h.x + s * 3.4 - 0.55 + k * 0.37, 1.18, h.z + r2 * 5.15, 0.22, 0.2, 0.22, ['#ff8fc8', '#ffd23f', '#ff6b6b', '#ffffff'][k], 0, k); }
      // a porch: two posts and a little roof over the door
      for (const s of [-1, 1]) m.box(h.x + s * 1.3, 0, h.z + r2 * 6.3, 0.14, 2.7, 0.14, '#f6f1e6');
      m.boxc(h.x, 2.8, h.z + r2 * 5.75, 3.0, 0.12, 1.4, '#f6f1e6', 0, -r2 * 0.18);
      m.box(h.x, 0, h.z + r2 * 5.7, 2.4, 0.15, 1.2, '#c8c0d0');
      // a stepping-stone path to the gate
      for (let k = 0; k < 4; k++) m.cyl(h.x + (k % 2 ? 0.2 : -0.2), 0.02, h.z + r2 * (6.8 + k * 0.95), 0.38, 0.05, '#d8d0e0', 7, k);
    }
  }

  /** crosswalks, street trees in planters, and cars parked along the curbs */
  streetLife() {
    const nearJunction = a => ROADS.some(q => Math.abs(a - q) < 15);
    for (const x of ROADS) for (const z of ROADS) {
      // zebra crossings on all four sides of every junction
      for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const m = this.mn(x, z);
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
    this.sign(['GET WELL SOON', '(OR AT LEAST SOONISH)'], X + 2, 2.6, Z + 5.98, Math.PI, 3.4, 1.0, { bg: '#ffffff', stripe: '#d6232a' });
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
