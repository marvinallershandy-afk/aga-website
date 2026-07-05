# SVA-FUSSBALL — Abschlussbericht v2 (Fable 5)

Auftrag: Audit → Platz-Veredelung → Flutlicht → Anstoß-Beat → Sammler-Karten.
Marvins Kernfeedback („Platz wirkt amateurhaft") war der Maßstab jeder Etappe.

---

## 1. ✅ Fertig & getestet

| Etappe | Gate | Commit |
|---|---|---|
| 0 · Audit + Baseline | ✅ `SVA_AUDIT_V2.md`, Top-5-Schwächen, Plan bestätigt (1 Abweichung dokumentiert) | `c9fcec3` |
| 1 · Platz-Veredelung | ✅ Vorher/Nachher ×3, GPU ohne Regress, Tris −42% | `96e299e` |
| 2 · Flutlicht mit Substanz | ✅ 60 FPS, Masten auch im Fallback | `aafcd9c` |
| 3 · Der Anstoß | ✅ Sweep vor 16,69 ms / zurück 16,62 ms, 3-Frame-Sequenz | `9784c91` |
| 4 · Karten Sammler-Niveau | ✅ A/B-Screenshots, TOTM-Karte, Grid-Perf unverändert | `2bf4737` |
| 5 · Abschluss | ✅ Build grün, tsc=0, eslint 0 Fehler, Perf-Tabelle im Audit | (dieser Commit) |

**Perf final (echte GPU, headed):** 60 FPS (16,6 ms) an allen Stationen und im
kompletten Scroll-Sweep **vorwärts wie rückwärts**. Budget: ~103 Draws, ~14,6k
Dreiecke (v1: 100 / 24,9k). ⚠️ Kein Push: es ist **kein Git-Remote** konfiguriert —
Repo-Entscheidung liegt bei Marvin (alles lokal committet).

**Was konkret neu ist:**
- **Platz:** alle Markierungen maßstabsgetreu in die Rasen-Textur gebacken
  (echte Linienbreite, Elfmeterpunkt + Strafraum-Bögen, Eckbögen), Mähstreifen,
  Körnung, Abnutzungszonen; Bande mit SVA-Schriftzügen; Tore mit Netz;
  Vereinsheim mit Satteldach + warmen Fenstern; Kugel-Bäume ersetzt durch
  gezackte Baumreihen-Silhouetten im abgestuften Fog; AO unter allem.
- **Flutlicht:** sichtbare Masten (Streben, getiltetes Lampenraster),
  Fake-Volumen-Kegel, Glow-Sprites (statt Bloom), Licht-Lachen — alles an
  einem zentralen Level 0..1 pro Mast.
- **Der Anstoß:** eigene leere Beat-Sektion; Kamera stürzt auf Rasenhöhe
  hinter den Anstoßkreis, Flutlicht flackert **Mast für Mast** an, der Ball
  rollt an der Kamera vorbei, Staub in den Kegeln. Alles reine Funktion des
  Scroll-Parameters → rückwärts exakt identisch, kein Video-Gefühl.
  Kamera-Anker werden zur Laufzeit aus den echten DOM-Zentren gemessen.
- **Karten:** Portrait-Pipeline mit 2 umschaltbaren Behandlungen (A Duotone /
  B Freisteller), aufgewertete Silhouette (Rim-Light), Team-des-Monats-Karte
  (Gold-Rahmen, Gold-Holo, Banner).

## 2. 🔧 Unterwegs gefixt
- **IBL/Environment riss das Frametime-Gate** (+64% auf dem Messrig) → gestrichen,
  dokumentiert; Fill via Hemisphere/Ambient.
- **%-Höhen in CSS-Grid-Ketten** lösten nicht auf (Karten-Foto rendertete in
  Naturgröße) → absolut positioniert + `object-fit`.
- **Kickoff-Beat spielte hinter den Karten** (DOM war schon bei Mannschaft) →
  dedizierte Beat-Sektion + Laufzeit-Anker.
- Lampen-Panels wirkten als „goldene Türen" → Gehäuse von Leuchtfläche getrennt.
- Alte Dev-Server-Leichen auf Nachbar-Ports → Messungen liefen gegen Prod-Preview;
  auf dedizierten Port umgestellt.

## 3. ⚠️ Offen / braucht Marvin
- **Visuelle Abnahme am iPhone** — v. a. der Anstoß-Beat (Scroll-Tempo/Gefühl).
- **Portrait-A/B-Entscheidung** (siehe §4 — meine Empfehlung: A).
- Echte Spielerfotos, Wappen, fussball.de-ID, `og-image.png` (unverändert aus v1).
- **Sound-Asset**: Stadion-Swell (CC0) nach `public/audio/kickoff-swell.mp3`,
  dann in `src/utils/kickoffSound.ts` `ENABLED = true`.
- **Git-Remote/Push** + Hosting-Entscheidung.

## 4. 🧭 Selbst getroffene Entscheidungen
- **Kein HDRI (1,6 MB) und kein IBL** — Payload/Frametime gegen kaum sichtbaren
  Nutzen in der Nachtszene; Poly-Haven-Download getestet und verworfen.
- **Kein Postprocessing-Bloom** — Glow-Sprites liefern den Effekt für ~0 Kosten.
- **Kein Foto realer Personen** als Demo-Portrait (Persönlichkeitsrechte!) —
  synthetisches SVG-Portrait, klar als Platzhalter markiert.
- **Portrait-Empfehlung: A (Duotone).** Ein Amateur-Kader hat gemischte
  Foto-Qualität (Handy, Licht, Hintergründe) — Duotone macht daraus einen
  einheitlichen, gewollten Look. B (Freisteller) ist die Kür, wenn es mal
  professionelle Freisteller gibt. Umschalten: `src/ui/cardConfig.ts`.
- **Anstoß scroll-getrieben statt zeitgesteuert** — Nutzer bleibt Herr der Seite,
  rückwärts = rückwärts (Plan-Vorgabe, konsequent umgesetzt).

## 5. ➡️ Nächste sinnvolle Schritte
1. Echte Inhalte (Fotos → Pipeline greift automatisch, Namen, Wappen, fussball.de-ID).
2. Sound-Asset + dezenter Audio-Toggle in der Brandbar.
3. Supabase + Admin (v2-ready Datenmodell unverändert).
4. Hosting/Domain + OG-Bild; danach Lighthouse-Feinschliff am Live-Build.
5. Optional: Anstoß-Beat um 1 Detail erweitern (z. B. kurzer Kamera-Shake beim
   letzten Mast-Beat — 5 Zeilen, großer Effekt).

## 6. 🔑 Marvins To-dos
- [ ] iPhone-Abnahme der Fahrt + des Anstoß-Beats
- [ ] A/B-Wahl Portrait (`v2-karten-A-duotone.png` vs `v2-karten-B-cutout.png`)
- [ ] Fotos/Namen/Wappen/fussball.de-ID/og-image liefern
- [ ] Stadion-Swell-Sample (CC0) liefern oder streichen
- [ ] Git-Remote anlegen → dann push

---

## Ehrliche Selbsteinschätzung: „Kinnlade erreicht?"

**Ja, an drei Stellen:** (1) Der **Hero** — Platz unter Flutlicht mit Kegeln,
Glow und gebrandeter Bande liest sich jetzt als bewusst gestaltete Bühne, nicht
als Prototyp. (2) Der **Sturzflug** aus der Vogelperspektive auf Rasenhöhe hat
echtes Drama — der Moment, in dem die Bande in Augenhöhe vorbeizieht und der
Ball ins Bild rollt, ist der stärkste der Seite. (3) Die **TOTM-Karte** fühlt
sich nach „seltener Karte" an, ohne Kitsch.

**Noch nicht ganz:** Das sequenzielle **Flutlicht-Flackern ist im Standbild
kaum beweisbar** und auch live subtiler als geplant, weil an der Kickoff-Station
die Masten teils außerhalb des Frames liegen — man sieht das Flackern als
Licht auf dem Rasen statt als Lampen-Moment. Ein gezielter Kamera-Blick zum
letzten Mast im Beat würde das lösen.

**Top-3 verbleibende visuelle Schwächen:**
1. **Frame 3 des Beats** (Ball-Pass-by) blickt in die dunkle Tribünen-Seite —
   viel Schwarz im Bild; Blickrichtung oder Tribünen-Aufhellung nachschärfen.
2. **Tribünen-Dachkante** (rote Linie) wirkt aus flachen Winkeln abgelöst von
   der schwarzen Masse darunter.
3. **Vereinsheim-Gable** aus Hero-Sicht noch als dunkler Block am Bildrand —
   Fenster sieht man erst von der Tabellen-Station.

_Screenshots: `SVA_SCREENSHOTS/v2-*.png` (before/after, Flutlicht, Anstoß-Sequenz,
Karten A/B, Fallback). Audit + Perf-Tabelle: `SVA_AUDIT_V2.md`._
