import { settings } from '../ui/Settings';

/**
 * Universal procedural Web Audio engine for Dave Fart Rocket.
 * Zero external audio assets. All buses, procedural themes, foley, and voice blips.
 */
export class AudioEngine {
  private static instance: AudioEngine | null = null;
  public ctx: AudioContext | null = null;

  // Node graph
  private masterGain!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private voiceGain!: GainNode;
  private ambienceGain!: GainNode;
  private hushFilter!: BiquadFilterNode;
  private compressor!: DynamicsCompressorNode;

  // Music state
  private currentTheme: string | null = null;
  private musicInterval: number | null = null;
  private step = 0;
  private isUnlocked = false;

  public get unlocked(): boolean {
    return this.isUnlocked;
  }

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  constructor() {
    this.setupUnlock();
    settings.subscribe(() => this.updateVolumes());
  }

  private setupUnlock() {
    const unlock = () => {
      this.ensureContext();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this.isUnlocked = true;
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      window.removeEventListener('touchstart', unlock, true);
    };

    window.addEventListener('pointerdown', unlock, { passive: true, capture: true });
    window.addEventListener('keydown', unlock, { passive: true, capture: true });
    window.addEventListener('touchstart', unlock, { passive: true, capture: true });
  }

  public ensureContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      this.ctx = new AudioCtx();

      // Master compressor prevents distortion when layers overlap
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -12;
      this.compressor.knee.value = 8;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.15;
      this.compressor.connect(this.ctx.destination);

      // Global Hush Field / Silence low-pass filter
      this.hushFilter = this.ctx.createBiquadFilter();
      this.hushFilter.type = 'lowpass';
      this.hushFilter.frequency.value = 20000; // open by default
      this.hushFilter.Q.value = 1.0;
      this.hushFilter.connect(this.compressor);

