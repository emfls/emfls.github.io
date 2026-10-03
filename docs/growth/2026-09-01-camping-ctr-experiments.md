# 캠핑 검색 CTR 3페이지 제한 실험

## 실행 결정

- 시작일: 2026-09-01
- 관찰 종료 예정일: 2026-09-29
- COOLDOWN 종료일: 2026-09-29
- 수정 범위: title, meta description, 첫 핵심 답변 2문장
- 실제 수정 URL: 논산, 철원, 울진 3개
- 검색 의도 상태: `ESTIMATED_SEARCH_INTENT`
- Naver rank: `NOT_AVAILABLE`
- 교차 소스 기간: `PERIOD_MISMATCH`
- GA4 URL별 baseline: `NOT_CONNECTED`; 추정값을 만들지 않음

캠핑 TOP30의 CTR 중앙값 8.2%는 표본 선택 편향이 있을 수 있으므로 절대 성공 목표로 사용하지 않는다. 각 페이지의 이전 30일 baseline 대비 변화로만 판정한다.

## EXP-CAMP-NONSAN-CTR-20260901

- URL: `/kor/report/camp/nonsan.html`
- Before title: `논산시 노지 캠핑장 완전 가이드 2025 | 황산대교부터 탑정호수변공원까지 금강과 호수의 캠핑 성지 8곳 총정리`
- After title: `논산 캠핑·차박 장소 8곳 | 주차·화장실·야영 전 확인사항`
- Before description: `논산시 노지 캠핑장 8곳 완전 정복! 황산대교부터 탑정호수변공원까지. 덕바위마을 캠핑장, 대둔산 수락캠핑장 등 금강과 호수가 어우러진 힐링 캠핑의 모든 것을 한번에 확인하세요.`
- After description: `논산 황산대교·탑정호 주변과 등록 캠핑장 8곳을 비교합니다. 장소별 주차·화장실·취사 정보와 야영 전 확인할 현장 제한을 정리했습니다.`
- 첫 답변: 황산대교·탑정호 주변 후보와 등록 캠핑장을 구분하고, 8곳의 주차·화장실·취사 및 야영 허용 확인 기준을 2문장으로 제시
- Baseline: 560 impressions, 21 clicks, 3.8% CTR

## EXP-CAMP-CHEORWON-CTR-20260901

- URL: `/kor/report/camp/cheorwon.html`
- Before title: `철원 캠핑 2026 | 등록 캠핑장·야영 가능 여부 확인`
- After title: `철원 캠핑·차박 장소 정리 | 한탄강·등록 캠핑장 이용 전 확인`
- Before description: `철원 캠핑을 준비할 때 등록 캠핑장과 한탄강·공원·주차장의 야영 가능 여부를 구분하고, 현장 금지 안내와 공식 운영 정보를 확인하는 방법을 안내합니다.`
- After description: `철원 승일교·한탄강 주변과 등록 캠핑장을 비교합니다. 장소별 주차·화장실 정보, 야간 차박·취사 제한과 출발 전 확인사항을 살펴보세요.`
- 첫 답변: 승일교·한탄강 관광지와 등록 캠핑장을 구분하고, 주차·화장실·야간 숙박·취사 제한을 2문장으로 제시
- Baseline: 529 impressions, 27 clicks, 5.1% CTR

## EXP-CAMP-ULJIN-CTR-20260901

- URL: `/kor/report/camp/uljin.html`
- Before title: `울진군 노지 캠핑장 완전 가이드 2025 | 구산해수욕장부터 불영계곡까지 무료 차박 성지 6곳 총정리`
- After title: `울진 캠핑·차박 장소 6곳 | 해변·계곡 주차·화장실 확인`
- Before description: `울진군 노지 캠핑장 6곳 완전 정복! 구산해수욕장 무료 차박부터 불영계곡 감성 캠핑까지. 봉평해수욕장, 염전해변캠핑장, 금강송 캠핑장 등 대구 근교 3시간 거리 동해바다 캠핑의 모든 것을 한번에 확인하세요.`
- After description: `울진 구산·봉평 해변과 불영계곡 주변 캠핑 장소 6곳을 비교합니다. 주차·화장실·취사 정보와 야영 전 확인할 현장 제한을 정리했습니다.`
- 첫 답변: 구산·봉평 해변과 불영계곡 주변을 비교하고, 6곳의 주차·화장실·취사 및 야영 허용 확인 기준을 2문장으로 제시
- Baseline: 704 impressions, 40 clicks, 5.7% CTR

## 공통 가설

이미 의미 있는 네이버 노출이 있는 페이지의 검색 의도를 바꾸지 않고 title, description, 첫 답변의 일치도를 높이면 페이지 자체 baseline보다 검색 CTR이 개선될 가능성이 있다.

## 판정 규칙

동일한 후속 기간의 impressions, clicks, CTR을 함께 비교한다.

- CTR 상대 변화 +20% 이상: `SUCCESS`
- +5% 이상 +20% 미만: `POSITIVE`
- -5% 초과 +5% 미만: `INCONCLUSIVE`
- -5% 이하: `NEGATIVE`

