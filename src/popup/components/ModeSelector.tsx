import { PlaybackMode } from '../../lib/types'

interface ModeSelectorProps {
  selected: PlaybackMode
  onChange: (mode: PlaybackMode) => void
}

const MODES: { value: PlaybackMode; label: string; description: string }[] = [
  { value: 'tldr', label: 'TL;DR', description: '3-5 sentences' },
  { value: 'short', label: 'Short', description: '~1 min' },
  { value: 'long', label: 'Long', description: '~3 min' },
  { value: 'full', label: 'Full', description: 'Complete article' },
]

export function ModeSelector({ selected, onChange }: ModeSelectorProps) {
  return (
    <div className="mode-selector">
      <label className="selector-label">Summary Length</label>
      <div className="mode-buttons">
        {MODES.map(mode => (
          <button
            key={mode.value}
            className={`mode-button ${selected === mode.value ? 'active' : ''}`}
            onClick={() => onChange(mode.value)}
            title={mode.description}
          >
            <span className="mode-label">{mode.label}</span>
            <span className="mode-description">{mode.description}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
