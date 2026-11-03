import * as THREE from 'three';
import { VoxelGame } from '../voxel/VoxelGame';
import { fartAudio } from '../audio/FartSynth';
import { dampAngle } from '../core/animMath';
import { Quell } from './Quell';
import { StoryUi } from './StoryUi';
import { DRUM, GROUND, HORN, ISLAND, RAVINE_X0, RAVINE_X1, jungleGenerator } from './jungle';
import { input } from '../input/UniversalInput';
import { HushBubble } from '../vfx/HushBubble';
import { AmbientParticles } from '../vfx/AmbientParticles';

const COLORS: Record<string, string> = {
  Narrator: '#9fb4cf',
  Dave: '#ff9a62',
  Pim: '#c8b8ff',
  'Big Toot': '#ff7a4a',
  Nomads: '#ffd166'
};

const NOMAD_SHOUTS = ['THE GUST!', 'HOLY WIND!', 'AGAIN!', 'WHAT A PROPHET!', 'BLESS THIS GUST!'];
const MUTED_POPS = ['(pfft)', '(prrp)', '(a respectful toot)', '(brp, but quietly)'];

type State = 'intro' | 'play' | 'plaza' | 'horn' | 'finale' | 'end';

/** Act II: the Moon of Nom. Cross the gulch on doubling fart-boosts, then open the Festival of the Great Gust. */
export class Act2 extends VoxelGame {
  private ui: StoryUi;
  private pim = new Quell({ height: 1.15, body: 0xb9a7e8, accent: 0xff9ccf });
  private toot = new Quell({ height: 2.7, body: 0xa5522d, accent: 0xff5b2e, antenna: false, headdress: 0xe0452b });
  private nomads: Quell[] = [];
  private hushBubble = new HushBubble(1.7);
  private ambient = new AmbientParticles('jungle', 260);

  private state: State = 'intro';
  private fartNum = 26;
  private chain = 0;
  private chainTimer = 0;
  private cooldown = 0;
  private checkpoint = new THREE.Vector3(3.5, GROUND + 1, 0.5);
  private falls = 0;
  private quipped = false;
  private fartsTotal = 0;
  private humTick = 0;

