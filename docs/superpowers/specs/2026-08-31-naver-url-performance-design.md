# Naver URL Performance Integration Design

## 목적

네이버 Search Advisor의 실제 URL별 검색 성과를 Revenue Opportunity 시스템에 연결하고, 데이터 품질을 먼저 검증한 뒤 콘텐츠를 수정하지 않은 상태에서 실제 OPPORTUNITY와 최대 3개의 수정 가능 후보를 선별한다.

## 확인된 데이터 표면

2026-08-31 Chrome의 로그인된 네이버 Search Advisor `콘텐츠 노출/클릭` 화면을 확인했다.

- 사이트: `https://emfls.github.io`
- 최근 업데이트: `2026-08-30`
- 지원 기간: 최근 1일, 7일, 30일, 60일, 90일
- 선택 기간: 최근 30일
- URL 데이터: 검색 웹문서 TOP 30
- 제공 지표: 클릭, 노출, CTR
- 평균 순위: 제공하지 않음
- CSV·Excel 다운로드: 현재 화면에서 제공하지 않음
- 사이트 합계: 약 2.8천 클릭, 약 11.6만 노출, 평균 CTR 2.4%

따라서 이번 연결은 전체 URL export가 아니라 실제 UI TOP 30 스냅샷이다. 30개 중 29개가 `/kor/report/camp/` 페이지이고 나머지 1개는 한국 기념품 페이지다.

## 접근 방식

공식 UI에 표시된 TOP 30 데이터를 `VERIFIED_UI_SNAPSHOT`으로 저장한다. 검색 결과 크롤링, 숫자 추정 또는 비공개 내부 API 호출은 사용하지 않는다.

향후 공식 CSV가 제공되면 같은 정규화·검증 인터페이스에 CSV adapter를 추가할 수 있게 하되, 현재 필요하지 않은 브라우저 자동 수집 시스템이나 비공개 API 의존성은 만들지 않는다.

## 기간과 상태

네이버의 `최근 30일`은 마지막 업데이트일 2026-08-30을 포함하는 2026-08-01~2026-08-30으로 기록한다. 원본 preset과 업데이트일을 함께 보존한다.

- Naver: 2026-08-01~2026-08-30, `VERIFIED`, `RECENT_30_DAYS`
- GA4: 2026-08-03~2026-08-30, `VERIFIED`, 28일
- Google: 2026-08-03~2026-08-30, `VERIFIED`, 28일
- AdSense: 2026-08-03~2026-08-30, `VERIFIED`, 28일
- Cross-source period alignment: `PERIOD_MISMATCH`

네이버 URL 지표 자체는 실제 UI 값이므로 `VERIFIED`다. 교차 소스 결합 상태는 별도로 `PERIOD_MISMATCH`다. 평균 순위는 `null`, 상태는 `NOT_AVAILABLE`이다.

Search Advisor TOP 30에 없는 URL은 0으로 간주하지 않는다. 해당 URL의 네이버 채널은 모든 수치가 `null`이고 `status: NOT_AVAILABLE`이다. 실제 export에 URL이 존재하면서 지표가 0으로 확인될 때만 `ZERO_VERIFIED`를 사용한다.

## 원본 스냅샷

`data/naver/search-advisor-2026-08-30.json`을 생성한다.

각 행은 다음 필드를 가진다.

- `sourceUrl`: UI에 표시된 절대 URL
- `url`: 정규화된 사이트 경로
- `clicks`
- `impressions`
- `ctr`
- `averageRank: null`
- `rankStatus: NOT_AVAILABLE`
- `periodStart: 2026-08-01`
- `periodEnd: 2026-08-30`
- `periodPreset: RECENT_30_DAYS`
- `dataUpdatedAt: 2026-08-30`
- `status: VERIFIED`
- `source: NAVER_SEARCH_ADVISOR_UI_TOP_30`

화면의 검색어 TOP 30은 URL과 직접 결합할 수 없으므로 별도 `queries` 배열에 원본 집계로만 저장한다. URL별 검색어라고 오해할 수 있는 join을 만들지 않는다.

## URL 정규화

기존 `scripts.quality_site.normalize_url`을 단일 기준으로 확장한다.

정규화 규칙:

- `http://`, `https://`, `www` origin 제거
- query parameter와 fragment 제거
- 빈 경로는 `/`
- percent encoding은 UTF-8로 한 번 decode하고 안정적으로 비교
- `/index.html`은 디렉터리 경로로 변환
- 루트 외 trailing slash는 사이트 canonical inventory와 대조해 통일
- 경로 대소문자는 보존하되 exact match를 먼저 사용하고 case-insensitive 후보는 자동 확정하지 않고 충돌 보고
- canonical URL은 `data/site-audit.json`의 canonical map으로 최종 대조

정규화 결과가 여러 사이트 URL로 충돌하면 자동 매칭하지 않는다.

## 데이터 품질 게이트

import 결과는 다음 통계를 출력한다.

- Naver rows
- Unique Naver URLs
- Matched to site
- Match rate
- Unmatched
- Duplicate normalized URLs
- Invalid rows
- Period status
- Rank availability

Opportunity 계산 조건:

- 행이 1개 이상
- invalid row가 없음
- 중복 정규화 충돌이 없음
- 사이트 매칭률 95% 이상
- 모든 행의 기간·출처·클릭·노출·CTR이 검증됨
- CTR과 `clicks / impressions`의 차이가 반올림 허용 범위 안임

