import json
import re
import unittest
from pathlib import Path


PAGE = Path(__file__).parents[1] / "kor/report/camp/seongnam.html"


class YuldongCampingBookingIntentTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")

    def test_answers_booking_intent_with_current_official_facts(self):
        required = (
            "율동공원 캠핑장 예약",
            "공식 홈페이지에서 온라인 또는 전화로 신청합니다",
            "매월 1~3일",
            "16~18일",
            "추첨제",
            "성남시민 우선",
            "오후 2시",
            "다음 날 오전 11시",
            "031-739-6767",
            "예약 가능 여부를 보장하지 않습니다",
            "2026-08-13",
        )
        for text in required:
            self.assertIn(text, self.html)

    def test_links_primary_sources_and_preserves_site_contracts(self):
        self.assertIn('href="https://camping.isdc.co.kr/"', self.html)
        self.assertIn('href="https://snvision.seongnam.go.kr/21728"', self.html)
        self.assertIn('<link rel="canonical" href="https://emfls.github.io/kor/report/camp/seongnam.html">', self.html)
        self.assertIn("G-QP5Q67GE5B", self.html)
        self.assertIn("ca-pub-8830524482034754", self.html)

    def test_structured_data_has_webpage_and_faq(self):
        blocks = re.findall(
            r'<script type="application/ld\+json">\s*(.*?)\s*</script>',
            self.html,
            re.DOTALL,
        )
        types = []
        for block in blocks:
            data = json.loads(block)
            types.append(data.get("@type"))
        self.assertIn("WebPage", types)
        self.assertIn("FAQPage", types)

    def test_removes_unverifiable_volatile_claim(self):
        self.assertNotIn("270:1", self.html)


if __name__ == "__main__":
    unittest.main()
