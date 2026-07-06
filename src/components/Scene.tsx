import { lazy, Suspense } from 'react'
import { useStore } from '../store/useStore'
import { Ground } from './Ground'
import { Pitch } from './Pitch'
import { Goals } from './Goals'
import { Clubhouse } from './Clubhouse'
import { Treeline } from './Treeline'
import { SkyGradient } from './SkyGradient'
import { Floodlights } from './Floodlights'
import { CornerFlags } from './CornerFlags'
import { Barrier } from './Barrier'
import { BallStopFence } from './BallStopFence'
import { BrickHut } from './BrickHut'
import { Village } from './Village'
import { FanBlock } from './FanBlock'
import { Football } from './Football'
import { KickoffDirector } from './KickoffDirector'
import { ConeDust } from './ConeDust'
import { LIGHTING } from '../theme/lighting'

// Partyraum: eigener Chunk — lädt erst, wenn die Musik-Sektion
// näher rückt (partyNear, PartyDirector) → beim Schnitt schon da.
const PartyRoom = lazy(() => import('./PartyRoom'))

// Die Bühne: der ECHTE Platz in Agathenburg (REFERENZ_MODELL.md)
// bei Flutlicht in der Abenddämmerung. Kompass: +x Ost, +z Süd.
// Vereinsheim hinter dem Ost-Tor, Wald S/W/O, Dorf im Norden,
// Klinker-Hütte NW, Fanblock-Ecke SO. Flutlicht = Stilisierung.
export function Scene() {
  const L = LIGHTING
  const partyNear = useStore((s) => s.partyNear)
  return (
    <group>
      <fog attach="fog" args={[L.fog.color, L.fog.near, L.fog.far]} />

      <ambientLight intensity={L.ambient.intensity} color={L.ambient.color} />
      <hemisphereLight args={[L.hemi.sky, L.hemi.ground, L.hemi.intensity]} />
      <directionalLight position={L.moon.position} intensity={L.moon.intensity} color={L.moon.color} />
      <pointLight position={[0, 2.4, 0]} intensity={L.ballAccent.intensity} distance={L.ballAccent.distance} color={L.ballAccent.color} />

      <SkyGradient />
      <Ground />
      <Pitch />
      <Goals />
      <CornerFlags />
      <Barrier />
      <BallStopFence />
      <Floodlights />
      <Clubhouse />
      <BrickHut />
      <Village />
      <FanBlock />
      <Treeline />
      <Football />
      <ConeDust />
      <KickoffDirector />
      {partyNear && (
        <Suspense fallback={null}>
          <PartyRoom />
        </Suspense>
      )}
    </group>
  )
}
