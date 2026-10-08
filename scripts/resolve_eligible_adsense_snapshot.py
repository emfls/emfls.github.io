#!/usr/bin/env python3
"""Select the newest historical AdSense snapshot eligible for an aligned source date."""

import argparse
import hashlib
import json
import os
import subprocess
from pathlib import Path

try:
    from scripts.validate_measurement_sources import validate_measurement_sources
except ModuleNotFoundError:
    from validate_measurement_sources import validate_measurement_sources


ADSENSE_REPOSITORY_PATH = "data/performance/adsense-latest.json"


def _read_json(path, label):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"could not read {label}: {exc}") from exc


def resolve_eligible_adsense_snapshot(
    *,
    ga4_path,
    gsc_path,
    as_of,
    revision,
    output_path,
    repository_root=".",
    repository_path=ADSENSE_REPOSITORY_PATH,
):
    """Copy the newest source-commit blob that passes the unchanged freshness validator."""
    root = Path(repository_root).resolve()
    ga4 = _read_json(ga4_path, "GA4 source snapshot")
    gsc = _read_json(gsc_path, "GSC source snapshot")
    try:
        revisions = subprocess.run(
            ["git", "log", "--format=%H", revision, "--", repository_path],
            cwd=root,
            text=True,
            capture_output=True,
            check=True,
        ).stdout.splitlines()
    except (OSError, subprocess.CalledProcessError) as exc:
        raise ValueError(f"could not inspect AdSense source history: {exc}") from exc

    for source_revision in revisions:
        try:
            source_bytes = subprocess.run(
                ["git", "show", f"{source_revision}:{repository_path}"],
                cwd=root,
                capture_output=True,
                check=True,
            ).stdout
            adsense = json.loads(source_bytes.decode("utf-8"))
            statuses = validate_measurement_sources(ga4, gsc, adsense, as_of=as_of)
        except (OSError, subprocess.CalledProcessError, UnicodeDecodeError, json.JSONDecodeError, ValueError):
            continue

        target = Path(output_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(source_bytes)
        return {
            "path": str(target.resolve()),
            "repositoryPath": repository_path,
            "revision": source_revision,
            "sha256": hashlib.sha256(source_bytes).hexdigest(),
            "asOf": as_of,
            "status": statuses["adsense"],
        }

    raise ValueError(f"no eligible AdSense source snapshot found for asOf={as_of}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ga4", type=Path, required=True)
    parser.add_argument("--gsc", type=Path, required=True)
    parser.add_argument("--as-of", required=True)
    parser.add_argument("--revision", required=True, help="checked-out Actions execution revision")
    parser.add_argument("--output", type=Path, required=True, help="isolated path for the selected source blob")
    parser.add_argument("--repository-root", type=Path, default=Path("."))
    parser.add_argument("--repository-path", default=ADSENSE_REPOSITORY_PATH)
    parser.add_argument("--github-env", type=Path, help="optional GITHUB_ENV file to pin the selected path and revision")
    args = parser.parse_args()
    result = resolve_eligible_adsense_snapshot(
        ga4_path=args.ga4,
        gsc_path=args.gsc,
        as_of=args.as_of,
        revision=args.revision,
        output_path=args.output,
        repository_root=args.repository_root,
        repository_path=args.repository_path,
    )
    if args.github_env:
        with args.github_env.open("a", encoding="utf-8") as handle:
            handle.write(f"ADSENSE_SNAPSHOT={result['path']}\n")
            handle.write(f"ADSENSE_SOURCE_REVISION={result['revision']}\n")
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
