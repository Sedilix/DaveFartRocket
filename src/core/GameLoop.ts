import * as THREE from 'three';
import { physicsWorld, DAVE_CENTER_Y } from './Physics';
import { Dave, WALK_LIMIT_X, WALK_LIMIT_Z } from '../entities/Dave';
import { CityChunk } from '../entities/CityChunk';
import { Atmosphere } from '../entities/Atmosphere';
import { PlanetEarth } from '../entities/PlanetEarth';
import { CameraController } from './CameraController';
import { fartAudio } from '../audio/FartSynth';
import { endGameMusic } from '../audio/EndGameMusic';
import { quality } from './QualityManager';
import { useGameStore } from './gameState';
import { getMilestone } from '../data/milestones';
import { InputManager } from '../ui/InputManager';
import { HudController } from '../ui/HudController';

/** Sun direction relative to Dave (the light and its shadow frustum follow him). */
const LIGHT_OFFSET = new THREE.Vector3(30, 60, 40);
/** From this fart on the ascent camera tilts down to frame the planet below Dave. */
const LOOK_DOWN_FROM_FART = 19;
/** Blast flash: peaks at WHITEOUT_PEAK, holds a few frames, then fades over WHITEOUT_FADE seconds (cubic ease). */
const WHITEOUT_PEAK = 0.7;
const WHITEOUT_HOLD = 0.05;
const WHITEOUT_FADE = 0.5;
const WHITEOUT_DURATION = WHITEOUT_HOLD + WHITEOUT_FADE;
/** Shadow frustum width (metres) and the altitude above which the shadow pass is skipped (nothing to receive it). */
const SHADOW_EXTENT = 80;
const SHADOW_OFF_ALTITUDE = 150;
/** The blast shot is frozen after this many seconds so nothing grows without bound behind the Play Again screen. */
const ENDING_MAX_T = 6;
/** How often (seconds) the tension countdown is mirrored into the store; the ring itself updates every frame. */
const TENSION_STORE_INTERVAL = 0.1;
/** The tension ring is a CSS-filtered SVG on top of the canvas: redraw it at about 20 Hz, not every frame. */
const TENSION_RING_INTERVAL = 0.05;
/**
 * From this fart on, every street launch has fired and Dave sags no lower than 270 m: the street is never seen again.
 * It is hidden for good (until Play Again) once he passes the altitude, where the fog has long swallowed the towers.
 */
const STREET_HIDDEN_FROM_FART = 16;
const STREET_HIDDEN_ALTITUDE = 400;
/** Extra fog density that thickens the haze just before the street is hidden, so the city fades out instead of popping. */
const STREET_FADE_FOG = 0.008;
/** Minimum seconds between two farts from #9 on (grows slightly with the fart number), so every beat can land. */
const COOLDOWN_BASE = 1.5;
const COOLDOWN_PER_FART = 0.03;
/** The ending can be skipped by tapping after this many seconds of it. */
const ENDING_SKIP_AFTER = 3;
/** If the ending never reports ready (something threw) the Play Again screen is forced after this many seconds. */
const CLIMAX_WATCHDOG = 20;
/** Where Dave touches down: 0 on the road, 0.30 on the sidewalks (the kerb is at |x| = 7). The 6.5 to 7.5 band is never a landing spot. */
const surfaceY = (x: number) => (Math.abs(x) < 7 ? 0 : 0.3);

export class GameLoop {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private cameraController: CameraController;
  private hudController: HudController;
  private inputManager: InputManager;

  // Entities
  private dave!: Dave;
  private city!: CityChunk;
  private atmosphere!: Atmosphere;
  private earth!: PlanetEarth;

  // Lighting
  private dirLight!: THREE.DirectionalLight;
  private shadowTexel = SHADOW_EXTENT / 2048;
  // Light-space basis, used to snap the shadow frustum to the shadow-map texel grid
  private lightRight = new THREE.Vector3();
  private lightUp = new THREE.Vector3();
  private lightSnap = new THREE.Vector3();

