// v22-A: Merker „Einführung gesehen“ (localStorage, je Browser).
export const EINFUEHRUNG_KEY = 'sva-album-einfuehrung'
export function einfuehrungGesehen(): boolean {
  try {
    return localStorage.getItem(EINFUEHRUNG_KEY) === '1'
  } catch {
    return true
  }
}
export function einfuehrungMerken() {
  try {
    localStorage.setItem(EINFUEHRUNG_KEY, '1')
  } catch {
    /* privat-Modus */
  }
}
