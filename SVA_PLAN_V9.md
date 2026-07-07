# SVA-FUSSBALL — Master-Prompt v9: Die 7-Stationen-Reise (autonom, additiv)

> Branch `v9-reise` von `v8-flow` (v8 noch nicht gemergt). Autonom, Gate für
> Gate, Commit + Push + Screenshots (v9-, Desktop+Mobile pro Station).
> ARBEITSMODUS SPARSAM. Leitplanken: 60 FPS am Netzteil, reduced-motion/
> Fallback intakt, SVA-Rot #E91D29/Schwarz nur für was WIR bauen, reale Dinge
> echte Farben, CC0 + Marvins Assets.

## ⚠️ OBERSTE REGEL: ADDITIV, NICHT ERSETZEND
Keine funktionierende, gute Station löschen, um Neues einzubauen — ERGÄNZEN
und NEU ORDNEN. Vor jedem Entfernen von „Gutem" (Fan-Block, Partyraum,
Karten, Hero): Kann ich es behalten und in die Reise einordnen? Fast immer ja.
Löschen = dokumentierte Ausnahme im Bericht, nicht der Normalfall.

## Die 7-Stationen-Reise
1. HERO „Willkommen am Platz" — bleibt.
2. ÜBERGANG → MANNSCHAFT — nur nahtloser Sinkflug (Flutlicht an, Ball rollt),
   KEINE eigene Station, butterweich.
3. MANNSCHAFT — bleibt, vollständig verlassen bevor nächste Station startet.
4. FAN-BLOCK — ZURÜCKHOLEN + AUSBAUEN (Marvins Lieblingsidee): Fans im
   SVA-Trikot, Banner wehen im Wind, leise Fangesänge (default aus/Toggle).
5. MUSIK/PARTYRAUM — bleibt, mit Geometrie-Fix (E3).
6. SPONSOREN — NEU: Banden-Zoom, „Hier könnte dein Logo stehen" groß, 1–2
   Dummy-Logos als Vorbild, Argumente + CTA. Die Geld-Station.
7. TABELLE → FINALE — Tabelle bleibt; Maps-Rauszoom bis der 3D-Platz das
   EINZIGE 3D-Element auf flacher 2D-Karten-Fläche ist; Mitmachen + WhatsApp
   + Route.

## Etappen & Gates
- **E0 Bestandsschutz-Inventar** (`SVA_BESTAND.md`): alles Gute + Fundort. Gate 0: Liste + Baseline + Branch + tsc=0.
- **E1 Nahtloser Hero→Mannschaft-Übergang**. Gate 1: durchgehender Fluss belegt, kein Bruch.
- **E2 Fan-Block zurück & ausbauen** (Station 4). Gate 2: Station sichtbar, Banner wehen, Fans erkennbar, Ambience-Toggle, 60 FPS.
- **E3 Vereinsheim-Geometrie ENDGÜLTIG (nach Fotos)**: Zaun-Loch ENTFERNEN (durchgehend), Tür deutlich weiter links UND hinten (ums Eck, Fensterraum = Dodos Raum), Anflug passend; ggf. Vordach. Gate 3: Zaun zu, Tür korrekt, Screenshot gegen Referenzfoto.
- **E4 Sponsoren-Station NEU** (Station 6). Gate 4: eigener Beat, Banden-Zoom, Dummy-Logos + „dein Logo"-Slots, WhatsApp-CTA, mobil.
- **E5 Maps-Rauszoom-Finale**: 3D-Platz als Solitär auf flacher 2D-Karte, WhatsApp-Button (wa.me), Route + Insta. Gate 5: mobil getestet.
- **E6 Fans & Tore & Detail-Politur** (CC0 zuerst). Gate: Vorher/Nachher, Stil konsistent, 60 FPS, Lizenzen.
- **E7 Abschluss**: Push, Screenshot-Set alle 7 Stationen, Perf, Bericht + Nordstern + Bestandsschutz-Nachweis + Asset-Liste + Merge-Empfehlung.

## Nicht in diesem Lauf
Deployment/Domain, Supabase/Admin, Cel-Shading, eigenes Higgsfield-Aufladen.
