#!/usr/bin/env python3
"""Merge, rank, and report external-web discovery candidates."""

import argparse
import json
from copy import deepcopy
from pathlib import Path
from urllib.parse import urlsplit

try:
    from scripts.external_content_opportunity import (
        launch_readiness,
        normalize_external_candidate,
        score_external_opportunity,
        score_quality_feasibility,
    )
except ModuleNotFoundError:
    from external_content_opportunity import (
        launch_readiness,
        normalize_external_candidate,
        score_external_opportunity,
        score_quality_feasibility,
    )

try:
    from scripts.content_launch_decisions import decisions_from_document
    from scripts.content_launch_policy import normalize_keyword, normalize_url_identity, requires_ymyl_review
except ModuleNotFoundError:
    from content_launch_decisions import decisions_from_document
    from content_launch_policy import normalize_keyword, normalize_url_identity, requires_ymyl_review


TERMINAL_STATUSES = {"REJECTED", "SAME_INTENT", "FAILED_PATTERN"}


def _read(path, default):
    path = Path(path)
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def _write(path, payload):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _normalized_text(value):
    return " ".join(str(value or "").casefold().split())


def _key(candidate):
    intent = (candidate.get("intent") or {}).get("primary")
    return "{}::{}".format(candidate.get("locale") or "und", _normalized_text(intent))


def _refs(candidate):
    return list((candidate.get("discovery") or {}).get("evidenceRefs") or [])


def _https_refs(values):
    if not isinstance(values, list) or not values:
        return False
    for value in values:
        if not isinstance(value, str):
            return False
        try:
            parsed = urlsplit(value)
            if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
                return False
        except ValueError:
            return False
    return True


def _single_review_approved(root, incoming):
    """A reviewed low-risk incremental intake is distinct from broad discovery."""
    if len(incoming) != 1:
        return False
    candidate = incoming[0]
    if not isinstance(candidate, dict) or candidate.get("ymyl") is not False:
        return False
    if any(requires_ymyl_review({"keyword": value}) for value in (
        candidate.get("keyword"), candidate.get("idea"),
        (candidate.get("discovery") or {}).get("observedTopic"),
        (candidate.get("intent") or {}).get("primary"),
        (candidate.get("brief") or {}).get("primaryIntent"),
    ) if value):
        return False
    if launch_readiness(candidate).get("status") != "READY_TO_LAUNCH":
        return False
    if not _https_refs(_refs(candidate)) or not _https_refs([
        row.get("url") for row in candidate.get("officialSources", [])
        if isinstance(row, dict)
    ]):
        return False
    document = _read(root / "data/content-launch-decisions.json", {})
    try:
        decisions = decisions_from_document(document)
    except (ValueError, TypeError):
        return False
    key = normalize_keyword(candidate.get("keyword"))
    if not key or decisions.get(key) != "APPROVE":
        return False
    matches = [row for row in document["decisions"] if normalize_keyword(row.get("keyword")) == key]
    if len(matches) != 1:
        return False
    record = matches[0]
    identity = normalize_url_identity(candidate.get("url"))
    return bool(
        identity
        and normalize_url_identity(record.get("targetUrl")) == identity
        and record.get("candidateId") == candidate.get("candidateId")
        and str(record.get("reason") or "").strip()
        and record.get("approvalBasis") == "OWNER_DELEGATED_PUBLICATION"
        and _https_refs(record.get("sourceRefs"))
        and _https_refs(record.get("approvalRefs"))
    )


def _evaluate(candidate, run_at):
    row = normalize_external_candidate(candidate, run_at[:10])
    opportunity = score_external_opportunity(row)
    quality = score_quality_feasibility(row)
    readiness = launch_readiness(row)
    status = readiness["status"]
    if status == "READY_TO_LAUNCH":
        next_status = status
    elif status == "SAME_INTENT":
        next_status = status
    elif row.get("brief"):
        next_status = "BRIEF_READY"
    else:
        next_status = "RESEARCHING"
    return {
        **row,
        "status": next_status,
        "opportunityScore": opportunity["score"],
        "opportunityComponents": opportunity["components"],
        "qualityScore": quality["score"],
        "qualityComponents": quality["components"],
        "readiness": readiness,
    }


