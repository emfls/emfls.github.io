# 90-Day Locale Measurement Audit Pipeline Implementation Plan

> **For agentic workers:** use the native execution method in this session; do not delegate. Steps use checkbox syntax for tracking.

**Goal:** Collect complete GA4 URL evidence and finalized, locale-filtered GSC page evidence for the latest 90 days, then produce a conservative, dependency-checked Batch A candidate manifest without deleting production pages.

**Architecture:** Add an audit-only Python collector with injectable API boundaries, explicit GA4 pagination/completeness metadata, per-locale GSC pagination, exact manifest conservation, and dependency-aware page classifications. Route only a manual dispatch on `codex/locale-measurement-audit-90d` into this collector; write all source rows beneath `$RUNNER_TEMP` and upload four seven-day artifacts.

**Tech Stack:** Python 3.11, Google Analytics Data API v1beta, Search Console API v1, GitHub Actions, existing unittest/pytest and YAML validation.

**Spec:** User brief at `/Users/whitesmile/.codex/attachments/02e4c3b0-c765-4de5-85de-9c8091b5ae75/붙여넣은 텍스트.txt`.

## Global Constraints

- Start from `d87451872ecffe95d0b0e1da8d4a698a76f52e6c`; audit branch is `codex/locale-measurement-audit-90d`.
- Never merge to `main`, create a PR, delete HTML, rewrite history, or commit raw measurement output.
- GA4 zero is admissible only after full `rowCount` retrieval and explicit no-threshold/no-other-row-loss metadata; unavailable metadata stays unknown.
- GSC queries use finalized data and one URL-prefix filter per locale; GSC no-row is never verified zero.
- Every one of the 5,916 manifest routes gets exactly one status; normalization collisions and unresolved dependencies are held.
- Candidate cap is 50 and is a maximum; do not fill it.
- Audit workflow is dispatch-only for this exact branch, artifact-only, seven-day retention, with no staging, commit, or push steps.
- Never expose service-account content or credentials in logs or artifacts.

## Review Focus

- Missing or inconsistent GA4 `rowCount` / page retrieval must prevent verified-zero labels.
- Multiple raw path aliases for one canonical manifest route must retain their mappings and become collision holds.
- Thresholding or `(other)` row loss must invalidate the GA4 zero gate.
- GSC top-row limitations remain visible even after locale filtering and pagination.
- Protected, opportunity, experiment, incoming-link, sitemap/feed, and hard-coded route dependencies must block or hold deletion candidacy.

---

### Task 1: Define audit contracts with failing tests

**Files:**
- Create: `tests/test_audit_locale_90d_measurement.py`

**Interfaces:** tests define expectations for GA4 pagination/metadata, GSC locale filters/startRow pagination, normalized-route collision preservation, status conservation, missing-vs-zero, protected/dependency exclusions, candidate cap, and audit-only workflow safeguards.

- [ ] Write minimal tests for all listed contracts, using fake API responses only at external client boundaries.
- [ ] Run the focused test file and confirm failures arise from the absent audit module/behavior.

### Task 2: Implement audit collector and classification

**Files:**
- Create: `scripts/audit_locale_90d_measurement.py`
- Test: `tests/test_audit_locale_90d_measurement.py`

**Interfaces:** expose pure date/URL normalization, GA4 pagination, GSC locale pagination, exact tree manifest, dependency scan, classification, candidate selection, and atomic artifact writing helpers.

- [ ] Implement minimal functions to satisfy the failing tests.
- [ ] Store row counts, fetched pages, stop reasons, API metadata, per-locale pagination, normalized aliases, and source-specific periods.
- [ ] Build summary JSON, complete route CSV, and raw GA4/GSC JSON only in the requested output directory.
- [ ] Run focused tests until green; inspect the full candidate gate and route-conservation totals.

### Task 3: Add branch-only artifact workflow route

**Files:**
- Modify: `.github/workflows/ga4-collection.yml`
- Test: `tests/test_audit_locale_90d_measurement.py`

- [ ] Add a manual exact-branch job with read-only repository permission, installed GA4/GSC clients, base-SHA freshness check, and `$RUNNER_TEMP` output.
- [ ] Keep the existing main collector job behavior unchanged.
- [ ] Upload the four named artifacts with seven-day retention; do not add Git staging/commit/push commands.
- [ ] Run workflow contract and YAML tests.

### Task 4: Verify, run, and review Batch A

**Files:**
- Modify: `PROJECT_HISTORY.md`, `TASKS.md`

- [ ] Run focused audit tests, relevant existing GA4/GSC/workflow tests, and the repository test suites.
- [ ] Push only the audit branch and dispatch the existing GA4 workflow on that branch.
- [ ] Download and validate the artifact; independently reconcile all 5,916 manifest routes and class sums.
- [ ] Review technical dependencies and content uniqueness for any passing zero-signal pages; produce at most 50 exact candidates.
- [ ] Run history-size simulation only if at least one candidate passes all gates, in a fresh temporary mirror and never push it.
- [ ] Record actual results and blockers in project history/tasks; leave production HTML, sitemaps, and main unchanged.
