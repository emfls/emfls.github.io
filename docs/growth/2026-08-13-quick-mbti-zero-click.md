# Quick MBTI Test 검색 노출 개선

## 기준

- Search Console 최근 3개월: `quick mbti test` 클릭 0, 노출 53, 평균 게재순위 69.6
- 노출 URL: `/game/MBTI/index.html`

## 적용

- 제목과 H1을 `Quick MBTI Test` 검색 의도에 맞춤
- 첫 화면에 `16 questions · about 3 minutes` 즉답 추가
- 무료, 이메일·가입 불필요, 즉시 네 글자 결과 제공을 명확히 표시
- E/I, S/N, T/F, J/P 점수 방식을 퀴즈 시작 전에 설명
- 수정일과 구조화 데이터 날짜를 2026-08-13으로 갱신

## 정책·신뢰성

- 임상·전문 성격검사가 아닌 오락·자기 성찰용 퀴즈임을 첫 화면에 표시
- 기존처럼 AdSense 광고 로딩을 비활성화한 상태 유지
- 광고 클릭 유도 및 정확도 보장 표현 없음

## 검증

- 관련 자동 검증 9개 통과
- GitHub Pages 배포 성공: `96240d184e3b2636831310ef353ed6a520d4ef27`
- 공개 페이지에서 새 제목, 첫 화면 요약, 첫 질문 동작, 광고 미로딩 확인
- `/game/MBTI/`: Google에 아직 알려지지 않은 URL이었으며 수동 색인 요청 접수 완료
- `/game/MBTI/index.html`: Google에 등록되어 있고 `quick mbti test` 검색 노출이 발생한 주소
- `index.html` 변경본 재색인 요청은 Search Console 일일 할당량 초과로 미접수; 다음 수동 요청일의 최우선 대상으로 이월

## 주소 관찰

- 페이지 canonical은 `/game/MBTI/`이지만 현재 검색 실적은 `/game/MBTI/index.html`에 집계된다.
- 이번에는 검색 중인 주소를 제거하거나 리디렉션하지 않는다. 7~14일 후 Google 선택 주소와 실적 이동을 확인한 뒤 통합 여부를 판단한다.
