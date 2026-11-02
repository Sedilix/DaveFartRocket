import * as THREE from 'three';
import { VoxelWorld } from './VoxelWorld';
import { Dave } from '../entities/Dave';
import { physicsWorld } from '../core/Physics';
import { B, BLOCKS, HOTBAR, isSolid } from './blocks';
import { SEA, heightAt } from './terrain';

export interface VoxelOptions {
  seed?: number;
  generator?: (data: Uint8Array, cx: number, cz: number) => void;
  /** Fixed spawn (feet position); otherwise dry land near the origin is found. */
  spawn?: THREE.Vector3;
  /** false hides the hotbar and disables breaking / placing (story scenes). */
  sandbox?: boolean;
  sky?: number;
  radius?: number;
  fog?: boolean;
}

const SKY = 0x8ec9ef;
const PLAYER_HALF = 0.3;
const PLAYER_HEIGHT = 1.8;
const GRAVITY = 26;
const JUMP_SPEED = 8.4;
const REACH = 7;

/**
 * Voxel sandbox mode: streamed block terrain, Dave as the player, break/place blocks.
 * Entry point is `?mode=voxel`.
 */
export class VoxelGame {
  protected renderer: THREE.WebGLRenderer;
  protected scene = new THREE.Scene();
  protected camera: THREE.PerspectiveCamera;
  protected world: VoxelWorld;
  protected dave = new Dave();
  protected pos = new THREE.Vector3();
  protected vy = 0;
  protected onGround = false;

  protected yaw = 0.6;
  protected pitch = 0.35;
  protected camDist = 6;
  protected keys = new Set<string>();
  private selected = 0;
  protected locked = false;

  private highlight: THREE.LineSegments;
  private hitCache = { hit: null as ReturnType<VoxelWorld['raycast']> };
  protected hotbarEl!: HTMLElement;
  protected infoEl!: HTMLElement;
  private moveInput = { x: 0, y: 0 };
  protected last = performance.now();
  private fps = 60;

  protected tmpDir = new THREE.Vector3();
  protected tmpHead = new THREE.Vector3();

  protected frozen = false; // story scenes freeze player input
  protected shake = 0;
  /** Horizontal velocity added by story abilities (fart boosts); decays on its own. */
  protected extraVel = new THREE.Vector3();
  protected opts: VoxelOptions;

  constructor(container: HTMLElement, opts: VoxelOptions = {}) {
    this.opts = opts;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    const sky = opts.sky ?? SKY;
    this.scene.background = new THREE.Color(sky);
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 400);

    this.world = new VoxelWorld(opts.seed ?? Math.floor(Math.random() * 100000), opts.generator);
    if (opts.radius) this.world.radius = opts.radius;
    this.scene.add(this.world.group);
    const reach = this.world.radius * 16;
    if (opts.fog !== false) this.scene.fog = new THREE.Fog(sky, reach * 0.55, reach * 0.95);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    this.scene.add(new THREE.DirectionalLight(0xfff2d6, 0.9));

