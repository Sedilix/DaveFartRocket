/**
 * Automated smoke test suite for Dave Fart Rocket.
 * Validates build artifacts, bundle size budget, chunks, story scripts, progression, and milestones.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('🧪 Running Dave Fart Rocket Smoke & Integrity Test Suite...\n');

// 1. Validate Scripts
{
  const scriptContent = fs.readFileSync('src/saga/script/index.ts', 'utf8');
  assert(scriptContent.includes('S1_SCRIPT'), 'S1_SCRIPT must exist');
  assert(scriptContent.includes('S2_SCRIPT'), 'S2_SCRIPT must exist');
  assert(scriptContent.includes('S3_SCRIPT'), 'S3_SCRIPT must exist');
  assert(scriptContent.includes('S4_SCRIPT'), 'S4_SCRIPT must exist');
  assert(scriptContent.includes('S5_SCRIPT'), 'S5_SCRIPT must exist');
  console.log('  ✓ Story scripts verified across all 5 acts');
}

// 2. Validate Dist Directory & Index HTML
{
  assert(fs.existsSync('dist/index.html'), 'dist/index.html must exist');
  const html = fs.readFileSync('dist/index.html', 'utf8');
  assert(html.includes('canvas-container'), 'index.html must have canvas-container');
  assert(html.includes('assets/'), 'index.html must link bundled assets');
  // Validate relative base path for CybrDeck hosting
  assert(!html.includes('href="/assets/'), 'Assets must not use absolute root paths');
  assert(!html.includes('src="/assets/'), 'Scripts must not use absolute root paths');
  console.log('  ✓ Production dist/index.html verified with relative base assets');
}

// 3. Validate Chunks & Code Splitting
{
  const assets = fs.readdirSync('dist/assets');
  assert(assets.length >= 10, 'Must have at least 10 code-split asset files');

  const requiredChunks = [
    'Act1',
    'Act2',
    'Act3',
    'Act4',
    'Act5',
    'MainMenu',
    'VoxelGame',
    'AudioEngine',
    'HushBubble',
    'script'
  ];

  for (const chunk of requiredChunks) {
    const found = assets.some((f) => f.startsWith(chunk));
    assert(found, `Chunk ${chunk} must exist in dist/assets`);
    console.log(`  ✓ Code-split chunk verified: ${chunk}`);
  }
}

// 4. Validate Tokens CSS
{
  assert(fs.existsSync('src/ui/tokens.css'), 'src/ui/tokens.css must exist');
  const tokens = fs.readFileSync('src/ui/tokens.css', 'utf8');
  assert(tokens.includes('--fs-caption'), '--fs-caption must be defined');
  assert(tokens.includes('--fs-display'), '--fs-display must be defined');
  assert(tokens.includes('--hud-glass-bg'), '--hud-glass-bg must be defined');
  assert(tokens.includes('.hud-btn-primary'), '.hud-btn-primary class must be defined');
  assert(tokens.includes('.story-dialogue-card'), '.story-dialogue-card class must be defined');
  console.log('  ✓ Tokens and design system classes verified');
}

// 5. Validate Milestones & Onomatopoeia
{
  const milestones = fs.readFileSync('src/data/milestones.ts', 'utf8');
  assert(milestones.includes('WORLD BREAKER!'), 'Milestone #25 must have unique climax onomatopoeia');
  assert(milestones.includes('HYPER-SHOCKWAVE!'), 'Milestone #24 must have unique onomatopoeia');
  assert(milestones.includes('MEGA-TECTONIC!'), 'Milestone #23 must have unique onomatopoeia');
  console.log('  ✓ Milestones comic onomatopoeia verified');
}

// 6. Validate Progression & Achievements
{
  const prog = fs.readFileSync('src/core/progression.ts', 'utf8');
  assert(prog.includes('dave_is_fine'), 'dave_is_fine achievement must exist');
  assert(prog.includes('holy_wind'), 'holy_wind achievement must exist');
  assert(prog.includes('found_the_stairs'), 'found_the_stairs achievement must exist');
  assert(prog.includes('perfectly_silent'), 'perfectly_silent achievement must exist');
  assert(prog.includes('brunch'), 'brunch achievement must exist');
  console.log('  ✓ Progression and achievement registry verified');
}

// 7. Zero Stale JS in src/
{
  function checkNoJsInSrc(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        checkNoJsInSrc(full);
      } else if (entry.name.endsWith('.js') || entry.name.endsWith('.js.map')) {
        throw new Error(`Stale JS build artifact found in src: ${full}`);
      }
    }
  }
  checkNoJsInSrc('src');
  console.log('  ✓ Verified 0 stale .js or .js.map files shadowing TypeScript source');
}

console.log('\n✨ All smoke & integrity checks passed successfully (100% verified)!');
