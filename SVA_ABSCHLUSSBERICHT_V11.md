# SVA-Fussball · Abschlussbericht v11 „Der große Lauf"

**Branch:** `v11-gross` (von `v10-politur`, enthält v9 + v10) · gepusht · **NICHT gemergt**
**Umfang:** 37 Dateien, +1513 / −351 · 9 Etappen-Commits + dieser Abschluss
**tsc + build:** grün · **Perf:** 60 FPS an allen Stationen (headed, Vordergrund, s. u.)
**Regel eingehalten:** additiv, nichts Funktionierendes zerstört. Jeder Auftragspunkt
umgesetzt oder unten unter „Bewusst offen" mit Begründung markiert — kein stilles Weglassen.

---

## Was jede Etappe gebracht hat

**E1 · Spielerkarten leben in 3D auf dem Platz** — der große Wurf.
Neue `PlayerCards3D.tsx` + `three/playerCardTexture.ts`: Jeder Spieler steht als
billboardende Sammelkarte in seiner Formationsposition auf dem Rasen (TW/ABW/MIT/ANG,
zeilenweiser Reveal beim Reinscrollen). Klick auf eine Karte → Fokus/Detail (Spieler-
Modal), Klick auf den Trainerstab an der Seitenlinie → WhatsApp. Scrollytelling-
Pointer-Events-Muster in `index.css` (Klicks fallen durch die DOM-Sektionen auf den
fixen R3F-Canvas). Der alte DOM-Karten-Grid bleibt zusätzlich erhalten.

**E2 · Karten-Design edler, Arcade-Holo raus.**
`HoloCard.tsx`: Regenbogen-Doppel-Shine → ein ruhiger `.holo__sheen` (soft-light),
Tilt gedämpft. Wirkt wertig statt Jahrmarkt.

**E3 · Vereinsheim wieder in Originallänge + Schwenk langsamer.**
`Clubhouse.tsx` LEN 4,2 → 5,6, Anbau 3,3 → 4,8, Fenster/Pfosten neu verteilt, 3 Biertische.
`partyPath.ts`: Tür weiter nach hinten (DOOR.z −1,95 → −2,5), Anflug-Kontrollpunkte
nach Norden → die Kamerafahrt am Heim ist länger und ruhiger.

**E4 · Partyraum-Umbau (alle 6 Punkte).**
`PartyRoom.tsx` komplett auf rechteckigen, doppelt so langen Saal umgebaut
(`partyPath.ts` ROOM-Refactor): Tresen + zwei Personal-Figuren (eine zapft), grüne
**Seitentür** in der Westwand, Tisch-Bank-Garnituren (`BierGarnitur`), echtes
**AGA-Logo** als beleuchtetes Wandschild, Lichter neu über den langen Raum verteilt.

**E5 · Reiter neu geordnet + Tabelle → Saison-Cockpit.**
Reihenfolge jetzt …Musik → **Tabelle → Sponsoren** → Mitmachen (Ergebnis-Beat vor
Geld-Beat). `FussballWidget.tsx` von einfacher Tabelle zum **Saison-Cockpit** ausgebaut:
Form der letzten 5 (Ampel-Dots), Top-Torschützen mit Gesicht, Zuletzt/Nächstes-Spiel-
Karten, Tabellen-Vorschau mit „live auf fussball.de"-Deeplink (echte Team-ID).

**E6 · Sponsoren-Karussell + neues Banden-Design.**
`SponsorsStrip.tsx` → `SponsorCarousel` (Pfeile, Dots, E-Mail **und** WhatsApp-CTA,
kein Preis). `Barrier.tsx`: leere Banden im CI-Look mit einladendem Claim statt Dummy-Logos.

**E7 · Fanblock: Meisterfeier-Kacheln + Lightbox.**
Neue `FanGallery.tsx` (Kachel-Galerie + Lightbox mit Esc/Pfeil-Steuerung), gestaltete
„Foto folgt"-Kacheln bis echte Bilder da sind. `FanBlock.tsx`: Sponsoren-Board ans
Geländer, Feuerwerk über der Kurve.

**E8 · Maps-Finale richtig.**
`MapGround.tsx`: weiter herausgezoomt, Straße neu zum Parkplatz im Südosten geführt
(läuft **nicht mehr durch den Platz**), Beschriftung in höherer Auflösung + Anisotropy
= scharf. `CameraPath.ts` FINALE_MAX_Y 15 → 21.

