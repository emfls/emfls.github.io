# Tasks

작업 완료 후 항목을 삭제하지 말고 `[x]`로 변경한다. 같은 우선순위에서는 위 항목부터 수행한다.

## P0 - Critical

- [x] P0 PR #56 — Naver parity and exact-head CI hardening — C02
  - 변경: full/compact Naver 상태·출처·freshness 메타데이터를 보존하고 null/누락/변경 시 fail-closed 검증을 추가했다. Manifest가 실제 Naver 경로·SHA와 실행에 사용한 AdSense source revision·SHA를 검증하며 synthetic execution SHA와 PR head를 분리한다. PR-only `contents: read` nonpublishing parity job은 임시 runner 경로에서만 생성·검증하고 7일 artifact를 업로드한다.
  - 데이터: `asOf=2026-10-07`, 18,929 URL. Local full/compact와 revenue parity PASS; Keyword Hunter 34, GSC opportunity 36, protected winner 1,632. Naver metadata missing 0; source `2026-08-19..2026-09-17`, `STALE_DATA` 30 / `NOT_AVAILABLE` 18,899, rank `NOT_AVAILABLE` 유지. GA4/GSC `VERIFIED`, AdSense `PARTIAL` snapshot commit `a5c78eecbff48de70cc900c228b052f907f14d03`.
  - 검증: unittest 849 passed (3 skipped), pytest 1,453 passed (3 skipped); SEO QA 신규 critical/warning 0 (759/420 current); launch guard, YAML parse, diff check PASS. Exact-head Actions run `37749583350` attempt 1 SUCCESS: PR head `ad01c2965e3816a84e6ae4a8efb346f84f0b4c7c`, execution merge SHA `53017c2b8c7d113e4450b57cd96981391e608327`, `validate` + `measurement-parity` 모두 PASS.
  - 저장공간: full 57,670,395 B, compact 18,153,808 B, same-run reduction 39,516,587 B / 68.52%. Main tracked `data/page-performance.json`는 55,289,121 B로 아직 변경되지 않아 actual main savings 0 B; 예상 compact replacement 절감 37,135,313 B. Publisher/promote는 실행하지 않았다.
  - 상태: latest main `a2d1e131ae1840acd1cb43b3bf6fee8d2be98892`과 정상 동기화. PR #56 OPEN / NOT MERGED / MERGEABLE; Control Tower merge review 대기. 문서 checkpoint commit은 별도 exact-head CI를 확인한다.
  - 최신 main 후속: main `1ee052939b4ac5b60ae69b9536cef3292d0018b7`을 `5668f37825715cd36e1e87252ff35c31d052c80f`로 일반 병합한 뒤, GSC 갱신 main `0e8b6e8487eb14b549dcee242e60aa683bbb7949`를 `1d1768ea92dfbc916d3747885660059254fdeaf5`로 일반 병합했다. GA4 선택기가 GSC 창 `2026-09-08..2026-10-05`에 정렬된 `asOf=2026-10-08` GA4 revision `1ee052939b4ac5b60ae69b9536cef3292d0018b7`을 고른다. AdSense는 `PARTIAL`, `2026-10-01..2026-10-07`, revision `a2d1e131ae1840acd1cb43b3bf6fee8d2be98892`; source gate PASS. 최신 local parity: 18,929 URL, Keyword Hunter 32, GSC opportunities 34, protected winner 1,642, full/compact 57,674,598 B / 18,157,051 B, transient reduction 39,517,547 B / 68.52%. Actions `37756267982`의 parity job은 이전 base `1ee0529`를 검증했으므로 최신 GSC refresh를 검증하지 않는다. 새 merge head의 exact-head CI가 Control Tower review 전제다.
  - PR #60 후속 통합: PR #60 merge `7d8ab3f6df7e60c32d4f5e1e289c16d8060e6411`; latest main `7da1e484fd4a622efd90c88de05361cb34297fa3`를 merge commit `8b7bf79f21180fceb62de2aaaeec23c02f28f2d5`로 일반 병합했다. PR #60의 7개 수정 페이지와 회귀 테스트는 main과 동일하다. PR #56은 OPEN / MERGEABLE.
  - Final integration exact-head run `37770487612` attempt 1: `validate` 및 `measurement-parity` 모두 SUCCESS; execution SHA `180a01a1aeac578930ad033f6f7a11fceaef5801`, PR head `8b7bf79f21180fceb62de2aaaeec23c02f28f2d5`. URL 18,929, Keyword Hunter 32, GSC opportunity 34, protected winner 1,642. Manifest SHA256 `328da95e6b3ae5a6b5017c36f4b3d71332380257a429856f5b25eb36f423b209`; full 57,674,600 B, compact 18,157,051 B, projected saving 39,517,549 B / 68.52%. GA4/GSC `VERIFIED`, AdSense `PARTIAL`; Naver stale/period-mismatched and ranking unavailable metadata preserved. Unittest 855 / 3 skipped, pytest 1,459 / 3 skipped / 556 subtests; SEO QA new critical/warning 0; launch guard PASS.
  - Current main still tracks full `data/page-performance.json` at 55,293,326 B; actual tracked-storage savings remain 0 B. No publisher dispatch, promotion, production/main push, or PR #56 merge. Keep Control Tower final merge approval as the gate; verify Actions for the latest PR head after documentation-only updates.

- [ ] P0 StockWiki placeholder-ad source/build regression prevention — C14
  - 범위: Astro source가 향후 빌드에서 placeholder 광고를 재생성하지 못하도록 한다. 실광고 활성화, StockWiki 금융 콘텐츠/데이터/SEO 의미 변경은 금지한다.
  - 변경: `AdSlot.astro`와 호출부 및 StockLayout 고정 하단 placeholder를 제거하고, 예약된 StockWiki 빌드 출력에서 광고 마커가 발견되면 복사·커밋 전에 실패하도록 안전 검사를 추가했다. 기존 생성 HTML 정리 스크립트는 유지했다.
  - 재개 검증: C20 병합 후 `origin/main` `489df99ea81f51833d36d27ee09c8190c8443236`을 merge commit `2f6106ac3a`로 일반 병합했다. `npm ci`와 `npm run build` PASS; C14 ad safety 6, C20 integrity 10, canonical inventory 2 테스트 PASS. 전체 unittest 811개, 전체 pytest 1,333개 PASS (각 2개 skip). 새 dist의 광고 마커 없음; SEO QA 신규 critical/warning 0 (767/420 기존); content launch guard, YAML parse, `git diff --check` PASS.
  - 상태: C20 루트 `.github/workflows/stockwiki-build-qa.yml`를 사용하며 비활성 nested workflow는 최신 main과 동일하게 복원했다. 알려진 `/kor/stockwikifavicon.ico` 및 `/kor/stockwikipagefind/` 경로 결함은 재현되어 C14에서 변경하지 않았다. 기존 PR #47의 최종 head에서 StockWiki Build QA와 SEO QA 성공 및 Control Tower 검토를 기다린다. Merge 금지.

- [ ] P0 Daily Publication Cap 1→3 — C01
  - 범위: 공통 정책과 keyword/external launch selector의 일일 공개 상한을 3으로 통일하고 KST 당일 사용량을 계산한다. 품질·중복·YMYL/HOLD 게이트는 유지했다. 2026-10-05 Keyboard Cleaning 1건은 기존 PUBLISHED 사실로 반영되어 remaining capacity는 2다. manifest·counter·queue·페이지 데이터 변경 및 신규 공개는 0.
  - 수정 후 검증: focused 187 passed; unittest 752 passed; pytest 1,231 passed; SEO QA 신규 critical/warning 0 (현재 767/420); content launch guard PASS; `git diff --check` PASS.
  - 기준/상태: `origin/main` `a4845bc5a12d5b442279599de4c3abd9313e9fa0` 기반 `codex/c01-daily-publication-cap-3`; PR #42 OPEN / 새 exact-head CI 대기; `READY_FOR_CI`. Control Tower review 전 merge 또는 신규 공개 금지.

