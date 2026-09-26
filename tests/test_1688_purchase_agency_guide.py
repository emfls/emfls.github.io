import json
import re
import unittest
from html import unescape
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/column/1688gumaedaehaeng/index.html"
CANONICAL = "https://emfls.github.io/kor/column/1688gumaedaehaeng/"


class PurchaseAgencyGuideTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = unescape(PAGE.read_text(encoding="utf-8"))

    def test_page_exists_and_uses_directory_route(self):
        self.assertTrue(PAGE.is_file())
        self.assertNotIn("kor/column/1688gumaedaehaeng.html", self.html)

    def test_seo_contract(self):
        self.assertIn(
            '<link rel="canonical" href="https://emfls.github.io/kor/column/1688gumaedaehaeng/">',
            self.html,
        )
        robots = re.search(
            r'<meta\s+name="robots"\s+content="([^"]+)"', self.html, re.I
        )
        self.assertIsNotNone(robots)
        self.assertEqual(robots.group(1).replace(" ", "").lower(), "index,follow")
        self.assertEqual(len(re.findall(r"<h1\b", self.html, re.I)), 1)
        self.assertIn("<html lang=\"ko\">", self.html)

    def test_article_json_ld_uses_canonical(self):
        blocks = re.findall(
            r'<script\s+type="application/ld\+json">(.*?)</script>',
            self.html,
            re.I | re.S,
        )
        self.assertTrue(blocks)
        article = next((json.loads(block) for block in blocks if '"Article"' in block), None)
        self.assertIsNotNone(article)
        self.assertEqual(article["@type"], "Article")
        self.assertEqual(article["mainEntityOfPage"], CANONICAL)
        self.assertEqual(article["datePublished"], "2026-09-27")
        self.assertEqual(article["dateModified"], "2026-09-27")

    def test_measurement_contract(self):
        self.assertIn("G-QP5Q67GE5B", self.html)
        self.assertIn("ca-pub-8830524482034754", self.html)

    def test_official_sources_are_present(self):
        sources = (
            "https://customs.go.kr/kcs/ad/tax/BuyTaxCalculation.do",
            "https://www.customs.go.kr/kcs/cm/cntnts/cntntsView.do?cntntsId=817&mi=2819",
            "https://www.safetykorea.kr/policy/targetsSafetyProvider",
            "https://www.worldfirst.com/kr/help-center/1688/what-is-1688/",
            "https://www.worldfirst.com/kr/help-center/1688/1688-payment-solutions/",
        )
        for source in sources:
            with self.subTest(source=source):
                self.assertIn(source, self.html)

    def test_required_verification_sections_and_terms(self):
        required = (
            "직접 주문",
            "구매대행",
            "배송대행",
            "개인 구매",
            "사업자 소싱",
            "총비용",
            "검수",
            "통관",
            "KC",
            "worksheet",
            "중국 내 배송비",
            "국제배송비",
        )
        for term in required:
            with self.subTest(term=term):
                self.assertIn(term, self.html)

    def test_worksheet_is_client_side_only(self):
        self.assertIn('id="landed-cost-form"', self.html)
        self.assertIn("addEventListener(\"submit\"", self.html)
        self.assertIn("입력한 항목 합계", self.html)
        self.assertNotIn("fetch(", self.html)
        self.assertNotIn("XMLHttpRequest", self.html)

    def test_no_provider_ranking_or_marketing_claims(self):
        forbidden = (
            "TOP 10",
            "TOP 5",
            "1위 업체",
            "최저가 업체",
            "가장 안전",
            "무조건 면세",
            "무조건 관세",
            "모든 상품 KC",
            "KC 인증 필요 없음",
            "제휴 링크",
            "추천 업체",
        )
        lowered = self.html.lower()
        for phrase in forbidden:
            with self.subTest(phrase=phrase):
                self.assertNotIn(phrase.lower(), lowered)


if __name__ == "__main__":
    unittest.main()
