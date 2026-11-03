# What If Every Fart Doubled In Strength? (Meet Dave) 🚀💨

An interactive 3D web game inspired by the viral low-poly animation. Built with **Vite**, **TypeScript**, **Three.js**, **@dimforge/rapier3d-compat**, and **Zustand**. Optimized for both mobile portrait (9:16) and desktop viewports.

---

## 🎮 Gameplay & Lore
Meet Dave. He's having a perfectly normal Tuesday walking down a city avenue. Except every fart doubles in strength ($\times 2^n$) and adds $+6\text{ dB}$, starting from an innocuous $54\text{ dB}$ poot up to a catastrophic $198\text{ dB}$ world-shattering shockwave at Fart #25.

- **Farts #1–#8 (54 dB – 96 dB)**: From discreet breezes to sidewalk pigeons scattering and brunch cancellations.
- **Fart #9 (102 dB)**: Dave's feet leave the pavement; car alarms trigger across the avenue.
- **Farts #10–#15 (108 dB – 138 dB)**: Ascending past apartment blocks into supersonic altitude.
- **Farts #16–#18 (144 dB – 156 dB)**: Breaking the cloud deck into the navy stratosphere.
- **Farts #19–#21 (162 dB – 174 dB)**: Leaving the atmosphere; knocking satellites into spins and startling the Moon.
- **Farts #22–#24 (180 dB – 192 dB)**: Tsunami warnings, Earth rippling vertex displacement, and approaching the acoustic limit.
- **Fart #25 (198 dB - Cataclysm)**: The planetary shatter. 55+ tectonic shards tumble into deep space while Dave floats peacefully in the center. *"Dave is fine."*

---

## 🛠️ Tech Stack & Key Features
- **Engine & Renderer**: Three.js with flat-shaded low-poly aesthetics (`flatShading: true`), dynamic directional sunlight, and shadow maps.
- **Physics & Collisions**: `@dimforge/rapier3d-compat` (Wasm) with `KinematicCharacterController` featuring autostep for curbs ($0.38\text{m}$) and obstacle sliding.
- **Procedural Audio Synthesizer**: 100% zero-dependency Web Audio synthesizers:
  - Multi-tier dynamic fart synth (`FartSynth.ts`): from squishy bandpass flutters to sub-bass shockwaves and planetary rumble.
  - Ethereal ambient end-of-game music (`EndGameMusic.ts`): celestial $\text{Cmaj9} \rightarrow \text{Fmaj7}^{\sharp 11} \rightarrow \text{Am9} \rightarrow \text{G6/9}$ ambient pad cycle with twinkling starlight arpeggios.
- **Mobile Safe-Zone UI**:
  - **Top Zone**: Glassmorphism HUD card with decibel meters, acoustic limit tick mark, and live multiplier.
  - **Middle Narrative Zone**: Comic onomatopoeia pops, dB milestone notifications, and serif story subtitles locked strictly above the thumb controls.
  - **Bottom Control Zone**: Virtual steering joystick and radial 4.5-second involuntary countdown `RELEASE` button.

---

## 🌌 The Complete Saga & Entry Modes

The game features both the original viral Street Level and the complete 5-Act narrative sequel and Voxel Sandbox:

| URL Mode | Scene / Title | Description |
| --- | --- | --- |
| `/` | **STREET (Prologue)** | The original 25-fart city street rocket ascent, altimeter gauge, and Earth shatter. |
| `/?mode=menu` | **MAIN MENU** | Act select, cross-act casualties tally, achievements showcase, and settings modal. |
| `/?mode=act1` | **ACT I: S1 Ship** | Aboard the *Whisper*. First contact with the delicate Quell, fragile heirlooms, and Pim's hum. |
| `/?mode=act2` | **ACT II: S2 Nom** | Moon of Nom. Chain fart-boosts across sacred ravines and sound the Great Gust Horn. |
| `/?mode=act3` | **ACT III: S3 Frostbite** | Grand Frostbite Hotel. Out-of-order lift shaft climbing, Chef Glorb's confession, and ignored stairs. |
| `/?mode=act4` | **ACT IV: S4 Desert** | Desert of Silence. Outrun the advancing wall of silence and Elder Sibilance's vault ship. |
| `/?mode=act5` | **ACT V: S5 Source** | The Bean Tree finale. Inverted tension ring: hold your nerve for the silent release. |
| `/?mode=voxel` | **VOXEL (Epilogue)** | Procedural voxel sandbox: day/night cycle, Rebuild Earth blueprint checklist (Deli, Loft, Garden). |

---

## 🕹️ Universal Controls

- **Move / Steer**: Left virtual joystick (touch), `WASD` / Arrow Keys (keyboard), or Left Stick (gamepad).
- **Look**: Touch drag on right screen, Mouse look (pointer lock with drag fallback), or Right Stick (gamepad).
- **Jump / Boost**: `Space` / `A` button / on-screen `JUMP`.
- **Fart / Action**: `F` / `X` or `RT` button / on-screen `FART`.
- **Hum (S1)**: Hold `H` / on-screen `HUM` (Pim hums to sustain the Hush Field).
- **Advance Dialogue**: Click anywhere, `Space`, `Enter`, or gamepad `A`.
- **Pause Menu & Settings**: `Escape` or floating `MENU` pill. Supports volume sliders, look sensitivity, invert Y, graphics tiers, and left-handed layout.

---

## 🧪 Testing & Integrity

Run the automated smoke test suite to verify all chunks, scripts, tokens, and build artifacts:
```bash
npm run smoke
```

---

## 🚀 Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Run local development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Build for production
```bash
npm run build
```
Preview the production build:
```bash
npm run preview
```
