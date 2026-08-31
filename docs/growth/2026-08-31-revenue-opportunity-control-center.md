# Revenue Opportunity Control Center 적용 기록

## 운영 전환

- PAGE_SCORE 기반 대량 개선을 중단하고 실제 검색·방문·수익 데이터 기반 `ANALYZE → SELECT → IMPROVE → MEASURE` 흐름을 추가했다.
- 기존 PAGE_SCORE, SITE_SCORE, SEO 감사와 대시보드 표는 유지했다.
- 사용자 확인 수치와 `2026-08-31-live-revenue-baseline.md`에서 일치하는 값을 수동 검증 스냅샷으로 구조화했다.
- URL별 네이버 성과와 URL별 AdSense 수익/RPM은 연결하지 않았으며 `null`과 `NOT_CONNECTED`를 유지했다.
- AdSense CTR은 점수·분류·추천·실험 KPI에 사용하지 않았다.

## CURRENT STATUS

- 28d Revenue: `$13.88` (`VERIFIED`)
- 28d Daily Average: `$0.50` (`VERIFIED`)
- Indexed Pages: `19,063`
- Revenue per Indexed Page: `$0.00072811`
- Views per Active User: `1.34`
- WINNER: `9`
- OPPORTUNITY: `0`
- EXPERIMENT: `0`
- DEAD_CANDIDATE: `0`
- INSUFFICIENT_DATA: `19,054`
- 현재 단계: `PHASE 1` — 28일 평균 `$1/day` 미만

Revenue-Producing Page Ratio, Search-Active Page Ratio와 Winner Revenue Concentration은 완전한 URL별 수익·검색 데이터가 없어 계산하지 않았다.

## TOP REVENUE OPPORTUNITIES

현재 TOP 10은 수정 순위가 아니라 보유 데이터에서 계산 가능한 분석 순위다. URL별 검색 데이터가 없는 WINNER는 수익 효율과 클러스터 추정 항목만 반영되어 점수가 낮고 상태가 `INSUFFICIENT_DATA`다.

1. `/kor/report/camp/namyangju.html` — 15.10, WINNER, `PROTECT`, COOLDOWN YES
2. `/kor/report/camp/jeongseon.html` — 12.43, WINNER, `PROTECT`, COOLDOWN NO
3. `/kor/report/camp/gyeonggi-best.html` — 9.45, WINNER, `PROTECT`, COOLDOWN NO
4. `/kor/column/maple-planet-bishop-4th-skill-quest-guide-2026.html` — 7.94, WINNER, `PROTECT`, COOLDOWN NO
5. `/kor/report/camp/yangyang.html` — 7.79, WINNER, `PROTECT`, COOLDOWN NO
6. `/` — 7.03, WINNER, `PROTECT`, COOLDOWN NO
7. `/util/qrcode/` — 7.00, WINNER, `PROTECT`, COOLDOWN NO
8. `/util/dice3d/` — 6.75, WINNER, `PROTECT`, COOLDOWN NO
9. `/ru/game/MBTI/` — 5.73, WINNER, `PROTECT`, COOLDOWN NO
10. `/ae/game/` — 5.00, INSUFFICIENT_DATA, `WAIT_FOR_DATA`, COOLDOWN NO

## 이번 실행 실제 콘텐츠 수정

- `0페이지`
- 최신 URL별 네이버 검색 노출·클릭·CTR·순위 데이터가 없어 OPPORTUNITY 요건을 검증할 수 없었다.
- 데이터가 너무 오래됐거나 URL별 데이터가 없으면 분석만 수행한다는 보호 규칙에 따라 HTML 콘텐츠, URL, canonical과 광고 배치를 수정하지 않았다.
- 신규 experiment_id를 만들지 않았으며 `data/experiments.json`은 빈 관찰 레지스트리로 시작한다.

## PROTECTED WINNERS

