import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { AlertTriangle, Camera, Check, ImagePlus, Loader2, Plus, ScanLine, Undo2, X } from 'lucide-react'
import { Button } from './ui/button'
import { ACCEPT_IMAGES } from '../lib/image'
import type { TabelleRow } from '../lib/db'
import {
  MAX_BILDER,
  ausErgebnis,
  basisZeilen,
  bildVorbereiten,
  entfallen,
  leereZeile,
  tabelleAuslesen,
  validiere,
  vergleiche,
  zahlenVon,
  zeilenWarnungen,
  zuInputs,
  type EditZeile,
  type Feld,
  type TabelleSchreibInput,
  type TabellenErgebnis,
  type ZeilenDiff,
} from '../lib/tabelleImport'
import { cn } from '../lib/utils'

// ─────────────────────────────────────────────────────────────
// v15-T: „📸 Tabelle per Screenshot aktualisieren".
// Mobil zuerst: Screenshot direkt vom Handy wählen (oder Foto, Einfügen per
// Strg+V, Drag & Drop) → Claude liest ab → Vorschau mit Diff gegen die
// gespeicherte Tabelle, jede Zelle editierbar → Übernehmen / Verwerfen.
// ─────────────────────────────────────────────────────────────

type Bild = { id: string; blob: Blob; url: string }
type Meta = Pick<TabellenErgebnis, 'liga' | 'spieltag' | 'konfidenz' | 'hinweise'>
type Phase = 'start' | 'analyse' | 'vorschau'

const ZAHL_SPALTEN: { f: Exclude<Feld, 'platz' | 'team' | 'self'>; kurz: string; lang: string }[] = [
  { f: 'spiele', kurz: 'Sp', lang: 'Spiele' },
  { f: 'siege', kurz: 'S', lang: 'Siege' },
  { f: 'unentschieden', kurz: 'U', lang: 'Unentschieden' },
  { f: 'niederlagen', kurz: 'N', lang: 'Niederlagen' },
  { f: 'tore', kurz: 'T', lang: 'Tore' },
  { f: 'gegentore', kurz: 'GT', lang: 'Gegentore' },
  { f: 'punkte', kurz: 'Pkt', lang: 'Punkte' },
]

let bildZaehler = 0

