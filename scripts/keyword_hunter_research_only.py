"""Offline provenance lane for reviewed Keyword Hunter research hypotheses.

This module never calls a provider or imports production collection, scoring,
persistence, or launch code. It reads only
``data/keyword-hunter-research-only/hypotheses.json`` and writes capture
artifacts only below ``reports/keyword-hunter/research-only/``.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
import unicodedata
from typing import Any, Mapping, Sequence


MAX_HYPOTHESES = 6
MAX_INPUT_BYTES = 32_768
MAX_ROWS_PER_HYPOTHESIS = 1000
MAX_BUNDLE_BYTES = 2_000_000
INPUT_PARTS = ("data", "keyword-hunter-research-only", "hypotheses.json")
OUTPUT_PARTS = ("reports", "keyword-hunter", "research-only")
INPUT_KEYS = {"schemaVersion", "lane", "hypotheses"}
HYPOTHESIS_KEYS = {
    "exactPhrase",
    "hypothesisGroup",
    "reviewStatus",
    "reviewer",
    "reviewedAt",
}
RESPONSE_KEYS = {"exactPhrase", "sentHint", "payload"}
BUNDLE_KEYS = {
    "schemaVersion",
    "lane",
    "runId",
    "observedAt",
    "observedTimezone",
    "source",
    "reportingPeriod",
    "records",
    "integrity",
}
RECORD_KEYS = {
    "exactPhrase",
    "hypothesisGroup",
    "reviewStatus",
    "reviewer",
    "reviewedAt",
    "sentHint",
    "responseStatus",
    "capturedRowCount",
    "providerReportedTotal",
    "rowCoverage",
    "results",
}
RESULT_KEYS = {"returnedRelKeyword", "monthlyPcQcCnt", "monthlyMobileQcCnt"}
MEASUREMENT_KEYS = {
    "raw",
    "sourceFieldPresent",
    "status",
    "isCensored",
    "exactValue",
    "censorOperator",
    "censorThreshold",
}
SOURCE = {
    "name": "NAVER_SEARCH_ADS",
    "endpoint": "/keywordstool",
    "apiVersion": "UNVERSIONED",
    "country": "KR",
    "language": "ko",
}
_RUN_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$")
_KOREAN_RE = re.compile(r"[가-힣]")
_TOKEN_RE = re.compile(r"[가-힣A-Za-z0-9]+")
_CENSORED_RE = re.compile(r"^([<>]=?)\s*(\d+)$")


class ResearchOnlyError(ValueError):
    """Raised when research-only input or capture is unsafe or malformed."""


@dataclass(frozen=True)
class Hypothesis:
    exact_phrase: str
    hypothesis_group: str
    review_status: str
    reviewer: str
    reviewed_at: str


def _json_without_constants(value: str) -> None:
    raise ResearchOnlyError(f"Invalid JSON constant: {value}")


def _json_object_without_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ResearchOnlyError("Duplicate JSON object key")
        result[key] = value
    return result


def _kst_datetime(value: object, field: str) -> datetime:
    if not isinstance(value, str) or not value:
        raise ResearchOnlyError(f"{field} must be an ISO-8601 KST timestamp")
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as exc:
        raise ResearchOnlyError(f"{field} must be an ISO-8601 KST timestamp") from exc
    if parsed.tzinfo is None or parsed.utcoffset() != timedelta(hours=9):
        raise ResearchOnlyError(f"{field} must include the Asia/Seoul UTC+09:00 offset")
    return parsed


def _rooted_path(root: Path, parts: Sequence[str]) -> Path:
    root_path = Path(root).resolve(strict=True)
    if not root_path.is_dir():
        raise ResearchOnlyError("Research root must be an existing directory")
    candidate = root_path
    for part in parts:
        if not isinstance(part, str) or not part or part in {".", ".."} or "/" in part or "\\" in part:
            raise ResearchOnlyError("Unsafe research-only path component")
        candidate = candidate / part
        if candidate.is_symlink():
            raise ResearchOnlyError("Symlinks are not allowed in research-only paths")
        try:
            candidate.resolve(strict=False).relative_to(root_path)
        except ValueError as exc:
            raise ResearchOnlyError("Research-only path escapes the repository root") from exc
    return candidate


def search_ads_hint(seed: str, max_length: int = 20) -> str:
    """Match the production request hint algorithm without using its API client."""
    if not isinstance(seed, str) or type(max_length) is not int or max_length < 1:
        raise ResearchOnlyError("Invalid hint input")
    words = _TOKEN_RE.findall(seed)
    hint = ""
    for word in words:
        if len(hint) + len(word) > max_length:
            break
        hint += word
    return (hint or "".join(words))[:max_length]


def _validated_hypothesis(value: object) -> Hypothesis:
    if not isinstance(value, dict) or set(value) != HYPOTHESIS_KEYS:
        raise ResearchOnlyError("Hypothesis has an invalid schema")
    phrase = value.get("exactPhrase")
    group = value.get("hypothesisGroup")
    reviewer = value.get("reviewer")
    if (
        not isinstance(phrase, str)
        or not phrase
        or phrase != phrase.strip()
        or len(phrase) > 80
        or not _KOREAN_RE.search(phrase)
        or any(unicodedata.category(char) == "Cc" for char in phrase)
    ):
        raise ResearchOnlyError("Hypothesis must preserve a non-empty exact Korean phrase")
    if not isinstance(group, str) or group not in {"B1", "A3"}:
        raise ResearchOnlyError("Hypothesis group must be B1 or A3")
    if value.get("reviewStatus") != "REVIEWED_HYPOTHESIS":
        raise ResearchOnlyError("Only reviewed hypotheses are allowed in the research lane")
    if not isinstance(reviewer, str) or not reviewer.strip() or len(reviewer) > 80:
        raise ResearchOnlyError("Hypothesis reviewer is required")
    _kst_datetime(value.get("reviewedAt"), "reviewedAt")
    return Hypothesis(
        exact_phrase=phrase,
        hypothesis_group=group,
        review_status="REVIEWED_HYPOTHESIS",
        reviewer=reviewer,
        reviewed_at=value["reviewedAt"],
    )


def load_hypotheses(root: Path) -> tuple[Hypothesis, ...]:
    """Read the fixed, separate input; missing/corrupt data fails closed."""
    path = _rooted_path(Path(root), INPUT_PARTS)
    try:
        with path.open("rb") as handle:
            raw = handle.read(MAX_INPUT_BYTES + 1)
        if len(raw) > MAX_INPUT_BYTES:
            raise ResearchOnlyError("Research-only hypothesis input exceeds the 32 KB limit")
        value = json.loads(
            raw.decode("utf-8"),
            parse_constant=_json_without_constants,
            object_pairs_hook=_json_object_without_duplicates,
        )
    except FileNotFoundError as exc:
        raise ResearchOnlyError("Research-only hypothesis input is missing") from exc
    except ResearchOnlyError:
        raise
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ResearchOnlyError("Research-only hypothesis input is unreadable or invalid JSON") from exc
    if not isinstance(value, dict) or set(value) != INPUT_KEYS:
        raise ResearchOnlyError("Research-only input has an invalid schema")
    if type(value.get("schemaVersion")) is not int or value["schemaVersion"] != 1:
        raise ResearchOnlyError("Unsupported research-only input schema version")
    if value.get("lane") != "RESEARCH_ONLY":
        raise ResearchOnlyError("Research-only input lane marker is required")
    raw_hypotheses = value.get("hypotheses")
    if not isinstance(raw_hypotheses, list) or not 1 <= len(raw_hypotheses) <= MAX_HYPOTHESES:
        raise ResearchOnlyError(f"Research-only input requires one to {MAX_HYPOTHESES} hypotheses")
    hypotheses = tuple(_validated_hypothesis(item) for item in raw_hypotheses)
    normalized = [re.sub(r"\s+", " ", item.exact_phrase).casefold() for item in hypotheses]
    if len(set(normalized)) != len(normalized):
        raise ResearchOnlyError("Duplicate research-only hypothesis")
    return hypotheses


def _measurement(raw: object, present: bool) -> dict[str, Any]:
    result: dict[str, Any] = {
        "raw": raw,
        "sourceFieldPresent": present,
        "status": "MISSING",
        "isCensored": False,
        "exactValue": None,
        "censorOperator": None,
        "censorThreshold": None,
    }
    if not present or raw is None or (isinstance(raw, str) and not raw.strip()):
        return result
    if isinstance(raw, (dict, list)):
        raise ResearchOnlyError("Provider count fields must be scalar values")
    if type(raw) is int and raw >= 0:
        result.update(status="EXACT", exactValue=raw)
        return result
    if isinstance(raw, str):
        normalized = raw.strip()
        if normalized.isdecimal():
            result.update(status="EXACT", exactValue=int(normalized))
            return result
        censored = _CENSORED_RE.fullmatch(normalized)
        if censored:
            result.update(
                status="CENSORED",
                isCensored=True,
                censorOperator=censored.group(1),
                censorThreshold=int(censored.group(2)),
            )
            return result
    result["status"] = "INVALID"
    return result


def _canonical_payload(bundle: Mapping[str, Any]) -> bytes:
    value = {key: item for key, item in bundle.items() if key != "integrity"}
    try:
        return json.dumps(
            value,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        ).encode("utf-8")
    except (TypeError, ValueError, UnicodeError) as exc:
        raise ResearchOnlyError("Capture bundle is not canonical JSON") from exc


def _serialize_bundle(bundle: Mapping[str, Any]) -> bytes:
    try:
        encoded = json.dumps(
            bundle,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        ).encode("utf-8")
    except (TypeError, ValueError, UnicodeError) as exc:
        raise ResearchOnlyError("Capture bundle is not serializable JSON") from exc
    if len(encoded) > MAX_BUNDLE_BYTES:
        raise ResearchOnlyError("Capture bundle exceeds the 2 MB sidecar limit")
    return encoded


def _add_integrity(bundle: dict[str, Any]) -> dict[str, Any]:
    bundle["integrity"] = {
        "algorithm": "SHA-256",
        "scope": "canonical JSON excluding integrity",
        "digest": hashlib.sha256(_canonical_payload(bundle)).hexdigest(),
    }
    return bundle


def _validate_run_id(run_id: object) -> str:
    if not isinstance(run_id, str) or not _RUN_ID_RE.fullmatch(run_id):
        raise ResearchOnlyError("runId must be a simple filename-safe identifier")
    return run_id


def build_capture_bundle(
    hypotheses: Sequence[Hypothesis],
    responses: Sequence[Mapping[str, Any]],
    *,
    run_id: str,
    observed_at: str,
) -> dict[str, Any]:
    """Transform supplied offline response fixtures into provenance records."""
    run_id = _validate_run_id(run_id)
    _kst_datetime(observed_at, "observedAt")
    if not isinstance(hypotheses, (list, tuple)) or not 1 <= len(hypotheses) <= MAX_HYPOTHESES:
        raise ResearchOnlyError(f"Capture requires one to {MAX_HYPOTHESES} validated hypotheses")
    if not all(isinstance(item, Hypothesis) for item in hypotheses):
        raise ResearchOnlyError("Capture accepts only validated research hypotheses")
    hypotheses = tuple(
        _validated_hypothesis(
            {
                "exactPhrase": item.exact_phrase,
                "hypothesisGroup": item.hypothesis_group,
                "reviewStatus": item.review_status,
                "reviewer": item.reviewer,
                "reviewedAt": item.reviewed_at,
            }
        )
        for item in hypotheses
    )
    if not isinstance(responses, (list, tuple)) or len(responses) != len(hypotheses):
        raise ResearchOnlyError("Each hypothesis must have exactly one provider response capture")

    by_phrase: dict[str, Mapping[str, Any]] = {}
    for response in responses:
        if not isinstance(response, Mapping) or set(response) != RESPONSE_KEYS:
            raise ResearchOnlyError("Provider response capture has an invalid schema")
        phrase = response.get("exactPhrase")
        if not isinstance(phrase, str) or phrase in by_phrase:
            raise ResearchOnlyError("Provider response phrases must be unique exact inputs")
        by_phrase[phrase] = response
    if set(by_phrase) != {item.exact_phrase for item in hypotheses}:
        raise ResearchOnlyError("Provider responses must match the reviewed hypotheses exactly")

    records: list[dict[str, Any]] = []
    for hypothesis in hypotheses:
        response = by_phrase[hypothesis.exact_phrase]
        expected_hint = search_ads_hint(hypothesis.exact_phrase)
        sent_hint = response.get("sentHint")
        if not isinstance(sent_hint, str) or sent_hint != expected_hint:
            raise ResearchOnlyError("Captured request hint does not match the exact phrase")
        payload = response.get("payload")
        if not isinstance(payload, Mapping) or not set(payload).issubset({"keywordList", "total"}):
            raise ResearchOnlyError("Search Ads provider payload has an invalid schema")
        rows = payload.get("keywordList")
        if not isinstance(rows, list):
            raise ResearchOnlyError("Search Ads payload keywordList must be an array")
        if len(rows) > MAX_ROWS_PER_HYPOTHESIS:
            raise ResearchOnlyError("Search Ads payload exceeds the per-hypothesis row limit")
        reported_total = payload.get("total")
        if reported_total is not None and (type(reported_total) is not int or reported_total < len(rows)):
            raise ResearchOnlyError("Search Ads payload total is inconsistent with captured rows")
        results = []
        for row in rows:
            if not isinstance(row, Mapping):
                raise ResearchOnlyError("Search Ads result row must be an object")
            returned = row.get("relKeyword")
            if not isinstance(returned, str) or not returned.strip():
                raise ResearchOnlyError("Search Ads result row requires relKeyword")
            results.append(
                {
                    "returnedRelKeyword": returned,
                    "monthlyPcQcCnt": _measurement(row.get("monthlyPcQcCnt"), "monthlyPcQcCnt" in row),
                    "monthlyMobileQcCnt": _measurement(row.get("monthlyMobileQcCnt"), "monthlyMobileQcCnt" in row),
                }
            )
        coverage = "NOT_AVAILABLE"
        if reported_total is not None:
            coverage = "COMPLETE" if reported_total == len(rows) else "PARTIAL"
        records.append(
            {
                "exactPhrase": hypothesis.exact_phrase,
                "hypothesisGroup": hypothesis.hypothesis_group,
                "reviewStatus": hypothesis.review_status,
                "reviewer": hypothesis.reviewer,
                "reviewedAt": hypothesis.reviewed_at,
                "sentHint": sent_hint,
                "responseStatus": "HAS_RESULTS" if rows else "NO_RESULTS",
                "capturedRowCount": len(rows),
                "providerReportedTotal": reported_total,
                "rowCoverage": coverage,
                "results": results,
            }
        )

    bundle: dict[str, Any] = {
        "schemaVersion": 1,
        "lane": "RESEARCH_ONLY",
        "runId": run_id,
        "observedAt": observed_at,
        "observedTimezone": "Asia/Seoul",
        "source": dict(SOURCE),
        "reportingPeriod": {"status": "NOT_AVAILABLE", "start": None, "end": None},
        "records": records,
    }
    bundle = _add_integrity(bundle)
    _serialize_bundle(bundle)
    return bundle


def verify_capture_bundle(bundle: object) -> bool:
    """Verify the capture checksum and the non-production bundle envelope."""
    if not isinstance(bundle, dict):
        raise ResearchOnlyError("Capture bundle must be a JSON object")
    if set(bundle) != BUNDLE_KEYS:
        raise ResearchOnlyError("Capture bundle has an invalid schema")
    if bundle.get("schemaVersion") != 1 or type(bundle.get("schemaVersion")) is not int:
        raise ResearchOnlyError("Unsupported capture bundle schema version")
    if bundle.get("lane") != "RESEARCH_ONLY":
        raise ResearchOnlyError("Capture bundle is not marked RESEARCH_ONLY")
    _validate_run_id(bundle.get("runId"))
    _kst_datetime(bundle.get("observedAt"), "observedAt")
    if bundle.get("observedTimezone") != "Asia/Seoul" or bundle.get("source") != SOURCE:
        raise ResearchOnlyError("Capture bundle source or timezone provenance is invalid")
    if bundle.get("reportingPeriod") != {"status": "NOT_AVAILABLE", "start": None, "end": None}:
        raise ResearchOnlyError("Unavailable provider reporting period must remain explicit")
    records = bundle.get("records")
    if not isinstance(records, list) or not 1 <= len(records) <= MAX_HYPOTHESES:
        raise ResearchOnlyError("Capture bundle record count is invalid")
    seen_phrases: set[str] = set()
    for record in records:
        if not isinstance(record, dict) or set(record) != RECORD_KEYS:
            raise ResearchOnlyError("Capture record has an invalid schema")
        hypothesis = _validated_hypothesis(
            {
                "exactPhrase": record.get("exactPhrase"),
                "hypothesisGroup": record.get("hypothesisGroup"),
                "reviewStatus": record.get("reviewStatus"),
                "reviewer": record.get("reviewer"),
                "reviewedAt": record.get("reviewedAt"),
            }
        )
        normalized_phrase = re.sub(r"\s+", " ", hypothesis.exact_phrase).casefold()
        if normalized_phrase in seen_phrases:
            raise ResearchOnlyError("Capture bundle contains duplicate hypotheses")
        seen_phrases.add(normalized_phrase)
        if record.get("sentHint") != search_ads_hint(hypothesis.exact_phrase):
            raise ResearchOnlyError("Capture record request hint does not match its exact phrase")
        results = record.get("results")
        captured_count = record.get("capturedRowCount")
        if (
            not isinstance(results, list)
            or len(results) > MAX_ROWS_PER_HYPOTHESIS
            or type(captured_count) is not int
            or captured_count != len(results)
        ):
            raise ResearchOnlyError("Capture record row count is inconsistent")
        if record.get("responseStatus") != ("HAS_RESULTS" if results else "NO_RESULTS"):
            raise ResearchOnlyError("Capture record response status is inconsistent")
        reported_total = record.get("providerReportedTotal")
        if reported_total is None:
            expected_coverage = "NOT_AVAILABLE"
        elif type(reported_total) is int and reported_total >= captured_count:
            expected_coverage = "COMPLETE" if reported_total == captured_count else "PARTIAL"
        else:
            raise ResearchOnlyError("Capture record reported total is invalid")
        if record.get("rowCoverage") != expected_coverage:
            raise ResearchOnlyError("Capture record row coverage is inconsistent")
        for result in results:
            if not isinstance(result, dict) or set(result) != RESULT_KEYS:
                raise ResearchOnlyError("Captured provider result has an invalid schema")
            returned = result.get("returnedRelKeyword")
            if not isinstance(returned, str) or not returned.strip():
                raise ResearchOnlyError("Captured provider result requires relKeyword")
            for field in ("monthlyPcQcCnt", "monthlyMobileQcCnt"):
                measurement = result.get(field)
                if not isinstance(measurement, dict) or set(measurement) != MEASUREMENT_KEYS:
                    raise ResearchOnlyError("Captured measurement has an invalid schema")
                source_present = measurement.get("sourceFieldPresent")
                if type(source_present) is not bool:
                    raise ResearchOnlyError("Captured measurement presence flag is invalid")
                if measurement != _measurement(measurement.get("raw"), source_present):
                    raise ResearchOnlyError("Captured measurement state conflicts with its raw value")
    integrity = bundle.get("integrity")
    if not isinstance(integrity, dict) or set(integrity) != {"algorithm", "scope", "digest"}:
        raise ResearchOnlyError("Capture bundle integrity metadata is invalid")
    expected = hashlib.sha256(_canonical_payload(bundle)).hexdigest()
    if integrity != {
        "algorithm": "SHA-256",
        "scope": "canonical JSON excluding integrity",
        "digest": expected,
    }:
        raise ResearchOnlyError("Capture bundle checksum mismatch")
    _serialize_bundle(bundle)
    return True


def write_capture(root: Path, bundle: Mapping[str, Any]) -> Path:
    """Atomically replace the single bounded research-only latest artifact."""
    verify_capture_bundle(dict(bundle))
    output_dir = _rooted_path(Path(root), OUTPUT_PARTS)
    try:
        output_dir.mkdir(parents=True, exist_ok=True)
        output_dir = _rooted_path(Path(root), OUTPUT_PARTS)
        output_path = _rooted_path(Path(root), (*OUTPUT_PARTS, "latest.json"))
        unexpected = [entry.name for entry in output_dir.iterdir() if entry.name != "latest.json"]
        if unexpected:
            raise ResearchOnlyError("Unexpected existing sidecar files found; refusing unbounded artifact accumulation")
        if output_path.exists():
            try:
                previous = json.loads(output_path.read_text(encoding="utf-8"))
            except (OSError, UnicodeError, json.JSONDecodeError) as exc:
                raise ResearchOnlyError("Existing latest capture is unreadable; refusing replacement") from exc
            verify_capture_bundle(previous)
            if previous["runId"] == bundle["runId"]:
                raise ResearchOnlyError("A capture for this runId already exists")
        encoded = _serialize_bundle(bundle) + b"\n"
        descriptor, temp_name = tempfile.mkstemp(prefix=".research-only-", suffix=".tmp", dir=output_dir)
        temp_path = Path(temp_name)
        try:
            with os.fdopen(descriptor, "wb") as handle:
                handle.write(encoded)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temp_path, output_path)
        except Exception:
            temp_path.unlink(missing_ok=True)
            raise
    except FileExistsError as exc:
        raise ResearchOnlyError("A capture for this runId already exists") from exc
    except ResearchOnlyError:
        raise
    except OSError as exc:
        raise ResearchOnlyError("Research-only capture could not be written") from exc
    return output_path
