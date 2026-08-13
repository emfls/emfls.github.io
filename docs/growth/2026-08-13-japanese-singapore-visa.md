# 일본어 싱가포르 비자 수요 페이지 발행

## 수요·문제 확인

- Search Console 최근 7일 검색어: `シンガポール ビザ 種類`
- 클릭 0, 노출 7, 평균 게재순위 89.4
- 노출 URL은 일본어 페이지가 아니라 `/kor/report/visa/singapore.html`이었음
- 일본어 검색 의도와 문서 언어가 불일치하므로 기존 한국어 제목 수정이 아니라 일본어 전용 페이지가 필요하다고 판단

## 발행

- 신규 URL: `/jp/report/travel/singapore-visa.html`
- 제목: `シンガポールのビザ種類 2026｜日本人の観光・就労パス`
- 일본 국적 일반여권의 관광·단기 방문, SG Arrival Card, e-Pass 확인 절차 정리
- Employment Pass·S Pass·ONE Pass를 관광 입국과 별도 구간으로 설명
- ICA·MOM 공식 링크만 핵심 근거로 사용
- 일본어 self canonical·hreflang과 한국어 대응 페이지 hreflang 추가
- WebPage·FAQPage 구조화 데이터 및 GA4·AdSense 적용

## 발견 경로

- 일본어 마리나베이 가이드에서 내부링크
- 일본어 오차드 가이드에서 내부링크
- 일본어 우드랜즈 가이드에서 내부링크
- `/jp/report/travel/sitemap.xml`에 신규 URL과 2026-08-13 수정일 추가

## AdSense·신뢰 안전장치

- SG Arrival Card는 비자가 아니며 ICA 공식 제출은 무료라고 명시
- 관광·단기 방문 자격으로 취업할 수 없다고 명시
- 체류기간·입국을 보장하지 않고 e-Pass와 최신 공식 안내를 확인하도록 안내
- 광고 클릭 유도 또는 과도한 광고 추가 없음

## 검증·측정

- 전용 테스트 3개 통과
- 배포 후 공개 언어·제목·canonical·공식 링크 확인
- 신규 URL 수동 색인 요청
- 7~14일 후 일본어 검색어의 노출 URL이 한국어 페이지에서 신규 일본어 페이지로 이동하는지 확인

## 배포·색인 결과

- GitHub Pages 배포 성공: 커밋 `45205aee55`
- 공개 URL에서 일본어 제목·첫 답변·ICA 공식 링크·Work Pass 표 반영 확인
- 최초 Search Console 상태: `Google에는 아직 알려지지 않은 URL`, 감지된 참조 사이트맵·페이지 없음
- 신규 URL 수동 색인 요청 완료: 우선순위 크롤링 대기열 추가
- 내부링크와 사이트맵은 이번 배포에 포함됐으므로 이후 발견 출처가 갱신되는지 함께 확인
