# 2026-08-21 Search Console 사이트맵 재제출 진단

## 재현

- Search Console URL-prefix 속성: `https://emfls.github.io/`
- 재제출: `/kor/report/camp/sitemap.xml`
- 제출 자체는 성공
- 마지막으로 읽은 날짜: 2026-08-21
- 결과: `사이트맵을 읽을 수 없음`, 발견된 페이지 0
- 상세 화면에도 구체 XML 오류나 HTTP 오류는 표시되지 않음

## 공개 응답 검증

- URL: `https://emfls.github.io/kor/report/camp/sitemap.xml`
- 일반 요청: HTTP 200
- Googlebot 사용자 에이전트 요청: HTTP 200
- Content-Type: `application/xml`
- 리다이렉트 없음
- UTF-8 XML 선언과 표준 `urlset` 사용
- 로컬 감사: XML 오류 0, 비표준 URL 0, 알 수 없는 URL 0

## 판단

현재 증거만으로 사이트맵 파일의 문법이나 공개 접근 실패를 원인으로 볼 수 없다. Search Console 처리 계층의 지연·상태 문제 또는 Google 실제 수집 환경과 공개 테스트 환경의 차이가 남은 원인 후보다.

따라서 같은 XML을 추측으로 반복 수정하거나 47개 사이트맵을 재제출하지 않는다. 개별 URL 색인 요청과 내부링크 강화는 계속 사용한다.

## 다음 최소 실험

XML과 Google 수집 문제를 분리하려면 canonical URL 1개만 담은 UTF-8 일반 텍스트 사이트맵을 별도 경로에 배포하고 한 번 제출한다.

- 텍스트 사이트맵도 실패: Search Console/호스팅 접근 계층 문제 가능성 증가
- 텍스트 사이트맵만 성공: XML 응답 처리 차이를 추가 조사
- 실험 결과가 나오기 전 기존 사이트맵 대량 변경 금지

## 진단 스파이크 실행

- 임시 파일: `/sitemap-probe.txt`
- 형식: UTF-8 일반 텍스트
- 포함 URL: 이미 색인된 청주 캠핑 페이지 1개
- 기존 XML 사이트맵·robots.txt에는 연결하지 않음
- 실험 목적 외 색인 확대 수단으로 사용하지 않음
- Search Console 처리 결과가 확정되면 유지 또는 제거를 결정
