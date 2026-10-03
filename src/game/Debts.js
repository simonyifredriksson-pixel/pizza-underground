/* Debts.js - the pizza mafia's accounts receivable.

   Customers sometimes put it "on the tab". Businesses run tabs once the
   town knows who you are. Every debt has a due date. Go knock on the door
   (or send Knuckles): they pay, they beg for a deadline, or - once the
   deadline has passed - you confiscate something they love (a TV, a lawn
   flamingo, the shop's sign) and keep it in the hidden storage room until
   they pay. Then it goes home. Nobody gets hurt. Everybody gets nervous.

   Also here: Mafia Reputation, its tier events, Knuckles, the rival gang. */
import * as THREE from '../../lib/three.module.js';
import { makeChar, makeCritter, SKINS } from '../art/Chars.js';
import { makeValuable, MAFIA } from '../art/Props.js';
import { makeHood, makeCuff } from '../art/Gear.js';
import { part, geo } from '../art/Mesher.js';
import { TIERS, tierOf, BUSINESSES, BIZ_TAB, TAB_LINES, ENCOUNTERS, PAY_LINES, REFUSE_LINES, DEADLINE_LINES, SEIZE_LINES, RETURN_LINES, FORGIVE_LINES, BIZ_SEIZE, KNUCKLES, TIER_EVENTS, RIVAL } from '../data/Mafia.js';
import { CUSTOMERS } from '../data/Data.js';
import { GEAR } from '../data/BlackMarket.js';
import { GANGS as RIVAL_GANGS } from '../data/Rivals.js';
import { SPEAKERS, Q } from '../data/Story.js';
import { HQ } from '../world/Town.js';
import { path, nearestNode } from './Police.js';
import { pick, rand, money, dampAngle } from '../core/Util.js';

SPEAKERS.debtor = { name: 'Debtor', color: '#c8c8d8' };
SPEAKERS.knuckles = { name: 'Knuckles', color: '#ff9f1a' };
SPEAKERS.rival = { name: 'Calzone Cartel', color: '#ff6b6b' };

const BAGGABLE = ['owed', 'late', 'warned', 'overdue'];
/* the Time-Out Chair: a hood over the head, handcuffs, and a resolve meter.
   Resolve starts at 100. Bonks with the foam bat or the mallet knock it down
   (and so does sitting alone in the dark for a few minutes). What they say
   depends on how much fight is left in them. At 0 they offer to pay: take
   it, or don't, and keep them. */
const BONK = { foambat: 14, mallet: 32 };
const DEFIANT = [   // resolve 70+
  'I\'m not paying! And the second these cuffs come off, I\'m calling the COPS!',
  'You can\'t do this! I know my rights! Probably! I\'ve never read them!',
  'The police are gonna hear about this! All of it! In DETAIL!',
  'Is this a hood? Why is it a hood? Who even SELLS hoods?!',
  'You picked the wrong guy- the wrong PERSON- to mess with!',
];
const WOBBLY = [    // 35-70
  'Okay, that one hurt my feelings. And my head. Mostly my feelings.',
  'Maybe... we could talk about this? Like adults? Without the bonking?',
  'I MIGHT have some money. Hypothetically. In a sock.',
  'Let\'s not involve the cops. The cops are busy. Cops are SO busy.',
  'I can see stars. Inside the hood. Is that normal?',
];
const CAVING = [    // 1-35
  'Fine! Half! I\'ll pay you half!',
  'Okay okay okay, most of it! I\'ll pay most of it!',
  'I take back the thing about the cops. I love the cops. I mean, I love YOU.',
  'Please, no more! My sock money is yours!',
];
const BROKEN = [    // 0: they'll pay
  'OKAY! I\'LL PAY! ALL OF IT! Just no more bonking! PLEASE!',
  'You win! You WIN! Take the money! Take the sock too!',
];
const BONK_YELP = ['OW!', 'BONK?!', 'MY HEAD!', 'HEY!', 'OOF!', 'WHAT WAS THAT?!', '(muffled yelp)'];
const KEPT = ['Hello? Is anyone there? I said I would PAY!', 'I live here now, I guess.', '(muffled humming)', 'Can I at least get a pillow? Or a pizza?', 'I\'ve named the hood. Her name is Darkness.', 'This is the longest time-out in history.'];
const lineFor = (res) => pick(res >= 70 ? DEFIANT : res >= 35 ? WOBBLY : res > 0 ? CAVING : BROKEN);

const KNUCKLES_LOOK = { hat: 'fedora', hatColor: '#1b1b24', coat: '#1b1b24', glasses: 'sun', skin: '#e0a57c', belly: 1.35, mustache: true, headSize: 0.92 };
const RIVAL_LOOK = { hat: 'fedora', hatColor: '#f6f1e6', coat: '#f6f1e6', glasses: 'sun', skin: '#c98a5e', tie: '#d6232a', mustache: '#1a1410' };

export class Debts {
  constructor(game) {
    this.g = game;
    this.rigs = new Map();      // debt id -> debtor rig at the door
    this.kn = null; this.rival = null;
    this.storageKey = '';
    this.storageGroup = new THREE.Group(); game.scene.add(this.storageGroup);
    this.bagsKey = '';
    this.bagsGroup = new THREE.Group(); game.scene.add(this.bagsGroup);
    this.lastTier = null;
  }
  get W() { return this.g.W; }
  get list() { return this.W.debts || (this.W.debts = []); }
  get tier() { return tierOf(this.W.mrep || 0); }

  /** where a debt's door is */
  at(d) {
    const T = this.g.town;
    if (d.kind === 'house') { const h = T.houses[d.ref]; return { x: h.door.x, z: h.door.z, ry: h.ry, addr: h.addr }; }
    const b = T.biz[d.ref]; return { x: b.x, z: b.z, ry: b.ry, addr: BUSINESSES[d.ref] };
  }
  itemOf(d) { return d.kind === 'house' ? this.g.town.houses[d.ref].valuable : 'Shop Sign'; }
  stateText(d) {
    const t = Math.max(0, Math.ceil(d.t || 0));
    return { owed: 'due in ' + t + 's', late: 'LATE', warned: 'deadline in ' + t + 's', overdue: 'DEADLINE PASSED', seized: 'their ' + this.itemOf(d) + ' is in your storage room', bagged: 'in a trash bag', guest: (d.res > 0 ? 'cuffed in the Time-Out Chair, resolve ' + Math.ceil(d.res) + '%' : 'cuffed in the Time-Out Chair, ready to pay'), kept: 'your permanent guest in the Time-Out Chair' }[d.state];
  }

