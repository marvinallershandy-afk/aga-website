import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, PackageCheck } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select } from '../../components/ui/select'
import { Switch } from '../../components/ui/switch'
import { SkeletonRows } from '../../components/ui/skeleton'
import { useToast } from '../../components/ui/toast'
import { friendlyError, isMissingSchema } from '../../lib/db'
import { usePackKontrolle, usePackNachliefern, usePackTypen, useSavePackTyp, type PackTypInput, type PackTypRow } from '../../lib/album'

// ─────────────────────────────────────────────────────────────
// v24-P: Admin → Album → Regeln „Pack-Typen“ (Tipp-, Spieltags-, Sieg-,
// Starter-, Ziel-, Event-Pack) und die Karte „Pack-Kontrolle“ (Woche).
// Werte: sva_album_pack_typen (Migration 20261017100000). Ziehen tut
// weiter nur die Datenbank — hier wird eingestellt und kontrolliert.
// ─────────────────────────────────────────────────────────────

const OPTIK: { value: PackTypRow['optik']; label: string }[] = [
  { value: 'klein', label: 'Klein (rot)' },
  { value: 'gross', label: 'Groß (Anthrazit, Silberband)' },
  { value: 'gold', label: 'Goldfolie' },
  { value: 'starter', label: 'Starter (weiß/rot)' },
  { value: 'ziel', label: 'Ziel (schwarz/gold)' },
  { value: 'event', label: 'Event (Holo)' },
]
const QUELLE: Record<PackTypRow['typ'], string> = {
  tipp: 'Erster Tipp eines Spieltags (Tipp-Liga)',
  spieltag: 'Check-in am Platz (QR-Code)',
  sieg: 'Heimsieg — alle, die getippt oder eingecheckt haben',
  starter: 'Einmal zur Anmeldung',
  ziel: 'Kapitel komplett (Ziele haben ihre eigene Kartenzahl)',
  event: 'Event-Codes (Derby, MOTM-Woche …) + Check-in beim Derby',
}

