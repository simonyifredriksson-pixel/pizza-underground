/* Inventory.js - the hotbar along the bottom of the screen, and the big
   inventory screen (I) with tabs, a grid of everything you own, a turntable
   preview of you (holding it, wearing it) or the thing itself, and a card
   with its stars, stats and story.

   The hotbar holds gear, smoke bombs and trash bags: press 1-9 / 0 to pull a
   slot out (again to put it away). In the inventory, point at something and
   press a number to put it on that slot. The layout is yours (it lives in
   your profile); everything else comes from the world state. */
import * as THREE from '../../lib/three.module.js';
import { GEAR, GEAR_ORDER } from '../data/BlackMarket.js';
import { DISGUISES, VEHICLES } from '../data/Data.js';
import { makeGear, makeTrashBag, makePolaroid } from '../art/Gear.js';
import { makeChar } from '../art/Chars.js';
import { makeCar } from '../art/Props.js';
import { part, geo, rot } from '../art/Mesher.js';
import { lookFor } from '../game/Player.js';
import { GearRig } from '../game/GearView.js';
import { saveProfile } from '../game/State.js';
import { IconMaker, Preview } from './Icons.js';
import { money, esc } from '../core/Util.js';

const SLOTS = 10;
const KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'];

/* ---------------- hand-drawn icons (SVG) ---------------- */
const SVG = {
  gear: '<path d="M3.5 19.2 5 20.7 17.6 8.1c1.9-1.9 2.4-4.4 1.6-5.2-.8-.8-3.3-.3-5.2 1.6L3.5 17.1z"/><circle cx="3.6" cy="20.5" r="1.7"/>',
  supplies: '<path d="M7.6 7.4c1.1-.9 2.6-1.3 4.4-1.3s3.3.4 4.4 1.3l2.2 11.1c.2 1.2-.6 2.4-1.8 2.6-3.1.6-6.5.6-9.6 0-1.2-.2-2-1.4-1.8-2.6z"/><path d="M9.8 6.2 11 3.3h2l1.2 2.9" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  outfits: '<path d="M8.2 3 3.6 5.8l1.9 4.4 2.3-1V21h8.4V9.2l2.3 1 1.9-4.4L15.8 3c-.6 1.6-2.1 2.6-3.8 2.6S8.8 4.6 8.2 3z"/>',
  vehicles: '<path d="M3 14.2 4.9 9c.4-1.1 1.4-1.8 2.5-1.8h9.2c1.1 0 2.1.7 2.5 1.8l1.9 5.2V18H3z"/><circle cx="7" cy="18.2" r="2.2"/><circle cx="17" cy="18.2" r="2.2"/><path d="M6.3 12.6h11.4l-1.1-3.3H7.4z" fill="#15181d"/>',
  coin: '<circle cx="12" cy="12" r="9.5" fill="#43e07a" stroke="#1d6b3a" stroke-width="1.6"/><path d="M14.6 9.2c-.5-.9-1.5-1.4-2.6-1.4-1.6 0-2.7.8-2.7 2s1 1.7 2.7 2.1 2.8.9 2.8 2.2-1.2 2.1-2.8 2.1c-1.2 0-2.3-.6-2.8-1.6M12 6.4v11.2" fill="none" stroke="#0f3a1f" stroke-width="1.7" stroke-linecap="round"/>',
  star: '<path d="M12 2.6l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 16.8l-5.8 3.3 1.4-6.4-4.9-4.4 6.5-.7z"/>',
  swing: '<path d="M4 20 16 8l2 2L6 22zM15 4c3 0 5 2 5 5" fill="none" stroke="currentColor" stroke-width="2"/>',
  bolt: '<path d="M13 2 5 13h6l-1 9 8-11h-6z"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/>',
  box: '<path d="M3 7 12 3l9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10" fill="none" stroke="#15181d" stroke-width="1.3"/>',
  wheel: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="2.6"/>',
  eye: '<path d="M2 12c2.5-4.5 6-7 10-7s7.5 2.5 10 7c-2.5 4.5-6 7-10 7S4.5 16.5 2 12z"/><circle cx="12" cy="12" r="3.2" fill="#15181d"/>',
};
const svg = (k, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${SVG[k]}</svg>`;

const TABS = [
  { k: 'gear', name: 'Gear' },
  { k: 'supplies', name: 'Supplies' },
  { k: 'outfits', name: 'Outfits' },
  { k: 'vehicles', name: 'Vehicles' },
];
const ANIM_NAME = { swing: 'Swing', slam: 'Slam', thrust: 'Use', raise: 'Show', jiggle: 'Jiggle', throw: 'Throw' };
const stars = (price) => price >= 20000 ? 4 : price >= 6000 ? 3 : price >= 2500 ? 2 : 1;

/* ---------------- little models for things that aren't gear ---------------- */
function smokeBomb() {
  const g = new THREE.Group();
  g.add(part(geo.ico(1), '#22222c', 0, 0.3, 0, 0.56, 0.56, 0.56, { rough: 0.4, metal: 0.3 }));
  g.add(part(geo.cyl(8), '#5a5a6a', 0, 0.6, 0, 0.16, 0.1, 0.16));
  g.add(rot(part(geo.cyl(5), '#c8a070', 0.05, 0.72, 0, 0.04, 0.22, 0.04), 'z', -0.5));
  g.add(part(geo.ico(0), '#ffd23f', 0.12, 0.83, 0, 0.09, 0.09, 0.09, { emissive: 0xffa020, ei: 1.5 }));
  g.add(part(geo.box(), '#ffffff', 0, 0.32, 0.27, 0.22, 0.12, 0.02));
  return g;
}
function licenseCard() {
  const g = new THREE.Group();
  const c = new THREE.Group(); c.rotation.x = -0.35; g.add(c);
  c.add(part(geo.box(), '#f6f1e6', 0, 0.3, 0, 0.86, 0.56, 0.03));
  c.add(part(geo.box(), '#3a7bd5', 0, 0.52, 0.018, 0.86, 0.1, 0.01));
  c.add(part(geo.box(), '#e0a57c', -0.24, 0.25, 0.018, 0.24, 0.3, 0.01));
  for (let i = 0; i < 3; i++) c.add(part(geo.box(), '#9a9ab0', 0.15, 0.36 - i * 0.09, 0.018, 0.36, 0.03, 0.01));
  c.add(part(geo.cyl(10), '#e8b83a', 0.3, 0.12, 0.02, 0.12, 0.01, 0.12));
  return g;
}

export class Inventory {
  constructor(game) {
    this.g = game;
    this.open = false;
    this.tab = 'gear';
    this.sel = 0;
    this.icons = new IconMaker(game.renderer);
    const p = game.profile;
    if (!Array.isArray(p.hotbar) || p.hotbar.length !== SLOTS) p.hotbar = Array(SLOTS).fill(null);
    p.hotSeen = p.hotSeen || [];
    this._buildHotbar();
    this._buildScreen();
    this.barKey = ''; this.nameT = 0;
  }
  get W() { return this.g.W; }
  get me() { return this.g.me; }
  get bar() { return this.g.profile.hotbar; }

  /* ---------------- what you own ---------------- */
  entries(tab) {
    const W = this.W, me = this.me, inv = W.gear?.[me] || {}, sup = W.inv?.[me] || {}, eq = W.eq?.[me];
    const out = [];
    if (tab === 'gear') for (const k of GEAR_ORDER) {
      if (!(inv[k] > 0)) continue;
      const G = GEAR[k];
      out.push({
        id: 'gear:' + k, kind: 'gear', key: k, name: G.label, count: G.uses ? inv[k] : null, on: eq === k, desc: G.desc, stars: stars(G.price),
        chips: [[G.anim === 'swing' || G.anim === 'slam' ? 'swing' : G.anim === 'throw' ? 'box' : 'bolt', ANIM_NAME[G.anim]], G.uses ? ['box', inv[k] + ' left'] : ['shield', 'Keeps'], ...(G.bonus ? [['eye', 'Debts +' + Math.round(G.bonus * 100) + '%']] : [])],
        icon: () => makeGear(k), act: eq === k ? 'Put away' : 'Take out',
      });
    }
    if (tab === 'supplies') {
      if (sup.smoke > 0) out.push({ id: 'smoke', kind: 'supply', key: 'smoke', name: 'Smoke Bomb', count: sup.smoke, desc: 'Throw it (G, or its hotbar number) and vanish: every cop chasing you loses you.', stars: 2, chips: [['box', 'Throw'], ['box', sup.smoke + ' left']], icon: smokeBomb, act: 'Throw one' });
      if (sup.sack > 0) out.push({ id: 'sack', kind: 'supply', key: 'sack', name: 'Comically Large Trash Bag', count: sup.sack, desc: 'For "giving debtors a ride". At a debtor\'s door press R to bag them, then trunk, then the Time-Out Chair.', stars: 1, chips: [['eye', 'Debtors'], ['box', sup.sack + ' left']], icon: () => { const b = makeTrashBag(); b.userData.wiggle = false; return b; }, act: null });
      if (sup.polaroid) out.push({ id: 'polaroid', kind: 'supply', key: 'polaroid', name: 'Instant Camera "FLASHY"', count: null, desc: sup.photo ? 'You have a photo of ' + sup.photo.name + ' in your Time-Out Chair. Show it to his boss (E at their door) and demand a ransom.' : 'Snap a rival gang\'s guy in your Time-Out Chair (E at the chair) and show his boss the photo: proof for the ransom.', stars: 2, chips: [['eye', sup.photo ? 'Photo: ' + sup.photo.name : 'No photo yet']], icon: makePolaroid, act: null });
      if (W.license) out.push({ id: 'license', kind: 'supply', key: 'license', name: 'Fake Business License', count: null, desc: 'Laminated! The next inspection finds 3 less evidence. Then the inspector notices the spelling.', stars: 2, chips: [['shield', 'Inspections -3']], icon: licenseCard, act: null });
    }
    if (tab === 'outfits') for (const k of W.owned?.disg || []) {
      const D = DISGUISES[k]; if (!D) continue;
      const wearing = W.wear?.[me] === k;
      out.push({ id: 'outfit:' + k, kind: 'outfit', key: k, name: D.name, count: null, on: wearing, desc: D.desc, stars: stars(D.price), chips: [['eye', 'Cops notice ' + Math.round((1 - D.detect) * 100) + '% later']], icon: () => makeChar(lookFor(this.g.profile.look, k)).root, iconOpt: { focus: 'top', dir: [0.35, 0.25, 1] }, act: wearing ? 'Take off' : 'Wear' });
    }
    if (tab === 'vehicles') for (const k of W.owned?.veh || []) {
      const V = VEHICLES[k]; if (!V) continue;
      out.push({ id: 'car:' + k, kind: 'vehicle', key: k, name: V.name, count: null, desc: V.desc, stars: stars(V.price), chips: [['box', 'Cargo ' + V.cap], ['wheel', 'Top speed ' + Math.round(V.speed)], ...(V.grip != null ? [['wheel', 'Grip ' + Math.round(V.grip * 100) + '%']] : [])], icon: () => makeCar(k === 'delivery' ? 'delivery' : k).group, iconOpt: { dir: [1, 0.55, 1] }, act: null });
    }
    return out;
  }
  /** the things that can live on the hotbar */
  hotbarIds() { return [...this.entries('gear'), ...this.entries('supplies').filter(e => e.key !== 'license' && e.key !== 'polaroid')].map(e => e.id); }
  entryById(id) { for (const t of ['gear', 'supplies']) { const e = this.entries(t).find(x => x.id === id); if (e) return e; } return null; }
  icon(e) { return this.icons.get(e.id, e.icon, e.iconOpt); }

  /* ---------------- the hotbar ---------------- */
  _buildHotbar() {
    const host = document.getElementById('held')?.parentNode || document.body;
    this.hb = document.createElement('div'); this.hb.id = 'hotbar'; host.appendChild(this.hb);
    this.hbName = document.createElement('div'); this.hbName.id = 'hotname'; host.appendChild(this.hbName);
    this.hb.innerHTML = Array.from({ length: SLOTS }, (_, i) => `<div class="hs" data-i="${i}"><span class="n">${(i + 1) % 10}</span><img alt=""><span class="c"></span></div>`).join('');
    this.hb.addEventListener('mousedown', e => { const s = e.target.closest('.hs'); if (s) { e.stopPropagation(); this.activate(+s.dataset.i); } });
  }
  /** keep the bar in step with what you own: new things go into the first free slot */
  _syncBar() {
    const own = new Set(this.hotbarIds()), p = this.g.profile, bar = this.bar;
    let changed = false;
    for (let i = 0; i < SLOTS; i++) if (bar[i] && !own.has(bar[i])) { bar[i] = null; changed = true; }
    for (const id of own) {
      if (bar.includes(id) || p.hotSeen.includes(id)) continue;
      const free = bar.indexOf(null); if (free < 0) break;
      bar[free] = id; p.hotSeen.push(id); changed = true;
    }
    for (const id of [...p.hotSeen]) if (!own.has(id) && !id.startsWith('gear:')) p.hotSeen.splice(p.hotSeen.indexOf(id), 1); // used up: comes back when you buy more
    if (changed) saveProfile(p);
  }
  _drawBar() {
    const W = this.W, eq = W.eq?.[this.me], sup = W.inv?.[this.me] || {}, inv = W.gear?.[this.me] || {};
    const key = JSON.stringify([this.bar, eq, sup.smoke, sup.sack, GEAR_ORDER.map(k => inv[k] || 0)]);
    if (key === this.barKey) return;
    this.barKey = key;
    [...this.hb.children].forEach((el, i) => {
      const id = this.bar[i], e = id ? this.entryById(id) : null;
      el.classList.toggle('empty', !e);
      el.classList.toggle('on', !!e && e.kind === 'gear' && e.key === eq);
      const img = el.querySelector('img');
      if (e) { const u = this.icon(e); if (img.getAttribute('src') !== u) img.src = u; img.style.display = ''; } else { img.removeAttribute('src'); img.style.display = 'none'; }
      el.querySelector('.c').textContent = e && e.count != null ? e.count : '';
      el.title = e ? e.name : '';
    });
  }
  /** press a number: pull it out, put it away, or throw a smoke bomb */
  activate(i) {
    const g = this.g, id = this.bar[i], e = id ? this.entryById(id) : null, P = g.player;
    if (!e) return;
    if (e.kind === 'gear') {
      const on = this.W.eq?.[this.me] === e.key;
      g.act({ k: 'bm', op: on ? 'away' : 'equip', key: e.key });
      this._showName(on ? '' : e.name);
    } else if (e.key === 'smoke') { g.act({ k: 'smoke', x: P.pos.x, z: P.pos.z }); this._showName('Smoke Bomb!'); }
    else if (e.key === 'sack') { g.ui.toast('Trash bag: walk up to a debtor\'s door and press R.'); this._showName(e.name); }
    g.audio.tone(660, 0.05, 'triangle', 0.05);
  }
  _showName(t) { if (!t) return; this.hbName.textContent = t; this.hbName.classList.remove('on'); void this.hbName.offsetWidth; this.hbName.classList.add('on'); }

  /* ---------------- the inventory screen ---------------- */
  _buildScreen() {
    const el = document.createElement('div'); el.id = 'inv'; document.body.appendChild(el); this.el = el;
    el.innerHTML = `
      <div class="inv-head">
        <div class="inv-lr"><b class="ikey">Q</b><span class="inv-prev"></span></div>
        <div class="inv-title">Inventory</div>
        <div class="inv-lr"><span class="inv-next"></span><b class="ikey">E</b></div>
      </div>
      <div class="inv-money">${svg('coin')}<span></span></div>
      <div class="inv-tabs">${TABS.map(t => `<div class="itab" data-t="${t.k}"><span class="itab-name">${t.name}</span>${svg(t.k)}</div>`).join('')}</div>
      <div class="inv-gridwrap"><div class="inv-grid"></div><div class="inv-empty"></div></div>
      <canvas class="inv-preview" width="360" height="500"></canvas>
      <div class="inv-card"></div>
      <div class="inv-foot">
        <span><b class="ikey">Click</b>Select / use</span><span><b class="ikey">1-0</b>Put on hotbar</span><span><b class="ikey">Drag</b>Rotate</span><span><b class="ikey">I</b>Close</span>
      </div>`;
    this.grid = el.querySelector('.inv-grid');
    this.card = el.querySelector('.inv-card');
    this.preview = new Preview(this.icons, el.querySelector('.inv-preview'));
    el.querySelector('.inv-tabs').addEventListener('click', e => { const t = e.target.closest('.itab'); if (t) this.setTab(t.dataset.t); });
    this.grid.addEventListener('click', e => {
      const s = e.target.closest('.islot'); if (!s) return;
      const i = +s.dataset.i;
      if (i === this.sel) this.primary(); else { this.sel = i; this.render(); }
    });
    this.grid.addEventListener('mouseover', e => { const s = e.target.closest('.islot'); if (s && +s.dataset.i !== this.sel) { this.sel = +s.dataset.i; this.render(); } });
    this.card.addEventListener('click', e => { if (e.target.closest('.d-act')) this.primary(); });
    el.addEventListener('mousedown', e => e.stopPropagation());
  }
  toggle(tab) { if (this.open) this.close(); else this.show(tab); }
  show(tab) {
    const g = this.g;
    if (g.phase !== 'play' || g.ui.menuOpen || g.ui.inDialog || g.cam.override) return;
    if (tab) this.setTab(tab, true);
    this.open = true; this.sel = Math.min(this.sel, Math.max(0, this.entries(this.tab).length - 1));
    g.input.unlock();
    this.el.classList.add('on');
    this.preview.key = '';
    this.render();
    g.audio.tone(520, 0.06, 'triangle', 0.06); g.audio.tone(780, 0.08, 'triangle', 0.05);
  }
  close() {
    if (!this.open) return;
    this.open = false; this.el.classList.remove('on');
    this.g.audio.tone(600, 0.05, 'triangle', 0.05);
  }
  setTab(t, quiet) {
    if (this.tab !== t) { this.tab = t; this.sel = 0; this.preview.key = ''; }
    if (!quiet) { this.render(); this.g.audio.tone(880, 0.03, 'square', 0.03); }
  }
  render() {
    if (!this.open) return;
    const W = this.W, list = this.entries(this.tab), ti = TABS.findIndex(t => t.k === this.tab);
    this.list = list;
    this.sel = Math.max(0, Math.min(this.sel, list.length - 1));
    this.el.querySelectorAll('.itab').forEach(t => t.classList.toggle('on', t.dataset.t === this.tab));
    this.el.querySelector('.inv-prev').textContent = TABS[(ti + TABS.length - 1) % TABS.length].name;
    this.el.querySelector('.inv-next').textContent = TABS[(ti + 1) % TABS.length].name;
    this.el.querySelector('.inv-money span').textContent = money(W.money).replace('$', '');
    const slots = Math.max(15, Math.ceil(list.length / 5) * 5);
    this.grid.innerHTML = Array.from({ length: slots }, (_, i) => {
      const e = list[i];
      if (!e) return '<div class="islot none"></div>';
      const hk = this.bar.indexOf(e.id);
      return `<div class="islot ${e.on ? 'eq' : ''} ${i === this.sel ? 'sel' : ''}" data-i="${i}"><img src="${this.icon(e)}" alt="">${e.count != null ? `<span class="cnt">${e.count}</span>` : ''}${hk >= 0 ? `<span class="hk">${(hk + 1) % 10}</span>` : ''}</div>`;
    }).join('');
    const empty = this.el.querySelector('.inv-empty');
    empty.textContent = list.length ? '' : {
      gear: W.bm ? 'No gear yet. The Underground Market sells it (down the stairs behind the shelf in Pages & Pages).' : 'No gear yet. They say the bookshop on Pepper Road sells more than books.',
      supplies: 'Nothing here. Smoke bombs and trash bags: the General store at the Crumb Mall.',
      outfits: 'No outfits yet. Madame Moustache and the Crumb Mall\'s costume aisle can help.',
      vehicles: 'No vehicles yet. Honest Hank\'s Motors, north of the gas station.',
    }[this.tab];
    const e = list[this.sel];
    this.card.style.display = e ? '' : 'none';
    if (e) {
      const hk = this.bar.indexOf(e.id), canBar = this.tab === 'gear' || (this.tab === 'supplies' && e.key !== 'license');
      this.card.innerHTML = `
        <div class="d-stars">${Array.from({ length: e.stars }, () => svg('star')).join('')}</div>
        <div class="d-name">${esc(e.name)}</div>
        <div class="d-chips">${(e.chips || []).map(([ic, t]) => `<span class="chip">${svg(ic)}${esc(t)}</span>`).join('')}${e.count != null ? `<span class="chip num">x${e.count}</span>` : ''}</div>
        <div class="d-desc">${esc(e.desc)}</div>
        <div class="d-row">${e.act ? `<button class="d-act">${esc(e.act)}</button>` : ''}${canBar ? `<span class="d-hint">${hk >= 0 ? 'On hotbar slot ' + ((hk + 1) % 10) + '. ' : ''}Press 1-0 to put it on the hotbar.</span>` : ''}</div>`;
    }
    this._previewFor(e);
  }
  _previewFor(e) {
    const P = this.g.profile, W = this.W, wear = W.wear?.[this.me] || null;
    if (!e) { this.preview.set('me:' + wear, () => this._dude(wear, null)); return; }
    if (e.kind === 'gear') this.preview.set('gear:' + e.key + wear, () => this._dude(wear, e.key));
    else if (e.kind === 'outfit') this.preview.set('outfit:' + e.key, () => this._dude(e.key, W.eq?.[this.me] || null));
    else if (e.kind === 'vehicle') this.preview.set('car:' + e.key, () => makeCar(e.key === 'delivery' ? 'delivery' : e.key).group, { height: 1.4 });
    else this.preview.set('sup:' + e.key, e.icon, { height: e.key === 'license' ? 0.9 : 1.2 });
    void P;
  }
  /** you, for the turntable: wearing an outfit, holding a piece of gear */
  _dude(wear, gearKey) {
    const R = makeChar(lookFor(this.g.profile.look, wear));
    const G = new GearRig(); G.set(gearKey);
    R.root.userData.tick = (dt) => { R.anim(dt, {}); G.update(dt, R, {}); };
    R.root.userData.tick(0.001);
    return R.root;
  }
  /** do the obvious thing with the selected item */
  primary() {
    const g = this.g, e = this.list?.[this.sel]; if (!e) return;
    if (e.kind === 'gear') g.act({ k: 'bm', op: e.on ? 'away' : 'equip', key: e.key });
    else if (e.kind === 'outfit') g.act({ k: 'wear', d: e.on ? null : e.key });
    else if (e.key === 'smoke') { this.close(); const P = g.player; g.act({ k: 'smoke', x: P.pos.x, z: P.pos.z }); return; }
    g.audio.tone(990, 0.05, 'triangle', 0.05);
    setTimeout(() => this.render(), 60);
  }
  /** put the selected item on hotbar slot i (it moves if it was on another slot) */
  assign(i) {
    const e = this.list?.[this.sel]; if (!e) return;
    if (!(this.tab === 'gear' || (this.tab === 'supplies' && e.key !== 'license'))) return this.g.ui.toast('That can\'t go on the hotbar.');
    const bar = this.bar, was = bar.indexOf(e.id), there = bar[i];
    if (was >= 0) bar[was] = there === e.id ? null : there; else if (there) { /* the old one drops off */ }
    bar[i] = e.id;
    if (!this.g.profile.hotSeen.includes(e.id)) this.g.profile.hotSeen.push(e.id);
    saveProfile(this.g.profile); this.barKey = '';
    this.g.audio.tone(1200, 0.05, 'triangle', 0.05);
    this.render();
  }

  /* ---------------- every frame ---------------- */
  update(dt) {
    const g = this.g, I = g.input, play = g.phase === 'play';
    this.hb.style.display = play && !this.open ? '' : 'none';
    if (!play) { if (this.open) this.close(); return; }
    this._syncBar();
    this._drawBar();
    if (I.pressedRaw('KeyI') && !g.chatOpen && !g.admin?.open) this.toggle();
    if (this.open) {
      if (I.pressedRaw('Escape')) this.close();
      if (I.pressedRaw('KeyQ')) this.setTab(TABS[(TABS.findIndex(t => t.k === this.tab) + TABS.length - 1) % TABS.length].k);
      if (I.pressedRaw('KeyE')) this.setTab(TABS[(TABS.findIndex(t => t.k === this.tab) + 1) % TABS.length].k);
      const n = this.list?.length || 0, mv = (d) => { if (n) { this.sel = (this.sel + d + n) % n; this.render(); } };
      if (I.pressedRaw('ArrowRight') || I.pressedRaw('KeyD')) mv(1);
      if (I.pressedRaw('ArrowLeft') || I.pressedRaw('KeyA')) mv(-1);
      if (I.pressedRaw('ArrowDown') || I.pressedRaw('KeyS')) mv(5);
      if (I.pressedRaw('ArrowUp') || I.pressedRaw('KeyW')) mv(-5);
      if (I.pressedRaw('Enter') || I.pressedRaw('Space')) this.primary();
      KEYS.forEach((k, i) => { if (I.pressedRaw(k)) this.assign(i); });
      this.preview.update(dt, (d, obj) => obj.userData.tick && obj.userData.tick(d));
      // money and counts change while you look (smoke bombs, gear bought by a friend...)
      this._refreshT = (this._refreshT || 0) - dt;
      if (this._refreshT <= 0) { this._refreshT = 0.5; const k = JSON.stringify([this.W.money, this.entries(this.tab).map(e => [e.id, e.count, e.on])]); if (k !== this._lastK) { this._lastK = k; this.render(); } }
      return;
    }
    if (g.frozen() || g.prepActive) return;
    KEYS.forEach((k, i) => { if (I.pressed(k)) this.activate(i); });
  }
}
