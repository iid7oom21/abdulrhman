"""Play the public Ink Nights programme on a mobile viewport, reopen drawing workshops and inspect the exported manga page."""
import argparse
import base64
import json
import os
from pathlib import Path
import shutil
import struct

from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--home', default='https://iid7oom21.github.io/abdulrhman/raven/')
parser.add_argument('--output', type=Path, default=Path(os.getenv('RUNNER_TEMP', '/tmp')) / 'ink-nights')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'))
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True,
                              locale='ar', reduced_motion='reduce', accept_downloads=True)
    page = ctx.new_page()
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

    page.locator('[data-ink-route="cut"]').tap()
    for shot in ('pier', 'signal', 'deck'):
        page.locator(f'[data-cut-action="add-{shot}"]').tap()
        page.locator(f'[data-duration="{shot}"]').select_option('2')
    page.locator('[data-cut-action="play"]').tap()
    expect(page.locator('[data-passed="true"]')).to_be_visible(timeout=13000)

    page.goto(routes['ferry'])
    page.locator('[data-viewpoint="shore"]').tap()
    page.locator('[data-ferry="next"]').tap()
    shot = page.locator('img[data-plate="signal"]')
    shot.evaluate('image => image.decode()')
    page.screenshot(path=args.output / 'ferry-playing.png')
    page.locator('[data-ferry="next"]').tap()
    expect(page.locator('.ink-result')).to_be_visible()

    page.goto(routes['camera'])
    for key, setting in [('travel', '60'), ('spacing', '80'), ('seek', '100')]:
        page.locator(f'[data-camera="{key}"]').fill(setting)
    camera = page.locator('[data-camera="frame"]')
    expect(camera).to_have_attribute('data-difference', '36')

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

    page.goto(routes['courier'])
    for cell in (15, 10, 5, 0, 1, 2, 3, 4, 9, 14, 19, 24):
        page.locator(f'[data-cell="{cell}"]').tap()
    expect(page.locator('#status')).to_contain_text('وصلت الرسالة')
    page.locator('#mangaTab').tap()
    expect(page.locator('#panels .panel')).to_have_count(3)
    page.screenshot(path=args.output / 'courier-delivered.png')

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
             'camera_parallax_px': 36, 'beacon': 'acknowledged', 'courier': 'delivered in 12 moves',
             'manga_panels': ['window', 'type', 'press'],
             'export_px': [880, 984], 'manga_direction_after_language_switch': 'rtl'}
    (args.output / 'journey.json').write_text(json.dumps(proof, indent=2))
    print(json.dumps(proof))
    if 'GITHUB_STEP_SUMMARY' in os.environ:
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as summary:
            summary.write('Played eight Ink Nights activities at 390px, reopened both saved workshops, delivered the courier letter and exported the chosen 880 × 984 manga page.\n')
    browser.close()