export function TabelleImport({
  gespeichert,
  saison,
  onUebernehmen,
}: {
  gespeichert: TabelleRow[]
  saison: string | null
  /** Schreibt die Zeilen (ersetzt die Saison-Tabelle). Wirft bei Fehler. */
  onUebernehmen: (zeilen: TabelleSchreibInput[], basis: TabelleRow[]) => Promise<void>
}) {
  const [phase, setPhase] = useState<Phase>('start')
  const [bilder, setBilder] = useState<Bild[]>([])
  const [fehler, setFehler] = useState<string | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [zeilen, setZeilen] = useState<EditZeile[]>([])
  const [speichern, setSpeichern] = useState(false)
  const [basisFix, setBasisFix] = useState<TabelleRow[] | null>(null)
  const [ziehen, setZiehen] = useState(false)
  const [sekunden, setSekunden] = useState(0)
  const laufId = useRef(0)
  const dateiRef = useRef<HTMLInputElement>(null)
  const kameraRef = useRef<HTMLInputElement>(null)
  const bilderRef = useRef<Bild[]>([])
  bilderRef.current = bilder

  // Objekt-URLs der Vorschaubilder beim Verlassen freigeben
  useEffect(() => () => bilderRef.current.forEach((b) => URL.revokeObjectURL(b.url)), [])

  const liveBasis = useMemo(() => basisZeilen(gespeichert, saison), [gespeichert, saison])
  const basis = basisFix ?? liveBasis

  const zuruecksetzen = useCallback(() => {
    laufId.current++
    bilderRef.current.forEach((b) => URL.revokeObjectURL(b.url))
    setBilder([])
    setZeilen([])
    setMeta(null)
    setFehler(null)
    setBasisFix(null)
    setPhase('start')
  }, [])

  const analysieren = useCallback(async (liste: Bild[]) => {
    const id = ++laufId.current
    setFehler(null)
    setPhase('analyse')
    setSekunden(0)
    try {
      const e = await tabelleAuslesen(liste.map((b) => b.blob))
      if (id !== laufId.current) return
      setMeta({ liga: e.liga, spieltag: e.spieltag, konfidenz: e.konfidenz, hinweise: e.hinweise ?? [] })
      setZeilen(ausErgebnis(e))
      setPhase('vorschau')
    } catch (err) {
      if (id !== laufId.current) return
      setFehler(err instanceof Error ? err.message : 'Das Auslesen hat nicht geklappt.')
      setPhase(zeilen.length ? 'vorschau' : 'start')
    }
  }, [zeilen.length])

  /** Neue Dateien aufnehmen (verkleinern) und sofort auslesen. */
  const dateienAufnehmen = useCallback(
    async (files: File[] | Blob[], ergaenzen = false) => {
      const nurBilder = files.filter((f) => !f.type || f.type.startsWith('image/'))
      if (!nurBilder.length) {
        setFehler('Das ist kein Bild. Bitte einen Screenshot der Tabelle auswählen.')
        return
      }
      setFehler(null)
      const vorhanden = ergaenzen ? bilderRef.current : []
      const neu: Bild[] = []
      try {
        for (const f of nurBilder) {
          const platz = MAX_BILDER - vorhanden.length - neu.length
          if (platz <= 0) break
          for (const blob of await bildVorbereiten(f, platz)) {
            neu.push({ id: `b${++bildZaehler}`, blob, url: URL.createObjectURL(blob) })
          }
        }
      } catch (err) {
        neu.forEach((b) => URL.revokeObjectURL(b.url))
        setFehler(err instanceof Error ? err.message : 'Das Bild lässt sich nicht öffnen.')
        return
      }
      if (!ergaenzen) bilderRef.current.forEach((b) => URL.revokeObjectURL(b.url))
      const liste = [...vorhanden, ...neu].slice(0, MAX_BILDER)
      setBilder(liste)
      if (liste.length) void analysieren(liste)
    },
    [analysieren],
  )

  // Strg+V / Einfügen: Screenshot aus der Zwischenablage (nur im Startzustand)
  useEffect(() => {
    if (phase !== 'start') return
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.items ?? [])
        .filter((i) => i.kind === 'file' && i.type.startsWith('image/'))
        .map((i) => i.getAsFile())
        .filter((f): f is File => !!f)
      if (!files.length) return
      e.preventDefault()
      void dateienAufnehmen(files)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [phase, dateienAufnehmen])

  // Sekundenzähler während der Analyse (ruhig, ehrlich)
  useEffect(() => {
    if (phase !== 'analyse') return
    const t = setInterval(() => setSekunden((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [phase])

  const onDateiInput = (e: ChangeEvent<HTMLInputElement>, ergaenzen = false) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length) void dateienAufnehmen(files, ergaenzen)
  }

  const setZelle = (key: string, f: Feld, v: string | boolean) =>
    setZeilen((zs) =>
      zs.map((z) => {
        if (f === 'self') return { ...z, self: z.key === key ? (v as boolean) : v ? false : z.self }
        return z.key === key ? { ...z, [f]: v, extra: [] } : z
      }),
    )
  const entferneZeile = (key: string) => setZeilen((zs) => zs.filter((z) => z.key !== key))
  const zeileHinzu = () =>
    setZeilen((zs) => [...zs, leereZeile(Math.max(0, ...zs.map((z) => Number(z.platz) || 0)) + 1)])

  const diffs = useMemo(() => new Map(zeilen.map((z) => [z.key, vergleiche(z, basis)])), [zeilen, basis])
  const weg = useMemo(() => entfallen(zeilen, basis), [zeilen, basis])
  const geaenderteWerte = [...diffs.values()].reduce((n, d) => n + (d.alt ? d.geaendert.size : 0), 0)
  const neueTeams = basis.length ? [...diffs.values()].filter((d) => !d.alt).length : 0
  const warnZeilen = zeilen.filter((z) => zeilenWarnungen(z).length > 0).length

  const uebernehmen = async () => {
    const problem = validiere(zeilen)
    if (problem) {
      setFehler(problem)
      return
    }
    setFehler(null)
    setSpeichern(true)
    setBasisFix(basis)
    try {
      await onUebernehmen(zuInputs(zeilen, saison), basis)
      zuruecksetzen()
    } catch (err) {
      setBasisFix(null)
      setFehler(err instanceof Error ? `Speichern fehlgeschlagen: ${err.message}` : 'Speichern fehlgeschlagen.')
    } finally {
      setSpeichern(false)
    }
  }

  // ── Dateiauswahl (unsichtbar) ──
  const inputs = (
    <>
      <input ref={dateiRef} type="file" accept={ACCEPT_IMAGES} multiple hidden onChange={(e) => onDateiInput(e, phase === 'vorschau')} />
      <input ref={kameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onDateiInput(e)} />
    </>
  )

  // ═════════════════ Start ═════════════════
  if (phase === 'start') {
    return (
      <section
        aria-label="Tabelle per Screenshot aktualisieren"
        data-testid="tabelle-import"
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return
          e.preventDefault()
          setZiehen(true)
        }}
        onDragLeave={() => setZiehen(false)}
        onDrop={(e) => {
          e.preventDefault()
          setZiehen(false)
          void dateienAufnehmen(Array.from(e.dataTransfer.files))
        }}
        className={cn(
          'mb-6 rounded-xl border-2 border-dashed p-4 transition-colors sm:p-6',
          ziehen ? 'border-sva-gold bg-sva-gold/10' : 'border-primary/40 bg-primary/[0.06]',
        )}
      >
        {inputs}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl leading-tight sm:text-2xl">
              <span aria-hidden="true">📸 </span>Tabelle per Screenshot aktualisieren
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Screenshot der Tabelle von fussball.de, FuPa oder kicker hochladen. Die Zahlen werden automatisch abgelesen
              — du prüfst kurz die Vorschau und übernimmst.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:flex-col">
            <Button size="lg" className="col-span-2 sm:col-span-1" onClick={() => dateiRef.current?.click()}>
              <ImagePlus className="h-5 w-5" /> Screenshot wählen
            </Button>
            <Button size="lg" variant="outline" className="col-span-2 sm:hidden" onClick={() => kameraRef.current?.click()}>
              <Camera className="h-5 w-5" /> Foto vom Bildschirm
            </Button>
          </div>
        </div>
        <p className="mt-3 hidden text-xs text-muted-foreground sm:block">
          … oder Bild hierher ziehen · oder mit <kbd className="rounded border border-border px-1">Strg</kbd>+
          <kbd className="rounded border border-border px-1">V</kbd> einfügen · bis zu {MAX_BILDER} Bilder (z. B. obere und untere Hälfte)
        </p>
        {fehler && (
          <FehlerBox className="mt-4">
            {fehler}
            {bilder.length > 0 && (
              <Button variant="outline" size="sm" className="mt-2 flex" onClick={() => void analysieren(bilder)}>
                Nochmal versuchen
              </Button>
            )}
          </FehlerBox>
        )}
      </section>
    )
  }

  // ═════════════════ Analyse läuft ═════════════════
  if (phase === 'analyse') {
    return (
      <section aria-live="polite" aria-busy="true" data-testid="tabelle-import" className="mb-6 rounded-xl border border-border bg-card p-4 sm:p-6">
        {inputs}
        <div className="flex items-start gap-4">
          <BildStreifen bilder={bilder} gedimmt />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-semibold">
              <Loader2 className="h-4 w-4 animate-spin text-primary" /> Tabelle wird gelesen …
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Dauert meist 10–20 Sekunden{sekunden >= 3 ? ` · ${sekunden} s` : ''}. Du kannst so lange hier bleiben.
            </p>
            <Button variant="ghost" size="sm" className="mt-2 -ml-3 text-muted-foreground" onClick={zuruecksetzen}>
              Abbrechen
            </Button>
          </div>
        </div>
        <div className="mt-4 space-y-2" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-7 animate-pulse rounded bg-muted/50" style={{ animationDelay: `${i * 120}ms`, opacity: 1 - i * 0.15 }} />
          ))}
        </div>
      </section>
    )
  }

  // ═════════════════ Vorschau ═════════════════
  const titelTeile = [meta?.liga, meta?.spieltag ? `${meta.spieltag}. Spieltag` : null].filter(Boolean)
  return (
    <section data-testid="tabelle-vorschau" className="mb-6 rounded-xl border border-border bg-card">
      {inputs}
      <div className="flex flex-wrap items-start gap-3 border-b border-border p-4 sm:p-5">
        <BildStreifen bilder={bilder} />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl leading-tight">Vorschau prüfen</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {titelTeile.length ? `${titelTeile.join(' · ')} · ` : ''}
            {zeilen.length} Mannschaften
            {meta?.konfidenz && meta.konfidenz !== 'hoch' && (
              <span className="text-sva-gold"> · Lesesicherheit {meta.konfidenz}</span>
            )}
          </p>
          <p className="mt-1 text-sm">
            {basis.length === 0 ? (
              'Noch keine Tabelle gespeichert — alles wird neu angelegt.'
            ) : geaenderteWerte + neueTeams + weg.length === 0 ? (
              'Keine Änderung gegenüber der gespeicherten Tabelle.'
            ) : (
              <>
                <b>{geaenderteWerte}</b> {geaenderteWerte === 1 ? 'Wert' : 'Werte'} geändert
                {neueTeams > 0 && <> · <b>{neueTeams}</b> neu</>}
                {weg.length > 0 && <> · <b>{weg.length}</b> entfällt</>}
              </>
            )}
          </p>
        </div>
        {bilder.length < MAX_BILDER && (
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => dateiRef.current?.click()} disabled={speichern}>
            <ImagePlus className="h-4 w-4" /> Screenshot ergänzen
          </Button>
        )}
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        <Legende />
        {meta && meta.hinweise.length > 0 && (
          <div role="note" className="rounded-lg border border-sva-gold/40 bg-sva-gold/10 px-3 py-2.5 text-sm">
            <p className="flex items-center gap-2 font-medium text-sva-gold">
              <AlertTriangle className="h-4 w-4 shrink-0" /> Bitte prüfen
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-6 text-foreground/90">
              {meta.hinweise.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </div>
        )}
        {warnZeilen > 0 && (
          <p className="text-sm text-sva-gold">
            {warnZeilen === 1 ? '1 Zeile ist' : `${warnZeilen} Zeilen sind`} gelb markiert — Zahlen dort mit dem Screenshot vergleichen.
          </p>
        )}

        {/* Mobil: Karten */}
        <ul className="space-y-2 sm:hidden">
          {zeilen.map((z) => (
            <ZeileKarte key={z.key} z={z} diff={diffs.get(z.key)!} setZelle={setZelle} entferne={entferneZeile} />
          ))}
        </ul>

        {/* Desktop: Tabelle */}
        <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-2 font-medium">Pl.</th>
                <th className="px-2 py-2 font-medium">Mannschaft</th>
                {ZAHL_SPALTEN.map((s) => (
                  <th key={s.f} className="px-1 py-2 text-center font-medium" title={s.lang}>
                    {s.kurz}
                  </th>
                ))}
                <th className="px-1 py-2 text-center font-medium" title="Tordifferenz (automatisch)">Diff</th>
                <th className="px-2 py-2 text-center font-medium">SVA</th>
                <th className="px-1 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {zeilen.map((z) => (
                <ZeileTabelle key={z.key} z={z} diff={diffs.get(z.key)!} setZelle={setZelle} entferne={entferneZeile} />
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button variant="ghost" size="sm" className="-ml-3" onClick={zeileHinzu} disabled={speichern}>
            <Plus className="h-4 w-4" /> Zeile hinzufügen
          </Button>
          {weg.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Nicht mehr dabei (wird entfernt): {weg.map((r) => r.team).join(', ')}
            </p>
          )}
        </div>

        {fehler && <FehlerBox>{fehler}</FehlerBox>}
      </div>

      {/* Mobil: klebt über der Tab-Leiste (60 px + Rand + Safe-Area), damit „Übernehmen“ immer greifbar ist. */}
      <div className="sticky bottom-[calc(61px+env(safe-area-inset-bottom))] z-10 flex gap-2 rounded-b-xl border-t border-border bg-card/95 p-3 backdrop-blur sm:static sm:justify-end sm:bg-card sm:p-4">
        <Button variant="outline" size="lg" className="flex-1 sm:flex-none" onClick={zuruecksetzen} disabled={speichern}>
          <Undo2 className="h-4 w-4" /> Verwerfen
        </Button>
        <Button size="lg" className="flex-[2] sm:flex-none" onClick={uebernehmen} disabled={speichern || zeilen.length === 0}>
          {speichern ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {speichern ? 'Wird gespeichert …' : `Übernehmen (${zeilen.length})`}
        </Button>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────

function FehlerBox({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p role="alert" className={cn('flex items-start gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm', className)}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>{children}</span>
    </p>
  )
}

function BildStreifen({ bilder, gedimmt }: { bilder: Bild[]; gedimmt?: boolean }) {
  if (!bilder.length) return null
  return (
    <div className="flex shrink-0 gap-1.5">
      {bilder.map((b) => (
        <div key={b.id} className="relative h-16 w-12 overflow-hidden rounded-md border border-border bg-muted sm:h-20 sm:w-16">
          <img src={b.url} alt="Hochgeladener Screenshot" className={cn('h-full w-full object-cover object-top', gedimmt && 'opacity-50')} />
          {gedimmt && <ScanLine className="absolute inset-0 m-auto h-5 w-5 animate-pulse text-foreground/80" />}
        </div>
      ))}
    </div>
  )
}

function Legende() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-sm bg-sva-gold/25 ring-1 ring-sva-gold/70" /> geändert (alter Wert klein darunter)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-sm bg-primary/30" /> eigene Mannschaft
      </span>
      <span>Jede Zelle lässt sich antippen und korrigieren.</span>
    </p>
  )
}

