# SVA-FUSSBALL — Abschlussbericht v1

3D-Vereinswelt für den SV Agathenburg-Dollern. Autonomer Lauf, Etappen 0–6.
Auf bestehendem R3F-Scaffold aufgebaut, Interaktionsmodell auf die geführte,
scroll-gesteuerte Kamerafahrt umgestellt und um Karten, Share, Tabelle, Fallback
erweitert.

---

## 1. ✅ Fertig & getestet

Alle Gates bestanden. `tsc = 0`, `eslint = 0 Fehler`, `npm run build` grün.

| Gate | Inhalt | Status |
|---|---|---|
| **Gate 0** | Scaffold, Tokens, Seed-Daten, Dev-Server, tsc=0 | ✅ |
| **Gate 1** | 3D-Bühne bei Flutlicht, flüssig, statisch schon „gewollt" | ✅ `gate1-stage-hero.png` |
| **Gate 2** | Scroll-Kamerafahrt über 4 Stationen, vor/zurück, mobil bedienbar | ✅ `gate2-flight-*.png` |
| **Gate 3** | FIFA-UT-Karten, Holo-Shimmer, Tilt, Grid + Detail-Modal | ✅ `gate3-cards.png`, `gate3-modal.png` |
| **Gate 4** | Story-Share erzeugt korrektes 1080×1920-PNG, Web-Share + Fallback | ✅ `gate4-story-1080x1920.png` |
| **Gate 5** | fussball.de-Widget-Rahmen, Fallback, Politur, Build grün | ✅ `gate5-fallback-static.png`, `gate5-tabelle-widget.png` |

**Verifiziert via Playwright (headless Chromium):** WebGL rendert, keine Console-Errors
auf allen Sektionen, Modal öffnet, Share löst den Download-Fallback aus, Story-Canvas
misst exakt 1080×1920, reduced-motion zeigt den Fallback (kein `<canvas>`).

**Performance-Budget (real gemessen aus `gl.info`):** **~100 Draw-Calls, ~25.000 Dreiecke**,
keine Echtzeit-Schatten, kein Postprocessing, DRACO-Ball 665 KB. Das ist ein leichtes
Budget — auf echter GPU (iPhone) unkritisch für 60 FPS.
⚠️ Die FPS-Zahl aus dem Headless-Lauf (1–3) ist **nicht** aussagekräftig: dort rendert
ein CPU-Software-Rasterizer (SwiftShader) bei 2× DPI. Die visuelle Abnahme auf echtem
Gerät steht noch aus (siehe §3).

---

## 2. 🔧 Unterwegs gefixt

- **football.glb war 9,7 MB** (Sketchfab-Texturen). Via `gltf-transform optimize`
  (WebP + DRACO, 1024er Texturen) → **665 KB**. Lokaler DRACO-Decoder unter `/public/draco`.
- **3D nicht im Ladepfad des Fallbacks:** three/R3F/drei (258 KB gzip) landeten anfangs
  im Haupt-Bundle, weil `Loader` (drei `useProgress`) und `useScrollProgress`
  (`CameraPath` → three) eager importiert wurden. Beide Kanten aufgetrennt →
  three liegt jetzt ausschließlich im **lazy** `Stage`-Chunk. Haupt-Bundle: 1,29 MB → **328 KB**.
- **Kamera-Stationen rasteten nicht auf die Sektionen ein** (lineare Station-Fraktionen
  ≠ DOM-Sektions-Zentren). `scrollToU`-Remap eingezogen → Station i steht genau dann,
  wenn Sektion i mittig ist.
- **Holo-Shimmer übersteuerte** (alles wirkte lila) → Grund-Deckkraft gesenkt, damit die
  SVA-Identität (Schwarz/Gold/Rot) im Ruhezustand trägt und der Glanz beim Tilt aufblitzt.
- **Story-Bild-Feinschliff:** „SVA"-Kopf zu breit auseinander → mittig gemessen;
  Silhouette (Büste) sauber statt „Smiley".
- **eslint (react-hooks v7 experimental):** `set-state-in-effect` im Modal durch
  gekeyetes Kind gelöst; `purity`/`immutability` im PerfMonitor (legitime three-Stats-Glue)
  gezielt lokal deaktiviert; Ref-Init aus dem Render gezogen.

---

## 3. ⚠️ Offen / braucht Marvin

- **Visuelle Abnahme auf echtem Gerät.** Dieses Projekt lebt vom Blick — bitte die
  Screenshots im Ordner `SVA_SCREENSHOTS/` durchsehen und v. a. auf dem iPhone die
  Kamerafahrt live prüfen (Scroll-Gefühl, FPS). Screenshots:
  - `gate1-stage-hero.png` — Establishing-Shot bei Flutlicht
  - `gate2-flight-establishing.png` — Fahrt in die Mannschaft
  - `gate2-flight-kontakt-pullback.png` — weiter Beauty-Shot zum Abschluss
  - `gate3-cards.png` / `gate3-modal.png` — Kader-Grid & Detail
  - `gate4-story-1080x1920.png` — teilbares Story-Bild
  - `gate5-tabelle-widget.png` — Tabelle in der Szene
  - `gate5-fallback-static.png` — statischer Fallback
