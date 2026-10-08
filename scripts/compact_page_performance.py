#!/usr/bin/env python3
"""Project a validated full page-performance artifact to its consumer contract."""

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    from scripts.quality_site import normalize_url
    from scripts.validate_measurement_artifact import validate, _validate_page_shape
except ModuleNotFoundError:
    from quality_site import normalize_url
    from validate_measurement_artifact import validate, _validate_page_shape


ROOT_FIELDS = ("schemaVersion", "asOf", "summary", "pages")
PAGE_FIELDS = ("url", "classification", "cooldown", "cluster", "pageScore")
CHANNEL_FIELDS = {
    "ga4": ("status", "period", "source", "views", "users", "engagementSeconds", "revenue", "revenueMetric"),
    "google": ("status", "period", "source", "clicks", "impressions", "ctr", "position"),
    "naver": (
        "status", "period", "periodPreset", "source", "dataUpdatedAt",
        "clicks", "impressions", "ctr", "position", "positionStatus", "crossSourceStatus",
    ),
    "adsense": ("status", "period", "source", "revenue", "rpm", "revenueMetric", "coverageStatus"),
}


def project(payload):
    """Return the exact page-performance fields established by consumer parity."""
    if not isinstance(payload, dict):
        raise ValueError("full page-performance artifact must be an object")
    missing_root = set(ROOT_FIELDS) - set(payload)
    if missing_root:
        raise ValueError("full page-performance artifact is missing root field(s): " + ", ".join(sorted(missing_root)))
    if not isinstance(payload["asOf"], str) or not payload["asOf"].strip():
        raise ValueError("full page-performance asOf must be a non-empty string")

    summary = payload["summary"]
    pages = payload["pages"]
    if not isinstance(summary, dict) or "evaluatedIndexablePages" not in summary:
        raise ValueError("full page-performance summary is missing evaluatedIndexablePages")
    if not isinstance(pages, list) or not pages:
        raise ValueError("full page-performance pages must be a non-empty list")
    expected_count = summary["evaluatedIndexablePages"]
    if isinstance(expected_count, bool) or not isinstance(expected_count, int) or expected_count != len(pages):
        raise ValueError("full page-performance summary count does not match pages")

    projected_pages = []
    seen = set()
    for page in pages:
        _validate_page_shape(page)
        normalized_url = normalize_url(page["url"])
        if not normalized_url or normalized_url in seen:
            raise ValueError(f"duplicate or invalid normalized page URL: {page['url']}")
        seen.add(normalized_url)

        projected = {field: page[field] for field in PAGE_FIELDS}
        for channel_name, fields in CHANNEL_FIELDS.items():
            channel = page[channel_name]
            missing = set(fields) - set(channel)
            if missing:
                raise ValueError(
                    f"full page-performance {channel_name} channel is missing required field(s): "
                    + ", ".join(sorted(missing))
                )
            projected[channel_name] = {field: channel[field] for field in fields}
        projected_pages.append((normalized_url, projected))

    projected_pages.sort(key=lambda pair: pair[0])
    return {
        "schemaVersion": payload["schemaVersion"],
        "asOf": payload["asOf"],
        "summary": {"evaluatedIndexablePages": expected_count},
        "pages": [page for _, page in projected_pages],
    }


def serialize_compact(payload):
    """Serialize compact JSON with stable keys, compact separators, and one newline."""
    return (
        json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n"
    ).encode("utf-8")


def _write_atomic(target, content):
    target = Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(prefix=f".{target.name}.", suffix=".tmp", dir=target.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(content)
        temporary.replace(target)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def project_file(full_path, page_scores_path, output_path):
    """Validate the exhaustive source before atomically writing its compact view."""
    result = validate(Path(full_path), page_scores_path=Path(page_scores_path))
    payload = json.loads(Path(full_path).read_text(encoding="utf-8"))
    compact = project(payload)
    _write_atomic(output_path, serialize_compact(compact))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("full", type=Path, help="full page-performance JSON")
    parser.add_argument("--page-scores", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(project_file(args.full, args.page_scores, args.output), sort_keys=True))


if __name__ == "__main__":
    main()
