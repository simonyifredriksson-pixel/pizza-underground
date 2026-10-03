/* Gear.js - the Underground Market's merchandise, and the big black trash
   bag. Every model is built around its grip: the point a hand holds, at the
   origin. 'up' things stand up out of the fist (+y), 'hang' things hang
   below it (-y), 'along' things point the way the arm points (+y), and +z
   is "away from you" when you hold it out. */
import * as THREE from '../../lib/three.module.js';
import { geo, part, mat, rot, signMesh } from './Mesher.js';

const WOOD = '#a8743a', DARKWOOD = '#7a5236', STEEL = '#b8bcc8', GOLD = '#e8b83a', INK = '#1b1b24';
const shiny = { rough: 0.35, metal: 0.4 };

function grp(...kids) { const g = new THREE.Group(); for (const k of kids) g.add(k); return g; }
function ring(color, x, y, z, s, t = 1, o) { return part(geo.tor(10), color, x, y, z, s, s, s * t, o); }

/** a little flat label in the scene, facing +z */
function label(lines, w, h, x, y, z, o) { const s = signMesh(lines, w, h, o); s.position.set(x, y, z); return s; }

const BUILD = {
  /* an enormous orange foam bat with a pink tip and a "BONK" sticker */
  foambat() {
    const g = grp();
    g.add(part(geo.cyl(8), '#3a3048', 0, -0.13, 0, 0.12, 0.06, 0.12));        // knob
    g.add(part(geo.cyl(8), '#2b2b33', 0, 0.06, 0, 0.075, 0.34, 0.075));       // grip tape
    for (const y of [-0.04, 0.06, 0.16]) g.add(part(geo.cyl(8), '#5a5a6a', 0, y, 0, 0.082, 0.02, 0.082));
    g.add(part(geo.frust(2.5, 9), '#ff8f2a', 0, 0.72, 0, 0.1, 1.0, 0.1, { rough: 0.95 })); // foam barrel
    g.add(part(geo.sph(9, 6), '#ff8fc8', 0, 1.22, 0, 0.25, 0.16, 0.25, { rough: 0.95 })); // squishy tip
    g.add(part(geo.cyl(9), '#ffb46a', 0, 0.86, 0, 0.215, 0.05, 0.215, { rough: 0.95 })); // a foam ring
    g.add(label(['BONK'], 0.16, 0.09, 0, 0.62, 0.095, { bg: '#ffe14a', fg: '#d6232a', border: false }));
    return g;
  },
  /* the cartoon mallet: a long handle and a barrel of a head with steel bands */
  mallet() {
    const g = grp();
    g.add(part(geo.cyl(7), DARKWOOD, 0, 0.5, 0, 0.08, 1.25, 0.08));
    g.add(part(geo.cyl(7), '#d6232a', 0, 0.02, 0, 0.1, 0.32, 0.1));           // grip
    g.add(part(geo.ico(0), '#d6232a', 0, -0.15, 0, 0.13, 0.1, 0.13));
    const head = rot(part(geo.cyl(10), '#c88a4a', 0, 1.2, 0, 0.56, 0.85, 0.56), 'z', Math.PI / 2); g.add(head);
    for (const s of [-1, 1]) {
      g.add(rot(part(geo.cyl(10), '#e0b070', s * 0.43, 1.2, 0, 0.5, 0.03, 0.5), 'z', Math.PI / 2));   // face
      g.add(rot(part(geo.cyl(10), STEEL, s * 0.34, 1.2, 0, 0.6, 0.07, 0.6, shiny), 'z', Math.PI / 2)); // band
    }
    g.add(label(['1,000', 'LBS'], 0.28, 0.2, 0, 1.2, 0.285, { bg: '#f6f1e6', fg: INK, border: false }));
    return g;
  },
  /* a red toolbox hanging from its handle, a wrench sticking out */
  toolbox() {
    const g = grp();
    g.add(part(geo.box(), '#2b2b33', 0, 0, 0, 0.34, 0.05, 0.06));            // handle bar
    for (const s of [-1, 1]) g.add(part(geo.box(), '#2b2b33', s * 0.16, -0.06, 0, 0.04, 0.12, 0.05));
    g.add(part(geo.box(), '#d6232a', 0, -0.33, 0, 0.66, 0.42, 0.32, { rough: 0.45 }));
    g.add(part(geo.box(), '#a8181e', 0, -0.17, 0, 0.68, 0.05, 0.34));         // lid seam
    for (const s of [-1, 1]) g.add(part(geo.box(), STEEL, s * 0.22, -0.2, 0.17, 0.08, 0.1, 0.02, shiny)); // latches
    g.add(rot(part(geo.box(), STEEL, 0.36, -0.18, 0.04, 0.32, 0.05, 0.03, shiny), 'z', 0.5)); // wrench handle
    g.add(ring(STEEL, 0.5, -0.08, 0.04, 0.12, 1, shiny));                    // wrench head
    g.add(label(['TOOLS?'], 0.3, 0.12, 0, -0.36, 0.165, { bg: '#ffe14a', fg: INK, border: false }));
    return g;
  },
  /* a life-size cardboard Knuckles on a stick, painted by someone who has seen Knuckles once */
  cutout() {
    const g = grp(), CB = '#c8a46a';
    g.add(part(geo.box(), DARKWOOD, 0, 0.45, -0.03, 0.06, 1.1, 0.04));       // the stick
    g.add(part(geo.box(), CB, 0, 1.3, -0.025, 0.86, 1.0, 0.02));             // cardboard backing (body)
    g.add(part(geo.box(), '#1b1b24', 0, 1.28, 0, 0.8, 0.94, 0.02));          // the coat
    g.add(part(geo.box(), '#2b2b38', 0, 1.18, 0.012, 0.62, 0.22, 0.01));       // crossed arms
    for (const s of [-1, 1]) g.add(part(geo.ico(0), '#e0a57c', s * 0.3, 1.18, 0.02, 0.14, 0.13, 0.02)); // fists
    g.add(part(geo.box(), '#d6232a', 0, 1.52, 0.012, 0.08, 0.3, 0.01));       // tie
    g.add(part(geo.ico(1), CB, 0, 1.98, -0.025, 0.56, 0.6, 0.02));
    g.add(part(geo.ico(1), '#e0a57c', 0, 1.98, 0, 0.5, 0.54, 0.02));          // head
    g.add(part(geo.box(), '#111018', 0, 2.03, 0.012, 0.42, 0.09, 0.01));       // sunglasses
    g.add(part(geo.box(), '#2a1a14', 0, 1.9, 0.012, 0.26, 0.06, 0.01));        // mustache
    for (const s of [-1, 1]) g.add(rot(part(geo.box(), '#2a1a14', s * 0.12, 2.12, 0.012, 0.16, 0.035, 0.01), 'z', s * 0.35)); // angry brows
    g.add(part(geo.box(), '#1b1b24', 0, 2.24, 0, 0.66, 0.05, 0.03));          // fedora brim
    g.add(part(geo.box(), '#1b1b24', 0, 2.34, 0, 0.36, 0.17, 0.03));
    g.add(label(['(REAL)'], 0.3, 0.1, 0, 0.92, 0.012, { bg: '#f6f1e6', fg: INK, border: false }));
    return g;
  },
  /* the Party Smoke Machine: a grey box with a nozzle, knobs and a tank */
  smoke() {
    const g = grp();
    g.add(part(geo.box(), INK, 0, 0, 0, 0.3, 0.05, 0.06));
    for (const s of [-1, 1]) g.add(part(geo.box(), INK, s * 0.14, -0.06, 0, 0.04, 0.1, 0.05));
    g.add(part(geo.box(), '#8a8aa0', 0, -0.32, 0, 0.56, 0.4, 0.36, { rough: 0.5 }));
    g.add(rot(part(geo.cone(8), '#5a5a6a', 0, -0.34, 0.28, 0.16, 0.22, 0.16), 'x', Math.PI / 2));   // nozzle
    g.add(part(geo.cyl(8), '#43e07a', -0.2, -0.3, -0.23, 0.16, 0.38, 0.16, { rough: 0.4 }));        // fog juice
    for (const [i, c] of ['#ffd23f', '#ff8fc8', '#43c0ff'].entries()) g.add(rot(part(geo.cyl(8), c, 0.29, -0.24 - i * 0.1, 0.06, 0.07, 0.03, 0.07), 'z', Math.PI / 2));
    g.add(label(['PARTY'], 0.32, 0.12, 0.02, -0.4, 0.185, { bg: '#ff8fc8', fg: '#ffffff', border: false }));
    return g;
  },
  /* a key ring: three cartoon keys and a rubber chicken hanging off it */
  lockpick() {
    const g = grp();
    g.add(ring(GOLD, 0, 0, 0, 0.18, 1, shiny));
    for (const [i, a] of [-0.5, 0, 0.45].entries()) {
      const k = new THREE.Group(); k.rotation.z = a; k.position.set(0, -0.06, 0);
      k.add(ring(i === 1 ? '#c8c8d8' : GOLD, 0, -0.1, 0, 0.12, 2, shiny));
      k.add(part(geo.box(), i === 1 ? '#c8c8d8' : GOLD, 0, -0.3, 0, 0.035, 0.32, 0.02, shiny));
      for (const y of [-0.38, -0.44]) k.add(part(geo.box(), i === 1 ? '#c8c8d8' : GOLD, 0.03, y, 0, 0.05, 0.03, 0.02, shiny));
      g.add(k);
    }
    // the rubber chicken, upside down, by its feet
    const ch = new THREE.Group(); ch.position.set(0.1, -0.12, 0.05); ch.rotation.z = -0.25; g.add(ch);
    ch.add(part(geo.box(), '#ff9f1a', 0, -0.05, 0, 0.02, 0.12, 0.02));
    ch.add(part(geo.ico(1), '#ffe14a', 0, -0.3, 0, 0.18, 0.36, 0.16, { rough: 0.5 }));
    ch.add(part(geo.ico(1), '#ffe14a', 0, -0.55, 0, 0.13, 0.14, 0.13, { rough: 0.5 }));
    ch.add(rot(part(geo.cone(5), '#ff9f1a', 0, -0.56, 0.1, 0.05, 0.1, 0.05), 'x', Math.PI / 2));
    ch.add(part(geo.box(), '#d6232a', 0, -0.64, 0, 0.02, 0.06, 0.08));
    for (const s of [-1, 1]) ch.add(part(geo.ico(0), INK, s * 0.04, -0.53, 0.06, 0.025, 0.025, 0.02));
    return g;
  },
  /* the Instant Disguise Kit: a pink case, open, with glasses-nose-and-mustache on top */
  disguise() {
    const g = grp();
    g.add(part(geo.box(), '#ff8fc8', 0, 0.05, 0, 0.42, 0.08, 0.3, { rough: 0.5 }));
    const lid = rot(part(geo.box(), '#ff6bb0', 0, 0.2, -0.17, 0.42, 0.3, 0.03, { rough: 0.5 }), 'x', -0.3); g.add(lid);
    g.add(label(['INSTANT', 'DISGUISE'], 0.3, 0.14, 0, 0.21, -0.145, { bg: '#ffe14a', fg: INK, border: false }));
    const G = makeGroucho(0.8); G.position.set(0, 0.04, 0.02); g.add(G);
    return g;
  },
  /* an air horn: a red can, a white trigger, a big trumpet bell */
  airhorn() {
    const g = grp();
    g.add(part(geo.cyl(10), '#d6232a', 0, 0.18, 0, 0.16, 0.36, 0.16, { rough: 0.35 }));
    g.add(part(geo.cyl(10), '#f6f1e6', 0, 0.37, 0, 0.17, 0.03, 0.17));
    g.add(part(geo.box(), '#f6f1e6', 0, 0.42, 0, 0.06, 0.06, 0.06));
    g.add(rot(part(geo.cyl(8), '#f6f1e6', 0, 0.47, 0.08, 0.06, 0.16, 0.06), 'x', Math.PI / 2));
    g.add(rot(part(geo.frust(4, 10), '#f6f1e6', 0, 0.47, 0.3, 0.07, 0.3, 0.07), 'x', Math.PI / 2));   // the bell
    g.add(rot(part(geo.cyl(10), '#1b1b24', 0, 0.47, 0.452, 0.24, 0.01, 0.24), 'x', Math.PI / 2));
    g.add(label(['LOUD'], 0.12, 0.06, 0, 0.2, 0.082, { bg: '#ffe14a', fg: INK, border: false }));
    return g;
  },
  /* a chunky flashlight; the beam comes out of the +y end */
  flashlight() {
    const g = grp();
    g.add(part(geo.cyl(8), '#2b2b38', 0, 0.12, 0, 0.1, 0.38, 0.1, { rough: 0.4 }));
    for (const y of [0.0, 0.08, 0.16]) g.add(part(geo.cyl(8), '#4a4a5a', 0, y, 0, 0.11, 0.02, 0.11));
    g.add(part(geo.frust(1.6, 10), '#ffd23f', 0, 0.38, 0, 0.12, 0.16, 0.12, { rough: 0.35 }));
    g.add(part(geo.cyl(10), '#fffbe0', 0, 0.465, 0, 0.17, 0.02, 0.17, { emissive: 0xfff6c0, ei: 1.2 }));
    g.add(part(geo.box(), '#d6232a', 0, 0.2, 0.05, 0.035, 0.06, 0.03));         // the switch
    return g;
  },
  /* a pizza box with nothing in it and a rude note */
  decoy() {
    const g = grp();
    g.add(part(geo.box(), '#c79a5b', 0, 0.07, 0, 0.56, 0.11, 0.56));
    g.add(part(geo.box(), '#a87c44', 0, 0.13, 0, 0.58, 0.02, 0.58));
    const s = signMesh(['NOT A', 'PIZZA :P'], 0.34, 0.2, { bg: '#f4efe4', fg: '#d6232a', border: false });
    s.rotation.x = -Math.PI / 2; s.position.set(0, 0.142, 0); g.add(s);
    for (const x of [-0.1, 0.1]) { g.add(part(geo.sph(8, 6), '#ffffff', x, 0.15, 0.2, 0.09, 0.03, 0.09)); g.add(part(geo.sph(6, 4), INK, x + 0.01, 0.165, 0.21, 0.04, 0.02, 0.04)); }
    return g;
  },
  /* a clipboard of very official documents */
  docs() {
    const g = grp();
    g.add(part(geo.box(), '#8a5a33', 0, 0.28, 0, 0.36, 0.48, 0.02));
    g.add(part(geo.box(), '#fbf8f0', 0, 0.27, 0.014, 0.32, 0.42, 0.01));
    for (let i = 0; i < 6; i++) g.add(part(geo.box(), '#9a9ab0', -0.03, 0.4 - i * 0.045, 0.02, 0.2, 0.012, 0.004));
    g.add(part(geo.box(), STEEL, 0, 0.51, 0.02, 0.14, 0.06, 0.02, shiny));
    g.add(rot(part(geo.cyl(10), GOLD, 0.09, 0.13, 0.022, 0.08, 0.01, 0.08, shiny), 'x', Math.PI / 2)); // the seal
    const st = signMesh(['OFFICIAL'], 0.18, 0.06, { bg: '#ffffff', fg: '#d6232a', border: true, borderColor: '#d6232a' });
    st.position.set(-0.05, 0.16, 0.022); st.rotation.z = 0.2; g.add(st);
    return g;
  },
  /* the Suspicious Briefcase: black leather, gold latches, a dollar sticking out, a lid that opens */
  briefcase() {
    const g = grp();
    g.add(part(geo.box(), INK, 0, 0, 0, 0.2, 0.04, 0.05));
    for (const s of [-1, 1]) g.add(part(geo.box(), INK, s * 0.09, -0.04, 0, 0.03, 0.08, 0.04));
    g.add(part(geo.box(), '#2a2230', 0, -0.3, 0, 0.62, 0.44, 0.08, { rough: 0.4 }));
    const lid = new THREE.Group(); lid.position.set(0, -0.08, 0.04); g.add(lid); g.userData.lid = lid;
    lid.add(part(geo.box(), '#2a2230', 0, -0.22, 0.04, 0.62, 0.44, 0.06, { rough: 0.4 }));
    for (const s of [-1, 1]) lid.add(part(geo.box(), GOLD, s * 0.2, -0.02, 0.07, 0.06, 0.04, 0.02, shiny));
    g.add(part(geo.box(), '#43a85a', 0.31, -0.22, 0.02, 0.12, 0.06, 0.1));      // a dollar sticking out
    g.add(part(geo.box(), '#2f8a4a', 0.3, -0.25, 0.02, 0.1, 0.05, 0.09));
    g.add(part(geo.box(), GOLD, 0, -0.52, 0.0, 0.64, 0.02, 0.1, shiny));
    return g;
  },
};

