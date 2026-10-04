/* LifeArt.js - the things that make the town feel lived in: dogs, the
   garbage truck (two guys hanging off the back), the utility truck with its
   bucket boom, and the street carts. Trucks return the same shape as
   makeCar ({ group, body, wheels, S, seats, doors }) so Traffic can drive them. */
import * as THREE from '../../lib/three.module.js';
import { geo, part, rot, signMesh } from './Mesher.js';
import { makeChar } from './Chars.js';

const TIRE = '#1d1a24', HUB = '#c8c8d8', glassC = '#2a3550';

function pivot(x, y, z) { const p = new THREE.Group(); p.position.set(x, y, z); return p; }
function wheel(C, x, y, z, r, w = 0.3) {
  const wh = part(geo.cyl(12), TIRE, x, y, z, r * 2, w, r * 2); wh.rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) wh.add(part(geo.cyl(8), HUB, 0, s * w * 0.52, 0, 0.55, 0.06, 0.55, { rough: 0.3, metal: 0.6 }));
  C.group.add(wh); C.wheels.push(wh);
}

/** a dog. Breeds by colour and shape: a sausage dog, a fluffy one, a big one. anim(dt, speed) wags and trots. */
export function makeDog(kind = 0) {
  const B = [
    { c: '#a8642a', c2: '#7a4418', len: 0.9, h: 0.22, leg: 0.16, ear: 'flop', s: 0.9 },   // sausage
    { c: '#f6f1e6', c2: '#d8d0c0', len: 0.6, h: 0.3, leg: 0.24, ear: 'up', s: 0.85, fluff: true },
    { c: '#3a3038', c2: '#c8a070', len: 0.85, h: 0.38, leg: 0.4, ear: 'up', s: 1.1 },
    { c: '#e0b070', c2: '#f6e6c8', len: 0.75, h: 0.34, leg: 0.32, ear: 'flop', s: 1 },
  ][kind % 4];
  const root = new THREE.Group(), body = pivot(0, B.leg + B.h / 2, 0); root.add(body);
  body.add(part(B.fluff ? geo.ico(1) : geo.box(), B.c, 0, 0, 0, B.h * 1.15, B.h, B.len));
  body.add(part(geo.box(), B.c2, 0, -B.h * 0.3, 0.05, B.h * 0.9, B.h * 0.4, B.len * 0.7));   // belly
  const head = pivot(0, B.h * 0.45, B.len / 2); body.add(head);
  head.add(part(geo.box(), B.c, 0, 0.08, 0.06, 0.26, 0.24, 0.26));
  head.add(part(geo.box(), B.c2, 0, 0.02, 0.22, 0.14, 0.12, 0.16));                         // snout
  head.add(part(geo.ico(0), '#1b1b24', 0, 0.07, 0.31, 0.06, 0.05, 0.05));                    // nose
  for (const s of [-1, 1]) {
    head.add(part(geo.ico(0), '#1b1b24', s * 0.07, 0.15, 0.19, 0.045, 0.05, 0.03));          // eyes
    const ear = part(geo.box(), B.c2, s * 0.11, B.ear === 'up' ? 0.27 : 0.12, 0.02, 0.07, B.ear === 'up' ? 0.14 : 0.18, 0.08);
    if (B.ear === 'flop') ear.rotation.z = s * 0.4;
    head.add(ear);
  }
  head.add(part(geo.box(), '#d6232a', 0, -0.06, -0.02, 0.27, 0.05, 0.2));                    // collar
  const tail = pivot(0, B.h * 0.3, -B.len / 2); body.add(tail);
  tail.add(rot(part(geo.cyl(5), B.c, 0, 0.1, -0.04, 0.05, 0.22, 0.05), 'x', -0.6));
  const legs = [];
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const l = pivot(x * B.h * 0.38, B.leg, z * (B.len / 2 - 0.1)); root.add(l);
    l.add(part(geo.box(), B.c, 0, -B.leg / 2, 0, 0.08, B.leg, 0.08));
    legs.push(l);
  }
  root.scale.setScalar(B.s);
  let ph = Math.random() * 6;
  return {
    root, head, tail, legs, neck: () => new THREE.Vector3(0, (B.leg + B.h) * B.s, B.len / 2 * B.s),
    anim(dt, speed = 0) {
      ph += dt * (4 + speed * 5);
      const k = Math.min(1, speed / 1.5);
      legs.forEach((l, i) => { l.rotation.x = Math.sin(ph + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.7 * k; });
      tail.rotation.y = Math.sin(ph * 2.6) * 0.7;
      body.position.y = B.leg + B.h / 2 + Math.abs(Math.sin(ph)) * 0.03 * k;
      head.rotation.x = speed < 0.1 ? Math.sin(ph * 0.3) * 0.15 : 0;
    },
  };
}

