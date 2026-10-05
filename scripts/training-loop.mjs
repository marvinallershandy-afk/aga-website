// v17-D Trainings-Loop (docs/DESIGN.md §5): ruhiger Drohnen-Ausschnitt, Ping-Pong (nahtlos), stumm, 720p
// SRC=0189 SS=8 T=3.6 node train-loop.mjs
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import ffmpegPath from 'ffmpeg-static'
const FF = ffmpegPath
const WT = new URL('..', import.meta.url).pathname.replace(/\/$/, '')
const dir = process.env.SRC_DIR || process.env.HOME + '/Desktop/AGA Training/'
const id = process.env.SRC || '0189'
const src = dir + fs.readdirSync(dir).find((f) => f.includes('_' + id + '_'))
const SS = process.env.SS || '8', T = process.env.T || '3.6'
const out = WT + '/public/training'
fs.mkdirSync(out, { recursive: true })
// leicht verlangsamt (ruhiger), sanfte Farbe (etwas weniger Sättigung, dunkler fürs Panel)
const base = `trim=start=${SS}:duration=${T},setpts=1.25*(PTS-STARTPTS),scale=1280:720:flags=lanczos,eq=saturation=0.86:contrast=1.04:brightness=-0.03,fps=25`
const vf = `[0:v]${base},split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0,format=yuv420p[v]`
const run = (args) => { const r = spawnSync(FF, args, { encoding: 'utf8' }); if (r.status) console.log(r.stderr.slice(-1500)) }
run(['-y', '-loglevel', 'error', '-i', src, '-filter_complex', vf, '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', process.env.CRF || '27', '-profile:v', 'high', '-movflags', '+faststart', '-maxrate', '1400k', '-bufsize', '2800k', out + '/training-loop.mp4'])
run(['-y', '-loglevel', 'error', '-i', src, '-filter_complex', vf, '-map', '[v]', '-an', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', process.env.VCRF || '40', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', out + '/training-loop.webm'])
run(['-y', '-loglevel', 'error', '-ss', String(+SS + 0.2), '-i', src, '-frames:v', '1', '-vf', 'scale=1280:720:flags=lanczos,eq=saturation=0.86:contrast=1.04:brightness=-0.03', '-q:v', '3', out + '/training-poster.jpg'])
for (const f of ['training-loop.mp4', 'training-loop.webm']) console.log(f, Math.round(fs.statSync(out + '/' + f).size / 1024), 'KB')
// Poster danach als WebP: sharp(out/training-poster.jpg).webp({ quality: 70 }) → training-poster.webp
