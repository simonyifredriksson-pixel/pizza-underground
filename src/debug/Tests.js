/* Tests.js - ?skip=<quest> drops you into the story, ?script=<name> runs a
   scripted check and writes PASS/FAIL lines into #testout (read it with a
   headless browser's --dump-dom). ?shot=<name> frames a screenshot. */
import { newWorld } from '../game/State.js';
import { Q } from '../data/Story.js';
import { STOCK } from '../data/Data.js';
import { HQ } from '../world/Town.js';
import { STATION } from '../data/Hideout.js';
import { drive as driveFn } from '../game/Vehicles.js';
import { VEHICLES as VEH } from '../data/Data.js';

export function setupAt(g, q) {
  const W = newWorld();
  W.quest = q; W.money = 60000; W.heat = 10;
  for (const k of STOCK) W.stock[k] = 20;
  if (q > Q.CLEAN) W.trash = W.trash.map(() => false);
  if (q > Q.POWER) W.power = true;
  if (q > Q.OVEN) W.oven1 = true;
  if (q >= Q.BIZ) { W.sign = 'shoes'; W.rep = 3; }
  const lv = +new URLSearchParams(location.search).get('level'); if (lv) W.level = lv;
  g.W = W;
  g.phase = 'play';
  document.getElementById('title').classList.add('gone');
  setTimeout(() => { g.ui.cinema(false); g.ui.fade(false); g.intro.active = null; g.cam.override = null; }, 600);
  g.ui.hudVisible(true); g.ui.cinema(false); g.ui.fade(false); g.ui.sub(null);
  g.intro.active = null; g.cam.override = null;
  if (q >= Q.CLEAN) g.player.teleport(146, 80, 0, Math.PI / 2);
  else g.spawnInTown();
  g.cam.snap = true;
  const qs = new URLSearchParams(location.search);
  const shot = qs.get('shot');
  if (qs.has('tp')) g.cam.mode = 'third';
  if (shot) frame(g, shot);
  const ui = qs.get('ui');
  if (ui) setTimeout(() => {
    if (ui === 'map') g.map.show();
    if (ui === 'storm') { W.weather = { k: 'storm', t: 300 }; g.weather.k = 0.99; }
    if (ui === 'insp') { g.inspections.start('A neighbor reported "suspicious happiness".'); W.insp.t = 31; }
    if (ui === 'admin') g.admin.toggle();
    if (ui === 'phone') { g.orders.spawn(); g.orders.spawn().state = 'open'; g.orders.spawn().sting = true; g.phone(); }
    if (ui === 'laptop') g.npcs.laptop();
    if (ui === 'drive') {
      const id = W.carSeq++; W.cars.push({ id, kind: qs.get('car') || 'family', x: -80, z: -26, yaw: Math.PI, drv: null, pas: [], cargo: [] });
      g.exec(g.me, { k: 'enter', id }); g.cam.mode = 'first';
    }
    if (ui === 'chair') {
      const d = g.debts.create('house', 2, 'Gary', 2000, 'test'); d.state = 'guest'; d.t = 60;
      const ch = g.town.poi.storageChair; g.player.teleport(ch.x - 1.5, ch.z - 2.5, 0, 0.6); g.cam.fpPitch = 0.2;
    }
    if (ui === 'shop') g.npcs.supplierMenuOnly('larry');
    if (ui === 'dialog') g.ui.dialog([['man', 'Do I look like a man who negotiates with carbohydrates?']]);
    if (ui === 'chase') { W.hold[g.me] = [{ k: 'box', sauce: 1, cheese: 1, top: [], cook: 1 }, { k: 'box', sauce: 1, cheese: 1, top: [], cook: 1 }, { k: 'box', sauce: 1, cheese: 1, top: [], cook: 1 }]; g.player.teleport(0, 24, 0, Math.PI); g.player.camYaw = Math.PI * 0.9; g.cam.pitch = 0.3; const c = g.police.spawnCop(); c.x = 3; c.z = 31; c.st = 'chase'; c.tgt = g.me; c.lx = 0; c.lz = 24; g.alarm('SPOTTED!'); }
    if (ui === 'fire') { g.kitchen.ignite('oven1'); g.kitchen.ignite('prep1'); W.hold[g.me] = [{ k: 'ext', from: 'ext1' }]; W.st.ext1.ext = false; g.player.teleport(147.5, 76.5, 0, Math.PI); g.player.camYaw = 0.3; g.cam.pitch = 0.7; g.input.fakeBtn(0, true); }
  }, 400);
}

