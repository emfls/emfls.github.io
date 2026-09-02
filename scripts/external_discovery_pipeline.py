#!/usr/bin/env python3
"""Merge, rank, and report external-web discovery candidates."""

import argparse
import json
from copy import deepcopy
from pathlib import Path

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
    by_key = {_key(row): deepcopy(row) for row in existing_payload.get("candidates") or []}
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
    enough_research = 10 <= len(incoming) <= 30 and all(
        (row.get("discovery") or {}).get("origin") == "EXTERNAL_WEB" for row in incoming
    )
    ready = [row for row in candidates if row.get("status") == "READY_TO_LAUNCH"]
    ready.sort(
        key=lambda row: (
            -float(row.get("opportunityScore") or 0),
            -float(row.get("qualityScore") or 0),
            row.get("candidateId", ""),
        )
    )
    if not enough_research:
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
        "dataStatus": "OBSERVED_SEARCH_SIGNAL" if enough_research else "INSUFFICIENT_DATA",
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
