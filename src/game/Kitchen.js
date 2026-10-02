/* Kitchen.js - the hideout: its stations, the cooking, and the fires.

   Pizza is made physically: dough from the tub, flattened on a counter,
   sauce/cheese/toppings added with 1-7, baked in an oven (take it out when
   it's golden, not when it's black), then boxed. Too much cheese explodes.
   Dirty ovens smoke and then burn. Fire spreads from station to station
   until somebody grabs the extinguisher. The host runs all of it. */
import * as THREE from '../../lib/three.module.js';
import { makeStation, makeItem } from '../art/Props.js';
import { makeChar } from '../art/Chars.js';
import { STATIONS, STATION, TRASH } from '../data/Hideout.js';
import { ADD_KEYS, STOCK_NAME, UPGRADES } from '../data/Data.js';
import { HQ } from '../world/Town.js';
import { pick, money } from '../core/Util.js';

const COOK_RATE = 1 / 14;     // per second: cooked at 0.85, burnt past 1.35, fire at 1.9
export const COOKED = 0.85, BURNT = 1.35, FIRE_AT = 1.9;

export function cookWord(c) {
  if (c < 0.3) return 'raw';
  if (c < COOKED) return 'half-baked';
  if (c < 1.15) return 'golden';
  if (c < BURNT) return 'well done';
  return 'BURNT';
}
export function pizzaName(it) {
  if (!it) return '';
  if (it.k === 'dough') return 'dough';
  if (it.k === 'ext') return 'fire extinguisher';
  if (it.k === 'trash') return 'trash';
  const tops = (it.top || []).join(', ');
  const ch = it.cheese >= 2 ? 'extra cheese' : it.cheese ? 'cheese' : 'no cheese';
  const base = (it.sauce ? '' : 'no sauce, ') + ch + (tops ? ', ' + tops : '');
  if (it.k === 'base') return 'raw pizza (' + base + ')';
  if (it.k === 'box') return 'boxed pizza (' + base + ')' + (it.cook >= BURNT ? ' [burnt]' : it.cook < COOKED ? ' [raw]' : '');
  return cookWord(it.cook) + ' pizza (' + base + ')';
}

export class Kitchen {
  constructor(game) {
    this.g = game;
    this.vis = new Map();   // id -> { S, itemKey, itemG, on }
    this.piles = [];
    this.root = new THREE.Group(); game.scene.add(this.root);
    this.cols = new Map();
    this.staff = {};
    // colliders for every station (switched on when the station exists)
    for (const s of STATIONS) {
      if (s.wall || s.flat) continue;
      const rot = Math.abs(Math.sin(s.ry)) > 0.5;
      const c = game.town.col.boxc(s.x, s.z, rot ? s.d : s.w, rot ? s.w : s.d, { h: 2.2, floor: s.floor || 0, y0: s.floor ? HQ.base.y : 0, tag: 'station' });
      c.on = false; this.cols.set(s.id, c);
    }
    for (const [x, z] of TRASH) {
      const S = makeStation('trashpile'); S.group.position.set(x, 0.05, z); S.group.rotation.y = x * 3; this.root.add(S.group); this.piles.push(S.group);
    }
    this.goldDecor = null;
  }

  st(id) { const W = this.g.W; return W.st[id] || (W.st[id] = { item: null, items: [], grease: 0, fire: 0, burnt: false, ext: true }); }
  available(s) {
    const W = this.g.W;
    if (s.lvl > W.level) return false;
    if (s.needs && !W[s.needs]) return false;
    return true;
  }

