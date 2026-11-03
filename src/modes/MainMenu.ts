import { progression } from '../core/progression';
import { settingsModal } from '../ui/Settings';
import * as THREE from 'three';

interface ActCard {
  act: number;
  label: string;
  title: string;
  desc: string;
  href: string;
  icon: string;
}

const ACTS: ActCard[] = [
  {
    act: 0,
    label: 'ACT 0',
    title: 'The Street Ascent',
    desc: 'The original 25 farts. Oblivious pedestrians, rocket propulsion, and Earth’s gentle departure.',
    href: window.location.pathname,
    icon: '🏙️'
  },
  {
    act: 1,
    label: 'ACT I',
    title: 'A Very Quiet Briefing',
    desc: 'Aboard the Quell starship Whisper. Muffled farts, fragile heirlooms, and Pim’s reluctant assignment.',
    href: '?mode=act1',
    icon: '🛸'
  },
  {
    act: 2,
    label: 'ACT II',
    title: 'The Moon of Nom',
    desc: 'Jungle ravines and holy flatulence. Chain boosts across the gorge to ring the Great Gust Horn.',
    href: '?mode=act2',
    icon: '🌴'
  },
  {
    act: 3,
    label: 'ACT III',
    title: 'Frostbite Hotel',
    desc: 'An abandoned art-deco hotel on an ice moon. Ascend the frozen lift shaft while ignoring the stairs.',
    href: '?mode=act3',
    icon: '❄️'
  },
  {
    act: 4,
    label: 'ACT IV',
    title: 'Desert of Silence',
    desc: 'Dunes of frozen sound. Outrun the advancing wall of Silence across the desert amphitheatre.',
    href: '?mode=act4',
    icon: '🏜️'
  },
  {
    act: 5,
    label: 'ACT V',
    title: 'The Bean Tree',
    desc: 'The dead star at the heart of the galaxy. Hold your breath for the silent window of cosmic release.',
    href: '?mode=act5',
    icon: '🌱'
  },
  {
    act: 6,
    label: 'EPILOGUE',
    title: 'Rebuild Earth (Voxel)',
    desc: 'Full open-world voxel sandbox. Infinite terrain, biomes, building, and brunch.',
    href: '?mode=voxel',
    icon: '🧱'
  }
];