- [ ] P0 Launch Queue Integrity + Fresh Demand Screen — C01
  - 범위: current editorial HOLD/NO_NEW_PAGE와 YMYL 판정을 queue 및 최종 HTML launch guard까지 연결하고, 새로운 비YMYL 과업 30개를 demand-first로 선별한다. 신규 콘텐츠 발행과 merge는 금지.
  - 수정/검증: HOLD·NO_NEW_PAGE·UPDATE_EXISTING loader 및 queue block, 누락/손상 decision store fail-closed, final guard candidate keyword IDs/editorial/YMYL checks, `연차개수`·`인건비` YMYL signal 보강, `우대출구`/`대출` substring false-positive 제거. 회귀 RED→GREEN. Unittest 819 passed (3 skipped); pytest 1,361 passed (3 skipped); SEO QA 신규 critical/warning 0 (767/420 기존); final content launch guard PASS; diff check PASS.
  - Phase B: 30개 과업 screen, exact valid HIGH Naver Search Ads 4건, launch-ready safe/distinct TOP 1 없음; 세부 근거 `docs/growth/2026-10-08-c01-launch-queue-integrity-and-demand-screen.md`.
  - 상태: `codex/launch-queue-integrity-20261008`를 push했다. GitHub integration의 PR 생성은 403으로 거부되어 수동 PR 생성 링크를 제공한다. PR이 없어 exact-head CI는 아직 없음. Control Tower review 전 merge 및 신규 발행 금지.

- [ ] P0 Direct AdSense matched-period ingestion safety — C06 / PR #49 approved; latest-main sync
  - 기준: PR #46 merge commit `9a83870428d6cf8b026de728dd9c3aabf3491b1e`의 approved head는 `5eb3f2c828ce6f4979ef8757e266b0fbf68dd1e0`; `DAILY_PUBLICATION_LIMIT = 3` 유지. PR #49 head `1d4e1cdd956ee6eefe29c15d7f8f18344e61fbb9`는 exact-head SEO QA `37378217157` SUCCESS였다.
  - Live evidence: merge 뒤 AdSense Collection을 한 번만 dispatch했다 (run `37373852773`). 실행은 `Collect direct AdSense latest snapshot` 단계에서 `AdSense report rows are unavailable.`로 실패했다. 안전한 로그에 HTTP/Google status가 없어 실패 endpoint는 미확정이다. 재실행은 금지.
  - Repair: current/prior/PAGE_URL parser 오류에 stage를 명시하고, `rows` 키가 없을 때만 빈 목록으로 정규화한다. 빈 current/prior site report는 fail-closed; 빈/missing PAGE_URL은 `PARTIAL`, matched count와 URL metric은 미확정으로 유지한다. last-good snapshot atomicity와 exact PAGE_URL 400 fail-soft guard는 유지.
  - Sync: latest `origin/main` `97ed941bf1276f5f5d102f25265576227937ccc7`을 regular-merge한 merge commit은 `dc9bb64bfe064568b4d321fd1b74dda3869cf92f`이며 latest main은 second parent다. `PROJECT_HISTORY.md` conflict 하나만 해결했고 C16 sitemap/test/history 및 C06 parser/history records 모두 보존했다. Code conflict는 0; collector blob은 그대로다.
  - 검증: post-sync focused AdSense/guard/revenue/source/policy/C16 tests 118 passed; unittest 797 passed; pytest 1,281 passed; SEO QA 신규 critical/warning 0 (현재 767/420); guard vs latest `origin/main` PASS; workflow YAML 3개 parse PASS; diff check 및 secret-pattern scan PASS. `DAILY_PUBLICATION_LIMIT = 3` 유지.
  - 상태: PR #49은 `03f49d071e4657e4b6a3ae6b1127449ab5bf0faf`로 정상 merge됨. 승인된 live AdSense 실행은 `37373852773`에서 parser failure로 종료됐고 재실행하지 않았다. 현재 tracked snapshot은 `site.status=PARTIAL`, `comparisonStatus=VERIFIED`; C07의 parser/write 충돌 의존성은 해소됐다.

- [x] P0 Site-wide matched-period GSC page×query evidence — C17
  - 범위: 현재 `gsc-latest.json`과 정확히 같은 finalized period/property/web type으로 site-wide `[page, query]` evidence를 수집하는 manual-only, artifact-only 경로. Raw export는 `$RUNNER_TEMP`에만 쓰고 7일 보관 artifact로 업로드한다.
  - 완료: PR #50 regular merge `489df99ea81f51833d36d27ee09c8190c8443236`; live run `37404548746` SUCCESS with artifact `gsc-sitewide-query-37404548746` (223 rows, `PARTIAL_TOP_ROWS`, completeness not guaranteed). Raw export remains a seven-day artifact; no tracked commit or C07 integration.
  - 의존성 해소: C17 is `TASK_COMPLETE`; C07 may publish page-derived artifacts independently of the ephemeral sitewide artifact.

- [ ] P0 Derived Measurement Publisher Consolidation — C07
  - 범위: GA4/GSC/AdSense collectors publish source snapshots only; one serialized daily publisher validates tracked source snapshots, regenerates temporary audit/page scores, and publishes only the three shared derived outputs. Preserve C17 sidecar behavior, source schemas, URL alias semantics, and direct AdSense PARTIAL/VERIFIED distinctions.
  - 저장소 판정: `IMMEDIATE_REPO_SIZE_SAVINGS = NONE`; `GIT_HISTORY_REWRITE = NONE`; `FUTURE_DERIVED_ARTIFACT_CHURN_REDUCTION = YES`.
  - 라이브 이식: fresh `origin/main` `b9f67ceb4615183f399f4dca14069a8e4ded1182`에서 `codex/page-performance-compact-publisher-live-20261007`를 만들고 승인된 fail-closed patch와 실제 compact implementation 4개를 순서대로 이식했다. 오프라인 범위의 나머지 3개는 문서 전용 commit이라 제외하고 이 상태 기록 하나로 압축한다.
  - 입력 검증: GA4 `VERIFIED` `2026-09-09..2026-10-06`; GSC `VERIFIED` `2026-09-07..2026-10-04`; AdSense `PARTIAL`, current `2026-09-30..2026-10-06`, prior `2026-09-23..2026-09-29`. Full/compact artifact validation 각각 18,929 URLs, consumer parity PASS (Keyword Hunter 34 candidates, GSC opportunities 36, protected winners 1,632). Full 55,289,121 B → compact 14,426,745 B (40,862,376 B / 73.907% 감소).
  - 검증: focused 89 passed; `pytest` 1,383 passed (3 skipped); unittest 837 run (3 skipped); source validation 및 `git diff --check` PASS. 전체 광고 workflow는 dispatch하지 않았고 tracked derived outputs를 바꾸지 않았다.
  - 상태: local transplant 검증 완료. 정상 push, PR 생성, 최종 remote HEAD의 exact-head CI 대기; merge 금지. Git history rewrite는 `DEFERRED`.

