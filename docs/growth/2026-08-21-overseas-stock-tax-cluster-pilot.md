# 해외주식 양도소득세 클러스터 파일럿

- 적용일: 2026-08-21
- 목표: 검증되지 않은 금융 단정을 줄이고, 검색 의도가 분명한 pillar→계산기→관련 가이드 흐름 구축
- 대표 URL: `/kor/column/overseas-stock-tax-2026.html`
- 신규 도구: `/kor/util/overseas-stock-tax-calculator/`

## 적용 내용

- 근거 없는 “3년마다 재계산” 제목과 “양도세 사실상 0” 단정을 제거했다.
- 국세청 세액계산요령, 소득세법 제103조, 국세청 신고 안내를 표시했다.
- 연 250만원 기본공제, 국세 20%, 지방소득세 참고액을 분리하는 브라우저 계산기를 추가했다.
- 입력값은 외부로 전송하지 않으며 계산기 주변에 수동 광고를 배치하지 않았다.
- pillar, 계산기, ETF 분배금, 금융소득 종합과세, ISA 가이드를 양방향 연결했다.
- 전체 사실 검증을 마치지 않은 관련 글 3개에는 `last_verified`를 부여하지 않았다.

## 검증 결과

- 신규 계약 테스트: 5개 통과
- 전체 unittest: 444개 통과
- 전체 pytest: 511개 통과
- SEO QA: 신규 critical 0, 신규 warning 0
- site audit: 19,066페이지, parser error 0

## 성과 관찰

28일 동안 계산기 organic impressions/clicks, `tool_use`, pillar↔계산기 내부 이동을 확인한다. 광고 CTR은 성공 KPI로 사용하지 않는다.