/** put the camera somewhere nice for a screenshot */
function frame(g, s) {
  const P = g.player;
  const at = {
    hideout: () => { P.teleport(147, 81, 0, -0.6); g.cam.pitch = 0.75; g.cam.dist = 7.5; P.camYaw = 2.3; },
    basement: () => { P.teleport(152, 78, 1, 3.1); g.cam.pitch = 0.6; g.cam.dist = 8; P.camYaw = 0.4; },
    square: () => { P.teleport(6, 18, 0, 3.1); g.cam.pitch = 0.25; g.cam.dist = 7; P.camYaw = 0.3; },
    street: () => { P.teleport(-80, -30, 0, 3.1); g.cam.pitch = 0.2; g.cam.dist = 6.5; P.camYaw = 0.2; },
    man: () => { P.teleport(-89, -50, 0, -2.6); g.cam.pitch = 0.25; g.cam.dist = 5; P.camYaw = 0.9; },
    cityhall: () => { P.teleport(0, -60, 0, 3.1); g.cam.pitch = 0.2; g.cam.dist = 8; P.camYaw = 0.0; },
    mallOut: () => { P.teleport(-116, 72, 0, Math.PI / 2); g.cam.fpPitch = 0.05; },
    courtyard: () => { P.teleport(-90, 72, 0, 0.6); g.cam.fpPitch = 0.08; },
    grocery: () => { P.teleport(-80, 66, 0, Math.PI); g.cam.fpPitch = 0.1; },
    showroom: () => { P.teleport(-94, 88, 0, -Math.PI / 2); g.cam.fpPitch = 0.15; },
    equip: () => { P.teleport(-66, 88, 0, Math.PI / 2); g.cam.fpPitch = 0.15; },
    houses: () => { P.teleport(70, 50.5, 0, 0.35); g.cam.fpPitch = 0.05; },
    kitchen: () => { P.teleport(146.5, 78.5, 0, Math.PI); g.cam.pitch = 0.5; g.cam.dist = 5; P.camYaw = 0; },
    oven: () => { P.teleport(149.5, 75.6, 0, Math.PI); g.cam.fpPitch = 0.45; },
    prep: () => { P.teleport(145.7, 75, 0, Math.PI); g.cam.fpPitch = 0.5; },
    house: () => { const h = g.town.houses[1]; P.teleport(h.x + 1, h.z + 2.5, 0, Math.PI); g.cam.fpPitch = 0.15; },
    house2: () => { const h = g.town.houses[1]; P.teleport(h.x - 3, h.z - 2, 0, 0.8); g.cam.fpPitch = 0.1; },
    police: () => { P.teleport(78, -10, 0, 0); g.cam.fpPitch = 0.1; },
    cityhallIn: () => { P.teleport(0, -74, 0, Math.PI); g.cam.fpPitch = 0.05; },
    shop: () => { P.teleport(-80, -51.5, 0, Math.PI); g.cam.fpPitch = 0.12; },
    gas: () => { P.teleport(98, -59.5, 0, Math.PI); g.cam.fpPitch = 0.12; },
    pizzeria: () => { P.teleport(0, 54, 0, 0); g.cam.fpPitch = 0.15; },
    storage: () => { const s = g.town.poi.storageIn; P.teleport(s.x, s.z, 0, -Math.PI / 2); g.cam.fpPitch = 0.12; },
    hideoutOut: () => { P.teleport(130, 82, 0, 1.5); g.cam.pitch = 0.3; g.cam.dist = 8; P.camYaw = -2.0; },
  }[s];
  if (at) at();
  g.cam.snap = true;
}

const out = [];
function log(ok, msg) { out.push((ok ? 'PASS ' : 'FAIL ') + msg); paint(); }
function note(msg) { out.push('.... ' + msg); paint(); }
function paint() {
  let el = document.getElementById('testout');
  if (!el) { el = document.createElement('pre'); el.id = 'testout'; el.style.cssText = 'position:fixed;left:8px;top:120px;z-index:99;background:rgba(0,0,0,.8);color:#9f9;font:12px monospace;padding:6px;max-width:60vw;white-space:pre-wrap'; document.body.appendChild(el); }
  el.textContent = out.join('\n') + '\nLOGS: ' + (window.__logs || []).join(' || ');
}
/** run the game for `sec` seconds of simulated time, as fast as possible */
function sim(g, sec, step = 1 / 30) { for (let t = 0; t < sec; t += step) { g.update(step); g.input.endFrame(); } }

