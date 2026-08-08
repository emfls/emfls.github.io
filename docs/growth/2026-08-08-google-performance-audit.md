# Google 성과 점검 — 2026-08-08

## 결론

수익과 전체 유입은 개선됐지만, 최근 수정한 검색 페이지가 Google 검색 성장을 만들었다고 판단하기에는 이르다. AdSense 최근 7일 수익은 직전 7일 대비 44% 증가했고 GA4 자연검색 세션은 15.3% 증가했지만, Search Console의 Google 검색 클릭·노출·CTR·평균순위는 모두 악화됐다. 현재 전략은 `수익화가 작동한다`는 신호는 있으나 `Google SEO가 의도대로 성장한다`는 단계에는 도달하지 못했다.

## 확인 시점과 비교 범위

- 확인일: 2026-08-08, Asia/Seoul
- Search Console 최신 데이터: 2026-08-06까지, 최근 7일(2026-07-31~2026-08-06) 대 직전 7일(2026-07-24~2026-07-30)
- GA4: 홈 화면의 최근 7일 대 직전 기간 비교
- AdSense: 홈 화면의 최근 7일 대 직전 7일, 오늘·어제 현황
- 주의: 핵심 페이지 변경은 2026-08-01~03에 집중되어 Search Console 반영 기간이 3~6일에 불과함

## AdSense

- 최근 7일 예상 수입: $1.60, 직전 7일 $1.11 대비 +$0.49(+44%)
- 최근 28일 예상 수입: $4.94, 이전 28일 대비 +$3.07(+164%)
- 오늘 현재: $0.24, 페이지뷰 59, 광고 노출 152, 페이지 RPM $4.02
- 어제 emfls.github.io: $0.25, 페이지뷰 152, 클릭 14
- 최근 7일 국가별 수입: 한국 $1.33, 일본 $0.06, 우즈베키스탄 $0.05, 미국 $0.04, 중국 $0.02
- 해석: 수익은 분명 증가했지만 일평균은 약 $0.23이다. 오늘 표시 RPM $4.02가 유지돼도 일 $100에는 약 24,900 페이지뷰/일이 필요하다. 어제 실현 수익과 페이지뷰로 계산한 RPM 약 $1.64 기준이면 약 60,800 페이지뷰/일이 필요하다.

## GA4

- 최근 7일 활성 사용자 789명, +26.8%
- 조회수 약 1천, +7.9%
- 새 사용자 752명, +27.5%
- 세션: Organic Search 604(+15.3%), Direct 273(+41.5%), Unassigned 70(+536.4%), AI Assistant 15(+28.6%)
- 세션 소스: Bing organic 242(+2.0%), Direct 273(+41.5%), 모바일 네이버 referral 148(+82.7%), Naver organic 72(+16.1%)
- 해석: 전체 유입 증가는 맞지만 증가 동력은 Direct·모바일 네이버·Unassigned 비중이 크다. Google 검색 성장만의 결과로 해석하면 안 된다.
- 측정 문제: GA4 홈에 Search Console 연결 권고가 계속 표시된다. AdSense 연결은 되어 있지만 GA4–Search Console 제품 연결은 아직 완료되지 않은 상태로 보인다.

## Search Console

- 최근 7일 클릭 12 대 직전 14: -14.3%
- 노출 435 대 452: -3.8%
- CTR 2.8% 대 3.1%: -0.3%p
- 평균순위 15.3 대 13.4: 1.9위 악화
- 3개월: 클릭 172, 노출 4,540, CTR 3.8%, 평균순위 17.2
- 색인: 색인 생성 61개, 미생성 23개
- 개선 신호: 청주 1클릭/46노출(+7노출), 가평 1클릭/30노출(+4), 루마니아 1클릭/25노출(+8), 부산 1클릭/23노출(+10), 김포 1클릭/18노출, 세네갈 1클릭/6노출(+4)
- 약화 신호: 담양 클릭 2→1·노출 30→24, 슬로바키아 노출 22→15. 페이지 전체 합계도 아직 개선되지 않음

## 판정과 다음 행동

