export interface CharacterData {
  id: number
  name: string
  ap_min: number; ap_max: number
  dp_min: number; dp_max: number
  ev_min: number; ev_max: number
  hp_min: number; hp_max: number
  mp_min: number; mp_max: number
  magic_type: number | null
}

export interface EnemyData {
  id: number
  name: string
  friendly: boolean
  hp: number; mp: number
  ap: number; dp: number; ev: number; mv: number
}

export interface ItemData {
  id: number; hex_id: number
  name: string
  category: string; subcategory: string
  type: number
  ap: number; hit: number; dp: number; ev: number
  range_min: number; range_max: number
  price_buy: number
  usable_by: number
}

export interface SpellData {
  id: number
  name: string
  power: number; accuracy: number
  range: number; aoe: number
  mp_cost: number
}

export interface SpellLearn {
  character: string
  sequence_id: number
  learns: Array<{ level: number; spell_id: number }>
}

export interface ShopData {
  id: number
  chapter: string
  weapons: number[]
  items: number[]
  magic: number[]
}

export interface AppearanceData {
  id: number
  name: string
  type: number
  entry_level: number
  entry_hp: number; entry_mp: number; entry_mv: number
  entry_items: number[]
  entry_spells: number[]
  info: string
}

export interface TweakData {
  id: number
  description: string
  enabled: boolean
}

export interface GameData {
  characters: CharacterData[]
  enemies: EnemyData[]
  items: ItemData[]
  spells: SpellData[]
  spell_learn: SpellLearn[]
  shops: ShopData[]
  appearances: AppearanceData[]
  tweaks: TweakData[]
}

// Runtime battle unit (player or enemy instance)
export interface Unit {
  uid: string
  name: string
  isPlayer: boolean
  charId: number                 // source CharacterData/AppearanceData id (-1 for enemies)
  level: number
  xp: number                    // current XP toward next level
  hp: number; maxHp: number
  mp: number; maxMp: number
  ap: number; dp: number; ev: number; mv: number
  x: number; y: number          // grid position
  moved: boolean; acted: boolean
  items: number[]               // item hex IDs carried
  spells: number[]              // spell IDs known
}

export type SceneName = 'title' | 'map' | 'battle'
