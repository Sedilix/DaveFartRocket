import * as THREE from 'three';
import { B, isSolid } from './blocks';
import { CHUNK, WORLD_H, generateChunk, idx } from './terrain';
import { meshChunk, MeshData } from './mesher';

export class Chunk {
  public data = new Uint8Array(CHUNK * WORLD_H * CHUNK);
  public solidMesh: THREE.Mesh | null = null;
  public waterMesh: THREE.Mesh | null = null;
  public dirty = true;
  public modified = false;
  constructor(public cx: number, public cz: number) {}
}

export interface RayHit {
  x: number;
  y: number;
  z: number;
  /** The empty cell the ray passed through just before hitting (where a block would be placed). */
  px: number;
  py: number;
  pz: number;
  id: number;
}

const key = (cx: number, cz: number) => `${cx},${cz}`;

/** Streams chunks of blocks around the player and keeps their meshes up to date. */
export class VoxelWorld {
  public group = new THREE.Group();
  public radius = 6;
  private chunks = new Map<string, Chunk>();
  private saved = new Map<string, Uint8Array>(); // edited chunks that were unloaded
  private solidMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  private waterMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.72,
    depthWrite: false
  });

  constructor(public seed = 1337, private generator?: (data: Uint8Array, cx: number, cz: number) => void) {
    this.group.name = 'VoxelWorld';
  }

  public get loadedChunks() {
    return this.chunks.size;
  }

  public getBlock(wx: number, y: number, wz: number): number {
    if (y < 0) return B.STONE;
    if (y >= WORLD_H) return B.AIR;
    const c = this.chunks.get(key(Math.floor(wx / CHUNK), Math.floor(wz / CHUNK)));
    if (!c) return B.STONE; // not generated yet: treat as solid so no faces are drawn towards it
    return c.data[idx(((wx % CHUNK) + CHUNK) % CHUNK, y, ((wz % CHUNK) + CHUNK) % CHUNK)];
  }

  public setBlock(wx: number, y: number, wz: number, id: number) {
    if (y < 0 || y >= WORLD_H) return;
    const cx = Math.floor(wx / CHUNK);
    const cz = Math.floor(wz / CHUNK);
    const c = this.chunks.get(key(cx, cz));
    if (!c) return;
    const lx = ((wx % CHUNK) + CHUNK) % CHUNK;
    const lz = ((wz % CHUNK) + CHUNK) % CHUNK;
    c.data[idx(lx, y, lz)] = id;
    c.modified = true;
    this.remesh(c);
    // Edits on a chunk border change the faces of the neighbour too
    if (lx === 0) this.remeshAt(cx - 1, cz);
    if (lx === CHUNK - 1) this.remeshAt(cx + 1, cz);
    if (lz === 0) this.remeshAt(cx, cz - 1);
    if (lz === CHUNK - 1) this.remeshAt(cx, cz + 1);
  }

  private remeshAt(cx: number, cz: number) {
    const c = this.chunks.get(key(cx, cz));
    if (c) this.remesh(c);
  }

  /** Highest solid block of a column (or -1). */
  public surfaceY(wx: number, wz: number): number {
    for (let y = WORLD_H - 1; y >= 0; y--) if (isSolid(this.getBlock(wx, y, wz))) return y;
    return -1;
  }

  /** Generates (synchronously) every chunk within `r` chunks of the world position. */
  public preload(wx: number, wz: number, r: number) {
    const ccx = Math.floor(wx / CHUNK);
    const ccz = Math.floor(wz / CHUNK);
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) this.ensure(ccx + dx, ccz + dz);
    this.chunks.forEach((c) => {
      if (c.dirty) this.remesh(c);
    });
  }

  private ensure(cx: number, cz: number): Chunk {
    const k = key(cx, cz);
    let c = this.chunks.get(k);
    if (c) return c;
    c = new Chunk(cx, cz);
    const saved = this.saved.get(k);
    if (saved) {
      c.data.set(saved);
      c.modified = true;
      this.saved.delete(k);
    } else {
      if (this.generator) this.generator(c.data, cx, cz);
      else generateChunk(c.data, cx, cz, this.seed);
    }
    this.chunks.set(k, c);
    // Neighbours drew their border faces against "solid"; redraw them now that this chunk exists
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dz]) => {
      const n = this.chunks.get(key(cx + dx, cz + dz));
      if (n) n.dirty = true;
    });
    return c;
  }

  /** Streams chunks around (px, pz) within a time budget in milliseconds. */
  public update(px: number, pz: number, budgetMs = 6) {
    const start = performance.now();
    const ccx = Math.floor(px / CHUNK);
    const ccz = Math.floor(pz / CHUNK);

    // Unload far chunks (edited ones are remembered)
    this.chunks.forEach((c, k) => {
      if (Math.max(Math.abs(c.cx - ccx), Math.abs(c.cz - ccz)) > this.radius + 2) {
        if (c.modified) this.saved.set(k, c.data);
        this.disposeMeshes(c);
        this.chunks.delete(k);
      }
    });

    // Generate missing chunks, nearest first
    const missing: [number, number, number][] = [];
    for (let dz = -this.radius; dz <= this.radius; dz++) {
      for (let dx = -this.radius; dx <= this.radius; dx++) {
        if (!this.chunks.has(key(ccx + dx, ccz + dz))) missing.push([dx * dx + dz * dz, ccx + dx, ccz + dz]);
      }
    }
    missing.sort((a, b) => a[0] - b[0]);
    for (const [, cx, cz] of missing) {
      if (performance.now() - start > budgetMs * 0.5) break;
      this.ensure(cx, cz);
    }

    // Mesh dirty chunks, nearest first
    const dirty: Chunk[] = [];
    this.chunks.forEach((c) => {
      if (c.dirty) dirty.push(c);
    });
    dirty.sort((a, b) => (a.cx - ccx) ** 2 + (a.cz - ccz) ** 2 - ((b.cx - ccx) ** 2 + (b.cz - ccz) ** 2));
    for (const c of dirty) {
      if (performance.now() - start > budgetMs) break;
      this.remesh(c);
    }
  }

  private remesh(c: Chunk) {
    c.dirty = false;
    const { solid, water } = meshChunk(this, c);
    c.solidMesh = this.applyMesh(c, c.solidMesh, solid, this.solidMat);
    c.waterMesh = this.applyMesh(c, c.waterMesh, water, this.waterMat);
  }

  private applyMesh(c: Chunk, old: THREE.Mesh | null, data: MeshData | null, mat: THREE.Material): THREE.Mesh | null {
    if (old) {
      this.group.remove(old);
      old.geometry.dispose();
    }
    if (!data) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
    g.setIndex(new THREE.BufferAttribute(data.indices, 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.position.set(c.cx * CHUNK, 0, c.cz * CHUNK);
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    if (mat === this.waterMat) m.renderOrder = 1;
    this.group.add(m);
    return m;
  }

  private disposeMeshes(c: Chunk) {
    [c.solidMesh, c.waterMesh].forEach((m) => {
      if (m) {
        this.group.remove(m);
        m.geometry.dispose();
      }
    });
    c.solidMesh = c.waterMesh = null;
  }

  /** Voxel ray cast (Amanatides & Woo). Water is ignored. */
  public raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): RayHit | null {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);
    const stepX = dir.x > 0 ? 1 : -1;
    const stepY = dir.y > 0 ? 1 : -1;
    const stepZ = dir.z > 0 ? 1 : -1;
    const tDeltaX = dir.x === 0 ? Infinity : Math.abs(1 / dir.x);
    const tDeltaY = dir.y === 0 ? Infinity : Math.abs(1 / dir.y);
    const tDeltaZ = dir.z === 0 ? Infinity : Math.abs(1 / dir.z);
    let tMaxX = dir.x === 0 ? Infinity : (dir.x > 0 ? x + 1 - origin.x : origin.x - x) * tDeltaX;
    let tMaxY = dir.y === 0 ? Infinity : (dir.y > 0 ? y + 1 - origin.y : origin.y - y) * tDeltaY;
    let tMaxZ = dir.z === 0 ? Infinity : (dir.z > 0 ? z + 1 - origin.z : origin.z - z) * tDeltaZ;
    let px = x;
    let py = y;
    let pz = z;
    let t = 0;
    while (t <= maxDist) {
      const id = this.getBlock(x, y, z);
      if (isSolid(id)) return { x, y, z, px, py, pz, id };
      px = x;
      py = y;
      pz = z;
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX;
        t = tMaxX;
        tMaxX += tDeltaX;
      } else if (tMaxY < tMaxZ) {
        y += stepY;
        t = tMaxY;
        tMaxY += tDeltaY;
      } else {
        z += stepZ;
        t = tMaxZ;
        tMaxZ += tDeltaZ;
      }
    }
    return null;
  }
}
