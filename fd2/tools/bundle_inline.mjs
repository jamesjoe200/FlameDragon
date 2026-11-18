/**
 * Creates a fully self-contained single HTML file:
 * - Inlines the game JS bundle
 * - Inlines all JSON data as a JS variable (no fetch needed)
 * - No external script or fetch requests
 * Open dist/fd2_standalone.html directly in a browser — no server needed.
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const distDir = resolve(__dir, '../dist')
const dataDir = resolve(__dir, '../dist/data')
const outPath = resolve(distDir, 'fd2_standalone.html')

// Read and inline game JS
const jsPath = resolve(distDir, 'assets/game.js')
const jsCode = readFileSync(jsPath, 'utf8')

// Read all JSON data files and bundle into one object
const dataFiles = readdirSync(dataDir).filter(f => f.endsWith('.json'))
const gameData = {}
for (const f of dataFiles) {
  const key = f.replace('.json', '')
  gameData[key] = JSON.parse(readFileSync(resolve(dataDir, f), 'utf8'))
}

// Read the CSS from index.html
const indexHtml = readFileSync(resolve(distDir, 'index.html'), 'utf8')
const cssMatch = indexHtml.match(/<style>([\s\S]*?)<\/style>/)
const css = cssMatch ? cssMatch[1] : ''

// Patch the JS to intercept fetch('/data/...') with inline data
const patchedJs = `
// Inline game data — no fetch needed
window.__FD2_DATA__ = ${JSON.stringify(gameData)};

// Patch fetch to return inline data for /data/*.json
const _origFetch = window.fetch.bind(window);
window.fetch = function(url, opts) {
  if (typeof url === 'string' && url.startsWith('/data/')) {
    const key = url.replace('/data/', '').replace('.json', '');
    if (window.__FD2_DATA__[key]) {
      const data = window.__FD2_DATA__[key];
      return Promise.resolve(new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }));
    }
  }
  return _origFetch(url, opts);
};

${jsCode}
`

const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>炎龍騎士團 II — Flame Dragon Knights II</title>
  <style>${css}</style>
</head>
<body>
  <div id="app">
    <canvas id="game-canvas"></canvas>
    <button id="editor-toggle">⚙ Editor</button>
    <div id="editor-panel"></div>
  </div>
  <script>
${patchedJs}
  </script>
</body>
</html>`

writeFileSync(outPath, html, 'utf8')
console.log(`Standalone HTML written to: ${outPath}`)
console.log(`File size: ${(html.length / 1024).toFixed(1)} KB`)
