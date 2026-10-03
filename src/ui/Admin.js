/* Admin.js - the owner's panel. It opens only after the exact key sequence
   J, L, O, 3 - typed in order, quickly, with nothing in between. Pressing
   those keys normally does nothing special. Only the host (or the solo
   player) is an administrator: the host owns the world, and every admin
   action runs on the host. A client who types the sequence is told no. */
import { VEHICLES, GROCERY, LAWS } from '../data/Data.js';
import { HQ } from '../world/Town.js';
import { money, esc } from '../core/Util.js';

const SEQ = ['KeyJ', 'KeyL', 'KeyO', 'Digit3'];

export class Admin {
  constructor(game) {
    this.g = game; this.buf = []; this.open = false; this.tab = 'economy';
    addEventListener('keydown', e => this._key(e), true);
  }
  _key(e) {
    if (e.repeat) return;
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const now = performance.now();
    this.buf.push({ c: e.code, t: now });
    this.buf = this.buf.slice(-4);
    if (this.buf.length === 4 && this.buf.every((b, i) => b.c === SEQ[i]) && now - this.buf[0].t < 2500) {
      this.buf = [];
      this.toggle();
    }
  }
  get authorized() { return this.g.isHost; }

  toggle() {
    const g = this.g;
    if (this.open) return this.close();
    if (!this.authorized) { g.ui.toast('Admin panel: only the host can use it.', 'bad'); return; }
    if (g.phase !== 'play') { g.ui.toast('Admin panel: start a game first.'); return; }
    this.open = true; g.input.unlock(); g.input.blocked = true;
    this.render();
  }
  close() { this.open = false; const el = document.getElementById('admin'); if (el) el.remove(); this.g.input.blocked = false; }

  /** every admin button runs here, on the host */
  run(op, arg) {
    const g = this.g, W = g.W, P = g.player, T = g.town.poi;
    const me = g.me;
    switch (op) {
      case 'give': W.money += arg; break;
      case 'take': W.money = Math.max(0, W.money - arg); break;
      case 'set': W.money = Math.max(0, arg | 0); break;
      case 'inspect': W.insp = null; W.inspCool = 0; g.inspections.start('ADMIN: a test inspection.'); break;
      case 'inspectNow': if (!W.insp) g.inspections.start('ADMIN'); W.insp.t = 0.1; break;
      case 'heat': g.addHeat(arg); break;
      case 'heatReset': W.heat = 0; W.tips = 0; break;
      case 'tips': g.inspections.tip(arg); break;
      case 'refuse': {
        // a real order, right now: the phone rings, a pin goes up, and at the door they won't pay
        const o = g.orders.spawn({ accepted: true, refuse: true });
        g.tell(null, o.name + ' ordered a pizza (pin over the door, TAB for details). They seem... shifty.');
        break;
      }
      case 'payDebt': { const d = (W.debts || []).find(d => d.state !== 'seized') || (W.debts || [])[0]; if (d) g.debts.pay(me, d); else g.ui.toast('Nobody owes you anything.'); break; }
      case 'order': g.orders.spawn({ accepted: true }); break;
      case 'bigOrder': g.orders.spawn({ big: true, accepted: true }); break;
      case 'richOrder': { const o = g.orders.spawn({ accepted: true }); o.rich = true; o.name = 'The Duke of Crust'; o.pay *= 6; break; }
      case 'tp': { const p = arg; P.teleport(p.x, p.z, p.floor || 0); g.cam.snap = true; break; }
      case 'tpPlayer': g.broadcastEvent({ k: 'tp', pid: arg, x: P.pos.x + 1.5, z: P.pos.z, floor: P.floor }); break;
      case 'goto': { const r = g.remotes.get(arg); if (r && r.s) { P.teleport(r.s.x + 1.5, r.s.z, r.s.f | 0); g.cam.snap = true; } break; }
      case 'car': W.cars.push({ id: W.carSeq++, kind: arg, x: P.pos.x + Math.sin(P.yaw) * 6, z: P.pos.z + Math.cos(P.yaw) * 6, yaw: P.yaw, drv: null, pas: [], cargo: [] }); break;
      case 'item': {
        const H = g.hold(me);
        if (arg === 'box') H.push({ k: 'box', sauce: 1, cheese: 1, top: ['pepperoni'], cook: 1 });
        if (arg === 'crate') H.push({ k: 'crate', s: 'cheese', n: 10 });
        if (arg === 'ext') H.push({ k: 'ext', from: 'ext1' });
        if (arg === 'stock') for (const k in W.stock) W.stock[k] += 20;
        if (arg === 'smoke') { W.inv = W.inv || {}; (W.inv[me] ||= { smoke: 0 }).smoke += 3; }
        break;
      }
      case 'event': g.events.start(arg); break;
      case 'storm': W.weather = W.weather ? null : { k: 'storm', t: 300 }; break;
      case 'resetEvent': W.event = null; W.insp = null; W.shutdown = 0; W.law = null; g.police.cops = g.police.cops.filter(c => c.kind !== 'officer' && c.kind !== 'insp'); g.police.cars = g.police.cars.filter(c => c.st !== 'parked'); break;
      case 'level': W.level = Math.min(5, W.level + 1); break;
      case 'quest': W.quest = Math.min(13, W.quest + 1); break;
      case 'rep': g.debts.addRep(arg); break;
    }
    g.dirty();
    this.render();
  }

