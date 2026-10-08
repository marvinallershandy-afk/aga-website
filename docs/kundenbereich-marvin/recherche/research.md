# Kundenbereich für Marvin Allers – Wettbewerbs- und Rechtsrecherche

Stand: 08.10.2026 · erstellt für Marvin Allers (Versicherungs- und Finanzmakler §34d/§34f GewO, Stade; Abrechnung über blau direkt; Kooperation Königswege GmbH i. G.)

> **Keine Rechtsberatung.** Dieses Dokument ist eine Recherche, keine Rechtsberatung. Alle rechtlichen Punkte mit Anwalt, IHK Stade und Datenschutzbeauftragtem prüfen (konkrete Liste in Abschnitt B10).

> **Hinweis zur Methodik (wichtig):** Direkte Seitenabrufe (WebFetch) waren in dieser Umgebung für fast alle Domains gesperrt (u. a. blaudirekt.de, apps.apple.com, gesetze-im-internet.de, supabase.com). Die Belege stammen deshalb aus **Suchmaschinen-Auszügen** der jeweils verlinkten Seiten. Supabase-Doku wurde zusätzlich über die offizielle Supabase-Doku-Suche (MCP) gelesen. App-Screenshots konnte ich **nicht** selbst ansehen, also sind die Design-Bewertungen fast überall „unbekannt“. Aussagen, die nur aus Drittquellen, Händlerseiten oder älteren Artikeln stammen, sind entsprechend gekennzeichnet.

---

## Inhaltsverzeichnis

