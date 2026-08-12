import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "game/MBTI/index.html": "https://emfls.github.io/game/MBTI/",
    "kor/report/visa/singapore.html": "https://emfls.github.io/kor/report/visa/singapore.html",
    "kor/report/visa/serbia.html": "https://emfls.github.io/kor/report/visa/serbia.html",
    "kor/report/mabinogi-mobile-jobs.html": "https://emfls.github.io/kor/report/mabinogi-mobile-jobs.html",
    "kor/report/visa/philippines.html": "https://emfls.github.io/kor/report/visa/philippines.html",
}

def load(path):
    html = (ROOT / path).read_text(encoding="utf-8")
    page = PageParser(); page.feed(html)
    return html, page

class SearchOpportunityBatch06Test(unittest.TestCase):
    def test_identity_measurement_and_current_review(self):
        for path, canonical in PAGES.items():
            with self.subTest(path=path):
                html, page = load(path)
                self.assertEqual(page.canonical, canonical)
                self.assertIn("G-QP5Q67GE5B", html)
                self.assertIn("2026-08-12", html)

    def test_mbti_is_transparent_and_ad_free(self):
        html, _ = load("game/MBTI/index.html")
        for phrase in ("entertainment", "not a clinical", "majority", "four preference pairs"):
            self.assertIn(phrase, html.lower())
        self.assertNotIn("pagead2.googlesyndication.com", html)

    def test_entry_pages_answer_key_decisions(self):
        singapore, _ = load("kor/report/visa/singapore.html")
        philippines, _ = load("kor/report/visa/philippines.html")
        serbia, _ = load("kor/report/visa/serbia.html")
        for phrase in ("도착일을 포함한 3일", "무료", "e-Pass"):
            self.assertIn(phrase, singapore)
        for phrase in ("30일", "72시간", "무료", "29일"):
            self.assertIn(phrase, philippines)
        for phrase in ("90/180", "90~180일", "mfa.gov.rs"):
            self.assertIn(phrase, serbia)

    def test_mabinogi_gives_official_role_choices(self):
        html, page = load("kor/report/mabinogi-mobile-jobs.html")
        for phrase in ("전사", "궁수", "마법사", "힐러", "음유시인", "도적", "무기 또는 엠블럼"):
            self.assertIn(phrase, html)
        self.assertTrue(any("/Info/Class" in a.get("href", "") for a in page.links))

    def test_content_ads_are_preserved_not_multiplied(self):
        for path in PAGES:
            html, _ = load(path)
            if path.startswith("kor/"):
                self.assertIn("ca-pub-8830524482034754", html)

if __name__ == "__main__": unittest.main()