  /* ---------------- visuals (everyone) ---------------- */
  sync(dt) {
    const W = this.g.W, fx = this.g.fx;
    for (const s of STATIONS) {
      const on = this.available(s);
      let v = this.vis.get(s.id);
      const c = this.cols.get(s.id); if (c) c.on = on;
      if (!on) { if (v) { this.root.remove(v.S.group); this.vis.delete(s.id); } continue; }
      if (!v) {
        const S = makeStation(s.type);
        S.group.position.set(s.x, s.floor ? HQ.base.y + 0.05 : 0.08, s.z); S.group.rotation.y = s.ry;
        this.root.add(S.group);
        v = { S, itemKey: '', itemG: new THREE.Group(), slotsG: [] };
        S.slot.add(v.itemG);
        this.vis.set(s.id, v);
        if (this.ready) fx.poof(s.x, (s.floor ? HQ.base.y : 0) + 0.8, s.z);
      }
      const st = this.st(s.id);
      // what sits on it
      const show = s.type === 'stash' ? [] : (s.shelf || s.slots) ? st.items : st.item ? [st.item] : [];
      const sq = W.law?.k === 'square';
      const key = JSON.stringify(show) + sq + (s.type === 'ext' ? st.ext : '');
      if (key !== v.itemKey) {
        v.itemKey = key;
        if (s.shelf || s.slots) {
          for (const g of v.slotsG) g.parent && g.parent.remove(g);
          v.slotsG = show.map((it, i) => { const g = makeItem(sq && it.k !== 'box' ? { ...it, square: true } : it); (v.S.slots[i] || v.S.slot).add(g); return g; });
        } else {
          while (v.itemG.children.length) v.itemG.remove(v.itemG.children[0]);
          if (s.type === 'ext') { if (st.ext) v.itemG.add(makeItem({ k: 'ext' })); }
          else if (show[0]) v.itemG.add(makeItem(sq ? { ...show[0], square: true } : show[0]));
          if (s.type === 'oven' && v.S.door) v.S.door.rotation.x = 1.1;
        }
      }
      if (v.S.door) v.S.door.rotation.x *= Math.exp(-4 * dt);
      // oven glow, smoke and fire
      const y0 = s.floor ? HQ.base.y : 0;
      const cooking = (s.type === 'oven' || s.type === 'bigoven') && (st.item || st.items.length);
      if (v.S.glow) {
        if (s.type === 'fuse') v.S.glow.material = this._glow(W.power ? 0x20ff60 : 0xff2020);
        else v.S.glow.material = cooking ? this._glow(0xff7a20) : this._dark;
      }
      const maxCook = st.item ? st.item.cook : Math.max(0, ...st.items.map(i => i.cook || 0));
      if (cooking && (maxCook > 1.15 || st.grease > 0.75) && Math.random() < dt * 8) fx.smoke(s.x, y0 + 1.7, s.z, 1, maxCook > BURNT ? 0.9 : 0.4);
      if (st.fire > 0) {
        const n = Math.ceil(st.fire * 6 * dt * 10);
        for (let i = 0; i < n; i++) fx.flame(s.x, y0 + 0.8 + Math.random() * 0.8, s.z, 0.6 + st.fire);
        if (Math.random() < dt * 4) fx.smoke(s.x, y0 + 2.2, s.z, 1, 0.9);
      }
      if (st.burnt && st.fire <= 0 && Math.random() < dt * 1.5) fx.smoke(s.x, y0 + 1.2, s.z, 1, 0.8);
    }
    // the junk piles
    W.trash.forEach((t, i) => { this.piles[i].visible = t; });
    // the boards over the back-room door come off at level 2
    const T = this.g.town;
    T.boarded.visible = W.level < 2; T.boardCol.on = W.level < 2;
    T.hqSign.material.map = this._signTex(W.sign);
    // staff
    this._staff('cook', W.owned.up.cook && W.level >= 2, { hat: 'chef', shirt: '#ffffff', pants: '#22222c', mustache: true, hair: '#3a2418', apron: true }, 156.2, 74.2, Math.PI);
    this._staff('driver', W.owned.up.driver && W.level >= 2, { hat: 'cap', hatColor: '#2a2a38', shirt: '#2a2a38', pants: '#2b2b38', skin: '#c98a5e', glasses: 'sun' }, 134, 91, 0.5);
    this._staff('lookout', W.owned.up.lookout, { hat: 'bald', hairStyle: 'bun', hair: '#e0e0e0', shirt: '#8a4ac8', pants: '#5a3a6a', skin: '#e0a57c', glasses: 'round', belly: 1.2 }, 136.5, 82, -Math.PI / 2);
    for (const k in this.staff) this.staff[k].anim(dt, { talk: k === 'cook' && Math.random() < 0.02 });
    if (W.level >= 5 && !this.goldDecor) {
      const g = new THREE.Group();
      const p = makeItem({ k: 'pizza', sauce: 1, cheese: 1, top: ['pepperoni', 'pineapple', 'olive'], cook: 1 });
      p.scale.setScalar(5); p.rotation.x = Math.PI / 2; p.position.set(0, 3, 0); g.add(p);
      g.position.set(152, HQ.base.y, 82); this.root.add(g); this.goldDecor = g;
    }
    if (this.goldDecor) this.goldDecor.rotation.y += dt * 0.5;
    this.ready = true;
  }
  _glow(c) { this._gm = this._gm || {}; return this._gm[c] || (this._gm[c] = new THREE.MeshBasicMaterial({ color: c })); }
  get _dark() { return this.__dark || (this.__dark = new THREE.MeshStandardMaterial({ color: 0x331a10, flatShading: true })); }
  _signTex(kind) {
    this._st = this._st || {};
    if (!this._st[kind]) {
      const { textTexture } = this.g.mesher;
      this._st[kind] = kind === 'shoes' ? textTexture(['TOTALLY A', 'SHOE STORE'], { w: 1180, h: 256, bg: '#ffe9f2', fg: '#c84a5a' })
        : kind === 'empire' ? textTexture(['SHOES', '(EMPIRE)'], { w: 1180, h: 256, bg: '#2a1640', fg: '#ffd23f' })
          : textTexture(['OLD SHOE REPAIR', '(CLOSED)'], { w: 1180, h: 256, bg: '#5a4a3a', fg: '#ffd65a' });
    }
    return this._st[kind];
  }
  _staff(k, on, look, x, z, ry) {
    if (on && !this.staff[k]) { const r = makeChar(look); r.root.position.set(x, 0.05, z); r.root.rotation.y = ry; this.root.add(r.root); this.staff[k] = r; }
    if (!on && this.staff[k]) { this.root.remove(this.staff[k].root); delete this.staff[k]; }
  }

