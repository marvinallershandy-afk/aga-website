// ─────────────────────────────────────────────────────────────
// v18-P: Der Banden-Entwurf eines Interessenten („Diese Bande sucht dich").
// Ein kleiner Speicher auf Modulebene, geteilt von Panel, Rundgang, 3D-Bande
// und /partner. Bleibt NUR im Browser: sessionStorage (dieselbe Sitzung,
// Karte → /partner), nichts geht ans Netz, bis jemand „Anfrage senden" drückt.
// ─────────────────────────────────────────────────────────────
import { useSyncExternalStore } from 'react'
import { ladeLogo, type Grund, type Logo } from './logo'

export interface Entwurf {
  name: string
  zeile2: string
  grund: Grund | 'auto'
  /** getrimmtes Logo als PNG-Data-URL (≤ 800 px), nur lokal */
  logoDataUrl: string | null
  logoDatei: string | null
}

export interface EntwurfZustand extends Entwurf {
  logo: Logo | null
  /** zählt bei jeder Änderung hoch (für Texturen) */
  version: number
}

const KEY = 'sva-bande-entwurf'
const LEER: Entwurf = { name: '', zeile2: '', grund: 'auto', logoDataUrl: null, logoDatei: null }

function lesen(): Entwurf {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return LEER
    const v = JSON.parse(raw) as Partial<Entwurf>
    return {
      name: typeof v.name === 'string' ? v.name.slice(0, 40) : '',
      zeile2: typeof v.zeile2 === 'string' ? v.zeile2.slice(0, 48) : '',
      grund: v.grund === 'hell' || v.grund === 'dunkel' || v.grund === 'rot' ? v.grund : 'auto',
      logoDataUrl: typeof v.logoDataUrl === 'string' && v.logoDataUrl.startsWith('data:image/png') ? v.logoDataUrl : null,
      logoDatei: typeof v.logoDatei === 'string' ? v.logoDatei.slice(0, 80) : null,
    }
  } catch {
    return LEER
  }
}

let zustand: EntwurfZustand = { ...(typeof window !== 'undefined' ? lesen() : LEER), logo: null, version: 0 }
const hoerer = new Set<() => void>()

function melden() {
  hoerer.forEach((f) => f())
}

function speichern() {
  try {
    const { name, zeile2, grund, logoDataUrl, logoDatei } = zustand
    if (!name && !logoDataUrl && !zeile2) sessionStorage.removeItem(KEY)
    else sessionStorage.setItem(KEY, JSON.stringify({ name, zeile2, grund, logoDataUrl, logoDatei }))
  } catch {
    /* privater Modus / voll → nur im Speicher */
  }
}

// gespeichertes Logo der Sitzung wieder aufbereiten
if (zustand.logoDataUrl) {
  const url = zustand.logoDataUrl
  ladeLogo(url)
    .then((logo) => {
      if (zustand.logoDataUrl === url) {
        zustand = { ...zustand, logo, version: zustand.version + 1 }
        melden()
      }
    })
    .catch(() => {})
}

export function entwurf(): EntwurfZustand {
  return zustand
}

export function setzeEntwurf(teil: Partial<Entwurf> & { logo?: Logo | null }) {
  zustand = { ...zustand, ...teil, version: zustand.version + 1 }
  if ('logoDataUrl' in teil && !teil.logoDataUrl) zustand.logo = null
  speichern()
  melden()
}

export function entwurfLeeren() {
  zustand = { ...LEER, logo: null, version: zustand.version + 1 }
  speichern()
  melden()
}

export function abonniere(f: () => void): () => void {
  hoerer.add(f)
  return () => hoerer.delete(f)
}

export function useEntwurf(): EntwurfZustand {
  return useSyncExternalStore(abonniere, entwurf, entwurf)
}

/** Hat der Entwurf etwas zum Zeigen? */
export function entwurfAktiv(e: Entwurf): boolean {
  return !!(e.name.trim() || e.logoDataUrl)
}

/** Dateiname für den Export: „bande-baeckerei-muster.png" */
export function dateiname(name: string, endung = 'png'): string {
  const s = name
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `bande-${s || 'entwurf'}.${endung}`
}
