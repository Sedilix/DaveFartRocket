import { useGameStore } from '../core/gameState';
export class HudController {
    container;
    // Top Card elements
    fartNumElem;
    multiplierElem;
    decibelsElem;
    progressBarFill;
    statusDotElem;
    statusLabelElem;
    // Middle Narrative elements
    centerPopupElem;
    onomatopoeiaElem;
    subtitleElem;
    subtitleTextElem;
    // Bottom Control elements
    joystickBase;
    joystickHandle;
    releaseBtn;
    tensionRingSvg;
    // Whiteout Flash & Climax Ending
    whiteoutElem;
    climaxOverlay;
    playAgainBtn;
    onPlayAgainCallback = null;
    lastTriggerTimestamp = 0;
    constructor(parent) {
        this.container = document.createElement('div');
        this.container.id = 'hud-root';
        this.container.innerHTML = this.getTemplate();
        parent.appendChild(this.container);
        this.cacheElements();
        this.bindStore();
    }
    getJoystickElements() {
        return { base: this.joystickBase, handle: this.joystickHandle };
    }
    getReleaseButton() {
        return this.releaseBtn;
    }
    setOnPlayAgain(cb) {
        this.onPlayAgainCallback = cb;
    }
    cacheElements() {
        this.fartNumElem = this.container.querySelector('#hud-fart-num');
        this.multiplierElem = this.container.querySelector('#hud-multiplier');
        this.decibelsElem = this.container.querySelector('#hud-decibels');
        this.progressBarFill = this.container.querySelector('#hud-progress-fill');
        this.statusDotElem = this.container.querySelector('#hud-status-dot');
        this.statusLabelElem = this.container.querySelector('#hud-status-label');
        this.centerPopupElem = this.container.querySelector('#narrative-center-popup');
        this.onomatopoeiaElem = this.container.querySelector('#narrative-onomatopoeia');
        this.subtitleElem = this.container.querySelector('#narrative-subtitle');
        this.subtitleTextElem = this.container.querySelector('#narrative-subtitle-text');
        this.joystickBase = this.container.querySelector('#joystick-base');
        this.joystickHandle = this.container.querySelector('#joystick-handle');
        this.releaseBtn = this.container.querySelector('#release-btn');
        this.tensionRingSvg = this.container.querySelector('#tension-ring-circle');
        this.whiteoutElem = this.container.querySelector('#whiteout-flash');
        this.climaxOverlay = this.container.querySelector('#climax-overlay');
        this.playAgainBtn = this.container.querySelector('#play-again-btn');
        this.playAgainBtn.addEventListener('click', () => {
            if (this.onPlayAgainCallback) {
                this.onPlayAgainCallback();
            }
        });
    }
    bindStore() {
        useGameStore.subscribe((state) => {
            // 1. Top HUD Card
            this.fartNumElem.textContent = `FART #${state.fartNumber}`;
            this.multiplierElem.textContent = state.currentMilestone.multiplierFormatted;
            this.decibelsElem.textContent = `${state.currentMilestone.decibels} dB`;
            // Color code decibels
            if (state.currentMilestone.decibels >= 150) {
                this.decibelsElem.style.color = '#ff4d4d';
            }
            else if (state.currentMilestone.decibels >= 90) {
                this.decibelsElem.style.color = '#ff9f43';
            }
            else {
                this.decibelsElem.style.color = '#2ecc71';
            }
            // Progress bar (54 dB to 198 dB)
            const pct = Math.min(100, Math.max(0, ((state.currentMilestone.decibels - 54) / (198 - 54)) * 100));
            this.progressBarFill.style.width = `${pct}%`;
            // Status dot & label
            const dotColors = {
                green: '#2ecc71',
                yellow: '#f1c40f',
                orange: '#e67e22',
                red: '#e74c3c'
            };
            this.statusDotElem.style.color = dotColors[state.currentMilestone.dotColor];
            this.statusLabelElem.textContent = state.currentMilestone.statusLabel;
            // 2. Center Popup
            if (state.centerPopupText) {
                this.centerPopupElem.innerHTML = state.centerPopupText.replace('\n', '<br><span class="popup-sub">') + (state.centerPopupText.includes('\n') ? '</span>' : '');
                this.centerPopupElem.style.display = 'block';
                this.centerPopupElem.style.opacity = '1';
            }
            else {
                this.centerPopupElem.style.opacity = '0';
                setTimeout(() => {
                    if (!useGameStore.getState().centerPopupText) {
                        this.centerPopupElem.style.display = 'none';
                    }
                }, 400);
            }
            // 3. Subtitle
            if (state.narrativeText) {
                this.subtitleTextElem.textContent = state.narrativeText;
                this.subtitleElem.style.display = 'flex';
                this.subtitleElem.style.opacity = '1';
            }
            else {
                this.subtitleElem.style.opacity = '0';
                setTimeout(() => {
                    if (!useGameStore.getState().narrativeText) {
                        this.subtitleElem.style.display = 'none';
                    }
                }, 400);
            }
            // 4. Onomatopoeia scale-pop animation
            if (state.onomatopoeiaTrigger && state.onomatopoeiaTrigger !== this.lastTriggerTimestamp) {
                this.lastTriggerTimestamp = state.onomatopoeiaTrigger;
                this.showOnomatopoeia(state.onomatopoeiaText || 'BRAAP!');
            }
            // 5. Tension Countdown Ring
            const circumference = 2 * Math.PI * 38; // r = 38
            const progress = Math.min(1, Math.max(0, state.tensionTimer / state.maxTension));
            const offset = circumference * (1 - progress);
            this.tensionRingSvg.style.strokeDashoffset = `${offset}`;
            // 6. Whiteout Flash
            this.whiteoutElem.style.opacity = `${state.whiteoutOpacity}`;
            // 7. Climax overlay
            // Hide the controls and card while the closing cinematic plays
            this.container.classList.toggle('cinematic', state.isClimax && !state.endingReady);
            if (state.isClimax && state.endingReady && state.whiteoutOpacity < 0.3) {
                this.climaxOverlay.style.display = 'flex';
                this.climaxOverlay.style.opacity = '1';
            }
            else if (!state.isClimax) {
                this.climaxOverlay.style.display = 'none';
                this.climaxOverlay.style.opacity = '0';
            }
        });
    }
    showOnomatopoeia(text) {
        this.onomatopoeiaElem.textContent = text;
        this.onomatopoeiaElem.classList.remove('pop-anim');
        // Force DOM reflow
        void this.onomatopoeiaElem.offsetWidth;
        this.onomatopoeiaElem.classList.add('pop-anim');
    }
    updateTensionRing(timer, maxTimer) {
        const circumference = 2 * Math.PI * 38;
        const progress = Math.min(1, Math.max(0, timer / maxTimer));
        const offset = circumference * (1 - progress);
        this.tensionRingSvg.style.strokeDashoffset = `${offset}`;
    }
    getTemplate() {
        const circumference = 2 * Math.PI * 38;
        return `
      <!-- TOP ZONE: Signature Dark Glass HUD Card -->
      <header class="hud-top-zone">
        <div class="hud-glass-card">
          <div class="hud-row hud-row-meta">
            <span class="hud-label">FART STRENGTH</span>
            <span id="hud-fart-num" class="hud-fart-count">FART #1</span>
          </div>

          <div class="hud-row hud-row-metrics">
            <span id="hud-multiplier" class="hud-multiplier-val">×1</span>
            <span id="hud-decibels" class="hud-decibels-val">54 dB</span>
          </div>

          <div class="hud-progress-container">
            <div class="hud-progress-track">
              <div id="hud-progress-fill" class="hud-progress-fill" style="width: 0%;"></div>
            </div>
            <!-- Acoustic Limit Tick Mark at 194 dB (approx 97% of 198 dB max) -->
            <div class="hud-limit-tick" title="194 dB Sound Limit"></div>
            <span class="hud-limit-tag">194 dB LIMIT</span>
          </div>

          <div class="hud-row hud-row-status">
            <span id="hud-status-dot" class="hud-status-dot">●</span>
            <span id="hud-status-label" class="hud-status-label">PERFECTLY DISCREET</span>
          </div>

          <!-- Narrative text lives inside the card so it never covers Dave -->
          <div id="narrative-center-popup" class="narrative-center-popup">
            What if every fart DOUBLED in strength?
          </div>
          <div id="narrative-subtitle" class="narrative-subtitle-pill">
            <p id="narrative-subtitle-text">Meet Dave. He's having a perfectly normal Tuesday.</p>
          </div>
        </div>
      </header>

      <!-- MIDDLE ZONE: onomatopoeia pops only -->
      <main class="hud-narrative-zone">
        <!-- Giant Comic Comic Serif Onomatopoeia -->
        <div id="narrative-onomatopoeia" class="narrative-onomatopoeia">poot</div>
      </main>

      <!-- BOTTOM CONTROL ZONE: height: 190px, bottom: safe-area -->
      <footer class="hud-bottom-zone">
        <!-- Left Virtual Joystick -->
        <div class="joystick-container">
          <div id="joystick-base" class="joystick-base">
            <div id="joystick-handle" class="joystick-handle"></div>
          </div>
          <span class="control-label">WALK / STEER</span>
        </div>

        <!-- Right Circular RELEASE Button with Radial Countdown -->
        <div class="release-btn-container">
          <div class="release-ring-wrapper">
            <svg class="tension-svg" viewBox="0 0 90 90">
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
              <span class="release-text">RELEASE</span>
            </button>
          </div>
          <span class="control-label">INVOLUNTARY TENSION</span>
        </div>
      </footer>

      <!-- Fullscreen Whiteout Flash for Fart #25 Climax -->
      <div id="whiteout-flash" class="whiteout-flash"></div>

      <!-- Climax Ending Overlay: Dave is fine -->
      <div id="climax-overlay" class="climax-overlay">
        <h1 class="climax-title">Dave is fine.</h1>
        <p class="climax-sub">16,777,216× power. 198 dB. The earth is no more.</p>
        <button id="play-again-btn" class="play-again-button">Play Again</button>
      </div>
    `;
    }
}
//# sourceMappingURL=HudController.js.map