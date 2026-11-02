import { fartAudio } from './FartSynth';

interface ChordDef {
  bass: number; // Hz
  padNotes: number[]; // Hz
  arpNotes: number[]; // Hz
}

/**
 * Procedural Celestial Ambient Synth for "Dave is fine." (End of Game Music)
 *
 * Generates an ethereal, peaceful, weightless cosmic waltz/pad with twinkling
 * starlight arpeggios using zero external audio files.
 */
export class EndGameMusic {
  private isRunning = false;
  private masterGain: GainNode | null = null;
  private delayNodeL: DelayNode | null = null;
  private delayNodeR: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private delayFilter: BiquadFilterNode | null = null;

  private scheduleTimer: number | null = null;
  private nextChordTime = 0;
  private currentChordIndex = 0;
  private arpIndex = 0;
  private nextArpTime = 0;

  // 4-chord ethereal progression (Cmaj9 -> Fmaj7#11 -> Am9 -> G6/9)
  private readonly chords: ChordDef[] = [
    // 1. Cmaj9 (warm, home, resolved)
    {
      bass: 65.41, // C2
      padNotes: [130.81, 196.0, 246.94, 293.66, 329.63], // C3, G3, B3, D4, E4
      arpNotes: [523.25, 659.25, 783.99, 987.77, 1174.66, 1318.51] // C5, E5, G5, B5, D6, E6
    },
    // 2. Fmaj7#11 (ethereal, floating Lydian shimmer)
    {
      bass: 87.31, // F2
      padNotes: [174.61, 261.63, 329.63, 440.0, 493.88], // F3, C4, E4, A4, B4
      arpNotes: [440.0, 523.25, 659.25, 783.99, 987.77, 1318.51] // A4, C5, E5, G5, B5, E6
    },
    // 3. Am9 (reflective, nostalgic, cosmic depth)
    {
      bass: 55.0, // A1
      padNotes: [220.0, 261.63, 329.63, 392.0, 493.88], // A3, C4, E4, G4, B4
      arpNotes: [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5] // C5, D5, E5, G5, A5, C6
    },
    // 4. G6/9 (gentle open sky, warm cosmic embrace)
    {
      bass: 98.0, // G2
      padNotes: [196.0, 293.66, 392.0, 440.0, 493.88, 659.25], // G3, D4, G4, A4, B4, E5
      arpNotes: [587.33, 783.99, 880.0, 987.77, 1174.66] // D5, G5, A5, B5, D6
    }
  ];

  private readonly chordDuration = 5.6; // seconds per chord

  public get isPlaying(): boolean {
    return this.isRunning;
  }

  /**
   * Begins the peaceful ending music with a smooth fade-in.
   */
  public start(fadeDuration = 3.0) {
    if (this.isRunning) return;

    const ctx = fartAudio.getContext();
    if (!ctx) return;

    this.isRunning = true;
    const now = ctx.currentTime;

    // Set up master gain with smooth fade-in
    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.0001, now);
    this.masterGain.gain.linearRampToValueAtTime(0.38, now + fadeDuration);
    this.masterGain.connect(ctx.destination);

    // Set up cosmic spatial delay network (ping-pong echo simulation)
    this.delayNodeL = ctx.createDelay(1.5);
    this.delayNodeR = ctx.createDelay(1.5);
    this.delayNodeL.delayTime.setValueAtTime(0.38, now);
    this.delayNodeR.delayTime.setValueAtTime(0.54, now);

    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.setValueAtTime(0.34, now);

    this.delayFilter = ctx.createBiquadFilter();
    this.delayFilter.type = 'lowpass';
    this.delayFilter.frequency.setValueAtTime(2400, now);

