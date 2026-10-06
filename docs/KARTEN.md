# SVA-Sammelkarten (v20-K · v22-A)

Ein Kartensystem für alles: das Sammelalbum (`/album`), die Spielerkarten der Website (Galerie,
Modal, 3D-Rundgang, Story-Teilen), Instagram-Content und — über einen eigenen Adapter — die
Tipp-Liga. Code: `src/karten/`. Gestaltung nach `docs/DESIGN.md` (Rot/Schwarz/warmes Weiß, Gold nur
für Rückennummer, Kapitän und Meister, Anton + Archivo).

> **Grundsatz:** Seltenheit bewertet nie einen Spieler. Jeder Spieler hat eine Basis-Karte
> („Kader“), Gold-Basis nur für objektive Rollen (Kapitän, Trainerstab). Silber-Glanz sind
> Varianten (Sammelstücke), Spezial sind Momente und limitierte Karten. Keine Ratings.

## 0. Das Karten-Konzept (v22) — was zählt und warum

Fünf Arten von „selten“, jede mit genau einer Aufgabe. Nur die erste entscheidet, ob ein Album voll ist.

| Ebene | Was ist das? | Zählt fürs Album? | Warum so? |
|---|---|---|---|
| **Basis** („Kader“, Bronze; Gold nur Kapitän + Trainerstab) | eine Karte je Person, Moment, Kurve-Karte, Partner = **ein Album-Platz** | **ja** — nur sie | **Fairness/Vollständigkeit:** Jeder kann das Album mit Dabeisein füllen. Die erste Karte jedes Zufalls-Packs fehlt garantiert noch (Smart-Pack), dazu Doppelten-Bremse, Tausch, Wunschkarte. |
| **Glanz** (Silber-Glanz-Variante) | die schönere Fassung **derselben Person** | nein (Zusatz-Sammelstück am selben Platz) | **Seltenheit bewertet nie einen Spieler:** Niemand ist „Gold wert“ und ein anderer „Bronze“ — selten ist nur die Fassung, nie der Mensch. |
| **Spezial** (Momente, limitierte Karten: Spieler des Spiels, Derby, Weihnachten) | Momente der Saison bzw. zeitlich begrenzte Karten | Momente ja (Platz); **limitierte** nein (Bonus-Seite) | **Momente & Aktualität:** Gründe, diese Woche vorbeizuschauen — ohne dass jemand, der eine Woche fehlt, sein Album nie voll bekommt. |
| **Shiny** (v22) | extrem seltene Schwarz-Gold-Fassung einer Spieler-/Trainer-Karte, **1 : 250 je gezogener Karte** | **nein** — eigene Shiny-Vitrine | **Reines Sammler-Glück:** kein Vorteil, kein Druck, nichts zu kaufen — nur ein Moment zum Herzeigen. Wer eine Person als Erste(r) findet, wird verewigt („Erstfund von Lena B. am 12.10.2026“). |
| **Geheimkarten** (v22) | 4 Karten, die man **nur durch Entdecken** bekommt (Easter Eggs) | **nein** — Geheime Seite mit „???“ + Rätsel | **Entdecken & Content:** Gesprächsstoff in der Kurve und auf Instagram („Hat schon wer den Platzwart?“), belohnt Neugier auf Website und Rundgang. |

**Wahrscheinlichkeiten (Standard, alles im Admin einstellbar):**

| Ereignis | Chance |
|---|---|
| Seltenheit je Karte | Kader 70 % · Silber 22 % · Gold 7 % · Spezial 1 % (nur Stufen mit ziehbaren Karten, Rest neu verteilt) |
| Shiny je gezogener Spieler-/Trainer-Karte | 1 : 250 = 0,4 % (Momente/Kurve/Partner/limitierte Karten: nie) |
| Shiny je Check-in-Pack (3 Karten, ~⅔ davon Personen) | ≈ 0,8 % |
| Mind. 1 Shiny in der Restsaison | Gelegenheits-Follower 8 % · typischer Follower 10 % · Stammfan 18 % |
| Shinys je 100 aktive Fans (50 / 35 / 15 % Mix) | ≈ 11 pro Saison — bei 27 Personen ist fast jeder Fund ein Erstfund |
| Geheimkarten | nie gezogen; je Fan genau einmal, nur über das jeweilige Easter Egg |

**Simulationsergebnis** (`node scripts/karten-simulation.mjs`, 10 000 Läufe je Persona, Restsaison ab 06.10.2026,
44 Album-Plätze; v22 rechnet Shiny mit und ändert an der Ziehung nichts — die Album-Werte sind dieselben wie in v20):

| Persona | Ø Karten | Ø Album % | komplett | Ø Personenkarten | Shiny ≥ 1 | Ø Shinys |
|---|---|---|---|---|---|---|
| Gelegenheits-Follower | 31,5 | 59,4 | 0,3 % | 20,9 | 8,1 % | 0,085 |
| Typischer Follower | 38,9 | 69,4 | 3,0 % | 26,1 | 9,7 % | 0,103 |
| Stammfan | 75,3 | 99,0 | 90,0 % (Ø April) | 48,6 | 17,7 % | 0,194 |

Gestaltung Shiny: Schwarz-Gold-Inversion (tiefschwarzer Körper, Guilloche in Gold, Freisteller gold getont wie
eine Statue), Sternenstaub, langsamer Goldschimmer, „SHINY“-Prägung senkrecht am Rand; auf der Rückseite der
Erstfund. Bewusste Ausnahme von „Gold nur für Rückennummer/Kapitän/Meister“ (docs/DESIGN.md §8): Shiny ist die
einzige Karte, die ganz golden sein darf. Geheimkarten: typografisch (Graphit + Goldfaden, „GEHEIMKARTE“), der
Platzwart mit der Nacht-Luftbild-Illustration des Waldsportplatzes (`/album/karten/geheim-platzwart.webp`).

## 1. Bausteine (`src/karten/`)

| Datei | Zweck |
|---|---|
| `typen.ts` | `KartenDaten` — das neutrale Kartenformat (Art, Seltenheit, Titel, Bilder, Serie, Credit, Werte …) |
| `adapter.ts` | `vonSpieler(player)`, `vonStab(staff)`, `vonAlbumKarte(karte, {nr, gesamt, saison})` — Bilder **nur** über `playerMedia()` |
| `SvaKarte.tsx` + `karten.css` | **die Karte** (DOM/CSS-3D): Vorder-/Rückseite, Material, Holo-Neigung, lebende Karte |
| `Ruecken.tsx` | neutraler Kartenrücken (verdeckt im Pack) |
| `geometrie.ts` | Schild-Form, Rahmen, Lage aller Elemente — eine Quelle für DOM **und** Canvas |
| `zeichnen.ts` | Canvas-Renderer (gleiches Design) für Story, Reel, 3D-Textur |
| `muster.ts` | Material-Muster als SVG (Guilloche, Bürstung, Funkeln, Rauten) + Seltenheits-Symbole |
| `medien.ts`, `gyro.ts` | Modul-Caches (Bilder, Freisteller-Messung, Schriften), Haptik, Gyro-Neigung (iOS-Erlaubnis per Tipp) |
| `export/bild.ts` | Story „Neue Karte im Album“, „Zeig deinen Pull“ (1080×1920 PNG), Teilen/Download |
| `export/video.ts` | Pack-Opening-Reel (1080×1920, 7 s, MP4/WebM per MediaRecorder) |