/** a gear model by key: a fresh group with its grip at the origin */
export function makeGear(key) {
  const f = BUILD[key];
  const g = f ? f() : grp(part(geo.box(), '#ff00ff', 0, 0.2, 0, 0.2, 0.4, 0.2));
  g.userData.gear = key;
  return g;
}

/** glasses, a big nose and a mustache, sized for a character's head (or a box) */
export function makeGroucho(s = 1) {
  const g = new THREE.Group();
  for (const x of [-0.13, 0.13]) g.add(part(geo.tor(10), INK, x * s, 0.1 * s, 0, 0.24 * s, 0.24 * s, 0.24 * s));
  g.add(part(geo.box(), INK, 0, 0.1 * s, 0, 0.08 * s, 0.03 * s, 0.03 * s));
  for (const x of [-0.13, 0.13]) g.add(part(geo.box(), INK, x * s, 0.22 * s, 0, 0.22 * s, 0.05 * s, 0.04 * s));   // bushy brows
  g.add(part(geo.ico(1), '#f2a07a', 0, 0.0, 0.07 * s, 0.17 * s, 0.2 * s, 0.22 * s));                           // the nose
  g.add(part(geo.box(), '#1a1410', 0, -0.1 * s, 0.05 * s, 0.36 * s, 0.08 * s, 0.07 * s));                     // the mustache
  return g;
}

