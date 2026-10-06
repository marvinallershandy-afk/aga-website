import { useState } from 'react'
import { CalendarDays, Copy, Gift, Ticket } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select } from '../../components/ui/select'
import { SkeletonRows } from '../../components/ui/skeleton'
import { EmptyState } from '../../components/ui/empty-state'
import { useToast } from '../../components/ui/toast'
import { friendlyError } from '../../lib/db'
import { useKarten } from '../../lib/album'
import { useCodeMutations, useKartenCodes } from '../../lib/albumV20'
import { cn } from '../../lib/utils'

// ─────────────────────────────────────────────────────────────
// v20-K: Admin → Album → Codes. Story-Code (Instagram, 24 h, 1 Karte,
// 1× pro Konto), Partner-Code (im Laden, liefert die Partnerkarte),
// Massen-Erzeugung (je Tag ein Code mit automatischer Gültigkeit) und
// Adventskalender (24 Codes, am 24.12. die Weihnachts-Spezialkarte).
// ─────────────────────────────────────────────────────────────

const ART: Record<string, string> = { story: 'Story', partner: 'Partner', advent: 'Advent', event: 'Event-Pack' }
const heute = () => new Date().toISOString().slice(0, 10)

export function CodesTab() {
  const toast = useToast()
  const codes = useKartenCodes()
  const karten = useKarten()
  const { einzel, massen, advent, aktiv } = useCodeMutations()
  const [titel, setTitel] = useState('Story-Code')
  const [art, setArt] = useState<'story' | 'partner' | 'event'>('story')
  const [karte, setKarte] = useState('')
  const [stunden, setStunden] = useState(24)
  const [start, setStart] = useState(heute())
  const [tage, setTage] = useState(7)
  const [jahr, setJahr] = useState(new Date().getFullYear())
  const [xmas, setXmas] = useState('')
  const partnerKarten = (karten.data ?? []).filter((k) => k.typ === 'partner' && k.aktiv)
  const limitierte = (karten.data ?? []).filter((k) => k.limitiert)
  const kopieren = (c: string) => {
    void navigator.clipboard?.writeText(c)
    toast.success(`${c} kopiert.`)
  }
  const [jetzt] = useState(() => Date.now())

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="flex items-center gap-2 font-display text-xl">
            <Ticket className="h-5 w-5" /> Einzelner Code
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="co-art">Art</Label>
              <Select id="co-art" value={art} onChange={(e) => setArt(e.target.value as 'story' | 'partner' | 'event')}>
                <option value="story">Story (Instagram)</option>
                <option value="partner">Partner (im Laden)</option>
                <option value="event">Event-Pack (Derby, MOTM-Woche …)</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="co-std">Gültig (Std.)</Label>
              <Input id="co-std" type="number" min={1} max={24 * 60} value={stunden} onChange={(e) => setStunden(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="co-titel">Titel (im Pack)</Label>
            <Input id="co-titel" value={titel} maxLength={60} onChange={(e) => setTitel(e.target.value)} />
          </div>
          {art === 'event' && (
            <div className="space-y-1.5">
              <Label htmlFor="co-ev">Event-Karte (limitiert, mit Chance laut Pack-Typ „Event“)</Label>
              <Select id="co-ev" value={karte} onChange={(e) => setKarte(e.target.value)}>
                <option value="">— gerade ziehbare Wochenkarte —</option>
                {limitierte.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.titel}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">Event-Pack mit der Kartenzahl des Pack-Typs; die Event-Karte kommt mit der eingestellten Chance (je Fan höchstens einmal).</p>
            </div>
          )}
          {art === 'partner' && (
            <div className="space-y-1.5">
              <Label htmlFor="co-karte">Partnerkarte</Label>
              <Select id="co-karte" value={karte} onChange={(e) => setKarte(e.target.value)}>
                <option value="">— wählen —</option>
                {partnerKarten.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.titel}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <Button
            disabled={einzel.isPending || (art === 'partner' && !karte)}
            onClick={async () => {
              try {
                const r = await einzel.mutateAsync({ art, titel, karte: art === 'partner' || art === 'event' ? karte || null : null, stunden })
                kopieren(r.code)
              } catch (e) {
                toast.error(friendlyError(e))
              }
            }}
          >
            Code erzeugen
          </Button>
        </div>
        <div className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="flex items-center gap-2 font-display text-xl">
            <CalendarDays className="h-5 w-5" /> Massen-Erzeugung
          </h2>
          <p className="text-xs text-muted-foreground">Je Tag ein Story-Code, gültig genau an diesem Tag (z. B. jeden Freitag einer).</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="co-start">Ab</Label>
              <Input id="co-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="co-tage">Tage</Label>
              <Input id="co-tage" type="number" min={1} max={60} value={tage} onChange={(e) => setTage(Number(e.target.value))} />
            </div>
          </div>
          <Button
            variant="outline"
            disabled={massen.isPending}
            onClick={async () => {
              try {
                const r = await massen.mutateAsync({ start, tage, titel: titel || 'Story-Code' })
                toast.success(`${r.length} Codes erzeugt.`)
              } catch (e) {
                toast.error(friendlyError(e))
              }
            }}
          >
            {tage} Codes erzeugen
          </Button>
        </div>
        <div className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="flex items-center gap-2 font-display text-xl">
            <Gift className="h-5 w-5" /> Adventskalender
          </h2>
          <p className="text-xs text-muted-foreground">24 Codes (1.–24.12.), je am Tag gültig. Der 24. liefert die Weihnachts-Spezialkarte (vorher als limitierte Spezial-Karte anlegen).</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="co-jahr">Jahr</Label>
              <Input id="co-jahr" type="number" value={jahr} onChange={(e) => setJahr(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="co-xmas">Karte am 24.</Label>
              <Select id="co-xmas" value={xmas} onChange={(e) => setXmas(e.target.value)}>
                <option value="">— zufällig —</option>
                {limitierte.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.titel}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Button
            variant="outline"
            disabled={advent.isPending}
            onClick={async () => {
              try {
                const r = await advent.mutateAsync({ jahr, karte: xmas || null })
                toast.success(`Adventskalender ${jahr}: ${r.length} Codes bereit.`)
              } catch (e) {
                toast.error(friendlyError(e))
              }
            }}
          >
            Kalender anlegen
          </Button>
        </div>
      </section>

      {codes.isLoading ? (
        <SkeletonRows rows={5} />
      ) : (codes.data ?? []).length === 0 ? (
        <EmptyState icon={Ticket} title="Noch keine Codes" description="Story-Codes für Instagram, Partner-Codes für die Läden, Adventskalender." />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {(codes.data ?? []).map((c) => {
            const laeuft = new Date(c.gueltig_von).getTime() <= jetzt && new Date(c.gueltig_bis).getTime() > jetzt
            const vorbei = new Date(c.gueltig_bis).getTime() <= jetzt
            return (
              <li key={c.id} className={cn('flex flex-wrap items-center gap-3 px-4 py-2.5', (vorbei || !c.aktiv) && 'opacity-55')}>
                <button type="button" className="font-mono text-sm font-semibold" onClick={() => kopieren(c.code)} title="Kopieren">
                  {c.code} <Copy className="inline h-3.5 w-3.5" />
                </button>
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] uppercase tracking-wide">{ART[c.art]}</span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {c.titel}
                  {c.advent_tag ? ` · ${c.advent_tag}. Dezember` : ''}
                </span>
                <span className="text-xs text-muted-foreground">
                  {laeuft && <b className="mr-1 text-primary">läuft</b>}
                  {new Date(c.gueltig_von).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })} – {new Date(c.gueltig_bis).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-sm tabular-nums" title="Einlösungen">
                  {c.einloesungen ?? 0}
                </span>
                <Button variant="ghost" size="sm" onClick={() => aktiv.mutate({ id: c.id, aktiv: !c.aktiv })}>
                  {c.aktiv ? 'Sperren' : 'Freigeben'}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
