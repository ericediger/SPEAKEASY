import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { PlaybackMode, VoiceOption } from './types'

interface SpeakEasyDB extends DBSchema {
  summaries: {
    key: string
    value: {
      text: string
      mode: PlaybackMode
      createdAt: number
      expiresAt: number
    }
  }
  audio: {
    key: string
    value: {
      blob: Blob
      voice: VoiceOption
      mode: PlaybackMode
      createdAt: number
      expiresAt: number
    }
  }
}

const DB_NAME = 'speakeasy-cache'
const DB_VERSION = 1
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days in ms

let dbPromise: Promise<IDBPDatabase<SpeakEasyDB>> | null = null

async function getDB(): Promise<IDBPDatabase<SpeakEasyDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SpeakEasyDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('summaries')) {
          db.createObjectStore('summaries')
        }
        if (!db.objectStoreNames.contains('audio')) {
          db.createObjectStore('audio')
        }
      },
    })
  }
  return dbPromise
}

// Generate cache key for summaries
function getSummaryKey(url: string, mode: PlaybackMode): string {
  return `${url}:${mode}`
}

// Generate cache key for audio
function getAudioKey(url: string, mode: PlaybackMode, voice: VoiceOption): string {
  return `${url}:${mode}:${voice}`
}

// Get cached summary
export async function getCachedSummary(
  url: string,
  mode: PlaybackMode
): Promise<string | null> {
  const db = await getDB()
  const key = getSummaryKey(url, mode)
  const entry = await db.get('summaries', key)

  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    await db.delete('summaries', key)
    return null
  }

  return entry.text
}

// Cache a summary
export async function cacheSummary(
  url: string,
  mode: PlaybackMode,
  text: string,
  ttl: number = DEFAULT_TTL
): Promise<void> {
  const db = await getDB()
  const key = getSummaryKey(url, mode)
  const now = Date.now()

  await db.put('summaries', {
    text,
    mode,
    createdAt: now,
    expiresAt: now + ttl,
  }, key)
}

// Get cached audio
export async function getCachedAudio(
  url: string,
  mode: PlaybackMode,
  voice: VoiceOption
): Promise<Blob | null> {
  const db = await getDB()
  const key = getAudioKey(url, mode, voice)
  const entry = await db.get('audio', key)

  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    await db.delete('audio', key)
    return null
  }

  return entry.blob
}

// Cache audio
export async function cacheAudio(
  url: string,
  mode: PlaybackMode,
  voice: VoiceOption,
  blob: Blob,
  ttl: number = DEFAULT_TTL
): Promise<void> {
  const db = await getDB()
  const key = getAudioKey(url, mode, voice)
  const now = Date.now()

  await db.put('audio', {
    blob,
    voice,
    mode,
    createdAt: now,
    expiresAt: now + ttl,
  }, key)
}

// Clear all cached data
export async function clearCache(): Promise<void> {
  const db = await getDB()
  await db.clear('summaries')
  await db.clear('audio')
}

// Clear expired entries
export async function clearExpiredEntries(): Promise<void> {
  const db = await getDB()
  const now = Date.now()

  // Clear expired summaries
  const summaryKeys = await db.getAllKeys('summaries')
  for (const key of summaryKeys) {
    const entry = await db.get('summaries', key)
    if (entry && now > entry.expiresAt) {
      await db.delete('summaries', key)
    }
  }

  // Clear expired audio
  const audioKeys = await db.getAllKeys('audio')
  for (const key of audioKeys) {
    const entry = await db.get('audio', key)
    if (entry && now > entry.expiresAt) {
      await db.delete('audio', key)
    }
  }
}
