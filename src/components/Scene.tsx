import { Ground } from './Ground'
import { Pitch } from './Pitch'
import { PitchLines } from './PitchLines'
import { Goals } from './Goals'
import { Clubhouse } from './Clubhouse'
import { Forest } from './Forest'
import { SkyGradient } from './SkyGradient'
import { Floodlights } from './Floodlights'
import { CornerFlags } from './CornerFlags'
import { Stands } from './Stands'
import { Football } from './Football'
import { COLORS } from '../theme/tokens'

// Die Bühne: der Platz bei Flutlicht in der Abenddämmerung.
export function Scene() {
  return (
    <group>
      {/* Tiefen-Fog */}
      <fogExp2 attach="fog" args={[COLORS.fog, 0.028]} />

      {/* Grundstimmung: kühles Nachtlicht + warmer Fill */}
      <ambientLight intensity={0.32} color="#6a78b0" />
      <hemisphereLight args={['#2a3260', '#141018', 0.5]} />
      <directionalLight position={[-6, 9, -4]} intensity={0.35} color="#8f9fd0" />
      {/* warmer Akzent auf dem Ball / Mittelkreis */}
      <pointLight position={[0, 2.4, 0]} intensity={8} distance={9} color={COLORS.floodWarm} />

      <SkyGradient />
      <Ground />
      <Pitch />
      <PitchLines />
      <Goals />
      <CornerFlags />
      <Stands />
      <Floodlights />
      <Clubhouse />
      <Forest />
      <Football />
    </group>
  )
}
