import { useEffect, useRef, useState } from 'react'
import { CONTACT } from '../data/content'

// ─────────────────────────────────────────────────────────────
// v17-D: Hintergrund-Loop im Panel „Mitspielen & Training".
// Drohnenaufnahme vom Training (07/2026, ~/Desktop/AGA Training,
// dji_…_0189 Sek. 8–11,6, verlangsamt, hin und zurück = nahtlos).
// 9 s, stumm, 1280×720: H.264 1,3 MB + WebM/VP9 1,1 MB + Poster 73 KB.
// Lädt erst, wenn das Panel offen ist; reduced-motion → nur Standbild.
// Neu erzeugen: docs/DESIGN.md → „Trainings-Video".
// ─────────────────────────────────────────────────────────────

const SRC = {
  webm: '/training/training-loop.webm',
  mp4: '/training/training-loop.mp4',
  poster: '/training/training-poster.webp',
}

export function TrainingMedia({ active }: { active: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [still] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const v = ref.current
    if (!v || still) return
    if (active) {
      v.muted = true
      v.play().catch(() => { /* Autoplay verweigert → Poster bleibt */ })
    } else v.pause()
  }, [active, still])

  return (
    <figure className="kp-media" aria-hidden="true">
      {still ? (
        <img src={SRC.poster} alt="" />
      ) : (
        <video ref={ref} poster={SRC.poster} muted loop playsInline preload={active ? 'auto' : 'none'} disablePictureInPicture tabIndex={-1}>
          <source src={SRC.webm} type="video/webm" />
          <source src={SRC.mp4} type="video/mp4" />
        </video>
      )}
      <figcaption>Training · {CONTACT.training}</figcaption>
    </figure>
  )
}