게이트 실패 시 네이버 데이터는 저장할 수 있지만 Opportunity 재분류와 수정 후보 선별을 중단한다. 대시보드에 `⚠ OPPORTUNITY RANKING NOT RELIABLE`을 표시한다.

## Page Performance 통합

TOP 30 매칭 URL만 기존 `naver` 채널을 다음처럼 갱신한다.

- `impressions`, `clicks`, `ctr`
- `position: null`
- `positionStatus: NOT_AVAILABLE`
- `period`
- `periodPreset`
- `dataUpdatedAt`
- `source`
- `status: VERIFIED`
- `crossSourceStatus: PERIOD_MISMATCH`

나머지 URL은 `NOT_AVAILABLE`로 유지한다. 기존 GA4, Google, AdSense와 PAGE_SCORE는 변경하지 않는다.

## 캠핑 벤치마크

평균 순위가 없으므로 rank bucket 중앙값을 만들지 않는다. 보고서에 `Rank benchmark: NOT_AVAILABLE`을 표시한다.

캠핑 TOP 29의 실제 분포에서 다음을 계산한다.

- 노출, 클릭, CTR의 median
- 노출·클릭 percentile
- CTR percentile
- 전체 클릭/전체 노출로 계산한 weighted CTR
- Naver-data-covered pages

최소 수요 기준은 하드코딩된 노출 숫자가 아니라 네이버 데이터가 있는 캠핑 페이지의 노출 중앙값 이상으로 한다. 상위 30이라는 잘린 표본임을 명시한다.

## Opportunity 재분류

기존 100점 배점은 유지한다.

- Search impressions 20
- Search clicks 15
- Ranking opportunity 10
- Search CTR improvement room 15
- Actual revenue 15
- Revenue efficiency 10
- Intent expansion potential 10
- Expected impact / cost 5

네이버가 있는 URL은 검색 신호의 주 채널로 사용한다. impression·click 점수는 캠핑 표본 percentile과 log normalization을 조합해 outlier 영향을 제한한다.

Ranking opportunity는 평균 순위가 없으므로 0점과 `NOT_AVAILABLE`을 부여한다. 다른 항목으로 재분배하지 않는다.

CTR improvement room은 다음 조건을 모두 만족할 때만 부여한다.

- 노출이 캠핑 표본 중앙값 이상
- CTR이 캠핑 CTR 중앙값보다 낮음
- impressions > 0

OPPORTUNITY 조건:

- 네이버 URL 데이터 `VERIFIED`
- 데이터 품질 게이트 통과
- 캠핑 또는 검증된 수익 클러스터
- 노출이 클러스터 중앙값 이상
- CTR이 클러스터 중앙값 미만
- WINNER 아님
- COOLDOWN 아님
- 최근 대규모 수정 없음

평균 순위 부재 때문에 수정 가능 후보의 전체 상태는 `VERIFIED_WITH_LIMITATIONS`로 표시한다. 실제 콘텐츠는 이번 단계에서 수정하지 않는다.

## WINNER와 COOLDOWN

남양주, 정선, 경기도 캠핑 BEST, 양양과 기존 수익 WINNER는 새 네이버 데이터가 들어와도 기본 `PROTECT`다.

`data/optimization-history.json`을 `docs/growth/`의 최근 캠핑 작업 기록과 대조해 TOP 30 URL의 최근 수정일을 보강한다. 최근 14일 URL과 활성 실험은 후보에서 제외한다.

## 출력

`data/revenue-opportunities.json`과 `reports/revenue-growth-report.md`에 다음을 추가한다.

- `dataQuality.naver`
- `crossSourcePeriodAlignment`
- Naver TOP 30 match 통계
- 캠핑 Naver coverage와 집계
- median·percentile benchmark
- TOP 10의 실제 Naver 지표, CTR benchmark, GA4, PAGE_SCORE, last optimization, cooldown, 이유와 행동
- 수정 가능 후보 최대 3개
- 이번 콘텐츠 실제 수정 0개

대시보드 최상단은 기간 불일치와 TOP 30 한계를 경고한다. 매칭 게이트가 통과하면 “URL matching verified”를 표시하되, `PERIOD_MISMATCH`와 `RANK_NOT_AVAILABLE` 경고는 유지한다.

## 테스트

- 절대 URL, query, fragment, `index.html`, percent encoding 정규화
- 실제 0과 NOT_AVAILABLE 구분
- CTR 산술 검증
- 중복 정규화 URL 탐지
- invalid row 탐지
- 95% 미만 매칭 시 Opportunity 계산 차단
- 95% 이상 매칭 시 계산 허용
- 평균 순위 null 유지와 ranking 0점
- 낮은 노출·낮은 CTR 페이지 제외
- 중앙값 이상 노출·중앙값 미만 CTR 페이지 우대
- WINNER 보호
- COOLDOWN 제외
- 최대 수정 가능 후보 3개
- DEAD_CANDIDATE 대량 생성 방지
- PERIOD_MISMATCH 표시
- AdSense CTR 미사용
- 결정적 재실행

## 이번 실행의 콘텐츠 변경 결정

이번 단계는 데이터 연결과 후보 선별까지만 수행한다. 데이터 품질 게이트가 통과하더라도 HTML 콘텐츠, title, description과 첫 답변은 수정하지 않는다. 최종 보고서에 최대 3개의 수정 가능 후보와 변경 가설만 제시한다.
