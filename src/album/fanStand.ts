// ─────────────────────────────────────────────────────────────
// v21-A: Fan-Stand für die Startseite (Karte) — OHNE supabase-js.
// Die Startseite lädt bewusst kein Supabase-Bundle. Sie liest nur:
//   · ob eine Fan-Sitzung im Speicher liegt ('sva-album-auth', geteilt von
//     /album und /tippen) → „Angemeldet als Vorname“
//   · den zuletzt im Album gesehenen Stand ('sva-album-stand')
//   · und — solange der Zugangs-Token gültig ist — einmal frisch album_mein +
//     album_katalog per fetch (kein Token-Refresh hier: das erledigt das Album,
//     damit sich zwei Tabs nie um den Refresh-Token streiten).
// ─────────────────────────────────────────────────────────────
import type { Katalog, Mein } from './api'
import { besitzMap, fortschritt, plaetze } from './model'

export const STAND_KEY = 'sva-album-stand'
const AUTH_KEY = 'sva-album-auth'

export interface FanStand {
  uid: string
  vorname?: string
  belegt: number
  gesamt: number
  /** ungeöffnete Packs/Tütchen */
  packs: number
  at: number
}

interface GespeicherteSitzung {
  access_token?: string
  refresh_token?: string
  expires_at?: number
  user?: { id?: string }
}

function lies<T>(key: string): T | null {
  try {
    const s = localStorage.getItem(key)
    return s ? (JSON.parse(s) as T) : null
  } catch {
    return null
  }
}

/** Fan-Sitzung im Speicher? (auch mit abgelaufenem Zugangs-Token — das Album erneuert ihn) */
export function fanSitzung(): { uid: string; token?: string; gueltig: boolean } | null {
  const s = lies<GespeicherteSitzung>(AUTH_KEY)
  if (!s?.refresh_token || !s.user?.id) return null
  const gueltig = !!s.access_token && (s.expires_at ?? 0) * 1000 > Date.now() + 30_000
  return { uid: s.user.id, token: s.access_token, gueltig }
}

export function standLesen(uid: string): FanStand | null {
  const s = lies<FanStand>(STAND_KEY)
  return s && s.uid === uid ? s : null
}

export function standSchreiben(s: FanStand) {
  try {
    localStorage.setItem(STAND_KEY, JSON.stringify(s))
  } catch {
    /* privat-Modus */
  }
}

export function standVergessen() {
  try {
    localStorage.removeItem(STAND_KEY)
  } catch {
    /* egal */
  }
}

/** Stand aus Katalog + Mein (gleiche Rechnung wie im Heft). */
export function standAus(uid: string, katalog: Katalog, mein: Mein): FanStand {
  const fs = fortschritt(plaetze(katalog, besitzMap(mein)))
  return { uid, vorname: mein.profil?.vorname, belegt: fs.belegt, gesamt: fs.gesamt, packs: mein.packs?.length ?? 0, at: Date.now() }
}

/** Frischer Stand per fetch (nur mit gültigem Zugangs-Token). */
export async function standFrisch(): Promise<FanStand | null> {
  const s = fanSitzung()
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!s?.gueltig || !s.token || !url || !key) return null
  const rpc = async <T,>(fn: string, mitToken: boolean): Promise<T> => {
    const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${mitToken ? s.token : key}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!r.ok) throw new Error(String(r.status))
    return (await r.json()) as T
  }
  try {
    const [katalog, mein] = await Promise.all([rpc<Katalog>('album_katalog', false), rpc<Mein>('album_mein', true)])
    if (!mein?.profil) return null
    const st = standAus(s.uid, katalog, mein)
    standSchreiben(st)
    return st
  } catch {
    return null
  }
}
