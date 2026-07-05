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
      {/* Flutlicht-Masten (Silhouette + Kopf + Glow + Kegel) */}
      {[18, 82].map((x) => (
        <div key={x} style={{ position: 'absolute', left: `${x}%`, top: '16%', height: '50%' }}>
          {/* Mast */}
          <div style={{ position: 'absolute', left: -2, top: 26, width: 4, height: '100%', background: '#191921' }} />
          {/* Lampenkopf */}
          <div
            style={{
              position: 'absolute', left: -19, top: 8, width: 38, height: 22,
              background: '#101014', borderRadius: 2,
              display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2, padding: 3,
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ background: '#ffedc4', borderRadius: 1 }} />
            ))}
          </div>
          {/* Glow */}
          <div
            style={{
              position: 'absolute', left: -55, top: -28, width: 110, height: 90,
              background: 'radial-gradient(ellipse at center, rgba(255,230,176,0.5), transparent 65%)',
            }}
          />
          {/* Lichtkegel */}
          <div
            style={{
              position: 'absolute', left: x < 50 ? -10 : -150, top: 26, width: 160, height: 320,
              background: `linear-gradient(${x < 50 ? 155 : 205}deg, rgba(255,230,176,0.16), transparent 62%)`,
              clipPath: x < 50 ? 'polygon(6% 0, 14% 0, 100% 100%, 40% 100%)' : 'polygon(86% 0, 94% 0, 60% 100%, 0 100%)',
            }}
          />
        </div>
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
