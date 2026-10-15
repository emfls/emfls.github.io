#!/bin/zsh
set -euo pipefail
umask 077

REPO_DIR="${EMFLS_REPO_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
SOURCE_OPS_DIR="${EMFLS_OPS_DIR:-$HOME/Documents/emfls-ops}"
TRUSTED_BASE_REF_FILE="$SOURCE_OPS_DIR/state/content-launch-guard-base-ref.txt"
QA_RUN_ID="${EMFLS_QA_RUN_ID:-$(TZ=Asia/Seoul date +%Y%m%dT%H%M%S%z)}"
QA_DIR="${EMFLS_QA_ARTIFACTS_DIR:-$SOURCE_OPS_DIR/qa-artifacts/$QA_RUN_ID}"
PYTHON="${EMFLS_PYTHON:-$SOURCE_OPS_DIR/.venv/bin/python}"
CHANGE_BASE_REF="origin/main"
export EMFLS_REPO_DIR="$REPO_DIR"
export EMFLS_SOURCE_OPS_DIR="$SOURCE_OPS_DIR"
export EMFLS_OPS_DIR="$QA_DIR"
export TZ="Asia/Seoul"
export PYTHONPATH="$REPO_DIR${PYTHONPATH:+:$PYTHONPATH}"

if [[ ! -f "$SOURCE_OPS_DIR/.env" || ! -x "$PYTHON" || ! -f "$TRUSTED_BASE_REF_FILE" ]]; then
  print -u2 "Run setup in EMFLS_OPS_DIR first; this script never creates or prints API keys."
  exit 78
fi

# Clone operational inputs into a per-run sandbox before any analyzer runs.
# All generated data, reports, caches, and state stay under QA_DIR.
mkdir -p "$QA_DIR/cache" "$QA_DIR/logs" "$QA_DIR/reports" "$QA_DIR/data" "$QA_DIR/state"
if [[ -d "$SOURCE_OPS_DIR/data" ]]; then
  cp -R "$SOURCE_OPS_DIR/data/." "$QA_DIR/data/"
fi
if [[ -d "$SOURCE_OPS_DIR/state" ]]; then
  cp -R "$SOURCE_OPS_DIR/state/." "$QA_DIR/state/"
fi
if [[ -d "$SOURCE_OPS_DIR/reports" ]]; then
  cp -R "$SOURCE_OPS_DIR/reports/." "$QA_DIR/reports/"
fi
ln -s "$SOURCE_OPS_DIR/.env" "$QA_DIR/.env"

set -a
source "$SOURCE_OPS_DIR/.env"
set +a
TRUSTED_BASE_REF="$(tr -d '[:space:]' < "$TRUSTED_BASE_REF_FILE")"
if [[ ${#TRUSTED_BASE_REF} -ne 40 || "$TRUSTED_BASE_REF" == *[^0-9a-f]* ]]; then
  print -u2 "Invalid trusted launch-evidence snapshot ref in EMFLS_OPS_DIR/state."
  exit 78
fi
cd "$REPO_DIR"

TODAY="$(TZ=Asia/Seoul date +%F)"
RUN_AT="$("$PYTHON" -c 'from datetime import datetime; from zoneinfo import ZoneInfo; print(datetime.now(ZoneInfo("Asia/Seoul")).isoformat(timespec="seconds"))')"
"$PYTHON" scripts/build_content_index.py --root "$REPO_DIR" --ops-dir "$SOURCE_OPS_DIR"
"$PYTHON" scripts/run_derived_measurement.py --repo "$REPO_DIR" --ops "$QA_DIR"
"$PYTHON" scripts/naver_performance.py \
  --snapshot "$(find "$QA_DIR/data/naver" -maxdepth 1 -type f -name 'search-advisor-*.json' -print | sort | tail -n 1)" \
  --page-scores "$QA_DIR/data/page-scores.json" \
  --report "$QA_DIR/reports/naver-data-quality.md" \
  --json-output "$QA_DIR/data/naver-performance.json"
"$PYTHON" scripts/daily_revenue_growth.py \
  --root "$REPO_DIR" --ops-dir "$QA_DIR" --run-at "$RUN_AT" \
  --research "$QA_DIR/data/new-content-research.json" --preserve-launch-manifest
"$PYTHON" scripts/search_trend_signals.py \
  --root "$QA_DIR" --config "$QA_DIR/data/search-trend-keywords.json" \
  --run-at "$RUN_AT"

# 8-2 moved operational launch evidence out of Git; read its pinned snapshot
# ref from emfls-ops, while checking only this task's origin/main..HEAD diff.
"$PYTHON" scripts/content_launch_guard.py \
  --root "$REPO_DIR" --ops-dir "$QA_DIR" \
  --manifest "$QA_DIR/data/content-launch-manifest.json" \
  --base-ref "$TRUSTED_BASE_REF" --change-base-ref "$CHANGE_BASE_REF"
"$PYTHON" scripts/seo_qa.py "$REPO_DIR" \
  --audit "$QA_DIR/data/site-audit.json" \
  --baseline "$QA_DIR/data/seo-qa-baseline.json" \
  --report "$QA_DIR/reports/seo-qa.md" --today "$TODAY"
"$PYTHON" scripts/keyword_hunter.py --root "$REPO_DIR" --ops-dir "$QA_DIR" --dry-run > "$QA_DIR/cache/keyword-hunter-preview.md"

if ! command -v npm >/dev/null 2>&1; then
  print -u2 "npm is required for the StockWiki build checks; local QA cannot skip them."
  exit 78
fi
(cd "$REPO_DIR/kor/stockwiki" && npm ci && npm run build)

"$PYTHON" -m unittest discover -s tests -q
"$PYTHON" -m pytest -q -o "cache_dir=$QA_DIR/cache/pytest"
"$PYTHON" -m pytest -q -o "cache_dir=$QA_DIR/cache/pytest" tests/test_canonical_inventory.py tests/test_stockwiki_ad_safety.py tests/test_stockwiki_build_integrity.py
git diff --check
print "Local QA passed. QA artifacts: $QA_DIR"
