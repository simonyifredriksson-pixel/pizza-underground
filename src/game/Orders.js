/* Orders.js - DING DING. Someone wants pizza.

   New orders arrive on the phone (TAB). Accept them or decline them - some
   are undercover cops, and their messages are... not subtle. Accepted
   orders get a pin over the customer's door. Walk up with a box and press E.
   The pay depends on the recipe, how well it's cooked and how fast you were.
   The host owns the list; everyone sees it. */
import * as THREE from '../../lib/three.module.js';
import { CUSTOMERS, ORDER_MSG, STING_MSG, RICH, TOPPINGS, BARK } from '../data/Data.js';
import { COOKED, BURNT, pizzaName } from './Kitchen.js';
import { pick, rand, randi, money } from '../core/Util.js';
import { signMesh, geo, part } from '../art/Mesher.js';
import { makeItem } from '../art/Props.js';

export function recipeText(o) {
  const t = [o.extra ? 'EXTRA cheese' : 'cheese', ...o.top];
  return t.join(', ');
}
const same = (a, b) => a.length === b.length && a.every(x => b.includes(x));

export class Orders {
  constructor(game) {
    this.g = game;
    this.pins = new Map();
  }
  get list() { return this.g.W.orders; }
  at(o) {
    if (o.at) return o.at;
    const h = this.g.town.houses[o.h];
    return { x: h.door.x, z: h.door.z, addr: h.addr };
  }

  /* ---------------- host ---------------- */
  hostUpdate(dt) {
    const g = this.g, W = g.W;
    let changed = false;
    for (let i = W.orders.length - 1; i >= 0; i--) {
      const o = W.orders[i];
      if (o.state === 'new') {
        o.exp -= dt;
        if (o.exp <= 0) { W.orders.splice(i, 1); changed = true; }
      } else if (!o.story) {
        const before = o.t;
        o.t -= dt;
        if (before > 0 && o.t <= 0) { g.tell(null, o.name + ' is getting impatient. The pizza will be cold now (half pay).'); changed = true; }
        if (o.t < -o.tmax) { W.orders.splice(i, 1); g.tell(null, o.name + ' gave up and ate a sad sandwich. Order cancelled.'); changed = true; }
      }
    }
    if (W.quest >= 11 && W.power) {
      W.orderT -= dt;
      const busy = W.orders.filter(o => !o.story).length;
      if (W.orderT <= 0) {
        W.orderT = Math.max(20, 62 - W.rep * 1.2 - W.heat * 0.2) * rand(0.7, 1.3);
        if (busy < 3 + W.level) { this.spawn(); changed = true; }
      }
    }
    if (changed) g.dirty();
  }

  spawn(opts = {}) {
    const g = this.g, W = g.W;
    const houses = g.town.houses;
    const used = new Set(W.orders.map(o => o.h));
    let h; for (let k = 0; k < 20; k++) { h = randi(0, houses.length - 1); if (!used.has(h)) break; }
    const nTop = Math.min(4, randi(0, 1 + Math.floor(W.rep / 6)));
    const pool = TOPPINGS.filter(t => W.rep > 3 || t !== 'olive');
    const top = [];
    while (top.length < nTop) { const t = pick(pool); if (!top.includes(t)) top.push(t); }
    if (W.law?.k === 'pineapple' && !top.includes('pineapple')) { if (top.length >= 4) top.pop(); top.push('pineapple'); }
    const extra = Math.random() < 0.25;
    const sting = !opts.big && W.rep >= 3 && Math.random() < Math.min(0.22, 0.06 + W.heat / 400);
    const vip = this.g.debts.tier >= 3;
    const rich = !sting && (W.rep >= 12 || vip) && Math.random() < (vip ? 0.32 : 0.2);
    const mult = Math.min(8, 1 + W.rep * 0.1);
    let pay = (900 + 300 * top.length + (extra ? 250 : 0)) * mult * rand(0.9, 1.15);
    if (rich) pay *= rand(4, 7);
    const qty = opts.big ? 12 : (rich ? 1 : Math.random() < 0.15 && W.rep > 5 ? 2 : 1);
    if (opts.big) pay *= 1.3;
    const name = opts.big ? 'The Cheese Lord' : rich ? pick(RICH) : pick(CUSTOMERS);
    const msg = opts.big ? 'I need ONE HUNDRED PIZZAS. ...okay the van only fits twelve. TWELVE PIZZAS. Cheese. Now. Money is no object. Money is several objects.' : sting ? pick(STING_MSG) : rich ? 'I require one (1) pizza of the finest quality. Money is not a concern. Money is never a concern.' : pick(ORDER_MSG);
    const tmax = opts.big ? 420 : 200 + top.length * 25 + qty * 40;
    const o = { id: W.orderSeq++, h, name, msg, top: opts.big ? [] : top, extra: opts.big ? false : extra, qty, left: qty, pay: Math.round(pay / 10) * 10, t: tmax, tmax, sting, rich, big: !!opts.big, state: opts.accepted ? 'open' : 'new', exp: 50 };
    W.orders.push(o);
    g.broadcastEvent({ k: 'ding', id: o.id });
    g.dirty();
    return o;
  }

