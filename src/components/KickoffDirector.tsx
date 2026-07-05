import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { cameraState, floodLevelAt, kickoffPhase } from '../camera/CameraPath'
import { setFloodLevels } from '../three/floodState'
import { triggerKickoffSwell } from '../utils/kickoffSound'

// Der Anstoß-Director: liest pro Frame den Fahrt-Parameter u und
// schreibt die Flutlicht-Level (sequenzielles Aufflackern, Mast für
// Mast). Rein u-getrieben → vorwärts wie rückwärts identisch, kein
// Video-Gefühl. Sound-Trigger feuert beim Aufwärts-Durchgang.
export function KickoffDirector() {
  const prevK = useRef(0)

  useFrame(() => {
    const u = cameraState.u
    setFloodLevels(
      floodLevelAt(u, 0),
      floodLevelAt(u, 1),
      floodLevelAt(u, 2),
      floodLevelAt(u, 3),
    )
    const k = kickoffPhase(u)
    if (prevK.current < 0.35 && k >= 0.35) triggerKickoffSwell()
    prevK.current = k
  })

  return null
}
