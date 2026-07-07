import { TRACKS, trackUrl, type Track } from './tracks'

// ─────────────────────────────────────────────────────────────
// Zentraler AudioManager (Singleton, WebAudio):
//   masterGain ── ctx.destination
//   ├─ atmoGain   (prozeduraler Wind-/Rausch-Teppich — kein Asset)
//   ├─ musicGain  (MediaElement: Marvins Tracks)
//   └─ fxGain     (Anstoß-Swell)
// Ducking: spielt Musik, senkt der Atmo-Kanal ab (0.3×).
// Klang ist Teppich, nicht Show — alle Pegel bewusst dezent.
// AudioContext entsteht erst nach der Nutzer-Geste (Eingangstor).
// ─────────────────────────────────────────────────────────────

const LEVELS = {
  master: 0.9,
  atmo: 0.16,
  atmoBoost: 1.8, // Fanblock-Finale: näher am Gemurmel
  atmoDucked: 0.05,
  music: 0.42,
  musicParty: 0.75, // Partyraum (Etappe 6)
  fx: 0.6,
  fanChant: 0.5, // Fanblock-Gesang (v9-E2), bewusst dezent
} as const

export type MusicMode = 'ambient' | 'party'

class AudioManagerImpl {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private atmo!: GainNode
  private music!: GainNode
  private fx!: GainNode
  private fan!: GainNode
  private el: HTMLAudioElement | null = null
  private enabled = false
  private mode: MusicMode = 'ambient'
  private atmoBoosted = false
  private fanChantWanted = false
  private fanBuilt = false

  trackIndex = 0
  playing = false
  onChange: (() => void) | null = null

  /** Nach Nutzer-Geste aufrufen (Tor-Klick). Idempotent. */
  private ensureCtx() {
    if (this.ctx) return
    const ctx = new AudioContext()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0
    this.master.connect(ctx.destination)
    this.atmo = ctx.createGain()
    this.atmo.gain.value = LEVELS.atmo
    this.atmo.connect(this.master)
    this.music = ctx.createGain()
    this.music.gain.value = LEVELS.music
    this.music.connect(this.master)
    this.fx = ctx.createGain()
    this.fx.gain.value = LEVELS.fx
    this.fx.connect(this.master)
    this.fan = ctx.createGain()
    this.fan.gain.value = 0 // default aus
    this.fan.connect(this.master)
    this.buildAtmo(ctx)
  }

  /** Prozeduraler Fangesang-Teppich (v9-E2): gebändertes Rauschen mit
   *  langsamem Tremolo (die „Woah"-Wellen der Kurve) + einem tiefen
   *  Klopf-Puls (Trommel/Klatschen-Andeutung). Null Download; CC0-File
   *  kann den Slot später ersetzen. Läuft leise, nur wenn getoggelt. */
  private buildFanChant(ctx: AudioContext) {
    if (this.fanBuilt) return
    this.fanBuilt = true
    // Gemurmel: weißes Rauschen → Bandpass (Stimmen-Band)
    const len = ctx.sampleRate * 3
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 780
    bp.Q.value = 0.9
    // Tremolo: LFO moduliert eine Zwischen-Gain → Chor-Wellen
    const trem = ctx.createGain()
    trem.gain.value = 0.5
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.5
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.42
    lfo.connect(lfoGain)
    lfoGain.connect(trem.gain)
    src.connect(bp)
    bp.connect(trem)
    trem.connect(this.fan)
    // Klopf-Puls: kurze tiefe Sinus-Bursts im Takt (~1.6 Hz)
    const thump = ctx.createGain()
    thump.gain.value = 0
    const tOsc = ctx.createOscillator()
    tOsc.type = 'sine'
    tOsc.frequency.value = 92
    tOsc.connect(thump)
    thump.connect(this.fan)
    const pOsc = ctx.createOscillator()
    pOsc.type = 'square'
    pOsc.frequency.value = 1.6
    const pShape = ctx.createGain()
    pShape.gain.value = 0.16
    pOsc.connect(pShape)
    pShape.connect(thump.gain)
    src.start(); lfo.start(); tOsc.start(); pOsc.start()
  }

  /** Fangesang an/aus (v9-E2, Toggle in der Fanblock-Sektion). */
  setFanChant(on: boolean) {
    this.fanChantWanted = on
    if (!this.ctx) return
    this.buildFanChant(this.ctx)
    this.ramp(this.fan, on && this.enabled ? LEVELS.fanChant : 0, 0.9)
  }

  /** Prozeduraler Stadion-Grundteppich: gefiltertes Brown-Noise (Wind)
   *  mit langsamer LFO-Bewegung. Null Download; echtes CC0-Ambience-
   *  File kann den Slot später ersetzen (Marvin-To-do). */
  private buildAtmo(ctx: AudioContext) {
    const len = ctx.sampleRate * 4
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.2
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 420
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 180
    lfo.connect(lfoGain)
    lfoGain.connect(lp.frequency)
    src.connect(lp)
    lp.connect(this.atmo)
    src.start()
    lfo.start()
  }

  private ramp(node: GainNode, v: number, t = 0.8) {
    if (!this.ctx) return
    node.gain.cancelScheduledValues(this.ctx.currentTime)
    node.gain.linearRampToValueAtTime(v, this.ctx.currentTime + t)
  }