    this.scene.add(this.dave.group);

    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004));
    this.highlight = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x111111 }));
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    if (opts.sandbox !== false) this.buildHud();
    else this.buildStoryHud();
    this.bindInput();
    this.spawn();
    window.addEventListener('resize', () => this.onResize());
  }

  public start() {
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  protected spawn() {
    if (this.opts.spawn) {
      this.world.preload(this.opts.spawn.x, this.opts.spawn.z, this.world.radius);
      this.pos.copy(this.opts.spawn);
      this.vy = 0;
      this.dave.group.position.copy(this.pos);
      return;
    }
    // Find dry land near the origin
    let sx = 8;
    for (let i = 0; i < 80; i++, sx += 12) {
      if (heightAt(sx, 8, this.world.seed) > SEA + 2) break;
    }
    this.world.preload(sx, 8, 3);
    const y = this.world.surfaceY(sx, 8);
    this.pos.set(sx + 0.5, y + 1.01, 8.5);
    this.dave.group.position.copy(this.pos);
  }

  // ---------------------------------------------------------------- input / HUD

  private buildHud() {
    const root = document.createElement('div');
    root.style.cssText = 'position:fixed;inset:0;pointer-events:none;font-family:system-ui,sans-serif;color:#fff;z-index:10';
    root.innerHTML = `
      <div style="position:absolute;left:50%;top:50%;width:18px;height:18px;transform:translate(-50%,-50%)">
        <div style="position:absolute;left:8px;top:0;width:2px;height:18px;background:#fff;opacity:.85;mix-blend-mode:difference"></div>
        <div style="position:absolute;top:8px;left:0;height:2px;width:18px;background:#fff;opacity:.85;mix-blend-mode:difference"></div>
      </div>
      <div id="vx-info" style="position:absolute;left:12px;top:10px;font-size:12px;line-height:1.5;text-shadow:0 1px 3px #000;opacity:.9"></div>
      <div id="vx-help" style="position:absolute;left:50%;top:18%;transform:translateX(-50%);padding:10px 16px;border-radius:12px;background:rgba(20,26,38,.78);font-size:14px;text-align:center;line-height:1.6">
        Click to capture the mouse<br><span style="opacity:.75">WASD move · Space jump / swim · Mouse look · Left click break · Right click place · 1-9 or wheel to pick a block</span>
      </div>
      <div id="vx-hotbar" style="position:absolute;left:50%;bottom:16px;transform:translateX(-50%);display:flex;gap:6px"></div>`;
    document.body.appendChild(root);
    this.infoEl = root.querySelector('#vx-info') as HTMLElement;
    this.hotbarEl = root.querySelector('#vx-hotbar') as HTMLElement;
    this.renderHotbar();
  }

  private buildStoryHud() {
    this.infoEl = document.createElement('div');
    this.hotbarEl = document.createElement('div');
  }

  private renderHotbar() {
    this.hotbarEl.innerHTML = '';
    HOTBAR.forEach((id, i) => {
      const slot = document.createElement('div');
      const hex = '#' + BLOCKS[id].top.toString(16).padStart(6, '0');
      const sel = i === this.selected;
      slot.style.cssText = `width:46px;height:46px;border-radius:8px;background:${hex};border:3px solid ${sel ? '#fff' : 'rgba(0,0,0,.45)'};box-shadow:0 2px 6px rgba(0,0,0,.4);position:relative;transform:scale(${sel ? 1.12 : 1})`;
      slot.innerHTML = `<span style="position:absolute;left:3px;top:1px;font-size:11px;text-shadow:0 1px 2px #000">${i + 1}</span>
        <span style="position:absolute;left:0;right:0;bottom:1px;text-align:center;font-size:9px;text-shadow:0 1px 2px #000">${BLOCKS[id].name}</span>`;
      this.hotbarEl.appendChild(slot);
    });
  }

  private bindInput() {
    const canvas = this.renderer.domElement;
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.slice(5), 10) - 1;
        if (n >= 0 && n < HOTBAR.length) {
          this.selected = n;
          this.renderHotbar();
        }
      }
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('click', () => {
      if (!this.locked) canvas.requestPointerLock?.();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      const help = document.getElementById('vx-help');
      if (help) help.style.display = this.locked ? 'none' : 'block';
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0025;
      this.pitch = THREE.MathUtils.clamp(this.pitch + e.movementY * 0.0025, -1.3, 1.45);
    });
    window.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) this.breakBlock();
      else if (e.button === 2) this.placeBlock();
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener(
      'wheel',
      (e) => {
        this.selected = (this.selected + (e.deltaY > 0 ? 1 : HOTBAR.length - 1)) % HOTBAR.length;
        this.renderHotbar();
      },
      { passive: true }
    );
  }

  private onResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- interaction

  private breakBlock() {
    if (this.opts.sandbox === false) return;
    const hit = this.hitCache.hit;
    if (!hit || hit.y <= 0) return;
    this.world.setBlock(hit.x, hit.y, hit.z, B.AIR);
  }

  private placeBlock() {
    if (this.opts.sandbox === false) return;
    const hit = this.hitCache.hit;
    if (!hit) return;
    const existing = this.world.getBlock(hit.px, hit.py, hit.pz);
    if (existing !== B.AIR && existing !== B.WATER) return;
    // Do not wall Dave into the block he stands in
    const overlaps =
      hit.px + 1 > this.pos.x - PLAYER_HALF &&
      hit.px < this.pos.x + PLAYER_HALF &&
      hit.pz + 1 > this.pos.z - PLAYER_HALF &&
      hit.pz < this.pos.z + PLAYER_HALF &&
      hit.py + 1 > this.pos.y &&
      hit.py < this.pos.y + PLAYER_HEIGHT;
    if (overlaps) return;
    this.world.setBlock(hit.px, hit.py, hit.pz, HOTBAR[this.selected]);
  }

  // ---------------------------------------------------------------- simulation

  private collides(x: number, y: number, z: number): boolean {
    const x0 = Math.floor(x - PLAYER_HALF);
    const x1 = Math.floor(x + PLAYER_HALF);
    const z0 = Math.floor(z - PLAYER_HALF);
    const z1 = Math.floor(z + PLAYER_HALF);
    const y0 = Math.floor(y);
    const y1 = Math.floor(y + PLAYER_HEIGHT - 0.01);
    for (let by = y0; by <= y1; by++) {
      for (let bz = z0; bz <= z1; bz++) {
        for (let bx = x0; bx <= x1; bx++) {
          if (isSolid(this.world.getBlock(bx, by, bz))) return true;
        }
      }
    }
    return false;
  }

  private stepPlayer(dt: number) {
    // Camera-relative input
    const f = this.frozen ? 0 : (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    const r = this.frozen ? 0 : (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    let wx = fx * f + -fz * r;
    let wz = fz * f + fx * r;
    const len = Math.hypot(wx, wz);
    if (len > 1) {
      wx /= len;
      wz /= len;
    }
    this.moveInput.x = wx;
    this.moveInput.y = -wz; // Dave.update moves z by -y

    // Let Dave animate and face his heading; his own displacement is replaced by voxel collision
    const before = this.dave.group.position.clone();
    this.dave.group.position.copy(this.pos);
    this.dave.update(dt, this.moveInput, physicsWorld);
    let dx = this.dave.group.position.x - this.pos.x;
    let dz = this.dave.group.position.z - this.pos.z;
    dx += this.extraVel.x * dt;
    dz += this.extraVel.z * dt;
    const decay = Math.exp(-2.2 * dt);
    this.extraVel.x *= decay;
    this.extraVel.z *= decay;
    void before;

    const feetId = this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.4), Math.floor(this.pos.z));
    const inWater = feetId === B.WATER;
    const swimK = inWater ? 0.55 : 1;

    // Horizontal, axis by axis; bumping a one-block step while grounded auto-jumps
    let blocked = false;
    const nx = this.pos.x + dx * swimK;
    if (!this.collides(nx, this.pos.y, this.pos.z)) this.pos.x = nx;
    else if (dx !== 0) blocked = true;
    const nz = this.pos.z + dz * swimK;
    if (!this.collides(this.pos.x, this.pos.y, nz)) this.pos.z = nz;
    else if (dz !== 0) blocked = true;
    if (blocked && this.onGround && !this.collides(this.pos.x + Math.sign(dx) * 0.5, this.pos.y + 1.02, this.pos.z + Math.sign(dz) * 0.5)) {
      this.vy = JUMP_SPEED;
    }

    // Vertical
    if (inWater) {
      this.vy = THREE.MathUtils.lerp(this.vy, this.keys.has('Space') && !this.frozen ? 4.2 : -2.2, 1 - Math.exp(-6 * dt));
    } else {
      if (this.keys.has('Space') && !this.frozen && this.onGround) this.vy = JUMP_SPEED;
      this.vy = Math.max(-45, this.vy - GRAVITY * dt);
    }
    const ny = this.pos.y + this.vy * dt;
    this.onGround = false;
    if (!this.collides(this.pos.x, ny, this.pos.z)) {
      this.pos.y = ny;
    } else {
      if (this.vy < 0) {
        const snapped = Math.floor(ny) + 1;
        if (!this.collides(this.pos.x, snapped, this.pos.z)) this.pos.y = snapped;
        this.onGround = true;
      }
      this.vy = 0;
    }

    if (this.pos.y < -20) this.spawn();
    this.dave.group.position.copy(this.pos);
  }

  private updateCamera() {
    const head = this.tmpHead.set(this.pos.x, this.pos.y + 1.55, this.pos.z);
    const dir = this.tmpDir.set(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch)
    );
    // Pull the camera in when terrain is in the way
    let dist = this.camDist;
    for (let t = 0.4; t <= this.camDist; t += 0.15) {
      if (isSolid(this.world.getBlock(Math.floor(head.x + dir.x * t), Math.floor(head.y + dir.y * t), Math.floor(head.z + dir.z * t)))) {
        dist = Math.max(0.6, t - 0.3);
        break;
      }
    }
    this.camera.position.copy(head).addScaledVector(dir, dist);
    if (this.shake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake *= 0.9;
    }
    this.camera.lookAt(head);
    // Hide Dave when the camera is right inside him
    this.dave.group.visible = dist > 1.2;
  }

  private updateTarget() {
    const dir = this.camera.getWorldDirection(this.tmpDir);
    const hit = this.world.raycast(this.camera.position, dir, REACH + this.camDist);
    // Only blocks within reach of the player count
    if (hit) {
      const d = Math.hypot(hit.x + 0.5 - this.pos.x, hit.y + 0.5 - (this.pos.y + 1), hit.z + 0.5 - this.pos.z);
      this.hitCache.hit = d <= REACH ? hit : null;
    } else {
      this.hitCache.hit = null;
    }
    const h = this.hitCache.hit;
    this.highlight.visible = !!h;
    if (h) this.highlight.position.set(h.x + 0.5, h.y + 0.5, h.z + 0.5);
  }

  /** Story scenes hook in here (before the player is stepped). */
  protected onFrame(_dt: number): void {}

  private frame(now: number) {
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.fps += (1 / Math.max(dt, 1e-4) - this.fps) * 0.05;

    this.world.update(this.pos.x, this.pos.z, 7);
    this.onFrame(dt);
    this.stepPlayer(dt);
    this.updateCamera();
    this.updateTarget();

    if (this.opts.sandbox !== false) this.infoEl.textContent = `${Math.round(this.fps)} fps · chunks ${this.world.loadedChunks} · x ${this.pos.x.toFixed(0)} y ${this.pos.y.toFixed(0)} z ${this.pos.z.toFixed(0)}`;
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame((t) => this.frame(t));
  }
}
