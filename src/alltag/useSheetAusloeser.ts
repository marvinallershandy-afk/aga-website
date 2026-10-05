import { useCallback, useRef, useState } from 'react'

/** Auslöser-Zustand: öffnen, schließen und danach den Fokus zurück auf den
 *  Knopf setzen (das Sheet wird beim Schließen ausgehängt). */
export function useSheetAusloeser<T extends HTMLElement = HTMLButtonElement>() {
  const ausloeser = useRef<T>(null)
  const [offen, setOffen] = useState(false)
  const auf = useCallback(() => setOffen(true), [])
  const zu = useCallback(() => {
    setOffen(false)
    window.setTimeout(() => ausloeser.current?.focus({ preventScroll: true }), 0)
  }, [])
  return { ausloeser, offen, auf, zu }
}