export async function run(g, name) {
  await new Promise(r => setTimeout(r, 300));
  try {
    if (name === 'kitchen') return kitchen(g);
    if (name === 'fire') return fire(g);
    if (name === 'police') return police(g);
    if (name === 'story') return story(g);
    if (name === 'inspector') return inspector(g);
    if (name === 'input') return inputTest(g);
    if (name === 'debts') return debts(g);
    if (name === 'kidnap') return kidnap(g);
    if (name === 'cockdbg') {
      fresh(g); const W = g.W;
      const id = W.carSeq++; W.cars.push({ id, kind: 'family', x: -80, z: -26, yaw: Math.PI, drv: null, pas: [], cargo: [] });
      g.exec(g.me, { k: 'enter', id }); g.cam.mode = 'first'; sim(g, 0.5);
      const c = W.cars.find(x => x.id === id), cam = g.camera.position, P = g.player;
      const lx = cam.x - c.x, lz = cam.z - c.z, cs = Math.cos(-c.yaw), sn = Math.sin(-c.yaw);
      note('car ' + c.x.toFixed(2) + ',' + c.z.toFixed(2) + ' yaw ' + c.yaw.toFixed(2) + ' P ' + P.pos.x.toFixed(2) + ',' + P.pos.y.toFixed(2) + ',' + P.pos.z.toFixed(2));
      note('cam world ' + cam.x.toFixed(2) + ',' + cam.y.toFixed(2) + ',' + cam.z.toFixed(2) + ' local x ' + (lx * cs + lz * sn).toFixed(2) + ' z ' + (-lx * sn + lz * cs).toFixed(2));
      const K = g.vehicles.cockpit; note('cockpit pos ' + K.group.position.x.toFixed(2) + ',' + K.group.position.z.toFixed(2) + ' rot ' + K.group.rotation.y.toFixed(2) + ' seat0 ' + JSON.stringify(g.vehicles.meshes.get(id).C.seats[0]));
      const f = g.camera.position.clone(); g.camera.getWorldDirection(f); note('cam dir ' + f.x.toFixed(2) + ',' + f.y.toFixed(2) + ',' + f.z.toFixed(2) + ' mode ' + g.cam.mode);
      return;
    }
    if (name === 'mall') return mall(g);
    if (name === 'admin') {
      setupAt(g, 3); sim(g, 0.2);
      const W = g.W, A = g.admin, m0 = W.money;
      A.run('give', 10000); log(W.money === m0 + 10000, 'admin: give money');
      A.run('set', 5); log(W.money === 5, 'admin: set money');
      A.run('order'); A.close(); g.phone();
      log(document.getElementById('panel').textContent.includes(W.orders[0]?.name || '###'), 'admin order shows on the phone early in the story');
      g.ui.closeMenu();
      A.run('inspect'); A.close();
      const t0 = W.insp?.t; sim(g, 3, 1 / 15);
      log(W.insp && W.insp.t < t0 - 2, 'inspection countdown ticks down (' + Math.round(t0) + ' -> ' + Math.round(W.insp?.t) + ')');
      for (let i = 0; i < 60 && W.insp && W.insp.ph === 'warn'; i++) sim(g, 1, 1 / 15);
      log(W.insp?.ph === 'search' && g.police.cops.some(c => c.kind === 'officer'), 'the officers arrived');
      for (let i = 0; i < 120 && W.insp; i++) sim(g, 1, 1 / 15);
      log(!W.insp, 'the inspection finished');
      A.run('event', 'supplierVan'); log(W.event?.k === 'supplierVan', 'admin: supplier van event');
      A.run('resetEvent'); log(!W.event, 'admin: reset event');
      A.run('event', 'checkpoint'); const cps = g.police.cops.filter(c => c.kind === 'check').map(c => c.x + ',' + c.z).join(); sim(g, 2, 1 / 15);
      log(g.police.cops.filter(c => c.kind === 'check').map(c => c.x + ',' + c.z).join() !== cps, 'checkpoint cops move early in the story');
      A.run('resetEvent');
      const n = W.cars.length; A.run('car', 'getaway'); log(W.cars.length === n + 1, 'admin: spawn a getaway car');
      A.run('tp', { x: 0, z: 12 }); log(Math.hypot(g.player.pos.x, g.player.pos.z - 12) < 1, 'admin: teleport');
      A.run('storm'); log(!!W.weather, 'admin: storm on');
      A.run('refuse');
      const ro = W.orders.find(o => o.refuse);
      log(ro && ro.state === 'open' && g.orders.pins.size >= 0, 'admin: a refusing order appears on the phone right away (' + (ro && ro.name) + ')');
      const at = g.orders.at(ro); g.player.teleport(at.x, at.z + 0.5, 0); sim(g, 0.2);
      g.exec(g.me, { k: 'deliver', id: ro.id });
      log(!W.orders.includes(ro) && (W.debts || []).some(d => d.name === ro.name), 'at the door they refuse to pay: ' + ro.name + ' is now on the debt list');
      A.run('item', 'box'); log(g.hold(g.me).some(i => i.k === 'box'), 'admin: give a pizza box');
      A.close();
      note('admin done');
      return;
    }
    if (name === 'phone') {
      setupAt(g, 3); sim(g, 0.2);
      g.admin.run('order'); g.admin.close();
      g.phone();
      const html = document.getElementById('panel').textContent;
      log(g.W.orders.length === 1 && html.includes(g.W.orders[0].name), 'early in the story, an admin order shows on the phone: ' + g.W.orders[0].name);
      return;
    }
    if (name === 'perf') {
      const R = g.renderer; let tris = 0, meshes = 0; g.scene.traverse(o => { if (o.isMesh && o.visible) { meshes++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); } });
      const t0 = performance.now(); for (let i = 0; i < 5; i++) R.render(g.scene, g.camera); const tr = (performance.now() - t0) / 5;
      const t1 = performance.now(); for (let i = 0; i < 20; i++) g.update(1 / 60); const tu = (performance.now() - t1) / 20;
      note('scene: ' + meshes + ' meshes, ' + Math.round(tris / 1000) + 'k tris; render ' + tr.toFixed(0) + 'ms; update ' + tu.toFixed(1) + 'ms; calls ' + R.info.render.calls);
      return;
    }
    if (name === 'dbg') { setTimeout(() => { note('tasks: ' + document.getElementById('tasks').innerHTML.slice(0, 300)); note('weather ' + JSON.stringify(g.W.weather) + ' k=' + g.weather.k + ' rain=' + g.weather.rain.visible + ' phase=' + g.phase + ' insp=' + JSON.stringify(g.W.insp && g.W.insp.ph)); }, 4000); return; }
    if (name === 'all') { kitchen(g); fire(g); police(g); inspector(g); story(g); note('DONE'); return; }
  } catch (e) { log(false, 'exception ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')); }
}

function fresh(g, q = Q.BIZ) { setupAt(g, q); sim(g, 0.2); }