  /* ---------------- what can I do here (local prompts) ---------------- */
  targets(P, out) {
    const W = this.g.W, held = this.g.hold(this.g.me), top = held[held.length - 1];
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    for (const s of STATIONS) {
      if ((s.floor || 0) !== P.floor || !this.available(s)) continue;
      const dx = s.x - P.pos.x, dz = s.z - P.pos.z, d = Math.hypot(dx, dz);
      const reach = Math.max(s.w, s.d) / 2 + 1.1;
      if (d > reach) continue;
      const facing = d < 0.8 || (dx * fx + dz * fz) / d > 0.25;
      if (!facing && !s.flat) continue;
      const st = this.st(s.id);
      const T = (label, opts = {}) => out.push({ x: s.x, z: s.z, d: d - (s.flat ? 0.5 : 0), label, id: s.id, ...opts });
      if (st.fire > 0) { T('IT\'S ON FIRE! Grab an extinguisher!', { warn: true }); continue; }
      if (st.burnt) { T('Repair it (' + money(300) + ')', { hold: 2, act: { k: 'use', id: s.id, op: 'repair' } }); continue; }
      switch (s.type) {
        case 'fuse': if (!W.power) T('Whack the fuse box', { hold: 2.2, act: { k: 'use', id: s.id, op: 'fuse' }, whack: true }); break;
        case 'dough':
          if (!W.power) T('No power. Fix the fuse box first.', { warn: true });
          else if (W.stock.dough <= 0) T('Out of dough! Buy some from Doughboy Doug.', { warn: true });
          else if (!top || top.k === 'box') T('Grab dough (' + W.stock.dough + ' left)', { act: { k: 'use', id: s.id, op: 'take' } });
          break;
        case 'prep': {
          const it = st.item;
          if (!it) { if (top && (top.k === 'dough' || top.k === 'base' || (top.k === 'pizza' && top.cook < 0.2))) T('Put ' + pizzaName(top) + ' on the counter', { act: { k: 'use', id: s.id, op: 'place' } }); else if (!top && W.power) T('Bring dough here', { info: true }); }
          else if (it.k === 'dough') T('Flatten the dough', { hold: 1.0, act: { k: 'use', id: s.id, op: 'flatten' }, slap: true, alt: !top || top.k === 'box' ? { label: 'Pick up', act: { k: 'use', id: s.id, op: 'take' } } : null });
          else T('Pick up the ' + pizzaName(it), { act: { k: 'use', id: s.id, op: 'take' }, prep: s.id, blocked: top && top.k !== 'box' });
          break;
        }
        case 'oven': case 'bigoven': {
          const items = s.slots ? st.items : st.item ? [st.item] : [];
          const cap = s.slots || 1;
          const canPut = top && (top.k === 'base' || (top.k === 'pizza' && top.cook < BURNT));
          if (!W.power) { T('No power.', { warn: true }); break; }
          if (canPut && items.length < cap) { T((top.sauce ? 'Put it in the oven' : 'Put it in the oven (no sauce?!)'), { act: { k: 'use', id: s.id, op: 'place' } }); break; }
          if (items.length && (!top || top.k === 'box')) { const best = items.reduce((a, b) => (b.cook > a.cook ? b : a)); T('Take out (' + cookWord(best.cook) + ')', { act: { k: 'use', id: s.id, op: 'take' }, oven: true }); break; }
          if (!items.length && !top && st.grease > 0.3) T('Scrub the oven (greasy: ' + Math.round(st.grease * 100) + '%)', { hold: 2, act: { k: 'use', id: s.id, op: 'clean' } });
          break;
        }
        case 'box':
          if (top && top.k === 'pizza') T('Box the pizza', { act: { k: 'use', id: s.id, op: 'box' } });
          else if (top && top.k === 'base') T("Cook it first, genius", { warn: true });
          break;
        case 'shelf':
          if (top && top.k === 'box' && st.items.length < 9) T('Put a box on the shelf (' + st.items.length + '/9)', { act: { k: 'use', id: s.id, op: 'put' }, alt: st.items.length ? { label: 'Take a box', act: { k: 'use', id: s.id, op: 'take' } } : null });
          else if (st.items.length && (!top || top.k === 'box')) T('Take a box (' + st.items.length + ' ready)', { act: { k: 'use', id: s.id, op: 'take' } });
          break;
        case 'stash':
          if (top && top.k !== 'ext') T('Hide it in the "shoe" fridge (' + st.items.length + ' hidden)', { act: { k: 'use', id: s.id, op: 'put' }, alt: st.items.length ? { label: 'Take one out', act: { k: 'use', id: s.id, op: 'take' } } : null });
          else if (st.items.length && !top) T('Take something out (' + st.items.length + ' hidden)', { act: { k: 'use', id: s.id, op: 'take' } });
          break;
        case 'fridge': T('Check the stock', { local: 'stock' }); break;
        case 'ext':
          if (!top && st.ext) T('Grab the fire extinguisher', { act: { k: 'use', id: s.id, op: 'take' } });
          else if (top && top.k === 'ext' && !st.ext) T('Hang the extinguisher back up', { act: { k: 'use', id: s.id, op: 'put' } });
          break;
        case 'trashcan': if (top) T('Throw away the ' + pizzaName(top), { act: { k: 'use', id: s.id, op: 'trash' } }); break;
        case 'laptop': T('Use the laptop (upgrades)', { local: 'laptop' }); break;
        case 'trapdoor': T(s.to === 1 ? 'Climb down to the basement' : 'Climb back up', { local: 'hatch', to: s.to }); break;
      }
    }
    // junk piles
    if (P.floor === 0) W.trash.forEach((t, i) => {
      if (!t) return;
      const [x, z] = TRASH[i], d = Math.hypot(x - P.pos.x, z - P.pos.z);
      if (d < 1.6) out.push({ x, z, d, label: 'Clean up this junk', hold: 1.2, act: { k: 'pile', i } });
    });
  }

