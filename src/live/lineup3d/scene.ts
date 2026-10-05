// ─────────────────────────────────────────────────────────────
// v16-W: „3D-Aufstellung“ der Live-Seite — schlanke three.js-Szene ohne
// React-Three-Fiber. Wird NUR per dynamischem Import geladen (Klick auf
// den Knopf), /live bleibt ohne Klick three-frei.
//
//  · stilisierter Rasen (CanvasTexture: Mähstreifen + Linien) + zwei Tore
//  · Startelf als stehende Walkout-Spieler: Billboard-Quads, die EIN
//    Atlas-Video (alle Spieler im Raster, oben Farbe, unten Alpha) per UV
//    sampeln → ein einziger Videodekoder für die ganze Elf
//  · Spieler ohne Walkout: Trikot-Aufsteller mit Rückennummer
//  · Namensschild unter jedem Spieler, Tore als Ball-Zähler
//  · Kamera hinter dem eigenen Tor, Orbit per Ziehen (begrenzt)
//  · highlight(id): Torschütze leuchtet kurz golden (Umriss + Bodenring)
//  · Rendering nur, solange die Szene sichtbar ist
// ─────────────────────────────────────────────────────────────
import {
  CanvasTexture,
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  Texture,
  Vector3,
  VideoTexture,
  WebGLRenderer,
  BoxGeometry,
  Fog,
} from 'three'

export interface Lineup3DPlayer {
  id: string
  name: string
  number?: number | null
}
export interface Lineup3DState {
  /** Feldposition je Slot: x −1 (links) … 1 (rechts) aus Sicht des eigenen Tores, depth 0 … 1 über die volle Länge. */
  slots: { x: number; depth: number; role: string }[]
  /** Spieler-ids je Slot (Wechsel eingerechnet) */
  onField: string[]
  players: Map<string, Lineup3DPlayer>
  goals: Map<string, number>
}
export interface AtlasInfo {
  src: string
  cols: number
  rows: number
  width: number
  height: number
  cells: Record<string, number>
}
export interface Lineup3D {
  update(s: Lineup3DState): void
  highlight(id: string): void
  dispose(): void
  stats(): { frames: number; avgMs: number; p95Ms: number; fps: number }
}

// Platz in Metern; eigene Torlinie bei z = 0, gegnerische bei z = 105
const L = 105
const W = 68
const PLAYER_H = 6 // stilisiert ≈ 3,2 × echte Größe — sonst verschwinden sie im Totalen
const FEET_Y = 0.96 // Sohle im Walkout-Frame (src/data/walkout.ts WALKOUT_SIZE.feetY)
const GOLD = new Color('#E8C15A')

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
// Atlas: obere Hälfte Farbe, untere Hälfte Alpha (Graustufe). cell = (u0, v0, du, dv) der Farbzelle.
const FRAG = /* glsl */ `
uniform sampler2D map;
uniform vec4 cell;
uniform vec2 texel;
uniform float glow;
uniform float fade;
varying vec2 vUv;
float alphaAt(vec2 uc) { return smoothstep(0.08, 0.92, texture2D(map, uc - vec2(0.0, 0.5)).r); }
void main() {
  vec2 uc = vec2(cell.x + vUv.x * cell.z, cell.y + vUv.y * cell.w);
  vec3 col = texture2D(map, uc).rgb;
  float a = alphaAt(uc);
  float rim = 0.0;
  if (glow > 0.001) {
    vec2 d = texel * 2.5;
    float o = max(max(alphaAt(uc + vec2(d.x, 0.0)), alphaAt(uc - vec2(d.x, 0.0))), max(alphaAt(uc + vec2(0.0, d.y)), alphaAt(uc - vec2(0.0, d.y))));
    o = max(o, max(max(alphaAt(uc + d), alphaAt(uc - d)), max(alphaAt(uc + vec2(d.x, -d.y)), alphaAt(uc + vec2(-d.x, d.y)))));
    rim = clamp(o - a, 0.0, 1.0) * glow;
    col = mix(col, col * 1.18 + vec3(0.10, 0.07, 0.0), glow);
  }
  vec3 gold = vec3(1.0, 0.84, 0.42);
  float outA = max(a, rim);
  vec3 outC = outA > 0.0 ? (col * a + gold * rim * (1.0 - a)) / max(outA, 0.001) : col;
  if (outA * fade < 0.01) discard;
  gl_FragColor = vec4(outC, outA * fade);
}`

