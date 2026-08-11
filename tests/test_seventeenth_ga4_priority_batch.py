from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "kor/report/travel/turkey-kahramanmaras.html": ("WebPage", "입국"),
    "kor/report/travel/vietnam-haiduong.html": ("WebPage", "입국"),
    "kor/report/travel/vietnam-haiphong.html": ("WebPage", "입국"),
    "kor/report/travel/데이트-코스.html": ("WebPage", "가격"),
    "kor/report/visa/kazakhstan.html": ("WebPage", "공식"),
    "kor/report/visa/laos.html": ("WebPage", "공식"),
    "kor/report/visa/norway.html": ("WebPage", "공식"),
    "kor/report/visa/thailand.html": ("WebPage", "공식"),
    "kor/report/visa/turkey.html": ("WebPage", "공식"),
    "ru/game/SnakeGame/index.html": ("VideoGame", "устройств"),
}

class SeventeenthGa4PriorityBatchTest(unittest.TestCase):
    def test_contract(self):
        for relative,(schema,limit) in PAGES.items():
            with self.subTest(relative=relative):
                html=(ROOT/relative).read_text(encoding="utf-8"); compact="".join(html.split())
                self.assertIn("2026-08-11",html); self.assertIn(f'"@type":"{schema}"',compact)
                self.assertIn(limit.lower(),html.lower()); self.assertIn("max-width:100%",compact)
                self.assertTrue("관련" in html or "Другие" in html)

if __name__=="__main__": unittest.main()
