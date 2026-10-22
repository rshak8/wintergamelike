# Dungeon Knight — playable ad (Three.js + Vite)

3D roguelike playable based on `GDD roguelike.docx`, Soul Knight style.

## Run
```
npm install
npm run dev        # http://localhost:5173  (phone frames: /phone.html, /phone.html#both)
npm run build      # dist/index.html — one self-contained file (~4.5 MB, 1.6 MB gzip)
```
Store link for the CTA: `CTA_URL` in `src/config.js` (uses `mraid.open` when available).

## Controls
Phone-only (portrait and landscape). Drag anywhere = floating joystick. Stop moving = auto-aim + auto-attack.
On a computer the page shows the game inside a phone frame; open `/?full` to run it full-window.
Weapon button swaps between two weapons.

## Structure
- `blender/` — Python scripts that build every model in Blender (`bh.py` helpers, `build_*.py`), `assets.blend`
- `src/assets/assets.glb` — exported models (hero, 5 enemies, 12 weapons/projectiles, 17 props)
- `src/config.js` — all balance numbers (weapons, buffs, enemies)
- `src/world.js` — 6 room layouts as ASCII maps (14×17, boss 14×19), collision, line of sight, BFS pathing, dark rock fill outside the rooms
- `src/lights.js` — fixed pool of 8 point lights shared by all torches/braziers/chests (fades between sources, never recompiles shaders)
- `src/player.js`, `src/enemies.js` — hero and enemy AI (warrior, archer, necro, healer, mimic, Skeleton King)
- `src/anim.js` — procedural animation rig (run, attacks, hits)
- `src/fx.js` — particles, slash trails, telegraphs, lightning, decals, damage numbers, shake, hit-stop
- `src/audio.js` — synthesized SFX + music (no audio files)
- `src/game.js` — combat, rewards, room flow; `src/ui.js` — HUD, buff cards, packshot

Rebuild models: in Blender run each script with `exec(open(r"<path>/blender/build_hero.py", encoding="utf-8-sig").read())` (also build_enemies.py, build_weapons.py, build_chests.py; build_props.py for the level kit), then blender/export_glb.py.
Model rules: smooth shapes from bh.py helpers (tube/lathe/rbox/ell/blade), rounded tips, no sharp spikes. Weapons: grip centre at the origin, handle along +Z. Each fist has a Hand socket in its centre; src/anim.js Rig.attach puts the grip through the fist.

QA hooks: `window.__game`, `window.__step(seconds)` advances the simulation deterministically.
