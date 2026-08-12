from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class SearchDemandToolsContractTest(unittest.TestCase):
    PAGES = {
        "camping-packing-checklist": "캠핑 준비물 체크리스트",
        "japan-esim-data-calculator": "일본 eSIM 데이터 사용량 계산기",
        "japan-travel-packing-checklist": "일본 여행 준비물 체크리스트",
    }

    def test_pages_have_required_metadata_and_measurement(self):
        for slug, keyword in self.PAGES.items():
            with self.subTest(slug=slug):
                path = ROOT / "kor" / "util" / slug / "index.html"
                html = path.read_text(encoding="utf-8")
                canonical = f'https://emfls.github.io/kor/util/{slug}/'
                self.assertIn(keyword, html)
                self.assertIn(f'<link rel="canonical" href="{canonical}">', html)
                self.assertIn('name="description"', html)
                self.assertIn('G-QP5Q67GE5B', html)
                self.assertIn('ca-pub-8830524482034754', html)
                self.assertIn('application/ld+json', html)
                self.assertIn('app.js', html)

    def test_tools_cross_link_to_relevant_content(self):
        camp = (ROOT / "kor/util/camping-packing-checklist/index.html").read_text(encoding="utf-8")
        esim = (ROOT / "kor/util/japan-esim-data-calculator/index.html").read_text(encoding="utf-8")
        japan = (ROOT / "kor/util/japan-travel-packing-checklist/index.html").read_text(encoding="utf-8")
        self.assertIn('/kor/report/camp/', camp)
        self.assertIn('/kor/util/japan-travel-packing-checklist/', esim)
        self.assertIn('/kor/util/japan-esim-data-calculator/', japan)
        self.assertIn('/kor/report/travel/japan-tokyo.html', japan)

    def test_hubs_link_to_new_tools(self):
        camp_hub = (ROOT / "kor/report/camp/index.html").read_text(encoding="utf-8")
        tokyo = (ROOT / "kor/report/travel/japan-tokyo.html").read_text(encoding="utf-8")
        self.assertIn('/kor/util/camping-packing-checklist/', camp_hub)
        self.assertIn('/kor/util/japan-esim-data-calculator/', tokyo)
        self.assertIn('/kor/util/japan-travel-packing-checklist/', tokyo)


if __name__ == "__main__":
    unittest.main()
