/* Rivals.js - the other pizza gangs: The Italian Guys, The Delivery Boys and
   The Frozen Pizza Gang.

   The host runs a little economy for each gang (W.rv.g[key]): it grows a
   level every few minutes unless you slow it down, it steals customers,
   raids your hideout, makes deals, invites you to meetings and offers you
   missions. Inside their buildings: guards on patrol, working cameras and
   things to sabotage with your hands (crates you carry out, a register you
   empty, a shelf you knock over, a trophy you steal). Cameras - theirs and
   yours - detect people, flash MOTION DETECTED and record footage you can
   watch on the monitor (Monitor.js) and take to the police.

   Get caught in their place and they drag you to the back room for a short
   argument, then you wake up outside your hideout, hurt, poorer, and they
   have paid your kitchen a visit. Nothing is ever gone for good. */
import * as THREE from '../../lib/three.module.js';
import { makeChar } from '../art/Chars.js';
import { makeSecurityCam, makeStand, makeTrophy } from '../art/Gear.js';
import { MAFIA, makeItem, makeCar } from '../art/Props.js';
import { part, geo, signMesh } from '../art/Mesher.js';
import { GANGS, GANG_KEYS, MEETING, CAUGHT, RETALIATE, EVENT_TEXT, MISSIONS } from '../data/Rivals.js';
import { SPEAKERS, Q } from '../data/Story.js';
import { STOCK, STOCK_NAME, VEHICLES } from '../data/Data.js';
import { STATION, roomAt } from '../data/Hideout.js';
import { HQ } from '../world/Town.js';
import { path, nearestNode } from './Police.js';
import { lookFor } from './Player.js';
import { pick, rand, money, damp, dampAngle, clamp } from '../core/Util.js';

SPEAKERS.cop = { name: 'Sergeant Pickles', color: '#6f8fd8' };
SPEAKERS.boss = SPEAKERS.boss || { name: 'The Boss', color: '#ffd23f' };
SPEAKERS.frank = { name: 'Frank', color: '#c8c8d8' };

const HOSTAGE_NAMES = { italian: ['Little Sal', 'Cousin Vito', 'Tony Two-Slices', 'Nephew Gino'], delivery: ['Speedy Steve', 'Zoom Zach', 'Fast Freddie', 'Lil Turbo'], frozen: ['Chilly Chad', 'Frosty Phil', 'Ice Cube Eddie', 'Brain Freeze Bob'] };
/* the ransom haggle: what the boss says */
const RANSOM = {
  open: (h) => [['narr', 'You slide the photo across. ' + h + ', in a hood, handcuffed to a comfy red chair, giving a thumbs up.'], ['boss', '...'], ['boss', 'Is that ' + h + '?'], ['boss', 'Is he giving a THUMBS UP?'], ['boss', '...He looks comfortable. Okay. What do you want for him?']],
  accept: ['Fine. FINE. Here. Give him back.', 'Deal. Don\'t tell anyone about this. Ever.', 'Take it. We\'ll pretend this never happened.'],
  counter: ['Pfff. How about {O}. That\'s my final offer.', '{O}. And that\'s already too much for HIM.', 'I can do {O}. He\'s not THAT good at his job.', '...{O}. Last offer. (It\'s not the last offer.)'],
  insult: ['WHAT? For HIM? He can\'t even sneak into a shoe shop!', 'That\'s more than his whole family is worth. Combined.', 'Are you out of your MIND? Try again.'],
  threat: ['Pay up. Or he sleeps with the anchovies.', 'Nice little gang you got here. Shame if your guy ended up in a dumpster.', 'I\'m gonna make you an offer you can\'t refuse. Pay, or he goes in the dumpster. The SMELLY one.', 'Pay, or he swims with the olives.'],
  scaredYes: ['...Not the anchovies. Anything but the anchovies. {O}.', 'Alright! {O}! Not the dumpster, he just got that suit cleaned!', '(sweating) {O}. And put the bat AWAY.'],
  scaredNo: ['You don\'t scare me. He\'s been in worse dumpsters.', 'The dumpster? Please. He grew up in one.', 'Nice try. We ALL sleep with the anchovies. It\'s called a pizza.'],
  walk: ['You know what? Keep him. We got plenty of cousins.', 'I\'m done. Come back when you\'re reasonable.', 'Keep him. He eats too much anyway.'],
  hostage: ['Frank (from the back): Boss, just pay them. We miss him. He makes the good coffee.', 'Frank (from the back): Is that Sal? Aww, he looks so relaxed.', 'Frank (from the back): Boss, he\'s got the van keys in his pocket. We NEED him.'],
};
SPEAKERS.hostage = { name: 'The Bag', color: '#9a9aaa' };

const HOLD_SAB = { register: 2.4, oven: 1.6, shelf: 1.4, special: 2.0 };
const RAID_PATH = [[116, 58], [129, 66], [135.4, 75.5], [137.6, 80], [141.6, 80]];
const RAID_SPOT = { cash: [150.2, 75.8], fridge: [142.2, 86.1], oven: [149.5, 74.4], boxes: [145.7, 86.1], mess: [146, 80] };
const SHIPMENT_AREAS = [[-40, 100], [40, -20], [-100, 40], [100, 100], [-20, 140], [60, -100]];
const FAIL = ['MISSION FAILED', 'NOPE', 'TOO SLOW'];

function fresh() {
  return {
    g: Object.fromEntries(GANG_KEYS.map((k, i) => [k, { lvl: 1, xp: 0.25 * i, eff: 1, cash: 5000, rel: 0, ally: false, alert: 0, shut: 0, heat: 0, slow: 0, invite: 0, raidT: 420 + i * 160, meetCool: 0, off: {}, st: {}, guards: [], knows: 0, snitchT: 0 }])),
    hqOff: {}, raid: null, popup: null, secret: null, offer: null, mission: null, evT: 140, trophies: [], pizzeria: false, share: {}, mess: [], incomeT: 60,
  };
}

export class Rivals {
  constructor(game) {
    this.g = game;
    this.camModels = new Map();   // 'g:id' -> group
    this.rigs = new Map();        // actor key -> {rig, x, z, yaw}
    this.hist = []; this.histT = 0; this.rec = [];
    this.sabT = {};               // pid -> host time of their last sabotage
    this.spotCool = {};
    this.cine = null;
    this.waits = [];
    this.grace = {};
    this.time = 0;
    this.groups = {};             // misc scene groups: popup, secret, shipment, van, trophies, mess, office
    // the MOTION DETECTED banner and the health bar
    const host = document.getElementById('held')?.parentNode || document.body;
    this.motionEl = document.createElement('div'); this.motionEl.id = 'motion'; host.appendChild(this.motionEl);
    this.hpEl = document.createElement('div'); this.hpEl.id = 'hpbar'; this.hpEl.innerHTML = '<span>HEALTH</span><i><b></b></i>'; host.appendChild(this.hpEl);
  }
  get W() { return this.g.W; }
  get R() { const W = this.W; if (!W.rv || !W.rv.g) W.rv = fresh(); return W.rv; }
  gang(k) { return this.R.g[k]; }
  place(k) { return this.g.town.poi.rv[k]; }
  /** which gang's building is this point inside (null if none) */
  insideOf(x, z) { for (const k of GANG_KEYS) { const b = this.place(k).inside; if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return k; } return null; }
  hostile(k) { const G = this.gang(k); return !G.ally && G.shut <= 0; }
  camsOf(k) {   // the cameras a gang has right now (more as they grow)
    const P = this.place(k), G = this.gang(k);
    return [...P.cams.filter(c => c.lvl <= G.lvl), P.alley];
  }
  hqCams() { const W = this.W; if (!W.owned?.up?.camera) return []; return this.g.town.poi.hqCams.filter(c => !c.room || W.level >= c.room); }
  lookKey(pid) {
    const g = this.g, look = pid === g.me ? g.profile.look : g.remotes.get(pid)?.look ?? 0;
    return 'p:' + (look | 0) + ':' + (this.W.wear?.[pid] || '');
  }
  wait(s) { return new Promise(res => this.waits.push({ t: s, res })); }

  /* ======================================================================
     HOST
     ====================================================================== */
  hostUpdate(dt, players) {
    const g = this.g, W = this.W, R = this.R;
    this.time += dt;
    W.time = (W.time || 0) + dt;   // the world clock (camera timestamps)
    const live = W.quest >= Q.BIZ;
    for (const pid of Object.keys(this.grace)) { this.grace[pid] -= dt; if (this.grace[pid] <= 0) delete this.grace[pid]; }
    for (const k of GANG_KEYS) {
      const G = R.g[k];
      for (const t of ['shut', 'heat', 'slow', 'invite', 'meetCool']) if (G[t] > 0) G[t] = Math.max(0, G[t] - dt);
      G.alert = Math.max(0, G.alert - dt * 0.012);
      G.eff = Math.min(1, G.eff + dt * 0.004);
      for (const [id, s] of Object.entries(G.st)) { if (s.t > 0) { s.t -= dt; if (s.t <= 0) delete G.st[id]; } }
      // dead cameras: they notice, then they fix them
      for (const [id, o] of Object.entries(G.off)) {
        o.t += dt;
        if (o.why === 'block' && o.t > 60) { delete G.off[id]; continue; }
        if (!o.noticed && o.why !== 'block' && o.t > o.notice) { o.noticed = true; G.alert = 1; g.broadcastEvent({ k: 'rvNews', text: GANGS[k].name + ' noticed a dead camera (' + this._camName(k, id) + '). They\'re on high alert.', alarm: 'THEY NOTICED' }); }
        if (o.noticed && o.t > o.notice + 70) { delete G.off[id]; g.dirty(); }
      }
      if (live) this._grow(k, G, dt);
      this._guards(k, G, dt, players);
      // they had footage of you sabotaging them: sometimes they send it to the police
      if (G.snitchT > 0) { G.snitchT -= dt; if (G.snitchT <= 0) this._snitch(k); }
    }
    this._cameras(dt, players);
    this._record(dt, players);
    if (!live) { if (R.raid) this._raids(dt, players); return; }   // (an admin raid works at any point in the story)
    this._competition(dt);
    this._raids(dt, players);
    this._events(dt);
    this._mission(dt, players);
    this._income(dt);
  }

  /* ---------------- growth ---------------- */
  _grow(k, G, dt) {
    if (G.shut > 0) return;
    G.xp += dt * 0.0034 * G.eff * (G.ally ? 1.25 : 1) * (G.heat > 0 ? 0.5 : 1) * (this.R.popup?.g === k ? 1.5 : 1);
    this._xp(k, 0);
  }
  /** host: add (or take away) growth; levels go up and down with it */
  _xp(k, n) {
    const G = this.gang(k), g = this.g;
    G.xp += n;
    if (G.xp >= 1 && G.lvl < 5) { G.lvl++; G.xp = 0; g.broadcastEvent({ k: 'rvNews', text: EVENT_TEXT.grow(GANGS[k], G.lvl), alarm: GANGS[k].short.toUpperCase() + ' GREW!' }); g.dirty(); }
    else if (G.xp >= 1) G.xp = 1;
    if (G.xp < 0) { if (G.lvl > 1) { G.lvl--; G.xp = 0.6; g.broadcastEvent({ k: 'rvNews', text: GANGS[k].name + ' had to shrink: back to ' + GANGS[k].levels[G.lvl - 1] + '. Good.', alarm: GANGS[k].short.toUpperCase() + ' SHRANK!' }); g.dirty(); } else G.xp = 0; }
  }

  /* ---------------- their guards ---------------- */
  _guards(k, G, dt, players) {
    const g = this.g, P = this.place(k), col = g.town.col;
    const inside = players.filter(p => this.insideOf(p.x, p.z) === k && !this.grace[p.id]);
    const want = Math.min(3, 1 + Math.floor((G.lvl - 1) / 2) + (G.alert > 0.5 ? 1 : 0));
    while (G.guards.length < want) { const r = G.guards.length === 1 ? P.route2 : P.route, i = G.guards.length * 2 % r.length; G.guards.push({ x: r[i][0], z: r[i][1], yaw: 0, st: 'patrol', i, r: G.guards.length === 1 ? 2 : 1, sus: {}, wait: 0 }); }
    while (G.guards.length > want) G.guards.pop();
    if (!inside.length) { for (const q of G.guards) { if (q.st !== 'patrol') { q.st = 'patrol'; q.sus = {}; } } return; }
    const friendly = (p) => (G.invite > 0 || G.ally || this.R.mission?.k === 'inspection' && this.R.mission.g === k) && !(this.time - (this.sabT[p.id] || -99) < 30);
    for (const q of G.guards) {
      let tx, tz, sp = 2.1;
      if (q.st === 'chase') {
        const p = inside.find(x => x.id === q.tgt);
        if (!p) { q.st = 'search'; q.t = 4; }
        else {
          const sees = !col.blocked(q.x, q.z, p.x, p.z, 0);
          if (sees) { q.lx = p.x; q.lz = p.z; q.lost = 0; } else q.lost = (q.lost || 0) + dt;
          tx = q.lx; tz = q.lz; sp = 6.6 + G.alert * 0.6;
          if (sees && Math.hypot(p.x - q.x, p.z - q.z) < 1.25) { this.caught(p.id, k); return; }
          if (q.lost > 3.5) { q.st = 'search'; q.t = 5; }
        }
      } else if (q.st === 'search') {
        q.t -= dt; tx = q.lx; tz = q.lz; sp = 3.2;
        if (q.t <= 0) { q.st = 'patrol'; q.sus = {}; }
      }
      if (q.st === 'patrol') {
        const r = q.r === 2 ? P.route2 : P.route, w = r[q.i % r.length];
        tx = w[0]; tz = w[1];
        if (Math.hypot(tx - q.x, tz - q.z) < 0.4) { q.wait -= dt; if (q.wait <= 0) { q.i = (q.i + 1) % r.length; q.wait = rand(0.8, 2.2); } tx = q.x; tz = q.z; q.look = (q.look || 0) + dt; }
      }
      // move
      const dx = tx - q.x, dz = tz - q.z, d = Math.hypot(dx, dz);
      if (d > 0.15) { const s = Math.min(d, sp * dt); q.x += dx / d * s; q.z += dz / d * s; q.yaw = dampAngle(q.yaw, Math.atan2(dx, dz), 9, dt); q.spd = sp; }
      else { q.spd = 0; if (q.st === 'patrol') q.yaw += Math.sin(this.time * 1.3 + q.i) * dt * 0.8; }
      const r2 = col.resolve(q.x, q.z, 0.35, 0, 0); q.x = r2.x; q.z = r2.z;
      // look for intruders
      if (q.st === 'chase') continue;
      for (const p of inside) {
        if (friendly(p)) { q.sus[p.id] = 0; continue; }
        const ddx = p.x - q.x, ddz = p.z - q.z, dd = Math.hypot(ddx, ddz);
        const facing = dd < 2.2 || (ddx * Math.sin(q.yaw) + ddz * Math.cos(q.yaw)) / dd > 0.42;
        if (dd < 10.5 && facing && !col.blocked(q.x, q.z, p.x, p.z, 0)) {
          const hot = g.hold(p.id).some(i => i.hot === k || (i.k === 'trophy' && i.g === k));
          const busy = this.time - (this.sabT[p.id] || -99) < 2.5;
          const rate = 0.75 * (1 + G.alert) * (hot ? 1.7 : 1) * (busy ? 2.2 : 1) * (p.run ? 1.25 : 1) * (p.nat && !p.run ? 0.6 : 1);
          q.sus[p.id] = (q.sus[p.id] || 0) + rate * dt * (1.45 - dd / 10.5);
          if (q.sus[p.id] >= 1) {
            q.st = 'chase'; q.tgt = p.id; q.lx = p.x; q.lz = p.z; q.lost = 0; q.sus = {};
            g.broadcastEvent({ k: 'rvBark', g: k, x: q.x, z: q.z, text: pick(GANGS[k].spot), pid: p.id, chase: true });
          }
        } else q.sus[p.id] = Math.max(0, (q.sus[p.id] || 0) - dt * 0.25);
      }
    }
  }
  /** guards nearby hear something */
  _noise(k, x, z, amt) {
    const G = this.gang(k), col = this.g.town.col;
    G.alert = Math.min(1, G.alert + amt * 0.3);
    for (const q of G.guards) if (q.st === 'patrol' && Math.hypot(q.x - x, q.z - z) < 7 && !col.blocked(q.x, q.z, x, z, 0)) { q.st = 'search'; q.t = 4; q.lx = x; q.lz = z; }
  }

