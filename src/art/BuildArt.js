/* BuildArt.js - the models for build mode. The big store pieces come from
   Furniture.js; the rest live here. Every model stands on y = 0, faces +z
   and is centred on its footprint (Build.js). Wall pieces hang from y = 0
   upwards and get lifted to eye height when placed. */
import * as THREE from '../../lib/three.module.js';
import { geo, part, rot, signMesh } from './Mesher.js';
import { makeFurniture } from './Furniture.js';

const g0 = () => new THREE.Group();
const CHROME = { rough: 0.25, metal: 0.7 }, GOLD = { rough: 0.3, metal: 0.65 };
const legs = (g, w, d, h, c, r = 0.04, o = {}) => { for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(part(geo.cyl(6), c, a * (w / 2 - r * 1.5), h / 2, b * (d / 2 - r * 1.5), r * 2, h, r * 2, o)); };

const M = {
  cheapTable() { const g = g0(); g.add(part(geo.box(), '#ffd23f', 0, 0.74, 0, 1.2, 0.06, 0.8)); legs(g, 1.2, 0.8, 0.72, '#e8b82a', 0.035); return g; },
  chair() {
    const g = g0();
    g.add(part(geo.box(), '#d6232a', 0, 0.46, 0, 0.46, 0.08, 0.46, { rough: 0.4 }));
    g.add(part(geo.box(), '#d6232a', 0, 0.75, -0.21, 0.46, 0.42, 0.06, { rough: 0.4 }));
    legs(g, 0.46, 0.46, 0.44, '#c8ccd8', 0.02, CHROME);
    return g;
  },
  barstool() { const g = g0(); g.add(part(geo.cyl(12), '#d6232a', 0, 0.76, 0, 0.42, 0.1, 0.42, { rough: 0.4 })); g.add(part(geo.cyl(6), '#c8ccd8', 0, 0.38, 0, 0.06, 0.72, 0.06, CHROME)); g.add(part(geo.cyl(12), '#c8ccd8', 0, 0.02, 0, 0.4, 0.04, 0.4, CHROME)); g.add(part(geo.cyl(10), '#c8ccd8', 0, 0.3, 0, 0.34, 0.02, 0.34, CHROME)); return g; },
  roundTable() {
    const g = g0();
    g.add(part(geo.cyl(16), '#f2eef6', 0, 0.74, 0, 0.9, 0.05, 0.9, { rough: 0.25 }));
    g.add(part(geo.cyl(16), '#c8c0d8', 0, 0.715, 0, 0.92, 0.02, 0.92));
    g.add(part(geo.cyl(6), '#2b2b33', 0, 0.37, 0, 0.07, 0.72, 0.07)); g.add(part(geo.cyl(10), '#2b2b33', 0, 0.02, 0, 0.5, 0.04, 0.5));
    g.add(part(geo.cyl(6), '#43a85a', 0, 0.84, 0, 0.06, 0.14, 0.06)); g.add(part(geo.ico(0), '#ff8fc8', 0, 0.94, 0, 0.1, 0.08, 0.1));
    return g;
  },
  booth() {
    const g = g0(), R = '#d6232a', W = '#f6f1e6';
    g.add(part(geo.box(), R, 0, 0.22, 0, 1.6, 0.44, 0.9, { rough: 0.45 }));
    g.add(part(geo.box(), W, 0, 0.47, 0.05, 1.5, 0.08, 0.7, { rough: 0.45 }));
    g.add(part(geo.box(), R, 0, 0.75, -0.36, 1.6, 0.7, 0.18, { rough: 0.45 }));
    for (let i = 0; i < 4; i++) g.add(part(geo.box(), W, -0.6 + i * 0.4, 0.78, -0.26, 0.3, 0.55, 0.03));
    for (const s of [-1, 1]) g.add(part(geo.box(), '#c8ccd8', s * 0.79, 0.55, -0.02, 0.04, 0.3, 0.86, CHROME));
    return g;
  },
  counter() {
    const g = g0();
    g.add(part(geo.box(), '#a8743a', 0, 0.48, 0, 1.6, 0.96, 0.7));
    for (let i = 0; i < 5; i++) g.add(part(geo.box(), '#8a5a2a', -0.64 + i * 0.32, 0.48, 0.355, 0.04, 0.9, 0.01));
    g.add(part(geo.box(), '#f6e6c0', 0, 0.99, 0, 1.68, 0.06, 0.78));
    g.add(part(geo.box(), '#2b2b33', 0.5, 1.08, -0.1, 0.36, 0.14, 0.28));   // the register
    g.add(part(geo.box(), '#43e07a', 0.5, 1.16, 0.0, 0.2, 0.06, 0.02, { emissive: 0x20ff60, ei: 0.6 }));
    return g;
  },
  bench() {
    const g = g0();
    for (let i = 0; i < 3; i++) g.add(part(geo.box(), '#b07a4a', 0, 0.45, -0.18 + i * 0.16, 1.8, 0.05, 0.13));
    for (let i = 0; i < 2; i++) g.add(part(geo.box(), '#b07a4a', 0, 0.68 + i * 0.16, -0.27, 1.8, 0.12, 0.04));
    for (const s of [-1, 1]) { g.add(part(geo.box(), '#2b2b33', s * 0.8, 0.22, 0, 0.06, 0.45, 0.5)); g.add(part(geo.box(), '#2b2b33', s * 0.8, 0.65, -0.28, 0.06, 0.45, 0.04)); }
    return g;
  },
  gamerChair() {
    const g = g0(), K = '#1b1b24';
    g.add(part(geo.cyl(10), K, 0, 0.04, 0, 0.66, 0.06, 0.66));
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; g.add(rot(part(geo.box(), K, Math.sin(a) * 0.2, 0.06, Math.cos(a) * 0.2, 0.06, 0.05, 0.4), 'y', a)); }
    g.add(part(geo.cyl(6), '#5a5a6a', 0, 0.28, 0, 0.07, 0.4, 0.07));
    g.add(part(geo.box(), K, 0, 0.52, 0.02, 0.56, 0.12, 0.54));
    g.add(part(geo.box(), K, 0, 1.0, -0.26, 0.56, 0.9, 0.12));
    for (const s of [-1, 1]) { g.add(part(geo.box(), '#43e07a', s * 0.22, 1.0, -0.19, 0.06, 0.8, 0.02, { emissive: 0x20ff60, ei: 0.7 })); g.add(part(geo.box(), K, s * 0.3, 0.7, 0.04, 0.06, 0.06, 0.4)); }
    g.add(part(geo.box(), '#d6232a', 0, 1.4, -0.24, 0.4, 0.18, 0.14));
    return g;
  },
  beachTable() {
    const g = g0();
    g.add(part(geo.box(), '#c8945a', 0, 0.72, 0, 1.3, 0.05, 0.75));
    for (const s of [-1, 1]) { g.add(part(geo.box(), '#c8945a', 0, 0.42, s * 0.6, 1.3, 0.05, 0.28)); legs(g, 1.2, 1.3, 0.42, '#8a6234', 0.03); }
    legs(g, 1.2, 0.7, 0.72, '#8a6234', 0.03);
    g.add(part(geo.cyl(6), '#f6f1e6', 0, 1.2, 0, 0.05, 2.4, 0.05));
    const um = g0(); um.position.set(0, 2.3, 0); g.add(um);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; um.add(rot(rot(part(geo.box(), i % 2 ? '#3a7bd5' : '#ffffff', Math.sin(a + Math.PI / 8) * 0.48, -0.1, Math.cos(a + Math.PI / 8) * 0.48, 0.42, 0.03, 1.0), 'y', a + Math.PI / 8), 'x', 0.32)); }
    return g;
  },
  princessTable() {
    const g = g0(), P = '#ff8fd0', P2 = '#ff6ac0';
    g.add(part(geo.box(), P, 0, 0.82, 0, 1.8, 0.08, 1.0, { rough: 0.35 }));
    g.add(part(geo.box(), '#ffb8e4', 0, 0.87, 0, 1.84, 0.02, 1.04, { rough: 0.3 }));
    g.add(part(geo.box(), P2, 0, 0.72, 0.46, 1.6, 0.12, 0.04));                                  // the apron with a little heart
    g.add(part(geo.ico(0), '#ff3a9a', 0, 0.72, 0.49, 0.14, 0.1, 0.04));
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {   // curvy cabriole legs: two bends and a foot
      const x = a * 0.78, z = b * 0.4;
      g.add(rot(part(geo.box(), P, x, 0.6, z, 0.1, 0.36, 0.1), 'z', -a * 0.25));
      g.add(rot(part(geo.box(), P, x + a * 0.04, 0.26, z, 0.08, 0.38, 0.08), 'z', a * 0.2));
      g.add(part(geo.ico(0), P2, x + a * 0.08, 0.05, z, 0.14, 0.08, 0.14));
    }
    // a gold candelabra and two vases of pink flowers
    g.add(part(geo.cyl(8), '#e8b83a', 0, 0.92, 0, 0.18, 0.04, 0.18, GOLD)); g.add(part(geo.cyl(6), '#e8b83a', 0, 1.1, 0, 0.04, 0.36, 0.04, GOLD));
    g.add(part(geo.box(), '#e8b83a', 0, 1.24, 0, 0.5, 0.03, 0.03, GOLD));
    for (const x of [-0.24, 0, 0.24]) { g.add(part(geo.cyl(6), '#ffffff', x, 1.36, 0, 0.04, 0.2, 0.04)); g.add(part(geo.ico(0), '#ffd890', x, 1.5, 0, 0.04, 0.07, 0.04, { emissive: 0xffc060, ei: 1.2 })); }
    for (const s of [-1, 1]) { g.add(part(geo.cyl(8), '#f6f6fa', s * 0.5, 1.0, 0, 0.14, 0.24, 0.14)); for (let i = 0; i < 3; i++) g.add(part(geo.ico(0), i % 2 ? '#ff3a9a' : '#ffb8e4', s * 0.5 + (i - 1) * 0.06, 1.18, (i % 2) * 0.04, 0.1, 0.1, 0.1)); }
    return g;
  },
  tv() {
    const g = g0();
    g.add(part(geo.box(), '#3a2a20', 0, 0.3, 0, 1.6, 0.6, 0.48));
    g.add(part(geo.box(), '#1b1b24', 0, 1.05, 0, 1.4, 0.8, 0.08));
    g.add(part(geo.box(), '#3a8ad8', 0, 1.05, 0.045, 1.3, 0.7, 0.01, { emissive: 0x2050a0, ei: 0.8 }));
    g.add(part(geo.cyl(12), '#ffd23f', 0.15, 1.02, 0.052, 0.3, 0.005, 0.3, { emissive: 0x806010, ei: 0.6 }));   // a loaf of bread on the cooking channel
    g.add(part(geo.box(), '#2b2b33', 0, 0.62, 0, 0.3, 0.06, 0.2));
    return g;
  },
  coffee() {
    const g = g0();
    g.add(part(geo.box(), '#5a3a22', 0, 0.45, 0, 0.7, 0.9, 0.55));
    g.add(part(geo.box(), '#c8ccd8', 0, 1.1, -0.05, 0.5, 0.4, 0.4, CHROME));
    g.add(part(geo.box(), '#1b1b24', 0, 1.0, 0.16, 0.36, 0.06, 0.06));
    g.add(part(geo.cyl(8), '#ffffff', -0.08, 0.95, 0.17, 0.07, 0.08, 0.07)); g.add(part(geo.cyl(8), '#ffffff', 0.1, 0.95, 0.17, 0.07, 0.08, 0.07));
    g.add(part(geo.ico(0), '#d6232a', 0.15, 1.25, 0.16, 0.05, 0.05, 0.03, { emissive: 0xff2020, ei: 0.8 }));
    return g;
  },
  vending() {
    const g = g0();
    g.add(part(geo.box(), '#d6232a', 0, 1.0, 0, 1.0, 2.0, 0.8, { rough: 0.4 }));
    g.add(part(geo.box(), '#bfe4ff', -0.12, 1.15, 0.405, 0.62, 1.3, 0.01, { opacity: 0.5, rough: 0.05 }));
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) g.add(part(geo.box(), ['#ffd23f', '#43a85a', '#3a7bd5', '#ff8fc8'][(r + c) % 4], -0.36 + c * 0.16, 0.68 + r * 0.3, 0.3, 0.1, 0.16, 0.12));
    g.add(part(geo.box(), '#1b1b24', 0.36, 1.2, 0.41, 0.16, 0.4, 0.02));
    g.add(part(geo.box(), '#1b1b24', -0.12, 0.3, 0.41, 0.5, 0.16, 0.02));
    const s = signMesh(['BREAD CHIPS'], 0.9, 0.2, { bg: '#d6232a', fg: '#ffffff', border: false }); s.position.set(0, 1.9, 0.405); g.add(s);
    return g;
  },
  drinksFridge() {
    const g = g0();
    g.add(part(geo.box(), '#f6f6fa', 0, 0.95, 0, 0.9, 1.9, 0.7));
    g.add(part(geo.box(), '#bfe4ff', 0, 1.0, 0.355, 0.76, 1.6, 0.01, { emissive: 0x405060, ei: 0.4 }));
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) g.add(part(geo.cyl(6), ['#d6232a', '#43a85a', '#ffd23f', '#ff8fc8', '#3a7bd5'][(r * 2 + c) % 5], -0.3 + c * 0.15, 0.4 + r * 0.38, 0.2, 0.08, 0.26, 0.08));
    g.add(part(geo.box(), '#d6232a', 0, 1.82, 0.36, 0.86, 0.12, 0.01, { emissive: 0x801010, ei: 0.5 }));
    g.add(part(geo.box(), '#8a98a6', 0.33, 1.0, 0.37, 0.03, 0.5, 0.03));
    return g;
  },
  fan() {
    const g = g0();
    g.add(part(geo.cyl(10), '#f6f6fa', 0, 0.03, 0, 0.42, 0.06, 0.42)); g.add(part(geo.cyl(6), '#f6f6fa', 0, 0.62, 0, 0.05, 1.18, 0.05));
    g.add(part(geo.box(), '#f6f6fa', 0, 1.22, -0.08, 0.16, 0.16, 0.2));
    const cage = part(geo.cyl(14), '#c8ccd8', 0, 1.22, 0.06, 0.5, 0.08, 0.5); cage.rotation.x = Math.PI / 2; g.add(cage);
    for (let i = 0; i < 3; i++) { const b = part(geo.box(), '#9fd8ff', 0, 1.22, 0.1, 0.4, 0.1, 0.02); b.rotation.z = i * Math.PI / 3; g.add(b); }
    return g;
  },
  plant() { const g = g0(); g.add(part(geo.frust(1.3, 8), '#f6f1e6', 0, 0.18, 0, 0.4, 0.36, 0.4)); g.add(part(geo.ico(1), '#3f8a4a', 0, 0.62, 0, 0.5, 0.55, 0.5)); g.add(part(geo.ico(0), '#4fa64f', 0.1, 0.85, 0.05, 0.3, 0.3, 0.3)); return g; },
  flowers() {
    const g = g0();
    g.add(part(geo.box(), '#8a5a33', 0, 0.18, 0, 0.7, 0.36, 0.4));
    g.add(part(geo.box(), '#5a3a22', 0, 0.37, 0, 0.66, 0.02, 0.36));
    for (let i = 0; i < 7; i++) { const x = -0.27 + i * 0.09; g.add(part(geo.cyl(4), '#3f8a4a', x, 0.47, (i % 2) * 0.08 - 0.04, 0.02, 0.2, 0.02)); g.add(part(geo.ico(0), ['#ffffff', '#ffd23f', '#ff8fc8'][i % 3], x, 0.58, (i % 2) * 0.08 - 0.04, 0.1, 0.06, 0.1)); }
    return g;
  },
  rug() {
    const g = g0();
    g.add(part(geo.cyl(24), '#8a2a3a', 0, 0.01, 0, 2.0, 0.02, 2.0));
    g.add(part(geo.cyl(24), '#e8b83a', 0, 0.012, 0, 1.7, 0.02, 1.7));
    g.add(part(geo.cyl(24), '#8a2a3a', 0, 0.014, 0, 1.55, 0.02, 1.55));
    g.add(part(geo.cyl(16), '#1e2a5a', 0, 0.016, 0, 0.8, 0.02, 0.8));
    return g;
  },
  aquarium() {
    const g = g0();
    g.add(part(geo.box(), '#2b2b33', 0, 0.35, 0, 1.4, 0.7, 0.6));
    g.add(part(geo.box(), '#4ab8e8', 0, 1.0, 0, 1.36, 0.6, 0.56, { opacity: 0.55, rough: 0.05 }));
    g.add(part(geo.box(), '#e0c890', 0, 0.74, 0, 1.3, 0.06, 0.5));
    for (const [x, c] of [[-0.35, '#ff9f1a'], [0.1, '#ffd23f'], [0.4, '#ff6a3a']]) { g.add(part(geo.ico(0), c, x, 1.0 + x * 0.2, 0.05, 0.16, 0.1, 0.06)); g.add(part(geo.cone(3), c, x - 0.1, 1.0 + x * 0.2, 0.05, 0.1, 0.1, 0.04)); }
    g.add(part(geo.cone(4), '#3fa34d', -0.5, 0.95, -0.1, 0.12, 0.4, 0.12));
    g.add(part(geo.box(), '#2b2b33', 0, 1.32, 0, 1.42, 0.06, 0.62));
    return g;
  },
  statue() {
    const g = g0();
    g.add(part(geo.box(), '#f6f1e6', 0, 0.3, 0, 0.8, 0.6, 0.8));
    g.add(part(geo.box(), '#e8b83a', 0, 0.62, 0, 0.84, 0.04, 0.84, GOLD));
    g.add(part(geo.cyl(16), '#e8b83a', 0, 1.0, 0, 0.7, 0.18, 0.7, GOLD));   // a "loaf". Round. Flat. With a crust.
    g.add(part(geo.cyl(16), '#d8a030', 0, 1.1, 0, 0.62, 0.04, 0.62, GOLD));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(part(geo.cyl(8), '#c89020', Math.sin(a) * 0.18, 1.13, Math.cos(a) * 0.18, 0.1, 0.02, 0.1, GOLD)); }   // definitely not pepperoni
    g.add(rot(part(geo.box(), '#e8b83a', 0, 0.82, 0, 0.08, 0.3, 0.08, GOLD), 'z', 0));
    const s = signMesh(['BREAD'], 0.6, 0.18, { bg: '#e8b83a', fg: '#5a3a10', border: false }); s.position.set(0, 0.35, 0.405); g.add(s);
    return g;
  },
  clock() {
    const g = g0();
    const f = part(geo.cyl(16), '#2b2b33', 0, 0.3, 0.03, 0.6, 0.06, 0.6); f.rotation.x = Math.PI / 2; g.add(f);
    const d = part(geo.cyl(16), '#f6f6fa', 0, 0.3, 0.065, 0.52, 0.01, 0.52); d.rotation.x = Math.PI / 2; g.add(d);
    g.add(rot(part(geo.box(), '#1b1b24', 0.06, 0.36, 0.075, 0.03, 0.18, 0.01), 'z', -0.6));
    g.add(rot(part(geo.box(), '#1b1b24', -0.04, 0.3, 0.075, 0.025, 0.24, 0.01), 'z', 1.1));
    return g;
  },
  poster() {
    const g = g0();
    g.add(part(geo.box(), '#1b1b24', 0, 0.6, 0.01, 0.9, 1.2, 0.02));
    const s = signMesh(['THE', 'DOUGH-', 'FATHER'], 0.82, 1.1, { bg: '#2a1640', fg: '#ffd23f', border: false }); s.position.set(0, 0.6, 0.025); g.add(s);
    return g;
  },
};
/** some store pieces are not centred on their footprint: nudge them */
const NUDGE = { desk: 0.38 };
/** wall pieces hang this high (their y = 0 goes here) */
export const WALL_Y = { clock: 1.7, poster: 1.1, painting: 1.2, neon: 1.9 };

export function makeBuildModel(key) {
  const inner = M[key] ? M[key]() : makeFurniture(key);
  if (!NUDGE[key]) return inner;
  const g = g0(); inner.position.z = NUDGE[key]; g.add(inner); return g;
}
