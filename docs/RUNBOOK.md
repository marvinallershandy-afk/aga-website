# Wenn's brennt — Soforthilfe (für Trainer & Betreuer)

Eine Seite, kein Technik-Wissen nötig. Admin-Login: **aga-erste.de/admin**

> Notfall-Nummer Technik (Marvin): **<Telefonnummer eintragen>**

---

### Die Website zeigt noch alte Sachen (falscher Spielplan, altes Ergebnis)
1. Im Admin anmelden.
2. Auf der Startseite oben **„Website veröffentlichen"** drücken.
3. 2–3 Minuten warten, Seite neu laden (am Handy: Seite ganz schließen und neu öffnen).

Hilft das nicht nach 10 Minuten → Marvin anrufen.

---

### Spielplan / Ergebnis / Tabelle stimmt nicht
Das kommt automatisch von **FuPa** (täglich und sonntagabends).
1. Admin → Startseite → Karte **„FuPa-Abgleich"** → **„Jetzt abgleichen"**.
2. Steht dort danach „nichts Neues", aber FuPa hat recht und wir nicht:
   das Ergebnis steht bei FuPa vielleicht noch nicht. Später nochmal.
3. Muss es sofort stimmen: Admin → **Spiele** bzw. **Tabelle** von Hand
   korrigieren, dann **„Website veröffentlichen"**.

Die von Hand im Ticker eingegebenen Live-Daten überschreibt der Abgleich **nie**.

---

### Am Spieltag: der Liveticker hängt / lädt nicht
- Meist **Funkloch am Platz**. Kurz warten, dann im Ticker-Pult weitertippen —
  die Eingaben gehen durch, sobald wieder Empfang da ist.
- Zuschauer sehen „Liveticker gerade nicht erreichbar" statt falscher Daten.
  Das ist in Ordnung, einfach weiterticken.
- Handy-Akku/Datenvolumen prüfen. Notfalls auf ein anderes Handy wechseln
  (im Admin anmelden, weiter geht's).

---

### Die Live-Seite sagt „gerade kein Spiel", obwohl eins läuft
1. Im Ticker-Pult prüfen, ob **„Anpfiff"** wirklich gedrückt wurde.
2. Wenn ja und es bleibt falsch → kurz aus dem Admin ab- und wieder anmelden.
3. Bleibt es → Marvin anrufen.

---

### Ich komme nicht in den Admin rein
- E-Mail/Passwort genau prüfen (Groß/Klein). „Passwort vergessen" nutzen.
- Kommt gar keine Seite → evtl. ist die Datenbank nach langer Ruhe pausiert.
  Das weckt sich normalerweise von selbst; sonst Marvin anrufen (er klickt
  „Restore/Resume" im Supabase-Dashboard).

---

### „Veröffentlichen" sagt, es sei nicht eingerichtet
Dann fehlt eine einmalige Einstellung (Build-Hook). Das kann nur Marvin setzen
→ kurz Bescheid geben. Inhalte im Admin bleiben trotzdem gespeichert.

---

### Es sind aus Versehen Daten gelöscht worden
Keine Panik: Jede Nacht wird alles gesichert.
→ Marvin anrufen, er spielt das letzte Backup zurück (docs/BACKUP.md).
**Nicht** selbst weiter herumprobieren.

---

### Faustregeln
- **Erst „Website veröffentlichen", dann staunen.** Viele „Fehler" sind nur
  eine noch nicht veröffentlichte Änderung.
- **Ticker schlägt Automatik.** Am Spieltag zählt, was ihr tippt.
- **Im Zweifel anrufen, nichts löschen.** Nichts geht kaputt, was ein Backup
  nicht wiederholt.
