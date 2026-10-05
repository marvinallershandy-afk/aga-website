import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { curveClock } from '../three/crowdMaterial'
import { CX, HH, mulberry32 } from './curveLayout'

// ─────────────────────────────────────────────────────────────
// v14-B: Effekte der Meisterfeier — alles GPU-animiert über die
// gemeinsame Kurven-Uhr (curveClock.uTime), null CPU-Arbeit pro
// Partikel und Frame:
//   · BengaloSmoke  — weiche Alpha-Sprites, steigen + driften im
//                     Wind, unten rot durchglüht, oben vom Flutlicht
//                     grau-weiß angestrahlt (1 Draw-Call)
//   · CurveGlows    — additive Sprites: Bengalo-Kerne, Funken,
//                     Handy-Blitze (1 Draw-Call)
//   · Confetti      — rot-weiße Papierschnipsel, trudeln (1 Draw-Call)
// Die eine gemeinsame rote Punktlicht-Quelle steuert FanBlock.
// ─────────────────────────────────────────────────────────────

const MAX_EM = 4

function emitterUniform(flares: THREE.Vector3[]) {
  const arr = Array.from({ length: MAX_EM }, (_, i) => (flares[i] ?? flares[0] ?? new THREE.Vector3()).clone())
  return { value: arr }
}

// Weicher Rauch-Puff: radialer Abfall × fraktales Wert-Rauschen →
// unregelmäßiger, wattiger Rand statt sichtbarer Kugeln.
function makePuffTexture(): THREE.CanvasTexture {
  const S = 128
  const rand = mulberry32(77)
  const G = 9
  const grid = Array.from({ length: G * G }, () => rand())
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y)
    const fx = x - xi, fy = y - yi
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
    const g = (i: number, j: number) => grid[((j % G) + G) % G * G + (((i % G) + G) % G)]
    const a = g(xi, yi) + (g(xi + 1, yi) - g(xi, yi)) * sx
    const b = g(xi, yi + 1) + (g(xi + 1, yi + 1) - g(xi, yi + 1)) * sx
    return a + (b - a) * sy
  }
  const img = new ImageData(S, S)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S
      const dx = u - 0.5, dy = v - 0.5
      const r = Math.sqrt(dx * dx + dy * dy) * 2
      const n = noise(u * 4, v * 4) * 0.55 + noise(u * 8 + 3, v * 8 + 1) * 0.3 + noise(u * 16, v * 16 + 5) * 0.15
      const fall = Math.max(0, 1 - r)
      const a = Math.min(1, Math.max(0, Math.pow(fall, 1.3) * (0.4 + 1.3 * n) * 1.5 - 0.06))
      const k = (y * S + x) * 4
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 255
      img.data[k + 3] = Math.min(255, a * 255)
    }
  }
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  cv.getContext('2d')!.putImageData(img, 0, 0)
  return new THREE.CanvasTexture(cv)
}

function makeGlowTexture(): THREE.CanvasTexture {
  const S = 64
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const ctx = cv.getContext('2d')!
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.18, 'rgba(255,255,255,0.75)')
  g.addColorStop(0.45, 'rgba(255,255,255,0.18)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  return new THREE.CanvasTexture(cv)
}

// Flacker-Funktion — identisch zu flareFlicker() (crowdMaterial.ts) für das Licht
const GLSL_FLICK = /* glsl */ `
float flick(float t, float i){ return 0.78 + 0.13*sin(t*23.0 + i*3.1) + 0.09*sin(t*37.0 + i*1.7)*sin(t*5.3 + i); }
`

function quadInstanced(count: number) {
  const base = new THREE.PlaneGeometry(1, 1)
  const g = new THREE.InstancedBufferGeometry()
  g.index = base.index
  g.setAttribute('position', base.getAttribute('position'))
  g.setAttribute('uv', base.getAttribute('uv'))
  g.instanceCount = count
  return g
}

