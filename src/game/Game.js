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
      this.ui.news('PIZZA IS ILLEGAL. Thank you for your cooperation. - Mayor Gordon Crumb');
      setTimeout(() => this.bubble(this.me, 'What the hell happened to this town?'), 1500);
    }, 500);
  }

  /* ---------------- the world state helpers ---------------- */
  hold(pid) {
    if (this.isHost) return this.W.hold[pid] || (this.W.hold[pid] = []);
    return this.W.hold[pid] || [];
  }
  setHold(pid, arr) { this.W.hold[pid] = arr; this.dirty(); }
  dirty() { this._dirty = true; }
  frozen() { return this.ui.inDialog || !!this.ui.menuOpen || this.phase !== 'play' || !!this.cam.override || this.chatOpen; }
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
        case 'deliver': this.orders.deliver(pid, a.id); break;
        case 'accept': this.orders.accept(pid, a.id); break;
        case 'decline': this.orders.decline(pid, a.id); break;
        case 'clue': this.story.onClue(pid, a.id); break;
        case 'debt': case 'rival': case 'safe': this.debts.exec(pid, a); break;
        case 'toss': {
          const it = H.pop(); if (!it) break;
          if (it.k === 'ext') { const st = this.kitchen.st(it.from || 'ext1'); st.ext = true; this.tell(pid, 'The extinguisher magically returns to the wall. (Physics.)'); }
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
          this.addHeat(a.small ? 1 : 3);
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
          const n = W.cars.length, g = this.town.poi.garage;
          W.cars.push({ id: W.carSeq++, kind: a.kind, x: g.x - (n % 3) * 4.5, z: g.z - Math.floor(n / 3) * 6, yaw: Math.PI, drv: null, pas: [] });
          this.tell(pid, 'Your ' + v.name + ' is parked at the hideout. Get in with F.'); this.sfx('cash', null); this.dirty(); break;
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

  /** the host: a player gets caught */
  bust(pid, line, pct, heat, cop) {
    const W = this.W, H = this.hold(pid);
    const n = H.filter(isContraband).length;
    this.W.hold[pid] = H.filter(i => !isContraband(i));
    const fine = Math.min(W.money, Math.round(500 + W.money * pct));
    W.money -= fine; W.stats.busted++;
    this.addHeat(heat);
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
      case 'debtMenu': if (e.pid === this.me) { const open = () => (ui.inDialog ? setTimeout(open, 200) : this.debts.menuFor(e.id)); setTimeout(open, 300); } break;
      case 'alarm': ui.alarm(e.text); a.fail(); break;
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
    I.blocked = !!ui.menuOpen || this.chatOpen;

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
    this.audio.update(dt, { engine: this.audio.engine || 0, fire, siren: this.police.siren, tense: this.chased || !!(W.event && W.event.k === 'inspector') });

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
      if (this.map.open) this.map.draw();
    }
    this._ovenBars();
  }

  _keys(dt) {
    const I = this.input, P = this.player, ui = this.ui;
    if (I.pressed('Tab')) this.phone();
    if (I.pressed('KeyM')) this.map.show();
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
    if (W.quest < Q.FIRST) { ui.card('Phone', 'No orders yet. Nobody even knows you exist.\n\n(Keep going with the story.)'); return; }
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
    let eye, yaw = P.camYaw + Math.PI;
    if (P.car !== C.lastCar) { C.lastCar = P.car; const c0 = P.car && this.vehicles.car(P.car); if (c0) { P.camYaw = c0.yaw - Math.PI; C.fpPitch = 0.08; } }
    if (P.car) {
      const c = this.vehicles.car(P.car);
      // free look inside the car, relative to where the car points
      C.carLook = clamp(wrapAngle(yaw - (c ? c.yaw : yaw)), -2.4, 2.4);
      if (c) { yaw = c.yaw + C.carLook; P.camYaw = yaw - Math.PI; }
      eye = new THREE.Vector3(P.pos.x, P.pos.y + 1.28, P.pos.z);
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
    L.sun.intensity = damp(L.sun.intensity, under ? 0.2 : 2.3, 6, 0.016);
    L.hemi.intensity = damp(L.hemi.intensity, under ? 2.0 : 1.35, 6, 0.016);
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
