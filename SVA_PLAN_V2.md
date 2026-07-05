# SVA-FUSSBALL — Master-Prompt v2.1: Audit + Platz-Veredelung + Kinnlade (autonomer Lauf, Fable 5)

> **An Claude Code (Fable 5):** Speichere diesen Plan als `SVA_PLAN_V2.md` (ersetzt ggf. vorhandene Version). Autonom, Gate für Gate, Commit + Screenshot pro Etappe (SVA_SCREENSHOTS/, Präfix v2-). ARBEITSMODUS SPARSAM. Leitplanken aus v1 gelten: Performance-Budget hart (iPhone flüssig), reduced-motion/WebGL-Fallback intakt, SVA-Rot `#E91D29` / SVA-Schwarz `#231F20` (nie Bordeaux, nie Lavendel), Qualität schlägt Umfang.
>
> **Kontext:** v1 wurde mit Opus 4.8 gebaut und von Marvin abgenommen: Konzept (geführte Scroll-Fahrt statt freier Begehung) ist BESTÄTIGT und bleibt. Sein Haupt-Feedback: „Das Platz-Modell wirkt noch amateurhaft." Dein Auftrag: erst auditieren, dann veredeln, dann den Kinnlade-Moment bauen.

## 1. Etappe 0 — Fable-5-Audit von v1 (bauen verboten, nur analysieren)

Lies den kompletten v1-Code mit frischem Blick: Szenen-Aufbau, Material-/Licht-Setup, Kamerakurve, Karten, Share, Fallback. Miss die Perf-Baseline (P-Overlay, Frametime an Hero / Mannschaft / Kontakt). Beantworte dir schriftlich in `SVA_AUDIT_V2.md`: (a) Was sind die 5 größten visuellen Schwächen, geordnet nach Hebel? (b) Wo ist der Code für die kommenden Etappen im Weg (z.B. hartcodierte Licht-Werte, fehlende Material-Abstraktion)? (c) Ist der v2-Plan unten der effizienteste Weg zum Kinnlade-Moment — oder würdest du Reihenfolge/Zuschnitt ändern? Wenn ja: passe die Etappen-Reihenfolge selbst an und dokumentiere es. Die v1-Selbstanalyse (schwebende Flutlichter, Hero-Übergang, Karten-Silhouetten) fließt ein.
**🟢 Gate 0:** Audit-Datei liegt vor, Baseline dokumentiert, ggf. angepasster Etappen-Plan begründet.

## 2. Etappe 1 — Platz-Veredelung (Marvins Kernwunsch — hier entscheidet sich alles)

Grundsatz: **Konsistenz schlägt Detailgrad.** Entscheide dich für EINE Stilrichtung und zieh sie kompromisslos durch — empfohlen: „veredelte Stilisierung" (bewusst reduzierte Formen, aber professionelles Licht/Material/Grading). Kein Mix aus Foto-Anspruch und Spielzeug-Objekten — genau der Mix liest sich als „amateurhaft".

Die konkreten Hebel (alle umsetzen, sofern das Perf-Budget hält — Reihenfolge nach Audit):
1. **Rendering-Fundament:** ACES-Filmic-Tone-Mapping, korrekte sRGB/Color-Space-Kette, dezentes Environment-Licht (CC0-HDRI in Dämmerungs-Stimmung, z.B. Poly Haven, stark heruntergedimmt) als Fülllicht — das Flutlicht bleibt der Star.
2. **Der Rasen:** echte Proportionen (105×68 m Spielfeld, korrekte Linienmaße: Mittelkreis 9,15 m, Strafraum 16,5 m, Fünfmeterraum, Elfmeterpunkt) — korrekte Linien sind der billigste „das ist echt"-Trick. Mähstreifen (Shader-Stripes oder CC0-Textur), subtile Roughness-Variation, sattes aber nicht giftiges Grün unter warmem Flutlicht.
3. **Silhouetten-Disziplin:** Alles, was aus der Nähe billig wirkt, wird entweder veredelt oder in die Tiefe verbannt: Kugel-Bäume raus → dunkle Baumreihen-Silhouette im Nebel hinter der Bande; boxiges Vereinsheim → entweder gutes Low-Poly mit Dachüberstand + warm leuchtenden Fenstern in Halbdistanz ODER komplett als Silhouette. Tore mit echter Netz-Andeutung (transparente Textur), Bande mit dezenten SVA-Schriftzügen.
4. **Tiefe & Boden:** abgestufter Fog (Platz klar, Welt dahinter verschwimmt), ContactShadows/gebackene AO unter allen Objekten — schwebende Objekte sind der #1-Amateur-Verräter.
5. **Assets:** Nur CC0-Quellen (Poly Haven für Texturen/HDRI o.ä.), Herkunft im Audit-File notieren. Kein Lizenz-Graubereich.
**🟢 Gate 1:** Vorher/Nachher-Screenshots von 3 Kamerapositionen; Frametime innerhalb Baseline ±10%; Selbst-Test: „Würde ein Awwwards-Juror den Platz als gewollt gestaltet lesen?" — ehrliche Antwort ins Audit-File; Fallback-Standbild profitiert mit.

