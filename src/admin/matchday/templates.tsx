import { SVA, FONT_DISPLAY, FONT_BODY, TemplateFrame, Kicker } from './frame'
import { FitText } from './FitText'
import { STECKBRIEF_FELDER } from '../lib/constants'
import type { MatchdayData, FormatKey, TemplateKey } from './types'

interface TplProps {
  data: MatchdayData
  format: FormatKey
}

// Zwei Teamnamen mit VS-Trenner; Namen skalieren automatisch.
function VersusBlock({ data, format }: TplProps) {
  const story = format === 'story'
  const nameMax = story ? 96 : 84
  const cell = (name: string) => (
    <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
      <FitText max={nameMax} min={34} lines={2} className="" style={{ fontFamily: FONT_DISPLAY, color: SVA.white }}>
        {name}
      </FitText>
    </div>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: story ? 28 : 24, width: '100%' }}>
      {cell(data.heim)}
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: story ? 88 : 76,
          color: SVA.red,
          padding: '0 8px',
          transform: 'skewX(-8deg)',
        }}
      >
        VS
      </div>
      {cell(data.gast)}
    </div>
  )
}

function Spieltag({ data, format }: TplProps) {
  const story = format === 'story'
  return (
    <TemplateFrame format={format} wettbewerb={data.wettbewerb} accentText="SPIELTAG">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: story ? 64 : 48 }}>
        <VersusBlock data={data} format={format} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: story ? 22 : 16, alignItems: 'center' }}>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: story ? 64 : 54,
              color: SVA.gold,
              letterSpacing: '0.02em',
              textAlign: 'center',
            }}
          >
            {data.datum}
          </div>
          <div style={{ fontFamily: FONT_BODY, fontSize: story ? 40 : 34, color: SVA.muted, textAlign: 'center' }}>
            📍 {data.ort}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Kicker>Kommt vorbei &amp; unterstützt die Jungs!</Kicker>
        </div>
      </div>
    </TemplateFrame>
  )
}

function Aufstellung({ data, format }: TplProps) {
  const story = format === 'story'
  const names = data.aufstellung.slice(0, 11)
  // Feed: zwei Spalten; Story: eine Spalte.
  const cols = story ? 1 : 2
  const rowFont = story ? 44 : 34
  return (
    <TemplateFrame format={format} wettbewerb={data.wettbewerb} accentText="STARTELF">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 20, marginBottom: story ? 40 : 28 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: story ? 72 : 58, color: SVA.white }}>
          {data.heim}
        </div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: story ? 48 : 40, color: SVA.red }}>
          {data.formation}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          columnGap: 40,
          rowGap: story ? 8 : 6,
          alignContent: 'center',
        }}
      >
        {names.map((n, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              padding: story ? '10px 0' : '7px 0',
              borderBottom: `1px solid rgba(245,243,242,0.09)`,
            }}
          >
            <span
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: rowFont,
                color: SVA.red,
                width: story ? 58 : 46,
                textAlign: 'right',
                flexShrink: 0,
              }}
            >
              {i + 1}
            </span>
            <span style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: rowFont, color: SVA.white, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {n}
            </span>
          </div>
        ))}
      </div>
    </TemplateFrame>
  )
}

function Ergebnis({ data, format }: TplProps) {
  const story = format === 'story'
  const nameMax = story ? 60 : 50
  const teamCell = (name: string) => (
    <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
      <FitText max={nameMax} min={26} lines={2} style={{ fontFamily: FONT_DISPLAY, color: SVA.white }}>
        {name}
      </FitText>
    </div>
  )
  return (
    <TemplateFrame format={format} wettbewerb={data.wettbewerb} accentText="ENDSTAND">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: story ? 60 : 44 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: story ? 24 : 18 }}>
          {teamCell(data.heim)}
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: story ? 168 : 140,
              color: SVA.gold,
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            {data.toreHeim}
            <span style={{ color: SVA.red, margin: '0 14px' }}>:</span>
            {data.toreGast}
          </div>
          {teamCell(data.gast)}
        </div>
        {data.torschuetzen.trim() && (
          <div
            style={{
              textAlign: 'center',
              fontFamily: FONT_BODY,
              fontWeight: 600,
              fontSize: story ? 40 : 32,
              color: SVA.muted,
              whiteSpace: 'pre-line',
              lineHeight: 1.4,
            }}
          >
            ⚽ {data.torschuetzen}
          </div>
        )}
      </div>
    </TemplateFrame>
  )
}

