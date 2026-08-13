# 호주 뉴캐슬 여행 0클릭 개선

## 기준 데이터

- Search Console 최근 3개월: `호주 뉴캐슬 여행` 클릭 0, 노출 3, CTR 0%, 평균 게재순위 11.0
- 연결 URL: `/kor/report/travel/australia-newcastle.html`
- 과거 URL 전체에는 클릭 이력이 있으나 현재 정확한 검색어에서는 클릭이 없어 첫 페이지 진입 직전의 CTR·의도 개선 대상으로 선정

## 공식 확인

- Visit Newcastle: Bathers Way 6km 편도, 약 3시간, Grade 2
- Newcastle Memorial Walk: 450m, Bathers Way와 연결
- Visit Newcastle은 시드니 당일치기와 주말 일정, `A Day in Newcastle` 도보 지도를 제공
- 실제 철도 시간과 공사는 Transport for NSW에서 출발일에 확인

## 적용 내용

- 제목을 `호주 뉴캐슬 여행 2026 | 시드니 당일치기·1박 2일 코스`로 변경
- 첫 답변에서 당일치기와 1박 2일 선택 기준 제시
- 당일치기 핵심 동선과 1박 2일 분산 동선을 별도 설명
- Bathers Way 6km·약 3시간과 Memorial Walk 450m를 숫자로 제시
- Visit Newcastle 공식 하루 도보 지도와 일정 링크 추가
- FAQ 구조화 데이터에 일정 선택 질문 추가
- 확인일을 2026-08-13로 갱신
- 기존 GA4·애드센스 코드와 광고 수는 변경하지 않음

## 검증

- 신규 뉴캐슬 검색 계약 테스트와 기존 호주 여행·검색 후보 회귀 테스트 총 8개 통과
- `git diff --check` 통과

## 배포·측정

- 콘텐츠 커밋: 반영 후 기록
- GitHub Pages 실행: 반영 후 기록
- 공개 페이지 확인: 반영 후 기록
- 오늘 수동 색인 요청 한도 소진으로 다음 요청 후보
- 재크롤링 뒤 정확한 검색어의 노출·평균순위·클릭과 공식 지도 링크 이동을 비교
