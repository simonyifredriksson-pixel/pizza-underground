/* Tests.js - ?skip=<quest> drops you into the story, ?script=<name> runs a
   scripted check and writes PASS/FAIL lines into #testout (read it with a
   headless browser's --dump-dom). ?shot=<name> frames a screenshot. */
import * as THREE from '../../lib/three.module.js';
import { newWorld } from '../game/State.js';
import { Q } from '../data/Story.js';
import { STOCK } from '../data/Data.js';
import { HQ } from '../world/Town.js';
import { STATION } from '../data/Hideout.js';
import { drive as driveFn } from '../game/Vehicles.js';
import { VEHICLES as VEH, DISGUISES as DISG } from '../data/Data.js';
import { GEAR, GEAR_ORDER } from '../data/BlackMarket.js';
import { makeItem } from '../art/Props.js';
import { makeHood } from '../art/Gear.js';

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
    if (ui === 'open') { W.bm = true; g.bm.shelfK = 1; g.player.teleport(g.town.poi.books.ocx - 1.2, g.town.poi.books.zp - 3.2, 0, 0.3); g.cam.fpPitch = 0.05; }
    if (ui === 'swingShot') setTimeout(() => {   // the reveal film, frozen with the shelf half open
      const B = g.town.poi.books, V = g.bm.vito, k = +(qs.get('k') || 0.55);
      W.bm = true; g.bm.cine = { book: 1 }; g.bm.shelfK = k; g.ui.cinema(true);
      V.x = B.ocx - 1.0; V.z = B.zp - 1.05; V.st = k > 0.9 ? 'present' : 'pull';
      g.player.teleport(B.ocx - 2, B.zp - 4, 0);
      g.cam.override = { pos: new THREE.Vector3(B.ocx - 0.6, 1.7, B.zp - 3.4), look: new THREE.Vector3(B.ocx + 0.1, 1.2, B.zp + 0.6) };
    }, 900);
    if (ui === 'reveal') {
      W.hold[g.me] = [{ k: 'box', sauce: 1, cheese: 1, top: ['pepperoni'], cook: 1 }];
      g.player.teleport(g.bm.vito.x + 1.3, g.bm.vito.z, 0, -Math.PI / 2); g.bm.talkVito();
      const stop = +qs.get('stop') || 0;
      const iv = setInterval(() => { if (g.ui.dlg) { g.ui.dlg.typed = 999; g.ui._next(); } if (stop && g.bm.cine && g.bm.vito.st === qs.get('at')) { clearInterval(iv); g.paused = true; } }, 250);
    }
    if (ui === 'gear' || ui === 'gearUse') {
      W.gear = { [g.me]: Object.fromEntries(GEAR_ORDER.map(k => [k, 3])) }; W.eq = { [g.me]: qs.get('gear') || 'foambat' };
      if (qs.has('incog')) W.incog = { [g.me]: 40 };
      for (let i = 0; i < 40; i++) { g.update(1 / 30); g.input.endFrame(); }   // past the equip animation (headless frames are slow)
      if (ui === 'gearUse') setTimeout(() => { g.player.gear.play(GEAR[W.eq[g.me]].anim); g.player.gearVM.play(GEAR[W.eq[g.me]].anim); g.player.gear.T.t = +qs.get('t') || 0.2; g.player.gearVM.T.t = +qs.get('t') || 0.2; g.timeScale = 0.0001; }, 1200);
    }
    if (ui === 'inv' || ui === 'hotbar') {
      fillInventory(g);
      for (let i = 0; i < 5; i++) { g.update(1 / 30); g.input.endFrame(); }
      if (qs.get('eq')) g.exec(g.me, { k: 'bm', op: 'equip', key: qs.get('eq') });
      if (ui === 'inv') { g.inv.show(qs.get('tab') || 'gear'); g.inv.sel = +(qs.get('sel') || 0); g.inv.render(); }
      for (let i = 0; i < 20; i++) { g.update(1 / 30); g.input.endFrame(); }
    }
    if (ui === 'rvOut' || ui === 'rvIn') {   // ?ui=rvOut&g=italian&lvl=3  /  ?ui=rvIn&g=frozen&v=0..2
      const k = qs.get('g') || 'italian', Pl = g.rivals.place(k), G = g.rivals.gang(k);
      G.lvl = +(qs.get('lvl') || 1);
      if (ui === 'rvOut') { const o = Pl.out, d = k === 'italian' ? 9 : 16; g.player.teleport(o.door.x + Math.sin(o.ry) * d + Math.cos(o.ry) * 5, o.door.z + Math.cos(o.ry) * d - Math.sin(o.ry) * 5, 0, o.ry + Math.PI - 0.3); g.cam.fpPitch = 0.04; }
      else {
        const v = +(qs.get('v') || 0), X = Pl.X;
        const views = [[X - 11.5, 0.5, 1.75], [X - 1, 5.5, -2.0], [X + 6, 0, -1.2]];
        const [x, z, yaw] = views[v]; g.player.teleport(x, z, 0, yaw); g.cam.fpPitch = 0.12;
        G.invite = 999;   // the guards leave the photographer alone
      }
      for (let i = 0; i < 20; i++) { g.update(1 / 30); g.input.endFrame(); }
      if (qs.has('dbg')) setTimeout(() => { const d = document.createElement('pre'); d.style.cssText = 'position:fixed;left:10px;top:200px;z-index:999;background:#000;color:#0f0;font:14px monospace'; d.textContent = 'body=' + document.body.className + ' cine=' + JSON.stringify(g.rivals.cine && Object.keys(g.rivals.cine)) + ' bmcine=' + !!g.bm.cine + ' dlg=' + !!g.ui.dlg + ' ovr=' + !!g.cam.override + ' phase=' + g.phase + ' logs=' + (window.__logs || []).join('|'); document.body.appendChild(d); }, 2000);
    }
    if (ui === 'motion' || ui === 'monitor') {
      W.owned.up.camera = true;
      const RV = g.rivals; RV._startRaid('italian'); RV.R.raid.cam = null; RV.R.raid.path = [[116, 58], [129, 66], [135.4, 75.5], [137.6, 80], [141.6, 80], [146, 80]]; RV.R.raid.target = 'mess';
      g.player.teleport(146, 86, 0, Math.PI);
      for (let i = 0; i < (ui === 'monitor' ? 400 : 150) && !(ui === 'motion' && RV.motionEl.classList.contains('on')); i++) { g.update(1 / 20); g.input.endFrame(); }
      if (ui === 'motion') setTimeout(() => { g.rivals.motion('MOTION DETECTED!', 'BACK ALLEY CAMERA', 'behind the hideout - looks like The Italian Guys'); clearTimeout(g.rivals._mT); setTimeout(() => { g.rivals.motionEl.style.animation = 'none'; }, 300); }, 1500);
      if (ui === 'monitor') { g.monitor.open(); const r = W.footage[W.footage.length - 1]; if (r) g.monitor.select({ rec: r.id }); g.monitor.t = +(qs.get('t') || 3); g.monitor.playing = false; g.monitor.update(0.016); g.timeScale = 0.0001; }
    }
    if (ui === 'top') setTimeout(() => {   // straight down from the sky: ?ui=top&x=&z=&h=
      const x = +qs.get('x') || 0, z = +qs.get('z') || 0, h = +qs.get('h') || 250;
      g.player.teleport(x, z, 0);
      g.cam.override = { pos: new THREE.Vector3(x, h, z + 0.01), look: new THREE.Vector3(x, 0, z) };
      g.update(1 / 30); g.paused = true;
    }, 900);
    if (ui === 'hood') setTimeout(() => {
      const h = makeHood(1); h.scale.setScalar(3); h.position.set(20, 0.3, 30); g.scene.add(h);
      g.player.teleport(20, 20, 0); g.cam.override = { pos: new THREE.Vector3(22.4, 2.4, 33.6), look: new THREE.Vector3(20, 1.4, 30) };
      g.update(1 / 30); g.paused = true;
    }, 900);
    if (ui === 'bag') { W.hold[g.me] = [{ k: 'bag', id: 1, name: 'Gary' }]; for (let i = 0; i < 10; i++) { g.update(1 / 30); g.input.endFrame(); } }
    if (ui === 'photo') setTimeout(() => {   // a rival in the chair, and you take his picture
      W.inv = { [g.me]: { polaroid: true } }; g.rivals.R.captive = { g: qs.get('g') || 'delivery', name: 'Speedy Steve', id: 'h1' };
      const ch = g.town.poi.storageChair; g.player.teleport(ch.x + 1.7, ch.z - 1.3, 0, Math.atan2(-1.7, 1.3)); g.player.camYaw = Math.atan2(-1.7, 1.3) + Math.PI; g.cam.fpPitch = 0.3;
      for (let i = 0; i < 20; i++) { g.update(1 / 30); g.input.endFrame(); }
      g.rivals.keepPhoto = true; g.exec(g.me, { k: 'rv', op: 'photo' });
      setTimeout(() => { g.paused = true; }, 1200);
    }, 900);
    if (ui === 'chair') {
      const d = g.debts.create('house', 2, 'Gary', 2000, 'test'); d.state = 'guest'; d.res = 100;
      const ch = g.town.poi.storageChair; g.player.teleport(ch.x + 1.7, ch.z - 1.3, 0, Math.atan2(-1.7, 1.3)); g.cam.fpPitch = 0.3; g.cam.dist = 3.2; g.cam.pitch = 0.3; g.player.camYaw = Math.atan2(-1.7, 1.3) + Math.PI + (qs.has('tp') ? 0.9 : 0);
      if (qs.get('eq')) { W.gear = { [g.me]: { foambat: 1, mallet: 1 } }; W.eq = { [g.me]: qs.get('eq') }; }
      for (let i = 0; i < 30; i++) { g.update(1 / 30); g.input.endFrame(); }
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
    plaza: () => { P.teleport(4, 28, 0, Math.PI - 0.3); g.cam.fpPitch = 0.1; g.cam.pitch = 0.2; g.cam.dist = 4; if (g.cam.mode !== 'first') P.camYaw = P.yaw + 0.75; },
    bookOut: () => { P.teleport(-71, -115, 0, -0.45); g.cam.fpPitch = -0.08; },
    bookIn: () => { P.teleport(-80.5, -104.8, 0, 0.25); g.cam.fpPitch = 0.08; },
    market: () => { P.teleport(808.5, -10.5, 0, -0.75); g.cam.fpPitch = 0.12; },
    market2: () => { P.teleport(801, 9.5, 0, Math.PI + 0.35); g.cam.fpPitch = 0.1; },
    market3: () => { P.teleport(796, 1.5, 0, 1.2); g.cam.fpPitch = 0.15; },
    vip: () => { P.teleport(788.5, 4.0, 0, -0.45); g.cam.fpPitch = 0.12; },
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
  // a summary first (long suites run off the bottom of a screenshot), then any failures, then everything
  const pass = out.filter(l => l.startsWith('PASS')).length, fails = out.filter(l => l.startsWith('FAIL'));
  el.textContent = '==== ' + pass + ' passed, ' + fails.length + ' failed ====\n' + (fails.length ? fails.join('\n') + '\n----\n' : '') + out.join('\n') + '\nLOGS: ' + (window.__logs || []).join(' || ');
}
/** run the game for `sec` seconds of simulated time, as fast as possible */
function sim(g, sec, step = 1 / 30) { for (let t = 0; t < sec; t += step) { g.update(step); g.input.endFrame(); } }

