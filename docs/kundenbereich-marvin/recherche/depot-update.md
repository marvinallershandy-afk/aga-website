# Depot- und Vertragswert im Kundenbereich – „Nachrechnung" mit echten Fondskursen

Stand: 08.10.2026 · Recherche für Marvin Allers (Makler §34d und §34f GewO, Abrechnung über blau direkt) · Ergänzt `aga-website/docs/kundenbereich-marvin/research.md` (dort: Wettbewerber, Login, DSGVO-Grundlagen, §§12–18a FinVermV, Rechner-Disclaimer B8). Was dort steht, wiederhole ich hier nicht, sondern verweise darauf.

> **Keine Rechtsberatung.** Die rechtlichen Punkte sind eine Recherche. Vor dem Start mit Fachanwalt (Bank-/Kapitalmarktrecht und Versicherungsrecht), IHK Stade und Datenschutzbeauftragtem klären (Liste in Kapitel 9).

> **Methodik:** WebFetch war für alle relevanten Domains gesperrt (u. a. eodhd.com, twelvedata.com, gesetze-im-internet.de, gesetze.legal, handbook.fca.org.uk, eur-lex.europa.eu). **Alle Belege stammen aus Suchmaschinen-Auszügen** der verlinkten Seiten. Preise und Lizenzbedingungen von Datenanbietern ändern sich oft, und die Auszüge waren teils abgeschnitten. Alles, was du unterschreibst, vorher auf der Live-Seite oder schriftlich beim Anbieter prüfen. Eigene Rechnungen und Einschätzungen sind als solche gekennzeichnet.

---

## Inhaltsverzeichnis

