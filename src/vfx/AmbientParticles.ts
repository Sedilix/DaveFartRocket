import * as THREE from 'three';

export type AmbientBiome = 'ship' | 'jungle' | 'ice' | 'desert' | 'star';

/**
 * Procedural ambient particle systems tailored per saga scene.
 * Low draw-call single-buffer point systems.
 */
export class AmbientParticles {
  public points: THREE.Points;
  private geo: THREE.BufferGeometry;
  private mat: THREE.PointsMaterial;
  private positions: Float32Array;
  private velocities: Float32Array;
  private count: number;
  public readonly biome: AmbientBiome;
  private bounds = { x: 45, y: 22, z: 45 };

  constructor(biome: AmbientBiome, count = 280) {
    this.biome = biome;
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    let baseColor = new THREE.Color(0xffffff);
    let size = 2.5;

    for (let i = 0; i < count; i++) {
      this.positions[i * 3] = (Math.random() - 0.5) * this.bounds.x * 2;
      this.positions[i * 3 + 1] = Math.random() * this.bounds.y;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * this.bounds.z * 2;

      if (biome === 'ship') {
        // Floating cosy dust motes
        this.velocities[i * 3] = (Math.random() - 0.5) * 0.4;
        this.velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.2;
        this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
        baseColor.setHex(Math.random() > 0.4 ? 0xbfe6f2 : 0xffe27a);
        size = 2.0;
      } else if (biome === 'jungle') {
        // Glowing fireflies and drifting pollen
        this.velocities[i * 3] = (Math.random() - 0.5) * 0.8;
        this.velocities[i * 3 + 1] = Math.random() * 0.3 - 0.1;
        this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
        baseColor.setHex(Math.random() > 0.3 ? 0x9be8b0 : 0xffea78);
        size = 3.2;
      } else if (biome === 'ice') {
        // Drifting snow crystals
        this.velocities[i * 3] = -1.5 - Math.random() * 1.5;
        this.velocities[i * 3 + 1] = -1.2 - Math.random() * 0.8;
        this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
        baseColor.setHex(0xeef6ff);
        size = 2.6;
      } else if (biome === 'desert') {
        // Blowing sand motes
        this.velocities[i * 3] = 3.5 + Math.random() * 2.0;
        this.velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.4;
        this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
        baseColor.setHex(0xe8d49b);
        size = 2.2;
      } else if (biome === 'star') {
        // Glowing bean tree embers and cosmic spores
        this.velocities[i * 3] = (Math.random() - 0.5) * 0.6;
        this.velocities[i * 3 + 1] = 0.4 + Math.random() * 0.8;
        this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
        baseColor.setHex(Math.random() > 0.5 ? 0xffbf69 : 0xff99c8);
        size = 3.0;
      }

      colors[i * 3] = baseColor.r;
      colors[i * 3 + 1] = baseColor.g;
      colors[i * 3 + 2] = baseColor.b;
    }

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.mat = new THREE.PointsMaterial({
      size,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      sizeAttenuation: false,
      depthWrite: false
    });

    this.points = new THREE.Points(this.geo, this.mat);
  }

  public update(playerPos: THREE.Vector3, dt: number) {
    const pos = this.positions;
    const vel = this.velocities;
    const n = this.count;

    for (let i = 0; i < n; i++) {
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;

      // Wrap around player position
      const dx = pos[i * 3] - playerPos.x;
      const dy = pos[i * 3 + 1] - playerPos.y;
      const dz = pos[i * 3 + 2] - playerPos.z;

      if (dx > this.bounds.x) pos[i * 3] -= this.bounds.x * 2;
      else if (dx < -this.bounds.x) pos[i * 3] += this.bounds.x * 2;

      if (dy > this.bounds.y) pos[i * 3 + 1] -= this.bounds.y;
      else if (dy < 0) pos[i * 3 + 1] += this.bounds.y;

      if (dz > this.bounds.z) pos[i * 3 + 2] -= this.bounds.z * 2;
      else if (dz < -this.bounds.z) pos[i * 3 + 2] += this.bounds.z * 2;
    }

    this.geo.attributes.position.needsUpdate = true;
  }

  public dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}