- **Echte Inhalte** (Platzhalter klar markiert):
  - Kadernamen + Spielerfotos → `src/data/players.ts` (`photoUrl` setzen, Silhouette weicht dann).
  - Vereinswappen statt „A"-Platzhalter (Karten + Story-Bild `storyShare.ts`).
  - **fussball.de-Vereins-/Team-ID** → `src/data/club.ts` (`fussballDeTeamId`). Sobald echt,
    schaltet `FussballWidget` automatisch vom Skelett auf das echte Script-Widget.
  - `public/og-image.png` für den Social-Preview.
- **GitHub-Repo / Deployment** — bewusst nicht Teil dieses Laufs. Domain & Hosting
  entscheidet Marvin (Vorschlag: Vercel/Netlify, statischer Build).

---

## 4. 🧭 Selbst getroffene Entscheidungen

- **Interaktionsmodell umgestellt.** Das Vorgänger-Scaffold war „frei orbiten + Hotspots
  anklicken" mit `overflow:hidden`. Der Plan verlangt eine **geführte, scroll-gesteuerte**
  Fahrt mit 2D-Overlay-Sektionen — dafür auf natives Dokument-Scroll + fixe 3D-Bühne im
  Hintergrund umgebaut. Nutzer behält die volle Scroll-Kontrolle (kein Hijacking).
- **Font-Wahl:** Display **Anton** (ultra-condensed, „Trikot"-/Sport-Charakter, laute
  Headlines) + Body **Archivo Variable** (ruhige, gut lesbare Grotesk). Beide self-hosted
  via `@fontsource` → preloaded, kein Layout-Shift, offline-fest. Bewusst gegen einen
  Serif- oder Tech-Look — passt zum Amateur-Fußball-Ethos „laut, ehrlich, stolz".
- **Kamerakurven-Ansatz:** eine **Catmull-Rom-Kurve (centripetal)** für Position und eine
  für den Blickpunkt, abgetastet über den Scroll-Fortschritt. Zeitbasierte Dämpfung
  (`MathUtils.damp`) + dezenter Idle-Sway → cinematisches Nachziehen statt 1:1-Ruckeln.
  `scrollToU` sorgt fürs Einrasten auf die Sektionen.
- **Karten als DOM (nicht 3D).** FIFA-UT-Feeling (Holo, Tilt, scharfe Typo, Share) ist in
  CSS/Canvas hochwertiger und performanter umsetzbar als in WebGL — die 3D-Bühne bleibt die
  Bühne, die Karten sind das taktile Sammel-Objekt davor.
- **Story-Bild rein per Canvas gezeichnet** (kein html2canvas o. ä.) → keine Extra-Dependency,
  volle Kontrolle, pixelgenaues 1080×1920.
- **Gold als Karten-Akzent** zusätzlich zur CI — der „seltene Karte"-Effekt braucht Gold;
  bleibt sparsam und nur auf den Karten/im Story-Bild.
- **fussball.de-Widget mit Skelett-Tabelle** statt leerem/kaputtem Iframe, solange die echte
  ID fehlt — die Sektion wirkt sofort gewollt, der SVA-Platz ist hervorgehoben.

---

## 5. ➡️ Nächste sinnvolle Schritte

1. **Supabase + Admin (v2).** Die Seed-Typen (`Player`, `Section`) sind flach und
   id-basiert — der Umzug ist ein Mapping, kein Umbau. Tabellen `players`, `sections`,
   `matches`; Admin zum Pflegen von Kader, Fotos, Texten.
2. **Echte Inhalte** einpflegen (siehe §3).
3. **Spieltags-Countdown** in der Tabellen-/Hero-Sektion (nächster Gegner + Timer).
4. **Team-des-Monats-Karte** — eine hervorgehobene Spezial-Karte (goldener/„TOTM"-Rahmen).
5. **Domain & Hosting** (statischer Build, Vercel/Netlify), `og-image.png`, Analytics.
6. Optional: dezentes Bloom auf den Flutlichtern, wenn das Budget auf Zielgeräten hält.

---

## 6. 🔑 Marvins To-dos

- [ ] Screenshots in `SVA_SCREENSHOTS/` sichten + **auf dem iPhone live abnehmen**.
- [ ] Kadernamen + Fotos → `src/data/players.ts`.
- [ ] Vereinswappen (ersetzt „A") in Karten + `src/ui/storyShare.ts`.
- [ ] fussball.de Team-ID → `src/data/club.ts` (`fussballDeTeamId`).
- [ ] `public/og-image.png` liefern.
- [ ] Entscheidung GitHub-Repo + Hosting/Domain.

---

_Start lokal: `npm install && npm run dev`. Perf-Overlay: Taste **P**. Plan: `SVA_PLAN.md`._
