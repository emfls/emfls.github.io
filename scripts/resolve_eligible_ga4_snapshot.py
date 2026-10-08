#!/usr/bin/env python3
"""Select the newest historical GA4 blob aligned to the current verified GSC window."""

import argparse
import hashlib
import json
from datetime import date, timedelta
from pathlib import Path
import subprocess

try:
    from scripts.validate_measurement_sources import _validate_ga4, _validate_gsc
except ModuleNotFoundError:
    from validate_measurement_sources import _validate_ga4, _validate_gsc


GA4_REPOSITORY_PATH = "data/performance/ga4-latest.json"


def _read_json(path, label):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"could not read {label}: {exc}") from exc


def _as_of_from_gsc(gsc):
    if not isinstance(gsc, dict):
        raise ValueError("GSC snapshot must be an object")
    period_end = gsc.get("periodEnd")
    if not period_end:
        period_end = ((gsc.get("periods") or {}).get("gsc") or {}).get("end")
    try:
        as_of = date.fromisoformat(period_end) + timedelta(days=3)
    except (TypeError, ValueError):
        raise ValueError("GSC snapshot must contain an ISO period end") from None
    _validate_gsc(gsc, as_of)
    return as_of


def resolve_eligible_ga4_snapshot(
    *,
    gsc_path,
    revision,
    output_path,
    repository_root=".",
    repository_path=GA4_REPOSITORY_PATH,
    github_env=None,
):
    """Copy the newest GA4 source blob that meets the unchanged validator at GSC asOf."""
    root = Path(repository_root).resolve()
    gsc = _read_json(gsc_path, "GSC source snapshot")
    as_of = _as_of_from_gsc(gsc)
    try:
        revisions = subprocess.run(
            ["git", "log", "--format=%H", revision, "--", repository_path],
            cwd=root,
            text=True,
            capture_output=True,
            check=True,
        ).stdout.splitlines()
    except (OSError, subprocess.CalledProcessError) as exc:
        raise ValueError(f"could not inspect GA4 source history: {exc}") from exc

    for source_revision in revisions:
        try:
            source_bytes = subprocess.run(
                ["git", "show", f"{source_revision}:{repository_path}"],
                cwd=root,
                capture_output=True,
                check=True,
            ).stdout
            ga4 = json.loads(source_bytes.decode("utf-8"))
            _validate_ga4(ga4, as_of)
        except (OSError, subprocess.CalledProcessError, UnicodeDecodeError, json.JSONDecodeError, ValueError):
            continue

        target = Path(output_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(source_bytes)
        result = {
            "path": str(target.resolve()),
            "repositoryPath": repository_path,
            "revision": source_revision,
            "sha256": hashlib.sha256(source_bytes).hexdigest(),
            "asOf": as_of.isoformat(),
            "status": "VERIFIED",
        }
        if github_env:
            with Path(github_env).open("a", encoding="utf-8") as handle:
                handle.write(f"GA4_SNAPSHOT={result['path']}\n")
                handle.write(f"GA4_SOURCE_REVISION={source_revision}\n")
                handle.write(f"MEASUREMENT_AS_OF={result['asOf']}\n")
        return result

    raise ValueError(f"no eligible GA4 source snapshot found for asOf={as_of.isoformat()}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gsc", type=Path, required=True)
    parser.add_argument("--revision", required=True, help="checked-out Actions execution revision")
    parser.add_argument("--output", type=Path, required=True, help="isolated path for the selected source blob")
    parser.add_argument("--repository-root", type=Path, default=Path("."))
    parser.add_argument("--repository-path", default=GA4_REPOSITORY_PATH)
    parser.add_argument("--github-env", type=Path, help="optional GITHUB_ENV file to pin the selected path and revision")
    args = parser.parse_args()
    result = resolve_eligible_ga4_snapshot(
        gsc_path=args.gsc,
        revision=args.revision,
        output_path=args.output,
        repository_root=args.repository_root,
        repository_path=args.repository_path,
        github_env=args.github_env,
    )
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
