import type { Staff } from '../data/players'
import { ROLE_LABEL } from '../data/players'
import { CLUB, whatsappUrl, whatsappReady } from '../data/content'
import { WaIcon, MailIcon } from './Icons'
import { CardFigure, CardWalkout, lastNameSize, requestGyro } from './HoloCard'
import { useWalkout } from './walkoutSupport'
import { FIGURE } from './cardArt'

// v14-D: Trainerstab-Karte im Karten-2.0-System (gleicher Körper, Freisteller,
// Wappen) — aber klar KEINE Spielerkarte: Graphit statt Rot-Foil, Rolle statt
// Nummer/Position, „im Verein seit" nur wenn bekannt. Teammanager behält das
// direkte „Schreib mir" unter der Karte.
export function StaffCard({ member }: { member: Staff }) {
  const parts = member.name.trim().split(/\s+/)
  const first = parts.slice(0, -1).join(' ')
  const last = parts.slice(-1)[0] ?? ''
  const figure = member.cutoutUrl ?? null
  const walk = useWalkout(member.id)
  return (
    <div className="staff-card2">
      <div
        className="holo holo--stab"
        role="group"
        aria-label={`${member.name}, ${ROLE_LABEL[member.role]}`}
        onClick={() => requestGyro()}
      >
        <div className="holo__body" aria-hidden="true">
          <div className="holo__emboss" />
          <div className="holo__frame" />
          <div className="holo__plate" />
        </div>
        {walk.has ? (
          <CardWalkout id={member.id} headU={FIGURE.headStaff} onFail={walk.fail} />
        ) : figure ? (
          <CardFigure key={figure} src={figure} headU={FIGURE.headStaff} />
        ) : (
          <div className="holo__nophoto" aria-hidden="true">
            <img src="/brand/aga-logo.png" alt="" />
          </div>
        )}
        <div className="holo__role" aria-hidden="true">{ROLE_LABEL[member.role]}</div>
        <img className="holo__crest" src="/brand/aga-logo.png" alt={CLUB.name} draggable={false} />
        <div className="holo__name" aria-hidden="true">
          {first && <small>{first}</small>}
          <b style={{ fontSize: lastNameSize(last) }}>{last}</b>
          <i />
          <span>{member.since !== null ? `Im Verein seit ${member.since}` : 'SV Agathenburg-Dollern'}</span>
        </div>
        <div className="holo__sheen" aria-hidden="true" />
      </div>
      {member.role === 'teammanager' && member.contactMessage && (
        <a
          className={`btn staff-card__contact ${whatsappReady ? 'btn--wa' : 'btn--primary'}`}
          href={whatsappUrl(member.contactMessage)}
          target={whatsappReady ? '_blank' : undefined}
          rel={whatsappReady ? 'noreferrer' : undefined}
        >
          {whatsappReady ? <WaIcon size={17} /> : <MailIcon size={17} />}
          Schreib {member.name.split(' ')[0]}
        </a>
      )}
    </div>
  )
}
