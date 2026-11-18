import type { Game, Scene } from '../engine/Game'
import { CANVAS_W, CANVAS_H, TILE_SIZE } from '../engine/Game'
import type { Unit } from '../types'
import { buildUnitsForStage } from '../entities/UnitFactory'

const COLS = Math.floor(CANVAS_W / TILE_SIZE)  // 20
const ROWS = Math.floor(CANVAS_H / TILE_SIZE)  // 15

// Basic terrain tile types
const enum Tile { PLAIN = 0, FOREST = 1, MOUNTAIN = 2, WATER = 3, ROAD = 4 }

const TILE_COLORS: Record<number, string> = {
  [Tile.PLAIN]:    '#3a5a2a',
  [Tile.FOREST]:   '#1e4020',
  [Tile.MOUNTAIN]: '#6e6e5a',
  [Tile.WATER]:    '#1a3a6a',
  [Tile.ROAD]:     '#8a7a5a',
}

// Placeholder chapter 1 map (20x15 tiles)
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

export class MapScene implements Scene {
  private game: Game
  private map: number[][]
  private units: Unit[]
  private cursor = { x: 5, y: 7 }
  private selected: Unit | null = null
  private reachable: Set<string> = new Set()
  private phase: 'player' | 'enemy' = 'player'
  private turnMessage = ''
  private turnMsgTimer = 0

  constructor(game: Game) {
    this.game = game
    this.map = buildPlaceholderMap()
    this.units = buildUnitsForStage(0, game.data, game.mods)
  }

  update(dt: number) {
    if (this.turnMsgTimer > 0) this.turnMsgTimer -= dt
  }

  render(ctx: CanvasRenderingContext2D) {
    this.drawMap(ctx)
    this.drawReachable(ctx)
    this.drawUnits(ctx)
    this.drawCursor(ctx)
    this.drawHUD(ctx)
    if (this.turnMsgTimer > 0) this.drawTurnMessage(ctx)
  }

