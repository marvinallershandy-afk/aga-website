import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, Loader2, Sparkles, Ticket } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { useToast } from '../../components/ui/toast'
import { friendlyError } from '../../lib/db'
import { useRoster, useSpiele, useSponsoren } from '../../lib/queries'
import { useAlbumStatistik, useKarten } from '../../lib/album'
import { adminKartenDaten, useCodeMutations, useKartenCodes, useMotm } from '../../lib/albumV20'
import { reelHerunterladen, storyHerunterladen } from './exportHelfer'

// ─────────────────────────────────────────────────────────────
// v20-K: Wochen-Checkliste (der wöchentliche Ablauf in 2 Minuten):
//   Mo  MOTM-Karte veröffentlichen (1 Klick: limitierte Spezialkarte aus
//       dem eingetragenen „Spieler des Spiels“, ziehbar Mo–So, dazu Story-
//       Bild + Reel zum Posten)
//   Fr  Story-Code der Woche erzeugen (24 h, 1 Karte)
//   Sa  Erinnerung „Noch nicht getippt?“ / Album-Teaser in die Story
//   So  Spielbericht (Ergebnis, Torschützen, MOTM) eintragen
// Erledigt-Haken: automatisch aus den Daten, sonst von Hand (pro Woche
// im Browser gemerkt).
// ─────────────────────────────────────────────────────────────

function wochenStart(d = new Date()) {
  const x = new Date(d)
  const tag = (x.getDay() + 6) % 7
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - tag)
  return x
}
const iso = (d: Date) => d.toISOString().slice(0, 10)

