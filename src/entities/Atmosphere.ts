import * as THREE from 'three';
import { mulberry32 } from './ProceduralCity';

/** Stars fade in between these altitudes (metres). */
const STARS_FADE_START = 1500;
const STARS_FADE_END = 6000;
/** The cloud decks (215 to 1400 m) are hidden above this altitude (metres). */
const CLOUDS_HIDDEN_ALTITUDE = 2500;
/** Dave is this close (metres) below the satellite when it gets knocked into its tumble. */
const SATELLITE_KNOCK_DISTANCE = 45;

/** Speed-streak layer: height of one wrap period (m), number of streaks, and how much altitude it scrolls per metre climbed. */
const DUST_HEIGHT = 140;
const DUST_COUNT = 140;
const DUST_SCROLL_PER_METRE = 0.04;
const DUST_STREAK_LENGTH = 3;

interface CloudAnchor {
  ox: number;
  oz: number;
  phase: number;
}

export class Atmosphere {
  public group: THREE.Group;
  public clouds: THREE.Group[] = [];
  public starfield: THREE.Points;
  public satelliteGroup: THREE.Group;
  public satelliteSpinVelocity = 0;
  public moonGroup: THREE.Group;
  public astronautLeftArm: THREE.Mesh;
  public astronautRightArm: THREE.Mesh;
  private dust!: THREE.LineSegments;
  private dustMaterial!: THREE.LineBasicMaterial;
  private dustBaseY = new Float32Array(DUST_COUNT);
  private dustScroll = 0;
  private lastAltitude = 0;
  /** Smoothed climb speed (m/s) that drives the speed streaks. */
  private climbSpeed = 0;

  // Sky color palette
  private daySkyColor = new THREE.Color(0x6ca0dc);
  private stratosphereColor = new THREE.Color(0x1b2a4a);
  private spaceColor = new THREE.Color(0x05070f);

  private cloudAnchors: CloudAnchor[] = [];
  private cloudDrift: number[] = [];
  private anchorX = 0;
  private anchorZ = 0;
  private satelliteKnocked = false;
  private starMaterial: THREE.PointsMaterial;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Atmosphere';