/* ---------------- the Time-Out Chair: a hood and handcuffs ---------------- */
/** a black cloth hood, the kind from the movies: sized for a makeChar head (bald, no glasses), y = 0 at the neck */
export function makeHood(hs = 1) {
  const g = new THREE.Group(), CLOTH = '#26232c', o = { rough: 0.95 };
  g.add(part(geo.ico(1), CLOTH, 0, 0.42 * hs, 0.04 * hs, 0.8 * hs, 0.9 * hs, 0.92 * hs, o));
  g.add(part(geo.frust(1.2, 8), CLOTH, 0, 0.06 * hs, 0.02, 0.5 * hs, 0.16, 0.54 * hs, o));       // gathered at the neck
  g.add(part(geo.cyl(10), '#c8b48a', 0, 0.07 * hs, 0.02, 0.56 * hs, 0.035, 0.6 * hs));             // the drawstring
  for (const s of [-1, 1]) g.add(rot(part(geo.box(), '#c8b48a', s * 0.06, -0.02, 0.3 * hs, 0.025, 0.16, 0.025), 'z', s * 0.25)); // its two ends
  // the cloth pulled over the nose, and a mouth-shaped dent that moves when they talk
  g.add(part(geo.ico(0), '#1c1a22', 0, 0.38 * hs, 0.47 * hs, 0.16 * hs, 0.14 * hs, 0.06, o));
  g.userData.mouth = part(geo.sph(8, 6), '#1c1a22', 0, 0.2 * hs, 0.45 * hs, 0.14 * hs, 0.05, 0.05, o); g.add(g.userData.mouth);
  return g;
}
/** one steel cuff for a wrist */
export function makeCuff() {
  const g = new THREE.Group(), steel = { rough: 0.3, metal: 0.7 };
  g.add(rot(part(geo.tor(10), '#b8bcc8', 0, 0, 0, 0.3, 0.3, 0.5, steel), 'x', Math.PI / 2));
  g.add(part(geo.box(), '#8a8e9a', 0.13, 0, 0, 0.06, 0.06, 0.08, steel));                     // the lock
  return g;
}