1. [Kurzfazit (10 Punkte)](#kurzfazit)
2. [Teil A – Wettbewerber und Vorbilder](#teil-a)
   - A1 blau direkt (simplr, AMEISE, Qonekto)
   - A2 Andere Pools/MVPs
   - A3 Digitale Makler und Versicherer
   - A4 Robo-Advisor und evidenzbasierte Vermögensverwalter
   - A5 Große Vertriebe und Honorarberater in Deutschland
   - A6 Internationale Vorbilder
   - A7 Kontext: Altersvorsorgedepot (Reform der privaten Altersvorsorge)
3. [Vergleichsmatrix](#matrix)
4. [Top 10 Ideen für Marvins Portal](#top10)
5. [Empfehlung: Was blau direkt abdeckt und was Marvins Portal leisten sollte](#bd-empfehlung)
6. [Teil B – Recht](#teil-b)
   - B1 Rollen, Hosting, AV-Verträge, Drittlandtransfer
   - B2 Verschlüsselung und technische Maßnahmen
   - B3 Löschkonzept und Aufbewahrungsfristen
   - B4 Gesundheitsdaten (Art. 9 DSGVO), DSFA, Datenschutzbeauftragter
   - B5 Login: Stand der Technik
   - B6 §34d GewO / VersVermV / VVG
   - B7 §34f GewO / FinVermV
   - B8 Online-Rechner: Disclaimer und Werberecht
   - B9 Impressum
   - B10 Portal-Nachrichten statt E-Mail
   - B11 Weitere Punkte (Barrierefreiheit, Verbraucherschlichtung)
   - B12 Wer klärt was?
7. [Nicht verifiziert](#nicht-verifiziert)
8. [Quellenliste](#quellen)

---

<a id="kurzfazit"></a>
## 1. Kurzfazit (10 Punkte)

1. **Die Kunden-App von blau direkt heißt „simplr“**, nicht „Allesmeins“. „allesmeins“ ist die App des Pools JDC. simplr ist in jeder blau-direkt-Lizenz ohne Aufpreis enthalten, mit AMEISE verknüpft und läuft als App und seit Herbst 2024 auch als vollständige Web-App. Sie deckt Versicherungsverträge, Dokumente, Upload, Schadenmeldung, Adress- und Bankänderungen sowie Vergleichsrechner ab. **Das solltest du nicht nachbauen.**
2. **Datenschnittstellen gibt es, sie hängen aber an der Lizenz.** AMEISE-REST-APIs, Webhooks und der tägliche CSV-Export „dailyUP“ (per SFTP) sind laut blau direkt Teil des **Enterprise-Pakets (998 €/Monat)**. Darunter gibt es „Qonekto ONE“ als Brücke zu Make.com (49 bzw. 99 €/Monat, je nach Lizenz bis 100 % rabattiert). Eine öffentliche API-Dokumentation und einen n8n-Connector habe ich nicht gefunden.
3. **Dein Portal sollte die Investment-, Vorsorge- und Beratungsebene abdecken, die simplr nicht bietet.** Dazu gehören Finanzplan und Ziele, Begründungen („Warum“), Kosten in Euro, evidenzbasierte Rechner, ein Archiv für Beratungsdokumentation und Geeignetheitserklärungen, sichere Nachrichten, Terminbuchung und ein Jahresreview. Für Versicherungsverträge reicht ein Deep-Link zu simplr.
4. **Lücke im Markt:** Keine der geprüften deutschen Pool- oder Vertriebs-Apps erklärt erkennbar, *warum* etwas empfohlen wird, und keine zeigt Kosten in Euro. Vorbilder dafür sind eher international: Nutmeg zeigt Kosten in £ und %, Facet und Betterment arbeiten mit Zielen und Roadmap, RightCapital und eMoney bieten Dokumenten-Tresor und Kundenfreigaben, Moneyfarm hat einen In-App-Chat. In Deutschland legt Gerd Kommer seine Methodik in einem Whitepaper offen.
5. **Hosting:** Ein Supabase-Projekt in Frankfurt (eu-central-1) hält Datenbank, Auth und Storage in dieser Region. **Backups, Logs, Edge Functions** (laufen standardmäßig in der Region, die dem Nutzer am nächsten ist) und Subprozessoren fallen nicht unter diese Festlegung. Die DPA von Supabase beruht auf Standardvertragsklauseln (SCC). Eine DPF-Zertifizierung von Supabase konnte ich nicht bestätigen. Netlify ist DPF-zertifiziert, seine Functions laufen standardmäßig aber in Ohio, und das CDN ist global. Personenbezogene Daten daher über Supabase-EU oder den IONOS-VPS verarbeiten, nicht über Netlify Functions oder Netlify Forms.
6. **Das EU-US Data Privacy Framework gilt weiter.** Das EuG hat es am 03.09.2025 bestätigt. Das Rechtsmittel beim EuGH (C-703/25 P) ist aber anhängig. Deshalb SCC als Rückfalllösung dokumentieren.
7. **Gesundheitsdaten (BU/PKV)** brauchen in der Regel eine ausdrückliche, gesonderte Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO, starke technische und organisatorische Maßnahmen (TOMs) und eine dokumentierte DSFA-Schwellwertprüfung. Bei einem Einzelmakler ist die Verarbeitung nach Erwägungsgrund 91 eher nicht „umfangreich“. Wegen des neuen Portals mit Gesundheitsdaten empfehle ich trotzdem eine (schlanke) DSFA. Mit dem DSB klären, ob daraus eine Pflicht zur Benennung eines DSB folgt.
8. **Login:** Passkeys als Standard. Das BSI empfiehlt Passkeys, und OTP-Codes gelten als nicht phishing-resistent. TOTP dient als zweiter Faktor oder Fallback, Magic Links nur für die Erstanmeldung und Wiederherstellung. Supabase unterstützt TOTP-MFA (aal2), Magic Link und Passkeys. **Passkeys sind bei Supabase noch „experimentell“.**
9. **FinVermV-„Taping“ (§18a)** erfasst Telefonate und „sonstige elektronische Kommunikation“ zu Finanzanlagen. Aufbewahrung 10 Jahre (§23). Ob Videocalls und Portal-Chat darunterfallen, steht nicht ausdrücklich in den gefundenen IHK-Quellen. Der Wortlaut spricht aber dafür. Portal-Chat zu konkreten Finanzanlagen daher manipulationssicher 10 Jahre archivieren und Videocalls entweder aufzeichnen oder dort keine konkreten Finanzanlagen besprechen. Vorher mit der IHK Stade klären.
10. **Altersvorsorgedepot:** Das Altersvorsorgereformgesetz ist beschlossen: Bundestag am 27.03.2026, Bundesrat am 08.05.2026, verkündet im BGBl. I 2026 Nr. 156. Die Förderregeln gelten **ab 01.01.2027**. Für das Standarddepot gilt ein Kostendeckel von 1,0 % Effektivkosten. Ein transparenter Zulagen- und Kostenrechner passt deshalb gut zu „Mehr Rendite, weniger Bullshit“. Es gelten aber die Rechner-Pflichten aus B8.

---

<a id="teil-a"></a>
## 2. Teil A – Wettbewerber und Vorbilder

### A1 blau direkt (Pool, über den Marvin abrechnet)

**Produktnamen (Stand der Recherche):**
- **AMEISE**: cloudbasiertes Maklerverwaltungsprogramm (MVP), richtet sich auch an Finanzanlagenvermittler ([blaudirekt.de/mvp](https://www.blaudirekt.de/mvp/)). Daneben gibt es „AMEISE Klassik“ und eine neue modulare AMEISE-Version (Beta), beide synchronisiert ([AssCompact](https://www.asscompact.de/nachrichten/blau-direkt-startet-neue-version-des-mvps-ameise)). Seit **April 2026** gehört der **AMEISE COPILOT** fest zur AMEISE: ein KI-Assistent mit Text- und Spracheingabe auf Basis von drei LLMs ([blau direkt Blog 04/2026](https://www.blaudirekt.de/blog/2026/04/ameise-copilot-der-ki-assistent-fuer-euren-vermittleralltag-ist-da/), [Pressemitteilung](https://www.blaudirekt.de/pressemitteilung/mit-dem-ameise-copilot-startet-das-neue-betriebssystem-fuer-den-maklermarkt/)). Mit QuickJump springt man aus dem Vertrag ohne erneuten Login ins Versichererportal ([Cash](https://www.cash-online.de/a/blau-direkt-direkter-zugriff-auf-versichererportale-aus-dem-mvp-716941/)).
- **simplr**: Kunden-App und Web-App ([blaudirekt.de/kunden-app](https://www.blaudirekt.de/kunden-app/)).
- **Qonekto**: Datenaustausch-Software, die AMEISE mit anderen Systemen verbindet ([qonekto.de](https://www.qonekto.de/), [Launch-Blog 10/2024](https://www.blaudirekt.de/blog/2024/10/blau-direkt-bietet-maklern-mit-dem-launch-von-qonekto-ein-neues-level-an-konnektivitaet/)).
- „**Allesmeins**“ gehört **nicht** zu blau direkt, sondern zu JDC (siehe A2).

**simplr – Funktionen (laut Hersteller- und Maklerseiten):**
- Vertragsübersicht, die über die AMEISE-Verknüpfung aktuell gehalten wird ([blaudirekt.de/kunden-app](https://www.blaudirekt.de/kunden-app/)). Die Bestandsdaten pflegt blau direkt über BiPRO-Anbindungen mit über 240 Gesellschaften (Angabe aus Suchauszug der Konnektivitätsseite [blaudirekt.de/konnektivitaet](https://www.blaudirekt.de/konnektivitaet/)).
- Dokumente je Vertrag (Beitragsrechnungen, Policen, Schadenmeldungen). Dokumente werden automatisch den Verträgen zugeordnet. Kunden können Fremdverträge per Foto erfassen und eigene Dokumente wie Vollmachten oder Ausweiskopien ablegen ([Cash](https://www.cash-online.de/a/blau-direkt-app-simplr-ohne-maklermandat-315003/), [plan-v.de](https://www.plan-v.de/versicherungsmakler-app-simplr/), [rs-maklerkontor.de](https://rs-maklerkontor.de/funktionsweise/)).
- Schadenmeldung über einen „Schaden melden“-Button je Vertrag, der zu den Online-Formularen der Versicherer führt. Die Versicherungsnummer wird automatisch übergeben ([rs-maklerkontor.de](https://rs-maklerkontor.de/funktionsweise/), [blau direkt PM](https://www.blaudirekt.de/pressemitteilung/kunden-app-simplr-feiert-eine-halbe-millionen-downloads/)).
- Adress- und Bankänderungen gehen gesammelt an alle Versicherer ([Cash](https://www.cash-online.de/a/blau-direkt-app-simplr-ohne-maklermandat-315003/)).
- Relaunch 2023: neues Design, Dokumentengenerator für Anträge und Rückfragen, Teilen von Dokumenten, neue Kontoverwaltung, neuer Upload, Umstellung der Konten auf OAuth ([blau direkt Blog 02/2023](https://www.blaudirekt.de/blog/2023/02/das-grosse-simplr-update/), [bocquel-news](https://www.bocquel-news.de/Blau-direkt-mit-neuer-simplr-Version-auf-dem-Markt.43019.php)).
- Die Web-App gibt es seit Herbst 2024 mit gleichen Funktionen. Makler werden benachrichtigt, wenn Kunden etwas hochladen, und können Dokumente für Kunden freigeben ([blau direkt Blog 12/2024](https://www.blaudirekt.de/blog/2024/12/simplr-web-appflexibilitaet-und-komfort-fuer-makler-und-kunden/)). Dark Mode und eine englische Version laut Maklerblog ([marco-mahling.de](https://www.marco-mahling.de/blog/ein-neues-update-unserer-kunden-app-simplr/)).
- **Chat:** Ein Makler nennt einen „Beraterchat“. Der App-Store-Text spricht nur von „Kontakt zum Berater“. **Nicht verifiziert**, ob es einen echten In-App-Chat gibt ([plan-v.de](https://www.plan-v.de/versicherungsmakler-app-simplr/)).
- **Vergleichsrechner:** 36+ Sparten laut Lizenzseite ([blaudirekt.de/lizenzen](https://www.blaudirekt.de/lizenzen/)). Ein Makler nennt über 40 Rechner in simplr.
- **Branding:** Makler können ihr Bild, Logo, Firmennamen und Kontaktdaten einbinden. Das blau-direkt-Logo bleibt laut Produktseite sichtbar. Ein vollständiges White-Label ist **nicht belegt** ([blaudirekt.de/kunden-app](https://www.blaudirekt.de/kunden-app/)).
- **Onboarding:** Kunden können ohne Maklermandat starten und tragen ihre Daten dann selbst ein. Mit Mandat übernimmt der Makler die Pflege ([Cash](https://www.cash-online.de/a/blau-direkt-app-simplr-ohne-maklermandat-315003/)). Es gibt ein personalisierbares **Registrierungsformular für die eigene Website**: Der Kunde erhält automatisch Zugangsdaten und Erstinformation per Mail und wird in AMEISE angelegt (Maklerseite [digitalmakler.online](https://digitalmakler.online/simplr/app-login/), [Finanzberatung Bierl](https://www.finanzberatung-bierl.de/blog/artikel/endlich-umfangreiches-update-der-simplr-web-version/)).
- **Web-Login:** `login.simplr.de`. Makler verlinken ihn als Button ([wifix.de](https://wifix.de/simplr-login), [maklermitfliege.de](https://www.maklermitfliege.de/simplr-benutzernamen-vergessen.html)).

**Kosten für Makler (offizielle Lizenzseite, netto):** Starter 199 €/Monat (bis ca. 100.000 € Jahresumsatz), X-Partner 499 €/Monat, Enterprise 998 €/Monat (ab ca. 200.000 € Umsatz und mehr als 5 Mitarbeitern). simplr ist in allen Lizenzen ohne Zusatzkosten enthalten. Die Seite zeigt außerdem „12 Monate kostenfrei“, ob das eine Dauer- oder Aktionsregel ist, ist unklar ([blaudirekt.de/lizenzen](https://www.blaudirekt.de/lizenzen/)). Eine Aufnahmegebühr wird erwähnt, ein offizieller Betrag fehlt ([wiemakler.de](https://www.wiemakler.de/magazin/blau-direkt-nutzen/), [insuro.de](https://insuro.de/warum-die-kooperation-mit-blau)).

**Schnittstellen (siehe Abschnitt 5):** AMEISE-APIs, Webhooks und dailyUP im Enterprise-Paket. Webservice-Anbindung eigener Systeme auf Anfrage ([blaudirekt.de/lizenzen](https://www.blaudirekt.de/lizenzen/), [blaudirekt.de/produkte/api-entwickler](https://www.blaudirekt.de/produkte/api-entwickler/)). Qonekto ONE für Make.com, Zapier „demnächst“ (Stand 2024) ([qonekto.de/qonekto-lizenzpreise](https://www.qonekto.de/qonekto-lizenzpreise/), [finanzwelt](https://www.finanzwelt.de/post/blau-direkt-neues-level-der-konnektivitaet)). Die Terminbuchung meetergo hat eine fertige AMEISE-Integration ([help.meetergo.com](https://help.meetergo.com/de/integrations/crm/ameise-integration/)).

**Bewertung:** *Gut:* Bestand automatisch aktuell, Schadenmeldung, Sammeländerungen, Web und App, kostenlos für Kunden. *Schwach bzw. unbekannt:* Pool-Branding bleibt sichtbar, keine Investment- oder Finanzplanungs-Ebene, keine Begründungen, keine Kostentransparenz und API-Zugriff erst im teuersten Paket.

### A2 Andere Pools und MVPs mit Kundenportal

| Anbieter | Befund | Quelle |
|---|---|---|
| **Fonds Finanz** – „MeineVersicherungen-App“ (früher „Meine FinanzApp“, 2016) | Zeigt Verträge mit Maklermandat, die über Fonds Finanz eingereicht wurden, plus selbst hinzugefügte Verträge. Den Login richtet der Makler ein. Gebaut von Softfair GmbH. Die Umbenennung stützt sich nur auf eine Drittquelle, die Datenschutzseite bestätigt Betreiber und Funktion. | [meineversicherungen-app.de Datenschutz](https://www.meineversicherungen-app.de/app-rechtliches/datenschutz/makler), [hash.de](https://www.hash.de/fonds-finanz-login/), [AssCompact 2016](https://www.asscompact.de/nachrichten/fonds-finanz-startet-neue-kunden-app-f%C3%BCr-makler) |
| **Netfonds** – finfire „Mandantenportal“ | Gesamtübersicht über Depots, Konten, Verträge und Versicherungen, verschlüsseltes Postfach, eSignatur, 2FA. „finfire direct“ für Partner mit digitalem Onboarding für Vermögensverwaltung und API (Artikel ca. 8 Jahre alt). Stärkster Pool-Kandidat für Investment-Kunden. | [finfire.de](https://finfire.de/), [Netfonds eSignatur-Broschüre](https://www.netfonds.de/fileadmin/Die_Netfonds_Gruppe/News/Blog/2024/finfire/finfire_e-signatur-broschuere.pdf), [PROfinance](https://www.profinance.de/ueberuns/profinance-kundenportal/) |
| **JDC (Jung, DMS & Cie.)** – „allesmeins“ | 2016 gestartet mit Vertragsübersicht, Dokumenten, Verträge hinzufügen, Schadenmeldung und App-Chat mit dem Berater. Bestandsübertragungen stößt der Kunde per digitaler Unterschrift an. Die Web-App unter finanzapp.allesmeins.de ist laut Suchindex noch erreichbar, Funktionsstand 2026 **nicht verifiziert**. | [Cash](https://www.cash-online.de/a/jdc-app-allesmeins-ist-gestartet-307264/), [JDC PM 2016](https://www.jungdms.de/wp-content/uploads/2022/12/PM_20160223_JDC_App_allesmeins_ab_sofort_im_App_Store.pdf), [Versicherungsbote](https://www.versicherungsbote.de/id/4837904/Maklerpool-Jung-DMS-Cie-App/) |
| **Professional works** (DEMV) | Cloud-MVP. Eine eigene Endkunden-App habe ich nicht gefunden. | [meetergo Integration](https://meetergo.com/integrationen/professional-works) |
| **Assfinet** (ams.5) | MVP. Für Endkunden wurde die Drittanbieter-App **Finance-Gate** angebunden, eine eigene Assfinet-Kunden-App habe ich nicht gefunden. | [Cash](https://www.cash-online.de/a/finance-gate-ergaenzt-bestandsverwaltung-von-assfinet-486807/) |
| **Smart InsurTech** – SMART ADMIN | MVP für Vertriebe ab ca. 6 Mitarbeitern. Kunden können Policen während einer Online-Beratung fotografieren. Ein eigenes Kundenportal habe ich nicht gefunden, Kundenportal-Projekte laufen über Finance-Gate (Siemens SPF-Gate). | [softguide.de](https://www.softguide.de/programm/smart-admin-finanzoffice), [Cash](https://www.cash-online.de/a/siemens-private-finance-kooperiert-mit-smart-insurtech-und-finance-gate-491892/) |
| **Thinksurance** | B2B-Beratungsplattform mit über 50.000 Vermittlern (2023) für Bedarfsanalyse, Tarifvergleich, Antrag und Beratungsdokumentation. Das einzige Endkunden-Element ist „Risikoerfassung@Home“ (Fragebogen per E-Mail, 4 Schritte, bei OVB). | [Cash (OVB)](https://www.cash-online.de/a/digitale-beratung-von-gewerbekunden-ovb-setzt-auf-thinksurance-561070/), [Cash (MLP)](https://www.cash-online.de/a/mlp-geht-partnerschaft-mit-thinksurance-ein-674732/) |
| **Policen Direkt** | Betreibt laut Stellenanzeige (2020) einen „digitalen Versicherungsmanager“. Funktionen **nicht verifiziert**. | [Versicherungsbote Job 2020](https://www.versicherungsbote.de/job/4889136/) |
| **xbAV** | Nicht recherchiert (bAV-Spezialfall, für den Kundenbereich nachrangig). | – |

### A3 Digitale Makler und Versicherer

- **Clark:** digitaler Versicherungsordner mit Beiträgen, Kündigungsfristen und Versicherungsnummern, Bedarfsanalyse, Vergleich mit über 160 Versicherern und Experten per Chat, Telefon oder E-Mail. Onboarding über Registrierung, digitales Maklermandat und Upload ([KfW Story](https://www.kfw.de/stories/wirtschaft/innovation/digitaler-versicherungsmakler-clark/), [versicherungenmitkopf.de](https://www.versicherungenmitkopf.de/versicherungs-app/clark-versicherungs-app)). *Schlecht:* Im Finanztest-Test von 2023 war keine Makler-App „gut“, eine war „mangelhaft“, die Beratung war durchwachsen ([test.de](https://www.test.de/Versicherung-Knip-Clark-Co-was-taugen-Makler-Apps-5227792-0/), [Versicherungsbote](https://www.versicherungsbote.de/id/4912720/Check24-Clark-und-Co-Finanztest-rat-von-Makler-Apps-ab/)). Es gab Fälle, in denen fremde Daten angezeigt wurden ([test.de](https://www.test.de/Versicherungs-App-Wenn-die-Clark-App-fremde-Daten-anzeigt-5717856-0/)). Lehre: Mandantentrennung (RLS) testen.
- **Check24 Versicherungscenter:** Wechselfristen, Dokumente und Leistungen an einem Ort. Beratung per Telefon, Chat und E-Mail an 7 Tagen. **Fremdverträge** gehen ohne Mandat (nur Einschätzung) oder mit Einzelmandat ohne Kündigungsbefugnis ([Check24 PM 2023](https://www.check24.de/files/p/2023/a/2/f/18658-2023_04_21_check24_pm_dtgv_versicherungscenter.pdf), [Check24 AGB](https://www.check24.de/vp-vers/agb/)). *Gut:* transparente Wahl des Mandatsumfangs, die Idee kann man übernehmen.
- **Getsafe:** Schadenmeldung per Chatbot „Carla“ in der App, einfache Fälle entscheidet die KI laut Anbieter. Trustpilot 4,5. Kritik richtet sich an die Schadenregulierung, nicht an die Bedienung ([it-finanzmagazin](https://www.it-finanzmagazin.de/getsafe-schaden-chatbot-87215/), [Trustpilot](https://de.trustpilot.com/review/getsafe.de), [erfahrungenscout](https://erfahrungenscout.de/versicherung/getsafe-bewertungen)).
- **Friday, wefox, Verivox:** nicht vertieft recherchiert.

### A4 Robo-Advisor und evidenzbasierte Vermögensverwalter

- **Gerd Kommer Capital (GKC):** Servicegebühr 0,70 % (bis 100.000 €), 0,65 % (bis 250.000 €), 0,60 % (darüber) plus ETF-Kosten von ca. 0,20 % ([extraETF](https://extraetf.com/de/robo-advisor/gerd-kommer-capital-test), [geldanlage-digital](https://geldanlage-digital.de/robo-advisor/gerd-kommer-capital/)). **Seit 2026 läuft der Zugang über Scalable Capital.** Laut Migrationsanleitung in 4 Schritten: Registrierung, Portfolio eröffnen, Übertrag beauftragen, Verifizierung. Restdepots wurden nach dem 27.05.2026 aufgelöst ([GKC Migrationsanleitung PDF](https://gerd-kommer.de/medien/GKC-Migration-Anleitung-fuer-Scalable-Neukunden.pdf), [test.de](https://www.test.de/Neues-Depotangebot-Scalable-Capital-zieht-mit-seinen-Kunden-um-6183743-0/)). Transparenz: Die Methodik ist im **Weltportfolio-Whitepaper** offengelegt ([Whitepaper PDF](https://gerd-kommer.de/medien/Gerd-Kommer-Whitepaper-V1.0_EN.pdf)). *Vorbild für Marvin:* Methodik öffentlich erklären statt Marketing.
- **Quirion:** Finanztest-Sieger 2018 und 07/2021 (Note 1,6). Servicegebühr laut Vergleichsseite 0,48 %. Ein Nutzer kritisierte 2021 den geringen Informationsgehalt der App, etwa dass die eingezahlte Summe nicht sichtbar war ([wiwo](https://www.wiwo.de/vergleich/quirion-test/), [finanzwissen.de](https://finanzwissen.de/vergleich/robo-advisor/), [extraETF Erfahrungen](https://extraetf.com/de/erfahrungen/robo-adviser/quirion)). Lehre: **Eingezahlt vs. Wert vs. Rendite p. a.** immer zeigen.
- **Scalable Wealth:** Servicegebühr 0,75 % plus ETF-Kosten von ca. 0,16 % laut Finanzfluss ([finanzfluss.de](https://www.finanzfluss.de/vergleich/robo-advisor/)). Kundenbereich nicht separat geprüft.
- **Growney:** 0,25–0,68 % Servicegebühr, Depot bei der Sutor Bank, Finanztest 07/2021 „sehr gut“. Laut extraETF keine App in den Stores (Datum unklar) ([extraETF](https://extraetf.com/de/robo-advisor/growney-test)).
- **Ginmon:** App mit dem Umfang der Web-Oberfläche: Depotstand, Performance, Ein- und Auszahlungen, Dokumente, Freistellungsaufträge ([Ginmon Hilfe](https://help.ginmon.de/en/articles/117-what-functionalities-does-the-ginmon-app-offer)). Steueroptimierung nutzt zum Jahresende den Sparerpauschbetrag ([biallo](https://www.biallo.de/robo-advisor/ginmon/steuern-sparen)). Kosten ca. 0,75 % plus ETF-Kosten ([reisetopia](https://reisetopia.de/geldanlage/ginmon-robo-advisor/)).
- **Evergreen:** 0 % Servicegebühr, aber Fondskosten von 0,21–0,79 % (Marketing „gebührenfrei“ vs. Gesamtkosten). Unterdepots als „Pockets“, Face ID, tägliche Information über Bestandteile. Kritik von Nutzern: Depotstand umständlich zu erreichen, Vollmachten per Post ([extraETF](https://extraetf.com/robo-advisor/evergreen-test), [erfahrungenscout](https://erfahrungenscout.de/energie/evergreen-bewertungen)). Lehre: **Gesamtkosten statt Teilkosten** kommunizieren.
- **Whitebox:** weiterhin aktiv, auch als „flatex wealth powered by WHITEBOX“ ([broker-test.at](https://www.broker-test.at/news/whitebox-flatex-digitale-vermoegensverwaltung-fuer-flatex-und-degiro/), [etf-nachrichten](https://www.etf-nachrichten.de/robo-advisor/whitebox/)).
- **Visualvest, Oskar, Liqid:** werden in Rankings 2026 genannt (finanzen.net nennt Oskar Testsieger, etf.capital Liqid), nicht vertieft ([finanzen.net](https://www.finanzen.net/ratgeber/rechner-vergleiche/robo-advisor-vergleich/), [etf.capital](https://etf.capital/robo-advisor-im-vergleich/)).
- **Finanzfluss Copilot:** Vermögens-Tracker (Finflow GmbH) mit Anbindung an über 350 Banken und Broker (nur lesend), Haushaltsbuch, Portfolio-Analyse. Plus kostet 69,99 €/Jahr bzw. 8,99 €/Monat (iOS). App Store 4,4 Sterne. Häufigste Kritik: unvollständige oder doppelte Importe ([App Store](https://apps.apple.com/DE/app/id6482296545), [Finanzfluss Hilfe](https://www.finanzfluss.de/copilot/hilfe/probeabonnement/), [reisetopia](https://reisetopia.de/?p=509581)). *Vorbild:* Vermögensübersicht über alle Banken. *Achtung:* Wer eine Kontoanbindung selbst baut, braucht einen regulierten Kontoinformationsdienst als Partner.

### A5 Große Vertriebe und Honorarberater in Deutschland

- **DVAG „MeineApp“:** Kontakt per Telefon, E-Mail oder SMS, **Terminvereinbarung**, Karte mit Route zum Büro. Verschlüsselter Empfang von Anträgen und Post, **sicherer Kanal für Kundenuploads** (Gehaltsnachweise, Renteninformation), Kontenübersicht, Altersvorsorge- und Sachverträge, **Familienfreigabe**, Kfz-Bestätigung, Schadenmeldung, Notfallguide. Den Funktionsumfang bestimmt der Berater mit. Einen Chat für Kunden habe ich nicht gefunden ([App Store](https://apps.apple.com/app/id1152836376)).
- **MLP „Financial Home“** (früher Kundenportal) plus MLP Banking: Vermögens- und Vertragsübersicht, eigene Werte erfassen, **Postbox mit Nachrichten des Beraters**, Login mit Kundennummer oder Alias und PIN, Terminbuchung über die Portalseite ([mlp.de Kundenportal](https://mlp.de/service/kundenportal/), [MLP Übersicht PDF](https://www.mlp.de:443/redaktion/downloads/kundeninformation/ueberblick-mlp-banking-und-mlp-financial-home.pdf), [Postfach vs. Postbox PDF](https://www.mlp.de:443/redaktion/downloads/kundeninformation/anleitung-postfach-vs-postbox.pdf)).
- **Swiss Life Select (DE):** App „mySwissLifeSelect“ mit über 35.000 Downloads im ersten Jahr (2020). Die Erstanmeldung läuft nur über den Berater, die App ergänzt die Beratung ([experten.de 2020](https://www.experten.de/id/4920376/kundennaehe-schaffen-trotz-distanz/index.pdf)). Das Schweizer Portal nutzt 2FA, Authenticator-App sowie SwissID, Microsoft und Google ([swisslife.ch](https://www.swisslife.ch/de/kundenportale.html)).
- **OVB:** Eine Endkunden-App habe ich nicht gefunden, nur Berater-Tools ([experten.de](https://www.experten.de/id/4944630/smart-insurtech-entwickelt-app-fuer-ovb-vermoegensberatung/index.pdf)).
- **Honorarberater und unabhängige Planer mit Portal (Beispiele):**
  - **Sincereo / Honorarfinanz (Saarland):** exklusives, kostenloses Kundenportal „powered by wealthpilot“ mit Übersichten zu Depots, Immobilien, Planung und Dokumenten ([honorarfinanz-saar.de](https://www.honorarfinanz-saar.de/)).
  - **finsparent:** Honorarberatung nach §34h und §34d Abs. 2, vollständig digital, kostenloses Online-Erstgespräch ([finsparent.de](https://finsparent.de/)).
  - **PlanInvest (München):** provisionsfreie Planung und ETF-Strategien bundesweit per Video ([plan-invest.org](https://www.plan-invest.org/)).
  - **rheinplan:** Honorarberatung ([rheinplan.finance](https://www.rheinplan.finance/unabhaengige-finanzberatung/)).
  - **VDH-Online-Finanzplanung:** im eigenen Branding auf der Berater-Website einbettbar, der Plan ist 365 Tage online, **der Kunde entscheidet, welche Daten der Berater sieht** ([VDH](https://www.verbund-deutscher-honorarberater.de/honorarberater-magazin/honorarberater/news/online-finanzplanung-hand-in-hand-zwischen-berater-und-mandanttx_news_pi1controllernewstx_news_pi1actionchash1c5ad840ff842bb0d5e0953)).
  - **wealthpilot** (White-Label-Plattform, seit 12/2025 Teil der Finaplus-Gruppe): Konten, Depots, Lebensversicherungen und Immobilien in einem Dashboard, Monte-Carlo-Portfolio-Optimierer, Speicherung im DATEV-Rechenzentrum, Preise nur auf Anfrage ([Munich Startup](https://www.munich-startup.de/news/wealthpilot-fusioniert-mit-finaplus), [DAS INVESTMENT](https://www.dasinvestment.com/wealthpilot-chef-marco-richter-das-bringt-dem-berater-70-prozent-zeitersparnis/?page=2), [Capterra](https://www.capterra.in/software/219610/wealthpilot)). *Mögliche Alternative zum Selbstbau der Vermögensübersicht.*

### A6 Internationale Vorbilder

- **Betterment:** Investieren nach Zielen (Ruhestand, Notgroschen, Haus), die Allokation folgt aus Anlagehorizont und Risiko. Digital 0,25 %, Premium mit menschlichen Beratern (Angaben schwanken zwischen 0,40 % und 0,65 %) ([NerdWallet](https://www.nerdwallet.com/investing/learn/betterment-vs-wealthfront), [AOL](https://www.aol.com/finance/betterment-vs-wealthfront-choosing-best-174208939.html)).
- **Wealthfront:** Planungstool „Path“ mit Szenarien für Ruhestand, Rentenzeitpunkt und Studium in Echtzeit, Tax-Loss-Harvesting ([walnutinvest – Wettbewerber, daher nicht neutral](https://walnutinvest.com/resources/wealthfront-review), [NerdWallet](https://www.nerdwallet.com/investing/learn/betterment-vs-wealthfront)).
- **Vanguard Personal Advisor:** netto ca. 0,30 %, Staffel bis 0,05 % ab 25 Mio. $, Beratung per Telefon, E-Mail und Video, keine eigene App ([Vanguard FAQ](https://ownyourfuture.vanguard.com/content/en/advice/personal-advisor/faq.html), [SmartAsset](https://smartasset.com:443/financial-advisor/vanguard-personal-advisor-services-review)).
- **Facet:** Flat-Fee-Mitgliedschaft (1.000–6.000 $/Jahr laut Facet), keine Mindestanlage, kostenloses Erstgespräch, persönliche Roadmap, Dashboard mit Zielfortschritt, seit 09/2025 Steuererklärung inklusive ([facet.com](https://facet.com/flat-fee-financial-planning/), [BusinessWire](https://www.businesswire.com/news/home/20250925121828/en)).
- **Range:** Flat-Fee-Stufen, KI-Assistent „Rai“ plus CFP-Berater, verbundene Konten, Vermögensverwaltung über Altruist ([range.com/pricing](https://www.range.com/pricing), [Finder](https://www.finder.com/investments/range-review)).
- **eMoney Advisor:** Client Portal mit **Vault** (geteilte und private Ordner, Benachrichtigung bei neuen Dokumenten, Berater legt Reports ab), Kontenaggregation, Ziele, Screen-Sharing ([eMoney Blog](https://emoneyadvisor.com/blog/product_info/emoney-client-portal-be-the-center-of-your-clients-financial-world), [Developer Vault](https://developer.emoneyadvisor.com/usecase/upload-documents-emoney-vault-0)).
- **RightCapital:** Einladung per Mail. Der Berater steuert, welche Module der Kunde sieht und ob er Eingaben ändern darf, sodass der Kunde Gehalt und Ausgaben selbst pflegen kann. Vault, MFA, Login-Statistik für den Berater, App mit eigenem Branding ([RightCapital Blog](https://www.rightcapital.com/blog/client-portal), [Hilfe](https://help.rightcapital.com/article/40-inviting-a-client)).
- **Wealthbox / Redtail:** Wealthbox ist ein CRM, ein eigenes Kundenportal habe ich nicht gefunden. Die Kundenseite läuft über Wealth.com ([Wealthbox Hilfe](https://help.wealthbox.com/hc/en-us/articles/29980339724315-How-do-I-enable-the-Wealth-com-integration)). Redtail nicht recherchiert.
- **Nutmeg (UK):** zeigt **Kosten in Pfund und Prozent** in der App. Die FCA nannte das als Beispiel ([nutmeg.com/our-fee](https://www.nutmeg.com/our-fee), [Investment Week](https://investmentweek.co.uk/investment-week/news/2414893/fca-firms-heed-nutmegs-fee-transparency)).
- **Moneyfarm:** **In-App-Chat**, „Private Mode“ (blendet Summen aus, Performance bleibt sichtbar), transparentes „Asset Allocation Wheel“ bis auf Fondsebene ([Moneyfarm Blog](https://blog.moneyfarm.com/en/moneyfarm-news/tech-update-in-app-chat-private-mode-and-more/), [Finder](https://www.finder.com/uk/moneyfarm-review)).

### A7 Kontext: Altersvorsorgedepot (Reform der privaten Altersvorsorge)

- **Beschlossen:** Bundestag am 27.03.2026 ([bundestag.de](https://www.bundestag.de/dokumente/textarchiv/2026/kw13-de-altersvorsorge-1156798)), Bundesrat am 08.05.2026, verkündet im **BGBl. I 2026 Nr. 156** am 29.05.2026 ([Haufe](https://www.haufe.de/steuern/gesetzgebung-politik/altersvorsorgereformgesetz_168_668868.html), [hksteuerberatung](https://www.hksteuerberatung.de/2026/05/15/altersvorsorgereformgesetz-verabschiedet/)). **Start der Förderung am 01.01.2027.**
- **Zulagen** laut Sekundärquellen: 50 Cent je Euro auf die ersten 360 € Eigenbeitrag, 25 Cent je Euro bis 1.800 €. Kinderzulage 1 € je Euro, maximal 300 €. Einzahlungen bis 6.840 € pro Jahr, der Teil über 1.800 € ist ungefördert, wächst aber steuerfrei ([finanzfacts](https://finanzfacts.de/wiki/altersvorsorgedepot/aktueller-stand/), [ING](https://www.ing.de/wissen/altersvorsorgedepot/)). Riester-Verträge haben Bestandsschutz, ein Übertrag ist ab 2027 möglich (unumkehrbar).
- **Standarddepot:** Pflichtangebot mit zwei vorausgewählten Fonds, Kostendeckel **1,0 % Effektivkosten**. Der Entwurf sah 1,5 % vor ([Haufe](https://www.haufe.de/steuern/gesetzgebung-politik/altersvorsorgereformgesetz_168_668868.html)). Abschlusskosten müssen über die Laufzeit verteilt werden. Für Vermittler ist strittig, wie sich das auf die Vergütung auswirkt ([Versicherungsbote](https://www.versicherungsbote.de/id/4951124/Das-Altersvorsorgedepot-wird-zum-Transparenztest-fuer-uns-Makler/), [Versicherungsbote](https://www.versicherungsbote.de/id/4949057/Altersvorsorgereform-Vertrieb-wird-strukturell-verhindert/)).
- **Nicht verifiziert:** Wortlaut im BGBl., Vergütungsregeln für §34f-Vermittler, Verordnungen zur Kostendarstellung. **Frühstart-Rente:** separates Gesetz, Kabinettsbeschluss am 12.08.2026, 1. Lesung für den 25.09.2026 geplant, noch **nicht beschlossen** ([finanzfacts](https://finanzfacts.de/wiki/altersvorsorgedepot/aktueller-stand/)).

---

<a id="matrix"></a>
## 3. Vergleichsmatrix

Legende: ✓ vorhanden · teilweise · ✗ nicht vorhanden · unbekannt = nicht belegt bzw. nicht einsehbar. Design-Spalten sind fast überall „unbekannt“, weil ich keine Screenshots ansehen konnte (siehe Methodik).

| Anbieter | Vertragsübersicht | Dokumente | Upload | Chat/Nachrichten | Terminbuchung | Begründung/„Warum“ | Kostentransparenz | Rechner | Onboarding digital | Design mobil | Design desktop | öffentlich/Login |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| blau direkt simplr | ✓ | ✓ | ✓ | teilweise (nicht verifiziert) | unbekannt | ✗ | ✗ | ✓ (Vergleichsrechner) | ✓ (Formular, Mandat) | unbekannt | unbekannt | Login (Web und App) |
| Fonds Finanz MeineVersicherungen | ✓ | ✓ | teilweise | unbekannt | unbekannt | ✗ | unbekannt | teilweise (2016) | teilweise (Login vom Makler) | unbekannt | unbekannt | Login |
| Netfonds finfire Mandantenportal | ✓ (Depot und Versicherung) | ✓ | unbekannt | ✓ (verschlüsseltes Postfach) | unbekannt | unbekannt | teilweise (Depotanalyse) | unbekannt | ✓ (eSignatur) | unbekannt | unbekannt | Login (2FA) |
| JDC allesmeins | ✓ | ✓ | ✓ | ✓ (App-Chat 2016) | unbekannt | ✗ | unbekannt | unbekannt | ✓ (digitale Bestandsübertragung) | unbekannt | unbekannt | Login |
| Professional works / Assfinet / Smart Admin | ✗ (MVP, Kundenseite über Dritte) | – | – | – | – | – | – | – | – | – | – | – |
| Thinksurance | ✗ | ✗ | ✗ | ✗ | ✗ | teilweise (Beratungsdoku) | ✗ | ✓ (Tarifrechner) | teilweise (Risikoerfassung@Home) | unbekannt | unbekannt | B2B |
| Clark | ✓ | ✓ | ✓ | ✓ | unbekannt | teilweise (Bedarfsanalyse) | ✗ | teilweise | ✓ | unbekannt | unbekannt | Login |
| Check24 Versicherungscenter | ✓ | ✓ | ✓ | ✓ | unbekannt | teilweise (Einschätzung) | teilweise (Preisvergleich) | ✓ | ✓ | unbekannt | unbekannt | Login |
| Getsafe | ✓ (eigene Policen) | teilweise | ✓ | ✓ (Chatbot) | ✗ | ✗ | teilweise | ✗ | ✓ | unbekannt (Nutzer loben die App) | unbekannt | Login |
| Gerd Kommer Capital (über Scalable) | ✓ (Depot) | unbekannt | ✗ | unbekannt | unbekannt | ✓ (Whitepaper, öffentlich) | ✓ (Staffel öffentlich) | unbekannt | ✓ | unbekannt | unbekannt | öffentlich und Login |
| Quirion | ✓ (Depot) | unbekannt | ✗ | unbekannt | unbekannt | unbekannt | ✓ (öffentlich) | unbekannt | ✓ | teilweise (Kritik 2021) | unbekannt | Login |
| Scalable Wealth | ✓ (Depot) | unbekannt | ✗ | unbekannt | unbekannt | unbekannt | ✓ (öffentlich) | unbekannt | ✓ | unbekannt | unbekannt | Login |
| Growney | ✓ (Depot) | unbekannt | ✗ | unbekannt | unbekannt | unbekannt | ✓ | unbekannt | ✓ | teilweise (laut extraETF keine Store-App) | unbekannt | Login |
| Ginmon | ✓ (Depot, Performance) | ✓ | ✗ | unbekannt | unbekannt | teilweise (Steuerlogik) | ✓ | unbekannt | ✓ | unbekannt | unbekannt | Login |
| Evergreen | ✓ (Pockets) | unbekannt | ✗ | unbekannt | unbekannt | teilweise (tägliche Bestandteile) | teilweise (0 % Service, Fondskosten) | unbekannt | teilweise (Vollmachten per Post) | teilweise (Nutzerkritik) | unbekannt | Login |
| Finanzfluss Copilot | ✓ (Konten, Depots, aggregiert) | ✗ | teilweise (Import) | ✗ | ✗ | ✗ | teilweise (Analyse in Plus) | unbekannt | ✓ (Bankanbindung) | unbekannt (4,4 Sterne) | unbekannt | Login |
| DVAG MeineApp | teilweise | ✓ (verschlüsselt) | ✓ (sicherer Kanal) | ✗ (Telefon, Mail, SMS) | ✓ | ✗ | unbekannt | unbekannt | teilweise | unbekannt | unbekannt | Login |
| MLP Financial Home | ✓ | ✓ (Postbox) | unbekannt | ✓ (Nachrichten in der Postbox) | teilweise | ✗ | unbekannt | unbekannt | teilweise (Zugang über Berater) | unbekannt | unbekannt | Login |
| Swiss Life Select (mySwissLifeSelect) | unbekannt | unbekannt | unbekannt | unbekannt | unbekannt | unbekannt | unbekannt | unbekannt | ✗ (Erstlogin über Berater) | unbekannt | unbekannt | Login |
| OVB | ✗ (nicht gefunden) | – | – | – | – | – | – | – | – | – | – | – |
| Sincereo/Honorarfinanz (wealthpilot) | ✓ (Depot, Immobilien) | ✓ | unbekannt | unbekannt | unbekannt | teilweise (Planung) | teilweise (Honorar) | ✓ (Planung) | unbekannt | unbekannt | unbekannt | öffentlich und Login |
| VDH-Online-Finanzplanung | teilweise | unbekannt | ✓ (Kunde pflegt Daten) | unbekannt | unbekannt | teilweise (Plan) | unbekannt | ✓ | ✓ | unbekannt | unbekannt | Login (White-Label) |
| Betterment | ✓ (Konten) | unbekannt | ✗ | teilweise (Premium-Berater) | teilweise (Premium) | ✓ (zielbasiert) | ✓ | ✓ | ✓ | unbekannt | unbekannt | Login |
| Wealthfront | ✓ | unbekannt | ✗ | ✗ | ✗ | teilweise | ✓ | ✓ (Path) | ✓ | unbekannt | unbekannt | Login |
| Vanguard Personal Advisor | ✓ | unbekannt | unbekannt | teilweise (Telefon, Mail, Video) | ✓ | ✓ (Plan) | ✓ | unbekannt | ✓ | ✗ (keine eigene App) | unbekannt | Login |
| Facet | ✓ (Dashboard) | unbekannt | unbekannt | ✓ (Planer) | ✓ (Erstgespräch) | ✓ (Roadmap) | ✓ (Flat Fee) | unbekannt | ✓ | unbekannt | unbekannt | Login |
| Range | ✓ (aggregiert) | unbekannt | unbekannt | ✓ (KI und CFP) | unbekannt | teilweise | ✓ (Flat Fee) | ✓ | ✓ | unbekannt | unbekannt | Login |
| eMoney Advisor (Portal) | ✓ (Aggregation) | ✓ (Vault) | ✓ | teilweise (Screen-Sharing) | unbekannt | ✓ (Reports) | unbekannt | ✓ (Ziele) | teilweise | unbekannt | unbekannt | Login (White-Label) |
| RightCapital (Portal) | ✓ | ✓ (Vault) | ✓ | unbekannt | unbekannt | ✓ (Plan-Module) | unbekannt | ✓ | ✓ (Einladung) | unbekannt | unbekannt | Login (eigenes Branding) |
| Nutmeg | ✓ | unbekannt | ✗ | unbekannt | unbekannt | teilweise | ✓ (£ und %) | unbekannt | ✓ | unbekannt | unbekannt | Login |
| Moneyfarm | ✓ | unbekannt | ✗ | ✓ (In-App-Chat) | unbekannt | ✓ (Allocation Wheel) | teilweise | unbekannt | ✓ (unter 7 Minuten, 2016) | unbekannt | unbekannt | Login |

---

<a id="top10"></a>
## 4. Top 10 Ideen für Marvins Portal

1. **Kosten-Cockpit in Euro.** Für jedes Depot und jeden Investment- oder Vorsorgevertrag die laufenden Gesamtkosten in Euro und Prozent zeigen (Produkt-, Service- und Vermittlungskosten), dazu „Was würde dich das in 20 Jahren kosten?“. Das erfüllt nebenbei die jährliche Ex-post-Kosteninformation nach §13 Abs. 5 FinVermV und macht sie zum Verkaufsargument. *Vorbild:* Nutmeg zeigt Kosten in £ und % ([nutmeg.com/our-fee](https://www.nutmeg.com/our-fee)). Evergreen zeigt als Gegenbeispiel, wie „0 % Gebühr“ trotz Fondskosten von 0,21–0,79 % irreführend wirken kann ([extraETF](https://extraetf.com/robo-advisor/evergreen-test)).
2. **„Warum“-Karte zu jeder Empfehlung.** Jede Empfehlung bekommt eine kurze Begründung, verworfene Alternativen, die zugrunde liegende Evidenz (SPIVA, Fama-French, eigene Annahmen) und die Risiken. Das ist rechtlich ohnehin Pflicht: Nach §61 VVG müssen „die Gründe für jeden erteilten Rat“ angegeben werden, und nach §18 FinVermV ist eine Geeignetheitserklärung vorzulegen. Aus der Beratungsdokumentation wird so ein lesbares Kundenprodukt. *Vorbild:* das öffentliche Weltportfolio-Whitepaper von Gerd Kommer ([PDF](https://gerd-kommer.de/medien/Gerd-Kommer-Whitepaper-V1.0_EN.pdf)), die Roadmap von Facet ([facet.com](https://facet.com/flat-fee-financial-planning/)).
3. **Finanzplan mit Zielen und Fortschritt.** Ziele wie Ruhestand, Notgroschen, Immobilie oder Kinder mit Soll-Ist-Fortschrittsbalken und einer klaren nächsten Aktion. Der Kunde sieht, wofür jeder Vertrag da ist. *Vorbild:* zielbasierte Konten bei Betterment ([NerdWallet](https://www.nerdwallet.com/investing/learn/betterment-vs-wealthfront)), das Dashboard von Facet ([facet.com](https://facet.com/flat-fee-financial-planning/)).
4. **Ehrliche Rechner mit offenen Annahmen.** Rechner für Entnahme und Ruhestand (Monte-Carlo mit Bandbreite statt einer einzelnen Zahl), Kosten-Effekt über die Zeit, und ab 2027 ein **Zulagenrechner für das Altersvorsorgedepot**. Annahmen (Rendite, Inflation, Kosten) bleiben sichtbar und veränderbar, ein CAPE-basierter Rendite-Korridor ist als Option möglich. *Vorbild:* Path von Wealthfront ([walnutinvest](https://walnutinvest.com/resources/wealthfront-review)), der Monte-Carlo-Optimierer von wealthpilot ([PDF](https://info.wealthpilot.de/hubfs/2021/Media/wealthpilot-launcht-portfolio-optimierer-zur-planung-in-der-hybriden-vermoegensberatung.pdf)). Pflichten aus B8 beachten.
5. **Dokumenten-Tresor mit Upload-Anforderungen.** Geteilte und private Ordner, Benachrichtigung bei neuen Dokumenten, und vor allem **Anforderungen** wie „Bitte lade deine Renteninformation hoch“ mit Status offen oder erledigt. Versicherer-Post bleibt in simplr, hier liegen Beratungsdokumente, Geeignetheitserklärungen, Finanzplan und Kundennachweise. *Vorbild:* eMoney Vault ([eMoney](https://emoneyadvisor.com/blog/product_info/emoney-client-portal-be-the-center-of-your-clients-financial-world)), RightCapital Vault ([RightCapital](https://www.rightcapital.com/blog/client-portal)), der sichere Upload-Kanal der DVAG ([App Store](https://apps.apple.com/app/id1152836376)).
6. **Kunde pflegt seine Daten selbst, mit Freigabe.** Einkommen, Ausgaben, Vermögen und Ziele trägt der Kunde vor dem Termin selbst ein. Pro Bereich legt er fest, was Marvin sehen darf. Das spart Gesprächszeit und dient zugleich der Anlegerexploration nach §16 FinVermV. *Vorbild:* Bearbeitungsrechte für Kunden bei RightCapital ([Hilfe](https://help.rightcapital.com/article/40-inviting-a-client)), VDH: „der Kunde entscheidet, welche Daten der Berater sieht“ ([VDH](https://www.verbund-deutscher-honorarberater.de/honorarberater-magazin/honorarberater/news/online-finanzplanung-hand-in-hand-zwischen-berater-und-mandanttx_news_pi1controllernewstx_news_pi1actionchash1c5ad840ff842bb0d5e0953)).
7. **Sichere Nachrichten statt E-Mail, mit Taping-Archiv.** Ein Nachrichtenkanal im Portal. Per E-Mail kommt nur der Hinweis „Neue Nachricht“, ohne Inhalt und ohne sensiblen Betreff. Verläufe, die Finanzanlagen betreffen, werden revisionssicher 10 Jahre archiviert (§18a, §23 FinVermV). *Vorbild:* das verschlüsselte Postfach von finfire ([finfire.de](https://finfire.de/)), die Postbox von MLP ([MLP](https://mlp.de/service/kundenportal/)), der In-App-Chat von Moneyfarm ([Moneyfarm](https://blog.moneyfarm.com/en/moneyfarm-news/tech-update-in-app-chat-private-mode-and-more/)).
8. **Terminbuchung mit Vorbereitung.** Termine selbst buchen (Erstgespräch, Jahresreview), automatisch verknüpft mit Vorbereitungs-Aufgaben aus Idee 5 und 6. Bei Videocalls mit Anlagebezug den Taping-Hinweis automatisch einbauen. *Vorbild:* meetergo hat eine fertige AMEISE-Integration ([meetergo](https://help.meetergo.com/de/integrations/crm/ameise-integration/)), Terminvereinbarung in der DVAG-App ([App Store](https://apps.apple.com/app/id1152836376)), das kostenlose Erstgespräch von Facet.
9. **Jahresreview und Verhaltens-Coach.** Einmal im Jahr ein Bericht mit Kosten in Euro, Abweichung von der Zielallokation, Rebalancing-Bedarf, Erinnerungen an Freistellungsauftrag und Sparerpauschbetrag sowie einem kurzen Text aus der Behavioral Finance („Was wir bei Kursrückgängen tun – und was nicht“). Optional ein „Private Mode“, der Summen ausblendet und so weniger zum Nachschauen verleitet. *Vorbild:* Private Mode von Moneyfarm ([Moneyfarm](https://blog.moneyfarm.com/en/moneyfarm-news/tech-update-in-app-chat-private-mode-and-more/)), Sparerpauschbetrag-Optimierung bei Ginmon ([biallo](https://www.biallo.de/robo-advisor/ginmon/steuern-sparen)). Laut Quirion-Kritik muss „eingezahlt vs. Wert vs. Rendite p. a.“ immer sichtbar sein ([extraETF](https://extraetf.com/de/erfahrungen/robo-adviser/quirion)).
10. **Familien- und Notfallordner.** Partner bekommen eine Freigabe (gemeinsame Ansicht), dazu ein Notfallblatt („Wer ist anzurufen, wo liegt was?“) und Ablagen für Vorsorgevollmacht und Patientenverfügung, mit einem Verweis auf simplr für Versicherungsdokumente. Das ist persönlich und hochwertig, wird selten genutzt, hat dann aber großen Wert. *Vorbild:* Familienfreigabe und Notfallguide der DVAG ([App Store](https://apps.apple.com/app/id1152836376)), Vollmacht-Ablage in simplr ([Cash](https://www.cash-online.de/a/blau-direkt-app-simplr-ohne-maklermandat-315003/)).

*Bonus (Sicherheit als Qualitätsmerkmal):* Passkey-Login und eine sichtbare Seite „So schützen wir deine Daten“. Die Fälle bei Clark mit fremden Daten zeigen, dass Vertrauen hier schnell verloren geht ([test.de](https://www.test.de/Versicherungs-App-Wenn-die-Clark-App-fremde-Daten-anzeigt-5717856-0/)).

---

<a id="bd-empfehlung"></a>
## 5. Empfehlung: Was blau direkt abdeckt und was Marvins Portal leisten sollte

### Bereits durch simplr und AMEISE abgedeckt – nicht doppelt bauen
| Funktion | Abgedeckt durch | Beleg |
|---|---|---|
| Übersicht der Versicherungsverträge, automatisch über BiPRO aktualisiert | simplr und AMEISE | [blaudirekt.de/kunden-app](https://www.blaudirekt.de/kunden-app/), [Konnektivität](https://www.blaudirekt.de/konnektivitaet/) |
| Versicherer-Dokumente je Vertrag, Dokumentfreigabe, Upload-Benachrichtigung | simplr (Web und App) | [Blog 12/2024](https://www.blaudirekt.de/blog/2024/12/simplr-web-appflexibilitaet-und-komfort-fuer-makler-und-kunden/) |
| Schadenmeldung, Adress- und Bankänderung an alle Versicherer | simplr | [rs-maklerkontor](https://rs-maklerkontor.de/funktionsweise/), [Cash](https://www.cash-online.de/a/blau-direkt-app-simplr-ohne-maklermandat-315003/) |
| Fremdverträge per Foto, Dokumentengenerator für Anträge und Rückfragen | simplr | [Blog 02/2023](https://www.blaudirekt.de/blog/2023/02/das-grosse-simplr-update/) |
| Sach-Vergleichsrechner (36+ Sparten) | AMEISE und simplr | [Lizenzen](https://www.blaudirekt.de/lizenzen/) |
| Registrierung mit automatischer Erstinformation und Anlage in AMEISE | simplr-Registrierungsformular | [digitalmakler.online](https://digitalmakler.online/simplr/app-login/) |
| Bestands-CRM, Versichererportale (QuickJump), KI-Assistent | AMEISE und COPILOT | [Cash](https://www.cash-online.de/a/blau-direkt-direkter-zugriff-auf-versichererportale-aus-dem-mvp-716941/), [Blog 04/2026](https://www.blaudirekt.de/blog/2026/04/ameise-copilot-der-ki-assistent-fuer-euren-vermittleralltag-ist-da/) |

### Was Marvins Portal selbst leisten sollte
- **Beratungsebene:** Finanzplan, Ziele, „Warum“-Karten, Archiv für Beratungsdokumentation, Geeignetheitserklärungen und Erstinformation (Ideen 2, 3, 5).
- **Investment- und Vorsorgeebene:** Kosten in Euro, Jahresreview, Rechner, Altersvorsorgedepot (Ideen 1, 4, 9). simplr ist auf Versicherungen ausgelegt. Wie Depots über den Pool abgebildet werden, habe ich nicht geprüft.
- **Beziehung:** sichere Nachrichten mit Taping-Archiv, Terminbuchung, Datenerhebung durch den Kunden, Familienordner (Ideen 6, 7, 8, 10).
- **Marke:** eigenes Design ohne Pool-Logo, Inhalte im Stil von „Mehr Rendite, weniger Bullshit“.
- Für Versicherungsverträge, Schäden und Versicherer-Dokumente gibt es **im Portal nur eine Kachel**, die zu simplr verlinkt.

### Integrationsmöglichkeiten (mit Belegstatus)
| Weg | Was | Kosten und Voraussetzung | Status |
|---|---|---|---|
| **Deep-Link** zu `login.simplr.de` | Button „Meine Versicherungen“ | keine | belegt durch Maklerseiten ([wifix.de](https://wifix.de/simplr-login)). Keine Login-Maske nachbauen (Phishing-Risiko, [maklermitfliege.de](https://www.maklermitfliege.de/simplr-benutzernamen-vergessen.html)) |
| **simplr-Registrierungsformular** auf der Website | Neukunde wird in AMEISE angelegt und erhält die Erstinformation | Teil der Lizenz | belegt durch Maklerseite, technische Details (Iframe oder Link?) **nicht öffentlich dokumentiert** |
| **Qonekto ONE** (über Make.com) | AMEISE-Ereignisse und -Daten zu Make und von dort per Webhook zu n8n oder Supabase | 99 €/Monat, für Pool-Partner 49 €/Monat, bis 100 % Rabatt je nach Lizenz, 1.000 API-Aufrufe im Einstiegstarif (Angabe aus Drittquelle) | belegt ([qonekto.de](https://www.qonekto.de/qonekto-lizenzpreise/)). Ein **n8n-Connector ist nicht dokumentiert**, Zapier war 2024 „demnächst“ angekündigt |
| **AMEISE-REST-APIs und Webhooks** | direkter Zugriff, z. B. per n8n-HTTP-Node | Enterprise-Paket 998 €/Monat bzw. „auf Anfrage“ | auf der Lizenzseite genannt, **Endpunkte und Auth nicht öffentlich dokumentiert** ([Lizenzen](https://www.blaudirekt.de/lizenzen/), [API-Seite](https://www.blaudirekt.de/produkte/api-entwickler/)) |
| **dailyUP** | täglicher CSV-Export von Bestands- und Vertragsdaten auf SFTP | Enterprise | genannt, **Feldliste nicht öffentlich** |
| **meetergo – AMEISE** | Terminbuchung mit CRM-Abgleich | meetergo-Lizenz | belegt ([meetergo Hilfe](https://help.meetergo.com/de/integrations/crm/ameise-integration/)) |

**Empfohlene Reihenfolge:** (1) Start ohne Datensynchronisation, nur mit Deep-Link. (2) Bei blau direkt schriftlich anfragen, welche API- oder Qonekto-Rechte in Marvins aktueller Lizenz enthalten sind, ob Depotdaten verfügbar sind und ob das Pool-Logo in simplr entfernt werden kann. (3) Erst wenn sich das wirtschaftlich lohnt, Daten über Qonekto/Make oder die Enterprise-API nach Supabase spiegeln. Dafür vorher klären, wer datenschutzrechtlich verantwortlich ist (B1). **Königswege GmbH i. G.:** Wenn Verträge, Lizenz oder Kundenbeziehung künftig bei der GmbH liegen, müssen Verantwortlichkeit (Art. 26 DSGVO), Impressum, Erstinformation und Lizenzinhaber neu geordnet werden.

---

<a id="teil-b"></a>
## 6. Teil B – Recht (Deutschland, Stand 10/2026)

> **Ich bin keine Rechtsberatung – mit Anwalt, IHK und Datenschutzbeauftragtem prüfen.** Gesetzestexte konnte ich nicht direkt auf gesetze-im-internet.de abrufen. Die Normen sind über Spiegel (buzer.de, lxgesetze.de, gesetze.legal) und IHK-Merkblätter belegt. Vor der Umsetzung immer gegen die amtliche Fassung prüfen.

### B1 Rollen, Hosting, AV-Verträge, Drittlandtransfer

**Rollen:** Marvin (bzw. später die Königswege GmbH) ist **Verantwortlicher**. Supabase, Netlify, IONOS und gegebenenfalls Google sind **Auftragsverarbeiter** (Art. 28 DSGVO). Für jede Verarbeitung ein Eintrag im Verzeichnis der Verarbeitungstätigkeiten nach Art. 30, auch für Makler üblich ([legiscope](https://www.legiscope.com/blog/dsgvo-versicherungen-vermittler.html)). Ob blau direkt im Verhältnis zu Marvins Kunden eigener Verantwortlicher oder Auftragsverarbeiter ist, ist **nicht recherchiert** und sollte geklärt werden.

| Dienst | Datenort | AV-Vertrag | Drittland | Empfehlung |
|---|---|---|---|---|
| **Supabase** (Region eu-central-1 Frankfurt) | Region festgelegt für **Postgres, Auth und Storage**. Nicht erfasst sind Backups, Logs, Datenexporte, Edge-Function-Ausführung und Subprozessoren ([Supabase Doku GDPR](https://supabase.com/docs/guides/security/gdpr-compliance)). Edge Functions laufen **standardmäßig in der Region, die dem Nutzer am nächsten ist**, ein Pinning auf `eu-central-1` ist möglich ([Supabase Regional Invocations](https://supabase.com/docs/guides/functions/regional-invocation)). Wichtig: die konkrete Region **Frankfurt** wählen, nicht die Gruppe „Europe“, die auch London und Zürich enthält. | DPA unter supabase.com/legal/dpa, mit SCC. Laut Drittquelle ist der Vertragspartner Supabase Pte. Ltd. (Singapur), Subprozessoren sind u. a. AWS, Cloudflare, Google und Supabase Inc. (USA) ([eurobase – Wettbewerber, nicht neutral](https://eurobase.app/vs/supabase-dpa)) | **Eine DPF-Zertifizierung von Supabase war nicht nachweisbar**, Übermittlung über SCC ([GitHub-Diskussion, älter](https://github.com/orgs/supabase/discussions/2341)). SOC 2 Type 2 laut Supabase ([supabase.com/security](https://supabase.com/security)) | DPA abschließen und ablegen. Region fest auf eu-central-1, Edge Functions per `x-region`/`forceFunctionRegion` pinnen. Schriftlich nachfragen, wo Backups und Logs liegen. Transfer Impact Assessment (TIA) dokumentieren. |
| **Netlify** | Statische Seiten über ein globales CDN. **Functions standardmäßig in Ohio (USA)**. Frankfurt ist als Functions-Region dokumentiert, Paris und Mailand über den Support ([Netlify Functions-Konfiguration](https://docs.netlify.com/build/functions/configuration/), [Private Connectivity](https://docs.netlify.com/manage/security/private-connectivity/)) | Die DPA ist per Verweis Teil der Nutzungsbedingungen ([netlify.com/gdpr-ccpa](https://www.netlify.com/gdpr-ccpa/)) | **DPF-zertifiziert, aktiv** ([Netlify Privacy](https://www.netlify.com/privacy/)) | Netlify nur für das statische Frontend nutzen. **Keine Kundendaten über Netlify Functions oder Netlify Forms.** Falls doch, die Function-Region auf `fra` pinnen. |
| **IONOS VPS** (n8n) | Rechenzentrum in Deutschland wählbar (beim Bestellen bzw. im Panel prüfen) | Der **AVV ist seit 19.07.2022 Teil der AGB**. Altverträge bestätigen ihn online im Kundenkonto ([IONOS Hilfe](https://www.ionos.de/hilfe/index.php?id=3212)) | EU | AVV als PDF ablegen, Standort dokumentieren. |
| **n8n self-hosted** | auf dem IONOS-VPS | Kein AVV mit n8n nötig, Marvin betreibt es selbst (AVV mit IONOS genügt) | Nur, wenn Workflows Daten an US-Dienste schicken ([nordflux](https://nordflux.de/wissen/n8n-dsgvo-self-hosting)) | Eigenen `N8N_ENCRYPTION_KEY` setzen und getrennt sichern ([n8n Doku](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/configuration-examples/set-a-custom-encryption-key)). Telemetrie mit `N8N_DIAGNOSTICS_ENABLED=false` abschalten ([n8n Doku](https://docs.n8n.io/deploy/host-n8n/configure-n8n/security/control-telemetry)). **Aufbewahrung der Ausführungsdaten begrenzen.** Die Sustainable Use License erlaubt die interne Geschäftsnutzung ([n8n Lizenz](https://docs.n8n.io/n8n-community-license/sustainable-use-license)). |
| **Google Drive** (falls genutzt) | je nach Workspace-Konfiguration | Das **Cloud Data Processing Addendum gilt nur für Workspace- und Cloud-Konten**, nicht für private Google-Konten ([Google DPA](https://workspace.google.com/intl/af/terms/dpa_terms.html)). Dass private Konten nicht erfasst sind, ist meine Ableitung aus der Kontodefinition im DPA. | DPF und SCC | Für Kundendaten nur Workspace mit DPA. **Gesundheitsdaten nicht in Drive**, sondern verschlüsselt in Supabase oder auf dem VPS. |

**EU-US Data Privacy Framework:** Das EuG hat die Klage am 03.09.2025 (T-553/23) abgewiesen. Das Rechtsmittel C-703/25 P ist beim EuGH anhängig ([Heuking](https://www.heuking.de/de/news-events/newsletter-fachbeitraege/artikel/eug-bestaetigt-wirksamkeit-des-eu-us-data-privacy-framework.html), [WilmerHale](https://www.wilmerhale.com/en/insights/blogs/wilmerhale-privacy-and-cybersecurity-law/20251201-european-court-of-justice-to-review-challenge-to-eu-us-data-privacy-framework)). Folge: Das DPF ist nutzbar, SCC aber als Rückfall dokumentieren. Bei US-Konzernen bleibt das CLOUD-Act-Restrisiko, eine juristische Einschätzung dazu habe ich nicht verifiziert.

### B2 Verschlüsselung und technische Maßnahmen (Art. 32 DSGVO)

- **Transport:** TLS überall, HSTS, nur HTTPS-Origins (Passkeys erfordern HTTPS, [Supabase Passkeys](https://supabase.com/docs/guides/auth/passkeys)). BSI TR-02102 als Referenz für Verfahren, über die Suche **nicht abgerufen**.
- **At rest:** Eine konkrete Aussage von Supabase zur Speicherverschlüsselung (Algorithmus) habe ich in der Doku-Suche **nicht gefunden**, dokumentiert ist nur Supabase Vault für Secrets ([Vault](https://supabase.com/docs/guides/database/vault)). → Beim Supabase-Support bzw. im SOC-2-Bericht nachprüfen.
- **Anwendungsseitige Verschlüsselung für Art.-9-Dokumente** (Gesundheitsfragen, Arztberichte) – Empfehlung: Dateien vor der Ablage im Storage serverseitig, z. B. in einer gepinnten Edge Function oder auf dem VPS, mit eigenem Schlüssel verschlüsseln. Den Schlüssel außerhalb der Datenbank verwalten. Eine echte Ende-zu-Ende-Verschlüsselung mit Schlüssel nur beim Kunden schützt am stärksten, erschwert aber Beratung, Wiederherstellung und Taping-Archiv. Abwägung mit dem DSB.
- **Zugriff:** Row Level Security auf allen Tabellen. Storage-Buckets privat, signierte URLs mit kurzer Laufzeit. Für Art.-9-Daten in den RLS-Policies `aal2` (MFA) verlangen ([Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa)). Admin-Zugang nur mit Hardware-Key bzw. Passkey. Audit-Log für Zugriffe auf sensible Dokumente. Mandantentrennung testen (Lehre aus dem Clark-Vorfall).
- **Execution-Logs** in n8n und Supabase-Logs auf personenbezogene Daten prüfen und kurz halten.

### B3 Löschkonzept und Aufbewahrungsfristen

| Unterlage | Frist | Beginn | Quelle |
|---|---|---|---|
| Taping-Aufzeichnungen (§18a FinVermV) und Unterlagen nach §22 FinVermV | **10 Jahre** auf dauerhaftem Datenträger, danach **löschen und Löschung dokumentieren** | Ende des Kalenderjahres des letzten aufzeichnungspflichtigen Vorgangs | §23 FinVermV ([lxgesetze](https://lxgesetze.de/finvermv/23), [juraforum](https://www.juraforum.de/gesetze/finvermv/23-aufbewahrung)), §18a ([buzer](https://www.buzer.de/18a_FinVermV.htm)) |
| Geeignetheitserklärung | über §22 FinVermV erfasst, wohl ebenfalls 10 Jahre (**Zuordnung im Wortlaut prüfen**) | wie oben | [IWW](https://www.iww.de/wvm/maklerrecht/vermittlerrecht-finvermv-neu-ein-ueberblick-ueber-die-ab-01082020-geltenden-aenderungen-f125561) |
| Beratungsdokumentation Versicherung (§61, §62 VVG) | **keine gesetzliche Frist gefunden**. Empfehlung wegen Haftung: mindestens 10 Jahre ab Vertragsende bzw. letzter Beratung (§199 Abs. 3 BGB). Fehlt die Dokumentation, kehrt sich die Beweislast zulasten des Maklers um. | – | [IWW](https://www.iww.de/wvm/archiv/wichtige-fristen-kennen-die-verjaehrung-von-schadenersatzanspruechen-bei-falschberatung-f15086). **30-Jahres-Fristen (§199 Abs. 2, 3 Nr. 2 BGB) mit dem Anwalt prüfen** |
| Handels- und Geschäftsbriefe | 6 Jahre | Ende des Kalenderjahres | §257 HGB ([IHK Koblenz](https://www.ihk.de/koblenz/unternehmensservice/recht/steuerrecht/allgemein/aufbewahrungsfristen-3547104)) |
| Buchungsbelege (Rechnungen, Courtage-Abrechnungen) | **8 Jahre** (früher 10, geändert durch das BEG IV). Stichtag umstritten, mit dem Steuerberater klären | Ende des Kalenderjahres | §147 AO, §257 HGB ([Haufe](https://www.haufe.de/steuern/gesetzgebung-politik/viertes-buerokratieentlastungsgesetz_168_613390.html)) |
| Bücher, Jahresabschlüsse | 10 Jahre | – | ebd. |
| Interessenten ohne Mandat, abgebrochene Onboardings | keine Pflichtfrist. **Eigene Empfehlung:** kurz löschen, etwa 6–12 Monate nach letztem Kontakt (Art. 5 Abs. 1 lit. e DSGVO) | – | eigene Einschätzung |
| Login-, Sicherheits- und Audit-Logs | eigene Festlegung, z. B. 90 Tage bis 1 Jahr. Logs, die das Taping belegen, länger | – | eigene Einschätzung |

**Umsetzung:** Jedes Dokument bekommt `kategorie`, `rechtsgrundlage`, `aufbewahrung_bis` und `loeschsperre`. Ein nächtlicher Job (n8n oder pg_cron) markiert fällige Datensätze, Marvin gibt die Löschung frei, und die Löschung wird protokolliert (§18a FinVermV verlangt die Dokumentation ausdrücklich). Daten mit Aufbewahrungspflicht nach Vertragsende **sperren statt löschen** (Art. 17 Abs. 3 lit. b, Art. 18 DSGVO).

### B4 Gesundheitsdaten (Art. 9 DSGVO), DSFA, Datenschutzbeauftragter

- **Rechtsgrundlage:** In der Praxis eine **ausdrückliche, gesonderte Einwilligung** (Art. 9 Abs. 2 lit. a), getrennt vom Maklervertrag, zweckgebunden, widerrufbar und dokumentiert. Bei vertretenen Personen wie Kindern zusätzlich durch die gesetzlichen Vertreter. Eine stillschweigende Einwilligung in elektronische Kommunikation erfasst **keine** Art.-9-Daten ([Versicherungsbote zu WhatsApp](https://www.versicherungsbote.de/id/4897895/WhatsApp-fur-Versicherungsmakler-Datenschutz-ungenuegend/), [Check24-Muster](https://www.check24.de/vorsorgeversicherungen/download/Einwilligung_Erhebung_Verarbeitung_Gesundheitsdaten.pdf), [IVFP-Muster 2026](https://ivfp.de/wp-content/uploads/2026/07/Einwilligung_Art_9_DSGVO.pdf)). §213 VVG regelt die Erhebung durch **Versicherer**. Ob und wie Makler sich darauf oder auf §22 BDSG stützen können, ist **nicht verifiziert** → mit DSB oder Anwalt klären.
- **Portal-Folge:** Gesundheitsfragebögen nur nach erteilter Einwilligung freischalten. Die Einwilligung speichern (Version, Zeitstempel, Text). Bei Widerruf Löschen bzw. Sperren über einen definierten Prozess.
- **DSFA:** Art. 35 Abs. 3 lit. b verlangt eine DSFA bei *umfangreicher* Verarbeitung von Art.-9-Daten. Nach Erwägungsgrund 91 ist die Verarbeitung durch einzelne Ärzte oder Anwälte in der Regel nicht umfangreich ([activemind EG 91](https://www.activemind.legal/de/gesetze/dsgvo/erwaegungsgrund-91)). Für einen Einzelmakler ist das vergleichbar, aber nicht ausdrücklich geregelt. Die DSK-Muss-Liste ist nicht abschließend ([LfD SH Muss-Liste](https://datenschutzzentrum.de/uploads/datenschutzfolgenabschaetzung/20180525_LfD-SH_DSFA_Muss-Liste_V1.0.pdf), [Hamburg](https://datenschutz-hamburg.de/fileadmin/user_upload/HmbBfDI/Datenschutz/Informationen/DSFA_Muss-Liste_fuer_den_nicht-oeffentlicher_Bereich_-_Stand_17.10.2018.pdf)). **Empfehlung:** Schwellwertanalyse dokumentieren, etwa mit dem Prüfbogen des BayLDA ([LDA Bayern](https://www.lda.bayern.de/media/pruefungen/DSFA_Schwellwert_Pruefbogen.pdf)), und wegen der neuen Plattform mit Gesundheits- und Finanzdaten eine **schlanke DSFA freiwillig** durchführen. Sie dient zugleich als TOM-Dokumentation.
- **Datenschutzbeauftragter:** Nach §38 BDSG Pflicht ab in der Regel 20 Personen, die ständig mit der Verarbeitung befasst sind, **oder** wenn Verarbeitungen einer DSFA-Pflicht unterliegen. Das stammt aus eigener Kenntnis des §38 Abs. 1 BDSG, der Wortlaut ist **hier nicht abgerufen**. Fällt die DSFA-Pflicht weg, dürfte für Marvin keine Benennungspflicht bestehen. Ein externer DSB als Berater ist trotzdem sinnvoll.
- **Zuständige Aufsicht:** Bei Sitz in Stade die Landesbeauftragte für den Datenschutz Niedersachsen (Ableitung aus dem Sitz, nicht gesondert recherchiert).

### B5 Login: Stand der Technik

- **BSI:** empfiehlt Verbrauchern **Passkeys** (Pressemitteilung vom 01.10.2024, zitiert vom Berliner Senat) und Zwei-Faktor-Authentisierung, wo sie angeboten wird ([Berliner Abgeordnetenhaus, Schriftliche Anfrage](https://pardok.parlament-berlin.de/starweb/adis/citat/VT/19/SchrAnfr/S19-20586.pdf)). Laut Fachbeitrag gelten OTP-Verfahren beim BSI als nicht phishing-resistent, Passkeys werden in TR-03188 als Stand der Technik geführt. Die **BSI-Originale sind nicht abgerufen** ([boerse-express](https://www.boerse-express.com/news/articles/nis2-und-phishing-resistenz-bsi-startet-durchgriff-im-mai-2026-899938)).
- **Supabase kann:** E-Mail und Passwort, **Magic Link oder E-Mail-OTP** ([Doku](https://supabase.com/docs/guides/auth/auth-email-passwordless)), **TOTP-MFA mit Assurance Level aal2** ([Doku](https://supabase.com/docs/guides/auth/auth-mfa)) und **Passkeys (WebAuthn)**. Passkeys sind **„experimentell“**, brauchen `@supabase/supabase-js` ab v2.105.0, und eine Änderung der RP-ID macht alle Passkeys ungültig ([Doku](https://supabase.com/docs/guides/auth/passkeys)).
- **Empfehlung für Marvins Portal:**
  1. **Erstanmeldung** per Einladung mit Magic Link oder E-Mail-OTP, danach Pflicht, einen **Passkey** einzurichten (RP-ID = Hauptdomain, z. B. `marvin-allers.de`, dauerhaft festlegen).
  2. **Fallback:** TOTP-App als zweiter Faktor. SMS nur im Ausnahmefall.
  3. Sensible Bereiche (Gesundheit, Dokumente, Nachrichten) nur mit **aal2** bzw. Passkey, durchgesetzt per RLS.
  4. Magic Link **nicht** als dauerhaften Einzel-Login für Art.-9-Daten verwenden, da die Sicherheit dann am E-Mail-Postfach hängt (eigene Einschätzung).
  5. Session-Timeout, Benachrichtigung bei neuem Gerät, Rate Limiting, Wiederherstellung nur über einen verifizierten Prozess (z. B. Video-Ident durch Marvin).
  6. Wegen des Experimental-Status der Passkeys: SDK-Version festschreiben und den TOTP-Fallback immer aktiv lassen.

### B6 §34d GewO / VersVermV / VVG

- **Erstinformation (§15 VersVermV):** beim **ersten Geschäftskontakt in Textform**. Inhalt u. a.: Name und Firma, Anschrift, Status als Makler nach §34d Abs. 1, Registernummer, Hinweis auf das Register (DIHK, vermittlerregister.info) und **Schlichtungsstellen** (Versicherungsombudsmann e. V., Ombudsmann PKV) ([IHK Limburg](https://www.ihk.de/limburg/recht/versicherungsvermittler-und-finanzdienstleister/erstinformationen-15-und-16-versvermv-4508216), [IHK Bonn](https://www.ihk-bonn.de/fileadmin/dokumente/Downloads/Recht_und_Steuern/Versicherungsvermittler/Informationspflicht.pdf)). **Portal:** vor dem Login bzw. bei der Registrierung als PDF bereitstellen und den Abruf protokollieren. Die Erstinformation lässt sich mit der nach §12 FinVermV kombinieren (siehe B7).
- **Beratung (§61 VVG):** Wünsche und Bedürfnisse erfragen, beraten und **die Gründe für jeden Rat angeben**, dokumentiert je nach Komplexität. **Verzicht** nur durch gesonderte schriftliche Erklärung mit Warnhinweis auf §63 VVG, im Fernabsatz genügt Textform ([lxgesetze §61](https://lxgesetze.de/vvg/61)).
- **Zeitpunkt und Form (§62 VVG):** **vor Vertragsschluss in Textform**. Mündlich nur auf Kundenwunsch oder bei vorläufiger Deckung, dann unverzüglich nachreichen ([lxgesetze §62](https://lxgesetze.de/vvg/62)). Portal: Beratungsdokumentation versionieren, mit Zeitstempel und Bestätigung „gelesen“ vor dem Antrag.
- **Versicherungsanlageprodukte (IBIP):** Es gelten zusätzliche Geeignetheits- und Kostenpflichten nach VVG/IDD. Fundstellen (z. B. §7c VVG) sind **nicht über die Suche verifiziert** → Anwalt.

### B7 §34f GewO / FinVermV

| Pflicht | Inhalt | Portal-Umsetzung | Quelle |
|---|---|---|---|
| Statusbezogene Information (§12) | **vor der ersten Anlageberatung oder -vermittlung** in Textform. Mit der Erstinformation nach §15 VersVermV in **einem Dokument kombinierbar** (§12 Abs. 2) | ein kombiniertes Dokument mit Abrufprotokoll | [IHK Stuttgart](https://www.ihk.de/stuttgart/fuer-unternehmen/recht-und-steuern/gewerberecht/informationspflichten-fuer-finanzanlagenvermittler-und-berater-688600), [IHK Frankfurt](https://www.frankfurt-main.ihk.de/standortpolitik/finanzplatz-frankfurt/finanzdienstleister-am-finanzplatz-frankfurt/brancheninformationen/finanzanlagenvermittler-nach-34f-der-gewerbeordnung/merkblatt-infopflichten-finanzanlagenvermittler-honorar-berater-5248192) |
| Kosteninformation ex ante und ex post (§13) | ex ante vor dem Geschäft. **Ex post mindestens jährlich**, nur tatsächliche Kosten. Erfüllt, wenn KVG, Emittent oder Depotbank sie liefert (§13 Abs. 5 S. 2) | Idee 1 (Kosten-Cockpit), Pflichtberichte aus Depotbank-Dokumenten verlinken | [fondsprofessionell](https://www.fondsprofessionell.de/news/recht/headline/finvermv-serie-3-drei-fragen-zur-neuen-kosteninformationspflicht-193627/), [GK-law](https://www.gk-law.de/fachbeitraege/34f-vermittler/ex-ante-und-ex-post-kostenausweis-woran-sollten-sich-%C2%A7-34f-vermittler-orientieren/) |
| Redliche Information, Werbung (§14) | redlich, eindeutig, nicht irreführend. **Werbung muss als solche erkennbar sein.** §14 Abs. 5 verweist auf **Art. 36 und 44 DelVO (EU) 2017/565** | siehe B8 | [lxgesetze §14](https://lxgesetze.de/finvermv/14), [Art. 44 DelVO](https://gesetze.legal/eu/vo_eu_2017_565/44) |
| Exploration und Geeignetheit (§16) | Kenntnisse, Erfahrungen, finanzielle Verhältnisse, Ziele, Risikotoleranz | Idee 6 (Kunde erfasst Daten selbst), danach prüft Marvin | [IHK München Merkblatt](https://www.ihk-muenchen.de/ihk/documents/Gewerbeerlaubnisse-Internet/Finanzanlagenvermittler/merkblatt_34fh_berufspflichten.pdf) |
| Zuwendungen (§17) | grundsätzlich verboten, Ausnahme bei **ungefragter** Offenlegung von Existenz, Art und Umfang **vor Vertragsschluss** ohne Qualitätsnachteil. Kein Verzicht des Kunden möglich | Courtage bzw. Provision in Euro im Vorschlag zeigen (passt zur Marke) | [buzer §17](https://www.buzer.de/17_FinVermV.htm), [IHK Offenbach](https://www.offenbach.ihk.de/recht-und-steuern/gewerberecht/gewerberecht-von-a-z/informationspflichten-fuer-finanzanlagenvermittler/) |
| Geeignetheitserklärung (§18) | **vor Vertragsschluss auf einem dauerhaften Datenträger**. Nennt die Beratung und erklärt, wie sie zu Präferenzen und Zielen passt. Bei Fernkommunikation unter Bedingungen direkt nach Vertragsschluss | im Portal als PDF mit „Warum“-Karte, Bestätigung vor Order bzw. Antrag | [buzer §18](https://www.buzer.de/18_FinVermV.htm), [IHK Pfalz](https://www.ihk.de/pfalz/recht/gewerbe-und-pruefungsrecht/finanzanlagenvermittler/neue-finanzanlagenvermittlerverordnung-4844970) |
| **Taping (§18a)** | Aufzeichnung von **Telefonaten und „sonstiger elektronischer Kommunikation“** zu Anlageberatung und -vermittlung, auch ohne Vertragsschluss. Hinweis vorab (einmalig genügt). Widerspricht der Kunde, keine Beratung über diesen Kanal. Kopie auf Verlangen | **Portal-Chat:** Nachrichten unveränderbar speichern (append-only, mit Hash) und 10 Jahre aufbewahren. **Videocall:** aufzeichnen oder konkrete Finanzanlagen dort nicht besprechen. Taping-Hinweis bei der Registrierung bestätigen lassen | [buzer §18a](https://www.buzer.de/18a_FinVermV.htm), [IHK Osnabrück](https://www.ihk.de/osnabrueck/recht-und-fair-play/handel-und-gewerbe/finanzanlagenvermittler/aenderungen-der-finanzanlagenvermittlungsverordnung-4583224), [finvermv-pruefung.de](https://finvermv-pruefung.de/aufzeichnungspflichten-nach-%C2%A7-18a-finvermv/) |
| Aufbewahrung (§23) | 10 Jahre (siehe B3) | Löschkonzept | [lxgesetze §23](https://lxgesetze.de/finvermv/23) |

**Videocall und Chat (§18a):** Eine ausdrückliche IHK- oder BaFin-Aussage zu Videokonferenzen bzw. Chat habe ich **nicht gefunden**. Der Wortlaut „sonstige elektronische Kommunikation“ spricht für eine Einbeziehung. → **IHK Stade fragen.**

### B8 Online-Rechner: Disclaimer und Werberecht

- **Keine Anlageberatung**, solange keine *persönliche Empfehlung* zu *bestimmten Finanzinstrumenten* auf Basis der persönlichen Umstände ausgesprochen wird (KWG §1 Abs. 1a Nr. 1a). Das BaFin-Merkblatt von 02/2025 ist nur über Sekundärquellen belegt ([GvW](https://www.gvw.com/aktuelles/blog/detail/aktualisiertes-merkblatt-der-bafin-zur-anlageberatung-und-einordnung-von-finfluencern), [Bundesbank-Informationsblatt](https://bundesbank.de/resource/blob/598312/f39e5ee8c04f323690cc8ca1b5fdfa26/mL/informationsblatt-zum-tatbestand-der-anlageberatung-data.pdf)). → Rechner zeigen **Anlageklassen und Szenarien, keine konkreten ISINs**. Ein Rechner im Login-Bereich, der persönliche Daten nutzt und ein bestimmtes Produkt vorschlägt, wäre Teil der Beratung und muss dann den §§16–18 FinVermV genügen.
- **§14 FinVermV in Verbindung mit Art. 44 DelVO 2017/565** ([gesetze.legal Art. 44](https://gesetze.legal/eu/vo_eu_2017_565/44)):
  - Frühere Wertentwicklung darf nicht im Vordergrund stehen, umfasst **5 volle Jahre** (bzw. den gesamten Zeitraum, wenn kürzer), nennt Zeitraum und Quelle und enthält die deutliche Warnung „Frühere Wertentwicklungen sind kein verlässlicher Indikator für künftige Ergebnisse“. Bei Fremdwährungen Währungsrisiko nennen. Bei Bruttozahlen die Wirkung der Kosten zeigen.
  - Simulierte frühere Wertentwicklung (Art. 44 Abs. 5) nur auf Basis tatsächlicher Index- oder Instrumentenhistorie.
  - Prognosen und künftige Wertentwicklung (Art. 44 Abs. 6): angemessene Annahmen, Szenarien, Kostenwirkung, Warnhinweis. Den **Wortlaut von Abs. 6 habe ich nicht abgerufen** → prüfen.
- **UWG §5 (Irreführung):** keine Renditeversprechen. „Mehr Rendite“ als Claim belegen bzw. relativieren, z. B. „mehr Netto-Rendite durch niedrigere Kosten – Ergebnis nicht garantiert“. Mit dem Anwalt abstimmen.
- **Textbaustein (Entwurf, vom Anwalt prüfen lassen):**
  > *„Dieser Rechner dient der allgemeinen Information und ist keine Anlageberatung oder persönliche Empfehlung. Ergebnisse beruhen auf den oben angezeigten Annahmen (Rendite x % p. a., Inflation y %, Kosten z % p. a.) und sind keine Prognose. Frühere Wertentwicklungen sind kein verlässlicher Indikator für künftige Ergebnisse. Kapitalanlagen sind mit Risiken bis zum Totalverlust verbunden. Steuern werden vereinfacht bzw. nicht berücksichtigt. Quelle der historischen Daten: … (Zeitraum …).“*
- **Altersvorsorgedepot-Rechner:** Zulagenwerte nur aus dem BGBl.-Wortlaut übernehmen, Stand und Quelle angeben, bis zum 01.01.2027 „ab 2027“ kennzeichnen.

### B9 Impressum (§5 DDG, früher TMG)

Pflichtangaben für §34d/§34f-Vermittler (IHK-Merkblätter: [IHK Ostwestfalen](https://www.ihk.de/ostwestfalen/branchen/dienstleistungen/versicherungs-und-finanzwirtschaft/internet-impressum-6827420), [IHK München PDF](https://www.ihk-muenchen.de/ihk/documents/Gewerbeerlaubnisse-Internet/Immobiliardarlehensvermittler/merkblatt_impressum_34cdfhi.pdf), [IHK Osnabrück](https://www.ihk.de/osnabrueck/recht-und-fair-play/handel-und-gewerbe/versicherungsvermittler/aenderung-beim-internetimpressum-6226678)):
- Name, ladungsfähige Anschrift, Kontakt (E-Mail und ein weiterer schneller Kanal), gegebenenfalls USt-ID.
- **Aufsichts- bzw. Erlaubnisbehörde:** IHK Stade für den Elbe-Weser-Raum, Schäferstieg 2, 21680 Stade ([Vermittler-Eintrag mit IHK-Anschrift](https://agentur.concordia.de/uploads/tx_pxchve/HVE-Files/13620-000/AgtBl-13620-000-2023-06-Stangneth-Philipp.pdf)).
- **Berufsbezeichnung:** „Versicherungsmakler mit Erlaubnis nach §34d Abs. 1 GewO“ und „Finanzanlagenvermittler mit Erlaubnis nach §34f Abs. 1 GewO“, verliehen in der Bundesrepublik Deutschland.
- **Registernummern** (Versicherung und Finanzanlagen) und Register: DIHK, www.vermittlerregister.info.
- **Berufsrechtliche Regelungen** mit Link: §34d, §34f GewO, VersVermV, FinVermV (gesetze-im-internet.de).
- **Schlichtungsstellen:** Versicherungsombudsmann e. V., Ombudsmann PKV. Für Finanzanlagen gegebenenfalls die Schlichtungsstelle für gewerbliche Versicherungs-, Anlage- und Kreditvermittlung (Hamburg), Zuständigkeit **prüfen** ([IHK Limburg](https://www.ihk.de/limburg/recht/versicherungsvermittler-und-finanzdienstleister/erstinformationen-15-und-16-versvermv-4508216)).
- **OS-Plattform-Link entfernen:** Die Pflicht ist seit 20.07.2025 entfallen (VO (EU) 2024/3228) ([IHK Bayreuth](https://www.ihk.de/bayreuth/hauptnavigation/service/recht/allgemeine-rechtsthemen/anpassung-des-internet-impressums-erforderlich--6512524)).
- **§36 VSBG:** Angabe zur Bereitschaft, an Verbraucherschlichtung teilzunehmen. Ausnahme bei Nr. 1 für Unternehmen mit höchstens 10 Beschäftigten am 31.12. des Vorjahres. §37 VSBG gilt im Streitfall trotzdem ([IHK Köln](https://www.ihk.de/koeln/hauptnavigation/recht-steuern/informationspflichten-zur-verbraucherschlichtung-5185768)).
- **Berufshaftpflicht (VSH):** Angabe von Versicherer und Geltungsbereich nach §2 DL-InfoV. Aus eigener Kenntnis, **nicht per Suche verifiziert** → IHK fragen.
- **Bei Gründung der Königswege GmbH:** Rechtsform, Vertretungsberechtigte, Handelsregister, Registergericht. Bis zur Eintragung „i. G.“ kennzeichnen. Wer Erlaubnisinhaber ist, mit der IHK klären.

### B10 Portal-Nachrichten statt E-Mail

- Eine **ausdrückliche gesetzliche Pflicht zur E-Mail-Verschlüsselung gibt es nicht**. Art. 32 DSGVO verlangt aber dem Risiko angemessene Maßnahmen ([e-recht24](https://www.e-recht24.de/artikel/datenschutz/11284-dsgvo-und-e-mail-verschluesselung.html)).
- Die **DSK-Orientierungshilfe** (Stand 16.06.2021) verlangt bei normalem Risiko eine **obligatorische Transportverschlüsselung**, bei hohem Risiko (ausdrücklich Gesundheitsdaten) in der Regel **Ende-zu-Ende-Verschlüsselung**, mindestens aber qualifizierte Transportverschlüsselung. Der Betreff ist nie geschützt ([DSK OH PDF](https://www.LDA.brandenburg.de/sixcms/media.php/9/DSK-OH_E-Mail_16-06-2021_final.pdf)).
- **Folge:** Sensible Inhalte (Gesundheit, Finanzstatus, Geeignetheitserklärungen) **nur im Portal**. Per E-Mail nur „Du hast eine neue Nachricht“, ohne Inhalt und mit neutralem Betreff. Für Finanzanlagen-Kommunikation gleichzeitig das **Taping-Archiv** nach §18a erfüllen. WhatsApp und ähnliche Messenger nicht für Art.-9-Daten verwenden ([Versicherungsbote](https://www.versicherungsbote.de/id/4897895/WhatsApp-fur-Versicherungsmakler-Datenschutz-ungenuegend/)).

### B11 Weitere Punkte

- **Barrierefreiheit (BFSG, seit 28.06.2025):** Für **Dienstleistungen** sind Kleinstunternehmen (weniger als 10 Beschäftigte **und** höchstens 2 Mio. € Umsatz oder Bilanzsumme) ausgenommen, die Ausnahme muss aber dokumentiert werden ([IHK Koblenz](https://www.ihk.de/koblenz/unternehmensservice/recht/aktuelles/aktuelle-informationen-aus-recht-und-steuern/barrierefreiheit-6616444), [Händlerbund](https://ohn.haendlerbund.de/recht/rechtsfragen/diese-drei-ausnahmen-von-der-barrierefreiheitspflicht-sollten-unternehmen-kennen)). Ob Marvins Portal überhaupt unter das BFSG fällt (Bank- oder E-Commerce-Dienstleistung?), ist **nicht geklärt**. Als Qualitätsziel trotzdem WCAG 2.1 AA anstreben.
- **Vermögenskonto-Aggregation:** Nur über einen regulierten Kontoinformationsdienst (vgl. Finanzfluss Copilot), nicht selbst bauen ([App Store](https://apps.apple.com/DE/app/id6482296545)).

### B12 Wer klärt was?

| Thema | Mit wem |
|---|---|
| Taping für Videocall und Portal-Chat (§18a), kombinierte Erstinformation, Impressum, Schlichtungsstelle für §34f, Rolle der Königswege GmbH (Erlaubnis, Register) | **IHK Stade** (Gewerberecht/Vermittlerrecht, Tel. 04141 524-0, info@stade.ihk.de) |
| Art.-9-Einwilligungstext, DSFA (Schwellwert bzw. freiwillig), Verzeichnis der Verarbeitungstätigkeiten, TOMs, TIA für Supabase und Netlify, Löschkonzept, Pflicht zur DSB-Benennung | **Externer Datenschutzbeauftragter**. Bei Unklarheit Anfrage an die **LfD Niedersachsen** |
| Rechner-Disclaimer, Claim „Mehr Rendite, weniger Bullshit“ (UWG, §14 FinVermV, Art. 44 DelVO), Haftung und Aufbewahrungsdauer der Beratungsdokumentation, IBIP-Pflichten, Gestaltung von Verzichtserklärungen, AGB und Nutzungsbedingungen des Portals | **Fachanwalt** für Versicherungsrecht bzw. Bank- und Kapitalmarktrecht, zusätzlich IT- oder Datenschutzrecht |
| Aufbewahrung von Buchungsbelegen (8 oder 10 Jahre, Stichtag BEG IV), GoBD-konforme Archivierung | **Steuerberater** |
| API- und Qonekto-Rechte in der eigenen Lizenz, Depotdaten, Entfernung des Pool-Logos, Verantwortlichkeit nach DSGVO, Iframe bzw. Embed des Registrierungsformulars | **blau direkt Partnerservice** |
| Speicherort von Backups und Logs, Status der Verschlüsselung at rest, SOC-2-Bericht | **Supabase-Support** (Team-Plan für SOC-2-Bericht) |
| Deckt die VSH (bzw. eine Cyberversicherung) Datenpannen im eigenen Portal ab? | **VSH-Versicherer** |

---

<a id="nicht-verifiziert"></a>
## 7. Nicht verifiziert (ausdrücklich offen)

- Alle **Design-Bewertungen** (mobil und Desktop): Screenshots und App-Store-Seiten waren nicht abrufbar.
- simplr: echter **In-App-Chat**, Terminbuchung, vollständiges White-Label ohne Pool-Logo, technische Einbettung des Registrierungsformulars, Abbildung von **Depots bzw. Investmentverträgen** in simplr.
- blau direkt: **öffentliche API-Dokumentation** (Endpunkte, Authentifizierung, Felder), Qonekto-**n8n**-Connector, Status von Zapier, Höhe der Aufnahmegebühr, ob „12 Monate kostenfrei“ dauerhaft gilt.
- Funktionsstand 2026 von **JDC allesmeins**, **Fonds Finanz MeineVersicherungen-App** (Umbenennung nur aus Drittquelle), **Policen Direkt**, **Swiss Life Select DE**, **OVB** (keine Endkunden-App gefunden).
- Robo-Advisor: Kundenbereich von Scalable Wealth und Quirion 2026, Growney-App-Status.
- **Supabase:** DPF-Zertifizierung (nicht gefunden), Speicherort von Backups und Logs, Algorithmus der Verschlüsselung at rest, Vertragspartner (nur Drittquelle).
- **BSI-Originalquellen** (Pressemitteilung Passkeys vom 01.10.2024, TR-03188, TR-02102), nur sekundär belegt.
- **§18a FinVermV und Videocall/Chat:** keine ausdrückliche Behördenaussage gefunden.
- Gesetzeswortlaute nicht von gesetze-im-internet.de selbst abgerufen (§38 BDSG, §2 DL-InfoV, Art. 44 Abs. 6 DelVO, §7c VVG, §213 VVG für Makler, §199 BGB).
- **Altersvorsorgedepot:** Zulagenwerte und Kostendeckel nur aus Sekundärquellen und dem Bundestag-Textarchiv, kein BGBl.-Volltext. Vergütungsregeln für Vermittler offen.
- Stichtag des **BEG IV** für die Aufbewahrung von Buchungsbelegen (Quellen widersprechen sich).
- Ob das **BFSG** auf ein Makler-Kundenportal anwendbar ist.

---

<a id="quellen"></a>
## 8. Quellenliste

**blau direkt**
- https://www.blaudirekt.de/kunden-app/
- https://www.blaudirekt.de/lizenzen/
- https://www.blaudirekt.de/mvp/
- https://www.blaudirekt.de/konnektivitaet/
- https://www.blaudirekt.de/produkte/api-entwickler/
- https://www.blaudirekt.de/blog/2023/02/das-grosse-simplr-update/
- https://www.blaudirekt.de/blog/2024/12/simplr-web-appflexibilitaet-und-komfort-fuer-makler-und-kunden/
- https://www.blaudirekt.de/blog/2024/10/blau-direkt-bietet-maklern-mit-dem-launch-von-qonekto-ein-neues-level-an-konnektivitaet/
- https://www.blaudirekt.de/blog/2026/04/ameise-copilot-der-ki-assistent-fuer-euren-vermittleralltag-ist-da/
- https://www.blaudirekt.de/pressemitteilung/mit-dem-ameise-copilot-startet-das-neue-betriebssystem-fuer-den-maklermarkt/
- https://www.blaudirekt.de/pressemitteilung/kunden-app-simplr-feiert-eine-halbe-millionen-downloads/
- https://www.qonekto.de/ · https://www.qonekto.de/qonekto-lizenzpreise/
- https://www.finanzwelt.de/post/blau-direkt-neues-level-der-konnektivitaet
- https://www.asscompact.de/nachrichten/blau-direkt-startet-neue-version-des-mvps-ameise
- https://www.cash-online.de/a/blau-direkt-direkter-zugriff-auf-versichererportale-aus-dem-mvp-716941/
- https://www.cash-online.de/a/blau-direkt-app-simplr-ohne-maklermandat-315003/
- https://www.bocquel-news.de/Blau-direkt-mit-neuer-simplr-Version-auf-dem-Markt.43019.php
- https://www.plan-v.de/versicherungsmakler-app-simplr/ · https://rs-maklerkontor.de/funktionsweise/ · https://digitalmakler.online/simplr/app-login/ · https://wifix.de/simplr-login · https://www.maklermitfliege.de/simplr-benutzernamen-vergessen.html · https://www.finanzberatung-bierl.de/blog/artikel/endlich-umfangreiches-update-der-simplr-web-version/ · https://www.marco-mahling.de/blog/ein-neues-update-unserer-kunden-app-simplr/
- https://www.wiemakler.de/magazin/blau-direkt-nutzen/ · https://insuro.de/warum-die-kooperation-mit-blau
- https://help.meetergo.com/de/integrations/crm/ameise-integration/

**Pools, MVPs, digitale Makler**
- https://www.meineversicherungen-app.de/app-rechtliches/datenschutz/makler · https://www.hash.de/fonds-finanz-login/ · https://www.asscompact.de/nachrichten/fonds-finanz-startet-neue-kunden-app-f%C3%BCr-makler
- https://finfire.de/ · https://www.netfonds.de/fileadmin/Die_Netfonds_Gruppe/News/Blog/2024/finfire/finfire_e-signatur-broschuere.pdf · https://www.profinance.de/ueberuns/profinance-kundenportal/
- https://www.cash-online.de/a/jdc-app-allesmeins-ist-gestartet-307264/ · https://www.jungdms.de/wp-content/uploads/2022/12/PM_20160223_JDC_App_allesmeins_ab_sofort_im_App_Store.pdf · https://www.versicherungsbote.de/id/4837904/Maklerpool-Jung-DMS-Cie-App/
- https://meetergo.com/integrationen/professional-works · https://www.cash-online.de/a/finance-gate-ergaenzt-bestandsverwaltung-von-assfinet-486807/ · https://www.softguide.de/programm/smart-admin-finanzoffice · https://www.cash-online.de/a/siemens-private-finance-kooperiert-mit-smart-insurtech-und-finance-gate-491892/
- https://www.cash-online.de/a/digitale-beratung-von-gewerbekunden-ovb-setzt-auf-thinksurance-561070/ · https://www.cash-online.de/a/mlp-geht-partnerschaft-mit-thinksurance-ein-674732/
- https://www.versicherungsbote.de/job/4889136/
- https://www.kfw.de/stories/wirtschaft/innovation/digitaler-versicherungsmakler-clark/ · https://www.versicherungenmitkopf.de/versicherungs-app/clark-versicherungs-app · https://www.test.de/Versicherung-Knip-Clark-Co-was-taugen-Makler-Apps-5227792-0/ · https://www.test.de/Versicherungs-App-Wenn-die-Clark-App-fremde-Daten-anzeigt-5717856-0/ · https://www.versicherungsbote.de/id/4912720/Check24-Clark-und-Co-Finanztest-rat-von-Makler-Apps-ab/
- https://www.check24.de/files/p/2023/a/2/f/18658-2023_04_21_check24_pm_dtgv_versicherungscenter.pdf · https://www.check24.de/vp-vers/agb/
- https://www.it-finanzmagazin.de/getsafe-schaden-chatbot-87215/ · https://de.trustpilot.com/review/getsafe.de · https://erfahrungenscout.de/versicherung/getsafe-bewertungen

**Robo-Advisor, Vertriebe, Honorarberater**
- https://extraetf.com/de/robo-advisor/gerd-kommer-capital-test · https://geldanlage-digital.de/robo-advisor/gerd-kommer-capital/ · https://gerd-kommer.de/medien/GKC-Migration-Anleitung-fuer-Scalable-Neukunden.pdf · https://gerd-kommer.de/medien/Gerd-Kommer-Whitepaper-V1.0_EN.pdf · https://www.test.de/Neues-Depotangebot-Scalable-Capital-zieht-mit-seinen-Kunden-um-6183743-0/
- https://www.wiwo.de/vergleich/quirion-test/ · https://finanzwissen.de/vergleich/robo-advisor/ · https://extraetf.com/de/erfahrungen/robo-adviser/quirion · https://www.finanzfluss.de/vergleich/robo-advisor/ · https://extraetf.com/de/robo-advisor/growney-test · https://help.ginmon.de/en/articles/117-what-functionalities-does-the-ginmon-app-offer · https://www.biallo.de/robo-advisor/ginmon/steuern-sparen · https://reisetopia.de/geldanlage/ginmon-robo-advisor/ · https://extraetf.com/robo-advisor/evergreen-test · https://erfahrungenscout.de/energie/evergreen-bewertungen · https://www.broker-test.at/news/whitebox-flatex-digitale-vermoegensverwaltung-fuer-flatex-und-degiro/ · https://www.finanzen.net/ratgeber/rechner-vergleiche/robo-advisor-vergleich/ · https://etf.capital/robo-advisor-im-vergleich/
- https://apps.apple.com/DE/app/id6482296545 · https://www.finanzfluss.de/copilot/hilfe/probeabonnement/ · https://reisetopia.de/?p=509581
- https://apps.apple.com/app/id1152836376 (DVAG MeineApp)
- https://mlp.de/service/kundenportal/ · https://www.mlp.de:443/redaktion/downloads/kundeninformation/ueberblick-mlp-banking-und-mlp-financial-home.pdf · https://www.mlp.de:443/redaktion/downloads/kundeninformation/anleitung-postfach-vs-postbox.pdf
- https://www.experten.de/id/4920376/kundennaehe-schaffen-trotz-distanz/index.pdf · https://www.swisslife.ch/de/kundenportale.html · https://www.experten.de/id/4944630/smart-insurtech-entwickelt-app-fuer-ovb-vermoegensberatung/index.pdf
- https://www.honorarfinanz-saar.de/ · https://finsparent.de/ · https://www.plan-invest.org/ · https://www.rheinplan.finance/unabhaengige-finanzberatung/ · https://www.verbund-deutscher-honorarberater.de/honorarberater-magazin/honorarberater/news/online-finanzplanung-hand-in-hand-zwischen-berater-und-mandanttx_news_pi1controllernewstx_news_pi1actionchash1c5ad840ff842bb0d5e0953
- https://www.munich-startup.de/news/wealthpilot-fusioniert-mit-finaplus · https://www.dasinvestment.com/wealthpilot-chef-marco-richter-das-bringt-dem-berater-70-prozent-zeitersparnis/?page=2 · https://info.wealthpilot.de/hubfs/2021/Media/wealthpilot-launcht-portfolio-optimierer-zur-planung-in-der-hybriden-vermoegensberatung.pdf · https://www.capterra.in/software/219610/wealthpilot

**International**
- https://www.nerdwallet.com/investing/learn/betterment-vs-wealthfront · https://www.aol.com/finance/betterment-vs-wealthfront-choosing-best-174208939.html · https://walnutinvest.com/resources/wealthfront-review
- https://ownyourfuture.vanguard.com/content/en/advice/personal-advisor/faq.html · https://smartasset.com:443/financial-advisor/vanguard-personal-advisor-services-review
- https://facet.com/flat-fee-financial-planning/ · https://www.businesswire.com/news/home/20250925121828/en · https://www.range.com/pricing · https://www.finder.com/investments/range-review
- https://emoneyadvisor.com/blog/product_info/emoney-client-portal-be-the-center-of-your-clients-financial-world · https://developer.emoneyadvisor.com/usecase/upload-documents-emoney-vault-0
- https://www.rightcapital.com/blog/client-portal · https://help.rightcapital.com/article/40-inviting-a-client · https://help.wealthbox.com/hc/en-us/articles/29980339724315-How-do-I-enable-the-Wealth-com-integration
- https://www.nutmeg.com/our-fee · https://investmentweek.co.uk/investment-week/news/2414893/fca-firms-heed-nutmegs-fee-transparency · https://blog.moneyfarm.com/en/moneyfarm-news/tech-update-in-app-chat-private-mode-and-more/ · https://www.finder.com/uk/moneyfarm-review

**Altersvorsorgedepot**
- https://www.bundestag.de/dokumente/textarchiv/2026/kw13-de-altersvorsorge-1156798 · https://www.haufe.de/steuern/gesetzgebung-politik/altersvorsorgereformgesetz_168_668868.html · https://www.hksteuerberatung.de/2026/05/15/altersvorsorgereformgesetz-verabschiedet/ · https://finanzfacts.de/wiki/altersvorsorgedepot/aktueller-stand/ · https://www.ing.de/wissen/altersvorsorgedepot/ · https://www.versicherungsbote.de/id/4951124/Das-Altersvorsorgedepot-wird-zum-Transparenztest-fuer-uns-Makler/ · https://www.versicherungsbote.de/id/4949057/Altersvorsorgereform-Vertrieb-wird-strukturell-verhindert/

**Recht und Datenschutz**
- Supabase: https://supabase.com/docs/guides/security/gdpr-compliance · https://supabase.com/docs/guides/functions/regional-invocation · https://supabase.com/docs/guides/auth/auth-mfa · https://supabase.com/docs/guides/auth/auth-email-passwordless · https://supabase.com/docs/guides/auth/passkeys · https://supabase.com/docs/guides/database/vault · https://supabase.com/security · https://github.com/orgs/supabase/discussions/2341 · https://eurobase.app/vs/supabase-dpa
- Netlify: https://www.netlify.com/privacy/ · https://www.netlify.com/gdpr-ccpa/ · https://docs.netlify.com/build/functions/configuration/ · https://docs.netlify.com/manage/security/private-connectivity/
- IONOS: https://www.ionos.de/hilfe/index.php?id=3212
- n8n: https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/configuration-examples/set-a-custom-encryption-key · https://docs.n8n.io/deploy/host-n8n/configure-n8n/security/control-telemetry · https://docs.n8n.io/n8n-community-license/sustainable-use-license · https://nordflux.de/wissen/n8n-dsgvo-self-hosting
- Google: https://workspace.google.com/intl/af/terms/dpa_terms.html
- DPF: https://www.heuking.de/de/news-events/newsletter-fachbeitraege/artikel/eug-bestaetigt-wirksamkeit-des-eu-us-data-privacy-framework.html · https://www.wilmerhale.com/en/insights/blogs/wilmerhale-privacy-and-cybersecurity-law/20251201-european-court-of-justice-to-review-challenge-to-eu-us-data-privacy-framework
- DSK/DSFA/Art. 9: https://www.LDA.brandenburg.de/sixcms/media.php/9/DSK-OH_E-Mail_16-06-2021_final.pdf · https://www.e-recht24.de/artikel/datenschutz/11284-dsgvo-und-e-mail-verschluesselung.html · https://datenschutzzentrum.de/uploads/datenschutzfolgenabschaetzung/20180525_LfD-SH_DSFA_Muss-Liste_V1.0.pdf · https://datenschutz-hamburg.de/fileadmin/user_upload/HmbBfDI/Datenschutz/Informationen/DSFA_Muss-Liste_fuer_den_nicht-oeffentlicher_Bereich_-_Stand_17.10.2018.pdf · https://www.lda.bayern.de/media/pruefungen/DSFA_Schwellwert_Pruefbogen.pdf · https://www.activemind.legal/de/gesetze/dsgvo/erwaegungsgrund-91 · https://www.legiscope.com/blog/dsgvo-versicherungen-vermittler.html · https://www.versicherungsbote.de/id/4897895/WhatsApp-fur-Versicherungsmakler-Datenschutz-ungenuegend/ · https://ivfp.de/wp-content/uploads/2026/07/Einwilligung_Art_9_DSGVO.pdf · https://www.check24.de/vorsorgeversicherungen/download/Einwilligung_Erhebung_Verarbeitung_Gesundheitsdaten.pdf
- BSI (sekundär): https://pardok.parlament-berlin.de/starweb/adis/citat/VT/19/SchrAnfr/S19-20586.pdf · https://www.boerse-express.com/news/articles/nis2-und-phishing-resistenz-bsi-startet-durchgriff-im-mai-2026-899938
- FinVermV: https://www.buzer.de/18a_FinVermV.htm · https://www.buzer.de/18_FinVermV.htm · https://www.buzer.de/17_FinVermV.htm · https://lxgesetze.de/finvermv/14 · https://lxgesetze.de/finvermv/23 · https://www.juraforum.de/gesetze/finvermv/23-aufbewahrung · https://www.ihk-muenchen.de/ihk/documents/Gewerbeerlaubnisse-Internet/Finanzanlagenvermittler/merkblatt_34fh_berufspflichten.pdf · https://www.ihk.de/osnabrueck/recht-und-fair-play/handel-und-gewerbe/finanzanlagenvermittler/aenderungen-der-finanzanlagenvermittlungsverordnung-4583224 · https://www.ihk.de/pfalz/recht/gewerbe-und-pruefungsrecht/finanzanlagenvermittler/neue-finanzanlagenvermittlerverordnung-4844970 · https://finvermv-pruefung.de/aufzeichnungspflichten-nach-%C2%A7-18a-finvermv/ · https://www.iww.de/wvm/maklerrecht/vermittlerrecht-finvermv-neu-ein-ueberblick-ueber-die-ab-01082020-geltenden-aenderungen-f125561 · https://www.fondsprofessionell.de/news/recht/headline/finvermv-serie-3-drei-fragen-zur-neuen-kosteninformationspflicht-193627/ · https://www.gk-law.de/fachbeitraege/34f-vermittler/ex-ante-und-ex-post-kostenausweis-woran-sollten-sich-%C2%A7-34f-vermittler-orientieren/ · https://www.ihk.de/stuttgart/fuer-unternehmen/recht-und-steuern/gewerberecht/informationspflichten-fuer-finanzanlagenvermittler-und-berater-688600 · https://www.offenbach.ihk.de/recht-und-steuern/gewerberecht/gewerberecht-von-a-z/informationspflichten-fuer-finanzanlagenvermittler/ · https://gesetze.legal/eu/vo_eu_2017_565/44
- VersVermV/VVG: https://www.ihk.de/limburg/recht/versicherungsvermittler-und-finanzdienstleister/erstinformationen-15-und-16-versvermv-4508216 · https://www.ihk-bonn.de/fileadmin/dokumente/Downloads/Recht_und_Steuern/Versicherungsvermittler/Informationspflicht.pdf · https://lxgesetze.de/vvg/61 · https://lxgesetze.de/vvg/62 · https://www.iww.de/wvm/archiv/wichtige-fristen-kennen-die-verjaehrung-von-schadenersatzanspruechen-bei-falschberatung-f15086
- Aufbewahrung: https://www.haufe.de/steuern/gesetzgebung-politik/viertes-buerokratieentlastungsgesetz_168_613390.html · https://www.ihk.de/koblenz/unternehmensservice/recht/steuerrecht/allgemein/aufbewahrungsfristen-3547104
- Anlageberatung/Rechner: https://www.gvw.com/aktuelles/blog/detail/aktualisiertes-merkblatt-der-bafin-zur-anlageberatung-und-einordnung-von-finfluencern · https://bundesbank.de/resource/blob/598312/f39e5ee8c04f323690cc8ca1b5fdfa26/mL/informationsblatt-zum-tatbestand-der-anlageberatung-data.pdf
- Impressum/VSBG/BFSG: https://www.ihk.de/ostwestfalen/branchen/dienstleistungen/versicherungs-und-finanzwirtschaft/internet-impressum-6827420 · https://www.ihk-muenchen.de/ihk/documents/Gewerbeerlaubnisse-Internet/Immobiliardarlehensvermittler/merkblatt_impressum_34cdfhi.pdf · https://www.ihk.de/osnabrueck/recht-und-fair-play/handel-und-gewerbe/versicherungsvermittler/aenderung-beim-internetimpressum-6226678 · https://www.ihk.de/bayreuth/hauptnavigation/service/recht/allgemeine-rechtsthemen/anpassung-des-internet-impressums-erforderlich--6512524 · https://www.ihk.de/koeln/hauptnavigation/recht-steuern/informationspflichten-zur-verbraucherschlichtung-5185768 · https://www.ihk.de/koblenz/unternehmensservice/recht/aktuelles/aktuelle-informationen-aus-recht-und-steuern/barrierefreiheit-6616444 · https://ohn.haendlerbund.de/recht/rechtsfragen/diese-drei-ausnahmen-von-der-barrierefreiheitspflicht-sollten-unternehmen-kennen · https://agentur.concordia.de/uploads/tx_pxchve/HVE-Files/13620-000/AgtBl-13620-000-2023-06-Stangneth-Philipp.pdf (IHK-Stade-Anschrift)
