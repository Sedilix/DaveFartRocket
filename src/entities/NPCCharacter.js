import * as THREE from 'three';
import { damp } from '../core/animMath';
/** Reaction tier from the current fart decibel level (0 = calm ... 4 = blown away). */
export function reactionTier(db) {
    if (db < 66)
        return 0;
    if (db < 78)
        return 1;
    if (db < 90)
        return 2;
    if (db <= 102)
        return 3;
    return 4;
}
const TIER_EXPRESSION = ['neutral', 'suspicious', 'disgust', 'horror', 'scream'];
const SKIN_TONES = [0xe5b894, 0xc68642, 0x8d5524, 0xf1c27d];
const SHIRT_COLORS = [0x3d7068, 0xb5483a, 0x4a5f9e, 0xd0a23c, 0x7a4f8c, 0x5a8a4a];
const PANTS_COLORS = [0x222233, 0x3a3a48, 0x4d4030, 0x2a3d55];
const HAIR_COLORS = [0x1c1410, 0x4a2f1a, 0x8a6a3a, 0xb8b0a0, 0x7a2a1a];
const blackMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const mouthVoidMat = new THREE.MeshBasicMaterial({ color: 0x1a0505 });
const boxGeo = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const browGeo = boxGeo(0.14, 0.04, 0.03);
const eyeGeo = boxGeo(0.07, 0.07, 0.03);
const scleraGeo = boxGeo(0.13, 0.13, 0.02);
export class NPCCharacter {
    group = new THREE.Group();
    isBlownAway = false;
    tier = 0;
    expression = 'neutral';
    rig = new THREE.Group(); // pivots around body centre so ragdoll tumbles naturally
    body = new THREE.Group();
    headPivot = new THREE.Group();
    leftLeg = new THREE.Group();
    rightLeg = new THREE.Group();
    leftArm = new THREE.Group();
    rightArm = new THREE.Group();
    phone = null;
    brows = [];
    eyes = [];
    sclerae = [];
    mouthNeutral = new THREE.Group();
    mouthDisgust = new THREE.Group();
    mouthGasp = new THREE.Group();
    mouthScream = new THREE.Group();
    walkPhase = Math.random() * Math.PI * 2;
    swing = 0;
    time = Math.random() * 10;
    holdsPhone;
    // Awareness: gaze target, delayed reactions, startle
    gaze = null;
    ambientYaw = 0;
    ambientPitch = 0;
    glanceTimer = Math.random() * 2;
    pendingTier = -1;
    pendingTimer = 0;
    flinch = 0;
    // Ragdoll
    velocity = new THREE.Vector3();
    rotVelocity = new THREE.Vector3();
    constructor(opts = {}) {
        this.holdsPhone = !!opts.holdsPhone;
        const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
        const flat = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true });
        const skinMat = flat(pick(SKIN_TONES));
        const shirtMat = flat(pick(SHIRT_COLORS));
        const pantsMat = flat(pick(PANTS_COLORS));
        const hairMat = flat(pick(HAIR_COLORS));
        this.rig.position.y = 0.95;
        this.body.position.y = -0.95;
        this.rig.add(this.body);
        this.group.add(this.rig);
        // Torso
        const torso = new THREE.Mesh(boxGeo(0.62, 0.82, 0.36), shirtMat);
        torso.position.y = 1.16;
        torso.castShadow = true;
        this.body.add(torso);
        // Legs: pivot at hip (y = 0.78), feet at y = 0
        [[this.leftLeg, -0.15], [this.rightLeg, 0.15]].forEach(([pivot, x]) => {
            pivot.position.set(x, 0.78, 0);
            const leg = new THREE.Mesh(boxGeo(0.22, 0.78, 0.24), pantsMat);
            leg.position.y = -0.39;
            leg.castShadow = true;
            pivot.add(leg);
            this.body.add(pivot);
        });
        // Arms: pivot at shoulder (y = 1.45)
        [[this.leftArm, -0.42], [this.rightArm, 0.42]].forEach(([pivot, x]) => {
            pivot.position.set(x, 1.45, 0);
            const arm = new THREE.Mesh(boxGeo(0.15, 0.55, 0.15), shirtMat);
            arm.position.y = -0.27;
            pivot.add(arm);
            const hand = new THREE.Mesh(boxGeo(0.14, 0.14, 0.14), skinMat);
            hand.position.y = -0.58;
            pivot.add(hand);
            this.body.add(pivot);
        });
        if (this.holdsPhone) {
            this.phone = new THREE.Mesh(boxGeo(0.08, 0.16, 0.02), blackMat);
            this.phone.position.set(0, -0.58, 0.1);
            this.rightArm.add(this.phone);
        }
        // Head
        this.headPivot.position.y = 1.55;
        this.body.add(this.headPivot);
        const head = new THREE.Mesh(boxGeo(0.52, 0.55, 0.5), skinMat);
        head.position.y = 0.275;
        head.castShadow = true;
        this.headPivot.add(head);
        const hair = new THREE.Mesh(boxGeo(0.56, 0.14, 0.54), hairMat);
        hair.position.y = 0.56;
        this.headPivot.add(hair);
        this.buildFace();
        this.setExpression('neutral');
    }
    buildFace() {
        const faceZ = 0.26;
        [-1, 1].forEach((side) => {
            const brow = new THREE.Mesh(browGeo, blackMat);
            brow.position.set(side * 0.12, 0.43, faceZ);
            this.headPivot.add(brow);
            this.brows.push(brow);
            const sclera = new THREE.Mesh(scleraGeo, whiteMat);
            sclera.position.set(side * 0.12, 0.33, faceZ - 0.005);
            sclera.visible = false;
            this.headPivot.add(sclera);
            this.sclerae.push(sclera);
            const eye = new THREE.Mesh(eyeGeo, blackMat);
            eye.position.set(side * 0.12, 0.33, faceZ + 0.01);
            this.headPivot.add(eye);
            this.eyes.push(eye);
        });
        const add = (group, geo, mat, x, y, rotZ = 0) => {
            const m = new THREE.Mesh(geo, mat);
            m.position.set(x, y, 0);
            m.rotation.z = rotZ;
            group.add(m);
        };
        // Calm smile: flat line with raised corners
        add(this.mouthNeutral, boxGeo(0.18, 0.03, 0.03), blackMat, 0, 0.13);
        add(this.mouthNeutral, boxGeo(0.04, 0.04, 0.03), blackMat, -0.11, 0.155);
        add(this.mouthNeutral, boxGeo(0.04, 0.04, 0.03), blackMat, 0.11, 0.155);
        // Wavy grimace, corners turned down
        [-0.1, -0.033, 0.033, 0.1].forEach((x, i) => {
            add(this.mouthDisgust, boxGeo(0.07, 0.03, 0.03), blackMat, x, 0.12 + (i % 2 === 0 ? -0.02 : 0.02), i % 2 === 0 ? 0.35 : -0.35);
        });
        // Small round 'O'
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 8), mouthVoidMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, 0.14, 0);
        this.mouthGasp.add(ring);
        // Gaping horror void
        add(this.mouthScream, boxGeo(0.26, 0.28, 0.03), mouthVoidMat, 0, 0.13);
        [this.mouthNeutral, this.mouthDisgust, this.mouthGasp, this.mouthScream].forEach((g) => {
            g.position.z = faceZ + 0.01;
            this.headPivot.add(g);
        });
    }
    setExpression(state) {
        this.expression = state;
        const [bl, br] = this.brows;
        const baseY = 0.43;
        let slant = 0;
        let browLift = 0;
        let eyeScaleX = 1;
        let eyeScaleY = 1;
        let wide = false;
        switch (state) {
            case 'neutral':
                break;
            case 'suspicious': // furrowed brows, squinting eyes
                slant = 0.28;
                eyeScaleY = 0.5;
                break;
            case 'disgust': // slit eyes
                slant = 0.28;
                eyeScaleY = 0.3;
                break;
            case 'horror': // brows into the hairline, staring
                slant = -0.15;
                browLift = 0.08;
                eyeScaleX = eyeScaleY = 1.6;
                wide = true;
                break;
            case 'scream':
                slant = -0.15;
                browLift = 0.1;
                eyeScaleX = eyeScaleY = 1.9;
                wide = true;
                break;
        }
        // Left brow sits at -x: negative z-rotation lowers its inner end (furrow)
        bl.rotation.z = -slant;
        br.rotation.z = slant;
        bl.position.y = br.position.y = baseY + browLift;
        this.eyes.forEach((e) => e.scale.set(eyeScaleX, eyeScaleY, 1));
        this.sclerae.forEach((s) => {
            s.visible = wide;
            s.scale.setScalar(state === 'scream' ? 1.25 : 1);
        });
        this.mouthNeutral.visible = state === 'neutral';
        this.mouthDisgust.visible = state === 'suspicious' || state === 'disgust';
        this.mouthGasp.visible = state === 'horror';
        this.mouthScream.visible = state === 'scream';
    }
    setReaction(tier) {
        if (tier === this.tier && this.expression === TIER_EXPRESSION[tier])
            return;
        this.tier = tier;
        this.setExpression(TIER_EXPRESSION[tier]);
        if (this.phone)
            this.phone.visible = tier === 0;
    }
    /** Look at a world-space point (head height), or null to look around naturally. The vector is read every frame. */
    lookAt(target) {
        this.gaze = target;
    }
    /** Notice a louder fart after `delay` seconds (distance + personal reaction time). Calming down is instant. */
    queueReaction(tier, delay) {
        if (tier <= this.tier) {
            this.pendingTier = -1;
            this.setReaction(tier);
        }
        else {
            this.pendingTier = tier;
            this.pendingTimer = delay;
        }
    }
    update(dt, walking, speedMul = 1) {
        if (this.isBlownAway) {
            this.stepRagdoll(dt);
            return;
        }
        this.time += dt;
        if (this.pendingTier >= 0) {
            this.pendingTimer -= dt;
            if (this.pendingTimer <= 0) {
                this.setReaction(this.pendingTier);
                this.pendingTier = -1;
                this.flinch = 1; // startle jolt
            }
        }
        this.flinch = damp(this.flinch, 0, 7, dt);
        const k = 1 - Math.exp(-10 * dt);
        // Gait
        if (walking)
            this.walkPhase += dt * 7 * speedMul;
        this.swing = damp(this.swing, walking ? 0.7 : 0, 10, dt);
        const s = Math.sin(this.walkPhase);
        this.leftLeg.rotation.x = s * this.swing;
        this.rightLeg.rotation.x = -s * this.swing;
        // Hip bounce keeps the lowest foot planted on the ground
        this.rig.position.y = 0.95 + Math.abs(s) * 0.08 * (this.swing / 0.7);
        // Arms: swing while walking, otherwise pose for the current reaction tier
        let lx = s * 0.5 * (this.swing / 0.7);
        let rx = -lx;
        let lz = -0.08;
        let rz = 0.08;
        if (this.tier === 0 && this.holdsPhone && !walking) {
            rx = -1.15;
        }
        else if (this.tier === 2) {
            rx = -2.4; // pinch nose
            rz = 0;
        }
        else if (this.tier === 3) {
            lx = rx = 0; // hands clamped over ears
            lz = 2.9;
            rz = -2.9;
        }
        this.leftArm.rotation.x += (lx - this.leftArm.rotation.x) * k;
        this.rightArm.rotation.x += (rx - this.rightArm.rotation.x) * k;
        this.leftArm.rotation.z += (lz - this.leftArm.rotation.z) * k;
        this.rightArm.rotation.z += (rz - this.rightArm.rotation.z) * k;
        // Head: track the gaze target (clamped to a natural neck range); with nothing to look at,
        // glance around occasionally instead of oscillating.
        let yawT = 0;
        let pitchT = 0;
        if (this.gaze) {
            const p = this.group.position;
            const dx = this.gaze.x - p.x;
            const dz = this.gaze.z - p.z;
            const dy = this.gaze.y - (p.y + 1.85);
            let yaw = Math.atan2(dx, dz) - this.group.rotation.y;
            yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
            yawT = THREE.MathUtils.clamp(yaw, -1.2, 1.2);
            pitchT = THREE.MathUtils.clamp(Math.atan2(-dy, Math.hypot(dx, dz)), -0.45, 0.55);
        }
        else {
            this.glanceTimer -= dt;
            if (this.glanceTimer <= 0) {
                this.glanceTimer = 0.8 + Math.random() * 2.5;
                this.ambientYaw = (Math.random() - 0.5) * 0.9;
                this.ambientPitch = (Math.random() - 0.5) * 0.2;
            }
            yawT = this.ambientYaw;
            pitchT = this.ambientPitch;
            if (this.tier === 0 && this.holdsPhone && !walking) {
                yawT = 0;
                pitchT = 0.5; // reading the phone
            }
        }
        if (this.tier === 1)
            pitchT += -0.1 + Math.sin(this.time * 7) * 0.04; // nose twitch while sniffing
        if (this.tier === 3) {
            pitchT += 0.25; // duck
            yawT *= 0.5;
        }
        pitchT -= this.flinch * 0.3;
        const headRate = this.gaze ? 9 : 5;
        this.headPivot.rotation.y = damp(this.headPivot.rotation.y, yawT, headRate, dt);
        this.headPivot.rotation.x = damp(this.headPivot.rotation.x, pitchT, headRate, dt);
        // Cowering: lean back and tremble; startle jolts the torso back
        if (this.tier === 3) {
            this.rig.rotation.x = damp(this.rig.rotation.x, -0.25 - this.flinch * 0.2, 6, dt);
            this.rig.position.x = Math.sin(this.time * 45) * 0.02;
        }
        else {
            this.rig.rotation.x = damp(this.rig.rotation.x, -this.flinch * 0.3, 6, dt);
            this.rig.position.x = 0;
        }
    }
    /** Throw the character away from the street into a tumbling ragdoll. */
    launch(awayX) {
        if (this.isBlownAway)
            return;
        this.isBlownAway = true;
        this.rig.position.x = 0;
        this.velocity.set(awayX * (6 + Math.random() * 8), 7 + Math.random() * 6, (Math.random() - 0.5) * 8);
        this.rotVelocity.set(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4);
    }
    stepRagdoll(dt) {
        const p = this.group.position;
        p.addScaledVector(this.velocity, dt);
        this.velocity.y -= 16 * dt;
        this.rig.rotation.x += this.rotVelocity.x * dt;
        this.rig.rotation.y += this.rotVelocity.y * dt;
        this.rig.rotation.z += this.rotVelocity.z * dt;
        const floor = (Math.abs(p.x) < 7 ? 0 : 0.3) + 0.35;
        if (p.y < floor) {
            p.y = floor;
            this.velocity.y = 0;
            this.velocity.x *= 0.6;
            this.velocity.z *= 0.6;
            this.rotVelocity.multiplyScalar(0.85);
        }
    }
    resetRagdoll() {
        this.isBlownAway = false;
        this.velocity.set(0, 0, 0);
        this.rotVelocity.set(0, 0, 0);
        this.rig.rotation.set(0, 0, 0);
        this.rig.position.set(0, 0.95, 0);
        this.group.rotation.set(0, 0, 0);
        this.pendingTier = -1;
        this.flinch = 0;
        this.gaze = null;
        this.setReaction(0);
    }
}
//# sourceMappingURL=NPCCharacter.js.map