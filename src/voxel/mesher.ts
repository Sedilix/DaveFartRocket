import * as THREE from 'three';
import { B, BLOCKS, isSolid, shouldDrawFace } from './blocks';
import { CHUNK, WORLD_H, hash2, idx } from './terrain';
import type { Chunk } from './VoxelWorld';
import type { VoxelWorld } from './VoxelWorld';
import { voxelAtlas } from './atlas';

interface Face {
  n: [number, number, number];
  corners: [number, number, number][];
  shade: number;
  part: 'top' | 'side' | 'bottom';
}

// Corner order is counter-clockwise seen from outside
const FACES: Face[] = [
  { n: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], shade: 0.82, part: 'side' },
  { n: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], shade: 0.82, part: 'side' },
  { n: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0, part: 'top' },
  { n: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.55, part: 'bottom' },
  { n: [0, 0, 1], corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], shade: 0.9, part: 'side' },
  { n: [0, 0, -1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], shade: 0.7, part: 'side' }
];

const AO_LEVELS = [0.5, 0.68, 0.85, 1.0];
const color = new THREE.Color();

export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
}

class Builder {
  positions: number[] = [];
  normals: number[] = [];
  uvs: number[] = [];
  colors: number[] = [];
  indices: number[] = [];
  get empty() {
    return this.indices.length === 0;
  }
  finish(): MeshData {
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      uvs: new Float32Array(this.uvs),
      colors: new Float32Array(this.colors),
      indices: new Uint32Array(this.indices)
    };
  }
}

/** Builds the opaque and the water geometry of a chunk with hidden faces culled and per-vertex ambient occlusion. */
export function meshChunk(world: VoxelWorld, chunk: Chunk): { solid: MeshData | null; water: MeshData | null } {
  const solid = new Builder();
  const water = new Builder();
  const ox = chunk.cx * CHUNK;
  const oz = chunk.cz * CHUNK;
  const data = chunk.data;

  const opaque = (wx: number, wy: number, wz: number) => {
    const id = world.getBlock(wx, wy, wz);
    return isSolid(id) && id !== B.LEAVES && id !== B.GLASS ? 1 : 0;
  };

  for (let y = 0; y < WORLD_H; y++) {
    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const id = data[idx(lx, y, lz)];
        if (id === B.AIR) continue;
        const wx = ox + lx;
        const wz = oz + lz;
        const info = BLOCKS[id];
        const isWater = id === B.WATER;
        const b = isWater ? water : solid;
        const tint = 0.94 + hash2(wx * 7 + y, wz * 13 - y, 99) * 0.12; // per-block variation

        for (const f of FACES) {
          const nx = wx + f.n[0];
          const ny = y + f.n[1];
          const nz = wz + f.n[2];
          const neighbour = ny < 0 ? B.STONE : ny >= WORLD_H ? B.AIR : world.getBlock(nx, ny, nz);
          if (!shouldDrawFace(id, neighbour)) continue;
          if (isWater && f.part === 'bottom') continue;

          const base = f.part === 'top' ? info.top : f.part === 'bottom' ? info.bottom : info.side;
          const base0 = b.positions.length / 3;
          const ao: number[] = [];
          const uv = voxelAtlas.getTileUV(id, f.part);
          const UV_MAP = [
            [uv.u0, uv.v0],
            [uv.u0, uv.v1],
            [uv.u1, uv.v1],
            [uv.u1, uv.v0]
          ];

          for (let c = 0; c < 4; c++) {
            const [cx, cy, cz] = f.corners[c];
            let level = 3;
            if (!isWater) {
              // The two tangent axes of this face point towards the corner
              const t: [number, number, number][] = [];
              for (let axis = 0; axis < 3; axis++) {
                if (f.n[axis] !== 0) continue;
                const s = (axis === 0 ? cx : axis === 1 ? cy : cz) === 1 ? 1 : -1;
                const v: [number, number, number] = [0, 0, 0];
                v[axis] = s;
                t.push(v);
              }
              const s1 = opaque(nx + t[0][0], ny + t[0][1], nz + t[0][2]);
              const s2 = opaque(nx + t[1][0], ny + t[1][1], nz + t[1][2]);
              const cr = opaque(nx + t[0][0] + t[1][0], ny + t[0][1] + t[1][1], nz + t[0][2] + t[1][2]);
              level = s1 && s2 ? 0 : 3 - (s1 + s2 + cr);
            }
            ao.push(level);

            // Water surface sits slightly below the block top
            const py = isWater && cy === 1 ? y + 0.88 : y + cy;
            b.positions.push(lx + cx, py, lz + cz);
            b.normals.push(f.n[0], f.n[1], f.n[2]);
            b.uvs.push(UV_MAP[c][0], UV_MAP[c][1]);

            color.setHex(base);
            // Real lighting handles directional face shading; retain baked vertex AO and subtle tint
            const k = AO_LEVELS[level] * tint;
            b.colors.push(color.r * k, color.g * k, color.b * k);
          }

          // Flip the diagonal so the AO gradient does not show a seam
          if (ao[0] + ao[2] < ao[1] + ao[3]) {
            b.indices.push(base0 + 1, base0 + 2, base0 + 3, base0 + 1, base0 + 3, base0);
          } else {
            b.indices.push(base0, base0 + 1, base0 + 2, base0, base0 + 2, base0 + 3);
          }
        }
      }
    }
  }

  return { solid: solid.empty ? null : solid.finish(), water: water.empty ? null : water.finish() };
}
