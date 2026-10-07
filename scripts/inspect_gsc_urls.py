#!/usr/bin/env python3
"""Artifact-only Google Search Console URL Inspection collector for the fixed JP B25."""

from __future__ import annotations

import argparse
import base64
import csv
import datetime as dt
import hashlib
import json
import os
import shutil
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse


PROPERTY_URL = "https://emfls.github.io/"
AUDIT_BRANCH = "codex/jp-b25-url-inspection-audit-20261007"
EXPECTED_ROUTE_SHA256 = "0da63fa6450d2d3c956d44d74b24e05012a42d0fcbc580691a8d29dbcc86727c"
REQUEST_LANGUAGE_CODE = "en-US"
CLASSIFICATIONS = (
    "INDEXED",
    "NOT_INDEXED",
    "URL_UNKNOWN_TO_GOOGLE",
    "CRAWLED_NOT_INDEXED",
    "DISCOVERED_NOT_INDEXED",
    "BLOCKED",
    "INSPECTION_UNKNOWN",
)
INDEX_STATUS_FIELDS = (
    "verdict",
    "coverageState",
    "robotsTxtState",
    "indexingState",
    "pageFetchState",
    "lastCrawlTime",
    "googleCanonical",
    "userCanonical",
    "referringUrls",
    "sitemap",
)
DECISION_FIELDS = (
    "classification",
    "inspectionResultLink",
    *INDEX_STATUS_FIELDS,
    "returnedIndexStatusFields",
    "inspectionErrorClass",
    "inspectionErrorStatus",
)
BLOCKED_FETCH_STATES = {
    "BLOCKED_ROBOTS_TXT",
    "ACCESS_DENIED",
    "ACCESS_FORBIDDEN",
    "BLOCKED_4XX",
}
BLOCKED_INDEXING_STATES = {
    "BLOCKED_BY_META_TAG",
    "BLOCKED_BY_HTTP_HEADER",
    "BLOCKED_BY_ROBOTS_TXT",
}
EXPLICIT_NOT_INDEXED = {
    "NOT_INDEXED",
    "URL_UNKNOWN_TO_GOOGLE",
    "CRAWLED_NOT_INDEXED",
    "DISCOVERED_NOT_INDEXED",
}


def load_manifest(path: Path | str) -> list[dict[str, str]]:
    manifest_path = Path(path)
    with manifest_path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames or not {"selectionOrdinal", "url", "route", "selectionSet"}.issubset(reader.fieldnames):
            raise ValueError("B25 manifest is missing required columns")
        rows = list(reader)

    if len(rows) != 25:
        raise ValueError(f"B25 manifest must contain exactly 25 rows; found {len(rows)}")
    routes = [row["route"] for row in rows]
    route_digest = hashlib.sha256(("\n".join(routes) + "\n").encode("utf-8")).hexdigest()
    if route_digest != EXPECTED_ROUTE_SHA256:
        raise ValueError("B25 route set or order differs from the frozen input manifest")
    if len(set(routes)) != 25:
        raise ValueError("B25 manifest contains duplicate routes")

    for ordinal, row in enumerate(rows, start=1):
        route = row["route"]
        parsed = urlparse(row["url"])
        if row["selectionOrdinal"] != str(ordinal):
            raise ValueError("B25 manifest selection ordinals must be contiguous and ordered")
        if row["selectionSet"] != "NESTED_REFINED_B25_OF_B100":
            raise ValueError("B25 manifest has an unexpected selection set")
        if parsed.scheme != "https" or parsed.netloc != "emfls.github.io":
            raise ValueError(f"B25 URL is outside the authorized property: {row['url']}")
        if parsed.path != route or not route.startswith("/jp/report/travel/") or not route.endswith(".html"):
            raise ValueError(f"B25 URL does not match its route: {row['url']}")

    return rows


def _index_status(record: dict) -> tuple[dict | None, dict | None]:
    response = record.get("response")
    if not isinstance(response, dict):
        return None, None
    inspection_result = response.get("inspectionResult")
    if not isinstance(inspection_result, dict):
        return None, None
    index_status = inspection_result.get("indexStatusResult")
    if not isinstance(index_status, dict):
        return inspection_result, None
    return inspection_result, index_status