/* ---------------- security cameras ----------------
   A wall bracket and a camera body on a swivel. userData: head (turns),
   led (red: recording), lens, tape (the "blocked" sticky note), sparks. */
export function makeSecurityCam(color = '#e8e8f0') {
  const g = new THREE.Group(), steel = { rough: 0.35, metal: 0.5 };
  g.add(part(geo.box(), '#5a5a6a', 0, 0, -0.06, 0.16, 0.22, 0.04, steel));          // wall plate
  g.add(rot(part(geo.cyl(6), '#5a5a6a', 0, -0.02, 0.08, 0.05, 0.26, 0.05, steel), 'x', Math.PI / 2)); // arm
  const head = new THREE.Group(); head.position.set(0, -0.06, 0.24); g.add(head); g.userData.head = head;
  head.add(part(geo.box(), color, 0, 0, 0.12, 0.2, 0.18, 0.42, { rough: 0.4 }));
  head.add(part(geo.box(), color, 0, 0.1, 0.16, 0.24, 0.03, 0.48));                   // sun hood
  head.add(rot(part(geo.cyl(10), '#1b1b24', 0, 0, 0.34, 0.15, 0.04, 0.15), 'x', Math.PI / 2));
  const lens = rot(part(geo.cyl(10), '#3a5a8a', 0, 0, 0.36, 0.1, 0.02, 0.1, { rough: 0.1, metal: 0.4, emissive: 0x203a6a, ei: 0.6 }), 'x', Math.PI / 2);
  head.add(lens); g.userData.lens = lens;
  const led = part(geo.ico(0), '#ff2020', 0.07, 0.05, 0.34, 0.04, 0.04, 0.03, { emissive: 0xff2020, ei: 1.6 }); head.add(led); g.userData.led = led;
  const tape = part(geo.box(), '#ffe14a', 0, 0, 0.37, 0.18, 0.16, 0.01); tape.visible = false; head.add(tape); g.userData.tape = tape;
  return g;
}

