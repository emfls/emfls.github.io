#!/usr/bin/env python3
"""Recommend related internal links without modifying page HTML."""

import argparse
import json
import re
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse


ORIGIN = "https://emfls.github.io"
HOSTS = {"emfls.github.io", "www.emfls.github.io"}
TOKEN_RE = re.compile(r"[A-Za-z0-9가-힣]{2,}")
STOP = {"가이드", "안내", "완벽", "총정리", "여행", "report", "html", "index"}


def _key(url):
    value = str(url).replace("/index.html", "/")
    return value.rstrip("/") or "/"


def _cluster(url):
    parts = [part for part in url.strip("/").split("/") if part]
    return parts[2] if len(parts) > 2 and parts[1] == "report" else parts[1] if len(parts) > 1 else "root"


def _tokens(page):
    text = f"{page.get('title', '')} {page.get('url', '')}".lower()
    return {token for token in TOKEN_RE.findall(text) if token not in STOP}


def _topics(page, metadata_by_url):
    entry = metadata_by_url.get(_key(page["url"]), {})
    return set(entry.get("topics") or [page.get("category", ""), _cluster(page["url"])])


def _recent(page):
    try:
        return datetime.strptime(page.get("updated_date", "")[:10], "%Y-%m-%d").date().year >= 2026
    except (TypeError, ValueError):
        return False


def recommend_links(audit, metadata, existing_targets=None, limit=6):
    existing_targets = existing_targets or {}
    metadata_by_url = {_key(entry["url"]): entry for entry in metadata}
    pages = [page for page in audit["pages"] if page.get("indexable") and page.get("title") and page.get("word_count", 0) >= 300]
    page_by_key = {_key(page["url"]): page for page in audit["pages"]}
    output = []
    for entry in metadata:
        source_key = _key(entry["url"])
        source = page_by_key.get(source_key)
        if not source or source.get("category") == "root":
            continue
        source_topics = _topics(source, metadata_by_url)
        source_tokens = _tokens(source)
        existing = {_key(url) for url in existing_targets.get(entry["url"], set())}
        existing.update(_key(url) for url in existing_targets.get(source["url"], set()))
        scored = []
        for candidate in pages:
            candidate_key = _key(candidate["url"])
            if candidate_key == source_key or candidate_key in existing or candidate.get("language") != source.get("language"):
                continue
            score = 0
            reasons = []
            if source_topics & _topics(candidate, metadata_by_url):
                score += 5
                reasons.append("same_topic")
            if candidate.get("category") == source.get("category"):
                score += 3
                reasons.append("same_category")
            if _cluster(candidate["url"]) == _cluster(source["url"]):
                score += 4
                reasons.append("same_cluster")
            overlap = source_tokens & _tokens(candidate)
            if overlap:
                score += min(len(overlap), 3) * 2
                reasons.append("keyword_overlap")
            if _recent(candidate):
                score += 1
                reasons.append("recent")
            if score >= 7:
                scored.append({
                    "url": candidate["url"], "title": candidate["title"],
                    "suggested_anchor": candidate["title"].split("|")[0].strip(),
                    "score": score, "reasons": reasons,
                })
        scored.sort(key=lambda item: (-item["score"], item["url"]))
        output.append({"url": source["url"], "recommendations": scored[:limit]})
    return output


class AnchorParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "a":
            values = {key.lower(): value or "" for key, value in attrs}
            if values.get("href"):
                self.hrefs.append(values["href"])


def existing_links(root, audit, metadata):
    pages = {_key(page["url"]): page for page in audit["pages"]}
    result = {}
    for entry in metadata:
        page = pages.get(_key(entry["url"]))
        if not page:
            continue
        path = Path(root) / page["path"]
        parser = AnchorParser()
        parser.feed(path.read_text(encoding="utf-8"))
        targets = set()
        for href in parser.hrefs:
            parsed = urlparse(urljoin(ORIGIN + page["url"], href))
            if parsed.netloc.lower() in HOSTS:
                targets.add(parsed.path or "/")
        result[page["url"]] = targets
    return result


def render_report(rows):
    lines = [
        "# Internal Link Recommendations", "",
        f"- Source pages: {len(rows):,}",
        f"- Recommendations: {sum(len(row['recommendations']) for row in rows):,}",
        "- Mode: recommendation only; no HTML was modified", "",
    ]
    for row in rows:
        lines.extend((f"## `{row['url']}`", ""))
        lines.extend(
            f"- [{item['suggested_anchor']}]({item['url']}) — score {item['score']} ({', '.join(item['reasons'])})"
            for item in row["recommendations"]
        )
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path, nargs="?", default=Path("."))
    parser.add_argument("--audit", type=Path, default=Path("data/site-audit.json"))
    parser.add_argument("--metadata", type=Path, default=Path("data/content-metadata.json"))
    parser.add_argument("--output", type=Path, default=Path("data/internal-link-recommendations.json"))
    parser.add_argument("--report", type=Path, default=Path("reports/internal-link-recommendations.md"))
    args = parser.parse_args()
    audit = json.loads(args.audit.read_text(encoding="utf-8"))
    metadata = json.loads(args.metadata.read_text(encoding="utf-8"))
    rows = recommend_links(audit, metadata, existing_links(args.root, audit, metadata))
    args.output.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.report.write_text(render_report(rows), encoding="utf-8")
    print(json.dumps({"pages": len(rows), "recommendations": sum(len(row["recommendations"]) for row in rows)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
