import * as THREE from 'three';
import { PhysicsWorld } from '../core/Physics';
import { fartAudio } from '../audio/FartSynth';
import { damp } from '../core/animMath';
import { CarType, HEAD_NORMAL, TAIL_BRAKE, TAIL_NORMAL, TrafficCar } from './TrafficCar';

// Lanes sit at +-2.8 (plan: 3.5). Parked cars are pushed out to at least +-5.6 so even a truck
// (outer edge 4.0) keeps ~0.6 m clear of them, and so they crop the camera frame less.
const LANES = [
  { x: -2.8, dir: 1 as const }, // northbound, toward +z
  { x: 2.8, dir: -1 as const } // southbound, toward -z
];
const CRUISE = 14;
const BOUND = 80;
const PARKED_X = 5.6;
// Wrap-around point: the longest car (truck, 7.5 m) stays clear of the end caps at |z| = 81
const WRAP = BOUND - 7.5 / 2 - 1;
// Matches CameraController's grounded offset (0, 3.2, 7.2) from Dave; used to fade cars that sweep past it
const CAM_OFFSET = new THREE.Vector3(0, 3.2, 7.2);
const FADE_NEAR = 1;
const FADE_RANGE = 6;
const FADE_MIN = 0.35;
// Moving cars brake to a stop in front of Dave when he stands in their lane
const STOP_GAP = 2;
const STOP_RATE = 30;
// Planned deceleration is below STOP_RATE so the braking curve keeps some margin
const STOP_PLAN = STOP_RATE * 0.8;
// Lateral reach of a car's "Dave is in my lane" test, beyond its half width: Dave's capsule radius (0.45) plus a
// margin. Must stay small enough that Dave at the spawn (x = 0) is clear of every car type in a lane at +-2.8.
const LANE_MARGIN = 0.85;
// While Dave is falling, start braking from this height so cars stop before his touchdown, not 0.2 s ahead of it
const FALL_BRAKE_Y = 12;
// Dave's capsule depth along the lane plus a margin, used to keep a car stopped until it has fully passed him
const DAVE_CLEAR = 1;
// Do not wrap a car onto the spawn point while Dave stands this close to it
const SPAWN_CLEAR = 8;
const COLORS = [0xbf3028, 0x2f68b4, 0xefefef, 0xa8adb2, 0x2f7a4a];

type ColliderHandle = ReturnType<PhysicsWorld['createBoxCollider']>;

interface SpawnSpec {
  type: CarType;
  color: number;
}

export class TrafficManager {
  public group = new THREE.Group();
  private moving: TrafficCar[] = [];
  private parked: TrafficCar[] = [];
  private startZ = new Map<TrafficCar, number>();
  private time = 0;
  private honkTimer = 0;
  private alarmTimer = 0;
  private physics: PhysicsWorld | null = null;
  private colliders = new Map<TrafficCar, ColliderHandle>();
  private camPos = new THREE.Vector3();
  private fadeActive = true;
  private prevDaveY = 0;
  private daveFalling = false;

  constructor() {
    this.group.name = 'Traffic';
    const perLane = 5;
    LANES.forEach((lane, laneIdx) => {
      const spacing = (BOUND * 2) / perLane;
      for (let i = 0; i < perLane; i++) {
        const spec = this.pickSpec(i + laneIdx);
        const car = new TrafficCar(spec.type, spec.color);
        car.speed = CRUISE;
        const z = Math.max(-BOUND + 6, -BOUND + i * spacing + laneIdx * 14 + (Math.random() - 0.5) * 6);
        car.place(lane.x, z, lane.dir);
        this.group.add(car.group);
        this.moving.push(car);
        this.startZ.set(car, car.group.position.z);
      }
    });
  }

  private pickSpec(i: number): SpawnSpec {
    const r = i % 5;
    if (r === 0 || r === 3) return { type: 'taxi', color: 0xf4c430 };
    if (r === 4) return { type: 'truck', color: 0xd9d9d9 };
    return { type: 'sedan', color: COLORS[Math.floor(Math.random() * COLORS.length)] };
  }

  public addParked(color: number, x: number, z: number, physics: PhysicsWorld) {
    const car = new TrafficCar('sedan', color);
    car.place(Math.sign(x) * Math.max(Math.abs(x), PARKED_X), z, 1);
    car.speed = 0;
    this.group.add(car.group);
    this.parked.push(car);
    this.startZ.set(car, z);
    // Box collider so Dave can land on parked cars (the moving cars get theirs from the same call)
    this.physics = physics;
    this.addCollider(car);
    this.moving.forEach((c) => this.addCollider(c));
  }