### `<SvaKarte />` — öffentliche Komponente (auch für die Tipp-Liga)

```tsx
import { SvaKarte } from '../karten/SvaKarte'
import { vonSpieler } from '../karten/adapter'

<SvaKarte daten={vonSpieler(player)} />                         // Raster, ruhig
<SvaKarte daten={d} stufe="gross" interaktiv lebend />           // Bühne: Holo-Neigung, Video-Loop
<SvaKarte daten={d} seite={gedreht ? 'hinten' : 'vorne'} />      // mit Rückseite, Dreh 0,8 s
```

| Prop | Bedeutung |
|---|---|
| `daten` | `KartenDaten` (über einen Adapter erzeugen; eigene Adapter z. B. `src/tippen/…` bauen einfach `KartenDaten`) |
| `seite` | `'vorne' \| 'hinten'` — rendert die Rückseite mit und dreht bei Wechsel |
| `interaktiv` | Zeiger- + Gyro-Neigung mit Glanz (nur für **eine** große Karte gleichzeitig) |
| `lebend` | Greenscreen-Loop statt Standbild, wenn vorhanden (fällt bei Fehler aufs Bild zurück) |
| `stufe` | `klein` (Raster: ohne Folien-Ebenen, 640er-Freisteller) · `normal` · `gross` |
| `aufdecken` | einmaliger Licht-Streif über die Folie (Aufdecken, Einkleben) |
| `eager`, `onClick`, `className`, `style`, `ariaLabel` | wie üblich |

Die Größe bestimmt der Container (Breite; Höhe = 1,4 × Breite). Alle Maße sind `cqw` →
die Karte skaliert von 60 px bis Vollbild. CSS kommt mit der Komponente.

## 2. Gestaltung

**Form:** Wappen-Schild — oben angeschrägte Ecken, unten flache Spitze (100 × 140 u).
**Material je Seltenheit** (echte Unterschiede, nicht nur die Rahmenfarbe):

| Seltenheit | Körper | Rahmen | Folie (bewegt sich mit Neigung) |
|---|---|---|---|
| Kader (Bronze) | mattes Schwarz-Rot, Blindprägung des Wappens, feines Rautenraster | Rot | zarter Lichtschimmer |
| Silber | Graphit, gebürstetes Metall, diagonale Lichtbahnen, Rückennummer als Prägung | Silberband | kühler Metallglanz |
| Gold | Schwarz mit Guilloche-Gravur (Rosette + Wellenlinien) | Goldband | warmer Goldglanz |
| Spezial | lebender Hintergrund (Licht dreht sich langsam, Strahlen) | Holo | Regenbogen-Folie + Funkeln (color-dodge) |

**Kartenarten:**
- **Spieler:** Freisteller groß, rechts der Mitte, Kopf ragt leicht über die Rahmenlinie
  (Parallaxe gegen das Licht), Rückennummer gold + Position + Wappen links, Kapitän-„C“,
  Vorname klein / NACHNAME groß, Position · Kapitän, Kartennummer „017/042“, Symbol, Saison.
- **Trainerstab:** Rolle senkrecht in Rot statt Nummer, Gold-Basis.
- **Moment / Kurve:** Foto im Fenster (Querformat sauber ins Hochformat über `bild_fokus`),
  Serie oben („Meister 2026“ in Gold), Titel groß, Credit senkrecht am Rand
  („Foto: picture by Nele“ — Pflicht). v21-A: Fotos liegen als Ausschnitt im Format des
  Foto-Fensters (100 : 106,4) unter `/album/karten/<name>.webp` (1080 px, ≤ 200 KB) +
  `-640.webp`; erzeugt mit `node scripts/karten-fotos.mjs`. Kurve-Karten haben **immer** ein
  Foto — fehlt `bild_url`, springt `/album/karten/kurve.webp` ein (`adapter.ts`, `KURVE_ERSATZ`).
- **Partner:** Logo auf warm-weißer Tafel (wie die Bande), Name, „Partner seit 2024“ (aus
  `sm_sponsoren.laufzeit_von`). Ohne Logo: typografisch.
- **Rückseite** (alle): Wappen, „Sammelkarte · Saison 2026/27“, Art/Position, Titel, sachliche
  Werte (Position, Rückennummer, im Verein seit, Tore/Vorlagen der Saison aus dem Ticker,
  Serie, präsentiert von), Steckbrief-Text (`rueckseite`), Kartennummer, Seltenheit, Credit.
- **Seltenheits-Symbol:** 1/2/3 Balken (Kader/Silber/Gold), Stern (Spezial). Tags: „Glanz“,
  „Limitiert“, „Neu“ (Neuzugang).

## 3. Animationen (alles transform/opacity, `prefers-reduced-motion` = ruhig)

- **Pack öffnen** (`src/album/PackOpening.tsx`, `pack.css`): Pack schwebt, Folie glänzt. Über
  die Lasche **wischen** → sie reißt mit dem Finger auf (Haptik-Ticks), durch den Spalt leuchtet
  das Licht der **besten** Karte. Karten steigen verdeckt heraus. Je Karte baut sich Licht in
  Seltenheitsfarbe auf; **Gold/Spezial = Walkout:** Bühne dunkel, Lichtblitz, Strahlen,
  Kamerafahrt (Karte fliegt aus der Tiefe heran und dreht sich), Hinweise blenden ein
  (Position → Nummer bzw. Serie), dann dreht sie. Beste Karte zuletzt, „Alle zeigen“ springt.
  Übersicht mit Neu-Badges, Doppelte als Stapel ×n, erreichte Ziele/Kapitel, „Ins Album
  einkleben“, „Zeig deinen Pull“. Haptik über `navigator.vibrate` (Android).
- **Einkleben:** Das Album blättert zur Seite, die Karte fliegt mit leichter 3D-Drehung in
  ihren Platz, wird angedrückt, Licht-Streif, Kapitel-Zähler rollt hoch.
- **Album als Buch** (`Heft.tsx`, `heft.css`): Handy eine Seite, Desktop Doppelseite. Umblättern
  ist ein echtes Blatt, das sich um den Rücken dreht und dem Finger folgt (Wischen), sonst
  Pfeiltasten, Reiter, Knöpfe.
- **Fortschritt:** Gesamtbalken mit Meilenstein-Kerben 10/25/50/75/100 %, Kapitel-Balken,
  Abzeichen-Stempel bei komplettem Kapitel, Zähler rollen hoch, Glanz läuft über den Balken,
  „Nächstes Ziel“-Leiste oben, wartende Packs als Fach unten.
- **Holo-Neigung:** Maus am Desktop; Handy per Gyro — iOS fragt nach einem Tipp auf die Karte
  bzw. „Mit dem Handy neigen“ (Detailansicht).

