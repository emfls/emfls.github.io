# PROJECT HISTORY

## 2026-10-06 — C33 Maple Planet top-winner content integrity repair

- Started from latest `origin/main` `02afeeb8e58fdbf0c6a3aae418ed41664b3e2b05` in isolated branch `codex/c33-maple-planet-content-integrity-20261006`. Scope is only the existing URL `kor/column/maple-planet-no-capital-rice-farming-2026.html`; no new Maple page or URL, sitemap, analytics, or ad changes.
- Corrected the page to identify MAPLE PLANET as a MapleStory Worlds creator world and link Nexon's official listing. The article now explains that the search term `쌀먹` may mean cash-out intent, then states the official prohibition and potential sanctions for RMT/external-currency trading. It provides no conversion, sale, brokerage, or price instructions. Removed unsupported hourly cash/meso yields, class-population statistics, private-replica-server framing, and other money-making claims.
- Preserved the canonical URL, OG URL, Article schema identity, publication date, sitemap entry, in-game meso/leveling purpose, and same-site related links. Added direct official links to the Maple Planet policy and play guide, Nexon's MAPLE PLANET listing, and the 2026-10-03 Evan quest/update note. The displayed review date and Article `dateModified` are 2026-10-06. SEO title/meta retain Maple Planet, no-capital meso, `쌀먹`, and policy intent.
- Verification: page-specific and related sibling tests 5 passed; unittest 819 passed (3 skipped); full pytest 1,341 passed (3 skipped); SEO audit 18,932 pages / 0 parser errors; SEO QA 0 new criticals and 0 new warnings (767 / 420 current); content launch guard PASS; quality scoring processed 18,929 pages; same-site links, Article JSON-LD and exact canonical/date contracts pass; `git diff --check` PASS. Updated a stale batch-test date/limitation contract exposed by the full-suite run. Audit and score outputs were directed to `/tmp`; generated tracked score outputs were restored and remain unchanged.
- PR #55 first exact-head SEO QA run `37422867065` failed at the protected-winner guard with `PROTECTED_WINNER_CHANGED`; later workflow stages were skipped. The repository guard already supports exact blob-pair approvals. Added a single C33 old/new blob transition for this assigned integrity repair plus regression coverage that permits only this exact pair and keeps variant/other-winner edits blocked. Local guard and focused page/guard tests pass; unittest 819 / 3 skipped and pytest 1,341 / 3 skipped pass.
- State at this checkpoint: correction is ready to push to open, unmerged PR #55; the new exact-head Actions run is pending. Keep the PR for Control Tower review. Revenue is `NO_DIRECT_REVENUE_LIFT_CLAIM`; publication scope is `EXISTING_PAGE_UPDATE_ONLY`.

## 2026-10-04 — P0 JP Travel Batch 02 — current-main synchronization and full local QA

- The requested main SHA `6b844cf03138057091bac2cdf1a87db3e98491f2` was confirmed, then `main` advanced during the work to `1b15674e09d3dd30fb65620ab2ae8f35f85c2137`; the later main includes the requested SHA and was synchronized too. Regular merge `5172e32bcd` incorporated the 6b844 tree and resolved three derived-artifact conflicts (`data/page-performance.json`, `data/revenue-opportunities.json`, `reports/revenue-growth-report.md`) using latest-main inputs and regenerated outputs. Regular merge `946f3cf027` incorporated `1b15674e` with no conflicts. No rebase or force push was used.
- Batch 02 remains exactly 50 JP Travel HTML deletions / 674,830 B plus exactly 50 matching JP Travel sitemap removals; no other HTML changed. All 50 latest-main performance rows have GA4 and Google status `NOT_CONNECTED`, with no numeric revenue, click, or impression values. Raw GA4/GSC snapshots have no candidate rows and are byte-identical to latest main; `NO_ROW`/`NOT_CONNECTED` means unknown, not zero. The 1,593 protected winners have zero candidate overlap; all three experiment records are `INCONCLUSIVE`. The latest targeted validation is `VERIFIED` for five other targets and mentions none of these candidates.
- All 50 source pages on latest main had `lang="ko"`; direct scan found no remaining inbound HTML link. The only operational path references are the intentional exact-deletion allowlist in `scripts/content_launch_guard.py`; no other manifest, index, feed, or generator dependency was found. Current broken internal links are 276, unchanged from latest-main baseline. Launch Guard allowlist/test protects this exact deletion set.
- Full local QA on the synchronized tree: `python3 -m unittest discover -s tests -q` 752 passed; `pytest` 1,215 passed; SEO QA 0 new criticals / 0 new warnings (767 existing criticals / 420 warnings); sitemap audit 46 leaf files / 18,707 URLs / 0 duplicates / 0 missing local refs / 0 unknown URLs; Naver URL data 30/30 matched, PASS; measurement artifact 18,928 pages, valid. Revenue growth selected three existing improvements; daily growth researched 10 and selected 0 (`INSUFFICIENT_DATA`). Search Trend Signals is `NOT_CONNECTED` because local credentials are absent. Keyword Hunter dry-run had 0 API calls / 0 writes. Content Launch Guard PASS; `git diff --check` PASS.
- Latest-main tracked tree: 507,845,424 B; synchronized PR tree before this documentation checkpoint: 506,900,743 B; net -944,681 B. Compact `data/site-audit.json` is 16,179,318 B; full scoring audit remains transient at `/tmp/site-audit-full.json`.
- State at this checkpoint: local synchronization and QA are complete; push and new exact-head Actions are pending. Keep PR #38 open and do not start Batch 03. After the pushed SHA's Actions run succeeds, record that SHA and run in the existing Notion Batch 02 checkpoint; no previous CI run substitutes for it.

## 2026-10-03 — PR #34 current-main sync and local revalidation (exact-head Actions pending)

- Previous PR #34 branch head `0438379277b2ce69724222c959d9eb6380f0b198`; fetched latest `origin/main` `bdf76120dac725fca0ac955929626c5378648055`. Integrated it by regular merge commit `3d0f1d3a77e5764152beb2b245dccf9dcf180808`. Two documentation conflicts (`PROJECT_HISTORY.md`, `TASKS.md`) were resolved semantically; the five non-conflicting latest-main PR #37 GSC workflow/sidecar/collector/test paths match `origin/main` byte-for-byte.
- Scope remains exactly 49 JP Travel HTML deletions / 1,036,400 B and 49 sitemap URL removals. No other HTML was modified or added. The protected set has 15 current JP Travel WINNER rows plus two protected no-current-row pages (`greece-katerini`, `korea-naju`); all remain on disk and the winners remain in sitemap. Deleted paths intersect current winner rows by 0. Separate HOLD pages are preserved; no additional canary was added.
- JP Travel sitemap delta: 49 removed, 0 added; 46 leaf sitemaps, 18,757 URL entries, 0 duplicates, 0 unknown/noncanonical entries. Current derived inventories and feed contain none of the 49 deleted paths. Broken internal links: 276, unchanged from the latest-main baseline.
- Raw historical GA4/GSC/performance files are byte-identical to latest main. GA4 and GSC collection workflows retain their full `/tmp/ga4-site-audit.json` and `/tmp/gsc-site-audit.json` audit inputs. Keyword Hunter/DataLab paths have no diff against latest main; full Keyword Hunter dry-run inspected 18,981 pages with 0 API calls, 0 DataLab calls, and no persistent state/report writes.
- Local SEO QA: unittest 743 passed; pytest 1,199 passed; SEO QA 0 new criticals / 0 new warnings (767 existing criticals / 420 warnings); launch guard PASS; `git diff --check` PASS. Compact `data/site-audit.json` is 16,224,376 B and matches generated output; full 99,621,796 B audit is transient at `/tmp/site-audit-full.json`.
- Tracked-tree comparison at sync merge commit `3d0f1d3a77e5764152beb2b245dccf9dcf180808`: latest main 508,890,557 B; PR tree 507,598,055 B; net -1,292,502 B. The deleted 49 HTML files total 1,036,400 B. GitHub PR #34 is still open/unmerged at its old remote head until a normal push; exact-head Actions on the final pushed SHA are pending. Notion remains unchanged pending post-merge verification.

## 2026-10-03 — P0 Revenue Evidence Upgrade — GSC opportunity query evidence (live collection complete; PR pending)

- 최신 fetched `origin/main`은 `ffe6c429a80cabca14ff9231af9cb2c86a1a33a6`; 격리 branch `codex/p0-gsc-opportunity-query-evidence-20261003`는 이 SHA에서 시작했다. Current GSC page snapshot은 `2026-09-03..2026-09-30`, generated `2026-10-03T08:34:31Z`이며 full `data/page-performance.json`에서 OPPORTUNITY 34개를 읽어 `data/revenue-opportunities.json`의 `classificationCounts.OPPORTUNITY`와 교차검증했다. Summary artifact 자체는 전체 URL inventory를 싣지 않아 URL source로 오인하지 않는다.
- 새 `scripts/collect_gsc_opportunity_query_snapshot.py`는 현재 opportunity URL별 canonical HTTPS page `equals` filter와 query dimension으로 같은 period를 요청하고 sidecar `data/performance/gsc-opportunity-queries-latest.json`에 저장한다. Page-level `gsc-latest.json` 스키마는 그대로 둔다. Empty query response는 `NO_QUERY_ROWS_RETURNED`; query row가 있어도 `PARTIAL_QUERY_EVIDENCE`이며 완전한 검색어 목록으로 주장하지 않는다. Query row subtotal을 page totals/revenue와 비교하지 않고, API 실패 시 atomic write 이전에 중단해 기존 sidecar를 보존한다. Collector는 YMYL 분류를 하지 않는다.
- `.github/workflows/gsc-collection.yml`에 수동 `opportunity-query` scope를 추가했다. 해당 mode는 sidecar만 검증·commit하며 기존 page measurement refresh와 camping query path는 별도 유지된다. [Google Search Analytics API contract](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)에 맞춰 page filter 시 `aggregationType=auto`를 사용한다.
- 회귀 검증: focused GSC/measurement/workflow tests 44 passed; full unittest 742 passed; full pytest 1,193 passed; existing page-performance measurement validator 19,027 URLs PASS; content launch guard PASS; `git diff --check` PASS; dry-run은 secret 없이 34 URLs와 정확한 GSC period를 계획했고 파일을 쓰지 않았다. HTML/public content/sitemap/manifest/page aggregate/revenue artifacts는 수정하지 않았다.
- Live collection: GitHub Actions GSC Collection run `37112076773` completed SUCCESS using the existing credential path; page-level/camping modes were skipped. The generated sidecar was the only bot-commit file, at branch head `8eb6e71d791beecddba92a335bac650dd3722f13`. It records the same exact GSC period `2026-09-03..2026-09-30`, 34 current opportunity URLs, 12 with returned query rows, 22 with `NO_QUERY_ROWS_RETURNED`, and 110 query rows totaling 393 impressions / 1 click.
- Completeness limitation is material: query rows are partial and may omit privacy-filtered/top-row-limited data. For the same 34 URLs, page-level GSC totals are 571 impressions / 7 clicks; query subtotals do not reconcile and were not treated as complete, as a failure, or as zero demand. No revenue classification was recomputed from query rows.
- URL-level review across all 34: `YMYL_HOLD` 11; `NO_MISMATCH` 2; `INSUFFICIENT_QUERY_EVIDENCE` 21; `ACTIONABLE_CTR` 0. The 11 holds are finance/health/legal-tax/visa/immigration topics. `/util/url-encoder/` had 43 query impressions (including “url encoder online” 13 and “url decoder online” 11); its title, description, and H1 explicitly cover encode/decode. `/game/MBTI/` had 194 query impressions, led by “mbti test free” 22 and “mbti test online free” 14; its independent 16-type quiz is semantically aligned, while mean position 75.18 does not establish a snippet-caused CTR defect. Six other non-YMYL returned-query URLs had only 1–7 query impressions; the remaining no-row pages cannot be judged from missing terms. No page edit was approved.
- AdSense URL revenue remains `NOT_CONNECTED`; GA4 `totalAdRevenue` was not represented as AdSense revenue. GSC query subtotals were not joined to URL-level revenue or used to create values. No HTML/public content/sitemap/manifest/page aggregate/revenue artifacts changed; only the new query-evidence sidecar was generated by the workflow. Revenue remains `NO_CONCLUSION`.
- Initial PR CI: PR #37 exact-head SEO QA run `37112666746` passed all preceding QA steps, Keyword Hunter validation, and unittest, but failed one full-pytest assertion (`test_dry_run_needs_no_secret_and_does_not_write_artifact`). In that QA job, the earlier revenue-generation step regenerated its ephemeral summary to `OPPORTUNITY=0`; the CLI correctly returned `plannedUrls=0`, while the test incorrectly hardcoded the prior snapshot's 34. The uploaded QA artifact showed the ephemeral classification counts; no generated artifact was committed.
- Minimal correction: the dry-run test now supplies its own temporary 2-opportunity inventory and asserts the matching planned count. No production collector/workflow behavior changed. Post-fix verification: focused GSC/measurement/workflow tests 44 passed; unittest 742 passed; full pytest 1,193 passed; `git diff --check` passed.
- Delivery: PR #37 remains open and unmerged. Corrective test/docs commit is to be pushed on the same branch; a fresh exact-head SEO QA is required. The failed run `37112666746` is not completion evidence for the new head.

## 2026-10-03 — PR #34 GA4 refresh sync and final revalidation (superseded by current-main resync)

- Integrated `origin/main` through latest fetched SHA `ffe6c429a80cabca14ff9231af9cb2c86a1a33a6` into existing branch `codex/p0-jp-travel-canary-01` with regular merge commit `9dd23d286a0f250afd3111e8e53afd27bc4f94fd`. The earlier `a0f5a383...` sync remains an ancestor. Across both syncs, six conflicts in derived `data/page-performance.json`, `data/revenue-opportunities.json`, and `reports/revenue-growth-report.md` were resolved by official regeneration from latest-main measurement inputs and the 49-page-pruned tree; the raw GA4/GSC snapshots were taken from main.
- The canary remains exactly 49 JP Travel HTML deletions / 1,036,400 B plus 49 JP Travel sitemap entries. Non-JP or modified HTML diffs: 0. All 17 URLs in Protected / Keep Archive remain on disk and in the sitemap; deletion overlap is 0. Latest revenue data lists 15 current JP Travel WINNER rows; `/greece-katerini.html` and `/korea-naju.html` now have no current URL row and remain protected rather than being treated as zero-value. Five dependency/association HOLD pages remain present.
- Latest GA4 and GSC snapshots and the rest of `data/performance/` match current main byte-for-byte. The refreshed GSC window is 2026-09-03 through 2026-09-30. The 49 candidates have no explicit GA4/GSC rows in the refreshed snapshots; `NO_ROW` remains distinct from zero. All eight latest-main Keyword Hunter state/report paths are byte-identical.
- Re-generated transient full audit `/tmp/site-audit-full.json` (99,621,796 B); its compact output matches `data/site-audit.json` byte-for-byte at 16,224,376 B. The full audit remains transient. Page-performance and page-score inventories contain 18,978 rows and exclude all 49 removed URLs; regenerated cannibalization data has no candidate references.
- At verified HEAD `826c48130bfc0f52027ed93501a0098a99522859`, latest main tracked tree was 508,832,738 B and PR tree 507,538,309 B (net -1,294,429 B). The 49 HTML deletions account for 1,036,400 B; compact `data/site-audit.json` is 16,224,376 B. The documentation-only closeout records this completed checkpoint.
- Local QA after the latest GSC refresh: unittest 743; pytest 1,189; SEO QA 0 new criticals / 0 new warnings (767 existing criticals / 420 warnings); sitemap 46 leaf files / 18,757 URLs / 0 duplicates / 0 unknown URLs; broken internal links 276 (latest main 276). Keyword Hunter dry-run returned 0 API calls / 0 writes and left tracked status plus Keyword Hunter state hashes unchanged. On the committed merge tree, launch guard PASS and `git diff --check` PASS.
- PR #34 remains open, unmerged, and mergeable. The exact-head Actions result on HEAD `826c48130bfc0f52027ed93501a0098a99522859` was run `37112490708`, SUCCESS; the existing Notion checkpoint was updated to `READY_FOR_MAIN_REVIEW`. This note is a documentation-only closeout; the exact current SHA and its Actions evidence are maintained on Notion page 98. The GitHub PR description remains stale after the known API 403; do not retry that update.
- Next action: PR #34 final main review only. Do not merge or begin another locale/canary.

## 2026-10-03 — JP Travel First 50 Canary — pre-resync checkpoint (superseded)

- Rechecked live GitHub `main` at `0156625d002654271046b20b7c874ea328d071d2` after PR #35 merged. Existing branch `codex/p0-jp-travel-canary-01` is synchronized by regular merge commits; the first sync commit `59454da841` incorporated `255e4b543ec9c4d82988a6ad6fa5dc0541ccef4b`, and this checkpoint integrates `0156625...`. One test conflict was resolved by retaining current-main Keyword Hunter policy tests and the PR-specific regression fixtures. Two derived JSON conflicts were resolved by regenerating current artifacts from the latest raw snapshots and full transient site audit.
- Preserved the latest-main PR #35 closure: all three camping experiments remain `INCONCLUSIVE`. Raw GA4 and GSC snapshots are byte-identical to latest main. Missing candidate rows remain `NO_ROW`, not zero.
- The exact canary remains 49 HTML files / 1,036,400 B and 49 JP Travel sitemap entries. Latest revenue inventory has 1,568 protected winners including 17 JP Travel URLs; candidate intersection is 0. The current page-performance and page-score artifacts each contain 18,978 rows and no deleted-candidate row. All 49 source pages had `lang=ko`, self-canonical, and no hreflang; five had an Error 500 title or H1. No inbound HTML link or Japanese-language replacement was found. Root sitemap, feed, sitemap audit, and current derived inventories are clean. A single rejected, invalid-score, unverified Keyword Hunter row retains a stale `closest_url` association; the current-main keyword data is preserved and this row is not an active launch or content dependency.
- Local QA on the latest merged tree: unittest 743; pytest 1,189; SEO QA 0 new criticals / 0 new warnings (767 baseline criticals / 420 warnings); sitemap 46 leaf files / 18,757 entries / 0 duplicates / 0 unknown URLs / 770 unchanged missing-lastmod entries; broken links 276 vs 276 on latest main; Keyword Hunter dry-run 0 API calls / 0 writes; compact `data/site-audit.json` 16,224,376 B and matches a fresh audit. Full scoring audit remains in `/tmp`.
- PR #34 remains open and unmerged. The old exact-head run is stale; only the new Actions run on the final pushed SHA can satisfy the CI gate. Current checkpoint and exact final SHA/run are recorded in Notion page 98. Next action after the gate: PR #34 final main review only; no other locale or canary work.

## 2026-10-02 — P0 Arabic Locale Retire and Site-Audit Size Fix — PR #31 OPEN

- 기준 `origin/main` `83346ac4441b19b1764816c75a099c49ac35c85e` 대비 Arabic `/ae/` 63 HTML, locale 전용 JS 2개, sitemap 1개(총 66 files / 1,209,448 bytes)를 retire했다. Korean/English/Japanese HTML 및 raw GA4/GSC snapshots는 변경하지 않았다.
- Size regression root cause: audit rows decreased from 19,066 to 19,030, but `data/site-audit.json` grew from 16,296,694 B to 100,167,019 B because 16 post-base fields added about 82.9 MB. `visible_text_prefix` alone contributed 73,007,431 B (~72.89%); `internal_link_targets` contributed 3,904,268 B (~3.90%). Minified JSON was already in use.
- Architecture: commit only the 20-field pre-PR page schema; generate the full audit transiently for `quality_audit.py` scoring. Current compact audit is 16,270,166 B. SEO QA writes `/tmp/site-audit-full.json` and passes it to both scoring runs; GA4/GSC retain their full `/tmp` audit flow. Per-field consumers and classifications are recorded in `docs/audits/site-audit-field-consumers.md`; `data/page-performance.json`, `data/page-scores.json`, and `data/revenue-opportunities.json` remain out of scope for a separate retention review.
- Size result: fixed tracked working tree is 508,606,441 B versus 509,975,524 B at base, a net reduction of 1,369,083 B. The compact audit is 83,896,853 B smaller than the bad PR-head artifact. The plan and regression fix are in `docs/superpowers/plans/2026-10-02-site-audit-size-regression-fix.md`.
- Sitemap is 46 leaf files / 18,806 URL entries / duplicate 0 / Arabic 0; RSS is 500 items / Arabic 0. The existing sitemap cleanup also removed 23 duplicate entries. There are no non-Arabic → Arabic static links or Arabic hreflang references; the two existing Korean finance canonical overrides remain unchanged.
- Local QA: unittest 738 passed; pytest 1,178 passed; SEO QA comparison has 0 new criticals and 0 new warnings; full transient quality scoring evaluated 19,027 indexable pages; Keyword Hunter dry-run completed with 0 API calls and no writes; launch guard and `git diff --check` passed; sitemap audit has 0 duplicates and 0 Arabic URLs. Raw GA4/GSC snapshots are byte-identical to base; the only HTML diffs are the 63 authorized `/ae/` deletions. The new PR-head CI result and current commit are maintained in Notion page 96.
- PR #31 remains open and unmerged. Keep Arabic in Active Queue and leave Completed Log and archive unchanged until merge. Do not start JP First 50 or other locale pruning; after merge, JP First 50 Canary remains the next work item.

## 2026-10-02 — PR #31 latest-main sync and local revalidation — current-head CI pending

- Synced regular merge commit `3c6d690baf` from latest fetched `origin/main` `af341dc20cffcb7f85b59bd0483f9bdf58f35374` into `codex/p0-retire-arabic-locale-r2`. Previous PR head: `ef3f80a1de78d70cb35fdcb9d8dcf0f38a3c5a41`. Four merge conflicts were resolved in `TASKS.md`, `data/page-performance.json`, `data/revenue-opportunities.json`, and `reports/revenue-growth-report.md`. Measurement artifacts were regenerated from the refreshed GA4/GSC snapshots against the Arabic-free tree; both raw snapshots and all historical performance snapshots match latest main byte-for-byte.
- Latest-main PR #30 DataLab freshness scripts/tests and associated Keyword Hunter data are preserved. The GA4/GSC collection workflows still pass their full audit through `/tmp/ga4-site-audit.json` and `/tmp/gsc-site-audit.json`; SEO QA uses `/tmp/site-audit-full.json` for scoring and commits only the compact inventory.
- Size against latest main: tracked tree **510,019,139 B** → **508,646,509 B** (net **-1,372,630 B**). The 66 Arabic files total **1,209,448 B**; committed `data/site-audit.json` is **16,270,166 B**, while full scoring audit is transient at `/tmp/site-audit-full.json`.
- Scope: 63 `/ae/` HTML, 2 Arabic-only JS and `ae/sitemap.xml` removed; no other removed path and no non-Arabic HTML diff. Root sitemap/feed/current derived inventories contain no Arabic URL. Raw historical GA4/GSC data is retained.
- Local QA on the merged tree: unittest **741 passed**; pytest **1,181 passed**; SEO QA **0 new criticals / 0 new warnings** (767 current criticals / 424 warnings); full scoring **19,027** indexable pages; sitemap **46 leaf / 18,806 URLs / 0 duplicates / 0 Arabic**; broken internal-link failures **276** versus latest main's 278; Keyword Hunter dry-run **0 API calls / 0 writes** with unchanged tracked worktree; launch guard PASS. Final `git diff --check` on the updated PR diff passed.
- Status: branch is locally synced and passing full QA, but PR #31 remains open/unmerged and current-head GitHub Actions is pending. After the final doc commit and normal push, only that exact PR-head CI success can set the Notion checkpoint to `READY_FOR_MAIN_REVIEW`. Keep Arabic in Active Queue until PR merge; do not start JP First 50 or other locale pruning.

