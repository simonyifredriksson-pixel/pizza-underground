/* Game.js - holds everything together.

   The host (or the solo player) owns W, the world state, and runs the
   simulation: kitchen, orders, police, events. Everyone else sends actions
   ("put this in the oven") and receives W ten times a second. Every
   player moves their own character and drives their own car. */
import * as THREE from '../../lib/three.module.js';
import { Town, HQ, HOSPITAL_SET, ROADS } from '../world/Town.js';
import { textTexture } from '../art/Mesher.js';
import { Player, Remote } from './Player.js';
import { Kitchen, pizzaName, cookWord, COOKED, BURNT } from './Kitchen.js';
import { Orders, recipeText } from './Orders.js';
import { Police } from './Police.js';
import { Vehicles, Traffic } from './Vehicles.js';
import { Citizens } from './Citizens.js';
import { NPCs } from './NPCs.js';
import { Quest } from './Quest.js';
import { Events } from './Events.js';
import { Intro } from './Intro.js';
import { Debts } from './Debts.js';
import { Inspections } from './Inspections.js';
import { Weather } from './Weather.js';
import { Admin } from '../ui/Admin.js';
import { BlackMarket } from './BlackMarket.js';
import { Inventory } from '../ui/Inventory.js';
import { GROCERY, EQUIPMENT, GENERAL } from '../data/Data.js';
import { makeCar, makeItem } from '../art/Props.js';
import { makeChar } from '../art/Chars.js';
import { tierOf, TIERS, NERVOUS } from '../data/Mafia.js';
import { Effects } from './Effects.js';
import { UI } from '../ui/UI.js';
import { MapView } from '../ui/MapView.js';
import { newWorld, loadWorld, saveWorld, isContraband, saveProfile } from './State.js';
import { STATIONS, STATION, roomAt } from '../data/Hideout.js';
import { SUPPLIERS, SCAM_TEXT, ADD_KEYS, STOCK_NAME, VEHICLES, DISGUISES, UPGRADES, HQ_LEVELS, OVEN_PRICE, BARK, CLUES, filter } from '../data/Data.js';
import { Q, FINALE, SPEAKERS } from '../data/Story.js';
import { clamp, damp, dampAngle, pick, money, rand, wrapAngle } from '../core/Util.js';

export class Game {
  constructor({ renderer, scene, camera, input, audio, net, profile }) {
    Object.assign(this, { renderer, scene, camera, input, audio, net, profile });
    this.W = newWorld();
    this.remotes = new Map();
    this.cam = { override: null, snap: true, mode: 'first', fpPitch: 0, pitch: 0.38, dist: 6.5, pos: new THREE.Vector3(), look: new THREE.Vector3(), carYaw: 0, free: 0 };
    this.mesher = { textTexture };
    this.kitchenNames = { pizzaName };
    this.phase = 'title';
    this._dirty = false; this._saveT = 0;
    this.natural = false; this.holdT = 0; this.holdKey = null;
    this.sprayT = 0;
    this.lastAct = new Map();
    this.chased = false;
  }

  get isHost() { return !this.net.isClient; }
  get me() { return this.net.isOnline ? this.net.selfId : 'me'; }

  build() {
    const S = this.scene;
    this.town = new Town(S); this.town.build();
    this.fx = new Effects(S);
    this.ui = new UI(this);
    this.map = new MapView(this);
    this.player = new Player(this, this.profile.look);
    this.kitchen = new Kitchen(this);
    this.orders = new Orders(this);
    this.police = new Police(this);
    this.vehicles = new Vehicles(this);
    this.traffic = new Traffic(this, 12);
    this.citizens = new Citizens(this, 26);
    this.npcs = new NPCs(this);
    this.story = new Quest(this);
    this.events = new Events(this);
    this.intro = new Intro(this);
    this.debts = new Debts(this);
    this.inspections = new Inspections(this);
    this.weather = new Weather(this);
    this.admin = new Admin(this);
    this.bm = new BlackMarket(this);
    this.inv = new Inventory(this);
    this._netHooks();
  }

  /* ---------------- starting ---------------- */
  /** solo / host: fresh = start a new story */
  begin(fresh) {
    if (fresh || !this.isHost) { if (this.isHost) this.W = newWorld(); }
    else { const w = loadWorld(); if (w) this.W = w; }
    // a solo save played as a co-op host: what "me" held is now the host's
    const W = this.W;
    if (this.isHost && this.me !== 'me' && W.hold.me) { W.hold[this.me] = W.hold.me; delete W.hold.me; if (W.wear.me) { W.wear[this.me] = W.wear.me; delete W.wear.me; } }
    this.phase = 'play';
    this.ui.hudVisible(true);
    if (this.W.quest <= Q.HOSPITAL) this.runIntro();
    else this.spawnInTown();
  }
  async runIntro() {
    this.phase = 'intro';
    this.ui.hudVisible(false);
    await this.intro.car();
    this.W.quest = Math.max(this.W.quest, Q.HOSPITAL);
    this.phase = 'hospital';
    const bed = this.net.isOnline ? [this.net.selfId, ...this.net.profiles.keys()].sort().indexOf(this.net.selfId) : 0;
    await this.intro.hospital(Math.max(0, bed));
    this.ui.hudVisible(true);
    this.phase = 'play';
    this.act({ k: 'q', what: 'woke' });
  }
  spawnInTown() {
    const W = this.W, P = this.player;
    this.intro.leaveHospital();
    if (W.quest >= Q.CLEAN) P.teleport(HQ.door.x - 2.5, HQ.door.z + (Math.random() - 0.5) * 2, 0, Math.PI / 2);
    else { const d = this.town.poi.hospitalDoor; P.teleport(d.x + (Math.random() - 0.5) * 3, d.z, 0, Math.PI); }
    this.cam.snap = true;
  }
  leaveHospital() {
    this.intro.leaveHospital();
    const d = this.town.poi.hospitalDoor;
    this.ui.fade(true);
    setTimeout(() => {
      this.player.teleport(d.x + (Math.random() - 0.5) * 2, d.z - 1, 0, Math.PI);
      this.cam.snap = true;
      this.ui.fade(false);
      this.act({ k: 'q', what: 'leave' });
      this.ui.news('Crumbville: the new Crumb Mall is open! Also: the weather is nice. That is all the news.');
      setTimeout(() => this.bubble(this.me, 'Three weeks... I am STARVING. I could eat a whole pizza.'), 1500);
    }, 500);
  }

  /* ---------------- the world state helpers ---------------- */
  hold(pid) {
    if (this.isHost) return this.W.hold[pid] || (this.W.hold[pid] = []);
    return this.W.hold[pid] || [];
  }
  setHold(pid, arr) { this.W.hold[pid] = arr; this.dirty(); }
  dirty() { this._dirty = true; }
  frozen() { return this.ui.inDialog || !!this.ui.menuOpen || this.phase !== 'play' || !!this.cam.override || this.chatOpen || this.admin?.open || !!this.inv?.open; }
  allPlayers() {
    const P = this.player;
    const me = { id: this.me, x: P.pos.x, z: P.pos.z, floor: P.floor, hidden: !!P.hidden, car: P.car, carSeat: P.seat, run: P.running && P.speed > 6, nat: this.natural };
    const out = [me];
    for (const r of this.remotes.values()) if (r.s) out.push({ id: r.id, x: r.s.x, z: r.s.z, floor: r.s.f | 0, hidden: !!r.s.h, car: r.s.car?.id || null, carSeat: r.s.car?.seat ?? 0, run: !!r.s.run, nat: !!r.s.nat });
    return out;
  }
  addHeat(n) { const W = this.W; W.heat = clamp(W.heat + n * (W.law?.k === 'curfew' ? 1.5 : 1), 0, 100); }