  /* ---------------- host: do it ---------------- */
  use(pid, a) {
    const g = this.g, W = g.W, s = STATION[a.id]; if (!s || !this.available(s)) return;
    const st = this.st(s.id), H = g.hold(pid), top = H[H.length - 1];
    const say = (t) => g.tell(pid, t);
    if (st.fire > 0 && a.op !== 'spray') return;
    switch (a.op) {
      case 'repair':
        if (W.money < 300) return say("Can't afford the repair.");
        W.money -= 300; st.burnt = false; st.grease = 0; g.sfx('buy', s); break;
      case 'fuse':
        if (W.power) return;
        W.power = true; g.sfx('ding', s); g.fxAt('sparkle', s.x, 1.8, s.z);
        g.story.onPower(); break;
      case 'take':
        if (s.type === 'dough') {
          if (W.stock.dough <= 0 || (top && top.k !== 'box')) return;
          W.stock.dough--; H.push({ k: 'dough' }); g.sfx('squish', s);
        } else if (s.type === 'prep') {
          if (!st.item || (top && top.k !== 'box')) return;
          H.push(st.item); st.item = null; g.sfx('pickup', s);
        } else if (s.type === 'oven') {
          if (!st.item || (top && top.k !== 'box')) return;
          H.push(st.item); st.item = null; g.sfx('ovenDoor', s);
        } else if (s.type === 'bigoven') {
          if (!st.items.length || (top && top.k !== 'box')) return;
          let bi = 0; st.items.forEach((it, i) => { if (it.cook > st.items[bi].cook) bi = i; });
          H.push(st.items.splice(bi, 1)[0]); g.sfx('ovenDoor', s);
        } else if (s.type === 'shelf' || s.type === 'stash') {
          if (!st.items.length) return;
          if (s.type === 'shelf' && top && top.k !== 'box') return;
          if (s.type === 'stash' && top) return;
          H.push(st.items.pop()); g.sfx('pickup', s);
        } else if (s.type === 'ext') {
          if (top || !st.ext) return;
          st.ext = false; H.push({ k: 'ext', from: s.id }); g.sfx('pickup', s);
        }
        break;
      case 'place':
        if (!top) return;
        if (s.type === 'prep' && !st.item && (top.k === 'dough' || top.k === 'base' || top.k === 'pizza')) { st.item = H.pop(); if (st.item.k === 'pizza') st.item.k = 'base'; g.sfx('drop', s); }
        else if ((s.type === 'oven' || s.type === 'bigoven') && (top.k === 'base' || top.k === 'pizza')) {
          const cap = s.slots || 1, items = s.slots ? st.items : st.item ? [st.item] : [];
          if (items.length >= cap) return;
          const it = H.pop(); it.k = 'pizza'; it.cook = it.cook || 0;
          if (s.slots) st.items.push(it); else st.item = it;
          g.sfx('ovenDoor', s);
          if (W.quest === 9) g.story.hint('Now WAIT. Take it out when it\'s golden. Not black.');
        }
        break;
      case 'flatten':
        if (st.item && st.item.k === 'dough') { st.item = { k: 'base', sauce: 0, cheese: 0, top: [], cook: 0 }; g.sfx('squish', s); }
        break;
      case 'add': {
        const it = st.item, what = a.what;
        if (!it || it.k !== 'base' || !ADD_KEYS.includes(what)) return;
        if (W.stock[what] <= 0) return say('Out of ' + STOCK_NAME[what].toLowerCase() + '!');
        if (what === 'sauce') { if (it.sauce) return say('It already has sauce.'); it.sauce = 1; }
        else if (what === 'cheese') { it.cheese = (it.cheese || 0) + 1; if (it.cheese === 3) say('That is a LOT of cheese...'); if (it.cheese >= 4) say('This is a cheese bomb. Literally.'); }
        else { if (it.top.includes(what)) return say('It already has ' + STOCK_NAME[what].toLowerCase() + '.'); if (it.top.length >= 4) return say('Four toppings max. This is a pizza, not a salad bar.'); it.top.push(what); }
        if (W.soap && what === 'cheese' && W.soap > 0) { it.soap = 1; W.soap--; }
        W.stock[what]--; g.sfx('splat', s);
        break;
      }
      case 'clean': if (!st.item && !st.items.length) { st.grease = 0; g.sfx('spray', s); g.fxAt('sparkle', s.x, 1.2, s.z, '#bfefff'); } break;
      case 'box':
        if (!top || top.k !== 'pizza') return;
        H.pop(); H.push({ ...top, k: 'box' }); g.sfx('pickup', s);
        W.stats.made++;
        g.story.onBoxed(pid, top);
        break;
      case 'put':
        if (!top) return;
        if (s.type === 'shelf' && top.k === 'box' && st.items.length < 9) { st.items.push(H.pop()); g.sfx('drop', s); }
        else if (s.type === 'stash' && top.k !== 'ext') { st.items.push(H.pop()); g.sfx('drop', s); }
        else if (s.type === 'ext' && top.k === 'ext' && !st.ext) { H.pop(); st.ext = true; g.sfx('drop', s); }
        break;
      case 'trash':
        if (!top) return;
        H.pop(); g.sfx('thud', s); g.fxAt('splat', s.x, 1, s.z);
        break;
    }
    g.dirty();
  }

