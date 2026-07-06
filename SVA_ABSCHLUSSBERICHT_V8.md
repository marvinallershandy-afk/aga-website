# SVA-FUSSBALL — Abschlussbericht v8 „Flow & Vollständigkeit"

Branch `v8-flow` · 6 Etappen · Stand: fertig, Merge-Empfehlung siehe unten.

---

## 1 · Was v8 wollte (und warum)

v8 war kein Feature-Lauf, sondern ein **Fluss- und Ehrlichkeits-Lauf**: Die
Reise sollte sich als *ein* Stück lesen (Nordstern: „Du bist Regisseur der
Gesamtreise"), ohne Ruckler zwischen den Stationen, mit einem echten
Vereinsheim-Anflug statt einer erfundenen Tür und einem Finale, das den
Besucher tatsächlich zum Platz lotst. Dazu Vollständigkeit: Slots für die
Dinge, die Marvin noch liefert (Sponsoren, Termin, Foto), **ehrlich als
Platzhalter markiert** statt leer oder gefaked.

## 2 · Die sechs Etappen im Einzelnen

**E0 — Flow-Befund.** Ist-Analyse: drei Bruchstellen benannt (Anstoß-Stopp
als Textkarte, Kamera „skimmt im Rasen", Mannschaft-Karten überlappen mit
dem Partyraum-Anflug). Dokument `SVA_FLOW_BEFUND.md`.

**E1 — Scroll-Flow.** Die eigene Anstoß-*Sektion* (Textkarte, 115vh Stopp)
ist raus; der Anstoß-Moment lebt jetzt als **nahtloser Kamera-Übergang**
Hero→Mannschaft (synthetischer Anker, `useScrollProgress.ts`). Kamera-Boden
ist jetzt **zonenweise**: übers offene Feld hoch (kein Rasen-Skim), am
Vereinsheim tief. Ein Trenn-Polster schiebt die Musik-Sektion nach unten,
damit die Mannschaft **vollständig geräumt** ist, bevor der Anflug startet.

**E2 — Vereinsheim-Geometrie (Marvins Gebäudewissen).** Der echte Eingang
liegt **links** (bei den Fahnenmasten, im Fensterraum „Dodos Raum") — nicht
rechts. Die alte Tür bei z=0.95 war in Wirklichkeit gar keine Tür → entfernt.
Umgesetzt: Tür/Glow/Türblatt + Türlicht nach links verlegt, Fenster nach
rechts gerückt, und der **Ost-Ballfangzaun bekam eine Öffnung** für die
Anflug-Lane (zwei Panels statt einer Wand; das Süd-Panel deckt weiter das
Tor). Der Anflug bleibt bis zur Tor-Ebene südlich (klärt den Torpfosten) und
schwenkt erst dahinter durch die Öffnung nach links — weder Tor noch Zaun
werden geschnitten. Verifiziert per Screenshot: Glow füllt am Welt-Hop das
Bild, der versteckte Schnitt bleibt gedeckt.

**E3 — Wappen konsequent.** Der letzte Platzhalter (Favicon-Kreis mit „A")
ist durch die Schildform mit dem echten Rot/Schwarz-Diagonalsplit ersetzt.
Das echte Wappen (`/brand/wappen.png`) läuft bereits in Karten, Tor, Share
und Apple-Touch-Icon.

**E4 — Karten-Rauszoom-Finale.** Das Finale ist **keine statische Karte**
mehr, sondern ein Kamera-Rauszoom: die Fahrt steigt am Ende aus der
Platznähe in die **Vogelperspektive** — die ganze 3D-Welt wird zur lebenden
Standort-Karte. Über dem Vereinsheim blendet der **Marker** ein (gepulster
Boden-Ring + Pin + Label „SV Agathenburg-Dollern · Hier sind wir"), der
**Route-Button** lebt im DOM (plattform-bewusst Apple/Google Maps). Neue
zonenweise Y-Decke: nur zum Finale (u>0.86) steigt sie von 7,6 auf 15.

**E5 — Content-Vollständigkeit.** Sponsoren-Strip („Hier könnte dein Logo
stehen" — zugleich Verkaufsargument), Nächstes-Heimspiel-Slot,
Mannschaftsfoto-Slot (rendert nur mit echtem Bild → kein leerer Rahmen),
Instagram prominent. Alle Platzhalter ehrlich als solche markiert.

**E6 — dieser Bericht.**

## 3 · Perf

Echt-GPU-Messung (Apple M3, ANGLE Metal), automatisiert:

| Szene | avg (ms) | p95 (ms) |
|---|---|---|
| Hero | 33,2 | 34,8 |
| Mannschaft | 33,2 | 34,9 |
| Tabelle | 33,3 | 34,3 |
| Finale (Rauszoom) | 33,1 | 33,6 |
| Party-Durchfahrt p=0.2…1.0 | 33,2–33,3 | 34,0–34,3 |

**Lies das richtig:** Die Werte sind über *alle* Szenen praktisch identisch —
Hero (die billigste Szene) ist genauso „schnell/langsam" wie Finale und
Party (die teuersten). Echte GPU-Last würde die komplexen Szenen langsamer
machen; die **Flachheit bei exakt ~33,3 ms = 30 fps** ist die Signatur einer
**rAF-Drosselung des nicht-fokussierten Playwright-Fensters**, kein realer
Kosten-Befund (gleiches Artefakt wie in v4–v7).

**➜ Marvin, bitte gegenprüfen:** Seite am Netzteil in einem fokussierten
Browserfenster öffnen, Taste **`p`** (Perf-Overlay) — dort die echten 60 fps
ablesen. Neu in v8 sind nur der Finale-Marker (3 kleine Billboard-Quads + 2
Ring-Meshes, nur bei u→1 sichtbar) und ein Zaun-Panel mehr; beides
vernachlässigbar. Draw-Calls unverändert im grünen Bereich.

## 4 · Nordstern-Selbstcheck

- **Kommt über Instagram, muss auf den ersten Blick ziehen:** Hero „Willkommen
  am Platz" unter Flutlicht, echtes Wappen, klarer Claim. ✅
- **Spieler gewinnen:** Sammelkarten (Metall-Foil, echte Zahlen,
  „Spieler des Monats"), „Probetraining: einfach da sein". ✅
- **Sponsoren gewinnen:** freie Banden am Platz + „Hier könnte dein Logo
  stehen"-Slots + „Bande sichern". ✅
- **Fans binden:** Aga-Urknall-Partyraum-Durchfahrt, Nächstes-Heimspiel,
  Live-Tabelle (fussball.de-Slot), Instagram. ✅
- **Premium & kohärent, roter Faden:** eine durchgehende Kamerafahrt vom
  Anpfiff bis zum „Hier sind wir"-Rauszoom, überall dasselbe Rot/Schwarz für
  das, was WIR bauen — reale Dinge in Originalfarben. ✅
- **Ehrlichkeit:** jeder Platzhalter ist sichtbar markiert, nichts gefaked. ✅

## 5 · Was Marvin noch liefern muss (Asset-Liste)

Alles hat einen fertigen Slot — sobald das Material da ist, greift es ohne
weiteren Umbau.

1. **fussball.de-Vereins-/Team-ID** → echte Live-Tabelle & Ergebnisse
   (`club.ts` → `CLUB.fussballDeTeamId`). Kandidat aus v7-Recherche prüfen.
2. **Sponsoren-Logos** (PNG/SVG, transparent) → `public/sponsors/`, dann in
   `club.ts` → `SPONSORS[]` eintragen (Name, logo, url).
3. **Echte Heimspiel-Termine** (mind. das nächste) → `club.ts` → `NEXT_MATCH`
   (Gegner, Datum), `isPlaceholder` auf `false`.
4. **Mannschaftsfoto / Stimmungsbild** → `TEAM_PHOTO` in `club.ts` (rendert
   dann automatisch im Verein-Block).
5. **Spielerfotos** (die noch fehlenden ~10 Karten sind Platzhalter-Silhouetten)
   + Bestätigung Trainingszeiten (aktuell „Di & Do ab 19:00" als plausibler
   Platzhalter) und der echten Vereins-E-Mail/Instagram-Handles.
6. *Optional, kein Blocker:* echtes hochauflösendes Wappen (aktuell 512×582)
   für noch schärfere Karten-/Share-Darstellung.

## 6 · Merge-Empfehlung

**Empfehlung: `v8-flow` → `main` mergen.** Alle sechs Etappen sind
abgeschlossen, `tsc` und `npm run build` sind grün (Prerender ok, 25,4 kB
Inhalts-DOM), Desktop+Mobile-Screenshots aller Sektionen liegen vor, keine
Page-Errors im Sweep. Fallback/reduced-motion bleibt intakt (der 3D-Marker
ist reine 3D-Ebene → im Fallback trägt die SVG-Karte + Route-Button).

**Ein Vorbehalt, der dir gehört (E2):** Die Verlegung des Eingangs nach links
folgt deiner mündlichen Beschreibung. Bitte im laufenden Betrieb einmal
durch die Durchfahrt scrollen und bestätigen, dass Tür-Position und der
„Dodos Raum"-Anflug so stimmen, wie du das Gebäude kennst — Feinjustage der
Tür-z-Position ist ein Einzeiler (`partyPath.ts` → `DOOR.z`, plus die drei
Anflug-Punkte). *Nicht* mergen, bevor du diesen einen Beat abgenickt hast;
alles andere ist merge-fertig.

---

### Offene, bewusst nicht in v8 gemachte Punkte (für später)
- Reale **überdachte Terrasse/Veranda** vorm Vereinsheim (Referenzfoto zeigt
  ein Vordach auf Pfosten) — v8 hat nur die Tür-Position korrigiert, nicht das
  Vordach ergänzt. Kandidat für einen kleinen v9-Geometrie-Feinschliff.
- fussball.de-Live-Anbindung wartet auf die ID (s. Asset-Liste).
