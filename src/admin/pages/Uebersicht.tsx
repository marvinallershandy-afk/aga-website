import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  LayoutGrid,
  Users,
  ListOrdered,
  Handshake,
  Globe,
  CheckCircle2,
  AlertCircle,
  CircleDot,
  ChevronRight,
  Home,
  Bus,
} from 'lucide-react'
import { PageHeader } from './Placeholder'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { PublishButton } from '../components/PublishButton'
import { PflegeHinweis } from '../components/PflegeHinweis'
import {
  useLineup,
  usePublishLog,
  useRoster,
  useSettings,
  useSpiele,
  useSponsoren,
  useTabelle,
} from '../lib/queries'
import { isMissingSchema } from '../lib/db'
import { formatAnstoss, relativZeit } from '../lib/format'
import { ergebnisOffen, ergebnisText, letztesSpiel, naechstesSpiel, paarung } from '../lib/spiele'
import { cn } from '../lib/utils'

// ─────────────────────────────────────────────────────────────
// v14-C: Startseite der Vereins-Pflege. Drei Fragen, sofort beantwortet:
//   1. Ist die Website aktuell? (zuletzt veröffentlicht + was seitdem geändert)
//   2. Was steht an? (nächstes Spiel, Aufstellung, Kader, Tabelle)
//   3. Was fehlt noch? (Checkliste offener Pflichtinfos mit Direktlink)
// ─────────────────────────────────────────────────────────────

interface Aufgabe {
  text: string
  to: string
  wichtig: boolean
}

const maxIso = (xs: (string | null | undefined)[]) =>
  xs.reduce<string | null>((m, x) => (x && (!m || new Date(x) > new Date(m)) ? x : m), null)

