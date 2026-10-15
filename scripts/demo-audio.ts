// Pre-generates the narration the demo page plays, with SpeakEasy's own summary and narration code, so the
// demo sounds exactly like the extension. Four TL;DR clips cost about 25 cents of OpenAI credit per run.
// Usage: put OPENAI_API_KEY=sk-... in .env (as for the reading test), then `npm run demo:audio`.
// Output: demo/audio/<article>-<mode>-<voice>-<style>.m4a and demo/audio/manifest.json (summaries + durations).
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { summarize } from '../src/lib/openai'
import { narrate, MIN_MATCH_SCORE } from '../src/lib/narration'
import { PlaybackMode, SpeakingStyle, VoiceOption } from '../src/lib/types'

type Clip = { article: string; mode: PlaybackMode; voice: VoiceOption; style: SpeakingStyle }

// The combinations the demo page can play; everything else shows a "demo only" message in the panel
const CLIPS: Clip[] = [
  { article: 'night-trains', mode: 'tldr', voice: 'marin', style: 'Neutral' },
  { article: 'night-trains', mode: 'tldr', voice: 'cedar', style: 'Neutral' },
  { article: 'night-trains', mode: 'tldr', voice: 'cedar', style: 'Storytelling' },
  { article: 'repair', mode: 'tldr', voice: 'marin', style: 'Neutral' },
]
const OUT_DIR = 'demo/audio'

function getApiKey(): string {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY
  if (existsSync('.env')) {
    const match = readFileSync('.env', 'utf8').match(/^OPENAI_API_KEY\s*=\s*["']?([^"'\s]+)/m)
    if (match) return match[1]
  }
  throw new Error('Set OPENAI_API_KEY in the environment or in a .env file in the project folder.')
}

// demo/articles.js assigns window.DEMO_ARTICLES; evaluate it with a stand-in window
function loadArticles(): { id: string; title: string; body: string[] }[] {
  const w: { DEMO_ARTICLES?: { id: string; title: string; body: string[] }[] } = {}
  new Function('window', readFileSync('demo/articles.js', 'utf8'))(w)
  return w.DEMO_ARTICLES || []
}

async function main() {
  const apiKey = getApiKey()
  const articles = loadArticles()
  mkdirSync(OUT_DIR, { recursive: true })

  // Resumable: summaries and clips already in the manifest are kept, so a failed run only redoes what is missing
  type Done = Clip & { file: string; durationSec: number; words: number; lowestMatch: number }
  const previous = existsSync(`${OUT_DIR}/manifest.json`)
    ? JSON.parse(readFileSync(`${OUT_DIR}/manifest.json`, 'utf8')) as { summaries?: Record<string, Partial<Record<PlaybackMode, string>>>; clips?: Done[] }
    : {}
  const summaries: Record<string, Partial<Record<PlaybackMode, string>>> = previous.summaries || {}
  const done: Done[] = []
  const writeManifest = () =>
    writeFileSync(`${OUT_DIR}/manifest.json`, JSON.stringify({ generatedAt: new Date().toISOString(), summaries, clips: done }, null, 2) + '\n')

  for (const clip of CLIPS) {
    const article = articles.find(a => a.id === clip.article)
    if (!article) throw new Error(`No demo article "${clip.article}"`)
    const bodyText = article.body.join('\n\n')

    summaries[clip.article] ??= {}
    if (!summaries[clip.article][clip.mode]) {
      console.log(`Summarizing ${clip.article} (${clip.mode})...`)
      summaries[clip.article][clip.mode] = await summarize(apiKey, bodyText, clip.mode)
    }
    const text = summaries[clip.article][clip.mode]!

    const base = `${OUT_DIR}/${clip.article}-${clip.mode}-${clip.voice}-${clip.style.toLowerCase()}`
    const kept = previous.clips?.find(c => c.article === clip.article && c.mode === clip.mode && c.voice === clip.voice && c.style === clip.style)
    if (kept && existsSync(`${OUT_DIR}/${kept.file}`)) {
      console.log(`Keeping ${kept.file}`)
      done.push(kept)
      continue
    }

    console.log(`Narrating ${clip.article} ${clip.mode} in ${clip.voice} / ${clip.style}...`)
    const started = Date.now()
    const { audio, segments } = await narrate(apiKey, text, clip.voice, clip.style)
    const durationSec = (audio.size - 44) / 48000

    writeFileSync(`${base}.wav`, Buffer.from(await audio.arrayBuffer()))
    // AAC in an .m4a keeps the repo small (a 2-minute WAV is 5.8 MB); the <audio> element plays it as a blob
    execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '64000', `${base}.wav`, `${base}.m4a`])
    rmSync(`${base}.wav`)

    const lowestMatch = Math.min(...segments.map(s => s.score))
    done.push({ ...clip, file: `${base.slice(OUT_DIR.length + 1)}.m4a`, durationSec: +durationSec.toFixed(1), words: text.split(/\s+/).length, lowestMatch: +lowestMatch.toFixed(3) })
    writeManifest()
    console.log(`  ${durationSec.toFixed(0)}s of audio in ${((Date.now() - started) / 1000).toFixed(0)}s, lowest segment match ${lowestMatch.toFixed(3)}${lowestMatch < MIN_MATCH_SCORE ? ' (below threshold)' : ''}`)
  }

  writeManifest()
  console.table(done.map(({ article, mode, voice, style, durationSec, words, lowestMatch }) => ({ article, mode, voice, style, 'audio s': durationSec, words, 'lowest match': lowestMatch })))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
