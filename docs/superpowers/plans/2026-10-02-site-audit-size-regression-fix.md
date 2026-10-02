# Site audit size regression fix

## Goal and constraints

Fix PR #31's generated `data/site-audit.json` growth while preserving the Arabic `/ae/` retirement and the scoring, SEO, and measurement workflows. Keep PR #31 open and unmerged. Work only on its existing branch; do not start JP or other locale pruning, rewrite history, or expand the artifact cleanup to other generated files.

## Root cause

The base audit contains 19,066 page rows at 16,296,694 bytes. The current audit contains 19,030 rows at 100,167,019 bytes. It is minified already, so formatting and page growth do not explain the increase. New fields add about 82.9 MB, of which `visible_text_prefix` alone accounts for about 73.0 MB. The legacy field set serializes the current rows to about 16.27 MB.

## Architecture

- Keep the full audit shape available for transient work, including `visible_text_prefix`, `internal_link_targets`, and quality diagnostic signals.
- Make the committed `data/site-audit.json` a compact, backward-compatible inventory using the field set present in the pre-PR base artifact. This avoids changing legacy readers and drops fields that can be regenerated from HTML.
- Add an explicit full-output option to `scripts/seo_audit.py`; the SEO QA workflow will write its full audit to `/tmp/site-audit-full.json` and its compact inventory to `data/site-audit.json`. Both quality-audit invocations in that workflow will read the full temporary audit.
- GA4 and GSC workflows will request full temporary audits explicitly. Their generated measurement and scoring behavior remains unchanged.
- Keep the other generated artifacts out of scope; record them only as later review candidates.

## Consumer contract

- **REQUIRED_COMMITTED:** fields present in the base artifact; retain them to preserve the existing committed-artifact reader contract.
- **REQUIRED_TRANSIENT:** `visible_text_prefix`, `internal_link_targets`, and the added diagnostic fields used by `quality_scoring.py` or `quality_audit.py`; supply them to scoring from the full transient audit.
- **DERIVABLE:** all audit fields originate from HTML and can be rebuilt by `seo_audit.py`; transient quality fields are regenerated at runtime.
- **UNUSED:** no additional field will be retained solely because it is present; confirm field references across scripts, workflows, and tests before selecting the compact allowlist.

The named consumers of the committed artifact must continue to work with the legacy field set. `quality_audit.py` is the consumer that needs `internal_link_targets`, and `quality_scoring.py` needs the long excerpt and diagnostic signals; workflow calls therefore receive the full temporary audit.

## Implementation sequence

1. Add regression tests proving compact serialization retains the base schema, omits the verbose additions, and stays below the 25 MB target on the current site; prove full serialization still retains scoring fields.
2. Run the focused test and observe its failure before implementation.
3. Implement explicit compact and full audit serialization/output paths, then route SEO QA, GA4, and GSC to the correct output.
4. Regenerate the compact committed audit and the required SEO reports. Update workflow-input tests and document the final architecture, sizes, and evidence in `PROJECT_HISTORY.md` and `TASKS.md`.
5. Verify Arabic retirement invariants, both full Python suites, SEO QA, Keyword Hunter dry-run, sitemap and feed references, unchanged raw GA4/GSC snapshots, no non-Arabic HTML changes, exact tracked-byte totals, and `git diff --check`.
6. Commit and push to the existing PR #31 branch only. Wait for the resulting CI run, record the final head and CI evidence in Notion, and leave the PR open/unmerged for main review.

## Acceptance criteria

- Committed audit is below 25 MB; full scoring data remains available transiently.
- Fixed tracked bytes are at or below the base total, allowing only the small plan/documentation delta; Arabic deletions remain intact.
- The required checks pass, there are no duplicate sitemap URLs or Arabic sitemap/feed references, raw GA4/GSC snapshots are unchanged, and no non-Arabic HTML differs.
- PR #31 remains open and unmerged. No JP First 50 work begins.
