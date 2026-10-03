/* Inspections.js - POLICE INSPECTION INCOMING.

   The police get tips: every delivery, every report, every whiff of smoke
   and every fire adds to a hidden pile. The bigger the pile (and the hotter
   the town), the likelier an inspection - but it is a dice roll every
   second, never a timer. You can go ten minutes without one. You can get
   two in a row.

   Then: a countdown. 45 seconds to hide the pizzas, put out the ovens,
   disguise the fridge, flip the specials board, close the hatch, move the
   cash into the safe and drive the delivery car round the block. Then two
   officers walk in and look at EVERYTHING, while you act normal. */
import { STATIONS, STATION, roomAt } from '../data/Hideout.js';
import { HQ } from '../world/Town.js';
import { isContraband } from './State.js';
import { Q } from '../data/Story.js';
import { money, pick, rand } from '../core/Util.js';

const WARN = 45;
// officer A searches inside, officer B checks the yard, then watches you
const ROUTE_A = [
  { x: 137.5, z: 80 }, { x: 141.6, z: 80 },
  { x: 142.1, z: 86.0, check: 'fridge' }, { x: 145.7, z: 74.6, check: 'prep' }, { x: 149.5, z: 74.8, check: 'ovens' },
  { x: 146.2, z: 74.0, check: 'board' }, { x: 149.8, z: 86.1, check: 'stash' }, { x: 150.2, z: 77.4, check: 'cash' },
  { x: 151.5, z: 80, needLevel: 2 }, { x: 157.6, z: 86.0, check: 'shelf', needLevel: 2 }, { x: 158.5, z: 81.6, check: 'hatch', needLevel: 3 },
  { x: 151.5, z: 80, needLevel: 2 }, { x: 141.6, z: 80 }, { x: 137.5, z: 80 }, { x: 126, z: 80 },
];
const ROUTE_B = [
  { x: 132, z: 76 }, { x: 131, z: 90, check: 'yard' }, { x: 136, z: 82, check: 'sign' }, { x: 141.8, z: 80 }, { x: 146, z: 80, check: 'people', wait: 6 }, { x: 137.5, z: 80 }, { x: 126, z: 82 },
];
const LINES = {
  fridge: ['That is a LOT of cheese for a shoe store.', 'Why does your shoe fridge contain forty pounds of mozzarella?'],
  fridgeOk: ['Fridge says ONLY SHOES. Checks out.', '...Shoes. In a fridge. Okay.'],
  prep: ['Is this... DOUGH?', 'Why is there sauce on your shoe counter?'],
  ovens: ['Why is your shoe oven ON?', 'I can feel the heat from here. What are you baking? Shoes?'],
  smell: ['(sniff) It smells like OREGANO in here.'],
  board: ['"TODAY\'S SPECIALS (ALL ILLEGAL)"? Really? You wrote that down?'],
  boardOk: ['"TODAY\'S SPECIAL: SHOES." Hm. Very nice.'],
  stash: ['These shoes are... warm. Why are they warm.'],
  cash: ['That is a LOT of cash for someone who sells shoes.'],
  shelf: ['Why do you have a heated shelf full of flat square boxes?'],
  hatch: ['Where does this trapdoor go? ...Why is it lit up like a pizza parlor down there?'],
  yard: ['Is that a car full of pizza boxes parked right outside?', 'Your car literally says PIZZA on the roof.'],
  sign: ['"CLOSED", it says. But there are people inside. Interesting.'],
  people: ['And what are YOU holding?', 'Why are you sweating like that?', 'Why are you running? Nobody runs in a shoe store.'],
  clean: ['Hm. Nothing here.', 'Clean. Suspiciously clean. But clean.', 'Moving on.'],
};

export class Inspections {
  constructor(game) { this.g = game; this.lastBeep = 0; }
  get W() { return this.g.W; }

  /** host: something suspicious happened somewhere: the police hear about it */
  tip(n) { const W = this.W; W.tips = Math.min(40, (W.tips || 0) + n); }

