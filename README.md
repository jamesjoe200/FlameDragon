# 炎龍騎士團 — Flame Dragon Knights Suite

A modern web remake of the classic MS-DOS tactical RPG series **炎龍騎士團** (Flame Dragon Knights), originally released in the mid-1990s.

This project preserves the original gameplay faithfully while adding quality-of-life improvements and a built-in editor/cheat mode.

---

## Games

| Game | Status | Notes |
|------|--------|-------|
| **FD2** — 炎龍騎士團 II | 🚧 In Progress | First target, most complete original data |
| **FD1** — 炎龍騎士團 | Planned | |
| **FD3** — 炎龍騎士團 III | Planned | |

---

## FD2 — Quick Start

### Prerequisites
- [Node.js](https://nodejs.org) v18+
- Python 3.10+ (for asset extraction only)

### Run (development)
```bash
cd fd2
npm install
npm run dev
# Opens at http://localhost:3000
```

### Build (production)
```bash
cd fd2
npm run build
# Output in fd2/dist/
```

### Re-extract game data (optional)
If you have the original game files, you can re-extract all game data:
```bash
cd fd2/tools
python extract_mdb.py --mdb <path_to_fd2dat.mdb> --out ../data
# Then copy to public:
cp ../data/*.json ../public/data/
```

---

## Controls

| Key | Action |
|-----|--------|
| Arrow Keys | Move cursor |
| Enter / Space | Select unit / confirm move |
| Escape | Cancel selection |
| E | End player turn |
| ⚙ Editor button | Open editor panel |

---

## Editor / Cheat Mode

Click the **⚙ Editor** button (top-right of the game) to open the editor panel.

### Gameplay Mods
| Setting | Description |
|---------|-------------|
| **Enemy Multiplier** | 1x–5x — multiply enemies per stage for faster level grinding |
| **Max Party Size** | 1–12 — original cap is 8; increase to bring more characters |
| **EXP Multiplier** | 1x–10x — accelerate character levelling |
| **Infinite MP** | Spells cost no MP |
| **Invincible** | Player units cannot be killed |

### Data Reference
The editor panel also shows a full reference of all characters, enemies, spells, and items extracted directly from the original game database.

---

## Project Structure

```
FlameDragon/
├── README.md
└── fd2/                        # FD2 web game
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── data/                   # Extracted JSON game data
    │   ├── characters.json     # 63 player characters (stat growth)
    │   ├── enemies.json        # 68 enemy types
    │   ├── items.json          # 216 items & weapons
    │   ├── spells.json         # 36 magic spells
    │   ├── spell_learn.json    # Spell learning sequences per character
    │   ├── shops.json          # 23 chapter shop inventories
    │   ├── appearances.json    # Character entry data per chapter
    │   └── tweaks.json         # 19 original cheat editor entries
    ├── public/
    │   └── data/               # JSON served at runtime
    ├── src/
    │   ├── main.ts
    │   ├── game/
    │   │   ├── engine/
    │   │   │   ├── Game.ts         # Game loop, scene manager, mod flags
    │   │   │   └── DataLoader.ts   # Async JSON data loader
    │   │   ├── scenes/
    │   │   │   ├── TitleScene.ts   # Title screen
    │   │   │   └── MapScene.ts     # Tactical map with movement & turn system
    │   │   ├── entities/
    │   │   │   └── UnitFactory.ts  # Build player/enemy units from game data
    │   │   └── types.ts            # Shared TypeScript types
    │   └── editor/
    │       └── Editor.ts           # In-game editor / cheat panel
    └── tools/
        └── extract_mdb.py          # Extract fd2dat.mdb → JSON
```

---

## Roadmap

- [x] Extract all game data from original MDB database
- [x] Title screen
- [x] Tactical map with tile rendering, unit display, cursor movement
- [x] Basic turn system (player/enemy phases)
- [x] Unit movement with terrain costs
- [x] In-game editor panel (enemy multiplier, party size, EXP multiplier, cheats)
- [ ] Combat system (attack, spells, hit/evade calculation)
- [ ] Chapter progression & story scenes
- [ ] Shops & inventory management
- [ ] Level up & stat growth system
- [ ] Decode original .DAT sprite assets for authentic visuals
- [ ] Background music (original MIDI data)
- [ ] Save/load system
- [ ] FD1 & FD3 games

---

## Original Game

**炎龍騎士團 II** was developed by Hitech and published around 1995 for MS-DOS. It is a Chinese tactical RPG in the vein of Fire Emblem, featuring grid-based combat, character levelling, and a chapter-driven story.

Original files run under DOSBox. This project does not distribute the original game files.

---

## License

Source code: GPL-3.0 (see LICENSE)  
Original game assets belong to their respective copyright holders.
