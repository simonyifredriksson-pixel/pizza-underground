/* BlackMarket.js - the Underground Market under Pages & Pages Used Books.

   Vito sells books. Only books. Bring him a pizza and he checks nobody is
   watching, walks to the back shelf, pulls a red book and the whole shelf
   swings away: stairs down to a secret market. The first time is a little
   film (only for whoever brought the pizza; everybody else just sees the
   shelf swing open). Down there: the Broker, the regulars, and twelve
   tables of very fictional gear.

   Gear: W.gear[pid] = { key: count } (count 1 for things that last),
   W.eq[pid] = the key in your hand. B opens your gear, click (or C) uses
   it. The host decides what happens; everybody sees the animation. */
import * as THREE from '../../lib/three.module.js';
import { makeChar } from '../art/Chars.js';
import { makeGear } from '../art/Gear.js';
import { GEAR, GEAR_ORDER, VITO, BROKER, MARKET_BARKS } from '../data/BlackMarket.js';
import { SPEAKERS } from '../data/Story.js';
import { STATIONS, roomAt } from '../data/Hideout.js';
import { CLUES } from '../data/Data.js';
import { isPizza } from './State.js';
import { nearestNode } from './Police.js';
import { ANIM_T } from './GearView.js';
import { pick, rand, money, damp, dampAngle, clamp } from '../core/Util.js';

SPEAKERS.vito = { name: 'Vito Pages', color: '#ffd23f' };
SPEAKERS.broker = { name: 'The Broker', color: '#ff3a8a' };

const VITO_LOOK = { hat: 'default', hair: '#d8d8e0', hairStyle: 'big', glasses: 'round', shirt: '#6a8a5a', pants: '#4a3a2a', skin: '#f2c29b', mustache: '#d8d8e0', belly: 1.15, headSize: 1.08, buttons: '#c8a03a' };
const BROKER_LOOK = { hat: 'fedora', hatColor: '#2a1640', coat: '#2a1640', glasses: 'sun', skin: '#c98a5e', mustache: '#1a1410', tie: '#ffd23f', belly: 1.35 };
const BAT_BARKS = ['OW! FOAM!', 'BONK?! That\'s assault with a... pool noodle?', 'I forgot what I was doing!', 'Is it nap time? It\'s nap time.'];
const MALLET_BARKS = ['I\'m a pancake now. This is my life now.', '(flat noises)', 'MY HAT IS INSIDE MY HEAD.', 'Call... the... police... wait.'];
const DOCS_BARKS = ['Oh! A duke! My apologies, your grace.', 'Very official. Carry on, sir.', '...is this signed by "Mr. Government"? Seems legit.'];
const BRIBE_BARKS = ['...is that a muffin? I didn\'t see anything. Blueberry?', 'I was never here. Neither was this muffin.', 'Nice briefcase. Nice money. Nice... bye.'];
const BAGGABLE = ['owed', 'late', 'warned', 'overdue'];

