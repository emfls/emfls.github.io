#!/usr/bin/env python3
"""Validate GSC page/query snapshot provenance and coverage without joining metrics.

This utility is intentionally offline and read-only with respect to input snapshots.
It reports only structural counts and fingerprints; raw query strings are never emitted.
"""
import argparse
import hashlib
import json
import os
import sys
import tempfile
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit

EXPECTED_SOURCE = "GOOGLE_SEARCH_CONSOLE_API"
EXPECTED_PROPERTY = "https://emfls.github.io/"


class SnapshotError(ValueError):
    pass


def file_fingerprint(path):
    data = Path(path).read_bytes()
    # Git blob IDs hash "blob <size>\\0<bytes>" with SHA-1.
    git_header = b"blob " + str(len(data)).encode("ascii") + bytes([0])
    return {
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "gitBlobSha1": hashlib.sha1(git_header + data).hexdigest(),
    }


def normalize_url(value, property_url):
    if not isinstance(value, str) or not value.strip():
        raise SnapshotError("URL is empty or not a string")
    raw = value.strip()
    parsed = urlsplit(raw)
    prop = urlsplit(property_url)
    if parsed.scheme or parsed.netloc:
        if parsed.scheme.lower() not in {"http", "https"} or parsed.netloc.lower() != prop.netloc.lower():
            raise SnapshotError("URL is outside the declared Search Console property")
        path = parsed.path or "/"
    else:
        path = raw
    path = path.split("?", 1)[0].split("#", 1)[0] or "/"
    if not path.startswith("/"):
        path = "/" + path
    return path


def _period_from(payload, *, page=False):
    start, end = payload.get("periodStart"), payload.get("periodEnd")
    periods = payload.get("periods")
    if isinstance(periods, dict):
        preferred = periods.get("gsc") if page else None
        if not isinstance(preferred, dict) and len(periods) == 1:
            preferred = next(iter(periods.values()))
        if isinstance(preferred, dict):
            start = start or preferred.get("start")
            end = end or preferred.get("end")
    if not start or not end:
        return None
    try:
        date.fromisoformat(start)
        date.fromisoformat(end)
    except (TypeError, ValueError):
        return None
    if start > end:
        return None
    return {"start": start, "end": end}


def _base_metadata(payload, *, page=False):
    raw_dimensions = payload.get("dimensions")
    expected = ["page"] if page else ["page", "query"]
    if raw_dimensions is None or raw_dimensions == "":
        dimensions = "UNKNOWN"
        dimensions_ok = None
        dimensions_status = "UNKNOWN"
    else:
        dimensions = raw_dimensions
        dimensions_ok = isinstance(dimensions, list) and dimensions == expected
        dimensions_status = "VALID" if dimensions_ok else "INVALID"

    def known_value(key):
        value = payload.get(key)
        return "UNKNOWN" if value is None or value == "" else value

    return {
        "status": known_value("status"),
        "source": known_value("source"),
        "property": known_value("property"),
        "period": _period_from(payload, page=page) or "UNKNOWN",
        "generatedAt": known_value("generatedAt"),
        "timeZone": known_value("timeZone"),
        "searchType": known_value("searchType"),
        "aggregationType": known_value("aggregationType"),
        "dimensions": dimensions,
        "dimensionsStatus": dimensions_status,
        "dimensionsValid": dimensions_ok,
        "completenessGuaranteed": known_value("completenessGuaranteed"),
    }


