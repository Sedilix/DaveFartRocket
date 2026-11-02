import * as THREE from 'three';
export class Atmosphere {
    group;
    clouds = [];
    starfield;
    satelliteGroup;
    satelliteSpinVelocity = 0;
    moonGroup;
    astronautLeftArm;
    astronautRightArm;
    // Sky color palette
    daySkyColor = new THREE.Color(0x6ca0dc);
    stratosphereColor = new THREE.Color(0x1b2a4a);
    spaceColor = new THREE.Color(0x05070f);
    constructor() {
        this.group = new THREE.Group();
        this.group.name = 'Atmosphere';
        this.buildCloudDeck();
        this.starfield = this.buildStarfield();
        this.satelliteGroup = this.buildSatellite();
        const { moon, armL, armR } = this.buildMoon();
        this.moonGroup = moon;
        this.astronautLeftArm = armL;
        this.astronautRightArm = armR;
    }
    buildCloudDeck() {
        const cloudMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.9,
            flatShading: true
        });
        // Cloud deck stretches from altitude 250m to 1400m
        const cloudAltitudes = [280, 380, 520, 700, 920, 1150, 1400];
        cloudAltitudes.forEach((alt, idx) => {
            const cluster = new THREE.Group();
            cluster.position.set((Math.random() - 0.5) * 80, alt, (Math.random() - 0.5) * 80);
            const blobCount = 5 + (idx % 4);
            for (let b = 0; b < blobCount; b++) {
                const radius = 6 + Math.random() * 8;
                const blobGeo = new THREE.DodecahedronGeometry(radius, 1);
                const blob = new THREE.Mesh(blobGeo, cloudMat);
                blob.position.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 18);
                blob.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
                cluster.add(blob);
            }
            this.group.add(cluster);
            this.clouds.push(cluster);
        });
    }
    buildStarfield() {
        const count = 1800;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            // Distribute stars in spherical shell around high altitudes
            const r = 2500 + Math.random() * 25000;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 1500; // Above clouds
            positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
            // Star sparkle tint
            const brightness = 0.6 + Math.random() * 0.4;
            colors[i * 3] = brightness;
            colors[i * 3 + 1] = brightness * (0.9 + Math.random() * 0.1);
            colors[i * 3 + 2] = brightness;
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const material = new THREE.PointsMaterial({
            size: 2.2,
            sizeAttenuation: false,
            vertexColors: true,
            transparent: true,
            opacity: 0.95
        });
        const starfield = new THREE.Points(geometry, material);
        this.group.add(starfield);
        return starfield;
    }
    buildSatellite() {
        const satGroup = new THREE.Group();
        // Positioned around altitude 4200m (Fart #20)
        satGroup.position.set(12, 4200, -8);
        // Boxy yellow satellite body
        const bodyGeo = new THREE.BoxGeometry(2.4, 2.4, 3.2);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0xebbe28,
            metalness: 0.8,
            roughness: 0.3,
            flatShading: true
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        satGroup.add(body);
        // Dark solar array wings
        const wingMat = new THREE.MeshStandardMaterial({
            color: 0x112344,
            metalness: 0.6,
            roughness: 0.2,
            flatShading: true
        });
        const wingGeo = new THREE.BoxGeometry(7.2, 0.15, 2.6);
        const leftWing = new THREE.Mesh(wingGeo, wingMat);
        leftWing.position.set(-5.0, 0, 0);
        satGroup.add(leftWing);
        const rightWing = new THREE.Mesh(wingGeo, wingMat);
        rightWing.position.set(5.0, 0, 0);
        satGroup.add(rightWing);
        // Antenna dish
        const dishGeo = new THREE.ConeGeometry(0.9, 0.6, 6);
        const dishMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, flatShading: true });
        const dish = new THREE.Mesh(dishGeo, dishMat);
        dish.position.set(0, 1.5, 0.8);
        dish.rotation.x = Math.PI * 0.7;
        satGroup.add(dish);
        this.group.add(satGroup);
        return satGroup;
    }
    buildMoon() {
        const moonGroup = new THREE.Group();
        // Positioned at altitude 7200m (Fart #21)
        moonGroup.position.set(-35, 7200, -25);
        // Faceted gray low-poly sphere with craters
        const moonGeo = new THREE.IcosahedronGeometry(28, 2);
        const moonMat = new THREE.MeshStandardMaterial({
            color: 0xbfbfbf,
            roughness: 0.9,
            flatShading: true
        });
        const moonMesh = new THREE.Mesh(moonGeo, moonMat);
        moonGroup.add(moonMesh);
        // Craters on moon surface
        const craterMat = new THREE.MeshStandardMaterial({ color: 0x7c7c7c, flatShading: true });
        for (let i = 0; i < 14; i++) {
            const crater = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.2, 0.6, 7), craterMat);
            const angle = (i / 14) * Math.PI * 2;
            crater.position.set(Math.cos(angle) * 26, Math.sin(angle) * 22, 10 + (Math.random() - 0.5) * 8);
            crater.lookAt(moonGroup.position);
            moonGroup.add(crater);
        }
        // Tiny white-suited astronaut standing on moon surface
        const astroGroup = new THREE.Group();
        astroGroup.position.set(0, 27.5, 5);
        astroGroup.scale.set(0.8, 0.8, 0.8);
        const suitMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, flatShading: true });
        const visorMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 0.9, roughness: 0.1 });
        const astroTorso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.6), suitMat);
        astroTorso.position.y = 0.8;
        astroGroup.add(astroTorso);
        const astroHead = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.65), suitMat);
        astroHead.position.y = 1.65;
        astroGroup.add(astroHead);
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 0.1), visorMat);
        visor.position.set(0, 1.65, 0.35);
        astroGroup.add(visor);
        // Waving panic arms
        const armGeo = new THREE.BoxGeometry(0.24, 0.75, 0.24);
        const armL = new THREE.Mesh(armGeo, suitMat);
        armL.position.set(-0.6, 1.3, 0);
        astroGroup.add(armL);
        const armR = new THREE.Mesh(armGeo, suitMat);
        armR.position.set(0.6, 1.3, 0);
        astroGroup.add(armR);
        // Flag
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.5), new THREE.MeshBasicMaterial({ color: 0xdddddd }));
        pole.position.set(1.4, 1.25, 0);
        astroGroup.add(pole);
        const flag = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.04), new THREE.MeshBasicMaterial({ color: 0xff3333 }));
        flag.position.set(1.85, 2.1, 0);
        astroGroup.add(flag);
        moonGroup.add(astroGroup);
        this.group.add(moonGroup);
        return { moon: moonGroup, armL, armR };
    }
    getSkyColor(altitude) {
        if (altitude < 250) {
            return this.daySkyColor;
        }
        else if (altitude < 1800) {
            const t = (altitude - 250) / (1800 - 250);
            return this.daySkyColor.clone().lerp(this.stratosphereColor, t);
        }
        else if (altitude < 8000) {
            const t = Math.min(1, (altitude - 1800) / (8000 - 1800));
            return this.stratosphereColor.clone().lerp(this.spaceColor, t);
        }
        return this.spaceColor;
    }
    update(dt, altitude, fartNumber) {
        const time = performance.now() * 0.001;
        // Gentle cloud drift
        this.clouds.forEach((cloud, i) => {
            cloud.position.x += Math.sin(time * 0.5 + i) * dt * 1.5;
        });
        // Satellite knock-spin when Dave reaches Fart #20
        if (fartNumber >= 20) {
            if (this.satelliteSpinVelocity === 0) {
                this.satelliteSpinVelocity = 14.0; // Rapid tumble knocked by Dave
            }
            this.satelliteSpinVelocity = Math.max(1.5, this.satelliteSpinVelocity - dt * 0.8);
            this.satelliteGroup.rotation.x += this.satelliteSpinVelocity * dt;
            this.satelliteGroup.rotation.y += this.satelliteSpinVelocity * 0.7 * dt;
            this.satelliteGroup.rotation.z += this.satelliteSpinVelocity * 0.4 * dt;
        }
        else {
            this.satelliteGroup.rotation.y += dt * 0.3;
        }
        // Astronaut panic waving arms (Fart #21+)
        if (fartNumber >= 21) {
            this.astronautLeftArm.rotation.z = Math.sin(time * 16) * 0.8 + 1.2;
            this.astronautRightArm.rotation.z = -Math.cos(time * 16) * 0.8 - 1.2;
        }
        else {
            this.astronautLeftArm.rotation.z = 0.2;
            this.astronautRightArm.rotation.z = -0.2;
        }
        // Slow moon rotation
        this.moonGroup.rotation.y += dt * 0.04;
    }
}
//# sourceMappingURL=Atmosphere.js.map