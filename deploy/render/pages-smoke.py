"""Play Last Transmission and the title workshop at the public Pages URL. Local check: --local http://127.0.0.1:PORT/abdulrhman/raven/."""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import Error, expect, sync_playwright

PUBLIC_HOME = "https://iid7oom21.github.io/abdulrhman/raven/"
ROOT = Path(__file__).resolve().parents[2]


def setting(source, key, pattern):
    match = re.search(rf"export const {key} = '({pattern})';", source)
    if not match:
        raise ValueError(f"Missing {key} in deploy/render/build.mjs")
    return match.group(1)


def check_deployment(request, home, sha, release, local):
    assets = ["after-show/edit.js", "after-show/screencraft.js", "after-show/screencraft-glass.js",
              "assets/raven-visual-home.css", "late-night/night-shell.js", "late-night/hub.css",
              "late-night/games/games.css", "late-night/games/station.js", "late-night/creative/scene.js"]
    pinned = {
        asset: subprocess.check_output(["git", "show", f"{sha}:raven/{asset}"], cwd=ROOT)
        for asset in assets
    }
    deadline = time.monotonic() + (15 if local else 240)
    while True:
        try:
            tag = f"?verify={sha}&attempt={int(time.time())}"
            index = request.get(home + "release.json" + tag, timeout=8000)
            reason = f"release differs from {release} (HTTP {index.status})"
            if index.ok and index.json().get("release") == release:
                for asset, expected in pinned.items():
                    response = request.get(home + asset + tag, timeout=8000)
                    if not response.ok or response.body() != expected:
                        reason = f"{asset} differs from {sha} (HTTP {response.status})"
                        break
                else:
                    return {key: hashlib.sha256(data).hexdigest() for key, data in pinned.items()}
        except (Error, ValueError) as exc:
            reason = str(exc)
        if time.monotonic() >= deadline:
            raise RuntimeError(f"{home} did not serve the pinned version: {reason}")
        time.sleep(3 if local else 8)


def play_title_workshop(page, frame, output, home):
    frame.locator("#as-all").click()
    frame.locator("[data-room=screencraft]").click()
    frame.locator("#as-room-activities [data-as-route=titles]").click()
    arabic_url = home + "after-show/?activity=titles&lang=ar"
    english_url = home + "after-show/?activity=titles&lang=en"
    expect(page).to_have_url(arabic_url)
    expect(frame.locator("html")).to_have_attribute("dir", "rtl")
    plane = frame.locator("[data-sc=plane]")
    first = frame.locator("[data-sc=first]")
    second = frame.locator("[data-sc=second]")
    screen = frame.locator("[data-sc=frame]")
    report = frame.locator("[data-sc=report]")
    first.fill("ليل")
    second.fill("القاهرة")
    # Click halfway across the six-second shot to compare the two layer orders at the same instant.
    scrub = frame.locator("[data-sc=scrub]")
    track = scrub.bounding_box()
    scrub.click(position={"x": track["width"] / 2, "y": track["height"] / 2})
    playhead = float(scrub.input_value())
    assert 2.8 <= playhead <= 3.2, f"Playhead landed at {playhead}s"
    plane.select_option("back")
    behind = report.inner_text()
    background_frame = screen.evaluate("el => el.toDataURL()")
    plane.select_option("front")
    expect(report).not_to_have_text(behind)
    foreground_frame = screen.evaluate("el => el.toDataURL()")
    assert background_frame != foreground_frame, "Layer order did not change the visible composited frame"
    screen.scroll_into_view_if_needed()
    screenshot = page.screenshot(path=str(output / "title-workshop-ar-390.png"))
    arabic_report = report.inner_text()
    frame.locator("#as-language").click()
    expect(page).to_have_url(english_url)
    expect(frame.locator("html")).to_have_attribute("dir", "ltr")
    expect(plane).to_have_value("front")
    expect(report).to_contain_text("Completely visible")
    english_report = report.inner_text()
    page.reload(wait_until="domcontentloaded")
    expect(page).to_have_url(english_url)
    expect(first).to_have_value("ليل")
    expect(second).to_have_value("القاهرة")
    expect(plane).to_have_value("front")
    expect(report).to_have_text(english_report)
    expect(frame.locator("html")).to_have_attribute("lang", "en")
    frame.locator("#as-all").click()
    expect(frame.locator("[data-room=screencraft]")).to_have_attribute("aria-pressed", "true")
    return {"id": "titles", "arabic_url": arabic_url, "english_url": english_url,
            "playhead_seconds": playhead, "behind_report": behind, "front_report": arabic_report,
            "english_report_after_reload": english_report, "plane_after_reload": "front",
            "screenshot_sha256": hashlib.sha256(screenshot).hexdigest()}


