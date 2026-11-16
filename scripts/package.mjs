// Packages the built extension as a zip anyone can install with Chrome's "Load unpacked", for attaching to
// a GitHub release. `npm run package` builds, then runs this. Output: release/speakeasy-<version>.zip
//
// The zip holds one folder named "SpeakEasy" (no version in the name). Chrome ties an unpacked extension's
// identity, and with it the saved API key and settings, to the folder's location, so users update by
// replacing that folder's contents in place. The install guide inside the zip explains this.
import { cpSync, existsSync, readFileSync, rmSync, mkdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const dist = 'dist'
const outDir = 'release'
const folder = 'SpeakEasy'

if (!existsSync(`${dist}/manifest.json`)) throw new Error('No dist/ build found: run `npm run build` first.')
const { version } = JSON.parse(readFileSync(`${dist}/manifest.json`, 'utf8'))
const zipName = `speakeasy-${version}.zip`

rmSync(outDir, { recursive: true, force: true })
mkdirSync(`${outDir}/${folder}`, { recursive: true })

// Vite's build metadata (dist/.vite) and Finder litter aren't part of the extension
cpSync(dist, `${outDir}/${folder}`, {
  recursive: true,
  filter: src => !/(^|\/)(\.vite|\.DS_Store)(\/|$)/.test(src),
})
cpSync('scripts/install-guide.txt', `${outDir}/${folder}/HOW TO INSTALL.txt`)

// -X leaves out macOS extended attributes, so the zip has no __MACOSX folder
execFileSync('zip', ['-r', '-X', '-q', zipName, folder], { cwd: outDir })

const kb = Math.round(statSync(`${outDir}/${zipName}`).size / 1024)
console.log(`Packaged ${outDir}/${zipName} (${kb} KB), SpeakEasy ${version}`)
