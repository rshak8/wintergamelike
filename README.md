# Dungeon Knight — playable ad (Three.js + Vite)

3D roguelike playable based on `GDD roguelike.docx`, Soul Knight style.

## Run
```
npm install
npm run dev        # http://localhost:5173  (phone frames: /phone.html, /phone.html#both)
npm run build      # dist/index.html — one self-contained file (~1.8 MB, 366 KB gzip)
```
Store link for the CTA: `CTA_URL` in `src/config.js` (uses `mraid.open` when available).

## Controls
Drag anywhere = floating joystick (WASD/arrows on desktop). Stop moving = auto-aim + auto-attack.
Weapon button (or Q/Space) swaps between two weapons.

## Structure
- `blender/` — Python scripts that build every model in Blender (`bh.py` helpers, `build_*.py`), `assets.blend`
- `src/assets/assets.glb` — exported models (hero, 5 enemies, 12 weapons/projectiles, 17 props)
- `src/config.js` — all balance numbers (weapons, buffs, enemies)
- `src/world.js` — 6 room layouts as ASCII maps, collision, line of sight, BFS pathing
- `src/player.js`, `src/enemies.js` — hero and enemy AI (warrior, archer, necro, healer, mimic, Skeleton King)
- `src/anim.js` — procedural animation rig (run, attacks, hits)
- `src/fx.js` — particles, slash trails, telegraphs, lightning, decals, damage numbers, shake, hit-stop
- `src/audio.js` — synthesized SFX + music (no audio files)
- `src/game.js` — combat, rewards, room flow; `src/ui.js` — HUD, buff cards, packshot

Rebuild models: in Blender run `exec(open(r"<path>/blender/build_hero.py").read())` (and the other build scripts), then export GLB.

QA hooks: `window.__game`, `window.__step(seconds)` advances the simulation deterministically.
