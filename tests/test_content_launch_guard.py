import json
from pathlib import Path

from scripts.content_launch_guard import validate_launch


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def setup_data(root):
    write_json(root / "data/experiments.json", {"experiments": [{"url": "/kor/report/camp/nonsan.html", "status": "OBSERVING"}]})
    write_json(root / "data/revenue-opportunities.json", {"protectedWinners": [{"url": "/kor/report/camp/namyangju.html"}]})
    write_json(root / "data/site-audit.json", {"pages": []})


def manifest(urls):
    return {"urls": urls, "contentPaths": [u.lstrip("/") for u in urls], "sitemapPaths": ["kor/report/camp/sitemap.xml"], "hubPaths": ["kor/report/camp/index.html"]}


def test_guard_rejects_fourth_page_and_deletion(tmp_path):
    setup_data(tmp_path)
    changed = [("A", f"kor/report/camp/n-{i}.html") for i in range(4)]
    errors = validate_launch(tmp_path, manifest([f"/kor/report/camp/n-{i}.html" for i in range(4)]), changed)
    assert "NEW_CONTENT_DAILY_LIMIT_EXCEEDED" in errors
    assert "DELETION_NOT_ALLOWED" in validate_launch(tmp_path, {**manifest([]), "deletions": ["old.html"]}, [("D", "old.html")])


def test_guard_rejects_protected_pages_and_monetization_code(tmp_path):
    setup_data(tmp_path)
    changed = [("M", "kor/report/camp/nonsan.html"), ("M", "kor/report/camp/namyangju.html"), ("M", "assets/js/ga4.js")]
    errors = validate_launch(tmp_path, manifest([]), changed)
    assert {"PROTECTED_EXPERIMENT_CHANGED", "PROTECTED_WINNER_CHANGED", "MONETIZATION_OR_ANALYTICS_CHANGED"} <= set(errors)


def test_new_page_requires_canonical_sitemap_hub_and_viewport(tmp_path):
    setup_data(tmp_path)
    page = tmp_path / "kor/report/camp/new.html"
    page.parent.mkdir(parents=True)
    page.write_text('<html><head><title>New</title><link rel="canonical" href="https://emfls.github.io/wrong.html"></head><body><h1>New</h1></body></html>')
    (tmp_path / "kor/report/camp/sitemap.xml").write_text("<urlset></urlset>")
    (tmp_path / "kor/report/camp/index.html").write_text("<html></html>")
    errors = validate_launch(tmp_path, manifest(["/kor/report/camp/new.html"]), [("A", "kor/report/camp/new.html")])
    assert {"CANONICAL_MISMATCH", "SITEMAP_ENTRY_MISSING", "HUB_LINK_MISSING", "VIEWPORT_MISSING"} <= set(errors)


def test_no_publication_manifest_passes_without_html_changes(tmp_path):
    setup_data(tmp_path)
    assert validate_launch(tmp_path, manifest([]), [("M", "reports/daily-revenue-growth.md")]) == []