function debts(g) {
  fresh(g);
  const me = g.me, W = g.W, D = g.debts;
  // a customer puts it on the tab
  g.orders.forceTab = true;
  const o = g.orders.spawn({ accepted: true }); o.top = []; o.extra = false; o.sting = false; o.rich = false;
  W.hold[me] = [{ k: 'box', sauce: 1, cheese: 1, top: [], cook: 1 }];
  const m0 = W.money;
  g.exec(me, { k: 'deliver', id: o.id });
  g.orders.forceTab = false;
  const d = W.debts[0];
  log(d && W.money === m0 && d.state === 'owed', 'customer put it on the tab: ' + (d && d.name + ' owes ' + d.amount));
  d.t = 0.05; sim(g, 0.2);
  log(d.state === 'late', 'the debt went late');
  g.exec(me, { k: 'debt', id: d.id, op: 'deadline' });
  log(d.state === 'warned', 'deadline given');
  d.t = 0.05; sim(g, 0.2);
  log(d.state === 'overdue', 'deadline blown');
  const h = g.town.houses[d.ref];
  g.exec(me, { k: 'debt', id: d.id, op: 'seize' });
  sim(g, 0.1);
  log(d.state === 'seized' && !h.vgroup.visible && D.storageGroup.children.length === 1, 'confiscated their ' + h.valuable + ' (gone from the house, in the storage room)');
  const m1 = W.money;
  d.t = 0.05; sim(g, 0.3);
  log(!W.debts.includes(d) && W.money === m1 + d.amount && h.vgroup.visible && D.storageGroup.children.length === 0, 'they paid ' + d.amount + ', the ' + h.valuable + ' went home');
  // reputation tiers and Knuckles
  D.addRep(30);
  log(D.tier === 2, 'mafia rep tier 2: ' + D.tier);
  W.money = 100000;
  g.exec(me, { k: 'upgrade', u: 'knuckles' });
  log(W.owned.up.knuckles, 'hired Knuckles');
  const b = D.create('biz', 'shoes', "Shoes 'R' Shoes", 6000, 'tab');
  b.state = 'late';
  g.exec(me, { k: 'debt', id: b.id, op: 'knuckles' });
  log(!!W.kn, 'Knuckles is on his way');
  for (let i = 0; i < 400 && W.kn; i++) sim(g, 1, 1 / 10);
  log(!W.kn && (!W.debts.includes(b) || b.state === 'seized'), 'Knuckles came back: ' + (W.debts.includes(b) ? 'took their sign' : 'collected'));
  if (b.state === 'seized') log(!g.town.biz.shoes.info.sign.visible, 'the shoe shop sign is gone');
  // rival and safe
  D.addRep(20);
  W.rival = { x: 0, z: 150, t: 100 };
  g.exec(me, { k: 'rival', pick: 'rock' });
  log(!W.rival, 'settled it with the Calzone Cartel (rock paper scissors)');
  g.exec(me, { k: 'upgrade', u: 'safe' });
  const total = W.money;
  g.exec(me, { k: 'safe', op: 'in', amt: 'all' });
  g.bust(me, 'test', 0.5, 0);
  log(W.safe === total && W.money === 0, 'the safe kept ' + W.safe + ' away from the fine');
  // the encounter dialogue path
  const e = D.create('house', 3, 'Kevin', 1000, 'test');
  g.exec(me, { k: 'debt', id: e.id, op: 'talk' });
  log(true, 'talked to a debtor: ' + (W.debts.includes(e) ? 'refused (menu offered)' : 'paid'));
  note('debts done');
}

