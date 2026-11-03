# DAVE FART ROCKET: REFINEMENT BRIEF

**Audience:** Gemini (Antigravity), working directly in this repository.
**Goal:** Take the game from "working prototype" to "polished, coherent product". Every scene should look, sound, feel and read as well as the street level does today.
**Repo:** `D:\DaveFartRocket` (remote: `https://github.com/Sedilix/DaveFartRocket.git`, branch `main`).
**Stack:** TypeScript, Vite 6, Three.js 0.170, Rapier3D (street physics only), zustand (street state). No framework, no external assets: everything is procedural (geometry, textures, audio).

Read this whole document before changing anything. Read `docs/SAGA.md` for the story. Treat both as the source of truth; if you disagree with something, say so in your PR description rather than silently diverging.

---

## 0. Naming (read this first, it is easy to get confused)

The owner and the code use different numbering. This document uses these labels:

| Label here | What it is | Owner's name | Entry URL | Code |
| --- | --- | --- | --- | --- |
| **STREET** | The original game: city street, 25 farts, rocket ascent, Earth explodes, "Dave is fine." | "Act 1", "street level" | `/` | `src/core/GameLoop.ts`, `src/entities/*`, `src/ui/*` |
| **VOXEL** | Minecraft-style sandbox, planned to become the full open world | "the voxel world" | `/?mode=voxel` | `src/voxel/*` |
| **S1 Ship** | Saga scene 1: aboard the Quell ship (first contact) | (saga Act I) | `/?mode=act1` | `src/saga/Act1.ts` |
| **S2 Nom** | Moon of Nom, jungle, Nomads, ravine crossing | (saga Act II) | `/?mode=act2` | `src/saga/Act2.ts`, `jungle.ts` |
| **S3 Frostbite** | Ice moon, hotel, lift shaft climb | (saga Act III) | `/?mode=act3` | `src/saga/Act3.ts`, `ice.ts` |
| **S4 Desert** | The Elder's offer, the Silence chase | (saga Act IV) | `/?mode=act4` | `src/saga/Act4.ts`, `desert.ts` |
| **S5 Source** | Bean Tree finale, inverted tension ring | (saga Act V) | `/?mode=act5` | `src/saga/Act5.ts`, `star.ts` |

When the owner says "make all the Acts match street level", they mean **S1 to S5 (and VOXEL) must reach the visual and UX quality of STREET**. When they say "UI/UX on Act 1 is good", they mean **STREET's HUD is the reference design**.

---

## 1. Current state, honestly

### 1.1 What exists and works
- **STREET** is the most polished part. Procedural city (`ProceduralCity.ts`, seeded per load), traffic that turns onto a cross street at the end, pedestrians with gaze and delayed reactions, a leashed dog and owner, pigeons, 25 escalating farts with synthesised audio (`FartSynth.ts`), a cinematic ending (moon shot, Earth shot, Earth explosion), an end-game music generator (`EndGameMusic.ts`), adaptive quality (`QualityManager.ts`), a polished HUD, and a new **altimeter** (see 1.3).
- **VOXEL** is an engine plus a demo: chunk streaming, noise terrain, per-vertex AO meshing, DDA ray casting, break/place blocks, Dave as the player with AABB collision.
- **S1 to S5** are complete, playable, end-to-end story scenes built on the voxel engine (`VoxelGame` subclasses). Each has dialogue, a mechanic, an end screen and a link to the next scene.

### 1.2 What is weak (this is your job)
1. **S1 to S5 and VOXEL look far below STREET.** They use `MeshBasicMaterial` with baked vertex colours (no lighting, no shadows, flat sky, no post-processing, almost no VFX). STREET uses `MeshStandardMaterial`, ACES tone mapping, shadow maps, hemisphere and sun lighting, fog, particles and animation.
2. **Characters in the saga** (`Quell.ts`) are a box rig with a bob. NPCs in STREET (`NPCCharacter.ts`) have faces with expressions, gaze, walk cycles and reactions. The saga cast does none of that.
3. **Sound and music** exist only for STREET (fart synth + end-game pad). All saga scenes are nearly silent (a single beep).
4. **Controls** in the saga are keyboard-and-mouse only (pointer lock). STREET supports touch (virtual joystick + RELEASE). Saga scenes are unplayable on a phone.
5. **UI is inconsistent.** STREET HUD is CSS-driven and good. Saga UI is inline-styled strings scattered through TypeScript (`StoryUi.ts`, `Act1.ts`, `VoxelGame.ts`, `Act5.ts`), with ad-hoc font sizes and families.
6. **No persistence, no progression**: no save, no act select, no settings menu.
7. **Story needs a polish pass**: jokes are good but unevenly spread, pacing varies, several set pieces are told rather than shown.
8. About **50 low and medium issues** remain from an earlier QA pass (section 11).

### 1.3 Already done this session (do not redo)
- **Altimeter on STREET** (`HudController.updateAltitude`, `#hud-altimeter`, CSS block at the end of `src/ui/hud.css`, called from `GameLoop.frame`). Log-scale gauge, right edge, fades in when Dave leaves the ground, ticks at 100 m, 1 km and 10 km. Your job is only to *refine* it (section 8.6).

- **RELEASE button is now a butt** (two cheeks, "UU", with green gas puffing out of the crack; bigger burst on press). Markup: `#release-btn` in `HudController.getTemplate` (three `.gas` spans), styles at the end of `src/ui/hud.css`. Keep this identity when you restyle the HUD; refine the art (shading, a subtle jiggle on press, urgent-state puff rate) but do not revert it to a circle. Make sure the `RELEASE`/`WAIT` label stays readable and that the cooldown state is clear.

---

## 2. Ground rules

