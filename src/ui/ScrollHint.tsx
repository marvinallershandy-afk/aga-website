import { useStore } from '../store/useStore'

export function ScrollHint() {
  const p = useStore((s) => s.scrollProgress)
  // nur ganz am Anfang zeigen
  const style = { opacity: p < 0.04 ? 1 : 0, transition: 'opacity .4s' }
  return (
    <div className="scrollhint" style={style}>
      <div className="scrollhint__mouse" />
      <span>Scroll</span>
    </div>
  )
}
