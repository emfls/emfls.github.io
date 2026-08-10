from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "kor/report/camp/taean.html": ("WebPage", "야영", "관련"),
    "kor/report/camp/taebaek.html": ("WebPage", "야영", "관련"),
    "kor/report/travel/austria-vienna.html": ("WebPage", "입국", "관련"),
    "kor/report/travel/brazil-brasilia.html": ("WebPage", "입국", "관련"),
    "kor/report/travel/china-xiamen.html": ("WebPage", "입국", "관련"),
    "kor/report/visa/myanmar.html": ("WebPage", "공식", "관련"),
    "util/thumbnailgrabber/index.html": ("WebApplication", "YouTube", "Related"),
    "cn/game/GREENClick/index.html": ("VideoGame", "反应", "相关"),
    "cn/util/text-shuffle-sort/index.html": ("WebApplication", "随机", "相关"),
    "es/util/thumbnailgrabber/index.html": ("WebApplication", "YouTube", "relacionadas"),
}

class EleventhGa4PriorityBatchTest(unittest.TestCase):
    def test_pages_have_quality_contract(self):
        for relative, (schema_type, limitation, related) in PAGES.items():
            with self.subTest(relative=relative):
                html = (ROOT / relative).read_text(encoding="utf-8")
                compact = "".join(html.split())
                self.assertIn("2026-08-10", html)
                self.assertIn(f'"@type":"{schema_type}"', compact)
                self.assertIn(limitation.lower(), html.lower())
                self.assertIn(related, html)
                self.assertIn("max-width:100%", compact)

    def test_thumbnail_pages_present_youtube_only(self):
        for relative in ("util/thumbnailgrabber/index.html", "es/util/thumbnailgrabber/index.html"):
            html = (ROOT / relative).read_text(encoding="utf-8")
            title = html[html.index("<title>"):html.index("</title>")]
            self.assertIn("YouTube", title)
            self.assertNotIn("TikTok", title)
            self.assertNotIn("Twitter", title)

if __name__ == "__main__":
    unittest.main()
