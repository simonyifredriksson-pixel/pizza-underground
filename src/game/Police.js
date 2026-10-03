/* Police.js - the cops, the squad cars, the inspector.

   Cops patrol the sidewalks. Anyone they can SEE carrying pizza (boxes,
   dough, anything) fills their suspicion meter - faster up close, faster
   if you are running, slower in a disguise or when you "act natural" (X).
   A full meter is a chase. Break line of sight, hide in a dumpster or just
   outrun them. If they catch you: the pizza is evidence, and there's a fine.
   Squad cars chase delivery vehicles with pizza in them. The host runs it
   all and sends positions to everyone. */
import * as THREE from '../../lib/three.module.js';
import { makeChar } from '../art/Chars.js';
import { makeCar } from '../art/Props.js';
import { ROADS, HQ } from '../world/Town.js';
import { BARK, DISGUISES, VEHICLES } from '../data/Data.js';
import { isContraband } from './State.js';
import { roomAt } from '../data/Hideout.js';
import { drive } from './Vehicles.js';
import { pick, damp, dampAngle, clamp, rand, wrapAngle } from '../core/Util.js';

const COP_LOOK = { hat: 'cop', shirt: '#2a3a7a', pants: '#1e2a5a', badge: true, buttons: '#ffd23f' };
const INSP_LOOK = { hat: 'fedora', hatColor: '#6a6a7a', coat: '#9a9aaa', glasses: 'round', mustache: '#d0d0d0', hair: '#d0d0d0', skin: '#f2c29b' };

/* the sidewalk graph: four corners round every junction */
const NODES = [];
for (const x of ROADS) for (const z of ROADS) for (const sx of [-1, 1]) for (const sz of [-1, 1]) NODES.push({ x: x + sx * 8, z: z + sz * 8, i: NODES.length });
for (const n of NODES) n.nb = NODES.filter(m => m !== n && ((m.x === n.x && Math.abs(m.z - n.z) <= 64) || (m.z === n.z && Math.abs(m.x - n.x) <= 64)));
function nearestNode(x, z) { let b = NODES[0], bd = 1e9; for (const n of NODES) { const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; b = n; } } return b; }
function path(a, b) { // BFS on the sidewalk graph
  const prev = new Map([[a, null]]), q = [a];
  while (q.length) { const n = q.shift(); if (n === b) break; for (const m of n.nb) if (!prev.has(m)) { prev.set(m, n); q.push(m); } }
  const out = []; let n = b; while (n) { out.unshift(n); n = prev.get(n); } return out;
}
const RNODES = []; for (const x of ROADS) for (const z of ROADS) RNODES.push({ x, z });
export { path, nearestNode };

let SEQ = 1;

export class Police {
  constructor(game) {
    this.g = game;
    this.cops = [];   // host: full state; client: as received
    this.cars = [];
    this.rigs = new Map(); this.carMeshes = new Map();
    this.chasingMe = false;
    this.alertT = 0;
  }

  /* ---------------- host ---------------- */
  spawnCop(kind = 'cop', at) {
    const s = at || this.g.town.poi.copSpawn;
    const c = { id: SEQ++, kind, x: s.x + rand(-2, 2), z: s.z + rand(-1, 1), yaw: 0, st: 'patrol', node: null, tx: s.x, tz: s.z, sus: {}, lost: 0, barkT: rand(5, 15), stun: 0, spd: 0 };
    c.node = nearestNode(c.x, c.z);
    this.cops.push(c); return c;
  }
  spawnCar() {
    const n = RNODES[Math.floor(Math.random() * RNODES.length)];
    const c = { id: SEQ++, x: n.x, z: n.z, yaw: 0, spd: 0, st: 'patrol', from: n, to: null, tgt: null, lost: 0, siren: 0 };
    c.to = this._rnext(n, null);
    this.cars.push(c); return c;
  }
  _rnext(n, prev) { const o = RNODES.filter(m => m !== prev && ((m.x === n.x && Math.abs(m.z - n.z) === 80) || (m.z === n.z && Math.abs(m.x - n.x) === 80))); return o[Math.floor(Math.random() * o.length)]; }

