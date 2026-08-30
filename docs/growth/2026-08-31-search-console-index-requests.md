# 2026-08-31 Google 색인 요청 기록

최근 개선·배포한 7개 URL을 Search Console URL 검사에서 직접 확인하고 우선순위 크롤링 대기열에 제출했다.

| URL | 요청 전 상태 | 결과 |
|---|---|---|
| `/kor/report/camp/gimpo.html` | Google 색인 등록됨 | 재크롤링 요청 접수 |
| `/kor/report/camp/damyang.html` | Google 색인 등록됨 | 재크롤링 요청 접수 |
| `/kor/report/travel/spain-burgos.html` | Google에 아직 알려지지 않은 URL | 색인 요청 접수 |
| `/kor/report/travel/thailand-hatyai.html` | Google에 아직 알려지지 않은 URL | 색인 요청 접수 |
| `/kor/report/travel/sweden-malmo.html` | Google에 아직 알려지지 않은 URL | 색인 요청 접수 |
| `/kor/report/camp/yeongam.html` | Google에 아직 알려지지 않은 URL | 색인 요청 접수 |
| `/kor/report/camp/gyeongnam-best.html` | Google 색인 등록됨 | 재크롤링 요청 접수 |

## 관찰

- 7개 모두 `URL이 우선순위 크롤링 대기열에 추가되었습니다` 응답을 확인했다.
- 미색인 4개는 참조 사이트맵과 참조 페이지가 감지되지 않았다.
- 반복 제출은 대기열 우선순위를 높이지 않으므로 동일 URL은 재요청하지 않고 다음 확인 주기에 상태만 점검한다.
