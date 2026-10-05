import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import './alltag.css'

// ─────────────────────────────────────────────────────────────
// v18-A: schlichtes Sheet für Kalender + Probetraining — natives <dialog>
// (Fokusfalle, Esc, Top-Layer) per Portal an <body>. Mobil Bottom-Sheet,
// Desktop mittig. Tasten/Rad/Wischen werden am Sheet abgefangen, damit
// Karte (Rundgang-Start), Panel-Esc und Galerie-Fokusfalle nicht mitreagieren.
// ─────────────────────────────────────────────────────────────

export function Sheet({
  open,
  onClose,
  kicker,
  titel,
  children,
  label,
}: {
  open: boolean
  onClose: () => void
  kicker?: string
  titel: string
  children: ReactNode
  /** id-Präfix für aria */
  label: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      try {
        d.showModal()
      } catch {
        d.setAttribute('open', '')
      }
    } else if (!open && d.open) d.close()
  }, [open])

  // Hintergrund nicht scrollen lassen (Rundgang = Kamerafahrt)
  useEffect(() => {
    if (!open) return
    const html = document.documentElement
    const vorher = html.style.overflow
    html.style.overflow = 'hidden'
    // Esc gehört dem Sheet — auch wenn der Fokus gerade auf <body> liegt
    // (z. B. nach einem Ansichtswechsel). Capture auf window läuft vor den
    // Esc-Handlern von Karten-Panel/Galerie. Andere Tasten außerhalb des
    // Sheets (Leertaste/↓ = Rundgang-Start) ebenfalls abfangen.
    const onKey = (e: KeyboardEvent) => {
      const d = ref.current
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        closeRef.current()
      } else if (d && !d.contains(e.target as Node)) e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      html.style.overflow = vorher
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  useEffect(() => {
    const d = ref.current
    if (!d) return
    const stop = (e: Event) => e.stopPropagation()
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation()
      if (e.key === 'Escape') {
        e.preventDefault()
        closeRef.current()
      }
    }
    const onCancel = (e: Event) => {
      e.preventDefault()
      closeRef.current()
    }
    // Tipp auf den abgedunkelten Rand schließt
    const onClick = (e: MouseEvent) => {
      if (e.target === d) closeRef.current()
    }
    d.addEventListener('keydown', onKey)
    d.addEventListener('cancel', onCancel)
    d.addEventListener('click', onClick)
    for (const t of ['wheel', 'touchstart', 'touchmove', 'pointerdown']) d.addEventListener(t, stop, { passive: true })
    return () => {
      d.removeEventListener('keydown', onKey)
      d.removeEventListener('cancel', onCancel)
      d.removeEventListener('click', onClick)
      for (const t of ['wheel', 'touchstart', 'touchmove', 'pointerdown']) d.removeEventListener(t, stop)
    }
  }, [])

  if (typeof document === 'undefined') return null
  return createPortal(
    <dialog ref={ref} className="al-sheet" aria-labelledby={`${label}-titel`}>
      {open && (
        <div className="al-sheet__inner">
          <div className="al-sheet__head">
            <div>
              {kicker && <span className="al-sheet__kicker">{kicker}</span>}
              <h2 id={`${label}-titel`} className="al-sheet__titel">
                {titel}
              </h2>
            </div>
            <button type="button" className="al-sheet__close" onClick={onClose} aria-label="Schließen">
              <X size={18} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
          <div className="al-sheet__body">{children}</div>
        </div>
      )}
    </dialog>,
    document.body,
  )
}

