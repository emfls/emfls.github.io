#!/usr/bin/env python3
"""Set sitemap URL lastmod dates from the latest Git commit touching each local page."""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import urllib.parse
import xml.etree.ElementTree as ET
from pathlib import Path

ORIGIN = "emfls.github.io"
NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
URL_BLOCK = re.compile(r"(?m)^  <url\b.*?^  </url\s*>\n?", re.S)
LOC = re.compile(r"<loc\s*>(.*?)</loc\s*>", re.I | re.S)
LASTMOD = re.compile(r"\s*<lastmod\s*>.*?</lastmod\s*>\s*", re.I | re.S)


def run_git(*args: str) -> bytes:
    return subprocess.run(["git", *args], check=True, stdout=subprocess.PIPE).stdout


def source_path(url: str, root: Path) -> str | None:
    parsed = urllib.parse.urlparse(url)
    if parsed.netloc.lower() not in {ORIGIN, f"www.{ORIGIN}"}:
        return None
    path = urllib.parse.unquote(parsed.path).lstrip("/")
    if not path or path.endswith("/"):
        path += "index.html"
    if (root / path).is_dir():
        path = f"{path.rstrip('/')}/index.html"
    return path


def commit_dates(paths: set[str]) -> dict[str, str]:
    if not paths:
        return {}
    dirs = sorted({str(Path(p).parent) for p in paths})
    raw = run_git(
        "log", "--full-history", "--format=__DATE__%cs%x00", "--name-only", "-z",
        "--no-renames", "HEAD", "--", *dirs,
    )
    found: dict[str, str] = {}
    date = ""
    for token in raw.decode("utf-8", errors="replace").split("\0"):
        token = token.strip()
        if token.startswith("__DATE__"):
            date = token[len("__DATE__"):]
        elif token in paths and token not in found and date:
            found[token] = date
            if len(found) == len(paths):
                break
    missing = paths - found.keys()
    for path in sorted(missing):
        result = subprocess.run(
            ["git", "log", "-1", "--format=%cs", "HEAD", "--", path],
            check=True, stdout=subprocess.PIPE,
        ).stdout.decode().strip()
        if result:
            found[path] = result
    return found


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--check", action="store_true", help="report drift without writing")
    args = parser.parse_args()
    root = args.root.resolve()
    sitemaps = sorted(p for p in root.rglob("sitemap*.xml") if ".git" not in p.parts)
    records: list[tuple[Path, str, str, str | None]] = []
    local_paths: set[str] = set()
    for sitemap in sitemaps:
        tree = ET.parse(sitemap)
        if tree.getroot().tag.rsplit("}", 1)[-1] != "urlset":
            continue
        for loc_node in tree.getroot().findall(".//sm:loc", NS):
            url = (loc_node.text or "").strip()
            page = source_path(url, root)
            records.append((sitemap, url, page or "", None))
            if page and (root / page).is_file():
                local_paths.add(page)
    dates = commit_dates(local_paths)
    counters = {"url_entries": len(records), "local_git_dates": len(dates), "missing_source_files": 0,
                "lastmod_updated": 0, "lastmod_added": 0, "lastmod_removed": 0}
    changed_files: dict[str, int] = {}
    missing: list[str] = []
    for sitemap in sitemaps:
        original = sitemap.read_text(encoding="utf-8")
        if "<urlset" not in original:
            continue
        changed_here = 0

        def update(match: re.Match[str]) -> str:
            nonlocal changed_here
            block = match.group(0)
            loc = LOC.search(block)
            if not loc:
                return block
            page = source_path(loc.group(1).strip(), root)
            if not page:
                return block
            if not (root / page).is_file() or page not in dates:
                counters["missing_source_files"] += 1
                missing.append(page)
                new_block, n = LASTMOD.subn("", block, count=1)
                if n:
                    counters["lastmod_removed"] += 1
                    changed_here += 1
                return new_block
            date = dates[page]
            old = re.search(r"<lastmod\s*>(.*?)</lastmod\s*>", block, re.I | re.S)
            if old:
                if old.group(1).strip() == date:
                    return block
                counters["lastmod_updated"] += 1
                changed_here += 1
                return block[:old.start(1)] + date + block[old.end(1):]
            counters["lastmod_added"] += 1
            changed_here += 1
            return block[:loc.end()] + f"\n    <lastmod>{date}</lastmod>" + block[loc.end():]

        updated = URL_BLOCK.sub(update, original)
        if updated != original:
            if not args.check:
                with sitemap.open("w", encoding="utf-8", newline="") as f:
                    f.write(updated)
            changed_files[str(sitemap.relative_to(root))] = changed_here
    report = {**counters, "sitemap_files": len(sitemaps), "sitemap_files_changed": changed_files,
              "missing_source_path_sample": sorted(set(missing))[:10], "check_only": args.check}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if args.check and changed_files:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
