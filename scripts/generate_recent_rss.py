#!/usr/bin/env python3
"""Generate the site's recent-content RSS 2.0 feed."""

from dataclasses import dataclass
from datetime import date, datetime, time, timezone
from email.utils import format_datetime
from html.parser import HTMLParser
from pathlib import Path
import re
from typing import Optional
import unicodedata
import xml.etree.ElementTree as ET


BASE_URL = "https://emfls.github.io"
DATE_PATTERN = re.compile(
    r'["\'](?:dateModified|datePublished)["\']\s*:\s*["\'](\d{4}-\d{2}-\d{2})'
)
EXCLUDED_PATHS = {
    "404.html",
    "contact.html",
    "privacy.html",
    "terms.html",
    "kor/stockwiki/test/index.html",
}


@dataclass(frozen=True)
class FeedEntry:
    title: str
    description: str
    url: str
    modified: date


class PageMetadataParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title_parts = []
        self.in_title = False
        self.description = ""
        self.canonical = ""

    def handle_starttag(self, tag, attrs):
        values = {name.lower(): value or "" for name, value in attrs}
        if tag.lower() == "title":
            self.in_title = True
        elif tag.lower() == "meta" and values.get("name", "").lower() == "description":
            self.description = values.get("content", "").strip()
        elif tag.lower() == "link" and "canonical" in values.get("rel", "").lower().split():
            self.canonical = values.get("href", "").strip()

    def handle_endtag(self, tag):
        if tag.lower() == "title":
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title_parts.append(data)

    @property
    def title(self) -> str:
        return " ".join("".join(self.title_parts).split())


def is_excluded(relative_path: str) -> bool:
    normalized = unicodedata.normalize("NFC", relative_path)
    name = Path(normalized).name.lower()
    return (
        normalized in EXCLUDED_PATHS
        or name.startswith("google")
        or name.startswith("naver")
    )


def parse_entry(page: Path, root: Path) -> Optional[FeedEntry]:
    relative_path = unicodedata.normalize("NFC", page.relative_to(root).as_posix())
    if is_excluded(relative_path):
        return None

    source = page.read_text(encoding="utf-8")
    parser = PageMetadataParser()
    parser.feed(source)
    if not parser.title or not parser.canonical.startswith(f"{BASE_URL}/"):
        return None

    dates = []
    for value in DATE_PATTERN.findall(source):
        try:
            dates.append(date.fromisoformat(value))
        except ValueError:
            continue
    if not dates:
        return None

    return FeedEntry(
        title=parser.title,
        description=parser.description or parser.title,
        url=unicodedata.normalize("NFC", parser.canonical),
        modified=max(dates),
    )


def collect_entries(root: Path, limit: int = 500) -> list[FeedEntry]:
    entries = []
    seen_urls = set()
    for page in sorted(root.rglob("*.html")):
        entry = parse_entry(page, root)
        if entry is None or entry.url in seen_urls:
            continue
        seen_urls.add(entry.url)
        entries.append(entry)
    entries.sort(key=lambda entry: (-entry.modified.toordinal(), entry.url))
    return entries[:limit]


def rfc822(value: date) -> str:
    stamp = datetime.combine(value, time.min, tzinfo=timezone.utc)
    return format_datetime(stamp)


def build_feed(entries: list[FeedEntry]) -> bytes:
    rss = ET.Element("rss", {"version": "2.0"})
    channel = ET.SubElement(rss, "channel")
    ET.SubElement(channel, "title").text = "emfls 최근 업데이트"
    ET.SubElement(channel, "link").text = f"{BASE_URL}/"
    ET.SubElement(channel, "description").text = "무료 브라우저 도구와 최신 정보 가이드 업데이트"
    ET.SubElement(channel, "language").text = "ko-KR"
    if entries:
        ET.SubElement(channel, "lastBuildDate").text = rfc822(max(entry.modified for entry in entries))

    for entry in entries:
        item = ET.SubElement(channel, "item")
        ET.SubElement(item, "title").text = entry.title
        ET.SubElement(item, "link").text = entry.url
        ET.SubElement(item, "guid", {"isPermaLink": "true"}).text = entry.url
        ET.SubElement(item, "pubDate").text = rfc822(entry.modified)
        ET.SubElement(item, "description").text = entry.description

    ET.indent(rss, space="  ")
    return ET.tostring(rss, encoding="utf-8", xml_declaration=True)


def write_feed(root: Path, output: Path, limit: int = 500) -> int:
    entries = collect_entries(root, limit=limit)
    output.write_bytes(build_feed(entries))
    return len(entries)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    count = write_feed(root, root / "feed.xml")
    print(f"entries={count}")


if __name__ == "__main__":
    main()
