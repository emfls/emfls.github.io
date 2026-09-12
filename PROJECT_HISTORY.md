# PROJECT HISTORY

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
