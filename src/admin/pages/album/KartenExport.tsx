import { useState } from 'react'
import { Film, ImageDown, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { useToast } from '../../components/ui/toast'
import { herunterladen } from '../../lib/albumPlakat'
import type { KartenDaten } from '../../../karten/typen'

// v20-K: Instagram-Content je Karte — Story-PNG (1080×1920) und Reel
// (Pack-Opening, MP4/WebM, 7 s). Export-Module erst bei Bedarf laden.
const dateiname = (d: KartenDaten) => `sva-karte-${d.titel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`

export async function storyHerunterladen(d: KartenDaten) {
  const { storyNeueKarte, alsBlob } = await import('../../../karten/export/bild')
  herunterladen(await alsBlob(await storyNeueKarte(d)), `${dateiname(d)}-story.png`)
}
export async function reelHerunterladen(d: KartenDaten, onFortschritt?: (p: number) => void, kicker?: string) {
  const { kartenReel } = await import('../../../karten/export/video')
  const r = await kartenReel(d, { kicker: kicker ?? (d.limitiert ? 'Limitierte Karte' : 'Neue Karte im Album'), onFortschritt })
  herunterladen(r.blob, `${dateiname(d)}-reel.${r.endung}`)
}

export function KartenExportKnoepfe({ daten, klein }: { daten: KartenDaten; klein?: boolean }) {
  const toast = useToast()
  const [laeuft, setLaeuft] = useState<'' | 'story' | 'reel'>('')
  const [p, setP] = useState(0)
  return (
    <div className="flex flex-wrap gap-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={!!laeuft}
        title="„Neue Karte im Album“ als Story-Bild (1080×1920)"
        onClick={async () => {
          setLaeuft('story')
          try {
            await storyHerunterladen(daten)
          } catch {
            toast.error('Story-Bild konnte nicht erstellt werden.')
          } finally {
            setLaeuft('')
          }
        }}
      >
        {laeuft === 'story' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />} {klein ? 'Story' : 'Story-Bild'}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={!!laeuft}
        title="Pack-Opening als Reel (7 s, 1080×1920)"
        onClick={async () => {
          setLaeuft('reel')
          setP(0)
          try {
            await reelHerunterladen(daten, setP)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Reel konnte nicht erstellt werden.')
          } finally {
            setLaeuft('')
          }
        }}
      >
        {laeuft === 'reel' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> {Math.round(p * 100)} %
          </>
        ) : (
          <>
            <Film className="h-4 w-4" /> Reel
          </>
        )}
      </Button>
    </div>
  )
}
