# Rundgang (v18-R)

Scrollen auf der Startseite (Karten-Totale) startet den Rundgang **ohne
Schnitt**: Die Route beginnt exakt in der Pose der Karte, die Kamera fährt
vom ersten Scroll-Pixel an mit. Kein Intro, kein Text-Zwischenbild —
Stationstexte blenden erst ein, wenn die Kamera an ihrer Station ankommt
(Präsenz folgt der gedämpften Kamera, nicht dem rohen Scroll).

## Route (Geh-Reihenfolge über das Gelände)

Kompass wie `Scene.tsx`: +x Ost, +z Süd. Eigenes Tor im Westen (x −5.25).

| # | Halt | Ort | Kamera |
|---|------|-----|--------|
| 0 | `karte` | Karten-Totale (= Startseite) | Poster-Pose je Bildklasse (`mapCamera.OVERVIEW`), Tele-fov |
| 1–11 | `team-0 … team-10` | Startelf, **Spieler zu Spieler** | westlich jeder Karte, leicht erhöht, Blick Richtung Gegnertor |
| 12 | `team-totale` | hinter dem eigenen Tor, hoch | ganze Elf + Unterstand |
| 13 | `sponsoren` | Süd-Bande (gleich hinter dem Unterstand) | Banden-Zoom + Karussell |
| 14 | `fanblock` | Südost-Kurve | Fans + Meister-Banner |
| 15 | `tabelle` | Anzeigetafel am Vereinsheim (Ost) | Blick nach Nordost |
| 16 | `musik-tuer` | vor der Tür des Vereinsheims (Nordost) | gerade Sichtlinie auf die Tür, nördlich des Zaun-Endes |
| 17/18 | `musik-raum` / `-ende` | Partyraum (eigene Szene) | Raum-Totale, verweilen |
| 19 | `musik-raus` | wieder vor der Tür | = Halt 16 |
| 20 | `kontakt` | Aufstieg in die Anfahrts-Karte | Vogelperspektive |

Kein Hin- und Herspringen mehr: Westen (Elf) → Süden (Bande) → Südost (Kurve)
→ Ost (Tafel) → Nordost (Tür, Raum) → hoch. Vorher: Mannschaft (West) →
Fans (SO) → Vereinsheim (O) → Tabelle (O) → **Bande (Süd-Mitte)** → Finale;
der Sprung Tabelle → Bande war die „sehr, sehr abrupte“ Fahrt.

DOM-Sektionen in derselben Reihenfolge: Verein (ruhiger Anfang, Text nur für
Screenreader) → Mannschaft → Sponsoren → Fanblock → Tabelle → Musik → Mitmachen.

## Technik

* **Halte + Scroll-Anker**: `src/camera/tourPlan.ts` (three-frei, misst die
  Anker aus dem DOM). Mannschaft = Sticky-Strecke `100svh + 11 × 30svh`;
  Musik-Sektion `260vh` mit vier Halten (Tür → Raum → verweilen → Tür).
* **Kamera-Route**: `src/camera/tourRoute.ts`
  * Position: zentripetale Catmull-Rom je Außen-Strecke durch Halte +
    Zwischenpunkte (Überflug angehoben, um Tor/Zaun/Karten herum),
    Bogenlängen-parametrisiert, Ease je Etappe (weiches Ankommen).
  * Blick: getrennt — Richtung per Slerp (smootherstep), Blickweite linear.
    Karte → Torwart: Blickpunkt wandert auf dem Platz (Mitte → Torwart).
  * Kosten je Etappe = Weglänge + 2.2 × Drehwinkel (rad).
  * Wald: `keepInClearing` hält die Kamera unterhalb der Kronen in der
    Lichtung (`forestLayout` CLEARING).
* **Fahrt** (`CameraRig.tourFrame`): kritisch gedämpfte Feder (SmoothDamp,
  0.34 s) auf der Kosten-Achse, Tempo ≥ 5.2 m/s und ≥ Rest/1.5 s → kurze
  Etappen ~1 s, weite Sprünge ≤ ~1.5–2 s, stetige Geschwindigkeit
  (vorher Exponential-Dämpfung: jeder Rad-Tick startete mit Maximaltempo).
  Kein Scroll-Snap, keine Sperre; schnelles Scrollen überspringt Spieler.
* **Partyraum**: eigene Etappen; der CameraRig schreibt `partyProgress`,
  `PartyDirector` setzt nur Schleier/Audio. Rein und raus auf demselben Weg
  (Tür-Durchflug, warmer Schleier nur am Welt-Hop). Karten-Modus: beim
  Schließen Rückweg Raum → vor die Tür (2,2 s), dann Flug (vorher Schnitt).
* **Spieler zu Spieler**: `teamFocus` (teamLayout) → Karten drehen sich voll
  zur Kamera, Nachbarn abgedunkelt (Farbe, nicht Deckkraft); DOM-Begleittext
  Nummer (Gold) · Position · Name · „05 / 11“ (`PlayerCardGrid`, Stil am Ende
  von `cards.css`). Handy: 3D-Karten wie am Desktop (Textur 512 px),
  Begleittext unten, fov 56° an den Karten.
* **Karte ↔ Rundgang**: `src/map/intro.ts` (Scroll-Hooks). Der auslösende
  Scroll-Weg wird übernommen (`takeTourCarry`), die Übergabe gleicht nur
  0,3 s an (Ease-out). Ganz oben weiter hoch → Karte (Pose identisch).
* **reduced-motion**: statische Seite (Fallback, keine Fahrten) — unverändert.

## Messen / Beweise (lokal, nicht im Repo)

`_rundgang/tour.mjs <url> <out> <desk|mob> <perf|shots|video|enter>` —
Headless-Chromium `--use-angle=metal --enable-gpu --ignore-gpu-blocklist`,
DPR 1, echte Scroll-Gesten (CDP `synthesizeScrollGesture`, Rad bzw. Touch).
Ausgabe unter `shots-rundgang/`.