## 4. Katalog pflegen (Admin → Album)

| Tab | Was |
|---|---|
| **Woche** | Wochen-Checkliste mit Direkt-Knöpfen (siehe 6.) |
| **Karten** | „Standard-Katalog anlegen“ (Spieler-Basis + Silber-Glanz, Trainerstab, 8 Momente, Kurve, Partner), „Neue Karte“ mit **Live-Vorschau** (Vorder-/Rückseite), Foto-Upload mit Fokus-Klick, Credit, Serie, „präsentiert von“, Glanz/Limitiert, Zeitfenster, Derby-Spiel. Je Karte **Story-Bild** und **Reel** |
| **Ziele** | Sammelziele aus Vorlagen: Familie (Personen), Set (Karten), Kapitel, Serie, Sozial, Tipp-Liga, Wochen-Challenge, Meilenstein; Belohnung (Karten, Mindest-Seltenheit, Lose), geheim, Zeitraum; „Zuletzt erreicht“ |
| **Codes** | Story-Code (24 h), Partner-Code (liefert die Partnerkarte), Massen-Erzeugung (je Tag ein Code), Adventskalender (24 Codes, 24.12. = Weihnachtskarte) |
| **Verlosungen** | Verlosung anlegen (Preis-Vorlagen, Bild, Partner, Stichtag, Mindest-Lose), **Ziehen + Glücksrad** (Vollbild, zum Abfilmen; Ergebnis steht vorher fest und ist protokolliert) |
| **Regeln** | Chancen, Packgrößen je Quelle, Smart-Pack, Schwellen 3/6/8, Tausch/Wunschkarte, Lose, Teilnahmebedingungen |

**Neue Karte anlegen:** Art + Seltenheit wählen → bei Spieler/Trainer die Person (Bild kommt
automatisch), bei Partner den Sponsor (Logo + „Partner seit“ kommen aus Admin → Partner) →
Titel/Untertitel/Serie → bei Moment/Kurve Foto hochladen, ins Bild klicken für den Ausschnitt,
Credit prüfen → Speichern. Die Vorschau rechts ist die echte Karte.

**Partner-Karten (verkaufbare Leistung „Deine Firma als Sammelkarte“):** Logo in Admin → Partner
hochladen (die Logo-Aufbereitung der Bande trimmt Ränder), Laufzeit-Beginn eintragen → „Standard-
Katalog anlegen“ legt je aktivem Partner die Karte an (Bronze, früh im Album). Partner-Codes für
den Laden unter Codes. „Präsentiert von“ geht auf jeder Karte (z. B. Meister-Momente).

**Fotos (picture by Nele):** keine erkennbaren Kinder, kein Alkohol im Fokus, Credit Pflicht.
Standard-Momente liegen in `public/karten/` (`node scripts/karten-fotos.mjs` erzeugt 1400er +
640er aus den Vereinsfotos).

## 5. Greenscreen und lebende Karten

Die Karten fragen Bilder **nur** über `playerMedia(id)` (`src/data/playerMedia.ts`):
Greenscreen-`card.webp` → HD-Freisteller → Foto. Sobald nach dem Dreh
`node scripts/greenscreen/build.mjs` gelaufen ist und `src/data/greenscreen.ts` Einträge hat,
zeigen **alle** Karten (Album, Galerie, Modal, Story, 3D-Rundgang) automatisch die neuen
Freisteller. Hat ein Spieler einen `pose-loop`, wird die große Karte (`lebend`) zur **lebenden
Karte**: Video mit Alpha (HEVC für Safari/iOS, VP9 sonst), Kopf auf derselben Höhe wie beim
Standbild, Fehler → Standbild. Im Raster und bei reduzierter Bewegung bleibt das Standbild.
Nichts in `src/karten/` muss dafür geändert werden.

## 6. Wöchentlicher Ablauf in 2 Minuten (Admin → Album → Woche)

| Tag | Aufgabe | Klicks |
|---|---|---|
| **So** | Spielbericht: Ergebnis, Torschützen, **Spieler des Spiels** unter Spiele/Live eintragen | Heimsieg-Bonus geht automatisch raus |
| **Mo** | **„MOTM-Karte veröffentlichen“** — erzeugt die limitierte Spezialkarte „MOTM · n. Spieltag · Gegner“ (Bild über playerMedia), ziehbar Mo 00:00 bis So 23:59, **und** lädt Story-Bild + Reel herunter | 1 |
| **Fr** | „Code für Freitag erzeugen“ → Code ist kopiert → in die Story | 1 |
| **Sa** | Story „Noch nicht getippt?“ + Album-Teaser posten, Haken setzen | 1 |
| Dez. | Einmal „Kalender anlegen“ (Codes) — jeden Tag den Code des Tages posten | — |

Haken setzen sich von selbst, sobald etwas erledigt ist.

## 7. Instagram

- **Admin, je Karte:** „Story-Bild“ (PNG 1080×1920, „Neue Karte im Album“) und „Reel“ (7 s,
  1080×1920, MP4 wo der Browser es aufnimmt, sonst WebM) — läuft im Browser, kein Server.
- **Fan:** nach dem Pack „Zeig deinen Pull“ (beste Karte groß, zwei gefächert, „Lena B. hat
  gezogen“), in der Detailansicht „Karte teilen“. Teilen per Share-Sheet, sonst Download.

## 8. Prüfen

- `npx tsc -b`, `npx vite build`
- PGlite-Tests: siehe unten (Ökonomie).
- Messwerte v20-K (Headless-Chromium, Metal-GPU, M3; Handy-Profil 390×844, DPR 1): Pack-Öffnen
  (Reißen + 4 Karten inkl. 2 Walkouts) p95 18,2 ms — die Leerlauf-Basis derselben Messung liegt
  bei 17,8–18,4 ms (Taktungsrauschen der Headless-Umgebung); auf Vsync gerundet p95 16,7 ms, keine
  Frames > 25 ms. Album (8× Umblättern, Scrollen) p95 18,1–18,3 ms, gerundet 16,7 ms. Mit 4×
  CPU-Drossel weiterhin p95(vsync) 16,7 ms. 3D-Rundgang alt (v14) vs. neu: p95 17,9 vs. 18,2 ms
  (Desktop) bzw. 18,5 vs. 18,0 ms (Handy), lange Frames 6 → 3 (Texturen werden im Leerlauf gezeichnet).

## Ökonomie & Ziehung

Stand v20-K. Datenbank: `supabase/migrations/20261012110000_sva_karten.sql` (additiv, idempotent,
nach `20261011110000_sva_am_platz.sql` anwenden). Tests (PGlite, nie gegen die echte DB):
`supabase/tests/karten.test.mjs`, `supabase/tests/ziele.test.mjs`, `supabase/tests/album.test.mjs`.
Simulation: `node scripts/karten-simulation.mjs` (muss zur Migration passen). Die Ziehung passiert
immer in der Datenbank, nie im Browser. Alle Werte stehen in `sva_album_einstellungen` und sind im
Admin einstellbar.