## 3. Etappe 2 — Flutlicht mit Substanz

Sichtbare Masten (4 Ecken, korrekte Silhouette: schräge Streben, Lampenraster), Lichtkegel als Fake-Volumetrik (transparente Kegel-Meshes, weicher Gradient — kein echtes volumetrisches Licht), dezentes selektives Bloom nur auf Lampenflächen wenn Budget hält (messen, entscheiden, dokumentieren), Licht-Lachen am Boden.
**🟢 Gate 2:** Screenshots, Frametime gehalten, Masten auch im Fallback sichtbar.

## 4. Etappe 3 — Der Anstoß (Signature-Beat)

Höhepunkt beim Übergang Hero → Mannschaft: Kamera fällt beschleunigend aus der Vogelperspektive auf Rasenhöhe hinter den Anstoßkreis, Flutlicht flackert sequenziell an (Mast für Mast, 4 Beats), der Ball rollt vom Anstoßpunkt an der Kamera vorbei, dezente Partikel im Lichtkegel, dann beruhigt sich die Fahrt in die Mannschaft. Regeln: scroll-getrieben (rückwärts = rückwärts, kein Video-Gefühl), 1,5–2,5 s gefühlter Scrollweg, optionaler Sound-Trigger (Stadion-Swell, default AUS, Autoplay-Regeln; ohne verfügbares Asset → Trigger vorbereiten, Asset als To-do).
**🟢 Gate 3:** Vorwärts wie rückwärts flüssig (Frametime-Beweis), mobil kontrollierbar, 3-Frame-Screenshot-Sequenz.

## 5. Etappe 4 — Karten auf Sammler-Niveau

1. **Portrait-Pipeline:** `photoUrl` gesetzt → automatische Behandlung; BEIDE Varianten bauen und per Konstante umschaltbar: (A) Duotone in Team-Farben, (B) Freisteller-Look mit Licht von oben. Screenshots beider Varianten für Marvins A/B-Wahl. Platzhalter-Silhouette als Fallback aufwerten (Rim-Light-Andeutung).
2. **Team-des-Monats-Spezialkarte:** ein Rahmen-Level über normal (intensiverer Gold-Akzent, eigener Holo-Verlauf, Banner „Spieler des Monats"), Flag in players.ts, eine Seed-Karte markiert.
**🟢 Gate 4:** Beide Portrait-Varianten als Screenshot, Spezialkarte hebt sich ab ohne Kitsch, Grid-Performance unverändert (offscreen pausiert).

## 6. Etappe 5 — Abschluss

Screenshots v2 komplett, Perf-Tabelle Baseline→Ende, Build grün, committen/pushen. Abschlussbericht im 6-Punkte-Format — zusätzlich zwingend: ehrliche Selbsteinschätzung („Kinnlade erreicht? Wo noch nicht?"), die Portrait-A/B-Frage als klare Entscheidung für Marvin, und die Top-3 der verbleibenden visuellen Schwächen.

## Nicht in diesem Lauf
Neue Sektionen, freie Begehung (Konzept bestätigt: geführte Fahrt), Supabase/Admin, Deployment/Domain, weitere Mannschaften.

---
**Los. Erst Audit, dann Veredelung, dann Drama. Konsistenz schlägt Detailgrad, Frametime ist die Wahrheit. Am Ende: Abschlussbericht mit Screenshot-Beweisen.**
