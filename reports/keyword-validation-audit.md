# Keyword Validation Audit

- 분석 기준: `data/keywords_master.csv` (851행)
- `score_valid=false`: **{len(inv)}개**

## 원인 조합별 개수

- `trend_missing|web_result_missing`: 433
- `monthly_volume_missing|trend_missing|web_result_missing`: 389
- `trend_missing`: 9
- `monthly_volume_missing|competition_missing|trend_missing|web_result_missing`: 3

## API 및 pending 상태

- Search Ads: OK
- DataLab: OK
- Web Search: OK / GRANTED
- pending_validation=true: 9개
- DataLab 사용량: 309 calls (quota 파일 기준)

## 원인 분류 및 무료 API 복구 가능성

- A 인증/권한: 관측되지 않음 (API health 정상), 복구 추정 0
- B rate limit/API 오류: 관측되지 않음, 복구 추정 0
- C 검색량 비공개·검열·데이터 없음: `monthly_volume_missing` 포함 392개; Search Ads 재조회로 일부 확인 가능하나 보장 불가
- D pending retry 미처리: pending_validation=true 9개; retry 우선 재검증 가능
- E 필드 매핑/파싱/저장: 현재 행에서 확정 증거 없음
- F 정상적으로 검증 불가능/선정 제외: trend 결측 825개 중 pending 아닌 후보 다수; DataLab 대상 선정 제한 가능성

## 이미 일부 데이터가 있는 invalid 후보

- monthly_total 존재: 567개
- trend_1m/3m 존재: 0개
- web_result_count 존재: 9개

## 잠재가치 후보 TOP 20

| 키워드 | 검색량 | 상업성 | 유형 | 결측 | 상태 |
|---|---:|---:|---|---|---|
| 연금저축추천 | 5850 | 0.9 | commercial|evergreen|informational | trend_missing|web_result_missing | NEW |
| 개인연금추천 | 4350 | 0.9 | commercial|evergreen|informational | trend_missing|web_result_missing | NEW |
| 연금저축펀드추천 | 2750 | 0.9 | commercial|evergreen|informational | trend_missing|web_result_missing | NEW |
| 강아지사료추천 | 2370 | 0.9 | commercial|evergreen|informational | trend_missing|web_result_missing | NEW |
| 고양이사료추천 | 2310 | 0.9 | commercial|evergreen|informational | trend_missing|web_result_missing | PUBLISHED |
| 개인연금저축추천 | 1460 | 0.9 | commercial|evergreen|informational | trend_missing|web_result_missing | NEW |
| 중국비자비용 | 1020 | 0.9 | commercial|evergreen|informational | trend_missing|web_result_missing | NEW |
| 연금보험추천 | 680 | 0.9 | commercial|evergreen|informational | trend_missing|web_result_missing | NEW |
| 연금저축보험추천 | 640 | 0.9 | commercial|evergreen|informational | trend_missing|web_result_missing | NEW |
| 고양이습식사료추천 | 550 | 0.9 | commercial|evergreen|informational | trend_missing|web_result_missing | NEW |
| 말티푸사료추천 | 490 | 0.9 | commercial|evergreen|informational | trend_missing|web_result_missing | NEW |
| 길고양이사료추천 | 320 | 0.9 | commercial|evergreen|informational | trend_missing|web_result_missing | NEW |
| 비과세개인연금추천 | 230 | 0.9 | commercial|evergreen|informational | trend_missing|web_result_missing | NEW |
| 중국비자발급비용 | 220 | 0.9 | commercial|evergreen|informational | trend_missing|web_result_missing | NEW |
| 고양이다이어트사료추천 | 210 | 0.9 | commercial|evergreen|informational | trend_missing|web_result_missing | NEW |
| 일시납연금보험추천 | 170 | 0.9 | commercial|evergreen|informational | trend_missing|web_result_missing | NEW |
| 애견사료추천 | 130 | 0.9 | commercial|evergreen|informational | trend_missing|web_result_missing | NEW |
| 카니발자동차검사비용 | 90 | 0.9 | commercial|evergreen|informational | trend_missing | NEW |
| 자동차검사비용할인 | 70 | 0.9 | commercial|evergreen|informational | trend_missing | NEW |
| 중국비자대행가격 | 30 | 0.9 | commercial|evergreen|informational | trend_missing|web_result_missing | NEW |

## 권장 호출 순서

1. 기존 저장 데이터 재사용 및 매핑 확인
2. `pending_validation` retry 우선 처리
3. 잔여 quota 내 신규 DataLab/Web Search 호출
4. 실측값이 모두 확보된 경우에만 score_valid 재평가

## Phase 6B 실제 수정 대상(진단 결과)

- `scripts/keyword_hunter.py`: DataLab/Web Search 대상 선정 및 batch 응답 매핑 점검
- `scripts/keyword_hunter_core.py`: pending retry 상태 전이·만료 기록 점검
- `scripts/keyword_hunter_api.py`: API 응답 누락/필드 파싱 로깅 보강
- 관련 테스트: `tests/test_keyword_hunter*.py` 및 결측·재시도 회귀 테스트

## 추천 수정 순서

1. DataLab 대상 선정/응답 매핑을 pending 후보 기준으로 검증
2. Web Search quota 배분과 캐시 재사용 검증
3. Search Ads censored volume 처리 분리
4. 관련 단위 테스트 후 production 1회 검증
