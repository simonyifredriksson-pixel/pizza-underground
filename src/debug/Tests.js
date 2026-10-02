/* Tests.js - ?skip=<quest> drops you into the story, ?script=<name> runs a
   scripted check and writes PASS/FAIL lines into #testout (read it with a
   headless browser's --dump-dom). ?shot=<name> frames a screenshot. */
import { newWorld } from '../game/State.js';
import { Q } from '../data/Story.js';
import { STOCK } from '../data/Data.js';
import { HQ } from '../world/Town.js';
import { STATION } from '../data/Hideout.js';

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
  g.ui.hudVisible(true); g.ui.cinema(false); g.ui.fade(false); g.ui.sub(null);
  g.intro.active = null; g.cam.override = null;
  if (q >= Q.CLEAN) g.player.teleport(146, 80, 0, Math.PI / 2);
  else g.spawnInTown();
  g.cam.snap = true;
  const qs = new URLSearchParams(location.search);
  const shot = qs.get('shot');
  if (shot) frame(g, shot);
  const ui = qs.get('ui');
  if (ui) setTimeout(() => {
    if (ui === 'map') g.map.show();
    if (ui === 'phone') { g.orders.spawn(); g.orders.spawn().state = 'open'; g.orders.spawn().sting = true; g.phone(); }
    if (ui === 'laptop') g.npcs.laptop();
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
    if (name === 'all') { kitchen(g); fire(g); police(g); inspector(g); story(g); note('DONE'); return; }
  } catch (e) { log(false, 'exception ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')); }
}

function fresh(g, q = Q.BIZ) { setupAt(g, q); sim(g, 0.2); }

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
  cop.x = 0; cop.z = 32; cop.yaw = Math.PI; cop.st = 'patrol';
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
  g.events.start('inspector');
  log(W.event?.k === 'inspector' && W.event.t > 20, 'the inspector is coming, eta ' + Math.round(W.event?.t));
  const m0 = W.money;
  sim(g, 200, 1 / 15);
  log(W.money < m0 && !W.st.prep1.item, 'evidence found: fined ' + (m0 - W.money));
  // clean run
  W.event = null; W.heat = 60;
  g.events.start('inspector');
  sim(g, 200, 1 / 15);
  log(W.heat < 40, 'clean kitchen: heat dropped to ' + Math.round(W.heat));
  note('inspector done');
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
