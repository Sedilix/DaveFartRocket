import * as THREE from 'three';
import { physicsWorld } from './Physics';
import { Dave } from '../entities/Dave';
import { CityChunk } from '../entities/CityChunk';
import { Atmosphere } from '../entities/Atmosphere';
import { PlanetEarth } from '../entities/PlanetEarth';
import { CameraController } from './CameraController';
import { fartAudio } from '../audio/FartSynth';
import { useGameStore } from './gameState';
import { getMilestone } from '../data/milestones';
import { InputManager } from '../ui/InputManager';
import { HudController } from '../ui/HudController';
export class GameLoop {
    container;
    scene;
    renderer;
    cameraController;
    hudController;
    inputManager;
    // Entities
    dave;
    city;
    atmosphere;
    earth;
    // Lighting
    dirLight;
    ambientLight;
    // Animation timing
    lastTime = performance.now();
    isRunning = false;
    targetDaveAltitude = 0;
    ending = null;
    tmpA = new THREE.Vector3();
    tmpB = new THREE.Vector3();
    tmpC = new THREE.Vector3();
    zeroMove = new THREE.Vector2();
    boostTimer = 0; // seconds of rocket thrust left after a fart
    fallSpeed = 0;
    fallGravity = 9.81; // scaled per leap so the drop always takes ~3s
    coastFloor = 0; // altitude Dave sags back to between farts (0 = he lands)
    isWhiteoutFading = false;
    whiteoutTimer = 0;
    constructor(container) {
        this.container = container;
        // 1. Scene & Renderer
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x6ca0dc); // Daytime street blue
        this.scene.fog = new THREE.FogExp2(0x6ca0dc, 0.003);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.container.appendChild(this.renderer.domElement);
        // 2. Camera Controller
        this.cameraController = new CameraController();
        this.cameraController.resize(window.innerWidth, window.innerHeight);
        // 3. UI & Inputs
        this.hudController = new HudController(this.container);
        this.inputManager = new InputManager();
        const { base, handle } = this.hudController.getJoystickElements();
        this.inputManager.bindJoystickElements(base, handle);
        this.inputManager.bindReleaseButton(this.hudController.getReleaseButton());
        this.inputManager.setOnRelease(() => {
            this.executeFart();
        });
        this.hudController.setOnPlayAgain(() => {
            this.restartGame();
        });
        window.addEventListener('resize', () => this.onWindowResize());
    }
    async start() {
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
        this.isRunning = true;
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.render(t));
    }
    buildLighting() {
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(this.ambientLight);
        this.dirLight = new THREE.DirectionalLight(0xfff7e6, 1.4);
        this.dirLight.position.set(30, 60, 40);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 2048;
        this.dirLight.shadow.mapSize.height = 2048;
        this.dirLight.shadow.bias = -0.0005;
        this.dirLight.shadow.normalBias = 0.03;
        this.dirLight.shadow.camera.near = 0.5;
        this.dirLight.shadow.camera.far = 250;
        this.dirLight.shadow.camera.left = -30;
        this.dirLight.shadow.camera.right = 30;
        this.dirLight.shadow.camera.top = 30;
        this.dirLight.shadow.camera.bottom = -30;
        this.scene.add(this.dirLight);
    }
    executeFart() {
        const store = useGameStore.getState();
        if (store.isClimax)
            return;
        // Trigger next milestone in store
        store.triggerFart();
        const newStore = useGameStore.getState();
        const fartNumber = newStore.fartNumber;
        const milestone = getMilestone(fartNumber);
        // Audio synth
        fartAudio.playFart(fartNumber);
        // Dave VFX
        this.dave.triggerFartVFX(fartNumber);
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
            this.fallGravity = Math.max(9.81, (2 * (milestone.targetAltitude - this.coastFloor)) / 9);
            this.dave.isAirborne = true;
            useGameStore.getState().setAirborne(true);
        }
        // Planetary effects
        if (fartNumber === 22) {
            this.earth.triggerRipple();
        }
        if (fartNumber === 25) {
            // Climax Cataclysm
            this.triggerWorldBreakerClimax();
        }
    }
    triggerWorldBreakerClimax() {
        // Closing cinematic: Dave streaks past the moon, then away from Earth, which then explodes
        this.ending = { phase: 'moon', t: 0, daveT: 0, blasted: false };
        this.dave.velocity.set(0, 0, 0);
        this.dave.isAirborne = true;
    }
    /** Scripted ending shots. Dave and the camera are placed relative to the moon / Earth. */
    runEnding(dt) {
        const e = this.ending;
        e.t += dt;
        const dave = this.dave.group.position;
        const cam = this.tmpA;
        const look = this.tmpB;
        if (e.phase === 'moon') {
            // Shot 1: camera parked beside the moon while Dave rockets past it
            const m = this.atmosphere.moonGroup.position;
            cam.set(m.x + 55, m.y - 15, m.z + 115);
            dave.set(m.x - 12 + e.t * 2, m.y - 110 + e.t * 65, m.z + 55);
            look.copy(m).lerp(dave, 0.35);
            this.dave.bodyMeshGroup.scale.setScalar(2); // scale the body only, not the gas plume
            if (e.t >= 3.6) {
                e.phase = 'earth';
                e.t = 0;
            }
        }
        else {
            // Shot 2: Earth in focus, Dave dwindling into the distance. Shot 3: it blows up.
            const ep = this.earth.group.position;
            e.daveT += dt;
            const dist = 25 + 35 * e.daveT + 90 * e.daveT * e.daveT;
            this.dave.bodyMeshGroup.scale.setScalar(3);
            cam.set(ep.x + 260, ep.y + 330, ep.z + 2500);
            this.tmpC.set(-0.04, 0.2, -0.98).normalize(); // up and away, staying in frame above Earth
            dave.copy(cam).addScaledVector(this.tmpC, dist);
            dave.x -= 6;
            dave.y -= 4;
            if (e.phase === 'earth') {
                // Start on Dave as he whips away, then settle on the planet
                const k = THREE.MathUtils.smoothstep(e.t, 0.5, 2.2);
                look.copy(dave).lerp(ep, k);
                if (e.t >= 4.6) {
                    e.phase = 'blast';
                    e.t = 0;
                }
            }
            else {
                look.copy(ep);
                cam.z += 150 * e.t; // pull back to keep the debris in frame
                if (!e.blasted) {
                    e.blasted = true;
                    this.earth.shatterEarth();
                    this.cameraController.triggerShake(16);
                    useGameStore.getState().setWhiteoutOpacity(1.0);
                    this.isWhiteoutFading = true;
                    this.whiteoutTimer = 1.6;
                }
                if (e.t >= 4.2)
                    useGameStore.getState().setEndingReady(true);
            }
        }
        this.cameraController.setCinematic(cam, look);
    }
    restartGame() {
        useGameStore.getState().resetGame();
        this.targetDaveAltitude = 0;
        this.boostTimer = 0;
        this.fallSpeed = 0;
        this.coastFloor = 0;
        this.isWhiteoutFading = false;
        this.whiteoutTimer = 0;
        this.ending = null;
        this.cameraController.setCinematic(null);
        this.dave.bodyMeshGroup.scale.setScalar(1);
        this.dave.group.rotation.set(0, 0, 0);
        // Reset Dave position on street
        this.dave.isAirborne = false;
        this.dave.setShoeSolePosition(0, 0, 0);
        // Reset Earth
        this.earth.reset();
        // Reset pedestrians, dog and traffic
        this.city.reset();
    }
    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.renderer.setSize(width, height);
        this.cameraController.resize(width, height);
    }
    render(timestamp) {
        if (!this.isRunning)
            return;
        const dt = Math.min((timestamp - this.lastTime) * 0.001, 0.1);
        this.lastTime = timestamp;
        const store = useGameStore.getState();
        // 1. Involuntary 4.5-second tension countdown
        if (!store.isClimax) {
            const nextTension = store.tensionTimer - dt;
            if (nextTension <= 0) {
                this.executeFart();
            }
            else {
                store.setTensionTimer(nextTension);
                this.hudController.updateTensionRing(nextTension, store.maxTension);
            }
        }
        // 2. Handle whiteout flash fade out over 2.5 seconds
        if (this.isWhiteoutFading) {
            this.whiteoutTimer -= dt;
            const alpha = Math.max(0, this.whiteoutTimer / 2.5);
            useGameStore.getState().setWhiteoutOpacity(alpha);
            if (this.whiteoutTimer <= 0) {
                this.isWhiteoutFading = false;
            }
        }
        // 3. Step Rapier physics
        physicsWorld.step(dt);
        // 4. Update Dave (airborne vertical rocket climbing vs street walking)
        if (this.ending)
            this.runEnding(dt);
        if (this.dave.isAirborne && !this.ending) {
            const pos = this.dave.group.position;
            if (store.isClimax || this.boostTimer > 0) {
                // Rocket thrust: smoothly approach target altitude with strong acceleration
                this.boostTimer -= dt;
                pos.y = THREE.MathUtils.lerp(pos.y, this.targetDaveAltitude, Math.min(1, dt * 2.8));
                this.fallSpeed = 0;
            }
            else {
                // Thrust spent: gravity pulls him back toward the coast floor until the next fart
                this.fallSpeed += this.fallGravity * dt;
                pos.y = Math.max(this.coastFloor, pos.y - this.fallSpeed * dt);
                if (pos.y <= this.coastFloor)
                    this.fallSpeed = 0;
            }
            // Keep low flights over the street and sidewalks so he can't drop into a building
            if (pos.y < 70)
                pos.x = THREE.MathUtils.clamp(pos.x, -12.4, 12.4);
            if (this.coastFloor === 0 && this.boostTimer <= 0 && pos.y <= 0.02) {
                // Touchdown
                const groundY = Math.abs(pos.x) < 7 ? 0 : 0.3;
                this.dave.isAirborne = false;
                this.dave.setShoeSolePosition(pos.x, groundY, pos.z);
                useGameStore.getState().setAirborne(false);
                useGameStore.getState().setAltitude(0);
            }
            else {
                this.dave.altitude = pos.y;
                store.setAltitude(this.dave.altitude);
            }
        }
        this.dave.update(dt, this.ending ? this.zeroMove : this.inputManager.inputState.moveVector, physicsWorld);
        if (this.ending)
            this.dave.group.rotation.y = Math.PI; // flying away from the camera
        // 5. Update environment & sky color
        const currentAltitude = this.ending ? 30000 : this.dave.group.position.y; // the ending is staged in space
        const skyColor = this.atmosphere.getSkyColor(currentAltitude);
        this.scene.background = skyColor;
        if (this.scene.fog) {
            this.scene.fog.color = skyColor;
            // Fade fog out as we ascend into the clear stratosphere and space
            this.scene.fog.density = Math.max(0, 0.003 * (1 - Math.min(1, currentAltitude / 1200)));
        }
        this.city.update(dt, store.currentMilestone.decibels, store.fartNumber, this.dave.group.position);
        this.atmosphere.update(dt, currentAltitude, store.fartNumber);
        this.earth.update(dt, store.fartNumber);
        // 6. Update Camera
        this.cameraController.update(dt, this.dave.group.position, this.dave.isAirborne, store.isClimax);
        // 7. Render frame
        this.renderer.render(this.scene, this.cameraController.camera);
        requestAnimationFrame((t) => this.render(t));
    }
}
//# sourceMappingURL=GameLoop.js.map