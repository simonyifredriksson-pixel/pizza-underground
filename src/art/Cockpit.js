/* Cockpit.js - what you see from the driver's seat in first person:
   dashboard, steering wheel with your hands on it, speedometer, the
   windshield frame, roof, mirrors and the hood. Built in the car's own
   coordinates, laid out around where your eyes are, so it fits every car. */
import * as THREE from '../../lib/three.module.js';
import { part, geo, mat, rot } from './Mesher.js';

const DARK = '#4a4a56', DARK2 = '#5c5c6a', TRIM = '#74748a', HEAD = '#d8d2c4', MIRROR = '#a8c8e0';

/** a box from point a to point b (in y/z), w wide in x */
function strut(x, ay, az, by, bz, w, d, color) {
  const dy = by - ay, dz = bz - az, len = Math.hypot(dy, dz);
  return rot(part(geo.box(), color, x, (ay + by) / 2, (az + bz) / 2, w, len, d), 'x', Math.atan2(dz, dy));
}

export function makeCockpit(C, look) {
  const S = C.S, L = S.len, W = S.wid, seat = C.seats[0];
  const g = new THREE.Group();
  // the same cabin numbers as makeCar
  let top, roof, cabL, cabZ;
  if (S.pickup || S.cargo) {
    const cabH = S.cargo ? 1.9 : 1.55; cabL = S.cargo ? 2.2 : L * 0.42; cabZ = L / 2 - cabL / 2 - 0.1;
    top = 0.35 + cabH * 0.48; roof = 0.35 + cabH;
  } else {
    const bodyH = S.h * 0.55, cabH = S.van ? S.h - bodyH : S.cab;
    cabL = S.van ? L * 0.95 : L * 0.55; cabZ = S.van ? -L * 0.02 : -L * 0.06;
    top = 0.35 + bodyH; roof = top + (S.open ? cabH * 0.62 : cabH);
  }
  const eyeY = seat.y - 0.35 + 1.28, ez = seat.z;
  roof = Math.max(roof, eyeY + 0.3);
  const dashTop = eyeY - 0.38;
  const zl = ez + 0.6;                                                   // the edge of the dash nearest you
  const zf = Math.max(zl + 0.35, Math.min(cabZ + cabL / 2 + 0.1, ez + 1.15)); // where the windshield meets it
  const zb = cabZ - cabL / 2;                                            // back of the cabin
  const belt = Math.min(top, dashTop + 0.06);                            // the window line
  const hw = W * 0.44;                                                   // inner half width
  const body = S.body, roofC = S.roof || S.body;

  // dashboard: a long block with a lip in front of you
  g.add(part(geo.box(), DARK, 0, dashTop - 0.25, (zl + zf) / 2, hw * 2, 0.5, zf - zl));
  g.add(part(geo.box(), TRIM, 0, dashTop - 0.015, zl - 0.01, hw * 2, 0.04, 0.04));
  g.add(part(geo.box(), DARK2, 0, dashTop - 0.2, zl - 0.005, hw * 2 - 0.1, 0.04, 0.02));
  // gauge cluster: a hood with two round dials (speed, and "panic")
  const gx = seat.x, gz = zl + 0.1;
  g.add(part(geo.box(), DARK2, gx, dashTop + 0.06, gz + 0.06, 0.42, 0.14, 0.2));
  const dials = [];
  for (const [i, s] of [[0, 1], [1, -1]]) {
    const dx = gx + s * 0.095, dy = dashTop + 0.06, dz = gz - 0.045;
    g.add(rot(part(geo.cyl(12), '#2b2b33', dx, dy, dz, 0.16, 0.02, 0.16), 'x', Math.PI / 2));
    g.add(rot(part(geo.cyl(12), i ? '#ffe9b0' : '#f6f1e6', dx, dy, dz - 0.012, 0.135, 0.01, 0.135, { emissive: i ? 0xffc040 : 0xfff2d0, ei: 0.45 }), 'x', Math.PI / 2));
    for (let k = 0; k <= 6; k++) { const a = -2.2 + k * (4.4 / 6); g.add(rot(part(geo.box(), '#1b1b24', dx - Math.sin(a) * 0.054, dy + Math.cos(a) * 0.054, dz - 0.019, 0.008, 0.02, 0.004), 'z', a)); }
    const pivot = new THREE.Group(); pivot.position.set(dx, dy, dz - 0.022);
    pivot.add(part(geo.box(), '#e8323a', 0, 0.026, 0, 0.01, 0.055, 0.005, { emissive: 0xff2020, ei: 0.5 }));
    pivot.add(rot(part(geo.cyl(6), '#1b1b24', 0, 0, 0, 0.025, 0.01, 0.025), 'x', Math.PI / 2));
    g.add(pivot); dials.push(pivot);
  }
  // centre stack with a radio that only plays smooth jazz, and the console between the seats
  g.add(part(geo.box(), DARK2, 0, dashTop - 0.2, zl + 0.04, 0.34, 0.3, 0.1));
  g.add(part(geo.box(), '#43e07a', 0, dashTop - 0.12, zl - 0.012, 0.22, 0.06, 0.01, { emissive: 0x20ff60, ei: 0.8 }));
  for (const s of [-1, 1]) g.add(part(geo.box(), '#2b2b33', s * 0.07, dashTop - 0.26, zl - 0.012, 0.08, 0.05, 0.01));
  g.add(part(geo.box(), DARK, 0, seat.y + 0.05, (ez + zl) / 2, 0.3, 0.3, Math.max(0.2, zl - ez)));
  g.add(part(geo.box(), '#2b2b33', 0, seat.y + 0.22, (ez + zl) / 2 + 0.05, 0.06, 0.12, 0.06));

  // the steering wheel: column, rim, three spokes; spins with your steering
  const wy = eyeY - 0.34, wz = ez + 0.47;
  g.add(strut(gx, wy - 0.03, wz + 0.04, dashTop - 0.14, zl + 0.06, 0.07, 0.07, '#2b2b33'));
  const tilt = new THREE.Group(); tilt.position.set(gx, wy, wz); tilt.rotation.x = 0.35; g.add(tilt);
  const wheel = new THREE.Group(); tilt.add(wheel);
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.026, 5, 14), mat('#1f1f28')));
  wheel.add(rot(part(geo.cyl(8), '#2b2b33', 0, 0, 0.01, 0.12, 0.06, 0.12), 'x', Math.PI / 2));
  wheel.add(part(geo.box(), '#ffd23f', 0, 0, -0.025, 0.05, 0.05, 0.01, { emissive: 0xffc040, ei: 0.3 }));
  for (const a of [0, Math.PI, -Math.PI / 2]) wheel.add(rot(part(geo.box(), '#2b2b33', Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0.005, 0.2, 0.035, 0.02), 'z', a));
  // your hands at ten and two, with a bit of sleeve
  const hands = new THREE.Group(); wheel.add(hands);
  const skin = look?.skin || '#f2c29b', sleeve = look?.shirt || '#d23a3a';
  for (const s of [-1, 1]) {
    const hx = s * 0.16, hy = 0.12;
    hands.add(part(geo.ico(0), skin, hx, hy, -0.015, 0.065, 0.085, 0.065));
    hands.add(rot(part(geo.box(), skin, hx + s * 0.02, hy - 0.05, -0.08, 0.055, 0.055, 0.12), 'x', -0.7));
    hands.add(rot(part(geo.box(), sleeve, hx + s * 0.04, hy - 0.12, -0.2, 0.08, 0.08, 0.2), 'x', -0.8));
  }

  // windshield frame: A-pillars and the header
  const zh = zf - (roof - dashTop) * 0.55;
  for (const s of [-1, 1]) g.add(strut(s * (hw - 0.03), dashTop - 0.02, zf + 0.02, roof - 0.02, zh, 0.09, 0.11, roofC));
  g.add(part(geo.box(), roofC, 0, roof - 0.03, zh, hw * 2, 0.07, 0.1));
  if (!S.open) {
    g.add(part(geo.box(), HEAD, 0, roof + 0.01, (zh + zb) / 2, hw * 2 + 0.1, 0.05, zh - zb));
    // sun visors folded up, and the rear-view mirror
    for (const s of [-1, 1]) g.add(rot(part(geo.box(), HEAD, s * hw * 0.5, roof - 0.05, zh - 0.13, hw * 0.75, 0.03, 0.2), 'x', 0.12));
    g.add(part(geo.box(), '#2b2b33', 0, roof - 0.07, zh - 0.06, 0.03, 0.09, 0.03));
    g.add(part(geo.box(), '#2b2b33', 0, roof - 0.13, zh - 0.08, 0.3, 0.085, 0.04));
    g.add(part(geo.box(), MIRROR, 0, roof - 0.13, zh - 0.102, 0.27, 0.065, 0.01, { emissive: 0x405870, ei: 0.4 }));
    // B-pillars just behind you
    for (const s of [-1, 1]) g.add(part(geo.box(), roofC, s * hw, (belt + roof) / 2, ez - 0.55, 0.1, roof - belt, 0.14));
  } else {
    g.add(part(geo.box(), '#2b2b33', 0, roof - 0.1, zh - 0.05, 0.3, 0.08, 0.04));
    g.add(part(geo.box(), MIRROR, 0, roof - 0.1, zh - 0.072, 0.26, 0.055, 0.01, { emissive: 0x405870, ei: 0.4 }));
  }
  // doors: a panel each side up to the window line, with an armrest
  for (const s of [-1, 1]) {
    const dh = belt - seat.y + 0.3;
    g.add(part(geo.box(), body, s * (hw + 0.06), belt - dh / 2, (zf + zb) / 2, 0.06, dh, zf - zb));
    g.add(part(geo.box(), TRIM, s * (hw - 0.01), belt - 0.25, (zf + zb) / 2, 0.06, 0.4, zf - zb - 0.1));
    g.add(part(geo.box(), DARK2, s * (hw - 0.07), seat.y + 0.2, ez + 0.1, 0.1, 0.06, 0.6));
    g.add(part(geo.box(), body, s * (hw + 0.03), belt + 0.01, (zf + zb) / 2, 0.1, 0.04, zf - zb));
    // side mirrors outside the glass
    const mx = s * (W / 2 + 0.14), my = belt + 0.12, mz = zf - 0.1;
    g.add(part(geo.box(), body, s * (W / 2 + 0.04), my - 0.05, mz + 0.02, 0.1, 0.05, 0.08));
    g.add(part(geo.box(), body, mx, my, mz, 0.2, 0.15, 0.1));
    g.add(part(geo.box(), MIRROR, mx, my, mz - 0.052, 0.16, 0.12, 0.01, { emissive: 0x405870, ei: 0.4 }));
  }
  // the hood out front (not on vans and trucks: those have flat faces)
  if (!S.van && !S.cargo) {
    const hz = L / 2 - zf, hy = Math.min(top - 0.04, dashTop - 0.08);
    if (hz > 0.3) {
      g.add(rot(part(geo.box(), body, 0, hy, zf + hz / 2, W * 0.96, 0.08, hz), 'x', 0.04));
      if (S.stripes) for (const s of [-0.18, 0.18]) g.add(rot(part(geo.box(), S.stripes, s, hy + 0.045, zf + hz / 2, 0.16, 0.02, hz), 'x', 0.04));
    }
  } else g.add(part(geo.box(), body, 0, dashTop - 0.1, zf + 0.12, W * 0.96, 0.25, 0.2));
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  return { group: g, wheel, hands, dials, eyeY };
}
