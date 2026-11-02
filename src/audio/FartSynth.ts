/**
 * Procedural Web Audio synthesizer for "What If Every Fart Doubled In Strength?"
 * Zero external audio assets required. Scales procedurally across all 25 farts.
 */
export class FartSynth {
  private ctx: AudioContext | null = null;
  /** Shared bus: every voice goes through one master gain and a compressor, so overlapping sounds never clip. */
  private master: GainNode | null = null;
  /** One brownish noise buffer, filled once and sliced by every fart (instead of rebuilding up to 4 s of samples per fart). */
  private noiseBuffer: AudioBuffer | null = null;
  private distortionCurves = new Map<number, Float32Array>();
  /** True once the player has touched the page (browsers keep the audio context suspended until then). */
  private gestureSeen = false;

  constructor() {
    this.setupPassiveUnlock();
  }

  private setupPassiveUnlock() {
    const unlock = () => {
      this.gestureSeen = true;
      this.ensureContext();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('touchstart', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };

    window.addEventListener('pointerdown', unlock, { passive: true, capture: true });
    window.addEventListener('touchstart', unlock, { passive: true, capture: true });
    window.addEventListener('keydown', unlock, { passive: true, capture: true });
  }

  /**
   * False until the first user gesture can start the audio context (true straight away when there is no Web Audio).
   * The game holds the first tension countdown until then, so the first farts are never silent.
   */
  public get isUnlocked(): boolean {
    if (this.gestureSeen) return true;
    if (typeof window === 'undefined') return true;
    return !(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
  }

  /** Per-fart loudness, rising across the whole range (0.4 at #1 up to 1.0 at #24), so every fart is louder than the last. */
  private levelFor(fartNumber: number): number {
    return 0.4 + 0.6 * Math.min(1, Math.max(0, (fartNumber - 1) / 23));
  }

  /** Master peak gain of one fart: one curve and one scale for every tier, so each fart is louder than the last across the hand-offs. */
  private peakFor(fartNumber: number): number {
    return this.levelFor(fartNumber) * 1.1;
  }

  private ensureContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        const compressor = this.ctx.createDynamicsCompressor();
        // Gentle: loud farts stay louder than quiet ones, the compressor only catches overlaps
        compressor.threshold.value = -4;
        compressor.knee.value = 10;
        compressor.ratio.value = 3;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;
        this.master.connect(compressor);
        compressor.connect(this.ctx.destination);
        this.noiseBuffer = this.buildNoiseBuffer(this.ctx);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public getContext(): AudioContext | null {
    return this.ensureContext();
  }

  public playFart(fartNumber: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (fartNumber <= 6) {
      this.playTier1Squish(ctx, now, fartNumber);
    } else if (fartNumber <= 16) {
      this.playTier2BrassyBoom(ctx, now, fartNumber);
    } else if (fartNumber <= 24) {
      this.playTier3Shockwave(ctx, now, fartNumber);
    } else {
      this.playTier4Sting(ctx, now);
    }
  }

  /** Near-silence of the master bus (the held breath before the Earth blows up); it comes back after `seconds`. */
  public duck(seconds: number) {
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const hold = Math.max(0.1, seconds);
    const g = this.master.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0.04, now + 0.08);
    g.setValueAtTime(0.04, now + hold);
    g.linearRampToValueAtTime(0.9, now + hold + 0.03);
  }

  /**
   * Farts #1–#6: Squishy cartoon sound
   * Short sawtooth/triangle oscillator (85Hz -> 42Hz) with rapid LFO pitch flutter and bandpass filter
   */
  private playTier1Squish(ctx: AudioContext, now: number, fartNumber: number) {
    const duration = 0.28 + (fartNumber - 1) * 0.05;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const masterGain = ctx.createGain();

    // Waveforms
    osc.type = fartNumber % 2 === 0 ? 'sawtooth' : 'triangle';
    lfo.type = 'sine';

    // Frequencies: 85Hz down to 42Hz (with mild scale per fart)
    const startFreq = 85 + (fartNumber - 1) * 8;
    const endFreq = 42 + (fartNumber - 1) * 4;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

    // Rapid flutter LFO
    const flutterSpeed = 22 + Math.random() * 8;
    lfo.frequency.setValueAtTime(flutterSpeed, now);
    const flutterDepth = 28 + (fartNumber - 1) * 6;
    lfoGain.gain.setValueAtTime(flutterDepth, now);
    lfoGain.gain.linearRampToValueAtTime(8, now + duration);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    // Bandpass filter for nasal squish
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(220 + fartNumber * 30, now);
    filter.Q.setValueAtTime(3.5, now);

    // Volume envelope
    const peakGain = this.peakFor(fartNumber);
    masterGain.gain.setValueAtTime(0.001, now);
    masterGain.gain.linearRampToValueAtTime(peakGain, now + 0.03);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(this.bus(ctx));

    osc.start(now);
    lfo.start(now);
    osc.stop(now + duration);
    lfo.stop(now + duration);
  }

  /**
   * Farts #7–#16: Brassy sawtooth + brown-noise burst with low-pass sweep & sub-bass punch
   */
  private playTier2BrassyBoom(ctx: AudioContext, now: number, fartNumber: number) {
    const rank = fartNumber - 6; // 1 to 10
    const duration = 0.55 + rank * 0.08;

    // 1. Dual oscillator for brassy tear
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'triangle';

    const baseFreq = 75 - rank * 2;
    osc1.frequency.setValueAtTime(baseFreq * 1.5, now);
    osc1.frequency.exponentialRampToValueAtTime(32, now + duration);
    osc2.frequency.setValueAtTime(baseFreq, now);
    osc2.frequency.exponentialRampToValueAtTime(26, now + duration);

    // LFO flutter
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(18 + Math.random() * 6, now);
    lfoGain.gain.setValueAtTime(45, now);
    lfoGain.gain.linearRampToValueAtTime(14, now + duration);
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);

    // 2. Filter sweep
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800 + rank * 120, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + duration);
    filter.Q.setValueAtTime(4.0, now);

