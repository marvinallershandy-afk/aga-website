# SVA-FUSSBALL — Master-Prompt v3: Echtes Agathenburg + Sound-Welt (autonomer Lauf, Fable 5)

> **An Claude Code:** Speichere diesen Plan als `SVA_PLAN_V3.md`. Autonom, Gate für Gate, Commit + Screenshots (Präfix v3-) pro Etappe. ARBEITSMODUS SPARSAM. Alle v1/v2-Leitplanken gelten: 60-FPS-Budget ist hart (v2-Baseline halten!), reduced-motion/WebGL-Fallback intakt, SVA-Rot `#E91D29` / SVA-Schwarz `#231F20`, Qualität schlägt Umfang.
>
> **Auftrag in einem Satz:** Aus „ein schöner Fußballplatz" wird „DAS ist unser Platz in Agathenburg" — plus eine Klangwelt mit Marvins eigener Musik.
>
> **Rechte-Lage (geklärt, nicht hinterfragen):** Alle Songs im REFERENZ-Ordner sind von Marvin selbst geschrieben (Urheber, Vertrieb via CD Baby non-exklusiv) — freie Nutzung inkl. beider Cover. Cover 2 = offizielles Album-Artwork. Cover 1 (zensierte Person mit Banner) ist lizenziert und dient zusätzlich als visuelle Referenz für das Fanblock-Finale. KEINE fremde Musik, keine fremden Assets außer CC0.

## 0. Vorab-Entscheidungen
- Portrait-Pipeline: **Variante A (Duotone)** ist gesetzt (Empfehlung aus v2; Marvin kann per `cardConfig.ts` jederzeit auf B wechseln).
- Git-Remote: In Etappe 0 prüfen — existiert eines, pushen; existiert keines, lokal weiterarbeiten und im Bericht als Marvin-To-do listen (leeres GitHub-Repo `sva-fussball` anlegen + URL geben).

## 1. Etappe 0 — Referenz-Rekonstruktion (das Puzzle — bauen verboten)
Frame-Extraktion (ffmpeg, alle 2–3 s) → Sichtung → `REFERENZ_MODELL.md` mit Frame-Belegen + Offene-Fragen-Sektion.
**🟢 Gate 0:** REFERENZ_MODELL.md vollständig, jede Kernaussage frame-belegt, offene Fragen gelistet.

## 2. Etappe 1 — Agathenburg-Treue: die Szene an die Realität anpassen
Platz-Ausrichtung, Vereinsheim an echte Position mit erkennbarer Silhouette, Baumreihen real, Bande/Zuwege, Fanblock-Ecke benannt. Stilisierung bleibt.
**🟢 Gate 1:** 4–5 Vergleichspaare Referenz vs. Render; Frametime in v2-Baseline.

## 3. Etappe 2 — v2-Restschwächen fixen (eigene Top-3)
Lampen glühen sichtbar auf; Beat-Frame-3-Komposition; Dachkanten/AO-Fix.
**🟢 Gate 2:** Vorher/Nachher aller drei Punkte, Frametime gehalten.

## 4. Etappe 3 — Das Sound-Eingangstor + Vorhang-Reveal
Eingangs-Screen (Logo, Claim, „Mit Ton betreten"/„Ohne Ton"), Vorhang-Reveal, localStorage, Mute-Toggle, verkürztes Tor für Wiederkehrer, Fallback = Fade.
**🟢 Gate 3:** Beide Pfade ok, Reveal mobil flüssig, Wahl gemerkt, Mute erreichbar, Fallback sauber.

## 5. Etappe 4 — Klangwelt & Marvins Musik
AudioManager (Atmo- + Musik-Kanal, Ducking), Stadion-Atmo (CC0 oder Slot), Tracks als MP3 nach public/audio, Musik-Menü mit Cover-2-Artwork, Anstoß-Swell-Asset.
**🟢 Gate 4:** Track spielt nach Einwilligung, Ducking per Gain belegt, Menü mobil, Audio-Gesamtgewicht im Bericht.

## 6. Etappe 5 — Das Fanblock-Finale
Kamera endet in der Fanblock-Ecke: stilisierte Low-Poly-Figuren in SVA-Trikots mit nachgebautem AGA-URKNALL-Banner, CTA „Komm vorbei", Atmo zieht an.
**🟢 Gate 5:** Screenshots, Banner lesbar, Figuren stilisiert, CTA sichtbar, Frametime gehalten.

## 7. Etappe 6 — Der Partyraum (Bonus-Beat)
Button am Vereinsheim → Kamera durch die Tür: warme dunkle Stimmung, Tresen + zapfende Figur, Lichterkette SVA-Rot, Cover-2-Poster, Musik in den Vordergrund, Raum lazy.
**🟢 Gate 6:** Übergang flüssig, Klangwechsel ok, Raum lazy (Netzwerk-Beweis), Frametime draußen unberührt.

## 8. Etappe 7 — Abschluss
Screenshots komplett, Perf-Tabelle v2→v3, Build grün, Commit (+Push falls Remote). Abschlussbericht 6-Punkte + Offene-Fragen-Defaults + „Erkennt ein Agathenburger seinen Platz?" + Audio-Herkunft + Top-3.

## Nicht in diesem Lauf
Deployment/Domain, Supabase/Admin, weitere Mannschaften, Sponsoren-Sektion, echte Spielerfotos.