def _merge(existing, incoming, run_at):
    old_refs = _refs(existing)
    incoming_refs = _refs(incoming)
    new_refs = [ref for ref in incoming_refs if ref not in old_refs]
    if existing.get("status") in TERMINAL_STATUSES and not new_refs:
        preserved = deepcopy(existing)
        preserved["firstDiscoveredAt"] = preserved.get("firstDiscoveredAt") or run_at
        preserved["lastDiscoveredAt"] = preserved.get("lastDiscoveredAt") or preserved["firstDiscoveredAt"]
        return preserved, True

    merged = deepcopy(incoming)
    merged["candidateId"] = existing.get("candidateId") or incoming.get("candidateId")
    discovery = dict(merged.get("discovery") or {})
    discovery["evidenceRefs"] = old_refs + new_refs
    merged["discovery"] = discovery
    merged["firstDiscoveredAt"] = existing.get("firstDiscoveredAt") or run_at
    merged["lastDiscoveredAt"] = run_at
    return _evaluate(merged, run_at), False


def _report(payload):
    summary = payload["summary"]
    lines = [
        "# EXTERNAL DISCOVERY PIPELINE",
        "",
        "- Run: {}".format(payload["runAt"]),
        "- Data status: {}".format(payload["dataStatus"]),
        "- External ideas discovered: {}".format(summary["externalIdeasDiscovered"]),
        "- Google: {}".format(summary["google"]),
        "- Naver: {}".format(summary["naver"]),
        "- Other websites: {}".format(summary["otherWebsites"]),
        "- Rejected as existing intent: {}".format(summary["rejectedAsExistingIntent"]),
        "- Researching: {}".format(summary["researching"]),
        "- Brief ready: {}".format(summary["briefReady"]),
        "- Ready to launch: {}".format(summary["readyToLaunch"]),
        "- Pages launched today: {} / 3".format(summary["pagesLaunchedToday"]),
        "",
        "## TOP 10 EXTERNAL OPPORTUNITIES",
        "",
    ]
    for index, row in enumerate(payload["top10"], 1):
        discovery = row.get("discovery") or {}
        lines.extend(
            [
                "### {}. {}".format(index, row.get("idea")),
                "",
                "- Candidate: {}".format(row.get("candidateId")),
                "- Discovery: {} / {}".format(discovery.get("source"), discovery.get("method")),
                "- Demand status: {}".format(discovery.get("demandStatus")),
                "- Opportunity: {}".format(row.get("opportunityScore")),
                "- Quality: {}".format(row.get("qualityScore")),
                "- Closest existing page: {}".format((row.get("overlap") or {}).get("closestUrl")),
                "- Overlap: {}".format((row.get("overlap") or {}).get("level")),
                "- Content gap: {}".format(row.get("contentGap")),
                "- Status: {}".format(row.get("status")),
                "",
            ]
        )
    lines.extend(["## DUPLICATE REMOVAL RESULTS", ""])
    lines.append("- Reused without research: {}".format(summary["reusedWithoutResearch"]))
    return "\n".join(lines).rstrip() + "\n"


