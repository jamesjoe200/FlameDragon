/**
 * Post-build script: replaces <script type="module"> with <script defer>
 * in dist/index.html so the bundle loads under strict enterprise CSPs
 * that block ES module scripts.
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const htmlPath = resolve(__dir, '../dist/index.html')

let html = readFileSync(htmlPath, 'utf8')
html = html.replace(/<script type="module" crossorigin/g, '<script defer')
html = html.replace(/<script type="module"/g, '<script defer')
writeFileSync(htmlPath, html, 'utf8')
console.log('postbuild: replaced type="module" with defer in dist/index.html')
