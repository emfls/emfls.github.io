#!/usr/bin/env python3
"""Read-only deterministic SEO inventory for the static emfls site."""

import argparse
import json
import re
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse


PUBLIC_HOSTS = {"emfls.github.io", "www.emfls.github.io"}
LANG_DIRS = {"ae", "cn", "de", "es", "fr", "id", "in", "jp", "kor", "pt", "ru", "vn"}
WORD_RE = re.compile(r"[A-Za-z0-9]+|[가-힣]+|[\u3040-\u30ff\u3400-\u9fff]+")


def _attrs(items):
    return {str(key).lower(): value or "" for key, value in items}


def _jsonld_types(value):
    found = set()
    if isinstance(value, dict):
        item_type = value.get("@type")
        if isinstance(item_type, str):
            found.add(item_type)
        elif isinstance(item_type, list):
            found.update(str(item) for item in item_type)
        for child in value.values():
            found.update(_jsonld_types(child))
    elif isinstance(value, list):
        for child in value:
            found.update(_jsonld_types(child))
    return found


def _jsonld_dates(value):
    published = []
    modified = []
    if isinstance(value, dict):
        if value.get("datePublished"):
            published.append(str(value["datePublished"])[:10])
        if value.get("dateModified"):
            modified.append(str(value["dateModified"])[:10])
        for child in value.values():
            child_published, child_modified = _jsonld_dates(child)
            published.extend(child_published)
            modified.extend(child_modified)
    elif isinstance(value, list):
        for child in value:
            child_published, child_modified = _jsonld_dates(child)
            published.extend(child_published)
            modified.extend(child_modified)
    return published, modified


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.language = ""
        self.title_parts = []
        self.description = ""
        self.robots = ""
        self.canonical = ""
        self.published_date = ""
        self.updated_date = ""
        self.h1_count = 0
        self.h2_count = 0
        self.images = 0
        self.links = []
        self.text_parts = []
        self.json_ld_parts = []
        self.json_ld_types = set()
        self.parse_warnings = []
        self.in_title = False
        self.in_script = False
        self.script_type = ""
        self.adsense = False
        self.ga4 = False

    def handle_starttag(self, tag, attrs):
        values = _attrs(attrs)
        tag = tag.lower()
        if tag == "html":
            self.language = values.get("lang", "").strip()
        elif tag == "title":
            self.in_title = True
        elif tag == "meta":
            key = (values.get("name") or values.get("property") or "").lower()
            content = values.get("content", "").strip()
            if key == "description":
                self.description = content
            elif key in {"robots", "googlebot"}:
                self.robots = f"{self.robots},{content}".strip(",")
            elif key in {"article:published_time", "datepublished", "date"}:
                self.published_date = content[:10]
            elif key in {"article:modified_time", "datemodified", "last-modified"}:
                self.updated_date = content[:10]
        elif tag == "link":
            rel = {item.lower() for item in values.get("rel", "").split()}
            if "canonical" in rel:
                self.canonical = values.get("href", "").strip()
        elif tag == "a":
            href = values.get("href", "").strip()
            if href:
                self.links.append(href)
        elif tag == "img":
            self.images += 1
        elif tag == "h1":
            self.h1_count += 1
        elif tag == "h2":
            self.h2_count += 1
        elif tag == "ins" and "adsbygoogle" in values.get("class", "").split():
            self.adsense = True
        elif tag == "script":
            self.in_script = True
            self.script_type = values.get("type", "").lower()
            self.json_ld_parts = []
            src = values.get("src", "")
            if "pagead2.googlesyndication.com" in src or "adsbygoogle" in src:
                self.adsense = True
            if "googletagmanager.com/gtag/js" in src:
                self.ga4 = True

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == "title":
            self.in_title = False
        elif tag == "script":
            if self.script_type == "application/ld+json":
                raw = "".join(self.json_ld_parts).strip()
                if raw:
                    try:
                        value = json.loads(raw)
                        self.json_ld_types.update(_jsonld_types(value))
                        published, modified = _jsonld_dates(value)
                        if published and not self.published_date:
                            self.published_date = published[0]
                        if modified and not self.updated_date:
                            self.updated_date = modified[0]
                    except (TypeError, ValueError):
                        self.parse_warnings.append("invalid_json_ld")
            self.in_script = False
            self.script_type = ""
            self.json_ld_parts = []

    def handle_data(self, data):
        if self.in_title:
            self.title_parts.append(data)
        elif self.in_script:
            if self.script_type == "application/ld+json":
                self.json_ld_parts.append(data)
            if "adsbygoogle" in data:
                self.adsense = True
            if "gtag(" in data or "G-QP5Q67GE5B" in data:
                self.ga4 = True
        else:
            text = data.strip()
            if text:
                self.text_parts.append(text)


def _public_url(relative_path):
    path = relative_path.as_posix()
    if path == "index.html":
        return "/"
    if path.endswith("/index.html"):
        return "/" + path[:-10]
    return "/" + path


