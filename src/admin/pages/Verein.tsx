import { useEffect, useState } from 'react'
import { ExternalLink, Save, Loader2, CheckCircle2, AlertCircle, Link2, Phone, Clock, Scale } from 'lucide-react'
import { PageHeader } from './Placeholder'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Switch } from '../components/ui/switch'
import { SkeletonRows } from '../components/ui/skeleton'
import { useToast } from '../components/ui/toast'
import { PflegeHinweis } from '../components/PflegeHinweis'
import { friendlyError, isMissingSchema } from '../lib/db'
import { useSaveSettings, useSettings } from '../lib/queries'
import { fussballDeUrl, normalizeWhatsapp, parseFussballDeTeamId } from '../lib/pflege'
import { relativZeit } from '../lib/format'
import { cn } from '../lib/utils'

// ─────────────────────────────────────────────────────────────
// v14-C: Verein & Links — alles, was auf der Website als Kontakt/Link steht.
// Eingaben werden großzügig angenommen und normalisiert (fussball.de: Link
// ODER Team-ID; WhatsApp: „0151 …“, „+49 151 …“ → 49151…). Jeder Link hat
// einen „Testen“-Knopf.
// ─────────────────────────────────────────────────────────────

interface Form {
  fussballDe: string
  fupa: string
  instagram: string
  whatsapp: string
  email: string
  training: string
  adresse: string
  saison: string
  rechtstexteOk: boolean
}

const LEER: Form = { fussballDe: '', fupa: '', instagram: '', whatsapp: '', email: '', training: '', adresse: '', saison: '', rechtstexteOk: false }

