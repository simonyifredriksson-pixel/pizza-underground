/* Effects.js - puffs, flames, splats, sparkles and floating money.
   Particles are pooled low-poly blobs; nothing is allocated per frame. */
import * as THREE from '../../lib/three.module.js';
import { geo, mat } from '../art/Mesher.js';

const MAX = 420;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.live = [];
    this.texts = [];
    for (let i = 0; i < MAX; i++) {
      const m = new THREE.Mesh(geo.ico(0), mat('#ffffff'));
      m.visible = false; m.castShadow = false; m.matrixAutoUpdate = true;
      scene.add(m); this.pool.push(m);
    }
    this.mats = {};
    this.layer = document.getElementById('floaters');
    this.shake = 0;
  }
  _m(color, glow) {
    const k = color + (glow ? 'g' : '');
    return this.mats[k] || (this.mats[k] = glow ? new THREE.MeshBasicMaterial({ color, transparent: true }) : new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, transparent: true }));
  }
  spawn(x, y, z, o) {
    const m = this.pool.pop(); if (!m) return;
    m.visible = true; m.position.set(x, y, z);
    m.material = this._m(o.color || '#ffffff', o.glow);
    const s = o.size || 0.3; m.scale.setScalar(s);
    m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    this.live.push({ m, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, life: o.life || 1, t: 0, s, grow: o.grow ?? 1, g: o.g ?? 0, fade: o.fade ?? true, drag: o.drag ?? 0, floor: o.floor ?? -100 });
  }
  smoke(x, y, z, n = 1, dark = 0.3) {
    for (let i = 0; i < n; i++) {
      const c = new THREE.Color().setHSL(0.75, 0.05, 0.75 - dark * 0.6).getStyle();
      this.spawn(x + (Math.random() - 0.5) * 0.4, y, z + (Math.random() - 0.5) * 0.4, { color: c, size: 0.25 + Math.random() * 0.2, vy: 1.2 + Math.random(), vx: (Math.random() - 0.5) * 0.4, vz: (Math.random() - 0.5) * 0.4, life: 2.2, grow: 3.5 });
    }
  }
  flame(x, y, z, s = 1) {
    const c = ['#ffd23f', '#ff9f1a', '#ff5a1a', '#ff3a1a'][Math.floor(Math.random() * 4)];
    this.spawn(x + (Math.random() - 0.5) * 0.7 * s, y, z + (Math.random() - 0.5) * 0.7 * s, { color: c, glow: true, size: (0.25 + Math.random() * 0.25) * s, vy: 2 + Math.random() * 1.5, life: 0.6, grow: 0.2 });
  }
  burst(x, y, z, color, n = 12, speed = 4, size = 0.18) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, u = Math.random();
      this.spawn(x, y, z, { color, size: size * (0.6 + Math.random() * 0.8), vx: Math.cos(a) * speed * u, vz: Math.sin(a) * speed * u, vy: 2 + Math.random() * speed, g: -14, life: 1.0 + Math.random() * 0.6, grow: 1, fade: true, floor: y - 3 });
    }
  }
  cheeseExplosion(x, y, z) { this.burst(x, y, z, '#ffd447', 40, 7, 0.3); this.burst(x, y, z, '#ffe98a', 20, 5, 0.22); this.smoke(x, y, z, 8, 0.1); this.shake = 0.6; }
  splat(x, y, z) { this.burst(x, y, z, '#d6402a', 10, 3, 0.16); this.burst(x, y, z, '#ffd447', 10, 3, 0.16); this.burst(x, y, z, '#d9a05a', 6, 3, 0.2); }
  spray(x, y, z, dx, dz) {
    for (let i = 0; i < 3; i++) this.spawn(x, y, z, { color: '#f4f8ff', size: 0.15, vx: dx * (7 + Math.random() * 3) + (Math.random() - 0.5) * 1.6, vz: dz * (7 + Math.random() * 3) + (Math.random() - 0.5) * 1.6, vy: (Math.random() - 0.3) * 1.5, life: 0.55, grow: 5, drag: 2.2 });
  }
  sparkle(x, y, z, color = '#ffd23f') { for (let i = 0; i < 8; i++) this.spawn(x, y, z, { color, glow: true, size: 0.12, vx: (Math.random() - 0.5) * 3, vy: Math.random() * 3, vz: (Math.random() - 0.5) * 3, life: 0.8, grow: 0.3 }); }
  poof(x, y, z) { for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28; this.spawn(x, y, z, { color: '#e8e0f0', size: 0.4, vx: Math.cos(a) * 3, vz: Math.sin(a) * 3, vy: 0.6, life: 0.7, grow: 2.2, drag: 3 }); } }
  foam(x, y, z) { for (let i = 0; i < 16; i++) this.spawn(x, y, z, { color: '#e8f8ff', size: 0.25, vx: (Math.random() - 0.5) * 2, vy: Math.random() * 2, vz: (Math.random() - 0.5) * 2, life: 1.6, grow: 2 }); }

  /** floating text in the world (money, "+1 clue", "BUSTED") */
  text(str, pos, color = '#43e07a', big = false) {
    if (!this.layer) return;
    const el = document.createElement('div');
    el.className = 'floater' + (big ? ' big' : ''); el.textContent = str; el.style.color = color;
    this.layer.appendChild(el);
    this.texts.push({ el, p: pos.clone ? pos.clone() : new THREE.Vector3(pos.x, pos.y, pos.z), t: 0 });
  }

  update(dt, camera) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.t += dt;
      const k = p.t / p.life;
      if (k >= 1) { p.m.visible = false; this.pool.push(p.m); this.live.splice(i, 1); continue; }
      if (p.drag) { const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; p.vz *= d; }
      p.vy += p.g * dt;
      p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
      if (p.m.position.y < p.floor) { p.m.position.y = p.floor; p.vy = 0; p.vx *= 0.5; p.vz *= 0.5; }
      p.m.scale.setScalar(p.s * (1 + (p.grow - 1) * k));
      p.m.rotation.x += dt * 2;
      if (p.fade) p.m.material.opacity = 1; // shared materials: fade by shrinking instead
      if (p.fade && k > 0.6) p.m.scale.multiplyScalar(1 - (k - 0.6) / 0.4);
    }
    const W = innerWidth, H = innerHeight, v = new THREE.Vector3();
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.t += dt; t.p.y += dt * 0.9;
      if (t.t > 1.8) { t.el.remove(); this.texts.splice(i, 1); continue; }
      v.copy(t.p).project(camera);
      if (v.z > 1) { t.el.style.display = 'none'; continue; }
      t.el.style.display = '';
      t.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * W}px, ${(-v.y * 0.5 + 0.5) * H}px) translate(-50%, -50%)`;
      t.el.style.opacity = String(Math.min(1, (1.8 - t.t) * 2));
    }
    this.shake = Math.max(0, this.shake - dt * 1.5);
  }
}
