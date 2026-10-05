// JXA-Helfer (osascript -l JavaScript): Freistellung per Apple Vision.
// Läuft lokal auf macOS, kein Upload. Swift wird bewusst nicht gebraucht.
//
//   osascript -l JavaScript segment.js <mode> <inDir> <outDir>
//
// mode = person  → VNGeneratePersonSegmentationRequest (accurate) über einen
//                  VNSequenceRequestHandler (zeitlich stabiler über Frames)
// mode = fg      → VNGenerateForegroundInstanceMaskRequest (je Frame einzeln)
// mode = bbox    → nur Personen-Rechtecke (VNDetectHumanRectanglesRequest),
//                  Ausgabe JSON auf stdout
//
// Ausgabe: je Eingabe-PNG/JPG eine Graustufen-Maske gleichen Namens (PNG) in
// outDir. Die Maske hat die Auflösung, die Vision liefert; build.mjs skaliert.
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

function run(argv) {
  const mode = argv[0], inDir = argv[1], outDir = argv[2]
  const fm = $.NSFileManager.defaultManager
  const files = ObjC.deepUnwrap(fm.contentsOfDirectoryAtPathError(inDir, null)).filter(f => /\.(png|jpg)$/i.test(f)).sort()
  const log = []
  if (mode === 'bbox') {
    const res = {}
    for (const f of files) {
      const h = $.VNImageRequestHandler.alloc.initWithURLOptions($.NSURL.fileURLWithPath(inDir + '/' + f), $({}))
      const req = $.VNDetectHumanRectanglesRequest.alloc.init
      req.upperBodyOnly = false
      h.performRequestsError($([req]), null)
      const r = []
      for (let i = 0; i < (req.results ? req.results.count : 0); i++) {
        const o = req.results.objectAtIndex(i), bb = o.boundingBox
        r.push({ x: bb.origin.x, y: 1 - bb.origin.y - bb.size.height, w: bb.size.width, h: bb.size.height, c: o.confidence })
      }
      res[f] = r
    }
    return JSON.stringify(res)
  }
  const seq = $.VNSequenceRequestHandler.alloc.init
  const preq = $.VNGeneratePersonSegmentationRequest.alloc.init
  preq.qualityLevel = 0 // accurate
  preq.outputPixelFormat = 1278226488 // kCVPixelFormatType_OneComponent8
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
