import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { AudioManager } from '../audio/AudioManager'
import { TRACKS, COVER_URL, ALBUM_TITLE } from '../audio/tracks'

// Die Trackliste der Musik-Sektion. Play direkt aus der Sektion —
// ein Klick ist die Audio-Geste: Ton wird bei Bedarf eingeschaltet.
export function MusicSectionPlayer() {
  const soundOn = useStore((s) => s.soundOn)
  const setSoundOn = useStore((s) => s.setSoundOn)
  const [, force] = useState(0)

  useEffect(() => {
    const prev = AudioManager.onChange
    AudioManager.onChange = () => {
      prev?.()
      force((n) => n + 1)
    }
    return () => {
      AudioManager.onChange = prev
    }
  }, [])

  const playTrack = (i: number) => {
    if (!soundOn) setSoundOn(true) // Klick = Geste, Ton darf an
    AudioManager.play(i)
  }

  return (
    <div className="music-section">
      <div className="music-section__cover">
        <img src={COVER_URL} alt={`Album-Cover: ${ALBUM_TITLE}`} />
        <div className="music-section__coverGlow" aria-hidden="true" />
      </div>
      <div className="music-section__list">
        {TRACKS.map((tr, i) => {
          const active = i === AudioManager.trackIndex && AudioManager.playing
          return (
            <button
              key={tr.slug}
              className={`music-track${active ? ' is-active' : ''}`}
              onClick={() => (active ? AudioManager.pause() : playTrack(i))}
            >
              <span className="music-track__no">{active ? '❚❚' : String(i + 1).padStart(2, '0')}</span>
              <span className="music-track__title">{tr.title}</span>
              <span className="music-track__dur">{tr.duration}</span>
            </button>
          )
        })}
        <div className="music-section__links">
          <span className="music-section__soon" title="Kommt bald">Spotify · bald</span>
          <span className="music-section__soon" title="Kommt bald">Apple Music · bald</span>
        </div>
      </div>
    </div>
  )
}
