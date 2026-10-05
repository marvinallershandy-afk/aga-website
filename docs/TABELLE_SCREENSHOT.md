# Tabelle per Screenshot aktualisieren

Statt die Ligatabelle Zeile für Zeile abzutippen: Screenshot hochladen, Claude liest die Zahlen ab, kurz prüfen, übernehmen.
Es wird **nichts** automatisch von fussball.de oder FuPa abgegriffen — der Trainer macht den Screenshot selbst, so wie er die Tabelle sowieso anschaut.

## Für den Trainer — 3 Schritte

1. **Screenshot machen.** Auf fussball.de, FuPa oder in der kicker-App die Tabelle öffnen (Gesamttabelle, nicht Heim/Auswärts) und einen Screenshot machen. Hell oder dunkel, Handy oder PC — egal. Passt die Tabelle nicht auf einen Screenshot, einfach zwei machen (oben + unten).
2. **Hochladen.** Vereins-Pflege → **Tabelle** → **„📸 Screenshot wählen“**. Am PC geht auch: Bild in die Karte ziehen oder mit **Strg+V** einfügen. Nach 10–20 Sekunden erscheint die Vorschau.
3. **Prüfen & übernehmen.** In der Vorschau sind geänderte Zahlen **gold** markiert (der alte Wert steht klein durchgestrichen darunter), die eigene Mannschaft ist **rot**. Gelbe Hinweise zeigen, wo etwas nicht zusammenpasst (z. B. „Punkte passen nicht zu 3 × Siege + Unentschieden“) — dort kurz mit dem Screenshot vergleichen. Jede Zahl lässt sich antippen und korrigieren. Dann **„Übernehmen“**. Danach wie gewohnt **„Veröffentlichen“**, damit die Website den neuen Stand zeigt.

Fehlt oben oder unten ein Teil der Tabelle, meldet die Vorschau das („Tabelle beginnt erst bei Platz 5“) — dann **„Screenshot ergänzen“** und den fehlenden Teil dazunehmen.
Die Handeingabe darunter bleibt als Notlösung erhalten.

## Was passiert technisch

- Der Browser verkleinert das Bild (lange Kante ≤ 2000 px, WebP; sehr lange Scroll-Screenshots werden in bis zu 3 Abschnitte geteilt) und schickt es an die Edge Function `tabelle-aus-bild`.
- Die Function prüft Login + `is_sm_admin()`, schickt die Bilder an die Anthropic-API (Modell `claude-sonnet-5-5`, Konstante `MODELL` in `supabase/functions/tabelle-aus-bild/logik.ts`) und erzwingt per Tool-Use eine feste JSON-Struktur.
- Danach prüft die Function: Plätze lückenlos, Punkte = 3·S + U, S + U + N = Spiele, Tore passend zur angezeigten Tordifferenz, doppelte Zeilen (Überlappung zweier Screenshots) zusammenführen, eigene Mannschaft („SV Agathenburg/Dollern“ in allen Schreibweisen) markieren. Abweichungen werden **gemeldet, nicht verworfen**.
- **Bilder werden nirgends gespeichert** — weder in Supabase noch in Logs. Gespeichert wird erst nach „Übernehmen“, direkt aus dem Admin in `sm_tabelle` (bestehende Rechte/RLS). Die Saison-Tabelle wird Platz für Platz ersetzt (nie „erst alles löschen“).
- Die Website zeigt jetzt zusätzlich die **Tordifferenz** (nur wenn Tore gepflegt sind). Keine Migration nötig — `sm_tabelle` hatte die Spalten schon, `web_snapshot()` liefert sie bereits.

## Einrichtung (einmalig, Marvin)

1. API-Key in der [Anthropic Console](https://console.anthropic.com/) anlegen (am besten eigener Key „SVA Tabelle“ mit Ausgabenlimit, z. B. 5 €/Monat).
2. Secret setzen:
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-… --project-ref fwiivwmoyagcdrjvhaou
   ```
3. Function deployen:
   ```bash
   supabase functions deploy tabelle-aus-bild --project-ref fwiivwmoyagcdrjvhaou
   ```
   (`verify_jwt` bleibt an — Standard.)
4. Live-Test: Admin → Tabelle → Testbild `shots-tab/test-tabelle-hell-desktop.png` oder `shots-tab/test-tabelle-dunkel-handy.png` hochladen. Erwartete Werte stehen in `shots-tab/test-tabelle-erwartet.json` (Spieltag 9, 12 Teams). Achtung: „Übernehmen“ überschreibt dann die echte Tabelle — im Test lieber „Verwerfen“.

Ohne Key zeigt der Admin: „Kein API-Key hinterlegt …“. Ist die Function nicht deployt: „Die Bilderkennung ist auf dem Server noch nicht eingerichtet“.

## Kosten

Pro Screenshot grob **ein bis zwei Cent** (ein Bild ≈ 1.500–2.500 Eingabe-Tokens plus ≈ 1.000 Ausgabe-Tokens für 12–16 Zeilen). Bei einem Update pro Spieltag also wenige Cent pro Saison-Monat. Die Function loggt pro Aufruf nur die Token-Zahlen (`tokens_in`/`tokens_out`) — einsehbar in den Supabase-Function-Logs.

## Tests (ohne Key)

```bash
node supabase/functions/tabelle-aus-bild/logik.test.mjs   # Prompt, Schema, Plausibilität, Self-Erkennung
npx vite --port 5187 --strictPort &                         # Dev-Server
node scripts/tabelle-audit.mjs                              # Admin-Durchlauf desktop + 390 px, gemockte Function
```
