/* Quest.js - moves the story along. The host decides when a step is done
   and tells everyone (dialogue is broadcast so the whole crew sees the big
   moments together). */
import { Q, QUEST, MAN_MEET, MAN_WAIT, MAN_DELIVER, MAN_BAD, HQ_ARRIVE, HQ_CLEAN, HQ_POWER, HQ_STOCK, HQ_MAKE, REVEAL, FINALE } from '../data/Story.js';
import { CLUES, STOCK_NAME } from '../data/Data.js';
import { HQ } from '../world/Town.js';
import { pick, money } from '../core/Util.js';

export class Quest {
  constructor(game) { this.g = game; this.manBusy = false; }

  get W() { return this.g.W; }
  set(step) { if (this.W.quest < step) { this.W.quest = step; this.g.dirty(); this.g.broadcastEvent({ k: 'quest', q: step }); } }

  /** the objective line and its hint, for the HUD (everyone) */
  objective() {
    const W = this.W, q = W.quest;
    let text = QUEST[q] || '', sub = '';
    switch (q) {
      case Q.TOWN: sub = 'Somebody in the alley across the street is trying very hard to look casual.'; break;
      case Q.FIND: sub = 'East side of town. It\'s marked on your map (M).'; break;
      case Q.CLEAN: sub = W.trash.filter(t => !t).length + ' / ' + W.trash.length + ' junk piles (hold E)'; break;
      case Q.POWER: sub = 'Hold E on the fuse box by the door.'; break;
      case Q.OVEN: sub = 'EQUIP-O-RAMA in the Crumb Mall (east side of the courtyard). ' + money(4000) + '.'; break;
      case Q.STOCK: sub = ['dough', 'sauce', 'cheese'].map(k => STOCK_NAME[k] + (W.stock[k] > 0 ? ' ✓' : ' ✗')).join('   ') + '  - Crumb Mall grocery: crates go in the STOCK fridge (E)'; break;
      case Q.MAKE: sub = 'Dough → counter (hold E) → 1 sauce, 2 cheese → oven → take out golden → box it.'; break;
      case Q.FIRST: sub = 'He\'s in the alley by Oleg\'s. Bring the box.'; break;
      case Q.BIZ: sub = 'Orders on your phone (TAB). Clues found: ' + W.clues.length + ' / ' + CLUES.length + '. Upgrades on the laptop.'; break;
      case Q.FINALE: sub = 'Pepperoni, EXTRA cheese (press 2 twice). City Hall front door.'; break;
      case Q.EMPIRE: sub = W.level >= 5 ? 'You ARE the pizza empire. Keep the orders coming.' : 'Grow the hideout to level 5: ' + ['', 'Tiny Kitchen', 'Bigger Kitchen', 'Secret Basement', 'Underground Factory', 'Pizza Empire'][W.level]; break;
    }
    return { text, sub };
  }

  /** map markers for the current step: [{x,z,label}] */
  markers() {
    const W = this.W, T = this.g.town.poi, q = W.quest, out = [];
    if (q === Q.LEAVE) out.push({ ...T.hospExit, label: 'Exit' });
    if (q === Q.TOWN) out.push({ ...T.manSpot, label: '?' });
    if (q === Q.FIND || q === Q.CLEAN || q === Q.POWER) out.push({ x: HQ.door.x, z: HQ.door.z, label: 'Hideout' });
    if (q === Q.OVEN) out.push({ ...T.mallEquip, label: 'Oven' });
    if (q === Q.STOCK) { out.push({ ...T.mallGrocery, label: 'Grocery' }); out.push({ x: HQ.door.x, z: HQ.door.z, label: 'Fridge' }); }
    if (q === Q.FIRST) out.push({ ...T.manSpot, label: 'Deliver' });
    if (q === Q.FINALE) out.push({ ...T.cityHallDoor, label: 'Mayor' });
    if (W.event?.k === 'cheeseMissing' && W.event.at && !W.event.found) out.push({ ...W.event.at, label: 'Big Cheese?' });
    return out;
  }

  /* ---------------- local triggers (sent to the host as actions) ---------------- */
  localUpdate(dt) {
    const g = this.g, W = this.W, P = g.player;
    if (P.floor !== 0) return;
    const T = g.town.poi;
    const man = g.npcs.get('man');
    if (W.quest === Q.TOWN && !this.manBusy && man && Math.hypot(P.pos.x - man.x, P.pos.z - man.z) < 3.4) { this.manBusy = true; g.act({ k: 'q', what: 'man' }); }
    if (W.quest === Q.FIND && Math.hypot(P.pos.x - HQ.door.x, P.pos.z - HQ.door.z) < 7) g.act({ k: 'q', what: 'arrive' });
  }
  talkMan() {
    const g = this.g, W = this.W;
    if (W.quest === Q.TOWN) { g.act({ k: 'q', what: 'man' }); return; }
    if (W.quest === Q.FIRST && g.hold(g.me).some(b => b.k === 'box')) { const o = W.orders.find(o => o.story === 'man'); if (o) g.act({ k: 'deliver', id: o.id }); return; }
    if (W.quest < Q.BIZ) g.ui.dialog([pick(MAN_WAIT)]);
    else g.ui.dialog([['man', pick(["Best fifteen grand I ever spent. Keep it up, kid.", "I told everyone. EVERYONE. My mom. My priest. My other mom.", "Act natural. ...Not like that. Like a normal person."])]]);
  }

