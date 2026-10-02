/* Mesher.js - the low-poly look.
   Everything static is built by pouring primitives into a Mesher, which
   flattens them into one non-indexed, vertex-coloured mesh. Each triangle
   gets its own slightly shifted shade, which is what gives the faceted,
   hand-painted look, and a whole town block costs one draw call. */
import * as THREE from '../../lib/three.module.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _v = new THREE.Vector3(), _c = new THREE.Color();

export function mat4(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
  _e.set(rx, ry, rz); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz);
  return _m.clone().compose(_p, _q, _s);
}

// shared unit primitives (cached; never disposed)
const G = {};
export const geo = {
  box: () => G.box || (G.box = new THREE.BoxGeometry(1, 1, 1)),
  cyl: (n = 8) => G['c' + n] || (G['c' + n] = new THREE.CylinderGeometry(0.5, 0.5, 1, n)),
  cone: (n = 6) => G['k' + n] || (G['k' + n] = new THREE.ConeGeometry(0.5, 1, n)),
  ico: (d = 0) => G['i' + d] || (G['i' + d] = new THREE.IcosahedronGeometry(0.5, d)),
  dode: () => G.dode || (G.dode = new THREE.DodecahedronGeometry(0.5, 0)),
  sph: (w = 8, h = 6) => G['s' + w + h] || (G['s' + w + h] = new THREE.SphereGeometry(0.5, w, h)),
  frust: (top, n = 8) => G['f' + top + n] || (G['f' + top + n] = new THREE.CylinderGeometry(0.5 * top, 0.5, 1, n)),
  tor: (n = 8) => G['t' + n] || (G['t' + n] = new THREE.TorusGeometry(0.5, 0.12, 5, n)),
};

export class Mesher {
  constructor(jitter = 0.07) { this.p = []; this.c = []; this.jit = jitter; }

  add(g, m, color, jit = this.jit) {
    const pos = g.attributes.position, idx = g.index;
    const n = idx ? idx.count : pos.count;
    _c.set(color);
    for (let i = 0; i < n; i += 3) {
      const k = 1 + (Math.random() - 0.5) * 2 * jit;
      for (let j = 0; j < 3; j++) {
        const vi = idx ? idx.getX(i + j) : i + j;
        _v.fromBufferAttribute(pos, vi).applyMatrix4(m);
        this.p.push(_v.x, _v.y, _v.z);
        this.c.push(_c.r * k, _c.g * k, _c.b * k);
      }
    }
    return this;
  }
  /** one triangle with its own colour */
  tri(ax, ay, az, bx, by, bz, cx, cy, cz, color, jit = this.jit) {
    _c.set(color); const k = 1 + (Math.random() - 0.5) * 2 * jit;
    this.p.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    for (let j = 0; j < 3; j++) this.c.push(_c.r * k, _c.g * k, _c.b * k);
    return this;
  }
  /** a flat horizontal quad split into faceted triangles (x0<x1, z0<z1) */
  flat(x0, z0, x1, z1, y, color, cell = 4, jit = this.jit, bump = 0) {
    const nx = Math.max(1, Math.round((x1 - x0) / cell)), nz = Math.max(1, Math.round((z1 - z0) / cell));
    const h = (i, j) => bump ? (Math.sin(i * 12.9898 + j * 78.233) * 43758.5453 % 1) * bump : 0;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const ax = x0 + (x1 - x0) * i / nx, bx = x0 + (x1 - x0) * (i + 1) / nx;
      const az = z0 + (z1 - z0) * j / nz, bz = z0 + (z1 - z0) * (j + 1) / nz;
      const y00 = y + h(i, j), y10 = y + h(i + 1, j), y01 = y + h(i, j + 1), y11 = y + h(i + 1, j + 1);
      this.tri(ax, y00, az, ax, y01, bz, bx, y10, az, color, jit);
      this.tri(bx, y10, az, ax, y01, bz, bx, y11, bz, color, jit);
    }
    return this;
  }
  /** box by centre-bottom: x,z centre, y = bottom */
  box(x, y, z, w, h, d, color, ry = 0, jit) { return this.add(geo.box(), mat4(x, y + h / 2, z, ry, w, h, d), color, jit); }
  boxc(x, y, z, w, h, d, color, ry = 0, rx = 0, rz = 0, jit) { return this.add(geo.box(), mat4(x, y, z, ry, w, h, d, rx, rz), color, jit); }
  cyl(x, y, z, r, h, color, n = 8, ry = 0, jit) { return this.add(geo.cyl(n), mat4(x, y + h / 2, z, ry, r * 2, h, r * 2), color, jit); }
  cone(x, y, z, r, h, color, n = 6, ry = 0, jit) { return this.add(geo.cone(n), mat4(x, y + h / 2, z, ry, r * 2, h, r * 2), color, jit); }
  ico(x, y, z, sx, sy, sz, color, d = 0, ry = 0, jit) { return this.add(geo.ico(d), mat4(x, y, z, ry, sx, sy, sz), color, jit); }
  /** gabled roof over a w x d footprint, ridge along x */
  roof(x, y, z, w, d, h, color, ry = 0) {
    const g = G.roof || (G.roof = (() => {
      const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.lineTo(-0.5, 0);
      const e = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); e.translate(0, 0, -0.5); e.rotateY(Math.PI / 2); return e;
    })());
    return this.add(g, mat4(x, y, z, ry, d, h, w), color);
  }

  build(opts = {}) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, opts.material || vcMat());
    mesh.castShadow = opts.cast !== false; mesh.receiveShadow = opts.receive !== false;
    mesh.matrixAutoUpdate = !!opts.dynamic;
    if (!opts.dynamic) mesh.updateMatrix();
    return mesh;
  }
}

