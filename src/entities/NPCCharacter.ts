import * as THREE from 'three';
import { damp } from '../core/animMath';

export type Expression = 'neutral' | 'suspicious' | 'disgust' | 'horror' | 'scream';

/** Reaction tier from the current fart decibel level (0 = calm ... 4 = blown away). */
export function reactionTier(db: number): number {
  if (db < 66) return 0;
  if (db < 78) return 1;
  if (db < 90) return 2;
  if (db <= 102) return 3;
  return 4;
}

const TIER_EXPRESSION: Expression[] = ['neutral', 'suspicious', 'disgust', 'horror', 'scream'];

const SKIN_TONES = [0xe5b894, 0xc68642, 0x8d5524, 0xf1c27d];
const SHIRT_COLORS = [0x3d7068, 0xb5483a, 0x4a5f9e, 0xd0a23c, 0x7a4f8c, 0x5a8a4a];
const PANTS_COLORS = [0x222233, 0x3a3a48, 0x4d4030, 0x2a3d55];
const HAIR_COLORS = [0x1c1410, 0x4a2f1a, 0x8a6a3a, 0xb8b0a0, 0x7a2a1a];

const blackMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const mouthVoidMat = new THREE.MeshBasicMaterial({ color: 0x1a0505 });

// Gait: feet stay planted when the phase advances by stride length per cycle (two steps)
const LEG_LEN = 0.78;
const SWING_AMP = 0.55;
const STRIDE = 4 * LEG_LEN * Math.sin(SWING_AMP);
const REF_SPEED = 1.3; // update()'s speedMul of 1 means walking at this many m/s

// Ragdoll
const REST_RADIUS = 0.25; // body half-thickness: centre height above the pavement when lying
const WALL_X = 12.4; // building facades start at |x| = 13
const WALL_RESTITUTION = 0.4;
const SIDEWALK_Y = 0.3;

const boxGeo = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const browGeo = boxGeo(0.14, 0.04, 0.03);
const eyeGeo = boxGeo(0.07, 0.07, 0.03);
const scleraGeo = boxGeo(0.13, 0.13, 0.02);
// Body parts shared by every character (geometry is never mutated, only meshes are positioned)
const torsoGeo = boxGeo(0.62, 0.82, 0.36);
const legGeo = boxGeo(0.22, 0.78, 0.24);
const armGeo = boxGeo(0.15, 0.55, 0.15);
const handGeo = boxGeo(0.14, 0.14, 0.14);
const phoneGeo = boxGeo(0.08, 0.16, 0.02);
const headGeo = boxGeo(0.52, 0.55, 0.5);
const hairGeo = boxGeo(0.56, 0.14, 0.52);
const mouthLineGeo = boxGeo(0.18, 0.03, 0.03);
const mouthCornerGeo = boxGeo(0.04, 0.04, 0.03);
const mouthSegGeo = boxGeo(0.07, 0.03, 0.03);
const mouthRingGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.03, 8);
const mouthVoidGeo = boxGeo(0.26, 0.2, 0.03);

export interface NPCOptions {
  holdsPhone?: boolean;
}

export class NPCCharacter {
  public group = new THREE.Group();
  public isBlownAway = false;
  public tier = 0;
  public expression: Expression = 'neutral';

  private rig = new THREE.Group(); // pivots around body centre so ragdoll tumbles naturally
  private body = new THREE.Group();
  private headPivot = new THREE.Group();
  private leftLeg = new THREE.Group();
  private rightLeg = new THREE.Group();
  private leftArm = new THREE.Group();
  private rightArm = new THREE.Group();
  private phone: THREE.Mesh | null = null;

  private brows: THREE.Mesh[] = [];
  private eyes: THREE.Mesh[] = [];
  private sclerae: THREE.Mesh[] = [];
  private mouthNeutral = new THREE.Group();
  private mouthDisgust = new THREE.Group();
  private mouthGasp = new THREE.Group();
  private mouthScream = new THREE.Group();