## 2026-09-22 — P0 Support — CI Baseline GA4 Contract Repair

- PR #1의 SEO QA run `35706259953`은 `Run unittest regression suite`에서 694 tests, 2 failures / 3 errors로 실패했다. affected five cases는 PR #1 diff에 없는 main 기존 페이지와 legacy GA4 batch contract였으며, main `11f3d74ad4a1586f0f6b034e2fb4f6d737ccc622`에서 재현했다.
- Ukraine, Togo, MBTI의 기대 JSON-LD는 유효하고 canonical/date 기준을 만족하지만 GA4 marker 앞에 있어 old helpers의 marker-after positional lookup이 실패했다. MarbleFlick은 dedicated page contract와 PROJECT_HISTORY main closure가 `/game/` breadcrumb를 정의하는데 sixth-hundred manifest가 self-link를 요구했다. English game hub는 dedicated inventory contract가 25개 게임 카드, 검색/카테고리 탐색 및 반응형 grid를 정의하는데 old batch test는 literal `Related`와 `max-width:100%`를 요구했다. 다섯 건 모두 `STALE_TEST_CONTRACT`로 확정했으며 user-facing HTML은 수정하지 않았다.
- `tests/schema_contract_helpers.py`를 추가해 페이지 내 JSON-LD 위치와 무관하게 valid expected-type payload를 파싱하고 canonical URL과 `dateModified >= 2026-08-11`을 검증한다. 기존 marker exactly-once, expected type, trust category, responsive constraint, hub link, GA4/AdSense IDs 계약은 유지했다. MarbleFlick hub expectation은 `/game/`로 수정했고 game hub는 검색 input, category control, game-card link, flex-wrap/auto-fit responsive grid를 검증한다.
- Exact five tests 통과; MarbleFlick state/page/RSS 및 game hub inventory tests 8 passed; full unittest 694 passed; full pytest 1,006 passed; `git diff --check` 통과. No page/content/production change.
- 최종 SEO QA run `35712200413`은 SUCCESS (full unittest 694 passed, full pytest 1,006 passed)였고 PR #2는 squash merge됐다. main merge commit은 `16c88b0e426c8283f54c757b7721b225a93c49cb`이다. PR #1은 이 main 위에 rebase 후 head `3bad46fd82cf94a43ae1f7ac07da2e7b9afdecea`로 갱신했으며 revalidation SEO QA run `35714221956`도 SUCCESS였다.

## 2026-09-22 — P0 Revenue Growth #02 — CI guard false positive follow-up

- Draft PR #1 head `10e4fc3a28b3dd93a5c98c0ca052da14569e81ec` failed SEO QA run `35703819990` at `Guard automated content launch changes` with `MONETIZATION_OR_ANALYTICS_CHANGED`. Earlier deterministic audit, quality, Naver, opportunity, measurement validation, and growth artifact steps passed.
- Root cause: the existing path regex treated `.github/workflows/ga4-collection.yml` as a GA4 runtime asset based on the `ga4` filename component.
- Added a single exact-path exception for `.github/workflows/ga4-collection.yml`; the GSC workflow is not allowlisted because this PR does not change it. Kept the generic monetization/analytics path guard intact.
- Added regression coverage that allows only the exact GA4 collection workflow, rejects a similarly named alternate extension, continues rejecting `assets/js/ga4.js`, and rejects AdSense/ad-loader runtime assets. Existing protected experiment/winner coverage remains active; existing measurement workflow tests still require both GA4 and GSC workflows to pass the GSC snapshot path.
- Full local `pytest -q`: 1,005 passed, 5 failed in unrelated GA4 page-batch contract tests (SEO/schema/hub assertions on existing content files). Targeted guard + measurement workflow suite: 13 passed. `git diff --check` and full diff-based local guard remain to be verified after commit.
- Status: same branch/PR #1 only; not merged. Await actual GitHub Actions result for the new head before considering merge readiness.

## 2026-09-22 — P0 Revenue Growth #02 — GA4 재생성에서 GSC 신호 보존

- 최신 live main `9f7fb892b04cab4d408aa49942abb8a284c7a9a5`의 measurement artifact를 확인했다. GA4 snapshot은 2026-08-25..2026-09-21, 2,960 rows; GSC snapshot은 2026-08-22..2026-09-18, 109 URL rows / generatedAt `2026-09-21T08:13:09+00:00`였다.
- 기존 `data/page-performance.json`에서는 Google `VERIFIED` URL이 0/19,064이고 전부 `NOT_CONNECTED`였지만, 별도 GSC snapshot은 실제 repo URL 105개에서 `VERIFIED`였다. 원인은 `.github/workflows/ga4-collection.yml` 재생성 명령이 GSC workflow와 달리 `--gsc-snapshot` 인자를 누락한 것.
- 동일 원본으로 `/private/tmp` 출력만 재생성해 GA4/GSC 데이터가 각각 보존되고 counts가 WINNER 1,466 / OPPORTUNITY 37 / EXPERIMENT 0 / INSUFFICIENT_DATA 17,561임을 확인했다. 체크인된 원본 산출물은 덮어쓰지 않았다.
- 최대 5개 search opportunity를 비교했다. 최상단 Singapore는 200 impressions / 0 clicks / position 23.8 / GA4 3 views로 score 42.21이지만, 사이트 목표를 움직일 절대 upside 증거와 현행 query mix가 부족해 기존 blocked #01을 자동 재개하지 않았다. 다음 수치 후보들은 9 impressions 이하 또는 2026-09-20 직전 변경 페이지여서 재수정하지 않았다.
- `.github/workflows/ga4-collection.yml`에 latest GSC snapshot 인자를 추가하고 두 measurement workflow의 입력 전달을 고정하는 테스트를 추가했다. HTML/콘텐츠, protected pages, credentials, ad placement는 변경하지 않았다.
- 상태: 격리 branch `codex/p0-revenue-growth-02`; main/production 미변경. Focused regression, artifact validator, revenue pipeline, diff 확인 후 PR/review 및 main 반영을 대기한다. 수익 직접 증가나 인과효과는 주장하지 않는다.
- 조사 중 live main이 GSC workflow refresh commit `11f3d74ad4a1586f0f6b034e2fb4f6d737ccc622`로 갱신됐다. 최신 GSC는 2026-08-23..2026-09-19, 110 rows / 106 matched URLs이고 GSC 재생성 직후 분류는 WINNER 1,466 / OPPORTUNITY 38 / EXPERIMENT 0 / INSUFFICIENT_DATA 17,560이다. 이 새 상태도 temporary output으로 validator 통과를 확인했다. 다음 GA4-only refresh에서 재발하지 않도록 이번 변경을 최신 main 위에 rebase했다.

## 2026-09-21 — 08 · Date Difference Calculator — MAIN CLOSURE

- Previous main `aab3343cb8`에 승인 Core `01bb82270b`, RSS `a4674597d5`, Final UI correction `2a561dee37`을 non-force로 반영했다. 현재 main은 `2a561dee37`이며 force push는 사용하지 않았다. Closure commit은 이 section을 포함한 closure commit이다.
- Date Difference를 date-only 전문 calculator로 유지했다. `Date.UTC` whole-day math, time-of-day/timezone/countdown/add-subtract 미추가, elapsed/signed/selected range, weeks, calendar Y/M/D, weekdays/weekends를 확인했다. Include-end OFF/ON semantics, reverse sign/absolute preservation, leap/non-leap/DST, Jan 31→Mar 1의 `29일 / 0년 1개월 1일` clamp convention을 보존했다.
- Weekdays는 Mon–Fri estimate이며 public holidays를 제외하지 않는다. legal/court/tax/contractual deadline 공식 계산을 보장하지 않는다는 문구와 `/util/time-diff/`, `/util/age/`, `/util/unix-timestamp/`, `/util/` cluster links를 유지했다.
- Partial Swap은 입력을 삭제하지 않고 위치만 교환하며, Today partial은 premature error 없이 neutral state를 유지한다. 새 계산/invalid/Reset에서 stale Copy status와 payload를 지운다. UI runtime에서 full/partial Swap, Today, Copy, Reset을 확인했다.
- WebApplication exactly 1, FAQPage 0, title/H1/canonical, `dateModified=2026-09-21`, hub/sitemap/RSS freshness, GA4/AdSense/privacy 계약을 확인했다. Tests `13 passed`, Pages run `35547351347` success, 실제 Production served HTML과 runtime 기능은 최신이다.
- Mobile 390px은 viewport capability 부재로 `MOBILE_390_NOT_VERIFIED`, Google `SEARCH_CONSOLE_NOT_VERIFIED`, Naver `NAVER_INDEX_NOT_CONFIRMED / SECONDARY`, metadata `METADATA_NOT_IN_CURRENT_CONTRACT`다. Notion은 `NOTION_CLOSURE_PENDING_CHATGPT`이며 duplicate archive는 수정하지 않았다. 14/28/56일 measurement와 add/subtract feature gate는 후속이다.

## 2026-09-21 — 08 · Date Difference Calculator — Final Review Correction

- partial Swap이 한쪽 날짜만 입력된 상태에서 `resetAll()`을 호출해 사용자 값을 지우던 문제를 수정했다. Start-only와 End-only는 값을 반대 필드로 보존하고, 양쪽 날짜가 있으면 즉시 재계산하며, 둘 다 비어 있으면 그대로 유지한다.
- `clearCalculationState()`와 `recalculateIfReady()`를 분리해 Today shortcut이 상대 날짜가 없을 때 premature validation error를 띄우지 않도록 했다. 명시적 Calculate의 missing/invalid input error contract는 유지한다.
- 새 계산 진입 시 copy status를 비우고, invalid calculation과 Reset에서도 `lastText`/result/error/copy state를 정리한다. UI handler harness를 추가해 13 tests passed를 확인했다.
- title, schema, `dateModified`, RSS `a4674597d5`, hub, sitemap, date-only math, calendar clamp와 다른 tool scope는 변경하지 않았다. 상태는 final review pending이며 main merge와 09번은 수행하지 않는다.

## 2026-09-21 — 08 · Date Difference Calculator — REVIEW BRANCH

### 요청·보호
- `/util/date-difference/`만 처리한다. 09번, main merge, Pages 배포는 이번 실행 범위 밖이다.
- date-only 계산은 `Date.UTC(year, month, day)`와 UTC 날짜 iteration을 사용한다. time-of-day, timezone selector, countdown, hours/minutes/seconds, add/subtract date mode는 추가하지 않는다.
- Cycle 2 상태는 `SCALE-CANARY / DATE-ONLY TASK COMPLETION / INDEXED_LOW_VISIBILITY`이며 최신 GSC는 197 impressions / 0 clicks / 0% CTR / position 58.18이다. Naver는 `NAVER_INDEX_NOT_CONFIRMED / TOP30_ONLY_NOT_AVAILABLE`로 유지한다.

### 구현 계약
- Start/End, Start = Today, End = Today, Swap dates, `Include end date in range counts`, Calculate, Copy result, Reset을 제공한다. Include-end 기본값은 OFF다.
- Direction, signed/absolute elapsed days, selected range, elapsed weeks+days, calendar years/months/days, Weekdays (Mon–Fri), Weekend days를 표시한다. Weekdays는 public holidays를 제외하지 않는 단순 추정임을 명시한다.
- Calendar span은 고정 30일 나눗셈이 아니라 whole years → whole months → remaining UTC days 순서와 month-end clamp convention을 사용한다. Jan 1→Jan 3의 elapsed 2 / inclusive 3 semantics와 legal/tax/court/contractual deadline 비보장 문구를 visible하게 둔다.
- FAQ는 visible only, JSON-LD는 WebApplication exactly 1 / FAQPage 0, `dateModified=2026-09-21`이다. `/util/time-diff/`, `/util/age/`, `/util/unix-timestamp/`, `/util/` 역할 링크를 유지하며 다른 date tool은 수정하지 않는다.

### 보호·검증 상태
- GA4 `G-QP5Q67GE5B`, AdSense `ca-pub-8830524482034754`, browser-side privacy 문구를 유지하고 raw date telemetry, fetch/XHR, localStorage/sessionStorage, manual ad unit, holiday dataset을 추가하지 않는다.
- 상태: review branch / `READY_FOR_REVIEW`. Core/RSS commit과 remote branch push 전이다. Pages, Production, runtime/mobile은 아직 검증하지 않았다. Notion write는 하지 않으며 `NOT_UPDATED_PENDING_REVIEW`다.

## 2026-09-21 — 07 · Aspect Ratio Calculator — MAIN CLOSURE

- 승인 final chain을 최신 main `9e31ecf7c3161c78eb4a7194585d4a83543b848d` 위에 non-force로 반영했다. Integrated Core `bfca0d1a8d`, Final UI correction `881ebbc36d`, RSS `ec21c5b3c1`, 현재 main `ec21c5b3c1`이며 closure 문서 commit은 이 section을 포함한 closure commit이다. force push는 사용하지 않았다.
- Mode A는 `1920×1080 → 16:9 / 1.7778 / 1920×1080 / Landscape`로 실제 표시·복사되며, `1080×1350 → 4:5`, `3440×1440 → exact 43:18`을 확인했다. Mode B는 `16:9 + width 1280 → 1280×720`, `9:16 + height 1920 → 1080×1920`, `4:5 + width 1080 → 1080×1350`이다. 8개 preset, swap, deterministic Reset, copy, preview를 유지했다.
- `targetWidth`/`targetHeight`와 silent width precedence는 없다. WebApplication exactly 1, FAQPage 0, canonical/H1 exactly 1, `dateModified=2026-09-21`, visible Reviewed date, GA4 `G-QP5Q67GE5B`, AdSense `ca-pub-8830524482034754`, browser-side privacy 계약을 확인했다.
- util hub description, Aspect Ratio sitemap lastmod `2026-09-21`, RSS title/description/canonical/pubDate `Mon, 21 Sep 2026 00:00:00 +0000`를 확인했다. metadata는 `METADATA_NOT_IN_CURRENT_CONTRACT`다.
- Tests `9 passed`, `git diff --check` passed. GitHub Pages run `35545871611` success, 실제 Production served HTML 최신 확인, runtime Mode A/Mode B/Reset/Copy 기능 검증 success. 390px mobile은 viewport capability 부재로 `RUNTIME_UI_NOT_VERIFIED`다. Google `SEARCH_CONSOLE_NOT_VERIFIED`, Naver `NAVER_INDEX_NOT_CONFIRMED / SECONDARY`, 14/28/56일 measurement는 후속이다. Notion은 `NOTION_CLOSURE_PENDING_CHATGPT`이며 duplicate archive는 수정하지 않았다.

## 2026-09-21 — 07 · Aspect Ratio Calculator — Final Review Correction

- 최신 main의 Keyword Hunter append history를 보존한 새 final-review branch에서 07 core를 재적용했다. Mode A가 축약 ratio `16 × 9`를 실제 입력 dimensions로 잘못 재사용하던 표시·복사 버그를 `ratioWidth`/`ratioHeight`와 `outputWidth`/`outputHeight` 분리 모델로 수정했다.
- Reset이 dimensions mode, 기본값 1920×1080 및 16:9, known width 1280, placeholder/error/copy/preview/orientation, preset selection을 모두 deterministic initial state로 복원하도록 수정했다. 2026-09-21 freshness를 WebApplication, Reviewed 문구, sitemap에 반영했다.
- Mode A UI wiring과 Reset state regression을 추가하고 기존 math/property, exact 43:18, silent precedence, schema/privacy/ads 계약을 보호한다. 상태는 final review pending이며 main merge, Pages, production, Notion closure는 수행하지 않는다.

## 2026-09-20 — 07 · Aspect Ratio Calculator — REVIEW BRANCH

### 요청·보호
- `/util/aspect-ratio/`만 처리했다. 08번과 다른 utility page, main merge, Cloudflare Pages production deployment는 이번 실행에서 수행하지 않는다.
- 기존 GA4 `G-QP5Q67GE5B`, AdSense `ca-pub-8830524482034754`, canonical과 기존 관련 링크 범위를 보존했다. 수동 광고 단위와 별도 percentage-calculator primary link는 추가하지 않았다.

### 변경
- Find ratio from dimensions 모드에서 양의 정수 width/height를 gcd로 정확히 축약하고 decimal ratio, orientation, preview를 제공한다.
- Resize by ratio 모드에서 양의 유한 ratio, known-side, 양의 정수 dimension을 받아 missing dimension을 nearest whole pixel로 계산한다. 기존 ambiguous `targetWidth`/`targetHeight`와 silent target-width precedence를 제거했다.
- 16:9, 9:16, 4:3, 3:2, 1:1, 4:5, 16:10, 21:9 preset을 동일 계산 엔진으로 연결하고 swap/reset/copy/live preview와 visible FAQ를 제공한다. 3440×1440은 21:9가 아닌 exact 43:18로 표시한다.
- FAQPage JSON-LD는 0개, WebApplication JSON-LD는 1개, `dateModified=2026-09-20`으로 유지했다. privacy 문구는 browser-side calculation과 raw input telemetry 미수집을 명시하며 fetch/XHR/localStorage/sessionStorage를 사용하지 않는다.
- util hub 카드, target sitemap lastmod, RSS generator 경로와 Aspect Ratio focused tests를 갱신했다. RSS는 core commit 이후 별도 commit으로 생성한다.

### 검증·상태
- `tests/test_ten_new_english_tools.py tests/test_aspect_ratio_calculator.py`: 7 passed. `git diff --check`: passed.
- GSC snapshot은 323 clicks / 0.00% CTR / 62.22 average position으로 유지하며, 이번 구현은 opportunity evidence의 저위험 utility 개선이다.
- Runtime UI/mobile, production served HTML, Cloudflare Pages deployment, Google/Naver inspection은 아직 검증하지 않았다. 각각 `RUNTIME_UI_NOT_VERIFIED`, `PRODUCTION_PARITY_NOT_VERIFIED`, `PAGES_DEPLOYMENT_NOT_RUN`, `SEARCH_CONSOLE_NOT_VERIFIED`, `NAVER_INDEX_NOT_CONFIRMED`로 유지한다.
- 상태: review branch / `READY_FOR_REVIEW`. Notion은 승인·main 반영 전이므로 `NOT_UPDATED_PENDING_REVIEW`다. 14/28/56일 measurement는 배포 후 후속이다.

## 2026-09-20 — 06 · Japanese Singapore Entry Guide — MAIN CLOSURE

- Base `c34d01b313` 이후 unrelated Keyword Hunter automation main `cb504962cb`를 흡수한 최신 main 위에 승인 Core `6a229cbc33`와 RSS `b84c73ef1f`를 cherry-pick했다. 통합 commit은 각각 `8951582161`과 `1c846e5ae9`이며, non-force로 `origin/main`에 반영했다.
- Primary role을 generic visa catalog에서 일본인 입국 준비 guide로 전환했다. title/H1, 일본 국적자 관광·상용 비자 불필요, 여권 6개월, SG Arrival Card, e-Pass, Work Pass 구분을 정합화하고 고정 90일 promise는 추가하지 않았다.
- SG Arrival Card 대상, 도착일 포함 3일 이내, 무료 ICA e-Service/MyICA, transit 예외, acknowledgement email, DE番号, Update SGAC, SGAC와 e-Pass의 차이를 반영했다. Singapore Embassy in Tokyo, ICA, MOM 공식 링크를 유지·보강했다.
- `ja` self만 유지하고 `ko`/`x-default`를 제거했다. FAQPage JSON-LD는 제거하고 WebPage 1개, canonical, `dateModified=2026-09-20`, `inLanguage=ja-JP`를 유지했다. 한국어 페이지는 수정하지 않았다.
- 25개 Japanese Singapore city inbound link contract, sitemap target lastmod, RSS item parity를 확인했다. metadata target row는 없어 `METADATA_NOT_IN_CURRENT_CONTRACT`로 유지했다.
- Core focused tests `6 passed`, `git diff --check` 통과. Pages run `35508797105` success, 실제 Production served HTML에서 새 title/H1, SGAC block, Tokyo Embassy source, `ja` only, FAQPage 부재를 확인했다.
- Runtime/mobile은 `RUNTIME_UI_NOT_VERIFIED`, Google은 `NO_SUBMISSION / SEARCH_CONSOLE_NOT_VERIFIED`, Naver는 `NAVER_NOT_PRIMARY / INDEX_NOT_CONFIRMED`다. 14/28/56일 measurement와 dedicated SGAC page gate를 후속 수행한다. Notion closure는 `NOTION_CLOSURE_PENDING_CHATGPT`다.

## 2026-09-20 — 05 · Final Review Correction

- `/game/MBTI/`의 hidden legacy FAQ DOM과 `.legacy-faq` CSS를 제거하고, 새 visible FAQ 하나와 JSON-LD question/answer parity를 유지했다.
- 하단 freshness를 `Reviewed on September 20, 2026`으로 정합화했다.
- 16개 type 모두에 overview, strengths to explore, possible blind spots, reflection prompt를 명시적으로 제공하고 legacy categorical descriptions를 제거했다.
- `All 16 types at a glance`를 16개 neutral one-line overview로 확장했다. 새 type별 URL은 만들지 않았다.
- 관련 focused tests 14 passed, `git diff --check` passed. 상태는 main merge 전 `pending final review`다.

## 2026-09-20 — 05 · Quick 16-Type Personality Quiz — MAIN CLOSURE

- 승인된 core `35a3772098`, RSS `57b648b505`, correction `d047f3e8a3`를 non-force fast-forward로 `origin/main`에 반영했다. Pages deployment run `35507590941`는 success였고 remote main에서 승인 SHA의 ancestor 관계를 확인했다.
- 20문항/축별 5문항 deterministic majority scoring, 3:2 close semantics, independent personality quiz rebrand, 공식 MBTI® 비제휴 disclosure, 16개 dedicated profiles, neutral all-16 overview, FAQ visible/schema parity, hidden legacy FAQ 제거, browser-side answer privacy, AdSense disabled를 확인했다.
- `/game/` navigation, `/game/MBTI/` sitemap membership, RSS item parity를 유지했다. localized pages와 multilingual hreflang은 수정하지 않았다.
- 관련 tests 14 passed, `git diff --check` passed. 실제 Production served HTML에서 새 title/H1, 20문항, trust disclosure, `Reviewed on September 20, 2026`, canonical, GA4, AdSense disabled를 확인했다.
- Runtime UI/mobile 자동 검증은 `RUNTIME_UI_NOT_VERIFIED`, Google Search Console은 `SEARCH_CONSOLE_NOT_VERIFIED`, Naver는 `NAVER_INDEX_NOT_CONFIRMED`다. 28/56일 measurement를 후속 수행한다.

## 2026-09-20 — 05 · Quick 16-Type Personality Quiz — REVIEW BRANCH

### 요청
- `/game/MBTI/` 한 페이지에서 4문항/축의 deterministic tie-default bias를 제거하고, 독립적인 20문항 personality quiz로 신뢰·결과 깊이·구조화 데이터·navigation을 보강한다.

