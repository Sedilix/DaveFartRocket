import * as THREE from 'three';
import { NPCCharacter, reactionTier } from './NPCCharacter';
import { dampAngle, damp } from '../core/animMath';

const SIDEWALK_Y = 0.3;
const PATROL_Z = 65;
const CAFE_X = -9.8;
const CAFE_TABLES_Z = [10, 16, 22];
const CAFE_LOOKAHEAD = 4.5; // lane shifts are speed-capped, so start them early
const CAFE_PATRON_Z = CAFE_TABLES_Z.map((tz) => tz + 1.1);
// Five distinct walker lanes per sidewalk (|x|, ~1 m apart, clear of the building face at 13).
// The far lane stops at 11.7 so legs clear the wall benches and bins (seat edge x 12.27); the curb lane sits at 8.6,
// outside the tree trunks (x 7.8) and curb bins (x 7.5).
const LANES = [11.7, 10.9, 10.1, 9.35, 8.6];
// Lane used while passing the café tables (x -10.6..-9.0): two far-side lanes plus the curb-side strip.
// Lanes are shared only by same-direction walkers, who also share a speed so they never overtake.
const CAFE_LANES = [11.7, 11.0, 11.7, 11.0, 8.6];
// Lane used while passing the dog, its owner (x -8.6 / -9.5) or a phone user: each walker gets its own fixed slot
// beyond them. Slots are staggered by direction (even lanes walk +z, odd lanes -z): opposite-direction walkers are 0.65 m
// apart, and only same-direction, same-speed walkers share a slot, so nobody overlaps. The innermost slot (10.4) stays
// 0.9 m from the owner and 1.2 m from the phone users.
const PARTY_LANES = [11.7, 11.05, 11.7, 11.05, 10.4];
const LANE_MIN_X = 8.6;
const LANE_MAX_X = 11.7;
const WALKER_GAP = 0.65; // x gap below which two walkers are pushed apart (torso is about 0.62 wide)
const PHONE_LOOK = 3.4; // walkers move to their party slot this far (z) from a phone user
const LANE_CLEAR = 1.1; // minimum x gap to a static obstacle
const OWNER_X = -9.5; // DogOwner's lane; he trails the dog by 2 m
const OWNER_LOOK = 5; // walkers start steering around the owner this far ahead (z)
const DOG_LOOK = 2;
const DOG_PANIC_SPEED = 4; // dog z speed (m/s) above which it is bolting

type Focus = 'dave' | 'dog' | 'npc' | null;

interface Walker {
  char: NPCCharacter;
  focus: Focus;
  lookTimer: number;
  otherIdx: number;
  reactTime: number;
  gazeVec: THREE.Vector3;
  dir: 1 | -1;
  lane: number;
  laneX: number;
  cafeX: number;
  speed: number;
  startX: number;
  startZ: number;
  startDir: 1 | -1;
}

interface Bystander {
  char: NPCCharacter;
  focus: Focus;
  lookTimer: number;
  otherIdx: number;
  reactTime: number;
  gazeVec: THREE.Vector3;
  x: number;
  z: number;
  yaw: number;
  party: boolean; // a lone phone user standing on the sidewalk: walkers pass in their party slots
}

export class NPCManager {
  public group = new THREE.Group();
  private walkers: Walker[] = [];
  private bystanders: Bystander[] = [];
  private all: (Walker | Bystander)[] = [];
  private lastTier = -1;
  private daveHead = new THREE.Vector3();
  // The owner stops following once the dog bolts, so remember where he was (dog z minus 2 m behind it)
  private ownerZ = -12;
  private dogZ = NaN;
  private dogDir = 1;
  private dogSpeed = 0;
  private dogBolted = false;

