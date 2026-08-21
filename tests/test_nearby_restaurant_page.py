import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/travel/근처-맛집-추천.html"
EXPECTED_URL = "https://emfls.github.io/kor/report/travel/근처-맛집-추천.html"


class NearbyRestaurantPageTest(unittest.TestCase):
    def test_social_and_canonical_urls_use_the_same_public_url(self):
        html = PAGE.read_text(encoding="utf-8")
        canonical = re.search(r'<link rel="canonical" href="([^"]+)">', html)
        og_url = re.search(r'<meta property="og:url" content="([^"]+)">', html)

        self.assertIsNotNone(canonical)
        self.assertIsNotNone(og_url)
        self.assertEqual(canonical.group(1), EXPECTED_URL)
        self.assertEqual(og_url.group(1), EXPECTED_URL)


if __name__ == "__main__":
    unittest.main()