export function WocheTab() {
  const toast = useToast()
  const spiele = useSpiele()
  const roster = useRoster()
  const sponsoren = useSponsoren()
  const karten = useKarten()
  const codes = useKartenCodes()
  const stat = useAlbumStatistik()
  const motm = useMotm()
  const { massen } = useCodeMutations()
  const [laeuft, setLaeuft] = useState('')
  const [jetzt] = useState(() => Date.now())
  const mo = useMemo(() => wochenStart(new Date(jetzt)), [jetzt])
  const so = new Date(mo.getTime() + 7 * 864e5 - 1)
  const fr = new Date(mo.getTime() + 4 * 864e5)
  const key = `sva-album-woche-${iso(mo)}`
  const [hand, setHand] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || '{}')
    } catch {
      return {}
    }
  })
  const haken = (id: string) =>
    setHand((h) => {
      const n = { ...h, [id]: !h[id] }
      try {
        localStorage.setItem(key, JSON.stringify(n))
      } catch {
        /* egal */
      }
      return n
    })

  // letztes Spiel mit Ergebnis (bis 9 Tage zurück)
  const letztes = (spiele.data ?? [])
    .filter((s) => s.tore_sva != null && new Date(s.anstoss).getTime() > jetzt - 9 * 864e5 && new Date(s.anstoss).getTime() < jetzt)
    .sort((a, b) => b.anstoss.localeCompare(a.anstoss))[0]
  const motmSpieler = letztes?.motm_roster_id ? (roster.data ?? []).find((r) => r.id === letztes.motm_roster_id) : undefined
  const motmKarte = letztes ? (karten.data ?? []).find((k) => k.motm_spiel_id === letztes.id) : undefined
  const storyCode = (codes.data ?? []).find((c) => c.art === 'story' && new Date(c.gueltig_von) >= mo && new Date(c.gueltig_von) <= so)
  const heute = (spiele.data ?? []).find((s) => Math.abs(new Date(s.anstoss).getTime() - jetzt) < 36 * 3600e3)

  const motmVeroeffentlichen = async () => {
    if (!letztes || !motmSpieler) return
    setLaeuft('motm')
    try {
      const r = await motm.mutateAsync({ roster: motmSpieler.id, spiel: letztes.id })
      const k = (await karten.refetch()).data?.find((x) => x.id === r.id)
      if (k) {
        const d = adminKartenDaten(k, roster.data ?? [], sponsoren.data ?? [], { saison: stat.data?.saison })
        await storyHerunterladen(d)
        await reelHerunterladen(d, undefined, 'Spieler des Spiels')
      }
      toast.success(`MOTM-Karte ${motmSpieler.name} ist live (ziehbar bis ${new Date(r.ziehbarBis).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}). Story-Bild und Reel sind im Download-Ordner.`)
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setLaeuft('')
    }
  }

  const punkte: { id: string; tag: string; titel: string; erledigt: boolean; auto: boolean; text: React.ReactNode; aktion?: React.ReactNode }[] = [
    {
      id: 'mo',
      tag: 'Mo',
      titel: 'MOTM-Karte veröffentlichen',
      erledigt: !!motmKarte,
      auto: true,
      text: !letztes ? (
        'Kein Spiel mit Ergebnis in den letzten Tagen.'
      ) : !motmSpieler ? (
        <>
          Für SVA – {letztes.gegner} ist noch kein „Spieler des Spiels“ eingetragen. <Link to="/spiele" className="underline">Unter Spiele eintragen</Link>.
        </>
      ) : motmKarte ? (
        `${motmSpieler.name} · limitierte Spezialkarte ist live (Mo–So ziehbar).`
      ) : (
        `${motmSpieler.name} (SVA – ${letztes.gegner}) — 1 Klick: Karte, Story-Bild und Reel.`
      ),
      aktion:
        letztes && motmSpieler && !motmKarte ? (
          <Button size="sm" onClick={() => void motmVeroeffentlichen()} disabled={laeuft === 'motm'}>
            {laeuft === 'motm' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} MOTM-Karte veröffentlichen
          </Button>
        ) : undefined,
    },
    {
      id: 'fr',
      tag: 'Fr',
      titel: 'Story-Code der Woche',
      erledigt: !!storyCode,
      auto: true,
      text: storyCode ? `Code ${storyCode.code} (${new Date(storyCode.gueltig_von).toLocaleDateString('de-DE', { weekday: 'long' })}) — in die Story damit.` : 'Ein Code für Freitag: 24 h gültig, 1 Karte, 1× pro Konto.',
      aktion: !storyCode ? (
        <Button
          size="sm"
          variant="outline"
          disabled={massen.isPending}
          onClick={async () => {
            try {
              const r = await massen.mutateAsync({ start: iso(fr), tage: 1, titel: 'Story-Code der Woche' })
              void navigator.clipboard?.writeText(r[0]?.code ?? '')
              toast.success(`Story-Code ${r[0]?.code} für Freitag erzeugt und kopiert.`)
            } catch (e) {
              toast.error(friendlyError(e))
            }
          }}
        >
          <Ticket className="h-4 w-4" /> Code für Freitag erzeugen
        </Button>
      ) : undefined,
    },
    { id: 'sa', tag: 'Sa', titel: 'Erinnerung in die Story', erledigt: !!hand.sa, auto: false, text: '„Noch nicht getippt?“ + Album-Teaser („Diese Karte gibt’s nur Sonntag am Platz“).' },
    {
      id: 'so',
      tag: 'So',
      titel: 'Spielbericht eintragen',
      erledigt: heute ? heute.tore_sva != null : !!hand.so,
      auto: !!heute,
      text: heute ? `SVA – ${heute.gegner}: Ergebnis, Torschützen und MOTM unter Spiele bzw. im Live-Ticker.` : 'Ergebnis, Torschützen, MOTM — daraus entstehen Heimsieg-Bonus und MOTM-Karte.',
      aktion: (
        <Link to="/spiele" className="text-sm underline">
          Zu den Spielen
        </Link>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Woche vom {mo.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })} — der Ablauf in 2 Minuten. Haken setzen sich von selbst, sobald es erledigt ist.
      </p>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {punkte.map((p) => {
          const ok = p.erledigt || !!hand[p.id]
          return (
            <li key={p.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
              <button type="button" onClick={() => !p.auto && haken(p.id)} className="mt-0.5" aria-label={ok ? 'Erledigt' : 'Offen'} disabled={p.auto}>
                {ok ? <CheckCircle2 className="h-6 w-6 text-emerald-500" /> : <Circle className="h-6 w-6 text-muted-foreground" />}
              </button>
              <span className="w-8 font-display text-lg">{p.tag}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.titel}</p>
                <p className="text-sm text-muted-foreground">{p.text}</p>
              </div>
              {p.aktion}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