  /* ---------------- actions: everyone asks, the host does ---------------- */
  act(a) {
    // don't spam the same story trigger every frame
    if (a.k === 'q' || a.k === 'report') { const key = a.k + a.what + (a.small || ''); const t = this.lastAct.get(key) || 0; if (performance.now() - t < 1500) return; this.lastAct.set(key, performance.now()); }
    if (this.isHost) this.exec(this.me, a);
    else this.net.sendAction(a);
  }
  exec(pid, a) {
    const W = this.W, H = this.hold(pid);
    try {
      switch (a.k) {
        case 'use': this.kitchen.use(pid, a); break;
        case 'pile': this.kitchen.pile(pid, a.i); break;
        case 'spray': this.kitchen.spray(pid, a); break;
        case 'q': this.story.hostAction(pid, a); break;
        case 'deliver': this.orders.deliver(pid, a.id, a.car); break;
        case 'shop': this._shop(pid, a); break;
        case 'cargo': this.vehicles.cargo(pid, a); break;
        case 'van': this.events.grabCrate(pid); break;
        case 'board': W.boardFlipped = !W.boardFlipped; this.sfx('whoosh', { x: 146, z: 73 }); this.dirty(); break;
        case 'smoke': {
          const inv = (W.inv = W.inv || {})[pid]; if (!inv || !inv.smoke) break;
          inv.smoke--;
          for (const c of this.police.cops) if (c.st === 'chase' && c.tgt === pid) { c.st = 'search'; c.searchT = 6; c.tx = c.x; c.tz = c.z; c.tgt = null; c.sus = {}; }
          for (const c of this.police.cars) if (c.st === 'chase') { const v = W.cars.find(v => v.id === c.tgt); if (v && (v.drv === pid || v.pas.includes(pid))) c.st = 'return'; }
          this.broadcastEvent({ k: 'smoke', x: a.x, z: a.z }); this.dirty(); break;
        }
        case 'accept': this.orders.accept(pid, a.id); break;
        case 'decline': this.orders.decline(pid, a.id); break;
        case 'clue': this.story.onClue(pid, a.id); break;
        case 'debt': case 'rival': case 'safe': this.debts.exec(pid, a); break;
        case 'bm': this.bm.exec(pid, a); break;
        case 'toss': {
          const it = H.pop(); if (!it) break;
          if (it.k === 'ext') { const st = this.kitchen.st(it.from || 'ext1'); st.ext = true; this.tell(pid, 'The extinguisher magically returns to the wall. (Physics.)'); }
          else if (it.k === 'bag') { this.fxAt('poof', a.x, 0.6, a.z); const d = this.debts.list.find(x => x.id === it.id); if (d && d.state === 'bagged') this.debts.release(d, ' hit the ground, wriggled out of the trash bag and ran home yelling "I\'M TELLING!"'); }
          else this.fxAt('splat', a.x, 1.2, a.z);
          this.sfx('splat', a); this.dirty(); break;
        }
        case 'dropAll': {
          const lost = H.filter(i => i.k === 'box' || i.k === 'pizza' || i.k === 'base' || i.k === 'dough').length;
          this.W.hold[pid] = H.filter(i => !(i.k === 'box' || i.k === 'pizza' || i.k === 'base' || i.k === 'dough'));
          if (lost) { this.fxAt('splat', a.x, 1, a.z); this.tell(pid, 'You dropped ' + lost + ' pizza' + (lost > 1 ? 's' : '') + '. RIP.'); }
          this.dirty(); break;
        }
        case 'report': {
          this.addHeat(a.small ? 1 : 3); this.inspections.tip(a.small ? 0.5 : 2);
          const cop = this.police.cops.filter(c => c.st === 'patrol' && c.kind === 'cop').sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z))[0];
          if (cop && Math.hypot(cop.x - a.x, cop.z - a.z) < 90) { cop.st = 'search'; cop.searchT = 14; cop.tx = a.x; cop.tz = a.z; }
          break;
        }
        case 'enter': this.vehicles.enter(pid, a.id); break;
        case 'exit': this.vehicles.exit(pid); break;
        case 'buy': this._buy(pid, a); break;
        case 'buyOven':
          if (W.oven1 || W.money < OVEN_PRICE) break;
          W.money -= OVEN_PRICE; W.oven1 = true; this.sfx('cash', null);
          this.story.onOven(); this.dirty(); break;
        case 'buyCar': {
          const v = VEHICLES[a.kind]; if (!v || W.owned.veh.includes(a.kind) || W.money < v.price) break;
          W.money -= v.price; W.owned.veh.push(a.kind);
          this._spawnBought(a.kind);
          this.tell(pid, 'Your ' + v.name + ' is waiting at the Crumb Mall entrance (west side). Get in with F. Load it at the back (E).'); this.sfx('cash', null); this.dirty(); break;
        }
        case 'buyDisg': {
          const d = DISGUISES[a.d]; if (!d || W.owned.disg.includes(a.d) || W.money < d.price) break;
          W.money -= d.price; W.owned.disg.push(a.d); W.wear[pid] = a.d; this.sfx('cash', null); this.dirty(); break;
        }
        case 'wear': if (!a.d || W.owned.disg.includes(a.d)) { W.wear[pid] = a.d || null; this.dirty(); } break;
        case 'level': {
          const next = HQ_LEVELS[W.level + 1]; if (!next || W.money < next.price) break;
          W.money -= next.price; W.level++;
          if (W.level >= 5) W.sign = 'empire';
          this.broadcastEvent({ k: 'levelup', l: W.level, name: next.name });
          this.story.onLevel(W.level); this.dirty(); break;
        }
        case 'upgrade': {
          const u = UPGRADES[a.u]; if (!u || W.owned.up[a.u] || W.money < u.price || (u.level && W.level < u.level)) break;
          W.money -= u.price; W.owned.up[a.u] = true; this.sfx('cash', null); this.tell(null, u.name + ': done.'); this.dirty(); break;
        }
        case 'sign': W.sign = W.sign === 'closed' ? (W.level >= 5 ? 'empire' : 'shoes') : 'closed'; this.dirty(); break;
        case 'tow': {
          if (W.money < 200) break; W.money -= 200;
          const g = this.town.poi.garage;
          W.cars.forEach((c, n) => { if (c.drv || c.pas.length) return; c.x = g.x - (n % 3) * 4.5; c.z = g.z - Math.floor(n / 3) * 6; c.yaw = Math.PI; });
          this.tell(pid, 'Hank\'s cousin dragged your cars home. Do not ask what happened to the paint.'); this.dirty(); break;
        }
        case 'foundCheese':
          if (W.event?.k === 'cheeseMissing' && !W.event.found) {
            W.event.found = true; W.stock.cheese += 5;
            this.sayAll([['cheese', 'Oh. Hey, partner. I got lost. In my defense, I am a cheese.'], ['cheese', 'Here, five cheese on the house. Don\'t tell nobody. I\'m goin\' home.']]);
            this.dirty();
          }
          break;
        case 'chat':
          if (W.law?.k === 'word' && /pizza/i.test(a.text)) { W.money = Math.max(0, W.money - 50); this.tell(null, 'Someone said the P-word in chat. $50 fine. (It\'s Hot Bread Circle now.)'); }
          break;
        case 'busted': break;
      }
    } catch (e) { console.error('exec', a, e); }
  }
  _buy(pid, a) {
    const W = this.W, s = SUPPLIERS[a.sup]; if (!s) return;
    const it = s.sells[a.i]; if (!it) return;
    if (a.sup === 'cheese' && W.event?.k === 'cheeseMissing' && !W.event.found) return;
    const price = it.item === 'cheese' && W.law?.k === 'license' ? it.price * 2 : it.price;
    if (W.money < price) return;
    W.money -= price;
    if (it.scam && Math.random() < it.scam) {
      this.broadcastEvent({ k: 'scam', pid, text: SCAM_TEXT[it.item] });
    } else {
      W.stock[it.item] += Math.round(it.qty * (W.owned.up.bigfridge ? 1.5 : 1) * (this.debts.tier >= 5 ? 1.5 : 1));
      this.sfx('cash', null);
    }
    this.story.onStock();
    this.dirty();
  }

  /** a newly bought vehicle appears outside the mall, next to whatever else is parked there */
  _spawnBought(kind) {
    const W = this.W, L = this.town.poi.mallLot;
    let x = L.x, z = L.z;
    for (let i = 0; i < 6; i++) { const zz = L.z + (i % 3 - 1) * 2.6 * 1.2, xx = L.x - Math.floor(i / 3) * 8; if (!W.cars.some(c => Math.hypot(c.x - xx, c.z - zz) < 3)) { x = xx; z = zz; break; } }
    W.cars.push({ id: W.carSeq++, kind, x, z, yaw: L.yaw, drv: null, pas: [], cargo: [] });
  }

  /** the host: something bought off a shelf in the mall */
  _shop(pid, a) {
    const W = this.W, H = this.hold(pid), tier = this.debts.tier;
    const pay = (p) => { if (W.money < p) { this.tell(pid, 'You can\'t afford that (' + money(p) + ').'); return false; } W.money -= p; W.stats.spent = (W.stats.spent || 0) + p; this.sfx('cash', null); return true; };
    if (a.cat === 'grocery') {
      const it = GROCERY.find(i => i.key === a.key); if (!it) return;
      if (W.shortage && W.shortage.s === it.stock) return this.tell(pid, 'Sold out! (Try an underground supplier: they always have it.)');
      if (H.some(i => i.k !== 'crate' && i.k !== 'box')) return this.tell(pid, 'Your hands are full.');
      if (H.filter(i => i.k === 'crate').length >= 4) return this.tell(pid, 'You can carry 4 crates. Load them into a car (or make another trip).');
      const price = it.stock === 'cheese' && W.law?.k === 'license' ? it.price * 2 : it.price;
      if (!pay(price)) return;
      H.push({ k: 'crate', s: it.stock, n: Math.round(it.qty * (W.owned.up.bigfridge ? 1.5 : 1) * (tier >= 5 ? 1.5 : 1)) });
    } else if (a.cat === 'equipment') {
      if (a.key === 'oven1') {
        if (W.oven1) return this.tell(pid, 'You already have an oven. More ovens come with a bigger hideout (laptop).');
        if (!pay(OVEN_PRICE)) return;
        W.oven1 = true; this.tell(pid, 'The oven is being delivered to the hideout. Do not ask how.'); this.story.onOven();
      } else {
        const it = EQUIPMENT.find(i => i.key === a.key); if (!it) return;
        if (W.owned.up[a.key]) return this.tell(pid, 'You already own that.');
        if (a.key === 'safe' && tier < 1) return this.tell(pid, 'The clerk squints. "Safes are for... established businesses." (Mafia Rep: Those Pizza Guys)');
        if (!pay(it.price)) return;
        W.owned.up[a.key] = true; this.tell(pid, it.label + ': installed at the hideout.');
      }
    } else if (a.cat === 'general') {
      const it = GENERAL.find(i => i.key === a.key); if (!it) return;
      const inv = (W.inv = W.inv || {})[pid] || (W.inv[pid] = { smoke: 0 });
      if (it.disg) {
        if (W.owned.disg.includes(a.key)) { W.wear[pid] = W.wear[pid] === a.key ? null : a.key; this.dirty(); return; }
        if (it.tier && tier < it.tier) return this.tell(pid, 'Not for just anyone. (Mafia Rep: The Crust Family)');
        if (!pay(it.price)) return;
        W.owned.disg.push(a.key); W.wear[pid] = a.key;
      } else if (a.key === 'smoke') { if (!pay(it.price)) return; inv.smoke++; this.tell(pid, 'Smoke bombs: ' + inv.smoke + '. Press G to vanish.'); }
      else if (a.key === 'sack') { if (!pay(it.price)) return; inv.sack = (inv.sack || 0) + 1; this.tell(pid, 'Comically Large Trash Bags: ' + inv.sack + '. Find someone who owes you money. Press R at their door.'); }
      else if (a.key === 'energy') { if (!pay(it.price)) return; this.broadcastEvent({ k: 'energy', pid }); }
      else if (a.key === 'fresh') { if (!pay(it.price)) return; W.fresh = 180; this.tell(pid, 'The hideout now smells like a pine forest. For 3 minutes.'); }
      else if (a.key === 'license') { if (W.license) return this.tell(pid, 'You already have one. One forgery at a time.'); if (!pay(it.price)) return; W.license = true; }
    } else if (a.cat === 'vehicle') {
      return this.exec(pid, { k: 'buyCar', kind: a.key });
    } else if (a.cat === 'bm') {
      return this.bm.buy(pid, a.key);
    }
    this.dirty();
  }
  /** how a product on a shelf describes itself to you */
  shopLabel(s) {
    const W = this.W, tier = this.debts.tier;
    if (s.cat === 'grocery') { const it = GROCERY.find(i => i.key === s.key); if (W.shortage?.s === it.stock) return { label: it.label + ': SOLD OUT', warn: true }; return { label: 'Buy ' + it.label + ' - ' + money(it.price) + ' (a crate)' }; }
    if (s.cat === 'equipment') { const it = EQUIPMENT.find(i => i.key === s.key); const own = s.key === 'oven1' ? W.oven1 : W.owned.up[s.key]; const sub = it.desc || UPGRADES[s.key]?.desc || ''; return own ? { label: it.label + ': OWNED. ' + sub, info: true } : { label: 'Buy ' + it.label + ' - ' + money(it.price) + '. ' + sub }; }
    if (s.cat === 'general') { const it = GENERAL.find(i => i.key === s.key); if (it.disg && W.owned.disg.includes(s.key)) return { label: (W.wear[this.me] === s.key ? 'Take off: ' : 'Wear: ') + it.label.replace(/ \(.*/, '') }; const lock = it.tier && tier < it.tier; return lock ? { label: it.label + ' (Mafia Rep: The Crust Family)', warn: true } : { label: 'Buy ' + it.label + ' - ' + money(it.price) + (it.desc ? '. ' + it.desc : '') }; }
    if (s.cat === 'bm') return this.bm.shopLabel(s);
    if (s.cat === 'vehicle') {
      const v = VEHICLES[s.key];
      if (W.owned.veh.includes(s.key)) return { label: v.name + ': OWNED (cargo ' + v.cap + ')', info: true };
      if (v.tier && tier < v.tier) return { label: v.name + ' - for the family only (Mafia Rep: Made Men)', warn: true };
      if (s.key === 'armored' && W.level < 4) return { label: v.name + ' - for serious operations (HQ level 4)', warn: true };
      return { label: 'Buy the ' + v.name + ' - ' + money(v.price) + ' · cargo ' + v.cap + ' · ' + v.desc };
    }
    return { label: '?' };
  }

  /** the host: a player gets caught */
  bust(pid, line, pct, heat, cop) {
    const W = this.W, H = this.hold(pid);
    const n = H.filter(isContraband).length;
    this.W.hold[pid] = H.filter(i => !isContraband(i));
    const fine = Math.min(W.money, Math.round(500 + W.money * pct));
    W.money -= fine; W.stats.busted++;
    this.addHeat(heat); this.inspections.tip(3);
    this.broadcastEvent({ k: 'busted', pid, line, fine, n, cop: cop ? cop.id : 0 });
    this.dirty();
  }

  /* ---------------- events: the host tells everyone ---------------- */
  broadcastEvent(e) {
    if (!this.isHost) return;
    this.onEvent(this.me, e);
    if (this.net.isOnline) this.net.sendEvent(e);
  }
  tell(pid, text) { this.broadcastEvent({ k: 'tell', pid, text }); }
  sayAll(lines) { this.broadcastEvent({ k: 'dlg', lines }); }
  say(pid, lines) { this.broadcastEvent({ k: 'dlg', lines, pid }); }
  alarm(text) { this.broadcastEvent({ k: 'alarm', text }); }
  sfx(s, p) { this.broadcastEvent({ k: 'sfx', s, x: p?.x, z: p?.z }); }
  fxAt(t, x, y, z, c) { this.broadcastEvent({ k: 'fx', t, x, y, z, c }); }

  onEvent(from, e) {
    if (!e || typeof e !== 'object') return;
    const ui = this.ui, P = this.player, a = this.audio;
    const mine = e.pid == null || e.pid === this.me;
    switch (e.k) {
      case 'tell': if (mine) ui.toast(e.text); break;
      case 'dlg': if (mine && this.phase === 'play') { if (e.who) Object.assign(SPEAKERS, e.who); ui.dialog(e.lines); } break;
      case 'insp':
        if (e.ph === 'warn') { a.fail(); ui.news('POLICE INSPECTION: ' + e.why); this.inspBeep = 99; }
        if (e.ph === 'arrive') a.hey(null);
        if (e.ph === 'done') { if (e.score <= 0) a.cheer(); else a.fail(); }
        break;
      case 'inspFound': ui.toast('EVIDENCE +' + e.pts + ': ' + e.line, 'bad'); break;
      case 'energy': if (e.pid === this.me) { P.boost = 60; ui.toast('LIQUID PANIC: you run 40% faster for 60 seconds. Your heart sounds like a drum solo.'); a.cheer(); } break;
      case 'smoke': this.fx.smoke(e.x, 0.5, e.z, 30, 0.2); this.fx.poof(e.x, 1, e.z); a.whoosh(); if (Math.hypot(P.pos.x - e.x, P.pos.z - e.z) < 6) ui.alarm('POOF!'); break;
      case 'tp': if (e.pid === this.me) { P.teleport(e.x, e.z, e.floor || 0); this.cam.snap = true; ui.toast('An admin teleported you.'); } break;
      case 'debtMenu': if (e.pid === this.me) { const open = () => (ui.inDialog ? setTimeout(open, 200) : this.debts.menuFor(e.id)); setTimeout(open, 300); } break;
      case 'alarm': ui.alarm(e.text); a.fail(); break;
      case 'bmReveal': case 'gear': this.bm.onEvent(e); break;
      case 'guestBonk': this.debts.onBonk(e); break;
      case 'news': ui.news(e.text); break;
      case 'sfx': if (a[e.s]) a[e.s](e.x != null ? { x: e.x, z: e.z } : null); break;
      case 'fx': {
        const f = this.fx;
        if (e.t === 'cheese') f.cheeseExplosion(e.x, e.y, e.z);
        else if (e.t === 'splat') f.splat(e.x, e.y, e.z);
        else if (e.t === 'poof') f.poof(e.x, e.y, e.z);
        else if (e.t === 'sparkle') f.sparkle(e.x, e.y, e.z, e.c);
        break;
      }
      case 'ding': a.ding(); a.phone(); ui.toast('DING DING! New order on your phone (TAB)', 'order'); break;
      case 'paid': {
        const pos = new THREE.Vector3(e.x, 2.4, e.z);
        this.fx.text(e.pay > 0 ? '+' + money(e.pay) : e.why === 'tab' ? 'ON THE TAB' : '$0', pos, e.pay > 0 ? '#43e07a' : e.why === 'tab' ? '#ffd23f' : '#ff5a5a', true);
        this.bubble({ x: e.x, z: e.z }, e.line);
        if (e.pay > 0) { a.cash(); this.fx.sparkle(e.x, 1.6, e.z, '#43e07a'); } else a.deny();
        if (e.why === 'soap') this.fx.foam(e.x, 1.4, e.z);
        break;
      }
      case 'bark': { const r = this.police.copRig(e.cop); if (r) { this.ui.bubble(() => r.rig.root.position, e.text, '#6f8fd8'); r.talkT = 1.5; } break; }
      case 'spotted': if (e.pid === this.me) { ui.alarm(e.car ? 'THE COPS ARE ON YOUR TAIL!' : 'SPOTTED!'); a.hey(null); } break;
      case 'lostcar': if (this.vehicles.local) ui.toast('You lost the cops. Nice driving.'); break;
      case 'busted':
        if (e.pid === this.me) {
          P.stun = 2.2;
          a.fail();
          ui.alarm('BUSTED!');
          ui.toast(e.line, 'bad');
          ui.toast((e.n ? e.n + ' item' + (e.n > 1 ? 's' : '') + ' confiscated. ' : '') + 'Fine: ' + money(e.fine) + '.', 'bad');
          { const f = this.frontPos(3, 2.9); this.fx.text('-' + money(e.fine), new THREE.Vector3(f.x, f.y, f.z), '#ff5a5a', true); }
        } else ui.toast((this.nameOf(e.pid)) + ' got busted! ' + money(e.fine) + ' fine.', 'bad');
        break;
      case 'clue': {
        const c = CLUES.find(c => c.id === e.id);
        a.cheer();
        if (e.pid === this.me) ui.card('CLUE: ' + c.title, c.text, 'clue');
        else ui.toast(this.nameOf(e.pid) + ' found a clue: ' + c.title);
        break;
      }
      case 'quest': a.ding(); this.questFlash = 2.5; break;
      case 'scam': if (e.pid === this.me) setTimeout(() => ui.dialog([['you', e.text]]), 1200); break;
      case 'levelup': a.cheer(); ui.alarm('HIDEOUT UPGRADED: ' + e.name.toUpperCase() + '!'); break;
      case 'copHit': a.thud({ x: e.x, z: e.z }); this.bubble(() => this.police.copRig(e.cop)?.rig.root.position, pick(['OFFICER DOWN! (I\'m fine)', 'MY DONUT!', 'OW! THAT\'S ASSAULT! WITH A VEHICLE!'])); break;
      case 'finale': this.finale(); break;
      case 'chat': ui.toast((e.name || '?') + ': ' + e.text, 'chat'); break;
      case 'begin': if (!this.isHost && this.phase === 'lobby') { ui.closeMenu(); this.phase = 'play'; this.ui.hudVisible(true); if (e.intro) this.runIntro(); else this.spawnInTown(); } break;
    }
  }
  nameOf(pid) { if (pid === this.me) return this.profile.name; const r = this.remotes.get(pid); return r ? r.name : (this.net.profiles.get(pid)?.name || 'Someone'); }
  bubble(who, text) {
    let obj = who;
    if (who === this.me) obj = () => (this.cam.mode === 'first' ? this.frontPos(3.2, 0.9) : this.player.pos);
    else if (who === 'dez') obj = () => ({ x: this.npcs.dez.x, z: this.npcs.dez.z, y: this.npcs.dez.floor === 1 ? HQ.base.y : 0 });
    else if (typeof who === 'string' && this.remotes.has(who)) { const r = this.remotes.get(who); obj = () => r.pos; }
    this.ui.bubble(obj, text);
  }

  async finale() {
    const ui = this.ui;
    this.npcs.mayorOut = true;
    await ui.dialog(FINALE);
    this.audio.cheer();
    const s = this.W.stats;
    ui.menu({
      title: 'THE END', sub: '...of the beginning.', cls: 'credits',
      html: `<div class="card">Pizza is still illegal. Officially. The mayor gets a free pizza every Friday. The police look the other way. A little.<br><br>Pizzas made: ${s.made}<br>Delivered: ${s.delivered}<br>Burnt: ${s.burnt}<br>Kitchen fires: ${s.fires}<br>Cheese explosions: ${s.explosions}<br>Times busted: ${s.busted}<br>Total earned: ${money(s.earned)}<br><br>Keep playing: grow the hideout into a PIZZA EMPIRE.</div>`,
      items: [{ label: 'Keep running the business' }],
    });
  }

  /* ---------------- networking ---------------- */
  _netHooks() {
    const N = this.net;
    N.on.getSave = () => this.W;
    N.on.join = (id, p) => {
      if (!this.remotes.has(id)) this.remotes.set(id, new Remote(this, id, p));
      this.ui.toast(p.name + ' joined the crew!');
      if (this.isHost && this.phase === 'play') this.net.sendEvent({ k: 'begin', intro: false });
      if (this.phase === 'lobby') this.lobbyMenu();
    };
    N.on.leave = (id, p) => {
      const r = this.remotes.get(id); if (r) { r.dispose(); this.remotes.delete(id); }
      if (this.isHost) this.vehicles.exit(id);
      this.ui.toast((p?.name || 'Someone') + ' left.');
      if (this.phase === 'lobby') this.lobbyMenu();
    };
    N.on.player = (id, s) => {
      let r = this.remotes.get(id);
      if (!r) { const p = N.profiles.get(id) || { name: '?', look: 0 }; r = new Remote(this, id, p); this.remotes.set(id, r); }
      r.apply(s);
      if (this.isHost && s.car && s.car.seat === 0) {
        const c = this.W.cars.find(c => c.id === s.car.id);
        if (c && c.drv === id) { c.x = s.car.x; c.z = s.car.z; c.yaw = s.car.yaw; c.spd = s.car.spd; }
      }
    };
    N.on.action = (id, a) => this.exec(id, a);
    N.on.event = (id, e) => {
      if (e.k === 'chat') { this.onEvent(id, e); if (this.isHost) this.exec(id, { k: 'chat', text: e.text }); return; }
      if (!this.isHost) this.onEvent(id, e);
    };
    N.on.world = (w) => {
      if (this.isHost) return;
      const mine = this.vehicles.local;
      this.W = w.W;
      if (mine) { const c = this.W.cars.find(c => c.id === mine.id); if (c) { c.x = mine.x; c.z = mine.z; c.yaw = mine.yaw; } }
      this.police.applySnapshot(w.pol);
    };
    N.on.welcome = (d) => { if (d.save) this.W = d.save; for (const p of d.players) if (p.id !== d.id && !this.remotes.has(p.id)) this.remotes.set(p.id, new Remote(this, p.id, p)); };
    N.on.lost = () => { this.ui.card('Connection lost', 'The host left or the connection dropped. Reload the page to play solo or join again.'); };
  }

  lobbyMenu() {
    const N = this.net, ui = this.ui;
    const names = N.lobbyList.map(p => p.name + (p.you ? ' (you)' : '') + (p.host ? ' - host' : '')).join('<br>');
    ui.menu({
      title: N.isHost ? 'ROOM CODE: ' + N.room : 'Waiting for the host...',
      sub: N.isHost ? 'Your friends click "Join co-op" and type this code. Up to 4 players.' : 'The host will start the game.',
      html: `<div class="card">${names}</div>`,
      items: N.isHost ? [
        { label: 'Start a new story (everyone plays the intro)', on: () => { this.net.sendEvent({ k: 'begin', intro: true }); this.begin(true); } },
        { label: 'Continue the saved game', disabled: !loadWorld(), on: () => { this.begin(false); this.net.sendEvent({ k: 'begin', intro: this.W.quest <= Q.HOSPITAL }); } },
      ] : [{ label: 'Waiting...', disabled: true, keep: true }],
      onClose: () => { if (this.phase === 'lobby' && N.isHost) setTimeout(() => this.phase === 'lobby' && this.lobbyMenu(), 50); },
    });
  }

  /* ---------------- per frame ---------------- */
  update(dt) {
    dt = Math.min(dt, 0.05);
    const I = this.input, P = this.player, W = this.W, ui = this.ui;
    this.time = (this.time || 0) + dt;
    if (this.phase === 'title' || this.phase === 'lobby') { this._titleCam(dt); return; }

    // ---- keys that work even in menus ----
    for (const code of I.down) if (ui.menuOpen && ui.menuKey(code)) { I.down.clear(); break; }
    if (this.intro.active?.skip && (I.pressedRaw('Escape') || I.pressedRaw('Enter'))) this.intro.active.skip();
    const advance = I.pressedRaw('KeyE') || I.pressedRaw('Space') || I.pressedRaw('Enter') || I.mouse.clicked.has(0);
    if (ui.inDialog) {
      ui.dialogUpdate(dt, advance && !ui.menuOpen);
      // the key that closed the last line must not also start the conversation again
      if (advance) { for (const k of ['KeyE', 'Space', 'Enter']) I.down.delete(k); I.mouse.clicked.delete(0); }
    }

    if (this.intro.active) this.intro.active.update(dt);
    const frozen = this.frozen();
    I.blocked = !!ui.menuOpen || this.chatOpen || this.admin.open || !!this.inv?.open;

    if (this.phase === 'play' && !frozen) this._keys(dt);
    this.natural = !frozen && I.held('KeyX') && !P.car;
    if (this.natural && !this._natT) { this._natT = 1; this.bubble(this.me, pick(BARK.natural)); this.audio.whistle(); }
    if (!this.natural) this._natT = 0;

    if (this.phase === 'play' || this.phase === 'hospital') P.update(dt, frozen || this.phase !== 'play');
    this.vehicles.update(dt);
    if (P.car) { const c = this.vehicles.car(P.car); if (c) P.pos.set(P.pos.x, 0, P.pos.z); }

    // ---- the host simulation ----
    if (this.isHost && this.phase === 'play') {
      const players = this.allPlayers();
      this.kitchen.hostUpdate(dt);
      this.orders.hostUpdate(dt);
      this.police.hostUpdate(dt, players);
      this.events.hostUpdate(dt, players);
      this.debts.hostUpdate(dt, players);
      this.inspections.hostUpdate(dt, players);
      this.bm.hostUpdate(dt);
      for (const c of W.cars) if (c.drv) this.police.carHit(c);
      this._saveT -= dt;
      if (this._saveT <= 0 && (this._dirty || this._saveT < -30)) { this._saveT = 8; if (this._dirty) saveWorld(W); }
      if (this.net.isOnline) this.net.sendWorld(() => ({ W, pol: this.police.snapshot() }), dt);
      this._dirty = false;
    }
    // ---- everyone ----
    this.kitchen.sync(dt);
    this.orders.sync(dt);
    this.police.sync(dt);
    this.npcs.update(dt);
    this.debts.sync(dt);
    this.bm.update(dt);
    this.inv.update(dt);
    this.traffic.setVisible(this.phase !== 'intro');
    if (this.phase === 'play') { this.traffic.update(dt); this.citizens.update(dt); this.story.localUpdate(dt); }
    for (const r of this.remotes.values()) r.update(dt);
    this.chased = this.police.chasingMe;
    P.setWear(W.wear[this.me] || null);

    // ---- interaction ----
    if (this.phase === 'play') this._interact(dt, frozen);
    else ui.prompt(null);

    // ---- camera, light, sound ----
    this._camera(dt);
    this.fx.update(dt, this.camera);
    this.audio.listener = { x: P.pos.x, z: P.pos.z };
    const fire = STATIONS.reduce((s, st) => s + (W.st[st.id]?.fire || 0) / (1 + Math.hypot(st.x - P.pos.x, st.z - P.pos.z) / 6), 0);
    const insp = W.insp;
    this.audio.update(dt, { engine: this.audio.engine || 0, fire, siren: Math.max(this.police.siren || 0, insp ? (insp.ph === 'warn' ? 0.25 + 0.5 * (1 - insp.t / insp.total) : 0.6) : 0), tense: this.chased || !!insp, rain: this.audio.rainLevel || 0 });
    // the inspection countdown ticks louder as it runs out
    if (insp && insp.ph === 'warn') {
      const s = Math.ceil(insp.t);
      if (s !== this.inspBeep) { this.inspBeep = s; if (s <= 10 || s % 5 === 0) this.audio.tone(s <= 5 ? 1400 : 900, 0.12, 'square', s <= 5 ? 0.12 : 0.06); if ([30, 15, 5, 4, 3, 2, 1].includes(s)) ui.bigCount(s <= 5 ? String(s) : 'INSPECTION IN: ' + s); }
    }
    this.weather.update(dt);
    this._van(dt);
    // the town keeps its secret until the Suspicious Man tells you
    const revealed = W.quest >= Q.FIND;
    if (this.town.revealed !== revealed) this.town.setReveal(revealed);

    // ---- send my state ----
    if (this.net.isOnline) {
      const mine = this.vehicles.local;
      const seat = this.vehicles.seatOf(this.me);
      this.net.sendPlayer({ x: +P.pos.x.toFixed(2), y: +P.pos.y.toFixed(2), z: +P.pos.z.toFixed(2), yaw: +P.yaw.toFixed(2), sp: +P.speed.toFixed(1), f: P.floor, h: P.hidden ? 1 : 0, fl: P.flying ? 1 : 0, p: P.stun > 0 || P.flying ? 1 : 0, sy: P.spraying ? 1 : 0, t: ui.talking === 'you' ? 1 : 0, nat: this.natural ? 1 : 0, run: P.running && P.speed > 6 ? 1 : 0, w: W.wear[this.me] || null, car: seat ? { id: seat.c.id, seat: seat.seat, x: mine ? +mine.x.toFixed(2) : seat.c.x, z: mine ? +mine.z.toFixed(2) : seat.c.z, yaw: mine ? +mine.yaw.toFixed(3) : seat.c.yaw, spd: mine ? +mine.spd.toFixed(1) : 0 } : null }, dt);
    }

    // ---- HUD ----
    if (this.phase === 'play') {
      const o = this.story.objective();
      ui.objective(o.text, o.sub);
      ui.hud(dt);
      ui.held(this.hold(this.me));
      this._taskT = (this._taskT || 0) - dt;
      if (this._taskT <= 0) { this._taskT = 0.25; ui.tasks(this.tasks()); }
      if (this.map.open) this.map.draw();
    }
    this._ovenBars();
  }

  /** the to-do list on the HUD: everything that needs doing RIGHT NOW */
  tasks() {
    const W = this.W, out = [];
    if (W.quest < Q.BIZ && !W.orders.length) return out;
    const I = W.insp;
    if (I && I.ph === 'warn') out.push({ t: 'HIDE EVERYTHING! Inspection in ' + Math.ceil(I.t) + 's', c: 'red' });
    if (I && I.ph === 'search') out.push({ t: 'POLICE INSIDE: act normal (X). Don\'t run.', c: 'red' });
    if (W.shutdown > 0) out.push({ t: 'SHUT DOWN by police: ' + Math.ceil(W.shutdown) + 's (no cooking)', c: 'red' });
    if (this.police.chasingMe) out.push({ t: 'COPS CHASING YOU (G: smoke bomb)', c: 'red' });
    for (const s of STATIONS) {
      const st = W.st[s.id]; if (!st || !this.kitchen.available(s)) continue;
      if (st.fire > 0) { out.push({ t: 'FIRE! ' + s.id + ' is burning', c: 'red' }); continue; }
      const it = st.item && (s.type === 'oven') ? st.item : null;
      if (it) out.push(it.cook >= BURNT ? { t: s.id + ': BURNING! Get it out!', c: 'red' } : it.cook >= COOKED ? { t: s.id + ': golden - take it out!', c: 'green' } : { t: s.id + ': baking ' + Math.round(it.cook / COOKED * 100) + '%', c: '' });
    }
    const nw = W.orders.filter(o => o.state === 'new').length;
    if (nw) out.push({ t: nw + ' new order' + (nw > 1 ? 's' : '') + ' - answer on the phone (TAB)', c: 'yellow' });
    const open = W.orders.filter(o => o.state === 'open' && !o.story).sort((a, b) => a.t - b.t);
    for (const o of open.slice(0, 3)) out.push({ t: o.name + ': ' + recipeText(o) + (o.t > 0 ? ' (' + Math.ceil(o.t) + 's)' : ' LATE'), c: o.t < 30 ? 'red' : '' });
    if (open.length > 3) out.push({ t: '+' + (open.length - 3) + ' more orders', c: '' });
    for (const k of ['dough', 'sauce', 'cheese']) if (W.stock[k] <= 0) out.push({ t: 'OUT OF ' + k.toUpperCase() + ' (Crumb Mall grocery)', c: 'yellow' }); else if (W.stock[k] < 3) out.push({ t: 'Low on ' + k + ' (' + W.stock[k] + ')', c: '' });
    const ev = W.event;
    if (ev?.k === 'supplierVan') out.push({ t: 'Supplier van outside: grab the crates (' + Math.ceil(ev.t) + 's)', c: 'yellow' });
    if (ev?.k === 'tow') out.push({ t: 'Move your car off the road! (' + Math.ceil(ev.t) + 's)', c: 'red' });
    const late = (W.debts || []).filter(d => ['late', 'overdue'].includes(d.state)).length;
    if (late) out.push({ t: late + ' debt' + (late > 1 ? 's' : '') + ' late - go collect', c: '' });
    if (W.weather) out.push({ t: 'STORM: cars slide, tips +50%', c: '' });
    return out.slice(0, 8);
  }

  /** the supplier van parked in the yard during its event */
  _van(dt) {
    const ev = this.W.event, on = ev && ev.k === 'supplierVan';
    if (on && !this.vanG) {
      const C = makeCar('smallvan'); C.group.position.set(131, 0, 89.5); C.group.rotation.y = Math.PI; this.scene.add(C.group);
      const drv = makeChar({ hat: 'cap', hatColor: '#d6232a', shirt: '#d6232a', mustache: true, skin: '#c98a5e', belly: 1.2 }); drv.root.position.set(132.6, 0.05, 86.6); this.scene.add(drv.root);
      this.vanG = { C, drv, crates: new THREE.Group(), key: '' }; this.scene.add(this.vanG.crates);
      this.bubble(() => ({ x: 132.6, z: 86.6 }), 'Delivery! $250 a crate. Cash. I got places to be.');
    }
    if (!on && this.vanG) { this.scene.remove(this.vanG.C.group); this.scene.remove(this.vanG.drv.root); this.scene.remove(this.vanG.crates); this.vanG = null; }
    if (this.vanG) {
      this.vanG.drv.anim(dt, { wave: true });
      const key = JSON.stringify(ev.crates);
      if (key !== this.vanG.key) { this.vanG.key = key; const G = this.vanG.crates; while (G.children.length) G.remove(G.children[0]); ev.crates.forEach((c, i) => { const m = makeItem(c); m.position.set(130 + (i % 3) * 0.7, (Math.floor(i / 3)) * 0.46, 86.4); G.add(m); }); }
    }
  }

  _keys(dt) {
    const I = this.input, P = this.player, ui = this.ui;
    if (I.pressed('Tab')) this.phone();
    if (I.pressed('KeyM')) this.map.show();
    if (I.pressed('KeyG')) {
      const inv = this.W.inv?.[this.me];
      if (inv && inv.smoke > 0) this.act({ k: 'smoke', x: P.pos.x, z: P.pos.z });
      else this.ui.toast('No smoke bombs. (General store at the Crumb Mall.)');
    }
    if (I.pressed('KeyV')) { this.cam.mode = this.cam.mode === 'first' ? 'third' : 'first'; this.cam.snap = true; this.ui.toast(this.cam.mode === 'first' ? 'First person' : 'Third person'); }
    if (I.pressed('Escape')) this.pause();
    if (I.pressed('KeyT') && this.net.isOnline) this.openChat();
    if (I.pressed('KeyQ') && !P.car && this.hold(this.me).length) { this.act({ k: 'toss', x: P.pos.x + Math.sin(P.yaw), z: P.pos.z + Math.cos(P.yaw) }); this.audio.whoosh(); }
    // sprinting with a tower of boxes: the top one falls off sometimes
    const held = this.hold(this.me);
    if (P.running && P.speed > 7 && held.length > 7 && Math.random() < dt * 0.12 * (held.length - 7)) {
      this.act({ k: 'toss', x: P.pos.x - Math.sin(P.yaw), z: P.pos.z - Math.cos(P.yaw) });
      this.bubble(this.me, pick(['NOOO! A PIZZA!', 'Man down! Pizza down!', 'Shit shit shit-', 'Keep going, it\'s fine, it\'s FINE']));
    }
    // extinguisher
    const top = this.hold(this.me).slice(-1)[0];
    P.spraying = !!(top && top.k === 'ext' && I.btn(0) && !P.car);
    if (P.spraying) {
      const dx = Math.sin(P.yaw), dz = Math.cos(P.yaw);
      this.fx.spray(P.pos.x + dx * 0.9, P.pos.y + 1.1, P.pos.z + dz * 0.9, dx, dz);
      this.sprayT -= dt;
      if (this.sprayT <= 0) { this.sprayT = 0.12; this.audio.spray(); this.act({ k: 'spray', x: P.pos.x, z: P.pos.z, dx, dz, f: P.floor }); }
    }
  }

  _interact(dt, frozen) {
    const I = this.input, P = this.player, ui = this.ui, W = this.W;
    if (frozen) { ui.prompt(null); ui.prepKeys(null); this.holdT = 0; return; }
    const T = [];
    if (P.hidden) T.push({ d: 0, label: 'Climb out of the dumpster', local: 'unhide' });
    else if (!P.car) {
      if (this.phase === 'play' && Math.abs(P.pos.x - HOSPITAL_SET.x) < 30) {
        const e = this.town.poi.hospExit, d = Math.hypot(P.pos.x - e.x, P.pos.z - e.z);
        if (d < 2.5) T.push({ d, label: 'Leave the hospital', local: 'exitHospital' });
      } else {
        this.kitchen.targets(P, T);
        this.orders.targets(P, T);
        this.npcs.targets(P, T);
        this.debts.targets(P, T);
        this.bm.targets(P, T);
        this.vehicles.targets(P, T);
        if (P.floor === 0) for (const s of this.town.shopItems || []) {
          const d = Math.hypot(P.pos.x - s.x, P.pos.z - s.z);
          if (d < 1.35) T.push({ x: s.x, z: s.z, d: d - 0.3, ...this.shopLabel(s), act: { k: 'shop', cat: s.cat, key: s.key } });
        }
        const ev = this.W.event;
        if (ev && ev.k === 'supplierVan' && ev.crates.length) { const d = Math.hypot(P.pos.x - 131, P.pos.z - 86.5); if (d < 3.2) T.push({ x: 131, z: 86.5, d, label: 'Grab a crate from the supplier van ($250 · ' + ev.crates.length + ' left: ' + ev.crates.map(c => c.s).join(', ') + ')', act: { k: 'van' } }); }
        if (P.floor === 0) for (const d of this.town.poi.dumpsters || []) { const dd = Math.hypot(P.pos.x - d.x, P.pos.z - d.z); if (dd < 3.0) T.push({ d: dd + 0.5, label: 'Hide in the dumpster', local: 'hide', at: d }); }
      }
    }
    T.sort((a, b) => a.d - b.d);
    // prefer something you can actually do over a hint
    const t = T.find(x => !x.info && !x.warn) || T[0];
    // the car prompt is on F
    let carT = null;
    if (P.car) carT = { label: 'Get out', key: 'F' };
    else if (!P.hidden && P.floor === 0) { const c = this.vehicles.nearest(P.pos.x, P.pos.z, 3.6); if (c) { const own = VEHICLES[c.kind]?.name || 'car'; carT = { label: c.drv ? 'Ride along in the ' + own : 'Drive the ' + own, key: 'F', car: c }; } }
    if (I.pressed('KeyF') && carT) {
      if (P.car) { const c = this.vehicles.car(P.car); const s = c ? this.vehicles.exitSpot(c) : null; this.act({ k: 'exit' }); if (s) { P.teleport(s.x, s.z, 0); } this.vehicles.local = null; this.cam.snap = true; }
      else { this.act({ k: 'enter', id: carT.car.id }); this.audio.ovenDoor(null); }
    }
    // prep counter: the topping keys
    const prep = t && t.prep ? this.kitchen.st(t.prep).item : null;
    this.prepActive = !!(prep && prep.k === 'base');   // number keys are toppings here, not the hotbar
    ui.prepKeys(prep && prep.k === 'base' ? prep : null, W.stock);
    if (prep && prep.k === 'base') ADD_KEYS.forEach((what, i) => { if (I.pressed('Digit' + (i + 1))) this.act({ k: 'use', id: t.prep, op: 'add', what }); });

    let shown = t ? { ...t, key: t.info || t.warn ? '' : 'E' } : carT;
    if (t && carT && !P.car) shown.alt2 = carT;
    if (P.car) shown = carT;
    // hold-to-do
    if (t && t.hold && I.held('KeyE')) {
      if (this.holdKey !== t.label) { this.holdKey = t.label; this.holdT = 0; }
      this.holdT += dt;
      if (t.whack && Math.floor(this.holdT * 3.5) !== Math.floor((this.holdT - dt) * 3.5)) { this.audio.thud(P.pos); this.fx.sparkle(P.pos.x + Math.sin(P.yaw), 1.6, P.pos.z + Math.cos(P.yaw), '#ffe14a'); }
      if (t.slap && Math.floor(this.holdT * 4) !== Math.floor((this.holdT - dt) * 4)) this.audio.squish(P.pos);
      if (t.act && t.act.k === 'pile' && Math.random() < dt * 6) this.fx.poof(t.x, 0.5, t.z);
      if (this.holdT >= t.hold) { this.act(t.act); this.holdT = 0; this.holdKey = null; }
      shown = { ...shown, progress: this.holdT / t.hold };
    } else { this.holdT = 0; this.holdKey = null; }
    if (t && !t.hold && I.pressed('KeyE')) this._do(t);
    if (t && t.alt && I.pressed('KeyR')) this.act(t.alt.act);
    ui.prompt(shown && P.car ? shown : shown);
  }
  _do(t) {
    const P = this.player;
    if (t.fn) { t.fn(); return; }
    if (t.act) { this.act(t.act); return; }
    switch (t.local) {
      case 'talk': t.npc.talk(); break;
      case 'laptop': this.npcs.laptop(); break;
      case 'stock': this.ui.card('Stock', Object.entries(this.W.stock).map(([k, v]) => STOCK_NAME[k] + ': ' + v).join('\n') + '\n\nBuy more from the underground suppliers (map: M).'); break;
      case 'hatch': this.ui.fade(true); setTimeout(() => { P.teleport(158.5 + (t.to === 1 ? 0 : 0), t.to === 1 ? 82 : 82, t.to, 0); this.cam.snap = true; this.ui.fade(false); }, 300); this.audio.ovenDoor(null); break;
      case 'hide': P.hidden = t.at; P.pos.set(t.at.x, 0, t.at.z); this.audio.thud(P.pos); this.ui.toast('You are in a dumpster. It smells like... actually, it smells like old pizza. Nice.'); break;
      case 'unhide': { const d = P.hidden; P.hidden = null; P.teleport(d.x + 2, d.z + 1.6, 0); this.audio.thud(P.pos); break; }
      case 'exitHospital': this.leaveHospital(); break;
      case 'rival': this.debts.rivalTalk(); break;
      case 'safe': this.debts.safeMenu(); break;
      case 'storageIn': case 'storageOut': { const T = this.town.poi, p = t.local === 'storageIn' ? T.storageIn : { x: 137.8, z: 66.8 }; this.ui.fade(true); this.audio.ovenDoor(null); setTimeout(() => { P.teleport(p.x, p.z, 0, t.local === 'storageIn' ? -Math.PI / 2 : Math.PI / 2); this.cam.snap = true; this.ui.fade(false); }, 300); break; }
    }
  }

  onHitByCar() {
    const P = this.player;
    if (this.hold(this.me).some(isContraband)) this.act({ k: 'dropAll', x: P.pos.x, z: P.pos.z });
  }

  /* ---------------- phone, pause, chat ---------------- */
  phone() {
    const W = this.W, ui = this.ui;
    if (W.quest < Q.FIRST && !W.orders.length) { ui.card('Phone', 'No orders yet. Nobody even knows you exist.\n\n(Keep going with the story.)'); return; }
    const items = W.orders.map(o => {
      const at = this.orders.at(o);
      const time = o.story ? '' : o.state === 'new' ? ' · answer in ' + Math.ceil(o.exp) + 's' : o.t > 0 ? ' · ' + Math.ceil(o.t / 60) + ' min left' : ' · LATE';
      return {
        label: (o.state === 'new' ? 'NEW: ' : '') + o.name + ' - ' + (o.story ? 'special' : recipeText(o)) + (o.qty > 1 ? ' x' + o.left : ''),
        sub: '"' + o.msg + '" — ' + (at.addr || '') + time,
        price: o.story ? '???' : o.pay * (o.qty > 1 ? o.left : 1),
        owned: o.state === 'open',
        keep: false,
        on: () => {
          if (o.state !== 'new') { this.map.show(o); return; }
          ui.menu({ title: o.name, sub: '"' + o.msg + '"', html: `<div class="card">Wants: ${recipeText(o)}${o.qty > 1 ? '<br>How many: ' + o.qty : ''}<br>Where: ${at.addr}<br>Pays: ${money(o.pay)}${o.qty > 1 ? ' each' : ''}<br><br><i>Read the message. Some customers are undercover cops.</i></div>`, items: [{ label: 'Accept', on: () => this.act({ k: 'accept', id: o.id }) }, { label: 'Decline', on: () => this.act({ k: 'decline', id: o.id }) }, { label: 'Back', on: () => this.phone() }] });
        },
      };
    });
    if (!items.length) items.push({ label: 'No orders right now. They will come. DING DING.', disabled: true });
    if (W.quest >= Q.BIZ) {
      const late = (W.debts || []).filter(d => ['late', 'overdue'].includes(d.state)).length;
      items.unshift({ label: 'DEBTS: ' + (W.debts || []).length + ' people owe you money' + (late ? ' (' + late + ' late!)' : ''), sub: 'Mafia Rep: ' + TIERS[tierOf(W.mrep || 0)].name, price: money((W.debts || []).reduce((s, d) => s + d.amount, 0)), on: () => this.debts.phoneMenu() });
    }
    ui.menu({ title: 'Phone', sub: 'Pick a new order to accept or decline. Accepted orders get a pin over the door.', items, cls: 'phone' });
  }
  pause() {
    const ui = this.ui, p = this.profile;
    ui.menu({
      title: 'Paused', sub: this.net.isOnline ? 'Room code: ' + this.net.room : 'Solo game. Saved automatically.',
      items: [
        { label: 'Resume' },
        { label: 'Swearing: ' + (p.bleep ? 'BLEEPED' : 'ON'), sub: 'Turn the cursing into #$%&!', keep: true, on: () => { p.bleep = !p.bleep; saveProfile(p); this.pause(); } },
        { label: 'Music: ' + (this.audio.musicOn ? 'ON' : 'OFF'), keep: true, on: () => { this.audio.musicOn = !this.audio.musicOn; this.pause(); } },
        { label: 'Mouse sensitivity: ' + p.sens.toFixed(1), sub: 'Click to cycle', keep: true, on: () => { p.sens = p.sens >= 2 ? 0.5 : +(p.sens + 0.25).toFixed(2); this.input.sensitivity = p.sens; saveProfile(p); this.pause(); } },
        { label: 'Invert mouse Y: ' + (p.invert ? 'YES' : 'NO'), keep: true, on: () => { p.invert = !p.invert; this.input.invertY = p.invert; saveProfile(p); this.pause(); } },
        { label: 'Controls', on: () => this.ui.card('Controls', 'WASD move · Shift run · Space jump · Mouse look · Wheel zoom\nE interact (hold for some things) · R second action\nQ throw away what you hold · X act natural\n1-7 add sauce/cheese/toppings at a counter\nF get in / out of cars · H honk\nTAB phone (orders) · M map · T chat (co-op) · ESC pause\nLMB spray (holding an extinguisher)') },
        ...(this.isHost ? [{ label: 'Save now', on: () => { saveWorld(this.W); ui.toast('Saved.'); } }] : []),
        { label: 'Quit to title', on: () => { if (this.isHost) saveWorld(this.W); location.reload(); } },
      ],
    });
  }
  openChat() {
    const box = document.getElementById('chatbox');
    this.chatOpen = true; box.style.display = ''; box.value = ''; box.focus(); this.input.unlock();
    const done = (send) => {
      box.onkeydown = null; box.style.display = 'none'; this.chatOpen = false; box.blur();
      if (send && box.value.trim()) { const text = box.value.trim().slice(0, 120); const e = { k: 'chat', name: this.profile.name, text }; this.onEvent(this.me, e); this.net.sendEvent(e); if (this.isHost) this.exec(this.me, { k: 'chat', text }); }
    };
    box.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') done(true); else if (ev.key === 'Escape') done(false); };
  }

  /* ---------------- camera ---------------- */
  _camera(dt) {
    const cam = this.camera, C = this.cam, P = this.player, I = this.input;
    if (C.override) {
      P.vm.visible = false;
      cam.position.copy(C.override.pos); cam.lookAt(C.override.look);
      this._shake(); this._lights(); return;
    }
    const look = I.look();
    if (C.mode === 'first') { this._fpCamera(dt, look); return; }
    if (!this.frozen() || this.phase === 'play') { P.camYaw -= look.x; C.pitch = clamp(C.pitch + look.y, -0.25, 1.25); }
    if (I.mouse.wheel && !this.ui.menuOpen) C.dist = clamp(C.dist + I.mouse.wheel * 0.8, 3, 13);
    const room = roomAt(P.pos.x, P.pos.z, P.floor);
    let pitch = C.pitch, dist = C.dist;
    let target = new THREE.Vector3(P.pos.x, P.pos.y + 1.6, P.pos.z);
    if (P.car) {
      const c = this.vehicles.car(P.car);
      if (c) {
        if (Math.abs(look.x) > 0) C.free = 2.5; C.free -= dt;
        if (C.free <= 0) P.camYaw = dampAngle(P.camYaw, c.yaw + Math.PI, 3, dt);
        dist = Math.max(C.dist, 8.5); pitch = Math.max(pitch, 0.25);
        target.set(c.x, 1.8, c.z);
      }
    } else if (room) { pitch = Math.max(pitch, 0.6); dist = Math.min(dist, 8.5); }
    const yaw = P.camYaw;
    const at = (p) => new THREE.Vector3(target.x + Math.sin(yaw) * Math.cos(p) * dist, target.y + Math.sin(p) * dist, target.z + Math.cos(yaw) * Math.cos(p) * dist);
    let want = at(pitch);
    // don't put the camera inside a building (the hideout cuts away instead).
    // In a tight alley, lift the camera up over the player instead of into their head.
    if (!room && P.floor === 0) {
      const reach = (w) => {
        const steps = 16;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          if (this._camSolid(target.x + (w.x - target.x) * t, target.z + (w.z - target.z) * t, target.y + (w.y - target.y) * t)) return Math.max(0.08, (i - 1.5) / steps);
        }
        return 1;
      };
      let ok = reach(want);
      if (ok * dist < 3) { const up = at(1.2), ok2 = reach(up); if (ok2 * dist > ok * dist + 0.5) { C.lift = damp(C.lift || 0, 1, 6, dt); } else C.lift = damp(C.lift || 0, 0, 6, dt); }
      else C.lift = damp(C.lift || 0, 0, 3, dt);
      if (C.lift > 0.01) { want = at(pitch + (1.2 - pitch) * C.lift); ok = reach(want); }
      want.lerpVectors(target, want, ok);
    }
    P.tooClose = want.distanceTo(target) < 1.4;
    if (P.floor === 1) {
      const B = HQ.base;
      want.x = clamp(want.x, B.x0 + 0.4, B.x1 - 0.4); want.z = clamp(want.z, B.z0 + 0.4, B.z1 - 0.4);
      want.y = Math.min(want.y, B.y + 5.3);
    }
    if (C.snap) { C.pos.copy(want); C.snap = false; }
    else C.pos.lerp(want, 1 - Math.exp(-14 * dt));
    cam.position.copy(C.pos);
    cam.lookAt(target);
    this._shake();
    this.town.cutaway(cam.position, room === 'front' || room === 'back', P.floor === 1);
    this._lights();
  }
  /** first person: eyes in your head (or in the driver's seat, or peeking out of a dumpster) */
  _fpCamera(dt, look) {
    const cam = this.camera, C = this.cam, P = this.player;
    if (!this.ui.menuOpen) { P.camYaw -= look.x; C.fpPitch = clamp((C.fpPitch || 0) + look.y, -1.45, 1.45); }
    // getting in: look out of the windshield
    if (P.car !== C.lastCar) { C.lastCar = P.car; const c0 = P.car && this.vehicles.car(P.car); if (c0) { P.camYaw = c0.yaw - Math.PI; C.fpPitch = 0.1; C.carLook = 0; } }
    let eye, yaw = P.camYaw + Math.PI;
    if (P.car) {
      const c = this.vehicles.car(P.car), K = this.vehicles.cockpit;
      // free look inside the car, relative to where the car points
      C.carLook = clamp(wrapAngle(yaw - (c ? c.yaw : yaw)), -2.4, 2.4);
      if (c) { yaw = c.yaw + C.carLook; P.camYaw = yaw - Math.PI; }
      eye = new THREE.Vector3(P.pos.x, K && K.group.visible ? K.eyeY : P.pos.y + 1.28, P.pos.z);
    } else if (P.hidden) eye = new THREE.Vector3(P.pos.x, 1.2, P.pos.z);
    else {
      C.bob = (C.bob || 0) + dt * P.speed * 1.9;
      const b = P.onGround ? Math.sin(C.bob) * 0.045 * Math.min(1, P.speed / 5) : 0;
      eye = new THREE.Vector3(P.pos.x, P.pos.y + 1.62 + b, P.pos.z);
    }
    const p = C.fpPitch || 0;
    cam.position.copy(eye);
    cam.lookAt(eye.x + Math.sin(yaw) * Math.cos(p), eye.y - Math.sin(p), eye.z + Math.cos(yaw) * Math.cos(p));
    if (P.flying) { C.roll = (C.roll || 0) + dt * 9; cam.rotateZ(C.roll); } else C.roll = 0;
    C.pos.copy(cam.position);
    this._shake();
    this.town.cutaway(cam.position, false, false);
    this._lights();
  }
  /** a point just in front of your eyes (for your own speech bubbles in first person) */
  frontPos(d = 3, up = 0) {
    const cam = this.camera, f = new THREE.Vector3(); cam.getWorldDirection(f);
    return { x: cam.position.x + f.x * d, y: cam.position.y + f.y * d - 2.7 + up, z: cam.position.z + f.z * d };
  }
  _camSolid(x, z, y) {
    let s = false;
    this.town.col.near(x, z, 0.3, c => {
      if (s || c.floor !== 0 || c.tag === 'hq' || c.tag === 'station' || y > c.y0 + c.h || c.h < 2) return;
      if (c.t === 'c') { if (Math.hypot(x - c.x, z - c.z) < c.r + 0.2) s = true; }
      else if (x > c.minx - 0.2 && x < c.maxx + 0.2 && z > c.minz - 0.2 && z < c.maxz + 0.2) s = true;
    });
    return s;
  }
  _shake() {
    const s = this.fx.shake;
    if (s > 0) this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s).multiplyScalar(0.5));
  }
  _lights() {
    const L = this.lights, P = this.player, c = this.camera.position;
    if (!L) return;
    const fx = this.cam.override ? c.x : P.pos.x, fz = this.cam.override ? c.z : P.pos.z;
    L.sun.position.set(fx + 40, 90, fz + 30); L.sun.target.position.set(fx, 0, fz); L.sun.target.updateMatrixWorld();
    const under = P.floor === 1 && !this.cam.override;
    const market = fx > 760 && fx < 840;   // the Underground Market: dim, the lamps do the work
    const dim = this.weather?.dim ?? 1;
    L.sun.intensity = damp(L.sun.intensity, market ? 0.75 : (under ? 0.2 : 2.6) * dim, 6, 0.016);
    L.hemi.intensity = damp(L.hemi.intensity, market ? 1.05 : (under ? 2.0 : 1.3) * (0.6 + 0.4 * dim), 6, 0.016);
    if (this.sky) this.sky.position.set(c.x, 0, c.z);
  }
  _titleCam(dt) {
    const t = this.time * 0.05;
    this.camera.position.set(Math.sin(t) * 60, 34, Math.cos(t) * 60 + 10);
    this.camera.lookAt(0, 4, 0);
    this._lights();
    this.npcs.update(dt);
    this.traffic.update(dt);
    this.citizens.update(dt);
  }

  /** timers over ovens: you can see when it's done */
  _ovenBars() {
    const W = this.W, P = this.player, bars = [];
    if (this.phase === 'play') for (const s of STATIONS) {
      if ((s.floor || 0) !== P.floor || Math.hypot(s.x - P.pos.x, s.z - P.pos.z) > 22) continue;
      const st = W.st[s.id]; if (!st) continue;
      const items = st.items?.length && (s.type === 'bigoven') ? st.items : st.item && s.type === 'oven' ? [st.item] : [];
      const y0 = s.floor ? HQ.base.y : 0;
      for (const [i, it] of items.entries()) {
        const c = it.cook || 0;
        const color = c < COOKED ? '#ffd23f' : c < BURNT ? '#43e07a' : '#ff3a3a';
        bars.push({ x: s.x + (items.length > 1 ? (i - 1) * 1.1 : 0), y: y0 + 2.2, z: s.z, p: c < COOKED ? c / COOKED : c < BURNT ? 1 : Math.min(1, (c - BURNT) / 0.55), color, label: cookWord(c).toUpperCase(), blink: c >= BURNT || (c >= COOKED && c < BURNT) });
      }
      if (st.fire > 0) bars.push({ x: s.x, y: y0 + 2.6, z: s.z, p: st.fire, color: '#ff5a1a', label: 'FIRE!', blink: true });
    }
    this.ui.setBars(bars);
  }
}
