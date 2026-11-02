import * as THREE from 'three';

/** Street trees stand on this |x| (both sides). */
const TREE_LINE_X = 7.8;

export class CameraController {
  public camera: THREE.PerspectiveCamera;
  private currentLookAt = new THREE.Vector3();
  private shakeOffset = new THREE.Vector3();
  private currentShakeIntensity = 0;
  private orbitAngle = 0;
  private cinematicPos: THREE.Vector3 | null = null;
  private cinematicLook: THREE.Vector3 | null = null;
  private anchor = new THREE.Vector3();
  private offset = new THREE.Vector3(0, 3.2, 7.2);
  private lookOffset = new THREE.Vector3(0, 1.8, 0);
  private static readonly STREET_OFFSET = new THREE.Vector3(0, 3.2, 7.2);
  private static readonly STREET_LOOK = new THREE.Vector3(0, 1.8, 0);
  private offsetTarget = new THREE.Vector3();
  private lookTarget = new THREE.Vector3();
  private shakeLook = new THREE.Vector3();
  private baseFov = 60;
  private fovKick = 0; // degrees added on each fart, decays quickly
  private appliedFov = 60;
  private appliedNear = 0.1;
  private appliedFar = 1500;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1500);
    // Initial camera position behind Dave on street
    this.camera.position.set(0, 3.2, 7.5);
    this.currentLookAt.set(0, 1.8, 0);
  }

  public resize(width: number, height: number) {
    this.camera.aspect = width / height;
    // Mobile portrait (9:16) optimization: adjust FOV slightly wider for tall viewports
    this.baseFov = width < height ? 68 : 55;
    this.camera.fov = this.baseFov + this.fovKick;
    this.appliedFov = this.camera.fov;
    this.camera.updateProjectionMatrix();
  }

  /** Scripted shot: camera sits at `pos` looking at `look`. Pass null to return to the chase camera. */
  public setCinematic(pos: THREE.Vector3 | null, look?: THREE.Vector3) {
    const wasActive = this.cinematicPos !== null;
    if (pos && look) {
      if (!this.cinematicPos) this.cinematicPos = new THREE.Vector3();
      if (!this.cinematicLook) this.cinematicLook = new THREE.Vector3();
      this.cinematicPos.copy(pos);
      this.cinematicLook.copy(look);
    } else {
      this.cinematicPos = null;
    }
    if (wasActive !== (this.cinematicPos !== null)) {
      // Planet-scale shots need depth precision; the chase camera drops back to near 0.1 until update() decides
      this.setDepthRange(this.cinematicPos ? 2 : 0.1, this.cinematicPos ? 80000 : 1500);
    }
  }

  /** Near/far only touch the projection matrix when they actually change. */
  private setDepthRange(near: number, far: number) {
    if (near === this.appliedNear && far === this.appliedFar) return;
    this.appliedNear = near;
    this.appliedFar = far;
    this.camera.near = near;
    this.camera.far = far;
    this.camera.updateProjectionMatrix();
  }

  /** Snap straight back to the street chase pose (Play Again): no shake, no orbit, no fly-through. */
  public reset(davePosition: THREE.Vector3) {
    this.currentShakeIntensity = 0;
    this.shakeOffset.set(0, 0, 0);
    this.orbitAngle = 0;
    this.fovKick = 0;
    this.setCinematic(null);
    this.anchor.copy(davePosition);
    this.offset.copy(CameraController.STREET_OFFSET);
    this.lookOffset.copy(CameraController.STREET_LOOK);
    this.camera.position.copy(this.anchor).add(this.offset);
    this.currentLookAt.copy(this.anchor).add(this.lookOffset);
    this.camera.lookAt(this.currentLookAt);
  }

  public triggerShake(intensity: number) {
    this.currentShakeIntensity = Math.min(18, this.currentShakeIntensity + intensity);
    this.fovKick = Math.min(5, this.fovKick + intensity * 0.4); // a light zoom punch on each fart
  }

  /**
   * @param lookDown 0..1: how far the ascent camera tilts down to frame the planet below Dave
   *                 (the camera rises a little and aims below him, keeping him in the upper frame).
   */
  public update(dt: number, davePosition: THREE.Vector3, isAirborne: boolean, isClimax: boolean, lookDown = 0) {
    // 1. Decay camera shake
    if (this.currentShakeIntensity > 0.001) {
      this.shakeOffset.set(
        (Math.random() - 0.5) * this.currentShakeIntensity * 0.45,
        (Math.random() - 0.5) * this.currentShakeIntensity * 0.45,
        (Math.random() - 0.5) * this.currentShakeIntensity * 0.45
      );
      this.currentShakeIntensity = THREE.MathUtils.damp(this.currentShakeIntensity, 0, 7.0, dt);
    } else {
      this.shakeOffset.set(0, 0, 0);
    }

    // FOV kick: eases back to the base field of view
    this.fovKick = THREE.MathUtils.damp(this.fovKick, 0, 6, dt);
    if (this.fovKick < 0.01) this.fovKick = 0;
    const fov = this.baseFov + this.fovKick;
    if (Math.abs(fov - this.appliedFov) > 0.005) {
      this.appliedFov = fov;
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }

    if (this.cinematicPos && this.cinematicLook) {
      // The target can be thousands of metres away, where a translation shake is under a pixel.
      // Shake the aim instead, scaled by distance so it reads as a few degrees of rotation.
      const dist = this.cinematicPos.distanceTo(this.cinematicLook);
      this.camera.position.copy(this.cinematicPos);
      this.shakeLook.copy(this.cinematicLook).addScaledVector(this.shakeOffset, dist * 0.004);
      this.camera.lookAt(this.shakeLook);
      return;
    }

    // Nothing is closer than Dave (about 10 m) once he is up in the air, and the stars sit at 20 to 30 km:
    // a tighter depth range keeps a 16-bit depth buffer usable against the planet and cloud shell.
    // Below 1200 m nothing visible lies beyond about 1.5 km (the stars only fade in from 1500 m): far 1500 gives the street ~25x the precision
    this.setDepthRange(isAirborne && davePosition.y > 15 ? 0.5 : 0.1, davePosition.y < 1200 ? 1500 : 40000);

    // 2. Anchor: smoothed on the street, rigidly attached to Dave while flying.
    // Dave's altitude changes by thousands of metres per second, so any world-space lag would
    // throw him out of frame and swing the view direction. Only the *offset* is eased.
    const far = this.anchor.distanceToSquared(davePosition) > 400;
    if (isAirborne || isClimax || far) {
      this.anchor.copy(davePosition);
    } else {
      const k = 1 - Math.exp(-6.5 * dt);
      this.anchor.lerp(davePosition, k);
    }

    // 3. Target camera offset / look-at offset relative to the anchor
    let rate = 6;
    if (isClimax) {
      // Dave floats peacefully in deep space; slow cinematic orbit around him
      this.orbitAngle += dt * 0.35;
      const radius = 9.5;
      this.offsetTarget.set(Math.sin(this.orbitAngle) * radius, 1.2, Math.cos(this.orbitAngle) * radius);
      this.lookTarget.set(0, 1.4, 0);
      rate = 3;
    } else if (isAirborne) {
      // Rocket ascent: stable three-quarter view from just below and beside Dave, level horizon,
      // so he stays centred. From the late ascent the camera tilts down to show the planet below,
      // but only as far as keeps Dave in the middle of the frame (his head about a quarter of the way
      // down, clear of the HUD card at the top), whatever the aspect ratio / field of view.
      this.orbitAngle = 0;
      // Below ~15 m (the #9-#11 hops back to the street) the camera stays above the car roofs instead of at road level
      const lowFlight = 1 - THREE.MathUtils.smoothstep(davePosition.y, 5, 25);
      const offY = Math.max(THREE.MathUtils.lerp(0.2, 3.0, lookDown), THREE.MathUtils.lerp(0.2, 1.5, lowFlight));
      const horizontal = Math.hypot(1.7, 6.4);
      const headY = 1.8; // raised hands are the highest point in the ascent pose
      const tanHalf = Math.tan(THREE.MathUtils.degToRad(this.baseFov / 2));
      const pitch = Math.atan2(offY - headY, horizontal) + Math.atan(0.5 * tanHalf); // radians below horizontal
      this.offsetTarget.set(1.7, offY, 6.4);
      this.lookTarget.set(0, THREE.MathUtils.lerp(0.95, offY - horizontal * Math.tan(pitch), lookDown), 0);
      rate = 2.5;
    } else {
      this.orbitAngle = 0;
      // Tree canopies span about y 2.7 to 6 along the kerb trunk line (|x| 7.8): drop the camera under them there
      const nearTrunks = 1 - THREE.MathUtils.smoothstep(Math.abs(Math.abs(this.anchor.x) - TREE_LINE_X), 1.4, 2.6);
      this.offsetTarget.set(0, THREE.MathUtils.lerp(1.95, 1.3, nearTrunks), 4.6);
      this.lookTarget.set(0, 1.1, 0);
      rate = 6;
    }
    const kk = 1 - Math.exp(-rate * dt);
    this.offset.lerp(this.offsetTarget, kk);
    this.lookOffset.lerp(this.lookTarget, kk);

    // 4. Place the camera (no roll: up stays world-up)
    this.camera.position.copy(this.anchor).add(this.offset).add(this.shakeOffset);
    // Keep the camera inside the street canyon (sidewalk edge x 12.6, end-cap buildings from z 81) while Dave
    // flies low; the limits open up once he is above the rooftops
    const open = THREE.MathUtils.smoothstep(davePosition.y, 70, 90);
    if (open < 1) {
      const cam = this.camera.position;
      const limX = THREE.MathUtils.lerp(12.6, 400, open);
      cam.x = THREE.MathUtils.clamp(cam.x, -limX, limX);
      cam.z = Math.min(cam.z, THREE.MathUtils.lerp(79.5, 400, open));
    }
    this.currentLookAt.copy(this.anchor).add(this.lookOffset);
    this.camera.lookAt(this.currentLookAt);
  }
}
