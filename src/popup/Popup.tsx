import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ArticleContent, PlaybackMode, VoiceOption, SpeakingStyle, UserSettings,
  VOICES, STYLES, DEFAULT_VOICE, SUMMARY_WORDS, WORDS_PER_MINUTE,
} from '../lib/types'
import { getCachedAudio } from '../lib/cache'

const MODES: PlaybackMode[] = ['tldr', 'medium', 'full']
const MODE_LABELS: Record<PlaybackMode, string> = { tldr: 'TL;DR', medium: 'Medium', full: 'Full' }

// Estimated listening time; summaries never run longer than the article itself
function estimateMinutes(mode: PlaybackMode, wordCount: number): string {
  const words = mode === 'full' ? wordCount : Math.min(SUMMARY_WORDS[mode], wordCount)
  return `~${Math.max(1, Math.round(words / WORDS_PER_MINUTE))}m`
}

type AppState = 'loading' | 'no-api-key' | 'no-article' | 'ready' | 'error'
type PlayerState = 'idle' | 'generating' | 'ready' | 'playing' | 'paused'

// The article in this window's active tab
async function fetchActiveArticle(): Promise<ArticleContent | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return null
  const res = await chrome.runtime.sendMessage({ type: 'GET_ARTICLE', payload: { tabId: tab.id } })
  return res.success ? res.article : null
}

