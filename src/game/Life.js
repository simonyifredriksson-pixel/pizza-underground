/* Life.js - moves the set pieces World.js built: construction workers
   hammering and hauling planks, the crane swinging, the mixer turning, the
   utility bucket going up and down, the man in the manhole popping up,
   vendors waving and calling out, dock workers unloading. All local
   scenery (every player sees their own), and only near the camera. */
import { pick, dampAngle } from '../core/Util.js';

export class Life {
  constructor(game) {
    this.g = game;
    this.t = 0;
  }
  update(dt) {
    const g = this.g, P = g.player, L = g.town.life;
    if (!L || !P) return;
    this.t += dt;
    for (const s of L.spin) {
      if (s.swing) s.obj.rotation[s.axis] = s.base + Math.sin(this.t * s.speed) * s.swing;
      else s.obj.rotation[s.axis] += s.speed * dt;
    }
    if (L.picker) {
      const C = L.picker.C, k = 0.5 + 0.5 * Math.sin(this.t * 0.25);
      C.boom.rotation.x = -(0.55 + 0.15 * k);
      C.boom2.rotation.x = 0.35 - 0.2 * k;
      C.bucket.rotation.x = -(C.boom.rotation.x + C.boom2.rotation.x);   // the bucket stays level
    }
    for (const a of L.actors) {
      const R = a.rig;
      const ax = a.local ? (L.picker ? L.picker.C.group.position.x : 0) : a.x, az = a.local ? (L.picker ? L.picker.C.group.position.z : 0) : a.z;
      const d = Math.hypot(P.pos.x - ax, P.pos.z - az);
      if (!a.local) R.root.visible = d < 90;
      if (d > 90) continue;
      a.t += dt;
      const st = {};
      switch (a.mode) {
        case 'hammer': st.speed = 0; break;
        case 'sit': st.sit = true; break;
        case 'point': st.point = Math.sin(a.t * 0.7) > 0; st.talk = st.point; break;
        case 'manhole': {
          // pops up for a look round, ducks back down
          const k = Math.max(0, Math.sin(a.t * 0.5));
          R.root.position.y = -1.85 + k * 1.15;
          R.root.rotation.y = a.ry + Math.sin(a.t * 0.9) * 1.2;
          break;
        }
        case 'carry': {
          const [p0, p1] = a.path, seg = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
          a.leg = a.leg ?? 0; a.u = a.u ?? 0; a.pause = a.pause ?? 0;
          if (a.pause > 0) { a.pause -= dt; st.speed = 0; }
          else {
            a.u += dt * a.speed / seg;
            if (a.u >= 1) { a.u = 0; a.leg = 1 - a.leg; a.pause = 1.2; }
            const [f, to] = a.leg ? [p1, p0] : [p0, p1];
            a.x = f[0] + (to[0] - f[0]) * a.u; a.z = f[1] + (to[1] - f[1]) * a.u;
            a.ry = dampAngle(a.ry, Math.atan2(to[0] - f[0], to[1] - f[1]), 8, dt);
            st.speed = a.speed;
          }
          const loaded = a.leg === 0;   // the outward leg carries, the way back is empty-handed
          if (a.carry) a.carry.visible = loaded;
          st.carry = loaded;
          R.root.position.set(a.x, a.y || 0.04, a.z); R.root.rotation.y = a.ry;
          break;
        }
        case 'vendor': {
          const near = d < 9;
          st.wave = near && Math.sin(a.t * 0.8) > 0.2;
          st.talk = near && (a.talkT || 0) > 0;
          if (near) R.root.rotation.y = dampAngle(R.root.rotation.y, Math.atan2(P.pos.x - a.x, P.pos.z - a.z), 3, dt);
          break;
        }
        default: break;
      }
      R.anim(dt, st);
      if (a.mode === 'hammer') { R.armR.rotation.x = -1.4 + Math.sin(a.t * 7) * 0.55; R.armR.rotation.z = -0.15; }
      if (a.y && a.mode !== 'carry' && a.mode !== 'manhole' && !a.local) R.root.position.y = a.y;
      // say something when you walk up
      a.barkT = (a.barkT ?? Math.random() * 6) - dt; a.talkT = (a.talkT || 0) - dt;
      if (d < (a.mode === 'vendor' ? 7 : 5) && a.barkT <= 0 && (a.lines || a.line)) {
        a.barkT = 22 + Math.random() * 14; a.talkT = 2.5;
        const text = a.lines ? pick(a.lines) : a.line;
        if (a.local && L.picker) { const p = L.picker.C.bucket, v = p.position.clone(); g.bubble(() => { p.getWorldPosition(v); return { x: v.x, z: v.z, y: v.y - 0.6 }; }, text); }
        else g.bubble(() => ({ x: a.x, z: a.z, y: (a.y || 0) + (a.mode === 'manhole' ? 0.4 : 0) }), text);
      }
    }
  }
}
