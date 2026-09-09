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
