/* Player.js - you (third person) and your friends (remote rigs).
   The carried stack is drawn in front of the chest: one dough ball, or a
   pizza, or a tower of boxes that wobbles more the taller it gets. */
import * as THREE from '../../lib/three.module.js';
import { makeChar } from '../art/Chars.js';
import { makeItem } from '../art/Props.js';
import { LOOKS, kgOf } from '../data/Data.js';
import { clamp, damp, dampAngle, wrapAngle } from '../core/Util.js';
import { HQ } from '../world/Town.js';
import { textTexture, part, geo } from '../art/Mesher.js';
import { GearRig, GearVM } from './GearView.js';

export const WALK = 5.6, RUN = 9.4;

export function lookFor(look, wear) {
  const o = { ...LOOKS[look % 4] };
  if (wear === 'mustache') { o.mustache = '#2a1a14'; o.nose = 1.25; }
  if (wear === 'coat') { o.coat = '#8a6a4a'; o.hat = 'fedora'; o.glasses = 'sun'; o.mustache = '#2a1a14'; }
  if (wear === 'suit') { o.coat = '#1b1b24'; o.hat = 'fedora'; o.hatColor = '#1b1b24'; o.glasses = 'sun'; o.tie = '#d6232a'; }
  if (wear === 'cop') { o.hat = 'cop'; o.shirt = '#2a3a7a'; o.pants = '#1e2a5a'; o.badge = true; o.mustache = '#2a1a14'; }
  return o;
}

/** draw a stack of held items into a group */
export function buildStack(group, items, sq) {
  while (group.children.length) group.remove(group.children[0]);
  let y = 0;
  for (const it of items || []) {
    const m = makeItem(sq && it.k !== 'box' ? { ...it, square: true } : it);
    m.position.y = y;
    if (it.k === 'ext') { m.position.set(0.25, -0.5, -0.1); m.rotation.x = 0.8; }
    if (it.k === 'bag') {
      // a trash bag hangs from the knot, which is where both hands are: swing it from there
      const pivot = new THREE.Group(); pivot.position.y = y + 0.17;
      m.scale.setScalar(0.9); m.position.y = -1.125; pivot.add(m);
      pivot.userData.wiggle = m; group.add(pivot); y += 0.3; continue;
    }
    group.add(m);
    if (it.k === 'equip' || it.k === 'furn') { const s = 0.62 / Math.max(1, (it.size || [1])[0]); m.scale.setScalar(Math.min(0.75, s + 0.25)); m.position.y = y - 0.35; }   // a big box, hugged
    y += it.k === 'box' ? 0.14 : it.k === 'trash' ? 0.6 : it.k === 'equip' || it.k === 'furn' ? 1.0 : 0.16;
  }
}
/** the trash bag sways as you walk, and kicks now and then: somebody is in there */
function wiggle(group, speed, t) {
  for (const p of group.children) {
    const m = p.userData.wiggle; if (!m) continue;
    const kick = Math.max(0, Math.sin(t * 1.7) - 0.8) * 5;   // a kick every few seconds
    p.rotation.z = Math.sin(t * 5.3) * 0.04 + Math.sin(t * 23) * 0.05 * kick;
    p.rotation.x = Math.sin(t * 7) * 0.06 * Math.min(1, speed / 5) + Math.sin(t * 3.1) * 0.02;
    const b = m.userData.body; if (b) { b.scale.set(1.0 + Math.sin(t * 17) * 0.03 * kick, 1.1 * (1 + Math.sin(t * 2.3) * 0.02 - kick * 0.03), 0.88); }
    const n = m.userData.neck; if (n) n.rotation.z = Math.sin(t * 4) * 0.08;
  }
}

