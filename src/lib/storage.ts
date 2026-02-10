import { UserSettings, VoiceOption } from './types'

const DEFAULT_SETTINGS: UserSettings = {
  apiKey: '',
  defaultVoice: 'nova',
  defaultSpeed: 1.0,
}

// Get all user settings
export async function getSettings(): Promise<UserSettings> {
  const result = await chrome.storage.sync.get(['apiKey', 'defaultVoice', 'defaultSpeed'])
  return {
    apiKey: result.apiKey || DEFAULT_SETTINGS.apiKey,
    defaultVoice: result.defaultVoice || DEFAULT_SETTINGS.defaultVoice,
    defaultSpeed: result.defaultSpeed || DEFAULT_SETTINGS.defaultSpeed,
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
  return defaultVoice || DEFAULT_SETTINGS.defaultVoice
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