export function PackTypenEditor() {
  const toast = useToast()
  const q = usePackTypen()
  const speichern = useSavePackTyp()
  const [entwurf, setEntwurf] = useState<Record<string, PackTypInput>>({})
  if (q.isLoading) return <SkeletonRows rows={3} />
  if (q.error) {
    return (
      <p className="text-sm text-muted-foreground">
        {isMissingSchema(q.error) ? 'Pack-Typen kommen mit der Migration 20261017100000_sva_album_packs_v24.sql.' : friendlyError(q.error)}
      </p>
    )
  }
  const zeilen = q.data ?? []
  const wert = <K extends keyof PackTypRow>(t: PackTypRow, k: K): PackTypRow[K] => ((entwurf[t.typ]?.[k as keyof PackTypInput] ?? t[k]) as PackTypRow[K])
  const set = (t: PackTypRow, p: PackTypInput) => setEntwurf((e) => ({ ...e, [t.typ]: { ...e[t.typ], ...p } }))
  const geaendert = Object.keys(entwurf).length > 0
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Jeder Pack-Typ hat seine Kartenzahl, eine Garantie (die letzte Karte wird notfalls ersetzt), eine eigene Tütchen-Optik, die Reveal-Intensität und den
        <b> Wochen-Slot</b>: einmal je Pack die Chance auf die limitierte Wochenkarte (Spieler des Spiels, Derby-Karte) — nur, wenn der Fan sie noch nicht hat. 0 Karten = Typ aus.
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        {zeilen.map((t) => (
          <div key={t.typ} className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-baseline justify-between gap-2">
              <Input aria-label={`Name ${t.typ}`} className="max-w-[14rem] font-semibold" value={wert(t, 'titel')} maxLength={40} onChange={(e) => set(t, { titel: e.target.value })} />
              <span className="text-xs text-muted-foreground">{QUELLE[t.typ]}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor={`pt-k-${t.typ}`}>Karten</Label>
                <Input id={`pt-k-${t.typ}`} type="number" inputMode="numeric" min={0} max={10} value={String(wert(t, 'karten'))} onChange={(e) => set(t, { karten: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`pt-m-${t.typ}`}>Garantie</Label>
                <Select id={`pt-m-${t.typ}`} value={wert(t, 'min_seltenheit') ?? ''} onChange={(e) => set(t, { min_seltenheit: (e.target.value || null) as PackTypRow['min_seltenheit'] })}>
                  <option value="">keine</option>
                  <option value="silber">mind. 1 Silber</option>
                  <option value="gold">mind. 1 Gold</option>
                  <option value="spezial">mind. 1 Spezial</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`pt-c-${t.typ}`}>Wochen-Slot %</Label>
                <Input id={`pt-c-${t.typ}`} type="number" inputMode="numeric" min={0} max={100} value={String(wert(t, 'limitiert_chance'))} onChange={(e) => set(t, { limitiert_chance: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`pt-r-${t.typ}`}>Reveal</Label>
                <Select id={`pt-r-${t.typ}`} value={String(wert(t, 'reveal'))} onChange={(e) => set(t, { reveal: Number(e.target.value) as 1 | 2 | 3 })}>
                  <option value="1">1 · ruhig</option>
                  <option value="2">2 · normal</option>
                  <option value="3">3 · groß</option>
                </Select>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Select aria-label={`Optik ${t.typ}`} value={wert(t, 'optik')} onChange={(e) => set(t, { optik: e.target.value as PackTypRow['optik'] })}>
                {OPTIK.map((o) => (
                  <option key={o.value} value={o.value}>
                    Optik: {o.label}
                  </option>
                ))}
              </Select>
              <Switch checked={!!wert(t, 'smart')} onChange={(v) => set(t, { smart: v })} label="Smart-Pack" hint="Erste Karte = fehlende Album-Karte" />
            </div>
          </div>
        ))}
      </div>
      <Button
        disabled={!geaendert || speichern.isPending}
        onClick={async () => {
          try {
            for (const [typ, p] of Object.entries(entwurf)) await speichern.mutateAsync({ typ: typ as PackTypRow['typ'], ...p })
            setEntwurf({})
            toast.success('Pack-Typen gespeichert.')
          } catch (e) {
            toast.error(friendlyError(e))
          }
        }}
      >
        Pack-Typen speichern
      </Button>
    </div>
  )
}

/** Kleine Karte „Pack-Kontrolle: alles zugestellt ✓ / n fehlen → Nachliefern“. */
export function PackKontrolleKarte() {
  const toast = useToast()
  const q = usePackKontrolle()
  const nach = usePackNachliefern()
  const [auf, setAuf] = useState(false)
  if (q.isLoading) return null
  if (q.error) return isMissingSchema(q.error) ? null : <p className="text-sm text-muted-foreground">Pack-Kontrolle: {friendlyError(q.error)}</p>
  const k = q.data
  if (!k) return null
  const abw = k.anlaesse.filter((a) => a.fehlend > 0 || a.doppelt > 0)
  return (
    <section className={`rounded-lg border p-4 ${k.ok ? 'border-emerald-500/40' : 'border-amber-500/60'}`} aria-label="Pack-Kontrolle">
      <div className="flex flex-wrap items-center gap-3">
        {k.ok ? <CheckCircle2 className="h-6 w-6 text-emerald-500" aria-hidden="true" /> : <AlertTriangle className="h-6 w-6 text-amber-500" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg">{k.ok ? 'Pack-Kontrolle: alles zugestellt ✓' : `Pack-Kontrolle: ${k.fehlend} ${k.fehlend === 1 ? 'Pack fehlt' : 'Packs fehlen'}`}</h2>
          <p className="text-xs text-muted-foreground">
            Saison {k.saison} · {k.ist} von {k.soll} zustehenden Packs da (Tipp, Check-in, Sieg, Starter, Ziele){k.doppelt ? ` · ${k.doppelt} doppelt` : ''}
          </p>
        </div>
        {!k.ok && k.fehlend > 0 && (
          <Button
            size="sm"
            disabled={nach.isPending}
            onClick={async () => {
              try {
                const r = await nach.mutateAsync('alle')
                toast.success(`${r.nachgeliefert} ${r.nachgeliefert === 1 ? 'Pack' : 'Packs'} nachgeliefert${r.offen ? ` · ${r.offen} noch offen` : ''}.`)
              } catch (e) {
                toast.error(friendlyError(e))
              }
            }}
          >
            {nach.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />} Nachliefern
          </Button>
        )}
        {abw.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setAuf((x) => !x)} aria-expanded={auf}>
            {auf ? 'Weniger' : 'Details'}
          </Button>
        )}
      </div>
      {auf && abw.length > 0 && (
        <ul className="mt-3 divide-y divide-border rounded-md border border-border text-sm">
          {abw.slice(0, 20).map((a) => (
            <li key={a.anlass} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <b>{a.titel}</b> · Soll {a.soll} · Ist {a.ist}
                {a.fehlend ? <span className="text-amber-600"> · fehlt: {a.fans.slice(0, 6).join(', ')}{a.fans.length > 6 ? ' …' : ''}</span> : null}
              </span>
              {a.fehlend > 0 && (
                <Button size="sm" variant="ghost" disabled={nach.isPending} onClick={() => void nach.mutateAsync(a.anlass).then((r) => toast.success(`${r.nachgeliefert} nachgeliefert.`)).catch((e) => toast.error(friendlyError(e)))}>
                  Nachliefern
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
