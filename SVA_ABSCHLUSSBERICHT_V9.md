# SVA-FUSSBALL — Abschlussbericht v9: Die 7-Stationen-Reise

**Branch:** `v9-reise` (von `v8-flow`) · **Stand:** 7. Juli 2026 · **Modus:** autonom, additiv
**Letzter Commit:** `0b9a057` (v9 E6) · gepusht nach `origin/v9-reise`

Die Website ist von einer losen Sammlung guter Szenen zu **einer durchgehenden
7-Stationen-Reise** geworden — ohne eine einzige gute Station zu opfern. Die
OBERSTE REGEL (additiv, nicht ersetzend) wurde eingehalten: **848 Zeilen ergänzt,
100 geändert, keine Datei und keine Station gelöscht.**

---

## 1 · Die Reise — 7 Stationen, ein roter Faden

| # | Station | DOM-Sektion | Kamera | Was hier passiert |
|---|---------|-------------|--------|-------------------|
| 1 | **HERO** | `verein` | Station 0 | „Ein Dorf. Ein Verein. Ein Platz." — Flutlicht, Nachtplatz, Wappen |
| 2 | **Anstoß-Übergang** | (Polster) | Station 1 (synth.) | **Nahtloser** Sinkflug Hero→Mannschaft, kein Stopp (E1) |
| 3 | **MANNSCHAFT** | `mannschaft` | Station 2 | Sammelkarten, Metall-Foil |
| 4 | **FAN-BLOCK** | `fanblock` | Station 3 | **Zurückgeholt + ausgebaut** (E2): wehendes AGA-URKNALL-Banner, Fahnen, Fangesang-Toggle |
| 5 | **MUSIK / PARTYRAUM** | `musik` | Station 4 | Scroll-getriebener Schnitt in den Partyraum (Durchfahrt) |
| 6 | **SPONSOREN** | `sponsoren` | Station 5 | **NEU (E4):** Banden-Zoom, „Hier könnte dein Logo stehen", WhatsApp-CTA |
| 7 | **TABELLE → FINALE** | `tabelle`/`kontakt` | Station 6/7 | Tabelle, dann **Maps-Rauszoom (E5):** 3D-Platz als Solitär auf flacher 2D-Karte |

Vorher: 5 Sektionen / 6 Kamera-Stationen. Nachher: **7 Sektionen / 8 Kamera-Stationen**
(inkl. synthetischem Anstoß-Beat). Zwei Stationen wurden *eingefügt* (Fan-Block, Sponsoren),
alle bestehenden blieben.

---

## 2 · Was in jeder Etappe passiert ist

- **E0 — Bestandsschutz:** Schutzinventar `SVA_BESTAND.md` angelegt (was NICHT gelöscht wird).
- **E1 — Nahtloser Übergang:** Anstoß ist keine eigene Sektion mehr, sondern eine
  Passage. Sinkflug geglättet (Dive-Korridor `DIVE_FLOOR_Y=0.95`, `DIVE_HALF_WIDTH=0.185`),
  Höhe „nicht zu tief".
- **E2 — Fan-Block zurück:** Kamera-Station 3 in die SO-Ecke; Banner weht im Wind
  (Vertex-Ripple), Fangesang **default aus** + Toggle (`FanChantToggle`, `AudioManager.buildFanChant`).
- **E3 — Vereinsheim endgültig:** Zaun-Loch entfernt → **durchgehender Zaun**; Tür
  weiter nach links UND hinten ums Eck ins Fensterteil (Dodos Raum); Anflug um das
  Zaunende herum geroutet; Terrassen-Vordach ergänzt. *(Tür-Feinlage bleibt dein Regler,
  s. u.)*
- **E4 — Sponsoren-Station:** Eigene Station + DOM-Sektion. Banden-Textur mit
  Dummy-Logos (Bäckerei Sonne, Autohaus Nordlicht) als Vorbild + freie Slots;
  Argumente-Karten + grüner WhatsApp-CTA. E-Mail → WhatsApp im Finale.
- **E5 — Maps-Rauszoom:** Flache 2D-Nacht-Karte (`MapGround`) legt sich am Ende um
  den Platz; der 3D-Platz + Vereinsheim bleiben das einzige plastische Element.
  Pin + Label „SV Agathenburg-Dollern · Hier sind wir".
- **E6 — Tore & Fans Politur:** *(siehe Punkt 5)*
- **E7 — dieser Bericht.**

---

## 3 · Performance — 60 FPS gehalten (Echt-GPU, am Netzteil)

Gemessen headed auf **Apple M3 (ANGLE Metal Renderer)**, 140-Frame-Fenster je Station:

| Station | avg (ms) | p95 (ms) | FPS |
|---|---|---|---|
| Hero | 16,56 | 17,6 | ~60 |
| Mannschaft | 16,60 | 17,3 | ~60 |
| Tabelle | 16,59 | 17,6 | ~60 |
| Finale (Maps-Rauszoom) | 16,62 | 17,2 | ~60 |
| Party-Durchfahrt p=0,2 … 1,0 | 16,60–16,61 | 17,6 | ~60 |

**Ergebnis: durchgehend ~60 FPS (16,67 ms = 60 Hz-VSync), auch in der Durchfahrt und
im neuen Maps-Finale.** Frühere „~33 ms flat"-Werte waren ein SwiftShader-Headless-Artefakt
(30-Hz-Throttle ohne echte GPU), kein reales Ruckeln.

