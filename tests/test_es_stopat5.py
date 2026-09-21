import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "es/game/STOPat5/index.html"


class SpanishStopAt5Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")

    def test_search_identity_and_accessibility(self):
        self.assertIn("Detén el cronómetro en 5 segundos – Juego de precisión online", self.html)
        self.assertEqual(len(re.findall(r"<h1\b", self.html)), 1)
        self.assertIn("Detén el cronómetro en 5 segundos", self.html)
        self.assertIn('lang="es"', self.html)
        self.assertIn('href="https://emfls.github.io/es/game/STOPat5/"', self.html)
        self.assertIn('property="og:url" content="https://emfls.github.io/es/game/STOPat5/"', self.html)
        self.assertIn('id="result" aria-live="polite"', self.html)
        self.assertIn('for="startBtn"', self.html)
        self.assertNotIn("FAQPage", self.html)
        self.assertNotIn("Date.now()", self.html)

    def test_timing_contract_and_trust_copy(self):
        self.assertIn("const TARGET_SECONDS = 5", self.html)
        for value in ("0.5", "0.3", "0.1", "0.05", "0.02", "0.01"):
            self.assertIn(value, self.html)
        self.assertIn("performance.now()", self.html)
        self.assertIn("absError <= tolerance", self.html)
        self.assertIn("antes", self.html)
        self.assertIn("tarde", self.html)
        self.assertIn("exacto", self.html)
        self.assertIn("El dispositivo y la latencia de entrada pueden influir", self.html)
        self.assertNotIn("precisión certificada", self.html.lower())
        self.assertNotIn("leaderboard", self.html.lower())

    def test_personal_best_replay_and_navigation_contract(self):
        self.assertIn('emfls:es:stopat5:v1', self.html)
        for marker in ("safeReadRecord", "safeWriteRecord", "resetRecord", "restartGame"):
            self.assertIn(marker, self.html)
        self.assertIn("localStorage.removeItem(STORAGE_KEY)", self.html)
        self.assertIn("Reintentar", self.html)
        self.assertIn('href="/es/game/"', self.html)
        for game in ("SpeedTap", "QuickDraw", "NumberHunt"):
            self.assertIn(f'href="/es/game/{game}/"', self.html)
        self.assertIn("https://emfls.github.io/es/game/STOPat5/", self.html)

    def test_schema_privacy_and_related_links(self):
        schemas = [json.loads(item) for item in re.findall(r'<script type="application/ld\+json">(.*?)</script>', self.html, re.S)]
        games = [item for item in schemas if item.get("@type") == "VideoGame"]
        self.assertEqual(len(games), 1)
        game = games[0]
        self.assertEqual(game["url"], "https://emfls.github.io/es/game/STOPat5/")
        self.assertEqual(game["inLanguage"], "es")
        self.assertEqual(game["gamePlatform"], "Web Browser")
        self.assertEqual(game["playMode"], "SinglePlayer")
        self.assertTrue(game["isAccessibleForFree"])
        self.assertEqual(game["dateModified"], "2026-09-21")
        self.assertIn("Los récords se guardan localmente en este dispositivo", self.html)
        self.assertIn("Google Analytics puede recibir datos generales", self.html)
        self.assertIn("Los anuncios están desactivados actualmente", self.html)
        self.assertIn("G-QP5Q67GE5B", self.html)
        self.assertNotIn("pagead2.googlesyndication.com/pagead/js/adsbygoogle.js", self.html)
        self.assertNotIn("adsbygoogle.push", self.html)


if __name__ == "__main__":
    unittest.main()
