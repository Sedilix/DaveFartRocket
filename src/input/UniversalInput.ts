import { settings } from '../ui/Settings';

export interface InputVector {
  x: number;
  y: number;
}

export interface InputActions {
  move: InputVector; // -1 to 1
  lookDelta: InputVector; // pixels / radians
  jump: boolean;
  jumpPressed: boolean; // single-frame edge
  fart: boolean;
  fartPressed: boolean;
  hum: boolean;
  interact: boolean;
  interactPressed: boolean;
}

export class UniversalInput {
  private static instance: UniversalInput | null = null;

  public actions: InputActions = {
    move: { x: 0, y: 0 },
    lookDelta: { x: 0, y: 0 },
    jump: false,
    jumpPressed: false,
    fart: false,
    fartPressed: false,
    hum: false,
    interact: false,
    interactPressed: false
  };

  private keys = new Set<string>();
  private justPressedKeys = new Set<string>();

  // Touch tracking
  private touchLayer?: HTMLElement;
  private joystickBase?: HTMLElement;
  private joystickThumb?: HTMLElement;
  private joystickTouchId: number | null = null;
  private joystickOrigin = { x: 0, y: 0 };
  private touchMove = { x: 0, y: 0 };

  private lookTouchId: number | null = null;
  private lastLookPos = { x: 0, y: 0 };
  private accumulatedLook = { x: 0, y: 0 };

  // Mouse drag-to-look fallback (when pointer lock is not active)
  private isMouseDown = false;
  private lastMousePos = { x: 0, y: 0 };
  public isPointerLocked = false;

  // Jump buffer & coyote time state
  public jumpBufferTimer = 0; // seconds remaining to consume buffered jump
  public coyoteTimer = 0; // seconds remaining Dave can still jump after walking off edge

  public static getInstance(): UniversalInput {
    if (!UniversalInput.instance) {
      UniversalInput.instance = new UniversalInput();
    }
    return UniversalInput.instance;
  }

  constructor() {
    this.setupKeyboard();
    this.setupMouse();
    this.setupTouch();
  }

