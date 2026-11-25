"""Play the station and edit a director scene in a fresh mobile browser."""
import argparse
import json
import os
import shutil
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

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
    page.evaluate('document.fonts.ready')
    page.screenshot(path=str(args.output/'lobby-mobile.png'))
    page.locator('.night-card[href*="station-shadow"]').click()
    scene = page.locator('[data-game="station-view"]')
    game = lambda key: page.locator('[data-game="'+key+'"]')
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
    for _ in range(6):
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
    tool('play').click()
    expect(tool('play')).to_have_text('Replay my scene',timeout=16000)
    tool('save').click()
    assert page.locator('a[href*="idea-to-studio"]').is_visible()
    page.screenshot(path=str(args.output/'director-mobile.png'),full_page=True)
    page.locator('.night-wing').click()
    links=page.locator('.night-card')
    expect(links).to_have_count(20)
    routes=links.evaluate_all('(cards) => cards.map(a => a.href)')
    assert len(set(routes)) == 20
    for route in routes:
        page.goto(route,wait_until='domcontentloaded')
        expect(page.locator('.night-bench > :visible').first).to_be_visible()
        expect(page.locator('html')).to_have_attribute('lang','en')
    result={'loaded_activities':len(routes),'home':args.home,'station':'crossed with recorded shadow','first_open_ms':opening,
            'director_seconds':8,'edited_blackout_seconds':3,'languages':['ar','en']}
    (args.output/'journey.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result))
    if 'GITHUB_STEP_SUMMARY' in os.environ:
        with open(os.environ['GITHUB_STEP_SUMMARY'],'a') as summary:
            summary.write(f"Played the published station in mobile Chrome. The recorded shadow opened the door at {opening} ms. "
                          f"Played an edited eight-second scene in English after setting its blackout to three seconds in Arabic. "
                          f"Opened all {len(routes)} distinct Late Night activities. See journey.json and mobile screenshots in the run artifacts.\n")
    browser.close()
