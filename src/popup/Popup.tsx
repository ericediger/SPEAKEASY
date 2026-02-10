import { useState, useEffect, useCallback, useRef } from 'react'
import { ArticleContent, PlaybackMode, VoiceOption, UserSettings } from '../lib/types'

const VOICES: VoiceOption[] = ['alloy', 'ash', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer']
const STYLES = ['Neutral', 'Energetic', 'Calm', 'Professional', 'Conversational', 'Storytelling']
const MODE_EST: Record<PlaybackMode, string> = { tldr: '~2m', short: '~4m', long: '~8m', full: '~12m' }

type AppState = 'loading' | 'no-api-key' | 'no-article' | 'ready' | 'error'
type PlayerState = 'idle' | 'generating' | 'ready' | 'playing' | 'paused'

export function Popup() {
  const [appState, setAppState] = useState<AppState>('loading')
  const [error, setError] = useState('')
  const [article, setArticle] = useState<ArticleContent | null>(null)
  const [settings, setSettings] = useState<UserSettings | null>(null)

  const [mode, setMode] = useState<PlaybackMode>('tldr')
  const [voice, setVoice] = useState<VoiceOption>('nova')
  const [style, setStyle] = useState('Neutral')
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

  useEffect(() => {
    async function init() {
      try {
        const settingsRes = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' })
        setSettings(settingsRes)
        setVoice(settingsRes.defaultVoice || 'nova')
        setSpeed(settingsRes.defaultSpeed || 1.0)
        setStyle(settingsRes.defaultStyle || 'Neutral')
        if (!settingsRes.apiKey) { setAppState('no-api-key'); return }

        const articleRes = await chrome.runtime.sendMessage({ type: 'GET_ARTICLE' })
        if (!articleRes.success) { setAppState('no-article'); setError(articleRes.error || ''); return }

        setArticle(articleRes.article)
        setAppState('ready')
      } catch (err) {
        setAppState('error')
        setError(err instanceof Error ? err.message : 'Failed to initialize')
      }
    }
    init()
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

  const generate = useCallback(async () => {
    if (!article || !settings?.apiKey) return

    const wasPlaying = playerState === 'playing'
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
        payload: { text: article.bodyText, mode, url: article.url, style },
      })
      if (!sumRes.success) throw new Error(sumRes.error || 'Failed to summarize')
      summaryRef.current = sumRes.summary

      const audioRes = await chrome.runtime.sendMessage({
        type: 'GET_AUDIO',
        payload: { text: sumRes.summary, voice, speed: 1.0, url: article.url, mode },
      })
      if (!audioRes.success) throw new Error(audioRes.error || 'Failed to generate audio')

      const blobRes = await chrome.runtime.sendMessage({
        type: 'GET_AUDIO_BLOB',
        payload: { url: article.url, mode, voice },
      })
      if (!blobRes.success) throw new Error(blobRes.error || 'Failed to retrieve audio')

      const blob = new Blob([new Uint8Array(blobRes.audioData)], { type: 'audio/mpeg' })
      setAudioUrl(URL.createObjectURL(blob))
      setPlayerState('ready')
      hasGeneratedRef.current = true

      // Auto-play if was playing before
      if (wasPlaying) {
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.playbackRate = speed
            audioRef.current.play().catch(() => {})
          }
        }, 100)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
      setPlayerState('idle')
    }
  }, [article, settings, mode, voice, style, playerState, speed])

  // Regenerate audio only (reuses existing summary) when voice changes
  const regenerateAudio = useCallback(async () => {
    if (!article || !settings?.apiKey || !summaryRef.current) return

    const wasPlaying = playerState === 'playing'
    if (audioRef.current) audioRef.current.pause()

    setPlayerState('generating')
    setAudioUrl('')
    setError('')
    setCurrentTime(0)
    setDuration(0)
    setAudioReady(false)

    try {
      const audioRes = await chrome.runtime.sendMessage({
        type: 'GET_AUDIO',
        payload: { text: summaryRef.current, voice, speed: 1.0, url: article.url, mode },
      })
      if (!audioRes.success) throw new Error(audioRes.error || 'Failed to generate audio')

      const blobRes = await chrome.runtime.sendMessage({
        type: 'GET_AUDIO_BLOB',
        payload: { url: article.url, mode, voice },
      })
      if (!blobRes.success) throw new Error(blobRes.error || 'Failed to retrieve audio')

      const blob = new Blob([new Uint8Array(blobRes.audioData)], { type: 'audio/mpeg' })
      setAudioUrl(URL.createObjectURL(blob))
      setPlayerState('ready')
      // Auto-play if was playing before
      if (wasPlaying) {
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.playbackRate = speed
            audioRef.current.play().catch(() => {})
          }
        }, 100)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
      setPlayerState('idle')
    }
  }, [article, settings, mode, voice, playerState])

  // Auto-regenerate audio when voice changes (if already generated)
  const prevVoiceRef = useRef(voice)
  useEffect(() => {
    if (prevVoiceRef.current !== voice && hasGeneratedRef.current) {
      prevVoiceRef.current = voice
      regenerateAudio()
    }
    prevVoiceRef.current = voice
  }, [voice, regenerateAudio])

  // Auto-regenerate summary and audio when style changes (if already generated)
  const prevStyleRef = useRef(style)
  useEffect(() => {
    if (prevStyleRef.current !== style && hasGeneratedRef.current) {
      prevStyleRef.current = style
      generate() // Style affects summary, so regenerate everything
    }
    prevStyleRef.current = style
  }, [style, generate])

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
          <span className="active-mode">{mode.toUpperCase()}</span>
        </div>
      </div>

      <div className="section">
        <div className="section-label">Mode</div>
        <div className="mode-track">
          {(['tldr', 'short', 'long', 'full'] as PlaybackMode[]).map(m => (
            <button key={m} className={`mode-btn ${mode === m ? 'active' : ''}`} onClick={() => setMode(m)}>
              <span>{m === 'tldr' ? 'TL;DR' : m.charAt(0).toUpperCase() + m.slice(1)}</span>
              <span className="mode-est">{MODE_EST[m]}</span>
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
            <span>{duration ? fmt(duration) : MODE_EST[mode]}</span>
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
          onCanPlayThrough={() => setAudioReady(true)}
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
