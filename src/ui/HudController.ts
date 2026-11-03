import { useGameStore } from '../core/gameState';
import type { GameStore } from '../core/gameState';
import { endGameMusic } from '../audio/EndGameMusic';

const RING_RADIUS = 38;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
// How long a milestone popup holds the story slot before the subtitle takes over.
// Each fart resets a 4.5 s tension window, so the subtitle needs the remainder to be readable.
const POPUP_HOLD_MS = 1800;
const CLIMAX_FADE_OUT_MS = 450;
const CLIMAX_FADE_IN_MS = 1500;
// Keyboard activation of Play Again is ignored until the overlay is readable
const PLAY_AGAIN_ARM_MS = CLIMAX_FADE_IN_MS + 800;
// ...and only after Space/Enter has been quiet this long, so a player still mashing through the cinematic
// does not skip the ending
const PLAY_AGAIN_KEY_GAP_MS = 600;

// The music preview button and its M hotkey are a dev tool, not part of the shipped game
const SHOW_MUSIC_PREVIEW = import.meta.env.DEV;

const DOT_COLORS = {
  green: '#2ecc71',
  yellow: '#f1c40f',
  orange: '#e67e22',
  red: '#e74c3c'
};

type NarrativeMode = 'popup' | 'subtitle' | 'none';

export class HudController {
  private container: HTMLElement;

  // Top Card elements
  private fartNumElem!: HTMLElement;
  private multiplierElem!: HTMLElement;
  private decibelsElem!: HTMLElement;
  private progressBarFill!: HTMLElement;
  private statusDotElem!: HTMLElement;
  private statusLabelElem!: HTMLElement;

  // Narrative elements
  private narrativeElem!: HTMLElement;
  private centerPopupElem!: HTMLElement;
  private onomatopoeiaElem!: HTMLElement;
  private subtitleTextElem!: HTMLElement;
  private liveElem!: HTMLElement;

  // Bottom Control elements
  private joystickBase!: HTMLElement;
  private joystickHandle!: HTMLElement;
  private releaseBtn!: HTMLElement;
  private ringWrapper!: HTMLElement;
  private tensionRingSvg!: SVGCircleElement;

  // Whiteout Flash & Climax Ending
  private whiteoutElem!: HTMLElement;
  private climaxOverlay!: HTMLElement;
  private playAgainBtn!: HTMLElement;

  private onPlayAgainCallback: (() => void) | null = null;
  private onContinueSagaCallback: (() => void) | null = null;
  private lastTriggerTimestamp = 0;

  // Cached values so unchanged state never touches the DOM
  private lastPopupText: string | null = null;
  private lastSubtitleText: string | null = null;
  private lastWhiteout = -1;
  private lastRingOffset = -1;
  private lastRingSeconds = -1;
  private ringUrgent = false;
  private narrativeMode: NarrativeMode = 'popup';
  private popupTimer: number | null = null;
  private climaxVisible = false;
  private climaxHideTimer: number | null = null;
  private restarting = false;
  private playAgainArmed = false;
  private armTimer: number | null = null;
  private lastAnnounced = '';
  private announcedKey = '';
  private lastSubtitleShown: string | null = null;
  private lastKeyTime = -Infinity;
  private keyHintElem!: HTMLElement;
  private skipHintElem!: HTMLElement;
  private skipHintTimer: number | null = null;
  private ringAriaElem!: Element;
  private compactQuery = window.matchMedia('(max-height: 600px)');

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.id = 'hud-root';
    this.container.innerHTML = this.getTemplate();
    parent.appendChild(this.container);

    this.cacheElements();
    this.bindStore();
    this.compactQuery.addEventListener('change', () => this.syncNarrativeText());

