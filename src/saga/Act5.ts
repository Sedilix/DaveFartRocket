import * as THREE from 'three';
import { VoxelGame } from '../voxel/VoxelGame';
import { fartAudio } from '../audio/FartSynth';
import { damp, dampAngle } from '../core/animMath';
import { Quell } from './Quell';
import { StoryUi } from './StoryUi';
import { STAR_GROUND, TREE, starGenerator } from './star';
import { input } from '../input/UniversalInput';
import { AmbientParticles } from '../vfx/AmbientParticles';

const COLORS: Record<string, string> = {
  Narrator: '#9fb4cf',
  Dave: '#ff9a62',
  Pim: '#c8b8ff',
  'Captain Murmur': '#7fe0d4',
  'Elder Sibilance': '#e8ecf5',
  Everyone: '#ffd166'
};

const LOUD = ['BRAAAAP!', 'BRRRAAAAAP!!', 'PFFRRRAAAAAAP!!!'];
const WIN_FROM = 0.84; // the silent window, as a fraction of the ring
const WIN_TO = 0.95;
const RING_SECONDS = 7;

type State = 'intro' | 'walk' | 'ritual' | 'hold' | 'finale' | 'end';

/** Act V: the Bean Tree. The tension ring runs backwards: don't press, wait for the silent window. */
export class Act5 extends VoxelGame {
  private ui: StoryUi;
  private pim = new Quell({ height: 1.15, body: 0xb9a7e8, accent: 0xff9ccf });
  private cast: Quell[] = [];
  private ambient = new AmbientParticles('star', 300);
  private bubble: THREE.Mesh;
  private bubbleFlash = 0;
  private ringEl: HTMLElement;
  private ringLabel: HTMLElement;

  private state: State = 'intro';
  private progress = 0;
  private attempts = 0;
  private fartNum = 60;

  constructor(container: HTMLElement) {
    super(container, {
      generator: starGenerator,
      spawn: new THREE.Vector3(6.5, STAR_GROUND + 1, 0.5),
      sandbox: false,
      sky: 0x02030a,
      radius: 5,
      fog: false
    });
    this.ui = new StoryUi(COLORS);
    this.dave.group.rotation.y = Math.PI / 2;
    this.yaw = -Math.PI / 2;
    this.pitch = 0.25;
    this.camDist = 6;
    this.addStars();
    this.scene.add(this.ambient.points);

    this.pim.group.scale.setScalar(0.6);
    this.scene.add(this.pim.group);
    this.bubble = new THREE.Mesh(
      new THREE.SphereGeometry(1.7, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0x7fd3ff, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide })
    );
    this.scene.add(this.bubble);

