/* Build.js - build mode (N), like a tycoon game: decorate the hideout.

   Press N inside the hideout (or the storage room). The mouse comes free,
   the camera floats up behind you, a panel slides up from the bottom:

     BUILD  - what you own, with counts. Click one: a see-through ghost follows
              the mouse with its footprint under it, blue where it fits, red
              where it doesn't. R turns it, click puts it down.
     SHOP   - order the everyday stuff (tables, chairs, plants, a TV...).
              The big pieces come from CASA CRUMB FURNITURE in the mall: carry
              the box home and unpack it (it lands in BUILD).
     PICK UP / SELL ITEMS - click something you placed to take it back / sell
              it for half. With neither on, clicking a placed thing moves it.

   Right-drag turns the camera, the wheel zooms, WASD still walks. N or Esc
   leaves. Everything placed is in W.build (the host decides, everyone sees
   it), stands in the way (colliders), and makes customers tip more (style). */
import * as THREE from '../../lib/three.module.js';
import { BUILD_ITEMS, BUILD_ITEM, BUILD_CATS, BUILD_ZONES, STYLE_CAP, SELL_BACK, zoneAt, footprint } from '../data/Build.js';
import { STATIONS } from '../data/Hideout.js';
import { HQ } from '../world/Town.js';
import { makeBuildModel, WALL_Y } from '../art/BuildArt.js';
import { Mesher } from '../art/Mesher.js';
import { money } from '../core/Util.js';

const Q = Math.PI / 2, GRID = 0.25;
const snap = v => Math.round(v / GRID) * GRID;
const floorY = fl => fl ? HQ.base.y + 0.06 : 0.08;

export class BuildMode {
  constructor(game) {
    this.g = game;
    this.active = false;
    this.tab = 'build'; this.cat = 'furniture'; this.mode = 'place';
    this.sel = null; this.moving = null; this.ry = 0;
    this.objs = new Map();               // id -> { group, col, sig }
    this.root = new THREE.Group(); game.scene.add(this.root);
    this.ray = new THREE.Raycaster();
    this._ui();
  }
  get B() { const W = this.g.W; return W.build || (W.build = { inv: {}, placed: [], seq: 1 }); }

  /* ================= state shared by everyone ================= */
  /** style points of everything placed: +1% tips each, capped */
  style() { return Math.min(STYLE_CAP, (this.g.W.build?.placed || []).reduce((s, p) => s + (BUILD_ITEM[p.key]?.style || 0), 0)); }
  owned(key) { return (this.B.inv[key] || 0) + this.B.placed.filter(p => p.key === key).length; }

