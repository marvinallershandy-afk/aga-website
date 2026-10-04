// Admin-Audit: klickt den Admin headless durch und screenshottet (desktop + 390 px).
// KEIN Login, KEINE DB-Mutation: nutzt den eingebauten DEV-?preview-Bypass,
// GET-Antworten kommen aus Mock-Daten (unten), alle Schreib-Requests und
// Storage-Uploads werden mit 403 geblockt, drive-bridge/publish-site gemockt.
//
// v14-C: deckt die Vereins-Pflege ab (Übersicht, Kader inkl. Foto-Zuschnitt,
// Aufstellung inkl. Tippen + Drag & Drop mit Maus UND Touch, Spiele, Tabelle,
// Sponsoren, Verein & Links) plus Stichproben im Archiv.
//   node scripts/admin-audit.mjs               → desktop + mobile
//   SCHEMA=alt node scripts/admin-audit.mjs    → DB ohne Migrationen 20261004*
// Dev-Server vorher starten: npx vite --port 5184 --strictPort
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5184'
const OUT = process.env.OUT || (process.env.SCHEMA === 'alt' ? './shots-admin/alt-schema' : './shots-admin')
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })

const DUMP = {
  sm_content: [
    {"id":"af468651-6ae6-49f6-9ecb-508ae81d0750","titel":"Spieltag-Ankündigung: SVA vs. TuS Fischbek","beschreibung":"Anstoß So 15:00, Sportplatz Agathenburg. Aufruf: Kommt vorbei!","kanal":["instagram","facebook","whatsapp"],"status":"geplant","format":"Grafik","kategorie":"Spieltag","geplant_am":"2026-07-09","verantwortlich":"Marvin","idee_id":null,"notizen":null,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00","hook":null,"caption":null,"cta":null,"sound":null,"drive_rohmaterial_url":null,"drive_asset_url":null},
    {"id":"b6455cc1-60bf-4fc8-9e2f-e65f8357a038","titel":"Trainingsimpression Donnerstag","beschreibung":"Kurzes Reel vom Abschlusstraining.","kanal":["instagram","tiktok"],"status":"idee","format":"Reel","kategorie":"Team","geplant_am":"2026-07-10","verantwortlich":null,"idee_id":null,"notizen":null,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00","hook":null,"caption":null,"cta":null,"sound":null,"drive_rohmaterial_url":null,"drive_asset_url":null},
    {"id":"33be23e5-7f54-498e-ab66-fc1e34bd5d52","titel":"Startaufstellung SVA vs. TuS Fischbek","beschreibung":"Aufstellungs-Grafik ~1h vor Anpfiff.","kanal":["instagram","facebook"],"status":"geplant","format":"Grafik","kategorie":"Spieltag","geplant_am":"2026-07-11","verantwortlich":"Marvin","idee_id":null,"notizen":null,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00","hook":null,"caption":null,"cta":null,"sound":null,"drive_rohmaterial_url":"https://drive.google.com/drive/folders/demo123","drive_asset_url":null},
    {"id":"ca9bda15-0192-4e2b-bd36-04b2c1da92f1","titel":"Endergebnis SVA vs. TuS Fischbek","beschreibung":"Ergebnis-Kachel direkt nach Abpfiff.","kanal":["instagram","facebook","whatsapp"],"status":"idee","format":"Grafik","kategorie":"Spieltag","geplant_am":"2026-07-11","verantwortlich":null,"idee_id":null,"notizen":null,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00","hook":null,"caption":null,"cta":null,"sound":null,"drive_rohmaterial_url":null,"drive_asset_url":null},
    {"id":"ef083dce-1a42-45de-b31c-9d5e7849fb1d","titel":"MOTM des Spieltags","beschreibung":"Spieler des Spiels küren.","kanal":["instagram"],"status":"idee","format":"Grafik","kategorie":"Spieltag","geplant_am":"2026-07-12","verantwortlich":null,"idee_id":null,"notizen":null,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00","hook":null,"caption":null,"cta":null,"sound":null,"drive_rohmaterial_url":null,"drive_asset_url":null},
    {"id":"3e3d9a89-0990-4503-add8-d1f3c720281e","titel":"Rückblick der Woche","beschreibung":"Alle Mannschaften im Überblick.","kanal":["instagram","website"],"status":"idee","format":"Karussell","kategorie":"Verein","geplant_am":"2026-07-12","verantwortlich":null,"idee_id":null,"notizen":null,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00","hook":null,"caption":null,"cta":null,"sound":null,"drive_rohmaterial_url":null,"drive_asset_url":null},
    {"id":"47ae55d8-3c57-4b05-94fa-f96156b1d567","titel":"Sponsor des Monats: Autohaus Müller","beschreibung":"Partner vorstellen, Danke sagen.","kanal":["instagram","facebook"],"status":"in_arbeit","format":"Post","kategorie":"Sponsoren","geplant_am":"2026-07-13","verantwortlich":"Marvin","idee_id":null,"notizen":null,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00","hook":null,"caption":null,"cta":null,"sound":null,"drive_rohmaterial_url":null,"drive_asset_url":null}
  ],
  sm_ideen_pool: [
    {"id":"80efa74c-4911-4409-b2c4-9e197aad93ac","titel":"Spieltag-Ankündigung","beschreibung":"Gegner, Anstoßzeit, Ort – Freitag vor dem Spiel.","kanal":["instagram","facebook","whatsapp"],"kategorie":"Spieltag","rhythmus":"pro_spieltag","aktiv":true,"sortierung":10,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00"},
    {"id":"f607fb45-cdbe-418c-9f32-a8b4581f3f6d","titel":"Startaufstellung","beschreibung":"Grafik mit Aufstellung ~1h vor Anpfiff.","kanal":["instagram","facebook"],"kategorie":"Spieltag","rhythmus":"pro_spieltag","aktiv":true,"sortierung":20,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00"},
    {"id":"ff3c5bfc-ac1e-4b27-9aa0-4e1cfb636165","titel":"Endergebnis","beschreibung":"Ergebnis-Kachel direkt nach Abpfiff.","kanal":["instagram","facebook","whatsapp"],"kategorie":"Spieltag","rhythmus":"pro_spieltag","aktiv":true,"sortierung":30,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00"},
    {"id":"1faa8c2f-4a18-4beb-aed1-25af1ddea077","titel":"Spieler des Spiels (MOTM)","beschreibung":"Man of the Match küren – Sonntagabend.","kanal":["instagram"],"kategorie":"Spieltag","rhythmus":"pro_spieltag","aktiv":true,"sortierung":40,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00"},
    {"id":"c87d68c8-6a86-4251-be6d-d7d77f553c46","titel":"Trainingsimpression","beschreibung":"Foto/Reel aus dem Training – Dienstag/Donnerstag.","kanal":["instagram","tiktok"],"kategorie":"Team","rhythmus":"woechentlich","aktiv":true,"sortierung":50,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00"},
    {"id":"2f64663b-b48d-4adf-a5e8-6162f0986f4c","titel":"Geburtstagsgruß","beschreibung":"Spieler-/Mitglieder-Geburtstage.","kanal":["instagram","facebook"],"kategorie":"Community","rhythmus":"einmalig","aktiv":true,"sortierung":60,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00"},
    {"id":"aedb4809-243f-4538-9996-d20a661948e3","titel":"Sponsor des Monats","beschreibung":"Partner vorstellen, Danke sagen.","kanal":["instagram","facebook"],"kategorie":"Sponsoren","rhythmus":"monatlich","aktiv":true,"sortierung":70,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00"},
    {"id":"b1e49ad0-c14e-43fd-a3c1-c8ab439bc4bf","titel":"Rückblick der Woche","beschreibung":"Wochenrückblick aller Mannschaften – Sonntag.","kanal":["instagram","website"],"kategorie":"Verein","rhythmus":"woechentlich","aktiv":true,"sortierung":80,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00"},
    {"id":"95260e5a-4605-471b-bc4e-0cbf15ced3ff","titel":"Tabellen-Update","beschreibung":"Aktueller Tabellenstand nach dem Spieltag.","kanal":["instagram","facebook"],"kategorie":"Spieltag","rhythmus":"woechentlich","aktiv":true,"sortierung":90,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00"},
    {"id":"1199fd9d-b2a7-45eb-9015-59f58fdef307","titel":"Neuzugang / Vertragsverlängerung","beschreibung":"Transfer-News ankündigen.","kanal":["instagram","facebook"],"kategorie":"Team","rhythmus":"einmalig","aktiv":true,"sortierung":100,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00"}
  ],
  sm_ideen_eingang: [
    {"id":"bd55f86a-858b-4ebc-b121-a4035aa211c8","titel":"Kabinen-Karaoke nach dem Heimsieg","beschreibung":"Kurzes Reel: Team singt den Vereins-Song in der Kabine. Stimmung pur.","von":"Nico","kanal":["instagram","tiktok"],"status":"offen","content_id":null,"created_at":"2026-07-09T13:19:01.178116+00:00","updated_at":"2026-07-09T13:19:01.178116+00:00"},
    {"id":"68666d32-a53e-4775-8329-08501095191b","titel":"Spieler-Steckbrief: Lieblingsessen & Trikotnummer","beschreibung":"Schnelle Frage-Antwort-Story mit einem Spieler pro Woche.","von":"Nico","kanal":["instagram"],"status":"offen","content_id":null,"created_at":"2026-07-09T13:19:01.178116+00:00","updated_at":"2026-07-09T13:19:01.178116+00:00"},
    {"id":"9f5f0cd2-c959-4748-b2cc-8ef2815bb47a","titel":"Torhymne-Voting","beschreibung":"Fans stimmen per Story-Sticker über die nächste Torhymne ab.","von":"Marvin","kanal":["instagram","facebook"],"status":"geprueft","content_id":null,"created_at":"2026-07-09T13:19:01.178116+00:00","updated_at":"2026-07-09T13:19:01.178116+00:00"}
  ],
  sm_sponsoren: [
    { id: 'so1', name: 'Autohaus Müller', paket: 'gold', laufzeit_von: '2025-08-01', laufzeit_bis: new Date(Date.now() + 32 * 864e5).toISOString().slice(0, 10), leistungen: 'Bande + 2 Instagram-Posts pro Saison + Trikotärmel', ansprechpartner: 'K. Müller', kontakt: 'info@autohaus-mueller.de', logo_url: null, aktiv: true, notizen: null, created_at: '2025-08-01T10:00:00Z', updated_at: '2025-08-01T10:00:00Z' },
    { id: 'so2', name: 'Bäckerei Behrens', paket: 'silber', laufzeit_von: '2025-07-01', laufzeit_bis: '2027-06-30', leistungen: 'Bande + Sponsor des Monats', ansprechpartner: 'H. Behrens', kontakt: '04141 555 123', logo_url: null, aktiv: true, notizen: null, created_at: '2025-07-01T10:00:00Z', updated_at: '2025-07-01T10:00:00Z' },
    { id: 'so3', name: 'Getränke Kruse', paket: 'bronze', laufzeit_von: '2024-07-01', laufzeit_bis: '2025-06-30', leistungen: 'Bande', ansprechpartner: null, kontakt: null, logo_url: null, aktiv: false, notizen: 'Nicht verlängert.', created_at: '2024-07-01T10:00:00Z', updated_at: '2025-07-01T10:00:00Z' },
  ],
  sm_admins: [{ email: 'preview@audit.local' }],
  sm_insights: Array.from({ length: 8 }, (_, i) => ({
    id: `ig-${i}`, datum: new Date(Date.now() - (7 - i) * 7 * 864e5).toISOString().slice(0, 10),
    kanal: 'instagram', follower: 320 + i * 14 + (i % 3) * 5, reichweite: 1800 + i * 210,
    top_beitrag: i === 7 ? 'Endergebnis-Kachel SVA vs. Apensen' : null, notizen: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  })).concat(Array.from({ length: 4 }, (_, i) => ({
    id: `tt-${i}`, datum: new Date(Date.now() - (3 - i) * 7 * 864e5).toISOString().slice(0, 10),
    kanal: 'tiktok', follower: 95 + i * 22, reichweite: 4200 + i * 800,
    top_beitrag: null, notizen: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }))),
  sm_spiele: [
    { id: 'sp1', gegner: 'TSV Apensen', heim: false, anstoss: new Date(Date.now() - 6 * 864e5).toISOString(), ort: 'Sportplatz Apensen', wettbewerb: 'Kreisliga Stade', spieltag_nr: 21, tore_sva: 2, tore_gegner: 2, notizen: null, created_at: new Date(Date.now() - 20 * 864e5).toISOString(), updated_at: new Date(Date.now() - 6 * 864e5).toISOString() },
    { id: 'sp2', gegner: 'TuS Fischbek', heim: true, anstoss: new Date(Date.now() + 2 * 864e5 + 3 * 36e5).toISOString(), ort: 'Sportplatz Agathenburg', wettbewerb: 'Kreisliga Stade', spieltag_nr: 22, tore_sva: null, tore_gegner: null, notizen: null, created_at: new Date(Date.now() - 10 * 864e5).toISOString(), updated_at: new Date(Date.now() - 10 * 864e5).toISOString() },
    { id: 'sp3', gegner: 'VfL Güldenstern Stade III', heim: false, anstoss: new Date(Date.now() + 9 * 864e5).toISOString(), ort: 'Güldenstern-Arena', wettbewerb: 'Kreisliga Stade', spieltag_nr: 23, tore_sva: null, tore_gegner: null, notizen: null, created_at: new Date(Date.now() - 10 * 864e5).toISOString(), updated_at: new Date(Date.now() - 10 * 864e5).toISOString() },
  ],
  sm_roster: [
    { id: 'r1', name: 'Carsten Beckmann', nummer: 1, position: 'Torwart', foto_url: '/players/carsten.webp', aktiv: true, sortierung: 10, steckbrief: {}, created_at: '2026-07-01T10:00:00Z', updated_at: '2026-07-01T10:00:00Z' },
    { id: 'r2', name: 'Lennard Voss', nummer: 4, position: 'Abwehr', foto_url: '/players/lennard.webp', aktiv: true, sortierung: 20, steckbrief: {}, created_at: '2026-07-01T10:00:00Z', updated_at: '2026-07-01T10:00:00Z' },
    { id: 'r3', name: 'Julio Fernandes', nummer: 8, position: 'Mittelfeld', foto_url: '/players/julio.webp', aktiv: true, sortierung: 30, steckbrief: {}, created_at: '2026-07-01T10:00:00Z', updated_at: '2026-07-01T10:00:00Z' },
    { id: 'r4', name: 'Nico Hause', nummer: 10, position: 'Mittelfeld', foto_url: '/players/nico-hause.webp', aktiv: true, sortierung: 40, steckbrief: { im_verein_seit: '2018', lieblingsessen: 'Lasagne', lieblingsverein: 'HSV', staerke: 'Übersicht', motto: 'Immer weiter.' }, created_at: '2026-07-01T10:00:00Z', updated_at: '2026-07-01T10:00:00Z' },
    { id: 'r5', name: 'Tino Albers', nummer: 9, position: 'Sturm', foto_url: '/players/tino.webp', aktiv: true, sortierung: 50, steckbrief: {}, created_at: '2026-07-01T10:00:00Z', updated_at: '2026-07-01T10:00:00Z' },
    { id: 'r6', name: 'Eli Brandt', nummer: 11, position: 'Sturm', foto_url: '/players/eli.webp', aktiv: false, sortierung: 60, steckbrief: {}, created_at: '2026-07-01T10:00:00Z', updated_at: '2026-07-01T10:00:00Z' },
  ],
}

const PAKET_ROWS = [
  { titel: 'Spieltag-Ankündigung: SVA vs. TuS Fischbek' },
  { titel: 'Startaufstellung: SVA vs. TuS Fischbek' },
  { titel: 'Endergebnis: SVA vs. TuS Fischbek' },
  { titel: 'Spieler des Spiels: SVA vs. TuS Fischbek' },
].map((r, i) => ({
  id: `paket-${i}`, beschreibung: null, kanal: ['instagram'], status: 'geplant', format: 'Grafik',
  kategorie: 'Spieltag', geplant_am: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10),
  verantwortlich: null, idee_id: null, notizen: null, hook: null, caption: null, cta: null, sound: null,
  drive_rohmaterial_url: null, drive_asset_url: null, spiel_id: 'sp2',
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...r,
}))

const DRIVE_FILES = {
  root: {
    folder: { id: 'root', name: 'SVA Social Media', webViewLink: 'https://drive.google.com/drive/folders/root' },
    files: [
      { id: 'f1', name: '01 Rohmaterial', mimeType: 'application/vnd.google-apps.folder', modifiedTime: '2026-07-05T10:00:00Z', webViewLink: '#' },
      { id: 'f2', name: '02 Fertige Assets', mimeType: 'application/vnd.google-apps.folder', modifiedTime: '2026-07-08T09:00:00Z', webViewLink: '#' },
      { id: 'f3', name: '03 Vorlagen', mimeType: 'application/vnd.google-apps.folder', modifiedTime: '2026-06-20T12:00:00Z', webViewLink: '#' },
      { id: 'd1', name: 'Spieltag_2026-07-11_Ankuendigung.png', mimeType: 'image/png', size: '482133', modifiedTime: '2026-07-09T14:00:00Z', webViewLink: '#' },
      { id: 'd2', name: 'Training_Reel_Rohschnitt.mp4', mimeType: 'video/mp4', size: '58231344', modifiedTime: '2026-07-09T18:30:00Z', webViewLink: '#' },
    ],
  },
  f1: {
    folder: { id: 'f1', name: '01 Rohmaterial', webViewLink: '#' },
    files: [
      { id: 'd3', name: 'IMG_2041.jpg', mimeType: 'image/jpeg', size: '3120400', modifiedTime: '2026-07-09T18:00:00Z', webViewLink: '#' },
      { id: 'd4', name: 'IMG_2042.jpg', mimeType: 'image/jpeg', size: '2988112', modifiedTime: '2026-07-09T18:01:00Z', webViewLink: '#' },
    ],
  },
}

// ═════════════════════════════════════════════════════════════════════════════
// v14-C „Vereins-Pflege": Mock-Daten im NEUEN Schema (Migrationen 20261004*).
// Kader = echter Startbestand der Migration (gekürzt auf die Felder, die der
// Admin liest), Spiele mit einem offenen Ergebnis, Tabelle, Sponsoren,
// Verein & Links, Aufstellung, Veröffentlichungs-Protokoll.
// ═════════════════════════════════════════════════════════════════════════════
const T = (d) => new Date(Date.now() + d * 864e5).toISOString()
const KADER = [
  ['p-pils', 'Malte Pils', 1, 'TW', 'malte-pils'], ['p-ebeling-t', 'Tino Ebeling', 38, 'TW', 'tino-ebeling'],
  ['p-huettry', 'Justin Hüttry', 3, 'ABW', 'justin-huettry'], ['p-brettschneider', 'Lennard Brettschneider', 4, 'ABW', 'lennard-brettschneider'],
  ['p-sladek', 'Justin Sladek', 11, 'ABW', 'justin-sladek'], ['p-neuber-m', 'Marcel Neuber', 14, 'ABW', 'marcel-neuber'],
  ['p-nauerz', 'Noel Nauerz', 15, 'ABW', 'noel-nauerz'], ['p-neuber-d', 'Dawid Neuber', 21, 'ABW', 'dawid-neuber'],
  ['p-marchel', 'Oliver Marchel', 29, 'ABW', 'oliver-marchel'], ['p-elsen', 'Joshua Elsen', 32, 'ABW', 'joshua-elsen'],
  ['p-warkehr-i', 'Isaak Warkehr', null, 'ABW', 'isaak-warkehr'], ['p-litwitz', 'Lukas-Alexander Litwitz', 5, 'MIT', null],
  ['p-paruzel', 'Julio Paruzel', 7, 'MIT', 'julio-paruzel'], ['p-becker', 'Niclas Becker', 8, 'MIT', 'niclas-becker'],
  ['p-kalwa', 'Justin Kalwa', 13, 'MIT', 'justin-kalwa'], ['p-jochim', 'Sam Luca Jochim', 17, 'MIT', null],
  ['p-pejas-n', 'Noah Pejas', 20, 'MIT', 'noah-pejas'], ['p-pejas-e', 'Elias Pejas', 22, 'MIT', 'elias-pejas'],
  ['p-helck', 'Tobias Helck', 24, 'MIT', 'tobias-helck'], ['p-bruenjes', 'Janek Brünjes', 33, 'MIT', 'janek-bruenjes'],
  ['p-matthes', 'Paul Matthes', 44, 'MIT', 'paul-matthes'], ['p-warkehr-a', 'Aaron Warkehr', 6, 'ANG', 'aaron-warkehr'],
  ['p-viedts', 'Lennox Viedts', 10, 'ANG', null], ['p-biedermann', 'Marc Kevin Biedermann', 37, 'ANG', 'marc-kevin-biedermann'],
]
const ROSTER = KADER.map(([slug, name, nummer, position, foto], i) => ({
  id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  slug, name, nummer, position, rolle: 'spieler', aktiv: true, sortierung: (i + 1) * 10, steckbrief: {},
  foto_url: foto ? `/players/${foto}.webp` : null, freisteller_url: foto ? `/players/cutout/${foto}.webp` : null,
  kapitaen: slug === 'p-helck', neuzugang: ['p-warkehr-i', 'p-litwitz', 'p-jochim', 'p-biedermann'].includes(slug),
  im_verein_seit: null, kontakt_text: null, created_at: T(-60), updated_at: T(-3),
})).concat([
  ['s-junge', 'Carsten Junge', 'trainer', 'carsten-junge', 2016], ['s-ebeling-a', 'Adolf Ebeling', 'co-trainer', 'adolf-ebeling', null],
  ['s-hause', 'Niko Hause', 'teammanager', 'niko-hause', 2018],
].map(([slug, name, rolle, foto, seit], i) => ({
  id: `00000000-0000-4000-9000-${String(i + 1).padStart(12, '0')}`, slug, name, nummer: null, position: null, rolle, aktiv: true,
  sortierung: 500 + i * 10, steckbrief: {}, foto_url: `/players/${foto}.webp`, freisteller_url: `/players/cutout/${foto}.webp`,
  kapitaen: false, neuzugang: slug === 's-hause', im_verein_seit: seit, kontakt_text: null, created_at: T(-60), updated_at: T(-60),
}))).concat([{
  id: '00000000-0000-4000-7000-000000000001', slug: 'r-altbestand', name: 'Alt-Eintrag (inaktiv)', nummer: 9, position: 'Sturm',
  rolle: 'spieler', aktiv: false, sortierung: 999, steckbrief: {}, foto_url: null, freisteller_url: null, kapitaen: false, neuzugang: false,
  im_verein_seit: null, kontakt_text: null, created_at: T(-200), updated_at: T(-200),
}])
const rid = (slug) => ROSTER.find((r) => r.slug === slug).id
const SPIELE = [
  { id: 'sp0', gegner: 'TSV Apensen', heim: false, anstoss: T(-20), ort: 'Sportplatz Apensen', tore_sva: 2, tore_gegner: 2 },
  { id: 'sp1', gegner: 'VfL Horneburg', heim: true, anstoss: T(-13), ort: 'Waldsportplatz Agathenburg', tore_sva: 3, tore_gegner: 1 },
  { id: 'sp1b', gegner: 'TuS Harsefeld II', heim: false, anstoss: T(-6), ort: 'Harsefeld', tore_sva: null, tore_gegner: null },
  { id: 'sp2', gegner: 'TuS Fischbek', heim: true, anstoss: T(2.1), ort: 'Waldsportplatz Agathenburg', tore_sva: null, tore_gegner: null },
  { id: 'sp3', gegner: 'VfL Güldenstern Stade III', heim: false, anstoss: T(9), ort: 'Güldenstern-Arena', tore_sva: null, tore_gegner: null },
].map((s, i) => ({ wettbewerb: 'Kreisliga Stade', spieltag_nr: 20 + i, notizen: null, created_at: T(-30), updated_at: T(-1), ...s }))
const TABELLE = [
  ['TuS Fischbek', 8, 19], ['SV Agathenburg-Dollern', 8, 17, true], ['VfL Horneburg', 8, 15], ['TSV Apensen', 8, 13],
  ['TuS Harsefeld II', 8, 12], ['SG Estetal', 8, 10], ['VfL Güldenstern Stade III', 8, 7], ['FC Mulsum/Kutenholz', 8, 4],
].map(([team, spiele, punkte, self], i) => ({
  id: `t${i}`, saison: '2026/27', platz: i + 1, team, spiele, siege: 0, unentschieden: 0, niederlagen: 0, tore: 0, gegentore: 0,
  diff: 0, punkte, self: !!self, created_at: T(-5), updated_at: T(-2),
}))
Object.assign(DUMP, {
  sm_roster: ROSTER,
  sm_spiele: SPIELE,
  sm_tabelle: TABELLE,
  sm_sponsoren: [
    { id: 'so1', name: 'Autohaus Müller', paket: 'gold', laufzeit_von: '2025-08-01', laufzeit_bis: T(32).slice(0, 10), leistungen: 'Bande + 2 Posts', ansprechpartner: 'K. Müller', kontakt: 'info@autohaus-mueller.de', logo_url: '/brand/wappen.png', aktiv: true, notizen: null, website_url: 'https://autohaus-mueller.example', bande: true, sortierung: 10, created_at: T(-90), updated_at: T(-90) },
    { id: 'so2', name: 'Bäckerei Behrens', paket: 'silber', laufzeit_von: '2025-07-01', laufzeit_bis: '2027-06-30', leistungen: 'Bande', ansprechpartner: 'H. Behrens', kontakt: '04141 555 123', logo_url: null, aktiv: true, notizen: null, website_url: null, bande: false, sortierung: 20, created_at: T(-90), updated_at: T(-90) },
    { id: 'so3', name: 'Getränke Kruse', paket: 'bronze', laufzeit_von: '2024-07-01', laufzeit_bis: '2025-06-30', leistungen: 'Bande', ansprechpartner: null, kontakt: null, logo_url: null, aktiv: false, notizen: 'Nicht verlängert.', website_url: null, bande: true, sortierung: 30, created_at: T(-400), updated_at: T(-90) },
  ],
  sva_settings: [{
    id: 1, fussball_de_team_id: '00ES8GN7SS00004CVV0AG08LVUPGND5I', fupa_url: null, instagram: 'sva_fussball', whatsapp: null,
    email: 'info@aga-erste.de', training: 'Di & Do, ab 19:00 Uhr', adresse: 'Waldsportplatz Agathenburg, Zur Mehrzweckhalle, 21684 Agathenburg',
    saison: '2026/27', rechtstexte_ok: false, updated_at: T(-4), updated_by: null,
  }],
  sva_lineup: [{
    id: 'l1', formation: '4-4-2', spiel_id: 'sp2', match_label: 'vs TuS Fischbek · 06.10.', erstellt_von: 'trainer@aga-erste.de', created_at: T(-1),
    startelf: ['p-pils', 'p-sladek', 'p-brettschneider', 'p-neuber-m', 'p-huettry', 'p-kalwa', 'p-helck', 'p-becker', 'p-paruzel', 'p-warkehr-a', 'p-biedermann'].map(rid),
    bank: ['p-ebeling-t', 'p-nauerz', 'p-elsen', 'p-pejas-n'].map(rid),
  }],
  sva_publish_log: [
    { id: 'pl1', angefordert_at: T(-2), angefordert_von: 'marvin@aga-erste.de', status: 'ok', detail: null },
  ],
})
// SCHEMA=alt: Datenbank im Stand VOR den Migrationen 20261004* (sva_* fehlen).
const ALT_SCHEMA = process.env.SCHEMA === 'alt'

const errors = []
const clicks = []

async function setupRoutes(ctx, { altSchema = false } = {}) {
  await ctx.route('**/rest/v1/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const table = url.pathname.split('/rest/v1/')[1]?.split('?')[0]
    if (table === 'rpc/sm_spieltagspaket') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PAKET_ROWS) })
    }
    if (altSchema && table?.startsWith('sva_')) {
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST205', message: `Could not find the table 'public.${table}' in the schema cache` }) })
    }
    if (req.method() === 'GET' && table && DUMP[table]) {
      let rows = DUMP[table]
      // sva_lineup / sva_publish_log: jüngste zuerst (wie .order(... desc))
      const accept = req.headers()['accept'] || ''
      const body = accept.includes('vnd.pgrst.object') ? rows[0] ?? null : rows
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    }
    // Audit-Modus: alles andere (Schreibzugriffe) hart blocken.
    return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'audit: write blocked' }) })
  })
  await ctx.route('**/functions/v1/drive-bridge', async (route) => {
    let body = {}
    try { body = route.request().postDataJSON() ?? {} } catch { /* ignore */ }
    if (body.action === 'list') {
      const node = DRIVE_FILES[body.folderId] ?? DRIVE_FILES.root
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ configured: true, ...node }) })
    }
    return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'audit: write blocked' }) })
  })
  // publish-site: Zustand „Build-Hook noch nicht hinterlegt" (configured:false).
  await ctx.route('**/functions/v1/publish-site', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ configured: false }) }),
  )
  await ctx.route('**/storage/v1/**', (route) => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'audit: upload blocked' }) }))
  await ctx.route('**/auth/v1/**', (route) => route.fulfill({ status: 403, contentType: 'application/json', body: '{}' }))
}

