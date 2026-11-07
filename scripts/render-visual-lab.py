"""Reproducible RAVEN visual study: original stills + camera movement + original ambience.

No story, dialogue, or character files are read or changed by this script.
Requires FFmpeg, Python 3 and fontTools[woff].
"""
from pathlib import Path
import concurrent.futures
import argparse
import tempfile
import subprocess
from fontTools.ttLib import TTFont

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--work-dir', type=Path, help='Directory for intermediate clips and logs')
args = parser.parse_args()
ROOT = Path(__file__).resolve().parents[1] / 'public' / 'visual-lab'
WORK = args.work_dir or Path(tempfile.mkdtemp(prefix='raven-render-'))
WORK.mkdir(parents=True, exist_ok=True)
ASSETS = ROOT / 'assets'
MEDIA = ROOT / 'media'
MEDIA.mkdir(exist_ok=True)
(WORK / 'renders').mkdir(exist_ok=True)
SCENES = ['01-manor', '02-archive', '03-desk', '04-corridor']
FPS, FRAMES, DURATION = 24, 162, 24

def run(args, name):
    with (WORK / f'{name}.log').open('w') as log:
        subprocess.run(['ffmpeg', '-hide_banner', '-y', '-threads', '2', *args],
                       stdout=log, stderr=log, check=True)

font = TTFont(ASSETS / 'cinzel.woff2')
font.flavor = None
font.save(WORK / 'cinzel.ttf')

for scene in SCENES:
    run(['-i', str(ASSETS / f'{scene}.png'), '-vf', 'scale=1440:-2',
         '-frames:v', '1', '-c:v', 'libwebp', '-quality', '88',
         str(ASSETS / f'{scene}.webp')], f'preview-{scene}')

def render_clip(job):
    layout, width, height, index, scene = job
    target = WORK / 'renders' / f'{layout}-{scene}.mp4'
    # Double-resolution canvas avoids visible one-pixel zoom steps.
    canvas_w, canvas_h = width * 2, height * 2
    zoom = '1+0.00055*on' if index % 2 == 0 else '1.09-0.00055*on'
    vf = (f'scale={canvas_w}:{canvas_h}:force_original_aspect_ratio=increase,'
          f'crop={canvas_w}:{canvas_h},setsar=1,'
          f"zoompan=z='{zoom}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':"
          f'd={FRAMES}:s={width}x{height}:fps={FPS},format=yuv420p')
    run(['-i', str(ASSETS / f'{scene}.png'), '-vf', vf, '-frames:v', str(FRAMES),
         '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-threads', '2',
         '-an', str(target)], f'clip-{layout}-{scene}')
    print(f'Rendered {layout} / {scene}', flush=True)

jobs = [(layout, w, h, i, scene)
        for layout, w, h in [('landscape', 1920, 1080), ('portrait', 1080, 1920)]
        for i, scene in enumerate(SCENES)]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    list(pool.map(render_clip, jobs))

# Entirely synthesized ambience: filtered rain, a low drone and a soft overtone.
# No samples, licensed tracks, speech or external audio services are used.
audio_filter = (
    'anoisesrc=color=pink:amplitude=0.20:sample_rate=48000:duration=24:seed=1624,'
    'highpass=f=500,lowpass=f=4500,volume=0.7[rain];'
    'sine=frequency=55:sample_rate=48000:duration=24,volume=0.20,'
    'tremolo=f=0.13:d=0.4[drone];'
    'sine=frequency=82.41:sample_rate=48000:duration=24,volume=0.09[tone];'
    '[rain][drone][tone]amix=inputs=3:normalize=0,volume=10dB,'
    'afade=t=in:d=1.4,afade=t=out:st=22:d=2,'
    'aformat=sample_fmts=s16:channel_layouts=stereo[a]'
)
run(['-filter_complex', audio_filter, '-map', '[a]', '-c:a', 'pcm_s16le',
     str(WORK / 'ambience.wav')], 'ambience')

for layout, width, height in [('landscape', 1920, 1080), ('portrait', 1080, 1920)]:
    args = []
    for scene in SCENES:
        args.extend(['-i', str(WORK / 'renders' / f'{layout}-{scene}.mp4')])
    args.extend(['-i', str(WORK / 'ambience.wav')])
    title_size = 100 if layout == 'landscape' else 82
    # Last title is the existing project name, with no new narrative text.
    filters = (
        '[0:v][1:v]xfade=transition=fade:duration=1:offset=5.75[v01];'
        '[v01][2:v]xfade=transition=fade:duration=1:offset=11.5[v02];'
        '[v02][3:v]xfade=transition=fade:duration=1:offset=17.25,'
        'fade=t=in:d=0.8,'
        f"drawtext=fontfile='{WORK / 'cinzel.ttf'}':text='R A V E N':"
        f"fontsize={title_size}:fontcolor=0xeee8de:x=(w-tw)/2:y=(h-th)/2:"
        "shadowcolor=black@0.8:shadowx=2:shadowy=3:"
        "alpha='if(lt(t,20.3),0,if(lt(t,21.3),t-20.3,1))',"
        'fade=t=out:st=23:d=1,format=yuv420p[v]'
    )
    run([*args, '-filter_complex_threads', '1', '-filter_complex', filters,
         '-map', '[v]', '-map', '4:a', '-t', str(DURATION),
         '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-threads', '3',
         '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart',
         '-metadata', 'title=RAVEN — Visual Study 01',
         '-metadata', 'comment=AI-generated concept stills; animated montage; original synthesized ambience.',
         str(MEDIA / f'raven-{layout}.mp4')], f'final-{layout}')
    print(f'Finished {layout}: {width}x{height}, {DURATION}s', flush=True)
    run(['-ss', '2', '-i', str(MEDIA / f'raven-{layout}.mp4'),
         '-frames:v', '1', '-c:v', 'libwebp', '-quality', '90',
         str(MEDIA / f'poster-{layout}.webp')], f'poster-{layout}')

print('All video and preview assets finished.', flush=True)
