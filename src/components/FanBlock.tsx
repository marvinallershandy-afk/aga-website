import { useMemo, useRef, useState, useLayoutEffect, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { AOBlob } from './AOBlob'
import { getCrowdHumanGeometry } from '../three/humanGeometry'
import { createCrowdMaterials, curveClock, flareFlicker } from '../three/crowdMaterial'
import { buildClothGeometry, createClothMaterial } from '../three/clothMaterial'
import { useStore } from '../store/useStore'
import { FAN_PHOTOS } from '../data/club'
import { cameraState, STATION_COUNT } from '../camera/CameraPath'
import { mapWorld } from '../map/mapWorld'
import {
  CX, HH, SIGN_SPOTS, SIGN_W, SIGN_H, TEAM_X, TEAM_Z,
  buildCurveLayout, instanceMatrix, type Person,
} from './curveLayout'
import { makeClothAtlas, buildClothItems, buildPropsGeometry, ATLAS_W, ATLAS_H } from './curveDressing'
import { BengaloSmoke, CurveGlows, Confetti } from './CurveFx'

// ─────────────────────────────────────────────────────────────
// Der Fanblock in der SÜDOST-Ecke — v14-B „Die Meisterfeier lebt".
//
// Die Südkurve feiert den Aufstieg (Meister 1. Kreisklasse 2026):
//  · Menschen 4.0 — EIN instanziertes Mesh für alle Fans UND die
//    Mannschaft; Hüpfen, Arme-hoch, Klatschen, Schal-Schwenken,
//    Arm-in-Arm-Humba und Pokal-Stemmen laufen komplett im
//    Vertex-Shader (crowdMaterial.ts), phasenversetzt.
//  · Die Mannschaft steht Arm in Arm vor der Bande, der Kapitän
//    reckt den Meisterpokal — der emotionale Kern der Station.
//  · Bengalos mit Rauch, Funken und EINER gemeinsamen flackernden
//    roten Punktlicht-Quelle; Konfetti; wehende Fahnen/Doppelhalter;
//    Handy-Blitze sitzen an den Händen der filmenden Fans.
//  · Die bisherigen Fotos/Banner/Meister-Schild bleiben, Position
//    und Kamerakomposition unverändert.
//
// Perf: ~12 Draw-Calls für die ganze Kurve, pro Frame nur EIN
// Uniform-Update (Kurven-Uhr) + Licht-Flackern + 3 Schild-Wackler —
// und das nur, solange die Fanblock-Station im Bild ist.
// ─────────────────────────────────────────────────────────────

const FAN_U = 3 / (STATION_COUNT - 1) // Station 3 (≈ 0.43)
const ACTIVE_WINDOW = 0.13

// ─── Die Menschen (Fans + Mannschaft) — ein Draw-Call ────────
function CurveCrowd({ people, lod }: { people: Person[]; lod: 'high' | 'low' }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const { geo, mats } = useMemo(() => {
    const geo = getCrowdHumanGeometry(lod).clone()
    const n = people.length
    const cols = new Float32Array(n * 4)
    const style = new Float32Array(n * 4)
    const anim = new Float32Array(n * 4)
    const rnd = new Float32Array(n * 4)
    const hash = (v: number) => { const x = Math.sin(v * 127.1 + 11.7) * 43758.5453; return x - Math.floor(x) }
    people.forEach((p, i) => {
      const k = p.phase + i * 1.618
      rnd.set([hash(k), hash(k + 3.1), hash(k + 7.7), hash(k + 5.3)], i * 4)
      cols.set([p.main, p.accent, p.skin, p.hairCol], i * 4)
      style.set([p.hair, p.garment, p.prop, p.pants], i * 4)
      anim.set([p.mode, p.phase, p.tempo, p.amp], i * 4)
    })
    geo.setAttribute('iCols', new THREE.InstancedBufferAttribute(cols, 4))
    geo.setAttribute('iStyle', new THREE.InstancedBufferAttribute(style, 4))
    geo.setAttribute('iAnim', new THREE.InstancedBufferAttribute(anim, 4))
    geo.setAttribute('iRand', new THREE.InstancedBufferAttribute(rnd, 4))
    return { geo, mats: createCrowdMaterials() }
  }, [people, lod])

  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const mtx = new THREE.Matrix4()
    people.forEach((p, i) => m.setMatrixAt(i, instanceMatrix(p, mtx)))
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
    // Sprünge/Arme ragen aus der Rest-Pose heraus → Bounds etwas größer
    if (m.boundingSphere) m.boundingSphere.radius += 0.12
  }, [people])

  useEffect(() => () => { geo.dispose(); mats.mat.dispose(); mats.depth.dispose() }, [geo, mats])

  return (
    <instancedMesh
      ref={ref}
      args={[geo, mats.mat, people.length]}
      customDepthMaterial={mats.depth}
    />
  )
}