- 남양주 캠핑: 143 views, $0.88, $6.15/1,000 views. 2026-08-31 수정으로 COOLDOWN.
- 정선 캠핑: 88 views, $0.45, $5.11/1,000 views.
- 경기도 캠핑 BEST: 186 views, $0.42, $2.26/1,000 views.
- 양양 캠핑: 86 views, $0.16, $1.86/1,000 views.
- 메이플 비숍 4차 스킬, QR 코드, 3D 주사위, 러시아어 MBTI와 사이트 홈도 검증된 페이지 수익과 방문이 있어 WINNER로 보호했다.

PAGE_SCORE가 낮더라도 검증된 수익이 있는 WINNER는 자동 수정 후보가 되지 않는다.

## Camping Cluster

- Pages: `171`
- URL-level GA4 views: `503`
- URL-level GA4 revenue: `$1.91`
- Revenue / 1,000 views: `$3.80`
- WINNER: `4`
- OPPORTUNITY: `0`
- URL-level Naver: `NOT_CONNECTED`

캠핑/차박은 검증된 수익 클러스터이지만, 지역×검색 의도의 확장 가치는 URL별 네이버 검색어·노출·클릭 데이터가 들어오기 전에는 결정하지 않는다. 신규 지역 페이지를 만들지 않는다.

## 성장 원인

- 최근 28일 수익 변화: `+240%`
- 상태: `ESTIMATED`
- PV 성장, RPM 개선, 캠핑 기여도의 동일 기간 비교 데이터가 없어 각 요인 비중은 계산하지 않았다.
- 다음 스냅샷부터 이전 28일과 동일 범위의 PV, 페이지 효율과 URL 수익을 보존해야 원인 분해가 가능하다.

## 적용 파일

- `scripts/revenue_opportunity.py`: 데이터 상태, 설명 가능한 100점 점수, 분류, COOLDOWN과 최대 3개 선택
- `scripts/revenue_growth.py`: URL 통합 레코드, KPI, TOP 10, 캠핑 클러스터와 Markdown 보고서 생성
- `data/performance/2026-08-31.json`: 사용자 승인 수동 성과 스냅샷
- `data/optimization-history.json`: 최근 캠핑 페이지 수정 이력
- `data/experiments.json`: 실험 레지스트리
- `data/page-performance.json`: 19,063개 URL 통합 레코드
- `data/revenue-opportunities.json`: Control Center 요약과 TOP 10
- `reports/revenue-growth-report.md`: 운영 보고서
- `reports/site-quality-dashboard.html`: Revenue Growth Control Center + 기존 PAGE_SCORE 대시보드
- `.github/workflows/seo-qa.yml`: 감사→품질 점수→Revenue Opportunity→대시보드→회귀 테스트 자동화

## 다음 실행 조건

1. 최근 28일 URL별 네이버 노출, 클릭, CTR과 가능한 순위 데이터를 가져온다.
2. 동일 기간 URL별 GA4 views, users, engagement와 revenue를 전체 범위로 가져온다.
3. 가능하면 URL별 AdSense revenue/RPM을 연결하되 AdSense CTR은 가져오거나 최적화하지 않는다.
4. 시스템이 출력한 COOLDOWN 아닌 OPPORTUNITY 상위 최대 3개만 선택한다.
5. 수정 전 지표를 experiment_id에 저장하고 14~28일 동안 재수정하지 않는다.
6. 동일 기간의 수정 후 지표로 `SUCCESS`, `FAILED`, `INCONCLUSIVE`를 판정한다.

## 검증

- 기준선: `609 passed`
- 신규 집중 테스트: 데이터 freshness, 허위 수익 방지, WINNER 보호, COOLDOWN 제외, 높은 노출·낮은 CTR 점수, AdSense CTR 배제, 최대 3개 제한, DEAD_CANDIDATE 비파괴, 기간 불일치와 결정적 재실행을 검증했다.
- 집중 Revenue/대시보드/자동화 테스트: `31 passed`
- 전체 pytest 회귀 테스트: `623 passed in 50.71s`
- 전체 unittest 회귀 테스트: `Ran 552 tests`, `OK`
- 산출물 불변조건: 실제 수정 추천 3개 이하, 미연결 AdSense 허위 수익 0개, 자동 DEAD 삭제 동작 0개, 28일 수익과 Views/User 기준값 일치