  // Animation timing
  private lastTime = -1; // -1: take the next rAF timestamp as the baseline (first frame has dt 0)
  private rafId = 0;
  private isRunning = false;
  private contextLost = false;
  private frameErrors = 0;
  private targetDaveAltitude = 0;
  /** Latched once Dave has climbed past the street for good (cleared on restart). */
  private streetGone = false;
  private ending: { phase: 'moon' | 'earth' | 'blast'; t: number; daveT: number; blasted: boolean } | null = null;
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpC = new THREE.Vector3();
  private skyScratch = new THREE.Color();
  private zeroMove = new THREE.Vector2();
  private boostTimer = 0; // seconds of rocket thrust left after a fart
  private fallSpeed = 0;
  private fallGravity = 9.81; // scaled per leap so the drop always takes ~3s
  private coastFloor = 0; // altitude Dave sags back to between farts (0 = he lands)
  private isWhiteoutFading = false;
  private whiteoutTimer = 0;
  private shownWhiteout = 0;
  private tension = useGameStore.getState().maxTension;
  private tensionStoreTimer = 0;
  private ringTimer = 0;
  private lastFartAt = -Infinity; // performance.now() of the last fart
  private endingClock = 0; // seconds since the ending started
  private climaxClock = 0; // seconds since fart #25 (watchdog)
  private ducked = false; // the pre-blast audio duck has been triggered

  private readonly onSkipEnding = () => {
    const e = this.ending;
    if (e && e.phase !== 'blast' && this.endingClock >= ENDING_SKIP_AFTER) {
      e.phase = 'blast';
      e.t = 0;
    }
  };

