import json
import re
import subprocess
import unittest
from pathlib import Path
from html.parser import HTMLParser


ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "seouljjimjilbangcuceon": "서울 찜질방 추천, 요일·시설별 운영과 요금 비교",
    "seoulaiwagabolmanhangos": "서울 아이와 가볼 만한 곳, 날짜·예약별 선택 가이드",
}


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            href = dict(attrs).get("href")
            if href:
                self.hrefs.append(href)


class SeoulPublicationArtifactTests(unittest.TestCase):
    def test_each_page_has_unique_canonical_schema_and_navigation(self):
        hub = (ROOT / "kor/column/index.html").read_text(encoding="utf-8")
        for slug, expected_title in PAGES.items():
            with self.subTest(page=slug):
                path = ROOT / "kor/column" / slug / "index.html"
                html = path.read_text(encoding="utf-8")
                canonical = f"https://emfls.github.io/kor/column/{slug}/"
                self.assertEqual(html.count(f'<link rel="canonical" href="{canonical}">'), 1)
                self.assertEqual(re.findall(r"<h1\b", html, flags=re.I).__len__(), 1)
                self.assertIn(f"<h1>{expected_title}</h1>", html)
                self.assertIn('"@type":"BlogPosting"', html)
                self.assertIn('"author":{"@id":"https://emfls.github.io/#organization"}', html)
                self.assertRegex(html, r'id="(?:selector|family)-result"')
                self.assertIn("/assets/js/seoul-day-selectors.js", html)
                self.assertIn(f'href="/kor/column/{slug}/"', hub)
                self.assertEqual(
                    (ROOT / "kor/column/sitemap.xml").read_text(encoding="utf-8").count(canonical),
                    1,
                )
                self.assertNotIn(canonical, (ROOT / "kor/sitemap.xml").read_text(encoding="utf-8"))
                links = Links()
                links.feed(html)
                for href in links.hrefs:
                    if not href.startswith("/"):
                        continue
                    target = ROOT / href.lstrip("/")
                    if href.endswith("/"):
                        target /= "index.html"
                    self.assertTrue(target.is_file(), f"broken internal link in {slug}: {href}")

    def test_selector_runtime_cases(self):
        result = subprocess.run(
            ["node", "--test", str(ROOT / "tests/test_seoul_day_selectors.js")],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, msg=result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
