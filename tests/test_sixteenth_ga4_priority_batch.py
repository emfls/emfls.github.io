from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "kor/report/travel/israel-kiryat-malakhi.html": "입국",
    "kor/report/travel/korean-souvenir-foreigners-2026.html": "가격",
    "kor/report/travel/lebanon-sur.html": "입국",
    "kor/report/travel/mongolia-tsagaan-suvarga.html": "입국",
    "kor/report/travel/oman-duqm.html": "입국",
    "kor/report/travel/philippines-olongapo.html": "입국",
    "kor/report/travel/portugal-portimao.html": "입국",
    "kor/report/travel/russia-stpetersburg.html": "입국",
    "kor/report/travel/switzerland-interlaken.html": "입국",
    "kor/report/travel/switzerland-zurich.html": "입국",
}


class SixteenthGa4PriorityBatchTest(unittest.TestCase):
    def test_contract(self):
        for relative, limitation in PAGES.items():
            with self.subTest(relative=relative):
                html = (ROOT / relative).read_text(encoding="utf-8")
                compact = "".join(html.split())
                expected_date = (
                    "2026-08-25"
                    if relative.endswith("korean-souvenir-foreigners-2026.html")
                    else "2026-08-10"
                )
                self.assertIn(expected_date, html)
                self.assertIn('"@type":"WebPage"', compact)
                self.assertIn(limitation, html)
                self.assertIn("관련", html)
                self.assertIn("max-width:100%", compact)


if __name__ == "__main__":
    unittest.main()
