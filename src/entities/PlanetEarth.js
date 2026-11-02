import * as THREE from 'three';
export class PlanetEarth {
    group;
    earthMesh;
    cloudMesh;
    shardsGroup;
    shards = [];
    isShattered = false;
    originalPositions;
    earthGeometry;
    rippleWaveTime = 0;
    isRippling = false;
    constructor() {
        this.group = new THREE.Group();
        this.group.name = 'PlanetEarth';
        // Earth centered far below Dave in deep space (e.g. altitude ~ 2000m while Dave is at 11,000m - 30,000m)
        this.group.position.set(0, 1500, 0);
        // 1. Faceted low-poly Earth (radius 480)
        this.earthGeometry = new THREE.IcosahedronGeometry(480, 4);
        // Cache original vertex positions for ripple effect
        const posAttr = this.earthGeometry.attributes.position;
        this.originalPositions = new Float32Array(posAttr.array);
        // Vertex color assignment (blue oceans, green/tan continents, white polar caps)
        const count = posAttr.count;
        const colors = new Float32Array(count * 3);
        const colorOcean = new THREE.Color(0x19528d);
        const colorContinent = new THREE.Color(0x4a8536);
        const colorDesert = new THREE.Color(0xbfa765);
        const colorIce = new THREE.Color(0xe6f2ff);
        for (let i = 0; i < count; i++) {
            const vx = posAttr.getX(i);
            const vy = posAttr.getY(i);
            const vz = posAttr.getZ(i);
            // Procedural continents using 3D noise approximation
            const lat = vy / 480; // -1 to 1
            const lon = Math.atan2(vz, vx);
            const pattern = Math.sin(lon * 3.5) * Math.cos(lat * 4.2) + Math.sin(lon * 7.1 + lat * 5.0) * 0.4;
            let c = colorOcean;
            if (Math.abs(lat) > 0.82) {
                c = colorIce;
            }
            else if (pattern > 0.15) {
                c = pattern > 0.55 ? colorDesert : colorContinent;
            }
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;
        }
        this.earthGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.earthGeometry.computeVertexNormals();
        const earthMat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            flatShading: true,
            roughness: 0.8,
            metalness: 0.1
        });
        this.earthMesh = new THREE.Mesh(this.earthGeometry, earthMat);
        this.group.add(this.earthMesh);
        // 2. White low-poly cloud shell
        const cloudGeo = new THREE.IcosahedronGeometry(492, 3);
        const cloudMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            flatShading: true,
            roughness: 0.9,
            transparent: true,
            opacity: 0.35
        });
        this.cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
        this.group.add(this.cloudMesh);
        // Shards container
        this.shardsGroup = new THREE.Group();
        this.group.add(this.shardsGroup);
    }
    triggerRipple() {
        this.isRippling = true;
        this.rippleWaveTime = 0;
    }
    shatterEarth() {
        if (this.isShattered)
            return;
        this.isShattered = true;
        // Hide intact Earth and cloud mesh
        this.earthMesh.visible = false;
        this.cloudMesh.visible = false;
        // Spawn 55+ 3D tectonic continental/ocean shards tumbling outward into deep space
        const shardColors = [0x19528d, 0x4a8536, 0xbfa765, 0x143c68, 0x336128, 0x7a3e1d, 0xd0c29b];
        const shardCount = 58;
        for (let i = 0; i < shardCount; i++) {
            // Faceted chunk
            const size = 35 + Math.random() * 55;
            const shardGeo = new THREE.DodecahedronGeometry(size, 0);
            const shardMat = new THREE.MeshStandardMaterial({
                color: shardColors[i % shardColors.length],
                flatShading: true,
                roughness: 0.85
            });
            const shard = new THREE.Mesh(shardGeo, shardMat);
            // Distribute along Earth spherical perimeter
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            const r = 460 + (Math.random() - 0.5) * 40;
            const px = r * Math.sin(phi) * Math.cos(theta);
            const py = r * Math.cos(phi);
            const pz = r * Math.sin(phi) * Math.sin(theta);
            shard.position.set(px, py, pz);
            // Outward explosive velocity vector
            const normal = new THREE.Vector3(px, py, pz).normalize();
            const speed = 75 + Math.random() * 140;
            const velocity = normal.clone().multiplyScalar(speed);
            // Tangential spread
            velocity.x += (Math.random() - 0.5) * 30;
            velocity.y += (Math.random() - 0.5) * 30;
            velocity.z += (Math.random() - 0.5) * 30;
            const rotVelocity = new THREE.Vector3((Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 2.5);
            this.shardsGroup.add(shard);
            this.shards.push({ mesh: shard, velocity, rotVelocity });
        }
    }
    reset() {
        this.isShattered = false;
        this.earthMesh.visible = true;
        this.cloudMesh.visible = true;
        this.isRippling = false;
        // Clear shards
        this.shards.forEach((s) => {
            this.shardsGroup.remove(s.mesh);
            s.mesh.geometry.dispose();
            s.mesh.material.dispose();
        });
        this.shards = [];
        // Reset Earth vertex positions
        const posAttr = this.earthGeometry.attributes.position;
        for (let i = 0; i < posAttr.count * 3; i++) {
            posAttr.array[i] = this.originalPositions[i];
        }
        posAttr.needsUpdate = true;
        this.earthGeometry.computeVertexNormals();
    }
    update(dt, fartNumber) {
        // Rotation of Earth & clouds
        if (!this.isShattered) {
            this.earthMesh.rotation.y += dt * 0.05;
            this.cloudMesh.rotation.y += dt * 0.07;
            this.cloudMesh.rotation.x += dt * 0.01;
        }
        // Fart #22: Earth Rippling vertex displacement wave
        if (fartNumber === 22 || this.isRippling) {
            this.rippleWaveTime += dt * 6.0;
            const posAttr = this.earthGeometry.attributes.position;
            const count = posAttr.count;
            for (let i = 0; i < count; i++) {
                const ox = this.originalPositions[i * 3];
                const oy = this.originalPositions[i * 3 + 1];
                const oz = this.originalPositions[i * 3 + 2];
                const len = Math.sqrt(ox * ox + oy * oy + oz * oz);
                const nx = ox / len;
                const ny = oy / len;
                const nz = oz / len;
                // Wave travels from North pole (closest to Dave) downward
                const wave = Math.sin(ny * 8.0 - this.rippleWaveTime) * 18.0 * Math.max(0, 1 - this.rippleWaveTime * 0.12);
                posAttr.setXYZ(i, ox + nx * wave, oy + ny * wave, oz + nz * wave);
            }
            posAttr.needsUpdate = true;
            this.earthGeometry.computeVertexNormals();
        }
        // Update shattered shards tumbling outward into deep space
        if (this.isShattered) {
            this.shards.forEach((s) => {
                s.mesh.position.addScaledVector(s.velocity, dt);
                s.mesh.rotation.x += s.rotVelocity.x * dt;
                s.mesh.rotation.y += s.rotVelocity.y * dt;
                s.mesh.rotation.z += s.rotVelocity.z * dt;
            });
        }
    }
}
//# sourceMappingURL=PlanetEarth.js.map