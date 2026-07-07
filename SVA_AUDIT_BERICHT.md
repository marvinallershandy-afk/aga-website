# SVA-FUSSBALL — Audit-Bericht (Marvins Feedback gegen den echten Code)

**Reiner Prüf-Lauf. Nichts gebaut, kein Code geändert.** Branch `v9-reise`, 7. Juli 2026.
Screenshots: `SVA_AUDIT_SHOTS/` (Desktop 1440 + Mobile 390, sprechend benannt).
Legende: ✅ stimmt · 🟡 stimmt teilweise · ❌ stimmt nicht. Jeder Punkt mit **Ursache** (Datei)
und **Fix-Vorschlag** (nur Vorschlag — NICHT umgesetzt).

---

## Eingang / Ton

**1 · Hintergrund magenta-blau, CI-fremd** — ✅ **stimmt.**
Ursache: `src/ui/EntranceGate.tsx` Z.75–78 — Panel-Verlauf `#0a0c1a → #181430 → #241a33`
(Navy → Violett). Screenshot `01-eingangstor-*` zeigt zusätzlich einen Magenta-Halo (roter
Wappen-Drop-Shadow auf violettem Grund). CI ist Rot `#E91D29`/Schwarz.
Fix: Verlauf auf Schwarz/Anthrazit (`#0b0b0d → #141416`) mit dezentem SVA-Rot-Glow nur hinterm Wappen.

**2 · Ton = nur Rauschen statt Waldstadion-Atmo (Vögel/Natur)** — ✅ **stimmt.**
Ursache: `src/audio/AudioManager.ts` `buildAtmo()` Z.129–155 — prozedurales Brown-Noise, Tiefpass
420 Hz + LFO. Kein Naturklang. Der Code-Kommentar sagt selbst „echtes CC0-Ambience-File kann den
Slot später ersetzen (Marvin-To-do)".
Fix: CC0-Waldstadion-Loop (Vögel, ferne Rufe, Wind) als `atmo`-Quelle laden; das Noise nur als leiser Unterbau.

---

## Hero

**3 · Text „ein Flutlicht", Bild zeigt 4 Masten** — ✅ **stimmt (Widerspruch).**
Ursache: Copy `src/data/club.ts` Z.31 „Ein Dorf, ein Flutlicht, elf Mann"; Szene
`src/components/Floodlights.tsx` Z.221–231 rendert **4 Masten** (Ecken).
Fix: Copy angleichen — „unter Flutlicht" statt „ein Flutlicht", oder bewusst „vier Masten".

**4 · Claim/Ton tonal unpassend (junge Truppe, nicht „Wohnzimmer seit 1949")** — ✅ **stimmt.**
Ursache: `src/data/club.ts` Z.31 „…das Wohnzimmer von Agathenburg" + Gründungs-Nostalgie-Ton.
Fix: Copy jünger/roher (Instagram-Zielgruppe Anfang 20). Kern „Dorf/Verein/Platz" halten, „Wohnzimmer 1949" raus.

---

## Navigation

**5 · Reiter oben (7 Stück) — nötig?** — 🟡 **Designfrage, technisch da.**
Ursache: `src/ui/Brandbar.tsx` Z.14–20 rendert alle `SECTIONS`. Auf Mobile eng.
Fix-Vorschlag: Da die Seite eine geführte Scroll-Reise IST, Nav reduzieren (nur Logo + „Mitmachen"/„Sponsoren"-Sprung) oder ganz weglassen und stattdessen dezenten Fortschritts-Indikator. Cleaner.

**6 · Ton-Icon oben rechts wirkt billig + Position** — ✅ **stimmt.**
Ursache: `src/ui/Brandbar.tsx` Z.41 — rohes Emoji `🔊`/`🔇` in 34px-Kreis.
Fix: sauberes Inline-SVG (Speaker/Mute) in CI-Stil; ggf. nach unten-rechts als schwebender Mini-Button, nicht in die Nav-Zeile geklemmt.

---

## Übergang Hero→Mannschaft

**7 · „Musik geht beim Anstoß an" — soll nicht** — ✅ **stimmt (Ursache gefunden!).**
Ursache: Der Anstoß triggert `triggerKickoffSwell()` (`src/components/KickoffDirector.tsx` Z.29),
und `kickoff-swell.mp3` ist laut `src/utils/kickoffSound.ts` Z.1–3 **„die ersten 7 s aus Marvins
Song 'Anpfiff'"** — also echte Musik. Deshalb klingt es wie Musik. (Die Track-Playlist selbst läuft
korrekt nur im Party-Mode, `AudioManager.setMode`.)
Fix: Swell durch nicht-musikalischen Stadion-Sound ersetzen (Pfiff + anschwellendes Raunen) oder ganz weglassen → Musik bleibt exklusiv im Partyraum.

