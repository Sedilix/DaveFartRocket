import { quality, QualityTier } from '../core/QualityManager';

export interface GameSettings {
  masterVolume: number; // 0..100
  musicVolume: number; // 0..100
  sfxVolume: number; // 0..100
  voiceVolume: number; // 0..100
  qualityTier: QualityTier;
  lookSensitivity: number; // 0.5..2.5
  invertY: boolean;
  reduceMotion: boolean;
  reduceFlashing: boolean;
  textScale: number; // 80..140 (%)
  assistMode: boolean;
  captions: boolean;
  leftHanded: boolean;
}

const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 80,
  musicVolume: 70,
  sfxVolume: 85,
  voiceVolume: 90,
  qualityTier: 'medium',
  lookSensitivity: 1.0,
  invertY: false,
  reduceMotion: false,
  reduceFlashing: false,
  textScale: 100,
  assistMode: false,
  captions: true,
  leftHanded: false
};

const STORAGE_KEY = 'dave_settings_v1';

class SettingsManager {
  private current: GameSettings;
  private listeners = new Set<(s: GameSettings) => void>();

  constructor() {
    this.current = this.load();
    this.apply();
  }

  private load(): GameSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn('Failed to load settings', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  public save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.current));
      this.apply();
      this.notify();
    } catch (e) {
      console.warn('Failed to save settings', e);
    }
  }

  public get(): GameSettings {
    return { ...this.current };
  }

  public set(patch: Partial<GameSettings>) {
    this.current = { ...this.current, ...patch };
    this.save();
  }

  public subscribe(cb: (s: GameSettings) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    for (const cb of this.listeners) {
      try { cb(this.current); } catch {}
    }
  }

  public apply() {
    // 1. Text scale
    const root = document.documentElement;
    const factor = this.current.textScale / 100;
    root.style.setProperty('--fs-caption', `clamp(${11 * factor}px, ${1.25 * factor}vw, ${12 * factor}px)`);
    root.style.setProperty('--fs-label', `clamp(${12 * factor}px, ${1.4 * factor}vw, ${13 * factor}px)`);
    root.style.setProperty('--fs-body', `clamp(${15 * factor}px, ${1.75 * factor}vw, ${17 * factor}px)`);
    root.style.setProperty('--fs-body-lg', `clamp(${17 * factor}px, ${2.1 * factor}vw, ${19 * factor}px)`);
    root.style.setProperty('--fs-title-s', `clamp(${20 * factor}px, ${2.5 * factor}vw, ${24 * factor}px)`);
    root.style.setProperty('--fs-title', `clamp(${28 * factor}px, ${3.6 * factor}vw, ${36 * factor}px)`);

    // 2. Reduce motion & flashing classes on document body
    document.body.classList.toggle('prefers-reduced-motion', this.current.reduceMotion);
    document.body.classList.toggle('reduce-flashing', this.current.reduceFlashing);
    document.body.classList.toggle('layout-left-handed', this.current.leftHanded);

    // 3. Quality tier
    try {
      quality.setTier(this.current.qualityTier, true);
    } catch {}
  }
}

export const settings = new SettingsManager();