---

## 3차 작업 — 네이버 URL별 성과 연결 (2026-09-01 기록)

### 데이터 품질

- 원본: Naver Search Advisor `콘텐츠 노출/클릭` UI TOP 30
- 원본 업데이트일: `2026-08-30`
- 네이버 기간: `2026-08-01~2026-08-30` (`RECENT_30_DAYS`)
- GA4·Google·AdSense 기간: `2026-08-03~2026-08-30`
- 교차 소스 상태: `PERIOD_MISMATCH` — 서로 다른 기간 수치를 합산하지 않음
- URL 매칭: `30/30 (100.0%)`
- invalid rows: `0`
- duplicate normalized URLs: `0`
- 평균 순위: `NOT_AVAILABLE`; ranking component `0/10`
- 표본 제한: `TOP_30_ONLY`, `AVERAGE_RANK_NOT_AVAILABLE`, `NO_OFFICIAL_EXPORT`
- TOP 30 밖 URL은 0이 아니라 `NOT_AVAILABLE`

### 캠핑 클러스터 네이버 기준

- 네이버 URL 데이터 보유 캠핑 페이지: `29`
- 노출 중앙값: `350`
- 클릭 중앙값: `30`
- CTR 중앙값: `8.2%`
- 가중 CTR: `7.89%`
- 최대 노출: `1,816`
- 최대 클릭: `138`

### 다음 콘텐츠 실험 후보 (아직 수정하지 않음)

1. `/kor/report/camp/uljin.html` — 704 impressions, 40 clicks, 5.7% CTR, Opportunity 48.51
2. `/kor/report/camp/nonsan.html` — 560 impressions, 21 clicks, 3.8% CTR, Opportunity 45.65
3. `/kor/report/camp/cheorwon.html` — 529 impressions, 27 clicks, 5.1% CTR, Opportunity 44.18

세 페이지 모두 캠핑 노출 중앙값 이상이고 CTR 중앙값 미만이며, 기존 WINNER가 아니고 COOLDOWN이 아니다. 다음 별도 승인 작업에서는 title·description·첫 답변 중 검색 CTR에 직접 필요한 최소 범위만 수정하고 각 페이지에 `experiment_id`를 부여한다.

### 보호와 실행 결정

- 보호 WINNER: 남양주 캠핑, 경기도 캠핑 BEST, 정선 캠핑, 양양 캠핑 및 기존 URL 수익 WINNER
- PAGE_SCORE가 낮아도 WINNER는 `PROTECT`를 유지한다.
- 이번 콘텐츠 실제 수정: `0페이지`
- 신규 페이지 발행: `0페이지`
- URL·canonical·광고 배치 변경: `0건`
- 이번 실행은 `ANALYZE → SELECT`까지만 완료했다.

### 다음 측정 방법

별도 승인 후 최대 3페이지를 수정할 때 수정 직전의 네이버 impressions/clicks/CTR과 GA4 views/revenue를 실험 레코드에 고정한다. 최소 14일, 이상적으로 28일 동안 재수정하지 않고 같은 길이의 후속 기간과 비교한다. 네이버 기간 preset이 30일이므로 28일 GA4 데이터와 직접 합산하지 않고 채널별 변화율을 별도로 판정한다. 결과는 `SUCCESS`, `FAILED`, `INCONCLUSIVE` 중 하나로 기록한다.

### 3차 검증

- unittest: `Ran 571 tests`, `OK`
- pytest: `642 passed in 50.28s`
- 동일 입력 재실행 SHA 일치 확인
- 캠핑 콘텐츠 HTML 변경: `0파일`
