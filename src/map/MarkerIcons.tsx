import { Timer, Goal, Shirt, Megaphone, Music, Handshake, Car } from 'lucide-react'
import type { PlaceId } from './places'

// v16-K: Pin-Icons der Karte (lucide, tree-shaken, currentColor).
// v17-D: Designsystem — dünne Linien-Icons (Strichstärke 1.5).
const ICONS: Record<PlaceId, typeof Timer> = {
  spieltag: Timer,
  training: Goal,
  mannschaft: Shirt,
  fans: Megaphone,
  musik: Music,
  partner: Handshake,
  anfahrt: Car,
}

export function PlaceIcon({ id, size = 20 }: { id: PlaceId; size?: number }) {
  const I = ICONS[id]
  return <I size={size} strokeWidth={1.5} aria-hidden="true" />
}