  hostUpdate(dt, players) {
    const g = this.g, W = this.W;
    if (W.shutdown > 0) { W.shutdown -= dt; if (W.shutdown <= 0) { W.shutdown = 0; g.tell(null, 'The police tape is gone. You\'re back in business!'); g.dirty(); } }
    W.inspCool = Math.max(0, (W.inspCool || 0) - dt);
    W.tips = Math.max(0, (W.tips || 0) - dt * 0.01);
    const I = W.insp;
    if (!I) {
      // inspections only happen on their own once the business is running (admin can start one any time)
      if (W.quest < Q.BIZ || W.inspCool > 0 || W.shutdown > 0) return;
      // a dice roll every frame, weighted by heat and by the pile of tips
      const rate = 0.0012 + W.heat * 0.00008 + (W.tips || 0) * 0.0009;
      if (Math.random() < rate * dt) this.start();
      return;
    }
    if (I.ph === 'warn') {
      I.t -= dt;
      if (I.t <= 0) this._arrive();
    } else if (I.ph === 'search') {
      for (const o of I.officers) this._walk(o, dt, players);
      if (I.officers.every(o => o.done)) this._finish();
    }
    if (Math.random() < dt * 2) g.dirty();
  }

  start(why) {
    const g = this.g, W = this.W;
    if (W.insp) return;
    let warn = WARN + (W.owned.up.lookout ? 15 : 0) + (W.owned.up.camera ? 5 : 0) + (g.rivals?.inspectionWarn() || 0);
    if (g.rivals?.inspectionWarn()) g.tell(null, 'Don Vincenzo called: "Inspectors. Coming your way. You owe me." (+15s warning)');
    W.insp = { ph: 'warn', t: warn, total: warn, found: [], score: 0, why: why || pick(['An anonymous tip: "it smells cheesy on Anchovy Road".', 'A neighbor reported "suspicious happiness".', 'Someone saw a man carrying 12 flat boxes into a shoe store.', 'The police dog went crazy outside the shoe store.']) };
    W.tips = (W.tips || 0) * 0.3;
    g.alarm('POLICE INSPECTION INCOMING!');
    g.broadcastEvent({ k: 'insp', ph: 'warn', why: W.insp.why });
    g.dirty();
  }

  _arrive() {
    const g = this.g, W = this.W, I = W.insp;
    I.ph = 'search'; I.watched = {};
    const P = g.police;
    const mk = (route, name) => {
      const c = P.spawnCop('officer', { x: 125, z: name === 'A' ? 78 : 82 });
      c.fixed = true; c.st = 'officer';
      return { id: c.id, route: route.filter(p => !p.needLevel || W.level >= p.needLevel).map(p => ({ ...p })), wait: 0, done: false };
    };
    I.officers = [mk(ROUTE_A, 'A'), mk(ROUTE_B, 'B')];
    P.cars.push({ id: 9000 + Math.floor(Math.random() * 999), x: 122, z: 74, yaw: 0, spd: 0, st: 'parked', siren: 1 });
    g.alarm('THE POLICE ARE HERE. ACT NORMAL.');
    g.broadcastEvent({ k: 'insp', ph: 'arrive' });
    g.dirty();
  }

  _cop(o) { return this.g.police.cops.find(c => c.id === o.id); }
  _walk(o, dt, players) {
    const c = this._cop(o); if (!c) { o.done = true; return; }
    if (o.wait > 0) {
      o.wait -= dt; c.spd = 0;
      if (o.watching) this._watchPeople(c, players);
      return;
    }
    const p = o.route[0];
    if (!p) { o.done = true; return; }
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
    if (d < 0.35) {
      o.route.shift();
      if (p.check) { this._check(c, p.check); o.wait = p.wait || 2.4; o.watching = p.check === 'people'; }
      return;
    }
    const s = Math.min(3.2 * dt, d);
    c.x += dx / d * s; c.z += dz / d * s; c.yaw = Math.atan2(dx, dz); c.spd = 3.2;
    this._watchPeople(c, players);
  }

