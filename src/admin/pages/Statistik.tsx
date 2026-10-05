import { useState } from 'react'
import { BarChart3, Compass, Smartphone, Target, FileText, Link2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { PageHeader } from './Placeholder'
import { Card, CardContent } from '../components/ui/card'
import { Tabs } from '../components/ui/tabs'
import { SkeletonRows } from '../components/ui/skeleton'
import { PflegeHinweis } from '../components/PflegeHinweis'
import { friendlyError, isMissingSchema } from '../lib/db'
import { MEDIUM_LABEL, QUELLE_LABEL, SEITE_LABEL, ZIELE, useStatistik, type Statistik as StatistikDaten } from '../lib/statistik'
import { cn } from '../lib/utils'

// ─────────────────────────────────────────────────────────────
// v18-A: Statistik für Laien — „Wer kommt woher, und bringt es was?“
// Datengrundlage: anonyme Tageszählung (sva_statistik_tage), keine Cookies,
// keine Personen. Zeitraum 7/30 Tage, Vergleich mit dem Zeitraum davor.
// Handy zuerst: alles einspaltig, Balken statt Diagramm-Bibliothek.
// ─────────────────────────────────────────────────────────────

type Zeitraum = '7' | '30'
const fmt = (n: number) => n.toLocaleString('de-DE')

export function Statistik() {
  const [zeitraum, setZeitraum] = useState<Zeitraum>('30')
  const tage = Number(zeitraum)
  const q = useStatistik(tage)
  const schemaFehlt = q.error && isMissingSchema(q.error)

  return (
    <>
      <PageHeader
        title="Statistik"
        subtitle="Anonyme Zählung ohne Cookies: wie viele Besuche, woher sie kommen und was sie bringen."
        actions={
          <Tabs
            items={[
              { value: '7', label: '7 Tage' },
              { value: '30', label: '30 Tage' },
            ]}
            value={zeitraum}
            onChange={setZeitraum}
          />
        }
      />

      {schemaFehlt && (
        <PflegeHinweis schema className="mb-4">
          Für die Statistik muss Marvin einmalig die Migration <code>20261009100000_sva_statistik.sql</code> anwenden (Anleitung: docs/STATISTIK.md).
        </PflegeHinweis>
      )}
      {q.error && !schemaFehlt && (
        <PflegeHinweis className="mb-4" title="Konnte nicht laden">
          {friendlyError(q.error)}
        </PflegeHinweis>
      )}

      {q.isPending ? <SkeletonRows rows={6} /> : q.data ? <Inhalt s={q.data} /> : null}
    </>
  )
}

function Inhalt({ s }: { s: StatistikDaten }) {
  const leer = s.aufrufe === 0 && s.ereignisse.length === 0
  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <Gesamt s={s} />
      {leer ? (
        <PflegeHinweis title="Noch keine Besuche gezählt">
          Sobald die Website mit der Zählung online ist, erscheinen hier die Zahlen – meist schon am selben Tag.
        </PflegeHinweis>
      ) : (
        <>
          <Quellen s={s} />
          <Ziele s={s} />
          <div className="grid gap-4 md:grid-cols-2">
            <Seiten s={s} />
            <Geraete s={s} />
          </div>
        </>
      )}
      <KurzLinks s={s} />
    </div>
  )
}

