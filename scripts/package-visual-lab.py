from pathlib import Path
import hashlib
import json
import subprocess
import zipfile

REPO = Path(__file__).resolve().parents[1]
ROOT = REPO / 'public/visual-lab'
SCENES = [
    ('01-manor', 'القصر تحت المطر', 'Rainy blue-hour manor exterior, wet stone, iron gate, warm windows, central raven.'),
    ('02-archive', 'قاعة الأرشيف', 'Double-height dark oak archive, reading table, brass lamp, tall rain-streaked arched window.'),
    ('03-desk', 'على ضوء المصباح', 'Walnut desk, blank paper and unmarked sealed envelope, brass magnifier, fountain pen, raven feather.'),
    ('04-corridor', 'الممر الحجري', 'Old stone corridor, arches, worn limestone, ajar door emitting amber light, rainy windows.'),
]

def entry(path):
    data = path.read_bytes()
    return {'path': str(path.relative_to(ROOT)), 'bytes': len(data),
            'sha256': hashlib.sha256(data).hexdigest()}

manifest = {
    'name': 'RAVEN — Visual Study 01', 'created': '2026-11-06', 'version': 1,
    'narrative_status': 'Independent visual concepts. No story or character canon has been changed.',
    'image_provenance': 'New images generated using the native OpenAI image generation tool; original PNGs retained.',
    'art_direction': 'Photorealistic cinematic mystery. Charcoal and olive blacks, aged brass, amber practical light, cool gray rain. No people, readable text, or additional narrative events.',
    'images': [], 'videos': [],
    'audio_provenance': 'Locally synthesized filtered pink noise and two low sine tones, with fades. No external samples or music.',
    'fonts': 'Cinzel and IBM Plex Arabic, reused from existing RAVEN project assets.',
}
for stem, title, brief in SCENES:
    manifest['images'].append({'id': stem, 'title_ar': title, 'generation_brief': brief,
        'original_width': 1672, 'original_height': 941,
        'original': entry(ROOT / f'assets/{stem}.png'),
        'web_preview': entry(ROOT / f'assets/{stem}.webp')})
for layout in ['landscape', 'portrait']:
    path = ROOT / f'media/raven-{layout}.mp4'
    info = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)]))
    video = next(s for s in info['streams'] if s['codec_type'] == 'video')
    audio = next(s for s in info['streams'] if s['codec_type'] == 'audio')
    manifest['videos'].append({**entry(path), 'layout': layout,
        'duration_seconds': float(info['format']['duration']),
        'width': video['width'], 'height': video['height'], 'fps': video['r_frame_rate'],
        'codec': video['codec_name'], 'audio_codec': audio['codec_name'],
        'production': 'Animated still-image montage: slow zooms, one-second dissolves, RAVEN end title; not generative motion video.',
        'poster': entry(ROOT / f'media/poster-{layout}.webp')})
(ROOT / 'assets.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')

target = ROOT / 'raven-visual-kit.zip'
with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as bundle:
    for path in sorted(ROOT.rglob('*')):
        if path.is_file() and path != target:
            bundle.write(path, Path('raven-visual-kit/public/visual-lab') / path.relative_to(ROOT))
    for script in ['render-visual-lab.py', 'package-visual-lab.py']:
        bundle.write(REPO / 'scripts' / script, 'raven-visual-kit/scripts/' + script)
    bundle.writestr('raven-visual-kit/START-HERE.txt',
        'RAVEN — Visual Study 01\n\nOpen public/visual-lab/index.html to view the gallery.\n'
        'Original PNGs: public/visual-lab/assets\nVideos: public/visual-lab/media\n'
        'Arabic guide and provenance: public/visual-lab/README.md\n'
        'This archive contains no story files.\n')
with zipfile.ZipFile(target) as bundle:
    assert bundle.testzip() is None, 'Archive integrity failed'
print(json.dumps({'archive_bytes': target.stat().st_size,
                  'archive_sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                  'videos': [{k:v for k,v in item.items() if k in ['path','width','height','duration_seconds','codec','audio_codec']}
                             for item in manifest['videos']]}, indent=2))
