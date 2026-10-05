import { useEffect, useMemo, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Skeleton } from '../../components/ui/skeleton'
import { useToast } from '../../components/ui/toast'
import { PflegeHinweis } from '../../components/PflegeHinweis'
import { friendlyError, isMissingSchema } from '../../lib/db'
import { useInsights } from '../../lib/queries'
import { relativZeit } from '../../lib/format'
import { usePartnerInfo, useSavePartnerInfo, type PartnerInfoInput } from '../../lib/partner'

// ─────────────────────────────────────────────────────────────
// v16-S: Mediadaten für /partner. Nur gefüllte Felder erscheinen auf der
// Seite. Instagram-Follower lassen sich aus „Insights“ (Archiv) übernehmen.
// ─────────────────────────────────────────────────────────────

const FELDER = [
  { key: 'instagram_follower', label: 'Instagram-Follower', hint: 'aktuelle Zahl aus der Instagram-App' },
  { key: 'reichweite_monat', label: 'Ø Reichweite pro Monat', hint: 'Instagram → Insights → erreichte Konten (30 Tage)' },
  { key: 'zuschauer_heim', label: 'Ø Zuschauer pro Heimspiel', hint: 'ehrlich geschätzt oder gezählt' },
  { key: 'website_besuche_monat', label: 'Website-Besuche pro Monat', hint: 'Netlify → Analytics, falls aktiv' },
  { key: 'heimspiele_saison', label: 'Heimspiele pro Saison', hint: 'Kreisliga: meist 15' },
] as const
type Key = (typeof FELDER)[number]['key']