/** a pizza stand on wheels: umbrella in the gang's colours, a cooler, a sign */
export function makeStand(c1, c2, lines) {
  const g = new THREE.Group();
  g.add(part(geo.box(), c1, 0, 0.6, 0, 1.8, 0.9, 0.9));
  g.add(part(geo.box(), c2, 0, 1.08, 0, 1.9, 0.06, 1.0));
  for (const x of [-0.7, 0.7]) g.add(rot(part(geo.cyl(10), '#1b1b24', x, 0.2, 0.46, 0.4, 0.1, 0.4), 'x', Math.PI / 2));
  g.add(part(geo.cyl(5), '#c8c8d8', 0, 1.1, 0, 0.06, 1.7, 0.06));
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(rot(rot(part(geo.cone(3), i % 2 ? c1 : c2, Math.sin(a) * 0.55, 2.55, Math.cos(a) * 0.55, 1.2, 0.5, 0.35), 'y', a), 'x', 0)); }
  g.add(part(geo.cone(8), c1, 0, 2.5, 0, 2.6, 0.45, 2.6));
  for (let i = 0; i < 3; i++) g.add(part(geo.box(), '#c79a5b', -0.5 + i * 0.32, 1.14, 0.1, 0.3, 0.06 + i * 0.03, 0.3));
  const s = signMesh(lines, 1.6, 0.5, { bg: c2, fg: c1, border: false }); s.position.set(0, 0.62, 0.46); g.add(s);
  return g;
}