export class BlackMarket {
  constructor(game) {
    this.g = game;
    const T = game.town.poi, B = T.books;
    // Vito, behind the counter
    const v = makeChar(VITO_LOOK); game.scene.add(v.root);
    this.vito = { rig: v, x: B.vito.x, z: B.vito.z, yaw: Math.PI / 2, st: 'home', path: [], glance: 2, head: 0 };
    this.shelfK = 0; this.cine = null;
    this.waits = [];
    // the market: things on the tables, the Broker, the regulars
    this.displays = T.marketTables.map(t => {
      const m = makeGear(GEAR_ORDER[t.i]);
      const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
      const s = Math.min(1.1, 0.8 / Math.max(size.x, size.y, size.z) * (GEAR_ORDER[t.i] === 'cutout' ? 1.4 : 1));
      m.scale.setScalar(s);
      const holder = new THREE.Group(); holder.add(m); m.position.y = -box.min.y * s;
      holder.position.set(t.x, t.y, t.z); game.scene.add(holder);
      return { holder, t };
    });
    const b = makeChar(BROKER_LOOK); game.scene.add(b.root);
    b.root.position.set(T.broker.x, 0.05, T.broker.z);
    this.broker = { rig: b, x: T.broker.x, z: T.broker.z };
    this.regulars = T.marketNpcs.map(n => {
      const r = makeChar(n.look); game.scene.add(r.root);
      r.root.position.set(n.x, n.pose === 'sit' ? 0.25 : 0.05, n.z); r.root.rotation.y = n.ry;
      if (n.briefcase) { const c = makeGear('briefcase'); c.scale.setScalar(0.8); c.position.set(0, -0.62, 0); r.armR.add(c); }
      if (n.pose === 'paper') { // a newspaper with two eye holes
        const p = new THREE.Group(); p.position.set(0, 1.85, 0.42); r.root.add(p);
        p.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.02), new THREE.MeshStandardMaterial({ color: '#e8e2d2', flatShading: true })));
        for (const s of [-1, 1]) p.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.03), new THREE.MeshBasicMaterial({ color: '#111018' }))).position.set(s * 0.12, 0.08, 0);
      }
      return { rig: r, n, t: Math.random() * 3 };
    });
    this.barkT = 3;
    this.flying = [];        // decoy boxes in the air / on the ground
    this.useT = 0;
    // a little card on the HUD: what is in your hand
    this.hud = document.createElement('div');
    this.hud.id = 'gearhud';
    (document.getElementById('held')?.parentNode || document.body).appendChild(this.hud);
    this.hudKey = '';
  }
  get W() { return this.g.W; }

  /* ---------------- host ---------------- */
  hostUpdate(dt) {
    const W = this.W;
    if (W.incog) for (const k of Object.keys(W.incog)) { W.incog[k] -= dt; if (W.incog[k] <= 0) { delete W.incog[k]; this.g.dirty(); } }
  }
  exec(pid, a) {
    const g = this.g, W = this.W;
    W.gear = W.gear || {}; W.eq = W.eq || {};
    const inv = W.gear[pid] || (W.gear[pid] = {});
    switch (a.op) {
      case 'give': {   // a pizza for Vito: the secret opens
        const H = g.hold(pid), top = H[H.length - 1];
        if (W.bm || !isPizza(top)) return;
        H.pop(); W.bm = true; W.stats.vito = 1;
        g.broadcastEvent({ k: 'bmReveal', pid });
        break;
      }
      case 'equip': if (a.key && inv[a.key] > 0) W.eq[pid] = a.key; break;
      case 'away': W.eq[pid] = null; break;
      case 'use': this._use(pid, a, inv); break;
    }
    g.dirty();
  }
  /** host: bought off a table */
  buy(pid, key) {
    const g = this.g, W = this.W, G = GEAR[key]; if (!G) return;
    W.gear = W.gear || {}; W.eq = W.eq || {};
    const inv = W.gear[pid] || (W.gear[pid] = {});
    if (!G.uses && inv[key] > 0) { W.eq[pid] = W.eq[pid] === key ? null : key; g.dirty(); return; }
    if (W.money < G.price) return g.tell(pid, 'You can\'t afford that (' + money(G.price) + '). The Broker looks disappointed in you.');
    W.money -= G.price; W.stats.spent = (W.stats.spent || 0) + G.price;
    inv[key] = (inv[key] || 0) + 1; W.eq[pid] = key;
    g.sfx('cash', null);
    g.tell(pid, G.label + ': yours. It\'s in your hand - click to use it. It\'s on your hotbar too (number keys); I opens your inventory.');
    g.dirty();
  }
  _use(pid, a, inv) {
    const g = this.g, W = this.W, key = a.key, G = GEAR[key];
    if (!G || !(inv[key] > 0) || W.eq[pid] !== key) return;
    if (g.hold(pid).length) return g.tell(pid, 'Your hands are full.');
    const fx = Math.sin(a.yaw || 0), fz = Math.cos(a.yaw || 0);
    const cops = (r, front) => g.police.cops.filter(c => c.kind !== 'insp' && c.kind !== 'officer' && c.kind !== 'yard' && Math.hypot(c.x - a.x, c.z - a.z) < r && (!front || (c.x - a.x) * fx + (c.z - a.z) * fz > -0.4))
      .sort((p, q) => (p.stun > 0) - (q.stun > 0) || Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z)); // the ones still standing first
    const calm = (c) => { c.tgt = null; c.sus = {}; };
    const bark = (c, text) => g.broadcastEvent({ k: 'bark', cop: c.id, text });
    const out = { k: 'gear', pid, key, op: 'use', x: a.x, z: a.z, yaw: a.yaw || 0 };
    const debt = () => g.debts.list.filter(d => BAGGABLE.includes(d.state)).map(d => ({ d, at: g.debts.at(d) })).filter(o => Math.hypot(o.at.x - a.x, o.at.z - a.z) < 3.8)[0];
    const debtorSay = (d, lines) => g.broadcastEvent({ k: 'dlg', lines, pid, who: { debtor: { name: d.name, color: '#c8c8d8' } } });
    switch (key) {
      case 'foambat': case 'mallet': {
        // the guest in the Time-Out Chair comes first
        const ch = g.town.poi.storageChair;
        if (ch && g.debts.chairTaken() && Math.hypot(a.x - ch.x, a.z - ch.z) < 2.8) { g.debts.bonk(pid, key); break; }
        if (g.rivals.gearUse(pid, key, a)) { out.hit = null; break; }
        const c = cops(key === 'mallet' ? 2.9 : 2.5, true)[0];
        if (c) { c.st = 'stun'; c.stun = key === 'mallet' ? 7 : 4; c.flat = key === 'mallet'; calm(c); g.addHeat(1); out.hit = { x: c.x, z: c.z }; bark(c, pick(key === 'mallet' ? MALLET_BARKS : BAT_BARKS)); }
        break;
      }
      case 'toolbox': {
        if (g.rivals.gearUse(pid, key, a)) { g.tell(pid, 'Snip. One fictional power cable, cut. The camera goes dark.'); break; }
        const s = STATIONS.filter(s => (s.floor || 0) === (a.f || 0) && Math.hypot(s.x - a.x, s.z - a.z) < 2.8).map(s => ({ s, st: W.st[s.id] })).find(o => o.st && (o.st.burnt || o.st.grease > 0.05) && !(o.st.fire > 0));
        if (s) { s.st.burnt = false; s.st.grease = 0; out.fixed = { x: s.s.x, z: s.s.z }; g.tell(pid, 'CLANG BONK RATTLE. Fixed and scrubbed. You still don\'t know what was in the toolbox.'); }
        else g.tell(pid, 'Nothing here needs fixing. You bang the toolbox anyway. Satisfying.');
        break;
      }
      case 'cutout': {
        const o = debt();
        if (!o) { g.tell(pid, 'You hold up Cardboard Knuckles. A pigeon is mildly intimidated. Try it at a debtor\'s door.'); break; }
        if (o.d.cut) { debtorSay(o.d, [['debtor', 'Nice try. That\'s the cardboard one. I can see the stick.']]); break; }
        o.d.cut = true;
        if (Math.random() < 0.8) { debtorSay(o.d, [['debtor', 'K-K-KNUCKLES?! Okay! OKAY! Here! Take it! Tell him I said hi! From a distance!']]); g.debts.pay(pid, o.d); }
        else debtorSay(o.d, [['debtor', '...Knuckles? Why are you so flat? ...Is that CARDBOARD?']]);
        break;
      }
      case 'smoke': {
        out.smoke = true;
        const I = W.insp;
        if (I && roomAt(a.x, a.z, a.f || 0)) {
          if (!I.smoke) { I.smoke = true; g.tell(null, 'PARTY FOG! The hideout is full of it. The officers can\'t see a thing (-3 evidence).'); }
          else g.tell(pid, 'It\'s already foggy in here. Any more and you\'ll lose Dez.');
        } else g.tell(pid, 'PFFFFSHHH. Party fog everywhere. Nobody is impressed. Use it in the hideout during an inspection.');
        break;
      }
      case 'lockpick': {
        const o = debt();
        if (!o) { g.tell(pid, 'You jiggle the keys at nothing. The rubber chicken squeaks. Use it at a late debtor\'s door.'); break; }
        if (o.d.state === 'overdue') { g.tell(pid, 'Their deadline already passed. Just talk to them (E).'); break; }
        o.d.state = 'overdue'; o.d.t = 0;
        debtorSay(o.d, [['narr', 'Jiggle jiggle. *SQUEAK* (the chicken). *click* (the lock).'], ['debtor', 'HEY! How did you- is that a CHICKEN?'], ['narr', 'Deadline skipped. Talk to them (E): you can take their ' + g.debts.itemOf(o.d) + ' right now.']]);
        break;
      }
      case 'disguise': {
        inv.disguise--; W.incog = W.incog || {}; W.incog[pid] = 45;
        for (const c of g.police.cops) { if (c.tgt === pid && c.st === 'chase') { c.st = 'search'; c.searchT = 5; c.tx = c.x; c.tz = c.z; } if (c.sus) delete c.sus[pid]; }
        out.disguise = true;
        g.tell(pid, 'Glasses. Nose. Mustache. You are a completely different person for 45 seconds. Even your mother wouldn\'t know.');
        break;
      }
      case 'airhorn': {
        let n = 0;
        for (const c of cops(15)) { c.stun = Math.max(c.stun || 0, 3); n++; }
        out.horn = true; out.n = n;
        break;
      }
      case 'flashlight': {
        const c = cops(7, true).find(c => c.st === 'chase' && c.tgt === pid);
        if (c) { c.stun = Math.max(c.stun || 0, 2); out.blind = { x: c.x, z: c.z }; bark(c, 'AAH! MY EYES! It\'s so BRIGHT!'); }
        break;
      }
      case 'decoy': {
        inv.decoy--;
        const tx = a.x + fx * 10, tz = a.z + fz * 10;
        out.decoy = { tx, tz };
        for (const c of g.police.cops) {
          if (c.kind === 'insp' || c.kind === 'officer' || c.kind === 'yard') continue;
          if ((c.st === 'chase' && c.tgt === pid) || (c.sus && c.sus[pid] > 0.2) || Math.hypot(c.x - tx, c.z - tz) < 20) {
            c.st = 'search'; c.searchT = 8; c.tx = tx; c.tz = tz; calm(c);
          }
        }
        break;
      }
      case 'docs': {
        const I = W.insp;
        if (I && !I.docs) { I.docs = true; inv.docs--; g.tell(null, 'You hand the officers your "very official" documents. They are very impressed (-4 evidence).'); out.shown = true; break; }
        const c = cops(4.5)[0];
        if (!c) { g.tell(pid, 'Nobody official around to show them to. You read them yourself. You\'re a duke now, apparently.'); break; }
        inv.docs--; c.st = c.fixed ? 'guard' : 'patrol'; c.node = nearestNode(c.x, c.z); calm(c); bark(c, pick(DOCS_BARKS)); out.shown = true;
        break;
      }
      case 'briefcase': {
        const c = cops(4.2).find(c => c.st === 'chase' && c.tgt === pid) || cops(3)[0];
        if (!c) { g.tell(pid, 'You open the briefcase at nobody. The muffin looks at you. Use it on a cop who is chasing you.'); break; }
        if (W.money < 2000) { g.tell(pid, 'You open the briefcase. It\'s just the muffin. The cop eats it and keeps chasing you.'); break; }
        W.money -= 2000; c.st = c.fixed ? 'guard' : 'patrol'; c.node = nearestNode(c.x, c.z); calm(c);
        g.addHeat(-10); bark(c, pick(BRIBE_BARKS)); out.open = { x: c.x, z: c.z };
        break;
      }
    }
    if (G.uses && !(inv[key] > 0)) { W.eq[pid] = null; g.tell(pid, 'That was your last ' + G.label + '.'); }
    g.broadcastEvent(out);
  }

  /* ---------------- everyone: events ---------------- */
  onEvent(e) {
    const g = this.g, P = g.player, a = g.audio, me = e.pid === g.me;
    if (e.k === 'bmReveal') { if (me) this.reveal(); else this.shelfK = this.shelfK || 0; return; }
    if (e.k !== 'gear') return;
    const G = GEAR[e.key]; if (!G) return;
    if (!me) { const r = g.remotes.get(e.pid); if (r) r.gear.play(G.anim); a.whoosh({ x: e.x, z: e.z }); }
    const near = Math.hypot(P.pos.x - e.x, P.pos.z - e.z) < 30;
    const at = (o, y = 1.2) => new THREE.Vector3(o.x, y, o.z);
    const delay = (s, f) => setTimeout(f, s * 1000);
    if (e.hit) delay(e.key === 'mallet' ? 0.42 : 0.22, () => {
      g.fx.text(e.key === 'mallet' ? 'SPLAT!' : 'BONK!', at(e.hit, 2.2), '#ffd23f', true);
      g.fx.sparkle(e.hit.x, 1.6, e.hit.z, '#ffd23f'); a.thud(e.hit);
      if (e.key === 'mallet') { g.fx.poof(e.hit.x, 0.3, e.hit.z); if (near) g.fx.shake = Math.max(g.fx.shake || 0, 0.35); }
    });
    if (e.fixed) { g.fx.sparkle(e.fixed.x, 1.2, e.fixed.z, '#43e07a'); a.thud(e.fixed); }
    if (e.smoke) for (let i = 0; i < 3; i++) delay(i * 0.25, () => g.fx.smoke(e.x + Math.sin(e.yaw) * 1.2, 0.6, e.z + Math.cos(e.yaw) * 1.2, 30, 0.35));
    if (e.disguise) { g.fx.poof(e.x, 1.6, e.z); a.whoosh({ x: e.x, z: e.z }); }
    if (e.horn) {
      a.tone(330, 0.9, 'sawtooth', near ? 0.22 : 0.08); a.tone(415, 0.9, 'sawtooth', near ? 0.18 : 0.06);
      if (near) g.ui.alarm('HOOOOONK!');
      for (const c of g.citizens.list) if (Math.hypot(c.x - e.x, c.z - e.z) < 22) c.panic = 3;
    }
    if (e.blind) g.fx.text('BLINDED!', at(e.blind, 2.3), '#fff6c0', true);
    if (e.open) { g.fx.text('$2,000 + A MUFFIN', at(e.open, 2.4), '#43e07a', true); a.cash(); }
    if (e.shown) a.ding();
    if (e.decoy) {
      const m = makeGear('decoy'); g.scene.add(m);
      const from = new THREE.Vector3(e.x + Math.sin(e.yaw) * 0.6, 1.5, e.z + Math.cos(e.yaw) * 0.6);
      this.flying.push({ m, from, to: new THREE.Vector3(e.decoy.tx, 0.05, e.decoy.tz), t: 0, life: 9, said: false });
    }
  }

  /* ---------------- everyone: every frame ---------------- */
  update(dt) {
    const g = this.g, W = this.W, P = g.player, T = g.town.poi;
    for (const w of [...this.waits]) { w.t -= dt; if (w.t <= 0) { this.waits.splice(this.waits.indexOf(w), 1); w.res(); } }
    const nearShop = Math.hypot(P.pos.x - T.books.ocx, P.pos.z - T.books.zp) < 45 || this.cine;
    if (nearShop) { this._vito(dt); this._shelf(dt); }
    if (this.cine?.follow && g.cam.override) g.cam.override.look.set(this.vito.x, 1.3, this.vito.z);
    this.vito.rig.root.visible = !!nearShop;
    if (P.pos.x > 760 && P.pos.x < 840) this._market(dt);
    // decoys flying
    for (const f of [...this.flying]) {
      f.t += dt;
      const k = Math.min(1, f.t / 0.7);
      f.m.position.lerpVectors(f.from, f.to, k); f.m.position.y = f.from.y * (1 - k) + Math.sin(k * Math.PI) * 2.5 + 0.05 * k;
      f.m.rotation.set(k < 1 ? f.t * 9 : 0, f.t * (k < 1 ? 4 : 0.6), 0);
      if (k >= 1 && !f.said) {
        f.said = true; g.fx.poof(f.to.x, 0.3, f.to.z); g.audio.thud(f.to);
        setTimeout(() => g.bubble(() => ({ x: f.to.x, z: f.to.z }), pick(['IT\'S EMPTY?!', 'Who orders an EMPTY pizza?!', '"NOT A PIZZA :P" ...I hate this.'])), 2500);
      }
      if (f.t > f.life) { g.scene.remove(f.m); this.flying.splice(this.flying.indexOf(f), 1); }
    }
    if (g.phase === 'play') this._input(dt);
    this._hud();
  }

  _vito(dt) {
    const g = this.g, V = this.vito, P = g.player, B = g.town.poi.books;
    let speed = 0, st = { talk: g.ui.talking === 'vito' };
    if (V.st === 'walk' && V.path.length) {
      const p = V.path[0], dx = p.x - V.x, dz = p.z - V.z, d = Math.hypot(dx, dz);
      if (d < 0.08) { V.path.shift(); if (!V.path.length) { V.st = V.next || 'home'; V.onArrive && V.onArrive(); V.onArrive = null; } }
      else { const s = Math.min(d, 1.9 * dt); V.x += dx / d * s; V.z += dz / d * s; V.yaw = dampAngle(V.yaw, Math.atan2(dx, dz), 10, dt); speed = 1.9; }
    } else if (V.st === 'home') {
      // nervous: he looks at you, then at the back shelf, then at the door, then at you
      const dp = Math.hypot(P.pos.x - V.x, P.pos.z - V.z);
      V.yaw = dampAngle(V.yaw, dp < 8 ? Math.atan2(P.pos.x - V.x, P.pos.z - V.z) : Math.PI / 2, 5, dt);
      V.glance -= dt;
      if (V.glance <= 0) { V.glance = rand(1.5, 4); V.look = pick([0, 0, 0.9, -0.9]); }
      V.head = damp(V.head, V.look || 0, 14, dt);
      st.headYaw = V.head;
    } else if (V.st === 'around') {
      // checking nobody is watching: left, right, left, up (birds)
      V.t = (V.t || 0) + dt;
      st.headYaw = Math.sin(V.t * 5) * 1.0; st.headPitch = V.t > 1.3 ? -0.5 : 0; st.panic = 0.15;
    } else if (V.st === 'pull') {
      st.point = true; st.headPitch = -0.25;
    } else if (V.st === 'present') {
      st.wave = true;
      V.yaw = dampAngle(V.yaw, Math.atan2(g.camera.position.x - V.x, g.camera.position.z - V.z), 6, dt);
    } else if (V.st === 'face') {
      V.yaw = dampAngle(V.yaw, Math.atan2(P.pos.x - V.x, P.pos.z - V.z), 8, dt);
      st.headYaw = Math.sin(performance.now() * 0.004) * 0.15;
    }
    if (V.st === 'pull') V.yaw = dampAngle(V.yaw, 0, 10, dt);
    V.rig.root.position.set(V.x, 0.05, V.z); V.rig.root.rotation.y = V.yaw;
    V.rig.anim(dt, { speed, ...st });
  }
  _shelf(dt) {
    const S = this.g.town.poi.books.shelf, W = this.W;
    if (!this.cine) this.shelfK = damp(this.shelfK, W.bm ? 1 : 0, 2.5, dt);
    const k = this.shelfK;
    // first it pops back a little, then it swings
    const pop = clamp(k / 0.15, 0, 1), swing = clamp((k - 0.15) / 0.85, 0, 1);
    S.pivot.position.z = this.g.town.poi.books.zp + 0.1 + pop * 0.06;
    S.pivot.rotation.y = (swing * swing * (3 - 2 * swing)) * 1.55;
    S.col.on = k < 0.5;
    S.book.rotation.x = this.cine ? -(this.cine.book || 0) * 0.7 : W.bm ? -0.15 : 0;
  }
  _market(dt) {
    const g = this.g, P = g.player;
    for (const d of this.displays) d.holder.rotation.y += dt * 0.6;
    const B = this.broker;
    B.rig.root.rotation.y = dampAngle(B.rig.root.rotation.y, Math.atan2(P.pos.x - B.x, P.pos.z - B.z), 3, dt);
    B.rig.anim(dt, { talk: g.ui.talking === 'broker' });
    for (const r of this.regulars) {
      r.t += dt;
      const n = r.n, talking = n.pose === 'talk' && Math.sin(r.t * 0.9 + n.x) > 0;
      r.rig.anim(dt, { sit: n.pose === 'sit', talk: talking || (n.pose === 'sit' && Math.sin(r.t * 0.7) > 0.4), carry: n.pose === 'paper', headYaw: n.pose === 'paper' ? Math.sin(r.t * 0.8) * 0.4 : 0, wave: n.pose === 'talk' && Math.sin(r.t * 0.9 + n.x) > 0.93 });
      if (n.pose === 'sit') r.rig.root.position.y = 0.25;
    }
    this.barkT -= dt;
    if (this.barkT <= 0) {
      this.barkT = rand(5, 9);
      const near = this.regulars.filter(r => Math.hypot(r.n.x - P.pos.x, r.n.z - P.pos.z) < 12);
      if (near.length) { const r = pick(near); g.bubble(() => ({ x: r.n.x, z: r.n.z }), pick(MARKET_BARKS)); }
    }
  }

  /* ---------------- prompts ---------------- */
  targets(P, out) {
    const g = this.g, W = this.W, T = g.town.poi, B = T.books, V = this.vito;
    if (P.floor !== 0 || this.cine) return;
    const H = g.hold(g.me), top = H[H.length - 1];
    const dv = Math.hypot(P.pos.x - V.x, P.pos.z - V.z);
    if (dv < 2.6 && V.st === 'home') out.push({ x: V.x, z: V.z, d: dv, label: W.bm ? 'Talk to Vito' : isPizza(top) ? 'Give the bookseller your pizza' : 'Talk to the bookseller', fn: () => this.talkVito() });
    const ds = Math.hypot(P.pos.x - B.ocx, P.pos.z - (B.zp - 0.8));
    if (!W.bm && ds < 1.5) out.push({ x: B.ocx, z: B.zp, d: ds + 0.3, label: 'A bookshelf. One red book sticks out a bit...', fn: () => this.pokeShelf() });
    const dd = Math.hypot(P.pos.x - B.stairs.x, P.pos.z - B.stairs.z);
    if (W.bm && dd < 1.9) out.push({ x: B.stairs.x, z: B.stairs.z, d: dd, label: 'Go down the secret stairs', fn: () => this.goDown() });
    const de = Math.hypot(P.pos.x - T.marketExit.x, P.pos.z - T.marketExit.z);
    if (de < 1.9) out.push({ x: T.marketExit.x, z: T.marketExit.z, d: de, label: 'Climb the stairs back up to the bookshop', fn: () => this.goUp() });
    const db = Math.hypot(P.pos.x - this.broker.x, P.pos.z - this.broker.z);
    if (db < 2.8) out.push({ x: this.broker.x, z: this.broker.z, d: db, label: 'Talk to the Broker', fn: () => this.brokerTalk() });
  }
  async talkVito() {
    const g = this.g, W = this.W, H = g.hold(g.me), top = H[H.length - 1];
    if (W.bm) return g.ui.dialog([['vito', pick(VITO.after)]]);
    if (isPizza(top)) return g.act({ k: 'bm', op: 'give' });
    await g.ui.dialog([['vito', pick(VITO.hi)], ['vito', pick(VITO.hint)]]);
  }
  pokeShelf() {
    const g = this.g, V = this.vito;
    g.bubble(() => ({ x: V.x, z: V.z }), pick(['HEY! Not that one! That\'s a... very rare book. About birds.', 'DON\'T TOUCH- I mean. Please. Don\'t. It\'s fragile. The shelf. Emotionally.', 'That shelf is for LOOKING. With your EYES. From over THERE.']));
    V.look = 0.9; V.glance = 2;
  }
  brokerTalk() {
    const g = this.g;
    g.ui.dialog([['broker', pick(BROKER.hi)], ['broker', 'Everything on the tables is for sale. Stand in front of one and press E. Then the number keys (or I for your inventory) to take it out, and click to use it.']]);
  }
  goDown() {
    const g = this.g, P = g.player, M = g.town.poi.marketIn;
    g.ui.fade(true); g.audio.ovenDoor(null);
    setTimeout(() => {
      P.teleport(M.x, M.z, 0, M.ry); g.cam.snap = true; g.ui.fade(false);
      if (!this.visited) { this.visited = true; setTimeout(() => { g.ui.alarm('THE UNDERGROUND MARKET'); g.audio.cheer(); g.ui.toast('Buy gear off the tables (E). B: your gear. Click: use it.'); }, 500); }
    }, 300);
  }
  goUp() {
    const g = this.g, P = g.player, L = g.town.poi.books.landing;
    g.ui.fade(true); g.audio.ovenDoor(null);
    setTimeout(() => { P.teleport(L.x, L.z, 0, Math.PI); g.cam.snap = true; g.ui.fade(false); }, 300);
  }

  /* ---------------- the reveal (a little film, only for whoever brought the pizza) ---------------- */
  wait(s) { return new Promise(res => this.waits.push({ t: s, res })); }
  walk(path, next) { const V = this.vito; V.path = path.map(p => ({ ...p })); V.st = 'walk'; V.next = next; return new Promise(res => { V.onArrive = res; }); }
  async reveal() {
    const g = this.g, ui = g.ui, P = g.player, V = this.vito, B = g.town.poi.books;
    if (this.cine) return;
    this.cine = { book: 0 }; this.shelfK = 0;
    ui.closeMenu(); ui.cinema(true);
    const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const shot = (pos, look) => { g.cam.override = { pos, look }; };
    try {
      // 1. he sniffs the pizza (close-up)
      V.st = 'face';
      const toP = Math.atan2(P.pos.x - V.x, P.pos.z - V.z);
      shot(v3(V.x + Math.sin(toP) * 2.1 + Math.cos(toP) * 0.5, 1.9, V.z + Math.cos(toP) * 2.1 - Math.sin(toP) * 0.5), v3(V.x, 1.85, V.z));
      g.fx.sparkle(V.x, 1.4, V.z, '#ffd23f');
      await ui.dialog(VITO.reveal);
      // 2. is anybody watching? left, right, up (birds)
      V.st = 'around'; V.t = 0; g.audio.tone(220, 0.15, 'triangle', 0.06);
      await this.wait(1.8);
      // 3. he walks to the back shelf; the camera watches from the aisle
      const walk = this.walk(B.vitoPath, 'pull');
      const c2 = B.cam2;
      shot(v3(c2.x, c2.y, c2.z), v3(V.x, 1.3, V.z)); this.cine.follow = true;
      await Promise.race([walk, this.wait(14)]);
      this.cine.follow = false;
      V.x = B.vitoPath[B.vitoPath.length - 1].x; V.z = B.vitoPath[B.vitoPath.length - 1].z; V.path = []; V.st = 'pull';
      // 4. he pulls the red book: click
      shot(v3(B.ocx - 1.6, 1.9, B.zp - 2.2), v3(B.ocx, 1.55, B.zp));
      await this.wait(0.5);
      for (let i = 0; i <= 10; i++) { this.cine.book = i / 10; await this.wait(0.03); }
      g.audio.tone(1800, 0.05, 'square', 0.12); g.audio.tone(900, 0.08, 'square', 0.08);
      await this.wait(0.45);
      // 5. the shelf pops, rumbles and swings away
      shot(v3(B.ocx - 0.6, 1.7, B.zp - 3.4), v3(B.ocx + 0.1, 1.2, B.zp + 0.6));
      V.st = 'walk'; V.path = [{ x: B.ocx - 1.9, z: B.zp - 1.1 }]; V.next = 'present';   // he steps aside: ta-da
      g.audio.noise && g.audio.noise(1.6, 0.12, 'lowpass', 300, 1);
      for (let i = 0; i <= 60; i++) {
        this.shelfK = i / 60;
        if (i % 10 === 0) { g.fx.shake = 0.12; g.fx.poof(B.ocx + rand(-0.8, 0.8), 0.15, B.zp - 0.5); }
        await this.wait(1.7 / 60);
      }
      this.shelfK = 1; g.fx.sparkle(B.ocx - 1, 1.0, B.zp + 1.2, '#ffb84a');
      await this.wait(0.4);
      shot(v3(B.ocx - 0.4, 1.65, B.zp - 3.0), v3(B.ocx - 0.5, 1.3, B.zp + 1.0));
      V.st = 'present';
      await ui.dialog(VITO.reveal2);
    } finally {
      ui.cinema(false); g.cam.override = null; this.cine = null; this.shelfK = 1;
      // you're left looking at the open shelf; Vito goes back to his counter
      P.camYaw = Math.atan2(B.ocx - P.pos.x, B.zp - P.pos.z) + Math.PI; g.cam.snap = true;
      this.walk([...B.vitoPath].reverse().concat([{ x: B.vito.x, z: B.vito.z }]), 'home');
      g.ui.alarm('SECRET FOUND!'); g.audio.cheer();
      g.ui.toast('The Underground Market: go through the shelf and down the stairs.');
    }
  }

  /* ---------------- local input: gear menu (B), use (click / C) ---------------- */
  _input(dt) {
    const g = this.g, I = g.input, P = g.player, W = this.W;
    this.useT -= dt;
    if (g.frozen()) return;
    if (I.pressed('KeyB')) g.inv.show('gear');
    const eq = W.eq?.[g.me];
    if (!eq || P.car || P.hidden) return;
    if ((I.click(0) || I.pressed('KeyC')) && this.useT <= 0) this.use();
  }
  use() {
    const g = this.g, P = g.player, W = this.W, key = W.eq?.[g.me], G = GEAR[key];
    if (!G) return;
    if (g.hold(g.me).length) { g.ui.toast('Your hands are full. (Put things down or deliver them first.)'); return; }
    this.useT = (ANIM_T[G.anim] || 0.5) + 0.05;
    P.gear.play(G.anim); P.gearVM.play(G.anim);
    g.audio.whoosh(P.pos);
    if (key === 'flashlight') this._clueHint();
    g.act({ k: 'bm', op: 'use', key, x: +P.pos.x.toFixed(2), z: +P.pos.z.toFixed(2), yaw: +P.yaw.toFixed(3), f: P.floor });
  }
  /** the flashlight points you at the nearest clue you haven't read */
  _clueHint() {
    const g = this.g, P = g.player;
    let best = null, bd = 1e9;
    for (const [id, c] of g.npcs.clues) { if (!c.m.visible) continue; const d = Math.hypot(c.x - P.pos.x, c.z - P.pos.z); if (d < bd) { bd = d; best = c; } }
    if (!best) return g.ui.toast('The flashlight finds... dust. No clues left out there.');
    const a = Math.atan2(best.x - P.pos.x, best.z - P.pos.z), rel = Math.atan2(Math.sin(a - P.yaw), Math.cos(a - P.yaw));
    const dir = Math.abs(rel) < 0.4 ? 'straight ahead' : Math.abs(rel) > 2.6 ? 'behind you' : rel > 0 ? 'to your left' : 'to your right';
    g.ui.toast('The beam catches something: a clue, ' + Math.round(bd) + 'm ' + dir + '.');
    g.fx.sparkle(best.x, 1.6, best.z, '#fff6c0');
  }
  gearMenu() {
    const g = this.g, W = this.W, inv = W.gear?.[g.me] || {}, eq = W.eq?.[g.me];
    const own = GEAR_ORDER.filter(k => inv[k] > 0);
    const items = own.map(k => ({
      label: (eq === k ? 'Put away: ' : 'Take out: ') + GEAR[k].label + (GEAR[k].uses ? ' (x' + inv[k] + ')' : ''),
      sub: GEAR[k].desc, owned: eq === k,
      on: () => g.act({ k: 'bm', op: eq === k ? 'away' : 'equip', key: k }),
    }));
    if (!own.length) items.push({ label: 'You have no gear.', sub: W.bm ? 'Buy some in the Underground Market (down the stairs behind the bookshelf in Pages & Pages).' : 'Rumor has it the bookshop on Pepper Road sells more than books. The owner looks hungry.', disabled: true });
    items.push({ label: 'Close' });
    g.ui.menu({ title: 'Your gear', sub: 'Click (or C) uses what is in your hand. Gear goes away while you carry things.', items });
  }
  shopLabel(s) {
    const W = this.W, G = GEAR[s.key], inv = W.gear?.[this.g.me] || {};
    if (!G) return { label: '?' };
    if (!G.uses && inv[s.key] > 0) return { label: (W.eq?.[this.g.me] === s.key ? 'Put away: ' : 'Take out: ') + G.label + ' (yours)' };
    return { label: 'Buy ' + G.label + ' - ' + money(G.price) + (G.uses && inv[s.key] ? ' (you have ' + inv[s.key] + ')' : '') + '. ' + G.desc };
  }
  _hud() {
    const g = this.g, W = this.W, key = g.phase === 'play' ? W.eq?.[g.me] : null, G = GEAR[key];
    const n = G?.uses ? W.gear?.[g.me]?.[key] || 0 : 0;
    const incog = Math.ceil(W.incog?.[g.me] || 0);
    const k = (key || '') + n + incog + g.hold(g.me).length;
    if (k === this.hudKey) return;
    this.hudKey = k;
    if (!G && !incog) { this.hud.style.display = 'none'; return; }
    this.hud.style.display = '';
    this.hud.innerHTML = (G ? '<div class="g-top">' + G.label + (G.uses ? ' x' + n : '') + '</div>' + (g.hold(g.me).length ? '<div class="h-help">(put away while you carry things)</div>' : '<div class="h-help"><b class="key">LMB</b> use · <b class="key">I</b> inventory</div>') : '') + (incog ? '<div class="h-help">DISGUISED (' + incog + 's)</div>' : '');
  }
}
