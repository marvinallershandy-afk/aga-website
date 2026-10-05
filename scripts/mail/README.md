# Login-Mails (Supabase Auth)

Versand über Resend-SMTP (`login@aga-erste.de`). Vorlagen v2: Foto-Kopf (picture by Nele, Meisterspieltag 2026), Code im Ticket-Kasten, Code auch im Betreff.

1. `node scripts/mail/hero.mjs` – rendert die Bild-Köpfe (`hero-*.jpg`, 1200×760) neben das Skript.
2. Bilder nach Supabase Storage `sva_public/mail/hero-<name>-v2.jpg` (+ `wappen-v2.png`) hochladen.
3. `python3 scripts/mail/build.py` – schreibt `v2-*.html` und `patch-v2.json`.
4. `patch-v2.json` per Management API einspielen: `PATCH /v1/projects/<ref>/config/auth`. Supabase übernimmt Änderungen erst nach ca. 1–2 Minuten.

Bei neuen Bildern Versionsnummer (`V` in build.py, Dateinamen) hochzählen – Gmail cacht Bilder hart.
