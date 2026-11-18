# 炎龍騎士團 II — Flame Dragon Knights II (Web Remake)

A browser-based remake of the classic MS-DOS tactical RPG 炎龍騎士團 II (1994).  
Runs entirely in a single HTML file — no server, no install needed.

## Play

Open `dist/fd2_standalone.html` directly in any modern browser.

## Controls

| Key | Action |
|-----|--------|
| Arrow keys | Move cursor / navigate menus |
| Enter / Space | Select / confirm |
| Escape | Cancel / back |
| E | End player turn |
| S | Save game |

## Features

- **Tactical map** — 20×15 tile grid with terrain types (plain, forest, mountain, water, road)
- **Turn-based combat** — Player phase → Enemy phase with animated turn banners
- **Physical attacks** — Hit% based on AP vs EV; damage = AP − DP/2
- **Magic / spells** — Units with spells can cast from their learned spell list; MP cost applies; spell range highlighted on map; attack preview shows hit% and estimated damage
- **XP & level up** — Earn XP on kills; level-up scales all stats using original CharacterData growth ranges
- **3 chapters** — 第一章, 第二章, 第三章 with escalating enemy compositions; party carries over between chapters
- **Save / Load** — `S` saves to localStorage; title screen shows Continue option when a save exists
- **Editor / Cheat panel** — Click ⚙ Editor button to open:
  - Enemy multiplier (1–5×)
  - Max party size (1–12)
  - XP multiplier (1–10×)
  - No MP cost toggle
  - Invincible toggle
  - In-game data reference (characters, enemies, spells, items)

## Data

All game data is extracted from the original `fd2dat.mdb` (Microsoft Jet/Access) using `tools/extract_mdb.py` and stored as JSON in `public/data/`:

| File | Contents |
|------|----------|
| `characters.json` | 32 characters with AP/DP/EV/HP/MP growth ranges |
| `enemies.json` | Enemy units with base stats |
| `items.json` | Weapons, armour, items with stat modifiers |
| `spells.json` | 200+ spells with power, accuracy, range, MP cost |
| `spell_learn.json` | Per-character spell learning sequences |
| `appearances.json` | Entry level, stats, starting items/spells per character |
| `shops.json` | Shop inventories by chapter |
| `tweaks.json` | Original game tweak flags |

## Build

```bash
npm install
npm run build        # outputs dist/fd2_standalone.html
```

Requires Node.js 18+.

## Project Structure

```
src/
  game/
    engine/        Game loop, constants, data loader
    scenes/        TitleScene, MapScene
    entities/      UnitFactory (builds/levels units)
    types.ts       All shared TypeScript interfaces
  editor/          In-game editor panel
tools/
  extract_mdb.py   Extracts game data from fd2dat.mdb
  postbuild.mjs    Strips type="module" for enterprise CSP compat
  bundle_inline.mjs  Builds self-contained single HTML file
public/data/       JSON game data files
```

## Original Game

炎龍騎士團 II was developed by Hsu Chih-Yuan and released in 1994 for MS-DOS.  
This remake preserves the original Chinese language and game data.  
Reference: https://chiuinan.github.io/game/game/intro/ch/c31/fd2/index.htm

## Roadmap

- [ ] Sprite art from original `.DAT` files
- [ ] Item equip system (weapons/armour affecting stats)
- [ ] Story scenes / chapter dialogue
- [ ] Shop interface
- [ ] FD1 and FD3 remakes
