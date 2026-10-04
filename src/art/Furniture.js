/* Furniture.js - the furniture store's stock (and, once you buy it, your
   hideout's). Each piece stands on y = 0, facing +z. */
import * as THREE from '../../lib/three.module.js';
import { geo, part, rot, signMesh } from './Mesher.js';

const g0 = () => new THREE.Group();
const WOOD = '#7a4a2a', WOOD2 = '#5a3a22', BRASS = '#d8a83a', b = { rough: 0.3, metal: 0.6 };

const BUILD = {
  sofa() {
    const g = g0(), L = '#7a2a2a', L2 = '#5a1a1a';
    g.add(part(geo.box(), L, 0, 0.3, 0, 2.0, 0.3, 0.85, { rough: 0.5 }));
    g.add(part(geo.box(), L, 0, 0.65, -0.32, 2.0, 0.6, 0.22, { rough: 0.5 }));
    for (const s of [-1, 1]) g.add(part(geo.box(), L2, s * 0.92, 0.52, 0, 0.18, 0.45, 0.85, { rough: 0.5 }));
    for (const x of [-0.5, 0.5]) { g.add(part(geo.box(), L, x, 0.5, 0.06, 0.94, 0.14, 0.66, { rough: 0.5 })); g.add(part(geo.box(), L, x, 0.8, -0.2, 0.9, 0.4, 0.16, { rough: 0.5 })); }
    for (let i = 0; i < 6; i++) g.add(part(geo.ico(0), '#3a0a0a', -0.75 + i * 0.3, 0.86, -0.12, 0.05, 0.05, 0.03));   // buttons
    for (const [x, z] of [[-0.9, -0.35], [0.9, -0.35], [-0.9, 0.35], [0.9, 0.35]]) g.add(part(geo.cyl(6), WOOD2, x, 0.07, z, 0.08, 0.14, 0.08));
    g.add(rot(part(geo.box(), '#ffd23f', 0.6, 0.66, 0.08, 0.36, 0.3, 0.12), 'x', -0.3));   // a cushion
    return g;
  },
  table() {
    const g = g0();
    g.add(part(geo.cyl(16), WOOD, 0, 0.74, 0, 1.3, 0.06, 1.3));
    g.add(part(geo.cyl(16), '#f6f1e6', 0, 0.775, 0, 1.0, 0.01, 1.0));
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) g.add(part(geo.box(), '#d6232a', -0.3 + i * 0.2, 0.782, -0.3 + j * 0.2, 0.2, 0.005, 0.2));
    g.add(part(geo.cyl(8), WOOD2, 0, 0.37, 0, 0.14, 0.74, 0.14)); g.add(part(geo.cyl(10), WOOD2, 0, 0.03, 0, 0.6, 0.06, 0.6));
    g.add(part(geo.cyl(6), '#2f8a4a', 0.15, 0.85, 0.1, 0.07, 0.16, 0.07)); g.add(part(geo.ico(0), '#fff1c0', -0.15, 0.82, -0.1, 0.06, 0.08, 0.06, { emissive: 0xffd890, ei: 1 }));
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2, c = g0(); c.position.set(Math.sin(a) * 0.95, 0, Math.cos(a) * 0.95); c.rotation.y = a + Math.PI; g.add(c);
      c.add(part(geo.box(), WOOD, 0, 0.45, 0, 0.42, 0.05, 0.42)); c.add(part(geo.box(), WOOD, 0, 0.72, -0.19, 0.42, 0.5, 0.05));
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) c.add(part(geo.box(), WOOD2, x * 0.17, 0.22, z * 0.17, 0.04, 0.45, 0.04));
    }
    return g;
  },
  lamp() {
    const g = g0();
    g.add(part(geo.cyl(10), BRASS, 0, 0.02, 0, 0.4, 0.04, 0.4, b));
    g.add(part(geo.cyl(6), BRASS, 0, 0.8, 0, 0.04, 1.55, 0.04, b));
    g.add(part(geo.frust(0.6, 10), '#f6e6c0', 0, 1.65, 0, 0.5, 0.36, 0.5, { emissive: 0xffd890, ei: 0.55 }));
    g.add(part(geo.ico(0), '#fff8d0', 0, 1.52, 0, 0.12, 0.12, 0.12, { emissive: 0xfff2b0, ei: 1.4 }));
    return g;
  },
  bookcase() {
    const g = g0(), C = ['#8a2a2a', '#2a4a8a', '#2a6a3a', '#c8a03a', '#6a2a6a', '#d8c8a0'];
    g.add(part(geo.box(), '#5a2a1a', 0, 1.0, -0.22, 1.4, 2.0, 0.06));
    for (const s of [-1, 1]) g.add(part(geo.box(), '#6a3220', s * 0.68, 1.0, 0, 0.06, 2.0, 0.48));
    g.add(part(geo.box(), '#6a3220', 0, 2.03, 0.02, 1.5, 0.08, 0.56));
    for (let k = 0; k < 4; k++) {
      const y = 0.08 + k * 0.48; g.add(part(geo.box(), '#6a3220', 0, y, 0, 1.32, 0.04, 0.46));
      let x = -0.6; while (x < 0.55) { const w = 0.07 + ((x * 97 + k * 13) % 1 + 1) % 1 * 0.07, h = 0.28 + ((x * 31 + k) % 1 + 1) % 1 * 0.12; g.add(part(geo.box(), C[Math.abs(Math.round(x * 50 + k)) % C.length], x + w / 2, y + 0.02 + h / 2, 0.02, w, h, 0.3)); x += w + 0.015; }
    }
    g.add(part(geo.ico(0), '#c8c8d8', 0.4, 2.2, 0, 0.14, 0.2, 0.14, b));   // a little bust on top
    return g;
  },
  arcade() {
    const g = g0(), P = '#8a4ac8';
    g.add(part(geo.box(), P, 0, 0.9, 0, 0.72, 1.8, 0.72));
    g.add(rot(part(geo.box(), '#1b1b24', 0, 1.25, 0.32, 0.6, 0.5, 0.06), 'x', -0.25));
    g.add(rot(part(geo.box(), '#43e07a', 0, 1.25, 0.355, 0.5, 0.4, 0.01, { emissive: 0x20ff60, ei: 0.8 }), 'x', -0.25));
    g.add(rot(part(geo.box(), '#2b2b33', 0, 0.95, 0.42, 0.66, 0.06, 0.3), 'x', 0.2));
    g.add(part(geo.cyl(6), '#d6232a', -0.15, 1.02, 0.45, 0.06, 0.1, 0.06)); for (const x of [0.08, 0.2]) g.add(part(geo.cyl(8), '#ffd23f', x, 1.0, 0.45, 0.07, 0.03, 0.07));
    const s = signMesh(['PIZZA PANIC'], 0.66, 0.2, { bg: '#ffd23f', fg: '#d6232a', border: false }); s.position.set(0, 1.68, 0.365); g.add(s);
    g.add(part(geo.box(), '#ffd23f', 0, 1.68, 0.35, 0.72, 0.24, 0.02, { emissive: 0xffc020, ei: 0.5 }));
    return g;
  },
  palm() {
    const g = g0();
    g.add(part(geo.frust(1.3, 8), '#c8643a', 0, 0.22, 0, 0.5, 0.44, 0.5));
    g.add(part(geo.cyl(6), '#8a6a3a', 0, 0.75, 0, 0.08, 0.8, 0.08));
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; g.add(rot(rot(part(geo.box(), '#3fa34d', Math.sin(a) * 0.35, 1.2, Math.cos(a) * 0.35, 0.12, 0.02, 0.75), 'y', a), 'x', 0.5)); }
    return g;
  },
  jukebox() {
    const g = g0();
    g.add(part(geo.box(), '#8a2a3a', 0, 0.6, 0, 0.9, 1.2, 0.55));
    g.add(part(geo.cyl(16), '#ff8fc8', 0, 1.2, 0, 0.9, 0.55, 0.55, { emissive: 0xff60b0, ei: 0.5 }));
    g.add(part(geo.box(), '#fff1c0', 0, 0.85, 0.28, 0.6, 0.35, 0.02, { emissive: 0xffd890, ei: 0.7 }));
    for (let i = 0; i < 5; i++) g.add(part(geo.box(), ['#43c0ff', '#ffd23f', '#43e07a', '#ff3a3a', '#c9a8f0'][i], -0.32 + i * 0.16, 0.45, 0.28, 0.1, 0.1, 0.02, { emissive: 0x404040, ei: 0.5 }));
    g.add(part(geo.box(), '#c8c8d8', 0, 0.15, 0.28, 0.8, 0.18, 0.02, b));
    return g;
  },
  painting() {
    const g = g0();
    g.add(part(geo.box(), BRASS, 0, 0.5, 0, 1.2, 1.0, 0.08, b));
    g.add(part(geo.box(), '#3a2a20', 0, 0.5, 0.045, 1.04, 0.84, 0.01));
    g.add(part(geo.ico(1), '#e0a57c', 0, 0.62, 0.05, 0.3, 0.34, 0.02));            // a very serious face
    g.add(part(geo.box(), '#1b1b24', 0, 0.82, 0.05, 0.4, 0.08, 0.02));             // fedora
    g.add(part(geo.box(), '#1b1b24', 0, 0.32, 0.05, 0.6, 0.3, 0.02));             // suit
    g.add(part(geo.cyl(12), '#ffd23f', 0.22, 0.33, 0.055, 0.36, 0.01, 0.36));    // the pizza
    g.add(part(geo.box(), '#1a1410', 0, 0.56, 0.055, 0.14, 0.03, 0.01));
    return g;
  },
  neon() {
    const g = g0();
    g.add(part(geo.box(), '#1b1b24', 0, 0.3, -0.04, 1.4, 0.6, 0.04));
    const s = signMesh(['SHOES'], 1.3, 0.5, { bg: '#1b1b24', fg: '#ff60c8', border: false }); s.position.set(0, 0.3, 0); g.add(s);
    g.add(part(geo.box(), '#ff60c8', 0, 0.03, 0, 1.3, 0.03, 0.02, { emissive: 0xff40b0, ei: 1.5 }));
    g.add(part(geo.box(), '#ff60c8', 0, 0.57, 0, 1.3, 0.03, 0.02, { emissive: 0xff40b0, ei: 1.5 }));
    return g;
  },
  desk() {
    const g = g0();
    g.add(part(geo.box(), '#4a2a18', 0, 0.38, 0, 1.8, 0.76, 0.85));
    g.add(part(geo.box(), '#6a3a20', 0, 0.78, 0, 1.9, 0.06, 0.95));
    g.add(part(geo.box(), '#2f6a3a', 0, 0.815, 0.05, 0.9, 0.01, 0.5));          // a green leather pad
    g.add(part(geo.box(), BRASS, -0.6, 0.85, 0.1, 0.25, 0.1, 0.12, b));            // nameplate
    g.add(part(geo.box(), '#1b1b24', 0.55, 0.86, -0.15, 0.3, 0.12, 0.2));          // a phone
    g.add(part(geo.cyl(8), '#fff1c0', 0.75, 0.95, -0.3, 0.12, 0.22, 0.12, { emissive: 0xffd890, ei: 0.6 }));
    const ch = g0(); ch.position.set(0, 0, -0.85); g.add(ch);                     // the big leather chair
    ch.add(part(geo.box(), '#3a1a1a', 0, 0.5, 0, 0.7, 0.12, 0.65)); ch.add(part(geo.box(), '#3a1a1a', 0, 1.0, -0.3, 0.72, 1.0, 0.14));
    ch.add(part(geo.cyl(6), '#2b2b33', 0, 0.25, 0, 0.08, 0.45, 0.08)); ch.add(part(geo.cyl(8), '#2b2b33', 0, 0.04, 0, 0.6, 0.06, 0.6));
    return g;
  },
};
export function makeFurniture(key) { return (BUILD[key] || BUILD.lamp)(); }

/** where each piece goes once you place it: the hideout and the family room (storage) */
export const DECOR_SPOTS = {
  painting: { x: 140.32, y: 1.3, z: 83.4, ry: Math.PI / 2, wall: true },
  neon: { x: 139.35, y: 3.0, z: 76.2, ry: -Math.PI / 2, wall: true },
  lamp: { x: 151.2, z: 86.2, ry: Math.PI },
  palm: { x: 151.1, z: 78.8, ry: 0 },
  sofa: { x: 701.5, z: -5.2, ry: 0, w: 2.0, d: 0.9 },
  bookcase: { x: 705.0, z: -5.7, ry: 0, w: 1.4, d: 0.5 },
  arcade: { x: 707.2, z: 0.5, ry: -Math.PI / 2, w: 0.75, d: 0.75 },
  jukebox: { x: 707.3, z: 3.6, ry: -Math.PI / 2, w: 0.6, d: 0.9 },
  table: { x: 694.6, z: -2.0, ry: 0, w: 2.2, d: 2.2 },
  desk: { x: 697.2, z: 4.7, ry: Math.PI, w: 1.9, d: 1.0 },
};