  pile(pid, i) {
    const W = this.g.W;
    if (!W.trash[i]) return;
    W.trash[i] = false;
    const [x, z] = TRASH[i];
    this.g.fxAt('poof', x, 0.6, z); this.g.sfx('whoosh', { x, z });
    if (W.trash.every(t => !t)) this.g.story.onClean();
    this.g.dirty();
  }

  /** host: an extinguisher blast from (x,z) towards (dx,dz) */
  spray(pid, a) {
    const W = this.g.W;
    for (const s of STATIONS) {
      if ((s.floor || 0) !== (a.f | 0) || !this.available(s)) continue;
      const st = this.st(s.id); if (st.fire <= 0) continue;
      const rx = s.x - a.x, rz = s.z - a.z, d = Math.hypot(rx, rz);
      if (d > 4.2) continue;
      if (d > 0.8 && (rx * a.dx + rz * a.dz) / d < 0.5) continue;
      st.fire = Math.max(0, st.fire - 0.22);
      if (st.fire <= 0) { st.fire = 0; st.burnt = true; this.g.sfx('whoosh', s); this.g.tell(null, 'Fire out! The ' + (s.type === 'bigoven' ? 'turbo oven' : s.type) + ' is wrecked though. Repair it.'); }
    }
    this.g.dirty();
  }

