import { Ground } from './Ground'
import { Pitch } from './Pitch'
import { Goals } from './Goals'
import { Clubhouse } from './Clubhouse'
import { Treeline } from './Treeline'
import { SkyGradient } from './SkyGradient'
import { Floodlights } from './Floodlights'
import { CornerFlags } from './CornerFlags'
import { Stands } from './Stands'
import { Football } from './Football'
import { LIGHTING } from '../theme/lighting'

// Die Bühne: der Platz bei Flutlicht in der Abenddämmerung.
// Stilrichtung: veredelte Stilisierung — reduzierte Formen,
// professionelles Licht/Material/Grading, Konsistenz vor Detail.
export function Scene() {
  const L = LIGHTING
  return (
    <group>
      {/* Abgestufter linearer Fog: Platz klar, Welt verschwimmt */}
      <fog attach="fog" args={[L.fog.color, L.fog.near, L.fog.far]} />

      <ambientLight intensity={L.ambient.intensity} color={L.ambient.color} />
      <hemisphereLight args={[L.hemi.sky, L.hemi.ground, L.hemi.intensity]} />
      <directionalLight position={L.moon.position} intensity={L.moon.intensity} color={L.moon.color} />
      <pointLight position={[0, 2.4, 0]} intensity={L.ballAccent.intensity} distance={L.ballAccent.distance} color={L.ballAccent.color} />

      {/* KEIN Environment/IBL: kostet pro Pixel in jedem Standard-
          Material (Frametime-Gate riss um +64%) und bringt in der
          Nachtszene kaum sichtbares Fülllicht. Fill übernehmen
          Hemisphere + Ambient. Entscheidung im Audit dokumentiert. */}

      <SkyGradient />
      <Ground />
      <Pitch />
      <Goals />
      <CornerFlags />
      <Stands />
      <Floodlights />
      <Clubhouse />
      <Treeline />
      <Football />
    </group>
  )
}
