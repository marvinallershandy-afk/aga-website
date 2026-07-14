import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PITCH } from '../utils/constants'
import { LIGHTING } from '../theme/lighting'
import { AOBlob } from './AOBlob'
import { floodLevels, floodSurges } from '../three/floodState'

// ─────────────────────────────────────────────────────────────
// Flutlicht mit Substanz: sichtbare Masten (Pole + schräge Streben),
// getiltetes Lampenraster (EIN Mesh mit Emissive-Map statt 6 Boxen),
// Fake-Volumen-Kegel, Glow-Sprite und Licht-Lache am Boden.
// Alles hängt an floodLevels[i] 0..1 → Etappe 3 (Anstoß) dimmt/
// flackert zentral. Kein Postprocessing-Bloom: das Glow-Sprite
// liefert den Blende-Effekt für ~0 Kosten (Entscheidung im Audit).
// ─────────────────────────────────────────────────────────────

const MAST_H = 5.2
const F = LIGHTING.flood

let panelTex: THREE.CanvasTexture | null = null
function getPanelTexture() {
  if (panelTex) return panelTex
  const cv = document.createElement('canvas')
  cv.width = 128; cv.height = 64
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#0a0a0c'
  ctx.fillRect(0, 0, 128, 64)
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = '#fff2d8'
      ctx.fillRect(8 + i * 42, 6 + j * 30, 30, 22)
    }
  }
  panelTex = new THREE.CanvasTexture(cv)
  panelTex.colorSpace = THREE.SRGBColorSpace
  return panelTex
}

let glowTex: THREE.CanvasTexture | null = null
function getGlowTexture() {
  if (glowTex) return glowTex
  const cv = document.createElement('canvas')
  cv.width = cv.height = 128
  const ctx = cv.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,242,214,1)')
  g.addColorStop(0.25, 'rgba(255,226,170,0.55)')
  g.addColorStop(1, 'rgba(255,210,140,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  glowTex = new THREE.CanvasTexture(cv)
  return glowTex
}

// v14-E3: Der Kegel ist kein bemaltes Dreieck mehr, sondern „Licht in
// Luft": ein Shader mit (1) Höhen-Gradient wie bisher, (2) FRESNEL-
// Kantenauflösung — an der Silhouette schaut man durch wenig Medium,
// die harte Geometrie-Kante verschwindet — und (3) träge driftendem
// Dichte-Noise (Dunst bewegt sich im Licht). Additiv, depthWrite aus,
// gleiche Geometrie → 0 zusätzliche Draw-Calls.
const CONE_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const CONE_FRAG = /* glsl */ `
  uniform float uOpacity;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }
  void main() {
    // Höhen-Gradient: hell am Lampenkopf (uv.y=1), Null am Boden
    float grad = pow(clamp(vUv.y, 0.0, 1.0), 1.7);
    // Fresnel: Silhouetten-Kanten lösen sich auf (Volumen statt Kegel)
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float fres = smoothstep(0.05, 0.55, facing);
    // träger Dunst-Drift im Kegel
    float n = noise(vec2(vUv.x * 7.0 + uTime * 0.02, vUv.y * 3.0 - uTime * 0.045));
    float density = 0.72 + 0.55 * n;
    float a = uOpacity * grad * fres * density;
    vec3 col = vec3(1.0, 0.9, 0.69);
    gl_FragColor = vec4(col * a, a);
  }
`
function makeConeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: CONE_VERT,
    fragmentShader: CONE_FRAG,
    uniforms: { uOpacity: { value: 0.4 }, uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  })
}

interface MastProps {
  index: number
  x: number
  z: number
}

