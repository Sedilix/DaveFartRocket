import { B } from '../voxel/blocks';
import { CHUNK, idx } from '../voxel/terrain';
import { Filler, cylinder } from './jungle';

/** The Source: a dead star's cooled crust, a glowing path, and the one Bean Tree. */
export const STAR_GROUND = 26;
export const TREE = { x: 40, z: 0 };

export function starGenerator(data: Uint8Array, cx: number, cz: number) {
  const ox = cx * CHUNK;
  const oz = cz * CHUNK;
  const f = new Filler(data, ox, oz);
  // A round crust platform, radius 58, centred between the spawn and the tree
  for (let lz = 0; lz < CHUNK; lz++) {
    for (let lx = 0; lx < CHUNK; lx++) {
      const x = ox + lx - 22;
      const z = oz + lz;
      const r = Math.hypot(x, z);
      if (r > 58) continue;
      for (let y = 18; y <= STAR_GROUND; y++) data[idx(lx, y, lz)] = (x * 7 + z * 13) % 11 === 0 && y === STAR_GROUND ? B.BRICK : B.STONE;
    }
  }
  // A glowing path from the arrival point to the tree
  for (let x = 4; x < TREE.x - 3; x += 1) {
    f.set(x, STAR_GROUND, -1, B.GLOW);
    f.set(x, STAR_GROUND, 1, B.GLOW);
    if (x % 6 === 0) f.box(x, STAR_GROUND + 1, -3, x, STAR_GROUND + 2, -3, B.PANEL);
    if (x % 6 === 3) f.box(x, STAR_GROUND + 1, 3, x, STAR_GROUND + 2, 3, B.PANEL);
  }
  // The Bean Tree: thick trunk, huge canopy hung with glowing beans
  const y = STAR_GROUND + 1;
  cylinder(f, TREE.x, TREE.z, 2, y, y + 16, B.BARK);
  cylinder(f, TREE.x, TREE.z, 8, y + 17, y + 18, B.JLEAF);
  cylinder(f, TREE.x, TREE.z, 6, y + 19, y + 20, B.JLEAF);
  cylinder(f, TREE.x, TREE.z, 3, y + 21, y + 22, B.JLEAF);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const bx = Math.round(TREE.x + Math.cos(a) * 7);
    const bz = Math.round(TREE.z + Math.sin(a) * 7);
    f.box(bx, y + 14, bz, bx, y + 16, bz, B.BEAN);
    f.set(bx, y + 13, bz, B.GLOW);
  }
  // A single seed plinth for the ritual
  cylinder(f, TREE.x - 6, TREE.z, 1, y, y, B.PLANKS);
  f.set(TREE.x - 6, y + 1, TREE.z, B.TORCH);
}
