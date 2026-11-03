import * as THREE from 'three';
import { VoxelGame } from '../voxel/VoxelGame';
import { fartAudio } from '../audio/FartSynth';
import { damp, dampAngle } from '../core/animMath';
import { Quell } from './Quell';
import { StoryUi } from './StoryUi';
import { DESERT_GROUND, FINISH_X, desertGenerator } from './desert';
import { input } from '../input/UniversalInput';
import { AmbientParticles } from '../vfx/AmbientParticles';
import { audio } from '../audio/AudioEngine';

const COLORS: Record<string, string> = {
  Narrator: '#9fb4cf',
  Dave: '#ff9a62',
  Pim: '#c8b8ff',
  'Elder Sibilance': '#e8ecf5'
};
const MUTED_POPS = ['(pfft)', '(prrp)', '(a respectful toot)', '(brp, but quietly)'];

type State = 'intro' | 'chase' | 'finale' | 'end';

/** Act IV: the Elder's offer. Refuse it, then outrun the advancing Silence across the dunes. */
export class Act4 extends VoxelGame {
  private ui: StoryUi;
  private pim = new Quell({ height: 1.15, body: 0xb9a7e8, accent: 0xff9ccf });
  private elder = new Quell({ height: 2.7, body: 0xeef1f7, accent: 0x9fb4cf, hat: 0xc9d4ea });
  private ambient = new AmbientParticles('desert', 280);
  private bubble: THREE.Mesh;
  private silence: THREE.Mesh;
  private ship: THREE.Mesh;
  private bubbleFlash = 0;

  private state: State = 'intro';
  private wallX = -40;
  private wallSpeed = 0;
  private checkpoint = new THREE.Vector3(15.5, DESERT_GROUND + 1, 0.5);
  private fartNum = 50;
  private chain = 0;
  private chainTimer = 0;
  private cooldown = 0;
  private fartsTotal = 0;
  private caught = 0;