interface Figure {
  id: string
  group: Group
  body: Mesh
  mat: ShaderMaterial | MeshBasicMaterial
  plate: Sprite
  plateTex: CanvasTexture
  ring: Mesh
  goals: number
  fade: number
  target: number // 1 sichtbar, 0 ausblenden
  glowT: number // Restzeit Highlight (s)
  slot: number
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function pitchTexture(maxAniso: number): CanvasTexture {
  const S = 15 // px pro Meter
  const cw = W * S, ch = L * S
  const c = document.createElement('canvas')
  c.width = cw
  c.height = ch
  const g = c.getContext('2d')!
  // Mähstreifen quer zur Spielrichtung
  const n = 14
  for (let i = 0; i < n; i++) {
    g.fillStyle = i % 2 ? '#2f6b34' : '#2a6230'
    g.fillRect(0, (i * ch) / n, cw, ch / n + 1)
  }
  // leichte Vignette Richtung Ränder
  const vg = g.createRadialGradient(cw / 2, ch / 2, ch * 0.2, cw / 2, ch / 2, ch * 0.75)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.28)')
  g.fillStyle = vg
  g.fillRect(0, 0, cw, ch)
  g.strokeStyle = 'rgba(255,255,255,0.92)'
  g.lineWidth = 0.14 * S
  const m = (v: number) => v * S
  const inset = 1.2
  g.strokeRect(m(inset), m(inset), cw - m(inset * 2), ch - m(inset * 2))
  g.beginPath(); g.moveTo(m(inset), ch / 2); g.lineTo(cw - m(inset), ch / 2); g.stroke()
  g.beginPath(); g.arc(cw / 2, ch / 2, m(9.15), 0, Math.PI * 2); g.stroke()
  g.fillStyle = 'rgba(255,255,255,0.92)'
  g.beginPath(); g.arc(cw / 2, ch / 2, m(0.3), 0, Math.PI * 2); g.fill()
  for (const end of [0, 1]) {
    const y0 = end ? ch - m(inset) : m(inset)
    const dir = end ? -1 : 1
    const box = (w: number, d: number) => g.strokeRect(cw / 2 - m(w / 2), end ? y0 - m(d) : y0, m(w), m(d))
    box(40.32, 16.5)
    box(18.32, 5.5)
    const spot = y0 + dir * m(11)
    g.beginPath(); g.arc(cw / 2, spot, m(0.3), 0, Math.PI * 2); g.fill()
    // Strafraumbogen (nur außerhalb des Strafraums)
    const a = Math.acos(5.5 / 9.15)
    g.beginPath()
    if (end) g.arc(cw / 2, spot, m(9.15), Math.PI + a, Math.PI * 2 - a)
    else g.arc(cw / 2, spot, m(9.15), a, Math.PI - a)
    g.stroke()
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = maxAniso
  return t
}

function goal(z: number, facing: 1 | -1): Group {
  const grp = new Group()
  const mat = new MeshBasicMaterial({ color: '#f4f2ee' })
  const r = 0.12, w = 7.32, h = 2.44
  const post = new BoxGeometry(r * 2, h, r * 2)
  const bar = new BoxGeometry(w + r * 2, r * 2, r * 2)
  const p1 = new Mesh(post, mat); p1.position.set(-w / 2, h / 2, 0)
  const p2 = new Mesh(post, mat); p2.position.set(w / 2, h / 2, 0)
  const b = new Mesh(bar, mat); b.position.set(0, h, 0)
  const net = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.12, side: DoubleSide, depthWrite: false }))
  net.position.set(0, h / 2, -facing * 1.6)
  grp.add(p1, p2, b, net)
  grp.position.z = z
  return grp
}

function shadowTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32)
  gr.addColorStop(0, 'rgba(0,0,0,0.55)')
  gr.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 64, 64)
  return new CanvasTexture(c)
}

const lastName = (n: string) => n.trim().split(/\s+/).slice(-1)[0] ?? n