### 변경
- 기존 16개 original scenario에 축별 1개씩 자체 작성 문항을 추가해 20문항/축별 5문항으로 만들고, `>` majority scoring과 `Close result` 3:2 표시를 적용했다. random tie-break와 hidden weighting은 사용하지 않는다.
- title/H1/OG/Twitter와 결과 문구를 `Quick 16-Type Personality Quiz`로 rebrand하고, 공식 MBTI® assessment가 아니며 The Myers-Briggs Company 또는 Myers & Briggs Foundation과 제휴하지 않는다는 disclosure와 trademark acknowledgement를 추가했다.
- 결과에 four-letter quiz result, 축별 counts, close marker, preference explanation, strengths, possible blind spots, reflection prompt를 추가했다. career/hiring/clinical/compatibility/intelligence inference는 추가하지 않았다.
- visible FAQ 7개와 FAQPage를 question+answer pair로 정합화하고 WebApplication 중복을 제거했다. `Other Games`는 `/game/`으로 이동하며 game hub card도 새 명칭과 20문항 promise로 맞췄다.
- AdSense는 disabled 상태를 유지하고 answers/result를 telemetry로 보내지 않는다. localized MBTI pages는 inventory-only로 두고 bulk rewrite/hreflang은 하지 않았다.

### 검증
- `tests/test_quick_mbti_zero_click.py`, `tests/test_gsc_opportunity_batch_06.py`, `tests/test_mbti_game_page.py`, `tests/test_quick_personality_quiz.py`: 13 passed.
- `git diff --check`: passed.
- Production/runtime/mobile과 RSS는 core commit 후 별도 검증한다. 아직 main merge·Notion closure·Production verified가 아니다.

## 2026-09-20 — 04 · Reading Time Calculator product-depth upgrade — REVIEW BRANCH

### 요청
- `/util/reading-time/` 하나의 canonical에서 text, word count, target duration을 지원하고 reading/read-aloud 계산을 제공한다.

### 변경
- Reading Time & Speaking Time Calculator로 확장하고 Paste text, Enter word count, Target duration 3개 입력 모드를 추가했다.
- silent 238 WPM, read-aloud 183 WPM을 Brysbaert (2019) 연구 reference로 표시하고 custom WPM, reverse word target, 500/1,000/1,500/2,000단어 예제를 제공했다.
- Unicode-aware word counting, invalid/zero handling, FAQ visible/schema parity, local calculation privacy wording, Word Counter/All Tools 링크를 반영했다. TTS 링크는 현재 기능·주장 정합성이 확인되지 않아 이 페이지에서 제외했으며 TTS 페이지 자체는 범위 밖으로 유지했다.
- util hub card와 reading-time sitemap lastmod를 `2026-09-20`으로 정합화했다. `data/content-metadata.json`은 현재 contract row가 없어 변경하지 않았다.

### 보호·미수정
- canonical, GA4 `G-QP5Q67GE5B`, AdSense `ca-pub-8830524482034754`, 별도 speaking URL는 유지·미생성했다.
- 다른 utility page, 다른 sitemap entry, manual ad unit, feed.xml은 수정하지 않았다.

### 검증
- `tests/test_reading_time_calculator.py`, `tests/test_ten_new_english_tools.py`: final correction run 8 passed.
- `git diff --check`: passed after final correction and RSS generation.
- Production parity pre-check 결과 live는 구현 전 구버전이므로 `PRODUCTION_PARITY_NOT_VERIFIED`; review branch push 후 Pages 배포 확인이 필요하다.
- 브라우저 UI/mobile 390px runtime 검증은 현재 browser policy로 수행하지 못해 `RUNTIME_UI_NOT_VERIFIED`로 기록한다.
- `scripts/generate_recent_rss.py` 실행 결과 Reading Time 단독 신규 item과 500-entry limit에 따른 Oracle tail eviction만 발생했다. RSS commit `a31048a13a`로 분리했다.
- 상태: review branch / pending final review. Production parity와 runtime browser QA는 미검증이다.

## 2026-09-20 — 04 · Reading Time Calculator — MAIN CLOSURE

- 최종 구현 `497fd527fa7f09c7e19a590078243fa23f92a29a`를 non-force fast-forward로 main에 반영했다. Core correction `4d8bb11fca`, RSS `a31048a13a`를 보존했다.
- Pages `pages build and deployment` run `35497086379`: success. 실제 served HTML에서 title/H1, 3 modes, 238/183 references, FAQ, canonical, GA4, AdSense, 2026-09-20 freshness를 확인했다.
- Production runtime: text `one two three` → 3 words, word count 1,000 → 4:12/5:28, empty validation, zero accepted, target 5 minutes × 183 → 915 words를 확인했다. Mobile 390px에서 `scrollWidth=375`로 horizontal overflow가 없었다.
- `tests/test_ten_new_english_tools.py tests/test_reading_time_calculator.py`: 8 passed. `git diff --check`: passed. Search Console과 Naver inspection은 확인하지 않아 각각 `SEARCH_CONSOLE_NOT_VERIFIED`, `NAVER_INDEX_NOT_CONFIRMED`로 유지한다.
- TTS 링크는 별도 페이지의 claim/function mismatch 검토 대상이라 reading-time 페이지에서 제외했으며 TTS 페이지는 수정하지 않았다. Metadata는 `METADATA_NOT_IN_CURRENT_CONTRACT`. 14/28/56일 measurement를 진행한다.

## 2026-09-20 — 03 · 토고 비자 freshness/discovery repair — MAIN CLOSURE

### 요청
- `/kor/report/visa/togo.html`만 Cycle 2 명세에 맞춰 보강하고 최종 검수 후 main에 반영한다.

### 변경
- 한국 일반여권의 visa-required 선답과 Togo Voyage 사전 온라인 신청·승인 필요성을 명시하고, 출처별 안내를 홈페이지·alert 5일, Procedures 6일, About 6영업일, FAQ 7영업일로 분리하면서 7영업일 이상 여유와 신청 당일 live 재확인을 권고했다.
- 현재 홈페이지의 express visa·visa on arrival 중단 상태를 FAQ/About의 legacy 설명보다 우선하고, 긴급 건은 공식 Contact를 확인하도록 수정했다. Visa Assistant부터 승인·immigration formalities·bordereau/QR·동일 여권·항공사 확인까지 출발 체크리스트를 유지했으며 황열 요건은 조건부로 보정했다.
- title/meta/OG, head WebPage와 FAQPage를 정합화하고 bottom duplicate WebPage를 제거했다. Togo hub 카드, Togo sitemap `lastmod=2026-09-20`, 생성기 실행 RSS를 갱신했다.

### 보호·미수정
- canonical, GA4 `G-QP5Q67GE5B`, AdSense `ca-pub-8830524482034754`, CFA 비용표와 여권 유효기간 문구를 유지했다.
- `kor/report/travel/togo-*` 19개 cluster, 다른 국가 visa 페이지, 다른 sitemap entry는 수정하지 않았다.
- `data/content-metadata.json`의 비자 YMYL 계약은 전역 변경하지 않고 `FOLLOW_UP_REQUIRED`로 기록했다.

### 검증
- `tests/test_priority_africa_visa_pages.py`, `tests/test_gsc_opportunity_batch_03.py`: 7 passed.
- `git diff --check`: 통과.
- RSS는 `scripts/generate_recent_rss.py`로 생성했다. clean base `65bc8a4c14`에서도 714 additions/696 deletions의 broad drift가 재현되어 `PRE_EXISTING_FEED_DRIFT`로 분류했고, RSS commit `339aa6638b`로 분리했다.
- core `c51f156240`와 RSS `339aa6638b`를 `339aa6638bfc8bd7c7b4bccfbfbb7ec2a6723c23`까지 non-force fast-forward로 main에 반영했다. `origin/main`에서 두 commit의 ancestor 관계를 확인했다.
- Pages `pages build and deployment` run `35495289653`: success. 실제 served HTML에서 새 title, 2026-09-20, arrival/express suspension, Contact, timing, 조건부 yellow fever, canonical, GA4, AdSense, WebPage 1개, FAQPage 1개를 확인했다.
- Search Console URL Inspection은 아직 확인하지 않았으며, 14/28/56일 측정은 배포 후 수행한다.
- 상태: main closure. Togo travel cluster 19개는 미수정이며 content-metadata 비자 YMYL 계약은 `FOLLOW_UP_REQUIRED`다.

## 2026-09-20 — 02 · 우크라이나 비자 safety/discovery parity repair

### 요청
- 최신 `origin/main` 기준으로 `/kor/report/visa/ukraine.html`만 보수적으로 보강하고, 최종 검증 후 `main`에 fast-forward 반영한다.

### 변경
- landing에 대한민국 해외안전여행의 현행 여행금지 국가·지역 현황(standing-state)과 2026-07-09 정기조정 공지(dated notice)를 구분해 연결했다.
- 예외적 여권사용허가가 필요한 경우 외교부 현행 구비서류·신청요건을 확인하고 재외동포365민원포털에서 신청하도록 안내했으며, 우크라이나 관련 문의처 `boho@mofa.go.kr`와 신청·문의가 허가를 보장하지 않는다는 점을 명시했다.
- `dateModified`·화면 최근 확인일을 2026-09-20으로 갱신하고 body 하단 중복 WebPage JSON-LD를 제거했다.
- 비자 허브의 Ukraine 카드만 90일 무비자·전역 여행금지 의미로 수정하고 Ukraine sitemap entry만 2026-09-20으로 갱신했다.

### 보호·미수정
- title/meta/H1 핵심 의미, canonical, GA4, AdSense, 여행금지 경고는 유지했다.
- `kor/report/travel/ukraine-*` cluster와 다른 국가 visa 카드는 수정하지 않았다.

### 검증
- `tests/test_ukraine_visa_page.py`, `tests/test_ukraine_zero_click_ctr.py`, `tests/test_gsc_opportunity_batch_02.py` 통과.
- Production 및 Search Console은 배포 후 확인한다.
- Search Console URL Inspection은 배포 후 수행한다.
- 관련 테스트는 12 passed였고 Ukraine travel cluster는 수정하지 않았다.
- `codex/visa-02-ukraine-merge-20260920`에서 최종 검증 완료.

## 2026-09-09 — 미국주식 dividendYield 단위 및 validation 수정

### 요청
- yfinance 배당수익률 단위의 근본 원인을 고치고 AAPL 포함 배당·무배당 종목을 검증한다.

### 조사
- private source로 이전된 구형 `scripts/gen_us_stocks.py`가 이미 퍼센트 단위인 `dividendYield`에 다시 `×100`을 적용했다. 그 결과 공개된 `kor/report/stock/us/` 페이지에서 AAPL 36%, KO 261%, JNJ 234% 등이 노출됐다.
- 현행 `kor/stockwiki/data/stocks/`는 2026-05-29 수정 이후 퍼센트 단위로 정상 저장돼 있었다.

### 변경
- `scripts/us_stock_dividend_yield.py`에 yfinance 퍼센트 단위 정규화, 0~20% 범위 validation, 반복 실행 안전한 legacy HTML 교정 로직을 추가했다.
- 구형 미국주식 60페이지의 값을 공통 로직으로 교정하고 단위 표식을 추가했다. 범위 밖·비수치 값은 `N/A`로 처리한다.

### 검증
- `tests/test_us_stock_dividend_yield.py`: 22 passed. AAPL 0.36%, KO 2.61%, JNJ 2.34%, NVDA 0.02%, TSLA·AMZN N/A 및 StockWiki AAPL/MSFT/NVDA/TSLA를 확인했다.

### 남은 문제
- private `emfls-source` 생성기에도 같은 규칙(`trailingAnnualDividendYield`를 퍼센트 단위 그대로 저장, 0~20% 검증)을 적용해야 한다. 공개 저장소의 CI 회귀 테스트는 잘못 생성된 결과를 차단한다.

## 2026-09-09 — Codex 저토큰 프로젝트 운영체계 구축

### 요청
- 긴 프롬프트 없이 저장소 문서만 읽고 최고 우선순위 작업 1개를 이어서 수행할 수 있는 운영체계를 만든다.

### 조사
- 기존 기록은 `PROJECT_HISTORY.md`, 작업 규칙·큐·전략 문서는 없었다.
- 주요 경로: 정적 사이트 `index.html`·`kor/`, 주식 소스 `kor/stockwiki/src/`, 주식 JSON `kor/stockwiki/data/stocks/`, 도구 `util/`, 게임 `game/`, 자동화 `scripts/`, CI `.github/workflows/seo-qa.yml`.
- `data/finance-content-audit.json`에서 비상장 독립회사인 `Amazon Web Services (AMZ)` 페이지 흔적을 확인했다. 주식 화면은 `kor/stockwiki/src/pages/stocks/[ticker].astro`에서 `dividends.yield`를 백분율로 직접 표시한다.

### 변경
- `AGENTS.md`, `TASKS.md`, `SEO_STRATEGY.md`를 추가하고 기존 `PROJECT_HISTORY.md`를 운영 기록으로 유지했다.
- 주식 데이터 오류 4건을 P1, 공통 validation과 정적 QA를 P2로 등록했다. 완료된 홈페이지 개편은 삭제하지 않고 `[x]`로 기록했다.

### 검증
- 문서 필수 항목, 파일 경로, 체크박스 구조와 Markdown 형식을 점검한다.

### 남은 문제
- 다음 기본 작업은 `미국주식 dividendYield 단위 및 validation 수정`이다. 이번 작업에서는 원인 경로만 확인하고 데이터·생성 로직은 수정하지 않았다.

## 2026-09-09 — 홈페이지 검색 중심 허브 리디자인

- 사용자가 선택한 첫 번째 시안을 기준으로 기존의 동등한 카테고리 버튼 12개와 오래된 카드 벽을 검색 중심 정보 허브로 교체했다.
- 첫 화면 우선순위를 사이트 검색, 캠핑·차박, 팰월드, 무료 도구, 여행, 인기 콘텐츠, 최근 업데이트 순으로 재구성했다.
- `남양주 차박`, `팰월드`, `QR 코드`, `여행` 추천 검색과 URL 기반 내부 결과 패널을 구현했다. 검색어는 외부로 전송하지 않는다.
- 캠핑·팰월드·도구·여행용 신규 이미지 4개를 웹용 JPEG로 압축해 추가했다. 팰월드 이미지는 저작물 복제가 아닌 독립 생성 비주얼을 사용했다.
- canonical, Google/Naver 소유권 확인, GA4, AdSense 게시자 ID, FAQ/WebSite JSON-LD, 정책 링크는 유지했다.
- 모바일 폭 계산과 검색 버튼 공간을 보정했으며 데스크톱 1488×1056, 반응형 500×844 Chrome 캡처로 검수했다.
- 홈페이지 전용 회귀 테스트 4개를 추가하고 전체 테스트 호환성을 확인했다.

## 2026-09-09 — 일일 발행 제한 제거 및 팰월드 공략 3개 발행

- 사용자 지시에 따라 자동 발행 선택 로직과 CI 발행 가드의 하루 3페이지 제한을 제거했다. 검색 수요·품질·중복·보호 규칙은 유지한다.
- `차원을 넘어 퀘스트`, `1.0 낚시`, `세계수 성수` 공략을 공식 v1.0~1.0.4 자료 기반으로 발행했다.
- 각 페이지를 `EXP-CONTENT-20260909-04~06`으로 등록하고 2026-10-07까지 COOLDOWN 및 28일 관찰 상태로 설정했다.
- 허브·한국어 사이트맵·RSS·색인 요청 후보를 연결했으며, 확인되지 않은 검색량·드롭률·보상 수치는 생성하지 않았다.
- 첫 GitHub SEO QA에서 상대 허브 링크 때문에 `HUB_LINK_MISSING`이 발생해 새 글 링크를 절대 내부경로로 통일하고 회귀 테스트를 추가했다.

## 2026-09-09 — 팰월드 신규 키워드 조사

- Google 검색 결과와 Palworld 공식 1.0.4 변경 기록을 바탕으로 신규 검색 의도 10개를 조사했다.
- 기존 팰월드 7개 페이지와 intent 중복을 검사해 `차원을 넘어 퀘스트`, `1.0 낚시`, `세계수 성수`를 우선 후보로 선정했다.
- 정확한 Google·네이버 검색량은 연결되지 않아 수요 상태를 `OBSERVED_SEARCH_SIGNAL`, 기회 점수를 `ESTIMATED`로 명시했다.
- 교배·돌연변이, 초보, 거점 오류, 모드 오류, 각성, 레이드, 선리치 일반 키워드는 기존 글과 겹쳐 신규 URL 생성 대상에서 제외했다.
- 상세 결과를 `reports/palworld-keyword-research-2026-09-09.md`에 저장했으며 콘텐츠는 아직 발행하지 않았다.

## 2026-09-09 — 무료 검색 트렌드 신호 연동

- TrendRadar의 SQLite 출력에서 제목·플랫폼·순위·반복 관찰 횟수를 읽는 독립 어댑터를 추가했다. GPL 소스는 저장소에 복사하지 않고 외부 실행 결과만 소비한다.
- 네이버 데이터랩 공식 API의 30일 상대 검색 추이를 수집하도록 추가했다. 절대 검색량은 생성하지 않는다.
- 인증정보나 TrendRadar DB가 없으면 각각 `NOT_CONNECTED`, `INSUFFICIENT_DATA`로 기록하며 허위 값을 만들지 않는다.
- Google Trends 공식 API는 접근 권한이 없으므로 `NOT_CONNECTED`로 유지한다.
- 검색 트렌드 데이터와 보고서를 GitHub SEO QA 산출물에 포함했다.

## 2026-09-09 — 팰월드 7개 페이지 Google·네이버 수집 요청

- 팰월드 신규 페이지 7개를 Google Search Console URL 검사에서 개별 제출했고, 모두 `우선순위 크롤링 대기열에 추가` 결과를 확인했다.
- 네이버 Search Advisor `웹 페이지 수집`에도 같은 7개 URL을 제출했고, 수집 요청 내역에 7건이 표시된 것을 확인했다.
- 제출과 실제 색인 완료를 구분해 현재 상태를 `SUBMITTED / PENDING`으로 기록했다.
- 중복 제출 방지를 위해 `data/index-submission-log.json`에 배치 `INDEX-PALWORLD-20260909-01`을 저장했다.

## 2026-09-09 — 팰월드 엔드게임 가이드 3개 발행

- 각성·광휘 보석, 레이드 구역 준비, 선리치 탐험 준비 페이지를 공식 1.0 기록 기반으로 발행.
- 검색 수요는 `OBSERVED_SEARCH_SIGNAL`, 수치·좌표·드롭률은 추정하지 않음.
- `EXP-CONTENT-20260909-01~03`으로 등록하고 2026-10-07까지 COOLDOWN.

## 2026-09-08 — 팰월드 문제 해결형 페이지 2개 발행

- `팰월드 1.0 거점 팰이 일하지 않을 때`와 `팰월드 1.0 모드 충돌·실행 오류 해결` 페이지를 발행.
- 외부 검색 결과의 반복 질문을 근거로 `OBSERVED_SEARCH_SIGNAL` 처리했으며 검색량은 추정하지 않음.
- 기존 초보·교배 공략과 독립 intent로 판정하고 각각 `EXP-CONTENT-20260908-04`, `EXP-CONTENT-20260908-05`로 2026-10-06까지 관찰.
- 공식 1.0 변경 기록과 공식 모드 가이드로 핵심 절차를 검증하고 허브·사이트맵에 연결.

## 2026-09-08 — 카운터 초기화 후 GitHub SEO QA 실패 수정

- 실패 실행: GitHub Actions `34221695591`, `MANIFEST_DIFF_MISMATCH`.
- 원인: 신규 HTML이 없는 카운터 초기화에서도 manifest 변경만으로 콘텐츠 발행 검증이 시작됨.
- 수정: 신규 HTML 파일이 실제 추가된 경우에만 발행 manifest 일치 검증을 수행하도록 가드 조건을 좁힘.
- 회귀 테스트: manifest와 카운터 상태만 변경되는 초기화 커밋은 통과하고, 신규 HTML 발행 제한은 기존대로 유지.

## 2026-09-08 — 일일 콘텐츠 발행 카운터 수동 초기화

- 사용자 요청에 따라 오늘 발행 카운터를 `0/3`으로 초기화했다.
- 기존 발행 페이지와 `content-launch-experiments.json`의 실험 이력은 보존했다.
- `data/content-launch-counter.json`에 `resetAt`을 기록해 초기화 시각 이후 발행만 오늘 카운트에 포함하도록 했다.
- 초기화 직후 상태: `publishedToday: 0`, `remainingCapacity: 3`.
- 회귀 테스트: `691 passed`.

## 2026-09-09 — Keyword Hunter 착수
- 이전 요구사항 및 기존 기록을 확인. HTML 19,079개와 기존 SEO/외부 기회/DataLab/발행 가드 구조를 조사했다.
- Python 표준 라이브러리와 기존 모듈 재사용으로 구현한다. 설계·체크리스트: docs/keyword-hunter/design.md.
- 기존 미추적 사용자 파일과 sources 참조 파일은 보존한다.

## 2026-09-10 — 키워드 기회 페이지 6개 발행

- `/kor/util/car-inspection-cost/`, `/kor/util/date-calculator/`, `/kor/util/retirement-pension-withdrawal/`, `/kor/report/camp/carbon-monoxide-detector.html`, `/kor/report/visa/esta-application-checklist.html`, `/kor/report/animal/pet-food-selector.html`을 발행하고 관련 허브·사이트맵·메타데이터·Keyword Hunter 발행 상태를 연결했다.
- 자동차검사는 TS, 퇴직연금은 고용노동부·국가법령정보센터·국세청, 캠핑 안전은 소방청·CPSC·CDC, ESTA는 CBP, 반려동물 사료는 농림축산식품부·법령정보·FDA·AAHA의 공식 자료 범위만 사용했다. 개인별 검사 대상·세금·연금 적합성·ESTA 자격/승인·질환 진단이나 제품 순위는 계산하거나 보장하지 않는다.
- 집중 회귀 테스트 68개가 통과했고 전체 SEO QA의 신규 critical/warning은 0건이었다. 여섯 canonical URL이 설계된 sitemap의 `<loc>`에 있는지 직접 검증했으며, 6페이지 모두 데스크톱 1440×900과 모바일 390×844에서 주요 상호작용·오류 분기·키보드 포커스·가로 넘침을 확인했다. 전역 `data/site-audit.json`은 19,066페이지 시점이라 sitemap 감사에 기존 URL을 포함한 미등록 18건이 남으며, 별도의 크기 안전한 갱신 전략이 필요하다.
- `EXP-CONTENT-20260910-01`~`06`은 2026-09-10부터 2026-10-08까지 28일 관찰한다. 색인·검색 노출·사용 행동은 아직 성과가 확정되지 않았으며, 수수료·법령·안전·ESTA·사료 표시 기준의 시점성 정보는 공식 출처 변경을 계속 모니터링해야 한다.
- 발행 후 SEO CI에서 선행 생성 단계의 작업 파일까지 신규 콘텐츠로 오인하던 문제를 수정했다. 콘텐츠 발행 가드는 기준 커밋과 `HEAD` 사이의 실제 발행 커밋만 검사한다.
## 2026-09-09 18:29 Keyword Hunter
- Seeds: 26; New: 10; Rejected: 0; DB: 10; Errors: 29; Top: none. Report: reports/keyword-hunter/2026-09-09-1829.md

