import { useState } from 'react'
import { Film, ImageDown, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { useToast } from '../../components/ui/toast'
import type { KartenDaten } from '../../../karten/typen'
import { reelHerunterladen, storyHerunterladen } from './exportHelfer'

// v20-K: Knöpfe Story-Bild / Reel je Karte (Helfer: exportHelfer.ts).
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