export function Uebersicht() {
  const settingsQ = useSettings()
  const lineupQ = useLineup()
  const spieleQ = useSpiele()
  const rosterQ = useRoster()
  const tabelleQ = useTabelle()
  const sponsorenQ = useSponsoren()
  const logQ = usePublishLog()

  const schemaFehlt = [settingsQ.error, lineupQ.error, logQ.error].some((e) => e && isMissingSchema(e))
  const spiele = useMemo(() => spieleQ.data ?? [], [spieleQ.data])
  const roster = useMemo(() => rosterQ.data ?? [], [rosterQ.data])
  const spieler = roster.filter((r) => r.aktiv && (r.rolle ?? 'spieler') === 'spieler')
  const settings = settingsQ.data ?? null
  const lineup = lineupQ.data ?? null
  const tabelle = useMemo(() => tabelleQ.data ?? [], [tabelleQ.data])
  const sponsoren = (sponsorenQ.data ?? []).filter((s) => s.aktiv)

  const naechstes = naechstesSpiel(spiele)
  const letztes = letztesSpiel(spiele)
  const offen = ergebnisOffen(spiele)

  const letzteVeroeffentlichung = (logQ.data ?? []).find((l) => l.status === 'ok') ?? null
  const letzterVersuch = (logQ.data ?? [])[0] ?? null

  // Was hat sich seit der letzten Veröffentlichung geändert?
  const geaendert = useMemo(() => {
    const seit = letzteVeroeffentlichung?.angefordert_at ?? null
    const bereiche: [string, string | null][] = [
      ['Kader', maxIso(roster.map((r) => r.updated_at))],
      ['Aufstellung', lineup?.created_at ?? null],
      ['Spiele', maxIso(spiele.map((s) => s.updated_at))],
      ['Tabelle', maxIso(tabelle.map((t) => t.updated_at))],
      ['Sponsoren', maxIso((sponsorenQ.data ?? []).map((s) => s.updated_at))],
      ['Verein & Links', settings?.updated_at ?? null],
    ]
    return bereiche
      .filter(([, t]) => t && (!seit || new Date(t) > new Date(seit)))
      .map(([name]) => name)
  }, [letzteVeroeffentlichung, roster, lineup, spiele, tabelle, sponsorenQ.data, settings])

  // Inaktive/gelöschte Spieler in der gespeicherten Aufstellung?
  const aktiveIds = new Set(spieler.map((s) => s.id))
  const lineupKaputt = !!lineup && lineup.startelf.some((id) => !aktiveIds.has(id)) && !rosterQ.isPending

  const aufgaben: Aufgabe[] = []
  if (settings) {
    if (!settings.whatsapp) aufgaben.push({ text: 'WhatsApp-Nummer fehlt — ohne sie gehen alle WhatsApp-Knöpfe auf E-Mail.', to: '/verein', wichtig: true })
    if (!settings.rechtstexte_ok) aufgaben.push({ text: 'Impressum & Datenschutz ausfüllen und bestätigen.', to: '/verein', wichtig: true })
    if (!settings.updated_by) aufgaben.push({ text: 'Trainingszeit und Adresse einmal prüfen und speichern.', to: '/verein', wichtig: false })
    if (!settings.fupa_url) aufgaben.push({ text: 'FuPa-Link hinterlegen.', to: '/verein', wichtig: false })
  }
  if (!spieleQ.isPending && !naechstes) aufgaben.push({ text: 'Kein nächstes Spiel eingetragen.', to: '/spiele', wichtig: true })
  if (offen.length) {
    aufgaben.push({
      text: `${offen.length === 1 ? 'Ein Ergebnis fehlt' : `${offen.length} Ergebnisse fehlen`}: ${offen.slice(0, 2).map((s) => s.gegner).join(', ')}${offen.length > 2 ? ' …' : ''}`,
      to: '/spiele',
      wichtig: true,
    })
  }
  if (lineupKaputt) aufgaben.push({ text: 'In der Aufstellung steht ein inaktiver Spieler.', to: '/aufstellung', wichtig: true })
  else if (lineup?.erstellt_von === 'migration') aufgaben.push({ text: 'Aufstellung ist noch die Beispiel-Elf — echte Elf setzen.', to: '/aufstellung', wichtig: false })
  else if (!lineupQ.isPending && !lineupQ.error && !lineup) aufgaben.push({ text: 'Noch keine Aufstellung gespeichert.', to: '/aufstellung', wichtig: false })
  const ohneFoto = spieler.filter((s) => !s.foto_url).length
  if (ohneFoto) aufgaben.push({ text: `${ohneFoto} ${ohneFoto === 1 ? 'Spieler hat' : 'Spieler haben'} noch kein Foto.`, to: '/kader', wichtig: false })
  if (!tabelleQ.isPending && !tabelleQ.error && tabelle.length === 0) aufgaben.push({ text: 'Tabelle ist leer.', to: '/tabelle', wichtig: false })
  if (!sponsorenQ.isPending && sponsoren.length === 0) aufgaben.push({ text: 'Noch keine Sponsoren — die Bande zeigt Platzhalter.', to: '/sponsoren', wichtig: false })
  aufgaben.sort((a, b) => Number(b.wichtig) - Number(a.wichtig))

  const svaZeile = tabelle.find((t) => t.self)

  return (
    <>
      <PageHeader title="Übersicht" subtitle="Alles, was die Website aktuell hält — auf einen Blick." />

      {schemaFehlt && <PflegeHinweis schema className="mb-4" />}

      {/* 1. Website-Status + Veröffentlichen */}
      <Card className="mb-6 border-primary/40 bg-gradient-to-br from-primary/10 to-transparent">
        <CardContent className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between md:p-6">
          <div className="space-y-1.5">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Globe className="h-4 w-4" /> Website
            </p>
            {logQ.isPending ? (
              <Skeleton className="h-6 w-56" />
            ) : letzteVeroeffentlichung ? (
              <p className="text-lg">
                Zuletzt veröffentlicht <b>{relativZeit(letzteVeroeffentlichung.angefordert_at)}</b>
                {letzteVeroeffentlichung.angefordert_von && (
                  <span className="text-muted-foreground"> von {letzteVeroeffentlichung.angefordert_von.split('@')[0]}</span>
                )}
              </p>
            ) : (
              <p className="text-lg">Noch nie aus dem Admin veröffentlicht</p>
            )}
            {letzterVersuch && letzterVersuch.status !== 'ok' && (
              <p className="text-sm text-sva-gold">
                Letzter Versuch {relativZeit(letzterVersuch.angefordert_at)}:{' '}
                {letzterVersuch.status === 'nicht_konfiguriert' ? 'Veröffentlichen ist noch nicht eingerichtet.' : 'fehlgeschlagen.'}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {geaendert.length > 0 ? (
                <>
                  Seitdem geändert: <span className="text-foreground">{geaendert.join(', ')}</span>. Erst nach dem
                  Veröffentlichen sehen Besucher das.
                </>
              ) : letzteVeroeffentlichung ? (
                'Seitdem nichts geändert — die Website ist aktuell.'
              ) : (
                'Änderungen werden gespeichert und erscheinen nach dem Veröffentlichen auf der Website.'
              )}
            </p>
          </div>
          <PublishButton className="md:max-w-sm md:text-right" />
        </CardContent>
      </Card>

      {/* 2. Status-Karten */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusKarte icon={CalendarDays} titel="Nächstes Spiel" to="/spiele" laden={spieleQ.isPending}>
          {naechstes ? (
            <>
              <p className="font-display text-xl leading-tight tracking-wide">{paarung(naechstes)}</p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                {naechstes.heim ? <Home className="h-3.5 w-3.5" /> : <Bus className="h-3.5 w-3.5" />}
                {formatAnstoss(naechstes.anstoss)}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">Kein Spiel eingetragen</p>
          )}
          {letztes && (
            <p className="mt-2 text-xs text-muted-foreground">
              Zuletzt: {paarung(letztes)} <b className="text-foreground">{ergebnisText(letztes)}</b>
            </p>
          )}
        </StatusKarte>

        <StatusKarte icon={LayoutGrid} titel="Aufstellung" to="/aufstellung" laden={lineupQ.isPending}>
          {lineup ? (
            <>
              <p className="font-display text-xl leading-tight tracking-wide">{lineup.formation}</p>
              <p className="text-sm text-muted-foreground">
                {lineup.match_label || 'ohne Spielbezug'} · {lineup.bank.length} auf der Bank
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {lineup.erstellt_von === 'migration' ? 'Beispiel-Elf' : `Gespeichert ${relativZeit(lineup.created_at)}`}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">{lineupQ.error ? 'Noch nicht verfügbar' : 'Noch keine Aufstellung'}</p>
          )}
        </StatusKarte>

        <StatusKarte icon={Users} titel="Kader" to="/kader" laden={rosterQ.isPending}>
          <p className="font-display text-xl leading-tight tracking-wide">{spieler.length} Spieler</p>
          <p className="text-sm text-muted-foreground">
            {roster.filter((r) => r.aktiv && r.rolle && r.rolle !== 'spieler').length} im Trainerstab
            {ohneFoto ? ` · ${ohneFoto} ohne Foto` : ''}
          </p>
        </StatusKarte>

        <StatusKarte icon={ListOrdered} titel="Tabelle" to="/tabelle" laden={tabelleQ.isPending}>
          {svaZeile ? (
            <>
              <p className="font-display text-xl leading-tight tracking-wide">Platz {svaZeile.platz}</p>
              <p className="text-sm text-muted-foreground">
                {svaZeile.punkte} Punkte aus {svaZeile.spiele} Spielen
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">{tabelle.length ? 'SVA nicht markiert' : 'Noch leer'}</p>
          )}
          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Handshake className="h-3 w-3" /> {sponsoren.length} Sponsoren aktiv
          </p>
        </StatusKarte>
      </div>

      {/* 3. Checkliste */}
      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 font-display text-xl tracking-wide">Was noch fehlt</h2>
          {aufgaben.length === 0 ? (
            <p className="flex items-center gap-2 text-green-400">
              <CheckCircle2 className="h-5 w-5" /> Alles erledigt. Stark!
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {aufgaben.map((a) => (
                <li key={a.text}>
                  <Link to={a.to} className="flex min-h-[52px] items-center gap-3 py-2.5 hover:text-foreground">
                    {a.wichtig ? (
                      <AlertCircle className="h-5 w-5 shrink-0 text-primary" />
                    ) : (
                      <CircleDot className="h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                    <span className={cn('flex-1 text-sm', !a.wichtig && 'text-muted-foreground')}>{a.text}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function StatusKarte({
  icon: Icon,
  titel,
  to,
  laden,
  children,
}: {
  icon: typeof CalendarDays
  titel: string
  to: string
  laden?: boolean
  children: React.ReactNode
}) {
  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col p-4">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Icon className="h-4 w-4" /> {titel}
        </p>
        <div className="flex-1">{laden ? <Skeleton className="h-12 w-full" /> : children}</div>
        <Button asChild variant="ghost" size="sm" className="-mx-2 mt-2 w-fit text-muted-foreground">
          <Link to={to}>
            Bearbeiten <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
