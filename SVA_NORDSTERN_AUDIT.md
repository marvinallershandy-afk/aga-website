# SVA Nordstern-Audit (v6 · Etappe 0)

**Blick:** kritischer Erstbesucher, von Instagram kommend, Handy zuerst (iPhone 390×844) + Desktop-Gegencheck.
**Maßstab:** Zieht die Seite (1) neue **Spieler**, (2) **Sponsoren**, (3) bindet **Fans** — und macht es Spaß, hochwertig, in sich stimmig?

## Stand gesichert
main `fb21f52`, tsc=0, Build grün (Prerender 22,7 kB), Remote da. v5 sicher.

## Reise-Bewertung (Handy)

| Station | Nordstern-Wirkung | Urteil |
|---|---|---|
| **Gate** (Wappen, Name, Tagline, Ton-Wahl) | Sofort klar „echter Verein, mit Herz". Hochwertig. | 🟢 stark |
| **Hero** „Willkommen am Platz" | Mobil immersiver als Desktop (Portrait beschneidet Top-Down). Flutlicht + Copy zünden. | 🟢 gut, Feinschliff Textkontrast über hellem Rasen |
| **Kamerafahrt** (Übergänge) | **Marvins Kernkritik**: nicht organisch — Tempo ungleich, Höhe schwankt, Clipping-Gefahr. Bricht den roten Faden am stärksten. | 🔴 größter Hebel → **E1** |
| **Mannschaft/Karten** | Karten *mit* Foto = share-würdiges Insta-Gold (Stolz/Wiedererkennung). **Aber 2/3 fotlos** → Platzhalter-Nummer bricht den Stolz. | 🟡 Blocker: Fotos (Higgsfield-Credits/echte Fotos) |
| **Musik / Aga-Urknall** | Authentischer Kulturschatz (Turniersieger 2024) — aktuell **nicht als Story ausgespielt**. Verschenktes Herz. | 🟡 → **E5** |
| **Tabelle** | Funktion ok, zahlt auf „echter Ligabetrieb" ein. | 🟢 ok |
| **Mitmachen** | Bedient den Dreiklang **exzellent**: Spieler/Helfer&Fans/Sponsoren je mit CTA, Kontakt, Insta-Link (jetzt klickbar). | 🟢 stark |

## Wo der rote Faden / die Hochwertigkeit bricht
1. **Kamera** — unorganische Fahrt (Tempo/Höhe/Clipping). Priorität 1, stil-unabhängig. → **E1**
2. **Model-Eindruck** — v.a. Desktop-Top-Down-Hero. Schrägerer Startwinkel. → **E1**
3. **Fotolose Karten** — 2/3 Kader ohne Gesicht. Braucht Assets (Credits/echte Fotos). Bis dahin: Platzhalter bewusster gestalten (kein „kaputt"-Look).
4. **Objekt-Klumpen** — prozedurale Bäume/Requisiten wirken grob. → **E3** (CC0-Pack, stil-abhängig).
5. **Fehlendes Nordstern-Feature** — kein „wo ist der Platz / Route". Fans finden nicht hin. → **E4**.

## Faktenfehler (in Copy zu korrigieren, E5)
- Kontakt-Adresse zeigt **„Am Sportplatz 1"** — real: **Waldsportplatz Agathenburg, Zur Mehrzweckhalle, 21684 Agathenburg**. Vereinsadresse Hauptstraße 10.
- Trainingszeit **„Di & Do ab 19:00"** ist unbestätigt → als PLATZHALTER markieren, gegen Vereinsseite prüfen (Kandidat Di+Do 16:30–17:30).
- „Seit 1949" korrekt. „Aga Urknall" = echt, ausspielen.

## Code-Health (nebenbei)
- Wiederkehrende React-Warnung: *setState während Render* (`ProgressReporter` in `PartyRoom`). Kein Absturz, aber unsauber — in einer Etappe mitnehmen.

## Reihenfolge (bestätigt Plan)
**E1 Kamera** (größter Hebel) → **E2 Cel-Shading-Test + STOPP** → **E3 Objekte** (nach Stil) → **E4 Karte/Route** → **E5 Content/Fakten**. Reihenfolge unverändert sinnvoll.
