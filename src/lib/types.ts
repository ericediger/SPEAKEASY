// Article content extracted from web pages
export interface ArticleContent {
  title: string
  author?: string
  bodyText: string
  wordCount: number
  url: string
}

// Playback modes: TL;DR (~2 min), Medium (~5 min), or the full article
export type PlaybackMode = 'tldr' | 'medium' | 'full'

// Typical narration pace, used for summary lengths and time estimates
export const WORDS_PER_MINUTE = 150

// Target summary length in words for each summarized mode
export const SUMMARY_WORDS: Record<Exclude<PlaybackMode, 'full'>, number> = {
  tldr: 300, // ~2 minutes
  medium: 750, // ~5 minutes
}

// Voices available on gpt-realtime-2.1-mini
export type OpenAIVoice = 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'sage' | 'shimmer' | 'verse' | 'marin' | 'cedar'

export const OPENAI_VOICES: OpenAIVoice[] = ['marin', 'cedar', 'alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse']

// Bonus voice from SpeakEasy's creator, narrated by ElevenLabs with the user's own ElevenLabs API key.
// The value carries the ElevenLabs voice ID, so cached audio follows the voice if it ever changes.
export const CREATOR_VOICE_ID = 'G3qIj1Lb0GkRqMWsPD2C'
export const CREATOR_VOICE = `elevenlabs:${CREATOR_VOICE_ID}` as const
export type ElevenLabsVoice = typeof CREATOR_VOICE

export type VoiceOption = OpenAIVoice | ElevenLabsVoice

export const VOICES: VoiceOption[] = [...OPENAI_VOICES, CREATOR_VOICE]

export const DEFAULT_VOICE: VoiceOption = 'marin'

export function isElevenLabsVoice(voice: VoiceOption): voice is ElevenLabsVoice {
  return voice.startsWith('elevenlabs:')
}

export function elevenLabsVoiceId(voice: ElevenLabsVoice): string {
  return voice.slice('elevenlabs:'.length)
}

// Name shown on the voice chip and in settings
export function voiceLabel(voice: VoiceOption): string {
  if (voice === CREATOR_VOICE) return 'Creator'
  return voice.charAt(0).toUpperCase() + voice.slice(1)
}

// Speaking styles, applied to the narrator's delivery
export type SpeakingStyle = 'Neutral' | 'Energetic' | 'Calm' | 'Professional' | 'Conversational' | 'Storytelling'

export const STYLES: SpeakingStyle[] = ['Neutral', 'Energetic', 'Calm', 'Professional', 'Conversational', 'Storytelling']

// User settings stored in chrome.storage.sync
export interface UserSettings {
  apiKey: string
  elevenLabsApiKey: string // only needed for the creator's bonus voice
  defaultVoice: VoiceOption
  defaultSpeed: number
  defaultStyle: SpeakingStyle
}

// Cache entry for summaries
export interface SummaryCacheEntry {
  text: string
  mode: PlaybackMode
  createdAt: number
  expiresAt: number
}

// Cache entry for audio
export interface AudioCacheEntry {
  blob: Blob
  voice: VoiceOption
  style: SpeakingStyle
  mode: PlaybackMode
  createdAt: number
  expiresAt: number
}

// Message types for communication between popup/background
export type MessageType =
  | 'GET_ARTICLE'
  | 'SUMMARIZE'
  | 'GET_AUDIO'
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS'

export interface Message {
  type: MessageType
  payload?: unknown
}

export interface GetArticleResponse {
  success: boolean
  article?: ArticleContent
  error?: string
}

export interface SummarizeRequest {
  text: string
  mode: PlaybackMode
  url: string
}

export interface SummarizeResponse {
  success: boolean
  summary?: string
  error?: string
  cached?: boolean
}

export interface GetAudioRequest {
  text: string
  voice: VoiceOption
  style: SpeakingStyle
  url: string
  mode: PlaybackMode
}

export interface GetAudioResponse {
  success: boolean
  error?: string
  cached?: boolean
}

// Playback state for the audio player
export interface PlaybackState {
  isPlaying: boolean
  currentTime: number
  duration: number
  speed: number
  isLoading: boolean
  error?: string
}