  /* ---------------- host ---------------- */
  hostAction(pid, a) {
    const g = this.g, W = this.W;
    if (a.what === 'leave' && W.quest <= Q.LEAVE) this.set(Q.TOWN);
    if (a.what === 'woke' && W.quest < Q.LEAVE) this.set(Q.LEAVE);
    if (a.what === 'man' && W.quest === Q.TOWN && !this._metMan) {
      this._metMan = true;
      W.money += 15000; W.stats.earned += 15000;
      this.set(Q.FIND);
      g.sayAll(MAN_MEET);
    }
    if (a.what === 'arrive' && W.quest === Q.FIND) {
      this.set(Q.CLEAN);
      g.sayAll(HQ_ARRIVE);
    }
  }
  onClean() { if (this.W.quest === Q.CLEAN) { this.set(Q.POWER); this.g.sayAll(HQ_CLEAN); } }
  onPower() { if (this.W.quest === Q.POWER) { this.set(Q.OVEN); this.g.sayAll(HQ_POWER); } }
  onOven() { if (this.W.quest === Q.OVEN) { this.set(Q.STOCK); this.g.sayAll(HQ_STOCK); this.onStock(); } }
  onStock() {
    const W = this.W;
    if (W.quest === Q.STOCK && W.stock.dough > 0 && W.stock.sauce > 0 && W.stock.cheese > 0) { this.set(Q.MAKE); this.g.sayAll(HQ_MAKE); }
  }
  hint(t) { this.g.tell(null, t); }
  onBoxed(pid, pizza) {
    const g = this.g, W = this.W;
    if (W.quest === Q.MAKE) {
      this.set(Q.FIRST);
      W.orders.push({ id: W.orderSeq++, story: 'man', at: { ...g.town.poi.manSpot, addr: 'the alley by the shops' }, name: 'Suspicious Man', msg: 'pizza. PIZZA. p i z z a', top: [], extra: false, qty: 1, left: 1, pay: 0, t: 9999, tmax: 9999, state: 'open' });
      g.sayAll([['dez', 'WE MADE A PIZZA! Okay. Okay okay okay. Take it to the Suspicious Man. Alley by the shops. Don\'t let the cops see it!']]);
    }
  }
  onClue(pid, id) {
    const g = this.g, W = this.W;
    if (W.clues.includes(id)) return;
    W.clues.push(id);
    const c = CLUES.find(c => c.id === id);
    g.broadcastEvent({ k: 'clue', id, pid });
    g.dirty();
    if (W.clues.length === CLUES.length && W.quest === Q.BIZ) {
      setTimeout(() => {
        this.set(Q.FINALE);
        g.sayAll(REVEAL);
        W.orders.push({ id: W.orderSeq++, story: 'mayor', at: { ...g.town.poi.cityHallDoor, addr: 'City Hall' }, name: 'Mayor Crumb', msg: 'BIRTHDAY ORDER (three weeks old): pepperoni, EXTRA cheese. DO NOT BE LATE. (you are very late)', top: ['pepperoni'], extra: true, qty: 1, left: 1, pay: 0, t: 9999, tmax: 9999, state: 'open' });
        g.dirty();
      }, 6000);
    }
  }
  onStoryDelivery(pid, o, box, s) {
    const g = this.g, W = this.W;
    if (o.story === 'man') {
      if (s < 1) { g.hold(pid).push(box); g.sayAll(MAN_BAD); g.dirty(); return; }
      W.orders.splice(W.orders.indexOf(o), 1);
      W.rep++; W.stats.delivered++;
      W.sign = 'shoes';
      this.set(Q.BIZ);
      g.sayAll(MAN_DELIVER);
      W.orderT = 14;
      g.dirty();
    } else if (o.story === 'mayor') {
      if (!(box.top || []).includes('pepperoni') || box.cheese < 2 || box.cook < 0.85 || box.cook >= 1.35) {
        g.hold(pid).push(box);
        g.sayAll([['mayor', '(opens the box) ...This is not my order. PEPPERONI. EXTRA. CHEESE. Cooked. Not burnt. GO AWAY.']]);
        g.dirty(); return;
      }
      W.orders.splice(W.orders.indexOf(o), 1);
      W.money += 100000; W.stats.earned += 100000; W.ending = 1;
      W.heat = Math.max(0, W.heat - 40);
      g.broadcastEvent({ k: 'finale' });
      this.set(Q.EMPIRE);
      g.dirty();
    }
  }
  onLevel(l) {
    if (l === 5) this.g.sayAll([['narr', 'PIZZA EMPIRE.'], ['dez', 'Dude. DUDE. We have a GOLD PIZZA STATUE.'], ['you', 'We have a gold pizza statue.'], ['dez', 'My mom is gonna be so confused.']]);
  }
}
