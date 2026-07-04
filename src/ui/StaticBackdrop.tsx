// Statischer, trotzdem schöner Hintergrund für den Fallback-Pfad
// (kein WebGL oder prefers-reduced-motion). CSS-gemalter Abend-Platz.
export function StaticBackdrop() {
  return (
    <div className="stage-canvas" aria-hidden="true" style={{ overflow: 'hidden' }}>
      {/* Abendhimmel */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, #0a0c1a 0%, #141830 30%, #2c2340 58%, #5a3a3a 80%, #3a2622 92%, #181018 100%)',
        }}
      />
      {/* Flutlicht-Glows */}
      {[18, 82].map((x) => (
        <div
          key={x}
          style={{
            position: 'absolute',
            left: `${x}%`,
            top: '18%',
            width: 6,
            height: '46%',
            background: 'linear-gradient(180deg, #ffe6b0, rgba(255,230,176,0.05))',
            filter: 'blur(2px)',
            opacity: 0.6,
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '30%',
          width: '90%',
          height: '50%',
          transform: 'translateX(-50%)',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(255,230,176,0.22), transparent 60%)',
        }}
      />
      {/* Platz in Perspektive */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: '-8%',
          width: '160%',
          height: '62%',
          transform: 'translateX(-50%) perspective(600px) rotateX(58deg)',
          transformOrigin: 'center bottom',
          background:
            'repeating-linear-gradient(90deg, #2f6b2a 0 8%, #276022 8% 16%)',
          boxShadow: 'inset 0 0 200px rgba(0,0,0,0.6)',
          borderTop: '2px solid rgba(255,255,255,0.5)',
        }}
      >
        {/* Mittelkreis */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '46%',
            width: '18%',
            aspectRatio: '1',
            transform: 'translate(-50%,-50%)',
            border: '2px solid rgba(255,255,255,0.55)',
            borderRadius: '50%',
          }}
        />
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, background: 'rgba(255,255,255,0.5)', transform: 'translateX(-50%)' }} />
      </div>
      {/* Fog-Verlauf unten */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 55%, rgba(8,7,10,0.7) 100%)' }} />
    </div>
  )
}
