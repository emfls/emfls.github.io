#!/usr/bin/env python3
"""Apply a small, ad-safe related-reading pilot to priority pages."""

import argparse
import html as html_module
import json
import re
from pathlib import Path


MARKER = 'data-related-reading="seo-pilot"'
HEADINGS = {"ko": "다음으로 읽을 글", "ja": "次に読む記事", "ar": "اقرأ أيضًا"}


def select_targets(priorities, count=10):
    gaps = {"few_internal_links", "no_internal_links"}
    return [row["url"] for row in priorities if gaps & set(row.get("reasons", []))][:count]


def inject_related_section(source, recommendations, language):
    if MARKER in source:
        return source
    existing = set(re.findall(r'href=["\']([^"\']+)', source, flags=re.I))
    selected = []
    for item in recommendations:
        if item["url"] in existing or item["url"] in {entry["url"] for entry in selected}:
            continue
        selected.append(item)
        if len(selected) == 4:
            break
    if len(selected) < 4:
        return source
    heading = HEADINGS.get(language, "Related guides")
    links = "\n".join(
        f'    <li><a data-related-link="true" href="{html_module.escape(item["url"], quote=True)}">{html_module.escape(item["suggested_anchor"])}</a></li>'
        for item in selected
    )
    section = f'''\n<section {MARKER} aria-labelledby="related-reading-title" style="max-width:860px;margin:80px auto;padding:24px;border:1px solid #dbe3ee;border-radius:12px;background:#f8fafc;line-height:1.7;clear:both">
  <h2 id="related-reading-title" style="margin-top:0">{heading}</h2>
  <ul style="margin-bottom:0;padding-left:1.3rem">
{links}
  </ul>
</section>\n'''
    index = source.lower().rfind("</body>")
    return source[:index] + section + source[index:] if index >= 0 else source + section


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path, nargs="?", default=Path("."))
    parser.add_argument("--audit", type=Path, default=Path("data/site-audit.json"))
    parser.add_argument("--priority", type=Path, default=Path("data/content-priority.json"))
    parser.add_argument("--recommendations", type=Path, default=Path("data/internal-link-recommendations.json"))
    parser.add_argument("--count", type=int, default=10)
    parser.add_argument("--report", type=Path, default=Path("reports/related-links-pilot.md"))
    args = parser.parse_args()
    audit = json.loads(args.audit.read_text(encoding="utf-8"))
    priorities = json.loads(args.priority.read_text(encoding="utf-8"))["pages"]
    recommendations = {row["url"]: row["recommendations"] for row in json.loads(args.recommendations.read_text(encoding="utf-8"))}
    pages = {page["url"]: page for page in audit["pages"]}
    targets = select_targets(priorities, args.count)
    applied = []
    for url in targets:
        if url not in pages or url not in recommendations:
            continue
        path = args.root / pages[url]["path"]
        source = path.read_text(encoding="utf-8")
        updated = inject_related_section(source, recommendations[url], pages[url]["language"])
        if updated != source:
            path.write_text(updated, encoding="utf-8")
            applied.append(url)
    lines = [
        "# Related Links Pilot", "",
        f"- Requested pages: {len(targets)}", f"- Applied pages: {len(applied)}",
        "- Links per page: 4", "- Ad-safe vertical margin: 80px", "- Existing links and other-language targets: excluded", "",
    ]
    lines.extend(f"- `{url}`" for url in applied)
    args.report.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"requested": len(targets), "applied": len(applied)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
