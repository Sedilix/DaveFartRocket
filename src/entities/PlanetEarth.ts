import * as THREE from 'three';

export interface EarthShard {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotVelocity: THREE.Vector3;
}

const EARTH_RADIUS = 480;
/** Icosahedron subdivision: enough vertex rings inside the visible cap for the #22 ripple to read as a wave. */
const EARTH_DETAIL = 8;
/** Where the planet sits for the closing cinematic (the ending shots are framed relative to it). */
const ENDING_POSITION = new THREE.Vector3(0, 1500, 0);
/** Earth only appears once Dave is high enough to look down on it. */
const FIRST_VISIBLE_FART = 19;
/** Wave strength (fraction of the radius) and speed of the fart #22 ripple. */
const RIPPLE_AMPLITUDE = 45;
const RIPPLE_SPEED = 3.0;
/** Wavelengths of the #22 ripple that fit across the visible cap. */
const RIPPLE_WAVES = 1.5;
const RIPPLE_FADE = 0.07; // wave amplitude reaches 0 at rippleWaveTime = 1 / RIPPLE_FADE (about 4.8 s)
const CLOUD_OPACITY = 0.35;
/** Blast staging: small fragments, the fireball core and the shockwave shell. */
const FRAGMENT_COUNT = 240;
const CORE_DURATION = 1.0;
const CORE_DELAY = 0.08;
const SHOCK_DURATION = 1.4;
const SHOCK_END_RADIUS = 2200; // stays short of the ending camera, about 2500 m away
/** Shards further than this from the planet centre are hidden. */
const SHARD_CULL_DISTANCE = 9000;

/**
 * During the ascent the planet is a camera-relative backdrop: its centre hangs directly below Dave. The distance is
 * solved from the real camera (pitch, fov) so the near limb sits at a given fraction of the half field of view
 * below the view axis, whatever the aspect: the larger the factor, the lower the limb (0 = on the view axis,
 * 1 = on the bottom edge of the frame). It grows per fart, so the limb sinks and the globe recedes each time: the
 * climb reads as leaving the planet behind, not approaching it. The bottom fifth of the frame is covered by the HUD
 * controls, so the limb never goes below 0.55.
 */
const ASCENT_LIMB_K: Record<number, number> = { 19: 0.3, 20: 0.35, 21: 0.4, 22: 0.45, 23: 0.5, 24: 0.55 };
const ASCENT_RATIO_MIN = 0.3;
const ASCENT_RATIO_MAX = 0.96;

export class PlanetEarth {
  public group: THREE.Group;
  public earthMesh: THREE.Mesh;
  public cloudMesh: THREE.Mesh;
  public shardsGroup: THREE.Group;
  public shards: EarthShard[] = [];
  public isShattered = false;

  private originalPositions: Float32Array;
  private earthGeometry: THREE.IcosahedronGeometry;
  private earthMat: THREE.MeshStandardMaterial;
  private cloudMat: THREE.MeshStandardMaterial;
  private fragments: THREE.InstancedMesh;
  private fragPos = new Float32Array(FRAGMENT_COUNT * 3);
  private fragVel = new Float32Array(FRAGMENT_COUNT * 3);
  private fragRot = new Float32Array(FRAGMENT_COUNT * 3);
  private fragSpin = new Float32Array(FRAGMENT_COUNT * 3);
  private fragScale = new Float32Array(FRAGMENT_COUNT);
  private core: THREE.Mesh;
  private shock: THREE.Mesh;
  private blastTime = 0;
  private dummy = new THREE.Object3D();
  private rippleWaveTime = 0;
  private isRippling = false;
  private ratio = 0; // eased radius / distance while ascending
  private camDir = new THREE.Vector3();
  private ending = false; // the ending shot is staged: the globe holds a fixed, land-facing pose

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'PlanetEarth';
    this.group.position.copy(ENDING_POSITION);
    this.group.visible = false; // hidden until Dave is high enough to look down on it

    // 1. Faceted low-poly Earth
    this.earthGeometry = new THREE.IcosahedronGeometry(EARTH_RADIUS, EARTH_DETAIL);
    // Cache original vertex positions for ripple effect
    const posAttr = this.earthGeometry.attributes.position;
    this.originalPositions = new Float32Array(posAttr.array);

    // Vertex color assignment (blue oceans, green/tan continents, white polar caps)
    const count = posAttr.count;
    const colors = new Float32Array(count * 3);
    const colorOcean = new THREE.Color(0x19528d);
    const colorContinent = new THREE.Color(0x4a8536);
    const colorDesert = new THREE.Color(0xbfa765);
    const colorIce = new THREE.Color(0xe6f2ff);