  private walkPhase = Math.random() * Math.PI * 2;
  private swing = 0;
  private time = Math.random() * 10;
  private holdsPhone: boolean;

  // Awareness: gaze target, delayed reactions, startle
  private gaze: THREE.Vector3 | null = null;
  private ambientYaw = 0;
  private ambientPitch = 0;
  private glanceTimer = Math.random() * 2;
  private pendingTier = -1;
  private pendingTimer = 0;
  private flinch = 0;

  // Ragdoll
  private velocity = new THREE.Vector3();
  private rotVelocity = new THREE.Vector3();

  constructor(opts: NPCOptions = {}) {
    this.holdsPhone = !!opts.holdsPhone;
    // Modelled ~2.2 m tall; scale to adults of 1.6-1.85 m (average ~1.72 m)
    this.group.scale.setScalar(0.74 + Math.random() * 0.1);
    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
    const flat = (color: number) => new THREE.MeshStandardMaterial({ color, flatShading: true });
    const skinMat = flat(pick(SKIN_TONES));
    const shirtMat = flat(pick(SHIRT_COLORS));
    const pantsMat = flat(pick(PANTS_COLORS));
    const hairMat = flat(pick(HAIR_COLORS));

    this.rig.position.y = 0.95;
    this.body.position.y = -0.95;
    this.rig.add(this.body);
    this.group.add(this.rig);

    // Torso
    const torso = new THREE.Mesh(torsoGeo, shirtMat);
    torso.position.y = 1.16;
    torso.castShadow = true;
    this.body.add(torso);

    // Legs: pivot at hip (y = 0.78), feet at y = 0
    ([[this.leftLeg, -0.15], [this.rightLeg, 0.15]] as [THREE.Group, number][]).forEach(([pivot, x]) => {
      pivot.position.set(x, 0.78, 0);
      const leg = new THREE.Mesh(legGeo, pantsMat);
      leg.position.y = -0.39;
      leg.castShadow = true;
      pivot.add(leg);
      this.body.add(pivot);
    });

    // Arms: pivot at shoulder (y = 1.45)
    ([[this.leftArm, -0.42], [this.rightArm, 0.42]] as [THREE.Group, number][]).forEach(([pivot, x]) => {
      pivot.position.set(x, 1.45, 0);
      const arm = new THREE.Mesh(armGeo, shirtMat);
      arm.position.y = -0.27;
      pivot.add(arm);
      const hand = new THREE.Mesh(handGeo, skinMat);
      hand.position.y = -0.58;
      pivot.add(hand);
      this.body.add(pivot);
    });

    if (this.holdsPhone) {
      this.phone = new THREE.Mesh(phoneGeo, blackMat);
      this.phone.position.set(0, -0.58, 0.1);
      this.rightArm.add(this.phone);
    }

    // Head
    this.headPivot.position.y = 1.55;
    this.body.add(this.headPivot);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 0.275;
    head.castShadow = true;
    this.headPivot.add(head);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0, 0.56, -0.02); // front at z 0.24 so raised brows are not buried
    this.headPivot.add(hair);

