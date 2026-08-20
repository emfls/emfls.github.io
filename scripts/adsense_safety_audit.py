#!/usr/bin/env python3
"""Create a policy-safety baseline from an AdSense daily CSV export."""

import argparse
import csv
import json
from datetime import datetime, timedelta
from pathlib import Path


DATE_FORMAT = "%Y-%m-%d"
HIGH_DAILY_PAGE_CTR = 0.10


def _number(row, name):
    value = (row.get(name) or "").replace(",", "").strip()
    return float(value) if value else 0.0


def audit_daily_csv(path, days=90):
    with Path(path).open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if not rows:
        raise ValueError("AdSense daily CSV contains no data rows")

    parsed = []
    for row in rows:
        day = datetime.strptime(row["Date"].strip(), DATE_FORMAT).date()
        parsed.append((day, row))
    latest = max(day for day, _ in parsed)
    earliest = latest - timedelta(days=days - 1)
    selected = sorted((day, row) for day, row in parsed if day >= earliest)

    earnings = sum(_number(row, "Estimated earnings (USD)") for _, row in selected)
    page_views = int(sum(_number(row, "Page views") for _, row in selected))
    impressions = int(sum(_number(row, "Impressions") for _, row in selected))
    clicks = int(sum(_number(row, "Clicks") for _, row in selected))
    high_ctr_days = []
    for day, row in selected:
        daily_views = int(_number(row, "Page views"))
        daily_clicks = int(_number(row, "Clicks"))
        daily_ctr = daily_clicks / daily_views if daily_views else 0.0
        if daily_views and daily_ctr >= HIGH_DAILY_PAGE_CTR:
            high_ctr_days.append({
                "date": day.isoformat(),
                "page_views": daily_views,
                "clicks": daily_clicks,
                "page_ctr": round(daily_ctr, 6),
            })

    page_ctr = clicks / page_views if page_views else 0.0
    page_rpm = earnings * 1000 / page_views if page_views else 0.0
    return {
        "source_file": Path(path).name,
        "period_start": selected[0][0].isoformat(),
        "period_end": selected[-1][0].isoformat(),
        "days_requested": days,
        "days_present": len(selected),
        "estimated_earnings_usd": round(earnings, 2),
        "page_views": page_views,
        "impressions": impressions,
        "clicks": clicks,
        "page_ctr": round(page_ctr, 6),
        "page_rpm": round(page_rpm, 2),
        "high_ctr_days": high_ctr_days,
        "assessment": "manual_review_required" if high_ctr_days else "no_daily_ctr_outlier_detected",
        "limitations": [
            "A daily aggregate cannot identify the URL, device, country, traffic source, or ad unit behind clicks.",
            "A high CTR is a review signal, not proof of invalid traffic or a policy violation.",
            "Policy Center status is not included in CSV exports and must be checked in the AdSense account.",
        ],
    }


def render_markdown(result):
    outlier_rows = "\n".join(
        f"| {row['date']} | {row['page_views']:,} | {row['clicks']:,} | {row['page_ctr']:.2%} |"
        for row in result["high_ctr_days"]
    ) or "| 없음 | - | - | - |"
    return f"""# AdSense Policy-Safety Baseline

- Data period: {result['period_start']} to {result['period_end']}
- Days present: {result['days_present']} / {result['days_requested']}
- Page views: {result['page_views']:,}
- Ad clicks: {result['clicks']:,}
- Page CTR: {result['page_ctr']:.2%}
- Page RPM: ${result['page_rpm']:.2f}
- Estimated earnings: ${result['estimated_earnings_usd']:.2f}
- Assessment: `{result['assessment']}`

## Daily review signals

The threshold below is an internal review trigger (10% daily page CTR), not a Google policy threshold.

| Date | Page views | Clicks | Page CTR |
|---|---:|---:|---:|
{outlier_rows}

## Interpretation limits

{chr(10).join('- ' + item for item in result['limitations'])}

## Required account-side checks

1. Check Policy Center for serving restrictions or invalid-traffic notices.
2. Export URL, device, country, traffic-source, and ad-unit reports for the same dates as any outlier.
3. Do not optimize for AdSense CTR or add ad-click tracking.
4. Compare RPM, viewability, PV/session, and engagement for several days before changing placement.
"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--days", type=int, default=90)
    parser.add_argument("--json", type=Path)
    parser.add_argument("--markdown", type=Path)
    args = parser.parse_args()
    result = audit_daily_csv(args.source, args.days)
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.markdown:
        args.markdown.parent.mkdir(parents=True, exist_ok=True)
        args.markdown.write_text(render_markdown(result), encoding="utf-8")
    if not args.json and not args.markdown:
        print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
