# Revenue Opportunity Control Center Design

## 목적

기존 PAGE_SCORE 중심 운영을 실제 검색·방문·수익 데이터 중심의 Revenue Opportunity 운영으로 전환한다. 기존 품질 감사와 PAGE_SCORE는 유지하되, 실제 수정 대상은 Revenue Opportunity 분석을 통과한 최대 3개 URL로 제한한다.

## 운영 원칙

- 많은 페이지를 수정하는 대신 기대값이 높은 URL만 분석·선택·개선·측정한다.
- PAGE_SCORE와 REVENUE_OPPORTUNITY_SCORE는 독립적으로 관리한다.
- 제공되지 않은 네이버·Google·GA4·AdSense 수치를 추정하거나 0으로 채우지 않는다.
- AdSense CTR은 점수, 분류, 추천, 실험 KPI에 사용하지 않는다.
- WINNER와 최근 수정 페이지를 보호한다.
- DEAD_CANDIDATE는 검토 표식이며 삭제, 통합, canonical 변경, noindex를 자동 실행하지 않는다.
- 서로 다른 기간의 성과를 합산하거나 동일 기간처럼 비교하지 않는다.

## 기존 구조와의 관계

`scripts/quality_audit.py`가 생성하는 `data/page-scores.json`, `data/site-score.json`, `SITE_SCORE.md`와 기존 PAGE_SCORE 대시보드는 유지한다. Revenue Opportunity는 별도 모듈에서 기존 점수 결과를 읽는 소비자로 구현한다. 기존 감사 또는 점수 계산의 의미를 변경하지 않는다.

## 데이터 출처와 상태

### 수동 검증 스냅샷

사용자가 확인한 2026-08-31 지표와 `docs/growth/2026-08-31-live-revenue-baseline.md`에서 일치하는 지표를 구조화된 수동 스냅샷으로 저장한다. 이 값은 `source: USER_VERIFIED_MANUAL_SNAPSHOT`, `status: VERIFIED`와 정확한 기간을 포함한다.

검증 가능한 사이트 합계는 다음과 같다.

- AdSense 오늘 수익 $0.58, PV 207, RPM $2.81, 최근 7일 $4.25, 최근 28일 $13.88, 이번 달 $14.75
- GA4 2026-08-03~2026-08-30 조회수 8,090, 활성 사용자 6,035, 사용자당 조회수 1.34, 평균 참여시간 50초, 총수익 $14.02
- 네이버 최근 성과 약 2,800 클릭, 약 116,000 노출, CTR 약 2.4%. 값이 근사치이므로 숫자 상태는 `ESTIMATED`로 기록하고 사용자 제공 출처를 보존한다.
- Google 최근 28일 클릭 49, 노출 5,264, CTR 0.93%, 평균순위 36.07

URL별 GA4 상위 페이지 수익·조회는 성장 로그에 명시된 범위만 `VERIFIED`로 구조화한다. URL별 네이버 성과와 URL별 AdSense 수익/RPM은 연결되지 않았으므로 `null`과 `NOT_CONNECTED`를 유지한다.

### 허용 상태

- `VERIFIED`: 기간과 출처가 확인된 실제 데이터
- `ESTIMATED`: 사용자 제공 근사치 또는 명시적 규칙 기반 판단
- `STALE_DATA`: 기준일에서 7일을 초과한 성과 데이터
- `NOT_CONNECTED`: 소스 자체가 연결되지 않음
- `INSUFFICIENT_DATA`: 소스는 있으나 분류 또는 결론에 필요한 표본이 부족함

각 채널 객체는 기간, 기준일, 출처, 마지막 갱신일과 상태를 가진다. 값이 없으면 `null`을 사용한다. 검증된 0과 미연결 값을 구분한다.

## URL 통합 레코드

각 indexable URL에 대해 다음 정보를 결합한다.

- URL, PAGE_SCORE, 페이지 유형
- 네이버 노출·클릭·검색 CTR과 상태
- Google 노출·클릭·검색 CTR·평균순위와 상태
- GA4 조회·사용자·참여시간·수익과 상태
- AdSense URL 수익·RPM과 상태
- 분류, Revenue Opportunity Score와 항목별 설명
- 최근 최적화일, COOLDOWN과 근거
- experiment_id와 관찰 종료일
- 구체적인 NEXT_ACTION과 이유

최근 최적화일은 `docs/growth/`의 URL별 작업 기록을 우선 사용하고, 보조적으로 Git 이력을 사용한다. 확정할 수 없으면 `null`과 `INSUFFICIENT_DATA`를 사용한다.

## Revenue Opportunity Score

총점은 100점이다.

| 요소 | 배점 |
|---|---:|
| 실제 검색 노출량 | 20 |
| 실제 검색 클릭량 | 15 |
| 검색 평균순위와 개선 가능성 | 10 |
| 검색 CTR 개선 여지 | 15 |
| 실제 GA4 또는 AdSense 수익 | 15 |
| Revenue / 1,000 PV 성격의 효율 | 10 |
| 관련 검색 의도 확장성 | 10 |
| 개선 난이도 대비 기대효과 | 5 |