def _load_snapshot(path, *, page):
    try:
        raw = Path(path).read_bytes()
        payload = json.loads(raw)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise SnapshotError("snapshot cannot be read as UTF-8 JSON") from exc
    if not isinstance(payload, dict):
        raise SnapshotError("snapshot root must be a JSON object")
    metadata = _base_metadata(payload, page=page)
    if metadata["status"] != "VERIFIED" or metadata["source"] != EXPECTED_SOURCE:
        raise SnapshotError("snapshot status or source is not verified GSC evidence")
    if metadata["property"] not in {"UNKNOWN", EXPECTED_PROPERTY}:
        raise SnapshotError("Search Console property is not the canonical property")
    if metadata["period"] == "UNKNOWN":
        raise SnapshotError("native period is missing or invalid")
    page_query_rows = payload.get("rows") if not page and not isinstance(payload.get("pages"), list) else None
    flat_query_rows = isinstance(page_query_rows, list)
    records = payload.get("pages") if page or isinstance(payload.get("pages"), list) else page_query_rows
    if not isinstance(records, list):
        raise SnapshotError("page/query records array is missing")
    urls = {}
    query_rows = 0
    urls_with_query_rows = 0
    explicit_no_rows = 0
    flat_pages_with_rows = set()
    query_pairs = set()
    for record in records:
        if not isinstance(record, dict):
            raise SnapshotError("record is not an object")
        raw_url = record.get("url") if "url" in record else record.get("page")
        url = normalize_url(raw_url, metadata["property"])
        if flat_query_rows:
            # The camping collector stores one page×query tuple per row, so page
            # URLs intentionally repeat. Coverage is measured on unique pages.
            urls.setdefault(url, record)
            query = record.get("query")
            if query is not None:
                if not isinstance(query, str) or not query:
                    raise SnapshotError("page×query record has an invalid query value")
                pair = (url, query)
                if pair in query_pairs:
                    raise SnapshotError("duplicate normalized page×query pair")
                query_pairs.add(pair)
                query_rows += 1
                flat_pages_with_rows.add(url)
            continue
        if url in urls:
            raise SnapshotError("duplicate URL after normalization")
        urls[url] = record
        if not page:
            query_list = record.get("queries")
            if query_list is None:
                query_list = [record] if record.get("query") is not None else []
            if not isinstance(query_list, list):
                raise SnapshotError("queries field must be an array")
            if query_list:
                for query_record in query_list:
                    if not isinstance(query_record, dict) or not isinstance(query_record.get("query"), str) or not query_record["query"]:
                        raise SnapshotError("queries contains an invalid page×query record")
                    pair = (url, query_record["query"])
                    if pair in query_pairs:
                        raise SnapshotError("duplicate normalized page×query pair")
                    query_pairs.add(pair)
                urls_with_query_rows += 1
                query_rows += len(query_list)
            elif record.get("status") == "NO_QUERY_ROWS_RETURNED":
                explicit_no_rows += 1
    if flat_query_rows:
        urls_with_query_rows = len(flat_pages_with_rows)
    if page:
        if not records:
            raise SnapshotError("page snapshot contains no rows")
        for url, record in urls.items():
            google = record.get("google")
            if not isinstance(google, dict):
                raise SnapshotError("page row lacks google evidence")
            if google.get("status") != "VERIFIED" or google.get("source") != EXPECTED_SOURCE:
                raise SnapshotError("page row is not verified GSC evidence")
            if google.get("property") != EXPECTED_PROPERTY:
                raise SnapshotError("page row property is not the canonical property")
            if metadata["property"] != "UNKNOWN" and google.get("property") != metadata["property"]:
                raise SnapshotError("page row property differs from snapshot property")
            if google.get("period") != metadata["period"]:
                raise SnapshotError("page row period differs from snapshot period")
    return {
        "payload": payload,
        "metadata": metadata,
        "urls": urls,
        "fingerprint": file_fingerprint(path),
        "dataUnit": "PAGE_ONLY" if page else "PAGE_X_QUERY",
        "coverage": {
            "recordUrls": len(urls),
            "urlsWithQueryRows": urls_with_query_rows,
            "urlsWithExplicitNoQueryRows": explicit_no_rows,
            "queryRows": query_rows,
        } if not page else {"recordUrls": len(urls)},
    }


def _required_metadata_complete(page, query):
    required = ("generatedAt", "timeZone", "searchType", "aggregationType")
    comparable = ("timeZone", "searchType", "aggregationType")
    for item in (page, query):
        meta = item["metadata"]
        if any(meta.get(key) == "UNKNOWN" for key in required) or meta["dimensionsStatus"] == "UNKNOWN":
            return "UNKNOWN"
        if any(not isinstance(meta.get(key), str) or not meta[key] for key in required):
            return "MISMATCH"
        if meta["dimensionsStatus"] != "VALID" or meta["dimensionsValid"] is not True:
            return "MISMATCH"
    page_meta, query_meta = page["metadata"], query["metadata"]
    if any(page_meta[key] != query_meta[key] for key in comparable):
        return "MISMATCH"
    return "COMPLETE"


