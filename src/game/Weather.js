/* Weather.js - storms. Rain streaks fall round the camera, the sky goes
   grey-violet, lightning flashes now and then. The rules live elsewhere
   (cars slide, cops see less, customers tip more): this is the look. */
import * as THREE from '../../lib/three.module.js';

const N = 900;

export class Weather {
  constructor(game) {
    this.g = game; this.k = 0; this.thunderT = 6;
    const geo = new THREE.BoxGeometry(0.03, 0.9, 0.03);
    this.rain = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#c8d8f0', transparent: true, opacity: 0.55, fog: false }), N);
    this.rain.frustumCulled = false; this.rain.visible = false;
    this.drops = Array.from({ length: N }, () => ({ x: (Math.random() - 0.5) * 60, y: Math.random() * 30, z: (Math.random() - 0.5) * 60, v: 24 + Math.random() * 10 }));
    game.scene.add(this.rain);
    this.m = new THREE.Matrix4();
    this.base = null;
  }
  update(dt) {
    const g = this.g, on = g.W.weather?.k === 'storm' && g.phase === 'play' && !g.cam.override;
    this.k += ((on ? 1 : 0) - this.k) * Math.min(1, dt * 0.6);
    const L = g.lights, S = g.scene;
    if (!this.base && L) this.base = { fogNear: S.fog.near, fogFar: S.fog.far, bg: S.background.clone(), fog: S.fog.color.clone() };
    if (!this.base) return;
    const grey = new THREE.Color('#6a6488');
    S.fog.color.copy(this.base.fog).lerp(grey, this.k * 0.8);
    S.background.copy(this.base.bg).lerp(grey, this.k * 0.8);
    S.fog.near = this.base.fogNear * (1 - this.k * 0.6); S.fog.far = this.base.fogFar * (1 - this.k * 0.5);
    this.dim = 1 - this.k * 0.45;
    if (g.sky) g.sky.visible = this.k < 0.6;
    this.rain.visible = this.k > 0.05 && g.camera.position.x < 500;   // no rain in the cellars and sets far east
    if (this.rain.visible) {
      const c = g.camera.position;
      for (let i = 0; i < N; i++) {
        const d = this.drops[i];
        d.y -= d.v * dt;
        if (d.y < 0) { d.y = 25 + Math.random() * 5; d.x = (Math.random() - 0.5) * 60; d.z = (Math.random() - 0.5) * 60; }
        this.m.makeTranslation(c.x + d.x, d.y, c.z + d.z);
        this.rain.setMatrixAt(i, this.m);
      }
      this.rain.instanceMatrix.needsUpdate = true;
      this.rain.material.opacity = 0.55 * this.k;
      g.audio.rainLevel = this.k;
      this.thunderT -= dt;
      if (this.thunderT <= 0 && this.k > 0.7) { this.thunderT = 7 + Math.random() * 12; g.ui.flash(); setTimeout(() => g.audio.boom(null), 500 + Math.random() * 900); }
    } else g.audio.rainLevel = 0;
  }
}
