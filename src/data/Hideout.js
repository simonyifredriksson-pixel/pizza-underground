/* Hideout.js - where every station sits in the old shoe repair shop.
   Front room x 140-152, back room x 152-164 (z 72-88), basement under the
   whole lot at y = -6 (floor 1). ry: 0 faces +z, PI faces -z, PI/2 faces +x,
   -PI/2 faces -x. `lvl` is the hideout level that unlocks it, `needs` a flag. */
const P = Math.PI;
export const STATIONS = [
  // front room
  { id: 'fuse', type: 'fuse', x: 141.3, z: 72.3, ry: 0, lvl: 1, w: 0.6, d: 0.3, wall: true },
  { id: 'dough1', type: 'dough', x: 142.9, z: 73.1, ry: 0, lvl: 1, w: 1.0, d: 1.0 },
  { id: 'prep1', type: 'prep', x: 145.7, z: 72.8, ry: 0, lvl: 1, w: 1.8, d: 1.0 },
  { id: 'oven1', type: 'oven', x: 149.5, z: 72.9, ry: 0, lvl: 1, w: 1.6, d: 1.3, needs: 'oven1' },
  { id: 'laptop', type: 'laptop', x: 151.35, z: 75.6, ry: -P / 2, lvl: 1, w: 1.2, d: 0.8 },
  { id: 'fridge', type: 'fridge', x: 142.1, z: 87.4, ry: P, lvl: 1, w: 1.3, d: 0.9 },
  { id: 'box1', type: 'box', x: 145.7, z: 87.4, ry: P, lvl: 1, w: 1.4, d: 0.9 },
  { id: 'stash', type: 'stash', x: 149.8, z: 87.5, ry: P, lvl: 1, w: 1.2, d: 0.8 },
  { id: 'ext1', type: 'ext', x: 140.25, z: 75.6, ry: P / 2, lvl: 1, w: 0.5, d: 0.3, wall: true },
  { id: 'trash', type: 'trashcan', x: 140.9, z: 85.4, ry: P / 2, lvl: 1, w: 0.8, d: 0.8 },
  // back room (level 2)
  { id: 'prep2', type: 'prep', x: 156.2, z: 72.8, ry: 0, lvl: 2, w: 1.8, d: 1.0 },
  { id: 'oven2', type: 'oven', x: 159.8, z: 72.9, ry: 0, lvl: 2, w: 1.6, d: 1.3 },
  { id: 'dough2', type: 'dough', x: 163.0, z: 74.4, ry: -P / 2, lvl: 2, w: 1.0, d: 1.0 },
  { id: 'box2', type: 'box', x: 163.2, z: 84.6, ry: -P / 2, lvl: 2, w: 1.4, d: 0.9 },
  { id: 'shelf', type: 'shelf', x: 157.6, z: 87.5, ry: P, lvl: 2, w: 1.8, d: 0.7, shelf: 9 },
  { id: 'ext2', type: 'ext', x: 163.75, z: 79.0, ry: -P / 2, lvl: 2, w: 0.5, d: 0.3, wall: true },
  { id: 'hatch', type: 'trapdoor', x: 158.5, z: 80, ry: 0, lvl: 3, w: 1.4, d: 1.4, flat: true, to: 1 },
  // basement (level 3+)
  { id: 'ladder', type: 'trapdoor', x: 158.5, z: 80, ry: 0, lvl: 3, floor: 1, w: 1.4, d: 1.4, flat: true, to: 0 },
  { id: 'ovenB1', type: 'oven', x: 140.2, z: 62.9, ry: 0, lvl: 3, floor: 1, w: 1.6, d: 1.3 },
  { id: 'ovenB2', type: 'oven', x: 143.4, z: 62.9, ry: 0, lvl: 3, floor: 1, w: 1.6, d: 1.3 },
  { id: 'prepB1', type: 'prep', x: 147.2, z: 62.8, ry: 0, lvl: 3, floor: 1, w: 1.8, d: 1.0 },
  { id: 'prepB2', type: 'prep', x: 150.6, z: 62.8, ry: 0, lvl: 3, floor: 1, w: 1.8, d: 1.0 },
  { id: 'doughB', type: 'dough', x: 136.9, z: 67.5, ry: P / 2, lvl: 3, floor: 1, w: 1.0, d: 1.0 },
  { id: 'boxB', type: 'box', x: 154.4, z: 62.7, ry: 0, lvl: 3, floor: 1, w: 1.4, d: 0.9 },
  { id: 'shelfB', type: 'shelf', x: 167.4, z: 72, ry: -P / 2, lvl: 3, floor: 1, w: 1.8, d: 0.7, shelf: 9 },
  { id: 'extB', type: 'ext', x: 136.25, z: 75, ry: P / 2, lvl: 3, floor: 1, w: 0.5, d: 0.3, wall: true },
  { id: 'trashB', type: 'trashcan', x: 136.9, z: 92, ry: P / 2, lvl: 3, floor: 1, w: 0.8, d: 0.8 },
  { id: 'turbo', type: 'bigoven', x: 150, z: 97.0, ry: P, lvl: 4, floor: 1, w: 3.4, d: 1.3, slots: 3 },
  { id: 'prepB3', type: 'prep', x: 155.5, z: 97.2, ry: P, lvl: 4, floor: 1, w: 1.8, d: 1.0 },
  { id: 'boxB2', type: 'box', x: 144.5, z: 97.3, ry: P, lvl: 4, floor: 1, w: 1.4, d: 0.9 },
];
export const STATION = Object.fromEntries(STATIONS.map(s => [s.id, s]));

// the six piles of junk you clean up on day one
export const TRASH = [[144.2, 79.2], [148.2, 81.4], [146.0, 84.0], [142.6, 80.6], [149.2, 77.6], [145.2, 76.6]];

/** which part of the hideout a point is in: 'front' | 'back' | 'base' | null */
export function roomAt(x, z, floor) {
  if (floor === 1) return x > 135 && x < 169 && z > 61 && z < 99 ? 'base' : null;
  if (z < 72 || z > 88) return null;
  if (x > 140 && x < 152) return 'front';
  if (x >= 152 && x < 164) return 'back';
  return null;
}
