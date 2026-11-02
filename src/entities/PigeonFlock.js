import * as THREE from 'three';
const CAFE_TABLES_Z = [10, 16, 22];
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8a8f99, flatShading: true });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x5f646e, flatShading: true });
const chestMat = new THREE.MeshStandardMaterial({ color: 0x4f8a7a, flatShading: true });
const beakMat = new THREE.MeshBasicMaterial({ color: 0xe0a040 });
const legMat = new THREE.MeshBasicMaterial({ color: 0xd07a7a });
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff8c1a });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const bodyGeo = box(0.22, 0.17, 0.34);
const chestGeo = box(0.19, 0.1, 0.1);
const headGeo = box(0.11, 0.11, 0.12);
const beakGeo = box(0.03, 0.03, 0.06);
const eyeGeo = box(0.02, 0.02, 0.02);
const tailGeo = box(0.1, 0.03, 0.14);
const legGeo = box(0.02, 0.1, 0.02);
const wingGeo = box(0.3, 0.02, 0.17);
class Pigeon {
    group = new THREE.Group();
    state = 'peck';
    fleeAt;
    home = new THREE.Vector3();
    body = new THREE.Group();
    head = new THREE.Group();
    wingL = new THREE.Group();
    wingR = new THREE.Group();
    legs = [];
    timer = Math.random() * 2;
    phase = Math.random() * 10;
    heading = Math.random() * Math.PI * 2;
    velocity = new THREE.Vector3();
    fleeDelay = Math.random() * 0.6;
    constructor(x, z) {
        this.fleeAt = 3 + Math.floor(Math.random() * 3); // fart #3..#5
        this.home.set(x, 0.3, z);
        this.group.position.copy(this.home);
        this.group.rotation.y = this.heading;
        this.body.position.y = 0.19;
        this.group.add(this.body);
        const torso = new THREE.Mesh(bodyGeo, bodyMat);
        torso.castShadow = true;
        this.body.add(torso);
        const chest = new THREE.Mesh(chestGeo, chestMat);
        chest.position.set(0, 0.02, 0.15);
        this.body.add(chest);
        const tail = new THREE.Mesh(tailGeo, darkMat);
        tail.position.set(0, 0.02, -0.22);
        tail.rotation.x = 0.2;
        this.body.add(tail);
        this.head.position.set(0, 0.1, 0.17);
        this.body.add(this.head);
        const headMesh = new THREE.Mesh(headGeo, darkMat);
        headMesh.position.set(0, 0.04, 0.03);
        this.head.add(headMesh);
        const beak = new THREE.Mesh(beakGeo, beakMat);
        beak.position.set(0, 0.03, 0.1);
        this.head.add(beak);
        [-1, 1].forEach((s) => {
            const eye = new THREE.Mesh(eyeGeo, eyeMat);
            eye.position.set(s * 0.056, 0.07, 0.05);
            this.head.add(eye);
        });
        [[this.wingL, -1], [this.wingR, 1]].forEach(([pivot, s]) => {
            pivot.position.set(s * 0.11, 0.05, 0);
            const wing = new THREE.Mesh(wingGeo, bodyMat);
            wing.position.x = s * 0.15;
            pivot.add(wing);
            this.body.add(pivot);
        });
        [-0.05, 0.05].forEach((lx) => {
            const leg = new THREE.Mesh(legGeo, legMat);
            leg.position.set(lx, 0.1, 0.02);
            this.group.add(leg);
            this.legs.push(leg);
        });
        this.fold(1);
    }
    /** k = 1 folded against the body, 0 = fully spread. */
    fold(k) {
        const spread = 1 - k;
        this.wingL.scale.x = this.wingR.scale.x = 0.3 + 0.7 * spread;
        this.wingL.rotation.z = this.wingR.rotation.z = 0;
    }
    reset() {
        this.state = 'peck';
        this.group.visible = true;
        this.group.position.copy(this.home);
        this.group.rotation.set(0, this.heading, 0);
        this.body.rotation.set(0, 0, 0);
        this.body.position.y = 0.19;
        this.legs.forEach((l) => (l.visible = true));
        this.velocity.set(0, 0, 0);
        this.fleeDelay = Math.random() * 0.6;
        this.fold(1);
    }
    update(dt, fartNumber) {
        if (this.state === 'gone')
            return;
        this.phase += dt;
        const p = this.group.position;
        if (this.state !== 'fly' && fartNumber >= this.fleeAt) {
            this.fleeDelay -= dt;
            if (this.fleeDelay <= 0)
                this.takeOff();
        }
        if (this.state === 'fly') {
            p.addScaledVector(this.velocity, dt);
            this.velocity.y += 2.5 * dt; // keeps climbing
            const flap = Math.sin(this.phase * 32) * 0.9;
            this.wingL.rotation.z = flap;
            this.wingR.rotation.z = -flap;
            this.body.position.y = 0.19 + Math.sin(this.phase * 16) * 0.03;
            if (p.y > 40 || Math.abs(p.z) > 120) {
                this.state = 'gone';
                this.group.visible = false;
            }
            return;
        }
        // Ground behaviour: peck with head bobs, occasionally strut a few steps
        this.timer -= dt;
        if (this.timer <= 0) {
            if (this.state === 'peck') {
                this.state = 'walk';
                this.timer = 0.6 + Math.random() * 0.8;
                this.heading += (Math.random() - 0.5) * 2.2;
            }
            else {
                this.state = 'peck';
                this.timer = 1 + Math.random() * 2.5;
            }
        }
        if (this.state === 'walk') {
            const step = 0.35 * dt;
            const nx = p.x + Math.sin(this.heading) * step;
            const nz = p.z + Math.cos(this.heading) * step;
            // stay near home so birds never wander into the road or the café tables
            if (Math.hypot(nx - this.home.x, nz - this.home.z) < 1.5) {
                p.x = nx;
                p.z = nz;
            }
            else {
                this.heading += Math.PI * 0.7;
            }
            this.group.rotation.y = this.heading;
            this.head.position.z = 0.17 + Math.sin(this.phase * 14) * 0.03;
            this.head.rotation.x = 0;
            this.legs[0].rotation.x = Math.sin(this.phase * 14) * 0.6;
            this.legs[1].rotation.x = -Math.sin(this.phase * 14) * 0.6;
        }
        else {
            this.legs.forEach((l) => (l.rotation.x = 0));
            this.head.position.z = 0.17;
            // peck: quick pitch down bursts
            const bob = Math.max(0, Math.sin(this.phase * 9 + this.home.z));
            this.head.rotation.x = bob * bob * 0.9;
        }
    }
    takeOff() {
        this.state = 'fly';
        this.legs.forEach((l) => (l.visible = false));
        this.head.rotation.x = -0.2;
        const away = this.group.position.x >= 0 ? 1 : -1;
        this.velocity.set(away * (2 + Math.random() * 3), 5 + Math.random() * 3, (Math.random() - 0.5) * 8);
        this.group.rotation.y = Math.atan2(this.velocity.x, this.velocity.z);
        this.body.rotation.x = -0.35;
        this.fold(0);
    }
}
export class PigeonFlock {
    group = new THREE.Group();
    birds = [];
    constructor(count = 16) {
        this.group.name = 'Pigeons';
        let tries = 0;
        while (this.birds.length < count && tries++ < 400) {
            const side = this.birds.length % 2 === 0 ? -1 : 1;
            const x = side * (8.3 + Math.random() * 4.2);
            const z = -50 + Math.random() * 90;
            // keep clear of café tables and the dog-walk path on the left sidewalk
            if (CAFE_TABLES_Z.some((tz) => Math.hypot(x + 9.8, z - tz) < 2.2))
                continue;
            if (side < 0 && z > -34 && z < 10 && x > -10.4)
                continue;
            const bird = new Pigeon(x, z);
            this.group.add(bird.group);
            this.birds.push(bird);
        }
    }
    update(dt, fartNumber) {
        this.birds.forEach((b) => b.update(dt, fartNumber));
    }
    reset() {
        this.birds.forEach((b) => b.reset());
    }
}
//# sourceMappingURL=PigeonFlock.js.map