function drawPlate(tex: CanvasTexture, p: Lineup3DPlayer, goals: number) {
  const c = tex.image as HTMLCanvasElement
  const g = c.getContext('2d')!
  g.clearRect(0, 0, c.width, c.height)
  const name = lastName(p.name).toUpperCase()
  g.font = '64px Anton, Impact, "Arial Narrow", sans-serif'
  const tw = Math.min(g.measureText(name).width, 330)
  const numW = p.number != null ? 78 : 0
  const ballW = goals > 0 ? 64 + (goals > 1 ? 36 : 0) : 0
  const w = tw + numW + ballW + 34
  const x = (c.width - w) / 2
  g.fillStyle = 'rgba(14,13,13,0.86)'
  roundRect(g, x, 14, w, 84, 16)
  g.fill()
  if (numW) {
    g.fillStyle = '#E91D29'
    roundRect(g, x + 6, 20, numW - 6, 72, 12)
    g.fill()
    g.fillStyle = '#fff'
    g.textAlign = 'center'
    g.fillText(String(p.number), x + 6 + (numW - 6) / 2, 80)
  }
  g.fillStyle = '#ECEAE8'
  g.textAlign = 'left'
  g.fillText(name, x + numW + 16, 80, 330)
  if (ballW) {
    g.font = '50px system-ui, sans-serif'
    g.fillText(goals > 1 ? `⚽${goals}` : '⚽', x + numW + 16 + tw + 12, 76)
  }
  tex.needsUpdate = true
}

