import * as THREE from 'three';
/* -------------------------------------------------------------------------- */
/*  Seeded PRNG                                                               */
/* -------------------------------------------------------------------------- */
/** Small, fast seeded PRNG (mulberry32). Returns floats in [0, 1). */
export function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/** A fresh, unpredictable 32-bit seed (new layout every page load / restart). */
export function randomSeed() {
    return ((Math.random() * 0x100000000) ^ Math.floor(performance.now() * 1000)) >>> 0;
}
function makeRand(seed) {
    const f = mulberry32(seed);
    return {
        f,
        range: (a, b) => a + (b - a) * f(),
        int: (a, b) => Math.floor(a + (b - a + 1) * f()),
        pick: (arr) => arr[Math.floor(f() * arr.length)],
        chance: (p) => f() < p
    };
}
/* -------------------------------------------------------------------------- */
/*  Shared geometry / materials (never disposed; reused across regenerations)  */
/* -------------------------------------------------------------------------- */
const GEO = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
    taper: new THREE.CylinderGeometry(0.72, 1, 1, 6),
    tri: new THREE.CylinderGeometry(1, 1, 1, 3), // triangular prism, tip points +z
    cone: new THREE.ConeGeometry(1, 1, 8),
    ico: new THREE.IcosahedronGeometry(1, 0)
};
const MAT_STD = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true });
const MAT_WIN = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.2, flatShading: true });
const MAT_FLAT = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
/** Collects instances for one geometry/material pair and bakes them into a single InstancedMesh. */
class Batch {
    name;
    geo;
    mat;
    cast;
    receive;
    mats = [];
    cols = [];
    constructor(name, geo, mat, cast, receive) {
        this.name = name;
        this.geo = geo;
        this.mat = mat;
        this.cast = cast;
        this.receive = receive;
    }
    add(m, c) {
        m.toArray(this.mats, this.mats.length);
        this.cols.push(c.r, c.g, c.b);
    }
    build() {
        const n = this.cols.length / 3;
        if (n === 0)
            return null;
        const mesh = new THREE.InstancedMesh(this.geo, this.mat, n);
        mesh.name = this.name;
        mesh.instanceMatrix.array.set(this.mats);
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.cols), 3);
        mesh.castShadow = this.cast;
        mesh.receiveShadow = this.receive;
        mesh.computeBoundingSphere();
        mesh.computeBoundingBox();
        return mesh;
    }
}
class Builder {
    box = new Batch('proc-solid', GEO.box, MAT_STD, true, true);
    flat = new Batch('proc-flat', GEO.box, MAT_FLAT, false, true);
    win = new Batch('proc-windows', GEO.box, MAT_WIN, false, false);
    cyl = new Batch('proc-cyl', GEO.cyl, MAT_STD, true, true);
    taper = new Batch('proc-taper', GEO.taper, MAT_STD, true, true);
    tri = new Batch('proc-tri', GEO.tri, MAT_FLAT, false, true);
    cone = new Batch('proc-cone', GEO.cone, MAT_STD, true, true);
    ico = new Batch('proc-foliage', GEO.ico, MAT_STD, true, true);
    m = new THREE.Matrix4();
    p = new THREE.Vector3();
    q = new THREE.Quaternion();
    s = new THREE.Vector3();
    e = new THREE.Euler();
    c = new THREE.Color();
    all() {
        return [this.box, this.flat, this.win, this.cyl, this.taper, this.tri, this.cone, this.ico];
    }
    put(b, x, y, z, sx, sy, sz, col, rx = 0, ry = 0, rz = 0) {
        this.e.set(rx, ry, rz);
        this.q.setFromEuler(this.e);
        this.p.set(x, y, z);
        this.s.set(sx, sy, sz);
        this.m.compose(this.p, this.q, this.s);
        if (typeof col === 'number')
            this.c.setHex(col);
        else
            this.c.copy(col);
        b.add(this.m, this.c);
    }
}
/* -------------------------------------------------------------------------- */
/*  Palettes                                                                  */
/* -------------------------------------------------------------------------- */
const PALETTES = [
    [0xe89369, 0xb85d38, 0x61829e, 0xd4a754, 0xd07c60, 0x4d6c7b], // original warm/cool mix
    [0xe8d5b5, 0xd9b99b, 0xc98f7a, 0xa9744f, 0x8c5a44, 0xf0e2c8], // sandstone
    [0x7f9bb0, 0x9eb6c4, 0x5d7a8c, 0xb7c7cf, 0x3f5566, 0x8aa6a3], // cool modern
    [0xf2c4a8, 0xe8a0a0, 0xa8d0c0, 0xf0e0a0, 0xb8b0e0, 0x9fc7e8], // pastel
    [0xb36a4a, 0x9a4a32, 0x7d3b2c, 0xc47e55, 0x6e4a3d, 0xd29a6a] // brick
];
const TRIMS = [0xe9e2d0, 0xcfc6b0, 0x3a3a3c, 0x5b5a58, 0xf3efe4, 0x8a7f6a, 0x2f3d4a];
const ROOFS = [0x5c5f63, 0x6b6257, 0x4a4d50, 0x7a6e60, 0x3f4448];
const GLASS = [0x243e56, 0x2e4a63, 0x1f3447, 0x35566f, 0x3b5260, 0x2a4a5e];
const WARM = [0xffe9a8, 0xf6d98b, 0xffd27a];
const SHOP_PLATES = [0x2f4b3a, 0x2b3a55, 0x6b2b2b, 0x3a3a3c, 0x8a6a2b, 0x234c4f, 0x5a3b5e];
const FASCIAS = [0xf2c14e, 0xe46a4a, 0xf5f0e1, 0x4aa3b5, 0x9ad06a, 0xe9889b, 0x6a8fe0];
const AWNINGS = [
    [0xc8402e, 0xf5efe0],
    [0x2f7d4f, 0xf1ead2],
    [0x2f5da8, 0xf5f5f5],
    [0xe3a82b, 0xf8f3e0],
    [0xd9692b, 0xd9692b],
    [0x6b3fa0, 0xe8dcf0]
];
const FOLIAGE = [0x4e8d3e, 0x3f7a35, 0x5fa047, 0x6aa84f, 0x2f6b3a, 0x7cb342];
const AUTUMN = [0xc9822b, 0xb5532a, 0xd9a13b];
const PINE = [0x2f6b3a, 0x275b33, 0x3a7a45];
const BG_TONES = [0x8ea6c0, 0x9db3c9, 0x7f97b3, 0xa9bacb, 0x93a7a0, 0x8d9db5];
const BILLBOARDS = [0xe5484d, 0xf2c14e, 0x4aa3b5, 0xf5f0e1, 0x7d5ba6, 0x5bbf7a];
const SW = 0.3; // sidewalk top height
const STREET_HALF = 80;
const tone = (hex, l, s = 0) => new THREE.Color(hex).offsetHSL(0, s, l);
/* -------------------------------------------------------------------------- */
/*  ProceduralCity                                                            */
/* -------------------------------------------------------------------------- */
/**
 * Seeded procedural street environment: building facades, street furniture,
 * trees, road markings and a distant skyline. Call generate(seed) / reseed()
 * to rebuild (old meshes and building colliders are disposed first).
 *
 * Hard layout rules (gameplay): road |x|<=7 at y=0, sidewalks |x| 7..13 at y=0.3,
 * buildings start at |x|>=13, street length z in [-80, 80].
 */
