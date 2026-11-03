import * as THREE from 'three';
import { VoxelGame } from '../voxel/VoxelGame';
import { B } from '../voxel/blocks';
import { CHUNK, WORLD_H, idx } from '../voxel/terrain';
import { fartAudio } from '../audio/FartSynth';
import { damp } from '../core/animMath';
import { Quell } from './Quell';
import { StoryUi } from './StoryUi';
import { HushBubble } from '../vfx/HushBubble';
import { AmbientParticles } from '../vfx/AmbientParticles';
import { audio } from '../audio/AudioEngine';
import { S1_SCRIPT } from './script';
import { progression } from '../core/progression';
import { input } from '../input/UniversalInput';

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
  private hushBubble = new HushBubble(1.7);
  private ambient = new AmbientParticles('ship', 220);

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

    // The Hush Field and ambient dust motes
    this.scene.add(this.hushBubble.mesh);
    this.scene.add(this.ambient.points);

    (window as unknown as { __act1?: Act1 }).__act1 = this;

    this.frozen = true;
    audio.playTheme('s1_ship');
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
    const lines = S1_SCRIPT.intro.map((l, i) => (i === 4 ? { ...l, action: () => this.cinematicFart() } : l));
    this.ui.say(lines, () => this.beginPlay());
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
    this.hushBubble.triggerFlash(1.0);
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
    this.ui.say(S1_SCRIPT.fail, () => {
      this.pos.set(11.5, 11, 15.5);
      this.vy = 0;
      this.dave.group.position.copy(this.pos);
      this.meter = 100;
      this.fartCost = 14;
      this.fartTimer = 3;
      this.state = 'play';
      this.frozen = false;
      this.ui.showMeter('HUSH FIELD', `Cushions Inconvenienced: ${this.casualties}`, 'Follow the glowing lamps to the briefing room. Hold H: Pim hums, the Hush field refills.');
    });
  }

  private startBriefing() {
    this.state = 'briefing';
    this.frozen = true;
    this.ui.hideMeter();
    this.pim.setHumming(false);
    this.ui.say(S1_SCRIPT.briefing, () => this.finishAct());
  }

  private finishAct() {
    this.state = 'end';
    this.ui.hideMeter();

    // Persist cross-act casualties and unlock Act II
    progression.addCasualties(this.casualties + this.vasesLost * 10);
    progression.completeAct(1, { casualties: this.casualties, falls: this.vasesLost });
    progression.unlockAct(2);

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
    if (this.state === 'play') {
      const humming = this.keys.has('KeyH') || input.actions.hum;
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

    // Update Hush field and ambient particles
    this.hushBubble.update(this.pos, dt, this.meter);
    this.ambient.update(this.pos, dt);
  }
}
