# Revenue Growth Sprint 1 — 여행 허브

## P0 근거와 변경

- Search Console 최근 28일 기준 `/kor/report/travel/`: impressions 1,165, clicks 2, CTR 0.17%, average position 11.16.
- 작업 시작 시 사용자가 전달한 production GitHub 상태는 zero-byte였다. 2026-09-13 최신 `origin/main`과 당시 라이브를 다시 확인한 결과 실제 파일은 2,790,673 bytes였고, 단일 카드 목록에 `<a>` 5,233개를 렌더링하고 있었다. title은 `✈️ 국내외 여행 가이드 | 전체 목록 2026`, H1은 `✈️ 국내외 여행 가이드`였다.
- canonical `/kor/report/travel/`은 유지하면서 21,823-byte 큐레이션 허브로 교체했다. title은 `한국어 여행 정보 허브 | 여행 준비·국가별 가이드`, H1은 `한국어 여행 정보 허브`다.
- 일반 HTML `<a>` 53개를 제공한다. `/kor/` 아래 고유 목적지는 43개이며, self·개인정보·문의 3개를 제외한 실제 여행 관련 기존 콘텐츠·허브·도구는 40개다. 신규 URL은 만들지 않았다.
- 준비물, 일본 eSIM 데이터, 보조배터리 Wh, 자동차 여행비 도구와 여행자용 비자·ESTA 페이지를 연결했다. 국가·지역은 아시아, 유럽, 미주, 오세아니아로 나누고 목적별·최근 점검 섹션을 별도로 제공한다.
- GA4 `G-QP5Q67GE5B`, AdSense `ca-pub-8830524482034754`, absolute canonical, responsive CSS를 유지했다. JSON-LD는 `CollectionPage`와 화면에 보이는 12개 주요 항목의 `ItemList`로 구성했다.
- 여행 sitemap에 허브 canonical을 추가했고 기존 5천여 세부 URL은 그대로 유지했다. content-index 생성기를 실행해 허브 title·description·수정일만 갱신했으며, 세부 페이지의 대량 내부링크는 수정하지 않았다.

## 회귀 방지

- `tests/test_travel_revenue_hub.py`는 허브를 10–80KB, 고유 `/kor/` 목적지를 30–50개로 제한한다.
- 모든 큐레이션 링크가 실제 파일에 도달하는지, SEO/GA4/AdSense, `CollectionPage`+`ItemList`, sitemap/content-index의 5,000개 이상 여행 인벤토리 보존을 확인한다.
- RED: 기존 허브에서 크기, 새 검색 의도, 구조화 데이터 3건 실패. GREEN: 구현과 content-index 재생성 후 4건 통과.
- 관련 SEO·sitemap·content-index·캠핑 회귀 묶음: 56 passed.
- 전체 사이트 SEO audit: 19,086 pages, parser errors 0. baseline 비교: new critical 0, new warnings 0.

## P1 캠핑 후보 진단

이번 Sprint에서는 5개 캠핑 파일을 수정하지 않았다. 모두 self canonical, GA4, AdSense와 지역 내부링크를 갖고 있고 관련 회귀 테스트가 통과했다.

1. `namyangju.html` — 최우선. title은 허용 여부 확인 의도이나 H1의 `노지 캠핑장 완전 가이드`, 본문의 `성지`, `무료` 등 표현과 15곳의 혼합 목록이 검색 의도를 흐린다. 등록 야영장과 미확인 후보를 분리하고 최신 공식 출처를 보강할 가치가 가장 크다.
2. `cheongju.html` — title/H1과 빠른 답변은 강하지만 title의 오창 휴장 날짜가 2026-11-06 이후 즉시 낡는다. 구형 장소 카드와 최신 공식 결론 사이의 일관성도 다음 점검 대상이다.
3. `damyang.html` — canonical과 지역 링크는 정상이고 공식 확인 안내도 있다. 다만 여러 주차장·하천·공원 후보가 길게 섞여 있어 등록 야영장 중심으로 정보 밀도를 높일 여지가 있다.
4. `gimpo.html` — title/H1이 캠핑·차박 의도와 맞고 전류리포구를 허용 장소로 단정하지 않으며 고캠핑·김포시 출처가 있다. 일부 시설의 현재 운영 확인을 강화하는 정도가 후속 범위다.
5. `gwangju-g.html` — 경기도 광주시라는 지역 구분, 등록 캠핑장 우선 답변, 공식 출처, 간결한 구조가 가장 안정적이다. 다섯 후보 중 재작성 우선순위가 가장 낮다.

## 배포 상태

- 로컬 전체 pytest, main 반영 SHA, SEO QA/Pages Run ID, 라이브 QA는 배포 완료 후 최종 대화 보고에 기록한다.
