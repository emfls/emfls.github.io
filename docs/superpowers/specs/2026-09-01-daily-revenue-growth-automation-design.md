# Daily Revenue Growth Automation Design

## 목적

2026-09-01 오후 2시(Asia/Seoul)를 기준으로 5시간마다 실제 검색·수익 근거를 읽고 신규 수익 후보 10~20개를 조사한 뒤, 기존 19,000여 페이지와 검색 intent가 겹치지 않는 강한 후보만 기본 3개, 최대 5개까지 자동 발행한다. 실행 시각은 14:00 → 19:00 → 다음 날 00:00 → 05:00 → 10:00처럼 연속하며 날짜가 바뀔 때 특정 시각으로 초기화하지 않는다. 목표는 페이지 수가 아니라 WINNER 수, 신규 페이지 승률과 28일 평균 수익을 높이는 것이다.

## 실행 구조

자동화는 Codex heartbeat와 GitHub Actions의 하이브리드 구조를 사용한다.

### Codex heartbeat

- 2026-09-01 14:00 KST를 시작점으로 5시간마다 현재 로컬 프로젝트 작업을 재개한다.
- 프로젝트 이력, Revenue Opportunity, 검색·수익 데이터, 활성 실험과 최근 발행 기록을 먼저 읽는다.
- 실제 검색 수요 조사, 의미 기반 intent 중복 판단, 콘텐츠 작성, 로컬 검증, 커밋과 `main` push를 담당한다.
- 로컬 환경, 로그인 세션 또는 직접 검색 수요 데이터 접근이 불가능하면 추정으로 대체하지 않고 발행 0페이지로 종료한다. 이 경우 후보와 실패 원인은 기록하되 기존 페이지와 콘텐츠 파일은 변경하지 않는다.

### GitHub Actions

- push된 변경에 대해 결정적 안전 게이트, SEO 감사와 전체 회귀 테스트를 실행한다.
- 보호 URL, 발행 한도, 실험 한도, 중복 URL, canonical, sitemap, 광고 정책과 구조화 데이터를 검증한다.
- 일반 콘텐츠에 Google Indexing API를 사용하지 않는다.

heartbeat가 콘텐츠 판단을 담당하고 GitHub Actions는 해당 판단이 저장소 안전 규칙을 위반하지 않았는지 검증한다.

## 데이터 우선순위와 상태

후보 수요 근거의 우선순위는 다음과 같다.

1. Naver 실제 검색 데이터
2. Google Search Console 실제 query/page 데이터
3. 기존 URL별 검색·수익 성과
4. 관련 WINNER 성과
5. 외부 검색 수요 신호

모든 신호는 `VERIFIED`, `ESTIMATED`, `STALE_DATA`, `NOT_CONNECTED`, `INSUFFICIENT_DATA` 중 하나로 기록한다. 자동 발행에는 후보 query 자체를 보여 주는 하나 이상의 직접적인 `VERIFIED` 검색 수요 근거가 필요하다. 허용 근거는 동일 측정 기간의 Naver query 데이터, GSC query 데이터 또는 검색 서비스가 직접 반환한 query 수요 지표다. 관련 WINNER의 URL 성과, 자동완성, 검색 결과 문서 수, 외부 글의 주장만으로는 직접 수요를 충족하지 않는다. 관련 WINNER 또는 간접 외부 신호만으로 추정한 후보는 점수가 높아도 `WAIT_FOR_DATA`이며 자동 발행하지 않는다.

각 근거는 source, query, 측정 기간, 수치, 수집 시각, 상태와 재확인 가능한 원본 파일 또는 URL을 저장한다. 로그인 화면처럼 원본 URL만으로 재확인이 어려우면 허용 범위에서 화면 캡처 또는 원본 export 경로를 함께 기록한다. 근거가 저장되지 않으면 해당 신호는 `VERIFIED`가 아니다.

서로 다른 기간의 검색·수익 데이터는 합산하지 않는다. URL별 AdSense 또는 GA4 revenue가 없으면 `null`을 유지한다. AdSense CTR은 입력·점수·최적화 대상에서 제외한다.