type ZeileProps = {
  z: EditZeile
  diff: ZeilenDiff
  setZelle: (key: string, f: Feld, v: string | boolean) => void
  entferne: (key: string) => void
}

function PlatzTrend({ z, diff }: { z: EditZeile; diff: ZeilenDiff }) {
  if (!diff.alt) return <span className="rounded bg-sva-gold/20 px-1 text-[10px] font-semibold uppercase text-sva-gold">neu</span>
  const jetzt = Number(z.platz)
  const d = diff.alt.platz - jetzt
  if (!jetzt || d === 0) return null
  return (
    <span className={cn('text-[10px] font-semibold tabular-nums', d > 0 ? 'text-emerald-400' : 'text-primary')} title={`vorher Platz ${diff.alt.platz}`}>
      {d > 0 ? `▲${d}` : `▼${-d}`}
    </span>
  )
}

function ZahlZelle({
  z,
  f,
  label,
  diff,
  setZelle,
  className,
}: {
  z: EditZeile
  f: Exclude<Feld, 'team' | 'self'>
  label: string
  diff: ZeilenDiff
  setZelle: ZeileProps['setZelle']
  className?: string
}) {
  const geaendert = diff.geaendert.has(f)
  const leer = z[f].trim() === ''
  const alt = diff.alt ? (f === 'platz' ? diff.alt.platz : diff.alt[f]) : null
  return (
    <div className={cn('flex flex-col items-center', className)}>
      <input
        aria-label={`${label} ${z.team || 'neue Zeile'}`}
        inputMode="numeric"
        pattern="[0-9]*"
        value={z[f]}
        onChange={(e) => setZelle(z.key, f, e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
        title={geaendert && alt != null ? `vorher: ${alt}` : undefined}
        className={cn(
          'h-9 w-full min-w-0 rounded-md border bg-background px-0.5 text-center text-sm tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          geaendert ? 'border-sva-gold/70 bg-sva-gold/15 font-semibold' : 'border-input',
          leer && 'border-sva-gold bg-sva-gold/10',
        )}
      />
      {geaendert && alt != null && f !== 'platz' && (
        <span className="mt-0.5 text-[10px] leading-none tabular-nums text-muted-foreground line-through">{alt}</span>
      )}
    </div>
  )
}

function SelfKnopf({ z, setZelle }: Pick<ZeileProps, 'z' | 'setZelle'>) {
  return (
    <button
      type="button"
      aria-pressed={z.self}
      onClick={() => setZelle(z.key, 'self', !z.self)}
      title={z.self ? 'Eigene Mannschaft (wird auf der Website hervorgehoben)' : 'Als eigene Mannschaft markieren'}
      className={cn(
        'h-9 shrink-0 rounded-md px-2 text-xs font-bold tracking-wide transition-colors',
        z.self ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:bg-accent',
      )}
    >
      SVA
    </button>
  )
}

function WarnListe({ w }: { w: string[] }) {
  if (!w.length) return null
  return (
    <ul className="space-y-0.5 text-xs text-sva-gold">
      {w.map((t, i) => (
        <li key={i} className="flex items-start gap-1.5">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {t}
        </li>
      ))}
    </ul>
  )
}

function ZeileKarte({ z, diff, setZelle, entferne }: ZeileProps) {
  const w = zeilenWarnungen(z)
  return (
    <li
      className={cn(
        'rounded-lg border p-2.5',
        z.self ? 'border-primary/50 bg-primary/10' : 'border-border bg-background/40',
        w.length > 0 && 'border-l-4 border-l-sva-gold',
      )}
    >
      <div className="flex items-center gap-1.5">
        <div className="flex w-11 shrink-0 flex-col items-center">
          <ZahlZelle z={z} f="platz" label="Platz" diff={diff} setZelle={setZelle} />
        </div>
        <input
          aria-label="Mannschaft"
          value={z.team}
          placeholder="Mannschaft"
          onChange={(e) => setZelle(z.key, 'team', e.target.value)}
          className={cn(
            'h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            z.self && 'font-semibold',
          )}
        />
        <SelfKnopf z={z} setZelle={setZelle} />
        <button
          type="button"
          onClick={() => entferne(z.key)}
          aria-label={`Zeile ${z.team} entfernen`}
          className="flex h-9 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {(!diff.alt || diff.geaendert.has('platz')) && (
        <div className="mt-1 pl-1">
          <PlatzTrend z={z} diff={diff} />
        </div>
      )}
      <div className="mt-1 grid grid-cols-7 gap-1">
        {ZAHL_SPALTEN.map((s) => (
          <div key={s.f}>
            <span className="block text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{s.kurz}</span>
            <ZahlZelle z={z} f={s.f} label={s.lang} diff={diff} setZelle={setZelle} />
          </div>
        ))}
      </div>
      {w.length > 0 && (
        <div className="mt-2">
          <WarnListe w={w} />
        </div>
      )}
    </li>
  )
}

