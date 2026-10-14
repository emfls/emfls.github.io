# Reviewed single-candidate news intake

The discovery pipeline previously suppressed every ready item unless one invocation contained 10–30 ideas. This made a source-reviewed single article unusable without supplying unrelated ideas. The new explicit `SINGLE_EDITORIAL_REVIEW` input mode accepts exactly one low-risk candidate, only with a matching APPROVE decision, candidate ID, target route, source references, owner-delegation basis, and authorization references. The ordinary discovery batch requirement is unchanged.

Candidate opportunity/quality thresholds, source and brief checks, overlap rules, YMYL checks, trusted-base separation, and three-per-KST-day publication cap remain active. A single review can select only its approved candidate, cannot promote other backlog entries, and preserves unrelated candidate objects. ESTIMATED demand remains ESTIMATED; it does not become observed or measured search volume.

## Current reviewed article

Candidate `EXT-20261014-KANANA-SPACE`: a source-backed registration/access checklist for Kanana Space. Three official pages and three Korean competing documents were reviewed. Monthly Naver volume and DataLab trend remain NOT_MEASURED. The existing external rubric computes opportunity74.5 and feasibility93.25 from explicitly labeled editorial judgments and recorded reasons. These are not measured traffic, income, or the BLOG score. BLOG rubric single-executor review is89 earned/4 NOT_MEASURED/7 unearned, P0observed0; no independent external review is claimed.

The owner directly delegated publication decisions and told this executor to proceed. The authorization and complete draft are retained at https://app.notion.com/p/3f8db4c0a991810dbfcbfc4585cb2c36. APPROVE is recorded by Codex under that delegation, not represented as a separate human article review.

This upstream change contains no new article HTML. Only after this exact change is merged and becomes the trusted base will a separate content PR add the reviewed article, original diagram, hub/sitemap entry, and complete publication history. No keyword values, protected pages, counters, or existing manifest records are altered here.

## Verification

The positive one-item case failed before implementation. Focused discovery/opportunity/manifest suite30 PASS, including HOLD/missing source/wrong route/unsupported authority/quality/demand/YMYL/two-item rejection and unrelated history preservation. Default10–30 behavior remains covered. Launch Guard and diff checks pass locally. Full tests and exact-head CI are recorded in the release result.
