# Rechtstexte – was noch offen ist (Stand v19-R, Oktober 2026)

Impressum und Datenschutzerklärung sind veröffentlichungsfähig (keine Platzhalter mehr sichtbar).
Diese Punkte sollte Marvin bzw. der Vorstand noch erledigen:

## Vor/zum Livegang
1. **VR-Nummer** aus dem Registerauszug ins Impressum (`public/impressum.html`, HTML-Kommentar unter „Registergericht“).
2. **Supabase-DPA**: im Supabase-Dashboard (Organization → Legal Documents) das DPA anfordern/unterzeichnen und ablegen. Vertragspartner ist **Supabase Pte. Ltd.** (Singapur), nicht Supabase Inc.
3. **Netlify-DPA**: prüfen, dass das Netlify Data Processing Agreement für unseren Account gilt (laut Netlify-Privacy-Statement „governed by our Data Processing Agreement“; in den Terms of Use selbst ist es nicht ausdrücklich verlinkt) und PDF ablegen.
4. **Resend-DPA** (Plus Five Five, Inc.): DPA unter resend.com/legal/dpa ablegen.
5. **Niko Hause** um Zustimmung als „redaktionell verantwortlich“ bitten.
6. Vertretungsregel (§ 26 BGB) gegen Satzung/Register prüfen: Reicht „Karsten Heinsohn“ allein?

## Dokumentieren
7. **Foto-Einwilligungen** (Spielerporträts, Mannschaftsfotos, Sticker-Fotos; bei Minderjährigen der Eltern) schriftlich einholen und ablegen. Widerruf → Foto entfernen.
8. Netlify nach der **Speicherdauer der Server-Logfiles** fragen; ggf. konkret in Abschnitt 2 nennen.

## Wenn sich etwas ändert
9. **Partner-Benachrichtigung (n8n-Webhook)** aktiv geschaltet → Empfänger-Dienst in Abschnitt 10 nennen.
10. **E-Mail-Erinnerung vor Heimspielen** (Album) tatsächlich versenden → Versandweg prüfen und ergänzen.
11. Sobald etwas **eingebettet** wird, das beim Laden fremde Server kontaktiert (YouTube, Instagram-Feed, Google Maps, Analytics), stimmt „kein Cookie-Banner“ nicht mehr. Dann Erklärung und Einwilligung anpassen.
12. Neue `localStorage`-/`sessionStorage`-Schlüssel → Liste in Abschnitt 4 nachziehen.

## Juristische Endprüfung (empfohlen)
13. Gesamttext von einer fachkundigen Person prüfen lassen, besonders:
    - Drittlandtransfer (Netlify/Resend über DPF + SCC, Supabase Singapur über SCC)
    - Benennungspflicht Datenschutzbeauftragter (Art. 37 DSGVO, § 38 BDSG), bei Vereinen meist keine
    - Album: Einwilligungstext, Mindestalter (Art. 8 DSGVO), Löschung inaktiver Konten
    - Partner-Formular: Checkbox klingt nach Einwilligung, die Erklärung stützt sich aber auf Art. 6 Abs. 1 lit. b/f. Formulierung angleichen.
    - Fotos: Verhältnis DSGVO/KUG
14. Danach ggf. `noindex` auf Impressum/Datenschutz entfernen (optional).
