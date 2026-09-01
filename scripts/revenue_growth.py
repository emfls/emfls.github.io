#!/usr/bin/env python3
"""Build URL-level revenue opportunity records and decision reports."""

import argparse
import json
from collections import Counter
from datetime import date, timedelta
from pathlib import Path
from statistics import median

try:
    from scripts.naver_performance import load_naver_snapshot, match_naver_rows
    from scripts.quality_site import normalize_url
    from scripts.revenue_opportunity import (
        classify_record,
        cooldown_state,
        empty_channel,
        normalize_channel,
        score_opportunity,
        select_improvements,
    )
except ModuleNotFoundError:
    from naver_performance import load_naver_snapshot, match_naver_rows
    from quality_site import normalize_url
    from revenue_opportunity import (
        classify_record,
        cooldown_state,
        empty_channel,
        normalize_channel,
        score_opportunity,
        select_improvements,
    )


CHANNEL_FIELDS = {
    "naver": ("impressions", "clicks", "ctr", "position"),
    "google": ("impressions", "clicks", "ctr", "position"),
    "ga4": ("views", "users", "engagementSeconds", "revenue"),
    "adsense": ("revenue", "rpm"),
}


def content_growth_summary(experiments, as_of):
    current = date.fromisoformat(as_of)
    launches = [row for row in experiments if row.get("type") == "CONTENT_LAUNCH_EXPERIMENT"]
    mature = [row for row in launches if row.get("publishedOn") and (current - date.fromisoformat(row["publishedOn"])).days >= 28]
    winners = sum(row.get("result") == "WINNER" for row in mature)
    recent = [row for row in launches if row.get("publishedOn") and date.fromisoformat(row["publishedOn"]) >= current - timedelta(days=27)]
    revenues = [row.get("revenue") for row in recent]
    revenue_ready = bool(recent) and all(value is not None for value in revenues)
    return {
        "activeExperiments": sum(row.get("status") == "OBSERVING" for row in launches),
        "newPages28d": len(recent), "matureCohort": len(mature),
        "newPageWinRate": round(winners / len(mature), 4) if mature else None,
        "revenuePerNewPage": round(sum(revenues) / len(recent), 6) if revenue_ready else None,
        "revenuePerNewPageStatus": "VERIFIED" if revenue_ready else "INSUFFICIENT_DATA",
        "patternStatus": "OBSERVE_PATTERN", "secondaryClusters": [],
    }


def _read_json(path, default):
    path = Path(path) if path else None
    return json.loads(path.read_text(encoding="utf-8")) if path and path.exists() else default


def _write_json(path, payload, compact=False):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    options = {"ensure_ascii": False, "sort_keys": True}
    if compact:
        options["separators"] = (",", ":")
    else:
        options["indent"] = 2
    path.write_text(json.dumps(payload, **options) + "\n", encoding="utf-8")


def _by_url(rows):
    return {normalize_url(row.get("url")): row for row in rows if row.get("url")}


def _period_key(channel):
    period = (channel or {}).get("period") or {}
    return period.get("start"), period.get("end")


def _period_compatibility(site):
    periods = {
        _period_key(site.get(name))
        for name in ("naver", "google", "ga4", "adsense")
        if site.get(name) and _period_key(site.get(name)) != (None, None)
    }
    return "MATCH" if len(periods) <= 1 else "MISMATCH"


def _cluster_medians(records):
    values = {}
    for channel_name in ("naver", "google"):
        ctrs = sorted(
            row[channel_name]["ctr"]
            for row in records
            if row.get("cluster") == "camping"
            and row[channel_name].get("status") == "VERIFIED"
            and row[channel_name].get("ctr") is not None
        )
        if ctrs:
            middle = len(ctrs) // 2
            values[f"{channel_name}_ctr"] = (
                ctrs[middle]
                if len(ctrs) % 2
                else (ctrs[middle - 1] + ctrs[middle]) / 2
            )
    return values