노출·클릭·수익처럼 분포가 치우친 수치는 로그 정규화하고, URL별 검증 데이터가 있는 채널만 사용한다. 검색 CTR 개선 여지는 동일 채널·동일 클러스터의 중앙값과 비교한다. 평균순위는 10~30 구간과 이미 중상위인 낮은 CTR URL에 우선 가치를 준다.

검색 의도 확장성과 비용 대비 기대효과는 페이지 유형, 검증된 클러스터, 기존 검색 의도 중복, 필요한 변경 범위로 계산하며 `ESTIMATED`로 표시한다. 모든 항목은 입력값, 획득 점수, 최대 점수, 상태와 이유를 출력한다.

총점 상태는 사용된 핵심 입력에 따라 결정한다. URL별 최신 검색과 수익 데이터가 모두 검증되지 않았다면 전체 점수는 `ESTIMATED` 또는 `INSUFFICIENT_DATA`이며 실제 수정 선택을 허용하지 않는다.

## 분류

### WINNER

검증된 검색 또는 방문과 검증된 페이지 수익이 모두 존재하는 URL이다. PAGE_SCORE와 무관하게 기본 행동은 `PROTECT`다. 남양주 캠핑, 정선 캠핑, 경기도 캠핑 BEST는 현재 보호 대상이다.

### OPPORTUNITY

검증된 높은 노출, 클러스터 기준 낮은 검색 CTR, 개선 가능한 순위, 검증된 수요 또는 유사 WINNER가 있고 COOLDOWN이 아닌 URL이다. 실제 수정 후보가 될 수 있는 유일한 기본 분류다.

### EXPERIMENT

검색 수요 신호는 있으나 실적 또는 수익 표본이 부족한 URL이다. 한 실험에서 신규 또는 큰 변경은 최대 3개로 제한하며 14~28일 관찰한다.

### DEAD_CANDIDATE

동일한 검증 기간에 노출, 클릭, 직접 방문, 수익이 모두 없고 낮은 내부링크 가치와 중복 또는 thin-content 신호가 함께 있을 때만 지정한다. 자동 작업을 생성하지 않고 `DEAD_CANDIDATE_REVIEW`만 출력한다.

### 근거 부족

네 분류 중 하나를 안전하게 결정할 수 없으면 데이터를 조작해 분류하지 않는다. 분류 상태를 `INSUFFICIENT_DATA`로 표시하고 `WAIT_FOR_DATA`를 출력한다.

## 보호, COOLDOWN과 선택

- 최근 14일 안에 수정된 URL은 `COOLDOWN`이다.
- 활성 실험은 관찰 종료일까지 최대 28일 보호한다.
- 정책 오류, 기술 오류, 명확한 순위·검색 CTR·수익 급락은 예외 근거가 있을 때만 보호를 해제한다.
- WINNER는 PAGE_SCORE가 낮아도 수정 후보에 포함하지 않는다.
- 정렬 결과는 TOP 10까지 보여주되 실제 수정 추천은 최대 3개다.
- 최신 URL별 검색 데이터가 부족하면 TOP 10은 데이터 상태와 함께 분석용으로만 제공하고 실제 수정 대상을 0개로 둔다.

## NEXT_ACTION

허용 값은 `PROTECT`, `IMPROVE_SEARCH_CTR`, `IMPROVE_TOP_ANSWER`, `ADD_INTERNAL_LINK`, `UPDATE_STALE_INFO`, `EXPAND_SEARCH_INTENT`, `WAIT_FOR_DATA`, `INDEX_REQUEST_CANDIDATE`, `MERGE_REVIEW`, `DEAD_CANDIDATE_REVIEW`다. 추천은 가장 직접적인 한 가지 행동을 기본으로 하며 모호한 SEO 또는 품질 개선 문구를 사용하지 않는다.

## KPI

- Revenue per Indexed Page = 동일 28일 총수익 / indexable 페이지 수
- Revenue-Producing Page Ratio = 동일 28일 수익이 0보다 큰 URL / indexable 페이지 수
- Search-Active Page Ratio = 동일 28일 검색 노출이 0보다 큰 URL / indexable 페이지 수
- Winner Revenue Concentration = 상위 10개 URL 수익 / 전체 URL 수익
- Page Efficiency = GA4 page revenue / 1,000 views. AdSense Page RPM과 다른 지표임을 표시한다.
- Views per Active User = GA4 views / active users

분모·URL 전체 데이터가 없으면 계산 가능한 부분만 표시하고 나머지는 `N/A`와 데이터 상태를 출력한다. 부분 URL 표본으로 전체 비율을 계산하지 않는다.

## 캠핑/차박 클러스터

`/kor/report/camp/`와 명시적 캠핑 메타데이터를 클러스터로 묶는다. 동일 기간의 실제 데이터만 합산하고 페이지 수, 노출, 클릭, 검색 CTR, 조회, 수익, 페이지 효율, WINNER와 OPPORTUNITY 수를 표시한다.

