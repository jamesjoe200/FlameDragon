import type { Game, Scene } from '../engine/Game'
import { CANVAS_W, CANVAS_H } from '../engine/Game'

export class TitleScene implements Scene {
  private blink = 0
  private showPress = true

  constructor(private game: Game) {}

  update(dt: number) {
    this.blink += dt
    if (this.blink > 0.6) { this.blink = 0; this.showPress = !this.showPress }
  }

  render(ctx: CanvasRenderingContext2D) {
    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
    grad.addColorStop(0, '#1a0000')
    grad.addColorStop(1, '#000820')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    // Title
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ff6600'
    ctx.font = 'bold 42px serif'
    ctx.fillText('炎龍騎士團 II', CANVAS_W / 2, 160)

    ctx.fillStyle = '#ffaa44'
    ctx.font = '20px serif'
    ctx.fillText('Flame Dragon Knights II', CANVAS_W / 2, 200)

    ctx.fillStyle = '#888'
    ctx.font = '13px sans-serif'
    ctx.fillText('Web Remake — Preserving the Original Experience', CANVAS_W / 2, 228)

    // Press key prompt
    if (this.showPress) {
      ctx.fillStyle = '#ffdd88'
      ctx.font = '16px sans-serif'
      ctx.fillText('Press ENTER to Start', CANVAS_W / 2, 320)
    }

    // Data summary
    const d = this.game.data
    ctx.fillStyle = '#446'
    ctx.font = '11px monospace'
    ctx.fillText(
      `${d.characters.length} characters · ${d.enemies.length} enemies · ${d.items.length} items · ${d.spells.length} spells`,
      CANVAS_W / 2, CANVAS_H - 20
    )
  }

  onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      this.game.switchScene('map')
    }
  }
}
