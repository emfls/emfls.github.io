import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "kor/report/camp/cheongju.html": ("https://emfls.github.io/kor/report/camp/cheongju.html", "청주 차박 장소 2026 | 문암 예약·오창 8/18~11/6 휴장"),
    "kor/report/camp/gimpo.html": ("https://emfls.github.io/kor/report/camp/gimpo.html", "김포 노지캠핑 가이드 | 전류리포구·한강 주변 확인사항"),
    "kor/report/camp/damyang.html": ("https://emfls.github.io/kor/report/camp/damyang.html", "담양 노지캠핑 가이드 | 담양호·하천변 이용 전 확인사항"),
    "kor/report/visa/romania.html": ("https://emfls.github.io/kor/report/visa/romania.html", "루마니아 비자 필요할까? 한국인 90일 무비자·솅겐 계산"),
    "kor/report/visa/slovakia.html": ("https://emfls.github.io/kor/report/visa/slovakia.html", "슬로바키아 비자 필요할까? 한국 여권 무비자 90/180일"),
}

def load(path):
    html = (ROOT / path).read_text(encoding="utf-8")
    page = PageParser(); page.feed(html)
    return html, page

class SearchOpportunityBatch07Test(unittest.TestCase):
    def test_search_identity_ads_and_measurement_are_preserved(self):
        for path, (canonical, title) in PAGES.items():
            with self.subTest(path=path):
                html, page = load(path)
                self.assertEqual(page.canonical, canonical)
                self.assertEqual(page.title, title)
                self.assertIn("G-QP5Q67GE5B", html)
                self.assertIn("ca-pub-8830524482034754", html)

    def test_pages_have_current_decision_first_guidance(self):
        for path in PAGES:
            html, _ = load(path)
            expected_date = "2026-08-13" if path in {"kor/report/visa/romania.html", "kor/report/visa/slovakia.html", "kor/report/camp/cheongju.html"} else "2026-08-12"
            self.assertIn(expected_date, html)
            self.assertTrue(any(x in html for x in ("먼저 답", "빠른 판단", "첫 판단")))

    def test_camping_pages_separate_registration_from_availability(self):
        checks = {
            "kor/report/camp/cheongju.html": ("공식 예약시설", "예약 화면", "munam.cheongju.go.kr"),
            "kor/report/camp/gimpo.html": ("등록 야영장", "예약 가능", "gocamping.or.kr"),
            "kor/report/camp/damyang.html": ("등록 야영장", "예약 가능", "gocamping.or.kr"),
        }
        for path, phrases in checks.items():
            html, _ = load(path)
            for phrase in phrases: self.assertIn(phrase, html)

    def test_schengen_pages_explain_the_shared_limit(self):
        romania, _ = load("kor/report/visa/romania.html")
        slovakia, _ = load("kor/report/visa/slovakia.html")
        for html in (romania, slovakia):
            self.assertIn("솅겐 전체 합산", html)
            self.assertIn("입국일", html)
            self.assertIn("출국일", html)
        self.assertIn("EES", romania)
        self.assertIn("국가비자", slovakia)
        self.assertIn("체류허가", slovakia)

if __name__ == "__main__": unittest.main()