지역×의도 분석은 차박, 무료 차박, 캠핑, 오토캠핑, 애견동반, 계곡, 바다, 당일, 서울 근교, 수도권, 화장실, 취사, 주차, 아이 동반, 전망, 예약, 무료, 노지를 후보군으로만 관리한다. 실제 검색 신호 또는 기존 페이지의 검증된 수요가 없으면 신규 페이지를 추천하지 않는다. 기존 페이지가 같은 의도를 충족하면 별도 페이지 생성보다 해당 페이지의 작은 개선을 우선한다.

## 실험

실험 ID는 `EXP-<CLUSTER>-YYYYMMDD-NN` 형식이다. 대상 URL, 변경 이유, 가설, 변경일, 관찰 종료일, 수정 전 지표, 현재 지표, 결과와 상태를 기록한다.

상태는 `PLANNED`, `OBSERVING`, `SUCCESS`, `FAILED`, `INCONCLUSIVE`다. 수정 후 최소 14일, 이상적으로 28일 동안 동일 URL 재수정을 막는다. 전후 기간이 같지 않거나 데이터가 stale이면 결과를 `INCONCLUSIVE`로 유지한다.

## 대시보드와 보고서

기존 대시보드 생성기를 확장해 최상단에 `REVENUE GROWTH CONTROL CENTER`를 표시한다. 기존 PAGE_SCORE 영역은 하단에 유지한다.

영역은 다음 순서다.

1. Revenue와 $1/day, $3/day, $10/day, $30/day, $100/day 단계
2. Traffic과 네이버·Google 채널 상태
3. Efficiency KPI
4. WINNER, OPPORTUNITY, EXPERIMENT, DEAD_CANDIDATE 집계
5. TODAY'S TOP OPPORTUNITIES TOP 10과 실제 수정 가능 최대 3개
6. WINNERS - DO NOT REWRITE
7. ACTIVE EXPERIMENTS와 COOLDOWN
8. 캠핑/차박 클러스터
9. 데이터 최신성 경고
10. 기존 SITE_SCORE와 PAGE_SCORE

보고서는 현재 상태, TOP 10, 실제 수정 페이지, 보호 WINNER, 캠핑 클러스터, 실험, 성장 원인과 데이터 제한을 포함한다. 성장 원인은 정확히 계산 가능한 경우만 VERIFIED로 분해하고 나머지는 ESTIMATED 또는 N/A로 표시한다.

## 파일 산출물

- `data/performance/2026-08-31.json`: 승인된 수동 성과 스냅샷
- `data/page-performance.json`: URL 통합 레코드
- `data/revenue-opportunities.json`: KPI, 분류, TOP 10, 캠핑 클러스터
- `data/experiments.json`: 실험과 관찰 상태
- `reports/revenue-growth-report.md`: 운영 보고서
- 기존 대시보드 HTML: Revenue Growth Control Center를 상단에 추가
- `docs/growth/2026-08-31-revenue-opportunity-control-center.md`: 적용 기록

루트에 `PROJECT_HISTORY.md`가 없으므로 현재 동일 목적 파일인 `docs/growth/` 날짜별 기록을 사용한다.

## 자동화 흐름

GitHub Actions는 다음 순서를 보장한다.

1. 사이트 감사
2. 최신 성과 데이터 선택과 freshness 검사
3. 기존 PAGE_SCORE와 SITE_SCORE 계산
4. Revenue Opportunity 계산
5. 보고서와 대시보드 생성
6. 회귀 테스트

외부 데이터가 갱신되지 않으면 이전 값을 최신값으로 복제하거나 임의 값을 생성하지 않는다. 생성물은 결정적으로 재실행 가능해야 한다.

## 테스트와 수용 기준

- 낮은 PAGE_SCORE만으로 WINNER가 수정 후보가 되지 않는다.
- COOLDOWN URL은 실제 수정 후보에서 제외된다.
- 같은 데이터 상태에서 높은 노출·낮은 검색 CTR URL이 더 높은 Opportunity 점수를 받는다.
- 미연결 데이터는 허위 수익값을 받지 않는다.
- AdSense CTR은 점수와 추천에 영향을 주지 않는다.
- 7일을 초과한 데이터가 STALE_DATA로 감지된다.
- 실제 수정 추천은 3개를 넘지 않는다.
- DEAD_CANDIDATE는 삭제·noindex·canonical 작업을 만들지 않는다.
- 기간이 다른 데이터를 합산하지 않는다.
- 동일 입력의 재실행 결과가 안정적이다.
- 기존 PAGE_SCORE, SITE_SCORE와 SEO QA 테스트가 계속 통과한다.

## 이번 실행의 콘텐츠 변경 결정

현재 URL별 네이버 성과가 연결되지 않았고 구조화된 기존 GSC·GA4 파일은 stale이다. 승인된 수동 스냅샷은 사이트 합계와 일부 GA4 상위 수익 URL만 제공한다. 따라서 시스템 구현 후 OPPORTUNITY 요건을 충족하는 최신 URL별 검색 데이터가 없으면 실제 콘텐츠 변경은 0개로 둔다. 이는 최대 3개 제한과 데이터가 오래되면 분석만 수행한다는 운영 규칙을 따른다.