- [ ] P0 JP Travel Batch 02 — PR #38, 50-page canary
  - 동기화: 요청된 main `6b844cf03138057091bac2cdf1a87db3e98491f2` 이후 main이 `1b15674e09d3dd30fb65620ab2ae8f35f85c2137`로 전진해 두 SHA를 모두 regular merge로 반영했다. `5172e32bcd`에서 derived artifact 충돌 3건을 최신 main 입력 기준으로 해결·재생성했고, `946f3cf027` merge는 충돌이 없었다. rebase/force push 없음.
  - 범위: JP Travel HTML 정확히 50개 / 674,830 B 삭제, 대응 sitemap URL 정확히 50개 제거. 비대상 HTML 변경 0. 보호 승자 1,593개와 후보 overlap 0. 세 실험은 모두 `INCONCLUSIVE`; 후보 revenue/search rows는 `NOT_CONNECTED`/`NO_ROW`로서 unknown이지 0이 아니다. raw GA4/GSC는 latest main과 동일. 최신 targeted validation은 다른 5개 target에서 `VERIFIED`, Batch 02 URL 언급 0.
  - 의존성: 후보로 가는 남은 inbound HTML 링크 0. 삭제 허용목록은 `scripts/content_launch_guard.py`에만 의도적으로 남기며 다른 active manifest/index/feed/generator 경로 참조는 0. broken internal links 276, main 기준과 동일.
  - QA: unittest 752; pytest 1,215; SEO QA new critical/warning 0 (767/420 existing); sitemap 46 leaf / 18,707 URLs / duplicate 0 / missing ref 0 / unknown 0; Naver URL data 30/30 PASS; measurement artifact 18,928 pages PASS; revenue growth selected 3 existing improvements; daily growth 10 researched / 0 selected (`INSUFFICIENT_DATA`); Search Trend Signals `NOT_CONNECTED` (local credentials absent); Keyword Hunter dry-run 0 API / 0 writes; Launch Guard PASS; `git diff --check` PASS.
  - 크기: latest main 507,845,424 B; synchronized branch before this docs checkpoint 506,900,743 B; net -944,681 B; compact `data/site-audit.json` 16,179,318 B. Full scoring audit is transient at `/tmp/site-audit-full.json`.
  - 상태: `SYNCED_LOCAL_QA_PASS; EXACT_HEAD_CI_PENDING`. Push the current branch normally and require a new Actions SUCCESS on that exact pushed SHA. Do not merge PR #38 before that CI passes; Batch 03 remains unstarted. Record final SHA/run on the existing Notion checkpoint.

- [ ] P0 Revenue Evidence Upgrade — GSC query-level evidence for current opportunities
  - 목적: exact-period Search Console query evidence를 현재 `OPPORTUNITY` URL별 sidecar에 수집해 snippet/query mismatch 검토 근거를 만든다. 기존 page-level snapshot은 유지하고 콘텐츠는 수정하지 않는다.
  - 최신 기준: `origin/main` `ffe6c429a80cabca14ff9231af9cb2c86a1a33a6`; GSC `2026-09-03..2026-09-30`; complete page-performance inventory에서 OPPORTUNITY 34개, revenue summary count와 일치.
  - 로컬 구현: per-URL exact page filter/query collector, explicit no-query status, API failure 시 last-good artifact 보존, isolated `opportunity-query` workflow mode 및 회귀 테스트. 수정 후 focused 44, unittest 742, pytest 1,193, measurement validator, content launch guard, `git diff --check` PASS.
  - 실제 수집: GSC Collection run `37112076773` SUCCESS. `data/performance/gsc-opportunity-queries-latest.json`은 34 URL, 12 URL에 query row, 22 `NO_QUERY_ROWS_RETURNED`, 총 110 query rows(393 impressions / 1 click)를 기록한다. Page-level 합계 571 impressions / 7 clicks와 query subtotal 차이는 privacy/top-row filtering으로 가능한 부분 응답이며 불일치 오류나 누락 0으로 해석하지 않는다.
  - 근거 판정: `YMYL_HOLD` 11, `NO_MISMATCH` 2(URL Encoder·영문 MBTI), `INSUFFICIENT_QUERY_EVIDENCE` 21, `ACTIONABLE_CTR` 0. URL Encoder 실제 query는 encode/decode 의도와 title/meta/H1이 맞고, MBTI query도 현재 16-type quiz 의도와 맞지만 평균 순위 75.18이어서 snippet 원인으로 귀속하지 않았다. 낮은 표본/미반환 query는 수요 0이 아니다. AdSense URL revenue는 계속 `NOT_CONNECTED`; GA4 `totalAdRevenue`를 AdSense 수익으로 사용하지 않았다. 페이지 변경 0, Revenue `NO_CONCLUSION`.
  - PR/CI: PR #37은 open. 최초 exact-head SEO QA `37112666746`은 마지막 full pytest에서 dry-run 테스트 1건 실패, 나머지 1,192 passed; 원인은 QA가 먼저 revenue artifact를 재생성해 `OPPORTUNITY=0`인 run에서 CLI가 정확히 `plannedUrls=0`을 반환했지만 테스트가 이전 artifact의 고정값 34를 요구한 것. production code는 변경하지 않고 dry-run test를 안정적인 temporary inventory fixture(2 current opportunities)로 분리했다. 수정 후 focused 44, unittest 742, pytest 1,193 PASS. Corrective test commit을 같은 PR branch에 push한 뒤 새 exact-head SEO QA를 확인할 것; PR merge 금지.

- [x] P0 Arabic Locale Retire — `/ae/`
  - 완료: PR #31 regular merge `9e3911eeff26330e262653c43e7e115853d3493e`; final PR head `83219b52ff308347e3469b6e6f56e9a686eb8ee8`; exact-head CI run `37001453254` SUCCESS. Completed Log page 93에 기록됨.
  - 범위: Arabic HTML 63개 삭제, locale 전용 JS 2개 삭제, `ae/sitemap.xml` 삭제. Raw GA4/GSC snapshots와 non-Arabic HTML을 보존하고 compact `data/site-audit.json`을 약 16 MB 수준으로 유지한다.
  - 동기화: latest fetched `origin/main` `af341dc20cffcb7f85b59bd0483f9bdf58f35374`를 regular merge commit `3c6d690baf`로 통합했다. PR #30 Keyword Hunter/DataLab freshness changes와 2026-10-02 GA4/GSC refresh를 보존하고 raw measurement snapshots를 latest main과 byte-identical로 확인했다.
  - 검증: unittest 741, pytest 1,181; SEO QA new critical/warning 0; sitemap 46 leaf / 18,806 URLs / duplicate 0 / Arabic 0; broken links 276 (main 278); Keyword Hunter dry-run 0 API / 0 writes; launch guard PASS. Tracked tree 508,646,509 B (latest main 510,019,139 B; net -1,372,630 B); compact site audit 16,270,166 B.
  - 상태: `ARABIC_PRUNING_CLOSED`. PR #31 병합과 exact-head CI가 완료됐으며 Arabic 결과는 Completed Log page 93에 보존한다.

- [ ] P0 JP Travel First 50 Canary — PR #34
  - 동기화: 이전 PR head `0438379277b2ce69724222c959d9eb6380f0b198`와 latest fetched `origin/main` `bdf76120dac725fca0ac955929626c5378648055`를 regular merge commit `3d0f1d3a77e5764152beb2b245dccf9dcf180808`로 통합했다. 문서 conflict 2건은 의미에 맞게 해결했고 PR #37 GSC workflow/collector/sidecar/tests는 latest main과 byte-identical이다.
  - 범위: 49 JP Travel HTML / 1,036,400 B 삭제 및 sitemap 49 entries 제거만. non-JP HTML diff 0. 현재 JP WINNER 15개와 별도 protected no-row 2개는 모두 보존했다. 추가 canary 삭제 없음.
  - 검증: unittest 743; pytest 1,199; SEO QA 신규 critical/warning 0 (767/420); sitemap 46 leaf / 18,757 URLs / duplicate 0 / unknown 0; broken links 276; Keyword Hunter dry-run 0 API / 0 DataLab / 0 writes; launch guard PASS; `git diff --check` PASS. Compact site audit 16,224,376 B; full audit 99,621,796 B at `/tmp`.
  - 크기 (sync merge commit): latest main tracked tree 508,890,557 B; PR tree 507,598,055 B; net -1,292,502 B. Raw historical GA4/GSC snapshots are unchanged from latest main.
  - 상태: `READY_FOR_EXACT_HEAD_CI`; PR #34 OPEN / UNMERGED. Push the regular merge plus this checkpoint, require new exact-head Actions SUCCESS, then perform regular merge and post-merge Notion/JP canary closeout. No new deletion batch.

