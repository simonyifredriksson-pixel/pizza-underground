/* Chars.js - chunky low-poly cartoon people and living pizza toppings.
   Big heads, huge eyes, a big nose and a mouth that can open wide enough to
   scream. Every rig has the same anim(dt, st) so the game can drive a
   doctor, a cop or a pineapple in sunglasses the same way. */
import * as THREE from '../../lib/three.module.js';
import { geo, part, mat, rot } from './Mesher.js';

const SKINS = ['#f2c29b', '#e0a57c', '#c98a5e', '#8d5a3b', '#f7d6b8', '#b07250'];
export { SKINS };

function pivot(x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); return g; }

export function makeChar(o = {}) {
  const skin = o.skin || SKINS[0];
  const root = new THREE.Group();
  const body = pivot(0, 0, 0); root.add(body);
  const R = { root, body, mouthOpen: 0, phase: Math.random() * 6, blinkT: 1 + Math.random() * 3, o };

  // legs
  const legC = o.pants || '#2b2b38';
  for (const s of [-1, 1]) {
    const hip = pivot(0.17 * s, 0.72, 0);
    hip.add(part(geo.cyl(6), legC, 0, -0.32, 0, 0.24, 0.62, 0.26));
    hip.add(part(geo.box(), o.shoes || '#1d1a24', 0, -0.66, 0.06, 0.28, 0.16, 0.42));
    body.add(hip);
    R[s < 0 ? 'legL' : 'legR'] = hip;
  }
  // torso: a chunky frustum, wider at the bottom for the belly
  const torso = pivot(0, 0.72, 0); body.add(torso); R.torso = torso;
  const belly = o.belly ?? 1;
  const shirt = o.coat || o.shirt || '#f4f1ea';
  torso.add(part(geo.frust(0.82, 7), shirt, 0, 0.36, 0, 0.82 * belly, 0.74, 0.62 * belly));
  if (o.coat) { // trench coat: a long flared skirt and a collar
    torso.add(part(geo.frust(0.85, 7), o.coat, 0, -0.18, 0, 0.92, 0.5, 0.7));
    torso.add(part(geo.box(), shade(o.coat, 0.8), 0, 0.72, 0.05, 0.6, 0.16, 0.5));
    torso.add(part(geo.box(), '#2a2030', 0, 0.06, 0, 0.86, 0.08, 0.66)); // belt
  }
  if (o.apron) torso.add(part(geo.box(), '#ffffff', 0, 0.2, 0.3, 0.6, 0.6, 0.06));
  if (o.tie) torso.add(part(geo.box(), o.tie, 0, 0.45, 0.31, 0.1, 0.4, 0.04));
  if (o.badge) torso.add(part(geo.ico(0), '#ffd23f', 0.2, 0.52, 0.3, 0.12, 0.12, 0.05, { metal: 0.6, rough: 0.3 }));
  if (o.buttons) for (let i = 0; i < 3; i++) torso.add(part(geo.ico(0), o.buttons, 0, 0.18 + i * 0.16, 0.31, 0.06, 0.06, 0.04));

  // arms
  const sleeve = o.sleeve || shirt;
  for (const s of [-1, 1]) {
    const sh = pivot(0.46 * s, 1.36, 0);
    sh.add(part(geo.cyl(6), sleeve, 0, -0.26, 0, 0.2, 0.52, 0.2));
    sh.add(part(geo.ico(0), o.gloves || skin, 0, -0.6, 0, 0.26, 0.26, 0.26));
    sh.rotation.z = 0.12 * s;
    body.add(sh);
    R[s < 0 ? 'armL' : 'armR'] = sh;
  }

  // head
  const head = pivot(0, 1.44, 0); body.add(head); R.head = head;
  const hs = o.headSize || 1;
  const skull = part(geo.ico(1), skin, 0, 0.4 * hs, 0, 0.66 * hs, 0.74 * hs, 0.62 * hs);
  head.add(skull);
  // ears
  for (const s of [-1, 1]) head.add(part(geo.ico(0), skin, 0.33 * s * hs, 0.38 * hs, 0, 0.1, 0.16, 0.1));
  // eyes: huge, slightly bulging, with tiny pupils
  R.eyes = []; R.pupils = [];
  for (const s of [-1, 1]) {
    const e = part(geo.sph(8, 6), '#ffffff', 0.13 * s * hs, 0.5 * hs, 0.25 * hs, 0.24 * hs, 0.3 * hs, 0.16 * hs);
    head.add(e); R.eyes.push(e);
    const p = part(geo.sph(6, 4), '#14101c', 0.12 * s * hs, 0.5 * hs, 0.33 * hs, 0.07 * hs, 0.09 * hs, 0.04);
    head.add(p); R.pupils.push(p);
    const brow = part(geo.box(), o.hair || '#2a1a14', 0.13 * s * hs, 0.68 * hs, 0.29 * hs, 0.2 * hs, 0.05, 0.05);
    head.add(brow); R[s < 0 ? 'browL' : 'browR'] = brow;
  }
  if (o.glasses === 'sun') {
    for (const s of [-1, 1]) head.add(part(geo.box(), '#111018', 0.13 * s * hs, 0.52 * hs, 0.36 * hs, 0.26 * hs, 0.16 * hs, 0.04, { rough: 0.2 }));
    head.add(part(geo.box(), '#111018', 0, 0.56 * hs, 0.36 * hs, 0.08, 0.04, 0.04));
  } else if (o.glasses === 'round') {
    for (const s of [-1, 1]) { const r = part(geo.tor(10), '#33302c', 0.13 * s * hs, 0.5 * hs, 0.36 * hs, 0.28 * hs, 0.28 * hs, 0.28); head.add(r); }
  }
  // the nose: big
  head.add(part(geo.ico(0), shade(skin, 0.92), 0, 0.38 * hs, 0.36 * hs, (o.nose || 1) * 0.17 * hs, 0.15 * hs, (o.nose || 1) * 0.24 * hs));
  if (o.mustache) head.add(part(geo.box(), o.mustache === true ? (o.hair || '#2a1a14') : o.mustache, 0, 0.28 * hs, 0.33 * hs, 0.34 * hs, 0.07, 0.08, {}));
  // mouth: a dark hole that can open huge, a row of teeth, a tongue
  const mouth = pivot(0, 0.2 * hs, 0.28 * hs); head.add(mouth); R.mouth = mouth;
  R.mouthHole = part(geo.box(), '#3a0f1a', 0, -0.03, 0, 0.26 * hs, 0.07, 0.06);
  mouth.add(R.mouthHole);
  R.teeth = part(geo.box(), '#fbf8f0', 0, 0.01, 0.025, 0.24 * hs, 0.035, 0.03); mouth.add(R.teeth);
  R.tongue = part(geo.ico(0), '#d6455a', 0, -0.05, 0.01, 0.12, 0.05, 0.06); mouth.add(R.tongue);
  R.tongue.visible = false;
  if (o.beard) head.add(part(geo.ico(0), o.beard, 0, 0.12 * hs, 0.22 * hs, 0.5 * hs, 0.3 * hs, 0.3 * hs));

  hat(head, o, hs);
  root.scale.setScalar(o.scale || 1);
  R.anim = (dt, st) => animChar(R, dt, st || {});
  R.setLook = (hex) => { /* recolour hook (unused) */ };
  return R;
}

