/* Citizens.js - the people of Crumbville. Local to each player (they are
   scenery), but if one of them sees YOU carrying pizza they either cheer you
   on or report you, and a report reaches the host: more heat, and a cop
   comes to have a look. */
import * as THREE from '../../lib/three.module.js';
import { makeChar, SKINS } from '../art/Chars.js';
import { makeDog } from '../art/LifeArt.js';
import { geo, part } from '../art/Mesher.js';
import { ROADS } from '../world/Town.js';
import { BARK } from '../data/Data.js';
import { NERVOUS } from '../data/Mafia.js';

const INNOCENT = ['Nice weather today.', 'Have you been to the new mall?', 'My cat is judging me again.', 'Is it Tuesday? It feels like a Tuesday.', 'I had bread for dinner. Again. Just bread.', 'Don\'t... don\'t say the word. Never mind.', 'Mmm. Round things. ...Sorry, what?', 'The mayor\'s been weird lately.', 'Crumbville! What a town.'];
import { isContraband } from './State.js';
import { pick, rand, dampAngle } from '../core/Util.js';

const NODES = [];
for (const x of ROADS) for (const z of ROADS) for (const sx of [-1, 1]) for (const sz of [-1, 1]) NODES.push({ x: x + sx * 8, z: z + sz * 8 });
for (const n of NODES) n.nb = NODES.filter(m => m !== n && ((m.x === n.x && Math.abs(m.z - n.z) <= 64) || (m.z === n.z && Math.abs(m.x - n.x) <= 64)));

const SHIRTS = ['#f7a8c8', '#8fc1e3', '#f7d26b', '#a8e0c0', '#c9a8f0', '#ffb88a', '#e8e8f0', '#5a8a5a', '#d23a3a', '#3a3048'];
const PANTS = ['#2b2b38', '#3a5a9a', '#5a4a3a', '#7a7a8a', '#3a3048'];
const HATS = ['default', 'default', 'beanie', 'cap', 'bald', 'fedora', 'default'];
const DOG_LINES = ['He\'s friendly! ...Mostly.', 'Don\'t let him smell your hands. He knows things.', 'Her name is Biscuit. She ate a whole loaf yesterday.', 'He only bites cops. Good boy.', 'SIT. Sit. ...Okay, stand. Whatever you want.'];
const BAG_COLORS = [['#c8a070', '#3fa34d'], ['#ffffff', '#d6232a'], ['#ff8fc8', '#ffffff'], ['#3a7bd5', '#ffd23f']];
/** a shopping bag in the hand: paper or plastic, something sticking out of it */
function shoppingBag(i) {
  const [c, s] = BAG_COLORS[i % BAG_COLORS.length], g = new THREE.Group();
  g.add(part(geo.box(), c, 0, -0.32, 0, 0.36, 0.42, 0.2));
  g.add(part(geo.box(), s, 0, -0.3, 0.105, 0.2, 0.14, 0.01));
  g.add(part(geo.box(), '#5a5a6a', 0, -0.06, 0, 0.03, 0.12, 0.03));
  if (i % 3 === 0) g.add(part(geo.cyl(6), '#d8a050', 0.06, -0.02, 0, 0.08, 0.5, 0.08));   // a baguette
  else if (i % 3 === 1) g.add(part(geo.ico(0), '#43a85a', -0.05, -0.08, 0, 0.22, 0.16, 0.16));  // leafy greens
  g.position.set(0, -0.62, 0);
  return g;
}