export class Player {
  constructor(game, look) {
    this.g = game;
    this.look = look; this.wear = null;
    this.pos = new THREE.Vector3(0, 0, 0);
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.camYaw = 0; this.camPitch = 0.38; this.camDist = 6.5;
    this.floor = 0; this.onGround = true;
    this.stun = 0; this.flying = false; this.hidden = null; this.car = null; this.seat = 0;
    this.speed = 0; this.running = false; this.spraying = false;
    this.stack = new THREE.Group();
    this.stackKey = '';
    // first person: what you carry, held out in front of the camera
    this.vm = new THREE.Group(); this.vmStack = new THREE.Group(); this.vm.add(this.vmStack);
    this.vmHands = [];
    for (const s of [-1, 1]) { const h = part(geo.ico(0), LOOKS[look % 4].skin, s * 0.36, 0.02, 0.05, 0.16, 0.16, 0.18); h.castShadow = false; this.vm.add(h); this.vmHands.push(h); }
    this.vm.position.set(0, -0.5, -0.95); this.vm.visible = false;
    game.camera.add(this.vm);
    // Underground Market gear: in your hand (third person) and in front of the camera (first person)
    this.gear = new GearRig();
    this.gearVM = new GearVM(game.camera, LOOKS[look % 4].skin, LOOKS[look % 4].shirt);
    this._mk();
  }
  _mk() {
    if (this.rig) this.g.scene.remove(this.rig.root);
    this.rig = makeChar(lookFor(this.look, this.wear));
    this.rig.root.add(this.stack);
    this.stack.position.set(0, 1.08, 0.58);
    this.g.scene.add(this.rig.root);
  }
  setWear(w) { if (w !== this.wear) { this.wear = w; this._mk(); } }
  teleport(x, z, floor = 0, yaw) {
    this.pos.set(x, floor === 1 ? HQ.base.y : 0, z); this.vel.set(0, 0, 0); this.floor = floor;
    if (yaw != null) { this.yaw = yaw; this.camYaw = yaw + Math.PI; }
  }
  groundY() { return this.floor === 1 ? HQ.base.y + 0.05 : 0.04; }
  get held() { return this.g.hold(this.g.me); }

  fling(dx, dz, power = 1) {
    if (this.car || this.hidden) return;
    this.vel.set(dx * 11 * power, 9 * power, dz * 11 * power);
    this.flying = true; this.onGround = false;
  }

