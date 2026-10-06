import { useEffect, useRef, useState } from 'react'
import { Maximize2, X } from 'lucide-react'
import type { Ziehung } from '../../lib/albumV20'

// ─────────────────────────────────────────────────────────────
// v20-K: Glücksrad zur Verlosung — Vollbild, abfilmbar für Instagram.
// Das Ergebnis steht VORHER fest (album_admin_verlosung_ziehen, Seed im
// Protokoll); das Rad zeigt es nur. Segmente proportional zu den Losen.
// Rad einmal gezeichnet (Canvas), Drehung per transform (60 fps).
// ─────────────────────────────────────────────────────────────

const ROT = ['#E91D29', '#141213']
function zeichneRad(c: HTMLCanvasElement, t: Ziehung['teilnehmer'], gesamt: number) {
  const s = c.width
  const ctx = c.getContext('2d')!
  const r = s / 2
  ctx.clearRect(0, 0, s, s)
  let a0 = -Math.PI / 2
  t.forEach((p, i) => {
    const w = (p.lose / gesamt) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(r, r)
    ctx.arc(r, r, r - 8, a0, a0 + w)
    ctx.closePath()
    ctx.fillStyle = ROT[i % 2]
    ctx.fill()
    ctx.strokeStyle = 'rgba(244,242,239,0.25)'
    ctx.lineWidth = 2
    ctx.stroke()
    if (w > 0.07) {
      ctx.save()
      ctx.translate(r, r)
      ctx.rotate(a0 + w / 2)
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#F4F2EF'
      ctx.font = `${Math.min(46, Math.max(18, w * 160))}px Anton, sans-serif`
      ctx.fillText(p.name.toUpperCase(), r - 40, 0)
      ctx.restore()
    }
    a0 += w
  })
  ctx.beginPath()
  ctx.arc(r, r, r - 6, 0, Math.PI * 2)
  ctx.strokeStyle = '#E8C15A'
  ctx.lineWidth = 10
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(r, r, r * 0.13, 0, Math.PI * 2)
  ctx.fillStyle = '#0B0A0B'
  ctx.fill()
  ctx.strokeStyle = '#E8C15A'
  ctx.lineWidth = 6
  ctx.stroke()
}

export function Gluecksrad({ ziehung, titel, preis, partner, onClose }: { ziehung: Ziehung; titel: string; preis?: string | null; partner?: string | null; onClose: () => void }) {
  const wrap = useRef<HTMLDivElement>(null)
  const rad = useRef<HTMLCanvasElement>(null)
  const [fertig, setFertig] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const t = ziehung.teilnehmer
  const gesamt = Math.max(1, ziehung.loseGesamt || t.reduce((a, p) => a + p.lose, 0))

  useEffect(() => {
    if (rad.current) zeichneRad(rad.current, t, gesamt)
  }, [t, gesamt])

  const drehen = () => {
    if (laeuft || !rad.current) return
    setLaeuft(true)
    // Mitte (mit Zufallsversatz) des Gewinner-Segments unter den Zeiger (oben)
    const vor = t.slice(0, ziehung.gewinnerIndex).reduce((a, p) => a + p.lose, 0)
    const w = t[ziehung.gewinnerIndex]?.lose ?? 1
    const anteil = (vor + w * (0.2 + Math.random() * 0.6)) / gesamt
    const ziel = 360 * 8 + (360 - anteil * 360)
    const a = rad.current.animate([{ transform: 'rotate(0deg)' }, { transform: `rotate(${ziel}deg)` }], { duration: 9000, easing: 'cubic-bezier(.12,.6,.08,1)', fill: 'forwards' })
    a.onfinish = () => {
      setFertig(true)
      try {
        navigator.vibrate?.([40, 60, 120])
      } catch {
        /* egal */
      }
    }
  }

  return (
    <div ref={wrap} className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-6 bg-[#0B0A0B] p-6 text-[#F4F2EF]" role="dialog" aria-modal="true" aria-label="Glücksrad">
      <div className="absolute right-4 top-4 flex gap-2">
        <button type="button" className="rounded-full border border-white/30 p-2" onClick={() => void wrap.current?.requestFullscreen?.()} aria-label="Vollbild">
          <Maximize2 className="h-5 w-5" />
        </button>
        <button type="button" className="rounded-full border border-white/30 p-2" onClick={onClose} aria-label="Schließen">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#E91D29]">SVA-Sammelalbum · Verlosung</p>
        <h2 className="mt-2 font-display text-4xl uppercase sm:text-6xl">{titel}</h2>
        {preis && <p className="mt-1 text-white/70">{preis}</p>}
        {partner && <p className="mt-1 text-xs font-bold uppercase tracking-[.16em] text-white/50">präsentiert von {partner}</p>}
      </div>
      <div className="relative" style={{ width: 'min(78vmin, 640px)', height: 'min(78vmin, 640px)' }}>
        <canvas ref={rad} width={1000} height={1000} className="h-full w-full" />
        <svg className="absolute left-1/2 top-[-18px] h-12 w-10 -translate-x-1/2" viewBox="0 0 40 48" aria-hidden="true">
          <path d="M20 46L4 6h32z" fill="#E8C15A" stroke="#0B0A0B" strokeWidth="3" />
        </svg>
      </div>
      {fertig ? (
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#E8C15A]">Gewonnen hat</p>
          <p className="font-display text-5xl uppercase sm:text-7xl">{ziehung.gewinner.name}</p>
          <p className="mt-2 text-xs text-white/50">
            {t.length} Teilnehmer · {gesamt} Lose · Los-Nr. {ziehung.losNummer} · Seed {ziehung.seed.slice(0, 12)}…
          </p>
        </div>
      ) : (
        <button type="button" className="min-h-12 rounded bg-[#E91D29] px-8 font-bold uppercase tracking-widest" onClick={drehen} disabled={laeuft}>
          {laeuft ? 'Das Rad dreht …' : 'Rad drehen'}
        </button>
      )}
    </div>
  )
}
