import { useMemo, useState } from 'react'
import { Plus, UserPlus, Users, ChevronUp, ChevronDown, List, LayoutGrid, Eye, EyeOff } from 'lucide-react'
import { PageHeader } from './Placeholder'
import { Button } from '../components/ui/button'
import { SkeletonRows } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { ErrorState } from '../components/ui/error-state'
import { Tabs } from '../components/ui/tabs'
import { useToast } from '../components/ui/toast'
import { PflegeHinweis } from '../components/PflegeHinweis'
import { SpielerKarte } from '../components/SpielerKarte'
import { KaderEditor, type KaderSpeichern } from '../components/KaderEditor'
import { FupaFehlende } from '../components/FupaFehlende'
import type { RosterRow } from '../lib/db'
import { friendlyError, isMissingSchema } from '../lib/db'
import { useLineup, useRoster, useRosterMutations } from '../lib/queries'
import { POSITION_CODES, positionCode, rolleLabel, slugFromName } from '../lib/pflege'
import { cn } from '../lib/utils'
import { WALKOUT } from '../../data/walkout'

// ─────────────────────────────────────────────────────────────
// v14-C: Kader — Spieler & Trainerstab, so wie sie auf der Website stehen.
// Gruppiert nach Position, Reihenfolge per Pfeil, Tippen öffnet den Editor.
// ─────────────────────────────────────────────────────────────

type Ansicht = 'liste' | 'karten'
interface Gruppe {
  key: string
  titel: string
  rows: RosterRow[]
}

const istSpieler = (r: RosterRow) => (r.rolle ?? 'spieler') === 'spieler'
const sortiere = (a: RosterRow, b: RosterRow) =>
  a.sortierung - b.sortierung || (a.nummer ?? 999) - (b.nummer ?? 999) || a.name.localeCompare(b.name)