def _camping_naver_benchmarks(records):
    pages = [
        row for row in records
        if row.get("cluster") == "camping" and row["naver"].get("status") == "VERIFIED"
    ]
    if not pages:
        return {"coveredPages": 0, "impressionsMedian": None, "clicksMedian": None, "ctrMedian": None, "weightedCtr": None}
    impressions = [row["naver"]["impressions"] for row in pages]
    clicks = [row["naver"]["clicks"] for row in pages]
    ctrs = [row["naver"]["ctr"] for row in pages]
    total_impressions = sum(impressions)
    ordered_impressions = sorted(impressions)
    ordered_clicks = sorted(clicks)
    divisor = max(1, len(pages) - 1)
    percentiles = {
        row["url"]: {
            "impressions": ordered_impressions.index(row["naver"]["impressions"]) / divisor,
            "clicks": ordered_clicks.index(row["naver"]["clicks"]) / divisor,
        }
        for row in pages
    }
    return {
        "coveredPages": len(pages),
        "impressionsMedian": median(impressions),
        "clicksMedian": median(clicks),
        "ctrMedian": median(ctrs),
        "weightedCtr": sum(clicks) / total_impressions if total_impressions else 0,
        "maxImpressions": max(impressions),
        "maxClicks": max(clicks),
        "rankBenchmark": "NOT_AVAILABLE",
        "percentiles": percentiles,
    }


def _data_status(record):
    search_states = {record[name].get("status") for name in ("naver", "google")}
    if "VERIFIED" in search_states:
        return "VERIFIED"
    if "STALE_DATA" in search_states:
        return "STALE_DATA"
    if record["ga4"].get("status") == "VERIFIED":
        return "INSUFFICIENT_DATA"
    return "NOT_CONNECTED"


def _camping_cluster(records):
    pages = [row for row in records if row.get("cluster") == "camping"]
    ga4_periods = {_period_key(row["ga4"]) for row in pages if row["ga4"].get("status") == "VERIFIED"}
    compatible = len(ga4_periods) <= 1
    views = sum((row["ga4"].get("views") or 0) for row in pages) if compatible else None
    revenue = sum((row["ga4"].get("revenue") or 0) for row in pages) if compatible else None
    efficiency = revenue * 1000 / views if revenue is not None and views else None
    counts = Counter(row.get("classification") for row in pages)
    return {
        "pages": len(pages),
        "views": views,
        "revenue": round(revenue, 4) if revenue is not None else None,
        "revenuePer1000Views": round(efficiency, 2) if efficiency is not None else None,
        "winner": counts.get("WINNER", 0),
        "opportunity": counts.get("OPPORTUNITY", 0),
        "naverStatus": "NOT_CONNECTED" if not any(row["naver"].get("status") != "NOT_CONNECTED" for row in pages) else "PARTIAL",
        "periodCompatibility": "MATCH" if compatible else "MISMATCH",
    }