## 2026-09-09 — Keyword Hunter 구현·테스트
- 공식 Search Ads 서명/재시도/예산과 기존 DataLab·사이트 파서·중복 판정 모듈을 연결했다. CSV/JSON 영구 상태, depth/diversity, TOP 리포트, dry-run, 복구 저널 및 잠금을 구현했다.
- 신규 테스트 30개 통과. 숫자별 의도 중복, 거절 seed 재탐색, 0 배분, 발행 URL 보존 문제를 회귀 테스트로 확인·수정했다.
- 실제 사이트 dry-run: 공개 HTML 19,078개 검사, 기존 외부 관찰 후보 10개, API 호출/파일 변경 0. 환경변수 5개 미설정으로 실측 검증은 대기.
- 문서: docs/keyword-hunter.md. 기존 SEO QA에 무네트워크 dry-run 검사 추가. 첫 전체 검증: pytest 737개, unittest 603개, JS 8개 통과; 추가 회귀 테스트 포함 최종 검증 진행.

## 2026-09-09 18:31 Keyword Hunter
- Seeds: 26; New: 10; Rejected: 0; DB: 20; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-09-09-1831.md

## 2026-09-09 — Keyword Hunter 최종 검증
- 전체 pytest 741 passed (54.55s), unittest 607 OK (4.25s), JavaScript 8 passed. 최종 RSS 기본값 변경 후 Hunter 30개 재검증 통과. git diff --check 통과.
- 첫 실제 실행은 10개 후보를 저장했고, 오프라인 재실행은 미탐색 외부 seed 10개를 추가해 DB 20개로 확장했다. 정규화 키 20개가 모두 고유하며 기존 행의 중복 저장은 없었다. 필수 CSV/JSON 5종과 리포트·실행 기록 저장을 검증했다.
- 정책브리핑 RSS 중단을 공식 페이지에서 확인하고 고용노동부 공식 RSS 안내 주소로 교체했다. 현재 호스트에서는 NETWORK_ERROR이며 네이버 자격증명 5개도 미설정이다. API mock 검증과 실제 인증 호출 검증을 구분한다.
- 의미 중복 검사는 동의어/검색 의도/문자 유사도 휴리스틱이다. TOP 후보의 편집 검토는 필요하다. 2시간 Automation 프롬프트를 문서화했고 예약 자체는 생성하지 않았다.

## 2026-09-09 19:31 Keyword Hunter
- Seeds: 26; New: 10; Rejected: 0; DB: 30; Errors: 29; Top: none. Report: reports/keyword-hunter/2026-09-09-1931.md

## 2026-09-10 06:40 Keyword Hunter
- Seeds: 0; New: 0; Rejected: 0; DB: 30; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-09-10-0640.md

## 2026-09-10 — Keyword Hunter API·데이터 품질 보호
- 공식 문서를 재확인해 Search Ads `/keywordstool`과 DataLab 인증 방식을 유지하고, DataLab의 `NAVER_CLIENT_ID`/`NAVER_CLIENT_SECRET` 및 기존 변수명을 함께 지원했다.
- `--health-check`를 추가했다. 실제 확인 결과: Search Ads `NOT_CONFIGURED`, DataLab `NOT_CONFIGURED`, Site Index `OK`, 외부 네트워크에서 고용노동부 RSS `OK`(샌드박스에서는 `DEGRADED`). 실제 `육아휴직` 핵심 API 호출은 인증정보가 없어 수행하지 않았다.
- Search Ads TTL을 7일로 늘리고 429 대기를 최소 30초부터 적용했다. 인증·rate-limit·network 오류 후 같은 실행에서 핵심 API를 반복 호출하지 않는다.
- coverage 0~100, `score_valid`, HIGH/MEDIUM/LOW/UNVERIFIED를 추가했다. 핵심 데이터가 모두 없으면 opportunity score를 비우고 TOP 및 QUEUED에서 제외한다.
- 신규 발굴 없이 기존 30개를 마이그레이션: 전부 `UNVERIFIED`, coverage 0, `score_valid=false`, opportunity score 비움, QUEUED 0. 미설정 상태의 UNVERIFIED 저장 상한은 20이며 기존 초과분은 보존한다.
- 외부 RSS는 선택 소스로 격리했다. 데이터 품질 마이그레이션 리포트: `reports/keyword-hunter/2026-09-10-0640.md`.

## 2026-09-10 — NAVER API HUB 호출 비용 보호

- 검색어 트렌드 공식 월 한도 50,000회를 확인했다. 현재 콘솔 사용량은 사용자 화면 기준 0회다.
- Keyword Hunter의 DataLab 호출 상한을 실행당 50회에서 20회로 낮췄다. 2시간 주기·31일 기준 이론상 최대 7,440회로 공식 한도의 약 14.9%다.
- NAVER API HUB는 현재 한시적 무료 제공이므로, 유료 전환 공지 시 자동 실행 전에 요금 정책을 다시 확인하도록 운영 문서에 기록했다.
- API HUB용 환경변수, 엔드포인트(`/search-trend/v1/search`)와 인증 헤더를 적용하고 `.env` 자동 로딩을 추가했다. 실제 `육아휴직` health check 결과 Search Ads, DataLab, 외부 RSS, 사이트 인덱스 모두 `OK`였다.

## 2026-09-10 16:10 Keyword Hunter
- Seeds: 31; New: 15; Rejected: 1; DB: 45; Errors: 2; Top: none. Report: reports/keyword-hunter/2026-09-10-1610.md

## 2026-09-10 16:14 Keyword Hunter
- Seeds: 30; New: 10; Rejected: 0; DB: 55; Errors: 2; Top: none. Report: reports/keyword-hunter/2026-09-10-1614.md

## 2026-09-10 16:26 Keyword Hunter
- Seeds: 30; New: 10; Rejected: 0; DB: 65; Errors: 2; Top: none. Report: reports/keyword-hunter/2026-09-10-1626.md

## 2026-09-10 — Keyword Hunter 다음 seed 반복 수정

- API 미연결·실패 실행도 `last_expanded`로 기록되고, 다음 seed 보고가 7일 TTL을 거르지 않아 같은 항목이 반복되는 원인을 수정했다.
- Search Ads 성공 시에만 확장 완료와 캐시 상태를 저장하고, 실제 다음 실행에서 처리 가능한 seed만 리포트에 표시한다.

## 2026-09-10 16:53 Keyword Hunter
- Seeds: 30; New: 130; Rejected: 108; DB: 195; Errors: 3; Top: 날짜계산. Report: reports/keyword-hunter/2026-09-10-1653.md

## 2026-09-10 18:15 Keyword Hunter
- Seeds: 40; New: 142; Rejected: 102; DB: 337; Errors: 6; Top: 연금저축추천. Report: reports/keyword-hunter/2026-09-10-1815.md

## 2026-09-10 18:22 Keyword Hunter
- Seeds: 32; New: 56; Rejected: 31; DB: 393; Errors: 7; Top: 개인연금저축추천. Report: reports/keyword-hunter/2026-09-10-1822.md

## 2026-09-10 18:28 Keyword Hunter
- Seeds: 40; New: 55; Rejected: 25; DB: 448; Errors: 14; Top: 자동차검사비용. Report: reports/keyword-hunter/2026-09-10-1828.md

## 2026-09-10 18:34 Keyword Hunter
- Seeds: 6; New: 23; Rejected: 19; DB: 471; Errors: 14; Top: 자동차점검비용. Report: reports/keyword-hunter/2026-09-10-1834.md

## 2026-09-10 — Keyword Hunter 자율 탐색 아키텍처

- 최근 10회 탐색 기억, novelty score, 신규 테마/유망 테마/Winner/backlog 40/30/20/10 seed 예산, 재현 가능한 70/30 sampling, seed·cluster cooldown과 dead cluster 기록을 추가했다.
- 생산용 초기 예시 seed 20개를 제거하고 `seed_exclusions.json`의 root 및 다세대 parent 계보를 탐색·재검증에서 제외했다. 기존 keyword DB는 삭제하지 않았다.
- category 20%·cluster 10% 후보 상한, source 50% 상한(대체 source가 있을 때), 신규 고수요 후보 DataLab 우선 검증, EXPERIMENT_THEME 승격과 기존 CONTENT_QUEUE 상태 전이를 유지했다.
- 리포트에 탐색 후보/신규·반복 seed/novelty/overlap/category·source 비중/Winner/신규 테마 Winner/cooldown/다음 신규 방향/random seed를 추가했다.
- 대표 실제 실행(18:28): 후보 pool 192, 선택 seed 40, 신규 seed 36, novelty 90%, 최근 overlap 0%, 신규 cluster 36, 신규 테마 Winner `자동차검사비용`, `자동차종합검사비용`, `자동차정기검사비용`, rate limit 0.
- 계보·포화 보정 후 연속 검증(18:34): novelty 100%, overlap 0%, 신규 테마 Winner `자동차점검비용`. 짧은 시간에 4회 연속 실행해 cooldown 대상이 누적되어 선택 가능 seed가 6개·category 4개로 줄었고 20% 분산 목표는 달성 불가했다. 정상 2시간 주기에는 새 외부 관찰을 누적한다.

## 2026-09-10 19:41 Keyword Hunter
- Seeds: 4; New: 22; Rejected: 15; DB: 493; Errors: 14; Top: none. Report: reports/keyword-hunter/2026-09-10-1941.md

## 2026-09-10 19:58 Keyword Hunter
- Seeds: 9; New: 35; Rejected: 27; DB: 528; Errors: 14; Top: none. Report: reports/keyword-hunter/2026-09-10-1958.md

## 2026-09-10 — Keyword Hunter DataLab 동적 quota

- 실행당 20회 고정 제한을 제거하고 월 50,000회·10% reserve, KST 잔여 날짜와 2시간 주기 잔여 실행 횟수에 따른 동적 예산을 적용했다.
- 실제 HTTP 전송과 재시도를 `data/api_usage.json`에 월·일별로 원자적 누적하며 이전 월 bucket을 보존한다. 공식 Usage Statistics 프로그램 API가 명확하지 않아 콘솔 scraping은 사용하지 않는다.
- DataLab은 Search Ads Fast Filter 이후 상위 후보 validation에만 쓰고 후보 최대 5개를 한 요청에 batch 처리한다. quota 소진 시 DataLab만 중단하고 Search Ads 탐색은 계속한다.
- 회귀 테스트: 전체 pytest 793 passed. 실제 실행(19:58): DataLab 31 calls, 153 keywords, 평균 4.94 keywords/call, 월 로컬 누적 31, 잔여 usable quota 44,969, Winner 0.

## 2026-09-11 02:06 Keyword Hunter
- Seeds: 8; New: 4; Rejected: 1; DB: 532; Errors: 14; Top: none. Report: reports/keyword-hunter/2026-09-11-0206.md

## 2026-09-11 04:07 Keyword Hunter
- Seeds: 40; New: 31; Rejected: 10; DB: 563; Errors: 18; Top: none. Report: reports/keyword-hunter/2026-09-11-0407.md

## 2026-09-11 06:09 Keyword Hunter
- Seeds: 40; New: 1; Rejected: 0; DB: 564; Errors: 18; Top: none. Report: reports/keyword-hunter/2026-09-11-0609.md

## 2026-09-11 06:55 Keyword Hunter
- Seeds: 8; New: 0; Rejected: 0; DB: 564; Errors: 18; Top: none. Report: reports/keyword-hunter/2026-09-11-0655.md

## 2026-09-11 12:10 Keyword Hunter
- Seeds: 0; New: 0; Rejected: 0; DB: 564; Errors: 18; Top: none. Report: reports/keyword-hunter/2026-09-11-1210.md

## 2026-09-11 18:10 Keyword Hunter
- Seeds: 10; New: 0; Rejected: 0; DB: 564; Errors: 18; Top: none. Report: reports/keyword-hunter/2026-09-11-1810.md

## 2026-09-11 19:19 Keyword Hunter
- Seeds: 10; New: 0; Rejected: 0; DB: 564; Errors: 18; Top: none. Report: reports/keyword-hunter/2026-09-11-1919.md

## 2026-09-11 19:49 Keyword Hunter
- Seeds: 40; New: 20; Rejected: 19; DB: 584; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-09-11-1949.md

## 2026-09-11 19:54 Keyword Hunter
- Seeds: 40; New: 23; Rejected: 19; DB: 607; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-09-11-1954.md

## 2026-09-11 — Keyword Hunter zero-result 진단 및 recovery

- 19:19 실행을 재구성했다. seed pool 205개 중 최근 seed/cluster 차단 뒤 10개만 선택됐고, 총 55 HTTP calls에서 DataLab 36·RSS 1을 제외한 Search Ads 18회가 모두 긴 문장형 seed의 HTTP 400으로 끝나 raw keyword 0, 신규 0이 됐다. DataLab은 기존 178개를 반복 검증했고 DB 564개 중 score_valid는 4개뿐이었다. 신규 fresh만 Winner로 집계해 Winner도 0이었다.
- DISCOVERY FUNNEL 계측을 추가했다: seed 고려/cooldown/query, Search Ads raw, normalization, DB 중복, category saturation, novelty, Fast Filter, web result count, DataLab, score validity, Candidate, Winner와 단계별 통과·탈락률을 기록한다. Naver web result count 수집기는 없어 0으로 명시한다.
- ZERO RESULT RECOVERY를 추가했다. 신규 0이 2회 또는 Winner 0이 3회 연속이면 최근 10회 seed와 cooldown cluster를 피하고 신규 테마 비중을 70%로 올린다. 관찰된 외부 제목의 단어만 2~3개 묶어 짧은 Search Ads seed로 만들고 신규 category 10개 이상 breadth를 목표로 한다. Winner threshold는 유지하고 검증 완료 상위 행을 CANDIDATE 10으로 별도 보고한다.
- DataLab 성공값 TTL 24시간을 적용하고, 이번 요청에 제출하지 않은 행의 기존 trend 값을 지우던 오류를 재현 테스트 후 수정했다. Fast Filter 직전 통과율 2% 미만이면 recovery에서 검색량 바닥만 10에서 5로 제한 완화한다.
- 첫 recovery 실행(19:49): seed pool 1,159, Search Ads queried 21, raw 21, 신규 20으로 앞단 0건을 해소했다. 최종 검증 실행(19:54): considered 1,159 → cooldown 제외 169 → queried 22 → raw 25 → normalized 25 → DB duplicate 4 → novelty passed 21 → Fast Filter 15 → DataLab verified 15 → 신규 score-valid Candidate 0 → Winner 0. 신규 키워드 23, 기존 검증 Candidate 4개를 보존·보고했다. 모든 API health OK, rate limit 0.

## 2026-09-11 20:17 Keyword Hunter
- Seeds: 40; New: 28; Rejected: 23; DB: 635; Errors: 1; Top: 정수기렌탈가격비교. Report: reports/keyword-hunter/2026-09-11-2017.md

## 2026-09-11 — Keyword Hunter 검증·scoring 데이터 흐름 수정

- Search Ads 응답의 PC·모바일·합계·경쟁도·source seed를 신규 생성, 정규화, 재조회, CSV 저장까지 비파괴 병합한다. 한 채널이 `<10`이어도 다른 채널 실측값을 버리지 않고 합계 하한값과 `LOWER_BOUND_CENSORED` 표시를 보존한다.
- 실제 DataLab 진단에서 400일 요청에 348일, 최근 30일에 22일만 반환되어 기존의 “하루라도 누락되면 전체 추세 무효” 조건이 15/15를 전부 `None`으로 만든 원인을 확인했다. 각 비교 구간의 50% 이상이 관측되면 관측값 평균으로 1개월·3개월 추세를 계산하며 누락일을 0으로 만들지 않는다.
- scoring을 분리해 Search Ads+DataLab은 MEDIUM/유효, 여기에 web result count가 있으면 HIGH, Search Ads만 있으면 LOW, 검색량이 없으면 UNVERIFIED로 판정한다. 웹 결과 하나가 없거나 competition 한 필드가 없다는 이유만으로 전체 점수를 무효화하지 않으며 Winner는 MEDIUM 이상으로 제한한다.
- Fast Filter 상위 최대 50개에 NAVER API HUB 웹문서 검색을 연결하고 결과 수, 수요/공급 비율, 경쟁 비율, 확인 시각을 저장한다. 현재 애플리케이션은 실제 요청에서 HTTP 401이므로 `NAVER_WEB_SEARCH: AUTH_ERROR`로 표시하고 첫 실패 뒤 중단하며 Search Ads·DataLab은 계속한다.
- 리포트에 keyword별 `score_invalid_reasons`와 원인별 집계, Search Ads 검색량 보존 건수, 실제 web result 호출 수를 추가했다. DataLab 제출 건수와 실제 계산 가능 검증 건수를 분리했다.
- 회귀 테스트 808개 통과. 실제 실행: 신규 28, 검색량 보존 11, DataLab 계산 가능 검증 6(신규 3), web 호출 1/AUTH_ERROR, 신규 score-valid 3, Candidate 3, Winner 3. TOP은 정수기렌탈가격비교 51.55, 정수기추천 47.44, 정수기렌탈비교 36.60이다.

## 2026-09-11 20:30 Keyword Hunter
- Seeds: 40; New: 28; Rejected: 23; DB: 663; Errors: 1; Top: 정수기렌탈추천. Report: reports/keyword-hunter/2026-09-11-2030.md

## 2026-09-12 08:07 Keyword Hunter
- Seeds: 34; New: 28; Rejected: 22; DB: 691; Errors: 1; Top: 정수기렌탈가격. Report: reports/keyword-hunter/2026-09-12-0807.md

## 2026-09-12 — Keyword Hunter 생산 자동화 및 성과 후보 분리

- 가장 큰 병목은 후보 부족 자체가 아니라 검증 데이터의 연결 범위였다. 과거 `Selected 0 / Published 0`은 긴 seed의 Search Ads 400, DataLab 누락일을 전체 무효 처리, 웹문서 결과 수 결측 때문에 유효 점수가 사라진 것이 원인이었고, 2026-09-11 수정 후 실제 Candidate/Winner가 생성된다. `Published 0`은 Hunter가 자동 발행하지 않는 의도된 안전 정책이다.
- 현재 실제 health check는 Search Ads `OK`, DataLab `OK`, 외부 RSS `OK`, 사이트 인덱스 `OK`, 웹문서 검색 `AUTH_ERROR`/권한 `REQUIRED`다. 공식 API HUB 구조와 요청 경로·헤더는 맞으며, 사용 중인 애플리케이션에서 `Search > 웹문서 검색` 권한이 활성화되지 않은 것이 401 원인이다. 별도 웹 검색 API HUB 키를 우선 사용할 수 있게 했다.
- DataLab 상대 추세는 Opportunity Score의 trend 구성요소에 실제 반영한다. Google Trends 권한/공식 API가 없을 때 값을 추정하지 않으며, DataLab과 선택적 TrendRadar를 무료 수요 신호로 사용한다.
- `data/page-performance.json`에서 `VERIFIED` 측정값이 있는 비-WINNER·비-COOLDOWN URL만 추출해 `data/existing-page-improvement-candidates.json`에 저장한다. 페이지는 자동 수정하지 않는다.
- 2시간 주기의 `.github/workflows/keyword-hunter.yml`을 추가했다. Search Ads/DataLab secrets 사전검사, 동시 실행 방지, Hunter 테스트, 제한된 상태·리포트 커밋만 수행하며 신규 페이지를 자동 제작·발행하지 않는다.
- 실제 실행: 신규 28, DB 691, Search Ads 검색량 보존 신규 13, DataLab 검증 2, Candidate 2, Winner 2, 신규 제작 우선 검토 `정수기렌탈가격`(월 580, score 52.22)과 `정수기비교`(월 1,210, score 36.7), 기존 페이지 개선 후보 20. 웹문서 경쟁도는 401로 미확인 상태를 유지했다.
- GitHub Actions secrets에는 현재 `INDEXNOW_KEY`만 있어 Search Ads 3개와 API HUB 2개를 사람이 등록해야 한다. API HUB 웹문서 검색 권한 활성화 후 첫 scheduled run 전체 `OK` 확인이 다음 최우선 작업이다.
- 검증: 최신 메인 병합 후 Keyword Hunter 관련 80개 및 전체 pytest 865개 통과, `git diff --check` 통과.
## 2026-09-12 Keyword Hunter production verification

- Requested production dispatch could not start: GitHub default `main` does not yet contain/register `.github/workflows/keyword-hunter.yml` (`HTTP 404`).
- No code, keyword data, or pages were changed; no new page was published.
- API/Candidate/Winner production status remains unverified until the production branch is merged into `main` and the workflow is visible to Actions.
## 2026-09-12 production merge and dispatch verification

- Merged `feature/keyword-hunter-production-20260912` into `main` without conflicts and pushed commit `7e41634efa`.
- `.github/workflows/keyword-hunter.yml` is present on `main`; manual run `34660554615` failed at credential validation before API calls.
- GitHub repository secrets `NAVER_SEARCHAD_API_KEY`, `NAVER_SEARCHAD_SECRET_KEY`, and `NAVER_SEARCHAD_CUSTOMER_ID` were empty/missing. No content was published and no keyword results were generated.
## 2026-09-12 Keyword Hunter dispatch retry

- Manual run `34660683267` on `main` failed at `Validate required credentials` before Search Ads/DataLab/Web Search calls.
- GitHub Actions still receives empty `NAVER_SEARCHAD_API_KEY`, `NAVER_SEARCHAD_SECRET_KEY`, and `NAVER_SEARCHAD_CUSTOMER_ID`; no results were produced and no pages were published.

## 2026-09-12 09:24 Keyword Hunter
- Seeds: 40; New: 90; Rejected: 89; DB: 781; Errors: 1; Top: 정수기가격비교. Report: reports/keyword-hunter/2026-09-12-0924.md

## 2026-09-12 10:46 Keyword Hunter
- Seeds: 40; New: 20; Rejected: 17; DB: 801; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-09-12-1046.md

## 2026-09-12 10:58 Keyword Hunter
- Seeds: 40; New: 23; Rejected: 20; DB: 824; Errors: 0; Top: 정수기렌탈가격. Report: reports/keyword-hunter/2026-09-12-1058.md

## 2026-09-12 — pending validation 우선 재검증

- 원인: DataLab은 `fast_passed[:250]`, Web Search는 그 앞 후보만 검증해 과거 유망 키워드가 신규 탐색 결과에 밀리면 필요한 실측값 없이 남았다.
- `pending_validation` 메타데이터(재시도 횟수·마지막 시각·만료 표시)를 추가했다. 검색량·경쟁 조건을 통과했지만 trend 또는 웹문서 결과가 결측인 후보는 다음 실행에서 두 API의 한도 내 우선 검증한다. 모든 실측값을 얻으면 즉시 pending을 해제하며, 3회 재시도 후에는 만료한다. 점수식·자동 발행 정책은 변경하지 않았다.
- Production run `34666327352`: Search Ads/DataLab/Web Search 모두 `OK`; pending 21건 재검증, 실행 후 pending 8건, 만료 0건. `정수기가격비교`는 월 350, trend 1개월 -37.75 / 3개월 -43.21, 웹문서 4,379,512건, 점수 39.1 / HIGH로 최신 실측 기준 재판정됐다. Candidate 13, Winner 8이며 신규 콘텐츠는 발행하지 않았다.
- 검증: pending 단위 테스트 2개 RED→GREEN 확인, Keyword Hunter 테스트 82개 통과. 다음 작업은 남은 pending 8건의 quota 내 재검증 결과를 관찰하고, 검증 완료 Candidate만 별도 콘텐츠 검토로 넘기는 것이다.

