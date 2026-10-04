/* Vehicles.js - the cars you own, how they drive, and town traffic.

   Owned cars live in W.cars. Whoever is driving simulates the car locally
   and sends its pose with their player state; the host copies it into
   W.cars so everyone sees it. Traffic is local to each player: it is just
   scenery, except that it really will run you over. */
import * as THREE from '../../lib/three.module.js';
import { makeCar, makeItem } from '../art/Props.js';
import { makeCockpit } from '../art/Cockpit.js';
import { lookFor } from './Player.js';
import { VEHICLES, DELIVERY_CAR, kgOf } from '../data/Data.js';
import { ROADS, RW } from '../world/Town.js';
import { clamp, damp, dampAngle, wrapAngle, pick, rand } from '../core/Util.js';
import { BARK } from '../data/Data.js';

export function carSpec(kind) { return VEHICLES[kind] || DELIVERY_CAR; }

/** arcade driving: ctrl = { thr, steer, brake }. Returns impact speed if it hit something. */
export function drive(c, ctrl, dt, col, spec, len = 3.6, wid = 1.8) {
  const max = spec.speed, acc = spec.accel;
  if (ctrl.thr > 0) c.spd += (c.spd < 0 ? acc * 2 : acc) * ctrl.thr * dt;
  else if (ctrl.thr < 0) c.spd += (c.spd > 0 ? -acc * 2.2 : -acc * 0.6) * -ctrl.thr * dt;
  else c.spd = damp(c.spd, 0, 0.8, dt);
  if (ctrl.brake) c.spd = damp(c.spd, 0, 4, dt);
  c.spd = clamp(c.spd, -max * 0.4, max);
  const turn = clamp(c.spd / 7, -1, 1) * (1.9 - Math.min(0.8, Math.abs(c.spd) / max * 0.8)) * (spec.getaway ? 1.25 : 1);
  c.yaw += ctrl.steer * turn * dt * (ctrl.brake ? 1.6 : 1);
  // the body keeps some of its old direction: low grip (or rain) means it slides
  const fx = Math.sin(c.yaw) * c.spd, fz = Math.cos(c.yaw) * c.spd;
  if (c.vx == null) { c.vx = fx; c.vz = fz; }
  const grip = (spec.grip ?? 1) * (spec.wet ? 0.6 : 1) * (ctrl.brake ? 0.55 : 1);
  const k = 1 - Math.exp(-grip * 7 * dt);
  c.vx += (fx - c.vx) * k; c.vz += (fz - c.vz) * k;
  c.slip = Math.hypot(fx - c.vx, fz - c.vz);
  c.x += c.vx * dt; c.z += c.vz * dt;
  // collide as three circles along the body
  let hit = 0, px = 0, pz = 0, n = 0;
  const r = wid * 0.55;
  for (const k of [-0.32, 0, 0.32]) {
    const cx = c.x + Math.sin(c.yaw) * len * k, cz = c.z + Math.cos(c.yaw) * len * k;
    const o = col.resolve(cx, cz, r, 0, 0.5);
    if (o.hit) { px += o.x - cx; pz += o.z - cz; n++; }
  }
  if (n) {
    c.x += px / n; c.z += pz / n;
    hit = Math.abs(c.spd);
    c.spd *= -0.25; c.vx *= -0.25; c.vz *= -0.25;
  }
  return hit;
}

