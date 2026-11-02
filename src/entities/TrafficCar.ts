import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type CarType = 'taxi' | 'sedan' | 'truck';

const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 8);
// Templates only: each car clones its own so it can fade independently near the camera
const wheelMatTemplate = new THREE.MeshStandardMaterial({ color: 0x181818, flatShading: true });
const blackMatTemplate = new THREE.MeshStandardMaterial({ color: 0x111111, flatShading: true });
const glassMatTemplate = new THREE.MeshStandardMaterial({
  color: 0x5a7a96,
  emissive: 0x0a1520,
  flatShading: true,
  roughness: 0.15,
  metalness: 0.3
});
const WHEEL_RADIUS = 0.38;
// Launched cars bounce off the facades and the end-cap buildings instead of entering them
const FACADE_X = 13;
const END_Z = 81;
const tmp = new THREE.Vector3();
const SPEC = {
  taxi: { length: 4.4, width: 2.1, height: 1.6 },
  sedan: { length: 4.4, width: 2.1, height: 1.6 },
  truck: { length: 7.5, width: 2.4, height: 3.3 }
};
const SIDEWALK_Y = 0.3;
// Per-second ground-contact damping (about 0.7 per frame at 60 Hz)
const CONTACT_DAMP = 21;

interface CarGeos {
  body: THREE.BufferGeometry;
  glass: THREE.BufferGeometry;
  black: THREE.BufferGeometry;
  headLights: THREE.BufferGeometry;
  tailLights: THREE.BufferGeometry;
  cargo?: THREE.BufferGeometry;
  door?: THREE.BufferGeometry;
  sign?: THREE.BufferGeometry;
}

const geoCache = new Map<CarType, CarGeos>();

const box = (w: number, h: number, d: number, x: number, y: number, z: number) =>
  new THREE.BoxGeometry(w, h, d).translate(x, y, z);

const merge = (list: THREE.BufferGeometry[]) => {
  const merged = mergeGeometries(list, false) ?? list[0];
  if (merged !== list[0]) list.forEach((g) => g.dispose());
  return merged;
};

/** Merged static geometry per material slot, built once per car type and shared by every car of that type. */
function carGeos(type: CarType): CarGeos {
  const cached = geoCache.get(type);
  if (cached) return cached;
  const { length: L, width: W } = SPEC[type];
  const lightY = type === 'truck' ? 1.0 : 0.7;
  const hl = (z: number) => [-1, 1].map((side) => box(0.35, 0.2, 0.1, side * (W / 2 - 0.4), lightY, z));
  const common = { headLights: merge(hl(L / 2 + 0.02)), tailLights: merge(hl(-L / 2 - 0.02)) };
  let geos: CarGeos;

  if (type === 'truck') {
    const ribs: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) ribs.push(box(W - 0.4, 0.04, 0.09, 0, 1.2 + i * 0.32, -L / 2 + 1.2 - 0.03));
    geos = {
      ...common,
      body: box(W - 0.1, 1.6, 2.0, 0, 1.65, L / 2 - 1.1), // cab
      glass: box(W - 0.3, 0.7, 0.1, 0, 1.95, L / 2 - 0.1), // windshield
      black: merge([box(W, 0.5, L, 0, 0.6, 0), ...ribs]), // chassis and roll-up door ribs
      cargo: box(W, 2.4, L - 2.4, 0, 2.05, -1.2),
      door: box(W - 0.4, 2.0, 0.06, 0, 2.0, -L / 2 + 1.2 - 0.02)
    };
  } else {
    // Body-coloured lower, roof slab and corner pillars so the glass reads as windows, not a black block
    const body = [box(W, 0.7, L, 0, 0.65, 0), box(W - 0.1, 0.1, 2.6, 0, 1.62, -0.2)];
    [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => body.push(box(0.1, 0.7, 0.12, sx * (W / 2 - 0.1), 1.27, -0.2 + sz * 1.25))));
    // Black bumpers
    const black = [box(W + 0.05, 0.2, 0.15, 0, 0.4, L / 2), box(W + 0.05, 0.2, 0.15, 0, 0.4, -L / 2)];
    if (type === 'taxi') {
      // Checkerboard strip along both sides of the body and a stripe under the sign
      for (let i = 0; i < 5; i += 2) {
        [-1, 1].forEach((side) => black.push(box(0.02, 0.1, 0.1, side * (W / 2 + 0.01), 0.82, -1.0 + i * 0.5)));
      }
      black.push(box(0.84, 0.06, 0.38, 0, 1.62, -0.2));
    }
    geos = {
      ...common,
      body: merge(body),
      glass: box(W - 0.2, 0.65, 2.5, 0, 1.25, -0.2),
      black: merge(black),
      sign: type === 'taxi' ? box(0.8, 0.22, 0.34, 0, 1.7, -0.2) : undefined
    };
  }
  geoCache.set(type, geos);
  return geos;
}

