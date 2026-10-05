// Sonntags 16:30 UTC = 18:30 CEST — kurz nach Abpfiff der üblichen 15-Uhr-Spiele.
// Holt das frische Ergebnis + die aktualisierte Tabelle, ohne dass jemand tippt.
import type { Config } from '@netlify/functions'
import { triggerFupaSync } from '../lib/fupa-trigger.mts'

export default async () => triggerFupaSync('Sonntag 16:30 UTC')

export const config: Config = { schedule: '30 16 * * 0' }