- [x] P0 Support — Keyword Hunter DataLab freshness contract
  - 목적: 만료·미래·기준시각 누락 DataLab trend 값을 현재 검증 신호와 후보 점수로 오인하지 않도록 한다.
  - 범위: score freshness 검증과 부분 응답 병합 계약만 수정한다. 콘텐츠·발행 데이터는 변경하지 않는다.
  - 완료: PR #30 normal merge `0bb519d6b8eb206997e238528bd8bd7e0d75b9ff`; post-merge SEO QA run `36982375937` SUCCESS (Keyword Hunter validation, unittest, full pytest, SEO regression, launch guard, QA upload). Freshness changes remain present in latest main.

- [x] P0 Support — CI Baseline GA4 Contract 5건 복구
  - 목적: 기존 main의 unittest baseline에서 실패한 5개 GA4 batch contract를 최신 페이지 의미와 정합화해 P0 Revenue Growth #02 PR을 재검증한다.
  - 분류: Ukraine / Togo / MBTI JSON-LD 위치 검사는 `STALE_TEST_CONTRACT`; MarbleFlick의 자기 링크 및 English game hub의 `Related`/고정 max-width 문구 검사는 최근 전용 페이지 계약과 충돌하는 `STALE_TEST_CONTRACT`. 페이지 파일은 수정하지 않는다.
  - 변경: 공통 semantic JSON-LD parser가 페이지 내 JSON-LD 스크립트 위치와 무관하게 기대 `@type`, canonical URL, 유효 JSON 및 `dateModified >= 2026-08-11`을 확인한다. MarbleFlick expected hub를 `/game/`로 맞추고 game hub 배치 검사는 실제 검색/필터/게임카드/반응형 grid affordance를 확인한다.
  - 검증: exact 5 tests 및 MarbleFlick/game hub 전용 테스트 통과; 전체 unittest 694 passed; 전체 pytest 1,006 passed; `git diff --check` 통과. PR #2 SEO QA run `35712200413` SUCCESS 후 squash merge (`16c88b0e426c8283f54c757b7721b225a93c49cb`). PR #1은 새 main 위로 rebase한 head `3bad46fd82cf94a43ae1f7ac07da2e7b9afdecea`에서 SEO QA run `35714221956` SUCCESS.

- 현재 확인된 배포 차단 또는 정책 위반 없음.

- [x] Revenue Growth Sprint 1 — 기존 여행 허브 수익 경로 복구
  - 목적: Search Console 노출이 있으나 탐색성이 낮은 `/kor/report/travel/`을 기존 canonical 그대로 실용적인 한국어 여행 정보 허브로 개선한다.
  - 완료 조건: 30–50개 실제 링크, 준비·지역·목적·주요 콘텐츠 탐색, GA4·AdSense·모바일·구조화 데이터, sitemap/content-index 보존, 회귀 테스트와 캠핑 P1 진단.
  - 완료 기록: 2026-09-13. 2.79MB/5,233링크 목록을 21.8KB/43개 고유 `/kor/` 목적지 허브로 교체하고 캠핑 후속 우선순위를 남양주→청주→담양→김포→경기도 광주로 정리했다.

- [x] P0 Revenue Growth #02 — GA4 refresh에서 최신 GSC 기회 신호 보존
  - 근거: live main의 GA4 workflow가 `revenue_growth.py`에 GSC snapshot을 전달하지 않아 GA4 실행 후 page-performance의 Google 채널이 `NOT_CONNECTED`로 재생성될 수 있다. latest `gsc-latest.json` 110 rows를 병합한 temporary regeneration에서는 VERIFIED Google URL 106개와 OPPORTUNITY 38개가 확인됐다.
  - 변경: GA4 workflow가 `data/performance/gsc-latest.json`을 함께 전달하도록 수정하고 workflow 계약 회귀 테스트를 추가했다. 콘텐츠 URL은 수정하지 않았다.
  - 완료/배포: PR #1 normal merge, merge SHA `d4d26888e799cd1070357ec4f150287408cdfe4f`. GA4 Collection run `36690479897` SUCCESS; 2026-09-30 `page-performance.json`에 Google `VERIFIED` 100개가 기록됐다. 최신 main `5481894b01c2685f281121571169cb226645ec14`에서 workflow가 GSC snapshot 입력을 유지한다.
  - CI follow-up 완료: workflow orchestration에만 exact-path 예외를 좁게 적용하고 실제 `assets/js/ga4.js` 등 analytics runtime asset은 회귀 테스트로 계속 차단한다.

- [x] P0 Support #25 — Published Content Dedupe Hardening
  - Root cause: queue preparation은 published registry와 content index만 dedupe source로 사용하고 final `PUBLISHED` manifest의 `candidateIds`/`urls`를 무시했다. URL identity가 query만 제거해 `/route/`와 `/route/index.html`도 같게 보지 않았으며, stale counter는 same-day manifest의 1/1 publication을 놓쳤다.
  - 변경: 공통 policy helper에 conservative same-site HTTPS URL identity, 명시적 `keyword:` ID parsing, final `PUBLISHED`/`LAUNCHED` manifest key 추출을 추가했다. preparation path는 해당 keys를 기존 입력과 합치고 KST same-day effective usage를 counter/manifest 중 큰 값으로 fail-closed 계산한다. review-queue 외 발행 기능은 추가하지 않았다.
  - 최종 검증: focused 40 passed, unittest 715 passed, pytest 1,108 passed, content-launch guard PASS, `git diff --check` PASS. Final PR head `966d1a1e38c9d14b8367b97b9bde1f41db2adf62`의 SEO QA `36501567865` SUCCESS.
  - 전달/종결: PR #17 normal merge 완료. merge SHA `c16677a74e3e2ef645d440cdfb044e1202f4c1fb`. Post-merge queue proof에서 #23은 재등재되지 않았고 `/route/`·`/route/index.html` alias dedupe를 확인했다. 9/28 manifest는 9/29 daily capacity를 소비하지 않아 slot은 available이었다. `글램핑장추천`은 별도 후보로 남았지만 `CANNIBALIZATION_RISK`로 분류되어 새 페이지/콘텐츠는 승인·발행하지 않았다. `TECHNICAL_DONE`; Revenue WIN 주장은 하지 않았다.

- [x] P0 Revenue Growth #23 — 1688 구매대행 검증가이드
  - 근거: 최신 main queue에서 `1688구매대행` HIGH · 59.92 · `READY_TO_LAUNCH`; current volume은 `NOT_AVAILABLE`, 3,740/month는 2026-09-14 historical evidence만 확인됐다. 새 URL의 동일 intent overlap은 확인되지 않았다.
  - 변경: 검증 가이드, 칼럼 허브, sitemap, 검색 index/home feed 및 launch-manifest regression을 current-main worktree에 준비했다. 비용·환율·통관·품목 안전은 공식 자료로 확인하도록 하고 업체 순위·고정 비용/세율·affiliate 표현은 넣지 않았다.
  - CI root cause / repair: SEO QA `36364464129`의 2개 pytest 실패는 #23 테스트가 generator-mutated manifest를 읽고 #17의 과거 launch 기록을 mutable latest manifest에 고정한 test-contract 결함이었다. #23은 `HEAD`의 committed manifest를 검증하고 #17 테스트는 현재 페이지·허브·sitemap 계약만 검증하도록 수정했다.
  - 완료/배포: PR #15 normal merge, merge SHA `f306bedf0cb62bc39bb1e370272379a474afe9a0` (11 files). SEO QA `36387011884`, Pages `36387010988`, IndexNow `36387011935` 모두 SUCCESS; 2026-10-01 `https://emfls.github.io/kor/column/1688gumaedaehaeng/` HTTP 200. Current volume은 `NOT_AVAILABLE`, 3,740/month는 2026-09-14 historical evidence이므로 Revenue `NO_CONCLUSION`.

