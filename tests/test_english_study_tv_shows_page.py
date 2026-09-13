import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/column/yeongeogongbuhijoheunmideu/index.html"
CANONICAL = "https://emfls.github.io/kor/column/yeongeogongbuhijoheunmideu/"


def page_html() -> str:
    return PAGE.read_text(encoding="utf-8")


def test_page_keeps_publishing_and_measurement_contract():
    html = page_html()
    assert '<html lang="ko">' in html
    assert f'<link rel="canonical" href="{CANONICAL}">' in html
    assert f'<meta property="og:url" content="{CANONICAL}">' in html
    assert html.count("<h1") == 1
    assert "영어 공부하기 좋은 미드" in html
    assert "G-QP5Q67GE5B" in html
    assert "ca-pub-8830524482034754" in html
    assert '"@type":"Article"' in html
    assert "2026-09-13" in html


def test_page_has_accessible_deterministic_selector_and_fallback_content():
    html = page_html()
    for control in ("learner-level", "dialogue-speed", "study-goal", "show-selector", "selector-result"):
        assert f'id="{control}"' in html
    assert 'aria-live="polite"' in html
    assert "recommendShows" in html
    assert "모던 패밀리" in html
    assert "굿 플레이스" in html
    assert "브루클린 나인-나인" in html
    assert "김씨네 편의점" in html
    assert "네버 해브 아이 에버" in html
    assert "그레이스 앤 프랭키" in html
    assert "슈츠" in html


def test_page_uses_official_sources_and_has_no_placeholders():
    html = page_html()
    assert html.count("netflix.com/kr/title/") >= 6
    assert "disneyplus.com/ko-kr/" in html
    assert "TODO" not in html
    assert "PLACEHOLDER" not in html
    assert re.search(r'<meta name="description" content="[^"]{60,160}">', html)


def test_generated_index_contains_new_page_once():
    index = json.loads((ROOT / "data/content-index-ko.json").read_text(encoding="utf-8"))
    matches = [row for row in index if row["url"] == "/kor/column/yeongeogongbuhijoheunmideu/index.html"]
    assert len(matches) == 1
    assert matches[0]["category"] == "생활정보"