/** Interactive settings modal dialog */
export class SettingsModal {
  private el: HTMLElement;
  private isOpen = false;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'hud-modal-overlay';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-label', 'Game Settings');
    this.render();
    document.body.appendChild(this.el);

    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close();
    });

    window.addEventListener('keydown', (e) => {
      if (this.isOpen && e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    });
  }

  public open() {
    this.isOpen = true;
    this.render();
    this.el.classList.add('open');
    if (document.exitPointerLock) document.exitPointerLock();
  }

  public close() {
    this.isOpen = false;
    this.el.classList.remove('open');
  }

  private render() {
    const s = settings.get();
    this.el.innerHTML = `
      <div class="hud-modal-card hud-glass-card">
        <div class="hud-modal-title">
          <span>SETTINGS</span>
          <button data-action="close" class="hud-btn hud-btn-ghost" style="padding:6px 14px;min-height:32px">✕</button>
        </div>

        <div class="hud-settings-group">
          <div style="font-size:var(--fs-label);font-weight:var(--fw-bold);color:var(--col-accent-cyan);letter-spacing:var(--tracking-wider);text-transform:uppercase">Audio</div>

          <div class="hud-settings-row">
            <div class="hud-settings-label">
              <span>Master Volume</span>
              <span class="hud-settings-desc">Overall sound output</span>
            </div>
            <div class="hud-slider-wrap">
              <input type="range" data-key="masterVolume" min="0" max="100" value="${s.masterVolume}">
              <span style="font-variant-numeric:tabular-nums;width:38px;text-align:right">${s.masterVolume}%</span>
            </div>
          </div>

          <div class="hud-settings-row">
            <div class="hud-settings-label">
              <span>Music Volume</span>
              <span class="hud-settings-desc">Synthesized soundtracks</span>
            </div>
            <div class="hud-slider-wrap">
              <input type="range" data-key="musicVolume" min="0" max="100" value="${s.musicVolume}">
              <span style="font-variant-numeric:tabular-nums;width:38px;text-align:right">${s.musicVolume}%</span>
            </div>
          </div>

          <div class="hud-settings-row">
            <div class="hud-settings-label">
              <span>SFX Volume</span>
              <span class="hud-settings-desc">Farts, boosts, impacts</span>
            </div>
            <div class="hud-slider-wrap">
              <input type="range" data-key="sfxVolume" min="0" max="100" value="${s.sfxVolume}">
              <span style="font-variant-numeric:tabular-nums;width:38px;text-align:right">${s.sfxVolume}%</span>
            </div>
          </div>
        </div>

        <div class="hud-settings-group">
          <div style="font-size:var(--fs-label);font-weight:var(--fw-bold);color:var(--col-accent-cyan);letter-spacing:var(--tracking-wider);text-transform:uppercase">Graphics & Display</div>

          <div class="hud-settings-row">
            <div class="hud-settings-label">
              <span>Graphics Quality</span>
              <span class="hud-settings-desc">Resolution, shadows, particles</span>
            </div>
            <select data-key="qualityTier" class="hud-select">
              <option value="low" ${s.qualityTier === 'low' ? 'selected' : ''}>Low (High Perf)</option>
              <option value="medium" ${s.qualityTier === 'medium' ? 'selected' : ''}>Medium (Balanced)</option>
              <option value="high" ${s.qualityTier === 'high' ? 'selected' : ''}>High (Full Fidelity)</option>
            </select>
          </div>

          <div class="hud-settings-row">
            <div class="hud-settings-label">
              <span>Text Size</span>
              <span class="hud-settings-desc">UI and dialogue scale</span>
            </div>
            <div class="hud-slider-wrap">
              <input type="range" data-key="textScale" min="80" max="140" step="5" value="${s.textScale}">
              <span style="font-variant-numeric:tabular-nums;width:38px;text-align:right">${s.textScale}%</span>
            </div>
          </div>
        </div>

        <div class="hud-settings-group">
          <div style="font-size:var(--fs-label);font-weight:var(--fw-bold);color:var(--col-accent-cyan);letter-spacing:var(--tracking-wider);text-transform:uppercase">Accessibility & Controls</div>

          <div class="hud-settings-row">
            <div class="hud-settings-label">
              <span>Reduce Motion</span>
              <span class="hud-settings-desc">Dampen camera shake and FOV kick</span>
            </div>
            <button data-toggle="reduceMotion" class="hud-toggle-btn ${s.reduceMotion ? 'active' : ''}">${s.reduceMotion ? 'ON' : 'OFF'}</button>
          </div>

          <div class="hud-settings-row">
            <div class="hud-settings-label">
              <span>Reduce Flashing</span>
              <span class="hud-settings-desc">Protect against rapid whiteouts</span>
            </div>
            <button data-toggle="reduceFlashing" class="hud-toggle-btn ${s.reduceFlashing ? 'active' : ''}">${s.reduceFlashing ? 'ON' : 'OFF'}</button>
          </div>

          <div class="hud-settings-row">
            <div class="hud-settings-label">
              <span>Assist Mode</span>
              <span class="hud-settings-desc">Gentler platforming & meter drain</span>
            </div>
            <button data-toggle="assistMode" class="hud-toggle-btn ${s.assistMode ? 'active' : ''}">${s.assistMode ? 'ON' : 'OFF'}</button>
          </div>

          <div class="hud-settings-row">
            <div class="hud-settings-label">
              <span>Audio Captions</span>
              <span class="hud-settings-desc">Show text for sound events</span>
            </div>
            <button data-toggle="captions" class="hud-toggle-btn ${s.captions ? 'active' : ''}">${s.captions ? 'ON' : 'OFF'}</button>
          </div>

          <div class="hud-settings-row">
            <div class="hud-settings-label">
              <span>Left-Handed Mobile Controls</span>
              <span class="hud-settings-desc">Swap joystick and release button</span>
            </div>
            <button data-toggle="leftHanded" class="hud-toggle-btn ${s.leftHanded ? 'active' : ''}">${s.leftHanded ? 'ON' : 'OFF'}</button>
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:10px">
          <button data-action="close" class="hud-btn hud-btn-primary">DONE</button>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents() {
    this.el.querySelectorAll('[data-action="close"]').forEach((btn) => {
      btn.addEventListener('click', () => this.close());
    });

    this.el.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach((input) => {
      input.addEventListener('input', () => {
        const key = input.dataset.key as keyof GameSettings;
        const val = Number(input.value);
        settings.set({ [key]: val });
        const label = input.nextElementSibling;
        if (label) label.textContent = `${val}%`;
      });
    });

    this.el.querySelectorAll<HTMLSelectElement>('select').forEach((sel) => {
      sel.addEventListener('change', () => {
        const key = sel.dataset.key as keyof GameSettings;
        settings.set({ [key]: sel.value as any });
      });
    });

    this.el.querySelectorAll<HTMLButtonElement>('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.toggle as keyof GameSettings;
        const current = settings.get()[key];
        const updated = !current;
        settings.set({ [key]: updated });
        btn.classList.toggle('active', updated);
        btn.textContent = updated ? 'ON' : 'OFF';
      });
    });
  }
}

export const settingsModal = new SettingsModal();