  update(dt, frozen) {
    const I = this.g.input;
    const ground = this.groundY();
    // the stack of things you are holding
    const items = this.held;
    const key = JSON.stringify(items) + (this.g.W.law?.k === 'square');
    if (key !== this.stackKey) {
      this.stackKey = key; buildStack(this.stack, items, this.g.W.law?.k === 'square');
      buildStack(this.vmStack, items, this.g.W.law?.k === 'square');
      this.vmStack.traverse(o => { if (o.isMesh) o.castShadow = false; });
    }
    const n = items.length;
    this.stack.rotation.z = n > 4 ? Math.sin(performance.now() * 0.004) * 0.012 * n * (this.running ? 2 : 1) : 0;
    this.stack.rotation.x = n > 4 ? Math.sin(performance.now() * 0.003 + 1) * 0.008 * n : 0;
    const fp = this.g.cam.mode === 'first' && !this.g.cam.override;
    this.rig.root.visible = !this.hidden && !this.forceHidden && !this.tooClose && !fp;
    const tnow = performance.now() * 0.001;
    wiggle(this.stack, this.speed, tnow); wiggle(this.vmStack, this.speed, tnow);
    // the first-person hands: sway with walking, wobble with a tall stack
    this.vm.visible = fp && n > 0 && !this.car && !this.hidden;
    if (this.vm.visible) {
      const t = tnow, w = Math.min(1, this.speed / 6);
      const ext = items[n - 1].k === 'ext', bag = items[n - 1].k === 'bag', big = items.some(i => i.k === 'equip' || i.k === 'furn');
      // a big crate is hugged low: you peer over the top of it
      this.vm.position.set(ext ? 0.32 : Math.sin(t * 6) * 0.015 * w, (ext ? -0.45 : bag ? -0.36 : big ? -0.98 : -0.55) + Math.abs(Math.cos(t * 6)) * 0.02 * w, ext ? -0.6 : bag ? -1.25 : big ? -1.05 : -0.95);
      this.vmStack.rotation.z = this.stack.rotation.z; this.vmStack.rotation.x = this.stack.rotation.x;
      this.vmStack.rotation.y = ext ? Math.PI : 0;
      for (const [i, h] of this.vmHands.entries()) {
        h.visible = !ext;
        if (bag) h.position.set((i ? 1 : -1) * 0.09, 0.2 + this.vmStack.children[this.vmStack.children.length - 1].position.y - 0.17, 0.02); // both fists round the knot
        else h.position.set((i ? 1 : -1) * 0.36, 0.02, 0.05);
      }
    }
    // gear: what you have equipped (put away while your hands are full)
    const eq = this.g.W.eq?.[this.g.me] || null, incog = this.g.W.incog?.[this.g.me] > 0;
    this.gear.set(eq); this.gearVM.set(eq);
    this.gearVM.update(dt, { show: fp && n === 0 && !this.car && !this.hidden, speed: this.speed, running: this.running, camYaw: this.camYaw });

    if (this.car) { this.speed = 0; this.gear.update(dt, this.rig, { hide: true, incog }); return; } // the vehicle moves us
    this.rig.root.scale.setScalar(1);
    if (this.hidden) { this.speed = 0; this.rig.root.position.copy(this.pos); this.gear.update(dt, this.rig, { hide: true, incog }); return; }

    let mx = 0, mz = 0;
    if (!frozen && this.stun <= 0 && !this.flying) {
      mx = I.axis('KeyA', 'KeyD'); mz = I.axis('KeyS', 'KeyW');
    }
    const len = Math.hypot(mx, mz);
    this.running = !frozen && len > 0 && I.held('ShiftLeft') && this.stun <= 0;
    // heavy things slow you down: a 70 KG oven is a slow walk
    const kg = items.reduce((s, it) => s + kgOf(it), 0);
    const slow = Math.max(0.4, Math.min(1 - 0.03 * Math.max(0, n - 1), kg > 20 ? 1 - (kg - 20) / 160 : 1));
    let target = (this.running ? RUN : WALK) * slow;
    if (this.g.natural) target *= 0.55;
    if (this.boost > 0) { this.boost -= dt; target *= 1.4; }
    if ((this.hp ?? 100) < 60) target *= 0.72;   // still seeing stars after the rivals' back room
    if (this.flying) {
      this.vel.y -= 24 * dt;
    } else if (len > 0) {
      // move relative to the camera
      const a = this.camYaw + Math.PI;
      const fx = Math.sin(a), fz = Math.cos(a);
      const rx = Math.cos(a), rz = -Math.sin(a);
      const dx = (fx * mz + rx * -mx) / len, dz = (fz * mz + rz * -mx) / len;
      this.vel.x = damp(this.vel.x, dx * target, 12, dt);
      this.vel.z = damp(this.vel.z, dz * target, 12, dt);
      if (this.g.cam.mode !== 'first') this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 12, dt);
    } else {
      this.vel.x = damp(this.vel.x, 0, 14, dt); this.vel.z = damp(this.vel.z, 0, 14, dt);
    }
    if (!this.flying) {
      if (!frozen && this.onGround && I.pressed('Space') && this.stun <= 0) { this.vel.y = 6.5; this.onGround = false; }
      this.vel.y -= 20 * dt;
    }
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; this.pos.y += this.vel.y * dt;
    if (this.pos.y <= ground) {
      this.pos.y = ground; this.vel.y = 0;
      if (this.flying) { this.flying = false; this.stun = 1.0; this.g.audio.thud(this.pos); this.g.fx.poof(this.pos.x, ground + 0.2, this.pos.z); }
      this.onGround = true;
    }
    const r = this.g.town.col.resolve(this.pos.x, this.pos.z, 0.38, this.floor, this.pos.y - ground);
    if (r.hit && this.flying) { this.vel.x *= -0.4; this.vel.z *= -0.4; }
    this.pos.x = r.x; this.pos.z = r.z;
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    this.stun = Math.max(0, this.stun - dt);
    // first person: you face where you look (so the others see you turn, and E works on what you look at)
    if (this.g.cam.mode === 'first') this.yaw = this.camYaw + Math.PI;

