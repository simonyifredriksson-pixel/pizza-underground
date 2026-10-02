/* UI.js - every piece of DOM: the HUD, dialogue, menus, the phone, the map.
   The game never touches the DOM directly; it calls these. */
import * as THREE from '../../lib/three.module.js';
import { esc, money, clamp } from '../core/Util.js';
import { SPEAKERS } from '../data/Story.js';
import { filter } from '../data/Data.js';

const $ = id => document.getElementById(id);

export class UI {
  constructor(game) {
    this.g = game;
    this.talking = null;
    this.dlg = null;
    this.menuOpen = null;
    this.bubbles = [];
    this.moneyShown = 0;
    this.toasts = $('toasts');
    this._tick = 0;
    this.bars = [];
    this.barEls = [];
  }
  bleep(t) { return filter(t, this.g.profile.bleep); }

  /* ---------------- HUD ---------------- */
  hud(dt) {
    const g = this.g, W = g.W;
    // money counts up
    const d = W.money - this.moneyShown;
    this.moneyShown += Math.abs(d) < 2 ? d : d * Math.min(1, dt * 6);
    $('money').textContent = money(this.moneyShown);
    $('money').classList.toggle('up', d > 2);
    const h = clamp(W.heat, 0, 100);
    $('heatfill').style.width = h + '%';
    $('heatfill').style.background = h < 30 ? '#43e07a' : h < 60 ? '#ffd23f' : h < 80 ? '#ff9f1a' : '#ff3a3a';
    $('heatlabel').textContent = h < 20 ? 'Nobody cares' : h < 40 ? 'Strange smells reported' : h < 60 ? 'Illegal food suspected' : h < 80 ? 'Police investigating' : 'BIGGEST RUMOR IN TOWN';
    $('lvl').textContent = 'HQ LEVEL ' + W.level + ' · ' + W.rep + ' delivered';
    const open = W.orders.filter(o => o.state === 'open').length, nw = W.orders.filter(o => o.state === 'new').length;
    $('phonebadge').textContent = nw ? nw + ' NEW ORDER' + (nw > 1 ? 'S' : '') + ' [TAB]' : open ? open + ' open order' + (open > 1 ? 's' : '') + ' [TAB]' : '';
    $('phonebadge').classList.toggle('ring', nw > 0);
    $('phonebadge').style.display = W.quest >= 10 && (nw || open) ? '' : 'none';
    // status: being watched / chased
    const st = $('status');
    if (g.police.chasingMe) { st.textContent = 'CHASED! Lose them: break line of sight, hide in a dumpster (E)'; st.className = 'chase'; }
    else if (g.police.mySus > 0.15) { st.textContent = 'A cop is getting suspicious...'; st.className = 'sus'; }
    else st.className = 'off';
    // the event banner countdown
    const ev = W.event;
    const b = $('banner');
    if (ev && ev.show) { b.classList.add('on'); $('bannertxt').textContent = ev.show; $('bannersub').textContent = (ev.sub || '') + (ev.t != null && ev.count ? '  ' + Math.max(0, Math.ceil(ev.t)) + 's' : ''); }
    else b.classList.remove('on');
    const law = W.law;
    $('law').style.display = law ? '' : 'none';
    if (law) $('law').textContent = 'NEW LAW: ' + this.bleep(law.name) + ' (' + Math.ceil(law.t) + 's)';
    // world bars (oven timers, hold progress)
    this._bars();
    this._bubbles(dt);
  }

  objective(text, sub) {
    $('objtxt').textContent = text || '';
    $('objsub').textContent = sub || '';
    $('obj').style.display = text ? '' : 'none';
  }

  prompt(t) {
    const el = $('prompt');
    if (!t) { el.style.display = 'none'; $('holdring').style.display = 'none'; return; }
    el.style.display = '';
    const keys = (t.key ? `<b class="key">${t.key}</b>` : '');
    const alt = t.alt ? `<span class="alt"><b class="key">R</b>${esc(t.alt.label)}</span>` : '';
    el.className = t.warn ? 'warn' : t.info ? 'info' : '';
    el.innerHTML = (t.info || t.warn ? '' : keys) + esc(this.bleep(t.label)) + (t.hold ? ' <i>(hold)</i>' : '') + alt;
    const r = $('holdring');
    if (t.progress > 0) { r.style.display = ''; r.style.setProperty('--p', Math.round(t.progress * 100)); }
    else r.style.display = 'none';
  }