  /* ---------------- reputation ---------------- */
  addRep(n) {
    const W = this.W;
    W.mrep = Math.max(0, Math.min(100, (W.mrep || 0) + n));
    const t = tierOf(W.mrep);
    W.tierSeen = W.tierSeen || 0;
    if (t > W.tierSeen) {
      W.tierSeen = t;
      this.g.alarm('MAFIA REP: ' + TIERS[t].name.toUpperCase() + '!');
      if (TIER_EVENTS[t]) setTimeout(() => this.g.sayAll(TIER_EVENTS[t]), 2500);
      if (t === 2) setTimeout(() => this.g.sayAll(KNUCKLES.intro), 12000);
      if (t === 5) { W.money += 250000; W.stats.earned += 250000; }
    }
    this.g.dirty();
  }

  /* ---------------- host ---------------- */
  create(kind, ref, name, amount, reason) {
    const W = this.W;
    if (this.list.some(d => d.kind === kind && d.ref === ref)) return null;
    const d = { id: W.debtSeq = (W.debtSeq || 0) + 1, kind, ref, name, amount: Math.round(amount / 10) * 10, reason, state: 'owed', t: 180 + Math.random() * 90, tried: 0 };
    this.list.push(d);
    this.g.dirty();
    return d;
  }
  /** a customer at the door who can't pay right now */
  fromDelivery(pid, o, pay) {
    const d = this.create('house', o.h, o.name, pay * 1.25, 'pizza on the tab');
    if (!d) return false;
    const at = this.at(d);
    this.g.broadcastEvent({ k: 'paid', x: at.x, z: at.z, pay: 0, why: 'tab', line: pick(TAB_LINES), name: o.name, pid });
    this.g.tell(null, o.name + ' put ' + money(d.amount) + ' "on the tab". Check DEBTS on your phone (TAB).');
    return true;
  }

  hostUpdate(dt, players) {
    const g = this.g, W = this.W;
    let changed = false;
    for (const d of [...this.list]) {
      if (d.state === 'owed' || d.state === 'warned') {
        d.t -= dt;
        if (d.t <= 0) { d.state = d.state === 'owed' ? 'late' : 'overdue'; g.tell(null, d.name + (d.state === 'late' ? ' is late paying ' : ' blew the deadline on ') + money(d.amount) + '. Time for a visit.'); changed = true; }
      } else if (d.state === 'seized') {
        d.t -= dt;
        if (d.t <= 0) { this.pay(null, d, true); changed = true; }
      } else if (d.state === 'bagged') {
        // a sack is not a long-term plan: dropped, confiscated or just slow, they wriggle out
        d.bt = (d.bt ?? 240) - dt;
        if (!this.bagOf(d.id)) { this.release(d, ' wriggled out of the trash bag and sprinted home. Rude.'); changed = true; }
        else if (d.bt <= 0) { this.release(d, ' chewed through the trash bag and escaped. It was a cheap bag.'); changed = true; }
      } else if (d.state === 'guest' && d.res > 0) {
        // left alone in the dark, the fight slowly goes out of them (about four minutes)
        d.res = Math.max(0, d.res - dt * 0.42);
        if (d.res <= 0) { g.tell(null, d.name + ' (muffled, from the storage room): "OKAY! I\'LL PAY! Somebody come down here!"'); changed = true; }
      }
    }
    // businesses run tabs once they know who you are
    if (this.tier >= 1 && W.quest >= Q.BIZ) {
      W.tabT = (W.tabT ?? 120) - dt;
      if (W.tabT <= 0) {
        W.tabT = rand(200, 320);
        const free = Object.keys(BUSINESSES).filter(k => !this.list.some(d => d.kind === 'biz' && d.ref === k));
        if (free.length && this.list.filter(d => d.kind === 'biz').length < 3) {
          const k = pick(free);
          const d = this.create('biz', k, BUSINESSES[k], rand(4, 12) * 1000 * (1 + this.tier * 0.3), 'tab');
          if (d) g.broadcastEvent({ k: 'news', text: BUSINESSES[k] + ' ' + pick(BIZ_TAB) + ' (' + money(d.amount) + ' - DEBTS on your phone)' });
        }
      }
    }
    // the rival gang shows up now and then
    if (this.tier >= 3 && W.quest >= Q.BIZ) {
      if (W.rival) { W.rival.t -= dt; if (W.rival.t <= 0) { W.rival = null; changed = true; } }
      else { W.rivalT = (W.rivalT ?? 200) - dt; if (W.rivalT <= 0) { W.rivalT = rand(300, 480); const p = g.town.poi.pete; W.rival = { x: p.x - 6, z: p.z + 3, t: 240 }; g.alarm('THE CALZONE CARTEL IS IN THE PARK!'); changed = true; } }
    }
    this._knucklesHost(dt);
    if (changed) g.dirty();
  }