  ignite(id, why) {
    const st = this.st(id), s = STATION[id];
    if (st.fire > 0) return;
    st.fire = 0.15;
    if (st.item) st.item.cook = 3;
    for (const it of st.items) it.cook = 3;
    this.g.W.stats.fires++;
    this.g.alarm(why || 'FIRE IN THE KITCHEN!');
    this.g.sfx('boom', s);
    this.g.dirty();
  }

  /* ---------------- host: per frame ---------------- */
  hostUpdate(dt) {
    const g = this.g, W = g.W;
    let rate = COOK_RATE * (W.owned.up.fastoven ? 1.4 : 1) * (W.level >= 5 ? 1.3 : 1);
    let burning = 0, changed = false;
    for (const s of STATIONS) {
      if (!this.available(s)) continue;
      const st = this.st(s.id);
      if ((s.type === 'oven' || s.type === 'bigoven') && W.power) {
        const items = s.slots ? st.items : st.item ? [st.item] : [];
        const r = rate * (s.type === 'bigoven' ? 2.2 : 1);
        for (const it of items) {
          if (st.fire > 0) continue;
          const before = it.cook;
          it.cook += r * dt;
          if (before < COOKED && it.cook >= COOKED) { g.sfx('timerDing', s); W.stats.baked = (W.stats.baked || 0) + 1; st.grease += 0.12; g.addHeat(W.level >= 3 && s.floor ? 0.5 : 1); }
          if (before < BURNT && it.cook >= BURNT) { g.sfx('sizzle', s); W.stats.burnt++; g.tell(null, 'Something is burning!'); }
          // too much cheese: it blows
          if ((it.cheese || 0) >= 3 && it.cook > 0.45) {
            if (s.slots) st.items.splice(st.items.indexOf(it), 1); else st.item = null;
            st.grease += 0.7; W.stats.explosions++;
            g.fxAt('cheese', s.x, (s.floor ? HQ.base.y : 0) + 1, s.z); g.sfx('boom', s);
            g.alarm('CHEESE EXPLOSION!');
            changed = true; break;
          }
          if (it.cook >= FIRE_AT) { this.ignite(s.id, 'YOUR OVEN IS ON FIRE!'); break; }
        }
        // grease: smoke, then fire
        if (items.length && st.fire <= 0) {
          if (st.grease > 0.75) g.addHeat(0.15 * dt * 5);
          if (st.grease > 1 && W.level < 5 && Math.random() < dt * 0.03) this.ignite(s.id, 'THE GREASY OVEN CAUGHT FIRE!');
        }
        if (items.length && Math.random() < dt) changed = true;
      }
      if (st.fire > 0) {
        burning++;
        st.fire = Math.min(1, st.fire + dt * 0.07);
        if (W.owned.up.sprinkler) { st.sprT = (st.sprT || 0) + dt; if (st.sprT > 5) { st.fire = Math.max(0, st.fire - dt * 0.3); if (st.fire <= 0) { st.burnt = true; st.sprT = 0; } } }
        if (st.fire > 0.55) for (const o of STATIONS) {
          if (o === s || (o.floor || 0) !== (s.floor || 0) || !this.available(o) || o.type === 'trapdoor' || o.type === 'fuse') continue;
          const os = this.st(o.id);
          if (os.fire > 0 || os.burnt) continue;
          if (Math.hypot(o.x - s.x, o.z - s.z) < 3.3 && Math.random() < dt * 0.07) this.ignite(o.id, 'THE FIRE IS SPREADING!');
        }
        g.addHeat(dt * 0.3);
        if (Math.random() < dt * 2) changed = true;
      }
    }
    // the whole kitchen is on fire: the fire department comes
    if (burning >= 3) W.fires += dt; else W.fires = Math.max(0, W.fires - dt);
    if (W.fires > 25) {
      for (const s of STATIONS) { const st = this.st(s.id); if (st.fire > 0) { st.fire = 0; st.burnt = true; } }
      W.fires = 0;
      const fine = Math.min(W.money, 2000);
      W.money -= fine; g.addHeat(25);
      g.say(null, [['narr', 'The fire department kicked the door in and put everything out.'], ['narr', '"Why are there pizza ovens in a shoe store?" they asked. Nobody answered. Fine: ' + money(fine) + '. Town heat +25.']]);
      changed = true;
    }
    this.staffUpdate(dt);
    if (changed) g.dirty();
  }