/** the garbage truck: green, a big body, a hopper at the back that chomps, two guys on the back steps */
export function makeGarbageTruck() {
  const L = 7.4, W = 2.5, S = { len: L, wid: W, h: 3.2, cab: 1.0 };
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const C = { group: g, body, wheels: [], S, seats: [], doors: [], style: 'garbage' };
  const GRN = '#3f8a4a', GRN2 = '#2f6a3a', WH = '#f6f1e6';
  const cabL = 2.0, cabZ = L / 2 - cabL / 2;
  body.add(part(geo.box(), WH, 0, 1.35, cabZ, W, 1.9, cabL, { rough: 0.4 }));
  body.add(part(geo.box(), glassC, 0, 1.75, L / 2 + 0.01, W * 0.86, 0.8, 0.04, { rough: 0.1, metal: 0.4 }));
  for (const s of [-1, 1]) body.add(part(geo.box(), glassC, s * (W / 2 + 0.01), 1.75, cabZ + 0.2, 0.04, 0.7, 1.0, { rough: 0.1, metal: 0.4 }));
  body.add(part(geo.box(), '#2b2b33', 0, 0.55, L / 2, W, 0.35, 0.2));
  body.add(part(geo.box(), '#ffd23f', 0, 2.36, cabZ, 0.9, 0.12, 0.3, { emissive: 0xffa020, ei: 0.6 }));   // the orange light bar
  // the packer body: tall, rounded-ish, ribbed
  const z0 = -L / 2 + 1.2, z1 = cabZ - cabL / 2 - 0.05, zc = (z0 + z1) / 2;
  body.add(part(geo.box(), GRN, 0, 1.85, zc, W, 2.6, z1 - z0, { rough: 0.45 }));
  for (let i = 0; i < 4; i++) body.add(part(geo.box(), GRN2, 0, 1.85, z0 + 0.4 + i * (z1 - z0 - 0.8) / 3, W + 0.04, 2.62, 0.12));
  for (const s of [-1, 1]) { const t = signMesh(['CRUMBVILLE', 'SANITATION'], 2.6, 1.0, { bg: '#3f8a4a', fg: '#ffffff', border: false }); t.position.set(s * (W / 2 + 0.03), 1.9, zc); t.rotation.y = s * Math.PI / 2; body.add(t); }
  // the hopper at the back, its lid on a hinge (it chomps when the truck stops)
  body.add(part(geo.box(), GRN2, 0, 1.2, -L / 2 + 0.6, W, 1.6, 1.2));
  body.add(part(geo.box(), '#1b1b24', 0, 1.0, -L / 2 + 0.01, W - 0.4, 0.8, 0.04));
  const hop = pivot(0, 2.0, -L / 2 + 1.2); body.add(hop);
  hop.add(part(geo.box(), GRN, 0, 0.0, -0.6, W, 0.12, 1.25));
  C.hopper = hop;
  for (const s of [-1, 1]) { body.add(part(geo.box(), '#8a8a98', s * 0.75, 0.42, -L / 2 - 0.25, 0.7, 0.06, 0.4)); body.add(part(geo.cyl(6), '#c8c8d8', s * 1.05, 1.3, -L / 2 - 0.05, 0.05, 1.6, 0.05)); }
  body.add(part(geo.box(), '#c41a1a', 0, 0.75, -L / 2 - 0.02, W * 0.8, 0.12, 0.04, { emissive: 0xff2020, ei: 0.3 }));
  // the crew, hanging on
  C.crew = [];
  for (const s of [-1, 1]) {
    const r = makeChar({ shirt: '#ff9f1a', pants: '#3a5a2a', hat: 'cap', hatColor: '#3f8a4a', skin: s < 0 ? '#c8865a' : '#f2c29b', hair: '#2a1a14', belly: 1.1 });
    r.root.position.set(s * 0.75, 0.48, -L / 2 - 0.3); r.root.rotation.y = Math.PI + s * 0.25; r.root.scale.setScalar(0.92);
    r.armR.rotation.x = -2.4; r.armL.rotation.x = -0.3;
    g.add(r.root); C.crew.push(r);
  }
  for (const z of [L / 2 - 1.2, -L / 2 + 1.7, -L / 2 + 2.8]) for (const s of [-1, 1]) wheel(C, s * W / 2, 0.52, z, 0.52, 0.36);
  return C;
}

