"""Play the published Late Night catalogue and complete its interactive night shift."""
import argparse
import base64
import json
import os
import shutil
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import expect, sync_playwright

ACTIVITIES = {
    'station-shadow', 'reel-run', 'last-minute-auction', 'lost-and-found', 'dome-sky',
    'echo-two', 'echo-last-seat', 'darkroom-minute', 'weightless-cam', 'tide-harbor',
    'fabric-wind', 'director-sentence', 'reading-actor', 'city-radio', 'puzzle-owner',
    'replay-caller', 'memory-lift', 'seven-windows', 'curtain-party', 'sound-museum',
    'nightshift-post', 'nightshift-paper', 'nightshift-window', 'nightshift-seat',
}


def deliver_mail(page, route):
    page.goto(route)
    clock = page.locator('[data-post="clock"]')
    expect(clock).to_have_attribute('data-minute', '0')
    for move in ('up', 'unload:film', 'load:keys', 'load:slides', 'down', 'deliver:keys',
                 'up', 'up', 'deliver:slides', 'down', 'load:film', 'up', 'up', 'deliver:film'):
        page.locator(f'[data-post="{move}"]').tap()
    expect(clock).to_have_attribute('data-minute', '21')
    expect(page.locator('[data-post="result"]')).to_have_attribute('data-on-time', '3')
    page.screenshot(path=args.output / 'post-delivered.png')
    return {'on_time': 3, 'minutes': 21}


def print_paper(page, route):
    page.goto(route)
    sheet = page.locator('[data-paper="sheet"]')
    expect(sheet).to_have_attribute('data-stock', 'grain')
    page.locator('[data-paper="dab"]').tap()
    before = sheet.evaluate('c => c.toDataURL()')
    page.locator('[data-paper="spread"]').tap()
    after = sheet.evaluate('c => c.toDataURL()')
    assert after != before
    page.locator('[data-paper="undo"]').tap()
    assert sheet.evaluate('c => c.toDataURL()') == before
    page.locator('[data-paper="redo"]').tap()
    assert sheet.evaluate('c => c.toDataURL()') == after
    with page.expect_download() as completed:
        page.locator('[data-paper="png"]').tap()
    photo = args.output / 'rain-paper.png'
    completed.value.save_as(photo)
    image = base64.b64encode(photo.read_bytes()).decode('ascii')
    matches = sheet.evaluate("""async (sheet, data) => {
        const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode();
        if (img.naturalWidth !== sheet.width || img.naturalHeight !== sheet.height) return false;
        const copy = document.createElement('canvas'); copy.width = img.width; copy.height = img.height;
        const ctx = copy.getContext('2d'); ctx.drawImage(img, 0, 0);
        const out = ctx.getImageData(0, 0, copy.width, copy.height).data;
        const view = sheet.getContext('2d').getImageData(0, 0, sheet.width, sheet.height).data;
        return out.every((channel, i) => channel === view[i]);
    }""", image)
    assert matches, 'downloaded paper differs from the rendered sheet'
    return {'printed_px': sheet.evaluate('c => [c.width, c.height]'), 'pixels_verified': matches}


def edit_window(page, route):
    page.goto(route)
    frame = page.locator('#window-frame')
    for key, value in [('curtain', '1'), ('gaze', '2'), ('boat', '4'), ('time', '4.6')]:
        page.locator('#window-' + key).fill(value)
    expect(frame).to_have_attribute('data-gaze', 'sea')
    expect(frame).to_have_attribute('data-boat', 'passing')
    expect(page.locator('[data-layer="reflection"]')).to_be_visible()
    for image in page.locator('[data-layer]').all():
        image.evaluate('img => img.decode()')
    page.screenshot(path=args.output / 'window-edit.png')
    page.locator('#window-gaze').fill('5')
    expect(frame).to_have_attribute('data-gaze', 'lap')
    page.locator('#window-replay').tap()
    expect(page.locator('#window-reading')).to_be_visible(timeout=18000)
    expect(page.locator('#window-time')).to_have_value('12')
    expect(page.locator('#window-reading')).to_contain_text('while the boat was in view')
    return {'take_seconds': 12, 'gaze_seconds': 5, 'boat_seconds': 4}


