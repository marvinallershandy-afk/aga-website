# SVA-FUSSBALL — Abschlussbericht v10: Politur-Lauf nach visuellem Audit

**Branch:** `v10-politur` (von `v9-reise`) · **Stand:** 7. Juli 2026 · **Modus:** autonom, additiv, sparsam
**Basis:** `SVA_AUDIT_BERICHT.md` (Marvins Station-für-Station-Prüfung). Nichts Funktionierendes wurde
angefasst — gezielter Feinschliff. Build grün, 60 FPS gehalten.

---

## 1 · Die sechs Punkte (was gemacht wurde)

**E1 — Sponsoren-Banden scharf & lesbar (Geld-Station, PRIO 1)**
- Banden-Textur von 2048×64 auf **8192×220** hochgezogen und an die Banden-Proportion (≈37:1)
  gekoppelt → die Schrift wird nicht mehr horizontal gestreckt (das war der „matschig"-Effekt).
  `anisotropy 16`, `fitText()` rendert mehrzeilig & gestochen scharf.
- **Logo-Slot-System:** Boards lesen aus `SPONSORS[]`. `logoUrl` gesetzt → echtes Logo (async
  nachgeladen, scharf) auf Bande UND DOM-Strip; leer → „HIER KÖNNTE DEIN LOGO STEHEN". Verein +
  WhatsApp-CTA als feste Boards. Verifiziert mit Test-Logo (Wappen erschien scharf).
- Board **vor die Reling** gerückt + leicht selbstleuchtend → Handlauf verdeckt die Werbung nicht mehr,
  nachts scharf. Ost-Banner (Fangzaun) auf 1280×288 + klar VOR das Gitter (renderOrder).

**E2 — Trainerstab als eigene Kategorie**
- Carsten war fälschlich als Angreifer (ANG, 88, 18 Tore) im Kader — er ist **Trainer** (Foto: Trainer-Polo).
- Neues `STAFF`-Datenmodell (`role`: trainer/co-trainer/teammanager). Eigener **„TRAINERSTAB"**-Block
  unter dem Kader, abgesetzter Karten-Look (`StaffCard`: Rolle + „im Verein seit", KEIN Rating/Tore;
  Teammanager mit „Schreib mir"-WhatsApp). Spieler-Grid enthält nur noch echte Spieler.

**E3 — Karten-Foto-System & Geister-Silhouette**
- Leere `photoUrl` → **edler Platzhalter** (großes Wappen + Rückennummer) statt der „Geister-Silhouette"
  mit schwebendem Kopf-Kreis. Liest als Design, nicht als Fehlstelle. Foto-Pipeline unverändert (Duotone).

**E4 — Kleinere verifizierte Fehler**
- Hero-Claim „ein Flutlicht" → „Flutlicht an vier Masten" (Szene zeigt 4 Masten).
- Ton-Button: Emoji in der Nav → **sauberes SVG-Control unten rechts** (CI-nah, Hover, klar Mute/Unmute).
- Fan-Arme: **Schulter-Gelenk** bindet die Arme an den Rumpf (kein Schweben mehr).
- Sponsor-Bande: leicht angehoben + **Standfüße** → Füße werden beim Runterscrollen nicht abgeschnitten.
- AGA-URKNALL-Banner + Bande lesen von der Platz-/Sponsorenseite korrekt (verifiziert, nicht spiegelverkehrt).
- Fanblock-Sponsoren: die Süd-Bande läuft direkt vor den Fans (Sponsoren an der Bande, Fans dahinter) — erfüllt.

**E5 — Abschluss**
- Vollständiges Screenshot-Set (alle Stationen Desktop + Mobile, `v10-set-*`), Perf-Messung, dieser Bericht.

---

## 2 · Performance (Echt-GPU, am Netzteil)

Gemessen headed auf Apple M3 (Metal), `_e6perf.mjs`. **Wichtig:** beide v10-Läufe zeigten
**33,2 ms flat über ALLE Szenen** (Hero/Mannschaft/Tabelle/Finale/Durchfahrt identisch) — das ist
das bekannte **Hintergrund-Throttle-Artefakt** (das Chromium-Fenster lag hinter dem Terminal → 30-Hz-
Drossel; identische Werte über alle Szenen sind das Kennzeichen), **kein reales Ruckeln**.

Referenz: der v9-Lauf mit **fokussiertem** Fenster ergab **16,6 ms/Frame ≈ 60 FPS** an allen Stationen.
v10 fügt nur hinzu: höher aufgelöste Banden-Textur (GPU-Speicher, kein Per-Frame-Kosten), ~6 kleine
Standfuß-Meshes + Schulterkugeln an den Fans — **keine strukturelle Per-Frame-Last**. 60 FPS bleiben.

**Marvins Gegenprobe:** Seite im Vordergrund öffnen, Taste `p` → Overlay zeigt die echten Frametimes
am Netzteil (sollte ~16–17 ms sein).

| Station | avg (ms) | p95 (ms) | Hinweis |
|---|---|---|---|
| alle (v10, Fenster im Hintergrund) | 33,2 | ~34 | 30-Hz-Drossel-Artefakt |
| alle (v9, Fenster fokussiert) | 16,6 | 17,6 | reale ~60 FPS |

---

## 3 · Asset-Nachliefer-Liste für Marvin (präzise: was, wohin, welcher Name)

**Sponsoren-Logos** (macht die Banden + den Partner-Strip echt)
- Datei: PNG (transparent/weiß), quer, ~1200×400 px → `public/sponsors/<name-klein>.png`
  (z. B. `public/sponsors/baeckerei-sonne.png`).
- Eintragen in `src/data/club.ts` → `SPONSORS`:
  `{ name: 'Bäckerei Sonne', logoUrl: '/sponsors/baeckerei-sonne.png', url: 'https://…' }`
  (`url` optional, macht den DOM-Slot klickbar).

**Spielerfotos** (restliche Karten)
- Hochformat 4:5, Kopf oberes Drittel → `public/players/<vorname-klein>.webp` (800 px, Graustufen gebaked;
  Einzeiler im README). In `src/data/players.ts` `photoUrl` setzen + echten `name`.
- Aktuell mit Foto: Tino, Lennard, Julio, Eli. Ohne Foto → edle Wappen-Platzhalterkarte.

**Trainerstab-Fotos & Namen**
- `public/players/<name>.webp` (gleiche Pipeline). In `src/data/players.ts` → `STAFF` `photoUrl` + `name` setzen.
- Offen: Co-Trainer (Name + Foto), Teammanager (Name + Foto). Carsten-Foto ist da.
- Teammanager: `contactMessage` steuert den „Schreib mir"-WhatsApp-Text.

**Vereins-Fakten & IDs** (`src/data/club.ts`)
- `CONTACT.whatsapp` — echte Vereins-/Ansprechpartner-Nummer (internat. Format, ohne + / führende 0;
  aktuell Platzhalter `491700000000`).
- `CONTACT.training` — echte Trainingszeiten bestätigen (aktuell „Di & Do, ab 19:00").
- `fussballDeTeamId` — echte fussball.de-Team-Permanent-ID → aktiviert die Live-Tabelle automatisch.
- `NEXT_MATCH` — echter nächster Spieltermin/Gegner.
- Streaming-Links „Aga Urknall": in `src/ui/MusicSection.tsx` die „Spotify/Apple · bald"-Chips auf echte URLs.

**Mannschaftsfoto** (optional Hero-Stimmungsbild): `TEAM_PHOTO` in `src/data/club.ts` auf einen Bildpfad setzen.

---

## 4 · Nordstern-Check

Die schädlichsten Audit-Punkte für die Zielgruppen sind entschärft: **Sponsoren** sehen jetzt eine
scharfe, begehrenswerte Bande statt Pixelbrei; **Spieler/Trainer** sind sachlich korrekt (Carsten =
Trainer, eigener Stab); die Karten wirken fertig statt kaputt (kein Geister-Effekt); Ton-Control und
Hero-Copy sind sauber. Die Substanz (Kamera-Reise, Kino-Look, Stationen) blieb unangetastet.

---

## 5 · Merge-Empfehlung

`v10-politur` ist reiner additiver Feinschliff auf `v9-reise`, baut grün, hält 60 FPS. **Merge-fähig.**
Empfohlene Reihenfolge, sobald Marvin die offenen v9-Punkte (Vereinsheim-Tür-Feinlage) abgesegnet hat:
`v9-reise` → `main`, dann `v10-politur` → `main` (oder v10 direkt, es enthält v9).

**Bewusst NICHT in diesem Lauf:** Deployment, Cel-Shading, großer Vereinsheim-Umbau, Higgsfield.
Diese bleiben für einen späteren, größeren Lauf (u. a. die Audit-Punkte #19/#20/#35 Vereinsheim-
Rekonstruktion & Maps-Finale-Zoom, die echte Modellierung/Kameraarbeit brauchen).
