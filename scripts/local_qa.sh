#!/bin/zsh
set -euo pipefail
umask 077

REPO_DIR="${EMFLS_REPO_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
OPS_DIR="${EMFLS_OPS_DIR:-$HOME/Documents/emfls-ops}"
PYTHON="${EMFLS_PYTHON:-$OPS_DIR/.venv/bin/python}"
BASE_REF="${EMFLS_QA_BASE_REF:-$(git -C "$REPO_DIR" rev-parse origin/main)}"
export EMFLS_REPO_DIR="$REPO_DIR"
export EMFLS_OPS_DIR="$OPS_DIR"
export TZ="Asia/Seoul"
export PYTHONPATH="$REPO_DIR${PYTHONPATH:+:$PYTHONPATH}"

if [[ ! -f "$OPS_DIR/.env" || ! -x "$PYTHON" ]]; then
  print -u2 "Run setup in EMFLS_OPS_DIR first; this script never creates or prints API keys."
  exit 78
fi
mkdir -p "$OPS_DIR/cache" "$OPS_DIR/logs" "$OPS_DIR/reports"
set -a
source "$OPS_DIR/.env"
set +a
cd "$REPO_DIR"

TODAY="$(TZ=Asia/Seoul date +%F)"
RUN_AT="$("$PYTHON" -c 'from datetime import datetime; from zoneinfo import ZoneInfo; print(datetime.now(ZoneInfo("Asia/Seoul")).isoformat(timespec="seconds"))')"
"$PYTHON" scripts/build_content_index.py --root "$REPO_DIR" --ops-dir "$OPS_DIR"
"$PYTHON" scripts/run_derived_measurement.py --repo "$REPO_DIR" --ops "$OPS_DIR"
"$PYTHON" scripts/naver_performance.py \
  --snapshot "$(find "$OPS_DIR/data/naver" -maxdepth 1 -type f -name 'search-advisor-*.json' -print | sort | tail -n 1)" \
  --page-scores "$OPS_DIR/data/page-scores.json" \
  --report "$OPS_DIR/reports/naver-data-quality.md" \
  --json-output "$OPS_DIR/data/naver-performance.json"
"$PYTHON" scripts/daily_revenue_growth.py \
  --root "$REPO_DIR" --ops-dir "$OPS_DIR" --run-at "$RUN_AT" \
  --research "$OPS_DIR/data/new-content-research.json" --preserve-launch-manifest
"$PYTHON" scripts/search_trend_signals.py \
  --root "$OPS_DIR" --config "$OPS_DIR/data/search-trend-keywords.json" \
  --run-at "$RUN_AT"

GUARD_BASE="$BASE_REF"
if [[ -f "$OPS_DIR/state/content-launch-guard-base-ref.txt" ]]; then
  GUARD_BASE="$(cat "$OPS_DIR/state/content-launch-guard-base-ref.txt")"
fi
"$PYTHON" scripts/content_launch_guard.py \
  --root "$REPO_DIR" --ops-dir "$OPS_DIR" \
  --manifest "$OPS_DIR/data/content-launch-manifest.json" --base-ref "$GUARD_BASE"
"$PYTHON" scripts/seo_qa.py "$REPO_DIR" \
  --audit "$OPS_DIR/data/site-audit.json" \
  --baseline "$OPS_DIR/data/seo-qa-baseline.json" \
  --report "$OPS_DIR/reports/seo-qa.md" --today "$TODAY"
"$PYTHON" scripts/keyword_hunter.py --root "$REPO_DIR" --ops-dir "$OPS_DIR" --dry-run > "$OPS_DIR/cache/keyword-hunter-preview.md"

if ! command -v npm >/dev/null 2>&1; then
  print -u2 "npm is required for the StockWiki build checks; local QA cannot skip them."
  exit 78
fi
(cd "$REPO_DIR/kor/stockwiki" && npm ci && npm run build)

"$PYTHON" -m unittest discover -s tests -q
"$PYTHON" -m pytest -q -o "cache_dir=$OPS_DIR/cache/pytest"
"$PYTHON" -m pytest -q -o "cache_dir=$OPS_DIR/cache/pytest" tests/test_canonical_inventory.py tests/test_stockwiki_ad_safety.py tests/test_stockwiki_build_integrity.py
git diff --check
print "Local QA passed. Generated pages are in the checkout; operational results remain under $OPS_DIR."