// ─── Bengalo-Rauch ──────────────────────────────────────────
export function BengaloSmoke({ flares, perFlare }: { flares: THREE.Vector3[]; perFlare: number }) {
  const { geo, mat } = useMemo(() => {
    const n = flares.length * perFlare
    const geo = quadInstanced(n)
    const seed = new Float32Array(n * 4)
    const rand = mulberry32(1312)
    for (let i = 0; i < n; i++) {
      seed[i * 4] = Math.floor(i / perFlare)
      seed[i * 4 + 1] = (i % perFlare) / perFlare + rand() * 0.02
      seed[i * 4 + 2] = rand()
      seed[i * 4 + 3] = rand()
    }
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4))
    // großzügige Bounds um die Emitter (Shader verschiebt die Partikel)
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(CX + 0.4, 0.9, HH + 0.9), 3.4)
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uTex: { value: makePuffTexture() },
        uLife: { value: 5.2 },
      }]),
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        uniform float uTime;
        uniform float uAmp;
        uniform float uLife;
        uniform float uFx;
        uniform vec3 uEm[${MAX_EM}];
        varying vec2 vUv;
        varying float vAlpha;
        varying vec3 vCol;
        varying float vGrad;
        ${GLSL_FLICK}
        #include <fog_pars_vertex>
        void main(){
          float age = fract(uTime / uLife + aSeed.y);
          float r1 = aSeed.z, r2 = aSeed.w;
          float ei = aSeed.x;
          vec3 p = uEm[int(ei + 0.5)];
          // steigt (warme Gase), driftet mit dem Wind nach Osten/hinten,
          // fächert auf
          p.y += 0.03 + 0.9 * pow(age, 0.75);
          p.x += -0.12 * pow(age, 1.4) + 0.07 * sin(age * 7.0 + r1 * 6.283);
          p.z += 0.85 * pow(age, 0.85) + 0.05 * cos(age * 5.0 + r2 * 6.283);
          p += (vec3(r1, fract(r1 * 13.7), r2) - 0.5) * (0.03 + 0.24 * age);
          float size = (0.08 + 0.4 * pow(age, 0.6)) * (0.65 + 0.7 * r2);
          float rot = r1 * 6.283 + age * (r2 - 0.5) * 2.4;
          vec2 q = mat2(cos(rot), sin(rot), -sin(rot), cos(rot)) * position.xy;
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          mvPosition.xy += q * size;
          gl_Position = projectionMatrix * mvPosition;
          vUv = uv;
          vGrad = position.y + 0.5;
          vAlpha = smoothstep(0.0, 0.16, age) * pow(1.0 - age, 1.5) * uFx;
          // Licht: unten glüht der Bengalo rot durch, oben streift das Flutlicht
          float glow = exp(-age * 6.5) * flick(uTime, ei);
          vec3 lit = vec3(0.24, 0.23, 0.26) + vec3(0.1, 0.1, 0.12) * smoothstep(0.25, 1.0, age);
          vec3 tint = mix(vec3(1.0), vec3(1.3, 0.6, 0.55), exp(-age * 3.0));
          vCol = lit * tint + vec3(1.0, 0.16, 0.1) * 1.8 * glow;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex;
        varying vec2 vUv;
        varying float vAlpha;
        varying vec3 vCol;
        varying float vGrad;
        #include <fog_pars_fragment>
        void main(){
          float a = texture2D(uTex, vUv).a * vAlpha * 0.5; // v14-R: ruhiger, Banner bleibt lesbar
          if (a < 0.003) discard;
          gl_FragColor = vec4(vCol * (0.8 + 0.4 * vGrad), a);
          #include <fog_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      fog: true,
    })
    mat.uniforms.uTime = curveClock.uTime
    mat.uniforms.uAmp = curveClock.uAmp
    mat.uniforms.uFx = curveClock.uFx
    mat.uniforms.uEm = emitterUniform(flares)
    return { geo, mat }
  }, [flares, perFlare])
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])
  return <mesh geometry={geo} material={mat} renderOrder={3} frustumCulled />
}