/** Aufsteller für Spieler ohne Walkout: Trikot-Silhouette mit Nummer. */
function shirtTexture(p: Lineup3DPlayer): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 512
  const g = c.getContext('2d')!
  const sx = 256 / 100, sy = 512 / 200
  g.save()
  g.scale(sx, sy)
  // Kopf
  g.fillStyle = '#d9b8a0'
  g.beginPath(); g.arc(50, 22, 11, 0, Math.PI * 2); g.fill()
  // Trikot
  g.fillStyle = '#9b1c2b'
  g.beginPath()
  g.moveTo(30, 38); g.lineTo(70, 38); g.lineTo(88, 52); g.lineTo(80, 70); g.lineTo(72, 64); g.lineTo(72, 108)
  g.lineTo(28, 108); g.lineTo(28, 64); g.lineTo(20, 70); g.lineTo(12, 52); g.closePath(); g.fill()
  // Hose + Stutzen
  g.fillStyle = '#6e1220'
  g.fillRect(30, 106, 40, 30)
  g.fillStyle = '#7d1624'
  g.fillRect(33, 136, 12, 50); g.fillRect(55, 136, 12, 50)
  g.fillStyle = '#111'
  g.fillRect(31, 184, 16, 8); g.fillRect(53, 184, 16, 8)
  g.restore()
  if (p.number != null) {
    g.fillStyle = '#fff'
    g.font = '96px Anton, Impact, sans-serif'
    g.textAlign = 'center'
    g.fillText(String(p.number), 128, 230)
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

export async function createLineup3D(host: HTMLElement, atlas: AtlasInfo | null): Promise<Lineup3D> {
  try { await document.fonts?.load('64px Anton') } catch { /* Fallback-Schrift */ }

  const renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  renderer.setPixelRatio(dpr)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.setClearColor('#0E0D0D')
  renderer.domElement.className = 'lv3d__canvas'
  host.appendChild(renderer.domElement)

  const scene = new Scene()
  scene.fog = new Fog('#0E0D0D', 95, 190)
  const camera = new PerspectiveCamera(38, 1, 1, 400)
  const target = new Vector3(0, 1.5, 46)

  // Rasen + Umfeld
  const ground = new Mesh(new PlaneGeometry(W + 30, L + 40), new MeshBasicMaterial({ color: '#163a1b' }))
  ground.rotation.x = -Math.PI / 2
  ground.position.set(0, -0.02, L / 2)
  const pitch = new Mesh(new PlaneGeometry(W, L), new MeshBasicMaterial({ map: pitchTexture(renderer.capabilities.getMaxAnisotropy()) }))
  pitch.rotation.x = -Math.PI / 2
  pitch.position.set(0, 0, L / 2)
  scene.add(ground, pitch, goal(1.2, 1), goal(L - 1.2, -1))

  // Atlas-Video (ein Dekoder)
  let video: HTMLVideoElement | null = null
  let atlasTex: VideoTexture | null = null
  if (atlas) {
    video = document.createElement('video')
    video.src = atlas.src
    video.muted = true
    video.defaultMuted = true
    video.loop = true
    video.playsInline = true
    video.setAttribute('playsinline', '')
    video.preload = 'auto'
    video.className = 'lv3d__video'
    host.appendChild(video) // iOS dekodiert zuverlässiger, wenn das Element im DOM hängt
    void video.play().catch(() => { /* Poster-Frame bleibt stehen */ })
    atlasTex = new VideoTexture(video)
    atlasTex.minFilter = LinearFilter
    atlasTex.magFilter = LinearFilter
    atlasTex.generateMipmaps = false
  }
  const shadowTex = shadowTexture()
  const shadowGeo = new CircleGeometry(1, 24)
  const ringGeo = new RingGeometry(1.2, 1.75, 48)
  const bodyGeo = new PlaneGeometry(PLAYER_H / 2, PLAYER_H)
  bodyGeo.translate(0, PLAYER_H / 2 - (1 - FEET_Y) * PLAYER_H, 0)

  const figures = new Map<string, Figure>()
  let state: Lineup3DState | null = null

  function makeFigure(id: string, p: Lineup3DPlayer, slot: number): Figure {
    const group = new Group()
    const cell = atlas?.cells[id]
    let mat: ShaderMaterial | MeshBasicMaterial
    if (atlas && atlasTex && cell != null) {
      const col = cell % atlas.cols, row = Math.floor(cell / atlas.cols)
      const cw = atlas.width / atlas.cols, chh = atlas.height / 2 / atlas.rows
      mat = new ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        uniforms: {
          map: { value: atlasTex },
          cell: { value: [(col * cw) / atlas.width, 1 - ((row + 1) * chh) / atlas.height, cw / atlas.width, chh / atlas.height] },
          texel: { value: [1 / atlas.width, 1 / atlas.height] },
          glow: { value: 0 },
          fade: { value: 0 },
        },
      })
    } else {
      mat = new MeshBasicMaterial({ map: shirtTexture(p), transparent: true, depthWrite: false, opacity: 0 })
    }
    const body = new Mesh(bodyGeo, mat)
    const shadow = new Mesh(shadowGeo, new MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }))
    shadow.rotation.x = -Math.PI / 2
    shadow.scale.set(1.5, 1.1, 1)
    shadow.position.y = 0.02
    const ring = new Mesh(ringGeo, new MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0, depthWrite: false, side: DoubleSide }))
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.04
    const pc = document.createElement('canvas')
    pc.width = 512
    pc.height = 112
    const plateTex = new CanvasTexture(pc)
    plateTex.colorSpace = SRGBColorSpace
    const plate = new Sprite(new SpriteMaterial({ map: plateTex, transparent: true, depthTest: false, opacity: 0 }))
    plate.scale.set(6.4, 1.4, 1)
    plate.position.y = -0.95
    plate.renderOrder = 10
    group.add(shadow, ring, body, plate)
    scene.add(group)
    const f: Figure = { id, group, body, mat, plate, plateTex, ring, goals: -1, fade: 0, target: 1, glowT: 0, slot }
    return f
  }

  function place(f: Figure, i: number) {
    const s = state!.slots[i]
    if (!s) return
    // Bildschirm-links = Slot-links: Kamera schaut in +z → rechts ist −x
    f.group.position.set(-s.x * 24, 0, s.depth * L)
  }

  function update(s: Lineup3DState) {
    state = s
    const keep = new Set<string>()
    s.onField.forEach((id, i) => {
      const p = s.players.get(id)
      if (!p) return
      keep.add(id)
      let f = figures.get(id)
      if (!f) {
        f = makeFigure(id, p, i)
        figures.set(id, f)
      }
      f.target = 1
      f.slot = i
      place(f, i)
      const g = s.goals.get(id) ?? 0
      if (g !== f.goals) {
        f.goals = g
        drawPlate(f.plateTex, p, g)
      }
    })
    for (const f of figures.values()) if (!keep.has(f.id)) f.target = 0
  }

  // ── Kamera-Orbit (Ziehen), begrenzt ─────────────────────────
  let az = 0, el = 0.42, dist = 64
  let azT = 0, elT = 0.42
  let drag: { x: number; y: number; az: number; el: number } | null = null
  let touched = false
  const cv = renderer.domElement
  const onDown = (e: PointerEvent) => {
    drag = { x: e.clientX, y: e.clientY, az: azT, el: elT }
    touched = true
    cv.setPointerCapture(e.pointerId)
  }
  const onMove = (e: PointerEvent) => {
    if (!drag) return
    const r = cv.getBoundingClientRect()
    azT = Math.max(-0.7, Math.min(0.7, drag.az - ((e.clientX - drag.x) / r.width) * 1.6))
    elT = Math.max(0.25, Math.min(1.0, drag.el + ((e.clientY - drag.y) / r.height) * 0.9))
  }
  const onUp = () => { drag = null }
  cv.addEventListener('pointerdown', onDown)
  cv.addEventListener('pointermove', onMove)
  cv.addEventListener('pointerup', onUp)
  cv.addEventListener('pointercancel', onUp)
  cv.style.touchAction = 'pan-y'

  function resize() {
    const w = host.clientWidth, h = host.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    // Hochformat: steiler und weiter weg, damit Breite + Torwart reinpassen
    const portrait = w / h < 0.9
    dist = portrait ? 96 : 84
    if (!touched) el = elT = portrait ? 0.62 : 0.5
    camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(host)
  resize()

  // ── Loop (nur sichtbar) ─────────────────────────────────────
  let visible = true
  const io = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); toggle() }, { threshold: 0.01 })
  io.observe(host)
  const onVis = () => toggle()
  document.addEventListener('visibilitychange', onVis)
  let running = false
  let last = performance.now()
  const times: number[] = []
  let frames = 0
  const tmp = new Vector3()
  function frame(now: number) {
    const dt = Math.min(0.1, (now - last) / 1000)
    if (frames > 0) { times.push(now - last); if (times.length > 600) times.shift() }
    last = now
    frames++
    az += (azT - az) * Math.min(1, dt * 6)
    el += (elT - el) * Math.min(1, dt * 6)
    // ruhiges Atmen der Kamera, solange niemand zieht
    const sway = drag ? 0 : Math.sin(now / 4200) * 0.035
    camera.position.set(
      target.x + Math.sin(az + sway) * Math.cos(el) * dist * -1,
      target.y + Math.sin(el) * dist,
      target.z - Math.cos(az + sway) * Math.cos(el) * dist,
    )
    camera.lookAt(target)
    for (const f of figures.values()) {
      f.fade += (f.target - f.fade) * Math.min(1, dt * 4)
      if (f.target === 0 && f.fade < 0.01) {
        scene.remove(f.group)
        f.mat.dispose()
        f.plateTex.dispose()
        figures.delete(f.id)
        continue
      }
      // zylindrisches Billboard: zur Kamera drehen, aufrecht bleiben
      tmp.copy(camera.position).sub(f.group.position)
      f.body.rotation.y = Math.atan2(tmp.x, tmp.z)
      const rise = 0.6 + 0.4 * f.fade
      f.body.scale.set(rise, rise, 1)
      f.glowT = Math.max(0, f.glowT - dt)
      const glow = f.glowT > 0 ? Math.min(1, f.glowT / 0.6) * (0.75 + 0.25 * Math.sin(now / 90)) : 0
      if (f.mat instanceof ShaderMaterial) {
        f.mat.uniforms.fade.value = f.fade
        f.mat.uniforms.glow.value = glow
      } else {
        f.mat.opacity = f.fade
      }
      ;(f.plate.material as SpriteMaterial).opacity = f.fade
      const rm = f.ring.material as MeshBasicMaterial
      rm.opacity = glow * 0.9
      const rs = 1 + (1 - (f.glowT % 1.2) / 1.2) * 1.6
      f.ring.scale.set(rs, rs, 1)
      f.group.renderOrder = 0
    }
    renderer.render(scene, camera)
  }
  function toggle() {
    const on = visible && document.visibilityState === 'visible'
    if (on === running) return
    running = on
    if (on) { last = performance.now(); renderer.setAnimationLoop(frame); void video?.play().catch(() => {}) }
    else { renderer.setAnimationLoop(null); video?.pause() }
  }
  toggle()

  return {
    update,
    highlight(id) {
      const f = figures.get(id)
      if (f) f.glowT = 4.5
    },
    stats() {
      const s = [...times].sort((a, b) => a - b)
      const avg = s.reduce((a, b) => a + b, 0) / Math.max(1, s.length)
      return { frames, avgMs: avg, p95Ms: s[Math.floor(s.length * 0.95)] ?? 0, fps: avg ? 1000 / avg : 0 }
    },
    dispose() {
      renderer.setAnimationLoop(null)
      io.disconnect()
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      cv.removeEventListener('pointerdown', onDown)
      cv.removeEventListener('pointermove', onMove)
      cv.removeEventListener('pointerup', onUp)
      cv.removeEventListener('pointercancel', onUp)
      scene.traverse((o) => {
        const m = o as Mesh
        m.geometry?.dispose?.()
        const mat = m.material as { dispose?: () => void; map?: Texture | null } | undefined
        mat?.map?.dispose?.()
        mat?.dispose?.()
      })
      atlasTex?.dispose()
      if (video) {
        video.pause()
        video.removeAttribute('src')
        video.load()
        video.remove()
      }
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