def run_external_pipeline(root, run_at, input_path, write=True):
    root = Path(root)
    incoming_payload = _read(input_path, {"candidates": []})
    incoming = incoming_payload.get("candidates") or []
    existing_payload = _read(
        root / "data/external-content-opportunities.json",
        {"schemaVersion": 1, "candidates": []},
    )
    existing_rows = existing_payload.get("candidates") or []
    single_mode = incoming_payload.get("reviewMode") == "SINGLE_EDITORIAL_REVIEW"
    by_key = {_key(row): deepcopy(row) for row in existing_rows}
    reused = 0

    for raw in incoming:
        key = _key(raw)
        if key in by_key:
            by_key[key], was_reused = _merge(by_key[key], raw, run_at)
            reused += int(was_reused)
        else:
            evaluated = _evaluate(raw, run_at)
            evaluated["firstDiscoveredAt"] = run_at
            evaluated["lastDiscoveredAt"] = run_at
            by_key[key] = evaluated

    candidates = sorted(by_key.values(), key=lambda row: row.get("candidateId", ""))
    single_collision = False
    if single_mode:
        # A one-candidate review must not deduplicate or refresh unrelated history.
        candidates = deepcopy(existing_rows)
        reused = 0
        if len(incoming) == 1:
            raw = incoming[0]
            matches = [i for i, row in enumerate(candidates) if _key(row) == _key(raw) or row.get("candidateId") == raw.get("candidateId")]
            single_collision = len(matches) > 1 or any(_key(candidates[i]) != _key(raw) for i in matches)
            if not single_collision:
                if matches:
                    candidates[matches[0]], was_reused = _merge(candidates[matches[0]], raw, run_at)
                    reused = int(was_reused)
                else:
                    evaluated = _evaluate(raw, run_at)
                    evaluated["firstDiscoveredAt"] = run_at
                    evaluated["lastDiscoveredAt"] = run_at
                    candidates.append(evaluated)
        candidates.sort(key=lambda row: row.get("candidateId", ""))
    single_approved = single_mode and not single_collision and _single_review_approved(root, incoming)
    enough_research = not single_mode and 10 <= len(incoming) <= 30 and all(
        (row.get("discovery") or {}).get("origin") == "EXTERNAL_WEB" for row in incoming
    )
    ready = [row for row in candidates if row.get("status") == "READY_TO_LAUNCH"]
    if single_mode:
        approved_ids = {row["candidateId"] for row in incoming} if single_approved else set()
        ready = [row for row in ready if row.get("candidateId") in approved_ids]
    ready.sort(
        key=lambda row: (
            -float(row.get("opportunityScore") or 0),
            -float(row.get("qualityScore") or 0),
            row.get("candidateId", ""),
        )
    )
    if not enough_research and not single_approved:
        ready = []
    top10 = sorted(
        candidates,
        key=lambda row: (
            -float(row.get("opportunityScore") or 0),
            -float(row.get("qualityScore") or 0),
            row.get("candidateId", ""),
        ),
    )[:10]
    source_counts = {"GOOGLE": 0, "NAVER": 0, "OTHER_WEBSITE": 0}
    for row in incoming:
        source = (row.get("discovery") or {}).get("source")
        source_counts[source if source in source_counts else "OTHER_WEBSITE"] += 1
    summary = {
        "externalIdeasDiscovered": len(incoming),
        "google": source_counts["GOOGLE"],
        "naver": source_counts["NAVER"],
        "otherWebsites": source_counts["OTHER_WEBSITE"],
        "rejectedAsExistingIntent": sum(row.get("status") == "SAME_INTENT" for row in candidates),
        "researching": sum(row.get("status") == "RESEARCHING" for row in candidates),
        "briefReady": sum(row.get("status") == "BRIEF_READY" for row in candidates),
        "readyToLaunch": len(ready),
        "pagesLaunchedToday": int(incoming_payload.get("pagesLaunchedToday") or 0),
        "reusedWithoutResearch": reused,
    }
    payload = {
        "schemaVersion": 1,
        "runAt": run_at,
        "dataStatus": (
            incoming[0]["discovery"]["demandStatus"] if single_approved
            else "OBSERVED_SEARCH_SIGNAL" if enough_research else "INSUFFICIENT_DATA"
        ),
        "summary": summary,
        "candidates": candidates,
        "readyToLaunch": [row["candidateId"] for row in ready],
        "top10": top10,
    }
    if write:
        _write(root / "data/external-content-opportunities.json", payload)
        report = root / "reports/external-discovery-pipeline.md"
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text(_report(payload), encoding="utf-8")
    return payload


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--run-at", required=True)
    parser.add_argument("--input", type=Path, default=Path("data/external-discovery-input.json"))
    args = parser.parse_args()
    result = run_external_pipeline(args.root, args.run_at, args.input)
    print(json.dumps(result["summary"], ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