    // Connect delay loop
    this.delayNodeL.connect(this.delayFilter);
    this.delayNodeR.connect(this.delayFilter);
    this.delayFilter.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNodeL);
    this.delayFeedback.connect(this.delayNodeR);

    // Stereo split
    const merger = ctx.createChannelMerger(2);
    this.delayNodeL.connect(merger, 0, 0);
    this.delayNodeR.connect(merger, 0, 1);
    merger.connect(this.masterGain);

    // Reset scheduling states
    this.currentChordIndex = 0;
    this.arpIndex = 0;
    this.nextChordTime = now + 0.1;
    this.nextArpTime = now + 0.4;

    // Run lookahead scheduler
    this.scheduleLoop();
  }

  /**
   * Lookahead scheduler to generate continuous chords and sparkling star chimes
   */
  private scheduleLoop = () => {
    if (!this.isRunning) return;

    const ctx = fartAudio.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const lookahead = 0.8; // seconds

    // Schedule chords
    while (this.nextChordTime < now + lookahead) {
      this.playChord(ctx, this.chords[this.currentChordIndex], this.nextChordTime);
      this.currentChordIndex = (this.currentChordIndex + 1) % this.chords.length;
      this.nextChordTime += this.chordDuration;
    }

    // Schedule sparkling star arpeggios
    while (this.nextArpTime < now + lookahead) {
      const activeChord = this.chords[this.currentChordIndex === 0 ? this.chords.length - 1 : this.currentChordIndex - 1];
      const note = activeChord.arpNotes[this.arpIndex % activeChord.arpNotes.length];
      this.playStarlightChime(ctx, note, this.nextArpTime);

      // Organic celestial timing variation (randomized gently)
      this.arpIndex++;
      const step = 0.35 + Math.random() * 0.45;
      this.nextArpTime += step;
    }

    this.scheduleTimer = window.setTimeout(this.scheduleLoop, 120);
  };

  /**
   * Plays a warm, breathing multi-voice synth pad and sub-bass for one chord duration
   */
  private playChord(ctx: AudioContext, chord: ChordDef, startTime: number) {
    if (!this.masterGain) return;

    const duration = this.chordDuration + 1.8; // overlap into next chord for seamless warmth

    // 1. Warm Sub-Bass Fundamental
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(chord.bass, startTime);

    subGain.gain.setValueAtTime(0.0001, startTime);
    subGain.gain.linearRampToValueAtTime(0.24, startTime + 1.6);
    subGain.gain.linearRampToValueAtTime(0.18, startTime + this.chordDuration);
    subGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(startTime);
    subOsc.stop(startTime + duration);

    // 2. Multi-Voice Lush Pad
    chord.padNotes.forEach((freq, i) => {
      // Dual detuned oscillators for lush celestial chorus
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sine';
      osc2.type = 'triangle';

      const detune = (i % 2 === 0 ? 3.5 : -3.5);
      osc1.frequency.setValueAtTime(freq, startTime);
      osc2.frequency.setValueAtTime(freq, startTime);
      osc1.detune.setValueAtTime(detune, startTime);
      osc2.detune.setValueAtTime(-detune, startTime);

      // Lowpass filter with gentle breathing swell
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(550, startTime);
      filter.frequency.exponentialRampToValueAtTime(1100, startTime + this.chordDuration * 0.5);
      filter.frequency.exponentialRampToValueAtTime(450, startTime + duration);
      filter.Q.setValueAtTime(1.8, startTime);

      const voiceGain = ctx.createGain();
      const peak = 0.045 / Math.sqrt(chord.padNotes.length);
      voiceGain.gain.setValueAtTime(0.0001, startTime);
      voiceGain.gain.linearRampToValueAtTime(peak, startTime + 1.8);
      voiceGain.gain.linearRampToValueAtTime(peak * 0.85, startTime + this.chordDuration);
      voiceGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(voiceGain);
      voiceGain.connect(this.masterGain!);

      // Also send faint amount to delay for ambient depth
      if (this.delayNodeL) {
        voiceGain.connect(this.delayNodeL);
      }

      osc1.start(startTime);
      osc2.start(startTime);
      osc1.stop(startTime + duration);
      osc2.stop(startTime + duration);
    });
  }

  /**
   * Plays a delicate, crystalline celeste/bell tone that echoes into space
   */
  private playStarlightChime(ctx: AudioContext, freq: number, startTime: number) {
    if (!this.masterGain) return;

    const chimeDuration = 2.4;

    // Primary bell tone
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    // Subtle overtone (2.76x harmonic frequency gives authentic glass/celeste bell quality)
    const overtone = ctx.createOscillator();
    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(freq * 2.76, startTime);

    const gain = ctx.createGain();
    const vol = 0.038 + Math.random() * 0.025;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + 0.015); // quick chime attack
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + chimeDuration);

    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.0001, startTime);
    overtoneGain.gain.linearRampToValueAtTime(vol * 0.28, startTime + 0.015);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, startTime + chimeDuration * 0.45);

    osc.connect(gain);
    overtone.connect(overtoneGain);
    overtoneGain.connect(gain);

    gain.connect(this.masterGain);

    // Send high-register chime into stereo delay for twinkling space echoes
    if (this.delayNodeL && this.delayNodeR) {
      if (Math.random() > 0.5) {
        gain.connect(this.delayNodeL);
      } else {
        gain.connect(this.delayNodeR);
      }
    }

    osc.start(startTime);
    overtone.start(startTime);
    osc.stop(startTime + chimeDuration);
    overtone.stop(startTime + chimeDuration);
  }

  /**
   * Smoothly fades out and halts the music when the game is restarted
   */
  public stop(fadeDuration = 1.2) {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.scheduleTimer !== null) {
      window.clearTimeout(this.scheduleTimer);
      this.scheduleTimer = null;
    }

    const ctx = fartAudio.getContext();
    if (ctx && this.masterGain) {
      const now = ctx.currentTime;
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0.0001, now + fadeDuration);

      window.setTimeout(() => {
        try {
          this.masterGain?.disconnect();
          this.delayNodeL?.disconnect();
          this.delayNodeR?.disconnect();
          this.delayFeedback?.disconnect();
          this.delayFilter?.disconnect();
        } catch {
          // Ignore if already disconnected
        }
        this.masterGain = null;
        this.delayNodeL = null;
        this.delayNodeR = null;
        this.delayFeedback = null;
        this.delayFilter = null;
      }, (fadeDuration + 0.1) * 1000);
    }
  }
}

export const endGameMusic = new EndGameMusic();
