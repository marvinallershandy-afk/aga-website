// Täglicher FuPa-Abgleich. Netlify-Cron läuft in UTC:
//   05:00 UTC = 06:00 CET (Winter) / 07:00 CEST (Sommer) — morgens vor dem Tag.
// Fängt verschobene Anstoßzeiten, neue Gegner und Nachträge ein.
import type { Config } from '@netlify/functions'
import { triggerFupaSync } from '../lib/fupa-trigger.mts'

export default async () => triggerFupaSync('täglich 05:00 UTC')

export const config: Config = { schedule: '0 5 * * *' }