/** each gang's prized possession, on a little stand you can steal */
export function makeTrophy(gang) {
  const g = new THREE.Group(), gold = { rough: 0.25, metal: 0.8 };
  if (gang === 'italian') {        // the golden pizza cutter
    g.add(rot(part(geo.cyl(16), '#e8b83a', 0, 0.42, 0, 0.6, 0.05, 0.6, gold), 'x', Math.PI / 2));
    g.add(rot(part(geo.cyl(8), '#c89a2a', 0, 0.42, 0, 0.12, 0.08, 0.12, gold), 'x', Math.PI / 2));
    g.add(rot(part(geo.box(), '#7a1a1a', 0.32, 0.18, 0, 0.1, 0.5, 0.08), 'z', 0.7));
  } else if (gang === 'delivery') { // the golden stopwatch
    g.add(rot(part(geo.cyl(16), '#e8b83a', 0, 0.42, 0, 0.56, 0.14, 0.56, gold), 'x', Math.PI / 2));
    g.add(rot(part(geo.cyl(16), '#f6f1e6', 0, 0.42, 0.075, 0.46, 0.01, 0.46), 'x', Math.PI / 2));
    g.add(part(geo.box(), '#1b1b24', 0, 0.5, 0.085, 0.03, 0.16, 0.01)); g.add(rot(part(geo.box(), '#d6232a', 0.05, 0.45, 0.086, 0.02, 0.12, 0.01), 'z', -1));
    g.add(part(geo.cyl(8), '#e8b83a', 0, 0.75, 0, 0.1, 0.1, 0.1, gold)); g.add(part(geo.tor(10), '#e8b83a', 0, 0.84, 0, 0.14, 0.14, 0.2, gold));
  } else {                          // an ice sculpture of a pizza slice
    const ice = { rough: 0.05, opacity: 0.75, emissive: 0x6ac8ff, ei: 0.3 };
    g.add(part(geo.cone(3), '#bfe8ff', 0, 0.45, 0, 0.7, 0.75, 0.16, ice));
    for (const [x, y] of [[-0.12, 0.35], [0.1, 0.48], [0, 0.25]]) g.add(part(geo.cyl(8), '#8ad0ff', x, y, 0.07, 0.12, 0.02, 0.12, ice));
  }
  g.add(part(geo.cyl(8), '#2b2b33', 0, 0.04, 0, 0.5, 0.08, 0.5));
  return g;
}

