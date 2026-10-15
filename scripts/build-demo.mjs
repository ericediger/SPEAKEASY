// Copies the built side panel and settings page from dist/ into demo/app/, so the demo page (and the
// explainer recorder, which films it) runs the real, current build. `npm run demo` builds, then runs this.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

const dist = 'dist'
const out = 'demo/app'
if (!existsSync(`${dist}/src/popup/popup.html`)) throw new Error('No dist/ build found: run `npm run build` first.')

rmSync(out, { recursive: true, force: true })
mkdirSync(`${out}/assets`, { recursive: true })

// The two pages name their entry chunks and stylesheets; the chunks name the chunks they import
const wanted = new Set()
for (const [name, src] of [['popup', 'src/popup/popup.html'], ['options', 'src/options/options.html']]) {
  const html = readFileSync(`${dist}/${src}`, 'utf8')
  for (const m of html.matchAll(/\/assets\/([\w.-]+)/g)) wanted.add(m[1])
  writeFileSync(`${out}/${name}.html`, html)
}
let grew = true
while (grew) {
  grew = false
  for (const f of [...wanted]) {
    if (!f.endsWith('.js')) continue
    const js = readFileSync(`${dist}/assets/${f}`, 'utf8')
    for (const m of js.matchAll(/["']\.\/([\w.-]+\.js)["']/g)) {
      if (!wanted.has(m[1])) { wanted.add(m[1]); grew = true }
    }
  }
}
for (const f of wanted) cpSync(`${dist}/assets/${f}`, `${out}/assets/${f}`)
cpSync(`${dist}/icons`, `${out}/icons`, { recursive: true })
writeFileSync(`${out}/README.md`, 'Built copy of the side panel and settings page for the demo page (demo/index.html). Regenerate with `npm run demo` after changing the extension; do not edit by hand.\n')
console.log(`demo/app: ${wanted.size} assets + icons copied from dist/`)
