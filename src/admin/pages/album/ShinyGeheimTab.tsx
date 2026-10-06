import { useEffect, useMemo, useRef, useState } from 'react'
import { ImageDown, Loader2, Sparkles, Wand2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Switch } from '../../components/ui/switch'
import { Input } from '../../components/ui/input'
import { SkeletonRows } from '../../components/ui/skeleton'
import { EmptyState } from '../../components/ui/empty-state'
import { useToast } from '../../components/ui/toast'
import { friendlyError } from '../../lib/db'
import { herunterladen } from '../../lib/albumPlakat'
import { useGeheimEier, useGeheimSetzen, useGeheimStandard, useOeffentlicherKatalog, useShinyUebersicht, type GeheimEi, type ShinyFundRow } from '../../lib/album'
import { SvaKarte } from '../../../karten/SvaKarte'
import type { KartenDaten } from '../../../karten/typen'
import { kartenDaten, shinyDaten } from '../../../album/kartenDaten'
import { KartenLabor } from '../../../album/KartenLabor'
import type { Karte, Katalog } from '../../../album/api'

// ─────────────────────────────────────────────────────────────
// v22-A Admin → Album → „Shiny & Geheim“ und „Labor“.
//   Shiny-Funde: wer hat welche Person shiny gezogen (Erstfund markiert),
//   je Fund eine fertige Story-Grafik „SHINY gezogen!“ (PNG 1080×1920).
//   Geheimkarten: Easter Eggs an/aus, Rätseltext, Funde je Karte.
//   Labor: alle Karten des echten Katalogs in allen Fassungen (nur lesen).
// ─────────────────────────────────────────────────────────────

const ORT: Record<string, string> = {
  wappen: 'Startseite: 7× schnell aufs Wappen (oben links) tippen',
  ball: 'Rundgang, Station Anzeigetafel: kleiner Ball unter „In den Kalender“ antippen',
  geburtstag: 'Album am Vereins-Geburtstag: drei Kerzen auf der Startseite antippen (Datum unter Regeln)',
  geste: 'Im Album wischen oder Pfeiltasten: hoch, hoch, runter, runter, links, rechts, links, rechts',
}
const datum = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Europe/Berlin' })
const geheimKarte = (e: GeheimEi): Karte | null =>
  e.karte ? ({ ...e.karte, limitiert: true, geheim: true } as Karte) : null

function useDaten(katalog: Katalog | undefined) {
  return useMemo(() => {
    const m = new Map((katalog?.karten ?? []).map((k) => [k.id, k]))
    return (id: string) => {
      const k = m.get(id)
      return k ? kartenDaten(k, undefined, undefined, katalog?.saison) : null
    }
  }, [katalog])
}

