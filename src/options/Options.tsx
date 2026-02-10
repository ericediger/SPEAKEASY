import { useState, useEffect } from 'react'
import { VoiceOption, UserSettings } from '../lib/types'
import { validateApiKey } from '../lib/openai'

const VOICES: { value: VoiceOption; label: string; description: string }[] = [
  { value: 'alloy', label: 'Alloy', description: 'Neutral and balanced' },
  { value: 'echo', label: 'Echo', description: 'Warm and clear' },
  { value: 'fable', label: 'Fable', description: 'Expressive British' },
  { value: 'onyx', label: 'Onyx', description: 'Deep and authoritative' },
  { value: 'nova', label: 'Nova', description: 'Friendly and upbeat' },
  { value: 'shimmer', label: 'Shimmer', description: 'Soft and pleasant' },
]

const SPEEDS = [
  { value: 0.75, label: '0.75x' },
  { value: 1, label: '1x (Normal)' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
]

export function Options() {
  const [apiKey, setApiKey] = useState('')
  const [defaultVoice, setDefaultVoice] = useState<VoiceOption>('nova')
  const [defaultSpeed, setDefaultSpeed] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null)

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }) as UserSettings
        setApiKey(response.apiKey || '')
        setDefaultVoice(response.defaultVoice || 'nova')
        setDefaultSpeed(response.defaultSpeed || 1)
        if (response.apiKey) {
          setApiKeyValid(true) // Assume valid if already saved
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadSettings()
  }, [])

  // Validate API key when it changes
  const handleValidateKey = async () => {
    if (!apiKey.trim()) {
      setApiKeyValid(null)
      return
    }

    setIsValidating(true)
    try {
      const isValid = await validateApiKey(apiKey)
      setApiKeyValid(isValid)
      if (!isValid) {
        setMessage({ type: 'error', text: 'Invalid API key. Please check and try again.' })
      } else {
        setMessage(null)
      }
    } catch {
      setApiKeyValid(false)
      setMessage({ type: 'error', text: 'Could not validate API key.' })
    } finally {
      setIsValidating(false)
    }
  }

  // Save settings
  const handleSave = async () => {
    setIsSaving(true)
    setMessage(null)

    try {
      await chrome.runtime.sendMessage({
        type: 'SAVE_SETTINGS',
        payload: {
          apiKey: apiKey.trim(),
          defaultVoice,
          defaultSpeed,
        },
      })
      setMessage({ type: 'success', text: 'Settings saved successfully!' })
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings.' })
    } finally {
      setIsSaving(false)
    }
  }

  // Clear cache
  const handleClearCache = async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' })
      setMessage({ type: 'success', text: 'Cache cleared successfully!' })
    } catch {
      setMessage({ type: 'error', text: 'Failed to clear cache.' })
    }
  }

  if (isLoading) {
    return (
      <div className="options-page">
        <div className="loading">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="options-page">
      <header className="options-header">
        <h1>SpeakEasy Settings</h1>
        <p>Configure your AI-powered text-to-speech extension</p>
      </header>

      <main className="options-content">
        <section className="settings-section">
          <h2>API Configuration</h2>
          <div className="form-group">
            <label htmlFor="api-key">OpenAI API Key</label>
            <div className="api-key-input">
              <input
                type="password"
                id="api-key"
                value={apiKey}
                onChange={e => {
                  setApiKey(e.target.value)
                  setApiKeyValid(null)
                }}
                placeholder="sk-..."
                className={apiKeyValid === false ? 'invalid' : apiKeyValid === true ? 'valid' : ''}
              />
              <button
                onClick={handleValidateKey}
                disabled={isValidating || !apiKey.trim()}
                className="validate-button"
              >
                {isValidating ? 'Validating...' : 'Validate'}
              </button>
            </div>
            <p className="help-text">
              Get your API key from{' '}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
                OpenAI Platform
              </a>
            </p>
          </div>
        </section>

        <section className="settings-section">
          <h2>Default Preferences</h2>

          <div className="form-group">
            <label htmlFor="default-voice">Default Voice</label>
            <select
              id="default-voice"
              value={defaultVoice}
              onChange={e => setDefaultVoice(e.target.value as VoiceOption)}
            >
              {VOICES.map(voice => (
                <option key={voice.value} value={voice.value}>
                  {voice.label} - {voice.description}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="default-speed">Default Playback Speed</label>
            <select
              id="default-speed"
              value={defaultSpeed}
              onChange={e => setDefaultSpeed(parseFloat(e.target.value))}
            >
              {SPEEDS.map(speed => (
                <option key={speed.value} value={speed.value}>
                  {speed.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="settings-section">
          <h2>Cache Management</h2>
          <p className="section-description">
            SpeakEasy caches summaries and audio to reduce API calls and speed up playback.
          </p>
          <button onClick={handleClearCache} className="secondary-button">
            Clear All Cache
          </button>
        </section>

        {message && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="actions">
          <button onClick={handleSave} disabled={isSaving} className="primary-button">
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </main>

      <footer className="options-footer">
        <p>SpeakEasy v1.0.0</p>
      </footer>
    </div>
  )
}