export class MainMenu {
  private container: HTMLElement;
  private root: HTMLElement;
  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private stars?: THREE.Points;
  private animId = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.root = document.createElement('div');
    this.root.className = 'main-menu-root';
    this.root.style.cssText = `
      position: absolute;
      inset: 0;
      overflow-y: auto;
      overflow-x: hidden;
      z-index: 10;
      color: #fff;
      font-family: var(--font-ui);
      padding: 40px 20px 80px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 36px;
      user-select: none;
      -webkit-user-select: none;
    `;
    this.container.appendChild(this.root);
  }

  public start() {
    this.setupBackground();
    this.render();
    this.loop();
  }

  private setupBackground() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060914);

    this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
    this.camera.position.z = 80;

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.domElement.style.cssText = 'position:fixed;inset:0;z-index:1;pointer-events:none;';
    this.container.appendChild(this.renderer.domElement);

    // Cosmic starfield
    const n = 1800;
    const pos = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 600;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 600;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 400;

      // Color variation (warm white, cyan, subtle gold)
      const r = Math.random();
      if (r > 0.8) {
        colors[i * 3] = 0.5; colors[i * 3 + 1] = 0.8; colors[i * 3 + 2] = 1.0;
      } else if (r > 0.6) {
        colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.9; colors[i * 3 + 2] = 0.6;
      } else {
        colors[i * 3] = 0.9; colors[i * 3 + 1] = 0.9; colors[i * 3 + 2] = 0.95;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size: 1.8, vertexColors: true, sizeAttenuation: false });
    this.stars = new THREE.Points(g, mat);
    this.scene.add(this.stars);

    window.addEventListener('resize', this.onResize);
  }

  private onResize = () => {
    if (!this.renderer || !this.camera) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private loop = () => {
    this.animId = requestAnimationFrame(this.loop);
    if (this.stars) {
      this.stars.rotation.y += 0.0003;
      this.stars.rotation.x += 0.0001;
    }
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  };

  private render() {
    const unl = progression.unlockedAct;
    const nextAct = ACTS.find((a) => a.act === unl) || ACTS[0];

    this.root.innerHTML = `
      <!-- Hero Header -->
      <header style="text-align:center;max-width:680px;display:flex;flex-direction:column;align-items:center;gap:10px">
        <div style="font-size:var(--fs-caption);font-weight:var(--fw-heavy);letter-spacing:var(--tracking-widest);color:var(--col-accent-orange);text-transform:uppercase">A Cosmic Gastrointestinal Odyssey</div>
        <h1 style="font-family:var(--font-story);font-size:var(--fs-display);font-weight:var(--fw-heavy);margin:0;letter-spacing:1px;line-height:1.1;text-shadow:0 4px 24px rgba(0,0,0,0.8)">DAVE FART ROCKET</h1>
        <p style="font-family:var(--font-story);font-style:italic;font-size:var(--fs-body-lg);opacity:0.85;margin:0;line-height:var(--lh-relaxed)">
          From suburban pavement to celestial apotheosis. One man, one bean, and the gentle destruction of astrophysics.
        </p>

        <div style="display:flex;gap:14px;margin-top:16px;flex-wrap:wrap;justify-content:center">
          <a href="${nextAct.href}" class="hud-btn hud-btn-primary" style="padding:14px 32px;font-size:var(--fs-body)">CONTINUE: ${nextAct.label}</a>
          <button data-action="settings" class="hud-btn hud-btn-secondary">SETTINGS</button>
        </div>
      </header>

      <!-- Act Select Grid -->
      <section style="width:100%;max-width:860px;display:flex;flex-direction:column;gap:18px">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:0 4px">
          <span style="font-size:var(--fs-label);font-weight:var(--fw-heavy);letter-spacing:var(--tracking-widest);color:var(--col-accent-cyan);text-transform:uppercase">ACT SELECT</span>
          <span style="font-size:var(--fs-caption);opacity:0.7">Casualties: <b style="color:var(--col-accent-orange)">${progression.totalCasualties}</b></span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(260px, 1fr));gap:16px">
          ${ACTS.map((a) => {
            const isUnlocked = progression.isActUnlocked(a.act);
            const isDone = progression.isActCompleted(a.act);
            return `
              <div class="hud-glass-card" style="padding:18px;display:flex;flex-direction:column;gap:10px;position:relative;opacity:${isUnlocked ? '1' : '0.5'};transition:transform 0.15s ease">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span style="font-size:24px">${a.icon}</span>
                  <span style="font-size:var(--fs-caption);font-weight:var(--fw-bold);letter-spacing:var(--tracking-wide);opacity:0.8">${a.label}</span>
                  ${isDone ? '<span style="color:var(--col-accent-emerald);font-size:var(--fs-caption);font-weight:var(--fw-bold)">✓ DONE</span>' : ''}
                </div>
                <div>
                  <h3 style="font-family:var(--font-story);font-size:var(--fs-title-s);margin:0 0 4px">${a.title}</h3>
                  <p style="font-size:var(--fs-caption);opacity:0.75;line-height:var(--lh-body);margin:0">${a.desc}</p>
                </div>
                <div style="margin-top:auto;padding-top:10px">
                  ${
                    isUnlocked
                      ? `<a href="${a.href}" class="hud-btn hud-btn-secondary" style="width:100%;padding:8px 14px;min-height:36px;font-size:var(--fs-caption)">PLAY</a>`
                      : `<div style="font-size:var(--fs-caption);opacity:0.6;text-align:center;padding:8px">LOCKED</div>`
                  }
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>

      <!-- Achievements Showcase -->
      <section style="width:100%;max-width:860px;display:flex;flex-direction:column;gap:14px">
        <span style="font-size:var(--fs-label);font-weight:var(--fw-heavy);letter-spacing:var(--tracking-widest);color:var(--col-accent-cyan);text-transform:uppercase">ACHIEVEMENTS</span>
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(190px, 1fr));gap:12px">
          ${progression.achievementsList.map((ach) => `
            <div class="hud-glass-card" style="padding:12px;display:flex;align-items:center;gap:12px;opacity:${ach.unlocked ? '1' : '0.45'}">
              <span style="font-size:24px">${ach.icon}</span>
              <div style="display:flex;flex-direction:column">
                <span style="font-size:var(--fs-caption);font-weight:var(--fw-bold)">${ach.title}</span>
                <span style="font-size:10px;opacity:0.7">${ach.unlocked ? 'Unlocked' : ach.description}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- Credits Footer -->
      <footer style="text-align:center;max-width:540px;margin-top:20px;opacity:0.65;font-size:var(--fs-caption);line-height:var(--lh-relaxed)">
        Built purely procedurally with Three.js, Rapier3D & Web Audio.<br>
        <i>"Throughout it all, Dave remained fine."</i>
      </footer>
    `;

    this.root.querySelector('[data-action="settings"]')?.addEventListener('click', () => settingsModal.open());
  }

  public dispose() {
    cancelAnimationFrame(this.animId);
    window.removeEventListener('resize', this.onResize);
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.root.remove();
  }
}