export function Popup() {
  const [appState, setAppState] = useState<AppState>('loading')
  const [error, setError] = useState('')
  const [article, setArticle] = useState<ArticleContent | null>(null)
  // A different page the user moved to while audio for `article` is loaded
  const [nextArticle, setNextArticle] = useState<ArticleContent | null>(null)
  const [settings, setSettings] = useState<UserSettings | null>(null)

  const [mode, setMode] = useState<PlaybackMode>('tldr')
  const [voice, setVoice] = useState<VoiceOption>(DEFAULT_VOICE)
  const [style, setStyle] = useState<SpeakingStyle>('Neutral')
  const [speed, setSpeed] = useState(1.0)

  const [audioUrl, setAudioUrl] = useState('')
  const [playerState, setPlayerState] = useState<PlayerState>('idle')
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [audioReady, setAudioReady] = useState(false)

  const [voiceOpen, setVoiceOpen] = useState(false)
  const [styleOpen, setStyleOpen] = useState(false)

  const audioRef = useRef<HTMLAudioElement>(null)
  const animationRef = useRef<number>()
  const prevUrlRef = useRef('')
  const summaryRef = useRef('')
  const hasGeneratedRef = useRef(false)
  const autoPlayRef = useRef(false) // start playback once the new audio can play through
  const generateOnSwitchRef = useRef(false) // generate once a newly chosen article is in state
  const requestRef = useRef(0) // bumped on each request and on reset, so stale results are dropped

  // Latest values for the tab and storage listeners, which are registered once
  const articleRef = useRef(article)
  articleRef.current = article
  const appStateRef = useRef(appState)
  appStateRef.current = appState
  const busyRef = useRef(false)
  busyRef.current = !!audioUrl || playerState === 'generating'

  const init = useCallback(async () => {
    try {
      const settingsRes = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' })
      setSettings(settingsRes)
      setVoice(settingsRes.defaultVoice || DEFAULT_VOICE)
      setSpeed(settingsRes.defaultSpeed || 1.0)
      setStyle(settingsRes.defaultStyle || 'Neutral')
      if (!settingsRes.apiKey) { setAppState('no-api-key'); return }

      const found = await fetchActiveArticle()
      if (!found) { setAppState('no-article'); return }

      setArticle(found)
      setAppState('ready')
    } catch (err) {
      setAppState('error')
      setError(err instanceof Error ? err.message : 'Failed to initialize')
    }
  }, [])

  useEffect(() => { init() }, [init])

  // The side panel stays open, so pick up an API key saved in the settings tab
  useEffect(() => {
    const onChanged = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === 'sync' && changes.apiKey && !busyRef.current) init()
    }
    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
  }, [init])

  // Follow this window's active tab. When nothing is loaded, switch to the new page's article;
  // otherwise keep the current audio and offer the new page instead of interrupting playback.
  useEffect(() => {
    let windowId: number | undefined
    chrome.windows.getCurrent().then(w => { windowId = w.id })

    const refresh = async () => {
      if (appStateRef.current === 'loading' || appStateRef.current === 'no-api-key') return
      const found = await fetchActiveArticle().catch(() => null)
      const isNew = !!found && found.url !== articleRef.current?.url
      if (busyRef.current) {
        setNextArticle(isNew ? found : null)
        return
      }
      setNextArticle(null)
      if (!found) { setAppState('no-article'); return }
      if (isNew) { setArticle(found); setError('') }
      setAppState('ready')
    }

    const onActivated = (info: chrome.tabs.TabActiveInfo) => {
      if (info.windowId === windowId) refresh()
    }
    const onUpdated = (_tabId: number, change: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
      if (change.status === 'complete' && tab.active && tab.windowId === windowId) refresh()
    }
    chrome.tabs.onActivated.addListener(onActivated)
    chrome.tabs.onUpdated.addListener(onUpdated)
    return () => {
      chrome.tabs.onActivated.removeListener(onActivated)
      chrome.tabs.onUpdated.removeListener(onUpdated)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause()
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      if (prevUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(prevUrlRef.current)
    }
  }, [])

  useEffect(() => {
    if (prevUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(prevUrlRef.current)
    prevUrlRef.current = audioUrl
  }, [audioUrl])

  useEffect(() => {
    const update = () => {
      if (audioRef.current && playerState === 'playing') {
        setCurrentTime(audioRef.current.currentTime)
        animationRef.current = requestAnimationFrame(update)
      }
    }
    if (playerState === 'playing') animationRef.current = requestAnimationFrame(update)
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current) }
  }, [playerState])

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed
  }, [speed])

  // Narrate text (or reuse cached audio) and return a playable blob URL. The audio is read straight
  // from the shared IndexedDB cache, since full-article WAV files are too large for extension messaging.
  const loadAudio = useCallback(async (url: string, text: string): Promise<string> => {
    const audioRes = await chrome.runtime.sendMessage({
      type: 'GET_AUDIO',
      payload: { text, voice, style, url, mode },
    })
    if (!audioRes.success) throw new Error(audioRes.error || 'Failed to generate audio')

    const blob = await getCachedAudio(url, mode, voice, style)
    if (!blob) throw new Error('Failed to retrieve audio')
    return URL.createObjectURL(blob)
  }, [voice, style, mode])

  const generate = useCallback(async () => {
    if (!article || !settings?.apiKey) return
    const request = ++requestRef.current

    if (audioRef.current) audioRef.current.pause()

    setPlayerState('generating')
    setAudioUrl('')
    setError('')
    setCurrentTime(0)
    setDuration(0)
    setAudioReady(false)

    try {
      const sumRes = await chrome.runtime.sendMessage({
        type: 'SUMMARIZE',
        payload: { text: article.bodyText, mode, url: article.url },
      })
      if (request !== requestRef.current) return // don't narrate a summary the user moved on from
      if (!sumRes.success) throw new Error(sumRes.error || 'Failed to summarize')
      summaryRef.current = sumRes.summary

      const url = await loadAudio(article.url, sumRes.summary)
      if (request !== requestRef.current) return
      // The user pressed Play to generate, so play as soon as the audio is ready
      autoPlayRef.current = true
      setAudioUrl(url)
      setPlayerState('ready')
      hasGeneratedRef.current = true
    } catch (err) {
      if (request !== requestRef.current) return
      setError(err instanceof Error ? err.message : 'Error')
      setPlayerState('idle')
    }
  }, [article, settings, mode, loadAudio])

  // Regenerate audio only (reuses existing summary) when voice or style changes
  const regenerateAudio = useCallback(async () => {
    if (!article || !settings?.apiKey || !summaryRef.current) return
    const request = ++requestRef.current

    const wasPlaying = playerState === 'playing'
    if (audioRef.current) audioRef.current.pause()

    setPlayerState('generating')
    setAudioUrl('')
    setError('')
    setCurrentTime(0)
    setDuration(0)
    setAudioReady(false)

    try {
      const url = await loadAudio(article.url, summaryRef.current)
      if (request !== requestRef.current) return
      // Keep playing in the new voice or style if audio was playing before
      autoPlayRef.current = wasPlaying
      setAudioUrl(url)
      setPlayerState('ready')
    } catch (err) {
      if (request !== requestRef.current) return
      setError(err instanceof Error ? err.message : 'Error')
      setPlayerState('idle')
    }
  }, [article, settings, playerState, loadAudio])

  // Auto-regenerate audio when voice changes (if already generated)
  const prevVoiceRef = useRef(voice)
  useEffect(() => {
    if (prevVoiceRef.current !== voice && hasGeneratedRef.current) {
      prevVoiceRef.current = voice
      regenerateAudio()
    }
    prevVoiceRef.current = voice
  }, [voice, regenerateAudio])

  // Auto-regenerate audio when style changes (if already generated); style shapes delivery, not the summary
  const prevStyleRef = useRef(style)
  useEffect(() => {
    if (prevStyleRef.current !== style && hasGeneratedRef.current) {
      prevStyleRef.current = style
      regenerateAudio()
    }
    prevStyleRef.current = style
  }, [style, regenerateAudio])

  // Discard the loaded audio so Play generates (or loads from cache) audio for the current article and mode
  const resetPlayer = useCallback(() => {
    requestRef.current++
    if (audioRef.current) audioRef.current.pause()
    setAudioUrl('')
    setPlayerState('idle')
    setCurrentTime(0)
    setDuration(0)
    setAudioReady(false)
    summaryRef.current = ''
    hasGeneratedRef.current = false
  }, [])

  // Switching mode discards the other mode's audio, or cancels generating it
  const prevModeRef = useRef(mode)
  useEffect(() => {
    if (prevModeRef.current !== mode && (hasGeneratedRef.current || busyRef.current)) resetPlayer()
    prevModeRef.current = mode
  }, [mode, resetPlayer])

  // Stop the current audio and start the page the user moved to
  const listenToNextArticle = () => {
    if (!nextArticle) return
    resetPlayer()
    setError('')
    setArticle(nextArticle)
    setNextArticle(null)
    generateOnSwitchRef.current = true
  }

  useEffect(() => {
    if (generateOnSwitchRef.current) {
      generateOnSwitchRef.current = false
      generate()
    }
  }, [article, generate])

  const play = () => {
    if (!audioRef.current || !audioReady) return
    audioRef.current.playbackRate = speed
    audioRef.current.play().catch(e => setError(e.message))
  }

  const pause = () => audioRef.current?.pause()
  const togglePlay = () => playerState === 'playing' ? pause() : play()

  const skip = (s: number) => {
    if (!audioRef.current) return
    audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.currentTime + s, duration))
    setCurrentTime(audioRef.current.currentTime)
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration
    setCurrentTime(audioRef.current.currentTime)
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`
  const openOptions = () => chrome.runtime.openOptionsPage()

  const isPlaying = playerState === 'playing'
  const canInteract = audioReady && (playerState === 'ready' || playerState === 'paused' || playerState === 'playing')

  if (appState === 'loading') {
    return <div className="card"><div className="loading-container"><div className="spinner" /><p className="loading-text">Loading...</p></div></div>
  }

  if (appState === 'no-api-key') {
    return (
      <div className="card">
        <Header onOptions={openOptions} />
        <div className="divider" />
        <div className="message-container">
          <div className="message-icon"><KeyIcon /></div>
          <h2 className="message-title">Welcome to SpeakEasy</h2>
          <p className="message-text">Add your OpenAI API key to get started.</p>
          <button className="message-btn" onClick={openOptions}>Open Settings</button>
        </div>
      </div>
    )
  }

  if (appState === 'no-article') {
    return (
      <div className="card">
        <Header onOptions={openOptions} />
        <div className="divider" />
        <div className="message-container">
          <div className="message-icon"><DocIcon /></div>
          <h2 className="message-title">No Article Found</h2>
          <p className="message-text">Navigate to an article or blog post.</p>
        </div>
      </div>
    )
  }

  const hostname = article ? new URL(article.url).hostname.replace('www.', '') : ''

  return (
    <div className={`card ${isPlaying ? 'playing' : ''}`}>
      <Header onOptions={openOptions} />
      <div className="divider" />

      <div className="article-context">
        <div className="article-title">{article?.title}</div>
        <div className="article-meta">
          <span>{hostname}</span>
          <span className="meta-sep" />
          <span className="active-mode">{MODE_LABELS[mode].toUpperCase()}</span>
        </div>
      </div>

      {nextArticle && (
        <div className="next-article">
          <div className="next-article-text">
            <span className="next-article-label">You're now on</span>
            <span className="next-article-title">{nextArticle.title}</span>
          </div>
          <button className="next-article-btn" onClick={listenToNextArticle}>Listen to this page</button>
        </div>
      )}

      <div className="section">
        <div className="section-label">Mode</div>
        <div className="mode-track">
          {MODES.map(m => (
            <button key={m} className={`mode-btn ${mode === m ? 'active' : ''}`} onClick={() => setMode(m)}>
              <span>{MODE_LABELS[m]}</span>
              <span className="mode-est">{estimateMinutes(m, article?.wordCount || 0)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="player-zone">
        <div className="progress-container" onClick={seek}>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}>
              <div className="progress-glow" />
              <div className="progress-thumb" />
            </div>
          </div>
          <div className="progress-times">
            <span className="current-time">{fmt(currentTime)}</span>
            <span>{duration ? fmt(duration) : estimateMinutes(mode, article?.wordCount || 0)}</span>
          </div>
        </div>

        <div className="transport">
          <button className={`transport-btn ${!canInteract ? 'disabled' : ''}`} onClick={() => skip(-15)}>
            <SkipBackIcon /><span className="skip-label">15</span>
          </button>
          <button className="play-btn" onClick={audioUrl ? togglePlay : generate} disabled={playerState === 'generating'}>
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button className={`transport-btn ${!canInteract ? 'disabled' : ''}`} onClick={() => skip(15)}>
            <SkipFwdIcon /><span className="skip-label">15</span>
          </button>
        </div>
        {!audioUrl && playerState !== 'generating' && <div className="transport-label">Generate &amp; Play</div>}
        {playerState === 'generating' && <div className="transport-label">Generating...</div>}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="controls-bar">
        <div className="chip" onClick={() => { setVoiceOpen(!voiceOpen); setStyleOpen(false) }}>
          <span className="chip-label">Voice</span>
          <span className="chip-value">{voice.charAt(0).toUpperCase() + voice.slice(1)}</span>
          <ChevronIcon />
          <div className={`chip-dropdown ${voiceOpen ? 'open' : ''}`}>
            {VOICES.map(v => (
              <div key={v} className={`chip-option ${voice === v ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setVoice(v); setVoiceOpen(false); chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: { defaultVoice: v } }) }}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </div>
            ))}
          </div>
        </div>

        <div className="chip" onClick={() => { setStyleOpen(!styleOpen); setVoiceOpen(false) }}>
          <span className="chip-label">Style</span>
          <span className="chip-value">{style}</span>
          <ChevronIcon />
          <div className={`chip-dropdown ${styleOpen ? 'open' : ''}`}>
            {STYLES.map(s => (
              <div key={s} className={`chip-option ${style === s ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setStyle(s); setStyleOpen(false); chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: { defaultStyle: s } }) }}>
                {s}
              </div>
            ))}
          </div>
        </div>

        <div className="speed-chip">
          <button className="speed-step" onClick={() => { const newSpeed = Math.max(0.5, +(speed - 0.1).toFixed(1)); setSpeed(newSpeed); chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: { defaultSpeed: newSpeed } }) }}>−</button>
          <span className="speed-val">{speed.toFixed(1)}x</span>
          <button className="speed-step" onClick={() => { const newSpeed = Math.min(2.0, +(speed + 0.1).toFixed(1)); setSpeed(newSpeed); chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: { defaultSpeed: newSpeed } }) }}>+</button>
        </div>
      </div>

      <div className="status-bar">
        <div className="status">
          <span className={`status-dot ${playerState === 'generating' ? 'generating' : ''}`} />
          <span>
            {playerState === 'idle' && 'Ready'}
            {playerState === 'generating' && 'Generating...'}
            {playerState === 'ready' && 'Ready'}
            {playerState === 'playing' && 'Playing'}
            {playerState === 'paused' && 'Paused'}
          </span>
        </div>
      </div>

      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onCanPlayThrough={() => {
            setAudioReady(true)
            if (autoPlayRef.current && audioRef.current) {
              autoPlayRef.current = false
              audioRef.current.playbackRate = speed
              audioRef.current.play().catch(e => setError(e.message))
            }
          }}
          onPlay={() => setPlayerState('playing')}
          onPause={() => { if (audioRef.current && audioRef.current.currentTime > 0) setPlayerState('paused') }}
          onLoadedMetadata={() => { if (audioRef.current) { setDuration(audioRef.current.duration); audioRef.current.playbackRate = speed } }}
          onEnded={() => { setPlayerState('ready'); setCurrentTime(0) }}
          onError={(e) => { setError(`Audio error: ${e.currentTarget.error?.message || 'Unknown'}`); setAudioReady(false) }}
        />
      )}
    </div>
  )
}

function Header({ onOptions }: { onOptions: () => void }) {
  return (
    <div className="header">
      <div className="brand">
        <div className="brand-icon"><SpeakerIcon /></div>
        <span className="brand-name">SpeakEasy</span>
      </div>
      <button className="icon-btn" onClick={onOptions}><SettingsIcon /></button>
    </div>
  )
}

const PlayIcon = () => <svg viewBox="0 0 24 24" fill="#0B0E14"><polygon points="6,4 20,12 6,20"/></svg>
const PauseIcon = () => <svg viewBox="0 0 24 24" fill="#0B0E14"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
const SkipBackIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
const SkipFwdIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/></svg>
const SpeakerIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="#0B0E14" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
const SettingsIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="9" cy="6" r="1.5" fill="currentColor"/><circle cx="16" cy="12" r="1.5" fill="currentColor"/><circle cx="11" cy="18" r="1.5" fill="currentColor"/></svg>
const ChevronIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9"/></svg>
const KeyIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
const DocIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