function Mast({ index, x, z }: MastProps) {
  const yaw = Math.atan2(z, -x) // Kopf schaut zur Platzmitte (+x lokal → Richtung Mitte)
  const target = useMemo(() => {
    // Licht zielt auf den Viertel-Punkt des Platzes vor dem Mast
    const o = new THREE.Object3D()
    o.position.set(x * 0.35, 0, z * 0.35)
    return o
  }, [x, z])

  const spotRef = useRef<THREE.SpotLight>(null)
  const panelMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const coneMat = useMemo(() => makeConeMaterial(), [])
  const glowMatRef = useRef<THREE.SpriteMaterial>(null)
  const poolRef = useRef<THREE.Mesh>(null)

  // Kegel: Apex am Lampenkopf, Basis auf dem Boden-Zielpunkt
  const cone = useMemo(() => {
    const head = new THREE.Vector3(x, MAST_H + 0.15, z)
    const base = new THREE.Vector3(x * 0.35, 0, z * 0.35)
    const dir = head.clone().sub(base)
    const len = dir.length()
    const mid = head.clone().add(base).multiplyScalar(0.5)
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
    return { mid, quat, len }
  }, [x, z])

  useFrame((state) => {
    const lvl = floodLevels[index]
    const surge = floodSurges[index]
    // Die LAMPE glüht zuerst auf (Emissive-Blitz + Glow + Kegel-Spike),
    // die Rasen-Lache folgt dem Level — Reihenfolge des echten Anschaltens.
    if (spotRef.current) spotRef.current.intensity = F.spotIntensity * lvl
    if (panelMatRef.current) panelMatRef.current.emissiveIntensity = 3.4 * lvl + 7 * surge
    // Faktor ~2.4 gegenüber dem alten Textur-Kegel: Fresnel+Noise nehmen
    // im Mittel wieder weg, was der Gradient allein zu viel hätte.
    coneMat.uniforms.uOpacity.value = 0.38 * lvl + 0.42 * surge
    coneMat.uniforms.uTime.value = state.clock.elapsedTime
    if (glowMatRef.current) glowMatRef.current.opacity = Math.min(1, 0.9 * lvl + 0.8 * surge)
    if (poolRef.current) {
      (poolRef.current.material as THREE.MeshBasicMaterial).opacity = 0.34 * lvl * lvl
    }
  })

  return (
    <group>
      <group position={[x, 0, z]} rotation-y={yaw}>
        {/* Mast */}
        <mesh position={[0, MAST_H / 2, 0]}>
          <cylinderGeometry args={[0.032, 0.055, MAST_H, 8]} />
          <meshStandardMaterial color="#26262c" metalness={0.7} roughness={0.45} />
        </mesh>
        {/* Querträger + getiltetes Lampenraster (1 Mesh, Emissive-Map) */}
        <group position={[0, MAST_H, 0]}>
          <mesh position={[0, -0.05, 0]}>
            <boxGeometry args={[0.1, 0.34, 0.16]} />
            <meshStandardMaterial color="#1a1a1e" metalness={0.6} roughness={0.5} />
          </mesh>
          <group position={[0.22, 0.1, 0]} rotation-z={-0.66}>
            {/* dunkles Gehäuse */}
            <mesh>
              <boxGeometry args={[0.07, 0.85, 0.6]} />
              <meshStandardMaterial color="#101014" metalness={0.5} roughness={0.55} />
            </mesh>
            {/* Leuchtfläche nur vorn (zum Platz) */}
            <mesh position={[0.037, 0, 0]} rotation-y={Math.PI / 2}>
              <planeGeometry args={[0.6, 0.85]} />
              <meshStandardMaterial
                ref={panelMatRef}
                color="#0a0a0c"
                emissive="#ffe6b0"
                emissiveMap={getPanelTexture()}
                emissiveIntensity={3.4}
                toneMapped={false}
                roughness={0.8}
              />
            </mesh>
          </group>
          {/* Glow-Sprite = Fake-Bloom */}
          <sprite position={[0.3, 0.1, 0]} scale={[1.3, 1.0, 1]}>
            <spriteMaterial
              ref={glowMatRef}
              map={getGlowTexture()}
              transparent
              opacity={0.9}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
        </group>
      </group>

      {/* Volumen-Kegel (Fresnel-Shader, s.o.) */}
      <mesh position={cone.mid} quaternion={cone.quat} material={coneMat}>
        <coneGeometry args={[1.9, cone.len, 24, 1, true]} />
      </mesh>

      {/* Licht-Lache + Erdung */}
      <LightPoolWithRef poolRef={poolRef} x={x} z={z} />
      <AOBlob position={[x, 0.006, z]} scale={[1.1, 1.1]} opacity={0.45} />

      <spotLight
        ref={spotRef}
        position={[x, MAST_H + 0.1, z]}
        target={target}
        angle={F.spotAngle}
        penumbra={F.spotPenumbra}
        distance={F.spotDistance}
        intensity={F.spotIntensity}
        color={F.color}
      />
      <primitive object={target} />
    </group>
  )
}

// Licht-Lache mit Ref auf das Mesh (für Level-Dimmen)
function LightPoolWithRef({ poolRef, x, z }: { poolRef: React.RefObject<THREE.Mesh | null>; x: number; z: number }) {
  return (
    <mesh
      ref={poolRef}
      rotation-x={-Math.PI / 2}
      position={[x * 0.42, 0.004, z * 0.42]}
      renderOrder={2}
    >
      <planeGeometry args={[7, 5.2]} />
      <meshBasicMaterial
        map={getGlowTexture()}
        color="#ffdb9c"
        transparent
        opacity={0.34}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

export function Floodlights() {
  const hw = PITCH.width / 2 + 1.7
  const hh = PITCH.height / 2 + 1.7
  return (
    <group>
      <Mast index={0} x={-hw} z={-hh} />
      <Mast index={1} x={hw} z={-hh} />
      <Mast index={2} x={hw} z={hh} />
      <Mast index={3} x={-hw} z={hh} />
    </group>
  )
}
