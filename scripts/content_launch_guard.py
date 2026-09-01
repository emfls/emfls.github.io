#!/usr/bin/env python3
"""Fail-closed validation for automated content launch diffs."""

import argparse
import json
import re
import subprocess
from pathlib import Path


def _read(path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def _url_to_path(url):
    return str(url or "").split("?", 1)[0].lstrip("/")


def _changed_tuple(item):
    return item if isinstance(item, tuple) else ("M", item)


def validate_launch(root, manifest, changed_paths):
    root = Path(root)
    changed = [_changed_tuple(row) for row in changed_paths]
    errors = set()
    added_html = {path for status, path in changed if status == "A" and path.endswith(".html")}
    expected_html = set(manifest.get("contentPaths") or [_url_to_path(url) for url in manifest.get("urls") or []])
    if len(added_html) > 5:
        errors.add("NEW_CONTENT_LIMIT_EXCEEDED")
    if added_html != expected_html:
        errors.add("MANIFEST_DIFF_MISMATCH")
    if manifest.get("deletions") or any(status.startswith("D") or status.startswith("R") for status, _ in changed):
        errors.add("DELETION_NOT_ALLOWED")

    ctr = _read(root / "data/experiments.json", {"experiments": []})
    protected_experiments = {_url_to_path(row.get("url")) for row in ctr.get("experiments") or [] if row.get("status") == "OBSERVING"}
    revenue = _read(root / "data/revenue-opportunities.json", {})
    protected_winners = {_url_to_path(row.get("url")) for row in revenue.get("protectedWinners") or []}
    changed_names = {path for _, path in changed}
    if changed_names & protected_experiments:
        errors.add("PROTECTED_EXPERIMENT_CHANGED")
    if changed_names & protected_winners:
        errors.add("PROTECTED_WINNER_CHANGED")
    if any(re.search(r"(^|/)(ads?|adsense|ga4|analytics)([._/-]|$)", path, re.I) for path in changed_names):
        errors.add("MONETIZATION_OR_ANALYTICS_CHANGED")

    audit = _read(root / "data/site-audit.json", {"pages": []})
    existing_titles = {row.get("title") for row in audit.get("pages") or [] if row.get("title")}
    existing_h1 = {row.get("h1") for row in audit.get("pages") or [] if row.get("h1")}
    titles, headings, canonicals = set(), set(), set()
    sitemap_text = "\n".join((root / path).read_text(encoding="utf-8") for path in manifest.get("sitemapPaths") or [] if (root / path).exists())
    hub_text = "\n".join((root / path).read_text(encoding="utf-8") for path in manifest.get("hubPaths") or [] if (root / path).exists())
    for url, relative in zip(manifest.get("urls") or [], manifest.get("contentPaths") or []):
        path = root / relative
        if not path.exists():
            errors.add("CONTENT_FILE_MISSING")
            continue
        html = path.read_text(encoding="utf-8")
        title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
        h1_match = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.I | re.S)
        canonical_match = re.search(r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)', html, re.I)
        title = re.sub(r"<[^>]+>", "", title_match.group(1)).strip() if title_match else None
        h1 = re.sub(r"<[^>]+>", "", h1_match.group(1)).strip() if h1_match else None
        canonical = canonical_match.group(1) if canonical_match else None
        expected_canonical = "https://emfls.github.io" + url
        if not title or title in titles or title in existing_titles:
            errors.add("TITLE_MISSING_OR_DUPLICATE")
        if not h1 or h1 in headings or h1 in existing_h1:
            errors.add("H1_MISSING_OR_DUPLICATE")
        if canonical != expected_canonical or canonical in canonicals:
            errors.add("CANONICAL_MISMATCH")
        titles.add(title); headings.add(h1); canonicals.add(canonical)
        if not re.search(r'<meta[^>]+name=["\']viewport["\']', html, re.I):
            errors.add("VIEWPORT_MISSING")
        if 'application/ld+json' not in html:
            errors.add("JSON_LD_MISSING")
        if expected_canonical not in sitemap_text:
            errors.add("SITEMAP_ENTRY_MISSING")
        if (f'href="{url}"' not in hub_text) and (f"href='{url}'" not in hub_text):
            errors.add("HUB_LINK_MISSING")
    return sorted(errors)


def _git_changes(root, base_ref):
    result = subprocess.run(["git", "diff", "--name-status", base_ref], cwd=str(root), text=True, capture_output=True, check=True)
    rows = []
    for line in result.stdout.splitlines():
        parts = line.split("\t")
        if len(parts) >= 2:
            rows.append((parts[0], parts[-1]))
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--manifest", type=Path, default=Path("data/content-launch-manifest.json"))
    parser.add_argument("--base-ref", default="HEAD")
    args = parser.parse_args()
    manifest = _read(args.root / args.manifest, {})
    errors = validate_launch(args.root, manifest, _git_changes(args.root, args.base_ref))
    print(json.dumps({"status": "FAIL" if errors else "PASS", "errors": errors}))
    raise SystemExit(1 if errors else 0)


if __name__ == "__main__":
    main()
