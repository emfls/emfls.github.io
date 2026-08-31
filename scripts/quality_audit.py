#!/usr/bin/env python3
"""Compose existing audit and performance data into deterministic quality scores."""

import argparse
import json
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse
from xml.etree import ElementTree

try:
    from scripts.quality_scoring import CATEGORY_MAX, score_page
    from scripts.quality_reports import render_dashboard, render_site_markdown
    from scripts.quality_site import (
        calculate_revenue_goal,
        calculate_site_score,
        latest_performance_file,
        load_performance,
        normalize_url,
        performance_by_url,
        rank_priority,
    )
except ModuleNotFoundError:
    from quality_scoring import CATEGORY_MAX, score_page
    from quality_reports import render_dashboard, render_site_markdown
    from quality_site import (
        calculate_revenue_goal,
        calculate_site_score,
        latest_performance_file,
        load_performance,
        normalize_url,
        performance_by_url,
        rank_priority,
    )


SCHEMA_VERSION = 1
RULES_VERSION = "2026-08-31.1"


def _read_json(path, default):
    path = Path(path)
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def _duplicates(pages, field):
    grouped = defaultdict(list)
    for page in pages:
        value = str(page.get(field) or "").strip()
        if value:
            grouped[value].append(page["url"])
    return {url for urls in grouped.values() if len(urls) > 1 for url in urls}


def _inbound_counts(pages):
    counts = Counter()
    known = {normalize_url(page["url"]) for page in pages}
    for page in pages:
        for target in page.get("internal_link_targets") or []:
            normalized = normalize_url(target)
            if normalized in known:
                counts[normalized] += 1
    return dict(counts)


def _sitemap_urls(root):
    urls = set()
    for path in sorted(Path(root).rglob("*sitemap*.xml")):
        try:
            tree = ElementTree.parse(path)
        except (ElementTree.ParseError, OSError):
            continue
        for element in tree.iter():
            if element.tag.rsplit("}", 1)[-1] == "loc" and element.text:
                parsed = urlparse(element.text.strip())
                if parsed.netloc.lower() in {"emfls.github.io", "www.emfls.github.io"}:
                    urls.add(normalize_url(parsed.path or "/"))
    return urls


def _trust_pages(pages):
    found = set()
    for page in pages:
        path = page["path"].lower()
        for name in ("about", "contact", "privacy", "terms", "disclaimer", "methodology"):
            if name in path:
                found.add(name)
    return found


def _connection_state(period, as_of):
    end = period.get("end")
    if not end:
        return "NOT_CONNECTED"
    try:
        age = (datetime.strptime(as_of, "%Y-%m-%d").date() - datetime.strptime(end, "%Y-%m-%d").date()).days
    except (TypeError, ValueError):
        return "NOT_CONNECTED"
    return "STALE_DATA" if age > 30 else "CSV_CONNECTED"


def _system_context(pages, performance, sitemap_urls, inbound, root, as_of):
    total = len(pages) or 1
    periods = performance.get("periods") or {}
    gsc_period = periods.get("gsc") or {}
    ga4_period = periods.get("ga4") or {}
    robots_path = Path(root) / "robots.txt"
    robots_text = robots_path.read_text(encoding="utf-8", errors="ignore") if robots_path.exists() else ""
    return {
        "gsc_state": _connection_state(gsc_period, as_of),
        "ga4_state": _connection_state(ga4_period, as_of),
        "sitemap_ok": bool(sitemap_urls),
        "robots_ok": robots_path.exists() and "Disallow: /\n" not in robots_text,
        "https_ok": True,
        "canonical_ratio": sum(bool(page.get("canonical")) for page in pages) / total,
        "breadcrumb_ratio": sum(bool(page.get("has_breadcrumb")) for page in pages) / total,
        "structured_data_ratio": sum(bool(page.get("structured_data_types")) for page in pages) / total,
        "orphan_ratio": sum(inbound.get(normalize_url(page["url"]), 0) == 0 for page in pages) / total,
        "trust_pages": _trust_pages(pages),
        "adsense_policy_safe": False,
        "ad_ux_safe": True,
        "internal_link_system": True,
        "url_consistency": True,
        "category_structure_ok": True,
        "custom_404": (Path(root) / "404.html").exists(),
    }


def _validate(page_payload, expected_urls):
    rows = page_payload["pages"]
    urls = [row["url"] for row in rows]
    if len(urls) != len(set(urls)) or set(urls) != set(expected_urls):
        raise ValueError("quality output must contain every unique indexable URL exactly once")
    for row in rows:
        if set(row["scores"]) != set(CATEGORY_MAX):
            raise ValueError(f"missing score category for {row['url']}")
        if any(section["score"] > CATEGORY_MAX[name] for name, section in row["scores"].items()):
            raise ValueError(f"category maximum exceeded for {row['url']}")
        if sum(section["score"] for section in row["scores"].values()) != row["raw_score"]:
            raise ValueError(f"category sum differs from raw score for {row['url']}")
        for cap in row["caps"]:
            if not all(cap.get(key) is not None for key in ("code", "status", "evidence", "max_score")):
                raise ValueError(f"cap lacks evidence for {row['url']}")
        for name in ("revenue", "rpm"):
            metric = row["metrics"][name]
            if metric["status"] == "NOT_CONNECTED" and metric["value"] is not None:
                raise ValueError(f"fabricated {name} for {row['url']}")