**8 · Kamerafahrt zu tief / zu viel Leerraum Hero→Mannschaft** — 🟡 **stimmt (subjektiv, sichtbar).**
Ursache: Sinkflug-Korridor `src/camera/CameraPath.ts` (`DIVE_FLOOR_Y=0.95`); Leerpolster
`src/ui/Sections.tsx` Z.65 `#anstoss-gap` = **80vh**. Frames `03-uebergang-*` zeigen lange leere Fahrt.
Fix: `anstoss-gap` kürzen (z. B. 50vh), Dive-Floor leicht anheben; Mannschaft früher einblenden.

**9 · Wenn Flutlicht angeht, darf Mannschaft schon kommen** — 🟡 **berechtigt.**
Ursache: Flutlicht-Level (`floodLevelAt`) und Mannschaft-Sektion sind zeitlich entkoppelt (großer Gap).
Fix: Mannschaft-Anker näher an den Flutlicht-Peak ziehen (Anker in `useScrollProgress.ts`).

---

## Mannschaft / Karten

**10 · Carsten ist Trainer, kein Angreifer (ANG falsch)** — ✅ **stimmt, deutlich.**
Ursache: `src/data/players.ts` Z.52 — `Carsten … position: 'ANG', rating: 88, goals: 18`. Screenshot
`04-mannschaft-desktop` zeigt Carsten im **schwarzen Trainer-Polo** — als Stürmer gekartet.
Fix: Rolle „Trainer" einführen (s. Punkt 11), Carsten dorthin; keine Sturm-Stats.

**11 · Trainer/Co-Trainer/Teammanager (3) brauchen eigene Kategorie** — ✅ **stimmt (fehlt komplett).**
Ursache: `src/data/players.ts` Z.8 `Position = 'TW'|'ABW'|'MIT'|'ANG'` — kein Staff-Typ; kein Grid dafür.
Fix: `role: 'player'|'trainer'|'staff'` ergänzen, eigener „Trainerteam"-Block (eigene Kartenfarbe/Reihe) über oder unter dem Kader.

**12 · Holo „gewollt statt gekonnt", zu flach — sollte mehrschichtig HINTER dem Spieler mit Tiefe** — ✅ **stimmt.**
Ursache: `src/ui/cards.css` — `.holo__shine/shine2/gloss` alle `z-index:5–6`, `inset:0`, flacher
Color-Dodge-Overlay ÜBER allem; Foto (`.holo__portrait`) ist flaches contain-`img` ohne Ebene dahinter.
Screenshot `04-mannschaft`: Foto-Karten okay, Leerkarten wirken flach.
Fix: Tiefen-Layering — Holo-Schicht HINTER den freigestellten Spieler + dezente Vorder-Glanzschicht; Parallax-Versatz bei Tilt; Foto als Cutout (`--cutout`-Stil ist schon angelegt) statt Vollrechteck.

**13 · Was gut IST: Rating / Name (Vorname klein oben) / Nummer / Stats-Layout** — ✅ **bestätigt gut.**
Ursache: `src/ui/HoloCard.tsx` Z.70–101 — Rating oben-links, Position darunter, Nummer-Wasserzeichen,
Name (`small`=Vorname, `b`=Nachname), Stats-Reihe. Bleibt so.

---

## Fan-Block

**14 · Figuren keine echten Figuren; Arme = 2 schwebende Zylinder** — ✅ **stimmt.**
Ursache: `src/components/FanBlock.tsx` Z. (Fan) — Arme sind zwei Zylinder bei `x=±0.17h, y=0.62h`,
`rotation-z ±0.22`, ohne Schultergelenk; sitzen seitlich neben dem Rumpf → wirken angesetzt/schwebend.
Fix: Arme an einem Schulterpunkt ansetzen (gemeinsame Silhouette), Schulterkugel, oder eine echte
CC0-Low-Poly-Figur (Quaternius) für die vorderste Reihe.

