import * as THREE from 'three';
import { NPCCharacter, reactionTier } from './NPCCharacter';
import { dampAngle, damp } from '../core/animMath';
const SIDEWALK_Y = 0.3;
const PATROL_Z = 65;
const CAFE_X = -9.8;
const CAFE_TABLES_Z = [10, 16, 22];
const CAFE_AVOID_X = -11.7; // far side of the tables, still on the sidewalk (edge at -13)
const CAFE_LOOKAHEAD = 3.2;
export class NPCManager {
    group = new THREE.Group();
    walkers = [];
    bystanders = [];
    lastTier = -1;
    daveHead = new THREE.Vector3();
    constructor() {
        this.group.name = 'Pedestrians';
        // 10 walkers, alternating directions, split across both sidewalks
        for (let i = 0; i < 10; i++) {
            const left = i % 2 === 0;
            const laneX = (left ? [-10.4, -11.0, -11.6] : [10.2, 10.9, 11.5])[Math.floor(i / 2) % 3];
            const dir = Math.floor(i / 2) % 2 === 0 ? 1 : -1;
            const z = -55 + (i * 11.5 + Math.random() * 4);
            const char = new NPCCharacter();
            char.group.position.set(laneX, SIDEWALK_Y, z);
            this.group.add(char.group);
            this.walkers.push({
                char,
                focus: null,
                lookTimer: Math.random() * 2,
                otherIdx: -1,
                reactTime: 0.05 + Math.random() * 0.45,
                gazeVec: new THREE.Vector3(),
                dir,
                laneX,
                speed: 1.2 + Math.random() * 0.6,
                startX: laneX,
                startZ: z,
                startDir: dir
            });
        }
        // Café patrons stand beside each table; phone users near the curbs
        CAFE_TABLES_Z.forEach((tz) => this.addBystander(CAFE_X, tz + 1.1, Math.PI, false));
        this.addBystander(-9.2, -40, 0, true);
        this.addBystander(8.5, -8, Math.PI / 2 + Math.PI, true);
        this.addBystander(9.2, 14, Math.PI * 1.5, true);
    }
    addBystander(x, z, yaw, holdsPhone) {
        const char = new NPCCharacter({ holdsPhone });
        char.group.position.set(x, SIDEWALK_Y, z);
        char.group.rotation.y = yaw;
        this.group.add(char.group);
        this.bystanders.push({ char, x, z, yaw, focus: null, lookTimer: Math.random() * 2, otherIdx: -1, reactTime: 0.05 + Math.random() * 0.45, gazeVec: new THREE.Vector3() });
    }
    update(dt, db, dave, dogPos) {
        const tier = reactionTier(db);
        const daveZ = dave.z;
        this.daveHead.set(dave.x, dave.y + 2.8, dave.z);
        // Sound reaches each person after a delay set by distance plus personal reaction time
        if (tier !== this.lastTier) {
            this.lastTier = tier;
            this.everyone().forEach((e) => {
                const d = e.char.group.position.distanceTo(dave);
                e.char.queueReaction(tier, 0.1 + d / 45 + e.reactTime);
            });
        }
        this.walkers.forEach((w) => {
            const c = w.char;
            const p = c.group.position;
            this.updateGaze(w, dt, dave, dogPos);
            if (c.tier >= 4) {
                c.launch(p.x >= 0 ? 1 : -1);
                c.update(dt, false);
                return;
            }
            let moving = false;
            let speed = w.speed;
            if (c.tier === 0) {
                moving = true;
            }
            else if (c.tier === 1) {
                moving = false; // stops and stares toward the noise
            }
            else if (c.tier === 2) {
                // Hold nose and hurry away from Dave, glancing back
                w.dir = p.z >= daveZ ? 1 : -1;
                speed = w.speed * 1.9;
                moving = true;
            }
            else if (c.tier === 3) {
                // Cower and stumble backwards
                w.dir = p.z >= daveZ ? 1 : -1;
                speed = 0.5;
                moving = false;
                p.z += w.dir * speed * dt;
            }
            if (moving) {
                p.z += w.dir * speed * dt;
                if (p.z > PATROL_Z)
                    w.dir = -1;
                else if (p.z < -PATROL_Z)
                    w.dir = 1;
            }
            // Steer around the café tables on the left sidewalk
            let targetX = w.laneX;
            if (w.laneX < 0 && CAFE_TABLES_Z.some((tz) => Math.abs(p.z - tz) < CAFE_LOOKAHEAD)) {
                targetX = CAFE_AVOID_X;
            }
            p.x = damp(p.x, targetX, 2.5, dt);
            // Face the direction of travel; stare at Dave while stopped or cowering
            const faceDave = c.tier === 1 || c.tier === 3;
            const yawTarget = faceDave ? Math.atan2(dave.x - p.x, daveZ - p.z) : w.dir > 0 ? 0 : Math.PI;
            c.group.rotation.y = dampAngle(c.group.rotation.y, yawTarget, c.tier === 0 ? 6 : 5, dt);
            c.update(dt, moving, speed / w.speed);
        });
        this.bystanders.forEach((b) => {
            const c = b.char;
            this.updateGaze(b, dt, dave, dogPos);
            if (c.tier >= 4)
                c.launch(c.group.position.x >= 0 ? 1 : -1);
            if (c.tier >= 1 && !c.isBlownAway) {
                const p = c.group.position;
                c.group.rotation.y = dampAngle(c.group.rotation.y, Math.atan2(dave.x - p.x, daveZ - p.z), 4, dt);
            }
            c.update(dt, false);
        });
    }
    everyone() {
        return [...this.walkers, ...this.bystanders];
    }
    /** Decide what an NPC is looking at: the source of the noise once alarmed, otherwise people-watching. */
    updateGaze(e, dt, dave, dogPos) {
        const c = e.char;
        const p = c.group.position;
        if (c.tier >= 1) {
            c.lookAt(this.daveHead);
            e.focus = 'dave';
            e.lookTimer = 0;
            return;
        }
        e.lookTimer -= dt;
        if (e.lookTimer <= 0) {
            e.lookTimer = 1.5 + Math.random() * 3;
            const r = Math.random();
            e.focus = null;
            if (p.distanceTo(dave) < 18 && r < 0.3)
                e.focus = 'dave';
            else if (dogPos && p.distanceTo(dogPos) < 10 && r < 0.55)
                e.focus = 'dog';
            else if (r < 0.8) {
                // People-watch: nearest other pedestrian within 7 m
                let best = 49;
                e.otherIdx = -1;
                this.everyone().forEach((o, i) => {
                    if (o === e || o.char.isBlownAway)
                        return;
                    const d2 = o.char.group.position.distanceToSquared(p);
                    if (d2 < best) {
                        best = d2;
                        e.otherIdx = i;
                    }
                });
                if (e.otherIdx >= 0)
                    e.focus = 'npc';
            }
        }
        if (e.focus === 'dave') {
            c.lookAt(this.daveHead);
        }
        else if (e.focus === 'dog' && dogPos) {
            e.gazeVec.set(dogPos.x, dogPos.y + 0.8, dogPos.z);
            c.lookAt(e.gazeVec);
        }
        else if (e.focus === 'npc') {
            const o = this.everyone()[e.otherIdx];
            if (o) {
                const op = o.char.group.position;
                e.gazeVec.set(op.x, op.y + 1.8, op.z);
                c.lookAt(e.gazeVec);
            }
            else
                c.lookAt(null);
        }
        else {
            c.lookAt(null);
        }
    }
    reset() {
        this.lastTier = -1;
        this.walkers.forEach((w) => {
            w.char.resetRagdoll();
            w.dir = w.startDir;
            w.char.group.position.set(w.startX, SIDEWALK_Y, w.startZ);
        });
        this.bystanders.forEach((b) => {
            b.char.resetRagdoll();
            b.char.group.position.set(b.x, SIDEWALK_Y, b.z);
            b.char.group.rotation.y = b.yaw;
        });
    }
}
//# sourceMappingURL=NPCManager.js.map