export class ProceduralCity {
    physics;
    group = new THREE.Group();
    seed = 0;
    handles = [];
    meshes = [];
    // per-generation state
    R;
    B;
    mainPalette = PALETTES[0];
    curb = [[], []];
    wall = [[], []];
    noAwning = [[], []];
    constructor(physics, seed = randomSeed()) {
        this.physics = physics;
        this.group.name = 'ProceduralCity';
        this.generate(seed);
    }
    /** Rebuild with a brand new random seed. */
    reseed() {
        this.generate(randomSeed());
        return this.seed;
    }
    /** Remove all generated meshes and building colliders. */
    clear() {
        for (const h of this.handles)
            this.physics.removeCollider(h);
        this.handles.length = 0;
        for (const m of this.meshes) {
            this.group.remove(m);
            m.dispose();
        }
        this.meshes.length = 0;
    }
    generate(seed) {
        this.clear();
        this.seed = seed >>> 0;
        this.R = makeRand(this.seed);
        this.B = new Builder();
        this.mainPalette = this.R.pick(PALETTES);
        this.curb = [[], []];
        this.wall = [[], []];
        this.noAwning = [[], []];
        this.buildRoadDetails();
        this.buildBusStop();
        this.buildTrees();
        this.buildLamps();
        this.buildHydrants();
        this.buildSigns();
        this.buildTrashCans();
        this.buildBenches();
        this.buildBuildings();
        this.buildSkyline();
        for (const b of this.B.all()) {
            const mesh = b.build();
            if (mesh) {
                this.group.add(mesh);
                this.meshes.push(mesh);
            }
        }
    }
    /* ------------------------------ helpers -------------------------------- */
    reserveNear(list, z, half, tries = 3, shift = 2.5) {
        for (let i = 0; i < tries; i++) {
            const zz = z + i * shift;
            if (zz + half > STREET_HALF - 1 || zz - half < -STREET_HALF + 1)
                continue;
            if (list.some(([a, b]) => zz + half > a && zz - half < b))
                continue;
            list.push([zz - half, zz + half]);
            return zz;
        }
        return null;
    }
    faceBox(b, axis, n, face, depth, thick, along, y, alongLen, h, col) {
        const perp = face + n * depth;
        if (axis === 'x')
            this.B.put(b, perp, y, along, thick, h, alongLen, col);
        else
            this.B.put(b, along, y, perp, alongLen, h, thick, col);
    }
    /* ----------------------------- road details ----------------------------- */
    buildRoadDetails() {
        const { B, R } = this;
        const white = 0xe8e8e0;
        // Solid white edge lines near the curbs
        [-1, 1].forEach((s) => B.put(B.flat, s * 6.55, 0.012, 0, 0.14, 0.024, 158, white));
        // Asphalt patches (subtle tone variation)
        for (let i = 0, n = R.int(3, 5); i < n; i++) {
            B.put(B.flat, R.range(-4.8, 4.8), 0.006, R.range(-72, 72), R.range(1.2, 3), 0.012, R.range(2, 5), R.pick([0x1a1c20, 0x2a2d32, 0x2d3036]));
        }
        // Crosswalks, placed midway between the parked cars (z = -42,-22,-2,18,38)
        const mids = [-52, -32, -12, 8, 28, 48];
        for (let i = mids.length - 1; i > 0; i--) {
            const j = Math.floor(R.f() * (i + 1));
            [mids[i], mids[j]] = [mids[j], mids[i]];
        }
        const crosswalks = [];
        for (let i = 0, n = R.int(2, 4); i < n; i++) {
            const zc = mids[i] + R.range(-3.2, 3.2);
            crosswalks.push(zc);
            for (let k = 0; k < 6; k++) {
                [-1, 1].forEach((sg) => B.put(B.flat, sg * (0.9 + k), 0.016, zc, 0.55, 0.032, 3.0, white));
            }
            // stop lines (northbound lane x<0 stops south of the crossing, southbound lane x>0 stops north)
            B.put(B.flat, -3.45, 0.014, zc - 2.5, 5.9, 0.028, 0.35, white);
            B.put(B.flat, 3.45, 0.014, zc + 2.5, 5.9, 0.028, 0.35, white);
        }
        const nearCross = (z, d) => crosswalks.some((c) => Math.abs(c - z) < d);
        // Lane arrows (x=-2.8 drives toward +z, x=+2.8 toward -z)
        [-2.8, 2.8].forEach((lx) => {
            const d = lx < 0 ? 1 : -1;
            const used = [];
            for (let t = 0, placed = 0; t < 14 && placed < R.int(3, 4); t++) {
                const z = R.range(-68, 68);
                if (nearCross(z, 7) || used.some((u) => Math.abs(u - z) < 12))
                    continue;
                used.push(z);
                placed++;
                B.put(B.flat, lx, 0.013, z - d * 0.2, 0.26, 0.026, 1.6, 0xd8d8d0);
                B.put(B.tri, lx, 0.013, z + d * 0.875, 0.55, 0.026, 0.55, 0xd8d8d0, 0, d < 0 ? Math.PI : 0, 0);
            }
        });
        // Manholes
        for (let i = 0, n = R.int(4, 6); i < n; i++) {
            const x = R.range(-4.6, 4.6);
            const z = R.range(-72, 72);
            if (nearCross(z, 4.5))
                continue;
            B.put(B.cyl, x, 0.015, z, 0.58, 0.03, 0.58, 0x2d3035);
            B.put(B.cyl, x, 0.022, z, 0.46, 0.03, 0.46, 0x4a4f57);
        }
    }
    /* ------------------------------ street props ----------------------------- */
    buildBusStop() {
        const { B, R } = this;
        const s = R.chance(0.5) ? -1 : 1;
        const si = s < 0 ? 0 : 1;
        const z = this.reserveNear(this.wall[si], R.range(-48, 48), 2.2, 6, 4);
        if (z === null)
            return;
        this.noAwning[si].push([z - 2.4, z + 2.4]);
        this.curb[si].push([z - 0.7, z + 0.7]);
        const frame = 0x3b4046;
        const roofC = 0x2f3a46;
        // Glass back panel, roof, posts
        B.put(B.win, s * 12.9, SW + 1.2, z, 0.06, 2.4, 3.2, 0x6f9fb8);
        B.put(B.box, s * 12.4, SW + 2.55, z, 1.1, 0.1, 3.6, roofC);
        [-1.65, 1.65].forEach((dz) => {
            B.put(B.box, s * 11.95, SW + 1.25, z + dz, 0.08, 2.5, 0.08, frame);
            B.put(B.box, s * 12.88, SW + 1.25, z + dz, 0.1, 2.5, 0.1, frame);
        });
        // Advert panel on the back + small bench inside
        B.put(B.box, s * 12.84, SW + 1.35, z - 0.7, 0.05, 1.5, 1.0, R.pick(BILLBOARDS));
        this.addBench(s, z + 0.35, 1.5);
        // Curb stop sign
        const px = s * 7.5;
        B.put(B.taper, px, SW + 1.6, z, 0.045, 3.2, 0.045, 0x777b80);
        B.put(B.cyl, px, SW + 3.0, z, 0.32, 0.04, 0.32, 0xf5f5f5, Math.PI / 2, 0, 0);
        B.put(B.cyl, px, SW + 3.0, z, 0.27, 0.05, 0.27, 0x1f5fbf, Math.PI / 2, 0, 0);
        B.put(B.box, px, SW + 2.45, z, 0.04, 0.4, 0.3, 0xf5f0e1);
    }
    addTree(s, z) {
        const { B, R } = this;
        const x = s * 7.8;
        const y0 = SW;
        const kind = R.f();
        const tr = R.range(0.19, 0.28);
        const autumn = R.chance(0.08);
        const base = autumn ? R.pick(AUTUMN) : R.pick(FOLIAGE);
        const trunkCol = R.pick([0x5a3d28, 0x4e3524, 0x6a4a30]);
        B.put(B.cyl, x, y0 + 0.015, z, 0.62, 0.03, 0.62, 0x4a3b2e); // tree pit
        if (kind < 0.62) {
            // Round broadleaf
            const rad = R.range(1.15, 1.9);
            const ry = rad * R.range(0.85, 1.15);
            const cy = 2.5 + 0.95 * ry + R.range(0, 0.7);
            const trunkH = cy - 0.5 * ry;
            B.put(B.taper, x, y0 + trunkH / 2, z, tr, trunkH, tr, trunkCol);
            B.put(B.ico, x, y0 + cy, z, rad, ry, rad, tone(base, 0), R.range(0, 3), R.range(0, 3), 0);
            for (let i = 0, n = R.int(1, 2); i < n; i++) {
                const a = R.range(0, Math.PI * 2);
                const rr = rad * R.range(0.55, 0.7);
                B.put(B.ico, x + Math.cos(a) * rad * 0.65, y0 + cy + rad * R.range(0.15, 0.4), z + Math.sin(a) * rad * 0.65, rr, rr, rr, tone(base, R.range(-0.04, 0.05)), R.range(0, 3), R.range(0, 3), 0);
            }
        }
        else if (kind < 0.82) {
            // Tall oval
            const rx = R.range(0.9, 1.3);
            const ry = rx * R.range(1.5, 1.9);
            const cy = 2.5 + 0.95 * ry + R.range(0, 0.4);
            const trunkH = cy - 0.5 * ry;
            B.put(B.taper, x, y0 + trunkH / 2, z, tr, trunkH, tr, trunkCol);
            B.put(B.ico, x, y0 + cy, z, rx, ry, rx, tone(base, 0), 0, R.range(0, 3), 0);
        }
        else {
            // Pine / cone tree
            const pc = R.pick(PINE);
            const rb = R.range(1.2, 1.6);
            const h1 = R.range(2.2, 2.8);
            const baseY = y0 + 2.5;
            B.put(B.taper, x, y0 + (2.5 + 1.5) / 2, z, tr, 4.0, tr, trunkCol);
            B.put(B.cone, x, baseY + h1 / 2, z, rb, h1, rb, tone(pc, 0));
            B.put(B.cone, x, baseY + 1.3 + 0.9, z, rb * 0.72, 1.9, rb * 0.72, tone(pc, 0.03));
        }
    }
    buildTrees() {
        const { R } = this;
        [-1, 1].forEach((s) => {
            const si = s < 0 ? 0 : 1;
            let z = -72 + R.range(0, 6);
            while (z < 74) {
                const zz = this.reserveNear(this.curb[si], z, 2.2, 2, 3);
                if (zz !== null)
                    this.addTree(s, zz);
                z += R.range(13, 21);
            }
        });
    }
    buildLamps() {
        const { B, R } = this;
        const poleCol = R.pick([0x2f3b36, 0x2b2e33, 0x1f2326, 0x3b4a58]);
        const headCol = new THREE.Color(0xfff1b8);
        [-1, 1].forEach((s) => {
            const si = s < 0 ? 0 : 1;
            let z = -70 + R.range(0, 8);
            while (z < 74) {
                const zz = this.reserveNear(this.curb[si], z, 0.5, 4, 2.5);
                if (zz !== null) {
                    const x = s * 7.4;
                    B.put(B.cyl, x, SW + 0.17, zz, 0.16, 0.34, 0.16, poleCol);
                    B.put(B.taper, x, SW + 2.8, zz, 0.09, 5.6, 0.09, poleCol);
                    B.put(B.box, s * 6.85, SW + 5.58, zz, 1.2, 0.09, 0.09, poleCol);
                    B.put(B.box, s * 6.3, SW + 5.5, zz, 0.55, 0.12, 0.3, headCol);
                }
                z += R.range(16, 23);
            }
        });
    }
    buildHydrants() {
        const { B, R } = this;
        [-1, 1].forEach((s) => {
            const si = s < 0 ? 0 : 1;
            for (let i = 0, n = R.int(1, 3); i < n; i++) {
                const z = this.reserveNear(this.curb[si], R.range(-70, 70), 0.8, 4, 3);
                if (z === null)
                    continue;
                const x = s * 7.45;
                const c = R.pick([0xc0392b, 0xe0b020, 0xd9692b, 0xc0392b]);
                B.put(B.cyl, x, SW + 0.03, z, 0.21, 0.06, 0.21, 0x55595c);
                B.put(B.cyl, x, SW + 0.3, z, 0.16, 0.5, 0.16, c);
                B.put(B.cyl, x, SW + 0.58, z, 0.12, 0.12, 0.12, c);
                B.put(B.box, x, SW + 0.36, z, 0.1, 0.1, 0.46, tone(c, -0.08));
            }
        });
    }
    buildSigns() {
        const { B, R } = this;
        for (let i = 0, n = R.int(3, 5); i < n; i++) {
            const s = R.chance(0.5) ? -1 : 1;
            const si = s < 0 ? 0 : 1;
            const z = this.reserveNear(this.curb[si], R.range(-72, 72), 0.5, 4, 3);
            if (z === null)
                continue;
            const x = s * 7.5;
            const poleH = 3.0;
            B.put(B.taper, x, SW + poleH / 2, z, 0.04, poleH, 0.04, 0x777b80);
            const kind = R.int(0, 3);
            const py = SW + poleH - 0.3;
            if (kind === 0) {
                // stop sign (octagon facing along z)
                B.put(B.cyl, x, py, z, 0.36, 0.04, 0.36, 0xf5f5f5, Math.PI / 2, Math.PI / 8, 0);
                B.put(B.cyl, x, py, z, 0.31, 0.06, 0.31, 0xc0261f, Math.PI / 2, Math.PI / 8, 0);
            }
            else if (kind === 1) {
                // street name blades
                B.put(B.box, x, py + 0.12, z, 0.05, 0.22, 0.95, 0x1f6b3f);
                B.put(B.box, x, py - 0.16, z, 0.95, 0.22, 0.05, 0x1f6b3f);
            }
            else if (kind === 2) {
                // no-parking / info plate
                B.put(B.box, x, py, z, 0.05, 0.6, 0.45, 0x1f5fbf);
                B.put(B.box, x, py + 0.08, z, 0.06, 0.3, 0.3, 0xf5f5f5);
            }
            else {
                // one-way arrow plate
                B.put(B.box, x, py, z, 0.05, 0.3, 0.8, 0x1d1f22);
                B.put(B.box, x, py, z, 0.06, 0.08, 0.55, 0xf5f5f5);
            }
        }
    }
    buildTrashCans() {
        const { B, R } = this;
        [-1, 1].forEach((s) => {
            const si = s < 0 ? 0 : 1;
            for (let i = 0, n = R.int(1, 3); i < n; i++) {
                const atWall = R.chance(0.6);
                const list = atWall ? this.wall[si] : this.curb[si];
                const z = this.reserveNear(list, R.range(-70, 70), 0.55, 4, 3);
                if (z === null)
                    continue;
                const x = s * (atWall ? 12.55 : 7.55);
                const c = R.pick([0x3d5a3f, 0x55595c, 0x2f4b6e, 0x3a3a3c]);
                B.put(B.cyl, x, SW + 0.43, z, 0.27, 0.86, 0.27, c);
                B.put(B.cyl, x, SW + 0.9, z, 0.3, 0.08, 0.3, tone(c, -0.08));
                B.put(B.box, x, SW + 0.62, z, 0.56, 0.06, 0.56, tone(c, 0.06));
            }
        });
    }
    addBench(s, z, len) {
        const { B, R } = this;
        const c = R.pick([0x8a5a33, 0x6b8e5a, 0x5e7183, 0xa07a4a]);
        B.put(B.box, s * 12.52, SW + 0.45, z, 0.5, 0.07, len, c);
        B.put(B.box, s * 12.76, SW + 0.78, z, 0.06, 0.4, len, tone(c, -0.04));
        [-1, 1].forEach((d) => B.put(B.box, s * 12.55, SW + 0.22, z + d * (len / 2 - 0.15), 0.4, 0.45, 0.07, 0x3a3d40));
    }
    buildBenches() {
        const { R } = this;
        [-1, 1].forEach((s) => {
            const si = s < 0 ? 0 : 1;
            for (let i = 0, n = R.int(1, 3); i < n; i++) {
                const len = R.range(1.4, 1.9);
                const z = this.reserveNear(this.wall[si], R.range(-68, 68), len / 2 + 0.3, 4, 3);
                if (z !== null)
                    this.addBench(s, z, len);
            }
        });
    }
    /* -------------------------------- windows ------------------------------- */
    makeStyle() {
        const { R } = this;
        const pattern = R.int(0, 5);
        const floorH = R.range(3.4, 4.4);
        let winW = R.range(1.2, 1.6);
        let winH = R.range(1.7, 2.1);
        let pitch = winW + R.range(1.0, 1.7);
        let groupGap = 1.5;
        if (pattern === 1) {
            pitch = R.range(3.0, 4.2);
            winW = pitch * 0.84;
            winH = R.range(1.3, 1.6);
        }
        else if (pattern === 2) {
            winW = R.range(1.0, 1.3);
            groupGap = R.range(1.2, 1.9);
        }
        else if (pattern === 3) {
            winW = R.range(0.8, 1.0);
            winH = floorH * 0.72;
            pitch = winW + R.range(0.9, 1.2);
        }
        else if (pattern === 4) {
            winW = R.range(1.3, 1.7);
        }
        return {
            pattern,
            floorH,
            winW,
            winH,
            pitch,
            groupGap,
            lit: R.range(0.04, 0.2),
            sill: R.chance(0.45),
            belt: R.chance(0.5),
            glass: R.chance(0.5) ? GLASS : [R.pick(GLASS), R.pick(GLASS)],
            trim: R.pick(TRIMS)
        };
    }
    /** Window grid on a wall plane. axis 'x': wall faces along x (windows spread along z). */
    addWindows(axis, n, face, c, len, yA, yB, st, margin = 1.3) {
        const { B, R } = this;
        const usable = len - margin * 2;
        if (usable < st.winW)
            return;
        const cols = [];
        let p = -usable / 2 + st.winW / 2;
        for (let idx = 0; p <= usable / 2 - st.winW / 2 + 1e-6; idx++) {
            cols.push(p);
            p += st.pattern === 2 ? (idx % 2 === 0 ? st.winW + 0.25 : st.winW + st.groupGap) : st.pitch;
        }
        if (st.pattern === 5) {
            for (let ci = 3; ci < cols.length; ci += 4) {
                const o = (cols[ci - 1] + cols[ci]) / 2;
                const top = yB - 0.7;
                this.faceBox(B.box, axis, n, face, 0.07, 0.14, c + o, (yA + top) / 2, 0.35, top - yA, st.trim);
            }
        }
        let row = 0;
        for (let yc = yA + st.floorH * 0.55; yc + st.winH / 2 <= yB - 0.9; yc += st.floorH, row++) {
            for (let ci = 0; ci < cols.length; ci++) {
                if (st.pattern === 4 && (ci + row) % 2 === 1)
                    continue;
                const col = R.f() < st.lit ? R.pick(WARM) : R.pick(st.glass);
                this.faceBox(B.win, axis, n, face, 0.03, 0.12, c + cols[ci], yc, st.winW, st.winH, col);
                if (st.sill) {
                    this.faceBox(B.box, axis, n, face, 0.1, 0.28, c + cols[ci], yc - st.winH / 2 - 0.05, st.winW + 0.3, 0.1, st.trim);
                }
            }
            if (st.belt && row > 0 && row % 3 === 0 && axis === 'x') {
                this.faceBox(B.box, axis, n, face, 0.1, 0.22, c, yA + row * st.floorH, len + 0.1, 0.22, st.trim);
            }
        }
    }
    /* -------------------------------- buildings ----------------------------- */
    buildBuildings() {
        const { R } = this;
        [-1, 1].forEach((s) => {
            let z = -STREET_HALF;
            while (z < STREET_HALF - 0.5) {
                let slot = R.range(11, 24);
                const remaining = STREET_HALF - z;
                if (remaining - slot < 10)
                    slot = remaining; // last building fills to z = 80
                const gap = Math.min(R.range(0.6, 1.2), slot * 0.2);
                this.addBuilding(s, z, slot, gap);
                z += slot;
            }
        });
    }
    addBuilding(s, zStart, slot, gap) {
        const { B, R } = this;
        const n = -s; // direction from facade toward the street
        const si = s < 0 ? 0 : 1;
        const depth = slot - gap;
        const zc = zStart + slot / 2;
        const W = R.range(11, 19);
        const cat = R.f();
        const H = cat < 0.3 ? R.range(13, 24) : cat < 0.75 ? R.range(24, 40) : R.range(40, 62);
        const baseHex = R.pick(R.chance(0.78) ? this.mainPalette : R.pick(PALETTES));
        const trim = R.pick(TRIMS);
        const roofHex = R.pick(ROOFS);
        const style = this.makeStyle();
        style.trim = trim;
        const nTiers = H < 22 ? 1 : H < 36 ? (R.chance(0.5) ? 2 : 1) : R.chance(0.35) ? 1 : R.chance(0.55) ? 2 : 3;
        const tops = [];
        if (nTiers === 1)
            tops.push(H);
        else {
            const t0 = Math.max(10, H * R.range(0.4, 0.6));
            tops.push(t0);
            if (nTiers === 3)
                tops.push(t0 + (H - t0) * R.range(0.4, 0.6));
            tops.push(H);
        }
        const shopH = R.range(4.6, 5.4);
        const xmax = 13 + W;
        let f = 0; // cumulative street-side setback
        let za = zc - depth / 2;
        let zb = zc + depth / 2;
        let y0 = 0;
        let lastRoof = { xmin: 13, za, zb, y: H };
        for (let k = 0; k < tops.length; k++) {
            if (k > 0) {
                const sb = Math.min(R.range(1.4, 3.0), Math.max(0, W - f - 7));
                f += sb;
                if (zb - za > 11) {
                    za += R.range(0, 2.2);
                    zb -= R.range(0, 2.2);
                }
            }
            const y1 = tops[k];
            const xmin = 13 + f;
            const face = s * xmin;
            const sx = xmax - xmin;
            const sz = zb - za;
            const cx = s * (xmin + xmax) / 2;
            const cy = (y0 + y1) / 2;
            const cz = (za + zb) / 2;
            const sy = y1 - y0;
            B.put(B.box, cx, cy, cz, sx, sy, sz, tone(baseHex, k * -0.025 + (R.f() - 0.5) * 0.02));
            this.handles.push(this.physics.createBoxCollider(new THREE.Vector3(cx, cy, cz), new THREE.Vector3(sx / 2, sy / 2, sz / 2)));
            // Cornice (front band + two side lips), roof membrane
            const ch = R.range(0.45, 0.9);
            B.put(B.box, s * (xmin + 0.05), y1 - ch / 2 + 0.04, cz, 0.8, ch, sz + 0.4, trim);
            [za, zb].forEach((zz, i) => {
                const dir = i === 0 ? -1 : 1;
                B.put(B.box, s * ((xmin - 0.2 + xmax) / 2), y1 - ch * 0.4 + 0.04, zz + dir * 0.08, sx + 0.2, ch * 0.8, 0.36, trim);
            });
            if (R.chance(0.5)) {
                this.faceBox(B.box, 'x', n, face, 0.12, 0.24, cz, y1 - ch - 0.3, sz + 0.1, 0.2, tone(trim, -0.06));
            }
            B.put(B.box, s * ((xmin + 0.4 + xmax - 0.3) / 2), y1 + 0.015, cz, sx - 0.7, 0.03, sz - 0.4, roofHex);
            // Corner pilasters
            if (k === 0 ? R.chance(0.55) : R.chance(0.3)) {
                const yb = k === 0 ? SW : y0;
                const top = y1 - ch;
                [za - 0.04 + 0.27, zb + 0.04 - 0.27].forEach((pz) => {
                    this.faceBox(B.box, 'x', n, face, 0.02, 0.5, pz, (yb + top) / 2, 0.54, top - yb, trim);
                });
            }
            // Windows
            const winStart = k === 0 ? SW + shopH + 0.5 : y0 + 0.5;
            this.addWindows('x', n, face, cz, sz, winStart, y1, style);
            // Shopfront on the ground floor of the lowest tier
            if (k === 0)
                this.addShopfront(s, n, si, face, za, zb, shopH, trim);
            lastRoof = { xmin, za, zb, y: y1 };
            y0 = y1;
        }
        this.addRoofProps(s, W, lastRoof, trim);
    }
    addShopfront(s, n, si, face, za, zb, shopH, trim) {
        const { B, R } = this;
        const sz = zb - za;
        const cz = (za + zb) / 2;
        const plate = R.pick(SHOP_PLATES);
        const fascia = R.pick(FASCIAS);
        // base plate (protrudes 0.2 over the facade)
        this.faceBox(B.box, 'x', n, face, 0.05, 0.3, cz, SW + shopH / 2, sz - 0.12, shopH, plate);
        const nBays = Math.max(1, Math.floor((sz - 1.6) / R.range(3.2, 5.0)));
        const bayW = (sz - 1.6) / nBays;
        const doorBay = R.int(0, nBays - 1);
        const awn = R.chance(0.65) ? R.pick(AWNINGS) : null;
        const striped = R.chance(0.6);
        const paneH = shopH - 1.95;
        for (let i = 0; i < nBays; i++) {
            const zb0 = za + 0.8 + bayW * (i + 0.5);
            this.faceBox(B.win, 'x', n, face, 0.22, 0.1, zb0, SW + 0.85 + paneH / 2, bayW - 0.5, paneH, R.pick(GLASS));
            this.faceBox(B.box, 'x', n, face, 0.3, 0.3, zb0, SW + shopH - 0.45, bayW - 0.3, 0.75, fascia);
            if (i === doorBay) {
                this.faceBox(B.box, 'x', n, face, 0.26, 0.1, zb0 + bayW / 2 - 1.0, SW + 1.15, 1.0, 2.3, tone(plate, 0.12));
            }
            // awning
            const blocked = this.noAwning[si].some(([a, b]) => zb0 + bayW / 2 > a && zb0 - bayW / 2 < b);
            if (awn && !blocked) {
                const L = 1.25;
                const th = 0.38;
                const yA = SW + shopH - 0.85;
                const xA = face + n * 0.2;
                const segs = striped ? Math.max(2, Math.round((bayW - 0.3) / 0.75)) : 1;
                const sw = (bayW - 0.3) / segs;
                for (let g = 0; g < segs; g++) {
                    const gz = zb0 - (bayW - 0.3) / 2 + sw * (g + 0.5);
                    B.put(B.box, xA + n * (L / 2) * Math.cos(th), yA - (L / 2) * Math.sin(th), gz, L, 0.06, sw - 0.01, awn[g % 2], 0, 0, -n * th);
                }
            }
        }
        void trim;
    }
    addRoofProps(s, W, roof, trim) {
        const { B, R } = this;
        const sz = roof.zb - roof.za;
        const xmax = 13 + W;
        const y = roof.y + 0.03;
        const placed = []; // ox, z, radius
        const tryPlace = (r) => {
            for (let t = 0; t < 8; t++) {
                const ox = R.range(roof.xmin + 1.5 + r, xmax - 1.0 - r);
                const z = R.range(roof.za + 1.0 + r, roof.zb - 1.0 - r);
                if (ox < roof.xmin + 1.0 || z < roof.za || z > roof.zb)
                    continue;
                if (placed.some(([px, pz, pr]) => Math.hypot(px - ox, pz - z) < pr + r + 0.3))
                    continue;
                placed.push([ox, z, r]);
                return [ox, z];
            }
            return null;
        };
        if (xmax - roof.xmin < 6 || sz < 6)
            return;
        for (let i = 0, n = R.int(2, 5); i < n; i++) {
            const kind = R.int(0, 6);
            if (kind === 0) {
                // Water tank on stilts
                const r = R.range(1.0, 1.4);
                const pos = tryPlace(r + 0.2);
                if (!pos)
                    continue;
                const [ox, z] = pos;
                const x = s * ox;
                const legH = 1.5;
                const th = R.range(1.8, 2.6);
                [-1, 1].forEach((dx) => [-1, 1].forEach((dz) => B.put(B.box, x + dx * r * 0.7, y + legH / 2, z + dz * r * 0.7, 0.18, legH, 0.18, 0x3a3a3c)));
                B.put(B.cyl, x, y + legH + th / 2, z, r, th, r, R.pick([0x8a6a45, 0x9aa5ad, 0x7a5a3a]));
                B.put(B.cyl, x, y + legH + th * 0.3, z, r * 1.03, 0.1, r * 1.03, 0x3a3a3c);
                B.put(B.cyl, x, y + legH + th * 0.7, z, r * 1.03, 0.1, r * 1.03, 0x3a3a3c);
                B.put(B.cone, x, y + legH + th + 0.35, z, r * 1.08, 0.7, r * 1.08, 0x4d4a45);
            }
            else if (kind === 1 || kind === 2) {
                // AC units (1-3 in a row)
                const cnt = R.int(1, 3);
                const pos = tryPlace(0.8 * cnt + 0.4);
                if (!pos)
                    continue;
                const [ox, z] = pos;
                const c = R.pick([0xb8bdc2, 0xa0a6ad, 0xcfd3d6]);
                for (let u = 0; u < cnt; u++) {
                    const uz = z + (u - (cnt - 1) / 2) * 1.6;
                    B.put(B.box, s * ox, y + 0.45, uz, 1.3, 0.9, 1.0, c);
                    B.put(B.cyl, s * ox, y + 0.93, uz, 0.32, 0.05, 0.32, 0x2c2f33);
                }
            }
            else if (kind === 3) {
                // Antenna mast with cross bars
                const pos = tryPlace(0.7);
                if (!pos)
                    continue;
                const [ox, z] = pos;
                const x = s * ox;
                const h = R.range(4, 9);
                B.put(B.taper, x, y + h / 2, z, 0.06, h, 0.06, 0x555a60);
                for (let b = 0, nb = R.int(2, 3); b < nb; b++) {
                    B.put(B.box, x, y + h * (0.55 + b * 0.15), z, 0.06, 0.06, 1.6 - b * 0.4, 0x555a60);
                }
                B.put(B.box, x, y + h + 0.1, z, 0.14, 0.14, 0.14, 0xe5484d);
            }
            else if (kind === 4) {
                // Stair / elevator bulkhead
                const pos = tryPlace(1.9);
                if (!pos)
                    continue;
                const [ox, z] = pos;
                B.put(B.box, s * ox, y + 1.1, z, 2.8, 2.2, 2.6, tone(trim, -0.02));
                B.put(B.box, s * (ox - 1.41 * 1), y + 0.9, z, 0.06, 1.8, 1.0, 0x2b2e33);
                B.put(B.box, s * ox, y + 2.25, z, 3.0, 0.12, 2.8, 0x4a4d50);
            }
            else if (kind === 5) {
                // Brick chimney
                const pos = tryPlace(0.8);
                if (!pos)
                    continue;
                const [ox, z] = pos;
                const h = R.range(1.6, 3.2);
                B.put(B.box, s * ox, y + h / 2, z, 0.9, h, 0.9, 0x8c4a3a);
                B.put(B.box, s * ox, y + h + 0.08, z, 1.1, 0.16, 1.1, 0x3a3a3c);
            }
            else if (sz >= 9 && roof.y >= 18) {
                // Billboard
                const pos = tryPlace(3.4);
                if (!pos)
                    continue;
                const [, z] = pos;
                const len = Math.min(6.5, sz - 3);
                const x = s * (roof.xmin + 1.0);
                [-1, 1].forEach((d) => B.put(B.box, x, y + 1.3, z + d * (len / 2 - 0.4), 0.2, 2.6, 0.2, 0x3a3a3c));
                B.put(B.box, x - s * 0.1, y + 3.7, z, 0.15, 2.6, len, R.pick(BILLBOARDS));
            }
        }
    }
    /* -------------------------------- skyline ------------------------------- */
    buildSkyline() {
        const { B, R } = this;
        const bgStyle = () => ({
            pattern: R.pick([0, 1, 4]),
            floorH: 4.6,
            winW: 1.7,
            winH: 2.2,
            pitch: 4.0,
            groupGap: 1.5,
            lit: R.range(0.05, 0.14),
            sill: false,
            belt: false,
            glass: [0x4a6580, 0x55708a, 0x3f5a73],
            trim: 0x8a96a6
        });
        // Row A (behind the street buildings, with windows) and Row B (far haze)
        [-1, 1].forEach((s) => {
            let z = -125 + R.range(0, 6);
            while (z < 125) {
                const d = R.range(14, 26);
                const w = R.range(16, 28);
                const h = R.range(30, 95);
                const xmin = 33.5 + R.range(0, 2);
                const col = tone(R.pick(BG_TONES), R.range(-0.04, 0.04));
                const cz = z + d / 2;
                B.put(B.box, s * (xmin + w / 2), h / 2, cz, w, h, d, col);
                this.addWindows('x', -s, s * xmin, cz, d, 3, h, bgStyle(), 1.5);
                B.put(B.box, s * (xmin + w / 2 - 0.5), h + 0.4, cz, w, 0.8, d + 0.3, tone(col, -0.1));
                if (R.chance(0.4)) {
                    const ah = R.range(4, 9);
                    B.put(B.taper, s * (xmin + w / 2), h + ah / 2, cz, 0.07, ah, 0.07, 0x555a60);
                }
                z += d + R.range(0, 5);
            }
            z = -150 + R.range(0, 8);
            while (z < 150) {
                const d = R.range(20, 34);
                const w = R.range(22, 36);
                const h = R.range(60, 150);
                const xmin = 62 + R.range(0, 6);
                const col = tone(R.pick(BG_TONES), R.range(0.02, 0.1));
                const cz = z + d / 2;
                B.put(B.box, s * (xmin + w / 2), h / 2, cz, w, h, d, col);
                if (R.chance(0.6)) {
                    const ch = R.range(12, 32);
                    B.put(B.box, s * (xmin + w / 2), h + ch / 2, cz, w * 0.6, ch, d * 0.6, tone(col, -0.03));
                    if (R.chance(0.5))
                        B.put(B.taper, s * (xmin + w / 2), h + ch + 5, cz, 0.15, 10, 0.15, 0x6a737f);
                }
                z += d + R.range(0, 8);
            }
        });
        // End caps closing both ends of the street (z = +-80)
        [-1, 1].forEach((e) => {
            let x = -52 + R.range(0, 4);
            while (x < 50) {
                const w = R.range(14, 26);
                const d = R.range(18, 30);
                const h = R.range(28, 100);
                const col = tone(R.pick(BG_TONES), R.range(-0.04, 0.04));
                const cx = x + w / 2;
                const cz = e * (STREET_HALF + 1 + d / 2);
                B.put(B.box, cx, h / 2, cz, w, h, d, col);
                this.addWindows('z', -e, e * (STREET_HALF + 1), cx, w, 3, h, bgStyle(), 1.5);
                B.put(B.box, cx, h + 0.4, cz, w + 0.3, 0.8, d + 0.3, tone(col, -0.1));
                x += w + R.range(0, 3);
            }
        });
    }
}
//# sourceMappingURL=ProceduralCity.js.map