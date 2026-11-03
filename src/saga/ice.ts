import { B } from '../voxel/blocks';
import { CHUNK, WORLD_H, fbm, hash2, idx } from '../voxel/terrain';
import { Filler } from './jungle';

/** The Ice Moon of Frostbite: a snow plain, a grand hotel, and a very broken elevator. */
export const ICE_GROUND = 26;
export const HOTEL = { x0: 12, x1: 44, z0: -12, z1: 12 };
export const SHAFT = { x0: 37, x1: 41, z0: -2, z1: 2 };
export const LEDGE_COUNT = 12;
/** Ledge k is a 2x5 slab at block y = 28 + 2k, on the west (even) or east (odd) side of the shaft. */
export const ledgeY = (k: number) => 28 + 2 * k;
export const OBS_FLOOR_Y = 52; // block y of the observatory floor; feet at 53
export const TELESCOPE = { x: 46, z: 0 };
export const DESK = { x: 26, z: 0 };
const SEED = 909;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function iceHeight(x: number, z: number): number {
  const az = Math.abs(z);
  let h = ICE_GROUND + (fbm(x * 0.05, z * 0.05, 3, SEED) - 0.5) * 6 * smooth(16, 30, az);
  h += Math.max(0, az - 32) * 2.4;
  h += Math.max(0, -8 - x) * 2.4;
  h += Math.max(0, x - 80) * 2.4;
  return Math.floor(h);
}

function hotel(f: Filler) {
  const y = ICE_GROUND + 1;
  const { x0, x1, z0, z1 } = HOTEL;
  // Shell, hollow lobby, floor, snowy roof
  f.box(x0, y, z0, x1, y + 6, z1, B.ICE);
  f.box(x0 + 1, y, z0 + 1, x1 - 1, y + 5, z1 - 1, B.AIR);
  f.box(x0, ICE_GROUND, z0, x1, ICE_GROUND, z1, B.PLANKS);
  f.box(x0 - 1, y + 7, z0 - 1, x1 + 1, y + 7, z1 + 1, B.SNOW);
  // Entrance (west wall), windows along the long walls
  f.box(x0, y, -1, x0, y + 2, 1, B.AIR);
  for (let x = x0 + 4; x < x1 - 2; x += 5) {
    f.box(x, y + 2, z0, x + 1, y + 3, z0, B.GLASS);
    f.box(x, y + 2, z1, x + 1, y + 3, z1, B.GLASS);
  }
  // Red carpet from the door to the desk, reception desk, torches
  f.box(x0, ICE_GROUND, -1, DESK.x - 3, ICE_GROUND, 1, B.CUSHION);
  f.box(DESK.x, y, -5, DESK.x + 1, y + 1, 5, B.PLANKS);
  for (let x = x0 + 3; x < x1 - 6; x += 6) {
    f.set(x, y + 2, z0 + 1, B.TORCH);
    f.set(x, y + 2, z1 - 1, B.TORCH);
  }
  // "Out of order" sign by the lift
  f.box(SHAFT.x0 - 2, y, 0, SHAFT.x0 - 2, y + 1, 0, B.BRICK);
}