  /** can this go here? { ok, why } */
  check(key, x, z, ry, fl, ignoreId) {
    const it = BUILD_ITEM[key]; if (!it) return { ok: false, why: '?' };
    const Z = zoneAt(x, z, fl); if (!Z) return { ok: false, why: 'Only inside your hideout' };
    if (Z.lvl > this.g.W.level) return { ok: false, why: 'Unlock the ' + Z.name.toLowerCase() + ' first (laptop)' };
    const [w, d] = footprint(it, ry), r = { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 };
    const hit = (a, b) => a.x0 < b.x1 - 0.02 && a.x1 > b.x0 + 0.02 && a.z0 < b.z1 - 0.02 && a.z1 > b.z0 + 0.02;
    const keep = [...Z.keep, ...this._extraKeep(Z)];
    if (it.wall) {
      const span = { x0: r.x0 - 0.05, x1: r.x1 + 0.05, z0: r.z0 - 0.05, z1: r.z1 + 0.05 };
      if (keep.some(k => hit(span, { x0: k[0], z0: k[1], x1: k[2], z1: k[3] }))) return { ok: false, why: 'Not over a doorway' };
      for (const s of STATIONS) if ((s.floor || 0) === fl && s.wall && hit(span, this._stRect(s, 0.3))) return { ok: false, why: 'Something is already on that wall' };
      for (const p of this.B.placed) if (p.id !== ignoreId && BUILD_ITEM[p.key]?.wall && p.fl === fl) { const [pw, pd] = footprint(BUILD_ITEM[p.key], p.ry); if (hit(span, { x0: p.x - pw / 2, x1: p.x + pw / 2, z0: p.z - pd / 2, z1: p.z + pd / 2 })) return { ok: false, why: 'There\'s already something on that wall' }; }
      return { ok: true };
    }
    if (r.x0 < Z.x0 + 0.05 || r.x1 > Z.x1 - 0.05 || r.z0 < Z.z0 + 0.05 || r.z1 > Z.z1 - 0.05) return { ok: false, why: 'Too close to the wall' };
    if (keep.some(k => hit(r, { x0: k[0], z0: k[1], x1: k[2], z1: k[3] }))) return { ok: false, why: 'Keep the way clear' };
    for (const s of STATIONS) if ((s.floor || 0) === fl && hit(r, this._stRect(s, s.wall ? 0.3 : 0.55))) return { ok: false, why: 'In the way of the ' + s.type.replace('trashcan', 'trash can').replace('trapdoor', 'trapdoor') };
    if (!it.h) return { ok: true };   // rugs go under things
    let bad = null;
    this.g.town.col.near(x, z, Math.max(w, d) + 0.5, c => {
      if (bad || c.floor !== fl || c.tag === 'build:' + ignoreId || (c.h || 0) < 0.25) return;
      const box = c.t === 'c' ? { x0: c.x - c.r * 0.8, x1: c.x + c.r * 0.8, z0: c.z - c.r * 0.8, z1: c.z + c.r * 0.8 } : { x0: c.minx, x1: c.maxx, z0: c.minz, z1: c.maxz };
      if (hit(r, box)) bad = c.tag && c.tag.startsWith('build:') ? 'Overlaps something you placed' : 'Something is in the way';
    });
    return bad ? { ok: false, why: bad } : { ok: true };
  }
  _stRect(s, pad) { const turn = Math.abs(Math.sin(s.ry)) > 0.5, w = turn ? s.d : s.w, d = turn ? s.w : s.d; return { x0: s.x - w / 2 - pad, x1: s.x + w / 2 + pad, z0: s.z - d / 2 - pad, z1: s.z + d / 2 + pad }; }
  _extraKeep(Z) {
    if (Z.id !== 'storage') return [];
    const T = this.g.town.poi, out = [];
    for (const [p, r] of [[T.storageExit, 1.6], [T.storageSafe, 1.2], [T.storageChair, 1.7], [T.storageIn, 1.3]]) if (p) out.push([p.x - r, p.z - r, p.x + r, p.z + r]);
    return out;
  }

  /** host: build actions */
  exec(pid, a) {
    const g = this.g, W = g.W, B = this.B, it = BUILD_ITEM[a.key] || BUILD_ITEM[B.placed.find(p => p.id === a.id)?.key];
    if (!it) return;
    const tell = t => g.tell(pid, t);
    if (a.op === 'buy') {
      if (it.store) return tell(it.label + ': only at CASA CRUMB FURNITURE (Crumb Mall). Carry the box home and unpack it.');
      if (W.money < it.price) return tell('You can\'t afford that (' + money(it.price) + ').');
      W.money -= it.price; W.stats.spent = (W.stats.spent || 0) + it.price; B.inv[it.key] = (B.inv[it.key] || 0) + 1; g.sfx('cash', null);
    } else if (a.op === 'place') {
      if (!(B.inv[it.key] > 0)) return;
      const c = this.check(it.key, a.x, a.z, a.ry, a.fl); if (!c.ok) return tell(c.why);
      B.inv[it.key]--; B.placed.push({ id: B.seq++, key: it.key, x: a.x, z: a.z, ry: a.ry, fl: a.fl });
      g.sfx('thud', null);
    } else if (a.op === 'move') {
      const p = B.placed.find(p => p.id === a.id); if (!p) return;
      const c = this.check(p.key, a.x, a.z, a.ry, a.fl, p.id); if (!c.ok) return tell(c.why);
      Object.assign(p, { x: a.x, z: a.z, ry: a.ry, fl: a.fl });
    } else if (a.op === 'pickup') {
      const i = B.placed.findIndex(p => p.id === a.id); if (i < 0) return;
      const [p] = B.placed.splice(i, 1); B.inv[p.key] = (B.inv[p.key] || 0) + 1;
    } else if (a.op === 'sell') {
      if (a.id != null) { const i = B.placed.findIndex(p => p.id === a.id); if (i < 0) return; B.placed.splice(i, 1); }
      else { if (!(B.inv[it.key] > 0)) return; B.inv[it.key]--; }
      const back = Math.round(it.price * SELL_BACK); W.money += back; g.sfx('cash', null);
      tell('Sold the ' + it.label + ' for ' + money(back) + '.');
    }
    g.dirty();
  }

