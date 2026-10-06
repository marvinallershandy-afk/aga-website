import { useRef, useState } from 'react'
import { Dices, ImagePlus, Loader2, Plus, Trophy } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Modal } from '../../components/ui/modal'
import { Select } from '../../components/ui/select'
import { SkeletonRows } from '../../components/ui/skeleton'
import { EmptyState } from '../../components/ui/empty-state'
import { useToast } from '../../components/ui/toast'
import { useConfirm } from '../../components/ui/confirm'
import { friendlyError } from '../../lib/db'
import { useSponsoren } from '../../lib/queries'
import { uploadPublicImage } from '../../lib/pflege'
import { ACCEPT_IMAGES, loadImage } from '../../lib/image'
import { renderStickerFoto, useAlbumStatistik } from '../../lib/album'
import { PREIS_VORLAGEN, useVerlosungMutations, useVerlosungen, type VerlosungInput, type Ziehung } from '../../lib/albumV20'
import { Gluecksrad } from './Gluecksrad'

// ─────────────────────────────────────────────────────────────
// v20-K: Admin → Album → Verlosungen. Lose sammeln Fans durch Check-ins,
// Meilensteine, Album komplett und Missionen. Verlosung anlegen (Preis,
// Bild, „präsentiert von“, Stichtag, Mindest-Lose), Ziehung per Knopf
// (fair: gewichtet nach Losen, Seed protokolliert) mit Glücksrad zum
// Abfilmen. Gewinner sieht es im Album.
// ─────────────────────────────────────────────────────────────

