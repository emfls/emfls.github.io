# PROJECT HISTORY

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