- [x] P0 Safety — 기존 육아휴직·출산휴가 급여 안내의 YMYL 정확성 보정
  - 범위: `kor/report/parenting/parenting-subsidy-2026.html`의 기존 급여 안내 단락만 갱신했다. 당시 해당 repair는 제목·메타·허브·sitemap·광고/분석 코드를 변경하지 않았다. 신청서 가이드는 별도 P0 #26으로 이후 공개됐다.
  - 완료/배포: 후속 YMYL 검토·전달 완료 후 PR #20 normal merge, merge SHA `8d71c7d2cc1fef374443c26b0108bb2c55a3b59f`. SEO QA `36545079003`, Pages `36545078240`, IndexNow `36545078922` 모두 SUCCESS; 2026-10-01 `https://emfls.github.io/kor/report/parenting/parenting-subsidy-2026.html` HTTP 200. 신청서 가이드는 별도 #26 공개 작업 기록을 참조.

- [x] P0 Revenue Growth — 세 캠핑 CTR 실험의 비교 불가 수동 종료
  - 목적: Nonsan/Cheorwon/Uljin 실험을 없는 matched-period Naver 수치로 판정하지 않고 terminal state로 닫아 실험 slot을 해제한다.
  - 최종 전달: PR #35 normal merge, merge SHA `0156625d002654271046b20b7c874ea328d071d2`; post-merge SEO QA `37095932102` SUCCESS. 세 실험은 `INCONCLUSIVE / COMPARABLE_MATCHED_PERIOD_NAVER_DATA_UNAVAILABLE`로 종결했고, active experiments 3→0 및 selector capacity 0→3을 확인했다.
  - 범위/결과: 실제 콘텐츠 수정 0, 추가 공개 페이지 0. 대상 HTML·protected pages·sitemap/hub/manifest/IndexNow 변경 없음. matched-period Naver 값을 만들지 않았으며 Revenue는 `NO_CONCLUSION`.

- [ ] P0 Safety — Maple Planet 기존 페이지 콘텐츠 무결성 — C33
  - 범위: 기존 `kor/column/maple-planet-no-capital-rice-farming-2026.html` 한 페이지만 수정한다. URL, canonical, sitemap 등록, 무자본 게임 내 메소 수급 의도와 유효한 관련 링크를 보존하며 새 Maple 페이지를 만들지 않는다.
  - 변경: 서드파티 복각 서버 오인, RMT 정상화, 환전 안내, 시간당 원화/메소 수익 및 90% 직업 통계를 제거했다. Maple Planet 운영정책·MapleStory Worlds 공식 월드 목록·공식 플레이 가이드·2026-10-03 패치노트를 연결하고, 쌀먹 검색어를 정책 맥락에서만 설명했다. 최근 검토와 Article `dateModified`는 2026-10-06이다.
  - 검증: page-specific 및 관련 Maple 회귀 5 passed; exact C33 protected-winner transition + 관련 테스트 32 passed; unittest 819 passed / 3 skipped; pytest 1,341 passed / 3 skipped; SEO audit 18,932 pages / 0 parser errors; SEO QA 신규 critical 0 / warning 0 (기존 767 / 420); 최신 main diff에 대한 launch guard 및 `git diff --check` PASS. SEO 및 quality 출력은 `/tmp`에서 확인했으며 추적 성과 산출물 변경은 없다.
  - 보호 winner gate: PR #55 첫 exact-head run `37422867065`는 launch guard에서 `PROTECTED_WINNER_CHANGED`로 실패했다. 지정된 C33 본문 수정만 통과하도록 exact base/result blob pair를 allowlist에 추가하고 variant/다른 winner 거부 회귀를 추가했다. Full local revalidation은 통과; 수정 commit push 후 새 exact-head Actions 대기 중.
  - 상태: `origin/main` `02afeeb8e58fdbf0c6a3aae418ed41664b3e2b05`에서 분리한 `codex/c33-maple-planet-content-integrity-20261006`; PR #55 OPEN, merge 금지.

- [ ] P0 C26 · Keyword Hunter 3/day queue validator repair
  - 범위: `.github/workflows/keyword-hunter.yml`의 낡은 1-item 검증을 중앙 `DAILY_PUBLICATION_LIMIT` 기준으로 교정하고, queue/status/review/URL 및 publication-state/HTML 보호를 유지한다. 검색 후보 품질, YMYL, 중복, editorial HOLD, 발행 정책은 변경하지 않는다.
  - 검증: TDD RED/GREEN; 관련 Keyword Hunter/launch suite 224 passed; 전체 unittest 819 passed (3 skipped); 전체 pytest 1,345 passed (3 skipped); workflow YAML parse, content launch guard, `git diff --check` PASS.
  - 상태: 최신 main `02afeeb8e58fdbf0c6a3aae418ed41664b3e2b05`에서 분리한 `codex/c26-kh-queue-limit-20261006`; PR #54 is open. Use its Checks tab for current exact-head CI; 신규 공개·live Keyword Hunter dispatch·merge 없음.

## P1 - High

- [ ] C02 · Quality audit performance source selection repair
  - Scope: select only validated canonical GA4/GSC page snapshots for quality scoring; preserve each channel's source, schema, period, freshness, and missingness. Do not derive URL revenue/RPM from site-level AdSense or relabel GA4 views as sessions.
  - Evidence: the prior lexical selector chose `gsc-opportunity-queries-latest.json` (34 query rows, no page-level GA4/GSC channels). Same-input recomputation over 18,928 indexable pages changed coverage from 0 measured / 18,928 estimated to 3,012 measured / 15,916 estimated; Revenue Growth output and all 1,642 protected winners stayed identical. Site connection score changed 53/F→68/C; per-page grade distribution did not change.
  - Verification: source-selection/quality/workflow focused suite 31 passed; unittest 861 passed (3 skipped); pytest 1,466 passed (3 skipped); SEO QA 0 new Critical/Warning; source validator, launch guard, workflow YAML, and diff check PASS. Exact-head CI pending.
  - Status: repair is isolated from C01 launch/HOLD files; keep PR open for Control Tower review. Do not run Publisher or merge.

- [ ] C01 · Autumn travel HOLD and overseas purchase-agency review
  - Scope: persist the autumn travel HOLD; research the next overseas purchase-agency keyword and prevent a broad, overlapping or high-maintenance page from being treated as launch-ready. No HTML, ad, measurement, PR #56, or protected WINNER edits.
  - Evidence: autumn intent overlaps the existing October and day/overnight travel pages; its queue-promoted near-synonym was also held. Overseas Search Ads: 280/month (PC 70, mobile 210), HIGH, checked 2026-10-08; live Google/Naver SERPs mix buyer service discovery with seller workflow. Existing 1688 guide and volatile provider terms leave no proven independent low-maintenance task.
  - Verification: TDD RED/GREEN; focused launch/guard suite 171 passed; unittest 821 passed (3 skipped); pytest 1,408 passed (3 skipped); SEO QA 0 new Critical/Warning; launch guard PASS; diff check PASS.
  - Status: branch `codex/autumn-hold-next-keyword-20261008`, based on `7da1e484fd4a622efd90c88de05361cb34297fa3`; create one PR, keep it open for Control Tower review, and do not merge.