## 2026-09-12 — 정수기 렌탈 가격 비교 계산기 발행

- Production Keyword Hunter의 실측 Winner `정수기렌탈가격비교`(Opportunity Score 51.55, HIGH)를 단일 canonical 도구 페이지 `kor/util/water-purifier-rental-price-comparison/`로 발행했다. `정수기렌탈가격`·`정수기가격비교`·`정수기렌탈비교`·`정수기렌탈추천`은 같은 계약 비교 의도로 통합했으며, 별도 doorway 페이지는 만들지 않았다.
- 사용자가 할인 전 월 렌탈료와 제휴카드 월 할인액을 직접 입력해 36·48·60·72개월의 할인 전/후 총비용을 같이 비교한다. 입력값은 저장하지 않고, 브랜드 순위·사은품·확인할 수 없는 프로모션·추정 가격은 제공하지 않는다.
- 공식 참고 출처는 LG전자 베스트샵 구독 안내, 코웨이 제품 상세, SK매직 렌탈 계산기이며, 가격 확인 기준일은 2026-09-12로 페이지에 표시했다. 예시 공식 가격은 계산기 기본값·순위 근거로 사용하지 않았다.
- sitemap·무료 도구 허브·launch manifest·content metadata·Keyword Hunter published 상태를 반영하고, 실험 `EXP-CONTENT-20260912-01`을 2026-10-10까지 OBSERVING/COOLDOWN으로 등록했다.
- 검증: 전용 계산기/발행 메타데이터/legacy launch guard 테스트와 content launch guard를 통과했다. 전체 재스캔은 저장소에 남아 있는 기존 `.worktrees` 복제본의 대량 중복·깨진 링크를 재탐지하므로 이번 단일 페이지 회귀 판단에는 사용하지 않았다.

## 2026-09-12 13:41 Keyword Hunter
- Seeds: 40; New: 27; Rejected: 20; DB: 851; Errors: 0; Top: 급여세금계산기. Report: reports/keyword-hunter/2026-09-12-1341.md

## 2026-09-13 00:35 Keyword Hunter
- Seeds: 40; New: 30; Rejected: 14; DB: 881; Errors: 1; Top: 원천징수계산기. Report: reports/keyword-hunter/2026-09-13-0035.md

## 2026-09-13 03:27 Keyword Hunter
- Seeds: 40; New: 30; Rejected: 20; DB: 911; Errors: 1; Top: 연차수당계산기. Report: reports/keyword-hunter/2026-09-13-0327.md

## 2026-09-13 07:21 Keyword Hunter
- Seeds: 40; New: 47; Rejected: 34; DB: 958; Errors: 1; Top: 사대보험계산기. Report: reports/keyword-hunter/2026-09-13-0721.md

## 2026-09-13 13:54 Keyword Hunter
- Seeds: 40; New: 37; Rejected: 30; DB: 995; Errors: 0; Top: 퇴직금계산방법. Report: reports/keyword-hunter/2026-09-13-1354.md

## 2026-09-13 19:41 Keyword Hunter
- Seeds: 40; New: 28; Rejected: 19; DB: 1023; Errors: 1; Top: 주휴수당계산법. Report: reports/keyword-hunter/2026-09-13-1941.md

## 2026-09-13 20:17 Keyword Hunter
- Seeds: 40; New: 28; Rejected: 14; DB: 1051; Errors: 0; Top: 실업급여계산기. Report: reports/keyword-hunter/2026-09-13-2017.md

## 2026-09-13 20:58 Keyword Hunter
- Seeds: 40; New: 31; Rejected: 23; DB: 1082; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-09-13-2058.md

## 2026-09-13 — Revenue Growth Sprint 1 여행 허브

- `/kor/report/travel/`의 2.79MB·5,233링크 전체 목록을 canonical URL을 유지한 21.8KB 큐레이션 허브로 교체했다. 준비 도구, 목적별 선택, 아시아·유럽·미주·오세아니아, 최근 점검·비자 섹션에 실제 기존 페이지만 일반 HTML 링크로 연결했다.
- title/H1을 한국어 여행 정보 허브 의도에 맞추고 GA4·AdSense·모바일 CSS·`CollectionPage`+`ItemList`를 적용했다. sitemap에는 허브 URL을 추가하고 content-index를 재생성했으며 기존 5천여 여행 상세 URL과 4,809개 상세 페이지의 허브 역링크는 그대로 유지했다.
- 30–50개 고유 `/kor/` 링크와 80KB 크기 상한, 실제 파일 존재, SEO·구조화 데이터·인벤토리 보존 회귀 테스트를 추가했다. 상세 기록: `reports/revenue-growth-sprint-1-travel.md`.
- 캠핑 P1 다섯 후보는 진단만 수행했다. 우선순위는 남양주, 청주, 담양, 김포, 경기도 광주 순이며 명백한 기술 결함이 없어 이번 Sprint에서는 수정하지 않았다.

## 2026-09-14 01:23 Keyword Hunter
- Seeds: 40; New: 47; Rejected: 27; DB: 1129; Errors: 0; Top: 근무기간계산기. Report: reports/keyword-hunter/2026-09-14-0123.md

## 2026-09-14 05:54 Keyword Hunter
- Seeds: 40; New: 28; Rejected: 20; DB: 1157; Errors: 1; Top: 지급명령신청비용. Report: reports/keyword-hunter/2026-09-14-0554.md

## 2026-09-14 09:15 Keyword Hunter
- Seeds: 40; New: 97; Rejected: 75; DB: 1254; Errors: 0; Top: 마진계산기. Report: reports/keyword-hunter/2026-09-14-0915.md

## 2026-09-14 14:06 Keyword Hunter
- Seeds: 40; New: 115; Rejected: 92; DB: 1369; Errors: 0; Top: 해외구매대행. Report: reports/keyword-hunter/2026-09-14-1406.md

## 2026-09-14 21:56 Keyword Hunter
- Seeds: 40; New: 79; Rejected: 54; DB: 1448; Errors: 1; Top: 불법사금융피해구제센터. Report: reports/keyword-hunter/2026-09-14-2156.md

## 2026-09-15 04:26 Keyword Hunter
- Seeds: 40; New: 98; Rejected: 77; DB: 1546; Errors: 0; Top: 알리바바구매대행. Report: reports/keyword-hunter/2026-09-15-0426.md

## 2026-09-15 08:11 Keyword Hunter
- Seeds: 40; New: 50; Rejected: 28; DB: 1596; Errors: 0; Top: 원천징수이행상황신고서. Report: reports/keyword-hunter/2026-09-15-0811.md

## 2026-09-15 13:59 Keyword Hunter
- Seeds: 40; New: 28; Rejected: 15; DB: 1624; Errors: 0; Top: 유럽구매대행. Report: reports/keyword-hunter/2026-09-15-1359.md

## 2026-09-15 20:50 Keyword Hunter
- Seeds: 40; New: 107; Rejected: 88; DB: 1731; Errors: 0; Top: 독일구매대행. Report: reports/keyword-hunter/2026-09-15-2050.md

## 2026-09-16 02:04 Keyword Hunter
- Seeds: 40; New: 28; Rejected: 24; DB: 1759; Errors: 0; Top: 국내리조트추천. Report: reports/keyword-hunter/2026-09-16-0204.md

## 2026-09-16 06:25 Keyword Hunter
- Seeds: 40; New: 37; Rejected: 29; DB: 1796; Errors: 0; Top: 3월여행지추천. Report: reports/keyword-hunter/2026-09-16-0625.md

## 2026-09-16 09:26 Keyword Hunter
- Seeds: 40; New: 40; Rejected: 24; DB: 1836; Errors: 0; Top: 필리핀영어캠프비용. Report: reports/keyword-hunter/2026-09-16-0926.md

## 2026-09-16 16:44 Keyword Hunter
- Seeds: 40; New: 25; Rejected: 21; DB: 1861; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-09-16-1644.md

## 2026-09-16 22:33 Keyword Hunter
- Seeds: 40; New: 25; Rejected: 17; DB: 1886; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-09-16-2233.md

## 2026-09-17 03:13 Keyword Hunter
- Seeds: 40; New: 75; Rejected: 52; DB: 1961; Errors: 0; Top: 패키지여행사추천. Report: reports/keyword-hunter/2026-09-17-0313.md

## 2026-09-17 06:23 Keyword Hunter
- Seeds: 40; New: 25; Rejected: 20; DB: 1986; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-09-17-0623.md

## 2026-09-17 09:36 Keyword Hunter
- Seeds: 40; New: 21; Rejected: 7; DB: 2007; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-09-17-0936.md

## 2026-09-17 16:45 Keyword Hunter
- Seeds: 40; New: 27; Rejected: 18; DB: 2034; Errors: 1; Top: 허위매물없는중고차매매사이트. Report: reports/keyword-hunter/2026-09-17-1645.md

## 2026-09-17 22:32 Keyword Hunter
- Seeds: 40; New: 50; Rejected: 37; DB: 2084; Errors: 0; Top: 중고차매매사이트순위. Report: reports/keyword-hunter/2026-09-17-2232.md

## 2026-09-18 03:18 Keyword Hunter
- Seeds: 40; New: 11; Rejected: 7; DB: 2095; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-09-18-0318.md

## 2026-09-18 07:52 Keyword Hunter
- Seeds: 40; New: 40; Rejected: 28; DB: 2135; Errors: 1; Top: 중고차시세비교. Report: reports/keyword-hunter/2026-09-18-0752.md

## 2026-09-18 13:50 Keyword Hunter
- Seeds: 40; New: 40; Rejected: 26; DB: 2175; Errors: 0; Top: 중고차가격. Report: reports/keyword-hunter/2026-09-18-1350.md

## 2026-09-18 20:22 Keyword Hunter
- Seeds: 40; New: 23; Rejected: 8; DB: 2198; Errors: 0; Top: 자동차등록비용. Report: reports/keyword-hunter/2026-09-18-2022.md

## 2026-09-19 01:29 Keyword Hunter
- Seeds: 40; New: 23; Rejected: 11; DB: 2221; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-09-19-0129.md

## 2026-09-19 05:57 Keyword Hunter
- Seeds: 40; New: 26; Rejected: 15; DB: 2247; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-09-19-0557.md

## 2026-09-19 09:24 Keyword Hunter
- Seeds: 40; New: 21; Rejected: 4; DB: 2268; Errors: 1; Top: none. Report: reports/keyword-hunter/2026-09-19-0924.md

## 2026-09-19 21:32 Keyword Hunter
- Seeds: 40; New: 28; Rejected: 20; DB: 2296; Errors: 0; Top: 얼음정수기렌탈가격비교. Report: reports/keyword-hunter/2026-09-19-2132.md

## 2026-09-20 02:19 Keyword Hunter
- Seeds: 40; New: 21; Rejected: 8; DB: 2317; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-09-20-0219.md

## 2026-09-20 05:46 Keyword Hunter
- Seeds: 40; New: 24; Rejected: 15; DB: 2341; Errors: 0; Top: 월급계산법. Report: reports/keyword-hunter/2026-09-20-0546.md

## 2026-09-20 09:10 Keyword Hunter
- Seeds: 40; New: 41; Rejected: 29; DB: 2382; Errors: 1; Top: 통상임금계산. Report: reports/keyword-hunter/2026-09-20-0910.md

## 2026-09-20 13:58 Keyword Hunter
- Seeds: 40; New: 14; Rejected: 11; DB: 2396; Errors: 0; Top: 4대보험계산. Report: reports/keyword-hunter/2026-09-20-1358.md

## 2026-09-20 20:31 Keyword Hunter
- Seeds: 40; New: 115; Rejected: 100; DB: 2511; Errors: 1; Top: 항공권가격비교사이트. Report: reports/keyword-hunter/2026-09-20-2031.md

## 2026-09-21 01:12 Keyword Hunter
- Seeds: 40; New: 42; Rejected: 14; DB: 2553; Errors: 0; Top: 조기재취업수당모의계산. Report: reports/keyword-hunter/2026-09-21-0112.md

## 2026-09-21 03:51 Keyword Hunter
- Seeds: 40; New: 20; Rejected: 11; DB: 2573; Errors: 0; Top: 비행기가격. Report: reports/keyword-hunter/2026-09-21-0351.md

## 2026-09-21 07:30 Keyword Hunter
- Seeds: 40; New: 60; Rejected: 56; DB: 2633; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-09-21-0730.md

## 2026-09-21 — 09 · Vietnamese 16-Type Personality Quiz — MAIN CLOSURE
- Previous main: `53903dc41fbafd1cb20ee9f027aeedd0bcd8f656`. Approved chain was integrated non-force in order: Core `99c8a30fb655d56b9c8793d89d0d174285e2c63b`, RSS `bf271f1d8e6f294c90bfc1b32e5dfde03f821bfe`, dedicated profile correction `438363afa65f6b6c37f45eced099eb637fd9bb50`, and EN/VN axis-equivalence regression `275f3f4c80d9ab64b06e72dba798a36ecd21ae46`. Current main is `275f3f4c80d9ab64b06e72dba798a36ecd21ae46` and the closure documentation commit is pending.
- Product contract: Vietnamese independent quiz, 20 questions, 5 per E/I S/N T/F J/P axis, exact root-English/VN question axis sequence and A/B direction, strict-majority scoring with no tie completion, visible axis counts, explicit 3:2 close result, 16 dedicated profiles with four non-empty fields and 16 unique full profiles, independent MBTI® non-affiliation/reflection boundary, privacy/no raw-answer telemetry, no hreflang, and AdSense disabled.
- Discovery/propagation: title/H1, canonical and OG trailing slash, one WebApplication JSON-LD, zero FAQPage schema, VN hub, no-lastmod sitemap membership, and generated RSS item are current. Metadata remains `METADATA_NOT_IN_CURRENT_CONTRACT`; no manual row was added. English source and other 12 locales were not modified.
- Verification: focused VN + English regression tests `11 passed`; `git diff --check` passed; Pages workflow `35554252236` for SHA `275f3f4c80` completed successfully; production served HTML confirmed current title/H1/disclosure/update date/canonical/OG/WebApplication/FAQPage absence/no hreflang/no AdSense loader. Runtime confirmed `Câu hỏi 1 / 20`, ESTJ (`E3/I2 S3/N2 T3/F2 J3/P2`), INFP (`E2/I3 S2/N3 T2/F3 J2/P3`), axis counts, distinct ISTJ/ENFP-style profile behavior via result paths, and deterministic restart. `MOBILE_390_NOT_VERIFIED` and `SHARE_RUNTIME_NOT_VERIFIED` remain due environment capability.
- Index/measurement state: `CURRENT_GSC_ROW_ABSENT / INDEX_NOT_CONFIRMED`, no manual submission, GA4 context `50 views / 33 users / $0`, `NAVER_NOT_PRIMARY`, and Notion `NOTION_CLOSURE_PENDING_CHATGPT`. Runtime/production is verified; 7–14/28/56-day measurement and other 12 locale scoring/trust audit remain follow-up. Task 10 was not started.

## 2026-09-21 — 10 · Russian 16-Type Personality Quiz — MAIN CLOSURE
- Previous main: `76e48f7d3fb80a5a49ecd4f47e8a9f336fee7670`. Approved chain integrated non-force: Core `0f3929cce56a6fdafe483d56eee913a1df93b1cc`, RSS `f877497aa9bad5d746829bc853e4fac8dee54a72`, scoring regression `263efd36004ff869bf3ebfcf920294ac76f86167`. Closure documentation commit is pending; current main before closure is `263efd36004ff869bf3ebfcf920294ac76f86167`.
- Product contract: Russian independent 20-question quiz with 5 per E/I, S/N, T/F, J/P axis; root/RU exact axis and A/B mapping; strict-majority scoring with impossible normal-completion ties; visible axis counts and 3:2/2:3 close copy; 16 dedicated four-field profiles with 16 unique full profiles; independent MBTI® non-affiliation, reflection/entertainment and no clinical/professional/hiring claims.
- Privacy/discovery: browser-side scoring without raw answer/result/axis telemetry, fetch/XHR/storage or query serialization; GA4 `G-QP5Q67GE5B`; AdSense disabled; one WebApplication JSON-LD with `ru` and `2026-09-21`; no VideoGame, no FAQPage, no hreflang; canonical/OG, RU hub, no-lastmod sitemap membership, and generated RSS item preserved. Metadata remains `METADATA_NOT_IN_CURRENT_CONTRACT`.
- Test protection: RU-specific stale batch contract now expects `2026-09-21`, WebApplication, and no VideoGame/FAQPage while unrelated batch contracts remain unchanged. Focused suite `20 passed`; all-first/all-second actual `t[0]`/`t[1]` totals and derived results, mirrored count case, mixed ESTJ/INFP, close semantics, and root/RU equivalence are covered.
- Deployment/runtime: Pages workflow `35555715057` for approved main SHA completed successfully; production served HTML confirmed current title/H1/disclosure/date/schema/canonical/no FAQPage/no VideoGame/no AdSense. Runtime confirmed 20-question flow, ESTJ (`E3/I2 S3/N2 T3/F2 J3/P2`), INFP (`E2/I3 S2/N3 T2/F3 J2/P3`), axis counts, close message, distinct profiles, deterministic restart, and `/ru/game/` navigation. `MOBILE_390_NOT_VERIFIED` and `SHARE_RUNTIME_NOT_VERIFIED` remain.
- Search state: GSC `1 impression / 0 clicks / avg position 6.0` for 2026-08-20–2026-09-16, treated as low-sample; `SEARCH_VISIBLE_LOW_SAMPLE / INDEXED_QUERY_UNKNOWN`, `NO_SUBMISSION`, query-level GSC `QUERY_LEVEL_GSC_NOT_AVAILABLE`, `NAVER_NOT_PRIMARY`, and Notion `NOTION_CLOSURE_PENDING_CHATGPT`. Other locales and 14/28/56-day measurements remain follow-up; task 11 was not started.

## 2026-09-21 — 10 · Russian 16-Type Personality Quiz review
- Scope is only `/ru/game/MBTI/` plus the single RU game-hub card, RU focused tests, the RU-specific stale batch contract, and review-state docs. Strategy is `PROTECT-TRAFFIC / QUALITY-CONTRACT REPAIR`; no main merge, deployment, Notion write, or task 11.
- Baseline: GSC `1 impression / 0 clicks / 0% CTR / avg position 6.0` for 2026-08-20–2026-09-16, treated as low-sample rather than stable rank; GA4 `132 views / 91 users / $0`; Google `SEARCH_VISIBLE_LOW_SAMPLE / INDEXED_QUERY_UNKNOWN`; Naver `NAVER_NOT_PRIMARY`.
- Review implementation replaces the 16-question/4-per-axis tie-default with 20 questions and 5 per E/I, S/N, T/F, J/P; preserves root first-16 axis and A/B direction and adds Russian Q17–Q20; adds strict-majority scoring, visible counts and 3:2 close wording, independent identity/trust boundary, 16 dedicated unique four-field profiles, static 16-type overview, privacy truthfulness, no raw-answer telemetry/storage/network payloads, WebApplication-only schema, RU navigation/hub copy, and no hreflang.
- `tests/test_sixth_ga4_priority_batch.py` is policy-specific for RU (`2026-09-21`, WebApplication, no FAQPage/VideoGame) while all unrelated page contracts remain unchanged. Metadata remains `METADATA_NOT_IN_CURRENT_CONTRACT`; Google submission is `NO_SUBMISSION`; production/runtime/mobile are pending review.
- Validation so far: RU + root 05 + VN 09 + sixth batch focused suite `19 passed`; `git diff --check` passed. Review branch is `codex/ru-10-personality-quiz-20260921`; status remains `READY_FOR_REVIEW`, not `DONE`.

## 2026-09-21 — 11 · Chinese Game Hub — REVIEW BRANCH
- Scope is only `/cn/game/` on review branch `codex/cn-11-game-hub-20260921`; task 12, main merge, deployment, and Notion write are not part of this execution.
- Baseline parity found 25 repository child pages and 25 sitemap entries but only 24 visible hub links; `LadderGame` was missing. The hub now exposes all 25 static child anchors, with category labels, search/category intersection, visible accessible search label, no-result live region, and keyboard focus styling.
- Core copy now uses the exact free/no-download title and H1, honest per-game control guidance, no universal keyboard claim, MBTI® independent self-test boundary, and no speculative popularity/device claims. `CollectionPage` is the sole schema with `zh-CN` and `2026-09-21`; FAQPage remains absent. GA4 `G-QP5Q67GE5B`, privacy meaning, AdSense-disabled state, canonical/OG, and no-lastmod sitemap policy are preserved.
- Validation: new `tests/test_cn_game_hub.py` plus `tests/test_sixth_ga4_priority_batch.py` = `6 passed`; `git diff --check` passed. RSS/metadata contracts were not regenerated or manually edited. Status is `READY_FOR_REVIEW`; main/deployment/runtime/mobile/Google verification remain pending.

## 2026-09-21 — 11 · Chinese Game Hub — MAIN CLOSURE
- Previous main: `736a6a07833c85cff9172ca597dd34587e2b40a5`. Approved chain integrated non-force: Core `bc0ec88fa93db6c9be55eb5f2afa386de83af04a`, Initial RSS `5c2a0cfe0ad58afa132e6a628c3f4fcca43cfc95`, HTML/card correction `8ca46b35cb7a7415ed99611279b74ca74808998f`, RSS parity correction `3810dd52aed871f54d1f210f1aca9a5b42bf5fa8`. Current main before docs closure is `3810dd52aed871f54d1f210f1aca9a5b42bf5fa8`; closure commit follows.
- Product closure: repo/sitemap/hub inventory parity is 25, including LadderGame; title/H1/lang, 25 structured full-card anchors, visible category parity, category/search intersection, no universal keyboard claim, MBTI independent self-test boundary, CollectionPage 1 / FAQPage 0, canonical/OG, GA4 `G-QP5Q67GE5B`, privacy/ad-disabled copy, no-lastmod sitemap, and RSS page-metadata parity are current. Historical review notes are preserved; final RSS was generated and parity-tested after the metadata correction.
- Verification: focused CN + sixth batch suite `8 passed`; `git diff --check` passed; Pages run `35568403530` completed successfully for SHA `3810dd52ae`. Production `https://emfls.github.io/cn/game/` served the final title/H1/lang, 25 unique cards, LadderGame, search label, CollectionPage 1, FAQPage 0, and final meta/OG copy. Browser runtime/category/search/mobile 390px are `RUNTIME_NOT_VERIFIED` / `MOBILE_390_NOT_VERIFIED`; Google baseline remains `CURRENT_GSC_ROW_ABSENT / GOOGLE_INDEX_NOT_CONFIRMED`, URL Inspection unavailable, no submission; Naver `NAVER_NOT_PRIMARY`. GA4 context remains `58 views / 23 users / $0`. Force push: NO.
- Closure state: docs-only closure branch is `codex/cn-11-game-hub-closure`; main integration and Pages product deployment are complete. Notion is `NOTION_CLOSURE_PENDING_CHATGPT`; 14/28/56-day index, inventory, GSC, and recirculation follow-up remains.