  private drawMap(ctx: CanvasRenderingContext2D) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        ctx.fillStyle = TILE_COLORS[this.map[r][c]] ?? '#3a5a2a'
        ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE)
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'
        ctx.strokeRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE)
      }
    }
  }

  private drawReachable(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'rgba(100,180,255,0.25)'
    for (const key of this.reachable) {
      const [x, y] = key.split(',').map(Number)
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
    }
  }

  private drawUnits(ctx: CanvasRenderingContext2D) {
    for (const u of this.units) {
      const px = u.x * TILE_SIZE
      const py = u.y * TILE_SIZE
      // Unit body
      ctx.fillStyle = u.isPlayer
        ? (u.moved ? '#446688' : '#4488cc')
        : '#cc4444'
      ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8)
      // Name initial
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 11px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(u.name[0], px + TILE_SIZE / 2, py + TILE_SIZE / 2 + 4)
      // HP bar
      const hpPct = u.hp / u.maxHp
      ctx.fillStyle = '#333'
      ctx.fillRect(px + 2, py + TILE_SIZE - 6, TILE_SIZE - 4, 4)
      ctx.fillStyle = hpPct > 0.5 ? '#44cc44' : hpPct > 0.25 ? '#cccc44' : '#cc4444'
      ctx.fillRect(px + 2, py + TILE_SIZE - 6, (TILE_SIZE - 4) * hpPct, 4)
    }
  }

  private drawCursor(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = '#ffdd00'
    ctx.lineWidth = 2
    ctx.strokeRect(
      this.cursor.x * TILE_SIZE + 1,
      this.cursor.y * TILE_SIZE + 1,
      TILE_SIZE - 2, TILE_SIZE - 2
    )
    ctx.lineWidth = 1
  }

  private drawHUD(ctx: CanvasRenderingContext2D) {
    // Phase indicator
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, 0, 160, 22)
    ctx.fillStyle = this.phase === 'player' ? '#88ddff' : '#ff8888'
    ctx.font = '13px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(this.phase === 'player' ? '► Player Phase' : '► Enemy Phase', 8, 15)

    // Unit info at cursor
    const unit = this.unitAt(this.cursor.x, this.cursor.y)
    if (unit) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)'
      ctx.fillRect(0, CANVAS_H - 48, 220, 48)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 13px sans-serif'
      ctx.fillText(unit.name, 8, CANVAS_H - 32)
      ctx.font = '11px monospace'
      ctx.fillStyle = '#aaa'
      ctx.fillText(`HP ${unit.hp}/${unit.maxHp}  MP ${unit.mp}/${unit.maxMp}  Lv${unit.level}`, 8, CANVAS_H - 16)
    }

    // Controls hint
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(CANVAS_W - 200, CANVAS_H - 20, 200, 20)
    ctx.fillStyle = '#888'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText('Arrow keys: move  Enter: select  E: end turn', CANVAS_W - 4, CANVAS_H - 6)
  }

  private drawTurnMessage(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    ctx.fillRect(CANVAS_W / 2 - 120, CANVAS_H / 2 - 20, 240, 40)
    ctx.fillStyle = '#ffdd88'
    ctx.font = 'bold 20px serif'
    ctx.textAlign = 'center'
    ctx.fillText(this.turnMessage, CANVAS_W / 2, CANVAS_H / 2 + 7)
  }

  onKey(e: KeyboardEvent) {
    const moves: Record<string, [number, number]> = {
      ArrowUp: [0, -1], ArrowDown: [0, 1],
      ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    }
    if (moves[e.key]) {
      const [dx, dy] = moves[e.key]
      this.cursor.x = Math.max(0, Math.min(COLS - 1, this.cursor.x + dx))
      this.cursor.y = Math.max(0, Math.min(ROWS - 1, this.cursor.y + dy))
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      this.handleSelect()
    }
    if (e.key === 'e' || e.key === 'E') {
      this.endPlayerTurn()
    }
    if (e.key === 'Escape') {
      this.selected = null
      this.reachable.clear()
    }
  }

  private handleSelect() {
    const unit = this.unitAt(this.cursor.x, this.cursor.y)
    if (!this.selected) {
      if (unit?.isPlayer && !unit.moved) {
        this.selected = unit
        this.reachable = this.calcReachable(unit)
      }
    } else {
      const key = `${this.cursor.x},${this.cursor.y}`
      if (this.reachable.has(key) && !this.unitAt(this.cursor.x, this.cursor.y)) {
        this.selected.x = this.cursor.x
        this.selected.y = this.cursor.y
        this.selected.moved = true
        this.selected = null
        this.reachable.clear()
      } else {
        this.selected = null
        this.reachable.clear()
      }
    }
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
        // Water impassable, mountain costs 2
        const cost = tile === Tile.WATER ? 999 : tile === Tile.MOUNTAIN ? 2 : 1
        if (rem - cost < 0) continue
        queue.push({ x: nx, y: ny, rem: rem - cost })
      }
    }
    result.delete(`${unit.x},${unit.y}`)
    return result
  }

  private endPlayerTurn() {
    for (const u of this.units) { u.moved = false; u.acted = false }
    this.phase = 'enemy'
    this.turnMessage = 'Enemy Phase'
    this.turnMsgTimer = 1.5
    // Simple AI: enemies move toward nearest player
    setTimeout(() => this.runEnemyTurn(), 1500)
  }

  private runEnemyTurn() {
    const players = this.units.filter(u => u.isPlayer)
    for (const e of this.units.filter(u => !u.isPlayer)) {
      if (!players.length) break
      const target = players.reduce((a, b) =>
        Math.abs(a.x - e.x) + Math.abs(a.y - e.y) <
        Math.abs(b.x - e.x) + Math.abs(b.y - e.y) ? a : b
      )
      const dx = Math.sign(target.x - e.x)
      const dy = Math.sign(target.y - e.y)
      const nx = e.x + dx, ny = e.y + dy
      if (!this.unitAt(nx, ny)) { e.x = nx; e.y = ny }
    }
    this.phase = 'player'
    this.turnMessage = 'Player Phase'
    this.turnMsgTimer = 1.5
  }

  private unitAt(x: number, y: number): Unit | undefined {
    return this.units.find(u => u.x === x && u.y === y)
  }
}
