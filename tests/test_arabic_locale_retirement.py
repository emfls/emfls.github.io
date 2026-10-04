import json
import xml.etree.ElementTree as ET
from pathlib import Path

from scripts.generate_recent_rss import collect_entries
from scripts.sitemap_audit import audit_local_sitemaps, render_root_index
from scripts.content_launch_guard import (
    APPROVED_ARABIC_RETIREMENT_URLS,
    _approved_arabic_retirement_paths,
)


ROOT = Path(__file__).resolve().parents[1]
SITEMAP_NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
CURRENT_DATA_FILES = (
    "data/site-audit.json",
    "data/page-scores.json",
    "data/page-performance.json",
    "data/content-metadata.json",
    "data/content-priority.json",
    "data/content-priority.json",
    "data/revenue-opportunities.json",
    "data/internal-link-recommendations.json",
    "data/cannibalization-report.json",
    "data/sitemap-audit.json",
    "data/seo-qa-baseline.json",
)


def _strings(value):
    if isinstance(value, dict):
        for key, item in value.items():
            yield from _strings(key)
            yield from _strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from _strings(item)
    elif isinstance(value, str):
        yield value


def _contains_arabic_path(value):
    return "/ae/" in value or value.startswith("ae/") or ":ae/" in value


def test_arabic_public_tree_is_retired():
    assert not (ROOT / "ae").exists()


def test_retirement_override_records_only_the_user_approved_arabic_winners():
    record = json.loads((ROOT / "data/locale-retirement-overrides.json").read_text(encoding="utf-8"))

    assert record["locale"] == "ae"
    assert record["decision"] == "RETIRED"
    assert record["status"] == "USER_APPROVED_LOCALE_RETIREMENT_OVERRIDE"
    assert record["approved"] is True
    assert record["preserveRawMeasurements"] is True
    assert set(record["urls"]) == APPROVED_ARABIC_RETIREMENT_URLS
    assert record["evidence"]["ga4"] == {
        "period": "2026-09-05..2026-10-02",
        "views": 13,
        "users": 12,
        "engagementSeconds": 256,
        "totalAdRevenue": 0.015871,
    }
    assert record["evidence"]["gsc"]["status"] == "NO_ROW"
    assert _approved_arabic_retirement_paths(ROOT) == {
        "ae/util/index.html",
        "ae/util/dice3d/index.html",
        "ae/util/text-cleaner/index.html",
        "ae/util/text-shuffle-sort/index.html",
    }


def test_local_sitemaps_and_rss_contain_no_arabic_urls():
    sitemap_result = audit_local_sitemaps(ROOT)
    assert "/ae/sitemap.xml" not in sitemap_result["leaf_sitemap_paths"]
    assert "https://emfls.github.io/ae/sitemap.xml" not in render_root_index(ROOT)

    for sitemap in ROOT.rglob("sitemap.xml"):
        if any(part.startswith(".") for part in sitemap.relative_to(ROOT).parts):
            continue
        xml_root = ET.parse(sitemap).getroot()
        urls = [
            (loc.text or "").strip()
            for loc in xml_root.findall(".//sm:loc", SITEMAP_NS)
        ]
        assert not any("/ae/" in url for url in urls), sitemap.relative_to(ROOT)

    entries = collect_entries(ROOT)
    assert not any(entry.url.startswith("https://emfls.github.io/ae/") for entry in entries)


def test_current_derived_inventories_contain_no_arabic_urls():
    for relative in CURRENT_DATA_FILES:
        data = json.loads((ROOT / relative).read_text(encoding="utf-8"))
        assert not any(_contains_arabic_path(value) for value in _strings(data)), relative


def test_active_ga4_manifests_and_generators_have_no_arabic_locale():
    manifest_paths = (
        "tests/fifty_ga4_manifest.py",
        "tests/third_hundred_ga4_manifest.py",
        "tests/fourth_hundred_ga4_manifest.py",
        "tests/fifth_hundred_ga4_manifest.py",
        "tests/sixth_hundred_ga4_manifest.py",
    )
    for relative in manifest_paths:
        assert "/ae/" not in (ROOT / relative).read_text(encoding="utf-8"), relative

    seo_audit = (ROOT / "scripts/seo_audit.py").read_text(encoding="utf-8")
    assert '"ae"' not in seo_audit
    assert "العربية" not in seo_audit

    ga4_generator = (ROOT / "scripts/improve_fifty_ga4_pages.py").read_text(encoding="utf-8")
    assert '"ae"' not in ga4_generator
    assert "النطاق والقيود" not in ga4_generator

    breadcrumb_generator = (ROOT / "scripts/apply_breadcrumb_metadata.py").read_text(encoding="utf-8")
    assert "العربية" not in breadcrumb_generator
    assert "/ae/" not in (ROOT / "reports/related-links-pilot.md").read_text(encoding="utf-8")


def test_raw_measurement_history_is_preserved():
    for relative in (
        "data/performance/ga4-latest.json",
        "data/performance/gsc-latest.json",
        "data/performance/2026-08-01.json",
    ):
        assert (ROOT / relative).is_file()
