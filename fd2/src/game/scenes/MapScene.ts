import type { Game, Scene } from '../engine/Game'
import { CANVAS_W, CANVAS_H, TILE_SIZE } from '../engine/constants'
import type { Unit, SpellData } from '../types'
import {
  buildUnitsForStage, applyLevelUp, xpForKill, xpToNextLevel,
  STAGE_CONFIGS,
} from '../entities/UnitFactory'

const COLS = Math.floor(CANVAS_W / TILE_SIZE)  // 20
const ROWS = Math.floor(CANVAS_H / TILE_SIZE)  // 15

const enum Tile { PLAIN = 0, FOREST = 1, MOUNTAIN = 2, WATER = 3, ROAD = 4 }

const TILE_COLORS: Record<number, string> = {
  [Tile.PLAIN]:    '#3a5a2a',
  [Tile.FOREST]:   '#1e4020',
  [Tile.MOUNTAIN]: '#6e6e5a',
  [Tile.WATER]:    '#1a3a6a',
  [Tile.ROAD]:     '#8a7a5a',
}

// Map terrain type -> tile index in ch1 sheet (inspect ch1_labeled.png to tune)
const TERRAIN_TILE_IDX: Record<number, number> = {
  [Tile.PLAIN]:    0,
  [Tile.FOREST]:   8,
  [Tile.MOUNTAIN]: 16,
  [Tile.WATER]:    24,
  [Tile.ROAD]:     32,
}

function buildPlaceholderMap(): number[][] {
  const map: number[][] = []
  for (let r = 0; r < ROWS; r++) {
    const row: number[] = []
    for (let c = 0; c < COLS; c++) {
      if (r === 0 || r === ROWS - 1) row.push(Tile.MOUNTAIN)
      else if (c === 10) row.push(Tile.ROAD)
      else if (c > 14 && r > 4 && r < 10) row.push(Tile.WATER)
      else if (c < 4 && r > 7) row.push(Tile.FOREST)
      else row.push(Tile.PLAIN)
    }
    map.push(row)
  }
  return map
}

function calcHitChance(attacker: Unit, defender: Unit): number {
  return Math.min(95, Math.max(10, 75 + (attacker.ap - defender.ev) * 2))
}

function calcDamage(attacker: Unit, defender: Unit): number {
  return Math.max(1, attacker.ap - Math.floor(defender.dp / 2))
}

function calcSpellHit(spell: SpellData, defender: Unit): number {
  return Math.min(95, Math.max(10, spell.accuracy - Math.floor(defender.ev / 4)))
}

function calcSpellDamage(spell: SpellData, _defender: Unit): number {
  return Math.max(1, Math.floor(spell.power / 10) + Math.floor(Math.random() * 5))
}

const SAVE_KEY = 'fd2_save'

interface SaveData {
  stageIndex: number
  units: Unit[]
}

type Phase = 'player' | 'enemy' | 'victory' | 'defeat'
type SubState = 'free' | 'moving' | 'actionMenu' | 'targeting' | 'spellMenu' | 'spellTargeting'

type ActionMenuItem = 'Attack' | 'Magic' | 'Wait'

interface LogEntry { text: string; timer: number }

export class MapScene implements Scene {
  private game: Game
  private map: number[][]
  private units: Unit[]
  private stageIndex: number
  private lordId: number
  private cursor = { x: 5, y: 7 }
  private selected: Unit | null = null
  private reachable: Set<string> = new Set()
  private phase: Phase = 'player'
  private sub: SubState = 'free'
  private turnMessage = ''
  private turnMsgTimer = 0
  private log: LogEntry[] = []

  // Action menu
  private menuItems: ActionMenuItem[] = []
  private menuIndex = 0

  // Attack targeting
  private attackTargets: Unit[] = []
  private targetIndex = 0

  // Spell menu + targeting
  private spellList: SpellData[] = []
  private spellIndex = 0
  private spellTargets: Unit[] = []
  private spellTargetIndex = 0
  private spellRange: Set<string> = new Set()

