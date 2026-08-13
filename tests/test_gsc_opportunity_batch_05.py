import unittest
from pathlib import Path

from tests.test_gapyeong_camping_page import PageParser


ROOT = Path(__file__).resolve().parents[1]
CONTENT = {
    "kor/report/visa/nigeria.html": "https://emfls.github.io/kor/report/visa/nigeria.html",
    "kor/report/travel/australia-newcastle.html": "https://emfls.github.io/kor/report/travel/australia-newcastle.html",
    "kor/report/travel/australia-perth.html": "https://emfls.github.io/kor/report/travel/australia-perth.html",
}
GAMES = {
    "game/MarbleFlick/index.html": "https://emfls.github.io/game/MarbleFlick/",
    "game/AeroJump/index.html": "https://emfls.github.io/game/AeroJump/",
}


def load(relative_path):
    html = (ROOT / relative_path).read_text(encoding="utf-8")
    page = PageParser(); page.feed(html)
    return html, page


class SearchOpportunityBatch05Test(unittest.TestCase):
    def test_all_pages_keep_identity_and_measurement(self):
        for path, canonical in {**CONTENT, **GAMES}.items():
            with self.subTest(path=path):
                html, page = load(path)
                self.assertEqual(page.canonical, canonical)
                self.assertIn("G-QP5Q67GE5B", html)

    def test_content_pages_are_current_official_and_ad_supported(self):
        domains = {
            "kor/report/visa/nigeria.html": "immigration.gov.ng",
            "kor/report/travel/australia-newcastle.html": "visitnewcastle.com.au",
            "kor/report/travel/australia-perth.html": "transperth.wa.gov.au",
        }
        for path, domain in domains.items():
            with self.subTest(path=path):
                html, page = load(path)
                expected_date = "2026-08-13" if path in {"kor/report/visa/nigeria.html", "kor/report/travel/australia-newcastle.html"} else "2026-08-12"
                self.assertIn(expected_date, html)
                self.assertIn("ca-pub-8830524482034754", html)
                self.assertTrue(any(domain in a.get("href", "") for a in page.links))

    def test_nigeria_explains_short_evisa_limit(self):
        html, _ = load("kor/report/visa/nigeria.html")
        self.assertIn("최대 90일", html)
        self.assertIn("연장할 수 없습니다", html)
        self.assertIn("e-Visa 승인이 입국을 보장하지", html)

    def test_australia_pages_answer_the_route_decision(self):
        newcastle, _ = load("kor/report/travel/australia-newcastle.html")
        perth, _ = load("kor/report/travel/australia-perth.html")
        for phrase in ("6km", "약 3시간", "Bathers Way"):
            self.assertIn(phrase, newcastle)
        for phrase in ("T1·T2", "T3·T4", "Airport Central"):
            self.assertIn(phrase, perth)

    def test_games_have_searchable_instructions_without_adsense(self):
        requirements = {
            "game/MarbleFlick/index.html": ("Free Browser Marble Game", "mouse or touch", "knock your opponent"),
            "game/AeroJump/index.html": ("Free Browser Platform Game", "arrow keys or touch", "Restart"),
        }
        for path, phrases in requirements.items():
            with self.subTest(path=path):
                html, page = load(path)
                for phrase in phrases:
                    self.assertIn(phrase.lower(), (page.title + " " + html).lower())
                self.assertNotIn("pagead2.googlesyndication.com", html)
                self.assertNotIn("adsbygoogle.push", html)


if __name__ == "__main__":
    unittest.main()