/** cargo weight: what an item weighs / what a car holds, in KG */
export const unitsOf = (it) => kgOf(it);
export const cargoUsed = (c) => Math.round((c.cargo || []).reduce((s, it) => s + kgOf(it), 0));
/** things that can go in a vehicle */
export const LOADABLE = new Set(['box', 'crate', 'bag', 'equip', 'furn', 'trophy']);
const ITEM_NAME = (it) => it.k === 'box' ? 'pizza box' : it.k === 'bag' ? 'trash bag (' + it.name + ', wriggling)' : it.k === 'crate' ? 'crate of ' + (it.s || 'supplies') : it.k === 'equip' || it.k === 'furn' ? (it.label || 'box') : it.k === 'trophy' ? 'stolen trophy' : 'thing';
/** footprint of an item in a cargo hold: [width, length, height] */
function footprint(it) {
  if (it.k === 'box') return [0.62, 0.62, 0.14];
  if (it.k === 'crate') return [0.66, 0.52, 0.46];
  if (it.k === 'bag') return [0.9, 0.8, 1.1];
  if (it.k === 'trophy') return [0.55, 0.55, 0.7];
  if (it.k === 'equip' || it.k === 'furn') { const s = it.size || [1, 1, 1]; return s; }
  return [0.6, 0.6, 0.5];
}
/** lay items out in a cargo hold: rows across, then deeper, then up. Pizza boxes stack in towers of 6. */
export function packCargo(items, area) {
  const out = [], towers = [];
  let x = 0, z = 0, y = 0, rowL = 0, layerH = 0;
  for (const it of items) {
    if (it.k === 'box') { const t = towers.find(t => t.n < 6); if (t) { t.n++; out.push({ it, x: t.x, y: t.y + t.n * 0.14 - 0.14, z: t.z }); continue; } }
    let [w, l, h] = footprint(it);
    const s = Math.min(1, area.w / w, area.l / l, area.h / h);   // big things squeeze into small vehicles
    w *= s; l *= s; h *= s;
    if (x + w > area.w + 0.01) { x = 0; z += rowL; rowL = 0; }
    if (z + l > area.l + 0.01) { x = 0; z = 0; rowL = 0; y += layerH; layerH = 0; }
    if (y + h > area.h + 0.6) break;   // the rest doesn't show (it's in there somewhere)
    const p = { it, s, x: area.x - area.w / 2 + x + w / 2, y: area.y + y, z: area.z + area.l / 2 - z - l / 2 };
    out.push(p);
    if (it.k === 'box') towers.push({ x: p.x, y: p.y, z: p.z, n: 1 });
    x += w; rowL = Math.max(rowL, l); layerH = Math.max(layerH, h);
  }
  return out;
}

export class Vehicles {
  constructor(game) {
    this.g = game;
    this.meshes = new Map(); // car id -> {C, kind}
    this.local = null;       // the car I am driving: {id, x, z, yaw, spd}
    this.crashT = 0;
  }

  ensure(car) {
    let m = this.meshes.get(car.id);
    if (!m || m.kind !== car.kind) {
      if (m) this.g.scene.remove(m.C.group);
      const C = makeCar(car.kind === 'delivery' ? 'delivery' : car.kind);
      this.g.scene.add(C.group);
      m = { C, kind: car.kind, x: car.x, z: car.z, yaw: car.yaw };
      this.meshes.set(car.id, m);
    }
    return m;
  }

