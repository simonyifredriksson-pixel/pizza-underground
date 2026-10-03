/* Events.js - every session has stupid unpredictable events.
   THE INSPECTOR IS COMING. YOUR OVEN IS ON FIRE. A CUSTOMER ORDERED 100
   PIZZAS. THE CHEESE SUPPLIER IS MISSING. A POLICE CAR IS OUTSIDE. SOME
   IDIOT POSTED YOUR LOCATION ONLINE. THE GOVERNMENT HAS ANNOUNCED A NEW
   PIZZA LAW. Plus the news ticker. Host only; W.event is what everyone sees. */
import { LAWS, NEWS, DEZ } from '../data/Data.js';
import { Q } from '../data/Story.js';
import { STATIONS } from '../data/Hideout.js';
import { HQ } from '../world/Town.js';
import { isContraband } from './State.js';
import { roomAt } from '../data/Hideout.js';
import { pick, rand, money } from '../core/Util.js';

const KINDS = ['inspector', 'ovenFire', 'bigOrder', 'cheeseMissing', 'copOutside', 'posted', 'law', 'checkpoint', 'dezSold', 'raccoon', 'smell'];

export class Events {
  constructor(game) { this.g = game; this.lastHeatNews = 0; }

  hostUpdate(dt, players) {
    const g = this.g, W = g.W;
    // heat cools off over time
    W.heat = Math.max(0, W.heat - dt * 0.06 * (W.level >= 5 ? 2 : 1) * (W.ending ? 1.5 : 1) * (g.debts.tier >= 4 ? 1.6 : 1));
    // the news follows the heat
    const band = NEWS.heat.filter(([h]) => W.heat >= h).pop();
    if (band && band[0] > this.lastHeatNews) g.broadcastEvent({ k: 'news', text: band[1] });
    this.lastHeatNews = band ? band[0] : 0;
    W.newsT = (W.newsT || 60) - dt;
    if (W.newsT <= 0 && W.quest >= Q.TOWN) { W.newsT = rand(70, 120); g.broadcastEvent({ k: 'news', text: pick(NEWS.filler) }); }
    // laws run out
    if (W.law) { W.law.t -= dt; if (W.law.t <= 0) { g.broadcastEvent({ k: 'news', text: 'The law "' + W.law.name + '" has been repealed. Nobody knows why it existed.' }); W.law = null; g.dirty(); } }
    // the current event
    const ev = W.event;
    if (ev) this._tick(ev, dt, players);
    else if (W.quest >= Q.BIZ) {
      W.eventT -= dt;
      if (W.eventT <= 0) { W.eventT = rand(110, 190); this.start(this._pick()); }
    }
  }

  _pick() {
    const W = this.g.W;
    const ok = KINDS.filter(k => {
      if (k === 'inspector') return W.heat >= 22;
      if (k === 'ovenFire') return this._anyoneHome() && STATIONS.some(s => s.type === 'oven' && this.g.kitchen.available(s));
      if (k === 'law') return !W.law;
      if (k === 'dezSold') return W.stock.cheese >= 3;
      if (k === 'raccoon') return W.stock.dough >= 3;
      if (k === 'bigOrder') return W.rep >= 4;
      if (k === 'copOutside' || k === 'checkpoint') return W.heat >= 15;
      return true;
    });
    return pick(ok);
  }
  _anyoneHome() { return this.g.allPlayers().some(p => roomAt(p.x, p.z, p.floor)); }

