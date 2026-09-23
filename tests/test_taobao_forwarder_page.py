from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/compare/taobao-forwarder-guide.html"


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.canonical = None
        self.has_h1 = False
        self.has_time = False
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "title":
            self._in_title = True
        elif tag == "h1":
            self.has_h1 = True
        elif tag == "time":
            self.has_time = True
        elif tag == "link" and "canonical" in attributes.get("rel", "").split():
            self.canonical = attributes.get("href")

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data


def test_taobao_forwarder_page_has_safe_content_contract():
    html = PAGE.read_text(encoding="utf-8")
    parser = PageParser()
    parser.feed(html)
    assert parser.title == "타오바오 배대지 추천 2026 | 배송비·검수·합배송 비교 기준"
    assert parser.has_h1
    assert parser.canonical == "https://emfls.github.io/kor/report/compare/taobao-forwarder-guide.html"
    assert not parser.has_time
    assert "정보 확인일: 2026-09-23" in html
    assert "가격·정책은 변경될 수" in html
    assert "1위로 선정" not in html and "가장 저렴" not in html and "무조건 추천" not in html
    assert "https://www.thebay.co.kr/" in html
    assert "https://www.tabae.co.kr/" in html
    assert "https://joypost.co.kr/" in html
    assert "https://www.tosstoss.co.kr/user/delivery_price.php" in html


def test_taobao_forwarder_page_is_in_korean_sitemap_only_once():
    sitemap = (ROOT / "kor/sitemap.xml").read_text(encoding="utf-8")
    url = "https://emfls.github.io/kor/report/compare/taobao-forwarder-guide.html"
    assert sitemap.count(url) == 1