  /** host: the actions */
  exec(pid, a) {
    const g = this.g, W = this.W;
    if (a.k === 'rival') return this._rival(pid, a);
    if (a.k === 'safe') return this._safe(pid, a);
    const d = this.list.find(x => x.id === a.id);
    if (!d) return;
    const at = this.at(d);
    const who = { debtor: { name: d.name, color: '#c8c8d8' } };
    const say = (lines) => g.broadcastEvent({ k: 'dlg', lines, pid, who });
    const suit = W.wear[pid] === 'suit' || W.wear[pid] === 'coat' ? 0.12 : 0;
    const bonus = this.tier * 0.06 + suit + (GEAR[W.eq?.[pid]]?.bonus || 0);   // a foam bat is very persuasive
    switch (a.op) {
      case 'talk': {
        if (d.state === 'seized') return say([['debtor', 'I\'m saving up! I\'m saving! Please take care of my ' + this.itemOf(d) + '!']]);
        const e = ENCOUNTERS[(d.id * 3 + d.tried++) % ENCOUNTERS.length];
        const p = Math.min(1, e.pay + bonus);
        if (Math.random() < p) { say([...e.lines, ['debtor', pick(PAY_LINES)]]); this.pay(pid, d); }
        else { say([...e.lines, ['debtor', pick(REFUSE_LINES)]]); g.broadcastEvent({ k: 'debtMenu', pid, id: d.id }); }
        break;
      }
      case 'press': {
        if (d.pressed === d.state) return say([['debtor', 'I TOLD you, I don\'t have it!']]);
        d.pressed = d.state;
        if (Math.random() < 0.3 + bonus) { say([['you', 'Pay up. Now.'], ['debtor', '(sweating) ...Okay. Okay okay okay. Here.']]); this.pay(pid, d); }
        else { say([['you', 'Pay up. Now.'], ['debtor', 'I... can\'t! I really can\'t! Give me time!']]); g.broadcastEvent({ k: 'debtMenu', pid, id: d.id }); }
        break;
      }
      case 'deadline':
        if (!['owed', 'late'].includes(d.state)) return;
        d.state = 'warned'; d.t = 150;
        say([['you', 'You have until tomorrow.'], ['debtor', pick(DEADLINE_LINES)], ['narr', 'Deadline set. If they don\'t pay, you can come back and take their ' + this.itemOf(d) + '.']]);
        break;
      case 'seize':
        if (d.state !== 'overdue' && !(a.byKnuckles && d.state !== 'seized')) return;
        this.seize(d);
        if (!a.byKnuckles) say([['you', 'We\'re taking the ' + this.itemOf(d) + '.'], ['debtor', d.kind === 'biz' ? pick(BIZ_SEIZE) : pick(SEIZE_LINES).replace(/\{X\}/g, this.itemOf(d).toUpperCase())], ['narr', 'Confiscated. It\'s in your hidden storage room until they pay.']]);
        break;
      case 'forgive':
        this.list.splice(this.list.indexOf(d), 1);
        say([['you', 'Forget it. We\'re good.'], ['debtor', pick(FORGIVE_LINES)]]);
        this.addRep(-1);
        W.forgiven = (W.forgiven || 0) + 1;
        if (Math.random() < 0.5) setTimeout(() => this.g.tell(null, d.name + ' left a thank-you cake outside the hideout. (+5 dough, somehow)'), 4000), W.stock.dough += 5;
        break;
      case 'knuckles':
        if (!W.owned.up.knuckles || W.kn || !['late', 'warned', 'overdue'].includes(d.state)) return;
        this._sendKnuckles(d);
        break;
      case 'bag': {
        // the Comically Large Sack: they go in, you carry them to a trunk
        const inv = W.inv?.[pid], H = g.hold(pid);
        if (!BAGGABLE.includes(d.state)) return;
        if (!inv || !(inv.sack > 0)) return g.tell(pid, 'You need a Comically Large Trash Bag (General store at the mall).');
        if (H.length) return g.tell(pid, 'You need both hands free to bag someone.');
        inv.sack--;
        d.prev = d.state; d.state = 'bagged'; d.bt = 240;
        H.push({ k: 'bag', id: d.id, name: d.name });
        g.addHeat(3); this.addRep(1);
        g.sfx('whoosh', at);
        say([['you', 'Get in the bag.'], ['debtor', 'The WHAT?'], ['narr', '*FWUMP.* ' + d.name + ' is in the trash bag. Put them in a car trunk (back of the car, E) and take them to the Time-Out Chair in the hidden storage room.'], ['debtor', '(muffled) THIS IS A VIOLATION OF MY RIGHTS. AND IT SMELLS LIKE ONIONS.']]);
        break;
      }
      case 'seat': {
        const H = g.hold(pid), top = H[H.length - 1];
        if (d.state !== 'bagged' || !top || top.k !== 'bag' || top.id !== d.id) return;
        if (this.chairTaken()) return g.tell(pid, 'The Time-Out Chair is taken. One guest at a time. We are not animals.');
        H.pop();
        d.state = 'guest'; d.res = 100;
        say([['narr', 'You sit ' + d.name + ' in the Time-Out Chair, pull a black hood down over their head and click the handcuffs shut behind the chair.'],
          ['debtor', 'WHAT IS THIS?! Who turned off the SUN?!'],
          ['debtor', 'I\'m not paying you a cent! And the second I get out of here, I\'m calling the cops!'],
          ['narr', 'Take out the foam bat or the mallet (hotbar) and click to bonk ' + d.name + ' until they change their mind. Or just leave them down here for a while. E at the chair to talk.']]);
        break;
      }
      case 'take': {   // they offered; you take the money
        if (d.state !== 'kept' && !(d.state === 'guest' && d.res <= 0)) return;
        this.pay(pid, d);
        break;
      }
      case 'keep': {   // they offered; you don't want it. They stay.
        if (d.state !== 'guest' || d.res > 0) return;
        d.state = 'kept';
        this.addRep(3);
        say([['you', 'Keep your money.'], ['debtor', '...What? Then what do you WANT?'], ['you', 'Nothing. You live here now.'], ['debtor', 'WHAT?!'], ['narr', d.name + ' is your permanent guest. They\'ll be right here in the Time-Out Chair whenever you want to take the money after all, or let them go.']]);
        break;
      }
      case 'letgo': {  // off home, still owing you
        if (d.state !== 'guest' && d.state !== 'kept') return;
        d.state = 'late'; d.t = 0; d.res = 0;
        say([['narr', 'You take off the hood and the cuffs. ' + d.name + ' blinks at the light and sprints for the ladder.'], ['debtor', 'I STILL OWE YOU, DON\'T I?! I KNOW! I KNOW!']]);
        break;
      }
    }
    g.dirty();
  }
  /** who is in the Time-Out Chair (one at a time) */
  chairGuest() {
    const d = this.list.find(x => x.state === 'guest' || x.state === 'kept'); if (d) return d;
    // or a rival gang's guy, waiting for his boss to pay (Rivals.js)
    const c = this.W.rv?.captive;
    return c ? { id: c.id, captive: true, g: c.g, name: c.name, state: 'kept', res: 0, amount: 0 } : null;
  }
  chairTaken() { return !!this.chairGuest(); }
  /** host: somebody bonked the guest with a foam bat or a mallet */
  bonk(pid, key) {
    const g = this.g, d = this.chairGuest(); if (!d) return false;
    const ch = g.town.poi.storageChair;
    const was = d.res;
    if (d.state === 'guest' && d.res > 0) d.res = Math.max(0, d.res - (BONK[key] || 10) * (0.8 + Math.random() * 0.4));
    const line = d.captive ? pick(['OW! My boss is gonna hear about this!', 'BONK?! That\'s not in the photo!', 'OW! Fine, I\'ll tell you the secret recipe! ...It\'s frozen.', 'Hey! I\'m a HOSTAGE, not a piñata!']) : d.state === 'kept' ? 'OW! I\'m ALREADY not going anywhere!' : was > 0 && d.res <= 0 ? pick(BROKEN) : pick(BONK_YELP) + ' ' + lineFor(d.res);
    g.broadcastEvent({ k: 'guestBonk', pid, key, x: ch.x, z: ch.z, res: d.res, line, broke: was > 0 && d.res <= 0, id: d.id });
    this.addRep(0.3);
    g.dirty();
    return true;
  }
  /** where a sacked debtor currently is: in someone's arms or in a trunk */
  bagOf(id) {
    const W = this.W, is = i => i.k === 'bag' && i.id === id;
    for (const [pid, h] of Object.entries(W.hold || {})) if (h.some(is)) return { pid };
    for (const c of W.cars || []) if ((c.cargo || []).some(is)) return { car: c.id };
    return null;
  }
  /** host: the sack is gone one way or another; they go home, a bit later on their payment */
  release(d, why) {
    const W = this.W, is = i => !(i.k === 'bag' && i.id === d.id);
    for (const k of Object.keys(W.hold || {})) W.hold[k] = W.hold[k].filter(is);
    for (const c of W.cars || []) if (c.cargo) c.cargo = c.cargo.filter(is);
    d.state = d.prev === 'overdue' || d.prev === 'warned' ? 'overdue' : 'late'; d.t = 0;
    this.addRep(-1);
    this.g.tell(null, d.name + why);
    this.g.dirty();
  }
  seize(d) {
    d.state = 'seized'; d.t = rand(70, 140);
    this.addRep(2);
    this.g.sfx('whoosh', this.at(d));
  }
  pay(pid, d, returned) {
    const g = this.g, W = this.W;
    W.money += d.amount; W.stats.earned += d.amount; W.stats.collected = (W.stats.collected || 0) + d.amount;
    const wasSeized = d.state === 'seized', wasGuest = d.state === 'guest' || d.state === 'kept';
    const at = wasGuest ? g.town.poi.storageChair : this.at(d);
    this.list.splice(this.list.indexOf(d), 1);
    this.addRep(wasSeized ? 2 : wasGuest ? 3 : 4);
    g.broadcastEvent({ k: 'paid', x: at.x, z: at.z, pay: d.amount, why: 'debt', line: wasSeized ? 'Here! Here\'s your money! Now give me back my ' + this.itemOf(d) + '!' : wasGuest ? 'There! All of it! Now take this hood off and let me GO HOME!' : 'Paid in full. Please leave.', name: d.name, pid });
    if (wasSeized) g.tell(null, pick(RETURN_LINES).replace('{N}', d.name).replace('{X}', this.itemOf(d)));
    if (wasGuest) g.tell(null, d.name + ' paid ' + money(d.amount) + ', got the hood and the cuffs taken off, and ran home. Fast.');
    g.dirty();
  }

