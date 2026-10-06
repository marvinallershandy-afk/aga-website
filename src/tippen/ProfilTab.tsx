import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { ArrowRight, BookOpen, HelpCircle, LogOut, Share2, Users } from 'lucide-react'
import { abmelden, IST_VORFUEHRUNG, ladeAlbumStand, profilSpeichern, TippFehler, type AlbumStand, type Lage } from './api'
import { ABZEICHEN, haptik } from './model'
import { bildAbzeichen, teilen } from './share'
import { zaehleEreignis } from '../statistik/zaehlen'
import { Avatar, Kapitel, Medaille, Zaehler } from './teile'
import type { Tab } from './TippApp'

// ─────────────────────────────────────────────────────────────
// v20-T/v21: Profil — Anzeigename (Vorname + Initial), freiwillig öffentlich,
// Saisonzahlen (zählen hoch), Abzeichen als geprägte Medaillen (neu
// freigeschaltete drehen sich einmal auf, mit Lichtstreif), Album-Stand.
// ─────────────────────────────────────────────────────────────

// v21-UX (Requirement 7): Vorschau, wie der eigene Eintrag in einer öffentlichen
// Rangliste aussähe — macht die Opt-in-Entscheidung greifbar.
export function RanglistenVorschau({ sichtbar, vorname, initial }: { sichtbar: boolean; vorname: string; initial: string }) {
  const anzeige = `${vorname.trim() || 'Vorname'} ${initial.trim() ? `${initial.trim().toUpperCase()}.` : 'I.'}`
  return (
    <div className={`tp-vorschau${sichtbar ? ' is-an' : ''}`} aria-hidden="true">
      <span className="tp-vorschau__label">{sichtbar ? 'So sieht dich jeder in der Rangliste:' : 'Nur du siehst dich (privat):'}</span>
      <span className="tp-vorschau__zeile">
        <span className="tp-vorschau__platz">7.</span>
        <Avatar name={anzeige} groesse={30} ich />
        <b>{sichtbar ? anzeige : 'Du'}</b>
        {!sichtbar && <small>privat</small>}
      </span>
    </div>
  )
}

