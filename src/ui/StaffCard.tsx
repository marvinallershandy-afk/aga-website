import { useMemo } from 'react'
import type { Staff } from '../data/players'
import { whatsappUrl, whatsappReady } from '../data/content'
import { WaIcon, MailIcon } from './Icons'
import { SvaKarte } from '../karten/SvaKarte'
import { vonStab } from '../karten/adapter'

// v20-K: Trainerstab-Karte im gemeinsamen Kartensystem (Gold-Basis =
// objektive Rolle, Rolle statt Nummer). Teammanager behält „Schreib mir".
export function StaffCard({ member }: { member: Staff }) {
  const daten = useMemo(() => vonStab(member), [member])
  return (
    <div className="staff-card2">
      <SvaKarte daten={daten} lebend />
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