**15 · Fangesang = nur Rauschen** — ✅ **stimmt.**
Ursache: `src/audio/AudioManager.ts` `buildFanChant()` Z.72–116 — Bandpass-Rauschen + Tremolo-LFO +
Klopf-Puls. Synthetisch, kein echter Gesang.
Fix: CC0-Fangesang-/Crowd-Chant-Loop laden.

**16 · Bande-Metallrahmen: Füße verschwinden beim Runterscrollen** — 🟡 **plausibel/stimmt.**
Ursache: Fans stehen hinter der Bande (`z=HH+0.24`); Sponsor-Tafel + Handlauf (`src/components/Barrier.tsx`)
liegen bei `z≈HH+0.035` DAVOR und 0,24 hoch → aus flachem Winkel verdecken sie Füße/Beine.
Fix: Fans näher/erhöht setzen oder Tafel niedriger; Sichtlinie testen.

**17 · Sponsor-Werbung hängt am Geländer — Geländer verdeckt Werbung** — ✅ **stimmt.**
Ursache: `src/components/Barrier.tsx` — Handlauf (`y=RAIL_H=0.11`) läuft VOR der Tafel (Tafel `z=HH+0.035`,
Rail `z=HH`) auf halber Tafelhöhe. Screenshots `06-vereinsheim-aussen` + `05-fanblock` zeigen: Rohr quert das Board;
am Ballfangzaun scheint die Werbung sogar durchs Gitter.
Fix: Tafel unter die Reling hängen (tiefer) oder Reling hinter/über der Tafel führen; am Ost-Zaun Werbung VOR das Gitter.

---

## Vereinsheim

**18 · Schwenk rein/raus zu schnell** — 🟡 **berechtigt.**
Ursache: Anflug/Abflug sind an die Musik-Sektion gekoppelt (feste Scroll-Formel, `src/ui/PartyDirector.tsx` +
`camera/partyPath.ts`); wenig Scroll-Weg für den Schwenk.
Fix: mehr Scroll-Puffer um `#musik` (Sektion/Gap höher) → Schwenk streckt sich; Ein-/Ausfahrt-Ease sanfter.

**19 · Modell verändert statt nur Tür verschoben; Gebäude real LÄNGER, Tür weiter hinten** — ✅ **stimmt.**
Ursache: `src/components/Clubhouse.tsx` — v9-E3 hat einen **Anbau `ANNEX_LEN=3.3` „nach Norden verlängert"**
angesetzt (Z.99–102, 170ff) statt den Hauptkorpus (`LEN=4.2`) real länger zu bauen und die Tür nach hinten zu setzen.
Fix: Korpus nach Referenzfotos (`REFERENZ/frames/…`) auf echte Länge modellieren, Tür an reale Position; Ad-hoc-Annex auflösen. Fotos = Wahrheit, nicht raten.

**20 · Eingang wirkt „2D-animiert", man müsste durch eine Wand rein** — ✅ **stimmt.**
Ursache: `src/components/Clubhouse.tsx` Z.213–216 — Tür = flaches Emissive-Glow-**Plane**; „Eintritt" ist
ein Kamera-Hop hinter dem Glow (`camera/partyPath.ts` PARTY_HOP), keine echte Türtiefe.
Fix: echte eingelassene Türöffnung mit Laibung/Schwelle/Tiefe, Kamera fährt sichtbar durch die Wandöffnung.

**21 · Fassade braucht Qualität (Backstein sichtbar, Dach erkennbar)** — 🟡 **teilweise.**
Ursache: `src/components/Clubhouse.tsx` `makeFacadeTexture()` — weißer Putz `#d8d4c8`, Klinker nur als
schmaler Sockel (12 %); Korpus-Box sonst flaches `#d6d2c6`. Dach IST modelliert (dunkles Satteldach), liest aber flach.
Fix: Backstein-/Klinker-Textur großflächiger (Referenzfotos), Dachziegel-Struktur + klarere Traufkante.

---

## Partyraum

**22 · Raum zu klein → doppelt so lang** — ✅ **stimmt.**
Ursache: `src/components/PartyRoom.tsx` Z.19 `H = ROOM.size/2` — Raum ist **Quadrat 3,2×3,2**.
Screenshot `08c-partyraum-total`: enger Kubus.
Fix: Raum rechteckig ~2× länger (Tresenwand als lange Seite); Kamera-Zielpunkt anpassen.