function hat(head, o, hs) {
  const top = 0.74 * hs;
  const hc = o.hatColor;
  switch (o.hat) {
    case 'chef':
      head.add(part(geo.cyl(8), '#ffffff', 0, top + 0.02, 0, 0.5 * hs, 0.36 * hs, 0.5 * hs));
      head.add(part(geo.ico(1), '#ffffff', 0, top + 0.34 * hs, 0, 0.66 * hs, 0.4 * hs, 0.62 * hs));
      break;
    case 'cap': // baseball / delivery cap with a peak
      head.add(part(geo.sph(8, 4), hc || '#d23a3a', 0, top - 0.06, 0, 0.66 * hs, 0.34 * hs, 0.64 * hs));
      head.add(part(geo.box(), hc || '#d23a3a', 0, top - 0.08, 0.32 * hs, 0.44 * hs, 0.04, 0.3 * hs));
      if (o.capLogo) head.add(part(geo.ico(0), o.capLogo, 0, top + 0.02, 0.28 * hs, 0.14, 0.14, 0.04));
      break;
    case 'cop':
      head.add(part(geo.cyl(8), '#1e2a5a', 0, top - 0.06, 0, 0.66 * hs, 0.22, 0.66 * hs));
      head.add(part(geo.cyl(8), '#1e2a5a', 0, top + 0.12, 0.02, 0.74 * hs, 0.08, 0.78 * hs));
      head.add(part(geo.box(), '#141a38', 0, top - 0.02, 0.36 * hs, 0.5 * hs, 0.04, 0.22));
      head.add(part(geo.ico(0), '#ffd23f', 0, top + 0.06, 0.34 * hs, 0.12, 0.12, 0.05, { metal: 0.6, rough: 0.3 }));
      break;
    case 'fedora':
      head.add(part(geo.cyl(10), hc || '#4a3b30', 0, top - 0.04, 0, 0.98 * hs, 0.05, 0.98 * hs));
      head.add(part(geo.frust(0.85, 8), hc || '#4a3b30', 0, top + 0.1, 0, 0.6 * hs, 0.3, 0.6 * hs));
      head.add(part(geo.cyl(8), '#1a1418', 0, top + 0.0, 0, 0.62 * hs, 0.07, 0.62 * hs));
      break;
    case 'cowboy':
      head.add(part(geo.cyl(10), hc || '#8a5a33', 0, top - 0.02, 0, 1.1 * hs, 0.05, 1.0 * hs));
      head.add(part(geo.frust(0.8, 8), hc || '#8a5a33', 0, top + 0.12, 0, 0.6 * hs, 0.32, 0.56 * hs));
      break;
    case 'nurse':
      head.add(part(geo.box(), '#ffffff', 0, top + 0.02, 0.05, 0.4, 0.16, 0.24));
      head.add(part(geo.box(), '#e23b4a', 0, top + 0.04, 0.17, 0.12, 0.04, 0.02));
      hair(head, o, hs, top);
      break;
    case 'beanie':
      head.add(part(geo.sph(8, 5), hc || '#3a7bd5', 0, top - 0.02, 0, 0.7 * hs, 0.5 * hs, 0.68 * hs));
      head.add(part(geo.ico(0), '#ffffff', 0, top + 0.24 * hs, 0, 0.16, 0.16, 0.16));
      break;
    case 'crown':
      head.add(part(geo.cyl(6), '#ffd23f', 0, top - 0.02, 0, 0.6 * hs, 0.22, 0.6 * hs, { metal: 0.5, rough: 0.35 }));
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; head.add(part(geo.cone(4), '#ffd23f', Math.sin(a) * 0.26 * hs, top + 0.24, Math.cos(a) * 0.26 * hs, 0.1, 0.18, 0.1, { metal: 0.5, rough: 0.35 })); }
      hair(head, o, hs, top);
      break;
    case 'bald': break;
    default: hair(head, o, hs, top);
  }
}
function hair(head, o, hs, top) {
  const c = o.hair || '#3a2418';
  if (o.hairStyle === 'big') { head.add(part(geo.ico(1), c, 0, top - 0.02, -0.06, 0.82 * hs, 0.5 * hs, 0.78 * hs)); return; }
  if (o.hairStyle === 'bun') { head.add(part(geo.ico(0), c, 0, top + 0.06, -0.18, 0.34, 0.3, 0.34)); }
  if (o.hairStyle === 'spiky') { for (let i = 0; i < 5; i++) head.add(part(geo.cone(4), c, (i - 2) * 0.11 * hs, top - 0.02, -0.02, 0.18, 0.3, 0.18)); }
  head.add(part(geo.sph(8, 4), c, 0, top - 0.12, -0.03, 0.7 * hs, 0.36 * hs, 0.66 * hs));
}