**E9 · Klein-Fixes.**
Teammanager **Nico Hause** (echtes CI-Porträt, „Schreib mir"-WhatsApp); Inline-SVG-
Glyphen (`Icons.tsx`) für WhatsApp (StaffCard + Mitmachen) und Instagram; Eingangstor-
Verlauf von Magenta/Blau → **CI Schwarz/Rot**; Hero-Text jünger/nahbarer; Audio-
Waldebene (`AudioManager.buildForest`: Blätterrauschen + prozedurale Vogelrufe).

**E10 · Abschluss.** Dieses Dokument, vollständiges Stations-Set, Perf-Messung, Asset-Liste.

---

## Perf (headed, Fenster im Vordergrund, Background-Throttling aus)

`scripts/_e10perf.mjs` — Apple M-GPU, rAF-Frametimes über je ~4 s, Median:

| Station | Median | p95 | FPS |
|---|---|---|---|
| Hero/Verein | 16,7 ms | 17,6 | **60** |
| Mannschaft (3D-Karten) | 16,7 ms | 17,4 | **60** |
| Fanblock | 16,7 ms | 17,3 | **60** |
| Musik/Party | 16,7 ms | 17,4 | **60** |
| Tabelle | 16,7 ms | 16,9 | **60** |
| Sponsoren | 16,7 ms | 17,6 | **60** |
| Finale/Maps | 16,7 ms | 33,3 | **60** |

60-FPS-Gate real erfüllt — auch mit den neuen 3D-Karten und dem längeren Partyraum.
Nur am Finale gelegentlich ein einzelner 33-ms-Frame (Maps-Textur-Upload), Median bleibt sauber.
Wichtig: diese Zahlen nur gültig mit Fenster im **Vordergrund** — im Hintergrund drosselt
der Browser auf 30 Hz (das erklärt die „33 ms flat" aus v10; kein echter Einbruch).

---

## Assets, die Marvin noch nachliefert (alles ehrlich als Platzhalter markiert)

1. **Echte Meisterfeier-Fotos** → `public/fanblock/<name>.webp`, dann `src` in
   `FAN_PHOTOS` (club.ts) setzen. Bis dahin gestaltete „Foto folgt"-Kacheln.
2. **Nico-Hause-Freisteller** — aktuelles Foto ist die fertige CI-Karte (rot, Wappen,
   #30); ein freigestelltes Cutout bräuchte ein Bild-Tool (out of scope).
3. **Sponsor-Logos** → `public/sponsors/<name>.png` + Eintrag in `SPONSORS[]` (club.ts).
   Leer = „diese Bande sucht dich".
4. **Echte fussball.de-Daten** — Tabelle/Form/Torschützen/Ergebnis sind Vorschau-
   Platzhalter; Team-ID ist eingetragen, der Live-Abruf wäre ein eigener Baustein.
5. **Nächster Spieltermin** (NEXT_MATCH) — „Gegner/Termin folgt".
6. **Restliche Spielerfotos** — 5 echt, Rest generische Wappen-Platzhalter
   (`public/players/<vorname>.webp`).
7. **Co-Trainer** Name + Foto (STAFF s2 „Name folgt").
8. **Trainingszeit** Di & Do 19:00 gegen die offizielle Vereinsseite bestätigen.
9. **WhatsApp-Nummer** — `CONTACT.whatsapp` ist Platzhalter (491700000000), echte
   Vereinsnummer eintragen (Format ohne + / ohne führende 0).

---

## Bewusst NICHT in v11 (per Auftrag außerhalb)

Deployment/Netlify, Cel-Shading, Higgsfield, Supabase. Keine Auftragspunkt-Etappe
wurde ausgelassen.

---

## Merge-Empfehlung

`v11-gross` ist fertig und merge-fähig (enthält v9 + v10). tsc + build grün, 60 FPS real.
Empfohlene Reihenfolge, wenn Marvin alles zusammenführen will:

```
git checkout main
git merge v11-gross      # bringt v9 + v10 + v11 in einem Rutsch
```

Kein offener technischer Blocker. Die Vereinsheim-Tür-Feinlage (Dauerpunkt seit v8)
ist mit E3/E4 stimmig, kann aber bei Bedarf über `partyPath.ts` (DOOR + Anflugpunkte)
nachjustiert werden. Alles andere Offene ist Inhalt/Assets, kein Code.
