/**
 * Loads and caches the extracted sprite sheets from public/sprites/.
 * Icons: 1680 × 24x24 portraits arranged in a 20-column sheet.
 *   icon_idx = portrait_id * 12 + frame_idx  (portrait_id == charId)
 * Tiles: chapter-specific 24x24 terrain tiles in a 16-column sheet.
 */

export const ICON_W = 24
export const ICON_H = 24
export const ICON_COLS = 20

export const TILE_W = 24
export const TILE_H = 24
export const TILE_COLS = 16

export class SpriteLoader {
  private iconSheet: HTMLImageElement | null = null
  private tileSheets: Map<number, HTMLImageElement> = new Map()
  private ready = false

  async load(chapters: number[] = [1, 2, 3]): Promise<void> {
    const loads: Promise<void>[] = []

    loads.push(this.loadImage('/sprites/icons_sheet.png').then(img => {
      this.iconSheet = img
    }))

    for (const ch of chapters) {
      loads.push(this.loadImage(`/sprites/tiles/ch${ch}_sheet.png`).then(img => {
        this.tileSheets.set(ch, img)
      }))
    }

    await Promise.all(loads)
    this.ready = true
  }

  get isReady() { return this.ready }

  /** Draw a 24×24 portrait icon for a character.
   *  portrait_id == charId (0-based); frame 0 = standing idle. */
  drawIcon(
    ctx: CanvasRenderingContext2D,
    charId: number,
    frame: number,
    dx: number,
    dy: number,
    scale = 1
  ): void {
    if (!this.iconSheet) return
    const idx = charId * 12 + (frame % 12)
    const col = idx % ICON_COLS
    const row = Math.floor(idx / ICON_COLS)
    ctx.drawImage(
      this.iconSheet,
      col * ICON_W, row * ICON_H, ICON_W, ICON_H,
      dx, dy, ICON_W * scale, ICON_H * scale
    )
  }

  /** Draw a 24×24 terrain tile from the chapter tile sheet. */
  drawTile(
    ctx: CanvasRenderingContext2D,
    chapter: number,
    tileIdx: number,
    dx: number,
    dy: number
  ): void {
    const sheet = this.tileSheets.get(chapter)
    if (!sheet) return
    const col = tileIdx % TILE_COLS
    const row = Math.floor(tileIdx / TILE_COLS)
    ctx.drawImage(
      sheet,
      col * TILE_W, row * TILE_H, TILE_W, TILE_H,
      dx, dy, TILE_W, TILE_H
    )
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => {
        console.warn(`SpriteLoader: failed to load ${src}`)
        resolve(img)  // resolve anyway so Promise.all doesn't block
      }
      img.src = src
    })
  }
}