/* ---------------- the big black trash bag ----------------
   A lumpy icosphere: every corner pushed in or out a little (the same amount
   wherever the same corner appears, so the plastic stays in one piece),
   sagging and fat at the bottom, gathered into a twisted neck and a knot
   with two ears at the top. */
let BAG_GEO = null;
function bagGeometry() {
  if (BAG_GEO) return BAG_GEO;
  const geom = new THREE.IcosahedronGeometry(0.5, 2);
  const p = geom.attributes.position, v = new THREE.Vector3();
  const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 0.88 + hash(+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)) * 0.24;   // wrinkles
    v.multiplyScalar(k);
    const t = (v.y + 0.5);                                   // 0 at the bottom, 1 at the top
    const fat = 1.18 - 0.55 * Math.pow(Math.max(0, t - 0.45) / 0.55, 1.6);   // fat bottom, gathered top
    v.x *= fat; v.z *= fat;
    if (v.y < -0.3) v.y = -0.3 - (v.y + 0.3) * 0.35;         // the bottom sags flat on the ground
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geom.computeVertexNormals();
  return (BAG_GEO = geom);
}
const BAG = '#1d1d24';
export function makeTrashBag() {
  const g = new THREE.Group();
  const plastic = mat(BAG, { rough: 0.28, metal: 0.18 });
  const body = new THREE.Mesh(bagGeometry(), plastic); body.castShadow = true;
  body.position.y = 0.52; body.scale.set(1.0, 1.1, 0.88); g.add(body); g.userData.body = body;
  // a few creases catching the light
  for (const [x, y, z, r] of [[-0.22, 0.55, 0.36, 0.5], [0.18, 0.35, 0.38, -0.7], [0.3, 0.7, 0.2, 0.9], [-0.35, 0.3, 0.1, -0.3]]) g.add(rot(part(geo.box(), '#3a3a48', x, y, z, 0.03, 0.26, 0.02, { rough: 0.25, metal: 0.2 }), 'z', r));
  // the gathered neck, twisted, with the yellow drawstring
  const neck = new THREE.Group(); neck.position.y = 1.06; g.add(neck); g.userData.neck = neck;
  neck.add(rot(part(geo.frust(0.35, 7), BAG, 0, 0.07, 0, 0.32, 0.18, 0.3, { rough: 0.28, metal: 0.18 }), 'y', 0.4));
  neck.add(part(geo.tor(10), '#ffd23f', 0, 0.06, 0, 0.26, 0.26, 0.5));
  neck.add(part(geo.ico(1), BAG, 0, 0.18, 0, 0.16, 0.13, 0.15, { rough: 0.28, metal: 0.18 }));           // the knot
  for (const s of [-1, 1]) neck.add(rot(part(geo.cone(5), BAG, s * 0.12, 0.28, 0, 0.1, 0.24, 0.05, { rough: 0.28, metal: 0.18 }), 'z', -s * 0.75)); // two ears
  // somebody's shoes poke out of the bottom
  for (const x of [-0.16, 0.16]) g.add(part(geo.box(), '#4a3020', x, 0.04, 0.42, 0.16, 0.1, 0.24));
  g.userData.wiggle = true;
  return g;
}
