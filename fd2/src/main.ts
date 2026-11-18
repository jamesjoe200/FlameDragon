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

game.start()
