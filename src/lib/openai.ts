import { PlaybackMode, VoiceOption } from './types'

const OPENAI_API_URL = 'https://api.openai.com/v1'

// System prompts for each summarization mode
const SYSTEM_PROMPTS: Record<PlaybackMode, string> = {
  tldr: `You are a concise summarizer. Summarize the following article in 3-5 sentences for spoken narration. Be direct and conversational. Do not use bullet points, lists, or any formatting. Write in natural flowing sentences that sound good when read aloud.`,

  short: `You are a skilled summarizer. Create a ~150 word summary of the following article for spoken narration. Use natural, conversational language that flows well when read aloud. Organize as flowing paragraphs, not bullet points. Capture the key points while keeping it brief.`,

  long: `You are a comprehensive summarizer. Create a ~500 word summary of the following article for spoken narration. Cover all the key points in a conversational, engaging style. Use paragraph structure that flows naturally when read aloud. Avoid bullet points or lists - write in complete, flowing sentences.`,

  full: '', // No summarization needed for full mode
}

// Estimate token count (rough approximation: ~4 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// Chunk text into smaller pieces for long articles
function chunkText(text: string, maxTokens: number = 12000): string[] {
  const chunks: string[] = []
  const sentences = text.split(/(?<=[.!?])\s+/)
  let currentChunk = ''

  for (const sentence of sentences) {
    const testChunk = currentChunk + ' ' + sentence
    if (estimateTokens(testChunk) > maxTokens && currentChunk) {
      chunks.push(currentChunk.trim())
      currentChunk = sentence
    } else {
      currentChunk = testChunk
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

// Summarize text using OpenAI Chat API
export async function summarize(
  apiKey: string,
  text: string,
  mode: PlaybackMode
): Promise<string> {
  // Full mode returns the original text
  if (mode === 'full') {
    return text
  }

  const systemPrompt = SYSTEM_PROMPTS[mode]
  const chunks = chunkText(text)

  // If multiple chunks, summarize each then merge
  if (chunks.length > 1) {
    const summaries = await Promise.all(
      chunks.map(chunk => summarizeChunk(apiKey, chunk, systemPrompt))
    )

    // Merge summaries into final summary
    const mergedText = summaries.join('\n\n')
    return summarizeChunk(
      apiKey,
      mergedText,
      `${systemPrompt} This is a combination of partial summaries. Create a cohesive final summary.`
    )
  }

  return summarizeChunk(apiKey, text, systemPrompt)
}

// Summarize a single chunk
async function summarizeChunk(
  apiKey: string,
  text: string,
  systemPrompt: string
): Promise<string> {
  const response = await fetch(`${OPENAI_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error?.message || `OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices[0]?.message?.content || ''
}

// Generate speech from text using OpenAI TTS API
export async function textToSpeech(
  apiKey: string,
  text: string,
  voice: VoiceOption,
  speed: number = 1.0
): Promise<Blob> {
  // TTS API has a 4096 character limit, so chunk if needed
  const maxChars = 4000

  if (text.length <= maxChars) {
    return ttsChunk(apiKey, text, voice, speed)
  }

  // For longer text, split and concatenate audio
  const chunks = splitTextForTTS(text, maxChars)
  const audioBlobs = await Promise.all(
    chunks.map(chunk => ttsChunk(apiKey, chunk, voice, speed))
  )

  // Concatenate audio blobs
  return new Blob(audioBlobs, { type: 'audio/mpeg' })
}

// Split text for TTS while preserving sentence boundaries
function splitTextForTTS(text: string, maxChars: number): string[] {
  const chunks: string[] = []
  const sentences = text.split(/(?<=[.!?])\s+/)
  let currentChunk = ''

  for (const sentence of sentences) {
    if ((currentChunk + ' ' + sentence).length > maxChars && currentChunk) {
      chunks.push(currentChunk.trim())
      currentChunk = sentence
    } else {
      currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

// Generate TTS for a single chunk
async function ttsChunk(
  apiKey: string,
  text: string,
  voice: VoiceOption,
  speed: number
): Promise<Blob> {
  const response = await fetch(`${OPENAI_API_URL}/audio/speech`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice: voice,
      speed: speed,
      response_format: 'mp3',
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error?.message || `OpenAI TTS API error: ${response.status}`)
  }

  // Ensure blob has correct MIME type
  const arrayBuffer = await response.arrayBuffer()
  return new Blob([arrayBuffer], { type: 'audio/mpeg' })
}

// Validate API key by making a test request
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(`${OPENAI_API_URL}/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })
    return response.ok
  } catch {
    return false
  }
}