/** the Crumb Power & Light truck: a white van with a boom and a bucket (the boom is C.boom, the bucket C.bucket) */
export function makeUtilityTruck() {
  const L = 6.0, W = 2.2, S = { len: L, wid: W, h: 2.6, cab: 0.9 };
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const C = { group: g, body, wheels: [], S, seats: [], doors: [], style: 'utility' };
  const WH = '#f6f6fa', OR = '#ff9f1a';
  body.add(part(geo.box(), WH, 0, 1.25, L / 2 - 1.0, W, 1.7, 2.0, { rough: 0.4 }));
  body.add(part(geo.box(), glassC, 0, 1.6, L / 2 + 0.01, W * 0.86, 0.7, 0.04));
  body.add(part(geo.box(), WH, 0, 0.95, -0.9, W, 1.1, 4.0, { rough: 0.4 }));
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) body.add(part(geo.box(), '#c8ccd8', s * (W / 2 + 0.01), 0.75 + i * 0.32, -0.9, 0.03, 0.04, 3.6));
  body.add(part(geo.box(), OR, 0, 1.48, -0.9, W + 0.02, 0.14, 4.02));
  for (const s of [-1, 1]) { const t = signMesh(['CRUMB POWER & LIGHT'], 3.0, 0.36, { bg: WH, fg: '#1e2a5a', border: false }); t.position.set(s * (W / 2 + 0.03), 1.15, -0.9); t.rotation.y = s * Math.PI / 2; body.add(t); }
  body.add(part(geo.box(), '#ffd23f', 0, 2.15, L / 2 - 1.0, 0.8, 0.12, 0.3, { emissive: 0xffa020, ei: 0.6 }));
  // the turret, the boom (two sections) and the bucket with a man in it
  const tur = pivot(0, 1.5, -1.8); body.add(tur);
  tur.add(part(geo.cyl(10), '#5a5a6a', 0, 0.15, 0, 0.9, 0.3, 0.9));
  const boom = pivot(0, 0.35, 0); tur.add(boom);
  boom.add(part(geo.box(), OR, 0, 0, 1.7, 0.3, 0.3, 3.6));
  const boom2 = pivot(0, 0, 3.5); boom.add(boom2);
  boom2.add(part(geo.box(), WH, 0, 0, 1.4, 0.22, 0.22, 3.0));
  const bucket = pivot(0, 0, 3.0); boom2.add(bucket);
  bucket.add(part(geo.box(), '#ffd23f', 0, -0.4, 0.3, 0.9, 1.0, 0.9));
  const guy = makeChar({ shirt: '#ff9f1a', pants: '#1e2a5a', hat: 'cap', hatColor: '#ffd23f', skin: '#e0a57c', hair: '#5a3a1a', mustache: true });
  guy.root.scale.setScalar(0.8); guy.root.position.set(0, -0.55, 0.3); bucket.add(guy.root);
  C.turret = tur; C.boom = boom; C.boom2 = boom2; C.bucket = bucket; C.guy = guy;
  for (const z of [L / 2 - 1.0, -L / 2 + 1.0]) for (const s of [-1, 1]) wheel(C, s * W / 2, 0.42, z, 0.42, 0.32);
  return C;
}

