import * as THREE from 'three'
import { RIG, MOVE } from './humanGeometry'

// ─────────────────────────────────────────────────────────────
// v14-B „Die Meisterfeier lebt": Vertex-Shader-Skelett für die
// instanzierten Menschen (Fans + Mannschaft). Keine CPU-Matrix-
// Updates pro Instanz und Frame — pro Frame wandert genau EIN
// Uniform (uTime) in die GPU; der Shader leitet daraus Hüpfen,
// Arm-Pumpen, Klatschen, Schal-Schwenken, Arm-in-Arm-Wippen und
// das Pokal-Stemmen ab, phasenversetzt pro Instanz.
//
// Instanz-Attribute:
//   iCols  = Paletten-Index (Trikot, Akzent, Haut, Haar)
//   iStyle = (Frisur 0–5, Kleidung 0–3, Requisit 0–5, Hose)
//   iAnim  = (Modus, Phase, Tempo [Sprünge/s], Amplitude)
// ─────────────────────────────────────────────────────────────

/** Gemeinsame Uhr der Kurve: ein Uniform-Objekt für ALLE Shader. */
export const curveClock = {
  uTime: { value: 0 },
  /** globale Bewegungs-Amplitude (prefers-reduced-motion → ~0.15) */
  uAmp: { value: 1 },
  /** Effekt-Sichtbarkeit 0..1 (Rauch/Glut blenden mit der Station ein/aus) */
  uFx: { value: 0 },
  /** v19-3D (§2.11): Konfetti-Puls — 1 beim Ankommen, klingt in ~2,5 s ab */
  uConfetti: { value: 0 },
}

/** Flacker-Funktion der Bengalos (identisch im Glow-Shader, CurveFx.tsx) */
export function flareFlicker(t: number, i: number) {
  return 0.78 + 0.13 * Math.sin(t * 23.0 + i * 3.1) + 0.09 * Math.sin(t * 37.0 + i * 1.7) * Math.sin(t * 5.3 + i)
}

// Farb-Palette (Index = Position). Linear umgerechnet beim Erzeugen.
export const PAL = {
  SKIN: [0, 1, 2, 3, 4],
  HAIR: [5, 6, 7, 8, 9, 10],
  RED: 11, RED_DARK: 12, BLACK: 13, WHITE: 14, GREY: 15, NAVY: 16,
  JEANS: 17, DARK_PANTS: 18, SHOE_DARK: 19, SHOE_WHITE: 20,
  SCARF_RED: 21, SCARF_WHITE: 22, GOLD: 23, TEAM_RED: 24, OLIVE: 25,
  BEANIE: [11, 13, 14],
} as const

const PAL_HEX = [
  // Haut
  '#c99a75', '#b98a66', '#a87757', '#7e5640', '#d9ab84',
  // Haar
  '#2a2320', '#3d2f24', '#171412', '#5a4630', '#8a7355', '#4a4a4e',
  // Kleidung
  '#c9202b', '#8f1620', '#1a1719', '#d8d4c9', '#4a4a50', '#23252c',
  '#2e3a52', '#232025', '#1b1a1c', '#d9d6cf',
  '#c41824', '#f2eee6', '#e8b94a', '#d31f2a', '#3b3d2e',
]

function paletteUniform(): THREE.Vector3[] {
  const c = new THREE.Color()
  return PAL_HEX.map((h) => {
    c.set(h)
    return new THREE.Vector3(c.r, c.g, c.b)
  })
}

