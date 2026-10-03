/* MapView.js - the town map (M). The streets and buildings are drawn once
   from the colliders; players, orders, suppliers and (with cameras) cops
   are drawn live on top. */
import { ROADS, RW, EXT, HQ, STREET_EW, STREET_NS } from '../world/Town.js';
import { SUPPLIERS } from '../data/Data.js';
import { Q } from '../data/Story.js';

const SIZE = 640, R = 232;
const px = v => (v + R) / (2 * R) * SIZE;

export class MapView {
  constructor(game) { this.g = game; this.open = false; this.bg = null; }

  _bg() {
    const c = document.createElement('canvas'); c.width = c.height = SIZE;
    const x = c.getContext('2d');
    x.fillStyle = '#9ad08a'; x.fillRect(0, 0, SIZE, SIZE);
    x.fillStyle = '#6fae6a'; x.fillRect(0, 0, SIZE, px(-130)); x.fillRect(0, px(205), SIZE, SIZE); x.fillRect(0, 0, px(-205), SIZE); x.fillRect(px(205), 0, SIZE, SIZE);
    x.fillStyle = '#efb8d6'; x.fillRect(px(-31), px(-31), px(31) - px(-31), px(31) - px(-31));
    x.fillStyle = '#a6dc92'; x.fillRect(px(-31), px(129), px(31) - px(-31), px(191) - px(129));
    x.fillStyle = '#5b4f7a';
    for (const r of ROADS) { x.fillRect(px(r - RW / 2), px(-EXT), px(r + RW / 2) - px(r - RW / 2), px(EXT) - px(-EXT)); x.fillRect(px(-EXT), px(r - RW / 2), px(EXT) - px(-EXT), px(r + RW / 2) - px(r - RW / 2)); }
    for (const b of this.g.town.col.all) {
      if (b.t !== 'b' || b.h < 3 || b.maxx - b.minx > 60 || b.floor) continue;
      x.fillStyle = b.tag === 'hq' ? '#ff8fc8' : '#d9cdee';
      x.fillRect(px(b.minx), px(b.minz), Math.max(1, px(b.maxx) - px(b.minx)), Math.max(1, px(b.maxz) - px(b.minz)));
    }
    for (const b of this.g.town.interiors || []) { x.fillStyle = '#d9cdee'; x.fillRect(px(b.cx - b.w / 2), px(b.cz - b.d / 2), px(b.cx + b.w / 2) - px(b.cx - b.w / 2), px(b.cz + b.d / 2) - px(b.cz - b.d / 2)); }
    x.fillStyle = '#ff8fc8'; x.fillRect(px(HQ.x0), px(HQ.z0), px(HQ.x1) - px(HQ.x0), px(HQ.z1) - px(HQ.z0));
    x.font = 'bold 10px Nunito, sans-serif'; x.fillStyle = '#2a1640'; x.textAlign = 'center';
    const lbl = (t, a, b) => { x.fillStyle = 'rgba(255,255,255,0.75)'; const w = x.measureText(t).width + 6; x.fillRect(px(a) - w / 2, px(b) - 7, w, 13); x.fillStyle = '#2a1640'; x.fillText(t, px(a), px(b) + 3); };
    const T = this.g.town.poi;
    lbl('CITY HALL', 0, -84); lbl('HOSPITAL', -80, 2); lbl('POLICE', 80, -2); lbl('TOWN SQUARE', 0, -14); lbl('GAS', 98, -64); lbl("HANK'S CARS", 100, -102);
    lbl("OLEG'S", -103, -56); lbl('MUSTACHE', -80, -56); lbl('DEAD PIZZERIAS', 0, 58); lbl('PARK', 0, 172); lbl('JUNKYARD', 160, 148); lbl('MAYOR', -160, -86);
    lbl('FACTORY', 162, -2); lbl('RADIO TOWER', 100, -178); lbl('FOREST', -120, -170); lbl('HIDEOUT', 152, 66);
    x.save(); x.font = '9px Nunito, sans-serif'; x.fillStyle = '#ffffff';
    for (const r of ROADS) { x.fillText(STREET_EW[r], px(-170), px(r) + 3); x.save(); x.translate(px(r) + 3, px(-150)); x.rotate(-Math.PI / 2); x.fillText(STREET_NS[r], 0, 0); x.restore(); }
    x.restore();
    return c;
  }