export class Citizens {
  constructor(game, n = 26) {
    this.g = game; this.list = [];
    for (let i = 0; i < n; i++) {
      const look = { skin: pick(SKINS), shirt: pick(SHIRTS), pants: pick(PANTS), hat: pick(HATS), hatColor: pick(SHIRTS), hair: pick(['#2a1a14', '#5a3a1a', '#c8742a', '#e0c070', '#e0e0e0', '#1a1410']), hairStyle: pick(['', '', 'big', 'bun', 'spiky']), belly: rand(0.9, 1.3), glasses: Math.random() < 0.2 ? 'round' : null, mustache: Math.random() < 0.2, headSize: rand(0.95, 1.1) };
      const rig = makeChar(look);
      const node = pick(NODES);
      const c = { rig, x: node.x + rand(-3, 3), z: node.z + rand(-3, 3), yaw: 0, node: pick(node.nb), wait: rand(0, 4), speed: rand(1.6, 2.4), barkT: rand(0, 10), seenT: 0, mood: Math.random() < 0.4 ? 'snitch' : 'fan', fly: null, panic: 0 };
      game.scene.add(rig.root);
      // some walk a dog on a leash, some carry their shopping
      if (i % 5 === 1) {
        c.dog = makeDog(i); c.dog.x = c.x - 1; c.dog.z = c.z; c.dog.yaw = 0; game.scene.add(c.dog.root);
        const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
        c.leash = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: '#8a2a2a' })); c.leash.frustumCulled = false; game.scene.add(c.leash);
        c.speed = Math.min(c.speed, 1.8);
      } else if (i % 3 === 0) rig.armL.add(shoppingBag(i));
      else if (i % 7 === 2) { rig.armL.add(shoppingBag(i)); rig.armR.add(shoppingBag(i + 1)); }
      this.list.push(c);
    }
  }
  update(dt) {
    const g = this.g, P = g.player, col = g.town.col;
    const H = g.hold(g.me);
    const contra = !P.car && !P.hidden && P.floor === 0 && H.some(isContraband);
    const lc = g.vehicles.local;
    for (const c of this.list) {
      // flying (hit by your car)
      if (c.fly) {
        c.fly.vy -= 24 * dt; c.x += c.fly.vx * dt; c.z += c.fly.vz * dt; c.fly.y += c.fly.vy * dt;
        c.rig.root.rotation.x += dt * 10;
        if (c.fly.y <= 0) { c.fly = null; c.rig.root.rotation.x = 0; c.panic = 3; g.audio.thud({ x: c.x, z: c.z }); }
        c.rig.root.position.set(c.x, c.fly ? c.fly.y : 0.04, c.z);
        c.rig.anim(dt, { panic: 1 });
        continue;
      }
      const d = Math.hypot(P.pos.x - c.x, P.pos.z - c.z);
      if (d > 120) { c.rig.root.visible = false; continue; }
      c.rig.root.visible = true;
      if (lc && Math.hypot(lc.x - c.x, lc.z - c.z) < 2 && Math.abs(lc.spd) > 6) {
        c.fly = { vx: Math.sin(lc.yaw) * lc.spd * 0.7, vz: Math.cos(lc.yaw) * lc.spd * 0.7, vy: 9, y: 0.1 };
        g.audio.scream({ x: c.x, z: c.z }); g.bubble(() => ({ x: c.x, z: c.z }), pick(['AAAAAAA', 'MY SPINE!', 'WHAT THE HELL, MAN?!', 'I\'M OKAY!']));
        g.act({ k: 'report', x: c.x, z: c.z, small: 1 });
        continue;
      }
      let moving = false;
      if (c.panic > 0) {
        c.panic -= dt;
        const ax = c.x - P.pos.x, az = c.z - P.pos.z, l = Math.hypot(ax, az) || 1;
        c.x += ax / l * 5 * dt; c.z += az / l * 5 * dt; c.yaw = Math.atan2(ax, az); moving = true;
      } else if (c.wait > 0) c.wait -= dt;
      else {
        const dx = c.node.x - c.x, dz = c.node.z - c.z, l = Math.hypot(dx, dz);
        if (l < 1.5) { c.node = pick(c.node.nb); if (Math.random() < 0.3) c.wait = rand(2, 6); }
        else { c.x += dx / l * c.speed * dt; c.z += dz / l * c.speed * dt; c.yaw = dampAngle(c.yaw, Math.atan2(dx, dz), 6, dt); moving = true; }
      }
      const r = col.resolve(c.x, c.z, 0.35, 0, 0); c.x = r.x; c.z = r.z;
      // react to the player
      c.barkT -= dt; c.seenT -= dt;
      let talk = false, look = false;
      if (d < 9 && contra && c.seenT <= 0 && !col.blocked(c.x, c.z, P.pos.x, P.pos.z, 0)) {
        c.seenT = 25;
        if (c.mood === 'snitch' && !g.natural) {
          g.bubble(() => ({ x: c.x, z: c.z }), pick(BARK.citizenSee));
          g.act({ k: 'report', x: P.pos.x, z: P.pos.z });
          c.panic = 2;
        } else g.bubble(() => ({ x: c.x, z: c.z }), pick(BARK.citizenFan));
        talk = true;
      } else if (d < 5 && c.barkT <= 0) {
        c.barkT = rand(18, 35);
        const nervous = g.debts.tier >= 2 && Math.random() < 0.3 + g.debts.tier * 0.1;
        // before you know about the ban, people talk about anything else (and are a bit weird about food)
        const pre = g.W.quest < 4;
        g.bubble(() => ({ x: c.x, z: c.z }), pick(c.dog && !nervous && Math.random() < 0.6 ? DOG_LINES : pre ? INNOCENT : nervous ? NERVOUS : BARK.citizenIdle));
        if (nervous) c.panic = 0.8;
      }
      if (d < 6 && !moving) { c.yaw = dampAngle(c.yaw, Math.atan2(P.pos.x - c.x, P.pos.z - c.z), 4, dt); look = true; }
      c.rig.root.position.set(c.x, 0.04, c.z); c.rig.root.rotation.y = c.yaw;
      c.rig.anim(dt, { speed: moving ? (c.panic > 0 ? 5 : c.speed) : 0, panic: c.panic > 0 ? 1 : 0, talk });
      if (c.dog) this._dog(c, dt, look);
    }
    for (const c of this.list) if (c.dog) { const v = c.rig.root.visible; c.dog.root.visible = v; c.leash.visible = v; }
  }
  /** the dog trots a little ahead and to the side, sniffs about when its owner stops */
  _dog(c, dt, owner) {
    const D = c.dog, s = Math.sin(c.yaw), co = Math.cos(c.yaw);
    const sniff = Math.sin(performance.now() / 1700 + c.speed * 9);
    const tx = c.x + s * 1.1 + co * 0.7 + (owner ? 0 : sniff * 0.4), tz = c.z + co * 1.1 - s * 0.7;
    const dx = tx - D.x, dz = tz - D.z, l = Math.hypot(dx, dz);
    const sp = l > 0.15 ? Math.min(6, l * 3) : 0;
    if (sp) { D.x += dx / l * sp * dt; D.z += dz / l * sp * dt; D.yaw = dampAngle(D.yaw, Math.atan2(dx, dz), 8, dt); }
    D.root.position.set(D.x, 0.02, D.z); D.root.rotation.y = D.yaw;
    D.anim(dt, sp);
    // the leash: from the owner's left hand to the collar
    const hx = c.x + co * -0.5 + s * 0.15, hz = c.z - s * -0.5 + co * 0.15;
    const n = D.neck(), nx = D.x + Math.sin(D.yaw) * n.z, nz = D.z + Math.cos(D.yaw) * n.z;
    const p = c.leash.geometry.attributes.position;
    p.setXYZ(0, hx, 0.85, hz); p.setXYZ(1, nx, n.y + 0.02, nz); p.needsUpdate = true;
  }
}
