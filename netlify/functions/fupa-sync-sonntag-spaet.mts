// Sonntags 19:30 UTC = 21:30 CEST — Nachzügler (späte Anstöße, verzögerte
// FuPa-Eingaben). Zweiter Griff, damit die Tabelle am Sonntagabend stimmt.
import type { Config } from '@netlify/functions'
import { triggerFupaSync } from '../lib/fupa-trigger.mts'

export default async () => triggerFupaSync('Sonntag 19:30 UTC')

export const config: Config = { schedule: '30 19 * * 0' }