export function Kader() {
  const toast = useToast()
  const rosterQ = useRoster()
  const lineupQ = useLineup()
  const { create, update, remove } = useRosterMutations()
  const [ansicht, setAnsicht] = useState<Ansicht>('liste')
  const [zeigeInaktive, setZeigeInaktive] = useState(false)
  const [editor, setEditor] = useState<{ open: boolean; row: RosterRow | null; neuAls: 'spieler' | 'stab' }>({
    open: false,
    row: null,
    neuAls: 'spieler',
  })

  const roster = useMemo(() => rosterQ.data ?? [], [rosterQ.data])
  // Vor der Migration fehlen die neuen Spalten → freundlicher Hinweis.
  const altesSchema = roster.length > 0 && roster[0].slug === undefined

  const gruppen: Gruppe[] = useMemo(() => {
    const aktiv = roster.filter((r) => r.aktiv)
    const g: Gruppe[] = POSITION_CODES.map((p) => ({
      key: p.value,
      titel: p.label,
      rows: aktiv.filter((r) => istSpieler(r) && positionCode(r.position) === p.value).sort(sortiere),
    }))
    g.push({ key: 'stab', titel: 'Trainerstab', rows: aktiv.filter((r) => !istSpieler(r)).sort(sortiere) })
    if (zeigeInaktive) g.push({ key: 'inaktiv', titel: 'Inaktiv (nicht auf der Website)', rows: roster.filter((r) => !r.aktiv).sort(sortiere) })
    return g
  }, [roster, zeigeInaktive])

  const anzahlSpieler = roster.filter((r) => r.aktiv && istSpieler(r)).length
  const anzahlInaktiv = roster.filter((r) => !r.aktiv).length
  const inAufstellung = (id: string) => !!lineupQ.data && (lineupQ.data.startelf.includes(id) || lineupQ.data.bank.includes(id))

  const speichern = async ({ input, id }: KaderSpeichern) => {
    if (id) {
      await update.mutateAsync({ id, patch: input })
    } else {
      // Stabile, lesbare öffentliche ID aus dem Namen (eindeutig machen).
      const basis = slugFromName(input.name ?? '', input.rolle === 'spieler' ? 'p' : 's')
      const vergeben = new Set(roster.map((r) => r.slug))
      let slug = basis
      for (let i = 2; vergeben.has(slug); i++) slug = `${basis}-${i}`
      const maxSort = Math.max(0, ...roster.map((r) => r.sortierung))
      await create.mutateAsync({ ...input, slug, sortierung: maxSort + 10 })
    }
    // Nur EIN Kapitän: den bisherigen ablösen.
    if (input.kapitaen) {
      const alte = roster.filter((r) => r.kapitaen && r.id !== id && r.name !== input.name)
      for (const r of alte) await update.mutateAsync({ id: r.id, patch: { kapitaen: false } })
    }
    toast.success(`${input.name} gespeichert. Erscheint nach „Website veröffentlichen“.`)
  }

  const loeschen = async (id: string) => {
    await remove.mutateAsync(id)
    toast.success('Gelöscht.')
  }

  // Reihenfolge innerhalb der Gruppe: Plätze tauschen, Gruppe sauber durchnummerieren.
  const verschieben = async (gruppe: Gruppe, index: number, richtung: -1 | 1) => {
    const ziel = index + richtung
    if (ziel < 0 || ziel >= gruppe.rows.length) return
    const neu = [...gruppe.rows]
    ;[neu[index], neu[ziel]] = [neu[ziel], neu[index]]
    const basis = Math.min(...gruppe.rows.map((r) => r.sortierung))
    try {
      for (let i = 0; i < neu.length; i++) {
        const soll = basis + i * 10
        if (neu[i].sortierung !== soll) await update.mutateAsync({ id: neu[i].id, patch: { sortierung: soll } })
      }
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  const neu = (als: 'spieler' | 'stab') => setEditor({ open: true, row: null, neuAls: als })
  const bearbeiten = (row: RosterRow) => setEditor({ open: true, row, neuAls: istSpieler(row) ? 'spieler' : 'stab' })

  return (
    <>
      <PageHeader
        title="Kader"
        subtitle={`${anzahlSpieler} Spieler aktiv — so erscheinen sie auf der Website.`}
        actions={
          <div className="flex w-full gap-2 sm:w-auto">
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => neu('stab')}>
              <UserPlus className="h-4 w-4" /> Trainerstab
            </Button>
            <Button className="flex-1 sm:flex-none" onClick={() => neu('spieler')}>
              <Plus className="h-4 w-4" /> Spieler
            </Button>
          </div>
        }
      />

      {(altesSchema || (rosterQ.error && isMissingSchema(rosterQ.error))) && <PflegeHinweis schema className="mb-4" />}

      {/* v23-U: FuPa-Kaderspieler ohne Website-Eintrag */}
      <FupaFehlende />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Tabs
          value={ansicht}
          onChange={setAnsicht}
          items={[
            { value: 'liste', label: 'Liste', icon: List },
            { value: 'karten', label: 'Karten', icon: LayoutGrid },
          ]}
        />
        {anzahlInaktiv > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setZeigeInaktive((v) => !v)}>
            {zeigeInaktive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {zeigeInaktive ? 'Inaktive ausblenden' : `${anzahlInaktiv} inaktive zeigen`}
          </Button>
        )}
      </div>

      {rosterQ.error && !rosterQ.isPending && !isMissingSchema(rosterQ.error) && (
        <ErrorState className="mb-4" message={friendlyError(rosterQ.error)} onRetry={() => void rosterQ.refetch()} />
      )}

      {rosterQ.isPending ? (
        <SkeletonRows rows={6} />
      ) : roster.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Noch niemand im Kader"
          description="Leg die Spieler mit Name, Position und Foto an — sie erscheinen als Karten auf der Website."
          action={
            <Button onClick={() => neu('spieler')}>
              <Plus className="h-4 w-4" /> Ersten Spieler anlegen
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {gruppen
            .filter((g) => g.rows.length > 0)
            .map((g) => (
              <section key={g.key}>
                <h2 className="mb-2 flex items-baseline gap-2 font-display text-lg tracking-wide">
                  {g.titel} <span className="font-body text-sm text-muted-foreground">{g.rows.length}</span>
                </h2>
                {ansicht === 'karten' ? (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                    {g.rows.map((r) => (
                      <button key={r.id} type="button" onClick={() => bearbeiten(r)} className="text-left" aria-label={`${r.name} bearbeiten`}>
                        <SpielerKarte
                          p={{
                            name: r.name,
                            number: istSpieler(r) ? r.nummer : null,
                            position: istSpieler(r) ? positionCode(r.position) : rolleLabel(r.rolle).toUpperCase(),
                            photoUrl: r.foto_url,
                            cutoutUrl: r.freisteller_url,
                            isCaptain: r.kapitaen,
                            isNewSigning: r.neuzugang,
                            inactive: !r.aktiv,
                          }}
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                    {g.rows.map((r, i) => (
                      <li key={r.id} className={cn('flex items-center gap-1', !r.aktiv && 'opacity-60')}>
                        <button
                          type="button"
                          onClick={() => bearbeiten(r)}
                          className="flex min-h-[64px] min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left hover:bg-accent/40"
                        >
                          <Avatar row={r} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate font-medium">{r.name}</span>
                              {r.kapitaen && <Badge gold>C</Badge>}
                              {r.neuzugang && <Badge>Neu</Badge>}
                              {WALKOUT[r.slug] && <span className="text-xs font-medium text-emerald-500" title="Freigestelltes Walkout-Video vorhanden (Karte + 3D-Aufstellung)">Walkout vorhanden ✓</span>}
                            </span>
                            <span className="block text-sm text-muted-foreground">
                              {istSpieler(r)
                                ? `${r.nummer != null ? `#${r.nummer} · ` : ''}${POSITION_CODES.find((p) => p.value === positionCode(r.position))?.label}`
                                : rolleLabel(r.rolle)}
                              {!r.foto_url && ' · ohne Foto'}
                            </span>
                          </span>
                        </button>
                        {g.key !== 'inaktiv' && g.rows.length > 1 && (
                          <span className="flex flex-col pr-1">
                            <Button variant="ghost" size="icon" className="h-8 w-10" disabled={i === 0} onClick={() => void verschieben(g, i, -1)} aria-label={`${r.name} nach oben`}>
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-10" disabled={i === g.rows.length - 1} onClick={() => void verschieben(g, i, 1)} aria-label={`${r.name} nach unten`}>
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
        </div>
      )}

      <KaderEditor
        open={editor.open}
        onClose={() => setEditor((e) => ({ ...e, open: false }))}
        row={editor.row}
        neuAls={editor.neuAls}
        alle={roster}
        inAufstellung={editor.row ? inAufstellung(editor.row.id) : false}
        onSave={speichern}
        onDelete={loeschen}
      />
    </>
  )
}

function Avatar({ row }: { row: RosterRow }) {
  const src = row.foto_url
  if (src) {
    return <img src={src} alt="" loading="lazy" className="h-14 w-10 shrink-0 rounded-md border border-border bg-muted object-cover object-top" />
  }
  return (
    <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted font-display text-lg text-primary">
      {row.nummer ?? row.name.slice(0, 1).toUpperCase()}
    </span>
  )
}

function Badge({ children, gold }: { children: React.ReactNode; gold?: boolean }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
        gold ? 'bg-sva-gold text-black' : 'bg-primary/20 text-primary',
      )}
    >
      {children}
    </span>
  )
}
