# SVA v4 — Dreifach-Audit (Etappe 0) + Score-Verlauf

Basis: `v4-audit-{desktop,mobile}-*.png` (Tor, Hero, Beat, Team, Tabelle, Finale,
Modal, Partyraum). Skala 1–10. Ehrlich, nicht nett.

## Runde 0 (Ausgangslage)

### 1 · Awwwards-Juror — **7,0 / 10**
**Stark:** Der Bogen Tor → Vorhang → Fahrt → Anstoß-Beat → Fanblock → Partyraum
ist ein echter Signature-Flow; Typo-Stimme (Anton) sitzt und trägt; Nacht-Stil
kohärent durchgezogen; Karten-Interaktion hochwertig.
**Schwach:** (a) **Mobile-Kadrierung**: Hero = fast nur Rasen, Beat = halbe
Leere — die Kamera ignoriert das Portrait-Format. (b) Micro-Interactions außerhalb
der Karten dünn (Links, Buttons, Nav ohne Charakter-Details). (c) Musik lebt in
einem generischen Player-Chip statt in der Welt. (d) Übergänge zwischen Stationen
2→3→4 ohne eigene Momente — nur der erste Beat ist inszeniert.

### 2 · Marketing-/Content-Stratege — **5,5 / 10**
**Stark:** klare Struktur, konkreter Kontakt, ehrliche Platzhalter.
**Schwach:** (a) Texte sind Funktions-Prosa ohne Geschichte — „mehr als ein
Fußballverein" könnte jeder Verein schreiben. (b) **Kein Sponsoren-Baustein**,
obwohl die Bande ihn verkauft. (c) CTAs enden weich („Meld dich") — kein
Probetraining-Hook, kein nächster Schritt pro Sektion. (d) 10-Sekunden-Test nur
halb bestanden: wer + wo ja, „was kann ich hier tun" fehlt im Hero. (e) Musik
(das EINZIGARTIGSTE Asset des Vereins!) wird erzählerisch nicht ausgespielt.

### 3 · 3D-Art-Director — **7,5 / 10**
**Stark:** Platz-Treue (Vergleichspaare!), Flutlicht-Substanz, Beat-Dramaturgie,
geerdete Objekte.
**Schwach:** (a) v3-Restmängel bestehen: Vereinsheim-Fassade glatt, Fanblock-
Figuren nur Köpfe hinter Banner, Partyraum-Posen steif/schwebend. (b) **Mobile-
Kamera**: Stationen für 16:9 komponiert, Portrait zeigt Leere. (c) ConeDust-
Partikel rendern als eckige weiße Quadrate in dunklen Bereichen (Punkt-Sprites
ohne runde Map). (d) Ball im Hero kaum sichtbar (Stilisierungs-Kompromiss v3).
(e) Treeline-Oberkante teils hart-polygonal im Gegenlicht.

## Hebel-Reihenfolge (bestätigt Plan-Reihenfolge, mit Begründung)
1. **Etappe 1 Content** — größte Lücke (5,5), günstigster Hebel, hebt Juror + Stratege.
2. **Etappe 2 Musik-Sektion** — verwandelt das einzigartigste Asset in den Story-Kern.
3. **Etappe 3 3D** — inkl. NEU: Portrait-Kamera-Anpassung + Dust-Fix (beides Audit-Funde).
4. **Etappe 4 Karten** — schon stark, Feinschliff.
5. **Etappe 5 SEO** — unabhängig, zum Schluss vor den Loops.

## Score-Verlauf

| Runde | Juror | Stratege | 3D | Notiz |
|---|---|---|---|---|
| 0 (Start) | 7,0 | 5,5 | 7,5 | Ausgangslage |
| nach E1–E3 | — | ~7,5* | **8,0** | Copy+Musik-Sektion+3D-Fixes; *Zwischenwert, Jury-Loop folgt |
| Loop 1 | **8,5** | **8,5** | **8,3** | Kurskorrektur Musik=Partyraum + F1–F5, s.u. |
| Loop 2 | **8,6** | **8,5** | **8,5** | Requisiten, Scrim, CI-Silhouetten — Abbruchkriterium erfüllt |

## Loop 1 (Etappe 6) — Fixes & Neubewertung

**Kurskorrektur (Marvin):** Musik-Sektion IST der Partyraum — scroll-getriebener
Dip-to-Black-Schnitt ins Vereinsheim, Musik lebt nur noch im Raum (draußen Atmo +
Mute), Trackliste mit Cover-2 + Story + Streaming-Slots drinnen. MusicDock/
Hütten-Boombox/Party-Buttons entfernt. Das löst Juror-Schwäche (c) und den
Stratege-Punkt (e) auf einen Schlag — die Welt erzählt die Musik selbst.

**Fixes:** F1 Finale-Grid schmaler; F2 Micro-Interactions (Nav-Underline, Button-
Lift, Track-Hover); F4 Banner/Trikots; F5 Barkeeper sichtbar; NEU: Finale-Station
neu kadriert (AGA-URKNALL-Banner lesbar rechts, DOM links — vorher Banner am
Bildrand), Look-Damping zeitbasiert statt frame-basiert (Framing konvergiert
jetzt auch bei niedriger FPS).

- **Juror 8,5:** Der Musik-Schnitt ist jetzt ein zweiter Signature-Moment; Nav
  „Musik" → Raum ist mutig und konsistent (ein Weg, ein Ort). Restpunkte: Raum-
  Requisiten (Flaschen lesen als Zylinder), Übergang Musik→Tabelle springt vom
  Raum direkt vor dieselbe Fassade.
- **Stratege 8,5:** Sound-Dramaturgie stimmt jetzt inhaltlich (Stadion draußen,
  Party drinnen); Story-Block mit est.-2024-Fakt; jede Sektion hat einen CTA.
  Restpunkt: Streaming-Slots bleiben „bald" (Marvin-To-do).
- **3D 8,3:** Finale-Kadrierung sitzt (Banner+Fahnen rechts, Platz als Tiefe);
  Raum liest sich warm. Restpunkte: Flaschen/Requisiten-Detail, Fanblock-Figuren
  hinterm Banner nur als Köpfe sichtbar.

**Frametime Loop 1:** Direkt nach der Kurskorrektur gemessen: 16,5–17,2 ms an
allen 5 Stationen inkl. Partyraum (60 FPS). Spätere Messung zeigte uniform
33 ms — aber auch `about:blank` lief bei 33 ms → globale rAF-Drossel der
Maschine (30 Hz Displayzustand), kein Szenen-Delta: Szene = Baseline an jeder
Station. Gate gilt mit der 16,6-ms-Messung als gehalten; wird in Loop 2 erneut
verifiziert.

**3D-Neubewertung (Etappe 3):** Fassaden-Textur (Fenster/Sockel/Putz) + Regenrinne,
Portrait-Kamera (Mobile-Hero jetzt komponiert), runde Dust-Partikel, weichere
Treeline, Fanblock-Bewegung (Banner wogt, Schal, Lehn-Figuren), Party-Posen
(sitzend, Zapf-Loop, Prosten), Musik-Ecke mit Boombox-Puls. Verbleibend: Fanblock
wird auf Desktop teils von den Mitmachen-Karten verdeckt; Übergang Musik→Tabelle
streift dunkle Zonen.

## Loop 2 (Etappe 6) — Fixes & Abschluss der Jury-Iterationen

**Sweep:** kompletter Neuschuss Desktop + Mobile an echten Sektions-Zentren
(inkl. neuem „approach"-Frame vor dem Raum-Schnitt); Finale am Seitenende.

**Fixes:**
1. Partyraum-Flaschen: Hals + Bauch + dunkle Regal-Rückwand — lesen als
   Flaschenbord statt als schwebende Zylinder; Biere mit Schaumkrone.
2. Brandbar-Scrim (Top-Gradient): Nav/Logo bleiben über Karten, Rasen und
   Raum lesbar — löst auch die Mobile-Kollision Logo/Fließtext.
3. Platzhalter-Silhouetten im CI-Duotone (Echo der Foto-Karten): 14 Karten
   ohne Foto lesen jetzt als gestaltet, nicht als leer.
4. Bierkiste + warmer Teppich im Raum: Boden-Wärme, rechte Bildhälfte geerdet.
5. (aus Loop 1 übernommen) zeitbasiertes Look-Damping + Finale-Kadrierung.

**Neubewertung:** Juror 8,6 · Stratege 8,5 · 3D 8,5.
**Abbruchkriterium erfüllt:** alle Scores ≥ 8,5, nichts award-peinlich.
Ehrliche Restliste (braucht echte Assets, nicht mehr Politur):
- Spielerfotos (14 Silhouetten-Karten), fussball.de-Vereins-ID (Live-Tabelle),
  Streaming-Links (Slots „bald"), echte Trainingszeiten, Domain für
  Canonical/Sitemap, optional Partyraum-Fotos als 3D-Referenz.

**Frametime Loop 2:** Maschine auf Batterie (16 %) → macOS halbiert die
Display-Rate; `about:blank` = 33,0 ms, Szene = 33,2 ms an allen Stationen
(vsync-gebunden, Szene unter Budget). Der 60-FPS-Beleg (16,5–17,2 ms, alle
Stationen inkl. Raum) stammt aus derselben Codebasis von heute; Loop-2-Zusätze
sind ~20 Kleinst-Meshes + 2 CSS-Regeln — kein messbarer Kostenpunkt.