- [ ] C01 · Amorepacific internal-link recovery
  - Scope: correct the seven reviewed `/kor/report/stock/2025/` related-stock links to the existing self-canonical Amorepacific (090430) report; add a route regression test. No content, canonical, ads, or measurement edits.
  - Verification: live target HTTP 200, exact stock code and self-canonical; broken internal links 268→261; launch guard PASS; SEO QA no new Critical/Warning; unittest 821 passed (3 skipped); pytest 1,407 passed (3 skipped); `git diff --check` PASS.
  - Status: PR #60 is OPEN and unmerged on `codex/amorepacific-internal-link-recovery-20261008`; exact-head SEO QA pending. Await Control Tower review.

- [ ] C24 · StockWiki base-path asset repair
  - Scope: normalize Astro's base path for the StockWiki favicon and Pagefind stylesheet only; preserve C20 canonicals, sitemap, 11 production routes, ad markup, and deployment state.
  - Baseline: C20 PR #51 merged as `3214c1a3cc388534d9f322c978bb31387cdf9ffd`. Fresh build reproduced `/kor/stockwikifavicon.ico` and `/kor/stockwikipagefind/pagefind-ui.css` on all 12 built HTML pages.
  - Verification: regression RED on the post-C20 build, then GREEN; `npm ci` / `npm run build` PASS; 12 generated HTML pages, 11 indexed Pagefind pages; canonical inventory 2 passed; post-build StockWiki Build QA tests 13 passed; unittest 808 tests (2 skipped); pytest 1,330 passed (2 skipped); SEO QA no new criticals/warnings (767/420 current); launch guard, YAML parse, and `git diff --check` PASS.
  - Status: branch `codex/c24-stockwiki-base-path-repair`, synced to `origin/main` `489df99ea81f51833d36d27ee09c8190c8443236`; exact-head CI pending. Keep unmerged; no deployment.

- [x] C20 · StockWiki Build Integrity and Active CI
  - Scope: make `emfls.github.io` the canonical host, add route-derived StockWiki canonicals, remove the dead sitemap generator call and unused direct `sitemap` dependency, correct the public robots sitemap URL, and add read-only path-scoped build QA. The tracked 11-URL sitemap remains separately owned.
  - Local verification: TDD RED/GREEN; `npm ci` and `npm run build` PASS; 11 production routes have exact self-canonicals; focused StockWiki tests 12 passed; canonical inventory 2 passed; unittest 807 passed (1 build-output test skipped after cleanup); pytest 1,290 passed (1 skipped); SEO QA 0 new critical/warnings (767/420 existing); launch guard, YAML, and diff checks PASS.
  - Status: PR #51 merged as `3214c1a3cc388534d9f322c978bb31387cdf9ffd`. Its separately observed base-path asset defect is tracked in C24.

- [ ] C16 · Three Utility Sitemap Coverage Repair
  - Scope: add the three existing, indexable self-canonical utility URLs to `kor/sitemap.xml`; omit unsupported `lastmod`; leave page HTML, root sitemap, content index, measurement data, publication state, and StockWiki untouched.
  - Verification: regression RED on missing sitemap membership, then GREEN (2); related sitemap/canonical/SEO tests 15 passed; unittest 785 passed; pytest 1,268 passed; sitemap audit found 0 duplicates/invalid XML and one pre-existing unknown inventory URL; SEO QA 0 new critical/warnings; content launch guard PASS; XML parse PASS.
  - Status: local verification ready for exact-head CI from `origin/main` `93cfd4e48d20a2b012c7b4610929be9f167bcff3` on `codex/c16-three-utility-sitemap-repair`. Keep unmerged pending Control Tower review.

- [x] 12 · Spanish STOPat5 — `/es/game/STOPat5/`
  - 완료: 2026-09-21. 승인 4-commit chain을 최신 main에 non-force 반영하고 Pages run `35589224240` success 및 production served HTML을 확인했다. Timer-specific Spanish identity, fixed 5.000-second `performance.now()` ladder, inclusive tolerance boundary, signed early/late/exact result, local best error/highest reached level, safe storage fallback/reset/restart, replay/share/related navigation, timing trust disclosure, VideoGame-only schema, FAQPage 0, privacy/AdSense state, generated RSS parity, and actual Node behavioral coverage were verified. Focused ES + sixth batch tests 9 passed. Mobile/runtime deep checks remain `MOBILE_390_NOT_VERIFIED` / `RUNTIME_PARTIAL_NOT_VERIFIED`; Google URL Inspection `SEARCH_CONSOLE_NOT_VERIFIED`, no submission; Naver `NAVER_NOT_PRIMARY`. 14/28/56-day measurement and Notion final closure remain follow-up.

- [x] 11 · Chinese Game Hub — `/cn/game/`
  - 완료: 2026-09-21. 승인 4-commit chain을 최신 main에 non-force 반영하고 Pages run `35568403530` success 및 production served HTML을 확인했다. Repo/sitemap/hub 25-way parity와 LadderGame, exact title/H1/lang, category/search intersection, 25 full-card anchors, visible category parity, honest controls, MBTI® trust copy, CollectionPage-only schema, privacy/AdSense state, generated RSS metadata parity, focused tests 8 passed를 확인했다. Runtime/mobile 390px은 `RUNTIME_NOT_VERIFIED` / `MOBILE_390_NOT_VERIFIED`, Google URL Inspection은 `SEARCH_CONSOLE_NOT_VERIFIED`, submission 없음, Naver는 `NAVER_NOT_PRIMARY`. 14/28/56일 measurement와 Notion final closure는 후속이다.

- [x] 10 · Russian 16-Type Personality Quiz — `/ru/game/MBTI/`
  - 완료: 2026-09-21. 승인된 3-commit chain을 최신 main에 non-force 반영했다: Core `0f3929cce5`, RSS `f877497aa9`, scoring-symmetry regression `263efd3600`. 20 questions / 5 per axis, strict-majority, root/RU equivalence, all-first/all-second actual mapping regression, mirrored counts, independent identity/trust, 16 dedicated unique profiles, privacy/ad-state correction, WebApplication-only schema, RU hub/RSS propagation, and RU-specific stale batch policy를 반영했다. Focused suite 20 passed, Pages `35555715057` success, production served HTML 최신 확인, runtime ESTJ/INFP·axis counts·close·profiles·restart·navigation 검증. Mobile 390px `MOBILE_390_NOT_VERIFIED`, share/clipboard `SHARE_RUNTIME_NOT_VERIFIED`; Google `SEARCH_VISIBLE_LOW_SAMPLE / INDEXED_QUERY_UNKNOWN`, `NO_SUBMISSION`, Naver `NAVER_NOT_PRIMARY`. Notion은 `NOTION_CLOSURE_PENDING_CHATGPT`; 다른 locale audit와 14/28/56일 measurement는 후속이며 11번은 시작하지 않았다.

- [x] 09 · Vietnamese 16-Type Personality Quiz — `/vn/game/MBTI/`
  - 완료: 2026-09-21. 승인된 4-commit chain을 최신 main에 non-force 반영했다: Core `99c8a30fb6`, RSS `bf271f1d8e`, dedicated profile correction `438363afa6`, EN/VN axis-equivalence regression `275f3f4c80`. 20 questions / 5 per axis, strict-majority scoring, tie-free completion, independent Vietnamese quiz rebrand, trust/privacy/no raw-answer telemetry, 16 dedicated and unique profiles, static 16-type overview, WebApplication 1 / FAQPage 0, VN hub/sitemap/RSS propagation을 유지했다. Focused tests 11 passed, Pages run `35554252236` success, production served HTML 최신 확인, runtime ESTJ/INFP scoring·axis counts·profiles·restart 검증. Mobile 390px과 share/clipboard runtime은 `MOBILE_390_NOT_VERIFIED` / `SHARE_RUNTIME_NOT_VERIFIED`; Google은 `CURRENT_GSC_ROW_ABSENT / INDEX_NOT_CONFIRMED`, submission 없음, Naver는 `NAVER_NOT_PRIMARY`. Notion은 `NOTION_CLOSURE_PENDING_CHATGPT`. 다른 12 locale scoring/trust audit와 7–14/28/56일 measurement는 후속이며 10번은 시작하지 않았다.

