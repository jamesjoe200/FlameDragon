import { Game } from './game/engine/Game'
import { Editor } from './editor/Editor'

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
const editorPanel = document.getElementById('editor-panel') as HTMLDivElement
const editorToggle = document.getElementById('editor-toggle') as HTMLButtonElement

const game = new Game(canvas)
const editor = new Editor(editorPanel, game)

editorToggle.addEventListener('click', () => {
  editorPanel.classList.toggle('open')
  editor.render()
})

game.start().catch((err: unknown) => {
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#ff4444'
  ctx.font = 'bold 16px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('Failed to load game data', canvas.width / 2, canvas.height / 2 - 20)
  ctx.fillStyle = '#aaa'
  ctx.font = '12px monospace'
  const msg = err instanceof Error ? err.message : String(err)
  ctx.fillText(msg, canvas.width / 2, canvas.height / 2 + 10)
  console.error('Game start failed:', err)
})