def build_report(page_path, query_path):
    report = {
        "schemaVersion": 1,
        "validator": "gsc-query-provenance-coverage",
        "status": None,
        "compatibility": {"period": "UNKNOWN", "property": "UNKNOWN", "metadata": "UNKNOWN"},
        "sources": {"pageOnly": None, "pageQuery": None},
        "coverage": {"pageOnlyUrls": "UNKNOWN", "queryUrls": "UNKNOWN", "queryRows": "UNKNOWN",
                     "queryUrlsWithRows": "UNKNOWN", "queryUrlsWithoutRows": "UNKNOWN",
                     "pageOnlyUrlsMissingFromQuerySnapshot": "UNKNOWN",
                     "queryUrlsOutsidePageSnapshot": "UNKNOWN",
                     "queryCoverageStatus": "UNKNOWN",
                     "queryMissingness": "UNKNOWN_NOT_ZERO"},
        "issues": [],
        "metricJoinPerformed": False,
    }
    try:
        page = _load_snapshot(page_path, page=True)
        report["sources"]["pageOnly"] = {
            "metadata": page["metadata"], "fingerprint": page["fingerprint"],
            "dataUnit": page["dataUnit"],
        }
        report["coverage"]["pageOnlyUrls"] = len(page["urls"])
    except SnapshotError as exc:
        report["status"] = "SOURCE_UNREADABLE"
        report["issues"].append({"source": "pageOnly", "reason": str(exc)})
        return report

    if not query_path:
        report["status"] = "NEEDS_NEW_NORMAL_SCHEDULED_SNAPSHOT"
        report["issues"].append({"source": "pageQuery", "reason": "query snapshot was not supplied"})
        return report

    try:
        query = _load_snapshot(query_path, page=False)
        report["sources"]["pageQuery"] = {
            "metadata": query["metadata"], "fingerprint": query["fingerprint"],
            "dataUnit": query["dataUnit"],
        }
        report["coverage"]["queryUrls"] = len(query["urls"])
        report["coverage"]["queryRows"] = query["coverage"]["queryRows"]
        report["coverage"]["queryUrlsWithRows"] = query["coverage"]["urlsWithQueryRows"]
        report["coverage"]["queryUrlsWithoutRows"] = query["coverage"]["recordUrls"] - query["coverage"]["urlsWithQueryRows"]
    except SnapshotError as exc:
        report["status"] = "SOURCE_UNREADABLE"
        report["issues"].append({"source": "pageQuery", "reason": str(exc)})
        return report

    pm, qm = page["metadata"], query["metadata"]
    if pm["period"] == "UNKNOWN" or qm["period"] == "UNKNOWN":
        report["status"] = "SOURCE_UNREADABLE"
        report["issues"].append({"reason": "native period metadata is UNKNOWN; window alignment cannot be determined"})
        return report
    same_period = pm["period"] == qm["period"]
    property_known = pm["property"] != "UNKNOWN" and qm["property"] != "UNKNOWN"
    same_property = property_known and pm["property"] == qm["property"]
    report["compatibility"]["period"] = "SAME" if same_period else "MISMATCH"
    report["compatibility"]["property"] = (
        "SAME" if same_property else "MISMATCH" if property_known else "UNKNOWN"
    )
    if not same_period:
        report["status"] = "WINDOW_MISMATCH_HOLD"
        report["issues"].append({"reason": "native page-only and page-query periods differ; no cross-window join is allowed"})
        return report
    if property_known and not same_property:
        report["status"] = "SOURCE_UNREADABLE"
        report["issues"].append({"reason": "Search Console property differs"})
        return report
    if not property_known:
        report["status"] = "SOURCE_METADATA_UNKNOWN_HOLD"
        report["issues"].append({"reason": "Search Console property metadata is UNKNOWN; URL coverage cannot be compared"})
        return report

    missing = set(page["urls"]) - set(query["urls"])
    extra = set(query["urls"]) - set(page["urls"])
    report["coverage"]["pageOnlyUrlsMissingFromQuerySnapshot"] = len(missing)
    report["coverage"]["queryUrlsOutsidePageSnapshot"] = len(extra)
    partial_evidence = (
        bool(missing)
        or bool(extra)
        or report["coverage"]["queryUrlsWithoutRows"] != 0
    )
    report["coverage"]["queryCoverageStatus"] = "PARTIAL" if partial_evidence else "UNKNOWN"

    metadata_status = _required_metadata_complete(page, query)
    report["compatibility"]["metadata"] = metadata_status
    if metadata_status == "MISMATCH":
        report["status"] = "METADATA_MISMATCH_HOLD"
        report["issues"].append({"reason": "page-only and page-query search metadata conflict"})
        return report
    if metadata_status == "UNKNOWN":
        report["issues"].append({"reason": "one or more source metadata fields are UNKNOWN"})
    if partial_evidence:
        report["issues"].append({"reason": "query rows cover only part of the page inventory; omissions remain UNKNOWN_NOT_ZERO"})
    else:
        report["issues"].append({"reason": "aligned dates and URL overlap do not establish complete query coverage"})
    report["status"] = "PERIOD_ALIGNED"
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--page-snapshot", required=True, type=Path)
    parser.add_argument("--query-snapshot", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args(argv)
    report = build_report(args.page_snapshot, args.query_snapshot)
    serialized = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if args.output:
        output = args.output.resolve()
        inputs = {args.page_snapshot.resolve()}
        if args.query_snapshot:
            inputs.add(args.query_snapshot.resolve())
        if output in inputs:
            print("refusing to overwrite an input snapshot", file=sys.stderr)
            return 2
        output.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=output.parent, delete=False) as handle:
            handle.write(serialized)
            temp_path = Path(handle.name)
        os.replace(temp_path, output)
    sys.stdout.write(serialized)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