### Grundsätze

- **Seltenheit bewertet nie einen Spieler.** Jeder Spieler hat genau eine **Basis-Karte**, die
  seinen Album-Platz füllt (Bronze; Gold nur für objektive Rollen: Kapitän, Trainerstab).
- **Silber-Glanz-Varianten** (`variante = true`, je Spieler eine) sind Zusatz-Sammelstücke. Sie
  füllen keinen Platz, zählen nicht fürs Album, nicht für Kapitel und nicht für Sets.
- **Limitierte Karten** (`limitiert = true`) liegen auf einer **Bonus-Seite** und zählen ebenfalls
  nicht: „Spieler des Spiels“ (Spezial, nur in der Woche des Spieltags ziehbar), **Derby-Karte**
  (`nur_spiel_id`, nur in Check-in-, Heimsieg- oder Freund-Packs dieses Spiels), **Weihnachtskarte**
  (nur über den Adventskalender). Eine limitierte Karte ohne Zeitfenster und ohne Spiel wird nie
  zufällig gezogen, sondern nur über einen Code mit `karte_id` vergeben.
- **Album-Platz** = `roster_id` bei Personen (Spieler, Trainerstab), sonst die Karten-ID.
  „Album %“ = belegte Plätze / alle Plätze der Saison.
- **Kapitel:** TW, ABW, MIT, ANG (Spieler nach Position wie im Katalog), `stab` (Trainerstab),
  `moment`, `fan` („Kurve“), `partner`.

### Standard-Katalog v20 (`album_admin_katalog_standard()`)

| Bereich | Karten | Seltenheit | Album-Platz |
|---|---|---|---|
| Spieler (24) | je 1 Basis | Bronze, Kapitän Gold | ja |
| Silber-Glanz (24) | je Spieler 1 Variante | Silber | nein |
| Trainerstab (3) | je 1 Basis | Gold | ja |
| Momente „Meister 2026“ | Die Meister-Elf · Meister-Shirt · Ab in die Kurve · Die Umarmung | Spezial · Gold · Gold · Silber | ja |
| Momente „Urknall-Pokal 2026“ | Der Pokal · Siegerfoto · Einer fliegt · Die Parade | Spezial · Gold · Gold · Silber | ja |
| Kurve | Die Kurve · Die Fahne · Das Urknall-Banner | Silber · Bronze · Silber | ja |
| Partner | je aktivem Sponsor 1 | Bronze | ja |

Bei 6 Partnern sind das **44 Album-Plätze**. Momente tragen `serie`, `credit = 'picture by Nele'`,
`bild_url` unter `/album/karten/…` und `bild_fokus = '50% 50%'`. Bestehende Karten werden nie verdoppelt.

**v21-A (Migration `20261013200000_sva_album_v21.sql`):** „Dodos Raum“ (kein Foto zu bekommen) heißt
jetzt **„Das Urknall-Banner“** — gleiche Karten-ID, Besitz bleibt. Alle Moment- und Kurve-Karten
zeigen auf die neuen Ausschnitte; Kurve-Karten haben Credit + Rückseiten-Text. Nachziehen einer
bestehenden DB: Die Migration ruft `sva_album_v21_nachziehen()` selbst auf; erneut als Admin:
Admin → Album → Karten → „Standard-Katalog anlegen“ (zieht mit nach) oder `select album_admin_katalog_v21();` (idempotent, ändert nur Karten mit altem Standardbild bzw.
ohne Bild — eigene Admin-Uploads bleiben).

| Karte | Foto (picture by Nele) |
|---|---|
| Die Kurve | Fans hinter der Bande mit Bannern (Lauf zu den Fans, linker Ausschnitt) |
| Die Fahne | Schwarz-rote Fahne über dem Mannschaftskreis (Urknall-Pokal) |
| Das Urknall-Banner | „AGA Urknall est. 2024“ am Tornetz (ohne Personen im Ausschnitt) |
| Die Meister-Elf · Meister-Shirt · Ab in die Kurve · Die Umarmung | Meistertag 2026 |
| Der Pokal · Siegerfoto · Einer fliegt · Die Parade | Urknall-Pokal 2026 (Pokal: Jubel mit Pokal statt Einzelbild) |
Partner sind bewusst Bronze: so kleben sie früh im Album, und der Sponsor ist sofort sichtbar.

### Kartenquellen und Packgrößen

| Quelle | Pack-Art | Karten (Einstellung) | Hinweis |
|---|---|---|---|
| Starter (einmalig) | `starter` | 5 (`karten_starter`) | mind. 1 × Silber oder besser (`starter_min_silber`); Client ruft `album_starter_holen()` nach dem Profil |
| Check-in am Platz | `checkin` | 3 (`karten_pro_pack`) | QR-Code im Spielfenster |
| Heimsieg | `heimsieg` | 1 (`karten_heimsieg`) | für alle Eingecheckten, auch bei spätem Check-in |
| Freund-Bonus | `freund` | 1 (`karten_freund`) | beide checken beim selben Spiel ein; je Fan und Spiel höchstens einmal |
| Tipp-Liga | `tipp` | 1 (`karten_tipp`) | je abgegebenem Tipp, über `album_karte_gutschreiben` |
| Instagram-Story-Code | `story` | 1 (`karten_story`) | 24 h gültig, 1× pro Konto |
| Partner-Code im Laden | `partner` | 1 | liefert gezielt die Partnerkarte |
| Adventskalender | `advent` | 1 | 1.–24.12., je Tag ein Code; am 24.12. die Weihnachtskarte |
| Kapitel komplett | `kapitel` bzw. `ziel` | 1 (`karten_kapitel`) | plus Abzeichen; läuft über das Ziel „Kapitel komplett“, wenn es aktiv ist |
| Ziel/Mission erreicht | `ziel` | laut Ziel | siehe „Ziele“ |
| Wunschkarte | `wunsch` | 1 | gegen Doppelte |

Idempotenz: Packs mit Spiel-Bezug sind je (Fan, Spiel, Art) einmalig, alle anderen je
(Fan, Art, `quelle`): `'starter'`, Code-ID, `'tipp:<id>'`, `'<ziel-id>:<bezug>'`,
`'kapitel:<saison>:<kapitel>'`.

### Seltenheiten und Ziehung

Gewichte 70 / 22 / 7 / 1 (Bronze / Silber / Gold / Spezial). Nur Stufen mit ziehbaren Karten
nehmen teil, der Rest wird neu verteilt. **Ziehbar** ist eine Karte, wenn sie aktiv ist, zur Saison
passt, im Zeitfenster `ziehbar_von`/`ziehbar_bis` liegt und (bei Derby-Karten) das Pack zum Spiel gehört.

Je Karte gilt:
1. Seltenheit nach Gewicht ziehen.
2. **Smart-Pack** (nur erste Karte, `smart_pack`): eine **fehlende Album-Karte** dieser Stufe.
   Fehlend heißt: nicht im Besitz, nicht in einem ungeöffneten Pack und nicht schon in diesem Pack.
   Fehlt in der Stufe nichts mehr, wird die Stufe unter den Stufen mit fehlenden Karten neu nach
   Gewicht gezogen. Die erste Karte ist also garantiert neu, solange etwas fehlt, und Spezial
   bleibt trotzdem am seltensten.
