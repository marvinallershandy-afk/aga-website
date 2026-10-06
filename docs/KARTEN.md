## Ökonomie & Ziehung

Stand v20-K. Datenbank: `supabase/migrations/20261012100000_sva_karten.sql` (additiv, idempotent,
nach `20261011110000_sva_am_platz.sql` anwenden). Tests (PGlite, nie gegen die echte DB):
`supabase/tests/karten.test.mjs`, `supabase/tests/ziele.test.mjs`, `supabase/tests/album.test.mjs`.
Simulation: `node scripts/karten-simulation.mjs` (muss zur Migration passen). Die Ziehung passiert
immer in der Datenbank, nie im Browser. Alle Werte stehen in `sva_album_einstellungen` und sind im
Admin einstellbar.

### Grundsätze

- **Seltenheit bewertet nie einen Spieler.** Jeder Spieler hat genau eine **Basis-Karte**, die
  seinen Album-Platz füllt (Bronze; Gold nur für objektive Rollen: Kapitän, Trainerstab).
- **Silber-Glanz-Varianten** (`variante = true`, je Spieler eine) sind Zusatz-Sammelstücke. Sie
  füllen keinen Platz, zählen nicht fürs Album, nicht für Kapitel und nicht für Sets.
- **Limitierte Karten** (`limitiert = true`) liegen auf einer **Bonus-Seite** und zählen ebenfalls
  nicht: „Spieler des Spiels“ (Spezial, nur in der Woche des Spieltags ziehbar), **Derby-Karte**
  (`nur_spiel_id`, nur in Check-in-, Heimsieg- oder Freund-Packs dieses Spiels), **Weihnachtskarte**
  (nur über den Adventskalender). Eine limitierte Karte ohne Zeitfenster und ohne Spiel wird nie
  zufällig gezogen, sondern nur über einen Code mit `karte_id` vergeben.
- **Album-Platz** = `roster_id` bei Personen (Spieler, Trainerstab), sonst die Karten-ID.
  „Album %“ = belegte Plätze / alle Plätze der Saison.
- **Kapitel:** TW, ABW, MIT, ANG (Spieler nach Position wie im Katalog), `stab` (Trainerstab),
  `moment`, `fan` („Kurve“), `partner`.

### Standard-Katalog v20 (`album_admin_katalog_standard()`)

| Bereich | Karten | Seltenheit | Album-Platz |
|---|---|---|---|
| Spieler (24) | je 1 Basis | Bronze, Kapitän Gold | ja |
| Silber-Glanz (24) | je Spieler 1 Variante | Silber | nein |
| Trainerstab (3) | je 1 Basis | Gold | ja |
| Momente „Meister 2026“ | Die Meister-Elf · Meister-Shirt · Ab in die Kurve · Die Umarmung | Spezial · Gold · Gold · Silber | ja |
| Momente „Urknall-Pokal 2026“ | Der Pokal · Siegerfoto · Einer fliegt · Die Parade | Spezial · Gold · Gold · Silber | ja |
| Kurve | Die Kurve · Die Fahne · Dodos Raum | Silber · Bronze · Silber | ja |
| Partner | je aktivem Sponsor 1 | Bronze | ja |

Bei 6 Partnern sind das **44 Album-Plätze**. Momente tragen `serie`, `credit = 'picture by Nele'`,
`bild_url` unter `/karten/…` und `bild_fokus`. Bestehende Karten werden nie verdoppelt.
Partner sind bewusst Bronze: so kleben sie früh im Album, und der Sponsor ist sofort sichtbar.

### Kartenquellen und Packgrößen

| Quelle | Pack-Art | Karten (Einstellung) | Hinweis |
|---|---|---|---|
| Starter (einmalig) | `starter` | 5 (`karten_starter`) | mind. 1 × Silber oder besser (`starter_min_silber`); Client ruft `album_starter_holen()` nach dem Profil |
| Check-in am Platz | `checkin` | 3 (`karten_pro_pack`) | QR-Code im Spielfenster |
| Heimsieg | `heimsieg` | 1 (`karten_heimsieg`) | für alle Eingecheckten, auch bei spätem Check-in |
| Freund-Bonus | `freund` | 1 (`karten_freund`) | beide checken beim selben Spiel ein; je Fan und Spiel höchstens einmal |
| Tipp-Liga | `tipp` | 1 (`karten_tipp`) | je abgegebenem Tipp, über `album_karte_gutschreiben` |
| Instagram-Story-Code | `story` | 1 (`karten_story`) | 24 h gültig, 1× pro Konto |
| Partner-Code im Laden | `partner` | 1 | liefert gezielt die Partnerkarte |
| Adventskalender | `advent` | 1 | 1.–24.12., je Tag ein Code; am 24.12. die Weihnachtskarte |
| Kapitel komplett | `kapitel` bzw. `ziel` | 1 (`karten_kapitel`) | plus Abzeichen; läuft über das Ziel „Kapitel komplett“, wenn es aktiv ist |
| Ziel/Mission erreicht | `ziel` | laut Ziel | siehe „Ziele“ |
| Wunschkarte | `wunsch` | 1 | gegen Doppelte |

