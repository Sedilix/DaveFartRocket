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

## 🕹️ Controls
- **Walk / Steer**: Left virtual joystick (touch) or `W` / `A` / `S` / `D` or Arrow Keys (keyboard).
- **Manual Fart Release**: Tap the circular `RELEASE` button or press `Space` / `Enter`.
- **Music Preview**: Click `🎵 Preview Music` in the HUD or press `M` on the keyboard to toggle the end-game music.

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