  start(k) {
    const g = this.g, W = g.W;
    switch (k) {
      case 'inspector': {
        const slow = !!W.owned.up.lookout;
        const c = g.police.startInspector(slow);
        const eta = g.police.routeLeft(c) / c.speed;
        W.event = { k, t: eta, count: true, show: 'THE INSPECTOR IS COMING!', sub: 'Hide the evidence: pizzas into the "shoe" fridge or the trash, ovens empty.', insp: c.id };
        g.alarm('THE INSPECTOR IS COMING!');
        if (slow) g.tell(null, 'Grandma Rosa: "Inspector coming. You have time. Move your asses."');
        break;
      }
      case 'ovenFire': {
        const ovens = STATIONS.filter(s => s.type === 'oven' && g.kitchen.available(s) && g.kitchen.st(s.id).fire <= 0);
        if (ovens.length) g.kitchen.ignite(pick(ovens).id, 'YOUR OVEN IS ON FIRE!');
        return;
      }
      case 'bigOrder':
        g.orders.spawn({ big: true });
        g.alarm('A CUSTOMER ORDERED 100 PIZZAS!');
        g.tell(null, '(It\'s twelve. The fine print says twelve. Check your phone.)');
        return;
      case 'cheeseMissing': {
        const spots = [{ x: -100, z: -150 }, { x: 180, z: -140 }, { x: 175, z: 40 }, { x: -185, z: 120 }, { x: 30, z: 190 }];
        W.event = { k, t: 300, show: 'THE CHEESE SUPPLIER IS MISSING!', sub: 'Big Cheese is gone. Find him (marked on the map).', at: pick(spots) };
        g.alarm('THE CHEESE SUPPLIER IS MISSING!');
        break;
      }
      case 'copOutside':
        W.event = { k, t: 80, count: true, show: 'A POLICE CAR IS OUTSIDE.', sub: 'Nobody knows why. Don\'t walk out with pizza.' };
        this._outside = g.police.spawnCop('cop', { x: 128, z: 76 }); this._outside.fixed = true; this._outside.st = 'guard'; this._outside.gx = 129; this._outside.gz = 78; this._outside.yaw = Math.PI / 2;
        g.alarm('A POLICE CAR IS OUTSIDE.');
        break;
      case 'posted':
        g.addHeat(22);
        for (let i = 0; i < 3; i++) g.orders.spawn();
        g.alarm('SOME IDIOT POSTED YOUR LOCATION ONLINE!');
        g.broadcastEvent({ k: 'news', text: 'VIRAL: "secret pizza place on anchovy road lol" - 40,000 likes. Police "aware".' });
        return;
      case 'law': {
        const l = pick(LAWS);
        W.law = { ...l, t: 180 };
        g.alarm('THE GOVERNMENT HAS ANNOUNCED A NEW PIZZA LAW.');
        g.broadcastEvent({ k: 'news', text: 'NEW LAW: ' + l.name + ' ' + l.desc });
        g.dirty();
        return;
      }
      case 'checkpoint': {
        const cp = g.police.checkpoint(true);
        W.event = { k, t: 150, count: true, show: 'POLICE CHECKPOINT', sub: 'At the junction of ' + this._junction(cp) + '. Cars with pizza get stopped.', cp };
        g.alarm('POLICE CHECKPOINT!');
        break;
      }
      case 'dezSold': {
        const n = W.stock.cheese, cash = n * 45;
        W.stock.cheese = 0; W.money += cash;
        g.sayAll([['you', DEZ.sold[0]], ['dez', DEZ.sold[1]], ['you', DEZ.sold[2]], ['dez', DEZ.sold[3]], ['you', DEZ.sold[4]], ['dez', DEZ.sold[5]], ['narr', 'Dez sold ' + n + ' cheese for ' + money(cash) + '. Go buy more.']]);
        g.dirty();
        return;
      }
      case 'raccoon':
        W.stock.dough = Math.max(0, W.stock.dough - 3);
        g.sayAll([['dez', 'Bad news. The raccoon in the vent took three bags of dough.'], ['dez', 'He seems less cool now.']]);
        g.dirty();
        return;
      case 'smell':
        g.addHeat(8);
        g.broadcastEvent({ k: 'news', text: 'Neighbor on Anchovy Road complains of "an amazing smell. Illegally amazing."' });
        return;
    }
    g.dirty();
  }
  _junction(cp) {
    const EW = { '-120': 'Pepper Rd', '-40': 'Basil St', '40': 'Oregano Ave', '120': 'Mozzarella Blvd' }, NS = { '-120': 'Crust Ln', '-40': 'Dough St', '40': 'Garlic Way', '120': 'Anchovy Rd' };
    return NS[cp.x] + ' & ' + EW[cp.z];
  }

  _tick(ev, dt, players) {
    const g = this.g, W = g.W;
    if (ev.t != null) ev.t -= dt;
    if (ev.k === 'inspector') {
      const c = g.police.cops.find(c => c.id === ev.insp);
      if (c) ev.t = Math.max(0, g.police.routeLeft(c) / c.speed);
      if (!c || c.st === 'leave') this.end();
    } else if (ev.k === 'checkpoint') {
      g.police.checkpointUpdate(players);
      if (ev.t <= 0) { g.police.checkpoint(false); this.end(); }
    } else if (ev.k === 'copOutside') {
      if (ev.t <= 0) { if (this._outside) g.police.cops.splice(g.police.cops.indexOf(this._outside), 1); this._outside = null; this.end(); g.tell(null, 'The police car outside left. Nobody knows why it came.'); }
    } else if (ev.k === 'cheeseMissing') {
      if (ev.t <= 0 || ev.found) this.end();
    }
    if (Math.random() < dt * 2) g.dirty();
  }
  end() { this.g.W.event = null; this.g.dirty(); }

  /** host: the inspector reached the middle of the front room */
  inspectorArrived(c) {
    const g = this.g, W = g.W;
    let n = g.kitchen.evidence();
    const hid = !!W.owned.up.hidden;
    for (const p of g.allPlayers()) {
      const room = roomAt(p.x, p.z, p.floor);
      if (!room || (hid && room !== 'front')) continue;
      n += g.hold(p.id).filter(isContraband).length;
    }
    if (n > 0) {
      const fine = Math.max(3000, Math.round(W.money * 0.15));
      W.money = Math.max(0, W.money - fine);
      g.kitchen.confiscate();
      for (const p of g.allPlayers()) { const room = roomAt(p.x, p.z, p.floor); if (room && (!hid || room === 'front')) g.setHold(p.id, g.hold(p.id).filter(i => !isContraband(i))); }
      g.addHeat(15); W.stats.busted++;
      g.sayAll([['inspector', '(sniffs) ...Oregano. Mozzarella. Is that... ' + n + ' pizza' + (n > 1 ? 's' : '') + '?'], ['inspector', 'In a SHOE store?!'], ['inspector', 'Confiscated. All of it. And a fine: ' + money(fine) + '. I will be back.'], ['narr', 'Town heat +15.']]);
    } else {
      const drop = W.sign === 'shoes' ? 35 : 25;
      W.heat = Math.max(0, W.heat - drop);
      g.sayAll([['inspector', '(sniffs) ...Hm. Smells like oregano in here.'], ['dez', 'It\'s a... shoe... smell. Shoes smell like that. Italian shoes.'], ['inspector', W.sign === 'shoes' ? 'Very nice shoes. Carry on.' : 'Why does the sign say "closed"? ...Whatever. Carry on.'], ['narr', 'Clean! Town heat -' + drop + '.']]);
    }
    g.dirty();
  }
}
