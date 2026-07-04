export function getClampedPixelRatio(max = 2): number {
  return Math.min(window.devicePixelRatio, max)
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