  /** anyone inside running, or holding pizza where an officer can see it */
  _watchPeople(c, players) {
    const I = this.W.insp, g = this.g;
    for (const p of players) {
      if (I.watched[p.id] || !roomAt(p.x, p.z, p.floor) || p.floor !== 0) continue;
      const d = Math.hypot(p.x - c.x, p.z - c.z);
      if (d > 8) continue;
      const contra = g.hold(p.id).some(isContraband);
      if (p.run || contra) {
        I.watched[p.id] = true;
        this._found(c, contra ? 2 : 1, contra ? 'And what are YOU holding?' : 'Why are you RUNNING? Nobody runs in a shoe store.');
      } else if (p.nat && !I.watched[p.id + 'nat']) { I.watched[p.id + 'nat'] = true; this._say(c, 'Nice whistling. Very... normal.'); }
    }
  }
  _say(c, text) { this.g.broadcastEvent({ k: 'bark', cop: c.id, text }); }
  _found(c, pts, line) {
    const I = this.W.insp;
    I.score += pts; I.found.push(line);
    this._say(c, line);
    this.g.sfx('deny', c);
    this.g.broadcastEvent({ k: 'inspFound', pts, line });
  }

  /** what an officer finds at one spot */
  _check(c, what) {
    const g = this.g, W = this.W, K = g.kitchen;
    const ovens = STATIONS.filter(s => (s.type === 'oven' || s.type === 'bigoven') && K.available(s) && (!s.floor || this._hatchOpen()));
    const items = (types) => STATIONS.filter(s => types.includes(s.type) && K.available(s) && (!s.floor || this._hatchOpen())).reduce((n, s) => { const st = K.st(s.id); return n + (st.item ? 1 : 0) + (st.items || []).length; }, 0);
    let pts = 0, line = null, ok = null;
    switch (what) {
      case 'fridge': {
        const total = Object.values(W.stock).reduce((a, b) => a + b, 0);
        if (W.stockHidden) ok = pick(LINES.fridgeOk);
        else if (total > 90) { pts = 2; line = pick(LINES.fridge); }
        else if (total > 30) { pts = 1; line = pick(LINES.fridge); }
        break;
      }
      case 'prep': { const n = items(['prep', 'box']); if (n) { pts = Math.min(3, n); line = pick(LINES.prep); } break; }
      case 'ovens': {
        const lit = ovens.filter(s => K.lit(s.id)).length, full = items(['oven', 'bigoven']);
        if (lit || full) { pts = lit + full; line = pick(LINES.ovens); }
        if (!W.owned.up.purifier && !(W.fresh > 0) && ovens.some(s => K.st(s.id).grease > 0.5)) { pts += 1; line = line || LINES.smell[0]; }
        break;
      }
      case 'board': if (!W.boardFlipped) { pts = 1; line = LINES.board[0]; } else ok = LINES.boardOk[0]; break;
      case 'stash': { const n = (K.st('stash').items || []).length; if (n > 5 && Math.random() < 0.5) { pts = Math.floor(n / 3); line = LINES.stash[0]; } break; }
      case 'cash': if (W.money > 200000) { pts = 2; line = LINES.cash[0] + ' (' + money(W.money) + ')'; } else if (W.money > 50000) { pts = 1; line = LINES.cash[0] + ' (' + money(W.money) + ')'; } break;
      case 'shelf': { const n = items(['shelf']); if (n) { pts = Math.min(3, n); line = LINES.shelf[0]; } break; }
      case 'hatch': if (this._hatchOpen()) { pts = 1 + Math.min(4, items(['prep', 'shelf', 'box'].filter(Boolean))); line = LINES.hatch[0]; } break;
      case 'yard': {
        for (const car of W.cars) {
          if (Math.hypot(car.x - HQ.door.x, car.z - HQ.door.z) > 22) continue;
          if ((car.cargo || []).length) { pts += 2; line = LINES.yard[0]; }
          else if (car.kind === 'delivery') { pts += 1; line = line || LINES.yard[1]; }
        }
        break;
      }
      case 'sign': if (W.sign === 'closed') { pts = 1; line = LINES.sign[0]; } break;
      case 'people': break; // handled while watching
    }
    if (pts > 0) this._found(c, pts, line);
    else this._say(c, ok || pick(LINES.clean));
  }
  _hatchOpen() { return this.W.level >= 3 && this.W.hatchOpen !== false && !this.W.owned.up.hidden; }

