// Unit-Test von mapSquad (supabase/functions/fupa-sync/map.mjs) mit SYNTHETISCHEN
// Daten (erfundene Namen/IDs). Kein Netzwerk, keine DB.
//   node supabase/tests/fupa_squad_map.test.mjs
import assert from 'node:assert/strict'
import { mapSquad } from '../functions/fupa-sync/map.mjs'

let fails = 0
const ok = (cond, msg) => { console.log(cond ? 'OK  ' : 'FAIL', msg); if (!cond) fails++ }

// Form A: nach Positionen gruppiert (players[])
const gruppiert = [
  { position: 'Tor', players: [{ player: { id: 701, firstName: 'Max', lastName: 'Muster' }, jerseyNumber: 1, matches: 9, goals: 0, assists: 0, birthday: '2000-01-01', image: 'x.jpg' }] },
  { position: 'Sturm', players: [
    { player: { id: 702, firstName: 'Jarek', lastName: 'Dettmer' }, jerseyNumber: 14, matches: 6, goals: 3, assists: 1 },
    { player: { id: 701, firstName: 'Max', lastName: 'Muster' }, jerseyNumber: 1, matches: 9, goals: 0, assists: 0 }, // Duplikat
  ] },
]
const a = mapSquad(gruppiert)
ok(a.length === 2, `gruppiert: 2 eindeutige Spieler (Duplikat gefiltert) — ${a.length}`)
const max = a.find((x) => x.fupa_spieler_id === 701)
ok(max && max.vorname === 'Max' && max.nachname === 'Muster' && max.nummer === 1 && max.spiele === 9, 'Felder korrekt abgebildet')
ok(!('birthday' in max) && !('image' in max), 'KEINE birthday/image-Felder (Datenminimierung)')
const jarek = a.find((x) => x.fupa_spieler_id === 702)
ok(jarek.tore === 3 && jarek.vorlagen === 1 && jarek.nummer === 14, 'Statistik (Tore/Vorlagen/Nummer)')

// Form B: flaches Spieler-Array, player direkt als Objekt
const flach = [
  { id: 801, firstName: 'David', lastName: 'Neimann', jerseyNumber: 22, matches: 4, goals: 2, assists: 0 },
  { id: null, firstName: 'Kaputt', lastName: '' },          // ohne ID → ignoriert
  { firstName: '', lastName: '' },                           // ohne Namen → ignoriert
]
const b = mapSquad(flach)
ok(b.length === 1 && b[0].fupa_spieler_id === 801, 'flaches Array: nur gültiger Eintrag')

// Form C: { squad: [...] } und { players: [...] }
ok(mapSquad({ squad: gruppiert }).length === 2, 'Wrapper { squad }')
ok(mapSquad({ players: flach }).length === 1, 'Wrapper { players }')
ok(mapSquad(null).length === 0 && mapSquad(undefined).length === 0, 'null/undefined → leer')

assert.ok(fails === 0)
console.log(fails ? `\n${fails} FEHLER` : '\nalles grün')
process.exit(fails ? 1 : 0)