  /** host: who's out there - fed by Game from local + remote states */
  hostUpdate(dt, players) {
    const g = this.g, W = g.W;
    if (W.quest < 4) return; // no police around until you know pizza is illegal
    // headcount follows the heat
    const footWanted = clamp(3 + Math.floor(W.heat / 12), 3, 10) - (W.ending ? 1 : 0);
    const carWanted = clamp(1 + Math.floor(W.heat / 30), 1, 4);
    const patrol = this.cops.filter(c => c.kind === 'cop' && !c.fixed);
    if (patrol.length < footWanted) this.spawnCop();
    else if (patrol.length > footWanted) { const c = patrol.find(c => c.st === 'patrol' && players.every(p => Math.hypot(p.x - c.x, p.z - c.z) > 60)); if (c) this.cops.splice(this.cops.indexOf(c), 1); }
    if (this.cars.length < carWanted) this.spawnCar();
    else if (this.cars.length > carWanted) { const c = this.cars.find(c => c.st === 'patrol'); if (c) this.cars.splice(this.cars.indexOf(c), 1); }
    if (!this.cops.some(c => c.kind === 'yard')) { const y = this.spawnCop('yard', g.town.poi.yardGuard); y.fixed = true; y.st = 'guard'; y.x = g.town.poi.yardGuard.x; y.z = g.town.poi.yardGuard.z; }

    const col = g.town.col;
    // security cameras: warn when a cop comes near the hideout
    if (W.owned.up.camera) {
      const near = this.cops.some(c => c.kind !== 'yard' && Math.hypot(c.x - HQ.door.x, c.z - HQ.door.z) < 28) || this.cars.some(c => Math.hypot(c.x - HQ.door.x, c.z - HQ.door.z) < 30);
      if (near && !this._camWarn) g.tell(null, 'SECURITY CAMERA: cop outside the hideout!');
      this._camWarn = near;
    }
    for (const c of [...this.cops]) {
      if (c.stun > 0) { c.stun -= dt; c.spd = 0; if (c.stun <= 0 && c.st === 'stun') c.st = c.fixed ? 'guard' : 'patrol'; continue; }
      if (c.kind === 'insp') { this._inspector(c, dt, players); continue; }
      if (c.kind === 'officer') continue; // the inspection moves these
      // look for crime
      if (c.st !== 'chase') for (const p of players) this._watch(c, p, dt);
      let tx = c.tx, tz = c.tz, speed = 3.0;
      if (c.st === 'patrol') {
        if (Math.hypot(c.x - c.node.x, c.z - c.node.z) < 1.2) c.node = pick(c.node.nb);
        tx = c.node.x; tz = c.node.z; speed = 3.0;
      } else if (c.st === 'guard') {
        tx = c.gx ?? c.x; tz = c.gz ?? c.z; speed = 2.5;
        if (c.kind === 'yard') { const home = g.town.poi.yardGuard; tx = home.x; tz = home.z; c.sweep = (c.sweep || 0) + dt * 0.5; }
      } else if (c.st === 'chase') {
        const p = players.find(q => q.id === c.tgt);
        if (!p || p.hidden || p.floor !== 0 || roomAt(p.x, p.z, p.floor)) { c.lost = 99; }
        else {
          const sees = Math.hypot(p.x - c.x, p.z - c.z) < 45 && !col.blocked(c.x, c.z, p.x, p.z, 0);
          if (sees) { c.lx = p.x; c.lz = p.z; c.lost = 0; } else c.lost += dt;
          if (p.car) c.lost += dt * 1.5;
          // caught
          if (sees && !p.car && Math.hypot(p.x - c.x, p.z - c.z) < 1.4) {
            g.bust(p.id, c.kind === 'yard' ? '"This is the EVIDENCE YARD, genius. Trespassing fine."' : pick(BARK.copCatch), 0.03, 4, c);
            c.st = 'stun'; c.stun = 4; c.tgt = null;
            continue;
          }
        }
        tx = c.lx; tz = c.lz; speed = 8.3;
        if (c.lost > 5) { c.st = 'search'; c.searchT = 6; this._bark(c, pick(BARK.copLost)); }
      } else if (c.st === 'search') {
        c.searchT -= dt; speed = 3.5;
        if (Math.hypot(tx - c.x, tz - c.z) < 1) { c.tx = c.x + rand(-6, 6); c.tz = c.z + rand(-6, 6); }
        if (c.searchT <= 0) { c.st = c.fixed ? 'guard' : 'patrol'; c.node = nearestNode(c.x, c.z); }
      } else if (c.st === 'walk') { // going to a point (checkpoint)
        speed = 4.5;
        if (Math.hypot(c.tx - c.x, c.tz - c.z) < 1) c.st = 'guard';
      }
      // move
      const dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz);
      if (d > 0.3) {
        const sp = Math.min(speed, d / dt);
        c.x += dx / d * sp * dt; c.z += dz / d * sp * dt;
        c.yaw = dampAngle(c.yaw, Math.atan2(dx, dz), 8, dt);
        c.spd = sp;
      } else {
        c.spd = 0;
        if (c.kind === 'yard') c.yaw = Math.PI / 2 + Math.sin(c.sweep || 0) * 1.4;
      }
      const r = col.resolve(c.x, c.z, 0.38, 0, 0);
      c.x = r.x; c.z = r.z;
      c.barkT -= dt;
      if (c.barkT <= 0) { c.barkT = rand(14, 30); if (c.st === 'patrol' && players.some(p => Math.hypot(p.x - c.x, p.z - c.z) < 12)) this._bark(c, pick(BARK.copIdle)); }
    }
    for (const car of this.cars) this._car(car, dt, players);
  }

  _bark(c, text) { this.g.broadcastEvent({ k: 'bark', cop: c.id, text }); }

  /** fill this cop's suspicion of player p */
  _watch(c, p, dt) {
    const g = this.g, W = g.W;
    if (p.hidden || p.floor !== 0 || roomAt(p.x, p.z, 0)) { c.sus[p.id] = Math.max(0, (c.sus[p.id] || 0) - dt * 0.4); return; }
    const H = g.hold(p.id);
    const contra = H.filter(isContraband).length;
    const open = H.some(i => i.k === 'pizza' || i.k === 'base' || i.k === 'dough');
    const wear = DISGUISES[W.wear[p.id]];
    let R = (c.kind === 'yard' ? 13 : 16) * (wear ? wear.detect : 1) * (W.ending ? 0.7 : 1);
    if (p.car) R *= 0.6;
    let rate = 0;
    if (c.kind === 'yard') {
      // the evidence yard: anybody inside it is a criminal
      const y = g.town.poi.yardGuard;
      if (p.x > 84 && p.x < 110 && p.z > 12 && p.z < 30 && !p.car) rate = 1.6;
    } else if (!p.car) {
      if (contra) rate = 0.5 + 0.12 * contra + (open ? 0.8 : 0);
      if (p.run && contra) rate += 0.6;
      if (p.run && W.law?.k === 'running') rate = Math.max(rate, 0.9);
      if (p.nat && !p.run) rate *= 0.5;
      if (W.wear[p.id] === 'cop' && !p.run) rate *= 0.2;
    }
    const d = Math.hypot(p.x - c.x, p.z - c.z);
    const fov = c.kind === 'yard' ? 0.6 : 0.1;
    const facing = d < 3 || ((p.x - c.x) * Math.sin(c.yaw) + (p.z - c.z) * Math.cos(c.yaw)) / d > fov;
    if (rate > 0 && d < R && facing && !this.g.town.col.blocked(c.x, c.z, p.x, p.z, 0)) {
      c.sus[p.id] = (c.sus[p.id] || 0) + rate * dt * (1.5 - d / R);
      if (c.sus[p.id] >= 1) {
        c.sus[p.id] = 0; c.st = 'chase'; c.tgt = p.id; c.lx = p.x; c.lz = p.z; c.lost = 0;
        this._bark(c, p.run ? pick(BARK.copRunning) : pick(BARK.copSpot));
        g.broadcastEvent({ k: 'spotted', pid: p.id, cop: c.id });
      }
    } else c.sus[p.id] = Math.max(0, (c.sus[p.id] || 0) - dt * 0.3);
  }

  _car(c, dt, players) {
    const g = this.g, W = g.W, col = g.town.col;
    if (c.st === 'parked') { c.spd = 0; return; }
    c.siren = c.st === 'chase' ? 1 : 0;
    if (c.st === 'patrol') {
      const dx = c.to.x - c.from.x, dz = c.to.z - c.from.z, L = Math.hypot(dx, dz) || 1;
      const ux = dx / L, uz = dz / L;
      c.t = (c.t || 0) + 12 * dt / L;
      if (c.t >= 1) { const prev = c.from; c.from = c.to; c.to = this._rnext(c.from, prev); c.t = 0; }
      c.x = c.from.x + dx * c.t - uz * 3; c.z = c.from.z + dz * c.t + ux * 3;
      c.yaw = dampAngle(c.yaw, Math.atan2(ux, uz), 6, dt); c.spd = 12;
      // spot a delivery vehicle full of pizza
      for (const p of players) {
        if (!p.car || p.carSeat !== 0) continue;
        const veh = W.cars.find(v => v.id === p.car); if (!veh) continue;
        const sus = (VEHICLES[veh.kind]?.sus ?? 1);
        if (sus === 0 && W.heat < 80) continue;
        const crew = [veh.drv, ...veh.pas].filter(Boolean);
        const contra = crew.some(id => g.hold(id).some(isContraband)) || (veh.cargo || []).length > 0;
        if (!contra) continue;
        const d = Math.hypot(veh.x - c.x, veh.z - c.z);
        if (d < 26 * Math.max(0.3, sus) * (W.ending ? 0.7 : 1) * (W.weather?.k === 'storm' ? 0.75 : 1) && !col.blocked(c.x, c.z, veh.x, veh.z, 0)) {
          c.st = 'chase'; c.tgt = veh.id; c.lost = 0;
          g.broadcastEvent({ k: 'spotted', pid: p.id, car: true });
        }
      }
    } else if (c.st === 'chase') {
      const veh = W.cars.find(v => v.id === c.tgt);
      if (!veh || !veh.drv) { c.st = 'return'; return; }
      const dx = veh.x - c.x, dz = veh.z - c.z, d = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      const steer = clamp(wrapAngle(want - c.yaw) * 2, -1, 1);
      drive(c, { thr: 1, steer, brake: Math.abs(wrapAngle(want - c.yaw)) > 1.6 && c.spd > 10 }, dt, col, { speed: 27, accel: 18 }, 3.9, 1.9);
      if (d > 85 || col.blocked(c.x, c.z, veh.x, veh.z, 0)) c.lost += dt * (VEHICLES[veh.kind]?.getaway ? 2 : 1); else c.lost = 0;
      if (c.lost > 7) { c.st = 'return'; g.broadcastEvent({ k: 'lostcar' }); }
      if (d < 3.6) {
        const vs = Math.abs(veh.spd || 0);
        if (veh.kind === 'armored') { if (Math.random() < dt) g.tell(null, '"STOP THAT TRUCK!" (They can\'t. It\'s armored.)'); }
        else if (vs < 7 || d < 2.8) {
          for (const id of [veh.drv, ...veh.pas].filter(Boolean)) g.bust(id, 'PULLED OVER! "License, registration and... is that PEPPERONI?"', 0.04, 5);
          c.st = 'return'; c.spd = 0;
        }
      }
    } else if (c.st === 'return') {
      // get back onto the road grid
      let best = RNODES[0], bd = 1e9; for (const n of RNODES) { const d = Math.hypot(n.x - c.x, n.z - c.z); if (d < bd) { bd = d; best = n; } }
      const dx = best.x - c.x, dz = best.z - c.z;
      drive(c, { thr: 0.6, steer: clamp(wrapAngle(Math.atan2(dx, dz) - c.yaw) * 2, -1, 1), brake: false }, dt, col, { speed: 14, accel: 10 }, 3.9, 1.9);
      if (bd < 4) { c.st = 'patrol'; c.from = best; c.to = this._rnext(best, null); c.t = 0; }
    }
  }

  /* ---------------- the inspector ---------------- */
  startInspector(slow) {
    const g = this.g;
    const c = this.spawnCop('insp', g.town.poi.policeDoor);
    c.st = 'walk'; c.fixed = true;
    const a = nearestNode(c.x, c.z), b = nearestNode(HQ.door.x - 6, HQ.door.z);
    c.route = path(a, b).map(n => ({ x: n.x, z: n.z }));
    c.route.push({ x: HQ.door.x - 3, z: HQ.door.z }, { x: HQ.door.x + 0.5, z: HQ.door.z }, { x: 146, z: 80 });
    c.speed = slow ? 2.4 : 3.2;
    return c;
  }
  routeLeft(c) {
    let d = 0, x = c.x, z = c.z;
    for (const p of c.route) { d += Math.hypot(p.x - x, p.z - z); x = p.x; z = p.z; }
    return d;
  }
  _inspector(c, dt) {
    const g = this.g;
    if (c.st === 'walk' && c.route.length) {
      const p = c.route[0], dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
      if (d < 0.6) { c.route.shift(); if (!c.route.length) { c.st = 'inspect'; c.inspT = 6; g.events.inspectorArrived(c); } }
      else { const s = Math.min(c.speed, d / dt); c.x += dx / d * s * dt; c.z += dz / d * s * dt; c.yaw = dampAngle(c.yaw, Math.atan2(dx, dz), 8, dt); c.spd = s; }
    } else if (c.st === 'inspect') {
      c.spd = 0; c.yaw += dt * 1.2; c.inspT -= dt;
      if (c.inspT <= 0) { c.st = 'leave'; c.route = [{ x: HQ.door.x - 4, z: HQ.door.z }, { x: 120, z: 80 }, { x: 100, z: 48 }]; }
    } else if (c.st === 'leave') {
      const p = c.route[0];
      if (!p) { this.cops.splice(this.cops.indexOf(c), 1); return; }
      const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
      if (d < 0.8) c.route.shift(); else { c.x += dx / d * 3.2 * dt; c.z += dz / d * 3.2 * dt; c.yaw = Math.atan2(dx, dz); c.spd = 3.2; }
    }
  }

  /* ---------------- checkpoints ---------------- */
  checkpoint(on) {
    for (const c of this.cops.filter(c => c.kind === 'check')) this.cops.splice(this.cops.indexOf(c), 1);
    if (!on) return null;
    const x = ROADS[Math.floor(Math.random() * 4)], z = ROADS[Math.floor(Math.random() * 4)];
    for (const s of [-1, 1]) { const c = this.spawnCop('check', { x: x + s * 4, z: z + 6 }); c.fixed = true; c.st = 'walk'; c.tx = x + s * 3; c.tz = z; c.gx = c.tx; c.gz = c.tz; }
    return { x, z };
  }
  /** host: checkpoint cops stop cars with pizza in them */
  checkpointUpdate(players) {
    const g = this.g, W = g.W, cp = W.event?.cp;
    if (!cp) return;
    for (const p of players) {
      if (!p.car || p.carSeat !== 0) continue;
      const veh = W.cars.find(v => v.id === p.car); if (!veh) continue;
      if (Math.hypot(veh.x - cp.x, veh.z - cp.z) > 8) { veh._cp = false; continue; }
      if (veh._cp) continue; veh._cp = true;
      const crew = [veh.drv, ...veh.pas].filter(Boolean);
      if (veh.kind === 'icecream' && W.heat < 80) { g.tell(p.id, 'Checkpoint cop: "Ice cream! Nice. Go ahead."'); continue; }
      if (veh.kind === 'armored') { g.tell(p.id, 'You blew straight through the checkpoint. Armored truck, baby.'); g.addHeat(5); continue; }
      if (crew.some(id => g.hold(id).some(isContraband))) for (const id of crew) g.bust(id, 'CHECKPOINT! "Pop the trunk. ...Is that a PIZZA?"', 0.05, 6);
      else g.tell(p.id, 'Checkpoint cop: "Clean. Move along."');
    }
  }

  /** host: a player's car ran into a cop */
  carHit(veh) {
    for (const c of this.cops) {
      if (c.stun > 0 || c.kind === 'insp' || c.kind === 'yard') continue;
      if (Math.hypot(c.x - veh.x, c.z - veh.z) < 2.4 && Math.abs(veh.spd || 0) > 6) {
        c.st = 'stun'; c.stun = 5; c.fly = 1;
        this.g.addHeat(4);
        this.g.broadcastEvent({ k: 'copHit', cop: c.id, x: c.x, z: c.z });
      }
    }
  }

  /* ---------------- network ---------------- */
  snapshot() {
    return {
      c: this.cops.map(c => [c.id, +c.x.toFixed(2), +c.z.toFixed(2), +c.yaw.toFixed(2), c.st, c.kind, +(c.spd || 0).toFixed(1), c.tgt || 0, c.stun > 0 ? 1 : 0, Math.round(Math.max(0, ...Object.values(c.sus).concat(0)) * 100)]),
      v: this.cars.map(c => [c.id, +c.x.toFixed(2), +c.z.toFixed(2), +c.yaw.toFixed(2), c.siren, +(c.spd || 0).toFixed(1)]),
    };
  }
  applySnapshot(s) {
    this.cops = s.c.map(a => ({ id: a[0], x: a[1], z: a[2], yaw: a[3], st: a[4], kind: a[5], spd: a[6], tgt: a[7], stun: a[8], susMax: a[9] / 100 }));
    this.cars = s.v.map(a => ({ id: a[0], x: a[1], z: a[2], yaw: a[3], siren: a[4], spd: a[5] }));
  }

  /* ---------------- everyone: draw ---------------- */
  sync(dt) {
    const g = this.g, seen = new Set();
    let siren = 0, chased = false, maxSus = 0;
    const me = g.me, P = g.player;
    for (const c of this.cops) {
      seen.add('c' + c.id);
      let r = this.rigs.get('c' + c.id);
      if (!r) {
        const rig = makeChar(c.kind === 'insp' ? INSP_LOOK : { ...COP_LOOK, skin: ['#f2c29b', '#c98a5e', '#8d5a3b', '#e0a57c'][c.id % 4], mustache: c.id % 3 === 0, belly: 1 + (c.id % 3) * 0.12 });
        g.scene.add(rig.root);
        r = { rig, x: c.x, z: c.z, yaw: c.yaw, flyT: 0 };
        // a suspicion meter over the head
        const bar = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.14), new THREE.MeshBasicMaterial({ color: 0xffd23f, depthTest: false, transparent: true }));
        bar.position.y = 2.9; bar.renderOrder = 10; rig.root.add(bar); r.bar = bar;
        const ex = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.9), new THREE.MeshBasicMaterial({ color: 0xff3030, depthTest: false }));
        ex.position.y = 3.3; ex.renderOrder = 10; rig.root.add(ex); r.ex = ex;
        this.rigs.set('c' + c.id, r);
      }
      r.x = damp(r.x, c.x, 12, dt); r.z = damp(r.z, c.z, 12, dt); r.yaw = dampAngle(r.yaw, c.yaw, 12, dt);
      if (Math.hypot(r.x - c.x, r.z - c.z) > 6) { r.x = c.x; r.z = c.z; }
      const R = r.rig;
      R.root.position.set(r.x, 0.04, r.z); R.root.rotation.y = r.yaw;
      R.root.rotation.z = c.stun && c.st === 'stun' ? Math.PI / 2 * 0.9 : 0;
      if (c.stun && c.st === 'stun') R.root.position.y = 0.4;
      const sus = g.isHost ? Math.max(0, ...Object.values(c.sus || {}).concat(0)) : (c.susMax || 0);
      if (c.kind !== 'insp' && c.sus && c.sus[me] != null) maxSus = Math.max(maxSus, c.sus[me]);
      if (!g.isHost && c.susMax > maxSus && Math.hypot(c.x - P.pos.x, c.z - P.pos.z) < 18) maxSus = c.susMax;
      r.bar.visible = sus > 0.05 && c.st !== 'chase'; r.bar.scale.x = Math.max(0.01, sus); r.bar.quaternion.copy(g.camera.quaternion);
      r.ex.visible = c.st === 'chase'; r.ex.quaternion.copy(g.camera.quaternion);
      R.anim(dt, { speed: c.spd, angry: c.st === 'chase', panic: c.st === 'search' ? 0.25 : 0, talk: r.talkT > 0, point: c.st === 'chase' });
      r.talkT = (r.talkT || 0) - dt;
      if (c.st === 'chase' && c.tgt === me) chased = true;
    }
    for (const [k, r] of this.rigs) if (!seen.has(k)) { g.scene.remove(r.rig.root); this.rigs.delete(k); }
    const seenV = new Set();
    for (const c of this.cars) {
      seenV.add(c.id);
      let m = this.carMeshes.get(c.id);
      if (!m) { m = { C: makeCar('police'), x: c.x, z: c.z, yaw: c.yaw }; g.scene.add(m.C.group); this.carMeshes.set(c.id, m); const drv = makeChar({ ...COP_LOOK }); drv.anim(0, { sit: true, drive: true }); drv.root.scale.setScalar(0.85); const s = m.C.seats[0]; drv.root.position.set(s.x, s.y - 0.35, s.z); m.C.group.add(drv.root); }
      m.x = damp(m.x, c.x, 10, dt); m.z = damp(m.z, c.z, 10, dt); m.yaw = dampAngle(m.yaw, c.yaw, 10, dt);
      if (Math.hypot(m.x - c.x, m.z - c.z) > 10) { m.x = c.x; m.z = c.z; }
      m.C.group.position.set(m.x, 0, m.z); m.C.group.rotation.y = m.yaw;
      for (const w of m.C.wheels) w.rotation.x += (c.spd || 0) * dt * 2.5;
      const t = performance.now() * 0.008;
      m.C.lightR.visible = !c.siren || Math.sin(t) > 0; m.C.lightB.visible = !c.siren || Math.sin(t) <= 0;
      if (c.siren) siren = Math.max(siren, 1 / (1 + Math.hypot(c.x - P.pos.x, c.z - P.pos.z) / 30));
      if (c.siren && g.vehicles.local) chased = chased || Math.hypot(c.x - P.pos.x, c.z - P.pos.z) < 90;
    }
    for (const [k, m] of this.carMeshes) if (!seenV.has(k)) { g.scene.remove(m.C.group); this.carMeshes.delete(k); }
    this.chasingMe = chased; this.siren = siren; this.mySus = maxSus;
  }
  copRig(id) { return this.rigs.get('c' + id); }
}
