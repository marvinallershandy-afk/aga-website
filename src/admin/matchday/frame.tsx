import type { CSSProperties, ReactNode } from 'react'
import type { FormatKey } from './types'

// SVA-Palette (bewusst als Hex-Literale — die Grafiken sollen unabhängig von
// CSS-Variablen deterministisch exportiert werden).
export const SVA = {
  deep: '#0E0D0D',
  black: '#231F20',
  red: '#E91D29',
  redDeep: '#B4141D',
  gold: '#E8C15A',
  white: '#F5F3F2',
  muted: 'rgba(245,243,242,0.62)',
}

export const FONT_DISPLAY = "'Anton', system-ui, sans-serif"
export const FONT_BODY = "'Archivo Variable', system-ui, sans-serif"

// Kicker-Label (kleiner Großbuchstaben-Titel über der Hauptaussage).
export function Kicker({ children, color = SVA.red }: { children: ReactNode; color?: string }) {
  return (
    <div
      style={{
        fontFamily: FONT_BODY,
        fontWeight: 700,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color,
      }}
    >
      {children}
    </div>
  )
}

// Gemeinsamer Rahmen: Hintergrund, diagonale Rot-Fläche, Wappen, Kopf-/Fußzeile.
export function TemplateFrame({
  format,
  wettbewerb,
  children,
  accentText,
}: {
  format: FormatKey
  wettbewerb: string
  children: ReactNode
  accentText?: string
}) {
  const story = format === 'story'
  const pad = story ? 96 : 84

  const wrap: CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    background: `radial-gradient(120% 90% at 50% 0%, ${SVA.black} 0%, ${SVA.deep} 62%)`,
    color: SVA.white,
    fontFamily: FONT_BODY,
    overflow: 'hidden',
  }

  return (
    <div style={wrap}>
      {/* Diagonale Rot-Akzentfläche */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(115deg, ${SVA.redDeep} -6%, transparent 34%)`,
          opacity: 0.9,
        }}
      />
      {/* Wappen als großes, dezentes Hintergrund-Element */}
      <img
        src="/brand/wappen.png"
        alt=""
        crossOrigin="anonymous"
        style={{
          position: 'absolute',
          right: story ? -120 : -90,
          bottom: story ? 40 : -70,
          width: story ? 640 : 560,
          opacity: 0.06,
          filter: 'grayscale(1)',
          pointerEvents: 'none',
        }}
      />

      {/* Kopfzeile: Wappen + Wettbewerb */}
      <div
        style={{
          position: 'absolute',
          top: pad,
          left: pad,
          right: pad,
          display: 'flex',
          alignItems: 'center',
          gap: 24,
        }}
      >
        <img src="/brand/wappen.png" alt="SVA" crossOrigin="anonymous" style={{ height: story ? 96 : 84 }} />
        <div style={{ flex: 1 }}>
          <Kicker color={SVA.gold}>{wettbewerb}</Kicker>
        </div>
        {accentText && (
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: story ? 40 : 34,
              color: SVA.red,
              letterSpacing: '0.04em',
            }}
          >
            {accentText}
          </div>
        )}
      </div>

      {/* Inhalt */}
      <div
        style={{
          position: 'absolute',
          top: pad + (story ? 150 : 130),
          left: pad,
          right: pad,
          bottom: pad + (story ? 130 : 110),
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>

      {/* Fußzeile: Rot-Balken + Vereinsname */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <div style={{ height: 10, background: SVA.red }} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${story ? 40 : 34}px ${pad}px`,
            background: SVA.deep,
          }}
        >
          <span
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: story ? 34 : 30,
              letterSpacing: '0.06em',
              color: SVA.white,
            }}
          >
            SV AGATHENBURG-DOLLERN <span style={{ color: SVA.red }}>1949</span>
          </span>
          <span style={{ fontFamily: FONT_BODY, fontWeight: 700, letterSpacing: '0.18em', color: SVA.muted, fontSize: 22 }}>
            #SVA
          </span>
        </div>
      </div>
    </div>
  )
}
