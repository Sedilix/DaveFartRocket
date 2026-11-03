import * as THREE from 'three';
import { VoxelGame } from '../voxel/VoxelGame';
import { fartAudio } from '../audio/FartSynth';
import { damp, dampAngle } from '../core/animMath';
import { Quell } from './Quell';
import { StoryUi } from './StoryUi';
import { DESK, ICE_GROUND, OBS_FLOOR_Y, SHAFT, TELESCOPE, iceGenerator } from './ice';

const COLORS: Record<string, string> = {
  Narrator: '#9fb4cf',
  Dave: '#ff9a62',
  Pim: '#c8b8ff',
  'Chef Glorb': '#9be8b0'
};
const MUTED_POPS = ['(pfft)', '(prrp)', '(a respectful toot)', '(brp, but quietly)'];

type State = 'intro' | 'toHotel' | 'confession' | 'climb' | 'top' | 'end';

/** Act III: Frostbite Hotel. Meet the chef who sold the bean, then climb the "out of order" lift shaft with upward fart-jumps. */
export class Act3 extends VoxelGame {
  private ui: StoryUi;
  private pim = new Quell({ height: 1.15, body: 0xb9a7e8, accent: 0xff9ccf });
  private glorb = new Quell({ height: 1.95, body: 0x8fbf9f, accent: 0xffd166, hat: 0xf5f5f0, antenna: false });
  private bubble: THREE.Mesh;
  private snow: THREE.Points;
  private bubbleFlash = 0;

  private state: State = 'intro';
  private fartNum = 40;
  private chain = 0;
  private chainTimer = 0;
  private cooldown = 0;
  private fartsTotal = 0;
  private falls = 0;
  private bestLedge = 0;

  constructor(container: HTMLElement) {
    super(container, {
      generator: iceGenerator,
      spawn: new THREE.Vector3(2.5, ICE_GROUND + 1, 0.5),
      sandbox: false,
      sky: 0xcfe6f5,
      radius: 5,
      fog: true
    });
    this.ui = new StoryUi(COLORS);
    this.dave.group.rotation.y = Math.PI / 2;
    this.yaw = -Math.PI / 2;
    this.pitch = 0.22;
    this.camDist = 6;

    this.pim.group.scale.setScalar(0.6);
    this.scene.add(this.pim.group);
    this.glorb.group.position.set(DESK.x + 2, ICE_GROUND + 1, 0.5);
    this.glorb.group.rotation.y = -Math.PI / 2;
    this.scene.add(this.glorb.group);

    this.bubble = new THREE.Mesh(
      new THREE.SphereGeometry(1.7, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0x7fd3ff, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide })
    );
    this.scene.add(this.bubble);