  /** the cook makes pizzas for open orders, the driver delivers them */
  staffUpdate(dt) {
    const g = this.g, W = g.W;
    if (W.level < 2) return;
    const shelves = ['shelf', 'shelfB'].filter(id => this.available(STATION[id])).map(id => this.st(id));
    if (W.owned.up.cook) {
      this.cookT = (this.cookT || 0) + dt;
      if (this.cookT > 24) {
        this.cookT = 0;
        const need = g.orders.uncovered(shelves);
        const space = shelves.find(s => s.items.length < 9);
        if (need && space) {
          const tops = need.top, ok = ['dough', 'sauce', 'cheese', ...tops].every(k => W.stock[k] > 0) && (!need.extra || W.stock.cheese > 1);
          if (ok) {
            for (const k of ['dough', 'sauce', 'cheese', ...tops]) W.stock[k]--;
            if (need.extra) W.stock.cheese--;
            space.items.push({ k: 'box', sauce: 1, cheese: need.extra ? 2 : 1, top: [...tops], cook: 1 });
            W.stats.made++; g.addHeat(W.level >= 3 ? 0.5 : 1);
            g.tell(null, 'Marco the cook put a pizza on the READY shelf.');
            g.dirty();
          } else if (!this.cookWarned) { this.cookWarned = true; g.tell(null, 'Marco: "Boss, we are out of ingredients!"'); setTimeout(() => (this.cookWarned = false), 60000); }
        }
      }
    }
    if (W.owned.up.driver) {
      this.drvT = (this.drvT || 0) + dt;
      if (this.drvT > 32) {
        this.drvT = 0;
        for (const sh of shelves) {
          for (let i = 0; i < sh.items.length; i++) {
            const o = g.orders.matchFor(sh.items[i]);
            if (o) { const box = sh.items.splice(i, 1)[0]; g.orders.complete(null, o, box, 0.8); g.addHeat(1.5); g.dirty(); return; }
          }
        }
      }
    }
  }

  /** everything incriminating the inspector can see */
  evidence() {
    const W = this.g.W, hidden = W.owned.up.hidden;
    let n = 0;
    for (const s of STATIONS) {
      if (!this.available(s) || s.type === 'stash') continue;
      if (hidden && (s.floor === 1 || s.x > HQ.split)) continue;
      const st = this.st(s.id);
      if (st.item && st.item.k !== 'ext') n++;
      n += (st.items || []).length;
    }
    return n;
  }
  confiscate() {
    const W = this.g.W, hidden = W.owned.up.hidden;
    for (const s of STATIONS) {
      if (!this.available(s) || s.type === 'stash') continue;
      if (hidden && (s.floor === 1 || s.x > HQ.split)) continue;
      const st = this.st(s.id);
      st.item = null; st.items = [];
    }
  }
}
