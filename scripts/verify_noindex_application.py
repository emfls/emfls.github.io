#!/usr/bin/env python3
"""Verify noindex coverage, sitemap exclusion, and protected scopes for the dated candidate CSV."""
from __future__ import annotations

import argparse
import csv
import json
import re
import subprocess
import sys
import urllib.parse
import xml.etree.ElementTree as ET
from pathlib import Path

ROBOTS = re.compile(
    r'<meta\b(?=[^>]*\bname\s*=\s*["\']robots["\'])'
    r'(?=[^>]*\bcontent\s*=\s*["\']([^"\']*)["\'])[^>]*>',
    re.IGNORECASE,
)
SITEMAP_NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}


def git_diff_clean(base: str, paths: list[str]) -> bool:
    return subprocess.run(
        ["git", "diff", "--quiet", base, "--", *paths], check=False
    ).returncode == 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True, help="Commit before the noindex change")
    parser.add_argument(
        "--csv", default="reports/noindex-candidates-2026-10-14.csv"
    )
    args = parser.parse_args()
    root = Path.cwd()
    with (root / args.csv).open(encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    yes = [r for r in rows if r["noindex_candidate_zero_impressions_zero_views"] == "YES"]
    no = [r for r in rows if r["noindex_candidate_zero_impressions_zero_views"] == "NO"]
    assert len(rows) == 10_964, f"candidate rows: {len(rows)}"
    assert len(yes) == 10_119, f"YES rows: {len(yes)}"
    assert len(no) == 845, f"NO rows: {len(no)}"
    paths = [r["repo_path"] for r in rows]
    assert len(paths) == len(set(paths)), "duplicate candidate paths"
    assert all(p.startswith(("report/travel/", "jp/report/")) for p in paths)

    applied, missing, bad_yes, bad_no = [], [], [], []
    for row in yes:
        path = root / row["repo_path"]
        if not path.is_file():
            missing.append(row["repo_path"])
            if row["noindex_applied"] != "SOURCE_FILE_MISSING":
                bad_yes.append(row["repo_path"])
            continue
        contents = path.read_text(encoding="utf-8")
        values = [m.group(1).lower() for m in ROBOTS.finditer(contents)]
        if values != ["noindex,follow"] or row["noindex_applied"] != "YES":
            bad_yes.append(row["repo_path"])
        else:
            applied.append(row["repo_path"])
    for row in no:
        path = root / row["repo_path"]
        contents = path.read_text(encoding="utf-8")
        if any("noindex" in m.group(1).lower() for m in ROBOTS.finditer(contents)):
            bad_no.append(row["repo_path"])
        if row["noindex_applied"] != "NO":
            bad_no.append(row["repo_path"])

    yes_set = set(paths[i] for i, row in enumerate(rows) if row["noindex_candidate_zero_impressions_zero_views"] == "YES")
    remaining_sitemap = []
    parsed_sitemaps = 0
    for sitemap in root.rglob("sitemap*.xml"):
        tree = ET.parse(sitemap)
        parsed_sitemaps += 1
        for loc in tree.getroot().findall(".//sm:loc", SITEMAP_NS):
            repo_path = urllib.parse.urlparse(loc.text or "").path.lstrip("/")
            if repo_path in yes_set:
                remaining_sitemap.append((str(sitemap), repo_path))

    no_untouched = git_diff_clean(args.base, [r["repo_path"] for r in no])
    kor_untouched = git_diff_clean(args.base, ["kor/"])
    summary = {
        "candidate_yes": len(yes),
        "tagged_existing_yes_pages": len(applied),
        "yes_paths_without_source_file": len(missing),
        "candidate_no": len(no),
        "no_candidate_pages_with_noindex": len(bad_no),
        "no_candidate_pages_unchanged_from_base": no_untouched,
        "kor_tree_unchanged_from_base": kor_untouched,
        "yes_candidate_urls_remaining_in_sitemaps": len(remaining_sitemap),
        "sitemaps_parsed": parsed_sitemaps,
        "bad_yes_records": len(bad_yes),
        "missing_source_paths_count": len(missing),
        "missing_source_paths_sample": missing[:5],
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    assert not bad_yes, f"incorrect YES rows: {bad_yes[:5]}"
    assert not bad_no and no_untouched, "a NO page was touched or carries noindex"
    assert kor_untouched, "kor/ changed during noindex application"
    assert not remaining_sitemap, f"YES URL remains in sitemap: {remaining_sitemap[:5]}"
    # 99 historical candidate paths have no source file; keep this visible as a
    # completeness shortfall instead of manufacturing new HTML pages.
    return 2 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
