// Builds the demo and folds it into one self-contained file: preview.html
// Usage: npm run preview:html
// Replacements use functions so `$` sequences inside the bundle are left alone.
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

execSync('npx vite build --mode demo', { stdio: 'inherit' })
const dir = 'dist-demo'
let html = readFileSync(join(dir, 'index.html'), 'utf8')
const assets = readdirSync(join(dir, 'assets'))
const css = assets.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(dir, 'assets', f), 'utf8')).join('\n')
const js = assets.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(dir, 'assets', f), 'utf8')).join('\n')
const favicon = 'data:image/png;base64,' + readFileSync('public/favicon.png').toString('base64')

html = html
  .replace(/<link rel="stylesheet"[^>]*>/g, '')
  .replace(/<script type="module"[^>]*><\/script>/g, '')
  .replace(/<link rel="manifest"[^>]*>\s*/g, '')
  .replace(/<link rel="apple-touch-icon"[^>]*>\s*/g, '')
  .replace(/<link rel="icon"[^>]*>/, () => `<link rel="icon" type="image/png" href="${favicon}" />`)
  .replace('<title>Habesha Outlet Survey</title>', '<title>Habesha Outlet Survey (preview)</title>')
  .replace('</head>', () => `<style>${css}</style>\n</head>`)
  .replace('</body>', () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>\n</body>`)

writeFileSync('preview.html', html)
console.log(`preview.html written, ${(html.length / 1024).toFixed(0)} KB`)
