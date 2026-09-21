import json
import re
import subprocess
import unittest
import xml.etree.ElementTree as ET
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

    def test_generated_rss_parity(self):
        feed = ET.parse(ROOT / "feed.xml").getroot()
        canonical = "https://emfls.github.io/es/game/STOPat5/"
        items = [item for item in feed.findall("./channel/item") if item.findtext("link") == canonical]
        self.assertEqual(len(items), 1)
        item = items[0]
        title = re.search(r"<title>(.*?)</title>", self.html, re.S).group(1).strip()
        description = re.search(r'<meta name="description" content="([^"]+)"', self.html).group(1)
        self.assertEqual(item.findtext("title"), title)
        self.assertEqual(item.findtext("description"), description)
        self.assertEqual(item.findtext("guid"), canonical)
        self.assertEqual(item.findtext("pubDate"), "Mon, 21 Sep 2026 00:00:00 +0000")

    def test_actual_js_behavioral_contract(self):
        script = re.search(r"const TARGET_SECONDS = 5;.*?/\* TESTABLE_HELPERS_END \*/", self.html, re.S).group(0)
        script = "const TARGET_SECONDS = 5; const TOLERANCES={1:.5,2:.3,3:.1,4:.05,5:.02};" + re.search(r"/\* TESTABLE_HELPERS_START \*/(.*?)/\* TESTABLE_HELPERS_END \*/", script, re.S).group(1)
        harness = script + r'''
const checks = [];
checks.push(JSON.stringify([toleranceByLevel(1), toleranceByLevel(2), toleranceByLevel(3), toleranceByLevel(4), toleranceByLevel(5), toleranceByLevel(6), toleranceByLevel(20)]) === JSON.stringify([.5,.3,.1,.05,.02,.01,.01]));
checks.push(classifyAttempt(5.5, 1).success === true && classifyAttempt(5.5001, 1).success === false);
checks.push(classifyAttempt(4.9, 1).direction === "antes" && classifyAttempt(5.1, 1).direction === "tarde" && classifyAttempt(5, 1).direction === "exacto");
checks.push(Math.abs(classifyAttempt(4.9, 1).absError - .1) < 1e-9 && Math.abs(classifyAttempt(5.1, 1).absError - .1) < 1e-9);
checks.push(nextBestRecord({error:.05,level:3}, {absError:.08,success:false}, 4).error === .05);
checks.push(nextBestRecord({error:.05,level:3}, {absError:.02,success:false}, 4).error === .02);
checks.push(nextBestRecord({error:.05,level:1}, {absError:.02,success:true}, 1).level === 2);
checks.push(nextBestRecord({error:.05,level:5}, {absError:.08,success:true}, 1).level === 5);
checks.push(JSON.stringify(normalizeRecord(null)) === JSON.stringify({error:null,level:0}));
checks.push(JSON.stringify(normalizeRecord('{bad')) === JSON.stringify({error:null,level:0}));
checks.push(JSON.stringify(normalizeRecord('{"error":"x","level":"y"}')) === JSON.stringify({error:null,level:0}));
if (!checks.every(Boolean)) process.exit(1);
'''
        completed = subprocess.run(["node", "-e", harness], capture_output=True, text=True)
        self.assertEqual(completed.returncode, 0, completed.stderr)


if __name__ == "__main__":
    unittest.main()
