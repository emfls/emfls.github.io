#!/usr/bin/env python3
"""Keep verified GA4/GSC page evidence scoped to the JP Travel URL prefix."""

import argparse
import json
from pathlib import Path
from urllib.parse import urlsplit


PREFIX = "/jp/report/travel/"
SOURCES = {
    "ga4": "GOOGLE_ANALYTICS_DATA_API",
    "gsc": "GOOGLE_SEARCH_CONSOLE_API",
}


def _source_metadata(snapshot, source_kind):
    if source_kind == "ga4":
        source = (snapshot.get("collection") or {}).get("source")
        period = (snapshot.get("periods") or {}).get("ga4")
        property_value = (snapshot.get("collection") or {}).get("propertyId")
        status = ((snapshot.get("site") or {}).get("ga4") or {}).get("status")
        collected_at = (snapshot.get("collection") or {}).get("collectedAt")
    elif source_kind == "gsc":
        source = snapshot.get("source")
        period = (snapshot.get("periods") or {}).get("gsc")
        property_value = snapshot.get("property")
        status = snapshot.get("status")
        collected_at = snapshot.get("generatedAt")
    else:
        raise ValueError(f"unsupported source kind: {source_kind}")

    if source != SOURCES[source_kind] or status != "VERIFIED":
        raise ValueError(f"{source_kind} snapshot is not verified")
    if not isinstance(period, dict) or not period.get("start") or not period.get("end"):
        raise ValueError(f"{source_kind} snapshot has no verified period")
    if not isinstance(snapshot.get("pages"), list):
        raise ValueError(f"{source_kind} snapshot has no page rows")
    return source, period, property_value, collected_at


def _page_path(value, *, source_kind, property_value):
    raw = str(value or "").strip()
    parsed = urlsplit(raw)
    if parsed.scheme or parsed.netloc:
        if source_kind == "gsc":
            expected = urlsplit(str(property_value or ""))
            if parsed.netloc.lower() != expected.netloc.lower():
                return None
        elif parsed.netloc.lower() != "emfls.github.io":
            return None
        raw = parsed.path
    else:
        raw = parsed.path
    if not raw.startswith("/"):
        raw = "/" + raw
    return raw


def scope_snapshot(snapshot, source_kind, path_prefix=PREFIX):
    """Return verified source rows under one path prefix, preserving their window."""
    source, period, property_value, collected_at = _source_metadata(snapshot, source_kind)
    if not path_prefix.startswith("/") or not path_prefix.endswith("/"):
        raise ValueError("path prefix must start and end with a slash")

    source_pages = snapshot["pages"]
    pages = []
    for row in source_pages:
        if not isinstance(row, dict):
            continue
        path = _page_path(row.get("url"), source_kind=source_kind, property_value=property_value)
        if path and path.startswith(path_prefix):
            pages.append(row)

    result = {
        "schema_version": 1,
        "status": "VERIFIED",
        "source": source,
        "period": {"start": period["start"], "end": period["end"]},
        "scope": {
            "pathPrefix": path_prefix,
            "property": property_value,
            "sourceRowCount": len(source_pages),
            "scopedRowCount": len(pages),
        },
        "pages": pages,
    }
    if snapshot.get("as_of"):
        result["as_of"] = snapshot["as_of"]
    if collected_at:
        result["collectedAt"] = collected_at
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--source-type", required=True, choices=sorted(SOURCES))
    args = parser.parse_args()

    with args.input.open(encoding="utf-8") as handle:
        snapshot = json.load(handle)
    scoped = scope_snapshot(snapshot, args.source_type)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as handle:
        json.dump(scoped, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(json.dumps({
        "output": str(args.output),
        "period": scoped["period"],
        "sourceRows": scoped["scope"]["sourceRowCount"],
        "scopedRows": scoped["scope"]["scopedRowCount"],
    }))


if __name__ == "__main__":
    main()
