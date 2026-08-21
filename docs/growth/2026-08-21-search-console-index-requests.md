# 2026-08-21 Search Console 색인 요청 기록

## 개별 페이지

| URL | 확인 상태 | 오늘 요청 |
|---|---|---|
| `/kor/report/camp/cheongju.html` | Google 색인 등록됨 | 재크롤링 요청 성공 |
| `/kor/report/camp/damyang.html` | Google 색인 등록됨 | 재크롤링 요청 성공 |
| `/kor/report/camp/gimpo.html` | Google 색인 등록됨 | 재크롤링 요청 성공 |
| `/kor/report/camp/gwangju-g.html` | Google 색인 등록됨 | 재크롤링 요청 성공 |
| `/kor/report/camp/busan.html` | Google 색인 등록됨 | 재크롤링 요청 성공 |

## 캠핑 허브 발견사항

- `/kor/report/camp/`는 Search Console에서 `Google에는 아직 알려지지 않은 URL`로 확인됐다.
- 감지된 참조 사이트맵과 참조 페이지가 없다고 표시됐다.
- 색인 생성 요청은 성공하여 우선순위 크롤링 대기열에 추가됐다.
- canonical은 `/kor/report/camp/`인데 캠핑 사이트맵은 `/kor/report/camp/index.html`을 제출하는 URL 불일치를 발견했다.
- 캠핑 사이트맵 항목을 canonical 주소 `/kor/report/camp/`로 통일하고 `lastmod`를 2026-08-21로 갱신했다.

## 후속 확인

- 2026-08-28: 캠핑 허브가 `URL이 Google에 등록되어 있음`으로 전환됐는지 확인
- 2026-09-04: 대상 5페이지의 Google 노출·클릭과 GA4 페이지 수익 비교
- 사이트맵 URL 정규화 완료: 캠핑 허브 1개와 나머지 디렉터리 허브 22개의 `/index.html` 항목을 canonical 슬래시 주소로 변경
- 최신 전체 감사 결과: `unknown_url_entries: 0`, `noncanonical_url_entries: 0`, 잘못된 XML 0개
- `/index.html` 사이트맵 항목이 다시 추가되면 실패하는 회귀 테스트를 추가
