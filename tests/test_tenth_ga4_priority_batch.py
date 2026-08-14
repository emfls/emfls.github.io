from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "cn/util/quickmemo/index.html": ("WebApplication", "localStorage", "相关"),
    "cn/util/tts/index.html": ("WebApplication", "语音", "相关"),
    "kor/column/maple-planet-vs-mapleland-farming-ep1-2026.html": ("Article", "보장", "관련"),
    "kor/report/camp/index.html": ("CollectionPage", "등록", "관련"),
    "util/time-diff/index.html": ("WebApplication", "time zone", "Related"),
    "cn/game/TetrisGame/index.html": ("VideoGame", "操作", "相关"),
    "cn/util/index.html": ("CollectionPage", "浏览器", "相关"),
    "game/index.html": ("CollectionPage", "browser", "Related"),
    "kor/report/camp/bonghwa.html": ("WebPage", "야영", "관련"),
    "kor/report/camp/cheongsong.html": ("WebPage", "야영", "관련"),
}


class TenthGa4PriorityBatchTest(unittest.TestCase):
    def test_pages_have_quality_contract(self):
        for relative, (schema_type, limitation, related_label) in PAGES.items():
            with self.subTest(relative=relative):
                html = (ROOT / relative).read_text(encoding="utf-8")
                compact = "".join(html.split())
                review_dates = re.findall(r"2026-\d{2}-\d{2}", html)
                self.assertTrue(review_dates)
                self.assertGreaterEqual(max(review_dates), "2026-08-10")
                self.assertIn(f'"@type":"{schema_type}"', compact)
                self.assertIn(limitation.lower(), html.lower())
                self.assertIn(related_label, html)
                self.assertIn("max-width:100%", compact)


if __name__ == "__main__":
    unittest.main()
