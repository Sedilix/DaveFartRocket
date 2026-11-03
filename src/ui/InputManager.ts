import { useGameStore } from '../core/gameState';

export interface InputState {
  moveVector: { x: number; y: number }; // normalized -1 to 1
}

/** Accurate per-milestone cooldown synced with GameLoop.ts */
export function getFartCooldownMs(fartNumber: number): number {
  const nextNumber = Math.min(25, fartNumber + 1);
  if (nextNumber >= 9) {
    return (1.5 + (nextNumber - 9) * 0.03) * 1000;
  }
  return 850;
}

export class InputManager {
  public inputState: InputState = {
    moveVector: { x: 0, y: 0 }
  };

  private keysDown = new Set<string>();
  private joystickActive = false;
  private joystickTouchId: number | null = null;
  private joystickOrigin = { x: 0, y: 0 };
  private joystickMaxRadius = 38; // px, recomputed from the base size on pointerdown
  private joystickHandle: HTMLElement | null = null;

  private releaseBtn: HTMLElement | null = null;
  private lastReleaseTime = -Infinity;
  private coolingTimer: number | null = null;

  // Returns false when the game rejected the fart (still cooling down, world not loaded);
  // undefined or true count as accepted
  private onReleaseCallback: (() => boolean | void) | null = null;

  constructor() {
    this.setupKeyboard();

    // An involuntary release also starts the cooldown, so a press right after it cannot double-fire
    useGameStore.subscribe((state, prev) => {
      if (state.fartNumber > prev.fartNumber) this.startCooldown();
    });
  }

  public setOnRelease(cb: () => boolean | void) {
    this.onReleaseCallback = cb;
  }

  /** Fires the release callback unless one fired less than milestone cooldown ago. */
  private tryRelease() {
    if (this.endingPlaying()) return;
    if (!this.onReleaseCallback) return;
    const fartNumber = useGameStore.getState().fartNumber;
    const cooldown = getFartCooldownMs(fartNumber);
    if (performance.now() - this.lastReleaseTime < cooldown) return;
    const before = useGameStore.getState().fartNumber;
    if (this.onReleaseCallback() === false) return;
    const after = useGameStore.getState().fartNumber;
    if (after === before) return;
    this.triggerHaptic(after);
    this.startCooldown();
  }

