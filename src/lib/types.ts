// Article content extracted from web pages
export interface ArticleContent {
  title: string
  author?: string
  bodyText: string
  wordCount: number
  url: string
}

// Playback modes for summarization
export type PlaybackMode = 'tldr' | 'short' | 'long' | 'full'

// Available OpenAI TTS voices (all current voices)
export type VoiceOption = 'alloy' | 'ash' | 'coral' | 'echo' | 'fable' | 'nova' | 'onyx' | 'sage' | 'shimmer'

// User settings stored in chrome.storage.sync
export interface UserSettings {
  apiKey: string
  defaultVoice: VoiceOption
  defaultSpeed: number
  defaultStyle: string
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
  speed: number
  url: string
  mode: PlaybackMode
}

export interface GetAudioResponse {
  success: boolean
  audioUrl?: string
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
