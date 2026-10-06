// ─────────────────────────────────────────────────────────────
// v18-A: Admin → Statistik. Liest die Auswertung web_statistik(p_tage)
// (nur is_sm_admin(), Migration 20261009100000). Untypisierter Client nur
// hier (RPC steht noch nicht in database.types.ts). retry:false → fehlt die
// Migration, erscheint sofort der ruhige Hinweis.
// ─────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

const db = supabase as unknown as SupabaseClient

export interface Statistik {
  tage: number
  von: string
  bis: string
  aufrufe: number
  aufrufeVorher: number
  proTag: { tag: string; aufrufe: number }[]
  quellen: { quelle: string; aufrufe: number }[]
  medien: { quelle: string; aufrufe: number }[]
  seiten: { pfad: string; aufrufe: number }[]
  geraete: { geraet: string; aufrufe: number }[]
  ereignisse: { name: string; anzahl: number; vonInstagram: number | null }[]
}

export function useStatistik(tage: number) {
  return useQuery({
    queryKey: ['web_statistik', tage],
    queryFn: async (): Promise<Statistik> => {
      const { data, error } = await db.rpc('web_statistik', { p_tage: tage })
      if (error) throw error
      return data as Statistik
    },
    retry: false,
    staleTime: 60_000,
  })
}

export const QUELLE_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  google: 'Google-Suche',
  whatsapp: 'WhatsApp',
  qr: 'QR-Code am Platz',
  direkt: 'Direkt / Lesezeichen',
  intern: 'Von der eigenen Seite',
  sonstige: 'Andere Seiten',
}
export const MEDIUM_LABEL: Record<string, string> = {
  bio: 'Link in der Bio',
  story: 'Story-Link',
  post: 'Beitrag',
  reel: 'Reel',
  platz: 'am Platz',
  plakat: 'Plakat',
  flyer: 'Flyer',
  status: 'Status',
  gruppe: 'Gruppe',
}
export const SEITE_LABEL: Record<string, string> = {
  '/': 'Startseite (Karte)',
  '/live': 'Live-Ticker /live',
  '/partner': 'Partner-Seite /partner',
  '/album': 'Sammelalbum /album',
  '/galerie': 'Galerie /galerie',
  '/impressum': 'Impressum',
  '/datenschutz': 'Datenschutz',
  '/tippen': 'Tipp-Liga /tippen',
  '/teilnahmebedingungen': 'Tipp-Liga: Teilnahmebedingungen',
  '/#rundgang': 'Rundgang',
  '/#spieltag': 'Karte → Spieltag & Live',
  '/#training': 'Karte → Mitspielen',
  '/#mannschaft': 'Karte → Mannschaft',
  '/#fans': 'Karte → Fans',
  '/#musik': 'Karte → Vereinsheim',
  '/#partner': 'Karte → Partner',
  '/#anfahrt': 'Karte → Anfahrt',
}

/** Ereignisse gruppiert nach den drei Vereinszielen. */
export const ZIELE: { ziel: string; text: string; ereignisse: { name: string; label: string }[] }[] = [
  {
    ziel: 'Mehr Zuschauer',
    text: 'Wer sich Spiele in den Kalender holt oder per QR am Platz eincheckt.',
    ereignisse: [
      { name: 'kalender-abo', label: 'Heimspiele abonniert' },
      { name: 'kalender-termin', label: 'Einzelnes Spiel eingetragen' },
      { name: 'kalender-link', label: 'Kalender-Adresse kopiert' },
      { name: 'album-checkin', label: 'Album-Check-in am Platz gestartet' },
      { name: 'tipp-abgegeben', label: 'Tipp-Liga: Tipp abgegeben' },
      { name: 'elf-gespeichert', label: 'Tipp-Liga: Elf aufgestellt' },
    ],
  },
  {
    ziel: 'Mehr Spieler',
    text: 'Wer den Probetraining-Assistenten öffnet – und wer die Nachricht wirklich abschickt.',
    ereignisse: [
      { name: 'probetraining-start', label: 'Probetraining-Assistent geöffnet' },
      { name: 'probetraining', label: 'WhatsApp/E-Mail geöffnet' },
    ],
  },
  {
    ziel: 'Mehr Sponsoren',
    text: 'Abgeschickte Anfragen über /partner.',
    ereignisse: [{ name: 'partner-anfrage', label: 'Partner-Anfrage abgeschickt' }],
  },
  {
    ziel: 'Instagram',
    text: 'Klicks von der Website zu Instagram.',
    ereignisse: [
      { name: 'instagram', label: 'Instagram-Link getippt' },
      { name: 'tipp-teilen', label: 'Tipp-Liga: Story-Bild geteilt' },
      { name: 'liga-gegruendet', label: 'Tipp-Liga: Stammtisch-Liga gegründet' },
      { name: 'liga-beigetreten', label: 'Tipp-Liga: Liga per Einladung beigetreten' },
    ],
  },
]
