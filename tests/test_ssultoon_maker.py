import json
from pathlib import Path
import subprocess
import sys
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/util/ssultoon-maker/index.html"
EPISODES = ROOT / "data/ssultoon-episodes-ko.json"
SCRIPT = ROOT / "scripts/build_ssultoon_episode.py"
CANONICAL = "https://emfls.github.io/kor/util/ssultoon-maker/"


def test_ssultoon_maker_page_seo_adsense_and_structure():
    html = PAGE.read_text(encoding="utf-8")
    assert html.count("<h1") == 1
    assert f'<link rel="canonical" href="{CANONICAL}"' in html
    assert "ca-pub-8830524482034754" in html
    assert "G-QP5Q67GE5B" in html
    assert 'aria-label="Advertisement"' in html
    assert '<div class="ad-label">Advertisement</div>' in html
    assert "ad_click" not in html.lower()
    assert "광고를 클릭" not in html
    assert '"@type": "WebApplication"' in html
    assert '"@type": "FAQPage"' in html
    assert '"@type": "BreadcrumbList"' in html
    assert "ssultoonCanvas" in html
    assert "storyIdeaInput" not in html
    assert "autoBuildBtn" not in html
    assert "toon.guidehollow.com" in html
    assert "/kor/util/retirement-pension-withdrawal/" in html
    assert "/kor/util/car-inspection-cost/" in html


def test_ssultoon_episodes_data_and_validator():
    data = json.loads(EPISODES.read_text(encoding="utf-8"))
    assert data["episodeCount"] == len(data["episodes"]) == 6
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), "--validate", "--output", str(EPISODES)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    assert "VALIDATED 6 episodes cleanly" in proc.stdout


def test_ssultoon_discovery_wiring():
    sitemap = ET.parse(ROOT / "kor/sitemap.xml")
    locs = {node.text for node in sitemap.iter() if node.tag.endswith("loc")}
    assert CANONICAL in locs

    util_hub = (ROOT / "kor/util/index.html").read_text(encoding="utf-8")
    assert "/kor/util/ssultoon-maker/" in util_hub

    home = (ROOT / "index.html").read_text(encoding="utf-8")
    assert "/kor/util/ssultoon-maker/" in home

    content_index = json.loads((ROOT / "data/content-index-ko.json").read_text(encoding="utf-8"))
    assert any(row.get("url") == "/kor/util/ssultoon-maker/index.html" for row in content_index)
