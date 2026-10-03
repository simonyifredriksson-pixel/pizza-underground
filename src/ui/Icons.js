/* Icons.js - pictures of things, drawn by the game itself.

   Every icon in the hotbar and the inventory is the item's real 3D model,
   rendered once into a little transparent picture (and cached). The
   inventory's big preview on the right is the same trick every frame: your
   character (or a car, or a bag) on a slow turntable. No image files. */
import * as THREE from '../../lib/three.module.js';

export class IconMaker {
  constructor(renderer) {
    this.r = renderer;
    this.cache = new Map();
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#7a6a98', 2.3));
    const sun = new THREE.DirectionalLight('#ffffff', 2.6); sun.position.set(3, 5, 4); this.scene.add(sun);
    const rim = new THREE.DirectionalLight('#ffd8f0', 1.2); rim.position.set(-4, 2, -3); this.scene.add(rim);
    this.cam = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
    this.rt = this._target(128, 128);
    this.cv = document.createElement('canvas');
  }
  _target(w, h) { const t = new THREE.WebGLRenderTarget(w, h, { samples: 4 }); t.texture.colorSpace = THREE.SRGBColorSpace; return t; }

  /** aim the camera at obj: from the front-right, a little above. o.focus: 'top' frames the upper part (busts) */
  frame(obj, cam, o = {}) {
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    if (o.focus === 'top') box.min.y = box.max.y - (box.max.y - box.min.y) * 0.5;
    const s = box.getBoundingSphere(new THREE.Sphere());
    const dir = new THREE.Vector3(...(o.dir || [0.75, 0.45, 1.25])).normalize();
    const d = s.radius / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2)) * (o.zoom || 1.02);
    cam.position.copy(s.center).addScaledVector(dir, d); cam.near = d / 50; cam.far = d * 4; cam.updateProjectionMatrix();
    cam.lookAt(s.center);
  }
  /** render a scene into a target and copy it into a 2D canvas (flipped the right way up) */
  draw(scene, cam, rt, canvas) {
    const r = this.r, old = r.getRenderTarget(), oc = r.getClearColor(new THREE.Color()), oa = r.getClearAlpha(), sh = r.shadowMap.enabled;
    r.shadowMap.enabled = false;
    r.setRenderTarget(rt); r.setClearColor(0x000000, 0); r.clear(); r.render(scene, cam);
    const w = rt.width, h = rt.height, px = new Uint8Array(w * h * 4);
    r.readRenderTargetPixels(rt, 0, 0, w, h, px);
    r.setRenderTarget(old); r.setClearColor(oc, oa); r.shadowMap.enabled = sh;
    if (canvas.width !== w) canvas.width = w; if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d'), img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    ctx.putImageData(img, 0, 0);
  }
  /** a cached picture (data URL) of whatever build() makes */
  get(key, build, o) {
    if (this.cache.has(key)) return this.cache.get(key);
    let url = '';
    try {
      const obj = build();
      this.scene.add(obj);
      this.frame(obj, this.cam, o);
      this.draw(this.scene, this.cam, this.rt, this.cv);
      this.scene.remove(obj);
      url = this.cv.toDataURL('image/png');
    } catch (e) { console.warn('icon', key, e); }
    this.cache.set(key, url);
    return url;
  }
}

/** the inventory's turntable: one object at a time, rendered into a canvas every frame */
export class Preview {
  constructor(maker, canvas) {
    this.m = maker; this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#6a5a88', 2.0));
    const sun = new THREE.DirectionalLight('#ffffff', 2.4); sun.position.set(2, 5, 4); this.scene.add(sun);
    const rim = new THREE.DirectionalLight('#9ad8ff', 1.4); rim.position.set(-3, 3, -4); this.scene.add(rim);
    // a little round stage
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.08, 24), new THREE.MeshStandardMaterial({ color: '#2a2a40', roughness: 0.6 }));
    stage.position.y = -0.04; this.stage = stage; this.scene.add(stage);
    this.cam = new THREE.PerspectiveCamera(26, 0.72, 0.05, 100);
    this.rt = maker._target(360, 500);
    this.spin = new THREE.Group(); this.scene.add(this.spin);
    this.obj = null; this.key = ''; this.yaw = 0.5; this.drag = null;
    canvas.addEventListener('pointerdown', e => { this.drag = { x: e.clientX, yaw: this.yaw }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => { if (this.drag) this.yaw = this.drag.yaw + (e.clientX - this.drag.x) * 0.012; });
    canvas.addEventListener('pointerup', () => { this.drag = null; });
  }
  /** show something new: build() returns a group standing on y = 0 */
  set(key, build, o = {}) {
    if (key === this.key) return;
    this.key = key;
    if (this.obj) this.spin.remove(this.obj);
    this.obj = build(); this.o = o;
    const box = new THREE.Box3().setFromObject(this.obj), size = box.getSize(new THREE.Vector3());
    const s = (o.height || 2.2) / Math.max(size.y, size.x * 0.75, size.z * 0.75, 0.01);
    this.obj.scale.multiplyScalar(s); this.obj.position.y = -box.min.y * s;
    this.spin.add(this.obj);
    this.stage.scale.setScalar(Math.max(0.6, Math.min(2.2, Math.max(size.x, size.z) * s * 0.6)));
  }
  update(dt, tick) {
    if (!this.obj) return;
    if (!this.drag) this.yaw += dt * 0.35;
    this.spin.rotation.y = this.yaw;
    tick && tick(dt, this.obj);
    const h = 2.2 * 0.5;
    // frame it in the top two thirds: the info card sits over the bottom of the preview
    this.cam.position.set(0, h + 0.9, 8.4); this.cam.lookAt(0, h - 0.55, 0);
    this.m.draw(this.scene, this.cam, this.rt, this.canvas);
  }
}