def keep_seat_endings(page, route):
    page.goto(route)
    scenes = [('ticket', 'ticket'), ('aisle', 'seat'), ('deck', 'tape'), ('phone', 'line')]
    for scene, item in scenes:
        expect(page.locator('[data-scene]')).to_have_attribute('data-scene', scene)
        page.locator('.seat-photo img').evaluate('img => img.decode()')
        page.locator(f'[data-inspect="{item}"]').tap()
        if item == 'tape':
            sound = page.locator('[data-excerpt]')
            sound.tap()
            expect(page.locator('.seat-cues [aria-current="time"]')).to_have_count(1, timeout=10000)
            expect(sound).to_have_text('Hear the excerpt again', timeout=12000)
        page.locator('[data-next]').tap()
    page.locator('[data-checkpoint]').tap()
    page.reload()
    page.locator('[data-restore]').tap()
    options = ['play', 'hold', 'ask']
    titles = []
    for choice in options:
        expect(page.locator('[data-scene]')).to_have_attribute('data-scene', 'interval')
        page.locator(f'[data-choice="{choice}"]').tap()
        page.locator(f'[data-perform="{choice}"]').tap()
        result = page.locator(f'[data-ending="{choice}"]')
        titles.append(result.locator('h2').inner_text())
        result.locator('[data-keep]').tap()
        expect(result.locator('[data-keep]')).to_be_disabled()
        if choice != options[-1]:
            result.locator('[data-revisit]').tap()
    assert len(set(titles)) == 3, titles
    page.screenshot(path=args.output / 'seat-ending.png')
    page.locator('a[href*="my-notebook.html"]').first.tap()
    links = page.locator('a[href*="nightshift-seat.html?piece="]')
    expect(links).to_have_count(3)
    reopened = []
    for href in links.evaluate_all('links => links.map(a => a.href)'):
        page.goto(href)
        saved = page.locator('[data-ending]')
        expect(saved.locator('[data-keep]')).to_be_disabled()
        reopened.append(saved.get_attribute('data-ending'))
    assert sorted(reopened) == sorted(options)
    return {'bookmark_restored': True, 'ending_ids': sorted(reopened), 'excerpt_played': True}


