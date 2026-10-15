import { UserSettings, VoiceOption, VOICES, DEFAULT_VOICE, STYLES } from './types'

const DEFAULT_SETTINGS: UserSettings = {
  apiKey: '',
  defaultVoice: DEFAULT_VOICE,
  defaultSpeed: 1.0,
  defaultStyle: 'Neutral',
}

// Voices saved by earlier versions (fable, nova, onyx) aren't available for narration any more
function validVoice(voice: unknown): VoiceOption {
  return VOICES.includes(voice as VoiceOption) ? voice as VoiceOption : DEFAULT_SETTINGS.defaultVoice
}

// Get all user settings
export async function getSettings(): Promise<UserSettings> {
  const result = await chrome.storage.sync.get(['apiKey', 'defaultVoice', 'defaultSpeed', 'defaultStyle'])
  return {
    apiKey: result.apiKey || DEFAULT_SETTINGS.apiKey,
    defaultVoice: validVoice(result.defaultVoice),
    defaultSpeed: result.defaultSpeed || DEFAULT_SETTINGS.defaultSpeed,
    defaultStyle: STYLES.includes(result.defaultStyle) ? result.defaultStyle : DEFAULT_SETTINGS.defaultStyle,
  }
}

// Save all user settings
export async function saveSettings(settings: Partial<UserSettings>): Promise<void> {
  await chrome.storage.sync.set(settings)
}

// Get API key
export async function getApiKey(): Promise<string> {
  const { apiKey } = await chrome.storage.sync.get('apiKey')
  return apiKey || ''
}

// Save API key
export async function saveApiKey(apiKey: string): Promise<void> {
  await chrome.storage.sync.set({ apiKey })
}

// Get default voice
export async function getDefaultVoice(): Promise<VoiceOption> {
  const { defaultVoice } = await chrome.storage.sync.get('defaultVoice')
  return validVoice(defaultVoice)
}

// Save default voice
export async function saveDefaultVoice(voice: VoiceOption): Promise<void> {
  await chrome.storage.sync.set({ defaultVoice: voice })
}

// Get default speed
export async function getDefaultSpeed(): Promise<number> {
  const { defaultSpeed } = await chrome.storage.sync.get('defaultSpeed')
  return defaultSpeed || DEFAULT_SETTINGS.defaultSpeed
}

// Save default speed
export async function saveDefaultSpeed(speed: number): Promise<void> {
  await chrome.storage.sync.set({ defaultSpeed: speed })
}

// Store last playback position for an article
export async function savePlaybackPosition(url: string, position: number): Promise<void> {
  const key = `position:${url}`
  await chrome.storage.local.set({ [key]: position })
}

// Get last playback position for an article
export async function getPlaybackPosition(url: string): Promise<number> {
  const key = `position:${url}`
  const result = await chrome.storage.local.get(key)
  return result[key] || 0
}