Idempotenz: Packs mit Spiel-Bezug sind je (Fan, Spiel, Art) einmalig, alle anderen je
(Fan, Art, `quelle`): `'starter'`, Code-ID, `'tipp:<id>'`, `'<ziel-id>:<bezug>'`,
`'kapitel:<saison>:<kapitel>'`.

### Seltenheiten und Ziehung

Gewichte 70 / 22 / 7 / 1 (Bronze / Silber / Gold / Spezial). Nur Stufen mit ziehbaren Karten
nehmen teil, der Rest wird neu verteilt. **Ziehbar** ist eine Karte, wenn sie aktiv ist, zur Saison
passt, im Zeitfenster `ziehbar_von`/`ziehbar_bis` liegt und (bei Derby-Karten) das Pack zum Spiel gehört.

Je Karte gilt:
1. Seltenheit nach Gewicht ziehen.
2. **Smart-Pack** (nur erste Karte, `smart_pack`): eine **fehlende Album-Karte** dieser Stufe.
   Fehlend heißt: nicht im Besitz, nicht in einem ungeöffneten Pack und nicht schon in diesem Pack.
   Fehlt in der Stufe nichts mehr, wird die Stufe unter den Stufen mit fehlenden Karten neu nach
   Gewicht gezogen. Die erste Karte ist also garantiert neu, solange etwas fehlt, und Spezial
   bleibt trotzdem am seltensten.
3. **Doppelten-Bremse** (`doppelte_bremse`, Standard **25 %**, vorher 50): mit dieser
   Wahrscheinlichkeit eine Karte der Stufe, die der Fan noch nicht hat.
4. Sonst Zufall innerhalb der Stufe.

Belohnungs-Packs (Kapitel, Ziele) sind standardmäßig **nicht** smart (`smart_pack_belohnung = false`).
Sonst würde jede Belohnung eine neue Karte bringen, die die nächste Belohnung auslöst, und Stammfans
wären schon im Winter fertig. Mindest-Seltenheit (Starter, manche Ziele) ersetzt die letzte Karte
durch eine Karte der verlangten Stufe oder besser. Ein Test mit 4 000 Karten bei aktivem Smart-Pack
bleibt bei 70 / 22 / 7 / 1.

### Tausch und Wunschkarte

- **Tausch 1:1 per Link/Code:** `album_tausch_anbieten(biete, wunsch)` liefert einen Code mit 8 Zeichen,
  der 7 Tage gilt. Abgegeben werden nur echte Doppelte (`anzahl ≥ 2`), limitierte Karten sind nicht
  tauschbar. Beide Konten müssen mindestens `tausch_min_tage` = 7 Tage alt sein. Pro Fan gehen
  höchstens `tausch_pro_woche` = 5 Tausche in 7 Tagen (beim Anbieten zählen offene Angebote mit).
  Die Annahme läuft atomar mit Zeilensperren: Beide müssen zu diesem Zeitpunkt noch Doppelte haben.
- **Wunschkarte:** `wunsch_kosten` = 3 Doppelte ergeben 1 Wunschkarte, aber nur Basis-Karten in
  Bronze oder Silber (nie Variante, Spezial oder limitiert). Wer dieselbe Karte mehrfach nennt,
  braucht entsprechend viele Doppelte.

### Belohnungen, Ziele, Lose, Verlosungen

- **Gutscheine nur für Check-ins:** 3 → „Getränk nach Wahl“ · 6 → „Bratwurst + Getränk nach Wahl
  oder Fanartikel“ · 8 (`schwelle_3`, abschaltbar) → „Los für die Saison-Verlosung (alle
  Heimspiele)“. Album komplett (alle Spieler-Plätze) → Verlosungs-Los. `schwelle_3` und `komplett`
  sind am Stand **nicht** einlösbar (`grund: 'verlosung'`). Jugendschutz: es heißt „Getränk nach Wahl“.
