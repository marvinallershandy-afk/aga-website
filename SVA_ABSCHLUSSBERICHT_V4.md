# SVA v4 — Abschlussbericht „Der Perfektions-Lauf"

Stand: Juli 2026 · Etappen 0–7 komplett · 11 Commits (`5cea204` … Abschluss)
Belege: `SVA_SCREENSHOTS/v4-loop2-*` (finaler Sweep Desktop + Mobile),
`v4-party-*` (Raum, Anflug, Dip, Gains), `SVA_AUDIT_V4.md`, `SVA_COPY.md`.

---

## 1 · Was dieser Lauf verändert hat

| Etappe | Ergebnis |
|---|---|
| 0 Audit | Dreifach-Scores 7,0 / 5,5 / 7,5 + priorisierte Mängelliste |
| 1 Content | Komplette Copy neu: „Dorfverein mit Herz und Selbstironie" — Hero-Claim, Sektions-Stimme, Sponsoren-Baustein, Microcopy-Tabelle, 10-Sekunden-Test bestanden |
| 2 Musik | AGA URKNALL verankert — nach Marvins Kurskorrektur (in Loop 1) als **Partyraum-Station** neu gebaut, s. Punkt 3 |
| 3 3D | Fassaden-Tiefe (Fenster/Sockel/Putz/Regenrinne), Portrait-Kamera, runde Dust-Partikel, Fanblock-Leben (Banner wogt, Schal, Lehn-Figuren), Party-Posen |
| 4 Karten | Namens-Hierarchie, Prägung, Zweitschicht-Holo, Spring-Tilt, **Karten-Rückseite mit Flip**, Tore-Stat betont |
| 5 SEO | Lighthouse mobil: **SEO 100, A11y 96** · JSON-LD SportsTeam + MusicGroup · OG/Canonical/Sitemap/Robots · **Prerender: 22 kB Kern-DOM in dist/index.html** (curl findet die komplette Kern-Copy ohne JS) |
| 6 Loops | 2 Jury-Loops, Scores s. Punkt 2 — Abbruchkriterium erfüllt |

## 2 · Score-Verlauf (die Wahrheit)

| Runde | Juror | Stratege | 3D |
|---|---|---|---|
| Start v4 | 7,0 | 5,5 | 7,5 |
| nach E1–E5 | — | ~7,5 | 8,0 |
| Loop 1 | 8,5 | 8,5 | 8,3 |
| **Loop 2 (final)** | **8,6** | **8,5** | **8,5** |

Abbruch nach Loop 2: alle Rollen ≥ 8,5, nichts award-peinlich. Was fehlt, ist
kein Feinschliff mehr, sondern echtes Material (Punkt 5).

## 3 · Meine 3 mutigsten Entscheidungen

1. **Die Musik-Sektion ist ein Ort, kein Widget.** Nach Marvins Kurskorrektur
   schneidet die Fahrt an der Musik-Station per Dip-to-Black in den Partyraum —
   rein scroll-getrieben (reine Funktion der Sektionslage), also exakt
   umkehrbar: zurückscrollen = wieder draußen. Nav „Musik" und Scroll führen
   denselben Weg. Kein Button, kein Modus, kein separater Player.
2. **Draußen läuft keine Musik.** Auf dem Platz gibt es nur Flutlicht-Atmo
   (prozedurales Rauschen) — die Songs leben ausschließlich im Raum (rein →
   Track an auf Party-Pegel, raus → weich aus). Das ist unbequem konsequent,
   macht den Raum aber zum Ziel. Beleg per Gains: draußen atmo 0.16/keine
   Musik, drinnen music 0.75/atmo 0.05.
3. **Platzhalter als Gestaltung.** Statt 14 leere Karten zu verstecken:
   Silhouetten im CI-Duotone, „Dein Banner?"-Bande, ehrlich beschriftete
   Demo-Tabelle, Footer „Platzhalter ehrlich markiert". Die Seite lügt nie —
   und bleibt trotzdem Sammelalbum statt Baustelle.

## 4 · Performance (Frametime ist die Wahrheit)

| Messung | v3 | v4 |
|---|---|---|
| GPU-Frametime (headed, 5 Stationen) | 16,6 ms | **16,5–17,2 ms** (inkl. Partyraum) |
| Bundle initial (index) | ~342 kB | 343 kB |
| three/R3F (lazy, nur mit WebGL) | ~880 kB | 880 kB |
| Stage-Chunk | ~105 kB | 109 kB |
| PartyRoom-Chunk (lazy via partyNear) | 5,5 kB | 6,7 kB |
| Prerender-DOM | 21,7 kB | 22,0 kB |

Ehrliche Fußnote: die letzte Messreihe lief auf Batterie (16 %) — macOS
halbiert dann die Display-Rate; `about:blank` und Szene lagen identisch bei
33 ms (vsync-gebunden). Der 60-FPS-Beleg oben stammt aus derselben Codebasis
am Netzteil. Robustheits-Fix aus Loop 1: Look-Damping ist jetzt zeitbasiert —
die Kamera kadriert auch auf langsamen Geräten korrekt.

## 5 · Was echte Assets freischalten (Marvin-To-dos)

| Asset | Schaltet frei |
|---|---|
| Spielerfotos (16×) | Duotone-Pipeline liegt bereit — Karten werden sofort zum Sammelalbum; Story-Share gewinnt massiv |
| fussball.de-Vereins-ID | Live-Tabelle statt ehrlicher Demo (Widget eingebaut) |
| Streaming-Links | „Spotify/Apple · bald"-Pills werden echte Links (im Partyraum) |
| Echte Trainingszeiten | Di/Do 19 Uhr ist Platzhalter — 1 Zeile in `club.ts` |
| Domain | Canonical, OG, sitemap.xml, robots.txt sind vorbereitet (PLATZHALTER markiert) |
| GitHub-Remote | Repo ist committet, kein Remote konfiguriert — Push ausstehend |
| 1949-Bestätigung | Gründungsjahr aus Logo-Beleg — einmal im Verein gegenprüfen |
| Optional: Partyraum-Fotos, CC0-Stadion-Ambience | Raum-Detailtreue; Atmo-Slot ist austauschbar gebaut |

## 6 · Deployment-Empfehlung: Netlify

`npm run build` erzeugt `dist/` inklusive Prerender — statisch, kein Server.
1. Repo zu GitHub pushen (Remote fehlt noch, s. o.).
2. Netlify: „Import from Git" → Build `npm run build`, Publish `dist`.
3. Danach Domain eintragen und die drei PLATZHALTER ersetzen
   (`index.html` Canonical/OG, `public/sitemap.xml`, `public/robots.txt`).
4. Audio (27 MB MP3s) liegt in `public/` und streamt erst bei Play —
   kein Einfluss auf den kritischen Ladepfad.

*Gebaut mit Herz, Platzhalter ehrlich markiert.*