  /** Ton global an/aus (Tor-Wahl bzw. Mute-Toggle). */
  setEnabled(on: boolean) {
    this.enabled = on
    if (on) {
      this.ensureCtx()
      void this.ctx!.resume()
      this.ramp(this.master, LEVELS.master, 1.2)
      // Draußen läuft NUR die Stadion-Atmo — Musik startet erst im
      // Partyraum (setMode 'party') bzw. per Trackliste im Raum.
      if (this.mode === 'party' && !this.playing) this.play(this.trackIndex)
      // Fangesang nachziehen, falls vor dem Ton-An getoggelt
      if (this.fanChantWanted) this.setFanChant(true)
    } else if (this.ctx) {
      this.ramp(this.master, 0, 0.4)
      window.setTimeout(() => {
        if (!this.enabled) this.el?.pause()
        if (!this.enabled) this.playing = false
        this.onChange?.()
      }, 450)
    }
    this.onChange?.()
  }

  /** Partyraum rein/raus: Musik lebt NUR im Raum. Rein → Musik an
   *  (Party-Pegel), raus → Musik weich aus, Atmo übernimmt wieder. */
  setMode(mode: MusicMode) {
    if (this.mode === mode) return
    this.mode = mode
    if (!this.ctx) return
    if (mode === 'party') {
      if (this.enabled && !this.playing) this.play(this.trackIndex)
      this.applyDucking()
    } else {
      this.ramp(this.music, 0, 0.6)
      window.setTimeout(() => {
        if (this.mode !== 'ambient') return
        this.el?.pause()
        this.playing = false
        this.applyDucking() // Musik-Gain zurück auf Grundpegel, Atmo hoch
        this.onChange?.()
      }, 650)
    }
  }

  private applyDucking() {
    if (!this.ctx) return
    const boost = this.atmoBoosted ? LEVELS.atmoBoost : 1
    this.ramp(this.music, this.mode === 'party' ? LEVELS.musicParty : LEVELS.music, 0.8)
    this.ramp(this.atmo, (this.playing ? LEVELS.atmoDucked : LEVELS.atmo) * boost, 0.8)
  }

  /** Fanblock-Finale: Atmosphäre zieht leicht an. */
  setAtmoBoost(on: boolean) {
    if (this.atmoBoosted === on) return
    this.atmoBoosted = on
    this.applyDucking()
  }

  /** v5-Durchfahrt: Der Atmo→Musik-Crossfade folgt der Kamerafahrt
   *  (Fortschritt 0..1) statt dem Schnitt. Playback-Start/-Stopp
   *  bleibt an setMode gekoppelt; hier faden nur die Gains. */
  setPartyBlend(p: number) {
    if (!this.ctx || !this.enabled) return
    const k = Math.min(1, Math.max(0, p))
    const e = k * k * (3 - 2 * k)
    if (this.mode === 'party' && this.playing) {
      this.rampFast(this.music, LEVELS.musicParty * (0.25 + 0.75 * e))
      this.rampFast(this.atmo, LEVELS.atmo * (1 - e) + LEVELS.atmoDucked * e)
    } else {
      // draußen/Anflug: Atmo bleibt, dimmt aber schon leicht Richtung Tür
      this.rampFast(this.atmo, LEVELS.atmo * (1 - 0.4 * e))
    }
  }

  private rampFast(node: GainNode, v: number) {
    if (!this.ctx) return
    node.gain.cancelScheduledValues(this.ctx.currentTime)
    node.gain.setTargetAtTime(v, this.ctx.currentTime, 0.12)
  }

  /** Aktuelle Gain-Werte (Beleg fürs Gate). */
  debugGains() {
    if (!this.ctx) return null
    return {
      master: +this.master.gain.value.toFixed(3),
      atmo: +this.atmo.gain.value.toFixed(3),
      music: +this.music.gain.value.toFixed(3),
      playing: this.playing,
      mode: this.mode,
    }
  }

  get current(): Track {
    return TRACKS[this.trackIndex]
  }

  play(index = this.trackIndex) {
    this.ensureCtx()
    this.trackIndex = ((index % TRACKS.length) + TRACKS.length) % TRACKS.length
    if (!this.el) {
      this.el = new Audio()
      this.el.crossOrigin = 'anonymous'
      const srcNode = this.ctx!.createMediaElementSource(this.el)
      srcNode.connect(this.music)
      this.el.addEventListener('ended', () => this.next())
    }
    this.el.src = trackUrl(this.current)
    void this.el.play().catch(() => { /* Geste fehlt → still */ })
    this.playing = true
    this.applyDucking()
    this.onChange?.()
  }

  pause() {
    this.el?.pause()
    this.playing = false
    this.applyDucking()
    this.onChange?.()
  }

  toggle() {
    if (this.playing) this.pause()
    else if (this.el && this.el.src) {
      void this.el.play()
      this.playing = true
      this.applyDucking()
      this.onChange?.()
    } else this.play(this.trackIndex)
  }

  next() {
    this.play(this.trackIndex + 1)
  }

  /** Anstoß-Swell (einmalig, nur bei Ton an). */
  playSwell() {
    if (!this.enabled || !this.ctx) return
    const el = new Audio('/audio/kickoff-swell.mp3')
    const node = this.ctx.createMediaElementSource(el)
    node.connect(this.fx)
    void el.play().catch(() => { /* still */ })
  }
}

export const AudioManager = new AudioManagerImpl()

// Dev-Zugriff für Gate-Belege
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { AudioManager: AudioManagerImpl }).AudioManager = AudioManager
}
