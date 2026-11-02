import * as THREE from 'three';
export class CameraController {
    camera;
    currentLookAt = new THREE.Vector3();
    shakeOffset = new THREE.Vector3();
    currentShakeIntensity = 0;
    orbitAngle = 0;
    cinematicPos = null;
    cinematicLook = null;
    anchor = new THREE.Vector3();
    offset = new THREE.Vector3(0, 3.2, 7.2);
    lookOffset = new THREE.Vector3(0, 1.8, 0);
    offsetTarget = new THREE.Vector3();
    lookTarget = new THREE.Vector3();
    constructor() {
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 80000);
        // Initial camera position behind Dave on street
        this.camera.position.set(0, 3.2, 7.5);
        this.currentLookAt.set(0, 1.8, 0);
    }
    resize(width, height) {
        this.camera.aspect = width / height;
        // Mobile portrait (9:16) optimization: adjust FOV slightly wider for tall viewports
        if (width < height) {
            this.camera.fov = 68;
        }
        else {
            this.camera.fov = 55;
        }
        this.camera.updateProjectionMatrix();
    }
    /** Scripted shot: camera sits at `pos` looking at `look`. Pass null to return to the chase camera. */
    setCinematic(pos, look) {
        const wasActive = this.cinematicPos !== null;
        if (pos && look) {
            if (!this.cinematicPos)
                this.cinematicPos = new THREE.Vector3();
            if (!this.cinematicLook)
                this.cinematicLook = new THREE.Vector3();
            this.cinematicPos.copy(pos);
            this.cinematicLook.copy(look);
        }
        else {
            this.cinematicPos = null;
        }
        if (wasActive !== (this.cinematicPos !== null)) {
            this.camera.near = this.cinematicPos ? 2 : 0.1; // planet-scale shots need depth precision
            this.camera.updateProjectionMatrix();
        }
    }
    triggerShake(intensity) {
        this.currentShakeIntensity = Math.min(18, this.currentShakeIntensity + intensity);
    }
    update(dt, davePosition, isAirborne, isClimax) {
        // 1. Decay camera shake
        if (this.currentShakeIntensity > 0.001) {
            this.shakeOffset.set((Math.random() - 0.5) * this.currentShakeIntensity * 0.45, (Math.random() - 0.5) * this.currentShakeIntensity * 0.45, (Math.random() - 0.5) * this.currentShakeIntensity * 0.45);
            this.currentShakeIntensity = THREE.MathUtils.damp(this.currentShakeIntensity, 0, 7.0, dt);
        }
        else {
            this.shakeOffset.set(0, 0, 0);
        }
        if (this.cinematicPos && this.cinematicLook) {
            this.camera.position.copy(this.cinematicPos).add(this.shakeOffset);
            this.camera.lookAt(this.cinematicLook);
            return;
        }
        // 2. Anchor: smoothed on the street, rigidly attached to Dave while flying.
        // Dave's altitude changes by thousands of metres per second, so any world-space lag would
        // throw him out of frame and swing the view direction. Only the *offset* is eased.
        const far = this.anchor.distanceToSquared(davePosition) > 400;
        if (isAirborne || isClimax || far) {
            this.anchor.copy(davePosition);
        }
        else {
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
        }
        else if (isAirborne) {
            // Rocket ascent: stable three-quarter view from just below and beside Dave, level horizon,
            // so he stays centred and the sky streaming past gives the sense of speed.
            this.orbitAngle = 0;
            this.offsetTarget.set(2.6, 0.2, 9.5);
            this.lookTarget.set(0, 1.5, 0);
            rate = 2.5;
        }
        else {
            this.orbitAngle = 0;
            this.offsetTarget.set(0, 3.2, 7.2);
            this.lookTarget.set(0, 1.8, 0);
            rate = 6;
        }
        const kk = 1 - Math.exp(-rate * dt);
        this.offset.lerp(this.offsetTarget, kk);
        this.lookOffset.lerp(this.lookTarget, kk);
        // 4. Place the camera (no roll: up stays world-up)
        this.camera.position.copy(this.anchor).add(this.offset).add(this.shakeOffset);
        this.currentLookAt.copy(this.anchor).add(this.lookOffset);
        this.camera.lookAt(this.currentLookAt);
    }
}
//# sourceMappingURL=CameraController.js.map