## 2026-09-21 — 12 · Spanish STOPat5 — REVIEW BRANCH
- Scope is only `/es/game/STOPat5/` on review branch `codex/es-12-stopat5-20260921`; main merge, deployment, Notion write, other STOPat5 locales, the Spanish hub LadderGame issue, and task 13 are out of scope. Strategy: `PROTECT-REPLAY / SEARCH-INTENT DISAMBIGUATION`.
- Baseline: GSC `CURRENT_GSC_ROW_ABSENT / GOOGLE_INDEX_NOT_CONFIRMED` for `2026-08-20~2026-09-16`; GA4 `90 views / 75 users / $0 / pageScore 66`; Naver `NAVER_NOT_PRIMARY`.
- Implementation preserves fixed 5.000-second `performance.now()` timing and the existing tolerance ladder (`±0.50`, `±0.30`, `±0.10`, `±0.05`, `±0.02`, then `±0.01`), inclusive boundary success, level progression, and `gameOver(diff)` compatibility. It adds signed `antes`/`tarde`/`exacto` result semantics, absolute error, local best error/level with safe `localStorage` fallback and explicit reset, replay, canonical sharing, verified Spanish related-game links, timing/latency trust copy, accessible controls/live result, reduced-motion CSS, privacy/ad-state copy, VideoGame-only JSON-LD, and removes schema-only FAQPage.
- Search identity is timer-specific: `Detén el cronómetro en 5 segundos – Juego de precisión online`; H1 and canonical/OG use the trailing-slash URL. Parent Spanish hub, sitemap, root English, and other 12 locales were not modified. ES stale batch policy now expects `2026-09-21`, VideoGame, and FAQPage absent while RU/CN exceptions and all other batch contracts remain unchanged.
- Validation so far: new `tests/test_es_stopat5.py` = `4 passed`; focused sixth batch and final RSS/other relevant tests remain pending. Production, Pages, runtime/mobile, Google inspection/submission, and RSS contract are pending review; status is `READY_FOR_REVIEW`, not `DONE`.

## 2026-09-21 — 12 · Spanish STOPat5 — MAIN CLOSURE
- Previous main: `77afc94a72402a88a559e682d7227c2b2e91a626`. Approved fresh chain integrated non-force: Core `d8de668c3cc7ea7bfe3e4f5e240a2b1cf41d787e`, RSS `f873c5eccdf9760eb0175191263162eaa235d476`, best-level correction `7d746eb0b60e28b094686630da3707a5cb70b01e`, and final behavioral coverage `ba59b108003c78e2000335d35953c410a2f082ac`. Current main before docs closure is `ba59b108003c78e2000335d35953c410a2f082ac`; closure commit follows.
- Product closure: timer-specific Spanish search identity, exact 5.000-second target, `performance.now()`, preserved tolerance ladder and inclusive boundary, signed `antes`/`tarde`/`exacto` result, independent best error/highest reached level, page-specific safe localStorage/reset/restart, canonical share and verified related games, browser timing/latency disclosure, VideoGame 1 / FAQPage 0, canonical/OG, no hreflang, GA4 `G-QP5Q67GE5B`, privacy/ad-disabled copy, and generated RSS page-metadata parity are current. Parent Spanish hub LadderGame omission and other locale audits remain out of scope.
- Verification: ES + sixth batch `9 passed`; actual Node execution covered target/tolerance, equality boundary, just-outside failure, direction/error, best error/level, malformed records, getItem/setItem/removeItem failures, reset key scope, and restart best preservation. `git diff --check` passed. Pages product run `35589224240` completed successfully for SHA `ba59b10800`; production served final title/H1, target/performance markers, record UI/storage key, related links, VideoGame 1 / FAQPage 0, canonical, and timing disclosure. Runtime/mobile deep checks are `RUNTIME_PARTIAL_NOT_VERIFIED` / `MOBILE_390_NOT_VERIFIED`; Google baseline `CURRENT_GSC_ROW_ABSENT / GOOGLE_INDEX_NOT_CONFIRMED`, URL Inspection unavailable, no submission; Naver `NAVER_NOT_PRIMARY`. Baseline GA4 remains `90 views / 75 users / $0`, pageScore `66`.
- Closure state: docs-only closure branch is `codex/es-12-stopat5-closure`; product main integration and Pages deployment are complete. Notion is `NOTION_CLOSURE_PENDING_CHATGPT`; 14/28/56-day index, GSC, engagement, and remaining STOPat5 locale follow-up remain.

## 2026-09-21 — 09 Vietnamese 16-Type Personality Quiz review
- Review branch `codex/vn-09-personality-quiz-20260921` only; scope is `/vn/game/MBTI/` plus the single Vietnamese game-hub card and the new focused test. Task 10 and `main` merge are not part of this execution.
- Implemented 20 original Vietnamese situational questions with 5 per E/I, S/N, T/F, J/P axis, strict-majority scoring, explicit 3:2 close-axis copy, deterministic retry, keyboard-focusable controls, independent quiz rebrand, visible MBTI® non-affiliation and entertainment/self-reflection boundary, four-field result profiles, privacy disclosure, no raw-answer telemetry, no AdSense, canonical/OG/sitemap preservation, and one WebApplication JSON-LD block. `FAQPage` is intentionally absent and no hreflang was added.
- Measurement context remains `GA4 50 views / 33 users / $0`, `CURRENT_GSC_ROW_ABSENT / GOOGLE_INDEX_NOT_CONFIRMED`, `NAVER_NOT_PRIMARY`, and `METADATA_NOT_IN_CURRENT_CONTRACT`; 13-locale blast radius was read-only and no other locale page was changed. Production, Pages deployment, runtime UI, and 390px mobile are pending review; Notion is `NOT_UPDATED_PENDING_REVIEW`.
- Validation: `tests/test_vn_mbti_page.py` + `tests/test_quick_personality_quiz.py` = 10 passed; `git diff --check` passed. Status is `READY_FOR_REVIEW`, not `DONE`.

## 2026-09-21 14:03 Keyword Hunter
- Seeds: 40; New: 40; Rejected: 27; DB: 2673; Errors: 1; Top: 퇴직소득세계산기. Report: reports/keyword-hunter/2026-09-21-1403.md

## 2026-09-21 — 13 · English Game Hub — REVIEW BRANCH
- Scope is only `/game/` on `codex/en-13-game-hub-20260921`; main merge, deployment, Notion write, child pages, other locale hubs, and task 14 are out of scope. Baseline was GSC `CURRENT_GSC_ROW_ABSENT / GOOGLE_INDEX_NOT_CONFIRMED`, GA4 `78 views / 25 users / $0 / pageScore 73`, and `NAVER_NOT_PRIMARY`.
- The review branch repairs the systemic directory omission: repo, sitemap, and hub inventory are contract-tested at 25 games with LadderGame included and no duplicate/ghost card. Cards are static full-card anchors with visible category labels, keyboard focus, exact category buttons, category/search intersection, and a polite empty state.
- Search identity now states free/no-download/no-login browser play; the former “for killing time” positioning and speculative claims are removed. MBTI is explicitly an independent personality quiz, not the official MBTI assessment. CollectionPage remains the sole schema; canonical/OG, GA4 `G-QP5Q67GE5B`, privacy meaning, and ads-disabled directory state are preserved.
- Child-to-hub recirculation remains a follow-up because multiple English child pages still link to `/`; child pages and `game/sitemap.xml` were not modified. RSS outcome is pending the clean-tree generator check; no manual feed edit is authorized. Focused tests and final review remain pending; status is `READY_FOR_REVIEW`, Notion `NOT_UPDATED_PENDING_REVIEW`.

## 2026-09-21 — 13 · English Game Hub — MAIN CLOSURE
- Previous main: `3f6bb6df66fc183bd496da9ea97b49c4c70722d7`. Approved five-commit chain integrated by non-force fast-forward: Core `72351c7ede`, RSS `3b1ac6b607`, Product correction `480a69b307`, Test hardening `9210099672`, and sitemap duplicate correction `eaf5f81d98`. Current product main is `eaf5f81d98e760db083a585052e2eff1b6f6601c`; force push: NO.
- Product closure: repo, sitemap, and hub are exactly 25 with raw and unique duplicate invariants, LadderGame present and accurately described as a pick-a-number ladder outcome, static full-card anchors, exact visible/data categories, category/search intersection, six typed buttons, search label, polite empty state, focus-visible states, and no parent navigation handler or global user-selection lock.
- Trust and discovery closure: title `Free Browser Games – No Download, No Login | QuickPlay`, one H1, independent/non-official MBTI wording, CollectionPage 1 / FAQPage 0 / ItemList 0, canonical/OG, `dateModified` `2026-09-21`, GA4 `G-QP5Q67GE5B`, visible ordinary page/device usage and ads-disabled copy, and exact RSS title/description/link/GUID/pubDate parity. Child pages and `game/sitemap.xml` were not modified; child-to-hub recirculation remains `CHILD_TO_HUB_RECIRCULATION_FOLLOW_UP_REQUIRED`.
- Verification and delivery: focused hub plus LadderGame suite `6 passed`; `git diff --check` passed. Pages run `35593108059` completed successfully for the integrated SHA. Production `https://emfls.github.io/game/` served the final title, one H1, 25 unique cards, and LadderGame. Category/search/intersection/no-result keyboard behavior and fixed 390px mobile are `RUNTIME_PARTIAL_NOT_VERIFIED` / `MOBILE_390_NOT_VERIFIED`; Google baseline remains `CURRENT_GSC_ROW_ABSENT / GOOGLE_INDEX_NOT_CONFIRMED`, URL Inspection unavailable, no submission; Naver `NAVER_NOT_PRIMARY`.
- Closure state: docs-only branch is `codex/en-13-game-hub-closure`; closure commit and main push follow after this record. Notion is `NOTION_CLOSURE_PENDING_CHATGPT`; 14/28/56-day index, GSC, usage, and recirculation checks remain.

## 2026-09-21 — 14 · Marble Flick — REVIEW BRANCH
- Scope is English `/game/MarbleFlick/` only on `codex/en-14-marbleflick-20260921`; task 15, main merge, Notion writes, other locale pages, the parent hub, and sitemap are out of scope. Baseline is GSC `16 impressions / 0 clicks / 0% CTR / average position 7.31`, interpreted as `INDEXED / LOW-SAMPLE PAGE-ONE SIGNAL`; GA4 is `2 views / 2 users / $0`; Google remains `NO_SUBMISSION`, Naver `NAVER_NOT_PRIMARY`.
- Search identity is frozen at `Marble Flick – Free Browser Marble Game for 2 Players or AI`. The English canary repairs stale AI generation callbacks with `gameVersion` validation, uses a shot settlement barrier for chained motion, derives winners from live counts, delays turn handoff until complete settlement, and removes terminal dependence on `lastSurvivorColor`.
- Product semantics now use one H1 game identity, logical guide H2, English `Home → Games → Marble Flick` breadcrumb parity, first-play drag/release guidance, typed mode buttons with `aria-pressed`, moving-state mode lock, canvas instructions, polite winner/turn status, touchcancel cleanup, rematch-compatible restart, and crawlable `/game/` navigation.
- Local replay canary adds page-specific AI-only W/L/D stats with malformed/storage-failure-safe defaults, single-count updates, reset scope, and visible local-only disclosure. VideoGame and BreadcrumbList remain the only JSON-LD types; FAQPage is absent. GA4 is retained, exact physics/AI/local-stat telemetry is not added, and AdSense remains disabled.
- RSS is pending the clean-tree generator check. Other locale Marble Flick pages remain untouched despite the known 13-locale blast radius; this is an English-only canary. Status is `READY_FOR_REVIEW`, Notion `NOT_UPDATED_PENDING_REVIEW`, and deployment/production/runtime/mobile/Google checks remain pending.

## 2026-09-21 — 14 · Marble Flick — MAIN CLOSURE
- Previous main: `db2b227fb5a70320c9585a669582a6a3f7be367a`. Approved four-commit chain integrated non-force fast-forward: Core `e8a92de868`, RSS `97021688c3`, browser initialization correction `7f82c3f5e7`, and async/storage correction `7dcfc1fd65`. Current product main is `7dcfc1fd65d300053438bc980c617e39bcbe0a8c`; force push: NO.
- Search and product closure: title remained `Marble Flick – Free Browser Marble Game for 2 Players or AI`; GSC baseline remains `16 impressions / 0 clicks / 0% CTR / average position 7.31`, interpreted as `INDEXED / LOW-SAMPLE PAGE-ONE SIGNAL`; GA4 baseline is `2 views / 2 users / $0`, with no new physics, AI-decision, or local-stats telemetry.
- Async correctness closure: generation-validated AI callbacks, mode/restart/round-over stale no-ops, stale collision callbacks that cannot poison a new round counter, reserved child-motion settlement barrier, live-count winner matrix, single winner/stats authority, and turn handoff only after complete settlement. AI-only local W/L/D stats use `emfls:game:marbleflick:v1`, tolerate malformed/get/set/remove storage failures, isolate 2P results, and reset only the page-specific key.
- Browser contract closure: stats DOM can be absent during main script parsing; initialization still reaches READY with Black turn and 8 pieces, then binds/render stats on DOMContentLoaded. The page has one game H1, `Home → Games → Marble Flick` breadcrumb parity, typed/pressed mode controls, moving-state disable, canvas instructions, polite winner/turn status, touchcancel cleanup, and crawlable `Browse all games` navigation. BreadcrumbList 1 / VideoGame 1 / FAQPage 0, canonical, `dateModified` `2026-09-21`, GA4, and AdSense-disabled state are current.
- Verification and delivery: focused MarbleFlick, GSC batch, and Korean legacy suite `12 passed`; `git diff --check` passed. Product Pages run `35596795290` completed successfully for `7dcfc1fd65`. Production `https://emfls.github.io/game/MarbleFlick/` served the exact title, one H1, Games breadcrumb, board, controls, instructions, local stats, and `/game/` links. Runtime deep play and fixed 390px mobile are `RUNTIME_PARTIAL_NOT_VERIFIED` / `MOBILE_390_NOT_VERIFIED`; Google baseline remains `INDEXED / LOW-SAMPLE PAGE-ONE SIGNAL`, URL Inspection unavailable, no submission; Naver `NAVER_NOT_PRIMARY`.
- Closure state: docs-only branch is `codex/en-14-marbleflick-closure`; closure commit and main push follow after this record. Other 12 locale pages, parent hub, sitemap, and hreflang remain unchanged; coordinated rollout is pending. Notion is `NOTION_CLOSURE_PENDING_CHATGPT`; 14-day ranking/state, 28-day GSC/replay, and 56-day search/replay checks remain.

## 2026-09-21 21:55 Keyword Hunter
- Seeds: 40; New: 41; Rejected: 26; DB: 2714; Errors: 0; Top: 임금계산기. Report: reports/keyword-hunter/2026-09-21-2155.md

## 2026-09-22 04:32 Keyword Hunter
- Seeds: 40; New: 20; Rejected: 19; DB: 2734; Errors: 0; Top: 몰디브리조트추천. Report: reports/keyword-hunter/2026-09-22-0432.md

## 2026-09-22 08:20 Keyword Hunter
- Seeds: 40; New: 61; Rejected: 51; DB: 2795; Errors: 1; Top: 신용회복위원회채무조정. Report: reports/keyword-hunter/2026-09-22-0820.md

## 2026-09-22 14:04 Keyword Hunter
- Seeds: 40; New: 0; Rejected: 0; DB: 2795; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-09-22-1404.md

## 2026-09-22 20:45 Keyword Hunter
- Seeds: 40; New: 60; Rejected: 47; DB: 2855; Errors: 1; Top: 자동차폐차가격. Report: reports/keyword-hunter/2026-09-22-2045.md

## 2026-09-23 02:01 Keyword Hunter
- Seeds: 40; New: 20; Rejected: 12; DB: 2875; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-09-23-0201.md

## 2026-09-23 06:23 Keyword Hunter
- Seeds: 40; New: 20; Rejected: 17; DB: 2895; Errors: 0; Top: 국가평생교육진흥원학점은행제. Report: reports/keyword-hunter/2026-09-23-0623.md

## 2026-09-23 09:38 Keyword Hunter
- Seeds: 40; New: 0; Rejected: 0; DB: 2895; Errors: 1; Top: none. Report: reports/keyword-hunter/2026-09-23-0938.md

## 2026-09-23 14:26 Keyword Hunter
- Seeds: 40; New: 40; Rejected: 29; DB: 2935; Errors: 0; Top: 타오바오배대지추천. Report: reports/keyword-hunter/2026-09-23-1426.md

## 2026-09-23 21:22 Keyword Hunter
- Seeds: 40; New: 102; Rejected: 80; DB: 3037; Errors: 0; Top: 전자세금계산서발급용인증서. Report: reports/keyword-hunter/2026-09-23-2122.md

## 2026-09-23 22:42 Keyword Hunter
- Seeds: 40; New: 60; Rejected: 48; DB: 3097; Errors: 0; Top: 해외구매대행쇼핑몰. Report: reports/keyword-hunter/2026-09-23-2242.md

## 2026-09-24 03:25 Keyword Hunter
- Seeds: 40; New: 0; Rejected: 0; DB: 3097; Errors: 0; Top: 세금계산서인증서. Report: reports/keyword-hunter/2026-09-24-0325.md

## 2026-09-24 06:12 Keyword Hunter
- Seeds: 40; New: 40; Rejected: 34; DB: 3137; Errors: 0; Top: 자동차폐차비용. Report: reports/keyword-hunter/2026-09-24-0612.md

## 2026-09-24 07:59 Keyword Hunter
- Seeds: 40; New: 40; Rejected: 33; DB: 3177; Errors: 0; Top: 호주워홀신청. Report: reports/keyword-hunter/2026-09-24-0759.md

## 2026-09-24 13:58 Keyword Hunter
- Seeds: 40; New: 20; Rejected: 16; DB: 3197; Errors: 0; Top: 자동차도색비용. Report: reports/keyword-hunter/2026-09-24-1358.md

## 2026-09-24 19:23 Keyword Hunter
- Seeds: 40; New: 7; Rejected: 6; DB: 3204; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-09-24-1923.md

## 2026-09-24 20:53 Keyword Hunter
- Seeds: 40; New: 0; Rejected: 0; DB: 3204; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-09-24-2053.md

## 2026-09-25 02:16 Keyword Hunter
- Seeds: 40; New: 6; Rejected: 5; DB: 3210; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-09-25-0216.md

## 2026-09-25 06:34 Keyword Hunter
- Seeds: 40; New: 41; Rejected: 35; DB: 3251; Errors: 0; Top: 중고차구매. Report: reports/keyword-hunter/2026-09-25-0634.md

## 2026-09-25 09:35 Keyword Hunter
- Seeds: 40; New: 20; Rejected: 16; DB: 3271; Errors: 0; Top: 중고차구매사이트. Report: reports/keyword-hunter/2026-09-25-0935.md

## 2026-09-25 16:54 Keyword Hunter
- Seeds: 40; New: 40; Rejected: 38; DB: 3311; Errors: 0; Top: 글램핑추천. Report: reports/keyword-hunter/2026-09-25-1654.md

## 2026-09-25 22:53 Keyword Hunter
- Seeds: 40; New: 20; Rejected: 17; DB: 3331; Errors: 0; Top: 캠핑장추천. Report: reports/keyword-hunter/2026-09-25-2253.md

## 2026-09-26 03:41 Keyword Hunter
- Seeds: 40; New: 129; Rejected: 107; DB: 3460; Errors: 0; Top: 아반떼중고차가격. Report: reports/keyword-hunter/2026-09-26-0341.md

## 2026-09-26 08:20 Keyword Hunter
- Seeds: 40; New: 56; Rejected: 43; DB: 3516; Errors: 1; Top: 개인회생신청비용. Report: reports/keyword-hunter/2026-09-26-0820.md

## 2026-09-26 14:06 Keyword Hunter
- Seeds: 40; New: 0; Rejected: 0; DB: 3516; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-09-26-1406.md

## 2026-09-26 20:30 Keyword Hunter
- Seeds: 40; New: 140; Rejected: 113; DB: 3656; Errors: 0; Top: 모닝중고차가격. Report: reports/keyword-hunter/2026-09-26-2030.md

## 2026-09-27 01:28 Keyword Hunter
- Seeds: 40; New: 60; Rejected: 54; DB: 3716; Errors: 0; Top: 가압류신청. Report: reports/keyword-hunter/2026-09-27-0128.md

## 2026-09-27 06:15 Keyword Hunter
- Seeds: 40; New: 28; Rejected: 21; DB: 3744; Errors: 0; Top: 사업소득계산기. Report: reports/keyword-hunter/2026-09-27-0615.md

## 2026-09-27 09:40 Keyword Hunter
- Seeds: 40; New: 20; Rejected: 16; DB: 3764; Errors: 0; Top: 연말정산계산기. Report: reports/keyword-hunter/2026-09-27-0940.md

## 2026-09-27 17:16 Keyword Hunter
- Seeds: 40; New: 22; Rejected: 6; DB: 3786; Errors: 0; Top: 월급일할계산. Report: reports/keyword-hunter/2026-09-27-1716.md

## 2026-09-27 23:05 Keyword Hunter
- Seeds: 40; New: 0; Rejected: 0; DB: 3786; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-09-27-2305.md

## 2026-09-28 03:28 Keyword Hunter
- Seeds: 40; New: 40; Rejected: 28; DB: 3826; Errors: 0; Top: 야간근로수당계산. Report: reports/keyword-hunter/2026-09-28-0328.md

## 2026-09-28 08:06 Keyword Hunter
- Seeds: 40; New: 40; Rejected: 21; DB: 3866; Errors: 1; Top: 휴일근무수당계산. Report: reports/keyword-hunter/2026-09-28-0806.md

## 2026-09-28 P0 Revenue Growth #23 — 1688 구매대행 공개 준비
- 최신 기준: `origin/main` `5d8bc85f9987b7fbe9ceebc735c8a2092413ab7e`; queue는 `1688구매대행` HIGH · 59.92 · `PAGE_REVIEW_READY` · `READY_TO_LAUNCH`, duplicate check passed. 현재 volume은 `NOT_AVAILABLE`; 3,740/month는 2026-09-14 historical evidence다. 일일 counter 날짜가 2026-09-13이어서 date-aware 정책 기준 2026-09-28 유효 사용량은 0/1이다.
- 새 canonical `/kor/column/1688gumaedaehaeng/`는 main에 없었고, Taobao forwarder 가이드는 인접 물류 intent로 판단해 별도 intent를 유지했다. 관세청 통관/예상세액, Safety Korea 품목별 안전 요건, WorldFirst 파트너 결제 안내를 구분해 연결했다. 고정 비용·환율·세율, 업체 순위/추천, 보편적 KC 주장, affiliate CTA는 없다.
- 현재 main에서 본문·칼럼 카드·`kor/sitemap.xml`·launch manifest·검색 index/home feed와 regression tests를 준비했다. blank worksheet는 0원으로 오인 표시하지 않도록 하고, 기존 GA4/AdSense 코드는 보존했다.
- CI root cause/fix: SEO QA `36364464129`는 generator 실행 후 mutable manifest를 읽은 #23 테스트와 #17의 historical launch를 latest manifest에 영구 고정한 테스트만 실패했다. `ea0600b299c936f20ce2919f73407968e706c45b`에서 #23은 committed HEAD manifest를 검증하고 #17은 durable page/discovery wiring만 검증하도록 수정했다. 다른 historical-current-manifest 결함은 추가 발견되지 않았다.
- 검증/전달: CI-like generation 후 focused tests 110, unittest 715, pytest 1,064, launch guard, `git diff --check` 모두 PASS. PR #15 HEAD `ea0600b299c936f20ce2919f73407968e706c45b` / base `5d8bc85f9987b7fbe9ceebc735c8a2092413ab7e`, 11 files, OPEN·mergeable. SEO QA `36373607848` COMPLETED/SUCCESS; 최신 main drift/overlap 없음. Queue는 1688 HIGH · 59.92 · `READY_TO_LAUNCH`; PR manifest는 2026-09-28 dailyLimit 1/1을 기록한다. PR은 미병합·production 미게시, Revenue `NO_CONCLUSION`; Sol 최종 검토 대기.

