/* Vehicles.js - the cars you own, how they drive, and town traffic.

   Owned cars live in W.cars. Whoever is driving simulates the car locally
   and sends its pose with their player state; the host copies it into
   W.cars so everyone sees it. Traffic is local to each player: it is just
   scenery, except that it really will run you over. */
import * as THREE from '../../lib/three.module.js';
import { makeCar } from '../art/Props.js';
import { VEHICLES, DELIVERY_CAR } from '../data/Data.js';
import { ROADS, RW } from '../world/Town.js';
import { clamp, damp, dampAngle, wrapAngle, pick } from '../core/Util.js';
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
  const turn = clamp(c.spd / 7, -1, 1) * (1.9 - Math.min(0.8, Math.abs(c.spd) / max * 0.8));
  c.yaw += ctrl.steer * turn * dt * (ctrl.brake ? 1.6 : 1);
  c.x += Math.sin(c.yaw) * c.spd * dt; c.z += Math.cos(c.yaw) * c.spd * dt;
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
    c.spd *= -0.25;
  }
  return hit;
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
      const spec = carSpec(mine.c.kind);
      const ctrl = frozen ? { thr: 0, steer: 0, brake: 1 } : { thr: I.axis('KeyS', 'KeyW'), steer: I.axis('KeyD', 'KeyA'), brake: I.held('Space') };
      const m = this.ensure(mine.c);
      const hit = drive(this.local, ctrl, dt, g.town.col, spec, m.C.S.len, m.C.S.wid);
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
    }
    for (const [id, m] of this.meshes) if (!seen.has(id)) { g.scene.remove(m.C.group); this.meshes.delete(id); }
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
      c.cur = damp(c.cur, want, want < c.cur ? 5 : 1.5, dt);
      c.t += c.cur * dt / L;
      if (c.t >= 1) { const prev = c.from; c.from = c.to; c.to = this._next(c.from, prev); c.t = 0; continue; }
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