function shade(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); }

function animChar(R, dt, st) {
  const sp = st.speed || 0;
  R.phase += dt * (2.2 + sp * 1.4) * (sp > 0.2 ? 1 : 0.3);
  const k = Math.min(1, sp / 3.5);
  const s = Math.sin(R.phase);
  const panic = st.panic || 0;
  if (st.sit) {
    R.legL.rotation.x = R.legR.rotation.x = -1.45;
    R.body.position.y = -0.35;
  } else if (st.lie) {
    R.legL.rotation.x = R.legR.rotation.x = 0;
  } else {
    R.legL.rotation.x = s * 0.75 * k;
    R.legR.rotation.x = -s * 0.75 * k;
    R.body.position.y = Math.abs(Math.cos(R.phase)) * 0.07 * k + (panic ? Math.abs(Math.sin(R.phase * 3)) * 0.12 * panic : 0);
  }
  let aL = -s * 0.7 * k, aR = s * 0.7 * k, zL = 0.12, zR = -0.12;
  if (st.carry) { aL = aR = -1.35; zL = 0.25; zR = -0.25; }
  if (st.drive) { aL = aR = -1.1; zL = 0.15; zR = -0.15; }
  if (st.spray) { aR = -1.5; zR = -0.05; }
  if (st.wave) { aR = -2.7 + Math.sin(R.phase * 5) * 0.4; zR = -0.4; }
  if (st.point) { aR = -1.55; zR = -0.1; }
  if (panic > 0.3) { aL = -2.9 + Math.sin(R.phase * 9) * 0.3; aR = -2.9 - Math.sin(R.phase * 9) * 0.3; zL = 0.5; zR = -0.5; }
  R.armL.rotation.x = st.dampArms ? aL : aL; R.armR.rotation.x = aR;
  R.armL.rotation.z = zL; R.armR.rotation.z = zR;
  R.torso.rotation.z = Math.sin(R.phase) * 0.04 * k;
  R.head.rotation.y = st.headYaw || 0;
  R.head.rotation.x = st.headPitch || 0;
  if (panic) R.head.rotation.z = Math.sin(R.phase * 11) * 0.12 * panic;
  else R.head.rotation.z = 0;

  // mouth: talk flaps, screams open wide
  let open = 0;
  if (st.talk) open = 0.3 + Math.abs(Math.sin(R.phase * 7 + performance.now() * 0.02)) * 0.7;
  if (panic) open = Math.max(open, panic * 3.2);
  if (st.mouth != null) open = st.mouth;
  R.mouthOpen += (open - R.mouthOpen) * Math.min(1, dt * 14);
  const m = R.mouthOpen;
  const hs = R.o.headSize || 1;
  R.mouthHole.scale.set(0.26 * hs * (1 + m * 0.35), 0.07 * (1 + m * 4), 0.06);
  R.mouthHole.position.y = -0.03 - m * 0.13;
  R.tongue.visible = m > 0.6; R.tongue.position.y = -0.04 - m * 0.22;
  // eyes: blink, and when scared the pupils shrink to pin-pricks
  R.blinkT -= dt;
  const blink = R.blinkT < 0.12 && R.blinkT > 0;
  if (R.blinkT < 0) R.blinkT = 2 + Math.random() * 4;
  for (const e of R.eyes) e.scale.y = blink ? 0.03 : 0.3 * (R.o.headSize || 1) * (1 + panic * 0.25);
  const ps = panic ? 0.5 : 1;
  for (const p of R.pupils) { p.scale.x = 0.07 * ps * (R.o.headSize || 1); p.scale.y = blink ? 0.01 : 0.09 * ps * (R.o.headSize || 1); }
  const brow = (st.angry ? 0.35 : 0) - panic * 0.3;
  R.browL.rotation.z = -brow; R.browR.rotation.z = brow;
  R.browL.position.y = R.browR.position.y = 0.68 * (R.o.headSize || 1) + panic * 0.06;
}