노출과 클릭의 절대 변화도 함께 기록한다. GA4 views·revenue·revenue/1,000 views는 동일 기간 URL별 데이터가 확보될 때만 보조 판정에 사용한다. 수정 다음날이나 14일 이전에는 성과를 판정하거나 재수정하지 않는다.

## 보호 확인

- 남양주: unchanged
- 경기도 BEST: unchanged
- 정선: unchanged
- 양양: unchanged
- 다른 캠핑 페이지: unchanged
- URL, canonical, H1, 주요 본문, 광고, GA4: unchanged

## 2026-10-03 — 명시적 INCONCLUSIVE 종료 및 최신-main 재검증

- 기준 commit: current `origin/main` `255e4b543ec9c4d82988a6ad6fa5dc0541ccef4b` (PR #33 merge). Nonsan, Cheorwon, Uljin의 실험 레코드를 모두 `status=result=INCONCLUSIVE`로 수동 종료했다. 공통 사유는 `COMPARABLE_MATCHED_PERIOD_NAVER_DATA_UNAVAILABLE`; 세 레코드 모두 원래 `before`를 유지하고 `after` 데이터는 만들지 않았다.
- 비교 한계: baseline은 Naver 2026-08-01..2026-08-30이다. 저장된 baseline counts는 Nonsan 21/560, Cheorwon 27/529, Uljin 40/704다. Naver UI에서 확보한 rolling-30 값은 절대 날짜 구간을 노출하지 않아 판정에 사용하지 않았다: Nonsan 162/1,998, Cheorwon 169/4,583; Uljin은 TOP 30에 없어 `NOT_AVAILABLE`이며 0이 아니다. 저장소 snapshot `data/naver/search-advisor-2026-09-17.json`은 2026-08-19..2026-09-17, TOP-30 수동 UI 데이터이고 2026-10-03 기준 `STALE_DATA`; GA4/GSC와 기간도 맞지 않는다.
- 오염 점검: 실험 시작 commit `ed4706be132992e7ca48669053c9d1682fff0359`가 의도된 3개 대상 페이지를 수정했다. 그 commit 뒤 현재 main까지 Nonsan/Cheorwon/Uljin HTML 변경 commit은 없고, closure branch working tree에서도 이 세 HTML은 변경되지 않았다. 남양주·경기도 BEST 및 다른 protected pages는 건드리지 않았다.
- slot contract: 최신 main에서 이 세 레코드는 `OBSERVING`이라 selector가 활성 실험 3개를 세고, 최대 3개 슬롯 중 가용 수를 0으로 계산해 `selectedImprovements=[]`였다. 종료 후 활성 수는 0, selector slots는 3이며 최신 pipeline의 `selectedImprovements`는 3개다. `EXPERIMENT=0`은 진행 중 실험 분류 수이며 selector의 개선 후보 수와 다른 지표다.
- 최신 재생성: 현재 checkout HTML에서 `seo_audit.py`로 19,030 URL / 19,027 indexable / parser errors 0의 inventory를 만들고, `quality_audit.py`로 2026-10-03 page-score inventory를 재생성한 뒤 Naver quality validation과 revenue pipeline을 실행했다. GA4 기간은 2026-09-04..2026-10-01, GSC는 2026-09-02..2026-09-29로 각 source의 native period를 유지했다. Naver는 2026-08-19..2026-09-17의 오래된 TOP-30 snapshot 상태를 유지한다. measurement validator는 19,027 URLs, `asOf=2026-10-03`으로 PASS.
- 산출물: `WINNER=1,568`, `OPPORTUNITY=35`, `EXPERIMENT=0`, `INSUFFICIENT_DATA=17,424`. 최대 3개 selector 제안은 `/util/url-encoder/` (GSC 58 impressions/0 clicks/position 23.17; GA4 3 views), `/kor/report/travel/sweden-malmo.html` (12/0/12.75; 1 view), `/kor/report/visa/singapore.html` (102/1/CTR 0.98%/23.22; 4 views)다. 첫 두 건은 적은 GSC 표본이며 현재 title/description과 페이지 목적 사이의 구체적 불일치를 입증하지 못해 `NO_ACTION`; 싱가포르 비자 페이지는 이민/YMYL이므로 제외했다. 세 URL 모두 직접 AdSense 데이터는 `NOT_CONNECTED`; URL별 GA4 `totalAdRevenue`를 AdSense revenue로 취급하지 않았다. 실제 콘텐츠 편집 0.
- Local verification: closure/revenue focused tests 67 passed; full unittest 742 passed; full pytest 1,183 passed; launch guard PASS; measurement artifact validator PASS; `git diff --check` PASS. Repository artifacts `data/page-scores.json`, `data/page-performance.json`, `data/revenue-opportunities.json`, `reports/revenue-growth-report.md`는 이 current-main regeneration 결과다.
- 변경 범위는 실험 registry, 해당 closure 문서와 회귀 테스트, 최신 page-score/performance/revenue generated artifacts 및 report, TASKS/PROJECT_HISTORY로 제한한다. Public content/URL/hub/sitemap/manifest/IndexNow는 변경하지 않았다. Delivery/commit/PR/remote exact-head CI는 아직 pending.
- 추가 public pages: 0. Revenue: `NO_CONCLUSION`.