## 후보 조사와 중복 검사

매 실행에서 후보 10~20개를 조사한다. 후보마다 아래 기존 사이트 증거와 비교한다.

- URL과 slug
- title, H1, 주요 H2, meta description
- 주요 엔티티와 사용자의 최종 목적
- category와 cluster
- sitemap과 내부링크
- PAGE_SCORE
- Naver, Google, GA4와 revenue 데이터

문자열 유사도는 보조 신호다. 사용자의 최종 목적이 같으면 `SAME_INTENT`다.

각 후보는 `NO_OVERLAP`, `LOW_OVERLAP`, `MEDIUM_OVERLAP`, `HIGH_OVERLAP`, `SAME_INTENT` 중 하나와 근거 URL을 가진다.

- `NO_OVERLAP`: 신규 발행 가능
- `LOW_OVERLAP`: 차별화된 독립 목적이 검증될 때 가능
- `MEDIUM_OVERLAP`: 자동 발행 금지, 검토 후보
- `HIGH_OVERLAP`: 신규 생성 금지
- `SAME_INTENT`: 신규 생성 금지, `IMPROVE_EXISTING`

후보 결정은 `NEW_PAGE`, `IMPROVE_EXISTING`, `MERGE_CANDIDATE`, `WAIT_FOR_DATA`, `REJECT` 중 하나다.

## NEW_CONTENT_OPPORTUNITY_SCORE

점수는 0~100이며 PAGE_SCORE와 독립적이다.

- 실제 검색 수요 신호: 25
- 기존 WINNER 관련성: 15
- intent 비중복성: 20
- 광고 수익 가능성: 15
- cluster 확장성: 10
- 콘텐츠 차별성: 10
- 제작 비용 대비 기대효과: 5

각 component는 점수, 상태, 입력값과 설명을 보존한다. 자동 발행 조건은 모두 충족해야 한다.

- 총점 70 이상
- 검색 수요 `VERIFIED`
- overlap `NO_OVERLAP` 또는 `LOW_OVERLAP`
- decision `NEW_PAGE`
- 활성 `CONTENT_LAUNCH_EXPERIMENT` 20개 미만
- 하루 발행 한도 내
- 보호·정책·품질 게이트 통과

## 발행량과 활성 실험

- 기본 신규 발행: 점수 70 이상인 후보를 점수순으로 최대 3페이지
- 4~5번째 추가 슬롯: 점수 85 이상, 직접 수요 `VERIFIED`, overlap `NO_OVERLAP`인 후보만 사용
- 자동 발행 조건을 만족하는 후보가 없으면 0페이지이며, 3개를 채우기 위해 기준을 낮추지 않음
- 5시간 간격 실행을 합산한 최근 24시간 발행량은 기본 3페이지, 절대 최대 5페이지다. 직전 실행에서 슬롯을 사용했다면 남은 슬롯만 사용할 수 있으며 자정이나 새 실행마다 초기화하지 않는다.
- 기존 OPPORTUNITY 수정: 하루 최대 0~2페이지, COOLDOWN 제외
- 기존 페이지 수정과 신규 발행은 서로 다른 실험 유형으로 기록

신규 페이지는 `CONTENT_LAUNCH_EXPERIMENT`이며 동시에 최대 20개를 관찰한다. 발행 후 28일 COOLDOWN을 기본으로 하고 최소 14일 전에는 rewrite하지 않는다.

현재 `EXP-CAMP-NONSAN-CTR-20260901`, `EXP-CAMP-CHEORWON-CTR-20260901`, `EXP-CAMP-ULJIN-CTR-20260901`은 2026-09-29까지 보호한다. 이 CTR 실험은 독립적인 신규 콘텐츠 발행 슬롯을 차감하지 않지만 대상 URL은 절대 재수정하지 않는다.

## 신규 콘텐츠 품질 계약

각 신규 페이지는 동일 템플릿의 지역명 치환물이 아니어야 한다. 후보가 실제로 요구하는 요소만 사용하되 다음 계약을 충족한다.