  /** everyone: keep the placed things in the scene (and in the colliders) matching W.build */
  sync() {
    const W = this.g.W; if (!W) return;
    // old saves: furniture "placed" by the store went to fixed spots; now it waits in your build inventory
    if (this.g.isHost && W.decor?.length) { for (const k of W.decor) this.B.inv[k] = (this.B.inv[k] || 0) + 1; W.decor = []; this.g.dirty(); }
    const list = W.build?.placed || [], seen = new Set();
    for (const p of list) {
      seen.add(p.id);
      const sig = p.key + p.x + ',' + p.z + ',' + p.ry + ',' + p.fl;
      const o = this.objs.get(p.id);
      if (o && o.sig === sig) continue;
      if (o) this._drop(p.id);
      this._add(p, sig);
    }
    for (const id of [...this.objs.keys()]) if (!seen.has(id)) this._drop(id);
  }
  _add(p, sig) {
    const it = BUILD_ITEM[p.key]; if (!it) return;
    const model = makeBuildModel(p.key); model.updateMatrixWorld(true);
    // one merged mesh per piece; signs, glass and glowing bits stay real meshes
    const m = new Mesher(0.02), grp = new THREE.Group();
    model.traverse(o => {
      if (!o.isMesh) return;
      const mt = o.material, special = mt.map || mt.transparent || (mt.emissive && mt.emissive.getHex() && mt.emissiveIntensity > 0.3);
      if (special) { const c = new THREE.Mesh(o.geometry, mt); o.matrixWorld.decompose(c.position, c.quaternion, c.scale); grp.add(c); }
      else if (mt.color) m.add(o.geometry, o.matrixWorld, '#' + mt.color.getHexString(), 0.02);
    });
    grp.add(m.build());
    grp.position.set(p.x, floorY(p.fl) + (it.wall ? WALL_Y[p.key] || 1.4 : 0), p.z); grp.rotation.y = p.ry;
    grp.userData.id = p.id;
    this.root.add(grp);
    let col = null;
    if (it.h && !it.wall) { const [w, d] = footprint(it, p.ry); col = this.g.town.col.boxc(p.x, p.z, w - 0.08, d - 0.08, { h: it.h, floor: p.fl, tag: 'build:' + p.id }); }
    this.objs.set(p.id, { group: grp, col, sig });
  }
  _drop(id) { const o = this.objs.get(id); if (!o) return; this.root.remove(o.group); if (o.col) o.col.on = false; this.objs.delete(id); }

