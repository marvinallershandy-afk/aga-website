import type { Katalog } from '../api'
import { KartenLabor } from '../KartenLabor'
import { GEHEIM } from './katalog'

/** v22-A Vorführung: Kartenlabor mit Demo-Katalog + allen Geheimkarten. */
export default function Labor({ katalog, onSchliessen }: { katalog: Katalog; onSchliessen: () => void }) {
  return <KartenLabor katalog={katalog} geheim={GEHEIM.map((g) => g.karte)} onSchliessen={onSchliessen} />
}