- 고유 title, description과 H1
- 검색 의도에 대한 직접 답변
- 실제 항목·조건 비교 또는 확인 방법
- 공식 출처와 검토일
- 제한사항과 변경 가능성
- canonical과 indexable 상태
- 상위 hub 및 관련 WINNER를 포함한 자연스러운 내부링크
- sitemap 등록
- 모바일 viewport
- 내용과 일치하는 구조화 데이터
- broken internal link 없음
- AdSense 정책 안전성과 광고·본문 구분

과장 표현과 검증되지 않은 무료·허용 주장은 금지한다. 신규 페이지는 실제 별도 intent를 충족해야 하며 기존 페이지를 얇게 재구성하지 않는다.

## 자동 발행 안전 게이트

`daily_revenue_growth.py`는 후보·결정·발행 manifest를 만든다. `content_launch_guard.py`는 커밋 전에 manifest와 git diff를 검증한다.

필수 게이트:

- 신규 콘텐츠 HTML 5개 이하
- manifest의 `NEW_PAGE` URL과 신규 HTML이 정확히 일치
- `NEW_CONTENT_OPPORTUNITY_SCORE >= 70`
- 직접 검색 수요 `VERIFIED`
- overlap이 `NO_OVERLAP` 또는 `LOW_OVERLAP`
- 활성 신규 관찰 실험 20개 이하
- 같은 날 기존 OPPORTUNITY 수정 2개 이하
- CTR COOLDOWN 3페이지와 기존 WINNER 변경 없음
- 기존 URL, canonical, 광고와 GA4 코드의 예상 밖 변경 없음
- title·H1·canonical 고유
- sitemap·내부링크·structured data·모바일·broken link 검사 통과
- 허위 수익·검색량·순위 값 없음

게이트가 하나라도 실패하면 콘텐츠 커밋과 push를 하지 않는다. 실패 사유와 후보 보고서는 로컬 진행 기록에 남기되 부분 발행하지 않는다.

## 자동 커밋과 push

검증 통과 시 heartbeat는 다음 순서로 실행한다.

1. 최신 `main` fast-forward 확인
2. 후보 조사와 manifest 생성
3. 신규 페이지 작성 및 sitemap·내부링크 반영
4. 실험·색인 후보·보고서·진행 이력 갱신
5. SEO 감사, 안전 게이트, unittest와 pytest 실행
6. `git diff`에서 허용된 변경만 확인
7. `main`에 자동 커밋
8. 원격 `main`에 push

push 충돌, 원격 변경, 테스트 실패 또는 네트워크 오류가 있으면 force push하지 않는다. 작업을 중단하고 원인을 보고한다.

## 색인 후보

신규 페이지는 Google 색인 후보 레지스트리에 기록하지만 자동 Indexing API를 호출하지 않는다. 이미 색인됨, 최근 요청, 요청 대기, duplicate intent, thin, low value, FAILED pattern은 제외한다. Naver discovery는 sitemap과 관련 hub 내부링크 경로로 확보한다.

## 신규 실험과 패턴 학습

`data/content-launch-experiments.json`은 다음을 기록한다.

- experiment ID
- URL, target intent와 pattern
- parent/related WINNER
- search demand evidence
- overlap 결과와 closest URL
- Opportunity score component
- 발행일, COOLDOWN과 observation end
- before 상태(새 URL이므로 검색·수익값은 `NOT_AVAILABLE`)
- 14/28일 후 Naver, Google, GA4와 revenue 결과
- `WINNER`, `PROMISING`, `INCONCLUSIVE`, `FAILED`

28일 전 발행 집단만 `NEW_PAGE_WIN_RATE` 분모에 포함한다. 값이 없는 최신 페이지를 실패로 간주하지 않는다.

최근 10개 같은 pattern의 결과가 충분할 때:

- WINNER 4개 이상 또는 WINNER+PROMISING 7개 이상: `SCALE_PATTERN`
- FAILED 8개 이상이고 WINNER 0개: `PAUSE_PATTERN`
- 그 외: `OBSERVE_PATTERN`

