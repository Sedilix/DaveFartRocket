import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld, DAVE_CENTER_Y, DAVE_SCALE } from '../core/Physics';
import { dampAngle } from '../core/animMath';

/**
 * Walkable area: sidewalks end at the building faces (|x| = 13) and the street at |z| = 80.
 * 11.8 keeps the capsule edge at 12.25 and the outer arm at about 12.4, clear of the facade, wall benches and bins.
 */
export const WALK_LIMIT_X = 11.8;
/** Stops 9 m short of the end-cap buildings (z = 81) so the chase camera, 7-10 m behind him, stays in the street. */
export const WALK_LIMIT_Z = 72;
/** Anything below this means Dave fell out of the world: put him back on the street. */
const KILL_PLANE_Y = -5;

export class Dave {
  public group: THREE.Group;
  public bodyMeshGroup: THREE.Group; // for IK hip bounce without shifting collider root
  
  // Limbs and joints
  private leftLegPivot: THREE.Group;
  private rightLegPivot: THREE.Group;
  private leftArmPivot: THREE.Group;
  private rightArmPivot: THREE.Group;
  private headGroup: THREE.Group;

  // Mouth meshes
  private smileMesh: THREE.Mesh;
  private shockedMesh: THREE.Mesh;

  // Materials
  private orangeShirtMat: THREE.MeshStandardMaterial;
  private pantsMat: THREE.MeshStandardMaterial;
  private shoeMat: THREE.MeshStandardMaterial;
  private skinMat: THREE.MeshStandardMaterial;
  private hairMat: THREE.MeshStandardMaterial;
  private eyesMat: THREE.MeshBasicMaterial;

  // Propulsion gas puffs & debris
  private gasPlumeGroup: THREE.Group;
  private activeGasPuffs: {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    rotationSpeed: THREE.Vector3;
    life: number;
    maxLife: number;
    scaleFrom: number;
    scaleTo: number;
    opacityFrom: number;
    /** Lowest local y the puff may sink to while Dave stands on the ground (-Infinity: unrestricted). */
    floorY: number;
    /** Fade the puff out while it hugs the floor, so its intersection with the road is never a hard decal. */
    groundFade: boolean;
    /** Pool the (unit-scaled) material returns to once the puff expires. */
    pool: THREE.MeshStandardMaterial[];
  }[] = [];
  // Shared unit geometries and recycled materials: a fart allocates no GPU buffers or shader programs
  private burstGeo = new THREE.IcosahedronGeometry(1, 0);
  private puffGeo = new THREE.DodecahedronGeometry(1, 0);
  private burstMatPool: THREE.MeshStandardMaterial[] = [];
  private puffMatPool: THREE.MeshStandardMaterial[] = [];

  // Rapier physics
  public rigidBody: RAPIER.RigidBody | null = null;
  public collider: RAPIER.Collider | null = null;

  // Animation states
  private walkPhase = 0;
  private shockTimer = 0;
  public isAirborne = false;
  /** Calm zero-g pose used by the closing cinematic ("Dave is fine"). */
  public isFloating = false;
  private verticalSpeed = 0;
  /** Hip/body bounce offset, written to bodyMeshGroup together with the visual curb-step smoothing. */
  private bodyBaseY = 0;
  /** Visual-only offset that eases out the 0.30 m curb step-ups / drop-offs of the physical position. */
  private visualLag = 0;
  private moveScratch = new THREE.Vector3();

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'DaveRoot';
    this.group.scale.setScalar(DAVE_SCALE);

    // Materials with crisp flatShading
    this.orangeShirtMat = new THREE.MeshStandardMaterial({
      color: 0xff632b,
      flatShading: true,
      roughness: 0.6
    });
    this.pantsMat = new THREE.MeshStandardMaterial({
      color: 0x1f489c,
      flatShading: true,
      roughness: 0.7
    });
    this.shoeMat = new THREE.MeshStandardMaterial({
      color: 0x1c1c1c,
      flatShading: true,
      roughness: 0.8
    });
    this.skinMat = new THREE.MeshStandardMaterial({
      color: 0xf2c29b,
      flatShading: true,
      roughness: 0.5
    });
    this.hairMat = new THREE.MeshStandardMaterial({
      color: 0x4f301c,
      flatShading: true,
      roughness: 0.9
    });
    this.eyesMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

    // Inner group to hold hips & torso for IK hip bounce
    this.bodyMeshGroup = new THREE.Group();
    this.group.add(this.bodyMeshGroup);