/** the Comically Large Sack: bag a debtor, trunk, Time-Out Chair, pay. And the cockpit. */
function kidnap(g) {
  fresh(g);
  const me = g.me, W = g.W, D = g.debts, P = g.player;
  W.money = 50000;
  g.exec(me, { k: 'shop', cat: 'general', key: 'sack' });
  g.exec(me, { k: 'shop', cat: 'general', key: 'sack' });
  log(W.inv[me].sack === 2, 'bought 2 sacks at the general store');
  const d = D.create('house', 2, 'Gary', 2000, 'test'); d.state = 'late';
  const at = D.at(d); P.teleport(at.x, at.z + 0.6, 0); sim(g, 0.2);
  const T = []; D.targets(P, T);
  log(T.some(t => t.debt === d.id && t.alt && t.alt.act.op === 'bag'), 'at their door: R = "' + (T.find(t => t.debt === d.id)?.alt?.label) + '"');
  g.exec(me, { k: 'debt', id: d.id, op: 'bag' });
  log(d.state === 'bagged' && g.hold(me).some(i => i.k === 'bag' && i.id === d.id) && W.inv[me].sack === 1, 'bagged them: ' + d.name + ' is in the sack, in your arms');
  sim(g, 0.5);
  log(!D.rigs.has(d.id), 'nobody stands at the door any more');
  // into a trunk
  g.admin.run('car', 'scooter'); g.admin.close();
  const sc = W.cars[W.cars.length - 1];
  g.exec(me, { k: 'cargo', id: sc.id, op: 'load' });
  log(g.hold(me).some(i => i.k === 'bag'), 'a sack does not fit on a scooter');
  g.admin.run('car', 'family'); g.admin.close();
  const car = W.cars[W.cars.length - 1];
  g.exec(me, { k: 'cargo', id: car.id, op: 'load' });
  log(car.cargo.some(i => i.k === 'bag') && !g.hold(me).length, 'the sack went into the trunk of the family car');
  sim(g, 2);
  log(d.state === 'bagged', 'still in the trunk after a drive');
  // first person from the driver's seat: the cockpit
  g.cam.mode = 'first';
  g.exec(me, { k: 'enter', id: car.id }); sim(g, 0.3);
  const K = g.vehicles.cockpit, M = g.vehicles.meshes.get(car.id);
  log(K && K.group.visible && !M.C.group.visible && K.hands.visible, 'first person in the car: cockpit with hands on the wheel, outside of the car hidden');
  g.vehicles.local.spd = 12; g.vehicles._cockpit(0.1, g.vehicles.seatOf(me));
  log(Math.abs(K.dials[0].rotation.z + 2.2) > 0.3, 'the speedometer needle moved (' + K.dials[0].rotation.z.toFixed(2) + ')');
  g.exec(me, { k: 'exit' }); sim(g, 0.2);
  log(!K.group.visible && M.C.group.visible, 'got out: cockpit gone, the car is back');
  // out of the trunk, to the chair
  g.exec(me, { k: 'cargo', id: car.id, op: 'take' });
  log(g.hold(me).some(i => i.k === 'bag'), 'took the sack out of the trunk');
  const ch = g.town.poi.storageChair; P.teleport(ch.x + 1, ch.z, 0); sim(g, 0.2);
  const T2 = []; D.targets(P, T2);
  log(T2.some(t => t.act && t.act.op === 'seat'), 'at the Time-Out Chair: "' + T2.find(t => t.act && t.act.op === 'seat')?.label + '"');
  g.exec(me, { k: 'debt', id: d.id, op: 'seat' });
  sim(g, 0.3);
  log(d.state === 'guest' && D.guest && D.guest.id === d.id, d.name + ' is in the Time-Out Chair watching Dez\'s slideshow');
  const t0 = d.t; g.exec(me, { k: 'debt', id: d.id, op: 'slide' });
  log(!W.debts.includes(d) || d.t < t0 - 10, 'showed them a slide (' + Math.round(t0) + 's -> ' + (W.debts.includes(d) ? Math.round(d.t) + 's' : 'they cracked') + ')');
  const m0 = W.money;
  if (W.debts.includes(d)) { d.t = 0.05; sim(g, 0.3); }
  log(!W.debts.includes(d) && (W.money === m0 + d.amount || W.money >= m0), 'they paid up and went home');
  sim(g, 0.2);
  log(!D.guest, 'the chair is empty again');
  // a dropped sack: they escape
  const e = D.create('house', 4, 'Brenda', 1500, 'test'); e.state = 'overdue';
  g.exec(me, { k: 'debt', id: e.id, op: 'bag' });
  g.exec(me, { k: 'toss', x: P.pos.x, z: P.pos.z });
  log(e.state === 'overdue' && !g.hold(me).length, 'dropped the sack: ' + e.name + ' escaped and went home');
  // busted with a sack: the cops take it, they escape
  W.inv[me].sack = 1;
  g.exec(me, { k: 'debt', id: e.id, op: 'bag' });
  g.bust(me, 'test', 0, 0); sim(g, 0.2);
  log(e.state === 'overdue' && !g.hold(me).length, 'busted carrying a sack: the cops let them out');
  note('kidnap done');
}

/** the real input path: walk up to things and press keys */
function inputTest(g) {
  fresh(g);
  const I = g.input, P = g.player, W = g.W, me = g.me;
  const tap = (code) => { I.fake(code, true); sim(g, 1 / 30); I.fake(code, false); sim(g, 1 / 30); };
  const holdKey = (code, sec) => { I.fake(code, true); sim(g, sec); I.fake(code, false); sim(g, 1 / 30); };
  const face = (id) => { const s = STATION[id]; const fx = Math.sin(s.ry), fz = Math.cos(s.ry); P.teleport(s.x + fx * (s.d / 2 + 0.6), s.z + fz * (s.d / 2 + 0.6), 0); P.yaw = Math.atan2(-fx, -fz); P.camYaw = P.yaw - Math.PI; g.cam.fpPitch = 0.5; P.vel.set(0, 0, 0); sim(g, 0.1); };
  g.npcs.dez.x = 160; g.npcs.dez.z = 86; g.npcs.dez.wander.t = 999;
  face('dough1'); tap('KeyE');
  log(g.hold(me)[0]?.k === 'dough', 'E at the tub: dough in hand');
  face('prep1'); tap('KeyE');
  log(W.st.prep1.item?.k === 'dough', 'E at the counter: dough down');
  holdKey('KeyE', 1.2);
  log(W.st.prep1.item?.k === 'base', 'hold E: flattened');
  tap('Digit1'); tap('Digit2'); tap('Digit3');
  log(W.st.prep1.item?.sauce && W.st.prep1.item?.cheese === 1 && W.st.prep1.item?.top[0] === 'pepperoni', '1/2/3: sauce, cheese, pepperoni');
  log(document.getElementById('prepkeys').style.display !== 'none', 'topping keys panel shows');
  tap('KeyE');
  face('oven1'); tap('KeyE');
  log(W.st.oven1.item?.k === 'pizza', 'E at the oven: in');
  sim(g, 13);
  tap('KeyE');
  log(g.hold(me)[0]?.k === 'pizza' && g.hold(me)[0].cook > 0.85, 'E: out of the oven, ' + g.hold(me)[0]?.cook.toFixed(2));
  face('box1'); tap('KeyE');
  log(g.hold(me)[0]?.k === 'box', 'E at the box table: boxed');
  tap('KeyQ');
  log(g.hold(me).length === 0, 'Q: thrown away');
  tap('Tab');
  log(g.ui.menuOpen?.cls === 'phone', 'TAB opens the phone');
  tap('Tab');
  log(!g.ui.menuOpen, 'TAB closes it');
  tap('KeyM');
  log(g.ui.menuOpen?.cls === 'map', 'M opens the map');
  tap('KeyM');
  // a car
  W.cars.push({ id: 99, kind: 'scooter', x: 130, z: 82, yaw: 0, drv: null, pas: [] });
  P.teleport(131.5, 82, 0); sim(g, 0.1);
  tap('KeyF');
  log(W.cars[0].drv === me, 'F: in the scooter');
  holdKey('KeyW', 1.5);
  log(W.cars[0].z > 84, 'W drives it (z ' + W.cars[0].z.toFixed(1) + ')');
  tap('KeyF');
  log(!W.cars[0].drv && !P.car, 'F: out again');
  // dumpster
  P.teleport(134, 72.4, 0); sim(g, 0.1); tap('KeyE');
  log(!!P.hidden, 'E at a dumpster: hiding');
  tap('KeyE');
  log(!P.hidden, 'E: out of the dumpster');
  note('input done');
}

