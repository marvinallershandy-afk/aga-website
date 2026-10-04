import * as THREE from 'three'
import { MAST_POSITIONS } from './forestLayout'

// ─────────────────────────────────────────────────────────────
// v14-A: Wald-Material = MeshLambertMaterial (Mond, Hemi, Fog, statische
// Schatten bleiben intakt; Lambert statt PBR: Laub braucht keinen GGX-
// Glanz und kostet so ~halb so viel pro Pixel) + drei Zusätze per
// onBeforeCompile:
//  1. Wind: Wipfel schwingen langsam (zwei Frequenzen + Böen-Hüllkurve),
//     Stammfuß steht (aWind aus der Geometrie).
//  2. Flutlicht im Laub: warmes Streulicht vom angestrahlten Rasen auf
//     die platzzugewandten Kronenseiten (Abfall mit Distanz zur Platz-
//     fläche) + direkter Spill der vier Lampenköpfe. Hängt live an
//     floodLevels → beim Anstoß-Flackern flackert der Waldrand mit.
//  3. Tiefe: aShade dunkelt Bäume tiefer im Bestand ab (Waldinneres
//     schluckt Licht), aFade lässt Bäume, die aus Kamerasicht den Platz
//     verdecken würden, auf ihren Fuß zusammenschrumpfen (CPU, je Frame).
// ─────────────────────────────────────────────────────────────

export const forestUniforms = {
  uTime: { value: 0 },
  uFlood: { value: new THREE.Vector4(1, 1, 1, 1) },
  uMasts: { value: MAST_POSITIONS.map(([x, z]) => new THREE.Vector3(x, 5.3, z)) },
  uWarm: { value: new THREE.Color('#ffd49a') },
  uBounce: { value: 1.5 },
  uSpill: { value: 1.6 },
  uCardFar: { value: 13 },
}

const VERT_HEAD = /* glsl */ `
attribute float aWind;
attribute float aFade;
attribute float aShade;
attribute float aLeaf;
uniform float uTime;
uniform float uCardFar;
#ifdef FOREST_CARDS
attribute vec3 aCenter;
#endif
varying vec3 vFWP;
varying vec3 vFWN;
varying float vFShade;
varying float vFLeaf;
`

// Instanz-Tönung (Eiche/Buche/Blutbuche) nur aufs Laub, Rinde bleibt Rinde
const VERT_COLOR = /* glsl */ `
#include <color_vertex>
#if defined( USE_INSTANCING_COLOR ) && defined( USE_COLOR )
  vColor.rgb = mix(color.rgb, vColor.rgb, aLeaf);
#endif
`

const VERT_BEGIN = /* glsl */ `
#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 fIPos = instanceMatrix[3].xyz;
#else
  vec3 fIPos = vec3(0.0);
#endif
#ifdef FOREST_CARDS
{
  // Karten-LOD: ferne Kronen (Hero-Drohne, Finale) brauchen keine
  // Fransen — Karten schrumpfen auf ihren Mittelpunkt → keine Fragmente
  vec3 wInst = (modelMatrix * vec4(fIPos, 1.0)).xyz;
  float cs = 1.0 - smoothstep(uCardFar - 3.0, uCardFar, distance(cameraPosition, wInst));
  transformed = mix(aCenter, transformed, cs);
}
#endif
{
  float ph = fIPos.x * 0.83 + fIPos.z * 0.61;
  float gust = 0.55 + 0.45 * sin(uTime * 0.27 + fIPos.x * 0.12 - fIPos.z * 0.08);
  float sw = aWind * gust;
  transformed.x += (sin(uTime * 0.9 + ph + position.y * 2.2) * 0.009
                  + sin(uTime * 2.7 + ph * 1.7 + position.z * 13.0) * 0.003) * sw;
  transformed.z += (cos(uTime * 0.7 + ph * 1.3 + position.y * 1.7) * 0.007
                  + sin(uTime * 2.3 + ph + position.x * 11.0) * 0.0025) * sw;
  transformed *= aFade;
}
`

const VERT_WORLD = /* glsl */ `
#include <worldpos_vertex>
{
#ifdef USE_INSTANCING
  mat4 fM = modelMatrix * instanceMatrix;
#else
  mat4 fM = modelMatrix;
#endif
  vFWP = (fM * vec4(transformed, 1.0)).xyz;
  vFWN = normalize(mat3(fM) * objectNormal);
  vFShade = aShade;
  vFLeaf = aLeaf;
}
`

const FRAG_HEAD = /* glsl */ `
uniform vec4 uFlood;
uniform vec3 uMasts[4];
uniform vec3 uWarm;
uniform float uBounce;
uniform float uSpill;
varying vec3 vFWP;
varying vec3 vFWN;
varying float vFShade;
varying float vFLeaf;
`

// Laub-Klumpen im Fragment: 3D-Value-Noise in Weltkoordinaten (zwei
// Oktaven) → dunkle Lücken zwischen Blattbüscheln, hellere Büschelköpfe.
// Bricht die glatte „Brokkoli"-Schattierung ohne Textur-Fetch.
const FRAG_NOISE = /* glsl */ `
float fHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float fNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(fHash(i + vec3(0, 0, 0)), fHash(i + vec3(1, 0, 0)), f.x),
                 mix(fHash(i + vec3(0, 1, 0)), fHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(fHash(i + vec3(0, 0, 1)), fHash(i + vec3(1, 0, 1)), f.x),
                 mix(fHash(i + vec3(0, 1, 1)), fHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
`

