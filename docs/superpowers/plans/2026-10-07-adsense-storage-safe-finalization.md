# AdSense Storage-Safe Finalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep only a <=256 KiB, useful AdSense diagnostic snapshot in Git while retaining full breakdown evidence for seven days as a GitHub Actions artifact.

**Architecture:** Keep `adsense-latest.json` unchanged. Add a deterministic builder and validator in the existing collector that reduces the raw 14-day DATE and dimensional report snapshot into bounded daily, platform, ad-format, and top-country summaries. The workflow writes raw output under `$RUNNER_TEMP`, validates and uploads it with seven-day retention, then stages only the base snapshot and guarded diagnostic latest file.

**Tech Stack:** Python 3.11 standard library, unittest/pytest, GitHub Actions YAML, git.

**Spec:** Storage-Safe Finalization request supplied in the current task; baseline behavior in `docs/superpowers/plans/2026-10-06-adsense-daily-observability.md`.

## Global Constraints

- Keep `data/performance/adsense-latest.json` contract and bytes-generating code unchanged.
- Keep raw DATE × COUNTRY, DATE × PLATFORM_TYPE, DATE × AD_FORMAT reports out of tracked paths and stage commands.
- Keep the tracked diagnostic latest artifact at or below 256 KiB; exceeding the cap fails explicitly.
- Keep the raw Actions artifact for seven days and upload it even when later compact validation fails, if the raw file exists.
- Preserve Asia/Seoul account timezone, currency, source, generated time, periods, completeness, row counts, truncation, warnings, and caveats.
- Preserve missing/null, explicit zero, partial, not-available, and unsupported-combination distinctions.
- Do not query the unverified three-way dimension combination or call the live AdSense API.
- Do not change HTML, content, ad placement, credentials, main, or workflow dispatch state.
- Use the existing isolated branch; normal commits/push only; make one PR creation attempt; do not merge.

## File Structure

- Modify `scripts/collect_adsense_snapshot.py` for compact diagnostic aggregation, validation, size enforcement, and build/validate CLI modes.
- Modify `tests/test_adsense_snapshot.py` for transformation, quality, size, and storage workflow contracts.
- Modify `.github/workflows/adsense-collection.yml` for runner-temp raw output, validation, Actions upload, and the two-file tracked allowlist.
- Create `docs/analytics/adsense-storage-retention.md` to explain artifact locations, retention, and the distinct storage layers.
- Update `PROJECT_HISTORY.md` and `TASKS.md` with the finalization decision and delivery state.
- Create `docs/superpowers/plans/2026-10-07-adsense-storage-safe-finalization.md` as the execution record.

## Review Focus

- Missing daily dates/metrics must stay absent/null and make completeness partial; test exact missing-date and missing-metric preservation.
- A reported zero must remain zero while an unavailable report remains empty/null; test both through the compact builder and validator.
- Country top-N selection must not use CTR and must be stable under tied earnings; test earnings/page-view/name ordering and the documented page-view fallback.
- Rates cannot be summed or averaged across rows; test Page RPM, CPC, request coverage recomputation and unavailable Active View aggregation.
- Oversized diagnostic output or a failed validation must never silently stage raw detail; test the 256 KiB rejection, runner-temp upload contract, and exact Git staging allowlist.

---

### Task 1: Pin storage-safe diagnostic behavior with failing tests

**Files:**
- Modify: `tests/test_adsense_snapshot.py`

**Interfaces:**
- Consumes: current `build_breakdown_snapshot()` fixtures.
- Produces: tests for `build_diagnostics_snapshot(raw)`, `validate_diagnostics_snapshot(value)`, and `MAX_DIAGNOSTICS_BYTES`.

- [x] **Step 1: Add focused tests** for 14-row bound and metadata preservation; additive sums and derived rates; null versus zero; partial/warnings; country deterministic ordering and fallback; omission caveat; size guard; workflow raw upload/staging; base snapshot unchanged.
- [x] **Step 2: Run** `python3 -m pytest tests/test_adsense_snapshot.py -q` and confirm the new tests fail because the diagnostic builder, validator, and workflow contract are missing.

### Task 2: Implement compact diagnostics and validation

**Files:**
- Modify: `scripts/collect_adsense_snapshot.py`
- Test: `tests/test_adsense_snapshot.py`

**Interfaces:**
- Consumes: schema v1 raw breakdown snapshot.
- Produces: `build_diagnostics_snapshot(raw) -> dict`, `validate_diagnostics_snapshot(snapshot) -> bool`, `write_diagnostics_snapshot(path, snapshot)`, and CLI `--build-diagnostics-from` / `--diagnostics-output` / `--validate-diagnostics-only`.

- [x] **Step 1: Implement** period summaries for platform and ad format, top 20 countries per period, deterministic rankings, additive measures, recomputed Page RPM/CPC/request coverage, and null Active View period aggregation.
- [x] **Step 2: Implement** strict schema/period/row/status validation and the 256 KiB serialized-file ceiling; validation failure must return nonzero.
- [x] **Step 3: Run** focused diagnostic tests and confirm they pass; run existing collector tests to prove base snapshot and PAGE_URL fail-soft compatibility.

### Task 3: Move raw storage to Actions artifacts and document retention

**Files:**
- Modify: `.github/workflows/adsense-collection.yml`, `tests/test_adsense_snapshot.py`
- Create: `docs/analytics/adsense-storage-retention.md`

**Interfaces:**
- Consumes: collector CLI from Task 2.
- Produces: raw JSON in `$RUNNER_TEMP/adsense-breakdown-latest.json`; artifact `adsense-breakdown-${{ github.run_id }}-${{ github.run_attempt }}` with seven-day retention; tracked `data/performance/adsense-diagnostics-latest.json`.

- [x] **Step 1: Test** runner-temp location, upload action path/retention, fixed latest filename, and exact staged paths (`adsense-latest.json` and `adsense-diagnostics-latest.json`) with a worst-cap synthetic raw file.
- [x] **Step 2: Update** workflow order: collect, validate raw, build diagnostic, validate/cap diagnostic, upload raw even after later failure when present, stage explicit allowlist, commit/push only changed tracked snapshots.
- [x] **Step 3: Document** current checkout size, tracked current size, `.git` history, GitHub repository history, Actions artifact storage, and Pages payload as distinct storage layers.
- [x] **Step 4: Run** focused workflow tests and YAML parsing; verify the base snapshot contract and tracked filename are unchanged except the storage destination for raw detail.

### Task 4: Record final state and complete fresh repository verification

**Files:**
- Modify: `PROJECT_HISTORY.md`, `TASKS.md`

- [ ] **Step 1: Record** the storage redesign, verified latest main, artifact location/retention, size evidence, tests, API compatibility limitation, and PR/CI state.
- [x] **Step 2: Run** focused AdSense tests, full unittest, full pytest, SEO QA, content launch guard, workflow YAML parse, Python syntax, and `git diff --check` on the final tree.
- [ ] **Step 3: Review** staged paths and diff; run the content launch guard against freshly fetched latest main; commit and push normally; verify remote head.
- [ ] **Step 4: Make one GitHub PR creation attempt** and inspect exact-head CI if a PR is created. Never merge.
