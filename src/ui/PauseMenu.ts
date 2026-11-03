import { settingsModal } from './Settings';

/**
 * Universal pause menu and mobile pause trigger.
 * Active in all modes (STREET, VOXEL, S1-S5).
 */
export class PauseMenu {
  private static instance: PauseMenu | null = null;
  private overlay: HTMLElement;
  private pillBtn: HTMLElement;
  private isOpen = false;

  public static getInstance(): PauseMenu {
    if (!PauseMenu.instance) {
      PauseMenu.instance = new PauseMenu();
    }
    return PauseMenu.instance;
  }

  constructor() {
    // 1. Floating Menu Pill (Top-left, mobile accessible)
    this.pillBtn = document.createElement('button');
    this.pillBtn.className = 'hud-menu-pill';
    this.pillBtn.setAttribute('aria-label', 'Pause Menu');
    this.pillBtn.innerHTML = `<span>☰</span>`;
    this.pillBtn.style.cssText = `
      position: fixed;
      left: max(14px, env(safe-area-inset-left));
      top: max(14px, env(safe-area-inset-top));
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: var(--hud-glass-bg);
      border: 1.5px solid var(--hud-glass-border-subtle);
      color: #fff;
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(var(--hud-blur));
      -webkit-backdrop-filter: blur(var(--hud-blur));
      z-index: var(--z-hud);
      box-shadow: 0 4px 14px rgba(0,0,0,0.4);
      user-select: none;
      -webkit-user-select: none;
      transition: transform 0.15s ease, background 0.15s ease;
    `;
    this.pillBtn.addEventListener('click', () => this.toggle());
    document.body.appendChild(this.pillBtn);

    // 2. Pause Overlay Modal
    this.overlay = document.createElement('div');
    this.overlay.className = 'hud-modal-overlay';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-label', 'Game Paused');
    this.overlay.innerHTML = `
      <div class="hud-modal-card hud-glass-card" style="width:min(400px,90vw);text-align:center;align-items:center">
        <h2 style="font-family:var(--font-story);font-size:var(--fs-title);margin:0 0 4px;letter-spacing:1px">PAUSED</h2>
        <p style="font-family:var(--font-story);font-style:italic;font-size:var(--fs-body);opacity:0.8;margin:0 0 16px">The galaxy pauses with you.</p>

        <div style="display:flex;flex-direction:column;gap:10px;width:100%;max-width:280px">
          <button data-action="resume" class="hud-btn hud-btn-primary" style="width:100%">RESUME</button>
          <button data-action="settings" class="hud-btn hud-btn-secondary" style="width:100%">SETTINGS</button>
          <button data-action="restart" class="hud-btn hud-btn-secondary" style="width:100%">RESTART SCENE</button>
          <a href="?mode=menu" class="hud-btn hud-btn-ghost" style="width:100%">MAIN MENU</a>
        </div>
      </div>
    `;
    document.body.appendChild(this.overlay);

    // Events
    this.overlay.querySelector('[data-action="resume"]')?.addEventListener('click', () => this.close());
    this.overlay.querySelector('[data-action="settings"]')?.addEventListener('click', () => {
      this.close();
      settingsModal.open();
    });
    this.overlay.querySelector('[data-action="restart"]')?.addEventListener('click', () => window.location.reload());

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // If settings modal is open, let settings modal handle it
        if (document.querySelector('.hud-modal-overlay.open:not([aria-label="Game Paused"])')) return;
        e.preventDefault();
        this.toggle();
      }
    });
  }

  public toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  public open() {
    this.isOpen = true;
    this.overlay.classList.add('open');
    if (document.exitPointerLock) document.exitPointerLock();
  }

  public close() {
    this.isOpen = false;
    this.overlay.classList.remove('open');
  }

  public hidePill() {
    this.pillBtn.style.display = 'none';
  }

  public showPill() {
    this.pillBtn.style.display = 'flex';
  }
}

export const pauseMenu = PauseMenu.getInstance();
