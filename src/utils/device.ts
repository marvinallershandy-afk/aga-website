export function getClampedPixelRatio(max = 2): number {
  return Math.min(window.devicePixelRatio, max)
}

/** Qualitätsstufe der Kino-Ebene (v5): Mobile & schwache GPUs
 *  bekommen die reduzierte Kette (Grading+Vignette+Korn sicher,
 *  teure Effekte aus) — Desktop-GPUs die volle. */
export function detectCinemaTier(): 'full' | 'reduced' {
  const ua = navigator.userAgent
  if (/Android|iPhone|iPad|Mobile/i.test(ua)) return 'reduced'
  const nav = navigator as Navigator & { deviceMemory?: number }
  if (nav.deviceMemory && nav.deviceMemory <= 4) return 'reduced'
  const gpu = getDeviceInfo().gpu
  if (/Mali|Adreno|PowerVR|SwiftShader|Intel\(R\)? U?HD Graphics [4-6]/i.test(gpu)) return 'reduced'
  return 'full'
}

export function getDeviceInfo() {
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
  let gpu = 'unknown'
  if (gl) {
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    if (ext) {
      gpu = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
    }
  }
  return {
    pixelRatio: window.devicePixelRatio,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    gpu,
    webgpu: 'gpu' in navigator,
    userAgent: navigator.userAgent,
  }
}
