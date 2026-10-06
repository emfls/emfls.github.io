#!/usr/bin/env python3
"""Promote a complete set of validated derived measurement artifacts."""

import argparse
import shutil
import tempfile
from pathlib import Path


def _sibling_temp(target, suffix):
    handle = tempfile.NamedTemporaryFile(
        prefix=f".{target.name}.", suffix=suffix, dir=target.parent, delete=False
    )
    handle.close()
    return Path(handle.name)


def promote_artifacts(sources, destinations):
    sources, destinations = tuple(map(Path, sources)), tuple(map(Path, destinations))
    if len(sources) != 3 or len(destinations) != 3:
        raise ValueError("exactly three derived measurement artifacts are required")
    missing = [str(source) for source in sources if not source.is_file()]
    if missing:
        raise FileNotFoundError("generated artifact(s) missing: " + ", ".join(missing))

    staged, backups, promoted = [], {}, []
    try:
        for source, target in zip(sources, destinations):
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary = _sibling_temp(target, ".new")
            staged.append((temporary, target))
            shutil.copyfile(source, temporary)
            if target.exists():
                backup = _sibling_temp(target, ".old")
                backups[target] = backup
                shutil.copyfile(target, backup)
        for temporary, target in staged:
            temporary.replace(target)
            promoted.append(target)
    except Exception:
        for target in reversed(promoted):
            backup = backups.get(target)
            if backup and backup.exists():
                backup.replace(target)
            elif target.exists():
                target.unlink()
        raise
    finally:
        for temporary, _ in staged:
            temporary.unlink(missing_ok=True)
        for backup in backups.values():
            backup.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--page-source", type=Path, required=True)
    parser.add_argument("--opportunity-source", type=Path, required=True)
    parser.add_argument("--report-source", type=Path, required=True)
    parser.add_argument("--page-target", type=Path, default=Path("data/page-performance.json"))
    parser.add_argument("--opportunity-target", type=Path, default=Path("data/revenue-opportunities.json"))
    parser.add_argument("--report-target", type=Path, default=Path("reports/revenue-growth-report.md"))
    args = parser.parse_args()
    promote_artifacts(
        (args.page_source, args.opportunity_source, args.report_source),
        (args.page_target, args.opportunity_target, args.report_target),
    )


if __name__ == "__main__":
    main()
