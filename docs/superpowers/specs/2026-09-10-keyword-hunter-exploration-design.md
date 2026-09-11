# Keyword Hunter 자율 탐색 설계

## 목표

Keyword Hunter가 사람이 넣은 예시나 기존 cluster를 반복하지 않고, 매 실행 새로운 검색 영역을 폭넓게 시험해 실제 콘텐츠 Winner를 빠르게 찾는다. 기존 Search Ads, NAVER API HUB DataLab, scoring, cache, duplicate detection은 유지한다.

## 탐색 정책

- 실행 seed 예산은 신규 테마 40%, 최근 유망 테마 30%, Winner cluster 20%, backlog 재검증 10%로 나눈다. 신규 테마 후보가 충분하면 40%를 초과할 수 있다.
- 각 seed는 기존 DB와의 거리, 최근 10회 반복 여부, 신규 category·cluster·intent, 사이트 부재, category 포화도를 반영한 0~100 `novelty_score`를 가진다.
- 각 bucket 안에서 70%는 opportunity와 novelty 순위로, 30%는 novelty·diversity 가중 sampling으로 선택한다. 실행별 random seed를 저장해 재현한다.
- breadth-first를 위해 category 20%와 cluster 10%를 기본 상한으로 둔다. 신규 강한 Winner cluster만 category 30%까지 허용한다.
- 동일 seed는 성공 조회 후 3일, 동일 cluster는 2회 cooldown한다. 3회 연속 Winner가 없는 cluster는 7일 cooldown한다. Winner cluster는 예외적으로 승격·확장할 수 있다.

## 상태와 데이터 흐름

`data/recent_exploration_history.json`에 최근 10회만 저장한다. 각 실행은 random seed, 선택 seed·source·category·cluster, 생성 keyword, 실패 seed, Winner, category/source 비중, cooldown cluster를 기록한다. `keyword_seeds.json`의 사람 입력 초기 source는 production pool에서 제거한다.

신규 외부 seed와 Search Ads에서 새로 관찰된 예상 밖의 category를 `new_theme` 후보로 만든다. 검증된 Winner는 `EXPERIMENT_THEME`, 반복 Winner는 `WINNING_THEME`, 포화 또는 연속 실패 cluster는 `SATURATED`/cooldown 상태로 관리한다. 점수가 유효하고 기준을 넘는 신규 페이지 후보는 기존 `QUEUED` 전이 경로를 유지하되 자동 발행하지 않는다.

## 보고와 성공 기준

리포트는 전체 탐색 후보, 신규·반복 seed, 신규 category·cluster, novelty ratio, 최근 seed overlap, category/source 비중, Winner 수, 신규 테마 Winner, cooldown cluster, 다음 신규 탐색 방향을 표시한다. 목표는 novelty ratio 40% 이상, 최근 seed overlap 30% 이하, category 비중 20% 이하이다. API·외부 소스 부족으로 목표를 못 채우면 수치와 원인을 그대로 기록한다.

## 검증

단위 테스트로 예시 seed 제거, 40/30/20/10 배분, novelty, cooldown, deterministic sampling, saturation, history 10회 제한, report 지표를 검증한다. 기존 Keyword Hunter 회귀 테스트 후 실제 1회 실행해 편향과 Winner 결과를 확인한다.
