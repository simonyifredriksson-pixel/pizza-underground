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
      let t = +(new URLSearchParams(location.search).get('introT') || 0), spin = 0, crashed = false, fly = null, done = false, last = '';
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
              g.audio.crash(null); g.audio.scream(null); g.ui.flash(); g.fx.shake = 1;
              fly = { p: new THREE.Vector3(car.x + 1.5, 1.4, Z), v: new THREE.Vector3(9, 8, 3) };
              C.group.remove(pizza); grp.add(pizza); pizza.position.copy(fly.p);
              const real = makeItem({ k: 'pizza', sauce: 1, cheese: 2, top: ['pepperoni'], cook: 1 }); real.scale.setScalar(1.6); pizza.add(real);
              you.mouthOpen = 0; dez.mouthOpen = 0;
            }
          } else {
            spin = damp(spin, 0, 1.4, dt);
            car.yaw += spin * dt;
            car.x += 5 * dt * Math.max(0, spin / 11); car.z += 7 * dt * Math.max(0, spin / 11);
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
          C.group.position.set(car.x, Math.abs(Math.sin(t * 9)) * 0.03, car.z); C.group.rotation.y = car.yaw;
          for (const w of C.wheels) w.rotation.x += V * dt * 2.5;
          const panic = t > CRASH_T - 1.6 ? 1 : 0;
          const talk = (who) => g.ui.subWho === who && !crashed;
          you.anim(dt, { sit: true, drive: true, panic, talk: talk('you') });
          dez.anim(dt, { sit: true, carry: false, panic, talk: talk('dez'), headYaw: t < CRASH_T - 2.5 && g.ui.subWho === 'dez' ? -0.5 : t > CRASH_T - 2.5 ? 0.9 : 0 });
          for (const e of extras) e.anim(dt, { sit: true, panic });
          // camera
          const cam = g.camera, w2l = (x, y, z) => new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), car.yaw).add(new THREE.Vector3(car.x, 0, car.z));
          let pos, look;
          if (crashed) { pos = new THREE.Vector3(28, 4, -104); look = new THREE.Vector3(car.x + 2, 1, car.z); }
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
          g.cam.override = { pos: new THREE.Vector3(b.x + 4.2, 2.7, b.z + 5.6), look: new THREE.Vector3(b.x - 0.6, 0.9, b.z + 0.6) };
        },
      };
      g.ui.fade(true, 'SOME TIME LATER...', '');
      await wait(2200);
      g.ui.fade(false);
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
