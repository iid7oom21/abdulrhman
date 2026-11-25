"""Measure cold first-use on the served Pages path using Chromium network emulation."""
import argparse
import json
import shutil
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--home', required=True)
parser.add_argument('--output', required=True, type=Path)
args = parser.parse_args()
routes = (
    ('home', 'content.html', '#after-show-title a'),
    ('courier', 'late-night/ink-courier.html', '[data-cell="15"]'),
    ('paper', 'late-night/nightshift-paper.html', '[data-paper]'),
    ('post', 'late-night/nightshift-post.html', '[data-post]'),
    ('window', 'late-night/nightshift-window.html', '#window-play'),
    ('seat', 'late-night/nightshift-seat.html', '[data-inspect]'),
    ('mirrors', 'late-night/nightshift-mirrors.html', '[data-fire]'),
)
rows = []
with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=shutil.which('chromium') or shutil.which('google-chrome'))
    for activity, path, control in routes:
        ctx = browser.new_context(viewport={'width':390, 'height':844}, has_touch=True, reduced_motion='reduce')
        pg = ctx.new_page()
        pg.route('**/*', lambda r: r.continue_() if urlsplit(r.request.url).netloc == urlsplit(args.home).netloc else r.abort())
        cdp = ctx.new_cdp_session(pg)
        cdp.send('Network.enable')
        cdp.send('Network.setCacheDisabled', {'cacheDisabled':True})
        cdp.send('Network.emulateNetworkConditions', {'offline':False, 'latency':100,'downloadThroughput':200000,'uploadThroughput':93750})
        pg.goto(args.home.rstrip('/') + '/' + path + '?lang=ar', wait_until='commit')
        pg.locator(control).first.wait_for(state='visible')
        ready = pg.evaluate('Math.round(performance.now())')
        rows.append({'activity':activity, 'visibleControlMsSinceNavigation':ready})
        pg.wait_for_load_state('networkidle')
        records = pg.evaluate("""() => performance.getEntriesByType('resource').map(e => ({
          path:new URL(e.name).pathname, bytes:e.transferSize
        }))""")
        page_bytes = pg.evaluate("performance.getEntriesByType('navigation')[0].transferSize")
        rows[-1].update(resourceRequests=len(records), transferredBytes=page_bytes+sum(r['bytes'] for r in records),
                        nightWorkshopModules=[r['path'] for r in records if '/nightshift/' in r['path'] and r['path'].endswith('.js')])
        if activity == 'home' and rows[-1]['nightWorkshopModules']:
            raise ValueError('Home eagerly loads a night workshop engine')
        ctx.close()
    result={'browser':browser.version,'viewport':'390 × 844 AR, muted, reduced motion',
            'network':'100 ms latency, 1.6 Mbit/s down, 0.75 Mbit/s up, cold context per run; same-origin only',
            'measurement':'One local run per route. Actions measured when their control is visible. Byte totals include main HTML and resource timing entries.',
            'pages': rows}
    args.output.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps(rows,ensure_ascii=False))
    browser.close()