## 2026-09-28 14:30 Keyword Hunter
- Seeds: 40; New: 20; Rejected: 18; DB: 3886; Errors: 0; Top: 노무사비용. Report: reports/keyword-hunter/2026-09-28-1430.md

## 2026-09-28 P0 Support #25 — Published Content Dedupe Hardening
- 재현: main의 manifest는 `PUBLISHED`, candidate `keyword:1688구매대행`, URL `/kor/column/1688gumaedaehaeng/`, 1/1이지만 master row는 `NEW`, `published_keywords.json`에는 없음. 기존 CLI를 입력 데이터만 복사한 임시 root에서 실행했을 때 `1688구매대행`이 `READY_TO_LAUNCH`로 재등재되고 stale counter 때문에 `daily_limit=0`이었다.
- Root cause: queue 준비기가 final manifest를 dedupe union에 넣지 않았고 기존 URL 비교는 query만 제거해 trailing-slash/`index.html` alias를 놓쳤다. stale prior-date counter와 same-day published manifest usage도 결합하지 않았다.
- 수정: `content_launch_policy.py`에 conservative URL identity (same-site HTTPS only, query/fragment 제거, `/index.html` alias, `.html`·path case 보존), explicit `keyword:` candidate parser, final `PUBLISHED`/`LAUNCHED` manifest key helper를 추가했다. `prepare_keyword_launch.py`가 final manifest를 읽고 기존 registry/index와 union하며, KST same-day counter/manifest usage의 max를 daily limit에 적용한다. unknown candidate namespaces는 keyword로 변환하지 않지만 final same-day publication count에는 fail-closed로 반영한다.
- 회귀: 2026-09-28 안전한 임시 root CLI는 queue 0, `daily_limit=1` exclusion, #23 재등재 없음. 2026-09-29 pure preview는 #23 재등재/당일 슬롯 소비 없이 `글램핑장추천`을 `NEXT_DAY_QUEUE_PREVIEW`로만 반환; publication approval이 아니다. `published_keywords.json`, counter, manifest, decisions, content HTML, sitemap은 변경하지 않았다.
- Workflow guard는 그대로이며 publication state 4개와 `kor/**/*.html` 변경 차단을 회귀 테스트로 고정했다.
- Base: local cached `origin/main` `8f677d0572dd7d2cc326e616ef7b4e2c1b709302` (handoff SHA와 일치; live remote main은 DNS 오류로 확인 불가). Worktree/branch: `/private/tmp/emfls-p0-published-queue-dedupe` / `codex/p0-support-published-queue-dedupe-20260928`.
- 후속 리뷰에서 daily limit 대비 이미 사용한 슬롯만큼 큐 길이를 줄이지 않는 결함이 확인되어 `daily_limit - launched_count`로 남은 용량을 제한하고 회귀 2개를 추가했다. 독립 재검토 결과 추가 Critical/High/Important/Minor finding 없음. 2026-09-28 current queue는 0, 2026-09-29 preview는 #23 없이 `글램핑장추천` 1개다.
- Final review에서 manifest `runAt` 누락/무효 시 fail-closed 처리 공백을 확인해 merge 전에 보완했다. 최종 PR head `966d1a1e38c9d14b8367b97b9bde1f41db2adf62`; SEO QA `36501567865` SUCCESS. 최종 회귀: focused 40, unittest 715, pytest 1,108 모두 통과; content-launch guard와 `git diff --check` PASS.
- 전달/종결: PR #17 normal merge, merge SHA `c16677a74e3e2ef645d440cdfb044e1202f4c1fb`. Post-merge validation에서 #23 재등재 방지, `/route/`·`/route/index.html` alias dedupe, 9/28 manifest가 9/29 daily capacity를 소비하지 않아 slot이 available인 점을 확인했다. 9/29 queue 후보 `글램핑장추천`은 기존 전국 추천 콘텐츠와의 intent overlap 및 신뢰할 수 없는 `recovery:방염` lineage로 `CANNIBALIZATION_RISK`; 신규 페이지는 승인·발행하지 않았다. Revenue WIN은 주장하지 않는다.

## 2026-09-28 23:04 Keyword Hunter
- Seeds: 40; New: 40; Rejected: 30; DB: 3926; Errors: 0; Top: 연차수당계산. Report: reports/keyword-hunter/2026-09-28-2304.md

## 2026-09-29 05:35 Keyword Hunter
- Seeds: 40; New: 3; Rejected: 3; DB: 3929; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-09-29-0535.md

## 2026-09-29 11:02 Keyword Hunter
- Seeds: 40; New: 40; Rejected: 29; DB: 3969; Errors: 0; Top: 월급세후계산기. Report: reports/keyword-hunter/2026-09-29-1102.md