    // 1. Build Legs & Shoes
    // Hip pivot is at y = 1.40. Legs are 1.20 long, shoes are 0.20 tall. Total = 1.40.
    // When upright and un-rotated, shoe bottom lands at exactly y = 0.00!
    this.leftLegPivot = this.createLegPivot(-0.24);
    this.rightLegPivot = this.createLegPivot(0.24);
    this.bodyMeshGroup.add(this.leftLegPivot);
    this.bodyMeshGroup.add(this.rightLegPivot);

    // 2. Build Torso (bright orange boxy t-shirt)
    // Sits above hips (y = 1.40 to y = 2.45)
    const torsoGeo = new THREE.BoxGeometry(0.88, 1.05, 0.52);
    const torsoMesh = new THREE.Mesh(torsoGeo, this.orangeShirtMat);
    torsoMesh.position.set(0, 1.40 + 1.05 / 2, 0); // y = 1.925
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    this.bodyMeshGroup.add(torsoMesh);

    // Belt / shirt hem detail
    const beltGeo = new THREE.BoxGeometry(0.9, 0.08, 0.54);
    const beltMesh = new THREE.Mesh(beltGeo, new THREE.MeshStandardMaterial({ color: 0x181818, flatShading: true }));
    beltMesh.position.set(0, 1.41, 0);
    this.bodyMeshGroup.add(beltMesh);

    // 3. Build Arms (shoulders at y = 2.30)
    // Pivots at x = +-0.50: the outer sleeve edge is at 0.61, only 0.16 outside the capsule (radius 0.45)
    this.leftArmPivot = this.createArmPivot(-0.50);
    this.rightArmPivot = this.createArmPivot(0.50);
    this.bodyMeshGroup.add(this.leftArmPivot);
    this.bodyMeshGroup.add(this.rightArmPivot);

