from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "game/QuickDraw/index.html": ("VideoGame", "reaction", "Related"),
    "jp/util/quickmemo/index.html": ("WebApplication", "localStorage", "関連"),
    "kor/column/maple-planet-3rd-job-cygnus-captain-2026.html": ("Article", "패치", "관련"),
    "kor/report/ai/ollama-local-ai-2026.html": ("HowTo", "공식", "관련"),
    "kor/report/camp/jecheon.html": ("WebPage", "야영", "관련"),
    "kor/report/camp/mokpo.html": ("WebPage", "야영", "관련"),
    "kor/report/camp/yeoncheon.html": ("WebPage", "야영", "관련"),
    "kor/report/camp/yongin.html": ("WebPage", "야영", "관련"),
    "kor/report/travel/albania-durres.html": ("WebPage", "입국", "관련"),
    "kor/report/travel/china-shenyang.html": ("WebPage", "입국", "관련"),
}
REVIEW_DATES = {"kor/report/camp/mokpo.html": "2026-08-26"}

class TwelfthGa4PriorityBatchTest(unittest.TestCase):
    def test_pages_have_quality_contract(self):
        for relative, (schema_type, limitation, related) in PAGES.items():
            with self.subTest(relative=relative):
                html = (ROOT / relative).read_text(encoding="utf-8")
                compact = "".join(html.split())
                self.assertIn(REVIEW_DATES.get(relative, "2026-08-10"), html)
                self.assertIn(f'"@type":"{schema_type}"', compact)
                self.assertIn(limitation.lower(), html.lower())
                self.assertIn(related, html)
                self.assertIn("max-width:100%", compact)

if __name__ == "__main__":
    unittest.main()
