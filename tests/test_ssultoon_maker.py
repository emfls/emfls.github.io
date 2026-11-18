"""Regression tests for /kor/util/ssultoon-maker/ 18-cut Naver Webtoon portal & dataset."""
from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/util/ssultoon-maker/index.html"
EPISODES = ROOT / "data/ssultoon-episodes-ko.json"
SCRIPT = ROOT / "scripts/build_ssultoon_episode.py"
CANONICAL = "https://emfls.github.io/kor/util/ssultoon-maker/"


def test_ssultoon_maker_page_seo_adsense_and_structure():
    html = PAGE.read_text(encoding="utf-8")
    assert f'<link rel="canonical" href="{CANONICAL}"' in html
    assert "ca-pub-8830524482034754" in html
    assert "G-QP5Q67GE5B" in html
    assert "첫 화 보기" in html
    assert "댓글 (" in html
    assert "ssultoonCanvas" in html
    assert "webtoonCanvasList" in html
    assert "act-gutter" not in html
    assert "toon.guidehollow.com/assets/toons" in html
    assert "본 웹툰 이미지는 AI 도구를 활용해 제작되었습니다" in html
    assert "drawChar" not in html
    for bad in ("장면 커스텀", "대사 입력", "미리보기", "생성하기"):
        assert bad not in html
    assert len(html.encode("utf-8")) > 6000


def test_ssultoon_episodes_data_and_validator():
    sys.path.insert(0, str(SCRIPT.parent))
    import build_ssultoon_episode as bse

    payload = json.loads(EPISODES.read_text(encoding="utf-8"))
    assert payload.get("schemaVersion") == 2
    assert len(payload.get("episodes", [])) == 6
    for ep in payload["episodes"]:
        assert len(ep["panels"]) == 18
        assert len(ep.get("bestComments", [])) == 3
    errors = bse.validate_payload(payload)
    assert errors == []


import xml.etree.ElementTree as ET


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