  constructor(game: Game, stageIndex = 0, savedUnits?: Unit[]) {
    this.game = game
    this.stageIndex = stageIndex
    this.lordId = STAGE_CONFIGS[stageIndex]?.lordId ?? 0
    this.map = buildPlaceholderMap()
    this.units = buildUnitsForStage(stageIndex, game.data, game.mods, savedUnits)
    this.showTurnBanner('我方行動')
  }

  // ── Save / Load ──────────────────────────────────────────────────────────────

  save() {
    const data: SaveData = {
      stageIndex: this.stageIndex,
      units: this.units.filter(u => u.isPlayer),
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(data))
    this.addLog('Game saved.')
  }

  static hasSave(): boolean {
    return !!localStorage.getItem(SAVE_KEY)
  }

  static loadSave(): SaveData | null {
    const raw = localStorage.getItem(SAVE_KEY)
    return raw ? JSON.parse(raw) as SaveData : null
  }

  static clearSave() {
    localStorage.removeItem(SAVE_KEY)
  }

  // ── Tick ─────────────────────────────────────────────────────────────────────

  update(dt: number) {
    if (this.turnMsgTimer > 0) this.turnMsgTimer -= dt
    this.log = this.log.map(e => ({ ...e, timer: e.timer - dt })).filter(e => e.timer > 0)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  render(ctx: CanvasRenderingContext2D) {
    this.drawMap(ctx)
    this.drawReachable(ctx)
    this.drawSpellRange(ctx)
    this.drawAttackTargets(ctx)
    this.drawSpellTargets(ctx)
    this.drawUnits(ctx)
    this.drawCursor(ctx)
    this.drawHUD(ctx)
    if (this.sub === 'actionMenu') this.drawActionMenu(ctx)
    if (this.sub === 'spellMenu') this.drawSpellMenu(ctx)
    if (this.turnMsgTimer > 0) this.drawTurnMessage(ctx)
    this.drawLog(ctx)
    if (this.phase === 'victory' || this.phase === 'defeat') this.drawOutcome(ctx)
  }

  private drawMap(ctx: CanvasRenderingContext2D) {
    const sprites = this.game.sprites
    const ch = this.stageIndex + 1
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const terrain = this.map[r][c]
        const px = c * TILE_SIZE
        const py = r * TILE_SIZE
        // Always fill solid color first so transparent tile edges blend cleanly
        ctx.fillStyle = TILE_COLORS[terrain] ?? '#3a5a2a'
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE)
        if (sprites.isReady) {
          // Add positional variation so adjacent same-terrain tiles don't look identical
          const variation = ((c * 3 + r * 7) % 3)
          sprites.drawTile(ctx, ch, (TERRAIN_TILE_IDX[terrain] ?? 0) + variation, px, py)
        }
      }
    }
  }

  private drawReachable(ctx: CanvasRenderingContext2D) {
    if (this.sub !== 'moving') return
    ctx.fillStyle = 'rgba(100,180,255,0.25)'
    for (const key of this.reachable) {
      const [x, y] = key.split(',').map(Number)
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
    }
  }

  private drawSpellRange(ctx: CanvasRenderingContext2D) {
    if (this.sub !== 'spellTargeting') return
    ctx.fillStyle = 'rgba(255,180,80,0.18)'
    for (const key of this.spellRange) {
      const [x, y] = key.split(',').map(Number)
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
    }
  }

  private drawAttackTargets(ctx: CanvasRenderingContext2D) {
    if (this.sub !== 'targeting') return
    for (let i = 0; i < this.attackTargets.length; i++) {
      const t = this.attackTargets[i]
      ctx.fillStyle = i === this.targetIndex
        ? 'rgba(255,80,80,0.5)' : 'rgba(255,80,80,0.2)'
      ctx.fillRect(t.x * TILE_SIZE, t.y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
    }
  }

  private drawSpellTargets(ctx: CanvasRenderingContext2D) {
    if (this.sub !== 'spellTargeting') return
    for (let i = 0; i < this.spellTargets.length; i++) {
      const t = this.spellTargets[i]
      ctx.fillStyle = i === this.spellTargetIndex
        ? 'rgba(255,160,40,0.6)' : 'rgba(255,160,40,0.25)'
      ctx.fillRect(t.x * TILE_SIZE, t.y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
    }
  }

  private drawUnits(ctx: CanvasRenderingContext2D) {
    const sprites = this.game.sprites
    for (const u of this.units) {
      const px = u.x * TILE_SIZE
      const py = u.y * TILE_SIZE

      // Resolve portrait ID: players use charId; enemies map to portrait slots after player chars
      const enemyTypeId = u.isPlayer ? -1 : this.game.data.enemies.findIndex(e => e.name === u.name)
      const resolvedPortraitId = u.isPlayer ? u.charId : (enemyTypeId >= 0 ? 32 + enemyTypeId : 32)

      if (sprites.isReady) {
        sprites.drawIcon(ctx, resolvedPortraitId, 0, px, py)
        // Dim moved player units
        if (u.moved && u.isPlayer) {
          ctx.fillStyle = 'rgba(0,0,60,0.4)'
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE)
        }
        // Red tint on enemies
        if (!u.isPlayer) {
          ctx.fillStyle = 'rgba(140,0,0,0.3)'
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE)
        }
        // Selection highlight
        if (u === this.selected) {
          ctx.strokeStyle = '#ffff44'
          ctx.lineWidth = 2
          ctx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2)
          ctx.lineWidth = 1
        }
      } else {
        // Fallback: colored box with initial
        ctx.fillStyle = u.isPlayer
          ? (u.moved ? '#446688' : (u === this.selected ? '#66aaff' : '#4488cc'))
          : '#cc4444'
        ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 11px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(u.name[0], px + TILE_SIZE / 2, py + TILE_SIZE / 2 + 4)
      }

      // HP bar (always shown)
      const hpPct = u.hp / u.maxHp
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(px + 1, py + TILE_SIZE - 5, TILE_SIZE - 2, 4)
      ctx.fillStyle = hpPct > 0.5 ? '#44cc44' : hpPct > 0.25 ? '#cccc44' : '#cc4444'
      ctx.fillRect(px + 1, py + TILE_SIZE - 5, (TILE_SIZE - 2) * hpPct, 4)

      // Magic dot
      if (u.spells.length > 0 && u.mp > 0) {
        ctx.fillStyle = '#88aaff'
        ctx.beginPath()
        ctx.arc(px + TILE_SIZE - 4, py + 4, 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  private drawCursor(ctx: CanvasRenderingContext2D) {
    if (this.sub === 'actionMenu' || this.sub === 'spellMenu') return
    const isSpellTarget = this.sub === 'spellTargeting'
    const isAttackTarget = this.sub === 'targeting'
    ctx.strokeStyle = isSpellTarget ? '#ffaa22' : isAttackTarget ? '#ff4444' : '#ffdd00'
    ctx.lineWidth = 2
    ctx.strokeRect(
      this.cursor.x * TILE_SIZE + 1,
      this.cursor.y * TILE_SIZE + 1,
      TILE_SIZE - 2, TILE_SIZE - 2
    )
    ctx.lineWidth = 1
  }

  private drawActionMenu(ctx: CanvasRenderingContext2D) {
    const unit = this.selected!
    const menuW = 110
    const menuH = this.menuItems.length * 24 + 8
    let mx = unit.x * TILE_SIZE + TILE_SIZE + 4
    if (mx + menuW > CANVAS_W) mx = unit.x * TILE_SIZE - menuW - 4
    const my = Math.min(unit.y * TILE_SIZE, CANVAS_H - menuH - 4)

    ctx.fillStyle = 'rgba(10,10,30,0.92)'
    ctx.strokeStyle = '#446'
    ctx.lineWidth = 1
    ctx.fillRect(mx, my, menuW, menuH)
    ctx.strokeRect(mx, my, menuW, menuH)

    for (let i = 0; i < this.menuItems.length; i++) {
      const item = this.menuItems[i]
      const sel = i === this.menuIndex
      if (sel) { ctx.fillStyle = '#334466'; ctx.fillRect(mx + 2, my + 4 + i * 24, menuW - 4, 22) }
      ctx.fillStyle = sel ? '#88ddff' : '#ccc'
      ctx.font = sel ? 'bold 13px sans-serif' : '13px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText((sel ? '► ' : '  ') + item, mx + 6, my + 20 + i * 24)
    }
  }

  private drawSpellMenu(ctx: CanvasRenderingContext2D) {
    const unit = this.selected!
    const menuW = 160
    const menuH = this.spellList.length * 26 + 30
    let mx = unit.x * TILE_SIZE + TILE_SIZE + 4
    if (mx + menuW > CANVAS_W) mx = unit.x * TILE_SIZE - menuW - 4
    const my = Math.min(unit.y * TILE_SIZE, CANVAS_H - menuH - 4)

    ctx.fillStyle = 'rgba(10,10,30,0.95)'
    ctx.strokeStyle = '#668'
    ctx.lineWidth = 1
    ctx.fillRect(mx, my, menuW, menuH)
    ctx.strokeRect(mx, my, menuW, menuH)

    ctx.fillStyle = '#88aaff'
    ctx.font = 'bold 11px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`MP: ${unit.mp}/${unit.maxMp}`, mx + 6, my + 14)

    for (let i = 0; i < this.spellList.length; i++) {
      const sp = this.spellList[i]
      const sel = i === this.spellIndex
      const canCast = unit.mp >= sp.mp_cost
      if (sel) { ctx.fillStyle = '#223344'; ctx.fillRect(mx + 2, my + 20 + i * 26, menuW - 4, 24) }
      ctx.fillStyle = sel ? '#ffdd88' : canCast ? '#ccc' : '#555'
      ctx.font = sel ? 'bold 12px sans-serif' : '12px sans-serif'
      ctx.fillText(`${sel ? '►' : ' '} ${sp.name}`, mx + 6, my + 36 + i * 26)
      ctx.fillStyle = '#888'
      ctx.font = '10px monospace'
      ctx.fillText(`MP:${sp.mp_cost} Pw:${sp.power} Rng:${sp.range}`, mx + 6, my + 48 + i * 26)
    }
  }

  private drawHUD(ctx: CanvasRenderingContext2D) {
    // Phase + chapter
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, 0, 200, 22)
    ctx.fillStyle = this.phase === 'player' ? '#88ddff' : '#ff8888'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'left'
    const phaseName = this.phase === 'player' ? '► 我方行動' : '► 敵方行動'
    ctx.fillText(`${phaseName}  Ch.${this.stageIndex + 1}`, 8, 15)

    // Unit info
    const infoUnit = (this.sub === 'targeting')
      ? this.attackTargets[this.targetIndex]
      : (this.sub === 'spellTargeting')
        ? this.spellTargets[this.spellTargetIndex]
        : this.unitAt(this.cursor.x, this.cursor.y)

    if (infoUnit) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)'
      ctx.fillRect(0, CANVAS_H - 54, 270, 54)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 13px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(infoUnit.name, 8, CANVAS_H - 38)
      ctx.font = '11px monospace'
      ctx.fillStyle = '#aaa'
      ctx.fillText(`HP ${infoUnit.hp}/${infoUnit.maxHp}  MP ${infoUnit.mp}/${infoUnit.maxMp}  Lv${infoUnit.level}`, 8, CANVAS_H - 24)
      ctx.fillText(`AP:${infoUnit.ap} DP:${infoUnit.dp} EV:${infoUnit.ev} MV:${infoUnit.mv}  XP:${infoUnit.xp}/${xpToNextLevel(infoUnit.level)}`, 8, CANVAS_H - 10)
    }

    // Combat / spell preview
    if (this.sub === 'targeting' && this.selected && this.attackTargets.length) {
      const t = this.attackTargets[this.targetIndex]
      const hit = calcHitChance(this.selected, t)
      const dmg = calcDamage(this.selected, t)
      this.drawPreviewBox(ctx, `Hit:${hit}%  Dmg:${dmg}`, 'ATTACK')
    } else if (this.sub === 'spellTargeting' && this.selected && this.spellTargets.length && this.spellList[this.spellIndex]) {
      const sp = this.spellList[this.spellIndex]
      const t = this.spellTargets[this.spellTargetIndex]
      const hit = calcSpellHit(sp, t)
      const dmg = calcSpellDamage(sp, t)
      this.drawPreviewBox(ctx, `Hit:${hit}%  Dmg:~${dmg}  MP:${sp.mp_cost}`, sp.name)
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(CANVAS_W - 240, CANVAS_H - 20, 240, 20)
      ctx.fillStyle = '#888'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText('Arrows:move  Enter:select  E:end turn  S:save', CANVAS_W - 4, CANVAS_H - 6)
    }
  }

  private drawPreviewBox(ctx: CanvasRenderingContext2D, line: string, title: string) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    ctx.fillRect(CANVAS_W - 180, CANVAS_H - 54, 180, 54)
    ctx.fillStyle = '#ffdd88'
    ctx.font = 'bold 11px monospace'
    ctx.textAlign = 'right'
    ctx.fillText(title, CANVAS_W - 6, CANVAS_H - 38)
    ctx.fillStyle = '#fff'
    ctx.font = '11px monospace'
    ctx.fillText(line, CANVAS_W - 6, CANVAS_H - 24)
    ctx.fillStyle = '#888'
    ctx.font = '10px sans-serif'
    ctx.fillText('Enter:confirm  Esc:cancel', CANVAS_W - 6, CANVAS_H - 10)
  }

  private drawTurnMessage(ctx: CanvasRenderingContext2D) {
    const alpha = Math.min(1, this.turnMsgTimer / 0.4)
    ctx.fillStyle = `rgba(0,0,0,${0.75 * alpha})`
    ctx.fillRect(CANVAS_W / 2 - 130, CANVAS_H / 2 - 22, 260, 44)
    ctx.fillStyle = `rgba(255,221,136,${alpha})`
    ctx.font = 'bold 22px serif'
    ctx.textAlign = 'center'
    ctx.fillText(this.turnMessage, CANVAS_W / 2, CANVAS_H / 2 + 8)
  }

  private drawLog(ctx: CanvasRenderingContext2D) {
    ctx.textAlign = 'left'
    for (let i = 0; i < this.log.length; i++) {
      const e = this.log[i]
      const alpha = Math.min(1, e.timer / 0.5)
      ctx.fillStyle = `rgba(255,220,100,${alpha})`
      ctx.font = '12px monospace'
      ctx.fillText(e.text, 4, CANVAS_H - 60 - i * 16)
    }
  }

  private drawOutcome(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    const isVic = this.phase === 'victory'
    ctx.fillStyle = isVic ? '#ffdd44' : '#ff4444'
    ctx.font = 'bold 48px serif'
    ctx.textAlign = 'center'
    ctx.fillText(isVic ? '勝利！' : '敗北...', CANVAS_W / 2, CANVAS_H / 2 - 20)
    ctx.fillStyle = '#ccc'
    ctx.font = '16px sans-serif'
    if (isVic) {
      const hasNext = this.stageIndex + 1 < STAGE_CONFIGS.length
      ctx.fillText(hasNext ? 'Enter: 下一章  S: 存檔' : 'Enter: 標題畫面  S: 存檔', CANVAS_W / 2, CANVAS_H / 2 + 30)
    } else {
      ctx.fillText('Enter: 標題畫面', CANVAS_W / 2, CANVAS_H / 2 + 30)
    }
  }

  // ── Input ────────────────────────────────────────────────────────────────────

  onKey(e: KeyboardEvent) {
    // Save any time
    if (e.key === 's' || e.key === 'S') { this.save(); return }

    if (this.phase === 'victory') { this.handleVictoryKey(e); return }
    if (this.phase === 'defeat')  { if (e.key === 'Enter') this.game.switchScene('title'); return }
    if (this.phase === 'enemy') return

    if (this.sub === 'actionMenu')    { this.handleMenuKey(e); return }
    if (this.sub === 'spellMenu')     { this.handleSpellMenuKey(e); return }
    if (this.sub === 'targeting')     { this.handleTargetKey(e); return }
    if (this.sub === 'spellTargeting') { this.handleSpellTargetKey(e); return }

    const dirs: Record<string, [number, number]> = {
      ArrowUp: [0, -1], ArrowDown: [0, 1],
      ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    }
    if (dirs[e.key]) {
      const [dx, dy] = dirs[e.key]
      this.cursor.x = Math.max(0, Math.min(COLS - 1, this.cursor.x + dx))
      this.cursor.y = Math.max(0, Math.min(ROWS - 1, this.cursor.y + dy))
      return
    }
    if (e.key === 'Enter' || e.key === ' ') { this.handleSelect(); return }
    if (e.key === 'e' || e.key === 'E') { this.endPlayerTurn(); return }
    if (e.key === 'Escape') { this.cancelSelection(); return }
  }

  private handleVictoryKey(e: KeyboardEvent) {
    if (e.key === 's' || e.key === 'S') { this.save(); return }
    if (e.key === 'Enter') {
      const nextStage = this.stageIndex + 1
      if (nextStage < STAGE_CONFIGS.length) {
        const players = this.units.filter(u => u.isPlayer)
        this.game.switchSceneMap(nextStage, players)
      } else {
        this.game.switchScene('title')
      }
    }
  }

  private handleMenuKey(e: KeyboardEvent) {
    if (e.key === 'ArrowUp')   this.menuIndex = (this.menuIndex - 1 + this.menuItems.length) % this.menuItems.length
    if (e.key === 'ArrowDown') this.menuIndex = (this.menuIndex + 1) % this.menuItems.length
    if (e.key === 'Enter' || e.key === ' ') this.confirmMenuAction()
    if (e.key === 'Escape') this.cancelSelection()
  }

  private handleSpellMenuKey(e: KeyboardEvent) {
    if (e.key === 'ArrowUp')   this.spellIndex = (this.spellIndex - 1 + this.spellList.length) % this.spellList.length
    if (e.key === 'ArrowDown') this.spellIndex = (this.spellIndex + 1) % this.spellList.length
    if (e.key === 'Enter' || e.key === ' ') this.confirmSpellSelect()
    if (e.key === 'Escape') { this.sub = 'actionMenu' }
  }

  private handleTargetKey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      this.targetIndex = (this.targetIndex - 1 + this.attackTargets.length) % this.attackTargets.length
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown')
      this.targetIndex = (this.targetIndex + 1) % this.attackTargets.length
    if (e.key === 'Enter' || e.key === ' ')
      this.executeAttack(this.selected!, this.attackTargets[this.targetIndex])
    if (e.key === 'Escape') this.sub = 'actionMenu'
  }

  private handleSpellTargetKey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      this.spellTargetIndex = (this.spellTargetIndex - 1 + this.spellTargets.length) % this.spellTargets.length
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown')
      this.spellTargetIndex = (this.spellTargetIndex + 1) % this.spellTargets.length
    if (e.key === 'Enter' || e.key === ' ')
      this.executeSpell(this.selected!, this.spellList[this.spellIndex], this.spellTargets[this.spellTargetIndex])
    if (e.key === 'Escape') this.sub = 'spellMenu'
  }

  private handleSelect() {
    const unit = this.unitAt(this.cursor.x, this.cursor.y)
    if (this.sub === 'free') {
      if (unit?.isPlayer && !unit.moved) {
        this.selected = unit
        this.reachable = this.calcReachable(unit)
        this.sub = 'moving'
      }
      return
    }
    if (this.sub === 'moving') {
      const key = `${this.cursor.x},${this.cursor.y}`
      if (this.reachable.has(key) && !this.unitAt(this.cursor.x, this.cursor.y)) {
        this.selected!.x = this.cursor.x
        this.selected!.y = this.cursor.y
        this.selected!.moved = true
        this.openActionMenu()
      } else if (unit?.isPlayer && unit !== this.selected && !unit.moved) {
        this.selected = unit
        this.reachable = this.calcReachable(unit)
      }
    }
  }

  private openActionMenu() {
    const unit = this.selected!
    const enemies = this.getAdjacentTo(unit, false)
    const hasSpells = unit.spells.length > 0 && unit.mp > 0
    this.menuItems = []
    if (enemies.length > 0) this.menuItems.push('Attack')
    if (hasSpells) this.menuItems.push('Magic')
    this.menuItems.push('Wait')
    this.menuIndex = 0
    this.sub = 'actionMenu'
  }

  private confirmMenuAction() {
    const action = this.menuItems[this.menuIndex]
    if (action === 'Wait') {
      this.selected!.acted = true
      this.finishUnitTurn()
    } else if (action === 'Attack') {
      this.attackTargets = this.getAdjacentTo(this.selected!, false)
      this.targetIndex = 0
      this.sub = 'targeting'
    } else if (action === 'Magic') {
      this.openSpellMenu()
    }
  }

  private openSpellMenu() {
    const unit = this.selected!
    this.spellList = unit.spells
      .map(id => this.game.data.spells.find(s => s.id === id))
      .filter((s): s is SpellData => s !== undefined)
    this.spellIndex = 0
    this.sub = 'spellMenu'
  }

  private confirmSpellSelect() {
    const spell = this.spellList[this.spellIndex]
    if (!spell) return
    if (this.selected!.mp < spell.mp_cost) {
      this.addLog('Not enough MP!')
      return
    }
    // Build range set and targets
    this.spellRange = this.calcSpellRange(this.selected!, spell.range)
    this.spellTargets = this.units.filter(u =>
      !u.isPlayer && this.spellRange.has(`${u.x},${u.y}`)
    )
    if (this.spellTargets.length === 0) {
      this.addLog('No targets in range!')
      return
    }
    this.spellTargetIndex = 0
    this.sub = 'spellTargeting'
  }

  private executeAttack(attacker: Unit, defender: Unit) {
    const hit = calcHitChance(attacker, defender)
    if (Math.random() * 100 >= hit) {
      this.addLog(`${attacker.name} → ${defender.name}: MISS!`)
    } else {
      const dmg = calcDamage(attacker, defender)
      defender.hp = Math.max(0, defender.hp - dmg)
      this.addLog(`${attacker.name} → ${defender.name}: ${dmg} dmg! (${defender.hp}/${defender.maxHp})`)
      if (defender.hp <= 0) this.handleKill(attacker, defender)
    }
    attacker.acted = true
    this.finishUnitTurn()
    this.checkOutcome()
  }

  private executeSpell(caster: Unit, spell: SpellData, target: Unit) {
    if (this.game.mods.noMpCost) {
      // skip MP deduction
    } else {
      caster.mp = Math.max(0, caster.mp - spell.mp_cost)
    }
    const hit = calcSpellHit(spell, target)
    if (Math.random() * 100 >= hit) {
      this.addLog(`${caster.name} 詠唱 ${spell.name} → ${target.name}: MISS!`)
    } else {
      const dmg = calcSpellDamage(spell, target)
      target.hp = Math.max(0, target.hp - dmg)
      this.addLog(`${caster.name} ${spell.name} → ${target.name}: ${dmg} dmg!`)
      if (target.hp <= 0) this.handleKill(caster, target)
    }
    caster.acted = true
    this.spellRange.clear()
    this.finishUnitTurn()
    this.checkOutcome()
  }

  private handleKill(attacker: Unit, victim: Unit) {
    this.units = this.units.filter(u => u !== victim)
    this.addLog(`${victim.name} 倒下！`)
    if (attacker.isPlayer) {
      const xp = Math.floor(xpForKill(victim) * this.game.mods.expMultiplier)
      attacker.xp += xp
      this.addLog(`${attacker.name} +${xp} XP`)
      while (attacker.xp >= xpToNextLevel(attacker.level)) {
        const msg = applyLevelUp(attacker, this.game.data)
        this.addLog(msg)
      }
    }
  }

  private finishUnitTurn() {
    this.selected = null
    this.reachable.clear()
    this.attackTargets = []
    this.spellTargets = []
    this.spellRange.clear()
    this.sub = 'free'
  }

  private cancelSelection() {
    if (this.sub === 'spellTargeting') { this.sub = 'spellMenu'; return }
    if (this.sub === 'targeting')      { this.sub = 'actionMenu'; return }
    if (this.sub === 'spellMenu')      { this.sub = 'actionMenu'; return }
    if (this.sub === 'actionMenu') {
      // Undo move
      if (this.selected) {
        this.selected.moved = false
        this.reachable = this.calcReachable(this.selected)
        this.sub = 'moving'
        return
      }
    }
    this.selected = null
    this.reachable.clear()
    this.sub = 'free'
  }

  private checkOutcome() {
    const players = this.units.filter(u => u.isPlayer)
    const enemies = this.units.filter(u => !u.isPlayer)
    // Lord death = immediate defeat
    const lordAlive = players.some(u => u.charId === this.lordId)
    if (!lordAlive && players.length > 0) {
      this.phase = 'defeat'
      this.showTurnBanner('索爾陣亡！敗北...')
      return
    }
    if (enemies.length === 0) {
      this.phase = 'victory'
      this.showTurnBanner('勝利！')
    } else if (players.length === 0) {
      this.phase = 'defeat'
      this.showTurnBanner('敗北...')
    }
  }

  // ── Turn flow ────────────────────────────────────────────────────────────────

  private endPlayerTurn() {
    if (this.sub !== 'free') return
    for (const u of this.units) { u.moved = false; u.acted = false }
    this.phase = 'enemy'
    this.showTurnBanner('敵方行動')
    setTimeout(() => this.runEnemyTurn(), 1500)
  }

  private runEnemyTurn() {
    const players = this.units.filter(u => u.isPlayer)
    for (const enemy of this.units.filter(u => !u.isPlayer)) {
      if (!players.length) break
      const target = players.reduce((a, b) =>
        this.dist(a, enemy) < this.dist(b, enemy) ? a : b
      )
      // Move toward target
      const dx = Math.sign(target.x - enemy.x)
      const dy = Math.sign(target.y - enemy.y)
      const nx = enemy.x + dx
      const ny = enemy.y + dy
      if (!this.unitAt(nx, ny) && nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS) {
        enemy.x = nx; enemy.y = ny
      }
      // Attack adjacent player
      const adj = this.getAdjacentTo(enemy, true)
      if (adj.length) {
        const p = adj[0]
        const hit = calcHitChance(enemy, p)
        if (Math.random() * 100 < hit) {
          const dmg = calcDamage(enemy, p)
          p.hp = Math.max(0, p.hp - dmg)
          this.addLog(`${enemy.name} → ${p.name}: ${dmg} dmg!`)
          if (p.hp <= 0) {
            this.units = this.units.filter(u => u !== p)
            this.addLog(`${p.name} 倒下！`)
          }
        } else {
          this.addLog(`${enemy.name} → ${p.name}: MISS`)
        }
      }
    }
    this.checkOutcome()
    if (this.phase !== 'defeat') {
      this.phase = 'player'
      this.showTurnBanner('我方行動')
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private showTurnBanner(msg: string) {
    this.turnMessage = msg
    this.turnMsgTimer = 1.5
  }

  private dist(a: { x: number; y: number }, b: { x: number; y: number }) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
  }

  private getAdjacentTo(unit: Unit, wantPlayers: boolean): Unit[] {
    return this.units.filter(u => u.isPlayer === wantPlayers && this.dist(u, unit) === 1)
  }

  private calcReachable(unit: Unit): Set<string> {
    const result = new Set<string>()
    const queue: Array<{ x: number; y: number; rem: number }> = [
      { x: unit.x, y: unit.y, rem: unit.mv }
    ]
    const visited = new Map<string, number>()
    while (queue.length) {
      const { x, y, rem } = queue.shift()!
      const key = `${x},${y}`
      if ((visited.get(key) ?? -1) >= rem) continue
      visited.set(key, rem)
      result.add(key)
      if (rem === 0) continue
      for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue
        const tile = this.map[ny][nx]
        const cost = tile === Tile.WATER ? 999 : tile === Tile.MOUNTAIN ? 2 : 1
        if (rem - cost < 0) continue
        queue.push({ x: nx, y: ny, rem: rem - cost })
      }
    }
    result.delete(`${unit.x},${unit.y}`)
    return result
  }

  private calcSpellRange(caster: Unit, range: number): Set<string> {
    const result = new Set<string>()
    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= range) {
          const nx = caster.x + dx, ny = caster.y + dy
          if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS) {
            result.add(`${nx},${ny}`)
          }
        }
      }
    }
    result.delete(`${caster.x},${caster.y}`)
    return result
  }

  private addLog(text: string) {
    this.log.unshift({ text, timer: 3.5 })
    if (this.log.length > 5) this.log.length = 5
  }

  private unitAt(x: number, y: number): Unit | undefined {
    return this.units.find(u => u.x === x && u.y === y)
  }
}
