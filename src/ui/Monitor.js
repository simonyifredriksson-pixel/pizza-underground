/* Monitor.js - the security monitor (K, or the screen in the hideout).

   Live feeds from your cameras, and recordings: whenever a camera sees an
   intruder it saves a few seconds before and after. A recording is a list
   of where everybody was (5 times a second); the monitor puts stand-in
   characters at those spots and renders the town from the camera's point
   of view - grainy, grey, timestamped. Scrub, rewind, play it slow, and
   save the good ones as evidence for the police. */
import * as THREE from '../../lib/three.module.js';
import { makeChar } from '../art/Chars.js';
import { lookFor } from '../game/Player.js';
import { GANGS } from '../data/Rivals.js';
import { esc } from '../core/Util.js';

const SVG = {
  play: '<path d="M7 4v16l13-8z"/>',
  pause: '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>',
  back: '<path d="M11 6v12L3 12zM20 6v12l-8-6z"/>',
  fwd: '<path d="M13 6v12l8-6zM4 6v12l8-6z"/>',
  star: '<path d="M12 2.6l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 16.8l-5.8 3.3 1.4-6.4-4.9-4.4 6.5-.7z"/>',
  cam: '<path d="M3 7h12v10H3zM15 10l6-3v10l-6-3z"/>',
};
const icon = (k) => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${SVG[k]}</svg>`;
const clock = (t) => { const s = Math.floor(22 * 3600 + t) % 86400; const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return [h, m, x].map(n => String(n).padStart(2, '0')).join(':'); };

export class Monitor {
  constructor(game) {
    this.g = game;
    this.isOpen = false;
    this.sel = null;           // { live: camId } | { rec: id }
    this.t = 0; this.playing = true; this.speed = 1;
    this.cam = new THREE.PerspectiveCamera(72, 16 / 9, 0.1, 400);
    this.rt = null;
    this.rigs = new Map();
    const el = document.createElement('div'); el.id = 'monitor'; document.body.appendChild(el); this.el = el;
    el.innerHTML = `
      <div class="mon-box">
        <div class="mon-head"><b>SECURITY</b><span class="mon-sub"></span><button class="mon-x">Close (K)</button></div>
        <div class="mon-body">
          <div class="mon-list"></div>
          <div class="mon-main">
            <div class="mon-screen">
              <canvas class="mon-view" width="480" height="270"></canvas>
              <canvas class="mon-grain" width="160" height="90"></canvas>
              <div class="mon-lines"></div>
              <div class="mon-o tl"></div><div class="mon-o tr"><span class="mon-rec"></span><span class="mon-rect">REC</span></div>
              <div class="mon-o bl"></div><div class="mon-o br"></div>
              <div class="mon-off">NO SIGNAL</div>
            </div>
            <div class="mon-ctrl">
              <button data-c="back" title="Back 1s">${icon('back')}</button>
              <button data-c="play" class="mon-play">${icon('pause')}</button>
              <button data-c="fwd" title="Forward 1s">${icon('fwd')}</button>
              <input class="mon-scrub" type="range" min="0" max="1000" value="0">
              <button data-c="speed" class="mon-speed">1x</button>
              <button data-c="save" class="mon-save">${icon('star')}<span>Save as evidence</span></button>
            </div>
            <div class="mon-note"></div>
          </div>
        </div>
      </div>`;
    this.view = el.querySelector('.mon-view'); this.grain = el.querySelector('.mon-grain');
    el.querySelector('.mon-x').onclick = () => this.close();
    el.querySelector('.mon-list').onclick = (e) => { const b = e.target.closest('[data-s]'); if (!b) return; const [t, v] = b.dataset.s.split(':'); this.select(t === 'live' ? { live: v } : { rec: +v }); };
    el.querySelector('.mon-ctrl').onclick = (e) => { const b = e.target.closest('[data-c]'); if (b) this.control(b.dataset.c); };
    el.querySelector('.mon-scrub').oninput = (e) => { const r = this.recording(); if (r) { this.t = (+e.target.value / 1000) * this.length(r); this.playing = false; this._ctrls(); } };
    el.addEventListener('mousedown', e => e.stopPropagation());
  }
  get W() { return this.g.W; }
  get open_() { return this.isOpen; }
  cams() { return this.g.rivals.hqCams(); }
  recording() { return this.sel && this.sel.rec != null ? (this.W.footage || []).find(f => f.id === this.sel.rec) : null; }
  length(r) { return Math.max(0.2, r.frames[r.frames.length - 1][0] - r.frames[0][0]); }

  open() {
    const g = this.g;
    if (g.phase !== 'play' || g.cam.override) return;
    g.ui.closeMenu(); g.inv?.close();
    this.isOpen = true; this.el.classList.add('on'); g.input.unlock();
    const recs = this.W.footage || [];
    if (!this.sel || (this.sel.rec != null && !this.recording())) this.select(recs.length ? { rec: recs[recs.length - 1].id } : { live: this.cams()[0]?.id });
    this._list();
    g.audio.tone(700, 0.05, 'square', 0.05);
  }
  close() { if (!this.isOpen) return; this.isOpen = false; this.el.classList.remove('on'); this.g.audio.tone(500, 0.05, 'square', 0.04); }
  select(s) { this.sel = s; this.t = 0; this.playing = true; this._list(); this._ctrls(); }
  control(c) {
    const r = this.recording();
    if (c === 'play') { if (r && this.t >= this.length(r) - 0.05) this.t = 0; this.playing = !this.playing; }
    if (c === 'back' && r) { this.t = Math.max(0, this.t - 1); }
    if (c === 'fwd' && r) { this.t = Math.min(this.length(r), this.t + 1); }
    if (c === 'speed') this.speed = this.speed === 1 ? 0.5 : this.speed === 0.5 ? 2 : 1;
    if (c === 'save' && r) { if (!r.culprit) this.g.ui.toast('Nobody suspicious in this one. The police want a face. (Or at least a hat.)'); else { this.g.act({ k: 'rv', op: 'save', id: r.id }); setTimeout(() => this._list(), 80); } }
    this._ctrls();
  }
  _ctrls() {
    const r = this.recording(), el = this.el;
    el.querySelector('.mon-play').innerHTML = icon(this.playing ? 'pause' : 'play');
    el.querySelector('.mon-speed').textContent = this.speed + 'x';
    el.querySelectorAll('.mon-ctrl button, .mon-scrub').forEach(b => { b.disabled = !r && b.dataset.c !== 'speed'; });
    const sv = el.querySelector('.mon-save');
    sv.classList.toggle('saved', !!r?.saved); sv.querySelector('span').textContent = r?.saved ? (r.reported ? 'Handed in' : 'Saved as evidence') : 'Save as evidence';
    el.querySelector('.mon-note').textContent = r ? (r.culprit ? (r.photo ? 'A photo of ' + GANGS[r.culprit].name + '\'s secret kitchen.' : 'Somebody from ' + GANGS[r.culprit].name + ' is in this one.') + (r.saved && !r.reported ? ' Take it to the police station front desk.' : '') : 'Just your crew, being your crew.') : 'LIVE. Recordings start by themselves when a camera sees an intruder.';
  }
  _list() {
    const W = this.W, el = this.el.querySelector('.mon-list'), now = W.time;
    const recs = [...(W.footage || [])].reverse();
    const ago = (t) => { const s = Math.max(0, Math.round(now - t)); return s < 60 ? s + 's ago' : Math.floor(s / 60) + 'm ago'; };
    el.innerHTML = '<div class="mon-h">LIVE</div>' + this.cams().map(c => `<div class="mon-it ${this.sel?.live === c.id ? 'on' : ''}" data-s="live:${c.id}">${icon('cam')}<span>${esc(c.name)}</span>${this.g.rivals.R.hqOff[c.id] ? '<i class="off">OFFLINE</i>' : '<i class="live">LIVE</i>'}</div>`).join('')
      + '<div class="mon-h">RECORDINGS</div>' + (recs.length ? recs.map(f => `<div class="mon-it ${this.sel?.rec === f.id ? 'on' : ''}" data-s="rec:${f.id}"><b>#${f.id}</b><span>${esc(f.cam.name)}<small>${ago(f.t)}${f.culprit ? ' · ' + esc(GANGS[f.culprit].short) : ''}</small></span>${f.saved ? `<i class="sv">${icon('star')}</i>` : ''}</div>`).join('') : '<div class="mon-empty">Nothing recorded yet.</div>');
    this.el.querySelector('.mon-sub').textContent = this.cams().length + ' cameras · ' + recs.length + ' recordings';
  }

  /* ---------------- every frame while open ---------------- */
  update(dt) {
    const g = this.g;
    if (!this.isOpen) return;
    if (g.phase !== 'play') return this.close();
    const I = g.input;
    if (I.pressedRaw('KeyK') || I.pressedRaw('Escape')) return this.close();
    if (I.pressedRaw('Space')) this.control('play');
    if (I.pressedRaw('ArrowLeft')) this.control('back');
    if (I.pressedRaw('ArrowRight')) this.control('fwd');
    this._lt = (this._lt || 0) - dt; if (this._lt <= 0) { this._lt = 1; this._list(); }
    const r = this.recording();
    let camData, place = 'THE HIDEOUT', when;
    if (r) {
      const L = this.length(r);
      if (this.playing) { this.t += dt * this.speed; if (this.t >= L) { this.t = L; this.playing = false; this._ctrls(); } }
      this.el.querySelector('.mon-scrub').value = String(Math.round(this.t / L * 1000));
      camData = r.cam; when = r.frames[0][0] + this.t; place = r.photo ? 'A DEAD PIZZERIA' : 'THE HIDEOUT';
    } else {
      camData = this.cams().find(c => c.id === this.sel?.live) || this.cams()[0];
      when = this.W.time;
    }
    const off = !r && camData && this.g.rivals.R.hqOff[camData.id];
    this.el.querySelector('.mon-off').style.display = !camData || off ? '' : 'none';
    this.el.querySelector('.mon-rec').style.visibility = Math.sin(performance.now() * 0.008) > 0 ? 'visible' : 'hidden';
    this.el.querySelector('.mon-rect').textContent = r ? (r.photo ? 'PHOTO' : 'PLAYBACK') : 'LIVE';
    this.el.querySelector('.tl').textContent = camData ? camData.name : '';
    this.el.querySelector('.bl').textContent = 'DAY ' + (1 + Math.floor((22 * 3600 + when) / 86400)) + '  ' + clock(when);
    this.el.querySelector('.br').textContent = place + (r ? '  #' + r.id : '');
    this._grain();
    if (camData && !off) this._render(camData, r);
  }
  _grain() {
    const c = this.grain.getContext('2d'), img = c.createImageData(160, 90), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    c.putImageData(img, 0, 0);
  }
  /** a stand-in for somebody in a recording */
  _rig(key, look) {
    let r = this.rigs.get(key);
    if (!r || r.look !== look) {
      if (r) this.g.scene.remove(r.rig.root);
      let o;
      if (look.startsWith('p:')) { const [, l, w] = look.split(':'); o = lookFor(+l, w || null); }
      else { const k = look.split(':')[1]; o = { ...(GANGS[k]?.crew || {}), glasses: 'sun', hat: look.startsWith('c:') ? 'beanie' : 'fedora', hatColor: '#1b1b24', shirt: '#1b1b24', sleeve: '#1b1b24' }; }
      r = { rig: makeChar(o), look }; r.rig.root.visible = false; this.g.scene.add(r.rig.root); this.rigs.set(key, r);
    }
    return r;
  }
  _render(c, rec) {
    const g = this.g, R = g.renderer;
    if (!this.rt) { this.rt = new THREE.WebGLRenderTarget(480, 270, { samples: 2 }); this.rt.texture.colorSpace = THREE.SRGBColorSpace; }
    const cam = this.cam;
    cam.position.set(c.x, c.y, c.z);
    cam.lookAt(c.x + Math.sin(c.yaw) * Math.cos(c.pitch), c.y - Math.sin(c.pitch), c.z + Math.cos(c.yaw) * Math.cos(c.pitch));
    const hidden = [];
    const used = new Set();
    // the camera can't see its own body
    for (const m of g.rivals.camModels.values()) if (m.visible && Math.hypot(m.position.x - c.x, m.position.z - c.z) < 1.5) { m.visible = false; hidden.push(m); }
    if (rec) {
      // hide the live people; put the recorded ones where they were
      const hide = (o) => { if (o && o.visible) { o.visible = false; hidden.push(o); } };
      hide(g.player.rig.root);
      for (const r of g.remotes.values()) hide(r.rig.root);
      for (const r of g.rivals.rigs.values()) hide(r.rig.root);
      const F = rec.frames, t = F[0][0] + this.t;
      let i = 0; while (i < F.length - 2 && F[i + 1][0] <= t) i++;
      const a = F[i], b = F[i + 1] || a, k = b[0] > a[0] ? Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))) : 0;
      for (const e of a[1]) {
        const n = b[1].find(x => x[0] === e[0]) || e;
        const r = this._rig(e[0], e[1]); used.add(e[0]);
        const x = e[2] + (n[2] - e[2]) * k, z = e[3] + (n[3] - e[3]) * k, sp = Math.hypot(n[2] - e[2], n[3] - e[3]) / Math.max(0.05, b[0] - a[0]);
        r.rig.root.position.set(x, 0.05, z); r.rig.root.rotation.y = e[4];
        r.rig.anim(0.016, { speed: sp, carry: e[5] === 1 || e[5] === 2, panic: e[0] === 'cook' ? 0 : 0 });
        r.rig.root.visible = true;
      }
    }
    g.inv.icons.draw(g.scene, cam, this.rt, this.view);
    for (const [key, r] of this.rigs) r.rig.root.visible = false;
    for (const o of hidden) o.visible = true;
  }
}