async function run(label, viewport, opts = {}) {
  const browser = await chromium.launch()
  const ctx = await browser.newContext(viewport)
  await setupRoutes(ctx, opts)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    // Erwartet im Audit: geblockte Schreibzugriffe (403) und Alt-Schema (404).
    if (/status of 40[34]/.test(t)) return
    errors.push(`[${label}] console: ${t.slice(0, 300)}`)
  })

  let n = 0
  const shot = async (name, full = false) => {
    const file = `${label}-${String(n).padStart(2, '0')}-${name}.png`
    await page.waitForTimeout(350)
    await page.screenshot({ path: `${OUT}/${file}`, fullPage: full })
    console.log(file)
    n++
  }
  const go = async (path) => {
    await page.goto(`${BASE}${path}${path.includes('?') ? '&' : '?'}preview`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
  }
  const tryClick = async (locator, desc) => {
    try {
      await locator.first().click({ timeout: 3000 })
      clicks.push(`[${label}] OK  ${desc}`)
      await page.waitForTimeout(450)
      return true
    } catch {
      clicks.push(`[${label}] FEHLT/NICHT KLICKBAR  ${desc}`)
      return false
    }
  }
  const closeModal = async () => {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }
  const check = async (desc, fn) => {
    try {
      const ok = await fn()
      clicks.push(`[${label}] ${ok ? 'OK ' : 'FEHLER'}  ${desc}`)
    } catch (e) {
      clicks.push(`[${label}] FEHLER  ${desc} (${String(e).slice(0, 100)})`)
    }
  }

  if (opts.altSchema) {
    await go('/admin/')
    await shot('uebersicht-alt-schema', true)
    await go('/admin/aufstellung')
    await shot('aufstellung-alt-schema', true)
    await browser.close()
    return
  }

  await go('/admin/login')
  await shot('login')

  // ── Übersicht ────────────────────────────────────────────────────────────
  await go('/admin/')
  await shot('uebersicht', true)
  await check('Übersicht: Checkliste nennt WhatsApp', async () => (await page.getByText(/WhatsApp-Nummer fehlt/).count()) > 0)
  await check('Übersicht: offenes Ergebnis erkannt', async () => (await page.getByText(/Ergebnis fehlt/).count()) > 0)
  if (await tryClick(page.getByRole('button', { name: 'Website veröffentlichen' }).last(), 'Übersicht: Website veröffentlichen')) {
    await page.waitForTimeout(400)
    await check('Veröffentlichen: Hinweis „nicht eingerichtet“ statt Fehler', async () => (await page.getByText(/noch nicht hinterlegt/).count()) > 0)
    await shot('uebersicht-veroeffentlichen')
  }

  // ── Kader ────────────────────────────────────────────────────────────────
  await go('/admin/kader')
  await shot('kader-liste', true)
  if (await tryClick(page.getByRole('tab', { name: /karten/i }), 'Kader: Kartenansicht')) await shot('kader-karten', true)
  await tryClick(page.getByRole('tab', { name: /liste/i }), 'Kader: zurück zur Liste')
  if (await tryClick(page.getByRole('button', { name: /Tobias Helck/ }), 'Kader: Spieler öffnen')) {
    await shot('kader-editor')
    // Foto-Zuschnitt mit echtem Bild durchspielen (Upload selbst ist geblockt)
    try {
      await page.locator('input[type=file]').setInputFiles('public/players/tobias-helck.webp')
      await page.waitForTimeout(900)
      const canvas = page.locator('canvas[aria-label^="Fotoausschnitt"]')
      const box = await canvas.boundingBox()
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 40, { steps: 6 })
        await page.mouse.up()
      }
      await page.getByLabel('Zoom').fill('1.4')
      await page.waitForTimeout(600)
      clicks.push(`[${label}] OK  Kader: Foto zuschneiden (ziehen + zoomen)`)
      await shot('kader-foto-zuschnitt')
    } catch (e) {
      clicks.push(`[${label}] FEHLER  Kader: Foto-Zuschnitt (${String(e).slice(0, 100)})`)
    }
    await closeModal()
  }
  if (await tryClick(page.getByRole('button', { name: /^Spieler$/ }), 'Kader: neuer Spieler')) {
    await page.getByLabel('Name *').fill('Max Mustermann')
    await page.getByRole('button', { name: /ANG/ }).first().click()
    await page.getByLabel(/Rückennummer/).fill('7')
    await page.waitForTimeout(300)
    await check('Kader: Nummernkonflikt wird angezeigt', async () => (await page.getByText(/hat schon Julio Paruzel/).count()) > 0)
    await shot('kader-neu')
    await closeModal()
  }

  // ── Aufstellung ──────────────────────────────────────────────────────────
  await go('/admin/aufstellung')
  await shot('aufstellung', true)
  await check('Aufstellung: 11/11 aus gespeichertem Stand', async () => (await page.getByText('11/11 aufgestellt').count()) > 0)
  if (await tryClick(page.getByRole('radio', { name: '4-3-3' }), 'Aufstellung: Formation 4-3-3')) await shot('aufstellung-433')
  // Tippen-Weg: Slot antippen → Picker → Spieler wählen (tauscht)
  if (await tryClick(page.getByRole('button', { name: /^Angriff: / }), 'Aufstellung: Slot antippen (Picker)')) {
    await shot('aufstellung-picker')
    await tryClick(page.getByRole('dialog').getByRole('button', { name: /Lennox Viedts/ }), 'Aufstellung: Spieler im Picker wählen')
    await check('Aufstellung: Viedts steht jetzt auf dem Platz', async () => (await page.getByRole('button', { name: /: Lennox Viedts/ }).count()) > 0)
  }
  // Ziehen-Weg (Maus): Chip aus „Verfügbar“ auf einen Slot ziehen
  if (label === 'desktop') {
    try {
      const chip = page.getByRole('button', { name: 'Janek Brünjes ziehen' })
      const ziel = page.getByRole('button', { name: /^Mittelfeld: / }).first()
      const a = await chip.boundingBox()
      const b = await ziel.boundingBox()
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
      await page.mouse.down()
      await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 3 })
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
      await page.waitForTimeout(150)
      await page.mouse.up()
      await page.waitForTimeout(400)
      const ok = (await page.getByRole('button', { name: /: Janek Brünjes/ }).count()) > 0
      clicks.push(`[desktop] ${ok ? 'OK ' : 'FEHLER'}  Aufstellung: Drag & Drop Chip → Slot`)
    } catch (e) {
      clicks.push(`[desktop] FEHLER  Aufstellung: Drag & Drop (${String(e).slice(0, 100)})`)
    }
    await shot('aufstellung-nach-dnd', true)
  } else {
    // Touch-Ziehen: kurz halten, dann ziehen (TouchSensor delay 220 ms)
    // Start und Ziel müssen gleichzeitig im Bild sein (am Rand scrollt dnd-kit
    // automatisch) → Bank oben ins Bild holen, ersten freien Chip draufziehen.
    try {
      const chip = page.getByRole('button', { name: 'Dawid Neuber ziehen' })
      const bank = page.getByRole('heading', { name: 'Bank' })
      await bank.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 160))
      await page.waitForTimeout(200)
      const a = null
      const a2 = await chip.boundingBox()
      const b = await bank.boundingBox()
      const cdp = await page.context().newCDPSession(page)
      const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
      const sx = a2.x + a2.width / 2, sy = a2.y + a2.height / 2
      await tp('touchStart', sx, sy)
      await page.waitForTimeout(350)
      for (let i = 1; i <= 10; i++) await tp('touchMove', sx + ((b.x + 40 - sx) * i) / 10, sy + ((b.y + 20 - sy) * i) / 10)
      await page.waitForTimeout(150)
      await shot('aufstellung-touch-zieht')
      await tp('touchEnd', 0, 0)
      await page.waitForTimeout(400)
      void a
      const ok = (await page.getByRole('button', { name: 'Dawid Neuber von der Bank nehmen' }).count()) > 0
      clicks.push(`[mobile] ${ok ? 'OK ' : 'FEHLER'}  Aufstellung: Touch-Ziehen Chip → Bank`)
    } catch (e) {
      clicks.push(`[mobile] FEHLER  Aufstellung: Touch-Ziehen (${String(e).slice(0, 100)})`)
    }
    await shot('aufstellung-nach-touch', true)
  }
  if (await tryClick(page.getByRole('button', { name: /Leeren/ }), 'Aufstellung: Leeren')) {
    await tryClick(page.getByRole('dialog').getByRole('button', { name: 'Leeren' }), 'Aufstellung: Leeren bestätigen')
    await check('Aufstellung: Speichern gesperrt bei 0/11', async () => await page.getByRole('button', { name: /Noch 11 Spieler aufstellen/ }).isDisabled())
    await shot('aufstellung-leer')
  }

  // ── Spiele ───────────────────────────────────────────────────────────────
  await go('/admin/spiele')
  await shot('spiele', true)
  if (await tryClick(page.getByRole('button', { name: /TuS Fischbek/ }), 'Spiele: Spiel öffnen')) {
    await shot('spiele-editor')
    await closeModal()
  }

  // ── Tabelle ──────────────────────────────────────────────────────────────
  await go('/admin/tabelle')
  await shot('tabelle', true)

  // ── Sponsoren ────────────────────────────────────────────────────────────
  await go('/admin/sponsoren')
  await shot('sponsoren', true)
  if (await tryClick(page.getByRole('button', { name: /Autohaus Müller/ }), 'Sponsoren: Editor öffnen')) {
    await shot('sponsoren-editor')
    await closeModal()
  }

  // ── Verein & Links ───────────────────────────────────────────────────────
  await go('/admin/verein')
  await shot('verein', true)
  try {
    await page.getByLabel('WhatsApp-Nummer').fill('0151 123 456 78')
    await page.getByLabel('FuPa — Teamseite').fill('https://www.fupa.net/team/sv-agathenburg-dollern-m1-2026-27')
    await page.waitForTimeout(300)
    await check('Verein: WhatsApp normalisiert', async () => (await page.getByText('wird gespeichert als +4915112345678').count()) > 0)
    await shot('verein-eingabe')
  } catch (e) {
    clicks.push(`[${label}] FEHLER  Verein: Eingabe (${String(e).slice(0, 100)})`)
  }

  // ── Archiv: Social Media (Routen müssen weiter funktionieren) ─────────────
  await go('/admin/archiv')
  await shot('archiv', true)
  for (const [path, name] of [['/admin/social', 'social-dashboard'], ['/admin/redaktionsplan', 'redaktionsplan'], ['/admin/matchday', 'matchday'], ['/admin/sponsoren-crm', 'sponsoren-crm']]) {
    await go(path)
    await check(`Archiv: ${path} rendert`, async () => (await page.locator('h1').count()) > 0)
    if (label === 'desktop') await shot(`archiv-${name}`)
  }

  // Mobil: Drawer
  if (label === 'mobile') {
    await go('/admin/')
    if (await tryClick(page.getByRole('button', { name: /^Mehr$/ }), 'Mobil: Drawer über „Mehr“ öffnen')) await shot('drawer')
  }

  await browser.close()
}

if (ALT_SCHEMA) {
  await run('alt-schema', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, { altSchema: true })
} else {
  await run('desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  await run('mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
}

console.log('\n--- KLICK-PROTOKOLL ---')
for (const c of clicks) console.log(c)
console.log('\n--- KONSOLEN-/SEITENFEHLER ---')
if (!errors.length) console.log('keine')
for (const e of [...new Set(errors)]) console.log(e)
console.log('\nFERTIG →', OUT)