    this.buildCloudDeck();
    this.buildDust();
    this.starfield = this.buildStarfield();
    this.starMaterial = this.starfield.material as THREE.PointsMaterial;
    this.satelliteGroup = this.buildSatellite();
    const { moon, armL, armR } = this.buildMoon();
    this.moonGroup = moon;
    this.astronautLeftArm = armL;
    this.astronautRightArm = armR;
  }

  private buildCloudDeck() {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      flatShading: true
    });

    // Cloud deck stretches from altitude 215m to 1400m. The last three are low, wide decks that fill the
    // bare 190-500 m part of the climb (above the rooftops, before the first big clusters).
    const cloudAltitudes = [280, 380, 520, 700, 920, 1150, 1400, 215, 250, 330];
    const wideFrom = 7;
    const rand = mulberry32(20250601);
    cloudAltitudes.forEach((alt, idx) => {
      const cluster = new THREE.Group();
      // Spread across the width and kept in front of the chase camera (which looks towards -z)
      const ox = (rand() - 0.5) * 90;
      const oz = -(25 + rand() * 55);
      cluster.position.set(ox, alt, oz);
      this.cloudAnchors.push({ ox, oz, phase: idx });
      this.cloudDrift.push(0);

      const wide = idx >= wideFrom;
      const blobCount = wide ? 9 : 5 + (idx % 4);
      for (let b = 0; b < blobCount; b++) {
        const radius = (wide ? 9 : 6) + rand() * 8;
        const blobGeo = new THREE.DodecahedronGeometry(radius, 1);
        const blob = new THREE.Mesh(blobGeo, cloudMat);
        // Stacked in height as well, so a cloud covers more of the (very fast) climb
        blob.position.set((rand() - 0.5) * (wide ? 40 : 18), (rand() - 0.5) * (wide ? 14 : 12), (rand() - 0.5) * (wide ? 30 : 18));
        blob.rotation.set(rand() * Math.PI, rand() * Math.PI, 0);
        cluster.add(blob);
      }

      this.group.add(cluster);
      this.clouds.push(cluster);
    });
  }

  /** Camera-relative streaks that scroll with altitude, so the climb above the clouds still reads as speed. */
  private buildDust() {
    const rand = mulberry32(777);
    const positions = new Float32Array(DUST_COUNT * 6);
    for (let i = 0; i < DUST_COUNT; i++) {
      const x = (rand() - 0.5) * 70;
      const z = -70 + rand() * 80;
      this.dustBaseY[i] = rand() * DUST_HEIGHT;
      positions[i * 6] = x;
      positions[i * 6 + 2] = z;
      positions[i * 6 + 3] = x;
      positions[i * 6 + 5] = z;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.dustMaterial = new THREE.LineBasicMaterial({
      color: 0xcfe3ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false
    });
    this.dust = new THREE.LineSegments(geometry, this.dustMaterial);
    this.dust.frustumCulled = false; // always around the camera
    this.dust.renderOrder = -1; // drawn before the transparent fireball and shock shell, not after them
    this.dust.visible = false;
    this.group.add(this.dust);
  }

  private buildStarfield(): THREE.Points {
    const count = 4000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Full sphere shell around the camera (the field is re-centred on the camera every frame)
      const r = 20000 + Math.random() * 10000;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      // Star sparkle tint
      const brightness = 0.6 + Math.random() * 0.4;
      colors[i * 3] = brightness;
      colors[i * 3 + 1] = brightness * (0.9 + Math.random() * 0.1);
      colors[i * 3 + 2] = brightness;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 2.4,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false
    });

    const starfield = new THREE.Points(geometry, material);
    starfield.frustumCulled = false; // always centred on the camera
    starfield.renderOrder = -1; // centred on the camera it would otherwise sort last and draw over the fireball
    starfield.visible = false;
    this.group.add(starfield);
    return starfield;
  }

  private buildSatellite(): THREE.Group {
    const satGroup = new THREE.Group();
    // Parked at altitude 4200m (Fart #20) on the chase camera's view axis: the camera sits at Dave + (2.6, 3, 9.5)
    // and looks at his column, so it is yawed about 15 degrees left, towards Dave + (-4, y, -16). The body and both
    // wings (about 17 m across) then fit the portrait frustum.
    satGroup.position.set(-4, 4200, -16);

    // Boxy yellow satellite body
    const bodyGeo = new THREE.BoxGeometry(2.4, 2.4, 3.2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xebbe28,
      metalness: 0.8,
      roughness: 0.3,
      flatShading: true
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    satGroup.add(body);

    // Dark solar array wings
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x112344,
      metalness: 0.6,
      roughness: 0.2,
      flatShading: true
    });
    const wingGeo = new THREE.BoxGeometry(7.2, 0.15, 2.6);
    const leftWing = new THREE.Mesh(wingGeo, wingMat);
    leftWing.position.set(-4.8, 0, 0); // inner edge flush with the body (half-width 1.2)
    satGroup.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, wingMat);
    rightWing.position.set(4.8, 0, 0);
    satGroup.add(rightWing);

    // Antenna dish
    const dishGeo = new THREE.ConeGeometry(0.9, 0.6, 6);
    const dishMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, flatShading: true });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.position.set(0, 1.5, 0.8);
    dish.rotation.x = Math.PI * 0.7;
    satGroup.add(dish);

    this.group.add(satGroup);
    return satGroup;
  }

  private buildMoon(): { moon: THREE.Group; armL: THREE.Mesh; armR: THREE.Mesh } {
    const moonGroup = new THREE.Group();
    // Dave's altitude at Fart #21 is 7200m. The moon sits slightly below and left of the climb axis so
    // the astronaut on top lands inside the portrait frustum as Dave arrives.
    moonGroup.position.set(-12, 7172, -45);

    // Faceted gray low-poly sphere with craters
    const moonGeo = new THREE.IcosahedronGeometry(28, 2);
    const moonMat = new THREE.MeshStandardMaterial({
      color: 0xbfbfbf,
      roughness: 0.9,
      flatShading: true
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonGroup.add(moonMesh);

    const up = new THREE.Vector3(0, 1, 0);
    // Camera-facing side of the moon (towards +z and up), where the astronaut stands
    const astroNormal = new THREE.Vector3(0.2, 0.45, 0.87).normalize();

    // Craters on the moon surface: evenly spread (fibonacci sphere), flat discs lying on the surface
    const craterMat = new THREE.MeshStandardMaterial({ color: 0x7c7c7c, flatShading: true });
    const craterCount = 16;
    const normal = new THREE.Vector3();
    for (let i = 0; i < craterCount; i++) {
      const y = 1 - ((i + 0.5) / craterCount) * 2;
      const ringR = Math.sqrt(1 - y * y);
      const a = i * 2.399963; // golden angle
      normal.set(Math.cos(a) * ringR, y, Math.sin(a) * ringR);
      if (normal.dot(astroNormal) > 0.92) continue; // keep the astronaut's landing spot clear

      const crater = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.2, 0.6, 7), craterMat);
      crater.position.copy(normal).multiplyScalar(27.7);
      crater.quaternion.setFromUnitVectors(up, normal);
      moonGroup.add(crater);
    }

    // Tiny white-suited astronaut standing on moon surface
    // Big enough to read from ~50 m, standing on the camera-facing side of the moon (towards +z and up),
    // away from the top of the frame where the HUD card sits.
    const astroGroup = new THREE.Group();
    astroGroup.position.copy(astroNormal).multiplyScalar(27.5);
    astroGroup.quaternion.setFromUnitVectors(up, astroNormal);
    astroGroup.scale.setScalar(3);

    const suitMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, flatShading: true });
    const visorMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 0.9, roughness: 0.1 });

    const astroTorso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.6), suitMat);
    astroTorso.position.y = 0.8;
    astroGroup.add(astroTorso);

    const astroHead = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.65), suitMat);
    astroHead.position.y = 1.65;
    astroGroup.add(astroHead);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 0.1), visorMat);
    visor.position.set(0, 1.65, 0.35);
    astroGroup.add(visor);

    // Waving panic arms
    const armGeo = new THREE.BoxGeometry(0.24, 0.75, 0.24);
    const armL = new THREE.Mesh(armGeo, suitMat);
    armL.position.set(-0.6, 1.3, 0);
    astroGroup.add(armL);

    const armR = new THREE.Mesh(armGeo, suitMat);
    armR.position.set(0.6, 1.3, 0);
    astroGroup.add(armR);

    // Flag
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.5), new THREE.MeshBasicMaterial({ color: 0xdddddd }));
    pole.position.set(1.4, 1.25, 0);
    astroGroup.add(pole);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.04), new THREE.MeshBasicMaterial({ color: 0xff3333 }));
    flag.position.set(1.85, 2.1, 0);
    astroGroup.add(flag);

    moonGroup.add(astroGroup);
    this.group.add(moonGroup);

    return { moon: moonGroup, armL, armR };
  }

  /** Writes the sky colour for this altitude into `out` (no allocation). */
  public getSkyColorInto(out: THREE.Color, altitude: number): THREE.Color {
    if (altitude < 250) {
      return out.copy(this.daySkyColor);
    } else if (altitude < 1800) {
      const t = (altitude - 250) / (1800 - 250);
      return out.copy(this.daySkyColor).lerp(this.stratosphereColor, t);
    } else if (altitude < 8000) {
      const t = Math.min(1, (altitude - 1800) / (8000 - 1800));
      return out.copy(this.stratosphereColor).lerp(this.spaceColor, t);
    }
    return out.copy(this.spaceColor);
  }

  /** Keeps the star shell and the speed streaks centred on the camera (no parallax, like a skybox). */
  public followCamera(camPos: THREE.Vector3) {
    this.starfield.position.copy(camPos);
    this.dust.position.copy(camPos);
  }

  /**
   * Keeps the cloud decks, the satellite and the moon on Dave's climb axis wherever he has steered to.
   * Props stop following once he has passed them; everything freezes for the ending, which is staged
   * relative to the moon.
   */
  public followDave(dave: THREE.Vector3, ending: boolean) {
    if (ending) return;
    this.anchorX = dave.x;
    this.anchorZ = dave.z;
    if (dave.y < this.satelliteGroup.position.y + 30) {
      this.satelliteGroup.position.x = dave.x - 4;
      this.satelliteGroup.position.z = dave.z - 16;
    }
    if (dave.y < this.moonGroup.position.y + 60) {
      this.moonGroup.position.x = dave.x - 12;
      this.moonGroup.position.z = dave.z - 45;
    }
  }

  /** Back to the day-one state for Play Again. */
  public reset() {
    this.satelliteSpinVelocity = 0;
    this.satelliteKnocked = false;
    this.satelliteGroup.rotation.set(0, 0, 0);
    this.moonGroup.rotation.set(0, 0, 0);
    this.cloudDrift.fill(0);
    this.starMaterial.opacity = 0;
    this.starfield.visible = false;
    this.dustMaterial.opacity = 0;
    this.dust.visible = false;
    this.dustScroll = 0;
    this.lastAltitude = 0;
    this.climbSpeed = 0;
  }

  public update(dt: number, altitude: number, fartNumber: number) {
    const time = performance.now() * 0.001;

    // Stars fade in with altitude
    const starT = THREE.MathUtils.smoothstep(altitude, STARS_FADE_START, STARS_FADE_END);
    this.starMaterial.opacity = 0.95 * starT;
    this.starfield.visible = starT > 0.01;

    // Speed streaks: opacity follows the climb speed (not the altitude), so they show from the first big hops.
    // The scroll is clamped per frame so a 1000 m/s climb never strobes.
    if (dt > 0) this.climbSpeed += (Math.abs(altitude - this.lastAltitude) / dt - this.climbSpeed) * (1 - Math.exp(-8 * dt));
    const dust = THREE.MathUtils.smoothstep(this.climbSpeed, 20, 200) * (1 - THREE.MathUtils.smoothstep(altitude, 27000, 29500));
    this.dustMaterial.opacity = 0.5 * dust;
    this.dust.visible = dust > 0.01;
    this.dustScroll += THREE.MathUtils.clamp((altitude - this.lastAltitude) * DUST_SCROLL_PER_METRE, -DUST_HEIGHT * 0.35, DUST_HEIGHT * 0.35);
    this.lastAltitude = altitude;
    if (this.dust.visible) {
      const pos = this.dust.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < DUST_COUNT; i++) {
        const y = ((((this.dustBaseY[i] - this.dustScroll) % DUST_HEIGHT) + DUST_HEIGHT) % DUST_HEIGHT) - DUST_HEIGHT / 2;
        pos.setY(i * 2, y);
        pos.setY(i * 2 + 1, y + DUST_STREAK_LENGTH);
      }
      pos.needsUpdate = true;
    }

    // Gentle cloud drift, clouds stay around the climb axis. They are hidden once Dave is above them (and in the
    // ending, staged at 30 km), where they would only show as white flecks floating in space under the planet.
    this.clouds.forEach((cloud, i) => {
      cloud.visible = altitude < CLOUDS_HIDDEN_ALTITUDE;
      const a = this.cloudAnchors[i];
      this.cloudDrift[i] += Math.sin(time * 0.5 + a.phase) * dt * 1.5;
      cloud.position.x = this.anchorX + a.ox + this.cloudDrift[i];
      cloud.position.z = this.anchorZ + a.oz;
    });

    // Satellite knock-spin when Dave rises to meet it (just under Fart #20's altitude)
    if (!this.satelliteKnocked && altitude >= this.satelliteGroup.position.y - SATELLITE_KNOCK_DISTANCE && fartNumber >= 20) {
      this.satelliteKnocked = true;
      this.satelliteSpinVelocity = 14.0; // Rapid tumble knocked by Dave
    }
    if (this.satelliteKnocked) {
      this.satelliteSpinVelocity = Math.max(1.5, this.satelliteSpinVelocity - dt * 0.8);
      this.satelliteGroup.rotation.x += this.satelliteSpinVelocity * dt;
      this.satelliteGroup.rotation.y += this.satelliteSpinVelocity * 0.7 * dt;
      this.satelliteGroup.rotation.z += this.satelliteSpinVelocity * 0.4 * dt;
    } else {
      this.satelliteGroup.rotation.y += dt * 0.3;
    }

    // Astronaut panic waving arms (Fart #21+)
    if (fartNumber >= 21) {
      this.astronautLeftArm.rotation.z = Math.sin(time * 16) * 0.8 + 1.2;
      this.astronautRightArm.rotation.z = -Math.cos(time * 16) * 0.8 - 1.2;
    } else {
      this.astronautLeftArm.rotation.z = 0.2;
      this.astronautRightArm.rotation.z = -0.2;
    }

  }
}
