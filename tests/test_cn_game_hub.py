import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HUB = ROOT / "cn/game/index.html"


class ChineseGameHubTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = HUB.read_text(encoding="utf-8")

    def test_inventory_matches_repository_and_sitemap(self):
        repo = {p.parent.name for p in (ROOT / "cn/game").glob("*/index.html")}
        hub = re.findall(r'<a[^>]+href="([A-Za-z0-9]+/)"', self.html)
        sitemap = set(re.findall(r"https://emfls\.github\.io/cn/game/([A-Za-z0-9]+)/", (ROOT / "cn/sitemap.xml").read_text(encoding="utf-8")))
        self.assertEqual(len(repo), 25)
        hub_names = {item.rstrip('/') for item in hub}
        self.assertEqual(repo, hub_names)
        self.assertEqual(repo, {item.rstrip('/') for item in sitemap})
        self.assertEqual(len(hub), len(set(hub)))
        self.assertIn("LadderGame/", hub)

    def test_hub_contract_and_static_cards(self):
        self.assertIn('<html lang="zh-CN">', self.html)
        self.assertIn("<title>免费网页游戏 - 无需下载的在线小游戏 | QuickPlay</title>", self.html)
        self.assertEqual(len(re.findall(r"<h1\b", self.html)), 1)
        self.assertIn("免费网页游戏 · 无需下载，打开即玩", self.html)
        self.assertIn('for="searchInput">搜索游戏</label>', self.html)
        for category in ("全部", "经典", "益智·棋盘", "反应·短局", "动作·街机", "测验·知识"):
            self.assertIn(f'>{category}</button>', self.html)
        self.assertIn('id="noResultMessage"', self.html)
        self.assertIn('aria-live="polite"', self.html)
        self.assertNotIn("无需键盘", self.html)
        self.assertNotIn("user-select:none", self.html)
        self.assertIn(":focus-visible", self.html)
        self.assertNotIn('onclick="launchGame', self.html)
        self.assertEqual(len(re.findall(r'class="game-card"', self.html)), 25)
        self.assertEqual(len(re.findall(r'<li data-category="[^"]+"', self.html)), 25)
        self.assertIn("function filterGames()", self.html)

    def test_mbti_copy_is_trustworthy(self):
        self.assertIn("16类型性格小测", self.html)
        self.assertIn("独立自测", self.html)
        self.assertIn("不是官方 MBTI® 评估", self.html)
        self.assertNotIn("诊断", self.html)

    def test_schema_and_privacy_contract(self):
        schemas = [json.loads(item) for item in re.findall(r'<script type="application/ld\+json">(.*?)</script>', self.html, re.S)]
        self.assertEqual(len(schemas), 1)
        self.assertEqual(schemas[0].get("@type"), "CollectionPage")
        self.assertEqual(schemas[0].get("inLanguage"), "zh-CN")
        self.assertEqual(schemas[0].get("url"), "https://emfls.github.io/cn/game/")
        self.assertEqual(schemas[0].get("dateModified"), "2026-09-21")
        self.assertNotIn("FAQPage", self.html)
        self.assertIn('href="https://emfls.github.io/cn/game/"', self.html)
        self.assertIn('property="og:url" content="https://emfls.github.io/cn/game/"', self.html)
        self.assertIn("G-QP5Q67GE5B", self.html)
        self.assertIn("此目录页当前未加载广告", self.html)
        self.assertNotIn("pagead2.googlesyndication.com/pagead/js/adsbygoogle.js", self.html)
        self.assertNotIn("adsbygoogle.push", self.html)


if __name__ == "__main__":
    unittest.main()