  /* ---------------- Knuckles ---------------- */
  _sendKnuckles(d) {
    const W = this.W, at = this.at(d);
    const a = nearestNode(HQ.door.x - 4, HQ.door.z), b = nearestNode(at.x, at.z);
    const route = [{ x: HQ.door.x - 2, z: HQ.door.z }, ...path(a, b).map(n => ({ x: n.x, z: n.z })), { x: at.x, z: at.z }];
    W.kn = { x: HQ.door.x - 1, z: HQ.door.z, yaw: 0, st: 'go', route, debt: d.id, t: 0 };
    this.g.tell(null, 'Knuckles: "On it, boss." (He walks. He does not drive. He doesn\'t believe in cars.)');
  }
  _knucklesHost(dt) {
    const g = this.g, W = this.W, k = W.kn;
    if (!k) return;
    if (k.st === 'go' || k.st === 'back') {
      const p = k.route[0];
      if (!p) {
        if (k.st === 'back') { W.kn = null; g.dirty(); return; }
        k.st = 'knock'; k.t = 4; g.dirty(); return;
      }
      const dx = p.x - k.x, dz = p.z - k.z, d = Math.hypot(dx, dz), sp = 5.2;
      if (d < 0.5) k.route.shift(); else { k.x += dx / d * Math.min(d, sp * dt); k.z += dz / d * Math.min(d, sp * dt); k.yaw = Math.atan2(dx, dz); }
    } else if (k.st === 'knock') {
      k.t -= dt;
      if (k.t <= 0) {
        const d = this.list.find(x => x.id === k.debt);
        if (d && d.state !== 'seized') {
          if (Math.random() < 0.55 + this.tier * 0.05) { this.pay(null, d); g.tell(null, pick(KNUCKLES.win).replace('{A}', money(d.amount)).replace('{N}', d.name)); this.addRep(1); }
          else { this.seize(d); g.tell(null, pick(KNUCKLES.seize).replace('{N}', d.name).replace('{X}', this.itemOf(d))); }
        }
        k.st = 'back'; k.route = [...k.route0 || [], { x: HQ.door.x - 1, z: HQ.door.z }];
        const a = nearestNode(k.x, k.z), b = nearestNode(HQ.door.x - 4, HQ.door.z);
        k.route = [...path(a, b).map(n => ({ x: n.x, z: n.z })), { x: HQ.door.x - 1, z: HQ.door.z }];
        g.dirty();
      }
    }
  }