  show(focus) {
    const g = this.g;
    if (!this.bg) this.bg = this._bg();
    g.ui.menu({ title: 'Crumbville', cls: 'map', html: '<canvas id="mapcv" width="' + SIZE + '" height="' + SIZE + '"></canvas><div class="maplegend"><i style="background:#ffd23f"></i>you <i style="background:#43e07a"></i>orders <i style="background:#ff8fc8"></i>hideout <i style="background:#ff9f1a"></i>suppliers <i style="background:#fff"></i>story <i style="background:#3a7bd5"></i>cops (cameras)</div>', items: [], onClose: () => { this.open = false; } });
    this.open = true; this.focus = focus;
    this.draw();
  }

  draw() {
    const cv = document.getElementById('mapcv'); if (!cv) { this.open = false; return; }
    const x = cv.getContext('2d'), g = this.g, W = g.W, P = g.player, T = g.town.poi;
    x.drawImage(this.bg, 0, 0);
    const dot = (a, b, col, r = 5, label) => { x.fillStyle = col; x.strokeStyle = '#2a1640'; x.lineWidth = 2; x.beginPath(); x.arc(px(a), px(b), r, 0, 7); x.fill(); x.stroke(); if (label) { x.font = 'bold 11px Nunito, sans-serif'; x.fillStyle = '#2a1640'; x.textAlign = 'left'; x.fillText(label, px(a) + r + 3, px(b) + 4); } };
    // suppliers you have met the need for
    if (W.quest >= Q.TOWN) for (const [k, s] of Object.entries(SUPPLIERS)) { const p = k === 'cheese' && W.event?.k === 'cheeseMissing' && !W.event.found ? null : T[s.poi]; if (p) dot(p.x, p.z, '#ff9f1a', 4, s.name); }
    if (W.quest >= Q.TOWN) { dot(T.oleg.x, T.oleg.z, '#8fc1e3', 4, 'Oleg (ovens)'); dot(T.mustache.x, T.mustache.z, '#f7a8c8', 4, 'Disguises'); dot(T.hank.x, T.hank.z, '#ffcf33', 4, 'Cars'); }
    for (const d of W.debts || []) { const a = g.debts.at(d); dot(a.x, a.z, d.state === 'seized' ? '#8a8aa0' : ['late', 'overdue'].includes(d.state) ? '#ff3a3a' : '#ffd23f', 6, '$ ' + d.name); }
    if (W.rival) dot(W.rival.x, W.rival.z, '#ff6b6b', 7, 'Calzone Cartel');
    if (W.kn) dot(W.kn.x, W.kn.z, '#ff9f1a', 5, 'Knuckles');
    for (const o of W.orders) if (o.state === 'open') { const a = g.orders.at(o); dot(a.x, a.z, o === this.focus ? '#ffffff' : '#43e07a', o === this.focus ? 8 : 6, o.name); }
    for (const m of g.story.markers()) { x.fillStyle = '#ffffff'; x.font = 'bold 22px "Luckiest Guy", sans-serif'; x.textAlign = 'center'; x.strokeStyle = '#2a1640'; x.lineWidth = 4; x.strokeText('★', px(m.x), px(m.z) + 8); x.fillText('★', px(m.x), px(m.z) + 8); x.font = 'bold 11px Nunito'; x.lineWidth = 3; x.strokeText(m.label, px(m.x), px(m.z) - 12); x.fillText(m.label, px(m.x), px(m.z) - 12); }
    if (W.owned.up.camera) { for (const c of g.police.cops) dot(c.x, c.z, '#3a7bd5', 3); for (const c of g.police.cars) dot(c.x, c.z, '#3a7bd5', 5); }
    for (const c of W.cars) dot(c.x, c.z, '#c9a8f0', 4);
    for (const r of g.remotes.values()) if (r.s) dot(r.pos.x, r.pos.z, '#ffffff', 5, r.name);
    // you: an arrow
    const ax = px(P.car ? g.vehicles.car(P.car)?.x ?? P.pos.x : P.pos.x), az = px(P.car ? g.vehicles.car(P.car)?.z ?? P.pos.z : P.pos.z), yaw = P.yaw;
    x.save(); x.translate(ax, az); x.rotate(-yaw + Math.PI); x.fillStyle = '#ffd23f'; x.strokeStyle = '#2a1640'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, -10); x.lineTo(7, 8); x.lineTo(0, 4); x.lineTo(-7, 8); x.closePath(); x.fill(); x.stroke(); x.restore();
  }
}
