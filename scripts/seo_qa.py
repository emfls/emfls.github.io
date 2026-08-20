#!/usr/bin/env python3
"""Baseline-aware SEO quality gate for the static site."""

import argparse
import hashlib
import json
import re
import sys
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

try:
    from .content_health_reports import find_broken_internal_links
except ImportError:
    from content_health_reports import find_broken_internal_links


IMMUTABLE_KINDS = {"embedded_secret", "retired_domain"}
RETIRED_ORIGIN = "https://emfls" + ".com"
SCAN_SUFFIXES = {".py", ".js", ".sh", ".yml", ".yaml"}
SECRET_PATTERNS = (
    re.compile(r"github_pat_[A-Za-z0-9_]{20,}"),
    re.compile(r"\b\d{8,12}:[A-Za-z0-9_-]{30,}\b"),
    re.compile(r"(?i)(?:coupang[^\n]{0,40}(?:access|secret)[^=\n]*=\s*)['\"][^'\"]{16,}['\"]"),
)


def _issue(kind, identifier, **details):
    return {"id": f"{kind}:{identifier}", "kind": kind, **details}


def _date_is_future(value, today):
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date() > today
    except (TypeError, ValueError):
        return False


def _duplicates(pages, field, kind):
    groups = defaultdict(list)
    for page in pages:
        value = str(page.get(field) or "").strip()
        if value:
            groups[value].append(page["path"])
    warnings = []
    for value, paths in groups.items():
        if len(paths) < 2:
            continue
        digest = hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]
        warnings.append(_issue(kind, digest, count=len(paths), paths=sorted(paths)))
    return warnings


def _production_files(root):
    for path in sorted(Path(root).rglob("*")):
        if not path.is_file() or path.suffix.lower() not in SCAN_SUFFIXES:
            continue
        relative = path.relative_to(root)
        if any(part in {".git", ".venv", "node_modules", "tests", "docs", "reports", "data"} for part in relative.parts):
            continue
        yield path, relative


def collect_issues(audit, broken_links, root, today=None):
    today = today or date.today()
    critical = []
    warnings = []
    for page in audit.get("pages", []):
        path = page["path"]
        if not str(page.get("title") or "").strip():
            critical.append(_issue("missing_title", path))
        if not str(page.get("description") or "").strip():
            critical.append(_issue("missing_description", path))
        if not str(page.get("canonical") or "").strip():
            critical.append(_issue("missing_canonical", path))
        if page.get("h1_count") != 1:
            critical.append(_issue("h1_not_one", path, count=page.get("h1_count")))
        for field in ("published_date", "updated_date"):
            if _date_is_future(page.get(field), today):
                critical.append(_issue("future_date", f"{path}:{field}", value=page[field]))

    for item in broken_links:
        identifier = f"{item['source']}->{item['target']}"
        critical.append(_issue("broken_internal_link", identifier))

    warnings.extend(_duplicates(audit.get("pages", []), "title", "duplicate_title"))
    warnings.extend(_duplicates(audit.get("pages", []), "description", "duplicate_description"))

    for path, relative in _production_files(Path(root).resolve()):
        try:
            source = path.read_text(encoding="utf-8")
        except (OSError, UnicodeError):
            continue
        if RETIRED_ORIGIN in source:
            critical.append(_issue("retired_domain", relative.as_posix()))
        if any(pattern.search(source) for pattern in SECRET_PATTERNS):
            critical.append(_issue("embedded_secret", relative.as_posix()))

    critical.sort(key=lambda item: item["id"])
    warnings.sort(key=lambda item: item["id"])
    return {"critical": critical, "warnings": warnings}


def compare_baseline(current, baseline):
    allowed_critical = set(baseline.get("critical", []))
    allowed_warnings = set(baseline.get("warnings", []))
    new_critical = [
        item for item in current["critical"]
        if item["kind"] in IMMUTABLE_KINDS or item["id"] not in allowed_critical
    ]
    new_warnings = [item for item in current["warnings"] if item["id"] not in allowed_warnings]
    return {
        "failed": bool(new_critical),
        "new_critical": new_critical,
        "new_warnings": new_warnings,
        "current_critical_count": len(current["critical"]),
        "current_warning_count": len(current["warnings"]),
    }


def _baseline(issues):
    immutable = [item for item in issues["critical"] if item["kind"] in IMMUTABLE_KINDS]
    if immutable:
        raise RuntimeError("Cannot baseline embedded secrets or the retired domain")
    return {
        "critical": [item["id"] for item in issues["critical"]],
        "warnings": [item["id"] for item in issues["warnings"]],
    }


def render_report(result):
    lines = [
        "# SEO QA Result", "",
        f"- Status: {'FAIL' if result['failed'] else 'PASS'}",
        f"- Current baseline-managed critical issues: {result['current_critical_count']:,}",
        f"- Current warnings: {result['current_warning_count']:,}",
        f"- New critical issues: {len(result['new_critical']):,}",
        f"- New warnings: {len(result['new_warnings']):,}", "",
        "Existing issues remain visible in the baseline; only regressions fail CI. Embedded secrets and the retired domain can never be baselined.", "",
    ]
    if result["new_critical"]:
        lines.extend(("## New critical issues", ""))
        lines.extend(f"- `{item['id']}`" for item in result["new_critical"])
    if result["new_warnings"]:
        lines.extend(("", "## New warnings", ""))
        lines.extend(f"- `{item['id']}`" for item in result["new_warnings"])
    return "\n".join(lines).rstrip() + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path, nargs="?", default=Path("."))
    parser.add_argument("--audit", type=Path, default=Path("data/site-audit.json"))
    parser.add_argument("--baseline", type=Path, default=Path("data/seo-qa-baseline.json"))
    parser.add_argument("--report", type=Path, default=Path("reports/seo-qa.md"))
    parser.add_argument("--today", default=date.today().isoformat())
    parser.add_argument("--write-baseline", action="store_true")
    args = parser.parse_args()

    audit = json.loads(args.audit.read_text(encoding="utf-8"))
    broken = find_broken_internal_links(args.root)
    issues = collect_issues(
        audit, broken, args.root,
        today=datetime.strptime(args.today, "%Y-%m-%d").date(),
    )
    if args.write_baseline:
        baseline = _baseline(issues)
        args.baseline.parent.mkdir(parents=True, exist_ok=True)
        args.baseline.write_text(json.dumps(baseline, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    elif not args.baseline.exists():
        raise FileNotFoundError(f"Missing QA baseline: {args.baseline}")

    baseline = json.loads(args.baseline.read_text(encoding="utf-8"))
    result = compare_baseline(issues, baseline)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(render_report(result), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if result["failed"] else 0


if __name__ == "__main__":
    sys.exit(main())
