"""Play the public Ink Nights programme on a mobile viewport, reopen drawing workshops and inspect the exported manga page."""
import argparse
from contextlib import contextmanager
import base64
import json
import os
from pathlib import Path
import shutil
import struct
import traceback
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--home', default='https://iid7oom21.github.io/abdulrhman/raven/')
parser.add_argument('--output', type=Path, default=Path(os.getenv('RUNNER_TEMP', '/tmp')) / 'ink-nights')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)

stage = 'open the programme'
page = None
browser_events = []
origin = urlsplit(args.home).netloc


def collect_event(url, result):
    path = urlsplit(url)
    if path.netloc == origin:
        browser_events.append(f"{path.path}: {result}")


@contextmanager
def failure_evidence():
    try:
        yield
    except Exception as exc:
        line = next((frame.lineno for frame in reversed(traceback.extract_tb(exc.__traceback__))
                     if frame.filename == __file__), None)
        route = urlsplit(page.url).path if page else ''
        failure = {'stage': stage, 'route': route, 'test_line': line,
                   'error': str(exc).splitlines()[:4], 'browser_events': browser_events[-8:]}
        (args.output / 'failure.json').write_text(json.dumps(failure, ensure_ascii=False, indent=2))
        if os.environ.get('GITHUB_ACTIONS') == 'true':
            detail = json.dumps(failure, ensure_ascii=False).replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
            print('::error title=Published Ink Nights check::' + detail, flush=True)
        if page and not page.is_closed():
            try:
                page.screenshot(path=args.output / 'failed-stage.png', timeout=3000)
            except Exception:
                pass
        raise