function ZeileTabelle({ z, diff, setZelle, entferne }: ZeileProps) {
  const w = zeilenWarnungen(z)
  const n = zahlenVon(z)
  const td = n.tore != null && n.gegentore != null ? n.tore - n.gegentore : null
  return (
    <>
      <tr className={cn('border-t border-border/60 align-top', z.self && 'bg-primary/10', w.length > 0 && 'shadow-[inset_3px_0_0_0_#E8C15A]')}>
        <td className="w-16 px-2 py-1.5">
          <ZahlZelle z={z} f="platz" label="Platz" diff={diff} setZelle={setZelle} />
          <div className="mt-0.5 text-center">
            <PlatzTrend z={z} diff={diff} />
          </div>
        </td>
        <td className="px-2 py-1.5">
          <input
            aria-label="Mannschaft"
            value={z.team}
            placeholder="Mannschaft"
            onChange={(e) => setZelle(z.key, 'team', e.target.value)}
            className={cn(
              'h-9 w-full min-w-[200px] rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              z.self && 'font-semibold',
            )}
          />
        </td>
        {ZAHL_SPALTEN.map((s) => (
          <td key={s.f} className="w-14 px-1 py-1.5">
            <ZahlZelle z={z} f={s.f} label={s.lang} diff={diff} setZelle={setZelle} />
          </td>
        ))}
        <td className="w-12 px-1 py-1.5 text-center leading-9 tabular-nums text-muted-foreground">
          {td == null ? '–' : td > 0 ? `+${td}` : td}
        </td>
        <td className="px-2 py-1.5 text-center">
          <SelfKnopf z={z} setZelle={setZelle} />
        </td>
        <td className="px-1 py-1.5">
          <button
            type="button"
            onClick={() => entferne(z.key)}
            aria-label={`Zeile ${z.team} entfernen`}
            className="flex h-9 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </td>
      </tr>
      {w.length > 0 && (
        <tr className={cn(z.self && 'bg-primary/10')}>
          <td />
          <td colSpan={11} className="px-2 pb-2">
            <WarnListe w={w} />
          </td>
        </tr>
      )}
    </>
  )
}
