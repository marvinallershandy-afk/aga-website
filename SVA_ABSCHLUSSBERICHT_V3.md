# SVA-FUSSBALL — Abschlussbericht v3 (Fable 5)

Auftrag: Aus „ein schöner Fußballplatz" wird „DAS ist unser Platz in Agathenburg" —
plus Klangwelt mit Marvins Musik. Referenz-Puzzle → Treue → Restschwächen →
Sound-Tor → Klangwelt → Fanblock-Finale → Partyraum.

---

## 1. ✅ Fertig & getestet

| Etappe | Gate | Commit |
|---|---|---|
| 0 · Referenz-Rekonstruktion | ✅ 71 Videos → 421 Frames, `REFERENZ_MODELL.md` frame-belegt | `v3 Etappe 0` |
| 1 · Agathenburg-Treue | ✅ 5 Vergleichspaare, GPU = Baseline | `v3 Etappe 1` |
| 2 · Restschwächen-Fix | ✅ Lampen-Aufglühen, Beat-3-Komposition, Dachkante obsolet | `v3 Etappe 2` |
| 3 · Sound-Eingangstor | ✅ beide Pfade, Merken, Kurz-Tor, reduced-motion | `v3 Etappe 3` |
| 4 · Klangwelt & Musik | ✅ Track nach Einwilligung, Ducking per Gain belegt | `v3 Etappe 4` |
| 5 · Fanblock-Finale | ✅ Banner lesbar, Figuren stilisiert, CTA, Atmo-Boost | `v3 Etappe 5` |
| 6 · Partyraum | ✅ lazy bewiesen (Request-Log), Klangwechsel, Dip-Übergang | `v3 Etappe 6` |
| 7 · Abschluss | ✅ Build grün, tsc=0, eslint 0 Fehler | (dieser Commit) |

**Perf-Tabelle (echte GPU, headed, 1280×800):**

| Messung | Hero | Team | Tabelle | Kontakt/Finale |
|---|---|---|---|---|
| v2-Baseline | 16,6 ms | 16,6 ms | 16,6 ms | 16,6 ms |
| **v3 final** | **16,6 ms** | **18,0 ms*** | **16,7 ms** | **16,6 ms** |