// ─── Stoffe + Requisiten ─────────────────────────────────────
function CurveDressing({ layout }: { layout: ReturnType<typeof buildCurveLayout> }) {
  const { clothGeo, clothMat, propsGeo, propsMat } = useMemo(() => {
    const atlas = makeClothAtlas()
    return {
      clothGeo: buildClothGeometry(buildClothItems(layout), ATLAS_W, ATLAS_H),
      clothMat: createClothMaterial(atlas),
      propsGeo: buildPropsGeometry(layout),
      propsMat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.15, envMapIntensity: 0.5 }),
    }
  }, [layout])
  useEffect(() => () => {
    clothGeo.dispose(); clothMat.map?.dispose(); clothMat.dispose(); propsGeo.dispose(); propsMat.dispose()
  }, [clothGeo, clothMat, propsGeo, propsMat])
  return (
    <>
      <mesh geometry={clothGeo} material={clothMat} />
      <mesh geometry={propsGeo} material={propsMat} />
    </>
  )
}

// ─── Foto-Schilder ───────────────────────────────────────────
// Ein Fan hält ein SCHILD mit einem echten Foto hoch → Klick öffnet die
// Lightbox mit genau diesem Foto. v14-B: Goldrahmen + Foto in EINE
// Canvas-Textur komponiert → 1 Draw-Call pro Schild (vorher 3 + Fan).
function PhotoSign({ index, x, z, y, yaw = 0 }: { index: number; x: number; z: number; y: number; yaw?: number }) {
  const setFanPhoto = useStore((s) => s.setFanPhoto)
  const photo = FAN_PHOTOS[index]
  const src = useTexture(photo.sign as string)
  const grpRef = useRef<THREE.Group>(null)
  const [hover, setHover] = useState(false)
  const tex = useMemo(() => {
    // Maßstab 1280 px/Welt: Rahmen 0.45×0.35, Foto 0.4×0.3
    const cv = document.createElement('canvas')
    cv.width = 576
    cv.height = 448
    const ctx = cv.getContext('2d')!
    const g = ctx.createLinearGradient(0, 0, 576, 448)
    g.addColorStop(0, '#f3d27a')
    g.addColorStop(0.5, '#d9a93e')
    g.addColorStop(1, '#f0cc6e')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 576, 448)
    ctx.fillStyle = '#0f0c0d'
    ctx.fillRect(23, 23, 530, 402)
    const img = src.image as CanvasImageSource | undefined
    if (img) ctx.drawImage(img, 32, 32, 512, 384)
    const t = new THREE.CanvasTexture(cv)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [src])
  useEffect(() => () => tex.dispose(), [tex])
  useFrame(() => {
    const g = grpRef.current
    if (!g) return
    const t = curveClock.uTime.value
    g.rotation.z = Math.sin(t * 1.1 + index * 1.7) * 0.04 * curveClock.uAmp.value
    g.position.y = y + Math.sin(t * 1.5 + index) * 0.006 * curveClock.uAmp.value
  })
  return (
    <group position={[x, 0, z]}>
      {/* Schild-Gruppe: zeigt zur Kamera */}
      <group ref={grpRef} position={[0, y, 0.03]} rotation-y={Math.PI + yaw}>
        <mesh
          scale={hover ? 1.05 : 1}
          onClick={(e) => {
            e.stopPropagation()
            setFanPhoto(index)
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHover(true)
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            setHover(false)
            document.body.style.cursor = ''
          }}
        >
          <planeGeometry args={[SIGN_W + 0.05, SIGN_H + 0.05]} />
          <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={hover ? 0.85 : 0.5} roughness={0.6} />
        </mesh>
      </group>
    </group>
  )
}

