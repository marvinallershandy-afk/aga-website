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

