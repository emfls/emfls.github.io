import json
import re
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RELATIVE_URL = "/kor/report/it/keyboard-cleaning-guide.html"
CANONICAL = "https://emfls.github.io" + RELATIVE_URL
PAGE = ROOT / "kor/report/it/keyboard-cleaning-guide.html"


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = []
        self.h1 = []
        self.meta = {}
        self.canonicals = []
        self.links = []
        self._capture = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in {"title", "h1"}:
            self._capture = tag
        elif tag == "meta" and attrs.get("name"):
            self.meta[attrs["name"]] = attrs.get("content", "")
        elif tag == "link" and attrs.get("rel") == "canonical":
            self.canonicals.append(attrs.get("href", ""))
        elif tag == "a":
            self.links.append(attrs.get("href", ""))

    def handle_endtag(self, tag):
        if tag in {"title", "h1"}:
            self._capture = None

    def handle_data(self, data):
        if self._capture == "title":
            self.title.append(data)
        elif self._capture == "h1":
            self.h1.append(data)


def _current_manifest():
    return json.loads((ROOT / "data/content-launch-manifest.json").read_text(encoding="utf-8"))


def test_keyboard_cleaning_page_is_indexable_source_backed_and_safe():
    assert PAGE.is_file(), "launch candidate page is missing"
    html = PAGE.read_text(encoding="utf-8")
    parser = PageParser()
    parser.feed(html)

    assert "키보드 청소 방법" in "".join(parser.title)
    assert "키보드 청소 방법" in "".join(parser.h1)
    assert parser.canonicals == [CANONICAL]
    assert parser.meta.get("robots") == "index,follow"
    assert "G-QP5Q67GE5B" in html
    assert "ca-pub-8830524482034754" in html
    assert '"@type":"Article"' in html
    assert "자료 확인일: 2026년 10월 4일" in html
    assert '"datePublished":"2026-10-05"' in html
    assert '"dateModified":"2026-10-05"' in html

    for source in (
        "https://support.apple.com/ko-kr/102365",
        "https://support.microsoft.com/ko-kr/surface/accessories/mouse-keyboard/how-do-i-clean-my-microsoft-mouse-or-keyboard",
        "https://rog.asus.com/kr/support/faq/1003050/",
        "https://help.corsair.com/hc/ko/articles/360059094911",
    ):
        assert source in html

    for safety_point in (
        "전원을 끄고",
        "케이블을 분리",
        "직접 분사",
        "액체를 쏟았다면",
        "제조사 안내",
        "서비스 점검",
    ):
        assert safety_point in html
    assert not re.search(r"(?:모든|어떤)\s*(?:키보드|기기).{0,20}(?:같은|동일한)\s*방법", html)
    assert not any(claim in html for claim in ("무조건 복구", "완벽 복구", "침수에도 안전", "100% 해결"))
    assert "PREP ONLY" not in html
    assert "noindex" not in html.lower()

    assert "키보드 구매" in html or "게이밍 키보드 추천" in html
    assert any("gaming-keyboard.html" in href for href in parser.links)
    for href in parser.links:
        if href.startswith("/"):
            target = ROOT / href.lstrip("/")
            if href.endswith("/"):
                target = target / "index.html"
        elif href and not href.startswith(("https://", "http://", "#")):
            target = PAGE.parent / href.split("#", 1)[0]
        else:
            continue
        assert target.is_file(), f"broken internal link: {href}"


def test_keyboard_cleaning_page_has_publication_discovery_and_registry_wiring():
    assert PAGE.is_file(), "launch candidate page is missing"
    hub = (ROOT / "kor/report/it/index.html").read_text(encoding="utf-8")
    it_sitemap = (ROOT / "kor/report/it/sitemap.xml").read_text(encoding="utf-8")
    kor_sitemap = (ROOT / "kor/sitemap.xml").read_text(encoding="utf-8")
    assert hub.count(f'href="{RELATIVE_URL}"') == 1
    assert it_sitemap.count(CANONICAL) == 1
    assert kor_sitemap.count(CANONICAL) == 0

    content_index = json.loads((ROOT / "data/content-index-ko.json").read_text(encoding="utf-8"))
    assert sum(row["url"] == RELATIVE_URL for row in content_index) == 1
    feed = json.loads((ROOT / "data/home-feed-ko.json").read_text(encoding="utf-8"))
    assert feed["latest"][0]["url"] == RELATIVE_URL


def test_keyboard_cleaning_manifest_records_only_this_launch_and_one_daily_slot():
    manifest = _current_manifest()
    if manifest.get("urls") != [RELATIVE_URL]:
        return

    assert manifest["candidateIds"] == ["keyword:키보드청소방법"]
    assert manifest["contentPaths"] == ["kor/report/it/keyboard-cleaning-guide.html"]
    assert manifest["hubPaths"] == ["kor/report/it/index.html"]
    assert manifest["sitemapPaths"] == ["kor/report/it/sitemap.xml"]
    assert manifest["status"] == "PUBLISHED"
    assert manifest["publishedToday"] == 1
    assert manifest["dailyLimit"] == 1
    assert manifest["remainingCapacity"] == 0
    assert manifest["runAt"].startswith("2026-10-05T")
    assert manifest["runId"] == "P0-20261005-KEYBOARD-CLEANING"
