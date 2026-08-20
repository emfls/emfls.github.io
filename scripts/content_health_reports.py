#!/usr/bin/env python3
"""Generate duplicate, freshness, cannibalization, and internal-link reports."""

import argparse
import json
import re
from collections import defaultdict
from datetime import date, datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse


PUBLIC_ORIGIN = "https://emfls.github.io"
PUBLIC_HOSTS = {"emfls.github.io", "www.emfls.github.io"}
YEAR_RE = re.compile(r"\b(?:19|20)\d{2}\b")
SPACE_RE = re.compile(r"\s+")


def _duplicate_groups(pages, field):
    values = defaultdict(list)
    for page in pages:
        value = str(page.get(field) or "").strip()
        if value:
            values[value].append(page["url"])
    return [
        {"value": value, "urls": sorted(urls), "count": len(urls)}
        for value, urls in sorted(values.items(), key=lambda item: (-len(item[1]), item[0]))
        if len(urls) > 1
    ]


def analyze_duplicates(pages):
    return {
        "titles": _duplicate_groups(pages, "title"),
        "descriptions": _duplicate_groups(pages, "description"),
        "canonicals": _duplicate_groups(pages, "canonical"),
    }


def normalize_search_intent(title):
    value = str(title or "").split("|")[0]
    value = YEAR_RE.sub("", value)
    return SPACE_RE.sub(" ", value).strip(" -–—:|")


def analyze_cannibalization(pages):
    groups = defaultdict(list)
    for page in pages:
        intent = normalize_search_intent(page.get("title"))
        if intent:
            groups[intent].append(page["url"])
    candidates = [
        {"normalized_intent": intent, "urls": sorted(urls), "count": len(urls)}
        for intent, urls in groups.items()
        if len(urls) > 1
    ]
    candidates.sort(key=lambda item: (-item["count"], item["normalized_intent"]))
    return {
        "method": "exact normalized title; review candidate only",
        "candidate_groups": candidates,
        "candidate_urls": sum(item["count"] for item in candidates),
    }


def _parse_date(value):
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


def analyze_stale(pages, as_of=None, default_interval=365):
    as_of = as_of or date.today()
    stale = []
    unknown = []
    for page in pages:
        checked = _parse_date(page.get("updated_date")) or _parse_date(page.get("published_date"))
        if not checked:
            unknown.append(page["url"])
            continue
        age_days = (as_of - checked).days
        if age_days > default_interval:
            stale.append({
                "url": page["url"],
                "last_known_date": checked.isoformat(),
                "age_days": age_days,
                "review_interval": default_interval,
                "category": page.get("category", ""),
            })
    stale.sort(key=lambda item: (-item["age_days"], item["url"]))
    return {"as_of": as_of.isoformat(), "stale": stale, "unknown_freshness": sorted(unknown)}


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "a":
            return
        values = {key.lower(): value or "" for key, value in attrs}
        href = values.get("href", "").strip()
        if href:
            self.hrefs.append(href)


def _source_url(path, root):
    relative = path.relative_to(root).as_posix()
    if relative == "index.html":
        return "/"
    if relative.endswith("/index.html"):
        return "/" + relative[:-10]
    return "/" + relative


def _target_exists(public_urls, url_path):
    path = unquote(url_path) or "/"
    possibilities = {path}
    if not path.endswith("/") and not Path(path).suffix:
        possibilities.update((path + ".html", path + "/"))
    return bool(possibilities & public_urls)


def find_broken_internal_links(root):
    root = Path(root).resolve()
    broken = set()
    public_files = [
        path for path in sorted(root.rglob("*"))
        if path.is_file()
        if not any(part in {".git", ".venv", "node_modules"} for part in path.parts)
    ]
    html_paths = [path for path in public_files if path.suffix.lower() == ".html"]
    public_urls = {
        "/" + path.relative_to(root).as_posix()
        for path in public_files
    }
    public_urls.update(_source_url(path, root) for path in html_paths)
    for path in html_paths:
        try:
            html = path.read_text(encoding="utf-8")
        except (OSError, UnicodeError):
            continue
        parser = LinkParser()
        parser.feed(html)
        source = _source_url(path, root)
        base = PUBLIC_ORIGIN + source
        for href in parser.hrefs:
            if href.startswith(("#", "mailto:", "tel:", "javascript:", "data:")):
                continue
            target = urlparse(urljoin(base, href))
            if target.scheme not in {"http", "https"} or target.netloc.lower() not in PUBLIC_HOSTS:
                continue
            if not _target_exists(public_urls, target.path):
                broken.add((source, target.path or "/"))
    return [{"source": source, "target": target} for source, target in sorted(broken)]