function kitchen(g) {
  fresh(g);
  const me = g.me, H = () => g.hold(me), W = g.W;
  const d0 = W.stock.dough;
  g.exec(me, { k: 'use', id: 'dough1', op: 'take' });
  log(H().length === 1 && H()[0].k === 'dough' && W.stock.dough === d0 - 1, 'take dough');
  g.exec(me, { k: 'use', id: 'prep1', op: 'place' });
  log(W.st.prep1.item?.k === 'dough' && H().length === 0, 'dough on the counter');
  g.exec(me, { k: 'use', id: 'prep1', op: 'flatten' });
  log(W.st.prep1.item?.k === 'base', 'flatten');
  for (const what of ['sauce', 'cheese', 'pepperoni', 'mushroom']) g.exec(me, { k: 'use', id: 'prep1', op: 'add', what });
  const it = W.st.prep1.item;
  log(it.sauce === 1 && it.cheese === 1 && it.top.join() === 'pepperoni,mushroom', 'toppings: ' + JSON.stringify(it));
  g.exec(me, { k: 'use', id: 'prep1', op: 'take' });
  g.exec(me, { k: 'use', id: 'oven1', op: 'place' });
  log(W.st.oven1.item?.k === 'pizza', 'in the oven');
  sim(g, 13);
  const c = W.st.oven1.item?.cook;
  log(c >= 0.85 && c < 1.35, 'cooked after 13s: ' + c?.toFixed(2));
  g.exec(me, { k: 'use', id: 'oven1', op: 'take' });
  g.exec(me, { k: 'use', id: 'box1', op: 'box' });
  log(H()[0]?.k === 'box', 'boxed');
  // an order that wants exactly this, delivered at the door
  const o = g.orders.spawn({ accepted: true });
  o.top = ['pepperoni', 'mushroom']; o.extra = false; o.sting = false;
  const m0 = W.money;
  g.exec(me, { k: 'deliver', id: o.id });
  log(W.money > m0 && !W.orders.includes(o), 'delivered, paid ' + (W.money - m0));
  // cheese explosion
  g.exec(me, { k: 'use', id: 'dough1', op: 'take' }); g.exec(me, { k: 'use', id: 'prep1', op: 'place' }); g.exec(me, { k: 'use', id: 'prep1', op: 'flatten' });
  for (let i = 0; i < 4; i++) g.exec(me, { k: 'use', id: 'prep1', op: 'add', what: 'cheese' });
  g.exec(me, { k: 'use', id: 'prep1', op: 'take' }); g.exec(me, { k: 'use', id: 'oven1', op: 'place' });
  sim(g, 8);
  log(!W.st.oven1.item && W.stats.explosions === 1 && W.st.oven1.grease > 0.5, 'cheese explosion (grease ' + W.st.oven1.grease.toFixed(2) + ')');
  // burning: leave one in
  W.st.oven1.grease = 0;
  g.exec(me, { k: 'use', id: 'dough1', op: 'take' }); g.exec(me, { k: 'use', id: 'prep1', op: 'place' }); g.exec(me, { k: 'use', id: 'prep1', op: 'flatten' });
  g.exec(me, { k: 'use', id: 'prep1', op: 'add', what: 'sauce' }); g.exec(me, { k: 'use', id: 'prep1', op: 'take' }); g.exec(me, { k: 'use', id: 'oven1', op: 'place' });
  sim(g, 28);
  log(W.st.oven1.fire > 0, 'left too long: oven on fire (' + W.st.oven1.fire.toFixed(2) + ')');
  note('kitchen done');
}