export const LIFE_CARS = { garbage: makeGarbageTruck, utility: makeUtilityTruck };

/** a street cart with an umbrella. kind: 'bread' (hot bread, just bread), 'icecream', 'flowers' */
export function makeCart(kind = 'bread') {
  const g = new THREE.Group();
  const K = { bread: ['#ffd23f', '#d6232a', 'HOT BREAD', '(just bread)'], icecream: ['#9fd8ff', '#ff8fc8', 'ICE CREAM', '(cold)'], flowers: ['#a8e0c0', '#ff8fc8', 'FLOWERS', '(for mom)'] }[kind];
  g.add(part(geo.box(), K[0], 0, 0.7, 0, 1.8, 0.8, 0.9, { rough: 0.5 }));
  g.add(part(geo.box(), '#f6f1e6', 0, 1.12, 0, 1.9, 0.06, 1.0));
  for (const s of [-1, 1]) g.add(rot(part(geo.cyl(10), '#2b2b33', s * 0.65, 0.3, 0.48, 0.6, 0.08, 0.6), 'x', Math.PI / 2));
  g.add(part(geo.cyl(6), '#c8c8d8', -0.85, 0.85, -0.3, 0.04, 2.0, 0.04));
  g.add(part(geo.cyl(6), '#c8c8d8', 0, 1.15, 0, 0.04, 1.6, 0.04));
  const um = new THREE.Group(); um.position.set(0, 2.5, 0); g.add(um);
  um.add(part(geo.cone(8), K[1], 0, 0, 0, 2.6, 0.5, 2.6));
  um.add(part(geo.cone(8), '#ffffff', 0, 0.01, 0, 1.4, 0.52, 1.4));   // a white crown on the umbrella
  um.add(part(geo.ico(0), '#ffffff', 0, 0.3, 0, 0.12, 0.12, 0.12));
  for (const s of [-1, 1]) { const t = signMesh([K[2], K[3]], 1.6, 0.6, { bg: K[0], fg: '#2a1640', border: false }); t.position.set(0, 0.72, s * 0.46); t.rotation.y = s > 0 ? 0 : Math.PI; g.add(t); }
  // what's for sale on top
  for (let i = 0; i < 6; i++) {
    const x = -0.7 + i * 0.28;
    if (kind === 'bread') g.add(rot(part(geo.cyl(6), '#d8a050', x, 1.22, 0, 0.12, 0.6, 0.12), 'x', Math.PI / 2));
    else if (kind === 'icecream') { g.add(part(geo.cone(6), '#e8c088', x, 1.3, 0, 0.12, 0.25, 0.12)); g.add(part(geo.ico(1), ['#ff8fc8', '#ffffff', '#a8642a'][i % 3], x, 1.48, 0, 0.16, 0.16, 0.16)); }
    else { g.add(part(geo.cyl(6), '#3f8a4a', x, 1.3, 0, 0.03, 0.4, 0.03)); g.add(part(geo.ico(0), ['#ff8fc8', '#ffd23f', '#d6232a', '#ffffff'][i % 4], x, 1.55, 0, 0.18, 0.15, 0.18)); }
  }
  return g;
}
