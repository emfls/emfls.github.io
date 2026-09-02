# External Web Opportunity Discovery Runbook

## 목적

2시간마다 외부 검색 환경에서 새로운 사용자 수요를 탐색하고, 기존 emfls 약 19,000페이지와 겹치지 않으며 고품질 제작이 가능한 후보를 `READY_TO_LAUNCH`까지 준비한다. 실제 신규 발행은 한국시간 기준 하루 최대 3페이지이며, 좋은 후보가 없으면 0페이지가 정상이다.

## 실행 순서

1. `docs/superpowers/specs/2026-09-02-external-web-opportunity-automation-design.md`와 이 runbook을 읽는다.
2. 현재 권위 있는 성장 기록, `data/external-content-opportunities.json`, launch experiments, site audit와 최신 데이터 상태를 읽는다.
3. Google, Naver 및 가능한 추가 외부 소스 한 곳 이상을 탐색한다.
4. emfls 내부 페이지에서만 아이디어를 파생하지 않고 외부에서 10~30개 신규 intent를 발견한다.
5. 정확한 검색량을 모르면 `OBSERVED_SEARCH_SIGNAL`로 기록하고 숫자를 만들지 않는다.
6. 이전 후보 DB와 전체 site audit를 사용해 후보 반복과 intent 중복을 제거한다.
7. 경쟁 콘텐츠, 반복 질문, 공식 출처와 신뢰할 수 있는 보조 출처를 조사한다.
8. `CONTENT_GAP`, 추가 가치, Content Brief와 내부링크 계획을 작성한다.
9. `EXTERNAL_CONTENT_OPPORTUNITY_SCORE`와 `QUALITY_FEASIBILITY_SCORE`를 계산한다.
10. 두 임계값과 overlap, 출처, Brief 조건을 모두 통과한 후보만 READY 큐에 적재한다.
11. 당일 남은 발행 슬롯과 기존 실험을 확인한다.
12. 모든 launch gate를 통과한 최상위 후보만 0~3페이지 발행한다.
13. sitemap, hub 내부링크와 index readiness를 갱신한다.
14. launch guard와 관련 테스트 및 전체 pytest를 실행한다.
15. 보고서와 성장 기록을 갱신하고 안전한 변경만 커밋·push한다.
16. GitHub SEO QA와 Pages 배포 결과를 확인한다.

## 자동화 프롬프트

```text
emfls 저장 프로젝트에서 External Web Opportunity 운영을 수행한다. 먼저 docs/superpowers/specs/2026-09-02-external-web-opportunity-automation-design.md, docs/growth/external-web-opportunity-runbook.md, 현재 프로젝트 성장 기록, data/external-content-opportunities.json, launch experiments, site audit 및 최신 데이터 상태를 읽는다.

아이디어 탐색은 반드시 EXTERNAL_WEB에서 시작한다. Google, Naver 및 가능한 추가 외부 소스 한 곳 이상을 탐색하고, 기존 emfls 콘텐츠의 제목 변형이 아닌 새로운 사용자 검색 intent 10~30개를 발견한다. autocomplete, related searches, 반복 질문, 상위 문서 제목, 경쟁 사이트, 커뮤니티와 공공·공식 자료에서 수요 신호를 찾되 정확한 검색량을 모르면 OBSERVED_SEARCH_SIGNAL로 기록하고 숫자를 만들지 않는다. 외부 콘텐츠의 문장, 표, 구조, 분석 또는 이미지를 복사하지 않는다.

각 후보에 discovery source, method, evidence refs, primary·secondary intent, TRENDING 또는 EVERGREEN, category와 pattern을 기록한다. 이전 후보 DB와 약 19,000페이지 site audit의 URL, title, H1/H2, description, 주요 본문, category, cluster 및 intent를 비교해 NO_OVERLAP, LOW_OVERLAP, MEDIUM_OVERLAP, HIGH_OVERLAP 또는 SAME_INTENT로 분류한다. SAME_INTENT는 DO_NOT_CREATE 및 IMPROVE_EXISTING_CANDIDATE로 기록한다. 종결 후보는 새 증거가 없으면 반복 조사하지 않는다.

통과 후보는 경쟁 콘텐츠의 공통 답변과 부족한 점을 분석하고, 명확한 CONTENT_GAP과 독립적인 추가 가치를 정의한다. 커뮤니티는 질문 발견에만 사용하고 최종 사실은 공식·신뢰 출처로 검증한다. 공식 sources, supporting sources, key facts, potential table, potential tool, FAQ, closest emfls page, why separate page 및 internal link plan을 포함한 Content Brief를 작성한다. YMYL은 공식 출처, reviewed date, limitations와 disclaimer가 없으면 발행하지 않는다. 확인 불가능한 사실은 NOT_VERIFIED로 남긴다.

scripts/external_discovery_pipeline.py와 scripts/prepare_external_launch.py의 결정적 규칙을 사용한다. External Opportunity Score 70 이상, Quality Feasibility Score 75 이상, overlap LOW 이하 및 모든 근거·Brief 조건을 통과한 후보만 READY_TO_LAUNCH로 둔다. 한국시간 당일 발행량이 3개 미만일 때 가장 높은 기대값의 후보만 발행하며 3개를 억지로 채우지 않는다. 데이터나 출처가 부족하면 0페이지 발행하고 INSUFFICIENT_DATA, NOT_CONNECTED, STALE_DATA 또는 NOT_VERIFIED를 기록한다.

WINNER와 활성 COOLDOWN, 특히 논산·철원·울진 CTR 실험을 수정하지 않는다. URL, canonical, 광고, analytics, AdSense CTR, 대량 rewrite, 삭제, doorway 및 지역명 치환을 하지 않는다. 신규 페이지는 검색자의 첫 화면에서 핵심 답을 제공하고 intent에 맞는 비교·계산·가이드·체크리스트·도구 구조를 사용한다.

매 실행 후 source별 발견 수, 기존 intent 거절 수, researching, brief ready, ready to launch, pages launched today, TOP 10 및 중복 제거 결과를 기록한다. launch guard와 전체 테스트를 실행하고 중요 변경을 성장 기록에 남긴다. 안전한 변경만 커밋·push하고 GitHub SEO QA와 Pages 배포를 확인한다. 외부 웹 또는 공식 출처에 접근할 수 없으면 추측하지 말고 fail closed로 종료한다.
```

## 운영 상태

- 자동화 이름: `External Web Opportunity Discovery`
- 종류: Codex local cron
- 주기: 2시간
- 알림: 실패한 실행만
- 프로젝트 ID: 자동화 생성 시 `list_projects`로 검증한 실제 ID 사용
- 외부 후보 DB: `data/external-content-opportunities.json`
- 실행 보고서: `reports/external-discovery-pipeline.md`
- 발행 manifest: `data/content-launch-manifest.json`

## 실패 처리

- 외부 탐색 불가: `INSUFFICIENT_DATA`, 발행 0
- 공식 출처 불가: `NOT_VERIFIED`, 발행 금지
- 10개 미만 또는 30개 초과 입력: READY 선택 금지
- overlap 분석 불가: 최소 `MEDIUM_OVERLAP`, 발행 금지
- 일일 슬롯 0: 다음날 후보 조사와 Brief 준비만 수행
- launch guard 또는 테스트 실패: 커밋·push·발행 중단
- GitHub Actions 실패: 실패 원인을 기록하고 안전한 범위에서 수정 후 재검증