  /* ---------------- the rival gang ---------------- */
  _rival(pid, a) {
    const g = this.g, W = this.W;
    if (!W.rival) return;
    const opts = ['rock', 'paper', 'scissors'];
    const theirs = pick(opts);
    const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
    let win = beats[a.pick] === theirs;
    if (a.pick === theirs) win = Math.random() < 0.5;
    W.rival = null;
    const head = [['narr', 'You throw ' + a.pick.toUpperCase() + '. They throw ' + theirs.toUpperCase() + '.' + (a.pick === theirs ? ' A tie! Sudden death: a staring contest.' : '')]];
    if (win) { W.money += 8000; W.stats.earned += 8000; this.addRep(5); g.broadcastEvent({ k: 'dlg', pid, lines: [...head, ...RIVAL.win, ['narr', '+$8,000. The Calzone Cartel retreats to fold their feelings.']] }); }
    else { const loss = Math.min(W.money, 2000); W.money -= loss; this.addRep(-3); g.broadcastEvent({ k: 'dlg', pid, lines: [...head, ...RIVAL.lose, ['narr', 'They took ' + money(loss) + ' "for the fold". Mafia rep -3.']] }); }
    g.dirty();
  }

  /* ---------------- the secret safe ---------------- */
  _safe(pid, a) {
    const W = this.W;
    if (!W.owned.up.safe) return;
    W.safe = W.safe || 0;
    if (a.op === 'in') { const n = a.amt === 'all' ? W.money : Math.min(W.money, a.amt); W.money -= n; W.safe += n; }
    else { const n = a.amt === 'all' ? W.safe : Math.min(W.safe, a.amt); W.safe -= n; W.money += n; }
    this.g.sfx('cash', null);
    this.g.dirty();
  }

