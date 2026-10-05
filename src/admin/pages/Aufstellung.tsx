import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Save, RotateCcw, Eraser, Plus, X, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { PageHeader } from './Placeholder'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Modal } from '../components/ui/modal'
import { SkeletonRows } from '../components/ui/skeleton'
import { useToast } from '../components/ui/toast'
import { useConfirm } from '../components/ui/confirm'
import { PflegeHinweis } from '../components/PflegeHinweis'
import { PublishButton } from '../components/PublishButton'
import { FORMATION_SLOTS, type Formation, type Slot } from '../../data/lineup'
import type { RosterRow, SpielRow } from '../lib/db'
import { friendlyError, isMissingSchema } from '../lib/db'
import { useLineup, useRoster, useSaveLineup, useSpiele } from '../lib/queries'
import { POSITION_CODES, positionCode } from '../lib/pflege'
import { formatAnstoss, relativZeit } from '../lib/format'
import { hatErgebnis, matchLabelFor, naechstesSpiel, paarung } from '../lib/spiele'
import { cn } from '../lib/utils'
import { useAuth } from '../auth/AuthProvider'

// ─────────────────────────────────────────────────────────────
// v14-C: Aufstellung — Formation, Startelf (11 Slots) und Bank.
// Gespeichert wird EXAKT die Form aus src/data/lineup.ts (Slot-Reihenfolge =
// FORMATION_SLOTS[formation]); die Website zeigt sie nach dem Veröffentlichen.
//
// Bedienung:
//   • Handy: Slot antippen → Spieler aus der Liste wählen. Fertig.
//   • Ziehen & Ablegen (Maus und Finger): Spieler aus „Verfügbar“ auf einen
//     Slot / die Bank ziehen, zwischen Slots tauschen, zurück in die Liste.
//     Am Touchscreen startet das Ziehen nach kurzem Halten — normales
//     Tippen und Scrollen bleibt so ungestört.
// Prüfregeln: genau 11, niemand doppelt (auch nicht Startelf + Bank).
// ─────────────────────────────────────────────────────────────

const FORMATIONS: Formation[] = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2']
const ROLE_LABEL: Record<Slot['role'], string> = { TW: 'Torwart', ABW: 'Abwehr', MIT: 'Mittelfeld', ANG: 'Angriff' }
const leer = (): (string | null)[] => Array.from({ length: 11 }, () => null)

interface Stand {
  formation: Formation
  slots: (string | null)[]
  bank: string[]
  spielId: string | null
}

type Ziel = { art: 'slot'; index: number } | { art: 'bank' }

const nachname = (name: string) => name.trim().split(/\s+/).slice(-1)[0] ?? name