const FRAG_COLOR = /* glsl */ `
#include <color_fragment>
{
  // Laub nur oberhalb des Stamm-Bereichs (Stämme bleiben glatt)
  float n1 = fNoise(vFWP * 13.0);
  float n2 = fNoise(vFWP * 31.0 + 7.3);
  float clump = n1 * 0.65 + n2 * 0.35;
  diffuseColor.rgb *= mix(1.0, 0.45 + clump * 1.05, vFLeaf);
}
diffuseColor.rgb *= vFShade;
`

// Lambert kennt kein IBL — das Hemi-/Ambient-Licht leicht anheben, damit
// der Bestand im Hero/Finale nicht ganz im Schwarz versinkt.
const FRAG_INDIRECT = /* glsl */ `
#include <lights_fragment_end>
reflectedLight.indirectDiffuse *= 1.15;
`

const FRAG_EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
{
  vec3 nW = normalize(vFWN);
  // Streulicht vom angestrahlten Rasen (nächster Punkt der Platzfläche)
  vec3 pp = vec3(clamp(vFWP.x, -5.4, 5.4), 0.0, clamp(vFWP.z, -3.6, 3.6));
  vec3 toP = pp - vFWP;
  float dP = length(toP) + 1e-3;
  float face = clamp(dot(nW, toP / dP) * 0.6 + 0.4, 0.0, 1.0);
  float lvl = dot(uFlood, vec4(0.25));
  // Rasen-Bounce kommt von unten: untere Kronenpartie + Stämme am stärksten
  float low = mix(1.0, 0.35, smoothstep(0.6, 2.8, vFWP.y));
  float bounce = face * exp(-dP * 0.42) * lvl * low;
  // direkter Spill der Lampenköpfe
  float spill = 0.0;
  for (int i = 0; i < 4; i++) {
    vec3 L = uMasts[i] - vFWP;
    float d2 = dot(L, L);
    vec3 Ln = L * inversesqrt(d2);
    float lam = max(dot(nW, Ln), 0.0);
    // Strahler zielen nach innen/unten: Licht nur im (weiten) Kegel
    vec3 aim = normalize(vec3(-0.65 * uMasts[i].x, -uMasts[i].y, -0.65 * uMasts[i].z));
    float cone = smoothstep(0.5, 0.9, dot(aim, -Ln));
    spill += lam * cone * uFlood[i] / (1.0 + d2 * 0.12);
  }
  // Mondlicht-Kappe: Wipfel lesen als Silhouette gegen den Nachthimmel
  float top = max(nW.y, 0.0);
  vec3 moonCap = vec3(0.32, 0.4, 0.62) * top * top * 0.9;
  totalEmissiveRadiance += diffuseColor.rgb * (uWarm * (bounce * uBounce + spill * uSpill) + moonCap) * vFShade;
}
`

// Blatt-Karten: Alpha-Kante schärfen (stabile Deckung auch in fernen
// Mip-Stufen — sonst dünnt der Wald mit der Distanz aus) und die
// DoubleSide-Normalenspiegelung zurücknehmen (Karten tragen Volumen-
// Normalen der Krone, Rückseiten sollen gleich beleuchtet sein).
const FRAG_ALPHA = /* glsl */ `
diffuseColor.a = (diffuseColor.a - 0.5) / max(fwidth(diffuseColor.a), 1e-4) + 0.5;
#include <alphatest_fragment>
`
const FRAG_NORMAL = /* glsl */ `
#include <normal_fragment_begin>
#ifdef DOUBLE_SIDED
  normal *= faceDirection;
#endif
`

function patch(m: THREE.MeshLambertMaterial, cards: boolean) {
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, forestUniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_HEAD)
      .replace('#include <begin_vertex>', VERT_BEGIN)
      .replace('#include <color_vertex>', VERT_COLOR)
      .replace('#include <worldpos_vertex>', VERT_WORLD)
    let f = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_HEAD + FRAG_NOISE)
      .replace('#include <color_fragment>', FRAG_COLOR)
      .replace('#include <emissivemap_fragment>', FRAG_EMISSIVE)
      .replace('#include <lights_fragment_end>', FRAG_INDIRECT)
    if (cards) {
      f = f
        .replace('#include <alphatest_fragment>', FRAG_ALPHA)
        .replace('#include <normal_fragment_begin>', FRAG_NORMAL)
    }
    shader.fragmentShader = f
  }
  if (cards) m.defines = { ...(m.defines ?? {}), FOREST_CARDS: '' }
  m.customProgramCacheKey = () => (cards ? 'sva-forest-cards-v14a' : 'sva-forest-v14a')
}

let shared: THREE.MeshLambertMaterial | null = null
let sharedCards: THREE.MeshLambertMaterial | null = null

export function getForestMaterial(): THREE.MeshLambertMaterial {
  if (shared) return shared
  const m = new THREE.MeshLambertMaterial({ vertexColors: true })
  patch(m, false)
  shared = m
  return m
}

export function getLeafCardMaterial(leafTex: THREE.Texture): THREE.MeshLambertMaterial {
  if (sharedCards) return sharedCards
  const m = new THREE.MeshLambertMaterial({
    vertexColors: true,
    map: leafTex,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  })
  patch(m, true)
  sharedCards = m
  return m
}
