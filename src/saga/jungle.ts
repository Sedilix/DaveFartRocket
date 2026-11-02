import { B } from '../voxel/blocks';
import { CHUNK, WORLD_H, fbm, hash2, idx } from '../voxel/terrain';

/** The Moon of Nom: a lush corridor with a Nomad village, a ravine to cross, and a festival plaza. */
export const GROUND = 26; // surface block of the plateau; Dave's feet rest at GROUND + 1
export const WATERLINE = 14;
export const RAVINE_X0 = 40;
export const RAVINE_X1 = 68;
export const ISLAND = { x0: 52, x1: 57, hz: 3.5 };
export const HORN = { x: 90, z: 0 };
export const DRUM = { x: 97, z: 0 };
const SEED = 424;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function jungleHeight(x: number, z: number): number {
  const az = Math.abs(z);
  // Gentle roll off the main route, flat on it
  const rough = smooth(18, 34, az);
  let h = GROUND + (fbm(x * 0.05, z * 0.05, 3, SEED) - 0.5) * 8 * rough;
  // Walls of jungle mountains keep the player in the corridor
  h += Math.max(0, az - 34) * 2.2;
  h += Math.max(0, -6 - x) * 2.2;
  h += Math.max(0, x - 126) * 2.2;
  // The ravine
  if (x >= RAVINE_X0 && x <= RAVINE_X1) {
    const edge = Math.min(x - RAVINE_X0, RAVINE_X1 - x);
    h += (8 - h) * smooth(0, 3, edge);
    if (x >= ISLAND.x0 && x <= ISLAND.x1 && az <= ISLAND.hz) h = GROUND;
  }
  return Math.floor(h);
}

class Filler {
  constructor(private data: Uint8Array, private ox: number, private oz: number) {}

  public set(x: number, y: number, z: number, id: number) {
    const lx = x - this.ox;
    const lz = z - this.oz;
    if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK || y < 0 || y >= WORLD_H) return;
    this.data[idx(lx, y, lz)] = id;
  }

  public box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, id: number) {
    for (let x = Math.max(x0, this.ox); x <= Math.min(x1, this.ox + CHUNK - 1); x++) {
      for (let z = Math.max(z0, this.oz); z <= Math.min(z1, this.oz + CHUNK - 1); z++) {
        for (let y = y0; y <= y1; y++) this.set(x, y, z, id);
      }
    }
  }
}

// A cylinder needs a per-cell test, so it is implemented outside the class for clarity
function cylinder(f: Filler, cx: number, cz: number, r: number, y0: number, y1: number, id: number) {
  for (let x = cx - r; x <= cx + r; x++) {
    for (let z = cz - r; z <= cz + r; z++) {
      if ((x - cx) ** 2 + (z - cz) ** 2 <= r * r + 0.5) for (let y = y0; y <= y1; y++) f.set(x, y, z, id);
    }
  }
}

function hut(f: Filler, x0: number, z0: number, doorSide: 1 | -1) {
  const y = GROUND + 1;
  f.box(x0, y, z0, x0 + 4, y + 3, z0 + 4, B.PLANKS);
  f.box(x0 + 1, y, z0 + 1, x0 + 3, y + 2, z0 + 3, B.AIR);
  f.box(x0 - 1, y + 4, z0 - 1, x0 + 5, y + 4, z0 + 5, B.THATCH);
  f.box(x0, y + 5, z0, x0 + 4, y + 5, z0 + 4, B.THATCH);
  f.box(x0 + 1, y + 6, z0 + 1, x0 + 3, y + 6, z0 + 3, B.THATCH);
  const dz = doorSide === 1 ? z0 + 4 : z0;
  f.box(x0 + 2, y, dz, x0 + 2, y + 1, dz, B.AIR);
  f.set(x0 + 2, y, z0 + 2, B.TORCH);
}

