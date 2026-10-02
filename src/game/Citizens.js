/* Citizens.js - the people of Crumbville. Local to each player (they are
   scenery), but if one of them sees YOU carrying pizza they either cheer you
   on or report you, and a report reaches the host: more heat, and a cop
   comes to have a look. */
import { makeChar, SKINS } from '../art/Chars.js';
import { ROADS } from '../world/Town.js';
import { BARK } from '../data/Data.js';
import { isContraband } from './State.js';
import { pick, rand, dampAngle } from '../core/Util.js';

const NODES = [];
for (const x of ROADS) for (const z of ROADS) for (const sx of [-1, 1]) for (const sz of [-1, 1]) NODES.push({ x: x + sx * 8, z: z + sz * 8 });
for (const n of NODES) n.nb = NODES.filter(m => m !== n && ((m.x === n.x && Math.abs(m.z - n.z) <= 64) || (m.z === n.z && Math.abs(m.x - n.x) <= 64)));

const SHIRTS = ['#f7a8c8', '#8fc1e3', '#f7d26b', '#a8e0c0', '#c9a8f0', '#ffb88a', '#e8e8f0', '#5a8a5a', '#d23a3a', '#3a3048'];
const PANTS = ['#2b2b38', '#3a5a9a', '#5a4a3a', '#7a7a8a', '#3a3048'];
const HATS = ['default', 'default', 'beanie', 'cap', 'bald', 'fedora', 'default'];

export class Citizens {
  constructor(game, n = 26) {
    this.g = game; this.list = [];
    for (let i = 0; i < n; i++) {
      const look = { skin: pick(SKINS), shirt: pick(SHIRTS), pants: pick(PANTS), hat: pick(HATS), hatColor: pick(SHIRTS), hair: pick(['#2a1a14', '#5a3a1a', '#c8742a', '#e0c070', '#e0e0e0', '#1a1410']), hairStyle: pick(['', '', 'big', 'bun', 'spiky']), belly: rand(0.9, 1.3), glasses: Math.random() < 0.2 ? 'round' : null, mustache: Math.random() < 0.2, headSize: rand(0.95, 1.1) };
      const rig = makeChar(look);
      const node = pick(NODES);
      const c = { rig, x: node.x + rand(-3, 3), z: node.z + rand(-3, 3), yaw: 0, node: pick(node.nb), wait: rand(0, 4), speed: rand(1.6, 2.4), barkT: rand(0, 10), seenT: 0, mood: Math.random() < 0.4 ? 'snitch' : 'fan', fly: null, panic: 0 };
      game.scene.add(rig.root);
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
        g.bubble(() => ({ x: c.x, z: c.z }), pick(BARK.citizenIdle));
      }
      if (d < 6 && !moving) { c.yaw = dampAngle(c.yaw, Math.atan2(P.pos.x - c.x, P.pos.z - c.z), 4, dt); look = true; }
      c.rig.root.position.set(c.x, 0.04, c.z); c.rig.root.rotation.y = c.yaw;
      c.rig.anim(dt, { speed: moving ? (c.panic > 0 ? 5 : c.speed) : 0, panic: c.panic > 0 ? 1 : 0, talk });
    }
  }
}
