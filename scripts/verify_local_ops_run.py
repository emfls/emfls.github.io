#!/usr/bin/env python3
"""Print a secret-free summary and validate one local EMFLS operations run."""

import csv
import ast
import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def verify(kind, ops):
    ops = Path(ops).resolve()
    data = ops / "data"
    if kind == "keyword-hunter":
        with (data / "keywords_master.csv").open(encoding="utf-8", newline="") as handle:
            count = sum(1 for _ in csv.DictReader(handle))
        history = read_json(data / "recent_exploration_history.json")
        runs = history.get("runs") or []
        if not count or not runs:
            raise ValueError("Keyword Hunter state has no rows or run history")
        latest = runs[-1]
        run_at = datetime.fromisoformat(latest["run_id"])
        report_path = ops / "reports/keyword-hunter" / (run_at.strftime("%Y-%m-%d-%H%M") + ".md")
        report_text = report_path.read_text(encoding="utf-8")
        health_line = next((line.split(": ", 1)[1] for line in report_text.splitlines() if line.startswith("- api_health: ")), "{}")
        api_health = ast.literal_eval(health_line)
        degraded = {name: status for name, status in api_health.items() if status not in {"OK", "NOT_CONFIGURED"}}
        result = {
            "task": kind,
            "rows": count,
            "run_id": latest.get("run_id"),
            "report": "present",
            "status": "PARTIAL" if degraded else "VERIFIED",
            "degraded_services": degraded,
        }
    elif kind == "ga4":
        snapshot = read_json(data / "performance/ga4-latest.json")
        period = snapshot["periods"]["ga4"]
        if not snapshot.get("pages") or snapshot.get("site", {}).get("ga4", {}).get("status") != "VERIFIED":
            raise ValueError("GA4 snapshot is not verified or contains no page rows")
        result = {"task": kind, "rows": len(snapshot["pages"]), "start": period["start"], "end": period["end"], "status": "VERIFIED"}
    elif kind == "gsc":
        snapshot = read_json(data / "performance/gsc-latest.json")
        if snapshot.get("status") != "VERIFIED" or not snapshot.get("pages"):
            raise ValueError("GSC snapshot is not verified or contains no page rows")
        result = {"task": kind, "rows": len(snapshot["pages"]), "start": snapshot["periodStart"], "end": snapshot["periodEnd"], "status": "VERIFIED"}
    elif kind == "adsense":
        from scripts.collect_adsense_snapshot import validate_snapshot

        snapshot = read_json(data / "performance/adsense-latest.json")
        validate_snapshot(snapshot)
        site = snapshot["site"]
        if site.get("comparisonStatus") != "VERIFIED":
            raise ValueError("AdSense site comparison is not verified")
        period = snapshot["currentPeriod"]
        result = {
            "task": kind,
            "site_status": site["status"],
            "comparison": site["comparisonStatus"],
            "page_url_status": snapshot["pageUrls"]["coverageStatus"],
            "page_url_rows": snapshot["pageUrls"]["returnedRowCount"],
            "start": period["start"],
            "end": period["end"],
        }
    elif kind == "derived-measurement":
        snapshot = read_json(data / "page-performance.json")
        rows = snapshot.get("pages")
        if not isinstance(rows, list) or not rows:
            raise ValueError("Derived page-performance output has no page rows")
        result = {"task": kind, "rows": len(rows), "as_of": snapshot.get("asOf") or snapshot.get("as_of"), "status": "PRESENT"}
    else:
        raise ValueError("Unsupported run type")
    return result


def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: verify_local_ops_run.py KIND EMFLS_OPS_DIR")
    try:
        print(json.dumps(verify(sys.argv[1], sys.argv[2]), ensure_ascii=False, sort_keys=True))
    except (OSError, ValueError, KeyError, TypeError, csv.Error) as error:
        print("local operations validation failed: {}".format(error), file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
