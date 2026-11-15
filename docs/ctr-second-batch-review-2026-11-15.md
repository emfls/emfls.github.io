# Second CTR batch: exact subset for draft review

This draft applies **274 changed HTML files** from the requested 344-row remainder: 273 new proposals plus the government index whose refreshed source/output hashes now match the current base. Every included file matches its declared after Git blob and SHA-256, with first-occurrence replacements and exact byte reversal checked. The base is `df49932cccb1484737b8e87dc37da1c2ba772e00`; input SHA-256 is `30c38cec80a8af6be8cc2538bef3b1889256378984f964922b66d525b9363494`.

## Counts and excluded inputs

The manifest has 3,598 rows. None has the literal status `MERGED`, so a literal `status != 'MERGED'` filter would select the entire input. The intended remainder is 273 missing-status rows plus 71 `HELD_FOR_REVIEW` rows. The 3,254 upstream-merged rows are skipped using their actual merged-status labels. The 344 remainder rows cover 339 unique paths.

Seventy old held proposals remain unchanged from the earlier input and are excluded from this draft. Their 65 unique paths include five paths with conflicting alternative outputs. No alternative is selected implicitly and no global replacement is substituted for the first-occurrence contract.

| Remaining reason | Rows |
| --- | ---: |
| Declared output mismatch after first-occurrence replacement | 37 |
| Conflicting alternatives on five paths | 10 |
| Newly invalid JSON-LD | 1 |
| Malformed body-link proposals | 4 |
| No byte change | 1 |
| Prior duplicate-producing, tool-link-removal and advertising-path findings | 17 |
| Total | 70 |

The government index is the one previously held row included here: its current before blob and the registered after blob both match, and its three substitutions change only title, H1 and description. Links, scripts, canonical and date fields are preserved. No master status, source replacement, output hash, protection ledger or workflow is rewritten.

## Actual checks and release blockers

- Exact-base comparison covers 19,547 raw HTML pages: parser errors, new critical issues and new warnings are zero; broken links remain 165 before/after. Existing site issues remain visible.
- Fresh localhost Chromium checks cover all 274 files at 320px and 390px: **548 unique measurements**, matching current after SHA-256 and requested viewport. Document overflow, wider body boxes and unknown rows are zero. External ads/analytics are blocked by CSP; this does not certify production ads, all interactions, indexing or revenue effects.
- The requested `python3 scripts/validate_launch.py --check-git` cannot run: that script is absent in the current repository, and the command exits 2. No shim is added. The supported `scripts/content_launch_guard.py` result is reported separately for the committed candidate, with the trusted evidence pin and explicit change base.
- Full `pytest tests/` was run on the unmodified base and on this candidate with separate copies of the same real operating inputs and a clean environment. **Both runs: 1,728 passed, 26 failed, 3 skipped.** Failed node IDs are identical; new failures and resolved failures are zero. The original operating data/state/reports remain unchanged.
- The 26 inherited failures concern existing workflow schedule expectations, title/snippet and marker/date contracts, template canonical inventory, feed size, daily capacity and a keyword-snapshot precondition. Assertions, schedules, held content and business rules are not changed to force a green suite. These failures still mean that the requested all-pass condition is **not met**.

Keep this PR in **draft**. Review of the exact subset is separate from completing the full-suite and full-input requirements. No main merge or deployment is included in this task. The remaining 70 rows require corrected input or separate reviewed patches; existing test-contract issues require their own resolution before release approval is sought.

Only the selected HTML files and these task/history/review records belong in the public change. Private measurements, full test logs, operating snapshots and local absolute paths remain outside the repository.
