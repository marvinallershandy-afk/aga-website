import { useStore } from '../store/useStore'

export function ScrollHint() {
  const p = useStore((s) => s.scrollProgress)
  // nur in Ruhe ganz oben (Deep-Link /#rundgang) — v18-R: sobald gescrollt
  // wird, sofort weg (kein Overlay über der beginnenden Fahrt)
  const style = { opacity: p < 0.004 ? 1 : 0, transition: 'opacity .2s' }
  return (
    <div className="scrollhint" style={style}>
      <div className="scrollhint__mouse" />
      <span>Weiter scrollen</span>
    </div>
  )
}
