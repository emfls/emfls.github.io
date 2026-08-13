from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "fr/game/2048/index.html": ("VideoGame", "aléatoire", "Autres"),
    "kor/report/camp/damyang.html": ("WebPage", "허용", "관련"),
    "ru/util/dice3d/index.html": ("WebApplication", "случайн", "Другие"),
    "kor/report/camp/cheongju.html": ("WebPage", "허용", "관련"),
    "kor/report/camp/gwangju-g.html": ("WebPage", "허용", "관련"),
    "kor/report/visa/romania.html": ("WebPage", "공식", "관련"),
    "kor/report/camp/gimpo.html": ("WebPage", "허용", "관련"),
    "cn/util/qrcode/index.html": ("WebApplication", "敏感", "其他"),
    "game/PONGvsAI/index.html": ("VideoGame", "device", "Related"),
    "game/ZombieSurvival/index.html": ("VideoGame", "entertainment", "Related"),
}


class FourteenthGa4PriorityBatchTest(unittest.TestCase):
    def test_contract(self):
        for relative, (schema, limitation, related) in PAGES.items():
            with self.subTest(relative=relative):
                html = (ROOT / relative).read_text(encoding="utf-8")
                compact = "".join(html.split())
                self.assertRegex(html, r"2026-08-(?:10|12|13)")
                self.assertIn(f'"@type":"{schema}"', compact)
                self.assertIn(limitation.lower(), html.lower())
                self.assertIn(related, html)
                self.assertIn("max-width:100%", compact)


if __name__ == "__main__":
    unittest.main()