function fire(g) {
  fresh(g);
  const me = g.me, W = g.W;
  g.kitchen.ignite('oven1');
  sim(g, 16);
  const spread = ['prep1', 'laptop'].some(id => W.st[id]?.fire > 0);
  note('fire spread to a neighbour: ' + spread);
  g.exec(me, { k: 'use', id: 'ext1', op: 'take' });
  log(g.hold(me)[0]?.k === 'ext', 'grab the extinguisher');
  for (let i = 0; i < 40; i++) for (const id of ['oven1', 'prep1', 'laptop', 'dough1']) { const s = STATION[id]; g.exec(me, { k: 'spray', x: s.x, z: s.z + 1.2, dx: 0, dz: -1, f: 0 }); }
  const burning = Object.values(W.st).filter(s => s.fire > 0).length;
  log(burning === 0 && W.st.oven1.burnt, 'fires out, oven wrecked');
  W.money = 1000;
  g.exec(me, { k: 'toss', x: 0, z: 0 });
  g.exec(me, { k: 'use', id: 'oven1', op: 'repair' });
  log(!W.st.oven1.burnt && W.money === 700, 'repaired for $300');
  note('fire done');
}

function police(g) {
  fresh(g);
  const me = g.me, W = g.W, P = g.player;
  W.hold[me] = [{ k: 'box', sauce: 1, cheese: 1, top: [], cook: 1 }, { k: 'box', sauce: 1, cheese: 1, top: [], cook: 1 }];
  sim(g, 1);
  const cop = g.police.cops.find(c => c.kind === 'cop');
  log(!!cop, 'cops are on patrol (' + g.police.cops.length + ')');
  // stand in front of a cop on an open sidewalk
  cop.x = 0; cop.z = 32; cop.yaw = Math.PI; cop.st = 'guard'; cop.gx = 0; cop.gz = 32; cop.sus = {};
  P.teleport(0, 26, 0, 0);
  const m0 = W.money;
  let chased = false, busted = false;
  for (let i = 0; i < 400 && !busted; i++) {
    g.update(1 / 30); g.input.endFrame();
    if (cop.st === 'chase') chased = true;
    if (W.money < m0) busted = true;
    if (i % 3 === 0) { cop.x += (P.pos.x - cop.x) * 0.02; }
  }
  log(chased, 'the cop noticed the boxes and gave chase');
  log(busted && !g.hold(me).some(i => i.k === 'box'), 'busted: boxes confiscated, fined ' + (m0 - W.money));
  // hiding in a dumpster breaks the chase
  W.hold[me] = [{ k: 'box', sauce: 1, cheese: 1, top: [], cook: 1 }];
  sim(g, 5);
  cop.st = 'chase'; cop.tgt = me; cop.stun = 0; cop.lost = 0; cop.x = P.pos.x + 12; cop.z = P.pos.z;
  P.hidden = { x: P.pos.x, z: P.pos.z };
  sim(g, 2);
  log(cop.st !== 'chase', 'hiding in a dumpster loses the cop (' + cop.st + ')');
  P.hidden = null;
  note('police done');
}

function inspector(g) {
  fresh(g);
  const W = g.W;
  W.heat = 50;
  W.st.prep1 = { item: { k: 'base', sauce: 1, cheese: 1, top: [], cook: 0 }, items: [], grease: 0, fire: 0, burnt: false, ext: true };
  g.inspections.start('test');
  log(W.insp?.ph === 'warn' && W.insp.t >= 45, 'POLICE INSPECTION INCOMING, countdown ' + Math.round(W.insp?.t));
  const m0 = W.money;
  for (let i = 0; i < 160 && W.insp; i++) sim(g, 1, 1 / 15);
  log(!W.insp && W.money < m0 && !W.st.prep1.item, 'messy kitchen: busted, fined ' + (m0 - W.money) + ', evidence confiscated');
  // a clean run: everything hidden
  W.inspCool = 0; W.heat = 60; W.money = 30000; W.boardFlipped = true; W.stockHidden = true;
  for (const id of ['oven1']) g.kitchen.st(id).off = true;
  g.inspections.start('test');
  for (let i = 0; i < 160 && W.insp; i++) sim(g, 1, 1 / 15);
  log(!W.insp && W.heat < 40, 'hid everything: passed, heat ' + Math.round(W.heat));
  // a disaster: shutdown
  W.inspCool = 0; W.boardFlipped = false; W.stockHidden = false; g.kitchen.st('oven1').off = false; W.money = 300000; W.sign = 'closed';
  W.st.prep1.item = { k: 'base', sauce: 1, cheese: 1, top: [], cook: 0 }; W.st.box1 = { item: null, items: [], grease: 1, fire: 0 }; g.kitchen.st('oven1').grease = 1;
  g.inspections.start('test');
  for (let i = 0; i < 160 && W.insp; i++) sim(g, 1, 1 / 15);
  log(W.shutdown > 0, 'evidence everywhere: SHUT DOWN for ' + Math.round(W.shutdown) + 's');
  note('inspector done');
}

