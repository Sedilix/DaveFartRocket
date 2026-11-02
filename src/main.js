import './ui/hud.css';
import { GameLoop } from './core/GameLoop';
async function init() {
    const container = document.getElementById('canvas-container');
    if (!container)
        return;
    const game = new GameLoop(container);
    await game.start();
}
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
}
else {
    init();
}
//# sourceMappingURL=main.js.map