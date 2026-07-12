import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  EffectComposer,
  Bloom,
  Vignette,
  Noise,
  ChromaticAberration,
  ToneMapping,
  SMAA,
} from '@react-three/postprocessing'
import { ToneMappingMode, BlendFunction } from 'postprocessing'
import { useStore } from '../store/useStore'
import { GradeEffect } from './GradeEffect'

// ─────────────────────────────────────────────────────────────
// Die Kino-Ebene (v5): Post-Processing-Kette, jeder Effekt einzeln
// zuschaltbar (Taste „e" → FxPanel) und in zwei Qualitätsstufen
// (store.cinemaTier, utils/device.detectCinemaTier):
//   Bloom      — selektiv: nur HDR-Flächen > Threshold 1.0
//                (Flutlicht-Surge, Lichterkette, geboostete Glows)
//   Grade      — SVA-Film-Look, uWarmth folgt der Durchfahrt
//   CA         — minimal, nur an den Rändern (radialModulation)
//   Vignette   — dezent
//   Grain      — feines Filmkorn (premultiplied → dunkel-betont)
//   DoF        — NUR im Partyraum-Settle (Tresen scharf, Kante weich)
//   ToneMapping (ACES) — immer als Abschluss (ersetzt den Renderer-
//                Pass, den der Composer deaktiviert)
// ─────────────────────────────────────────────────────────────

function Grade() {
  const ref = useRef<GradeEffect>(null)
  const effect = useMemo(() => new GradeEffect(), [])
  useFrame(() => {
    if (ref.current) ref.current.warmth = useStore.getState().partyProgress
  })
  return <primitive ref={ref} object={effect} />
}

export function CinemaEffects() {
  const fx = useStore((s) => s.cinemaFx)
  const tier = useStore((s) => s.cinemaTier)
  const setDpr = useThree((s) => s.setDpr)

  // Voll-Kette: DPR 2 → 1.6 (v5.5: Marge für Fremdlast am Demo-Tag).
  // Die Composer-Passes sind bandbreiten-limitiert; Korn+Bloom decken
  // den Schärfe-Unterschied vollständig. (Gemessen: _v5fx.mjs)
  const heavy = tier === 'full' && (fx.bloom || fx.ca)
  useEffect(() => {
    setDpr(Math.min(window.devicePixelRatio, heavy ? 1.6 : 2))
  }, [heavy, setDpr])

  const chain: React.ReactElement[] = []
  if (fx.bloom)
    chain.push(
      // Loop 1: größerer, weicherer Halo (Referenzframe-Messlatte)
      <Bloom
        key="bloom"
        mipmapBlur
        intensity={1.05}
        radius={0.82}
        luminanceThreshold={1.0}
        luminanceSmoothing={0.25}
        levels={5}
      />,
    )
  if (fx.grade) chain.push(<Grade key="grade" />)
  // DoF (Raum-Moment) in v5 VERWORFEN: DepthOfField wusch die Pocket-
  // Dimension (Tiefe hinter den Wänden = far plane) weiß aus — der
  // Effekt verdient sein Budget nicht. Marvin-To-do, falls gewünscht.
  if (fx.ca)
    chain.push(
      // Loop 1: feiner + weiter außen (Neon-Fringe war zu hart)
      <ChromaticAberration
        key="ca"
        blendFunction={BlendFunction.NORMAL}
        offset={[0.00045, 0.00032]}
        radialModulation
        modulationOffset={0.78}
      />,
    )
  // v13-F1: Vignette + Korn dosiert — die alte Kombination drückte die
  // Ränder zu und ließ die ganze Bühne schwerer wirken, als sie ist.
  if (fx.vignette) chain.push(<Vignette key="vig" eskil={false} offset={0.26} darkness={0.42} />)
  if (fx.grain) chain.push(<Noise key="grain" premultiply opacity={0.32} />)
  chain.push(<ToneMapping key="tm" mode={ToneMappingMode.ACES_FILMIC} />)
  // v13-X1: SMAA als Abschluss (auf dem LDR-Bild) — der Composer hat kein
  // MSAA, ohne diese Pass flimmerten Linien/Banden. Mobil günstig.
  chain.push(<SMAA key="smaa" />)

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {chain}
    </EffectComposer>
  )
}