  prepKeys(it, stock) {
    const el = $('prepkeys');
    if (!it) { el.style.display = 'none'; return; }
    el.style.display = '';
    const names = [['1', 'Sauce', 'sauce'], ['2', 'Cheese', 'cheese'], ['3', 'Pepperoni', 'pepperoni'], ['4', 'Mushroom', 'mushroom'], ['5', 'Pineapple', 'pineapple'], ['6', 'Olives', 'olive'], ['7', 'Peppers', 'pepper']];
    el.innerHTML = '<div class="pk-title">ADD TO THE PIZZA</div>' + names.map(([k, n, s]) => {
      const on = s === 'sauce' ? it.sauce : s === 'cheese' ? it.cheese : (it.top || []).includes(s);
      return `<div class="pk ${stock[s] > 0 ? '' : 'out'} ${on ? 'on' : ''}"><b class="key">${k}</b>${n}${s === 'cheese' && it.cheese ? ' x' + it.cheese : ''}<span>${stock[s]}</span></div>`;
    }).join('');
  }

  held(items) {
    const el = $('held');
    if (!items.length) { el.style.display = 'none'; return; }
    el.style.display = '';
    const { pizzaName } = this.g.kitchenNames;
    const top = items[items.length - 1];
    el.innerHTML = `<div class="h-top">${esc(pizzaName(top))}</div>` + (items.length > 1 ? `<div class="h-n">+ ${items.length - 1} more under it</div>` : '') + `<div class="h-help"><b class="key">Q</b> throw away top</div>` + (top.k === 'ext' ? `<div class="h-help"><b class="key">LMB</b> spray</div>` : '');
  }

  toast(text, kind = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + kind; el.textContent = this.bleep(text);
    this.toasts.appendChild(el);
    while (this.toasts.children.length > 5) this.toasts.children[0].remove();
    setTimeout(() => el.classList.add('out'), 4200);
    setTimeout(() => el.remove(), 4800);
  }

  news(text) {
    const el = $('ticker');
    el.innerHTML = `<b>CRUMB NEWS</b><span>${esc(this.bleep(text))}</span>`;
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    clearTimeout(this._newsT); this._newsT = setTimeout(() => el.classList.remove('on'), 9000);
  }

  alarm(text) {
    const el = $('alarm');
    el.textContent = this.bleep(text);
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  }