- [x] 08 · Date Difference Calculator — `/util/date-difference/`
  - 완료: 2026-09-21. date-only UTC whole-day math, explicit include-end semantics, calendar Y/M/D with month-end clamp, weeks, weekdays/weekends with Mon–Fri/public-holiday caveat, Today/Swap/Copy/Reset, date-tool cluster links, WebApplication-only schema, hub/sitemap/RSS propagation을 반영했다. Final review correction에서 partial Swap input 보존, Today partial neutral state, stale Copy status clear와 handler regression을 추가했다. Tests 13 passed, Pages `35547351347` success, Production/runtime 기본·leap·month-end·weekday·Swap·Today·Copy·Reset 검증을 완료했다. Mobile 390px은 viewport capability 부재로 `MOBILE_390_NOT_VERIFIED`, Google `SEARCH_CONSOLE_NOT_VERIFIED`, Naver `NAVER_INDEX_NOT_CONFIRMED / SECONDARY`, metadata `METADATA_NOT_IN_CURRENT_CONTRACT`로 유지한다. 14/28/56일 measurement와 Notion final closure는 후속이다.

- [x] 07 · Aspect Ratio Calculator — `/util/aspect-ratio/`
  - 완료: 2026-09-21. 두 모드(이미지 크기에서 exact ratio, ratio로 resize), 8개 common preset, swap/reset/copy/live preview, visible FAQ와 WebApplication 1개, privacy/AdSense 보호, util hub/sitemap/RSS propagation을 반영했다. silent precedence를 제거하고 Mode A original dimensions 표시·복사 버그와 deterministic Reset을 수정했다. `3440×1440 → 43:18` exactness를 유지했으며 관련 테스트 9 passed, Pages `35545871611` success, Production/runtime 기능 검증을 완료했다. Mobile 390px은 viewport capability 부재로 `RUNTIME_UI_NOT_VERIFIED`, Google `SEARCH_CONSOLE_NOT_VERIFIED`, Naver `NAVER_INDEX_NOT_CONFIRMED`, metadata `METADATA_NOT_IN_CURRENT_CONTRACT`로 유지한다. 14/28/56일 measurement와 Notion final closure는 후속이다.

- [x] 06 · Japanese Singapore Entry Guide — `/jp/report/travel/singapore-visa.html`
  - 완료: 2026-09-20. 일본인 입국 준비 중심으로 title/H1을 재정의하고, 일본 국적자 관광·상용 비자 면제·여권 6개월 기준, SG Arrival Card의 대상/3일 이내/무료/ICA·MyICA/통과 예외/acknowledgement/DE番号/Update SGAC/e-Pass 구분을 반영했다. `ko`·`x-default` hreflang을 제거하고 `ja` self만 유지했으며 FAQPage를 제거하고 WebPage 1개를 유지했다.
  - 승인 원본 Core `6a229cbc33`, RSS `b84c73ef1f`; main 통합 Core `8951582161`, RSS `1c846e5ae9`. 25개 Japanese Singapore city inbound links, sitemap, RSS를 보존·갱신했다. 관련 테스트 6 passed, Pages `35508797105` success, Production served HTML 최신 확인. Runtime/mobile `RUNTIME_UI_NOT_VERIFIED`, Google `NO_SUBMISSION / SEARCH_CONSOLE_NOT_VERIFIED`, Naver `NAVER_NOT_PRIMARY / INDEX_NOT_CONFIRMED`, metadata `METADATA_NOT_IN_CURRENT_CONTRACT`로 유지한다. 14/28/56일 measurement와 dedicated SGAC page gate는 후속이다.

- [x] 05 · Quick 16-Type Personality Quiz trust/scoring repair
  - 범위: 20 original questions / 5 per axis, tie-default 제거, independent personality quiz rebrand, axis counts/close result, result depth, MBTI® non-affiliation, FAQ parity, duplicate schema 제거, privacy, game hub, RSS.
  - 완료: 2026-09-20. Core `35a3772098`, RSS `57b648b505`, final correction `d047f3e8a3`, closure는 `codex/game-05-personality-quiz-closure`에서 기록했다. 20 questions/5 per axis, tie-default 제거, trust rebrand, 3:2 close semantics, 16 dedicated profiles, FAQ Q+A parity, hidden legacy FAQ 제거, 16-type overview, privacy, AdSense disabled, game hub/RSS propagation을 반영했다. Pages `35507590941` success와 실제 Production served HTML을 확인했다. 관련 tests 14 passed. Runtime UI/mobile, Search Console, Naver는 이번 실행에서 미검증이며 각각 `RUNTIME_UI_NOT_VERIFIED`, `SEARCH_CONSOLE_NOT_VERIFIED`, `NAVER_INDEX_NOT_CONFIRMED`로 유지한다. localized pages와 multilingual hreflang은 별도 작업이다. 28/56일 measurement를 진행한다.

- [x] 04 · Reading Time Calculator product-depth upgrade
  - 범위: 3 input modes, 238/183 research reference, reading/read-aloud results, reverse word target, FAQ schema parity, privacy contract, util hub/sitemap propagation, focused tests.
  - 완료: 2026-09-20. 3 modes, 238/183 English research references, adjustable speaking WPM, empty/zero validation, FAQ question+answer parity, privacy contract, hub/sitemap/RSS propagation을 구현했다. Implementation `497fd527fa`, RSS `a31048a13a`, non-force main 반영을 확인했다. Pages deployment `35497086379` success, 실제 Production served HTML과 runtime 기능 검증 success, mobile 390px horizontal overflow 없음. Google Search Console과 Naver inspection은 미확인. `data/content-metadata.json`은 `METADATA_NOT_IN_CURRENT_CONTRACT`로 유지한다. TTS 링크는 별도 페이지 claim/function mismatch 대상이므로 제거했으며 TTS 페이지 자체는 건드리지 않았다. 14/28/56일 measurement를 진행한다.

- [x] 03 · 토고 비자 freshness/discovery repair
  - 완료: 2026-09-20 main 반영 완료. 한국 일반여권 visa-required 선답, Togo Voyage 공식 신청시기(홈페이지 5일/Procedures 6일/About 6영업일/FAQ 7영업일)와 7영업일 이상 권고, 현재 express visa·visa on arrival 중단 및 공식 Contact 안내, 승인 후 출발 체크리스트, 조건부 황열 안내를 반영했다. title/meta/OG·WebPage/FAQPage·hub 카드·Togo sitemap·RSS를 정합화했다.
  - 보호: canonical, GA4, AdSense, CFA 비용표, 여권 유효기간, Togo travel cluster 19개, 다른 국가 페이지는 수정하지 않았다. content-metadata의 비자 YMYL 계약은 불명확해 전역 변경하지 않고 `FOLLOW_UP_REQUIRED`로 남겼다.
  - 상태: core `c51f156240`와 RSS `339aa6638b`를 non-force fast-forward로 main에 반영했고 closure `codex/visa-03-togo-closure`에서 최종 history를 정리한다. Pages deployment 성공, 실제 served HTML 최신 확인, Search Console은 별도 확인 전이다. 14/28/56일 측정은 배포 후 수행한다.