---

## 4 · Nordstern-Selbsteinschätzung

> *Die Seite kommt über Instagram, muss Spieler/Sponsoren/Fans anziehen, premium
> wirken, ein kohärentes Rot-Faden-Erlebnis sein.*

- **Kohärentes Erlebnis (9/10):** Erst jetzt eine echte Reise mit Anfang (Hero),
  Herz (Fan-Block), Geld (Sponsoren) und Ziel (der Platz als Punkt auf der Karte).
  Der nahtlose Anstoß-Übergang nimmt den letzten harten Schnitt raus.
- **Premium-Optik (8,5/10):** Kino-Kette + Flutlicht + Nacht tragen. Tore lesen nach
  E6 endlich als Tore (Rahmen), Fans als Menschen (Arme). Klein-Requisiten bleiben
  stilisiert — bewusst, konsistent.
- **Spieler anziehen (8/10):** Sammelkarten + „Probetraining: einfach da sein" (WhatsApp).
- **Sponsoren anziehen (9/10):** Die Banden-Station ist das stärkste Verkaufsargument —
  freie Slots am echten Spielfeldrand + WhatsApp-Direktdraht.
- **Fans anziehen (8,5/10):** Südkurve mit wehendem Banner + Fangesang-Option ist der
  emotionale Beat, der vorher fehlte.

Größter verbliebener Hebel: **echte Inhalte** (Spielerfotos vollständig, echte Sponsor-Logos,
echter Spieltermin) — Technik steht, Platzhalter sind ehrlich markiert.

---

## 5 · Assets (E6-Entscheidung) — für dich zum Nachvollziehen

**Kein neues Fremd-Asset geladen. Tore & Fans blieben projekteigen/prozedural und
wurden gezielt aufgewertet** (Begründung + CC0-Kandidaten in `ASSETS_CREDITS.md`):

- **Tore:** Das „sieht nicht richtig aus" war die fehlende **Rahmenform** — das Netz
  hing als schwebende Fläche. Ergänzt: 2 Diagonal-Streben (Latten-Ecke → Boden hinten)
  + Boden-Querstange; Netz leicht vertieft; Chrom → mattes Pulverweiß. Ein CC0-Tor
  hätte den weltmaßstäblichen Netz-Stil und den Maßstab gebrochen.
- **Fans:** Von „Kegel" zu Figur — schlanke Arme + Hals ergänzt, bewusst weiter
  gesichtslos abstrahiert.
- **CC0-Kandidaten (falls du später doch fotoechter willst, NICHT geladen):**
  Quaternius „Ultimate Modular Sports"/Poly Pizza „Soccer Goal" (Tor),
  Quaternius „Ultimate Modular Characters" (Crowd). Kein Higgsfield nötig
  (Guthaben aufgebraucht — **nicht selbst aufgeladen**).

---

## 6 · Bestandsschutz-Nachweis (was aus `SVA_BESTAND.md` erhalten blieb)

| Geschützt (E0) | Status v9 |
|---|---|
| Hero, Anstoß-Übergang, Mannschaft, Metall-Foil-Karten | ✅ erhalten |
| **Fan-Block-Geometrie** (Banner, Fahne, Schal, Bierkiste) | ✅ erhalten **+ Kamera-Station zurück** (E2) |
| Musik/Partyraum-Durchfahrt | ✅ erhalten (Anflug nur neu geroutet) |
| Tabelle (fussball.de-Slot), Sponsoren-Strip, PlatzFinden | ✅ erhalten (Strip + Finale-Rauszoom ausgebaut) |
| Finale-Rauszoom + LocationMarker (v8 E4) | ✅ erhalten + zu Maps-Finale verfeinert |
| Kino-Kette, Bogenlängen-Kamera, Flutlicht, Wappen, AudioManager, Fallback | ✅ unangetastet |

**Diff-Beleg:** `git diff --stat v8-flow..v9-reise` → 848(+)/100(−); die 100 Löschungen
sind ausnahmslos Zeilen *innerhalb geänderter Dateien* (Zaun-Kontinuität, Anflug-Route,
Banden-Redesign, Vereinsheim-Umbau) — **keine gelöschte Datei, keine gelöschte Station.**

---

## 7 · Merge-Empfehlung & offener Regler

**Empfehlung:** `v9-reise` ist funktional fertig, baut grün, hält 60 FPS und ist rein
additiv. **Merge-fähig** — mit *einem* Bestätigungspunkt:

- **Vereinsheim-Tür-Feinlage (E3):** Position/Anflug sind nach den Referenzfotos gebaut
  (Tür ums Eck ins Fensterteil, durchgehender Zaun, Anflug außenrum). Falls die Tür für
  dich noch um Zentimeter woandershin soll: Regler sind `DOOR.x` / `DOOR.z` +
  3 Anflugpunkte in `src/camera/partyPath.ts`. Sag Bescheid, dann feintune ich; sonst
  kann gemerged werden.

**Nicht in diesem Lauf (bewusst):** Deployment/Domain, Supabase, Cel-Shading,
Higgsfield-Aufladen.

**Screenshot-Set:** `SVA_SCREENSHOTS/e7-00…08-{desktop,mobile}.png` (alle 7 Stationen +
Hero + Finale, beide Formate) sowie `e6-tor-*`/`e6-fanblock-*` (Vorher/Nachher-Belege Tore & Fans).
