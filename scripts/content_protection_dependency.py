#!/usr/bin/env python3
"""Read-only, fail-closed audit of protected content and static route references."""

from __future__ import annotations

import argparse
import hashlib
import json
import posixpath
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path
from typing import Any

if __package__ in {None, ""}:
    from content_launch_guard import (
        APPROVED_ARABIC_RETIREMENT_URLS,
        _approved_arabic_retirement_paths,
    )
    from content_launch_policy import normalize_url_identity
    from ops_paths import ops_root
else:
    from scripts.content_launch_guard import (
        APPROVED_ARABIC_RETIREMENT_URLS,
        _approved_arabic_retirement_paths,
    )
    from scripts.content_launch_policy import normalize_url_identity
    from scripts.ops_paths import ops_root


PROTECTION_JSON = (
    "data/revenue-opportunities.json",
    "data/experiments.json",
    "data/content-launch-experiments.json",
    "data/content-launch-decisions.json",
    "data/content-launch-queue.json",
    "data/content-metadata.json",
    "data/locale-retirement-overrides.json",
)
POLICY_FILES = (
    "scripts/content_launch_guard.py",
    "scripts/content_launch_policy.py",
)
POLICY_REFERENCE_PATHS = set(PROTECTION_JSON) | set(POLICY_FILES)
TEXT_SUFFIXES = {
    ".astro",
    ".cjs",
    ".css",
    ".csv",
    ".html",
    ".htm",
    ".js",
    ".json",
    ".jsonl",
    ".jsx",
    ".md",
    ".mjs",
    ".njk",
    ".py",
    ".scss",
    ".sh",
    ".svg",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".vue",
    ".xml",
    ".yaml",
    ".yml",
}
PAGEFIND_SUFFIXES = {".pf_fragment", ".pf_index", ".pf_meta", ".pagefind"}
ANALYTICAL_REFERENCE_PATHS = {
    "data/page-performance.json",
    "data/page-scores.json",
    "data/site-audit.json",
    "data/cannibalization-report.json",
}
ANALYTICAL_REFERENCE_PREFIXES = ("data/performance/",)
NON_TEXT_SUFFIXES = {
    ".avif",
    ".bmp",
    ".gif",
    ".ico",
    ".jpeg",
    ".jpg",
    ".mp3",
    ".mp4",
    ".otf",
    ".pdf",
    ".png",
    ".svgz",
    ".ttf",
    ".webm",
    ".webp",
    ".woff",
    ".woff2",
    ".zip",
}
ROUTE_PREFIX_RE = re.compile(
    rb"jp(?:/|\\/|%2f|&#0*47;|&#x0*2f;)report"
    rb"(?:/|\\/|%2f|&#0*47;|&#x0*2f;)travel"
    rb"(?:/|\\/|%2f|&#0*47;|&#x0*2f;|(?=$|[\"'`]))",
    re.IGNORECASE,
)
CODE_SUFFIXES = {".astro", ".cjs", ".html", ".htm", ".js", ".jsx", ".mjs", ".py", ".ts", ".tsx", ".vue"}


def _git(root: Path, *args: str) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(
        ["git", "-C", str(root), *args],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )


def _git_blob(root: Path, relative_path: str) -> str | None:
    result = _git(root, "hash-object", "--", relative_path)
    if result.returncode:
        return None
    return result.stdout.decode("ascii", "replace").strip() or None


def _source_fingerprint(root: Path, relative_path: str) -> dict[str, Any]:
    path = root / relative_path
    try:
        content = path.read_bytes()
    except OSError as error:
        return {"status": "UNKNOWN", "error": type(error).__name__}
    return {
        "status": "READ",
        "bytes": len(content),
        "sha256": hashlib.sha256(content).hexdigest(),
        "gitBlob": _git_blob(root, relative_path),
    }


