import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { BookOpen, Crown, Eye, Flame, Footprints, Lock, LogOut, PenLine, Share2, Sparkles, Square, Target, Trophy, Users } from 'lucide-react'
import { abmelden, profilSpeichern, TippFehler, type Lage } from './api'
import { ABZEICHEN, type Abzeichen } from './model'
import { bildAbzeichen, teilen } from './share'
import { zaehleEreignis } from '../statistik/zaehlen'
import type { Tab } from './TippApp'

// ─────────────────────────────────────────────────────────────
// v20-T: Profil — Anzeigename (Vorname + Initial), freiwillig öffentlich,
// Saisonzahlen, Abzeichen, gemeinsames Konto mit dem Album.
// ─────────────────────────────────────────────────────────────

const ICONS: Record<Abzeichen['icon'], typeof Eye> = {
  eye: Eye,
  flame: Flame,
  square: Square,
  crown: Crown,
  target: Target,
  sparkles: Sparkles,
  footprints: Footprints,
  trophy: Trophy,
  users: Users,
  pen: PenLine,
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

  if (!session) {
    return (
      <div className="tp-panel tp-leer">
        <p className="tp-kicker">Profil</p>
        <h1 className="tp-h2">Noch nicht dabei?</h1>
        <p className="tp-lead">Ein Konto für Tipp-Liga und Sammelalbum. Kein Passwort — nur deine E-Mail.</p>
        <button type="button" className="tp-btn" onClick={onAnmelden}>
          Anmelden
        </button>
      </div>
    )
  }

  const hat = new Map((ich?.abzeichen ?? []).map((a) => [a.key, a.at]))
  const st = ich?.statistik

  const speichern = async (e: React.FormEvent) => {
    e.preventDefault()
    setFehler('')
    setMeldung('')
    try {
      await profilSpeichern(vorname.trim(), initial.trim(), sichtbar)
      setMeldung('Gespeichert.')
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
        <span className="tp-monogramm" aria-hidden="true">
          {ich?.profil?.vorname?.[0] ?? '?'}
        </span>
        <div>
          <p className="tp-kicker">{ich?.teilnehmer?.kabine ? 'Kabine' : 'Fan'} · Saison {lage.saison}</p>
          <h1 className="tp-h2">{ich?.profil?.anzeigename ?? 'Neu hier'}</h1>
          <p className="tp-meta">{ich?.email}</p>
        </div>
      </section>

      {ich?.teilnehmer ? (
        <>
          <dl className="tp-zahlen">
            <div>
              <dt>Punkte</dt>
              <dd>{st?.punkte ?? 0}</dd>
            </div>
            <div>
              <dt>Spieltage</dt>
              <dd>{st?.spieltage ?? 0}</dd>
            </div>
            <div>
              <dt>Exakt</dt>
              <dd>{st?.exakt ?? 0}</dd>
            </div>
            <div>
              <dt>Bester Tag</dt>
              <dd>{st?.beste ?? 0}</dd>
            </div>
          </dl>

          <section className="tp-block" aria-labelledby="tp-h-abz">
            <div className="tp-block__kopf">
              <h2 className="tp-h3" id="tp-h-abz">
                Abzeichen
              </h2>
              <span className="tp-block__punkte">
                {hat.size}/{ABZEICHEN.length}
              </span>
            </div>
            <ul className="tp-abz">
              {ABZEICHEN.map((a, i) => {
                const Icon = ICONS[a.icon]
                const da = hat.has(a.key)
                return (
                  <motion.li
                    key={a.key}
                    className={da ? 'is-da' : ''}
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <span className="tp-abz__medaille" aria-hidden="true">
                      {da ? <Icon size={26} strokeWidth={1.5} /> : <Lock size={20} strokeWidth={1.5} />}
                    </span>
                    <b>{a.titel}</b>
                    <small>{a.text}</small>
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

          <form className="tp-block" onSubmit={speichern}>
            <h2 className="tp-h3">Dein Name in der Tipp-Liga</h2>
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
                <small>Als „{vorname || 'Vorname'} {initial ? `${initial.toUpperCase()}.` : 'I.'}“ — sonst siehst nur du dich. In deinen Ligen sehen dich die Mitglieder immer.</small>
              </span>
            </label>
            {fehler && <p className="tp-hinweis tp-hinweis--fehler">{fehler}</p>}
            {meldung && <p className="tp-hinweis tp-hinweis--ok">{meldung}</p>}
            <button type="submit" className="tp-btn tp-btn--line">
              Speichern
            </button>
          </form>
        </>
      ) : (
        <div className="tp-panel">
          <p className="tp-lead">Du bist angemeldet, tippst aber noch nicht mit.</p>
          <button type="button" className="tp-btn" onClick={onAnmelden}>
            Jetzt mitmachen
          </button>
        </div>
      )}

      <a className="tp-album" href="/album">
        <BookOpen size={22} strokeWidth={1.5} aria-hidden="true" />
        <span>
          <b>Dein Sammelalbum</b>
          <small>Gleiches Konto — jeder Tipp bringt eine Karte, am Platz gibt’s Sticker-Tütchen.</small>
        </span>
      </a>

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
        <h3>Deine Elf</h3>
        <dl>
          <div><dt>Einsatz</dt><dd>+1</dd></div>
          <div><dt>Tor · Vorlage</dt><dd>+5 · +3</dd></div>
          <div><dt>Zu null (TW/ABW, mind. 60 Min.)</dt><dd>+4</dd></div>
          <div><dt>Spieler des Spiels</dt><dd>+5</dd></div>
          <div><dt>Sieg (alle Eingesetzten)</dt><dd>+2</dd></div>
          <div><dt>Gelb · Gelb-Rot · Rot</dt><dd>−1 · −3 · −4</dd></div>
          <div><dt>Kapitän</dt><dd>×2</dd></div>
        </dl>
        <p>
          Getippt wird bis zum Anpfiff — nur Pflichtspiele des SVA, auch auswärts. Punkte gibt’s nach dem Spielbericht, meist am Sonntagabend. Kostenlos,
          ohne Einsatz. <a href="/teilnahmebedingungen">Teilnahmebedingungen</a>
        </p>
      </details>

      <div className="tp-zeile-knoepfe">
        <button type="button" className="tp-btn tp-btn--line tp-btn--sm" onClick={() => onTab('ligen')}>
          <Users size={16} strokeWidth={1.5} aria-hidden="true" /> Meine Ligen
        </button>
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
      </div>
      <p className="tp-block__hilfe">
        Konto löschen geht im Album unter „Konto“ — dabei verschwinden auch alle Tipps, Punkte und Ligen.
      </p>
    </div>
  )
}