3. **Doppelten-Bremse** (`doppelte_bremse`, Standard **25 %**, vorher 50): mit dieser
   Wahrscheinlichkeit eine Karte der Stufe, die der Fan noch nicht hat.
4. Sonst Zufall innerhalb der Stufe.

Belohnungs-Packs (Kapitel, Ziele) sind standardmäßig **nicht** smart (`smart_pack_belohnung = false`).
Sonst würde jede Belohnung eine neue Karte bringen, die die nächste Belohnung auslöst, und Stammfans
wären schon im Winter fertig. Mindest-Seltenheit (Starter, manche Ziele) ersetzt die letzte Karte
durch eine Karte der verlangten Stufe oder besser. Ein Test mit 4 000 Karten bei aktivem Smart-Pack
bleibt bei 70 / 22 / 7 / 1.

### Tausch und Wunschkarte

- **Tausch 1:1 per Link/Code:** `album_tausch_anbieten(biete, wunsch)` liefert einen Code mit 8 Zeichen,
  der 7 Tage gilt. Abgegeben werden nur echte Doppelte (`anzahl ≥ 2`), limitierte Karten sind nicht
  tauschbar. Beide Konten müssen mindestens `tausch_min_tage` = 7 Tage alt sein. Pro Fan gehen
  höchstens `tausch_pro_woche` = 5 Tausche in 7 Tagen (beim Anbieten zählen offene Angebote mit).
  Die Annahme läuft atomar mit Zeilensperren: Beide müssen zu diesem Zeitpunkt noch Doppelte haben.
- **Wunschkarte:** `wunsch_kosten` = 3 Doppelte ergeben 1 Wunschkarte, aber nur Basis-Karten in
  Bronze oder Silber (nie Variante, Spezial oder limitiert). Wer dieselbe Karte mehrfach nennt,
  braucht entsprechend viele Doppelte.

### Belohnungen, Ziele, Lose, Verlosungen

- **Gutscheine nur für Check-ins:** 3 → „Getränk nach Wahl“ · 6 → „Bratwurst + Getränk nach Wahl
  oder Fanartikel“ · 8 (`schwelle_3`, abschaltbar) → „Los für die Saison-Verlosung (alle
  Heimspiele)“. Album komplett (alle Spieler-Plätze) → Verlosungs-Los. `schwelle_3` und `komplett`
  sind am Stand **nicht** einlösbar (`grund: 'verlosung'`). Jugendschutz: es heißt „Getränk nach Wahl“.
- **Ziele/Missionen** (`sva_album_ziele`, `album_admin_ziele_standard()`, 30 Standard-Ziele):
  - Sets: Die Zwillinge (Pejas), Die Warkehr-Brüder, Vater & Sohn (Adolf + Tino Ebeling,
    Trainerstab zählt mit) und **Familie SVA** (alle Paare; 3 Karten, mind. Gold). Dazu Meister 2026
    (1 Karte, mind. Spezial), Rückennummern 1–11, Die Kurve und Partner-Set.
  - v21-A: **Die Rote Familie** (`rote_familie`, Set): Lennard Brettschneider, Noel Nauerz, Janek
    Brünjes — „Drei Mann, drei Platzverweise – sammle die Rote Familie“ (1 Karte, mind. Silber).
    Augenzwinkernd: Medaille in Rot mit roter Karte als Symbol. In bestehenden DBs legt die
    Migration v21 sie an (nur wenn die Standard-Ziele schon da sind).
  - Kapitel komplett (8 Kapitel) und Meilensteine 10 / 25 / 50 / 75 / 100 % (je 1 Karte plus
    1 / 1 / 2 / 3 / 5 Lose).
  - Dauerkarte: 3 Heimspiele mit Code in Folge, mind. Gold. Tipp-Serie: 4 ISO-Wochen in Folge.
    Erster Tausch und Freund geworben gelten jeweils für beide Seiten.
  - Extern (Tipp-Liga, wiederholbar): `tipp_exakt` (mind. Silber), `tipp_kapitaen_trifft` und
    `tipp_spieltagssieg` (2 Lose, keine Karte).
  - Geheime Mission „Nachteule“: Check-in bei Anstoß ab 19 Uhr.

  Familien-Sets legt der Admin selbst an (`vorlage = 'familie'`, `roster_ids`). Die Sets werden über
  Personen definiert, Trainerstab eingeschlossen. Einmalige Ziele gelten je Saison, wiederholbare
  je Bezug.
- **Lose** (`sva_album_lose`): 1 je Check-in (`lose_checkin`), 5 für Album komplett
  (`lose_komplett`), dazu Ziele und Meilensteine.
- **Verlosung** (`sva_album_verlosungen`, `album_admin_verlosung_ziehen`): Die Lose der Saison
  zählen bis zum Stichtag. Die Teilnehmer stehen in fester Reihenfolge (Profil-Anlage, Reihenfolge
  des Glücksrads). Die Los-Nummer ist SHA-256(Seed), davon die ersten 52 Bit, mod Lose gesamt.
  Das ist deterministisch, der Seed wird protokolliert, ohne Seed entsteht ein zufälliger. Ein
  zweites Ziehen ist gesperrt, und die Ergebnis-Felder lassen sich auch im Admin nicht nachträglich
  ändern. `teilnahme_text` enthält die Teilnahmebedingungen: kostenlos, kein Kauf nötig, ab 16 bzw.
  mit Einverständnis der Eltern, Alkohol-Preise nur ab 18, Benachrichtigung im Album, Veranstalter
  SV Agathenburg-Dollern, Rechtsweg ausgeschlossen.

### Anti-Schummel

- Codes gelten standardmäßig 24 h und sind 1× pro Konto einlösbar, optional mit
  `max_einloesungen`. Das Rate-Limit liegt bei `code_fehler_limit` = 10 Fehlversuchen pro Stunde.
  Ein Fehlversuch wird als `{ ok:false, grund }` zurückgegeben statt als Fehler, damit er nicht
  zurückgerollt wird und die Sperre greift.
- 1 Konto pro E-Mail (Supabase Auth), 1 Check-in pro Konto und Spiel, Tausch erst ab 7 Tagen
  Kontoalter, Wochenlimit.
- Fans haben keinen Tabellenzugriff, nur RPCs. Interne `sva_album_*`-Funktionen darf nur
  `service_role` ausführen.

### Beispielrechnung je Persona (`node scripts/karten-simulation.mjs`)

10 000 Läufe je Persona, Restsaison ab 06.10.2026: 17 Spieltage, 8 Heimspiele, Winterpause Dezember
bis Februar, Adventskalender im Dezember, Story-Codes etwa 1× pro Woche (nicht im Dezember),
44 Album-Plätze (6 Partner), Heimsieg-Quote 60 %, alle Standard-Ziele aktiv.

