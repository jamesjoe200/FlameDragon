import type { GameData, Unit } from '../types'

function rand(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function buildPlayerUnit(charId: number, data: GameData, startX: number, startY: number): Unit | null {
  const app = data.appearances.find(a => a.id === charId)
  const ch = data.characters.find(c => c.id === charId)
  if (!app || !ch) return null
  const lv = app.entry_level
  return {
    uid: `player-${charId}`,
    name: app.name,
    isPlayer: true,
    charId,
    level: lv,
    xp: 0,
    hp: app.entry_hp, maxHp: app.entry_hp,
    mp: app.entry_mp, maxMp: app.entry_mp,
    ap: rand(ch.ap_min, ch.ap_max) * lv,
    dp: rand(ch.dp_min, ch.dp_max) * lv,
    ev: rand(ch.ev_min, ch.ev_max) * lv,
    mv: app.entry_mv,
    x: startX, y: startY,
    moved: false, acted: false,
    items: app.entry_items,
    spells: [...app.entry_spells],
  }
}

function buildEnemyUnit(enemyId: number, data: GameData, x: number, y: number, uid: string): Unit | null {
  const e = data.enemies.find(en => en.id === enemyId)
  if (!e) return null
  return {
    uid,
    name: e.name,
    isPlayer: false,
    charId: -1,
    level: 1,
    xp: 0,
    hp: e.hp, maxHp: e.hp,
    mp: e.mp, maxMp: e.mp,
    ap: e.ap, dp: e.dp, ev: e.ev, mv: e.mv,
    x, y,
    moved: false, acted: false,
    items: [], spells: [],
  }
}

// XP needed to reach next level (simple quadratic curve)
export function xpToNextLevel(level: number): number {
  return level * level * 10
}

// Apply a level-up to a unit, scaling stats using CharacterData ranges
export function applyLevelUp(unit: Unit, data: GameData): string {
  unit.level += 1
  unit.xp = 0
  const ch = data.characters.find(c => c.id === unit.charId)
  if (ch) {
    const apGain  = rand(ch.ap_min, ch.ap_max)
    const dpGain  = rand(ch.dp_min, ch.dp_max)
    const evGain  = rand(ch.ev_min, ch.ev_max)
    const hpGain  = rand(ch.hp_min, ch.hp_max)
    const mpGain  = rand(ch.mp_min, ch.mp_max)
    unit.ap += apGain
    unit.dp += dpGain
    unit.ev += evGain
    unit.maxHp += hpGain
    unit.hp = Math.min(unit.hp + hpGain, unit.maxHp)
    unit.maxMp += mpGain
    unit.mp = Math.min(unit.mp + mpGain, unit.maxMp)
    return `${unit.name} Lv${unit.level}! AP+${apGain} DP+${dpGain} HP+${hpGain}`
  }
  return `${unit.name} Lv${unit.level}!`
}

// XP awarded for defeating an enemy
export function xpForKill(enemy: Unit): number {
  return enemy.level * 15 + 10
}

// Stage configs — Chapter index maps to a battle scenario
// IDs reference AppearanceData (players) and EnemyData (enemies)
export const STAGE_CONFIGS: Array<{
  name: string
  players: number[]
  enemies: Array<{ id: number; x: number; y: number }>
}> = [
  {
    // Chapter 1: 索爾(0) + 悠妮(9) vs a few enemy soldiers
    name: '第一章 — 戰場初陣',
    players: [0, 9, 1, 2],
    enemies: [
      { id: 3,  x: 15, y: 4 },
      { id: 3,  x: 16, y: 5 },
      { id: 4,  x: 17, y: 6 },
    ],
  },
  {
    // Chapter 2: larger party
    name: '第二章 — 敵軍逼近',
    players: [0, 9, 1, 2, 4, 8],
    enemies: [
      { id: 3,  x: 14, y: 3 },
      { id: 3,  x: 15, y: 4 },
      { id: 3,  x: 16, y: 5 },
      { id: 4,  x: 17, y: 6 },
      { id: 4,  x: 18, y: 7 },
    ],
  },
  {
    // Chapter 3: elite enemies
    name: '第三章 — 決戰時刻',
    players: [0, 9, 1, 2, 4, 8, 7, 5],
    enemies: [
      { id: 4,  x: 13, y: 3 },
      { id: 4,  x: 14, y: 4 },
      { id: 5,  x: 15, y: 5 },
      { id: 5,  x: 16, y: 6 },
      { id: 5,  x: 17, y: 7 },
      { id: 6,  x: 18, y: 4 },
    ],
  },
]

export function buildUnitsForStage(
  stageIndex: number,
  data: GameData,
  mods: { enemyMultiplier: number; maxPartySize: number },
  savedUnits?: Unit[]
): Unit[] {
  const config = STAGE_CONFIGS[stageIndex] ?? STAGE_CONFIGS[0]
  const units: Unit[] = []

  // Reuse saved unit state (carry XP/levels between chapters) or build fresh
  const playerPositions = [[4,7],[5,7],[4,8],[5,8],[3,7],[6,7],[4,6],[5,6]]
  config.players.slice(0, mods.maxPartySize).forEach((id, i) => {
    const [px, py] = playerPositions[i] ?? [i + 2, 7]
    const saved = savedUnits?.find(u => u.charId === id)
    if (saved) {
      units.push({ ...saved, x: px, y: py, moved: false, acted: false })
    } else {
      const u = buildPlayerUnit(id, data, px, py)
      if (u) units.push(u)
    }
  })

  // Enemy units — multiplied by mod
  for (let m = 0; m < mods.enemyMultiplier; m++) {
    config.enemies.forEach((ec, i) => {
      const offset = m * 2
      const u = buildEnemyUnit(ec.id, data, ec.x + (offset < 2 ? 0 : offset), ec.y, `enemy-${m}-${i}`)
      if (u) units.push(u)
    })
  }

  return units
}
