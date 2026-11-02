import * as THREE from 'three';
import { NPCManager } from './NPCManager';
import { StreetDog } from './StreetDog';
import { DogOwner } from './DogOwner';
import { PigeonFlock } from './PigeonFlock';
import { TrafficManager } from './TrafficManager';
import { ProceduralCity, randomSeed } from './ProceduralCity';
export class CityChunk {
    group;
    npcManager = new NPCManager();
    traffic = new TrafficManager();
    dog = new StreetDog();
    dogOwner = new DogOwner(this.dog);
    pigeons = new PigeonFlock();
    /** Seeded procedural buildings, trees, street furniture, road markings and skyline. */
    procedural;
    constructor(physics) {
        this.group = new THREE.Group();
        this.group.name = 'CityChunk';
        this.buildRoadAndSidewalks(physics);
        this.procedural = new ProceduralCity(physics, randomSeed());
        this.group.add(this.procedural.group);
        this.buildParkedCars(physics);
        this.buildCafe(physics);
        this.group.add(this.traffic.group, this.npcManager.group, this.dog.group, this.dogOwner.group, this.pigeons.group);
    }
    buildRoadAndSidewalks(physics) {
        // 1. Asphalt Road at y = 0
        // Width 14m, length 160m
        const roadGeo = new THREE.BoxGeometry(14, 0.4, 160);
        const roadMat = new THREE.MeshStandardMaterial({
            color: 0x22252a,
            roughness: 0.85,
            flatShading: true
        });
        const road = new THREE.Mesh(roadGeo, roadMat);
        // Center at y = -0.2 so top surface is exactly at y = 0.00
        road.position.set(0, -0.2, 0);
        road.receiveShadow = true;
        this.group.add(road);
        physics.createBoxCollider(new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(7, 0.2, 80));
        // Yellow dashed road stripes
        const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf4c430 });
        const stripeGeo = new THREE.BoxGeometry(0.3, 0.02, 3.5);
        for (let z = -70; z <= 70; z += 7) {
            const stripe = new THREE.Mesh(stripeGeo, stripeMat);
            stripe.position.set(0, 0.01, z);
            this.group.add(stripe);
        }
        // 2. Raised Sidewalks at exact y = 0.30
        // Curb step height is exactly 0.30m
        // Left sidewalk: x from -7 to -13 (width 6m), center at x = -10
        // Right sidewalk: x from 7 to 13 (width 6m), center at x = 10
        const sidewalkMat = new THREE.MeshStandardMaterial({
            color: 0x9fa4a6,
            roughness: 0.7,
            flatShading: true
        });
        const sidewalkCurbMat = new THREE.MeshStandardMaterial({
            color: 0x7a7e80,
            roughness: 0.7,
            flatShading: true
        });
        [-10, 10].forEach((xPos) => {
            // Top surface at y = 0.30 (height 0.30, bottom at y = 0.00, center at y = 0.15)
            const walkGeo = new THREE.BoxGeometry(6, 0.30, 160);
            const walk = new THREE.Mesh(walkGeo, sidewalkMat);
            walk.position.set(xPos, 0.15, 0);
            walk.receiveShadow = true;
            this.group.add(walk);
            physics.createBoxCollider(new THREE.Vector3(xPos, 0.15, 0), new THREE.Vector3(3, 0.15, 80));
            // Curb stone edge (beveled border facing road)
            const curbGeo = new THREE.BoxGeometry(0.25, 0.30, 160);
            const curb = new THREE.Mesh(curbGeo, sidewalkCurbMat);
            const curbX = xPos < 0 ? -7 + 0.125 : 7 - 0.125;
            curb.position.set(curbX, 0.15, 0);
            this.group.add(curb);
        });
    }
    /**
     * Rebuild all procedural scenery (buildings + colliders, trees, props, markings, skyline)
     * from a seed. A fresh random seed is used when none is given.
     */
    regenerate(seed = randomSeed()) {
        this.procedural.generate(seed);
    }
    buildParkedCars(physics) {
        const carColors = [0x2f68b4, 0xbf3028, 0xefefef, 0x222222, 0xc49b2c];
        [-42, -22, -2, 18, 38].forEach((z, idx) => {
            const side = idx % 2 === 0 ? -1 : 1;
            this.traffic.addParked(carColors[idx % carColors.length], side * 5.2, z, physics);
        });
    }
    buildCafe(physics) {
        // Brunch café located along left sidewalk at z = 8 to 22
        const cafeX = -9.8;
        const tableMat = new THREE.MeshStandardMaterial({ color: 0xd9c298, flatShading: true });
        const chairMat = new THREE.MeshStandardMaterial({ color: 0x6b4f3b, flatShading: true });
        const umbrellaMat = new THREE.MeshStandardMaterial({ color: 0xcc4433, flatShading: true });
        [10, 16, 22].forEach((tz) => {
            // Table
            const tableGroup = new THREE.Group();
            tableGroup.position.set(cafeX, 0.30, tz);
            const tableTopGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.08, 10);
            const tableTop = new THREE.Mesh(tableTopGeo, tableMat);
            tableTop.position.y = 0.88;
            tableGroup.add(tableTop);
            const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.88, 6);
            const leg = new THREE.Mesh(legGeo, chairMat);
            leg.position.y = 0.44;
            tableGroup.add(leg);
            // Umbrella
            const umbrellaGeo = new THREE.ConeGeometry(1.6, 0.7, 8);
            const umbrella = new THREE.Mesh(umbrellaGeo, umbrellaMat);
            umbrella.position.y = 2.4;
            tableGroup.add(umbrella);
            const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6);
            const pole = new THREE.Mesh(poleGeo, chairMat);
            pole.position.y = 1.2;
            tableGroup.add(pole);
            // Cups
            const cupGeo = new THREE.CylinderGeometry(0.08, 0.06, 0.12, 6);
            const cup = new THREE.Mesh(cupGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
            cup.position.set(0.2, 0.96, 0.1);
            tableGroup.add(cup);
            this.group.add(tableGroup);
            // Table collider so Dave can stand/land on café tables!
            physics.createBoxCollider(new THREE.Vector3(cafeX, 0.30 + 0.45, tz), new THREE.Vector3(0.8, 0.45, 0.8));
        });
    }
    update(dt, currentDb, fartNumber, dave) {
        this.traffic.update(dt, fartNumber);
        this.npcManager.update(dt, currentDb, dave, this.dog.group.position);
        this.dog.update(dt, fartNumber, dave.z);
        this.dogOwner.update(dt, currentDb, dave);
        this.pigeons.update(dt, fartNumber);
    }
    reset() {
        this.traffic.reset();
        this.npcManager.reset();
        this.dog.reset();
        this.dogOwner.reset();
        this.pigeons.reset();
        // New street layout on every restart so replays differ
        this.regenerate();
    }
}
//# sourceMappingURL=CityChunk.js.map