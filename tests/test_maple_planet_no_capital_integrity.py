from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
import json
import re


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/column/maple-planet-no-capital-rice-farming-2026.html"
URL = "https://emfls.github.io/kor/column/maple-planet-no-capital-rice-farming-2026.html"
POLICY_URL = "https://mapleplanet.co.kr/policy/mapleplanet"
WORLD_URL = "https://maplestoryworlds.nexon.com/ko/play/64b9fefe2f664c189a4c1be40b6e8062/"
PATCH_URL = "https://mapleplanet.co.kr/news/updates/738"
GUIDE_URL = "https://mapleplanet.co.kr/guide/play"


class ArticleParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title_parts = []
        self.in_title = False
        self.in_json_ld = False
        self.json_ld_parts = []
        self.json_ld = []
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "title":
            self.in_title = True
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self.in_json_ld = True
            self.json_ld_parts = []

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag == "script" and self.in_json_ld:
            self.json_ld.append(json.loads("".join(self.json_ld_parts)))
            self.in_json_ld = False

    def handle_data(self, data):
        if self.in_title:
            self.title_parts.append(data)
        if self.in_json_ld:
            self.json_ld_parts.append(data)


def _parsed_page():
    html = PAGE.read_text(encoding="utf-8")
    parser = ArticleParser()
    parser.feed(html)
    return html, parser


def test_maple_planet_no_capital_page_corrects_policy_and_preserves_seo_identity():
    html, parser = _parsed_page()
    meta = {}
    for match in re.finditer(r"<meta\s+([^>]+)>", html, re.I):
        attrs = dict(re.findall(r"([\w:-]+)=[\"']([^\"']*)[\"']", match.group(1)))
        key = attrs.get("name") or attrs.get("property")
        if key:
            meta[key] = attrs.get("content", "")

    assert parser.title_parts == ["메이플 플래닛 무자본 메소 수급 가이드 | 쌀먹·현금거래 정책 안내"]
    assert meta.get("description")
    assert "메소" in meta["description"] and "현금거래" in meta["description"]
    assert f'<link rel="canonical" href="{URL}">' in html
    assert meta.get("og:url") == URL
    assert "최근 검토: 2026-10-06" in html
    assert len(parser.json_ld) == 1
    article = parser.json_ld[0]
    assert article.get("@type") == "Article"
    assert article.get("datePublished") == "2026-05-30"
    assert article.get("dateModified") == "2026-10-06"
    assert article.get("mainEntityOfPage") == URL

    for source_url in [POLICY_URL, WORLD_URL, PATCH_URL, GUIDE_URL]:
        assert source_url in parser.links
    for phrase in ["쌀먹", "현금거래(RMT)", "외부 재화 거래", "제재", "게임 안에서 얻고 쓰는 메소"]:
        assert phrase in html
    for risky_claim in [
        "서드파티 복각 서버",
        "2만원",
        "20,000원",
        "10만원",
        "500만 메소",
        "90%",
        "시급",
        "즉시 현금 환전",
        "환전 방법",
        "현금 수익",
        "사설 서버",
        "비공식 서버",
    ]:
        assert risky_claim not in html


def test_maple_planet_no_capital_internal_links_resolve():
    _, parser = _parsed_page()
    assert "maple-planet-suncall-blizzard-hp-zero-setup-2026.html" in parser.links
    assert "maple-planet-lv80-black-centaurus-leveling-2026.html" in parser.links
    for href in parser.links:
        resolved = urlparse(urljoin(URL, href))
        if resolved.scheme not in {"http", "https"}:
            continue
        if resolved.netloc not in {"emfls.github.io", "www.emfls.github.io"}:
            continue
        relative = resolved.path.lstrip("/") or "index.html"
        target = ROOT / relative
        if target.is_dir() or resolved.path.endswith("/"):
            target /= "index.html"
        assert target.is_file(), f"Broken same-site link: {href} -> {target}"
