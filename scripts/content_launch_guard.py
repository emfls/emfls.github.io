#!/usr/bin/env python3
"""Fail-closed validation for automated content launch diffs."""

import argparse
import json
import re
import subprocess
from pathlib import Path


MEASUREMENT_WORKFLOW_ALLOWLIST = {".github/workflows/ga4-collection.yml"}
PREP_ONLY_HTML_ALLOWLIST = {
    "kor/report/parenting/parental-leave-application-form-2026.html",
}
PREP_ONLY_DISCOVERY_PATHS = {
    "data/content-launch-manifest.json",
}
APPROVED_PROTECTED_WINNER_TRANSITIONS = {
    "kor/report/camp/pyeongtaek.html": {
        ("4d95593169e466447ee355429d2822764ca7e1a5", "b4fc13119f1e8cd01d78805d06ee981ac6834236"),
    },
}


def _read(path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def _url_to_path(url):
    return str(url or "").split("?", 1)[0].lstrip("/")


def _changed_tuple(item):
    if not isinstance(item, tuple):
        return "M", item, None, None
    if len(item) == 2:
        return item[0], item[1], None, None
    if len(item) == 4:
        return item
    raise ValueError("changed path entries must contain status/path or status/path/blob transition")


def _has_prep_only_contract(root, path):
    candidate = Path(root) / path
    if not candidate.is_file():
        return False
    html = candidate.read_text(encoding="utf-8")
    noindex_follow = re.search(
        r'<meta\b(?=[^>]*\bname=["\']robots["\'])(?=[^>]*\bcontent=["\']noindex\s*,\s*follow["\'])[^>]*>',
        html,
        re.I,
    )
    return bool(noindex_follow and "PREP ONLY / NOT PUBLISHED" in html)


def _is_publication_wiring_path(path):
    normalized = str(path).lower()
    filename = Path(normalized).name
    return (
        normalized in PREP_ONLY_DISCOVERY_PATHS
        or filename == "index.html"
        or ("sitemap" in filename and filename.endswith(".xml"))
        or (filename.startswith("content-index") and filename.endswith(".json"))
        or (filename.startswith("home-feed") and filename.endswith(".json"))
        or filename in {"feed.xml", "rss.xml", "atom.xml"}
        or "indexnow" in normalized
    )


def validate_launch(root, manifest, changed_paths):
    root = Path(root)
    changed = [_changed_tuple(row) for row in changed_paths]
    errors = set()
    changed_names = {row[1] for row in changed}
    added_html = {row[1] for row in changed if row[0] == "A" and row[1].endswith(".html")}
    expected_html = set(manifest.get("contentPaths") or [_url_to_path(url) for url in manifest.get("urls") or []])
    # A manifest can change for launch bookkeeping without adding content.
    # Only a newly added HTML file starts content-launch validation; when HTML
    # is added, it must still match the manifest exactly. One exact review-only
    # candidate may bypass launch wiring only while its explicit noindex/PREP
    # contract is present and no discovery wiring changed; all other added HTML
    # remains launch-gated.
    prep_only_added = added_html == PREP_ONLY_HTML_ALLOWLIST
    prep_wiring_changed = any(_is_publication_wiring_path(path) for path in changed_names)
    prep_contract_present = prep_only_added and _has_prep_only_contract(root, next(iter(added_html)))
    prep_only_valid = prep_contract_present and not prep_wiring_changed
    if prep_only_added and not prep_contract_present:
        errors.add("PREP_ONLY_CONTENT_CONTRACT_MISSING")
    if prep_only_added and prep_wiring_changed:
        errors.add("PREP_ONLY_PUBLICATION_WIRING_CHANGED")
    launch_changed = bool(added_html) and not prep_only_valid
    if launch_changed and added_html != expected_html:
        errors.add("MANIFEST_DIFF_MISMATCH")
    if manifest.get("deletions") or any(row[0].startswith("D") or row[0].startswith("R") for row in changed):
        errors.add("DELETION_NOT_ALLOWED")

    ctr = _read(root / "data/experiments.json", {"experiments": []})
    protected_experiments = {_url_to_path(row.get("url")) for row in ctr.get("experiments") or [] if row.get("status") == "OBSERVING"}
    revenue = _read(root / "data/revenue-opportunities.json", {})
    protected_winners = {_url_to_path(row.get("url")) for row in revenue.get("protectedWinners") or []}
    if changed_names & protected_experiments:
        errors.add("PROTECTED_EXPERIMENT_CHANGED")
    for path in changed_names & protected_winners:
        path_changes = [row for row in changed if row[1] == path]
        approved = APPROVED_PROTECTED_WINNER_TRANSITIONS.get(path, set())
        if (
            len(path_changes) != 1
            or path_changes[0][0] != "M"
            or (path_changes[0][2], path_changes[0][3]) not in approved
        ):
            errors.add("PROTECTED_WINNER_CHANGED")
    if any(
        path not in MEASUREMENT_WORKFLOW_ALLOWLIST
        and re.search(r"(^|/)(ads?|adsense|ga4|analytics)([._/-]|$)", path, re.I)
        for path in changed_names
    ):
        errors.add("MONETIZATION_OR_ANALYTICS_CHANGED")

    if not launch_changed:
        return sorted(errors)

    audit = _read(root / "data/site-audit.json", {"pages": []})
    manifest_urls = set(manifest.get("urls") or [])
    existing_rows = [
        row
        for row in audit.get("pages") or []
        if row.get("path") not in expected_html and row.get("url") not in manifest_urls
    ]
    existing_titles = {row.get("title") for row in existing_rows if row.get("title")}
    existing_h1 = {row.get("h1") for row in existing_rows if row.get("h1")}
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
    result = subprocess.run(["git", "diff", "--name-status", base_ref, "HEAD"], cwd=str(root), text=True, capture_output=True, check=True)
    rows = []
    for line in result.stdout.splitlines():
        parts = line.split("\t")
        if len(parts) >= 2:
            status, path = parts[0], parts[-1]
            if status == "M" and path in APPROVED_PROTECTED_WINNER_TRANSITIONS:
                before = subprocess.run(
                    ["git", "rev-parse", f"{base_ref}:{path}"],
                    cwd=str(root), text=True, capture_output=True, check=True,
                ).stdout.strip()
                after = subprocess.run(
                    ["git", "rev-parse", f"HEAD:{path}"],
                    cwd=str(root), text=True, capture_output=True, check=True,
                ).stdout.strip()
                rows.append((status, path, before, after))
            else:
                rows.append((status, path))
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