    // Falling snow that follows the player
    const n = 700;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = Math.random() * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.snow = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 3, sizeAttenuation: false }));
    this.snow.frustumCulled = false;
    this.scene.add(this.snow);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyF' && !e.repeat) this.boost();
    });
    (window as unknown as { __act3?: Act3 }).__act3 = this;

    this.frozen = true;
    this.runIntro();
  }

  // ---------------------------------------------------------------- story

  private runIntro() {
    this.ui.say(
      [
        { who: 'Narrator', text: 'The Ice Moon of Frostbite: a place so cold that even the wind wore a coat.' },
        { who: 'Pim', text: 'I would like it noted that my antennae have stopped working. I am fine. I am wearing a scarf. I made it myself.', whisper: true },
        { who: 'Dave', text: 'Look, a hotel! "The Frostbite Hotel: a quiet stay, guaranteed."' },
        { who: 'Narrator', text: 'The guarantee was, in hindsight, ambitious.' },
        { who: 'Pim', text: 'The drum said the cook who planted the bean runs a hotel. This is the only hotel for four hundred kilometres.', whisper: true }
      ],
      () => {
        this.state = 'toHotel';
        this.frozen = false;
        this.ui.setObjective('Enter the Frostbite Hotel and speak to the concierge.');
      }
    );
  }

  private confession() {
    this.state = 'confession';
    this.frozen = true;
    this.ui.setObjective(null);
    this.ui.say(
      [
        { who: 'Chef Glorb', text: 'Welcome to the Frostbite Hotel! Shh. Please, keep your voice down. And your... everything.' },
        { who: 'Dave', text: 'Are you the guy who sold me the bean?' },
        { who: 'Chef Glorb', text: 'No. Yes. It was a limited-time special!' },
        { who: 'Narrator', text: 'Chef Glorb had been practising that line in a mirror for eleven years. It still came out wrong.' },
        { who: 'Chef Glorb', text: 'I only wanted to make the best brunch in the galaxy. The bean was perfect. It just... does not stop.' },
        { who: 'Pim', text: 'Is there a cure?', whisper: true },
        {
          who: 'Chef Glorb',
          text: 'There is. The Whisper Bean. It only grows at the Source. I have a star map in the observatory. I would show you, but the elevator is out of order.',
          action: () => this.ui.popup('"Achoo!"', 900)
        },
        { who: 'Narrator', text: 'Glorb sneezed. Somewhere on the roof, a ton of snow slid onto the greenhouse. Nobody mentioned the greenhouse.' },
        { who: 'Dave', text: 'It is always out of order, isn\'t it?' },
        { who: 'Chef Glorb', text: 'It is part of the hotel\'s charm. The shaft is that way. Mind the ledges.' }
      ],
      () => {
        this.state = 'climb';
        this.frozen = false;
        // Glorb takes "the other elevator" to the observatory
        this.glorb.group.position.set(TELESCOPE.x + 2, OBS_FLOOR_Y + 1, 3);
        this.glorb.group.rotation.y = -Math.PI / 2;
        this.ui.setObjective('Climb the lift shaft. Press F to fart-jump: chain jumps within 2.5 s and each is twice as strong.');
      }
    );
  }

  /** Upward fart-jump. A chain of jumps doubles in strength, with a little nudge in the camera direction. */
  private boost() {
    if (this.frozen || this.cooldown > 0 || (this.state !== 'climb' && this.state !== 'toHotel' && this.state !== 'top')) return;
    this.chain = this.chainTimer > 0 ? Math.min(3, this.chain + 1) : 0;
    this.chainTimer = 2.5;
    this.cooldown = 0.4;
    const power = 2 ** this.chain;
    this.vy = Math.max(this.vy, 9 + this.chain * 2.8);
    this.onGround = false;
    this.extraVel.x += -Math.sin(this.yaw) * 0.8 * power;
    this.extraVel.z += -Math.cos(this.yaw) * 0.8 * power;
    this.fartNum++;
    this.fartsTotal++;
    this.dave.triggerFartVFX(Math.min(14, 6 + this.chain * 2));
    this.bubbleFlash = 1;
    this.shake = 0.08 + this.chain * 0.06;
    fartAudio.playBeep(110 + this.chain * 30, 0.1, 0.02);
    this.ui.setChain(`FART #${this.fartNum}  ·  JUMP x${power}`);
    this.ui.popup(MUTED_POPS[Math.floor(Math.random() * MUTED_POPS.length)], 700);
  }

  private observatory() {
    this.state = 'top';
    this.frozen = true;
    this.ui.setObjective(null);
    this.ui.setChain(null);
    this.ui.say(
      [
        { who: 'Narrator', text: 'Dave reached the observatory with the quiet dignity of a man who had cleared a twelve-storey lift shaft by farting at it.' },
        { who: 'Chef Glorb', text: 'Ah. You came up the shaft. Most people take the stairs. There are stairs. Nobody mentions them.' },
        { who: 'Narrator', text: 'Dave looked at the stairs. The stairs looked back, apologetically.' },
        { who: 'Chef Glorb', text: 'Look through the telescope. The Source is the dead star at the end of the Frostbite Belt. The Whisper Bean grows on the one tree there.', },
        { who: 'Pim', text: 'Dave... there is a ship in the sky. A long, silent, white one.', whisper: true },
        { who: 'Pim', text: 'That is Elder Sibilance\'s vault ship. She has come for you.', whisper: true },
        { who: 'Dave', text: 'Is she angry?' },
        { who: 'Pim', text: 'She is never angry. That is what makes it so much worse.', whisper: true },
        { who: 'Narrator', text: 'And so, with a polite cough, the second half of the saga began.' }
      ],
      () => {
        this.state = 'end';
        this.ui.showEnd({
          act: 'ACT III',
          title: 'Mind the Ledges',
          blurb: 'Next: Act IV, The Elder\'s Offer. Where the desert is quiet, the vault is quieter, and Pim makes a speech.',
          stats: `Fart-jumps: <b>${this.fartsTotal}</b> &nbsp;·&nbsp; Times Dave fell down the shaft: <b>${this.falls}</b> &nbsp;·&nbsp; Stairs discovered: <b>0</b>`
        });
      }
    );
  }

  // ---------------------------------------------------------------- per-frame

  protected override onFrame(dt: number) {
    const t = performance.now() * 0.001;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.chainTimer > 0) {
      this.chainTimer -= dt;
      if (this.chainTimer <= 0) {
        this.chain = 0;
        this.ui.setChain(null);
      }
    }

    // Triggers
    if (this.state === 'toHotel' && Math.hypot(this.pos.x - (DESK.x + 2), this.pos.z) < 4.5) this.confession();
    if (this.state === 'climb') {
      const inShaft = this.pos.x > SHAFT.x0 - 1 && this.pos.x < SHAFT.x1 + 1 && Math.abs(this.pos.z) < 3;
      if (inShaft && this.pos.y > 29) this.bestLedge = Math.max(this.bestLedge, this.pos.y);
      if (this.pos.y > OBS_FLOOR_Y + 0.9 && !inShaft) this.observatory();
      // Falling most of the way down counts as a (cheerful) tumble
      if (this.bestLedge > 40 && this.pos.y < 30 && inShaft) {
        this.falls++;
        this.bestLedge = 0;
        this.ui.popup('The lift is out of order. It has always been out of order.', 2200);
      }
    }

    // NPCs
    const look = (q: Quell) => {
      if (Math.hypot(q.group.position.x - this.pos.x, q.group.position.z - this.pos.z) < 18) q.lookAtPoint(this.pos.x, this.pos.z, dt);
      q.update(dt);
    };
    look(this.glorb);

    // Pim on the shoulder
    const yaw = this.dave.group.rotation.y;
    this.pim.group.position.set(this.pos.x + Math.cos(yaw) * 0.28, this.pos.y + 1.42, this.pos.z - Math.sin(yaw) * 0.28);
    this.pim.group.rotation.y = dampAngle(this.pim.group.rotation.y, yaw, 8, dt);
    this.pim.update(dt);

    this.bubbleFlash = damp(this.bubbleFlash, 0, 5, dt);
    this.bubble.position.set(this.pos.x, this.pos.y + 0.9, this.pos.z);
    this.bubble.scale.setScalar(1 + Math.sin(t * 2) * 0.02 + this.bubbleFlash * 0.18);
    (this.bubble.material as THREE.MeshBasicMaterial).opacity = 0.08 + this.bubbleFlash * 0.3;

    // Snow: the flakes live in a box that follows the player; drift down and wrap inside it
    const arr = this.snow.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < arr.count; i++) {
      let y = arr.getY(i) - dt * (2.5 + (i % 5) * 0.4);
      let x = arr.getX(i) + dt * 1.2;
      if (y < -6) y += 20;
      if (x > 20) x -= 40;
      arr.setXYZ(i, x, y, arr.getZ(i));
    }
    arr.needsUpdate = true;
    this.snow.position.set(this.pos.x, this.pos.y, this.pos.z);
  }
}