const GLSL_HEAD = /* glsl */ `
attribute vec4 aInfo;
attribute float aMask;
attribute vec4 iCols;
attribute vec4 iStyle;
attribute vec4 iAnim;
attribute vec4 iRand;
uniform float uTime;
uniform float uAmp;
uniform vec3 uPal[${PAL_HEX.length}];
varying vec3 vCrowdCol;
varying float vMetal;

mat3 crX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0., 0.,c,s, 0.,-s,c);}
mat3 crY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s, 0.,1.,0., s,0.,c);}
mat3 crZ(float a){float c=cos(a),s=sin(a);return mat3(c,s,0., -s,c,0., 0.,0.,1.);}
// Pose als SKALARE (billig); Matrizen baut jeder Vertex nur für seinen Knochen.
struct CPose { float lean; float sway; float twist; float nod; vec4 L; vec4 R; float hop; float crouch; };

const vec3 C_HIP = vec3(0., ${RIG.HIP.y.toFixed(3)}, 0.);
const vec3 C_NECK = vec3(0., ${RIG.NECK.y.toFixed(3)}, 0.);

CPose crowdPose(){
  float mode = iAnim.x;
  float ph = iAnim.y;
  float amp = iAnim.w * uAmp;
  float T = uTime * iAnim.z + ph;
  float hsRaw = abs(sin(3.14159265*T));       // 0 = Bodenkontakt, 1 = Scheitel
  float hs = mix(0.5, hsRaw, amp);
  float sw = sin(1.5707963*T) * amp;           // halbe Frequenz (Schwenken)
  float r1 = iRand.x, r2 = iRand.y, r3 = iRand.z;
  float vary = (r2 - 0.5) * 0.3;
  float lean = 0.03 + (r1 - 0.5) * 0.08, sway = 0., twist = (r2 - 0.5) * 0.3, nod = (r3 - 0.5) * 0.14;
  float aL = 0.06, fL = 0.06, eL = 0.15 + r3 * 0.2, dL = 0.;
  float aR = 0.06, fR = 0.06, eR = 0.15 + r1 * 0.2, dR = 0.;
  float hop = 0., jump = 0.;
  if (mode < 0.5) {            // STAND: schunkeln, Becher/Hand vor dem Bauch
    sway = 0.05 * sw; nod += 0.05 * sin(3.14159*T) * amp;
    eR = 1.2; fR = 0.3; aR = 0.12; dR = 0.15; eL = 0.3 + 0.2 * r3;
    hop = 0.008 * hsRaw * amp;
  } else if (mode < 1.5) {     // JUMP_V: Arme im V, Sprung
    aL = aR = 2.3 + 0.32 * hs + vary; fL = fR = 0.35; eL = eR = 0.6 - 0.45 * hs;
    lean += 0.07 * (1. - hs); jump = 1.; hop = 0.075 * pow(hsRaw, 1.4) * amp; nod -= 0.12;
  } else if (mode < 2.5) {     // CLAP: Hände vor dem Gesicht zusammen
    float c = mix(0.5, 0.5 + 0.5 * cos(6.2831853 * T), amp);
    fL = fR = 1.2 + vary * 0.4; eL = eR = 1.15; aL = aR = 0.05; dL = dR = 0.12 + 0.3 * c;
    hop = 0.018 * hsRaw * amp; nod -= 0.08;
  } else if (mode < 3.5) {     // SCARF: Schal über dem Kopf, schwenkt
    aR = 2.68 - 0.32 * sw; aL = 2.68 + 0.32 * sw; fL = fR = 0.22; eL = eR = 0.1;
    sway = -0.09 * sw; hop = 0.015 * hsRaw * amp; nod -= 0.15;
  } else if (mode < 4.5) {     // FIST: rechte Faust pumpt
    aR = 2.4 + 0.3 * hs; fR = 0.4; eR = 1.05 - 0.85 * hs; aL = 0.18; eL = 0.55; fL = 0.3;
    jump = 1.; hop = 0.045 * pow(hsRaw, 1.4) * amp; nod -= 0.1;
  } else if (mode < 5.5 || mode > 12.5) { // ARMLOCK: Arm in Arm, Hüpfen im Takt (Humba)
    aL = aR = 1.47 + 0.05 * sw; fL = fR = -0.28; eL = eR = 0.6; dL = dR = 0.;
    jump = 1.; hop = 0.07 * pow(hsRaw, 1.3) * amp; lean = 0.1 + 0.06 * (1. - hs); twist *= 0.3; nod = -0.12 + 0.06 * hs;
    // Kettenenden (13 = links außen, 14 = rechts außen): der freie Arm reckt die Faust
    if (mode > 12.5 && mode < 13.5) { aL = 2.45 + 0.3 * hs; fL = 0.4; eL = 0.85 - 0.65 * hs; }
    if (mode > 13.5) { aR = 2.45 + 0.3 * hs; fR = 0.4; eR = 0.85 - 0.65 * hs; }
  } else if (mode < 6.5) {     // TROPHY: Pokal in die Höhe stemmen
    aL = aR = 2.98 - 0.08 * (1. - hs); fL = fR = 0.16; eL = eR = 0.12 + 0.75 * (1. - hs);
    jump = 1.; hop = 0.07 * pow(hsRaw, 1.3) * amp; lean = -0.06; twist = 0.; nod = -0.3;
  } else if (mode < 7.5) {     // HOLD: Stange vor der Brust (Banner, Doppelhalter)
    fL = fR = 1.12; aL = aR = 0.22; dL = dR = 0.18; eL = eR = 0.55;
    hop = 0.008 * hsRaw * amp; sway = 0.02 * sw; twist *= 0.3;
  } else if (mode < 8.5) {     // LEAN: an der Reling
    lean = 0.42; fL = fR = 1.0; eL = eR = 0.5; aL = aR = 0.14; dL = dR = 0.18; nod = -0.3 + 0.05 * sw;
  } else if (mode < 9.5) {     // FLAG: rechter Arm hält die Fahne (statisch)
    aR = 2.55; fR = 0.45; eR = 0.2; dR = 0.; lean = 0.04; twist = 0.;
    aL = 0.15; eL = 0.6 + 0.3 * hs; nod = -0.1;
  } else if (mode < 10.5) {    // PHONE: filmt (rechter Arm statisch)
    fR = 1.65; aR = 0.12; dR = 0.3; eR = 0.5; lean = 0.04; twist = 0.;
    aL = 0.1; eL = 0.35; nod = 0.05;
  } else if (mode < 11.5) {    // SIGN: beide Arme hoch an den Schild-Stangen
    aL = aR = 2.78; fL = fR = 0.35; eL = eR = 0.35; lean = 0.03; twist = 0.; nod = -0.2;
  } else {                     // FLARE: Bengalo gereckt (rechts statisch), links pumpt
    aR = 2.65; fR = 0.35; eR = 0.15; dR = 0.; lean = 0.04; twist = 0.;
    aL = 2.3 + 0.3 * hs; fL = 0.4; eL = 0.9 - 0.6 * hs; nod = -0.15;
  }
  aL += 0.1; aR += 0.1; // Grund-Abspreizung: Arme hängen frei neben dem Rumpf
  CPose P;
  P.lean = lean; P.sway = sway; P.twist = twist; P.nod = nod;
  P.L = vec4(aL, fL, eL, dL);
  P.R = vec4(aR, fR, eR, dR);
  P.hop = hop;
  P.crouch = jump * 0.06 * pow(1. - hsRaw, 6.) * amp;
  return P;
}

vec3 crowdXform(float bone, vec3 p, inout vec3 n, CPose P){
  if (bone > 2.5) {
    bool left = bone < 4.5;
    float s = left ? -1. : 1.;
    vec3 SH = vec3(s * ${RIG.SHOULDER_X.toFixed(3)}, ${RIG.SHOULDER_Y.toFixed(3)}, 0.);
    vec3 EB = vec3(s * ${RIG.SHOULDER_X.toFixed(3)}, ${RIG.ELBOW_Y.toFixed(3)}, 0.);
    vec4 J = left ? P.L : P.R;   // (Abspreizen, Vorheben, Ellbogen, Heranführen)
    if (abs(bone - 4.) < 0.5 || abs(bone - 6.) < 0.5) {
      mat3 E = crX(-J.z);
      p = E * (p - EB) + EB; n = E * n;
    }
    mat3 A = crY(-s * J.w) * crZ(s * J.x) * crX(-J.y);
    p = A * (p - SH) + SH; n = A * n;
  } else if (bone > 1.5) {
    mat3 Hd = crY(P.twist * 0.5) * crX(P.nod);
    p = Hd * (p - C_NECK) + C_NECK; n = Hd * n;
  }
  if (bone > 0.5) {
    mat3 S = crY(P.twist) * crZ(P.sway) * crX(P.lean);
    p = S * (p - C_HIP) + C_HIP; n = S * n;
    p.y -= P.crouch * C_HIP.y;
  } else {
    p.y *= 1. - P.crouch;
  }
  p.y += P.hop;
  return p;
}

bool crowdVisible(){
  float m = aMask;
  if (m < 0.5) return true;
  if (m < 9.5) return abs(m - iStyle.x) < 0.5;
  if (m < 10.5) return abs(iStyle.y - 1.) < 0.5;
  if (m < 11.5) return abs(iStyle.y - 2.) < 0.5;
  if (m < 12.5) return iStyle.y < 0.5 || iStyle.y > 2.5;
  return abs(m - 19. - iStyle.z) < 0.5;
}

vec3 crowdColor(out float metal){
  int zone = int(aInfo.w + 0.5);
  float g = iStyle.y;
  bool team = g > 2.5;
  bool shortSleeve = g < 0.5 || team;
  vec3 cMain = uPal[int(iCols.x + 0.5)];
  vec3 cAcc = uPal[int(iCols.y + 0.5)];
  vec3 cSkin = uPal[int(iCols.z + 0.5)];
  vec3 cHair = uPal[int(iCols.w + 0.5)];
  vec3 cPants = uPal[int(iStyle.w + 0.5)];
  float r = iRand.w;
  metal = 0.;
  vec3 c = cMain;
  if (zone == 0) c = cSkin;
  else if (zone == 2) c = cAcc;
  else if (zone == 3) c = shortSleeve ? cSkin : cMain;
  else if (zone == 4) c = cPants;
  else if (zone == 5) c = team ? cSkin : cPants;
  else if (zone == 6) c = team ? cMain : cPants;
  else if (zone == 7) c = (!team && r > 0.62) ? uPal[${PAL.SHOE_WHITE}] : uPal[${PAL.SHOE_DARK}];
  else if (zone == 8) c = cHair;
  else if (zone == 9) c = uPal[${PAL.SCARF_RED}];
  else if (zone == 10) c = uPal[${PAL.SCARF_WHITE}];
  else if (zone == 11) { c = uPal[${PAL.GOLD}]; metal = 1.; }
  else if (zone == 12) c = team ? cAcc : cMain;
  else if (zone == 13) c = vec3(0.02, 0.02, 0.025);
  else if (zone == 14) c = vec3(0.35, 0.03, 0.03);
  // leichte Stoff-/Hautton-Streuung pro Person
  if (metal < 0.5) c *= 0.9 + 0.2 * r;
  return c;
}

void crowdMain(inout vec3 cPos, inout vec3 cNrm){
  // ausgeblendete Varianten (andere Frisuren, Requisiten …) sofort
  // auf einen Punkt kollabieren — spart die komplette Pose-Rechnung
  if (!crowdVisible()) { cPos = vec3(0.); return; }
  CPose P = crowdPose();
  vec3 n1 = cNrm;
  vec3 p1 = crowdXform(aInfo.x, cPos, n1, P);
  if (aInfo.z > 0.001) {
    vec3 n2 = cNrm;
    vec3 p2 = crowdXform(aInfo.y, cPos, n2, P);
    p1 = mix(p1, p2, aInfo.z);
    vec3 nm = mix(n1, n2, aInfo.z);
    n1 = dot(nm, nm) > 1e-4 ? normalize(nm) : n1;
  }
  cPos = p1; cNrm = n1;
}
`

