// v17-A: Im Heft zur Seite eines Sticker-Platzes blättern (für „Einkleben“).
export function zuPlatzBlaettern(key: string, sanft = true): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(`[data-platz="${CSS.escape(key)}"]`)
  const seite = el?.closest<HTMLElement>('.hf-seite')
  const leiste = document.querySelector<HTMLElement>('.hf-seiten')
  if (el && seite && leiste) leiste.scrollTo({ left: seite.offsetLeft - leiste.offsetLeft, behavior: sanft ? 'smooth' : 'auto' })
  return el
}