    // 3. Noise generator (brownish air pressure)
    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = this.getNoiseBuffer(ctx);
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(400, now);
    noiseFilter.Q.setValueAtTime(1.5, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.linearRampToValueAtTime(0.3 + rank * 0.04, now + 0.05);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noiseNode.connect(noiseFilter);
    noiseFilter.connect(noiseGain);

    // Master bus
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.001, now);
    masterGain.gain.linearRampToValueAtTime(this.peakFor(fartNumber), now + 0.04);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(masterGain);
    noiseGain.connect(masterGain);
    masterGain.connect(this.bus(ctx));

    osc1.start(now);
    osc2.start(now);
    lfo.start(now);
    noiseNode.start(now, Math.random() * 0.3);

    osc1.stop(now + duration);
    osc2.stop(now + duration);
    lfo.stop(now + duration);
    noiseNode.stop(now + duration);
  }

  /**
   * Farts #17–#24: Sub-bass shockwave (55Hz -> 22Hz) + distortion waveshaper + filtered white-noise roar
   */
  private playTier3Shockwave(ctx: AudioContext, now: number, fartNumber: number) {
    const rank = fartNumber - 16; // 1 to 8
    const duration = 1.2 + rank * 0.15;

    // Sub oscillator
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(55, now);
    subOsc.frequency.exponentialRampToValueAtTime(18, now + duration);

    // Saturation shaper
    const distortion = ctx.createWaveShaper();
    distortion.curve = this.getDistortionCurve(30 + rank * 8) as unknown as Float32Array<ArrayBuffer>;
    distortion.oversample = '2x';

    // Lowpass filter
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(1200, now);
    lowpass.frequency.exponentialRampToValueAtTime(60, now + duration);

    // Thunder roar noise
    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = this.getNoiseBuffer(ctx);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.01, now);
    noiseGain.gain.linearRampToValueAtTime(0.3 + rank * 0.04, now + 0.08);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    // Master: rises with the fart number
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.01, now);
    masterGain.gain.linearRampToValueAtTime(this.peakFor(fartNumber), now + 0.06);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    subOsc.connect(distortion);
    distortion.connect(lowpass);
    lowpass.connect(masterGain);
    noiseNode.connect(noiseGain);
    noiseGain.connect(masterGain);
    masterGain.connect(this.bus(ctx));

    // Mid-range layers (150-1500 Hz): the 18-55 Hz sub above is inaudible on phone speakers
    this.addMidLayer(ctx, now, duration, masterGain, 0.22 + rank * 0.05, 300 + rank * 20, 1500);

    subOsc.start(now);
    noiseNode.start(now, Math.random() * 0.3);
    subOsc.stop(now + duration);
    noiseNode.stop(now + duration);
  }

  /**
   * Layers a sawtooth growl (falling from `startFreq` to a third of it, never below 150 Hz) and a band-passed noise
   * roar on `target`, both in the 150-1500 Hz range that small speakers can reproduce.
   */
  private addMidLayer(
    ctx: AudioContext,
    start: number,
    duration: number,
    target: AudioNode,
    gainAmount: number,
    startFreq: number,
    filterStart: number
  ) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(startFreq, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(150, startFreq * 0.33), start + duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterStart, start);
    filter.frequency.exponentialRampToValueAtTime(300, start + duration);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.001, start);
    oscGain.gain.linearRampToValueAtTime(gainAmount, start + 0.05);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(filter);
    filter.connect(oscGain);
    oscGain.connect(target);
    osc.start(start);
    osc.stop(start + duration);

    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(900, start);
    band.frequency.exponentialRampToValueAtTime(250, start + duration);
    band.Q.value = 0.8;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, start);
    noiseGain.gain.linearRampToValueAtTime(gainAmount * 1.2, start + 0.05);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    noise.connect(band);
    band.connect(noiseGain);
    noiseGain.connect(target);
    noise.start(start, Math.random() * 0.3);
    noise.stop(start + duration);
  }

  /**
   * Fart #25 (the moment of the fart): a rising ear-ringing sting. A sine sweeps 400 Hz to 3200 Hz, then rings on
   * as tinnitus. The seismic blast itself is saved for the Earth shattering (playShatter).
   */
  private playTier4Sting(ctx: AudioContext, now: number) {
    const startTime = now + 0.12; // brief pregnant silence

    const ringOsc = ctx.createOscillator();
    const ringGain = ctx.createGain();
    ringOsc.type = 'sine';
    ringOsc.frequency.setValueAtTime(400, startTime);
    ringOsc.frequency.exponentialRampToValueAtTime(3200, startTime + 1.1);
    ringGain.gain.setValueAtTime(0.0001, startTime);
    ringGain.gain.linearRampToValueAtTime(0.22, startTime + 1.0);
    ringGain.gain.setValueAtTime(0.16, startTime + 1.15);
    ringGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 3.2);
    ringOsc.connect(ringGain);
    ringGain.connect(this.bus(ctx));
    ringOsc.start(startTime);
    ringOsc.stop(startTime + 3.3);

    // Rising low swell under the sweep
    const swell = ctx.createOscillator();
    const swellGain = ctx.createGain();
    swell.type = 'triangle';
    swell.frequency.setValueAtTime(60, startTime);
    swell.frequency.exponentialRampToValueAtTime(240, startTime + 1.1);
    swellGain.gain.setValueAtTime(0.001, startTime);
    swellGain.gain.linearRampToValueAtTime(0.5, startTime + 1.1);
    swellGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.6);
    swell.connect(swellGain);
    swellGain.connect(this.bus(ctx));
    swell.start(startTime);
    swell.stop(startTime + 1.7);
  }

  /**
   * The Earth shattering: seismic sub-drop (110 Hz to 14 Hz), cosmic rumble, a mid-range growl and a short bright
   * noise crack. Played at the blast frame of the ending.
   */
  public playShatter() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const startTime = ctx.currentTime + 0.02;
    const duration = 4.2;

    // 1. Seismic sub-drop
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(110, startTime + 0.02);
    subOsc.frequency.exponentialRampToValueAtTime(14, startTime + duration);

    const subFilter = ctx.createBiquadFilter();
    subFilter.type = 'lowpass';
    subFilter.frequency.setValueAtTime(500, startTime);
    subFilter.frequency.exponentialRampToValueAtTime(45, startTime + duration);

    subGain.gain.setValueAtTime(0.001, startTime);
    subGain.gain.linearRampToValueAtTime(1.0, startTime + 0.08);
    subGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    subOsc.connect(subFilter);
    subFilter.connect(subGain);
    subGain.connect(this.bus(ctx));
    subOsc.start(startTime);
    subOsc.stop(startTime + duration);

    // 2. Cosmic rumble noise
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.setValueAtTime(250, startTime);
    rumbleFilter.frequency.exponentialRampToValueAtTime(30, startTime + duration);

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.001, startTime);
    rumbleGain.gain.linearRampToValueAtTime(0.7, startTime + 0.1);
    rumbleGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    noise.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(this.bus(ctx));
    noise.start(startTime, Math.random() * 0.3);
    noise.stop(startTime + duration);

    // 3. Mid-range growl (audible on phone speakers)
    this.addMidLayer(ctx, startTime, 2.4, this.bus(ctx), 0.55, 420, 1500);

    // 4. Short bright noise burst: the crack of the planet splitting
    const crack = ctx.createBufferSource();
    crack.buffer = this.getNoiseBuffer(ctx);
    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = 'highpass';
    crackFilter.frequency.setValueAtTime(1200, startTime);
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0.001, startTime);
    crackGain.gain.linearRampToValueAtTime(0.5, startTime + 0.01);
    crackGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.7);
    crack.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(this.bus(ctx));
    crack.start(startTime, Math.random() * 0.3);
    crack.stop(startTime + 0.7);
  }

  /** The shared noise buffer (4.6 s: the longest fart is 4.2 s, and each fart starts up to 0.3 s into it). */
  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer) this.noiseBuffer = this.buildNoiseBuffer(ctx);
    return this.noiseBuffer;
  }

  private bus(ctx: AudioContext): AudioNode {
    return this.master ?? ctx.destination;
  }

  private buildNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const bufferSize = Math.floor(ctx.sampleRate * 4.6);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Brownian/pink filtering
      lastOut = (lastOut + 0.04 * white) / 1.04;
      data[i] = lastOut * 3.5;
    }
    return buffer;
  }

  /** Short square-wave beep used for car horns and alarms. */
  public playBeep(freq: number, duration = 0.2, volume = 0.03) {
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.bus(ctx));
    osc.start(now);
    osc.stop(now + duration);
  }

  private getDistortionCurve(amount: number): Float32Array {
    const key = Math.round(amount);
    let curve = this.distortionCurves.get(key);
    if (!curve) {
      curve = this.makeDistortionCurve(key);
      this.distortionCurves.set(key, curve);
    }
    return curve;
  }

  private makeDistortionCurve(amount: number): Float32Array {
    const k = typeof amount === 'number' ? amount : 50;
    const nSamples = 8192;
    const buffer = new ArrayBuffer(nSamples * 4);
    const curve = new Float32Array(buffer);
    const deg = Math.PI / 180;
    for (let i = 0; i < nSamples; ++i) {
      const x = (i * 2) / nSamples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }
}

export const fartAudio = new FartSynth();
