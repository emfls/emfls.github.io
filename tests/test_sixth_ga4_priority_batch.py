import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

PAGES = {
    "ru/game/MBTI/index.html": ("https://emfls.github.io/ru/game/MBTI/", "VideoGame", "развлеч"),
    "es/game/STOPat5/index.html": ("https://emfls.github.io/es/game/STOPat5/", "VideoGame", "navegador"),
    "report/sec/nvda-10k-202601.html": ("https://emfls.github.io/report/sec/nvda-10k-202601.html", "Article", "000104581026000021"),
    "cn/game/index.html": ("https://emfls.github.io/cn/game/", "CollectionPage", "游戏目录"),
    "jp/util/crc/index.html": ("https://emfls.github.io/jp/util/crc/", "WebApplication", "暗号化"),
    "cn/util/caseconverter/index.html": ("https://emfls.github.io/cn/util/caseconverter/", "WebApplication", "翻译"),
    "kor/util/teamgen/index.html": ("https://emfls.github.io/kor/util/teamgen/", "WebApplication", "암호학적"),
    "cn/util/dice3d/index.html": ("https://emfls.github.io/cn/util/dice3d/", "WebApplication", "加密安全"),
    "kor/util/dice3d/index.html": ("https://emfls.github.io/kor/util/dice3d/", "WebApplication", "암호학적"),
    "util/qrcode/index.html": ("https://emfls.github.io/util/qrcode/", "WebApplication", "sensitive"),
}


class SixthGa4PriorityBatchTest(unittest.TestCase):
    def test_page_contracts(self):
        for rel, (canonical, schema_type, limitation) in PAGES.items():
            with self.subTest(page=rel):
                html = (ROOT / rel).read_text(encoding="utf-8")
                self.assertIn(f'href="{canonical}"', html)
                self.assertIn("2026-08-09", html)
                self.assertIn(limitation, html)
                self.assertIn("googletagmanager.com/gtag/js", html)
                if "/game/" in f"/{rel}":
                    self.assertNotIn("pagead2.googlesyndication.com", html)
                    self.assertNotIn("adsbygoogle", html)
                else:
                    self.assertIn("pagead2.googlesyndication.com", html)
                self.assertIn('div[id^="aswift_"]', html)
                schemas = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
                parsed = [json.loads(item) for item in schemas]
                schema_types = {item.get("@type") for item in parsed}
                self.assertIn(schema_type, schema_types)
                self.assertIn("FAQPage", schema_types)

    def test_core_functions_remain(self):
        markers = {
            "ru/game/MBTI/index.html": "function showResult()",
            "es/game/STOPat5/index.html": "function gameOver(diff)",
            "cn/game/index.html": "function filterGames()",
            "jp/util/crc/index.html": "function crc32(str)",
            "cn/util/caseconverter/index.html": "function convert(type)",
            "kor/util/teamgen/index.html": "function shuffle(array)",
            "cn/util/dice3d/index.html": "function rollDice()",
            "kor/util/dice3d/index.html": "function rollDice()",
            "util/qrcode/index.html": "function updateQR()",
        }
        for rel, marker in markers.items():
            with self.subTest(page=rel):
                self.assertIn(marker, (ROOT / rel).read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