- [x] 02 · 우크라이나 비자 safety/discovery parity repair
  - 완료: 2026-09-20 최종 검증. 현행 여행금지 standing-state source와 2026-07-09 dated notice를 유지하고, 예외적 여권사용은 재외동포365민원포털 신청 안내와 `boho@mofa.go.kr` 문의처를 반영했다. visa hub 카드 정합화, Ukraine sitemap `lastmod=2026-09-20`, 중복 WebPage JSON-LD 제거 및 관련 테스트 12 passed를 확인했다. `codex/visa-02-ukraine-merge-20260920`에서 최종 검증 완료.
  - 후속: Production 배포 후 served HTML과 Search Console URL Inspection을 확인한다. Ukraine travel cluster는 이번 범위에서 수정하지 않는다.

- [x] Keyword Hunter 생산 자동화 및 신규 수익 WINNER 발굴
  - 목적: 검색량·트렌드·경쟁도·중복을 실측 검증하고 신규 Candidate/Winner와 기존 성과 페이지 개선 후보를 자동 분리한다.
  - 완료 조건: Search Ads/DataLab 실사용, 웹문서 권한 진단, 2시간 GitHub Actions, 실제 1회 실행, 후보 목록·테스트·이력 기록.
  - 관련 영역: `scripts/keyword_hunter*.py`, `.github/workflows/keyword-hunter.yml`, `data/`, `reports/keyword-hunter/`.
  - 완료 기록: 2026-09-12. 실제 실행 신규 28, Candidate 2, Winner 2, 기존 개선 후보 20.

- [x] GitHub Actions 네이버 API secrets 및 웹문서 검색 권한 등록
  - 목적: 로컬에서 정상인 Search Ads·DataLab을 무인 실행으로 옮기고 `NAVER_WEB_SEARCH AUTH_ERROR(401)`를 해소한다.
  - 완료 조건: Search Ads 3개와 API HUB 2개 secret 등록, API HUB `Search > 웹문서 검색` 활성화, scheduled run 전체 `OK` 확인.
  - 관련 영역: Repository Actions secrets, NAVER API HUB 애플리케이션.
  - 완료 기록: 2026-09-12. Production Keyword Hunter에서 Search Ads·DataLab·NAVER Web Search가 모두 `OK`/`GRANTED`로 확인됐다.

- [x] 미국주식 `dividendYield` 단위 및 validation 수정
  - 목적: AAPL 등 일부 종목에서 배당수익률이 약 36%처럼 비정상 표시될 가능성을 제거한다.
  - 완료 조건: 데이터 원본 단위 확인, normalize 로직 수정, 이상치 validation 추가, AAPL 포함 미국주식 샘플 검증.
  - 관련 영역: `kor/stockwiki/data/stocks/`, 주식 데이터 생성 경로, `kor/stockwiki/src/pages/`.
  - 완료 기록: 2026-09-09. yfinance 퍼센트 단위의 중복 `×100` 원인을 확인하고 공통 정규화·0~20% validation·60페이지 교정·22개 회귀 테스트를 적용했다.

- [ ] 잘못된 미국주식 ticker 검증
  - 목적: `Amazon Web Services (AMZ)`처럼 독립 상장사가 아닌 항목의 생성과 노출을 막는다.
  - 완료 조건: ticker universe 생성 경로 확인, 상장 여부 validation 추가, AMZ 원본·빌드 결과·sitemap·내부 링크 제거.
  - 관련 영역: `kor/stockwiki/`, `data/finance-content-audit.json`, sitemap 및 생성 스크립트.

- [ ] annual / quarterly 재무 데이터 혼합 여부 수정
  - 목적: 연간 수치가 분기 표에 섞여 잘못 비교되는 문제를 방지한다.
  - 완료 조건: 연간·분기 데이터 소스와 label 규칙 분리 확인, Apple 등 샘플 검증, 혼합 차단 validation 추가.
  - 관련 영역: `kor/stockwiki/data/stocks/`, `kor/stockwiki/src/components/FinancialTable.astro`.

- [ ] 주식 페이지의 오래된 연도 및 `실시간` 표현 제거
  - 목적: 고정 연도와 실제 갱신 방식에 맞지 않는 표현으로 인한 신뢰 저하를 막는다.
  - 완료 조건: title/H1/meta의 불필요한 연도 제거, evergreen 구조 적용, 실제 realtime이 아니면 `실시간` 제거, 데이터 기준일 표시.
  - 관련 영역: `kor/report/stock/`, `kor/stockwiki/`, 주식 페이지 생성 로직.

## P2 - Medium

- [x] 14 · Marble Flick — /game/MarbleFlick/
  - Closed on main after the approved four-commit chain: title-frozen English canary with generation-guarded AI callbacks, stale-collision isolation, chained-motion settlement barrier, live-count winner matrix, delayed turn handoff, AI-only local replay stats, DOM-safe initialization, H1/breadcrumb semantics, accessibility, VideoGame/BreadcrumbList schema, and RSS parity.
  - Pages run `35596795290` succeeded for product SHA `7dcfc1fd65`; production served the final title, one H1, Games breadcrumb, board, mode controls, instructions, local stats, and crawlable `/game/` navigation. Runtime/mobile and Search Console evidence are recorded as partial or unavailable where applicable; 15 and coordinated locale rollout remain out of scope.

- [x] 13 · English Game Hub — /game/
  - Closed on main after the approved five-commit chain: 25-way repo/sitemap/hub parity with raw duplicate fail-closed checks, LadderGame repair, title/H1/trust copy, category/search UX, full-card anchors, exact category parity, MBTI boundary, CollectionPage-only schema, privacy/ad state, and RSS metadata parity.
  - Pages run `35593108059` succeeded for main SHA `eaf5f81d98`; production served 25 unique cards including LadderGame. Runtime/mobile and Search Console evidence are recorded as partial or not verified where unavailable. Child-to-hub recirculation remains a coordinated follow-up; 14/28/56-day checks remain pending.

- [ ] 주식 데이터 공통 Validation Layer 구축
  - 목적: ticker, company, exchange, price, market cap, PER, dividend yield, 52주 범위, 연간·분기 매출과 earnings를 한 규칙으로 검증한다.
  - 완료 조건: `NORMAL`, `MISSING`, `SUSPECT`, `ERROR` 상태 정의와 생성 차단·N/A 표시 정책, 샘플 회귀 테스트 구현.
  - 관련 영역: `kor/stockwiki/`, 데이터 생성·정규화 스크립트, `tests/`.

- [ ] 정적 페이지 QA 자동화 확장
  - 목적: 잘못된 정적 페이지가 sitemap과 배포에 포함되기 전에 차단한다.
  - 완료 조건: 빈·중복 title, 과거 연도, 잘못된 `실시간`, 주요 데이터 전체 N/A, 잘못된 ticker, broken link, sitemap 불일치 검사.
  - 관련 영역: `scripts/seo_qa.py`, `scripts/finance_content_audit.py`, `.github/workflows/seo-qa.yml`, `tests/`.

- [x] 홈페이지 정보구조 개선
  - 목적: 오래된 칼럼 카드 중심 홈을 검색과 핵심 실용 콘텐츠 중심으로 정리한다.
  - 완료 조건: 검색, 캠핑·차박, 팰월드, 무료 도구, 여행, 인기 콘텐츠, 최신 업데이트를 반응형으로 제공.
  - 관련 영역: `index.html`, `assets/home/`, `tests/test_homepage_redesign.py`.
  - 완료 기록: 2026-09-09, 커밋 `74195c0dd3`.

## P3 - Backlog

- [ ] 홈페이지 utility 우선순위 재검증
  - 목적: 실제 검색·수익 데이터가 확보되면 무료 도구/계산기 노출을 캠핑·게임보다 앞세울지 판단한다.
  - 완료 조건: 동일 28일 기간의 채널별 클릭·PV·수익을 비교하고 근거가 있을 때만 홈 순서를 변경.
  - 관련 영역: `data/page-performance.json`, `data/revenue-opportunities.json`, `index.html`.