def classify_inspection(record: dict) -> str:
    if not isinstance(record, dict) or "error" in record:
        return "INSPECTION_UNKNOWN"
    inspection_result, index_status = _index_status(record)
    if not isinstance(inspection_result, dict) or not isinstance(index_status, dict):
        return "INSPECTION_UNKNOWN"

    robots_state = index_status.get("robotsTxtState")
    fetch_state = index_status.get("pageFetchState")
    indexing_state = index_status.get("indexingState")
    if (
        robots_state == "DISALLOWED"
        or fetch_state in BLOCKED_FETCH_STATES
        or indexing_state in BLOCKED_INDEXING_STATES
    ):
        return "BLOCKED"

    coverage_state = index_status.get("coverageState")
    if isinstance(coverage_state, str):
        coverage = coverage_state.casefold()
        if "unknown to google" in coverage:
            return "URL_UNKNOWN_TO_GOOGLE"
        if "crawled" in coverage and "currently not indexed" in coverage:
            return "CRAWLED_NOT_INDEXED"
        if "discovered" in coverage and "currently not indexed" in coverage:
            return "DISCOVERED_NOT_INDEXED"

    verdict = index_status.get("verdict")
    if verdict == "PASS":
        return "INDEXED"
    if verdict in {"FAIL", "NEUTRAL"}:
        return "NOT_INDEXED"
    return "INSPECTION_UNKNOWN"


def inspect_urls(
    urls: list[str],
    service,
    *,
    property_url: str = PROPERTY_URL,
    language_code: str = REQUEST_LANGUAGE_CODE,
) -> list[dict]:
    """Inspect each URL once, with client retries disabled, preserving response JSON."""
    index_api = service.urlInspection().index()
    records = []
    for url in urls:
        request = index_api.inspect(
            body={
                "inspectionUrl": url,
                "siteUrl": property_url,
                "languageCode": language_code,
            }
        )
        try:
            response = request.execute(num_retries=0)
        except Exception as exc:  # API errors are retained per URL; never retried here.
            response_info = getattr(exc, "resp", None)
            status = getattr(response_info, "status", None)
            records.append(
                {
                    "inspectionUrl": url,
                    "error": {"class": type(exc).__name__, "status": status},
                }
            )
        else:
            records.append({"inspectionUrl": url, "response": response})
    return records


def _csv_value(value):
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if value is None:
        return ""
    return value


def build_decision_rows(
    manifest_rows: list[dict[str, str]],
    inspection_records: list[dict],
) -> list[dict]:
    records_by_url = {record.get("inspectionUrl"): record for record in inspection_records}
    output = []
    for input_row in manifest_rows:
        record = records_by_url.get(input_row["url"], {})
        inspection_result, index_status = _index_status(record)
        index_status = index_status or {}
        error = record.get("error") if isinstance(record, dict) else None
        row = dict(input_row)
        row["classification"] = classify_inspection(record)
        row["inspectionResultLink"] = (
            inspection_result.get("inspectionResultLink", "")
            if isinstance(inspection_result, dict)
            else ""
        )
        for field in INDEX_STATUS_FIELDS:
            row[field] = _csv_value(index_status[field]) if field in index_status else ""
        row["returnedIndexStatusFields"] = json.dumps(
            list(index_status.keys()), ensure_ascii=False, separators=(",", ":")
        )
        row["inspectionErrorClass"] = error.get("class", "") if isinstance(error, dict) else ""
        row["inspectionErrorStatus"] = error.get("status", "") if isinstance(error, dict) else ""
        output.append(row)
    return output


def _period(rows: list[dict[str, str]], start_field: str, end_field: str) -> dict:
    starts = sorted({row.get(start_field, "") for row in rows if row.get(start_field, "")})
    ends = sorted({row.get(end_field, "") for row in rows if row.get(end_field, "")})
    if len(starts) == 1 and len(ends) == 1:
        return {"start": starts[0], "end": ends[0]}
    if not starts and not ends:
        return {"start": None, "end": None}
    return {"startValues": starts, "endValues": ends}