// ─── Additive Glows: Bengalo-Kerne, Funken, Handy-Blitze ────
export function CurveGlows({ flares, phones, sparksPerFlare }: { flares: THREE.Vector3[]; phones: THREE.Vector3[]; sparksPerFlare: number }) {
  const { geo, mat } = useMemo(() => {
    type G = [number, number, number, number, THREE.Vector3]
    const items: G[] = []
    const rand = mulberry32(99)
    flares.forEach((f, i) => {
      items.push([0, i, rand(), rand(), f]) // Kern
      items.push([3, i, rand(), rand(), f]) // weicher Hof
      for (let k = 0; k < sparksPerFlare; k++) items.push([1, i, rand(), rand(), f])
    })
    phones.forEach((p) => items.push([2, 0, rand(), rand(), p]))
    const n = items.length
    const geo = quadInstanced(n)
    const g = new Float32Array(n * 4)
    const pa = new Float32Array(n * 3)
    items.forEach(([t, i, a, b, p], k) => {
      g.set([t, i, a, b], k * 4)
      pa.set([p.x, p.y, p.z], k * 3)
    })
    geo.setAttribute('aG', new THREE.InstancedBufferAttribute(g, 4))
    geo.setAttribute('aP', new THREE.InstancedBufferAttribute(pa, 3))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(CX, 0.6, HH + 0.8), 3.2)
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: makeGlowTexture() } },
      vertexShader: /* glsl */ `
        attribute vec4 aG;
        attribute vec3 aP;
        uniform float uTime;
        uniform float uAmp;
        uniform float uFx;
        varying vec2 vUv;
        varying vec3 vCol;
        ${GLSL_FLICK}
        void main(){
          float type = aG.x, idx = aG.y, r1 = aG.z, r2 = aG.w;
          vec3 p = aP;
          float size = 0.0;
          vec3 col = vec3(0.0);
          if (type < 0.5) {            // Bengalo-Kern: gleißend, flackert
            float f = flick(uTime, idx);
            size = 0.05 * (0.85 + 0.3 * f);
            col = vec3(1.0, 0.42, 0.32) * 6.0 * f;
          } else if (type < 1.5) {     // Funken: sprühen hoch, fallen, verglühen
            float age = fract(uTime * (1.1 + r1 * 0.5) + r2);
            vec3 dir = normalize(vec3((r1 - 0.5) * 1.3, 1.1 + r2, (fract(r1 * 9.1) - 0.5) * 1.3));
            p += dir * (0.06 + 0.26 * age) * (0.6 + 0.6 * r2) + vec3(0.0, -0.32 * age * age, 0.0);
            size = 0.011 * (1.0 - age) * (0.7 + 0.6 * r1) * step(0.01, uAmp);
            col = mix(vec3(1.0, 0.85, 0.6), vec3(1.0, 0.3, 0.12), age) * 5.0 * (1.0 - age);
          } else if (type < 2.5) {     // Handy-Blitz
            float period = 2.8 + r1 * 4.5;
            float local = mod(uTime + r2 * 8.0, period);
            float on = local < 0.13 ? 1.0 - local / 0.13 : 0.0;
            size = on > 0.0 ? 0.035 + on * 0.05 : 0.0;
            col = vec3(0.9, 0.95, 1.0) * 3.0 * on;
          } else {                     // roter Hof um den Bengalo
            float f = flick(uTime, idx + 0.37);
            size = 0.32 * (0.9 + 0.2 * f);
            col = vec3(1.0, 0.12, 0.07) * 0.55 * f;
          }
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          mv.xy += position.xy * size;
          gl_Position = projectionMatrix * mv;
          vUv = uv;
          vCol = col * uFx;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex;
        varying vec2 vUv;
        varying vec3 vCol;
        void main(){
          float a = texture2D(uTex, vUv).a;
          gl_FragColor = vec4(vCol * a, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    mat.uniforms.uTime = curveClock.uTime
    mat.uniforms.uAmp = curveClock.uAmp
    mat.uniforms.uFx = curveClock.uFx
    return { geo, mat }
  }, [flares, phones, sparksPerFlare])
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])
  return <mesh geometry={geo} material={mat} renderOrder={4} />
}

// ─── Konfetti: rot-weiße Papierschnipsel (ein paar goldene) ──
export function Confetti({ count }: { count: number }) {
  const { geo, mat } = useMemo(() => {
    const base = new THREE.PlaneGeometry(1, 0.62)
    const geo = new THREE.InstancedBufferGeometry()
    geo.index = base.index
    geo.setAttribute('position', base.getAttribute('position'))
    geo.instanceCount = count
    const a = new Float32Array(count * 4)
    const b = new Float32Array(count * 4)
    const rand = mulberry32(4242)
    for (let i = 0; i < count; i++) {
      const y0 = 0.9 + rand() * 1.2
      a.set([CX + (rand() - 0.5) * 5.2, HH - 0.6 + rand() * 2.1, y0, 0.11 + rand() * 0.12], i * 4)
      const c = rand()
      b.set([(rand() - 0.5) * 7, 0.05 + rand() * 0.18, rand() * 20, c < 0.5 ? 0 : c < 0.9 ? 1 : 2], i * 4)
    }
    geo.setAttribute('aC', new THREE.InstancedBufferAttribute(a, 4))
    geo.setAttribute('aC2', new THREE.InstancedBufferAttribute(b, 4))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(CX, 0.9, HH + 0.4), 3.4)
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
      vertexShader: /* glsl */ `
        attribute vec4 aC;
        attribute vec4 aC2;
        uniform float uTime;
        varying vec3 vCol;
        mat3 rX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
        mat3 rY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
        #include <fog_pars_vertex>
        void main(){
          float y0 = aC.z;
          float fall = mod(uTime * aC.w + aC2.z, y0 + 0.05);
          float ph = aC2.z;
          vec3 c = vec3(aC.x + sin(uTime * 0.8 + ph) * aC2.y, y0 - fall, aC.y + cos(uTime * 0.6 + ph) * aC2.y * 0.6);
          mat3 R = rY(uTime * aC2.x * 0.7 + ph * 2.0) * rX(uTime * aC2.x + ph);
          float s = 0.022 * smoothstep(0.0, 0.08, fall) * (1.0 - smoothstep(y0 - 0.02, y0 + 0.05, fall));
          vec3 p = c + R * (position * s);
          vec3 n = R * vec3(0., 0., 1.);
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          vec3 nv = normalize(normalMatrix * n);
          float shade = 0.3 + 0.45 * abs(n.y) + 0.45 * pow(abs(nv.z), 4.0);
          int ci = int(aC2.w + 0.5);
          vec3 col = ci == 0 ? vec3(0.78, 0.05, 0.07) : ci == 1 ? vec3(0.92, 0.9, 0.86) : vec3(0.95, 0.68, 0.22);
          vCol = col * shade;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vCol;
        #include <fog_pars_fragment>
        void main(){
          gl_FragColor = vec4(vCol, 1.0);
          #include <fog_fragment>
        }`,
      side: THREE.DoubleSide,
      fog: true,
      // „transparent" nur, damit der statische Schatten-Bake (StaticShadows)
      // die Schnipsel nicht als Caster aufnimmt — sie sind voll deckend.
      transparent: true,
    })
    mat.uniforms.uTime = curveClock.uTime
    return { geo, mat }
  }, [count])
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])
  return <mesh geometry={geo} material={mat} />
}