## 2026-09-29 P0 Safety — 기존 육아휴직·출산휴가 안내 YMYL 정확성 보정 (Task 2)
- 기존 `/kor/report/parenting/parenting-subsidy-2026.html`의 `육아휴직·출산휴가 급여` 단락만 현행 기준으로 정리했다. 일반 육아휴직급여 상한/비율, 조건부 6+6·한부모 특례, 사업주 휴직 신청과 고용24 급여 신청의 구분, 출산전후휴가와 보험급여 요건을 분리해 기술했다.
- 기준일은 시행령 전체 시행일 2026-09-18이며 일부 제11조·제13조 개정 조항만 2026-08-20 시행으로 구분했다. 배우자 출산휴가 링크와 회귀 테스트를 현행 공식 조문 URL `https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1000446318`로 맞췄다.
- 확인 근거: [근로기준법 제74조](https://law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsId=001872&lsJoLnkSeq=900552022&print=print), [고용노동부 1350 미숙아 안내](https://1350.moel.go.kr/rtmview.do?id=1000314298), [고용24 육아휴직급여](https://m.work24.go.kr/cm/c/f/1100/selecSystInfo.do?systClId=SC00000251&systId=SI00000402), [시행령 제11조](https://www.law.go.kr/lsLinkCommonInfo.do?lspttninfSeq=71235&chrClsCd=010202), [배우자 출산휴가 제18조의2](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1000446318). 고용24 일반 급여 페이지의 최종 수정 표시는 2025-09-15이며, 최종 확인일은 2026-09-29다.
- 후속 YMYL 리뷰의 단일 누락(제19조제6항 특례 육아휴직 7일 요건)을 보완했다. 현행 고용보험법 제70조제1항은 30일 일반 육아휴직 또는 출산전후휴가 중복기간을 뺀 특례 7일과 피보험단위기간 180일 요건을 둔다. 공식 [제70조제1항](https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1021698255)을 연결했다.
- Fix round 3: 고용보험법 제70조제1항에 맞춰 일반 30일과 특례 7일 각각에서 출산전후휴가 중복기간을 제외하고, 두 경로 모두 육아휴직 시작 전 피보험단위기간 합산 180일 이상이 필요함을 명확히 했다. 2026-08-20 일부 조항 시행일은 공식 [시행령 개정문·부칙](https://www.law.go.kr/lsInfoP.do?lsiSeq=288719&viewCls=lsRvsDocInfoR) 링크를 직접 연결했다.
- Fresh local QA: focused 5 passed; unittest 715 OK; pytest 1,113 passed. Content-launch guard CLI `--base-ref HEAD` PASS and explicit working-diff path validation PASS. Deterministic SEO audit: 19,091 pages, parser errors 0; SEO QA `failed=false`, 신규 critical/warning 0, 기존 800 critical/424 warnings. `git diff --check` PASS. 상세 명령/출력은 `.superpowers/sdd/2026-09-29-p0-parental-leave-ymyl-repair-and-prep/task-2-report.md`에 기록.
- 상태는 `YMYL_ACCURACY_REPAIR / REVIEW_PENDING`. Fix round 3 이후 독립 YMYL 재검토와 Task 2 재전달 게이트는 대기 중이며 PR/commit/push/merge는 하지 않았다. 신규 신청서 가이드는 계속 `PREP ONLY / NOT PUBLISHED`.

## 2026-09-30 01:32 Keyword Hunter
- Seeds: 40; New: 20; Rejected: 14; DB: 3989; Errors: 0; Top: 사실조회신청. Report: reports/keyword-hunter/2026-09-30-0132.md

## 2026-09-30 07:20 Keyword Hunter
- Seeds: 40; New: 60; Rejected: 41; DB: 4049; Errors: 0; Top: LG퓨리케어오브제컬렉션정수기. Report: reports/keyword-hunter/2026-09-30-0720.md

## 2026-09-30 14:38 Keyword Hunter
- Seeds: 40; New: 20; Rejected: 18; DB: 4069; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-09-30-1438.md

## 2026-09-30 21:42 Keyword Hunter
- Seeds: 40; New: 20; Rejected: 18; DB: 4089; Errors: 0; Top: 가을여행추천. Report: reports/keyword-hunter/2026-09-30-2142.md

## 2026-10-01 04:26 Keyword Hunter
- Seeds: 40; New: 40; Rejected: 35; DB: 4129; Errors: 0; Top: 가을여행지추천. Report: reports/keyword-hunter/2026-10-01-0426.md

## 2026-10-01 08:55 Keyword Hunter
- Seeds: 40; New: 60; Rejected: 49; DB: 4189; Errors: 0; Top: 10월여행지추천. Report: reports/keyword-hunter/2026-10-01-0855.md

## 2026-10-01 P0 Revenue Growth #26 — 육아휴직신청서양식 closure
- PR #24 normal merge: launch head `dc9760f9a9422766b3b04470364ec577024c83e9`, merge SHA `d7d220cf24e0500ed77dc8f91bfff1a6227ab201`, 9 changed files. Publication manifest records `2026-10-01T02:43:35+09:00`; 10/1 daily publication capacity is consumed (1/1).
- Exact post-merge evidence: SEO QA `36756262591` SUCCESS, Pages `36756260669` SUCCESS, IndexNow `36756262880` SUCCESS/accepted. On 2026-10-01, `https://emfls.github.io/kor/report/parenting/parental-leave-application-form-2026.html` and `https://emfls.github.io/kor/report/parenting/parenting-subsidy-2026.html` each returned HTTP 200. #26 is `TECHNICAL_DONE`; Revenue remains `NO_CONCLUSION`.
- PR #21 was closed without merge. Its original worktree remains preserved with four dirty tracked files; no reset/clean/delete was performed.
- New parental-leave application guide is now PUBLISHED through #26; the older PREP-only state is superseded by this verified launch. No second public launch is authorized for 2026-10-01.

## 2026-10-01 22:25 Keyword Hunter
- Seeds: 40; New: 21; Rejected: 15; DB: 4210; Errors: 0; Top: 원천세가산세계산기. Report: reports/keyword-hunter/2026-10-01-2225.md

## 2026-10-02 04:35 Keyword Hunter
- Seeds: 40; New: 0; Rejected: 0; DB: 4210; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-10-02-0435.md

## 2026-10-02 08:56 Keyword Hunter
- Seeds: 40; New: 61; Rejected: 49; DB: 4271; Errors: 0; Top: 퇴직금계산기준. Report: reports/keyword-hunter/2026-10-02-0856.md

## 2026-10-02 14:46 Keyword Hunter
- Seeds: 40; New: 20; Rejected: 20; DB: 4291; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-10-02-1446.md

## 2026-10-02 P0 Support — Keyword Hunter DataLab freshness audit
- Root cause: `score()` accepted numeric DataLab trend values without checking the configured 24-hour snapshot TTL; retained values from partial responses could also inherit a newly advanced shared `datalab_checked_at`. This could make stale trend evidence influence score validity, confidence, and candidate ordering.
- Minimal fix in isolated branch `codex/p0-keyword-datalab-freshness-20261002`: score only timestamped, timezone-aware, non-future trend snapshots within TTL; fail closed for stale/missing/invalid timestamps; do not advance freshness when a partial response retains an old trend metric. No content, publication manifest, or live API data changed.
- Validation on base `83346ac4441b19b1764816c75a099c49ac35c85e`: focused Keyword Hunter suites 64 passed, full unittest 730 passed, full pytest 1,164 passed, four focused stale/future/partial-refresh/dry-run regressions passed, `git diff --check` passed. Final PR #30 head `f40e47f68d08ea42154302bb51a44b72f1b30b1c`; exact-head SEO QA `36976818583` SUCCESS; focused 64, unittest 730, pytest 1,164, and `git diff --check` PASS. Sol code/CI review PASS.
- Candidate supply: freshness re-evaluation leaves no clearly evidenced low-maintenance non-YMYL candidate ready for new PREP; existing Incheon PREP remains the backup. October 2 publication capacity remains consumed 1/1; no second public page. Revenue remains `NO_CONCLUSION`.
- Delivery/closure: PR #30 NORMAL MERGE completed at `2026-10-02T08:08:35Z`, merge SHA `0bb519d6b8eb206997e238528bd8bd7e0d75b9ff`. Post-merge SEO QA run `36982375937` on the merge SHA completed SUCCESS; Keyword Hunter validation, unittest, full pytest, SEO regression, launch guard, and QA report upload all passed. `PR #30 = TECHNICAL_DONE`; `KEYWORD_HUNTER_DATALAB_FRESHNESS = FIXED_AND_VERIFIED`. No live Keyword Hunter collection, content/publication/manifest change, or second public page; publication capacity remains 1/1 consumed and Revenue remains `NO_CONCLUSION`.

## 2026-10-02 21:44 Keyword Hunter
- Seeds: 40; New: 0; Rejected: 0; DB: 4291; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-10-02-2144.md

## 2026-10-03 04:22 Keyword Hunter
- Seeds: 40; New: 20; Rejected: 18; DB: 4311; Errors: 1; Top: 강원도호텔추천. Report: reports/keyword-hunter/2026-10-03-0422.md

## 2026-10-03 08:50 Keyword Hunter
- Seeds: 40; New: 0; Rejected: 0; DB: 4311; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-10-03-0850.md

## 2026-10-03 P0 Revenue Growth — Camping CTR INCONCLUSIVE closure after PR #33
- **Source/base:** PR #33 merged at `255e4b543ec9c4d82988a6ad6fa5dc0541ccef4b`; post-merge SEO QA `37091881771` SUCCESS. New isolated branch `codex/p0-camping-ctr-inconclusive-closure-r2-20261003` starts cleanly from that exact base. Prior dirty worktree and its patch backup were preserved; original diff checksum remains `ae5984cb9040ac1fd7e6149019c538b7de38b0758ee5e245ce9daed0b98965ce`.
- **Experiment disposition:** Nonsan, Cheorwon, Uljin (`EXP-CAMP-{NONSAN,CHEORWON,ULJIN}-CTR-20260901`) are explicitly `status=result=INCONCLUSIVE`, reason `COMPARABLE_MATCHED_PERIOD_NAVER_DATA_UNAVAILABLE`. Baselines remain intact; `after` is absent. Exact-date matched Naver data was unavailable. Rolling UI counts Nonsan 1,998/162 and Cheorwon 4,583/169 have no absolute bounds and are non-verdict only; Uljin outside TOP 30 is `NOT_AVAILABLE`, never zero. Target HTML contamination is clean after the original experiment-start commit; no target page was edited in this closure.
- **Capacity and current evidence:** `OBSERVING` active count 3→0; available selector capacity 0→3. Fresh current checkout inventory: 19,030 audited pages, 19,027 indexable, parser errors 0; page-score and measurement output share `asOf=2026-10-03`. GA4 2026-09-04..2026-10-01, GSC 2026-09-02..2026-09-29, Naver snapshot 2026-08-19..2026-09-17 (`STALE_DATA`, `PERIOD_MISMATCH`). Measurement validator PASS at 19,027 URLs.
- **Revenue outputs:** WINNER 1,568 / OPPORTUNITY 35 / EXPERIMENT 0 / INSUFFICIENT_DATA 17,424; selector proposes three improvements, not three running experiments. Reviewed `/util/url-encoder/` (58 GSC impressions, 0 clicks; GA4 3 views) and `/kor/report/travel/sweden-malmo.html` (12, 0; 1 view): both too low-sample for edits and no specific snippet mismatch established. `/kor/report/visa/singapore.html` (102, 1 click; 4 views) is immigration/YMYL and excluded. Per-URL AdSense remains `NOT_CONNECTED`; no GA4 revenue was relabeled as AdSense. Actual content edits: 0; Revenue `NO_CONCLUSION`.
- **Verification:** focused camping/revenue/policy suite 67 passed; unittest 742 passed; full pytest 1,183 passed; content launch guard PASS; measurement validator PASS; `git diff --check` PASS. Fresh-generated artifacts include page scores, page performance, revenue opportunities and report. Local delivery still pending: no commit/push/PR or remote exact-head SEO QA yet. TASKS remains unchecked until remote gates pass.
- **Publication:** additional public pages = 0. No public content, sitemap, hub, manifest, IndexNow, or protected page changes.
- **Next:** re-fetch latest main, inspect final file scope and all generated diffs, verify the original dirty worktree checksum again, then commit/push and open a separate PR only if no drift/contract issue exists; leave it unmerged pending fresh exact-head SEO QA.

## 2026-10-03 14:24 Keyword Hunter
- Seeds: 40; New: 11; Rejected: 11; DB: 4322; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-10-03-1424.md

## 2026-10-03 P0 Revenue Growth — Camping CTR closure FINAL
- PR #35 normal merged; merge SHA `0156625d002654271046b20b7c874ea328d071d2`.
- Post-merge SEO QA `37095932102` completed SUCCESS, including launch guard, SEO regression, Keyword Hunter validation, unittest, and full pytest.
- Nonsan, Cheorwon, and Uljin CTR experiments remain terminal `INCONCLUSIVE` because comparable matched-period Naver data was unavailable; no after-period values were fabricated.
- Active experiment slots 3→0; selector capacity reopened 0→3.
- Manual review produced 0 actionable content edits; additional public pages 0. No camping HTML, public content, sitemap, manifest, or IndexNow changes.
- Revenue remains `NO_CONCLUSION`; TASKS closure complete.

## 2026-10-03 20:45 Keyword Hunter
- Seeds: 40; New: 20; Rejected: 18; DB: 4342; Errors: 0; Top: 법원자동차경매사이트. Report: reports/keyword-hunter/2026-10-03-2045.md

## 2026-10-04 01:26 Keyword Hunter
- Seeds: 40; New: 0; Rejected: 0; DB: 4342; Errors: 1; Top: none. Report: reports/keyword-hunter/2026-10-04-0126.md

## 2026-10-04 06:22 Keyword Hunter
- Seeds: 40; New: 10; Rejected: 5; DB: 4352; Errors: 0; Top: 중고차추천. Report: reports/keyword-hunter/2026-10-04-0622.md

## 2026-10-04 09:42 Keyword Hunter
- Seeds: 40; New: 0; Rejected: 0; DB: 4352; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-10-04-0942.md

## 2026-10-04 17:30 Keyword Hunter
- Seeds: 40; New: 0; Rejected: 0; DB: 4352; Errors: 0; Top: none. Report: reports/keyword-hunter/2026-10-04-1730.md

## 2026-10-05 00:24 Keyword Hunter
- Seeds: 40; New: 100; Rejected: 86; DB: 4452; Errors: 1; Top: 정수기가격. Report: reports/keyword-hunter/2026-10-05-0024.md

## 2026-10-05 04:41 Keyword Hunter
- Seeds: 40; New: 80; Rejected: 69; DB: 4532; Errors: 0; Top: 정수기구매. Report: reports/keyword-hunter/2026-10-05-0441.md

## 2026-10-05 P0 Daily Publication Cap 1→3 — C01
- **Base/scope:** isolated branch `codex/c01-daily-publication-cap-3` from fetched `origin/main` `a4845bc5a12d5b442279599de4c3abd9313e9fa0`. Centralized the cap at 3 for keyword and external launch planning, aligned protocol defaults and KST-day reporting, and retained max-of-current-day accounting across valid counter/manifest/experiment evidence. Quality, duplicate, YMYL/HOLD, and launch-guard rules are unchanged.
- **Root cause:** keyword planning inherited a stale `dailyLimit: 1` from the persisted counter; external READY planning had no daily cap; protocol defaults also retained 1. Revenue reporting grouped some publication timestamps by UTC date rather than KST.
- **Current-day evidence:** KST 2026-10-05 manifest records Keyboard Cleaning as already `PUBLISHED` once. Policy preview reports `dailyLimit=3`, `publishedToday=1`, `remainingCapacity=2`. Historical manifest fields remain untouched; counter, queue, experiment registry, page content, and actual publications were not changed (new publications: 0).
- **Verification:** focused launch/policy/protocol/manifest/queue/guard and related suites 184 passed; unittest 752 passed; full pytest 1,228 passed; launch guard PASS; SEO QA reports 0 new critical and 0 new warnings (767/420 current); `git diff --check` PASS. Production browser verification was unavailable under the browser's enforced policy; no live-page or deployment claim is made.
- **Delivery/status:** PR #42 OPEN at `https://github.com/emfls/emfls.github.io/pull/42`; current head is available from GitHub. Reviewed-head SEO QA run `37252047585` failed; see the C01 follow-up below. Do not merge or publish additional content before Control Tower review.

## 2026-10-05 C01 PR #42 blocker repair
- **CI test isolation:** run `37252047585` regenerated `data/content-launch-manifest.json` before pytest, so the Keyboard Cleaning regression test's read of the repository artifact and assertion on its run ID failed (`1 failed, 1,227 passed`). Replaced that mutable read with an explicit test-local PUBLISHED manifest fixture; the test still verifies KST date 2026-10-05, one Keyboard Cleaning publication, cap 3, two remaining slots, and unchanged fixture history.
- **Hard-cap accounting:** removed `resetAt` filtering from the external selector's KST-day publication count. Same-day reset can no longer erase launched records; count is preserved above the cap when inconsistent history reports more than 3. Added coverage for 2 publications across reset (remaining 1), 3 across reset (remaining 0), 4 inconsistent same-day records (count 4, queue 0), previous KST-day records (count 0), and UTC timestamps crossing KST midnight.
- **Verification:** original failing test passed; required launch/policy/protocol test files 86 passed; focused launch suite 187 passed; unittest 752 passed; full pytest 1,231 passed; launch guard PASS; SEO QA 0 new critical/warnings (767/420 current); `git diff --check` PASS.
- **Data/safety:** no content publication or edits to manifest, counter, queue, or experiments. YMYL/HOLD, duplicate, and quality gates unchanged.
- **Delivery:** fixes are for the existing PR #42; exact-head Actions on the pushed repair commit are the remaining gate. PR stays open and unmerged.

## 2026-10-05 C06 PR #43 Control Tower blocker repair
- **Sync/scope:** regular merge of `origin/main` `d164597201db0783125ea9412f1050905ee09087` into `codex/c06-direct-adsense-ingestion`; C01 `DAILY_PUBLICATION_LIMIT = 3` verified intact. No rebase, force push, content/publication edit, content launch policy edit, or AdSense credential setup.
- **Guard:** only `A` for `.github/workflows/adsense-collection.yml` and `scripts/collect_adsense_snapshot.py` is approved; both future `M` transitions, unknown AdSense additions, ad placement paths, and protected HTML remain blocked. Existing GA4 workflow exception is unchanged.
- **Workflows:** GA4/GSC/AdSense share `site-measurement-collection` with `cancel-in-progress: false` and GitHub Actions `queue: max`. AdSense runs at 01:47 UTC before GA4 02:17 and GSC 02:47, validates and commits only `data/performance/adsense-latest.json`; `revenue_growth.py` consumes that latest path by default.
- **Scoring:** GA4 `totalAdRevenue` remains the scoring source when periods differ; direct AdSense can score only when both verified periods match exactly. Mismatched/no-baseline direct earnings remain supplemental and positive earnings protect the URL. Missing PAGE_URL rows remain `NOT_AVAILABLE`; partial/truncated coverage does not turn missing rows into zero.
- **Verification:** focused 78 passed; unittest 780 passed; pytest 1,261 passed; fresh SEO QA reported `failed=false`, `new_critical=[]`, `new_warnings=[]`; content launch guard against `origin/main` PASS; three workflow YAML files parse; `git diff --check` PASS. Earlier reviewed-head SEO QA run `37254634415` failed in `Guard automated content launch changes` with `MONETIZATION_OR_ANALYTICS_CHANGED`.
- **Delivery:** code head `9aed5a2620652fffbbd89437f334107b8d00c9ea` passed exact-head SEO QA run `37263916073` (SUCCESS). Existing PR #43 remains open and unmerged pending Control Tower re-review. Live AdSense run is `NOT_EXECUTED_MISSING_CREDENTIALS`; C07 is not started.

## 2026-10-05 C06 AdSense HTTP 400 stage diagnostics
- **Source/evidence:** PR #43 was merged as `937e8eb256a5921c6b212dc4ebc0c6ac5afe1b18`; latest fetched `origin/main` was `cfc4b2119fe9a98c8d7cc40e74dba743b5b4ccd8`. AdSense workflow run `37280801144` failed with HTTP 400 and no stage. The user verified a fresh refresh using the same OAuth client and refresh token in OAuth Playground; the exact failed API stage remains unknown.
- **Change:** `scripts/collect_adsense_snapshot.py` now attaches `OAUTH_REFRESH`, `ACCOUNT_GET`, `SITE_CURRENT_REPORT`, `SITE_PRIOR_REPORT`, or `PAGE_URL_REPORT` to request errors. It parses only the Google JSON error envelope, sanitizes status/message, redacts credentials, Bearer values, publisher IDs, URL/query material, and falls back to stage plus HTTP code for malformed or unexpected bodies. Request construction and success behavior are unchanged.
- **Guard:** the new narrow collector transition is `94f34228ed8b10213085b3de19bbab14e4fee0de` → `83595861b3ea484b7fd9ad0c7fb11515f6516692`; the guard calculates both blob IDs. Other collector changes, workflow modifications, unknown AdSense files, and ad-placement changes remain blocked. GA4 exception is unchanged.
- **Verification:** diagnostic tests 3 passed; collector 22; content launch guard 25; revenue/source 38; unittest 783; pytest 1,266; SEO QA `failed=false` with 0 new critical/warnings (767/420 current); guard against latest `origin/main` PASS; 3 workflow YAML files parse; `git diff --check` and secret-pattern scan PASS. `data/performance/adsense-latest.json` remains absent; tracked derived data and content are unchanged.
- **Delivery/safety:** implementation commit `dccbf21840be4d0f9df042ca4aa9da22d48d9f29` on `codex/c06-adsense-stage-diagnostics`. This is diagnostic-only; no credentials or workflow were changed, no live AdSense run was dispatched, and C07 remains waiting. Keep the hotfix unmerged until Control Tower review; then follow the separately authorized single-canary gate.

## 2026-10-05 C14 StockWiki placeholder-ad source/build regression prevention
- **Source/scope:** fetched `origin/main` in the isolated clone; latest SHA is `93cfd4e48d20a2b012c7b4610929be9f167bcff3`, matching the supplied C11 checkpoint. The original checkout on `codex/en-14-marbleflick-closure` was left unchanged.
- **Root cause/change:** `kor/stockwiki/src/components/AdSlot.astro` emitted placeholder AdSense/Coupang markup and was imported by the home and ticker pages. `StockLayout.astro` emitted a fixed-bottom placeholder and added mobile-only bottom padding. Removed the component, imports/render sites, fixed container, and ad-only styles. Added source, served-page, content/navigation, and fresh-dist regression checks; `update-stocks.yml` now runs the safety tests after build and before copy/commit. The existing cleanup utility remains as a defensive idempotent tool.
- **Ads/content:** no production publisher or slot IDs, advertising scripts, stock data, financial calculations, navigation, canonical/disclaimer semantics, sitemap semantics, or generated served files were changed. Ads remain disabled; revenue remains `REVENUE_UNPROVEN`.
- **Verification:** the new source/layout checks failed against the original source, then the focused safety suite passed (5 passed; fresh-dist check skipped before a build). Full unittest: 787 run, 1 skipped. Full pytest: 1,269 passed, 1 skipped. SEO QA: 0 new criticals / 0 new warnings (767 / 420 existing). Content Launch Guard PASS; workflow YAML parse PASS; `git diff --check` PASS.
- **Build blocker:** `npm ci` stopped because the package manifest and lock disagree (`sitemap@9.0.1` does not satisfy the required `sitemap@7.1.3`; npm also reports missing lock entries). The configured build calls `scripts/gen_sitemap.js`, which is absent from latest main. The fresh Astro build, dist marker scan, page inventory, and mobile viewport QA are therefore `NOT_RUN`. No lockfile or sitemap-generator changes were made because they exceed the C14 file scope and could affect sitemap semantics.
- **Delivery:** branch `codex/c14-stockwiki-ad-regression`, based on `93cfd4e48d20a2b012c7b4610929be9f167bcff3`. Keep unmerged until the build prerequisites are resolved, the build-output guard runs, and exact-head CI plus Control Tower review are recorded.

## 2026-10-05 C16 — Three Utility Sitemap Coverage Repair
- **Source/scope:** fetched `origin/main` `93cfd4e48d20a2b012c7b4610929be9f167bcff3`, matching the C10-approved checkpoint in the [Control Tower handoff](https://app.notion.com/p/3f0db4c0a991816a9cb1e60905affb24?pvs=204). The three target pages existed with `index,follow` and self-canonicals but were absent from `kor/sitemap.xml`; C10 analysis was not repeated.
- **Change:** added exactly the three canonical URLs for Japan travel packing, Japan eSIM data, and camping packing to `kor/sitemap.xml`. No `lastmod` was assigned. Page HTML, root sitemap index, content index, measurement artifacts, and publication state were not changed.
- **Verification:** regression RED on missing URL membership, then GREEN (2); related sitemap/canonical/SEO tests 15 passed; unittest 785 passed; pytest 1,268 passed; sitemap audit found 46 indexed leaf sitemaps, 18,711 URL entries, no duplicates or invalid XML; SEO QA had no new critical/warning regressions; content launch guard and XML parsing passed. The audit's one unknown inventory URL, `/kor/report/it/keyboard-cleaning-guide.html`, is identical on the base and repaired sitemap and remains out of scope.
- **Handoff:** local implementation is ready for exact-head CI and Control Tower review on `codex/c16-three-utility-sitemap-repair`. Do not merge before Control Tower review.

## 2026-10-06 C20 — StockWiki Build Integrity
- **Source/scope:** began from local `origin/main` and GitHub SHA `97ed941bf1276f5f5d102f25265576227937ccc7`; before PR creation, fetched and normally merged main commits `03f49d071e4657e4b6a3ae6b1127449ab5bf0faf` and `6d45375651b2cb9e78fbec3b29c6c11281a80faa`. After the PR's initial exact-head proof, fetched and normally merged latest main `a7ea9bfc14ba6a52b4bdd021aa9232bbb76d0443` (PR #48), which updates Keyword Hunter persistence files and shared history without changing StockWiki source. Canonical host resolved to `https://emfls.github.io`. C20 changes remain limited to StockWiki canonical/build config, public robots, read-only root QA workflow, regression tests, and this handoff record; no ad source or served generated files changed.
- **Change:** corrected Astro `site`, added route-derived canonical output, removed the nonexistent sitemap generator from the build and the unused direct `sitemap` dependency through npm, and pointed `public/robots.txt` at the separately tracked `sitemap.xml`. Added path-scoped PR/workflow-dispatch CI with `contents: read` and no schedule, push, or deployment.
- **Build proof:** TDD regression was RED on the original host, lock mismatch, missing canonical, generator call, robots path, CI workflow, and absent dist. `npm ci` and `npm run build` then succeeded. The build generated the 11 production routes plus the existing `/test/` fixture; all production canonicals exactly match their self URLs, the sitemap remains 11 `github.io` routes, and Pagefind indexed 11 pages.
- **Verification:** after refreshing main, C20 build-integrity + StockWiki output-safety tests 12 passed; canonical inventory 2 passed; unittest 807 passed (one build-output assertion skipped after generated artifacts were cleaned); full pytest 1,290 passed (one skip); SEO QA has zero new criticals/warnings (767/420 current baseline); content-launch guard, workflow YAML parse, and `git diff --check` passed.
- **Finding/delivery:** `STOCKWIKI_BASE_PATH_DEFECT_CONFIRMED` for `/kor/stockwikifavicon.ico` and `/kor/stockwikipagefind/...`; it does not block the build and remains outside scope. Latest main `a7ea9bfc14ba6a52b4bdd021aa9232bbb76d0443` is included and the shared history conflict was resolved with both records retained. PR #51 was created OPEN / unmerged. At prior head `a7a262e198ff740b5563a23d9df6896508e1054c`, exact-head StockWiki Build QA run `37392597208` and SEO QA run `37392597350` succeeded against base `6d45375651b2cb9e78fbec3b29c6c11281a80faa`. The latest-main sync moves the PR head; verify both required checks again on the resulting head before Control Tower review. No deployment has been performed.
## 2026-10-06 C24 — StockWiki Base-Path Asset Repair
- **Base/gate:** C20 PR #51 was confirmed merged. `git fetch origin` then `git rev-parse origin/main` gave `3214c1a3cc388534d9f322c978bb31387cdf9ffd`. While C24 was in progress, main advanced through PR #50 to `489df99ea81f51833d36d27ee09c8190c8443236`; GitHub API confirmed that SHA, and it was normally merged into the C24 branch before delivery. Work is isolated on `codex/c24-stockwiki-base-path-repair`; the unrelated checkout and other worktrees were left untouched.
- **Reproduction/root cause:** a fresh post-C20 `npm ci` / `npm run build` emitted `/kor/stockwikifavicon.ico` and `/kor/stockwikipagefind/pagefind-ui.css` on all 12 generated HTML pages. Astro's `import.meta.env.BASE_URL` was slashless, and the layout concatenated it directly with both asset names.
- **Change/scope:** added a slash-terminated asset base for the favicon and Pagefind stylesheet only. Added a generated-output regression test covering the exact malformed paths, required prefixes, and root-relative asset inventory. Canonical generation, navigation, sitemap, production routes, ad markup/policy, and served generated files were not edited.
- **Verification:** regression RED on the post-C20 build, then GREEN after repair. Final `npm ci` / `npm run build` generated 12 HTML pages and indexed 11 Pagefind pages. Fresh dist inventory: 12 correct favicon refs, 12 correct Pagefind refs, 12 canonicals, 0 malformed assets, and 0 retired-host references. Canonical inventory 2 passed before build; post-build StockWiki Build QA tests 13 passed; unittest 808 tests (2 skipped); full pytest 1,330 passed (2 skipped); SEO QA had no new criticals/warnings (767/420 current); content launch guard PASS; relevant workflow YAML parse PASS; `git diff --check` PASS. Generated `dist/` and `node_modules/` remain ignored and are not staged.
- **Handoff:** PR creation and exact-head CI are pending on this branch based on current main `489df99ea81f51833d36d27ee09c8190c8443236`. Use title `fix: repair StockWiki base-path asset URLs`; do not merge or deploy. Return exact-head CI to Control Tower.

## 2026-10-06 C06 stage-aware AdSense report parser repair
- **Baseline/evidence:** PR #46 was regular-merged as `9a83870428d6cf8b026de728dd9c3aabf3491b1e`; approved head `5eb3f2c828ce6f4979ef8757e266b0fbf68dd1e0` is a merge parent and its collector blob is `2f4890e73ae705c5347b3755c5fb4ef47ca23e2b`. `DAILY_PUBLICATION_LIMIT = 3` remains on main. The single authorized post-merge canary was run once as `37373852773` and failed at `Collect direct AdSense latest snapshot` with safe text `AdSense report rows are unavailable.` No HTTP or Google API status was present, so the failed report endpoint is unknown. No rerun.
- **Repair:** report parsing now labels structural failures for current site, prior site, and PAGE_URL responses. A missing `rows` key becomes an empty list; a present non-list remains a hard parse error. Empty current/prior site reports fail explicitly before snapshot construction, even with zero totals. Empty PAGE_URL results remain successful `PARTIAL` evidence with zero returned rows, null unknown matched count, and no inferred URL metrics. Existing snapshot preservation is regression-tested. Exact PAGE_URL HTTP 400 fallback and hard-fail behavior for other statuses remain unchanged.
- **Guard/scope:** added exactly one collector blob transition `2f4890e73ae705c5347b3755c5fb4ef47ca23e2b` → `7e462d5e1ccedfba022594d98cabf4aa3697ca01`. No workflow, credential, snapshot, derived data, or content changes; no live AdSense dispatch.
- **Verification:** focused AdSense/launch-guard/revenue-source/policy suites 116 passed; unittest 795 passed; pytest 1,279 passed; SEO QA `failed=false`, no new critical/warnings (767/420 current); launch guard against `origin/main` PASS; all three measurement workflow YAML files parse; `git diff --check` and secret-pattern scan PASS.
- **Sync:** regular-merged latest `origin/main` `97ed941bf1276f5f5d102f25265576227937ccc7` in merge commit `dc9bb64bfe064568b4d321fd1b74dda3869cf92f` (main is second parent). Only `PROJECT_HISTORY.md` conflicted; C16 sitemap/test/history and C06 parser/history records were both preserved. No C06 code conflict.
- **Post-sync verification:** focused AdSense/guard/revenue-source/policy and C16 sitemap tests 118 passed; unittest 797 passed; pytest 1,281 passed; SEO QA `failed=false` with no new criticals/warnings (767/420 existing); content launch guard against latest `origin/main` PASS; three measurement workflow YAML files parse; `git diff --check` and secret-pattern scan PASS. Collector blob remains `7e462d5e1ccedfba022594d98cabf4aa3697ca01`, and the exact approved transition from `2f4890e73ae705c5347b3755c5fb4ef47ca23e2b` remains the only newly added allowlist entry.
- **Delivery/status:** implementation commit `2d3237f3d6f839a7f5605f99c95bc3817269bc3a` plus sync commit `dc9bb64bfe064568b4d321fd1b74dda3869cf92f` on `codex/c06-report-parser-stages`; PR #49 remains OPEN and unmerged. Prior exact-head run `37378217157` passed on the pre-sync head; updated branch needs a fresh exact-head CI after push. Do not start C07 or dispatch AdSense; final merge authorization remains with Control Tower.

## 2026-10-06 C13 Keyword Hunter report persistence
- Broad timestamp reports remain generated and uploaded as Actions artifacts with 30-day retention; future broad reports are excluded from measured-state Git staging and guarded against accidental staging. Existing historical reports, Keyword Hunter state, and targeted-validation persistence remain intact. Future history labels the report as artifact-only.

## 2026-10-06 C17 Site-wide matched-period GSC page×query evidence
- **Base/scope:** Started from `origin/main` `9a83870428d6cf8b026de728dd9c3aabf3491b1e` in a sparse worktree; normally merged updated bases `97ed941bf1276f5f5d102f25265576227937ccc7` after PR #45, `6d45375651b2cb9e78fbec3b29c6c11281a80faa` after PR #49, and `a7ea9bfc14ba6a52b4bdd021aa9232bbb76d0443` after PR #48 advanced main. Included only C17 collector/workflow/test and handoff paths plus required individual workflow files; the populated checkout is 3.6 MB. No active C13/C14/C16 worktree was touched.
- **Collector:** Added a separate site-wide collector using the exact VERIFIED page snapshot period `2026-09-05`–`2026-10-02`, property `https://emfls.github.io/`, web search type, and finalized data semantics. It requests `[page, query]` without filters, paginates with `rowLimit=25000` and `startRow`, validates all source metrics, preserves exact API page URLs, and fails on malformed or repeated rows. A 20-page manual-run safety ceiling is explicit in pagination metadata.
- **Completeness/output:** Output is `PARTIAL_TOP_ROWS` with `completenessGuaranteed=false`; missing query or page-query rows are not treated as zero demand or impressions. The raw JSON is written to `$RUNNER_TEMP` and uploaded with seven-day retention; no raw export is tracked or committed. The new workflow mode is manual-only; page, opportunity-query, and camping-query behavior remains scoped as before.
- **Verification:** Local focused GSC, opportunity-query, camping-query, workflow-input, and measurement-validator suites: 90 passed; GSC workflow YAML parsed, Python syntax parsed, and `git diff --check` passed. Exact-head SEO QA run `37378265332` on implementation commit `702c799dab9951002a6dbeec873b5fb6495a9ef9` passed (unittest 791; pytest 1,310 plus 515 subtests). After merging updated base `97ed941bf1276f5f5d102f25265576227937ccc7`, exact-head run `37387487374` passed on merge commit `abe68d27d8d935efa3be11c5b663b046e27a388d`, including content launch guard, SEO regression, measurement validation, Keyword Hunter, full unittest (793), and full pytest (1,312 passed; 518 subtests passed). This run is historical verification for its named merge head; use the latest PR head check as the Control Tower gate. No live GSC request, content change, revenue change, or publication change was made.
- **Sequencing:** PR #50 is open and unmerged. C07 must remain blocked from overlapping GSC workflow write work until C17 is merged or abandoned. Control Tower review follows passing exact-head CI on the latest PR head; do not merge or dispatch a live collection before review.

## 2026-10-06 C14 — Reopened after C20 merge
- **Sync:** fetched latest `origin/main` `489df99ea81f51833d36d27ee09c8190c8443236` (C20 merge `3214c1a3cc388534d9f322c978bb31387cdf9ffd` is an ancestor) and normally merged it as `2f6106ac3a`. The history conflict retained both sides. C20 route-derived self canonicals remain in `StockLayout.astro` alongside C14's ad removal. The inactive nested `kor/stockwiki/.github/workflows/update-stocks.yml` is restored byte-for-byte from latest main; root `.github/workflows/stockwiki-build-qa.yml` remains the active StockWiki QA workflow.
- **Build/output:** `npm ci` and `npm run build` PASS. The build emitted 11 production routes plus the existing `/test/` fixture and Pagefind indexed 11 pages. C14 ad safety: 6 passed; C20 integrity: 10 passed; canonical inventory: 2 passed against tracked source. A fresh-dist scan found none of `adsbygoogle`, `ca-pub-XXXXXXXXXXXXXXXX`, `data-ad-slot`, `ads-partners.coupang.com`, `AF_XXXXXXXX`, or `mobile-ad-fixed`; generated production routes have their expected self canonicals.
- **Verification:** full unittest: 811 passed, 2 skipped; full pytest: 1,333 passed, 2 skipped. The two complete-suite runs used the tracked-source view because the repository-wide canonical inventory includes ignored build and dependency HTML; the fresh-build C14/C20 output tests separately ran with `dist` present and passed without skips. SEO QA: no new criticals or warnings (767/420 existing); content launch guard, YAML parse, and `git diff --check` PASS.
- **Finding/delivery:** C20's malformed `/kor/stockwikifavicon.ico` and `/kor/stockwikipagefind/...` paths still reproduce in generated pages and were not changed. PR #47 remains the delivery vehicle; after pushing this sync, obtain successful exact-head StockWiki Build QA and SEO QA, then wait for Control Tower review. Merge is not authorized.

## 2026-10-06 C07 — Derived Measurement Publisher Consolidation
- **Authorization/base:** User approved the C07 design for implementation. C06 PR #49 is merged as `03f49d071e4657e4b6a3ae6b1127449ab5bf0faf`; C17 PR #50 is merged as `489df99ea81f51833d36d27ee09c8190c8443236` and its live artifact review is complete. Rechecked GitHub main at `70f0374380a85d214e91b3292871eeee19c946f6` and included it with a normal merge (`347d38cc32626978a7a1e4c72a2aaa5fccc7e833`) on `codex/c07-derived-measurement-publisher`; no rebase or history rewrite.
- **Change:** GA4 and scheduled/page-mode GSC workflows now commit only their respective latest source snapshots. Added one scheduled derived publisher at 03:17 UTC using the existing `site-measurement-collection` queue, with no external analytics requests. It validates tracked GA4/GSC/AdSense inputs first, builds temporary audit/page scores and derived outputs, validates them, then promotes only `data/page-performance.json`, `data/revenue-opportunities.json`, and `reports/revenue-growth-report.md`. Promotion stages and backs up all three targets before replacing any, preserving last-good outputs on missing generated files or a failed replacement. C17 manual sitewide-query and existing GSC sidecars remain unchanged.
- **Source/measurement semantics:** freshness checks use the existing GA4 seven-day rule, GSC's 28-day window ending three days before local `as_of`, and AdSense's seven-day current/prior periods ending yesterday. AdSense `PARTIAL` plus `comparisonStatus=VERIFIED` stays explicit; zero PAGE_URL rows do not become URL zeros or allocated site earnings. Mature content wins count canonical `SUCCESS` results. Normalized GA4 `/index.html` aliases aggregate additive metrics while users remain null.
- **Regression proof:** TDD tests were first run red for the new validator/promotion modules, then passed after implementation. Measurement, source collector, C17 and sidecar, artifact validator, AdSense, revenue integration, workflow, and promotion suites: 143 passed. Unittest: 819 passed, 3 skipped. Pytest: 1,338 passed, 3 skipped. SEO QA: 0 new criticals/warnings (767/420 existing); Python syntax, three workflow YAML files, and `git diff --check` passed.
- **Generated-output check:** rebuilt temporary audit and page scores, generated temporary derived artifacts, and passed `validate_measurement_artifact.py` on 18,929 pages. Raw GA4 alias rows reconciled to date-calculator (6 views) and retirement-withdrawal (6 views) normalized rows; both combined user counts remain null. Direct AdSense summary remains `PARTIAL / VERIFIED`, site current earnings `$19.53 USD`, PAGE_URL returned rows 0, and no site earnings were assigned to URLs. No tracked measurement snapshot or derived artifact was regenerated locally.
- **Freshness gate state:** the currently tracked GSC period ends `2026-10-02`; as of `2026-10-06`, its existing scheduled collection rule expects `2026-10-03`. The source gate correctly blocks this not-yet-refreshed input. The scheduled publisher will preserve the last-good derived files and stop if the source collectors have not supplied the current period.
- **Storage/result:** `IMMEDIATE_REPO_SIZE_SAVINGS = NONE`; `GIT_HISTORY_REWRITE = NONE`; `FUTURE_DERIVED_ARTIFACT_CHURN_REDUCTION = YES`.
- **Delivery/next:** local verification is complete; open one PR from this branch and wait for exact-head SEO QA before returning `READY_FOR_CONTROL_TOWER_REVIEW`. Do not merge, rewrite history, dispatch live collectors, or claim revenue lift.