function Abschnitt({ icon: Icon, titel, text, children }: { icon: typeof BarChart3; titel: string; text?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4 md:p-5">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg tracking-wide">
            <Icon className="h-5 w-5 text-muted-foreground" /> {titel}
          </h2>
          {text && <p className="mt-1 text-sm text-muted-foreground">{text}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

function Balken({ label, wert, max, unter, stark }: { label: string; wert: number; max: number; unter?: string; stark?: boolean }) {
  const pct = max > 0 ? Math.max(2, Math.round((wert / max) * 100)) : 0
  return (
    <li className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className={cn('min-w-0 truncate', stark ? 'font-semibold text-foreground' : 'text-foreground')}>{label}</span>
        <span className="shrink-0 tabular-nums font-semibold">{fmt(wert)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-sm bg-secondary" aria-hidden="true">
        <div className={cn('h-full rounded-sm', stark ? 'bg-primary' : 'bg-foreground/45')} style={{ width: `${pct}%` }} />
      </div>
      {unter && <p className="text-xs text-muted-foreground">{unter}</p>}
    </li>
  )
}

function Gesamt({ s }: { s: StatistikDaten }) {
  const diff = s.aufrufeVorher > 0 ? Math.round(((s.aufrufe - s.aufrufeVorher) / s.aufrufeVorher) * 100) : null
  const max = Math.max(1, ...s.proTag.map((d) => d.aufrufe))
  const schnitt = Math.round(s.aufrufe / Math.max(1, s.tage))
  const Trend = diff == null || diff === 0 ? Minus : diff > 0 ? TrendingUp : TrendingDown
  return (
    <Card>
      <CardContent className="space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Seitenaufrufe · letzte {s.tage} Tage</p>
            <p className="font-display text-5xl leading-none tracking-wide" data-testid="stat-aufrufe">
              {fmt(s.aufrufe)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">im Schnitt {fmt(schnitt)} pro Tag</p>
          </div>
          {diff != null && (
            <p className={cn('flex items-center gap-1 text-sm font-semibold', diff > 0 ? 'text-green-400' : diff < 0 ? 'text-primary' : 'text-muted-foreground')}>
              <Trend className="h-4 w-4" />
              {diff > 0 ? '+' : ''}
              {diff} % gegenüber den {s.tage} Tagen davor
            </p>
          )}
        </div>
        <div className="flex h-24 items-end gap-[2px]" role="img" aria-label={`Seitenaufrufe pro Tag, höchster Wert ${fmt(max)}`}>
          {s.proTag.map((d) => {
            const sonntag = new Date(d.tag + 'T12:00:00').getDay() === 0
            return (
              <div
                key={d.tag}
                title={`${new Date(d.tag + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}: ${fmt(d.aufrufe)}`}
                className={cn('min-w-0 flex-1 rounded-t-sm', sonntag ? 'bg-primary' : 'bg-foreground/35')}
                style={{ height: `${Math.max(2, (d.aufrufe / max) * 100)}%` }}
              />
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Rote Balken = Sonntage (meist Spieltag). Gezählt wird jeder Seitenaufruf einmal – ohne Cookies, darum können dieselben Leute an mehreren
          Tagen mehrfach zählen.
        </p>
      </CardContent>
    </Card>
  )
}

function Quellen({ s }: { s: StatistikDaten }) {
  // Instagram ist der Hauptkanal → immer vorn
  const liste = [...s.quellen].sort((a, b) => (a.quelle === 'instagram' ? -1 : b.quelle === 'instagram' ? 1 : b.aufrufe - a.aufrufe))
  const max = Math.max(1, ...liste.map((q) => q.aufrufe))
  const ig = s.quellen.find((q) => q.quelle === 'instagram')?.aufrufe ?? 0
  const igMedien = s.medien.filter((m) => m.quelle.startsWith('instagram:'))
  const anteil = s.aufrufe > 0 ? Math.round((ig / s.aufrufe) * 100) : 0
  return (
    <Abschnitt icon={Compass} titel="Woher kommen die Besucher?" text={`${anteil} % aller Aufrufe kommen über Instagram.`}>
      <ul className="space-y-3">
        {liste.map((q) => (
          <Balken
            key={q.quelle}
            label={QUELLE_LABEL[q.quelle] ?? q.quelle}
            wert={q.aufrufe}
            max={max}
            stark={q.quelle === 'instagram'}
            unter={
              q.quelle === 'instagram' && igMedien.length
                ? igMedien.map((m) => `${MEDIUM_LABEL[m.quelle.split(':')[1]] ?? m.quelle}: ${fmt(m.aufrufe)}`).join(' · ')
                : q.quelle === 'qr'
                  ? s.medien.filter((m) => m.quelle.startsWith('qr:')).map((m) => `${MEDIUM_LABEL[m.quelle.split(':')[1]] ?? m.quelle}: ${fmt(m.aufrufe)}`).join(' · ') || undefined
                  : undefined
            }
          />
        ))}
      </ul>
      {ig > 0 && igMedien.length === 0 && (
        <p className="text-xs text-muted-foreground">Tipp: Mit den Kurz-Links unten siehst du, ob Bio oder Story mehr bringt.</p>
      )}
    </Abschnitt>
  )
}

function Ziele({ s }: { s: StatistikDaten }) {
  const ev = new Map(s.ereignisse.map((e) => [e.name, e]))
  return (
    <Abschnitt icon={Target} titel="Was bringt die Website?" text="Gezählt, wenn jemand auf der Seite etwas tut, das dem Verein hilft.">
      <div className="grid gap-3 md:grid-cols-2">
        {ZIELE.map((z) => {
          const summe = z.ereignisse.reduce((a, e) => a + (ev.get(e.name)?.anzahl ?? 0), 0)
          return (
            <div key={z.ziel} className="rounded-lg border border-border p-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">{z.ziel}</h3>
                <span className="font-display text-2xl tabular-nums">{fmt(summe)}</span>
              </div>
              <p className="mb-2 text-xs text-muted-foreground">{z.text}</p>
              <ul className="divide-y divide-border text-sm">
                {z.ereignisse.map((e) => {
                  const x = ev.get(e.name)
                  return (
                    <li key={e.name} className="flex items-baseline justify-between gap-2 py-1.5">
                      <span className="min-w-0 text-muted-foreground">{e.label}</span>
                      <span className="shrink-0 tabular-nums">
                        <b className="text-foreground">{fmt(x?.anzahl ?? 0)}</b>
                        {x?.vonInstagram ? <span className="ml-1 text-xs text-muted-foreground">({fmt(x.vonInstagram)} via Instagram)</span> : null}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    </Abschnitt>
  )
}

function Seiten({ s }: { s: StatistikDaten }) {
  const max = Math.max(1, ...s.seiten.map((x) => x.aufrufe))
  return (
    <Abschnitt icon={FileText} titel="Meistbesuchte Seiten">
      <ul className="space-y-3">
        {s.seiten.map((x, i) => (
          <Balken key={x.pfad} label={SEITE_LABEL[x.pfad] ?? x.pfad} wert={x.aufrufe} max={max} stark={i === 0} />
        ))}
      </ul>
    </Abschnitt>
  )
}

function Geraete({ s }: { s: StatistikDaten }) {
  const mobil = s.geraete.find((g) => g.geraet === 'mobil')?.aufrufe ?? 0
  const pc = s.geraete.find((g) => g.geraet === 'desktop')?.aufrufe ?? 0
  const pct = mobil + pc > 0 ? Math.round((mobil / (mobil + pc)) * 100) : 0
  return (
    <Abschnitt icon={Smartphone} titel="Handy oder Computer?">
      <p className="font-display text-4xl leading-none">{pct} %</p>
      <p className="text-sm text-muted-foreground">
        der Aufrufe kommen vom Handy ({fmt(mobil)} Handy · {fmt(pc)} Computer).
      </p>
      <div className="flex h-3 overflow-hidden rounded-sm bg-secondary" aria-hidden="true">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </Abschnitt>
  )
}

function KurzLinks({ s }: { s: StatistikDaten }) {
  return (
    <Abschnitt icon={Link2} titel="Kurz-Links für Instagram & Plakate" text="Damit die Statistik weiß, woher jemand kommt. Einfach so verwenden:">
      <ul className="divide-y divide-border text-sm">
        {[
          ['aga-erste.de/ig', 'Instagram-Profil → Link in der Bio'],
          ['aga-erste.de/story', 'Instagram-Story → Link-Sticker'],
          ['aga-erste.de/qr', 'QR-Code auf Plakaten am Platz'],
          ['aga-erste.de/wa', 'WhatsApp-Gruppen und Status'],
        ].map(([link, wo]) => (
          <li key={link} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
            <code className="font-semibold text-foreground">{link}</code>
            <span className="text-muted-foreground">{wo}</span>
          </li>
        ))}
      </ul>
      {s.tage === 30 && s.aufrufe > 0 && (
        <p className="text-xs text-muted-foreground">
          Für die Partner-Mediadaten: <b className="text-foreground">{fmt(s.aufrufe)}</b> Seitenaufrufe in 30 Tagen – unter Partner → Zahlen als „Website-Besuche pro
          Monat“ eintragen.
        </p>
      )}
    </Abschnitt>
  )
}