  /* ---------------- everyone: what you see ---------------- */
  sync(dt) {
    const g = this.g, W = this.W, P = g.player, T = g.town;
    // debtors wait in their doorways when you come close
    const seen = new Set();
    for (const d of this.list) {
      const at = this.at(d);
      if (Math.hypot(P.pos.x - at.x, P.pos.z - at.z) > 30 || ['seized', 'bagged', 'guest', 'kept'].includes(d.state)) continue;
      seen.add(d.id);
      let r = this.rigs.get(d.id);
      if (!r) {
        const s = d.id * 7;
        r = makeChar({ skin: SKINS[s % SKINS.length], shirt: ['#f7a8c8', '#8fc1e3', '#ffd23f', '#a8e0c0', '#c9a8f0'][s % 5], pants: '#3a5a9a', hat: ['default', 'bald', 'beanie', 'default'][s % 4], hair: ['#2a1a14', '#c8742a', '#e0e0e0'][s % 3], hairStyle: ['', 'big', 'bun'][s % 3], glasses: s % 3 === 0 ? 'round' : null, belly: 1 + (s % 4) * 0.1 });
        g.scene.add(r.root); this.rigs.set(d.id, r);
      }
      const back = 1.3;
      r.root.position.set(at.x - Math.sin(at.ry) * back, 0.05, at.z - Math.cos(at.ry) * back);
      r.root.rotation.y = Math.atan2(P.pos.x - r.root.position.x, P.pos.z - r.root.position.z);
      const talking = g.ui.talking === 'debtor' && Math.hypot(P.pos.x - at.x, P.pos.z - at.z) < 6;
      r.anim(dt, { talk: talking, panic: talking && /NOT THE|TAKE/.test(g.ui.dlg?.full || '') ? 1 : 0 });
    }
    for (const [id, r] of this.rigs) if (!seen.has(id)) { g.scene.remove(r.root); this.rigs.delete(id); }
    // the guest in the Time-Out Chair: hood on, hands cuffed behind the chair
    const guest = this.chairGuest(), ch = T.poi.storageChair;
    if (guest && ch) {
      if (!this.guest || this.guest.id !== guest.id) {
        if (this.guest) g.scene.remove(this.guest.rig.root);
        const s = guest.captive ? 3 : guest.id * 7;
        const rig = makeChar(guest.captive ? { ...RIVAL_GANGS[guest.g].crew, hat: 'bald', glasses: null } : { skin: SKINS[s % SKINS.length], shirt: ['#f7a8c8', '#8fc1e3', '#ffd23f', '#a8e0c0', '#c9a8f0'][s % 5], pants: '#3a5a9a', hat: 'bald', belly: 1 + (s % 4) * 0.1 });
        rig.root.position.set(ch.x - 0.05, 0.17, ch.z); rig.root.rotation.y = Math.PI / 2;
        const hood = makeHood(rig.o.headSize || 1); rig.head.add(hood);
        for (const arm of [rig.armL, rig.armR]) { const c = makeCuff(); c.position.set(0, -0.55, 0); arm.add(c); }
        const chain = part(geo.box(), '#9a9eaa', 0, 0.86, -0.36, 0.26, 0.03, 0.03, { rough: 0.3, metal: 0.7 }); rig.body.add(chain);
        g.scene.add(rig.root); this.guest = { id: guest.id, rig, hood, t: 3, hit: 0 };
      }
      const R = this.guest.rig, kept = guest.state === 'kept';
      this.guest.hit = Math.max(0, this.guest.hit - dt);
      const hit = this.guest.hit, scared = hit > 0 ? 1 : 0;
      const talking = g.ui.talking === 'debtor' && Math.hypot(P.pos.x - ch.x, P.pos.z - ch.z) < 6;
      R.anim(dt, { sit: true, talk: talking, panic: 0 });
      // arms behind the chair, wrists cuffed together; squirming, and jolting when bonked
      const squirm = Math.sin(performance.now() * 0.006) * (kept ? 0.03 : 0.08);
      R.armL.rotation.set(0.6 + squirm, 0, 0.42); R.armR.rotation.set(0.6 - squirm, 0, -0.42);
      R.head.rotation.set(hit > 0 ? -0.35 * Math.sin(hit * 30) * hit : Math.sin(performance.now() * 0.002) * 0.08, Math.sin(performance.now() * 0.0013) * (kept ? 0.2 : 0.45), hit > 0 ? Math.sin(hit * 40) * 0.25 * hit : 0);
      R.torso.rotation.z = Math.sin(performance.now() * 0.004) * 0.05 + scared * Math.sin(hit * 35) * 0.12;
      const m = this.guest.hood.userData.mouth; if (m) m.scale.y = 0.05 * (1 + (talking || hit > 0 ? Math.abs(Math.sin(performance.now() * 0.03)) * 2.5 : 0));
      this.guest.t -= dt;
      if (this.guest.t <= 0 && Math.hypot(P.pos.x - ch.x, P.pos.z - ch.z) < 14) { this.guest.t = rand(7, 11); g.bubble(() => ({ x: ch.x, z: ch.z }), guest.captive ? pick(['My boss will pay! ...Probably. Maybe. He likes me. I think.', '(muffled) Is that a CAMERA? Get my good side!', 'You\'re gonna regret this! ...Is there a snack?', 'The boss is gonna be SO mad. At you. And at me.']) : kept ? pick(KEPT) : lineFor(guest.res)); }
    } else if (this.guest) { g.scene.remove(this.guest.rig.root); this.guest = null; }
    // the sack mumbles while you carry it
    const myBag = g.hold(g.me).find(i => i.k === 'bag');
    this.mmphT = (this.mmphT ?? 2) - dt;
    if (myBag && myBag.hostage && this.mmphT <= 0) { this.mmphT = rand(5, 9); g.bubble(g.me, pick(['(the bag) The boss is gonna be SO mad at you! ...And at me.', '(the bag) I was just looking at your oven! It\'s a nice oven!', '(the bag) Is this a ransom thing? Ask for a lot. I\'m worth a lot.', '(the bag) MMPH! Let me out and I\'ll tell you the secret recipe! (It\'s frozen.)'])); }
    else if (myBag && this.mmphT <= 0) { this.mmphT = rand(5, 9); g.bubble(g.me, pick(['(the bag) MMPH! I\'LL PAY! I\'LL PAY TUESDAY!', '(the bag) Is this a TRUNK? Are we going to a TRUNK?', '(the bag) MMMPH MMPH! (it sounds like "I want a lawyer")', '(the bag) It\'s dark in here and it smells like old onions!', '(the bag) Can I at least get a garlic knot?'])); }
    else if (!myBag) this.mmphT = Math.max(this.mmphT, 1.5);
    // confiscated things vanish from home and appear in the storage room
    const seized = this.list.filter(d => d.state === 'seized');
    for (const h of T.houses) h.vgroup.visible = !seized.some(d => d.kind === 'house' && d.ref === h.id);
    for (const [k, b] of Object.entries(T.biz)) if (b.info?.sign) b.info.sign.visible = !seized.some(d => d.kind === 'biz' && d.ref === k);
    const key = seized.map(d => d.kind + d.ref).join(',');
    if (key !== this.storageKey) {
      this.storageKey = key;
      while (this.storageGroup.children.length) this.storageGroup.remove(this.storageGroup.children[0]);
      seized.slice(0, 8).forEach((d, i) => {
        const s = T.poi.storageSlots[i];
        const v = d.kind === 'house' ? makeValuable(this.itemOf(d)) : MAFIA.crate(d.name.toUpperCase().slice(0, 14));
        v.position.set(s.x, 0.05, s.z); v.rotation.y = Math.PI; this.storageGroup.add(v);
      });
    }
    // money bags in the storage room: more cash, more bags
    const bags = Math.min(14, Math.floor(((W.money || 0) + (W.safe || 0)) / 40000));
    if (String(bags) !== this.bagsKey) {
      this.bagsKey = String(bags);
      while (this.bagsGroup.children.length) this.bagsGroup.remove(this.bagsGroup.children[0]);
      const b0 = T.poi.storageBags;
      for (let i = 0; i < bags; i++) { const b = i % 3 === 2 ? MAFIA.briefcase(false) : MAFIA.moneyBag(); b.position.set(b0.x + (i % 4) * 0.8 - 1.2, (Math.floor(i / 8)) * 0.8, b0.z + Math.floor((i % 8) / 4) * 0.8); b.rotation.y = i; this.bagsGroup.add(b); }
      if (W.owned.up.safe) { const sf = MAFIA.safe(); sf.position.set(T.poi.storageSafe.x, 0, T.poi.storageSafe.z); this.bagsGroup.add(sf); }
    }
    // knuckles and the rival, from W
    this.kn = this._actor(this.kn, W.kn, KNUCKLES_LOOK, dt, true);
    this.rival = this._actor(this.rival, W.rival ? { x: W.rival.x, z: W.rival.z, yaw: Math.atan2(P.pos.x - W.rival.x, P.pos.z - W.rival.z), st: 'stand' } : null, RIVAL_LOOK, dt);
    if (this.tier !== this.lastTier) { this.lastTier = this.tier; this.bagsKey = ''; }
  }
  _actor(rig, s, look, dt, bat) {
    const g = this.g;
    if (!s) { if (rig) g.scene.remove(rig.root); return null; }
    if (!rig) { rig = makeChar(look); g.scene.add(rig.root); if (bat) { const b = MAFIA.bat(); b.position.set(0, -0.62, 0); b.rotation.x = Math.PI; rig.armR.add(b); } rig.x = s.x; rig.z = s.z; }
    const moved = Math.hypot(s.x - rig.x, s.z - rig.z);
    rig.x += (s.x - rig.x) * Math.min(1, dt * 10); rig.z += (s.z - rig.z) * Math.min(1, dt * 10);
    rig.root.position.set(rig.x, 0.05, rig.z); rig.root.rotation.y = dampAngle(rig.root.rotation.y, s.yaw, 8, dt);
    rig.anim(dt, { speed: s.st === 'go' || s.st === 'back' ? 5 : 0, talk: s.st === 'knock' || (g.ui.talking === 'rival' && !bat), wave: s.st === 'knock' });
    return rig;
  }

