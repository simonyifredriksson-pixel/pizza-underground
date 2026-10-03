/* GearView.js - holding, swinging and showing off Underground Market gear.

   GearRig puts the item in a character's hand (you in third person, your
   friends) and poses the arm; GearVM is the first-person view: a hand and
   the item in the bottom-right of the screen. Both run the same little
   timeline: equip (pops up with a twirl), idle (breathing, walking bob, a
   fidget now and then), use (swing / slam / thrust / raise / jiggle /
   throw), put away (drops out of view with a spin). Everything is a bit
   too much, on purpose. */
import * as THREE from '../../lib/three.module.js';
import { makeGear, makeGroucho } from '../art/Gear.js';
import { part, geo, mat } from '../art/Mesher.js';
import { GEAR } from '../data/BlackMarket.js';
import { clamp, damp } from '../core/Util.js';

export const ANIM_T = { swing: 0.55, slam: 0.85, thrust: 0.5, raise: 0.8, jiggle: 0.7, throw: 0.55 };
const EQUIP_T = 0.38, AWAY_T = 0.3;
const SWINGY = { foambat: 1, mallet: 1 };

const ease = t => t * t * (3 - 2 * t);
const back = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
/** interpolate keyframes [[time, ...values]] at time t (smoothstep between keys) */
function kf(t, frames) {
  if (t <= frames[0][0]) return frames[0].slice(1);
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1], b = frames[i];
    if (t <= b[0]) { const k = ease((t - a[0]) / (b[0] - a[0])); return a.slice(1).map((v, j) => v + (b[j + 1] - v) * k); }
  }
  return frames[frames.length - 1].slice(1);
}

