/* Interiors.js - furniture for every building you can walk into.

   Rooms are described in a little frame of their own: u runs along the
   front wall (0 = the door), v runs inward from the front wall (0) to the
   back wall (2B). So a sofa "against the back wall, left of centre" is the
   same code whichever way the building faces. Everything is poured into
   the town's static meshes; big pieces get colliders so you bump into them. */

const WOOD = '#a8743a', WOOD2 = '#8a5a33', DARK = '#3a3048', STEEL = '#c8ccd8', WHITE = '#f6f1e6';
const PRODUCTS = ['#d6232a', '#3a7bd5', '#ffd23f', '#43e07a', '#ff8fc8', '#ff9f1a', '#8a4ac8', '#ffffff'];

export function furnish(T, kind, F) {
  const { cx, cz, A, B, m, rand } = F;
  const [fx, fz] = F.f, ax = -fz, az = fx, ns = fz !== 0;
  const D = 2 * B;
  const P = (u, v) => ({ x: cx + fx * (B - v) + ax * u, z: cz + fz * (B - v) + az * u });
  const box = (u, v, y, lu, h, lv, c) => { const p = P(u, v); m.box(p.x, y, p.z, ns ? lu : lv, h, ns ? lv : lu, c); };
  const cyl = (u, v, y, r, h, c, n = 8) => { const p = P(u, v); m.cyl(p.x, y, p.z, r, h, c, n); };
  const ico = (u, v, y, s, sy, c) => { const p = P(u, v); m.ico(p.x, y, p.z, s, sy, s, c, 0, rand() * 3); };
  const solid = (u, v, lu, lv, h = 1.2) => { const p = P(u, v); T.col.boxc(p.x, p.z, ns ? lu : lv, ns ? lv : lu, { h }); };
  const pick = a => a[Math.floor(rand() * a.length)];
  // furniture kit
  const table = (u, v, lu, lv, c = WOOD, h = 0.78) => { box(u, v, h - 0.06, lu, 0.06, lv, c); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(u + a * (lu / 2 - 0.08), v + b * (lv / 2 - 0.08), 0, 0.08, h - 0.06, 0.08, WOOD2); solid(u, v, lu, lv, h); };
  const chair = (u, v, c = WOOD2, back = 1) => { box(u, v, 0.45, 0.45, 0.06, 0.45, c); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(u + a * 0.18, v + b * 0.18, 0, 0.05, 0.45, 0.05, c); box(u, v + back * 0.2, 0.5, 0.45, 0.5, 0.05, c); };
  const counter = (u, v, lu, lv, top = '#e8e2d2', body = WOOD, h = 0.95) => { box(u, v, 0, lu, h - 0.05, lv, body); box(u, v, h - 0.05, lu + 0.06, 0.06, lv + 0.06, top); solid(u, v, lu, lv, h); };
  const shelfUnit = (u, v, lu, lv, h = 2.1, products = true) => {
    for (const s of [-1, 1]) box(u + s * (lu / 2 - 0.04), v, 0, 0.06, h, lv, WOOD2);
    for (let k = 0; k < 4; k++) {
      const y = 0.1 + k * (h - 0.2) / 3;
      box(u, v, y, lu, 0.05, lv, WOOD);
      if (products && k < 3) for (let i = 0; i < Math.floor(lu / 0.3); i++) box(u - lu / 2 + 0.2 + i * 0.3, v, y + 0.05, 0.2, 0.22 + rand() * 0.15, lv * 0.6, pick(PRODUCTS));
    }
    solid(u, v, lu, lv, h);
  };
  const plant = (u, v) => { cyl(u, v, 0, 0.25, 0.45, '#c8643a'); ico(u, v, 0.85, 0.7, 0.9, '#4fa64f'); };
  const lamp = (u, v) => { cyl(u, v, 0, 0.18, 0.05, DARK); cyl(u, v, 0.05, 0.03, 1.4, DARK, 5); cyl(u, v, 1.4, 0.25, 0.35, '#fff1b8'); };
  const rug = (u, v, lu, lv, c) => box(u, v, 0.08, lu, 0.02, lv, c);
  const picture = (u, c = pick(PRODUCTS)) => { box(u, D - 0.03, 1.5, 1.0, 0.75, 0.04, '#5a3a22'); box(u, D - 0.06, 1.55, 0.85, 0.6, 0.02, c); };
  const ceilingLights = () => { for (const u of [-A / 2, A / 2]) for (const v of [B * 0.6, B * 1.4]) box(u, v, F.ih - 0.12, 0.9, 0.08, 0.3, '#fffbe8'); };
  const sofa = (u, v, lu, c, back = 1) => { box(u, v, 0.15, lu, 0.35, 0.85, c); box(u, v + back * 0.33, 0.5, lu, 0.5, 0.2, c); for (const s of [-1, 1]) box(u + s * (lu / 2 - 0.1), v, 0.5, 0.2, 0.25, 0.85, c); solid(u, v, lu, 0.9, 0.9); };
  const fridge = (u, v, c = '#e8f2f8') => { box(u, v, 0, 0.8, 1.9, 0.7, c); box(u + 0.3, v - 0.36, 0.9, 0.04, 0.5, 0.03, '#8a98a6'); box(u, v - 0.36, 1.3, 0.78, 0.02, 0.02, '#a8b0bc'); solid(u, v, 0.8, 0.7, 1.9); };
  const crates = (u, v, n) => { for (let i = 0; i < n; i++) { const c = rand() < 0.5 ? '#b8894c' : '#a87c44'; box(u + (i % 2) * 0.95, v + Math.floor(i / 4) * 0.95, Math.floor((i % 4) / 2) * 0.9, 0.9, 0.9, 0.9, c); } solid(u + 0.47, v, 1.9, 1.0, 1.8); };
  const desk = (u, v, pc = true) => { table(u, v, 1.4, 0.7, '#c8b090', 0.76); if (pc) { box(u, v + 0.15, 0.76, 0.5, 0.36, 0.06, '#1b1b24'); box(u, v + 0.12, 0.8, 0.44, 0.28, 0.02, '#3a6ac8'); box(u, v - 0.15, 0.76, 0.45, 0.03, 0.15, '#2b2b33'); } chair(u, v - 0.6, '#2b2b38', -1); };
  ceilingLights();

  // a product you can buy: a price tag facing the shopper, and a spot to stand
  const facing = Math.atan2(fx, fz);
  const tag = (u, v, y, lines, bg = '#ffffff') => { const p = P(u, v); T.sign(lines, p.x, y, p.z, facing, 1.5, 0.55, { bg, fg: '#2a1640' }); };
  const sell = (u, v, cat, item, tagY = 1.35) => {
    const p = P(u, v - 1.25);
    F.shop && F.shop({ cat, key: item.key, x: p.x, z: p.z });
    tag(u, v - 0.5, tagY, [item.label.replace(/ \(.*\)| - .*|"[^"]*"/g, '').slice(0, 22), '$' + item.price.toLocaleString('en-US')], cat === 'grocery' ? '#fff6c8' : '#ffffff');
  };
  const bakeAt = (grp, u, v, y, s = 1, extraRy = 0) => { const p = P(u, v); grp.position.set(p.x, y, p.z); grp.scale.setScalar(s); grp.rotation.y = facing + extraRy; F.bake(m, grp); };
  const pedestal = (u, v, c = '#e8e2f2') => { cyl(u, v, 0, 0.8, 0.5, c, 12); cyl(u, v, 0.5, 0.85, 0.06, '#c8a03a', 12); const p = P(u, v); T.col.circle(p.x, p.z, 0.8, { h: 0.6 }); };

  switch (kind) {
    case 'grocery': {
      // checkouts by the door, with a cashier
      for (const s of [-1, 1]) { counter(s * 3.2, 1.6, 2.4, 0.8, '#e8e2d2', '#3fa34d'); box(s * 3.2 - 0.6, 1.6, 0.95, 0.35, 0.3, 0.3, '#2b2b33'); box(s * 3.2 + 0.5, 1.6, 0.94, 1.2, 0.03, 0.7, '#3a3048'); }
      { const p = P(-3.2, 0.7); T.person({ shirt: '#3fa34d', pants: '#2b2b38', hat: 'cap', hatColor: '#3fa34d', skin: '#e0a57c', hair: '#2a1a14' }, p.x, p.z, facing + Math.PI); }
      // every ingredient on its own shelf, along the back wall and two aisles
      F.goods.forEach((it, i) => {
        const row = i < 5 ? 0 : 1, col = row ? i - 5 : i;
        const u = row ? -A + 3 + col * ((2 * A - 6) / 3) : -A + 2.2 + col * ((2 * A - 4.4) / 4), v = row ? B + 0.6 : D - 0.6;
        box(u, v, 0, 2.4, 0.08, 0.8, WOOD2);
        box(u, v + 0.38, 0, 2.5, 2.05, 0.06, '#e8e2d2');                   // back panel
        for (const s of [-1, 1]) box(u + s * 1.22, v, 0, 0.07, 2.05, 0.82, WOOD2); // uprights
        box(u, v, 2.0, 2.5, 0.08, 0.82, WOOD2);                             // top
        box(u, v - 0.41, 0.0, 2.4, 0.12, 0.03, '#3fa34d');                  // kick plate
        for (let k = 0; k < 3; k++) {
          box(u, v, 0.08 + k * 0.62, 2.4, 0.06, 0.8, WOOD);
          for (let j = 0; j < 5; j++) {
            const q = P(u - 0.95 + j * 0.47, v);
            if (it.stock === 'sauce' || it.stock === 'olive') m.cyl(q.x, 0.14 + k * 0.62, q.z, 0.14, 0.34, it.color, 8);
            else if (it.stock === 'dough') m.box(q.x, 0.14 + k * 0.62, q.z, 0.36, 0.42, 0.3, it.color);
            else m.ico(q.x, 0.32 + k * 0.62, q.z, 0.3, 0.3, 0.3, it.color, 0, j);
          }
        }
        solid(u, v, 2.4, 0.8, 1.9);
        sell(u, v, 'grocery', it, 2.15);
      });
      for (let i = 0; i < 3; i++) { const q = P(A - 1.5, 3 + i * 0.6); m.box(q.x, 0.15, q.z, 0.8, 0.5, 0.55, STEEL); m.box(q.x, 0.65, q.z, 0.85, 0.04, 0.6, STEEL); } // shopping carts
      // the cold wall: glass-door fridges full of bottles, a lit header
      for (let k = 0; k < 4; k++) {
        const v = 4.2 + k * 1.6;
        box(-A + 0.45, v, 0, 0.8, 2.3, 1.5, '#e8eef4');
        box(-A + 0.86, v, 0.15, 0.03, 1.95, 1.4, '#bfe4ff');
        for (let s = 0; s < 4; s++) { box(-A + 0.6, v, 0.3 + s * 0.48, 0.5, 0.03, 1.36, '#c8ccd8'); for (let j = 0; j < 5; j++) cyl(-A + 0.6, v - 0.55 + j * 0.27, 0.33 + s * 0.48, 0.07, 0.3, PRODUCTS[(j + s + k) % PRODUCTS.length], 6); }
        box(-A + 0.88, v + 0.65, 0.9, 0.04, 0.5, 0.04, '#8a98a6');
      }
      solid(-A + 0.45, 6.6, 0.8, 6.4, 2.3);
      { const p = P(-A + 0.9, 6.6); T.sign(['COLD DRINKS · DAIRY'], p.x, 2.55, p.z, Math.atan2(ax, az), 4.0, 0.4, { bg: '#3a7bd5', fg: '#ffffff', border: false }); }
      // two freezer islands
      for (const u of [-A + 4.6, -A + 7.6]) {
        box(u, 6.0, 0, 1.6, 0.85, 3.4, '#f6f6fa'); box(u, 6.0, 0.85, 1.4, 0.04, 3.2, '#bfe4ff');
        for (let j = 0; j < 6; j++) box(u + (j % 2 - 0.5) * 0.6, 4.8 + Math.floor(j / 2) * 1.1, 0.6, 0.5, 0.2, 0.9, ['#ffd23f', '#ff8fc8', '#ffffff'][j % 3]);
        solid(u, 6.0, 1.6, 3.4, 0.9);
      }
      tag(-A + 6.1, 4.0, 1.4, ['FROZEN', '(like the economy)'], '#c9e8ff');
      // produce bins near the door, slanted, heaped with colour
      for (let k = 0; k < 3; k++) {
        const u = A - 4.6 - k * 2.3, v = 3.6;
        box(u, v, 0, 2.0, 0.75, 1.3, '#a87c44'); solid(u, v, 2.0, 1.3, 0.9);
        for (let j = 0; j < 12; j++) ico(u - 0.75 + (j % 4) * 0.5, v - 0.4 + Math.floor(j / 4) * 0.4, 0.82 + Math.floor(j / 4) * 0.08, 0.3, 0.26, ['#d6232a', '#43a85a', '#ffd23f'][k]);
      }
      { const p = P(A - 6.9, 3.6); T.sign(['PRODUCE'], p.x, 3.3, p.z, facing, 3.0, 0.6, { bg: '#43a85a', fg: '#ffffff', border: false }); }
      // hanging aisle signs and the price board
      { const p = P(0, B + 0.6); T.sign(['AISLE 1', 'BAKING · DOUGH · "BREAD STUFF"'], p.x, 3.4, p.z, facing, 4.2, 0.8, { bg: '#ffffff', fg: '#2a1640', stripe: '#3fa34d' }); }
      { const p = P(0, D - 2.0); T.sign(['AISLE 2', 'CHEESE · SAUCE · TOPPINGS'], p.x, 3.4, p.z, facing, 4.2, 0.8, { bg: '#ffffff', fg: '#2a1640', stripe: '#3fa34d' }); }
      tag(0, 2.4, 2.9, ["TODAY'S DEALS:", 'EVERYTHING IS FINE'], '#ffe14a');
      // the back room door: rubber strip curtain, EMPLOYEES ONLY, boxes stacked beside it
      box(A - 0.1, D - 2.4, 0, 0.12, 2.6, 1.8, '#3a3048');
      for (let j = 0; j < 6; j++) box(A - 0.2, D - 3.1 + j * 0.28, 0.1, 0.03, 2.4, 0.26, '#d8e8e8');
      { const p = P(A - 0.25, D - 2.4); T.sign(['EMPLOYEES', 'ONLY'], p.x, 2.95, p.z, Math.atan2(-ax, -az), 1.4, 0.5, { bg: '#d6232a', fg: '#ffffff', border: false }); }
      crates(A - 1.6, D - 4.6, 6);
      return {};
    }
    case 'equipment': {
      // an industrial warehouse: hazard lines, pallet racking along the back, a forklift parked inside
      counter(-A + 2, 1.4, 2.6, 0.8, '#3a3a48', '#ff9f1a');
      { const p = P(-A + 2, 0.6); T.person({ shirt: '#ff9f1a', pants: '#3a3048', hat: 'bald', beard: '#5a3a1a', skin: '#f2c29b', belly: 1.25 }, p.x, p.z, facing + Math.PI); }
      box(-A + 2, 1.4, 0.95, 0.5, 0.35, 0.3, '#1b1b24');
      for (const u of [-A + 5.2, A - 1.6]) box(u, B, 0.075, 0.18, 0.01, D - 1.5, '#ffd23f');
      box(0, D - 2.6, 0.075, 2 * A - 2, 0.01, 0.18, '#ffd23f');
      // racking: orange uprights, blue beams, pallets of boxes on three levels
      for (let r = 0; r < 4; r++) {
        const u0 = -A + 1.4 + r * ((2 * A - 2.8) / 4), lu = (2 * A - 2.8) / 4 - 0.15, v = D - 0.9;
        for (const s of [0, 1]) for (const dv of [-0.5, 0.5]) box(u0 + s * lu, v + dv, 0, 0.1, 4.2, 0.1, '#ff6a1a');
        for (let k = 0; k < 3; k++) {
          box(u0 + lu / 2, v - 0.5, 0.3 + k * 1.35, lu, 0.12, 0.08, '#2a5ac8'); box(u0 + lu / 2, v + 0.5, 0.3 + k * 1.35, lu, 0.12, 0.08, '#2a5ac8');
          for (let j = 0; j < 2; j++) {
            const pu = u0 + lu * (0.27 + j * 0.46);
            box(pu, v, 0.42 + k * 1.35, 1.1, 0.12, 0.9, '#b8894c');
            if ((r + j + k) % 4 !== 3) box(pu, v, 0.54 + k * 1.35, 0.95, 0.65 + ((r + k) % 2) * 0.3, 0.8, (r + j + k) % 3 ? '#c79a5b' : '#e8e8f0');
          }
        }
      }
      solid(0, D - 0.9, 2 * A - 2.4, 1.2, 4.2);
      // industrial pendant lamps
      for (const u of [-A / 2, 0, A / 2]) for (const v of [B * 0.5, B, B * 1.5]) { box(u, v, F.ih - 0.6, 0.03, 0.6, 0.03, '#1b1b24'); cyl(u, v, F.ih - 0.85, 0.35, 0.28, '#3a3a48', 8); cyl(u, v, F.ih - 0.88, 0.2, 0.04, '#fff6c8', 8); }
      // the products: each on a steel platform with a yellow outline
      F.equip.forEach((it, i) => {
        const u = -A + 3.6 + (i % 3) * ((2 * A - 7.2) / 2), v = 3.3 + Math.floor(i / 3) * 3.9;
        box(u, v, 0.075, 2.0, 0.01, 2.0, '#ffd23f'); box(u, v, 0.08, 1.8, 0.01, 1.8, '#b8bcc8');
        box(u, v, 0.07, 1.5, 0.45, 1.5, '#5a5a6a'); box(u, v, 0.52, 1.55, 0.04, 1.55, '#c8ccd8'); solid(u, v, 1.5, 1.5, 0.6);
        if (it.model) bakeAt(it.model(), u, v, 0.56, it.scale || 0.8);
        sell(u, v, 'equipment', it, 2.1);
      });
      { const p = P(A - 2.8, D - 3.6); T.sign(['WAREHOUSE', 'HARD HATS', '(we have none)'], p.x, 3.4, p.z, facing, 2.6, 1.0, { bg: '#ffd23f', fg: '#1b1b24', border: false }); }
      return {};
    }
    case 'furniture': {
      // Casa Crumb: three furnished display rooms along the back, a counter by the door, a palm by the entrance
      const ROOMS = [
        { u: -7.6, wall: '#c8e0d0', rug: '#c84a5a', name: 'THE LIVING ROOM', items: [['sofa', 0, 1.2], ['lamp', 2.5, 1.0], ['table', -1.6, 3.6]] },
        { u: 0, wall: '#2a4a3a', rug: '#6a2a3a', name: 'THE STUDY', items: [['desk', 0, 3.1], ['bookcase', -2.2, 0.45], ['painting', 1.7, 0.14, 1.3]] },
        { u: 7.6, wall: '#2a1640', rug: '#3a7bd5', name: 'THE GAME ROOM', items: [['arcade', -2.0, 0.7], ['jukebox', 0.3, 0.55], ['neon', 2.5, 0.14, 1.8]] },
      ];
      const byKey = Object.fromEntries(F.furn.map(f => [f.key, f]));
      for (const R of ROOMS) {
        box(R.u, D - 0.06, 0.07, 7.4, F.ih - 0.1, 0.04, R.wall);
        rug(R.u, D - 3.0, 6.4, 5.2, R.rug);
        { const p = P(R.u, D - 0.1); T.sign([R.name], p.x, 3.65, p.z, facing, 3.6, 0.55, { bg: '#fffaf0', fg: '#2a1640', border: false, font: 'Georgia, serif' }); }
        for (const [k, du, dv, y = 0.07] of R.items) {
          const it = byKey[k]; if (!it) continue;
          const u = R.u + du, v = D - dv;
          bakeAt(it.model(), u, v, y, 1);
          if (y < 0.5) solid(u, v, it.size[0], it.size[1], it.size[2]);
          sell(u, v, 'furn', it, y > 0.5 ? 0.9 : Math.max(1.3, it.size[2] + 0.35));
        }
      }
      // half-height partitions between the rooms
      for (const u of [-3.8, 3.8]) { box(u, D - 3.0, 0.07, 0.16, 2.7, 6.0, '#f6efe6'); box(u, D - 3.0, 2.77, 0.22, 0.08, 6.1, '#a8743a'); solid(u, D - 3.0, 0.16, 6.0, 2.7); }
      // the palm, by the door
      { const it = byKey.palm; if (it) { bakeAt(it.model(), -4.5, 3.4, 0.07, 1); solid(-4.5, 3.4, 0.7, 0.7, 1.4); sell(-4.5, 3.4, 'furn', it, 1.8); } }
      // a sleek counter, a clerk, a catalogue stand, pendant lamps
      counter(5.2, 1.7, 3.0, 0.8, '#f6efe6', '#2a2238');
      { const p = P(5.2, 0.8); T.person({ shirt: '#2a2238', pants: '#1b1b24', hairStyle: 'big', hair: '#1b1b24', skin: '#c8865a', glasses: 'round', tie: '#ff8fc8' }, p.x, p.z, facing + Math.PI); }
      for (const u of [-6, 0, 6]) { box(u, 5.4, F.ih - 0.7, 0.02, 0.7, 0.02, '#1b1b24'); cyl(u, 5.4, F.ih - 0.95, 0.3, 0.25, '#ffd23f', 10); }
      tag(0, 5.0, 2.6, ['EVERY PIECE', '+3% TIPS'], '#ffe9c8');
      return {};
    }
    case 'showroom':
      counter(A - 2.2, 1.4, 2.6, 0.8, '#e8e2d2', '#3a7bd5');
      { const p = P(A - 2.2, 0.6); T.person({ hat: 'cowboy', shirt: '#ffcf33', pants: '#3a5a9a', skin: '#e0a57c', mustache: true, tie: '#d6232a', belly: 1.2 }, p.x, p.z, facing + Math.PI); }
      rug(0, B + 1, 2 * A - 2, D - 3, '#2a2238');
      F.cars.forEach((it, i) => {
        const u = -A + 2.6 + (i % 4) * ((2 * A - 5.2) / 3), v = 4 + Math.floor(i / 4) * ((D - 5.5) / 2);
        pedestal(u, v, '#3a3048');
        bakeAt(it.model(), u, v, 0.56, 0.36, Math.PI / 2);
        sell(u, v, 'vehicle', it, 1.9);
      });
      return {};
    case 'books': {
      // Pages & Pages: a counter by the door (Vito stands behind it, see BlackMarket.js),
      // bookcases along the walls, two aisles, an armchair. The back wall of shelves is Town's.
      const BOOK = ['#8a2a2a', '#2a4a8a', '#2a6a3a', '#c8a03a', '#6a2a6a', '#d8c8a0', '#3a3a48', '#a8542a', '#4a7a8a'];
      const bookcase = (u, v, len, alongU, faces) => {
        const lu = alongU ? len : 0.5, lv = alongU ? 0.5 : len;
        box(u, v, 0.07, lu, 2.3, lv, '#5a3a22'); solid(u, v, lu, lv, 2.3);
        box(u, v, 2.37, lu + 0.06, 0.07, lv + 0.06, '#7a5236');
        for (let k = 0; k < 4; k++) {
          const y = 0.2 + k * 0.54;
          for (const f of faces) {
            box(alongU ? u : u + f * 0.25, alongU ? v + f * 0.25 : v, y - 0.04, alongU ? len : 0.05, 0.04, alongU ? 0.05 : len, '#7a5236');
            let t = -len / 2 + 0.08;
            while (t < len / 2 - 0.14) {
              const bw = 0.08 + rand() * 0.08, bh = 0.3 + rand() * 0.16;
              box(alongU ? u + t + bw / 2 : u + f * 0.26, alongU ? v + f * 0.26 : v + t + bw / 2, y, alongU ? bw : 0.03, bh, alongU ? 0.03 : bw, pick(BOOK));
              t += bw + 0.012 + (rand() < 0.08 ? 0.15 : 0);
            }
          }
        }
      };
      counter(-A + 1.9, 3.3, 0.8, 2.6, '#6a4a3a', '#4a3020');
      box(-A + 1.9, 2.7, 0.95, 0.4, 0.28, 0.36, '#2b2b33');                         // the register
      for (let i = 0; i < 4; i++) box(-A + 1.9, 3.6, 0.95 + i * 0.09, 0.32 - i * 0.03, 0.08, 0.44, pick(BOOK)); // a pile of books
      bookcase(-A + 0.3, 6.4, 3.2, false, [1]);
      bookcase(A - 0.3, 4.8, 6.4, false, [-1]);
      bookcase(-1.4, 4.8, 3.6, false, [-1, 1]);
      bookcase(1.6, 4.8, 3.6, false, [-1, 1]);
      // an armchair and a reading lamp, a little table of "staff picks"
      box(4.6, 1.6, 0.07, 1.0, 0.45, 0.9, '#8a2a3a'); box(4.6, 2.0, 0.52, 1.0, 0.6, 0.18, '#8a2a3a'); solid(4.6, 1.7, 1.0, 1.0, 0.9);
      lamp(5.6, 2.2);
      table(2.6, 1.5, 1.0, 0.7, '#6a4a3a');
      for (let i = 0; i < 3; i++) box(2.3 + i * 0.3, 1.5, 0.78, 0.22, 0.06 + i * 0.04, 0.3, pick(BOOK));
      tag(2.6, 1.0, 1.2, ['STAFF PICKS:', '"BOOKS"'], '#fff6c8');
      rug(0.2, 7.5, 5.0, 1.3, '#6a2a3a');
      { const p = P(-5.2, D - 3.1); T.sign(['WE ONLY', 'SELL BOOKS'], p.x, 3.3, p.z, facing, 1.6, 0.6, { bg: '#ffe14a', fg: '#2a1640' }); }
      return {};
    }
    case 'general':
      counter(A - 2, 1.4, 2.4, 0.8, '#e8e2d2', '#8a4ac8');
      { const p = P(A - 2, 0.6); T.person({ shirt: '#8a4ac8', pants: '#2b2b38', hairStyle: 'big', hair: '#c84a8a', skin: '#f7d6b8', glasses: 'round' }, p.x, p.z, facing + Math.PI); }
      F.misc.forEach((it, i) => {
        const u = -A + 2 + (i % 5) * ((2 * A - 4) / 4), v = 3.6 + Math.floor(i / 5) * 3.6;
        box(u, v, 0, 1.6, 0.9, 0.9, it.disg ? '#f7a8c8' : '#c9a8f0'); solid(u, v, 1.6, 0.9, 0.9);
        if (it.model) bakeAt(it.model(), u, v, 0.9, it.scale || 1);
        sell(u, v, 'general', it, 1.8);
      });
      return {};
    case 'house': {
      const wall = pick(['#f6e8d0', '#e8f0e0', '#f0e0f0', '#e0ecf6']);
      rug(-A / 2, B, 3.2, 2.4, pick(['#c84a5a', '#3a7bd5', '#8a4ac8', '#2f8a4a']));
      sofa(-A / 2, D - 0.7, 2.6, pick(['#5a6ac8', '#c8643a', '#4a8a6a', '#8a4ac8']));
      table(-A / 2, B + 0.3, 1.2, 0.6, WOOD, 0.42);
      lamp(-A + 0.4, D - 0.4); plant(-A + 0.5, 0.6);
      // kitchen along the right of the back wall
      counter(A - 2.3, D - 0.4, 2.6, 0.6, '#e8e2d2', pick(['#f6f1e6', '#c8e0f0', '#f0d0a0']));
      box(A - 1.7, D - 0.45, 0.95, 0.5, 0.02, 0.4, '#2b2b33'); for (const s of [-1, 1]) cyl(A - 1.7 + s * 0.12, D - 0.45, 0.96, 0.08, 0.02, '#1b1b24');
      box(A - 2.9, D - 0.45, 0.93, 0.5, 0.04, 0.35, STEEL); box(A - 2.9, D - 0.62, 0.95, 0.04, 0.3, 0.04, STEEL);
      fridge(A - 0.5, D - 0.45);
      table(A / 2, B, 1.4, 0.9, WOOD, 0.78); chair(A / 2 - 0.5, B - 0.7, WOOD2, -1); chair(A / 2 + 0.5, B - 0.7, WOOD2, -1); chair(A / 2 - 0.5, B + 0.7); chair(A / 2 + 0.5, B + 0.7);
      // a bed tucked in the front corner
      box(A - 1.1, 1.4, 0, 1.6, 0.45, 2.2, WOOD2); box(A - 1.1, 1.4, 0.45, 1.5, 0.15, 2.1, WHITE); box(A - 1.1, 1.4 + 0.4, 0.6, 1.52, 0.1, 1.4, pick(['#ff8fc8', '#43c0ff', '#ffd23f'])); box(A - 1.1, 0.5, 0.6, 1.1, 0.15, 0.4, WHITE); box(A - 1.1, 0.33, 0.45, 1.6, 0.6, 0.08, WOOD2); solid(A - 1.1, 1.4, 1.6, 2.2, 0.7);
      shelfUnit(-A + 0.3, B + 1.2, 0.5, 1.6, 1.8, true);
      picture(-A / 2); picture(A / 2 - 1.5);
      return { valuableIn: P(-A / 2, 0.9), wall };
    }
    case 'store': case 'gasshop': {
      counter(-A + 1.6, 1.6, 2.4, 0.8, '#e8e2d2', '#3a7bd5');
      box(-A + 1.2, 1.6, 0.95, 0.4, 0.3, 0.35, '#2b2b33'); box(-A + 1.2, 1.5, 1.25, 0.35, 0.02, 0.2, '#43e07a');
      for (let i = 0; i < 3; i++) shelfUnit(-A / 2 + 1.6 + i * 2.2 - (A > 6 ? 0 : 1), B + 0.6, 0.6, Math.min(D - 3, 5), 1.7, true);
      for (let i = 0; i < Math.floor(A); i += 1) { box(-A + 0.6 + i * 1.6 + 0.8, D - 0.4, 0, 1.4, 2.1, 0.7, '#d8dde6'); box(-A + 0.6 + i * 1.6 + 0.8, D - 0.76, 0.2, 1.2, 1.7, 0.02, '#8fe0ff'); for (let k = 0; k < 4; k++) box(-A + 0.3 + i * 1.6 + 0.8 + (k % 2) * 0.5, D - 0.6, 0.4 + Math.floor(k / 2) * 0.7, 0.15, 0.3, 0.15, pick(PRODUCTS)); if (-A + 2.4 + i * 1.6 > A) break; }
      solid(0, D - 0.4, 2 * A - 1, 0.7, 2.1);
      plant(A - 0.5, 0.5);
      return {};
    }
    case 'appliance': // Oleg: rows of ovens, fridges and washing machines
      counter(-A + 1.4, 1.4, 2, 0.8, '#e8e2d2', '#8fc1e3');
      for (let row = 0; row < 2; row++) for (let i = 0; i < Math.floor((2 * A - 3) / 1.2); i++) {
        const u = -A + 3.2 + i * 1.2, v = B + 0.2 + row * 2.2;
        const k = (i + row) % 3;
        if (k === 0) { box(u, v, 0, 0.9, 0.9, 0.8, '#f6f6fa'); box(u, v - 0.41, 0.25, 0.6, 0.4, 0.02, '#2b2b33'); for (let s = 0; s < 3; s++) cyl(u - 0.25 + s * 0.25, v, 0.9, 0.08, 0.02, '#2b2b33'); }
        else if (k === 1) { box(u, v, 0, 0.8, 1.8, 0.7, '#e8f2f8'); box(u + 0.3, v - 0.36, 0.8, 0.04, 0.5, 0.03, '#8a98a6'); }
        else { box(u, v, 0, 0.8, 0.9, 0.7, '#ffffff'); const p = P(u, v - 0.36); m.cyl(p.x, 0.45, p.z, 0.25, 0.02, '#43c0ff', 12); }
        solid(u, v, 0.9, 0.8, 1.8);
      }
      return {};
    case 'mustache': // mannequin heads with mustaches, a barber chair, a mirror
      counter(A - 1.5, 1.4, 2.2, 0.8, '#f6f1e6', '#2a1640');
      for (let i = 0; i < 6; i++) { const u = -A + 1.2 + i * 1.3, v = D - 0.6; cyl(u, v, 0, 0.06, 1.3, DARK, 5); ico(u, v, 1.5, 0.45, 0.5, '#f2c29b'); box(u, v - 0.22, 1.42, 0.35, 0.08, 0.06, pick(['#2a1a14', '#c8742a', '#e0e0e0', '#d6232a'])); }
      box(-A + 0.06, B, 0.6, 0.06, 1.8, 2.4, '#bfe4ff');
      box(-A + 1.2, B, 0, 0.7, 0.5, 0.7, '#2b2b33'); box(-A + 1.2, B, 0.5, 0.8, 0.15, 0.8, '#d6232a'); box(-A + 1.55, B, 0.6, 0.12, 0.9, 0.8, '#d6232a'); solid(-A + 1.2, B, 0.9, 0.9, 1.2);
      rug(0, B, 3, 2, '#ff8fc8');
      // walls of mustache boxes, a hat rack, a velvet bench
      for (const s of [-1, 1]) { shelfUnit(s * (A - 0.4), B + 0.8, 0.5, D - 3.5, 2.0, false); for (let k = 0; k < 3; k++) for (let i = 0; i < 6; i++) { box(s * (A - 0.4), B + 0.8 - (D - 3.5) / 2 + 0.35 + i * (D - 4.2) / 5, 0.16 + k * 0.63, 0.3, 0.2, 0.3, '#f6f1e6'); box(s * (A - 0.4) - s * 0.16, B + 0.8 - (D - 3.5) / 2 + 0.35 + i * (D - 4.2) / 5, 0.24 + k * 0.63, 0.02, 0.05, 0.2, pick(['#2a1a14', '#c8742a', '#e0e0e0', '#d6232a', '#1b1b24'])); } }
      cyl(A - 2.8, 1, 0, 0.05, 1.8, WOOD2, 5); for (let i = 0; i < 4; i++) { const a = i * 1.57; const p = P(A - 2.8 + Math.sin(a) * 0.25, 1 + Math.cos(a) * 0.25); m.cyl(p.x, 1.75, p.z, 0.22, 0.12, ['#1b1b24', '#c8a03a', '#4a3b30', '#d6232a'][i], 8); }
      box(0, B + 1.6, 0, 2.4, 0.42, 0.6, '#c84a8a'); solid(0, B + 1.6, 2.4, 0.6, 0.5);
      return {};
    case 'shoes':
      counter(-A + 1.5, 1.4, 2.2, 0.8, '#f6f1e6', '#d6232a');
      for (let w2 = 0; w2 < 2; w2++) { const u = w2 ? A - 0.4 : -A + 0.4; shelfUnit(u, B + 0.8, 0.5, D - 3, 2.0, false); for (let k = 0; k < 3; k++) for (let i = 0; i < 5; i++) box(u, B + 0.8 - (D - 3) / 2 + 0.4 + i * (D - 3.6) / 4, 0.18 + k * 0.63, 0.3, 0.12, 0.18, pick(PRODUCTS)); }
      box(0, B + 0.5, 0, 2.2, 0.45, 0.6, '#c84a5a'); solid(0, B + 0.5, 2.2, 0.6, 0.5);
      box(0, D - 0.05, 0.5, 1.2, 1.8, 0.04, '#bfe4ff');
      return {};
    case 'laundry':
      for (let i = 0; i < Math.floor((2 * A - 1) / 1.1); i++) { const u = -A + 0.9 + i * 1.1, v = D - 0.5; box(u, v, 0, 0.9, 1.0, 0.8, '#f6f6fa'); const p = P(u, v - 0.41); m.cyl(p.x, 0.5, p.z, 0.3, 0.02, '#43c0ff', 12); box(u, v - 0.41, 0.85, 0.6, 0.08, 0.02, '#2b2b33'); }
      solid(0, D - 0.5, 2 * A - 1, 0.8, 1.0);
      table(0, B, 2.4, 0.9, '#e8e2d2');
      for (let i = 0; i < 4; i++) chair(-A + 1 + i * 0.7, 1.2, '#ffd23f');
      return {};
    case 'tattoo':
      box(0, B + 0.5, 0, 0.8, 0.6, 2.0, '#2b2b33'); box(0, B + 0.5, 0.6, 0.9, 0.2, 2.1, '#1b1b24'); box(0, B + 1.4, 0.8, 0.9, 0.7, 0.2, '#1b1b24'); solid(0, B + 0.5, 0.9, 2.1, 1.0);
      box(1.2, B, 0, 0.5, 0.9, 0.4, STEEL);
      for (let i = 0; i < 5; i++) box(-A + 1 + i * 1.3, D - 0.03, 1.4, 1.0, 1.0, 0.04, pick(['#ff8fc8', '#43e07a', '#ffd23f', '#43c0ff']));
      sofa(-A + 1.6, 1.2, 2.2, '#5a2a6a', -1);
      return {};
    case 'oldpizza': { // abandoned: dust, chairs upside down on the tables, an old cold oven
      counter(A - 2, D - 1.0, 3.2, 0.8, '#d8d0c0', '#7a5a4a');
      const p = P(-A + 1.6, D - 1.0); m.box(p.x, 0, p.z, 1.6, 0.8, 1.3, '#7a5a4a'); m.ico(p.x, 1.0, p.z, 1.4, 0.9, 1.2, '#9a5a3a', 0, 0); T.col.boxc(p.x, p.z, 1.6, 1.6, { h: 1.6 });
      for (let i = 0; i < 3; i++) {
        const u = -A + 2 + i * 2.6, v = B - 0.4;
        table(u, v, 1.2, 1.2, '#c8b8a0');
        for (const s of [-1, 1]) { const q = P(u + s * 0.3, v); m.box(q.x, 0.78, q.z, 0.45, 0.06, 0.45, WOOD2); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.box(q.x + a * 0.18, 0.84, q.z + b * 0.18, 0.05, 0.45, 0.05, WOOD2); }
      }
      for (let i = 0; i < 6; i++) box(-A + 1 + rand() * (2 * A - 2), 0.6 + rand() * (D - 1.5), 0.075, 0.6 + rand() * 0.6, 0.01, 0.6 + rand() * 0.6, '#c8c0b0'); // dust
      for (let i = 0; i < 3; i++) box(A - 1 - i * 0.6, 0.8, i * 0.4, 0.6, 0.4, 0.6, '#c79a5b');
      box(0, D - 0.03, 1.8, 2.4, 1.2, 0.04, '#e8c45a'); // faded menu board
      return {};
    }
    case 'bakery':
      counter(0, B, 3.6, 0.9, '#bfe4ff', '#f0d0a0');
      for (let i = 0; i < 5; i++) ico(-1.4 + i * 0.7, B, 1.0, 0.4, 0.25, '#c8944a');
      shelfUnit(-A + 0.4, B + 1, 0.5, 2.5, 2.0, false); for (let k = 0; k < 3; k++) for (let i = 0; i < 3; i++) ico(-A + 0.4, B + 0.2 + i * 0.6, 0.25 + k * 0.63, 0.4, 0.25, '#b8843a');
      fridge(A - 0.6, D - 0.5, '#f6f1e6');
      return {};
    case 'police':
      counter(0, 2.0, 4.4, 0.9, '#e8e2d2', '#1e2a5a');
      for (let row = 0; row < 2; row++) for (let i = 0; i < Math.floor((A - 1) / 2.4); i++) desk(-A + 2 + i * 2.4, B - 1 + row * 3);
      for (let i = 0; i < 5; i++) chair(-1.2 + i * 0.6, 3.2, '#3a7bd5', 1); // waiting bench for the "suspects"
      plant(-A + 0.5, 0.6); plant(A - 0.5, 0.6);
      box(0, 2.0, 0.95, 0.5, 0.35, 0.4, '#2b2b33'); // a big old radio on the desk
      T.sign(['MOST WANTED:', 'WHOEVER IS MAKING', 'ALL THAT PIZZA'], P(-A + 4, D - 0.08).x, 1.7, P(-A + 4, D - 0.08).z, Math.atan2(-fx, -fz), 2.6, 1.3, { bg: '#e8d8a8', before: ['MOST WANTED:', 'WHOEVER STOLE', 'THE MAYOR\'S PARKING SPOT'] });
      // a holding cell in the back corner
      for (let i = 0; i <= 10; i++) cyl(A - 4 + i * 0.35, D - 2.4, 0, 0.03, 2.6, '#5a5a6a', 5);
      solid(A - 2.2, D - 2.4, 3.6, 0.1, 2.6);
      box(A - 1.5, D - 1.0, 0, 1.6, 0.45, 0.8, '#7a7a8a');
      for (let i = 0; i < 4; i++) box(-A + 0.4, D - 0.8 - i * 0.7, 0, 0.6, 1.3, 0.6, '#8a8aa0');
      box(-A + 2, B + 1.2, 0.79, 0.35, 0.08, 0.35, '#ff8fc8'); // a box of donuts
      cyl(A - 0.5, 1.0, 0, 0.18, 1.0, '#e8e8f0'); cyl(A - 0.5, 1.0, 1.0, 0.16, 0.45, '#43c0ff');
      box(0, D - 0.03, 1.6, 3, 1.2, 0.04, '#e8d8a8'); // wanted board
      return {};
    case 'hospital':
      counter(0, 2.2, 5, 0.9, '#f6f1e6', '#9ad8e8');
      for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) chair(-A + 2 + i * 0.7, B + 1.6 + r * 1.4, '#3a7bd5', 1);
      for (let i = 0; i < 2; i++) { box(A - 2, B + i * 2.4, 0.5, 0.9, 0.12, 2.0, WHITE); box(A - 2, B + i * 2.4, 0, 0.8, 0.5, 0.06, STEEL); solid(A - 2, B + i * 2.4, 0.9, 2.0, 0.7); }
      plant(-A + 0.5, 0.5); plant(A - 0.5, 0.5);
      box(-A + 0.5, D - 0.5, 0, 0.9, 1.9, 0.7, '#d6232a'); box(-A + 0.5, D - 0.86, 0.9, 0.7, 0.8, 0.02, '#8fe0ff'); solid(-A + 0.5, D - 0.5, 0.9, 0.7, 1.9);
      return {};
    case 'hall': // city hall: red carpet, flags, the mayor's portrait, a big desk
      rug(0, B, 2.2, D - 0.4, '#c8323a');
      counter(0, D - 2.5, 5, 1.0, '#e8c45a', '#6a3a22');
      for (const s of [-1, 1]) { cyl(s * 3.4, D - 1.2, 0, 0.05, 3.2, '#c8a03a', 6); box(s * 3.4 + s * 0.45, D - 1.2, 2.3, 0.9, 0.6, 0.03, s < 0 ? '#3a7bd5' : '#d6232a'); }
      for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { cyl(s * (A - 2), 2 + i * (D - 4) / 3, 0, 0.45, F.ih, '#f6f1e6', 10); T.col.circle(P(s * (A - 2), 2 + i * (D - 4) / 3).x, P(s * (A - 2), 2 + i * (D - 4) / 3).z, 0.45, { h: 5 }); }
      for (let i = 0; i < 3; i++) for (const s of [-1, 1]) box(s * (A / 2), 3 + i * 2.5, 0, 2.4, 0.45, 0.5, WOOD2);
      plant(-A + 0.6, D - 0.6); plant(A - 0.6, D - 0.6);
      // the reception desk at the door, velvet ropes along the carpet, more benches, the portrait
      counter(-4.5, 3, 3.4, 1.0, '#e8c45a', '#6a3a22');
      for (let i = 0; i < 6; i++) for (const s of [-1, 1]) { cyl(s * 1.6, 3 + i * (D - 6) / 5, 0, 0.06, 0.9, '#c8a03a', 6); cyl(s * 1.6, 3 + i * (D - 6) / 5, 0.9, 0.1, 0.1, '#c8a03a', 6); }
      for (let i = 0; i < 5; i++) for (const s of [-1, 1]) box(s * 1.6, 3 + (i + 0.5) * (D - 6) / 5, 0.72, 0.06, 0.06, (D - 6) / 5, '#c8323a');
      for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { box(s * 5, 6 + i * 3, 0, 2.6, 0.45, 0.5, WOOD2); box(s * 5, 6 + i * 3 + 0.22, 0.45, 2.6, 0.5, 0.08, WOOD2); }
      { const pp = P(0, D - 0.08); T.sign(['OUR GREAT MAYOR', 'GORDON CRUMB', '(he is very hungry)'], pp.x, 2.6, pp.z, Math.atan2(-fx, -fz), 3.6, 2.2, { bg: '#e8c45a', fg: '#4a3a20', borderColor: '#6a3a22' }); }
      { const pp = P(-A + 0.1, B); T.sign([''], pp.x, 2.2, pp.z, Math.atan2(ax, az), 2, 2, { ban: true, bg: '#ffffff', revealOnly: true }); }
      return { portrait: P(0, D - 0.06) };
    case 'mansion':
      rug(0, B, 6, 4, '#8a2a3a');
      for (const s of [-1, 1]) sofa(s * 3, B, 2.6, '#c8a03a', 0);
      table(0, B, 1.6, 0.8, '#5a3a22', 0.45);
      box(0, D - 0.4, 0, 2.6, 1.6, 0.6, '#9a9aaa'); box(0, D - 0.68, 0.2, 1.4, 1.0, 0.02, '#ff7a20'); solid(0, D - 0.4, 2.6, 0.6, 1.6); // fireplace
      ico(0, B, F.ih - 0.8, 1.2, 0.6, '#ffd23f'); // chandelier
      box(-A + 2, D - 1.5, 0, 2.0, 1.0, 1.4, '#1b1b24'); box(-A + 2, D - 1.5, 1.0, 2.0, 0.05, 0.9, '#f6f6fa'); solid(-A + 2, D - 1.5, 2, 1.4, 1.1); // piano
      fridge(A - 0.8, D - 0.6, '#c8a03a'); // the mayor's secret fridge
      return { secretFridge: P(A - 0.8, D - 0.95) };
    case 'warehouse':
      for (let i = 0; i < 3; i++) shelfUnit(-A + 2 + i * Math.max(3, (2 * A - 4) / 2), B + 1, 1.2, D - 3.5, 3.2, false);
      for (let i = 0; i < 3; i++) crates(-A + 1.2 + i * 2.6, 1.0, 4 + i);
      box(A - 2, 1.5, 0, 1.2, 1.2, 2.0, '#ffd23f'); box(A - 2, 0.3, 0.1, 0.12, 0.06, 1.0, '#5a5a6a'); box(A - 2, 1.5, 1.2, 1.0, 1.0, 1.0, '#2b2b33'); solid(A - 2, 1.2, 1.2, 2.6, 2.2);
      return {};
    case 'factory':
      for (let i = 0; i < 2; i++) { const v = B - 2 + i * 4; box(0, v, 0.6, 2 * A - 6, 0.15, 1.0, '#2b2b33'); for (let k = 0; k < 8; k++) box(-A + 4 + k * (2 * A - 8) / 7, v, 0.75, 0.7, 0.35, 0.6, '#c79a5b'); solid(0, v, 2 * A - 6, 1.0, 1.0); }
      for (let i = 0; i < 3; i++) { box(-A + 3 + i * 5, D - 2, 0, 2.4, 2.6, 2.0, '#9aa0b8'); box(-A + 3 + i * 5, D - 3.02, 1.3, 1.0, 0.6, 0.04, '#43e07a'); solid(-A + 3 + i * 5, D - 2, 2.4, 2.0, 2.6); }
      crates(A - 4, 1.2, 6);
      return {};
    case 'office':
      desk(0, B + 0.5);
      chair(-0.6, B - 0.5); chair(0.6, B - 0.5);
      box(0, D - 0.03, 1.5, 2.2, 1.2, 0.04, '#ffcf33');
      cyl(A - 0.5, D - 0.5, 0, 0.18, 1.0, '#e8e8f0'); cyl(A - 0.5, D - 0.5, 1.0, 0.16, 0.45, '#43c0ff');
      plant(-A + 0.5, D - 0.5);
      return {};
    default:
      table(0, B, 1.6, 1.0); chair(-0.5, B - 0.8, WOOD2, -1); chair(0.5, B + 0.8);
      shelfUnit(-A + 0.4, B, 0.5, Math.min(3, D - 1), 2, true);
      return {};
  }
}