function tower(f: Filler) {
  const y = ICE_GROUND + 1;
  const wallX0 = SHAFT.x0 - 1;
  const wallX1 = SHAFT.x1 + 1;
  // Tower walls up to the observatory floor, hollow shaft inside
  f.box(wallX0, y, SHAFT.z0 - 1, wallX1, OBS_FLOOR_Y - 1, SHAFT.z1 + 1, B.ICE);
  f.box(SHAFT.x0, y, SHAFT.z0, SHAFT.x1, OBS_FLOOR_Y, SHAFT.z1, B.AIR);
  // A doorway from the lobby into the shaft
  f.box(wallX0, y, -1, wallX0, y + 2, 1, B.AIR);
  // The ledges, alternating sides
  for (let k = 0; k < LEDGE_COUNT; k++) {
    const ly = ledgeY(k);
    if (k % 2 === 0) f.box(SHAFT.x0, ly, SHAFT.z0, SHAFT.x0 + 1, ly, SHAFT.z1, B.PLANKS);
    else f.box(SHAFT.x1 - 1, ly, SHAFT.z0, SHAFT.x1, ly, SHAFT.z1, B.PLANKS);
    f.set(k % 2 === 0 ? SHAFT.x0 : SHAFT.x1, ly + 1, 0, B.TORCH);
  }
  // Observatory: wide floor with the shaft open in the middle, glass dome, telescope
  const ox0 = 31;
  const ox1 = 50;
  f.box(ox0, OBS_FLOOR_Y, -7, ox1, OBS_FLOOR_Y, 7, B.PLANKS);
  f.box(SHAFT.x0, OBS_FLOOR_Y, SHAFT.z0, SHAFT.x1, OBS_FLOOR_Y, SHAFT.z1, B.AIR);
  f.box(ox0, OBS_FLOOR_Y + 1, -7, ox0, OBS_FLOOR_Y + 5, 7, B.GLASS);
  f.box(ox1, OBS_FLOOR_Y + 1, -7, ox1, OBS_FLOOR_Y + 5, 7, B.GLASS);
  f.box(ox0, OBS_FLOOR_Y + 1, -7, ox1, OBS_FLOOR_Y + 5, -7, B.GLASS);
  f.box(ox0, OBS_FLOOR_Y + 1, 7, ox1, OBS_FLOOR_Y + 5, 7, B.GLASS);
  f.box(ox0 - 1, OBS_FLOOR_Y + 6, -8, ox1 + 1, OBS_FLOOR_Y + 6, 8, B.SNOW);
  f.box(TELESCOPE.x, OBS_FLOOR_Y + 1, TELESCOPE.z, TELESCOPE.x, OBS_FLOOR_Y + 1, TELESCOPE.z, B.PANEL);
  f.box(TELESCOPE.x - 1, OBS_FLOOR_Y + 2, TELESCOPE.z, TELESCOPE.x - 1, OBS_FLOOR_Y + 2, TELESCOPE.z, B.PANEL);
  f.set(TELESCOPE.x - 2, OBS_FLOOR_Y + 3, TELESCOPE.z, B.GLOW);
}

export function iceGenerator(data: Uint8Array, cx: number, cz: number) {
  const ox = cx * CHUNK;
  const oz = cz * CHUNK;
  const heights = new Int16Array(CHUNK * CHUNK);
  for (let lz = 0; lz < CHUNK; lz++) {
    for (let lx = 0; lx < CHUNK; lx++) {
      const h = iceHeight(ox + lx, oz + lz);
      heights[lx + lz * CHUNK] = h;
      for (let y = 0; y <= h; y++) data[idx(lx, y, lz)] = y >= h - 1 ? B.SNOW : y > h - 5 ? B.ICE : B.STONE;
    }
  }
  // Pines (canopy fits inside the chunk), kept clear of the hotel and the route
  for (let lz = 3; lz < CHUNK - 3; lz++) {
    for (let lx = 3; lx < CHUNK - 3; lx++) {
      const wx = ox + lx;
      const wz = oz + lz;
      if (wx > -6 && wx < 56 && Math.abs(wz) < 18) continue;
      if (hash2(wx, wz, SEED + 3) > 0.02) continue;
      const h = heights[lx + lz * CHUNK];
      const trunk = 4 + Math.floor(hash2(wx, wz, SEED + 4) * 3);
      for (let t = 1; t <= trunk; t++) data[idx(lx, h + t, lz)] = B.BARK;
      [[2, 0], [2, 1], [1, 2], [1, 3], [0, 4]].forEach(([r, d]) => {
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          if (r === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          const i = idx(lx + dx, h + trunk - 2 + d, lz + dz);
          if (data[i] === B.AIR && h + trunk - 2 + d < WORLD_H) data[i] = B.JLEAF;
        }
      });
    }
  }
  const f = new Filler(data, ox, oz);
  hotel(f);
  tower(f);
}
