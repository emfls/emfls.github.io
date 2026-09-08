# PROJECT HISTORY

## 2026-09-08 — 일일 콘텐츠 발행 카운터 수동 초기화

- 사용자 요청에 따라 오늘 발행 카운터를 `0/3`으로 초기화했다.
- 기존 발행 페이지와 `content-launch-experiments.json`의 실험 이력은 보존했다.
- `data/content-launch-counter.json`에 `resetAt`을 기록해 초기화 시각 이후 발행만 오늘 카운트에 포함하도록 했다.
- 초기화 직후 상태: `publishedToday: 0`, `remainingCapacity: 3`.
- 회귀 테스트: `691 passed`.
