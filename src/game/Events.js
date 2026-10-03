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
import { ROADS, RW } from '../world/Town.js';
import { VEHICLES } from '../data/Data.js';

const KINDS = ['ovenFire', 'bigOrder', 'cheeseMissing', 'copOutside', 'posted', 'law', 'checkpoint', 'dezSold', 'raccoon', 'smell', 'supplierVan', 'supplierVan', 'tow', 'rushHour', 'rushHour', 'shortage', 'storm', 'informant'];

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
    // weather, shortages and the air freshener run out on their own
    if (W.weather) { W.weather.t -= dt; if (W.weather.t <= 0) { W.weather = null; g.tell(null, 'The storm is over.'); g.dirty(); } }
    if (W.shortage) { W.shortage.t -= dt; if (W.shortage.t <= 0) { g.tell(null, 'The grocery has ' + W.shortage.s + ' again.'); W.shortage = null; g.dirty(); } }
    if (W.fresh > 0) W.fresh = Math.max(0, W.fresh - dt);
    if (W.newsT <= 0 && W.quest >= Q.FIND) { W.newsT = rand(70, 120); g.broadcastEvent({ k: 'news', text: pick(NEWS.filler) }); }
    // laws run out
    if (W.law) { W.law.t -= dt; if (W.law.t <= 0) { g.broadcastEvent({ k: 'news', text: 'The law "' + W.law.name + '" has been repealed. Nobody knows why it existed.' }); W.law = null; g.dirty(); } }
    // the current event
    const ev = W.event;
    if (ev) this._tick(ev, dt, players);
    else if (W.quest >= Q.BIZ) {
      W.eventT -= dt;
      if (W.eventT <= 0) { W.eventT = rand(60, 120); this.start(this._pick()); }
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
      if (k === 'tow') return this._towable().length > 0;
      if (k === 'storm') return !W.weather;
      if (k === 'shortage') return !W.shortage;
      return true;
    });
    return pick(ok);
  }
  _anyoneHome() { return this.g.allPlayers().some(p => roomAt(p.x, p.z, p.floor)); }
  /** player cars parked in the middle of a road */
  _towable() { return this.g.W.cars.filter(c => !c.drv && ROADS.some(r => Math.abs(c.x - r) < RW / 2 || Math.abs(c.z - r) < RW / 2) && Math.abs(c.x) < 205 && Math.abs(c.z) < 205); }

  start(k) {
    const g = this.g, W = g.W;
    switch (k) {
      case 'supplierVan': {
        const goods = ['dough', 'sauce', 'cheese', 'pepperoni', 'sausage', 'mushroom'];
        const crates = Array.from({ length: 3 + Math.floor(Math.random() * 3) }, () => ({ k: 'crate', s: pick(goods), n: 8 }));
        W.event = { k, t: 50, count: true, show: 'SUPPLIER VAN OUTSIDE!', sub: 'Tony\'s cousin brought crates. $250 each. Grab them before he leaves.', crates };
        g.alarm('SUPPLIER VAN OUTSIDE THE HIDEOUT!');
        break;
      }
      case 'tow': {
        const c = pick(this._towable());
        W.event = { k, t: 40, count: true, show: 'TOW TRUCK COMING!', sub: 'Your ' + (VEHICLES[c.kind]?.name || 'car') + ' is parked in the road. Move it!', car: c.id };
        g.alarm('YOUR CAR IS BLOCKING THE ROAD!');
        break;
      }
      case 'rushHour': {
        for (let i = 0; i < 3; i++) { const o = g.orders.spawn({ accepted: true }); o.pay = Math.round(o.pay * 1.6); o.t = o.tmax = 110; }
        g.alarm('RUSH HOUR! 3 ORDERS AT ONCE!');
        g.tell(null, 'Three hungry people, all at once, all paying extra. GO GO GO.');
        return;
      }
      case 'shortage': {
        const s = pick(['cheese', 'sauce', 'dough']);
        W.shortage = { s, t: 150 };
        g.alarm('THE GROCERY IS OUT OF ' + s.toUpperCase() + '!');
        g.broadcastEvent({ k: 'news', text: 'Crumb Grocery: "We have no ' + s + '. We don\'t know why. Try the guy in the alley." (Underground suppliers still sell it.)' });
        g.dirty();
        return;
      }
      case 'storm':
        W.weather = { k: 'storm', t: 150 };
        g.alarm('A STORM IS COMING!');
        g.tell(null, 'Rain: cars slide, cops see less, and wet customers tip 50% more.');
        g.dirty();
        return;
      case 'informant':
        g.inspections.tip(14);
        g.broadcastEvent({ k: 'news', text: 'Police hotline "flooded with calls" about "the smell" near Anchovy Road. (An inspection could come any second.)' });
        return;
      case 'inspector': g.inspections.start(); return;
      case 'oldInspector': {
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
    if (ev.k === 'supplierVan') {
      if (ev.t <= 0 || !ev.crates.length) { g.tell(null, ev.crates.length ? 'The supplier van drove off. ' + ev.crates.length + ' crates went with it.' : 'The supplier van is empty and leaves happy.'); this.end(); this._after(); }
    } else if (ev.k === 'tow') {
      const c = W.cars.find(c => c.id === ev.car);
      const still = c && !c.drv && ROADS.some(r => Math.abs(c.x - r) < RW / 2 || Math.abs(c.z - r) < RW / 2);
      if (!c || !still) { if (c) g.tell(null, 'Moved it just in time. The tow truck driver looks disappointed.'); this.end(); this._after(); }
      else if (ev.t <= 0) {
        c.x = 160 + Math.random() * 6; c.z = 148; c.yaw = Math.PI; c.cargo = [];
        const fee = Math.min(W.money, 500); W.money -= fee;
        g.alarm('TOWED!'); g.tell(null, 'Your ' + (VEHICLES[c.kind]?.name || 'car') + ' was towed to the junkyard (and emptied). Fee: ' + money(fee) + '.');
        this.end(); this._after();
      }
    } else if (ev.k === 'inspector') {
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
  /** after an event, sometimes the police hear about it: inspections can come right after */
  _after() { if (Math.random() < 0.3) this.g.inspections.tip(6); }
  /** host: grab a crate from the supplier van */
  grabCrate(pid) {
    const g = this.g, W = g.W, ev = W.event;
    if (!ev || ev.k !== 'supplierVan' || !ev.crates.length) return;
    const H = g.hold(pid);
    if (H.some(i => i.k !== 'crate' && i.k !== 'box') || H.length >= 6) return g.tell(pid, 'Your hands are full.');
    if (W.money < 250) return g.tell(pid, 'You can\'t afford it ($250).');
    W.money -= 250; H.push(ev.crates.pop()); g.sfx('pickup', { x: 131, z: 88 }); g.dirty();
  }

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
