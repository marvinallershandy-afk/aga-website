import type { Staff } from '../data/players'
import { ROLE_LABEL } from '../data/players'
import { CLUB, whatsappUrl } from '../data/club'

// v10-E2: Trainerstab-Karte — bewusst KEINE FIFA-Spielerkarte (kein Rating,
// keine Tore/Assists), sondern ruhig & seriös: Rolle + „seit im Verein",
// Teammanager mit direktem „Schreib mir". Eigener Look, klar vom Kader
// abgesetzt, aber in der SVA-Familie (Rot-Akzent, Wappen).
export function StaffCard({ member }: { member: Staff }) {
  return (
    <div className="staff-card">
      <div className="staff-card__media">
        {member.photoUrl ? (
          <div className="staff-card__photo">
            <img src={member.photoUrl} alt={member.name} loading="lazy" />
          </div>
        ) : (
          <div className="staff-card__placeholder">
            <img src="/brand/wappen.png" alt={CLUB.name} />
          </div>
        )}
      </div>
      <div className="staff-card__body">
        <span className="staff-card__role">{ROLE_LABEL[member.role]}</span>
        <h4 className="staff-card__name">{member.name}</h4>
        <span className="staff-card__since">im Verein seit {member.since}</span>
        {member.role === 'teammanager' && member.contactMessage && (
          <a
            className="btn btn--wa staff-card__contact"
            href={whatsappUrl(member.contactMessage)}
            target="_blank"
            rel="noreferrer"
          >
            Schreib mir
          </a>
        )}
      </div>
    </div>
  )
}
