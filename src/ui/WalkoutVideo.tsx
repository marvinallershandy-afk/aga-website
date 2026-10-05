import { useEffect, useRef, useState } from 'react'
import { playerMedia } from '../data/playerMedia'
import { prefersHevcAlpha } from './walkoutSupport'

// ─────────────────────────────────────────────────────────────
// v16-W: Walkout-Video im DOM (Karte, Modal). Freigestellter Spieler mit
// Alpha — Safari/iOS bekommt HEVC mit Alpha (.mov), alle anderen VP9 mit
// Alpha (.webm). Reihenfolge per Browser entschieden: Chrome auf dem Mac
// meldet „hvc1 abspielbar“, zeigt dessen Alpha-Ebene aber nicht → dort
// muss WebM zuerst kommen.
//
//  · lädt erst kurz bevor die Karte sichtbar wird (IntersectionObserver),
//    spielt nur solange sie sichtbar ist, pausiert sonst
//  · prefers-reduced-motion → nur das Poster (erstes Frame, WebP mit Alpha)
//  · Fehler beim Laden → onFail (Karte fällt auf das Foto zurück)
// ─────────────────────────────────────────────────────────────

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface Props {
  id: string
  className?: string
  style?: React.CSSProperties
  onFail?: () => void
  onReady?: () => void
}

export function WalkoutVideo({ id, className, style, onFail, onReady }: Props) {
  const src = playerMedia(id).loop // v17-G: Greenscreen-pose-loop → Dolly-Walkout
  const ref = useRef<HTMLVideoElement>(null)
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined')
  const [still] = useState(reducedMotion)

  // Quellen erst setzen, wenn die Karte in die Nähe des Viewports kommt
  useEffect(() => {
    const el = ref.current
    if (!el || still || near) return
    const obs = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setNear(true); obs.disconnect() } }, { rootMargin: '300px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [still, near])

  // Abspielen nur im Bild
  useEffect(() => {
    const el = ref.current
    if (!el || !near || still) return
    el.muted = true
    el.defaultMuted = true
    const vis = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (e.isIntersecting && document.visibilityState === 'visible') el.play().catch(() => { /* Autoplay verweigert → Poster bleibt */ })
          else el.pause()
        }
      },
      { threshold: 0.15 },
    )
    vis.observe(el)
    const onVis = () => { if (document.visibilityState !== 'visible') el.pause() }
    document.addEventListener('visibilitychange', onVis)
    return () => { vis.disconnect(); document.removeEventListener('visibilitychange', onVis); el.pause() }
  }, [near, still])

  // <source>-Fehler feuern am <source> (bubbeln nicht) → Capture am <video>.
  // Erst wenn KEINE Quelle mehr übrig ist (NETWORK_NO_SOURCE), aufs Foto.
  const failRef = useRef(onFail)
  useEffect(() => { failRef.current = onFail })
  useEffect(() => {
    const v = ref.current
    if (!v || !near) return
    let t = 0
    const h = () => {
      window.clearTimeout(t)
      t = window.setTimeout(() => { if (v.networkState === HTMLMediaElement.NETWORK_NO_SOURCE || v.error) failRef.current?.() }, 50)
    }
    v.addEventListener('error', h, true)
    return () => { window.clearTimeout(t); v.removeEventListener('error', h, true) }
  }, [near])

  if (!src) return null
  if (still) {
    return <img className={className} style={style} src={src.poster} alt="" draggable={false} onLoad={onReady} onError={onFail} />
  }
  const hevc = <source key="mov" src={src.mov} type='video/mp4; codecs="hvc1"' />
  const webm = <source key="webm" src={src.webm} type='video/webm; codecs="vp9"' />
  return (
    <video
      ref={ref}
      className={className}
      style={style}
      poster={src.poster}
      muted
      loop
      playsInline
      preload={near ? 'auto' : 'none'}
      disablePictureInPicture
      disableRemotePlayback
      aria-hidden="true"
      tabIndex={-1}
      onLoadedData={onReady}
    >
      {near && (prefersHevcAlpha() ? [hevc, webm] : [webm, hevc])}
    </video>
  )
}
