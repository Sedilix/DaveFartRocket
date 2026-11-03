import * as THREE from 'three';
import { VoxelGame } from '../voxel/VoxelGame';
import { B } from '../voxel/blocks';
import { CHUNK, WORLD_H, idx } from '../voxel/terrain';
import { fartAudio } from '../audio/FartSynth';
import { damp } from '../core/animMath';
import { Quell } from './Quell';
import { StoryUi } from './StoryUi';

// ---------------------------------------------------------------- the ship (a block-built interior)

const FLOOR_Y = 10; // top of the floor blocks is y = 11, where Dave's feet rest
const CONSOLE = new THREE.Vector3(58.5, 11, 16.5);

function shipBlock(x: number, y: number, z: number): number {
  if (x < 0 || x > 63 || z < 0 || z > 31 || y < FLOOR_Y || y > 16) return B.AIR;

  // Fragile heirlooms (the plot depends on them being in the way)
  if (x === 18 && z === 9) {
    if (y === 11) return B.PLANKS; // the Heirloom Vase of Quiet
    if (y === 12 || y === 13) return B.GLASS;
  }
  if (z === 22) {
    // the Whisper Harp
    if ((x === 26 || x === 28) && y >= 11 && y <= 14) return B.PLANKS;
    if (x === 27 && y === 14) return B.PLANKS;
    if (x === 27 && (y === 12 || y === 13)) return B.GLASS;
  }
  if (x >= 32 && x <= 34 && z >= 9 && z <= 11 && y === 11) return B.CUSHION; // the Sacred Pillow
  if (x === 33 && z === 10 && y === 12) return B.CUSHION;
  // Briefing room: console and benches
  if (x >= 57 && x <= 58 && z >= 15 && z <= 17 && y === 11) return B.PANEL;
  if (x === 58 && z === 16 && y === 12) return B.GLOW;
  if ((z === 10 || z === 22) && x >= 48 && x <= 52 && y === 11) return B.CUSHION;

  const interior = x >= 1 && x <= 62 && z >= 1 && z <= 30 && y >= 11 && y <= 15;
  if (!interior) {
    if (y === 16 && (x - 3) % 6 === 0 && (z === 8 || z === 15 || z === 16 || z === 23)) return B.GLOW; // lamps
    if (y === FLOOR_Y && x >= 10 && x <= 40 && z >= 12 && z <= 19) return B.CUSHION; // carpet
    if ((z === 0 || z === 31) && x >= 12 && x <= 40 && y >= 12 && y <= 14 && x % 6 !== 0) return B.GLASS; // windows
    return B.HULL;
  }
  // Bulkheads with a doorway each: airlock | hall | briefing room
  if ((x === 9 || x === 41) && !(z >= 14 && z <= 17 && y <= 13)) return B.HULL;
  return B.AIR;
}

function shipGenerator(data: Uint8Array, cx: number, cz: number) {
  if (cx < 0 || cx > 3 || cz < 0 || cz > 1) return;
  for (let y = FLOOR_Y; y <= 16 && y < WORLD_H; y++) {
    for (let lz = 0; lz < CHUNK; lz++) {
      const z = cz * CHUNK + lz;
      for (let lx = 0; lx < CHUNK; lx++) {
        const x = cx * CHUNK + lx;
        const b = shipBlock(x, y, z);
        if (b !== B.AIR) data[idx(lx, y, lz)] = b;
      }
    }
  }
}

// ---------------------------------------------------------------- Act I

const SPEAKER_COLOR: Record<string, string> = {
  Narrator: '#9fb4cf',
  Dave: '#ffd166',
  Pim: '#7fd3ff',
  'Captain Murmur': '#ff9fa8'
};

const MUTED_POPS = ['(pfft)', '(prrp)', '(a respectful toot)', '(brp, but quietly)'];

type State = 'intro' | 'play' | 'failed' | 'briefing' | 'end';

/** Act I: first contact. Dave meets the Quell, learns what is wrong with him, and has to walk to the briefing room while his farts keep happening. */
export class Act1 extends VoxelGame {
  public ui: StoryUi;
  private pim = new Quell({ height: 1.15, body: 0xb9a7e8, accent: 0xff9ccf });
  private captain = new Quell({ height: 2.1, body: 0x6fc3bb, accent: 0xffe27a, hat: 0x23304f });
  private bubble: THREE.Mesh;
  private bubbleFlash = 0;

  public state: State = 'intro';
  public meter = 100;
  private fartTimer = 3;
  private fartCost = 14;
  private fartNum = 26;
  public casualties = 0;
  public vasesLost = 0;
  private humTick = 0;

