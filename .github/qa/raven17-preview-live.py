"""Mobile browser acceptance on the public, deployed Pages origin."""
import hashlib
import os
import shutil
import time
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import Error, expect, sync_playwright

ORIGIN = "https://iid7oom21.github.io"
HOME = ORIGIN + "/abdulrhman/raven/"
PREVIEW = HOME + "raven-17-preview/"
OUT = Path("evidence")
rows = []
errors = []


def verify_served_revision(api):
    selected = {f.name: f.read_bytes() for f in Path("reference").iterdir()}
    assert set(selected) == {"index.html", "home.css", "home.js"}
    deadline = time.monotonic() + 210
    while True:
        try:
            for name, body in selected.items():
                response = api.get(PREVIEW + name + f"?verify={int(time.time())}", timeout=6500)
                try:
                    assert response.ok, f"Pages {name} HTTP {response.status}"
                    assert response.body() == body, f"Waiting for exact Pages {name}"
                finally:
                    response.dispose()
            rows.append("Served the expected HTML, stylesheet and script. HTML SHA-256 `"
                        + hashlib.sha256(selected["index.html"]).hexdigest() + "`.")
            return
        except (Error, AssertionError) as exc:
            if time.monotonic() >= deadline:
                raise
            print(str(exc), flush=True)
            time.sleep(5)


def play_real_media(video, label):
    # play() is invoked with Playwright's user gesture. No request interception or fixtures.
    report = video.evaluate("""async v => {
      let alarm, failure = '';
      v.muted = true;
      try {
        await Promise.race([v.play(), new Promise((_, reject) => {
          alarm = setTimeout(() => reject(new Error('play timeout')), 22000);
        })]);
      } catch (e) { failure = e.name + ' ' + e.message; }
      finally { clearTimeout(alarm); }
      const start = v.currentTime;
      if (!failure) await new Promise(resolve => setTimeout(resolve, 1100));
      const answer = {source:v.currentSrc || v.src, duration:v.duration || 0,
                      elapsed:v.currentTime - start, mediaError:v.error?.code || 0, failure};
      v.pause();
      return answer;
    }""")
    assert report["duration"] > 0, f"{label} metadata unavailable ({report['mediaError']}, {report['failure']})"
    rows.append(f"{label} metadata loaded, duration {report['duration']:.2f}s.")
    assert not report["failure"] and report["elapsed"] > 0.2, f"{label} playback did not advance ({report})"
    rows.append(f"{label} advanced {report['elapsed']:.2f}s on the real media URL.")
    return report["source"]


def check_episode(page, number, language):
    selected = page.locator(".episode-card").nth(number - 1)
    selected.click()
    frame = page.frame_locator("#site-content")
    expect(frame.locator("#episodeModal")).to_have_attribute("aria-hidden", "false", timeout=25000)
    expect(frame.locator(f"[data-rvn-episode='{number}']")).to_have_attribute("aria-pressed", "true")
    asset = frame.locator("#ravenEpisodePlayer")
    expect(asset).to_be_visible()
    target = urlsplit(page.url)
    query = parse_qs(target.query)
    assert target.scheme + "://" + target.netloc + target.path == HOME
    assert query.get("episode") == [str(number)] and query.get("lang") == [language]
    label = f"Episode {number} ({language})"
    rows.append(f"{label} opened the canonical player with its tab selected.")
    try:
        actual = urlsplit(play_real_media(asset, label))
        assert actual.hostname == "res.cloudinary.com" and actual.path.endswith(f"/raven17/episode-{number}.mp4")
    finally:
        page.go_back(wait_until="domcontentloaded")
        expect(page.locator(".episode-list")).to_be_visible(timeout=9000)
        assert page.url.startswith(PREVIEW)


def check_backstage(page):
    page.locator("#backstage-open").click()
    expect(page.locator("#clip-dialog")).to_be_visible()
    assert urlsplit(play_real_media(page.locator("#clip"), "Paper and phone")).path.endswith(
        "/raven/assets/atmosphere-v1/paper-detail.mp4")
    page.locator("#clip-close").click()
    expect(page.locator("#clip-dialog")).to_be_hidden()
    expect(page.locator("#backstage-open")).to_be_focused()


def run():
    OUT.mkdir(exist_ok=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=shutil.which("google-chrome") or shutil.which("chromium"))
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True,
                                  is_mobile=True, locale="ar", reduced_motion="reduce")
        verify_served_revision(ctx.request)
        for number, language in ((1, "ar"), (2, "en"), (3, "ar")):
            page = ctx.new_page()
            page.set_default_timeout(12000)
            try:
                page.goto(PREVIEW, wait_until="domcontentloaded")
                if language == "en":
                    page.locator("[data-language]").click()
                expect(page.locator("html")).to_have_attribute("lang", language)
                expect(page.locator("html")).to_have_attribute("dir", "rtl" if language == "ar" else "ltr")
                if number == 1:
                    expect(page.locator(".cover img")).to_be_visible()
                    page.wait_for_function("document.querySelector('.cover img').naturalWidth > 0")
                    page.screenshot(path=str(OUT / "mobile-ar.png"))
                check_episode(page, number, language)
            except Exception as exc:
                errors.append(f"Episode {number} ({language}) — {exc}")
            finally:
                page.close()
        page = ctx.new_page()
        try:
            page.goto(PREVIEW, wait_until="domcontentloaded")
            check_backstage(page)
        except Exception as exc:
            errors.append("Backstage — " + str(exc))
        browser.close()


if __name__ == "__main__":
    try:
        run()
    except Exception as exc:
        errors.append("Setup — " + str(exc))
    summary = ["## Published mobile preview", "", f"[Open the preview]({PREVIEW})", ""]
    summary += ["- " + item for item in rows]
    if errors:
        summary += ["", "### Unverified or failed", ""] + ["- " + text for text in errors]
    report = "\n".join(summary) + "\n"
    print(report)
    OUT.mkdir(exist_ok=True)
    (OUT / "result.md").write_text(report)
    if os.getenv("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as file:
            file.write(report)
    raise SystemExit(1 if errors else 0)