  constructor(container: HTMLElement) {
    super(container, {
      generator: desertGenerator,
      spawn: new THREE.Vector3(7.5, DESERT_GROUND + 1, 0.5),
      sandbox: false,
      sky: 0xf2d9a8,
      radius: 6,
      fog: true
    });
    this.ui = new StoryUi(COLORS);
    this.dave.group.rotation.y = Math.PI / 2;
    this.yaw = -Math.PI / 2;
    this.pitch = 0.25;
    this.camDist = 6;

    this.pim.group.scale.setScalar(0.6);
    this.scene.add(this.pim.group);
    this.elder.group.position.set(16, DESERT_GROUND + 1, 0.5);
    this.elder.group.rotation.y = -Math.PI / 2;
    this.scene.add(this.elder.group);
    this.scene.add(this.ambient.points);

    // The advancing Silence: a pale wall of hush with the vault ship riding above it
    this.silence = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 22, 90),
      new THREE.MeshBasicMaterial({ color: 0xf6f8ff, transparent: true, opacity: 0.45, depthWrite: false })
    );
    this.ship = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.scene.add(this.silence, this.ship);
    this.silence.visible = this.ship.visible = false;

    this.bubble = new THREE.Mesh(
      new THREE.SphereGeometry(1.7, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0x7fd3ff, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide })
    );
    this.scene.add(this.bubble);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyF' && !e.repeat) this.boost();
    });
    (window as unknown as { __act4?: Act4 }).__act4 = this;

    this.frozen = true;
    audio.playTheme('s4_desert');
    this.runIntro();
  }

  private runIntro() {
    this.ui.say(
      [
        { who: 'Narrator', text: 'The desert moon was silent in a way that suggested it had been told to be.' },
        { who: 'Elder Sibilance', text: 'Dave. Thank you for coming. Please... sit. Not on that. On nothing, if possible.', whisper: true },
        { who: 'Elder Sibilance', text: 'I will be brief. Each event is twice the last. In time, it will undo a star. I propose a silent vault. Ten thousand years. You will not feel a thing.', whisper: true },
        { who: 'Dave', text: 'Ten thousand years? What about Pim? What about the cure?' },
        { who: 'Elder Sibilance', text: 'There is no cure. There is only the vault. It is the reasonable answer.', whisper: true },
        { who: 'Narrator', text: 'It was, annoyingly, the reasonable answer.' },
        { who: 'Pim', text: 'No.', whisper: true },
        { who: 'Elder Sibilance', text: 'I beg your pardon?', whisper: true },
        { who: 'Pim', text: 'I said no. Run, Dave. RUN. Quietly. But run.', whisper: true },
        {
          who: 'Narrator',
          text: 'Above them, the vault ship unfolded like a very polite avalanche.',
          action: () => {
            this.silence.visible = this.ship.visible = true;
          }
        }
      ],
      () => {
        this.state = 'chase';
        this.frozen = false;
        this.wallX = this.pos.x - 22;
        this.wallSpeed = 3.8;
        this.ui.setObjective('Outrun the Silence! Run to the oasis arch. Press F to fart-boost forward; chain them to go faster.');
      }
    );
  }

  private boost() {
    if (this.frozen || this.cooldown > 0 || this.state !== 'chase') return;
    this.chain = this.chainTimer > 0 ? Math.min(3, this.chain + 1) : 0;
    this.chainTimer = 2.5;
    this.cooldown = 0.45;
    const power = 2 ** this.chain;
    this.extraVel.x += -Math.sin(this.yaw) * 5 * power;
    this.extraVel.z += -Math.cos(this.yaw) * 5 * power;
    const cap = 22;
    const sp = Math.hypot(this.extraVel.x, this.extraVel.z);
    if (sp > cap) {
      this.extraVel.x *= cap / sp;
      this.extraVel.z *= cap / sp;
    }
    this.vy = Math.max(this.vy, 6 + this.chain * 1.5);
    this.onGround = false;
    this.fartNum++;
    this.fartsTotal++;
    this.dave.triggerFartVFX(Math.min(14, 6 + this.chain * 2));
    this.bubbleFlash = 1;
    this.shake = 0.08 + this.chain * 0.06;
    fartAudio.playBeep(100 + this.chain * 30, 0.1, 0.02);
    this.ui.setChain(`FART #${this.fartNum}  ·  GUST x${power}`);
    this.ui.popup(MUTED_POPS[Math.floor(Math.random() * MUTED_POPS.length)], 700);
  }

  private finale() {
    this.state = 'finale';
    this.frozen = true;
    this.silence.visible = this.ship.visible = false;
    this.ui.setObjective(null);
    this.ui.setChain(null);
    this.ui.say(
      [
        { who: 'Narrator', text: 'Dave reached the oasis arch just ahead of the Silence, which stopped, politely, a metre behind him.' },
        { who: 'Elder Sibilance', text: 'Dave. Please come back. You do not understand what you are.', whisper: true },
        { who: 'Pim', text: 'I understand. He is a person who sneezed on a galaxy and is trying to say sorry.', whisper: true },
        { who: 'Narrator', text: 'Pim then gave a long speech about friendship, courage, and not being afraid of noise. It was delivered at a whisper to a dune. The dune was moved.' },
        { who: 'Elder Sibilance', text: '...Fine. Go to the Source. But if the silence breaks, it is on you.', whisper: true },
        { who: 'Dave', text: 'Thank you. And... I am sorry about the vase.' },
        { who: 'Narrator', text: 'The Elder, who had never been interrupted by an apology, left quietly to think about it.' }
      ],
      () => {
        this.state = 'end';
        this.ui.showEnd({
          act: 'ACT IV',
          title: 'The Quiet Before',
          blurb: 'Next: Act V, The Bean Tree at the End of the Universe. Where the only thing left to do is wait.',
          nextHref: '?mode=act5',
          nextLabel: 'CONTINUE TO ACT V',
          stats: `Fart-boosts: <b>${this.fartsTotal}</b> &nbsp;·&nbsp; Times caught by the Silence: <b>${this.caught}</b> &nbsp;·&nbsp; Dunes moved: <b>1</b>`
        });
      }
    );
  }

  protected override onFrame(dt: number) {
    if (input.actions.fartPressed) this.boost();
    this.ambient.update(this.pos, dt);
    const t = performance.now() * 0.001;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.chainTimer > 0) {
      this.chainTimer -= dt;
      if (this.chainTimer <= 0) {
        this.chain = 0;
        this.ui.setChain(null);
      }
    }

    if (this.state === 'chase') {
      this.wallSpeed = Math.min(4.6, this.wallSpeed + dt * 0.02);
      this.wallX += this.wallSpeed * dt;
      if (this.pos.x < this.wallX + 1) {
        // Caught: the Silence politely returns Dave to the last checkpoint
        this.caught++;
        this.pos.copy(this.checkpoint);
        this.vy = 0;
        this.extraVel.set(0, 0, 0);
        this.dave.group.position.copy(this.pos);
        this.wallX = this.pos.x - 22;
        this.ui.popup('The Silence caught Dave. It was very quiet about it.', 2000);
      }
      if (this.pos.x > 50 && this.checkpoint.x < 50) this.checkpoint.set(52.5, DESERT_GROUND + 1, 0.5);
      if (this.pos.x > 95 && this.checkpoint.x < 95) this.checkpoint.set(97.5, DESERT_GROUND + 1, 0.5);
      if (this.pos.x > FINISH_X + 1) this.finale();
    }
    this.silence.position.set(this.wallX, DESERT_GROUND + 11, 0);
    this.ship.position.set(this.wallX + 6, DESERT_GROUND + 24, 0);

    [this.elder].forEach((q) => {
      if (Math.hypot(q.group.position.x - this.pos.x, q.group.position.z - this.pos.z) < 20) q.lookAtPoint(this.pos.x, this.pos.z, dt);
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
