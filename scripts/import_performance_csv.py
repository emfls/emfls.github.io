#!/usr/bin/env python3
"""Import supplied GSC, GA4, and AdSense exports into URL-level performance JSON."""

import argparse
import csv
import io
import json
import re
import zipfile
from pathlib import Path
from urllib.parse import urlparse


ORIGIN = "https://emfls.github.io"


def normalize_url(value):
    value = str(value or "").strip()
    if value.startswith(("http://", "https://")):
        parsed = urlparse(value)
        return parsed.path or "/"
    return value if value.startswith("/") else "/" + value


def _number(value):
    text = str(value or "").replace(",", "").strip()
    return float(text.rstrip("%")) / 100 if text.endswith("%") else float(text or 0)


def opportunity_score(impressions, ctr, position):
    benchmark = 0.12 if position <= 3 else 0.05 if position <= 10 else 0.02 if position <= 20 else 0.01
    position_factor = (21 - position) / 17 if 4 <= position <= 20 else 0.2 if position < 4 else 0.0
    ctr_gap = max(benchmark - ctr, 0.005)
    return round(impressions * max(position_factor, 0) * ctr_gap, 4)


def import_gsc_zip(path):
    pages = []
    dates = []
    queries = []
    with zipfile.ZipFile(path) as archive:
        for name in archive.namelist():
            text = archive.read(name).decode("utf-8-sig")
            reader = csv.DictReader(io.StringIO(text))
            headers = set(reader.fieldnames or [])
            rows = list(reader)
            if "인기 페이지" in headers:
                for row in rows:
                    position = _number(row["게재 순위"])
                    impressions = int(_number(row["노출"]))
                    ctr = _number(row["CTR"])
                    pages.append({
                        "url": normalize_url(row["인기 페이지"]),
                        "clicks": int(_number(row["클릭수"])),
                        "impressions": impressions,
                        "ctr": ctr,
                        "position": position,
                        "striking_distance": 4 <= position <= 20,
                        "opportunity_score": opportunity_score(impressions, ctr, position),
                    })
            elif "날짜" in headers:
                dates.extend(row["날짜"] for row in rows if row.get("날짜"))
            elif "인기 검색어" in headers:
                queries.extend({
                    "query": row["인기 검색어"],
                    "clicks": int(_number(row["클릭수"])),
                    "impressions": int(_number(row["노출"])),
                    "ctr": _number(row["CTR"]),
                    "position": _number(row["게재 순위"]),
                } for row in rows)
    pages.sort(key=lambda row: (-row["opportunity_score"], row["url"]))
    queries.sort(key=lambda row: (-row["impressions"], row["query"]))
    return {
        "period": {"start": min(dates) if dates else None, "end": max(dates) if dates else None},
        "pages": pages,
        "queries": queries,
    }


def import_ga4_landing_pages(path):
    lines = Path(path).read_text(encoding="utf-8-sig").splitlines()
    start = end = None
    header_index = 0
    for index, line in enumerate(lines):
        if line.startswith("# 시작일:"):
            start = line.split(":", 1)[1].strip()
        elif line.startswith("# 종료일:"):
            end = line.split(":", 1)[1].strip()
        elif line.startswith("방문 페이지,"):
            header_index = index
            break
    reader = csv.DictReader(lines[header_index:])
    by_url = {}
    duplicate_urls = set()
    missing_url_rows = 0
    for row in reader:
        landing = (row.get("방문 페이지") or "").strip()
        if not landing or landing == "(not set)":
            missing_url_rows += 1
            continue
        url = normalize_url(landing)
        sessions = int(_number(row.get("세션수")))
        engagement = _number(row.get("세션당 평균 참여 시간"))
        if url in by_url:
            duplicate_urls.add(url)
            previous = by_url[url]
            total_sessions = previous["sessions"] + sessions
            previous["engagement_seconds"] = round(
                (previous["engagement_seconds"] * previous["sessions"] + engagement * sessions) / total_sessions, 2
            ) if total_sessions else 0
            previous["sessions"] = total_sessions
            previous["active_users"] += int(_number(row.get("활성 사용자")))
        else:
            by_url[url] = {
                "url": url, "sessions": sessions,
                "active_users": int(_number(row.get("활성 사용자"))),
                "engagement_seconds": round(engagement, 2),
            }
    def iso(value):
        return f"{value[:4]}-{value[4:6]}-{value[6:8]}" if value and len(value) == 8 else value
    return {
        "period": {"start": iso(start), "end": iso(end)},
        "pages": [by_url[url] for url in sorted(by_url)],
        "missing_url_rows": missing_url_rows,
        "duplicate_urls": sorted(duplicate_urls),
    }


