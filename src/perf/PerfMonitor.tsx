import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useStore } from '../store/useStore'

// Läuft im R3F-Canvas — sammelt FPS, Draw-Calls, Dreiecke und schreibt
// sie 1×/Sekunde in den Store. Rendert nichts; das DOM-Overlay liest.
// Bewusst imperative three.js-Stats-Glue (gl.info) → die experimentellen
// react-hooks-Purity/Immutability-Regeln passen hier nicht.
/* eslint-disable react-hooks/purity, react-hooks/immutability */
export function PerfMonitor() {
  const gl = useThree((s) => s.gl)
  const frames = useRef(0)
  const lastTime = useRef(0)

  useEffect(() => {
    lastTime.current = performance.now()
    gl.info.autoReset = false
    return () => {
      gl.info.autoReset = true
    }
  }, [gl])

  useFrame(() => {
    frames.current++
    const now = performance.now()
    if (now - lastTime.current >= 1000) {
      useStore.getState().setPerfStats({
        fps: frames.current,
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
      })
      frames.current = 0
      lastTime.current = now
    }
    gl.info.reset()
  })

  return null
}
