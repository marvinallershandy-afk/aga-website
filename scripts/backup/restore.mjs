#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// v19-B (Paket 2): Restore aus einem sva_backup-JSON.
//
// SICHERHEIT: Standard ist TROCKENLAUF (zeigt nur, was passieren würde). Echtes
// Schreiben in die DB nur mit  --execute --yes  und gesetzten Service-Secrets.
// Das Schreiben läuft per Upsert (onConflict 'id') — es wird NICHTS gelöscht.
//
// Nutzung:
//   # Trockenlauf aus einer lokalen Backup-Datei:
//   node scripts/backup/restore.mjs --file backup-2026-10-06.json
//
//   # Trockenlauf mit der jüngsten Datei aus dem Bucket (braucht Service-Secrets):
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/backup/restore.mjs --from-bucket
//
//   # Nur eine Tabelle, echtes Zurückspielen:
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
//     node scripts/backup/restore.mjs --file backup.json --table sm_spiele --execute --yes
//
// Env:  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (nur für --from-bucket / --execute)
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs'

const BUCKET = 'sva_backup'
const args = process.argv.slice(2)
const has = (f) => args.includes(f)
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null }

const opt = {
  file: val('--file'),
  fromBucket: has('--from-bucket'),
  table: val('--table'),
  execute: has('--execute'),
  yes: has('--yes'),
}

function bar(s) { return `\n${'─'.repeat(72)}\n${s}\n${'─'.repeat(72)}` }

async function ladeClient() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen (für --from-bucket / --execute nötig).')
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(url, key, { auth: { persistSession: false } })
}

async function ladeBackup() {
  if (opt.file) {
    console.log(`Lese Backup aus Datei: ${opt.file}`)
    return JSON.parse(readFileSync(opt.file, 'utf8'))
  }
  if (opt.fromBucket) {
    const db = await ladeClient()
    const { data: dateien, error } = await db.storage.from(BUCKET).list('', { limit: 1000, sortBy: { column: 'name', order: 'desc' } })
    if (error) throw new Error(`Bucket-Liste fehlgeschlagen: ${error.message}`)
    const neueste = (dateien || []).filter((f) => /^backup-\d{4}-\d{2}-\d{2}\.json$/.test(f.name)).sort((a, b) => b.name.localeCompare(a.name))[0]
    if (!neueste) throw new Error('Keine Backup-Datei im Bucket gefunden.')
    console.log(`Jüngstes Backup im Bucket: ${neueste.name}`)
    const { data: blob, error: dlErr } = await db.storage.from(BUCKET).download(neueste.name)
    if (dlErr) throw new Error(`Download fehlgeschlagen: ${dlErr.message}`)
    return JSON.parse(await blob.text())
  }
  throw new Error('Bitte --file <pfad> oder --from-bucket angeben.')
}

async function main() {
  const backup = await ladeBackup()
  const tables = backup?.tables
  if (!tables || typeof tables !== 'object') throw new Error('Unerwartetes Backup-Format (kein tables-Objekt).')

  const alleNamen = Object.keys(tables).sort()
  const namen = opt.table ? alleNamen.filter((n) => n === opt.table) : alleNamen
  if (opt.table && !namen.length) throw new Error(`Tabelle „${opt.table}" ist im Backup nicht enthalten.`)

  console.log(bar(`Backup vom ${backup.generatedAt || '?'} · ${alleNamen.length} Tabellen`))
  for (const n of namen) console.log(`  ${n.padEnd(28)} ${Array.isArray(tables[n]) ? tables[n].length : '?'} Zeilen`)

  if (!opt.execute) {
    console.log(bar('TROCKENLAUF — es wurde nichts geschrieben.\nZum echten Zurückspielen: --execute --yes (Upsert, löscht nichts).'))
    return
  }
  if (!opt.yes) throw new Error('--execute verlangt zusätzlich --yes (bewusste Bestätigung).')

  const db = await ladeClient()
  console.log(bar('ECHTES ZURÜCKSPIELEN (Upsert onConflict id) …'))
  for (const n of namen) {
    const rows = tables[n]
    if (!Array.isArray(rows) || !rows.length) { console.log(`  ${n}: 0 Zeilen, übersprungen`); continue }
    const hatId = Object.prototype.hasOwnProperty.call(rows[0], 'id')
    let ok = 0
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500)
      const q = hatId ? db.from(n).upsert(batch, { onConflict: 'id' }) : db.from(n).insert(batch)
      const { error } = await q
      if (error) { console.log(`  ${n}: FEHLER bei Batch ${i}-${i + batch.length}: ${error.message}`); break }
      ok += batch.length
    }
    console.log(`  ${n}: ${ok}/${rows.length} Zeilen ${hatId ? 'upserted' : 'inserted'}`)
  }
  console.log(bar('Fertig.'))
}

main().catch((e) => { console.error('\nRestore abgebrochen:', e.message); process.exit(1) })