def _is_true(row: dict[str, str], key: str) -> bool:
    return str(row.get(key, "")).casefold() == "true"


def _json_array_is_empty(row: dict[str, str], key: str) -> bool:
    try:
        value = json.loads(row.get(key, "") or "[]")
    except json.JSONDecodeError:
        return False
    return isinstance(value, list) and len(value) == 0


def _row_has_positive_gsc_signal(row: dict[str, str]) -> bool:
    if row.get("gscTrackedSnapshotRowStatus") != "ROW_PRESENT":
        return False
    for key in ("gscTrackedSnapshotClicks", "gscTrackedSnapshotImpressions"):
        raw = row.get(key, "")
        try:
            if raw and float(raw) > 0:
                return True
        except (TypeError, ValueError):
            continue
    return False


def summarize(
    manifest_rows: list[dict[str, str]],
    inspection_records: list[dict],
) -> dict:
    records_by_url = {record.get("inspectionUrl"): record for record in inspection_records}
    class_counts = Counter(
        classify_inspection(records_by_url.get(row["url"], {}))
        for row in manifest_rows
    )
    classification_counts = {label: class_counts.get(label, 0) for label in CLASSIFICATIONS}

    ga4_period_known = 0
    for row in manifest_rows:
        start = row.get("candidateGA4WindowStart", "")
        end = row.get("candidateGA4WindowEnd", "")
        try:
            days = (dt.date.fromisoformat(end) - dt.date.fromisoformat(start)).days + 1
        except (TypeError, ValueError):
            days = 0
        if days >= 90:
            ga4_period_known += 1

    positive_gsc_rows = [row for row in manifest_rows if _row_has_positive_gsc_signal(row)]
    eligible_routes = []
    for row in manifest_rows:
        record = records_by_url.get(row["url"], {})
        category = classify_inspection(record)
        age = row.get("ageDaysAsOf2026-10-07", "")
        try:
            old_enough = int(age) >= 365
        except (TypeError, ValueError):
            old_enough = False
        no_dependencies = all(
            _json_array_is_empty(row, key)
            for key in ("feedFiles", "indexFiles", "codeReferences", "testReferences")
        )
        no_links = all(
            row.get(key) == "0"
            for key in ("sameLocaleInboundHtml", "crossLocaleInboundHtml", "localHrefInboundHtml")
        )
        protected = _is_true(row, "protectedWinner") or _is_true(row, "activeExperiment") or _is_true(row, "contentLaunchExperiment")
        if (
            category in EXPLICIT_NOT_INDEXED
            and row.get("status") == "GA4_90D_NO_ACTIVITY_ROW"
            and ga4_period_known == len(manifest_rows)
            and not _row_has_positive_gsc_signal(row)
            and old_enough
            and no_links
            and no_dependencies
            and not protected
        ):
            eligible_routes.append(row["route"])

    indexed_hold = classification_counts["INDEXED"]
    inspection_unknown_hold = classification_counts["INSPECTION_UNKNOWN"]
    blocked_hold = classification_counts["BLOCKED"]
    eligible_route_set = set(eligible_routes)
    explicitly_not_indexed_but_held = sum(
        classify_inspection(records_by_url.get(row["url"], {})) in EXPLICIT_NOT_INDEXED
        and row["route"] not in eligible_route_set
        for row in manifest_rows
    )
    hold_count = indexed_hold + inspection_unknown_hold + blocked_hold + explicitly_not_indexed_but_held
    high_confidence_bytes = sum(
        int(row.get("bytes", "0") or 0)
        for row in manifest_rows
        if row["route"] in set(eligible_routes)
    )

    return {
        "siteUrl": PROPERTY_URL,
        "requestLanguageCode": REQUEST_LANGUAGE_CODE,
        "inputCount": len(manifest_rows),
        "inspectionRecordCount": len(inspection_records),
        "classificationCounts": classification_counts,
        "indexedHoldCount": indexed_hold,
        "inspectionUnknownOrBlockedHoldCount": inspection_unknown_hold + blocked_hold,
        "explicitlyNotIndexedButHeldCount": explicitly_not_indexed_but_held,
        "holdCount": hold_count,
        "ga4CandidateStatus": {
            "GA4_90D_NO_ACTIVITY_ROW": sum(
                row.get("status") == "GA4_90D_NO_ACTIVITY_ROW" for row in manifest_rows
            ),
            "sourceWindowProvenInManifest": ga4_period_known,
            "trackedSnapshotWindow": _period(
                manifest_rows, "ga4TrackedSnapshotPeriodStart", "ga4TrackedSnapshotPeriodEnd"
            ),
            "trackedSnapshotRowsReturned": int(
                manifest_rows[0].get("ga4TrackedSnapshotPageRowCount", "0") or 0
            ),
            "B25RowsPresentInTrackedSnapshot": sum(
                row.get("ga4TrackedSnapshotRowStatus") == "ROW_PRESENT" for row in manifest_rows
            ),
            "B25RowsAbsentInTrackedSnapshot": sum(
                row.get("ga4TrackedSnapshotRowStatus") == "ROW_ABSENT" for row in manifest_rows
            ),
        },
        "gscPageSignal": {
            "trackedSnapshotWindow": _period(
                manifest_rows, "gscTrackedSnapshotPeriodStart", "gscTrackedSnapshotPeriodEnd"
            ),
            "trackedSnapshotStatus": manifest_rows[0].get("gscTrackedSnapshotStatus"),
            "trackedSnapshotPageRowsReturned": int(
                manifest_rows[0].get("gscTrackedSnapshotPageRowCount", "0") or 0
            ),
            "B25RowsPresentInTrackedSnapshot": sum(
                row.get("gscTrackedSnapshotRowStatus") == "ROW_PRESENT" for row in manifest_rows
            ),
            "B25PositiveClickOrImpressionRows": len(positive_gsc_rows),
            "B25RowsAbsentInTrackedSnapshot": sum(
                row.get("gscTrackedSnapshotRowStatus") == "ROW_ABSENT" for row in manifest_rows
            ),
            "coverageCompleteness": "NOT_ASSERTED",
            "missingRowsMeanZero": False,
        },
        "gscOpportunityQuerySnapshot": {
            "window": _period(
                manifest_rows,
                "gscOpportunitySnapshotPeriodStart",
                "gscOpportunitySnapshotPeriodEnd",
            ),
            "pageRowsReturned": int(
                manifest_rows[0].get("gscOpportunitySnapshotPageRowCount", "0") or 0
            ),
            "B25RowsPresent": sum(
                row.get("gscOpportunitySnapshotRowStatus") == "ROW_PRESENT"
                for row in manifest_rows
            ),
            "B25RowsAbsent": sum(
                row.get("gscOpportunitySnapshotRowStatus") == "ROW_ABSENT"
                for row in manifest_rows
            ),
        },
        "zeroLocalInboundLinksCount": sum(
            row.get("localHrefInboundHtml") == "0" for row in manifest_rows
        ),
        "protectedWinnerCount": sum(_is_true(row, "protectedWinner") for row in manifest_rows),
        "activeExperimentCount": sum(_is_true(row, "activeExperiment") for row in manifest_rows),
        "contentLaunchExperimentCount": sum(
            _is_true(row, "contentLaunchExperiment") for row in manifest_rows
        ),
        "editorialReview": {
            "reviewedPages": len(manifest_rows),
            "poorNaturalness": sum(
                row.get("editorialNaturalness") == "POOR" for row in manifest_rows
            ),
            "pervasiveMachineTranslationArtifacts": sum(
                row.get("machineTranslationArtifacts") == "PERVASIVE"
                for row in manifest_rows
            ),
            "lowPracticalUsefulness": sum(
                row.get("factualUsefulness") == "LOW_FOR_PRACTICAL_PLANNING"
                for row in manifest_rows
            ),
            "noVisibleAsOfDate": sum(
                row.get("stalenessReview") == "UNVERIFIED_NO_VISIBLE_AS_OF_DATE"
                for row in manifest_rows
            ),
            "templateHeavy": sum(
                row.get("templateHeaviness") == "HIGH" for row in manifest_rows
            ),
            "externallyFactChecked": False,
        },
        "highConfidenceDeleteCandidateCount": len(eligible_routes),
        "highConfidenceDeleteCandidateBytes": high_confidence_bytes,
        "highConfidenceDeleteCandidateRoutes": eligible_routes,
        "dataLimitations": [
            "The analyzed-500 export carries GA4_90D_NO_ACTIVITY_ROW labels but no exact 90-day start/end dates; the collector does not treat that label as a reproducible 90-day window.",
            "The current tracked GA4 snapshot is a shorter separately reported window; a missing URL row is not a zero metric.",
            "GSC page rows are a partial returned set with no completeness guarantee in the artifact; missing URL rows are not zero clicks or impressions.",
            "Editorial review covers local page text and visible freshness cues; travel facts, prices, visa rules, and venue status were not externally fact-checked.",
        ],
    }


