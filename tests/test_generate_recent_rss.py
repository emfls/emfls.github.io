from datetime import date
from pathlib import Path
import xml.etree.ElementTree as ET

from scripts.generate_recent_rss import build_feed, collect_entries


def write_page(root: Path, relative: str, *, title: str, description: str, modified: str) -> None:
    page = root / relative
    page.parent.mkdir(parents=True, exist_ok=True)
    public_path = relative.removesuffix("index.html") if relative.endswith("index.html") else relative
    page.write_text(
        f"""<!doctype html><html><head>
        <title>{title}</title>
        <meta name="description" content="{description}">
        <link rel="canonical" href="https://emfls.github.io/{public_path}">
        <script type="application/ld+json">{{"dateModified":"{modified}"}}</script>
        </head><body></body></html>""",
        encoding="utf-8",
    )


def test_collect_entries_excludes_operations_and_sorts_by_date_then_url(tmp_path):
    write_page(tmp_path, "older.html", title="Older", description="Old", modified="2026-08-10")
    write_page(tmp_path, "z-new.html", title="Z New", description="Latest", modified="2026-08-11")
    write_page(tmp_path, "a-new.html", title="A New", description="Latest", modified="2026-08-11")
    write_page(tmp_path, "privacy.html", title="Privacy", description="Policy", modified="2026-08-12")

    entries = collect_entries(tmp_path, limit=2)

    assert [entry.url for entry in entries] == [
        "https://emfls.github.io/a-new.html",
        "https://emfls.github.io/z-new.html",
    ]
    assert all(entry.modified == date(2026, 8, 11) for entry in entries)


def test_build_feed_emits_valid_escaped_rss(tmp_path):
    write_page(
        tmp_path,
        "guide.html",
        title="Travel & Money",
        description="Save <more> & travel",
        modified="2026-08-12",
    )
    entry = collect_entries(tmp_path, limit=1)[0]

    document = build_feed([entry])
    root = ET.fromstring(document)
    item = root.find("./channel/item")

    assert root.tag == "rss"
    assert root.attrib == {"version": "2.0"}
    assert item.findtext("title") == "Travel & Money"
    assert item.findtext("description") == "Save <more> & travel"
    assert item.findtext("link") == "https://emfls.github.io/guide.html"
    assert item.find("guid").attrib == {"isPermaLink": "true"}
    assert item.findtext("pubDate") == "Wed, 12 Aug 2026 00:00:00 +0000"
