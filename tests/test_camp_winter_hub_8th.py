from html.parser import HTMLParser
import json
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
HUB = ROOT / "kor/report/camp/winter-public-campsites-2026.html"
HUB_URL = "/kor/report/camp/winter-public-campsites-2026.html"


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = []
        self.h1 = []
        self.metas = []
        self.ads = []
        self.json_ld = []
        self._tag = None
        self._script = False
        self._script_data = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in {"title", "h1"}:
            self._tag = tag
        elif tag == "meta":
            self.metas.append(attrs)
        elif tag == "ins" and "adsbygoogle" in attrs.get("class", "").split():
            self.ads.append(attrs)
        elif tag == "script" and attrs.get("type") == "application/ld+json":
            self._script = True
            self._script_data = []

    def handle_endtag(self, tag):
        if tag == "script" and self._script:
            self.json_ld.append(json.loads("".join(self._script_data)))
            self._script = False
            self._script_data = []
        if tag == self._tag:
            self._tag = None

    def handle_data(self, data):
        if self._tag == "title":
            self.title.append(data)
        elif self._tag == "h1":
            self.h1.append(data)
        if self._script:
            self._script_data.append(data)


def _table_rows(document, table_id):
    match = re.search(
        rf'<table\b[^>]*\bid="{re.escape(table_id)}"[^>]*>(.*?)</table>',
        document,
        re.DOTALL,
    )
    if not match:
        return []
    tbody = re.search(r"<tbody>(.*?)</tbody>", match.group(1), re.DOTALL)
    if not tbody:
        return []
    return re.findall(r"<tr\b[^>]*>(.*?)</tr>", tbody.group(1), re.DOTALL)


class WinterHubEighthTaskTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = HUB.read_text(encoding="utf-8")
        cls.page = PageParser()
        cls.page.feed(cls.html)

    def test_question_title_and_reviewed_meta_description(self):
        self.assertEqual("".join(self.page.title), "2026 겨울 저렴한 캠핑장, 어디가 열까?")
        description = next(
            item["content"] for item in self.page.metas
            if item.get("name") == "description"
        )
        self.assertEqual(
            description,
            "2026~2027 겨울에 운영하는 국립공원·공공 야영장을 공식 공지 기준으로 비교했습니다. "
            "무료부터 3만원 이하 요금, 휴장기간, 전기와 예약 조건을 확인하세요.",
        )
        self.assertEqual(
            "".join(self.page.h1),
            "2026~2027 겨울 공공 저가 캠핑장: 무료부터 3만원 이하까지",
        )

    def test_national_park_notice_is_split_into_the_three_official_groups(self):
        self.assertEqual(len(_table_rows(self.html, "national-park-year-round")), 15)
        self.assertEqual(len(_table_rows(self.html, "national-park-partial")), 11)
        self.assertEqual(len(_table_rows(self.html, "national-park-closed")), 15)
        for fragment in (
            "2026-12-01~2027-03-31",
            "2026-11-16~2027-04-30",
            "2027-01-01~2027-02-28",
            "2026년 9월 29일",
            "확인일 2026-10-15",
        ):
            self.assertIn(fragment, self.html)

    def test_ratings_and_prior_21_site_price_facts_are_retained(self):
        for site, period in (
            ("갑사", "2026-12-01~2027-03-31"),
            ("송계", "2026-12-01~2027-03-31"),
            ("덕주", "2026-12-01~2027-03-31"),
            ("고사포1", "2026-12-01~2027-02-28"),
            ("소금강산", "2026-11-16~2027-04-30"),
        ):
            self.assertIn(site, self.html)
            self.assertIn(period, self.html)
        self.assertGreaterEqual(self.html.count("A-부분"), 5)
        for site_name in (
            "난지캠핑장", "초안산캠핑장", "킨텍스캠핑장", "사기막", "초막골",
            "바라산", "유명산", "산음", "중미산", "상소오토캠핑장", "합강",
            "전월산", "갑사", "학암포", "희리산", "송계", "닷돈재", "덕주",
            "금오산야영장", "고인돌 오토캠핑장", "김천숲속야영장",
        ):
            self.assertIn(site_name, self.html)
        for price_fact in (
            "4인 20,000원", "다른 일반존 28,000원", "일반 중형 6,000/9,000원",
            "시민가족존 15,000/25,000원", "오토존 25,000/30,000원",
            "비수기 평일 21,000원", "25,000원 · 주말 30,000원",
            "프리존 15,000/20,000원", "23,000/28,000원",
        ):
            self.assertIn(price_fact, self.html)

    def test_ads_canonical_measurement_and_faq_schema_are_preserved(self):
        self.assertEqual(
            [item.get("data-ad-slot") for item in self.page.ads],
            ["3423411629", "3423411629", "5833952548"],
        )
        self.assertEqual(
            [item.get("data-ad-format") for item in self.page.ads],
            ["fluid", "fluid", "autorelaxed"],
        )
        first_article_ad = self.html.index('data-ad-slot="3423411629"')
        self.assertGreater(first_article_ad, self.html.index('id="parking"'))
        self.assertLess(first_article_ad, self.html.index('id="prices"'))
        self.assertEqual(self.html.count("ca-pub-8830524482034754"), 4)
        self.assertIn("G-QP5Q67GE5B", self.html)
        self.assertIn(
            'href="https://emfls.github.io/kor/report/camp/winter-public-campsites-2026.html"',
            self.html,
        )
        self.assertTrue(any(item.get("@type") == "Article" for item in self.page.json_ld))
        faq = next(item for item in self.page.json_ld if item.get("@type") == "FAQPage")
        self.assertEqual(len(faq["mainEntity"]), 6)

    def test_all_eight_manual_review_phrases_are_softened(self):
        disallowed = {
            "jeongeup.html": ("완비된 글램핑 시설",),
            "chilgok.html": ("간단한 취사 정도 가능", "간단한취사가능"),
            "mungyeong.html": ("화장실과 음수대 완비된 무료 노지캠핑장",),
            "tongyeong.html": ("오토야영 가능",),
            "miryang.html": ("화장실O텐트취사가능", "화장실 완비, 텐트·취사 가능"),
            "gyeryong.html": (
                "괴목정 무궁화학습원 (무학대사 전설 + 무료 차박)",
                "무료 차박 베스트:",
            ),
            "suncheon.html": (
                "와온항 주차장에서 무료 차박과 캠핑",
                "무료 베스트:</strong> 와온해변",
            ),
        }
        for filename, phrases in disallowed.items():
            content = (ROOT / "kor/report/camp" / filename).read_text(encoding="utf-8")
            for phrase in phrases:
                with self.subTest(filename=filename, phrase=phrase):
                    self.assertNotIn(phrase, content)

    def test_related_region_pages_link_to_winter_hub_with_matched_status(self):
        expected = {
            "gyeryong.html": ("동학사야영장", "연중 운영"),
            "hongcheon.html": ("가리산자연휴양림", "2026년 11월 16일"),
            "yeongju.html": ("삼가", "2027년 1월 1일"),
            "seongju.html": ("백운동야영장", "연중 운영"),
        }
        for filename, phrases in expected.items():
            content = (ROOT / "kor/report/camp" / filename).read_text(encoding="utf-8")
            self.assertIn(HUB_URL, content)
            for phrase in phrases:
                self.assertIn(phrase, content)


if __name__ == "__main__":
    unittest.main()