/* ---------------- living toppings ---------------- */
export function makeCritter(kind, o = {}) {
  const root = new THREE.Group();
  const body = pivot(0, 0, 0); root.add(body);
  const R = { root, body, phase: Math.random() * 6, mouthOpen: 0, blinkT: 2, kind };
  let h = 0.9, eyeZ = 0.3, eyeY = 0.7, eyeX = 0.13, armY = 0.5, armX = 0.42, legX = 0.14;
  const limb = o.limb || '#2a1a14';
  switch (kind) {
    case 'pineapple':
      body.add(part(geo.ico(1), '#f2b632', 0, 0.75, 0, 0.8, 1.0, 0.8));
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const l = part(geo.cone(4), '#3f9a3a', Math.sin(a) * 0.08, 1.35, Math.cos(a) * 0.08, 0.16, 0.6, 0.16); l.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5); body.add(l); }
      h = 1.2; eyeY = 0.9; eyeZ = 0.36; armY = 0.7; armX = 0.42;
      break;
    case 'cheese': {
      const s = new THREE.Shape(); s.moveTo(-0.55, 0); s.lineTo(0.55, 0); s.lineTo(0.55, 0.62); s.lineTo(-0.55, 0.15); s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.7, bevelEnabled: false }); g.translate(0, 0.12, -0.35);
      body.add(part(g, '#ffd447'));
      for (const [x, y] of [[-0.2, 0.3], [0.25, 0.45], [0.05, 0.22]]) body.add(rot(part(geo.cyl(6), '#e0a92a', x, y, 0.35, 0.12, 0.02, 0.12), 'x', Math.PI / 2));
      h = 0.8; eyeY = 0.5; eyeZ = 0.36; eyeX = 0.16; armY = 0.4; armX = 0.6;
      break;
    }
    case 'mushroom':
      body.add(part(geo.cyl(7), '#f4ead6', 0, 0.2, 0, 0.5, 0.6, 0.5));
      body.add(part(geo.sph(9, 5), '#c8473f', 0, 0.85, 0, 1.15, 0.7, 1.15));
      for (const [x, z] of [[0.25, 0.25], [-0.3, 0.1], [0.05, -0.32], [0.32, -0.1]]) body.add(part(geo.ico(0), '#ffffff', x, 1.08, z, 0.14, 0.06, 0.14));
      h = 1; eyeY = 0.48; eyeZ = 0.26; eyeX = 0.1; armY = 0.4; armX = 0.3;
      break;
    case 'tomato':
      body.add(part(geo.ico(1), '#e23b3b', 0, 0.6, 0, 0.95, 0.85, 0.95));
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const l = part(geo.box(), '#3f9a3a', Math.sin(a) * 0.12, 1.02, Math.cos(a) * 0.12, 0.08, 0.04, 0.3); l.rotation.y = a; body.add(l); }
      h = 1; eyeY = 0.72; eyeZ = 0.42; armY = 0.55; armX = 0.48;
      break;
    case 'sausage':
      body.add(part(geo.cyl(8), '#c4554a', 0, 0.75, 0, 0.5, 1.0, 0.5));
      body.add(part(geo.sph(8, 4), '#c4554a', 0, 1.25, 0, 0.5, 0.36, 0.5));
      body.add(part(geo.sph(8, 4), '#c4554a', 0, 0.25, 0, 0.5, 0.36, 0.5));
      for (let i = 0; i < 4; i++) body.add(part(geo.ico(0), '#f2d6c4', Math.sin(i * 2) * 0.24, 0.5 + i * 0.2, Math.cos(i * 2) * 0.24, 0.07, 0.07, 0.07));
      h = 1.3; eyeY = 1.05; eyeZ = 0.24; eyeX = 0.1; armY = 0.7; armX = 0.3;
      break;
    case 'olive':
      body.add(part(geo.ico(1), '#2f3a26', 0, 0.55, 0, 0.7, 0.8, 0.7));
      body.add(part(geo.ico(0), '#c4554a', 0, 0.98, 0, 0.2, 0.1, 0.2));
      h = 0.95; eyeY = 0.65; eyeZ = 0.32; armY = 0.5; armX = 0.38;
      break;
    case 'dough':
      body.add(part(geo.ico(1), '#f4e4c1', 0, 0.45, 0, 0.95, 0.75, 0.95));
      h = 0.8; eyeY = 0.55; eyeZ = 0.42; armY = 0.4; armX = 0.5;
      break;
    default:
      body.add(part(geo.ico(1), '#cccccc', 0, 0.5, 0, 0.8, 0.8, 0.8));
  }
  R.eyes = []; R.pupils = [];
  for (const s of [-1, 1]) {
    const e = part(geo.sph(8, 6), '#ffffff', eyeX * s, eyeY, eyeZ, 0.2, 0.26, 0.12); body.add(e); R.eyes.push(e);
    const p = part(geo.sph(6, 4), '#14101c', eyeX * s * 0.95, eyeY, eyeZ + 0.06, 0.07, 0.09, 0.04); body.add(p); R.pupils.push(p);
  }
  if (o.glasses || kind === 'pineapple') {
    for (const s of [-1, 1]) body.add(part(geo.box(), '#111018', eyeX * s, eyeY + 0.02, eyeZ + 0.08, 0.24, 0.15, 0.04, { rough: 0.2 }));
    body.add(part(geo.box(), '#111018', 0, eyeY + 0.05, eyeZ + 0.08, 0.1, 0.04, 0.04));
    R.cool = true;
  }
  if (o.hat === 'cowboy' || kind === 'cheese') {
    const y = kind === 'cheese' ? 0.78 : h + 0.1;
    body.add(part(geo.cyl(10), '#8a5a33', 0.1, y, 0, 0.9, 0.04, 0.8));
    body.add(part(geo.frust(0.8, 8), '#8a5a33', 0.1, y + 0.14, 0, 0.46, 0.28, 0.42));
  }
  if (o.mustache) body.add(part(geo.box(), '#2a1a14', 0, eyeY - 0.18, eyeZ + 0.06, 0.3, 0.06, 0.06));
  const mouth = pivot(0, eyeY - 0.26, eyeZ - 0.02); body.add(mouth);
  R.mouthHole = part(geo.box(), '#3a0f1a', 0, 0, 0, 0.18, 0.05, 0.05); mouth.add(R.mouthHole);
  // stick limbs with white gloves, cartoon style
  for (const s of [-1, 1]) {
    const a = pivot(armX * s, armY, 0);
    a.add(part(geo.cyl(4), limb, 0, -0.18, 0, 0.05, 0.36, 0.05));
    a.add(part(geo.ico(0), '#ffffff', 0, -0.38, 0, 0.16, 0.16, 0.16));
    a.rotation.z = 0.6 * s; body.add(a);
    R[s < 0 ? 'armL' : 'armR'] = a;
    const l = pivot(legX * s, 0.12, 0);
    l.add(part(geo.cyl(4), limb, 0, -0.04, 0, 0.05, 0.2, 0.05));
    l.add(part(geo.box(), '#1d1a24', 0, -0.12, 0.05, 0.14, 0.08, 0.2));
    root.add(l); R[s < 0 ? 'legL' : 'legR'] = l;
  }
  body.position.y = 0.1;
  root.scale.setScalar(o.scale || 1);
  R.anim = (dt, st = {}) => {
    const sp = st.speed || 0;
    R.phase += dt * (3 + sp * 3);
    const s = Math.sin(R.phase);
    R.legL.rotation.x = s * 0.8 * Math.min(1, sp); R.legR.rotation.x = -s * 0.8 * Math.min(1, sp);
    R.body.position.y = 0.1 + Math.abs(Math.sin(R.phase * (sp > 0.1 ? 1 : 0.5))) * (sp > 0.1 ? 0.1 : 0.04);
    R.armL.rotation.x = st.wave ? 0 : -s * 0.5; R.armR.rotation.x = st.wave ? -2.6 + Math.sin(R.phase * 4) * 0.4 : s * 0.5;
    R.body.rotation.z = Math.sin(R.phase * 0.5) * 0.06;
    let open = st.talk ? 0.4 + Math.abs(Math.sin(R.phase * 6)) * 0.8 : 0;
    if (st.panic) open = 3;
    R.mouthOpen += (open - R.mouthOpen) * Math.min(1, dt * 12);
    R.mouthHole.scale.set(0.18 * (1 + R.mouthOpen * 0.3), 0.05 * (1 + R.mouthOpen * 3), 0.05);
    R.blinkT -= dt; const blink = R.blinkT < 0.12 && R.blinkT > 0; if (R.blinkT < 0) R.blinkT = 2 + Math.random() * 4;
    for (const e of R.eyes) e.scale.y = blink ? 0.02 : 0.26;
  };
  return R;
}