    for (let i = 0; i < count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const vz = posAttr.getZ(i);

      // Procedural continents using 3D noise approximation. The colour frame has its poles on the X axis,
      // so the faces the cameras see (+Y below Dave in the ascent, +Z in the ending) are mid-latitude land and
      // ocean instead of an ice cap. (The mesh itself is never tilted: the ripple works on the local Y axis.)
      const lat = vx / EARTH_RADIUS; // -1 to 1
      const lon = Math.atan2(vz, vy);
      const pattern = Math.sin(lon * 3.5) * Math.cos(lat * 4.2) + Math.sin(lon * 7.1 + lat * 5.0) * 0.4;

      let c = colorOcean;
      if (Math.abs(lat) > 0.86) {
        c = colorIce;
      } else if (pattern > 0.15) {
        c = pattern > 0.55 ? colorDesert : colorContinent;
      }

      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    this.earthGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // flatShading derives normals per face in the shader, so vertex normals never need recomputing
    const earthMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.8,
      metalness: 0.1,
      emissive: 0x3a7bd5, // lit up while the #22 ripple runs (intensity 0 otherwise)
      emissiveIntensity: 0
    });
    this.earthMat = earthMat;
    this.earthMesh = new THREE.Mesh(this.earthGeometry, earthMat);
    this.group.add(this.earthMesh);

    // 2. White low-poly cloud shell
    const cloudGeo = new THREE.IcosahedronGeometry(EARTH_RADIUS * 1.025, 3);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      roughness: 0.9,
      transparent: true,
      opacity: CLOUD_OPACITY,
      depthWrite: false
    });
    this.cloudMat = cloudMat;
    this.cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    this.group.add(this.cloudMesh);

    // Shards container: the big chunks are built up front (hidden) so nothing is allocated on the blast frame
    this.shardsGroup = new THREE.Group();
    this.shardsGroup.visible = false;
    this.group.add(this.shardsGroup);
    const shardColors = [0x19528d, 0x4a8536, 0xbfa765, 0x143c68, 0x336128, 0x7a3e1d, 0xd0c29b];
    const shardMats = shardColors.map((color) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85 }));
    for (let i = 0; i < 58; i++) {
      const size = 35 + Math.random() * 55;
      const shard = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), shardMats[i % shardMats.length]);
      this.shardsGroup.add(shard);
      this.shards.push({ mesh: shard, velocity: new THREE.Vector3(), rotVelocity: new THREE.Vector3() });
    }

    // Small debris: one InstancedMesh with 240 fragments, tinted per instance
    const fragMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.85 });
    this.fragments = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), fragMat, FRAGMENT_COUNT);
    this.fragments.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fragments.frustumCulled = false;
    this.fragments.visible = false;
    const tint = new THREE.Color();
    for (let i = 0; i < FRAGMENT_COUNT; i++) {
      tint.setHex(shardColors[i % shardColors.length]);
      this.fragments.setColorAt(i, tint);
    }
    this.group.add(this.fragments);

    // Fireball core and shockwave shell
    this.core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 2),
      new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0, depthWrite: false, fog: false })
    );
    this.core.visible = false;
    this.group.add(this.core);
    this.shock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 3),
      new THREE.MeshBasicMaterial({
        color: 0xfff4d6,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false
      })
    );
    this.shock.visible = false;
    this.group.add(this.shock);
  }

  /** Ascent backdrop: hang the planet below Dave (never on his climb axis). Call every frame while ascending. */
  public placeForAscent(dave: THREE.Vector3, fartNumber: number, dt: number, camera: THREE.PerspectiveCamera) {
    const k = ASCENT_LIMB_K[Math.min(24, fartNumber)];
    if (k === undefined) {
      this.group.visible = false;
      this.ratio = 0;
      return;
    }
    // The centre is straight below the camera, so the limb is at depression (90 deg - asin(ratio)) = acos(ratio):
    // put it at pitch + k * half the vertical fov below the horizon
    const pitch = -Math.asin(THREE.MathUtils.clamp(camera.getWorldDirection(this.camDir).y, -1, 1));
    const limb = pitch + k * THREE.MathUtils.degToRad(camera.fov / 2);
    const target = THREE.MathUtils.clamp(Math.cos(limb), ASCENT_RATIO_MIN, ASCENT_RATIO_MAX);
    if (this.ratio === 0) this.ratio = target * 0.6;
    this.ratio += (target - this.ratio) * (1 - Math.exp(-1.5 * dt));
    const distance = EARTH_RADIUS / this.ratio;
    this.group.visible = fartNumber >= FIRST_VISIBLE_FART;
    this.group.position.set(dave.x, dave.y - distance, dave.z);
  }

  /** Closing cinematic: the planet sits at its fixed staging position. */
  public placeForEnding() {
    this.group.position.copy(ENDING_POSITION);
    this.group.visible = true;
    // Fixed pose: the ice caps are on the local X axis, so continents (not a pole) face the +Z ending camera
    this.ending = true;
    this.earthMesh.rotation.set(0, 0.4, 0);
    this.cloudMesh.rotation.set(0.1, 0.8, 0);
  }

  public triggerRipple() {
    this.isRippling = true;
    this.rippleWaveTime = 0;
  }

  public shatterEarth() {
    if (this.isShattered) return;
    this.isShattered = true;
    this.blastTime = 0;

    // Hide intact Earth and cloud mesh
    this.earthMesh.visible = false;
    this.cloudMesh.visible = false;
    this.shardsGroup.visible = true;

    // 58 big tectonic chunks (built in the constructor) burst outward into deep space
    for (const { mesh: shard, velocity, rotVelocity } of this.shards) {
      shard.visible = true;
      shard.rotation.set(0, 0, 0);

      // Distribute along Earth spherical perimeter
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 460 + (Math.random() - 0.5) * 40;

      const px = r * Math.sin(phi) * Math.cos(theta);
      const py = r * Math.cos(phi);
      const pz = r * Math.sin(phi) * Math.sin(theta);
      shard.position.set(px, py, pz);

      // Outward explosive velocity vector (fast enough to fill the frame within the ~4 s the shot lasts)
      const speed = 160 + Math.random() * 280;
      velocity.set(px, py, pz).normalize().multiplyScalar(speed);
      // Tangential spread
      velocity.x += (Math.random() - 0.5) * 60;
      velocity.y += (Math.random() - 0.5) * 60;
      velocity.z += (Math.random() - 0.5) * 60;

      rotVelocity.set((Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 2.5);
    }

    // 240 small fragments from the whole surface, a little faster than the chunks
    for (let i = 0; i < FRAGMENT_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const nx = Math.sin(phi) * Math.cos(theta);
      const ny = Math.cos(phi);
      const nz = Math.sin(phi) * Math.sin(theta);
      const r = 440 + Math.random() * 40;
      const speed = 200 + Math.random() * 420;
      this.fragPos[i * 3] = nx * r;
      this.fragPos[i * 3 + 1] = ny * r;
      this.fragPos[i * 3 + 2] = nz * r;
      this.fragVel[i * 3] = nx * speed + (Math.random() - 0.5) * 80;
      this.fragVel[i * 3 + 1] = ny * speed + (Math.random() - 0.5) * 80;
      this.fragVel[i * 3 + 2] = nz * speed + (Math.random() - 0.5) * 80;
      this.fragRot.fill(0, i * 3, i * 3 + 3);
      this.fragSpin[i * 3] = (Math.random() - 0.5) * 6;
      this.fragSpin[i * 3 + 1] = (Math.random() - 0.5) * 6;
      this.fragSpin[i * 3 + 2] = (Math.random() - 0.5) * 6;
      this.fragScale[i] = 6 + Math.random() * 16;
    }
    this.fragments.visible = true;
    this.core.visible = true;
    this.shock.visible = true;
    this.updateFragments(0);
  }

  private updateFragments(dt: number) {
    const cullSq = SHARD_CULL_DISTANCE * SHARD_CULL_DISTANCE;
    const d = this.dummy;
    for (let i = 0; i < FRAGMENT_COUNT; i++) {
      const k = i * 3;
      this.fragPos[k] += this.fragVel[k] * dt;
      this.fragPos[k + 1] += this.fragVel[k + 1] * dt;
      this.fragPos[k + 2] += this.fragVel[k + 2] * dt;
      this.fragRot[k] += this.fragSpin[k] * dt;
      this.fragRot[k + 1] += this.fragSpin[k + 1] * dt;
      this.fragRot[k + 2] += this.fragSpin[k + 2] * dt;
      const far = this.fragPos[k] ** 2 + this.fragPos[k + 1] ** 2 + this.fragPos[k + 2] ** 2 > cullSq;
      d.position.set(this.fragPos[k], this.fragPos[k + 1], this.fragPos[k + 2]);
      d.rotation.set(this.fragRot[k], this.fragRot[k + 1], this.fragRot[k + 2]);
      d.scale.setScalar(far ? 0 : this.fragScale[i]);
      d.updateMatrix();
      this.fragments.setMatrixAt(i, d.matrix);
    }
    this.fragments.instanceMatrix.needsUpdate = true;
  }

  public reset() {
    this.isShattered = false;
    this.ending = false;
    this.earthMesh.rotation.set(0, 0, 0);
    this.cloudMesh.rotation.set(0, 0, 0);
    this.earthMesh.visible = true;
    this.cloudMesh.visible = true;
    this.isRippling = false;
    this.rippleWaveTime = 0;
    this.ratio = 0;
    this.group.visible = false;
    this.group.position.copy(ENDING_POSITION);

    // Hide the blast pieces again (they are reused, not rebuilt)
    this.shardsGroup.visible = false;
    this.fragments.visible = false;
    this.core.visible = false;
    this.shock.visible = false;
    this.blastTime = 0;
    this.earthMat.emissiveIntensity = 0;
    this.cloudMat.opacity = CLOUD_OPACITY;

    // Reset Earth vertex positions
    const posAttr = this.earthGeometry.attributes.position;
    for (let i = 0; i < posAttr.count * 3; i++) {
      posAttr.array[i] = this.originalPositions[i];
    }
    posAttr.needsUpdate = true;
  }

  public update(dt: number) {
    // Rotation of Earth & clouds
    if (!this.isShattered && !this.ending) {
      this.earthMesh.rotation.y += dt * 0.05;
      this.cloudMesh.rotation.y += dt * 0.07;
      this.cloudMesh.rotation.x += dt * 0.01;
    }

    // Fart #22: Earth Rippling vertex displacement wave (runs only until the wave has died out)
    if (this.isRippling) {
      this.rippleWaveTime += dt * RIPPLE_SPEED;
      const decay = Math.max(0, 1 - this.rippleWaveTime * RIPPLE_FADE);
      // Light the surface up and thin the cloud shell (it does not ripple, and sits only 12 m above the surface)
      this.earthMat.emissiveIntensity = 0.6 * decay;
      this.cloudMat.opacity = CLOUD_OPACITY * (1 - decay * Math.min(1, this.rippleWaveTime));
      const posAttr = this.earthGeometry.attributes.position;
      const count = posAttr.count;
      // The wave is laid out over the visible cap only (d < 1 - ratio), so the ring is seen sweeping outward
      const dCap = Math.max(0.05, this.ratio > 0 ? 1 - this.ratio : 0.15);
      const waveRate = Math.PI * 2 * RIPPLE_WAVES;
      // Envelope peak in cap units (0 at the pole, 1 at the limb): travels with the crests
      const front = this.rippleWaveTime / waveRate;

      for (let i = 0; i < count; i++) {
        const ox = this.originalPositions[i * 3];
        const oy = this.originalPositions[i * 3 + 1];
        const oz = this.originalPositions[i * 3 + 2];

        const len = Math.sqrt(ox * ox + oy * oy + oz * oz);
        const nx = ox / len;
        const ny = oy / len;
        const nz = oz / len;

        // Wave front leaves the pole directly below Dave and sweeps out over the visible cap (u = 0 at the pole)
        const u = (1 - ny) / dCap;
        const envelope = 0.15 + 0.85 * Math.exp(-((u - front) * (u - front)) / 0.15);
        const wave = Math.sin(u * waveRate - this.rippleWaveTime) * envelope * RIPPLE_AMPLITUDE * decay;
        posAttr.setXYZ(i, ox + nx * wave, oy + ny * wave, oz + nz * wave);
      }
      posAttr.needsUpdate = true;
      if (decay === 0) this.isRippling = false; // last write restored the original positions
    }

    // Update shattered shards tumbling outward into deep space
    if (this.isShattered) {
      const cullSq = SHARD_CULL_DISTANCE * SHARD_CULL_DISTANCE;
      this.shards.forEach((s) => {
        if (!s.mesh.visible) return;
        s.mesh.position.addScaledVector(s.velocity, dt);
        s.mesh.rotation.x += s.rotVelocity.x * dt;
        s.mesh.rotation.y += s.rotVelocity.y * dt;
        s.mesh.rotation.z += s.rotVelocity.z * dt;
        if (s.mesh.position.lengthSq() > cullSq) s.mesh.visible = false;
      });
      this.updateFragments(dt);

      // Fireball core (ease-out growth, fades) and the expanding shockwave shell
      this.blastTime += dt;
      // The core ignites a few frames after the HUD flash, so the two do not stack into white-on-white
      const coreT = Math.max(0, this.blastTime - CORE_DELAY);
      const ck = Math.min(1, coreT / CORE_DURATION);
      this.core.visible = ck < 1;
      this.core.scale.setScalar(120 + 780 * (1 - (1 - ck) * (1 - ck)));
      (this.core.material as THREE.MeshBasicMaterial).opacity = coreT > 0 ? 0.95 * (1 - ck) * (1 - ck) : 0;
      const sk = Math.min(1, this.blastTime / SHOCK_DURATION);
      this.shock.visible = sk < 1;
      this.shock.scale.setScalar(EARTH_RADIUS + (SHOCK_END_RADIUS - EARTH_RADIUS) * (1 - (1 - sk) * (1 - sk)));
      (this.shock.material as THREE.MeshBasicMaterial).opacity = 0.3 * (1 - sk);
    }
  }
}
