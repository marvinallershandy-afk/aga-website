# SVA-FUSSBALL — Master-Prompt v1: 3D-Vereinswelt (autonomer Lauf)

> **An Claude Code:** Speichere diesen Plan zuerst unverändert als `SVA_PLAN.md` ins Projekt. Arbeite ihn autonom ab, Gate für Gate, Commit pro Etappe. Am Ende: **Abschlussbericht** (Abschnitt 8).
>
> **ARBEITSMODUS SPARSAM:** Output minimal, keine Zwischen-Erklärungen, eine Zeile pro Gate, ausführlich nur im Abschlussbericht.
>
> **Charakter dieses Projekts:** Das ist ein KREATIV-Projekt mit Awwwards-Anspruch — die Messlatte ist „Kinnlade runter beim ersten Scroll", nicht Feature-Vollständigkeit. Lieber eine atemberaubende Kamerafahrt und perfekte Karten als fünf mittelmäßige Sektionen. Qualität schlägt Umfang in jedem Zielkonflikt.

---

## 0. Kontext & Vision

**Website für den SV Agathenburg-Dollern (Amateurfußball-Verein).** Kern-Erlebnis: eine **begehbare 3D-Vereinswelt** — der Fußballplatz als Bühne, über die eine geführte, scroll-gesteuerte Kamerafahrt führt und die Sektionen der Seite inszeniert. Dazu **FIFA-Ultimate-Team-Style Spielerkarten** mit Holo-Shimmer und **One-Tap-Sharing als Instagram-Story**. Live-Tabelle via fussball.de-Widget.

- **CI:** SVA-Rot `#E91D29`, SVA-Schwarz `#231F20`, dazu Weiß und ein warmes Rasengrün als Bühnenfarbe. NICHT Bordeaux (`#7D1F2E` = Marvins Finanz-CI), NICHT Lavendel (Neles CI).
- **Performance-Realität:** Zielgerät iPhone (16 verifiziert 60 FPS-fähig), EINE Experience für alle Geräte — keine getrennte Mobile-Sparversion, aber ein sauberer Fallback (siehe Etappe 5).
- Stack: React/Vite/TS, React Three Fiber + drei, framer-motion für 2D-Motion, pnpm.
- **v1 OHNE Backend:** Spielerdaten/Inhalte als Seed-Daten (`src/data/*.ts`). Supabase + Admin ist bewusst v2 — Datenstruktur aber so typisieren, dass der Umzug später ein Mapping ist, kein Umbau.
- Ein `football.glb` liegt bereits in `~/picture-by-nele/public/models/football.glb` — prüfen und wiederverwenden statt neu beschaffen.

## 1. Leitplanken

1. **Performance-Budget ist hart:** flüssig im iPhone-Viewport (DevTools-Throttling als Proxy). Mittel: low-poly, gebackene/faked Beleuchtung statt Echtzeit-Schatten-Orgien, DRACO/komprimierte Assets, `<Suspense>` + Lazy-Load der 3D-Szene, nur transform/opacity im 2D-Motion, kein schweres Postprocessing (max. dezentes Bloom, wenn es das Budget hält).
2. **`prefers-reduced-motion` + WebGL-Fallback:** ohne WebGL oder mit reduced-motion → statische, trotzdem schöne Version (Hero-Bild des Platzes + normale Sektionen). Niemand sieht eine kaputte Seite.
3. **Awwwards-Anspruch konkret:** eine mutige typografische Stimme (Display-Font mit Charakter für Headlines — Kandidaten anschauen und selbst entscheiden, dokumentieren), großzügige Inszenierung, ein Signature-Moment (die Kamerafahrt), Mikro-Interaktionen mit Maß. Kein Template-Look, kein Standard-Bootstrap-Gefühl.
4. Kein Deployment auf eine Live-Domain in diesem Lauf — Build + lokale Preview + Push reichen; Domain/Hosting entscheidet Marvin.
5. Platzhalter-Inhalte klar als solche kennzeichnen (Spielernamen dürfen generisch sein: „Max Mustermann #10"), Struktur zählt.

## 2. Etappe 0 — Bestandsaufnahme & Scaffold
**🟢 Gate 0:** Dev-Server läuft, leere Szene rendert ein Test-Mesh in SVA-Farben, tsc = 0.

## 3. Etappe 1 — Die Bühne: der Platz in 3D
**🟢 Gate 1:** Szene rendert flüssig, sieht auch statisch schon gewollt aus (Screenshot in `SVA_SCREENSHOTS/`).

## 4. Etappe 2 — Die Kamerafahrt (Signature-Moment)
**🟢 Gate 2:** Komplette Fahrt flüssig, rückwärts genauso, Sektionen an richtigen Wegpunkten, auf Mobile bedienbar.

## 5. Etappe 3 — FIFA-UT-Spielerkarten mit Holo-Shimmer
**🟢 Gate 3:** Karten rendern im Grid flüssig, Tilt hochwertig, Detail-Ansicht funktioniert, Screenshots abgelegt.

## 6. Etappe 4 — One-Tap Instagram-Story-Share
**🟢 Gate 4:** Share erzeugt korrektes 1080×1920-PNG, Web-Share mit Feature-Detection, Fallback-Download.

## 7. Etappe 5 — Tabelle, Fallback, Politur
**🟢 Gate 5:** Reduced-Motion-Test zeigt statische Version sauber; Build läuft; Ladepfad optimiert.

## 8. Etappe 6 — Abschluss & Bericht

## 9. Bewusst NICHT in v1
Supabase/Admin-Backend, CMS, Newsbereich, mehrere Mannschaften/Jugend, Login, freie WASD-Begehung, Deployment.
