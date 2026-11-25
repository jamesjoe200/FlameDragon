import { loadGameData } from './DataLoader'
import { TitleScene } from '../scenes/TitleScene'
import { MapScene } from '../scenes/MapScene'
import { SpriteLoader } from './SpriteLoader'
import type { GameData, SceneName, Unit } from '../types'
export { CANVAS_W, CANVAS_H, TILE_SIZE } from './constants'
import { CANVAS_W, CANVAS_H } from './constants'

export interface Scene {
  update(dt: number): void
  render(ctx: CanvasRenderingContext2D): void
  onKey(e: KeyboardEvent): void
}

export class Game {
  readonly canvas: HTMLCanvasElement
  readonly ctx: CanvasRenderingContext2D
  data!: GameData
  private scene!: Scene
  private lastTime = 0
  private rafId = 0

  sprites = new SpriteLoader()

  mods = {
    enemyMultiplier: 1,
    maxPartySize: 8,
    expMultiplier: 1,
    noMpCost: false,
    invincible: false,
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    canvas.width = CANVAS_W
    canvas.height = CANVAS_H
    this.ctx = canvas.getContext('2d')!
    window.addEventListener('keydown', (e) => this.scene?.onKey(e))
  }

  async start(): Promise<void> {
    this.showLoading('Initializing...')
    try {
      this.showLoading('Loading game data...')
      this.data = await loadGameData()
      this.showLoading('Loading sprites...')
      await this.sprites.load([1, 2, 3])
      this.showLoading(`Loaded OK — ${this.data.characters.length} chars, starting...`)
      await new Promise(r => setTimeout(r, 300))
      this.switchScene('title')
      this.loop(0)
    } catch (err) {
      this.showError(err instanceof Error ? err.message : String(err))
      throw err
    }
  }

  switchScene(name: SceneName) {
    switch (name) {
      case 'title': this.scene = new TitleScene(this); break
      case 'map':   this.scene = new MapScene(this, 0); break
      default: throw new Error(`Unknown scene: ${name}`)
    }
  }

  // Start a specific chapter, optionally carrying over saved player units
  switchSceneMap(stageIndex: number, savedUnits?: Unit[]) {
    this.scene = new MapScene(this, stageIndex, savedUnits)
  }

  private showError(msg: string) {
    this.ctx.fillStyle = '#1a0000'
    this.ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    this.ctx.fillStyle = '#ff4444'
    this.ctx.font = 'bold 15px monospace'
    this.ctx.textAlign = 'center'
    this.ctx.fillText('Error loading game', CANVAS_W / 2, CANVAS_H / 2 - 30)
    this.ctx.fillStyle = '#ffaaaa'
    this.ctx.font = '12px monospace'
    const words = msg.split(' ')
    let line = ''
    let y = CANVAS_H / 2
    for (const w of words) {
      if ((line + w).length > 55) {
        this.ctx.fillText(line, CANVAS_W / 2, y)
        line = w + ' '; y += 18
      } else { line += w + ' ' }
    }
    if (line) this.ctx.fillText(line, CANVAS_W / 2, y)
  }

  private showLoading(msg = 'Loading...') {
    this.ctx.fillStyle = '#000'
    this.ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    this.ctx.fillStyle = '#ff6600'
    this.ctx.font = 'bold 20px serif'
    this.ctx.textAlign = 'center'
    this.ctx.fillText('炎龍騎士團 II', CANVAS_W / 2, CANVAS_H / 2 - 20)
    this.ctx.fillStyle = '#888'
    this.ctx.font = '14px sans-serif'
    this.ctx.fillText(msg, CANVAS_W / 2, CANVAS_H / 2 + 15)
  }

  private loop = (timestamp: number) => {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05)
    this.lastTime = timestamp
    this.scene.update(dt)
    this.ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
    this.scene.render(this.ctx)
    this.rafId = requestAnimationFrame(this.loop)
  }
}
