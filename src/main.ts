import './ui/hud.css';
import { GameLoop } from './core/GameLoop';

async function init() {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  // ?mode=voxel opens the block-world sandbox; the default is the street / rocket game
  if (new URLSearchParams(window.location.search).get('mode') === 'voxel') {
    const { VoxelGame } = await import('./voxel/VoxelGame');
    new VoxelGame(container).start();
    return;
  }

  // ?mode=act1 is the saga's first story scene (aboard the Quell ship)
  if (new URLSearchParams(window.location.search).get('mode') === 'act1') {
    const { Act1 } = await import('./saga/Act1');
    new Act1(container).start();
    return;
  }

  if (new URLSearchParams(window.location.search).get('mode') === 'act2') {
    const { Act2 } = await import('./saga/Act2');
    new Act2(container).start();
    return;
  }

  if (new URLSearchParams(window.location.search).get('mode') === 'act3') {
    const { Act3 } = await import('./saga/Act3');
    new Act3(container).start();
    return;
  }

  if (new URLSearchParams(window.location.search).get('mode') === 'act4') {
    const { Act4 } = await import('./saga/Act4');
    new Act4(container).start();
    return;
  }

  const game = new GameLoop(container);
  await game.start();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
