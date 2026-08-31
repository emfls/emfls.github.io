# 네이버 색인·검색 성과 점검 (2026-08-31)

## 결론

- 네이버는 사이트맵을 정상 인식하고 있으며, 사이트 전체의 수집 차단도 보이지 않는다.
- 최근 30일 네이버 웹검색 성과는 약 2,800클릭, 11.6만 노출, 평균 검색 CTR 2.4%다. 전월 대비 클릭은 918.4%, 노출은 519.5% 증가했다.
- 네이버 진단의 색인 페이지는 약 1.4만 개다. 로컬 감사의 색인 가능 URL 19,063개와 비교하면 약 5천 개의 차이가 있지만, 이 수치는 반올림된 집계 차이이며 곧바로 5천 개가 모두 색인 실패라는 뜻은 아니다.
- 현재 수익과 가장 가까운 자산은 한국어 차박 콘텐츠다. 상위 검색 문서 30개 중 29개가 차박 페이지다.
- 전 페이지 재개선보다 네이버가 명시한 오류와 이미 노출이 큰 저CTR 페이지를 먼저 처리한다.

## 네이버 진단 현황

기준일: 2026-08-29~30

| 항목 | 수량 |
|---|---:|
| 색인된 페이지 | 약 14,000 |
| 서버 접근 불가 수집 실패 | 5 |
| 소프트 404 | 4 |
| description 누락 | 6 |
| title 중복 요소 | 5 |
| H1 중복 요소 | 5 |

수집 현황 그래프에서는 최근 일 수백 페이지 수준의 수집 완료가 이어지고 수집 제한은 0으로 유지됐다. 다운로드 시간도 대체로 수백 ms 수준이므로, 사이트 전체 크롤링 장애가 핵심 병목은 아니다.

## 확인된 오류 URL

### 서버 접근 불가로 수집 실패

화면에서 확인된 4개 URL이다. 네이버 집계는 5개지만 화면 표에는 4개만 표시됐다.

- `/report/travel/turkey-kirklareli.html`
- `/kor/report/travel/barbados-thegarden.html`
- `/jp/report/travel/bosnia-trebinje.html`
- `/kor/report/travel/guinea-diallo.html`

로컬 파일은 모두 존재하며 title/H1도 각각 하나다. 일시적인 GitHub Pages 응답 실패였을 가능성이 있어 재검증 대상으로 둔다.

### 소프트 404

다음 4개는 콘텐츠 문서가 아니라 OG/Twitter 이미지 URL이다. 일반 검색 수익 우선순위에서는 제외한다.

- `/images/columns/smartphone-eye-health-digital-2026-og.jpg`
- `/images/columns/smartphone-eye-health-digital-2026-twitter.jpg`
- `/images/columns/gut-microbiome-immunity-probiotics-2026-twitter.jpg`
- `/images/columns/gut-microbiome-immunity-probiotics-2026-og.jpg`

### meta description 누락

- `/util/break-even-calculator/`
- `/util/weighted-average-calculator/`
- `/util/download-time-calculator/`
- `/util/grade-calculator/`
- `/util/roi-calculator/`
- `/util/commission-calculator/`

로컬 원본에도 description이 실제로 없다. 영어 계산기라 네이버 매출 기여는 낮을 수 있으나, 수정 비용이 작고 Google SEO에도 유효하다.

### title·H1 중복

두 진단에 동일한 5개 URL이 잡혔다.

- `/kor/report/travel/turkey-bursa.html`
- `/jp/report/travel/india-surat.html`
- `/jp/report/travel/turkey-bursa.html`
- `/report/travel/turkey-bursa.html`
- `/report/travel/india-surat.html`

로컬 원본을 확인한 결과 각 파일 뒤에 다른 도시의 완전한 HTML 문서가 이어 붙어 있다. 예를 들어 Bursa 파일 뒤에는 Adana 문서가 붙어 있다. 네이버 오진이 아니라 실제 파일 결함이며 우선 수정 대상이다.

## 검색 성과와 수익 우선순위

상위 문서:

| URL | 클릭 | 노출 | 검색 CTR |
|---|---:|---:|---:|
| `/kor/report/camp/gyeonggi-best.html` | 138 | 1,816 | 7.6% |
| `/kor/report/camp/namyangju.html` | 102 | 1,490 | 6.8% |
| `/kor/report/camp/goyang.html` | 65 | 547 | 11.9% |
| `/kor/report/camp/jeongseon.html` | 60 | 603 | 10.0% |
| `/kor/report/camp/yangyang.html` | 56 | 741 | 7.6% |

노출 대비 추가 클릭 여지가 큰 페이지:

| URL | 클릭 | 노출 | 검색 CTR |
|---|---:|---:|---:|
| `/kor/report/camp/nonsan.html` | 21 | 560 | 3.8% |
| `/kor/report/camp/cheorwon.html` | 27 | 529 | 5.1% |
| `/kor/report/camp/uljin.html` | 40 | 704 | 5.7% |
| `/kor/report/camp/gyeongnam-best.html` | 31 | 510 | 6.1% |
| `/kor/report/camp/jinju.html` | 38 | 606 | 6.3% |
| `/kor/report/camp/gunsan.html` | 19 | 371 | 5.1% |
| `/kor/report/camp/yeoncheon.html` | 19 | 350 | 5.4% |

이 CTR은 네이버 검색결과 CTR이며 AdSense 광고 CTR과 무관하다. 제목을 과장하거나 광고 클릭을 유도하지 않고, 검색 의도와 실제 최신 정보를 더 잘 맞추는 방식으로 개선한다.

## 다음 작업 순서

1. 이어 붙은 5개 여행 HTML을 분리해 title/H1 중복을 제거한다.
2. 영어 계산기 6개의 고유 description을 추가한다.
3. 서버 접근 실패 URL 4개와 미표시 1개를 재검증하고, 정상 응답이면 네이버 재수집 후보로 둔다.
4. 논산·철원·울진·경남·진주·군산·연천 페이지를 최신성·검색 의도·내부링크 기준으로 점검한다.
5. 약 5천 URL의 차이는 무작정 수동 제출하지 않는다. sitemap URL 목록과 네이버 진단/성과 데이터를 분할 비교해 실제 미색인 후보만 만든다.
6. 소프트 404 이미지 4개는 수익 우선순위에서 보류한다.

## 중복 작업 방지 메모

- 네이버 사이트맵 등록 및 수집 구조는 정상으로 판정했다. 동일 점검을 반복하지 않는다.
- 전체 19,000여 페이지 재개선은 하지 않는다.
- 다음 구현은 위 1번부터 시작하며, 이후에는 네이버 노출 또는 GA4/AdSense 성과가 있는 페이지를 우선한다.