parser = argparse.ArgumentParser()
parser.add_argument('--home', default='https://iid7oom21.github.io/abdulrhman/raven/')
parser.add_argument('--output', type=Path, default=Path(os.getenv('RUNNER_TEMP','/tmp')) / 'late-night-play')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'), args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,locale='ar', reduced_motion='reduce')
    page.goto(args.home,wait_until='domcontentloaded')
    page.locator('#archive-night-hub').click()
    feature = page.locator('.night-feature')
    expect(feature.locator('.night-cta')).to_be_in_viewport()
    feature.locator('img').evaluate('image => image.decode()')
    page.evaluate('document.fonts.ready')
    page.screenshot(path=str(args.output/'lobby-mobile.png'))
    page.locator('.night-card[href*="station-shadow"]').click()
    scene = page.locator('[data-game="station-view"]')
    game = lambda key: page.locator('[data-game="'+key+'"]')
    expect(scene).to_have_attribute('data-scenery','photo')
    expect(scene).to_have_attribute('data-porter','photo')
    expect(game('up')).to_be_hidden()
    game('record').tap()
    expect(game('up')).to_be_visible()
    game('up').tap()
    game('right').tap()
    game('right').tap()
    expect(scene).to_have_attribute('data-phase','ready',timeout=15000)
    game('review').click()
    opening = int(game('first-open').get_attribute('data-ms'))
    assert 0 < opening < 10000
    game('cross').tap()
    expect(scene).to_have_attribute('data-door','open')
    for _ in range(3):
        game('right').tap()
    expect(scene).to_have_attribute('data-phase','play')
    page.screenshot(path=str(args.output/'station-in-play-mobile.png'))
    for _ in range(3):
        game('right').tap()
    expect(scene).to_have_attribute('data-phase','won')
    expect(game('up')).to_be_hidden()
    expect(scene).to_have_attribute('data-player','6,1')
    page.screenshot(path=str(args.output/'station-mobile.png'),full_page=True)

    page.locator('.night-wing').click()
    page.locator('.night-card[href*="director-sentence"]').click()
    tool = lambda key: page.locator('[data-creative="'+key+'"]')
    tool('prompt').fill('انتظار عند رصيف بعد انطفاء اللوحة')
    tool('generate').click()
    tool('duration').select_option('8')
    cutoff = tool('blackout')
    cutoff.focus()
    cutoff.press('Home')
    cutoff.press('ArrowRight')
    assert cutoff.input_value() == '3'
    page.locator('[data-night-language]').click()
    expect(page.locator('html')).to_have_attribute('lang','en')
    assert tool('blackout').input_value() == '3'
    expect(page.locator('canvas[data-shot]')).to_have_attribute('data-visual', 'photograph')
    tool('play').click()
    expect(tool('play')).to_have_text('Replay my scene',timeout=16000)
    tool('save').click()
    assert page.locator('a[href*="idea-to-studio"]').is_visible()
    page.screenshot(path=str(args.output/'director-mobile.png'),full_page=True)
    page.locator('.night-wing').click()
    links=page.locator('.night-card')
    expect(links).to_have_count(len(ACTIVITIES))
    for card in links.all():
        image = card.locator('img')
        image.scroll_into_view_if_needed()
        image.evaluate('element => element.decode()')
    hrefs = links.evaluate_all('(cards) => cards.map(a => a.href)')
    catalogue = urlsplit(page.url)
    routes = {}
    for href in hrefs:
        target = urlsplit(href)
        assert (target.scheme, target.netloc) == (catalogue.scheme, catalogue.netloc), href
        activity = Path(target.path).stem
        assert target.path == catalogue.path.rstrip('/') + '/' + activity + '.html', href
        assert activity not in routes, href
        routes[activity] = href
    assert set(routes) == ACTIVITIES, sorted(set(routes) ^ ACTIVITIES)
    for route in routes.values():
        page.goto(route,wait_until='domcontentloaded')
        expect(page.locator('.night-bench > :visible').first).to_be_visible()
        expect(page.locator('html')).to_have_attribute('lang','en')
    post = deliver_mail(page, routes['nightshift-post'])
    paper = print_paper(page, routes['nightshift-paper'])
    window = edit_window(page, routes['nightshift-window'])
    seat = keep_seat_endings(page, routes['nightshift-seat'])
    result={'seat': seat, 'activity_ids': sorted(routes), 'post': post, 'paper': paper, 'window': window,
            'loaded_activities':len(routes),'home':args.home,'station':'crossed with recorded shadow','first_open_ms':opening,
            'director_seconds':8,'edited_blackout_seconds':3,'languages':['ar','en']}
    (args.output/'journey.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result))
    if os.environ.get('GITHUB_ACTIONS') == 'true':
        print(f"::notice title=Late Night on Pages::{len(routes)} approved activities; "
              f"{post['on_time']} deliveries; export {paper['printed_px']} pixels verified; "
              f"{window['take_seconds']}s coastal take; three saved and reopened endings with audio.", flush=True)
    if 'GITHUB_STEP_SUMMARY' in os.environ:
        with open(os.environ['GITHUB_STEP_SUMMARY'],'a') as summary:
            summary.write(f"Played the published station in mobile Chrome. The recorded shadow opened the door at {opening} ms. "
                          f"Played an edited eight-second scene in English after setting its blackout to three seconds in Arabic. "
                          f"Delivered three parcels, printed the edited paper and screened a twelve-second window scene. Restored the story bookmark, heard its excerpt and reopened all three endings. Opened all {len(routes)} approved activities. See journey.json and mobile screenshots in the run artifacts.\n")
    browser.close()