  /** Box collider matching the car body; moving cars get a kinematic one that follows them. */
  private addCollider(car: TrafficCar) {
    if (!this.physics || this.colliders.has(car)) return;
    const p = car.group.position;
    const half = new THREE.Vector3(car.width / 2 + 0.05, car.height / 2, car.length / 2 + 0.1);
    const moving = this.moving.includes(car);
    this.colliders.set(car, this.physics.createBoxCollider(new THREE.Vector3(p.x, half.y + p.y, p.z), half, moving));
  }

  private dropCollider(car: TrafficCar) {
    const handle = this.colliders.get(car);
    if (!handle || !this.physics) return;
    this.physics.removeCollider(handle);
    this.colliders.delete(car);
  }

  /** Dave moves before the traffic update, so the collider leads the car by one frame of travel to avoid lagging it. */
  private syncCollider(car: TrafficCar, dt = 0) {
    const handle = this.colliders.get(car);
    if (!handle) return;
    const p = car.group.position;
    handle.body.setNextKinematicTranslation({ x: p.x, y: car.height / 2 + p.y, z: p.z + car.dir * car.speed * dt });
  }

  /** Distance from the camera to the car's box, mapped to a fade so close passes do not fill the frame. */
  private fadeFor(car: TrafficCar): number {
    if (!this.fadeActive) return 1;
    const p = car.group.position;
    const c = this.camPos;
    const dx = Math.max(0, Math.abs(p.x - c.x) - car.width / 2);
    const dz = Math.max(0, Math.abs(p.z - c.z) - car.length / 2);
    const dy = Math.max(0, c.y - car.height);
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return THREE.MathUtils.clamp((dist - FADE_NEAR) / FADE_RANGE, FADE_MIN, 1);
  }

  /** Top speed allowed so the car can stop before Dave if he is standing in its lane ahead of it. */
  private daveLimit(car: TrafficCar, dave: THREE.Vector3): number {
    const p = car.group.position;
    if (!this.daveInLane(car, dave)) return Infinity;
    const gap = car.dir * (dave.z - p.z) - car.length / 2;
    // Hold at zero until the whole car has cleared Dave (he is behind its tail), so it never drives through him
    if (gap < -(car.length + DAVE_CLEAR)) return Infinity;
    if (gap < 0 && dave.y >= car.height - 0.1) return Infinity; // standing on the roof: do not freeze traffic
    // Fastest speed from which the planned deceleration still stops STOP_GAP short of Dave
    return Math.min(CRUISE, Math.sqrt(2 * STOP_PLAN * Math.max(0, gap - STOP_GAP)));
  }

  private daveInLane(car: TrafficCar, dave: THREE.Vector3): boolean {
    const top = this.daveFalling ? FALL_BRAKE_Y : car.height + 1.5;
    return dave.y <= top && Math.abs(dave.x - car.group.position.x) <= car.width / 2 + LANE_MARGIN;
  }

  /** Top speed allowed so the car stops short of the nearest unlaunched car ahead in its lane. */
  private leaderLimit(car: TrafficCar): number {
    let gap = Infinity;
    for (const o of this.moving) {
      if (o === car || o.launched || o.dir !== car.dir || o.baseX !== car.baseX) continue;
      const d = car.dir * (o.group.position.z - car.group.position.z);
      if (d <= 0) continue;
      gap = Math.min(gap, d - (car.length + o.length) / 2);
    }
    return CRUISE * THREE.MathUtils.clamp((gap - 2) / 8, 0, 1);
  }

  /** True if an unlaunched car in the same lane occupies the spot where `car` would respawn. */
  private spawnBlocked(car: TrafficCar, destZ: number): boolean {
    return this.moving.some(
      (o) =>
        o !== car &&
        !o.launched &&
        o.dir === car.dir &&
        o.baseX === car.baseX &&
        Math.abs(o.group.position.z - destZ) < (car.length + o.length) / 2 + 2
    );
  }