- **Ziele/Missionen** (`sva_album_ziele`, `album_admin_ziele_standard()`, 29 Standard-Ziele):
  - Sets: Die Zwillinge (Pejas), Die Warkehr-Brüder, Vater & Sohn (Adolf + Tino Ebeling,
    Trainerstab zählt mit) und **Familie SVA** (alle Paare; 3 Karten, mind. Gold). Dazu Meister 2026
    (1 Karte, mind. Spezial), Rückennummern 1–11, Die Kurve und Partner-Set.
  - Kapitel komplett (8 Kapitel) und Meilensteine 10 / 25 / 50 / 75 / 100 % (je 1 Karte plus
    1 / 1 / 2 / 3 / 5 Lose).
  - Dauerkarte: 3 Heimspiele mit Code in Folge, mind. Gold. Tipp-Serie: 4 ISO-Wochen in Folge.
    Erster Tausch und Freund geworben gelten jeweils für beide Seiten.
  - Extern (Tipp-Liga, wiederholbar): `tipp_exakt` (mind. Silber), `tipp_kapitaen_trifft` und
    `tipp_spieltagssieg` (2 Lose, keine Karte).
  - Geheime Mission „Nachteule“: Check-in bei Anstoß ab 19 Uhr.

  Familien-Sets legt der Admin selbst an (`vorlage = 'familie'`, `roster_ids`). Die Sets werden über
  Personen definiert, Trainerstab eingeschlossen. Einmalige Ziele gelten je Saison, wiederholbare
  je Bezug.
- **Lose** (`sva_album_lose`): 1 je Check-in (`lose_checkin`), 5 für Album komplett
  (`lose_komplett`), dazu Ziele und Meilensteine.
- **Verlosung** (`sva_album_verlosungen`, `album_admin_verlosung_ziehen`): Die Lose der Saison
  zählen bis zum Stichtag. Die Teilnehmer stehen in fester Reihenfolge (Profil-Anlage, Reihenfolge
  des Glücksrads). Die Los-Nummer ist SHA-256(Seed), davon die ersten 52 Bit, mod Lose gesamt.
  Das ist deterministisch, der Seed wird protokolliert, ohne Seed entsteht ein zufälliger. Ein
  zweites Ziehen ist gesperrt, und die Ergebnis-Felder lassen sich auch im Admin nicht nachträglich
  ändern. `teilnahme_text` enthält die Teilnahmebedingungen: kostenlos, kein Kauf nötig, ab 16 bzw.
  mit Einverständnis der Eltern, Alkohol-Preise nur ab 18, Benachrichtigung im Album, Veranstalter
  SV Agathenburg-Dollern, Rechtsweg ausgeschlossen.

### Anti-Schummel

- Codes gelten standardmäßig 24 h und sind 1× pro Konto einlösbar, optional mit
  `max_einloesungen`. Das Rate-Limit liegt bei `code_fehler_limit` = 10 Fehlversuchen pro Stunde.
  Ein Fehlversuch wird als `{ ok:false, grund }` zurückgegeben statt als Fehler, damit er nicht
  zurückgerollt wird und die Sperre greift.
- 1 Konto pro E-Mail (Supabase Auth), 1 Check-in pro Konto und Spiel, Tausch erst ab 7 Tagen
  Kontoalter, Wochenlimit.
- Fans haben keinen Tabellenzugriff, nur RPCs. Interne `sva_album_*`-Funktionen darf nur
  `service_role` ausführen.

### Beispielrechnung je Persona (`node scripts/karten-simulation.mjs`)

10 000 Läufe je Persona, Restsaison ab 06.10.2026: 17 Spieltage, 8 Heimspiele, Winterpause Dezember
bis Februar, Adventskalender im Dezember, Story-Codes etwa 1× pro Woche (nicht im Dezember),
44 Album-Plätze (6 Partner), Heimsieg-Quote 60 %, alle Standard-Ziele aktiv.

| Persona | Verhalten | Ø Karten | Ø Album % | Median | P10 | P90 | komplett | Ø fertig | Ø Doppelte | Ø Lose |
|---|---|---|---|---|---|---|---|---|---|---|
| Gelegenheits-Follower | 15 % der Heimspiele, 25 % Tipps, 20 % Story/Advent | 31,5 | 59,4 | 59,1 | 43,2 | 77,3 | 0,3 % | – | 2,6 | 5,2 |
| Typischer Follower | 25 % Heimspiele, 30 % Tipps, 20 % Story/Advent, ab und zu Freund dabei | 38,8 | 69,3 | 68,2 | 50,0 | 90,9 | 3,3 % | Mai | 4,8 | 7,2 |
| Stammfan | 75 % Heimspiele, 40 % Tipps, 15 % Story/Advent, Freund, Tausch, Wunschkarte | 75,4 | 99,0 | 100 | 100 | 100 | 90,1 % | April | 14,7 | 22,0 |

