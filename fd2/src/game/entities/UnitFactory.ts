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
    level: lv,
    hp: app.entry_hp, maxHp: app.entry_hp,
    mp: app.entry_mp, maxMp: app.entry_mp,
    ap: rand(ch.ap_min, ch.ap_max) * lv,
    dp: rand(ch.dp_min, ch.dp_max) * lv,
    ev: rand(ch.ev_min, ch.ev_max) * lv,
    mv: app.entry_mv,
    x: startX, y: startY,
    moved: false, acted: false,
    items: app.entry_items,
    spells: app.entry_spells,
  }
}

function buildEnemyUnit(enemyId: number, data: GameData, x: number, y: number, uid: string): Unit | null {
  const e = data.enemies.find(en => en.id === enemyId)
  if (!e) return null
  return {
    uid,
    name: e.name,
    isPlayer: false,
    level: 1,
    hp: e.hp, maxHp: e.hp,
    mp: e.mp, maxMp: e.mp,
    ap: e.ap, dp: e.dp, ev: e.ev, mv: e.mv,
    x, y,
    moved: false, acted: false,
    items: [], spells: [],
  }
}

// Stage 0 = Chapter 2 (first playable chapter in FD2)
const STAGE_CONFIGS: Array<{
  players: number[],
  enemies: Array<{ id: number; x: number; y: number }>
}> = [
  {
    // Chapter 2: 索爾(1), 哈諾(2), 鐵諾(3) vs a few enemy soldiers
    players: [1, 2, 3],
    enemies: [
      { id: 3,  x: 15, y: 4 },
      { id: 3,  x: 16, y: 5 },
      { id: 4,  x: 17, y: 6 },
    ],
  },
]

export function buildUnitsForStage(
  stageIndex: number,
  data: GameData,
  mods: { enemyMultiplier: number; maxPartySize: number }
): Unit[] {
  const config = STAGE_CONFIGS[stageIndex] ?? STAGE_CONFIGS[0]
  const units: Unit[] = []

  // Player units
  const playerPositions = [[4,7],[5,7],[4,8],[5,8],[3,7],[6,7],[4,6],[5,6]]
  config.players.slice(0, mods.maxPartySize).forEach((id, i) => {
    const [px, py] = playerPositions[i] ?? [i + 2, 7]
    const u = buildPlayerUnit(id, data, px, py)
    if (u) units.push(u)
  })

  // Enemy units — multiplied by mod
  for (let m = 0; m < mods.enemyMultiplier; m++) {
    config.enemies.forEach((ec, i) => {
      const offset = m * 2
      const u = buildEnemyUnit(ec.id, data, ec.x + offset, ec.y, `enemy-${m}-${i}`)
      if (u) units.push(u)
    })
  }

  return units
}
