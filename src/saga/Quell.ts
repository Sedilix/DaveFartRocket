import * as THREE from 'three';
import { damp } from '../core/animMath';

export type QuellMood = 'neutral' | 'worried' | 'delighted' | 'horrified' | 'deadpan' | 'smug';

export interface QuellOptions {
  /** Standing height in metres. */
  height: number;
  body: number;
  /** Cheeks / antenna tip / accents. */
  accent: number;
  hat?: number;
  /** false for Nomads (no antenna). */
  antenna?: boolean;
  /** Colour of a feather headdress. */
  headdress?: number;
  /** Chef hat or Elder hood */
  role?: 'captain' | 'pim' | 'elder' | 'chef' | 'toot' | 'nomad';
}

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const lambertMat = (c: number, roughness = 0.8) =>
  new THREE.MeshStandardMaterial({
    color: c,
    roughness,
    metalness: 0.1
  });

/**
 * High-fidelity lit character rig for the Saga cast (Quell, Nomads, Captain, Pim, Glorb, Elder, Toot).
 * Features articulated legs, walk cycles, gaze tracking, mood expressions, and reactive glowing antenna.
 */
export class Quell {
  public group = new THREE.Group();
  public fainted = false;
  public mood: QuellMood = 'neutral';

  private root = new THREE.Group();
  private headPivot = new THREE.Group();
  private leftLeg = new THREE.Group();
  private rightLeg = new THREE.Group();
  private leftArm = new THREE.Group();
  private rightArm = new THREE.Group();

  // Face elements
  private leftBrow!: THREE.Mesh;
  private rightBrow!: THREE.Mesh;
  private leftEye!: THREE.Mesh;
  private rightEye!: THREE.Mesh;
  private mouth!: THREE.Mesh;
  private antennaTip?: THREE.Mesh;
  private headdressGroup?: THREE.Group;

  private time = Math.random() * 10;
  private faintK = 0;
  private humming = false;
  private cheerTime = 0;
  private walkPhase = 0;
  private walkSpeed = 0;

  // Gaze tracking
  private targetLook = new THREE.Vector2();
  private currentLook = new THREE.Vector2();