**23 · Tresen richtig, aber Leute davor statt dahinter → Bar weiter in den Raum** — 🟡 **stimmt.**
Ursache: `src/components/PartyRoom.tsx` Z.242 Tresen `x=1.22`, Wand bei `H=1.6` → nur 0,16 Platz für den
Barkeeper (Z.317 `x=1.44`), Gäste davor (Z.320–321). Sehr eng hinter der Bar.
Fix: Tresen nach innen rücken (kleineres x), Personal-Gasse dahinter; Gäste bleiben davor.

**24 · Jemand zapft Bier links neben der Bar** — 🟡 **teilweise da.**
Ursache: `ZapfArm` (Z.69–84) = Barkeeper zapft am Tresen. „Links neben der Bar" (separate zapfende Person) fehlt.
Fix: zweite Figur seitlich der Bar am Fass ergänzen.

**25 · Links neben Bar angedeutete Tür** — ❌ **fehlt.** Ursache: keine solche Tür in `PartyRoom.tsx`.
Fix: flache Türandeutung an der West-/Seitenwand neben dem Tresen.

**26 · Rechts beim Reinkommen Tische+Bänke für Partys** — ❌ **fehlt.**
Ursache: `PartyRoom.tsx` hat nur Barhocker (Z.324–329), keine Tische/Bänke.
Fix: Biertisch-Garnituren (Tisch + 2 Bänke) auf der Eingangs-rechten Seite (West).

**27 · An der Wand normales AGA-Logo statt „SVA"-Schriftzug** — ✅ **stimmt.**
Ursache: `src/components/PartyRoom.tsx` `svaNeonTexture()` Z.21–40 zeichnet **Text „SVA"**; Screenshot
`08c` zeigt rotes „SVA"-Neon.
Fix: statt Text das echte Wappen/AGA-Logo (`public/brand/wappen.png`) als beleuchtetes Wand-Emblem.

---

## Sponsoren

**28 · Werbung pixelig/nicht HD, keine Schatten, nicht hochwertig** — ✅ **stimmt.**
Ursache: `src/components/Barrier.tsx` `makeBoardsTexture()` — Canvas nur **2048×64 px** über ~9 Welt-Einheiten
Breite × 0,24 hoch; Board-Material rein `emissive`, ohne Licht/Schatten. Beim Zoom (Sponsoren-Station) → unscharf.
Fix: Textur deutlich höher (z. B. 4096×256), echte Sponsor-Logos scharf; Board realistisch beleuchten (Spot/AO), leichte Schlagschatten.

---

## Tabelle

**29 · Nur kleine Tabelle unten links — reicht das?** — 🟡 **stimmt (mager).**
Ursache: `src/ui/FussballWidget.tsx` `MOCK_TABLE` = 5 Zeilen; keine Torschützen/Best-Spieler/Rating.
Fix: volle Tabelle + Top-Torschützen + „Beste Spieler" (verknüpft mit den FIFA-Kartenratings) — eigener Tabellen-Block statt Mini-Kachel.

**30 · Marker vom Vereinsheim ist schon da beim Tabellen-Reiter** — ✅ **stimmt.**
Ursache: `src/components/LocationMarker.tsx` `FADE_START=0.84` — Pin blendet schon vor dem Finale ein;
Screenshot `10-tabelle-desktop` zeigt den großen Pin bereits.
Fix: Pin-Fade erst am Finale (`FADE_START` höher, z. B. 0.93) starten.

---

## Mitmachen

**31 · „WhatsApp schreiben" nur Text, kein Icon/CTA** — ✅ **stimmt.**
Ursache: `src/ui/Sections.tsx` Z.120–127 + `.btn--wa` (`cards.css`) — grüner Button, reiner Text.
Screenshot `11-mitmachen`: „WHATSAPP SCHREIBEN" ohne Icon.
Fix: WhatsApp-Glyph (Inline-SVG) davor, als klare CTA.

**32 · „SVA Fußball folgen" (Instagram) regenbogenfarbig, kein Icon** — ✅ **stimmt.**
Ursache: `.btn--ig` Instagram-Gradient; kein Icon. Screenshot zeigt Regenbogen-Pill „@SVA_FUSSBALL FOLGEN".
Fix: Instagram-Glyph davor; Gradient dezenter/CI-näher, damit es nicht „Regenbogen" wirkt.

