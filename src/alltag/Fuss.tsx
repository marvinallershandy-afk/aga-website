import { KalenderKnopf } from './Kalender'
import { ProbetrainingKnopf } from './Probetraining'
import { CONTACT } from '../data/content'

/** v18-A: Fußzeilen-Links (Karte → Anfahrt, Rundgang-Ende): ruhige Text-Links. */
export function AlltagFuss() {
  return (
    <nav className="al-fuss" aria-label="Termine und Mitspielen">
      <KalenderKnopf variante="link" adresse={CONTACT.address} label="Heimspiele in den Kalender" />
      <ProbetrainingKnopf className="al-link" label="Probetraining anfragen" icon={false} />
    </nav>
  )
}