  constructor() {
    this.group.name = 'Pedestrians';

    // 10 walkers, alternating directions, split across both sidewalks; every walker owns a lane
    const rnd = () => 1.2 + Math.random() * 0.6;
    const sideSpeeds = [[rnd(), rnd(), rnd()], [rnd(), rnd(), rnd()]];
    for (let i = 0; i < 10; i++) {
      const left = i % 2 === 0;
      const k = Math.floor(i / 2);
      const sign = left ? -1 : 1;
      const laneX = sign * LANES[k];
      const cafeX = left ? -CAFE_LANES[k] : laneX;
      const dir: 1 | -1 = k % 2 === 0 ? 1 : -1;
      const speed = sideSpeeds[left ? 0 : 1][k === 4 ? 2 : k % 2];
      let z = -55 + (i * 11.5 + Math.random() * 4);
      if (left && Math.abs(laneX - CAFE_X) < 1.6) {
        // never spawn on top of a seated café patron
        for (let j = CAFE_PATRON_Z.length - 1; j >= 0; j--) if (Math.abs(z - CAFE_PATRON_Z[j]) < 3.5) z = CAFE_PATRON_Z[j] - 3.5;
      }
      const char = new NPCCharacter();
      char.group.position.set(laneX, SIDEWALK_Y, z);
      char.group.rotation.y = dir > 0 ? 0 : Math.PI;
      this.group.add(char.group);
      const walker: Walker = {
        char,
        focus: null,
        lookTimer: Math.random() * 2,
        otherIdx: -1,
        reactTime: 0.05 + Math.random() * 0.45,
        gazeVec: new THREE.Vector3(),
        dir,
        lane: k,
        laneX,
        cafeX,
        speed,
        startX: laneX,
        startZ: z,
        startDir: dir
      };
      this.walkers.push(walker);
      this.all.push(walker);
    }

    // Café patrons stand beside each table; phone users near the curbs
    CAFE_TABLES_Z.forEach((tz) => this.addBystander(CAFE_X, tz + 1.1, Math.PI, false));
    this.addBystander(-9.2, -40, 0, true);
    this.addBystander(8.5, -8, Math.PI / 2 + Math.PI, true);
    this.addBystander(9.2, 14, Math.PI * 1.5, true);
  }

  private addBystander(x: number, z: number, yaw: number, holdsPhone: boolean) {
    const char = new NPCCharacter({ holdsPhone });
    char.group.position.set(x, SIDEWALK_Y, z);
    char.group.rotation.y = yaw;
    this.group.add(char.group);
    const bystander: Bystander = { char, x, z, yaw, party: holdsPhone, focus: null, lookTimer: Math.random() * 2, otherIdx: -1, reactTime: 0.05 + Math.random() * 0.45, gazeVec: new THREE.Vector3() };
    this.bystanders.push(bystander);
    this.all.push(bystander);
  }

  /** Track the dog's speed and where its owner stands (he is frozen in place while the dog bolts). */
  private trackDog(dt: number, dogPos: THREE.Vector3, ownerPos?: THREE.Vector3) {
    if (!Number.isNaN(this.dogZ) && dt > 1e-4) {
      const dz = dogPos.z - this.dogZ;
      this.dogSpeed = Math.abs(dz) / dt;
      if (this.dogSpeed >= DOG_PANIC_SPEED) this.dogBolted = true;
      // Once the dog has bolted the owner stays put (even after the dog vanishes and its speed reads 0)
      if (this.dogSpeed < DOG_PANIC_SPEED && !this.dogBolted) {
        if (Math.abs(dz) > 1e-4) this.dogDir = dz > 0 ? 1 : -1;
        this.ownerZ = dogPos.z - this.dogDir * 2;
      }
    }
    this.dogZ = dogPos.z;
    if (ownerPos) this.ownerZ = ownerPos.z;
  }