  constructor(container: HTMLElement) {
    super(container, {
      generator: jungleGenerator,
      spawn: new THREE.Vector3(3.5, GROUND + 1, 0.5),
      sandbox: false,
      sky: 0x9ad8e8,
      radius: 6,
      fog: true
    });

    this.ui = new StoryUi(COLORS);
    this.dave.group.rotation.y = Math.PI / 2;
    this.yaw = -Math.PI / 2;
    this.pitch = 0.22;
    this.camDist = 6;

    // Pim rides on Dave's shoulder, clutching his collar
    this.pim.group.scale.setScalar(0.6);
    this.scene.add(this.pim.group);

    this.toot.group.position.set(8.5, GROUND + 1, 0.5);
    this.toot.group.rotation.y = -Math.PI / 2;
    this.scene.add(this.toot.group);
    this.spawnNomads();

    this.scene.add(this.hushBubble.mesh);
    this.scene.add(this.ambient.points);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyF' && !e.repeat) this.tryFart();
    });

    // Handy for manual testing from the console: __act2.pos, __act2.pos.set(...)
    (window as unknown as { __act2?: Act2 }).__act2 = this;

    this.frozen = true;
    this.runIntro();
  }

  // ---------------------------------------------------------------- the cast

  private spawnNomads() {
    const palettes = [0xc8884e, 0xb87442, 0xd9a066, 0xa86a3c];
    const feathers = [0xe0452b, 0x2fa8c9, 0xf2b630, 0x7bc043];
    const spots: [number, number][] = [
      [10, 3], [17, -3], [23, 3], [28, -3], [34, 3], // the village
      [84, 5], [86, -6], [93, 6], [95, -5], [88, 8], [92, -9], [82, -2] // the plaza crowd
    ];
    spots.forEach(([x, z], i) => {
      const n = new Quell({
        height: 1.75 + (i % 3) * 0.1,
        body: palettes[i % palettes.length],
        accent: 0xd8452b,
        antenna: false,
        headdress: feathers[i % feathers.length]
      });
      n.group.position.set(x, GROUND + 1, z);
      n.group.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(n.group);
      this.nomads.push(n);
    });
  }

  // ---------------------------------------------------------------- story beats

  private runIntro() {
    this.ui.say(
      [
        { who: 'Narrator', text: 'The Moon of Nom was lush, humid, and loud, in the way a place is loud when nobody in it is afraid of noise.' },
        { who: 'Pim', text: 'The humidity is dreadful for my antennae. Also I have been told to ride on your shoulder. I did not agree to this.', whisper: true },
        { who: 'Big Toot', text: 'BEHOLD! THE PROPHET ARRIVES WITH THE WIND IN HIS BELLY!', shout: true },
        { who: 'Dave', text: 'Oh. Hi. I am just looking for a cure, honestly.' },
        { who: 'Big Toot', text: 'THE CURE LIES ACROSS THE GULCH! THE BRIDGE IS BROKEN! IT WAS BROKEN BY THE LAST PROPHET!', shout: true },
        { who: 'Narrator', text: 'This was, by the village\'s count, the third prophet that decade.' },
        { who: 'Pim', text: 'Dave. They want you to fart across it.', whisper: true },
        { who: 'Dave', text: 'Is that safe?' },
        { who: 'Pim', text: 'Define safe.', whisper: true },
        { who: 'Narrator', text: 'Each fart in a quick chain is twice the last, so the Nomads call it "building a gust".' }
      ],
      () => this.beginPlay()
    );
  }

  private beginPlay() {
    this.state = 'play';
    this.frozen = false;
    this.toot.group.position.set(HORN.x - 4, GROUND + 1, 0.5); // runs ahead to the plaza
    this.toot.group.rotation.y = Math.PI;
    this.ui.setObjective('Cross the Gulch. Press F to fart-boost: chain them within 2.5 s and each one is twice as strong.');
  }

  private tryFart() {
    if (this.frozen || this.cooldown > 0) return;
    if (this.state === 'horn') {
      const d = Math.hypot(this.pos.x - HORN.x, this.pos.z - HORN.z);
      if (d < 6) {
        this.openFestival();
        return;
      }
    }
    if (this.state !== 'play' && this.state !== 'horn' && this.state !== 'plaza') return;
    this.boost();
  }

  /** A fart boost: a hop forward that doubles for every fart chained within 2.5 s. */
  private boost() {
    this.chain = this.chainTimer > 0 ? Math.min(3, this.chain + 1) : 0;
    this.chainTimer = 2.5;
    this.cooldown = 0.45;
    const power = 2 ** this.chain; // 1, 2, 4, 8
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const h = 6 * power;
    this.extraVel.x += fx * h;
    this.extraVel.z += fz * h;
    const cap = 24;
    const sp = Math.hypot(this.extraVel.x, this.extraVel.z);
    if (sp > cap) {
      this.extraVel.x *= cap / sp;
      this.extraVel.z *= cap / sp;
    }
    this.vy = Math.max(this.vy, 7.5 + this.chain * 2.2);
    this.onGround = false;

    this.fartNum++;
    this.fartsTotal++;
    this.dave.triggerFartVFX(Math.min(14, 6 + this.chain * 2));
    this.hushBubble.triggerFlash(1.0);
    this.shake = 0.1 + this.chain * 0.08;
    fartAudio.playBeep(120 + this.chain * 30, 0.1, 0.02);
    this.ui.setChain(`FART #${this.fartNum}  ·  GUST x${power}`);
    // The field mutes the sound; the Nomads cheer anyway once a gust builds
    const pool = this.chain >= 1 ? NOMAD_SHOUTS : MUTED_POPS;
    this.ui.popup(pool[Math.floor(Math.random() * pool.length)], 800);
    // Nomads in earshot cheer
    this.nomads.forEach((n) => {
      if (Math.hypot(n.group.position.x - this.pos.x, n.group.position.z - this.pos.z) < 30) n.cheer(1.3);
    });
  }

  private openFestival() {
    this.state = 'finale';
    this.frozen = true;
    this.chain = 0;
    this.ui.setObjective(null);
    this.ui.say(
      [
        {
          who: 'Narrator',
          text: 'Dave stood before the Gust Horn, a sacred instrument older than the moon\'s oldest joke.',
          action: () => {
            this.fartNum++;
            this.fartsTotal++;
            this.dave.triggerFartVFX(14);
            this.hushBubble.triggerFlash(1.6);
            this.shake = 0.7;
            this.nomads.forEach((n) => n.cheer(8));
            this.toot.cheer(8);
            fartAudio.playBeep(90, 0.3, 0.03);
          }
        },
        { who: 'Narrator', text: 'The Hush Field swallowed the blast. The Nomads, who had never heard of one, were thrilled by the lack of consequences.' },
        { who: 'Nomads', text: 'THE GREAT GUST HAS BEEN OPENED!', shout: true },
        { who: 'Big Toot', text: 'THE PROPHET HAS BLESSED US! YOU MAY APPROACH THE SACRED DRUM!', shout: true },
        { who: 'Pim', text: 'The drum has a recipe carved into it. The bean. And a name: the one who planted it.', whisper: true },
        { who: 'Big Toot', text: 'HE NOW RUNS A HOTEL! ON THE ICE MOON! IT IS TERRIBLE! GO WITH OUR BLESSING!', shout: true },
        { who: 'Narrator', text: 'Somewhere behind them, the broken bridge fixed itself out of embarrassment.' },
        { who: 'Dave', text: 'Okay. Hotel on the ice moon. I can do that.' },
        { who: 'Narrator', text: 'Dave could not, in fact, do that. But he went anyway.' }
      ],
      () => this.finish()
    );
  }

  private finish() {
    this.state = 'end';
    this.ui.showEnd({
      act: 'ACT II',
      title: 'A Gust of Wind (and Other Prophecies)',
      blurb: 'Next: Act III, Frostbite Hotel. Where the concierge has a confession and the elevator has questions.',
      nextHref: '?mode=act3',
      nextLabel: 'CONTINUE TO ACT III',
      stats: `Farts this act: <b>${this.fartsTotal}</b> &nbsp;·&nbsp; Times Dave fell in the gulch: <b>${this.falls}</b> &nbsp;·&nbsp; Prophet approval: <b>100%</b>`
    });
  }

  // ---------------------------------------------------------------- per-frame

  protected override onFrame(dt: number) {
    if (input.actions.fartPressed) this.tryFart();
    const t = performance.now() * 0.001;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.chainTimer > 0) {
      this.chainTimer -= dt;
      if (this.chainTimer <= 0) {
        this.chain = 0;
        this.ui.setChain(null);
      }
    }

    // Falling into the gulch is allowed (and funny), and sends Dave back to the last edge
    if (this.pos.y < GROUND - 4 && this.pos.x > RAVINE_X0 - 4 && this.pos.x < RAVINE_X1 + 4 && this.state !== 'end') {
      this.falls++;
      this.pos.copy(this.checkpoint);
      this.vy = 0;
      this.extraVel.set(0, 0, 0);
      this.dave.group.position.copy(this.pos);
      this.ui.popup('Dave fell. Dave was fine.', 1800);
    }
    if (this.pos.x > RAVINE_X1 + 3 && this.checkpoint.x < RAVINE_X1) this.checkpoint.set(RAVINE_X1 + 5.5, GROUND + 1, 0.5);
    if (!this.quipped && this.pos.x > ISLAND.x0 && this.pos.x < ISLAND.x1 && this.pos.y > GROUND - 1) {
      this.quipped = true;
      this.ui.popup('"HE IS HALFWAY! THE GUST IS STRONG IN THIS ONE!"', 2200);
    }

    // Reaching the plaza
    if (this.state === 'play' && this.pos.x > HORN.x - 16) {
      this.state = 'plaza';
      this.frozen = true;
      this.extraVel.set(0, 0, 0);
      this.ui.setChain(null);
      this.ui.say(
        [
          { who: 'Big Toot', text: 'HE HAS CROSSED THE GULCH! THE FESTIVAL OF THE GREAT GUST CAN BEGIN!', shout: true },
          { who: 'Pim', text: 'Please do not do the thing they want you to do.', whisper: true },
          { who: 'Dave', text: 'I think I have to do the thing they want me to do.' },
          { who: 'Narrator', text: 'This was, historically, how most of Dave\'s problems began.' }
        ],
        () => {
          this.state = 'horn';
          this.frozen = false;
          this.ui.setObjective('Walk to the Gust Horn in the middle of the plaza and press F.');
        }
      );
    }

    // NPC animation
    const faceDave = (n: Quell) => {
      const d = Math.hypot(n.group.position.x - this.pos.x, n.group.position.z - this.pos.z);
      if (d < 16) n.lookAtPoint(this.pos.x, this.pos.z, dt);
      n.update(dt);
    };
    this.nomads.forEach(faceDave);
    faceDave(this.toot);

    // Pim on the shoulder
    const yaw = this.dave.group.rotation.y;
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    this.pim.group.position.set(this.pos.x + rx * 0.28, this.pos.y + 1.42 + Math.sin(t * 7) * 0.01, this.pos.z + rz * 0.28);
    this.pim.group.rotation.y = dampAngle(this.pim.group.rotation.y, yaw, 8, dt);
    this.pim.update(dt);

    // Hush Field and ambient fireflies
    this.hushBubble.update(this.pos, dt, 100);
    this.ambient.update(this.pos, dt);

    // The drum is the finale's destination; keep a tiny reference so it is never tree-shaken away
    void DRUM;
    void this.humTick;
  }
}
