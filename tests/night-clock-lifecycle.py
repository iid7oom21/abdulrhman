"""Use --base for a locally served Pages checkout or its exact exported runtime."""
import argparse
import shutil
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--base', required=True, help='URL ending in /raven/late-night/')
args = parser.parse_args()

def hidden(page, value):
    page.evaluate('''value => {
      Object.defineProperty(document, 'hidden', {configurable: true, value});
      document.dispatchEvent(new Event('visibilitychange'));
    }''', value)

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=shutil.which('chromium') or shutil.which('google-chrome'))
    page = browser.new_page(viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
    page.goto(args.base + 'station-shadow.html')
    page.clock.install(time=1590000000000)
    page.clock.pause_at(1590000001000)
    page.locator('[data-game=record]').press('Enter')
    page.clock.run_for(1280)
    for _ in range(10):
        page.locator('[data-night-language]').press('Enter')
    hidden(page, True)
    page.clock.fast_forward(12000)
    expect(page.locator('[data-game=station-view]')).to_have_attribute('data-phase','record')
    hidden(page, False)
    assert 1_200 <= float(page.locator('progress').get_attribute('value')) < 1_500
    page.clock.run_for(9000)
    expect(page.locator('[data-game=station-view]')).to_have_attribute('data-phase','ready')
    page.goto(args.base + 'ink-cut.html')
    for shot in ['pier','signal','deck']:
        page.locator(f'[data-cut-action=add-{shot}]').press('Enter')
    page.locator('[data-cut-action=play]').press('Enter')
    page.clock.run_for(1250)
    for _ in range(10):
        page.locator('[data-night-language]').press('Enter')
    hidden(page, True)
    page.clock.fast_forward(10000)
    expect(page.locator('[data-cut-action=resume]')).to_be_visible()
    assert 1200 <= float(page.locator('progress').get_attribute('value')) < 1500
    hidden(page, False)
    page.locator('[data-cut-action=resume]').press('Enter')
    page.clock.run_for(5000)
    expect(page.locator('.ink-result[data-passed=true]')).to_be_visible()
    print('Station and Ink Cut: ten language switches each, hidden suspension, single uninterrupted completion.')
    browser.close()