def write_artifacts(
    manifest_path: Path | str,
    manifest_rows: list[dict[str, str]],
    inspection_records: list[dict],
    output_dir: Path | str,
) -> dict:
    if len(manifest_rows) != 25 or len(inspection_records) != 25:
        raise ValueError("The JP B25 audit must contain exactly 25 manifest rows and 25 inspection records")
    expected_urls = [row["url"] for row in manifest_rows]
    actual_urls = [record.get("inspectionUrl") for record in inspection_records]
    if actual_urls != expected_urls:
        raise ValueError("Inspection records must match the frozen B25 URLs in manifest order")

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(Path(manifest_path), output_dir / "b25-input-manifest.csv")

    raw_payload = {
        "siteUrl": PROPERTY_URL,
        "requestLanguageCode": REQUEST_LANGUAGE_CODE,
        "records": inspection_records,
    }
    (output_dir / "b25-url-inspection.json").write_text(
        json.dumps(raw_payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    decision_rows = build_decision_rows(manifest_rows, inspection_records)
    fieldnames = list(manifest_rows[0].keys()) + list(DECISION_FIELDS)
    with (output_dir / "b25-decision.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(decision_rows)

    summary = summarize(manifest_rows, inspection_records)
    (output_dir / "b25-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return summary


def create_service_from_environment():
    encoded = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON_B64", "")
    if not encoded:
        raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON_B64 is not set")
    try:
        info = json.loads(base64.b64decode(encoded, validate=True).decode("utf-8"))
    except Exception as exc:
        raise RuntimeError("Search Console service account secret is not valid base64 JSON") from exc
    if not isinstance(info, dict) or info.get("type") != "service_account":
        raise RuntimeError("Search Console service account JSON is missing type=service_account")

    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    credentials = service_account.Credentials.from_service_account_info(
        info,
        scopes=["https://www.googleapis.com/auth/webmasters.readonly"],
    )
    return build("searchconsole", "v1", credentials=credentials, cache_discovery=False)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path("data/jp-b25-url-inspection-input-20261007.csv"),
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(os.environ.get("RUNNER_TEMP", "/tmp"))
        / f"jp-b25-url-inspection-{os.environ.get('GITHUB_RUN_ID', 'local')}",
    )
    args = parser.parse_args()

    manifest_rows = load_manifest(args.manifest)
    service = create_service_from_environment()
    inspection_records = inspect_urls([row["url"] for row in manifest_rows], service)
    summary = write_artifacts(args.manifest, manifest_rows, inspection_records, args.output_dir)
    print(
        json.dumps(
            {
                "inputCount": summary["inputCount"],
                "inspectionRecordCount": summary["inspectionRecordCount"],
                "classificationCounts": summary["classificationCounts"],
                "errorCount": sum(
                    isinstance(record.get("error"), dict) for record in inspection_records
                ),
                "outputDir": str(args.output_dir),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