export function VerlosungenTab() {
  const toast = useToast()
  const confirm = useConfirm()
  const q = useVerlosungen()
  const sponsoren = useSponsoren()
  const stat = useAlbumStatistik()
  const { ziehen } = useVerlosungMutations()
  const [editor, setEditor] = useState(false)
  const [rad, setRad] = useState<{ z: Ziehung; titel: string; preis: string | null; partner: string | null } | null>(null)
  const S = sponsoren.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setEditor(true)}>
          <Plus className="h-4 w-4" /> Verlosung anlegen
        </Button>
        <span className="text-sm text-muted-foreground">Lose diese Saison: {(stat.data as { loseSaison?: number } | undefined)?.loseSaison ?? '–'}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Die Ziehung passiert in der Datenbank (gewichtet nach Losen, mit protokolliertem Seed) — das Glücksrad zeigt nur das feststehende Ergebnis. Teilnahme kostenlos; Bedingungen stehen unter Regeln.
      </p>
      {q.isLoading ? (
        <SkeletonRows rows={4} />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState icon={Trophy} title="Noch keine Verlosung" description="Zum Beispiel: Ehrenanstoß beim Derby, signiertes Trikot, eigene Sammelkarte mit Fotoshooting." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {(q.data ?? []).map((v) => {
            const partner = S.find((s) => s.id === v.partner_id)?.name ?? null
            return (
              <li key={v.id} className="flex gap-3 rounded-lg border border-border bg-card p-3">
                {v.bild_url ? <img src={v.bild_url} alt="" className="h-20 w-20 rounded object-cover" /> : <div className="grid h-20 w-20 place-items-center rounded bg-secondary"><Trophy className="h-6 w-6" /></div>}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium">{v.titel}</p>
                  <p className="text-xs text-muted-foreground">
                    {v.preis}
                    {partner ? ` · präsentiert von ${partner}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {v.status === 'gezogen'
                      ? `Gezogen ${v.gezogen_at ? new Date(v.gezogen_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : ''}: ${v.gewinner_name} (${v.teilnehmer} Teilnehmer, ${v.lose_gesamt} Lose, Seed ${v.seed?.slice(0, 10)}…)`
                      : `Stichtag ${v.stichtag ? new Date(v.stichtag).toLocaleDateString('de-DE') : 'offen'} · ab ${v.min_lose} Los${v.min_lose > 1 ? 'en' : ''}`}
                  </p>
                  {v.status === 'offen' && (
                    <Button
                      size="sm"
                      disabled={ziehen.isPending}
                      onClick={async () => {
                        if (!(await confirm({ title: `„${v.titel}“ jetzt ziehen?`, description: 'Die Ziehung ist endgültig und wird protokolliert. Danach öffnet sich das Glücksrad zum Abfilmen.', confirmLabel: 'Jetzt ziehen' }))) return
                        try {
                          const z = await ziehen.mutateAsync({ id: v.id })
                          setRad({ z, titel: v.titel, preis: v.preis, partner })
                        } catch (e) {
                          toast.error(friendlyError(e))
                        }
                      }}
                    >
                      {ziehen.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Dices className="h-4 w-4" />} Ziehen + Glücksrad
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {editor && <VerlosungEditor saison={stat.data?.saison ?? '2026/27'} sponsoren={S} onClose={() => setEditor(false)} />}
      {rad && <Gluecksrad ziehung={rad.z} titel={rad.titel} preis={rad.preis} partner={rad.partner} onClose={() => setRad(null)} />}
    </div>
  )
}

function VerlosungEditor({ saison, sponsoren, onClose }: { saison: string; sponsoren: { id: string; name: string }[]; onClose: () => void }) {
  const toast = useToast()
  const { save } = useVerlosungMutations()
  const [f, setF] = useState<VerlosungInput>({ titel: '', preis: '', min_lose: 1, saison, partner_id: null, stichtag: null, bild_url: null })
  const [upload, setUpload] = useState(false)
  const datei = useRef<HTMLInputElement>(null)
  const set = (p: VerlosungInput) => setF((x) => ({ ...x, ...p }))
  return (
    <Modal
      open
      onClose={onClose}
      title="Verlosung anlegen"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            disabled={save.isPending || upload}
            onClick={async () => {
              if (!f.titel || f.titel.trim().length < 2) return toast.error('Bitte einen Titel eingeben.')
              try {
                await save.mutateAsync({ input: { ...f, titel: f.titel.trim(), preis: f.preis?.trim() || null } })
                toast.success('Verlosung angelegt — sie erscheint im Album.')
                onClose()
              } catch (e) {
                toast.error(friendlyError(e))
              }
            }}
          >
            Speichern
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <Label htmlFor="vl-vorlage">Vorlage (nur Text — vorher mit dem Team abstimmen)</Label>
        <Select
          id="vl-vorlage"
          value=""
          onChange={(e) => {
            const v = PREIS_VORLAGEN.find((x) => x.titel === e.target.value)
            if (v) set({ titel: v.titel, preis: v.preis })
          }}
        >
          <option value="">— Vorlage wählen —</option>
          {PREIS_VORLAGEN.map((v) => (
            <option key={v.titel} value={v.titel}>
              {v.titel}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="vl-titel">Titel *</Label>
        <Input id="vl-titel" value={f.titel ?? ''} maxLength={80} onChange={(e) => set({ titel: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="vl-preis">Preis</Label>
        <Input id="vl-preis" value={f.preis ?? ''} maxLength={200} onChange={(e) => set({ preis: e.target.value })} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="vl-stich">Stichtag</Label>
          <Input id="vl-stich" type="date" value={f.stichtag?.slice(0, 10) ?? ''} onChange={(e) => set({ stichtag: e.target.value ? new Date(e.target.value + 'T23:59:00').toISOString() : null })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vl-min">Mind. Lose</Label>
          <Input id="vl-min" type="number" min={1} value={String(f.min_lose ?? 1)} onChange={(e) => set({ min_lose: Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vl-partner">Präsentiert von</Label>
          <Select id="vl-partner" value={f.partner_id ?? ''} onChange={(e) => set({ partner_id: e.target.value || null })}>
            <option value="">—</option>
            {sponsoren.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 overflow-hidden rounded bg-secondary">{f.bild_url && <img src={f.bild_url} alt="" className="h-full w-full object-cover" />}</div>
        <input
          ref={datei}
          type="file"
          accept={ACCEPT_IMAGES}
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            setUpload(true)
            try {
              set({ bild_url: await uploadPublicImage(await renderStickerFoto(await loadImage(file)), 'album', f.titel || 'verlosung') })
            } catch (err) {
              toast.error(friendlyError(err, 'Upload fehlgeschlagen.'))
            } finally {
              setUpload(false)
            }
          }}
        />
        <Button variant="outline" onClick={() => datei.current?.click()} disabled={upload}>
          {upload ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Bild
        </Button>
      </div>
    </Modal>
  )
}