  // ---------------------------------------------------------------- Keyboard
  private setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) {
        this.justPressedKeys.add(e.code);
      }
      this.keys.add(e.code);

      if (e.code === 'Space' || e.code === 'KeyF' || e.code === 'KeyE') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          e.preventDefault();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.justPressedKeys.clear();
    });
  }

  // ---------------------------------------------------------------- Mouse
  private setupMouse() {
    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = !!document.pointerLockElement;
    });

    window.addEventListener('mousemove', (e) => {
      const s = settings.get();
      const sens = s.lookSensitivity * (s.invertY ? -1 : 1);

      if (this.isPointerLocked) {
        this.accumulatedLook.x -= e.movementX * 0.0022 * s.lookSensitivity;
        this.accumulatedLook.y += e.movementY * 0.0022 * sens;
      } else if (this.isMouseDown) {
        const dx = e.clientX - this.lastMousePos.x;
        const dy = e.clientY - this.lastMousePos.y;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        this.accumulatedLook.x -= dx * 0.003 * s.lookSensitivity;
        this.accumulatedLook.y += dy * 0.003 * sens;
      }
    });

    window.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, select, input, .hud-glass-card, .story-dialogue-card, .hud-modal-card')) return;
      this.isMouseDown = true;
      this.lastMousePos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });
  }

  // ---------------------------------------------------------------- Touch
  private setupTouch() {
    // Only mount touch UI if primary pointer is coarse or touch events exist
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouch) return;

    this.touchLayer = document.createElement('div');
    this.touchLayer.className = 'universal-touch-layer';
    this.touchLayer.style.cssText = `
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 15;
      user-select: none;
      -webkit-user-select: none;
    `;

    // Virtual Joystick Base & Thumb
    this.joystickBase = document.createElement('div');
    this.joystickBase.className = 'virtual-joystick-base';
    this.joystickBase.style.cssText = `
      position: absolute;
      left: 36px;
      bottom: max(36px, env(safe-area-inset-bottom));
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.08);
      border: 2px solid rgba(255, 255, 255, 0.25);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
      touch-action: none;
    `;

    this.joystickThumb = document.createElement('div');
    this.joystickThumb.className = 'virtual-joystick-thumb';
    this.joystickThumb.style.cssText = `
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.6);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
      transform: translate(0px, 0px);
      transition: transform 0.05s ease-out;
      pointer-events: none;
    `;
    this.joystickBase.appendChild(this.joystickThumb);
    this.touchLayer.appendChild(this.joystickBase);

    // Touch Action Buttons (Jump, Fart, Hum/Interact)
    const actionCluster = document.createElement('div');
    actionCluster.className = 'touch-action-cluster';
    actionCluster.style.cssText = `
      position: absolute;
      right: max(20px, env(safe-area-inset-right));
      bottom: max(28px, env(safe-area-inset-bottom));
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: auto;
    `;

    actionCluster.innerHTML = `
      <div style="display:flex;gap:12px;justify-content:flex-end">
        <button data-touch-action="hum" class="hud-btn hud-btn-secondary" style="width:58px;height:58px;border-radius:50%;padding:0;min-height:unset;font-size:13px">HUM</button>
        <button data-touch-action="fart" class="hud-btn hud-btn-primary" style="width:68px;height:68px;border-radius:50%;padding:0;min-height:unset;font-size:15px;box-shadow:0 4px 18px rgba(255,99,43,0.5)">FART</button>
      </div>
      <div style="display:flex;justify-content:flex-end">
        <button data-touch-action="jump" class="hud-btn hud-btn-secondary" style="width:64px;height:64px;border-radius:50%;padding:0;min-height:unset;font-size:14px">JUMP</button>
      </div>
    `;
    this.touchLayer.appendChild(actionCluster);
    document.body.appendChild(this.touchLayer);

    // Joystick Touch Listeners
    this.joystickBase.addEventListener('pointerdown', (e) => {
      this.joystickTouchId = e.pointerId;
      this.joystickBase!.setPointerCapture(e.pointerId);
      const rect = this.joystickBase!.getBoundingClientRect();
      this.joystickOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      this.updateJoystick(e.clientX, e.clientY);
    });

    this.joystickBase.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.joystickTouchId) {
        this.updateJoystick(e.clientX, e.clientY);
      }
    });

    const resetJoystick = (e: PointerEvent) => {
      if (e.pointerId === this.joystickTouchId) {
        this.joystickTouchId = null;
        this.touchMove = { x: 0, y: 0 };
        if (this.joystickThumb) this.joystickThumb.style.transform = `translate(0px, 0px)`;
      }
    };
    this.joystickBase.addEventListener('pointerup', resetJoystick);
    this.joystickBase.addEventListener('pointercancel', resetJoystick);

    // Look Drag on Touch Layer
    window.addEventListener('pointerdown', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, input, select, .virtual-joystick-base, .touch-action-cluster, .story-dialogue-card')) return;
      if (this.lookTouchId === null) {
        this.lookTouchId = e.pointerId;
        this.lastLookPos = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.lookTouchId) {
        const dx = e.clientX - this.lastLookPos.x;
        const dy = e.clientY - this.lastLookPos.y;
        this.lastLookPos = { x: e.clientX, y: e.clientY };
        const s = settings.get();
        const sens = s.lookSensitivity * (s.invertY ? -1 : 1);
        this.accumulatedLook.x -= dx * 0.005 * s.lookSensitivity;
        this.accumulatedLook.y += dy * 0.005 * sens;
      }
    });

    const resetLook = (e: PointerEvent) => {
      if (e.pointerId === this.lookTouchId) {
        this.lookTouchId = null;
      }
    };
    window.addEventListener('pointerup', resetLook);
    window.addEventListener('pointercancel', resetLook);

    // Touch Buttons
    const bindTouchBtn = (action: 'jump' | 'fart' | 'hum', selector: string) => {
      const btn = actionCluster.querySelector<HTMLElement>(selector);
      if (!btn) return;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        if (action === 'jump') {
          this.actions.jump = true;
          this.actions.jumpPressed = true;
          this.jumpBufferTimer = 0.12;
        } else if (action === 'fart') {
          this.actions.fart = true;
          this.actions.fartPressed = true;
        } else if (action === 'hum') {
          this.actions.hum = true;
          this.actions.interact = true;
          this.actions.interactPressed = true;
        }
      });
      const release = () => {
        if (action === 'jump') this.actions.jump = false;
        else if (action === 'fart') this.actions.fart = false;
        else if (action === 'hum') {
          this.actions.hum = false;
          this.actions.interact = false;
        }
      };
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
    };

    bindTouchBtn('jump', '[data-touch-action="jump"]');
    bindTouchBtn('fart', '[data-touch-action="fart"]');
    bindTouchBtn('hum', '[data-touch-action="hum"]');
  }

  private updateJoystick(clientX: number, clientY: number) {
    const dx = clientX - this.joystickOrigin.x;
    const dy = clientY - this.joystickOrigin.y;
    const maxRadius = 38;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const clampedDist = Math.min(dist, maxRadius);

    const tx = Math.cos(angle) * clampedDist;
    const ty = Math.sin(angle) * clampedDist;
    if (this.joystickThumb) {
      this.joystickThumb.style.transform = `translate(${tx}px, ${ty}px)`;
    }

    this.touchMove.x = tx / maxRadius;
    this.touchMove.y = ty / maxRadius;
  }

  // ---------------------------------------------------------------- Polling & Gamepad
  public update(dt: number) {
    // Decay jump buffer & coyote time
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    if (this.coyoteTimer > 0) this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);

    // 1. Keyboard vector
    let kx = 0;
    let ky = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) ky -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) ky += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kx += 1;

    let moveX = kx + this.touchMove.x;
    let moveY = ky + this.touchMove.y;

    // 2. Poll Gamepad API
    if (typeof navigator !== 'undefined' && 'getGamepads' in navigator) {
      const pads = navigator.getGamepads();
      for (let i = 0; i < pads.length; i++) {
        const pad = pads[i];
        if (!pad) continue;

        // Left Stick (move)
        const lx = Math.abs(pad.axes[0]) > 0.15 ? pad.axes[0] : 0;
        const ly = Math.abs(pad.axes[1]) > 0.15 ? pad.axes[1] : 0;
        moveX += lx;
        moveY += ly;

        // Right Stick (look)
        const rx = Math.abs(pad.axes[2]) > 0.15 ? pad.axes[2] : 0;
        const ry = Math.abs(pad.axes[3]) > 0.15 ? pad.axes[3] : 0;
        const s = settings.get();
        const sens = s.lookSensitivity * (s.invertY ? -1 : 1);
        this.accumulatedLook.x -= rx * 2.5 * dt * s.lookSensitivity;
        this.accumulatedLook.y += ry * 2.5 * dt * sens;

        // Buttons: A (0) Jump, X (2) or RT (7) Fart, B (1) Interact, Y (3) Hum
        if (pad.buttons[0]?.pressed) {
          this.actions.jump = true;
          this.actions.jumpPressed = true;
          this.jumpBufferTimer = 0.12;
        }
        if (pad.buttons[2]?.pressed || pad.buttons[7]?.pressed) {
          this.actions.fart = true;
          this.actions.fartPressed = true;
        }
        if (pad.buttons[1]?.pressed) {
          this.actions.interact = true;
          this.actions.interactPressed = true;
        }
        if (pad.buttons[3]?.pressed) {
          this.actions.hum = true;
        }
      }
    }

    // Clamp normalized move vector
    const len = Math.hypot(moveX, moveY);
    if (len > 1) {
      moveX /= len;
      moveY /= len;
    }
    this.actions.move.x = moveX;
    this.actions.move.y = moveY;

    // Actions from keyboard
    if (this.keys.has('Space')) {
      this.actions.jump = true;
      if (this.justPressedKeys.has('Space')) {
        this.actions.jumpPressed = true;
        this.jumpBufferTimer = 0.12;
      }
    } else if (!this.touchMove.x && !this.touchMove.y) {
      // If no gamepad/touch button is held, reset
      this.actions.jump = false;
    }

    if (this.keys.has('KeyF')) {
      this.actions.fart = true;
      if (this.justPressedKeys.has('KeyF')) this.actions.fartPressed = true;
    }

    if (this.keys.has('KeyH')) {
      this.actions.hum = true;
    }

    if (this.keys.has('KeyE')) {
      this.actions.interact = true;
      if (this.justPressedKeys.has('KeyE')) this.actions.interactPressed = true;
    }

    // Look delta handover
    this.actions.lookDelta.x = this.accumulatedLook.x;
    this.actions.lookDelta.y = this.accumulatedLook.y;
    this.accumulatedLook = { x: 0, y: 0 };

    // Clear single-frame edges
    this.justPressedKeys.clear();
  }

  /** Triggers progressive rumble on both gamepads and phone vibration actuators */
  public triggerRumble(strength = 1) {
    // 1. Gamepad vibrationActuator
    try {
      if ('getGamepads' in navigator) {
        const pads = navigator.getGamepads();
        for (const pad of pads) {
          if (pad && pad.vibrationActuator && 'playEffect' in pad.vibrationActuator) {
            (pad.vibrationActuator as any).playEffect('dual-rumble', {
              startDelay: 0,
              duration: Math.min(400, 120 + strength * 25),
              weakMagnitude: Math.min(1.0, 0.3 + strength * 0.05),
              strongMagnitude: Math.min(1.0, 0.4 + strength * 0.06)
            });
          }
        }
      }
    } catch {}

    // 2. Mobile navigator.vibrate
    try {
      if ('vibrate' in navigator) {
        if (strength >= 20) navigator.vibrate([100, 50, 180]);
        else if (strength >= 10) navigator.vibrate([50, 30, 80]);
        else navigator.vibrate(24);
      }
    } catch {}
  }
}

export const input = UniversalInput.getInstance();
