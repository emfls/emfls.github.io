# External Web Opportunity Automation Design

## 목표

Google, Naver 및 외부 웹에서 새로운 검색 수요를 발견하고 emfls의 기존 약 19,000개 indexable 페이지와 검색 intent 중복을 제거한 뒤, 충분한 근거와 차별성을 갖춘 후보만 하루 최대 3페이지 발행한다. 운영 KPI는 총 페이지 수가 아니라 외부에서 발견한 신규 WINNER 수와 28일 평균 AdSense 수익이다.

## 실행 구조

- Codex 독립 cron 작업으로 2시간마다 실행한다.
- 기본 역할은 `RESEARCH_PIPELINE`이며 매 실행에서 10~30개 외부 후보를 탐색한다.
- 기존 `scripts/daily_revenue_growth.py`, `data/content-launch-manifest.json`, `scripts/content_launch_guard.py`와 GitHub Actions QA를 재사용한다.
- 좋은 후보가 없으면 발행하지 않고 조사, 중복 검사, 출처 수집, Content Brief 완성에 집중한다.
- 하루 발행량은 3페이지를 넘을 수 없으며 슬롯을 억지로 채우지 않는다.

## 데이터 흐름

1. 프로젝트 진행 기록과 기존 후보 DB를 읽는다.
2. Google, Naver, 공식 기관, 경쟁 사이트, 커뮤니티 등 외부 웹에서 수요 신호를 발견한다.
3. 발견 출처, 탐색 방법, 관찰된 표현, 데이터 상태를 기록한다.
4. URL, title, H1/H2, description, 주요 본문, cluster와 intent를 기준으로 사이트 전체 중복 검사를 수행한다.
5. `NO_OVERLAP`, `LOW_OVERLAP`, `MEDIUM_OVERLAP`, `HIGH_OVERLAP`, `SAME_INTENT`로 분류한다.
6. 경쟁 콘텐츠의 공통 답변과 결손을 분석하고 독립적인 `CONTENT_GAP`과 추가 가치를 정의한다.
7. 공식 출처와 신뢰 가능한 보조 출처로 사실을 검증한다.
8. Opportunity Score와 Quality Feasibility Score를 계산한다.
9. 기준을 통과한 후보에 Content Brief를 작성해 `READY_TO_LAUNCH` 큐에 적재한다.
10. 일일 슬롯이 있고 READY 후보가 충분할 때 기대값이 가장 높은 최대 3개를 발행한다.
11. QA, sitemap, 내부링크, index readiness, 기록, 커밋, push와 GitHub Actions 검증을 수행한다.

## 후보 레코드

기존 구조와 역할이 겹치지 않을 때 `data/external-content-opportunities.json`을 사용한다. 각 후보는 최소한 다음을 가진다.

- 안정적인 후보 ID와 최초·최근 발견일
- discovery source와 method
- 관찰된 검색 수요 신호와 상태
- primary·secondary intent
- category, pattern, `TRENDING` 또는 `EVERGREEN`
- closest existing page와 overlap 등급
- competition summary와 `CONTENT_GAP`
- official sources, supporting sources, 검증 상태와 검토일
- Opportunity Score와 설명 가능한 점수 구성
- Quality Feasibility Score와 설명 가능한 점수 구성
- Content Brief, 내부링크 계획, 별도 페이지 필요 이유
- 상태: `DISCOVERED`, `RESEARCHING`, `BRIEF_READY`, `READY_TO_LAUNCH`, `SAME_INTENT`, `REJECTED`, `LAUNCHED`, `FAILED_PATTERN`

이미 조사·거절·중복 판정된 후보는 새로운 증거가 없는 한 다시 조사하지 않는다.

## 점수와 출시 조건

`EXTERNAL_CONTENT_OPPORTUNITY_SCORE`는 외부 수요 신호 20, 문제 강도 10, 비중복성 20, 차별화 가능성 15, 광고 수익 가능성 15, 신뢰성 확보 10, evergreen 5, 비용 대비 효과 5로 구성한다.

`QUALITY_FEASIBILITY_SCORE`는 정확성, 자료 충족도, 공식 출처, 독자적 구성, 표·도구·비교 가능성, thin-content 위험, 질문 완결성, 유지관리 가능성을 평가한다.

`READY_TO_LAUNCH`는 다음을 모두 충족해야 한다.

- Opportunity Score 70 이상
- Quality Feasibility Score 75 이상
- overlap이 `NO_OVERLAP` 또는 `LOW_OVERLAP`
- 검색량 숫자를 추측하지 않음
- 공식·신뢰 자료와 Content Brief 확보
- 기존 페이지와 별도 URL이 필요한 이유가 명확함
- 상위 콘텐츠보다 나은 추가 가치가 최소 하나 있음
- 당일 발행량 3개 미만

## 품질·안전 장치

- 외부 사이트는 수요 발견용이며 문장, 표, 구성, 분석, 이미지를 복사하지 않는다.
- 커뮤니티는 질문 발견에만 사용하고 사실은 공식·신뢰 출처로 재검증한다.
- YMYL은 공식 출처, reviewed date, limitations와 필요한 disclaimer 없이는 발행하지 않는다.
- 확인 불가능한 사실은 `NOT_VERIFIED`로 표시하고 본문에 채워 넣지 않는다.
- `SAME_INTENT`는 `DO_NOT_CREATE` 및 `IMPROVE_EXISTING_CANDIDATE`로 처리한다.
- WINNER와 논산·철원·울진 COOLDOWN 실험을 수정하지 않는다.
- URL, canonical, 광고 위치, AdSense CTR을 자동 최적화하지 않는다.
- 지역명 치환, doorway, 경쟁 글 paraphrase, 얇은 AI 콘텐츠를 금지한다.

## 실행 보고

매 실행은 외부 발견 수, Google·Naver·기타 출처별 수, 기존 intent 거절 수, 조사 중·Brief ready·Ready 수, 당일 발행량을 기록한다. TOP 10은 발견 근거, 두 점수, closest page, overlap, Content Gap, 고품질 제작 가능 이유와 상태를 표시한다.

중요 변경은 현재 권위 있는 성장 기록과 후보 DB에 저장해 다음 실행이 같은 후보와 작업을 반복하지 않도록 한다.

## 검증

- 외부 출처 없는 후보가 READY가 되지 않는지
- SAME_INTENT가 신규 URL로 발행되지 않는지
- 두 점수 임계값이 모두 적용되는지
- 하루 3페이지 제한이 원자적으로 적용되는지
- 검색량과 사실이 임의 생성되지 않는지
- YMYL 공식 출처 요구가 작동하는지
- WINNER와 COOLDOWN이 보호되는지
- 기존 launch guard와 전체 pytest가 통과하는지
- GitHub Actions와 Pages 배포가 성공하는지

## 실패 처리

외부 검색, 공식 출처, 사이트 중복 인덱스 또는 GitHub 검증을 사용할 수 없으면 값을 추측하거나 발행하지 않는다. 상태를 `INSUFFICIENT_DATA`, `NOT_CONNECTED`, `STALE_DATA` 또는 `NOT_VERIFIED`로 기록하고 다음 실행의 조사 큐에 남긴다.
