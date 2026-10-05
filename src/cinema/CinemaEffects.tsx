import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import {
  EffectComposer,
  Bloom,
  Vignette,
  Noise,
  ChromaticAberration,
  ToneMapping,
  SMAA,
} from '@react-three/postprocessing'
import { ToneMappingMode, BlendFunction, RenderPass, type EffectComposer as EffectComposerImpl } from 'postprocessing'
import { partyScene } from '../three/partyScene'
import { useStore } from '../store/useStore'
import { GradeEffect } from './GradeEffect'
import { TiltEdgeEffect } from './TiltEdgeEffect'
import { mapWorld } from '../map/mapWorld'

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

// v16-K: Tilt-Shift-Rand der Karten-Totale (Stärke folgt mapWorld.tilt)
function TiltEdge() {
  const ref = useRef<TiltEdgeEffect>(null)
  const effect = useMemo(() => new TiltEdgeEffect(), [])
  useFrame(() => {
    if (ref.current) ref.current.strength = mapWorld.tilt
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
  // v14: Telefone bekamen bisher die HÖCHSTE Füllrate (min(dpr,2), weil die
  // reduzierte Kette nie „heavy" ist). Touch-Geräte jetzt hart auf 1.5 —
  // auf 3x-Displays optisch kaum zu unterscheiden, ~45 % weniger Pixel.
  // v14-R: adaptive Auflösung — fällt die Bildrate (Akku-Sparmodus,
  // schwache GPU, Hintergrundlast), senkt PerformanceMonitor den Faktor in
  // Stufen bis 0,6; erholt sie sich, geht er wieder hoch. Nie unter DPR 1.
  const [dprScale, setDprScale] = useState(1)
  useEffect(() => {
    const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false
    const cap = touch ? 1.5 : heavy ? 1.6 : 2
    const base = Math.min(window.devicePixelRatio, cap)
    setDpr(Math.max(Math.min(1, base), base * dprScale))
  }, [heavy, setDpr, dprScale])

  const chain: React.ReactElement[] = []
  // v16-K: MUSS der erste Effekt sein (liest inputBuffer = Szenenfarbe).
  chain.push(<TiltEdge key="tilt" />)
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
  if (fx.grain) chain.push(<Noise key="grain" premultiply opacity={0.18} />)
  chain.push(<ToneMapping key="tm" mode={ToneMappingMode.ACES_FILMIC} />)
  // v13-X1: SMAA als Abschluss (auf dem LDR-Bild) — der Composer hat kein
  // MSAA, ohne diese Pass flimmerten Linien/Banden. Mobil günstig.
  chain.push(<SMAA key="smaa" />)

  // v14: zweite RenderPass für die Partyraum-Szene (eigene Lichter), ohne
  // Clear und ohne Hintergrund → landet tiefenkorrekt im selben Puffer.
  const composerRef = useRef<EffectComposerImpl>(null)
  const partyPassRef = useRef<RenderPass | null>(null)
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const composer = composerRef.current
    if (!composer) return
    const pass = new RenderPass(partyScene, camera)
    pass.clearPass.enabled = false
    pass.ignoreBackground = true
    pass.skipShadowMapUpdate = true
    // renderer.autoClear steht beim Rendern wieder auf true (R3F/Szene setzt
    // es zurück) → three würde vor dem Raum Farbe+Tiefe löschen und die
    // Außenwelt schwarz machen. Für diese Pass explizit aus, danach zurück.
    const render = pass.render.bind(pass)
    pass.render = (renderer, inputBuffer, outputBuffer, deltaTime, stencilTest) => {
      const auto = renderer.autoClear
      renderer.autoClear = false
      render(renderer, inputBuffer, outputBuffer, deltaTime, stencilTest)
      renderer.autoClear = auto
    }
    composer.addPass(pass, 1)
    partyPassRef.current = pass
    return () => {
      partyPassRef.current = null
      composer.removePass(pass)
      pass.dispose()
    }
  }, [camera])
  // Die Raum-Pass zeichnet erst, wenn die Shader des Raums asynchron
  // (KHR_parallel_shader_compile) fertig sind — sonst blockierte die erste
  // Zeichnung den Main-Thread mitten in der Fahrt.
  const gl = useThree((s) => s.gl)
  const partyState = useRef<'idle' | 'compiling' | 'ready'>('idle')
  useFrame(() => {
    // gleiche Nacht-IBL wie draußen (NightEnvironment setzt sie auf scene)
    partyScene.environment = scene.environment
    partyScene.environmentIntensity = scene.environmentIntensity
    const pass = partyPassRef.current
    if (!pass) return
    if (partyState.current === 'idle') {
      pass.enabled = false
      if (partyScene.children.length > 0) {
        partyState.current = 'compiling'
        gl.compileAsync(partyScene, camera)
          .catch(() => undefined)
          .then(() => {
            partyState.current = 'ready'
          })
      }
    } else if (partyState.current === 'ready' && !pass.enabled) {
      pass.enabled = true
    }
  })

  return (
    <>
    <PerformanceMonitor
      flipflops={4}
      onDecline={() => setDprScale((v) => Math.max(0.6, +(v - 0.15).toFixed(2)))}
      onIncline={() => setDprScale((v) => Math.min(1, +(v + 0.1).toFixed(2)))}
      onFallback={() => setDprScale(0.6)}
    />
    <EffectComposer ref={composerRef} multisampling={0} enableNormalPass={false}>
      {chain}
    </EffectComposer>
    </>
  )
}