export function Aufstellung() {
  const toast = useToast()
  const istAdmin = useAuth().rolle !== 'team'
  const confirm = useConfirm()
  const rosterQ = useRoster()
  const spieleQ = useSpiele()
  const lineupQ = useLineup()
  const save = useSaveLineup()

  const spieler = useMemo(
    () =>
      (rosterQ.data ?? [])
        .filter((r) => r.aktiv && (r.rolle ?? 'spieler') === 'spieler')
        .sort((a, b) => a.sortierung - b.sortierung || (a.nummer ?? 999) - (b.nummer ?? 999)),
    [rosterQ.data],
  )
  const byId = useMemo(() => new Map(spieler.map((s) => [s.id, s])), [spieler])

  const [stand, setStand] = useState<Stand>({ formation: '4-4-2', slots: leer(), bank: [], spielId: null })
  const [gespeichert, setGespeichert] = useState<Stand | null>(null)
  const [entfernt, setEntfernt] = useState<number>(0)
  const [picker, setPicker] = useState<Ziel | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [frischGespeichert, setFrischGespeichert] = useState(false)

  // Gespeicherten Stand übernehmen (inaktive/gelöschte Spieler fallen raus).
  // Nur einmal je gespeicherter Aufstellung — ein Hintergrund-Refetch (z. B.
  // beim Zurückwechseln in den Tab) darf ungespeicherte Änderungen nicht
  // überschreiben.
  const initFuer = useRef<string | null>(null)
  useEffect(() => {
    if (lineupQ.isPending || rosterQ.isPending || spieleQ.isPending) return
    const l = lineupQ.data
    const key = l?.id ?? 'keine'
    if (initFuer.current === key) return
    initFuer.current = key
    if (!l) {
      const s: Stand = { formation: '4-4-2', slots: leer(), bank: [], spielId: naechstesSpiel(spieleQ.data ?? [])?.id ?? null }
      setStand(s)
      setGespeichert(null)
      return
    }
    const formation = (FORMATIONS.includes(l.formation as Formation) ? l.formation : '4-4-2') as Formation
    const slots = leer().map((_, i) => (l.startelf[i] && byId.has(l.startelf[i]) ? l.startelf[i] : null))
    const bank = l.bank.filter((id) => byId.has(id) && !slots.includes(id))
    setEntfernt(l.startelf.filter((id) => !byId.has(id)).length + l.bank.filter((id) => !byId.has(id)).length)
    const s: Stand = { formation, slots, bank, spielId: l.spiel_id }
    setStand(s)
    setGespeichert(s)
  }, [lineupQ.isPending, lineupQ.data, rosterQ.isPending, spieleQ.isPending, byId, spieleQ.data])

  const besetzt = stand.slots.filter(Boolean).length
  const dirty = JSON.stringify(stand) !== JSON.stringify(gespeichert)
  const imSpiel = new Set<string>([...stand.slots.filter((x): x is string => !!x), ...stand.bank])
  const verfuegbar = spieler.filter((s) => !imSpiel.has(s.id))
  const formationSlots = FORMATION_SLOTS[stand.formation]

  const warnungen: string[] = []
  const twSlot = stand.slots[0] ? byId.get(stand.slots[0]) : null
  if (twSlot && positionCode(twSlot.position) !== 'TW') warnungen.push(`Im Tor steht ${twSlot.name} (kein Torwart).`)
  if (besetzt === 11 && !stand.slots.some((id) => id && byId.get(id)?.kapitaen)) warnungen.push('Der Kapitän steht nicht in der Startelf.')

  // ── Zuweisen / Verschieben (gemeinsam für Tippen und Ziehen) ──────────────
  const platzieren = (id: string, ziel: Ziel | { art: 'pool' }) => {
    setFrischGespeichert(false)
    setStand((alt) => {
      const slots = [...alt.slots]
      let bank = [...alt.bank]
      const vonSlot = slots.indexOf(id)
      const vonBank = bank.indexOf(id)
      if (ziel.art === 'slot') {
        const bisher = slots[ziel.index]
        if (vonSlot === ziel.index) return alt
        slots[ziel.index] = id
        if (vonSlot >= 0) slots[vonSlot] = bisher // Tausch zweier Slots
        else if (vonBank >= 0) {
          bank.splice(vonBank, 1)
          if (bisher) bank.splice(vonBank, 0, bisher) // Bisheriger geht auf die Bank
        }
        // aus dem Pool: Bisheriger wird automatisch wieder „verfügbar“
      } else if (ziel.art === 'bank') {
        if (vonBank >= 0) return alt
        if (vonSlot >= 0) slots[vonSlot] = null
        bank = [...bank, id]
      } else {
        if (vonSlot >= 0) slots[vonSlot] = null
        if (vonBank >= 0) bank.splice(vonBank, 1)
      }
      return { ...alt, slots, bank }
    })
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  )
  const onDragStart = (e: DragStartEvent) => setDragId(String(e.active.data.current?.id ?? ''))
  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null)
    const id = e.active.data.current?.id as string | undefined
    const over = e.over?.id ? String(e.over.id) : null
    if (!id || !over) return
    if (over === 'bank') platzieren(id, { art: 'bank' })
    else if (over === 'pool') platzieren(id, { art: 'pool' })
    else if (over.startsWith('slot-')) platzieren(id, { art: 'slot', index: Number(over.slice(5)) })
  }

  const speichern = async () => {
    if (besetzt !== 11) return
    const spiel = (spieleQ.data ?? []).find((s) => s.id === stand.spielId) ?? null
    try {
      await save.mutateAsync({
        formation: stand.formation,
        startelf: stand.slots as string[],
        bank: stand.bank,
        spiel_id: spiel?.id ?? null,
        match_label: spiel ? matchLabelFor(spiel) : null,
      })
      setFrischGespeichert(true)
      toast.success('Aufstellung gespeichert.')
    } catch (e) {
      toast.error(friendlyError(e, 'Speichern fehlgeschlagen.'))
    }
  }

  const leeren = async () => {
    const ok = await confirm({ title: 'Alles leeren?', description: 'Startelf und Bank werden geleert (noch nicht gespeichert).', confirmLabel: 'Leeren' })
    if (ok) setStand((s) => ({ ...s, slots: leer(), bank: [] }))
  }

  const spielOptionen = useMemo(() => {
    const now = Date.now()
    return (spieleQ.data ?? [])
      .filter((s) => !hatErgebnis(s) || now - new Date(s.anstoss).getTime() < 7 * 864e5)
      .sort((a, b) => +new Date(a.anstoss) - +new Date(b.anstoss))
  }, [spieleQ.data])

  const schemaFehlt = lineupQ.error && isMissingSchema(lineupQ.error)
  const laden = rosterQ.isPending || lineupQ.isPending
  const dragSpieler = dragId ? byId.get(dragId) ?? null : null

  return (
    <>
      <PageHeader
        title="Aufstellung"
        subtitle={
          lineupQ.data
            ? `Gespeichert ${relativZeit(lineupQ.data.created_at)}${lineupQ.data.match_label ? ` · ${lineupQ.data.match_label}` : ''}`
            : 'Startelf und Bank für die Website.'
        }
      />

      {schemaFehlt && <PflegeHinweis schema className="mb-4" />}
      {entfernt > 0 && (
        <PflegeHinweis title="Aufstellung angepasst" className="mb-4">
          {entfernt === 1 ? 'Ein Spieler' : `${entfernt} Spieler`} aus der gespeicherten Aufstellung {entfernt === 1 ? 'ist' : 'sind'} nicht
          mehr aktiv und wurde{entfernt === 1 ? '' : 'n'} entfernt. Bitte Lücken füllen und speichern.
        </PflegeHinweis>
      )}

      {laden ? (
        <SkeletonRows rows={6} />
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDragId(null)}
          // Auto-Scroll erst ganz am Rand (12 %), sonst rutscht die Seite am Handy unterm Finger weg
          autoScroll={{ threshold: { x: 0, y: 0.12 } }}
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            {/* ── Links: Formation + Spielfeld + Speichern ─────────────── */}
            <div className="space-y-3">
              <div role="radiogroup" aria-label="Formation" className="grid grid-cols-4 gap-2">
                {FORMATIONS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={stand.formation === f}
                    onClick={() => setStand((s) => ({ ...s, formation: f }))}
                    className={cn(
                      'min-h-[48px] rounded-lg border font-display text-lg tracking-wide transition-colors',
                      stand.formation === f ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <Spielfeld>
                {formationSlots.map((slot, i) => (
                  <SlotPunkt
                    key={i}
                    index={i}
                    slot={slot}
                    spieler={stand.slots[i] ? byId.get(stand.slots[i]!) ?? null : null}
                    onTap={() => setPicker({ art: 'slot', index: i })}
                    onLeeren={() => stand.slots[i] && platzieren(stand.slots[i]!, { art: 'pool' })}
                  />
                ))}
              </Spielfeld>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold tabular-nums',
                    besetzt === 11 ? 'bg-green-600/20 text-green-400' : 'bg-secondary text-muted-foreground',
                  )}
                >
                  {besetzt === 11 ? <CheckCircle2 className="h-4 w-4" /> : null}
                  {besetzt}/11 aufgestellt
                </span>
                <span className="text-sm text-muted-foreground">{stand.bank.length} auf der Bank</span>
                <span className="flex-1" />
                {dirty && gespeichert && (
                  <Button variant="ghost" size="sm" onClick={() => setStand(gespeichert)}>
                    <RotateCcw className="h-4 w-4" /> Zurück
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => void leeren()}>
                  <Eraser className="h-4 w-4" /> Leeren
                </Button>
              </div>

              {warnungen.map((w) => (
                <p key={w} className="flex items-center gap-2 text-sm text-sva-gold">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {w}
                </p>
              ))}

              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="a-spiel">Für welches Spiel?</Label>
                    <Select
                      id="a-spiel"
                      className="h-12 text-base"
                      value={stand.spielId ?? ''}
                      onChange={(e) => setStand((s) => ({ ...s, spielId: e.target.value || null }))}
                    >
                      <option value="">Ohne Spiel („Unsere Elf“)</option>
                      {spielOptionen.map((s: SpielRow) => (
                        <option key={s.id} value={s.id}>
                          {paarung(s)} · {formatAnstoss(s.anstoss)}
                        </option>
                      ))}
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Mit Spiel zeigt die Website „Aufstellung gegen …“, ohne Spiel nur „Unsere Elf“.
                    </p>
                  </div>
                  <Button className="h-12 w-full text-base" disabled={besetzt !== 11 || save.isPending || (!dirty && !!gespeichert)} onClick={() => void speichern()}>
                    {save.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                    {besetzt !== 11 ? `Noch ${11 - besetzt} Spieler aufstellen` : !dirty && gespeichert ? 'Gespeichert' : 'Aufstellung speichern'}
                  </Button>
                  {frischGespeichert && istAdmin && (
                    <div className="space-y-2 rounded-lg border border-green-600/40 bg-green-950/30 p-3">
                      <p className="text-sm">Gespeichert. Auf /live sofort sichtbar — für den Onepager jetzt die Website veröffentlichen:</p>
                      <PublishButton size="compact" />
                    </div>
                  )}
                  {frischGespeichert && !istAdmin && (
                    <p className="rounded-lg border border-green-600/40 bg-green-950/30 p-3 text-sm">Gespeichert — auf der Live-Seite sofort sichtbar.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── Rechts: Bank + verfügbare Spieler ───────────────────── */}
            <div className="space-y-4">
              <BankZone>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-display text-lg tracking-wide">Bank</h2>
                  <Button variant="outline" size="sm" onClick={() => setPicker({ art: 'bank' })}>
                    <Plus className="h-4 w-4" /> Spieler
                  </Button>
                </div>
                {stand.bank.length === 0 ? (
                  <p className="py-3 text-center text-sm text-muted-foreground">Leer — Spieler hierher ziehen oder „+ Spieler“.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {stand.bank.map((id) => {
                      const s = byId.get(id)
                      return s ? <SpielerChip key={id} s={s} onRemove={() => platzieren(id, { art: 'pool' })} /> : null
                    })}
                  </div>
                )}
              </BankZone>

              <PoolZone>
                <h2 className="mb-1 font-display text-lg tracking-wide">
                  Verfügbar <span className="font-body text-sm text-muted-foreground">{verfuegbar.length}</span>
                </h2>
                <p className="mb-3 text-xs text-muted-foreground">Auf einen Platz ziehen — oder oben einen Platz antippen.</p>
                {POSITION_CODES.map((p) => {
                  const liste = verfuegbar.filter((s) => positionCode(s.position) === p.value)
                  if (!liste.length) return null
                  return (
                    <div key={p.value} className="mb-3">
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{p.label}</p>
                      <div className="flex flex-wrap gap-2">
                        {liste.map((s) => (
                          <SpielerChip key={s.id} s={s} />
                        ))}
                      </div>
                    </div>
                  )
                })}
                {verfuegbar.length === 0 && <p className="text-sm text-muted-foreground">Alle Spieler sind eingeplant.</p>}
              </PoolZone>
            </div>
          </div>

          <DragOverlay dropAnimation={null}>{dragSpieler ? <ChipInhalt s={dragSpieler} schwebend /> : null}</DragOverlay>
        </DndContext>
      )}

      <SpielerPicker
        ziel={picker}
        formationSlots={formationSlots}
        stand={stand}
        spieler={spieler}
        onClose={() => setPicker(null)}
        onPick={(id) => {
          if (picker) platzieren(id, picker)
          setPicker(null)
        }}
        onLeeren={() => {
          if (picker?.art === 'slot' && stand.slots[picker.index]) platzieren(stand.slots[picker.index]!, { art: 'pool' })
          setPicker(null)
        }}
      />
    </>
  )
}

// ── Spielfeld (eigene Hälfte, Tor unten) ────────────────────────────────────
function Spielfeld({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-white/10 shadow-inner"
      style={{
        aspectRatio: '68 / 56',
        background:
          'repeating-linear-gradient(180deg, rgba(255,255,255,.035) 0 10%, transparent 10% 20%), linear-gradient(180deg, #1d5a2c 0%, #17482a 100%)',
      }}
    >
      {/* Linien: Mittellinie oben, Strafraum + Torraum unten */}
      <svg viewBox="0 0 68 56" className="absolute inset-0 h-full w-full" aria-hidden>
        <g fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="0.35">
          <rect x="1" y="1" width="66" height="54" />
          <path d="M 25.85 1 A 9.15 9.15 0 0 0 42.15 1" />
          <rect x="13.85" y="38.5" width="40.3" height="16.5" />
          <rect x="24.85" y="49.5" width="18.3" height="5.5" />
          <path d="M 26.7 38.5 A 9.15 9.15 0 0 1 41.3 38.5" />
        </g>
        <circle cx="34" cy="44" r="0.4" fill="rgba(255,255,255,.6)" />
      </svg>
      {children}
    </div>
  )
}

function SlotPunkt({
  index,
  slot,
  spieler,
  onTap,
  onLeeren,
}: {
  index: number
  slot: Slot
  spieler: RosterRow | null
  onTap: () => void
  onLeeren: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${index}` })
  const { setNodeRef: setDragRef, listeners, attributes, isDragging } = useDraggable({ id: `slot-drag-${index}`, data: { id: spieler?.id }, disabled: !spieler })
  const left = 50 + slot.x * 42
  const top = 100 - (slot.y * 84 + 8)
  const falsch = spieler && slot.role === 'TW' && positionCode(spieler.position) !== 'TW'

  return (
    <div
      ref={setNodeRef}
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      <button
        ref={setDragRef}
        {...listeners}
        {...attributes}
        type="button"
        onClick={onTap}
        aria-label={spieler ? `${ROLE_LABEL[slot.role]}: ${spieler.name} — ändern` : `${ROLE_LABEL[slot.role]}: frei — Spieler wählen`}
        className={cn(
          'relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 text-sm font-bold shadow-lg transition-transform sm:h-14 sm:w-14',
          spieler ? 'border-white bg-sva-black text-white' : 'border-dashed border-white/70 bg-black/25 text-white/85',
          isOver && 'scale-110 border-sva-gold ring-4 ring-sva-gold/40',
          falsch && 'border-sva-gold',
          isDragging && 'opacity-30',
        )}
        style={{ touchAction: 'manipulation' }}
      >
        {spieler ? (
          spieler.foto_url ? (
            <img src={spieler.foto_url} alt="" className="h-full w-full object-cover object-top" draggable={false} />
          ) : (
            <span className="font-display text-lg">{spieler.nummer ?? '?'}</span>
          )
        ) : (
          <span className="text-[10px] font-extrabold tracking-wider">{slot.role}</span>
        )}
        {spieler?.nummer != null && spieler.foto_url && (
          <span className="absolute -bottom-0.5 right-0 rounded bg-primary px-1 text-[9px] leading-tight text-white">{spieler.nummer}</span>
        )}
      </button>
      <span className="mt-0.5 flex max-w-[78px] items-center gap-0.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white sm:max-w-[96px] sm:text-xs">
        <span className="truncate">{spieler ? nachname(spieler.name) : '+'}</span>
        {spieler && (
          <button type="button" onClick={onLeeren} aria-label={`${spieler.name} vom Platz nehmen`} className="-mr-1 hidden p-0.5 text-white/70 hover:text-white sm:inline">
            <X className="h-3 w-3" />
          </button>
        )}
      </span>
    </div>
  )
}

function BankZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'bank' })
  return (
    <div ref={setNodeRef} className={cn('rounded-lg border bg-card p-4 transition-colors', isOver ? 'border-sva-gold bg-sva-gold/10' : 'border-border')}>
      {children}
    </div>
  )
}

function PoolZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'pool' })
  return (
    <div ref={setNodeRef} className={cn('rounded-lg border bg-card p-4 transition-colors', isOver ? 'border-sva-gold bg-sva-gold/10' : 'border-border')}>
      {children}
    </div>
  )
}

function SpielerChip({ s, onRemove }: { s: RosterRow; onRemove?: () => void }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `chip-${s.id}`, data: { id: s.id } })
  return (
    <span className={cn('inline-flex items-center', isDragging && 'opacity-30')}>
      <button ref={setNodeRef} {...listeners} {...attributes} type="button" className="touch-manipulation" aria-label={`${s.name} ziehen`}>
        <ChipInhalt s={s} />
      </button>
      {onRemove && (
        <button type="button" onClick={onRemove} className="-ml-1 flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground" aria-label={`${s.name} von der Bank nehmen`}>
          <X className="h-4 w-4" />
        </button>
      )}
    </span>
  )
}

function ChipInhalt({ s, schwebend }: { s: RosterRow; schwebend?: boolean }) {
  return (
    <span
      className={cn(
        'flex min-h-[40px] items-center gap-2 rounded-full border border-border bg-secondary py-1 pl-1 pr-3 text-sm',
        schwebend && 'cursor-grabbing border-sva-gold shadow-xl shadow-black/60',
      )}
    >
      {s.foto_url ? (
        <img src={s.foto_url} alt="" className="h-8 w-8 rounded-full object-cover object-top" draggable={false} />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted font-display text-primary">{s.nummer ?? '?'}</span>
      )}
      <span className="whitespace-nowrap">
        {s.nummer != null && s.foto_url && <b className="mr-1 tabular-nums text-muted-foreground">{s.nummer}</b>}
        {s.name}
      </span>
    </span>
  )
}

// ── Tipp-Auswahl (Handy-Weg) ────────────────────────────────────────────────
function SpielerPicker({
  ziel,
  formationSlots,
  stand,
  spieler,
  onClose,
  onPick,
  onLeeren,
}: {
  ziel: Ziel | null
  formationSlots: Slot[]
  stand: Stand
  spieler: RosterRow[]
  onClose: () => void
  onPick: (id: string) => void
  onLeeren: () => void
}) {
  const rolle = ziel?.art === 'slot' ? formationSlots[ziel.index]?.role : null
  const aktuell = ziel?.art === 'slot' ? stand.slots[ziel.index] : null
  const status = (id: string) => {
    const i = stand.slots.indexOf(id)
    if (i >= 0) return `Startelf · ${formationSlots[i]?.role}`
    if (stand.bank.includes(id)) return 'Bank'
    return null
  }
  // Passende Position zuerst, dann der Rest.
  const gruppen = POSITION_CODES.map((p) => ({ ...p, liste: spieler.filter((s) => positionCode(s.position) === p.value) })).sort(
    (a, b) => Number(b.value === rolle) - Number(a.value === rolle),
  )

  return (
    <Modal
      open={!!ziel}
      onClose={onClose}
      title={ziel?.art === 'bank' ? 'Wer kommt auf die Bank?' : `Wer spielt ${rolle ? ROLE_LABEL[rolle] : ''}?`}
      description={ziel?.art === 'slot' ? 'Tippe einen Spieler an. Steht er schon woanders, wird getauscht.' : undefined}
      footer={
        aktuell ? (
          <Button variant="outline" onClick={onLeeren}>
            <Eraser className="h-4 w-4" /> Platz leeren
          </Button>
        ) : undefined
      }
    >
      <div className="max-h-[60dvh] space-y-4 overflow-y-auto pr-1">
        {gruppen.map((g) =>
          g.liste.length ? (
            <div key={g.value}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</p>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {g.liste.map((s) => {
                  const st = status(s.id)
                  const istAktuell = s.id === aktuell
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        disabled={istAktuell || (ziel?.art === 'bank' && st === 'Bank')}
                        onClick={() => onPick(s.id)}
                        className="flex min-h-[52px] w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent/50 disabled:opacity-40"
                      >
                        <span className="w-7 text-right font-display text-lg tabular-nums text-muted-foreground">{s.nummer ?? '–'}</span>
                        <span className="flex-1">{s.name}</span>
                        {st && <span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{istAktuell ? 'hier' : st}</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null,
        )}
      </div>
    </Modal>
  )
}