def import_adsense_daily(path):
    with Path(path).open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    dates = [row["Date"] for row in rows]
    views = int(sum(_number(row["Page views"]) for row in rows))
    earnings = sum(_number(row["Estimated earnings (USD)"]) for row in rows)
    clicks = int(sum(_number(row["Clicks"]) for row in rows))
    return {
        "scope": "site_only_no_url_dimension",
        "period": {"start": min(dates), "end": max(dates)},
        "page_views": views,
        "clicks": clicks,
        "estimated_earnings_usd": round(earnings, 2),
        "page_rpm": round(earnings * 1000 / views, 2) if views else 0,
    }


def merge_performance(gsc, ga4):
    by_url = {}
    for row in gsc.get("pages", []):
        by_url[row["url"]] = {
            "url": row["url"], "organic_clicks": row["clicks"],
            "impressions": row["impressions"], "search_ctr": row["ctr"],
            "average_position": row["position"], "striking_distance": row["striking_distance"],
            "opportunity_score": row["opportunity_score"],
            "sessions": None, "active_users": None, "engagement_seconds": None,
        }
    for row in ga4.get("pages", []):
        target = by_url.setdefault(row["url"], {
            "url": row["url"], "organic_clicks": None, "impressions": None,
            "search_ctr": None, "average_position": None, "striking_distance": False,
            "opportunity_score": 0,
        })
        target.update({key: row[key] for key in ("sessions", "active_users", "engagement_seconds")})
    return sorted(by_url.values(), key=lambda row: row["url"])


def render_report(result):
    candidates = sorted(
        (row for row in result["pages"] if row["striking_distance"]),
        key=lambda row: (-row["opportunity_score"], row["url"]),
    )
    lines = [
        "# Content Opportunities", "",
        f"- GSC period: {result['periods']['gsc']['start']} to {result['periods']['gsc']['end']}",
        f"- GA4 period: {result['periods']['ga4']['start']} to {result['periods']['ga4']['end']}",
        f"- URL rows merged: {len(result['pages']):,}",
        f"- Striking-distance pages (position 4–20): {len(candidates):,}", "",
        "Opportunity Score = impressions × position factor × CTR gap. It ranks review work; it does not estimate revenue.", "",
        "## Top striking-distance pages", "",
    ]
    lines.extend(
        f"- `{row['url']}` — score {row['opportunity_score']:.2f}, impressions {row['impressions']:,}, position {row['average_position']:.2f}, CTR {row['search_ctr']:.2%}"
        for row in candidates[:100]
    )
    lines.extend(("", "## Data limitations", "", "- The supplied AdSense export is site-level, so revenue and RPM are not assigned to individual URLs.", "- GSC query and page exports are separate aggregates; queries are not falsely joined to pages."))
    return "\n".join(lines).rstrip() + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--gsc", type=Path, required=True)
    parser.add_argument("--ga4", type=Path, required=True)
    parser.add_argument("--adsense", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("data/performance/import.json"))
    parser.add_argument("--report", type=Path, default=Path("reports/content-opportunities.md"))
    args = parser.parse_args()
    gsc = import_gsc_zip(args.gsc)
    ga4 = import_ga4_landing_pages(args.ga4)
    result = {
        "periods": {"gsc": gsc["period"], "ga4": ga4["period"]},
        "timezone": "source_export_not_provided",
        "pages": merge_performance(gsc, ga4),
        "queries": gsc["queries"],
        "adsense": import_adsense_daily(args.adsense),
        "scoring": {"formula": "impressions * position_factor * max(expected_ctr - actual_ctr, 0.005)", "striking_distance": "position 4 through 20"},
        "data_quality": {
            "ga4_missing_url_rows": ga4["missing_url_rows"],
            "ga4_duplicate_urls": ga4["duplicate_urls"],
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.report.write_text(render_report(result), encoding="utf-8")
    print(json.dumps({"pages": len(result["pages"]), "queries": len(result["queries"]), "striking_distance": sum(row["striking_distance"] for row in result["pages"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