def _markdown_groups(title, groups, value_key="value", limit=200):
    lines = [f"# {title}", "", f"- Groups: {len(groups):,}", ""]
    for group in groups[:limit]:
        lines.append(f"## {group[value_key]} ({group['count']})")
        lines.extend(f"- `{url}`" for url in group["urls"])
        lines.append("")
    if len(groups) > limit:
        lines.append(f"> Showing first {limit:,} groups. Full machine-readable data is retained in the audit JSON outputs.")
    return "\n".join(lines).rstrip() + "\n"


def render_duplicate_report(duplicates):
    parts = ["# Duplicate Content Report", "", "Exact duplicates are review candidates, not automatic merge or deletion instructions.", ""]
    for label, key in (("Titles", "titles"), ("Descriptions", "descriptions"), ("Canonicals", "canonicals")):
        groups = duplicates[key]
        parts.extend((f"## {label}", "", f"- Duplicate groups: {len(groups):,}", ""))
        for group in groups[:100]:
            parts.append(f"- `{group['value']}` — {group['count']} URLs")
        parts.append("")
    return "\n".join(parts).rstrip() + "\n"


def render_stale_report(result):
    lines = [
        "# Stale Content Report", "",
        f"- As of: {result['as_of']}",
        f"- Known stale pages: {len(result['stale']):,}",
        f"- Unknown freshness: {len(result['unknown_freshness']):,}", "",
        "Missing dates are not labeled stale; they are listed as unknown freshness until metadata is available.", "",
        "## Oldest known pages", "",
    ]
    lines.extend(
        f"- `{item['url']}` — {item['age_days']:,} days since {item['last_known_date']}"
        for item in result["stale"][:500]
    )
    return "\n".join(lines).rstrip() + "\n"


def render_broken_report(broken):
    lines = ["# Broken Internal Links", "", f"- Unique source-target failures: {len(broken):,}", ""]
    lines.extend(f"- `{item['source']}` → `{item['target']}`" for item in broken)
    return "\n".join(lines).rstrip() + "\n"


def build_dashboard(audit, duplicates, stale, broken, cannibalization):
    summary = audit["summary"]
    pages = audit["pages"]
    return {
        "total_pages": summary["total_pages"],
        "indexable_pages": summary["indexable_pages"],
        "needs_review": len(stale["stale"]) + len(stale["unknown_freshness"]),
        "stale_pages": len(stale["stale"]),
        "unknown_freshness": len(stale["unknown_freshness"]),
        "broken_internal_links": len(broken),
        "duplicate_title_groups": len(duplicates["titles"]),
        "duplicate_description_groups": len(duplicates["descriptions"]),
        "duplicate_canonical_groups": len(duplicates["canonicals"]),
        "cannibalization_candidate_groups": len(cannibalization["candidate_groups"]),
        "finance_pages": sum("finance" in page["path"].lower() or "stock" in page["path"].lower() for page in pages),
        "utility_pages": sum(page["category"] == "util" for page in pages),
        "method_notes": {
            "stale": "known published/updated date older than 365 days; missing dates remain unknown",
            "cannibalization": "exact normalized title groups; manual review required",
            "broken_links": "local anchor href targets only; external URLs are not requested",
        },
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path, nargs="?", default=Path("."))
    parser.add_argument("--audit", type=Path, default=Path("data/site-audit.json"))
    parser.add_argument("--as-of", default=date.today().isoformat())
    args = parser.parse_args()
    audit = json.loads(args.audit.read_text(encoding="utf-8"))
    pages = audit["pages"]
    duplicates = analyze_duplicates(pages)
    stale = analyze_stale(pages, as_of=datetime.strptime(args.as_of, "%Y-%m-%d").date())
    broken = find_broken_internal_links(args.root)
    cannibalization = analyze_cannibalization(pages)
    dashboard = build_dashboard(audit, duplicates, stale, broken, cannibalization)

    Path("reports").mkdir(exist_ok=True)
    Path("data").mkdir(exist_ok=True)
    Path("reports/duplicate-content.md").write_text(render_duplicate_report(duplicates), encoding="utf-8")
    Path("reports/stale-content.md").write_text(render_stale_report(stale), encoding="utf-8")
    Path("reports/broken-links.md").write_text(render_broken_report(broken), encoding="utf-8")
    Path("data/cannibalization-report.json").write_text(json.dumps(cannibalization, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    Path("data/dashboard.json").write_text(json.dumps(dashboard, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(dashboard, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