/** the light a flashlight throws: an additive cone from the lens forwards along +y */
function beam(len = 8, r = 1.4, o = 0.07) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, len, 14, 1, true), new THREE.MeshBasicMaterial({ color: '#fff2b0', transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = Math.PI; m.position.y = 0.47 + len / 2; m.castShadow = false;
  return m;
}

/** the timeline both views share */
class Timeline {
  constructor() { this.cur = null; this.want = null; this.ph = 'none'; this.t = 0; this.anim = null; this.fidT = 4; this.fid = 0; }
  set(key) { if (key !== this.want) this.want = key || null; }
  play(anim) { if (this.cur && this.ph !== 'away') { this.ph = 'use'; this.anim = anim; this.t = 0; } }
  step(dt, build, drop) {
    this.t += dt;
    if (this.want !== this.cur && this.ph !== 'away') {
      if (this.cur) { this.ph = 'away'; this.t = 0; }
      else if (this.want) { build(this.want); this.cur = this.want; this.ph = 'equip'; this.t = 0; }
    }
    if (this.ph === 'away' && this.t >= AWAY_T) { drop(); this.cur = null; this.ph = 'none'; if (this.want) { build(this.want); this.cur = this.want; this.ph = 'equip'; this.t = 0; } }
    if (this.ph === 'equip' && this.t >= EQUIP_T) { this.ph = 'idle'; this.t = 0; }
    if (this.ph === 'use' && this.t >= (ANIM_T[this.anim] || 0.5)) { this.ph = 'idle'; this.t = 0; }
    // a fidget now and then while idle
    if (this.ph === 'idle') { this.fidT -= dt; if (this.fidT <= 0) { this.fid = 0.001; this.fidT = 5 + Math.random() * 4; } }
    if (this.fid > 0) { this.fid += dt; if (this.fid > 0.7) this.fid = 0; }
  }
}

/* ---------------- third person: the item in a rig's hand ---------------- */
export class GearRig {
  constructor() {
    this.T = new Timeline();
    this.holder = new THREE.Group();
    this.model = null; this.rig = null; this.groucho = null; this.swing = 0;
  }
  set(key) { this.T.set(key); }
  play(anim) { this.T.play(anim); }
  _build(key) {
    this.model = makeGear(key);
    if (GEAR[key]?.light) this.model.add(beam(6, 1.0, 0.05));
    this.holder.add(this.model);
  }
  _drop() { if (this.model) this.holder.remove(this.model); this.model = null; }
  /** call after rig.anim(): it overrides the right arm. st: { speed, hide, incog } */
  update(dt, rig, st = {}) {
    if (this.rig !== rig) { this.rig = rig; rig.armR.add(this.holder); this.holder.position.set(0, -0.62, 0.02); this.groucho = null; }
    // the disguise kit: glasses, nose, mustache on whoever used it
    if (!!st.incog !== !!this.groucho) {
      if (st.incog) { const hs = rig.o.headSize || 1; this.groucho = makeGroucho(1.0 * hs); this.groucho.position.set(0, 0.4 * hs, 0.36 * hs); rig.head.add(this.groucho); }
      else { rig.head.remove(this.groucho); this.groucho = null; }
    }
    const T = this.T;
    T.step(dt, k => this._build(k), () => this._drop());
    const m = this.model;
    this.holder.visible = !!m && !st.hide;
    if (!m || st.hide) return;
    const g = GEAR[T.cur] || {}, swingy = SWINGY[T.cur];
    const k = Math.min(1, (st.speed || 0) / 5), ph = performance.now() * 0.001;
    // idle pose per grip: [arm x, arm z, lean]
    let idle = g.grip === 'hang' ? [-0.12, -0.12, 0] : g.grip === 'along' ? [-1.35, -0.1, 0] : g.grip === 'stick' ? [-0.6, -0.15, 0] : swingy ? [-1.2, -0.25, -0.55] : [-1.0, -0.15, 0];
    idle = [idle[0] + Math.sin(ph * 2) * 0.03 + (g.grip === 'hang' ? Math.sin(ph * 7) * 0.12 * k : Math.sin(ph * 7) * 0.08 * k), idle[1], idle[2]];
    let [ax, az, lean] = idle, scale = 1, spin = 0, wig = 0, open = 0, torso = 0;
    if (T.ph === 'equip') { const e = back(Math.min(1, T.t / EQUIP_T)); ax = 0.3 + (idle[0] - 0.3) * e; scale = Math.max(0.01, e); spin = (1 - e) * 4; }
    else if (T.ph === 'away') { const e = ease(Math.min(1, T.t / AWAY_T)); ax = idle[0] + (0.25 - idle[0]) * e; scale = Math.max(0.01, 1 - e); spin = -e * 4; }
    else if (T.ph === 'use') {
      const t = T.t;
      switch (T.anim) {
        case 'swing': [ax, az, lean, torso] = kf(t, [[0, idle[0], idle[1], idle[2], 0], [0.16, -2.9, -0.5, -1.4, 0.45], [0.28, -0.7, 0.45, 1.6, -0.55], [0.55, idle[0], idle[1], idle[2], 0]]); break;
        case 'slam': [ax, az, lean, torso] = kf(t, [[0, idle[0], idle[1], idle[2], 0], [0.35, -3.1, -0.1, -1.6, 0.2], [0.45, -0.55, -0.1, 1.5, -0.2], [0.62, -0.55, -0.1, 1.5, -0.2], [0.85, idle[0], idle[1], idle[2], 0]]); break;
        case 'thrust': [ax, az] = kf(t, [[0, idle[0], idle[1]], [0.15, -1.6, -0.05], [0.35, -1.6, -0.05], [0.5, idle[0], idle[1]]]); wig = t > 0.12 && t < 0.38 ? Math.sin(t * 60) * 0.08 : 0; open = clamp(Math.sin(t / 0.5 * Math.PI) * 1.6, 0, 1); break;
        case 'raise': [ax, az] = kf(t, [[0, idle[0], idle[1]], [0.2, -2.9, -0.2], [0.6, -2.9, -0.2], [0.8, idle[0], idle[1]]]); wig = t > 0.2 && t < 0.6 ? Math.sin(t * 26) * 0.3 : 0; break;
        case 'jiggle': [ax, az] = kf(t, [[0, idle[0], idle[1]], [0.15, -1.5, 0.1], [0.55, -1.5, 0.1], [0.7, idle[0], idle[1]]]); wig = t > 0.15 && t < 0.55 ? Math.sin(t * 45) * 0.35 : 0; break;
        case 'throw': [ax, az, lean] = kf(t, [[0, idle[0], idle[1], 0], [0.2, -2.6, -0.3, -1.0], [0.3, -0.6, 0.1, 0.6], [0.55, idle[0], idle[1], 0]]); scale = t > 0.28 ? 0.01 : 1; break;
      }
    } else if (T.fid > 0) {
      const f = T.fid / 0.7;
      if (swingy) spin = ease(f) * Math.PI * 2; else wig = Math.sin(f * Math.PI * 4) * 0.15 * (1 - f);
    }
    rig.armR.rotation.x = ax; rig.armR.rotation.z = az;
    rig.torso.rotation.y = torso;
    const H = this.holder;
    if (g.grip === 'along') H.rotation.set(Math.PI, 0, wig);
    else if (g.grip === 'hang') { this.swing = damp(this.swing, -Math.sin(ph * 7) * 0.35 * k, 6, dt); H.rotation.set(-ax + this.swing, 0, wig); }
    else H.rotation.set(-ax + lean, 0, wig);
    m.scale.setScalar(scale * (T.cur === 'cutout' ? 0.85 : 1));
    m.rotation.y = spin;
    if (m.userData.lid) m.userData.lid.rotation.x = -1.3 * open;
  }
}

/* ---------------- first person: a hand and the item, bottom right ---------------- */
const FP = {
  // hand position, item rotation, item scale
  up: { p: [0.34, -0.36, -0.62], r: [-0.1, 0.3, 0.08], s: 1 },
  swing: { p: [0.44, -0.5, -0.72], r: [0.35, 0, -0.35], s: 0.72 },
  stick: { p: [0.42, -0.95, -1.0], r: [0, 0.35, -0.06], s: 0.62 },
  hang: { p: [0.36, -0.24, -0.62], r: [0, 0.45, 0], s: 0.78 },
  along: { p: [0.3, -0.34, -0.58], r: [-Math.PI / 2 + 0.06, 0, 0], s: 1 },
};
const FP_SCALE = { mallet: 0.55, lockpick: 0.85, disguise: 0.62, docs: 1.15, decoy: 0.6, airhorn: 0.72, briefcase: 0.72, smoke: 0.72 };
// per-item nudges in first person: [x, y, z] added to the hand, and a turn so the business end faces away
const FP_NUDGE = { lockpick: [0.02, 0.14, -0.08], disguise: [0.04, -0.06, -0.05], decoy: [0.02, -0.04, -0.08] };
const FP_FLIP = { airhorn: true };

export class GearVM {
  constructor(camera, skin, sleeve) {
    this.T = new Timeline();
    this.root = new THREE.Group(); camera.add(this.root); this.root.visible = false;
    this.hand = part(geo.ico(1), skin, 0, 0, 0, 0.12, 0.13, 0.15); this.hand.castShadow = false; this.root.add(this.hand);
    this.sleeve = part(geo.box(), sleeve, 0.12, -0.22, 0.2, 0.15, 0.15, 0.5); this.sleeve.rotation.x = 0.9; this.sleeve.castShadow = false; this.root.add(this.sleeve);
    this.item = new THREE.Group(); this.root.add(this.item);
    this.model = null; this.lastYaw = null; this.sway = 0; this.bob = 0;
  }
  set(key) { this.T.set(key); }
  play(anim) { this.T.play(anim); }
  recolor(skin, sleeve) { this.hand.material = mat(skin); this.sleeve.material = mat(sleeve); }
  _build(key) {
    this.model = makeGear(key);
    if (GEAR[key]?.light) this.model.add(this.model.userData.beam = beam(9, 1.6, 0.06));
    this.model.traverse(o => { if (o.isMesh) o.castShadow = false; });
    this.item.add(this.model);
  }
  _drop() { if (this.model) this.item.remove(this.model); this.model = null; }
  /** st: { show, speed, running, camYaw } */
  update(dt, st) {
    const T = this.T;
    T.step(dt, k => this._build(k), () => this._drop());
    const m = this.model;
    this.root.visible = !!m && !!st.show;
    if (!m) return;
    const g = GEAR[T.cur] || {}, swingy = SWINGY[T.cur];
    const base = swingy ? FP.swing : FP[g.grip] || FP.up;
    const sc = base.s * (FP_SCALE[T.cur] || 1);
    // walking bob and a lazy sway when you turn
    const k = Math.min(1, (st.speed || 0) / 5) * (st.running ? 1.6 : 1);
    this.bob += dt * (6 + (st.speed || 0) * 0.9);
    if (this.lastYaw == null) this.lastYaw = st.camYaw;
    let dy = st.camYaw - this.lastYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.lastYaw = st.camYaw;
    this.sway = damp(this.sway, clamp(dy / Math.max(dt, 1e-3) * 0.04, -0.25, 0.25), 8, dt);
    const ph = performance.now() * 0.001;
    let dx = Math.sin(this.bob) * 0.025 * k, dyy = -Math.abs(Math.cos(this.bob)) * 0.03 * k + Math.sin(ph * 1.8) * 0.006, dz = 0;
    let rx = 0, ry = this.sway, rz = 0, show = 1, spin = 0, open = 0, pend = 0, flick = false;
    if (g.grip === 'hang') pend = Math.sin(this.bob) * 0.2 * k + Math.sin(ph * 1.5) * 0.03;
    if (T.ph === 'equip') { const e = back(Math.min(1, T.t / EQUIP_T)); dyy += (1 - e) * -0.6; rz += (1 - e) * 1.2; spin = (1 - e) * 3; }
    else if (T.ph === 'away') { const e = ease(Math.min(1, T.t / AWAY_T)); dyy += -0.7 * e; rz += -1.0 * e; }
    else if (T.ph === 'use') {
      const t = T.t; let o;
      switch (T.anim) {
        case 'swing': o = kf(t, [[0, 0, 0, 0, 0, 0, 0], [0.15, 0.15, 0.25, 0.1, 0.5, 0, -0.9], [0.27, -0.55, -0.15, -0.2, -0.9, 0, 1.4], [0.55, 0, 0, 0, 0, 0, 0]]); break;
        case 'slam': o = kf(t, [[0, 0, 0, 0, 0, 0, 0], [0.35, -0.1, 0.4, 0.15, 1.0, 0, 0], [0.45, -0.15, -0.25, -0.25, -1.3, 0, 0.2], [0.6, -0.15, -0.25, -0.25, -1.3, 0, 0.2], [0.85, 0, 0, 0, 0, 0, 0]]); break;
        case 'thrust': o = kf(t, [[0, 0, 0, 0, 0, 0, 0], [0.15, -0.12, 0.12, -0.25, 0, 0, 0], [0.35, -0.12, 0.12, -0.25, 0, 0, 0], [0.5, 0, 0, 0, 0, 0, 0]]); if (t > 0.15 && t < 0.35) o[0] += Math.sin(t * 70) * 0.012; open = clamp(Math.sin(t / 0.5 * Math.PI) * 1.6, 0, 1); break;
        case 'raise': o = kf(t, [[0, 0, 0, 0, 0, 0, 0], [0.2, -0.2, 0.3, -0.05, 0, 0, 0.2], [0.6, -0.2, 0.3, -0.05, 0, 0, 0.2], [0.8, 0, 0, 0, 0, 0, 0]]); if (t > 0.2 && t < 0.6) o[5] += Math.sin(t * 28) * 0.25; break;
        case 'jiggle': o = kf(t, [[0, 0, 0, 0, 0, 0, 0], [0.15, -0.15, 0.1, -0.15, 0, 0, 0], [0.55, -0.15, 0.1, -0.15, 0, 0, 0], [0.7, 0, 0, 0, 0, 0, 0]]); if (t > 0.15 && t < 0.55) o[5] += Math.sin(t * 45) * 0.3; break;
        case 'throw': o = kf(t, [[0, 0, 0, 0, 0, 0, 0], [0.2, 0.1, 0.3, 0.2, 0.8, 0, 0], [0.3, -0.1, 0, -0.5, -0.6, 0, 0], [0.55, 0, -0.1, 0, 0, 0, 0]]); show = t > 0.28 ? 0 : 1; break;
        default: o = [0, 0, 0, 0, 0, 0];
      }
      dx += o[0]; dyy += o[1]; dz += o[2]; rx += o[3]; ry += o[4]; rz += o[5];
    } else if (T.fid > 0) {
      const f = T.fid / 0.7;
      if (swingy) spin = ease(f) * Math.PI * 2;
      else if (g.light) flick = Math.sin(f * 40) < -0.3;   // the flashlight flickers; you give it a tap
      else dyy += Math.abs(Math.sin(f * Math.PI * 2)) * 0.06 * (1 - f);
    }
    const nd = FP_NUDGE[T.cur] || [0, 0, 0];
    const px = base.p[0] + nd[0], py = base.p[1] + nd[1], pz = base.p[2] + nd[2];
    if (FP_FLIP[T.cur]) ry += Math.PI;
    this.hand.position.set(px + dx, py + dyy, pz + dz);
    this.sleeve.position.set(px + dx + 0.14, py + dyy - 0.24, pz + dz + 0.22);
    this.item.position.copy(this.hand.position);
    this.item.rotation.set(base.r[0] + rx + pend, base.r[1] + ry, base.r[2] + rz);
    m.visible = show > 0;
    m.scale.setScalar(sc);
    m.rotation.y = spin;
    if (m.userData.lid) m.userData.lid.rotation.x = -1.3 * open;
    if (m.userData.beam) m.userData.beam.visible = !flick;
  }
}