function structures(f: Filler) {
  const y = GROUND + 1;
  // Village huts either side of the route, doors facing it
  [[6, -9, 1], [6, 6, -1], [14, -10, 1], [14, 7, -1], [24, -9, 1], [24, 6, -1], [32, -10, 1], [32, 7, -1]].forEach(([x, z, d]) =>
    hut(f, x, z, d as 1 | -1)
  );
  // Totem
  f.box(20, y, 4, 20, y + 6, 4, B.BARK);
  f.box(19, y + 4, 4, 21, y + 4, 4, B.PLANKS);
  f.box(20, y + 5, 4, 20, y + 5, 4, B.BRICK);
  f.set(20, y + 7, 4, B.TORCH);
  // Fire pit
  f.box(11, y, -5, 13, y, -3, B.STONE);
  f.set(12, y, -4, B.TORCH);
  // The broken bridge: stubs either side of the gulch
  f.box(RAVINE_X0 - 3, GROUND, -1, RAVINE_X0 + 1, GROUND, 1, B.PLANKS);
  f.box(RAVINE_X1 - 1, GROUND, -1, RAVINE_X1 + 3, GROUND, 1, B.PLANKS);
  // Festival plaza
  cylinder(f, HORN.x, HORN.z, 10, GROUND, GROUND, B.PLANKS);
  cylinder(f, HORN.x, HORN.z, 2, y, y + 3, B.PLANKS); // the Gust Horn
  cylinder(f, HORN.x, HORN.z, 1, y + 4, y + 8, B.PLANKS);
  f.set(HORN.x, y + 9, HORN.z, B.TORCH);
  // The Sacred Drum with the recipe carved on it
  cylinder(f, DRUM.x, DRUM.z, 2, y, y + 1, B.THATCH);
  cylinder(f, DRUM.x, DRUM.z, 2, y + 2, y + 2, B.BEAN);
  // Torch posts around the plaza
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const px = Math.round(HORN.x + Math.cos(a) * 9);
    const pz = Math.round(HORN.z + Math.sin(a) * 9);
    f.box(px, y, pz, px, y + 2, pz, B.BARK);
    f.set(px, y + 3, pz, B.TORCH);
  }
}

export function jungleGenerator(data: Uint8Array, cx: number, cz: number) {
  const ox = cx * CHUNK;
  const oz = cz * CHUNK;
  const heights = new Int16Array(CHUNK * CHUNK);

  for (let lz = 0; lz < CHUNK; lz++) {
    for (let lx = 0; lx < CHUNK; lx++) {
      const h = jungleHeight(ox + lx, oz + lz);
      heights[lx + lz * CHUNK] = h;
      for (let y = 0; y <= h; y++) {
        let id: number = B.STONE;
        if (y === h) id = h >= 16 ? B.JGRASS : B.STONE;
        else if (y > h - 4 && h >= 16) id = B.DIRT;
        data[idx(lx, y, lz)] = id;
      }
      for (let y = h + 1; y <= WATERLINE; y++) data[idx(lx, y, lz)] = B.WATER;
    }
  }

  // Trees and glowshrooms. Canopies stay inside their own chunk so chunks remain independent
  for (let lz = 4; lz < CHUNK - 4; lz++) {
    for (let lx = 4; lx < CHUNK - 4; lx++) {
      const wx = ox + lx;
      const wz = oz + lz;
      const h = heights[lx + lz * CHUNK];
      if (h < 18 || data[idx(lx, h, lz)] !== B.JGRASS) continue;
      const az = Math.abs(wz);
      const inVillage = wx > 2 && wx < 40 && az < 14;
      const inPlaza = wx > 72 && wx < 110 && az < 16;
      const inRavine = wx > RAVINE_X0 - 3 && wx < RAVINE_X1 + 3;
      if (az < 5 || inVillage || inPlaza || inRavine) continue;
      const r = hash2(wx, wz, SEED + 5);
      if (r < 0.03) {
        const trunk = 9 + Math.floor(hash2(wx, wz, SEED + 6) * 6);
        for (let t = 1; t <= trunk; t++) data[idx(lx, h + t, lz)] = B.BARK;
        const radii = [3, 3, 2, 1];
        radii.forEach((rad, dy) => {
          const y = h + trunk - 1 + dy;
          for (let dz = -rad; dz <= rad; dz++) {
            for (let dx = -rad; dx <= rad; dx++) {
              if (rad >= 3 && Math.abs(dx) === 3 && Math.abs(dz) === 3) continue;
              const i = idx(lx + dx, y, lz + dz);
              if (data[i] === B.AIR) data[i] = B.JLEAF;
            }
          }
        });
        // Hanging vines
        [[-2, -2], [2, -2], [-2, 2], [2, 2]].forEach(([dx, dz]) => {
          for (let v = 1; v <= 3; v++) data[idx(lx + dx, h + trunk - 1 - v, lz + dz)] = B.JLEAF;
        });
      } else if (r > 0.985) {
        data[idx(lx, h + 1, lz)] = B.SHROOM;
      }
    }
  }

  structures(new Filler(data, ox, oz));
}
