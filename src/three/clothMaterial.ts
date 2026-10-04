import * as THREE from 'three'
import { mergeBufferGeometries } from 'three-stdlib'
import { curveClock } from './crowdMaterial'

// ─────────────────────────────────────────────────────────────
// v14-B: Alle Stoffe der Kurve (MEISTER-Banner, AGA-URKNALL-Banner,
// Fahnen, Doppelhalter) in EINEM Mesh mit EINEM Textur-Atlas. Das
// Wehen passiert im Vertex-Shader (vorher CPU-Ripple + computeVertex-
// Normals pro Frame für jedes Tuch) — inkl. analytischer Normale.
//
// Pro Vertex: aCloth = (u entlang des Tuchs 0..1, v 0..1, Modus, Phase)
//             aCloth2 = (Amplitude [Welt], Emission, Tuchbreite [Welt], –)
//             aDisp = Auslenkungsrichtung (Vorderseiten-Normale)
//             aTan  = Tuch-Längsrichtung (für die Normalen-Neigung)
// Modus: 0 statisch · 1 Fahne am Mast (u=0 fest) · 2 Doppelhalter
//        (beide Enden fest) · 3 hochgehaltenes Banner (Enden gehalten)
// ─────────────────────────────────────────────────────────────

export const CLOTH = { STATIC: 0, FLAG: 1, DOUBLE: 2, BANNER: 3 } as const

export interface ClothItem {
  /** Atlas-Rechteck in Pixeln (x, y, w, h) */
  rect: [number, number, number, number]
  w: number
  h: number
  segX: number
  segY: number
  mode: number
  amp: number
  phase: number
  emissive?: number
  /** Welt-Transform (Plane liegt lokal in xy, Vorderseite +z) */
  matrix: THREE.Matrix4
  /** Rückseite mitliefern (gespiegelt wie echter Stoff) */
  back?: boolean | 'readable'
}

export function buildClothGeometry(items: ClothItem[], atlasW: number, atlasH: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const nrm = new THREE.Matrix3()
  for (const it of items) {
    for (const side of it.back ? [1, -1] : [1]) {
      const g = new THREE.PlaneGeometry(it.w, it.h, it.segX, it.segY)
      const pos = g.getAttribute('position')
      const uv = g.getAttribute('uv')
      const n = pos.count
      const cl = new Float32Array(n * 4)
      const cl2 = new Float32Array(n * 4)
      const [rx, ry, rw, rh] = it.rect
      for (let i = 0; i < n; i++) {
        const u = uv.getX(i)
        const v = uv.getY(i)
        // Rückseite ist um y gedreht → dieselbe physische Tuchstelle hat
        // dort u' = 1 − u. aCloth.x beschreibt immer die PHYSISCHE Stelle,
        // damit Vorder- und Rückseite exakt gleich wehen.
        const pu = side > 0 ? u : 1 - u
        cl[i * 4] = pu
        cl[i * 4 + 1] = v
        cl[i * 4 + 2] = it.mode
        cl[i * 4 + 3] = it.phase
        cl2[i * 4] = it.amp
        cl2[i * 4 + 1] = it.emissive ?? 0
        cl2[i * 4 + 2] = it.w
        // Atlas-UV: gespiegelte Rückseite = gleicher Texel wie vorn (echter
        // Stoff); „readable" = eigenes u (doppelt bedrucktes Banner).
        const au = side < 0 && it.back === 'readable' ? u : pu
        uv.setXY(i, (rx + au * rw) / atlasW, 1 - (ry + (1 - v) * rh) / atlasH)
      }
      g.setAttribute('aCloth', new THREE.BufferAttribute(cl, 4))
      g.setAttribute('aCloth2', new THREE.BufferAttribute(cl2, 4))
      if (side < 0) g.rotateY(Math.PI)
      const disp = new Float32Array(n * 3)
      const tan = new Float32Array(n * 3)
      nrm.getNormalMatrix(it.matrix)
      const d = new THREE.Vector3(0, 0, 1).applyMatrix3(nrm).normalize()
      const t = new THREE.Vector3(1, 0, 0).transformDirection(it.matrix)
      for (let i = 0; i < n; i++) {
        disp.set([d.x, d.y, d.z], i * 3)
        tan.set([t.x, t.y, t.z], i * 3)
      }
      g.setAttribute('aDisp', new THREE.BufferAttribute(disp, 3))
      g.setAttribute('aTan', new THREE.BufferAttribute(tan, 3))
      g.applyMatrix4(it.matrix)
      parts.push(g)
    }
  }
  const merged = mergeBufferGeometries(parts)!
  parts.forEach((p) => p.dispose())
  return merged
}

const GLSL_HEAD = /* glsl */ `
attribute vec4 aCloth;
attribute vec4 aCloth2;
attribute vec3 aDisp;
attribute vec3 aTan;
uniform float uTime;
uniform float uAmp;
varying float vClothEmis;

// Auslenkung (normiert) + Ableitung nach u
vec2 clothWave(float u, float v, float mode, float ph, float t){
  if (mode < 0.5) return vec2(0.);
  if (mode < 1.5) {           // Fahne: freies Ende flattert
    float a1 = 6. * u - 4.2 * t + ph, a2 = 3. * u - 2.5 * t + ph + v * 1.3;
    float s = sin(a1) * 0.6 + sin(a2) * 0.4;
    float ds = cos(a1) * 3.6 + cos(a2) * 1.2;
    return vec2(s * u, ds * u + s);
  }
  float grip = sin(u * 3.14159265);
  float dgrip = cos(u * 3.14159265) * 3.14159265;
  if (mode < 2.5) {           // Doppelhalter: zwischen zwei Stangen
    float a = 5. * u - 2.8 * t + ph + v * 2.;
    float s = sin(a);
    return vec2(s * grip, cos(a) * 5. * grip + s * dgrip);
  }
  // Banner (wie v9-E2): zwei wandernde Sinus, an den Halte-Enden gedämpft
  float a1 = 7.5 * u - 3.1 * t, a2 = 4. * u - 2. * t + v * 0.9;
  float s = sin(a1) * 0.58 + sin(a2) * 0.42;
  float ds = cos(a1) * 7.5 * 0.58 + cos(a2) * 4. * 0.42;
  float g = 0.35 + 0.65 * grip;
  return vec2(s * g, ds * g + s * 0.65 * dgrip);
}
`

export function createClothMaterial(map: THREE.Texture): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    map,
    emissiveMap: map,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 1,
    roughness: 0.88,
    envMapIntensity: 0.4,
  })
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = curveClock.uTime
    sh.uniforms.uAmp = curveClock.uAmp
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + GLSL_HEAD)
      .replace(
        '#include <beginnormal_vertex>',
        `vec3 objectNormal = vec3(normal);
  float cAmp = aCloth2.x * mix(0.25, 1.0, uAmp);
  vec2 cw = clothWave(aCloth.x, aCloth.y, aCloth.z, aCloth.w, uTime) * cAmp;
  float cSide = sign(dot(objectNormal, aDisp) + 1e-4);
  objectNormal = normalize(objectNormal - cSide * aTan * (cw.y / max(aCloth2.z, 0.01)));
  vClothEmis = aCloth2.y;`,
      )
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position) + aDisp * cw.x;
  if (aCloth.z > 2.5) transformed.y += sin(uTime * 1.4) * 0.008 * uAmp;`,
      )
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vClothEmis;')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vClothEmis;',
      )
  }
  mat.customProgramCacheKey = () => 'sva-cloth-v1'
  return mat
}
