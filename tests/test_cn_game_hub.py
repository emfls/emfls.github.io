import json
import re
import unittest
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HUB = ROOT / "cn/game/index.html"


class CardParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.cards=[]; self.stack=[]; self.current=None; self.text=[]; self.categories_index=None; self.ul_index=None
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if tag == "div" and "categories" in attrs.get("class", "").split(): self.categories_index=len(self.stack)
        if tag == "ul" and self.ul_index is None: self.ul_index=len(self.stack)
        if tag == "li" and "data-category" in attrs: self.current={"category":attrs["data-category"],"anchor":0,"classes":set(),"text":[]}; self.cards.append(self.current)
        if self.current is not None:
            if tag == "a" and "game-card" in attrs.get("class", "").split(): self.current["anchor"]+=1
            if tag == "span": self.current["classes"].add(attrs.get("class", ""))
            self.stack.append(tag)
    def handle_endtag(self, tag):
        if self.stack and self.stack[-1] == tag: self.stack.pop()
    def handle_data(self, data):
        if self.current is not None: self.current["text"].append(data.strip())


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

    def test_structured_cards_and_head_copy(self):
        parser = CardParser(); parser.feed(self.html)
        self.assertIsNotNone(parser.categories_index)
        self.assertIsNotNone(parser.ul_index)
        categories_start = self.html.index('<div class="categories"')
        categories_end = self.html.index("</div>", categories_start)
        ul_start = self.html.index("<ul>", categories_start)
        self.assertLess(categories_start, categories_end)
        self.assertLess(categories_end, ul_start)
        self.assertNotIn("<ul>", self.html[categories_start:categories_end])
        self.assertEqual(len(parser.cards), 25)
        for card in parser.cards:
            self.assertEqual(card["anchor"], 1)
            self.assertEqual({"game-title", "game-description", "game-category", "game-cta"}, card["classes"])
            self.assertIn(card["category"], card["text"])
        self.assertIn("精选 25 款免费网页游戏", self.html)
        self.assertIn('property="og:title" content="免费网页游戏 - 无需下载的在线小游戏 | QuickPlay"', self.html)
        self.assertIn("浏览 25 款免费在线小游戏", self.html)

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

    def test_generated_rss_matches_hub_metadata(self):
        feed = ET.parse(ROOT / "feed.xml").getroot()
        items = [item for item in feed.findall("./channel/item") if item.findtext("link") == "https://emfls.github.io/cn/game/"]
        self.assertEqual(len(items), 1)
        item = items[0]
        title = re.search(r"<title>(.*?)</title>", self.html, re.S).group(1).strip()
        description = re.search(r'<meta name="description" content="([^"]+)"', self.html).group(1)
        self.assertEqual(item.findtext("title"), title)
        self.assertEqual(item.findtext("description"), description)
        self.assertEqual(item.findtext("guid"), "https://emfls.github.io/cn/game/")
        self.assertEqual(item.findtext("pubDate"), "Mon, 21 Sep 2026 00:00:00 +0000")


if __name__ == "__main__":
    unittest.main()