def _compact_result(result):
    priority = {"MANUAL_REVIEW_REQUIRED": 3, "NOT_CONNECTED": 2, "ESTIMATED": 1, "VERIFIED": 0}
    compact_scores = {}
    for name, section in result["scores"].items():
        statuses = [check["status"] for check in section["checks"]]
        evidence_status = max(statuses, key=lambda status: priority[status]) if statuses else "NOT_CONNECTED"
        compact_scores[name] = {"score": section["score"], "max": section["max"], "evidence": evidence_status}
    return {
        **result,
        "scores": compact_scores,
        "issues": result["issues"][:20],
        "strengths": result["strengths"][:8],
        "recommendations": result["recommendations"][:10],
    }


def run_quality_audit(
    *, root, audit_path, metadata_path, performance_dir, cannibalization_path,
    as_of, page_output, site_output, report_output=None, dashboard_output=None,
):
    root = Path(root)
    audit = _read_json(audit_path, {"pages": []})
    pages = sorted((page for page in audit.get("pages", []) if page.get("indexable", True)), key=lambda row: row["url"])
    metadata_rows = _read_json(metadata_path, [])
    metadata = {normalize_url(row["url"]): row for row in metadata_rows if row.get("url")}
    performance_path = latest_performance_file(performance_dir)
    performance = load_performance(performance_path) if performance_path else {"pages": [], "adsense": None, "periods": {}}
    metrics = performance_by_url(performance)
    sitemap_urls = _sitemap_urls(root)
    inbound = _inbound_counts(pages)
    _read_json(cannibalization_path, {"candidate_groups": []})
    context = {
        "sitemap_urls": sitemap_urls,
        "broken_link_sources": set(),
        "duplicate_title_urls": _duplicates(pages, "title"),
        "duplicate_description_urls": _duplicates(pages, "description"),
        "duplicate_canonical_urls": _duplicates(pages, "canonical"),
        "severe_duplicate_urls": set(),
        "duplicate_body_candidate_urls": set(),
        "inbound_links": inbound,
        "ad_ux_warning_urls": set(),
        "robots_ok": (Path(root) / "robots.txt").exists(),
    }
    results = []
    for page in pages:
        key = normalize_url(page["url"])
        result = score_page(page, metadata.get(key, {}), context)
        priority = rank_priority(result, metrics.get(key))
        result = _compact_result(result)
        result["priority"] = {key: value for key, value in priority.items() if key != "metrics"}
        result["metrics"] = priority["metrics"]
        results.append(result)
    results.sort(key=lambda row: row["url"])
    page_payload = {
        "schema_version": SCHEMA_VERSION,
        "rules_version": RULES_VERSION,
        "as_of": as_of,
        "summary": {"evaluated_indexable_pages": len(results)},
        "pages": results,
    }
    system_context = _system_context(pages, performance, sitemap_urls, inbound, root, as_of)
    site = calculate_site_score(results, system_context)
    site_payload = {
        "schema_version": SCHEMA_VERSION,
        "rules_version": RULES_VERSION,
        "as_of": as_of,
        **site,
        "revenue_goal": calculate_revenue_goal(performance.get("adsense")),
    }
    _validate(page_payload, [page["url"] for page in pages])
    page_output = Path(page_output)
    site_output = Path(site_output)
    previous_site = _read_json(site_output, None)
    page_output.parent.mkdir(parents=True, exist_ok=True)
    site_output.parent.mkdir(parents=True, exist_ok=True)
    page_output.write_text(
        json.dumps(page_payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    site_output.write_text(json.dumps(site_payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    if report_output:
        report_output = Path(report_output)
        report_output.parent.mkdir(parents=True, exist_ok=True)
        report_output.write_text(render_site_markdown(site_payload, results, previous_site), encoding="utf-8")
    if dashboard_output:
        dashboard_output = Path(dashboard_output)
        dashboard_output.parent.mkdir(parents=True, exist_ok=True)
        dashboard_output.write_text(render_dashboard(site_payload, results), encoding="utf-8")
    return page_payload, site_payload


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--audit", type=Path, default=Path("data/site-audit.json"))
    parser.add_argument("--metadata", type=Path, default=Path("data/content-metadata.json"))
    parser.add_argument("--performance-dir", type=Path, default=Path("data/performance"))
    parser.add_argument("--cannibalization", type=Path, default=Path("data/cannibalization-report.json"))
    parser.add_argument("--as-of", required=True)
    parser.add_argument("--page-output", type=Path, default=Path("data/page-scores.json"))
    parser.add_argument("--site-output", type=Path, default=Path("data/site-score.json"))
    parser.add_argument("--report", type=Path, default=Path("SITE_SCORE.md"))
    parser.add_argument("--dashboard", type=Path, default=Path("reports/site-quality-dashboard.html"))
    args = parser.parse_args()
    page_payload, site_payload = run_quality_audit(
        root=args.root,
        audit_path=args.audit,
        metadata_path=args.metadata,
        performance_dir=args.performance_dir,
        cannibalization_path=args.cannibalization,
        as_of=args.as_of,
        page_output=args.page_output,
        site_output=args.site_output,
        report_output=args.report,
        dashboard_output=args.dashboard,
    )
    print(json.dumps({"pages": page_payload["summary"]["evaluated_indexable_pages"], "site_score": site_payload["score"]}))


if __name__ == "__main__":
    main()