  render() {
    const g = this.g, W = g.W;
    let el = document.getElementById('admin');
    if (!el) { el = document.createElement('div'); el.id = 'admin'; document.body.appendChild(el); }
    const tabs = { economy: 'Economy', police: 'Police', customers: 'Customers', world: 'World', testing: 'Testing' };
    const btn = (label, op, arg, cls = '') => `<button class="ab ${cls}" data-op="${op}" data-arg='${esc(JSON.stringify(arg ?? null))}'>${esc(label)}</button>`;
    const T = g.town.poi;
    let body = '';
    if (this.tab === 'economy') body = `
      <div class="arow"><b>Money</b> ${money(W.money)} <span class="adim">· safe ${money(W.safe || 0)}</span></div>
      <div class="agrid">${btn('+ $1,000', 'give', 1000)}${btn('+ $10,000', 'give', 10000)}${btn('+ $100,000', 'give', 100000)}${btn('+ $1,000,000', 'give', 1000000)}${btn('- $1,000', 'take', 1000, 'red')}${btn('- $10,000', 'take', 10000, 'red')}${btn('Remove all money', 'set', 0, 'red')}</div>
      <div class="arow"><input id="aset" type="number" placeholder="Set money to..."> ${btn('Set', 'setInput')}</div>
      <div class="arow"><b>Business</b> HQ level ${W.level} · Mafia rep ${Math.round(W.mrep || 0)}</div>
      <div class="agrid">${btn('HQ level +1', 'level')}${btn('Mafia rep +10', 'rep', 10)}${btn('Fill the stock (+20 each)', 'item', 'stock')}${btn('Next story step', 'quest')}</div>`;
    if (this.tab === 'police') body = `
      <div class="arow"><b>Heat</b> ${Math.round(W.heat)} · <b>Tips</b> ${Math.round(W.tips || 0)} · ${W.insp ? '<span class="ared">INSPECTION: ' + W.insp.ph + '</span>' : 'no inspection'} ${W.shutdown > 0 ? '· <span class="ared">SHUT DOWN ' + Math.ceil(W.shutdown) + 's</span>' : ''}</div>
      <div class="agrid">${btn('Trigger police inspection', 'inspect', null, 'red')}${btn('Inspectors arrive NOW', 'inspectNow', null, 'red')}${btn('Heat +20', 'heat', 20)}${btn('Heat +50', 'heat', 50)}${btn('Police tips +15', 'tips', 15)}${btn('Reset police attention', 'heatReset', null, 'green')}</div>`;
    if (this.tab === 'customers') body = `
      <div class="arow"><b>Orders</b> ${W.orders.length} · <b>Debts</b> ${(W.debts || []).length}</div>
      <div class="agrid">${btn('New order that refuses to pay', 'refuse')}${btn('A debtor pays immediately', 'payDebt', null, 'green')}${btn('New order', 'order')}${btn('Special: 12-pizza order', 'bigOrder')}${btn('Special: rich customer', 'richOrder')}</div>`;
    if (this.tab === 'world') {
      const spots = { 'Hideout': { x: HQ.door.x - 2, z: HQ.door.z }, 'Inside the hideout': { x: 146, z: 80 }, 'Crumb Mall': T.mall, 'Town square': { x: 0, z: 12 }, 'City Hall': T.cityHallDoor, 'Police station': T.policeDoor, 'Hospital': T.hospitalDoor, 'Suspicious Man': T.manSpot, 'Storage room': T.storageIn, 'Junkyard': { x: 160, z: 132 }, 'Park': { x: 0, z: 150 } };
      body = `<div class="arow"><b>Teleport me</b></div><div class="agrid">${Object.entries(spots).map(([n, p]) => btn(n, 'tp', { x: p.x, z: p.z })).join('')}</div>
      <div class="arow"><b>Players</b></div><div class="agrid">${[...g.remotes.values()].map(r => btn('Bring ' + r.name + ' to me', 'tpPlayer', r.id) + btn('Go to ' + r.name, 'goto', r.id)).join('') || '<span class="adim">Nobody else is here.</span>'}</div>
      <div class="arow"><b>Spawn a vehicle in front of me</b></div><div class="agrid">${Object.entries(VEHICLES).map(([k, v]) => btn(v.name, 'car', k)).join('')}</div>
      <div class="arow"><b>Give me</b></div><div class="agrid">${btn('A boxed pizza', 'item', 'box')}${btn('A crate of cheese', 'item', 'crate')}${btn('An extinguisher', 'item', 'ext')}${btn('3 smoke bombs', 'item', 'smoke')}</div>`;
    }
    if (this.tab === 'testing') body = `
      <div class="arow"><b>Current event</b> ${W.event ? esc(W.event.k) : 'none'} · <b>Weather</b> ${W.weather ? 'storm' : 'clear'}</div>
      <div class="agrid">${['supplierVan', 'rushHour', 'bigOrder', 'ovenFire', 'tow', 'shortage', 'informant', 'posted', 'law', 'checkpoint', 'copOutside', 'cheeseMissing', 'dezSold', 'raccoon'].map(k => btn(k, 'event', k)).join('')}</div>
      <div class="agrid">${btn(W.weather ? 'Stop the storm' : 'Start a storm', 'storm')}${btn('Test inspection', 'inspect', null, 'red')}${btn('Reset current event', 'resetEvent', null, 'green')}</div>`;
    el.innerHTML = `<div class="abox"><div class="ahead"><b>ADMIN</b><span class="adim">owner tools · host only · J L O 3 to close</span><button class="ax" data-op="close">✕</button></div>
      <div class="atabs">${Object.entries(tabs).map(([k, n]) => `<button class="at ${k === this.tab ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}</div><div class="abody">${body}</div></div>`;
    el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { this.tab = b.dataset.tab; this.render(); });
    el.querySelectorAll('[data-op]').forEach(b => b.onclick = () => {
      const op = b.dataset.op;
      if (op === 'close') return this.close();
      if (op === 'setInput') return this.run('set', +document.getElementById('aset').value || 0);
      this.run(op, JSON.parse(b.dataset.arg));
    });
  }
}
