import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELATIVE_URL = "/kor/report/travel/vietnam-one-month-cost.html"
CANONICAL = "https://emfls.github.io" + RELATIVE_URL
PAGE = ROOT / RELATIVE_URL.lstrip("/")


class ArticleParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = []
        self.h1 = []
        self.meta = {}
        self.canonical = []
        self.links = []
        self.json_ld = []
        self.tables = {}
        self._capture = None
        self._json_text = []
        self._table = None
        self._row = None
        self._cell = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "title":
            self._capture = "title"
        elif tag == "h1":
            self._capture = "h1"
        elif tag == "meta":
            name = attrs.get("name") or attrs.get("property")
            if name:
                self.meta[name] = attrs.get("content", "")
        elif tag == "link" and attrs.get("rel") == "canonical":
            self.canonical.append(attrs.get("href", ""))
        elif tag == "a":
            self.links.append(attrs.get("href", ""))
        elif tag == "script" and attrs.get("type") == "application/ld+json":
            self._capture = "json"
            self._json_text = []
        elif tag == "table" and attrs.get("id"):
            self._table = attrs["id"]
            self.tables[self._table] = []
        elif tag == "tr" and self._table:
            self._row = []
        elif tag in {"th", "td"} and self._row is not None:
            self._cell = []

    def handle_data(self, data):
        if self._capture == "title":
            self.title.append(data)
        elif self._capture == "h1":
            self.h1.append(data)
        elif self._capture == "json":
            self._json_text.append(data)
        if self._cell is not None:
            self._cell.append(data)

    def handle_endtag(self, tag):
        if tag in {"title", "h1"} and self._capture == tag:
            self._capture = None
        elif tag == "script" and self._capture == "json":
            self.json_ld.append(json.loads("".join(self._json_text)))
            self._capture = None
        elif tag in {"th", "td"} and self._cell is not None:
            self._row.append("".join(self._cell).strip())
            self._cell = None
        elif tag == "tr" and self._row is not None:
            self.tables[self._table].append(self._row)
            self._row = None
        elif tag == "table" and self._table:
            self._table = None


def parsed_page():
    assert PAGE.is_file(), "Vietnam one-month cost article is missing"
    html = PAGE.read_text(encoding="utf-8")
    parser = ArticleParser()
    parser.feed(html)
    return html, parser


def test_article_keeps_existing_seo_measurement_and_ad_contract():
    html, page = parsed_page()
    assert "베트남 한 달 살기 비용" in "".join(page.title)
    assert "베트남 한 달 살기 비용" in "".join(page.h1)
    assert 70 <= len(page.meta.get("description", "")) <= 160
    assert page.canonical == [CANONICAL]
    assert page.meta.get("robots") == "index,follow"
    assert html.count("G-QP5Q67GE5B") == 2
    assert html.count("ca-pub-8830524482034754") == 1
    assert len(page.json_ld) == 1
    schema = page.json_ld[0]
    assert schema["@type"] == "Article"
    assert schema["mainEntityOfPage"] == CANONICAL
    assert schema["datePublished"] == "2026-10-07"
    assert schema["dateModified"] == "2026-10-07"
    assert 'name="viewport"' in html
    assert 'class="crumbs breadcrumb"' in html
    assert 'id="budget-table" class="responsive"' in html
    assert 'class="related-content"' in html
    assert "adsbygoogle.js" in html
    assert "PREP ONLY" not in html
    assert "noindex" not in html.lower()
    assert "calculator.js" not in html.lower()