  constructor(container: HTMLElement) {
    super(container, {
      generator: shipGenerator,
      spawn: new THREE.Vector3(3.5, 11, 15.5),
      sandbox: false,
      sky: 0x04050c,
      radius: 3,
      fog: false
    });

    this.ui = new StoryUi(SPEAKER_COLOR);
    this.addStars();
    this.dave.group.rotation.y = Math.PI / 2; // facing along the ship
    this.yaw = 0;
    this.pitch = 0.12;
    this.camDist = 7;

    this.captain.group.position.set(6.8, 11, 14.4);
    this.captain.group.rotation.y = -Math.PI / 2;
    this.pim.group.position.set(6.6, 11, 16.8);
    this.pim.group.rotation.y = -Math.PI / 2;
    this.scene.add(this.captain.group, this.pim.group);

    // The Hush Field around Dave
    this.bubble = new THREE.Mesh(
      new THREE.SphereGeometry(1.7, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0x7fd3ff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide })
    );
    this.scene.add(this.bubble);

    (window as unknown as { __act1?: Act1 }).__act1 = this;

    this.frozen = true;
    this.runIntro();
  }

  // ---------------------------------------------------------------- scenery

  private addStars() {
    const n = 1500;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 260 + Math.random() * 80;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(Math.random() * 2 - 1);
      pos[i * 3] = 32 + r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = 13 + r * Math.cos(ph);
      pos[i * 3 + 2] = 16 + r * Math.sin(ph) * Math.sin(th);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false })));
  }

  // ---------------------------------------------------------------- the story beats

  private runIntro() {
    this.ui.say(
      [
        { who: 'Narrator', text: 'Dave had been rescued. Throughout, he had been fine.' },
        { who: 'Narrator', text: 'The Quell are a gentle, noise-averse species. They had prepared a welcome. It was extremely quiet.' },
        { who: 'Captain Murmur', text: 'Welcome aboard the Whisper. Please... do not... do anything.', whisper: true, mood: 'worried' },
        { who: 'Dave', text: 'Hi! Thanks for the lift. So sorry about Earth.', mood: 'delighted' },
        { who: 'Narrator', text: 'Dave said "sorry" with his whole chest, which was the problem.', action: () => this.cinematicFart() },
        { who: 'Narrator', text: 'The Hush Field held. The captain did not.' },
        { who: 'Pim', text: 'I am Pim. I have been assigned to you. I would like it noted that I did not volunteer.', whisper: true, mood: 'deadpan' },
        { who: 'Pim', text: 'We will walk to the briefing room. Your... events... will continue. I will hum. Please stay near things that are not fragile.', whisper: true, mood: 'worried' },
        { who: 'Narrator', text: 'Everything on the ship was fragile.' },
        {
          who: 'Pim',
          text: 'Follow the glowing lamps. Hold H and I will hum, which refills the Hush field. Do not let it run out.',
          whisper: true,
          mood: 'worried'
        }
      ],
      () => this.beginPlay()
    );
  }

  private cinematicFart() {
    this.doFart();
    this.captain.faint();
  }

  private beginPlay() {
    this.state = 'play';
    this.frozen = false;
    this.meter = 100;
    this.fartCost = 14;
    this.fartTimer = 2.5;
    this.yaw = -Math.PI / 2; // camera behind Dave, looking along the ship
    this.pitch = 0.3;
    this.camDist = 6;
    this.ui.showMeter('HUSH FIELD', `Cushions Inconvenienced: ${this.casualties}`, 'Follow the glowing lamps to the briefing room. Hold H: Pim hums, the Hush field refills.');
  }

  private doFart() {
    this.fartNum++;
    this.dave.triggerFartVFX(Math.min(14, this.fartNum - 12));
    this.shake = 0.22;
    this.bubbleFlash = 1;
    this.casualties += 1 + Math.floor(Math.random() * 5);
    this.ui.updateMeter(this.meter, `Cushions Inconvenienced: ${this.casualties}`);
    // The field mutes it for everyone aboard, so the "sound" is a tiny, apologetic thing
    fartAudio.playBeep(130, 0.09, 0.02);
    this.ui.popup(MUTED_POPS[Math.floor(Math.random() * MUTED_POPS.length)], 900);
  }

  private fail() {
    this.state = 'failed';
    this.frozen = true;
    this.vasesLost++;
    this.shake = 0.5;
    this.ui.hideMeter();
    this.ui.say(
      [
        { who: 'Narrator', text: 'The Hush field failed. The Heirloom Vase of Quiet had lived a long, quiet life. It ended here.' },
        { who: 'Pim', text: 'That was a four-thousand-year-old vase. It had a name. Never mind. Let us try again, gently.', whisper: true, mood: 'deadpan' }
      ],
      () => {
        this.pos.set(11.5, 11, 15.5);
        this.vy = 0;
        this.dave.group.position.copy(this.pos);
        this.meter = 100;
        this.fartCost = 14;
        this.fartTimer = 3;
        this.state = 'play';
        this.frozen = false;
        this.ui.showMeter('HUSH FIELD', `Cushions Inconvenienced: ${this.casualties}`, 'Follow the glowing lamps to the briefing room. Hold H: Pim hums, the Hush field refills.');
      }
    );
  }

  private startBriefing() {
    this.state = 'briefing';
    this.frozen = true;
    this.ui.hideMeter();
    this.pim.setHumming(false);
    this.ui.say(
      [
        { who: 'Pim', text: 'This is the briefing room. It is the quietest room in the galaxy. Please stand extremely still.', whisper: true, mood: 'worried' },
        { who: 'Pim', text: 'Before the incident... did you eat anything unusual?', whisper: true, mood: 'deadpan' },
        { who: 'Dave', text: 'Just the brunch special. A bean thing. It was actually really good.', mood: 'delighted' },
        { who: 'Pim', text: 'It is a Doubling Bean. It has been banned for four thousand years. It does not digest. It grows.', whisper: true, mood: 'horrified' },
        { who: 'Narrator', text: 'Dave remembered the brunch special. The brunch special did not remember him fondly.' },
        { who: 'Pim', text: 'Every event is exactly twice the last. Our field can swallow the blast. It cannot stop the event.', whisper: true, mood: 'worried' },
        { who: 'Dave', text: 'So... is there a cure?', mood: 'neutral' },
        { who: 'Pim', text: 'There is no cure. There is a rumour. On the Moon of Nom, where... they... enjoy this sort of thing.', whisper: true, mood: 'worried' },
        { who: 'Narrator', text: 'And so, at roughly the speed of a whisper, the saga began.' }
      ],
      () => this.finishAct()
    );
  }

  private finishAct() {
    this.state = 'end';
    this.ui.hideMeter();
    this.ui.showEndScreen({
      act: 'ACT I',
      title: 'A Very Quiet Briefing',
      blurb: 'Next: Act II, The Moon of Nom. Where the farts are holy and the bridge is under construction.',
      stats: `Cushions inconvenienced: ${this.casualties}  ·  Vases lost: ${this.vasesLost}`,
      nextHref: '?mode=act2',
      nextLabel: 'CONTINUE TO ACT II'
    });
  }

  // ---------------------------------------------------------------- per-frame

  protected override onFrame(dt: number) {
    const t = performance.now() * 0.001;

    if (this.state === 'play') {
      const humming = this.keys.has('KeyH');
      this.pim.setHumming(humming);
      if (humming) {
        this.meter = Math.min(100, this.meter + 16 * dt);
        this.humTick -= dt;
        if (this.humTick <= 0) {
          this.humTick = 0.3;
          fartAudio.playBeep(210 + Math.random() * 20, 0.22, 0.008);
        }
      }

      this.fartTimer -= dt;
      if (this.fartTimer <= 0) {
        this.fartTimer = 3;
        this.meter -= this.fartCost;
        this.fartCost = Math.min(120, this.fartCost * 2);
        this.doFart();
        if (this.meter <= 0) {
          this.meter = 0;
          this.fail();
        }
      }

      const near = Math.hypot(this.pos.x - CONSOLE.x, this.pos.z - CONSOLE.z);
      if (this.state === 'play' && near < 4) this.startBriefing();
    }

    // HUD meter update
    if (this.state === 'play') {
      this.ui.updateMeter(this.meter);
    }

    // Pim follows Dave once the walk starts
    if (this.state === 'play' || this.state === 'failed') {
      const tx = Math.max(2, this.pos.x - 1.7);
      const tz = this.pos.z + 1.5;
      const p = this.pim.group.position;
      p.x = damp(p.x, tx, 3, dt);
      p.z = damp(p.z, tz, 3, dt);
      this.pim.lookAtPoint(this.pos.x, this.pos.z, dt);
    } else if (this.state === 'briefing') {
      this.pim.lookAtPoint(this.pos.x, this.pos.z, dt);
    }
    this.pim.update(dt);
    this.captain.update(dt);

    // The Hush field bubble: always faintly there, flares on every event
    this.bubbleFlash = damp(this.bubbleFlash, 0, 5, dt);
    this.bubble.position.set(this.pos.x, this.pos.y + 0.9, this.pos.z);
    const s = 1 + Math.sin(t * 2) * 0.02 + this.bubbleFlash * 0.18;
    this.bubble.scale.setScalar(s);
    (this.bubble.material as THREE.MeshBasicMaterial).opacity = 0.1 + this.bubbleFlash * 0.35;
  }
}