  /** Triggers progressive haptic feedback on devices with vibration support */
  public triggerHaptic(fartNumber: number) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        if (fartNumber >= 25) {
          navigator.vibrate([120, 60, 220, 80, 500]);
        } else if (fartNumber >= 16) {
          navigator.vibrate([45, 30, 85, 30, 110]);
        } else if (fartNumber >= 9) {
          navigator.vibrate([35, 25, 55]);
        } else {
          navigator.vibrate(18);
        }
      } catch {}
    }
  }

  private endingPlaying(): boolean {
    return useGameStore.getState().isClimax;
  }

  /** Locks manual releases for the actual milestone cooldown and shows WAIT label. */
  private startCooldown() {
    this.lastReleaseTime = performance.now();
    const btn = this.releaseBtn;
    if (!btn) return;
    const fartNumber = useGameStore.getState().fartNumber;
    const cooldownMs = getFartCooldownMs(fartNumber);
    const label = btn.querySelector('.release-text');
    btn.classList.remove('armed');
    btn.classList.add('cooling');
    btn.setAttribute('aria-disabled', 'true');
    if (label) label.textContent = 'WAIT';
    if (this.coolingTimer !== null) window.clearTimeout(this.coolingTimer);
    this.coolingTimer = window.setTimeout(() => {
      this.coolingTimer = null;
      btn.classList.remove('cooling');
      btn.classList.add('armed');
      btn.setAttribute('aria-disabled', 'false');
      if (label) label.textContent = 'RELEASE';
      window.setTimeout(() => btn?.classList.remove('armed'), 400);
    }, cooldownMs);
  }

  private setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      // Keyboard path for "tap to skip" during the ending cinematic
      if ((e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') && this.endingPlaying()) {
        const overlay = document.getElementById('climax-overlay');
        if (!overlay?.classList.contains('is-visible')) {
          e.preventDefault();
          // GameLoop skips on any pointerdown (it ignores it until the skip window opens)
          if (!e.repeat) window.dispatchEvent(new PointerEvent('pointerdown'));
          return;
        }
      }

      if (e.code === 'Space' || e.code === 'Enter') {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;

        // Ending screen is up: no global shortcut. Focus sits on Play Again, so only
        // its native activation works, and held-key repeats must not trigger it.
        const overlay = document.getElementById('climax-overlay');
        if (overlay && overlay.classList.contains('is-visible')) {
          if (target?.id !== 'play-again-btn' || e.repeat) e.preventDefault();
          return;
        }

        // Let other focused buttons / inputs keep their native Space/Enter behaviour
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (tag === 'BUTTON' && target?.id !== 'release-btn')) {
          return;
        }

        e.preventDefault();
        if (!e.repeat) this.tryRelease();
        return;
      }

      this.keysDown.add(e.code);
      this.updateKeyboardVector();
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
      this.updateKeyboardVector();
    });

    // Lost focus means lost keyup events: drop every held key
    window.addEventListener('blur', () => this.releaseAllInputs());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAllInputs();
    });
  }

  private releaseAllInputs() {
    this.keysDown.clear();
    this.resetJoystick();
    this.inputState.moveVector.x = 0;
    this.inputState.moveVector.y = 0;
  }

  private resetJoystick() {
    this.joystickActive = false;
    this.joystickTouchId = null;
    if (this.joystickHandle) {
      this.joystickHandle.style.transform = `translate(0px, 0px)`;
    }
  }

  private updateKeyboardVector() {
    if (this.joystickActive) return;

    let x = 0;
    let y = 0;

    if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) x -= 1;
    if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) x += 1;
    if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) y += 1;
    if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) y -= 1;

    // Normalize diagonal keyboard movement
    const len = Math.sqrt(x * x + y * y);
    if (len > 0) {
      this.inputState.moveVector.x = x / len;
      this.inputState.moveVector.y = y / len;
    } else {
      this.inputState.moveVector.x = 0;
      this.inputState.moveVector.y = 0;
    }
  }

  public bindJoystickElements(base: HTMLElement, handle: HTMLElement) {
    this.joystickHandle = handle;

    base.addEventListener('pointerdown', (e) => {
      // Mouse: left button only (touch and pen report 0, so multi-touch is unaffected)
      if (e.button !== 0) return;
      if (this.joystickActive) return; // already tracking a finger
      this.joystickActive = true;
      this.joystickTouchId = e.pointerId;
      const rect = base.getBoundingClientRect();
      this.joystickOrigin = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
      this.joystickMaxRadius = rect.width * 0.35; // 38px on a 108px base
      base.setPointerCapture(e.pointerId);
      this.handleJoystickMove(e.clientX, e.clientY);
    });

    base.addEventListener('pointermove', (e) => {
      if (!this.joystickActive || e.pointerId !== this.joystickTouchId) return;
      this.handleJoystickMove(e.clientX, e.clientY);
    });

    const endJoystick = (e: PointerEvent) => {
      if (e.pointerId === this.joystickTouchId) {
        this.resetJoystick();
        this.inputState.moveVector.x = 0;
        this.inputState.moveVector.y = 0;
        // Keys may still be held: hand control back to the keyboard
        this.updateKeyboardVector();
      }
    };

    base.addEventListener('pointerup', endJoystick);
    base.addEventListener('pointercancel', endJoystick);
    base.addEventListener('lostpointercapture', endJoystick);
  }

  private handleJoystickMove(clientX: number, clientY: number) {
    const maxRadius = this.joystickMaxRadius;
    const dx = clientX - this.joystickOrigin.x;
    const dy = clientY - this.joystickOrigin.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let normX = dx;
    let normY = dy;
    if (dist > maxRadius) {
      normX = (dx / dist) * maxRadius;
      normY = (dy / dist) * maxRadius;
    }

    if (this.joystickHandle) {
      this.joystickHandle.style.transform = `translate(${normX}px, ${normY}px)`;
    }

    // Normalized move vector (-1 to 1). Inverted Y for forward/back
    this.inputState.moveVector.x = normX / maxRadius;
    this.inputState.moveVector.y = -normY / maxRadius;
  }

  public bindReleaseButton(btn: HTMLElement) {
    this.releaseBtn = btn;
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      this.tryRelease();
    });
  }
}