  /* ---------------- cameras: theirs and yours ---------------- */
  /** can this camera see the point (x, z)? */
  sees(c, x, z) {
    const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz);
    if (d > c.range || d < 0.3) return false;
    let a = Math.atan2(dx, dz) - c.yaw; a = Math.atan2(Math.sin(a), Math.cos(a));
    if (Math.abs(a) > c.fov / 2) return false;
    return !this.g.town.col.blocked(c.x, c.z, x, z, 0);
  }
  camOff(k, id) { return k === 'hq' ? this.R.hqOff[id] : this.gang(k).off[id]; }
  _camName(k, id) { const c = k === 'hq' ? this.g.town.poi.hqCams.find(c => c.id === id) : this.camsOf(k).find(c => c.id === id); return c ? c.name : 'CAMERA'; }
  _cameras(dt, players) {
    const g = this.g, R = this.R;
    this._camT = (this._camT || 0) - dt; if (this._camT > 0) return; this._camT = 0.2;
    // theirs: they see you
    for (const k of GANG_KEYS) {
      const G = R.g[k];
      for (const c of this.camsOf(k)) {
        if (G.off[c.id]) continue;
        for (const p of players) {
          if (p.car || p.hidden || p.floor) continue;
          const inBldg = this.insideOf(p.x, p.z) === k;
          if (c.outside ? inBldg : !inBldg) continue;
          if (!this.sees(c, p.x, p.z)) continue;
          const hot = g.hold(p.id).some(i => i.hot === k || (i.k === 'trophy' && i.g === k));
          const busy = this.time - (this.sabT[p.id] || -99) < 3;
          if (c.outside && !hot && !busy) continue;               // walking past the back alley is not a crime
          if (!c.outside && (G.invite > 0 || G.ally) && !busy && !hot) continue;
          const key = k + c.id + p.id;
          if ((this.spotCool[key] || 0) > this.time) continue;
          this.spotCool[key] = this.time + 6;
          G.alert = Math.min(1, G.alert + 0.35);
          if (busy || hot) { G.knows++; G.rel = Math.max(-100, G.rel - 8); if (!G.snitchT && Math.random() < 0.45) G.snitchT = rand(25, 50); if (G.ally && G.rel < 0) this._breakAlliance(k); }
          for (const q of G.guards) if (q.st === 'patrol' && !c.outside) { q.st = 'search'; q.t = 6; q.lx = p.x; q.lz = p.z; }
          g.broadcastEvent({ k: 'rvSpotted', pid: p.id, g: k, cam: c.name, busy: busy || hot });
        }
      }
    }
    // yours: you see them
    const raid = R.raid;
    if (raid && raid.st !== 'gone') for (const c of this.hqCams()) {
      if (R.hqOff[c.id] || raid.seen?.[c.id]) continue;
      if (!this.sees(c, raid.x, raid.z)) continue;
      (raid.seen ||= {})[c.id] = true;
      g.broadcastEvent({ k: 'motion', cam: c.name, where: c.id === 'alley' ? 'behind the hideout' : c.id === 'front' ? 'at the front door' : 'INSIDE the hideout', g: raid.g });
      this._startRec(c, 'hq', raid.g);
    }
  }

  /* ---------------- footage ---------------- */
  /** every 0.2s: where everybody interesting is (kept for 6 seconds) */
  _record(dt, players) {
    this.histT -= dt; if (this.histT > 0) return; this.histT = 0.2;
    const R = this.R, A = [];
    for (const p of players) A.push(['p' + p.id, this.lookKey(p.id), +p.x.toFixed(2), +p.z.toFixed(2), +(p.id === this.g.me ? this.g.player.yaw : this.g.remotes.get(p.id)?.yaw || 0).toFixed(2), this.g.hold(p.id).length ? 1 : 0]);
    if (R.raid && R.raid.st !== 'gone') A.push(['raid', 'c:' + R.raid.g, +R.raid.x.toFixed(2), +R.raid.z.toFixed(2), +R.raid.yaw.toFixed(2), R.raid.st === 'act' ? 2 : R.raid.loot ? 1 : 0]);
    this.hist.push({ t: +this.W.time.toFixed(1), a: A });
    if (this.hist.length > 30) this.hist.shift();
    // recordings in progress get the new frame
    for (const r of [...this.rec]) {
      r.frames.push(this._frameFor(r, this.hist[this.hist.length - 1]));
      if (this.W.time >= r.until) { this.rec.splice(this.rec.indexOf(r), 1); this._finishRec(r); }
    }
  }
  _frameFor(r, h) { return [h.t, h.a.filter(a => Math.hypot(a[2] - r.cam.x, a[3] - r.cam.z) < 30)]; }
  _startRec(c, place, culprit) {
    const W = this.W;
    if (this.rec.some(r => r.cam.id === c.id && r.place === place)) return;
    const r = { cam: { id: c.id, name: c.name, x: c.x, y: c.y, z: c.z, yaw: c.yaw, pitch: c.pitch }, place, culprit, t0: W.time, until: W.time + 6, frames: this.hist.slice(-20).map(h => this._frameFor({ cam: c }, h)) };
    this.rec.push(r);
  }
  _finishRec(r) {
    const W = this.W;
    W.footage = W.footage || [];
    W.footSeq = (W.footSeq || 0) + 1;
    W.footage.push({ id: W.footSeq, cam: r.cam, place: r.place, culprit: r.culprit, t: Math.round(r.t0), frames: r.frames, saved: false, reported: false, photo: !!r.photo });
    // keep 12: drop the oldest that isn't saved
    while (W.footage.length > 12) { const i = W.footage.findIndex(f => !f.saved); W.footage.splice(i >= 0 ? i : 0, 1); }
    this.g.dirty();
  }

  /* ---------------- customers: the race for every order ---------------- */
  _competition(dt) {
    const g = this.g, W = this.W, R = this.R;
    const live = GANG_KEYS.filter(k => this.hostile(k));
    const avg = GANG_KEYS.reduce((s, k) => s + R.g[k].lvl, 0) / 3;
    for (const o of [...W.orders]) {
      if (o.story || o.refuse) continue;
      if (o.state === 'new' && o.exp < 12 && !o.rvAsked) {
        o.rvAsked = true;
        if (live.length && Math.random() < 0.25 + avg * 0.04) { const k = pick(live); W.orders.splice(W.orders.indexOf(o), 1); this._xp(k, 0.08); g.broadcastEvent({ k: 'rvNews', text: o.name + ' got tired of waiting and called ' + GANGS[k].name + ' instead.' }); g.dirty(); continue; }
      }
      if (o.state !== 'open') continue;
      if (!o.rvChecked) {
        o.rvChecked = true;
        if (R.g.delivery.ally && !o.mission) { o.t += 30; o.tmax += 30; }
        if (!o.mission && live.length && Math.random() < 0.2 + avg * 0.05) {
          const w = live.map(k => R.g[k].lvl * (k === 'delivery' ? 1.6 : 1)), sum = w.reduce((a, b) => a + b, 0);
          let r = Math.random() * sum, k = live[0]; for (let i = 0; i < live.length; i++) { r -= w[i]; if (r <= 0) { k = live[i]; break; } }
          o.rv = { g: k, t: Math.max(28, o.t * rand(0.5, 0.85) / GANGS[k].speed) }; o.rv.t0 = o.rv.t;
          g.broadcastEvent({ k: 'rvNews', text: GANGS[k].name + ' are going for ' + o.name + '\'s order too! (' + Math.ceil(o.rv.t) + 's)' });
          g.dirty();
        }
      }
      if (o.rv) {
        const G = R.g[o.rv.g];
        o.rv.t -= dt * (G.slow > 0 ? 0.5 : 1) * (G.shut > 0 ? 0 : 1);
        if (o.rv.t <= 0) {
          W.orders.splice(W.orders.indexOf(o), 1);
          this._xp(o.rv.g, 0.12); G.cash += Math.round(o.pay * 0.5);
          g.broadcastEvent({ k: 'rvNews', text: EVENT_TEXT.steal(GANGS[o.rv.g], o.name), alarm: o.mission ? pick(FAIL) : 'THEY GOT THERE FIRST' });
          if (o.mission) { this.R.mission = null; }
          g.dirty();
        }
      }
    }
  }
  /** host, from Orders.complete: you delivered - did you beat a rival to it? (returns the pay multiplier) */
  delivered(pid, o) {
    const g = this.g, R = this.R;
    let mult = 1;
    if (o.rv) { mult = 1.15; this._xp(o.rv.g, -0.05); g.tell(null, 'You beat ' + GANGS[o.rv.g].name + ' to ' + o.name + '\'s door! (+15% tip)'); }
    const M = R.mission;
    if (M && o.mission && M.order === o.id) {
      if (o.mission === 'record' && o.t <= 0) this._missionEnd(false, 'Too slow for the record. Turbo Tony laughs at you over the phone.');
      else if (o.left <= 1) this._missionEnd(true, { race: 'You beat the Delivery Boys\' van! Turbo Tony pays up (and cries).', record: 'NEW DEPOT RECORD! The Delivery Boys are in shock.', bigorder: 'The mayor\'s secret party got its pizzas. From YOU.' }[o.mission] || 'Done!');
    }
    return mult;
  }

  /* ---------------- their raids on your hideout ---------------- */
  _raids(dt, players) {
    const g = this.g, W = this.W, R = this.R;
    if (!R.raid) {
      for (const k of GANG_KEYS) {
        const G = R.g[k];
        if (!this.hostile(k) || G.heat > 0) continue;
        G.raidT -= dt * (1 + (G.lvl - 1) * 0.3) * (G.rel < -30 ? 1.6 : 1);
        if (G.raidT <= 0) { G.raidT = rand(380, 600); this._startRaid(k); break; }
      }
      return;
    }
    const r = R.raid;
    if (r.st === 'gone') { R.raid = null; g.dirty(); return; }
    // somebody catches them red-handed
    if (r.st === 'caught') {
      r.t -= dt;
      if (r.t <= 0) { r.st = 'flee'; r.path = [[r.x, r.z], [137.6, 80], [129, 66], [104, 50]].filter((p, i) => i === 0 || Math.hypot(p[0] - r.x, p[1] - r.z) > 2 || i === 3); r.i = 1; g.broadcastEvent({ k: 'rvNews', text: r.name + ' shook it off and ran for it.' }); g.dirty(); }
      return;
    }
    if (r.st !== 'flee') for (const p of players) {
      if (p.floor || p.car) continue;
      if (Math.hypot(p.x - r.x, p.z - r.z) < 1.7) { this.foilRaid(p.id); return; }
    }
    if (r.stun > 0) { r.stun -= dt; return; }
    const sp = r.st === 'flee' ? 6.4 : r.st === 'out' ? 4.2 : 3.0;
    if (r.st === 'act') {
      r.t -= dt;
      if (r.t <= 0) {
        if (r.cam) { R.hqOff[r.cam] = { t: 0, why: 'mustache' }; g.broadcastEvent({ k: 'camOff', g: 'hq', id: r.cam, name: this._camName('hq', r.cam), mine: true }); r.cam = null; r.path = r.rest; r.st = 'in'; r.i = 0; }
        else { this._raidLoot(r); r.st = 'out'; r.path = [...r.path].reverse().concat([[104, 50]]); r.i = 0; }
        g.dirty();
      }
      return;
    }
    const w = r.path[r.i];
    if (!w) { if (r.st === 'in') { r.st = 'act'; r.t = 6; } else r.st = 'gone'; g.dirty(); return; }
    const dx = w[0] - r.x, dz = w[1] - r.z, d = Math.hypot(dx, dz);
    if (d < 0.25) r.i++;
    else { const s = Math.min(d, sp * dt); r.x += dx / d * s; r.z += dz / d * s; r.yaw = Math.atan2(dx, dz); }
  }
  _startRaid(k) {
    const g = this.g, W = this.W, R = this.R;
    const opts = [];
    if (W.money > 2000) opts.push('cash', 'cash');
    if (STOCK.some(s => W.stock[s] > 2)) opts.push('fridge', 'fridge');
    if (W.oven1 && !W.st.oven1?.burnt) opts.push('oven');
    opts.push('mess');
    const target = pick(opts);
    const sp = RAID_SPOT[target];
    const path = [...RAID_PATH, sp];
    // sometimes they deal with a camera first
    const cams = this.hqCams().filter(c => !R.hqOff[c.id] && (c.id === 'front' || c.id === 'alley'));
    const cam = cams.length && Math.random() < 0.4 ? pick(cams) : null;
    R.raid = { g: k, x: path[0][0], z: path[0][1], yaw: 0, st: 'in', i: 1, target, path, t: 0 };
    if (cam) { const near = [cam.x + Math.sin(cam.yaw) * 1.2, cam.z + Math.cos(cam.yaw) * 1.2]; R.raid.cam = cam.id; R.raid.rest = path.slice(1); R.raid.path = [path[0], near]; R.raid.st = 'in'; R.raid.camFirst = true; }
    g.dirty();
  }
  /** they finish the job */
  _raidLoot(r) {
    const g = this.g, W = this.W, G = this.gang(r.g), N = GANGS[r.g].name;
    let text = '';
    if (r.target === 'cash') { const n = Math.min(W.money, Math.round(1500 + W.money * 0.12)); W.money -= n; G.cash += n; text = N + ' stole ' + money(n) + ' from the hideout!'; r.loot = n; }
    if (r.target === 'fridge') { const s = pick(STOCK.filter(s => W.stock[s] > 2)) || 'cheese'; const n = Math.ceil(W.stock[s] * 0.5); W.stock[s] -= n; text = N + ' took ' + n + ' ' + STOCK_NAME[s].toLowerCase() + ' from your fridge!'; r.loot = 1; }
    if (r.target === 'oven') { const st = g.kitchen.st('oven1'); st.burnt = true; text = N + ' wrecked your oven! (Repair it: hold E.)'; }
    if (r.target === 'mess') { this._mess(4); text = N + ' trashed the kitchen. Flour EVERYWHERE.'; }
    this._xp(r.g, 0.1);
    g.broadcastEvent({ k: 'raidDone', g: r.g, text });
  }
  /** host: a player got to the intruder (walked into them, or bonked them) */
  foilRaid(pid, bonk) {
    const g = this.g, W = this.W, r = this.R.raid; if (!r || r.st === 'flee' || r.st === 'gone') return false;
    if (r.st === 'caught') { if (bonk) r.t = Math.max(r.t, 6); return true; }   // another bonk keeps him dizzy
    // frozen on the spot for a few seconds (bag him now!), then he runs
    r.st = 'caught'; r.t = bonk ? 10 : 8; r.cam = null;
    r.name = r.name || pick(HOSTAGE_NAMES[r.g]);
    W.money += 500; this._xp(r.g, -0.1);
    g.broadcastEvent({ k: 'raidFoiled', g: r.g, pid, x: r.x, z: r.z, bonk: !!bonk });
    g.dirty();
    return true;
  }
  _mess(n) { const R = this.R; for (let i = 0; i < n; i++) R.mess.push({ x: rand(141.5, 151), z: rand(74.5, 86), r: rand(0, 6) }); }

  /* ---------------- getting caught ---------------- */
  caught(pid, k) {
    const g = this.g, W = this.W, G = this.gang(k), N = GANGS[k];
    this.grace[pid] = 20;
    for (const q of G.guards) { q.st = 'patrol'; q.sus = {}; }
    G.alert = 0.4; G.rel = Math.max(-100, G.rel - 12); G.knows++;
    if (G.ally) this._breakAlliance(k);
    // whatever you were carrying goes back on their shelves
    const H = g.hold(pid);
    for (const it of H) { if (it.hot === k) delete G.st['crate' + it.slot]; if (it.k === 'trophy' && it.g === k) delete G.st.trophy; }
    W.hold[pid] = [];
    const lose = Math.min(W.money, Math.round(Math.max(500, W.money * 0.1)));
    W.money -= lose; G.cash += lose;
    // and while you were "busy", they paid your kitchen a visit
    const report = [], picks = new Set();
    const opts = ['cash', 'stock', 'oven', 'mess', 'boxes'];
    if (W.cars.length) opts.push('car');
    if (this.hqCams().length) opts.push('cams');
    while (picks.size < 3) picks.add(pick(opts));
    for (const p of picks) {
      if (p === 'cash') { const n = Math.min(W.money, Math.round(Math.max(300, W.money * 0.06))); W.money -= n; G.cash += n; report.push(RETALIATE.cash(money(n))); }
      if (p === 'stock') { const s = pick(STOCK.filter(s => W.stock[s] > 0)) || 'cheese'; const n = Math.ceil((W.stock[s] || 0) * 0.5); W.stock[s] = (W.stock[s] || 0) - n; report.push(RETALIATE.stock(n, STOCK_NAME[s].toLowerCase())); }
      if (p === 'oven') { if (W.oven1) { g.kitchen.st('oven1').burnt = true; report.push(RETALIATE.oven); } else { this._mess(2); report.push(RETALIATE.mess); } }
      if (p === 'mess') { this._mess(4); report.push(RETALIATE.mess); }
      if (p === 'boxes') { this._mess(2); report.push(RETALIATE.boxes); }
      if (p === 'car') { const c = pick(W.cars.filter(c => !c.drv && !c.pas.length)) || null; if (c) { const spot = pick([[-100, -120], [120, 190], [-190, 40], [190, -40]]); c.x = spot[0]; c.z = spot[1]; c.yaw = Math.random() * 6; report.push(RETALIATE.car((VEHICLES[c.kind] || { name: 'car' }).name)); } }
      if (p === 'cams') { const c = pick(this.hqCams()); this.R.hqOff[c.id] = { t: 0, why: 'mustache' }; report.push(RETALIATE.cams); }
    }
    g.broadcastEvent({ k: 'caught', pid, g: k, lose, report });
    g.dirty();
  }
  _breakAlliance(k) {
    const G = this.gang(k); if (!G.ally) return;
    G.ally = false; G.rel = Math.min(G.rel, -30);
    this.g.broadcastEvent({ k: 'rvNews', text: GANGS[k].boss + ': "You stab the family in the back? We are DONE." (The alliance with ' + GANGS[k].name + ' is over.)', alarm: 'ALLIANCE BROKEN' });
  }
  /** they send the police your picture */
  _snitch(k) {
    const g = this.g;
    g.addHeat(10); g.inspections.tip(3);
    g.broadcastEvent({ k: 'rvNews', text: GANGS[k].name + ' sent the police footage of you. It\'s VERY blurry. The police are "looking into it". (Heat +10)', alarm: 'THEY SNITCHED' });
  }

  /* ---------------- random events ---------------- */
  _events(dt) {
    const g = this.g, W = this.W, R = this.R;
    if (R.popup) { R.popup.t -= dt; W.orderT += dt * 0.5; if (R.popup.t <= 0) { g.broadcastEvent({ k: 'rvNews', text: 'The ' + GANGS[R.popup.g].short + ' pizza stand packed up and left.' }); R.popup = null; g.dirty(); } }
    if (R.offer) { R.offer.t -= dt; if (R.offer.t <= 0) { R.offer = null; g.dirty(); } }
    if (R.secret && !R.mission) { R.secret = null; }
    R.evT -= dt;
    if (R.evT > 0) return;
    R.evT = rand(110, 190);
    const hostile = GANG_KEYS.filter(k => this.hostile(k));
    const any = GANG_KEYS.filter(k => R.g[k].shut <= 0);
    const opts = [];
    if (!R.popup && hostile.length) opts.push('popup');
    if (hostile.length && W.stock.cheese > 3 && !W.shortage) opts.push('cheese');
    if (!R.offer && any.length) opts.push('deal', 'deal');
    if (!R.mission && hostile.length) opts.push('secret');
    if (any.some(k => R.g[k].invite <= 0 && R.g[k].meetCool <= 0)) opts.push('meeting', 'meeting');
    if (!opts.length) return;
    this.event(pick(opts));
  }
  /** host: start a rival event (admin can call this too) */
  event(kind, k) {
    const g = this.g, W = this.W, R = this.R;
    const hostile = GANG_KEYS.filter(k => this.hostile(k)), any = GANG_KEYS.filter(k => R.g[k].shut <= 0);
    k = k || pick(kind === 'deal' || kind === 'meeting' ? any : hostile.length ? hostile : GANG_KEYS);
    const G = GANGS[k];
    switch (kind) {
      case 'popup': {
        R.popup = { g: k, t: 240 };
        g.broadcastEvent({ k: 'rvNews', text: G.name + ' set up a pizza stand on Anchovy Road. Customers are going there instead (orders come in half as often). Knock it over, or print 2-for-1 flyers (phone).', alarm: EVENT_TEXT.popup(G) });
        break;
      }
      case 'cheese': {
        const n = Math.floor(W.stock.cheese * 0.8); W.stock.cheese -= n;
        W.shortage = { s: 'cheese', t: 200 }; this._xp(k, 0.1);
        g.broadcastEvent({ k: 'rvNews', text: G.name + ' bought up all the cheese in town and took ' + n + ' of yours. The grocery is sold out: try the Big Cheese (underground supplier).', alarm: EVENT_TEXT.cheese(G) });
        break;
      }
      case 'deal': {
        const kinds = ['trade', 'trade', 'cash', 'share'];
        if (!R.g[k].ally && R.g[k].rel > -40) kinds.push('partner', 'partner');
        const kind2 = pick(kinds);
        const o = { g: k, kind: kind2, t: 150 };
        if (kind2 === 'trade') { const give = pick(['dough', 'sauce', 'mushroom', 'olive']), get = pick(['cheese', 'pepperoni', 'sausage', 'pineapple'].filter(s => s !== give)); Object.assign(o, { give, giveN: 6, get, getN: 14, text: G.boss + ' offers ' + 14 + ' ' + STOCK_NAME[get].toLowerCase() + ' for 6 of your ' + STOCK_NAME[give].toLowerCase() + '.' }); }
        if (kind2 === 'cash') Object.assign(o, { amt: 4000 + R.g[k].lvl * 1500, text: G.boss + ' wants to buy your "secret recipe" (it\'s just pizza). They pay ' + money(4000 + R.g[k].lvl * 1500) + ' now. They\'ll grow faster with it.' });
        if (kind2 === 'share') Object.assign(o, { amt: 6000 + R.g[k].lvl * 2000, text: G.boss + ' offers you a 20% share in ' + G.place + ' for ' + money(6000 + R.g[k].lvl * 2000) + '. You get a cut of their business every minute. The bigger they grow, the bigger the cut.' });
        if (kind2 === 'partner') Object.assign(o, { text: G.boss + ' proposes a partnership. Allies don\'t raid you or steal your customers, and they help out (' + { italian: 'they warn you about inspections', delivery: 'your customers wait 30s longer', frozen: 'they drop off emergency ingredients' }[k] + '). But allies grow faster.' });
        R.offer = o;
        g.broadcastEvent({ k: 'rvNews', text: o.text + ' (Phone: TAB > RIVALS)', alarm: EVENT_TEXT.deal(G), ding: true });
        break;
      }
      case 'secret': {
        const i = Math.floor(Math.random() * 3);
        R.secret = { g: k, i, found: false };
        R.mission = { k: 'kitchen', g: k, t: MISSIONS.kitchen.t, found: false };
        g.broadcastEvent({ k: 'rvNews', text: 'Somebody saw smoke coming out of one of the dead pizzerias. A secret kitchen? Find it. (Mission: The Secret Kitchen)', alarm: EVENT_TEXT.secret() });
        break;
      }
      case 'meeting': {
        R.g[k].invite = 300; R.g[k].meetCool = 600;
        g.broadcastEvent({ k: 'rvNews', text: G.boss + ' wants a meeting at ' + G.place + '. Come alone. Or don\'t. Just come. (They won\'t touch you for 5 minutes.)', alarm: EVENT_TEXT.meeting(G), ding: true });
        break;
      }
    }
    g.dirty();
  }

  /* ---------------- missions ---------------- */
  startMission(pid, key, k) {
    const g = this.g, W = this.W, R = this.R, M0 = MISSIONS[key];
    if (R.mission || !M0) return g.tell(pid, 'One mission at a time.');
    k = k || M0.who;
    const M = { k: key, g: k, t: M0.t };
    const H = g.hold(pid);
    if (key === 'race' || key === 'record' || key === 'bigorder') {
      const o = g.orders.spawn({ accepted: true });
      Object.assign(o, { mission: key, top: [], extra: false, sting: false, rich: false, big: false, rvChecked: true, name: key === 'bigorder' ? 'The Mayor\'s Secret Party' : o.name });
      if (key === 'bigorder') { o.qty = o.left = 4; o.pay = Math.round(o.pay * 2.5); o.t = o.tmax = M0.t; o.rv = { g: 'delivery', t: 170 }; }
      else { o.qty = o.left = 1; if (H.length < 8) H.push({ k: 'box', sauce: 1, cheese: 1, top: [], cook: 1 }); }
      if (key === 'race') { const at = g.orders.at(o), p = g.allPlayers().find(p => p.id === pid) || { x: 140, z: 80 }; o.rv = { g: 'delivery', t: Math.hypot(at.x - p.x, at.z - p.z) / 8.5 + 10 }; }
      if (key === 'record') { o.t = o.tmax = 45; }
      if (o.rv) o.rv.t0 = o.rv.t;
      M.order = o.id;
    }
    if (key === 'shipment') {
      const a = pick(SHIPMENT_AREAS), col = g.town.col;
      M.drops = [];
      for (let i = 0; i < 4; i++) { let x, z, n = 0; do { x = a[0] + rand(-9, 9); z = a[1] + rand(-9, 9); n++; } while (n < 20 && col.solidAt(x, z, 0.8, 0, 0.5)); M.drops.push({ x, z, s: pick(['cheese', 'pepperoni', 'sausage', 'mushroom']), got: 0 }); }
      M.next = 30; M.area = a;
    }
    if (key === 'takeover') { M.me = 0; M.them = 0; }
    if (key === 'inspection') { M.left = 3; M.done = 0; M.taken = 0; }
    R.mission = M;
    g.broadcastEvent({ k: 'rvNews', text: 'MISSION: ' + M0.name + '. ' + M0.desc, alarm: M0.name.toUpperCase() });
    g.dirty();
  }
  _mission(dt, players) {
    const g = this.g, W = this.W, R = this.R, M = R.mission;
    if (!M) return;
    M.t -= dt;
    if (M.order && !W.orders.some(o => o.id === M.order)) { if (R.mission === M) R.mission = null; return; }
    if (M.k === 'shipment') {
      M.next -= dt;
      if (M.next <= 0) { M.next = 30; const d = M.drops.find(d => !d.got); if (d) { d.got = -1; g.broadcastEvent({ k: 'rvNews', text: 'The Frozen Pizza Gang grabbed one of the crates! (' + M.drops.filter(d => !d.got).length + ' left)' }); g.dirty(); } }
      if (M.drops.every(d => d.got)) { const n = M.drops.filter(d => d.got > 0).length; this._missionEnd(n >= 2, n + ' of 4 crates are yours.', n * 700); return; }
    }
    if (M.k === 'takeover') {
      M.them += dt * 2.4;
      if (M.me >= 100) { R.pizzeria = true; this._missionEnd(true, 'MAMMA MIA\'S is yours! It brings in money every minute now.'); return; }
      if (M.them >= 100) { this._xp('italian', 0.5); this._missionEnd(false, 'The Italian Guys planted their flag on MAMMA MIA\'S. Don Vincenzo is unbearable about it.'); return; }
    }
    if (M.k === 'inspection' && M.done >= 3) { this.gang(M.g).rel = Math.min(100, this.gang(M.g).rel + 25); this._missionEnd(true, 'The inspectors found nothing at Nonna\'s Garage. Don Vincenzo owes you one. (Relationship +25)'); return; }
    if (M.k === 'kitchen' && M.wrecked) { this._missionEnd(true, 'Their secret kitchen is flour and regret now.'); return; }
    if (M.t <= 0) {
      if (M.k === 'kitchen') { R.secret = null; this._missionEnd(false, 'The secret kitchen packed up and moved. Next time.'); return; }
      if (M.k === 'inspection') { this.gang(M.g).rel -= 10; this._missionEnd(false, 'The inspectors found crates of "tomatoes" at Nonna\'s Garage. Don Vincenzo is NOT happy with you.'); return; }
      if (!M.order) { this._missionEnd(false, 'Out of time.'); return; }
    }
  }
  _missionEnd(win, text, pay) {
    const g = this.g, W = this.W, R = this.R, M = R.mission; if (!M) return;
    const reward = pay != null ? pay : win ? MISSIONS[M.k].reward : 0;
    if (win && reward) { W.money += reward; W.stats.earned += reward; g.debts.addRep(3); }
    if (M.k === 'kitchen') R.secret = null;
    R.mission = null;
    g.broadcastEvent({ k: 'rvNews', text: text + (reward ? ' (+' + money(reward) + ')' : ''), alarm: win ? 'MISSION COMPLETE!' : pick(FAIL) });
    g.dirty();
  }

  /* ---------------- money from shares and the old pizzeria; ally perks ---------------- */
  _income(dt) {
    const g = this.g, W = this.W, R = this.R;
    R.incomeT -= dt;
    if (R.incomeT > 0) return;
    R.incomeT = 60;
    let n = 0;
    for (const k of GANG_KEYS) if (R.share[k]) n += 120 * R.g[k].lvl;
    if (R.pizzeria) n += 150;
    if (n) { W.money += n; W.stats.earned += n; g.tell(null, 'Your cut this minute: ' + money(n) + (R.pizzeria ? ' (incl. MAMMA MIA\'S)' : '') + '.'); }
    if (R.g.frozen.ally) for (const s of ['dough', 'sauce', 'cheese']) if (W.stock[s] <= 0) { W.stock[s] += 5; g.tell(null, 'The Frozen Pizza Gang dropped off 5 ' + STOCK_NAME[s].toLowerCase() + ' (frozen, but still). Allies!'); break; }
    g.dirty();
  }
  /** host: an inspection is starting - allies call ahead */
  inspectionWarn() { return this.R.g.italian.ally ? 15 : 0; }

  /* ---------------- actions ---------------- */
  exec(pid, a) {
    const g = this.g, W = this.W, R = this.R;
    const p = g.allPlayers().find(p => p.id === pid) || { x: a.x || 0, z: a.z || 0 };
    const H = g.hold(pid);
    switch (a.op) {
      case 'sab': return this._sab(pid, p, a.g, a.id, H);
      case 'cam': return this.camAction(pid, a.g, a.id, a.how);
      case 'fixCam': if (R.hqOff[a.id]) { delete R.hqOff[a.id]; g.sfx('ding', p); g.tell(pid, this._camName('hq', a.id) + ' is back online.'); } break;
      case 'clean': { const i = R.mess.findIndex(m => Math.hypot(m.x - a.x, m.z - a.z) < 0.6); if (i >= 0) { R.mess.splice(i, 1); g.sfx('splat', p); } break; }
      case 'display': { const i = H.findIndex(it => it.k === 'trophy'); if (i < 0) return; const t = H.splice(i, 1)[0]; R.trophies.push(t.g); g.debts.addRep(4); W.stats.trophies = (W.stats.trophies || 0) + 1; g.broadcastEvent({ k: 'rvNews', text: 'You put ' + GANGS[t.g].name + '\'s trophy on display in the storage room. They are going to be SO mad.', alarm: 'TROPHY!' }); this.gang(t.g).rel -= 20; break; }
      case 'deal': return this._deal(pid, a.yes);
      case 'meet': return this._meet(pid, a.g, a.choice);
      case 'mission': return this.startMission(pid, a.key, a.g);
      case 'claim': { const M = R.mission; if (M && M.k === 'takeover') { M.me = Math.min(100, M.me + 11); g.sfx('thud', p); } break; }
      case 'pick': { const M = R.mission; if (!M || M.k !== 'shipment') return; const d = M.drops[a.i]; if (!d || d.got) return; if (H.length >= 4) return g.tell(pid, 'Your hands are full.'); d.got = 1; H.push({ k: 'crate', s: d.s, n: 6 }); g.sfx('pickup', p); break; }
      case 'tomato': { const M = R.mission; if (!M || M.k !== 'inspection' || M.taken >= 3) return; if (H.length) return g.tell(pid, 'Hands free first.'); M.taken++; H.push({ k: 'crate', s: 'sauce', n: 4, tom: true }); break; }
      case 'hide': { const M = R.mission; const i = H.findIndex(it => it.tom); if (!M || M.k !== 'inspection' || i < 0) return; H.splice(i, 1); M.done++; g.sfx('drop', p); g.tell(pid, 'Hidden behind the dumpster. (' + M.done + '/3)'); break; }
      case 'wreckStand': { if (!R.popup) return; const k = R.popup.g; R.popup = null; g.addHeat(3); this.gang(k).rel -= 10; this._xp(k, -0.15); g.broadcastEvent({ k: 'rvNews', text: 'You knocked over the ' + GANGS[k].short + ' pizza stand. The customers come running back.', alarm: 'STAND DOWN!' }); g.fxAt('splat', p.x, 1, p.z); break; }
      case 'flyers': { if (!R.popup || W.money < 1500) return; W.money -= 1500; R.popup.t = Math.min(R.popup.t, 2); g.tell(null, '2-FOR-1! The customers forget the stand ever existed.'); break; }
      case 'wreckKitchen': { const M = R.mission; if (!M || M.k !== 'kitchen' || !M.found) return; M.wrecked = true; this._xp(M.g, -0.8); this.gang(M.g).eff -= 0.3; this.gang(M.g).rel -= 10; g.fxAt('splat', p.x, 1, p.z); break; }
      case 'found': this._foundKitchen(pid); break;
      case 'report': return this._report(pid);
      case 'save': { const f = (W.footage || []).find(f => f.id === a.id); if (f) { f.saved = !f.saved; } break; }
      case 'bagRaid': {   // a caught intruder goes in a trash bag
        const r = R.raid, inv = W.inv?.[pid];
        if (!r || r.st !== 'caught' || Math.hypot(p.x - r.x, p.z - r.z) > 3) return;
        if (!inv || !(inv.sack > 0)) return g.tell(pid, 'You need a Comically Large Trash Bag (General store at the mall).');
        if (H.length) return g.tell(pid, 'You need both hands free to bag him.');
        inv.sack--;
        H.push({ k: 'bag', hostage: true, g: r.g, id: 'h' + (++R.hseq || (R.hseq = 1)), name: r.name });
        g.addHeat(2); g.debts.addRep(2);
        g.broadcastEvent({ k: 'rvNews', text: '*FWUMP.* ' + r.name + ' is in the bag. Take him down to the Time-Out Chair in your storage room, snap a photo, and show it to ' + GANGS[r.g].boss + '.', alarm: 'GOT HIM!' });
        g.sfx('whoosh', p);
        R.raid = null;
        break;
      }
      case 'ransom': return this._ransom(pid, a, H);
      case 'seatHostage': {   // into the Time-Out Chair: hood, cuffs
        const bi = H.findIndex(i => i.k === 'bag' && i.hostage); if (bi < 0) return;
        if (g.debts.chairTaken()) return g.tell(pid, 'The Time-Out Chair is taken. One guest at a time.');
        const b = H.splice(bi, 1)[0];
        R.captive = { g: b.g, name: b.name, id: b.id };
        g.broadcastEvent({ k: 'dlg', pid, lines: [['narr', 'You sit ' + b.name + ' in the Time-Out Chair, pull the hood down and click the cuffs shut.'], ['hostage', 'Is this the part where you take my picture? Get my good side. It\'s the left.'], ['narr', 'Take his photo (instant camera, E at the chair), then show it to ' + GANGS[b.g].boss + ' at ' + GANGS[b.g].place + '.']], who: { hostage: { name: b.name, color: '#9a9aaa' } } });
        break;
      }
      case 'photo': {
        const c = R.captive, inv = W.inv?.[pid];
        if (!c) return;
        if (!inv?.polaroid) return g.tell(pid, 'You need an instant camera (General store at the mall).');
        inv.photo = { g: c.g, name: c.name, id: c.id };
        g.broadcastEvent({ k: 'photo', pid, g: c.g, name: c.name });
        break;
      }
      case 'letGoCaptive': {
        const c = R.captive; if (!c) return;
        R.captive = null; this.gang(c.g).rel = Math.min(100, this.gang(c.g).rel + 5);
        for (const v of Object.values(W.inv || {})) if (v.photo?.id === c.id) delete v.photo;
        g.broadcastEvent({ k: 'rvNews', text: 'You let ' + c.name + ' go. He ran all the way home to ' + GANGS[c.g].place + '. (They like you a tiny bit more.)' });
        break;
      }
      case 'askMeet': { const G = this.gang(a.g); if (G.meetCool > 0) return g.tell(pid, GANGS[a.g].boss + ' is "busy". (Try again in ' + Math.ceil(G.meetCool) + 's.)'); G.invite = 300; G.meetCool = 300; g.tell(null, GANGS[a.g].boss + ' will see you at ' + GANGS[a.g].place + '. (5 minutes)'); break; }
    }
    g.dirty();
  }

  /** host: something sabotaged in a rival's building */
  _sab(pid, p, k, id, H) {
    const g = this.g, W = this.W, G = this.gang(k), P = this.place(k), N = GANGS[k];
    const s = P.st.find(s => s.id === id); if (!s || G.st[id]) return;
    if (Math.hypot(p.x - s.x, p.z - s.z) > 3.2) return;
    this.sabT[pid] = this.time;
    let text = '', cool = 240, eff = 0, xp = 0;
    switch (s.kind) {
      case 'register': { const n = Math.min(G.cash, Math.round((1500 + G.lvl * 900) * rand(0.7, 1.1))); G.cash -= n; W.money += n; W.stats.earned += n; text = 'You emptied their register: +' + money(n) + '.'; eff = 0.15; xp = 0.2; g.sfx('cash', p); break; }
      case 'oven': text = { italian: 'You stuffed a dish towel up Nonna\'s oven. It wheezes and dies.', delivery: 'You turned the Speed Oven 9000 to "defrost". Forever.', frozen: 'You set the microwave clock to 88:88. It refuses to work until someone fixes it.' }[k]; eff = 0.25; xp = 0.25; cool = 200; break;
      case 'shelf': text = 'CRASH. Their whole shelf is on the floor.'; eff = 0.15; xp = 0.12; cool = 260; g.sfx('thud', p); break;
      case 'special': text = { italian: 'You dumped a whole cup of salt in Nonna\'s sauce. Their pizza is ruined for days.', delivery: 'You took ALL the van keys. Their deliveries are crawling (half speed, 4 minutes).', frozen: 'You unplugged THE BIG FREEZER. Puddles of profit everywhere.' }[k]; eff = 0.3; xp = 0.3; if (k === 'delivery') G.slow = 240; if (k === 'frozen') G.cash = Math.max(0, G.cash - 2500); cool = 300; break;
      case 'crate': { if (H.length >= 4 || H.some(i => i.k !== 'crate')) return g.tell(pid, 'Your hands are full.'); const st = ['cheese', 'pepperoni', 'sauce'][s.i]; H.push({ k: 'crate', s: st, n: 6, hot: k, slot: s.i }); text = 'You grabbed a crate of their ' + STOCK_NAME[st].toLowerCase() + '. Now get it out of here.'; xp = 0.06; cool = 360; break; }
      case 'trophy': { if (H.length) return g.tell(pid, 'You need both hands for this.'); H.push({ k: 'trophy', g: k }); text = 'You took their trophy. RUN. (Put it on display in your storage room.)'; eff = 0.1; xp = 0.15; cool = 900; break; }
    }
    G.st[id] = { t: cool, by: pid };
    G.eff = Math.max(0.2, G.eff - eff);
    this._xp(k, -xp);
    this._noise(k, s.x, s.z, s.kind === 'shelf' ? 1 : 0.4);
    g.broadcastEvent({ k: 'rvSab', pid, g: k, id, text, x: s.x, z: s.z });
    g.dirty();
  }

  /** host: a camera gets smashed, cut, blocked or hit by something thrown (k = gang key) */
  camAction(pid, k, id, how) {
    const g = this.g, G = this.gang(k);
    if (!G || G.off[id]) return false;
    const c = this.camsOf(k).find(c => c.id === id); if (!c) return false;
    G.off[id] = { t: 0, why: how, notice: rand(45, 90) };
    this.sabT[pid] = this.time;
    if (how === 'smash' || how === 'throw') this._noise(k, c.x, c.z, 0.5);
    g.broadcastEvent({ k: 'camOff', g: k, id, name: c.name, how, x: c.x, y: c.y, z: c.z });
    g.dirty();
    return true;
  }
  /** host, from BlackMarket: a bat/mallet/toolbox used near a camera (or an intruder) */
  gearUse(pid, key, a) {
    const R = this.R;
    // an intruder in your hideout
    if ((key === 'foambat' || key === 'mallet') && R.raid && R.raid.st !== 'flee' && Math.hypot(R.raid.x - a.x, R.raid.z - a.z) < 2.8) return this.foilRaid(pid, true);
    if (key !== 'foambat' && key !== 'mallet' && key !== 'toolbox') return false;
    for (const k of GANG_KEYS) for (const c of this.camsOf(k)) {
      if (Math.hypot(c.x - a.x, c.z - a.z) > 2.7) continue;
      return this.camAction(pid, k, c.id, key === 'toolbox' ? 'cut' : 'smash');
    }
    return false;
  }
  /** host: something thrown (Q) - did it hit a camera? */
  thrown(pid, a) {
    const p = this.g.allPlayers().find(p => p.id === pid); if (!p) return false;
    const dir = Math.atan2(a.x - p.x, a.z - p.z);
    for (const k of GANG_KEYS) for (const c of this.camsOf(k)) {
      const d = Math.hypot(c.x - p.x, c.z - p.z); if (d > 9 || this.gang(k).off[c.id]) continue;
      let da = Math.atan2(c.x - p.x, c.z - p.z) - dir; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) < 0.32 && !this.g.town.col.blocked(p.x, p.z, c.x, c.z, 0)) return this.camAction(pid, k, c.id, 'throw');
    }
    return false;
  }

  _deal(pid, yes) {
    const g = this.g, W = this.W, R = this.R, o = R.offer; if (!o) return;
    const G = this.gang(o.g), N = GANGS[o.g];
    R.offer = null;
    if (!yes) { G.rel -= 5; g.tell(null, N.boss + ': "Your loss."'); return; }
    if (o.kind === 'trade') { if (W.stock[o.give] < o.giveN) { R.offer = o; return g.tell(pid, 'You don\'t have ' + o.giveN + ' ' + STOCK_NAME[o.give].toLowerCase() + '.'); } W.stock[o.give] -= o.giveN; W.stock[o.get] += o.getN; G.rel += 8; g.tell(null, 'Deal! +' + o.getN + ' ' + STOCK_NAME[o.get].toLowerCase() + '.'); }
    if (o.kind === 'cash') { W.money += o.amt; W.stats.earned += o.amt; this._xp(o.g, 0.5); G.rel += 10; g.tell(null, 'You sold "the recipe". +' + money(o.amt) + '. ' + N.name + ' will grow faster now.'); }
    if (o.kind === 'share') { if (W.money < o.amt) { R.offer = o; return g.tell(pid, 'You can\'t afford it.'); } W.money -= o.amt; R.share[o.g] = true; G.rel += 15; g.tell(null, 'You own 20% of ' + N.place + ' now. Your cut arrives every minute.'); }
    if (o.kind === 'partner') { G.ally = true; G.rel = Math.max(G.rel, 60); g.broadcastEvent({ k: 'rvNews', text: 'You are now partners with ' + N.name + '!', alarm: 'NEW ALLY!' }); }
  }
  _meet(pid, k, choice) {
    const g = this.g, W = this.W, G = this.gang(k), N = GANGS[k];
    if (choice === 'partner') {
      if (G.rel < -25) return g.say(pid, [['boss', 'Partners? After what you did to my ' + { italian: 'sauce', delivery: 'vans', frozen: 'freezer' }[k] + '? Get out of my office.']]);
      G.ally = true; G.rel = Math.max(G.rel, 60);
      g.broadcastEvent({ k: 'rvNews', text: 'You shook hands with ' + N.boss + '. ' + N.name + ' are your allies now.', alarm: 'NEW ALLY!' });
    }
    if (choice === 'buyin') { const amt = 6000 + G.lvl * 2000; if (W.money < amt) return g.tell(pid, 'You need ' + money(amt) + '.'); W.money -= amt; this.R.share[k] = true; G.rel += 15; g.tell(null, 'You own 20% of ' + N.place + '. Your cut arrives every minute.'); }
    if (choice === 'threat') { G.rel -= 15; G.invite = 0; g.say(pid, [['boss', 'Then we\'re done talking. Frank, show them out.'], ['frank', 'This way. Mind the oil stain.']]); }
    G.meetCool = Math.max(G.meetCool, 120);
  }
  _foundKitchen(pid) {
    const g = this.g, W = this.W, R = this.R, M = R.mission, S = R.secret;
    if (!M || M.k !== 'kitchen' || M.found || !S) return;
    M.found = true; S.found = true;
    const d = g.town.poi.deadPizzerias[S.i];
    // a photo: one still frame of them cooking, for the police
    const cam = { id: 'photo', name: 'YOUR PHONE CAMERA', x: d.x - 2.5, y: 1.6, z: d.z - 1.5, yaw: Math.atan2(2.5, 3.5), pitch: 0.12 };
    const fr = [[W.time, [['cook', 'c:' + S.g, d.x, d.z + 2, Math.PI, 2]]]];
    W.footage = W.footage || []; W.footSeq = (W.footSeq || 0) + 1;
    W.footage.push({ id: W.footSeq, cam, place: 'photo', culprit: S.g, t: Math.round(W.time), frames: fr, saved: true, reported: false, photo: true });
    g.broadcastEvent({ k: 'rvNews', text: 'It\'s ' + GANGS[S.g].name + '! You snapped a photo (saved as evidence). Wreck the kitchen (hold E) or take the photo to the police.', alarm: 'SECRET KITCHEN FOUND!' });
  }
  /* ---------------- ransom: you have their guy in a bag ----------------
     The boss has a secret limit (what the guy is worth to him), an offer
     that starts low, and patience. Ask for too much and you burn patience;
     ask for close to his limit and he meets you halfway; threaten him and
     he might go up. Out of patience: he walks away (try again later). */
  _ransom(pid, a, H) {
    const g = this.g, W = this.W, R = this.R;
    // the proof: a photo of their guy, who is (still) in your Time-Out Chair
    const inv = W.inv?.[pid], ph = inv?.photo;
    const bag = ph && R.captive && R.captive.id === ph.id ? ph : null;
    R.ransom = R.ransom || {};
    let n = R.ransom[pid];
    const send = (lines, done, paid) => g.broadcastEvent({ k: 'ransom', pid, g: n?.g || bag?.g, lines, offer: n?.offer, patience: n?.patience, name: n?.name, done: !!done, paid: paid || 0 });
    if (a.step === 'start') {
      if (!bag) return g.tell(pid, 'You need a photo of their guy in your Time-Out Chair.');
      const G = this.gang(bag.g);
      if (G.ransomCool > this.time) return g.tell(pid, GANGS[bag.g].boss + ' won\'t talk to you yet. (' + Math.ceil(G.ransomCool - this.time) + 's)');
      const value = Math.round((3000 + G.lvl * 2500 + rand(0, 1500)) / 50) * 50;
      n = R.ransom[pid] = { g: bag.g, name: bag.name, value, offer: Math.round(value * 0.35 / 50) * 50, patience: 3, id: bag.id };
      return send(RANSOM.open(bag.name));
    }
    if (!n || !bag || bag.id !== n.id) { delete R.ransom[pid]; return; }
    const N = GANGS[n.g], G = this.gang(n.g), fmt = (s) => s.replace('{O}', money(n.offer));
    const end = (amt, line) => {
      delete inv.photo; R.captive = null;
      W.money += amt; W.stats.earned += amt; G.cash = Math.max(0, G.cash - amt);
      this._xp(n.g, -0.2); G.rel = Math.max(-100, G.rel - 8); g.debts.addRep(3);
      delete R.ransom[pid];
      g.broadcastEvent({ k: 'ransom', pid, g: n.g, lines: [['boss', line], ['narr', 'You call the hideout: "Let him go." Ten minutes later ' + n.name + ' comes running down the street, still wearing the hood, and gets a very long hug from ' + N.boss + '.']], done: true, paid: amt, name: n.name });
      g.broadcastEvent({ k: 'rvNews', text: N.name + ' paid ' + money(amt) + ' to get ' + n.name + ' back.', alarm: 'RANSOM PAID!' });
      g.sfx('cash', null);
    };
    const walk = () => { G.ransomCool = this.time + 60; delete R.ransom[pid]; send([['boss', pick(RANSOM.walk)], ['narr', 'He slams the door. Try again in a minute... or bag ' + n.name + ' back up and show them what happens to people who don\'t pay. (The dumpster behind the hideout looks roomy.)']], true); };
    switch (a.step) {
      case 'take': return end(n.offer, pick(RANSOM.accept));
      case 'demand': {
        const amt = Math.max(n.offer, Math.round(+a.amt || 0));
        if (amt <= n.value * 0.8) return end(amt, pick(RANSOM.accept));
        if (amt <= n.value * 1.15) { n.offer = Math.round(Math.min(n.value, n.offer + (amt - n.offer) * rand(0.4, 0.65)) / 50) * 50; n.patience--; }
        else n.patience -= 2;
        if (n.patience <= 0) return walk();
        return send([['you', 'I want ' + money(amt) + '.'], ['boss', amt <= n.value * 1.15 ? fmt(pick(RANSOM.counter)) : pick(RANSOM.insult)], ...(Math.random() < 0.5 ? [['narr', pick(RANSOM.hostage)]] : [])]);
      }
      case 'threat': {
        if (n.threatened) { n.patience--; if (n.patience <= 0) return walk(); return send([['you', 'Do you want him back or NOT?'], ['boss', 'You already said that. It worked less the second time.']]); }
        n.threatened = true;
        const armed = ['foambat', 'mallet'].includes(W.eq?.[pid]);
        if (Math.random() < (armed ? 0.8 : 0.5)) { n.offer = Math.round(Math.min(n.value, n.offer * 1.35) / 50) * 50; return send([['you', (armed ? '(you tap the photo with your bat) ' : '') + pick(RANSOM.threat)], ['boss', fmt(pick(RANSOM.scaredYes))]]); }
        n.patience--; if (n.patience <= 0) return walk();
        return send([['you', pick(RANSOM.threat)], ['boss', pick(RANSOM.scaredNo)]]);
      }
      case 'leave': delete R.ransom[pid]; return send([['you', 'I\'ll think about it.'], ['boss', 'You do that.']], true);
    }
  }
  /** the photo: a white flash, a click, and a real picture of what you're looking at, in a white frame */
  onPhoto(e) {
    const g = this.g;
    g.fx.sparkle(g.town.poi.storageChair.x, 1.6, g.town.poi.storageChair.z, '#ffffff');
    if (e.pid !== g.me) return;
    g.audio.tone(2400, 0.04, 'square', 0.1); g.audio.noise?.(0.25, 0.08, 'highpass', 2000, 1);
    const fl = document.createElement('div'); fl.className = 'flash'; document.body.appendChild(fl); setTimeout(() => fl.remove(), 600);
    // print it: render the view into a canvas
    if (!this.photoRT) { this.photoRT = new THREE.WebGLRenderTarget(320, 320, { samples: 4 }); this.photoRT.texture.colorSpace = THREE.SRGBColorSpace; }
    const cam = g.camera.clone(); cam.aspect = 1; cam.updateProjectionMatrix();
    const cv = document.createElement('canvas');
    g.inv.icons.draw(g.scene, cam, this.photoRT, cv);
    const card = document.createElement('div'); card.className = 'polaroid';
    card.appendChild(cv);
    const cap = document.createElement('div'); cap.textContent = e.name + ', alive and well. Pay up.'; card.appendChild(cap);
    document.body.appendChild(card);
    if (!this.keepPhoto) { setTimeout(() => card.classList.add('out'), 4200); setTimeout(() => card.remove(), 5000); }   // (screenshots keep it)
    g.ui.toast('Got the photo! Show it to ' + GANGS[e.g].boss + ' at ' + GANGS[e.g].place + ' (E at the door).');
  }
  /** everyone: the boss answered */
  onRansom(e) {
    const g = this.g; if (e.pid !== g.me) return;
    SPEAKERS.boss = { name: GANGS[e.g].boss, color: GANGS[e.g].color };
    SPEAKERS.hostage = { name: e.name || 'The Bag', color: '#9a9aaa' };
    this.ransomState = e.done ? null : e;
    g.ui.dialog(e.lines).then(() => { if (!e.done && this.ransomState === e) this.ransomMenu(e); });
  }
  ransomMenu(e) {
    const g = this.g, N = GANGS[e.g], o = e.offer;
    const tiers = [[1.6, 'Ask for a bit more'], [2.4, 'Ask for a lot more'], [4, 'Ask for a RIDICULOUS amount']];
    g.ui.menu({
      title: 'Ransom: ' + e.name, sub: N.boss + ' offers ' + money(o) + ' · his patience: ' + '|'.repeat(Math.max(0, e.patience)) + ' (ask too much and he walks away)',
      items: [
        { label: 'Take the ' + money(o), sub: 'Hand him over. Done.', on: () => g.act({ k: 'rv', op: 'ransom', step: 'take' }) },
        ...tiers.map(([m, l]) => { const amt = Math.round(o * m / 50) * 50; return { label: l + ': ' + money(amt), sub: m < 2 ? 'He\'ll probably meet you halfway.' : m < 3 ? 'Risky. He might get insulted.' : 'He will DEFINITELY get insulted. But what if?', on: () => g.act({ k: 'rv', op: 'ransom', step: 'demand', amt }) }; }),
        { label: 'Pay up. Or he sleeps with the anchovies.', sub: 'Make him an offer he can\'t refuse. Works better with a bat in your hand. Only works once.', on: () => g.act({ k: 'rv', op: 'ransom', step: 'threat' }) },
        { label: 'Walk away (keep him for now)', on: () => g.act({ k: 'rv', op: 'ransom', step: 'leave' }) },
      ],
    });
  }
  _report(pid) {
    const g = this.g, W = this.W, R = this.R;
    const ev = (W.footage || []).filter(f => f.saved && !f.reported && f.culprit);
    const lines = [['cop', 'Evidence? Let\'s see it.']];
    if (!ev.length) return g.say(pid, [['cop', 'You have no evidence. You have a hunch. We don\'t arrest hunches.']]);
    for (const f of ev) {
      f.reported = true;
      const k = f.culprit, G = this.gang(k), N = GANGS[k];
      const r = f.photo ? 0.6 : Math.random();
      if (r < 0.25) lines.push(['cop', 'Recording #' + f.id + ' (' + f.cam.name + '): Is that a raccoon? It\'s very grainy. We can\'t use this.']);
      else if (r < 0.55) { const n = Math.min(G.cash, 2500 + G.lvl * 1000); G.cash -= n; this._xp(k, -0.3); lines.push(['cop', 'Recording #' + f.id + ': That\'s definitely one of ' + N.name + '. We fined them ' + money(n) + '.']); }
      else if (r < 0.82) { G.shut = f.photo ? 240 : 180; lines.push(['cop', 'Recording #' + f.id + ': Good catch. We\'re shutting down part of ' + N.place + ' for a few minutes. (No raids, no stealing customers, no growing.)']); }
      else { G.heat = 240; lines.push(['cop', 'Recording #' + f.id + ': We\'ll keep a car outside ' + N.place + ' for a while. (They grow slower - and careful: so does sneaking in.)']); }
      G.rel -= 10;
    }
    if (Math.random() < 0.25) { g.inspections.tip(2); lines.push(['cop', '...Out of curiosity. What exactly do YOU do at that "shoe repair shop"?'], ['you', 'Shoes.'], ['cop', 'Hm.']); }
    g.say(pid, lines);
    g.dirty();
  }

  /* ======================================================================
     EVERYONE: events, visuals, prompts
     ====================================================================== */
  onEvent(e) {
    const g = this.g, ui = g.ui, a = g.audio, me = e.pid === g.me, P = g.player;
    switch (e.k) {
      case 'rvNews': ui.news(e.text); if (e.alarm) ui.alarm(e.alarm); if (e.ding) { a.ding(); a.phone(); } break;
      case 'rvBark': {
        g.bubble(() => ({ x: e.x, z: e.z }), e.text);
        if (e.chase && me) { ui.alarm('THEY SAW YOU! RUN!'); a.hey(null); }
        break;
      }
      case 'rvSpotted': if (me) { ui.toast('A camera saw you: ' + e.cam + (e.busy ? '. They KNOW it was you.' : '.'), e.busy ? 'bad' : ''); a.tone(880, 0.08, 'square', 0.05); } break;
      case 'rvSab': if (me) { ui.toast(e.text); } g.fx.sparkle(e.x, 1.3, e.z, '#ffd23f'); break;
      case 'camOff': {
        if (e.x != null) { g.fx.text('CAMERA OFFLINE', new THREE.Vector3(e.x, e.y + 0.6, e.z), '#ff5a5a', true); if (e.how !== 'block') { g.fx.sparkle(e.x, e.y, e.z, '#9ad8ff'); a.thud({ x: e.x, z: e.z }); } }
        if (e.mine) { this.motion('CAMERA OFFLINE', e.name, 'Somebody got to it. Fix it (hold E at the camera).'); }
        break;
      }
      case 'motion': this.motion('MOTION DETECTED!', e.cam, e.where + (e.g ? ' - looks like ' + GANGS[e.g].name : '')); break;
      case 'raidDone': ui.alarm('RAIDED!'); ui.news(e.text); a.fail(); break;
      case 'raidFoiled': ui.alarm('CAUGHT RED-HANDED!'); ui.news(GANGS[e.g].name + '\'s sneaky guy froze like a deer in headlights and dropped his wallet (+$500). Quick: bag him (R) before he runs!'); g.fx.text(e.bonk ? 'BONK!' : 'HEY!', new THREE.Vector3(e.x, 2.2, e.z), '#ffd23f', true); a.cheer(); break;
      case 'caught': if (me) this.caughtScene(e); else ui.news((e.pid === g.me ? 'You' : 'Your friend') + ' got caught by ' + GANGS[e.g].name + '. They\'ll be back. Your kitchen got "visited".'); break;
    }
  }
  /** the MOTION DETECTED banner */
  motion(title, cam, where) {
    const el = this.motionEl, g = this.g;
    el.innerHTML = `<div class="mt"><span class="rec"></span>${title}</div><div class="mc">${cam}</div><div class="mw">${where || ''}</div><div class="mk"><b class="key">K</b> check the cameras</div>`;
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    clearTimeout(this._mT); this._mT = setTimeout(() => el.classList.remove('on'), 6500);
    for (let i = 0; i < 3; i++) setTimeout(() => g.audio.tone(1240, 0.09, 'square', 0.08), i * 180);
  }

  /** the caught scene: dragged to the back room, they argue, cut away, you wake up at home */
  async caughtScene(e) {
    const g = this.g, ui = g.ui, P = g.player, W = this.W, k = e.g, Pl = this.place(k), N = GANGS[k];
    if (this.cine) return;
    this.cine = { k };
    ui.closeMenu(); g.inv?.close(); ui.alarm('CAUGHT!'); g.audio.fail();
    ui.fade(true);
    await this.wait(0.45);
    const ch = Pl.chair, cc = Pl.caughtCam;
    P.teleport(ch.x, ch.z, 0, Math.PI);
    P.forceHidden = true;
    const grp = new THREE.Group(); g.scene.add(grp);
    const you = makeChar(lookFor(g.profile.look, W.wear[g.me])); you.root.position.set(ch.x, 0.2, ch.z); you.root.rotation.y = Math.PI; grp.add(you.root);
    const a = makeChar({ ...N.crew, belly: 1.3 }), b = makeChar({ ...N.crew, skin: '#f2c29b', hat: 'bald', mustache: false });
    grp.add(a.root, b.root);
    SPEAKERS.crew1 = { name: { italian: 'Big Sal', delivery: 'Speedy Steve', frozen: 'Chilly Chad' }[k], color: N.color };
    SPEAKERS.crew2 = { name: 'Frank', color: '#c8c8d8' };
    g.cam.override = { pos: new THREE.Vector3(cc.x, cc.y, cc.z), look: new THREE.Vector3(cc.lx, cc.ly, cc.lz) };
    ui.cinema(true);
    ui.fade(false);
    const t0 = performance.now();
    this.cine.tick = (dt) => {
      const t = (performance.now() - t0) / 1000;
      // pacing back and forth, past each other, in front of the chair
      const ax = ch.x + Math.sin(t * 0.9) * 2.4, bx = ch.x - Math.sin(t * 0.75 + 1) * 2.0;
      a.root.position.set(ax, 0.05, ch.z - 2.2); a.root.rotation.y = Math.cos(t * 0.9) > 0 ? Math.PI / 2 : -Math.PI / 2;
      b.root.position.set(bx, 0.05, ch.z - 3.0); b.root.rotation.y = Math.cos(t * 0.75 + 1) < 0 ? Math.PI / 2 : -Math.PI / 2;
      a.anim(dt, { speed: 2, talk: ui.talking === 'crew1', angry: true }); b.anim(dt, { speed: 1.6, talk: ui.talking === 'crew2' });
      you.anim(dt, { sit: true, panic: 0.5 });
    };
    const lines = pick(CAUGHT);
    const dlg = ui.dialog(lines);
    if (ui.dlg) ui.dlg.auto = true;
    await Promise.race([dlg, this.wait(11)]);
    ui.closeDialog?.();
    // cut away before anything happens
    ui.fade(true);
    await this.wait(0.6);
    ui.alarm('*THUNK*');
    g.audio.thud(null);
    await this.wait(1.4);
    g.scene.remove(grp);
    this.cine = null; P.forceHidden = false;
    g.cam.override = null; ui.cinema(false);
    P.teleport(HQ.door.x - 2.5, HQ.door.z + 1.5, 0, -Math.PI / 2); g.cam.snap = true;
    P.hp = 22;
    ui.fade(false);
    await this.wait(0.6);
    ui.dialog([['narr', 'You wake up outside the hideout. Your head is pounding. Your wallet is ' + money(e.lose) + ' lighter.'], ['narr', 'Something is off about the kitchen...'], ...e.report.map(r => ['narr', r]), ['narr', 'Fix it, clean up... and plan your revenge.']]);
  }

  /** what the local player can do near rival things */
  targets(P, out) {
    const g = this.g, W = this.W, R = this.R, T = g.town.poi;
    if (P.floor !== 0 || this.cine) return;
    const H = g.hold(g.me), top = H[H.length - 1], eq = W.eq?.[g.me];
    const d = (x, z) => Math.hypot(P.pos.x - x, P.pos.z - z);
    const enter = (to, label) => () => { g.ui.fade(true); g.audio.ovenDoor(null); setTimeout(() => { P.teleport(to.x, to.z, 0, to.ry); g.cam.snap = true; g.ui.fade(false); if (label) g.ui.toast(label); }, 300); };
    for (const k of GANG_KEYS) {
      const Pl = this.place(k), G = R.g[k], N = GANGS[k], friendly = G.ally || G.invite > 0;
      // outside: front door, back door
      const dd = d(Pl.out.door.x, Pl.out.door.z);
      if (dd < 2.4) out.push({ x: Pl.out.door.x, z: Pl.out.door.z, d: dd, label: (friendly ? 'Go into ' : 'Sneak into ') + N.place + ' (' + N.name + ', ' + N.levels[G.lvl - 1] + ')', fn: enter(Pl.spawn, friendly ? null : 'You\'re inside ' + N.place + '. Guards, cameras. Be quick.') });
      const db = d(Pl.out.back.x, Pl.out.back.z);
      if (db < 2.2) out.push({ x: Pl.out.back.x, z: Pl.out.back.z, d: db, label: 'Sneak in through the back door (straight into the back room)', fn: enter(Pl.backSpawn, 'In through the back. Nobody saw that. Probably.') });
      // a photo of their guy in your chair: knock and demand a ransom (front door, or the boss's desk)
      const ph = W.inv?.[g.me]?.photo;
      if (ph && ph.g === k && R.captive?.id === ph.id) {
        const dr = Math.min(dd, d(Pl.desk.x, Pl.desk.z));
        if (dr < 2.6) out.push({ x: Pl.out.door.x, z: Pl.out.door.z, d: dr - 1, label: 'Show ' + N.boss + ' the photo of ' + ph.name + ' and demand a ransom', act: { k: 'rv', op: 'ransom', step: 'start' } });
      }
      const inside = this.insideOf(P.pos.x, P.pos.z) === k;
      if (!inside) continue;
      const de = d(Pl.exit.x, Pl.exit.z);
      if (de < 1.8) out.push({ x: Pl.exit.x, z: Pl.exit.z, d: de, label: 'Leave ' + N.place, fn: enter({ x: Pl.out.door.x, z: Pl.out.door.z, ry: Pl.out.ry + Math.PI }) });
      const dk = d(Pl.backSpawn.x, Pl.backSpawn.z + 1.2);
      if (dk < 1.6) out.push({ x: Pl.backSpawn.x, z: Pl.backSpawn.z, d: dk + 0.3, label: 'Slip out the back door', fn: enter({ x: Pl.out.back.x, z: Pl.out.back.z, ry: Pl.out.ry }) });
      // sabotage
      for (const s of Pl.st) {
        const ds = d(s.x, s.z); if (ds > 1.6) continue;
        const done = G.st[s.id];
        if (done) { out.push({ x: s.x, z: s.z, d: ds + 0.2, label: { register: 'The register is empty', oven: 'The oven is out of order', shelf: 'The shelf is on the floor', special: 'Already sabotaged', crate: 'Nothing left here', trophy: 'The trophy is gone (you know why)' }[s.kind], info: true }); continue; }
        const lbl = { register: 'Empty their cash register', oven: 'Sabotage ' + { italian: 'Nonna\'s oven', delivery: 'the Speed Oven 9000', frozen: 'the "artisan" microwave' }[k], shelf: 'Knock over the shelf (LOUD)', special: { italian: 'Salt Nonna\'s sauce', delivery: 'Take the van keys', frozen: 'Unplug THE BIG FREEZER' }[k], crate: 'Grab a crate of their ' + ['cheese', 'pepperoni', 'sauce'][s.i], trophy: 'Steal their trophy (' + { italian: 'the golden pizza cutter', delivery: 'the golden stopwatch', frozen: 'the ice sculpture' }[k] + ')' }[s.kind];
        out.push({ x: s.x, z: s.z, d: ds, label: lbl, hold: HOLD_SAB[s.kind], act: { k: 'rv', op: 'sab', g: k, id: s.id }, whack: s.kind === 'shelf' });
      }
      // their cameras inside (block the lens)
      for (const c of this.camsOf(k)) {
        if (c.outside) continue;
        const dc = d(c.x, c.z); if (dc > 2.2) continue;
        if (G.off[c.id]) { out.push({ x: c.x, z: c.z, d: dc + 0.4, label: c.name + ': offline', info: true }); continue; }
        out.push({ x: c.x, z: c.z, d: dc + 0.2, label: 'Stick a pizza box over the ' + c.name + ' (60s)' + (eq === 'foambat' || eq === 'mallet' ? ' · click: SMASH' : eq === 'toolbox' ? ' · click: cut the wire' : ''), hold: 1.0, act: { k: 'rv', op: 'cam', g: k, id: c.id, how: 'block' } });
      }
      // the boss (meetings)
      const dd2 = d(Pl.desk.x, Pl.desk.z);
      if (dd2 < 2.0) out.push({ x: Pl.desk.x, z: Pl.desk.z, d: dd2, label: G.invite > 0 || G.ally ? 'Sit down with ' + N.boss : N.boss + ' isn\'t expecting you (ask for a meeting on the phone)', fn: G.invite > 0 || G.ally ? () => this.meeting(k) : null, info: !(G.invite > 0 || G.ally) });
      // the inspection mission's crates
      const M = R.mission;
      if (M && M.k === 'inspection' && M.g === k && M.taken < 3) { const tx = Pl.X - 6, tz = 3.5, dt2 = d(tx, tz); if (dt2 < 2) out.push({ x: tx, z: tz, d: dt2, label: 'Grab a crate of "tomatoes" (' + (3 - M.taken) + ' left)', act: { k: 'rv', op: 'tomato' } }); }
    }
    // outside a building: the back alley camera
    for (const k of GANG_KEYS) {
      const c = this.place(k).alley, G = R.g[k], dc = d(c.x, c.z);
      if (dc < 2.6 && !G.off[c.id]) out.push({ x: c.x, z: c.z, d: dc + 0.3, label: 'Cover the ' + c.name + ' (60s)' + (eq === 'foambat' || eq === 'mallet' ? ' · click: SMASH' : ''), hold: 1.0, act: { k: 'rv', op: 'cam', g: k, id: c.id, how: 'block' } });
    }
    // the inspection mission: hide crates behind their dumpster
    const M = R.mission;
    if (M && M.k === 'inspection' && H.some(i => i.tom)) { const o = this.place(M.g).out.door, dh = d(o.x, o.z); if (dh < 5) out.push({ x: o.x, z: o.z, d: dh - 0.5, label: 'Hide the crate out here (' + M.done + '/3)', act: { k: 'rv', op: 'hide' } }); }
    // a caught intruder: bag him before he runs
    if (R.raid && R.raid.st === 'caught') {
      const r = R.raid, dr = d(r.x, r.z), sacks = W.inv?.[g.me]?.sack || 0;
      if (dr < 2.8) out.push({ x: r.x, z: r.z, d: dr - 1, label: sacks ? (H.length ? 'Bag ' + r.name + '! (free your hands first)' : 'BAG ' + r.name.toUpperCase() + '! (' + Math.ceil(r.t) + 's before he runs)') : r.name + ' is frozen in shock (no trash bag! General store, next time)', act: sacks && !H.length ? { k: 'rv', op: 'bagRaid' } : null, info: !sacks || H.length > 0 });
    }
    // the Time-Out Chair: a rival's guy goes in it, you take his picture
    const ch = T.storageChair;
    if (ch && d(ch.x, ch.z) < 2.6) {
      const dc = d(ch.x, ch.z), c = R.captive;
      if (top && top.k === 'bag' && top.hostage) {
        const taken = g.debts.chairTaken();
        out.push({ x: ch.x, z: ch.z, d: dc - 0.6, label: taken ? 'The Time-Out Chair is taken' : 'Sit ' + top.name + ' in the Time-Out Chair (hood and cuffs)', act: taken ? null : { k: 'rv', op: 'seatHostage' }, warn: taken });
      } else if (c) {
        const cam = W.inv?.[g.me]?.polaroid, has = W.inv?.[g.me]?.photo?.id === c.id;
        out.push({ x: ch.x, z: ch.z, d: dc, label: cam ? (has ? 'Take another photo of ' + c.name + ' (you have one: show it to ' + GANGS[c.g].boss + ')' : 'Take a photo of ' + c.name + ' (ransom proof)') : c.name + ' (' + GANGS[c.g].short + ') is in your chair. Get an instant camera (General store) for a ransom photo', act: cam ? { k: 'rv', op: 'photo' } : null, info: !cam, alt: { label: 'Let him go', act: { k: 'rv', op: 'letGoCaptive' } } });
      }
    }
    // your hideout: cameras to fix, mess to clean, the monitor, trophies to display
    for (const c of this.hqCams()) { if (!R.hqOff[c.id]) continue; const dc = d(c.x, c.z); if (dc < 2.6) out.push({ x: c.x, z: c.z, d: dc, label: 'Fix the ' + c.name, hold: 2.0, act: { k: 'rv', op: 'fixCam', id: c.id } }); }
    for (const m of R.mess) { const dm = d(m.x, m.z); if (dm < 1.3) out.push({ x: m.x, z: m.z, d: dm + 0.1, label: 'Clean up the mess', hold: 1.0, act: { k: 'rv', op: 'clean', x: m.x, z: m.z }, slap: true }); }
    const mon = T.monitor, dmo = d(mon.x + 0.8, mon.z);
    if (dmo < 1.7) out.push({ x: mon.x, z: mon.z, d: dmo, label: W.owned?.up?.camera ? 'Check the security monitor (K)' : 'The security monitor (no cameras yet: buy Security Cameras on the laptop)', fn: W.owned?.up?.camera ? () => g.monitor.open() : null, info: !W.owned?.up?.camera });
    if (top && top.k === 'trophy') { const s = T.storage; if (P.pos.x > s.x0 && P.pos.x < s.x1 && P.pos.z > s.z0 && P.pos.z < s.z1) out.push({ d: 0.5, label: 'Put the stolen trophy on display', act: { k: 'rv', op: 'display' } }); }
    // the police desk: evidence
    const pd = T.policeDesk, dp = d(pd.x, pd.z);
    if (dp < 2.8) { const n = (W.footage || []).filter(f => f.saved && !f.reported && f.culprit).length; out.push({ x: pd.x, z: pd.z, d: dp, label: n ? 'Hand in your evidence (' + n + ' recording' + (n > 1 ? 's' : '') + ')' : 'The front desk (save camera footage of a rival on the monitor first)', act: n ? { k: 'rv', op: 'report' } : null, info: !n }); }
    // the pop-up stand
    if (R.popup) { const s = T.popup, ds = d(s.x, s.z); if (ds < 2.6) out.push({ x: s.x, z: s.z, d: ds, label: 'Knock over the ' + GANGS[R.popup.g].short + ' pizza stand', hold: 2.0, act: { k: 'rv', op: 'wreckStand' }, whack: true }); }
    // missions out in town
    if (M && M.k === 'shipment') M.drops.forEach((c, i) => { if (c.got) return; const dc = d(c.x, c.z); if (dc < 1.8) out.push({ x: c.x, z: c.z, d: dc, label: 'Grab the frozen crate (' + STOCK_NAME[c.s] + ')', act: { k: 'rv', op: 'pick', i } }); });
    if (M && M.k === 'takeover') { const t = T.takeover, dt2 = d(t.x, t.z); if (dt2 < 2.6) out.push({ x: t.x, z: t.z, d: dt2, label: 'Claim MAMMA MIA\'S! (you ' + Math.floor(M.me) + '% - them ' + Math.floor(M.them) + '%)', hold: 0.7, act: { k: 'rv', op: 'claim' } }); }
    if (M && M.k === 'kitchen' && R.secret) {
      const s = T.deadPizzerias[R.secret.i], ds = d(s.x, s.z + 2);
      if (!M.found && ds < 5 && Math.abs(P.pos.z - s.z) < 5.5 && Math.abs(P.pos.x - s.x) < 8.5) { if (!this._foundAsked) { this._foundAsked = true; g.act({ k: 'rv', op: 'found' }); setTimeout(() => { this._foundAsked = false; }, 2000); } }
      if (M.found && ds < 2.6) out.push({ x: s.x, z: s.z + 2, d: ds, label: 'Wreck their secret kitchen', hold: 2.2, act: { k: 'rv', op: 'wreckKitchen' }, whack: true });
    }
  }

  /** the boss meeting (local cutscene, then the choices) */
  async meeting(k) {
    const g = this.g, ui = g.ui, Pl = this.place(k), N = GANGS[k], G = this.gang(k);
    if (this.cine) return;
    this.cine = { k, meet: true };
    const mc = Pl.meetCam;
    g.cam.override = { pos: new THREE.Vector3(mc.x, mc.y, mc.z), look: new THREE.Vector3(mc.lx, mc.ly, mc.lz) };
    ui.cinema(true);
    SPEAKERS.boss = { name: N.boss, color: N.color };
    SPEAKERS.frank = { name: 'Frank', color: '#c8c8d8' };
    const lines = MEETING(N);
    const iDrop = lines.findIndex(l => /drops a pizza/.test(l[1]));
    // the dialogue, with Frank dropping his pizza at the right moment
    const dlg = ui.dialog(lines);
    this.cine.tick = () => { const off = this.office; if (ui.dlg && ui.dlg.lines === lines && ui.dlg.i >= iDrop && off && off.k === k && !off.dropped) { off.dropped = true; off.dropT = 0; this.droppedOnce = true; } };
    await dlg;
    ui.cinema(false); g.cam.override = null; this.cine = null;
    setTimeout(() => { if (this.office) { this.office.dropped = false; this.office.boxDown = false; } }, 4000);   // Frank gets a new pizza
    const items = [];
    if (!G.ally) items.push({ label: 'Let\'s be partners.', sub: 'Allies don\'t raid you or steal your customers, and they help out. They also grow faster.', on: () => g.act({ k: 'rv', op: 'meet', g: k, choice: 'partner' }) });
    items.push({ label: 'Buy in: 20% of ' + N.place + ' (' + money(6000 + G.lvl * 2000) + ')', sub: 'Your cut arrives every minute. The bigger they grow, the bigger the cut.', disabled: !!this.R.share[k], on: () => g.act({ k: 'rv', op: 'meet', g: k, choice: 'buyin' }) });
    for (const [mk, M] of Object.entries(MISSIONS)) if (M.who === k) items.push({ label: 'Mission: ' + M.name + ' (' + money(M.reward) + ')', sub: M.desc, disabled: !!this.R.mission, on: () => g.act({ k: 'rv', op: 'mission', key: mk, g: k }) });
    if (!G.ally) items.push({ label: 'This town IS big enough. For us. Not you.', sub: 'Relationship -15. They will remember.', on: () => g.act({ k: 'rv', op: 'meet', g: k, choice: 'threat' }) });
    items.push({ label: 'Leave' });
    ui.menu({ title: N.boss + ', ' + N.name, sub: N.desc, items });
  }

  /** the phone page */
  phoneMenu() {
    const g = this.g, W = this.W, R = this.R;
    const rel = (G) => G.ally ? 'ALLY' : G.rel <= -40 ? 'ENEMY' : G.rel < 0 ? 'hostile' : G.rel >= 30 ? 'friendly' : 'neutral';
    const items = [];
    if (R.offer) { const o = R.offer, N = GANGS[o.g]; items.push({ label: 'DEAL from ' + N.name + ' (' + Math.ceil(o.t) + 's)', sub: o.text, price: 'ACCEPT', on: () => g.act({ k: 'rv', op: 'deal', yes: true }) }); items.push({ label: 'Refuse the deal', sub: N.boss + ' will sulk. (Relationship -5)', on: () => g.act({ k: 'rv', op: 'deal', yes: false }) }); }
    if (R.popup) items.push({ label: 'Print 2-for-1 flyers ($1,500)', sub: 'Win the customers back from the ' + GANGS[R.popup.g].short + ' stand on Anchovy Road (or go knock it over).', disabled: W.money < 1500, on: () => g.act({ k: 'rv', op: 'flyers' }) });
    for (const k of GANG_KEYS) {
      const G = R.g[k], N = GANGS[k];
      items.push({
        label: N.name + ' - ' + N.levels[G.lvl - 1], price: 'LV ' + G.lvl,
        sub: N.boss + ' · ' + rel(G) + (G.shut > 0 ? ' · SHUT DOWN ' + Math.ceil(G.shut) + 's' : '') + (G.heat > 0 ? ' · police watching' : '') + (G.slow > 0 ? ' · no van keys' : '') + ' · growth ' + Math.round(G.xp * 100) + '%' + (R.share[k] ? ' · you own 20%' : '') + (G.invite > 0 ? ' · EXPECTING YOU (' + Math.ceil(G.invite) + 's)' : ''),
        on: () => g.ui.menu({ title: N.name, sub: N.desc + ' Their place: ' + N.place + ' (on the map).', items: [
          { label: 'Ask ' + N.boss + ' for a meeting', sub: G.invite > 0 ? 'He\'s expecting you now.' : 'Go to ' + N.place + ' and sit down at his desk.', disabled: G.invite > 0, on: () => g.act({ k: 'rv', op: 'askMeet', g: k }) },
          { label: 'Show on the map', on: () => g.map.show() },
          { label: 'Back', on: () => this.phoneMenu() },
        ] }),
      });
    }
    if (R.mission) { const M = R.mission, D = MISSIONS[M.k]; items.unshift({ label: 'MISSION: ' + D.name + ' (' + Math.max(0, Math.ceil(M.t)) + 's)', sub: D.desc, disabled: true }); }
    items.push({ label: 'Back to orders', on: () => g.phone() });
    g.ui.menu({ title: 'Rivals', sub: 'The other pizza gangs in town. Ignore them and they grow. Sabotage them, make deals, or take them on.', items, cls: 'phone' });
  }

  /** HUD lines for the task list */
  tasks(out) {
    const R = this.R, M = R.mission, W = this.W;
    if (R.raid && R.raid.st === 'caught') out.unshift({ t: 'CAUGHT ' + R.raid.name.toUpperCase() + '! Bag him (E) - ' + Math.ceil(R.raid.t) + 's', c: 'red' });
    else if (R.raid && R.raid.st !== 'gone' && R.raid.st !== 'flee') out.unshift({ t: 'INTRUDER at the hideout! (' + GANGS[R.raid.g].short + ') Catch him!', c: 'red' });
    const hb = this.g.hold(this.g.me).find(i => i.k === 'bag' && i.hostage) || (W.cars || []).flatMap(c => c.cargo || []).find(i => i.k === 'bag' && i.hostage);
    if (hb) out.unshift({ t: hb.name + ' is in a bag: sit him in your Time-Out Chair (storage room)', c: 'yellow' });
    if (R.captive) { const ph = W.inv?.[this.g.me]?.photo?.id === R.captive.id; out.unshift({ t: R.captive.name + ' is in your chair: ' + (ph ? 'show the photo to ' + GANGS[R.captive.g].boss + ' at ' + GANGS[R.captive.g].place : 'take his photo (instant camera)'), c: 'yellow' }); }
    if (M) {
      const D = MISSIONS[M.k], t = Math.max(0, Math.ceil(M.t));
      let s = D.name + ': ';
      if (M.k === 'takeover') s += 'hold E at MAMMA MIA\'S (you ' + Math.floor(M.me) + '% / them ' + Math.floor(M.them) + '%)';
      else if (M.k === 'shipment') s += M.drops.filter(d => !d.got).length + ' crates left out there (' + t + 's)';
      else if (M.k === 'inspection') s += M.done + '/3 crates hidden (' + t + 's)';
      else if (M.k === 'kitchen') s += M.found ? 'wreck it, or report the photo (' + t + 's)' : 'search the dead pizzerias (' + t + 's)';
      else { const o = W.orders.find(o => o.id === M.order); s += o ? (o.rv ? 'their van: ' + Math.ceil(o.rv.t) + 's' : 'time: ' + Math.ceil(o.t) + 's') : ''; }
      out.unshift({ t: s, c: 'yellow' });
    }
    if (R.popup) out.push({ t: GANGS[R.popup.g].short + ' stand on Anchovy Road: half the customers (' + Math.ceil(R.popup.t) + 's)', c: '' });
    for (const o of W.orders) if (o.rv && !o.mission && o.state === 'open') out.push({ t: GANGS[o.rv.g].short + ' racing you to ' + o.name + ': ' + Math.ceil(o.rv.t) + 's', c: o.rv.t < 15 ? 'red' : '' });
    if (R.mess.length) out.push({ t: 'The kitchen is a mess (' + R.mess.length + ' spots to clean)', c: '' });
    const off = Object.keys(R.hqOff).length; if (off) out.push({ t: off + ' camera' + (off > 1 ? 's' : '') + ' offline - fix them', c: 'yellow' });
  }

  /* ---------------- every frame: what you see ---------------- */
  update(dt) {
    const g = this.g, W = this.W, R = this.R, P = g.player, T = g.town.poi;
    for (const w of [...this.waits]) { w.t -= dt; if (w.t <= 0) { this.waits.splice(this.waits.indexOf(w), 1); w.res(); } }
    if (this.cine?.tick) this.cine.tick(dt);
    this._cams(dt);
    this._actors(dt);
    this._places(dt);
    this._extras(dt);
    // health: low after being caught, comes back on its own
    if (P.hp == null) P.hp = 100;
    if (P.hp < 100) P.hp = Math.min(100, P.hp + dt * 1.1);
    this.hpEl.style.display = P.hp < 99.5 && g.phase === 'play' ? '' : 'none';
    this.hpEl.querySelector('b').style.width = P.hp + '%';
    document.body.classList.toggle('hurt', P.hp < 45 && g.phase === 'play');
    if (g.phase === 'play' && !g.frozen() && g.input.pressed('KeyK')) { if (W.owned?.up?.camera) g.monitor.open(); else g.ui.toast('No cameras yet. Buy Security Cameras on the laptop.'); }
  }
  _cams(dt) {
    const g = this.g, R = this.R, P = g.player;
    const want = new Map();
    for (const k of GANG_KEYS) { const near = Math.abs(P.pos.x - this.place(k).X) < 60 || Math.hypot(P.pos.x - this.place(k).out.x, P.pos.z - this.place(k).out.z) < 70; if (near) for (const c of this.camsOf(k)) want.set(k + ':' + c.id, { c, off: R.g[k].off[c.id] }); }
    for (const c of this.hqCams()) want.set('hq:' + c.id, { c, off: R.hqOff[c.id] });
    for (const [key, m] of this.camModels) if (!want.has(key)) { g.scene.remove(m); this.camModels.delete(key); }
    const t = performance.now() * 0.001;
    for (const [key, { c, off }] of want) {
      let m = this.camModels.get(key);
      if (!m) { m = makeSecurityCam(key.startsWith('hq') ? '#2b2b33' : '#e8e8f0'); m.position.set(c.x, c.y, c.z); m.rotation.y = c.yaw; g.scene.add(m); this.camModels.set(key, m); }
      const head = m.userData.head, led = m.userData.led;
      const dead = off && off.why !== 'block';
      head.rotation.x = dead ? 1.05 : c.pitch;
      head.rotation.z = dead ? 0.45 : 0;
      head.rotation.y = dead ? 0 : Math.sin(t * 0.4 + c.x) * 0.25;   // slowly sweeping
      led.visible = !off && Math.sin(t * 5) > -0.3;
      m.userData.tape.visible = !!off && off.why === 'block';
      if (dead && Math.random() < dt * 0.6) g.fx.sparkle(c.x, c.y - 0.1, c.z, '#9ad8ff');
    }
  }
  /** guards, the intruder, the boss and his office */
  _actors(dt) {
    const g = this.g, R = this.R, P = g.player, seen = new Set();
    const rig = (key, look, x, z, yaw, st) => {
      seen.add(key);
      let r = this.rigs.get(key);
      if (!r) { r = { rig: makeChar(look), x, z, yaw }; g.scene.add(r.rig.root); this.rigs.set(key, r); }
      if (Math.hypot(r.x - x, r.z - z) > 6) { r.x = x; r.z = z; }
      r.x = damp(r.x, x, 12, dt); r.z = damp(r.z, z, 12, dt); r.yaw = dampAngle(r.yaw, yaw, 10, dt);
      r.rig.root.position.set(r.x, st.y ?? 0.05, r.z); r.rig.root.rotation.y = r.yaw;
      r.rig.anim(dt, st);
      return r;
    };
    for (const k of GANG_KEYS) {
      const G = R.g[k], N = GANGS[k], Pl = this.place(k);
      if (Math.abs(P.pos.x - Pl.X) > 40) continue;
      G.guards.forEach((q, i) => rig('g' + k + i, { ...N.crew, skin: ['#c98a5e', '#f2c29b', '#8d5a3b'][i % 3], belly: 1 + i * 0.15 }, q.x, q.z, q.yaw, { speed: q.spd || 0, angry: q.st === 'chase', point: q.st === 'chase', panic: q.st === 'search' ? 0.2 : 0 }));
      // the office: the boss behind his desk, two bodyguards, Frank with a pizza
      const sitting = rig('b' + k, N.bossLook, Pl.boss.x, Pl.boss.z, 0, { sit: true, talk: g.ui.talking === 'boss', y: 0.18 });
      Pl.guards.forEach((p, i) => rig('bg' + k + i, { ...N.crew, glasses: 'sun', belly: 1.4, hat: 'bald', coat: '#1b1b24' }, p.x, p.z, 0, {}));
      const fr = rig('fr' + k, { ...N.crew, hat: 'cap', hatColor: '#d6232a', mustache: false, skin: '#f7d6b8' }, Pl.frank.x, Pl.frank.z, -2.5, { carry: !this.office?.dropped, talk: g.ui.talking === 'frank' });
      this._frank(k, fr, dt);
      void sitting;
    }
    // the intruder at your hideout
    if (R.raid && R.raid.st !== 'gone') {
      const r = R.raid, N = GANGS[r.g];
      const rr = rig('raid', { ...N.crew, glasses: 'sun', hat: 'beanie', hatColor: '#1b1b24', shirt: '#1b1b24', sleeve: '#1b1b24' }, r.x, r.z, r.yaw, { speed: r.st === 'act' || r.st === 'caught' ? 0 : r.st === 'flee' ? 7 : 2.4, panic: r.st === 'flee' || r.st === 'caught' ? 1 : 0, carry: r.st === 'act', y: r.st === 'in' ? -0.15 : 0.05 });
      if (r.st === 'act' && Math.random() < dt * 2) g.fx.poof(r.x + Math.sin(r.yaw) * 0.6, 1.0, r.z + Math.cos(r.yaw) * 0.6);
      void rr;
    }
    // the pop-up stand's seller, the secret cook, the takeover rival
    if (R.popup) { const s = g.town.poi.popup; rig('pop', GANGS[R.popup.g].crew, s.x + 1.3, s.z, -Math.PI / 2, { talk: true, wave: Math.sin(performance.now() * 0.002) > 0.6 }); }
    if (R.secret && Math.hypot(P.pos.x - g.town.poi.deadPizzerias[R.secret.i].x, P.pos.z - 60) < 60) { const s = g.town.poi.deadPizzerias[R.secret.i]; rig('cook', { ...GANGS[R.secret.g].crew, hat: 'chef' }, s.x, s.z + 2.4, Math.PI, { carry: true, panic: R.secret.found ? 1 : 0 }); }
    const M = R.mission;
    if (M && M.k === 'takeover') { const t = g.town.poi.takeover; rig('claim', GANGS.italian.bossLook, t.x + 1.8, t.z - 0.6, -0.6, { talk: true, point: true }); }
    for (const [key, r] of this.rigs) if (!seen.has(key)) { g.scene.remove(r.rig.root); this.rigs.delete(key); }
  }
  /** Frank and his pizza (he drops it during the meeting) */
  _frank(k, fr, dt) {
    const o = this.office || (this.office = { dropped: false });
    if (!o.box) { o.box = makeItem({ k: 'box' }); this.g.scene.add(o.box); }
    if (o.k !== k) { o.k = k; o.dropped = false; o.boxDown = false; }
    const hand = new THREE.Vector3(); fr.rig.root.updateMatrixWorld(); hand.set(0, 1.12, 0.6).applyMatrix4(fr.rig.root.matrixWorld);
    if (!o.dropped) { o.box.position.copy(hand); o.box.rotation.y = fr.rig.root.rotation.y; return; }
    o.dropT = (o.dropT || 0) + dt;
    if (!o.boxDown) {
      o.box.position.y = Math.max(0.06, hand.y - o.dropT * o.dropT * 9.8 * 0.5 * 2);
      o.box.rotation.z = o.dropT * 6;
      if (o.box.position.y <= 0.06) { o.boxDown = true; o.box.rotation.z = Math.PI; this.g.fx.splat(o.box.position.x, 0.2, o.box.position.z); this.g.audio.squish?.(o.box.position); }
    }
  }
  /** the gangs' buildings: growth, stations, trophies */
  _places(dt) {
    const g = this.g, R = this.R;
    for (const k of GANG_KEYS) {
      const G = R.g[k], Pl = this.place(k), D = Pl.dyn;
      Pl.grow.forEach((gr, i) => { gr.visible = G.lvl >= i + 2; });
      const st = G.st;
      D.shelf.rotation.x = damp(D.shelf.rotation.x, st.shelf ? 1.45 : 0, 6, dt);
      D.crates.forEach((c, i) => { c.visible = !st['crate' + i]; });
      D.trophy.visible = !st.trophy && !R.trophies.includes(k);
      D.trophy.rotation.y += dt * 0.5;
      D.special.traverse(o => { if (o.name === 'key') o.visible = !st.special; if (o.name === 'plug') o.position.y = st.special ? 0.06 : 0.28; });
      if (st.oven && Math.random() < dt * 3) g.fx.smoke(Pl.X - 11, 2.0, -8.1, 1, 0.5);
    }
  }
  /** the stand, the secret kitchen, the shipment, the race van, your trophies, the mess */
  _extras(dt) {
    const g = this.g, R = this.R, T = g.town.poi, G2 = this.groups;
    const keep = (name, want, build, place) => {
      if (want && !G2[name]) { G2[name] = build(); g.scene.add(G2[name]); }
      if (!want && G2[name]) { g.scene.remove(G2[name]); G2[name] = null; }
      if (G2[name] && place) place(G2[name]);
    };
    const pk = R.popup ? R.popup.g : null;
    keep('popup' + (pk || ''), !!pk, () => { const N = GANGS[pk], s = makeStand(N.color, N.color2 === '#1b1b24' ? '#ffffff' : N.color2, [N.short.toUpperCase(), 'PIZZA $1!!']); s.position.set(T.popup.x, 0, T.popup.z); s.rotation.y = T.popup.ry; return s; });
    for (const k of GANG_KEYS) if (k !== pk && G2['popup' + k]) { g.scene.remove(G2['popup' + k]); G2['popup' + k] = null; }
    const S = R.secret;
    keep('secret', !!S, () => {
      const d = T.deadPizzerias[S.i], grp = new THREE.Group();
      grp.add(part(geo.box(), '#5a5a6a', d.x - 1.2, 0.45, d.z + 3.6, 1.6, 0.9, 0.9));
      grp.add(part(geo.box(), '#2b2b33', d.x - 1.2, 0.95, d.z + 3.6, 1.5, 0.1, 0.8));
      grp.add(part(geo.ico(0), '#ff7a2a', d.x - 1.2, 1.1, d.z + 3.6, 0.5, 0.2, 0.5, { emissive: 0xff6a20, ei: 1.5 }));
      for (let i = 0; i < 3; i++) { const c = MAFIA.crate(GANGS[S.g].short.toUpperCase()); c.position.set(d.x + 2 + i * 0.7, 0, d.z + 3.8); grp.add(c); }
      const sg = signMesh(['DEFINITELY', 'NOT A KITCHEN'], 1.6, 0.6, { bg: '#ffffff', fg: GANGS[S.g].color }); sg.position.set(d.x, 2.2, d.z + 4.5); sg.rotation.y = Math.PI; grp.add(sg);
      return grp;
    }, (grp) => { if (Math.random() < dt * 2) { const d = T.deadPizzerias[S.i]; g.fx.smoke(d.x - 1.2, 1.3, d.z + 3.6, 1, 0.3); } });
    const M = R.mission;
    keep('ship', M && M.k === 'shipment', () => { const grp = new THREE.Group(); M.drops.forEach((d, i) => { const c = MAFIA.crate('FROZEN'); c.position.set(d.x, 0, d.z); c.rotation.y = i; c.userData.i = i; grp.add(c); }); return grp; }, (grp) => { grp.children.forEach(c => { c.visible = !M.drops[c.userData.i]?.got; c.position.y = Math.abs(Math.sin(performance.now() * 0.003 + c.userData.i)) * 0.15; }); });
    // the Delivery Boys' van in a race
    const o = M && M.order ? this.W.orders.find(o => o.id === M.order && o.rv) : null;
    keep('van', !!o, () => { const C = makeCar('smallvan'); C.group.traverse(n => { if (n.isMesh && n.material.color && n.material.color.getHexString() === '8fd0c8') n.material = n.material.clone(), n.material.color.set('#ff9f1a'); }); C.group.userData.C = C; return C.group; }, (grp) => {
      const at = g.orders.at(o), from = this.place('delivery').out;
      if (!grp.userData.path) { const a = nearestNode(from.x, from.z - 14), b = nearestNode(at.x, at.z); grp.userData.path = [{ x: from.x, z: from.z - 8 }, ...path(a, b).map(n => ({ x: n.x, z: n.z })), { x: at.x, z: at.z }]; }
      const pts = grp.userData.path, k = clamp(1 - o.rv.t / (o.rv.t0 || 60), 0, 1);
      let total = 0; const seg = []; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); seg.push(l); total += l; }
      let s = k * total, i = 0; while (i < seg.length - 1 && s > seg[i]) { s -= seg[i]; i++; }
      const a = pts[i], b = pts[i + 1] || a, t = seg[i] ? s / seg[i] : 0;
      grp.position.set(a.x + (b.x - a.x) * t, 0, a.z + (b.z - a.z) * t); grp.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    });
    // trophies in your storage room
    const tk = R.trophies.join(',');
    if (this._tk !== tk) { this._tk = tk; if (G2.trophies) g.scene.remove(G2.trophies); G2.trophies = new THREE.Group(); R.trophies.forEach((k, i) => { const t = makeTrophy(k); t.position.set(T.storageBags.x - 4 + i * 1.1, 0, T.storageBags.z + 7.5); G2.trophies.add(t); }); g.scene.add(G2.trophies); }
    // the mess they leave in your kitchen
    const mk = R.mess.map(m => m.x.toFixed(1)).join(',');
    if (this._mk !== mk) { this._mk = mk; if (G2.mess) g.scene.remove(G2.mess); G2.mess = new THREE.Group(); R.mess.forEach((m, i) => { G2.mess.add(part(geo.cyl(9), i % 2 ? '#f6f1e6' : '#d6402a', m.x, 0.1, m.z, 1.1, 0.02, 0.9)); G2.mess.add(part(geo.ico(0), '#f6f1e6', m.x + 0.3, 0.15, m.z - 0.2, 0.3, 0.15, 0.3)); }); g.scene.add(G2.mess); }
  }
}
