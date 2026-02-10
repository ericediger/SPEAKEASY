import { useState, useRef, useEffect } from 'react'

interface PlayerProps {
  audioUrl: string
  isLoading: boolean
  defaultSpeed: number
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5]

export function Player({ audioUrl, isLoading, defaultSpeed }: PlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(defaultSpeed)

  // Update audio element when URL changes
  useEffect(() => {
    if (audioRef.current && audioUrl) {
      audioRef.current.load()
      audioRef.current.playbackRate = speed
    }
  }, [audioUrl])

  // Update playback rate when speed changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed
    }
  }, [speed])

  const togglePlay = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
  }

  const skip = (seconds: number) => {
    if (!audioRef.current) return
    audioRef.current.currentTime = Math.max(
      0,
      Math.min(audioRef.current.currentTime + seconds, duration)
    )
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return
    const time = parseFloat(e.target.value)
    audioRef.current.currentTime = time
    setCurrentTime(time)
  }

  const cycleSpeed = () => {
    const currentIndex = SPEED_OPTIONS.indexOf(speed)
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length
    setSpeed(SPEED_OPTIONS[nextIndex])
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (isLoading) {
    return (
      <div className="player loading">
        <div className="spinner" />
        <p>Generating audio...</p>
      </div>
    )
  }

  if (!audioUrl) {
    return null
  }

  return (
    <div className="player">
      <audio
        ref={audioRef}
        src={audioUrl}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="player-controls">
        <button
          className="control-button skip-button"
          onClick={() => skip(-15)}
          title="Back 15 seconds"
        >
          <span className="skip-icon">-15</span>
        </button>

        <button
          className="control-button play-button"
          onClick={togglePlay}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <button
          className="control-button skip-button"
          onClick={() => skip(15)}
          title="Forward 15 seconds"
        >
          <span className="skip-icon">+15</span>
        </button>
      </div>

      <div className="progress-container">
        <span className="time-display">{formatTime(currentTime)}</span>
        <input
          type="range"
          className="progress-bar"
          min={0}
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
        />
        <span className="time-display">{formatTime(duration)}</span>
      </div>

      <div className="speed-control">
        <button
          className="speed-button"
          onClick={cycleSpeed}
          title="Change playback speed"
        >
          {speed}x
        </button>
      </div>
    </div>
  )
}
