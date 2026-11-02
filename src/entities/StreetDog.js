import * as THREE from 'three';
import { damp, dampAngle } from '../core/animMath';
const TROT_X = -8.5;
const PATROL_MIN = -30; // owner trails behind, so stay clear of the café tables at z >= 10
const PATROL_MAX = 6;
const START_Z = -10;
export class StreetDog {
    group = new THREE.Group();
    body;
    neck = new THREE.Group();
    snout = new THREE.Group();
    earL = new THREE.Mesh();
    earR = new THREE.Mesh();
    tailPivot = new THREE.Group();
    tailMid = new THREE.Group();
    tailTip = new THREE.Group();
    legs = [];
    state = 'trot';
    legPhase = 0;
    time = 0;
    dir = 1;
    stateTimer = 2 + Math.random() * 2;
    backedUp = 0;
    legBlend = 0;
    constructor() {
        const dogMat = new THREE.MeshStandardMaterial({ color: 0xba7c44, flatShading: true });
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2c, flatShading: true });
        const noseMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
        this.group.position.set(TROT_X, 0.3, START_Z);
        // Body & spine
        this.body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.85), dogMat);
        this.body.position.y = 0.7;
        this.body.castShadow = true;
        this.group.add(this.body);
        // Neck pivot -> head -> snout
        this.neck.position.set(0, 0.85, 0.4);
        this.group.add(this.neck);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.4), dogMat);
        head.position.set(0, 0.05, 0.2);
        head.castShadow = true;
        this.neck.add(head);
        this.snout.position.set(0, 0, 0.4);
        this.neck.add(this.snout);
        const snoutMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.25), darkMat);
        snoutMesh.position.set(0, 0, 0.12);
        this.snout.add(snoutMesh);
        const nose = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), noseMat);
        nose.position.set(0, 0.03, 0.26);
        this.snout.add(nose);
        // Independent ear cones
        const earGeo = new THREE.ConeGeometry(0.08, 0.2, 4);
        this.earL = new THREE.Mesh(earGeo, dogMat);
        this.earR = new THREE.Mesh(earGeo, dogMat);
        this.earL.position.set(-0.13, 0.3, 0.12);
        this.earR.position.set(0.13, 0.3, 0.12);
        this.neck.add(this.earL, this.earR);
        // 2-segment legs
        const upperGeo = new THREE.BoxGeometry(0.12, 0.26, 0.12);
        const lowerGeo = new THREE.BoxGeometry(0.1, 0.26, 0.1);
        // trot gait: diagonal pairs move together
        [
            [-0.16, 0.3, 0],
            [0.16, 0.3, Math.PI],
            [-0.16, -0.3, Math.PI],
            [0.16, -0.3, 0]
        ].forEach(([lx, lz, phaseOffset]) => {
            const hip = new THREE.Group();
            hip.position.set(lx, 0.52, lz);
            const upper = new THREE.Mesh(upperGeo, dogMat);
            upper.position.y = -0.13;
            hip.add(upper);
            const knee = new THREE.Group();
            knee.position.y = -0.26;
            const lower = new THREE.Mesh(lowerGeo, dogMat);
            lower.position.y = -0.13;
            knee.add(lower);
            hip.add(knee);
            this.group.add(hip);
            this.legs.push({ hip, knee, phaseOffset });
        });
        // 3-segment tail
        this.tailPivot.position.set(0, 0.88, -0.42);
        this.tailPivot.rotation.order = 'YXZ';
        this.group.add(this.tailPivot);
        const tailGeo = new THREE.BoxGeometry(0.07, 0.07, 0.18);
        const seg1 = new THREE.Mesh(tailGeo, dogMat);
        seg1.position.z = -0.09;
        this.tailPivot.add(seg1);
        this.tailMid.position.z = -0.18;
        this.tailPivot.add(this.tailMid);
        const seg2 = new THREE.Mesh(tailGeo, dogMat);
        seg2.position.z = -0.09;
        this.tailMid.add(seg2);
        this.tailTip.position.z = -0.18;
        this.tailMid.add(this.tailTip);
        const seg3 = new THREE.Mesh(tailGeo, darkMat);
        seg3.position.z = -0.09;
        this.tailTip.add(seg3);
    }
    get panicking() {
        return this.state === 'panic';
    }
    neckWorld(out) {
        return this.neck.getWorldPosition(out);
    }
    setState(next) {
        this.state = next;
        if (next === 'sniff')
            this.stateTimer = 1.2 + Math.random();
        if (next === 'trot')
            this.stateTimer = 2.5 + Math.random() * 3;
    }
    reset() {
        this.group.visible = true;
        this.group.position.set(TROT_X, 0.3, START_Z);
        this.group.rotation.set(0, 0, 0);
        this.dir = 1;
        this.backedUp = 0;
        this.setState('trot');
    }
    update(dt, fartNumber, daveZ) {
        if (!this.group.visible)
            return;
        this.time += dt;
        const p = this.group.position;
        // Fart milestones drive the state machine (one-way until reset)
        if (fartNumber >= 6)
            this.state = 'panic';
        else if (fartNumber >= 4 && this.state !== 'concerned')
            this.state = 'concerned';
        else if (fartNumber === 3 && this.state !== 'perk' && this.state !== 'concerned')
            this.state = 'perk';
        let moving = false;
        let speed = 0;
        let yawTarget = this.dir > 0 ? 0 : Math.PI;
        let headTilt = 0;
        let headYaw = 0;
        let snoutPitch = 0;
        let neckPitch = 0;
        let earPerk = false;
        let tailRotX = 0.5;
        let wag = 0.25;
        switch (this.state) {
            case 'trot': {
                moving = true;
                speed = 1.6;
                wag = 0.35;
                this.stateTimer -= dt;
                if (this.stateTimer <= 0)
                    this.setState('sniff');
                break;
            }
            case 'sniff': {
                neckPitch = 0.6 + Math.sin(this.time * 14) * 0.08;
                wag = 0.4;
                this.stateTimer -= dt;
                if (this.stateTimer <= 0)
                    this.setState('trot');
                break;
            }
            case 'perk': {
                // Freeze, face Dave, ears up, head tilted
                yawTarget = Math.atan2(-p.x, daveZ - p.z);
                earPerk = true;
                headTilt = 0.45;
                headYaw = -0.35;
                wag = 0;
                break;
            }
            case 'concerned': {
                yawTarget = Math.atan2(-p.x, daveZ - p.z);
                earPerk = true;
                headTilt = 0.3;
                // whimper-bark pulses, tail tucked, backing off 1.5 m
                snoutPitch = -0.3 * Math.max(0, Math.sin(this.time * 9));
                tailRotX = -1.1;
                wag = 0;
                if (this.backedUp < 1.5) {
                    const step = 1.2 * dt;
                    this.backedUp += step;
                    p.x += (p.x > 0 ? 1 : -1) * step; // away from the street
                    moving = true;
                    speed = 0;
                }
                break;
            }
            case 'panic': {
                yawTarget = Math.PI;
                moving = true;
                speed = 12;
                earPerk = true;
                tailRotX = -1.1;
                wag = 0;
                p.x = damp(p.x, TROT_X, 3, dt);
                p.z -= dt * 12;
                if (p.z < -78)
                    this.group.visible = false;
                break;
            }
        }
        // Trot patrol along the sidewalk
        if (this.state === 'trot') {
            p.z += this.dir * speed * dt;
            if (p.z > PATROL_MAX)
                this.dir = -1;
            else if (p.z < PATROL_MIN)
                this.dir = 1;
        }
        this.group.rotation.y = dampAngle(this.group.rotation.y, yawTarget, this.state === 'panic' ? 14 : 6, dt);
        // Gait: legs only cycle while actually travelling
        const gaitSpeed = this.state === 'panic' ? 2.2 : 1;
        const legMoving = (moving && speed > 0) || (this.state === 'concerned' && this.backedUp < 1.5);
        this.legBlend = damp(this.legBlend, legMoving ? 1 : 0, 12, dt);
        this.legPhase += dt * 11 * gaitSpeed * (legMoving ? 1 : 0);
        const amp = this.state === 'panic' ? 0.9 : 0.55;
        this.legs.forEach((leg) => {
            const ph = this.legPhase + leg.phaseOffset;
            leg.hip.rotation.x = Math.sin(ph) * amp * this.legBlend;
            leg.knee.rotation.x = Math.max(0, Math.cos(ph)) * 0.8 * this.legBlend;
        });
        // Breathing spine flexion
        this.body.scale.y = 1 + Math.sin(this.time * 3) * 0.02;
        this.body.position.y = 0.7 + Math.abs(Math.sin(this.legPhase)) * 0.04 * this.legBlend;
        // Head, snout, ears
        this.neck.rotation.z = damp(this.neck.rotation.z, headTilt, 10, dt);
        this.neck.rotation.y = damp(this.neck.rotation.y, headYaw, 10, dt);
        this.neck.rotation.x = damp(this.neck.rotation.x, neckPitch, 10, dt);
        this.snout.rotation.x = damp(this.snout.rotation.x, snoutPitch, 25, dt);
        const earScale = earPerk ? 1.4 : 1;
        const earTilt = earPerk ? 0 : 0.5;
        this.earL.scale.y = damp(this.earL.scale.y, earScale, 20, dt);
        this.earR.scale.y = damp(this.earR.scale.y, earScale, 20, dt);
        this.earL.rotation.z = damp(this.earL.rotation.z, earTilt, 15, dt);
        this.earR.rotation.z = damp(this.earR.rotation.z, -earTilt, 15, dt);
        // Tail
        this.tailPivot.rotation.x = damp(this.tailPivot.rotation.x, tailRotX, 8, dt);
        this.tailPivot.rotation.y = wag > 0 ? Math.sin(this.time * 12) * wag * 1.3 : damp(this.tailPivot.rotation.y, 0, 8, dt);
        this.tailMid.rotation.y = wag > 0 ? Math.sin(this.time * 12 - 0.6) * wag * 0.8 : 0;
        this.tailTip.rotation.y = wag > 0 ? Math.sin(this.time * 12 - 1.2) * wag * 0.8 : 0;
    }
}
//# sourceMappingURL=StreetDog.js.map