**33 · Reihenfolge Sponsoren→Tabelle→Mitmachen sinnvoll?** — 🟡 **Designfrage.**
Fix-Vorschlag: Für Emotion→Aktion eher Tabelle (Stolz) → Mitmachen (Spieler/Fans) → Sponsoren (Geschäft) am Schluss; oder Mitmachen ganz ans Ende als klarer CTA. Aktuell endet die Reise auf „Mitmachen/Finale", was ok ist — Sponsoren früh ist bewusst (Geld-Station). Marvin entscheidet.

**34 · Teammanager mit Bild + „schreib mir" fehlt** — ✅ **fehlt.**
Ursache: keine Ansprechpartner-Karte in `Sections.tsx`/Kontakt.
Fix: Teammanager-Karte (Foto + Name + „Schreib mir" → WhatsApp-Deeplink) im Mitmachen-Block.

---

## Maps-Finale

**35 · Nicht weit genug rausgezoomt** — ✅ **stimmt.**
Ursache: `src/camera/CameraPath.ts` Finale-Station `y=13.5`, `maxFlightYAt` Finale 15; Karte `SIZE=46`
(`MapGround.tsx`) wird kaum sichtbar. Screenshot `12-maps-finale`: fast nur Platz, wenig Ort drumherum.
Fix: Finale-Kamera höher/weiter (y ~22–28) + evtl. FOV, damit Ortskontext (Straßen, Ort) wie im Google-Maps-Bild erscheint.

**36 · 2D-Karte stimmt nicht (Straße durch den Platz, „Waldsportplatz" pixelig)** — ✅ **stimmt.**
Ursache: `src/components/MapGround.tsx` — Zufahrts-Straße `road([...,[c-40,c+120],[c,c+30]])` endet **im**
Platz-Rechteck (Endpunkt ~[512,542] liegt im Platz-Rect 433–591); Label „Waldsportplatz" nur 20 px auf
1024er-Canvas über 46 Einheiten → weich/pixelig.
Fix: Straße am Platzrand/Parkplatz enden lassen (nicht durchs Feld); Canvas höher auflösen (2048/4096) oder Labels als DOM-Overlay; **Referenz-Google-Maps-Bild nachbauen** (Platz grün, Rest flache Karte). Hinweis: In `REFERENZ/` war KEIN Maps-Referenzbild auffindbar — bitte ablegen, dann kann es 1:1 nachgebaut werden.

**37 · Konzept „3D-Platz+Haus bleiben, Rest flache 2D-Karte"** — ✅ **korrekt umgesetzt, nur zu klein/ungenau.**
Ursache: `MapGround.tsx` (flache Karte) + 3D-Platz bleiben — Prinzip stimmt; nur Zoom (35) + Kartendetail (36) offen.

---

## Performance (nur zur Info, Echt-GPU)

Gemessen headed auf **Apple M3 (ANGLE Metal)**, `_e6perf.mjs`, 140-Frame-Fenster:

| Station | avg (ms) | p95 (ms) |
|---|---|---|
| Hero | 16,64 | 17,3 |
| Mannschaft | 16,59 | 17,1 |
| Tabelle | 16,56 | 17,2 |
| **Finale (Maps)** | 17,61 | **32,9** |
| Durchfahrt p=0,2…1,0 | 16,55–16,62 | 16,8–17,2 |

Durchgehend **~60 FPS** (16,67 ms = 60 Hz). Einzige Auffälligkeit: **Finale hat einen p95-Spike
(32,9 ms = 1 verpasster Frame)** beim Einblenden der Map-Textur (`MapGround` Canvas 1024²) — ein
Ruckler beim Karten-Fade, kein Dauerproblem. Fixbar durch vorgeladene/kleinere Map-Textur.

---

## Kurz-Priorisierung (Vorschlag, wenn gebaut werden soll)

**Schnell & hohe Wirkung:** #1 Gate-Farbe, #6 Ton-Icon, #7 Anstoß-Musik raus, #10/#11 Carsten/Trainer,
#27 AGA-Logo statt SVA, #30 Marker-Fade, #31/#32 WhatsApp/IG-Icons, #36 Straße nicht durch den Platz.
**Mittel:** #12 Holo-Tiefe, #16/#17 Bande vs. Fans/Werbung, #22 Raum länger, #28 Sponsor-HD, #29 Tabelle voll.
**Groß (Modellierung):** #19/#20/#21 Vereinsheim nach Fotos rekonstruieren + echte Türtiefe, #26 Tische/Bänke, #35 Finale-Zoom.

**Nichts hiervon wurde umgesetzt — reiner Audit.**
