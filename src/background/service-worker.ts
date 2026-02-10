import {
  ArticleContent,
  PlaybackMode,
  VoiceOption,
  GetArticleResponse,
  SummarizeResponse,
  GetAudioResponse,
  UserSettings,
} from '../lib/types'
import { getSettings, saveSettings, getApiKey } from '../lib/storage'
import { summarize, textToSpeech } from '../lib/openai'
import { getCachedSummary, cacheSummary, getCachedAudio, cacheAudio, clearCache } from '../lib/cache'

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(error => {
      console.error('Message handler error:', error)
      sendResponse({ success: false, error: error.message })
    })
  return true // Keep channel open for async response
})

async function handleMessage(
  message: { type: string; payload?: unknown },
  _sender: chrome.runtime.MessageSender
): Promise<unknown> {
  switch (message.type) {
    case 'GET_ARTICLE':
      return getArticle()

    case 'SUMMARIZE':
      return handleSummarize(message.payload as {
        text: string
        mode: PlaybackMode
        url: string
      })

    case 'GET_AUDIO':
      return handleGetAudio(message.payload as {
        text: string
        voice: VoiceOption
        speed: number
        url: string
        mode: PlaybackMode
      })

    case 'GET_SETTINGS':
      return getSettings()

    case 'SAVE_SETTINGS':
      await saveSettings(message.payload as Partial<UserSettings>)
      return { success: true }

    case 'CLEAR_CACHE':
      await clearCache()
      return { success: true }

    case 'GET_AUDIO_BLOB':
      return handleGetAudioBlob(message.payload as {
        url: string
        mode: PlaybackMode
        voice: VoiceOption
      })

    default:
      throw new Error(`Unknown message type: ${message.type}`)
  }
}

// Get article from the active tab
async function getArticle(): Promise<GetArticleResponse> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    if (!tab?.id) {
      return { success: false, error: 'No active tab found' }
    }

    // Inject content script if needed
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['src/content/extractor.ts'],
    }).catch(() => {
      // Script might already be injected, ignore error
    })

    // Request article extraction
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_ARTICLE' })

    if (!response.success) {
      return { success: false, error: response.error || 'Failed to extract article' }
    }

    return { success: true, article: response.article as ArticleContent }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get article',
    }
  }
}

// Handle summarization request
async function handleSummarize(payload: {
  text: string
  mode: PlaybackMode
  url: string
}): Promise<SummarizeResponse> {
  const { text, mode, url } = payload

  try {
    // Check cache first
    const cached = await getCachedSummary(url, mode)
    if (cached) {
      return { success: true, summary: cached, cached: true }
    }

    // Get API key
    const apiKey = await getApiKey()
    if (!apiKey) {
      return { success: false, error: 'API key not configured. Please set it in the extension options.' }
    }

    // Generate summary
    const summary = await summarize(apiKey, text, mode)

    // Cache the result
    await cacheSummary(url, mode, summary)

    return { success: true, summary, cached: false }
  } catch (error) {
    // Fallback to full text on error
    if (mode !== 'full') {
      console.warn('Summarization failed, falling back to full text:', error)
      return {
        success: true,
        summary: text,
        error: `Summarization failed: ${error instanceof Error ? error.message : 'Unknown error'}. Using full text.`
      }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Summarization failed',
    }
  }
}

// Convert blob to base64 data URL (service workers can't use URL.createObjectURL)
async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // Process in chunks to avoid call stack issues with large files
  const chunkSize = 8192
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, Array.from(chunk))
  }

  const base64 = btoa(binary)
  const mimeType = blob.type || 'audio/mpeg'
  return `data:${mimeType};base64,${base64}`
}

// Handle audio generation request - returns cache key, popup retrieves blob
async function handleGetAudio(payload: {
  text: string
  voice: VoiceOption
  speed: number
  url: string
  mode: PlaybackMode
}): Promise<GetAudioResponse> {
  const { text, voice, speed, url, mode } = payload

  try {
    // Check cache first
    const cached = await getCachedAudio(url, mode, voice)
    if (cached) {
      // Return cache key for popup to retrieve
      const cacheKey = `${url}:${mode}:${voice}`
      return { success: true, audioUrl: cacheKey, cached: true }
    }

    // Get API key
    const apiKey = await getApiKey()
    if (!apiKey) {
      return { success: false, error: 'API key not configured. Please set it in the extension options.' }
    }

    // Generate audio
    const blob = await textToSpeech(apiKey, text, voice, speed)

    // Cache the result
    await cacheAudio(url, mode, voice, blob)

    // Return cache key for popup to retrieve
    const cacheKey = `${url}:${mode}:${voice}`
    return { success: true, audioUrl: cacheKey, cached: false }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Audio generation failed',
    }
  }
}

// Handle audio blob retrieval - converts to array buffer for transfer
async function handleGetAudioBlob(payload: {
  url: string
  mode: PlaybackMode
  voice: VoiceOption
}): Promise<{ success: boolean; audioData?: number[]; error?: string }> {
  const { url, mode, voice } = payload

  try {
    const blob = await getCachedAudio(url, mode, voice)
    if (!blob) {
      return { success: false, error: 'Audio not found in cache' }
    }

    // Convert blob to array for transfer (can't send Blob through messaging)
    const buffer = await blob.arrayBuffer()
    const audioData = Array.from(new Uint8Array(buffer))

    return { success: true, audioData }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve audio',
    }
  }
}

// Clean up expired cache entries on startup
chrome.runtime.onStartup.addListener(async () => {
  const { clearExpiredEntries } = await import('../lib/cache')
  await clearExpiredEntries()
})