  accept(pid, id) { const o = this.list.find(x => x.id === id); if (o && o.state === 'new') { o.state = 'open'; this.g.dirty(); } }
  decline(pid, id) {
    const W = this.g.W, i = W.orders.findIndex(x => x.id === id);
    if (i < 0) return;
    const o = W.orders[i];
    W.orders.splice(i, 1);
    if (o.sting) this.g.tell(null, 'Smart. "' + o.name + '" was definitely a cop.');
    this.g.dirty();
  }

  /** how good is this box for this order: 0..1 */
  score(o, box) {
    if (!box || box.k !== 'box') return { s: 0 };
    let s = 1, why = 'perfect';
    if (o.story === 'man') { const ok = box.sauce && box.cheese && box.cook >= COOKED && box.cook < BURNT; return { s: ok ? 1 : 0, why: ok ? 'perfect' : 'bad' }; }
    if (!o.big && !same(box.top || [], o.top)) { s *= 0.5; why = 'wrong'; }
    if (o.extra && box.cheese < 2) { s *= 0.8; why = why === 'perfect' ? 'cheese' : why; }
    if (!box.sauce) { s *= 0.5; why = 'nosauce'; }
    if (!box.cheese) { s *= 0.5; why = 'nocheese'; }
    if (box.cook < COOKED) { s *= 0.3; why = 'raw'; }
    else if (box.cook >= BURNT) { s *= 0.15; why = 'burnt'; }
    if (box.soap) { s = 0; why = 'soap'; }
    return { s, why };
  }
  /** an order this box fits exactly (the hired driver can smell a cop: no stings) */
  matchFor(box) { return this.list.find(o => o.state === 'open' && !o.story && !o.sting && this.score(o, box).s >= 1); }
  uncovered(shelves) {
    const boxes = shelves.flatMap(s => s.items);
    for (const o of this.list) {
      if (o.state !== 'open' || o.story) continue;
      const have = boxes.filter(b => this.score(o, b).s >= 1).length;
      if (have < o.left) return o;
    }
    return null;
  }

  /** host: a player at a door with boxes */
  deliver(pid, id) {
    const g = this.g, o = this.list.find(x => x.id === id);
    if (!o || o.state !== 'open') return;
    const H = g.hold(pid);
    let bi = -1, best = -1;
    H.forEach((b, i) => { if (b.k !== 'box') return; const s = this.score(o, b).s; if (s > best) { best = s; bi = i; } });
    if (bi < 0) return g.tell(pid, 'You need a boxed pizza.');
    const box = H.splice(bi, 1)[0];
    this.complete(pid, o, box, 1);
  }