export function Verein() {
  const toast = useToast()
  const q = useSettings()
  const save = useSaveSettings()
  const [f, setF] = useState<Form>(LEER)
  const [geladen, setGeladen] = useState<Form>(LEER)

  useEffect(() => {
    const s = q.data
    if (!s) return
    const form: Form = {
      fussballDe: s.fussball_de_team_id ?? '',
      fupa: s.fupa_url ?? '',
      instagram: s.instagram ?? '',
      whatsapp: s.whatsapp ?? '',
      email: s.email ?? '',
      training: s.training ?? '',
      adresse: s.adresse ?? '',
      saison: s.saison ?? '',
      rechtstexteOk: s.rechtstexte_ok,
    }
    setF(form)
    setGeladen(form)
  }, [q.data])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }))
  const dirty = JSON.stringify(f) !== JSON.stringify(geladen)

  // Live-Prüfung
  const teamId = parseFussballDeTeamId(f.fussballDe)
  const fupaOk = !f.fupa.trim() || /^https:\/\/(www\.)?fupa\.net\//.test(f.fupa.trim())
  const insta = f.instagram.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/.*$/, '')
  const instaOk = !insta || /^[A-Za-z0-9._]{1,30}$/.test(insta)
  const wa = normalizeWhatsapp(f.whatsapp)
  const waOk = !f.whatsapp.trim() || !!wa
  const mailOk = !f.email.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())
  const fehler = [
    f.fussballDe.trim() && !teamId && 'fussball.de: Link oder Team-ID nicht erkannt.',
    !fupaOk && 'FuPa: Link muss mit https://www.fupa.net/ beginnen.',
    !instaOk && 'Instagram: nur der Name, z. B. sva_fussball.',
    !waOk && 'WhatsApp: Nummer nicht erkannt, z. B. 0151 12345678.',
    !mailOk && 'E-Mail sieht nicht richtig aus.',
  ].filter(Boolean) as string[]

  const speichern = async () => {
    if (fehler.length) return toast.error(fehler[0])
    try {
      await save.mutateAsync({
        fussball_de_team_id: teamId,
        fupa_url: f.fupa.trim() || null,
        instagram: insta || null,
        whatsapp: wa,
        email: f.email.trim() || null,
        training: f.training.trim() || null,
        adresse: f.adresse.trim() || null,
        saison: f.saison.trim() || null,
        rechtstexte_ok: f.rechtstexteOk,
      })
      toast.success('Gespeichert. Erscheint nach „Website veröffentlichen“.')
    } catch (e) {
      toast.error(friendlyError(e, 'Speichern fehlgeschlagen.'))
    }
  }

  const schemaFehlt = q.error && isMissingSchema(q.error)

  return (
    <>
      <PageHeader
        title="Verein & Links"
        subtitle={q.data?.updated_by ? `Zuletzt geändert ${relativZeit(q.data.updated_at)} von ${q.data.updated_by.split('@')[0]}` : 'Kontakt, Trainingszeiten und Links für die Website.'}
      />

      {schemaFehlt && <PflegeHinweis schema className="mb-4" />}
      {q.error && !schemaFehlt && <PflegeHinweis className="mb-4" title="Konnte nicht laden">{friendlyError(q.error)}</PflegeHinweis>}

      {q.isPending ? (
        <SkeletonRows rows={6} />
      ) : (
        <div className="space-y-4 pb-20 md:pb-0">
          <Abschnitt icon={Link2} titel="Links">
            <Feld id="v-fd" label="fussball.de — Mannschaftsseite" hint="Link aus dem Browser einfügen oder nur die Team-ID." ok={teamId ? 'Team-ID erkannt' : null} fehler={f.fussballDe.trim() && !teamId ? 'Nicht erkannt' : null} test={teamId ? fussballDeUrl(teamId) : null}>
              <Input id="v-fd" className="h-12 text-base" value={f.fussballDe} onChange={(e) => set('fussballDe', e.target.value)} placeholder="https://www.fussball.de/mannschaft/…/team-id/…" />
            </Feld>
            <Feld id="v-fupa" label="FuPa — Teamseite" fehler={!fupaOk ? 'Muss mit https://www.fupa.net/ beginnen' : null} test={f.fupa.trim() && fupaOk ? f.fupa.trim() : null}>
              <Input id="v-fupa" className="h-12 text-base" inputMode="url" value={f.fupa} onChange={(e) => set('fupa', e.target.value)} placeholder="https://www.fupa.net/team/…" />
            </Feld>
            <Feld id="v-ig" label="Instagram" fehler={!instaOk ? 'Nur der Name' : null} test={insta && instaOk ? `https://instagram.com/${insta}` : null}>
              <div className="flex h-12 items-center rounded-md border border-input bg-background pl-3 focus-within:ring-2 focus-within:ring-ring">
                <span className="text-muted-foreground">@</span>
                <input id="v-ig" className="h-full min-w-0 flex-1 bg-transparent px-1 text-base outline-none" value={f.instagram} onChange={(e) => set('instagram', e.target.value)} placeholder="sva_fussball" autoCapitalize="none" />
              </div>
            </Feld>
          </Abschnitt>

          <Abschnitt icon={Phone} titel="Kontakt">
            <Feld
              id="v-wa"
              label="WhatsApp-Nummer"
              hint="Für alle „Schreib uns“-Knöpfe. Ohne Nummer gehen sie auf E-Mail."
              ok={wa ? `wird gespeichert als +${wa}` : null}
              fehler={!waOk ? 'Nummer nicht erkannt' : null}
              test={wa ? `https://wa.me/${wa}` : null}
            >
              <Input id="v-wa" className="h-12 text-base" inputMode="tel" value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="0151 12345678" />
            </Feld>
            <Feld id="v-mail" label="E-Mail" fehler={!mailOk ? 'Sieht nicht richtig aus' : null}>
              <Input id="v-mail" className="h-12 text-base" type="email" inputMode="email" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="info@aga-erste.de" />
            </Feld>
          </Abschnitt>

          <Abschnitt icon={Clock} titel="Training & Platz">
            <Feld id="v-tr" label="Trainingszeiten" hint="So wie es auf der Website stehen soll.">
              <Input id="v-tr" className="h-12 text-base" value={f.training} onChange={(e) => set('training', e.target.value)} placeholder="Di & Do, ab 19:00 Uhr" />
            </Feld>
            <Feld id="v-adr" label="Adresse des Sportplatzes" test={f.adresse.trim() ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.adresse.trim())}` : null} testLabel="Karte">
              <Textarea id="v-adr" className="text-base" rows={2} value={f.adresse} onChange={(e) => set('adresse', e.target.value)} placeholder="Waldsportplatz Agathenburg, Zur Mehrzweckhalle, 21684 Agathenburg" />
            </Feld>
            <Feld id="v-saison" label="Aktuelle Saison" hint="Die Tabelle zeigt nur Zeilen dieser Saison.">
              <Input id="v-saison" className="h-12 w-32 text-base" value={f.saison} onChange={(e) => set('saison', e.target.value)} placeholder="2026/27" />
            </Feld>
          </Abschnitt>

          <Abschnitt icon={Scale} titel="Rechtliches">
            <p className="text-sm text-muted-foreground">
              Impressum und Datenschutz sind feste Seiten. Prüfe sie und bestätige hier, wenn alles ausgefüllt ist:{' '}
              <a href="/impressum" target="_blank" rel="noreferrer" className="underline underline-offset-2">Impressum</a> ·{' '}
              <a href="/datenschutz" target="_blank" rel="noreferrer" className="underline underline-offset-2">Datenschutz</a>
            </p>
            <Switch checked={f.rechtstexteOk} onChange={(v) => set('rechtstexteOk', v)} label="Impressum & Datenschutz sind vollständig" hint="Nur ein Haken für die Checkliste — ändert die Seiten nicht." />
          </Abschnitt>

          {/* Speichern: am Handy fest über der Tab-Leiste */}
          <div className={cn('fixed inset-x-0 bottom-[60px] z-20 border-t border-border bg-background/95 p-3 backdrop-blur md:static md:block md:border-0 md:bg-transparent md:p-0', !dirty && 'hidden')}>
            <Button className="h-12 w-full text-base md:w-auto md:px-8" onClick={() => void speichern()} disabled={!dirty || save.isPending || !!schemaFehlt}>
              {save.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              {dirty ? 'Speichern' : 'Gespeichert'}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

function Abschnitt({ icon: Icon, titel, children }: { icon: typeof Link2; titel: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-4 md:p-5">
        <h2 className="flex items-center gap-2 font-display text-lg tracking-wide">
          <Icon className="h-5 w-5 text-muted-foreground" /> {titel}
        </h2>
        {children}
      </CardContent>
    </Card>
  )
}

function Feld({
  id,
  label,
  hint,
  ok,
  fehler,
  test,
  testLabel = 'Testen',
  children,
}: {
  id: string
  label: string
  hint?: string
  ok?: string | null
  fehler?: string | null
  test?: string | null
  testLabel?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">{children}</div>
        {test && (
          <Button asChild variant="outline" className="h-12 shrink-0">
            <a href={test} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" /> <span className="hidden sm:inline">{testLabel}</span>
            </a>
          </Button>
        )}
      </div>
      {(fehler || ok || hint) && (
        <p className={cn('flex items-center gap-1 text-xs', fehler ? 'text-primary' : ok ? 'text-green-400' : 'text-muted-foreground')}>
          {fehler ? <AlertCircle className="h-3.5 w-3.5" /> : ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
          {fehler ?? ok ?? hint}
        </p>
      )}
    </div>
  )
}