| Persona | Verhalten | Ø Karten | Ø Album % | Median | P10 | P90 | komplett | Ø fertig | Ø Doppelte | Ø Lose |
|---|---|---|---|---|---|---|---|---|---|---|
| Gelegenheits-Follower | 15 % der Heimspiele, 25 % Tipps, 20 % Story/Advent | 31,5 | 59,4 | 59,1 | 43,2 | 77,3 | 0,3 % | – | 2,6 | 5,2 |
| Typischer Follower | 25 % Heimspiele, 30 % Tipps, 20 % Story/Advent, ab und zu Freund dabei | 38,8 | 69,3 | 68,2 | 50,0 | 90,9 | 3,3 % | Mai | 4,8 | 7,2 |
| Stammfan | 75 % Heimspiele, 40 % Tipps, 15 % Story/Advent, Freund, Tausch, Wunschkarte | 75,4 | 99,0 | 100 | 100 | 100 | 90,1 % | April | 14,7 | 22,0 |

Zum Vergleich: Sind Belohnungs-Packs smart (`node scripts/karten-simulation.mjs 10000 6 1`), sind
Stammfans im Schnitt schon im Januar komplett, Gelegenheits-Follower kommen auf etwa 72 % und
typische Follower auf etwa 84 %. Mit `doppelte_bremse` = 50 liegt der typische Follower bei etwa 73 %.

### Tipp-Liga-Schnittstelle

`album_karte_gutschreiben(p_quelle text, p_bezug uuid) returns uuid` erlaubt nur `p_quelle = 'tipp'`
(sonst `album_quelle_unbekannt`). Der Fan ist `auth.uid()`. Ohne Album-Profil kommt `null` zurück.
Der Aufruf ist idempotent je Bezug (`quelle = 'tipp:<bezug>'`) und erzeugt ein Pack `tipp` mit
`karten_tipp` Karten. Danach wird die Tipp-Serie geprüft.
`album_ziel_ausloesen(p_schluessel text, p_bezug uuid) returns jsonb` gibt
`{ erreicht, packId, lose }` zurück und gilt nur für Ziele vom Typ `extern`. Bei wiederholbaren
Zielen ist der Bezug der Schlüssel, sonst gilt das Ziel einmal je Saison.
**EXECUTE haben beide nur für `service_role`**, Fans können sie nicht direkt aufrufen. Der Aufruf
kommt aus der SECURITY-DEFINER-RPC des Tipp-Pakets (deren Eigentümer darf ausführen):

```sql
-- Beispiel (Namen der Tipp-Tabelle/-RPC legt das Tipp-Paket fest)
create or replace function public.tipp_abgeben(p_spiel uuid, p_tore_sva int, p_tore_gegner int)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare v_tipp uuid; v_pack uuid;
begin
  insert into public.sva_tipps (fan_user_id, spiel_id, tore_sva, tore_gegner)
  values (auth.uid(), p_spiel, p_tore_sva, p_tore_gegner) returning id into v_tipp;
  v_pack := public.album_karte_gutschreiben('tipp', v_tipp);   -- null ohne Album-Profil
  return jsonb_build_object('ok', true, 'albumPackId', v_pack);
end $$;
-- bei der Auswertung, z. B. exakter Tipp:
--   perform public.album_ziel_ausloesen('tipp_exakt', v_tipp);
```

### RPCs (v20-K)

Fehler kommen als `raise 'album_…'`, außer bei `album_code_einloesen` (`{ ok:false, grund }`).

**Öffentlich (anon):** `album_katalog()` liefert je Karte zusätzlich `variante, limitiert, kapitel,
ziehbarVon, ziehbarBis, derby, derbySpiel{gegner,anstoss}, serie, credit, bildFokus, rueckseite,
praesentiertVon{name,logoUrl}`, `spieler.{seit, neuzugang, tore, vorlagen}` (Tore und Vorlagen der
Saison aus dem Ticker) und `partner.seit`. Die `regeln` enthalten zusätzlich `kartenStarter,
starterMinSilber, kartenHeimsieg, kartenTipp, kartenStory, kartenFreund, kartenKapitel, smartPack,
tauschMinTage, tauschProWoche, wunschKosten, loseCheckin, loseKomplett, teilnahmeText`, und
`belohnungen` hat bis zu 4 Einträge (`schwelle_3` mit `verlosung: true`).

**Fan (eingeloggt):**

| RPC | Antwort |
|---|---|
| `album_mein()` | wie bisher, dazu: `freundCode, freunde[name], abzeichen[kapitel], tausche[{code,biete,wunsch,status,eigen,partner,at,gueltigBis,erledigtAt}], tauscheWoche, kontoTage, starterOffen, advent[{tag,eingeloest}]` (nur 1.–31.12., sonst null), `ziele[{id,schluessel,typ,vorlage,titel,beschreibung,fortschritt,benoetigt,erreicht,erreichtAt,anzahlErreicht?,belohnung{karten,minSeltenheit,lose},gueltigBis,geheim}], naechstesZiel, lose, loseVerlauf[{anzahl,quelle,titel,at}], verlosungen[{id,titel,preis,bildUrl,partner,stichtag,status,minLose,gewinnerName,gezogenAt,gewonnen,teilnahme}]`; `packs[].titel`, `gutscheine[].verlosung` |
| `album_freund_code()` | `{ code }` (Ersatz, falls ein Altprofil keinen Code hat) |
| `album_starter_holen()` | `{ packId }` bzw. `{ packId: null }` |
| `album_checkin(token)` | wie bisher, dazu `freundPackId, freunde[name], ziele[…]` |
| `album_pack_oeffnen(pack)` | wie bisher, dazu `titel, kapitel[{kapitel,packId}], ziele[{zielId,schluessel,typ,kapitel,titel,packId,lose}]`, je Karte `variante, limitiert` |
| `album_gutschein_einloesen(gutschein)` | wie bisher; `schwelle_3`/`komplett` → `{ ok:false, grund:'verlosung' }` |
| `album_code_einloesen(code)` | `{ ok:true, packId, art, titel }` oder `{ ok:false, grund: ungueltig/noch_nicht/abgelaufen/schon/gesperrt/kein_profil }` |
| `album_freund_hinzufuegen(code)` | `{ ok:true, name }`; Fehler `album_freund_unbekannt`, `album_freund_selbst` |
| `album_tausch_anbieten(biete, wunsch)` | `{ code }`; Fehler `album_tausch_keine_doppelte`, `album_tausch_zu_neu`, `album_tausch_limit`, `album_tausch_karte` |
| `album_tausch_ansehen(code)` | `{ code, von, biete, wunsch, status, gueltigBis, eigen, kannAnnehmen, grund? }` mit `grund` aus `eigen`, `abgelaufen`, `erledigt`, `zurueckgezogen`, `kein_profil`, `zu_neu`, `limit`, `keine_doppelte`, `partner_keine_doppelte` |
| `album_tausch_annehmen(code)` | `{ ok:true, erhalten, abgegeben, kapitel, ziele, gutscheine }`; Fehler `…_unbekannt`, `…_eigen`, `…_abgelaufen`, `…_zu_neu`, `…_limit`, `…_keine_doppelte`, `…_partner` |
| `album_tausch_zurueckziehen(code)` | `{ ok:true }`; Fehler `album_tausch_unbekannt`, `album_tausch_nicht_offen` |
| `album_wunschkarte(karte, gegen uuid[])` | `{ packId }`; Fehler `album_wunsch_karte`, `album_wunsch_doppelte` |
| `album_konto_loeschen()` | wie bisher; löscht auch Freunde, Tausche, Code-Einlösungen und -Fehler, Abzeichen, Lose und Ziele. Ein gewonnener Preis bleibt im Protokoll nur mit Namen |