function patchVertex(src: string, withNormal: boolean): string {
  let s = src.replace('#include <common>', '#include <common>\n' + GLSL_HEAD)
  if (withNormal) {
    s = s.replace(
      '#include <beginnormal_vertex>',
      `vec3 objectNormal = vec3(normal);
#ifdef USE_TANGENT
  vec3 objectTangent = vec3(tangent.xyz);
#endif
  vec3 cPos = vec3(position);
  crowdMain(cPos, objectNormal);
  vCrowdCol = crowdColor(vMetal);`,
    )
    s = s.replace('#include <begin_vertex>', 'vec3 transformed = cPos;\n#ifdef USE_ALPHAHASH\n  vPosition = vec3(position);\n#endif')
  } else {
    s = s.replace(
      '#include <begin_vertex>',
      `vec3 transformed = vec3(position);
  vec3 cDummyN = vec3(0., 1., 0.);
  crowdMain(transformed, cDummyN);
  vCrowdCol = crowdColor(vMetal);`,
    )
  }
  return s
}

/**
 * Material + Schatten-Tiefenmaterial für die Kurven-Menschen.
 * Beide teilen Uhr und Palette; das Tiefenmaterial sorgt dafür, dass
 * der statische Schatten-Bake die posierte Silhouette sieht (nicht
 * alle Frisur-/Requisiten-Varianten übereinander).
 */
