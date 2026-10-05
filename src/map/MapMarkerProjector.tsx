import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store/useStore'
import { PLACES } from './places'
import { mapWorld, markerSlots, markerLayer } from './mapWorld'
import { OVERVIEW } from '../camera/mapCamera'
import { setLiveSignal } from '../live/liveSignal'

// ─────────────────────────────────────────────────────────────
// v16-K: klebt die DOM-Marker an ihre 3D-Orte. Läuft im Canvas NACH dem
// CameraRig (gleiche Priorität, spätere Registrierung) → nutzt die Pose
// dieses Frames. Schreibt direkt ins DOM (transform), kein React-Render.
// Bis die Live-Karte steht, sitzen die Marker per CSS auf dem Poster
// (gleiche Kamera → gleiche Stelle); danach übernimmt die Projektion.
// ─────────────────────────────────────────────────────────────

const _v = new THREE.Vector3()
const ANCHORS = PLACES.map((p) => ({ id: p.id, v: new THREE.Vector3(...p.anchor) }))

// DEV: Poster-Generator (scripts/map-poster.mjs) stellt die Totale ein und
// liest die projizierten Marker-Positionen aus. Im Build entfernt.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__mapDev = { OVERVIEW, mapWorld, markerSlots, ANCHORS, setLiveSignal }
}

export function MapMarkerProjector() {
  const camera = useThree((s) => s.camera)
  const frames = useRef(0)
  const lastOpacity = useRef(-1)

  useFrame((state) => {
    const st = useStore.getState()
    const layer = markerLayer.el
    // Live erst nach ein paar Frames in der Totale (Shader/Schatten fertig)
    if (!mapWorld.live && st.ready) {
      // Karte: erst in der Totale (Poster-deckungsgleich); Rundgang: sofort
      if (st.mode === 'tour' || mapWorld.overview > 0.98) frames.current++
      if (frames.current >= 4) {
        mapWorld.live = true
        useStore.getState().setStageLive(true)
      }
    }
    if (!layer || !mapWorld.live) return
    if (!layer.classList.contains('is-live')) layer.classList.add('is-live')

    // Marker blenden mit der Totale aus/ein (während des Flugs zum Ort weg).
    // Ausnahme Trainingsplatz: der Wegweiser IST der Ort → bleibt stehen.
    const keep = st.mode === 'map' && st.place === 'training' ? 'training' : null
    const op = keep ? 1 : st.mode === 'map' ? THREE.MathUtils.smoothstep(mapWorld.overview, 0.55, 0.95) : 0
    if (Math.abs(op - lastOpacity.current) > 0.004) {
      lastOpacity.current = op
      layer.style.opacity = op.toFixed(3)
      layer.style.visibility = op < 0.01 ? 'hidden' : ''
    }
    if (op < 0.01) return

    camera.updateMatrixWorld()
    const W = state.size.width
    const H = state.size.height
    for (const a of ANCHORS) {
      const slot = markerSlots.get(a.id)
      if (!slot?.el) continue
      _v.copy(a.v).project(camera)
      const x = (_v.x * 0.5 + 0.5) * W
      const y = (-_v.y * 0.5 + 0.5) * H
      const vis = _v.z < 1 && x > -40 && x < W + 40 && y > -40 && y < H + 40 && (!keep || a.id === keep)
      if (Math.abs(x - slot.x) > 0.05 || Math.abs(y - slot.y) > 0.05 || vis !== slot.visible) {
        slot.x = x
        slot.y = y
        slot.visible = vis
        slot.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
        slot.el.style.visibility = vis ? '' : 'hidden'
      }
    }
  })

  return null
}
