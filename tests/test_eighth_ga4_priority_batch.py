from pathlib import Path
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "cn/util/crc/index.html": ("WebApplication", "加密", "相关"),
    "cn/util/nicknamegen/index.html": ("WebApplication", "可用性", "相关"),
    "kor/column/maple-planet-suncaller-leveling-guide-2026.html": ("Article", "패치", "관련"),
    "kor/report/travel/indonesia-manado.html": ("TravelAction", "입국", "관련"),
    "ru/util/barcode/index.html": ("WebApplication", "сканер", "Другие"),
    "util/crc/index.html": ("WebApplication", "encryption", "Related"),
    "jp/game/Gomoku/index.html": ("VideoGame", "禁じ手", "関連"),
    "util/barcode/index.html": ("WebApplication", "scanner", "Related"),
    "game/ConnectFour/index.html": ("VideoGame", "draw", "Related"),
    "kor/game/index.html": ("CollectionPage", "무료", "관련"),
}


class EighthGa4PriorityBatchTest(unittest.TestCase):
    def test_pages_have_quality_contract(self):
        for relative, (schema_type, limitation, related_label) in PAGES.items():
            with self.subTest(relative=relative):
                html = (ROOT / relative).read_text(encoding="utf-8")
                compact = "".join(html.split())
                self.assertIn("2026-08-09", html)
                self.assertIn(f'"@type":"{schema_type}"', compact)
                self.assertIn(limitation.lower(), html.lower())
                self.assertIn(related_label, html)
                self.assertIn("max-width:100%", compact)

    def test_directory_pages_use_trailing_slash_canonicals(self):
        expected = {
            "jp/game/Gomoku/index.html": "https://emfls.github.io/jp/game/Gomoku/",
            "game/ConnectFour/index.html": "https://emfls.github.io/game/ConnectFour/",
            "kor/game/index.html": "https://emfls.github.io/kor/game/",
        }
        for relative, canonical in expected.items():
            html = (ROOT / relative).read_text(encoding="utf-8")
            self.assertIn(f'rel="canonical" href="{canonical}"', html)

    def test_crc32_matches_standard_check_value(self):
        for relative in ("cn/util/crc/index.html", "util/crc/index.html"):
            html = (ROOT / relative).read_text(encoding="utf-8")
            start = html.index("function crc32(str)")
            end = html.index("function crc16(str)", start)
            function_source = html[start:end]
            result = subprocess.run(
                ["node", "-e", function_source + ';process.stdout.write(crc32("123456789"));'],
                check=True,
                capture_output=True,
                text=True,
            )
            self.assertEqual("CBF43926", result.stdout, relative)


if __name__ == "__main__":
    unittest.main()