export function createCrowdMaterials() {
  const pal = { value: paletteUniform() }
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0, envMapIntensity: 0.4 })
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = curveClock.uTime
    sh.uniforms.uAmp = curveClock.uAmp
    sh.uniforms.uPal = pal
    sh.vertexShader = patchVertex(sh.vertexShader, true)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCrowdCol;\nvarying float vMetal;')
      .replace('#include <color_fragment>', 'diffuseColor.rgb *= vCrowdCol;')
      .replace(
        '#include <metalnessmap_fragment>',
        'float metalnessFactor = mix(metalness, 0.85, vMetal);',
      )
      .replace(
        '#include <roughnessmap_fragment>',
        'float roughnessFactor = mix(roughness, 0.3, vMetal);',
      )
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n  totalEmissiveRadiance += vCrowdCol * vMetal * 0.55;',
      )
  }
  mat.customProgramCacheKey = () => 'sva-crowd-v4'

  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
  depth.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = curveClock.uTime
    sh.uniforms.uAmp = curveClock.uAmp
    sh.uniforms.uPal = pal
    sh.vertexShader = patchVertex(sh.vertexShader, false)
  }
  depth.customProgramCacheKey = () => 'sva-crowd-v4-depth'
  return { mat, depth }
}

// ─── CPU-Spiegel für STATISCHE rechte Arme ───────────────────
// Fahne, Handy und Bengalo hängen an einer Hand, deren Pose in diesen
// Modi bewusst nicht schwingt → wir können die Welt-Position der Hand
// einmalig auf der CPU ausrechnen (identische Mathematik wie im Shader)
// und Fahnenmast, Handy-Blitz und Bengalo-Rauch exakt dort andocken.
const STATIC_R: Record<number, { a: number; f: number; e: number; d: number }> = {
  [MOVE.FLAG]: { a: 2.55, f: 0.45, e: 0.2, d: 0 },
  [MOVE.PHONE]: { a: 0.12, f: 1.65, e: 0.5, d: 0.3 },
  [MOVE.FLARE]: { a: 2.65, f: 0.35, e: 0.15, d: 0 },
}

const _m = new THREE.Matrix4()
const _r = new THREE.Matrix4()
export function posedRightHandPoint(mode: number, rest: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 {
  const P = STATIC_R[mode]
  if (!P) return out.copy(rest)
  const EB = new THREE.Vector3(RIG.SHOULDER_X, RIG.ELBOW_Y, 0)
  const SH = new THREE.Vector3(RIG.SHOULDER_X, RIG.SHOULDER_Y, 0)
  out.copy(rest).sub(EB).applyMatrix4(_r.makeRotationX(-P.e)).add(EB)
  _m.makeRotationY(-P.d).multiply(_r.makeRotationZ(P.a + 0.1)).multiply(new THREE.Matrix4().makeRotationX(-P.f))
  out.sub(SH).applyMatrix4(_m).add(SH)
  out.sub(RIG.HIP).applyMatrix4(_r.makeRotationX(0.04)).add(RIG.HIP)
  return out
}
