# URL Encoder 0클릭 검색어 개선

## 기준선

- 2026-08-13 Search Console 최근 7일: `encodeurl` 노출 3, 클릭 0
- 대상 URL: `/util/url-encoder/`
- 광고가 있는 실제 사용형 영문 도구이므로 광고가 없는 MBTI 페이지보다 먼저 개선

## 적용

- 제목을 `URL Encode & Decode Online | URL Encoder & Decoder`로 변경
- `encodeURIComponent`·`decodeURIComponent` 구성요소 처리 유지
- `encodeURI`·`decodeURI` 기반 전체 URL 처리 버튼 추가
- 쿼리값·경로 조각과 이미 조립된 전체 URL의 차이를 본문에서 설명
- 잘못된 `%` 입력 오류 처리와 결과 복사 유지
- 입력값은 브라우저에서 처리된다는 개인정보 안내 유지
- WebApplication·FAQPage의 수정일을 2026-08-13으로 갱신

## AdSense·안전

- 광고 수와 위치 변경 없음
- 광고 클릭 유도 없음
- URL 인코딩은 링크 안전성 검증이 아니라는 경고 유지

## 검증·측정

- 관련 테스트 5개 통과
- 배포 후 실제 네 가지 변환 버튼과 모바일 표시 확인
- Search Console 재색인 요청 후 7~14일간 `encodeurl`, `url encode`, `encodeURIComponent online` 노출·클릭 확인

## 배포·색인 결과

- GitHub Pages 배포 성공: 커밋 `3be9b59890`
- 공개 페이지에서 새 제목과 네 가지 변환 버튼 확인
- 실제 전체 URL 입력 결과 확인: `https://example.com/search?q=hello%20world`
- Search Console 기존 상태: `URL이 Google에 등록되어 있음`
- 변경본 수동 색인 요청 완료: 우선순위 크롤링 대기열 추가