export function ZahlenTab() {
  const toast = useToast()
  const info = usePartnerInfo()
  const save = useSavePartnerInfo()
  const insights = useInsights()
  const [werte, setWerte] = useState<Record<Key, string>>({ instagram_follower: '', reichweite_monat: '', zuschauer_heim: '', website_besuche_monat: '', heimspiele_saison: '' })
  const [stand, setStand] = useState('')
  // v19-S: Ansprechpartner über dem /partner-Formular (leer = kein Block)
  const [kontakt, setKontakt] = useState({ name: '', rolle: '', foto: '', telefon: '' })
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    const d = info.data
    if (!d) return
    setWerte({
      instagram_follower: d.instagram_follower?.toString() ?? '',
      reichweite_monat: d.reichweite_monat?.toString() ?? '',
      zuschauer_heim: d.zuschauer_heim?.toString() ?? '',
      website_besuche_monat: d.website_besuche_monat?.toString() ?? '',
      heimspiele_saison: d.heimspiele_saison?.toString() ?? '',
    })
    setStand(d.stand ?? '')
    setKontakt({
      name: d.ansprechpartner_name ?? '',
      rolle: d.ansprechpartner_rolle ?? '',
      foto: d.ansprechpartner_foto_url ?? '',
      telefon: d.ansprechpartner_telefon ?? '',
    })
  }, [info.data])

  const letzteInsta = useMemo(
    () => [...(insights.data ?? [])].filter((r) => r.kanal === 'instagram' && r.follower != null).sort((a, b) => b.datum.localeCompare(a.datum))[0] ?? null,
    [insights.data],
  )

  if (info.error && isMissingSchema(info.error)) {
    return <PflegeHinweis schema title="Zahlen brauchen die Partner-Migration">Marvin wendet einmalig <code>20261006100000_sva_partner.sql</code> an (docs/PARTNER.md).</PflegeHinweis>
  }
  if (info.isPending) return <Skeleton className="h-72 w-full" />

  const speichern = async () => {
    const input: PartnerInfoInput = {}
    for (const f of FELDER) {
      const t = werte[f.key].replace(/[.\s]/g, '').trim()
      if (t && !/^\d+$/.test(t)) return setFehler(`${f.label}: bitte nur eine ganze Zahl, z. B. 2840.`)
      input[f.key] = t ? Number(t) : null
    }
    const foto = kontakt.foto.trim()
    if (foto && !/^https:\/\/\S+$/.test(foto)) return setFehler('Foto-URL: bitte eine vollständige https-Adresse (oder leer lassen).')
    input.ansprechpartner_name = kontakt.name.trim() || null
    input.ansprechpartner_rolle = kontakt.rolle.trim() || null
    input.ansprechpartner_foto_url = foto || null
    input.ansprechpartner_telefon = kontakt.telefon.trim() || null
    setFehler(null)
    try {
      await save.mutateAsync({ ...input, stand: stand || new Date().toISOString().slice(0, 10) })
      if (!stand) setStand(new Date().toISOString().slice(0, 10))
      toast.success('Zahlen gespeichert. Erscheinen nach „Website veröffentlichen“ auf /partner.')
    } catch (e) {
      setFehler(friendlyError(e, 'Speichern fehlgeschlagen.'))
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <p className="text-sm text-muted-foreground">
        Sponsoren kaufen Reichweite. Diese Zahlen stehen oben auf /partner — <b className="text-foreground">nur gefüllte Felder</b> werden gezeigt. Lieber ehrlich und etwas niedriger als geschönt.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {FELDER.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={`md-${f.key}`}>{f.label}</Label>
            <Input id={`md-${f.key}`} className="h-12 text-base" inputMode="numeric" value={werte[f.key]} onChange={(e) => setWerte((w) => ({ ...w, [f.key]: e.target.value }))} placeholder="leer = nicht zeigen" />
            <p className="text-xs text-muted-foreground">{f.hint}</p>
            {f.key === 'instagram_follower' && letzteInsta && String(letzteInsta.follower) !== werte.instagram_follower && (
              <Button type="button" variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => setWerte((w) => ({ ...w, instagram_follower: String(letzteInsta.follower) }))}>
                <Download className="h-3.5 w-3.5" /> {letzteInsta.follower} aus Insights ({relativZeit(letzteInsta.datum)}) übernehmen
              </Button>
            )}
          </div>
        ))}
        <div className="space-y-1.5">
          <Label htmlFor="md-stand">Stand</Label>
          <Input id="md-stand" type="date" className="h-12 text-base" value={stand} onChange={(e) => setStand(e.target.value)} />
          <p className="text-xs text-muted-foreground">Erscheint als „Stand: Oktober 2026“. Leer = heute.</p>
        </div>
      </div>
      <div className="space-y-3 border-t pt-5">
        <div>
          <h3 className="text-sm font-semibold">Ansprechpartner (über dem Formular)</h3>
          <p className="text-xs text-muted-foreground">
            Steht auf /partner direkt über dem Anfrage-Formular — Firmen kaufen von Menschen. <b className="text-foreground">Nur sichtbar, wenn ein Name gesetzt ist.</b> Leer lassen = kein Block.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ap-name">Name</Label>
            <Input id="ap-name" className="h-12 text-base" value={kontakt.name} maxLength={80} onChange={(e) => setKontakt((k) => ({ ...k, name: e.target.value }))} placeholder="z. B. Vorname Nachname" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ap-rolle">Rolle</Label>
            <Input id="ap-rolle" className="h-12 text-base" value={kontakt.rolle} maxLength={80} onChange={(e) => setKontakt((k) => ({ ...k, rolle: e.target.value }))} placeholder="z. B. Sponsoring" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ap-foto">Foto-URL</Label>
            <Input id="ap-foto" className="h-12 text-base" inputMode="url" value={kontakt.foto} maxLength={500} onChange={(e) => setKontakt((k) => ({ ...k, foto: e.target.value }))} placeholder="https://… (optional)" />
            <p className="text-xs text-muted-foreground">Öffentliche https-Adresse. Der Build lädt das Bild lokal. Leer = Initialen.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ap-tel">Telefon</Label>
            <Input id="ap-tel" className="h-12 text-base" type="tel" inputMode="tel" value={kontakt.telefon} maxLength={40} onChange={(e) => setKontakt((k) => ({ ...k, telefon: e.target.value }))} placeholder="optional" />
          </div>
        </div>
      </div>
      {fehler && (
        <p role="alert" className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
          {fehler}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void speichern()} disabled={save.isPending} className="min-w-32">
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Zahlen speichern
        </Button>
        {info.data?.updated_by && (
          <span className="text-xs text-muted-foreground">
            Zuletzt {relativZeit(info.data.updated_at)} von {info.data.updated_by.split('@')[0]}
          </span>
        )}
      </div>
    </div>
  )
}
