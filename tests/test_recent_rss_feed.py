from pathlib import Path
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]


def test_published_feed_has_valid_unique_recent_items():
    feed = ROOT / "feed.xml"
    assert feed.exists()

    root = ET.parse(feed).getroot()
    items = root.findall("./channel/item")
    assert root.tag == "rss"
    assert root.attrib == {"version": "2.0"}
    assert root.findtext("./channel/link") == "https://emfls.github.io/"
    assert len(items) == 500

    links = [item.findtext("link") for item in items]
    assert len(links) == len(set(links))
    assert all(link.startswith("https://emfls.github.io/") for link in links)
    for item in items:
        assert item.findtext("title")
        assert item.findtext("guid") == item.findtext("link")
        assert item.find("guid").attrib == {"isPermaLink": "true"}
        assert item.findtext("pubDate")
        assert item.findtext("description")


def test_feed_is_discoverable_from_robots_and_homepage():
    robots = (ROOT / "robots.txt").read_text(encoding="utf-8")
    homepage = (ROOT / "index.html").read_text(encoding="utf-8")

    assert "Sitemap: https://emfls.github.io/sitemap.xml" in robots
    assert "Sitemap: https://emfls.github.io/feed.xml" in robots
    assert 'rel="alternate" type="application/rss+xml" href="https://emfls.github.io/feed.xml"' in homepage