1. [Kurzfazit](#kurzfazit)
2. [Kursdatenquellen](#kursdaten)
   - 2.1 Vergleichstabelle Anbieter
   - 2.2 Lizenzlogik: Börsenkurse, NAV, Indizes
   - 2.3 Total Return und Ausschüttungen
   - 2.4 Empfehlung Datenquelle
3. [Echte Depot- und Vertragsdaten statt Simulation](#echtdaten)
   - 3.1 Depotbanken und Pools
   - 3.2 Open Banking, FinTS, Kontoinformationsdienste
   - 3.3 Fondspolicen: Versicherer, BiPRO, AMEISE
   - 3.4 Bewertung: Was ist realistisch?
4. [Modellierung](#modell)
   - 4.1 Grundprinzip: Anteile statt Euro, Anker statt Startwert
   - 4.2 ETF-Depot
   - 4.3 Fondspolice (Brutto- und Nettotarif)
   - 4.4 Rechenbeispiel: Was Kosten mit dem Vertragswert machen
   - 4.5 Genauigkeit und Kalibrierung
5. [Ehrliche Darstellung der Rentenversicherung](#darstellung)
6. [Recht](#recht)
7. [Vorbilder für Reports und Live-Ansichten](#vorbilder)
8. [Empfehlung und Architektur](#architektur)
9. [Disclaimer-Entwurf](#disclaimer)
10. [Offene Fragen: wer klärt was](#klaeren)
11. [Nicht verifiziert](#nicht-verifiziert)
12. [Quellen](#quellen)

---

<a id="kurzfazit"></a>
## 1. Kurzfazit

1. **Machbar, aber nicht als „Live-Kurs".** Ein Monatswert pro Vertrag, gerechnet aus Anteilen mal Monatsend-Kurs (NAV), reicht für das Ziel und ist lizenz-, kosten- und verhaltensmäßig die bessere Wahl als ein Tageswert.
2. **Datenquelle:** Ein kommerzieller EOD-Anbieter mit **schriftlich bestätigter Erlaubnis, abgeleitete Werte deinen eigenen Kunden anzuzeigen**. Die persönlichen Pläne von EODHD, Twelve Data, Alpha Vantage, Tiingo und Finnhub sind laut Auszügen **nur für private bzw. interne Nutzung**. Favorit wegen der Abdeckung europäischer Investmentfonds per ISIN: **EODHD** (Börsenkürzel „EUFUND"), Angebot für kommerzielle Nutzung erfragen. Zweite Option: **Twelve Data Business „Venture"** (laut abgeschnittenem Auszug 149 $/Monat mit „External display", Fonds-NAV und ISIN-Zugang erst prüfen). Vorher deine echte ISIN-Liste gegen beide testen.
3. **Nicht machen:** onvista, finanzen.net oder boerse-frankfurt.de scrapen (Nutzungsbedingungen beschränken auf private Nutzung), Indexstände von MSCI oder FTSE anzeigen (Lizenz nötig) oder die adjustierten Schlusskurse („adjusted close") als Datenbasis speichern (ändern sich rückwirkend).
4. **Echte Depotdaten** gibt es öffentlich dokumentiert **nicht** für Einzelmakler. Der realistische Weg führt über den Pool. blau direkt hat Investment bisher über Fondsnet abgewickelt und ist seit März 2026 strategisch mit **Netfonds (finfire)** verbunden. Daher schriftlich fragen, ob Depotbestände (Anteile je ISIN und Stichtag) per Export oder API zu haben sind. Open-Banking-Anbieter mit Depotabdeckung gibt es (z. B. wealthAPI, registrierter Kontoinformationsdienst), aber nur mit Kunden-Login, Preis auf Anfrage und schwankender Qualität.
5. **Fondspolicen:** Den Rückkaufswert nicht selbst simulieren. Simuliert wird nur das **Fondsguthaben** aus den echten Kostenparametern deines Tarifs, und das Modell wird jedes Jahr an der **Standmitteilung bzw. Wertmitteilung** neu verankert. Ohne Kostenparameter lieber gar keinen Vertragswert zeigen, nur „Fondsentwicklung" und den belegten Stand.
6. **Darstellung der Rentenversicherung:** Drei Zahlen nebeneinander: (a) was die Fonds gemacht haben, (b) geschätzter Vertragswert, (c) **Kostenwirkung als eigener Balken in Euro**. Nach meiner Beispielrechnung (Bruttotarif, 35 Jahre) macht die Kostenwirkung inklusive entgangener Rendite fast das **Dreifache der direkt abgezogenen Kosten** aus (51.641 € gegenüber 18.044 €). Das gehört ehrlich gezeigt, zusammen mit dem Hinweis auf die Steuerlogik der Police.
7. **Recht:** Werte anzeigen ist Information, keine Finanzportfolioverwaltung, solange du nicht selbst über Käufe und Verkäufe entscheidest. **Keine automatischen Handlungsempfehlungen zu konkreten Fonds im Report** (sonst Anlageberatung mit Exploration, Geeignetheitserklärung und Taping). Und nicht „regelmäßige Geeignetheitsbeurteilung" versprechen, sonst greifen die Berichtspflichten aus §18 Abs. 3 FinVermV bzw. §7c VVG.
8. **Haftung:** Über den Makler- bzw. Auskunftsvertrag haftest du für falsche Angaben, und ein AGB-Haftungsausschluss für den Kern einer Auskunft hält nach OLG München nicht. Schutz bieten deshalb die saubere Kennzeichnung als Schätzung, die getrennte Anzeige belegter Werte, der jährliche Abgleich und die Bestätigung durch die VSH, dass das abgedeckt ist.
9. **Datenschutz:** Der Kursanbieter bekommt nur ISINs, keine Personendaten. Kritisch sind PDF-Dienst und Mail. Mail ohne Beträge, PDF lokal erzeugen oder AVV mit dem PDF-Dienst. Kommentartexte per KI nur ohne Personendaten bzw. über den Anonymizer (CLAUDE.md).
10. **Kosten (grob, eigene Schätzung):** Kursdaten 0–400 $/Monat je nach Lizenzmodell, plus Entwicklungszeit. Echte Depotdaten über den Pool: unbekannt, Anfrage nötig.

---

<a id="kursdaten"></a>
## 2. Kursdatenquellen

### 2.1 Vergleichstabelle Anbieter

Legende Lizenz: **privat** = nur private, nicht kommerzielle Nutzung · **intern** = Nutzung im Unternehmen ohne Anzeige an Dritte · **Display** = Anzeige an Endkunden erlaubt · **?** = nicht belegt.

| Anbieter | Abdeckung relevant für dich | Preis (laut Auszug) | Lizenz für Anzeige an Kunden | Limits | Bewertung |
|---|---|---|---|---|---|
| **EODHD** | XETRA-Kurse, **europäische Investmentfonds per ISIN mit Kürzel `EUFUND`** (z. B. `LU0247994923.EUFUND`), Dividenden- und Split-Endpunkt, Bulk-Abruf je Börse und Tag ([EUFUND-Beispiel](https://eodhd.com/financial-summary/LU0247994923.EUFUND), [GitHub-Issue zu EUFUND-Abruf](https://github.com/we-promise/sure/issues/2204), [eodhdR2-Doku](https://ftp.fau.de/cran/web/packages/eodhdR2/refman/eodhdR2.html)) | EOD All World 19,99 $/Monat, All-In-One 99,99 $/Monat (100.000 Calls/Tag, „personal use only") ([EODHD Pricing](https://eodhd.com/pricing?via=aiva)). Kommerziell: Plan „Startups & Enterprise", individuell ([EODHD](https://eodhd.com/pricing-quantpedia), [apis.io](https://apis.io/plans/eodhd/eodhd-plans-pricing/)); ein Auszug der Seite „commercial-pricing" nannte „Internal use 399 $/Monat" und „Enterprise 2.499 $/Monat" (**widersprüchlich, nicht verifiziert**) | Persönliche Pläne: privat. **Internal-Paket: Anzeige oder Weitergabe an Personen außerhalb des Unternehmens ausdrücklich nicht erlaubt** ([commercial-pricing](https://eodhd.com/commercial-pricing)). Wer Daten Endnutzern anzeigt, braucht laut EODHD eine kommerzielle Lizenz ([ASX-Seite](https://eodhd.com/asx-data)). EODHD meldet kommerzielle Nutzer an Börsen | 100.000 Calls/Tag, 1.000/Min (All-In-One) | **Favorit wegen EUFUND per ISIN.** Kommerzielles Angebot für „Anzeige abgeleiteter Werte an eigene Kunden, ca. N Nutzer" schriftlich anfragen |
| **Twelve Data** | EOD globale Aktien und ETFs ab Grow, **Mutual-Fund-NAV ab Pro** ([twelvedata.com/prime](https://twelvedata.com/prime)). ISIN-Zugang ist laut FAQ ein Add-on „auf Anfrage" ([Support-FAQ](https://support.twelvedata.com/en/collections/3122655-faqs)) | Grow bis 79 $, Pro bis 229 $, Ultra bis 999 $ (Individual). Business „Venture" **149 $/Monat, „External display data, real-time US/EU"** (Tabelle im Auszug abgeschnitten) ([pricing.md](https://twelvedata.com/pricing.md), [März-2026-Update](https://twelvedata.com/news/march-2026-updates)) | Individual-Pläne: „personal, internal, non-commercial". **Business-Lizenz nötig, sobald für ein Unternehmen genutzt, auch ohne externe Anzeige** ([pricing.md](https://twelvedata.com/pricing.md)). Attribution bei öffentlicher Anzeige Pflicht, ggf. börsenspezifisch ([Attribution](https://support.twelvedata.com/en/articles/12647398-attribution-guidelines-for-using-twelve-data)) | 610 Credits/Min (Venture laut Auszug) | **Zweite Option.** Prüfen: Deckt Venture Fonds-NAV und ISIN-Lookup ab? Gilt Display auch für EOD-Fondsdaten? |
| **Alpha Vantage** | v. a. USA | Premium 49,99–249,99 $/Monat (Drittquelle) ([qveris](https://api.qveris.ai/guides/alpha-vantage-pricing-alternative)) | Standard ist „personal, non-commercial". Schon „investment analysis, research, monitoring" über den Privatgebrauch hinaus gilt als kommerziell ([ToS](https://alphavantage.co/terms_of_service)) | nach Plan | **Ungeeignet** (EU-Fonds kaum, Lizenz) |
| **Tiingo** | v. a. USA | kommerziell nur über Sales ([QuantStart](https://www.quantstart.com/articles/evaluating-data-coverage-with-tiingo/)) | Standard „internal, personal use only" | – | Ungeeignet |
| **Finnhub** | ETF/Fonds-Pläne 500–1.000 $/Monat, aber **nur USA und „personal use"**; global auf Anfrage ([finnhub.io](https://www.finnhub.io/pricing-etf-indices)) | s. links | personal use | 300 Calls/Min | Ungeeignet |
| **Marketstack (APILayer)** | XETRA als Börse gelistet, Investmentfonds unklar | 9,99 / 49,99 / 149,99 $/Monat ([Signup](https://marketstack.com/signup)) | „Commercial Use" als Feature genannt, Zuordnung zu Tarifen und Redistribution **nicht belegt** | Requests/Monat | Nur als Notlösung für ETFs, Lizenz schriftlich klären |
| **Polygon.io / Massive** | US-fokussiert ([fintegrationfs](https://www.fintegrationfs.com/fintechapisusa/polygon-stock-api)), Xetra/EU-Fonds nicht belegt | – | – | – | Ungeeignet |
| **OpenFIGI** | Nur Mapping. ISIN als Eingabe möglich, **ISIN wird aber nicht zurückgegeben** (Lizenzgründe) ([OpenFIGI FAQ](https://openfigi.com/about/faq), [Doku](https://www.openfigi.com/api/documentation)) | kostenlos, 25 Req./Min ohne Key, 25 pro 6 Sek. mit Key | FIGI frei nutzbar ([About](https://openfigi.com/about/symbology)) | s. links | Nicht nötig, der Kursanbieter löst die ISIN selbst auf |
| **Deutsche Börse (Xetra, Börse Frankfurt)** | Xetra-Kurse für ETFs | Distribution Licence Xetra Post-Trade **verzögert 702 €/Monat** (Pre-Trade 1.054 €) ([MDDA-Preisliste 13.3](https://www.mds.deutsche-boerse.com/resource/blob/3685372/8638b96ff2177aed6e0c68086565b838/data/MDDA_Price_List_13_3.pdf)). 15-Min-verzögerte Daten kostenlos nach MiFIR Art. 13 ([Delayed data](https://www.mds.deutsche-boerse.com/mds-en/real-time-data/Delayed-data)) | Jede Nutzung braucht MDDA oder Non-Display-Vertrag ([Policy-FAQ](https://www.mds.deutsche-boerse.com/resource/blob/3134034/dac167f9f376e95323f12c42db14e173/data/Market-Data-Policy-Guidelines-and-FAQ_V2_2.pdf)). Regel für reine **Tagesschlusskurse** (EOD) **nicht gefunden** | – | Direktbezug für dich überdimensioniert. Wichtig als Hintergrund: Börsengebühren stecken in Vendor-Preisen |
| **Deutsche Börse Kneip (Fondsdaten)** | 150.000+ EU-ISINs, NAV, AuM, Ausschüttungen, täglich, per sFTP/API ([Produktblatt Kneip Dynamic](https://www.mds.deutsche-boerse.com/resource/blob/4095360/0e807c784d4b7e7b5381be49098b1838/data/Product%20Sheet_Kneip-Dynamic%20Data_V1_290824.pdf)) | auf Anfrage | auf Anfrage | – | Fachlich ideal für NAVs, Preis vermutlich Institutsniveau. Anfrage lohnt einmal |
| **Morningstar** | Fonds-NAV weltweit. Finanzfluss bezieht NAV und Stammdaten laut Fußzeile von Morningstar ([finanzfluss.de](https://www.finanzfluss.de/informer/fonds/ie00b5kn3d77)) | nicht öffentlich. Direct-Desktop ab 18.000 $/Jahr (anderes Produkt) ([fitgap](https://us.fitgap.com/products/morningstar-direct)) | Lizenz je Use Case | – | Für Einzelmakler zu groß |
| **FE fundinfo** | 77.500 Fonds, 215.000 Anteilsklassen, Pricing-Feed ([Data-Feeds-Sheet](https://www.fefundinfo.com/media/54pd2rkd/fe-fundinfo-data-feeds-product-sheet.pdf)) | auf Anfrage | auf Anfrage | – | wie Morningstar |
| **LSEG Lipper** | tägliche NAVs, Ausschüttungen ([Factsheet](https://www.lseg.com/content/dam/data-analytics/en_us/documents/fact-sheets/lseg-lipper-global-data-feed-factsheet.pdf)) | auf Anfrage | Die gefundene Marketing-Lizenz deckt Kundenreports nicht erkennbar ab | – | wie Morningstar |
| **Fondsgesellschaften (NAV-Downloads)** | NAV „aus erster Hand". Hansainvest hat eine eigene Fonds-API ([api.hansainvest.com](https://api.hansainvest.com/docs/v1/endpoints/figures/)) | kostenlos | **iShares (CH-Seite): Download erlaubt, aber keine Vervielfältigung oder Verbreitung, gewerbliche Weiterverwendung ausgeschlossen** ([ishares.com/ch](https://www.ishares.com/ch)). Andere KVGs: einzeln prüfen | manuell | Nur mit schriftlicher Erlaubnis der KVG. Für wenige exotische Fonds aus Policen evtl. pragmatisch |
| **Bundesanzeiger Fondsdata** | KVGs veröffentlichen dort Ausgabe- und Rücknahmepreise gegen Gebühr (300 €/ISIN/Jahr für die KVG) ([Preisliste](https://www.bundesanzeiger.de:/pub/D065Preisliste.pdf), [Howto](https://www.bundesanzeiger.de/pub/en/howto-fondsdata)) | – | **Abruf- und Nutzungsbedingungen für Leser nicht gefunden** | – | Anfrage an fondsdata@bundesanzeiger.de, ob automatisierter Abruf und Nutzung erlaubt sind |
| **onvista / finanzen.net / boerse-frankfurt.de (Scraping)** | breit | – | onvista: Realtime-Kurse laut AGB nur für Privatanleger und private Zwecke, Inhalte von lizenzierten Drittanbietern ([onvista AGB](https://www.onvista.de/agb), [Nutzungsbedingungen](https://www.onvista.de/nutzungsbedingungen)). finanzen.net schließt automatisierte Abfrage ohne Genehmigung aus (nur über Forum zitiert, [ioBroker-Forum](https://forum.iobroker.net/post/926445)). Ein ausdrückliches onvista-Scraping-Verbot war im Auszug **nicht** belegt | – | **Nein.** AGB- und Datenbankrechts-Risiko, keine Lieferzusage, bricht ohne Vorwarnung |
| **WM Datenservice** | ISIN-Register | – | Automatisierte Abfrage untersagt ([wmdatenservice.com](https://wmdatenservice.com/?mid=246)) | – | Nein |

### 2.2 Lizenzlogik: Börsenkurse, NAV, Indizes

- **Börsenkurse (z. B. Xetra-Schlusskurs eines ETF)** sind Daten der Börse. Wer sie weiterverteilt, zahlt bei der Deutschen Börse Distribution-Gebühren, auch für verzögerte Daten ([MDDA-Preisliste](https://www.mds.deutsche-boerse.com/resource/blob/3685372/8638b96ff2177aed6e0c68086565b838/data/MDDA_Price_List_13_3.pdf)). Ein Vendor wie EODHD reicht diese Pflichten weiter und meldet kommerzielle Nutzer an die Börsen ([EODHD](https://eodhd.com/pricing-quantpedia)).
- **NAV (Nettoinventarwert) eines Fonds** berechnet die Kapitalverwaltungsgesellschaft. Sie muss Ausgabe- und Rücknahmepreis sowie NAV bei jeder Ausgabe bzw. Rücknahme veröffentlichen, bei OGAW mindestens zweimal im Monat (§170 KAGB, [lexetius](https://lexetius.com/KAGB/170)). Öffentlich heißt aber nicht frei weiterverwendbar: Die Nutzungsbedingungen der Website (Beispiel iShares) und die Vendor-Verträge gelten trotzdem. *Eigene Ableitung:* Für deine Zwecke ist der **NAV die fachlich richtigere Größe**, weil Fondspolicen und Fondsplattformen zum NAV abrechnen, und er hängt nicht an Börsenlizenzen. Ob ein Vendor NAVs ohne Börsenaufschlag liefert, musst du erfragen.
- **„Abgeleitete Daten" (derived data):** Du zeigst nicht den Kurs, sondern „Dein Depot ist ca. 23.480 € wert". Ob Vendoren das als Display werten, ist **nicht belegt**. Das EODHD-Internal-Paket verbietet jede Anzeige oder Weitergabe an Externe ([commercial-pricing](https://eodhd.com/commercial-pricing)). *Konsequenz:* Genau diesen Use Case im Angebot schriftlich beschreiben lassen.
- **Indexstände (MSCI, FTSE, S&P):** Laut MSCI-Bedingungen ist die Nutzung auf Information und nicht kommerzielle Zwecke beschränkt, Weitergabe nur mit schriftlicher Zustimmung ([MSCI Index Terms](https://www.msci.com/legal/index-terms)). **Konsequenz:** Als Vergleichslinie keinen Index zeigen, sondern einen **konkreten ETF als Benchmark** (dessen Kurs du ohnehin lizenzierst). Das ist ehrlicher, weil darin auch die Kosten stecken. Indexnamen nur als Text, z. B. „ETF auf den MSCI World".

### 2.3 Total Return und Ausschüttungen

- **Thesaurierende Fonds:** Der Kurs bzw. NAV ist bereits Total Return, die TER steckt im Kurs. Kein Extra-Schritt nötig.
- **Ausschüttende Fonds:** Ausschüttungen getrennt speichern (Ex-Tag, Zahltag, Betrag je Anteil). EODHD liefert Dividenden mit Erklärungs-, Stichtags- und Zahltag ([eodhdR2-Doku](https://ftp.fau.de/cran/web/packages/eodhdR2/refman/eodhdR2.html)). Dann zwei Modi:
  - **Depot:** Ausschüttung geht aufs Verrechnungskonto (Standard). Wiederanlage nur, wenn der Kunde das tut (Sparplan, Order).
  - **Fondspolice:** Ausschüttungen werden in der Regel wieder angelegt (Tarifbedingung prüfen).
- **Nicht** den `adjusted_close` speichern: Laut EODHD wird er bei jeder neuen Dividende für die gesamte Historie neu berechnet, also ändert sich ein Wert von 2024 nachträglich ([EODHD-Seite](https://eodhd.com/financial-apis/review-copy-end-of-day-historical-data-api), [Forum](https://forum.eodhd.com/t/adjusted-close-versus-close/507)). Für einen nachvollziehbaren, archivierten Monatsbericht brauchst du **Rohkurs plus Ausschüttungsreihe**. Rechne die Wiederanlage selbst.

### 2.4 Empfehlung Datenquelle

1. **Schritt 1 (1 Stunde):** ISIN-Liste aller Fonds aus deinen Depots und Policen exportieren. Mit EODHD-Free (20 Calls/Tag) und Twelve Data Basic testen, wie viele ISINs als `ISIN.EUFUND` bzw. per Symbolsuche auffindbar sind und ob die Historie bis zum ältesten Vertragsstart reicht.
2. **Schritt 2:** Bei beiden schriftlich anfragen (Textbaustein in Kapitel 10): Monats-NAV bzw. EOD für ca. 50–150 ISINs, **Anzeige nur abgeleiteter, personalisierter Werte an eigene Kunden in einem geschlossenen Login-Bereich und in PDFs**, keine Kursliste, keine Charts der Rohkurse, ca. N Endnutzer.
3. **Schritt 3:** Den Anbieter mit der besten ISIN-Abdeckung und einer klaren schriftlichen Display-Freigabe nehmen. Fehlende Exoten (oft Fonds in alten Policen) mit schriftlicher Erlaubnis der KVG manuell nachpflegen oder nur mit belegten Ankerwerten zeigen.
4. **Takt:** monatlich (Monatsultimo plus Ausschüttungen). Volumen: 150 ISINs mal 1 Abruf im Monat. Rate-Limits sind damit kein Thema.

**Kostenrahmen (eigene Schätzung):** Wenn Twelve Data Venture die Fonds abdeckt, rund 150 $/Monat. Bei EODHD kommerziell vermutlich 399 $ aufwärts (Auszug, widersprüchlich). Institutionelle Feeds (Kneip, Morningstar, FE, LSEG) wohl deutlich darüber, Preis nur auf Anfrage.

---

<a id="echtdaten"></a>
## 3. Echte Depot- und Vertragsdaten statt Simulation

### 3.1 Depotbanken und Pools

| Weg | Befund | Quelle | Einschätzung |
|---|---|---|---|
| **ebase (FNZ)** | Mandantenfähige Depotführung für Vertriebe. Vermittler bündeln über Vermittlerzentralen. Account Management für Vermittler. **Keine öffentliche Doku zu täglichen Bestandsdateien gefunden.** Kunden-CSV-Exporte existieren, ihr Format hat sich geändert | [ebase-Broschüre](https://www.vermittlerportal.de/trust/kunden-broschuere-ebase-trust190.pdf), [Portfolio-Performance-Forum](https://forum.portfolio-performance.info/t/csv-import-von-ebase/172?page=2) | Bestandsdaten fließen in der Praxis an Pools bzw. Vermittlerzentralen, nicht an Einzelmakler (**Ableitung, nicht belegt**) |
| **FIL Fondsbank (FFB)** | Liefert Fondsdaten an BCA (DIVA), elektronische Order- und Antragsschnittstelle u. a. für Fondskonzept. Bestandsdatenlieferung an Vermittler **nicht belegt** | [BCA-Präsentation](https://www.bca.de/wp-content/uploads/2022/07/FFB.pdf), [Cash](https://www.cash-online.de/a/fondskonzept-ffb-digitale-depoteroffnung-253612/) | wie ebase |
| **Fondsdepot Bank** | Online-Portal für Kunden mit Bestand und elektronischem Postfach. Beraterportal-Lösung für Allianz GI | [Fondsdepot Bank](https://fondsdepotbank.de/en/products-and-services/online-portal), [Beraterportal](https://fondsdepotbank.de/en/company/news-and-dates/effizientere-vorbereitung-auf-die-fondsberatung-dank-neuem-beraterportal-allianz-global-investors-nutzt-portalloesung-des-langjaehrigen-partners-fondsdepot-bank) | Kundenzugang ja, Datenexport an dich unklar |
| **DAB BNP Paribas, Augsburger Aktienbank, Metzler, comdirect/Consors B2B, Baader, MorgenFund** | Nicht spezifisch gefunden. Ginmon nutzt DAB und Upvest als Depotbanken | [Ginmon Hilfe](https://help.ginmon.de/de-de/articles/62-welche-depotbanken-nutzt-ginmon) | Direkt bei den B2B-Abteilungen bzw. über den Pool anfragen |
| **blau direkt** | 2020: Kooperation mit Fondsnet. Kunden sollen Depots über die Makler-Apps einsehen, laut CIO „bald" auch Investmentbestände in simplr. Ob live: **unbekannt**. Bisher lief die Investmentabwicklung über Fondsnet | [Cash 2020](https://www.cash-online.de/a/fondsnet-und-blau-direkt-kooperieren-ein-knall-der-den-markt-durcheinanderwirbelt-553006/), [fundresearch](https://www.fundresearch.de/maklerpool/blaudirekt-und-fondsnet-kooperieren.php), [Cash Interview](https://www.cash-online.de/a/maklerpools-alter-praegung-werden-aussterben-559727/) | **Erste Anlaufstelle** |
| **Netfonds / finfire** | Seit März 2026 strategische Allianz mit blau direkt unter Warburg Pincus. Netfonds bringt Investment, Regulatorik und **finfire** ein, blau-direkt-Partner sollen von der Investmentkompetenz profitieren. Angebotsfrist bis 20.04.2026, danach Delisting. finfire-Mandantenportal zeigt Depots, Konten und Versicherungen (siehe research.md A2) | [blau direkt PM](https://www.blaudirekt.de/pressemitteilung/netfonds-ag-schliesst-investment-agreement-mit-warburg-pincus-und-formt-strategische-allianz-mit-blau-direkt-in-gemeinsamer-privater-eigentuemerstruktur/), [Cash](https://www.cash-online.de/a/netfonds-und-blau-direkt-wie-die-zusammenarbeit-der-plattformen-aussehen-soll-713520/), [AssCompact](https://www.asscompact.de/nachrichten/blau-direkt-und-netfonds-die-hintergruende-zum-zusammenschluss) | **Strategisch der aussichtsreichste Weg** zu echten Depotdaten. Stand der Integration unbekannt |
| **Fonds Finanz, JDC** | Kunden-Apps vorhanden (research.md A2). Depotdaten-Export für Makler nicht gefunden | – | Nur relevant, wenn du Investment dort abwickelst |
| **Scalable, Trade Republic** | Kein Vermittler-Zugang. Autosync gibt es nur über Tracker (Parqet) bzw. Aggregatoren (wealthAPI) | [Parqet-Erfahrungsbericht](https://liebefinanzen.ch/?p=41173), [wealthAPI](https://wealthapi.eu/en/wealthapi-data/) | Nur über Open-Banking-Weg mit Kunden-Login |

### 3.2 Open Banking, FinTS, Kontoinformationsdienste

- **PSD2 deckt Depots nicht ab.** Zahlungskonto heißt „dient der Ausführung von Zahlungsvorgängen" ([Art. 4 PSD2](https://gesetze.legal/eu/rl_2015_2366_eu/4)). finAPI schreibt: Über XS2A kommen in der Regel nur Zahlungskonten, für andere Kontoarten nutzt man FinTS oder Web-Scraping ([finAPI-Doku](https://documentation.finapi.io/access/interfaces), [finAPI Access](https://www.finapi.io/en/products/open-banking/banking-api/)). Mastercard Open Finance nennt Wertpapierkonten als Kontoart ohne Zugangspflicht ([Mastercard](https://www.mastercard.com/de/de/business/open-finance/help-articles/loan-accounts-and-supported-account-types.html)).
- **FinTS:** Einige Banken liefern Depotbestände, z. B. ING für das Direkt-Depot ([ING FinTS-Hilfe](https://www.ing.de/hilfe/log-in/fints/)). Für FinTS-Software ist eine Produktregistrierung bei der Deutschen Kreditwirtschaft nötig ([python-fints](https://python-fints.readthedocs.io/)). Jede Bank setzt es anders um. Ein selbst gebauter FinTS-Abruf mit Kunden-PIN kommt für dich **nicht infrage** (Sicherheit, Haftung, Pflege).
- **Qualität:** Bei Deutsche-Bank-Depots über finAPI fehlen laut einem Wiki ISIN/WKN in Umsätzen ([wealthAPI-Wiki](https://wealthapi.atlassian.net/wiki/spaces/PD/pages/427753474)). Abrufe brechen ab (Consors, [DATEV-Community](https://www.datev-community.de/t5/Unternehmen-online/Bankabruf-von-Consors-nicht-mehr-m%C3%B6glich/td-p/507673)). Finanzfluss Copilot hat laut research.md Probleme mit unvollständigen oder doppelten Importen.
- **Anbieter mit Depotabdeckung:**

| Anbieter | Depot? | Regulierung | Preis | Quelle |
|---|---|---|---|---|
| **wealthAPI** | ja: „Echtzeit-Positionen aus jedem Depot", 3.500+ Bankverbindungen, direkte Schnittstellen u. a. comdirect, Trade Republic, Scalable, Quirion, Whitebox | **bei der BaFin als Kontoinformationsdienst registriert**, FMA-Zulassung | modular, auf Anfrage | [wealthAPI Data](https://wealthapi.eu/en/wealthapi-data/), [Pricing](https://wealthapi.eu/en/pricing/) |
| **Qwist** (ex finleap connect) | „unregulierter Zugang zu Nicht-Zahlungskonten, z. B. Wertpapierkonten" | ZAG-Zahlungsinstitut | auf Anfrage | [Qwist FAQ](https://connect.finleap.com/faq/), [G2](https://www.g2.com/products/ndgit/pricing) |
| **finAPI** | Wertpapierkonten über FinTS bzw. Scraping | lizenzierter Dienst (aus research.md) | auf Anfrage | [finAPI](https://www.finapi.io/en/products/open-banking/banking-api/) |
| **Tink, Klarna Kosma** | Depots **nicht belegt** (PSD2-Fokus) | – | – | [openbankingtracker](https://openbankingtracker.com/embedded-finance/klarna-kosma) |

- **Rechtsrahmen:** Ein Kontoinformationsdienst braucht eine BaFin-Registrierung statt einer Erlaubnis und darf nur mit ausdrücklicher Zustimmung auf benannte Zahlungskonten zugreifen ([ZAG §§34, 51](https://lexmea.de/de/gesetz/zag/51)). *Eigene Ableitung (nicht durch BaFin belegt):* Ein reines Depot ist kein Zahlungskonto. Das zugehörige Verrechnungskonto ist es wahrscheinlich doch. **Du selbst wirst dadurch nicht zum KID**, wenn ein registrierter Anbieter die Verbindung hält und dir nur Positionen liefert. Klären, ob der Anbieter dabei eigener Verantwortlicher oder dein Auftragsverarbeiter ist.
- **FiDA (EU-Open-Finance, würde Depots erfassen):** Laut WKO gibt es mit Stand 10.09.2026 keinen Termin für weitere Trilogsitzungen, die Fortführung ist ungewiss ([WKO](https://www.wko.at/information-consulting/finanzdienstleister/fida-financial-data-access)). Darauf also nicht bauen.

### 3.3 Fondspolicen: Versicherer, BiPRO, AMEISE

- **Versicherer-Portale mit Fondswerten gibt es:** Canada Life zeigt Vermittlern tagesaktuell den Wert pro Fonds und den Rückkaufswert ([Versicherungsbote](https://www.versicherungsbote.de/id/81666/canada-life-service-partner-vertrag-online-makler-versicherung-fonds/)). Die Barmenia-App zeigt Kunden aktuelle Werte und Verläufe der Fondsrente ([Cash](https://www.cash-online.de/a/schlank-und-digital-barmenia-lanciert-fondspolicen-verwaltung-via-app-646324)). Ergo hatte ein tagesaktuelles Fondsinformationscenter ([Cash](https://www.cash-online.de/a/fondspolicen-ergo-informiert-tagesaktuell-ueber-performance-17259/)). R+V verschickt eine jährliche Wertmitteilung ([R+V](https://www.ruv.de/service/wertmitteilung)). Die Quellen sind teils alt.
- **BiPRO:** Norm 430.4 überträgt Vertragsdaten und Dokumente automatisiert ins MVP ([it-finanzmagazin](https://www.it-finanzmagazin.de/?p=141911)), Gothaer liefert tagesaktuell Daten zu geänderten Verträgen ([Gothaer PM](https://barmenia.mynewsdesk.com/pressreleases/meilenstein-fur-makler-im-datenaustausch-gothaer-bietet-bipro-schnittstelle-3135109.pdf)). **Ob Fondsguthaben bzw. Anteile je Fonds mitkommen, war nicht belegbar.** Viele Gesellschaften nutzen die Norm 430 nicht voll ([inveda.net](https://www.inveda.net/id/4870780/Invedanet-stellt-Daten-der-Invers-GmbH-per-BiPro-Schnittstelle-zur-Verfugung)).
- **AMEISE/dailyUP:** Die Feldliste ist nicht öffentlich (research.md Abschnitt 5). Konkret bei blau direkt fragen, ob es Felder für Fondsguthaben, Anteile je ISIN, Stichtag und Rückkaufswert gibt, und ob die Standmitteilungen als Dokumente im Postkorb landen. Selbst wenn nur das PDF kommt, ist das schon dein jährlicher Anker.

### 3.4 Bewertung: Was ist realistisch?

| Weg | Genauigkeit | Aufwand für dich | Kosten | Realistisch? |
|---|---|---|---|---|
| Simulation ohne Anker | mittel bis schlecht (Policen) | gering | Kursdaten | nur für ETF-Depots mit bekannten Transaktionen |
| **Simulation + jährlicher Anker aus Dokument** | gut | ca. 5 Min. je Vertrag und Jahr | Kursdaten | **ja, Startlösung** |
| Bestandsdaten über Pool (Fondsnet/Netfonds) | sehr gut | Integration einmalig | unbekannt | **prüfen, mittelfristig** |
| Open Banking (wealthAPI u. a.) | gut bis schwankend | Kunde muss Bank-Login hinterlegen | auf Anfrage | nur für Kunden mit Neobroker-Depots, die das wollen |
| Versicherer-Portale manuell abfragen | sehr gut | hoch | – | nur für den Jahresanker |
| BiPRO/AMEISE automatisch | unbekannt | – | Enterprise 998 €/Monat (research.md) | erst nach Antwort von blau direkt |

---

<a id="modell"></a>
## 4. Modellierung

### 4.1 Grundprinzip: Anteile statt Euro, Anker statt Startwert

*Eigene Fachempfehlung:*
- Rechne immer in **Fondsanteilen je ISIN**. Wert = Anteile × Kurs am Stichtag. Jede Zahlung kauft Anteile zum Kurs ihres Ausführungstags, jede Kostenentnahme verkauft Anteile.
- **Anker:** Sobald ein belegter Stand vorliegt (Depotauszug, Jahresdepotauszug, Standmitteilung mit Anteilen je Fonds), setzt das Modell die Anteile auf diesen Stand und rechnet **nur ab dem Anker** weiter. Ohne Anker rechnet es ab Vertragsbeginn. So wächst der Fehler nie über ein Jahr hinaus.
- **Versionierung:** Jede Berechnung speichert Modellversion, Kursdatenstand und Parameter. Dann lässt sich jeder Monatsbericht später exakt reproduzieren (Haftung, Aufbewahrung).

### 4.2 ETF-Depot

| Baustein | Empfehlung | Begründung/Quelle |
|---|---|---|
| Sparplan-Ausführung | Ausführungstag je Depotbank (z. B. 1. oder 15., nächster Handelstag), Kurs = Schlusskurs bzw. NAV dieses Tages, Bruchstücke erlaubt | eigene Empfehlung |
| Ordergebühren | Parameter je Depot (oft 0 € bei Sparplänen, sonst fix/prozentual) | eigene Empfehlung |
| TER | **nicht** abziehen, steckt im NAV | Standard |
| Depotgebühr, Servicegebühr | Parameter, quartalsweise Anteile verkaufen bzw. vom Verrechnungskonto | eigene Empfehlung |
| Ausschüttungen | aufs Verrechnungskonto, Wiederanlage nur, wenn dokumentiert | 2.3 |
| Vorabpauschale/Steuern | **nicht modellieren**, aber im Januar einen Hinweis zeigen: Basiszins 2026 **3,20 %** (2025: 2,53 %). Die Vorabpauschale 2026 gilt am 04.01.2027 als zugeflossen ([otto-schmidt](https://www.otto-schmidt.de/news/steuerrecht/basiszins-zur-berechnung-der-vorabpauschale-gem-18-absatz-4-invstg-basiszins-zum-2-1-2026-2026-01-15.html), [etf.capital](https://etf.capital/vorabpauschale-2026-rechner/)) | Steuern hängen von Freistellungsauftrag, Verlusttopf und Kirchensteuer ab, das erzeugt Scheingenauigkeit |
| Rebalancing, Umschichtungen | nur echte, von dir erfasste Transaktionen. **Kein simuliertes Rebalancing** | sonst zeigst du ein Portfolio, das der Kunde nicht hat |
| Währung | EUR-Linie (Xetra bzw. EUR-NAV) | – |
| Rendite-Kennzahl | **zeitgewichtet (TWR/TTWROR) für „Wie gut lief das Portfolio"** und **geldgewichtet (IZF) für „Was hat dein Geld verdient"**. Betterment und Parqet zeigen beides | [Betterment TWR](https://betterment.com/help/time-weighted-returns), [Betterment MWR](https://betterment.com/help/money-weighted-returns), [Parqet TTWROR](https://parqet.com/en/blog/true-time-weighted-rate-of-return) |

### 4.3 Fondspolice (Brutto- und Nettotarif)

**Begriffe (wichtig für die Darstellung):**
- **Fondsguthaben** = Anteile × Kurs am Bewertungsstichtag ([Vertragsgrundlagen FLV](https://eu-assets.contentstack.com/v3/assets/bltcba55c71291ad2c3/blt0f2bd990630cc95d/691446423bfeff3ecd0883eb/Vertragsgrundlagen_FLV.pdf)).
- **Rückkaufswert** = Leistung bei Kündigung. Bei Fondspolicen nach dem Zeitwert (§169 Abs. 4 VVG), abzüglich eines vereinbarten, angemessenen Stornoabzugs (§169 Abs. 5 VVG) ([Finanztip](https://www.finanztip.de/lebensversicherung/lebensversicherung-rueckkaufswert/)). Für Kündigungen gilt eine Untergrenze: Abschluss- und Vertriebskosten werden gleichmäßig auf die ersten **fünf Jahre** verteilt (§169 Abs. 3 VVG, [lexmea](https://lexmea.de/de/gesetz/vvg/169)). Höchstzillmersatz **25 ‰ der Beitragssumme** (§4 DeckRV, laut BGH-Bezug in [Deloitte](https://www.deloitte.com/de/de/services/financial-advisory/analysis/Fruehstorno-und-Mindestrueckkaufswert.html)). Ein Abzug für noch nicht getilgte Abschlusskosten ist unwirksam (§169 Abs. 5 S. 2 VVG, BGH IV ZR 295/13, [IWW](https://www.iww.de/wvm/vertriebspraxis/versicherungsrecht-unkuendbare-kostenausgleichsvereinbarung-bei-fondsgebundenen-nettopolicen-unzulaessig-f74814)).
- **Standmitteilung (§155 VVG):** Pflicht ist sie bei Verträgen **mit Überschussbeteiligung**. Inhalt: Leistung, Auszahlungsbetrag bei Kündigung (Rückkaufswert), bei Verträgen ab 01.07.2018 die Summe der gezahlten Beiträge ([lexetius §155](https://lexetius.com/VVG/155)). Ob und wie die Pflicht für reine Fondspolicen gilt, ist **ungeklärt**. In der Praxis verschicken Versicherer jährliche Wertmitteilungen. Zwei Drittel lieferten 2018 nur einen unvollständigen Überblick ([experten.de Transparenzanalyse](https://www.experten.de/id/4945734/transparenzanalyse-der-deutschen-lebensversicherer/index.pdf)).

**Modell für das Fondsguthaben (eigene Fachempfehlung, Parameter aus deinem Tarif):**

```
je Monat:
  Beitrag B
  − beitragsbezogene Kosten:  a% × B                (Verwaltung)
  − Abschlusskosten (nur Bruttotarif, gezillmert/verteilt):  AK_gesamt / 60  in Monat 1–60
  − Stückkosten:  k € / 12
  = Sparanteil  → kauft Anteile je ISIN gemäß Aufteilung, zum NAV des Anlagetags des Versicherers
  − guthabenbezogene Kosten:  g% p. a. / 12 × Fondsguthaben  → verkauft Anteile
  − Risikobeitrag Todesfallschutz (falls relevant, meist klein)  → Parameter oder ignorieren + Hinweis
  + Gutschrift Kickback/Überschuss (falls Tarif Rückvergütungen weitergibt)  → Parameter
```

- **Parameterquellen:** Kosteninformation und Basisinformationsblatt, Versicherungsbedingungen bzw. „Kostenausweis". Beispiel Nettotarif Münchener Verein PrivatInvest Netto (Höchstsätze): **keine Abschlusskosten, max. 4 % der laufenden Beiträge, 1,5 % auf Einmalbeiträge und Zuzahlungen, 0,2 % des Vertragsguthabens, keine Stückkosten** ([AVB via Finanzfluss](https://assets.finanzfluss.de/wp/2025/07/munchener-verein-privatinvest-avb.pdf)). Beispiel aus Österreich (Bruttotarif): Abschlusskosten max. 5 % der Nettobeitragssumme, Verwaltung 0,26 % der Beitragssumme p. a. plus 1,50 € pro Monat, monatlich dem Fondsguthaben entnommen ([ÖBV-Tarif](https://www.oebv.com/fileadmin/oebv/8_versicherungsbedingungen/tarifbezogene_versicherungsbedingungen/tfonl-m_fondsvorsorge.pdf)).
- **Rückvergütungen:** Laut BaFin bekommen Lebensversicherer bei etwa einem Drittel des Neugeschäfts Geld von Fondsgesellschaften, im Mittel knapp über **0,30 % des Fondsguthabens p. a.**, in der Spitze über 1,20 %. Im Mittel werden 52 % an die Kunden weitergegeben, nur bei etwa einem Viertel der Produkte alles ([Versicherungsbote](https://www.versicherungsbote.de/id/4905334/chapter/1/Lebensversicherung-BaFin-kritisiert-teils-zu-hohe-Effektivkosten/)). Das ist ein Grund, warum NAV-Simulation und Versicherer-Wert auseinanderlaufen.
- **Nicht simulieren:**
  - **Rückkaufswert** (Stornoabzug, Mindestwerte, Tarifdetails). Nur den belegten Wert aus der Standmitteilung zeigen, mit Datum.
  - **Garantie- und Wertsicherungsmodelle** (Umschichtung ins Sicherungsvermögen, i-Modelle, Hybride). Hier nur belegte Werte und die Fondsentwicklung zeigen.
  - **Nettotarif mit Kostenausgleichsvereinbarung oder Honorar:** Die Vergütung steckt nicht im Vertragswert. Für eine ehrliche Kostendarstellung **musst du sie als eigene Kostenzeile mitzählen** (eigene Empfehlung; zur Zulässigkeit von Makler-Honoraren bei Verbrauchern siehe die strittige Lage in [Cash](https://www.cash-online.de/a/idd-honorarvereinbarung-makler-351287/2/) und [Versicherungsbote](https://www.versicherungsbote.de/id/4862876/Honorarberatung-Versicherungsmakler-IDD/)).

### 4.4 Rechenbeispiel: Was Kosten mit dem Vertragswert machen

*Eigene Beispielrechnung, nur zur Illustration, keine echten Tarife.* 200 € im Monat, 35 Jahre, Fondsrendite konstant 6 % p. a. nach TER, ohne Steuern.
- **ETF-Depot:** Sparplan ohne Gebühren.
- **Nettotarif:** 4 % vom Beitrag, 0,2 % p. a. vom Guthaben (Höchstsätze aus dem Münchener-Verein-Beispiel).
- **Bruttotarif (typisierte Annahme):** Abschlusskosten 2,5 % der Beitragssumme (Höchstzillmersatz), verteilt auf 60 Monate, 5 % vom Beitrag, 0,4 % p. a. vom Guthaben, 24 € Stückkosten im Jahr.

| nach | eingezahlt | ETF-Depot | Nettotarif | Bruttotarif | Brutto: direkt abgezogene Kosten | Brutto: Kostenwirkung ggü. Depot (inkl. entgangener Rendite) |
|---|---|---|---|---|---|---|
| 1 Jahr | 2.400 € | 2.477 € | 2.376 € | 1.891 € | 568 € | 586 € |
| 5 Jahre | 12.000 € | 13.965 € | 13.335 € | 10.570 € | 2.923 € | 3.395 € |
| 10 Jahre | 24.000 € | 32.653 € | 31.003 € | 26.853 € | 4.012 € | 5.800 € |
| 20 Jahre | 48.000 € | 91.129 € | 85.425 € | 76.228 € | 7.434 € | 14.901 € |
| 35 Jahre | 84.000 € | 276.058 € | 253.085 € | 224.417 € | 18.044 € | 51.641 € |

**Lehren für die Darstellung:**
1. In den ersten fünf Jahren liegt der Bruttotarif selbst bei guter Börse oft **unter den Einzahlungen**. Ohne Erklärung wirkt das wie ein Verlust der Fonds, ist aber die Zillmerung. Genau das ist Marvins „sieht schlechter aus"-Problem.
2. **Direkt abgezogene Kosten unterschätzen die Wirkung.** Über 35 Jahre fehlen im Beispiel 51.641 €, abgezogen wurden aber nur 18.044 €. Der Rest ist Zinseszins auf die Kosten. Ehrlich ist es, beides zu zeigen.
3. Der **Nettotarif** liegt nah am Depot (−8 % nach 35 Jahren im Beispiel). Ohne Steuern gerechnet ist das eine unfaire Grundlage, weil die Police bei der Auszahlung steuerlich anders behandelt wird und keine Vorabpauschale anfällt ([etf.capital](https://etf.capital/etf-fondspolice-vorteile-von-etfs-fur-private-anleger/), kommerzielle Quelle). Deshalb im Monatsbericht **keinen Depot-Vergleich als Standard**, sondern nur im Jahresgespräch mit Steuerhinweis (Kapitel 5).

### 4.5 Genauigkeit und Kalibrierung

**Warum Simulation und Realität abweichen (Ursachen, eigene Liste):** Ausführungstag und Kurs (Versicherer kaufen oft zu einem festen Stichtag nach Beitragseingang), Rundung der Anteile, Kostenparameter falsch oder unvollständig, Rückvergütungen bzw. Sonderüberschüsse, Risikobeiträge, Fondswechsel oder Ablaufmanagement, das du nicht kennst, ausgefallene oder geänderte Beiträge, Dynamik, Zuzahlungen und Entnahmen, sowie Anteilsklassen-Unterschiede (Versicherer nutzt eine andere Klasse als die ISIN, die du kennst).

**Erwartbare Abweichung (eigene Einschätzung, nicht verifiziert, bitte an echten Fällen messen):**
- ETF-Depot mit vollständig erfassten Transaktionen: unter 1 %.
- Fondspolice mit vollständigen Kostenparametern und Jahresanker: wenige Prozent innerhalb des Jahres.
- Fondspolice ohne Kostenparameter, Rechnung ab Beginn: in den ersten Jahren leicht 10 % und mehr. **Dann keinen Vertragswert zeigen.**

**Kalibrierung (empfohlener Ablauf):**
1. Kunde lädt den Jahresdepotauszug bzw. die Wertmitteilung im Portal hoch, oder du holst sie aus dem Versicherer-Portal bzw. dem Pool-Postkorb.
2. Du erfasst im Cockpit 3–10 Zahlen: Stichtag, Anteile je ISIN (oder Fondsguthaben je Fonds), Rückkaufswert, Summe gezahlter Beiträge. **Keine KI-Extraktion des PDFs ohne Anonymizer** (das Dokument enthält Name und Vertragsnummer, CLAUDE.md-Regel). Lokal parsen oder manuell eintragen.
3. Das System vergleicht den Simulationswert am Stichtag mit dem belegten Wert und speichert den Fehler (`abweichung_pct`). Ab einer Schwelle (Vorschlag: 3 % bei Depots, 5 % bei Policen) markiert es den Vertrag zur Prüfung. Typische Ursache: falscher Kostenparameter.
4. Ab dem Anker rechnet es mit den belegten Anteilen weiter.
5. Kennzahl im Admin-Bereich: mittlere und maximale Abweichung je Produktgruppe. Nach dem ersten Jahr kennst du deine echte Modellgüte und kannst sie im Disclaimer konkret benennen.

---

<a id="darstellung"></a>
## 5. Ehrliche Darstellung der Rentenversicherung

**Empfehlung (passt zu „kostentransparent" und „weniger Bullshit"):**

```
Fondsrente bei [Versicherer] · Stand: geschätzt zum 30.09.2026 · zuletzt belegt: 31.12.2025

  Eingezahlt bisher                       12.000 €
  Geschätzter Vertragswert (Fondsguthaben) 10.570 €   ← Schätzung
  Belegter Rückkaufswert (31.12.2025)       9.140 €   ← aus Wertmitteilung

  So setzt sich das zusammen
  ████████████████████  Eingezahlt                     12.000 €
  ███████               Wertentwicklung der Fonds      + 1.493 €
  ██████                Kosten des Vertrags bisher     − 2.923 €
                        = geschätzter Vertragswert     10.570 €

  Die Fonds selbst: +6,0 % pro Jahr (zeitgewichtet)
  Warum der Vertrag trotzdem unter den Einzahlungen liegt: In den ersten fünf Jahren
  werden die Abschlusskosten verteilt abgezogen (gesetzlich so geregelt). Das ist
  eingeplant und ab Jahr 6 vorbei. [Mehr dazu]
```

*Die Zahlen stammen aus dem Rechenbeispiel in 4.4, Jahr 5. Der „belegte Rückkaufswert" ist ein erfundener Platzhalter.*

**Regeln:**
1. **Drei Ebenen getrennt zeigen:** Fondsentwicklung (Leistung der Fonds), Vertragswert (was dem Kunden gehört), Kosten (was der Vertrag kostet). Nie nur die Fondsrendite zeigen, das wäre bei einer Police beschönigend (UWG, Kapitel 6).
2. **Kosten in Euro als eigener Balken,** auf Wunsch zusätzlich „Kostenwirkung inkl. entgangener Rendite". Das deckt sich mit dem Kosten-Cockpit (research.md, Top-Idee 1) und mit der Pflicht, die kumulative Wirkung der Kosten auf die Rendite verständlich zu machen (§7b Abs. 2 VVG, [lexetius](https://lexetius.com/VVG/7b)).
3. **Erklären statt verstecken:** Ein fester Erklärtext je Phase (Zillmerungsphase in Jahr 1–5, danach laufende Kosten). Bei Verträgen, die du selbst vermittelt hast, ehrlich sagen, warum die Police trotz Kosten gewählt wurde (Verweis auf die „Warum"-Karte: Steuerlogik bei Auszahlung, Rentenfaktor, Hinterbliebenenschutz, Schutz vor Pfändung usw., **je nach Fall**).
4. **Vergleich mit einem Depot:** nicht im Monatsbericht, aber auf Wunsch im Jahresgespräch, dann **mit Steuern beider Varianten** und gleichen Annahmen. Vergleiche müssen fair sein (Art. 44 DelVO 2017/565 regelt auch Vergleiche, laut FCA-Querverweis, [COBS 4.5A](https://www.handbook.fca.org.uk/handbook/COBS/4/5A.html), Wortlaut nicht abgerufen).
5. **Fremdverträge** (nicht von dir vermittelt): Hier ist die Kostenwirkung dein bestes Argument im Jahresgespräch. Trotzdem neutral formulieren, keine automatische „Kündige jetzt"-Botschaft (das wäre eine Empfehlung).
6. **Nettotarif mit separater Vergütung:** die Vergütung als Kostenzeile mitzählen, sonst sieht der Nettotarif besser aus, als er ist.

---

<a id="recht"></a>
## 6. Recht

| Frage | Befund | Folge für das Feature | Quelle |
|---|---|---|---|
| **Ist das Finanzportfolioverwaltung?** | Finanzportfolioverwaltung = Verwaltung einzelner Vermögen für andere **mit Entscheidungsspielraum** (§1 Abs. 1a S. 2 Nr. 3 KWG, BGH VI ZR 303/09). Bloße Information ist keine Anlageberatung | Werte anzeigen ist erlaubt. **Keine Vollmacht, kein eigenständiges Umschichten.** | [Betriebs-Berater](https://betriebs-berater.ruw.de/wirtschaftsrecht/nachrichten/Voraussetzungen-einer-erlaubnispflichtigen-gewerbsmaessigen-Finanzportfolioverwaltung-9151), [rechtslupe](https://www.rechtslupe.de/wirtschaftsrecht/kapitalanlagerecht/gewerbsmaessige-finanzportfolioverwaltung-324593), [otto-schmidt zu VI ZR 556/14](https://www.otto-schmidt.de/news/wirtschaftsrecht/empfehlung-einer-finanzportfolioverwaltung-ist-weder-anlageberatung-noch-anlagevermittlung-2017-11-30.html) |
| **Wird der Report zur Anlageberatung?** | Anlageberatung = persönliche Empfehlung zu bestimmten Finanzinstrumenten (research.md B8) | Report ohne „Kauf/Verkauf X". Rebalancing-Bedarf nur als Information („Aktienanteil 78 % statt 70 %") mit dem Angebot „Lass uns drüber sprechen". Die Empfehlung erfolgt dann im Termin mit §16-Exploration, §18-Geeignetheitserklärung und §18a-Taping | research.md B7/B8 |
| **Laufende Geeignetheitsbeurteilung?** | **Nicht §16 Abs. 3a FinVermV** (der betrifft die Selbstauskunft bei Vermögensanlagen), sondern **§18 Abs. 3 FinVermV**: Wer eine regelmäßige Beurteilung der Geeignetheit **anbietet**, muss regelmäßige Geeignetheitsberichte liefern. Für Versicherungsanlageprodukte: **§7c VVG**, der regelmäßige Bericht braucht dann eine aktualisierte Erklärung zur Eignung. Vorab muss informiert werden, ob das angeboten wird (§7b VVG) | Den Monatsbericht **nicht** als „laufende Prüfung" bewerben. Formulierung: „Monatsupdate zur Information. Ob alles noch zu dir passt, prüfen wir im Jahresgespräch." Wenn du die laufende Prüfung bewusst anbietest: Berichtsinhalt erweitern (eigenes Projekt) | [lxgesetze §16](https://lxgesetze.de/finvermv/16), [IHK Magdeburg](https://www.ihk.de/magdeburg/recht/finanzdienstleistungen-und-versicherungswirtschaft/recht-finanzdienstleister/neuigkeiten/aenderungen-der-finvermv-4800680), [lxgesetze §7c VVG](https://lxgesetze.de/vvg/7c), [lexetius §7b](https://lexetius.com/VVG/7b) |
| **Kosteninfo ex post** | §13 Abs. 5 FinVermV: regelmäßig, mindestens jährlich (Soll-Vorschrift, wenn Art. 50 Abs. 9 DelVO greift). Gilt als erfüllt, wenn KVG, Emittent oder Depotbank sie liefern (research.md B7). Für Versicherungsanlageprodukte §7b Abs. 2 VVG: Kosten zusammengefasst mit kumulativer Wirkung, **während der Laufzeit regelmäßig, mindestens jährlich** | Der Monatsbericht kann die Pflichtinfo nicht ersetzen, wenn er geschätzte Werte nutzt. Ex-post-Info mit **tatsächlichen** Kosten bleibt bei Depotbank bzw. Versicherer, im Portal verlinkt. Wer die Pflicht beim Makler-Vertrieb von Fondspolicen trägt, prüfen | [lxgesetze §13](https://lxgesetze.de/finvermv/13), [lexetius §7b](https://lexetius.com/VVG/7b) |
| **Simulierte Wertentwicklung (§14 FinVermV, Art. 44 DelVO 2017/565)** | Simulierte frühere Wertentwicklung muss auf der **tatsächlichen Wertentwicklung** desselben oder eines zugrunde liegenden Instruments oder Index beruhen. Für Prognosen gilt: keine simulierte Vergangenheit, angemessene Annahmen mit objektiven Daten, Kostenwirkung, deutlicher Warnhinweis (AMF zitiert die Bedingungen) | Die Nachrechnung mit echten Fondskursen eines Portfolios, das der Kunde tatsächlich hält, ist der Fall „tatsächliche Wertentwicklung, auf ein Kundenportfolio angewendet". Kennzeichnung, Zeitraum, Quelle, Kosten und Warnhinweis gehören dazu. **Keine Prognosen im Monatsbericht.** Projektionen (z. B. „Bis 67 voraussichtlich …") nur im Planungsbereich mit Rechner-Regeln (research.md B8). Wortlaut Abs. 4–6 **nicht abgerufen** | [FCA COBS 4.5A](https://www.handbook.fca.org.uk/handbook/COBS/4/5A.html), [AMF-Konsultation](https://www.amf-france.org/sites/institutionnel/files/contenu_simple/consultations_publiques/AMF%20public%20consultation%20on%20the%20provision%20of%20future%20performance%20simulations%20to%20investors.pdf) |
| **Irreführung (§5 UWG) bei Bestandskunden** | Geschäftliche Handlung umfasst auch Verhalten **nach** Vertragsschluss, wenn es Entscheidungen im laufenden Vertrag beeinflussen kann (BGH „Prämiensparverträge", „Standardisierte Mandatsbearbeitung"). Bloße Schlechterfüllung ist grundsätzlich keine geschäftliche Handlung | Eine geschönte Darstellung (z. B. nur Fondsrendite statt Vertragswert, „Kosten" versteckt) kann den Kunden in Kündigungs-, Beitrags- oder Zuzahlungsentscheidungen beeinflussen → UWG-relevant. Darstellung nach Kapitel 5 | [omsels.info](https://www.omsels.info/ii-anwendungsbereich/a-voraussetzung-geschaeftliche-handlung/5-abschluss-oder-durchfuehrung-eines-vertrags), [rewis BGH I ZR 216/17](https://rewis.io/urteile/urteil/v3y-06-06-2019-i-zr-21617/) |
| **Haftung bei falscher Simulation** | Auskunftsvertrag zwischen Anlagevermittler und Kunde entsteht auch stillschweigend, Haftung für unrichtige Angaben (BGH III ZR 100/06, III ZR 413/04). **Formularmäßiger Haftungsausschluss für den Kern der Auskunft unwirksam** (OLG München 3 U 5647/22). Anspruch aus §§280, 241 Abs. 2, 311 Abs. 2 BGB | Disclaimer allein schützt nicht. Schutz: (1) klar als **Schätzung** kennzeichnen, mit Methode und letztem belegten Stand. (2) Belegte Werte getrennt zeigen. (3) Bei Abweichung über der Schwelle Wert sperren statt zeigen. (4) Keine Entscheidungsaufforderung an den Schätzwert koppeln („Für Kündigung, Beleihung oder Auszahlung zählt nur der Wert des Versicherers bzw. der Depotbank"). (5) VSH fragen, ob das abgedeckt ist | [lexetius 2007,3124](https://lexetius.com/2007,3124), [OLG München](https://www.gesetze-bayern.de/Content/Document/Y-300-Z-BECKRS-B-2023-N-46468?hl=true), [kanzlei-herfurtner](https://kanzlei-herfurtner.de/anlagevermittlerhaftung/) |
| **Aufbewahrung der Monatsberichte** | Keine ausdrückliche Pflicht für Monatsupdates gefunden. 10 Jahre nach §23 FinVermV für Unterlagen nach §22 bzw. Taping. Handelsbriefe 6 Jahre (§257 HGB, research.md B3) | **Eigene Empfehlung:** jeden versendeten Bericht als PDF unveränderbar plus Eingabe-Snapshot (Modellversion, Kurse, Parameter) **10 Jahre** aufbewahren. Das deckt die Verjährungshöchstfrist von 10 Jahren (§199 Abs. 3 BGB) als Beweismittel ab | research.md B3 |
| **Datenschutz** | Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Servicebestandteil des Maklervertrags) **oder** Einwilligung, wenn optional (mit DSB entscheiden). Finanzdaten sind keine Art.-9-Daten | (1) Kursanbieter erhält nur ISINs und Datumsangaben, keine Personendaten, also kein AVV nötig. (2) Mail: nur „Dein Monatsupdate ist da" ohne Beträge (research.md B10). (3) PDF-Erzeugung: Wenn html2pdf.app genutzt wird, bekommt der Dienst Name und Vermögenswerte → AVV, Serverstandort und Drittlandtransfer prüfen. Besser lokal erzeugen (Edge Function in Frankfurt oder IONOS-VPS). (4) KI-Kommentar („Dein Monat in 30 Sekunden"): Zahlen per Template einsetzen. Die KI schreibt höchstens den **allgemeinen Marktkommentar ohne Personendaten**, oder alles läuft über den Anonymizer. (5) Open Banking: Anbieter ist eigener Verantwortlicher oder AV, klären. (6) Verzeichnis der Verarbeitungstätigkeiten ergänzen | CLAUDE.md, research.md B1/B10 |
| **§34f-Umfang** | §34f deckt Investmentfonds ab. Bei Einzelaktien im Depot nur anzeigen, nichts empfehlen | Einzelaktien nur als „Fremdposition", ohne Kommentar | allgemeine Kenntnis, **nicht hier verifiziert** |

---

<a id="vorbilder"></a>
## 7. Vorbilder für Reports und Live-Ansichten

| Vorbild | Was gut gemacht ist | Übertragbar auf Marvin | Quelle |
|---|---|---|---|
| **Betterment** | Standard ist die zeitgewichtete Rendite, daneben „Your rate of return" (IZF). In Stressphasen bekommen nur Kunden, die sich einloggen und handeln wollen, eine Botschaft, keine Massenmail. Ein Hinweis auf die Steuerkosten vor dem Verkauf senkt Verkäufe um 62 % (Firmenangabe) | Beide Renditen mit Ein-Satz-Erklärung. Crash-Einordnung **im Portal**, Mail nur kurz | [Betterment TWR](https://betterment.com/help/time-weighted-returns), [ETF.com](https://www.etf.com/sections/news/how-keep-clients-calm-amid-market-turmoil), [wealthprofessional](https://wealthprofessional.ca/news/industry-news/how-robo-advisors-are-helping-people-make-smarter-money-decisions/328451) |
| **Parqet** | Dashboard mit Wert, Performance, Allokation, **Drawdown-Chart**, Dividenden, Benchmark. TTWROR und IZF, Import per PDF/CSV, Autosync bei TR und Scalable | Drawdown-Chart „So tief ging es schon mal, so lange dauerte die Erholung" (mit echten ETF-Kursen) | [justETF](https://www.justetf.com/de/academy/parqet-erfahrungsbericht.html), [Parqet TTWROR](https://parqet.com/en/blog/true-time-weighted-rate-of-return) |
| **quirion** | Quartalsweise Kundenübersicht (Strategie monatlich und quartalsweise, **Renditen und Gebühren**) plus Marktbericht des Anlageteams **ohne Prognosen**, digitale Postbox | Struktur: Zahlen, Kosten, kurzer Markttext ohne Prognose | [quirion Postbox](https://www.quirion.de/en/post/you-have-mail-digital-postbox) |
| **Nutmeg** | Eigene Verhaltensdaten: ca. 97 % der Kunden machen nach Turbulenzen nichts Ungewöhnliches, 2020 waren es 91,7 %. Audio-„Investor Update" monatlich ohne Anlageberatung. Botschaft „Ein Buchverlust ist erst beim Verkauf realisiert" | „Was andere Anleger in solchen Monaten tun" als Social Proof (mit eigener Statistik, sobald vorhanden) | [Nutmeg](https://www.nutmeg.com/insights/investor-behaviour-volatility) |
| **Wealthfront** | Bei der Volatilität im April 2025 stiegen die Einzahlungen. Botschaft: auf das konzentrieren, was du kontrollierst | „Was du jetzt tun kannst: nichts. Oder: Sparrate prüfen." | [Wealthfront Blog](https://www.wealthfront.com/blog/client-response-recent-volatility/) |
| **Moneyfarm** | CEO-Brief in schwachen Phasen, Private Mode (research.md) | Persönlicher Text von Marvin in Crash-Monaten (vorab geschrieben, Freigabe per Klick) | [Moneyfarm](https://blog.moneyfarm.com/en/moneyfarm-news/a-message-to-our-investors-from-giovanni-dapra-moneyfarm-ceo/) |
| **Barmenia-App, Canada Life, Ergo** | Werte und Verlauf der Fondsrente digital statt einmal im Jahr per Post. Canada Life zeigt Vermittlern Fondswerte und Rückkaufswert | Zeigt, dass Kunden das erwarten. Deine Ergänzung: Kosten in Euro | 3.3 |
| **Evidenz Verhaltensökonomie** | Je häufiger Anleger Ergebnisse bewerten, desto risikoscheuer werden sie (Gneezy/Potters 1997, myopische Verlustaversion nach Benartzi/Thaler 1995, Mechanismus umstritten). Morningstar „Mind the Gap": Anleger verdienen ca. **1,2 Prozentpunkte p. a. weniger** als ihre Fonds, wegen des Timings | **Monatlich statt täglich**, Headline „seit Beginn" bzw. „pro Jahr" statt „diesen Monat". Monatsveränderung klein darunter | [Gneezy/Potters PDF](https://Rady.ucsd.edu/_files/faculty-research/uri-gneezy/evaluation-periods.pdf), [Boldin zu Morningstar](https://www.boldin.com/retirement/why-investors-miss-out-on-fund-returns/), [Morningstar AU](https://www.morningstar.com.au/personal-finance/young-invested-are-you-sabotaging-your-etf-returns) |

**„Dein Monat in 30 Sekunden" – Vorschlag Aufbau (eigene Synthese):**
1. **Eine Zahl:** geschätzter Gesamtwert, darunter „eingezahlt" und „Wertentwicklung seit Beginn in € und % p. a.".
2. **Ein Satz zum Monat:** „Die Märkte haben im September leicht nachgegeben. Dein Depot liegt 1,8 % unter dem Vormonat und 34 % über deinen Einzahlungen."
3. **Ein Satz Einordnung:** feste Textbausteine je Lage (Normalmonat, Minus über 5 %, neues Hoch, Crash über 15 % vom Hoch). Im Crash zusätzlich der vorbereitete Marvin-Text und der Drawdown-Chart.
4. **Eine Sache für dich:** nur organisatorisch (Freistellungsauftrag prüfen, Jahresgespräch buchen, Wertmitteilung hochladen). **Nie** „kauf/verkauf X".
5. **Kosten in Euro** (Policen: Zillmer-Phase erklären).
6. **Kleingedrucktes:** Schätzung, Stand, Quelle, belegter Stand, Disclaimer.

---

<a id="architektur"></a>
## 8. Empfehlung und Architektur

### 8.1 Gesamtbild

```
 Kursanbieter (EODHD oder Twelve Data, kommerzielle Lizenz)
        │  nur ISINs + Datum (keine Personendaten)
        ▼
 ┌──────────────── Supabase „marvin-os" (Frankfurt) ────────────────┐
 │ Edge Function kurse-sync  ──►  wertpapiere, kurse, ausschuettungen│
 │                                                                   │
 │ Cockpit: Marvin pflegt                                            │
 │   anlagen (Depot/Police je Haushalt) · anlage_positionen (ISIN,   │
 │   Gewicht) · anlage_zahlungsplan · anlage_transaktionen ·         │
 │   kostenmodelle · anlage_anker (Wertmitteilung/Depotauszug)       │
 │                                                                   │
 │ Edge Function bewertung-berechnen (reine TS-Rechenfunktion,       │
 │   unit-getestet, versioniert) ──► bewertungen_monat               │
 │                                                                   │
 │ Prüfansicht: Datenlücken, Abweichung > Schwelle, Crash-Monat?     │
 │   → Marvin klickt „Monat freigeben" (oder Auto-Freigabe, wenn     │
 │     keine Auffälligkeit)                                          │
 └───────────────┬───────────────────────────────────────────────────┘
                 │ Edge Function portal-publish (nur Ergebniswerte)
                 ▼
 ┌──────────── Supabase „portal" (Frankfurt) ────────────┐
 │ depot_snapshots (read-only für Kunde, RLS)            │
 │ dokumente (Monats-/Jahres-PDF, privat, signierte URL) │
 │ Upload Wertmitteilung → zurück an marvin-os (Anker)   │
 └───────────────┬───────────────────────────────────────┘
                 │ n8n (IONOS) + Resend EU
                 ▼
   Mail „Dein Monatsupdate ist da" (ohne Beträge, Link ins Portal)
```

Das passt zur Zwei-Projekte-Architektur aus `konzept.md` §1 und zum Publish-Fluss in §7 dort.

### 8.2 Tabellen (Skizze, marvin-os, jeweils mit `tenant_id` + RLS `tenant_isolation`)

```sql
create table wertpapiere (            -- Stammdaten je ISIN (Referenzdaten, trotzdem tenant_id laut CLAUDE.md)
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
  isin text not null, name text, typ text check (typ in ('etf','fonds','aktie','sonstig')),
  ertragsverwendung text check (ertragsverwendung in ('thesaurierend','ausschuettend')),
  waehrung text default 'EUR', quelle text, quelle_symbol text,   -- z. B. 'eodhd','LU0247994923.EUFUND'
  unique (tenant_id, isin)
);
create table kurse (
  tenant_id uuid not null references tenants(id), isin text not null, datum date not null,
  kurs numeric(18,6) not null, kursart text check (kursart in ('nav','close')), quelle text not null,
  abgerufen_am timestamptz default now(), primary key (tenant_id, isin, datum, kursart)
);
create table ausschuettungen (
  tenant_id uuid not null references tenants(id), isin text not null, ex_tag date not null,
  zahltag date, betrag_je_anteil numeric(18,6) not null, waehrung text, quelle text,
  primary key (tenant_id, isin, ex_tag)
);
create table anlagen (                -- ein Depot oder eine Police
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
  haushalt_id uuid not null references haushalte(id),
  art text check (art in ('etf_depot','fondspolice_brutto','fondspolice_netto','fondspolice_garantie')),
  anbieter text, vertragsnummer_ref text,  -- nur interne Referenz, nicht ins Portal
  beginn date not null, kostenmodell_id uuid, anzeige_modus text
    check (anzeige_modus in ('schaetzung','nur_belegt','nur_fondsentwicklung')) default 'schaetzung',
  deleted_at timestamptz
);
create table anlage_positionen (anlage_id uuid references anlagen, tenant_id uuid not null references tenants(id),
  isin text not null, gewicht numeric(6,4), gueltig_ab date not null, primary key (anlage_id, isin, gueltig_ab));
create table anlage_zahlungsplan (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
  anlage_id uuid references anlagen, typ text check (typ in ('einmal','sparplan')), betrag numeric(12,2),
  rhythmus text, ausfuehrungstag int, start date, ende date, dynamik_pct numeric(5,2));
create table anlage_transaktionen (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
  anlage_id uuid references anlagen, datum date, isin text, anteile numeric(18,6), betrag numeric(12,2),
  art text check (art in ('kauf','verkauf','ausschuettung','gebuehr','umschichtung')), belegt boolean default false);
create table kostenmodelle (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
  bezeichnung text, quelle_dokument text,   -- z. B. 'Kosteninfo 2024, S. 3'
  ak_pct_beitragssumme numeric(6,4), ak_verteilung_monate int default 60,
  vk_pct_beitrag numeric(6,4), vk_pct_guthaben_pa numeric(6,4), stueckkosten_pa numeric(8,2),
  ordergebuehr_fix numeric(8,2), ordergebuehr_pct numeric(6,4), externe_verguetung_pa numeric(10,2));
create table anlage_anker (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
  anlage_id uuid references anlagen, stichtag date not null, positionen jsonb,  -- [{isin, anteile, wert}]
  fondsguthaben numeric(12,2), rueckkaufswert numeric(12,2), summe_beitraege numeric(12,2),
  quelle text, dokument_ref uuid, abweichung_pct numeric(6,2));   -- Simulation vs. Beleg
create table bewertungen_monat (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
  anlage_id uuid references anlagen, stichtag date not null, wert_geschaetzt numeric(12,2),
  eingezahlt numeric(12,2), kosten_kumuliert numeric(12,2), kostenwirkung numeric(12,2),
  twr_seit_beginn_pa numeric(7,4), izf_pa numeric(7,4), fondsentwicklung_pct numeric(7,4),
  letzter_anker date, modell_version text, kursstand_hash text, status text
    check (status in ('berechnet','pruefen','freigegeben','gesperrt')),
  unique (anlage_id, stichtag));
```

Migration im Format `YYYYMMDDHHMMSS_NNN_anlagen_bewertung.sql`, danach `pnpm supabase:types` (CLAUDE.md §4). **Hinweis:** Die Tabellen liegen außerhalb des aktuellen Sprints. Vor dem Bau Plan-Freigabe nach CLAUDE.md §4/§8 einholen.

### 8.3 Monatlicher Ablauf

| Schritt | Wann | Was | Wo |
|---|---|---|---|
| 1 | 3. Bankarbeitstag des Monats, 06:00 (NAVs vom Ultimo liegen meist T+1/T+2 vor, **Annahme**) | `kurse-sync`: Monatsultimo-Kurse und Ausschüttungen für alle ISINs aus aktiven `anlage_positionen` holen, fehlende Kurse protokollieren | pg_cron → Edge Function (Frankfurt gepinnt) |
| 2 | direkt danach | `bewertung-berechnen` je Anlage, Status `berechnet` bzw. `pruefen` (Kurs fehlt, Abweichung über Schwelle, Anker älter als 15 Monate, Crash-Regel ausgelöst) | Edge Function |
| 3 | gleicher Tag | Cockpit-Karte „Monatsupdate: 37 ok, 3 prüfen" + Todoist-Aufgabe (vorhandene Brücke) | marvin-os |
| 4 | nach Freigabe | `portal-publish` schreibt nur Ergebniswerte in `depot_snapshots`. Bei Status `gesperrt` erscheint der letzte belegte Wert | Edge Function |
| 5 | max. 1 Mail pro Tag (Bündelung wie konzept.md) | Mail „Dein Monatsupdate ist da" ohne Beträge. Kunde kann zwischen monatlich, quartalsweise und aus wählen | n8n + Resend EU |
| 6 | PDF on demand im Portal, **Jahres-PDF** automatisch im Januar | PDF lokal erzeugen, im privaten Bucket ablegen, Hash speichern, 10 Jahre aufbewahren | Edge Function / VPS |
| 7 | jährlich nach Eingang der Wertmitteilungen | Anker erfassen → Abweichungsstatistik → ggf. Kostenmodell korrigieren | Cockpit |

### 8.4 Ausbaustufen

1. **MVP (nur ETF-Depots):** Positionen und Sparplan, Kurs-Sync, Monatswert, Portalansicht, Mail. Fondspolicen erst im Modus `nur_belegt` (Wertmitteilung hochladen und anzeigen) plus `nur_fondsentwicklung`.
2. **Stufe 2:** Kostenmodelle für deine 3–5 häufigsten Policen-Tarife, Schätzung mit Anker, Kostenbalken.
3. **Stufe 3:** Echte Bestandsdaten über den Pool (nach Antwort blau direkt/Netfonds). Dann wird die Simulation zum Plausibilitätscheck.
4. **Optional:** Open Banking für Kunden mit Neobroker-Depots (wealthAPI-Angebot einholen).

---

<a id="disclaimer"></a>
## 9. Disclaimer-Entwurf

> **Vom Anwalt prüfen lassen. Entwurf in Du-Form, Sie-Variante analog.**

**Kurzfassung (direkt unter der Zahl):**
> Geschätzter Wert zum 30.09.2026. Nachgerechnet mit den echten Kursen deiner Fonds, nicht der offizielle Wert deiner Bank oder deines Versicherers. Letzter belegter Stand: 31.12.2025.

**Langfassung (aufklappbar und im PDF):**
> **So rechnen wir:** Wir rechnen den Wert deiner Anlage mit den tatsächlichen Monatskursen der Fonds nach, in die du investiert bist (Quelle: [Anbieter], Stand [Datum]). Grundlage sind deine Einzahlungen und Sparraten, wie wir sie kennen, und – bei Versicherungen – die Kosten laut deinen Vertragsunterlagen. Wenn uns ein Kontoauszug oder eine Wertmitteilung vorliegt, rechnen wir ab diesem belegten Stand weiter.
>
> **Was das nicht ist:** Das ist eine Schätzung zur Information. Es ist kein Depotauszug, keine Wertmitteilung, keine Anlageberatung und keine Prüfung, ob deine Anlage noch zu dir passt. Das machen wir im Jahresgespräch. Der tatsächliche Wert kann abweichen, zum Beispiel durch andere Ausführungskurse, Gebühren, Steuern, Gutschriften, Umschichtungen oder Vertragsänderungen, die wir nicht kennen. Bisher lag unsere Schätzung im Mittel um [x] % neben dem belegten Wert *(erst nach einem Jahr Messung einsetzen)*.
>
> **Maßgeblich** für Kündigung, Auszahlung, Beleihung oder Steuer ist allein der Wert, den dir deine Depotbank bzw. dein Versicherer mitteilt. Bei Versicherungen ist der Rückkaufswert in der Regel niedriger als das Fondsguthaben.
>
> **Steuern** (z. B. Vorabpauschale, Abgeltungsteuer) sind nicht berücksichtigt.
>
> **Wertentwicklung:** Frühere Wertentwicklungen sind kein verlässlicher Indikator für künftige Ergebnisse. Fondsanteile schwanken im Wert, Verluste bis hin zum Totalverlust einzelner Anlagen sind möglich. Bei Fonds in Fremdwährung kann die Rendite durch Wechselkursschwankungen steigen oder fallen.
>
> **Kosten:** Die gezeigten Werte sind nach Kosten gerechnet. Fondskosten (TER) stecken bereits im Kurs. Vertragskosten zeigen wir dir als eigene Zeile in Euro. Die offiziellen jährlichen Kosteninformationen deiner Bank bzw. deines Versicherers findest du unter „Dokumente".
>
> Fragen? Schreib mir im Portal.

---

<a id="klaeren"></a>
## 10. Offene Fragen: wer klärt was

| Thema | Mit wem | Konkrete Frage |
|---|---|---|
| Lizenz Kursdaten | EODHD (support@ bzw. Vertrieb), Twelve Data Sales | „Wir sind ein Finanzanlagenvermittler in Deutschland. Wir rufen monatlich EOD-Kurse bzw. NAVs für ca. 150 ISINs ab (UCITS-ETFs, EU-Investmentfonds). Angezeigt werden ausschließlich daraus berechnete, personalisierte Depot- bzw. Vertragswerte für unsere eigenen Kunden (ca. N Personen) in einem passwortgeschützten Portal und in PDF-Berichten. Keine Kurslisten, keine Rohkurs-Charts, keine öffentliche Website. Welcher Plan deckt das ab, was kostet er, sind Börsengebühren enthalten, und welche Attribution ist nötig?" |
| Abdeckung | selbst | ISIN-Liste gegen Free-Tiers testen (2.4) |
| Echte Depotdaten | blau direkt Partnerservice, Netfonds | „Gibt es für blau-direkt-Partner Bestandsdaten zu Investmentdepots (Anteile je ISIN, Stichtag, Transaktionen) per Export oder API, über Fondsnet bzw. künftig finfire? Was kostet das? Welche Felder liefert AMEISE bzw. dailyUP zu Fondspolicen (Fondsguthaben, Anteile je Fonds, Rückkaufswert)? Landen Wertmitteilungen im Postkorb?" |
| Open Banking | wealthAPI, Qwist | Preis für ca. N Verbindungen, Rolle nach DSGVO, Depotabdeckung für DAB, ebase, FFB, comdirect, Consors |
| Finanzportfolioverwaltung, §18 Abs. 3 FinVermV, §7c VVG, Art. 44 DelVO, UWG, Haftung, Disclaimer | Fachanwalt Bank- und Kapitalmarktrecht | Ist der Monatsbericht in dieser Form reine Information? Welche Formulierungen vermeiden das „Angebot regelmäßiger Geeignetheitsbeurteilung"? Passt der Disclaimer? |
| Ex-post-Kosten bei Fondspolicen (§7b VVG) | Fachanwalt Versicherungsrecht | Wer trägt beim Maklervertrieb die jährliche Kosteninfo, und darf der Monatsbericht darauf verweisen? |
| Rechtsgrundlage, VVT, PDF-Dienst, Open-Banking-Rolle | Datenschutzbeauftragter | Art. 6 Abs. 1 lit. b oder Einwilligung? AVV mit html2pdf.app oder lokale Erzeugung? |
| Deckung Schätzfehler | VSH-Versicherer | Deckt die VSH Ansprüche aus fehlerhaften Schätzwerten im Kundenportal? |
| Fondsdata-Nutzung | Bundesanzeiger Verlag (fondsdata@bundesanzeiger.de) | Darf man die veröffentlichten Fondspreise automatisiert abrufen und für Kundenberichte nutzen? |

---

<a id="nicht-verifiziert"></a>
## 11. Nicht verifiziert (ausdrücklich offen)

- **Alle Preise und Lizenzbedingungen der Datenanbieter** stammen aus Suchauszügen, teils widersprüchlich: EODHD kommerziell (individuell vs. 399/2.499 $), Twelve Data Venture (149 $, Tabelle abgeschnitten), Marketstack „Commercial Use" je Tarif, Finnhub global. Ob ein Anbieter „abgeleitete, personalisierte Werte" als Display wertet, ist für keinen belegt.
- Ob Twelve Data **europäische Investmentfonds per ISIN** abdeckt. EODHD-EUFUND ist belegt, die Vollständigkeit für deine ISINs nicht.
- Regel der Deutschen Börse für **reine Tagesschlusskurse** (EOD), nur Real-time- und Delayed-Preise gefunden.
- Nutzungsbedingungen für Leser des **Bundesanzeiger Fondsdata** und der deutschen iShares-Seite (zitiert ist die Schweizer Seite). Ein ausdrückliches onvista-Scraping-Verbot war nicht im Auszug. Das finanzen.net-Verbot ist nur über ein Forum zitiert.
- **Depotbanken-Schnittstellen** (ebase, FFB, DAB, AAB, MorgenFund, Metzler, Baader): keine öffentliche Doku zu Bestandsdateien für Vermittler gefunden.
- **blau direkt:** ob Investmentbestände inzwischen in simplr sichtbar sind, Integrationsstand mit Netfonds/finfire nach dem Delisting, AMEISE-Felder für Fondspolicen.
- **BiPRO:** welche Norm Fondsguthaben bzw. Anteile je Fonds überträgt.
- Wortlaut von **Art. 44 Abs. 4–6 DelVO 2017/565** (nur über FCA- und AMF-Sekundärtexte), **§18 Abs. 3 FinVermV** und **§7c VVG** (Fundstellen über Gesetzesportale, Absatznummer bei §7c unsicher), **§169 Abs. 4 VVG** (nur über Finanztip zitiert), §4 DeckRV (über Deloitte/BGH-Bezug).
- Anwendbarkeit von **§155 VVG** auf reine Fondspolicen ohne Überschussbeteiligung.
- Wer bei Fondspolicen im Maklervertrieb die jährliche Kosteninformation nach **§7b Abs. 2 VVG** schuldet.
- Zulässigkeit von **Makler-Honoraren bei Verbrauchern** für Nettotarife (Literatur uneinheitlich).
- **Genauigkeitsangaben** in 4.5 sind eigene Einschätzung, nicht gemessen.
- **NAV-Verfügbarkeit T+1/T+2** als Zeitplanannahme.
- Morningstar „Mind the Gap" 1,2 Prozentpunkte: Messzeitraum je nach Ausgabe unterschiedlich (bis 2024 bzw. bis 2025), nur über Sekundärquellen.
- FiDA-Stand nur über WKO (10.09.2026).
- Steuerliche Vorteile der Fondspolice nur aus kommerzieller Quelle (etf.capital).

---

<a id="quellen"></a>
## 12. Quellen

**Kursdaten und Lizenzen**
- EODHD: https://eodhd.com/pricing?via=aiva · https://eodhd.com/pricing-quantpedia · https://eodhd.com/commercial-pricing · https://eodhd.com/asx-data · https://eodhd.com/financial-summary/LU0247994923.EUFUND · https://eodhd.com/financial-apis/review-copy-end-of-day-historical-data-api · https://forum.eodhd.com/t/adjusted-close-versus-close/507 · https://github.com/we-promise/sure/issues/2204 · https://ftp.fau.de/cran/web/packages/eodhdR2/refman/eodhdR2.html · https://apis.io/plans/eodhd/eodhd-plans-pricing/
- Twelve Data: https://twelvedata.com/pricing.md · https://twelvedata.com/prime · https://twelvedata.com/news/march-2026-updates · https://twelvedata.com/news/nov-2024-updates · https://support.twelvedata.com/en/articles/10444817-what-is-non-price-data · https://support.twelvedata.com/en/articles/12647398-attribution-guidelines-for-using-twelve-data · https://support.twelvedata.com/en/collections/3122655-faqs
- Alpha Vantage: https://alphavantage.co/terms_of_service · https://api.qveris.ai/guides/alpha-vantage-pricing-alternative
- Tiingo: https://www.quantstart.com/articles/evaluating-data-coverage-with-tiingo/
- Finnhub: https://www.finnhub.io/pricing-etf-indices · https://apicostcalc.com/de/finnhub.html
- Marketstack: https://marketstack.com/signup
- Polygon/Massive: https://www.fintegrationfs.com/fintechapisusa/polygon-stock-api
- OpenFIGI: https://www.openfigi.com/api/documentation · https://openfigi.com/about/faq · https://openfigi.com/about/symbology · https://www.openfigi.com/docs/terms-of-service
- Deutsche Börse: https://www.mds.deutsche-boerse.com/resource/blob/3685372/8638b96ff2177aed6e0c68086565b838/data/MDDA_Price_List_13_3.pdf · https://www.mds.deutsche-boerse.com/mds-en/real-time-data/Delayed-data · https://www.mds.deutsche-boerse.com/resource/blob/3134034/dac167f9f376e95323f12c42db14e173/data/Market-Data-Policy-Guidelines-and-FAQ_V2_2.pdf · https://www.mds.deutsche-boerse.com/resource/blob/4095360/0e807c784d4b7e7b5381be49098b1838/data/Product%20Sheet_Kneip-Dynamic%20Data_V1_290824.pdf
- Morningstar, FE fundinfo, LSEG: https://www.finanzfluss.de/informer/fonds/ie00b5kn3d77 · https://us.fitgap.com/products/morningstar-direct · https://www.fefundinfo.com/media/54pd2rkd/fe-fundinfo-data-feeds-product-sheet.pdf · https://fefundinfo.com/media/tzvoveln/fundinfo_agreement_membership_annexe_documents_and_data_published_fl_r_en-030033.pdf · https://www.lseg.com/content/dam/data-analytics/en_us/documents/fact-sheets/lseg-lipper-global-data-feed-factsheet.pdf
- Fondsgesellschaften, Bundesanzeiger, KAGB: https://www.ishares.com/ch · https://api.hansainvest.com/docs/v1/endpoints/figures/ · https://www.bundesanzeiger.de:/pub/D065Preisliste.pdf · https://www.bundesanzeiger.de/pub/en/howto-fondsdata · https://lexetius.com/KAGB/170
- MSCI: https://www.msci.com/legal/index-terms
- Scraping/AGB: https://www.onvista.de/agb · https://www.onvista.de/nutzungsbedingungen · https://forum.iobroker.net/post/926445 · https://wmdatenservice.com/?mid=246

**Depotdaten, Pools, Open Banking**
- https://www.vermittlerportal.de/trust/kunden-broschuere-ebase-trust190.pdf · https://forum.portfolio-performance.info/t/csv-import-von-ebase/172?page=2 · https://www.bca.de/wp-content/uploads/2022/07/FFB.pdf · https://www.cash-online.de/a/fondskonzept-ffb-digitale-depoteroffnung-253612/ · https://fondsdepotbank.de/en/products-and-services/online-portal · https://help.ginmon.de/de-de/articles/62-welche-depotbanken-nutzt-ginmon
- blau direkt / Fondsnet / Netfonds: https://www.cash-online.de/a/fondsnet-und-blau-direkt-kooperieren-ein-knall-der-den-markt-durcheinanderwirbelt-553006/ · https://www.fundresearch.de/maklerpool/blaudirekt-und-fondsnet-kooperieren.php · https://www.cash-online.de/a/maklerpools-alter-praegung-werden-aussterben-559727/ · https://www.blaudirekt.de/pressemitteilung/netfonds-ag-schliesst-investment-agreement-mit-warburg-pincus-und-formt-strategische-allianz-mit-blau-direkt-in-gemeinsamer-privater-eigentuemerstruktur/ · https://www.cash-online.de/a/netfonds-und-blau-direkt-wie-die-zusammenarbeit-der-plattformen-aussehen-soll-713520/ · https://www.asscompact.de/nachrichten/blau-direkt-und-netfonds-die-hintergruende-zum-zusammenschluss · https://www.versicherungsbote.de/id/4948725/Blau-direkt-Warburg-Pincus-uebernimmt-Netfonds/
- Open Banking: https://documentation.finapi.io/access/interfaces · https://www.finapi.io/en/products/open-banking/banking-api/ · https://wealthapi.eu/en/wealthapi-data/ · https://wealthapi.eu/en/pricing/ · https://wealthapi.atlassian.net/wiki/spaces/PD/pages/427753474 · https://connect.finleap.com/faq/ · https://www.g2.com/products/ndgit/pricing · https://openbankingtracker.com/embedded-finance/klarna-kosma · https://www.ing.de/hilfe/log-in/fints/ · https://python-fints.readthedocs.io/ · https://www.datev-community.de/t5/Unternehmen-online/Bankabruf-von-Consors-nicht-mehr-m%C3%B6glich/td-p/507673 · https://gesetze.legal/eu/rl_2015_2366_eu/4 · https://www.mastercard.com/de/de/business/open-finance/help-articles/loan-accounts-and-supported-account-types.html · https://lexmea.de/de/gesetz/zag/51 · https://www.wko.at/information-consulting/finanzdienstleister/fida-financial-data-access
- Versicherer/BiPRO: https://www.versicherungsbote.de/id/81666/canada-life-service-partner-vertrag-online-makler-versicherung-fonds/ · https://www.cash-online.de/a/schlank-und-digital-barmenia-lanciert-fondspolicen-verwaltung-via-app-646324 · https://www.cash-online.de/a/fondspolicen-ergo-informiert-tagesaktuell-ueber-performance-17259/ · https://www.ruv.de/service/wertmitteilung · https://www.it-finanzmagazin.de/?p=141911 · https://barmenia.mynewsdesk.com/pressreleases/meilenstein-fur-makler-im-datenaustausch-gothaer-bietet-bipro-schnittstelle-3135109.pdf · https://www.inveda.net/id/4870780/Invedanet-stellt-Daten-der-Invers-GmbH-per-BiPro-Schnittstelle-zur-Verfugung

**Modellierung Fondspolice**
- https://lexmea.de/de/gesetz/vvg/169 · https://www.deloitte.com/de/de/services/financial-advisory/analysis/Fruehstorno-und-Mindestrueckkaufswert.html · https://www.iww.de/wvm/vertriebspraxis/versicherungsrecht-unkuendbare-kostenausgleichsvereinbarung-bei-fondsgebundenen-nettopolicen-unzulaessig-f74814 · https://www.finanztip.de/lebensversicherung/lebensversicherung-rueckkaufswert/ · https://lexetius.com/VVG/155 · https://www.experten.de/id/4945734/transparenzanalyse-der-deutschen-lebensversicherer/index.pdf · https://eu-assets.contentstack.com/v3/assets/bltcba55c71291ad2c3/blt0f2bd990630cc95d/691446423bfeff3ecd0883eb/Vertragsgrundlagen_FLV.pdf · https://assets.finanzfluss.de/wp/2025/07/munchener-verein-privatinvest-avb.pdf · https://www.oebv.com/fileadmin/oebv/8_versicherungsbedingungen/tarifbezogene_versicherungsbedingungen/tfonl-m_fondsvorsorge.pdf · https://www.versicherungsbote.de/id/4905334/chapter/1/Lebensversicherung-BaFin-kritisiert-teils-zu-hohe-Effektivkosten/ · https://www.dasinvestment.com/stuttgarter-lebensversicherung-fondspolicen-verbraucherzentrale-hamburg/ · https://www.test.de/Fondsgebundene-Rentenversicherung-Nur-drei-gute-Policen-4256486-4256495/ · https://etf.capital/etf-fondspolice-vorteile-von-etfs-fur-private-anleger/ · https://www.bvi.de/fileadmin/user_upload/Anlage_1_260724_AVRG-Verbaende-Vorschlag_Berechnung_Effektivkosten_clean.pdf
- Steuern: https://www.otto-schmidt.de/news/steuerrecht/basiszins-zur-berechnung-der-vorabpauschale-gem-18-absatz-4-invstg-basiszins-zum-2-1-2026-2026-01-15.html · https://etf.capital/vorabpauschale-2026-rechner/
- Rendite-Kennzahlen: https://betterment.com/help/time-weighted-returns · https://betterment.com/help/money-weighted-returns · https://parqet.com/en/blog/true-time-weighted-rate-of-return

**Recht**
- https://lxgesetze.de/finvermv/16 · https://lxgesetze.de/finvermv/13 · https://www.ihk.de/magdeburg/recht/finanzdienstleistungen-und-versicherungswirtschaft/recht-finanzdienstleister/neuigkeiten/aenderungen-der-finvermv-4800680 · https://lxgesetze.de/vvg/7c · https://lexetius.com/VVG/7b · https://betriebs-berater.ruw.de/wirtschaftsrecht/nachrichten/Voraussetzungen-einer-erlaubnispflichtigen-gewerbsmaessigen-Finanzportfolioverwaltung-9151 · https://www.rechtslupe.de/wirtschaftsrecht/kapitalanlagerecht/gewerbsmaessige-finanzportfolioverwaltung-324593 · https://www.otto-schmidt.de/news/wirtschaftsrecht/empfehlung-einer-finanzportfolioverwaltung-ist-weder-anlageberatung-noch-anlagevermittlung-2017-11-30.html · https://www.handbook.fca.org.uk/handbook/COBS/4/5A.html · https://www.amf-france.org/sites/institutionnel/files/contenu_simple/consultations_publiques/AMF%20public%20consultation%20on%20the%20provision%20of%20future%20performance%20simulations%20to%20investors.pdf · https://www.omsels.info/ii-anwendungsbereich/a-voraussetzung-geschaeftliche-handlung/5-abschluss-oder-durchfuehrung-eines-vertrags · https://rewis.io/urteile/urteil/v3y-06-06-2019-i-zr-21617/ · https://lexetius.com/2007,3124 · https://www.gesetze-bayern.de/Content/Document/Y-300-Z-BECKRS-B-2023-N-46468?hl=true · https://kanzlei-herfurtner.de/anlagevermittlerhaftung/ · https://www.cash-online.de/a/idd-honorarvereinbarung-makler-351287/2/ · https://www.versicherungsbote.de/id/4862876/Honorarberatung-Versicherungsmakler-IDD/

**Vorbilder und Verhaltensökonomie**
- https://www.etf.com/sections/news/how-keep-clients-calm-amid-market-turmoil · https://wealthprofessional.ca/news/industry-news/how-robo-advisors-are-helping-people-make-smarter-money-decisions/328451 · https://www.justetf.com/de/academy/parqet-erfahrungsbericht.html · https://liebefinanzen.ch/?p=41173 · https://www.quirion.de/en/post/you-have-mail-digital-postbox · https://www.nutmeg.com/insights/investor-behaviour-volatility · https://www.wealthfront.com/blog/client-response-recent-volatility/ · https://blog.moneyfarm.com/en/moneyfarm-news/a-message-to-our-investors-from-giovanni-dapra-moneyfarm-ceo/ · https://Rady.ucsd.edu/_files/faculty-research/uri-gneezy/evaluation-periods.pdf · https://www.boldin.com/retirement/why-investors-miss-out-on-fund-returns/ · https://www.morningstar.com.au/personal-finance/young-invested-are-you-sabotaging-your-etf-returns · https://www.morningstar.com/business/insights/research/mind-the-gap-2025