표본 10개 미만이면 자동 scale/pause 판정을 하지 않는다.

## 두 번째 수익 클러스터

매주 최소 한 번 캠핑 외 URL 수익 패턴을 분석한다. 현재 후보군은 QR 코드, 3D 주사위, 메이플 비숍, 러시아어 MBTI이며 URL별 views, revenue, revenue/1,000 views와 검색 활성 상태를 근거로 `SECONDARY_CLUSTER_CANDIDATE`를 만든다. 근거 없는 유사 도구·게임 대량 생성은 금지한다.

## 실행별 산출물

- `data/new-content-opportunities.json`: 후보 10~20개, overlap, evidence, score와 decision
- `data/content-launch-experiments.json`: 신규 발행 관찰 레지스트리
- `data/google-index-candidates.json`: 자동 요청이 아닌 검토 후보
- `reports/daily-revenue-growth.md`: KPI, 후보, 거절, 발행, 실험과 데이터 한계
- 기존 Revenue dashboard: active content experiments, new pages last 28d, win rate, pattern과 cluster risk
- `docs/growth/YYYY-MM-DD-daily-revenue-growth.md`: 다음 실행에서 재사용할 진행 이력

기존 역할과 겹치는 파일이 확인되면 새 파일을 만들지 않고 기존 schema를 확장한다.

## 실행별 보고 KPI

- 28d Revenue와 일평균
- 현재 phase
- WINNER와 OPPORTUNITY 수
- active content experiments
- new pages last 28d
- new page win rate
- revenue per new page
- search-active/new revenue-producing pages
- cluster revenue와 Winner concentration

계산할 데이터가 없으면 `null`과 명시적 상태를 사용한다.

## 예약 규칙

Codex heartbeat는 2026-09-01 14:00 Asia/Seoul을 시작점으로 5시간 간격으로 실행한다. 동일 task에 연결해 직전 결과와 진행 기록을 이어간다. 예약 prompt에는 데이터 확인, 후보 조사, 안전 게이트, 테스트, 커밋·push와 실패 시 중단 조건을 모두 포함한다.

GitHub Actions에는 heartbeat 예약을 복제하지 않는다. Actions는 push 검증만 담당해 두 자동화가 동시에 콘텐츠를 만들지 않게 한다.

## 테스트

- overlap 다섯 단계와 SAME_INTENT 차단
- 직접 수요가 ESTIMATED이면 자동 발행 금지
- score 70 미만 차단
- 점수 70 이상 기본 최대 3개, 점수 85 이상·직접 수요 VERIFIED·NO_OVERLAP인 추가 슬롯 최대 2개, 부적격 후보 0개
- 5시간 반복 실행 사이의 최근 24시간 누적 발행 한도 5개
- active content experiments 20개 제한
- 활성 CTR 실험은 수정 금지지만 신규 발행 슬롯은 차감하지 않음
- WINNER와 COOLDOWN diff 차단
- manifest와 실제 신규 HTML 일치
- URL, title, H1, canonical 중복 차단
- sitemap, hub link, mobile, JSON-LD와 broken link 검사
- 광고·GA4 및 AdSense CTR 비사용
- NEW_PAGE_WIN_RATE의 28일 cohort 계산
- SCALE_PATTERN/PAUSE_PATTERN 최소 표본과 임계값
- 색인 후보 중복·최근 요청 제외
- 데이터 누락 시 허위 0 생성 금지
- 실패 시 commit/push 경로가 호출되지 않음
- 결정적 재실행

## 초기 실행 결정

시스템과 안전 게이트를 먼저 구현한다. 현재 확인된 Naver URL TOP30에는 query-level 수요가 없으므로 기존 데이터만으로 신규 페이지를 바로 자동 발행하지 않는다. 첫 heartbeat에서 앞서 정의한 허용 query 근거를 확보하고 증거를 보존한 후보만 발행할 수 있다. 그렇지 않으면 후보 보고서와 `WAIT_FOR_DATA`만 생성하며 0페이지 발행이 정상이다.