def _render_report(summary):
    kpis = summary["kpis"]
    naver_quality = ((summary.get("dataQuality") or {}).get("naver") or {})
    lines = [
        "# Revenue Growth Report",
        "",
        "## CURRENT STATUS",
        "",
        f"- 28d Revenue: ${kpis['revenue28d']['value']:.2f}" if kpis["revenue28d"]["value"] is not None else "- 28d Revenue: N/A",
        f"- 28d Daily Average: ${kpis['dailyAverage28d']['value']:.2f}" if kpis["dailyAverage28d"]["value"] is not None else "- 28d Daily Average: N/A",
        f"- Indexed Pages: {kpis['indexedPages']['value']:,}",
        f"- Revenue per Indexed Page: ${kpis['revenuePerIndexedPage']['value']:.6f}" if kpis["revenuePerIndexedPage"]["value"] is not None else "- Revenue per Indexed Page: N/A",
        f"- Views per User: {kpis['viewsPerActiveUser']['value']:.2f}" if kpis["viewsPerActiveUser"]["value"] is not None else "- Views per User: N/A",
    ]
    for name in ("WINNER", "OPPORTUNITY", "EXPERIMENT", "DEAD_CANDIDATE", "INSUFFICIENT_DATA"):
        lines.append(f"- {name}: {summary['classificationCounts'].get(name, 0)}")
    lines.extend(("", "## TOP REVENUE OPPORTUNITIES", ""))
    for index, row in enumerate(summary["topOpportunities"], 1):
        lines.extend(
            (
                f"### {index}. `{row['url']}`",
                "",
                f"- Score: {row['revenueOpportunityScore']} / 100",
                f"- Classification: {row.get('classification') or 'INSUFFICIENT_DATA'}",
                f"- Why: {'; '.join(row.get('reasons') or [])}",
                f"- Next Action: {row['nextAction']}",
                f"- Cooldown: {'YES' if row.get('cooldown') else 'NO'}",
                f"- Data Status: {row['dataStatus']}",
                f"- Naver: {row['naver']['impressions']:,} impressions / {row['naver']['clicks']:,} clicks / {row['naver']['ctr']:.1%} CTR" if row.get("naver", {}).get("impressions") is not None else "- Naver: NOT_AVAILABLE",
                f"- Rank: {row.get('naver', {}).get('position') if row.get('naver', {}).get('position') is not None else 'N/A'}",
                "",
            )
        )
    lines.extend((
        "## Naver URL Data Quality", "",
        f"- URL match: {int(naver_quality.get('matched') or 0)}/{int(naver_quality.get('rows') or 0)} ({float(naver_quality.get('matchRate') or 0):.1%})",
        f"- Gate: {'PASS' if naver_quality.get('gatePassed') else 'FAIL'}",
        f"- Cross-source period: {summary.get('crossSourcePeriodAlignment')}",
        f"- Rank: {'N/A' if naver_quality.get('rankAvailability') == 'NOT_AVAILABLE' else naver_quality.get('rankAvailability')}",
        f"- Limitations: {', '.join(naver_quality.get('limitations') or [])}", "",
        "## 다음 콘텐츠 실험 후보", "", f"- {len(summary.get('eligibleCandidates') or [])}페이지 (최대 3)", "",
        "## 이번 실행 실제 콘텐츠 수정", "", f"- 이번 콘텐츠 실제 수정: {len(summary.get('contentChanges') or [])}페이지",
        "- 이번 실행은 데이터 연결과 후보 선별만 수행했습니다.",
    ))
    lines.extend(("", "## PROTECTED WINNERS", ""))
    for row in summary["protectedWinners"]:
        lines.append(f"- `{row['url']}` — 검증된 페이지 수익과 방문이 있어 대규모 rewrite 금지")
    lines.extend(("", "## Camping Cluster", "", f"- Pages: {summary['campingCluster']['pages']}", f"- Revenue: {summary['campingCluster']['revenue']}", f"- Naver URL data: {summary['campingCluster']['naverStatus']}", ""))
    drivers = summary.get("growthDrivers") or {}
    change = drivers.get("revenueChange")
    lines.extend(
        (
            "## Growth Drivers",
            "",
            f"- Revenue change: {change:+.0%}" if change is not None else "- Revenue change: N/A",
            f"- Status: {drivers.get('status', 'INSUFFICIENT_DATA')}",
            "- PV growth: N/A",
            "- RPM improvement: N/A",
            "- Camping contribution: N/A",
            f"- Reason: {drivers.get('reason', 'Matched comparison data is unavailable.')}",
            "",
        )
    )
    return "\n".join(lines).rstrip() + "\n"