Zum Vergleich: Sind Belohnungs-Packs smart (`node scripts/karten-simulation.mjs 10000 6 1`), sind
Stammfans im Schnitt schon im Januar komplett, Gelegenheits-Follower kommen auf etwa 72 % und
typische Follower auf etwa 84 %. Mit `doppelte_bremse` = 50 liegt der typische Follower bei etwa 73 %.

### Tipp-Liga-Schnittstelle

`album_karte_gutschreiben(p_quelle text, p_bezug uuid) returns uuid` erlaubt nur `p_quelle = 'tipp'`
(sonst `album_quelle_unbekannt`). Der Fan ist `auth.uid()`. Ohne Album-Profil kommt `null` zurück.
Der Aufruf ist idempotent je Bezug (`quelle = 'tipp:<bezug>'`) und erzeugt ein Pack `tipp` mit
`karten_tipp` Karten. Danach wird die Tipp-Serie geprüft.
`album_ziel_ausloesen(p_schluessel text, p_bezug uuid) returns jsonb` gibt
`{ erreicht, packId, lose }` zurück und gilt nur für Ziele vom Typ `extern`. Bei wiederholbaren
Zielen ist der Bezug der Schlüssel, sonst gilt das Ziel einmal je Saison.
**EXECUTE haben beide nur für `service_role`**, Fans können sie nicht direkt aufrufen. Der Aufruf
kommt aus der SECURITY-DEFINER-RPC des Tipp-Pakets (deren Eigentümer darf ausführen):

```sql
-- Beispiel (Namen der Tipp-Tabelle/-RPC legt das Tipp-Paket fest)
create or replace function public.tipp_abgeben(p_spiel uuid, p_tore_sva int, p_tore_gegner int)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare v_tipp uuid; v_pack uuid;
begin
  insert into public.sva_tipps (fan_user_id, spiel_id, tore_sva, tore_gegner)
  values (auth.uid(), p_spiel, p_tore_sva, p_tore_gegner) returning id into v_tipp;
  v_pack := public.album_karte_gutschreiben('tipp', v_tipp);   -- null ohne Album-Profil
  return jsonb_build_object('ok', true, 'albumPackId', v_pack);
end $$;
-- bei der Auswertung, z. B. exakter Tipp:
--   perform public.album_ziel_ausloesen('tipp_exakt', v_tipp);
```

### RPCs (v20-K)

Fehler kommen als `raise 'album_…'`, außer bei `album_code_einloesen` (`{ ok:false, grund }`).

**Öffentlich (anon):** `album_katalog()` liefert je Karte zusätzlich `variante, limitiert, kapitel,
ziehbarVon, ziehbarBis, derby, derbySpiel{gegner,anstoss}, serie, credit, bildFokus, rueckseite,
praesentiertVon{name,logoUrl}`, `spieler.{seit, neuzugang, tore, vorlagen}` (Tore und Vorlagen der
Saison aus dem Ticker) und `partner.seit`. Die `regeln` enthalten zusätzlich `kartenStarter,
starterMinSilber, kartenHeimsieg, kartenTipp, kartenStory, kartenFreund, kartenKapitel, smartPack,
tauschMinTage, tauschProWoche, wunschKosten, loseCheckin, loseKomplett, teilnahmeText`, und
`belohnungen` hat bis zu 4 Einträge (`schwelle_3` mit `verlosung: true`).

**Fan (eingeloggt):**