  car(id) { return this.g.W.cars.find(c => c.id === id); }
  nearest(x, z, r = 3.6) {
    let best = null, bd = r;
    for (const c of this.g.W.cars) { const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = c; } }
    return best;
  }

  /** host: someone wants in */
  enter(pid, id) {
    const c = this.car(id); if (!c) return;
    this.exit(pid);
    const m = this.ensure(c); const seats = m.C.seats.length;
    if (!c.drv) c.drv = pid;
    else if (c.pas.length < seats - 1) c.pas.push(pid);
    else return;
    this.g.dirty();
  }
  exit(pid) {
    for (const c of this.g.W.cars) {
      if (c.drv === pid) c.drv = null;
      c.pas = c.pas.filter(p => p !== pid);
    }
    this.g.dirty();
  }
  seatOf(pid) {
    for (const c of this.g.W.cars) { if (c.drv === pid) return { c, seat: 0 }; const i = c.pas.indexOf(pid); if (i >= 0) return { c, seat: i + 1 }; }
    return null;
  }

  update(dt) {
    const g = this.g, P = g.player;
    const mine = this.seatOf(g.me);
    // keep the local player's car state in step with W
    if (mine && mine.seat === 0) {
      if (!this.local || this.local.id !== mine.c.id) this.local = { id: mine.c.id, x: mine.c.x, z: mine.c.z, yaw: mine.c.yaw, spd: 0 };
    } else this.local = null;
    P.car = mine ? mine.c.id : null; P.seat = mine ? mine.seat : 0;

    if (this.local) {
      const I = g.input, frozen = g.frozen();
      const spec = { ...carSpec(mine.c.kind), wet: g.W.weather?.k === 'storm' };
      // a full vehicle is a slow vehicle
      const load = Math.min(1, cargoUsed(mine.c) / spec.cap);
      spec.accel *= 1 - 0.4 * load; spec.speed *= 1 - 0.15 * load;
      const ctrl = frozen ? { thr: 0, steer: 0, brake: 1 } : { thr: I.axis('KeyS', 'KeyW'), steer: I.axis('KeyD', 'KeyA'), brake: I.held('Space') };
      // the Rusty Scooter: wobbly steering, coughs now and then
      if (spec.clunky && !frozen) {
        ctrl.steer += Math.sin(performance.now() * 0.0037) * 0.12 * Math.min(1, Math.abs(this.local.spd) / 8);
        this._cough = (this._cough || 3) - dt;
        if (this._cough <= 0) { this._cough = rand(3, 7); if (ctrl.thr > 0) { this.local.spd *= 0.85; g.audio.noise(0.18, 0.06, 'lowpass', 500, 1); g.fx.smoke(this.local.x - Math.sin(this.local.yaw) * 0.9, 0.5, this.local.z - Math.cos(this.local.yaw) * 0.9, 3, 0.6); } }
      }
      const m = this.ensure(mine.c);
      const hit = drive(this.local, ctrl, dt, g.town.col, spec, m.C.S.len, m.C.S.wid);
      // tyre smoke when you slide
      if (this.local.slip > 4 && Math.random() < dt * 20) for (const s of [-1, 1]) g.fx.smoke(this.local.x - Math.sin(this.local.yaw) * m.C.S.len * 0.35 + Math.cos(this.local.yaw) * s * 0.8, 0.3, this.local.z - Math.cos(this.local.yaw) * m.C.S.len * 0.35 - Math.sin(this.local.yaw) * s * 0.8, 1, 0.1);
      if (this.local.slip > 6 && Math.random() < dt * 3) g.audio.noise(0.25, 0.05, 'highpass', 3000, 2);
      if (hit > 7 && this.crashT <= 0) { g.audio.crash(P.pos); g.fx.shake = Math.min(1, hit / 25); this.crashT = 0.6; }
      this.crashT -= dt;
      if (hit > 4 && ctrl.thr === 0 && hit < 7) g.audio.thud(P.pos);
      if (I.held('KeyH') || I.pressed('KeyH')) { if (!this._honk || this._honk < 0) { g.audio.honk(); this._honk = 0.4; } }
      this._honk = (this._honk || 0) - dt;
      mine.c.x = this.local.x; mine.c.z = this.local.z; mine.c.yaw = this.local.yaw; mine.c.spd = this.local.spd;
      g.audio.engine = 0.3 + Math.min(1, Math.abs(this.local.spd) / spec.speed);
    } else g.audio.engine = mine ? 0.25 : 0;

    // draw every owned car
    const seen = new Set();
    for (const c of g.W.cars) {
      seen.add(c.id);
      const m = this.ensure(c);
      if (this.local && c.id === this.local.id) { m.x = c.x; m.z = c.z; m.yaw = c.yaw; }
      else { m.x = damp(m.x, c.x, 10, dt); m.z = damp(m.z, c.z, 10, dt); m.yaw = dampAngle(m.yaw, c.yaw, 10, dt); if (Math.hypot(m.x - c.x, m.z - c.z) > 10) { m.x = c.x; m.z = c.z; } }
      const G = m.C.group;
      const dx = m.x - G.position.x, dz = m.z - G.position.z;
      const sp = Math.hypot(dx, dz) / Math.max(dt, 1e-3);
      G.position.set(m.x, 0, m.z); G.rotation.y = m.yaw;
      for (const w of m.C.wheels) w.rotation.x += sp * dt * 2.5;
      m.C.body.rotation.z = Math.sin(performance.now() * 0.03) * 0.005 * Math.min(1, sp / 5);
      // put the people in their seats
      const seatPos = (i) => { const s = m.C.seats[i] || m.C.seats[0]; const v = new THREE.Vector3(s.x, s.y - 0.35, s.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), m.yaw); return { x: m.x + v.x, y: v.y, z: m.z + v.z }; };
      const place = (pid, i) => {
        const p = seatPos(i);
        if (pid === g.me) { P.pos.set(p.x, p.y, p.z); P.yaw = m.yaw; P.rig.root.position.set(p.x, p.y, p.z); P.rig.root.rotation.y = m.yaw; P.rig.root.scale.setScalar(0.85); P.rig.anim(dt, { sit: true, drive: i === 0, carry: false }); }
        else { const r = g.remotes.get(pid); if (r) { r.pos.set(p.x, p.y, p.z); r.target.set(p.x, p.y, p.z); r.tyaw = m.yaw; } }
      };
      if (c.drv) place(c.drv, 0);
      c.pas.forEach((p, i) => place(p, i + 1));
      // what's in the back: packed into the cargo hold, where you can see it
      const key = JSON.stringify(c.cargo || []);
      if (m.cargoKey !== key) {
        m.cargoKey = key;
        if (m.cargoG) m.C.body.remove(m.cargoG);
        m.cargoG = new THREE.Group();
        const area = m.C.hold || (m.C.bed && { x: m.C.bed.x, y: m.C.bed.y, z: m.C.bed.z, w: m.C.bed.w || 0.6, l: m.C.bed.l || 0.5, h: 1 });
        if (area) for (const p of packCargo((c.cargo || []).slice(0, 120), area)) {
          const g2 = makeItem(p.it); g2.scale.setScalar(0.92 * (p.s || 1));
          g2.position.set(p.x, p.y, p.z);
          m.cargoG.add(g2);
        }
        m.C.body.add(m.cargoG);
      }
      // doors and lids: open when somebody is at the back (or loading)
      if (m.C.doors?.length) {
        const r = this.rear(c), near = !P.car && Math.hypot(P.pos.x - r.x, P.pos.z - r.z) < 3.2;
        const open = near || [...g.remotes.values()].some(rm => rm.s && !rm.s.car && Math.hypot(rm.s.x - r.x, rm.s.z - r.z) < 3.2);
        m.doorK = damp(m.doorK || 0, open ? 1 : 0, 6, dt);
        for (const d of m.C.doors) d.pivot.rotation[d.axis] = d.open * m.doorK;
        if (m.C.hideCargoClosed) m.cargoG.visible = m.doorK > 0.15;
      }
    }
    for (const [id, m] of this.meshes) if (!seen.has(id)) { g.scene.remove(m.C.group); this.meshes.delete(id); }
    this._cockpit(dt, mine);
  }

  /** first person in a car: hide the outside of it and draw the inside */
  _cockpit(dt, mine) {
    const g = this.g, P = g.player;
    const m = mine && this.meshes.get(mine.c.id);
    const on = !!(m && g.cam.mode === 'first' && !m.C.S.scooter && mine.seat < 2);
    for (const [id, mm] of this.meshes) mm.C.group.visible = !(on && id === mine.c.id);
    if (!on) { if (this.cockpit) this.cockpit.group.visible = false; return; }
    const key = mine.c.kind + ':' + mine.seat + ':' + P.look + ':' + (g.W.wear[g.me] || '');
    if (!this.cockpit || this.cockpit.key !== key) {
      if (this.cockpit) g.scene.remove(this.cockpit.group);
      // the wheel stays on the driver's side; a passenger just doesn't get hands on it
      this.cockpit = makeCockpit(m.C, lookFor(P.look, g.W.wear[g.me]));
      this.cockpit.key = key;
      if (mine.seat !== 0) this.cockpit.hands.visible = false;
      g.scene.add(this.cockpit.group);
    }
    const K = this.cockpit;
    K.group.visible = true;
    K.group.position.set(m.x, 0, m.z); K.group.rotation.y = m.yaw;
    K.group.rotation.z = m.C.body.rotation.z;
    // the wheel follows your steering, the needles follow the car
    const steer = this.local && !g.frozen() ? g.input.axis('KeyD', 'KeyA') : 0;
    K.steer = damp(K.steer || 0, steer, 8, dt);
    K.wheel.rotation.z = -K.steer * 1.4;
    const spd = Math.abs(this.local ? this.local.spd : mine.c.spd || 0), max = carSpec(mine.c.kind).speed;
    K.dials[0].rotation.z = -2.2 + 4.4 * Math.min(1.05, spd / max);
    K.rpm = damp(K.rpm || 0, 0.15 + (spd / max) * 0.6 + (this.local && g.input.held('KeyW') ? 0.25 : 0) + Math.sin(performance.now() * 0.05) * 0.02, 6, dt);
    K.dials[1].rotation.z = -2.2 + 4.4 * Math.min(1, K.rpm);
  }

  /** where the boot is: behind the car */
  rear(c) { const m = this.ensure(c), L = m.C.S.len; return { x: c.x - Math.sin(c.yaw) * (L / 2 + 0.7), z: c.z - Math.cos(c.yaw) * (L / 2 + 0.7) }; }

  /** load and unload prompts at the back of a car */
  targets(P, out) {
    const g = this.g, W = g.W, H = g.hold(g.me), top = H[H.length - 1];
    if (P.car || P.floor !== 0) return;
    for (const c of W.cars) {
      const r = this.rear(c), d = Math.hypot(P.pos.x - r.x, P.pos.z - r.z);
      if (d > 2.4) continue;
      const spec = carSpec(c.kind), used = cargoUsed(c), name = spec.name, kg = used + ' / ' + spec.cap + ' KG';
      const nearHQ = Math.hypot(c.x - 138, c.z - 80) < 16;
      const crates = (c.cargo || []).filter(i => i.k === 'crate').length;
      const last = (c.cargo || [])[c.cargo?.length - 1];
      const takeAlt = last ? { label: 'Take out the ' + ITEM_NAME(last) + ' (' + kgOf(last) + ' KG)', act: { k: 'cargo', id: c.id, op: 'take' } } : null;
      const unloadAlt = nearHQ && crates ? { label: 'Unload all ' + crates + ' crates into the hideout fridge', act: { k: 'cargo', id: c.id, op: 'unloadAll' } } : takeAlt;
      if (top && LOADABLE.has(top.k)) {
        const w = Math.round(kgOf(top));
        if (used + w <= spec.cap) out.push({ x: r.x, z: r.z, d, label: 'Load the ' + ITEM_NAME(top) + ' (' + w + ' KG) into the ' + name + ' · ' + kg, act: { k: 'cargo', id: c.id, op: 'load' }, alt: unloadAlt });
        else out.push({ x: r.x, z: r.z, d, label: 'TOO HEAVY - ' + name.toUpperCase() + ' CAPACITY: ' + spec.cap + ' KG (the ' + ITEM_NAME(top) + ' is ' + w + ' KG, ' + Math.max(0, spec.cap - used) + ' KG free)', warn: true, alt: unloadAlt });
      } else if ((c.cargo || []).length) out.push({ x: r.x, z: r.z, d, label: 'Take out the ' + ITEM_NAME(last) + ' · ' + kg, act: { k: 'cargo', id: c.id, op: 'take' }, alt: unloadAlt !== takeAlt ? unloadAlt : null });
      else out.push({ x: r.x, z: r.z, d, label: 'The ' + name + ': empty · carries ' + spec.cap + ' KG in ' + (spec.storage || 'the back'), info: true });
    }
  }

  /** host: loading and unloading */
  cargo(pid, a) {
    const g = this.g, W = g.W, c = this.car(a.id); if (!c) return;
    c.cargo = c.cargo || [];
    const H = g.hold(pid), top = H[H.length - 1], spec = carSpec(c.kind);
    if (a.op === 'load') {
      if (!top || !LOADABLE.has(top.k)) return;
      if (cargoUsed(c) + kgOf(top) > spec.cap) return g.tell(pid, 'TOO HEAVY - VEHICLE CAPACITY: ' + spec.cap + ' KG');
      c.cargo.push(H.pop()); g.sfx('drop', c);
    } else if (a.op === 'take') {
      if (!c.cargo.length || H.length >= 8) return;
      const lt = c.cargo[c.cargo.length - 1];
      if ((lt.k === 'bag' || lt.k === 'equip' || lt.k === 'furn') && H.length) return g.tell(pid, 'You need both arms for that.');
      if (H.some(i => i.k === 'equip' || i.k === 'furn' || i.k === 'bag')) return g.tell(pid, 'Your arms are full.');
      H.push(c.cargo.pop()); g.sfx('pickup', c);
    } else if (a.op === 'unloadAll') {
      let n = 0;
      c.cargo = c.cargo.filter(it => { if (it.k !== 'crate') return true; W.stock[it.s] = (W.stock[it.s] || 0) + it.n; n++; return false; });
      if (n) { g.tell(pid, n + ' crates carried into the hideout fridge.'); g.sfx('drop', c); g.story.onStock(); }
    }
    g.dirty();
  }

  /** where to put someone getting out */
  exitSpot(c) {
    const s = Math.sin(c.yaw + Math.PI / 2), co = Math.cos(c.yaw + Math.PI / 2);
    for (const side of [1, -1, 2, -2]) {
      const x = c.x + s * 2.2 * side, z = c.z + co * 2.2 * side;
      if (!this.g.town.col.solidAt(x, z, 0.5, 0, 0.35)) return { x, z };
    }
    return { x: c.x, z: c.z + 3 };
  }
}

