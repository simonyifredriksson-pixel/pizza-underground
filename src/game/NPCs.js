/* NPCs.js - everyone who stands somewhere and talks: the underground
   suppliers (half of them are toppings), Oleg, Honest Hank, Madame
   Moustache, the Suspicious Man, Dez, the archive guard, the mayor. Plus
   the clue papers lying around town. Talking opens dialogue and shops on
   the local screen; buying goes to the host as an action. */
import * as THREE from '../../lib/three.module.js';
import { makeChar, makeCritter } from '../art/Chars.js';
import { makeClue } from '../art/Props.js';
import { SUPPLIERS, STOCK_NAME, VEHICLES, DISGUISES, CLUES, DEZ_LOOK, DEZ, HQ_LEVELS, UPGRADES } from '../data/Data.js';
import { SPEAKERS, OLEG, HANK, STACHE, GUARD, MAN_WAIT, Q } from '../data/Story.js';
import { HQ } from '../world/Town.js';
import { TIERS } from '../data/Mafia.js';
import { pick, money, dampAngle, rand } from '../core/Util.js';

const COLORS = { doug: '#f1dfb8', tony: '#ff6b6b', cheese: '#ffd447', sal: '#e07a6a', funguy: '#ff8a7a', pete: '#f6cf3a', olive: '#a8c88a', larry: '#ff8fc8' };

export class NPCs {
  constructor(game) {
    this.g = game;
    this.list = [];  // { key, rig, x, z, ry, show(), label }
    const T = game.town;
    T.poi.olive = T.poi.olive || { x: 160, z: 131 };
    for (const [key, s] of Object.entries(SUPPLIERS)) {
      SPEAKERS[key] = { name: s.name, color: COLORS[key] || '#ffffff' };
      const rig = s.critter ? makeCritter(s.critter, { ...(s.opts || {}), scale: 1.25 }) : makeChar(s.human);
      const p = T.poi[s.poi];
      this.add(key, rig, p.x, p.z, 'Talk to ' + s.name, () => this.supplier(key), () => this.g.W.quest >= Q.FIND);
    }
    const human = (look) => makeChar(look);
    this.add('man', human({ hat: 'fedora', coat: '#8a6a4a', glasses: 'sun', skin: '#e0a57c', hair: '#2a1a14' }), T.poi.manSpot.x, T.poi.manSpot.z, 'Talk to the Suspicious Man', () => this.g.story.talkMan(), () => this.g.W.quest >= Q.LEAVE);
    this.add('oleg', human({ hat: 'bald', shirt: '#3a7bd5', pants: '#2b2b38', mustache: true, belly: 1.3, skin: '#f2c29b', beard: '#5a3a1a' }), T.poi.oleg.x, T.poi.oleg.z, "Talk to Oleg (ovens)", () => this.oleg(), () => this.g.W.quest >= Q.TOWN);
    this.add('stache', human({ hat: 'default', hairStyle: 'big', hair: '#c84a8a', shirt: '#2a1640', pants: '#2a1640', mustache: '#2a1a14', skin: '#f7d6b8', glasses: 'round' }), T.poi.mustache.x, T.poi.mustache.z, 'Talk to Madame Moustache (disguises)', () => this.stache(), () => this.g.W.quest >= Q.TOWN);
    this.add('hank', human({ hat: 'cowboy', shirt: '#ffcf33', pants: '#3a5a9a', skin: '#e0a57c', mustache: true, tie: '#d6232a', belly: 1.2 }), T.poi.hank.x, T.poi.hank.z, 'Talk to Honest Hank (vehicles)', () => this.hank(), () => this.g.W.quest >= Q.TOWN);
    SPEAKERS.hank.name = 'Honest Hank';
    // dez lives in the hideout once you find it
    this.dez = this.add('dez', makeChar(DEZ_LOOK), 146, 82, 'Talk to Dez', () => this.dezTalk(), () => this.g.W.quest >= Q.CLEAN);
    this.dez.wander = { tx: 146, tz: 82, t: 3 };
    // the archive guard is a Town prop: give him a talk target
    const gp = T.poi.archiveGuard;
    this.list.push({ key: 'guard', rig: gp.rig, x: gp.x, z: gp.z, ry: gp.ry, label: 'Talk to the guard', talk: () => this.guard(), show: () => true, home: { x: gp.x, z: gp.z } });
    this.mayor = this.add('mayor', makeChar({ hat: 'crown', shirt: '#f6f1e6', pants: '#3a3048', tie: '#d6232a', mustache: '#e0e0e0', hair: '#e0e0e0', belly: 1.4, skin: '#f2c29b' }), T.poi.cityHallDoor.x, T.poi.cityHallDoor.z - 1.5, '', null, () => this.g.W.quest >= Q.EMPIRE || this.mayorOut);
    this.mayor.ry = 0;
    this.mayorOut = false;
    // clues
    this.clues = new Map();
    for (const c of CLUES) {
      if (c.id === 'archive') continue;
      const p = T.poi[c.poi];
      const m = makeClue(); m.position.set(p.x, (p.y || 1.2) + 0.2, p.z); game.scene.add(m);
      this.clues.set(c.id, { m, c, x: p.x, z: p.z });
    }
  }

