# Signature-Tools für Marvin Allers – Recherche und Spezifikation

Stand: 08.10.2026 · für Marvin Allers (Versicherungsmakler §34d, Finanzanlagenvermittler §34f GewO, Stade) · baut auf `aga-website/docs/kundenbereich-marvin/research.md` auf (§B8 Rechner-Recht, A7 Altersvorsorgedepot). Was dort steht, wird hier nicht wiederholt, nur vertieft.

> **Keine Rechts- oder Steuerberatung.** Das ist eine Recherche. Alle Rechtsfragen gehen an Anwalt, IHK Stade und Steuerberater (Liste in Kapitel 8).

> **Methodik:** Direkte Seitenabrufe waren gesperrt. Betroffen waren u. a. recht.bund.de (BGBl.), bundesfinanzministerium.de, gesetze-im-internet.de, openfigi.com und mba.tuck.dartmouth.edu. Alle Belege stammen deshalb aus **Suchmaschinen-Auszügen** der verlinkten Seiten. Zahlen aus Gesetz, BMF, Bundesbank, Destatis oder DRV sind als **[amtlich, Auszug]** markiert, Zahlen aus Ratgebern, Anbietern oder Foren als **[sekundär]**. Was ich aus eigenem Wissen ergänze, aber nicht per Suche belegen konnte, ist **[eigenes Wissen, prüfen]** und steht zusätzlich in Kapitel 9.

---

## Inhaltsverzeichnis