/* ---------------- traffic: local, follows the road grid ---------------- */
const NODES = []; for (const x of ROADS) for (const z of ROADS) NODES.push({ x, z });
const nodeAt = (x, z) => NODES.find(n => n.x === x && n.z === z);
const STEP = 80;

export class Traffic {
  constructor(game, n = 12) {
    this.g = game; this.cars = [];
    const styles = ['civ1', 'civ2', 'civ3', 'civ4', 'van', 'civ1', 'civ2', 'civ3', 'sports', 'icecream'];
    for (let i = 0; i < n; i++) {
      const a = NODES[(i * 5) % NODES.length];
      const C = makeCar(styles[i % styles.length]);
      game.scene.add(C.group);
      const t = { C, from: a, to: null, t: Math.random(), spd: 10 + Math.random() * 4, cur: 0, reckless: Math.random() < 0.3, honkT: 0, x: a.x, z: a.z, yaw: 0, stuck: 0 };
      t.to = this._next(t.from, null);
      this.cars.push(t);
    }
    // the garbage truck: slow, stops every block or so to chomp, two guys hanging off the back
    const a = NODES[7 % NODES.length], C = makeCar('garbage');
    game.scene.add(C.group);
    const gt = { C, from: a, to: null, t: 0.3, spd: 6.5, cur: 0, reckless: false, honkT: 0, x: a.x, z: a.z, yaw: 0, stuck: 0, garbage: true, stop: 0 };
    gt.to = this._next(a, null);
    this.cars.push(gt);
  }
  /** the intro road must be empty: only the limo is allowed to hit you */
  setVisible(v) { for (const c of this.cars) c.C.group.visible = v; }
  _next(n, prev) {
    const opts = [];
    for (const [dx, dz] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) {
      const m = nodeAt(n.x + dx, n.z + dz);
      if (m && m !== prev) opts.push(m);
    }
    return pick(opts);
  }
  update(dt) {
    const g = this.g, P = g.player;
    for (const c of this.cars) {
      const dx = c.to.x - c.from.x, dz = c.to.z - c.from.z, L = Math.hypot(dx, dz);
      const ux = dx / L, uz = dz / L;
      // keep right: lane is offset to the right of the direction of travel
      const ox = -uz * 3, oz = ux * 3;
      // brake for anything in front (the reckless ones only sometimes)
      let want = c.spd;
      const ahead = (x, z, r) => { const rx = x - c.x, rz = z - c.z, f = rx * ux + rz * uz, s = Math.abs(rx * -uz + rz * ux); return f > 0 && f < r && s < 2; };
      if (P && !P.car && ahead(P.pos.x, P.pos.z, 9) && P.floor === 0) {
        if (!c.reckless) want = 0;
        if (c.honkT <= 0) { g.audio.honk({ x: c.x, z: c.z }); c.honkT = 2; }
      }
      for (const o of this.cars) if (o !== c && ahead(o.x, o.z, 8)) want = Math.min(want, o.cur * 0.5);
      for (const cop of g.police.cars) if (ahead(cop.x, cop.z, 9)) want = 0;
      if (g.vehicles) for (const oc of g.W.cars) if (ahead(oc.x, oc.z, 8)) want = 0;
      c.honkT -= dt;
      if (c.garbage) {
        if (c.stop > 0) {
          c.stop -= dt; want = 0;
          c.C.hopper.rotation.x = -Math.abs(Math.sin(c.stop * 1.6)) * 0.9;
          for (const r of c.C.crew) r.anim(dt, { wave: c.stop > 2.5 });
        } else { c.C.hopper.rotation.x = 0; for (const r of c.C.crew) { r.armR.rotation.x = -2.4; r.armL.rotation.x = -0.3; } }
        if (c.t > 0.45 && c.t < 0.47 && !c.stopped && Math.random() < 0.6) {
          c.stop = 5; c.stopped = true;
          if (P && Math.hypot(P.pos.x - c.x, P.pos.z - c.z) < 25) g.bubble(() => ({ x: c.x, z: c.z, y: 1.5 }), pick(['BEEP. BEEP. BEEP.', 'TRASH DAY! (it\'s always trash day)', 'Morning! Got any pizza boxes? ...Just asking. For a friend.']));
        }
      }
      c.cur = damp(c.cur, want, want < c.cur ? 5 : 1.5, dt);
      c.t += c.cur * dt / L;
      if (c.t >= 1) { const prev = c.from; c.from = c.to; c.to = this._next(c.from, prev); c.t = 0; c.stopped = false; continue; }
      const nx = c.from.x + dx * c.t + ox, nz = c.from.z + dz * c.t + oz;
      c.x = nx; c.z = nz;
      c.yaw = dampAngle(c.yaw, Math.atan2(ux, uz), 8, dt);
      c.C.group.position.set(c.x, 0, c.z); c.C.group.rotation.y = c.yaw;
      for (const w of c.C.wheels) w.rotation.x += c.cur * dt * 2.5;
      // run people over (comedy)
      if (P && !P.car && !P.flying && P.floor === 0 && c.cur > 4 && P.pos.y < 1) {
        const rx = P.pos.x - c.x, rz = P.pos.z - c.z;
        const f = rx * ux + rz * uz, s = rx * -uz + rz * ux;
        if (Math.abs(f) < 2.2 && Math.abs(s) < 1.3) {
          const side = s >= 0 ? 1 : -1;
          P.fling(ux * 0.8 + -uz * side * 0.6, uz * 0.8 + ux * side * 0.6, Math.min(1.3, c.cur / 10));
          g.audio.crash(P.pos); g.audio.scream(P.pos);
          g.fx.shake = 0.6;
          g.bubble(g.me, pick(BARK.hitByCar));
          g.onHitByCar();
          c.cur *= 0.3;
        }
      }
      // and the player's car bumps them
      const lc = g.vehicles.local;
      if (lc && Math.hypot(lc.x - c.x, lc.z - c.z) < 3) {
        const k = 0.5 * Math.sign(lc.spd || 1);
        lc.spd *= -0.3; c.cur = 0;
        lc.x += (lc.x - c.x) * 0.2; lc.z += (lc.z - c.z) * 0.2;
        if (Math.abs(lc.spd) > 2) { g.audio.crash({ x: c.x, z: c.z }); g.fx.shake = 0.4; }
      }
    }
  }
}