def _language(relative_path, declared):
    if declared:
        return declared
    first = relative_path.parts[0] if relative_path.parts else ""
    return {"kor": "ko", "jp": "ja", "cn": "zh", "ae": "ar"}.get(first, first if first in LANG_DIRS else "en")


def _category(relative_path):
    parts = list(relative_path.parts[:-1])
    if parts and parts[0] in LANG_DIRS:
        parts = parts[1:]
    return parts[0] if parts else "root"


def _link_counts(links):
    internal = external = 0
    for href in links:
        if href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        parsed = urlparse(href)
        if not parsed.netloc or parsed.netloc.lower() in PUBLIC_HOSTS:
            internal += 1
        elif parsed.scheme in {"http", "https"}:
            external += 1
    return internal, external


def parse_html(html, relative_path):
    parser = PageParser()
    parser.feed(html)
    parser.close()
    internal_links, external_links = _link_counts(parser.links)
    text = " ".join(parser.text_parts)
    robots = parser.robots.lower()
    return {
        "path": relative_path.as_posix(),
        "url": _public_url(relative_path),
        "title": " ".join("".join(parser.title_parts).split()),
        "description": parser.description,
        "language": _language(relative_path, parser.language),
        "category": _category(relative_path),
        "published_date": parser.published_date,
        "updated_date": parser.updated_date,
        "word_count": len(WORD_RE.findall(text)),
        "h1_count": parser.h1_count,
        "h2_count": parser.h2_count,
        "internal_links": internal_links,
        "external_links": external_links,
        "images": parser.images,
        "structured_data_types": sorted(parser.json_ld_types),
        "canonical": parser.canonical,
        "indexable": "noindex" not in robots,
        "adsense": parser.adsense,
        "ga4": parser.ga4,
        "parse_warnings": sorted(set(parser.parse_warnings)),
    }


def audit_site(root):
    root = Path(root).resolve()
    pages = []
    parser_errors = []
    for path in sorted(root.rglob("*.html")):
        if any(part in {".git", ".venv", "node_modules"} for part in path.parts):
            continue
        relative = path.relative_to(root)
        try:
            pages.append(parse_html(path.read_text(encoding="utf-8"), relative))
        except (OSError, UnicodeError, ValueError) as error:
            parser_errors.append({"path": relative.as_posix(), "error": type(error).__name__})

    categories = Counter(page["category"] for page in pages)
    summary = {
        "total_pages": len(pages),
        "indexable_pages": sum(page["indexable"] for page in pages),
        "pages_with_title": sum(bool(page["title"]) for page in pages),
        "pages_with_description": sum(bool(page["description"]) for page in pages),
        "pages_with_canonical": sum(bool(page["canonical"]) for page in pages),
        "pages_with_adsense": sum(page["adsense"] for page in pages),
        "pages_with_ga4": sum(page["ga4"] for page in pages),
        "parser_error_count": len(parser_errors),
        "categories": dict(sorted(categories.items())),
    }
    return {"summary": summary, "parser_errors": parser_errors, "pages": pages}


def render_markdown(audit):
    summary = audit["summary"]
    total = summary["total_pages"] or 1
    rows = []
    for key, label in (
        ("pages_with_title", "Title"),
        ("pages_with_description", "Description"),
        ("pages_with_canonical", "Canonical"),
        ("pages_with_ga4", "GA4"),
        ("pages_with_adsense", "AdSense"),
    ):
        value = summary[key]
        rows.append(f"| {label} | {value:,} | {value / total:.1%} |")
    return f"""# Site SEO Audit

- Total HTML pages: {summary['total_pages']:,}
- Indexable pages: {summary['indexable_pages']:,}
- Parser errors: {summary['parser_error_count']:,}

## Coverage

| Element | Pages | Coverage |
|---|---:|---:|
{chr(10).join(rows)}

## Quality signals

- Missing title: {summary['total_pages'] - summary['pages_with_title']:,}
- Missing description: {summary['total_pages'] - summary['pages_with_description']:,}
- Missing canonical: {summary['total_pages'] - summary['pages_with_canonical']:,}
- H1 count other than one: {sum(page['h1_count'] != 1 for page in audit['pages']):,}
- Invalid JSON-LD: {sum('invalid_json_ld' in page['parse_warnings'] for page in audit['pages']):,}

This is a read-only inventory. It does not modify, publish, noindex, merge, or delete pages.
"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path, nargs="?", default=Path("."))
    parser.add_argument("--json", type=Path, default=Path("data/site-audit.json"))
    parser.add_argument("--markdown", type=Path, default=Path("reports/seo-audit.md"))
    args = parser.parse_args()
    audit = audit_site(args.root)
    args.json.parent.mkdir(parents=True, exist_ok=True)
    args.markdown.parent.mkdir(parents=True, exist_ok=True)
    args.json.write_text(json.dumps(audit, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    args.markdown.write_text(render_markdown(audit), encoding="utf-8")
    print(json.dumps(audit["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
