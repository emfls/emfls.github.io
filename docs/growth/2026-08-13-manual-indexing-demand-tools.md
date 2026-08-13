# 검색 수요 도구 수동 색인 요청 — 2026-08-13

## 처리 결과

신규 검색 수요 도구 3개의 실제 배포를 확인하고 Google Search Console URL 검사에서 각각 색인 생성을 요청했다.

| URL | 요청 전 상태 | 요청 결과 |
|---|---|---|
| `https://emfls.github.io/kor/util/camping-packing-checklist/` | Google에 알려지지 않은 URL | 우선순위 크롤링 대기열 추가 확인 |
| `https://emfls.github.io/kor/util/japan-esim-data-calculator/` | Google에 알려지지 않은 URL | 우선순위 크롤링 대기열 추가 확인 |
| `https://emfls.github.io/kor/util/japan-travel-packing-checklist/` | Google에 알려지지 않은 URL | 우선순위 크롤링 대기열 추가 확인 |

세 페이지 모두 실제 GitHub Pages에서 제목과 H1이 정상 표시되는 것을 먼저 확인했다.

## Search Console 관찰

- 2026-08-13 개요 화면: 색인 생성 62개, 색인 미생성 22개로 표시됐다.
- 세 신규 URL에는 감지된 참조 사이트맵과 참조 페이지가 없다고 표시됐다.
- 내부 링크는 배포돼 있지만 Search Console이 아직 신규 배포를 발견하지 못한 시점의 검사 결과로 해석한다.
- 색인 요청은 크롤링 대기열 추가이며 실제 색인 또는 검색 노출을 보장하지 않는다.

## 다음 확인

- 2026-08-20: URL 검사에서 크롤링 여부와 색인 상태 재확인
- 2026-08-26: Search Console 페이지·검색어 기준 최초 노출 확인
- 2026-09-09: 28일 노출, 클릭, CTR, 평균순위와 GA4 자연검색 세션 판정
- 같은 URL을 반복 요청해도 우선순위가 올라가지 않으므로 성공 확인 전 재요청은 하지 않는다.