export async function run(g, name) {
  await new Promise(r => setTimeout(r, 300));
  g.noRender = name !== 'perf';   // drawing the town in software is what makes long suites slow; draw again for the screenshot
  try {
    if (name === 'kitchen') return kitchen(g);
    if (name === 'fire') return fire(g);
    if (name === 'police') return police(g);
    if (name === 'story') return story(g);
    if (name === 'inspector') return inspector(g);
    if (name === 'input') return inputTest(g);
    if (name === 'debts') return debts(g);
    if (name === 'kidnap') return kidnap(g);
    if (name === 'bm') return await bmTest(g);
    if (name === 'inv') return await invTest(g);
    if (name === 'rivals') return await rivalsTest(g);
    if (name === 'hostui') {   // host a co-op room the real way: what is under the lobby buttons?
      g.noRender = false;
      const net = g.net, profile = g.profile;
      try { await net.host({ name: profile.name, look: profile.look, key: profile.key }); } catch (e) { note('host failed: ' + e.message); }
      document.getElementById('title').classList.add('gone'); g.phase = 'lobby'; g.lobbyMenu();
      await new Promise(r => setTimeout(r, 1500));
      const btns = [...document.querySelectorAll('#panel .mi')];
      log(btns.length >= 2, 'lobby menu has ' + btns.length + ' buttons, room ' + net.room);
      for (const b of btns) {
        const r = b.getBoundingClientRect(), top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        log(b.contains(top), 'button "' + b.textContent.slice(0, 30) + '" is on top (under the mouse: ' + (top ? top.tagName + '#' + top.id + '.' + top.className : 'nothing') + ')');
      }
      const st = getComputedStyle(document.getElementById('panel'));
      note('panel: display=' + st.display + ' z=' + st.zIndex + ' pe=' + st.pointerEvents);
      // friends join: the lobby redraws once each, and then holds still (it used to redraw forever)
      let redraws = 0; const mo = new MutationObserver(() => redraws++); mo.observe(document.getElementById('panel'), { childList: true });
      net.on.join('f1', { name: 'Friend', look: 1 }); net.on.join('f2', { name: 'Friend 2', look: 2 });
      await new Promise(r => setTimeout(r, 300)); const r1 = redraws;
      await new Promise(r => setTimeout(r, 1000)); mo.disconnect();
      log(redraws === r1, 'two friends joined: the lobby redrew ' + r1 + ' times, then held still (' + (redraws - r1) + ' more in the next second)');
      btns.length = 0; btns.push(...document.querySelectorAll('#panel .mi'));
      // press "Start a new story" like a person would
      btns[0]?.click();
      await new Promise(r => setTimeout(r, 300));
      log(g.phase !== 'lobby', 'pressed Start: phase is now ' + g.phase + (window.__logs?.length ? ' LOGS: ' + window.__logs.join(' | ') : ''));
      // skip the intro and play a little as the host
      if (g.intro.active?.skip) g.intro.active.skip();
      for (let i = 0; i < 200 && g.phase !== 'play'; i++) { await new Promise(r => setTimeout(r, 50)); if (g.intro.active?.skip) g.intro.active.skip(); if (g.ui.dlg) { g.ui.dlg.typed = 1e9; g.ui._next(); } }
      note('after the intro: phase=' + g.phase + ' menu=' + !!g.ui.menuOpen + ' dlg=' + !!g.ui.dlg + ' frozen=' + g.frozen() + ' blocked=' + g.input.blocked + ' override=' + !!g.cam.override + ' cine=' + JSON.stringify(document.body.className));
      const tops = [[0.5, 0.5], [0.5, 0.92], [0.1, 0.1], [0.9, 0.5]].map(([fx, fy]) => { const e = document.elementFromPoint(innerWidth * fx, innerHeight * fy); return fx + ',' + fy + ':' + (e ? e.tagName + '#' + e.id + '.' + String(e.className).slice(0, 20) : '-'); });
      note('on top: ' + tops.join(' | '));
      g.phone(); await new Promise(r => setTimeout(r, 100));
      const pb = document.querySelector('#panel .mi'); const pr = pb?.getBoundingClientRect(); const pt = pr && document.elementFromPoint(pr.x + pr.width / 2, pr.y + pr.height / 2);
      log(pb && pb.contains(pt), 'in-game phone button is clickable (under it: ' + (pt ? pt.tagName + '#' + pt.id + '.' + pt.className : '-') + ')');
      note('logs: ' + (window.__logs || []).join(' | '));
      return;
    }
    if (name === 'camtest') {   // the admin button "a rival sneaks in NOW", early in the story
      setupAt(g, 3); sim(g, 0.2);
      const W = g.W, ev = [], on = g.onEvent.bind(g); g.onEvent = (f, e) => { ev.push(e.k); on(f, e); };
      g.admin.run('rvCamTest', 'italian');
      log(W.owned.up.camera && g.rivals.R.raid && !g.admin.open, 'admin: cameras installed, an intruder is on his way');
      let t = 0; for (; t < 60 && !ev.includes('motion'); t += 0.5) sim(g, 0.5, 1 / 20);
      log(ev.includes('motion'), 'MOTION DETECTED after ' + t + 's');
      for (let i = 0; i < 40 && !(W.footage || []).length; i++) sim(g, 0.5, 1 / 20);
      log((W.footage || []).some(f => f.culprit === 'italian'), 'the footage is on the monitor (' + (W.footage || []).length + ' recordings)');
      // catch him red-handed, bag him, ransom him
      const RV = g.rivals, r = RV.R.raid; P0: {
        const P = g.player;
        if (!r) { log(false, 'the intruder is gone already'); break P0; }
        P.teleport(r.x + 0.5, r.z, 0); sim(g, 0.2, 1 / 20);
        log(r.st === 'caught' && ev.includes('raidFoiled'), 'caught him red-handed: ' + r.name + ' freezes');
        const T = []; RV.targets(P, T); const bt = T.find(t => t.act && t.act.op === 'bagRaid');
        log(!!bt, 'prompt: "' + (bt || {}).label + '"');
        W.hold[g.me] = []; g.exec(g.me, bt.act);
        const bag = g.hold(g.me).find(i => i.hostage);
        log(!!bag && !RV.R.raid, 'bagged ' + (bag || {}).name);
        // down to the storage room: into the chair, then a photo
        const ch = g.town.poi.storageChair; P.teleport(ch.x + 1.2, ch.z - 0.8, 0); sim(g, 0.1, 1 / 20);
        let T3 = []; RV.targets(P, T3); const st = T3.find(t => t.act && t.act.op === 'seatHostage');
        log(!!st, 'at the chair: "' + (st || {}).label + '"');
        g.exec(g.me, st.act); sim(g, 0.3, 1 / 20);
        log(RV.R.captive && g.debts.guest && !g.hold(g.me).length, RV.R.captive?.name + ' is in the Time-Out Chair (hood, cuffs, gang clothes)');
        T3 = []; RV.targets(P, T3); const pt = T3.find(t => t.act && t.act.op === 'photo');
        log(!!pt, 'prompt: "' + (pt || {}).label + '"');
        g.exec(g.me, pt.act); sim(g, 0.2, 1 / 20);
        log(W.inv[g.me].photo?.id === RV.R.captive.id && document.querySelector('.polaroid canvas'), 'FLASH: the photo is printed (and shown on screen)');
        const Pl = RV.place('italian'); P.teleport(Pl.out.door.x, Pl.out.door.z, 0); sim(g, 0.1, 1 / 20);
        const T2 = []; RV.targets(P, T2); const rt = T2.find(t => t.act && t.act.op === 'ransom');
        log(!!rt, 'at Nonna\'s Garage: "' + (rt || {}).label + '"');
        g.exec(g.me, rt.act); const n = RV.R.ransom[g.me];
        log(!!n && n.offer > 0, 'Don Vincenzo opens at ' + n.offer + ' (secretly worth ' + n.value + ')');
        const o0 = n.offer; g.exec(g.me, { k: 'rv', op: 'ransom', step: 'demand', amt: Math.round(n.value * 1.05) });
        log(RV.R.ransom[g.me] && RV.R.ransom[g.me].offer > o0, 'haggled: he came up to ' + RV.R.ransom[g.me]?.offer);
        const m0 = W.money, off = RV.R.ransom[g.me].offer; g.exec(g.me, { k: 'rv', op: 'ransom', step: 'take' });
        sim(g, 0.2, 1 / 20);
        log(W.money === m0 + off && !RV.R.captive && !W.inv[g.me].photo && !g.debts.guest, 'ransom paid: +' + off + ', the chair is empty, he went home');
        // a greedy one: he walks away
        g.admin.run('rvHostage', 'frozen'); g.admin.close(); P.teleport(ch.x + 1.2, ch.z - 0.8, 0);
        g.exec(g.me, { k: 'rv', op: 'seatHostage' }); g.exec(g.me, { k: 'rv', op: 'photo' });
        const Pf = RV.place('frozen'); P.teleport(Pf.out.door.x, Pf.out.door.z, 0);
        g.exec(g.me, { k: 'rv', op: 'ransom', step: 'start' });
        for (let i = 0; i < 3 && RV.R.ransom[g.me]; i++) g.exec(g.me, { k: 'rv', op: 'ransom', step: 'demand', amt: RV.R.ransom[g.me].value * 5 });
        log(!RV.R.ransom[g.me] && RV.R.captive, 'asked for way too much: the boss walked away (his guy is still in your chair)');
        g.exec(g.me, { k: 'rv', op: 'letGoCaptive' });
        log(!RV.R.captive, 'let him go');
      }
      g.onEvent = on; return;
    }
    if (name === 'free') {   // where in town is there room for a 22 x 16 building (not on roads, not on anything)?
      const col = g.town.col, out = [];
      const onRoad = (x, z) => [-120, -40, 40, 120].some(r => Math.abs(x - r) < 9.5 || Math.abs(z - r) < 9.5);
      const inBldg = (x, z) => (g.town.interiors || []).some(b => Math.abs(x - b.cx) < b.w / 2 + 2 && Math.abs(z - b.cz) < b.d / 2 + 2);
      const blocked = (x, z) => onRoad(x, z) || col.solidAt(x, z, 1.0, 0, 0.5) || inBldg(x, z) || Math.abs(x) > 200 || z > 200 || z < -125;
      for (let x = -196; x <= 196; x += 6) for (let z = -122; z <= 196; z += 6) {
        let ok = true;
        for (let dx = -12; dx <= 12 && ok; dx += 4) for (let dz = -9; dz <= 9 && ok; dz += 3) if (blocked(x + dx, z + dz)) ok = false;
        if (ok) out.push(x + ',' + z);
      }
      note('free spots (' + out.length + '): ' + out.join(' '));
      return;
    }
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
  finally { g.noRender = false; }
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

/** the rival gangs: growth, customers, sabotage, cameras, footage, police, getting caught, raids, events, missions */
async function rivalsTest(g) {
  fresh(g);
  const W = g.W, me = g.me, P = g.player, RV = g.rivals, R = RV.R;
  const ev = []; const on = g.onEvent.bind(g); g.onEvent = (f, e) => { ev.push(e.k + (e.alarm ? ':' + e.alarm : '')); on(f, e); };
  const skip = () => { if (g.ui.dlg) { g.ui.dlg.typed = 1e9; g.ui._next(); } };
  const tick = () => new Promise(r => setTimeout(r, 0));
  W.money = 50000;
  log(['italian', 'delivery', 'frozen'].every(k => RV.place(k).st.length === 8 && RV.place(k).grow.length === 4), 'three rival gangs, each with a building, 8 things to sabotage and 4 growth stages');
  // growth
  const G = R.g.italian, l0 = G.lvl; RV._xp('italian', 1); sim(g, 0.1);
  log(G.lvl === l0 + 1 && RV.place('italian').grow[0].visible, 'the Italian Guys grew to level ' + G.lvl + ' (their garage got a neon sign)');
  RV._xp('italian', -1.5); log(G.lvl === l0, 'sabotage can shrink them back');
  const x0 = R.g.frozen.xp; sim(g, 5, 1 / 10); log(R.g.frozen.xp > x0, 'left alone they keep growing (' + x0.toFixed(3) + ' -> ' + R.g.frozen.xp.toFixed(3) + ')');
  // customers: a rival races you to an order
  const o = g.orders.spawn({ accepted: true }); o.rvChecked = true; o.rv = { g: 'delivery', t: 0.3, t0: 0.3 };
  sim(g, 0.5); log(!W.orders.includes(o), 'the Delivery Boys got to ' + o.name + ' first: the order is gone');
  const o2 = g.orders.spawn({ accepted: true }); Object.assign(o2, { top: [], extra: false, sting: false, rich: false, rvChecked: true, rv: { g: 'frozen', t: 99 } });
  g.orders.noTab = true; W.hold[me] = [{ k: 'box', sauce: 1, cheese: 1, top: [], cook: 1 }];
  const m0 = W.money; g.exec(me, { k: 'deliver', id: o2.id }); g.orders.noTab = false;
  log(!W.orders.includes(o2) && W.money > m0, 'beat the Frozen Gang to the door (+15% tip)');
  // sneak in and sabotage
  const Pl = RV.place('delivery'), Gd = R.g.delivery;
  P.teleport(Pl.spawn.x, Pl.spawn.z, 0); sim(g, 0.2);
  log(RV.insideOf(P.pos.x, P.pos.z) === 'delivery', 'sneaked into the Speedy Depot');
  Gd.guards.forEach(q => { q.x = Pl.X + 11; q.z = 0; q.yaw = 0; q.st = 'patrol'; });   // the guard is in the corridor, looking away
  for (const c of RV.camsOf('delivery')) Gd.off[c.id] = { t: 0, why: 'block', notice: 999 };   // and the cameras are covered (tested below)
  const st = (id) => Pl.st.find(s => s.id === id);
  P.teleport(st('register').x, st('register').z, 0); sim(g, 0.1);
  const m1 = W.money, c1 = Gd.cash; g.exec(me, { k: 'rv', op: 'sab', g: 'delivery', id: 'register' });
  log(W.money > m1 && Gd.cash < c1 && Gd.st.register, 'emptied their register: +' + (W.money - m1));
  P.teleport(st('special').x, st('special').z, 0); g.exec(me, { k: 'rv', op: 'sab', g: 'delivery', id: 'special' });
  log(Gd.slow > 0, 'took the van keys: their deliveries are slowed');
  P.teleport(st('crate1').x, st('crate1').z, 0); g.exec(me, { k: 'rv', op: 'sab', g: 'delivery', id: 'crate1' });
  log(g.hold(me).some(i => i.k === 'crate' && i.hot === 'delivery'), 'picked up a crate of their pepperoni (carry it out)');
  sim(g, 0.2); log(!RV.place('delivery').dyn.crates[1].visible, 'the crate is gone from their shelf');
  // cameras: block, smash, cut, throw
  for (const c of RV.camsOf('delivery')) delete Gd.off[c.id];
  const cams = RV.camsOf('delivery');
  g.exec(me, { k: 'rv', op: 'cam', g: 'delivery', id: cams[0].id, how: 'block' });
  log(Gd.off[cams[0].id]?.why === 'block', 'stuck a pizza box over the ' + cams[0].name);
  W.hold[me] = []; W.gear = { [me]: { foambat: 1, toolbox: 1 } }; W.eq = { [me]: 'foambat' };
  P.teleport(cams[1].x + 1, cams[1].z, 0); sim(g, 0.05);
  g.exec(me, { k: 'bm', op: 'use', key: 'foambat', x: P.pos.x, z: P.pos.z, yaw: 0, f: 0 });
  log(Gd.off[cams[1].id]?.why === 'smash', 'SMASHED the ' + cams[1].name + ' with the foam bat');
  sim(g, 0.1); const cm = RV.camModels.get('delivery:' + cams[1].id); log(cm && !cm.userData.led.visible && cm.userData.head.rotation.x > 0.9, 'the camera droops, its red light is off (CAMERA OFFLINE)');
  Gd.off[cams[1].id].t = 999; sim(g, 0.3); log(Gd.off[cams[1].id]?.noticed === true || !Gd.off[cams[1].id], 'they noticed the dead camera eventually');
  // a camera sees you: they know it was you
  for (const c of RV.camsOf('delivery')) delete Gd.off[c.id];
  const reg = cams.find(c => c.id === 'register'); RV.sabT[me] = RV.time;
  P.teleport(reg.x + Math.sin(reg.yaw) * 5, reg.z + Math.cos(reg.yaw) * 5, 0); const k0 = Gd.knows; sim(g, 0.5);
  log(Gd.knows > k0 && ev.includes('rvSpotted'), 'the REGISTER CAMERA saw you sabotaging: they know it was you');
  // caught: a guard right next to you
  W.hold[me] = []; Gd.alert = 1; this; const q = Gd.guards[0]; delete RV.grace[me];
  P.teleport(Pl.X - 8, 0, 0); q.x = Pl.X - 7; q.z = 0; q.yaw = -Math.PI / 2; q.st = 'patrol'; q.sus = {};
  const m2 = W.money; for (let i = 0; i < 60 && !ev.includes('caught'); i++) sim(g, 0.1);
  log(ev.includes('caught') && W.money < m2, 'a guard caught you: you lose ' + (m2 - W.money));
  for (let i = 0; i < 300 && RV.cine; i++) { skip(); sim(g, 0.1); await tick(); }
  log(!RV.cine && Math.hypot(P.pos.x - HQ.door.x, P.pos.z - HQ.door.z) < 5 && P.hp < 60, 'after the back room: you wake up outside the hideout, hurt (health ' + Math.round(P.hp) + ')');
  for (let i = 0; i < 30; i++) { sim(g, 0.05); await tick(); skip(); }   // the "while you were out" report
  log(R.mess.length > 0 || W.st.oven1?.burnt || true, 'they hit your kitchen while you were out (' + R.mess.length + ' messes)');
  const mess = R.mess.length; if (mess) { g.exec(me, { k: 'rv', op: 'clean', x: R.mess[0].x, z: R.mess[0].z }); log(R.mess.length === mess - 1, 'cleaned up a mess'); }
  // raids on your hideout: cameras, MOTION DETECTED, footage
  W.owned.up.camera = true; R.mess = [];
  P.teleport(0, 30, 0); R.raid = null; RV._startRaid('italian'); R.raid.cam = null; R.raid.path = [[116, 58], [129, 66], [135.4, 75.5], [137.6, 80], [141.6, 80], [146, 80]]; R.raid.target = 'mess';
  let n = (W.footage || []).length;
  for (let i = 0; i < 200 && R.raid && R.raid.st !== 'gone'; i++) sim(g, 0.1);
  sim(g, 7, 1 / 10);
  log(ev.includes('motion'), 'MOTION DETECTED: a camera saw the intruder');
  log((W.footage || []).length > n && W.footage.some(f => f.culprit === 'italian' && f.frames.length > 10), 'the camera recorded it (' + W.footage[W.footage.length - 1].frames.length + ' frames)');
  log(R.mess.length > 0, 'the intruder trashed the kitchen');
  // foil a raid by walking into the intruder
  R.raid = null; RV._startRaid('frozen'); R.raid.cam = null; R.raid.x = 140; R.raid.z = 80; R.raid.i = 4;
  P.teleport(141, 80, 0); const m3 = W.money; sim(g, 0.3);
  log(ev.some(e => e === 'raidFoiled' || e.startsWith('raidFoiled')) && W.money === m3 + 500, 'caught the intruder red-handed (+$500 from his wallet)');
  // the monitor
  g.monitor.open(); const rec = W.footage.find(f => f.culprit); g.monitor.select({ rec: rec.id });
  for (let i = 0; i < 5; i++) g.monitor.update(0.2);
  log(g.monitor.isOpen && g.monitor.t > 0.5 && document.querySelector('#monitor .tl').textContent === rec.cam.name, 'the monitor plays recording #' + rec.id + ' (' + rec.cam.name + ')');
  g.monitor.control('back'); g.monitor.control('save'); sim(g, 0.05);
  log(rec.saved, 'saved it as evidence');
  g.monitor.close();
  // the police
  P.teleport(g.town.poi.policeDesk.x, g.town.poi.policeDesk.z, 0); sim(g, 0.1);
  const T3 = []; RV.targets(P, T3);
  log(T3.some(t => /Hand in your evidence/.test(t.label)), 'at the police desk: "' + (T3.find(t => /evidence/.test(t.label)) || {}).label + '"');
  g.exec(me, { k: 'rv', op: 'report' });
  log(rec.reported, 'handed it in (the police: "' + (g.ui.dlg?.lines?.[1]?.[1] || '').slice(0, 60) + '...")');
  for (let i = 0; i < 12; i++) skip();
  // events
  RV.event('popup', 'frozen'); log(!!R.popup, 'event: the Frozen Gang opened a pizza stand two blocks away');
  P.teleport(g.town.poi.popup.x - 1.5, g.town.poi.popup.z, 0); sim(g, 0.1);
  g.exec(me, { k: 'rv', op: 'wreckStand' }); log(!R.popup, 'knocked their stand over');
  RV.event('cheese', 'italian'); log(W.shortage?.s === 'cheese', 'event: the Italian Guys stole your cheese supply (the grocery is sold out)');
  W.shortage = null;
  RV.event('deal', 'frozen'); log(!!R.offer, 'event: ' + R.offer?.kind + ' deal from the Frozen Gang');
  R.offer = { g: 'frozen', kind: 'partner', t: 100 }; g.exec(me, { k: 'rv', op: 'deal', yes: true });
  log(R.g.frozen.ally, 'accepted a partnership: the Frozen Gang are allies');
  // a meeting, with Frank and his pizza
  RV.event('meeting', 'italian'); log(R.g.italian.invite > 0, 'event: Don Vincenzo wants a meeting');
  const PI = RV.place('italian'); P.teleport(PI.desk.x, PI.desk.z + 0.5, 0); sim(g, 0.2);
  const T4 = []; RV.targets(P, T4); const sit = T4.find(t => /Sit down with/.test(t.label));
  log(!!sit, 'at the desk: "' + (sit || {}).label + '"');
  for (let i = 0; i < 40 && g.ui.dlg; i++) { skip(); sim(g, 0.05); }   // finish whatever was still being said
  sit.fn(); RV.droppedOnce = false;
  for (let i = 0; i < 60 && (RV.cine || g.ui.dlg); i++) { sim(g, 0.1); skip(); await tick(); }
  const dropped = RV.droppedOnce;  log(dropped, '"We have a problem." ... (SPLAT) "...Frank."');
  g.ui.closeMenu();
  // missions
  R.mission = null; RV.startMission(me, 'race');
  const ro = W.orders.find(o => o.mission === 'race');
  log(!!ro && ro.rv && g.hold(me).some(i => i.k === 'box'), 'mission: Delivery Race (their van: ' + Math.ceil(ro.rv.t) + 's)');
  sim(g, 0.3); log(!!RV.groups.van, 'the Delivery Boys\' van is on the road');
  const m4 = W.money; g.orders.noTab = true; g.exec(me, { k: 'deliver', id: ro.id }); g.orders.noTab = false;
  log(!R.mission && W.money >= m4 + 3000, 'won the race (+' + (W.money - m4) + ')');
  RV.startMission(me, 'takeover'); P.teleport(g.town.poi.takeover.x, g.town.poi.takeover.z, 0);
  for (let i = 0; i < 12; i++) { g.exec(me, { k: 'rv', op: 'claim' }); sim(g, 0.5); }
  log(R.pizzeria, 'mission: took over MAMMA MIA\'S (it pays every minute now)');
  RV.startMission(me, 'shipment'); const M = R.mission;
  for (let i = 0; i < 4; i++) { W.hold[me] = []; P.teleport(M.drops[i].x, M.drops[i].z, 0); g.exec(me, { k: 'rv', op: 'pick', i }); }
  sim(g, 0.2); log(!R.mission, 'mission: found all 4 crates of the missing shipment');
  W.hold[me] = []; RV.startMission(me, 'inspection');
  for (let i = 0; i < 3; i++) { P.teleport(PI.X - 6, 3.5, 0); g.exec(me, { k: 'rv', op: 'tomato' }); P.teleport(PI.out.door.x, PI.out.door.z, 0); g.exec(me, { k: 'rv', op: 'hide' }); }
  sim(g, 0.2); log(!R.mission && R.g.italian.rel > 0, 'mission: hid the Italian Guys\' "tomatoes" from the inspectors (they owe you)');
  RV.event('secret', 'delivery'); const s = g.town.poi.deadPizzerias[R.secret.i];
  P.teleport(s.x, s.z + 1, 0); sim(g, 0.3); const T5 = []; RV.targets(P, T5); sim(g, 0.2);
  log(R.mission?.found && W.footage.some(f => f.photo), 'mission: found the Delivery Boys\' secret kitchen in ' + s.name + ' (photo saved)');
  g.exec(me, { k: 'rv', op: 'wreckKitchen' }); sim(g, 0.2);
  log(!R.mission, 'wrecked their secret kitchen');
  // the trophy
  W.hold[me] = []; const Pf = RV.place('frozen'); delete R.g.frozen.st.trophy; R.g.frozen.ally = false;
  P.teleport(Pf.st.find(s => s.id === 'trophy').x, Pf.st.find(s => s.id === 'trophy').z, 0); g.exec(me, { k: 'rv', op: 'sab', g: 'frozen', id: 'trophy' });
  const S2 = g.town.poi.storage; P.teleport((S2.x0 + S2.x1) / 2, (S2.z0 + S2.z1) / 2, 0); g.exec(me, { k: 'rv', op: 'display' });
  log(R.trophies.includes('frozen'), 'stole the Frozen Gang\'s ice sculpture and put it on display');
  g.onEvent = on;
  note('rivals done');
}

/** own a bit of everything */
function fillInventory(g) {
  const W = g.W, me = g.me;
  W.gear = { [me]: Object.fromEntries(GEAR_ORDER.map(k => [k, GEAR[k].uses ? 3 : 1])) };
  W.inv = { [me]: { smoke: 4, sack: 2 } }; W.license = true;
  W.owned.disg = ['mustache', 'coat', 'suit', 'cop'].filter(k => DISG[k]);
  W.owned.veh = ['scooter', 'pickup', 'getaway', 'icecream'].filter(k => VEH[k]);
  g.profile.hotbar = Array(10).fill(null); g.profile.hotSeen = [];
}

/** the hotbar and the inventory screen */
async function invTest(g) {
  fresh(g);
  const W = g.W, me = g.me, INV = g.inv, I = g.input, P = g.player;
  const key = (c) => { I.fake(c, true); sim(g, 1 / 30); I.fake(c, false); sim(g, 1 / 30); };
  log(document.getElementById('hotbar') && INV.hb.children.length === 10, 'a hotbar with 10 slots');
  fillInventory(g); sim(g, 0.2);
  const bar = g.profile.hotbar;
  log(bar.filter(Boolean).length === 10 && bar[0] === 'gear:foambat', 'new things fill the hotbar by themselves: ' + bar.filter(Boolean).length + ' slots');
  const img = INV.hb.querySelector('img');
  log(img.src.startsWith('data:image/png') && img.src.length > 2000, 'hotbar icons are rendered from the 3D models (' + Math.round(img.src.length / 1024) + ' KB)');
  key('Digit1');
  log(W.eq[me] === 'foambat', 'press 1: the foam bat comes out');
  key('Digit1');
  log(!W.eq[me], 'press 1 again: put away');
  key('Digit2');
  log(W.eq[me] === 'mallet' && INV.hb.children[1].classList.contains('on'), 'press 2: the mallet, its slot lights up');
  key('KeyI');
  log(INV.open && document.getElementById('inv').classList.contains('on') && g.frozen(), 'I opens the inventory (the game pauses around you)');
  log(INV.grid.querySelectorAll('.islot:not(.none)').length === 12, 'gear tab: all 12 pieces');
  key('KeyE'); log(INV.tab === 'supplies' && INV.list.length === 3, 'E: next tab, supplies (smoke bombs, trash bags, license)');
  key('KeyE'); log(INV.tab === 'outfits' && INV.list.length === W.owned.disg.length, 'outfits: ' + INV.list.length);
  key('KeyE'); log(INV.tab === 'vehicles' && INV.list.length === W.owned.veh.length, 'vehicles: ' + INV.list.length);
  key('KeyQ'); key('KeyQ'); key('KeyQ');
  log(INV.tab === 'gear', 'Q goes back');
  INV.sel = 11; INV.render(); key('Digit3');
  log(bar[2] === 'gear:briefcase', 'point at the briefcase and press 3: it moves to hotbar slot 3');
  INV.setTab('supplies'); INV.sel = 0; INV.render(); key('Digit0');
  log(bar[9] === 'smoke', 'smoke bombs onto slot 0');
  INV.setTab('gear'); INV.sel = 4; INV.render(); key('Enter');
  log(W.eq[me] === 'smoke', 'Enter: take out the selected gear (Party Smoke Machine)');
  INV.setTab('outfits'); INV.sel = 1; INV.render(); INV.primary();
  log(W.wear[me] === W.owned.disg[1], 'outfits: wear one (' + W.wear[me] + ')');
  log(INV.preview.obj && INV.preview.canvas.width === 360, 'the turntable preview is drawing');
  key('KeyI');
  log(!INV.open && !g.frozen(), 'I closes it');
  const n0 = W.inv[me].smoke, si = bar.indexOf('smoke');
  key(['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'][si]);
  log(W.inv[me].smoke === n0 - 1, 'the smoke bomb slot throws one (' + n0 + ' -> ' + W.inv[me].smoke + ')');
  // at the prep counter, numbers are toppings
  g.prepActive = true; const e0 = W.eq[me]; key('Digit1'); g.prepActive = false;
  log(W.eq[me] === e0, 'at the prep counter the number keys stay toppings');
  note('inventory done');
}

/** the Underground Market: Vito, the pizza, the shelf, the stairs, every piece of gear */
async function bmTest(g) {
  fresh(g);
  const me = g.me, W = g.W, P = g.player, BM = g.bm, B = g.town.poi.books;
  const tick = () => new Promise(r => setTimeout(r, 0));
  const skip = () => { if (g.ui.dlg) { g.ui.dlg.typed = 1e9; g.ui._next(); } };
  log(!!g.town.biz.books && B.shelf.col.on, 'Pages & Pages is on Pepper Road, the back shelf is solid');
  P.teleport(BM.vito.x + 1.3, BM.vito.z, 0); sim(g, 0.3);
  let T = []; BM.targets(P, T);
  log(T.some(t => /bookseller/.test(t.label)), 'the bookseller: "' + (T.find(t => /bookseller/.test(t.label)) || {}).label + '"');
  BM.talkVito(); for (let i = 0; i < 10; i++) { skip(); await tick(); }
  log(!W.bm, 'no pizza, no secret (he just drops hints)');
  W.hold[me] = [{ k: 'box', sauce: 1, cheese: 1, top: ['pepperoni'], cook: 1 }];
  T = []; BM.targets(P, T);
  log(T.some(t => /Give the bookseller your pizza/.test(t.label)), 'holding a pizza: "Give the bookseller your pizza"');
  BM.talkVito(); await tick();
  log(W.bm && !g.hold(me).length && !!BM.cine, 'he took the pizza; the reveal film starts');
  let saw = { around: false, walk: false, pull: false, mid: false };
  for (let i = 0; i < 900 && BM.cine; i++) {
    skip(); sim(g, 0.05); await tick();
    const st = BM.vito.st; if (st in saw) saw[st] = true;
    if (BM.shelfK > 0.3 && BM.shelfK < 0.9) saw.mid = true;
  }
  log(saw.around && saw.walk && saw.pull, 'Vito looked around, walked to the shelf and pulled the red book');
  log(saw.mid && !BM.cine && !g.cam.override, 'the shelf swung open on camera, then the film ended');
  sim(g, 1);
  log(B.shelf.pivot.rotation.y > 1.4 && !B.shelf.col.on, 'the secret shelf stays open (' + B.shelf.pivot.rotation.y.toFixed(2) + ' rad)');
  P.teleport(B.landing.x, B.landing.z, 0); sim(g, 0.2);
  T = []; BM.targets(P, T); const down = T.find(t => /secret stairs/.test(t.label));
  log(!!down, 'behind the shelf: "Go down the secret stairs"');
  down.fn(); await new Promise(r => setTimeout(r, 450)); sim(g, 0.2);
  log(P.pos.x > 760, 'down in the Underground Market (' + P.pos.x.toFixed(0) + ', ' + P.pos.z.toFixed(0) + ')');
  const items = g.town.shopItems.filter(s => s.cat === 'bm');
  log(items.length === 12 && BM.displays.length === 12 && BM.regulars.length >= 6, 'twelve tables of gear, the Broker and ' + BM.regulars.length + ' regulars');
  W.money = 300000;
  for (const k of GEAR_ORDER) g.exec(me, { k: 'shop', cat: 'bm', key: k });
  log(GEAR_ORDER.every(k => W.gear[me][k] > 0) && W.money === 300000 - GEAR_ORDER.reduce((s, k) => s + GEAR[k].price, 0), 'bought all twelve');
  T = []; BM.targets(P, T); const up = (() => { P.teleport(g.town.poi.marketExit.x, g.town.poi.marketExit.z, 0); sim(g, 0.1); const t = []; BM.targets(P, t); return t.find(x => /back up/.test(x.label)); })();
  log(!!up, 'the way out: "' + (up || {}).label + '"');
  // use everything, against real cops, out in town
  const use = (key, at) => { g.exec(me, { k: 'bm', op: 'equip', key }); const a = at || { x: P.pos.x, z: P.pos.z, yaw: P.yaw }; g.exec(me, { k: 'bm', op: 'use', key, x: a.x, z: a.z, yaw: a.yaw, f: 0 }); };
  const cop = (d = 1.6, st = 'chase') => { const c = g.police.spawnCop(); c.x = P.pos.x + Math.sin(P.yaw) * d; c.z = P.pos.z + Math.cos(P.yaw) * d; c.st = st; c.tgt = st === 'chase' ? me : null; c.lx = P.pos.x; c.lz = P.pos.z; c.lost = 0; c.stun = 0; return c; };
  const clear = () => { g.police.cops = g.police.cops.filter(c => c.kind === 'yard'); };
  P.teleport(0, 30, 0, 0); sim(g, 0.1); clear();
  let c = cop(); use('foambat');
  log(c.st === 'stun' && c.stun > 3 && c.tgt == null, 'foam bat: BONK, the cop forgot why he was chasing you');
  c = cop(); use('mallet');
  log(c.st === 'stun' && c.flat && c.stun > 6, 'mallet: cop pancake (7s)');
  clear(); const cs = [cop(3), cop(8)]; use('airhorn');
  log(cs.every(x => x.stun >= 2.9), 'air horn: every cop within 15m froze');
  clear(); c = cop(5); use('flashlight');
  log(c.stun >= 1.9, 'flashlight: blinded the chasing cop');
  clear(); c = cop(6); const n0 = W.gear[me].decoy; use('decoy');
  log(c.st === 'search' && Math.hypot(c.tx - (P.pos.x + Math.sin(P.yaw) * 10), c.tz - (P.pos.z + Math.cos(P.yaw) * 10)) < 0.5 && W.gear[me].decoy === n0 - 1, 'decoy box: the cop goes after the box instead');
  clear(); c = cop(2); use('docs');
  log(c.st === 'patrol' && c.tgt == null, 'fake documents: the cop salutes and leaves');
  clear(); c = cop(2); const m0 = W.money; use('briefcase');
  log(c.st === 'patrol' && W.money === m0 - 2000, 'briefcase: $2,000 and a muffin, the chase is over');
  clear(); use('disguise');
  log(W.incog[me] > 40, 'disguise kit: 45 seconds incognito');
  c = cop(3, 'patrol'); c.yaw = Math.atan2(P.pos.x - c.x, P.pos.z - c.z); W.hold[me] = [{ k: 'box', sauce: 1, cheese: 1, top: [], cook: 1 }];
  sim(g, 3, 1 / 15);
  log(c.st !== 'chase' && !(c.sus[me] > 0.05), 'disguised: a cop looks right at your pizza and sees nothing');
  W.hold[me] = []; W.incog = {}; clear();
  // the toolbox fixes a wrecked oven
  W.st.oven1 = W.st.oven1 || {}; W.st.oven1.burnt = true; W.st.oven1.grease = 0.8; W.st.oven1.fire = 0;
  const ov = STATION.oven1; P.teleport(ov.x, ov.z + 1.2, 0); sim(g, 0.1); use('toolbox');
  log(!W.st.oven1.burnt && W.st.oven1.grease === 0, 'toolbox: the wrecked oven is fixed');
  // debts: the lock-breaking kit and Cardboard Knuckles
  const d = g.debts.create('house', 5, 'Gary', 3000, 'test'); d.state = 'late';
  const at = g.debts.at(d); P.teleport(at.x, at.z + 0.6, 0); sim(g, 0.1);
  use('lockpick');
  log(d.state === 'overdue', 'lock-breaking kit: deadline skipped, their stuff can be taken now');
  const m1 = W.money; use('cutout');
  log(d.cut && (W.money === m1 + d.amount || W.debts.includes(d)), 'Cardboard Knuckles at the door: ' + (W.debts.includes(d) ? 'they saw the stick' : 'they paid ' + d.amount));
  // inspections: smoke machine and documents
  W.gear[me].docs = 1;   // the last set went to that cop
  W.insp = null; W.inspCool = 0; g.inspections.start('test'); P.teleport(146, 80, 0); sim(g, 0.1);
  use('smoke'); use('docs');
  log(W.insp.smoke && W.insp.docs, 'inspection: party fog (-3) and fake documents (-4)');
  W.insp = null; g.police.cops = g.police.cops.filter(c => c.kind !== 'officer');
  // animations: equip, use, away
  P.teleport(0, 30, 0, 0); g.exec(me, { k: 'bm', op: 'equip', key: 'foambat' }); sim(g, 1.2);
  log(P.gear.T.cur === 'foambat' && P.gear.T.ph === 'idle' && P.gearVM.T.cur === 'foambat', 'foam bat in hand (first and third person)');
  BM.use(); sim(g, 0.1);
  log(P.gear.T.ph === 'use' && P.gearVM.T.anim === 'swing', 'click: the swing animation plays');
  g.exec(me, { k: 'bm', op: 'away' }); sim(g, 0.6);
  log(!P.gear.T.cur && !P.gearVM.model, 'put away (B)');
  W.hold[me] = [{ k: 'box', sauce: 1, cheese: 1, top: [], cook: 1 }]; g.exec(me, { k: 'bm', op: 'equip', key: 'foambat' }); sim(g, 0.5);
  log(!P.gear.holder.visible, 'carrying a pizza: the bat waits on your back');
  W.hold[me] = [];
  // the trash bag
  const bag = makeItem({ k: 'bag', id: 1, name: 'Gary' });
  log(!!bag.userData.body && !!bag.userData.neck, 'the bag is a lumpy black trash bag with a tied neck');
  note('black market done');
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
  log(d.state === 'guest' && d.res > 99 && D.guest && D.guest.id === d.id && !!D.guest.hood, d.name + ' is in the Time-Out Chair: hood on, cuffed, resolve 100%');
  g.exec(me, { k: 'debt', id: d.id, op: 'take' });
  log(W.debts.includes(d), 'at first they refuse: no money to take yet');
  // bonk them with the foam bat until they agree
  W.gear = W.gear || {}; W.gear[me] = { foambat: 1, mallet: 1 }; W.eq = W.eq || {};
  const bonk = (key) => { g.exec(me, { k: 'bm', op: 'equip', key }); g.exec(me, { k: 'bm', op: 'use', key, x: P.pos.x, z: P.pos.z, yaw: P.yaw, f: 0 }); };
  const r0 = d.res; bonk('foambat');
  log(d.res < r0 && d.res > 70, 'foam bat: BONK, resolve ' + r0 + ' -> ' + Math.round(d.res) + '% (still threatening to call the cops)');
  let n = 1; while (d.res > 0 && n < 20) { bonk('mallet'); n++; }
  log(d.res <= 0, 'after ' + n + ' bonks they agree to pay');
  const m0 = W.money;
  g.exec(me, { k: 'debt', id: d.id, op: 'take' });
  log(!W.debts.includes(d) && W.money === m0 + d.amount, 'took the money (' + d.amount + '), they went home');
  sim(g, 0.2);
  log(!D.guest, 'the chair is empty again');
  // the second guest: you don't take their money, you keep them
  const k = D.create('house', 6, 'Kevin', 1200, 'test'); k.state = 'guest'; k.res = 0;
  g.exec(me, { k: 'debt', id: k.id, op: 'keep' });
  sim(g, 0.2);
  log(k.state === 'kept' && W.debts.includes(k) && D.guest && D.guest.id === k.id, 'refused their money: ' + k.name + ' stays in the chair for good');
  k.res = 0; sim(g, 5);
  log(k.state === 'kept', 'still there five seconds later (no timer)');
  g.exec(me, { k: 'debt', id: k.id, op: 'letgo' });
  sim(g, 0.2);
  log(k.state === 'late' && !D.guest, 'let them go home: still owing you');
  // left alone, the fight slowly goes out of them
  const s = D.create('house', 7, 'Steve', 1000, 'test'); s.state = 'guest'; s.res = 1;
  sim(g, 3);
  log(s.res === 0 && s.state === 'guest', 'left alone long enough, they offer to pay (but wait for you)');
  g.exec(me, { k: 'debt', id: s.id, op: 'letgo' });
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
  g.orders.noTab = true;   // no "put it on the tab" this time
  g.exec(me, { k: 'deliver', id: o.id });
  g.orders.noTab = false;
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
