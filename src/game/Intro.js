/* Intro.js - no menu, no house: the game starts in the car.
   Scene 1: a crappy delivery car on Pepper Road, Dez riding shotgun, the
   radio on, a pizza on the dashboard. A limo. CRASH. The pizza goes
   through the windshield. Black.
   Scene 2: a hospital room. The doctor has good news and bad news. Dez is
   stuck halfway inside a wall. Then you get up and walk out into a town
   where pizza is illegal. Both scenes are local to each player. */
import * as THREE from '../../lib/three.module.js';
import { makeCar, makeItem } from '../art/Props.js';
import { makeChar } from '../art/Chars.js';
import { DEZ_LOOK } from '../data/Data.js';
import { INTRO_CAR, CRASH_T, HOSPITAL } from '../data/Story.js';
import { HOSPITAL_SET } from '../world/Town.js';
import { lookFor } from './Player.js';
import { damp, clamp } from '../core/Util.js';

const V = 8.2, X0 = 40 - V * CRASH_T, Z = -117;

export class Intro {
  constructor(game) { this.g = game; this.active = null; }

  /* ---------------- scene 1: the delivery ---------------- */
  car() {
    const g = this.g;
    if (/[?&]hosp/.test(location.search)) return Promise.resolve();
    return new Promise(res => {
      const grp = new THREE.Group(); g.scene.add(grp);
      const C = makeCar('delivery'); grp.add(C.group);
      const you = makeChar(lookFor(g.profile.look, null));
      const dez = makeChar(DEZ_LOOK);
      C.group.add(you.root, dez.root);
      const s0 = C.seats[0], s1 = C.seats[1];
      you.root.position.set(s0.x, s0.y - 0.35, s0.z); dez.root.position.set(s1.x, s1.y - 0.35, s1.z);
      you.root.scale.setScalar(0.85); dez.root.scale.setScalar(0.85);
      const extras = [];
      const friends = [...g.net.profiles.values()].slice(0, 2);
      friends.forEach((p, i) => { const r = makeChar(lookFor(p.look | 0, null)); const s = C.seats[2 + i]; r.root.position.set(s.x, s.y - 0.35, s.z); r.root.scale.setScalar(0.85); C.group.add(r.root); extras.push(r); });
      const pizza = makeItem({ k: 'box' }); pizza.position.set(s1.x, s1.y + 0.42, s1.z + 0.45); C.group.add(pizza);
      const limo = makeCar('limo'); limo.group.visible = false; grp.add(limo.group);
      let t = +(new URLSearchParams(location.search).get('introT') || 0), spin = 0, crashed = false, fly = null, done = false, last = '', launch = null;
      const car = { x: X0, z: Z, yaw: Math.PI / 2 };
      g.ui.cinema(true); g.ui.hudVisible(false);
      g.audio.musicOn = true;
      g.ui.fade(false);
      const finish = () => {
        if (done) return; done = true;
        g.scene.remove(grp); g.ui.cinema(false); g.ui.sub(null);
        this.active = null; g.cam.override = null; g.audio.engine = 0;
        res();
      };
      this.active = {
        skip: () => { g.ui.fade(true); setTimeout(finish, 400); },
        update: (dt) => {
          const slow = crashed && t < CRASH_T + 1.6 ? 0.3 : 1;
          dt *= slow;
          t += dt;
          // subtitles
          const line = INTRO_CAR.filter(l => l[0] <= t).pop();
          if (line && line !== last) { last = line; g.ui.sub(line[1], line[2]); g.audio.babble(line[1] === 'you' ? 1.3 : 1); }
          if (!crashed) {
            car.x = X0 + V * t;
            g.audio.engine = 0.45;
            if (t >= CRASH_T) {
              crashed = true; spin = 11;
              // the limo hits the side: the car goes flying, tumbling end over end
              launch = { vx: 7, vy: 13, vz: 16, y: 0.1, rx: 0, rz: 0, wx: 7.5, wz: -5, bounces: 0 };
              C.group.rotation.order = 'YXZ';
              g.audio.crash(null); g.audio.scream(null); g.audio.boom(null); g.ui.flash(); g.fx.shake = 1.4;
              g.fx.burst(car.x, 1, car.z, '#e8473a', 18, 7, 0.3); g.fx.burst(car.x, 1, car.z, '#bfe4ff', 16, 8, 0.15); g.fx.smoke(car.x, 1, car.z, 10, 0.5);
              fly = { p: new THREE.Vector3(car.x + 1.5, 1.4, Z), v: new THREE.Vector3(9, 8, 3) };
              C.group.remove(pizza); grp.add(pizza); pizza.position.copy(fly.p);
              const real = makeItem({ k: 'pizza', sauce: 1, cheese: 2, top: ['pepperoni'], cook: 1 }); real.scale.setScalar(1.6); pizza.add(real);
              you.mouthOpen = 0; dez.mouthOpen = 0;
            }
          } else {
            const L = launch;
            spin = damp(spin, 0, 0.8, dt);
            car.yaw += spin * dt;
            L.vy -= 22 * dt;
            car.x += L.vx * dt; car.z += L.vz * dt; L.y += L.vy * dt;
            L.rx += L.wx * dt; L.rz += L.wz * dt;
            if (L.y <= 0 && L.vy < 0) {
              L.y = 0; L.bounces++;
              L.vy = L.bounces < 3 ? -L.vy * 0.45 : 0; L.vx *= 0.55; L.vz *= 0.55; L.wx *= 0.5; L.wz *= 0.5; spin *= 0.5;
              if (L.bounces < 3) { g.audio.crash(null); g.fx.shake = 0.8; g.fx.smoke(car.x, 0.5, car.z, 6, 0.4); g.fx.burst(car.x, 0.5, car.z, '#2b2b38', 8, 5, 0.2); }
            }
            if (L.bounces >= 3) { L.rx = damp(L.rx, Math.round(L.rx / Math.PI) * Math.PI, 4, dt); L.rz = damp(L.rz, Math.round(L.rz / Math.PI) * Math.PI, 4, dt); }
            g.audio.engine = 0;
            if (fly) { fly.v.y -= 9 * dt; fly.p.addScaledVector(fly.v, dt); pizza.position.copy(fly.p); pizza.rotation.x += dt * 8; pizza.rotation.z += dt * 5; if (fly.p.y < 0.05) { fly.p.y = 0.05; fly.v.set(0, 0, 0); } }
            if (t > CRASH_T + 2.6 && !this._faded) { this._faded = true; g.ui.fade(true); g.ui.sub(null); }
            if (t > CRASH_T + 4.4) finish();
          }
          // the limo, doing a hundred
          if (t > CRASH_T - 3.2) {
            limo.group.visible = true;
            const lt = t - CRASH_T;
            const lz = lt < 0 ? Z + lt * 36 - 1.6 : Z - 1.6 + Math.min(lt, 0.5) * 12;
            limo.group.position.set(40, 0, lz); limo.group.rotation.y = lt > 0 ? Math.min(lt, 0.6) * 0.9 : 0;
          }
          if (launch) { C.group.position.set(car.x, launch.y + 0.9 * Math.min(1, Math.abs(Math.sin(launch.rx)) + Math.abs(Math.sin(launch.rz))), car.z); C.group.rotation.set(launch.rx, car.yaw, launch.rz); }
          else { C.group.position.set(car.x, Math.abs(Math.sin(t * 9)) * 0.03, car.z); C.group.rotation.y = car.yaw; }
          for (const w of C.wheels) w.rotation.x += V * dt * 2.5;
          const panic = t > CRASH_T - 1.6 ? 1 : 0;
          const talk = (who) => g.ui.subWho === who && !crashed;
          you.anim(dt, { sit: true, drive: true, panic, talk: talk('you') });
          dez.anim(dt, { sit: true, carry: false, panic, talk: talk('dez'), headYaw: t < CRASH_T - 2.5 && g.ui.subWho === 'dez' ? -0.5 : t > CRASH_T - 2.5 ? 0.9 : 0 });
          for (const e of extras) e.anim(dt, { sit: true, panic });
          // camera
          const cam = g.camera, w2l = (x, y, z) => new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), car.yaw).add(new THREE.Vector3(car.x, 0, car.z));
          let pos, look;
          if (crashed) { pos = new THREE.Vector3(49, 3.2, -103); look = new THREE.Vector3(car.x, 1 + (launch ? launch.y * 0.7 : 0), car.z); }
          else if (t < 6) { pos = new THREE.Vector3(car.x + 14 - t * 1.2, 2.4, Z + 9); look = new THREE.Vector3(car.x, 1.0, Z); }
          else if (t > CRASH_T - 2.8) { pos = w2l(-1.4, 1.9, -2.2); look = limo.group.visible ? limo.group.position.clone().setY(1) : new THREE.Vector3(40, 1, Z - 60); }
          else if (Math.floor((t - 6) / 5.5) % 2 === 0) { pos = w2l(0.05, 2.15, 3.6); look = w2l(0.05, 1.35, -0.2); }
          else { pos = w2l(0.25, 2.1, -2.6); look = w2l(0, 1.2, 6); }
          g.cam.override = { pos, look };
        },
      };
    });
  }

  /* ---------------- scene 2: the hospital ---------------- */
  hospital(bed = 0) {
    const g = this.g, X = HOSPITAL_SET.x, ZZ = HOSPITAL_SET.z;
    return new Promise(async res => {
      const P = g.player, T = g.town.poi;
      const b = T.beds[bed % T.beds.length];
      P.teleport(b.x + 1.4, b.z + 1.2, 0, 0);
      const grp = new THREE.Group(); g.scene.add(grp);
      const doc = makeChar({ hat: 'bald', shirt: '#ffffff', sleeve: '#ffffff', pants: '#9ad8e8', glasses: 'round', mustache: '#8a8a8a', hair: '#8a8a8a', skin: '#e0a57c', tie: '#3a7bd5' });
      const nurse = makeChar({ hat: 'nurse', shirt: '#9ad8e8', pants: '#9ad8e8', hair: '#f2c84a', hairStyle: 'bun', skin: '#f7d6b8' });
      const dez = makeChar(DEZ_LOOK);
      grp.add(doc.root, nurse.root, dez.root);
      // dez: head and shoulders inside the wall, legs out, kicking
      dez.root.position.set(X - 7.25, 1.3, ZZ + 2.5); dez.root.rotation.z = Math.PI / 2;
      // you, lying in bed
      const lying = makeChar(lookFor(g.profile.look, null));
      lying.root.position.set(b.x, 0.9, b.z + 1.0); lying.root.rotation.x = -Math.PI / 2; grp.add(lying.root);
      lying.head.visible = false; // we are looking out of this head
      const look = new THREE.Vector3(b.x, 4, b.z + 3);
      P.forceHidden = true;
      const st ={ doc: { x: X + 7.4, z: ZZ, tx: X + 7.4, tz: ZZ }, nurse: { x: X + 9, z: ZZ, tx: X + 9, tz: ZZ }, t: 0 };
      let eyes = 0;
      this.active = {
        skip: null,
        update: (dt) => {
          st.t += dt;
          for (const k of ['doc', 'nurse']) {
            const s = st[k], r = k === 'doc' ? doc : nurse;
            const dx = s.tx - s.x, dz = s.tz - s.z, d = Math.hypot(dx, dz);
            const mv = d > 0.1;
            if (mv) { s.x += dx / d * Math.min(d, 2.2 * dt); s.z += dz / d * Math.min(d, 2.2 * dt); r.root.rotation.y = Math.atan2(dx, dz); }
            else r.root.rotation.y = Math.atan2(b.x - s.x, b.z - s.z);
            r.root.position.set(s.x, 0, s.z);
            r.anim(dt, { speed: mv ? 2.2 : 0, talk: g.ui.talking === k });
          }
          dez.anim(dt, { speed: 4, talk: false });
          lying.anim(dt, { talk: g.ui.talking === 'you', panic: g.ui.talking === 'you' && /WHAT|THREE/.test(g.ui.dlg?.full || '') ? 0.8 : 0 });
          eyes = Math.min(1, eyes + dt * 0.5);
          // first person, lying in the bed: look at whoever is talking
          const who = g.ui.talking;
          const tgt = who === 'doc' ? new THREE.Vector3(st.doc.x, 2.05, st.doc.z)
            : who === 'nurse' ? new THREE.Vector3(st.nurse.x, 2.0, st.nurse.z)
              : who === 'dez' ? new THREE.Vector3(X - 7.6, 1.2, ZZ + 2.5)
                : st.t < 4 ? new THREE.Vector3(b.x, 4, b.z + 3) : new THREE.Vector3(st.doc.x, 1.9, st.doc.z);
          look.lerp(tgt, 1 - Math.exp(-3 * dt));
          const head = new THREE.Vector3(b.x, 1.4 + Math.sin(st.t * 1.3) * 0.01, b.z - 0.8);
          if (who === 'you' && /WHAT|THREE/.test(g.ui.dlg?.full || '')) head.y += 0.35; // sits bolt upright
          g.cam.override = { pos: head, look };
        },
      };
      g.ui.fade(true, 'SOME TIME LATER...', '');
      await wait(2200);
      // waking up: blink, blink
      g.ui.fade(false); await wait(700); g.ui.fade(true); await wait(500); g.ui.fade(false);
      await wait(900);
      st.doc.tx = b.x + 1.2; st.doc.tz = b.z + 1.6;
      await wait(2600);
      const lines = HOSPITAL;
      // doctor's part
      await g.ui.dialog(lines.slice(0, 5));
      st.doc.tx = X + 7.6; st.doc.tz = ZZ - 1;
      await g.ui.dialog(lines.slice(5, 9));
      st.nurse.tx = b.x + 1.6; st.nurse.tz = b.z + 1.8;
      await wait(2000);
      await g.ui.dialog(lines.slice(9, 15));
      st.nurse.tx = X + 9; st.nurse.tz = ZZ;
      await g.ui.dialog(lines.slice(15));
      // you get up
      grp.remove(lying.root);
      P.forceHidden = false;
      P.teleport(b.x + 1.4, b.z + 1.4, 0, Math.PI / 2);
      g.cam.fpPitch = 0;
      g.cam.override = null;
      g.cam.snap = true;
      this.active = { skip: null, update: (dt) => { dez.anim(dt, { speed: 4 }); } };
      this.hospitalGroup = grp;
      res();
    });
  }
  leaveHospital() {
    if (this.hospitalGroup) { this.g.scene.remove(this.hospitalGroup); this.hospitalGroup = null; }
    this.active = null;
  }
}

const wait = ms => new Promise(r => setTimeout(r, ms));