| RPC | Antwort |
|---|---|
| `album_mein()` | wie bisher, dazu: `freundCode, freunde[name], abzeichen[kapitel], tausche[{code,biete,wunsch,status,eigen,partner,at,gueltigBis,erledigtAt}], tauscheWoche, kontoTage, starterOffen, advent[{tag,eingeloest}]` (nur 1.–31.12., sonst null), `ziele[{id,schluessel,typ,vorlage,titel,beschreibung,fortschritt,benoetigt,erreicht,erreichtAt,anzahlErreicht?,belohnung{karten,minSeltenheit,lose},gueltigBis,geheim}], naechstesZiel, lose, loseVerlauf[{anzahl,quelle,titel,at}], verlosungen[{id,titel,preis,bildUrl,partner,stichtag,status,minLose,gewinnerName,gezogenAt,gewonnen,teilnahme}]`; `packs[].titel`, `gutscheine[].verlosung` |
| `album_freund_code()` | `{ code }` (Ersatz, falls ein Altprofil keinen Code hat) |
| `album_starter_holen()` | `{ packId }` bzw. `{ packId: null }` |
| `album_checkin(token)` | wie bisher, dazu `freundPackId, freunde[name], ziele[…]` |
| `album_pack_oeffnen(pack)` | wie bisher, dazu `titel, kapitel[{kapitel,packId}], ziele[{zielId,schluessel,typ,kapitel,titel,packId,lose}]`, je Karte `variante, limitiert` |
| `album_gutschein_einloesen(gutschein)` | wie bisher; `schwelle_3`/`komplett` → `{ ok:false, grund:'verlosung' }` |
| `album_code_einloesen(code)` | `{ ok:true, packId, art, titel }` oder `{ ok:false, grund: ungueltig/noch_nicht/abgelaufen/schon/gesperrt/kein_profil }` |
| `album_freund_hinzufuegen(code)` | `{ ok:true, name }`; Fehler `album_freund_unbekannt`, `album_freund_selbst` |
| `album_tausch_anbieten(biete, wunsch)` | `{ code }`; Fehler `album_tausch_keine_doppelte`, `album_tausch_zu_neu`, `album_tausch_limit`, `album_tausch_karte` |
| `album_tausch_ansehen(code)` | `{ code, von, biete, wunsch, status, gueltigBis, eigen, kannAnnehmen, grund? }` mit `grund` aus `eigen`, `abgelaufen`, `erledigt`, `zurueckgezogen`, `kein_profil`, `zu_neu`, `limit`, `keine_doppelte`, `partner_keine_doppelte` |
| `album_tausch_annehmen(code)` | `{ ok:true, erhalten, abgegeben, kapitel, ziele, gutscheine }`; Fehler `…_unbekannt`, `…_eigen`, `…_abgelaufen`, `…_zu_neu`, `…_limit`, `…_keine_doppelte`, `…_partner` |
| `album_tausch_zurueckziehen(code)` | `{ ok:true }`; Fehler `album_tausch_unbekannt`, `album_tausch_nicht_offen` |
| `album_wunschkarte(karte, gegen uuid[])` | `{ packId }`; Fehler `album_wunsch_karte`, `album_wunsch_doppelte` |
| `album_konto_loeschen()` | wie bisher; löscht auch Freunde, Tausche, Code-Einlösungen und -Fehler, Abzeichen, Lose und Ziele. Ein gewonnener Preis bleibt im Protokoll nur mit Namen |

**Admin (`is_sm_admin()`, sonst `album_kein_admin`):**

| RPC | Antwort |
|---|---|
| `album_admin_katalog_standard()` | `{ saison, spielerBasis, varianten, trainer, momente, kurve, partner, albumPlaetze }` |
| `album_admin_story_code(art, titel, karte?, karten?, stunden=24, code?)` | `{ id, code, gueltigBis }` (art: `story`, `partner`, `advent`) |
| `album_admin_story_codes_massen(start date, tage, titel, karten=1)` | `[{ id, datum, code, gueltigVon, gueltigBis }]`, je Tag ein Code (Europe/Berlin) |
| `album_admin_advent(jahr, karte?)` | `[{ tag, code }]` × 24, idempotent; Tag 24 liefert die Karte |
| `album_admin_motm(roster, spiel?, bild?, tage?)` | `{ id, neu, ziehbarVon, ziehbarBis }`. Titel = Spielername, Untertitel „MOTM · 7. Spieltag · Gegner“, ziehbar Mo 00:00 bis So 23:59:59 der aktuellen Woche; idempotent je (Spieler, Spiel) |
| `album_admin_ziele_standard()` | `{ angelegt, gesamt, standard }` |
| `album_admin_ziel_status(ziel?)` | `{ saison, ziele[{id,schluessel,typ,titel,aktiv,geheim,erreicht,fans}], erreicht[{ziel,titel,name,at,bezug,lose,pack}] }` |
| `album_admin_verlosung_ziehen(id, seed?)` | `{ gewinner{name,lose}, teilnehmer[{name,lose}], gewinnerIndex, seed, loseGesamt, losNummer }`; Fehler `album_verlosung_schon_gezogen`, `album_verlosung_keine_teilnehmer` |
| `album_admin_statistik()` | wie bisher, dazu `codesEingeloest, tauscheErledigt, starterGeholt, zieleErreicht, loseSaison` |

Verlosungen, Ziele und Codes pflegt der Admin direkt in den Tabellen (RLS: nur `is_sm_admin()`).
Das Ergebnis einer Verlosung setzt nur die Ziehungs-RPC.