  private readonly onResize = () => this.onWindowResize();
  private readonly onContextLost = (e: Event) => {
    e.preventDefault(); // lets the browser restore the context
    this.contextLost = true;
    cancelAnimationFrame(this.rafId);
  };
  private readonly onContextRestored = () => {
    this.contextLost = false;
    this.lastTime = -1;
    if (this.isRunning) this.rafId = requestAnimationFrame(this.render);
  };
  private readonly onVisibility = () => {
    this.lastTime = -1; // no giant dt after the tab was hidden
  };

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Scene & Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x6ca0dc); // Daytime street blue
    this.scene.fog = new THREE.FogExp2(0x6ca0dc, 0.003);

    this.renderer = new THREE.WebGLRenderer({
      antialias: quality.tier === 'high',
      powerPreference: 'high-performance',
      stencil: false,
      alpha: false
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    quality.bindRenderer(this.renderer);
    this.renderer.shadowMap.enabled = quality.profile.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);

    // 2. Camera Controller
    this.cameraController = new CameraController();
    this.cameraController.resize(window.innerWidth, window.innerHeight);

    // 3. UI & Inputs
    this.hudController = new HudController(this.container);
    this.inputManager = new InputManager();

    const { base, handle } = this.hudController.getJoystickElements();
    this.inputManager.bindJoystickElements(base, handle);
    this.inputManager.bindReleaseButton(this.hudController.getReleaseButton());

    // Both callbacks ignore input until start() has built the world (executeFart / restartGame guard on isRunning)
    this.inputManager.setOnRelease(() => {
      this.executeFart();
    });

    this.hudController.setOnPlayAgain(() => {
      this.restartGame();
    });

    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pointerdown', this.onSkipEnding, { passive: true, capture: true });
  }

  public async start() {
    try {
      await this.init();
    } catch (err) {
      console.error('Game failed to start', err);
      this.showStartError();
    }
  }

  /** Replaces a dead scene (failed WASM or WebGL init) with a short message instead of a live HUD over nothing. */
  private showStartError() {
    this.isRunning = false;
    cancelAnimationFrame(this.rafId);
    const msg = document.createElement('div');
    msg.textContent = 'Could not start the game. Please reload the page.';
    msg.style.cssText =
      'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:1000;' +
      'padding:24px;text-align:center;font:600 18px system-ui,sans-serif;color:#fff;background:rgba(10,14,24,0.92)';
    this.container.appendChild(msg);
  }

  private async init() {
    this.buildLighting();

    // Initialize Rapier3D physics
    await physicsWorld.init();

    // Build Entities
    this.dave = new Dave();
    // Rig shoe soles sit at exact y = 0.00 on the street!
    this.dave.setShoeSolePosition(0, 0, 0);
    this.dave.initPhysics(physicsWorld);
    this.scene.add(this.dave.group);

    this.city = new CityChunk(physicsWorld);
    this.scene.add(this.city.group);

    this.atmosphere = new Atmosphere();
    this.scene.add(this.atmosphere.group);

    this.earth = new PlanetEarth();
    this.scene.add(this.earth.group);

    await this.precompileShaders();

    this.tension = useGameStore.getState().maxTension;
    this.isRunning = true;
    this.hudController.startIntro(); // the opening headline starts counting now, not during asset load
    this.lastTime = -1;
    this.rafId = requestAnimationFrame(this.render);
  }

  /**
   * Compiles every shader program up front (hidden groups made visible for the duration), so the first fart,
   * the Earth and the blast never stall mid-play on a first-use compile.
   */
  private async precompileShaders() {
    const hidden: THREE.Object3D[] = [];
    this.scene.traverse((o) => {
      if (!o.visible) hidden.push(o);
    });
    hidden.forEach((o) => (o.visible = true));
    try {
      await this.renderer.compileAsync(this.scene, this.cameraController.camera);
    } catch (err) {
      console.warn('Shader precompile skipped', err);
    } finally {
      hidden.forEach((o) => (o.visible = false));
    }
  }

  private buildLighting() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));

    // Sky/ground fill so dark materials (asphalt, car roofs) never crush to black under ACES tone mapping
    this.scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x8a8f96, 0.5));

    this.dirLight = new THREE.DirectionalLight(0xfff7e6, 1.3);
    this.dirLight.position.copy(LIGHT_OFFSET);
    this.dirLight.castShadow = true;
    // A phone does not need 2048 (and a high-DPR screen is already fill-rate bound)
    const mapSize = quality.profile.shadowMapSize;
    this.shadowTexel = SHADOW_EXTENT / mapSize;
    this.dirLight.shadow.mapSize.width = mapSize;
    this.dirLight.shadow.mapSize.height = mapSize;
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.normalBias = 0.02;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 250;
    this.dirLight.shadow.camera.left = -SHADOW_EXTENT / 2;
    this.dirLight.shadow.camera.right = SHADOW_EXTENT / 2;
    this.dirLight.shadow.camera.top = SHADOW_EXTENT / 2;
    this.dirLight.shadow.camera.bottom = -SHADOW_EXTENT / 2;
    // Light-space axes (the same ones lookAt builds for a light at LIGHT_OFFSET looking at the origin)
    this.tmpA.copy(LIGHT_OFFSET).normalize();
    this.lightRight.set(0, 1, 0).cross(this.tmpA).normalize();
    this.lightUp.copy(this.tmpA).cross(this.lightRight);
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target); // the target must be in the scene for its matrix to update
  }

  private executeFart() {
    if (!this.isRunning) return; // world is still loading
    const store = useGameStore.getState();
    if (store.isClimax) return;
    // From #9 the beats are spaced out (manual releases only: the tension countdown is already 4.5 s)
    const now = performance.now();
    const nextNumber = Math.min(25, store.fartNumber + 1);
    if (nextNumber >= 9 && now - this.lastFartAt < (COOLDOWN_BASE + (nextNumber - 9) * COOLDOWN_PER_FART) * 1000) return;
    this.lastFartAt = now;

    // Trigger next milestone in store
    store.triggerFart();
    this.tension = store.maxTension;
    this.tensionStoreTimer = 0;

    const newStore = useGameStore.getState();
    const fartNumber = newStore.fartNumber;
    const milestone = getMilestone(fartNumber);

    // The ending is set up first: a throw in any of the cosmetic effects below must never leave the game
    // in the climax state without a running ending
    if (fartNumber === 25) {
      this.climaxClock = 0;
      this.triggerWorldBreakerClimax();
    }

    // Audio synth and Dave VFX (cosmetic: failures are logged, never fatal)
    try {
      fartAudio.playFart(fartNumber);
      this.dave.triggerFartVFX(fartNumber, quality.profile.maxGasPuffs);
    } catch (err) {
      console.error('Fart effects failed', err);
    }

    // Camera shake
    this.cameraController.triggerShake(milestone.shakeIntensity);

    // Set target altitude for airborne rockets
    this.targetDaveAltitude = milestone.targetAltitude;

    if (fartNumber >= 9) {
      this.boostTimer = 2.2;
      this.fallSpeed = 0;
      // First hops (#9-#11) drop him back to the street; later ones sag toward the previous height
      this.coastFloor = fartNumber <= 11 ? 0 : getMilestone(fartNumber - 1).targetAltitude * 0.9;
      // Leaps and bounds: he falls back toward the floor, then the next fart throws him higher
      this.fallGravity = THREE.MathUtils.clamp((2 * (milestone.targetAltitude - this.coastFloor)) / 9, 9.81, 80);
      this.dave.isAirborne = true;
    }

    // Planetary effects
    if (fartNumber === 22) {
      this.earth.triggerRipple();
    }
  }

  private triggerWorldBreakerClimax() {
    // Closing cinematic: Dave streaks past the moon, then away from Earth, which then explodes
    this.ending = { phase: 'moon', t: 0, daveT: 0, blasted: false };
    this.endingClock = 0;
    this.ducked = false;
    this.dave.isAirborne = true;
    this.dave.isFloating = false;
    this.earth.placeForEnding();
  }

  /** Scripted ending shots. Dave and the camera are placed relative to the moon / Earth. */
  private runEnding(dt: number) {
    const e = this.ending!;
    this.endingClock += dt;
    e.t = Math.min(e.t + dt, e.phase === 'blast' ? ENDING_MAX_T : Infinity);
    const dave = this.dave.group.position;
    const cam = this.tmpA;
    const look = this.tmpB;

    if (e.phase === 'moon') {
      // Shot 1: camera parked beside the moon while Dave rockets past it
      const m = this.atmosphere.moonGroup.position;
      cam.set(m.x + 30, m.y - 15, m.z + 115);
      dave.set(m.x - 12 + e.t * 2, m.y - 70 + e.t * 65, m.z + 55); // in frame from the first frame
      look.copy(m).lerp(dave, 0.55);
      this.dave.bodyMeshGroup.scale.setScalar(2); // scale the body only, not the gas plume
      if (e.t >= 3.6) {
        e.phase = 'earth';
        e.t = 0;
      }
    } else {
      // Shot 2: Earth in focus, Dave dwindling into the distance. Shot 3: it blows up.
      const ep = this.earth.group.position;
      e.daveT = Math.min(e.daveT + dt, ENDING_MAX_T);
      const dist = 25 + 35 * e.daveT + 90 * e.daveT * e.daveT;
      this.dave.bodyMeshGroup.scale.setScalar(3);
      this.dave.isFloating = true; // "Dave is fine": calm drifting pose for the rest of the ending
      cam.set(ep.x + 260, ep.y + 330, ep.z + 2500);
      this.tmpC.set(-0.04, 0.2, -0.98).normalize(); // up and away, staying in frame above Earth
      dave.copy(cam).addScaledVector(this.tmpC, dist);
      dave.x -= 6;
      dave.y -= 4;

      if (e.phase === 'earth') {
        // Start on Dave as he whips away, then settle on the planet
        const k = THREE.MathUtils.smoothstep(e.t, 0.5, 2.2);
        look.copy(dave).lerp(ep, k);
        if (e.t >= 4.0 && !this.ducked) {
          this.ducked = true;
          fartAudio.duck(0.65); // the held breath before the blast
        }
        if (e.t >= 4.6) {
          e.phase = 'blast';
          e.t = 0;
        }
      } else {
        look.copy(ep);
        cam.z += 150 * Math.min(e.t, ENDING_MAX_T); // pull back to keep the debris in frame
        if (!e.blasted) {
          e.blasted = true;
          this.earth.shatterEarth(quality.profile.shatterShards);
          fartAudio.playShatter();
          this.cameraController.triggerShake(16); // in cinematic shots this jitters the aim, not the position
          this.setWhiteout(WHITEOUT_PEAK);
          this.isWhiteoutFading = true;
          this.whiteoutTimer = WHITEOUT_DURATION;
          endGameMusic.start(3.0);
        }
        if (e.t >= 4.2 && !useGameStore.getState().endingReady) useGameStore.getState().setEndingReady(true);
      }
    }
    this.cameraController.setCinematic(cam, look);
  }

  /** Writes the whiteout opacity to the store only when it visibly changed. */
  private setWhiteout(alpha: number) {
    if (alpha === 0 || alpha === 1 || Math.abs(alpha - this.shownWhiteout) >= 0.02) {
      this.shownWhiteout = alpha;
      useGameStore.getState().setWhiteoutOpacity(alpha);
    }
  }

  private restartGame() {
    if (!this.isRunning) return; // world is still loading
    endGameMusic.stop(1.2);
    useGameStore.getState().resetGame();
    this.targetDaveAltitude = 0;
    this.boostTimer = 0;
    this.fallSpeed = 0;
    this.coastFloor = 0;
    this.isWhiteoutFading = false;
    this.whiteoutTimer = 0;
    this.shownWhiteout = 0;
    this.tension = useGameStore.getState().maxTension;
    this.tensionStoreTimer = 0;
    this.ending = null;
    this.endingClock = 0;
    this.climaxClock = 0;
    this.ducked = false;
    this.lastFartAt = -Infinity;
    this.ringTimer = 0;
    this.streetGone = false;
    this.city.group.visible = true;
    this.dave.bodyMeshGroup.scale.setScalar(1);
    this.dave.group.rotation.set(0, 0, 0);
    this.dave.isFloating = false;

    // Reset Dave position on street
    this.dave.isAirborne = false;
    this.dave.setShoeSolePosition(0, 0, 0);

    // Snap the camera back to the street (no fly-through from space) and clear leftover shake
    this.cameraController.reset(this.dave.group.position);

    // Reset Earth, sky props and the sky colour
    this.earth.reset();
    this.atmosphere.reset();

    // Reset pedestrians, dog and traffic
    this.city.reset();
  }

  /** Spirals outwards from (x, z) to the first spot where Dave's capsule overlaps no collider. */
  private findFreeLanding(x: number, z: number): { x: number; z: number } {
    const body = this.dave.rigidBody ?? undefined;
    const isFree = (px: number, pz: number) => {
      // The curb band is never a landing spot: the capsule would half-overlap the sidewalk edge
      if (Math.abs(px) > 6.5 && Math.abs(px) < 7.5) return false;
      // Capsule lifted 0.35 m so only things taller than a curb (cars, tables) count, not the sidewalk itself
      return physicsWorld.isCapsuleFree(px, surfaceY(px) + DAVE_CENTER_Y + 0.35, pz, body);
    };
    for (let r = 0; r <= 15; r += 1.5) {
      const steps = r === 0 ? 1 : 12;
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const px = THREE.MathUtils.clamp(x + Math.cos(a) * r, -WALK_LIMIT_X, WALK_LIMIT_X);
        const pz = THREE.MathUtils.clamp(z + Math.sin(a) * r, -WALK_LIMIT_Z, WALK_LIMIT_Z);
        if (isFree(px, pz)) return { x: px, z: pz };
      }
    }
    // Nothing free nearby: the middle of the road is the least likely place to be blocked
    return { x: 0, z: THREE.MathUtils.clamp(z, -WALK_LIMIT_Z, WALK_LIMIT_Z) };
  }

  private onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height);
    this.cameraController.resize(width, height);
  }

  private readonly render = (timestamp: number) => {
    if (!this.isRunning || this.contextLost) return;
    try {
      this.update(timestamp);
    } catch (err) {
      // One bad update must never freeze the game for good, or the canvas
      if (this.frameErrors++ < 10) console.error('Frame error', err);
    }
    try {
      this.renderer.render(this.scene, this.cameraController.camera);
    } catch (err) {
      if (this.frameErrors++ < 10) console.error('Render error', err);
    } finally {
      this.rafId = requestAnimationFrame(this.render);
    }
  };

  private update(timestamp: number) {
    if (this.lastTime < 0) this.lastTime = timestamp;
    const dt = Math.max(0, Math.min((timestamp - this.lastTime) * 0.001, 0.1));
    quality.recordFrame(dt);
    this.lastTime = timestamp;

    let store = useGameStore.getState();

    // The first countdown waits for the first touch: before it the browser keeps audio suspended and the first farts
    // would be silent (the first-fart tension is held at full, the player is touching the screen within seconds)
    const awaitingGesture = store.fartNumber === 1 && !fartAudio.isUnlocked;

    // 1. Involuntary 4.5-second tension countdown (kept out of the store except for a slow mirror)
    if (!store.isClimax && !awaitingGesture) {
      this.tension -= dt;
      if (this.tension <= 0) {
        this.executeFart();
        store = useGameStore.getState(); // milestone, fart number and climax flag just changed
      } else {
        this.tensionStoreTimer += dt;
        if (this.tensionStoreTimer >= TENSION_STORE_INTERVAL) {
          this.tensionStoreTimer = 0;
          store.setTensionTimer(this.tension);
        }
      }
    }

    // 2. Handle whiteout flash fade out
    if (this.isWhiteoutFading) {
      this.whiteoutTimer -= dt;
      const k = Math.min(1, Math.max(0, this.whiteoutTimer / WHITEOUT_FADE)); // 1 while holding
      this.setWhiteout(WHITEOUT_PEAK * k * k * k); // held a few frames, then a fast cubic fade
      if (this.whiteoutTimer <= 0) {
        this.isWhiteoutFading = false;
      }
    }

    // Climax watchdog: if the ending never became ready (an exception in a cosmetic effect), force the Play Again screen
    if (store.isClimax) {
      this.climaxClock += dt;
      if (this.climaxClock > CLIMAX_WATCHDOG && !store.endingReady) useGameStore.getState().setEndingReady(true);
    }

    // The street is far below and out of sight from fart #16 on, and in the whole ending: skip it entirely
    if (store.fartNumber >= STREET_HIDDEN_FROM_FART && this.dave.group.position.y > STREET_HIDDEN_ALTITUDE) this.streetGone = true;
    const streetHidden = this.ending !== null || this.streetGone;
    this.city.group.visible = !streetHidden;

    // 3. Step Rapier physics (nothing to collide with while the street is gone)
    if (!streetHidden) physicsWorld.step(dt);

    // 4. Update Dave (airborne vertical rocket climbing vs street walking)
    if (this.ending) this.runEnding(dt);
    if (this.dave.isAirborne && !this.ending) {
      const pos = this.dave.group.position;
      if (store.isClimax || this.boostTimer > 0) {
        // Rocket thrust: smoothly approach target altitude with strong acceleration
        this.boostTimer -= dt;
        pos.y = THREE.MathUtils.lerp(pos.y, this.targetDaveAltitude, Math.min(1, dt * 2.8));
        this.fallSpeed = 0;
      } else {
        // Thrust spent: gravity pulls him back toward the coast floor until the next fart
        // Gravity fades out with altitude: full below 800 m, none above 2.5 km (stars are out by then), so he floats in space
        const gravityScale = 1 - THREE.MathUtils.smoothstep(pos.y, 800, 2500);
        this.fallSpeed = gravityScale > 0 ? this.fallSpeed + this.fallGravity * gravityScale * dt : 0;
        // The descent floor is the surface under him (sidewalk 0.30), not the road
        const floor = this.coastFloor === 0 ? surfaceY(pos.x) : this.coastFloor;
        pos.y = Math.max(floor, pos.y - this.fallSpeed * dt);
        if (pos.y <= floor) this.fallSpeed = 0;
      }
      // Keep low flights over the street and sidewalks so he can't drop into a building
      if (pos.y < 70) {
        pos.x = THREE.MathUtils.clamp(pos.x, -WALK_LIMIT_X, WALK_LIMIT_X);
        pos.z = THREE.MathUtils.clamp(pos.z, -WALK_LIMIT_Z, WALK_LIMIT_Z);
      }

      const landFloor = surfaceY(pos.x);
      if (this.coastFloor === 0 && this.boostTimer <= 0 && pos.y < landFloor + 4) {
        // Last 4 m of the fall: glide sideways onto a spot that is not inside a parked car, café table or moving
        // car (instead of snapping there on the touchdown frame)
        const spot = this.findFreeLanding(pos.x, pos.z);
        const k = 1 - Math.exp(-10 * dt);
        pos.x += (spot.x - pos.x) * k;
        pos.z += (spot.z - pos.z) * k;
      }

      if (this.coastFloor === 0 && this.boostTimer <= 0 && pos.y <= landFloor + 0.02) {
        const spot = this.findFreeLanding(pos.x, pos.z);
        const groundY = surfaceY(spot.x);
        this.dave.isAirborne = false;
        this.dave.setShoeSolePosition(spot.x, groundY, spot.z);
      }
    }

    this.dave.update(dt, this.ending ? this.zeroMove : this.inputManager.inputState.moveVector, physicsWorld);
    if (this.ending) this.dave.group.rotation.y = Math.PI; // flying away from the camera

    // Sun and shadow frustum follow Dave so he keeps shadow contact wherever he walks or flies.
    // The follow point is snapped to the shadow-map texel grid so static shadows do not crawl.
    const dp = this.dave.group.position;
    const sx = Math.round(dp.dot(this.lightRight) / this.shadowTexel) * this.shadowTexel - dp.dot(this.lightRight);
    const sy = Math.round(dp.dot(this.lightUp) / this.shadowTexel) * this.shadowTexel - dp.dot(this.lightUp);
    this.lightSnap.copy(dp).addScaledVector(this.lightRight, sx).addScaledVector(this.lightUp, sy);
    this.dirLight.target.position.copy(this.lightSnap);
    this.dirLight.position.copy(this.lightSnap).add(LIGHT_OFFSET);
    // High up there is nothing to receive a shadow: stop rendering the shadow map (no shader recompile)
    this.renderer.shadowMap.autoUpdate = dp.y < SHADOW_OFF_ALTITUDE && !this.ending;

    // 5. Update environment & sky color
    const currentAltitude = this.ending ? 30000 : dp.y; // the ending is staged in space
    const skyColor = this.atmosphere.getSkyColorInto(this.skyScratch, currentAltitude);
    (this.scene.background as THREE.Color).copy(skyColor);
    if (this.scene.fog) {
      this.scene.fog.color.copy(skyColor);
      // Fade fog out as we ascend into the clear stratosphere and space
      // From #16 the haze thickens on the way to the street-hide altitude, then thins out again with the city gone
      const fade = store.fartNumber >= STREET_HIDDEN_FROM_FART && !this.ending
        ? STREET_FADE_FOG *
          THREE.MathUtils.smoothstep(currentAltitude, 150, STREET_HIDDEN_ALTITUDE - 20) *
          (1 - THREE.MathUtils.smoothstep(currentAltitude, STREET_HIDDEN_ALTITUDE, STREET_HIDDEN_ALTITUDE + 250))
        : 0;
      (this.scene.fog as THREE.FogExp2).density = Math.max(0, 0.005 * (1 - Math.min(1, currentAltitude / 1200))) + fade;
    }

    if (!streetHidden) this.city.update(dt, store.currentMilestone.decibels, store.fartNumber, dp);
    this.atmosphere.followDave(dp, this.ending !== null);
    this.atmosphere.update(dt, currentAltitude, store.fartNumber);
    if (!this.ending) this.earth.placeForAscent(dp, store.fartNumber, dt, this.cameraController.camera);
    this.earth.update(dt);

    // 6. Update Camera (from the late ascent it tilts down to frame the planet below Dave)
    const lookDown = this.dave.isAirborne && store.fartNumber >= LOOK_DOWN_FROM_FART ? 1 : 0;
    this.cameraController.update(dt, dp, this.dave.isAirborne, store.isClimax, lookDown);
    this.atmosphere.followCamera(this.cameraController.camera.position);

    // The tension ring is driven directly every frame (store writes above can only be stale)
    if (!store.isClimax) {
      this.ringTimer += dt;
      if (this.ringTimer >= TENSION_RING_INTERVAL) {
        this.ringTimer = 0;
        this.hudController.updateTensionRing(this.tension, store.maxTension);
      }
    }
  }
}