1. 작업 방향은 일부 유효하지만 성공 판정은 보류한다. 수익·전체 유입은 개선됐으나 Google 검색 KPI는 역행했다.
2. 새 페이지 추가보다 GA4–Search Console 연결과 미색인 23개 원인 확인을 먼저 한다.
3. 2026-08-15에 같은 최근 7일 비교를 다시 수행하고, 2026-08-31에 계획된 28일 판정을 유지한다.
4. 우선 수정 페이지군의 합산 클릭·노출·CTR을 별도로 추적한다. 클릭이 없는 고노출 페이지는 제목/첫 답변을 재조정하고, 노출 자체가 없는 페이지는 추가 확장을 중단한다.
5. 일 $100 목표에는 페이지 단위 미세개선만으로 부족하다. 현재 RPM 범위에서 최소 2.5만~6.1만 페이지뷰/일 규모가 필요하므로, 검색 수요가 큰 신규 주제군과 반복 방문형 도구/게임을 함께 키워야 한다.

## 데이터 한계

- Search Console 데이터는 약 2일 지연되고 변경 후 관측 기간이 짧다.
- GA4의 Organic Search에는 Google 외 Bing·Naver가 포함된다.
- AdSense 오늘 수치는 부분일이며, 페이지 RPM은 일별 변동성이 크다.
- 현재 화면 기반 점검이며 페이지별 AdSense 수익 분해는 이번 확인 범위에 포함되지 않았다.

## 2026-08-08 후속 조치

### GA4–Search Console 연결

- GA4 속성: `exchat-b9ce8`
- Search Console 속성: `https://emfls.github.io/` URL 프리픽스
- 웹 스트림: `웹게임, 유틸 사이트` (`https://emfls.github.io`)
- 결과: Google Analytics 관리 화면에서 `연결이 생성되었습니다` 확인
- 기대 효과: GA4에서 Google 자연 검색 쿼리와 방문 페이지 이후 행동을 연결해 분석할 수 있음. 보고서에 데이터가 표시되기까지 처리 시간이 필요할 수 있음

### Search Console 색인 분류

- 최신 업데이트: 2026-08-05
- 색인 생성: 62개
- 미색인: 22개, 4개 사유
- 정상 제외: 리디렉션 3개(`game/LandGrab`, `game/FlagQuest`, `game/AeroJump`)와 올바른 canonical 대체 2개(`FlagQuest/index.html`, `AeroJump/index.html`)
- 실제 기술 오류: `https://emfls.github.io/LadderGame/` 404 1개. `game/LadderGame/index.html`의 canonical이 존재하지 않는 루트 URL을 가리킴
- 품질 판단 미색인: `크롤링됨 - 현재 색인이 생성되지 않음` 16개

### 크롤링됐지만 미색인된 16개

1. `/util/EasyLetterWordCounter/`
2. `/game/FlappyDot`
3. `/jp/util/unitconverter/`
4. `/game/BlockBreaker/index.html`
5. `/game/MatrixDefense/`
6. `/kor/report/travel/australia-sydney.html`
7. `/kor/report/mabinogi-auto-gather-guide.html`
8. `/kor/report/travel/austria-bludenz.html`
9. `/jp/util/thumbnailgrabber/`
10. `/kor/report/camp/gimje.html`
11. `/jp/util/dataconvert/`
12. `/kor/report/travel/austria-bruck.html`
13. `/kor/report/travel/australia-wagga.html`
14. `/util/ImageCompressor/`
15. `/kor/report/visa/uganda.html`
16. `/kor/report/camp/bucheon.html`

### 처리 우선순위

1. LadderGame canonical 404 수정 및 배포 — 커밋 `a69d0d709e`, GitHub Pages 빌드 성공, 공개 canonical `https://emfls.github.io/game/LadderGame/` 확인. Search Console 404 유효성 검사 2026-08-08 시작
2. 이미 성장 후보에 포함된 우간다 비자 페이지 개선
3. 검색 의도가 분명한 한국어 여행·캠핑 페이지 품질 강화
4. 도구·게임 페이지는 고유 설명, 사용법, FAQ와 내부 링크를 점검한 뒤 재크롤링 유도