    // 4. Build Neck & Head
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 2.50, 0);
    this.bodyMeshGroup.add(this.headGroup);

    // Head block (faceted low-poly)
    const headGeo = new THREE.BoxGeometry(0.58, 0.62, 0.56);
    const headMesh = new THREE.Mesh(headGeo, this.skinMat);
    headMesh.position.set(0, 0.31, 0);
    headMesh.castShadow = true;
    this.headGroup.add(headMesh);

    // Brown hair (boxy cap + bangs)
    const hairGeo = new THREE.BoxGeometry(0.62, 0.20, 0.58);
    const hairMesh = new THREE.Mesh(hairGeo, this.hairMat);
    hairMesh.position.set(0, 0.55, 0);
    this.headGroup.add(hairMesh);

    // Brown beard/sideburns
    const beardGeo = new THREE.BoxGeometry(0.60, 0.22, 0.36);
    const beardMesh = new THREE.Mesh(beardGeo, this.hairMat);
    beardMesh.position.set(0, 0.16, 0.14);
    this.headGroup.add(beardMesh);

    // Brown mustache
    const mustacheGeo = new THREE.BoxGeometry(0.32, 0.08, 0.12);
    const mustacheMesh = new THREE.Mesh(mustacheGeo, this.hairMat);
    mustacheMesh.position.set(0, 0.26, 0.30);
    this.headGroup.add(mustacheMesh);

    // Blocky eyes
    const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
    const leftEye = new THREE.Mesh(eyeGeo, this.eyesMat);
    leftEye.position.set(-0.16, 0.36, 0.30);
    const rightEye = new THREE.Mesh(eyeGeo, this.eyesMat);
    rightEye.position.set(0.16, 0.36, 0.30);
    this.headGroup.add(leftEye);
    this.headGroup.add(rightEye);

    // Dynamic mouth: Calm smile vs Shocked open rectangle
    const smileGeo = new THREE.BoxGeometry(0.20, 0.05, 0.04);
    this.smileMesh = new THREE.Mesh(smileGeo, new THREE.MeshBasicMaterial({ color: 0x6e2c2c }));
    this.smileMesh.position.set(0, 0.20, 0.30);
    this.headGroup.add(this.smileMesh);

    const shockedGeo = new THREE.BoxGeometry(0.24, 0.22, 0.08);
    this.shockedMesh = new THREE.Mesh(shockedGeo, new THREE.MeshBasicMaterial({ color: 0x111111 }));
    this.shockedMesh.position.set(0, 0.18, 0.30);
    this.shockedMesh.visible = false;
    this.headGroup.add(this.shockedMesh);

    // Gas plume group for particles
    this.gasPlumeGroup = new THREE.Group();
    this.group.add(this.gasPlumeGroup);

    // Hidden meshes carrying the puff materials, so the loop's startup shader precompile covers them
    const burstMat = this.makeBurstMat();
    const puffMat = this.makePuffMat();
    this.burstMatPool.push(burstMat);
    this.puffMatPool.push(puffMat);
    for (const warm of [new THREE.Mesh(this.burstGeo, burstMat), new THREE.Mesh(this.puffGeo, puffMat)]) {
      warm.visible = false;
      this.gasPlumeGroup.add(warm);
    }
  }

  private makeBurstMat() {
    return new THREE.MeshStandardMaterial({
      color: 0xb5e523,
      emissive: 0x82b810,
      emissiveIntensity: 0.6,
      flatShading: true,
      roughness: 0.4,
      transparent: true,
      opacity: 0.7,
      depthWrite: false
    });
  }

  private makePuffMat() {
    return new THREE.MeshStandardMaterial({
      color: 0x6b7c32,
      roughness: 0.85,
      flatShading: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
  }

  private createLegPivot(xOffset: number): THREE.Group {
    const pivot = new THREE.Group();
    // Hip joint at y = 1.40
    pivot.position.set(xOffset, 1.40, 0);

    // Leg trouser segment (length 1.20, starts at 0, goes down to -1.20)
    const legGeo = new THREE.BoxGeometry(0.32, 1.20, 0.34);
    const legMesh = new THREE.Mesh(legGeo, this.pantsMat);
    legMesh.position.set(0, -0.60, 0);
    legMesh.castShadow = true;
    pivot.add(legMesh);

    // Shoe segment (height 0.20, starts at -1.20 down to -1.40)
    // Shoe sole sits at y = 1.40 - 1.40 = 0.00!
    const shoeGeo = new THREE.BoxGeometry(0.34, 0.20, 0.48);
    const shoeMesh = new THREE.Mesh(shoeGeo, this.shoeMat);
    shoeMesh.position.set(0, -1.30, 0.07);
    shoeMesh.castShadow = true;
    pivot.add(shoeMesh);

    return pivot;
  }

  private createArmPivot(xOffset: number): THREE.Group {
    const pivot = new THREE.Group();
    // Shoulder joint at y = 2.30
    pivot.position.set(xOffset, 2.30, 0);

    // Orange short sleeve
    const sleeveGeo = new THREE.BoxGeometry(0.22, 0.35, 0.30);
    const sleeveMesh = new THREE.Mesh(sleeveGeo, this.orangeShirtMat);
    sleeveMesh.position.set(0, -0.175, 0);
    sleeveMesh.castShadow = true;
    pivot.add(sleeveMesh);

    // Peach arm and hand
    const forearmGeo = new THREE.BoxGeometry(0.18, 0.70, 0.24);
    const forearmMesh = new THREE.Mesh(forearmGeo, this.skinMat);
    forearmMesh.position.set(0, -0.65, 0);
    forearmMesh.castShadow = true;
    pivot.add(forearmMesh);

    return pivot;
  }

  public initPhysics(physics: PhysicsWorld) {
    if (!physics.ready) return;
    const { body, collider } = physics.createDaveCollider(this.group.position);
    this.rigidBody = body;
    this.collider = collider;
  }

  /**
   * Spawns propulsion low-poly gas burst directly beneath Dave
   */
  public triggerFartVFX(fartNumber: number) {
    this.shockTimer = 1.8; // Open mouth in shock

    // 1. Translucent yellow-green gas ball beneath Dave. It grows linearly to a capped radius and fades,
    // so it never fills the screen or hides the street (the chase camera is only ~7-10 m away).
    const scaleFactor = Math.min(6.5, 0.8 + Math.log2(Math.max(1, fartNumber)) * 0.45);
    const icosaMat = this.burstMatPool.pop() ?? this.makeBurstMat();
    icosaMat.opacity = 0.7;
    const mainBurst = new THREE.Mesh(this.burstGeo, icosaMat);
    mainBurst.castShadow = false;
    mainBurst.receiveShadow = false;
    mainBurst.renderOrder = 2; // after the opaque street, so the blend edge stays soft
    const grounded = !this.isAirborne;
    // Origin at Dave's hip/rear (y ~ 1.35, z ~ -0.3)
    mainBurst.position.set((Math.random() - 0.5) * 0.2, 1.35, -0.35);
    const maxRadius = this.isAirborne ? 3.2 : 2.6;
    const startRadius = 0.45 * scaleFactor;
    mainBurst.scale.setScalar(startRadius);
    this.group.add(mainBurst);

    this.activeGasPuffs.push({
      mesh: mainBurst,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 1.5, -2.5 - scaleFactor * 1.2, (Math.random() - 0.5) * 1.5),
      rotationSpeed: new THREE.Vector3(3, 2, 4),
      life: 0,
      maxLife: 0.65,
      scaleFrom: startRadius,
      scaleTo: Math.max(startRadius, Math.min(maxRadius, 0.9 + scaleFactor * 0.45)),
      opacityFrom: 0.7,
      // Grounded: the ball's centre never sinks below y = 1.0 and it fades near the road
      floorY: grounded ? 1.0 : -Infinity,
      groundFade: grounded,
      pool: this.burstMatPool
    });

    // 2. Trailing olive-green (#6b7c32) faceted smoke puffs downward
    const puffCount = Math.min(22, 4 + fartNumber);
    for (let i = 0; i < puffCount; i++) {
      const puffSize = 0.25 * (0.8 + Math.random() * 0.7) * (1 + scaleFactor * 0.25);
      const puffMat = this.puffMatPool.pop() ?? this.makePuffMat();
      puffMat.opacity = 0.85;
      const puff = new THREE.Mesh(this.puffGeo, puffMat);
      puff.scale.setScalar(puffSize);
      puff.castShadow = false;
      puff.receiveShadow = false;
      puff.renderOrder = 2;
      puff.position.set(
        (Math.random() - 0.5) * 0.6,
        1.25 - Math.random() * 0.4,
        -0.3 + (Math.random() - 0.5) * 0.4
      );
      this.group.add(puff);

      const spread = 1.8 + scaleFactor * 0.5;
      const growth = 1.5 + Math.random() * 2.0;
      this.activeGasPuffs.push({
        mesh: puff,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * spread,
          -(3.0 + Math.random() * 4.0 + scaleFactor * 2.0),
          (Math.random() - 0.5) * spread
        ),
        rotationSpeed: new THREE.Vector3(Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2),
        life: 0,
        maxLife: 0.8 + Math.random() * 0.7,
        scaleFrom: puffSize,
        scaleTo: puffSize * (1 + growth * 0.8),
        opacityFrom: 0.85,
        floorY: grounded ? 0.6 : -Infinity,
        groundFade: false,
        pool: this.puffMatPool
      });
    }
  }

  public update(dt: number, moveInput: { x: number; y: number }, physics: PhysicsWorld) {
    const isMoving = Math.abs(moveInput.x) > 0.05 || Math.abs(moveInput.y) > 0.05;

    // Handle mouth shock timer
    if (this.isFloating) this.shockTimer = 0; // calm face while drifting in space
    if (this.shockTimer > 0) {
      this.shockTimer -= dt;
      this.shockedMesh.visible = true;
      this.smileMesh.visible = false;
      // Head tilt back in shock
      this.headGroup.rotation.x = -0.22;
    } else {
      this.shockedMesh.visible = false;
      this.smileMesh.visible = true;
      this.headGroup.rotation.x = 0;
    }

    if (this.isAirborne && this.isFloating) {
      // CALM FLOATING POSE: arms drifting out to the sides, knees slightly bent, slow bob
      const t = performance.now() * 0.001;
      this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(this.leftArmPivot.rotation.x, Math.sin(t * 0.9) * 0.25, dt * 3);
      this.leftArmPivot.rotation.z = THREE.MathUtils.lerp(this.leftArmPivot.rotation.z, -1.0 + Math.sin(t * 1.3) * 0.12, dt * 3);
      this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(this.rightArmPivot.rotation.x, Math.cos(t * 0.9) * 0.25, dt * 3);
      this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(this.rightArmPivot.rotation.z, 1.0 - Math.sin(t * 1.3) * 0.12, dt * 3);
      this.leftLegPivot.rotation.x = THREE.MathUtils.lerp(this.leftLegPivot.rotation.x, 0.35 + Math.sin(t * 0.8) * 0.1, dt * 3);
      this.leftLegPivot.rotation.z = THREE.MathUtils.lerp(this.leftLegPivot.rotation.z, -0.18, dt * 3);
      this.rightLegPivot.rotation.x = THREE.MathUtils.lerp(this.rightLegPivot.rotation.x, 0.05 + Math.cos(t * 0.8) * 0.1, dt * 3);
      this.rightLegPivot.rotation.z = THREE.MathUtils.lerp(this.rightLegPivot.rotation.z, 0.18, dt * 3);
      this.bodyBaseY = Math.sin(t * 1.1) * 0.08;
    } else if (this.isAirborne) {
      // Turn to face the chase camera (+z) so he never flies away showing his back or side
      this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, Math.round(this.group.rotation.y / (Math.PI * 2)) * Math.PI * 2, dt * 5);
      // BLAST / AIRBORNE POSE:
      // Both arms raised straight up in panic (rotation.x = Math.PI * 0.92) with dangling/kicking legs
      this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(this.leftArmPivot.rotation.x, -Math.PI * 0.88, dt * 8);
      this.leftArmPivot.rotation.z = THREE.MathUtils.lerp(this.leftArmPivot.rotation.z, -0.25, dt * 8);
      this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(this.rightArmPivot.rotation.x, -Math.PI * 0.88, dt * 8);
      this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(this.rightArmPivot.rotation.z, 0.25, dt * 8);

      // Dangling/fluttering legs in wind
      const flailTime = performance.now() * 0.008;
      this.leftLegPivot.rotation.x = Math.sin(flailTime) * 0.35 + 0.15;
      this.leftLegPivot.rotation.z = -0.15;
      this.rightLegPivot.rotation.x = Math.cos(flailTime) * 0.35 + 0.15;
      this.rightLegPivot.rotation.z = 0.15;

      // Reset hip bounce offset when airborne
      this.bodyBaseY = THREE.MathUtils.lerp(this.bodyBaseY, 0, dt * 6);

      // Steer slightly while airborne
      if (isMoving) {
        this.group.position.x += moveInput.x * dt * 8;
        this.group.position.z -= moveInput.y * dt * 8;
        if (this.group.position.y < 70) {
          // Low flights stay over the street and sidewalks, never inside a building
          this.group.position.x = THREE.MathUtils.clamp(this.group.position.x, -WALK_LIMIT_X, WALK_LIMIT_X);
          this.group.position.z = THREE.MathUtils.clamp(this.group.position.z, -WALK_LIMIT_Z, WALK_LIMIT_Z);
        }
      }
    } else {
      // GROUNDED WALK / IDLE POSE
      if (isMoving) {
        this.walkPhase += dt * 9.5;
        const swing = Math.sin(this.walkPhase) * 0.62;

        // Limb swing
        this.leftLegPivot.rotation.x = swing;
        this.leftLegPivot.rotation.z = 0;
        this.rightLegPivot.rotation.x = -swing;
        this.rightLegPivot.rotation.z = 0;

        this.leftArmPivot.rotation.x = -swing * 0.75;
        this.leftArmPivot.rotation.z = -0.08;
        this.rightArmPivot.rotation.x = swing * 0.75;
        this.rightArmPivot.rotation.z = 0.08;

        // CRITICAL INVERSE KINEMATICS REQUIREMENT:
        // Legs are 1.4 long and swing +-0.62 rad about the hip, so the hip must DROP at full stride
        // (1.4 * (1 - cos)) to keep the feet on the ground. The lowest shoe corner of the swinging leg
        // is the toe (shoe box z extent -0.17..+0.31), so it must be lifted back by 0.31 * sin(angle).
        const legAngle = Math.abs(swing);
        this.bodyBaseY = -1.4 * (1 - Math.cos(legAngle)) + 0.31 * Math.sin(legAngle);

        // Face movement direction
        const angle = Math.atan2(moveInput.x, -moveInput.y);
        // Shortest-way turn: a raw lerp between -pi/2 and pi spun Dave through the camera-facing side
        this.group.rotation.y = dampAngle(this.group.rotation.y, angle, 14, dt);
      } else {
        // IDLE POSE
        this.leftLegPivot.rotation.set(0, 0, 0);
        this.rightLegPivot.rotation.set(0, 0, 0);
        this.leftArmPivot.rotation.set(0, 0, -0.06);
        this.rightArmPivot.rotation.set(0, 0, 0.06);
        // Gentle breathing motion: a target the body eases towards (never lifts the shoes off the ground,
        // and does not accumulate, so it is the same at any frame rate)
        const breathe = -Math.abs(Math.sin(performance.now() * 0.003)) * 0.015;
        this.bodyBaseY = THREE.MathUtils.lerp(this.bodyBaseY, breathe, 1 - Math.exp(-8 * dt));
      }

      // Movement with the Rapier CharacterController. Runs every grounded frame (idle too) so gravity,
      // curbs and the world bounds always apply.
      const step = 5.2 * dt;
      this.moveGrounded(dt, isMoving ? moveInput.x * step : 0, isMoving ? -moveInput.y * step : 0, physics);
    }

    // Ease the visual curb step out (the physical position pops 0.30 m in one frame) and apply the body offset
    this.visualLag -= this.visualLag * (1 - Math.exp(-20 * dt));
    if (Math.abs(this.visualLag) < 0.0005) this.visualLag = 0;
    this.bodyMeshGroup.position.y = this.bodyBaseY + this.visualLag;

    // Update active gas puffs
    for (let i = this.activeGasPuffs.length - 1; i >= 0; i--) {
      const p = this.activeGasPuffs[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.group.remove(p.mesh);
        p.pool.push(p.mesh.material as THREE.MeshStandardMaterial); // recycled, geometry is shared
        this.activeGasPuffs.splice(i, 1);
        continue;
      }

      // Move particle
      p.mesh.position.addScaledVector(p.velocity, dt);
      if (!this.isAirborne && p.mesh.position.y < p.floorY) p.mesh.position.y = p.floorY;
      p.mesh.rotation.x += p.rotationSpeed.x * dt;
      p.mesh.rotation.y += p.rotationSpeed.y * dt;
      p.mesh.rotation.z += p.rotationSpeed.z * dt;

      // Expand (linear, frame-rate independent, eased out) and fade
      const t = p.life / p.maxLife;
      const ease = 1 - (1 - t) * (1 - t);
      p.mesh.scale.setScalar(p.scaleFrom + (p.scaleTo - p.scaleFrom) * ease);
      const mat = p.mesh.material as THREE.MeshStandardMaterial;
      let opacity = p.opacityFrom * (1 - t) * (1 - t * 0.25);
      if (p.groundFade && !this.isAirborne) {
        // How far the ball's lowest point is above the ground (local y 0): low and wide means a hard flat footprint
        const clearance = p.mesh.position.y - p.mesh.scale.x;
        opacity *= 0.3 + 0.7 * THREE.MathUtils.smoothstep(clearance, -1.6, 0.4);
      }
      mat.opacity = opacity;
    }
  }

  private moveGrounded(dt: number, dx: number, dz: number, physics: PhysicsWorld) {
    const controller = this.rigidBody && this.collider && physics.ready ? physics.getController() : null;
    if (!controller || !this.rigidBody || !this.collider) {
      this.group.position.x += dx;
      this.group.position.z += dz;
      return;
    }

    // Gravity accumulates while not grounded (the controller reports ground contact)
    this.verticalSpeed = Math.max(-40, this.verticalSpeed - 9.81 * dt);
    this.moveScratch.set(dx, this.verticalSpeed * dt, dz);
    controller.computeColliderMovement(this.collider, this.moveScratch);
    if (controller.computedGrounded()) this.verticalSpeed = 0;
    const computed = controller.computedMovement();
    const curr = this.rigidBody.translation();
    const nx = THREE.MathUtils.clamp(curr.x + computed.x, -WALK_LIMIT_X, WALK_LIMIT_X);
    const nz = THREE.MathUtils.clamp(curr.z + computed.z, -WALK_LIMIT_Z, WALK_LIMIT_Z);
    const ny = curr.y + computed.y;

    if (ny - DAVE_CENTER_Y < KILL_PLANE_Y) {
      this.setShoeSolePosition(0, 0, 0);
      return;
    }
    this.rigidBody.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
    // Dave origin is at the shoe soles (capsule centre minus 1.35 minus the 0.02 skin)
    const prevY = this.group.position.y;
    this.group.position.set(nx, ny - DAVE_CENTER_Y, nz);
    // Keep the mesh where it was this frame; visualLag then eases it onto the new height
    const dy = this.group.position.y - prevY;
    if (Math.abs(dy) > 0.05) this.visualLag = THREE.MathUtils.clamp(this.visualLag - dy, -0.4, 0.4);
  }

  public setShoeSolePosition(x: number, y: number, z: number) {
    this.group.position.set(x, y, z);
    this.verticalSpeed = 0;
    this.visualLag = 0;
    if (this.rigidBody) {
      this.rigidBody.setTranslation({ x, y: y + DAVE_CENTER_Y, z }, true);
      this.rigidBody.setNextKinematicTranslation({ x, y: y + DAVE_CENTER_Y, z });
    }
  }
}