  _finish() {
    const g = this.g, W = this.W, I = W.insp;
    let score = I.score;
    const notes = [];
    if (W.owned.up.shoes) { score -= 2; notes.push('The shoe racks helped (-2).'); }
    if (W.license) { score -= 3; W.license = false; notes.push('The fake license helped (-3). The inspector noticed the spelling on the way out.'); }
    if (I.smoke) { score -= 3; notes.push('The party smoke machine: they couldn\'t see a thing (-3). One of them did a little dance.'); }
    if (I.docs) { score -= 4; notes.push('Your "very official" documents (-4). The inspector saluted them.'); }
    score = Math.max(0, score);
    const lines = [['inspector', 'Inspection complete. Evidence found: ' + I.score + '.'], ...notes.map(n => ['narr', n])];
    const inside = g.allPlayers().filter(p => roomAt(p.x, p.z, p.floor));
    const confiscate = () => {
      g.kitchen.confiscate(true);
      for (const p of inside) g.setHold(p.id, g.hold(p.id).filter(i => !isContraband(i)));
      for (const k in W.stock) W.stock[k] = Math.floor(W.stock[k] * 0.5);
    };
    if (score <= 0) {
      W.heat = Math.max(0, W.heat - 25); W.money += 150;
      lines.push(['inspector', 'Everything seems to be in order. Very nice shoes. I\'ll take a pair.'], ['narr', 'PASSED! Town heat -25. (The officer bought shoes: +$150.)']);
    } else if (score <= 2) {
      const fine = Math.min(W.money, 1000); W.money -= fine; W.heat = Math.max(0, W.heat - 5);
      lines.push(['inspector', 'A few... irregularities. Consider this a warning. And a fine.'], ['narr', 'WARNING. Fine: ' + money(fine) + '.']);
    } else if (score <= 5) {
      const fine = Math.min(W.money, Math.max(3000, Math.round(W.money * 0.15))); W.money -= fine; g.addHeat(10); confiscate();
      lines.push(['inspector', 'This is NOT a shoe store. Everything pizza-shaped is confiscated. So is half your "shoe supplies".'], ['narr', 'BUSTED! Fine: ' + money(fine) + '. Pizzas confiscated, half the ingredients gone. Heat +10.']);
    } else {
      const fine = Math.min(W.money, Math.max(5000, Math.round(W.money * 0.25))); W.money -= fine; g.addHeat(20); confiscate();
      W.shutdown = 120;
      lines.push(['inspector', 'That\'s it. This "shoe store" is CLOSED until further notice. Police tape. Everywhere.'], ['narr', 'SHUT DOWN for 2 minutes: no cooking. Fine: ' + money(fine) + '. Pizzas confiscated. Heat +20. (Deliver what you have. Lie low.)']);
    }
    W.stats.inspections = (W.stats.inspections || 0) + 1;
    if (score <= 0) W.stats.passed = (W.stats.passed || 0) + 1;
    // officers walk away, the car leaves
    for (const o of I.officers) { const c = this._cop(o); if (c) { c.kind = 'insp'; c.st = 'leave'; c.route = [{ x: 126, z: 80 }, { x: 120, z: 60 }]; } }
    g.police.cars = g.police.cars.filter(c => c.st !== 'parked');
    W.insp = null; W.inspCool = rand(45, 80);
    g.sayAll(lines);
    g.broadcastEvent({ k: 'insp', ph: 'done', score });
    g.dirty();
  }
}
