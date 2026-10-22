"""Synthetic fixtures stay inside TemporaryDirectory; none are site assets or performances."""
import argparse
from array import array
import copy
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch
import wave

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'prepare_media.py'
SPEC = importlib.util.spec_from_file_location('raven_media_pipeline', SCRIPT)
media = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(media)


class MediaPipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='raven-synthetic-media-tests-')
        cls.root = Path(cls.temp.name)
        cls.sources = cls.root / 'TEST_FIXTURES_NOT_FOR_PUBLICATION'
        cls.sources.mkdir()
        cls.master = cls.sources / 'synthetic-master.wav'
        cls.call = cls.sources / 'synthetic-call.wav'
        # Distinct seconds and distinct stereo channels detect wrong offsets,
        # reversed bytes, or swapped channels. These are not generated voices.
        with wave.open(str(cls.master), 'wb') as output:
            output.setnchannels(2); output.setsampwidth(2); output.setframerate(media.RATE)
            for second in range(90):
                frames = array('h')
                for index in range(media.RATE):
                    sample = (index % 251 - 125) * (second + 1)
                    frames.extend((sample, -sample))
                output.writeframes(frames.tobytes())
        media.derive_pcm(cls.master, cls.call, 0, 10)
        cls.camera = cls.sources / 'synthetic-camera.mp4'
        media.run(['ffmpeg', '-nostdin', '-v', 'error', '-f', 'lavfi', '-i',
                   'color=c=black:s=1920x1080:r=24:d=20', '-an', '-c:v', 'libx264',
                   '-preset', 'ultrafast', '-crf', '40', '-pix_fmt', 'yuv420p',
                   '-movflags', '+faststart', str(cls.camera)])
        cls.sheet = media.cue_template()
        for cue, interval in zip(cls.sheet['masterA'], [(38, 42), (50, 54), (60, 64), (73, 77)]):
            cue['start'], cue['end'] = interval
        for index, cue in enumerate(cls.sheet['call']):
            cue['start'], cue['end'] = index * 2, index * 2 + 1.8
        for cue in cls.sheet['cameras'].values(): cue[0]['end'] = cue[0]['start'] + 1
        cls.cue_file = cls.sources / 'synthetic-cues.json'
        cls.cue_file.write_text(json.dumps(cls.sheet, ensure_ascii=False), encoding='utf-8')
        cls.args = argparse.Namespace(master_a=str(cls.master), call=str(cls.call),
            camera_intake=str(cls.camera), camera_scanner=str(cls.camera), camera_review=str(cls.camera),
            cue_sheet=str(cls.cue_file), excerpt_start=60., excerpt_end=64., phrase_end=77.,
            output=str(cls.root/'TEST_RELEASE_NOT_FOR_PUBLICATION'), activate=True,
            content_review_note='SYNTHETIC TEST FIXTURES ONLY. No dialogue or production scene is claimed.')
        cls.before = {path: media.sha256(path) for path in (cls.master, cls.call, cls.camera)}
        cls.result = media.prepare(cls.args)
        cls.manifest_path = Path(cls.result['manifest'])
        cls.manifest = json.loads(cls.manifest_path.read_text(encoding='utf-8'))

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_actual_bytes_lossless_samples_and_declared_timings(self):
        report = media.validate_manifest(self.manifest_path, require_complete=True)
        self.assertEqual(report, {'verified': 8, 'ready': 8, 'pending': 0, 'complete': True})
        self.assertFalse(self.result['siteChanged'])
        self.assertEqual(self.before, {path: media.sha256(path) for path in self.before})
        entries = {entry['id']: entry for entry in media.records(self.manifest)}
        channel = entries['lab-channel-b']
        self.assertEqual(channel['sourceRangeSamples'], [36 * media.RATE, 90 * media.RATE])
        self.assertEqual(channel['durationSeconds'], 54)
        self.assertEqual(channel['calibrationSeconds'], 12)
        self.assertEqual(entries['lab-camera-scanner']['clockOffsetSeconds'], 420)
        self.assertEqual(entries['lab-reversed-excerpt']['sourceRangeSeconds'], [73, 77])
        self.assertEqual(self.manifest['preparation']['spokenContentVerification'], 'not-automated')

    def test_reverse_preserves_stereo_sample_frames_not_byte_order(self):
        _, source = media.read_pcm(self.master)
        reverse = self.manifest_path.parent / self.manifest['reversed']['url']
        parameters, reversed_frames = media.read_pcm(reverse)
        width = parameters.nchannels * parameters.sampwidth
        original = source[73 * media.RATE * width:77 * media.RATE * width]
        restored = b''.join(reversed_frames[index:index+width] for index in range(len(reversed_frames)-width, -1, -width))
        self.assertEqual(restored, original)
        self.assertNotEqual(reversed_frames, original[::-1])

    def test_channel_b_and_excerpt_captions_are_cut_from_the_same_cue_sheet(self):
        entry = self.manifest['channels'][1]
        captions = (self.manifest_path.parent / entry['captionUrl']).read_text(encoding='utf-8')
        self.assertIn('00:00:37.000 --> 00:00:41.000', captions)
        excerpt = self.manifest['excerpt']
        captions = (self.manifest_path.parent / excerpt['captionUrl']).read_text(encoding='utf-8')
        self.assertIn('00:00:00.000 --> 00:00:04.000', captions)
        self.assertIn(media.MASTER_LINES[2][1], captions)
        self.assertIsNone(self.manifest['reversed']['captionUrl'])

    def test_incomplete_manifest_cannot_pass_release_gate(self):
        with self.assertRaisesRegex(media.MediaError, 'not ready'):
            media.validate_manifest(media.MANIFEST, require_complete=True)
        self.assertEqual(media.validate_manifest(media.MANIFEST)['ready'], 0)
        pending = copy.deepcopy(self.manifest)
        pending['call']['status'] = 'prepared'
        path = self.manifest_path.parent / 'prepared-test.json'
        path.write_text(json.dumps(pending), encoding='utf-8')
        with self.assertRaisesRegex(media.MediaError, 'not ready'):
            media.validate_manifest(path, require_complete=True)

    def test_default_staging_is_prepared_and_uses_supplied_cue_ranges(self):
        args = copy.copy(self.args)
        args.activate = False
        args.output = str(self.root / 'UNACTIVATED_TEST_RELEASE')
        args.excerpt_start = args.excerpt_end = args.phrase_end = None
        result = media.prepare(args)
        manifest = json.loads(Path(result['manifest']).read_text(encoding='utf-8'))
        self.assertFalse(result['activated'])
        self.assertTrue(all(entry['status'] == 'prepared' for entry in media.records(manifest)))
        self.assertEqual(manifest['excerpt']['sourceRangeSeconds'], [60, 64])
        self.assertEqual(manifest['reversed']['sourceRangeSeconds'], [73, 77])
        with self.assertRaisesRegex(media.MediaError, 'not ready'):
            media.validate_manifest(result['manifest'], require_complete=True)

    def test_wrong_digest_and_missing_source_cannot_claim_ready(self):
        changed = copy.deepcopy(self.manifest)
        changed['call']['sha256'] = '0' * 64
        path = self.manifest_path.parent / 'bad-hash.json'
        path.write_text(json.dumps(changed), encoding='utf-8')
        with self.assertRaisesRegex(media.MediaError, 'sha256'):
            media.validate_manifest(path, require_complete=True)
        changed['call']['url'] = 'expansion/media/not-present.wav'
        path.write_text(json.dumps(changed), encoding='utf-8')
        with self.assertRaisesRegex(media.MediaError, 'Missing media'):
            media.validate_manifest(path, require_complete=True)

    def test_runtime_size_limit_rejects_actual_oversized_file_before_probe(self):
        oversized = self.root / 'oversized-sparse-test.mp4'
        with oversized.open('xb') as output:
            output.truncate(media.MAX_MEDIA_BYTES + 1)
        self.assertEqual(oversized.stat().st_size, 64 * 1024 * 1024 + 1)
        with patch.object(media, 'probe') as probe:
            with self.assertRaisesRegex(media.MediaError, 'at most 64 MiB'):
                media.inspect(oversized, 'video')
            probe.assert_not_called()
        changed = copy.deepcopy(self.manifest)
        # Verification applies the same bound to prepared/ready staged files.
        target = self.manifest_path.parent / 'oversized-sparse-test.mp4'
        with target.open('xb') as output:
            output.truncate(media.MAX_MEDIA_BYTES + 1)
        changed['call']['url'] = target.name
        path = self.manifest_path.parent / 'oversized-test.json'
        path.write_text(json.dumps(changed), encoding='utf-8')
        with self.assertRaisesRegex(media.MediaError, 'at most 64 MiB'):
            media.validate_manifest(path, require_complete=True)

    def test_range_and_canonical_dialogue_checks(self):
        for bounds in ((-1, 4), (4, 4), (70, 91), (float('nan'), 4), (0, 0.000001)):
            with self.assertRaises(media.MediaError): media.source_range(*bounds)
        bad = copy.deepcopy(self.sheet)
        bad['call'][0]['text'] = 'invented confession'
        with self.assertRaisesRegex(media.MediaError, 'approved dialogue'):
            media.check_cue_sheet(bad, 10, [60, 64], 77)
        with self.assertRaisesRegex(media.MediaError, 'complete third master cue'):
            media.check_cue_sheet(self.sheet, 10, [61, 64], 77)
        bad = copy.deepcopy(self.sheet); bad['calibrationSeconds'] = 47
        with self.assertRaisesRegex(media.MediaError, 'calibration'):
            media.check_cue_sheet(bad, 10, [60, 64], 77)

    def test_unsafe_urls_and_duplicate_ids_rejected_before_decode(self):
        for url in ('../outside.wav', '/tmp/file.wav', 'https://example.com/file.wav', 'media.wav?x=1', 'x\\file.wav'):
            with self.assertRaises(media.MediaError): media.safe_local(self.root, url)
        changed = copy.deepcopy(self.manifest)
        changed['cameras'][0]['id'] = changed['call']['id']
        path = self.manifest_path.parent / 'duplicate-test.json'
        path.write_text(json.dumps(changed), encoding='utf-8')
        with self.assertRaisesRegex(media.MediaError, 'eight unique'):
            media.validate_manifest(path)
        path.write_text('[]', encoding='utf-8')
        with self.assertRaisesRegex(media.MediaError, 'JSON object'):
            media.validate_manifest(path)

    def test_non_derivative_pcm_fails_even_if_own_digest_is_updated(self):
        clone = self.root / 'tamper-test'
        shutil.copytree(self.manifest_path.parent, clone)
        manifest = copy.deepcopy(self.manifest)
        reversed_file = clone / manifest['reversed']['url']
        params, frames = media.read_pcm(reversed_file)
        damaged = bytearray(frames); damaged[30] ^= 1
        with wave.open(str(reversed_file), 'wb') as output:
            output.setparams(params); output.writeframes(damaged)
        manifest['reversed'].update(media.inspect(reversed_file, 'audio'))
        path = clone / 'expansion-media-manifest.json'
        path.write_text(json.dumps(manifest), encoding='utf-8')
        with self.assertRaisesRegex(media.MediaError, 'lossless derivation'):
            media.validate_manifest(path, require_complete=True)


if __name__ == '__main__':
    unittest.main()
