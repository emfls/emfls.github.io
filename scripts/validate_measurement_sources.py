#!/usr/bin/env python3
"""Fail closed unless the tracked measurement snapshots are publishable inputs."""

import argparse
import json
from datetime import date, datetime, timedelta
from pathlib import Path

try:
    from scripts.collect_adsense_snapshot import CollectorError, validate_snapshot as validate_adsense_snapshot
except ModuleNotFoundError:
    from collect_adsense_snapshot import CollectorError, validate_snapshot as validate_adsense_snapshot


GA4_SOURCE = "GOOGLE_ANALYTICS_DATA_API"
GSC_SOURCE = "GOOGLE_SEARCH_CONSOLE_API"
ADSENSE_SOURCE = "DIRECT_ADSENSE_MANAGEMENT_API_V2"
GSC_PROPERTY = "https://emfls.github.io/"
ADSENSE_DOMAIN = "emfls.github.io"


def _date(value, label):
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        raise ValueError(f"{label} must be an ISO date") from None


def _timestamp(value, label):
    if not isinstance(value, str) or not value:
        raise ValueError(f"{label} is required")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise ValueError(f"{label} must be an ISO timestamp") from None
    if parsed.tzinfo is None:
        raise ValueError(f"{label} must include a timezone")
    return parsed


def _period(start, end, label):
    start_date, end_date = _date(start, f"{label} start"), _date(end, f"{label} end")
    if start_date > end_date:
        raise ValueError(f"{label} range is reversed")
    return {"start": start_date.isoformat(), "end": end_date.isoformat()}


def _validate_ga4(snapshot, as_of):
    if not isinstance(snapshot, dict):
        raise ValueError("GA4 snapshot must be an object")
    collection = snapshot.get("collection") or {}
    site = (snapshot.get("site") or {}).get("ga4") or {}
    period = _period(
        ((snapshot.get("periods") or {}).get("ga4") or {}).get("start"),
        ((snapshot.get("periods") or {}).get("ga4") or {}).get("end"),
        "GA4 period",
    )
    if collection.get("source") != GA4_SOURCE or site.get("source") != GA4_SOURCE:
        raise ValueError("GA4 source metadata is invalid")
    if site.get("status") != "VERIFIED" or site.get("revenueMetric") != "totalAdRevenue":
        raise ValueError("GA4 site evidence is not verified with totalAdRevenue semantics")
    if _period((site.get("period") or {}).get("start"), (site.get("period") or {}).get("end"), "GA4 site period") != period:
        raise ValueError("GA4 site period does not match the snapshot period")
    _timestamp(collection.get("collectedAt"), "GA4 collectedAt")
    snapshot_as_of = _date(snapshot.get("as_of"), "GA4 as_of")
    if snapshot_as_of > as_of:
        raise ValueError("GA4 as_of is in the future")
    age_days = (as_of - date.fromisoformat(period["end"])).days
    # This retains the existing GA4 workflow freshness rule.
    if age_days < 0 or age_days > 7:
        raise ValueError(f"GA4 period is stale under the existing seven-day rule (age={age_days})")
    pages = snapshot.get("pages")
    if not isinstance(pages, list) or not pages:
        raise ValueError("GA4 snapshot must contain page rows")
    for row in pages:
        evidence = row.get("ga4") if isinstance(row, dict) else None
        if not isinstance(row, dict) or not isinstance(row.get("url"), str) or not row["url"] or not isinstance(evidence, dict):
            raise ValueError("GA4 snapshot contains a malformed page row")
        if evidence.get("source") != GA4_SOURCE or evidence.get("status") != "VERIFIED":
            raise ValueError("GA4 page row is not verified source evidence")
        if _period((evidence.get("period") or {}).get("start"), (evidence.get("period") or {}).get("end"), "GA4 page period") != period:
            raise ValueError("GA4 page period does not match the snapshot period")
    return period


