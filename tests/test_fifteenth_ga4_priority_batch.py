from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "jp/util/caseconverter/index.html": ("WebApplication", "翻訳", "その他"),
    "kor/game/ConnectFour/index.html": ("VideoGame", "오락", "관련"),
    "kor/report/camp/geumsan.html": ("WebPage", "허용", "관련"),
    "kor/report/camp/gunsan.html": ("WebPage", "허용", "관련"),
    "kor/report/camp/yangpyeong.html": ("WebPage", "허용", "관련"),
    "kor/report/camp/yeongdong.html": ("WebPage", "허용", "관련"),
    "kor/report/stock/2025/skhynix-000660.html": ("WebPage", "투자 판단", "관련"),
    "kor/report/travel/chile-laserena.html": ("WebPage", "입국", "관련"),
    "kor/report/travel/china-urumqi.html": ("WebPage", "입국", "관련"),
    "kor/report/travel/estonia-tallinn.html": ("WebPage", "입국", "관련"),
}


class FifteenthGa4PriorityBatchTest(unittest.TestCase):
    def test_contract(self):
        for relative, (schema, limitation, related) in PAGES.items():
            with self.subTest(relative=relative):
                html = (ROOT / relative).read_text(encoding="utf-8")
                compact = "".join(html.split())
                self.assertIn("2026-08-10", html)
                self.assertIn(f'"@type":"{schema}"', compact)
                self.assertIn(limitation.lower(), html.lower())
                self.assertIn(related, html)
                self.assertIn("max-width:100%", compact)


if __name__ == "__main__":
    unittest.main()
