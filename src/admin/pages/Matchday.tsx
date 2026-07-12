import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, UploadCloud, Loader2, CalendarClock, Users } from 'lucide-react'
import { PageHeader } from './Placeholder'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Select } from '../components/ui/select'
import { useToast } from '../components/ui/toast'
import { useRoster, useSpiele } from '../lib/queries'
import type { SpielRow } from '../lib/db'
import { SVA_NAME, STECKBRIEF_FELDER } from '../lib/constants'
import { formatAnstoss } from '../lib/format'
import { cn } from '../lib/utils'
import { MatchdayTemplate } from '../matchday/templates'
import {
  TEMPLATES,
  FORMATS,
  DEFAULT_DATA,
  type MatchdayData,
  type TemplateKey,
  type FormatKey,
} from '../matchday/types'
import { nodeToPngBlob, downloadBlob, uploadGrafik, buildFilename } from '../matchday/export'

const PREVIEW_W = 440

// Auswahl vorhandener Spielerfotos (aus /public/players).
const FOTOS = [
  { value: '', label: 'Kein Foto (Initiale)' },
  { value: '/players/carsten.webp', label: 'Carsten' },
  { value: '/players/eli.webp', label: 'Eli' },
  { value: '/players/julio.webp', label: 'Julio' },
  { value: '/players/lennard.webp', label: 'Lennard' },
  { value: '/players/nico-hause.webp', label: 'Nico' },
  { value: '/players/tino.webp', label: 'Tino' },
]

