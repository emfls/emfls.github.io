#!/usr/bin/env python3
"""Audit local and live sitemap structure without changing content pages."""

import argparse
import json
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse


ORIGIN = "https://emfls.github.io"
NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
MAX_URLS = 50000
MAX_BYTES = 50 * 1024 * 1024


def _public_path(url):
    parsed = urlparse(url)
    return parsed.path or "/"


def audit_local_sitemaps(root, site_audit=None):
    root = Path(root).resolve()
    files = sorted(root.rglob("sitemap.xml"))
    invalid_xml = []
    leaf_paths = []
    root_refs = []
    total_urls = 0
    missing_lastmod = 0
    invalid_lastmod = 0
    over_limit = []
    sitemap_urls = []
    for path in files:
        relative = "/" + path.relative_to(root).as_posix()
        try:
            xml_root = ET.parse(path).getroot()
        except (ET.ParseError, OSError):
            invalid_xml.append(relative)
            continue
        kind = xml_root.tag.rsplit("}", 1)[-1]
        if relative == "/sitemap.xml" and kind == "sitemapindex":
            root_refs = [_public_path(node.text or "") for node in xml_root.findall("sm:sitemap/sm:loc", NS)]
        elif kind == "urlset":
            leaf_paths.append(relative)
            urls = xml_root.findall("sm:url", NS)
            total_urls += len(urls)
            if len(urls) > MAX_URLS or path.stat().st_size > MAX_BYTES:
                over_limit.append(relative)
            for node in urls:
                loc = node.find("sm:loc", NS)
                if loc is not None and loc.text:
                    sitemap_urls.append(loc.text.strip())
                lastmod = node.find("sm:lastmod", NS)
                if lastmod is None or not (lastmod.text or "").strip():
                    missing_lastmod += 1
                else:
                    try:
                        datetime.strptime(lastmod.text.strip()[:10], "%Y-%m-%d")
                    except ValueError:
                        invalid_lastmod += 1

    result = {
        "sitemap_files": len(files),
        "leaf_sitemaps": len(leaf_paths),
        "leaf_sitemap_paths": sorted(leaf_paths),
        "indexed_sitemaps": len(set(root_refs)),
        "omitted_from_root": sorted(set(leaf_paths) - set(root_refs)),
        "missing_local_references": sorted(set(root_refs) - set(leaf_paths)),
        "invalid_xml": sorted(invalid_xml),
        "over_protocol_limit": sorted(over_limit),
        "total_url_entries": total_urls,
        "missing_lastmod": missing_lastmod,
        "invalid_lastmod": invalid_lastmod,
    }
    if site_audit:
        audit = json.loads(Path(site_audit).read_text(encoding="utf-8"))
        canonical_by_url = {
            ORIGIN + page["url"]: page.get("canonical", "")
            for page in audit["pages"] if page.get("indexable")
        }
        result["noncanonical_url_entries"] = sum(
            url in canonical_by_url and canonical_by_url[url] != url for url in sitemap_urls
        )
        result["unknown_url_entries"] = sum(url not in canonical_by_url for url in sitemap_urls)
    return result


def render_root_index(root):
    root = Path(root).resolve()
    leaves = sorted(
        "/" + path.relative_to(root).as_posix()
        for path in root.rglob("sitemap.xml")
        if path.resolve() != (root / "sitemap.xml").resolve()
    )
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    lines.extend(f"  <sitemap><loc>{ORIGIN}{path}</loc></sitemap>" for path in leaves)
    lines.append("</sitemapindex>")
    return "\n".join(lines) + "\n"


def fetch_live_headers(urls):
    results = []
    for url in urls:
        request = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "emfls-sitemap-audit/1.0"})
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                results.append({
                    "url": url,
                    "status": response.status,
                    "content_type": response.headers.get_content_type(),
                    "content_length": int(response.headers.get("Content-Length") or 0),
                })
        except Exception as error:
            results.append({"url": url, "error": type(error).__name__})
    return results


def render_markdown(local, live):
    bad_live = [item for item in live if item.get("status") != 200 or item.get("content_type") not in {"application/xml", "text/xml"}]
    return f"""# Sitemap Collection Diagnostic

- Local sitemap files: {local['sitemap_files']:,}
- Leaf URL sitemaps: {local['leaf_sitemaps']:,}
- Root-index references: {local['indexed_sitemaps']:,}
- URLs listed: {local['total_url_entries']:,}
- Omitted leaf sitemaps: {len(local['omitted_from_root']):,}
- Invalid XML: {len(local['invalid_xml']):,}
- Protocol-limit violations: {len(local['over_protocol_limit']):,}
- Missing lastmod: {local['missing_lastmod']:,}
- Invalid lastmod: {local['invalid_lastmod']:,}
- Live endpoints checked: {len(live):,}
- Live HTTP/MIME failures: {len(bad_live):,}
- Noncanonical URL entries: {local.get('noncanonical_url_entries', 'not checked')}
- Unknown URL entries: {local.get('unknown_url_entries', 'not checked')}

## Interpretation

An HTTP 200 XML response means the sitemap is currently fetchable from GitHub Pages.
Search Console's historical “Couldn't fetch” state is not proof that the current HTTP
endpoint is failing. Property mismatch, a stale submission state, or a prior response
can only be distinguished with the Search Console submission details.
"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path, nargs="?", default=Path("."))
    parser.add_argument("--site-audit", type=Path)
    parser.add_argument("--write-root-index", action="store_true")
    parser.add_argument("--live", action="store_true")
    parser.add_argument("--json", type=Path, default=Path("data/sitemap-audit.json"))
    parser.add_argument("--report", type=Path, default=Path("reports/sitemap-diagnostic.md"))
    args = parser.parse_args()
    if args.write_root_index:
        (args.root / "sitemap.xml").write_text(render_root_index(args.root), encoding="utf-8")
    local = audit_local_sitemaps(args.root, args.site_audit)
    live_urls = [ORIGIN + "/sitemap.xml"]
    live_urls.extend(ORIGIN + path for path in local["leaf_sitemap_paths"])
    live = fetch_live_headers(live_urls) if args.live else []
    result = {"local": local, "live": live}
    args.json.parent.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.json.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.report.write_text(render_markdown(local, live), encoding="utf-8")
    print(json.dumps(local, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
