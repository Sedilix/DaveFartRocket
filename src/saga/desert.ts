import { B } from '../voxel/blocks';
import { CHUNK, WORLD_H, fbm, hash2, idx } from '../voxel/terrain';
import { Filler } from './jungle';

/** The desert moon: rolling dunes, a ruined arena for the Elder's offer, and an oasis arch at the far end. */
export const DESERT_GROUND = 26;
export const FINISH_X = 136;
const SEED = 1717;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function desertHeight(x: number, z: number): number {
  const az = Math.abs(z);
  const open = smooth(10, 26, az); // the route stays gentler than the sides
  let h = DESERT_GROUND + (fbm(x * 0.035, z * 0.035, 3, SEED) - 0.5) * (4 + 8 * open);
  if (x < 24) h = DESERT_GROUND; // flat arena
  h += Math.max(0, az - 32) * 2.2;
  h += Math.max(0, -10 - x) * 2.2;
  h += Math.max(0, x - 150) * 2.2;
  return Math.floor(h);
}

export function desertGenerator(data: Uint8Array, cx: number, cz: number) {
  const ox = cx * CHUNK;
  const oz = cz * CHUNK;
  const heights = new Int16Array(CHUNK * CHUNK);
  for (let lz = 0; lz < CHUNK; lz++) {
    for (let lx = 0; lx < CHUNK; lx++) {
      const h = desertHeight(ox + lx, oz + lz);
      heights[lx + lz * CHUNK] = h;
      for (let y = 0; y <= h; y++) data[idx(lx, y, lz)] = y > h - 6 ? B.SAND : B.STONE;
    }
  }
  // Cacti and rocks
  for (let lz = 2; lz < CHUNK - 2; lz++) {
    for (let lx = 2; lx < CHUNK - 2; lx++) {
      const wx = ox + lx;
      const wz = oz + lz;
      if (Math.abs(wz) < 4 || wx < 24 || wx > FINISH_X - 6) continue;
      const r = hash2(wx, wz, SEED + 9);
      const h = heights[lx + lz * CHUNK];
      if (r < 0.006) {
        const ht = 2 + Math.floor(hash2(wx, wz, SEED + 2) * 3);
        for (let t = 1; t <= ht; t++) data[idx(lx, h + t, lz)] = B.JLEAF;
        if (ht >= 3) data[idx(lx + 1, h + 2, lz)] = B.JLEAF;
      } else if (r > 0.995 && h + 3 < WORLD_H) {
        data[idx(lx, h + 1, lz)] = B.STONE;
        data[idx(lx, h + 2, lz)] = B.STONE;
        data[idx(lx + 1, h + 1, lz)] = B.STONE;
      }
    }
  }
  const f = new Filler(data, ox, oz);
  const y = DESERT_GROUND + 1;
  // The ruined arena: a ring of pillars around the Elder's spot
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const px = Math.round(14 + Math.cos(a) * 9);
    const pz = Math.round(Math.sin(a) * 9);
    f.box(px, y, pz, px, y + 4 - (i % 3), pz, B.BRICK);
    if (i % 3 === 0) f.set(px, y + 5, pz, B.TORCH);
  }
  f.box(10, DESERT_GROUND, -3, 18, DESERT_GROUND, 3, B.PLANKS);
  // The oasis arch and a small pond
  f.box(FINISH_X, y, -6, FINISH_X, y + 6, -6, B.BRICK);
  f.box(FINISH_X, y, 6, FINISH_X, y + 6, 6, B.BRICK);
  f.box(FINISH_X, y + 7, -6, FINISH_X, y + 7, 6, B.BRICK);
  f.set(FINISH_X, y + 8, 0, B.TORCH);
  for (let x = FINISH_X + 3; x <= FINISH_X + 9; x++) for (let z = -4; z <= 4; z++) {
    if ((x - FINISH_X - 6) ** 2 + z * z <= 12) {
      f.set(x, DESERT_GROUND, z, B.WATER);
      f.set(x, DESERT_GROUND - 1, z, B.SAND);
    }
  }
  [[FINISH_X + 4, 6], [FINISH_X + 8, -6], [FINISH_X + 10, 3]].forEach(([px, pz]) => {
    f.box(px, y, pz, px, y + 4, pz, B.BARK);
    f.box(px - 1, y + 5, pz - 1, px + 1, y + 5, pz + 1, B.JLEAF);
  });
}
