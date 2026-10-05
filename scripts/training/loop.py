# Schneidet die Trainings-Schleife (Panel „Mitspielen“) aus den Drohnenclips in ~/Desktop/AGA Training.
# Aufruf: cd ~/Desktop/"AGA Training" && python3 <repo>/scripts/training/loop.py <repo>/public/training
import subprocess, glob, sys
FF='/Users/marvinallers/code/sva-fussball/node_modules/.ignored/ffmpeg-static/ffmpeg'
S=sys.argv[1]; L=4.8; D=1.2
clips=[glob.glob(f'dji*{n}*')[0] for n in ('0186','0187','0189','0190','0186')]
starts=[1,2,4,7,1]
f=[]
for i,(st,lab) in enumerate(zip(starts,'abcde')):
    f.append(f'[{i}:v]trim={st}:{st+L},setpts=PTS-STARTPTS,fps=30,scale=960:540:flags=lanczos,eq=contrast=1.05:saturation=1.1,format=yuv420p[{lab}]')
prev='a'; off=0
for i,lab in enumerate('bcde'):
    off+=L-D; out=f'x{i}'
    f.append(f'[{prev}][{lab}]xfade=transition=fade:duration={D}:offset={off:.3f}[{out}]'); prev=out
f.append(f'[{prev}]trim={D}:{off+D:.3f},setpts=PTS-STARTPTS,format=yuv420p[out]')
args=[FF,'-loglevel','error','-y']
for c in clips: args+=['-i',c]
args+=['-filter_complex',';'.join(f),'-map','[out]','-an','-c:v','libx264','-preset','slow','-crf','29','-profile:v','high','-movflags','+faststart',f'{S}/training-loop.mp4']
subprocess.run(args,check=True)
subprocess.run([FF,'-loglevel','error','-y','-i',f'{S}/training-loop.mp4','-c:v','libvpx-vp9','-b:v','0','-crf','44','-row-mt','1','-an',f'{S}/training-loop.webm'],check=True)
subprocess.run([FF,'-loglevel','error','-y','-i',f'{S}/training-loop.mp4','-frames:v','1','-c:v','libwebp','-quality','72',f'{S}/training-poster.webp'],check=True)