  /** prompts: debtors' doors, the rival, the storage hatch, the ladder, the safe */
  targets(P, out) {
    const g = this.g, W = this.W, T = g.town.poi;
    if (P.floor !== 0) return;
    const sacks = W.inv?.[g.me]?.sack || 0, H = g.hold(g.me), top = H[H.length - 1];
    for (const d of this.list) {
      const at = this.at(d), dd = Math.hypot(P.pos.x - at.x, P.pos.z - at.z);
      if (dd > 3.4 || ['bagged', 'guest', 'kept'].includes(d.state)) continue;
      const bag = BAGGABLE.includes(d.state) && sacks > 0 ? { label: H.length ? 'Bag them (free your hands first)' : 'Bag them! (' + sacks + ' bag' + (sacks > 1 ? 's' : '') + ')', act: { k: 'debt', id: d.id, op: 'bag' } } : null;
      if (d.state === 'seized') out.push({ x: at.x, z: at.z, d: dd, label: d.name + ' is saving up. (Their ' + this.itemOf(d) + ' is in your storage room.)', info: true });
      else out.push({ x: at.x, z: at.z, d: dd - 0.2, label: 'Collect ' + money(d.amount) + ' from ' + d.name + ' (' + this.stateText(d) + ')', act: { k: 'debt', id: d.id, op: 'talk' }, debt: d.id, alt: bag });
    }
    // the Time-Out Chair
    const ch = T.storageChair;
    if (ch) {
      const dc = Math.hypot(P.pos.x - ch.x, P.pos.z - ch.z);
      if (dc < 2.6) {
        const guest = this.chairGuest();
        if (guest && guest.captive) { /* Rivals.js handles its own guest */ }
        else if (top && top.k === 'bag' && !top.hostage) out.push({ x: ch.x, z: ch.z, d: dc - 0.5, label: guest ? 'The Time-Out Chair is taken (' + guest.name + ')' : 'Sit ' + top.name + ' in the Time-Out Chair (hood and cuffs)', act: guest ? null : { k: 'debt', id: top.id, op: 'seat' }, warn: !!guest });
        else if (guest) {
          const eq = W.eq?.[g.me], bat = eq === 'foambat' || eq === 'mallet';
          const what = guest.state === 'kept' ? guest.name + ', your permanent guest' : guest.res > 0 ? guest.name + ' (resolve ' + Math.ceil(guest.res) + '%, owes ' + money(guest.amount) + ')' : guest.name + ' is ready to pay ' + money(guest.amount);
          out.push({ x: ch.x, z: ch.z, d: dc, label: 'Talk to ' + what + (bat && guest.state === 'guest' && guest.res > 0 ? ' · click: BONK' : guest.state === 'guest' && guest.res > 0 ? ' · a foam bat or mallet would help' : ''), fn: () => this.guestMenu(guest.id) });
        }
        else out.push({ x: ch.x, z: ch.z, d: dc, label: 'The Time-Out Chair. Bring a debtor in a trash bag (Comically Large Trash Bag: General store).', info: true });
      }
    }
    if (W.rival) { const dd = Math.hypot(P.pos.x - W.rival.x, P.pos.z - W.rival.z); if (dd < 3) out.push({ x: W.rival.x, z: W.rival.z, d: dd, label: 'Confront the Calzone Cartel', local: 'rival' }); }
    if (W.quest >= Q.FIND) {
      const h = T.storageHatch, dh = Math.hypot(P.pos.x - h.x, P.pos.z - h.z);
      if (dh < 1.8) out.push({ x: h.x, z: h.z, d: dh, label: 'Climb down to the hidden storage room', local: 'storageIn' });
    }
    const e = T.storageExit, de = Math.hypot(P.pos.x - e.x, P.pos.z - e.z);
    if (de < 1.8) out.push({ x: e.x, z: e.z, d: de, label: 'Climb the ladder back up to the yard', local: 'storageOut' });
    const s = T.storageSafe, ds = Math.hypot(P.pos.x - s.x, P.pos.z - s.z);
    if (ds < 2) out.push({ x: s.x, z: s.z, d: ds, label: W.owned.up.safe ? 'Open the secret safe (' + money(W.safe || 0) + ' inside)' : 'An empty spot for a safe (buy a Secret Safe on the laptop)', local: W.owned.up.safe ? 'safe' : null, info: !W.owned.up.safe });
  }