export function ShinyGeheimTab() {
  const toast = useToast()
  const shiny = useShinyUebersicht()
  const geheim = useGeheimEier()
  const setzen = useGeheimSetzen()
  const standard = useGeheimStandard()
  const katalog = useOeffentlicherKatalog()
  const daten = useDaten(katalog.data)
  const [laeuft, setLaeuft] = useState<string | null>(null)

  const story = async (f: ShinyFundRow) => {
    const d = daten(f.karteId)
    if (!d) return toast.error('Karte nicht im Katalog gefunden.')
    setLaeuft(f.karteId + f.at)
    try {
      const { storyShiny, alsBlob } = await import('../../../karten/export/bild')
      const erst = shiny.data?.erstfunde.find((e) => e.karteId === f.karteId)
      const c = await storyShiny(shinyDaten(d, erst ? { name: erst.name, at: erst.at } : null), erst?.name, erst ? datum(erst.at) : undefined, shiny.data?.chance || 250)
      herunterladen(await alsBlob(c), `sva-shiny-${f.person.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-story.png`)
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setLaeuft(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-xl">
            <Sparkles className="h-5 w-5 text-sva-gold" /> Shiny-Funde
          </h2>
          {shiny.data && (
            <p className="text-sm text-muted-foreground">
              Saison {shiny.data.saison} · Chance 1 : {shiny.data.chance || '—'} · {shiny.data.gesamt} Shinys · {shiny.data.personen} Personen · {shiny.data.fans} Fans
            </p>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Jede gezogene Spieler-/Trainerkarte ist mit der eingestellten Chance zusätzlich „Shiny“ (serverseitig, beim Anlegen des Packs). Kein Vorteil im Spiel,
          zählt nicht fürs Album. Wer eine Person als Erste(r) findet, steht auf der Karte. Je Fund: fertige Story-Grafik zum Posten.
        </p>
        {shiny.isLoading ? (
          <SkeletonRows rows={3} />
        ) : shiny.error ? (
          <p className="text-sm text-primary">{friendlyError(shiny.error)}</p>
        ) : !shiny.data?.funde.length ? (
          <EmptyState icon={Sparkles} title="Noch kein Shiny gezogen" description="Bei 1 : 250 je Karte dauert das. Sobald jemand eins öffnet, steht es hier — mit Story-Grafik." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shiny.data.funde.map((f) => {
              const d = daten(f.karteId)
              return (
                <li key={f.karteId + f.at} className="flex gap-3 rounded-lg border border-border p-3">
                  <div className="w-16 shrink-0">{d && <SvaKarte daten={shinyDaten(d)} stufe="klein" />}</div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-medium">{f.person}</p>
                    <p className="text-sm text-muted-foreground">
                      {f.fan} · {datum(f.at)}
                      {f.anzahl > 1 ? ` · ×${f.anzahl}` : ''}
                    </p>
                    {f.erstfund && <span className="inline-block rounded bg-sva-gold px-1.5 text-[11px] font-bold text-black">Erstfund</span>}
                    <Button size="sm" variant="outline" className="h-9" onClick={() => void story(f)} disabled={laeuft === f.karteId + f.at || !d}>
                      {laeuft === f.karteId + f.at ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />} Story „SHINY gezogen!“
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <ShinyVorschau katalog={katalog.data} chance={shiny.data?.chance} />
      </section>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-xl">
            <Wand2 className="h-5 w-5 text-primary" /> Geheimkarten (Easter Eggs)
          </h2>
          <Button
            variant="outline"
            className="h-10"
            disabled={standard.isPending}
            onClick={() =>
              standard.mutate(undefined, {
                onSuccess: (r) => toast.success(r.karten ? `${r.karten} Geheimkarten angelegt.` : 'Geheimkarten sind schon da.'),
                onError: (e) => toast.error(friendlyError(e)),
              })
            }
          >
            Geheimkarten anlegen
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Nur durch Entdecken: Im Album stehen sie als „???“ mit Rätsel auf der Geheimen Seite. Das Easter Egg schickt nur ein Token; ob es passt, prüft die
          Datenbank (dort liegt nur der Hash). Je Fan einmal. Aus = das Ei bringt nichts mehr und verschwindet bei allen, die die Karte noch nicht haben.
          {geheim.data && !geheim.data.vereinsGeburtstag && <b className="text-foreground"> Vereins-Geburtstag fehlt noch (Regeln) — bis dahin schläft das Kerzen-Ei.</b>}
        </p>
        {geheim.isLoading ? (
          <SkeletonRows rows={4} />
        ) : !geheim.data?.eier.length ? (
          <EmptyState icon={Wand2} title="Noch keine Geheimkarten" description="„Geheimkarten anlegen“ legt die vier Standard-Karten mit ihren Eiern an." />
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {geheim.data.eier.map((e) => {
              const k = geheimKarte(e)
              return (
                <li key={e.schluessel} className="flex gap-3 rounded-lg border border-border p-3">
                  <div className="w-20 shrink-0">{k && <SvaKarte daten={kartenDaten(k)} stufe="klein" />}</div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{e.karte?.titel ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{ORT[e.schluessel] ?? e.schluessel}</p>
                      </div>
                      <span className="shrink-0 text-sm text-muted-foreground">{e.gefunden}× gefunden</span>
                    </div>
                    <RaetselFeld e={e} onSpeichern={(raetsel) => setzen.mutate({ schluessel: e.schluessel, raetsel }, { onSuccess: () => toast.success('Rätsel gespeichert.'), onError: (x) => toast.error(friendlyError(x)) })} />
                    <Switch
                      checked={e.aktiv}
                      onChange={(aktiv) => setzen.mutate({ schluessel: e.schluessel, aktiv }, { onError: (x) => toast.error(friendlyError(x)) })}
                      label={e.aktiv ? 'Ei aktiv' : 'Ei aus'}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function RaetselFeld({ e, onSpeichern }: { e: GeheimEi; onSpeichern: (t: string) => void }) {
  const [t, setT] = useState(e.raetsel)
  return (
    <div className="flex gap-2">
      <Input aria-label="Rätseltext" value={t} maxLength={160} onChange={(x) => setT(x.target.value)} className="h-10" />
      <Button size="sm" variant="outline" className="h-10" disabled={t.trim() === e.raetsel || t.trim().length < 4} onClick={() => onSpeichern(t.trim())}>
        Speichern
      </Button>
    </div>
  )
}

/** Vorschau der Story-Grafik (mit einer Beispiel-Person), damit man sie vorab sieht. */
function ShinyVorschau({ katalog, chance }: { katalog?: Katalog; chance?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [an, setAn] = useState(false)
  const beispiel = useMemo<KartenDaten | null>(() => {
    const k = katalog?.karten.find((x) => x.typ === 'spieler' && !x.variante && !x.limitiert)
    return k ? kartenDaten(k, undefined, undefined, katalog?.saison) : null
  }, [katalog])
  useEffect(() => {
    if (!an || !beispiel || !ref.current) return
    let weg = false
    void import('../../../karten/export/bild').then(async ({ storyShiny }) => {
      const c = await storyShiny(shinyDaten(beispiel, { name: 'Lena B.', at: new Date().toISOString() }), 'Lena B.', datum(new Date().toISOString()), chance || 250)
      if (weg || !ref.current) return
      c.style.width = '100%'
      c.style.height = 'auto'
      c.style.borderRadius = '8px'
      ref.current.replaceChildren(c)
    })
    return () => {
      weg = true
    }
  }, [an, beispiel, chance])
  if (!beispiel) return null
  return (
    <div className="space-y-2">
      <Button size="sm" variant="ghost" className="h-9" onClick={() => setAn((x) => !x)}>
        {an ? 'Vorschau ausblenden' : 'Vorschau der Story-Grafik (Beispiel)'}
      </Button>
      {an && <div ref={ref} className="max-w-[260px]" />}
    </div>
  )
}

export function LaborTab() {
  const katalog = useOeffentlicherKatalog()
  const geheim = useGeheimEier()
  if (katalog.isLoading) return <SkeletonRows rows={6} />
  if (!katalog.data) return <p className="text-sm text-primary">{katalog.error ? friendlyError(katalog.error) : 'Katalog nicht geladen.'}</p>
  const g = (geheim.data?.eier ?? []).map(geheimKarte).filter((k): k is Karte => !!k)
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Der echte Katalog (nur gelesen) — jede Karte in jeder Fassung: Basis, Glanz, limitiert, Shiny und Geheim. Antippen = groß mit Holo-Neigung und Rückseite.
        Nichts wird gespeichert. Mit Demo-Fan und Pack-Animationen: „Album-Vorführung öffnen“ (oben rechts).
      </p>
      <KartenLabor katalog={katalog.data} geheim={g} />
    </div>
  )
}
