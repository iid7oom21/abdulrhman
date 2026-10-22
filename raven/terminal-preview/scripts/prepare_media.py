#!/usr/bin/env python3
"""Stage actual RAVEN recordings, derive lossless excerpts, and validate a release.

No voice synthesis, image generation, automatic dialogue recognition, or site mutation.
All outputs live in an explicitly requested new directory or a temporary staging tree.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from fractions import Fraction
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit
import wave

BASE = Path(__file__).resolve().parents[1]
MANIFEST = BASE / 'assets' / 'expansion-media-manifest.json'
RATE = 48000
MAX_MEDIA_BYTES = 64 * 1024 * 1024  # Matches the browser's verified media loader.
CALL_LINES = [
    ('إلياس', 'أدريان… عندي طلب مخرج الأرشيف. المزلاج يعلق إذا حاولنا نفتحه من الداخل. يحتاج استبدال.'),
    ('أدريان', 'الاستبدال يتأجل لدورة الميزانية الجاية.'),
    ('إلياس', 'وبالنسبة لقفل قفص المعدات، الإجراء يسمح بإزالته. لوسيان مكلّف يشيله ويسلّم قطعه.'),
    ('أدريان', 'تقصد قفص المعدات الخارجي؟'),
    ('إلياس', 'نعم. هذا الإجراء يخص قفص المعدات… ما يخص باب المخرج.'),
]
MASTER_LINES = [
    ('إلينا', 'الوجه الأمامي اجتاز المسح. الوجه الخلفي B17-R يحتاج مراجعة.'),
    ('نورا', 'ضعي الخلفي في المراجعة وانشري الوجوه المقبولة.'),
    ('إلينا', 'سجلت: الأمامي منشور، والخلفي معلق.'),
    ('نورا', 'درج المراجعة الثالث.'),
]
CAMERAS = {
    'intake': (2, 'وصول ظرف المراجعة إلى مكتب الاستلام.'),
    'scanner': (6, 'تمرير البطاقة في جهاز المسح.'),
    'review': (12, 'نقل حافظة الوجه الخلفي إلى رف المراجعة.'),
}
EXPECTED_IDS = {'ma22-call', 'lab-channel-a', 'lab-channel-b', 'lab-published-excerpt',
                'lab-reversed-excerpt', *(f'lab-camera-{name}' for name in CAMERAS)}


class MediaError(ValueError):
    """A source or manifest does not meet the release contract."""


def require(condition, message):
    if not condition:
        raise MediaError(message)


def sha256(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def run(command):
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=False, timeout=180)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise MediaError(f'Unable to run {command[0]}: {error}') from error
    require(result.returncode == 0, f'{command[0]} failed: {result.stderr[-1500:]}')
    return result.stdout


def probe(path):
    require(Path(path).is_file(), f'Missing media: {path}')
    return json.loads(run(['ffprobe', '-v', 'error', '-count_frames', '-show_streams',
                           '-show_format', '-of', 'json', str(path)]))


def decode(path):
    # Decode the entire file: a valid header alone is not a working recording.
    run(['ffmpeg', '-nostdin', '-v', 'error', '-xerror', '-i', str(path),
         '-map', '0', '-f', 'null', '-'])


def read_pcm(path):
    try:
        with wave.open(str(path), 'rb') as source:
            parameters = source.getparams()
            require(parameters.comptype == 'NONE', f'{path}: WAV must contain uncompressed PCM.')
            require(parameters.framerate == RATE, f'{path}: expected 48000 Hz PCM.')
            require(parameters.nchannels in (1, 2), f'{path}: expected mono or stereo PCM.')
            require(parameters.sampwidth in (2, 3, 4), f'{path}: expected signed 16/24/32-bit PCM.')
            require(0 < parameters.nframes <= 180 * RATE, f'{path}: PCM duration must be positive and at most 180 seconds.')
            frames = source.readframes(parameters.nframes)
            require(len(frames) == parameters.nframes * parameters.nchannels * parameters.sampwidth,
                    f'{path}: truncated PCM data.')
            return parameters, frames
    except (wave.Error, EOFError) as error:
        raise MediaError(f'{path}: cannot read lossless WAV: {error}') from error


def inspect(path, kind):
    require(Path(path).is_file(), f'Missing media: {path}')
    require(0 < Path(path).stat().st_size <= MAX_MEDIA_BYTES,
            f'{path}: media must be non-empty and at most 64 MiB, matching the browser loader limit.')
    metadata = probe(path)
    streams = metadata.get('streams', [])
    if kind == 'audio':
        require(len(streams) == 1 and streams[0].get('codec_type') == 'audio', f'{path}: expected audio only.')
        parameters, _ = read_pcm(path)
        duration = parameters.nframes / parameters.framerate
        result = {'durationSeconds': duration, 'sampleRate': parameters.framerate,
                  'channels': parameters.nchannels, 'sampleWidthBytes': parameters.sampwidth,
                  'sampleFrames': parameters.nframes, 'codec': streams[0].get('codec_name')}
    else:
        require(len(streams) == 1 and streams[0].get('codec_type') == 'video', f'{path}: camera must contain video only, without music or audio.')
        video = streams[0]
        require(video.get('codec_name') == 'h264', f'{path}: camera must be H.264.')
        require((video.get('width'), video.get('height')) == (1920, 1080), f'{path}: camera must be 1920×1080.')
        require(video.get('pix_fmt') == 'yuv420p', f'{path}: use 8-bit yuv420p for browser compatibility.')
        try:
            frame_rate = Fraction(video.get('avg_frame_rate', '0/1'))
        except (ValueError, ZeroDivisionError) as error:
            raise MediaError(f'{path}: invalid camera frame rate.') from error
        require(frame_rate == 24, f'{path}: camera must be 24 fps.')
        require(int(video.get('nb_read_frames', 0)) == 480, f'{path}: expected all 480 camera frames to decode.')
        duration = float(video.get('duration', metadata['format'].get('duration', 0)))
        require(abs(duration - 20) <= 1 / 24, f'{path}: camera must last 20 seconds.')
        result = {'durationSeconds': duration, 'width': 1920, 'height': 1080,
                  'frameRate': 24, 'frameCount': 480, 'codec': 'h264'}
    require(math.isfinite(duration) and duration > 0, f'{path}: invalid duration.')
    decode(path)
    return {**result, 'bytes': Path(path).stat().st_size, 'sha256': sha256(path), 'decoded': True}


def sample_position(seconds):
    require(isinstance(seconds, (int, float)) and not isinstance(seconds, bool) and math.isfinite(seconds), 'Time must be finite seconds.')
    frames = seconds * RATE
    require(abs(frames - round(frames)) < 0.00001, 'Time must align with a 48000 Hz sample frame.')
    return round(frames)


def source_range(start, end, duration=90):
    first, last = sample_position(start), sample_position(end)
    require(0 <= first < last <= round(duration * RATE), 'Source range is empty, reversed, or outside the master.')
    return first, last


def derive_pcm(source, target, start, end, reverse=False):
    parameters, frames = read_pcm(source)
    first, last = source_range(start, end, parameters.nframes / RATE)
    width = parameters.nchannels * parameters.sampwidth
    segment = frames[first * width:last * width]
    if reverse:
        # Reverse complete sample frames: preserve channel pairing and byte order.
        segment = b''.join(segment[index:index + width] for index in range(len(segment) - width, -1, -width))
    with wave.open(str(target), 'wb') as output:
        output.setparams(parameters)
        output.writeframes(segment)
    return [first, last]


def cue_template():
    def lines(source):
        return [{'start': None, 'end': None, 'speaker': speaker, 'text': text} for speaker, text in source]
    master = lines(MASTER_LINES)
    master[-1]['start'] = 73
    return {'version': 1, 'calibrationSeconds': 48, 'phraseStartSeconds': 73,
            'masterA': master, 'call': lines(CALL_LINES),
            'cameras': {name: [{'start': start, 'end': None, 'text': text}] for name, (start, text) in CAMERAS.items()}}


def validate_cues(cues, duration, expected=None):
    require(isinstance(cues, list) and cues, 'A non-empty timed cue list is required.')
    if expected is not None:
        require(len(cues) == len(expected), 'Cue count differs from the canonical performance script.')
    previous = 0
    for index, cue in enumerate(cues):
        require(isinstance(cue, dict), 'Each cue must be an object.')
        first, last = source_range(cue.get('start'), cue.get('end'), duration)
        require(first >= previous, 'Cues must be chronological and must not overlap.')
        require(isinstance(cue.get('text'), str) and cue['text'].strip() and '-->' not in cue['text'], 'Cue text is missing or contains a VTT control sequence.')
        if expected is not None:
            speaker, text = expected[index]
            require(cue.get('speaker') == speaker and ' '.join(cue['text'].split()) == ' '.join(text.split()),
                    f'Cue {index + 1} changes the approved dialogue or speaker.')
        previous = last


def check_cue_sheet(sheet, call_duration, excerpt, phrase_end):
    require(isinstance(sheet, dict), 'Cue sheet must be a JSON object.')
    require(sheet.get('version') == 1, 'Cue-sheet version must be 1.')
    require(sheet.get('calibrationSeconds') == 48 and sheet.get('phraseStartSeconds') == 73,
            'Keep the master calibration at 48 seconds and the reference phrase at 73 seconds.')
    validate_cues(sheet.get('masterA'), 90, MASTER_LINES)
    validate_cues(sheet.get('call'), call_duration, CALL_LINES)
    require(sheet['masterA'][-1]['start'] == 73 and sheet['masterA'][-1]['end'] == phrase_end,
            'The reverse range must contain the complete reference phrase starting at master 73 seconds.')
    require(excerpt == [sheet['masterA'][2]['start'], sheet['masterA'][2]['end']],
            'The published excerpt must use the complete third master cue, not an independently performed take.')
    require(isinstance(sheet.get('cameras'), dict), 'Camera cue sheets are required.')
    for name, (at, text) in CAMERAS.items():
        cues = sheet['cameras'].get(name)
        validate_cues(cues, 20)
        require(any(cue['start'] == at and cue['text'] == text for cue in cues),
                f'Camera {name} must retain its canonical event at clip second {at}.')


def timestamp(seconds):
    milliseconds = round(seconds * 1000)
    hours, milliseconds = divmod(milliseconds, 3600000)
    minutes, milliseconds = divmod(milliseconds, 60000)
    seconds, milliseconds = divmod(milliseconds, 1000)
    return f'{hours:02}:{minutes:02}:{seconds:02}.{milliseconds:03}'


def write_vtt(path, cues, start=0, end=None):
    blocks = ['WEBVTT', '']
    for cue in cues:
        left, right = max(start, cue['start']), min(end if end is not None else cue['end'], cue['end'])
        if right <= left:
            continue
        speaker = f"{cue['speaker']}: " if cue.get('speaker') else ''
        blocks.extend([f'{timestamp(left-start)} --> {timestamp(right-start)}', speaker + cue['text'], ''])
    Path(path).write_text('\n'.join(blocks), encoding='utf-8')


def records(manifest):
    return [manifest.get('call'), *manifest.get('cameras', []), *manifest.get('channels', []),
            manifest.get('excerpt'), manifest.get('reversed')]


def safe_local(base, url):
    require(isinstance(url, str) and url.strip(), 'A prepared/ready record needs a local URL.')
    parsed = urlsplit(url)
    require(not parsed.scheme and not parsed.netloc and not parsed.query and not parsed.fragment,
            'Media verification accepts only local relative paths without queries or fragments.')
    require(not Path(url).is_absolute() and '..' not in Path(url).parts and '\\' not in url, 'Unsafe media path.')
    root, resolved = Path(base).resolve(), (Path(base) / url).resolve()
    require(resolved.is_relative_to(root), 'A media symlink must not escape the assets directory.')
    return resolved


def validate_manifest(path, require_complete=False):
    path = Path(path).resolve()
    manifest = json.loads(path.read_text(encoding='utf-8'))
    require(isinstance(manifest, dict), 'Manifest must be a JSON object.')
    require(manifest.get('version') == 1, 'Unsupported manifest version.')
    entries = records(manifest)
    require(all(isinstance(entry, dict) for entry in entries), 'Media manifest has missing groups.')
    require(len(entries) == 8 and {entry.get('id') for entry in entries} == EXPECTED_IDS, 'Expected eight unique media records.')
    by_id = {entry['id']: entry for entry in entries}
    files = {}
    for entry in entries:
        status = entry.get('status')
        require(status in ('pending', 'prepared', 'ready'), f"{entry['id']}: invalid status.")
        if require_complete:
            require(status == 'ready', f"{entry['id']}: release is not ready; missing assets cannot be published as complete.")
        if status == 'pending':
            require(entry.get('url') is None, f"{entry['id']}: pending assets must not claim a playback URL.")
            continue
        local = safe_local(path.parent, entry.get('url'))
        kind = 'video' if entry['id'].startswith('lab-camera-') else 'audio'
        actual = inspect(local, kind)
        require(entry.get('mime') == ('video/mp4' if kind == 'video' else 'audio/wav'), f"{entry['id']}: MIME does not match the expected type.")
        for key in ('bytes', 'sha256', 'durationSeconds'):
            require(entry.get(key) == actual[key], f"{entry['id']}: {key} does not match the actual file.")
        for key in ('sampleRate', 'sampleFrames', 'sampleWidthBytes', 'channels', 'width', 'height', 'frameRate', 'frameCount'):
            if key in actual:
                require(entry.get(key) == actual[key], f"{entry['id']}: inaccurate {key} metadata.")
        if entry.get('captionUrl'):
            caption = safe_local(path.parent, entry['captionUrl'])
            require(caption.is_file() and caption.read_text(encoding='utf-8').startswith('WEBVTT\n'), 'Missing or invalid WebVTT captions.')
            require(entry.get('captionSha256') == sha256(caption), 'Caption digest mismatch.')
        files[entry['id']] = local
    if not files:
        return {'verified': 0, 'ready': 0, 'pending': 8, 'complete': False}
    derivatives = {'lab-channel-b', 'lab-published-excerpt', 'lab-reversed-excerpt'}
    require(not (derivatives & files.keys()) or 'lab-channel-a' in files, 'Derived release verification requires its master A.')
    if 'lab-channel-a' in files:
        master = by_id['lab-channel-a']
        parameters, master_frames = read_pcm(files['lab-channel-a'])
        require(parameters.nframes == 90 * RATE and master.get('masterStartSeconds') == 0 and master.get('calibrationSeconds') == 48,
                'Master A must last exactly 90 seconds with calibration at 48 seconds.')
        width = parameters.nchannels * parameters.sampwidth
    for identity in ('lab-channel-b', 'lab-published-excerpt', 'lab-reversed-excerpt'):
        if identity not in files:
            continue
        entry = by_id[identity]
        require(entry.get('derivedFrom') == 'lab-channel-a' and entry.get('sourceSha256') == master['sha256'], f'{identity}: incorrect master provenance.')
        range_seconds = entry.get('sourceRangeSeconds')
        require(isinstance(range_seconds, list) and len(range_seconds) == 2, f'{identity}: missing source range.')
        first, last = source_range(*range_seconds)
        require(entry.get('sourceRangeSamples') == [first, last], f'{identity}: sample range disagrees with seconds.')
        child_parameters, child_frames = read_pcm(files[identity])
        require(child_parameters[:3] == parameters[:3], f'{identity}: PCM format differs from the master.')
        expected = master_frames[first * width:last * width]
        if identity == 'lab-reversed-excerpt':
            require(first == 73 * RATE, 'Reversed phrase must start at master 73 seconds.')
            expected = b''.join(expected[index:index + width] for index in range(len(expected) - width, -1, -width))
        require(child_frames == expected, f'{identity}: sample frames are not the declared lossless derivation.')
        if identity == 'lab-channel-b':
            require(range_seconds == [36, 90] and entry.get('masterStartSeconds') == 36 and entry.get('calibrationSeconds') == 12,
                    'Channel B must be A[36:90], with calibration at B 12 seconds.')
    for name in CAMERAS:
        entry = by_id[f'lab-camera-{name}']
        if entry['id'] in files:
            require(entry.get('masterStartSeconds') == 40 and entry.get('clockOffsetSeconds') == (420 if name == 'scanner' else 0),
                    f'Camera {name}: incorrect master start or clock offset.')
    ready = sum(entry['status'] == 'ready' for entry in entries)
    return {'verified': len(files), 'ready': ready, 'pending': 8-len(files), 'complete': ready == 8}


def prepare(args):
    sources = {'lab-channel-a': Path(args.master_a).resolve(), 'ma22-call': Path(args.call).resolve(),
               **{f'lab-camera-{name}': Path(getattr(args, f'camera_{name}')).resolve() for name in CAMERAS}}
    metadata = {identity: inspect(path, 'video' if identity.startswith('lab-camera-') else 'audio') for identity, path in sources.items()}
    require(metadata['lab-channel-a']['sampleFrames'] == 90 * RATE, 'Master A must be exactly 90 seconds; no padding or time-stretch is performed.')
    require(5 <= metadata['ma22-call']['durationSeconds'] <= 180, 'Call duration must be between 5 and 180 seconds.')
    sheet = json.loads(Path(args.cue_sheet).read_text(encoding='utf-8'))
    require(isinstance(sheet, dict), 'Cue sheet must be a JSON object.')
    excerpt = [args.excerpt_start if args.excerpt_start is not None else sheet['masterA'][2]['start'],
               args.excerpt_end if args.excerpt_end is not None else sheet['masterA'][2]['end']]
    phrase_end = args.phrase_end if args.phrase_end is not None else sheet['masterA'][-1]['end']
    source_range(*excerpt)
    source_range(73, phrase_end)
    check_cue_sheet(sheet, metadata['ma22-call']['durationSeconds'], excerpt, phrase_end)
    output = Path(args.output).resolve() if args.output else Path(tempfile.mkdtemp(prefix='raven-media-')) / 'release'
    require(not output.exists(), f'Output already exists; use a new staging directory: {output}')
    require(not any(source == output or source.is_relative_to(output) for source in sources.values()), 'Output must not contain an input source.')
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix='.raven-media-staging-', dir=output.parent))
    try:
        asset_dir = staging / 'assets'
        media_dir = asset_dir / 'expansion' / 'media'
        media_dir.mkdir(parents=True)
        manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
        mapping = {entry['id']: entry for entry in records(manifest)}
        filenames = {'lab-channel-a':'lab-channel-a.wav', 'ma22-call':'ma22-call.wav',
                     **{f'lab-camera-{name}': f'lab-{name}.mp4' for name in CAMERAS}}
        for identity, source in sources.items():
            target = media_dir / filenames[identity]
            shutil.copyfile(source, target)
            require(sha256(target) == metadata[identity]['sha256'], 'Source changed while staging; retry from stable inputs.')
        derived = [('lab-channel-b', 36, 90, False), ('lab-published-excerpt', *excerpt, False),
                   ('lab-reversed-excerpt', 73, phrase_end, True)]
        for identity, start, end, reverse in derived:
            filenames[identity] = identity + '.wav'
            samples = derive_pcm(media_dir / 'lab-channel-a.wav', media_dir / filenames[identity], start, end, reverse)
            mapping[identity].update({'derivedFrom':'lab-channel-a', 'sourceSha256':metadata['lab-channel-a']['sha256'],
                                     'sourceRangeSeconds':[start, end], 'sourceRangeSamples':samples,
                                     'operation':'reverse-sample-frames' if reverse else 'slice-sample-frames'})
        for identity, filename in filenames.items():
            entry = mapping[identity]
            entry.update(inspect(media_dir / filename, 'video' if identity.startswith('lab-camera-') else 'audio'))
            entry.update({'status':'prepared', 'url':f'expansion/media/{filename}',
                          'provenance':'أداء/تصوير مؤلف لمراجعة 2026؛ ملف مورّد فعلي خضع لفحص تقني، وليس تسجيلًا جنائيًا من 2019.'})
        cue_groups = [('ma22-call',sheet['call'],0,None), ('lab-channel-a',sheet['masterA'],0,90),
                      ('lab-channel-b',sheet['masterA'],36,90), ('lab-published-excerpt',sheet['masterA'],*excerpt)]
        cue_groups.extend((f'lab-camera-{name}',sheet['cameras'][name],0,20) for name in CAMERAS)
        for identity, cues, start, end in cue_groups:
            caption = media_dir / (identity + '.vtt')
            write_vtt(caption,cues,start,end)
            mapping[identity].update({'captionUrl':f'expansion/media/{caption.name}', 'captionSha256':sha256(caption)})
        mapping['lab-reversed-excerpt']['captionUrl'] = None
        mapping['lab-reversed-excerpt'].pop('captionSha256',None)
        manifest['preparation'] = {'tool':'prepare_media.py', 'createdAt':datetime.now(timezone.utc).isoformat(),
            'sourceFiles':{identity:{'filename':path.name,'sha256':metadata[identity]['sha256']} for identity,path in sources.items()},
            'cueSheetCheckedAgainstScript':True, 'spokenContentVerification':'not-automated',
            'contentReviewNote':args.content_review_note or '',
            'note':'Technical decode, metadata, checksum and lossless sample validation do not recognize dialogue or verify scene performance.'}
        manifest['note'] = 'Prepared from supplied files. Only decoded, hash-verified media explicitly activated is ready; written alternatives remain available.'
        staged_manifest = asset_dir / 'expansion-media-manifest.json'
        staged_manifest.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        validate_manifest(staged_manifest)
        if args.activate:
            for entry in records(manifest): entry['status'] = 'ready'
            staged_manifest.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
            validate_manifest(staged_manifest,require_complete=True)
        (staging/'source-cues.json').write_text(json.dumps(sheet,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        staging.rename(output)
    except BaseException:
        shutil.rmtree(staging,ignore_errors=True)
        raise
    return {'output':str(output), 'manifest':str(output/'assets'/'expansion-media-manifest.json'),
            'activated':bool(args.activate), 'siteChanged':False, 'sourcesChanged':False}


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    commands=parser.add_subparsers(dest='command',required=True)
    template=commands.add_parser('cue-template',help='Print canonical cue-sheet JSON with unfilled actual end/start times.')
    template.add_argument('--output',help='New JSON file; without this, print to stdout.')
    ingest=commands.add_parser('prepare',help='Stage actual files and lossless derivatives; never overwrite the site.')
    for flag in ('master-a','call','camera-intake','camera-scanner','camera-review','cue-sheet'):
        ingest.add_argument('--'+flag,required=True)
    for flag in ('excerpt-start','excerpt-end','phrase-end'):
        ingest.add_argument('--'+flag,type=float,help='Actual source seconds. Defaults to the supplied cue sheet; any override must agree with it.')
    ingest.add_argument('--output',help='New output directory. Default: a temporary staging directory.')
    ingest.add_argument('--activate',action='store_true',help='Emit ready records only after complete technical validation. Does not publish to the site.')
    ingest.add_argument('--content-review-note',default='',help='Optional factual record of manual performance/cue review; never inferred by the tool.')
    verify=commands.add_parser('validate',help='Check actual local bytes, decode, metadata and master/derivative sample identity.')
    verify.add_argument('--manifest',default=str(MANIFEST))
    verify.add_argument('--require-complete',action='store_true',help='Fail if any required record is pending or prepared.')
    args=parser.parse_args(argv)
    try:
        if args.command=='cue-template':
            content=json.dumps(cue_template(),ensure_ascii=False,indent=2)+'\n'
            if args.output:
                with Path(args.output).open('x',encoding='utf-8') as output: output.write(content)
                result={'cueSheet':str(Path(args.output).resolve())}
            else:
                print(content,end='');return 0
        elif args.command=='prepare': result=prepare(args)
        else: result=validate_manifest(args.manifest,args.require_complete)
        print(json.dumps(result,ensure_ascii=False,indent=2));return 0
    except (MediaError,OSError,ValueError,KeyError,TypeError) as error:
        print(f'Media validation failed: {error}',file=sys.stderr);return 1


if __name__=='__main__':
    raise SystemExit(main())