**Admin (`is_sm_admin()`, sonst `album_kein_admin`):**

| RPC | Antwort |
|---|---|
| `album_admin_katalog_standard()` | `{ saison, spielerBasis, varianten, trainer, momente, kurve, partner, albumPlaetze }` |
| `album_admin_story_code(art, titel, karte?, karten?, stunden=24, code?)` | `{ id, code, gueltigBis }` (art: `story`, `partner`, `advent`) |
| `album_admin_story_codes_massen(start date, tage, titel, karten=1)` | `[{ id, datum, code, gueltigVon, gueltigBis }]`, je Tag ein Code (Europe/Berlin) |
| `album_admin_advent(jahr, karte?)` | `[{ tag, code }]` × 24, idempotent; Tag 24 liefert die Karte |
| `album_admin_motm(roster, spiel?, bild?, tage?)` | `{ id, neu, ziehbarVon, ziehbarBis }`. Titel = Spielername, Untertitel „MOTM · 7. Spieltag · Gegner“, ziehbar Mo 00:00 bis So 23:59:59 der aktuellen Woche; idempotent je (Spieler, Spiel) |
| `album_admin_ziele_standard()` | `{ angelegt, gesamt, standard }` (v21: 30 inkl. Rote Familie) |
| `album_admin_katalog_v21()` | `{ saison, umbenannt, bilder, rueckseiten, roteFamilie }` — v21-Bilder/Umbenennung/Rote Familie nachziehen, idempotent |
| `album_admin_ziel_status(ziel?)` | `{ saison, ziele[{id,schluessel,typ,titel,aktiv,geheim,erreicht,fans}], erreicht[{ziel,titel,name,at,bezug,lose,pack}] }` |
| `album_admin_verlosung_ziehen(id, seed?)` | `{ gewinner{name,lose}, teilnehmer[{name,lose}], gewinnerIndex, seed, loseGesamt, losNummer }`; Fehler `album_verlosung_schon_gezogen`, `album_verlosung_keine_teilnehmer` |
| `album_admin_statistik()` | wie bisher, dazu `codesEingeloest, tauscheErledigt, starterGeholt, zieleErreicht, loseSaison` |

Verlosungen, Ziele und Codes pflegt der Admin direkt in den Tabellen (RLS: nur `is_sm_admin()`).
Das Ergebnis einer Verlosung setzt nur die Ziehungs-RPC.

## v21-A: Abzeichen als Medaillen, Tiefe, Login

- **Medaillen** (`src/album/Medaille.tsx`, `medaille-logik.ts`, `ziele.css`): erreichte Ziele als
  geprägtes Metall (Kupfer-Rot · Silber · Gold · Holo, Rote Familie in Rot) mit gerändeltem Rand,
  Licht folgt dem Zeiger, Glanz-Streif beim Zeigen. Offene Ziele = dunkler Rohling mit
  Fortschrittsring, der sich beim Hineinscrollen füllt. Neu erreichte Ziele werden beim ersten
  Sehen „geprägt“ (Freischalt-Animation; gemerkt in `localStorage['sva-album-ziele-gesehen']`).
  Sammel-Seite: „Deine Vitrine“ (Handy: wischen) + „Als Nächstes“ (6, dann alle) + geheime Mission.
- **Tiefe** (`tiefe.css`, `useKippen`): Album-Plätze, Medaillen und Cover neigen sich zum Zeiger
  (ein Listener je Raster, rAF, nur Maus/Stift), Licht-Blend auf der Karte. Touch bleibt ruhig.
- **Lose:** Ticket-Stapel (je mehr Lose, desto mehr Tickets), Zahl zählt hoch.
- **Kopf:** Umschalter „Album | Tipp-Liga“, rotes Tütchen-Abzeichen mit Puls (öffnet die Packs),
  Initiale + Vorname = angemeldet. Start-Seite: Kapitel-Zeilen blättern ins Kapitel.
- **Startseite (Karte):** Album-Kachel zeigt eingeloggten Fans „Angemeldet als Vorname · 3/42 ·
  1 Tütchen wartet“ (`src/album/fanStand.ts`, ohne Supabase-Bundle).
- **Login bleibt:** siehe docs/ALBUM.md → „Angemeldet bleiben“.
- Audit/Screenshots: `scripts/album-v21-audit.mjs` (Mocks, Handy + Desktop).

## v22-A: Shiny, Geheimkarten, Vorführung, Kartenlabor

Migration `supabase/migrations/20261014100000_sva_album_v22.sql` (nach `20261013200000_sva_album_v21.sql`,
additiv + idempotent, Sammlungen bleiben unverändert). Test: `supabase/tests/album_v22.test.mjs` (PGlite, 69 Prüfungen).

### Shiny (serverseitig)

- Trigger `sva_album_pack_shiny` auf `sva_album_packs` (BEFORE INSERT): je Karte `shiny[i] = random() * shiny_chance < 1`,
  nur für Spieler/Trainer mit Kaderbezug, nicht limitiert, nie in Geheim-Packs. Gilt für **jede** Pack-Quelle
  (Check-in, Heimsieg, Freund, Tipp, Story, Ziele, Kapitel, Wunschkarte …). Der Browser hat keinen Einfluss.
- `album_pack_oeffnen`: Besitz wie bisher (die gezogene Karte zählt ganz normal), **zusätzlich** Eintrag in
  `sva_album_shiny` (je Fan + Person + Saison, ×n) und — wenn noch keiner — `sva_album_shiny_erstfund`.
  Antwort je Karte `shiny`, `erstfund {name, at, ich}`.
- `album_mein`: `shiny[{karteId (Basis der Person), gezogen, anzahl, at, erstfund}]`,
  `shinyErstfunde[{karteId, name, at, ich}]` (für alle sichtbar: „entdeckt von …“ in der Vitrine).
- `album_katalog().regeln.shinyChance`. Einstellung `sva_album_einstellungen.shiny_chance` (Standard 250, 0 = aus).
- Konto löschen: Shiny-Funde weg, Erstfund bleibt anonym („Ein SVA-Fan“).
- Admin: `album_admin_shiny()` → Admin → Album → **Shiny & Geheim**: Funde mit Erstfund-Markierung und je Fund
  **Story-Grafik „SHINY gezogen!“** (PNG 1080×1920, `storyShiny()` in `src/karten/export/bild.ts`).

