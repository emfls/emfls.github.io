from pathlib import Path
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "ru/util/crc/index.html": ("WebApplication", "шифрован", "Другие"),
    "jp/util/fin-calc/index.html": ("WebApplication", "概算", "関連"),
    "kor/column/imjin-war-joseon-character-growth-guide-2026.html": ("Article", "패치", "관련"),
    "kor/report/travel/kazakhstan-almaty.html": ("WebPage", "입국", "관련"),
    "kor/report/visa/indonesia.html": ("WebPage", "이민국", "관련"),
    "kor/column/maple-planet-warrior-lv60-70-quest-guide-2026.html": ("Article", "패치", "관련"),
    "kor/report/camp/cheorwon.html": ("WebPage", "야영", "관련"),
    "kor/report/visa/hungary.html": ("WebPage", "영사", "관련"),
    "ru/util/teamgen/index.html": ("WebApplication", "криптограф", "Другие"),
    "util/nicknamegen/index.html": ("WebApplication", "trademark", "Related"),
}


class NinthGa4PriorityBatchTest(unittest.TestCase):
    def test_pages_have_quality_contract(self):
        for relative, (schema_type, limitation, related_label) in PAGES.items():
            with self.subTest(relative=relative):
                html = (ROOT / relative).read_text(encoding="utf-8")
                compact = "".join(html.split())
                self.assertIn("2026-08-10", html)
                self.assertIn(f'"@type":"{schema_type}"', compact)
                self.assertIn(limitation.lower(), html.lower())
                self.assertIn(related_label, html)
                self.assertIn("max-width:100%", compact)

    def test_russian_crc32_matches_standard_check_value(self):
        html = (ROOT / "ru/util/crc/index.html").read_text(encoding="utf-8")
        start = html.index("function crc32(str)")
        end = html.index("function crc16(str, poly)", start)
        result = subprocess.run(
            ["node", "-e", html[start:end] + ';process.stdout.write(crc32("123456789"));'],
            check=True,
            capture_output=True,
            text=True,
        )
        self.assertEqual("CBF43926", result.stdout)


if __name__ == "__main__":
    unittest.main()
