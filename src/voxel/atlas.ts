import * as THREE from 'three';
import { B, BLOCKS } from './blocks';

/**
 * Procedural 16x16 texture atlas for voxels.
 * Zero-asset: generates crisp chunky textures at runtime via 2D Canvas.
 */

const TILE_SIZE = 16;
const ATLAS_TILES_PER_ROW = 8;
const ATLAS_SIZE = TILE_SIZE * ATLAS_TILES_PER_ROW; // 128x128

// PRNG for deterministic texture generation
function pseudoNoise(x: number, y: number, seed = 42): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

export class VoxelTextureAtlas {
  private static instance: VoxelTextureAtlas | null = null;
  public texture: THREE.CanvasTexture;
  public canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  public static getInstance(): VoxelTextureAtlas {
    if (!VoxelTextureAtlas.instance) {
      VoxelTextureAtlas.instance = new VoxelTextureAtlas();
    }
    return VoxelTextureAtlas.instance;
  }

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = ATLAS_SIZE;
    this.canvas.height = ATLAS_SIZE;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;

    this.generate();

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestMipmapLinearFilter;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = true;
  }

  /** Gets UV coordinates [u0, v0, u1, v1] for a block ID and face part ('top' | 'side' | 'bottom') */
  public getTileUV(blockId: number, part: 'top' | 'side' | 'bottom'): { u0: number; v0: number; u1: number; v1: number } {
    // Map blockId + part offset to a tile index (0 to 63)
    let tileIndex = (blockId * 2 + (part === 'top' ? 0 : 1)) % (ATLAS_TILES_PER_ROW * ATLAS_TILES_PER_ROW);

    const col = tileIndex % ATLAS_TILES_PER_ROW;
    const row = Math.floor(tileIndex / ATLAS_TILES_PER_ROW);

    const u0 = col / ATLAS_TILES_PER_ROW;
    const u1 = (col + 1) / ATLAS_TILES_PER_ROW;
    // Canvas Y is top-down, WebGL V is bottom-up
    const v1 = 1 - row / ATLAS_TILES_PER_ROW;
    const v0 = 1 - (row + 1) / ATLAS_TILES_PER_ROW;

    return { u0, v0, u1, v1 };
  }

  private generate() {
    const ctx = this.ctx;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

    for (let id = 1; id < BLOCKS.length; id++) {
      const info = BLOCKS[id];

      // Draw Top Tile
      const topIdx = (id * 2) % 64;
      this.drawTile(topIdx, info.top, id, 'top');

      // Draw Side/Bottom Tile
      const sideIdx = (id * 2 + 1) % 64;
      this.drawTile(sideIdx, info.side, id, 'side');
    }
  }

  private drawTile(tileIndex: number, baseHex: number, id: number, part: 'top' | 'side') {
    const ctx = this.ctx;
    const col = tileIndex % ATLAS_TILES_PER_ROW;
    const row = Math.floor(tileIndex / ATLAS_TILES_PER_ROW);
    const ox = col * TILE_SIZE;
    const oy = row * TILE_SIZE;

    const baseColor = new THREE.Color(baseHex);
    const r = Math.round(baseColor.r * 255);
    const g = Math.round(baseColor.g * 255);
    const b = Math.round(baseColor.b * 255);

    // Fill base
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(ox, oy, TILE_SIZE, TILE_SIZE);

    // Add per-block pixel procedural detailing
    const imgData = ctx.getImageData(ox, oy, TILE_SIZE, TILE_SIZE);
    const data = imgData.data;

    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const pIdx = (y * TILE_SIZE + x) * 4;
        const noise = (pseudoNoise(x + ox, y + oy, id * 17) - 0.5) * 42;

        let delta = noise;

        // Custom stylized patterns
        if (id === B.PLANKS) {
          // Horizontal wood seams
          if (y % 4 === 0) delta -= 38;
          if (x === 0 || x === 8) delta -= 25;
        } else if (id === B.BRICK) {
          // Brick mortar pattern
          const rowY = Math.floor(y / 4);
          const isMortarY = y % 4 === 3;
          const shift = (rowY % 2) * 4;
          const isMortarX = (x + shift) % 8 === 7;
          if (isMortarY || isMortarX) {
            data[pIdx] = 210;
            data[pIdx + 1] = 210;
            data[pIdx + 2] = 205;
            continue;
          }
        } else if (id === B.HULL || id === B.PANEL) {
          // Sci-fi beveled border
          if (x === 0 || y === 0) delta += 30;
          if (x === 15 || y === 15) delta -= 35;
          if ((x === 2 || x === 13) && (y === 2 || y === 13)) delta += 40; // rivets
        } else if (id === B.GLOW || id === B.TORCH) {
          // Radial glow center
          const dist = Math.hypot(x - 7.5, y - 7.5);
          delta += (7 - dist) * 12;
        } else if (id === B.ICE) {
          // Crystalline diagonal gleam
          if ((x + y) % 6 === 0) delta += 35;
          if ((x - y) % 7 === 0) delta -= 25;
        } else if (id === B.GRASS && part === 'side') {
          // Grass overhang spikes on side
          if (y < 4 || (y === 4 && (x % 3 === 0))) {
            data[pIdx] = 95;
            data[pIdx + 1] = 168;
            data[pIdx + 2] = 60;
            continue;
          }
        }

        data[pIdx] = Math.max(0, Math.min(255, data[pIdx] + delta));
        data[pIdx + 1] = Math.max(0, Math.min(255, data[pIdx + 1] + delta));
        data[pIdx + 2] = Math.max(0, Math.min(255, data[pIdx + 2] + delta));
      }
    }

    ctx.putImageData(imgData, ox, oy);
  }
}

export const voxelAtlas = VoxelTextureAtlas.getInstance();