with sync_playwright() as pw, failure_evidence():
    browser = pw.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'))
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True,
                              locale='ar', reduced_motion='reduce', accept_downloads=True)
    page = ctx.new_page()
    page.on('response', lambda response: collect_event(response.url, response.status) if response.status >= 400 else None)
    page.on('requestfailed', lambda request: collect_event(request.url, request.failure))
    page.on('pageerror', lambda error: collect_event(page.url, str(error).splitlines()[0][:180]))
    page.goto(args.home, wait_until='domcontentloaded')
    page.locator('#archive-night-hub').tap()
    page.locator('[data-ink-program]').tap()
    cards = page.locator('[data-ink-route]')
    approved = {'cut', 'ferry', 'page', 'camera', 'beacon', 'courier', 'lines', 'letters'}
    expect(cards).to_have_count(len(approved))
    routes = {a.get_attribute('data-ink-route'): a.get_attribute('href') for a in cards.all()}
    assert set(routes) == approved, sorted(routes)
    for card in cards.all():
        photo = card.locator('img')
        photo.scroll_into_view_if_needed()
        photo.evaluate('image => image.decode()')
    page.evaluate('window.scrollTo(0,0)')
    page.screenshot(path=args.output / 'programme.png')

    stage = 'play the timed cut'
    page.locator('[data-ink-route="cut"]').tap()
    for shot in ('pier', 'signal', 'deck'):
        page.locator(f'[data-cut-action="add-{shot}"]').tap()
        page.locator(f'[data-duration="{shot}"]').select_option('2')
    page.locator('[data-cut-action="play"]').tap()
    expect(page.locator('[data-passed="true"]')).to_be_visible(timeout=13000)

    stage = 'inspect the ferry'
    page.goto(routes['ferry'])
    page.locator('[data-viewpoint="shore"]').tap()
    page.locator('[data-ferry="next"]').tap()
    shot = page.locator('img[data-plate="signal"]')
    shot.evaluate('image => image.decode()')
    page.screenshot(path=args.output / 'ferry-playing.png')
    page.locator('[data-ferry="next"]').tap()
    expect(page.locator('.ink-result')).to_be_visible()

    stage = 'measure camera parallax'
    page.goto(routes['camera'])
    for key, setting in [('travel', '60'), ('spacing', '80'), ('seek', '100')]:
        page.locator(f'[data-camera="{key}"]').fill(setting)
    camera = page.locator('[data-camera="frame"]')
    expect(camera).to_have_attribute('data-difference', '36')

    stage = 'operate the beacon'
    page.goto(routes['beacon'])
    step = page.locator('[data-beacon="step"]')
    for _ in range(4):
        step.tap()
    bearing = round(float(page.locator('[data-beacon="bearing"]').evaluate("el => el.value")))
    page.locator('[data-beacon="angle"]').fill(str(bearing))
    page.locator('[data-beacon="signal"]').tap()
    step.tap()
    step.tap()
    expect(page.locator('[data-beacon="result"]')).to_have_attribute('data-outcome', 'acknowledged')

    def scene(key):
        return page.locator(f'[data-scene="{key}"]')

    stage = 'edit the speed-line workshop'
    page.goto(routes['lines'])
    scene('step').select_option('2')
    scene('check').tap()
    verdict = page.locator('.manga-result')
    expect(verdict).to_have_attribute('data-ok', 'false')
    scene('smear').tap()
    scene('mode').select_option('budget')
    scene('check').tap()
    expect(verdict).to_have_attribute('data-ok', 'true')
    scene('play').tap()
    expect(verdict).to_contain_text('✓')
    scene('save').tap()

    stage = 'edit the lettering workshop'
    page.goto(routes['letters'])
    for line, spot in [(0, 1), (1, 0), (2, 2)]:
        scene(f'line-{line}').tap()
        scene(f'spot-{spot}').tap()
    scene('read').tap()
    expect(verdict).to_have_attribute('data-ok', 'false')
    for line in range(3):
        scene(f'line-{line}').tap()
        scene(f'spot-{line}').tap()
    scene('read').tap()
    expect(verdict).to_have_attribute('data-ok', 'true')
    page.screenshot(path=args.output / 'letters-read.png')
    scene('save').tap()

    stage = 'reopen both drawings'
    pieces = page.evaluate("""() => Object.entries(localStorage)
        .filter(([key]) => key.startsWith('raven.late-night.v1.piece.'))
        .map(([, value]) => JSON.parse(value).value)""")
    saved = {piece['activity']: piece for piece in pieces}
    assert saved['ink-lines']['data']['step'] == 2 and saved['ink-lines']['data']['smear']
    assert saved['ink-letters']['data']['spots'] == [0, 1, 2]
    notebook = routes['letters'].replace('ink-letters.html', 'my-notebook.html')
    page.goto(notebook)
    for name, piece in [('letters', saved['ink-letters']), ('lines', saved['ink-lines'])]:
        link = page.locator(f'a[href*="ink-{name}.html"][href*="piece={piece["id"]}"]')
        link.first.tap()
        if name == 'letters':
            scene('read').tap()
            expect(verdict).to_have_attribute('data-ok', 'true')
        else:
            expect(scene('smear')).to_have_attribute('aria-pressed', 'true')
            expect(scene('mode')).to_have_value('budget')
        page.screenshot(path=args.output / f'{name}-reopened.png')
        page.goto(notebook)

    stage = 'walk the courier route'
    page.goto(routes['courier'])
    courier_path = [15, 10, 5, 0, 1, 2, 3, 4, 9, 14, 19, 24]
    for cell in courier_path:
        step_meter = page.locator('#steps-meter')
        before_selection = step_meter.inner_text()
        page.locator(f'[data-cell="{cell}"]').tap()
        expect(step_meter).to_have_text(before_selection)
        page.locator('#confirm').tap()
    expect(page.locator('#status')).to_have_attribute('data-outcome', 'delivered')
    stage = 'print the weather sheet'
    page.locator('#weatherTab').tap()
    page.locator('#rain').fill('80')
    page.locator('#wind').fill('-30')
    with page.expect_download() as weather_download:
        page.locator('#print').tap()
    weather_path = args.output / 'courier-weather.png'
    weather_download.value.save_as(weather_path)
    weather_png = weather_path.read_bytes()
    assert weather_png[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', weather_png[16:24]) == (800, 450)

    stage = 'edit and export the courier manga'
    page.locator('#mangaTab').tap()
    panels = page.locator('#panels .panel')
    expect(panels).to_have_count(3)
    panels.first.locator('.move-later').tap()
    order = ['middle', 'departure', 'end']
    def panel_order():
        return panels.evaluate_all('(cards) => cards.map(card => card.dataset.panel)')
    assert panel_order() == order
    for panel in panels.all():
        panel.locator('img').evaluate('img => img.decode()')
    page.locator('#save-manga').tap()
    with page.expect_download() as manga_download:
        page.locator('#export').tap()
    manga_path = args.output / 'courier-manga.json'
    manga_download.value.save_as(manga_path)
    work = json.loads(manga_path.read_bytes())
    assert work['activity'] == 'ink-courier' and work['format'] == 'raven-late-night-work'
    assert work['data'] == {'format': 'raven-rain-manga-2', 'path': courier_path,
                            'order': order, 'weather': {'rain': 80, 'wind': -30}}
    page.screenshot(path=args.output / 'courier-delivered.png')
    stage = 'reopen the courier manga'
    page.goto(notebook)
    page.locator('a[href*="ink-courier.html"][href*="piece="]').first.tap()
    expect(panels).to_have_count(3)
    assert panel_order() == order
    page.screenshot(path=args.output / 'courier-reopened.png')

    stage = 'select the three print-shop panels'
    page.goto(routes['page'])
    for panel in ('window', 'type', 'press'):
        page.locator('[data-page="pick-' + panel + '"]').tap()
    page.locator('[data-page="preview"]').tap()
    sheet = page.locator('[data-page="sheet"]')
    expect(sheet).to_have_attribute('data-panels', 'window,type,press')
    expect(sheet).to_have_attribute('data-direction', 'rtl')
    page.locator('[data-night-language]').tap()
    expect(page.locator('html')).to_have_attribute('lang', 'en')
    expect(sheet).to_have_attribute('data-panels', 'window,type,press')
    expect(sheet).to_have_attribute('data-direction', 'rtl')
    stage = 'print and decode the bilingual manga page'
    with page.expect_download() as downloading:
        page.locator('[data-page="png"]').tap()
    photo = args.output / 'selected-manga.png'
    downloading.value.save_as(photo)
    raw = photo.read_bytes()
    assert raw[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', raw[16:24]) == (880, 984)
    decoded = page.evaluate('''async data => {
        const img = new Image(); img.src = 'data:image/png;base64,' + data;
        await img.decode(); return [img.naturalWidth, img.naturalHeight];
    }''', base64.b64encode(raw).decode('ascii'))
    assert decoded == [880, 984]
    sheet.scroll_into_view_if_needed()
    page.screenshot(path=args.output / 'page-on-phone.png')
    proof = {'home': args.home, 'activities': sorted(routes), 'cut_seconds': 6, 'ferry_view': 'shore',
             'speed_lines': 'twos with a smear frame inside the 18-drawing budget',
             'speech_bubbles': 'reading order and tails accepted',
             'workshop_notebook_reopened': ['ink-lines', 'ink-letters'],
             'camera_parallax_px': 36, 'beacon': 'acknowledged', 'courier': {'steps': len(courier_path), 'outcome': 'delivered',
             'reopened_panels': order, 'weather_png_px': [800, 450]},
             'manga_panels': ['window', 'type', 'press'],
             'export_px': [880, 984], 'manga_direction_after_language_switch': 'rtl'}
    (args.output / 'journey.json').write_text(json.dumps(proof, indent=2))
    print(json.dumps(proof))
    if 'GITHUB_STEP_SUMMARY' in os.environ:
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as summary:
            summary.write('Played eight Ink Nights activities at 390px, reopened both workshops and the courier manga, downloaded the rain frame and exported the chosen 880 × 984 manga page.\n')
    browser.close()
