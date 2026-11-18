import { loadGameData } from './DataLoader'
import { TitleScene } from '../scenes/TitleScene'
import { MapScene } from '../scenes/MapScene'
import type { GameData, SceneName } from '../types'

export const CANVAS_W = 640
export const CANVAS_H = 480
export const TILE_SIZE = 32

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private rafId = 0

  // Mod flags (toggled by Editor)
  mods = {
    enemyMultiplier: 1,       // 1x = original, 2x = double enemies per stage
    maxPartySize: 8,          // original cap
    expMultiplier: 1,         // 1x = normal XP gain
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

  async start() {
    this.data = await loadGameData()
    this.switchScene('title')
    this.loop(0)
  }

  switchScene(name: SceneName) {
    switch (name) {
      case 'title':  this.scene = new TitleScene(this); break
      case 'map':    this.scene = new MapScene(this); break
      default: throw new Error(`Unknown scene: ${name}`)
    }
  }

  private loop = (timestamp: number) => {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05)
    this.lastTime = timestamp
    this.update(dt)
    this.render()
    this.rafId = requestAnimationFrame(this.loop)
  }

  private update(dt: number) { this.scene.update(dt) }

  private render() {
    this.ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
    this.scene.render(this.ctx)
  }
}