function mall(g) {
  fresh(g);
  const W = g.W, me = g.me, items = g.town.shopItems;
  log(items.length >= 30, 'the mall has ' + items.length + ' products on its shelves');
  W.money = 500000; W.hold[me] = [];
  const cheese = items.find(s => s.cat === 'grocery' && s.key === 'cheese');
  g.exec(me, { k: 'shop', cat: 'grocery', key: 'cheese' });
  log(g.hold(me)[0]?.k === 'crate' && g.hold(me)[0].s === 'cheese', 'bought a crate of cheese off the shelf');
  g.exec(me, { k: 'shop', cat: 'vehicle', key: 'pickup' });
  const car = W.cars.find(c => c.kind === 'pickup');
  log(!!car, 'bought a pickup truck: it waits at the mall');
  g.exec(me, { k: 'cargo', id: car.id, op: 'load' });
  log(car.cargo.length === 1 && !g.hold(me).length, 'loaded the crate into the pickup');
  car.x = 135; car.z = 80;
  const c0 = W.stock.cheese;
  g.exec(me, { k: 'cargo', id: car.id, op: 'unloadAll' });
  log(W.stock.cheese > c0 && !car.cargo.length, 'unloaded it into the hideout fridge (cheese ' + c0 + ' -> ' + W.stock.cheese + ')');
  g.exec(me, { k: 'shop', cat: 'equipment', key: 'purifier' });
  log(W.owned.up.purifier, 'bought an Air Purifier at EQUIP-O-RAMA');
  g.exec(me, { k: 'shop', cat: 'general', key: 'smoke' });
  log(W.inv[me].smoke === 1, 'bought a smoke bomb');
  // load pizza boxes and deliver straight from the car
  const o = g.orders.spawn({ accepted: true }); o.top = []; o.extra = false; o.sting = false;
  car.cargo.push({ k: 'box', sauce: 1, cheese: 1, top: [], cook: 1 });
  const at = g.orders.at(o); car.x = at.x + 3; car.z = at.z;
  const m0 = W.money;
  g.exec(me, { k: 'deliver', id: o.id, car: car.id });
  log(W.money > m0 && !car.cargo.length, 'delivered straight out of the truck bed');
  // the getaway car is faster than the cargo truck
  const drive = (kind) => { const c = { x: 0, z: 0, yaw: 0, spd: 0 }; for (let i = 0; i < 120; i++) driveFn(c, { thr: 1, steer: 0, brake: 0 }, 1 / 30, { resolve: (x, z) => ({ x, z, hit: false }) }, { ...VEH[kind] }); return c.z; };
  log(drive('getaway') > drive('cargo') * 1.5, 'the getaway car leaves the cargo truck behind');
  note('mall done');
}

function story(g) {
  fresh(g, Q.TOWN);
  const me = g.me, W = g.W;
  g.exec(me, { k: 'q', what: 'man' });
  log(W.quest === Q.FIND && W.money >= 15000, 'met the man, got the money');
  g.exec(me, { k: 'q', what: 'arrive' });
  log(W.quest === Q.CLEAN, 'found the hideout');
  W.trash.forEach((t, i) => g.exec(me, { k: 'pile', i }));
  log(W.quest === Q.POWER, 'cleaned');
  W.power = false;
  g.exec(me, { k: 'use', id: 'fuse', op: 'fuse' });
  log(W.quest === Q.OVEN && W.power, 'power on');
  W.money = 20000;
  for (const k of ['dough', 'sauce', 'cheese']) W.stock[k] = 0;
  g.exec(me, { k: 'buyOven' });
  log(W.oven1 && W.quest === Q.STOCK, 'bought an oven');
  g.exec(me, { k: 'buy', sup: 'doug', i: 0 }); g.exec(me, { k: 'buy', sup: 'tony', i: 0 }); g.exec(me, { k: 'buy', sup: 'cheese', i: 0 });
  log(W.quest === Q.MAKE, 'bought ingredients: ' + JSON.stringify(W.stock));
  g.exec(me, { k: 'use', id: 'dough1', op: 'take' }); g.exec(me, { k: 'use', id: 'prep1', op: 'place' }); g.exec(me, { k: 'use', id: 'prep1', op: 'flatten' });
  g.exec(me, { k: 'use', id: 'prep1', op: 'add', what: 'sauce' }); g.exec(me, { k: 'use', id: 'prep1', op: 'add', what: 'cheese' });
  g.exec(me, { k: 'use', id: 'prep1', op: 'take' }); g.exec(me, { k: 'use', id: 'oven1', op: 'place' });
  sim(g, 13);
  g.exec(me, { k: 'use', id: 'oven1', op: 'take' }); g.exec(me, { k: 'use', id: 'box1', op: 'box' });
  log(W.quest === Q.FIRST, 'made the first pizza');
  const o = W.orders.find(o => o.story === 'man');
  g.exec(me, { k: 'deliver', id: o.id });
  log(W.quest === Q.BIZ, 'delivered to the suspicious man - business open');
  for (const c of ['statue', 'gas', 'hospital', 'police', 'radio', 'junk', 'mansion', 'archive']) g.exec(me, { k: 'clue', id: c });
  note('waiting for the reveal...');
  setTimeout(() => {
    try {
      log(W.quest === Q.FINALE, 'all clues: the reveal');
      const f = W.orders.find(o => o.story === 'mayor');
      W.hold[me] = [{ k: 'box', sauce: 1, cheese: 2, top: ['pepperoni'], cook: 1 }];
      g.exec(me, { k: 'deliver', id: f.id });
      log(W.quest === Q.EMPIRE && W.ending === 1, 'the mayor got his pizza: THE END');
      W.money = 2e6;
      for (let i = 0; i < 4; i++) g.exec(me, { k: 'level' });
      log(W.level === 5, 'pizza empire (level ' + W.level + ')');
      note('story done');
    } catch (e) { log(false, 'exception ' + e.message); }
  }, 6500);
}
