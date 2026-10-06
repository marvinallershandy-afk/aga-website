// v17-A / v20-K: Im Album zur Seite eines Karten-Platzes blättern (Einkleben).
// Das Heft hört auf das Ereignis und blättert mit Seiten-Animation.
export const BLAETTERN_EREIGNIS = 'album-blaettern'

export function zuPlatzBlaettern(key: string, sanft = true): void {
  window.dispatchEvent(new CustomEvent(BLAETTERN_EREIGNIS, { detail: { key, sanft } }))
}

/** Dauer einer Seiten-Animation (ms) — Einkleben wartet so lange. */
export const BLAETTERN_MS = 760
