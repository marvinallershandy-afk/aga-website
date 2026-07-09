import { useRef, useState, type ReactNode } from 'react'
import { Download, UploadCloud, Loader2 } from 'lucide-react'
import { PageHeader } from './Placeholder'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Select } from '../components/ui/select'
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
  const [template, setTemplate] = useState<TemplateKey>('spieltag')
  const [format, setFormat] = useState<FormatKey>('square')
  const [data, setData] = useState<MatchdayData>(DEFAULT_DATA)
  const [busy, setBusy] = useState<null | 'download' | 'upload'>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const exportRef = useRef<HTMLDivElement>(null)

  const spec = FORMATS.find((f) => f.key === format)!
  const scale = PREVIEW_W / spec.width
  const set = <K extends keyof MatchdayData>(k: K, v: MatchdayData[K]) => setData((d) => ({ ...d, [k]: v }))

  const capture = async (): Promise<Blob> => {
    const node = exportRef.current
    if (!node) throw new Error('Render-Knoten fehlt.')
    return nodeToPngBlob(node, spec.width, spec.height)
  }

  const handleDownload = async () => {
    setBusy('download')
    setMsg(null)
    try {
      const blob = await capture()
      downloadBlob(blob, buildFilename(template, format, data.heim, data.gast))
      setMsg({ kind: 'ok', text: 'PNG heruntergeladen.' })
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Download fehlgeschlagen.' })
    } finally {
      setBusy(null)
    }
  }

  const handleUpload = async () => {
    setBusy('upload')
    setMsg(null)
    try {
      const blob = await capture()
      const path = `${template}/${buildFilename(template, format, data.heim, data.gast)}`
      await uploadGrafik(blob, path)
      setMsg({ kind: 'ok', text: `In Storage gespeichert: ${path}` })
    } catch (e) {
      setMsg({
        kind: 'err',
        text:
          (e instanceof Error ? e.message : 'Upload fehlgeschlagen.') +
          ' — Der Download funktioniert unabhängig davon.',
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Matchday-Grafiken"
        subtitle="Vier Vorlagen · Feed (1080×1080) & Story (1080×1920) · PNG-Export."
      />

      {/* Vorlagen-Auswahl */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TEMPLATES.map((t) => (
          <button
            key={t.key}
            onClick={() => setTemplate(t.key)}
            className={cn(
              'rounded-lg border p-3 text-left transition-colors',
              template === t.key ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50',
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
            <div className="flex overflow-hidden rounded-md border border-border">
              {FORMATS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFormat(f.key)}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium transition-colors',
                    format === f.key ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
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

          {template === 'motm' && (
            <>
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
          {msg && (
            <p className={cn('text-sm', msg.kind === 'ok' ? 'text-green-500' : 'text-primary')}>{msg.text}</p>
          )}
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

      {/* Offscreen-Export-Knoten in voller Auflösung */}
      <div style={{ position: 'fixed', left: -99999, top: 0, pointerEvents: 'none' }} aria-hidden>
        <div ref={exportRef} style={{ width: spec.width, height: spec.height }}>
          <MatchdayTemplate template={template} data={data} format={format} />
        </div>
      </div>
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
