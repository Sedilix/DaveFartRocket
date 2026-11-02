import * as THREE from 'three';
const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 8);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x181818, flatShading: true });
const blackMat = new THREE.MeshStandardMaterial({ color: 0x111111, flatShading: true });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x1b2836, flatShading: true, roughness: 0.3 });
const WHEEL_RADIUS = 0.38;
export const HEAD_NORMAL = 0xffffcc;
export const TAIL_NORMAL = 0x661111;
export const TAIL_BRAKE = 0xff2222;
export class TrafficCar {
    group = new THREE.Group();
    type;
    length;
    speed = 0; // forward speed along the car's own +z axis
    dir = 1; // world z direction of travel
    baseX = 0;
    baseY = 0;
    launched = false;
    wheels = [];
    headMats = [];
    tailMats = [];
    swayPhase = Math.random() * 10;
    time = 0;
    velocity = new THREE.Vector3();
    rotVelocity = new THREE.Vector3();
    constructor(type, color) {
        this.type = type;
        this.length = type === 'truck' ? 7.5 : 4.4;
        const bodyMat = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.5 });
        const L = this.length;
        const W = type === 'truck' ? 2.4 : 2.1;
        if (type === 'truck') {
            const chassis = new THREE.Mesh(new THREE.BoxGeometry(W, 0.5, L), blackMat);
            chassis.position.y = 0.6;
            this.group.add(chassis);
            const cab = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 1.6, 2.0), bodyMat);
            cab.position.set(0, 1.65, L / 2 - 1.1);
            cab.castShadow = true;
            this.group.add(cab);
            const windshield = new THREE.Mesh(new THREE.BoxGeometry(W - 0.3, 0.7, 0.1), glassMat);
            windshield.position.set(0, 1.95, L / 2 - 0.1);
            this.group.add(windshield);
            const cargoMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, flatShading: true });
            const cargo = new THREE.Mesh(new THREE.BoxGeometry(W, 2.4, L - 2.4), cargoMat);
            cargo.position.set(0, 2.05, -1.2);
            cargo.castShadow = true;
            this.group.add(cargo);
            // Roll-up rear door
            const door = new THREE.Mesh(new THREE.BoxGeometry(W - 0.4, 2.0, 0.06), new THREE.MeshStandardMaterial({ color: 0xb0b4b8, flatShading: true }));
            door.position.set(0, 2.0, -L / 2 + 1.2 - 0.02);
            this.group.add(door);
            for (let i = 0; i < 6; i++) {
                const rib = new THREE.Mesh(new THREE.BoxGeometry(W - 0.4, 0.04, 0.09), blackMat);
                rib.position.set(0, 1.2 + i * 0.32, -L / 2 + 1.2 - 0.03);
                this.group.add(rib);
            }
        }
        else {
            const lower = new THREE.Mesh(new THREE.BoxGeometry(W, 0.7, L), bodyMat);
            lower.position.y = 0.65;
            lower.castShadow = true;
            this.group.add(lower);
            const cabin = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 0.65, 2.5), glassMat);
            cabin.position.set(0, 1.25, -0.2);
            cabin.castShadow = true;
            this.group.add(cabin);
            // Black bumpers
            [L / 2, -L / 2].forEach((z) => {
                const bumper = new THREE.Mesh(new THREE.BoxGeometry(W + 0.05, 0.2, 0.15), blackMat);
                bumper.position.set(0, 0.4, z);
                this.group.add(bumper);
            });
            if (type === 'taxi') {
                const signMat = new THREE.MeshStandardMaterial({ color: 0xffffe0, flatShading: true, emissive: 0x554400 });
                const sign = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.22, 0.34), signMat);
                sign.position.set(0, 1.7, -0.2);
                this.group.add(sign);
                // Checkerboard strip along both sides of the sign and the body
                for (let i = 0; i < 5; i++) {
                    if (i % 2 === 0) {
                        [-1, 1].forEach((side) => {
                            const sq = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.1), blackMat);
                            sq.position.set(side * (W / 2 + 0.01), 0.82, -1.0 + i * 0.5);
                            this.group.add(sq);
                        });
                    }
                }
                const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.06, 0.38), blackMat);
                stripe.position.set(0, 1.62, -0.2);
                this.group.add(stripe);
            }
        }
        // Wheels spin on pivots about local x
        const wheelZs = type === 'truck' ? [L / 2 - 1.2, -L / 2 + 1.3] : [L / 2 - 1.1, -L / 2 + 1.1];
        wheelZs.forEach((wz) => {
            [-1, 1].forEach((side) => {
                const pivot = new THREE.Group();
                pivot.position.set(side * (W / 2 - 0.1), WHEEL_RADIUS, wz);
                const wheel = new THREE.Mesh(wheelGeo, wheelMat);
                wheel.rotation.z = Math.PI / 2;
                pivot.add(wheel);
                this.group.add(pivot);
                this.wheels.push(pivot);
            });
        });
        // Head & tail lights
        const hlGeo = new THREE.BoxGeometry(0.35, 0.2, 0.1);
        const lightY = type === 'truck' ? 1.0 : 0.7;
        [-1, 1].forEach((side) => {
            const hMat = new THREE.MeshBasicMaterial({ color: HEAD_NORMAL });
            const h = new THREE.Mesh(hlGeo, hMat);
            h.position.set(side * (W / 2 - 0.4), lightY, L / 2 + 0.02);
            this.group.add(h);
            this.headMats.push(hMat);
            const tMat = new THREE.MeshBasicMaterial({ color: TAIL_NORMAL });
            const t = new THREE.Mesh(hlGeo, tMat);
            t.position.set(side * (W / 2 - 0.4), lightY, -L / 2 - 0.02);
            this.group.add(t);
            this.tailMats.push(tMat);
        });
    }
    place(x, z, dir) {
        this.baseX = x;
        this.dir = dir;
        this.group.position.set(x, this.baseY, z);
        this.group.rotation.set(0, dir > 0 ? 0 : Math.PI, 0);
    }
    /** Move along the lane and spin wheels. */
    drive(dt) {
        this.time += dt;
        this.group.position.z += this.dir * this.speed * dt;
        const spin = (this.speed * dt) / WHEEL_RADIUS;
        this.wheels.forEach((w) => (w.rotation.x += spin));
        if (this.speed > 0.5)
            this.group.rotation.z = Math.sin(this.time * 1.7 + this.swayPhase) * 0.01;
    }
    setLights(head, tail) {
        this.headMats.forEach((m) => m.color.setHex(head));
        this.tailMats.forEach((m) => m.color.setHex(tail));
    }
    launch(awayX) {
        if (this.launched)
            return;
        this.launched = true;
        this.velocity.set(awayX * (3 + Math.random() * 5), 14 + Math.random() * 8, (Math.random() - 0.5) * 8);
        this.rotVelocity.set(Math.random() * 3 - 1.5, Math.random() * 3 - 1.5, Math.random() * 4 - 2);
    }
    stepTumble(dt) {
        const p = this.group.position;
        p.addScaledVector(this.velocity, dt);
        this.velocity.y -= 16 * dt;
        this.group.rotation.x += this.rotVelocity.x * dt;
        this.group.rotation.y += this.rotVelocity.y * dt;
        this.group.rotation.z += this.rotVelocity.z * dt;
        if (p.y < 0.6 && this.velocity.y < 0) {
            p.y = 0.6;
            this.velocity.y *= -0.3;
            this.velocity.x *= 0.7;
            this.velocity.z *= 0.7;
            this.rotVelocity.multiplyScalar(0.7);
        }
    }
    reset(x, z) {
        this.launched = false;
        this.velocity.set(0, 0, 0);
        this.rotVelocity.set(0, 0, 0);
        this.place(x, z, this.dir);
        this.setLights(HEAD_NORMAL, TAIL_NORMAL);
    }
}
//# sourceMappingURL=TrafficCar.js.map