import type { PartnerInfo } from './api'

/** „Tipp-Liga präsentiert von …“ — nur, wenn im Admin ein Partner gesetzt ist. */
export function Praesentiert({ partner }: { partner: PartnerInfo }) {
  const inhalt = (
    <>
      <span className="tp-partner__label">Tipp-Liga präsentiert von</span>
      {partner.logoUrl ? <img src={partner.logoUrl} alt={partner.name} height="24" /> : <b>{partner.name}</b>}
    </>
  )
  return partner.url ? (
    <a className="tp-partner" href={partner.url} target="_blank" rel="sponsored noopener">
      {inhalt}
    </a>
  ) : (
    <p className="tp-partner">{inhalt}</p>
  )
}