let _vc = null, _vcGlow = null;
export function vcMat() { return _vc || (_vc = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.82, metalness: 0 })); }
export function vcGlowMat() { return _vcGlow || (_vcGlow = new THREE.MeshBasicMaterial({ vertexColors: true })); }

/* ---------------- flat-shaded materials by colour ---------------- */
const MATS = new Map();
export function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  let m = MATS.get(key);
  if (!m) {
    m = o.basic ? new THREE.MeshBasicMaterial({ color, transparent: !!o.opacity, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide })
      : new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: o.rough ?? 0.75, metalness: o.metal ?? 0, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1, transparent: !!o.opacity, opacity: o.opacity ?? 1 });
    MATS.set(key, m);
  }
  return m;
}
export function part(g, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, o) {
  const m = new THREE.Mesh(g, color instanceof THREE.Material ? color : mat(color, o));
  m.position.set(x, y, z); m.scale.set(sx, sy, sz);
  m.castShadow = true;
  return m;
}

/* ---------------- text on canvas: signs, posters, labels ---------------- */
const TEX = new Map();
export function textTexture(lines, o = {}) {
  const key = JSON.stringify([lines, o]);
  if (TEX.has(key)) return TEX.get(key);
  const W = o.w || 512, H = o.h || 256;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = o.bg || '#fff6e0'; g.fillRect(0, 0, W, H);
  if (o.stripe) { g.fillStyle = o.stripe; g.fillRect(0, 0, W, H * 0.16); g.fillRect(0, H * 0.84, W, H * 0.16); }
  if (o.border !== false) { g.strokeStyle = o.borderColor || o.fg || '#2a1640'; g.lineWidth = W * 0.03; g.strokeRect(W * 0.02, H * 0.03, W * 0.96, H * 0.94); }
  if (o.ban) { // the red circle-and-slash over a pizza slice
    const cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.38;
    g.fillStyle = '#f5b942'; g.beginPath(); g.moveTo(cx, cy - r * 0.8); g.lineTo(cx - r * 0.6, cy + r * 0.6); g.lineTo(cx + r * 0.6, cy + r * 0.6); g.closePath(); g.fill();
    g.fillStyle = '#d23a3a'; for (const [a, b] of [[-0.1, 0.1], [0.2, 0.35], [-0.25, 0.4]]) { g.beginPath(); g.arc(cx + a * r, cy + b * r, r * 0.12, 0, 7); g.fill(); }
    g.strokeStyle = '#d6232a'; g.lineWidth = r * 0.16; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(cx - r * 0.7, cy - r * 0.7); g.lineTo(cx + r * 0.7, cy + r * 0.7); g.stroke();
  }
  g.fillStyle = o.fg || '#2a1640'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const n = lines.length;
  const size = o.size || Math.min(H / (n + 0.6), W / Math.max(...lines.map(l => l.length)) * 1.7);
  lines.forEach((l, i) => {
    const s = i === 0 && o.big ? size * o.big : size;
    g.font = `${o.font || '"Luckiest Guy", Impact, sans-serif'}`.replace(/^/, `${Math.floor(s)}px `);
    const y = o.ban ? H * 0.5 : H / 2 + (i - (n - 1) / 2) * size * 1.05;
    g.fillText(l, W / 2, y + s * 0.06);
  });
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  TEX.set(key, t);
  return t;
}
/** a flat sign (a thin plane with text, both faces) */
export function signMesh(lines, w, h, o = {}) {
  const px = Math.max(128, Math.min(1024, Math.round(256 * w / h)));
  const t = textTexture(lines, { w: px, h: Math.round(px * h / w), ...o });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, side: o.double ? THREE.DoubleSide : THREE.FrontSide }));
  return m;
}