def _read_json(root: Path, relative_path: str, errors: list[str]) -> Any:
    try:
        return json.loads((root / relative_path).read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        errors.append(f"JSON_SOURCE_UNKNOWN:{relative_path}:{type(error).__name__}")
        return None


def _valid_rows(value: Any, key: str, relative_path: str, errors: list[str]) -> list[dict[str, Any]]:
    rows = value.get(key) if isinstance(value, dict) else None
    if not isinstance(rows, list):
        errors.append(f"ROW_SET_UNKNOWN:{relative_path}:{key}")
        return []
    if any(not isinstance(row, dict) for row in rows):
        errors.append(f"ROW_UNKNOWN:{relative_path}:{key}")
        return [row for row in rows if isinstance(row, dict)]
    return rows


def _normalized_routes(rows: list[dict[str, Any]], errors: list[str], label: str) -> tuple[list[str], int]:
    routes: list[str] = []
    invalid = 0
    for index, row in enumerate(rows):
        route = normalize_url_identity(row.get("url"))
        if route is None:
            invalid += 1
            errors.append(f"URL_UNKNOWN:{label}:{index}")
        else:
            routes.append(route)
    return routes, invalid


def build_protection_report(root: str | Path, ops_dir: str | Path | None = None) -> dict[str, Any]:
    """Validate real policy inputs; any missing or inconsistent source remains UNKNOWN."""
    root = Path(root).resolve()
    state_root = Path(ops_dir).resolve() if ops_dir else (
        root if (root / PROTECTION_JSON[0]).is_file() else ops_root(default=root)
    )
    errors: list[str] = []
    sources = {path: _source_fingerprint(state_root, path) for path in PROTECTION_JSON}
    sources.update({path: _source_fingerprint(root, path) for path in POLICY_FILES})
    for path, fingerprint in sources.items():
        if fingerprint["status"] != "READ":
            errors.append(f"SOURCE_UNAVAILABLE:{path}")

    documents = {path: _read_json(state_root, path, errors) for path in PROTECTION_JSON}
    revenue = documents["data/revenue-opportunities.json"]
    winners = _valid_rows(revenue, "protectedWinners", "data/revenue-opportunities.json", errors)
    if not winners:
        errors.append("WINNER_SET_EMPTY_OR_UNKNOWN")
    winner_routes, invalid_winner_urls = _normalized_routes(winners, errors, "winner")
    duplicate_winner_count = len(winner_routes) - len(set(winner_routes))
    if duplicate_winner_count:
        errors.append("WINNER_URL_DUPLICATES")
    declared_winners = revenue.get("classificationCounts", {}).get("WINNER") if isinstance(revenue, dict) else None
    if declared_winners != len(winners):
        errors.append("WINNER_COUNT_MISMATCH")
    if any(row.get("classification") != "WINNER" for row in winners):
        errors.append("WINNER_CLASSIFICATION_UNKNOWN")

    url_experiments = _valid_rows(
        documents["data/experiments.json"], "experiments", "data/experiments.json", errors
    )
    content_experiments = _valid_rows(
        documents["data/content-launch-experiments.json"],
        "experiments",
        "data/content-launch-experiments.json",
        errors,
    )
    url_experiment_routes, invalid_url_experiment_urls = _normalized_routes(
        url_experiments, errors, "url_experiment"
    )
    content_experiment_routes, invalid_content_experiment_urls = _normalized_routes(
        content_experiments, errors, "content_experiment"
    )
    for label, rows in (
        ("url_experiment", url_experiments),
        ("content_experiment", content_experiments),
    ):
        if any(not str(row.get("status") or "").strip() for row in rows):
            errors.append(f"EXPERIMENT_STATUS_UNKNOWN:{label}")

    decisions = _valid_rows(
        documents["data/content-launch-decisions.json"],
        "decisions",
        "data/content-launch-decisions.json",
        errors,
    )
    decision_counts = Counter(str(row.get("decision") or "UNKNOWN") for row in decisions)
    blocked_decisions = [
        row for row in decisions
        if row.get("decision") in {"HOLD", "NO_NEW_PAGE", "UPDATE_EXISTING"}
    ]
    unmapped_blocked_decisions = sum(not row.get("targetUrl") for row in blocked_decisions)
    if any(row.get("decision") in {"HOLD", "NO_NEW_PAGE", "UPDATE_EXISTING"} and row.get("targetUrl") for row in decisions):
        decision_route_rows = [
            {"url": row["targetUrl"]}
            for row in decisions
            if row.get("decision") in {"HOLD", "NO_NEW_PAGE", "UPDATE_EXISTING"} and row.get("targetUrl")
        ]
        decision_routes, invalid_decision_urls = _normalized_routes(decision_route_rows, errors, "decision")
    else:
        decision_routes, invalid_decision_urls = [], 0

    queue = _read_json(state_root, "data/content-launch-queue.json", errors)
    queue_rows = _valid_rows(queue, "queue", "data/content-launch-queue.json", errors)
    queue_statuses = Counter(str(row.get("status") or "UNKNOWN") for row in queue_rows)
    queue_routes, invalid_queue_urls = _normalized_routes(
        [{"url": row.get("suggested_url")} for row in queue_rows if row.get("suggested_url")],
        errors,
        "launch_queue",
    )
    if not isinstance(queue, dict) or not queue.get("selectedAt"):
        errors.append("LAUNCH_QUEUE_ASOF_UNKNOWN")

    metadata = documents["data/content-metadata.json"]
    metadata_rows = metadata if isinstance(metadata, list) else _valid_rows(
        metadata, "pages", "data/content-metadata.json", errors
    )
    ymyl_routes: list[str] = []
    ymyl_true_count = 0
    ymyl_unknown_count = 0
    for index, row in enumerate(metadata_rows):
        if "ymyl" not in row or type(row.get("ymyl")) is not bool:
            ymyl_unknown_count += 1
            errors.append(f"YMYL_FLAG_UNKNOWN:{index}")
            continue
        if row["ymyl"]:
            ymyl_true_count += 1
            route = normalize_url_identity(row.get("url"))
            if route is None:
                errors.append(f"YMYL_URL_UNKNOWN:{index}")
            else:
                ymyl_routes.append(route)

    approved_arabic_paths = _approved_arabic_retirement_paths(state_root)
    if len(approved_arabic_paths) != len(APPROVED_ARABIC_RETIREMENT_URLS):
        errors.append("ARABIC_EXCEPTION_CONTRACT_UNKNOWN")
    protected_routes = set(winner_routes)
    protected_routes.update(url_experiment_routes)
    protected_routes.update(content_experiment_routes)
    protected_routes.update(decision_routes)
    protected_routes.update(ymyl_routes)

    def summary_period(value: Any, key: str) -> Any:
        return value.get(key) if isinstance(value, dict) else None

    decisions_dates = sorted(
        str(row.get("decidedAt"))
        for row in decisions
        if row.get("decidedAt") is not None
    )
    periods = {
        "revenueAsOf": summary_period(revenue, "asOf"),
        "urlExperimentsAsOf": summary_period(documents["data/experiments.json"], "as_of"),
        "contentExperimentsAsOf": summary_period(
            documents["data/content-launch-experiments.json"], "asOf"
        ),
        "launchQueueSelectedAt": summary_period(queue, "selectedAt"),
        "decisionDates": {
            "start": decisions_dates[0] if decisions_dates else None,
            "end": decisions_dates[-1] if decisions_dates else None,
        },
        "ga4": (
            revenue.get("siteSources", {}).get("ga4")
            if isinstance(revenue, dict)
            else None
        ),
        "directAdsense": (
            {
                "source": revenue.get("directAdsense", {}).get("source"),
                "status": revenue.get("directAdsense", {}).get("status"),
                "period": revenue.get("directAdsense", {}).get("currentPeriod"),
                "pageUrlCoverage": revenue.get("directAdsense", {}).get("pageUrlCoverage"),
            }
            if isinstance(revenue, dict) and isinstance(revenue.get("directAdsense"), dict)
            else None
        ),
        "crossSourceAlignment": summary_period(revenue, "crossSourcePeriodAlignment"),
    }

    revision = _git(root, "rev-parse", "HEAD")
    source_revision = revision.stdout.decode("ascii", "replace").strip() if revision.returncode == 0 else None
    return {
        "status": "UNKNOWN" if errors else "VERIFIED",
        "sourceRevision": source_revision,
        "sources": sources,
        "periods": periods,
        "winners": {
            "count": len(winners),
            "normalizedDistinctCount": len(set(winner_routes)),
            "duplicateNormalizedCount": duplicate_winner_count,
            "invalidOrMissingUrlCount": invalid_winner_urls,
            "declaredCount": declared_winners,
        },
        "experiments": {
            "urlExperimentCount": len(url_experiments),
            "urlExperimentStatuses": dict(Counter(str(row.get("status") or "UNKNOWN") for row in url_experiments)),
            "invalidUrlExperimentUrlCount": invalid_url_experiment_urls,
            "contentExperimentCount": len(content_experiments),
            "contentExperimentStatuses": dict(Counter(str(row.get("status") or "UNKNOWN") for row in content_experiments)),
            "invalidContentExperimentUrlCount": invalid_content_experiment_urls,
            "protectedRouteCount": len(set(url_experiment_routes) | set(content_experiment_routes)),
            "observingRouteCount": len({
                route
                for row in content_experiments
                if row.get("status") == "OBSERVING"
                and (route := normalize_url_identity(row.get("url"))) is not None
            }),
        },
        "decisions": {
            "count": len(decisions),
            "counts": dict(decision_counts),
            "holdCount": decision_counts.get("HOLD", 0),
            "targetRouteCount": len(set(decision_routes)),
            "invalidTargetUrlCount": invalid_decision_urls,
            "blockedDecisionCount": len(blocked_decisions),
            "blockedDecisionWithoutTargetUrlCount": unmapped_blocked_decisions,
            "routeMappingStatus": "COMPLETE" if unmapped_blocked_decisions == 0 else "PARTIAL",
        },
        "launchQueue": {
            "count": len(queue_rows),
            "statuses": dict(queue_statuses),
            "selectedAt": summary_period(queue, "selectedAt"),
            "invalidSuggestedUrlCount": invalid_queue_urls,
            "candidateRouteCount": len(set(queue_routes)),
        },
        "ymyl": {
            "metadataEntryCount": len(metadata_rows),
            "trueCount": ymyl_true_count,
            "unknownFlagCount": ymyl_unknown_count,
            "protectedRouteCount": len(set(ymyl_routes)),
        },
        "exceptions": {
            "approvedArabicCount": len(approved_arabic_paths),
            "urls": sorted(APPROVED_ARABIC_RETIREMENT_URLS),
            "status": "VALID" if len(approved_arabic_paths) == len(APPROVED_ARABIC_RETIREMENT_URLS) else "UNKNOWN",
        },
        "protectedRouteCount": len(protected_routes),
        "routeSets": {
            "winners": sorted(set(winner_routes)),
            "experiments": sorted(set(url_experiment_routes) | set(content_experiment_routes)),
            "editorialDecisions": sorted(set(decision_routes)),
            "ymyl": sorted(set(ymyl_routes)),
            "launchQueue": sorted(set(queue_routes)),
            "exceptions": sorted(approved_arabic_paths),
        },
        "errors": errors,
        "deletionAuthorized": False,
    }


def load_target_set(path: str | Path) -> list[dict[str, Any]]:
    """Load a fixed review set without changing the route cohort."""
    value = json.loads(Path(path).read_text(encoding="utf-8"))
    records = value.get("records") if isinstance(value, dict) else None
    if not isinstance(records, list):
        raise ValueError("target set must contain a records list")
    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in records:
        if not isinstance(row, dict):
            raise ValueError("target set record must be an object")
        route = str(row.get("path") or "")
        path_obj = Path(route)
        if (
            not route.startswith("jp/report/travel/")
            or path_obj.is_absolute()
            or ".." in path_obj.parts
            or path_obj.suffix.casefold() != ".html"
        ):
            raise ValueError(f"invalid target path: {route!r}")
        if route in seen:
            raise ValueError(f"duplicate target path: {route}")
        seen.add(route)
        blob = row.get("historicalBlob")
        if blob is not None and not re.fullmatch(r"[0-9a-f]{40}", str(blob)):
            raise ValueError(f"invalid historical blob: {route}")
        historical_bytes = row.get("historicalBytes")
        if historical_bytes is not None and (
            type(historical_bytes) is not int or historical_bytes <= 0
        ):
            raise ValueError(f"invalid historical byte count: {route}")
        normalized.append({
            "path": route,
            "historicalBlob": blob,
            "historicalBytes": historical_bytes,
        })
    return normalized


def _route_variants(path: str, source_directory: str | None = None) -> list[bytes]:
    variants = {
        path,
        "/" + path,
        path.replace("/", "\\/"),
        ("/" + path).replace("/", "\\/"),
        path.replace("/", "%2F"),
        ("/" + path).replace("/", "%2F"),
        path.replace("/", "&#47;"),
        ("/" + path).replace("/", "&#47;"),
        path.replace("/", "&#x2f;"),
        ("/" + path).replace("/", "&#x2f;"),
    }
    if source_directory is not None:
        relative = posixpath.relpath(path, source_directory or ".")
        variants.update({relative, "./" + relative})
    return [variant.encode("utf-8") for variant in variants]


def _variant_positions(line: bytes, variants: list[bytes]) -> list[int]:
    intervals: list[tuple[int, int]] = []
    for variant in variants:
        cursor = 0
        while (position := line.find(variant, cursor)) >= 0:
            before = line[position - 1] if position else None
            after_position = position + len(variant)
            after = line[after_position] if after_position < len(line) else None
            if (before is None or before not in b"abcdefghijklmnopqrstuvwxyz0123456789._~%-") and (
                after is None or after not in b"abcdefghijklmnopqrstuvwxyz0123456789._~%-"
            ):
                intervals.append((position, after_position))
            cursor = position + 1
    merged: list[tuple[int, int]] = []
    for start, end in sorted(set(intervals)):
        if merged and start < merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return [start for start, _ in merged]


def _is_dynamic_route_expression(line: bytes, prefix_end: int) -> bool:
    tail = line[prefix_end:].lstrip()
    if tail.startswith((b"${", b"{{", b"<%", b"*", b"{slug", b"{name", b"{city")):
        return True
    if tail.startswith((b"'", b'"', b"`")):
        suffix = tail[1:].lstrip()
        return suffix.startswith((b"+", b",", b".concat", b".join"))
    return False


def _reference_kind(source_path: str, line: bytes, match_start: int) -> str:
    lower_path = source_path.casefold()
    lower_line = line.lower()
    suffix = Path(source_path).suffix.casefold()
    if suffix in PAGEFIND_SUFFIXES or "pagefind" in lower_path:
        return "pagefind"
    if suffix == ".xml" and "sitemap" in lower_path:
        return "sitemap"
    if suffix in {".html", ".htm"}:
        tag_start = lower_line.rfind(b"<", 0, match_start + 1)
        tag_end = lower_line.find(b">", match_start)
        tag = lower_line[tag_start : tag_end + 1] if tag_start >= 0 and tag_end >= 0 else b""
        if tag.startswith(b"<link") and b"canonical" in tag:
            return "canonical"
        if tag.startswith(b"<link") and b"hreflang" in tag:
            return "hreflang"
        if re.match(rb"<a(?:\s|>)", tag):
            return "internal_html_link"
        if tag.startswith(b"<script") or b"src=" in tag:
            return "html_script_or_resource"
        return "html_reference"
    if suffix in {".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"}:
        return "javascript"
    if source_path.startswith(("scripts/", "templates/", "src/")) or suffix in {
        ".astro", ".njk", ".py", ".sh", ".vue"
    }:
        return "generator_or_template"
    if "search" in lower_path or "index" in Path(source_path).name.casefold():
        return "search_index"
    return "static_source"


def _tracked_paths(root: Path) -> tuple[list[str], str | None]:
    result = _git(root, "ls-files", "-z")
    if result.returncode:
        return [], result.stderr.decode("utf-8", "replace").strip() or "git ls-files failed"
    paths = [item.decode("utf-8", "surrogateescape") for item in result.stdout.split(b"\0") if item]
    return paths, None


def scan_dependencies(root: str | Path, targets: list[dict[str, Any]]) -> dict[str, Any]:
    """Scan all tracked text sources once; never convert incomplete coverage to no links."""
    root = Path(root).resolve()
    tracked, git_error = _tracked_paths(root)
    routes = [str(item["path"]) for item in targets]
    route_index = {path: index for index, path in enumerate(routes)}
    basename_indices: dict[bytes, list[int]] = {}
    for index, route in enumerate(routes):
        basename_indices.setdefault(Path(route).name.lower().encode("utf-8"), []).append(index)
    basename_alternatives = sorted(basename_indices, key=len, reverse=True)
    basename_matcher = (
        re.compile(
            rb"(?<![A-Za-z0-9._~%-])(?:"
            + b"|".join(re.escape(value) for value in basename_alternatives)
            + rb")(?![A-Za-z0-9._~%-])",
            re.IGNORECASE,
        )
        if basename_alternatives
        else None
    )
    variants_cache: dict[str, list[list[bytes]]] = {}

    def variants_for(source_path: str) -> list[list[bytes]]:
        source_directory = posixpath.dirname(source_path)
        if source_directory not in variants_cache:
            variants_cache[source_directory] = [
                [variant.lower() for variant in _route_variants(route, source_directory)]
                for route in routes
            ]
        return variants_cache[source_directory]

    inbound: dict[str, list[dict[str, Any]]] = {route: [] for route in routes}
    self_references: dict[str, list[dict[str, Any]]] = {route: [] for route in routes}
    audit_references: dict[str, list[dict[str, Any]]] = {route: [] for route in routes}
    documentation_references: dict[str, list[dict[str, Any]]] = {route: [] for route in routes}
    policy_references: dict[str, list[dict[str, Any]]] = {route: [] for route in routes}
    analytical_references: dict[str, list[dict[str, Any]]] = {route: [] for route in routes}
    outgoing: dict[str, set[str]] = {route: set() for route in routes}
    unsupported: list[dict[str, Any]] = []
    dynamic_paths: set[str] = set()
    non_text_assets = 0
    text_files_scanned = 0
    pagefind_scanned = 0
    pagefind_total = 0
    read_errors: list[dict[str, str]] = []
    bytes_scanned = 0

    def is_audit_source(source_path: str) -> bool:
        return source_path.startswith("tests/") or source_path == "scripts/content_protection_dependency.py"

    def is_documentation_source(source_path: str) -> bool:
        return Path(source_path).suffix.casefold() in {".md", ".rst"}

    for source_path in tracked:
        route_variants = variants_for(source_path)
        suffix = Path(source_path).suffix.casefold()
        is_pagefind = suffix in PAGEFIND_SUFFIXES or "pagefind" in source_path.casefold()
        if is_pagefind:
            pagefind_total += 1
        if suffix in NON_TEXT_SUFFIXES and not is_pagefind:
            non_text_assets += 1
            continue
        if suffix not in TEXT_SUFFIXES and not is_pagefind:
            unsupported.append({"path": source_path, "reason": "UNSUPPORTED_TRACKED_SUFFIX"})
            continue
        try:
            stream = (root / source_path).open("rb")
        except OSError as error:
            read_errors.append({"path": source_path, "reason": type(error).__name__})
            continue
        with stream:
            try:
                probe = stream.read()
                bytes_scanned += len(probe)
                is_decodable_text = b"\x00" not in probe
                if is_decodable_text:
                    probe.decode("utf-8")
                else:
                    is_decodable_text = False
            except (OSError, UnicodeError) as error:
                is_decodable_text = False
                reason = type(error).__name__
            else:
                reason = "BINARY_OR_NON_UTF8"
            if is_decodable_text:
                text_files_scanned += 1
                if is_pagefind:
                    pagefind_scanned += 1
            else:
                unsupported.append({"path": source_path, "reason": reason})
                stream.seek(0)
            stream.seek(0)
            for line_number, line in enumerate(stream, 1):
                if basename_matcher is None:
                    continue
                matched_routes: set[str] = set()
                line_lower = line.lower()
                candidate_indices: set[int] = set()
                for match in basename_matcher.finditer(line):
                    candidate_indices.update(basename_indices[match.group(0).lower()])
                for target_index in candidate_indices:
                    target = routes[target_index]
                    positions = _variant_positions(line_lower, route_variants[target_index])
                    if not positions:
                        continue
                    matched_routes.add(target)
                    for position in positions:
                        kind = _reference_kind(source_path, line, position)
                        reference = {
                            "path": source_path,
                            "line": line_number,
                            "column": position + 1,
                            "kind": kind,
                        }
                        if source_path == target:
                            self_references[target].append(reference)
                        elif is_audit_source(source_path):
                            audit_references[target].append(reference)
                        elif is_documentation_source(source_path):
                            documentation_references[target].append(reference)
                        elif source_path in POLICY_REFERENCE_PATHS:
                            policy_references[target].append(reference)
                        elif (
                            source_path in ANALYTICAL_REFERENCE_PATHS
                            or source_path.startswith(ANALYTICAL_REFERENCE_PREFIXES)
                        ):
                            analytical_references[target].append(reference)
                        else:
                            inbound[target].append(reference)
                            if source_path in route_index and kind == "internal_html_link":
                                outgoing[source_path].add(target)
                if suffix in CODE_SUFFIXES and not is_audit_source(source_path):
                    prefix_match = ROUTE_PREFIX_RE.search(line)
                    if (
                        prefix_match
                        and _is_dynamic_route_expression(line, prefix_match.end())
                        and not matched_routes
                    ):
                        dynamic_paths.add(source_path)

    coverage_status = (
        "PARTIAL"
        if unsupported or read_errors or git_error or non_text_assets
        else "COMPLETE_STATIC_INPUTS"
    )
    route_results: dict[str, dict[str, Any]] = {}
    tracked_set = set(tracked)
    for target in targets:
        route = str(target["path"])
        exists = route in tracked_set and (root / route).is_file()
        try:
            target_bytes = (root / route).read_bytes() if exists else b""
        except OSError:
            target_bytes = b""
            exists = False
        current_blob = _git_blob(root, route) if exists else None
        references = inbound[route]
        internal_link_references = [
            reference for reference in references if reference["kind"] == "internal_html_link"
        ]
        cohort_reverse_links = [
            reference for reference in internal_link_references if reference["path"] in route_index
        ]
        if references:
            dependency_status = "STATIC_INBOUND_FOUND"
        elif coverage_status == "PARTIAL" or dynamic_paths:
            dependency_status = "UNKNOWN_INCOMPLETE_SCAN"
        else:
            dependency_status = "UNKNOWN_DYNAMIC_REFERENCE_COVERAGE"
        route_results[route] = {
            "trackedPageExists": exists,
            "currentBytes": len(target_bytes),
            "currentGitBlob": current_blob,
            "historicalBlob": target.get("historicalBlob"),
            "historicalBlobMatches": (
                current_blob == target.get("historicalBlob")
                if target.get("historicalBlob")
                else None
            ),
            "historicalBytes": target.get("historicalBytes"),
            "selfReferences": self_references[route],
            "auditReferences": audit_references[route],
            "auditReferenceCount": len(audit_references[route]),
            "documentationReferences": documentation_references[route],
            "documentationReferenceCount": len(documentation_references[route]),
            "policyReferences": policy_references[route],
            "policyReferenceCount": len(policy_references[route]),
            "analyticalReferences": analytical_references[route],
            "analyticalReferenceCount": len(analytical_references[route]),
            "inboundReferences": references,
            "inboundReferenceCount": len(references),
            "internalLinkInboundReferences": internal_link_references,
            "internalLinkInboundCount": len(internal_link_references),
            "cohortReverseLinks": cohort_reverse_links,
            "sitemapReferenceCount": sum(
                reference["kind"] == "sitemap" for reference in references
            ),
            "canonicalHreflangInboundCount": sum(
                reference["kind"] in {"canonical", "hreflang"} for reference in references
            ),
            "selfCanonicalCount": sum(
                reference["kind"] == "canonical" for reference in self_references[route]
            ),
            "selfHreflangCount": sum(
                reference["kind"] == "hreflang" for reference in self_references[route]
            ),
            "outgoingCandidatePaths": sorted(outgoing[route]),
            "internalLinkOutboundCount": len(outgoing[route]),
            "staticStatus": "INBOUND_REFERENCES_FOUND" if references else (
                "NO_STATIC_INBOUND_FOUND" if coverage_status == "COMPLETE_STATIC_INPUTS" else "UNKNOWN_INCOMPLETE_SCAN"
            ),
            "dependencyStatus": dependency_status,
            "deletionAuthorized": False,
        }

    revision_result = _git(root, "rev-parse", "HEAD")
    revision = revision_result.stdout.decode("ascii", "replace").strip() if revision_result.returncode == 0 else None
    internal_edges = sorted(
        (
            {"source": source, "target": target}
            for source, targets_for_source in outgoing.items()
            for target in targets_for_source
        ),
        key=lambda edge: (edge["source"], edge["target"]),
    )
    return {
        "sourceRevision": revision,
        "coverage": {
            "status": coverage_status,
            "trackedFiles": len(tracked),
            "textFilesScanned": text_files_scanned,
            "bytesScanned": bytes_scanned,
            "unsupportedPaths": unsupported,
            "readErrors": read_errors,
            "nonTextAssetsSkipped": non_text_assets,
            "pagefindFiles": pagefind_total,
            "pagefindFilesScanned": pagefind_scanned,
            "gitInventoryError": git_error,
        },
        "dynamicReferenceStatus": "UNKNOWN",
        "dynamicReferencePaths": sorted(dynamic_paths),
        "routes": route_results,
        "cohortInternalLinkEdges": internal_edges,
        "cohortInternalLinkEdgeCount": len(internal_edges),
        "cohortIncomingInternalLinkCount": sum(
            len(item["cohortReverseLinks"]) for item in route_results.values()
        ),
        "deletionAuthorizedCount": 0,
    }


def build_report(root: str | Path, target_set_path: str | Path, ops_dir: str | Path | None = None) -> dict[str, Any]:
    targets = load_target_set(target_set_path)
    protection = build_protection_report(root, ops_dir=ops_dir)
    target_paths = {"/" + str(target["path"]).lstrip("/") for target in targets}
    route_protection = {
        label: sorted(target_paths & {"/" + str(route).lstrip("/") for route in routes})
        for label, routes in protection["routeSets"].items()
    }
    return {
        "schemaVersion": 1,
        "protection": protection,
        "targetProtectionOverlap": {
            "byPolicy": route_protection,
            "countsByPolicy": {key: len(value) for key, value in route_protection.items()},
        },
        "dependencies": scan_dependencies(root, targets),
        "fixedTargetCount": len(targets),
        "deletionAuthorizedCount": 0,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="repository working tree")
    parser.add_argument("--ops-dir", type=Path, help="external EMFLS operations directory")
    parser.add_argument(
        "--targets",
        default="tests/fixtures/c01-review-set-50.json",
        help="fixed route-set JSON",
    )
    parser.add_argument("--output", help="optional JSON output path")
    args = parser.parse_args(argv)
    report = build_report(args.root, args.targets, ops_dir=args.ops_dir)
    rendered = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        Path(args.output).write_text(rendered, encoding="utf-8")
    else:
        sys.stdout.write(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
