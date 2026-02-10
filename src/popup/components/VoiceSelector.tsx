import { VoiceOption } from '../../lib/types'

interface VoiceSelectorProps {
  selected: VoiceOption
  onChange: (voice: VoiceOption) => void
}

const VOICES: { value: VoiceOption; label: string; description: string }[] = [
  { value: 'alloy', label: 'Alloy', description: 'Neutral and balanced' },
  { value: 'echo', label: 'Echo', description: 'Warm and clear' },
  { value: 'fable', label: 'Fable', description: 'Expressive British' },
  { value: 'onyx', label: 'Onyx', description: 'Deep and authoritative' },
  { value: 'nova', label: 'Nova', description: 'Friendly and upbeat' },
  { value: 'shimmer', label: 'Shimmer', description: 'Soft and pleasant' },
]

export function VoiceSelector({ selected, onChange }: VoiceSelectorProps) {
  return (
    <div className="voice-selector">
      <label htmlFor="voice-select" className="selector-label">Voice</label>
      <select
        id="voice-select"
        value={selected}
        onChange={e => onChange(e.target.value as VoiceOption)}
        className="voice-dropdown"
      >
        {VOICES.map(voice => (
          <option key={voice.value} value={voice.value}>
            {voice.label} - {voice.description}
          </option>
        ))}
      </select>
    </div>
  )
}
