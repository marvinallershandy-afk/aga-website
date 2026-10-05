ObjC.import('Foundation'); ObjC.import('Vision'); ObjC.import('CoreImage'); ObjC.import('AppKit')
function run(argv) {
  const inDir = argv[0], outDir = argv[1]
  const fm = $.NSFileManager.defaultManager
  const files = ObjC.deepUnwrap(fm.contentsOfDirectoryAtPathError(inDir, null)).filter(f => /\.(webp|jpg|png)$/i.test(f))
  const log = []
  for (const f of files) {
    try {
      const url = $.NSURL.fileURLWithPath(inDir + '/' + f)
      const handler = $.VNImageRequestHandler.alloc.initWithURLOptions(url, $({}))
      const req = $.VNGenerateForegroundInstanceMaskRequest.alloc.init
      const ok = handler.performRequestsError($([req]), null)
      const res = req.results
      if (!res || res.count == 0) { log.push('nomask ' + f); continue }
      const obs = res.objectAtIndex(0)
      const buf = obs.generateMaskedImageOfInstancesFromRequestHandlerCroppedToInstancesExtentError(obs.allInstances, handler, false, null)
      const ci = $.CIImage.imageWithCVPixelBuffer(buf)
      const rep = $.NSBitmapImageRep.alloc.initWithCIImage(ci)
      const png = rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $({}))
      png.writeToFileAtomically(outDir + '/' + f.replace(/\.\w+$/, '.png'), true)
      log.push('ok ' + f + ' instances=' + obs.allInstances.count)
    } catch (e) { log.push('err ' + f + ' ' + e) }
  }
  return log.join('\n')
}
