import { SpeakingStyle } from './types'
import { NarrationResult, SAMPLE_RATE, mapWithLimit, pcmToWav, splitIntoSegments } from './narration'

// ElevenLabs narration for the creator's bonus voice, using the user's own ElevenLabs API key
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1'
const MODEL_ID = 'eleven_multilingual_v2' // ElevenLabs' most stable model for long-form narration

// 16-bit mono PCM at the same rate as the Realtime narration, so both share the WAV path
const OUTPUT_FORMAT = `pcm_${SAMPLE_RATE}`

// Lower-tier ElevenLabs plans allow only a few requests at once; busy or failed requests are retried
const MAX_PARALLEL_SEGMENTS = 2
const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 1500

// Speaking styles map to voice settings: lower stability is more expressive, higher style exaggerates
// the voice's own manner. Neutral keeps the voice's saved settings.
const STYLE_SETTINGS: Record<SpeakingStyle, { stability: number; style: number } | null> = {
  Neutral: null,
  Energetic: { stability: 0.3, style: 0.5 },
  Calm: { stability: 0.75, style: 0 },
  Professional: { stability: 0.65, style: 0.1 },
  Conversational: { stability: 0.45, style: 0.25 },
  Storytelling: { stability: 0.35, style: 0.45 },
}

// Narrate text in an ElevenLabs voice, in the same ~1 minute segments as the OpenAI narration
export async function narrateElevenLabs(
  apiKey: string,
  text: string,
  voiceId: string,
  style: SpeakingStyle
): Promise<NarrationResult> {
  const segments = splitIntoSegments(text)
  if (!segments.length) {
    throw new Error('There is no text to narrate.')
  }

  // Neighbouring text keeps intonation continuous across segment boundaries
  const results = await mapWithLimit(segments.map((_, i) => i), MAX_PARALLEL_SEGMENTS, i =>
    synthesizeWithRetry(apiKey, voiceId, style, segments[i], segments[i - 1], segments[i + 1])
  )

  return {
    audio: pcmToWav(results.map(result => result.pcm)),
    // ElevenLabs reads the text as given and returns no transcript to check against, so there is no match score
    segments: results.map((result, i) => ({ chars: segments[i].length, score: 1, attempts: result.attempts })),
  }
}

async function synthesizeWithRetry(
  apiKey: string,
  voiceId: string,
  style: SpeakingStyle,
  text: string,
  previousText?: string,
  nextText?: string
): Promise<{ pcm: Uint8Array<ArrayBuffer>; attempts: number }> {
  for (let attempts = 1; ; attempts++) {
    try {
      const pcm = await synthesize(apiKey, voiceId, style, text, previousText, nextText)
      return { pcm, attempts }
    } catch (error) {
      if (!(error instanceof RetryableError) || attempts >= MAX_ATTEMPTS) throw error
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempts))
    }
  }
}

class RetryableError extends Error {}

async function synthesize(
  apiKey: string,
  voiceId: string,
  style: SpeakingStyle,
  text: string,
  previousText?: string,
  nextText?: string
): Promise<Uint8Array<ArrayBuffer>> {
  const settings = STYLE_SETTINGS[style]
  const response = await fetch(
    `${ELEVENLABS_API_URL}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${OUTPUT_FORMAT}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        previous_text: previousText,
        next_text: nextText,
        ...(settings && { voice_settings: { ...settings, similarity_boost: 0.75, use_speaker_boost: true } }),
      }),
    }
  )

  if (!response.ok) {
    const message = await errorMessage(response)
    if (response.status === 429 || response.status >= 500) throw new RetryableError(message)
    throw new Error(message)
  }

  return new Uint8Array(await response.arrayBuffer())
}

async function errorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({}))
  const detail = body?.detail
  const message = typeof detail === 'string' ? detail : detail?.message || detail?.[0]?.msg
  if (response.status === 401) {
    return `ElevenLabs rejected the API key${message ? `: ${message}` : '.'} Check it in the extension options.`
  }
  return message ? `ElevenLabs: ${message}` : `ElevenLabs API error: ${response.status}`
}

// Check that the key works and can use the voice. Returns null when it can, or the reason it can't.
export async function validateElevenLabsKey(apiKey: string, voiceId: string): Promise<string | null> {
  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/voices/${encodeURIComponent(voiceId)}`, {
      headers: { 'xi-api-key': apiKey },
    })
    if (response.ok) return null
    if (response.status === 401) return await errorMessage(response)
    return 'This key works, but its ElevenLabs account cannot use the creator\'s voice.'
  } catch {
    return 'Could not reach ElevenLabs.'
  }
}