    const R = this.rig;
    R.root.position.copy(this.pos);
    R.root.rotation.y = this.yaw;
    if (this.flying) { R.root.rotation.x += dt * 9; } else R.root.rotation.x = 0;
    R.anim(dt, { speed: this.speed, carry: n > 0 && items[n - 1].k !== 'ext', spray: this.spraying, panic: this.flying || this.stun > 0 || (this.running && n > 2 && this.g.chased) ? 1 : 0, talk: this.g.ui.talking === 'you', wave: this.g.natural && n === 0 });
    this.gear.update(dt, R, { speed: this.speed, hide: n > 0 || this.flying, incog });
  }
}

/* ---------------- a friend over the network ---------------- */
export class Remote {
  constructor(game, id, prof) {
    this.g = game; this.id = id; this.name = prof.name; this.look = prof.look | 0; this.wear = null;
    this.pos = new THREE.Vector3(); this.target = new THREE.Vector3(); this.yaw = 0; this.tyaw = 0;
    this.s = null; this.floor = 0; this.car = null;
    this.stack = new THREE.Group(); this.stackKey = '';
    this.gear = new GearRig();
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture([this.name], { w: 256, h: 64, bg: 'rgba(42,22,64,0.75)', fg: '#ffffff', border: false }), depthTest: false }));
    this.tag.scale.set(1.6, 0.4, 1);
    this._mk();
    this.seen = false;
  }
  _mk() {
    if (this.rig) this.g.scene.remove(this.rig.root);
    this.rig = makeChar(lookFor(this.look, this.wear));
    this.rig.root.add(this.stack); this.stack.position.set(0, 1.08, 0.58);
    this.rig.root.add(this.tag); this.tag.position.set(0, 2.75, 0);
    this.g.scene.add(this.rig.root);
  }
  apply(s) {
    this.s = s; this.target.set(s.x, s.y, s.z); this.tyaw = s.yaw; this.floor = s.f | 0; this.car = s.car || null;
    if (!this.seen) { this.pos.copy(this.target); this.yaw = s.yaw; this.seen = true; }
    if ((s.w || null) !== this.wear) { this.wear = s.w || null; this._mk(); }
  }
  update(dt) {
    if (!this.s) { this.rig.root.visible = false; return; }
    const items = this.g.hold(this.id);
    const key = JSON.stringify(items) + (this.g.W.law?.k === 'square');
    if (key !== this.stackKey) { this.stackKey = key; buildStack(this.stack, items, this.g.W.law?.k === 'square'); }
    if (this.target.distanceTo(this.pos) > 8) this.pos.copy(this.target);
    this.pos.lerp(this.target, 1 - Math.exp(-12 * dt));
    this.yaw = dampAngle(this.yaw, this.tyaw, 12, dt);
    const R = this.rig;
    R.root.visible = !this.s.h;
    R.root.position.copy(this.pos); R.root.rotation.y = this.yaw;
    R.root.scale.setScalar(this.s.car ? 0.85 : 1);
    R.root.rotation.x = this.s.fl ? R.root.rotation.x + dt * 9 : 0;
    R.anim(dt, { speed: this.s.sp || 0, carry: items.length > 0 && items[items.length - 1].k !== 'ext', spray: !!this.s.sy, panic: this.s.p ? 1 : 0, sit: !!this.s.car, drive: this.s.car && this.s.car.seat === 0, talk: !!this.s.t, wave: !!this.s.nat });
    wiggle(this.stack, this.s.sp || 0, performance.now() * 0.001);
    this.gear.set(this.g.W.eq?.[this.id] || null);
    this.gear.update(dt, R, { speed: this.s.sp || 0, hide: items.length > 0 || !!this.s.car || !!this.s.h, incog: this.g.W.incog?.[this.id] > 0 });
  }
  dispose() { this.g.scene.remove(this.rig.root); }
}
