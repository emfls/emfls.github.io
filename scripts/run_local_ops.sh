#!/bin/zsh
set -euo pipefail
umask 077

REPO_DIR="${EMFLS_REPO_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
OPS_DIR="${EMFLS_OPS_DIR:-}"
if [[ -z "$OPS_DIR" || "$OPS_DIR" != /* ]]; then
  print -u2 "Set EMFLS_OPS_DIR to the absolute path of the local operations folder."
  exit 78
fi
PYTHON="${EMFLS_PYTHON:-$OPS_DIR/.venv/bin/python}"
export EMFLS_REPO_DIR="$REPO_DIR"
export EMFLS_OPS_DIR="$OPS_DIR"
export TZ="Asia/Seoul"
export PYTHONPATH="$REPO_DIR${PYTHONPATH:+:$PYTHONPATH}"

if [[ ! -d "$OPS_DIR" || ! -f "$OPS_DIR/.env" ]]; then
  print -u2 "EMFLS_OPS_DIR must contain the local .env and data/ directories."
  exit 78
fi
if [[ ! -x "$PYTHON" ]]; then
  print -u2 "Local Python runtime missing under EMFLS_OPS_DIR/.venv."
  exit 78
fi
mkdir -p "$OPS_DIR/data" "$OPS_DIR/reports" "$OPS_DIR/logs" "$OPS_DIR/cache"
set -a
source "$OPS_DIR/.env"
set +a
cd "$REPO_DIR"

task="${1:-}"
case "$task" in
  keyword-hunter)
    "$PYTHON" scripts/keyword_hunter.py --root "$REPO_DIR" --ops-dir "$OPS_DIR"
    "$PYTHON" scripts/verify_local_ops_run.py keyword-hunter "$OPS_DIR"
    ;;
  ga4)
    "$PYTHON" scripts/collect_ga4_snapshot.py --output "$OPS_DIR/data/performance/ga4-latest.json" --days 28
    "$PYTHON" scripts/verify_local_ops_run.py ga4 "$OPS_DIR"
    ;;
  gsc)
    "$PYTHON" scripts/collect_gsc_snapshot.py --output "$OPS_DIR/data/performance/gsc-latest.json" --days 28
    "$PYTHON" scripts/verify_local_ops_run.py gsc "$OPS_DIR"
    ;;
  adsense)
    backup="$OPS_DIR/data/performance/adsense-before-local-cutover-2026-10-15.json"
    if [[ -f "$OPS_DIR/data/performance/adsense-latest.json" && ! -e "$backup" ]]; then
      cp -n "$OPS_DIR/data/performance/adsense-latest.json" "$backup"
    fi
    "$PYTHON" scripts/collect_adsense_snapshot.py --output "$OPS_DIR/data/performance/adsense-latest.json" --days 7
    "$PYTHON" scripts/collect_adsense_snapshot.py --validate-only "$OPS_DIR/data/performance/adsense-latest.json"
    "$PYTHON" scripts/verify_local_ops_run.py adsense "$OPS_DIR"
    ;;
  derived-measurement)
    "$PYTHON" scripts/run_derived_measurement.py --repo "$REPO_DIR" --ops "$OPS_DIR"
    "$PYTHON" scripts/verify_local_ops_run.py derived-measurement "$OPS_DIR"
    ;;
  content-index-refresh)
    "$PYTHON" scripts/build_content_index.py --root "$REPO_DIR" --ops-dir "$OPS_DIR"
    ;;
  *)
    print -u2 "usage: run_local_ops.sh {keyword-hunter|ga4|gsc|adsense|derived-measurement|content-index-refresh}"
    exit 64
    ;;
esac
