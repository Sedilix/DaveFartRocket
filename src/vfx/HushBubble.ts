import * as THREE from 'three';

/**
 * Procedural Hush Field bubble with fresnel rim, acoustic ripples,
 * impact shockwave flares, and low-meter warning pulse.
 */
export class HushBubble {
  public mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private time = 0;
  private flashIntensity = 0;

  constructor(radius = 1.7) {
    const geo = new THREE.SphereGeometry(radius, 28, 20);

    const vertexShader = `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec2 vUv;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        vUv = uv;
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fragmentShader = `
      uniform float uTime;
      uniform float uMeter; // 0..100
      uniform float uFlash; // 0..1
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec2 vUv;

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);

        // Fresnel edge glow
        float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 2.2);

        // Acoustic ripple waves
        float wave = sin(vUv.y * 38.0 - uTime * 4.5) * 0.5 + 0.5;
        float hex = sin(vUv.x * 24.0 + sin(vUv.y * 18.0)) * 0.5 + 0.5;
        float pattern = wave * 0.35 + hex * 0.25;

        // Base color: cyan when healthy, amber when mid, red warning pulse when low
        vec3 cyanColor = vec3(0.3, 0.82, 1.0);
        vec3 warnColor = vec3(1.0, 0.25, 0.25);
        vec3 amberColor = vec3(1.0, 0.65, 0.15);

        vec3 col = cyanColor;
        if (uMeter < 30.0) {
          float pulse = sin(uTime * 12.0) * 0.5 + 0.5;
          col = mix(warnColor, amberColor, pulse);
        } else if (uMeter < 60.0) {
          col = mix(amberColor, cyanColor, (uMeter - 30.0) / 30.0);
        }

        // Flash flare on fart impact
        col += vec3(0.5, 0.8, 1.0) * uFlash * 1.5;

        float alpha = fresnel * 0.45 + pattern * 0.12 + uFlash * 0.4;
        if (uMeter < 30.0) {
          alpha += (sin(uTime * 10.0) * 0.15);
        }

        gl_FragColor = vec4(col, clamp(alpha, 0.08, 0.85));
      }
    `;

    this.mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uMeter: { value: 100 },
        uFlash: { value: 0 }
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(geo, this.mat);
  }

  public triggerFlash(intensity = 1.0) {
    this.flashIntensity = Math.max(this.flashIntensity, intensity);
  }

  public update(center: THREE.Vector3, dt: number, meterPct = 100) {
    this.time += dt;
    this.flashIntensity = Math.max(0, this.flashIntensity - dt * 4.0);

    this.mesh.position.set(center.x, center.y + 0.9, center.z);

    // Subtle breathing scale
    const breath = 1.0 + Math.sin(this.time * 2.2) * 0.02 + this.flashIntensity * 0.15;
    this.mesh.scale.setScalar(breath);

    this.mat.uniforms.uTime.value = this.time;
    this.mat.uniforms.uMeter.value = meterPct;
    this.mat.uniforms.uFlash.value = this.flashIntensity;
  }

  public dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