export function ProfilTab({
  lage,
  session,
  onAnmelden,
  onNeu,
  onTab,
}: {
  lage: Lage
  session: Session | null
  onAnmelden: () => void
  onNeu: () => Promise<Lage | null>
  onTab: (t: Tab) => void
}) {
  const ich = lage.ich
  const [vorname, setVorname] = useState(ich?.profil?.vorname ?? '')
  const [initial, setInitial] = useState(ich?.profil?.initial ?? '')
  const [sichtbar, setSichtbar] = useState(ich?.teilnehmer?.sichtbar ?? false)
  const [meldung, setMeldung] = useState('')
  const [fehler, setFehler] = useState('')
  const [teilt, setTeilt] = useState<string | null>(null)
  const [album, setAlbum] = useState<AlbumStand | null>(null)
  useEffect(() => {
    if (!session) return
    let aktiv = true
    void ladeAlbumStand().then((s) => aktiv && setAlbum(s))
    return () => {
      aktiv = false
    }
  }, [session])

  if (!session) {
    return (
      <div className="tp-profil tp-leer">
        <p className="tp-kicker">Profil</p>
        <h1 className="tp-titel">Noch nicht dabei?</h1>
        <p className="tp-lead">Ein Konto für Tipp-Liga und Sammelalbum. Kein Passwort — nur deine E-Mail.</p>
        <button type="button" className="tp-btn" onClick={onAnmelden}>
          Anmelden
        </button>
      </div>
    )
  }

  const hat = new Map((ich?.abzeichen ?? []).map((a) => [a.key, a.at]))
  const jetzt = new Date(lage.serverNow).getTime()
  const st = ich?.statistik

  const speichern = async (e: React.FormEvent) => {
    e.preventDefault()
    setFehler('')
    setMeldung('')
    try {
      await profilSpeichern(vorname.trim(), initial.trim(), sichtbar)
      setMeldung('Gespeichert.')
      haptik(8)
      await onNeu()
    } catch (err) {
      setFehler(err instanceof TippFehler ? err.message : 'Das hat nicht geklappt.')
    }
  }

  const teilenAbz = async (key: string) => {
    setTeilt(key)
    try {
      const c = await bildAbzeichen(key, ich?.profil?.anzeigename, lage.einstellungen.partner)
      if ((await teilen(c, `sva-abzeichen-${key}.png`, 'Abzeichen · SVA Tipp-Liga')) !== 'fehler') zaehleEreignis('tipp-teilen')
    } finally {
      setTeilt(null)
    }
  }

  return (
    <div className="tp-profil">
      <section className="tp-profil__kopf">
        <Avatar name={ich?.profil?.anzeigename ?? '?'} groesse={84} kabine={ich?.teilnehmer?.kabine} ich />
        <div>
          <p className="tp-kicker">
            {ich?.teilnehmer?.kabine ? 'Kabine' : 'Fan'} · Saison {lage.saison}
          </p>
          <h1 className="tp-titel">{ich?.profil?.anzeigename ?? 'Neu hier'}</h1>
          <p className="tp-meta">{IST_VORFUEHRUNG ? 'Beispiel-Konto der Vorführung' : ich?.email}</p>
        </div>
      </section>

      {ich?.teilnehmer ? (
        <>
          <dl className="tp-zahlen">
            {(
              [
                ['Punkte', st?.punkte ?? 0],
                ['Spieltage', st?.spieltage ?? 0],
                ['Exakt', st?.exakt ?? 0],
                ['Bester Tag', st?.beste ?? 0],
              ] as const
            ).map(([l, n]) => (
              <div key={l}>
                <dt>{l}</dt>
                <dd>
                  <Zaehler wert={n} dauer={0.9} />
                </dd>
              </div>
            ))}
          </dl>

          <section className="tp-abschnitt" aria-labelledby="tp-h-abz">
            <Kapitel id="tp-h-abz" titel="Abzeichen" meta={`${hat.size}/${ABZEICHEN.length}`} />
            <ul className="tp-abz">
              {ABZEICHEN.map((a, i) => {
                const at = hat.get(a.key)
                const da = !!at
                const neu = da && jetzt - new Date(at!).getTime() < 3 * 86400_000
                return (
                  <motion.li
                    key={a.key}
                    className={`${da ? 'is-da' : ''}${neu ? ' is-neu' : ''}`}
                    initial={da ? { opacity: 0, rotateY: neu ? 100 : 0, scale: neu ? 0.7 : 0.94 } : { opacity: 0 }}
                    whileInView={{ opacity: 1, rotateY: 0, scale: 1 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ delay: neu ? 0.25 : i * 0.035, duration: neu ? 0.8 : 0.32, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <span className="tp-medaille-buehne">
                      <Medaille a={a} da={da} groesse={68} />
                      {neu && <i className="tp-glanz" aria-hidden="true" />}
                    </span>
                    <b>{a.titel}</b>
                    <small>{a.text}</small>
                    {neu && <span className="tp-abz__neu">Neu</span>}
                    {da && (
                      <button type="button" className="tp-abz__teilen" onClick={() => void teilenAbz(a.key)} disabled={teilt === a.key} aria-label={`${a.titel} teilen`}>
                        <Share2 size={14} strokeWidth={1.5} aria-hidden="true" />
                      </button>
                    )}
                  </motion.li>
                )
              })}
            </ul>
          </section>

          <a className="tp-albumkarte" href="/album">
            <span className="tp-albumkarte__icon" aria-hidden="true">
              <BookOpen size={22} strokeWidth={1.5} />
            </span>
            <span className="tp-albumkarte__text">
              <small>Dein Sammelalbum · gleiches Konto</small>
              <b>{album ? `${album.belegt} von ${album.gesamt} Karten` : 'Jeder Tipp bringt eine Karte'}</b>
              {album && (
                <span className="tp-albumkarte__balken" aria-hidden="true">
                  <i style={{ transform: `scaleX(${album.gesamt ? album.belegt / album.gesamt : 0})` }} />
                </span>
              )}
              {album && album.tuetchen > 0 && (
                <em>
                  {album.tuetchen} {album.tuetchen === 1 ? 'Tütchen wartet' : 'Tütchen warten'} aufs Öffnen
                </em>
              )}
            </span>
            <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
          </a>

          <form className="tp-abschnitt tp-formblock" onSubmit={speichern}>
            <Kapitel titel="Dein Name in der Tipp-Liga" />
            <div className="tp-zeile">
              <label className="tp-feld tp-feld--gross">
                <span>Vorname</span>
                <input value={vorname} onChange={(e) => setVorname(e.target.value)} autoComplete="given-name" maxLength={24} />
              </label>
              <label className="tp-feld tp-feld--initial">
                <span>Initial</span>
                <input value={initial} onChange={(e) => setInitial(e.target.value.slice(0, 1))} maxLength={1} />
              </label>
            </div>
            <label className="tp-schalter">
              <input type="checkbox" checked={sichtbar} onChange={(e) => setSichtbar(e.target.checked)} />
              <span>
                <b>In öffentlichen Ranglisten zeigen</b>
                <small>Feier deine Siege sichtbar mit — oder bleib privat. Jederzeit änderbar; in deinen Ligen sehen dich die Mitglieder ohnehin.</small>
              </span>
            </label>
            <RanglistenVorschau sichtbar={sichtbar} vorname={vorname} initial={initial} />
            {fehler && <p className="tp-hinweis tp-hinweis--fehler">{fehler}</p>}
            {meldung && <p className="tp-hinweis tp-hinweis--ok">{meldung}</p>}
            <button type="submit" className="tp-btn tp-btn--line">
              Speichern
            </button>
          </form>
        </>
      ) : (
        <div className="tp-leer">
          <p className="tp-lead">Du bist angemeldet, tippst aber noch nicht mit.</p>
          <button type="button" className="tp-btn" onClick={onAnmelden}>
            Jetzt mitmachen
          </button>
        </div>
      )}

      <details className="tp-regeln tp-regeln--offen">
        <summary>Alle Regeln</summary>
        <h3>Ergebnis-Tipp</h3>
        <dl>
          <div><dt>Exaktes Ergebnis</dt><dd>4</dd></div>
          <div><dt>Richtige Tordifferenz</dt><dd>3</dd></div>
          <div><dt>Richtige Tendenz</dt><dd>2</dd></div>
          <div><dt>Erster SVA-Torschütze</dt><dd>+3</dd></div>
          <div><dt>Spieler des Spiels (Wahl auf Instagram)</dt><dd>+2</dd></div>
          <div><dt>Bonusfrage richtig (3 pro Spieltag)</dt><dd>+1</dd></div>
          <div><dt>Joker (1× pro Monat) auf deine Tipp-Punkte</dt><dd>×2</dd></div>
        </dl>
        <h3>Deine Elf · 1 TW · 1 ABW · 2 MIT · 1 ANG</h3>
        <dl>
          <div><dt>Einsatz</dt><dd>+1</dd></div>
          <div><dt>Tor · Vorlage</dt><dd>+5 · +3</dd></div>
          <div><dt>Zu null (TW/ABW, mind. 60 Min.)</dt><dd>+4</dd></div>
          <div><dt>Spieler des Spiels</dt><dd>+5</dd></div>
          <div><dt>Sieg (alle Eingesetzten)</dt><dd>+2</dd></div>
          <div><dt>Gelb · Gelb-Rot · Rot</dt><dd>−1 · −3 · −4</dd></div>
          <div><dt>Kapitän (Binde selbst wählen)</dt><dd>×2</dd></div>
        </dl>
        <p>
          Einige Mittelfeldspieler dürfen auch in den Angriff (steht in der Auswahl als „auch Angriff“). Getippt wird bis zum Anpfiff — nur Pflichtspiele des SVA,
          auch auswärts. Punkte gibt’s nach dem Spielbericht, meist am Sonntagabend. Kostenlos, ohne Einsatz. <a href="/teilnahmebedingungen">Teilnahmebedingungen</a>
        </p>
      </details>

      <div className="tp-zeile-knoepfe">
        <button type="button" className="tp-btn tp-btn--line tp-btn--sm" onClick={() => window.dispatchEvent(new Event('tp-einfuehrung'))}>
          <HelpCircle size={16} strokeWidth={1.5} aria-hidden="true" /> So funktioniert’s
        </button>
        <button type="button" className="tp-btn tp-btn--line tp-btn--sm" onClick={() => onTab('ligen')}>
          <Users size={16} strokeWidth={1.5} aria-hidden="true" /> Meine Ligen
        </button>
        {!IST_VORFUEHRUNG && (
          <button
            type="button"
            className="tp-btn tp-btn--text tp-btn--sm"
            onClick={async () => {
              await abmelden()
              window.location.assign('/tippen')
            }}
          >
            <LogOut size={16} strokeWidth={1.5} aria-hidden="true" /> Abmelden
          </button>
        )}
      </div>
      <p className="tp-hilfe">Konto löschen geht im Album unter „Konto“ — dabei verschwinden auch alle Tipps, Punkte und Ligen.</p>
    </div>
  )
}