  /** `dave` is Dave's feet position (required so cars always stop for him and fade near the camera). */
  public update(dt: number, fartNumber: number, dave: THREE.Vector3) {
    this.time += dt;
    const t = this.time;
    const honking = fartNumber >= 7 && fartNumber < 9;
    const alarms = fartNumber >= 9;
    const shockwave = fartNumber >= 12;
    // CAM_OFFSET is only the grounded camera pose; once Dave has lifted off the street cars no longer fade
    this.fadeActive = dave.y < 3;
    this.daveFalling = dave.y < this.prevDaveY - 0.01;
    this.prevDaveY = dave.y;
    this.camPos.copy(dave).add(CAM_OFFSET);
    // Beeps are non-spatial, so stop them once Dave is far above the street
    const audible = dave.y < 30;

    if (honking) {
      this.honkTimer -= dt;
      if (this.honkTimer <= 0) {
        if (audible) fartAudio.playBeep(420, 0.25);
        this.honkTimer = 0.8 + Math.random() * 0.6;
      }
    } else if (alarms && fartNumber < 14) {
      this.alarmTimer -= dt;
      if (this.alarmTimer <= 0) {
        if (audible) fartAudio.playBeep(t % 1 < 0.5 ? 900 : 1200, 0.15, 0.02);
        this.alarmTimer = 0.5;
      }
    }

    this.moving.forEach((car, i) => {
      if (car.launched) {
        car.stepTumble(dt);
        car.setFade(this.fadeFor(car));
        return;
      }
      if (shockwave) {
        car.launch(car.baseX < 0 ? -1 : 1);
        this.dropCollider(car);
        return;
      }

      let target = alarms ? 0 : honking ? 8 : CRUISE;
      let rate = alarms ? 35 : honking ? 12 : 8;
      const limit = Math.min(this.daveLimit(car, dave), this.leaderLimit(car));
      if (limit < target) {
        target = limit;
        rate = STOP_RATE;
      }
      car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), rate * dt);

      // Subtle lane swerve while panicking, only ever toward the road centre (away from the parked cars)
      const swerve = honking ? -Math.sign(car.baseX) * Math.abs(Math.sin(t * 8 + i)) * 0.2 : 0;
      car.group.position.x = damp(car.group.position.x, car.baseX + swerve, 10, dt);

      car.drive(dt);
      // Wrap before the nose reaches the end-cap buildings at |z| = 81 (one shared value so every type loops equally)
      const wrap = WRAP;
      const z = car.group.position.z;
      if (car.dir * z > wrap) {
        const destZ = z - car.dir * wrap * 2;
        if (
          (this.daveInLane(car, dave) && Math.abs(dave.z - destZ) < car.length / 2 + SPAWN_CLEAR) ||
          this.spawnBlocked(car, destZ)
        ) {
          // Dave or another car is where this car would reappear: hold it at the end of the street instead
          car.group.position.z = car.dir * wrap;
          car.speed = 0;
        } else {
          car.group.position.z = destZ;
        }
      }

      if (alarms) {
        car.group.position.y = car.baseY + Math.abs(Math.sin(t * 20 + i)) * 0.18;
        this.strobe(car, i);
      } else {
        car.group.position.y = car.baseY;
        car.setLights(HEAD_NORMAL, honking || limit < CRUISE ? TAIL_BRAKE : TAIL_NORMAL);
      }
      this.syncCollider(car, dt);
      car.setFade(this.fadeFor(car));
    });

    this.parked.forEach((car, i) => {
      if (car.launched) {
        car.stepTumble(dt);
        car.setFade(this.fadeFor(car));
        return;
      }
      if (shockwave) {
        car.launch(car.baseX < 0 ? -1 : 1);
        this.dropCollider(car);
      } else if (alarms) {
        car.group.position.y = car.baseY + Math.abs(Math.sin(t * 18 + i)) * 0.15;
        this.strobe(car, i + 2);
      }
      car.setFade(this.fadeFor(car));
    });
  }

  private strobe(car: TrafficCar, i: number) {
    const on = Math.sin(this.time * 24 + i * 2) > 0;
    car.setLights(on ? 0xffff44 : 0xffffff, on ? 0xffffff : 0xffff44);
  }

  public reset() {
    this.honkTimer = 0;
    this.alarmTimer = 0;
    [...this.moving, ...this.parked].forEach((car) => {
      car.reset(car.baseX, this.startZ.get(car) ?? 0);
      car.speed = this.moving.includes(car) ? CRUISE : 0;
      this.addCollider(car); // restore colliders dropped when the cars were launched
      this.syncCollider(car);
    });
  }
}