    // Space/Enter activity: gates Play Again arming and retires the keyboard hint after the first release
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.code !== 'Space' && e.code !== 'Enter') return;
        this.lastKeyTime = performance.now();
        if (!this.climaxVisible) this.keyHintElem.classList.add('hidden');
      },
      true
    );
    this.releaseBtn.addEventListener('pointerdown', () => this.keyHintElem.classList.add('hidden'));

    // Before the first touch or key the countdown is frozen: pulse RELEASE as a "start here" cue
    this.releaseBtn.classList.add('nudge');
    const onFirstGesture = () => {
      this.releaseBtn.classList.remove('nudge');
      window.removeEventListener('pointerdown', onFirstGesture, true);
      window.removeEventListener('keydown', onFirstGesture, true);
    };
    window.addEventListener('pointerdown', onFirstGesture, true);
    window.addEventListener('keydown', onFirstGesture, true);

    // No browser menu on right-click / long-press over the controls
    this.container.addEventListener('contextmenu', (e) => e.preventDefault());

    // A tap anywhere retires the "tap to skip" cue
    window.addEventListener('pointerdown', () => this.hideSkipHint(), true);

    // Anchor the onomatopoeia zone to the real card height (it differs per viewport)
    const topZone = this.container.querySelector<HTMLElement>('.hud-top-zone')!;
    const syncCardBottom = () => {
      this.container.style.setProperty('--card-bottom', `${Math.round(topZone.getBoundingClientRect().bottom)}px`);
    };
    syncCardBottom();
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(syncCardBottom).observe(topZone);
    window.addEventListener('resize', syncCardBottom);
  }

  /** Restarts the intro popup hold; call when the game loop actually starts. */
  public startIntro() {
    // Force the story slot to re-render and re-arm the popup timer from now
    this.lastSubtitleShown = null;
    this.updateNarrative(useGameStore.getState());
  }

  public getJoystickElements() {
    return { base: this.joystickBase, handle: this.joystickHandle };
  }

  public getReleaseButton() {
    return this.releaseBtn;
  }

  public setOnPlayAgain(cb: () => void) {
    this.onPlayAgainCallback = cb;
  }

  public setOnContinueSaga(cb: () => void) {
    this.onContinueSagaCallback = cb;
  }

  private cacheElements() {
    this.fartNumElem = this.container.querySelector('#hud-fart-num')!;
    this.multiplierElem = this.container.querySelector('#hud-multiplier')!;
    this.decibelsElem = this.container.querySelector('#hud-decibels')!;
    this.progressBarFill = this.container.querySelector('#hud-progress-fill')!;
    this.statusDotElem = this.container.querySelector('#hud-status-dot')!;
    this.statusLabelElem = this.container.querySelector('#hud-status-label')!;

    this.narrativeElem = this.container.querySelector('#hud-narrative')!;
    this.centerPopupElem = this.container.querySelector('#narrative-center-popup')!;
    this.onomatopoeiaElem = this.container.querySelector('#narrative-onomatopoeia')!;
    this.subtitleTextElem = this.container.querySelector('#narrative-subtitle-text')!;
    this.liveElem = this.container.querySelector('#narrative-live')!;

    this.joystickBase = this.container.querySelector('#joystick-base')!;
    this.joystickHandle = this.container.querySelector('#joystick-handle')!;
    this.releaseBtn = this.container.querySelector('#release-btn')!;
    this.ringWrapper = this.container.querySelector('#release-ring-wrapper')!;
    this.tensionRingSvg = this.container.querySelector('#tension-ring-circle')!;

    this.whiteoutElem = this.container.querySelector('#whiteout-flash')!;
    this.climaxOverlay = this.container.querySelector('#climax-overlay')!;
    this.playAgainBtn = this.container.querySelector('#play-again-btn')!;
    this.keyHintElem = this.container.querySelector('#key-hint')!;
    this.skipHintElem = this.container.querySelector('#skip-hint')!;
    this.ringAriaElem = this.container.querySelector('#tension-svg')!;

    const musicBtn = this.container.querySelector<HTMLButtonElement>('#music-preview-btn');
    const musicLabel = this.container.querySelector<HTMLElement>('#music-preview-label');

    const toggleMusic = () => {
      if (endGameMusic.isPlaying) {
        endGameMusic.stop(0.8);
        if (musicLabel) musicLabel.textContent = 'Preview Music';
        musicBtn?.classList.remove('playing');
      } else {
        endGameMusic.start(0.8);
        if (musicLabel) musicLabel.textContent = 'Stop Music';
        musicBtn?.classList.add('playing');
      }
    };

    musicBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMusic();
    });

    // Music preview is a dev tool: no button and no hotkey in production builds
    if (SHOW_MUSIC_PREVIEW) {
      window.addEventListener('keydown', (e) => {
        if ((e.key === 'm' || e.key === 'M') && !e.repeat) {
          toggleMusic();
        }
      });
    }

    this.playAgainBtn.addEventListener('click', () => {
      // Keys held, mashed or stray taps while the overlay is still fading in are ignored
      if (!this.playAgainArmed) return;
      // Guard against double-clicks while the overlay fades out
      if (this.restarting) return;
      this.restarting = true;
      if (this.onPlayAgainCallback) {
        this.onPlayAgainCallback();
      }
    });

    const sagaBtn = this.container.querySelector('#saga-btn');
    sagaBtn?.addEventListener('click', (e) => {
      if (this.onContinueSagaCallback) {
        e.preventDefault();
        this.onContinueSagaCallback();
      }
    });
  }

  private bindStore() {
    // Only fields that changed since the previous state touch the DOM.
    // Per-frame values (tension, altitude) are cheap no-ops here.
    useGameStore.subscribe((state, prev) => this.applyState(state, prev));
    this.applyState(useGameStore.getState(), null);
  }

  private applyState(state: GameStore, prev: GameStore | null) {
    // 1. Top HUD Card
    if (!prev || state.currentMilestone !== prev.currentMilestone || state.fartNumber !== prev.fartNumber) {
      const m = state.currentMilestone;
      this.fartNumElem.textContent = `FART #${state.fartNumber}`;
      this.multiplierElem.textContent = m.multiplierFormatted;
      this.decibelsElem.textContent = `${m.decibels} dB`;

      // Color code decibels
      if (m.decibels >= 150) {
        this.decibelsElem.style.color = '#ff4d4d';
      } else if (m.decibels >= 90) {
        this.decibelsElem.style.color = '#ff9f43';
      } else {
        this.decibelsElem.style.color = '#2ecc71';
      }

      // Progress bar (54 dB to 198 dB), revealed with clip-path over a fixed gradient
      const pct = Math.min(100, Math.max(0, ((m.decibels - 54) / (198 - 54)) * 100));
      this.progressBarFill.style.clipPath = `inset(0 ${100 - pct}% 0 0 round 4px)`;

      // Status dot & label
      this.statusDotElem.style.color = DOT_COLORS[m.dotColor];
      this.statusLabelElem.textContent = m.statusLabel;
    }

    // 2. Story slot (popup first, then subtitle), one line at a time
    if (
      !prev ||
      state.centerPopupText !== prev.centerPopupText ||
      state.narrativeText !== prev.narrativeText ||
      state.fartNumber !== prev.fartNumber ||
      state.isClimax !== prev.isClimax
    ) {
      this.updateNarrative(state);
    }

    // 3. Onomatopoeia scale-pop animation
    if (state.onomatopoeiaTrigger && state.onomatopoeiaTrigger !== this.lastTriggerTimestamp) {
      this.lastTriggerTimestamp = state.onomatopoeiaTrigger;
      this.showOnomatopoeia(state.onomatopoeiaText || 'BRAAP!');
    }

    // 4. Tension ring: driven per frame by GameLoop through updateTensionRing;
    //    here only resync when the timer is reset (new fart / new game)
    if (!prev || state.tensionTimer > prev.tensionTimer) {
      this.updateTensionRing(state.tensionTimer, state.maxTension);
    }

    // 5. Whiteout Flash
    if (state.whiteoutOpacity !== this.lastWhiteout) {
      this.lastWhiteout = state.whiteoutOpacity;
      this.whiteoutElem.style.opacity = `${state.whiteoutOpacity}`;
    }

    // 6. Hide the card and controls for the whole climax (cinematic + ending screen)
    if (!prev || state.isClimax !== prev.isClimax) {
      this.container.classList.toggle('cinematic', state.isClimax);
      // The ending can be skipped by tap or Space/Enter/Escape after ~3 s (GameLoop ENDING_SKIP_AFTER)
      this.hideSkipHint();
      if (state.isClimax) this.skipHintTimer = window.setTimeout(() => this.showSkipHint(), 3200);
    }
    // Whiteout means the blast has started: nothing left to skip
    if (state.whiteoutOpacity > 0.05) this.hideSkipHint();

    // 7. Climax overlay
    if (state.isClimax && state.endingReady && state.whiteoutOpacity < 0.3) {
      this.showClimax();
    } else if (!state.isClimax) {
      this.hideClimax();
    }
  }

  private updateNarrative(state: GameStore) {
    if (this.popupTimer !== null) {
      window.clearTimeout(this.popupTimer);
      this.popupTimer = null;
    }

    if (state.centerPopupText !== this.lastPopupText) {
      this.lastPopupText = state.centerPopupText;
      this.renderPopup(state.centerPopupText);
    }
    if (state.narrativeText !== this.lastSubtitleText) {
      this.lastSubtitleText = state.narrativeText;
    }

    if (state.isClimax) {
      this.setNarrativeMode('none');
    } else if (state.centerPopupText) {
      this.setNarrativeMode('popup');
      // Popup auto-clears, then the subtitle (if any) takes the slot
      this.popupTimer = window.setTimeout(() => {
        this.popupTimer = null;
        this.setNarrativeMode(this.lastSubtitleText ? 'subtitle' : 'none');
        this.syncNarrativeText();
      }, POPUP_HOLD_MS);
    } else {
      this.setNarrativeMode(state.narrativeText ? 'subtitle' : 'none');
    }
    this.syncNarrativeText();
  }

  private popupLine(sep: string): string {
    return (this.lastPopupText ?? '').split('\n').join(sep);
  }

  /** Visible subtitle text plus the single screen-reader live region. */
  private syncNarrativeText() {
    // Compact viewports have no popup row: the headline goes into the subtitle line instead
    const compactPopup = this.narrativeMode === 'popup' && this.compactQuery.matches && !!this.lastPopupText;
    const shown = compactPopup ? this.popupLine(' ') : this.lastSubtitleText ?? '';
    if (shown !== this.lastSubtitleShown) {
      this.lastSubtitleShown = shown;
      this.subtitleTextElem.textContent = shown;
    }

    // One announcement per fart: status label, popup and subtitle together. The later
    // popup -> subtitle switch is the same beat and is not announced again.
    const status = this.statusLabelElem.textContent ?? '';
    const sub = this.lastSubtitleText ?? '';
    const key = `${status}|${sub}`;
    let spoken = '';
    if (this.narrativeMode === 'popup') {
      spoken = [status, this.popupLine('. '), sub].filter(Boolean).join('. ');
      this.announcedKey = key;
    } else if (this.narrativeMode === 'subtitle') {
      spoken = key === this.announcedKey ? this.lastAnnounced : [status, sub].filter(Boolean).join('. ');
      this.announcedKey = key;
    } else {
      this.announcedKey = '';
    }
    if (spoken !== this.lastAnnounced) {
      this.lastAnnounced = spoken;
      this.liveElem.textContent = spoken;
    }
  }

  private renderPopup(text: string | null) {
    // Built with DOM nodes (no innerHTML); first line is the headline, the rest is the italic sub line
    this.centerPopupElem.textContent = '';
    if (!text) return;
    const [head, ...rest] = text.split('\n');
    this.centerPopupElem.appendChild(document.createTextNode(head));
    if (rest.length > 0) {
      const sub = document.createElement('span');
      sub.className = 'popup-sub';
      sub.textContent = rest.join(' ');
      this.centerPopupElem.appendChild(sub);
    }
  }

  private setNarrativeMode(mode: NarrativeMode) {
    if (mode === this.narrativeMode) return;
    this.narrativeMode = mode;
    this.narrativeElem.dataset.mode = mode;
  }

  private showClimax() {
    if (this.climaxVisible) return;
    this.climaxVisible = true;
    this.restarting = false;
    if (this.climaxHideTimer !== null) {
      window.clearTimeout(this.climaxHideTimer);
      this.climaxHideTimer = null;
    }
    this.climaxOverlay.style.display = 'flex';
    // Force a reflow so the opacity transition actually plays
    void this.climaxOverlay.offsetWidth;
    this.climaxOverlay.classList.add('is-visible');
    this.setPlayAgainWaiting(true);
    this.hideSkipHint();
    if (this.armTimer !== null) window.clearTimeout(this.armTimer);
    this.armPlayAgain(PLAY_AGAIN_ARM_MS);
    this.playAgainBtn.focus({ preventScroll: true });
  }

  /** Arms Play Again after `delay` ms, waiting further while Space/Enter is still being pressed. */
  private armPlayAgain(delay: number) {
    this.armTimer = window.setTimeout(() => {
      const quietFor = performance.now() - this.lastKeyTime;
      if (quietFor < PLAY_AGAIN_KEY_GAP_MS) {
        this.armPlayAgain(PLAY_AGAIN_KEY_GAP_MS - quietFor);
        return;
      }
      this.armTimer = null;
      this.setPlayAgainWaiting(false);
    }, delay);
  }

  /** Dimmed + aria-disabled until the button actually responds, so it visibly lights up when armed. */
  private setPlayAgainWaiting(waiting: boolean) {
    this.playAgainArmed = !waiting;
    this.playAgainBtn.classList.toggle('waiting', waiting);
    this.playAgainBtn.setAttribute('aria-disabled', `${waiting}`);
  }

  private showSkipHint() {
    this.skipHintElem.classList.add('visible');
    // The visual hint is aria-hidden: announce the same cue through the live region
    this.liveElem.textContent = 'Press Space, Enter or tap to skip the ending.';
  }

  private hideSkipHint() {
    if (this.skipHintTimer !== null) {
      window.clearTimeout(this.skipHintTimer);
      this.skipHintTimer = null;
    }
    this.skipHintElem.classList.remove('visible');
  }

  private hideClimax() {
    if (!this.climaxVisible) return;
    this.climaxVisible = false;
    this.setPlayAgainWaiting(true);
    if (this.armTimer !== null) {
      window.clearTimeout(this.armTimer);
      this.armTimer = null;
    }
    this.climaxOverlay.classList.remove('is-visible');
    this.climaxHideTimer = window.setTimeout(() => {
      this.climaxHideTimer = null;
      this.climaxOverlay.style.display = 'none';
    }, CLIMAX_FADE_OUT_MS);
  }

  private showOnomatopoeia(text: string) {
    const el = this.onomatopoeiaElem;
    el.textContent = text;
    // CSS gives a first estimate from the character count (see font-size in hud.css)
    el.style.setProperty('--chars', `${text.length}`);
    // The text never wraps, so measure the real glyph width (fonts differ per device) and shrink to fit
    el.style.fontSize = '';
    // The pop animation peaks at 1.15x (and rotates), so the resting width must leave that headroom
    const room = el.clientWidth * (0.96 / 1.15);
    const need = el.scrollWidth;
    if (room > 0 && need > room) {
      const size = parseFloat(getComputedStyle(el).fontSize);
      el.style.fontSize = `${Math.max(12, Math.floor((size * room) / need))}px`;
    }
    this.onomatopoeiaElem.classList.remove('pop-anim');
    // Force DOM reflow
    void this.onomatopoeiaElem.offsetWidth;
    this.onomatopoeiaElem.classList.add('pop-anim');
  }

  private altitudeShown = -1;
  private lastAlt = 0;
  private peakAltitude = 0;
  private altEl: HTMLElement | null = null;
  private altValueEl: HTMLElement | null = null;
  private altSpeedEl: HTMLElement | null = null;
  private altFillEl: HTMLElement | null = null;
  private altPointerEl: HTMLElement | null = null;
  private altPeakEl: HTMLElement | null = null;

  /** Altimeter: log-scale fill, context ticks, pointer chip, peak marker, vertical speed. */
  public updateAltitude(meters: number, fartNumber = 0, dt = 0.016) {
    const alt = Math.max(0, meters);
    const el = (this.altEl ??= this.container.querySelector<HTMLElement>('#hud-altimeter')!);
    el.classList.toggle('visible', fartNumber >= 9 || alt > 1.5);

    if (Math.abs(alt - this.altitudeShown) < 0.2 && this.altitudeShown >= 0) return;

    const vSpeed = (alt - this.lastAlt) / Math.max(0.001, dt);
    this.lastAlt = alt;
    this.altitudeShown = alt;
    this.peakAltitude = Math.max(this.peakAltitude, alt);

    const value = (this.altValueEl ??= this.container.querySelector<HTMLElement>('#alt-value')!);
    const speed = (this.altSpeedEl ??= this.container.querySelector<HTMLElement>('#alt-speed')!);
    const fill = (this.altFillEl ??= this.container.querySelector<HTMLElement>('#alt-fill')!);
    const pointer = (this.altPointerEl ??= this.container.querySelector<HTMLElement>('#alt-pointer')!);
    const peak = (this.altPeakEl ??= this.container.querySelector<HTMLElement>('#alt-peak')!);

    if (alt < 10000) {
      value.textContent = `${Math.round(alt).toLocaleString('en-US')} m`;
    } else {
      value.textContent = `${(alt / 1000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
    }

    if (Math.abs(vSpeed) > 1.5) {
      if (Math.abs(vSpeed) < 1000) {
        speed.textContent = `${vSpeed > 0 ? '+' : ''}${Math.round(vSpeed)} m/s`;
      } else {
        speed.textContent = `${vSpeed > 0 ? '+' : ''}${(vSpeed / 1000).toFixed(1)} km/s`;
      }
      speed.style.color = vSpeed > 0 ? 'var(--col-accent-emerald)' : 'var(--col-accent-orange)';
    } else {
      speed.textContent = '0 m/s';
      speed.style.color = 'rgba(255, 255, 255, 0.6)';
    }

    const pct = Math.min(100, (Math.log10(1 + alt) / Math.log10(1 + 30000)) * 100);
    fill.style.height = `${pct}%`;
    pointer.style.bottom = `${pct}%`;

    const peakPct = Math.min(100, (Math.log10(1 + this.peakAltitude) / Math.log10(1 + 30000)) * 100);
    peak.style.bottom = `${peakPct}%`;
  }

  public updateTensionRing(timer: number, maxTimer: number) {
    const progress = Math.min(1, Math.max(0, timer / maxTimer));
    const offset = RING_CIRCUMFERENCE * (1 - progress);
    if (Math.abs(offset - this.lastRingOffset) >= 0.05) {
      this.lastRingOffset = offset;
      this.tensionRingSvg.style.strokeDashoffset = `${offset}`;
    }

    // Final second: colour change + pulse
    const urgent = timer > 0 && timer < 1;
    if (urgent !== this.ringUrgent) {
      this.ringUrgent = urgent;
      this.ringWrapper.classList.toggle('urgent', urgent);
    }

    // Whole seconds remaining for assistive tech (updated once per second)
    const seconds = Math.ceil(Math.max(0, timer));
    if (seconds !== this.lastRingSeconds) {
      this.lastRingSeconds = seconds;
      this.ringAriaElem.setAttribute('aria-valuenow', `${seconds}`);
      this.ringAriaElem.setAttribute('aria-valuetext', `${seconds} seconds until involuntary release`);
    }
  }

  private getTemplate(): string {
    const circumference = RING_CIRCUMFERENCE;
    return `
      <!-- ALTIMETER: log-scale gauge, context ticks, pointer chip, peak altitude -->
      <div id="hud-altimeter" class="hud-altimeter" aria-hidden="true">
        <span class="alt-title">ALTITUDE</span>
        <span id="alt-value" class="alt-value">0 m</span>
        <span id="alt-speed" class="alt-speed">0 m/s</span>
        <div class="alt-track">
          <div id="alt-fill" class="alt-fill"></div>
          <div id="alt-peak" class="alt-peak" title="Peak Altitude"></div>
          <div id="alt-pointer" class="alt-pointer"></div>
          <span class="alt-tick" style="bottom:53.6%"><i>☁️ 250 m</i></span>
          <span class="alt-tick" style="bottom:72.7%"><i>🌐 1.8 km</i></span>
          <span class="alt-tick" style="bottom:80.5%"><i>🛰️ 4 km</i></span>
          <span class="alt-tick" style="bottom:86.2%"><i>🌕 7.2 km</i></span>
          <span class="alt-tick" style="bottom:91.1%"><i>✨ 12 km</i></span>
        </div>
      </div>

      <!-- TOP ZONE: Signature Dark Glass HUD Card -->
      <div class="hud-top-zone">
        <div class="hud-glass-card">
          <div class="hud-row hud-row-meta">
            <span class="hud-label">FART STRENGTH</span>
            <div class="hud-meta-right">
              ${
                SHOW_MUSIC_PREVIEW
                  ? `<button id="music-preview-btn" class="music-preview-btn" type="button" title="Preview End-of-Game Music (Hotkey: M)">
                <span class="music-icon">🎵</span>
                <span id="music-preview-label">Preview Music</span>
              </button>`
                  : ''
              }
              <span id="hud-fart-num" class="hud-fart-count">FART #1</span>
            </div>
          </div>

          <div class="hud-row hud-row-metrics">
            <span id="hud-multiplier" class="hud-multiplier-val">×1</span>
            <span id="hud-decibels" class="hud-decibels-val">54 dB</span>
          </div>

          <div class="hud-progress-container">
            <div class="hud-progress-track">
              <div id="hud-progress-fill" class="hud-progress-fill"></div>
            </div>
            <!-- Acoustic Limit Tick Mark at 194 dB (approx 97% of 198 dB max) -->
            <div class="hud-limit-tick" title="194 dB Sound Limit"></div>
            <span class="hud-limit-tag">194 dB LIMIT</span>
          </div>

          <div class="hud-row hud-row-status">
            <span id="hud-status-dot" class="hud-status-dot" aria-hidden="true"></span>
            <span id="hud-status-label" class="hud-status-label">PERFECTLY DISCREET</span>
          </div>

          <!-- Fixed-height story slot inside the card: popup or subtitle, never both, never reflows -->
          <div id="hud-narrative" class="hud-narrative" data-mode="popup">
            <div id="narrative-center-popup" class="narrative-center-popup" aria-hidden="true">
              What if every fart DOUBLED in strength?
            </div>
            <div id="narrative-subtitle" class="narrative-subtitle-pill" aria-hidden="true">
              <p id="narrative-subtitle-text">Meet Dave. He's having a perfectly normal Tuesday.</p>
            </div>
            <!-- One persistent live region: the visual popup and subtitle are aria-hidden -->
            <div id="narrative-live" class="sr-only" role="status" aria-live="polite"></div>
          </div>
        </div>
      </div>

      <!-- MIDDLE ZONE: onomatopoeia pops only -->
      <div class="hud-narrative-zone">
        <!-- Giant Comic Comic Serif Onomatopoeia -->
        <div id="narrative-onomatopoeia" class="narrative-onomatopoeia" aria-hidden="true">poot</div>
      </div>

      <!-- BOTTOM CONTROL ZONE -->
      <div class="hud-bottom-zone">
        <!-- Left Virtual Joystick -->
        <div class="joystick-container">
          <div id="joystick-base" class="joystick-base" role="group" aria-label="Walk and steer joystick. Keyboard: W A S D or arrow keys">
            <div id="joystick-handle" class="joystick-handle"></div>
          </div>
          <span class="control-label">WALK / STEER</span>
        </div>

        <!-- Right Circular RELEASE Button with Radial Countdown -->
        <div class="release-btn-container">
          <!-- The progressbar lives on the SVG: progressbar children are presentational, and the button must stay interactive -->
          <div id="release-ring-wrapper" class="release-ring-wrapper">
            <svg
              id="tension-svg"
              class="tension-svg"
              viewBox="0 0 90 90"
              role="progressbar"
              aria-label="Involuntary tension"
              aria-valuemin="0"
              aria-valuemax="5"
              aria-valuenow="5"
            >
              <circle class="tension-bg" cx="45" cy="45" r="38"></circle>
              <circle
                id="tension-ring-circle"
                class="tension-indicator"
                cx="45"
                cy="45"
                r="38"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="0"
              ></circle>
            </svg>
            <button id="release-btn" class="release-button" aria-label="Release Fart">
              <span class="gas g1"></span><span class="gas g2"></span><span class="gas g3"></span>
              <span class="release-text">RELEASE</span>
            </button>
          </div>
          <span class="control-label">TENSION</span>
        </div>

        <!-- Desktop-only shortcut hint, fades after the first manual release -->
        <div id="key-hint" class="key-hint" aria-hidden="true">WASD + SPACE</div>
      </div>

      <!-- Ending cue: fades in once the cinematic can be skipped -->
      <div id="skip-hint" class="skip-hint" aria-hidden="true">TAP TO SKIP</div>

      <!-- Fullscreen Whiteout Flash for Fart #25 Climax -->
      <div id="whiteout-flash" class="whiteout-flash"></div>

      <!-- Climax Ending Overlay: Dave is fine -->
      <div id="climax-overlay" class="climax-overlay" role="dialog" aria-modal="true" aria-labelledby="climax-title">
        <h1 id="climax-title" class="climax-title">Dave is fine.</h1>
        <p class="climax-sub">16,777,216× power. 198 dB. The earth is no more.</p>
        <button id="play-again-btn" class="play-again-button waiting" aria-disabled="true">Play Again</button>
        <a id="saga-btn" class="play-again-button" href="?mode=act1" style="display:inline-block;text-decoration:none;margin-top:12px">Continue the saga &#9656;</a>
      </div>
    `;
  }
}
