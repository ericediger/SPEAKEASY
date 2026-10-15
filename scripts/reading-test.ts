// Reading test: narrates real articles with the extension's own summary and narration code and reports
// how closely the spoken words follow the text. Costs roughly $1 of OpenAI credit per run.
// Usage: put OPENAI_API_KEY=sk-... in a .env file in the project folder, then run `npm run test:reading`.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { summarize } from '../src/lib/openai'
import { narrate, MIN_MATCH_SCORE } from '../src/lib/narration'
import { PlaybackMode } from '../src/lib/types'

const ARTICLES = ['Apollo 11', 'Photosynthesis', 'Federal Reserve']
const FULL_WORDS = 1000 // ~7 minutes of the article keeps each run cheap
const AUDIO_COST_PER_MINUTE = 0.024 // gpt-realtime-2.1-mini audio output
const OUT_DIR = 'test-output'

function getApiKey(): string {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY
  if (existsSync('.env')) {
    const match = readFileSync('.env', 'utf8').match(/^OPENAI_API_KEY\s*=\s*["']?([^"'\s]+)/m)
    if (match) return match[1]
  }
  throw new Error('Set OPENAI_API_KEY in the environment or in a .env file in the project folder.')
}

// Plain-text Wikipedia article, cut at a paragraph boundary after FULL_WORDS words
async function fetchArticle(title: string): Promise<string> {
  const url = 'https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&formatversion=2&titles='
    + encodeURIComponent(title)
  const response = await fetch(url, { headers: { 'User-Agent': 'SpeakEasy reading test' } })
  const data = await response.json()
  const paragraphs = (data.query.pages[0].extract as string)
    .split(/\n+/)
    .map(paragraph => paragraph.trim())
    .filter(paragraph => paragraph.split(/\s+/).length > 8) // drop section headings

  const kept: string[] = []
  let words = 0
  for (const paragraph of paragraphs) {
    if (words >= FULL_WORDS) break
    kept.push(paragraph)
    words += paragraph.split(/\s+/).length
  }
  return kept.join('\n\n')
}

async function main() {
  const apiKey = getApiKey()
  mkdirSync(OUT_DIR, { recursive: true })
  const rows: Record<string, string | number>[] = []

  for (const title of ARTICLES) {
    const article = await fetchArticle(title)
    for (const mode of ['tldr', 'full'] as PlaybackMode[]) {
      const started = Date.now()
      const text = await summarize(apiKey, article, mode)
      const summarized = Date.now()
      const { audio, segments } = await narrate(apiKey, text, 'marin', 'Neutral')
      const finished = Date.now()

      const file = `${OUT_DIR}/${title.replace(/\W+/g, '-').toLowerCase()}-${mode}.wav`
      writeFileSync(file, Buffer.from(await audio.arrayBuffer()))

      const audioMinutes = (audio.size - 44) / 48000 / 60
      const attempts = segments.reduce((sum, segment) => sum + segment.attempts, 0)
      rows.push({
        article: title,
        mode,
        words: text.split(/\s+/).length,
        'audio min': +audioMinutes.toFixed(1),
        'summary s': +((summarized - started) / 1000).toFixed(1),
        'narration s': +((finished - summarized) / 1000).toFixed(1),
        segments: segments.length,
        retries: attempts - segments.length,
        'lowest match': +Math.min(...segments.map(segment => segment.score)).toFixed(3),
        'below threshold': segments.filter(segment => segment.score < MIN_MATCH_SCORE).length,
        'est. cost $': +(audioMinutes * AUDIO_COST_PER_MINUTE * (attempts / segments.length)).toFixed(3),
      })
      console.log(`Finished ${title} (${mode}) -> ${file}`)
    }
  }

  console.table(rows)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
