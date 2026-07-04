import { useStore } from '../store/useStore'
import { SECTIONS } from '../data/club'

export function Brandbar() {
  const active = useStore((s) => s.activeSection)
  return (
    <header className="brandbar">
      <a href="#top" className="brandbar__logo" style={{ textDecoration: 'none', pointerEvents: 'auto' }}>
        SV<b>A</b>
      </a>
      <nav className="brandbar__nav">
        {SECTIONS.map((s, i) => (
          <a key={s.id} href={`#${s.id}`} data-active={active === i}>
            {s.id}
          </a>
        ))}
      </nav>
    </header>
  )
}