  complete(pid, o, box, mult) {
    const g = this.g, W = g.W;
    const { s, why } = this.score(o, box);
    const at = this.at(o);
    if (o.story) { g.story.onStoryDelivery(pid, o, box, s); return; }
    if (o.sting) {
      W.orders.splice(W.orders.indexOf(o), 1);
      g.bust(pid, 'It was an UNDERCOVER COP! "' + o.name + '" pulls out a badge.', 0.2, 10);
      g.dirty();
      return;
    }
    const late = o.t < 0 ? 0.5 : 1;
    let pay = Math.round(o.pay * s * late * mult);
    if (s >= 1 && late === 1 && mult === 1) pay = Math.round(pay * 1.2); // tip
    const tier = this.g.debts.tier;
    if (tier >= 2 && pay > 0) pay = Math.round(pay * 1.15);              // nervous customers tip more
    // sometimes they can't pay right now: "put it on my tab"
    const owes = this.g.debts.list.some(d => d.kind === 'house' && d.ref === o.h);
    if (pid && !o.big && !o.rich && !owes && pay > 0 && s >= 0.5 && Math.random() < (this.forceTab ? 1 : 0.12)) {
      o.left--;
      if (o.left <= 0) { W.orders.splice(W.orders.indexOf(o), 1); W.rep++; }
      W.stats.delivered++;
      this.g.debts.fromDelivery(pid, o, pay);
      this.g.addHeat(2); this.g.debts.addRep(0.5); g.dirty();
      return;
    }
    this.g.debts.addRep(o.big ? 4 : o.rich ? 2 : 0.8);
    W.money += pay; W.stats.earned += pay; W.stats.delivered++;
    o.left--;
    if (o.left <= 0) { W.orders.splice(W.orders.indexOf(o), 1); W.rep++; }
    g.addHeat(o.big ? 1 : 2.5);
    const lines = {
      perfect: ['OH MY GOD. You beautiful criminal.', 'Holy shit. It\'s perfect.', 'I\'m crying. I\'m actually crying.', 'This is the best day of my damn life.'],
      cheese: ['I said EXTRA cheese. ...I\'ll allow it.'],
      wrong: ['That\'s not what I ordered. ...I\'m eating it anyway.', 'Wrong toppings, but honestly? I don\'t give a shit. It\'s PIZZA.'],
      raw: ['It\'s... wet. Why is it wet?', 'This is raw as hell. I\'m eating it. I hate myself.'],
      burnt: ['It\'s charcoal. I\'m still eating it. Don\'t look at me.', 'Did you cook it in a volcano?'],
      nosauce: ['Where\'s the sauce? This is just cheese bread. Sad cheese bread.'],
      nocheese: ['No cheese?! What is this, a tomato frisbee?'],
      soap: ['WHY IS IT FOAMING?! IT TASTES LIKE SOAP!'],
    }[why] || ['Thanks.'];
    g.broadcastEvent({ k: 'paid', x: at.x, z: at.z, pay, why, line: pick(lines), name: o.name, pid });
    if (why === 'soap') g.addHeat(5);
    g.dirty();
  }

  /* ---------------- everyone: pins over the doors ---------------- */
  sync(dt) {
    const seen = new Set();
    for (const o of this.list) {
      if (o.state !== 'open') continue;
      seen.add(o.id);
      let p = this.pins.get(o.id);
      if (!p) {
        p = new THREE.Group();
        const pin = makeItem({ k: 'pizza', sauce: 1, cheese: 1, top: o.top, cook: 1 });
        pin.rotation.x = Math.PI / 2; pin.scale.setScalar(1.6); p.add(pin);
        const ring = part(geo.tor(12), o.sting ? '#ff5a5a' : '#43e07a', 0, 0, 0, 1.5, 1.5, 1.5, { emissive: o.sting ? 0xff3030 : 0x20ff60, ei: 0.6 });
        ring.rotation.x = Math.PI / 2; ring.position.y = -2.6; p.add(ring);
        this.g.scene.add(p); this.pins.set(o.id, p);
      }
      const at = this.at(o);
      p.position.set(at.x, 3.4 + Math.sin(performance.now() * 0.003) * 0.25, at.z);
      p.children[0].rotation.z += dt * 2;
      p.visible = true;
    }
    for (const [id, p] of this.pins) if (!seen.has(id)) { this.g.scene.remove(p); this.pins.delete(id); }
  }

  /** the delivery prompt, if I'm at a door with an open order */
  targets(P, out) {
    if (P.floor !== 0) return;
    const H = this.g.hold(this.g.me);
    for (const o of this.list) {
      if (o.state !== 'open') continue;
      const at = this.at(o), d = Math.hypot(at.x - P.pos.x, at.z - P.pos.z);
      if (d > 3.2) continue;
      const boxes = H.filter(b => b.k === 'box').length;
      if (boxes) out.push({ x: at.x, z: at.z, d, label: 'Deliver to ' + o.name + (o.left > 1 ? ' (' + o.left + ' left)' : ''), act: { k: 'deliver', id: o.id } });
      else out.push({ x: at.x, z: at.z, d, label: o.name + ' wants: ' + recipeText(o) + ' (bring a box)', info: true });
    }
  }
}