def _validate_gsc(snapshot, as_of):
    if not isinstance(snapshot, dict):
        raise ValueError("GSC snapshot must be an object")
    if (
        snapshot.get("status") != "VERIFIED"
        or snapshot.get("source") != GSC_SOURCE
        or snapshot.get("property") != GSC_PROPERTY
    ):
        raise ValueError("GSC source metadata is invalid")
    period = _period(snapshot.get("periodStart"), snapshot.get("periodEnd"), "GSC period")
    nested_period = (snapshot.get("periods") or {}).get("gsc") or {}
    if _period(nested_period.get("start"), nested_period.get("end"), "GSC nested period") != period:
        raise ValueError("GSC period metadata is inconsistent")
    _timestamp(snapshot.get("generatedAt"), "GSC generatedAt")
    if (date.fromisoformat(period["end"]) - date.fromisoformat(period["start"])).days + 1 != 28:
        raise ValueError("GSC page snapshot must retain its current 28-day collection window")
    expected_end = as_of - timedelta(days=3)
    if date.fromisoformat(period["end"]) != expected_end:
        raise ValueError("GSC period end is stale under its existing three-day collection window")
    pages = snapshot.get("pages")
    if not isinstance(pages, list) or not pages:
        raise ValueError("GSC snapshot must contain page rows")
    for row in pages:
        evidence = row.get("google") if isinstance(row, dict) else None
        if not isinstance(row, dict) or not isinstance(row.get("url"), str) or not row["url"] or not isinstance(evidence, dict):
            raise ValueError("GSC snapshot contains a malformed page row")
        if (
            evidence.get("source") != GSC_SOURCE
            or evidence.get("property") != GSC_PROPERTY
            or evidence.get("status") != "VERIFIED"
        ):
            raise ValueError("GSC page row is not verified source evidence")
        row_period = evidence.get("period") or {}
        if _period(row_period.get("start"), row_period.get("end"), "GSC page period") != period:
            raise ValueError("GSC page period does not match the snapshot period")
    return period


def _validate_adsense(snapshot, as_of):
    try:
        validate_adsense_snapshot(snapshot)
    except (CollectorError, TypeError, AttributeError) as error:
        raise ValueError(f"AdSense snapshot is invalid: {error}") from None
    site = snapshot.get("site") or {}
    if snapshot.get("source") != ADSENSE_SOURCE or site.get("domain") != ADSENSE_DOMAIN:
        raise ValueError("AdSense source metadata is invalid")
    if site.get("status") not in {"VERIFIED", "PARTIAL"}:
        raise ValueError("AdSense site summary is not available for comparison")
    if site.get("comparisonStatus") != "VERIFIED":
        raise ValueError("AdSense site comparison is not verified")
    _timestamp(snapshot.get("generatedAt"), "AdSense generatedAt")
    current = snapshot.get("currentPeriod") or {}
    prior = snapshot.get("priorPeriod") or {}
    if date.fromisoformat(current["end"]) != as_of - timedelta(days=1):
        raise ValueError("AdSense current period end is stale under its existing yesterday-ending window")
    if date.fromisoformat(prior["end"]).toordinal() + 1 != date.fromisoformat(current["start"]).toordinal():
        raise ValueError("AdSense current and prior periods are not adjacent")
    return site["status"]


def validate_measurement_sources(ga4, gsc, adsense, *, as_of):
    """Validate source structure and existing freshness contracts without network access."""
    as_of_date = _date(as_of, "as_of")
    _validate_ga4(ga4, as_of_date)
    _validate_gsc(gsc, as_of_date)
    adsense_status = _validate_adsense(adsense, as_of_date)
    return {"ga4": "VERIFIED", "gsc": "VERIFIED", "adsense": adsense_status}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ga4", type=Path, default=Path("data/performance/ga4-latest.json"))
    parser.add_argument("--gsc", type=Path, default=Path("data/performance/gsc-latest.json"))
    parser.add_argument("--adsense", type=Path, default=Path("data/performance/adsense-latest.json"))
    parser.add_argument("--as-of", required=True)
    args = parser.parse_args()
    snapshots = [json.loads(path.read_text(encoding="utf-8")) for path in (args.ga4, args.gsc, args.adsense)]
    result = validate_measurement_sources(*snapshots, as_of=args.as_of)
    print(json.dumps({"sources": result, "asOf": args.as_of}, sort_keys=True))


if __name__ == "__main__":
    main()
