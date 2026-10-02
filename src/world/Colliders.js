/* Colliders.js - the town is flat, so collision is 2D: axis-aligned boxes
   and circles on the ground plane, bucketed in a grid. Each has a `floor`
   (0 street, 1 the secret basement) and a height, so the camera can tell
   whether it is inside a wall. */

const CELL = 10;

export class Colliders {
  constructor() { this.grid = new Map(); this.all = []; this._q = 0; }
  _key(i, j) { return i * 10007 + j; }
  _insert(c) {
    this.all.push(c);
    const i0 = Math.floor(c.minx / CELL), i1 = Math.floor(c.maxx / CELL);
    const j0 = Math.floor(c.minz / CELL), j1 = Math.floor(c.maxz / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = this._key(i, j); let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(c);
    }
    return c;
  }
  box(minx, minz, maxx, maxz, o = {}) {
    if (minx > maxx) [minx, maxx] = [maxx, minx];
    if (minz > maxz) [minz, maxz] = [maxz, minz];
    return this._insert({ t: 'b', minx, minz, maxx, maxz, h: o.h ?? 8, y0: o.y0 ?? 0, floor: o.floor || 0, tag: o.tag, on: true });
  }
  /** box by centre and size, rotated by 0 / 90 degrees only */
  boxc(x, z, w, d, o) { return this.box(x - w / 2, z - d / 2, x + w / 2, z + d / 2, o); }
  circle(x, z, r, o = {}) { return this._insert({ t: 'c', x, z, r, minx: x - r, maxx: x + r, minz: z - r, maxz: z + r, h: o.h ?? 4, y0: 0, floor: o.floor || 0, tag: o.tag, on: true }); }

  near(x, z, r, fn) {
    this._q++;
    const i0 = Math.floor((x - r) / CELL), i1 = Math.floor((x + r) / CELL);
    const j0 = Math.floor((z - r) / CELL), j1 = Math.floor((z + r) / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const a = this.grid.get(this._key(i, j)); if (!a) continue;
      for (const c of a) { if (c._q === this._q) continue; c._q = this._q; if (c.on) fn(c); }
    }
  }

  /** push a circle (x,z,r) out of everything on its floor; returns {x,z,hit} */
  resolve(x, z, r, floor = 0, y = 0) {
    let hit = false;
    for (let pass = 0; pass < 2; pass++) {
      this.near(x, z, r + 1, c => {
        if (c.floor !== floor || y > c.y0 + c.h - 0.3 || y + 1.6 < c.y0) return;
        if (c.t === 'c') {
          const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), m = r + c.r;
          if (d < m && d > 1e-4) { x = c.x + dx / d * m; z = c.z + dz / d * m; hit = true; }
        } else {
          const cx = Math.max(c.minx, Math.min(x, c.maxx)), cz = Math.max(c.minz, Math.min(z, c.maxz));
          const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
          if (d2 < r * r) {
            hit = true;
            if (d2 > 1e-8) { const d = Math.sqrt(d2); x = cx + dx / d * r; z = cz + dz / d * r; }
            else { // centre inside the box: leave by the nearest side
              const l = x - c.minx, rr = c.maxx - x, t = z - c.minz, b = c.maxz - z, m = Math.min(l, rr, t, b);
              if (m === l) x = c.minx - r; else if (m === rr) x = c.maxx + r; else if (m === t) z = c.minz - r; else z = c.maxz + r;
            }
          }
        }
      });
    }
    return { x, z, hit };
  }

  /** is a point inside something solid (used by the camera and for spawning) */
  solidAt(x, z, y, floor = 0, pad = 0) {
    let s = false;
    this.near(x, z, pad + 0.5, c => {
      if (s || c.floor !== floor || y > c.y0 + c.h || y < c.y0 - 0.5) return;
      if (c.t === 'c') { if (Math.hypot(x - c.x, z - c.z) < c.r + pad) s = true; }
      else if (x > c.minx - pad && x < c.maxx + pad && z > c.minz - pad && z < c.maxz + pad) s = true;
    });
    return s;
  }

  /** line of sight on the ground plane at eye height */
  blocked(ax, az, bx, bz, floor = 0, y = 1.5) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 1.0);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.solidAt(ax + (bx - ax) * t, az + (bz - az) * t, y, floor)) return true;
    }
    return false;
  }
}