  /* ================= local: the mode itself ================= */
  canEnter() {
    const g = this.g, P = g.player;
    const Z = zoneAt(P.pos.x, P.pos.z, P.floor);
    if (!Z) return 'Build mode works inside your hideout (and the storage room).';
    if (Z.lvl > g.W.level) return 'The ' + Z.name.toLowerCase() + ' opens at hideout level ' + Z.lvl + ' (laptop).';
    if (P.car) return 'Get out of the car first.';
    return null;
  }
  enter() {
    const g = this.g, why = this.canEnter();
    if (why) { g.ui.toast(why); return false; }
    this.active = true; this.mode = 'place'; this.sel = null; this.moving = null;
    this._camMode = g.cam.mode; g.cam.mode = 'third'; g.cam.pitch = Math.max(g.cam.pitch, 0.85); g.cam.dist = 9;
    g.input.unlock();
    this.el.classList.add('on'); this.render();
    return true;
  }
  exit() {
    const g = this.g;
    this.active = false; this._cancel();
    g.cam.mode = this._camMode || g.cam.mode; g.cam.snap = true;
    this.el.classList.remove('on');
    g.input.lock();
  }
  /** called every frame (before the game reads keys) */
  update(dt) {
    const g = this.g, I = g.input, P = g.player;
    this.sync();
    const inZone = g.phase === 'play' && !P.car && zoneAt(P.pos.x, P.pos.z, P.floor);
    this.hint.style.display = !this.active && inZone && !g.frozen() && g.W.quest >= 3 ? 'block' : 'none';
    if (!this.active) {
      if (g.phase === 'play' && !g.frozen() && I.pressed('KeyN')) { I.down.delete('KeyN'); this.enter(); }
      return;
    }
    if (g.phase !== 'play' || g.frozen() || !zoneAt(P.pos.x, P.pos.z, P.floor)) { this.exit(); return; }
    // Esc drops what you are holding first, then leaves; N always leaves
    if (I.pressedRaw('KeyN')) { I.down.delete('KeyN'); this.exit(); return; }
    if (I.pressedRaw('Escape')) { I.down.delete('Escape'); if (this.sel) this._cancel(); else this.exit(); return; }
    if (I.pressedRaw('KeyR')) { this.ry = (this.ry + Q) % (Math.PI * 2); I.down.delete('KeyR'); }
    // right-drag turns the camera; a right click without a drag cancels
    const mx = I.mouse.x, my = I.mouse.y;
    if (I.mouse.clicked.has(2)) { this._rd = { x: mx, y: my, moved: 0 }; }
    if (this._rd && I.mouse.buttons.has(2)) {
      const dx = mx - (this._lx ?? mx), dy = my - (this._ly ?? my);
      P.camYaw -= dx * 0.006; g.cam.pitch = Math.max(0.35, Math.min(1.35, g.cam.pitch + dy * 0.004));
      this._rd.moved += Math.abs(dx) + Math.abs(dy);
    }
    if (this._rd && I.mouse.released.has(2)) { if (this._rd.moved < 5) this._cancel(); this._rd = null; }
    this._lx = mx; this._ly = my;
    I.mouse.clicked.delete(2);
    // what is under the mouse
    const fl = P.floor, y = floorY(fl);
    const ndc = new THREE.Vector2(mx / innerWidth * 2 - 1, -(my / innerHeight) * 2 + 1);
    this.ray.setFromCamera(ndc, g.camera);
    const hitP = new THREE.Vector3(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
    const onFloor = this.ray.ray.intersectPlane(plane, hitP);
    const overUI = this._overUI;
    const click = I.mouse.clicked.has(0) && !overUI; I.mouse.clicked.delete(0);
    if (this.sel) {
      const it = BUILD_ITEM[this.sel];
      let x = onFloor ? snap(hitP.x) : P.pos.x, z = onFloor ? snap(hitP.z) : P.pos.z, ry = this.ry;
      if (it.wall && onFloor) ({ x, z, ry } = this._wallSnap(it, hitP, fl));
      const c = onFloor ? this.check(this.sel, x, z, ry, fl, this.moving) : { ok: false, why: '' };
      this._ghost(this.sel, x, z, ry, fl, c.ok);
      this.status.textContent = c.ok ? (this.moving ? 'Click to move it here' : 'Click to place · R to turn') : (c.why || '');
      this.status.className = 'bstatus ' + (c.ok ? 'ok' : 'bad');
      if (click && c.ok) {
        if (this.moving != null) { g.act({ k: 'build', op: 'move', id: this.moving, x, z, ry, fl }); this._cancel(); }
        else {
          g.act({ k: 'build', op: 'place', key: this.sel, x, z, ry, fl });
          g.audio?.thud?.({ x, z });
          if ((this.B.inv[this.sel] || 0) <= 1) this._cancel();   // that was the last one
          setTimeout(() => this.render(), 50);
        }
      }
    } else {
      // hovering what you placed: pick up / sell / move
      const pick = this._pick();
      this._hover(pick);
      this.status.textContent = pick ? (this.mode === 'sell' ? 'Click: sell the ' + BUILD_ITEM[pick.key].label + ' for ' + money(Math.round(BUILD_ITEM[pick.key].price * SELL_BACK)) : this.mode === 'pickup' ? 'Click: pick up the ' + BUILD_ITEM[pick.key].label : 'Click: move the ' + BUILD_ITEM[pick.key].label) : this.mode === 'sell' ? 'SELL: click something you placed' : this.mode === 'pickup' ? 'PICK UP: click something you placed' : 'Pick something from the panel - or click a placed item to move it';
      this.status.className = 'bstatus';
      if (click && pick) {
        if (this.mode === 'sell') g.act({ k: 'build', op: 'sell', id: pick.id });
        else if (this.mode === 'pickup') g.act({ k: 'build', op: 'pickup', id: pick.id });
        else { this.sel = pick.key; this.moving = pick.id; this.ry = pick.ry; const o = this.objs.get(pick.id); if (o) o.group.visible = false; }
        setTimeout(() => this.render(), 50);
      }
    }
    this.styleEl.textContent = 'STYLE +' + this.style() + '% tips (max ' + STYLE_CAP + ')';
    if (this._invSig !== JSON.stringify(this.B.inv) + g.W.money) { this._invSig = JSON.stringify(this.B.inv) + g.W.money; this.render(); }
  }
  _wallSnap(it, p, fl) {
    const Z = zoneAt(p.x, p.z, fl) || BUILD_ZONES.find(z => z.floor === fl && p.x > z.x0 - 1 && p.x < z.x1 + 1 && p.z > z.z0 - 1 && p.z < z.z1 + 1);
    if (!Z) return { x: snap(p.x), z: snap(p.z), ry: 0 };
    const opts = [[p.x - Z.x0, 'w'], [Z.x1 - p.x, 'e'], [p.z - Z.z0, 'n'], [Z.z1 - p.z, 's']].sort((a, b) => a[0] - b[0]);
    const side = opts[0][1], hw = it.size[0] / 2;
    const cl = (v, a, b) => Math.max(a + hw + 0.1, Math.min(b - hw - 0.1, snap(v)));
    if (side === 'w') return { x: Z.x0 + 0.06, z: cl(p.z, Z.z0, Z.z1), ry: Q };
    if (side === 'e') return { x: Z.x1 - 0.06, z: cl(p.z, Z.z0, Z.z1), ry: -Q };
    if (side === 'n') return { x: cl(p.x, Z.x0, Z.x1), z: Z.z0 + 0.06, ry: 0 };
    return { x: cl(p.x, Z.x0, Z.x1), z: Z.z1 - 0.06, ry: Math.PI };
  }
  _pick() {
    const hits = this.ray.intersectObjects(this.root.children, true);
    for (const h of hits) { let o = h.object; while (o && o.userData.id == null) o = o.parent; if (o) { const p = this.B.placed.find(p => p.id === o.userData.id); if (p) return p; } }
    return null;
  }
  _cancel() {
    if (this.moving != null) { const o = this.objs.get(this.moving); if (o) o.group.visible = true; }
    this.sel = null; this.moving = null;
    if (this.ghost) { this.g.scene.remove(this.ghost.group); this.ghost = null; }
    this._hover(null);
    this.render();
  }
  /** the see-through ghost and its footprint, blue when it fits, red when it doesn't */
  _ghost(key, x, z, ry, fl, ok) {
    const it = BUILD_ITEM[key];
    if (!this.ghost || this.ghost.key !== key) {
      if (this.ghost) this.g.scene.remove(this.ghost.group);
      const group = new THREE.Group(), model = makeBuildModel(key);
      model.traverse(o => { if (o.isMesh) { const m = o.material; o.material = new THREE.MeshStandardMaterial({ color: m.color || '#ffffff', map: m.map || null, transparent: true, opacity: 0.6, depthWrite: false, emissive: new THREE.Color('#2a6aff'), emissiveIntensity: 0.25, flatShading: true }); o.castShadow = false; } });
      const foot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#5ad8ff', transparent: true, opacity: 0.45, depthWrite: false }));
      foot.rotation.x = -Math.PI / 2;
      group.add(model, foot);
      this.g.scene.add(group);
      this.ghost = { key, group, model, foot };
    }
    const G = this.ghost, [w, d] = footprint(it, ry);
    G.model.position.set(x, floorY(fl) + (it.wall ? WALL_Y[key] || 1.4 : 0), z); G.model.rotation.y = ry;
    G.foot.position.set(x, floorY(fl) + 0.03, z); G.foot.scale.set(it.wall ? w : w, it.wall ? 0.3 : d, 1);
    if (it.wall) { G.foot.position.x += Math.sin(ry) * 0.15; G.foot.position.z += Math.cos(ry) * 0.15; }
    G.foot.material.color.set(ok ? '#5ad8ff' : '#ff4a5a');
    G.model.traverse(o => { if (o.isMesh) o.material.emissive.set(ok ? '#2a6aff' : '#ff2030'); });
  }
  _hover(p) {
    if (!this.hov) { this.hov = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.45, depthWrite: false })); this.hov.rotation.x = -Math.PI / 2; this.g.scene.add(this.hov); }
    this.hov.visible = !!p;
    if (!p) return;
    const it = BUILD_ITEM[p.key], [w, d] = footprint(it, p.ry);
    this.hov.position.set(p.x, floorY(p.fl) + 0.04, p.z); this.hov.scale.set(w + 0.1, it.wall ? 0.4 : d + 0.1, 1);
    this.hov.material.color.set(this.mode === 'sell' ? '#ff4a5a' : this.mode === 'pickup' ? '#ffd23f' : '#5ad8ff');
  }

  /* ================= the panel ================= */
  _ui() {
    const css = document.createElement('style');
    css.textContent = `
#buildui{position:fixed;left:0;right:0;bottom:0;z-index:25;display:none;flex-direction:column;align-items:center;pointer-events:none;font-family:"Luckiest Guy",Impact,sans-serif}
#buildui.on{display:flex}
#buildui button{font-family:inherit}
#buildui .btop{display:flex;gap:10px;margin-bottom:8px;pointer-events:auto}
#buildui .bbig{width:92px;height:70px;border-radius:12px;border:3px solid #0e4a8a;background:linear-gradient(#5ac8ff,#1e88e5);color:#fff;font-size:15px;letter-spacing:.5px;text-shadow:0 2px 0 #0e3a6a,1px 1px 0 #0e3a6a,-1px -1px 0 #0e3a6a;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;box-shadow:0 4px 0 #0e3a6a}
#buildui .bbig .ic{font-size:26px;line-height:1}
#buildui .bbig.sel{background:linear-gradient(#ffe066,#f2b600);border-color:#8a6a00;box-shadow:0 4px 0 #6a5000}
#buildui .bpanel{width:min(1240px,96vw);background:#eef8ff;border:4px solid #1e88e5;border-radius:16px 16px 0 0;padding:10px 12px 12px;pointer-events:auto;box-shadow:0 -4px 24px rgba(0,0,0,.25)}
#buildui .brow{display:flex;gap:8px;align-items:center;margin-bottom:10px}
#buildui .btab{min-width:150px;padding:8px 14px;border-radius:10px;border:3px solid #9aa4b0;background:linear-gradient(#e8ecf0,#c8ced6);color:#fff;font-size:17px;text-shadow:1px 1px 0 #6a7480,-1px -1px 0 #6a7480,1px -1px 0 #6a7480,-1px 1px 0 #6a7480;cursor:pointer}
#buildui .btab.sel{background:linear-gradient(#5ac8ff,#1e88e5);border-color:#0e4a8a;text-shadow:1px 1px 0 #0e3a6a,-1px -1px 0 #0e3a6a,1px -1px 0 #0e3a6a,-1px 1px 0 #0e3a6a}
#buildui .bsp{flex:1}
#buildui .bsell{background:linear-gradient(#7ae86a,#3fb84a);border-color:#2a7a2a;text-shadow:1px 1px 0 #1a5a1a,-1px -1px 0 #1a5a1a,1px -1px 0 #1a5a1a,-1px 1px 0 #1a5a1a}
#buildui .bsell.sel{background:linear-gradient(#ffe066,#f2b600);border-color:#8a6a00}
#buildui .bx{width:44px;height:44px;border-radius:10px;border:3px solid #8a1a2a;background:linear-gradient(#ff6a7a,#d6232a);color:#fff;font-size:22px;cursor:pointer;text-shadow:1px 1px 0 #6a0a1a}
#buildui .btiles{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;min-height:100px}
#buildui .tile{position:relative;flex:0 0 84px;height:94px;border-radius:10px;border:3px solid #1e88e5;background:#fff;cursor:pointer;overflow:hidden}
#buildui .tile:hover{transform:translateY(-3px);border-color:#ffb800}
#buildui .tile.sel{border-color:#ffb800;background:#fff6d0}
#buildui .tile.off{opacity:.55}
#buildui .tile img{position:absolute;left:4px;right:4px;top:14px;width:76px;height:70px;object-fit:contain}
#buildui .tile .nm{position:absolute;left:3px;top:2px;right:3px;font-size:11px;line-height:11px;color:#fff;text-shadow:1px 1px 0 #1a3a6a,-1px -1px 0 #1a3a6a,1px -1px 0 #1a3a6a,-1px 1px 0 #1a3a6a;z-index:2}
#buildui .tile .ct{position:absolute;right:4px;bottom:2px;font-size:14px;color:#ffd23f;text-shadow:1px 1px 0 #2a1640,-1px -1px 0 #2a1640,1px -1px 0 #2a1640,-1px 1px 0 #2a1640;z-index:2}
#buildui .tile .pr{position:absolute;left:0;right:0;bottom:0;background:#43a85a;color:#fff;font-size:12px;text-align:center;z-index:2}
#buildui .tile .pr.store{background:#2a2238;color:#ffe9c8;font-size:9px;padding:1px 0}
#buildui .bempty{color:#5a6a80;font-family:Nunito,sans-serif;font-weight:700;padding:30px 10px}
#buildui .bstatus{position:fixed;left:50%;top:84px;transform:translateX(-50%);padding:6px 16px;border-radius:10px;background:rgba(20,16,30,.8);color:#fff;font-size:18px;pointer-events:none;white-space:nowrap}
#buildui .bstatus.ok{color:#7ae8ff}#buildui .bstatus.bad{color:#ff7a8a}
#buildui .bstyle{position:fixed;left:50%;top:124px;transform:translateX(-50%);color:#ffd23f;font-size:15px;text-shadow:1px 1px 0 #2a1640,-1px -1px 0 #2a1640;pointer-events:none}
#buildui .bkeys{color:#5a6a80;font-family:Nunito,sans-serif;font-weight:700;font-size:12px;margin-top:6px;text-align:center}
#buildhint{position:fixed;right:18px;bottom:96px;z-index:20;display:none;padding:8px 14px;border-radius:12px;border:3px solid #0e4a8a;background:linear-gradient(#5ac8ff,#1e88e5);color:#fff;font-family:"Luckiest Guy",Impact,sans-serif;font-size:16px;text-shadow:1px 1px 0 #0e3a6a;pointer-events:none}`;
    document.head.appendChild(css);
    const el = this.el = document.createElement('div'); el.id = 'buildui';
    el.innerHTML = `<div class="bstatus"></div><div class="bstyle"></div>
      <div class="btop"><button class="bbig" data-tab="build"><span class="ic">🔨</span>Build</button><button class="bbig" data-tab="shop"><span class="ic">🏪</span>Shop</button></div>
      <div class="bpanel"><div class="brow"><span class="bcats"></span><span class="bsp"></span><button class="btab bsell" data-mode="sell">Sell Items</button><button class="btab" data-mode="pickup">Pick Up</button><button class="bx" data-close="1">✕</button></div>
      <div class="btiles"></div><div class="bkeys">Click a tile, then click the floor · R turn · right-drag: look · wheel: zoom · WASD: walk · N / Esc: done</div></div>`;
    document.body.appendChild(el);
    this.status = el.querySelector('.bstatus'); this.styleEl = el.querySelector('.bstyle'); this.tiles = el.querySelector('.btiles'); this.cats = el.querySelector('.bcats');
    const hint = this.hint = document.createElement('div'); hint.id = 'buildhint'; hint.textContent = '🔨 N: BUILD'; document.body.appendChild(hint);
    el.addEventListener('mouseover', e => { this._overUI = !!e.target.closest('.bpanel,.btop'); });
    el.addEventListener('mouseout', () => { this._overUI = false; });
    el.addEventListener('mousedown', e => e.stopPropagation());
    el.addEventListener('click', e => {
      const b = e.target.closest('button,.tile'); if (!b) return;
      if (b.dataset.close) return this.exit();
      if (b.dataset.tab) { this.tab = b.dataset.tab; this.mode = 'place'; this._cancel(); return; }
      if (b.dataset.cat) { this.cat = b.dataset.cat; return this.render(); }
      if (b.dataset.mode) { this.mode = this.mode === b.dataset.mode ? 'place' : b.dataset.mode; this._cancel(); return; }
      if (b.dataset.key) this.tileClick(b.dataset.key);
    });
  }
  tileClick(key) {
    const g = this.g, it = BUILD_ITEM[key];
    if (this.tab === 'shop') {
      if (it.store) return g.ui.toast(it.label + ': only at CASA CRUMB FURNITURE in the Crumb Mall. Carry the box home and unpack it.');
      g.act({ k: 'build', op: 'buy', key }); setTimeout(() => this.render(), 60); return;
    }
    if (this.mode === 'sell') { g.act({ k: 'build', op: 'sell', key }); setTimeout(() => this.render(), 60); return; }
    if (!(this.B.inv[key] > 0)) return;
    this.mode = 'place'; this._cancel(); this.sel = key; this.ry = 0; this.render();
  }
  render() {
    if (!this.el) return;
    const icons = this.g.inv?.icons, B = this.B;
    for (const b of this.el.querySelectorAll('.bbig')) b.classList.toggle('sel', b.dataset.tab === this.tab);
    this.cats.innerHTML = BUILD_CATS.map(([k, n]) => `<button class="btab${k === this.cat ? ' sel' : ''}" data-cat="${k}">${n}</button>`).join(' ');
    for (const b of this.el.querySelectorAll('[data-mode]')) { b.classList.toggle('sel', b.dataset.mode === this.mode); b.style.display = this.tab === 'build' ? '' : 'none'; }
    const items = BUILD_ITEMS.filter(i => i.cat === this.cat && (this.tab === 'shop' || B.inv[i.key] > 0));
    if (!items.length) { this.tiles.innerHTML = `<div class="bempty">${this.tab === 'build' ? 'Nothing here yet. Order things in the SHOP tab, or buy the fancy pieces at Casa Crumb Furniture (Crumb Mall) and unpack the box here.' : ''}</div>`; return; }
    this.tiles.innerHTML = items.map(i => {
      const img = icons ? icons.get('build:' + i.key, () => makeBuildModel(i.key)) : '';
      const foot = this.tab === 'shop' ? (i.store ? '<div class="pr store">CASA CRUMB</div>' : `<div class="pr">${money(i.price)}</div>`) : `<div class="ct">x${B.inv[i.key]}</div>`;
      return `<div class="tile${this.sel === i.key ? ' sel' : ''}${this.tab === 'shop' && (i.store || this.g.W.money < i.price) ? ' off' : ''}" data-key="${i.key}" title="${i.label}: ${i.desc} (+${i.style}% tips)"><div class="nm">${i.label}</div>${img ? `<img src="${img}">` : ''}${foot}</div>`;
    }).join('');
  }
}