### 2.1 Hard constraints
- **Do not break URLs.** `/`, `?mode=voxel`, `?mode=act1` to `?mode=act5` must keep working. You may add modes (e.g. `?mode=menu`).
- **No external assets by default.** The project is zero-asset: all geometry, textures and audio are generated. Keep it that way unless a section below explicitly allows otherwise. If you believe an asset (font file, texture) is necessary, propose it in the PR notes with size and licence, and make it optional with a procedural fallback.
- **Performance budgets.** Target 60 fps on a mid-range phone for STREET and every saga scene. `QualityManager` already exposes low/medium/high tiers: extend it to the saga scenes (section 3.6). Keep draw calls under ~400 per frame and avoid per-frame allocations in hot loops.
- **Build must pass:** `npm run build` (runs `tsc` then `vite build`). TypeScript is `strict`; there is `noUnusedLocals`.
- **Stale `.js` files:** `tsc` emits `.js` and `.js.map` next to the `.ts` files in `src/`. Vite resolves `.js` before `.ts`, so stale files shadow edits in the dev server. **Fix this first:** add `"noEmit": true` to `tsconfig.json`, delete every `src/**/*.js` and `src/**/*.js.map`, and add them to `.gitignore`. Verify the dev server still loads.
- **Do not rewrite working systems wholesale.** STREET physics (Rapier), the traffic path logic, the street ending cinematic and `ProceduralCity` are tuned. Extend them; do not replace them.
- **Commit hygiene:** small focused commits, conventional prefixes (`feat:`, `fix:`, `refactor:`, `style:`, `docs:`). End commit messages with the standard co-author line used in the repo history.

### 2.2 Known testing quirk
The preview/browser pane often stops running `requestAnimationFrame` when it is not displayed, so a game can look frozen to an automated check. Every saga scene exposes a debug handle for testing without a render loop: `window.__act2`, `__act3`, `__act4`, `__act5` (Act1 does not yet; add `__act1`). They expose `pos`, `state`, `frame(timestamp)`, `ui`, etc. You can drive the game with synthetic frames: `g.frame(t += 16.7)`. Note `ui.advance()` has a 280 ms real-time debounce; set `g.ui.lastAdvance = 0` before calling it in tests. Keep these hooks, and add a small smoke-test script (section 12).

