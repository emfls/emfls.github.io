# 2026-08-21 고가치 허브 색인 점검

## 배포 확인

- 사이트맵 허브 URL 정규화 커밋 `09fa31a517`
- GitHub Pages 배포 성공
- GitHub SEO QA 성공

## Search Console 확인

| 허브 | 상태 | 조치 |
|---|---|---|
| `/kor/report/finance/` | Google 색인 등록됨 | 추가 요청하지 않음 |
| `/kor/report/visa/` | Google 색인 등록됨 | 추가 요청하지 않음 |
| `/kor/report/stock/` | Google에 아직 알려지지 않은 URL | 색인 요청 성공 |
| `/kor/report/travel/` | Google에 아직 알려지지 않은 URL | 색인 요청 성공 |

## 운영 판단

- 색인 요청 한도를 아끼기 위해 이미 색인된 금융·비자 허브는 다시 제출하지 않았다.
- 미색인 주식·여행 허브만 우선순위 크롤링 대기열에 추가했다.
- 사이트맵 정규화가 배포된 뒤 요청했으므로 Google이 canonical 허브 주소와 하위 페이지 링크를 함께 발견할 수 있는 조건을 마련했다.

## 다음 확인

- 2026-08-28: 주식·여행 허브의 색인 전환 확인
- 다음 수동 요청 대상은 아직 미색인인 허브 중 Search Console 노출 또는 GA4 수익 기여가 높은 순으로 선정