      // Master bus
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.hushFilter);

      // Sub-buses
      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.masterGain);

      this.voiceGain = this.ctx.createGain();
      this.voiceGain.connect(this.masterGain);

      this.ambienceGain = this.ctx.createGain();
      this.ambienceGain.connect(this.masterGain);

      this.updateVolumes();
    }
    return this.ctx;
  }

  public updateVolumes() {
    if (!this.ctx) return;
    const s = settings.get();
    const t = this.ctx.currentTime;
    this.masterGain.gain.setValueAtTime((s.masterVolume / 100) * 0.9, t);
    this.musicGain.gain.setValueAtTime((s.musicVolume / 100) * 0.45, t);
    this.sfxGain.gain.setValueAtTime((s.sfxVolume / 100) * 0.85, t);
    this.voiceGain.gain.setValueAtTime((s.voiceVolume / 100) * 0.75, t);
    this.ambienceGain.gain.setValueAtTime(0.4, t);
  }

  /** Dynamically muffles the global soundscape during Hush Field or Silence */
  public setHushMuffle(muffled: boolean, cutoffHz = 750) {
    if (!this.ctx || !this.hushFilter) return;
    const target = muffled ? cutoffHz : 20000;
    this.hushFilter.frequency.setTargetAtTime(target, this.ctx.currentTime, 0.2);
  }

  // ---------------------------------------------------------------- Procedural Voice Blips
  public playVoiceBlip(speaker: string) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(this.voiceGain);

    const now = ctx.currentTime;
    let dur = 0.045;
    let freq = 260;

    if (speaker === 'Narrator') {
      osc.type = 'triangle';
      freq = 150 + Math.random() * 15;
      dur = 0.055;
    } else if (speaker === 'Dave') {
      osc.type = 'sine';
      freq = 280 + Math.random() * 35;
      dur = 0.04;
    } else if (speaker === 'Pim') {
      osc.type = 'sine';
      freq = 520 + Math.random() * 60;
      dur = 0.035;
    } else if (speaker === 'Captain Murmur') {
      osc.type = 'sine';
      freq = 180 + Math.random() * 20;
      dur = 0.05;
    } else if (speaker === 'Elder Sibilance') {
      osc.type = 'triangle';
      freq = 380 + Math.random() * 40;
      dur = 0.045;
    } else if (speaker === 'Chef Glorb') {
      osc.type = 'sine';
      freq = 240 + Math.random() * 50;
      dur = 0.04;
      osc.frequency.exponentialRampToValueAtTime(freq * 1.3, now + dur);
    } else if (speaker === 'Big Toot') {
      osc.type = 'square';
      freq = 110 + Math.random() * 15;
      dur = 0.06;
    } else {
      osc.type = 'sine';
      freq = 300 + Math.random() * 40;
    }

    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.start(now);
    osc.stop(now + dur);
  }

  // ---------------------------------------------------------------- Foley SFX
  public playJump() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(this.sfxGain);

    const now = ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.12);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playLand() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(this.sfxGain);

    const now = ctx.currentTime;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.1);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playClick() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(this.sfxGain);

    const now = ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.03);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.start(now);
    osc.stop(now + 0.03);
  }

  // ---------------------------------------------------------------- Music Director
  public playTheme(theme: 'street' | 's1_ship' | 's2_nom' | 's3_ice' | 's4_desert' | 's5_source' | 'menu') {
    if (this.currentTheme === theme) return;
    this.stopTheme();
    this.currentTheme = theme;

    const ctx = this.ensureContext();
    if (!ctx) return;

    this.step = 0;
    let stepMs = 250;

    if (theme === 's1_ship') stepMs = 380;
    else if (theme === 's2_nom') stepMs = 210;
    else if (theme === 's3_ice') stepMs = 320;
    else if (theme === 's4_desert') stepMs = 270;
    else if (theme === 's5_source') stepMs = 450;
    else if (theme === 'menu') stepMs = 400;

    this.musicInterval = window.setInterval(() => this.tickMusic(theme), stepMs);
  }

  public stopTheme() {
    if (this.musicInterval !== null) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    this.currentTheme = null;
  }

  private tickMusic(theme: string) {
    const ctx = this.ensureContext();
    if (!ctx || ctx.state === 'suspended') return;

    this.step++;
    const s = this.step;

    if (theme === 's1_ship') {
      // Quiet felt-piano + sub pulse (D minor: D3, F3, A3, C4)
      const notes = [146.83, 174.61, 220.0, 261.63, 146.83, 220.0];
      if (s % 2 === 0) {
        const note = notes[(s / 2) % notes.length];
        this.synthPluck(note, 0.45, 'triangle', 0.12);
      }
      if (s % 8 === 0) {
        this.synthPluck(73.42, 1.2, 'sine', 0.15); // soft D2 bass
      }
    } else if (theme === 's2_nom') {
      // Tribal hand drums + marimba (A mixolydian: A, C#, E, G)
      const drums = [85, 120, 95, 140, 85, 110, 130, 90];
      this.synthDrum(drums[s % drums.length], 0.1, 0.16);
      if (s % 4 === 2) {
        const marimbaNotes = [220.0, 277.18, 329.63, 392.0, 440.0];
        const m = marimbaNotes[(s * 3) % marimbaNotes.length];
        this.synthPluck(m, 0.22, 'sine', 0.14);
      }
    } else if (theme === 's3_ice') {
      // Lonely broken lounge-jazz celesta & wind (F# minor / C)
      const celestaNotes = [369.99, 440.0, 554.37, 659.25, 739.99];
      if (s % 3 === 0) {
        const note = celestaNotes[(s * 2) % celestaNotes.length];
        this.synthPluck(note, 0.6, 'sine', 0.1);
      }
    } else if (theme === 's4_desert') {
      // Tense Phrygian frame drum & sub drone
      if (s % 4 === 0) this.synthDrum(65, 0.25, 0.22);
      else if (s % 2 === 0) this.synthDrum(110, 0.08, 0.12);
      if (s % 8 === 4) this.synthPluck(146.83, 0.5, 'sawtooth', 0.08); // D3 buzz
    } else if (theme === 's5_source') {
      // Slow awe heartbeat kick synced to ring, piano bell
      if (s % 6 === 0) {
        this.synthDrum(55, 0.22, 0.2); // Heartbeat pulse
      }
      if (s % 12 === 6) {
        this.synthPluck(329.63, 1.5, 'triangle', 0.14); // E4 bell
      }
    } else if (theme === 'menu') {
      // Celestial ambient arpeggios
      const chords = [220.0, 261.63, 329.63, 392.0, 440.0, 523.25];
      if (s % 2 === 0) {
        const note = chords[s % chords.length];
        this.synthPluck(note, 0.8, 'sine', 0.12);
      }
    }
  }

  private synthPluck(freq: number, dur: number, type: OscillatorType, gainVal: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    osc.connect(gain);
    gain.connect(this.musicGain);

    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.start(now);
    osc.stop(now + dur);
  }

  private synthDrum(freq: number, dur: number, gainVal: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + dur);

    osc.connect(gain);
    gain.connect(this.musicGain);

    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.start(now);
    osc.stop(now + dur);
  }
}

export const audio = AudioEngine.getInstance();
