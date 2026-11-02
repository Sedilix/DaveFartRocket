import { B } from './blocks';

export const CHUNK = 16;
export const WORLD_H = 112;
export const SEA = 26;

/** Deterministic hash to [0, 1). */
export function hash2(x: number, z: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Smooth value noise in [0, 1). */
export function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

/** Fractal noise normalised to roughly [0, 1]. */
export function fbm(x: number, z: number, octaves: number, seed: number): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * f, z * f, seed + i * 101) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

/** Surface height of the terrain column at world (x, z). */
export function heightAt(wx: number, wz: number, seed: number): number {
  const continent = fbm(wx * 0.004, wz * 0.004, 3, seed);
  const hills = fbm(wx * 0.02, wz * 0.02, 4, seed + 7);
  const mount = fbm(wx * 0.007, wz * 0.007, 3, seed + 19);
  let h = 22 + (continent - 0.5) * 30 + (hills - 0.5) * 20;
  h += Math.max(0, mount - 0.55) * 150; // occasional mountain ranges
  return Math.max(3, Math.min(WORLD_H - 12, Math.floor(h)));
}

export const idx = (x: number, y: number, z: number) => x + CHUNK * (z + CHUNK * y);

/** Fills `data` (CHUNK x WORLD_H x CHUNK) for the chunk at (cx, cz). */
export function generateChunk(data: Uint8Array, cx: number, cz: number, seed: number) {
  const heights = new Int16Array(CHUNK * CHUNK);
  for (let lz = 0; lz < CHUNK; lz++) {
    for (let lx = 0; lx < CHUNK; lx++) {
      const wx = cx * CHUNK + lx;
      const wz = cz * CHUNK + lz;
      const h = heightAt(wx, wz, seed);
      heights[lx + lz * CHUNK] = h;

      let top: number = B.GRASS;
      if (h <= SEA + 1) top = B.SAND;
      else if (h > 70) top = B.SNOW;
      else if (h > 58) top = B.STONE;

      for (let y = 0; y <= h; y++) {
        let id: number = B.STONE;
        if (y === h) id = top;
        else if (y > h - 4 && top !== B.STONE) id = top === B.SAND ? B.SAND : B.DIRT;
        data[idx(lx, y, lz)] = id;
      }
      for (let y = h + 1; y <= SEA; y++) data[idx(lx, y, lz)] = B.WATER;
    }
  }

  // Trees: only where the whole canopy fits inside this chunk, so chunks stay independent
  for (let lz = 3; lz < CHUNK - 3; lz++) {
    for (let lx = 3; lx < CHUNK - 3; lx++) {
      const h = heights[lx + lz * CHUNK];
      if (data[idx(lx, h, lz)] !== B.GRASS) continue;
      const wx = cx * CHUNK + lx;
      const wz = cz * CHUNK + lz;
      if (hash2(wx, wz, seed + 1234) > 0.011) continue;
      const trunk = 4 + Math.floor(hash2(wx, wz, seed + 77) * 3);
      for (let t = 1; t <= trunk; t++) data[idx(lx, h + t, lz)] = B.WOOD;
      const top = h + trunk;
      for (let dy = -1; dy <= 2; dy++) {
        const r = dy === 2 ? 1 : 2;
        for (let dz = -r; dz <= r; dz++) {
          for (let dx = -r; dx <= r; dx++) {
            if (r === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue; // rounded corners
            const i = idx(lx + dx, top + dy, lz + dz);
            if (data[i] === B.AIR) data[i] = B.LEAVES;
          }
        }
      }
    }
  }
}
