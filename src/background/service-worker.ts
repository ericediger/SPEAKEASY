import {
  ArticleContent,
  PlaybackMode,
  VoiceOption,
  SpeakingStyle,
  GetArticleResponse,
  SummarizeResponse,
  GetAudioResponse,
  UserSettings,
} from '../lib/types'
import { getSettings, saveSettings, getApiKey } from '../lib/storage'
import { summarize } from '../lib/openai'
import { narrate, MIN_MATCH_SCORE } from '../lib/narration'
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
        style: SpeakingStyle
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

// Handle audio generation request - narrates and caches the audio; the popup reads it from the cache
async function handleGetAudio(payload: {
  text: string
  voice: VoiceOption
  style: SpeakingStyle
  url: string
  mode: PlaybackMode
}): Promise<GetAudioResponse> {
  const { text, voice, style, url, mode } = payload

  try {
    // Check cache first
    const cached = await getCachedAudio(url, mode, voice, style)
    if (cached) {
      return { success: true, cached: true }
    }

    // Get API key
    const apiKey = await getApiKey()
    if (!apiKey) {
      return { success: false, error: 'API key not configured. Please set it in the extension options.' }
    }

    // Generate audio
    const { audio, segments } = await narrate(apiKey, text, voice, style)
    const drifted = segments.filter(segment => segment.score < MIN_MATCH_SCORE)
    if (drifted.length) {
      console.warn(`${drifted.length} of ${segments.length} narration segments still differ from the text after retries`, drifted)
    }

    // Cache the result
    await cacheAudio(url, mode, voice, style, audio)

    return { success: true, cached: false }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Audio generation failed',
    }
  }
}

// Clean up expired cache entries on startup
chrome.runtime.onStartup.addListener(async () => {
  const { clearExpiredEntries } = await import('../lib/cache')
  await clearExpiredEntries()
})