*Team-Ausreißer durch einen Frame-Hiccup (p95 33 = 1 dropped frame), sonst VSync-Limit.
**60 FPS gehalten.** Bundle: index 342 KB (kein three), three/R3F 880 KB lazy,
Stage 105 KB, PartyRoom 5,5 KB (lädt erst bei „Reinkommen?").

**Was jetzt echt Agathenburg ist:** Platz O–W mit Wald S/W/O + offenem Dorf-Norden,
das echte Vereinsheim (weiß, dunkles flaches Satteldach, Schornstein, blauer
Fascia-Anbau, Terrasse) hinter dem Ost-Tor, Ballfangzäune, Reling statt Tribüne,
Sponsor-Tafeln Süd, rote Klinker-Hütte NW, Fahnenmasten, echtes Wappen (Tor,
Karten, Story-Bild), Fanblock SW mit nachgebautem AGA-URKNALL-Banner — und
**Gründungsjahr 1949 korrigiert** (aus dem Logo; v1-Prompt sagte 1948).

## 2. 🔧 Unterwegs gefixt
- kein ffmpeg/brew auf der Maschine → `ffmpeg-static` (npm) für Frames + Audio.
- Tornetz-Rotations-Bug (Netz ragte über die Latte) → explizite Geometrie.
- three rutschte zurück ins Haupt-Bundle (useScrollProgress→CameraPath) →
  three-freies `anchors.ts`-Modul, Fallback lädt wieder null 3D.
- Mast-Streben lasen sich als Stör-Stäbe → entfernt, Pole schlanker.
- Kickoff-Frames: SwiftShader-Testskripte mussten durchs neue Tor (Klick-Geste).
- %-Höhen-/Grid-Probleme, Loader durch Tor ersetzt, PORT-Kollisionen alter Server.

## 3. ⚠️ Offen / braucht Marvin — inkl. Etappe-0-Fragen mit meinen Defaults
1. **Partyraum = Interpretation** (keine Innenraum-Fotos in REFERENZ) — aus
   Cover-Vibe gebaut; Fotos verfeinern später. *Default: so lassen.*
2. **Fanblock-Ecke = SW** (aus Frames 0160/0162 geschlossen). *Default: SW.*
3. **Trainingszeiten** im CTA weiter Platzhalter („Di & Do 19 Uhr").
4. **Gründungsjahr 1949** aus dem Logo übernommen — bitte bestätigen.
5. **Bolzplatz hinterm Ost-Zaun** weggelassen (außerhalb der Fahrt).
6. **Git-Remote fehlt** → leeres GitHub-Repo `sva-fussball` anlegen, URL geben,
   dann `git remote add origin … && git push -u origin main`.
7. Echte Spielerfotos/Namen, fussball.de-ID, og-image (unverändert aus v1/v2).
8. Optional: echtes CC0-Stadion-Ambience-File für den Atmo-Slot.

## 4. 🧭 Selbst getroffene Entscheidungen
- **Flutlicht bleibt, obwohl der echte Platz keins hat** (kein Mast in 421 Frames) —
  die Abendspiel-Inszenierung ist das abgenommene visuelle Konzept; Masten stehen
  außerhalb der Reling, damit sie die reale Anlage nicht verstellen. Dokumentiert.
- **Keine erfundenen Sponsoren** auf den Tafeln (echte Namen aus den Frames wären
  Werbung ohne Deal) → Platzhalter „Hier könnte dein Logo stehen" + SVA-Slogans.
- **Stadion-Atmo prozedural** (WebAudio Brown-Noise + LFO, 0 Bytes) statt
  CC0-Download-Risiko; Slot für echtes File vorbereitet.
- **Anstoß-Swell aus „Anpfiff"-Intro** geschnitten (7 s, Fades) — Herkunft: Marvins
  eigener Track, dokumentiert in §Audio.
- **Partyraum als Pocket-Dimension** (y=−40) mit Dip-to-Black statt echter
  Tür-Kamerafahrt — robust, mobil flüssig, 0 Frametime-Kosten draußen.
- Musik startet nach „Mit Ton betreten" automatisch (Gate-4-Kriterium), Pegel
  „Teppich" 0.42, Party 0.75, Ducking senkt Atmo auf 0.05.

## 5. ➡️ Nächste sinnvolle Schritte
1. GitHub-Repo + Push, dann Hosting (statischer Build, 30 MB Audio streamt).
2. Marvins Feinschliff-Runde am iPhone (Tor→Fahrt→Beat→Finale→Partyraum).
3. Sponsoren-Sektion (Bande hat Slots, „Werde Sponsor" verlinken).
4. Echte Inhalte (Fotos → Duotone-Pipeline greift automatisch).
5. Supabase/Admin (v2-ready), danach Spieltags-Countdown.

## 6. 🔑 Marvins To-dos
- [ ] GitHub-Repo `sva-fussball` anlegen → URL → Push
- [ ] iPhone-Abnahme komplett (v. a. Tor + Beat + Partyraum)
- [ ] Gründungsjahr 1949 bestätigen
- [ ] Trainingszeiten + Kontaktdaten echt machen
- [ ] Fotos/fussball.de-ID/og-image liefern
- [ ] Optional: CC0-Stadion-Ambience + Innenraum-Fotos Partyraum

---

## Audio-Asset-Herkunft

| Asset | Quelle | Format |
|---|---|---|
| 10 Tracks (`/audio/tracks/*.mp3`) | Marvin (CD Baby non-exklusiv, freie Nutzung) | MP3 144 kbps, **30 MB gesamt**, streamen bei Play |
| `kickoff-swell.mp3` | Schnitt aus Marvins „Anpfiff" (0:00–0:07, Fades) | MP3 128 kbps |
| Stadion-Atmo | prozedural (WebAudio), kein Asset | — |
| `cover.jpg` | Cover 2 (offizielles Artwork) | 512 px JPEG |
| `brand/wappen.png` | AGA Logo.png, weiß→transparent | PNG 512 px |

## Ehrliche Selbsteinschätzung

**„Erkennt ein Agathenburger seinen Platz?"** — Ich glaube **ja, auf den zweiten
Blick mit einem Lächeln**: die Anlage stimmt (Vereinsheim hinterm Tor mit blauem
Anbau, Zäune, Reling, Wald, Hütte, Fanblock-Ecke mit AGA-URKNALL-Banner). Die
Vergleichspaare P1/P2 tragen das. Auf den ersten Blick dominiert die bewusste
Nacht-Stilisierung — tagsüber kennt man den Platz anders, und das Flutlicht ist
unsere Erfindung.

**„Kinnlade komplett?"** — Der Bogen ist jetzt da: Wappen-Tor → Vorhang → Platz →
Anstoß-Beat mit Marvins Sound → Fanblock → Partyraum mit eigener Musik. Das ist
keine Vereins-Website mehr, das ist ein Ort. Was noch fehlt: der letzte Feinschliff
an zwei Kompositionen (unten).

**Top-3 verbleibende visuelle Schwächen:**
1. **Fanblock-Figuren** sind hinter Banner/Tafeln nur als Köpfe sichtbar — eine
   Stufe mehr Präsenz (Figuren VOR der Reling oder Kamera tiefer in die Kurve)
   würde den „Verein = Menschen"-Moment verstärken.
2. **Partyraum-Figuren** wirken abstrakt-steif (sitzender Gast schwebt leicht überm
   Hocker); 2–3 Posen-Varianten würden viel bringen.
3. **Vereinsheim-Fassade** ist noch glatt — das echte Fensterband/die Terrassen-
   Möblierung sind angedeutet, aber ein Canvas-Fassaden-Detail (wie bei der Bande)
   würde die Tabellen-Station veredeln.

_Screenshots: `SVA_SCREENSHOTS/v3-*.png` (Vergleichspaare, Beat-Sequenz, Tor,
Musik, Finale, Partyraum, Fallback). Referenz-Doku: `REFERENZ_MODELL.md`._