function PhotoSigns() {
  const signs = FAN_PHOTOS.map((p, i) => ({ p, i })).filter((e) => !!e.p.sign).slice(0, 3)
  return (
    <>
      {signs.map((e, k) => {
        const spot = SIGN_SPOTS[k]
        return <PhotoSign key={e.i} index={e.i} x={spot.x} z={spot.z} y={spot.y} yaw={spot.yaw} />
      })}
    </>
  )
}

export function FanBlock() {
  const lite = useStore((s) => s.cinemaTier) === 'reduced'
  const reduced = useStore((s) => s.reducedMotion)
  const layout = useMemo(() => buildCurveLayout(lite), [lite])
  const groups = useMemo(() => ({
    high: layout.people.filter((p) => p.lod === 'high'),
    low: layout.people.filter((p) => p.lod === 'low'),
  }), [layout])
  const lightRef = useRef<THREE.PointLight>(null)

  // Die EINE rote Bengalo-Lichtquelle sitzt im Schwerpunkt der Fackeln.
  const lightPos = useMemo(() => {
    const c = new THREE.Vector3()
    layout.flares.forEach((f) => c.add(f))
    c.divideScalar(Math.max(1, layout.flares.length))
    return c.set(c.x, 0.32, c.z - 0.75)
  }, [layout])

  useEffect(() => {
    curveClock.uAmp.value = reduced ? 0.15 : 1
  }, [reduced])

  // Kurven-Uhr: läuft nur, solange die Fanblock-Station im Bild ist —
  // sonst friert die Feier ein (kein Uniform-Update, kein Flackern).
  // Rauch/Glut/Konfetti blenden am Rand des Fensters aus und werden
  // außerhalb komplett unsichtbar (kein eingefrorener Rauch in der
  // Totalen, keine Draw-Calls).
  const fxRef = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    const d = Math.abs(cameraState.u - FAN_U)
    const fade = 1 - THREE.MathUtils.smoothstep(d, ACTIVE_WINDOW * 0.55, ACTIVE_WINDOW)
    const fx = fxRef.current
    if (fx) fx.visible = fade > 0.002
    curveClock.uFx.value = fade
    const light = lightRef.current
    if (d >= ACTIVE_WINDOW) {
      if (light && light.intensity !== 0) light.intensity = 0
      // v16-K: in der Karten-Totale feiern die Fans ruhig weiter (nur die
      // Menge bewegt sich — Rauch/Fackeln/Licht bleiben aus).
      if (mapWorld.fansIdle > 0.01) curveClock.uTime.value += Math.min(dt, 0.05) * 0.6 * (reduced ? 0.4 : 1)
      return
    }
    const t = (curveClock.uTime.value += Math.min(dt, 0.05) * (reduced ? 0.4 : 1))
    if (light) {
      let f = 0
      for (let i = 0; i < layout.flares.length; i++) f += flareFlicker(t, i)
      f /= Math.max(1, layout.flares.length)
      light.intensity = (reduced ? 2.4 : 2.4 * f) * fade
    }
  })

  return (
    <group>
      <CurveCrowd lod="high" people={groups.high} />
      <CurveCrowd lod="low" people={groups.low} />
      <CurveDressing layout={layout} />

      <PhotoSigns />

      {/* Bengalos, Funken, Handy-Blitze, Konfetti — alles GPU-animiert */}
      <group ref={fxRef}>
        <BengaloSmoke flares={layout.flares} perFlare={lite ? 16 : 30} />
        <CurveGlows flares={layout.flares} phones={layout.phones} sparksPerFlare={lite ? 10 : 22} />
        <Confetti count={lite ? 50 : 120} />
      </group>
      {/* die EINE gemeinsame, flackernde rote Bengalo-Lichtquelle */}
      <pointLight ref={lightRef} position={lightPos} color="#ff2f1f" intensity={0} distance={1.25} decay={2} />

      {/* Kontaktschatten: dunkler Boden unter der Kurve + unter der Mannschaft */}
      <AOBlob position={[CX, 0.004, HH + 0.95]} scale={[6.4, 3.2]} opacity={0.62} />
      <AOBlob position={[TEAM_X, 0.006, TEAM_Z - 0.03]} scale={[1.25, 0.36]} opacity={0.55} />
    </group>
  )
}
