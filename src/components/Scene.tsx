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
import { Football } from './Football'
import { KickoffDirector } from './KickoffDirector'
import { ConeDust } from './ConeDust'
import { LIGHTING } from '../theme/lighting'

// Die Bühne: der ECHTE Platz in Agathenburg (REFERENZ_MODELL.md)
// bei Flutlicht in der Abenddämmerung. Kompass: +x Ost, +z Süd.
// Vereinsheim hinter dem Ost-Tor, Wald S/W/O, Dorf im Norden,
// Klinker-Hütte NW, Fanblock-Ecke SW. Flutlicht = Stilisierung.
export function Scene() {
  const L = LIGHTING
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
      <Treeline />
      <Football />
      <ConeDust />
      <KickoffDirector />
    </group>
  )
}