def write_summary(evidence, path):
    # The file may also contain translated page text. Only publish the verified URL and measurements.
    live_url = PUBLIC_HOME + "after-show/?activity=edit&lang=ar"
    if evidence["played_url"] != live_url:
        raise ValueError("The browser did not finish at the published round URL")
    workshop = evidence["workshop"]
    workshop_url = PUBLIC_HOME + "after-show/?activity=titles&lang=ar"
    if workshop["arabic_url"] != workshop_url:
        raise ValueError("The workshop was not played at the published URL")
    with Path(path).open("a", encoding="utf-8") as stream:
        print("### Published montage verified", file=stream)
        print(f"\n[Played the Arabic mobile round]({live_url})", file=stream)
        print(f"\n- Pages commit `{evidence['pages_commit']}`", file=stream)
        print(f"- Playback wall time {evidence['wall_seconds']:.2f} seconds", file=stream)
        print(f"- Result screenshot SHA-256 `{evidence['result_image_sha256']}`", file=stream)
        print(f"\n### [Published title workshop]({workshop_url})", file=stream)
        print(f"\n- Moved both title words in front at {workshop['playhead_seconds']:.2f} seconds. "
              "Confirmed a different rendered frame and a different readability report.", file=stream)
        print("- Switched to English and reloaded. Both Arabic words and the layer order were restored.", file=stream)
        print(f"- Workshop screenshot SHA-256 `{workshop['screenshot_sha256']}`", file=stream)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--local", help="run on a local project mount in a developer checkout")
    args = parser.parse_args()
    if args.local:
        target = urlsplit(args.local)
        if (os.environ.get("GITHUB_ACTIONS") == "true" or target.scheme != "http" or
            target.hostname not in {"127.0.0.1", "localhost", "::1"} or
            target.path != "/abdulrhman/raven/" or target.query or target.fragment or target.username or target.password):
            parser.error("--local is only for the loopback project mount outside GitHub Actions")
    home = args.local or PUBLIC_HOME
    source = (ROOT / "deploy/render/build.mjs").read_text()
    sha = setting(source, "SITE_COMMIT", "[a-f0-9]{40}")
    release = setting(source, "PUBLIC_RELEASE", "[a-zA-Z0-9.-]+")
    output = Path(os.environ.get("RUNNER_TEMP", tempfile.gettempdir())) / "after-show-pages"
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=shutil.which("google-chrome") or shutil.which("chromium"))
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, reduced_motion="reduce", locale="ar")
        module_hashes = check_deployment(ctx.request, home, sha, release, bool(args.local))
        page = ctx.new_page()
        page.goto(home + "?lang=ar", wait_until="domcontentloaded")
        frame = page.frame_locator("#site-content")
        skip = page.locator("#archive-skip")
        if skip.is_visible():
            skip.click()
        launch = frame.locator("[data-after-show-play]")
        expect(launch).to_be_visible()
        launch.click()
        expect(frame.locator("html")).to_have_attribute("lang", "ar")
        order = ["exterior", "hand", "envelope"]
        for index, shot in enumerate(order):
            frame.locator(f'[data-shot="{shot}"]').click()
            frame.locator(f'[data-slot="{index}"]').click()
        result = frame.locator("[data-edit-result]")
        expect(result).to_have_count(0)
        start = time.monotonic()
        frame.locator('[data-edit-action="play"]').click()
        expect(frame.locator('[data-edit-action="pause"]')).to_be_visible()
        for shot in order:
            still = frame.locator(f'[data-current-shot="{shot}"] > img')
            expect(still).to_be_visible(timeout=8000)
            still.evaluate("img => img.decode()")
            if shot == "hand":
                page.screenshot(path=str(output / "playing-ar-390.png"))
        expect(result).to_have_attribute("data-order", "true", timeout=6000)
        expect(result).to_have_attribute("data-time", "true")
        elapsed = time.monotonic() - start
        assert elapsed >= 11.5, f"12-second timeline finished in {elapsed:.2f}s"
        result.scroll_into_view_if_needed()
        screenshot = page.screenshot(path=str(output / "result-ar-390.png"))
        evidence = {
            "home": home, "played_url": page.url, "release": release, "pages_commit": sha,
            "editor_sha256": module_hashes["after-show/edit.js"], "verified_modules": module_hashes,
            "shots": order, "cut_seconds": 12, "wall_seconds": round(elapsed, 2), "result": result.inner_text(),
            "result_image_sha256": hashlib.sha256(screenshot).hexdigest(),
            "github_run": os.environ.get("GITHUB_RUN_ID"), "chrome": browser.version,
        }
        evidence["workshop"] = play_title_workshop(page, frame, output, home)
        (output / "result.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n")
        if not args.local and os.environ.get("GITHUB_STEP_SUMMARY"):
            write_summary(evidence, os.environ["GITHUB_STEP_SUMMARY"])
        print(json.dumps(evidence, ensure_ascii=False))
        browser.close()


if __name__ == "__main__":
    main()
