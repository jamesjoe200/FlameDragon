import type { GameData } from '../types'

// JSON files are placed in /data/ at build time (copied from fd2/data/)
const DATA_FILES = [
  'characters', 'enemies', 'items', 'spells',
  'spell_learn', 'shops', 'appearances', 'tweaks',
] as const

export async function loadGameData(): Promise<GameData> {
  const entries = await Promise.all(
    DATA_FILES.map(async (name) => {
      const res = await fetch(`/data/${name}.json`)
      if (!res.ok) throw new Error(`Failed to load ${name}.json: ${res.status}`)
      return [name, await res.json()] as const
    })
  )
  return Object.fromEntries(entries) as unknown as GameData
}
