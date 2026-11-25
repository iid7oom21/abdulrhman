"""Open the published episode gallery from both arrival and home, then exercise the approved player."""
import argparse
import json
import os
import shutil
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import expect, sync_playwright

PUBLIC_HOME = 'https://iid7oom21.github.io/abdulrhman/raven/'
VIDEOS = {
    1: 'https://res.cloudinary.com/du88n6b83/video/upload/v1789985712/raven17/episode-1.mp4',
    2: 'https://res.cloudinary.com/du88n6b83/video/upload/v1789985735/raven17/episode-2.mp4',
    3: 'https://res.cloudinary.com/du88n6b83/video/upload/v1789986504/raven17/episode-3.mp4',
}
parser = argparse.ArgumentParser()
parser.add_argument('--home', default=PUBLIC_HOME)
parser.add_argument('--output', type=Path, default=Path(os.getenv('RUNNER_TEMP', '/tmp')) / 'screening-room')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
if os.environ.get('GITHUB_ACTIONS') == 'true' and args.home != PUBLIC_HOME:
    parser.error('CI must open the published Pages URL')


def gallery_route(page, episode=None):
    u = urlsplit(page.url)
    assert u.path == urlsplit(args.home).path + 'episodes/', page.url
    if episode is not None:
        assert parse_qs(u.query).get('episode') == [str(episode)], page.url
    frame = page.frame_locator('#site-content')
    expect(frame.locator('[data-screening-gallery] #films .rvnVisualEpisode')).to_have_count(3)
    return frame


def check_playback(page, video, frame, source):
    # Play the original network URL. A CDN error is recorded independently of opening the gallery.
    video.evaluate("v=>{v.muted=true; v.play().catch(()=>{});}")
    result = video.evaluate("""async v=>{
      const until=performance.now()+20000;
      while(performance.now()<until){
        if(v.currentTime>=0.5&&v.videoWidth>0)break;
        if(v.error)break;
        await new Promise(r=>setTimeout(r,125));
      }
      const result={source:v.currentSrc||v.src,seconds:v.currentTime,width:v.videoWidth,
        height:v.videoHeight,error:v.error?.code??null};
      v.pause();
      return result;
    }""")
    assert result['source'] == source, result
    if result['seconds'] >= .5 and result['width'] > 0:
        result['outcome'] = 'played'
    else:
        assert result['error'] is not None, f"The approved episode neither played nor exposed a media error: {result}"
        retry=frame.locator('#rvnRetryVideo')
        expect(retry).to_be_visible()
        with page.expect_request(lambda r: r.url == source):
            retry.tap()
        expect(video).to_have_attribute('src', source)
        result['outcome'] = 'source unavailable on first attempt; retried the same episode'
    return result


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'))
    # Fresh Arabic arrival uses the primary episodes action before the introduction has finished.
    ctx = browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,locale='ar')
    page = ctx.new_page()
    page.goto(args.home + '?lang=ar', wait_until='domcontentloaded')
    arrival = page.locator('#archive-episodes')
    expect(arrival).to_be_in_viewport()
    expect(arrival).to_have_text('حلقات RAVEN 17')
    page.screenshot(path=args.output/'arrival-ar-390.png')
    arrival.tap()
    expect(page.frame_locator('#site-content').locator('[data-screening-gallery]')).to_be_visible()
    frame = gallery_route(page)
    for n in (1,2,3):
        img = frame.locator(f'[data-visual-episode="{n}"] img')
        img.scroll_into_view_if_needed()
        img.evaluate("i=>i.decode()")
    frame.locator('[data-gallery-play="1"]').scroll_into_view_if_needed()
    page.screenshot(path=args.output/'gallery-ar-390.png')
    frame.locator('[data-gallery-play="1"]').tap()
    video = frame.locator('#ravenEpisodePlayer')
    expect(video).to_be_visible()
    expect(video).to_have_attribute('src', VIDEOS[1])
    gallery_route(page,1)
    playback = {1: check_playback(page,video,frame,VIDEOS[1])}
    page.screenshot(path=args.output/'episode-one-ar-390.png')
    page.reload(wait_until='domcontentloaded')
    frame=gallery_route(page,1)
    expect(frame.locator('#ravenEpisodePlayer')).to_be_visible()
    expect(frame.locator('#ravenEpisodePlayer')).to_have_attribute('src', VIDEOS[1])
    for number in (2,3):
        frame.locator('#rvnNextEpisode').tap()
        video=frame.locator('#ravenEpisodePlayer')
        expect(video).to_have_attribute('src',VIDEOS[number])
        gallery_route(page,number)
        playback[number]=check_playback(page,video,frame,VIDEOS[number])
    if os.environ.get('GITHUB_ACTIONS'):
        statuses = [f"Episode {n}: {r['outcome']} ({r['seconds']:.2f} s)" for n, r in playback.items()]
        print("::notice title=Original episode playback::" + " / ".join(statuses), flush=True)
    ctx.close()

    # A first-time visitor can also skip the arrival, read the new home, and reach the same gallery.
    ctx=browser.new_context(viewport={'width':320,'height':740},has_touch=True,is_mobile=True,
                            reduced_motion='reduce',locale='en')
    page=ctx.new_page()
    page.goto(args.home+'?lang=en',wait_until='domcontentloaded')
    page.locator('#archive-entry-gate').press('Escape')
    frame=page.frame_locator('#site-content')
    home_entry=frame.locator('a.rvnHeroWatch')
    expect(home_entry).to_be_visible()
    expect(frame.locator('.rvnVisualEpisode, [data-visual-episode], #episodeModal')).to_have_count(0)
    frame.locator('.filmPoster img').evaluate('image => image.decode()')
    for title in ('after-show-title','late-night-title','ink-title'):
        expect(frame.locator('#'+title+' a')).to_be_in_viewport(ratio=1)
    for destination in ('[data-home-studio]', '[data-home-backstage]'):
        expect(frame.locator(destination)).to_be_visible()
    home_entry.scroll_into_view_if_needed()
    page.screenshot(path=args.output/'home-en-320.png')
    home_entry.tap()
    expect(page.frame_locator('#site-content').locator('[data-screening-gallery]')).to_be_visible()
    frame=gallery_route(page)
    expect(frame.locator('html')).to_have_attribute('lang','en')
    proof={'home':args.home,'gallery':page.url,'episode_cards':3,'home_episode_cards':0,
           'arrival_and_home_entry_verified':True,'episode_playback':playback}
    page.goto(args.home+'?episode=1&lang=en',wait_until='domcontentloaded')
    expect(page.frame_locator('#site-content').locator('#ravenEpisodePlayer')).to_be_visible()
    gallery_route(page,1)
    proof['legacy_episode_link']=page.url
    (args.output/'journey.json').write_text(json.dumps(proof,indent=2))
    print(json.dumps(proof))
    if 'GITHUB_STEP_SUMMARY' in os.environ:
        with open(os.environ['GITHUB_STEP_SUMMARY'],'a',encoding='utf-8') as summary:
            summary.write("\nOpened the three-episode gallery from arrival and the home feature.\n\n")
            for number, result in playback.items():
                summary.write(f"- Original episode {number}: {result['outcome']} ({result['seconds']:.2f} s decoded).\n")
            summary.write("\nMobile screenshots and journey.json are attached.\n")
    ctx.close()
    browser.close()
