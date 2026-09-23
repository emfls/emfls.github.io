# PROJECT HISTORY

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