    // The inverted tension ring
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);width:150px;height:150px;display:none;z-index:11;pointer-events:none;font-family:system-ui,sans-serif;color:#fff;text-align:center';
    wrap.innerHTML = `<div data-r="ring" style="width:150px;height:150px;border-radius:50%;box-shadow:0 0 24px rgba(0,0,0,.6)"></div>
      <div style="position:absolute;inset:14px;border-radius:50%;background:#05070f"></div>
      <div data-r="label" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 13px system-ui,sans-serif;letter-spacing:1.4px;padding:0 26px;line-height:1.3"></div>`;
    document.body.appendChild(wrap);
    this.ringEl = wrap.querySelector('[data-r="ring"]') as HTMLElement;
    this.ringLabel = wrap.querySelector('[data-r="label"]') as HTMLElement;
    (this.ringEl.parentElement as HTMLElement).dataset.id = 'ringwrap';

    window.addEventListener('keydown', (e) => {
      if ((e.code === 'KeyF' || e.code === 'Space' || e.code === 'Enter') && !e.repeat) this.release();
    });
    window.addEventListener('mousedown', () => this.release());
    (window as unknown as { __act5?: Act5 }).__act5 = this;

    this.frozen = true;
    this.runIntro();
  }

  private addStars() {
    const n = 1800;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 300 + Math.random() * 60;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(Math.random() * 2 - 1);
      pos[i * 3] = 20 + r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = 26 + r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false })));
  }

  private runIntro() {
    this.ui.say(
      [
        { who: 'Narrator', text: 'The Source was a dead star, cooled to a quiet crust, at the very end of everything.' },
        { who: 'Pim', text: 'There is the tree. It is very large. It looks like it has been waiting.', whisper: true },
        { who: 'Dave', text: 'So I just... eat the bean?' },
        { who: 'Pim', text: 'No. The cure is not a thing you eat. Glorb said so. I believe it is something you... do. Quietly.', whisper: true }
      ],
      () => {
        this.state = 'walk';
        this.frozen = false;
        this.ui.setObjective('Follow the glowing path to the Bean Tree.');
      }
    );
  }

  private ritual() {
    this.state = 'ritual';
    this.frozen = true;
    this.ui.setObjective(null);
    this.ui.say(
      [
        { who: 'Narrator', text: 'Beneath the tree, Dave felt it. The familiar, enormous, doubling urge. Fart number sixty-one.' },
        { who: 'Pim', text: 'Dave. Listen. Every fart you have ever done, you pushed. This one you must not.', whisper: true },
        { who: 'Pim', text: 'Hold it. Breathe. When the ring turns green, let it go... gently.', whisper: true },
        { who: 'Dave', text: 'So the whole saga comes down to not doing the thing.' },
        { who: 'Narrator', text: 'It had always, secretly, come down to that.' },
        { who: 'Pim', text: 'Press F or click only when the ring is green. Too early, and... well. You know.', whisper: true }
      ],
      () => this.beginHold()
    );
  }

  private beginHold() {
    this.state = 'hold';
    this.frozen = true;
    this.progress = 0;
    (this.ringEl.parentElement as HTMLElement).style.display = 'block';
    this.ui.setObjective('Wait. Let the ring fill. Release only in the green window (F, Space or click).');
  }

  private release() {
    if (this.state !== 'hold') return;
    if (this.progress >= WIN_FROM && this.progress <= WIN_TO) this.win();
    else this.lose(false);
  }

  private lose(forced: boolean) {
    this.attempts++;
    this.fartNum++;
    this.progress = 0;
    this.bubbleFlash = 1.6;
    this.shake = 0.6;
    this.dave.triggerFartVFX(14);
    fartAudio.playBeep(70, 0.35, 0.04);
    this.ui.popup(LOUD[Math.min(LOUD.length - 1, this.attempts - 1)] + (forced ? ' (it got away from him)' : ' (too early)'), 1800);
  }

  private win() {
    this.state = 'finale';
    (this.ringEl.parentElement as HTMLElement).style.display = 'none';
    this.ui.setObjective(null);
    this.ui.popup('...', 2500);
    this.dave.triggerFartVFX(3);
    this.spawnFleet();
    this.ui.say(
      [
        { who: 'Narrator', text: 'Silence. Real silence. Not the Hush Field kind. The kind you get when something finally stops.' },
        { who: 'Narrator', text: 'On the Bean Tree, a single bean turned pale, and then white, and then quietly fell off.' },
        { who: 'Pim', text: 'Dave. The doubling... it has reset. You are back to times one.', whisper: true },
        { who: 'Dave', text: 'Wait, really? Let me check.', action: () => fartAudio.playBeep(260, 0.07, 0.02) },
        { who: 'Narrator', text: 'It was a small, normal, almost polite noise. It was, scientifically, a fart.' },
        { who: 'Everyone', text: 'A STANDING OVATION!', action: () => this.cast.forEach((q) => q.cheer(30)) },
        { who: 'Captain Murmur', text: 'I... did not faint. I would like that noted.', whisper: true },
        { who: 'Elder Sibilance', text: 'Well. That was... lovely.', whisper: true },
        { who: 'Dave', text: 'Can you help me rebuild Earth? I owe it an apology.' },
        { who: 'Pim', text: 'Of course. We will do it quietly. Block by block.', whisper: true },
        { who: 'Narrator', text: 'Dave is fine. Dave would like the toast.' }
      ],
      () => {
        this.state = 'end';
        this.ui.showEnd({
          act: 'ACT V',
          title: 'Dave Is Fine (For Real This Time)',
          blurb: 'The doubling is over. The Quell fleet is applauding. Earth is waiting to be rebuilt, one block at a time.',
          nextHref: '?mode=voxel',
          nextLabel: 'REBUILD EARTH (SANDBOX)',
          stats: `Attempts at the silent fart: <b>${this.attempts + 1}</b> &nbsp;·&nbsp; Planets inconvenienced: <b>all of them</b> &nbsp;·&nbsp; Pigeons: <b>fine</b>`
        });
      }
    );
  }

  private spawnFleet() {
    const defs: [number, number, number, number, number?, boolean?][] = [
      [1.95, 0x6fc3bb, 0xffe27a, 0x23304f],
      [2.7, 0xeef1f7, 0x9fb4cf, 0xc9d4ea],
      [1.95, 0x8fbf9f, 0xffd166, 0xf5f5f0, undefined, false]
    ];
    defs.forEach(([h, body, accent, hat, , antenna], i) => {
      const q = new Quell({ height: h, body, accent, hat, antenna });
      q.group.position.set(TREE.x - 9 + i * 1.5, STAR_GROUND + 1, -5 + i * 5);
      this.scene.add(q.group);
      this.cast.push(q);
    });
    for (let i = 0; i < 8; i++) {
      const q = new Quell({ height: 1.15 + (i % 3) * 0.2, body: [0xb9a7e8, 0xa7d3e8, 0xe8c7a7][i % 3], accent: 0xff9ccf });
      const a = (i / 8) * Math.PI;
      q.group.position.set(TREE.x - 11 + Math.cos(a) * 3, STAR_GROUND + 1, -10 + i * 2.6);
      this.scene.add(q.group);
      this.cast.push(q);
    }
  }

  protected override onFrame(dt: number) {
    if (this.state === 'ritual' && (input.actions.fartPressed || input.actions.jumpPressed)) this.release();
    this.ambient.update(this.pos, dt);
    const t = performance.now() * 0.001;
    if (this.state === 'walk' && Math.hypot(this.pos.x - (TREE.x - 8), this.pos.z - TREE.z) < 3) this.ritual();

    if (this.state === 'hold') {
      this.progress += dt / RING_SECONDS;
      const green = this.progress >= WIN_FROM && this.progress <= WIN_TO;
      const deg = Math.min(1, this.progress) * 360;
      const w0 = WIN_FROM * 360;
      const w1 = WIN_TO * 360;
      this.ringEl.style.background = `conic-gradient(#ff6b5a 0deg ${Math.min(deg, w0)}deg, ${deg > w0 ? (green ? '#5bff8a' : '#ff6b5a') : 'rgba(255,255,255,.12)'} ${w0}deg ${Math.min(deg, w1)}deg, ${deg > w1 ? '#ff6b5a' : 'rgba(255,255,255,.12)'} ${w1}deg ${deg}deg, rgba(255,255,255,.12) ${deg}deg 360deg)`;
      // The window itself is always visible as a green notch
      this.ringEl.style.outline = '0';
      this.ringLabel.textContent = green ? 'NOW. GENTLY.' : this.progress < WIN_FROM ? 'HOLD IT...' : 'TOO LATE!';
      this.ringLabel.style.color = green ? '#5bff8a' : '#fff';
      this.shake = Math.max(this.shake, this.progress * 0.05); // the urge trembles the camera
      if (this.progress >= 1) this.lose(true);
    }

    this.cast.forEach((q) => {
      q.lookAtPoint(this.pos.x, this.pos.z, dt);
      q.update(dt);
    });
    const yaw = this.dave.group.rotation.y;
    this.pim.group.position.set(this.pos.x + Math.cos(yaw) * 0.28, this.pos.y + 1.42, this.pos.z - Math.sin(yaw) * 0.28);
    this.pim.group.rotation.y = dampAngle(this.pim.group.rotation.y, yaw, 8, dt);
    this.pim.update(dt);

    this.bubbleFlash = damp(this.bubbleFlash, 0, 5, dt);
    this.bubble.position.set(this.pos.x, this.pos.y + 0.9, this.pos.z);
    this.bubble.scale.setScalar(1 + Math.sin(t * 2) * 0.02 + this.bubbleFlash * 0.18);
    (this.bubble.material as THREE.MeshBasicMaterial).opacity = 0.08 + this.bubbleFlash * 0.3;
  }
}
