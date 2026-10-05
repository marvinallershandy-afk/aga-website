// JXA-Helfer (osascript -l JavaScript) für die Greenscreen-Pipeline — Apple
// Vision lokal auf dem Mac, kein Upload. Swift wird bewusst nicht gebraucht.
//
//   osascript -l JavaScript vision.js ocr   <inDir>            → JSON auf stdout
//   osascript -l JavaScript vision.js hands <inDir>            → JSON auf stdout
//   osascript -l JavaScript vision.js fg    <inDir> <outDir>   → Masken-PNGs
//   osascript -l JavaScript vision.js person <inDir> <outDir>  → Masken-PNGs
//
// ocr    VNRecognizeTextRequest (accurate, ohne Sprachkorrektur): alle
//        Textzeilen je Bild mit Konfidenz + Box (normiert, y von oben).
// hands  VNDetectHumanHandPoseRequest: ausgestreckte Finger je Hand
//        (Spitze deutlich weiter vom Handgelenk als das Mittelgelenk).
// fg     VNGenerateForegroundInstanceMaskRequest (alle Instanzen; Ball in
//        der Hand bleibt drin) — Graustufen-PNG in Bildgröße.
// person VNGeneratePersonSegmentationRequest (accurate) über einen
//        VNSequenceRequestHandler (zeitlich stabiler über Frames).
ObjC.import('Foundation'); ObjC.import('Vision'); ObjC.import('CoreImage'); ObjC.import('AppKit'); ObjC.import('CoreVideo')

function writeMask(buf, out) {
  const ci = $.CIImage.imageWithCVPixelBuffer(buf)
  const ctx = $.CIContext.contextWithOptions($({}))
  const cs = $.CGColorSpaceCreateDeviceGray()
  const cg = ctx.createCGImageFromRectFormatColorSpace(ci, ci.extent, $.kCIFormatL8, cs)
  const rep = $.NSBitmapImageRep.alloc.initWithCGImage(cg)
  const png = rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $({}))
  png.writeToFileAtomically(out, true)
}

function list(dir) {
  const fm = $.NSFileManager.defaultManager
  return ObjC.deepUnwrap(fm.contentsOfDirectoryAtPathError(dir, null)).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort()
}

function ocr(dir) {
  const res = {}
  for (const f of list(dir)) {
    const h = $.VNImageRequestHandler.alloc.initWithURLOptions($.NSURL.fileURLWithPath(dir + '/' + f), $({}))
    const req = $.VNRecognizeTextRequest.alloc.init
    req.recognitionLevel = 0 // accurate
    req.usesLanguageCorrection = false
    req.minimumTextHeight = 0.02
    h.performRequestsError($([req]), null)
    const out = []
    const n = req.results ? req.results.count : 0
    for (let i = 0; i < n; i++) {
      const o = req.results.objectAtIndex(i)
      const cands = o.topCandidates(3)
      const bb = o.boundingBox
      for (let k = 0; k < cands.count; k++) {
        const c = cands.objectAtIndex(k)
        out.push({ t: ObjC.unwrap(c.string), c: c.confidence, k, x: bb.origin.x, y: 1 - bb.origin.y - bb.size.height, w: bb.size.width, h: bb.size.height })
      }
    }
    res[f] = out
  }
  return JSON.stringify(res)
}

function hands(dir) {
  const res = {}
  const J = (n) => $['VNHumanHandPoseObservationJointName' + n]
  const fingers = [['IndexTip', 'IndexPIP'], ['MiddleTip', 'MiddlePIP'], ['RingTip', 'RingPIP'], ['LittleTip', 'LittlePIP'], ['ThumbTip', 'ThumbIP']]
  for (const f of list(dir)) {
    const h = $.VNImageRequestHandler.alloc.initWithURLOptions($.NSURL.fileURLWithPath(dir + '/' + f), $({}))
    const req = $.VNDetectHumanHandPoseRequest.alloc.init
    req.maximumHandCount = 2
    h.performRequestsError($([req]), null)
    const out = []
    const n = req.results ? req.results.count : 0
    for (let i = 0; i < n; i++) {
      const o = req.results.objectAtIndex(i)
      const pt = (name) => { const p = o.recognizedPointForJointNameError(J(name), null); return p && p.confidence > 0.3 ? { x: p.location.x, y: p.location.y } : null }
      const w = pt('Wrist')
      if (!w) continue
      let ext = 0, seen = 0
      for (const [tip, mid] of fingers) {
        const a = pt(tip), b = pt(mid)
        if (!a || !b) continue
        seen++
        const dt = Math.hypot(a.x - w.x, a.y - w.y), dm = Math.hypot(b.x - w.x, b.y - w.y)
        if (dt > dm * 1.25) ext++
      }
      out.push({ ext, seen, c: o.confidence })
    }
    res[f] = out
  }
  return JSON.stringify(res)
}

function masks(mode, inDir, outDir) {
  const log = []
  const seq = $.VNSequenceRequestHandler.alloc.init
  const preq = $.VNGeneratePersonSegmentationRequest.alloc.init
  preq.qualityLevel = 0 // accurate
  preq.outputPixelFormat = 1278226488 // kCVPixelFormatType_OneComponent8
  const files = list(inDir)
  for (const f of files) {
    const url = $.NSURL.fileURLWithPath(inDir + '/' + f)
    const out = outDir + '/' + f.replace(/\.\w+$/, '.png')
    try {
      if (mode === 'person') {
        seq.performRequestsOnImageURLError($([preq]), url, null)
        const r = preq.results
        if (!r || r.count == 0) { log.push('nomask ' + f); continue }
        writeMask(r.objectAtIndex(0).pixelBuffer, out)
      } else {
        const h = $.VNImageRequestHandler.alloc.initWithURLOptions(url, $({}))
        const req = $.VNGenerateForegroundInstanceMaskRequest.alloc.init
        h.performRequestsError($([req]), null)
        const r = req.results
        if (!r || r.count == 0) { log.push('nomask ' + f); continue }
        const o = r.objectAtIndex(0)
        const buf = o.generateScaledMaskForImageForInstancesFromRequestHandlerError(o.allInstances, h, null)
        writeMask(buf, out)
      }
    } catch (e) { log.push('err ' + f + ' ' + e) }
  }
  return log.join('\n') || 'ok ' + files.length
}

function run(argv) {
  const mode = argv[0]
  if (mode === 'ocr') return ocr(argv[1])
  if (mode === 'hands') return hands(argv[1])
  return masks(mode, argv[1], argv[2])
}
