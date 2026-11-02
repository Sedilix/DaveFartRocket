export class InputManager {
    inputState = {
        moveVector: { x: 0, y: 0 },
        releasePressed: false
    };
    keysDown = new Set();
    joystickActive = false;
    joystickTouchId = null;
    joystickOrigin = { x: 0, y: 0 };
    joystickHandle = null;
    joystickBase = null;
    onReleaseCallback = null;
    constructor() {
        this.setupKeyboard();
    }
    setOnRelease(cb) {
        this.onReleaseCallback = cb;
    }
    setupKeyboard() {
        window.addEventListener('keydown', (e) => {
            this.keysDown.add(e.code);
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                if (this.onReleaseCallback) {
                    this.onReleaseCallback();
                }
            }
            this.updateKeyboardVector();
        });
        window.addEventListener('keyup', (e) => {
            this.keysDown.delete(e.code);
            this.updateKeyboardVector();
        });
    }
    updateKeyboardVector() {
        if (this.joystickActive)
            return;
        let x = 0;
        let y = 0;
        if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft'))
            x -= 1;
        if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight'))
            x += 1;
        if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp'))
            y += 1;
        if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown'))
            y -= 1;
        // Normalize diagonal keyboard movement
        const len = Math.sqrt(x * x + y * y);
        if (len > 0) {
            this.inputState.moveVector.x = x / len;
            this.inputState.moveVector.y = y / len;
        }
        else {
            this.inputState.moveVector.x = 0;
            this.inputState.moveVector.y = 0;
        }
    }
    bindJoystickElements(base, handle) {
        this.joystickBase = base;
        this.joystickHandle = handle;
        base.addEventListener('pointerdown', (e) => {
            this.joystickActive = true;
            this.joystickTouchId = e.pointerId;
            const rect = base.getBoundingClientRect();
            this.joystickOrigin = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
            base.setPointerCapture(e.pointerId);
            this.handleJoystickMove(e.clientX, e.clientY);
        });
        base.addEventListener('pointermove', (e) => {
            if (!this.joystickActive || e.pointerId !== this.joystickTouchId)
                return;
            this.handleJoystickMove(e.clientX, e.clientY);
        });
        const endJoystick = (e) => {
            if (e.pointerId === this.joystickTouchId) {
                this.joystickActive = false;
                this.joystickTouchId = null;
                this.inputState.moveVector.x = 0;
                this.inputState.moveVector.y = 0;
                if (this.joystickHandle) {
                    this.joystickHandle.style.transform = `translate(0px, 0px)`;
                }
            }
        };
        base.addEventListener('pointerup', endJoystick);
        base.addEventListener('pointercancel', endJoystick);
    }
    handleJoystickMove(clientX, clientY) {
        const maxRadius = 38; // px
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
    bindReleaseButton(btn) {
        btn.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            if (this.onReleaseCallback) {
                this.onReleaseCallback();
            }
        });
    }
}
//# sourceMappingURL=InputManager.js.map