    this.buildFace();
    this.setExpression('neutral');
  }

  private buildFace() {
    const faceZ = 0.26;

    [-1, 1].forEach((side) => {
      const brow = new THREE.Mesh(browGeo, blackMat);
      brow.position.set(side * 0.12, 0.43, faceZ);
      this.headPivot.add(brow);
      this.brows.push(brow);

      const sclera = new THREE.Mesh(scleraGeo, whiteMat);
      sclera.position.set(side * 0.12, 0.33, faceZ - 0.005);
      sclera.visible = false;
      this.headPivot.add(sclera);
      this.sclerae.push(sclera);

      const eye = new THREE.Mesh(eyeGeo, blackMat);
      eye.position.set(side * 0.12, 0.33, faceZ + 0.01);
      this.headPivot.add(eye);
      this.eyes.push(eye);
    });

    const add = (group: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, rotZ = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, 0);
      m.rotation.z = rotZ;
      group.add(m);
    };

    // Calm smile: flat line with raised corners
    add(this.mouthNeutral, mouthLineGeo, blackMat, 0, 0.13);
    add(this.mouthNeutral, mouthCornerGeo, blackMat, -0.11, 0.155);
    add(this.mouthNeutral, mouthCornerGeo, blackMat, 0.11, 0.155);

    // Wavy grimace, corners turned down
    [-0.1, -0.033, 0.033, 0.1].forEach((x, i) => {
      add(this.mouthDisgust, mouthSegGeo, blackMat, x, 0.12 + (i % 2 === 0 ? -0.02 : 0.02), i % 2 === 0 ? 0.35 : -0.35);
    });

    // Small round 'O'
    const ring = new THREE.Mesh(mouthRingGeo, mouthVoidMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0.14, 0);
    this.mouthGasp.add(ring);

    // Gaping horror void
    add(this.mouthScream, mouthVoidGeo, mouthVoidMat, 0, 0.13);
    this.mouthScream.children[0].position.z = 0.01; // in front of the eyes' plane so they never merge

    [this.mouthNeutral, this.mouthDisgust, this.mouthGasp, this.mouthScream].forEach((g) => {
      g.position.z = faceZ + 0.01;
      this.headPivot.add(g);
    });
  }

  public setExpression(state: Expression) {
    this.expression = state;
    const [bl, br] = this.brows;
    const baseY = 0.43;

    let slant = 0;
    let browLift = 0;
    let eyeScaleX = 1;
    let eyeScaleY = 1;
    let wide = false;

    switch (state) {
      case 'neutral':
        break;
      case 'suspicious': // furrowed brows, squinting eyes
        slant = 0.28;
        eyeScaleY = 0.5;
        break;
      case 'disgust': // slit eyes
        slant = 0.28;
        eyeScaleY = 0.3;
        break;
      case 'horror': // staring, brows lifted just clear of the hair
        slant = -0.15;
        browLift = 0.04;
        eyeScaleX = eyeScaleY = 1.3;
        wide = true;
        break;
      case 'scream':
        slant = -0.15;
        browLift = 0.05;
        eyeScaleX = eyeScaleY = 1.3;
        wide = true;
        break;
    }

    // Left brow sits at -x: negative z-rotation lowers its inner end (furrow)
    bl.rotation.z = -slant;
    br.rotation.z = slant;
    bl.position.y = br.position.y = baseY + browLift;

    this.eyes.forEach((e) => e.scale.set(eyeScaleX, eyeScaleY, 1));
    this.sclerae.forEach((s) => {
      s.visible = wide;
      s.scale.setScalar(state === 'scream' ? 1.4 : 1.25);
    });

    this.mouthNeutral.visible = state === 'neutral';
    this.mouthDisgust.visible = state === 'suspicious' || state === 'disgust';
    this.mouthGasp.visible = state === 'horror';
    this.mouthScream.visible = state === 'scream';
  }

  public setReaction(tier: number) {
    if (tier === this.tier && this.expression === TIER_EXPRESSION[tier]) return;
    this.tier = tier;
    this.setExpression(TIER_EXPRESSION[tier]);
    if (this.phone) this.phone.visible = tier === 0;
  }

  /** Look at a world-space point (head height), or null to look around naturally. The vector is read every frame. */
  public lookAt(target: THREE.Vector3 | null) {
    this.gaze = target;
  }

  /** Notice a louder fart after `delay` seconds (distance + personal reaction time). Calming down is instant. */
  public queueReaction(tier: number, delay: number) {
    if (tier <= this.tier) {
      this.pendingTier = -1;
      this.setReaction(tier);
    } else {
      this.pendingTier = tier;
      this.pendingTimer = delay;
    }
  }

  public update(dt: number, walking: boolean, speedMul = 1) {
    if (this.isBlownAway) {
      this.stepRagdoll(dt);
      return;
    }
    this.time += dt;

    if (this.pendingTier >= 0) {
      this.pendingTimer -= dt;
      if (this.pendingTimer <= 0) {
        this.setReaction(this.pendingTier);
        this.pendingTier = -1;
        this.flinch = 1; // startle jolt
      }
    }
    this.flinch = damp(this.flinch, 0, 7, dt);
    const k = 1 - Math.exp(-10 * dt);

    // Gait
    // Cadence follows ground speed so planted feet do not skate
    if (walking) this.walkPhase += (dt * speedMul * REF_SPEED * Math.PI * 2) / STRIDE;
    this.swing = damp(this.swing, walking ? SWING_AMP : 0, 10, dt);
    const s = Math.sin(this.walkPhase);
    this.leftLeg.rotation.x = s * this.swing;
    this.rightLeg.rotation.x = -s * this.swing;
    // Hip drops as the legs spread (rigid legs shorten vertically), keeping the feet on the ground
    this.rig.position.y = 0.95 - LEG_LEN * (1 - Math.cos(s * this.swing));

    // Arms: swing while walking (contralateral to the legs), otherwise pose for the current reaction tier
    let lx = -s * 0.5 * (this.swing / SWING_AMP);
    let rx = -lx;
    let lz = -0.08;
    let rz = 0.08;
    if (this.tier === 0 && this.holdsPhone && !walking) {
      rx = -1.15;
    } else if (this.tier === 2) {
      rx = -2.1; // pinch nose: hand swings in to the nose
      rz = -0.5;
    } else if (this.tier === 3) {
      lx = rx = -0.1; // hands clamped over ears: raised beside the head, outside the head box
      lz = 2.9;
      rz = -2.9;
    }
    this.leftArm.rotation.x += (lx - this.leftArm.rotation.x) * k;
    this.rightArm.rotation.x += (rx - this.rightArm.rotation.x) * k;
    this.leftArm.rotation.z += (lz - this.leftArm.rotation.z) * k;
    this.rightArm.rotation.z += (rz - this.rightArm.rotation.z) * k;

    // Head: track the gaze target (clamped to a natural neck range); with nothing to look at,
    // glance around occasionally instead of oscillating.
    let yawT = 0;
    let pitchT = 0;
    if (this.gaze) {
      const p = this.group.position;
      const dx = this.gaze.x - p.x;
      const dz = this.gaze.z - p.z;
      const dy = this.gaze.y - (p.y + 1.85 * this.group.scale.y);
      let yaw = Math.atan2(dx, dz) - this.group.rotation.y;
      yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
      yawT = THREE.MathUtils.clamp(yaw, -1.2, 1.2);
      pitchT = THREE.MathUtils.clamp(Math.atan2(-dy, Math.hypot(dx, dz)), -0.45, 0.55);
    } else {
      this.glanceTimer -= dt;
      if (this.glanceTimer <= 0) {
        this.glanceTimer = 0.8 + Math.random() * 2.5;
        this.ambientYaw = (Math.random() - 0.5) * 0.9;
        this.ambientPitch = (Math.random() - 0.5) * 0.2;
      }
      yawT = this.ambientYaw;
      pitchT = this.ambientPitch;
      if (this.tier === 0 && this.holdsPhone && !walking) {
        yawT = 0;
        pitchT = 0.5; // reading the phone
      }
    }
    if (this.tier === 1) pitchT += -0.1 + Math.sin(this.time * 7) * 0.04; // nose twitch while sniffing
    if (this.tier === 3) {
      pitchT += 0.25; // duck
      yawT *= 0.5;
    }
    pitchT -= this.flinch * 0.3;
    const headRate = this.gaze ? 9 : 5;
    this.headPivot.rotation.y = damp(this.headPivot.rotation.y, yawT, headRate, dt);
    this.headPivot.rotation.x = damp(this.headPivot.rotation.x, pitchT, headRate, dt);

    // Cowering: lean back and tremble; startle jolts the torso back
    if (this.tier === 3) {
      this.rig.rotation.x = damp(this.rig.rotation.x, -0.25 - this.flinch * 0.2, 6, dt);
      this.rig.position.x = Math.sin(this.time * 45) * 0.02;
    } else {
      this.rig.rotation.x = damp(this.rig.rotation.x, -this.flinch * 0.3, 6, dt);
      this.rig.position.x = 0;
    }
  }

  /** Throw the character up and along the street (mostly vertical so they tumble visibly instead of vanishing into a facade). */
  public launch(awayX: number) {
    if (this.isBlownAway) return;
    this.isBlownAway = true;
    this.rig.position.set(0, 0.95, 0);
    this.velocity.set(awayX * (1 + Math.random() * 2), 9 + Math.random() * 5, (Math.random() - 0.5) * 16);
    this.rotVelocity.set(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4);
  }

  private stepRagdoll(dt: number) {
    const p = this.group.position;
    p.addScaledVector(this.velocity, dt);
    this.velocity.y -= 16 * dt;
    this.rig.rotation.x += this.rotVelocity.x * dt;
    this.rig.rotation.y += this.rotVelocity.y * dt;
    this.rig.rotation.z += this.rotVelocity.z * dt;

    // Bounce off the building facades instead of flying into them
    if (Math.abs(p.x) > WALL_X) {
      const side = Math.sign(p.x);
      p.x = side * WALL_X;
      if (this.velocity.x * side > 0) this.velocity.x *= -WALL_RESTITUTION;
    }

    // Group origin is at the feet, the rig pivots 0.95 m higher. Keep the lowest point of the tilted body (head/feet
    // along the rig's up axis, REST_RADIUS of thickness sideways) on the pavement.
    const r0 = this.rig.rotation;
    const up = Math.min(1, Math.abs(Math.cos(r0.x) * Math.cos(r0.z) - Math.sin(r0.x) * Math.sin(r0.y) * Math.sin(r0.z)));
    const lowest = 0.95 * up + REST_RADIUS * Math.sqrt(1 - up * up);
    const floor = (Math.abs(p.x) < 7 ? 0 : SIDEWALK_Y) - 0.95 + lowest;
    if (p.y < floor) {
      p.y = floor;
      this.velocity.y = this.velocity.y < -3 ? -this.velocity.y * 0.35 : 0;
      // dt-based friction (about 0.6 and 0.85 per frame at 60 Hz)
      const slide = Math.exp(-31 * dt);
      this.velocity.x *= slide;
      this.velocity.z *= slide;
      this.rotVelocity.multiplyScalar(Math.exp(-10 * dt));
      // Settle into a lying pose: rotation.x to the nearest +-pi/2, the other axes to the nearest multiple of pi
      const r = this.rig.rotation;
      const k = 1 - Math.exp(-8 * dt);
      const half = Math.PI / 2;
      r.x += (half + Math.round((r.x - half) / Math.PI) * Math.PI - r.x) * k;
      r.y += (Math.round(r.y / Math.PI) * Math.PI - r.y) * k;
      r.z += (Math.round(r.z / Math.PI) * Math.PI - r.z) * k;
    }
  }

  public resetRagdoll() {
    this.isBlownAway = false;
    this.velocity.set(0, 0, 0);
    this.rotVelocity.set(0, 0, 0);
    this.rig.rotation.set(0, 0, 0);
    this.rig.position.set(0, 0.95, 0);
    this.group.rotation.set(0, 0, 0);
    this.pendingTier = -1;
    this.flinch = 0;
    this.gaze = null;
    this.setReaction(0);
  }
}
