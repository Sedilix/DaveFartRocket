import * as THREE from 'three';
import { NPCCharacter, reactionTier } from './NPCCharacter';
import { damp, dampAngle } from '../core/animMath';
const OWNER_X = -9.5;
const FOLLOW_DISTANCE = 2.0;
const SIDEWALK_Y = 0.3;
/** Walks the sidewalk a few metres behind the dog, joined to it by a leash. */
export class DogOwner {
    dog;
    group = new THREE.Group();
    owner = new NPCCharacter();
    leash;
    hand = new THREE.Vector3();
    collar = new THREE.Vector3();
    mid = new THREE.Vector3();
    gazeVec = new THREE.Vector3();
    daveHead = new THREE.Vector3();
    lastTier = -1;
    constructor(dog) {
        this.dog = dog;
        this.leash = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 1), new THREE.MeshBasicMaterial({ color: 0xcc3333 }));
        this.group.add(this.owner.group, this.leash);
        this.snap();
    }
    snap() {
        const dp = this.dog.group.position;
        this.owner.group.position.set(OWNER_X, SIDEWALK_Y, dp.z - this.dog.dir * FOLLOW_DISTANCE);
        this.owner.group.rotation.y = this.dog.dir > 0 ? 0 : Math.PI;
    }
    update(dt, db, dave) {
        const tier = reactionTier(db);
        const p = this.owner.group.position;
        const daveZ = dave.z;
        if (tier !== this.lastTier) {
            this.lastTier = tier;
            this.owner.queueReaction(tier, 0.1 + p.distanceTo(dave) / 45 + 0.25);
        }
        // Watches the dog on the walk; once alarmed, stares at Dave
        this.dog.neckWorld(this.gazeVec);
        if (this.owner.tier >= 1)
            this.owner.lookAt(this.daveHead.set(dave.x, dave.y + 2.8, dave.z));
        else
            this.owner.lookAt(this.gazeVec);
        if (this.owner.tier >= 4) {
            this.owner.launch(-1);
            this.owner.update(dt, false);
            this.leash.visible = false;
            return;
        }
        let walking = false;
        let speedMul = 1;
        if (this.owner.tier === 0 && !this.dog.panicking) {
            const prevZ = p.z;
            p.z = damp(p.z, this.dog.group.position.z - this.dog.dir * FOLLOW_DISTANCE, 3, dt);
            p.x = damp(p.x, OWNER_X, 4, dt);
            const v = Math.abs(p.z - prevZ) / Math.max(dt, 1e-4);
            walking = v > 0.25;
            speedMul = Math.min(1.5, v / 1.3);
            this.owner.group.rotation.y = dampAngle(this.owner.group.rotation.y, this.dog.dir > 0 ? 0 : Math.PI, 5, dt);
        }
        else if (this.owner.tier >= 1) {
            this.owner.group.rotation.y = dampAngle(this.owner.group.rotation.y, Math.atan2(-p.x, daveZ - p.z), 6, dt);
        }
        this.owner.update(dt, walking, speedMul);
        // Leash: owner's hand -> dog collar. Snaps once the dog bolts.
        this.leash.visible = !this.dog.panicking && this.dog.group.visible;
        if (this.leash.visible) {
            const yaw = this.owner.group.rotation.y;
            const lx = 0.42;
            const lz = 0.1;
            this.hand.set(p.x + lx * Math.cos(yaw) + lz * Math.sin(yaw), p.y + 0.9, p.z - lx * Math.sin(yaw) + lz * Math.cos(yaw));
            this.dog.neckWorld(this.collar);
            this.mid.addVectors(this.hand, this.collar).multiplyScalar(0.5);
            this.leash.position.copy(this.mid);
            this.leash.scale.z = Math.max(0.1, this.hand.distanceTo(this.collar));
            this.leash.lookAt(this.collar);
        }
    }
    reset() {
        this.owner.resetRagdoll();
        this.lastTier = -1;
        this.leash.visible = true;
        this.snap();
    }
}
//# sourceMappingURL=DogOwner.js.map