  /* ---------------- speech bubbles over heads ---------------- */
  bubble(obj, text, color) {
    const el = document.createElement('div');
    el.className = 'bubble'; el.textContent = this.bleep(text);
    if (color) el.style.borderColor = color;
    $('floaters').appendChild(el);
    this.bubbles = this.bubbles.filter(b => { if (b.obj === obj) { b.el.remove(); return false; } return true; });
    this.bubbles.push({ el, obj, t: 0, life: 2.2 + text.length * 0.045 });
  }
  _bubbles(dt) {
    const cam = this.g.camera, v = new THREE.Vector3();
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.t += dt;
      if (b.t > b.life) { b.el.remove(); this.bubbles.splice(i, 1); continue; }
      const p = typeof b.obj === 'function' ? b.obj() : b.obj;
      if (!p) { b.el.style.display = 'none'; continue; }
      v.set(p.x, (p.y || 0) + 2.7, p.z).project(cam);
      const far = Math.hypot(p.x - cam.position.x, p.z - cam.position.z) > 45;
      if (v.z > 1 || far) { b.el.style.display = 'none'; continue; }
      b.el.style.display = '';
      b.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth}px, ${(-v.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -100%)`;
      b.el.style.opacity = String(Math.min(1, (b.life - b.t) * 3));
    }
  }

  /** progress bars over ovens etc. bars = [{x,y,z,p,color,label}] */
  setBars(bars) { this.bars = bars; }
  _bars() {
    const cam = this.g.camera, v = new THREE.Vector3(), root = $('floaters');
    while (this.barEls.length < this.bars.length) { const e = document.createElement('div'); e.className = 'wbar'; e.innerHTML = '<i></i><span></span>'; root.appendChild(e); this.barEls.push(e); }
    this.barEls.forEach((e, i) => {
      const b = this.bars[i];
      if (!b) { e.style.display = 'none'; return; }
      v.set(b.x, b.y, b.z).project(cam);
      if (v.z > 1) { e.style.display = 'none'; return; }
      e.style.display = '';
      e.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth}px, ${(-v.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -50%)`;
      e.firstChild.style.width = Math.min(100, b.p * 100) + '%';
      e.firstChild.style.background = b.color;
      e.lastChild.textContent = b.label || '';
      e.classList.toggle('blink', !!b.blink);
    });
  }

  /* ---------------- dialogue ---------------- */
  /** lines: [[who, text], ...]. Resolves when the last line is dismissed. */
  dialog(lines, o = {}) {
    return new Promise(res => {
      if (this.dlg) this.dlg.res();
      const el = $('dialog');
      el.classList.add('on');
      const D = { lines, i: -1, res: () => { this.dlg = null; this.talking = null; el.classList.remove('on'); res(); }, typed: 0, full: '', t: 0 };
      this.dlg = D;
      this._next();
    });
  }
  _next() {
    const D = this.dlg; if (!D) return;
    D.i++;
    if (D.i >= D.lines.length) { D.res(); return; }
    const [who, text] = D.lines[D.i];
    const sp = SPEAKERS[who] || { name: who, color: '#ffffff' };
    const name = who === 'you' ? this.g.profile.name : sp.name;
    $('dname').textContent = name; $('dname').style.color = sp.color;
    $('dname').style.display = name ? '' : 'none';
    D.full = this.bleep(text); D.typed = 0; D.t = 0;
    $('dtext').textContent = '';
    $('dialog').classList.toggle('narr', who === 'narr');
    this.talking = who;
    this.g.onLine && this.g.onLine(who, text);
  }
  dialogUpdate(dt, advance) {
    const D = this.dlg; if (!D) return;
    D.t += dt;
    if (D.typed < D.full.length) {
      const before = Math.floor(D.typed);
      D.typed = Math.min(D.full.length, D.typed + dt * 55);
      if (Math.floor(D.typed / 6) !== Math.floor(before / 6)) this.g.audio.babble(this.talking === 'you' ? 1.3 : this.talking === 'man' ? 0.7 : 1);
      $('dtext').textContent = D.full.slice(0, Math.floor(D.typed));
      if (advance) { D.typed = D.full.length; $('dtext').textContent = D.full; }
    } else {
      this.talking = D.t < 0.6 + D.full.length * 0.018 ? this.talking : null;
      $('dmore').style.opacity = String(0.5 + Math.sin(D.t * 6) * 0.5);
      if (advance || (D.auto && D.t > 1.4 + D.full.length * 0.03)) this._next();
    }
  }
  get inDialog() { return !!this.dlg; }

  /* ---------------- menus ---------------- */
  /** items: [{label, sub, price, disabled, on: fn, keep: bool}] */
  menu(o) {
    this.closeMenu();
    const el = $('panel');
    el.className = 'on ' + (o.cls || '');
    const rows = o.items.map((it, i) => `<button class="mi ${it.disabled ? 'dis' : ''} ${it.owned ? 'owned' : ''}" data-i="${i}"><b class="key">${i < 9 ? i + 1 : ''}</b><span class="ml">${esc(this.bleep(it.label))}${it.sub ? `<small>${esc(this.bleep(it.sub))}</small>` : ''}</span>${it.price != null ? `<span class="mp">${typeof it.price === 'number' ? money(it.price) : esc(it.price)}</span>` : ''}</button>`).join('');
    el.innerHTML = `<div class="pbox"><div class="ptitle">${esc(o.title)}</div>${o.sub ? `<div class="psub">${esc(this.bleep(o.sub))}</div>` : ''}${o.html || ''}<div class="plist">${rows}</div><div class="pfoot"><b class="key">ESC</b> close</div></div>`;
    this.menuOpen = o;
    el.querySelectorAll('.mi').forEach(b => b.addEventListener('click', () => this._pick(+b.dataset.i)));
    this.g.input.unlock();
  }
  _pick(i) {
    const o = this.menuOpen; if (!o) return;
    const it = o.items[i]; if (!it || it.disabled) { this.g.audio.deny(); return; }
    this.g.audio.click();
    if (!it.keep) this.closeMenu();
    it.on && it.on();
  }
  menuKey(code) {
    if (!this.menuOpen) return false;
    if (code === 'Escape' || (code === 'Tab' && this.menuOpen.cls === 'phone') || (code === 'KeyM' && this.menuOpen.cls === 'map')) { this.closeMenu(); return true; }
    const m = /^Digit(\d)$/.exec(code);
    if (m && +m[1] >= 1) { this._pick(+m[1] - 1); return true; }
    return true;
  }
  closeMenu() {
    if (!this.menuOpen) return;
    const o = this.menuOpen; this.menuOpen = null;
    $('panel').className = ''; $('panel').innerHTML = '';
    o.onClose && o.onClose();
  }
  /** a plain readable card (clues, stock) */
  card(title, body, cls = '') {
    this.menu({ title, html: `<div class="card ${cls}">${esc(this.bleep(body)).replace(/\n/g, '<br>')}</div>`, items: [{ label: 'Close' }] });
  }

  /** a subtitle line that needs no button press (cutscenes) */
  sub(who, text) {
    const el = $('sub');
    if (!who) { el.classList.remove('on'); this.subWho = null; return; }
    const sp = SPEAKERS[who] || { name: who, color: '#fff' };
    el.innerHTML = `<b style="color:${sp.color}">${esc(who === 'you' ? this.g.profile.name : sp.name)}</b> ${esc(this.bleep(text))}`;
    el.classList.add('on'); this.subWho = who;
  }

  /* ---------------- cinematic ---------------- */
  fade(on, text = '', sub = '') {
    const f = $('fade');
    f.classList.toggle('on', on);
    $('fadetxt').textContent = text; $('fadesub').textContent = sub;
  }
  cinema(on) { document.body.classList.toggle('cinema', on); }
  flash() { const f = $('flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
  hudVisible(on) { $('hud').style.display = on ? '' : 'none'; }
}
