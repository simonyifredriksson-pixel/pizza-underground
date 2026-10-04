/* Build.js - everything you can place in the hideout in build mode (N).

   size   [w, d] footprint in metres, facing +z (rotate with R)
   h      collider height (0 = you can walk over it, like a rug)
   style  how classy it is: every point is +1% tips (capped, see STYLE_CAP)
   store  the big pieces come from CASA CRUMB FURNITURE only (carry the box
          home, unpack it); everything else can be ordered in the build menu
   wall   hangs on a wall instead of standing on the floor
   cat    the tab it lives in: furniture / appliances / decor */
import { FURNITURE } from './Data.js';

const fromStore = (key, cat, style, size, h, wall) => { const f = FURNITURE.find(x => x.key === key); return { key, label: f.label.replace(/ \(.*|"[^"]*"/g, '').trim(), price: f.price, cat, style, size, h, wall, store: true, desc: f.desc }; };

export const BUILD_ITEMS = [
  // ---- furniture ----
  { key: 'cheapTable', label: 'Cheap Table', cat: 'furniture', price: 150, style: 1, size: [1.2, 0.8], h: 0.8, desc: 'Wobbles. Fold a coaster under one leg.' },
  { key: 'chair', label: 'Diner Chair', cat: 'furniture', price: 80, style: 1, size: [0.55, 0.55], h: 0.9, desc: 'Red vinyl, chrome legs, squeaks.' },
  { key: 'barstool', label: 'Bar Stool', cat: 'furniture', price: 120, style: 1, size: [0.5, 0.5], h: 0.8, desc: 'It spins. That is the whole feature.' },
  { key: 'roundTable', label: 'Café Table', cat: 'furniture', price: 260, style: 2, size: [0.9, 0.9], h: 0.8, desc: 'A little marble-ish table for two.' },
  { key: 'booth', label: 'Retro Booth', cat: 'furniture', price: 650, style: 3, size: [1.6, 0.9], h: 1.1, desc: 'Red and white, like a real pizzeria. Suspicious.' },
  { key: 'counter', label: 'Wooden Counter', cat: 'furniture', price: 420, style: 2, size: [1.6, 0.7], h: 1.0, desc: 'For leaning on while you wait.' },
  { key: 'bench', label: 'Park Bench', cat: 'furniture', price: 200, style: 1, size: [1.8, 0.6], h: 0.9, desc: 'Stolen. From the park. Allegedly.' },
  { key: 'gamerChair', label: 'Gamer Chair', cat: 'furniture', price: 900, style: 2, size: [0.7, 0.7], h: 1.3, desc: 'RGB lights make you 20% faster at nothing.' },
  { key: 'beachTable', label: 'Beach Table', cat: 'furniture', price: 380, style: 2, size: [1.4, 1.4], h: 0.9, desc: 'An umbrella. Indoors. Vacation vibes.' },
  { key: 'princessTable', label: 'Princess Table', cat: 'furniture', price: 1200, style: 3, size: [1.8, 1.0], h: 0.9, desc: 'Pink, curvy legs, a candelabra. Very fancy. Very pink.' },
  fromStore('sofa', 'furniture', 4, [2.0, 0.9], 0.9),
  fromStore('table', 'furniture', 3, [2.2, 2.2], 0.8),
  fromStore('bookcase', 'furniture', 3, [1.4, 0.5], 2.0),
  fromStore('desk', 'furniture', 4, [1.9, 1.8], 1.0),
  // ---- appliances ----
  { key: 'tv', label: 'Big TV', cat: 'appliances', price: 1200, style: 3, size: [1.6, 0.5], h: 1.5, desc: 'Plays the cooking channel. Pizza episodes are banned.' },
  { key: 'coffee', label: 'Espresso Machine', cat: 'appliances', price: 700, style: 2, size: [0.7, 0.55], h: 1.3, desc: 'Makes coffee. Loudly.' },
  { key: 'vending', label: 'Vending Machine', cat: 'appliances', price: 1500, style: 2, size: [1.0, 0.8], h: 2.0, desc: 'Sells "bread chips". Eats coins.' },
  { key: 'drinksFridge', label: 'Drinks Fridge', cat: 'appliances', price: 1100, style: 2, size: [0.9, 0.7], h: 1.9, desc: 'Glass door, cold soda, a hum you will hear in your dreams.' },
  { key: 'fan', label: 'Standing Fan', cat: 'appliances', price: 150, style: 1, size: [0.5, 0.5], h: 1.4, desc: 'Oscillates. Blows napkins everywhere.' },
  fromStore('arcade', 'appliances', 4, [0.8, 0.8], 1.8),
  fromStore('jukebox', 'appliances', 4, [0.9, 0.6], 1.5),
  // ---- decor ----
  { key: 'plant', label: 'Potted Plant', cat: 'decor', price: 90, style: 1, size: [0.5, 0.5], h: 1.0, desc: 'Water it. Or don\'t. It\'s plastic.' },
  { key: 'flowers', label: 'Flower Box', cat: 'decor', price: 60, style: 1, size: [0.7, 0.4], h: 0.6, desc: 'Daisies. For the ambience.' },
  { key: 'rug', label: 'Round Rug', cat: 'decor', price: 220, style: 1, size: [2.0, 2.0], h: 0, desc: 'Walk on it. That is what it is for.' },
  { key: 'aquarium', label: 'Aquarium', cat: 'decor', price: 2500, style: 4, size: [1.4, 0.6], h: 1.4, desc: 'Three fish. One of them is called Pepperoni. Shh.' },
  { key: 'statue', label: 'Bread Statue', cat: 'decor', price: 3000, style: 5, size: [0.8, 0.8], h: 2.0, desc: 'A golden statue of a loaf. Definitely bread. Round bread.' },
  { key: 'clock', label: 'Wall Clock', cat: 'decor', price: 100, style: 1, size: [0.6, 0.1], h: 0, wall: true, desc: 'Always 5 minutes late. Like the deliveries.' },
  { key: 'poster', label: 'Movie Poster', cat: 'decor', price: 80, style: 1, size: [0.9, 0.1], h: 0, wall: true, desc: '"THE DOUGHFATHER". A classic.' },
  fromStore('palm', 'decor', 2, [0.7, 0.7], 1.4),
  fromStore('lamp', 'decor', 2, [0.5, 0.5], 1.6),
  fromStore('painting', 'decor', 4, [1.2, 0.1], 0, true),
  fromStore('neon', 'decor', 3, [1.4, 0.1], 0, true),
];
export const BUILD_ITEM = Object.fromEntries(BUILD_ITEMS.map(i => [i.key, i]));
export const BUILD_CATS = [['furniture', 'Furniture'], ['appliances', 'Appliances'], ['decor', 'Decor']];
export const STYLE_CAP = 40;           // tips +% at most
export const SELL_BACK = 0.5;          // selling gives half the price back

/** the rooms you can build in: the inner faces of their walls, which floor, the hideout level that opens them.
    keep: spots that must stay clear (doors, ladders, the chair...) as [x0, z0, x1, z1] */
export const BUILD_ZONES = [
  { id: 'front', name: 'Front room', x0: 140, x1: 151.75, z0: 72, z1: 88, floor: 0, lvl: 1, keep: [[139.5, 78.3, 142.6, 81.7], [150.4, 78.3, 151.8, 81.7]] },
  { id: 'back', name: 'Back room', x0: 152.25, x1: 164, z0: 72, z1: 88, floor: 0, lvl: 2, keep: [[152.2, 78.3, 153.6, 81.7]] },
  { id: 'base', name: 'Secret basement', x0: 136, x1: 168, z0: 62, z1: 98, floor: 1, lvl: 3, keep: [] },
  { id: 'storage', name: 'Storage room', x0: 692, x1: 708, z0: -6, z1: 6, floor: 0, lvl: 1, keep: [] },
];
export function zoneAt(x, z, floor) { return BUILD_ZONES.find(Z => Z.floor === floor && x > Z.x0 && x < Z.x1 && z > Z.z0 && z < Z.z1) || null; }
/** footprint [w, d] after rotating by ry (quarter turns) */
export function footprint(it, ry) { const q = Math.round(ry / (Math.PI / 2)) & 1; return q ? [it.size[1], it.size[0]] : [it.size[0], it.size[1]]; }