  constructor(opts: QuellOptions) {
    const s = opts.height / 2.0;
    this.root.scale.setScalar(s);
    this.group.add(this.root);

    const bodyMat = lambertMat(opts.body);
    const darkMat = lambertMat(0x181424, 0.6);
    const whiteMat = lambertMat(0xffffff, 0.4);
    const accentMat = lambertMat(opts.accent);

    // 1. Legs (Articulated left/right for walking)
    const legGeo = box(0.24, 0.5, 0.26);
    const makeLeg = (x: number): THREE.Group => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.5, 0);
      const mesh = new THREE.Mesh(legGeo, bodyMat);
      mesh.position.y = -0.25;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      pivot.add(mesh);
      this.root.add(pivot);
      return pivot;
    };
    this.leftLeg = makeLeg(-0.16);
    this.rightLeg = makeLeg(0.16);

    // 2. Torso (Soft pear shape)
    const torsoMesh = new THREE.Mesh(box(0.72, 0.78, 0.48), bodyMat);
    torsoMesh.position.y = 0.9;
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    this.root.add(torsoMesh);

    // 3. Arms (Articulated shoulder pivots)
    const armGeo = box(0.18, 0.58, 0.18);
    const makeArm = (x: number): THREE.Group => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 1.24, 0);
      const mesh = new THREE.Mesh(armGeo, bodyMat);
      mesh.position.y = -0.26;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      pivot.add(mesh);
      this.root.add(pivot);
      return pivot;
    };
    this.leftArm = makeArm(-0.46);
    this.rightArm = makeArm(0.46);

    // 4. Head with Gaze Pivot
    this.headPivot.position.set(0, 1.45, 0);
    this.root.add(this.headPivot);

    const headMesh = new THREE.Mesh(box(0.92, 0.74, 0.78), bodyMat);
    headMesh.position.y = 0.25;
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    this.headPivot.add(headMesh);

    // 5. Expressive Eyes & Cheeks
    const eyeGeo = box(0.24, 0.3, 0.04);
    const shineGeo = box(0.08, 0.08, 0.05);
    const browGeo = box(0.2, 0.04, 0.04);

    [-0.22, 0.22].forEach((x, i) => {
      const eye = new THREE.Mesh(eyeGeo, darkMat);
      eye.position.set(x, 0.26, 0.4);
      this.headPivot.add(eye);
      if (i === 0) this.leftEye = eye;
      else this.rightEye = eye;

      const shine = new THREE.Mesh(shineGeo, whiteMat);
      shine.position.set(x + 0.04, 0.34, 0.42);
      this.headPivot.add(shine);

      const cheek = new THREE.Mesh(box(0.16, 0.08, 0.04), accentMat);
      cheek.position.set(x * 1.6, 0.08, 0.4);
      this.headPivot.add(cheek);

      const brow = new THREE.Mesh(browGeo, darkMat);
      brow.position.set(x, 0.44, 0.4);
      this.headPivot.add(brow);
      if (i === 0) this.leftBrow = brow;
      else this.rightBrow = brow;
    });

    // Mouth
    this.mouth = new THREE.Mesh(box(0.14, 0.04, 0.04), darkMat);
    this.mouth.position.set(0, 0.06, 0.4);
    this.headPivot.add(this.mouth);

    // 6. Reactive Antenna
    if (opts.antenna !== false) {
      const stalk = new THREE.Mesh(box(0.05, 0.32, 0.05), darkMat);
      stalk.position.set(0, 0.75, 0);
      this.headPivot.add(stalk);

      const tipMat = new THREE.MeshStandardMaterial({
        color: opts.accent,
        emissive: opts.accent,
        emissiveIntensity: 0.6,
        roughness: 0.2
      });
      this.antennaTip = new THREE.Mesh(box(0.16, 0.16, 0.16), tipMat);
      this.antennaTip.position.set(0, 0.95, 0);
      this.headPivot.add(this.antennaTip);
    }

    // 7. Role / Species Costumes
    if (opts.headdress !== undefined) {
      this.headdressGroup = new THREE.Group();
      this.headdressGroup.position.set(0, 0.65, 0);
      const featherMat = lambertMat(opts.headdress);
      [-0.3, -0.15, 0, 0.15, 0.3].forEach((x, i) => {
        const h = 0.55 - Math.abs(x) * 0.9;
        const f = new THREE.Mesh(box(0.1, h, 0.06), i % 2 ? featherMat : whiteMat);
        f.position.set(x, h / 2, 0);
        f.rotation.z = -x * 0.45;
        f.castShadow = true;
        this.headdressGroup!.add(f);
      });
      const band = new THREE.Mesh(box(0.96, 0.09, 0.82), lambertMat(0x8a3b2b));
      this.headdressGroup.add(band);
      this.headPivot.add(this.headdressGroup);
    }

    if (opts.hat !== undefined) {
      const cap = new THREE.Mesh(box(1.02, 0.18, 0.88), lambertMat(opts.hat));
      cap.position.y = 0.68;
      this.headPivot.add(cap);
      const badge = new THREE.Mesh(box(0.18, 0.12, 0.05), lambertMat(0xf4d35e));
      badge.position.set(0, 0.68, 0.45);
      this.headPivot.add(badge);
    }
  }

  public setMood(m: QuellMood) {
    this.mood = m;
    this.applyMood();
  }

  private applyMood() {
    switch (this.mood) {
      case 'worried':
        this.leftBrow.rotation.z = -0.3;
        this.rightBrow.rotation.z = 0.3;
        this.leftEye.scale.set(1, 1, 1);
        this.rightEye.scale.set(1, 1, 1);
        this.mouth.scale.set(0.8, 1, 1);
        break;
      case 'delighted':
        this.leftBrow.rotation.z = 0.15;
        this.rightBrow.rotation.z = -0.15;
        this.leftEye.scale.set(1.1, 1.1, 1);
        this.rightEye.scale.set(1.1, 1.1, 1);
        this.mouth.scale.set(1.4, 1.8, 1);
        break;
      case 'horrified':
        this.leftBrow.position.y = 0.48;
        this.rightBrow.position.y = 0.48;
        this.leftEye.scale.set(1.3, 1.4, 1);
        this.rightEye.scale.set(1.3, 1.4, 1);
        this.mouth.scale.set(1.8, 2.5, 1);
        break;
      case 'deadpan':
        this.leftBrow.rotation.z = 0;
        this.rightBrow.rotation.z = 0;
        this.leftBrow.position.y = 0.42;
        this.rightBrow.position.y = 0.42;
        this.leftEye.scale.set(1, 0.7, 1);
        this.rightEye.scale.set(1, 0.7, 1);
        this.mouth.scale.set(1.2, 0.6, 1);
        break;
      case 'smug':
        this.leftBrow.rotation.z = 0.25;
        this.rightBrow.rotation.z = -0.05;
        this.leftEye.scale.set(1, 0.8, 1);
        this.rightEye.scale.set(1, 0.8, 1);
        this.mouth.scale.set(1.1, 0.9, 1);
        break;
      default:
        this.leftBrow.rotation.z = 0;
        this.rightBrow.rotation.z = 0;
        this.leftBrow.position.y = 0.44;
        this.rightBrow.position.y = 0.44;
        this.leftEye.scale.set(1, 1, 1);
        this.rightEye.scale.set(1, 1, 1);
        this.mouth.scale.set(1, 1, 1);
    }
  }

  public faint() {
    this.fainted = true;
    this.setMood('horrified');
  }

  public revive() {
    this.fainted = false;
    this.faintK = 0;
    this.root.rotation.z = 0;
    this.root.position.y = 0;
    this.setMood('neutral');
  }

  public cheer(seconds: number) {
    this.cheerTime = seconds;
    this.setMood('delighted');
  }

  public setHumming(on: boolean) {
    this.humming = on;
  }

  public lookAtPoint(x: number, z: number, dt: number) {
    const targetAngle = Math.atan2(x - this.group.position.x, z - this.group.position.z);
    const diff = Math.atan2(Math.sin(targetAngle - this.group.rotation.y), Math.cos(targetAngle - this.group.rotation.y));
    this.group.rotation.y += diff * (1 - Math.exp(-8 * dt));

    // Smooth head gaze towards look target
    this.targetLook.x = THREE.MathUtils.clamp(diff * 0.4, -0.6, 0.6);
    this.currentLook.x = damp(this.currentLook.x, this.targetLook.x, 6, dt);
    this.headPivot.rotation.y = this.currentLook.x;
  }

  public walk(speed: number) {
    this.walkSpeed = speed;
  }

  public update(dt: number) {
    this.time += dt;

    // Fainting collapse
    this.faintK = damp(this.faintK, this.fainted ? 1 : 0, 5, dt);
    this.root.rotation.z = this.faintK * (Math.PI / 2);
    this.root.position.y = this.faintK * 0.5;

    if (!this.fainted) {
      // Idle breathing
      const breath = Math.sin(this.time * 2.2) * 0.02;
      this.root.position.y = breath;

      // Walk cycle animation
      if (this.walkSpeed > 0.1) {
        this.walkPhase += dt * this.walkSpeed * 6.0;
        const swing = Math.sin(this.walkPhase) * 0.55;
        this.leftLeg.rotation.x = swing;
        this.rightLeg.rotation.x = -swing;
        this.leftArm.rotation.x = -swing * 0.7;
        this.rightArm.rotation.x = swing * 0.7;
      } else {
        // Natural arm idle sway
        this.leftLeg.rotation.x = damp(this.leftLeg.rotation.x, 0, 8, dt);
        this.rightLeg.rotation.x = damp(this.rightLeg.rotation.x, 0, 8, dt);
        this.leftArm.rotation.x = damp(this.leftArm.rotation.x, 0, 8, dt);
        this.rightArm.rotation.x = damp(this.rightArm.rotation.x, 0, 8, dt);

        this.leftArm.rotation.z = -0.1 + Math.sin(this.time * 1.8) * 0.05;
        this.rightArm.rotation.z = 0.1 - Math.sin(this.time * 1.8) * 0.05;
      }

      // Humming sway
      if (this.humming) {
        this.root.rotation.z = Math.sin(this.time * 7) * 0.06;
      }
    }

    // Cheering arms & hops
    if (this.cheerTime > 0 && !this.fainted) {
      this.cheerTime -= dt;
      this.leftArm.rotation.z = -2.6 - Math.sin(this.time * 14) * 0.3;
      this.rightArm.rotation.z = 2.6 + Math.sin(this.time * 14) * 0.3;
      this.root.position.y = Math.abs(Math.sin(this.time * 9)) * 0.28;
    }

    // Reactive antenna tip pulse
    if (this.antennaTip) {
      const pulse = this.humming
        ? 0.7 + 0.3 * Math.sin(this.time * 15)
        : this.mood === 'horrified'
          ? 0.5 + 0.5 * Math.sin(this.time * 20)
          : 0.5 + 0.5 * Math.sin(this.time * 2.5);

      this.antennaTip.scale.setScalar(0.85 + pulse * 0.5);
      const tipMat = this.antennaTip.material as THREE.MeshStandardMaterial;
      if (tipMat) {
        tipMat.emissiveIntensity = 0.4 + pulse * 0.7;
      }
    }

    // Headdress dynamic physics sway
    if (this.headdressGroup && !this.fainted) {
      this.headdressGroup.rotation.z = Math.sin(this.time * 3.5) * 0.08;
    }
  }
}
