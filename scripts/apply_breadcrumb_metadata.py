#!/usr/bin/env python3
"""Apply visible breadcrumbs and matching JSON-LD to a small pilot set."""

import argparse
import html as html_module
import json
import re
import subprocess
from pathlib import Path


ORIGIN = "https://emfls.github.io"
MARKER = 'data-seo-breadcrumb="pilot"'
LABELS = {
    "kor": "한국어", "jp": "日本語", "ae": "العربية", "game": "게임",
    "util": "도구", "visa": "비자", "camp": "캠핑", "travel": "여행",
}


def inject_metadata(source, crumbs, schema_type, published, updated, language):
    if MARKER in source:
        return source
    items = [
        {"@type": "ListItem", "position": index, "name": name, "item": ORIGIN + url}
        for index, (name, url) in enumerate(crumbs, 1)
    ]
    schemas = [{"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": items}]
    if schema_type == "Article":
        schemas.append({
            "@context": "https://schema.org", "@type": "Article",
            "headline": crumbs[-1][0], "datePublished": published,
            "dateModified": updated, "mainEntityOfPage": ORIGIN + crumbs[-1][1],
            "author": {"@type": "Organization", "name": "emfls"},
        })
    schema_html = "\n".join(
        f'<script type="application/ld+json" data-seo-schema="pilot">{json.dumps(schema, ensure_ascii=False, indent=2)}</script>'
        for schema in schemas
    ) + "\n"
    head_end = source.lower().find("</head>")
    source = source[:head_end] + schema_html + source[head_end:] if head_end >= 0 else schema_html + source

    visible = []
    for index, (name, url) in enumerate(crumbs):
        escaped = html_module.escape(name)
        visible.append(f'<span aria-current="page">{escaped}</span>' if index == len(crumbs) - 1 else f'<a href="{html_module.escape(url, quote=True)}">{escaped}</a>')
    separator = ' <span aria-hidden="true">›</span> '
    nav = f'<nav {MARKER} aria-label="Breadcrumb" style="max-width:860px;margin:16px auto 32px;padding:0 16px;font-size:.85rem;line-height:1.6">{separator.join(visible)}</nav>\n'
    if schema_type == "Article":
        labels = ("작성일", "최종 업데이트") if language == "ko" else ("Published", "Updated")
        nav += f'<p data-article-meta="pilot" style="max-width:860px;margin:-20px auto 32px;padding:0 16px;font-size:.8rem;color:#667085">{labels[0]} {published} · {labels[1]} {updated}</p>\n'
    match = re.search(r"<body[^>]*>", source, flags=re.I)
    return source[:match.end()] + "\n" + nav + source[match.end():] if match else nav + source


def build_crumbs(root, page):
    url = page["url"]
    parts = [part for part in url.strip("/").split("/") if part]
    crumbs = [("Home", "/")]
    if len(parts) >= 2 and (root / parts[0] / "index.html").exists():
        crumbs.append((LABELS.get(parts[0], parts[0]), f"/{parts[0]}/"))
    cluster_index = None
    if len(parts) >= 3 and parts[1] == "report":
        cluster_index = root / parts[0] / parts[1] / parts[2] / "index.html"
        if cluster_index.exists():
            crumbs.append((LABELS.get(parts[2], parts[2]), f"/{parts[0]}/{parts[1]}/{parts[2]}/"))
    elif len(parts) >= 2:
        section = root / parts[0] / "index.html"
        if section.exists() and crumbs[-1][1] != f"/{parts[0]}/":
            crumbs.append((LABELS.get(parts[0], parts[0]), f"/{parts[0]}/"))
    crumbs.append((page["title"].split("|")[0].strip(), url))
    return crumbs


def first_commit_date(root, path):
    result = subprocess.run(
        ["git", "log", "--diff-filter=A", "--follow", "--format=%ad", "--date=short", "--", str(path)],
        cwd=root, check=True, capture_output=True, text=True,
    )
    dates = [line for line in result.stdout.splitlines() if line]
    return dates[-1] if dates else ""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path, nargs="?", default=Path("."))
    parser.add_argument("--audit", type=Path, default=Path("data/site-audit.json"))
    parser.add_argument("--targets", type=Path, default=Path("reports/related-links-pilot.md"))
    parser.add_argument("--report", type=Path, default=Path("reports/breadcrumb-metadata-pilot.md"))
    args = parser.parse_args()
    root = args.root.resolve()
    audit = json.loads(args.audit.read_text(encoding="utf-8"))
    pages = {page["url"]: page for page in audit["pages"]}
    urls = [line.strip("- `\n") for line in args.targets.read_text(encoding="utf-8").splitlines() if line.startswith("- `/")]
    applied = []
    for url in urls:
        page = pages[url]
        path = root / page["path"]
        source = path.read_text(encoding="utf-8")
        article = page.get("category") == "report"
        published = first_commit_date(root, page["path"]) if article else ""
        updated = page.get("updated_date") or published
        result = inject_metadata(source, build_crumbs(root, page), "Article" if article else None, published, updated, page["language"])
        if result != source:
            path.write_text(result, encoding="utf-8")
            applied.append({"url": url, "article": article, "published": published, "updated": updated})
    lines = ["# Breadcrumb and Metadata Pilot", "", f"- Applied pages: {len(applied)}", f"- Article pages: {sum(item['article'] for item in applied)}", f"- Non-Article game/tool pages: {sum(not item['article'] for item in applied)}", "- Published dates: first Git commit date; no dates were invented", "- Breadcrumb JSON-LD matches the visible breadcrumb", ""]
    lines.extend(f"- `{item['url']}`" for item in applied)
    args.report.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"applied": len(applied), "articles": sum(item["article"] for item in applied)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