def test_city_baseline_rows_match_the_visible_itemized_formula():
    _, page = parsed_page()
    rows = page.tables["budget-table"]
    assert len(rows) == 4
    values_by_city = {}
    for row in rows[1:]:
        city = row[0]
        numbers = [int(value.replace(",", "")) for cell in row[1:] for value in re.findall(r"\d[\d,]*", cell)]
        assert len(numbers) == 12, f"each city must show five input ranges and a subtotal: {row}"
        (rent_low, rent_high, food_low, food_high, transit_low, transit_high,
         mobile_low, mobile_high, coffee_low, coffee_high, total_low, total_high) = numbers
        assert total_low == rent_low + food_low + transit_low + mobile_low + coffee_low
        assert total_high == rent_high + food_high + transit_high + mobile_high + coffee_high
        values_by_city[city] = (total_low, total_high)
    assert values_by_city == {
        "하노이": (10_040_000, 22_130_000),
        "다낭": (13_936_400, 25_910_000),
        "호찌민": (14_850_000, 32_270_000),
    }
    html, _ = parsed_page()
    assert "1인" in html and "30일" in html and "VND" in html
    assert "60끼" in html and "10잔" in html
    assert "신뢰구간" in html


def test_article_distinguishes_monthly_rent_from_thirty_night_travel_booking():
    html, page = parsed_page()
    for phrase in ("월세 기준", "30박", "단기 예약", "항공권", "여행자보험", "공과금"):
        assert phrase in html
    assert "booking.com/extended-stays/index.html" in html
    assert "vietnamtourism.com/en/renting-an-apartment-in-vietnam-monthly-prices-by-city-in-2026" in html
    assert "2026년 9월 25일" in html
    assert "가구 포함" in html
    assert "한국 여권" in html and "45일" in html
    assert "2028년 3월 14일" in html
    assert "vnembassy-seoul.mofa.gov.vn" in html
    assert "evisa.gov.vn" in html
    assert "$25" in html and "$50" in html
    assert "다녀왔습니다" not in html
    assert "직접 살아본" not in html
    assert page.links.count("/kor/report/travel/vietnam-hanoi.html") == 1
    assert page.links.count("/kor/report/travel/vietnam-danang.html") == 1
    assert page.links.count("/kor/report/travel/vietnam-hochiminh.html") == 1


def test_all_internal_links_and_fresh_city_price_sources_are_registered():
    html, page = parsed_page()
    for city in ("Hanoi", "Da-Nang", "Ho-Chi-Minh-City"):
        assert f"numbeo.com/cost-of-living/in/{city}" in html
    assert "2026년 10월 5일" in html
    assert "2026년 10월 6일" in html
    for href in page.links:
        if href.startswith("/"):
            target = ROOT / href.lstrip("/")
            if href.endswith("/"):
                target = target / "index.html"
            assert target.is_file(), f"broken internal link: {href}"


def test_publication_discovery_registers_page_once_without_publishing_it():
    _, page = parsed_page()
    travel_sitemap = (ROOT / "kor/report/travel/sitemap.xml").read_text(encoding="utf-8")
    assert travel_sitemap.count(CANONICAL) == 1
    assert (ROOT / "kor/sitemap.xml").read_text(encoding="utf-8").count(CANONICAL) == 0
    index = json.loads((ROOT / "data/content-index-ko.json").read_text(encoding="utf-8"))
    matching = [row for row in index if row["url"] == RELATIVE_URL]
    assert len(matching) == 1
    assert matching[0]["category"] == "여행"
    metadata = json.loads((ROOT / "data/content-metadata.json").read_text(encoding="utf-8"))
    target_metadata = [row for row in metadata if row["url"] == RELATIVE_URL]
    assert len(target_metadata) == 1
    assert target_metadata[0]["target_query"] == "베트남한달살기비용"
    source_urls = {source["url"] for source in target_metadata[0]["sources"]}
    assert "https://www.numbeo.com/cost-of-living/in/Hanoi" in source_urls
    assert "https://vnembassy-seoul.mofa.gov.vn/vi/web/guest/tin-chi-tiet/chi-tiet/danh-muc-mien-thi-thuc-cua-viet-nam-voi-cac-nuoc-57162-596.html" in source_urls
    assert "https://evisa.gov.vn/" in source_urls
    feed = json.loads((ROOT / "data/home-feed-ko.json").read_text(encoding="utf-8"))
    assert feed["latest"][0]["url"] == RELATIVE_URL

    manifest = json.loads((ROOT / "data/content-launch-manifest.json").read_text(encoding="utf-8"))
    assert RELATIVE_URL not in manifest.get("urls", [])