def run_revenue_growth(
    *,
    page_scores_path,
    audit_path,
    performance_path,
    experiments_path,
    as_of,
    page_output,
    opportunity_output,
    report_output,
    optimization_history_path=None,
    naver_snapshot_path=None,
    content_experiments_path=None,
):
    page_scores = _read_json(page_scores_path, {"pages": []})
    audit = _read_json(audit_path, {"pages": []})
    performance = _read_json(performance_path, {"site": {}, "pages": []})
    experiments = _read_json(experiments_path, {"experiments": []})
    content_experiments = _read_json(content_experiments_path, {"experiments": []})
    history = _read_json(optimization_history_path, {"pages": []})
    audit_map = _by_url(audit.get("pages") or [])
    performance_map = _by_url(performance.get("pages") or [])
    history_map = _by_url(history.get("pages") or [])
    experiment_map = _by_url(experiments.get("experiments") or [])
    naver_snapshot = load_naver_snapshot(naver_snapshot_path) if naver_snapshot_path else None
    canonical_map = {
        normalize_url(row.get("url")): normalize_url(row.get("canonical"))
        for row in audit.get("pages") or []
        if row.get("url") and row.get("canonical")
    }
    naver_match = match_naver_rows(
        naver_snapshot,
        [row.get("url") for row in page_scores.get("pages") or [] if row.get("url")],
        canonical_map=canonical_map,
    ) if naver_snapshot else None
    records = []
    for page in sorted(page_scores.get("pages") or [], key=lambda row: normalize_url(row.get("url"))):
        url = normalize_url(page.get("url"))
        audit_row = audit_map.get(url, {})
        if audit_row and not audit_row.get("indexable", True):
            continue
        performance_row = performance_map.get(url, {})
        history_row = history_map.get(url, {})
        experiment = experiment_map.get(url, {})
        record = {
            "url": url,
            "pageScore": page.get("score"),
            "pageType": page.get("type"),
            "cluster": "camping" if url.startswith("/kor/report/camp/") or performance_row.get("cluster") == "camping" else performance_row.get("cluster"),
            "inboundLinks": audit_row.get("inbound_links"),
            "duplicate": bool(audit_row.get("duplicate")),
            "lastOptimizationDate": history_row.get("lastOptimizationDate"),
            "experimentId": experiment.get("experiment_id"),
        }
        for channel_name, fields in CHANNEL_FIELDS.items():
            channel = performance_row.get(channel_name)
            record[channel_name] = normalize_channel(channel, fields, as_of) if channel else empty_channel(fields)
        if naver_match:
            naver_row = naver_match["matchedByUrl"].get(url)
            if naver_row:
                record["naver"] = {
                    "impressions": naver_row["impressions"],
                    "clicks": naver_row["clicks"],
                    "ctr": naver_row["ctr"],
                    "position": None,
                    "positionStatus": "NOT_AVAILABLE",
                    "status": "VERIFIED",
                    "period": naver_snapshot["period"],
                    "periodPreset": naver_snapshot["periodPreset"],
                    "source": naver_snapshot["source"],
                    "dataUpdatedAt": naver_snapshot["dataUpdatedAt"],
                    "crossSourceStatus": "PERIOD_MISMATCH",
                }
            else:
                record["naver"] = {
                    **empty_channel(CHANNEL_FIELDS["naver"], status="NOT_AVAILABLE"),
                    "positionStatus": "NOT_AVAILABLE",
                    "crossSourceStatus": "PERIOD_MISMATCH",
                }
        record.update(cooldown_state(record["lastOptimizationDate"], as_of, experiment.get("observe_until")))
        records.append(record)

    medians = _cluster_medians(records)
    naver_benchmarks = _camping_naver_benchmarks(records)
    if naver_benchmarks["coveredPages"]:
        medians.update({
            "naver_ctr": naver_benchmarks["ctrMedian"],
            "naver_impressions": naver_benchmarks["impressionsMedian"],
            "naver_max_impressions": naver_benchmarks["maxImpressions"],
            "naver_max_clicks": naver_benchmarks["maxClicks"],
            "naver_percentiles": naver_benchmarks["percentiles"],
        })
    naver_gate_passed = bool(naver_match and naver_match["quality"]["gatePassed"])
    for record in records:
        score = score_opportunity(record, medians)
        classification, action, reasons = classify_record(record, score)
        naver = record["naver"]
        eligible = (
            naver_gate_passed
            and record.get("cluster") == "camping"
            and naver.get("status") == "VERIFIED"
            and naver_benchmarks["impressionsMedian"] is not None
            and naver.get("impressions") >= naver_benchmarks["impressionsMedian"]
            and naver.get("ctr") < naver_benchmarks["ctrMedian"]
            and classification != "WINNER"
            and not record.get("cooldown")
        )
        if eligible:
            classification, action = "OPPORTUNITY", "IMPROVE_SEARCH_CTR"
            reasons = ["Naver impressions at or above camping median", "Naver CTR below camping median", "Verified camping demand"]
        elif naver_match and classification == "OPPORTUNITY":
            classification, action = "EXPERIMENT", "WAIT_FOR_DATA"
            reasons = ["Naver evidence does not satisfy the controlled Opportunity gate"]
        record.update(
            {
                "classification": classification,
                "revenueOpportunityScore": score["score"],
                "scoreStatus": score["status"],
                "scoreComponents": score["components"],
                "dataStatus": _data_status(record),
                "candidateDataStatus": "VERIFIED_WITH_LIMITATIONS" if eligible else _data_status(record),
                "nextAction": action,
                "reasons": reasons,
            }
        )
    active_experiment_count = sum(
        row.get("status") == "OBSERVING" for row in experiments.get("experiments") or []
    )
    selected = select_improvements(records, active_experiments=active_experiment_count) if (not naver_match or naver_gate_passed) else []
    ranked = sorted(records, key=lambda row: (-row["revenueOpportunityScore"], row["url"]))
    site = performance.get("site") or {}
    adsense = site.get("adsense") or {}
    ga4 = site.get("ga4") or {}
    revenue_28d = adsense.get("revenue_28d")
    indexed = len(records)
    period_compatibility = _period_compatibility(site)
    counts = Counter(row.get("classification") for row in records if row.get("classification"))
    kpis = {
        "revenue28d": {"value": revenue_28d, "status": adsense.get("status", "NOT_CONNECTED")},
        "dailyAverage28d": {"value": round(revenue_28d / 28, 2) if revenue_28d is not None else None, "status": adsense.get("status", "NOT_CONNECTED")},
        "indexedPages": {"value": indexed, "status": "VERIFIED"},
        "revenuePerIndexedPage": {"value": round(revenue_28d / indexed, 8) if revenue_28d is not None and indexed else None, "status": adsense.get("status", "NOT_CONNECTED")},
        "viewsPerActiveUser": {"value": round(ga4.get("views") / ga4.get("users"), 2) if ga4.get("views") is not None and ga4.get("users") else None, "status": ga4.get("status", "NOT_CONNECTED")},
        "revenueProducingPageRatio": {"value": None, "status": "INSUFFICIENT_DATA"},
        "searchActivePageRatio": {"value": None, "status": "INSUFFICIENT_DATA"},
        "winnerRevenueConcentration": {"value": None, "status": "INSUFFICIENT_DATA"},
        "combinedSearchRevenue": {"value": None, "status": "INSUFFICIENT_DATA" if period_compatibility == "MISMATCH" else "NOT_CALCULATED"},
    }
    phase_average = kpis["dailyAverage28d"]["value"] or 0
    phase = "PHASE 1" if phase_average < 1 else "PHASE 2" if phase_average < 3 else "PHASE 3" if phase_average < 10 else "PHASE 5" if phase_average < 30 else "LONG TERM"
    summary = {
        "schemaVersion": 1,
        "asOf": as_of,
        "periodCompatibility": period_compatibility,
        "crossSourcePeriodAlignment": "PERIOD_MISMATCH" if naver_match else period_compatibility,
        "phase": phase,
        "revenue": {
            "today": (adsense.get("daily") or {}).get("revenue"),
            "sevenDays": adsense.get("revenue_7d"),
            "twentyEightDays": revenue_28d,
            "dailyAverage": kpis["dailyAverage28d"]["value"],
            "previous28dChange": adsense.get("previous_28d_change"),
            "status": adsense.get("status", "NOT_CONNECTED"),
        },
        "traffic": {
            "views": ga4.get("views"),
            "users": ga4.get("users"),
            "viewsPerUser": kpis["viewsPerActiveUser"]["value"],
            "naverClicks": (site.get("naver") or {}).get("clicks"),
            "googleClicks": (site.get("google") or {}).get("clicks"),
        },
        "kpis": kpis,
        "classificationCounts": {
            **{name: counts.get(name, 0) for name in ("WINNER", "OPPORTUNITY", "EXPERIMENT", "DEAD_CANDIDATE")},
            "INSUFFICIENT_DATA": sum(not row.get("classification") for row in records),
        },
        "topOpportunities": ranked[:10],
        "selectedImprovements": selected,
        "eligibleCandidates": selected,
        "contentChanges": [],
        "dataQuality": {
            "naver": {
                **(naver_match["quality"] if naver_match else {"gatePassed": False, "gateFailures": ["NOT_CONNECTED"]}),
                "rankingReliable": bool(naver_gate_passed),
                "limitations": (naver_snapshot or {}).get("limitations") or [],
            }
        },
        "protectedWinners": [row for row in records if row.get("classification") == "WINNER"],
        "activeExperiments": experiments.get("experiments") or [],
        "contentGrowth": content_growth_summary(content_experiments.get("experiments") or [], as_of),
        "campingCluster": {**_camping_cluster(records), "naver": naver_benchmarks},
        "growthDrivers": {
            "status": "ESTIMATED",
            "revenueChange": adsense.get("previous_28d_change"),
            "pvGrowth": None,
            "rpmImprovement": None,
            "campingContribution": None,
            "reason": "Matched prior-period PV, RPM and URL revenue coverage are unavailable.",
        },
    }
    page_payload = {
        "schemaVersion": 1,
        "asOf": as_of,
        "summary": {"evaluatedIndexablePages": indexed},
        "pages": records,
    }
    _write_json(page_output, page_payload, compact=True)
    _write_json(opportunity_output, summary)
    report_output = Path(report_output)
    report_output.parent.mkdir(parents=True, exist_ok=True)
    report_output.write_text(_render_report(summary), encoding="utf-8")
    return page_payload, summary


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--page-scores", type=Path, default=Path("data/page-scores.json"))
    parser.add_argument("--audit", type=Path, default=Path("data/site-audit.json"))
    parser.add_argument("--performance", type=Path, default=Path("data/performance/2026-08-31.json"))
    parser.add_argument("--experiments", type=Path, default=Path("data/experiments.json"))
    parser.add_argument("--optimization-history", type=Path, default=Path("data/optimization-history.json"))
    parser.add_argument("--naver-snapshot", type=Path, default=Path("data/naver/search-advisor-2026-08-30.json"))
    parser.add_argument("--content-experiments", type=Path, default=Path("data/content-launch-experiments.json"))
    parser.add_argument("--as-of", required=True)
    parser.add_argument("--page-output", type=Path, default=Path("data/page-performance.json"))
    parser.add_argument("--opportunity-output", type=Path, default=Path("data/revenue-opportunities.json"))
    parser.add_argument("--report", type=Path, default=Path("reports/revenue-growth-report.md"))
    args = parser.parse_args()
    _, summary = run_revenue_growth(
        page_scores_path=args.page_scores,
        audit_path=args.audit,
        performance_path=args.performance,
        experiments_path=args.experiments,
        optimization_history_path=args.optimization_history,
        naver_snapshot_path=args.naver_snapshot,
        content_experiments_path=args.content_experiments,
        as_of=args.as_of,
        page_output=args.page_output,
        opportunity_output=args.opportunity_output,
        report_output=args.report,
    )
    print(json.dumps({"top": len(summary["topOpportunities"]), "selected": len(summary["selectedImprovements"])}))


if __name__ == "__main__":
    main()
