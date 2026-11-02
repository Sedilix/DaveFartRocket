import * as THREE from 'three';
import { damp } from '../core/animMath';

export interface QuellOptions {
  /** Standing height in metres. */
  height: number;
  body: number;
  /** Cheeks / antenna tip. */
  accent: number;
  hat?: number;
  /** false for Nomads (no antenna). */
  antenna?: boolean;
  /** Colour of a feather headdress. */
  headdress?: number;
}

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const mat = (c: number) => new THREE.MeshBasicMaterial({ color: c });

/** A Quell: soft, big-headed, big-eyed, built from blocks to match the voxel world. */
export class Quell {
  public group = new THREE.Group();
  public fainted = false;

  private root = new THREE.Group(); // scaled to the requested height
  private antennaTip: THREE.Mesh;
  private leftArm = new THREE.Group();
  private rightArm = new THREE.Group();
  private time = Math.random() * 10;
  private faintK = 0;
  private humming = false;
  private cheerTime = 0;

  constructor(opts: QuellOptions) {
    const s = opts.height / 2.0; // modelled 2.0 m tall
    this.root.scale.setScalar(s);
    this.group.add(this.root);

    const body = mat(opts.body);
    const dark = mat(0x1c1730);
    const white = mat(0xffffff);

    const legs = new THREE.Mesh(box(0.55, 0.5, 0.4), body);
    legs.position.y = 0.25;
    this.root.add(legs);

    const torso = new THREE.Mesh(box(0.75, 0.8, 0.5), body);
    torso.position.y = 0.9;
    this.root.add(torso);

    ([[this.leftArm, -0.45], [this.rightArm, 0.45]] as [THREE.Group, number][]).forEach(([pivot, x]) => {
      pivot.position.set(x, 1.22, 0);
      const arm = new THREE.Mesh(box(0.2, 0.6, 0.2), body);
      arm.position.y = -0.28;
      pivot.add(arm);
      this.root.add(pivot);
    });

    // Big head, bigger eyes
    const head = new THREE.Mesh(box(0.95, 0.75, 0.8), body);
    head.position.y = 1.6;
    this.root.add(head);

    ([-0.22, 0.22] as number[]).forEach((x) => {
      const eye = new THREE.Mesh(box(0.24, 0.3, 0.05), dark);
      eye.position.set(x, 1.62, 0.41);
      this.root.add(eye);
      const shine = new THREE.Mesh(box(0.08, 0.08, 0.05), white);
      shine.position.set(x + 0.04, 1.7, 0.44);
      this.root.add(shine);
      const cheek = new THREE.Mesh(box(0.16, 0.08, 0.04), mat(opts.accent));
      cheek.position.set(x * 1.6, 1.43, 0.41);
      this.root.add(cheek);
    });
    const mouth = new THREE.Mesh(box(0.14, 0.04, 0.04), dark);
    mouth.position.set(0, 1.4, 0.41);
    this.root.add(mouth);

    // Antenna with a glowing tip (Nomads have a hidden one so the animation code stays shared)
    this.antennaTip = new THREE.Mesh(box(0.16, 0.16, 0.16), mat(opts.accent));
    if (opts.antenna !== false) {
      const stalk = new THREE.Mesh(box(0.05, 0.35, 0.05), dark);
      stalk.position.set(0, 2.15, 0);
      this.root.add(stalk);
      this.antennaTip.position.set(0, 2.38, 0);
      this.root.add(this.antennaTip);
    }

    if (opts.headdress !== undefined) {
      const feather = mat(opts.headdress);
      [-0.3, -0.15, 0, 0.15, 0.3].forEach((x, i) => {
        const h = 0.55 - Math.abs(x) * 0.9;
        const f = new THREE.Mesh(box(0.1, h, 0.06), i % 2 ? feather : mat(0xf4f0e0));
        f.position.set(x, 2.0 + h / 2, 0);
        f.rotation.z = -x * 0.5;
        this.root.add(f);
      });
      const band = new THREE.Mesh(box(1.0, 0.1, 0.84), mat(0x8a3b2b));
      band.position.y = 1.97;
      this.root.add(band);
    }

    if (opts.hat !== undefined) {
      const cap = new THREE.Mesh(box(1.05, 0.2, 0.9), mat(opts.hat));
      cap.position.y = 2.0;
      this.root.add(cap);
      const badge = new THREE.Mesh(box(0.2, 0.12, 0.05), mat(0xf4d35e));
      badge.position.set(0, 2.0, 0.46);
      this.root.add(badge);
    }
  }

  public faint() {
    this.fainted = true;
  }

  public revive() {
    this.fainted = false;
    this.faintK = 0;
    this.root.rotation.z = 0;
    this.root.position.y = 0;
  }

  public cheer(seconds: number) {
    this.cheerTime = seconds;
  }

  public setHumming(on: boolean) {
    this.humming = on;
  }

  public lookAtPoint(x: number, z: number, dt: number) {
    const target = Math.atan2(x - this.group.position.x, z - this.group.position.z);
    const diff = Math.atan2(Math.sin(target - this.group.rotation.y), Math.cos(target - this.group.rotation.y));
    this.group.rotation.y += diff * (1 - Math.exp(-8 * dt));
  }

  public update(dt: number) {
    this.time += dt;
    // Fainting: topples sideways and lies there, one antenna twitching
    this.faintK = damp(this.faintK, this.fainted ? 1 : 0, 6, dt);
    this.root.rotation.z = this.faintK * (Math.PI / 2);
    this.root.position.y = this.faintK * 0.55;

    if (!this.fainted) {
      // Nervous breathing, sways when humming
      this.root.position.y = Math.sin(this.time * 2.2) * 0.02;
      this.root.rotation.z = this.humming ? Math.sin(this.time * 6) * 0.06 : 0;
      this.leftArm.rotation.z = -0.1 + Math.sin(this.time * 1.7) * 0.05;
      this.rightArm.rotation.z = 0.1 - Math.sin(this.time * 1.7) * 0.05;
    }
    if (this.cheerTime > 0 && !this.fainted) {
      this.cheerTime -= dt;
      this.leftArm.rotation.z = -2.6 - Math.sin(this.time * 14) * 0.3;
      this.rightArm.rotation.z = 2.6 + Math.sin(this.time * 14) * 0.3;
      this.root.position.y = Math.abs(Math.sin(this.time * 9)) * 0.28;
    }
    const pulse = this.humming ? 0.6 + 0.4 * Math.sin(this.time * 14) : 0.5 + 0.5 * Math.sin(this.time * 2.2);
    this.antennaTip.scale.setScalar(0.8 + pulse * 0.6);
  }
}