  /* ---------------- local menus ---------------- */
  menuFor(id) {
    const g = this.g, d = this.list.find(x => x.id === id); if (!d) return;
    const items = [];
    if (d.pressed !== d.state) items.push({ label: 'Pay up. NOW.', sub: 'Lean in. Look serious. (It works better in a suit.)', on: () => g.act({ k: 'debt', id, op: 'press' }) });
    if (['owed', 'late'].includes(d.state)) items.push({ label: 'You have until tomorrow.', sub: 'Set a deadline. If they miss it, you can take their ' + this.itemOf(d) + '.', on: () => g.act({ k: 'debt', id, op: 'deadline' }) });
    if (d.state === 'overdue') items.push({ label: 'We\'re taking the ' + this.itemOf(d) + '.', sub: 'Confiscate it until they pay. It goes to your hidden storage room.', on: () => g.act({ k: 'debt', id, op: 'seize' }) });
    if (BAGGABLE.includes(d.state) && (g.W.inv?.[g.me]?.sack || 0) > 0) items.push({ label: 'Get in the bag.', sub: 'Bag them, put them in a trunk, sit them in the Time-Out Chair until they pay. Police will NOT like it.', on: () => g.act({ k: 'debt', id, op: 'bag' }) });
    items.push({ label: 'Forget it. You\'re forgiven.', sub: 'Lose the money. Gain a friend. Mafia rep -1.', on: () => g.act({ k: 'debt', id, op: 'forgive' }) });
    items.push({ label: 'Leave' });
    g.ui.menu({ title: d.name + ' owes ' + money(d.amount), sub: d.reason + ' · ' + this.stateText(d), items });
  }
  /** E at the Time-Out Chair */
  async guestMenu(id) {
    const g = this.g, d = this.list.find(x => x.id === id); if (!d) return;
    SPEAKERS.debtor = { name: d.name, color: '#c8c8d8' };
    const items = [];
    if (d.state === 'guest' && d.res > 0) {
      items.push({ label: 'Ready to pay up?', sub: 'Resolve ' + Math.ceil(d.res) + '%. Bonk them with a foam bat or the mallet (click) to change their mind, or leave them down here a while.', on: () => g.ui.dialog([['you', 'Ready to pay up?'], ['debtor', lineFor(d.res)]]) });
    }
    if (d.state === 'guest' && d.res <= 0) {
      items.push({ label: 'Take the money (' + money(d.amount) + ')', sub: 'Hood off, cuffs off, they run home. Debt paid.', on: () => g.act({ k: 'debt', id, op: 'take' }) });
      items.push({ label: 'Don\'t take it. Keep them.', sub: 'You don\'t want their money. They stay here, in the chair, for good. (Mafia rep +3)', on: () => g.act({ k: 'debt', id, op: 'keep' }) });
    }
    if (d.state === 'kept') {
      items.push({ label: 'Say hello', on: () => g.ui.dialog([['you', 'Hello.'], ['debtor', pick(KEPT)]]) });
      items.push({ label: 'Take the money after all (' + money(d.amount) + ')', sub: 'They pay, and you let them go home.', on: () => g.act({ k: 'debt', id, op: 'take' }) });
    }
    items.push({ label: 'Let them go home', sub: 'Hood off, cuffs off. They still owe you.', on: () => g.act({ k: 'debt', id, op: 'letgo' }) });
    items.push({ label: 'Leave' });
    g.ui.menu({ title: d.name + ' (in the Time-Out Chair)', sub: 'Owes ' + money(d.amount) + ' · ' + this.stateText(d), items });
  }
  /** everyone: a bonk landed on the guest */
  onBonk(e) {
    const g = this.g, at = new THREE.Vector3(e.x, 1.9, e.z);
    if (this.guest) this.guest.hit = 0.5;
    g.fx.text(e.key === 'mallet' ? 'BONK!!' : 'BONK!', at, '#ffd23f', true);
    g.fx.sparkle(e.x, 1.7, e.z, '#ffd23f');
    g.audio.thud({ x: e.x, z: e.z });
    g.bubble(() => ({ x: e.x, z: e.z }), e.line);
    if (e.broke && e.pid === g.me) { g.ui.alarm('THEY\'LL PAY!'); setTimeout(() => this.guestMenu(e.id), 1400); }
  }
  phoneMenu() {
    const g = this.g, W = this.W;
    const items = this.list.map(d => ({
      label: d.name + ' owes ' + money(d.amount), sub: (d.kind === 'biz' ? 'Business · ' : '') + this.at(d).addr + ' · ' + this.stateText(d), price: d.state.toUpperCase(),
      owned: d.state === 'seized', keep: false,
      on: () => g.ui.menu({ title: d.name, sub: money(d.amount) + ' · ' + d.reason + ' · ' + this.stateText(d), items: [
        { label: 'Show on the map', on: () => g.map.show() },
        { label: 'Send Knuckles', sub: W.owned.up.knuckles ? (W.kn ? 'Knuckles is already out on a job.' : 'He walks over, knocks, and comes back with the money or their ' + this.itemOf(d) + '.') : 'Hire Knuckles on the laptop first (Mafia Rep: The Crust Family).', disabled: !W.owned.up.knuckles || !!W.kn || !['late', 'warned', 'overdue'].includes(d.state), on: () => g.act({ k: 'debt', id: d.id, op: 'knuckles' }) },
        { label: 'Forgive the debt', sub: 'Mafia rep -1. They will love you forever. Probably.', on: () => g.act({ k: 'debt', id: d.id, op: 'forgive' }) },
        { label: 'Back', on: () => this.phoneMenu() },
      ] }),
    }));
    if (!items.length) items.push({ label: 'Nobody owes you anything. Suspicious.', disabled: true });
    const t = this.tier;
    g.ui.menu({ title: 'Debts', sub: 'Mafia Rep: ' + TIERS[t].name + ' (' + Math.round(W.mrep || 0) + ') — ' + TIERS[t].desc, items: [...items, { label: 'Back to orders', on: () => g.phone() }], cls: 'phone' });
  }
  safeMenu() {
    const g = this.g, W = this.W;
    g.ui.menu({ title: 'Secret Safe', sub: 'Money in here can\'t be fined or confiscated. In the wallet: ' + money(W.money) + ' · In the safe: ' + money(W.safe || 0), items: [
      { label: 'Put everything in', disabled: W.money <= 0, on: () => g.act({ k: 'safe', op: 'in', amt: 'all' }) },
      { label: 'Put $10,000 in', disabled: W.money < 10000, on: () => g.act({ k: 'safe', op: 'in', amt: 10000 }) },
      { label: 'Take $10,000 out', disabled: (W.safe || 0) < 10000, on: () => g.act({ k: 'safe', op: 'out', amt: 10000 }) },
      { label: 'Take everything out', disabled: !(W.safe > 0), on: () => g.act({ k: 'safe', op: 'out', amt: 'all' }) },
      { label: 'Close' },
    ] });
  }
  async rivalTalk() {
    const g = this.g;
    await g.ui.dialog(RIVAL.meet);
    if (!g.W.rival) return;
    g.ui.menu({ title: 'Rock, paper, scissors', sub: 'Win: their money and respect. Lose: your lunch money.', items: ['rock', 'paper', 'scissors'].map(p => ({ label: p.toUpperCase(), on: () => g.act({ k: 'rival', pick: p }) })) });
  }
}
