import * as THREE from 'three';
import { fartAudio } from '../audio/FartSynth';
import { damp } from '../core/animMath';
import { HEAD_NORMAL, TAIL_BRAKE, TAIL_NORMAL, TrafficCar } from './TrafficCar';
// Lanes sit at +-2.8 (plan: 3.5) so moving cars clear the curbside parked cars at +-5.2
const LANES = [
    { x: -2.8, dir: 1 }, // northbound, toward +z
    { x: 2.8, dir: -1 } // southbound, toward -z
];
const CRUISE = 14;
const BOUND = 80;
const COLORS = [0xbf3028, 0x2f68b4, 0xefefef, 0xa8adb2, 0x2f7a4a];
export class TrafficManager {
    group = new THREE.Group();
    moving = [];
    parked = [];
    startZ = new Map();
    time = 0;
    honkTimer = 0;
    alarmTimer = 0;
    constructor() {
        this.group.name = 'Traffic';
        const perLane = 5;
        LANES.forEach((lane, laneIdx) => {
            const spacing = (BOUND * 2) / perLane;
            for (let i = 0; i < perLane; i++) {
                const spec = this.pickSpec(i + laneIdx);
                const car = new TrafficCar(spec.type, spec.color);
                car.speed = CRUISE;
                const z = -BOUND + i * spacing + laneIdx * 14 + (Math.random() - 0.5) * 6;
                car.place(lane.x, z, lane.dir);
                this.group.add(car.group);
                this.moving.push(car);
                this.startZ.set(car, car.group.position.z);
            }
        });
    }
    pickSpec(i) {
        const r = i % 5;
        if (r === 0 || r === 3)
            return { type: 'taxi', color: 0xf4c430 };
        if (r === 4)
            return { type: 'truck', color: 0xd9d9d9 };
        return { type: 'sedan', color: COLORS[Math.floor(Math.random() * COLORS.length)] };
    }
    addParked(color, x, z, physics) {
        const car = new TrafficCar('sedan', color);
        car.place(x, z, 1);
        car.speed = 0;
        this.group.add(car.group);
        this.parked.push(car);
        this.startZ.set(car, z);
        // Box collider so Dave can land on parked cars
        physics.createBoxCollider(new THREE.Vector3(x, 0.8, z), new THREE.Vector3(1.1, 0.8, 2.3));
    }
    update(dt, fartNumber) {
        this.time += dt;
        const t = this.time;
        const honking = fartNumber >= 7 && fartNumber < 9;
        const alarms = fartNumber >= 9;
        const shockwave = fartNumber >= 12;
        if (honking) {
            this.honkTimer -= dt;
            if (this.honkTimer <= 0) {
                fartAudio.playBeep(420, 0.25);
                this.honkTimer = 0.8 + Math.random() * 0.6;
            }
        }
        else if (alarms && !shockwave) {
            this.alarmTimer -= dt;
            if (this.alarmTimer <= 0) {
                fartAudio.playBeep(t % 1 < 0.5 ? 900 : 1200, 0.15, 0.02);
                this.alarmTimer = 0.5;
            }
        }
        this.moving.forEach((car, i) => {
            if (car.launched) {
                car.stepTumble(dt);
                return;
            }
            if (shockwave) {
                car.launch(car.baseX < 0 ? -1 : 1);
                return;
            }
            const target = alarms ? 0 : honking ? 8 : CRUISE;
            const rate = alarms ? 35 : honking ? 12 : 8;
            car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), rate * dt);
            // Subtle lane swerve while panicking
            const swerve = honking ? Math.sin(t * 8 + i) * 0.4 : 0;
            car.group.position.x = damp(car.group.position.x, car.baseX + swerve, 10, dt);
            car.drive(dt);
            const z = car.group.position.z;
            if (car.dir > 0 && z > BOUND)
                car.group.position.z -= BOUND * 2;
            else if (car.dir < 0 && z < -BOUND)
                car.group.position.z += BOUND * 2;
            if (alarms) {
                car.group.position.y = car.baseY + Math.abs(Math.sin(t * 20 + i)) * 0.18;
                this.strobe(car, i);
            }
            else {
                car.group.position.y = car.baseY;
                car.setLights(HEAD_NORMAL, honking ? TAIL_BRAKE : TAIL_NORMAL);
            }
        });
        this.parked.forEach((car, i) => {
            if (car.launched) {
                car.stepTumble(dt);
                return;
            }
            if (shockwave) {
                car.launch(car.baseX < 0 ? -1 : 1);
            }
            else if (alarms) {
                car.group.position.y = car.baseY + Math.abs(Math.sin(t * 18 + i)) * 0.15;
                this.strobe(car, i + 2);
            }
        });
    }
    strobe(car, i) {
        const on = Math.sin(this.time * 24 + i * 2) > 0;
        car.setLights(on ? 0xffff44 : 0xffffff, on ? 0xffffff : 0xffff44);
    }
    reset() {
        this.honkTimer = 0;
        this.alarmTimer = 0;
        [...this.moving, ...this.parked].forEach((car) => {
            car.reset(car.baseX, this.startZ.get(car) ?? 0);
            car.speed = this.moving.includes(car) ? CRUISE : 0;
        });
    }
}
//# sourceMappingURL=TrafficManager.js.map