### 2.3 Definition of done (applies to every task)
1. `npm run build` passes with zero errors.
2. Verified in a real browser at **desktop (1280x720)** and **phone portrait (390x844)**, with no console errors.
3. No regression in STREET (play a full run to Fart #25 and the ending screen).
4. 60 fps check on `medium` quality.
5. The change is described in the PR/commit notes, including anything you chose not to do.

---

## 3. Visual parity: bring S1 to S5 and VOXEL up to STREET quality

STREET's look is the benchmark. Study `GameLoop.buildLighting`, `Atmosphere.ts`, `ProceduralCity.ts` and `Dave.ts` before starting.

### 3.1 The root problem: unlit voxels
`VoxelWorld` uses `MeshBasicMaterial({ vertexColors: true })` with colour baked at meshing time (`src/voxel/mesher.ts`: face shade x AO x per-block tint). Nothing responds to light.

**Do:**
- Switch chunk materials to a lit material (`MeshLambertMaterial` or a light custom shader) so the sun, hemisphere light, shadows and fog all apply. Keep the baked AO (it already reads well) but remove the baked directional face shade from the vertex colour once real lighting exists, otherwise faces are shaded twice.
- Add a **directional sun with soft shadows** to voxel scenes (follow the player with a shadow frustum like `GameLoop` does; reuse the `QualityManager` shadow settings).
- Add a **hemisphere light** (sky/ground tint per scene).
- Add **ACES filmic tone mapping** and matching exposure (STREET uses `ACESFilmicToneMapping`, exposure about 1.05).
- Make **emissive blocks** real: `GLOW`, `TORCH`, `BEAN`, `SHROOM` must look lit. Options: a second emissive vertex attribute and a shader tweak, or a separate emissive mesh per chunk. Add a lightweight **bloom** (half-resolution, only above a luminance threshold) as an optional quality tier.
- Add **block texture variation**: a small procedural canvas atlas (16x16 per block, generated at startup with seeded noise: grass blades, stone speckle, wood grain, sand ripples, brick mortar, ice cracks, planks seams). Keep the chunky look; do not go photoreal. Fall back to vertex colour if the atlas fails.
- Add **water**: translucent animated surface (vertex wave, subtle fresnel tint, foam at shorelines). The present water is a flat translucent quad.
- Add **foliage sway** for leaves and a **wind uniform** (very subtle) shared by all scenes.

### 3.2 Sky, atmosphere and light per scene
Every scene currently sets a single flat `scene.background`. Replace with a proper environment:
- A **procedural sky dome** (gradient + sun disc + soft clouds) that can be re-tinted per scene. STREET's `Atmosphere.getSkyColorInto` is the model for altitude-based colour.
- **Fog** tuned per scene (already partially present). Use `FogExp2` and tune density and colour per biome.
- A shared **time-of-day** system (even if each scene fixes it): sun direction, sky colours, hemisphere tint, star visibility. This is also the foundation for VOXEL day/night.
- **Stars** (S1, S5 already add a point cloud with fixed pixel size). Add twinkle, colour variety, a few larger "bright" stars, and a subtle Milky Way band.

### 3.3 Characters: the saga cast must match the street NPCs
`Quell.ts` is a 20-line box puppet. `NPCCharacter.ts` is the quality bar (faces, expressions, gaze, delayed reactions, walk cycle, ragdoll).
- Build a shared **character rig** (`src/characters/`), refactoring `NPCCharacter` so it can express Quell, Nomads, Glorb, Elder, Captain and Pim. Keep one animation system.
- Give each species a **distinct silhouette and palette**:
  - **Quell:** soft, pear-shaped body, oversized head, huge glossy eyes with highlights, tiny mouth, antenna with glowing tip (the tip's glow should react to emotion).
  - **Nomads:** broad, feathered headdresses, face paint, bone jewellery, drums.
  - **Pim:** smallest, expressive ears or antenna, scarf (Act III), leaf hat (Act II), rides on Dave's shoulder, **has to emote** (fear, determination, relief).
  - **Captain Murmur:** hat, medal, faints properly (animated collapse, one antenna twitching).
  - **Elder Sibilance:** tall, regal, hooded, a still, unnerving idle.
  - **Chef Glorb:** chef hat, apron, nervous hand-wringing idle.
  - **Big Toot:** huge, booming gestures, headdress with a physics sway.
- Reuse the **expression system**: eyebrows, eyes, mouth shapes (neutral, worried, delighted, horrified, deadpan). Drive them from dialogue lines (add an optional `mood` to `Line` in `StoryUi.ts`).
- **Gaze and head tracking** like STREET: look at Dave, at the speaker, at each other.
- **Walk cycles, idle variations, gestures** during dialogue (nod, point, shrug), and a **crowd system** for Nomad crowds and the Quell fleet (cheer, dance, panic) using instancing where possible.
- **Dave in voxel scenes:** he plays the generic walk/idle only. Add a **jump pose**, a **fart-boost pose** (leaning, arms back), a **swim** animation, a **landing squash**, and expressions that match the moment (smug, panicked, apologetic). Reuse STREET's shock/horror faces.

### 3.4 VFX parity
STREET has gas puffs, camera shake, FOV kick, whiteout flash, shards, strobing lights. Saga scenes have a blue bubble and a few gas puffs.
Add (all procedural, budgeted by quality tier):
- **Fart VFX family per context:** muffled "inside the Hush Field" version (green puffs trapped in the bubble, ripples on the shell), full-power outdoor version, tiny polite version (post-reset, Act V), and the silent version (a slow shimmer ring).
- **Hush Field**: replace the plain translucent sphere with a shader (fresnel rim, hex or ripple pattern, impact ripples at the fart origin, red flicker when low).
- **Boost trail**: speed lines, dust kick on landing, ground shock ring, camera FOV kick per chain level.
- **Ambient particles per scene:** ship (floating dust motes, status lights), jungle (fireflies, pollen, falling leaves, mist), ice (blowing snow, breath puffs, aurora), desert (heat shimmer, blowing sand, sandstorm wall), star (embers, drifting ash, the tree's glowing spores).
- **The Silence (S4):** a convincing advancing wall: desaturating colour grade, muffled audio (low-pass), chromatic edge, particles being "erased". Right now it is a pale translucent box.
- **Ritual ring (S5):** polish the DOM ring; add world-space feedback: the tree's beans pulse with the ring, the sky darkens as tension builds, a golden shaft of light in the green window.
- **Screen-space effects:** subtle vignette, film grain toggle, colour grading per scene, damage/impact flash that is not seizure-risky (see accessibility 8.5).
- **Shatter/impact** for the Earth already exists in STREET; reuse the shard system for destroyed scenery in saga scenes (the avalanche on the greenhouse, the broken bridge).

### 3.5 Per-scene visual specs

**S1 Ship.** Currently white hull blocks with pink carpet.
- Make it feel *alien and cosy*: soft emissive trim along walls, rounded-feeling details (use stair/slab shapes if you add them to the engine), cushion piles, hanging glow lamps, a large window with a living starfield and a slowly rotating planet.
- Fragile heirlooms (Vase of Quiet, Whisper Harp, Sacred Pillow) need **identity**: a plinth, a spotlight, tiny labels, and an animated shatter when the Hush field fails.
- Cutscene staging: a proper camera (dolly, cut to Pim's face, reaction shots), not a fixed orbit.

**S2 Moon of Nom (jungle).**
- Dense canopy with light shafts, layered fog, vines, giant ferns, mushroom clusters, bean plants, flowing streams, bird/insect ambience with matching visuals.
- Village: huts with interior detail (hammocks, pots, drums), cook fires with flicker light and smoke, bunting, totems with carved faces (use the atlas), a proper festival set (banners, drum circle, torches).
- The ravine: make it dramatic (mist at the bottom, rock strata, hanging bridge remnants that visibly rebuild at the end, a glowing river or mist rather than flat water).
- Plaza: the Gust Horn should be **a real instrument** with a bell-shaped mouth, carvings and a visible wind-chime array.

**S3 Frostbite Hotel (ice).**
- Real ice: translucent, refractive-looking blocks (two-sided, subtle tint, specular), glittering snow (sparkle shader), aurora in the sky, drifting snowfall with depth layers, breath vapour on Dave and the NPCs.
- Hotel: grand lobby (chandelier, reception bell, luggage trolley, a plant that is clearly dying), corridors, rooms with open doors, a **visible, abandoned lift** with the OUT OF ORDER sign, stairs that are subtly visible but ignored (the running gag).
- The lift shaft climb: add depth cues (lights spiralling up, a visible cable, graffiti per floor, floor numbers), and a satisfying camera for vertical play (camera should look up and not clip into the shaft walls).
- Observatory: a large telescope with a lens flare, a star map hologram, the vault ship visible through the glass as an ominous silhouette.

**S4 Desert (the Silence).**
- Layered dunes with wind ripples (texture + animated sand streaks), strata cliffs, ruins with carvings, dead trees, bones, a sundial, heat haze.
- The Elder's arena: a quiet amphitheatre, a ring of standing stones, banners, an unnaturally still atmosphere (dust frozen mid-air).
- The vault ship: a large, white, eerily smooth shape with a downward beam; it must *loom* (parallax, cast a moving shadow on the dunes).
- The oasis arch: a warm beacon (palm trees, glowing pool, birds).

**S5 The Source.**
- A dead star's crust: cracked basalt with faint orange fissures, dark sky filled with stars and nebula bands, drifting ash.
- The Bean Tree must be **breathtaking**: a gnarled vast trunk, glowing veins, hanging beans like lanterns, falling petals/spores, a visible heartbeat pulse that syncs with the ring, a gentle god-ray.
- The finale crowd (the Quell fleet): ships in the sky with running lights, applauding Quell, confetti (silent confetti, which is the joke).

**VOXEL.** Biomes (plains, forest, desert, snow, mountains, ocean, jungle, swamp), caves, ores, rivers, lakes, villages, ruins, day/night, weather (rain, snow), clouds. Biome blending. Make the existing `?mode=voxel` the proper foundation of the Epilogue ("Rebuild Earth").

### 3.6 Quality tiers and performance for the voxel scenes
- Extend `QualityManager` so voxel scenes read it: chunk radius, shadow size, bloom on/off, particle counts, DPR.
- Mesh worker: move `meshChunk` into a Web Worker (transfer arrays) to avoid hitches. Keep the main-thread fallback.
- Frustum culling per chunk, optional greedy meshing for flat areas, instanced mesh for repeated decor (torches, flowers).
- Persist chunk edits (IndexedDB) for VOXEL.

---

## 4. Storyline refinement

Source: `docs/SAGA.md`. The structure is sound; this pass is about **making it land**.

### 4.1 What to do
1. **Script pass on every scene.** Read all dialogue (it lives in `runIntro`, `beginPlay`, `finish`, etc. inside each Act file). Tighten jokes, remove repeated beats, fix pacing. Keep the tone rules in SAGA.md: deadpan narrator, "Dave is fine", nobody says the word, escalate scale not jokes, warm underneath.
2. **Extract the script into data.** Move all lines into `src/saga/script/*.ts` (or JSON) keyed by scene and beat id, so writers can edit without touching game code, and so localisation is possible. `Line` gains `id`, `mood`, optional `sfx`, optional `camera`.
3. **A proper bridge from STREET to S1.** Currently STREET ends on "Dave is fine." plus a "Continue the saga" button. Add a short rescue cutscene (the *Whisper* arrives in the debris, Dave floats, Pim's first appearance) before S1's airlock.
4. **Recurring-gag payoffs.** Track and pay off: the casualty counter (it should *carry across scenes* and change names: Cushions, Vases, Huts, Greenhouses, Dunes, Stars), the dog from the street (rescued on the ship, appears in every scene; give it a gag), the pigeon (in the last shot of every act), the toast, the narrator's slow exasperation, and Pim's arc.
5. **Pim's emotional arc.** Fear, grudging duty, loyalty, bravery, belonging. One beat per scene that moves it. S4's speech must be funny *and* earned.
6. **Antagonist clarity.** The Elder is the opposition; make her reasoning sympathetic, give her one memorable line per scene, and resolve her properly (S5 applause is not enough; give her a quiet change of heart earlier, e.g. a note left for Dave in S4's finale).
7. **Show, don't tell.** Several explanations (the bean, the doubling rule) are dumped in dialogue. Turn at least two into visible set pieces (e.g. a Quell hologram demonstrating the doubling with cushions on the ship, a Nomad ritual showing the doubling with drums).
8. **Add optional content** to deepen the world without blocking the path: collectible lore (Doubling Bean facts), bonus gags in each scene (talk to every NPC), side interactions (Pim reacts to touching things), hidden secrets (the stairs in S3).
9. **Stakes and structure.** Add a mid-saga reversal: a point where the Hush Field *fails* and Dave must run without it (S4 is a good place), and a quiet beat after S4 where the cost lands before the finale.
10. **Endings.** After S5, offer: *Epilogue: Brunch* (rebuild Earth in VOXEL), credits (funny), and a post-credits stinger with Glorb and a bean.
11. **Credits and meta humour.** A credits sequence that keeps the narrator's voice.

### 4.2 Story deliverables
- `docs/SAGA.md` updated (do not discard what is there; revise it).
- A **scene-by-scene beat sheet** (what the player does, sees, hears, learns).
- A **character bible** (voice, quirks, 5 sample lines each).
- A **joke ledger** (every gag, where it is set up and paid off).
- Final script in `src/saga/script/`.

---

## 5. Controls

### 5.1 Current state
- STREET: `InputManager.ts` (WASD / arrows / virtual joystick, RELEASE button, `Space`). Touch works.
- Saga and VOXEL: `VoxelGame.ts` handles input itself (WASD, Space, mouse look via pointer lock, `1-9` hotbar). Story actions use `F` (boosts), `H` (hum, S1), `Space/Enter/E` and clicks (dialogue). **No touch, no gamepad, no remapping.**

### 5.2 Do
1. **One shared input layer** used by STREET and every saga scene (`src/input/`): actions (`move`, `look`, `jump`, `fart`, `interact`, `advanceDialogue`, `hum`, `pause`) mapped to devices.
2. **Touch:** virtual joystick (left), look drag (right half of the screen), on-screen buttons (`JUMP`, `FART`, `HUM`, `INTERACT`) laid out safely for thumbs and notches. Reuse the STREET joystick visual language.
3. **Gamepad** (Gamepad API): sticks, `A` jump, `X`/`RT` fart, `B` interact. Rumble on farts (`navigator.vibrate` on mobile, `vibrationActuator` on pads) tied to the fart strength.
4. **Keyboard + mouse:** keep current bindings, add `Esc` pause, `M` mute, `C` camera toggle, `Tab` hints. Pointer lock must degrade gracefully: if it fails (iframes, embedded previews; this is a known console error: "root document of this element is not valid for pointer lock"), fall back to drag-to-look.
5. **Remapping and settings panel** (`src/ui/Settings.ts`): key bindings, look sensitivity, invert Y, FOV, quality tier, volume sliders, reduce motion, subtitles size, left-handed layout. Persist in `localStorage`.
6. **Camera.** Add camera collision, smoothed follow, a look-ahead, sensible dialogue cameras. Prevent the camera clipping through walls in the lift shaft and the ship.
7. **Dialogue advance** must work with any input, show a clear prompt icon per device, and support **hold-to-skip** for replays and a **log** of past lines.
8. **Movement feel:** coyote time, jump buffering, variable jump height, step-up smoothing, sprint, better swim, ledge forgiveness. Fart-boost feel: charge indicator, directional control, clear chain feedback (flash + pitch rise), a short slow-motion on a chain of 3.
9. **Make fart-boost forgiving.** The jungle crossing currently requires a 3-chain per leg; tune with playtest data, and add an assist option.

---

## 6. Sound and music (per scene)

### 6.1 Current state
- `FartSynth.ts` (518 lines): procedural fart per milestone, tiers 1 to 4, plus `playBeep(freq, dur, vol)` used for honks, alarms and saga "muffled" farts.
- `EndGameMusic.ts` (309 lines): the "Dave is fine." celestial pad with delay and arpeggios.
- Saga scenes: essentially silent.

### 6.2 Build an audio engine
Create `src/audio/` modules:
- `AudioEngine` (one `AudioContext`, master/music/sfx/ambience/voice buses with compressors and a global low-pass for the **Hush Field** effect and the **Silence**), unlock on first gesture (already handled in `FartSynth`; centralise it).
- `MusicDirector`: per-scene themes, stems that fade in and out with game state, stingers for story beats, a ducking system under dialogue.
- `Ambience`: looping noise-based beds per scene.
- `Foley`: footsteps by surface (grass, stone, snow, sand, planks, carpet), jumps, landings, UI clicks, dialogue "voice blips" per character (each character gets a distinct procedural blip pitch and rhythm, like a talking-sound effect).
- `Spatial`: positional audio for world sources (fires, drums, waterfalls) using `PannerNode`.
- Everything procedural. No audio files.

### 6.3 Music brief per scene
Design each theme as a loop with 2 to 3 layers that react to play. All are procedural; reuse the scheduling approach in `EndGameMusic`.

| Scene | Mood | Instruments (synthesised) | Tempo / key | Notes |
| --- | --- | --- | --- | --- |
| **STREET** | Sunny, oblivious, slightly bouncy; escalates to panic and awe | Plucked bass, light percussion (brush, wood block), pizzicato strings; as farts rise add brass stabs, then choir pad | 108 bpm, C major to modal shift per tier | Music should *get louder as the farts do*, then **collapse to near-silence at the Earth explosion**, then the existing end pad. Keep the horn/alarm SFX audible over it |
| **S1 Ship** | Hushed, soft, comic tension | Felt-piano, breathy pad, ticking clock-like pulses, muffled sub for the Hush Field | 70 bpm, D minor, mostly whole notes | The music itself should be *quiet*; punish loudness. When the Hush meter drops, the music loses layers; humming (H) adds a warm choir layer |
| **S2 Nom** | Joyful, tribal, absurd | Hand drums, log drums, marimba, shakers, wooden flute, call-and-response chants (formant synth), a "tuba" for the fart-adjacent comedy | 128 bpm, A mixolydian | Crowd shouts sync to boosts. Drums speed up with chain level. Festival has a full processional theme |
| **S3 Frostbite** | Lonely, eerie, cosy-in-the-cold, comedic | Celesta, glass harmonica, sleigh bells, a faint lounge-jazz piano in the hotel (broken, off-key), wind pad | 84 bpm, F# minor; hotel lobby in a faux-elegant C | The hotel plays *elevator music that is clearly broken*. Lift climb: rising ostinato that climbs with the player |
| **S4 Desert** | Vast, tense, deadpan menace; chase | Frame drum, oud-like plucks, sub bass, bowed metal, a single sustained "silence" tone that rises as the wall gets close; **music gets quieter as the Silence approaches** | 96 bpm to 140 bpm chase, D phrygian | The chase should feel like sound being *removed*; layers drop out, the final layer is nothing |
| **S5 Source** | Awe, patience, a held breath, release | Sparse piano, long strings, a heartbeat kick synced to the ring, bell tones, silence | 60 bpm, E lydian | During the ritual, the soundscape thins to a heartbeat. The silent fart gets *a held silence*, then the music blooms into the end theme |
| **Epilogue / VOXEL** | Warm, creative, a bit nostalgic | Soft acoustic-style pads and plucks, gentle arpeggios, day/night variants | 90 bpm, G major | Calm building soundtrack; each biome has a subtle variation |
| **Credits** | Triumphant parody | Full-band parody of every theme | n/a | Reprise the motif of each act |

**Recurring motifs:** give Dave a 4-note theme, Pim a tiny whispered 3-note theme, the Quell a hush-chord, and the Silence a single sustained tone. Use them as leitmotifs in every scene.

### 6.4 SFX list (non-exhaustive, all procedural)
Fart set (muffled, full, tiny, silent-shimmer, loud failure in S5), Hush Field (activate, absorb, strain, fail), boost whoosh and chain pitch rise, jump, land (per surface), swim, footsteps per surface, block break/place per material, UI (hover, click, confirm, back), dialogue blips per speaker, door and lift, crowd cheers and gasps (formant noise), drums, fire crackle, wind, rain, snow crunch, sand hiss, vault ship hum, silence-wall drone, the telescope, the bean falling, applause, pigeon coos and wing flaps, dog barks and whimpers, car honks and alarms (exist), tyre squeal, thunder and ice cracks, UI toast.

### 6.5 Mix and accessibility
Loudness targets (music about -18 LUFS, SFX about -14, dialogue blips about -16), ducking under dialogue, a **muffled mode** whenever the Hush Field is active, volume sliders (master/music/sfx/ambience), mute, "reduce loud sounds" accessibility option, **closed-caption style text for sound events** ("*muffled rumble*"), and a `prefers-reduced-motion`/`prefers-reduced-data` aware default. Do not autoplay before the first gesture.

There is also a dev-only "Preview Music" button in the STREET HUD (`SHOW_MUSIC_PREVIEW = import.meta.env.DEV` in `HudController.ts`). Keep it for dev builds; extend it to a music test page listing every theme.

---

## 7. Game design

### 7.1 Systems to add
1. **Menu and act select** (`?mode=menu`, and the default entry): New Game, Continue, Act Select (unlocks as acts are completed), Sandbox, Settings, Credits. Match the STREET HUD's visual language.
2. **Save/load:** `localStorage` for progress (act unlocked, best stats, settings, casualty counter) and IndexedDB for VOXEL edits.
3. **Scoring and stats:** per-scene stats already appear on end screens (farts, falls, casualties). Persist them; add a "chaos score", per-scene best times, and **achievements** (e.g. "Dave Is Fine" (finish with 0 casualties), "Found the Stairs", "Pigeon Whisperer", "Perfectly Silent" (first-try S5), "Gust Master" (chain x8 in S2), "The Reasonable Answer" (don't run in S4... stand still in the Silence for a joke ending), "Brunch").
4. **Difficulty and assists:** forgiving defaults with optional challenge: Hush meter drain rate, chase speed, boost chain window, fall penalties; an "assist mode" toggle for platforming.
5. **Tutorials:** teach mechanics by play, not text banners: first boost in S2 in a safe space, first chain in a gentle gap, etc. Add a single reusable "hint" system (shows after N seconds of struggling).
6. **Fail states and checkpoints:** consistent, funny, fast. S1 (Hush meter) retries from the door; S2 (water) from the last edge; S3 has no fall penalty; S4 resets to a checkpoint. Add visible checkpoint markers.
7. **Pacing audit.** Time each scene (target 4 to 8 minutes each; total saga about 35 to 45 minutes). Remove dead air, add variety. Each scene needs one *new* verb, one *set piece*, one *joke that surprises*.
8. **Verb expansion** (keep the single-button spirit): context interactions with `E` (talk, open, pick up); light puzzles (S1: route around fragile objects, S3: lift shaft timing, S4: shortcuts, S2: build a bridge from a chain of boosts or by placing blocks).
9. **Voxel tie-in:** S2 and S3 should let the player *break and place a few blocks* to solve something. The Epilogue's Rebuild Earth needs goals: a Quell build blueprint, an NPC who asks for specific things (a café, a street, a pigeon coop).
10. **Replayability:** randomised minor details per run, speedrun timer option, challenge modes (no-chain, silent run), New Game+ with the modified Hush Field.
11. **STREET design pass:** the first 8 farts are mostly watching; add *player agency* (a few interactions before the rocket phase: wave to NPCs, pet the dog, scare a pigeon). Keep the 4.5 s tension timer.
12. **Telemetry-free playtest harness:** a debug overlay (`?debug=1`) showing fps, state, position, chunk count, current quality tier, seed.

### 7.2 Balancing numbers (starting points; tune with playtests)
- Fart boost (S2): horizontal `6 x 2^chain` m/s (cap 24), vertical `7.5 + 2.2 x chain` m/s, chain window 2.5 s, cooldown 0.45 s. Crossing the gulch needs three chained boosts per leg.
- Fart jump (S3): vertical `9 + 2.8 x chain`, sideways nudge `0.8 x 2^chain`. Lift ledges are 2 blocks apart; chain 1 clears one ledge.
- Hush meter (S1): costs 14, 28, 56, 112 per event (doubling), one event every 3 s, humming refills 16 per second.
- Silence wall (S4): starts 22 m behind, speed 3.8 rising to 4.6 m/s; Dave walks 5.2 m/s.
- Ritual ring (S5): 7 s fill, green window at 84% to 95%.

---

## 8. UI / UX

**STREET is the reference.** Its HUD (`src/ui/HudController.ts`, `src/ui/hud.css`) is good: dark glass card, clear hierarchy, readable on a phone, safe-area aware, consistent. Everything else must match it.

### 8.1 Font and type standardisation (explicit requirement)
Right now the code mixes:
- **Families:** `Georgia, serif` (narrative), `system-ui, sans-serif` (UI), `-apple-system, BlinkMacSystemFont, ...` (STREET HUD), a `monospace` for debug.
- **Sizes (px, counted in source):** 8, 9, 10, 11 (x12), 12 (x7), 13 (x10), 14 (x8), 15, 16, 17, 18, 19, 20, 22, 24, 26, 36, 48, plus `clamp()` values on end screens. There is no scale.

**Do:**
1. **Define type tokens as CSS custom properties** in one file (`src/ui/tokens.css`) and use them everywhere (CSS **and** the inline-style strings in TypeScript; those must be moved to CSS classes, see 8.2).
2. **Two font families only:**
   - `--font-ui`: the STREET HUD system stack (for numerals, labels, buttons).
   - `--font-story`: Georgia/serif stack (narrator and dialogue, titles, popups).
   Optionally bundle one display face if you add a font (see 2.1); otherwise stay on system stacks.
3. **One modular type scale** (suggested, tune against the STREET HUD):

   | Token | Size (mobile / desktop) | Use |
   | --- | --- | --- |
   | `--fs-caption` | 11 / 12 px | tiny labels, tick marks, key hints (**never below 11 px**) |
   | `--fs-label` | 12 / 13 px | HUD labels, button text, speaker names |
   | `--fs-body` | 15 / 17 px | dialogue body, objective text |
   | `--fs-body-lg` | 17 / 19 px | narrator and emphasised dialogue |
   | `--fs-title-s` | 20 / 24 px | popups, section titles |
   | `--fs-title` | 28 / 36 px | act titles, end screen headings |
   | `--fs-display` | 40 / 56 px | onomatopoeia, big moments |
   | `--fs-numeric` | 22 / 26 px | HUD numbers (fart multiplier, dB, altitude) |

   Weights: 400 body, 600 emphasis, 800 numerals and labels. Line heights: 1.2 for display, 1.4 for body. Letter spacing: tracking 0.08 to 0.14 em on uppercase labels only.
4. **Responsive scaling** with `clamp()` between the mobile and desktop value, driven by the viewport and the user's text-size setting (section 8.5).
5. **Audit every text element** (STREET HUD, onomatopoeia, popups, tension ring label, altimeter, `StoryUi`, Act1 UI, voxel HUD, hotbar, end screens, hints, debug) and map it to a token. Remove ad-hoc `font:` shorthands from TypeScript strings.
6. **Numerals:** use `font-variant-numeric: tabular-nums` for all counters (dB, multiplier, altitude, stats).
7. **Overflow rules:** no text truncation on 320 px wide screens; long milestone popups wrap; dialogue boxes scroll internally rather than growing past the viewport.

### 8.2 Componentise the UI
- Replace the inline-styled HTML strings in `StoryUi.ts`, `Act1.ts` (`buildUi`), `VoxelGame.ts` (`buildHud`), and `Act5.ts` (ring) with **CSS classes** in a shared stylesheet, matching the STREET glass-card look (`.hud-glass-card` background, border, radius, blur, shadow).
- Create reusable components: `DialogueBox`, `ObjectiveBanner`, `Popup` (muted pop, shout, whisper variants), `EndScreen`, `Button` (primary, secondary, ghost), `Meter` (Hush meter, tension ring, altimeter share a base), `Hotbar`, `Toast`.
- Remove per-scene duplicated DOM code. Act1's UI should use the shared `StoryUi`.
- Standardise **z-index layers** (HUD 10, overlays 20, modals 30, toasts 40) and pointer-events rules.

### 8.3 Visual language (match STREET)
- Dark glass panels (`rgba(28,34,48,0.88)`, 1.5 px light border, 16 px radius, blur), white text, accent colours from the dB ramp (green, amber, red).
- Consistent button style (the STREET "RELEASE" and "PLAY AGAIN" family): pill buttons with clear hover/pressed/disabled states and 44 px minimum touch targets.
- Consistent motion: 150 to 400 ms ease-out transitions, no jarring pops. Respect `prefers-reduced-motion`.
- **Iconography:** small inline SVG icons (mute, settings, pause, keyboard/gamepad/touch prompts); no emoji in UI.

### 8.4 Dialogue UX
- Speaker portrait or animated face chip next to the name, per-speaker colour from tokens.
- Typewriter reveal with skip-on-input; punctuation pauses; voice blips (section 6).
- Different treatments: **whisper** (small, italic, dimmer, shaking slightly), **shout** (large, heavy, camera nudge), **narrator** (italic, centred, tinted). These exist in `StoryUi` as ad-hoc styles; formalise them.
- Dialogue log (`L`), auto-advance option, hold-to-skip, clear "press X" prompt per input device.
- Never cover the player or the important thing: bottom placement with safe-area padding; on landscape phones use a compact variant.

### 8.5 Accessibility
- **Text size** setting (80 to 140%); **minimum 11 px** anywhere.
- **Contrast:** meet WCAG AA for text on glass panels (verify against bright scenes like ice and desert; add a darker panel variant if needed).
- **Reduce motion:** disable camera shake, FOV kick, flashes and parallax; keep a gentle fade.
- **Photosensitivity:** the Earth-explosion whiteout and strobing car lights must not exceed 3 flashes per second; offer "reduce flashing".
- **Captions for sound events** and music cues; **subtitles for voice blips** are already the dialogue text.
- **Colour-blind safe** palettes for the ring (green window must also be indicated by shape or label, not colour alone; the label already changes "NOW. GENTLY.").
- Keyboard-navigable menus, `aria-*` on dialogs, `role="dialog"` modal focus handling (the STREET end screen already does some of this), screen-reader friendly end screens.
- **Safe areas** (`env(safe-area-inset-*)`) on all fixed UI.

### 8.6 Altimeter refinement (STREET)
Already added; extend it:
- Show it **always from Fart #9** (not only above 1.5 m) so the player expects it, and animate to its first reading.
- Add **context labels along the track** (clouds 250 m to 1.4 km, "stratosphere", "orbit", the moon at 7.2 km, "space") with an icon, and a pointer chip that rides the fill with the current reading.
- Add **vertical speed** (m/s or km/s) and a **peak marker** for the best altitude this run.
- Format: metres below 10 km, then km with one decimal, then "x,xxx km" with grouping; keep `tabular-nums` and the new type tokens.
- During the cinematic ending, fade it out cleanly (a `.cinematic` class hook exists in CSS).
- Optional: reuse the altimeter in S3 (lift shaft height) and the Epilogue.

### 8.7 Other UI/UX fixes
- RELEASE button looks ready while taps are rejected during cooldown (earlier QA finding): show a clear "armed" state and the real cooldown, not 900 ms.
- Saga end screens: consistent layout, add "Next scene" focus, stats grid, share/copy results, "Replay" and "Menu".
- Add a **pause menu** in every scene (resume, settings, restart scene, quit to menu).
- Add a **loading screen** with a joke tip and a progress bar (the first chunk generation and shader compile cause hitches; pre-warm).
- Add **toasts** for checkpoints, achievements and tips.
- Add **onboarding hints** with input-device-aware key prompts.

---

## 9. Graphics and rendering (cross-cutting)

- **Render pipeline:** shared setup (`renderer`, tone mapping, colour space, shadow type, DPR cap, resize) so STREET and saga scenes cannot drift. Today STREET configures this in `GameLoop`; `VoxelGame` has its own minimal version.
- **Post-processing stack** (optional per tier): bloom, vignette, colour grading LUT per scene, subtle chromatic aberration on impact, depth-based fog tint. Use a small custom pipeline (no heavy libraries) or `three/examples` passes; keep it off on `low`.
- **Materials:** prefer a small set of shared materials/shaders. Water, ice, glass, emissive, foliage-sway variants.
- **Shadows:** cascaded or follow-camera shadow frustum; avoid shadow acne (bias already set in STREET).
- **LOD and culling:** distant terrain simplification (VOXEL), far-fog fade, impostors for distant trees.
- **Anti-aliasing:** MSAA on desktop, FXAA/none on low tier.
- **Colour management:** make sure `outputColorSpace` and vertex colours are consistent (vertex colours are linear; check the tone-mapped result matches STREET's mood).
- **Texture atlas** pipeline (section 3.1).
- **Dave and Quell shaders:** subtle rim light, toon-ish outline option (nice but optional).
- **Day/night** and **weather** (rain, snow, fog banks, sandstorm).
- **Procedural variety:** street rebuild already randomises; make each scene's layout seed-driven too (props, tree placement, crowd positions) while keeping landmarks fixed.

---

## 10. Architecture and engineering

1. **Fix the tsc emit problem** (2.1). Add ESLint + Prettier configs and a `lint` script; do not mass-reformat in the same commit as logic changes.
2. **Unify the scene framework.** `VoxelGame` is a monolith with options. Introduce a `Scene`/`Mode` interface (`init`, `start`, `update`, `dispose`), a registry (`src/modes/index.ts`), and a single entry that `main.ts` uses (today `main.ts` is a growing `if` chain).
3. **Dispose properly.** Scenes must clean up (geometries, materials, listeners, audio nodes) so switching modes does not leak. The street `GameLoop` has teardown work; saga scenes do not.
4. **Remove duplication:** `Act2`/`Act3`/`Act4`/`Act5` repeat the same boost, bubble, Pim-on-shoulder and snow/stars code. Extract `StoryScene` base class + helpers (`HushBubble`, `PimCompanion`, `FartBoost`, `StarField`).
5. **Typed script and state:** a small state machine per scene (not string states + `if` ladders), typed event bus (`dialogueDone`, `checkpoint`, `fart`) so audio/VFX/UI subscribe instead of being called inline.
6. **Tests:** Vitest for pure logic (terrain heightmap determinism, mesher face culling, path generation, script validation); Playwright smoke test that loads each mode, drives the debug handle for N frames, and asserts no console errors. CI workflow (GitHub Actions: install, typecheck, build, tests).
7. **Bundle size.** The main bundle is large (about 5 MB before gzip; Three.js plus procedural code). Code-split per mode (already dynamic-imported), tree-shake Three imports, lazy-load Rapier only for STREET.
8. **Build/base path.** `vite.config.ts` uses a relative base (commit "configure relative base build for CybrDeck website integration"). Do not break that; test the production build under a sub-path.
9. **PWA:** `public/manifest.webmanifest` currently has data-URI icons and `orientation: portrait`. Saga scenes may want landscape; reconsider orientation, add real icons, a service worker with an offline cache.
10. **Docs:** README with setup, modes, controls, architecture diagram; keep `docs/` current.

---

## 11. Known issues backlog (from earlier automated QA; verify, then fix or close)

These were reported by audit agents and not all were fixed. Treat each as "verify first".
- Onomatopoeia stops escalating from Fart #16 (many identical long strings), and the longest renders smallest; long text wraps mid-word on phones.
- Milestone text claims effects the sim does not show (pigeons at #4, sirens at #13, "black sky" at #19).
- The street payoff (people blown away at #10 to #12, cars launched) happens off-screen because Dave is already airborne. Consider a camera/slow-motion cutaway.
- Faded cars passing close to the camera render as large ghost slabs behind the controls.
- Trees, lamps, hydrants, signs, bins and the bus shelter have no colliders; the camera passes through tree canopies.
- Dog owner glides and moonwalks on patrol turns; dog is not told Dave's x (faces the road centre).
- Dave, pedestrians, dog and owner pass through each other.
- About 360 to 450 draw calls per frame on the street (unmerged characters, cars, whole-city shadow casters).
- Residual shader-compile hitches (car material variants, first car fade, new materials).
- Audio level dips at tier hand-offs (#6 to #7, #16 to #17); Fart #25's sting is the quietest late voice.
- Mash-skip of the ending's Earth shot; skip accepts any pointer button.
- Landing search can skate Dave several metres sideways; `findFreeLanding` can return an occupied spot.
- Ragdolled walkers have no end-cap clamp; lying bodies hover above the pavement.
- Replayability is minimal and "Fart #1 never plays".
- Audio unlock may not work on iOS in one gesture.
- Dev-only console errors seen intermittently during hot reload (`SHOW_MUSIC_PREVIEW`, `EARTH_DETAIL` not defined) came from files being edited mid-reload; confirm they are gone on a clean load.
- Browser pane / pointer lock: `requestPointerLock` rejects in embedded previews (see 5.2).

### 11.1 Unverified by the previous developer
- Saga scenes were **driven by script and spot-screenshotted**, not play-tested end to end by a human. Expect feel issues: boost distances, camera angles in tight spaces (ship corridor, lift shaft), dialogue timing.
- Mobile layouts of every saga scene.
- Performance of VOXEL and saga scenes on phones.
- The street traffic turn-around at the cross street (code complete, not watched live).

---

## 12. Verification and QA harness

1. **Smoke script** (`scripts/smoke.mjs`, Playwright): for each mode, load the page, wait for the debug handle, run 600 synthetic frames, assert `console.error` count is 0, take a screenshot into `artifacts/`.
2. **Scene walkthrough scripts** driven through the debug handles: skip dialogue (`ui.lastAdvance = 0; ui.advance()`), teleport (`pos.set(...)`, then `dave.group.position.copy(pos)`), step frames, assert state transitions (`intro` to `play` to `end`). Existing manual sequences from development can be turned into tests.
3. **Visual regression:** fixed seeds per scene (`VoxelWorld` seed already configurable; jungle/ice/desert/star generators use constant seeds) so screenshots are comparable.
4. **Device matrix:** Chrome desktop, Safari iOS, Chrome Android, Firefox. Orientations: portrait and landscape. DPR 1, 2, 3.
5. **Performance capture:** record frame time on `low`, `medium`, `high`, and log draw calls and triangle counts per scene.

---

## 13. Suggested phasing (work in this order)

**Phase 0: Foundations (do first, small)**
- Fix tsc emit and remove stale `.js`; lint/format; add `window.__act1`; smoke test harness; CI.
- Tokens file and type scale (8.1); component extraction (8.2) with no visual change yet.

**Phase 1: UI/UX parity and settings**
- Apply tokens everywhere, unify fonts, move inline styles to CSS, shared dialogue/end-screen/button components.
- Settings panel, pause menu, menu/act select, save/load.
- Altimeter refinements (8.6).

**Phase 2: Controls**
- Unified input layer, touch UI, gamepad, pointer-lock fallback, camera collision, movement feel.

**Phase 3: Visual parity**
- Lit voxel materials, sun/hemisphere/shadows, sky, tone mapping, emissives and bloom, texture atlas, water.
- Character rig unification and Quell/Nomad redesign.
- Per-scene art passes (S1 to S5, then VOXEL biomes).
- VFX family (Hush Field shader, Silence wall, boost trails, ambient particles).

**Phase 4: Audio**
- Audio engine, buses, Hush low-pass, foley, dialogue blips, then music themes per scene in the order STREET, S1, S2, S3, S4, S5, Epilogue/Credits.

**Phase 5: Story and design**
- Script extraction and rewrite, bridge cutscene, Pim arc, gag ledger, new set pieces, side content, credits.
- Balancing pass with playtests; achievements; difficulty/assist.

**Phase 6: Voxel world and epilogue**
- Biomes, caves, villages, persistence, day/night, weather, "Rebuild Earth" goals.

**Phase 7: Polish and release**
- Bug backlog (section 11), performance, accessibility audit, PWA/offline, README, final QA matrix.

---

## 14. Deliverables checklist

- [ ] `docs/SAGA.md` revised, plus beat sheet, character bible, joke ledger
- [ ] `src/ui/tokens.css` and a fully standardised type scale applied everywhere
- [ ] Shared UI components, no inline-styled HTML in game scripts
- [ ] Settings, pause, menu/act select, save/load
- [ ] Unified input (keyboard/mouse, touch, gamepad) with remapping
- [ ] Lit, shadowed, textured voxel rendering with post-processing options
- [ ] Unified character rig; redesigned Quell, Nomads, Pim, Elder, Glorb, Captain, Toot
- [ ] Per-scene art passes S1 to S5, VOXEL biomes
- [ ] VFX family and ambient particle systems
- [ ] Audio engine + a theme per scene + SFX + dialogue blips + accessibility captions
- [ ] Altimeter refined
- [ ] Game design: tutorials, checkpoints, scoring, achievements, difficulty/assist, replayability
- [ ] Backlog items verified and fixed or closed
- [ ] Tests, CI, performance report, device-matrix notes

---

## 15. Final notes for the implementer

- **Preserve the soul.** The game works because it is **deadpan, silly, warm and fast**. Every refinement should make jokes land sooner, make the player feel clever, or make the world feel more alive. If something adds polish but slows the jokes down, cut it.
- **Procedural first.** The zero-asset constraint is a feature (tiny download, runs anywhere). Be inventive within it.
- **Ask when it matters.** If a decision would change the story, controls philosophy or the asset policy, write the question and your recommendation into the PR rather than guessing.
- **Leave the repo healthier than you found it.** Small commits, typed code, deleted dead code, updated docs.