function Motm({ data, format }: TplProps) {
  const story = format === 'story'
  const size = story ? 460 : 380
  return (
    <TemplateFrame format={format} wettbewerb={data.wettbewerb} accentText="MOTM">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: story ? 44 : 32 }}>
        <Kicker>Spieler des Spiels</Kicker>
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            border: `10px solid ${SVA.red}`,
            overflow: 'hidden',
            background: SVA.black,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {data.spielerFoto ? (
            <img
              src={data.spielerFoto}
              alt=""
              crossOrigin="anonymous"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: size * 0.4, color: SVA.red }}>
              {(data.spielerName || '?').charAt(0)}
            </span>
          )}
        </div>
        <div style={{ width: '100%', textAlign: 'center' }}>
          <FitText max={story ? 104 : 86} min={34} lines={2} style={{ fontFamily: FONT_DISPLAY, color: SVA.white }}>
            {data.spielerName}
          </FitText>
        </div>
        {data.motmZusatz.trim() && (
          <div
            style={{
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: story ? 42 : 34,
              color: SVA.gold,
              background: 'rgba(233,29,41,0.14)',
              border: `2px solid ${SVA.red}`,
              borderRadius: 999,
              padding: story ? '14px 40px' : '10px 32px',
            }}
          >
            {data.motmZusatz}
          </div>
        )}
      </div>
    </TemplateFrame>
  )
}

function Steckbrief({ data, format }: TplProps) {
  const story = format === 'story'
  const size = story ? 380 : 300
  const eintraege = STECKBRIEF_FELDER
    .map((f) => ({ frage: f.frage, antwort: (data.steckbrief?.[f.key] ?? '').trim() }))
    .filter((e) => e.antwort)
  return (
    <TemplateFrame format={format} wettbewerb={data.wettbewerb} accentText="STECKBRIEF">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: story ? 40 : 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: story ? 40 : 30 }}>
          <div
            style={{
              width: size,
              height: size,
              borderRadius: '50%',
              border: `10px solid ${SVA.red}`,
              overflow: 'hidden',
              background: SVA.black,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {data.spielerFoto ? (
              <img
                src={data.spielerFoto}
                alt=""
                crossOrigin="anonymous"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: size * 0.4, color: SVA.red }}>
                {(data.spielerName || '?').charAt(0)}
              </span>
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <FitText max={story ? 84 : 68} min={30} lines={2} style={{ fontFamily: FONT_DISPLAY, color: SVA.white, textAlign: 'left' }}>
              {data.spielerName}
            </FitText>
            <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: story ? 38 : 30, color: SVA.gold, marginTop: 10 }}>
              {[data.spielerNummer && `#${data.spielerNummer}`, data.spielerPosition].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: story ? 26 : 16 }}>
          {eintraege.map((e) => (
            <div
              key={e.frage}
              style={{
                borderLeft: `6px solid ${SVA.red}`,
                paddingLeft: story ? 26 : 20,
                paddingTop: 2,
                paddingBottom: 2,
              }}
            >
              <div
                style={{
                  fontFamily: FONT_BODY,
                  fontWeight: 700,
                  fontSize: story ? 28 : 23,
                  color: SVA.muted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                }}
              >
                {e.frage}
              </div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: story ? 48 : 38, color: SVA.white, marginTop: 4 }}>
                {e.antwort}
              </div>
            </div>
          ))}
        </div>
      </div>
    </TemplateFrame>
  )
}

export function MatchdayTemplate({ template, ...props }: TplProps & { template: TemplateKey }) {
  switch (template) {
    case 'spieltag':
      return <Spieltag {...props} />
    case 'aufstellung':
      return <Aufstellung {...props} />
    case 'ergebnis':
      return <Ergebnis {...props} />
    case 'motm':
      return <Motm {...props} />
    case 'steckbrief':
      return <Steckbrief {...props} />
  }
}
