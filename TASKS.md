# Tasks

작업 완료 후 항목을 삭제하지 말고 `[x]`로 변경한다. 같은 우선순위에서는 위 항목부터 수행한다.

## P0 - Critical

- 현재 확인된 배포 차단 또는 정책 위반 없음.

## P1 - High

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