export function Matchday() {
  const toast = useToast()
  const [template, setTemplate] = useState<TemplateKey>('spieltag')
  const [format, setFormat] = useState<FormatKey>('square')
  const [data, setData] = useState<MatchdayData>(DEFAULT_DATA)
  const [busy, setBusy] = useState<null | 'download' | 'upload'>(null)

  // Prefill aus Spiele & Kader (P2): ?spiel=<id> oder Auswahl im Dropdown.
  const [searchParams] = useSearchParams()
  const spieleQ = useSpiele()
  const rosterQ = useRoster()
  const [spielId, setSpielId] = useState('')

  const applySpiel = (s: SpielRow) => {
    setSpielId(s.id)
    setData((d) => ({
      ...d,
      wettbewerb: [s.wettbewerb, s.spieltag_nr ? `${s.spieltag_nr}. Spieltag` : null]
        .filter(Boolean)
        .join(' · ') || d.wettbewerb,
      heim: s.heim ? SVA_NAME : s.gegner,
      gast: s.heim ? s.gegner : SVA_NAME,
      datum: formatAnstoss(s.anstoss),
      ort: s.ort ?? d.ort,
      toreHeim: s.heim
        ? (s.tore_sva != null ? String(s.tore_sva) : d.toreHeim)
        : (s.tore_gegner != null ? String(s.tore_gegner) : d.toreHeim),
      toreGast: s.heim
        ? (s.tore_gegner != null ? String(s.tore_gegner) : d.toreGast)
        : (s.tore_sva != null ? String(s.tore_sva) : d.toreGast),
    }))
  }

  // Deep-Link /matchday?spiel=<id> (z. B. vom Dashboard oder aus Spiele & Kader)
  const urlSpiel = searchParams.get('spiel')
  useEffect(() => {
    if (!urlSpiel || !spieleQ.data) return
    const s = spieleQ.data.find((x) => x.id === urlSpiel)
    if (s) applySpiel(s)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSpiel, spieleQ.data])

  const aktiveSpieler = (rosterQ.data ?? []).filter((p) => p.aktiv)

  const startelfAusKader = () => {
    const elf = aktiveSpieler
      .filter((p) => p.position !== 'Trainer/Staff')
      .slice(0, 11)
      .map((p) => (p.nummer != null ? `${p.nummer} ${p.name}` : p.name))
    setData((d) => ({ ...d, aufstellung: elf }))
  }

  const exportRef = useRef<HTMLDivElement>(null)

  const spec = FORMATS.find((f) => f.key === format)!
  const scale = PREVIEW_W / spec.width
  const set = <K extends keyof MatchdayData>(k: K, v: MatchdayData[K]) => setData((d) => ({ ...d, [k]: v }))

  // Der Export-Knoten wird nur während des Exports gemountet (spart die
  // permanenten FitText-Reflows des zweiten Voll-Renders). Deshalb: auf Mount
  // UND auf geladene Bilder warten, bevor html-to-image rendert.
  const capture = async (): Promise<Blob> => {
    let node: HTMLDivElement | null = null
    for (let i = 0; i < 30 && !(node = exportRef.current); i++) {
      await new Promise((r) => requestAnimationFrame(r))
    }
    if (!node) throw new Error('Render-Knoten fehlt.')
    const imgs = Array.from(node.querySelectorAll('img'))
    await Promise.all(
      imgs.map((img) =>
        img.complete
          ? null
          : new Promise((res) => {
              img.onload = img.onerror = res
            }),
      ),
    )
    return nodeToPngBlob(node, spec.width, spec.height)
  }

  const handleDownload = async () => {
    setBusy('download')
    try {
      const blob = await capture()
      downloadBlob(blob, buildFilename(template, format, data.heim, data.gast))
      toast.success('PNG heruntergeladen.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download fehlgeschlagen.')
    } finally {
      setBusy(null)
    }
  }

  const handleUpload = async () => {
    setBusy('upload')
    try {
      const blob = await capture()
      const path = `${template}/${buildFilename(template, format, data.heim, data.gast)}`
      await uploadGrafik(blob, path)
      toast.success(`In Storage gespeichert: ${path}`)
    } catch (e) {
      toast.error(
        (e instanceof Error ? e.message : 'Upload fehlgeschlagen.') +
          ' — Der Download funktioniert unabhängig davon.',
      )
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Matchday-Grafiken"
        subtitle="Fünf Vorlagen · Feed (1080×1080) & Story (1080×1920) · PNG-Export."
      />

      {/* Prefill aus Spieldaten */}
      {(spieleQ.data?.length ?? 0) > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/20 p-3">
          <CalendarClock className="h-4 w-4 text-primary" />
          <Label htmlFor="md-spiel" className="shrink-0">
            Spiel übernehmen
          </Label>
          <Select
            id="md-spiel"
            className="h-9 w-auto min-w-[260px]"
            value={spielId}
            onChange={(e) => {
              const s = spieleQ.data?.find((x) => x.id === e.target.value)
              if (s) applySpiel(s)
              else setSpielId('')
            }}
          >
            <option value="">— manuell —</option>
            {spieleQ.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {(s.heim ? `SVA vs. ${s.gegner}` : `${s.gegner} vs. SVA`) + ' · ' + formatAnstoss(s.anstoss)}
              </option>
            ))}
          </Select>
          <span className="text-xs text-muted-foreground">
            füllt Wettbewerb, Teams, Anstoß, Ort & Ergebnis
          </span>
        </div>
      )}

      {/* Vorlagen-Auswahl */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TEMPLATES.map((t) => (
          <button
            key={t.key}
            onClick={() => setTemplate(t.key)}
            className={cn(
              'rounded-lg border p-3 text-left transition-colors',
              template === t.key
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:border-primary/50',
            )}
          >
            <div className="text-sm font-semibold">{t.label}</div>
            <div className="text-xs text-muted-foreground">{t.desc}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        {/* Formular */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Label className="shrink-0">Format</Label>
            <div className="flex overflow-hidden rounded-md bg-secondary">
              {FORMATS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFormat(f.key)}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium transition-colors',
                    format === f.key
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <Field label="Wettbewerb">
            <Input value={data.wettbewerb} onChange={(e) => set('wettbewerb', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Heim">
              <Input value={data.heim} onChange={(e) => set('heim', e.target.value)} />
            </Field>
            <Field label="Gast">
              <Input value={data.gast} onChange={(e) => set('gast', e.target.value)} />
            </Field>
          </div>

          {template === 'spieltag' && (
            <>
              <Field label="Datum / Anstoß">
                <Input value={data.datum} onChange={(e) => set('datum', e.target.value)} />
              </Field>
              <Field label="Ort">
                <Input value={data.ort} onChange={(e) => set('ort', e.target.value)} />
              </Field>
            </>
          )}

          {template === 'aufstellung' && (
            <>
              <Field label="Formation">
                <Input value={data.formation} onChange={(e) => set('formation', e.target.value)} />
              </Field>
              <Field label="Startelf (eine Zeile pro Spieler, max. 11)">
                {aktiveSpieler.length > 0 && (
                  <Button size="sm" variant="outline" onClick={startelfAusKader} className="mb-2">
                    <Users className="h-4 w-4" /> Startelf aus Kader füllen
                  </Button>
                )}
                <Textarea
                  rows={11}
                  value={data.aufstellung.join('\n')}
                  onChange={(e) => set('aufstellung', e.target.value.split('\n').filter((l) => l.trim()).slice(0, 11))}
                />
              </Field>
            </>
          )}

          {template === 'ergebnis' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tore Heim">
                  <Input value={data.toreHeim} onChange={(e) => set('toreHeim', e.target.value)} />
                </Field>
                <Field label="Tore Gast">
                  <Input value={data.toreGast} onChange={(e) => set('toreGast', e.target.value)} />
                </Field>
              </div>
              <Field label="Torschützen">
                <Textarea
                  rows={3}
                  value={data.torschuetzen}
                  onChange={(e) => set('torschuetzen', e.target.value)}
                />
              </Field>
            </>
          )}

          {template === 'steckbrief' && (
            <>
              {aktiveSpieler.length > 0 && (
                <Field label="Aus Kader übernehmen">
                  <Select
                    value=""
                    onChange={(e) => {
                      const p = aktiveSpieler.find((x) => x.id === e.target.value)
                      if (!p) return
                      const sb =
                        p.steckbrief && typeof p.steckbrief === 'object' && !Array.isArray(p.steckbrief)
                          ? (Object.fromEntries(
                              Object.entries(p.steckbrief).filter(([, v]) => typeof v === 'string'),
                            ) as Record<string, string>)
                          : {}
                      setData((d) => ({
                        ...d,
                        spielerName: p.name,
                        spielerFoto: p.foto_url,
                        spielerNummer: p.nummer != null ? String(p.nummer) : '',
                        spielerPosition: p.position ?? '',
                        steckbrief: sb,
                      }))
                    }}
                  >
                    <option value="">— Spieler wählen —</option>
                    {aktiveSpieler.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nummer != null ? `#${p.nummer} ` : ''}{p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <div className="grid grid-cols-[1fr_auto_auto] gap-3">
                <Field label="Spielername">
                  <Input value={data.spielerName} onChange={(e) => set('spielerName', e.target.value)} />
                </Field>
                <Field label="Nr.">
                  <Input className="w-16" value={data.spielerNummer} onChange={(e) => set('spielerNummer', e.target.value)} />
                </Field>
                <Field label="Position">
                  <Input className="w-32" value={data.spielerPosition} onChange={(e) => set('spielerPosition', e.target.value)} />
                </Field>
              </div>
              <Field label="Foto">
                <Select
                  value={data.spielerFoto ?? ''}
                  onChange={(e) => set('spielerFoto', e.target.value || null)}
                >
                  {FOTOS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                  {data.spielerFoto && !FOTOS.some((f) => f.value === data.spielerFoto) && (
                    <option value={data.spielerFoto}>Foto aus Kader</option>
                  )}
                </Select>
              </Field>
              {STECKBRIEF_FELDER.map((f) => (
                <Field key={f.key} label={f.frage}>
                  <Input
                    value={data.steckbrief[f.key] ?? ''}
                    onChange={(e) =>
                      setData((d) => ({ ...d, steckbrief: { ...d.steckbrief, [f.key]: e.target.value } }))
                    }
                  />
                </Field>
              ))}
            </>
          )}

          {template === 'motm' && (
            <>
              {aktiveSpieler.length > 0 && (
                <Field label="Aus Kader übernehmen">
                  <Select
                    value=""
                    onChange={(e) => {
                      const p = aktiveSpieler.find((x) => x.id === e.target.value)
                      if (p) setData((d) => ({ ...d, spielerName: p.name, spielerFoto: p.foto_url }))
                    }}
                  >
                    <option value="">— Spieler wählen —</option>
                    {aktiveSpieler.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nummer != null ? `#${p.nummer} ` : ''}{p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Spielername">
                <Input value={data.spielerName} onChange={(e) => set('spielerName', e.target.value)} />
              </Field>
              <Field label="Foto">
                <Select
                  value={data.spielerFoto ?? ''}
                  onChange={(e) => set('spielerFoto', e.target.value || null)}
                >
                  {FOTOS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Zusatz (z. B. Statistik)">
                <Input value={data.motmZusatz} onChange={(e) => set('motmZusatz', e.target.value)} />
              </Field>
            </>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={handleDownload} disabled={busy !== null}>
              {busy === 'download' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              PNG herunterladen
            </Button>
            <Button variant="outline" onClick={handleUpload} disabled={busy !== null}>
              {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              In Storage speichern
            </Button>
          </div>
        </div>

        {/* Live-Vorschau (skaliert) */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="overflow-hidden rounded-lg border border-border shadow-lg"
            style={{ width: PREVIEW_W, height: spec.height * scale }}
          >
            <div style={{ width: spec.width, height: spec.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <MatchdayTemplate template={template} data={data} format={format} />
            </div>
          </div>
          <span className="text-xs text-muted-foreground">
            {spec.width}×{spec.height}px
          </span>
        </div>
      </div>

      {/* Offscreen-Export-Knoten in voller Auflösung — nur während des Exports */}
      {busy !== null && (
        <div style={{ position: 'fixed', left: -99999, top: 0, pointerEvents: 'none' }} aria-hidden>
          <div ref={exportRef} style={{ width: spec.width, height: spec.height }}>
            <MatchdayTemplate template={template} data={data} format={format} />
          </div>
        </div>
      )}
    </>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