  add(key, rig, x, z, label, talk, show) {
    rig.root.position.set(x, 0.05, z);
    this.g.scene.add(rig.root);
    const n = { key, rig, x, z, ry: 0, label, talk, show, home: { x, z } };
    this.list.push(n);
    return n;
  }
  get(key) { return this.list.find(n => n.key === key); }

  update(dt) {
    const g = this.g, W = g.W, P = g.player;
    const ev = W.event;
    for (const n of this.list) {
      const vis = n.show();
      n.rig.root.visible = vis;
      if (!vis) continue;
      // big cheese wanders off during "the cheese supplier is missing"
      if (n.key === 'cheese') { const away = ev && ev.k === 'cheeseMissing' && ev.at; n.x = away ? ev.at.x : n.home.x; n.z = away ? ev.at.z : n.home.z; }
      if (n.key === 'dez') this._dez(n, dt);
      // the Suspicious Man spots you and sidles over (only before he has made his offer)
      if (n.key === 'man') {
        const dp = Math.hypot(P.pos.x - n.x, P.pos.z - n.z);
        const tx = W.quest === Q.TOWN && dp < 24 && P.floor === 0 && !P.car ? P.pos.x : n.home.x, tz = W.quest === Q.TOWN && dp < 24 && P.floor === 0 && !P.car ? P.pos.z : n.home.z;
        const dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz), stop = tx === n.home.x ? 0.2 : 2.4;
        n.walking = d > stop;
        if (n.walking) { const s = Math.min(d - stop, 2.6 * dt); n.x += dx / d * s; n.z += dz / d * s; n.ry = Math.atan2(dx, dz); }
      }
      const d = Math.hypot(P.pos.x - n.x, P.pos.z - n.z);
      const talking = g.ui.talking === n.key;
      let want = n.ry;
      if (d < 7 && !n.walking) want = Math.atan2(P.pos.x - n.x, P.pos.z - n.z);
      n.yaw = dampAngle(n.yaw ?? n.ry, want, 5, dt);
      const y = n.key === 'dez' && n.floor === 1 ? HQ.base.y + 0.05 : 0.05;
      n.rig.root.position.set(n.x, y, n.z); n.rig.root.rotation.y = n.yaw;
      n.rig.anim(dt, { speed: n.walking ? 2 : 0, talk: talking, wave: !talking && d < 5 && d > 2.5 && n.key !== 'guard' && n.key !== 'man', panic: n.panic ? 1 : 0 });
    }
    // dez barks now and then
    if (W.quest >= Q.BIZ) {
      W.dezT = (W.dezT || 60) - dt;
      if (W.dezT <= 0 && Math.hypot(P.pos.x - this.dez.x, P.pos.z - this.dez.z) < 14) { W.dezT = rand(50, 90); g.bubble('dez', pick(DEZ.idle)); }
    }
    // clues: spin, hide once found
    for (const [id, c] of this.clues) {
      c.m.visible = !W.clues.includes(id) && W.quest >= Q.BIZ;
      c.m.rotation.y += dt * 1.5;
      c.m.position.y = 1.4 + Math.sin(performance.now() * 0.003) * 0.15;
    }
  }

  _dez(n, dt) {
    const w = n.wander;
    w.t -= dt;
    const busy = this.g.ui.talking === 'dez';
    if (w.t <= 0 && !busy) {
      w.t = rand(4, 9);
      const lvl = this.g.W.level;
      const spots = [[146, 82], [144, 78], [148, 84], [150, 80]];
      if (lvl >= 2) spots.push([158, 82], [160, 78]);
      const s = pick(spots); w.tx = s[0]; w.tz = s[1];
    }
    const dx = w.tx - n.x, dz = w.tz - n.z, d = Math.hypot(dx, dz);
    n.walking = d > 0.3 && !busy;
    if (n.walking) { n.x += dx / d * 1.8 * dt; n.z += dz / d * 1.8 * dt; n.ry = Math.atan2(dx, dz); }
    n.floor = 0;
  }

  targets(P, out) {
    if (P.floor !== 0) return;
    for (const n of this.list) {
      if (!n.talk || !n.show() || !n.label) continue;
      const d = Math.hypot(P.pos.x - n.x, P.pos.z - n.z);
      if (d < 2.6) out.push({ x: n.x, z: n.z, d, label: n.label, local: 'talk', npc: n });
    }
    for (const [id, c] of this.clues) {
      if (!c.m.visible) continue;
      const d = Math.hypot(P.pos.x - c.x, P.pos.z - c.z);
      if (d < 2.4) out.push({ x: c.x, z: c.z, d, label: 'Read: ' + c.c.title, act: { k: 'clue', id } });
    }
  }

  /* ---------------- shops ---------------- */
  async supplier(key) {
    const g = this.g, W = g.W, s = SUPPLIERS[key];
    if (key === 'cheese' && W.event?.k === 'cheeseMissing' && !W.event.found) { g.act({ k: 'foundCheese' }); return; }
    await g.ui.dialog([[key, pick(s.hi)]]);
    this.supplierMenuOnly(key);
  }
  supplierRefresh(key) { this.g.ui.closeMenu(); this.supplierMenuOnly(key); }
  supplierMenuOnly(key) {
    const g = this.g, W = g.W, s = SUPPLIERS[key], lic = W.law?.k === 'license', big = W.owned.up.bigfridge ? 1.5 : 1;
    g.ui.menu({ title: s.name, sub: 'Cash only. No receipts. No questions.', items: [...s.sells.map((it, i) => { const price = it.item === 'cheese' && lic ? it.price * 2 : it.price; return { label: 'Buy ' + Math.round(it.qty * big) + ' ' + STOCK_NAME[it.item] + (it.scam ? ' (?)' : ''), sub: 'You have ' + W.stock[it.item], price, disabled: W.money < price, keep: true, on: () => { g.act({ k: 'buy', sup: key, i }); setTimeout(() => this.g.ui.menuOpen && this.supplierRefresh(key), 150); } }; }), { label: 'Leave' }] });
  }

  async oleg() {
    const g = this.g, W = g.W;
    await g.ui.dialog([['oleg', pick(OLEG.hi)]]);
    g.ui.menu({
      title: "Oleg's Appliances", sub: 'Ovens. For bread. Wink.',
      items: [
        W.oven1 ? { label: 'Pizza oven', sub: 'You already have one. More ovens come with a bigger hideout (laptop).', owned: true, disabled: true, price: 'OWNED' }
          : { label: 'Buy a pizza oven', sub: 'Delivered out the back of the hideout. Do not ask.', price: 4000, disabled: W.money < 4000, on: () => g.act({ k: 'buyOven' }) },
        { label: 'Leave' },
      ],
    });
  }
  async hank() {
    const g = this.g, W = g.W;
    await g.ui.dialog([['hank', pick(HANK.hi)]]);
    g.ui.menu({
      title: "Honest Hank's Motors", sub: 'Bought vehicles wait in the NEW OWNER PICK-UP bay. Capacity is in KG: weigh your stuff.',
      items: [...Object.entries(VEHICLES).filter(([, v]) => !v.free).map(([k, v]) => {
        const own = W.owned.veh.includes(k);
        const tlock = v.tier && g.debts.tier < v.tier;
        const lock = (k === 'armored' && W.level < 4) || tlock;
        return { label: v.name, sub: tlock ? 'Hank only sells this to the family. (Mafia Rep: ' + TIERS[v.tier].name + ')' : lock ? 'Hank only sells this to serious operations (HQ level 4).' : v.cap.toLocaleString('en-US') + ' KG · ' + Math.round(v.speed * 3.6) + ' KM/H · ' + v.storage + '. ' + v.desc, price: own ? 'OWNED' : v.price, owned: own, disabled: own || lock || W.money < v.price, on: () => g.act({ k: 'buyCar', kind: k }) };
      }), { label: 'Leave' }],
    });
  }
  async stache() {
    const g = this.g, W = g.W;
    await g.ui.dialog([['stache', pick(STACHE.hi)]]);
    const mine = W.wear[g.me];
    g.ui.menu({
      title: 'Mustache Emporium', sub: 'Disguises make cops notice you later. Everyone in the crew can wear what the crew owns.',
      items: [...Object.entries(DISGUISES).map(([k, v]) => {
        const own = W.owned.disg.includes(k);
        const tlock = v.tier && g.debts.tier < v.tier;
        if (!own) return { label: 'Buy: ' + v.name, sub: tlock ? 'Not for just anyone, darling. (Mafia Rep: ' + TIERS[v.tier].name + ')' : v.desc, price: v.price, disabled: tlock || W.money < v.price, on: () => g.act({ k: 'buyDisg', d: k }) };
        return { label: (mine === k ? 'Take off: ' : 'Wear: ') + v.name, sub: v.desc, price: mine === k ? 'WEARING' : 'OWNED', owned: true, on: () => g.act({ k: 'wear', d: mine === k ? null : k }) };
      }), { label: 'Leave' }],
    });
  }
  async guard() {
    const g = this.g, W = g.W, w = W.wear[g.me];
    if (W.clues.includes('archive')) { await g.ui.dialog([['guard', 'Back again, detective? Nothing else in there. Just the mayor\'s cushion. Don\'t touch the cushion.']]); return; }
    if (w === 'coat' || w === 'cop') { await g.ui.dialog(GUARD.ok); g.act({ k: 'clue', id: 'archive' }); }
    else if (w === 'mustache') await g.ui.dialog(GUARD.mustache);
    else await g.ui.dialog([...GUARD.none, ['dez', '(whispering) Maybe if we looked like detectives... the Mustache Emporium sells coats.']]);
  }
  async dezTalk() {
    const g = this.g, W = g.W;
    if (W.quest < Q.BIZ) { await g.ui.dialog([['dez', pick(["I'm helping! Emotionally.", 'Do the thing! The pizza thing!', 'I believe in you. I also believe in ghosts, so.'])]]); return; }
    await g.ui.dialog([['dez', pick(DEZ.idle)]]);
  }

  /* ---------------- the laptop ---------------- */
  laptop() {
    const g = this.g, W = g.W;
    if (W.quest < Q.BIZ) { g.ui.card('DarkWeb Pizza Supply', 'The laptop says:\n\nMAKE ONE PIZZA FIRST, ROOKIE.'); return; }
    const next = HQ_LEVELS[W.level + 1];
    const items = [];
    if (next) items.push({ label: 'Upgrade hideout: ' + next.name, sub: next.desc, price: next.price, disabled: W.money < next.price, on: () => g.act({ k: 'level' }) });
    else items.push({ label: 'Hideout: PIZZA EMPIRE', sub: 'You did it. There is nothing bigger. Except maybe your ego.', price: 'MAX', disabled: true, owned: true });
    for (const [k, u] of Object.entries(UPGRADES)) {
      const own = W.owned.up[k];
      const tlock = u.tier && g.debts.tier < u.tier;
      const lock = (u.level && W.level < u.level) || tlock;
      items.push({ label: u.name, sub: tlock ? 'Needs Mafia Rep: ' + TIERS[u.tier].name + '.' : lock ? 'Needs HQ level ' + u.level + '.' : u.desc, price: own ? 'OWNED' : u.price, owned: own, disabled: own || lock || W.money < u.price, on: () => g.act({ k: 'upgrade', u: k }) });
    }
    items.push({ label: 'Front sign: ' + (W.sign === 'closed' ? 'OLD SHOE REPAIR (CLOSED)' : 'TOTALLY A SHOE STORE'), sub: 'A shoe store has a reason to have customers. Inspectors relax a bit (heat -10 when they visit).', price: 'TOGGLE', keep: false, on: () => g.act({ k: 'sign' }) });
    items.push({ label: 'Tow every car back to the hideout', sub: 'Lost your car? Hank\'s cousin will drag it home.', price: 200, disabled: !W.cars.length || W.money < 200, on: () => g.act({ k: 'tow' }) });
    const s = W.stats;
    g.ui.menu({ title: 'DarkWeb Pizza Supply', sub: `Made ${s.made} · Delivered ${s.delivered} · Burnt ${s.burnt} · Fires ${s.fires} · Cheese explosions ${s.explosions} · Busted ${s.busted} · Earned ${money(s.earned)}`, items: [...items, { label: 'Close' }], cls: 'laptop' });
  }
}
