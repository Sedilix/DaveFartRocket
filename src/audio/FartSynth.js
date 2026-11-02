/**
 * Procedural Web Audio synthesizer for "What If Every Fart Doubled In Strength?"
 * Zero external audio assets required. Scales procedurally across all 25 farts.
 */
export class FartSynth {
    ctx = null;
    isUnlocked = false;
    constructor() {
        this.setupPassiveUnlock();
    }
    setupPassiveUnlock() {
        const unlock = () => {
            this.ensureContext();
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            this.isUnlocked = true;
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('touchstart', unlock);
            window.removeEventListener('keydown', unlock);
        };
        window.addEventListener('pointerdown', unlock, { passive: true });
        window.addEventListener('touchstart', unlock, { passive: true });
        window.addEventListener('keydown', unlock, { passive: true });
    }
    ensureContext() {
        if (!this.ctx && typeof window !== 'undefined') {
            const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
            if (AudioCtxClass) {
                this.ctx = new AudioCtxClass();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => { });
        }
        return this.ctx;
    }
    playFart(fartNumber) {
        const ctx = this.ensureContext();
        if (!ctx)
            return;
        const now = ctx.currentTime;
        if (fartNumber <= 6) {
            this.playTier1Squish(ctx, now, fartNumber);
        }
        else if (fartNumber <= 16) {
            this.playTier2BrassyBoom(ctx, now, fartNumber);
        }
        else if (fartNumber <= 24) {
            this.playTier3Shockwave(ctx, now, fartNumber);
        }
        else {
            this.playTier4Cataclysm(ctx, now);
        }
    }
    /**
     * Farts #1–#6: Squishy cartoon sound
     * Short sawtooth/triangle oscillator (85Hz -> 42Hz) with rapid LFO pitch flutter and bandpass filter
     */
    playTier1Squish(ctx, now, fartNumber) {
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
        lfo.connect(osc.frequency);
        // Bandpass filter for nasal squish
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(220 + fartNumber * 30, now);
        filter.Q.setValueAtTime(3.5, now);
        // Volume envelope
        const peakGain = Math.min(0.8, 0.35 + fartNumber * 0.06);
        masterGain.gain.setValueAtTime(0.001, now);
        masterGain.gain.linearRampToValueAtTime(peakGain, now + 0.03);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        osc.connect(filter);
        filter.connect(masterGain);
        masterGain.connect(ctx.destination);
        osc.start(now);
        lfo.start(now);
        osc.stop(now + duration);
        lfo.stop(now + duration);
    }
    /**
     * Farts #7–#16: Brassy sawtooth + brown-noise burst with low-pass sweep & sub-bass punch
     */
    playTier2BrassyBoom(ctx, now, fartNumber) {
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
        lfo.connect(osc1.frequency);
        // 2. Filter sweep
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800 + rank * 120, now);
        filter.frequency.exponentialRampToValueAtTime(120, now + duration);
        filter.Q.setValueAtTime(4.0, now);
        // 3. Noise generator (brownish air pressure)
        const noiseBuffer = this.createNoiseBuffer(ctx, duration);
        const noiseNode = ctx.createBufferSource();
        noiseNode.buffer = noiseBuffer;
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
        masterGain.gain.linearRampToValueAtTime(0.7, now + 0.04);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(masterGain);
        noiseGain.connect(masterGain);
        masterGain.connect(ctx.destination);
        osc1.start(now);
        osc2.start(now);
        lfo.start(now);
        noiseNode.start(now);
        osc1.stop(now + duration);
        osc2.stop(now + duration);
        lfo.stop(now + duration);
        noiseNode.stop(now + duration);
    }
    /**
     * Farts #17–#24: Sub-bass shockwave (55Hz -> 22Hz) + distortion waveshaper + filtered white-noise roar
     */
    playTier3Shockwave(ctx, now, fartNumber) {
        const rank = fartNumber - 16; // 1 to 8
        const duration = 1.2 + rank * 0.15;
        // Sub oscillator
        const subOsc = ctx.createOscillator();
        subOsc.type = 'sawtooth';
        subOsc.frequency.setValueAtTime(55, now);
        subOsc.frequency.exponentialRampToValueAtTime(18, now + duration);
        // Saturation shaper
        const distortion = ctx.createWaveShaper();
        distortion.curve = this.makeDistortionCurve(30 + rank * 8);
        distortion.oversample = '4x';
        // Lowpass filter
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.setValueAtTime(1200, now);
        lowpass.frequency.exponentialRampToValueAtTime(60, now + duration);
        // Thunder roar noise
        const noiseBuffer = this.createNoiseBuffer(ctx, duration);
        const noiseNode = ctx.createBufferSource();
        noiseNode.buffer = noiseBuffer;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.01, now);
        noiseGain.gain.linearRampToValueAtTime(0.5, now + 0.08);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        // Master
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0.01, now);
        masterGain.gain.linearRampToValueAtTime(0.85, now + 0.06);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        subOsc.connect(distortion);
        distortion.connect(lowpass);
        lowpass.connect(masterGain);
        noiseNode.connect(noiseGain);
        noiseGain.connect(masterGain);
        masterGain.connect(ctx.destination);
        subOsc.start(now);
        noiseNode.start(now);
        subOsc.stop(now + duration);
        noiseNode.stop(now + duration);
    }
    /**
     * Fart #25 (World Breaker):
     * Brief silence (100ms) followed by seismic sub-drop, high-pitched ear-ringing sine tone (3200Hz at low gain),
     * and deep cosmic rumble
     */
    playTier4Cataclysm(ctx, now) {
        const delay = 0.12; // brief pregnant silence
        const startTime = now + delay;
        const duration = 4.2;
        // 1. High-pitched tinnitus ear-ringing sine
        const ringOsc = ctx.createOscillator();
        const ringGain = ctx.createGain();
        ringOsc.type = 'sine';
        ringOsc.frequency.setValueAtTime(3200, startTime);
        ringGain.gain.setValueAtTime(0.0001, startTime);
        ringGain.gain.linearRampToValueAtTime(0.18, startTime + 0.05);
        ringGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 2.8);
        ringOsc.connect(ringGain);
        ringGain.connect(ctx.destination);
        ringOsc.start(startTime);
        ringOsc.stop(startTime + 3.0);
        // 2. Seismic sub-drop (120Hz -> 14Hz)
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
        subGain.gain.linearRampToValueAtTime(0.95, startTime + 0.15);
        subGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        subOsc.connect(subFilter);
        subFilter.connect(subGain);
        subGain.connect(ctx.destination);
        subOsc.start(startTime);
        subOsc.stop(startTime + duration);
        // 3. Cosmic rumble noise
        const noiseBuffer = this.createNoiseBuffer(ctx, duration);
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const rumbleFilter = ctx.createBiquadFilter();
        rumbleFilter.type = 'lowpass';
        rumbleFilter.frequency.setValueAtTime(250, startTime);
        rumbleFilter.frequency.exponentialRampToValueAtTime(30, startTime + duration);
        const rumbleGain = ctx.createGain();
        rumbleGain.gain.setValueAtTime(0.001, startTime);
        rumbleGain.gain.linearRampToValueAtTime(0.65, startTime + 0.2);
        rumbleGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        noise.connect(rumbleFilter);
        rumbleFilter.connect(rumbleGain);
        rumbleGain.connect(ctx.destination);
        noise.start(startTime);
        noise.stop(startTime + duration);
    }
    createNoiseBuffer(ctx, duration) {
        const bufferSize = Math.floor(ctx.sampleRate * duration);
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
    playBeep(freq, duration = 0.2, volume = 0.03) {
        const ctx = this.ensureContext();
        if (!ctx || ctx.state !== 'running')
            return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration);
    }
    makeDistortionCurve(amount) {
        const k = typeof amount === 'number' ? amount : 50;
        const nSamples = 44100;
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
//# sourceMappingURL=FartSynth.js.map