### Geheimkarten / Easter Eggs

| Ei | Wo | Karte | Rätsel (Geheime Seite) |
|---|---|---|---|
| `wappen` | Startseite: 7× schnell aufs Wappen oben links | Der Platzwart | „Sieben Mal klopft, wer den Platzwart sprechen will.“ |
| `ball` | Rundgang, Station Anzeigetafel: kleiner Ball unter „In den Kalender“ | Der verlorene Ball | „Einer ging nie ins Tor. …“ |
| `geburtstag` | Album am Vereins-Geburtstag: drei Kerzen auf der Startseite | Seit 1949 | „Nur an einem Tag im Jahr brennen die Kerzen.“ |
| `geste` | Album: Wischen/Pfeiltasten hoch, hoch, runter, runter, links, rechts, links, rechts | Die Geheimtaktik | „Hoch, hoch, runter, runter … wer die Alten kennt, kennt den Rest.“ |

- **Sicherheit:** Ein Ei prüft nichts im Klartext und kennt keine Karte. Es rechnet zur Laufzeit ein Token
  `G-` + 32 Hex aus SHA-256(`sva-geheim|<Auslöser>`) (`src/album/geheim/ei.ts`), merkt es sich und das Album löst es über
  die vorhandene Code-RPC `album_code_einloesen` ein (gleiches Rate-Limit wie Story-Codes). In der DB liegt nur
  SHA-256(Token) (`sva_album_geheim.token_hash`), Fans können die Tabelle nicht lesen. Die Wisch-Geste vergleicht der
  Browser nur als Hash. Geburtstag: der Server prüft zusätzlich das Datum (Europe/Berlin).
  Grenze: Wer das Bundle zerlegt, kann Wappen/Ball/Kerzen-Token nachrechnen — wie bei jedem Easter Egg; er bekommt
  dafür eine Bonus-Karte, die nicht fürs Album zählt. Die Vorführung (nur mit `?vorfuehrung=1` geladen) enthält die
  Gesten-Folge, weil sie sie vorspielt.
- Geheimkarten: `sva_album_karten.geheim = true` (immer limitiert, nie ziehbar — Constraint), **nicht** im
  öffentlichen Katalog; `album_mein().geheim[{nr, raetsel, gefunden, karte?}]` (Karte erst nach dem Fund, kein Ort/Schlüssel).
  Pack-Art `geheim`, je Fan und Ei einmal (`quelle = 'geheim:<ei>'`).
- Admin → Album → **Shiny & Geheim**: Eier an/aus, Rätseltext, Funde je Karte, „Geheimkarten anlegen“
  (`album_admin_geheim_standard()`; die Migration legt sie in einer DB mit Katalog selbst an).
  **Vereins-Geburtstag** unter Regeln eintragen (Gründungsjahr 1949, der Tag ist in den Vereinsdaten nicht
  hinterlegt) — bis dahin schläft das Kerzen-Ei.

### So siehst du dir alles an (ohne echte Daten)

| Was | Wo | Was passiert |
|---|---|---|
| **Album-Vorführung** | `/album?vorfuehrung=1` · Admin → Album → „Album-Vorführung öffnen“ (oben rechts) · Admin → Übersicht → Vorführ-Spiel → „Album-Vorführung öffnen“ | Demo-Fan „Lena B.“ mit halb vollem Album, 2 ungeöffnete Tütchen (eins mit Gold-Walkout, eins mit Shiny-Erstfund), Ziele/Medaillen, Lose, Verlosungen, Shiny-Vitrine, Geheime Seite (1 von 4). Rotes Band „Vorführung“. **Keine** Datenbank-, Login- oder Netzaufrufe — alles im Speicher des Tabs (`src/album/vorfuehrung/*`); neu laden = zurücksetzen. Der Umschalter „Album | Tipp-Liga“ führt zur Tipp-Liga-Vorführung. |
| **Steuerleiste** (Knopf „Vorführung steuern“ unten rechts) | in der Vorführung | **Normales Pack** · **Gold-Pack** (Walkout) · **Shiny-Pack** · **Test-Pack: alle Karten** (Kader, Silber-Glanz, Gold, Spezial-Moment, MOTM limitiert, Partner, Kurve, Shiny, Geheimkarte — jede mit ihrer echten Reveal-Animation, danach Einkleben) · **Geheimkarte finden** (spielt nacheinander die echte Wisch-Geste, den Ball, 7× Wappen ab) · **Kartenlabor** · Zurücksetzen |
| **Kartenlabor** | Vorführung → Steuerleiste · Admin → Album → **Labor** (echter Katalog, nur gelesen) | alle Karten in allen Fassungen nebeneinander (Filter Spieler/Glanz/Trainer/Momente/Kurve/Partner/Limitiert/Shiny/Geheim), Rückseiten-Schalter, Antippen = groß mit Holo-Neigung und Rückseite |
| Easter Eggs live testen | Startseite `/?vorfuehrung=1` (Wappen), Rundgang (Ball) | Der Hinweis „Im Album abholen“ führt in die Vorführung (`&vorfuehrung=1`) |

### Einführung für neue Fans (v22-A)

Nach dem ersten Aufschlagen erklärt „So funktioniert’s“ in 6 Schritten: Sammeln, was bekomme ich wann, Tütchen
öffnen, Kapitel/Ziele/Doppelte, Lose & Belohnungen, Glanz/Shiny/Geheimkarten (Zahlen aus den Regeln). Auf der
Start-Seite steht „So kommst du an Karten“ (Heimspiel, Tipp, Story, Ziele) mit Link zur Einführung; am Desktop
zusätzlich das Fragezeichen im Kopf. Gemerkt in `localStorage['sva-album-einfuehrung']`.

### Prüfen (v22-A)

- `node scripts/album-v22-shots.mjs [start,einfuehrung,packs,alle,geheim,labor,wappen,desktop]` (Vite auf 5197,
  `MOTOR=webkit|chromium`) → `shots-v22-album/` inkl. Videos; meldet jede Anfrage an Supabase (Soll: keine).
- `node scripts/album-v22-admin-shots.mjs` (Vite mit `VITE_SUPABASE_URL=https://audit.supabase.co`, Mocks, `?preview`).
- `node scripts/album-v22-perf.mjs` (Handy 390×844, DPR 2, 4× CPU-Drossel): Gold-Walkout, Shiny-Reveal, Vitrine,
  Kartenlabor je 60 fps, p95 ≤ 18,4 ms, keine Frames > 34 ms; Startseite 3D neu vs. v14-premium: 60 vs. 55–57 fps
  Leerlauf (alt hatte einzelne lange Frames beim Kompilieren), Scroll in den Rundgang beide 60 fps.
- WebKit-Fix: Safari zeichnete die abgewandte Kartenseite trotz `backface-visibility` (gespiegelter Kartenrücken über
  der Vorderseite nach dem Aufdecken bzw. in Detail/Labor). Jetzt blenden Karte und Pack-Bühne die abgewandte Seite
  zur Mitte der Drehung aus (`karten.css`, `pack.css`).
