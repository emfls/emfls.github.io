import re
import unittest
from pathlib import Path


class LadderGameCanonicalTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        page = Path("game/LadderGame/index.html").read_text(encoding="utf-8")
        match = re.search(
            r'<link\s+rel="canonical"\s+href="([^"]+)"\s*/?>',
            page,
        )
        cls.assertIsNotNone(match, "LadderGame page must declare a canonical URL")
        cls.canonical = match.group(1)

    def test_canonical_matches_public_game_directory(self):
        self.assertEqual(
            self.canonical,
            "https://emfls.github.io/game/LadderGame/",
        )


if __name__ == "__main__":
    unittest.main()