  /** `ownerPos` is the dog owner's real position when the caller has it; otherwise it is estimated from the dog. */
  public update(dt: number, db: number, dave: THREE.Vector3, dogPos?: THREE.Vector3, ownerPos?: THREE.Vector3) {
    const tier = reactionTier(db);
    const daveZ = dave.z;
    this.daveHead.set(dave.x, dave.y + 1.65, dave.z);
    if (dogPos) this.trackDog(dt, dogPos, ownerPos);
    // A bolting dog covers ground fast: look further ahead and hop clear quicker
    const dogFast = dogPos !== undefined && this.dogSpeed >= DOG_PANIC_SPEED;
    const dogLook = dogFast ? Math.max(8, this.dogSpeed * 0.7) : DOG_LOOK;
    const shiftRate = dogFast ? 6 : 2.5;

    // Sound reaches each person after a delay set by distance plus personal reaction time
    if (tier !== this.lastTier) {
      this.lastTier = tier;
      for (let i = 0; i < this.all.length; i++) {
        const e = this.all[i];
        const d = e.char.group.position.distanceTo(dave);
        // The blast launch (tier 4) skips the travel delay so people leave the ground while Dave is still low
        e.char.queueReaction(tier, 0.1 + (tier >= 4 ? 0 : d / 45) + e.reactTime);
      }
    }

    for (let i = 0; i < this.walkers.length; i++) {
      const w = this.walkers[i];
      const c = w.char;
      const p = c.group.position;
      this.updateGaze(w, dt, dave, dogPos);

      if (c.tier >= 4) {
        c.launch(p.x >= 0 ? 1 : -1);
        c.update(dt, false);
        continue;
      }

      let moving = false;
      let speed = w.speed;
      const fleeing = c.tier === 2 || c.tier === 3;
      if (c.tier === 0) {
        moving = true;
      } else if (fleeing) {
        // Tier 2: hold nose and hurry away from Dave; tier 3: cower and stumble backwards
        const dz = p.z - daveZ;
        if (Math.abs(dz) > 0.5) w.dir = dz >= 0 ? 1 : -1;
        speed = c.tier === 2 ? w.speed * 1.9 : 0.5;
        moving = true;
        // Nowhere left to run at the end of the patrol
        if ((w.dir > 0 && p.z >= PATROL_Z) || (w.dir < 0 && p.z <= -PATROL_Z)) moving = false;
      } // tier 1: stops and stares toward the noise

      // Face the direction of travel; stare at Dave while stopped or cowering
      const faceDave = c.tier === 1 || c.tier === 3;
      const yawTarget = faceDave ? Math.atan2(dave.x - p.x, daveZ - p.z) : w.dir > 0 ? 0 : Math.PI;
      // Walk (and run) only along the facing, so a direction flip turns on the spot instead of moonwalking
      if (c.tier === 0 || c.tier === 2) speed *= Math.max(0, Math.cos(yawTarget - c.group.rotation.y));

      if (moving) {
        p.z += w.dir * speed * dt;
        if (c.tier === 0) {
          if (p.z > PATROL_Z) w.dir = -1;
          else if (p.z < -PATROL_Z) w.dir = 1;
        }
      }
      p.z = THREE.MathUtils.clamp(p.z, -PATROL_Z, PATROL_Z);

      // Steer around the café tables on the left sidewalk, the dog and its owner and phone users (each walker
      // gets its own fixed slot beyond them), then around café patrons
      let targetX = w.laneX;
      const left = w.laneX < 0;
      const atCafe = left && this.nearCafeTable(p.z);
      if (atCafe) {
        targetX = w.cafeX;
      } else if (left && dogPos && (Math.abs(p.z - dogPos.z) < dogLook || Math.abs(p.z - this.ownerZ) < OWNER_LOOK)) {
        targetX = -PARTY_LANES[w.lane];
      }
      for (let j = 0; j < this.bystanders.length; j++) {
        const b = this.bystanders[j];
        if (b.char.isBlownAway) continue;
        if (b.party) {
          if (b.x * p.x > 0 && Math.abs(p.z - b.z) < PHONE_LOOK) targetX = Math.sign(b.x) * PARTY_LANES[w.lane];
        } else targetX = this.avoidX(targetX, p.z, b.x, b.z, 1.8);
      }
      if (atCafe && dogPos) {
        // Rare overlap of the café window with the end of the dog's patrol: plain per-obstacle avoidance
        targetX = this.avoidX(targetX, p.z, dogPos.x, dogPos.z, dogLook);
        targetX = this.avoidX(targetX, p.z, OWNER_X, this.ownerZ, OWNER_LOOK, false);
      }
      // Cap the sideways speed so lane changes are a gentle drift, not a slide (faster while hopping clear of the dog)
      const maxLat = dogFast ? 3 : c.tier === 2 ? 2 : 1;
      const stepX = damp(p.x, targetX, shiftRate, dt) - p.x;
      p.x += THREE.MathUtils.clamp(stepX, -maxLat * dt, maxLat * dt);

      c.group.rotation.y = dampAngle(c.group.rotation.y, yawTarget, c.tier === 0 ? 6 : 5, dt);

      // A cowering walker (tier 3) faces Dave while stumbling away from him, so the gait runs in reverse.
      // The legs stop while a walker turns (speed is scaled by the facing above).
      const gait = c.tier === 3 ? -speed / 1.3 : speed / 1.3;
      const stepping = moving && speed > 0.05;
      c.update(dt, stepping, stepping ? gait : 0);
    }
    this.separateWalkers(dt);

    for (let i = 0; i < this.bystanders.length; i++) {
      const b = this.bystanders[i];
      const c = b.char;
      this.updateGaze(b, dt, dave, dogPos);
      if (c.tier >= 4) c.launch(c.group.position.x >= 0 ? 1 : -1);
      if (c.tier >= 1 && !c.isBlownAway) {
        const p = c.group.position;
        c.group.rotation.y = dampAngle(c.group.rotation.y, Math.atan2(dave.x - p.x, daveZ - p.z), 4, dt);
      }
      c.update(dt, false);
    }
  }

