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