export const HEAD_NORMAL = 0xffffcc;
export const TAIL_NORMAL = 0x661111;
export const TAIL_BRAKE = 0xff2222;

export class TrafficCar {
  public group = new THREE.Group();
  public type: CarType;
  public length: number;
  public width: number;
  public height: number;
  public speed = 0; // forward speed along the car's own +z axis
  public dir = 1; // world z direction of travel
  public baseX = 0;
  public baseY = 0;
  public launched = false;

  private grounded = false;
  private wheels: THREE.Group[] = [];
  private fadeMats: THREE.Material[] = [];
  private fade = 1;
  private headMats: THREE.MeshBasicMaterial[] = [];
  private tailMats: THREE.MeshBasicMaterial[] = [];
  private swayPhase = Math.random() * 10;
  private time = 0;

  private velocity = new THREE.Vector3();
  private rotVelocity = new THREE.Vector3();

  constructor(type: CarType, color: number) {
    this.type = type;
    this.length = SPEC[type].length;
    const bodyMat = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.5 });
    const L = this.length;
    const W = SPEC[type].width;
    this.width = W;
    this.height = SPEC[type].height;
    const wheelMat = wheelMatTemplate.clone();
    const blackMat = blackMatTemplate.clone();
    const glassMat = glassMatTemplate.clone();
    const geos = carGeos(type);

    // Static parts are merged per material (shared per car type), so a car costs a handful of draws
    const addPart = (geo: THREE.BufferGeometry, mat: THREE.Material, castShadow = false) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = castShadow;
      this.group.add(m);
    };
    addPart(geos.body, bodyMat, true);
    addPart(geos.black, blackMat);
    addPart(geos.glass, glassMat, type !== 'truck');
    if (geos.cargo) {
      addPart(geos.cargo, new THREE.MeshStandardMaterial({ color: 0xe8e8e8, flatShading: true }), true);
    }
    if (geos.door) {
      addPart(geos.door, new THREE.MeshStandardMaterial({ color: 0xb0b4b8, flatShading: true }));
    }
    if (geos.sign) {
      addPart(geos.sign, new THREE.MeshStandardMaterial({ color: 0xffffe0, flatShading: true, emissive: 0x554400 }));
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

    // Head & tail lights: one merged mesh and one material each
    const hMat = new THREE.MeshBasicMaterial({ color: HEAD_NORMAL });
    this.group.add(new THREE.Mesh(geos.headLights, hMat));
    this.headMats.push(hMat);
    const tMat = new THREE.MeshBasicMaterial({ color: TAIL_NORMAL });
    this.group.add(new THREE.Mesh(geos.tailLights, tMat));
    this.tailMats.push(tMat);

    // Every material this car owns, so the whole car can fade at once
    const mats = new Set<THREE.Material>();
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) mats.add(o.material as THREE.Material);
    });
    this.fadeMats = [...mats];
    // Always transparent so fading never flips the OPAQUE shader define (no recompile hitch). Depth writes stay on
    // so overlapping wheels, cabin and body keep depth ordering instead of ghosting through each other.
    this.fadeMats.forEach((m) => {
      m.transparent = true;
      m.depthWrite = true;
    });
  }

  /** 1 = solid, lower = see-through (used when the car sweeps right past the camera). */
  public setFade(opacity: number) {
    if (Math.abs(opacity - this.fade) < 0.01) return;
    this.fade = opacity;
    this.fadeMats.forEach((m) => (m.opacity = opacity));
  }

  public place(x: number, z: number, dir: 1 | -1) {
    this.baseX = x;
    this.dir = dir;
    this.group.position.set(x, this.baseY, z);
    this.group.rotation.set(0, dir > 0 ? 0 : Math.PI, 0);
  }

  /** Move along the lane and spin wheels. */
  public drive(dt: number) {
    this.time += dt;
    this.group.position.z += this.dir * this.speed * dt;
    const spin = (this.speed * dt) / WHEEL_RADIUS;
    this.wheels.forEach((w) => (w.rotation.x += spin));
    if (this.speed > 0.5) this.group.rotation.z = Math.sin(this.time * 1.7 + this.swayPhase) * 0.01;
  }

  public setLights(head: number, tail: number) {
    this.headMats.forEach((m) => m.color.setHex(head));
    this.tailMats.forEach((m) => m.color.setHex(tail));
  }

  public launch(awayX: number) {
    if (this.launched) return;
    this.launched = true;
    // Mostly vertical and along the street so cars do not end up inside the facades
    this.velocity.set(awayX * (1 + Math.random() * 2), 14 + Math.random() * 8, (Math.random() - 0.5) * 16);
    this.rotVelocity.set(Math.random() * 3 - 1.5, Math.random() * 3 - 1.5, Math.random() * 4 - 2);
  }

  public stepTumble(dt: number) {
    const p = this.group.position;
    const r = this.group.rotation;
    p.addScaledVector(this.velocity, dt);
    this.velocity.y -= 16 * dt;
    r.x += this.rotVelocity.x * dt;
    r.y += this.rotVelocity.y * dt;
    r.z += this.rotVelocity.z * dt;
    // Keep the yaw-rotated footprint inside the facades (|x| = 13) and the end caps (|z| = 81)
    const c = Math.abs(Math.cos(r.y));
    const s = Math.abs(Math.sin(r.y));
    const xLimit = Math.max(0, FACADE_X - 0.2 - (c * this.width + s * this.length) / 2);
    const zLimit = END_Z - 0.5 - (c * this.length + s * this.width) / 2;
    if (Math.abs(p.x) > xLimit) {
      p.x = Math.sign(p.x) * xLimit;
      this.velocity.x *= -0.4;
    }
    if (Math.abs(p.z) > zLimit) {
      p.z = Math.sign(p.z) * zLimit;
      this.velocity.z *= -0.4;
    }
    // Lowest point of the tilted body (origin is at wheel level), so it rests on the asphalt instead of sinking in
    let lowest = 0;
    const W = this.width / 2;
    const L = this.length / 2;
    for (let i = 0; i < 8; i++) {
      tmp.set(i & 1 ? W : -W, i & 2 ? this.height : 0, i & 4 ? L : -L).applyEuler(r);
      lowest = Math.min(lowest, tmp.y);
    }
    // Sidewalks (|x| >= 7) sit 0.30 above the road
    const floor = this.baseY + (Math.abs(p.x) < 7 ? 0 : SIDEWALK_Y) - lowest;
    if (p.y <= floor && this.velocity.y < 0) {
      p.y = floor;
      this.velocity.y = Math.abs(this.velocity.y) < 1 ? 0 : this.velocity.y * -0.3;
      const damp = Math.exp(-CONTACT_DAMP * dt);
      this.velocity.x *= damp;
      this.velocity.z *= damp;
      this.rotVelocity.multiplyScalar(damp);
      // Only start settling upright once the bounce has died down
      if (Math.abs(this.velocity.y) < 2) this.grounded = true;
    }
    if (this.grounded) {
      // Settle upright: unwrap the accumulated tilt, then ease roll and pitch to zero
      const k = 1 - Math.exp(-10 * dt);
      r.x -= Math.round(r.x / (Math.PI * 2)) * Math.PI * 2;
      r.z -= Math.round(r.z / (Math.PI * 2)) * Math.PI * 2;
      r.x -= r.x * k;
      r.z -= r.z * k;
    }
  }

  public reset(x: number, z: number) {
    this.launched = false;
    this.grounded = false;
    this.velocity.set(0, 0, 0);
    this.rotVelocity.set(0, 0, 0);
    this.place(x, z, this.dir as 1 | -1);
    this.setLights(HEAD_NORMAL, TAIL_NORMAL);
    this.setFade(1);
  }
}