  private nearCafeTable(z: number): boolean {
    for (let i = 0; i < CAFE_TABLES_Z.length; i++) if (Math.abs(z - CAFE_TABLES_Z[i]) < CAFE_LOOKAHEAD) return true;
    return false;
  }

  /** Shift a lane target sideways (passing on the curb side only if there is room) to keep LANE_CLEAR from an obstacle. */
  private avoidX(x: number, z: number, ox: number, oz: number, look: number, curbSide = true): number {
    if (Math.abs(z - oz) > look || Math.abs(x - ox) >= LANE_CLEAR || x * ox <= 0) return x;
    const ax = Math.abs(x);
    const ao = Math.abs(ox);
    const inner = ao - LANE_CLEAR;
    const out = curbSide && ax < ao && inner >= LANE_MIN_X ? inner : Math.min(ao + LANE_CLEAR, LANE_MAX_X);
    return Math.sign(x) * out;
  }

  /** Cheap pairwise push so walkers never interpenetrate when lane shifts or direction changes bring them together. */
  private separateWalkers(dt: number) {
    const ws = this.walkers;
    const soft = Math.min(1, dt * 12); // gentle, frame-rate independent shove so pinned walkers do not jitter
    for (let a = 0; a < ws.length; a++) {
      if (ws[a].char.isBlownAway) continue;
      const pa = ws[a].char.group.position;
      for (let b = a + 1; b < ws.length; b++) {
        if (ws[b].char.isBlownAway) continue;
        const pb = ws[b].char.group.position;
        if (Math.abs(pa.z - pb.z) > 0.9) continue;
        const dx = pb.x - pa.x;
        if (Math.abs(dx) >= WALKER_GAP) continue;
        const push = (WALKER_GAP - Math.abs(dx)) * 0.5 * soft * (dx === 0 ? (a % 2 ? -1 : 1) : Math.sign(dx));
        pa.x = THREE.MathUtils.clamp(pa.x - push, -LANE_MAX_X - 0.1, LANE_MAX_X + 0.1);
        pb.x = THREE.MathUtils.clamp(pb.x + push, -LANE_MAX_X - 0.1, LANE_MAX_X + 0.1);
      }
    }
  }

  /** Decide what an NPC is looking at: the source of the noise once alarmed, otherwise people-watching. */
  private updateGaze(e: Walker | Bystander, dt: number, dave: THREE.Vector3, dogPos?: THREE.Vector3) {
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
      if (p.distanceTo(dave) < 18 && r < 0.3) e.focus = 'dave';
      else if (dogPos && p.distanceTo(dogPos) < 10 && r < 0.55) e.focus = 'dog';
      else if (r < 0.8) {
        // People-watch: nearest other pedestrian within 7 m
        let best = 49;
        e.otherIdx = -1;
        for (let i = 0; i < this.all.length; i++) {
          const o = this.all[i];
          if (o === e || o.char.isBlownAway) continue;
          const d2 = o.char.group.position.distanceToSquared(p);
          if (d2 < best) {
            best = d2;
            e.otherIdx = i;
          }
        }
        if (e.otherIdx >= 0) e.focus = 'npc';
      }
    }

    if (e.focus === 'dave') {
      c.lookAt(this.daveHead);
    } else if (e.focus === 'dog' && dogPos) {
      e.gazeVec.set(dogPos.x, dogPos.y + 0.8, dogPos.z);
      c.lookAt(e.gazeVec);
    } else if (e.focus === 'npc') {
      const o = this.all[e.otherIdx];
      if (o) {
        const op = o.char.group.position;
        e.gazeVec.set(op.x, op.y + 1.4, op.z);
        c.lookAt(e.gazeVec);
      } else c.lookAt(null);
    } else {
      c.lookAt(null);
    }
  }

  public reset() {
    this.lastTier = -1;
    this.ownerZ = -12;
    this.dogZ = NaN;
    this.dogDir = 1;
    this.dogSpeed = 0;
    this.dogBolted = false;
    for (let i = 0; i < this.walkers.length; i++) {
      const w = this.walkers[i];
      w.char.resetRagdoll();
      w.dir = w.startDir;
      w.char.group.position.set(w.startX, SIDEWALK_Y, w.startZ);
      w.char.group.rotation.y = w.dir > 0 ? 0 : Math.PI;
    }
    for (let i = 0; i < this.bystanders.length; i++) {
      const b = this.bystanders[i];
      b.char.resetRagdoll();
      b.char.group.position.set(b.x, SIDEWALK_Y, b.z);
      b.char.group.rotation.y = b.yaw;
    }
  }
}