0. [Kurzfazit](#kurzfazit)
1. [Gemeinsame Basis: Steuer- und Marktwerte 2026](#basis)
2. [Gemeinsame Leitplanken für alle Tools](#leitplanken)
3. [Tool 1 – Depot-Check (Depot-Analyse)](#tool1)
4. [Tool 2 – Depot vs. Rentenversicherung (inkl. Basisrente)](#tool2)
5. [Tool 3 – Depot vs. Immobilie (Kaufen vs. Mieten, optional Kapitalanlage)](#tool3)
6. [Tool 4 – Altersvorsorgedepot-Rechner (ab 01.01.2027)](#tool4)
7. [Tool 5 – Weitere Signature-Tools (Liste mit Einschätzung)](#tool5)
8. [Empfohlene Reihenfolge und Klärungsliste](#reihenfolge)
9. [Nicht verifiziert](#nicht-verifiziert)
10. [Quellenliste](#quellen)

---

<a id="kurzfazit"></a>
## 0. Kurzfazit

1. **Mit dem Altersvorsorgedepot-Rechner zuerst starten.** Die Förderung beginnt am 01.01.2027, Anfang 2027 wird danach gesucht, und nur wenige Rechner zeigen ehrlich die nachgelagerte Besteuerung. Der stärkste Aha-Moment ist die **Förderquote bei Familien**: Wer mit einem Kind 300 €/Jahr einzahlt, bekommt 150 € Grundzulage und 300 € Kinderzulage, also 150 % Förderquote [Regeln sekundär bzw. §84 aus Auszug, Rechnung eigen].
2. **Der Depot-Check bringt den größten Kundennutzen, aber auch das größte Rechts- und Datenrisiko.** Eine Lite-Version gehört öffentlich auf die Website: manuelle ISIN-Liste, kuratierte Kostendaten, Ergebnis „Kosten in Euro über 30 Jahre“. Die volle Version mit Durchschau (Look-through), Faktoren und Upload gehört in den Login-Bereich. Sobald der Check **konkrete Ersatzprodukte** für dieses Depot nennt, ist das Anlageberatung, und §§16–18 FinVermV gelten. Zu Einzelaktien, Anleihen, ETCs und Zertifikaten darf Marvin mit §34f gar nicht beraten [IHK-Merkblatt, sekundär].
3. **Datenlizenzen sind der Engpass, nicht der Code.** Eine günstige, kommerziell lizenzierte Quelle für UCITS-Holdings habe ich nicht gefunden. EODHD führt Standard-Tarife als „Personal use“. Finnhub verlangt 500–1.000 $/Monat für ETF-Holdings und ist US-lastig. Für Morningstar Direct Web Services (mit X-Ray-API) gibt es nur Preise auf Anfrage. **Kneip (Deutsche Börse)** liefert EMT- und PRIIPs-Kostendaten pro ISIN. Die Lizenzlage bei Kenneth French und den iShares-CSVs ist ungeklärt.
4. **Depot vs. Rentenversicherung:** Den Ausschlag geben die Kostendifferenz und die Art der Auszahlung. Die Police gewinnt fast nur bei **lebenslanger Rente** (Ertragsanteil 17–18 % bei Rentenbeginn mit 65–67) und niedrigen Kosten, also eher beim Nettotarif. Der stärkste Aha-Moment ist die **Break-even-Grenze der Effektivkosten**: „Bis zu x % Effektivkosten hält die Police mit.“ Dazu kommt das **Rentenfaktor-Alter**: „Erst mit 94 hast du dein Kapital zurück.“
5. **Kaufen vs. Mieten:** Der beste Aha-Moment ist die **Break-even-Wertsteigerung**: „Die Wohnung muss jährlich um x % steigen, damit Kaufen gleichzieht.“ Ein guter zweiter Aha-Moment ist die **Mietschwelle** im Stil der NYT: „Kannst du eine vergleichbare Wohnung unter X €/Monat mieten, gewinnt Mieten.“ Für Niedersachsen gelten 5,0 % Grunderwerbsteuer, 1,5–2,0 % Notar und Grundbuch und ein Maklerkosten-Anteil des Käufers von üblicherweise 3,57 % [sekundär].
6. **Prognosen auf Basis „simulierter früherer Wertentwicklung“ sind ausdrücklich verboten** (Art. 44 Abs. 6 DelVO 2017/565 [Auszug Normtext]). Das betrifft vor allem Monte-Carlo-Simulationen mit historischem Bootstrapping und „Schattendepot“-Vergleiche, die als Ausblick dargestellt werden. Szenarien müssen deshalb auf **offengelegten Annahmen** beruhen, nicht auf Backtests.

---

<a id="basis"></a>
## 1. Gemeinsame Basis: Steuer- und Marktwerte 2026

Diese Werte gehören zentral in eine Konfigurationsdatei (z. B. `shared/finance/params-2026.ts`), jeweils mit Quelle, Abrufdatum und Gültigkeitsjahr. Kein Rechner darf eigene Konstanten hartkodieren.

| Parameter | Wert 2026 | Status / Quelle |
|---|---|---|
| Sparer-Pauschbetrag (§20 Abs. 9 EStG) | 1.000 € ledig / 2.000 € Zusammenveranlagung (seit 2023) | [sekundär] [nexvyra](https://nexvyra.de/fakten/sparerpauschbetrag-2026.html), [taxtify](https://taxtify.de/sparer-pauschbetrag/) |
| Abgeltungsteuer (§32d EStG) | 25 % + 5,5 % Soli = **26,375 %**. Die Soli-Freigrenze gilt bei Abgeltungsteuer nicht | [sekundär] [steuerschroeder](https://www.steuerschroeder.de/Steuerrechner/Abgeltungsteuer.html), [etf.capital](https://etf.capital/solidaritaetszuschlag/) |
| Mit Kirchensteuer | Kapitalertragsteuer = 25 % / (1 + 0,25·k). Bei 9 % (Niedersachsen) 24,45 %, gesamt ≈ **27,99 %**. Bei 8 % (BY/BW) 24,51 %, gesamt ≈ 27,82 % | [sekundär + eigene Herleitung], Formel §32d Abs. 1 S. 4 [eigenes Wissen, prüfen] |
| Teilfreistellung (§20 InvStG) | Aktienfonds 30 %, Mischfonds 15 % | [sekundär] [lxgesetze §20 InvStG](https://lxgesetze.de/invstg/20), [capitalo](https://www.capitalo.de/lexikon/teilfreistellung) |
| Effektive Steuer Aktien-ETF (ohne KiSt) | 0,70 × 26,375 % = **18,46 %** | eigene Rechnung |
| Basiszins Vorabpauschale 2026 (§18 Abs. 4 InvStG) | **3,20 %** (BMF-Schreiben vom 13.01.2026, IV C 1 - S 1980/00230/012/001). Gilt als zugeflossen am 04.01.2027. Zum Vergleich: 2025 waren es 2,53 % | [amtlich, Auszug] [BVI-Kopie BMF](https://direkt.bvi.de/fileadmin/user_upload/letter/2026/COO.7005.100.4.13897455.pdf), [otto-schmidt](https://www.otto-schmidt.de/news/steuerrecht/basiszins-zur-berechnung-der-vorabpauschale-gem-18-absatz-4-invstg-basiszins-zum-2-1-2026-2026-01-15.html) |
| Grunderwerbsteuer Niedersachsen | **5,0 %** (seit 2014), kein Ersterwerber-Freibetrag | [sekundär] [finanz.de](https://www.finanz.de/steuern/grunderwerbsteuer/niedersachsen/), [rechner-hub](https://rechner-hub.de/grunderwerbsteuer/niedersachsen/). Amtlich (MF Niedersachsen) **nicht abgerufen** |
| Notar + Grundbuch | 1,5–2,0 % (mit Grundschuld), ohne Finanzierung ca. 1,3–1,5 % | [sekundär, Faustregel nach GNotKG] [finanz-rechner-hub](https://finanz-rechner-hub.de/notarkosten-immobilienkauf/) |
| Maklerprovision Niedersachsen | üblich 7,14 % gesamt, davon 3,57 % Käuferanteil. Regional auch 4,76–5,95 % gesamt. Halbteilung bei Wohnung/EFH und Verbraucher-Käufer (§§656b, 656d BGB) | [sekundär] [Homeday](https://www.homeday.de/de/homeday-makler/maklerkosten/), [vr.de](https://www.vr.de/privatkunden/themenwelten/wohnen-immobilien/bauen-kaufen/maklerprovision.html) |
| Bauzins 10 J. Zinsbindung | Bundesbank-Effektivzins (Reihe SUD119): 3,84 % (02/2026), vorläufig 3,99 % (05/2026). Marktindikation Ende 09/2026: „über 4,0 %“ | [Bundesbank via Sekundär] [Bundesbank-Statistik](https://www.bundesbank.de/de/statistiken/geld-und-kapitalmaerkte/zinssaetze-und-renditen/wohnungsbaukredite-an-private-haushalte-hypothekarkredite-auf-wohngrundstuecke-615036), [Schwäbisch Hall](https://www.schwaebisch-hall.de/bauen-kaufen/baufinanzierung/bauzinsen-aktuell.html). **Im Rechner live aus SUD119 ziehen** (Bundesbank-API) |
| Inflation (VPI) | 09/2026 vorläufig +3,3 %, 08/2026 +2,9 %, 07/2026 +2,8 % | [amtlich, Auszug] [Destatis PM 09/2026](https://www.destatis.de/DE/Presse/Pressemitteilungen/2026/09/PD26_348_611.html) |
| Häuserpreisindex | Q2/2026 +0,6 % zum Vorjahr, Q1/2026 +1,4 %. 2025 +3,2 %, 2024 −1,5 %, 2023 −8,4 %. GREIX Q2/2026 real in allen Segmenten im Minus | [amtlich, Auszug] [Destatis PM Q2](https://www.destatis.de/DE/Presse/Pressemitteilungen/2026/09/PD26_336_61262.html), [Destatis Q1](https://www.destatis.de/DE/Presse/Pressemitteilungen/2026/06/PD26_219_61262.html?nn=2110) |
| Besteuerungsanteil gesetzliche Rente / Basisrente | Rentenbeginn 2026: **84 %**. Steigt um 0,5 Prozentpunkte pro Jahr, 100 % erst ab 2058 (Wachstumschancengesetz) | [sekundär] [steuerschroeder](https://www.steuerschroeder.de/Rentenbesteuerung.html) |
| Höchstbetrag Basisvorsorge (§10 Abs. 3 EStG) | **30.826 €** / 61.652 € (2026), zu 100 % abziehbar, abzüglich GRV-Beiträgen | [sekundär, Quellen widersprechen sich teils (29.344 € = 2025)] [steuerschroeder Rürup](https://www.steuerschroeder.de/Steuerrechner/Ruerup-Rente.html) |
| Ertragsanteil Leibrente (§22 Nr. 1 S. 3 a bb EStG) | Rentenbeginn mit 65–66: **18 %**, mit 67: **17 %**, mit 68: 16 % | [sekundär] [lohnsteuer-kompakt](https://www.lohnsteuer-kompakt.de/fag/2012/447/was_ist_eine_leibrente_) |
| Aktueller Rentenwert | **42,52 €** ab 01.07.2026 (+4,24 %). Haltelinie für das Rentenniveau bei 48 % bis 2031 | [amtlich, Auszug] [DRV PM](https://www.deutsche-rentenversicherung.de/DRV/DE/Ueber-uns-und-Presse/Presse/Meldungen/2026/260305-rentenanpassung-2026.html) |
| Höchstrechnungszins Lebensversicherung | 1,0 % seit 01.01.2025 (vorher 0,25 %) | [sekundär] [uniVersa PM](https://universa.de/site/assets/files/138742/pressemitteilung-2025_01_14-altersvorsorge_universa_verbessert_fondspolice.pdf) |
| Höchstzillmersatz (§4 DeckRV) | 25 ‰ der Beitragssumme (bis 2014: 40 ‰) | [sekundär, BGH-Zitat] [Deloitte](https://www.deloitte.com/de/de/services/financial-advisory/analysis/Fruehstorno-und-Mindestrueckkaufswert.html), [Versicherungsbote](https://www.versicherungsbote.de/id/4845310/HDI-Riester-Rente-BDV-Abschlusskosten/) |

**Vorabpauschale (Formel nach §18 InvStG, Wortlaut nicht abgerufen):**

$$\text{Basisertrag}_t = V_{t}^{\text{Jan}} \cdot b_t \cdot 0{,}7$$
$$\text{VP}_t = \max\Big(0,\ \min\big(\text{Basisertrag}_t,\ V_t^{\text{Dez}} - V_t^{\text{Jan}} + A_t\big) - A_t\Big)$$

mit $b_{2026}=3{,}20\,\%$ und $A_t$ = Ausschüttungen. Im Kaufjahr sinkt die VP um 1/12 für jeden vollen Monat vor dem Kauf [eigenes Wissen, prüfen]. Steuer:

$$\text{St}_t = \max\big(0,\ \text{VP}_t\cdot(1-\text{TF}) - \text{SPB}_{\text{rest}}\big)\cdot s_{\text{Abg}}$$

*Beispiel 2026:* 10.000 € Depotwert am 01.01. ergeben einen Basisertrag von 224 €. Nach 30 % Teilfreistellung sind 156,80 € steuerpflichtig, also 41,36 € Steuer, falls der Pauschbetrag aufgebraucht ist. Die VP mindert später den Veräußerungsgewinn.

---

<a id="leitplanken"></a>
## 2. Gemeinsame Leitplanken für alle Tools

Ergänzt §B8 der bestehenden Recherche, ohne ihn zu wiederholen.

### 2.1 Anlageberatung – wann ein Rechner Beratung wird
- **Tatbestand (§1 Abs. 1a Nr. 1a KWG, BaFin-Merkblatt Stand 02/2025):** Anlageberatung ist eine *persönliche Empfehlung* zu *bestimmten Finanzinstrumenten*, die entweder auf der Prüfung der persönlichen Umstände beruht oder als für den Anleger geeignet dargestellt wird. Allgemeine Empfehlungen zu einer Produktart reichen nicht. Wer ein Instrument konkret benennt, berät. Wer die bisherige Vermögenszusammensetzung berücksichtigt, gibt eine persönliche Empfehlung [sekundär, Zusammenfassung des Merkblatts] ([GvW](https://www.gvw.com/aktuelles/blog/detail/aktualisiertes-merkblatt-der-bafin-zur-anlageberatung-und-einordnung-von-finfluencern), [Vergleichsversion Merkblatt 02/2025](https://paytechlaw.com/wp-content/uploads/Vergleichsversion-Merkblatt-Hinweise-zum-Tatbestand-der-Anlageberatung-Stand-02-2025.pdf)).
- **Folge für die Tools:** Ein Rechner auf eigenen Annahmen ohne ISIN ist Information. Ein Depot-Check, der *dieses* Depot auswertet und *diese* ISIN als Ersatz vorschlägt, ist Anlageberatung. Marvin darf sie mit §34f erbringen, muss dann aber Exploration (§16), Geeignetheitserklärung (§18), Taping (§18a) und Zuwendungsoffenlegung (§17 FinVermV) einhalten.
- **Grenze der §34f-Erlaubnis:** Sie umfasst nur offene und geschlossene Investmentvermögen sowie Vermögensanlagen (Bereichsausnahme §2 Abs. 6 S. 1 Nr. 8 KWG). Für andere Finanzanlagen braucht man eine Erlaubnis nach KWG oder WpIG [sekundär, IHK] ([IHK Stuttgart](https://www.ihk.de/stuttgart/fuer-unternehmen/recht-und-steuern/gewerberecht/erlaubnisverfahren-fuer-finanzanlagenvermittler-berater-688598), [IHK Heilbronn](https://www.ihk.de/heilbronn-franken/produktmarken/branchen/gewerbeportal/finanzen/finanzanlagenvermittler-berater/erlaubnisverfahren-fuer-finanzanlagenvermittler-berater-4885452)). Daraus folgt: **keine Empfehlungen zu Einzelaktien, Anleihen, ETCs oder Zertifikaten**, auch nicht „verkaufen“. Im Depot-Check werden solche Positionen nur neutral beschrieben (Gewicht, Klumpen), ohne Handlungsaufforderung.
- **Nicht in Marvins Erlaubnisumfang (soweit bekannt):** Immobilienvermittlung (§34c) und Darlehensvermittlung (§34i). Der Kaufen-vs.-Mieten-Rechner darf deshalb **keine konkreten Objekte oder Kredite** empfehlen. Ob Marvin §34c oder §34i hat, ist **nicht geprüft**.

### 2.2 Werbung und Prognosen (§14 FinVermV i. V. m. Art. 44 DelVO 2017/565)
- **Art. 44 Abs. 6 (künftige Wertentwicklung)** [Auszug Normtext über umwelt-online/gesetze.legal]:
  - (a) Die Angabe darf **nicht auf einer simulierten früheren Wertentwicklung beruhen** oder darauf Bezug nehmen.
  - (b) Die Annahmen müssen angemessen und durch objektive Daten gestützt sein.
  - (c) Bei Bruttowerten ist die Wirkung von Provisionen, Gebühren und Entgelten offenzulegen.
  - (d) Szenarien müssen unterschiedliche Marktbedingungen zeigen, positive wie negative.
  - (e) Es braucht eine deutliche Warnung, dass Prognosen kein verlässlicher Indikator sind ([gesetze.legal Art. 44](https://gesetze.legal/eu/vo_eu_2017_565/44), [umwelt-online](https://umwelt-online.de/recht/eu/17a/17a_0565b.htm)).
- **Konsequenz:** Für die Zukunft **parametrische Szenarien** verwenden, also Rendite und Volatilität als sichtbare Annahme mit Quelle. Keine Projektion, die einen Backtest einfach fortschreibt. Eine Monte-Carlo-Simulation mit historischem Bootstrapping ist eine Grauzone und braucht eine Klärung mit dem Anwalt (Kapitel 9). Backtests nur als **Rückblick**, mindestens über 5 volle Jahre, mit Quelle, Zeitraum und Warnhinweis (Art. 44 Abs. 4/5, siehe §B8).
- **UWG §5/§5a:** Scores und Ampeln brauchen eine offengelegte Methodik. Kein „Testurteil“-Eindruck und keine Abwertung bestimmter Anbieter. Vergleichende Werbung mit namentlich genannten Produkten fällt unter **§6 UWG** [eigenes Wissen, prüfen].
- **Interessenkonflikt:** Marvin verdient an Fondspolicen über Courtage, am ETF-Sparplan je nach Depotbank wenig oder nichts. Rechner, die Police und Depot vergleichen, sollten das **selbst offenlegen** („Ich verdiene an X so viel, an Y so viel“). Das passt zur Marke und senkt das Irreführungsrisiko.

### 2.3 Steuerberatungsgesetz (StBerG)
- **§5 Abs. 1 StBerG:** Nur die in §§3, 3a, 3d, 4 genannten Personen dürfen geschäftsmäßig Hilfe in Steuersachen leisten. **§2 Abs. 2:** Geschäftsmäßige Hilfe beginnt dort, wo eine *rechtliche Prüfung des Einzelfalls* nötig wird [Auszug Normtext] ([gesetze-im-internet §5 via Suche](https://www.gesetze-im-internet.de/stberg/__5.html), [Haufe §2](https://www.haufe.de/id/norm/steuerberatungsgesetz-2-geschaeftsmaessige-hilfeleistung-HI928673_p2.html)). Laut Haufe galt die zitierte §2-Fassung vom 01.08.2022 bis 31.08.2026, die aktuelle Fassung muss geprüft werden.
- **Umsetzung:** Steuern **schematisch** rechnen, mit vom Nutzer gewähltem Grenzsteuersatz (Schieberegler, keine ESt-Veranlagung), und als „vereinfachte Modellrechnung“ kennzeichnen. Keine Aussagen wie „In deinem Fall greift §…“. Fragen wie Günstigerprüfung, Kirchensteuer oder Kapitalwahlrecht im Einzelfall an den Steuerberater verweisen. Ob §6 StBerG (erlaubte Nebenleistungen) für Vermittler etwas freigibt, ist **nicht geprüft**.

### 2.4 Datenschutz und marvin-os-Regeln
- **Datenminimierung:** Öffentliche Rechner laufen **komplett im Browser**. Keine Speicherung, kein Tracking von Eingaben und gemäß CLAUDE.md auch **kein localStorage für Daten**. Im Login-Bereich werden Ergebnisse in Supabase gespeichert (mit `tenant_id` und RLS).
- **KI-Anbieter (Anthropic, OpenAI, Deepgram):** nur über den Anonymisierungs-Layer. Für die Rechner selbst braucht man **keine KI**, denn die Logik ist deterministisch in TypeScript. KI nur optional für Erklärtexte, mit anonymisierten Eingaben (Zahlen ohne Namen, Depotnummer oder IBAN).
- **Testbarkeit:** Jede Formel bekommt Unit-Tests gegen Referenzbeispiele, z. B. das Alte-Leipziger-Beispiel unter 4.3. Die Parameter-Datei ist versioniert, damit jedes Ergebnis „Stand Parameter vom …“ ausweist.

### 2.5 Pflicht-Bausteine in jedem Rechner (über §B8 hinaus)
1. **Annahmen-Panel** immer sichtbar: Rendite, Inflation, Kosten, Steuersatz, jeweils mit Quelle und „Stand“.
2. **Drei Szenarien** (z. B. pessimistisch, mittel, optimistisch) statt einer Zahl. Das erfüllt Art. 44 Abs. 6 lit. d.
3. **Nominal und real** umschaltbar, also in heutiger Kaufkraft.
4. **„Was dieser Rechner nicht weiß“:** Liste mit Lücken wie Krankenversicherung im Alter, Erbfall oder persönliche Steuer.
5. **Interessenkonflikt-Hinweis** und CTA „Mit Marvin durchsprechen“. Erst im Gespräch wird daraus Beratung.

---

<a id="tool1"></a>
## 3. Tool 1 – Depot-Check (Depot-Analyse)

### 3.1 Zweck
Der Kunde sieht in fünf Minuten, **was sein Depot kostet (in Euro)**, **was wirklich drin ist** (Durchschau durch alle Fonds) und **wo es von einem breit gestreuten, günstigen Weltportfolio abweicht**. Für Marvin ist das der ideale Einstieg ins Gespräch über Kosten, aktive Fonds und Home Bias.

### 3.2 Vorbilder

| Vorbild | Was gut ist | Was schwach ist | Beleg |
|---|---|---|---|
| **Morningstar Portfolio X-Ray / Instant X-Ray** | Klassiker für Durchschau, Stilbox, Regionen, Sektoren und Überschneidungen. Laut Blogger mit kostenlosem Konto für bis zu 15 Positionen nutzbar | ältere UI, Zugang regional und tarifabhängig unklar. In den USA hängt X-Ray an Morningstar Investor (34,95 $/Monat) | [getquin-Post](https://app.getquin.com/de/post/GiSyGILudJ/tool-fur-portfolio-analyse-uberschneidungen-prozentuale-gewichtung-von-markten-landern-uvm), [freenance](https://freenance.io/products/morningstar-investor-review-2026-premium-mutual-fund-etf-research/), [X-Ray FAQ](https://portfolio.morningstar.com/RtPort/free/XRayFAQ.html) |
| **Morningstar Direct Web Services** (B2B) | X-Ray und Risk Score als API, gibt „display-ready content“ zurück, über 300.000 Instrumente, Implementierungspartner verfügbar | Preise nur auf Anfrage (vermutlich Enterprise-Niveau) | [Morningstar DWS](https://www.morningstar.com/business/products/direct-web-services), [PM 2023](https://newsroom.morningstar.com/news/news-details/2023/Morningstar-Direct-Web-Services-Brings-Sophisticated-Investment-Data-Research-and-Calculation-APIs-to-Power-Firms-Digital-Platforms/default.aspx) |
| **Parqet** | Analyse nach Asset, Sektor, Branche, Region, Land und Wertpapiertyp. **X-Ray** rechnet die ETF-Zusammensetzung in die Allokation ein (Abo). PDF-Import liest nur Wertpapier, Kurs, Stück und Datum **ohne Upload** (datenschutzfreundliches Vorbild!). TTWROR und IRR | X-Ray nur im Abo, TER- und Kostenanalyse unklar, widersprüchliche Angaben zum CSV-Import. Preise 2025: Plus 99,99 €/Jahr, Investor 329,99 €/Jahr | [Parqet X-Ray](https://parqet.com/en/blog/x-ray), [Parqet llms.txt](https://parqet.com/llms.txt), [justETF-Erfahrungsbericht](https://www.justetf.com/de/academy/parqet-erfahrungsbericht.html), [broker-test](https://www.broker-test.at/portfolio-software/parqet/) |
| **getquin** | KI-Analyse mit den Bereichen Diversifikation, Risiko, **Kosten** und Makro. Laut Hilfe werden nur ISIN, Gewicht, Market Cap, Land, Sektor und Branche übertragen, **keine absoluten Bestände** (Vorbild für Anonymisierung) | DeepDive (Durchschau) nur für einige Anbieter, Probleme bei Dachfonds, 15 Analysen pro Monat im Premium | [getquin Hilfe](https://help.getquin.com/en/articles/8895421), [Forum](https://app.getquin.com/en/post/GiSyGILudJ/i.e) |
| **Finanzfluss Copilot** | Anbindung an über 350 Banken (nur lesend), Portfolio-Analyse, Plus 69,99 €/Jahr | Importfehler laut App-Store-Kritik (siehe research.md A4) | research.md A4 |
| **extraETF Portfolio-Tracker** | automatische Aufteilung nach Top-Holdings, Anlageklassen, Regionen, Ländern und Sektoren, Depot-Anbindung | Kosten pro Fonds-Bestandteil nicht belegt | [extraETF Wissen](https://extraetf.com/wissen/etf-review-funktionsweise), [Suchauszug](https://diba.de/binaries/content/assets/pdf/sparen-anlegen/direkt-depot/broker-test-extraetf-2023_24.pdf) |
| **justETF** | Europa-Fokus auf UCITS, Tracking Difference, Portfolio-Planung | eine Überschneidungsanalyse über mehrere ETFs ist nicht belegt (alter Foreneintrag: „doesn't directly map and compare etf holdings“). **Keine öffentliche API** | [findmymoat](https://www.findmymoat.com/list/etf-screening-comparison-tools), [justETF Partner](https://justetf.com/de/about/become-partner.html) |
| **Portfolio Visualizer** | Faktor-Regression (Fama-French 3/5, Carhart) für Fonds und Portfolios, Optimierung (Mean-Variance, CVaR) | US-lastig, Assetklassen-Daten erst ab 1972, die Historie wird mit jedem Fonds kürzer | [All About Money](https://allaboutmoney.substack.com/p/how-to-use-portfolio-visualizer), [robberger](https://robberger.com/tools/portfolio-visualizer/) |
| **testfol.io** | kostenlos und ohne Anmeldung, Backtests mit Rebalancing, Hebel, Cashflows, Faktoren und Monte Carlo | US-Daten, Bezahltarif ab ca. 15 $/Monat [sekundär] | [findmymoat](https://www.findmymoat.com/vs/curvo-backtest-vs-testfol-io) |
| **Curvo Backtest** | **für europäische Indexanleger**, in Euro, Fondskosten eingerechnet, Monatsenddaten, Rebalancing, Efficient Frontier, Monte Carlo. Nutzt Indexhistorie, damit lange Zeiträume möglich sind | Indexhistorie ≠ echte Fondsrendite (Tracking Difference fehlt), die Methode muss offengelegt werden | [Curvo](https://curvo.eu/backtest), [Finanztip-Forum mit Curvo-FAQ](https://www.finanztip.de/community/forum/thema/38323-%C3%BCberperformance-durch-rebalancing-depot-selbst-in-die-hand-nehmen/?pageNo=3) |
| **True Wealth (CH)** | ETF-Lookthrough bis auf Einzeltitel als Transparenz-Feature für Kunden | Schweizer Robo, kein Analyse-Tool für fremde Depots | [True Wealth Blog](https://truewealth.ch/en/blog/full-transparency-with-the-etf-lookthrough) |

**Lücke, die Marvin besetzen kann:** Keines der Tools verbindet **Kosten in Euro über 20/30 Jahre**, eine **ehrliche Gegenüberstellung aktiv vs. passiv mit Evidenz** (SPIVA) und eine **verständliche „Was heißt das?“-Erklärung** von einem Menschen, der danach berät.

### 3.3 Eingaben

| Stufe | Eingaben |
|---|---|
| **Leadmagnet (öffentlich, „Kosten-Check“)** | ISIN-Liste mit Betrag in € (manuell oder per Copy-Paste), optional monatliche Sparrate und Anlagehorizont. Kein Upload, kein Name, Rechnung im Browser |
| **Login (vollständig)** | Upload als CSV (Depotbank-Export), PDF-Depotauszug oder manuelle Liste. Dazu Depotgebühren, Ordergebühren pro Jahr, Ausgabeaufschläge der letzten Käufe, Transaktionshistorie (für die tatsächliche Rendite) und Zielallokation bzw. Risikoprofil aus der Exploration |

**Parsing-Ansatz (Datenschutz zuerst):**
1. **Im Browser parsen.** CSV über eigene Mapper je Bank (comdirect, ING, DKB, Consorsbank, Trade Republic, Scalable: Formate je Bank sammeln). PDF über die Textebene mit pdf.js. Parqet zeigt, dass PDF-Import ohne Upload geht.
2. **ISIN-Erkennung per Regex** `\b[A-Z]{2}[A-Z0-9]{9}[0-9]\b` plus **Prüfziffer**: Buchstaben in Zahlen umwandeln (A = 10 … Z = 35), dann Luhn-Verfahren. Das filtert Fehltreffer, etwa IBAN-Fragmente.
3. **Nur ISIN, Stück und Kurswert verlassen den Browser.** Name, Adresse, Depotnummer und IBAN werden nie übertragen.
4. **Gescannte PDFs:** Fallback über OCR im Browser. Das wäre ein zusätzliches Paket und laut CLAUDE.md begründungspflichtig. Alternativ fragt man nach dem CSV-Export. **KI-Extraktion nur als letzte Stufe** und nur über den Anonymizer. Vorher Zeilen ohne ISIN verwerfen und Namen, IBAN und Depotnummern maskieren.
5. **Ergebnis vorab zeigen** („Wir haben 12 Positionen erkannt – stimmt das?“), erst dann rechnen.

### 3.4 Rechenmethode

**Notation:** $V$ = Depotwert, $w_i = V_i/V$ = Gewicht von Position $i$, $h_{i,j}$ = Gewicht von Titel $j$ in Fonds $i$ (für Einzeltitel $h_{i,i}=1$).

**(a) Laufende Kosten in Euro**
$$K^{\text{lfd}} = \sum_i V_i\cdot(\text{OGC}_i + \text{TK}_i) + K^{\text{Depot}} + K^{\text{Order}}$$
OGC = laufende Kosten laut PRIIPs-KID/EMT, TK = Transaktionskosten auf Fondsebene laut KID. Ausgabeaufschlag (einmalig): Bei einem Aufschlag $AA$ auf den Anteilspreis kostet ein Bruttobetrag $B$ genau $B\cdot AA/(1+AA)$.

**(b) „Kosten-Zeitmaschine“ (der Aha-Moment)**
Kostenquote $c=K^{\text{lfd}}/V$, Bruttorendite $r$, Vergleichskosten $c_{\text{alt}}$ (z. B. Welt-ETF), Horizont $T$, Sparrate $s$ p. a.:
$$g = (1+r)(1-c)-1,\qquad g_{\text{alt}} = (1+r)(1-c_{\text{alt}})-1$$
$$\text{EW}(g) = V(1+g)^T + s\cdot\frac{(1+g)^T-1}{g}$$
$$\Delta_T = \text{EW}(g_{\text{alt}})-\text{EW}(g)$$
Anzeige: „Deine Kosten heute: **X €/Jahr**. Über 30 Jahre fehlen dir bei sonst gleicher Bruttorendite **Δ €**, das sind **Y %** deines Endvermögens.“ Zusätzlich die Summe der direkt gezahlten Kosten getrennt vom entgangenen Zinseszins zeigen.

**(c) Durchschau, Regionen, Sektoren, Währungen**
$$E_j = \sum_i w_i\cdot h_{i,j}\qquad\text{analog } E_{\text{Region}},\ E_{\text{Sektor}},\ E_{\text{Währung}}$$
Fonds ohne Holdings bekommen ersatzweise die Länder- und Sektorgewichte aus dem Factsheet und werden markiert („Teil-Durchschau“).

**(d) Überschneidung zweier Fonds A, B**
$$\text{Overlap}(A,B)=\sum_j \min(h_{A,j},h_{B,j})$$
Darstellung als Matrix-Heatmap. Aha-Satz: „Deine drei ETFs überschneiden sich zu 70 %. Im Kern hast du dreimal dasselbe gekauft.“

**(e) Klumpen und Konzentration**
$$\text{HHI}=\sum_j E_j^2,\qquad N_{\text{eff}}=1/\text{HHI}$$
Dazu Top-10-Anteil und größte Einzelposition nach Durchschau. Anzeige: „Dein Depot verhält sich wie N_eff gleich gewichtete Aktien.“

**(f) Home Bias und Abweichung vom Weltmarkt**
$$\text{HB}_{\text{DE}} = \frac{E_{\text{DE}}}{b_{\text{DE}}},\qquad \text{AS}=\tfrac12\sum_k |E_k-b_k|$$
$b$ = Länder- bzw. Sektorgewichte eines Weltmarkt-Benchmarks (z. B. MSCI ACWI IMI oder FTSE All-World, Werte aus dem Factsheet) und AS = Active Share gegenüber dem Weltmarkt. Den deutschen Anteil am Weltindex **nicht hartkodieren**, sondern aus dem Factsheet lesen (Kapitel 9).

**(g) Faktor-Exposure (nur im Login und nur mit ausreichender Historie)**
Zeitreihen-Regression mit Monatsrenditen, mindestens 36, besser 60 Monate:
$$R_{p,t}-R_{f,t}=\alpha+\beta_M\,\text{MKT}_t+\beta_S\,\text{SMB}_t+\beta_V\,\text{HML}_t+\beta_P\,\text{RMW}_t+\beta_I\,\text{CMA}_t+\beta_{Mo}\,\text{WML}_t+\varepsilon_t$$
- Faktoren: Fama-French Developed bzw. Europe (Kenneth French Library). Diese Reihen liegen in **USD** vor [eigenes Wissen, prüfen], daher die Portfoliorenditen in USD umrechnen oder den Währungseffekt ausweisen.
- Ausgabe: Ladungen mit **Konfidenzintervall** (t-Werte) und R². Bei R² < 0,9 oder kurzer Historie steht dabei: „nicht belastbar“.
- Alternative ohne Zeitreihe: **holdings-basierte** Faktor-Scores (Größe, Bewertung, Profitabilität je Titel, gewichtet). Dafür braucht man fundamentale Daten auf Titelebene, was teurer ist.
- „Quality“ entspricht näherungsweise RMW (Profitabilität). Eine genormte Quality-Definition gibt es nicht, deshalb die Methodik offenlegen.

**(h) Aktive Fonds vs. ETF-Alternative**
- Je aktivem Fonds: Kategorie (z. B. Aktien Welt), passender Index, **Kostendifferenz** $c_i - c_{\text{Index-ETF}}$ und eigene Rendite vs. Index über 5 und 10 Jahre, nach Kosten.
- **Evidenz-Box:** SPIVA Europe Year-End 2025. Im Kalenderjahr 2025 lagen 71 % der aktiven EUR-Fonds „Global Equity“ hinter dem S&P World [S&P-Report, Auszug]. Über 10 Jahre waren es laut Sekundärquelle 98 % [sekundär, im Report nicht selbst geprüft] ([SPIVA Europe YE 2025](https://www.spglobal.com/spdji/en/documents/spiva/spiva-europe-year-end-2025.pdf), [rikatillsammans](https://rikatillsammans.se/studier/spiva-europe-2025/)).
- **Öffentlich:** nur die *Kategorie* nennen („ein breiter Welt-Index-ETF kostet typischerweise 0,1–0,25 %“), **keine ISIN** (siehe 2.1). **Im Login:** Eine konkrete Alternative gibt es nur nach Exploration und mit Geeignetheitserklärung.

**(i) Performance vs. Benchmark**
- Geldgewichtete Rendite (IRR/XIRR) aus den tatsächlichen Cashflows: $\sum_k CF_k(1+\text{IRR})^{-(t_k-t_0)/365}=0$. Zeitgewichtete Rendite (TWR) für den Produktvergleich.
- **Schattendepot:** dieselben Ein- und Auszahlungen zu denselben Tagen in einen Benchmark-ETF. Aha: „Mit denselben Einzahlungen hättest du heute X € mehr oder weniger.“ **Rechtlich:** Das ist eine *frühere* Wertentwicklung, also Art. 44 Abs. 4/5 beachten (5 Jahre, Quelle, Warnhinweis, echte Instrumentenhistorie). Sie darf **nicht in die Zukunft fortgeschrieben** werden (Abs. 6 lit. a).
- Tracking Difference je ETF: $\text{TD}=R_{\text{Fonds}}-R_{\text{Index}}$ pro Kalenderjahr.

**(j) Diversifikations-Score (0–100, Methodik offenlegen)**
Vorschlag: gewichtete Summe aus
- $N_{\text{eff}}$ (log-skaliert),
- 1 − AS gegenüber dem Weltmarkt (Regionen),
- 1 − Anteil der größten Einzelposition,
- Sektor-Abweichung,
- Kosten-Malus.

Keine Schulnote und kein „gut/schlecht“, sondern „so nah bist du an einem breiten Weltportfolio“. Die Gewichte sind eine Ermessensentscheidung und müssen auf einer Methodikseite stehen (UWG, siehe 2.2).

### 3.5 Default-Annahmen
- Bruttorendite für die Kosten-Zeitmaschine: Der Effekt hängt wenig von $r$ ab, deshalb Szenarien 3 %, 5 % und 7 % nominal mit Hinweis „Annahme, keine Prognose“. Die Quelle der Spanne (z. B. Kapitalmarktannahmen großer Häuser) muss **noch belegt werden**.
- Vergleichskosten $c_{\text{alt}}$: OGC eines breiten Welt-ETFs aus dessen KID, **live** aus den Stammdaten.
- Risikofreier Zins für die Regression: Kenneth-French-RF (USD) bzw. €STR (EZB), Letzteres nicht geprüft.

### 3.6 Ausgaben und Visualisierung
1. **Hero-Zahl:** „Dein Depot kostet dich **X € pro Jahr**, über 30 Jahre **Δ €**.“ Daneben ein Balken „direkte Kosten vs. entgangener Zinseszins“.
2. **Weltkarte bzw. Treemap** der Durchschau im Vergleich zum Weltmarkt (Home-Bias-Marker).
3. **Überschneidungs-Heatmap** der Fonds.
4. **Top-10-Einzeltitel nach Durchschau**, etwa „Apple steckt in 4 deiner Fonds, zusammen 6,1 %“.
5. **Aktiv-vs.-passiv-Tabelle:** Kosten, 5- und 10-Jahres-Abstand zum Index, SPIVA-Box.
6. Login: **Faktor-Spinne** mit Konfidenzband, Schattendepot-Kurve (Rückblick) und „Gesprächsthemen für unser Treffen“.

### 3.7 Datenquellen (Fondsstammdaten, TER, Holdings, Kurse, Faktoren)

| Quelle | Liefert | Kommerzielle Nutzung / Lizenz | Kosten | Bewertung |
|---|---|---|---|---|
| **OpenFIGI** (Bloomberg) | Zuordnung ISIN → FIGI, Ticker, Börse. Ohne Key 25 Anfragen/Minute, mit Key 25 pro 6 Sekunden (laut offizieller Doku, Auszug) | Die Lizenzangaben widersprechen sich (Homepage: MIT, Schema: Apache 2.0), den Wortlaut der Lizenzklausel (Abs. 1) konnte ich nicht lesen. **ISIN wird in Ergebnissen nicht zurückgegeben** (Lizenz) | kostenlos | gut für die Zuordnung, Lizenz schriftlich bestätigen lassen ([ToS](https://www.openfigi.com/docs/terms-of-service), [API-Doku](https://www.openfigi.com/api/documentation), [docs.rs](https://docs.rs/openfigi-rs)) |
| **Morningstar Direct Web Services** | Stammdaten, Kosten, Holdings, X-Ray-API, Risk Score, „display-ready“ | B2B-Lizenz, Darstellung beim Kunden verhandelbar | auf Anfrage | Komplettlösung, wahrscheinlich teuer ([DWS](https://www.morningstar.com/business/products/direct-web-services)) |
| **Kneip (Deutsche Börse)** | **EMT pro ISIN** (Kostentransparenz) und PRIIPs-Daten für über 150.000 EU-ISINs, per sFTP oder API | lizenziert, über das Deutsche Börse Data Shop | nicht gefunden | **bester Kandidat für Kostendaten** (OGC, Transaktionskosten, Ausgabeaufschlag) ([Kneip PRIIPs Product Sheet](https://mds.deutsche-boerse.com/resource/blob/4095354/cf3b11fba27e2ff0cad0e98f0321e926/data/Product%20Sheet_Kneip-PRIIPs%20Data_V1_290824.pdf), [Kneip Fund Data](https://mds.deutsche-boerse.com/mds-en/historical-data/deutsche-boerse-data-shop/kneip-fund-data)) |
| **FE fundinfo** | PRIIPs-KIDs und Dokumente, über 450.000 KIDs, Plattform „Nexus“ | eine API für EMT-Daten an deutsche Vermittler ist **nicht belegt** | auf Anfrage (enquiries@fefundinfo.com) | Dokumentenquelle ([FE PRIIPs Sheet](https://fefundinfo.com/media/3c5lwmsn/fe-fundinfo-priips-uk-cci-ucits-product-sheet.pdf)) |
| **LSEG/Refinitiv Lipper** | Fondsdaten | **nicht recherchiert** | – | offen |
| **EODHD** | Kurse, Fundamentaldaten inkl. ETF-Holdings und europäischer Börsen (Xetra) | Standard-Tarife laut eigener Seite „**Personal use**“, kommerzielle Nutzung offenbar nur im Tarif „Startups & Enterprise“ (Drittquelle) | Fundamentals 59,99 $/Monat, All-in-One 99,99 $/Monat (privat) | nur mit Enterprise-Lizenz ([apis.io](https://apis.io/plans/eodhd/eodhd-plans-pricing/)) |
| **Finnhub** | ETF-Holdings, täglich aktualisiert | Abdeckung **USA**, global nur für Enterprise | 500 bzw. 1.000 $/Monat | für UCITS ungeeignet ([Finnhub Pricing](https://www.finnhub.io/pricing-etf-indices)) |
| **Twelve Data** | Kurse für über 50 Länder, ETF-Zusammensetzung (über MCP-Tool belegt) | REST-Endpunkt, ISIN-Abfrage und Lizenz für die Zusammensetzung nicht belegt | nicht gefunden | prüfen ([Twelve Data](https://support.twelvedata.com/en/articles/5544954-twelve-data-overview)) |
| **Alpha Vantage** | ETF_PROFILE (Nettovermögen, Kostenquote, Holdings, Sektoren) | US-Ticker, ISIN-Abfrage nicht belegt | nicht gefunden | für UCITS ungeeignet ([qveris](https://api.qveris.ai/guides/etf-holdings-api-for-ai-agents)) |
| **Stooq** | freie Kursdaten | **nicht recherchiert** | – | offen |
| **justETF** | sehr gute UCITS-Stammdaten | **keine öffentliche API**, Anfrage über „Werde Partner“ möglich. Datenquellen laut justETF: Trackinsight, etfinfo, Xignite, gettex, FactSet. Gehört zu Scalable Capital (seit 2021) | – | Scraping (z. B. Apify-Actor) **nicht verwenden** ([Partner-Seite](https://justetf.com/de/about/become-partner.html), [Apify](https://apify.com/bovi/etf-data-extractor/api)) |
| **iShares / Xtrackers / Vanguard Holdings-CSV** | vollständige Holdings je ETF | iShares-AGB regeln die Website-Nutzung. Einen ausdrücklichen Absatz zur Weiterverwendung der Holdings habe ich **nicht gefunden**. Index-Lizenzgeber (MSCI, FTSE, S&P) haben oft eigene Beschränkungen. Xtrackers und Vanguard **nicht geprüft** | kostenlos | **vor Nutzung schriftlich anfragen** ([iShares T&C](https://www.ishares.com/uk/professionals/en/compliance/terms-and-conditions), [BlackRock T&C](https://www.blackrock.com/corporate/compliance/ishares-terms-and-conditions)) |
| **Kenneth French Data Library** | Faktorrenditen (Developed, Europe usw.) | kostenlos abrufbar, den Lizenztext konnte ich **nicht lesen**. US-Daten basieren auf CRSP (lizenzpflichtig). Achtung: Die UK-Daten der Uni Exeter sind ausdrücklich nur akademisch nutzbar | kostenlos | vor kommerzieller Anzeige bei Tuck/Dartmouth anfragen. QuantConnect bietet nachgebaute Reihen an ([frenchdata CRAN](https://packages.oit.ncsu.edu/cran/web/packages/frenchdata/refman/frenchdata.html), [Exeter-Disclaimer](https://business-school.exeter.ac.uk/finance-accounting/research/famafrench/disclaimer/), [QuantConnect](https://www.quantconnect.com/docs/v2/writing-algorithms/datasets/quantconnect/fama-french)) |
| **PRIIPs-KID / Factsheet selbst auswerten** | OGC, Transaktionskosten, Risikoklasse, Länder und Sektoren (Factsheet) | Das sind Pflichtdokumente. Einzelne Fakten wie die TER zu übernehmen ist vermutlich unkritisch, eine **systematische Datenbank** kann aber Datenbankrechte berühren (§87b UrhG) [eigenes Wissen, prüfen] | Arbeitszeit | **MVP-Weg:** kuratierte Liste der 200–400 Fonds, die Marvins Kunden am häufigsten halten |

**Empfehlung zu den Daten:**
- **MVP (S/M):** Eine kuratierte Fondstabelle in Supabase mit ISIN, Name, OGC, Transaktionskosten, Aufschlag, Kategorie, Index sowie Regionen und Sektoren aus dem Factsheet. Die Pflege übernimmt Marvin, Quelle ist das KID-PDF mit Datum. Unbekannte ISINs werden in eine Warteschlange gestellt („Ich prüfe das für dich“), was gleichzeitig ein Lead-Anlass ist.
- **Pro (L):** Eine Lizenz für Kostendaten (Kneip) plus Holdings (Morningstar oder lizenzierte Anbieter-CSVs). Die Faktor-Regression erst, wenn die Lizenz geklärt ist.
- **Grobe Kosten:** Das MVP kostet ohne Datenlizenz nur Zeit, für die Kuratierung von ca. 300 Fonds grob 3–5 Personentage [Schätzung]. Für Pro habe ich **keine Preise gefunden**. Bei Morningstar, Kneip und FE ist ein Angebot nötig. Erfahrungsgemäß reicht die Spanne von vierstellig bis fünfstellig pro Jahr [Schätzung, nicht belegt].

### 3.8 Fallstricke und Verzerrungen
- **Veraltete Holdings:** Holdings sind oft monatlich, Factsheets meist mit 1–2 Monaten Verzug. Im Ergebnis „Stand“ anzeigen.
- **Synthetische ETFs:** Der Swap-Korb ist nicht der Index. Für die Durchschau den *Index* verwenden und das kennzeichnen.
- **TER ≠ Gesamtkosten:** Transaktionskosten, Spreads und Swapgebühren fehlen in der TER. Die TCO ist nicht gesetzlich definiert ([leinetal24](https://www.leinetal24.de/wirtschaft/was-ein-etf-wirklich-kostet-ter-spread-und-versteckte-gebuehren-zr-94430413.html)). Deshalb OGC plus Transaktionskosten aus dem KID und die Tracking Difference als Realitätscheck nehmen.
- **Dachfonds und Fondspolicen:** Hier braucht man eine Durchschau in zwei Ebenen. getquin hat damit laut Forum Probleme.
- **Survivorship Bias bei aktiven Fonds:** Laut Sekundärquelle existierten nach 10 Jahren nur noch 62 % der globalen Aktienfonds. Die SPIVA-Zahlen berücksichtigen das bereits und sind deshalb fair.
- **Faktor-Regression:** Ein kurzes Fenster, Währungseffekte und Multikollinearität (HML gegen CMA) führen zu Scheinpräzision. Deshalb immer Konfidenzintervalle zeigen.
- **Home Bias ist nicht immer falsch.** Bei Euro-Verbindlichkeiten kann ein Euro-Anteil sinnvoll sein. Formulierung: „Abweichung“, nicht „Fehler“.
- **Auch der Score kann irreführen:** Ein Depot mit 100 % Welt-ETF erreicht die volle Punktzahl, passt aber vielleicht nicht zum Risikoprofil. Der Score misst Streuung, nicht Eignung.

### 3.9 Rechtliche Leitplanken
- Die **öffentliche Version** ist eine Kostenrechnung und Strukturbeschreibung **ohne Produktempfehlung**: keine ISIN-Alternativen, Einzelaktien nur neutral.
- Die **Login-Version** mit konkreten Alternativen ist **Anlageberatung** und braucht Exploration, Geeignetheitserklärung, Zuwendungs- bzw. Kostenoffenlegung ex ante (§13) und Taping bei Chat oder Call. Nur für Investmentfonds (§34f).
- **Datenschutz:** Depotdaten sind Finanzdaten (kein Art. 9 DSGVO, aber sensibel). Rechtsgrundlage ist im Login die Vertragsanbahnung (Art. 6 Abs. 1 lit. b), im öffentlichen Tool gar keine, weil nichts gespeichert wird. Für Uploads eine Löschfrist festlegen. Nur ISIN und Wert verarbeiten.
- **Art. 44 DelVO:** Schattendepot und Backtests nur als Rückblick, 5 Jahre, mit Quelle.
- **UWG:** Die Score-Methodik offenlegen. Keine Aussagen wie „Fonds X ist schlecht“, sondern „kostet X € mehr als die Indexvariante“.

### 3.10 Öffentlich vs. Login und Aufwand
| Version | Umfang | Aufwand |
|---|---|---|
| **Kosten-Check (öffentlich)** | ISIN-Liste, Kosten in €, Kosten-Zeitmaschine, Regionen aus dem Factsheet, Aktiv-Anteil, Evidenz-Box | **M** (Rechner S, Kuratierung der Fondsdaten M) |
| **Depot-Check Pro (Login)** | Upload (CSV/PDF im Browser), Durchschau, Überschneidung, HHI, Home Bias, Schattendepot, Faktoren, Gesprächsvorbereitung | **L** (Datenlizenz, Parser je Bank, Regression) |

---

<a id="tool2"></a>
## 4. Tool 2 – Depot vs. Rentenversicherung (inkl. Basisrente)

### 4.1 Zweck
Ein ehrlicher Vergleich mit gleicher Einzahlung und gleicher Bruttorendite: **ETF-Sparplan** vs. **fondsgebundene Rentenversicherung** (Bruttotarif mit Provision, Nettotarif mit Honorar) und optional die **Basisrente**. Ergebnis: Wer gewinnt, ab welchen Kosten, bei welcher Auszahlungsform und ab welchem Alter.

### 4.2 Vorbilder

| Vorbild | Gut | Schwach | Beleg |
|---|---|---|---|
| **Stiftung Warentest – Fondspolicen-Vergleich** | klares Fazit: Für die meisten ist ein ETF-Sparplan besser. Der echte Vorteil der Police ist die **steuerfreie Umwandlung in eine lebenslange Rente**. Kosten sind das Hauptproblem. Laut Titel waren 3 von 33 Policen gut | Bezahlschranke, kein interaktiver Rechner für eigene Angebote | [test.de](https://www.test.de/Vergleich-Rentenversicherung-mit-Fonds-3-von-33-fondsgebundenen-Rentenversicherungen-sind-gut-1563811-0/) |
| **Finanztip** | ETF-Rechner und AV-Depot-Rechner, starke Community. Im Forum gibt es eine Faustregel: Ein Nettotarif lohnt nur, wenn die Gesamtkosten nahe 0,5 % liegen | Forennutzer berichten von Rechner-Fehlern, etwa wenn die TER nicht in der Rendite steckt | [Finanztip-Forum](https://www.finanztip.de/community/forum/thema/46643-etf-vs-rentenversicherung-an-konkreten-beispiel/), [Forum ETF-Nettopolicen](https://www.finanztip.de/community/forum/thema/16691-etf-nettopolicen/) |
| **Biallo** | erklärt die doppelte Kostenebene (Fonds + Versicherung) | kein vollständiger Vergleichsrechner belegt | [biallo](https://www.biallo.de/aktienfonds/news/etf-rentenversicherung/) |
| **Verbraucherzentrale** | **nicht recherchiert** | – | – |
| **Versicherer-PIBs (z. B. Allianz)** | Effektivkosten-Beispiel: 3,00 % angenommene Rendite minus 1,33 Prozentpunkte ergibt 1,67 % | Rechnung mit einer fixen Annahme, kein Vergleich zum ETF | [Allianz PIB](https://goa-eportale.allianz.de/XBR/FS4/XBRFS4030Z0.pdf.download.pdf) |
| **Fraunhofer ITWM (Korn)** | Studie: Die Pflichtangaben im PIB bilden die Kosten nicht realistisch ab (Maximalprinzip). Typische Effektivkosten 1,23 % bei 30 Jahren, 1,03 % bei 40 Jahren (bezogen auf Basisrenten) | Studie, kein Rechner | [DAS INVESTMENT](https://www.dasinvestment.com/studie-kosten-pib-ruerup-renten-fraunhofer-institut-wirtschaftsmathematik/) |
| **Nettotarif-Anbieter und Honorarberater-Rechner** | **nicht im Detail recherchiert** | – | Kapitel 9 |

**Lücke:** Kaum ein Rechner zeigt **gleichzeitig** Vorabpauschale, FIFO-Verkauf, den Sparer-Pauschbetrag in der Entnahme, das Halbeinkünfteverfahren mit 15 % Teilfreistellung, den Ertragsanteil und den **Rentenfaktor als Alter, ab dem sich die Rente lohnt**.

### 4.3 Steuer- und Kostenregeln (Belegstand)

**ETF-Depot**
- Ansparphase: Vorabpauschale (Kapitel 1), Teilfreistellung 30 %, Sparer-Pauschbetrag, Abgeltungsteuer 26,375 %.
- Verkauf: Gewinn = Erlös − Anschaffungskosten − bereits versteuerte Vorabpauschalen. Steuer auf $(G\cdot0{,}7 - \text{SPB})$.
- **FIFO:** Bei Girosammelverwahrung gelten die zuerst gekauften Anteile als zuerst verkauft (§20 Abs. 4 S. 7 EStG) [eigenes Wissen, prüfen]. In der Entnahmephase werden daher zuerst die Anteile mit dem höchsten Gewinnanteil verkauft. Das gehört ins Modell, sonst ist das Ergebnis zu optimistisch.
- Entnahme: Jedes Jahr ist der Sparer-Pauschbetrag erneut verfügbar (1.000 € bzw. 2.000 € Gewinn steuerfrei). **Günstigerprüfung** bei Grenzsteuersatz unter 25 % (§32d Abs. 6) [eigenes Wissen, prüfen].

**Fondsgebundene Rentenversicherung (Schicht 3)**
- Ansparphase: **keine laufende Steuer**, Fondswechsel innerhalb der Police steuerfrei, keine Vorabpauschale [sekundär] ([test.de](https://www.test.de/Vergleich-Rentenversicherung-mit-Fonds-3-von-33-fondsgebundenen-Rentenversicherungen-sind-gut-1563811-0/)).
- **Kapitalauszahlung (§20 Abs. 1 Nr. 6 EStG):** Unterschiedsbetrag $G$ = Leistung − Summe der Beiträge. Für Verträge ab 2018 bleiben **15 % von G** steuerfrei, soweit der Gewinn aus Investmenterträgen stammt (§20 Abs. 1 Nr. 6 S. 9). Bei Auszahlung **ab 62 und mindestens 12 Jahren Laufzeit** wird die **Hälfte** des Rests mit dem persönlichen Steuersatz besteuert, sonst gilt die Abgeltungsteuer. Der Versicherer behält zunächst Kapitalertragsteuer auf den vollen Ertrag ein, die Erstattung läuft über die Steuererklärung (Anlage KAP) [sekundär] ([steuerschroeder](https://www.steuerschroeder.de/Besteuerung-Versicherung.html), [HUK](https://www.huk.de/gesundheit-vorsorge-vermoegen/ratgeber/richtig-vorsorgen/rentenbesteuerung.html), [Swiss Life PDF](https://swisslife.de/content/dam/de/documents/50/21413.pdf)).
  - *Referenzbeispiel für den Unit-Test (Alte Leipziger, via Suchauszug):* 100.000 € Leistung, 60.000 € Beiträge, G = 40.000 €. Davon 15 % frei (6.000 €), 34.000 € verbleiben, die Hälfte davon ergibt **17.000 € zum persönlichen Steuersatz** ([Alte-Leipziger-Infoblatt](https://www.vermittlerportal.de/leben/infoblatt-abgeltungsteuer-pst1305.pdf)).
  - Für Verträge von 2005 bis 2011 gilt nach meinem Wissen die Altersgrenze 60 statt 62 [eigenes Wissen, prüfen].
- **Rentenzahlung:** nur der **Ertragsanteil** ist steuerpflichtig (§22 Nr. 1 S. 3 a bb), bei Rentenbeginn mit 65 sind es 18 %, mit 67 17 %. Ein Gericht hat Renten aus Verträgen mit Kapitalwahlrecht §22 zugeordnet, die Revision beim BFH läuft. Die Besteuerung fondsgebundener Rentenbezüge ist laut einem Anbieter „noch nicht abschließend geklärt“ [sekundär] ([iww](https://www.iww.de/astw/einkommensteuer/22-estg-besteuerung-von-rentenzahlungen-aus-privaten-rentenversicherungsvertraegen-mit-kapitalwahlrecht-f174940)).
- **Kosten:**
  - Abschluss- und Vertriebskosten werden beim Rückkaufswert mindestens gleichmäßig auf die **ersten fünf Jahre** verteilt (§169 Abs. 3 VVG, BGH IV ZR 17/13). Der Höchstzillmersatz liegt bei **25 ‰ der Beitragssumme** (§4 DeckRV). Er begrenzt nur den gezillmerten Teil, die tatsächlichen Abschlusskosten können höher sein und werden dann über die Laufzeit verteilt [sekundär].
  - Hinzu kommen Verwaltungskosten (in % der Beiträge, in % des Guthabens, als Stückkosten in €), die Fonds-TER und Kosten in der Rentenphase (in % der Rente).
  - **Effektivkosten (Reduction in Yield)** stehen im PIB bzw. Basisinformationsblatt (Maximalprinzip, siehe Fraunhofer).
- **Nettotarif:** keine einkalkulierte Provision, dafür eine separate Vermittlungsgebühr bzw. ein Honorar. Das **muss auf der Kostenseite** stehen, sonst ist der Vergleich unfair. Ob Marvin als §34d-Makler bei Nettotarifen ein Honorar vom Verbraucher nehmen darf, ist **nicht geprüft** (Kapitel 9).
- **Garantien:** Beitragsgarantien (z. B. 80 %) kosten Rendite durch eine Wertsicherungsstrategie. Der garantierte Rentenfaktor ist an Rechnungszins (Höchstrechnungszins 1,0 % seit 2025) und Sterbetafel gebunden. Der Rentenfaktor ist garantiert, ist das Ergebnis neuer Rechnungsgrundlagen bei Rentenbeginn besser, gilt der höhere Wert [sekundär] ([uniVersa](https://universa.de/site/assets/files/138742/pressemitteilung-2025_01_14-altersvorsorge_universa_verbessert_fondspolice.pdf), [capitalo](https://www.capitalo.de/lexikon/rentenfaktor)).

**Basisrente (Rürup, Schicht 1, optional)**
- Beiträge sind zu 100 % als Sonderausgaben absetzbar, bis 30.826 € (2026) abzüglich GRV-Beiträgen [sekundär].
- In der Rente gilt der Besteuerungsanteil nach Jahr des Rentenbeginns (2026: 84 %, plus 0,5 Prozentpunkte pro Jahr).
- Kein Kapitalwahlrecht, nicht vererbbar (nur Hinterbliebenenschutz), nicht beleihbar [eigenes Wissen, prüfen].
- **Fairer Vergleich:** Die Steuerersparnis in der Ansparphase fließt beim Vergleichsdepot zusätzlich in den ETF.

### 4.4 Eingaben

| Leadmagnet (öffentlich) | Login (vollständig) |
|---|---|
| Alter, Rentenbeginn, Sparrate/Monat, Grenzsteuersatz heute und im Alter (Schieberegler), Auszahlung Rente oder Kapital, **Effektivkosten der Police in %** (Default-Szenarien 0,6 %, 1,2 %, 2,0 %), ETF-Kosten (Default 0,2 %) | zusätzlich **Werte aus dem konkreten Angebot oder PIB**: Abschlusskosten in € bzw. % der Beitragssumme, Verwaltungskosten (Beitrag, Guthaben, Stück), Fonds-TER, Garantie, **Rentenfaktor pro 10.000 €**, Rentengarantiezeit, Kosten in der Rentenphase, Vertragsbeginn (wegen 15 %- und 62/12-Regel), Kirchensteuer, Kranken- und Pflegeversicherung im Alter (KVdR oder freiwillig), Honorar beim Nettotarif |

### 4.5 Rechenmethode

**Grundsatz:** Beide Seiten haben **dieselbe Bruttorendite** $r$ vor Fondskosten und **denselben Cash-Abfluss aus der Tasche**. Wird die ETF-Vorabpauschale aus dem Girokonto bezahlt, zählt sie als Einzahlung auch auf der Police-Seite. Im Modell wird sie einfacher **im Depot belassen**, also durch Anteilsverkauf beglichen, mit FIFO.

**Ansparphase (monatlich, $m$ = Monat):**
- ETF: $V_{m+1} = (V_m + s)\cdot(1+r_m)\cdot(1-c^{ETF}_m) - \text{St}^{VP}$ (Vorabpauschale jeweils zum Jahreswechsel).
- Police (explizite Kosten):
$$G_{m+1}=\big(G_m + s(1-\beta) - \text{AK}_m - k^{\text{Stück}}_m\big)\cdot(1+r_m)\cdot(1-c^{\text{Fonds}}_m)\cdot(1-\gamma_m)$$
  mit $\beta$ = Kosten in % des Beitrags, $\text{AK}_m$ = Abschlusskosten-Rate (z. B. $\alpha\cdot\Sigma\text{Beiträge}/60$ in den ersten fünf Jahren) und $\gamma$ = Kosten in % des Guthabens.
- Police (vereinfacht über Effektivkosten): $G_T = \text{EW}(r - \text{RIY})$. Das ist nur als Näherung zulässig, weil das PIB die Effektivkosten mit einer fixen Annahmerendite rechnet.

**Auszahlung als Kapital:**
- ETF: $N^{ETF} = V_T - \max\big(0,(V_T - \text{AK} - \Sigma\text{VP})\cdot0{,}7 - \text{SPB}\big)\cdot s_{\text{Abg}}$
- Police: $G = G_T - \Sigma\text{Beiträge}$, $G' = 0{,}85\,G$ (bei Vertragsbeginn ab 2018).
  - Wenn Alter ≥ 62 und Laufzeit ≥ 12 Jahre: $\text{St} = 0{,}5\,G'\cdot t_{\text{pers}}$ (mit Soli und KiSt).
  - Sonst: $\text{St} = \max(0, G' - \text{SPB})\cdot s_{\text{Abg}}$.

**Auszahlung als Rente:**
- Police: $R_{\text{Jahr}} = \frac{G_T}{10.000}\cdot \text{RF}\cdot 12$ (RF = monatliche Rente je 10.000 €; Einheit im Angebot prüfen, manche nennen sie je 1.000 €). Netto: $R(1 - e(\text{Alter})\cdot t_{\text{pers}})$, mit $e$ = Ertragsanteil.
- ETF als Gegenstück: **Auszahlplan** in gleicher Höhe wie die Policen-Rente (netto) mit FIFO-Besteuerung und jährlichem SPB. Ausgabe: **„Bis zu welchem Alter reicht das Depot?“**
- **Break-even-Alter der Rente** (Kapital zurück, ohne Verzinsung):
$$n^* = \frac{G_T}{R_{\text{Jahr}}} = \frac{10.000}{12\cdot\text{RF}}\ \text{Jahre},\qquad \text{Alter}^* = \text{Rentenbeginn} + n^*$$
  *Beispiel:* RF = 30 €/Monat je 10.000 € ergibt n* = 27,8 Jahre, bei Rentenbeginn mit 67 also erst **mit 94,8 Jahren**. Eine Variante mit Verzinsung $q$ löst $\sum_{k=1}^{n} R(1+q)^{-k} = G_T$ nach $n$ auf.
- **Implizite Verzinsung des Rentenfaktors** gegenüber der Lebenserwartung: Die Restlebenserwartung bei Rentenbeginn kommt aus der Destatis-Sterbetafel (Wert **noch zu belegen**). Lebt man länger, gewinnt die Rente (Langlebigkeitsversicherung).

**Kern-Output: Break-even der Kosten**
Suche das $c^{RV*}$, bei dem $N^{RV}(c^{RV*}) = N^{ETF}$ gilt (Bisektion). Ausgabe: „Bei deinen Annahmen hält die Police mit, solange ihre Effektivkosten unter **c\* %** liegen. Dein Angebot: **x %**.“ Das als Heatmap über Laufzeit (10–40 Jahre) mal Grenzsteuersatz im Alter darstellen.

**Basisrente (optional):** Zusätzlich fließt die Steuerersparnis $s\cdot t_{\text{heute}}$ ins Vergleichsdepot. In der Rente gilt der Besteuerungsanteil BA(Jahr des Rentenbeginns) statt des Ertragsanteils.

### 4.6 Default-Annahmen (mit Quelle bzw. Status)
- ETF-Kosten 0,2 % (Forenbeispiel). Besser: echte TER eines Welt-ETFs aus den Stammdaten.
- Effektivkosten der Police als Szenarien: 0,6 % (Nettotarif-Niveau, Finanztip-Forum „um 0,5 %“, schwacher Beleg), 1,2 % (Fraunhofer: typisch 1,23 % bei 30 Jahren), 2,0 % (Bruttotarif hoch, Annahme).
- Rentenfaktor: **kein Default**. Belastbare Marktwerte für 2026 habe ich nicht gefunden, deshalb Pflichteingabe aus dem Angebot. Im Leadmagneten als Schieberegler mit „typisch 25–35 € je 10.000 €“ ist das **nicht belegt** und braucht vorher eine Marktübersicht.
- Grenzsteuersatz im Alter: Nutzer-Schieberegler (Default 25 %), keine Berechnung (StBerG).

### 4.7 Ausgaben und der Aha-Moment
1. **„Wer gewinnt?“-Karte** je Auszahlungsform: Kapital vs. Rente vs. Auszahlplan.
2. **Break-even-Kosten** als Tacho: „Dein Angebot liegt bei 1,4 %, der Break-even bei 0,9 %.“
3. **Break-even-Alter** des Rentenfaktors: „Du musst 95 werden, um dein Kapital zurückzubekommen.“
4. **Kurve „Netto-Vermögen über die Zeit“** mit der Rückkaufswert-Delle der Police in den ersten fünf Jahren. Aha bei Frühstorno: „Kündigst du nach 4 Jahren, fehlen dir X €.“
5. **Steuer-Wasserfall** je Variante.

### 4.8 Fallstricke und Verzerrungen
- **Unterschiedliche Bruttorenditen** (z. B. Fondsauswahl in der Police) verfälschen den Vergleich. Deshalb überall dasselbe $r$ verwenden.
- **Vorabpauschale vergessen** oder **FIFO ignoriert** machen den ETF zu gut.
- **Halbeinkünfte überschätzt:** Ohne 62 und 12 Jahre oder bei Teilauszahlungen gilt die Regel nicht. Ein Vertrag mit Beginn vor 2018 hat keine 15 %-Teilfreistellung.
- **Ertragsanteil-Rente ≠ steuerfrei:** Der Ertragsanteil wird mit dem persönlichen Satz besteuert. Kranken- und Pflegeversicherung im Alter: Pflichtversicherte in der KVdR zahlen nach meinem Wissen auf private Renten keine Beiträge, freiwillig Versicherte schon, ebenso auf Kapitalerträge aus dem Depot [eigenes Wissen, prüfen]. Das kann den Vergleich drehen.
- **Langlebigkeit:** Ein Auszahlplan kann leerlaufen, die Rente nicht. Das als *Versicherungswert* zeigen, nicht nur als Rendite.
- **Erbfall:** Das Depot ist voll vererbbar, die Rente endet ohne Garantiezeit.
- **Flexibilität:** Bei der Police verfallen nach Kündigung oft die Steuervorteile ([test.de](https://www.test.de/Vergleich-Rentenversicherung-mit-Fonds-3-von-33-fondsgebundenen-Rentenversicherungen-sind-gut-1563811-0/)), beim Depot kommt man jederzeit an das Geld.
- **PIB-Effektivkosten** sind Maximalwerte (Fraunhofer), deshalb besser die tatsächlichen Kostenbausteine eingeben.

### 4.9 Rechtliche Leitplanken
- **Öffentlich:** generischer Vergleich ohne Tarifnamen. Das ist Information.
- **Login mit konkretem Angebot:** Das ist Versicherungsberatung (§§61 ff. VVG). Fondspolicen sind **Versicherungsanlageprodukte (IBIP)** mit IDD-Geeignetheits- und Kostenpflichten (Fundstelle §7c VVG laut research.md B6 **nicht verifiziert**).
- **Interessenkonflikt** offenlegen: Courtage beim Bruttotarif, Honorar beim Nettotarif, ETF-Sparplan ohne bzw. mit wenig Vergütung.
- **StBerG:** keine Einzelfallsteuer, Steuersätze als Nutzereingabe, Hinweis „Kapitalwahlrecht und Steueroptimierung mit Steuerberater klären“.
- **§6 UWG:** keinen Wettbewerberverlust namentlich darstellen, außer sachlich und nachprüfbar.

### 4.10 Öffentlich vs. Login und Aufwand
- Öffentlich: **„Police oder ETF? Der Kosten-Break-even“**, Aufwand **M**.
- Login: **„Angebots- und Policen-Check“** (eigenes Angebot oder Bestandsvertrag eingeben, Optionen weiterlaufen, beitragsfrei stellen, kündigen und in ETF wechseln), Aufwand **L** (viele Tarifdetails, Prüfung durch Anwalt).

---

<a id="tool3"></a>
## 5. Tool 3 – Depot vs. Immobilie (Kaufen vs. Mieten, optional Kapitalanlage)

### 5.1 Zweck
Eigentum mit Kredit und ein Mieter, der Eigenkapital und Kostendifferenz ins Depot steckt, werden auf **dasselbe Netto-Vermögen nach T Jahren** gebracht. Ehrlich mit Kaufnebenkosten in Niedersachsen, Instandhaltung, Zinsänderungsrisiko und Disziplin des Mieters.

### 5.2 Vorbilder

| Vorbild | Gut | Schwach | Beleg |
|---|---|---|---|
| **NYT „Is It Better to Rent or Buy?“** | rund zwei Dutzend Faktoren werden zu **einer Zahl** verdichtet: die Miete, ab der Kaufen besser ist. Opportunitätskosten des Eigenkapitals, laufender Kostenvergleich, alles in heutigen Dollar | Bezahlschranke, US-Steuern. Kauf- und Verkaufskosten 4 % und 6 % sind laut Felix Salmon fast der ganze Vorteil des Mieters. Keine Wahrscheinlichkeiten, Annahme, dass der Mieter die Differenz investiert | [getrichslowly](https://www.getrichslowly.org/the-new-york-times-rent-vs-buy-calculator/), [Felix Salmon](https://www.felixsalmon.com/?p=854), [Product Hunt](https://www.producthunt.com/products/rentvsbuymath) |
| **Gerd Kommer, „Kaufen oder Mieten?“** | Datenbasis 1970–2015: In fast allen Szenarien war Mieten besser. Instandhaltung 1,5 % des Werts pro Jahr. Nebenkosten 7–10 %, daher erst ab ca. 10 Jahren Haltedauer sinnvoll. „Totes Kapital“ bei Übergröße, Mobilität | Buch, kein Rechner. Seine Regel passt laut Kommer nicht sauber auf Käufe ab 2008. Ein Leser nennt eine 7 %-Finanzierungsannahme | [Der Standard](https://www.derstandard.at/story/2000119613180/immobilie-mieten-oder-kaufen), [justETF Academy](https://www.justetf.com/ch/academy/kaufen-oder-mieten-und-in-etfs-investieren.html), [zendepot-Interview](https://zendepot.de/eigenheim-vs-etf-portfolio-wer-hat-die-nase-vorn/) |
| **Finanztip, Finanzfluss, Capitalo** | deutsche Nebenkosten und Steuern | Rechner-Details nicht geprüft | [capitalo](https://www.capitalo.de/baufinanzierung/ratgeber/immobilie-kaufen-oder-mieten) |
| **rentvsbuymath** (Product Hunt) | **symmetrische** Opportunitätskosten: Wer weniger zahlt, investiert die Differenz | Drittanbieter | [Product Hunt](https://www.producthunt.com/products/rentvsbuymath) |

### 5.3 Eingaben

| Leadmagnet | Login |
|---|---|
| Kaufpreis, vergleichbare Kaltmiete, Eigenkapital, Bauzins (Default live aus SUD119), Horizont (Default 20 J.) | zusätzlich: Anteil Grundstück/Gebäude, Wohnfläche und Baujahr (Instandhaltung), Hausgeld (nicht umlagefähig), Grundsteuer, Gebäudeversicherung, Tilgung, Zinsbindung und Anschlusszins-Szenario, Sondertilgung, KfW, Wertsteigerung Boden vs. Gebäude, Mietsteigerung, Depotrendite und -kosten, Grenzsteuersatz, **Disziplin des Mieters** (investiert 100/50/0 % der Differenz), geplanter Verkauf, Verkaufskosten |

### 5.4 Rechenmethode (jährlich, nominal, Ausgabe auch real)

**Kaufnebenkosten (Niedersachsen):**
$$\text{NK} = P\cdot(\underbrace{5{,}0\,\%}_{\text{GrESt}} + \underbrace{1{,}5\text{–}2{,}0\,\%}_{\text{Notar+GB}} + \underbrace{0\text{–}3{,}57\,\%}_{\text{Makler}})\ \approx\ 6{,}5\text{–}10{,}6\,\%$$
Bemessungsgrundlage der Grunderwerbsteuer ist der Kaufpreis ohne separat ausgewiesenes bewegliches Inventar (z. B. Küche) [sekundär] ([rechner-hub](https://rechner-hub.de/grunderwerbsteuer/niedersachsen/)).

**Käufer:**
- Darlehen $D_0 = P + \text{NK} - \text{EK}$ (Option: Nebenkosten aus Eigenkapital).
- Annuität $A = D_0\,(i + t_0)$. Zinsen $Z_t = D_{t-1}\,i_t$, Tilgung $T_t = A - Z_t$, Restschuld $D_t = D_{t-1}-T_t$.
- Anschlusszins nach Ablauf der Zinsbindung als Szenario: $i \pm 2$ Prozentpunkte.
- Wert: $W_t = B_0(1+g_B)^t + G_0(1+g_G)^t\cdot(1-\delta)^t$ (Boden $B$ steigt, Gebäude $G$ altert mit $\delta$). Einfachvariante: $W_t = P(1+g)^t$.
- Eigentümerkosten pro Jahr: $O_t = Z_t + T_t + m\cdot W_t + \text{GrSt}_t + \text{Vers}_t + \text{Hausgeld}^{\text{n.u.}}_t$. Die Tilgung ist Vermögensaufbau und gehört deshalb zum *Cash-Abfluss*, nicht zu den *Kosten*.
- Vermögen nach T Jahren: $NW^{K}_T = W_T(1-v) - D_T + \text{Depot}^{K}_T$, mit $v$ = Verkaufskosten (nur bei geplantem Verkauf).
- **Steuer:** Bei Eigennutzung im Verkaufsjahr und den beiden Vorjahren oder nach mehr als 10 Jahren ist der Verkauf **steuerfrei** (§23 EStG). Die ersparte Miete ist ebenfalls steuerfrei (implizite Mietrendite) [sekundär] ([ImmoScout24](https://www.immobilienscout24.de/wissen/verkaufen/spekulationsfrist-selbstgenutzte-immobilien.html)).

**Mieter:**
- Start: $\text{Depot}^M_0 = \text{EK}$ (inklusive Nebenkosten, die der Käufer ausgegeben hat).
- Jahr t: $\Delta_t = O_t - M_t$ ($M_t$ = Miete inkl. nicht umlagefähiger Kosten).
  - Ist $\Delta_t > 0$, investiert der Mieter $d\cdot\Delta_t$ (Disziplin $d$).
  - Ist $\Delta_t < 0$, investiert der Käufer $|\Delta_t|$ (symmetrisch).
- Depot wächst mit $(1+r)(1-c)$, Vorabpauschale jährlich, am Ende latente Steuer abziehen: $NW^M_T = \text{Depot}^M_T - \text{St}^{\text{latent}}$.

**Aha 1 – Break-even-Wertsteigerung $g^*$:** Löse $NW^K_T(g^*) = NW^M_T$. Ausgabe: „Die Immobilie muss jährlich **g\* %** an Wert gewinnen, damit Kaufen gleichzieht. Zum Vergleich: Inflation 09/2026 +3,3 %, Häuserpreisindex Q2/2026 +0,6 % zum Vorjahr.“

**Aha 2 – Mietschwelle (NYT-Logik):** Löse $NW^K_T = NW^M_T(M^*)$ nach der Startmiete $M^*$ auf. „Bekommst du eine vergleichbare Wohnung für unter **M\* €/Monat**, ist Mieten besser.“

**Aha 3 – Nutzerkosten-Faustformel** (User Cost, zur Plausibilisierung):
$$UC = P\cdot\big[\,w_{EK}\,r_{\text{alt}} + w_{FK}\,i + m + \tau - g\,\big] + \frac{\text{NK} + v\,P}{T}$$
Kaufen ist auf Jahressicht günstiger, wenn die Jahreskaltmiete größer als UC ist. Dazu das **Kaufpreis-Miet-Verhältnis** $P/(12M)$ anzeigen.

**Option: vermietete Immobilie als Kapitalanlage vs. Depot**
- Cashflow vor Steuer: $CF_t = M^{\text{Soll}}_t(1-\ell) - \text{Bewirtschaftung}_t - Z_t - T_t$ (Leerstand bzw. Mietausfall $\ell$).
- Steuer: $\text{St}_t = (M^{\text{Ist}}_t - \text{WK}_t - Z_t - \text{AfA}_t)\cdot t_{\text{pers}}$. Ein negatives Ergebnis senkt die übrige Steuer (Schema mit Nutzer-Grenzsteuersatz).
- **AfA** auf den Gebäudeanteil inklusive anteiliger Nebenkosten [sekundär]:
  - linear 2 % (Fertigstellung 1925–2022), 2,5 % (vor 1925), **3 %** (Fertigstellung ab 01.01.2023, §7 Abs. 4 S. 1 Nr. 2a)
  - **degressiv 5 %** vom Restbuchwert (§7 Abs. 5a) für Wohngebäude mit Baubeginn vom 01.10.2023 bis 30.09.2029 bzw. Kauf im Fertigstellungsjahr. Ein Wechsel zur linearen AfA ist möglich ([Haus & Grund Frankfurt](https://www.hausundgrund.de/verein/frankfurtammain/fachwissen/2024062/Wachstumschancengesetz), [steuerberater-schuermann](https://www.steuerberater-berlin-schuermann.de/steuernews_mandanten/juni_2024/degressive_wohngebaeude_afa/)). Eine Quelle nennt 6 %, das ist **widersprüchlich** (Kapitel 9).
- Verkauf vor 10 Jahren: Gewinn = Erlös − (Anschaffungskosten − kumulierte AfA), zum persönlichen Satz, Freigrenze 1.000 € [sekundär] ([steuerberater-tabak](https://steuerberater-tabak.com/steuerrechner/spekulationssteuer/)).
- Kennzahlen: Brutto- und Nettomietrendite, Eigenkapitalrendite (IRR der Cashflows inklusive Verkauf), Hebel-Effekt $\text{ROE} = r_{\text{Obj}} + \frac{FK}{EK}(r_{\text{Obj}} - i)$ und Stress-Szenarien (Zins +2 Prozentpunkte, 6 Monate Leerstand, Sanierung).

### 5.5 Default-Annahmen
| Parameter | Default | Quelle / Status |
|---|---|---|
| Grunderwerbsteuer | 5,0 % | [sekundär] |
| Notar + Grundbuch | 1,75 % (Mitte 1,5–2,0) | [sekundär] |
| Makler (Käufer) | 3,57 %, umschaltbar auf 0 % | [sekundär, Homeday] |
| Bauzins 10 J. | live Bundesbank SUD119, Fallback 3,9 % | [Bundesbank via Sekundär] |
| Instandhaltung | 1,5 % des Werts p. a. (Kommer). Die Untergrenze nach §28 II. BV 2026 je m²: 11,50 € (< 22 J.), 14,58 € (≥ 22 J.), 18,62 € (≥ 32 J.). Das sind gesetzliche Höchstsätze für den Sozialwohnungsbau, hier nur als Plausibilitäts-Untergrenze | [sekundär] [Der Standard](https://www.derstandard.at/story/2000119613180/immobilie-mieten-oder-kaufen), [Haus & Grund München PDF](https://www.haus-und-grund-muenchen.de/documents/press_articles/20251205_pi_mieterhhung%20bei%20sozialwohnungen%20zum%201.1.2026.pdf) |
| Peterssche Formel (Alternative) | Herstellkosten/m² × 1,5 / 80 (× 0,7 für Gemeinschaftseigentum) | [sekundär] [reduco](https://reduco.ai/blog/immobilienwirtschaft/instandhaltungsruecklage-vs-energetische-sanierung) |
| Wertsteigerung | Default = Inflationsannahme (real 0 %) als neutrale Annahme, Szenarien −1/0/+1 % real. Die Langfrist-Evidenz (Destatis-Reihe ab 2000, GREIX) ist **noch auszuwerten** | Destatis GENESIS |
| Mietsteigerung | = Inflationsannahme | Annahme |
| Depotrendite | Szenarien wie in Tool 1, Kosten 0,2 % | Annahme |
| Verkaufskosten | 0 % (Eigennutzung ohne Verkauf) bzw. 3,57 % Makler | Annahme |

### 5.6 Ausgaben und Visualisierung
- **Zwei Vermögenskurven** (Käufer vs. Mieter) über die Jahre mit Schnittpunkt („ab Jahr X liegt der Käufer vorn“).
- **Break-even-Wertsteigerung** und **Mietschwelle** als große Zahlen.
- **Tornado-Diagramm:** Welche Annahme bewegt das Ergebnis am meisten (Zins, Wertsteigerung, Instandhaltung, Disziplin)?
- **Risikokarte:** Klumpen (z. B. 80 % des Vermögens in einem Objekt in Stade), Hebel, Zinsänderung bei der Anschlussfinanzierung, Mobilität.
- **Nicht-finanzielle Spalte:** Sicherheit, Gestaltungsfreiheit, Kündigungsschutz – bewusst ohne Euro-Wert.

### 5.7 Fallstricke und Verzerrungen
- **Disziplin des Mieters:** Die meisten Rechner unterstellen, dass der Mieter die Differenz komplett investiert (Kritik an der NYT). Das ist der Grund für den Disziplin-Schalter. Der **Zwangsspareffekt** der Tilgung ist real.
- **Rückschaufehler:** Die Jahre 2010–2021 mit fallenden Zinsen und steigenden Preisen sind keine Normalität. 2023 fielen die Preise um 8,4 % (Destatis).
- **Vergleichbarkeit:** gleiche Wohnfläche und Lage. Die Miete einer kleineren Wohnung gegen den Kauf eines größeren Hauses zu stellen, ist kein fairer Vergleich (Kommer: totes Kapital).
- **Gebäudealterung:** Nominale Wertsteigerung auf den vollen Kaufpreis überschätzt den Wert, weil nur der Boden real steigt.
- **Gebäudeenergiegesetz (GEG) und Sanierung:** Pflichten und Heizungstausch nicht vergessen, eigenes Szenario anbieten.
- **Grundsteuer Niedersachsen** nach dem Flächen-Lage-Modell, nicht recherchiert, deshalb Nutzereingabe.
- **Depot-Steuern** gehören in die Mieter-Rechnung, sonst wirkt der Mieter zu gut.

### 5.8 Rechtliche Leitplanken
- Keine Objekt- oder Kreditempfehlung, weil §34c/§34i nicht geprüft sind. Für Finanzierungsangebote nur auf **Partner mit §34i** verweisen, Tippgeber-Regeln mit der IHK klären.
- Steuer bei Vermietung nur schematisch (StBerG). Hinweis: „AfA-Wahl, Kaufpreisaufteilung und Spekulationsfrist mit Steuerberater klären.“
- UWG: kein „Kaufen ist Unsinn“-Framing als Tatsachenbehauptung. Die Marke „Weniger Bullshit“ heißt hier, **Annahmen offen zu legen**.

### 5.9 Öffentlich vs. Login und Aufwand
- Öffentlich: Kaufen vs. Mieten mit Break-even-Wertsteigerung, Mietschwelle und Defaults für Niedersachsen, Aufwand **M**.
- Login: Kapitalanlage-Immobilie vs. Depot mit AfA, Leerstand, IRR und Stress-Tests, verknüpft mit dem Vermögensplan, Aufwand **M–L**.

---

<a id="tool4"></a>
## 6. Tool 4 – Altersvorsorgedepot-Rechner (ab 01.01.2027)

### 6.1 Belegstand der Regeln
Ergänzt research.md A7. Der BGBl.-Volltext (BGBl. I 2026 Nr. 156, ausgegeben am 29.05.2026) war **nicht abrufbar**. Die Regeln stammen aus Suchauszügen von BGBl., BMF-FAQ, DRV und Sekundärquellen.

| Regel | Inhalt | Status |
|---|---|---|
| **Grundzulage (§84 EStG n. F.)** | **50 % der Beiträge bis 360 €** plus **25 % der Beiträge von 360,01 bis 1.800 €**, maximal 540 €/Jahr | **[Gesetzestext, Auszug]** ([BGBl.-Treffer](https://www.recht.bund.de/bgbl/1/2026/156/regelungstext.pdf?__blob=publicationFile&v=1), [cash-online](https://www.cash-online.de/a/altersvorsorgedepot-ab-2027-726968/)) |
| Kinderzulage | **1 € je Euro Eigenbeitrag, maximal 300 € je kindergeldberechtigtem Kind**. Volle Höhe ab 25 €/Monat Eigenbeitrag, der Betrag deckt alle Kinder ab | [sekundär] ([versicherungsmakler.ac](https://versicherungsmakler.ac/altersvorsorgedepot-kinderzulage/), [capitalo](https://www.capitalo.de/depot/altersvorsorgedepot)) |
| Mindesteigenbeitrag (§86 n. F.) | **120 €/Jahr**, darunter keine Zulage, auch keine anteilige | [sekundär], §86 als „Mindesteigenbeitrag“ im Suchauszug erkennbar |
| Berufseinsteigerbonus | einmalig 200 € unter 25 Jahren (Stichtag Beginn des Beitragsjahres) | [sekundär] |
| Geringverdiener-Bonus 175 € | **nicht** im finalen Gesetz (stammt aus einem Entwurf von 2024). 175 € ist im Gesetz die Obergrenze der Grundzulage für mittelbar berechtigte Ehegatten | [sekundär] ([vorsorgedepot-lotse](https://www.vorsorgedepot-lotse.de/wissen/geringverdiener-bonus-im-altersvorsorgedepot-hoehe-regeln)) |
| Höchsteinzahlung | **6.840 €/Jahr** insgesamt. Gefördert sind 1.800 €, der Rest ist ungefördert, liegt aber im steuerlich geschützten Mantel | [sekundär] ([capitalo Selbstständige](https://www.capitalo.de/depot/ratgeber/altersvorsorgedepot-selbststaendige)) |
| Förderberechtigte | auch **Selbständige** (§15/§18 EStG) mit abgegebener Steuererklärung | [sekundär] |
| Ansparphase | Erträge steuerfrei, keine Vorabpauschale | [sekundär] |
| Auszahlung | **frühestens mit Vollendung des 65., spätestens mit dem 70. Lebensjahr**. Leibrente oder **Auszahlplan mindestens bis 85**. Bis zu 30 % Kapital zu Rentenbeginn | Alter: **[BMF-FAQ, Auszug]**, Rest [sekundär] ([BMF-FAQ](https://www.bundesfinanzministerium.de/Content/DE/FAQ/reform-der-privaten-altersvorsorge.html)) |
| Besteuerung der Leistungen | nachgelagert, §22 Nr. 5 EStG, zum persönlichen Satz | [sekundär] |
| **Standarddepot** | zwei vom Anbieter vorgegebene Fonds (vorsichtig bzw. renditeorientiert), Umschichtung vor Rentenbeginn in den risikoärmeren. **Effektivkosten maximal 1,0 %** (Entwurf: 1,5 %). Jeder Anbieter (außer Bausparkassen) muss es anbieten. Ein öffentlicher Träger braucht noch eine Verordnung | **[BMF-FAQ/DRV, Auszug]** ([DRV](https://www.deutsche-rentenversicherung.de/DRV/DE/Rente/Moeglichkeiten-der-Altersvorsorge/Altervorsorgereformgesetz), [Haufe](https://www.haufe.de/steuern/gesetzgebung-politik/altersvorsorgereformgesetz_168_668868.html)) |
| Kostendeckel für andere Produkte | **nicht belegt**. Die Quellen nennen den Deckel nur beim Standarddepot | offen |
| Abschluss- und Vertriebskosten | Verteilung über die **gesamte Ansparphase** statt über 5 Jahre. Beim Wechsel keine erneuten Abschlusskosten auf übertragenes gefördertes Kapital | [sekundär] ([dasinvestment](https://www.dasinvestment.com/zillmerverfahren-altersvorsorgereform-provision-abschlusskosten-vermittler/), [dieversicherer](https://www.dieversicherer.de/versicherer/altersvorsorge/news/altersvorsorgereform-195288)) |
| Anbieterwechsel | aufnehmender Anbieter maximal 150 € Gebühr (BMF-Auszug). Dazu ein gedeckelter Betrag des abgebenden Anbieters in den ersten 5 Jahren (Parlamentsmaterial) | [BMF/Bundestag, Auszug, Details unklar] |
| Garantieprodukte | Garantie auf 80 % oder 100 % der Beiträge möglich | [sekundär] |
| Zulässige Anlagen | Positivliste (Anlage zum AltZertG): OGAW/ETFs bis Risikoklasse 5, bestimmte Anleihen. **Keine Einzelaktien**, Zertifikate, Derivate oder Krypto | [sekundär] ([Morningstar](https://global.morningstar.com/de/persoenliche-finanzen/altersvorsorgedepot-was-plant-die-bundesregierung-bei-der-reform-der-privaten-vorsorge)) |
| Sonderausgabenabzug / Günstigerprüfung §10a | Höchstbetrag ab 2027 laut Ratgebern 1.800 € Eigenbeitrag (+ Zulagen, also 2.340 € ohne Kinder). Der geltende §10a-Wortlaut nennt noch 2.100 € | **widersprüchlich**, Kapitel 9 |
| Besteuerung ungeförderter Beiträge (> 1.800 €) | Rente: Ertragsanteil. Kapital bzw. Auszahlplan: halbe Erträge, eventuell mit 15 % Teilfreistellung. Laut Sekundärquelle steht ein BMF-Anwendungsschreiben noch aus | **ungeklärt**, Kapitel 9 |
| Riester | ab 2027 keine Neuabschlüsse, freiwilliger (unumkehrbarer) Wechsel ins AV-Depot | [sekundär] |
| Frühstart-Rente | eigenes Gesetz, Kabinett am 12.08.2026, **nicht beschlossen** | [BMF-PM, Auszug] |

### 6.2 Vorbilder
- **Finanztip AV-Depot-Rechner** ([finanztip.de/altersvorsorge/altersvorsorgedepot-rechner](https://www.finanztip.de/altersvorsorge/altersvorsorgedepot-rechner/)), **finanzen.net AV-Depot-Rechner** ([finanzen.net](https://www.finanzen.net/ratgeber/vorsorge/altersvorsorgedepot-rechner/)), **finanz.de** (Zulagen, Förderquote, Depotwert), rechner-hub, deutschland-rechner. Funktionsumfang **nicht geprüft**, die Seiten waren nicht abrufbar.
- **Lücke:** Viele Rechner zeigen Zulage und Endwert, aber die **nachgelagerte Besteuerung**, die Wirkung des **Kostendeckels** gegenüber einem freien Depot und den **Vergleich mit einem ungeförderten ETF-Depot nach Steuern** sieht man selten.

### 6.3 Eingaben
| Leadmagnet | Login |
|---|---|
| Eigenbeitrag/Monat, Anzahl kindergeldberechtigter Kinder (und wie lange), Alter, Rentenbeginn (65–70), Grenzsteuersatz heute und im Alter (Schieberegler), Produkt: Standarddepot (≤ 1,0 %) oder eigenes Depot (Kosten eingeben) | zusätzlich: Berufseinsteiger (< 25), Ehegatte mittelbar berechtigt, ungeförderte Zusatzbeiträge bis 6.840 €, Riester-Übertrag (Wert, Kosten des Altvertrags), Auszahlform (Plan bis 85, Leibrente, 30 % Kapital), Rentenfaktor bei Leibrente, Krankenversicherung im Alter |

### 6.4 Rechenmethode
**Zulage pro Jahr** ($B$ = Eigenbeitrag, $n_K$ = Kinder mit Anspruch):
$$Z(B)=\mathbb{1}[B\ge120]\cdot\Big(0{,}5\min(B,360)+0{,}25\max\big(0,\min(B,1800)-360\big)+n_K\min(B,300)\Big)\ (+200\ \text{einmalig, < 25 J.})$$
**Förderquote** $FQ = Z/B$. Beispiele: 360 € → 50 %; 1.800 € → 30 %; mit einem Kind und 300 € → (150 + 300)/300 = **150 %**; mit zwei Kindern und 300 € → **250 %**. Ob $B$ den Eigenbeitrag ohne Zulagen meint, ist laut den Quellen („beitragsproportional“, „Eigenbeitrag“) anzunehmen, im Gesetzestext aber **zu bestätigen**.

**Steuervorteil (Günstigerprüfung, nur mit Flag „vorläufig“):**
$$\Delta St = \max\big(0,\ t_{\text{heute}}\cdot\min(B+Z,\ H) - Z\big)$$
Der Höchstbetrag $H$ ist **ungeklärt** (Kapitel 9). Bis zur Klärung entweder ausblenden oder als Szenario zeigen.

**Ansparphase:**
$$V_{t+1}=(V_t + B_t + Z_t)\cdot(1+r_t)\cdot(1-c^{\text{eff}})$$
Beim Standarddepot ist $c^{\text{eff}}\le1{,}0\,\%$ und die Allokation verschiebt sich vor Rentenbeginn ins vorsichtigere Portfolio (Glidepath). Dafür niedrigere $r$ in den letzten Jahren ansetzen, als Parameter mit Hinweis „Glidepath je Anbieter“.

**Auszahlplan bis 85** (z. B. von 65 bis 85, $n$ = 20 Jahre, Verzinsung $q$ in der Auszahlphase):
$$P = V_{65}\cdot\frac{q}{1-(1+q)^{-n}},\qquad P^{\text{netto}} = P\cdot(1-t_{\text{Alter}})$$
Gefördertes Kapital wird zu **100 %** nachgelagert besteuert. Ein ungeförderter Anteil wird getrennt geführt, mit Flag „Regel ungeklärt“.

**Vergleich A – ungefördertes ETF-Depot** mit gleichem Eigenbeitrag $B$ (ohne Zulage): Vorabpauschale, Teilfreistellung, Sparer-Pauschbetrag, Abgeltungsteuer im Auszahlplan, FIFO (wie Tool 2).
**Vergleich B – Fondsrente** (aus Tool 2) mit gleicher Einzahlung.
**Vergleich C – Riester-Bestand behalten vs. übertragen** (nur im Login und nur mit Daten aus dem Altvertrag).

**Kernkennzahl „Förder-Rendite“:** IRR der Eigenbeiträge gegen die Netto-Auszahlungen:
$$\sum_t -B_t(1+\text{IRR})^{-t} + \sum_{u} P^{\text{netto}}_u(1+\text{IRR})^{-u}=0$$
Die Zulage steckt in $P$ und hebt den IRR über die Marktrendite. Bei hohem Steuersatz im Alter sinkt er.

### 6.5 Default-Annahmen
- Kosten Standarddepot: 1,0 % als **Obergrenze**, nicht als Erwartung, plus Szenario 0,5 %. Echte Angebote gibt es erst ab 2027.
- Rendite: drei Szenarien, das risikoärmere Portfolio im Glidepath mit niedrigerer Rendite (Annahme offenlegen).
- Steuersatz im Alter: Nutzer-Schieberegler, Default 20 %. Der Grundfreibetrag 2026 ist **nicht geprüft**, deshalb den Wert nicht nennen.
- Kinderzulage: nur solange Kindergeld besteht (Dauer als Eingabe, Default bis 25. Lebensjahr des Kindes [eigenes Wissen, prüfen]).

### 6.6 Ausgaben und der Aha-Moment
1. **„Für jeden Euro, den du einzahlst, legt der Staat X Cent drauf.“** Darstellung als Förderquote-Tacho, Familien sehen 150–250 %.
2. **Optimaler Beitrag:** Kurve der Förderquote über $B$ mit Knicken bei 120 €, 300 € (Kinder), 360 € und 1.800 €. „Ab 1.800 € gibt es keine Zulage mehr. Was darüber liegt, ist nur noch Steuerstundung.“
3. **Netto im Alter** von AV-Depot vs. freiem ETF-Depot vs. Fondsrente, mit Annahmen-Panel.
4. **Kosten-Euro:** „Beim Deckel von 1,0 % kostet dich das Standarddepot über 35 Jahre X €, ein Depot mit 0,3 % Y €.“
5. **Ehrlich-Box:** „Was wir noch nicht wissen“ (Höchstbetrag §10a, ungeförderte Beiträge, Verordnungen, Anbieterliste).

### 6.7 Fallstricke
- **Nachgelagerte Steuer** frisst einen Teil der Zulage. Wer im Alter einen hohen Satz hat, profitiert weniger (das zeigen!).
- **Zulage ≠ Rendite:** Zulagen fließen ins Depot und nicht aufs Konto, außerdem gibt es eine Bindung bis mindestens 65.
- **Kostendeckel = Obergrenze**, kein Gütesiegel. Ein freies AV-Depot kann günstiger oder teurer sein.
- **Riester-Übertrag** ist unumkehrbar. Garantien und Rentenfaktoren des Altvertrags können wertvoll sein, deshalb nur im Gespräch.
- **Grundsicherung im Alter:** Ob die Anrechnungsfreibeträge (bisher für Riester) auch für das AV-Depot gelten, ist **nicht geprüft**.
- **Rechtsstand:** Bis zur BMF-Anwendung und den Verordnungen jede Zahl mit „Stand“ und Quelle versehen.

### 6.8 Rechtliche Leitplanken
- §B8: Bis 01.01.2027 „ab 2027“ kennzeichnen, Zulagen nur aus dem BGBl.-Wortlaut. §84 ist über den Auszug belegt, für Kinderzulage und Mindestbeitrag den **Volltext prüfen**.
- **Vermittlung:** Ob die Vermittlung eines AV-Depots (zertifizierter Altersvorsorgevertrag, Fondsanteile im Depot einer Bank oder KVG) unter §34f fällt und wie die Vergütung aussieht (Abschlusskosten über die Laufzeit verteilt), ist **ungeklärt**. Das mit der IHK und dem Pool klären. Der Rechner nennt bis dahin **keine Anbieter**.
- Keine Anbieter-Rankings ohne offengelegte Methodik (UWG).

### 6.9 Öffentlich vs. Login und Aufwand
- Öffentlich: Zulagen- und Förderquoten-Rechner mit Netto-Vergleich, Aufwand **S–M**. **Sofort bauen**, weil die Suchnachfrage im 4. Quartal 2026 und im 1. Quartal 2027 kommt.
- Login: Riester-Übertrag-Check, Familien-Optimierung (wer zahlt wie viel bei zwei Partnern), Verknüpfung mit dem Rentenlücken-Plan, Aufwand **M**.

---

<a id="tool5"></a>
## 7. Tool 5 – Weitere Signature-Tools (Liste mit Einschätzung)

| Tool | Aha-Moment | Fit zur Marke | Rechtsrisiko | Aufwand | Einschätzung |
|---|---|---|---|---|---|
| **Kosten-Zeitmaschine** (standalone) | „0,8 Prozentpunkte mehr Kosten = X € weniger nach 30 Jahren“ (Beispiel: 300 €/Monat, 6 % brutto, 0,8 Prozentpunkte Kostendifferenz ergibt grob 37.000 € weniger, eigene Überschlagsrechnung) | sehr hoch | niedrig (keine ISIN) | **S** | **Sofort**, ist Teil von Tool 1 und der beste Einstieg |
| **Rentenlücke mit DRV-Renteninfo-Upload** | „Deine gesetzliche Rente in heutiger Kaufkraft: X €. Lücke: Y €/Monat“ | hoch | mittel (Upload enthält Versicherungsnummer, also im Browser parsen, nur Beträge übernehmen) | **M** | stark. Rentenwert 42,52 € ab 07/2026, Haltelinie 48 % bis 2031 ([DRV](https://www.deutsche-rentenversicherung.de/DRV/DE/Ueber-uns-und-Presse/Presse/Meldungen/2026/260305-rentenanpassung-2026.html)). Die Hochrechnungsvarianten der Renteninformation (1 %/2 %) **nicht geprüft** |
| **Entnahmeplan mit Monte Carlo / Sequenzrisiko** | „Gleiche Durchschnittsrendite, trotzdem pleite mit 81, wenn der Crash früh kommt“ | sehr hoch (evidenzbasiert) | **mittel–hoch**: Art. 44 Abs. 6 lit. a (keine Simulation auf simulierter Vergangenheit), deshalb parametrische Szenarien. FIRECalc-artiges historisches Backtesting nur als Rückblick | **M–L** | sehr stark. Deutsche Vorbilder (Finanzfluss, finanz.de, extraETF) rechnen eher deterministisch ([Finanzfluss Entnahmeplan](https://www.finanzfluss.de/rechner/entnahmeplan/), [The Poor Swiss](https://thepoorswiss.com/de/rendite-risiko-abfolge/)) |
| **Inflations- und Kaufkraftrechner** | „1.000 € heute sind 2056 noch X € wert“ | mittel | niedrig | **S** | als Baustein in allen Tools, standalone wenig Differenzierung. Destatis-VPI live einbinden |
| **Vorabpauschale- und Freistellungsauftrag-Planer** | „Im Januar 2027 bucht deine Bank X € ab, verteil deinen Pauschbetrag so“ | hoch (Jahresreview) | niedrig bis mittel (StBerG: schematisch) | **S** | **Saisonaler Lead im Januar**, Basiszins 3,20 % für 2026 |
| **Fondspolice-Check (Bestand: weiter, beitragsfrei, kündigen?)** | „Kündigen kostet dich X €, Weiterzahlen kostet Y €“ | sehr hoch (Makler-Kern) | **hoch** (Kündigungsberatung, Haftung, Steuerfolgen). Nur im Login und nur mit Beratung | **L** | wertvoll, aber Tool 2 als Basis zuerst |
| **BU-Bedarfsrechner** | „Wenn du morgen berufsunfähig wirst, fehlen dir X €/Monat bis zur Rente“ | hoch | mittel (§34d, keine Gesundheitsdaten für den Bedarf nötig, Art. 9 vermeiden) | **S–M** | gut als Leadmagnet, Tarifvergleich bleibt im Pool bzw. simplr |
| **PKV vs. GKV** | „Beitrag mit 67: GKV ~X, PKV ~Y – unter Annahmen“ | mittel | **hoch** (Beitragsentwicklung unsicher, Irreführungsgefahr, Gesundheitsdaten) | **L** | eher Gesprächsleitfaden als Rechner, niedrige Priorität |
| **Notgroschen- und Liquiditäts-Check** | „Du hast 2,1 Monatsausgaben Reserve, Ziel 3–6“ | mittel | niedrig | **S** | Baustein im Finanzplan |
| **Kinderdepot vs. AV-Depot mit Kinderzulage vs. Frühstart-Rente** | „Was bringt dein Kind mit 18 bzw. 67 mehr?“ | hoch für Familien | mittel (Frühstart-Rente nicht beschlossen) | **M** | erst nach dem Beschluss zur Frühstart-Rente |
| **Rebalancing-Rechner** | „Verkauf X € von A, kauf Y € B, Steuer-Folge Z €“ | hoch für Bestandskunden | mittel–hoch (konkrete Order ist Beratung) | **S–M** | nur im Login und nur mit Geeignetheitserklärung |

---

<a id="reihenfolge"></a>
## 8. Empfohlene Reihenfolge und Klärungsliste

### 8.1 Reihenfolge
1. **AV-Depot-Rechner (öffentlich), S–M:** Er ist zeitkritisch wegen des Starts am 01.01.2027, und die Kernformel §84 ist belegt. Unsichere Teile (Höchstbetrag §10a, ungeförderte Beiträge) werden ausgeblendet oder als „vorläufig“ gekennzeichnet.
2. **Kosten-Zeitmaschine bzw. Depot-Check Lite (öffentlich), M:** größter Aha-Moment pro Aufwand, kuratierte Fondsdaten, keine ISIN-Empfehlung.
3. **Depot vs. Rentenversicherung (öffentlich: Break-even-Kosten), M:** Makler-Kern und Differenzierung, Basis für den Policen-Check.
4. **Kaufen vs. Mieten (öffentlich), M:** viel Konkurrenz. Abheben mit Break-even-Wertsteigerung, Mietschwelle, Disziplin-Schalter und Defaults für Niedersachsen.
5. **Entnahmeplan mit Monte Carlo, M–L:** nach der Klärung von Art. 44 mit dem Anwalt.
6. **Depot-Check Pro (Login), L:** erst mit Datenlizenz.
7. **Policen-Check (Login), L.**

**Technische Basis (einmalig, M):** gemeinsame Parameter-Datei, Rechen-Engine in `shared/` mit Unit-Tests, Annahmen-Panel als Komponente, Disclaimer-Baustein, Szenario-Charts mit CI-Farben aus `tokens.ts`.

### 8.2 Wer klärt was (ergänzt research.md B12)
| Frage | Mit wem |
|---|---|
| Art. 44 Abs. 6 DelVO: Ist Monte Carlo mit historischem Bootstrapping zulässig? Zählt das Schattendepot als frühere Wertentwicklung? Gelten Rechner als Werbung im Sinn von §14 FinVermV? | Fachanwalt Bank- und Kapitalmarktrecht |
| Wann wird der Depot-Check zur Anlageberatung? Wie werden Einzelaktien, ETCs und Anleihen im Check behandelt (§34f-Grenze)? Taping für den Ergebnis-Chat | IHK Stade, Anwalt |
| AV-Depot: Vermittlung und Vergütung unter §34f? Honorar bei Nettotarifen als §34d-Makler zulässig? | IHK Stade, blau direkt |
| Lizenzen: OpenFIGI (Abs. 1 der AGB), iShares-, Xtrackers- und Vanguard-Holdings, MSCI/FTSE-Indexdaten, Kenneth French, Kneip-Preis, Morningstar-DWS-Preis | Anbieter schriftlich anfragen |
| Datenbankrecht (§87b UrhG) bei einer selbst kuratierten Fondsdatenbank aus KIDs | Anwalt (IT/Urheberrecht) |
| Steuerdarstellungen (FIFO, Günstigerprüfung, KVdR, 62/12, AfA-Sätze) auf Richtigkeit | Steuerberater (Review der Formeln, kein Einzelfall) |

---

<a id="nicht-verifiziert"></a>
## 9. Nicht verifiziert

**Gesetzestexte (nicht im Original abgerufen, Seiten gesperrt)**
- BGBl. I 2026 Nr. 156 im Volltext. Nur §84 (Grundzulage) liegt als Auszug vor. Kinderzulage, §86 Mindesteigenbeitrag, Höchsteinzahlung 6.840 €, Auszahlregeln, Positivliste und Kostendeckel sind nur über BMF-FAQ-Auszüge oder Sekundärquellen belegt.
- **§10a EStG ab 2027:** Höchstbetrag für den Sonderausgabenabzug. Ratgeber nennen 1.800 € bzw. 2.340 €, der geltende Wortlaut 2.100 €.
- **Besteuerung ungeförderter AV-Depot-Beiträge** (Ertragsanteil, Halbeinkünfte, 15 % Teilfreistellung, Alter 62 oder 65). Ein BMF-Anwendungsschreiben steht laut Sekundärquelle aus.
- Ob der Kostendeckel von 1,0 % **nur** für das Standarddepot gilt. Gebühren beim AV-Depot-Wechsel (150 € aufnehmend, Deckel abgebend), Details unklar.
- Ob die Grundsicherungs-Freibeträge für das AV-Depot gelten.
- §18 InvStG: Wortlaut der Vorabpauschale, insbesondere die 1/12-Kürzung im Kaufjahr (eigenes Wissen).
- §20 Abs. 4 S. 7 EStG (FIFO) und §32d Abs. 6 (Günstigerprüfung), Formel §32d Abs. 1 S. 4 (Kirchensteuer): eigenes Wissen, die Zahlen passen zu den Sekundärquellen.
- §20 Abs. 1 Nr. 6 EStG: Altersgrenze 60 für Verträge von 2005 bis 2011 (eigenes Wissen).
- Kranken- und Pflegeversicherungsbeiträge auf private Renten bzw. Kapitalerträge (KVdR vs. freiwillig versichert): eigenes Wissen.
- Basisrente: nicht vererbbar, nicht beleihbar (eigenes Wissen). Höchstbetrag 2026 von 30.826 € nur sekundär, Quellen teils widersprüchlich.
- **§7 Abs. 5a EStG:** degressive AfA 5 % belegt, eine Quelle nennt **6 %**, das ist ungeklärt. Berechnung vom Restbuchwert nicht bestätigt.
- §29 II. BV (Mietausfallwagnis 2 %) **nicht recherchiert**, deshalb im Rechner nicht als Default verwenden.
- Grunderwerbsteuer Niedersachsen 5,0 %: nur über Rechner- und Ratgeberseiten belegt, nicht über das Finanzministerium Niedersachsen.
- §6 StBerG (Ausnahmen für Vermittler). Die aktuelle Fassung von §2 StBerG ab 09/2026.
- §7c VVG (IBIP-Pflichten), Honorarannahme durch §34d-Makler bei Nettotarifen, §6 UWG (vergleichende Werbung), §87b UrhG (Datenbankrecht): eigenes Wissen bzw. nicht recherchiert.

**Marktdaten**
- Bundesbank-Bauzins für 08–10/2026 (SUD119), nur Werte für 02/2026 und vorläufig 05/2026.
- Typische **Rentenfaktoren 2026** (kein belastbarer Wert gefunden). Sterbetafel und Restlebenserwartung (Destatis) nicht abgerufen.
- SPIVA Europe: 10-Jahres-Wert von 98 % (EUR, Global Equity) nur aus einer Sekundärquelle.
- Deutscher Anteil am Weltaktienmarkt (für den Home Bias) nicht abgerufen.
- Langfristige reale Hauspreisentwicklung in Deutschland (GENESIS-Reihe ab 2000) nicht ausgewertet.
- Spanne für Rendite-Szenarien (3/5/7 %) ohne Quelle, sie muss belegt oder als reine Annahme deklariert werden.

**Vorbilder und Daten**
- Funktionsumfang der Rechner von Finanztip, finanzen.net, Finanzfluss, Verbraucherzentrale und Biallo (nicht abrufbar). Nettotarif-Anbieter und Honorarberater-Rechner nicht recherchiert.
- Morningstar Instant X-Ray: aktueller Stand in Deutschland und Zugang (kostenlos oder Premium) unklar.
- Preise: Morningstar DWS, Kneip, FE fundinfo, LSEG Lipper, Twelve Data. Lizenztexte: OpenFIGI Abs. 1, Kenneth French, iShares/Xtrackers/Vanguard, MSCI/FTSE.
- Stooq und LSEG/Refinitiv nicht recherchiert.
- Kenneth-French-Faktoren für Developed/Europe in USD (eigenes Wissen).
- Ob Marvin §34c oder §34i GewO hat.

---

<a id="quellen"></a>
## 10. Quellenliste

**Gesetz, Behörden, amtliche Statistik (über Suchauszüge)**
- BGBl. I 2026 Nr. 156 (Altersvorsorgereformgesetz): https://www.recht.bund.de/bgbl/1/2026/156/regelungstext.pdf?__blob=publicationFile&v=1
- BMF-FAQ Reform private Altersvorsorge: https://www.bundesfinanzministerium.de/Content/DE/FAQ/reform-der-privaten-altersvorsorge.html
- BMF-FAQ Frühstart-Rente: https://www.bundesfinanzministerium.de/Content/DE/FAQ/fruehstart-rente.html
- BMF-PM Frühstart-Rente 12.08.2026: https://www.bundesfinanzministerium.de/Content/DE/Pressemitteilungen/Finanzpolitik/2026/08/2026-08-12-regierungsentwurf-fruehstartrente.html
- BMF-Schreiben Basiszins 2026 (BVI-Kopie): https://direkt.bvi.de/fileadmin/user_upload/letter/2026/COO.7005.100.4.13897455.pdf
- otto-schmidt zum Basiszins 2026: https://www.otto-schmidt.de/news/steuerrecht/basiszins-zur-berechnung-der-vorabpauschale-gem-18-absatz-4-invstg-basiszins-zum-2-1-2026-2026-01-15.html
- Bundestag Textarchiv AV-Depot: https://www.bundestag.de/dokumente/textarchiv/2026/kw13-de-altersvorsorge-1156798
- Bundestag Drucksache 21/4996: https://dserver.bundestag.de/btd/21/049/2104996.pdf
- DRV Altersvorsorgereformgesetz: https://www.deutsche-rentenversicherung.de/DRV/DE/Rente/Moeglichkeiten-der-Altersvorsorge/Altervorsorgereformgesetz
- DRV Rentenanpassung 2026: https://www.deutsche-rentenversicherung.de/DRV/DE/Ueber-uns-und-Presse/Presse/Meldungen/2026/260305-rentenanpassung-2026.html
- Destatis Inflation 09/2026: https://www.destatis.de/DE/Presse/Pressemitteilungen/2026/09/PD26_348_611.html
- Destatis Häuserpreisindex Q2/2026: https://www.destatis.de/DE/Presse/Pressemitteilungen/2026/09/PD26_336_61262.html
- Destatis Häuserpreisindex Q1/2026: https://www.destatis.de/DE/Presse/Pressemitteilungen/2026/06/PD26_219_61262.html?nn=2110
- Bundesbank Wohnungsbaukredite (SUD119): https://www.bundesbank.de/de/statistiken/geld-und-kapitalmaerkte/zinssaetze-und-renditen/wohnungsbaukredite-an-private-haushalte-hypothekarkredite-auf-wohngrundstuecke-615036
- Art. 44 DelVO 2017/565: https://gesetze.legal/eu/vo_eu_2017_565/44 · https://umwelt-online.de/recht/eu/17a/17a_0565b.htm
- §5 StBerG: https://www.gesetze-im-internet.de/stberg/__5.html · §2 StBerG (Haufe): https://www.haufe.de/id/norm/steuerberatungsgesetz-2-geschaeftsmaessige-hilfeleistung-HI928673_p2.html
- §20 InvStG: https://lxgesetze.de/invstg/20
- §28 II. BV: https://www.gesetze-im-internet.de/bvo_2/__28.html
- BaFin-Merkblatt Anlageberatung (Vergleichsversion 02/2025): https://paytechlaw.com/wp-content/uploads/Vergleichsversion-Merkblatt-Hinweise-zum-Tatbestand-der-Anlageberatung-Stand-02-2025.pdf · GvW: https://www.gvw.com/aktuelles/blog/detail/aktualisiertes-merkblatt-der-bafin-zur-anlageberatung-und-einordnung-von-finfluencern
- IHK zu §34f/Bereichsausnahme: https://www.ihk.de/stuttgart/fuer-unternehmen/recht-und-steuern/gewerberecht/erlaubnisverfahren-fuer-finanzanlagenvermittler-berater-688598 · https://www.ihk.de/heilbronn-franken/produktmarken/branchen/gewerbeportal/finanzen/finanzanlagenvermittler-berater/erlaubnisverfahren-fuer-finanzanlagenvermittler-berater-4885452

**Steuern und Versicherung (sekundär)**
- Sparer-Pauschbetrag: https://nexvyra.de/fakten/sparerpauschbetrag-2026.html · https://taxtify.de/sparer-pauschbetrag/
- Abgeltungsteuer/Soli: https://www.steuerschroeder.de/Steuerrechner/Abgeltungsteuer.html · https://etf.capital/solidaritaetszuschlag/
- Teilfreistellung: https://www.capitalo.de/lexikon/teilfreistellung
- Rentenbesteuerung 2026: https://www.steuerschroeder.de/Rentenbesteuerung.html · Rürup 2026: https://www.steuerschroeder.de/Steuerrechner/Ruerup-Rente.html
- Ertragsanteil: https://www.lohnsteuer-kompakt.de/fag/2012/447/was_ist_eine_leibrente_
- Versicherungsleistungen: https://www.steuerschroeder.de/Besteuerung-Versicherung.html · https://www.huk.de/gesundheit-vorsorge-vermoegen/ratgeber/richtig-vorsorgen/rentenbesteuerung.html · https://swisslife.de/content/dam/de/documents/50/21413.pdf · https://www.vermittlerportal.de/leben/infoblatt-abgeltungsteuer-pst1305.pdf · https://www.iww.de/astw/einkommensteuer/22-estg-besteuerung-von-rentenzahlungen-aus-privaten-rentenversicherungsvertraegen-mit-kapitalwahlrecht-f174940
- Zillmerung/§169 VVG: https://www.deloitte.com/de/de/services/financial-advisory/analysis/Fruehstorno-und-Mindestrueckkaufswert.html · https://www.versicherungsbote.de/id/4845310/HDI-Riester-Rente-BDV-Abschlusskosten/ · https://gesetze.co/urteile/IV_ZR_17-13
- PIB/Effektivkosten: https://goa-eportale.allianz.de/XBR/FS4/XBRFS4030Z0.pdf.download.pdf · https://www.dasinvestment.com/studie-kosten-pib-ruerup-renten-fraunhofer-institut-wirtschaftsmathematik/ · https://www.cash-online.de/a/produktinformationsblatt-2-116932/
- Rechnungszins/Rentenfaktor: https://universa.de/site/assets/files/138742/pressemitteilung-2025_01_14-altersvorsorge_universa_verbessert_fondspolice.pdf · https://www.capitalo.de/lexikon/rentenfaktor
- Stiftung Warentest Fondspolicen: https://www.test.de/Vergleich-Rentenversicherung-mit-Fonds-3-von-33-fondsgebundenen-Rentenversicherungen-sind-gut-1563811-0/
- Finanztip-Forum: https://www.finanztip.de/community/forum/thema/46643-etf-vs-rentenversicherung-an-konkreten-beispiel/ · https://www.finanztip.de/community/forum/thema/16691-etf-nettopolicen/
- Biallo: https://www.biallo.de/aktienfonds/news/etf-rentenversicherung/

**Altersvorsorgedepot (sekundär)**
- https://www.haufe.de/steuern/gesetzgebung-politik/altersvorsorgereformgesetz_168_668868.html
- https://www.cash-online.de/a/altersvorsorgedepot-ab-2027-726968/
- https://finanzfacts.de/wiki/altersvorsorgedepot/aktueller-stand/
- https://www.capitalo.de/depot/altersvorsorgedepot · https://www.capitalo.de/depot/ratgeber/altersvorsorgedepot-selbststaendige
- https://versicherungsmakler.ac/altersvorsorgedepot-kinderzulage/
- https://www.vorsorgedepot-lotse.de/wissen/geringverdiener-bonus-im-altersvorsorgedepot-hoehe-regeln
- https://www.dasinvestment.com/zillmerverfahren-altersvorsorgereform-provision-abschlusskosten-vermittler/
- https://www.dieversicherer.de/versicherer/altersvorsorge/news/altersvorsorgereform-195288
- https://global.morningstar.com/de/persoenliche-finanzen/altersvorsorgedepot-was-plant-die-bundesregierung-bei-der-reform-der-privaten-vorsorge
- https://www.raisin.com/de-de/altersvorsorgedepot/ · https://www.handelsblatt.com/vergleich/altersvorsorgedepot-und-steuern/
- Rechner-Vorbilder: https://www.finanztip.de/altersvorsorge/altersvorsorgedepot-rechner/ · https://www.finanzen.net/ratgeber/vorsorge/altersvorsorgedepot-rechner/ · https://www.finanz.de/vorsorge/altersvorsorgedepot/

**Immobilie (sekundär)**
- Grunderwerbsteuer Niedersachsen: https://www.finanz.de/steuern/grunderwerbsteuer/niedersachsen/ · https://rechner-hub.de/grunderwerbsteuer/niedersachsen/
- Makler: https://www.homeday.de/de/homeday-makler/maklerkosten/ · https://www.vr.de/privatkunden/themenwelten/wohnen-immobilien/bauen-kaufen/maklerprovision.html
- Notar: https://finanz-rechner-hub.de/notarkosten-immobilienkauf/
- Spekulationsfrist: https://www.immobilienscout24.de/wissen/verkaufen/spekulationsfrist-selbstgenutzte-immobilien.html · https://steuerberater-tabak.com/steuerrechner/spekulationssteuer/
- AfA: https://www.lohnsteuer-kompakt.de/fag/2025/619/was_bedeutet_afa_nach__7_abs_4_estg_ · https://www.hausundgrund.de/verein/frankfurtammain/fachwissen/2024062/Wachstumschancengesetz · https://www.steuerberater-berlin-schuermann.de/steuernews_mandanten/juni_2024/degressive_wohngebaeude_afa/
- Instandhaltung: https://www.haus-und-grund-muenchen.de/documents/press_articles/20251205_pi_mieterhhung%20bei%20sozialwohnungen%20zum%201.1.2026.pdf · https://reduco.ai/blog/immobilienwirtschaft/instandhaltungsruecklage-vs-energetische-sanierung
- Bauzinsen: https://www.schwaebisch-hall.de/bauen-kaufen/baufinanzierung/bauzinsen-aktuell.html · https://www.drklein.de/aktuelle-bauzinsen.html
- NYT/Kommer: https://www.getrichslowly.org/the-new-york-times-rent-vs-buy-calculator/ · https://www.felixsalmon.com/?p=854 · https://www.producthunt.com/products/rentvsbuymath · https://www.derstandard.at/story/2000119613180/immobilie-mieten-oder-kaufen · https://www.justetf.com/ch/academy/kaufen-oder-mieten-und-in-etfs-investieren.html · https://zendepot.de/eigenheim-vs-etf-portfolio-wer-hat-die-nase-vorn/

**Depot-Analyse, Vorbilder und Daten**
- Parqet: https://parqet.com/en/blog/x-ray · https://parqet.com/llms.txt · https://www.justetf.com/de/academy/parqet-erfahrungsbericht.html · https://www.broker-test.at/portfolio-software/parqet/
- getquin: https://help.getquin.com/en/articles/8895421 · https://app.getquin.com/de/post/GiSyGILudJ/tool-fur-portfolio-analyse-uberschneidungen-prozentuale-gewichtung-von-markten-landern-uvm
- Morningstar: https://www.morningstar.com/business/products/direct-web-services · https://newsroom.morningstar.com/news/news-details/2023/Morningstar-Direct-Web-Services-Brings-Sophisticated-Investment-Data-Research-and-Calculation-APIs-to-Power-Firms-Digital-Platforms/default.aspx · https://portfolio.morningstar.com/RtPort/free/XRayFAQ.html · https://freenance.io/products/morningstar-investor-review-2026-premium-mutual-fund-etf-research/
- Portfolio Visualizer: https://allaboutmoney.substack.com/p/how-to-use-portfolio-visualizer · https://robberger.com/tools/portfolio-visualizer/
- testfol.io / Curvo: https://www.findmymoat.com/vs/curvo-backtest-vs-testfol-io · https://curvo.eu/backtest · https://www.finanztip.de/community/forum/thema/38323-%C3%BCberperformance-durch-rebalancing-depot-selbst-in-die-hand-nehmen/?pageNo=3
- True Wealth: https://truewealth.ch/en/blog/full-transparency-with-the-etf-lookthrough
- SPIVA Europe YE 2025: https://www.spglobal.com/spdji/en/documents/spiva/spiva-europe-year-end-2025.pdf · https://rikatillsammans.se/studier/spiva-europe-2025/
- OpenFIGI: https://www.openfigi.com/docs/terms-of-service · https://www.openfigi.com/api/documentation · https://docs.rs/openfigi-rs
- EODHD: https://apis.io/plans/eodhd/eodhd-plans-pricing/
- Finnhub: https://www.finnhub.io/pricing-etf-indices
- Twelve Data: https://support.twelvedata.com/en/articles/5544954-twelve-data-overview
- Alpha Vantage (Drittquelle): https://api.qveris.ai/guides/etf-holdings-api-for-ai-agents
- Kneip / Deutsche Börse: https://mds.deutsche-boerse.com/resource/blob/4095354/cf3b11fba27e2ff0cad0e98f0321e926/data/Product%20Sheet_Kneip-PRIIPs%20Data_V1_290824.pdf · https://mds.deutsche-boerse.com/mds-en/historical-data/deutsche-boerse-data-shop/kneip-fund-data
- FE fundinfo: https://fefundinfo.com/media/3c5lwmsn/fe-fundinfo-priips-uk-cci-ucits-product-sheet.pdf
- justETF: https://justetf.com/de/about/become-partner.html · https://apify.com/bovi/etf-data-extractor/api
- iShares/BlackRock-AGB: https://www.ishares.com/uk/professionals/en/compliance/terms-and-conditions · https://www.blackrock.com/corporate/compliance/ishares-terms-and-conditions
- Kenneth French / Faktoren: https://packages.oit.ncsu.edu/cran/web/packages/frenchdata/refman/frenchdata.html · https://business-school.exeter.ac.uk/finance-accounting/research/famafrench/disclaimer/ · https://www.quantconnect.com/docs/v2/writing-algorithms/datasets/quantconnect/fama-french
- ETF-Kosten jenseits der TER: https://www.leinetal24.de/wirtschaft/was-ein-etf-wirklich-kostet-ter-spread-und-versteckte-gebuehren-zr-94430413.html

**Entnahme / Sequenzrisiko**
- https://www.finanzfluss.de/rechner/entnahmeplan/ · https://www.finanz.de/geldanlage/entnahmeplan/ · https://extraetf.com/at/calculator/payout-plan · https://thepoorswiss.com/de/rendite-risiko-abfolge/ · https://www.early-retirement.org/threads/firecalc-cycles-spreadsheets.91986/
