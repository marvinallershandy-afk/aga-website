import { useEffect, useMemo, useRef, useState } from 'react'
import { FORMATION_SLOTS, slotDepth } from '../data/lineup'
import { WALKOUT_ATLAS } from '../data/walkout'
import { platzStand, type LiveData, type LivePlayer } from './model'
import type { Lineup3D, Lineup3DState } from './lineup3d/scene'

// ─────────────────────────────────────────────────────────────
// v16-W: Hülle der „3D-Aufstellung“. Die three.js-Szene (lineup3d/scene.ts)
// wird erst beim Klick per dynamischem Import geladen — /live bleibt ohne
// Klick so schnell wie bisher (kein three im Start-Bundle).
// Tore, die NACH dem Öffnen im Ticker auftauchen, lassen den Torschützen
// kurz golden aufleuchten; Wechsel blenden den neuen Spieler ein.
// ─────────────────────────────────────────────────────────────

const webglOk = () => {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export function Aufstellung3D({ data, players, onClose }: { data: LiveData; players: Map<string, LivePlayer>; onClose: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<Lineup3D | null>(null)
  const [status, setStatus] = useState<'laden' | 'bereit' | 'fehler'>(() => (webglOk() ? 'laden' : 'fehler'))
  const l = data.lineup
  const stand = useMemo(() => platzStand(l, data.events), [l, data.events])

  const sceneState = useMemo<Lineup3DState | null>(() => {
    if (!l || l.startelf.length !== 11) return null
    const slots = (FORMATION_SLOTS[l.formation] ?? FORMATION_SLOTS['4-4-2']).map((s) => ({ x: s.x, depth: slotDepth(s), role: s.role }))
    return { slots, onField: stand.slots, players, goals: stand.tore }
  }, [l, stand, players])
  const stateRef = useRef(sceneState)
  useEffect(() => { stateRef.current = sceneState })

  // Szene laden (einmal)
  useEffect(() => {
    let dead = false
    const el = host.current
    if (!el || !webglOk()) return
    import('./lineup3d/scene')
      .then(({ createLineup3D }) => createLineup3D(el, WALKOUT_ATLAS))
      .then((s) => {
        if (dead) { s.dispose(); return }
        sceneRef.current = s
        if (stateRef.current) s.update(stateRef.current)
        setStatus('bereit')
        if (import.meta.env.DEV) (window as unknown as { __lineup3d?: Lineup3D }).__lineup3d = s
      })
      .catch(() => { if (!dead) setStatus('fehler') })
    return () => {
      dead = true
      sceneRef.current?.dispose()
      sceneRef.current = null
    }
  }, [])

  // Daten → Szene
  useEffect(() => {
    if (sceneState && status === 'bereit') sceneRef.current?.update(sceneState)
  }, [sceneState, status])

  // Neue Tore (nach dem Öffnen) → Torschütze leuchtet
  const seen = useRef<Set<string> | null>(null)
  useEffect(() => {
    const tore = data.events.filter((e) => e.type === 'tor')
    if (!seen.current) { seen.current = new Set(tore.map((e) => e.id)); return }
    for (const e of tore) {
      if (seen.current.has(e.id)) continue
      seen.current.add(e.id)
      if (e.player) window.setTimeout(() => sceneRef.current?.highlight(e.player!), 300)
    }
  }, [data.events])

  return (
    <div className="lv3d" data-status={status}>
      <div ref={host} className="lv3d__stage" aria-label="3D-Aufstellung: Startelf auf dem Platz. Zum Drehen ziehen." role="img">
        {status === 'laden' && <span className="lv3d__hint">3D-Aufstellung lädt …</span>}
        {status === 'fehler' && <span className="lv3d__hint">3D ist auf diesem Gerät nicht verfügbar.</span>}
      </div>
      <div className="lv3d__bar">
        <span className="lv3d__tip">Ziehen zum Drehen</span>
        <button type="button" className="lv-btn lv-btn--ghost lv3d__close" onClick={onClose}>
          Zurück zur 2D-Ansicht
        </button>
      </div>
    </div>
  )
}
