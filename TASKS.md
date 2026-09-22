# Tasks

작업 완료 후 항목을 삭제하지 말고 `[x]`로 변경한다. 같은 우선순위에서는 위 항목부터 수행한다.

## P0 - Critical

- [ ] P0 Support — CI Baseline GA4 Contract 5건 복구
  - 목적: 기존 main의 unittest baseline에서 실패한 5개 GA4 batch contract를 최신 페이지 의미와 정합화해 P0 Revenue Growth #02 PR을 재검증한다.
  - 분류: Ukraine / Togo / MBTI JSON-LD 위치 검사는 `STALE_TEST_CONTRACT`; MarbleFlick의 자기 링크 및 English game hub의 `Related`/고정 max-width 문구 검사는 최근 전용 페이지 계약과 충돌하는 `STALE_TEST_CONTRACT`. 페이지 파일은 수정하지 않는다.
  - 변경: 공통 semantic JSON-LD parser가 페이지 내 JSON-LD 스크립트 위치와 무관하게 기대 `@type`, canonical URL, 유효 JSON 및 `dateModified >= 2026-08-11`을 확인한다. MarbleFlick expected hub를 `/game/`로 맞추고 game hub 배치 검사는 실제 검색/필터/게임카드/반응형 grid affordance를 확인한다.
  - 검증: exact 5 tests 및 MarbleFlick/game hub 전용 테스트 통과; 전체 unittest 694 passed; 전체 pytest 1,006 passed; `git diff --check` 통과. PR #2 run `35709859333`에서 helper 경로명 때문에 guard 오탐이 확인되어 파일명을 `schema_contract_helpers.py`로 바꿨다. 재실행 SEO QA pending.

- 현재 확인된 배포 차단 또는 정책 위반 없음.

- [x] Revenue Growth Sprint 1 — 기존 여행 허브 수익 경로 복구
  - 목적: Search Console 노출이 있으나 탐색성이 낮은 `/kor/report/travel/`을 기존 canonical 그대로 실용적인 한국어 여행 정보 허브로 개선한다.
  - 완료 조건: 30–50개 실제 링크, 준비·지역·목적·주요 콘텐츠 탐색, GA4·AdSense·모바일·구조화 데이터, sitemap/content-index 보존, 회귀 테스트와 캠핑 P1 진단.
  - 완료 기록: 2026-09-13. 2.79MB/5,233링크 목록을 21.8KB/43개 고유 `/kor/` 목적지 허브로 교체하고 캠핑 후속 우선순위를 남양주→청주→담양→김포→경기도 광주로 정리했다.

- [ ] P0 Revenue Growth #02 — GA4 refresh에서 최신 GSC 기회 신호 보존
  - 근거: live main의 GA4 workflow가 `revenue_growth.py`에 GSC snapshot을 전달하지 않아 GA4 실행 후 page-performance의 Google 채널이 `NOT_CONNECTED`로 재생성될 수 있다. latest `gsc-latest.json` 110 rows를 병합한 temporary regeneration에서는 VERIFIED Google URL 106개와 OPPORTUNITY 38개가 확인됐다.
  - 변경: GA4 workflow가 `data/performance/gsc-latest.json`을 함께 전달하도록 수정하고 workflow 계약 회귀 테스트를 추가했다. 콘텐츠 URL은 수정하지 않았다.
  - 상태: `codex/p0-revenue-growth-02`에서 구현·검증; 아직 main 배포 전. GA4 Collection 1회 재실행 후 실제 artifact와 분류를 확인한다.
  - CI follow-up: SEO QA run `35703819990`에서 `scripts/content_launch_guard.py`가 workflow 파일명 `ga4-collection.yml`을 analytics runtime 변경으로 오탐했다. exact-path allowlist와 runtime asset 차단 회귀를 같은 PR에 추가했으며, 새 원격 SEO QA green 확인 전 merge 금지.

## P1 - High

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
