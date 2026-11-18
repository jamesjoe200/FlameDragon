import type { Game, Scene } from '../engine/Game'
import { CANVAS_W, CANVAS_H } from '../engine/constants'
import { MapScene } from './MapScene'

export class TitleScene implements Scene {
  private blink = 0
  private showPress = true
  private hasSave = MapScene.hasSave()
  private menuIndex = 0  // 0 = Continue (if save), else New Game

  constructor(private game: Game) {}

  update(dt: number) {
    this.blink += dt
    if (this.blink > 0.6) { this.blink = 0; this.showPress = !this.showPress }
  }

  render(ctx: CanvasRenderingContext2D) {
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
    grad.addColorStop(0, '#1a0000')
    grad.addColorStop(1, '#000820')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    ctx.textAlign = 'center'
    ctx.fillStyle = '#ff6600'
    ctx.font = 'bold 42px serif'
    ctx.fillText('炎龍騎士團 II', CANVAS_W / 2, 150)

    ctx.fillStyle = '#ffaa44'
    ctx.font = '20px serif'
    ctx.fillText('Flame Dragon Knights II', CANVAS_W / 2, 190)

    ctx.fillStyle = '#888'
    ctx.font = '13px sans-serif'
    ctx.fillText('Web Remake — Preserving the Original Experience', CANVAS_W / 2, 218)

    // Menu
    const menuOptions = this.hasSave
      ? ['Continue', 'New Game']
      : ['New Game']

    for (let i = 0; i < menuOptions.length; i++) {
      const sel = i === this.menuIndex
      ctx.fillStyle = sel ? '#ffdd88' : '#888'
      ctx.font = sel ? 'bold 18px sans-serif' : '16px sans-serif'
      ctx.fillText((sel ? '► ' : '  ') + menuOptions[i], CANVAS_W / 2, 290 + i * 32)
    }

    if (this.showPress) {
      ctx.fillStyle = '#555'
      ctx.font = '12px sans-serif'
      ctx.fillText('Arrow keys to select · Enter to confirm', CANVAS_W / 2, 380)
    }

    const d = this.game.data
    ctx.fillStyle = '#334'
    ctx.font = '11px monospace'
    ctx.fillText(
      `${d.characters.length} characters · ${d.enemies.length} enemies · ${d.items.length} items · ${d.spells.length} spells`,
      CANVAS_W / 2, CANVAS_H - 20
    )
  }

  onKey(e: KeyboardEvent) {
    const opts = this.hasSave ? 2 : 1
    if (e.key === 'ArrowUp')   this.menuIndex = (this.menuIndex - 1 + opts) % opts
    if (e.key === 'ArrowDown') this.menuIndex = (this.menuIndex + 1) % opts
    if (e.key === 'Enter' || e.key === ' ') {
      const isContinue = this.hasSave && this.menuIndex === 0
      if (isContinue) {
        const save = MapScene.loadSave()
        if (save) {
          this.game.switchSceneMap(save.stageIndex, save.units)
          return
        }
      }
      // New Game
      MapScene.clearSave()
      this.game.switchSceneMap(0)
    }
  }
}
