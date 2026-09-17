# P5 Wave 2 — GA4 Latest Snapshot Collection Path Recovery

검토일: 2026-09-17  
프로젝트: `emfls/emfls.github.io`  
초기 상태: **MANUAL_EXPORT_ONLY / BLOCKED_CREDENTIAL_REQUIRED**  
Wave 3 구현 상태: **COLLECTION_PATH_IMPLEMENTED**

## Existing path

- Script: `scripts/import_performance_csv.py`
- Workflow: GA4 수집 전용 workflow 없음. `.github/workflows/seo-qa.yml`은 기존 snapshot을 소비해 `revenue_growth.py`를 실행하지만 GA4 API를 호출하지 않음
- Credentials/env: GA4 API credential, service account, OAuth client, property ID env/secrets 없음
- Snapshot location: `data/performance/2026-08-31.json`
- Existing source: `USER_VERIFIED_MANUAL_SNAPSHOT`
- Property/source: HTML에 설치된 GA4 Measurement ID `G-QP5Q67GE5B`는 확인되지만, Data API property ID와 수집 credential은 repo에 없음

## Root cause

최신 snapshot이 갱신되지 않은 직접 원인은 자동 GA4 collection path가 존재하지 않고, 수동 CSV export를 `import_performance_csv.py`로 가져오는 경로만 구현되어 있기 때문이다. SEO QA workflow는 이미 생성된 `data/performance/2026-08-31.json`을 입력으로 사용할 뿐 GA4에 인증하거나 데이터를 재수집하지 않는다.

## Source → collection → snapshot → revenue path

- GA4 source: 브라우저 페이지의 `G-QP5Q67GE5B` measurement tag
- Credential/auth: Data API service account/OAuth 및 `GA4_PROPERTY_ID` 미발견
- Collection script/workflow: API collector 없음; 수동 GA4 CSV export importer만 존재
- Snapshot: `data/performance/2026-08-31.json`, GA4 period `2026-08-03`~`2026-08-30`
- Generated measurement output: `scripts/revenue_growth.py`가 snapshot을 normalize하여 `data/page-performance.json` 생성
- Opportunity classification: stale GA4는 `STALE_DATA`이고 verified revenue/views 산정에서 제외됨

## Wave 3 implementation

credential blocker 해소 후 다음을 구현했다.

- `scripts/collect_ga4_snapshot.py`: Google Analytics Data API collector
- `.github/workflows/ga4-collection.yml`: 하루 1회 schedule + `workflow_dispatch`
- runtime env/secret: `GA4_PROPERTY_ID`, `GA4_SERVICE_ACCOUNT_JSON_B64`
- API 성공 후에만 `data/performance/ga4-latest.json`을 atomic write
- 이후 `revenue_growth.py`와 `validate_measurement_artifact.py` 실행
- API 실패·빈 응답·credential 오류 시 기존 snapshot/output 보존
- credential JSON 자체는 출력·commit하지 않음

로컬에는 GitHub Actions credential이 노출되지 않아 실제 Property API 호출과 최신 snapshot 생성은 실행하지 않았다. 기존 stale snapshot과 `data/page-performance.json`은 덮어쓰지 않았다.

## Exact block reason and required input

- Block reason: `BLOCKED_CREDENTIAL_REQUIRED`
- Required credential/input: Google Analytics Data API 접근 권한이 있는 Google Cloud service account JSON 또는 OAuth credential, GA4 property ID(`properties/<numeric-id>`), 그리고 해당 property에 대한 Viewer 권한
- Exact next manual action: GA4 관리자에서 `G-QP5Q67GE5B`가 연결된 property의 실제 numeric property ID와 Data API Viewer 권한이 부여된 service account/OAuth credential을 준비해 저장소 maintainer에게 전달한다.

그 credential이 준비되기 전에는 최신 snapshot 생성, `data/page-performance.json` 재생성, `data/revenue-opportunities.json` 갱신을 수행하지 않는다.

현재 credential은 GitHub Actions에 등록되었으므로 위 차단은 해소되었다. 실제 검증은 GitHub Actions의 `GA4 Collection` workflow를 `workflow_dispatch`로 1회 실행해야 한다.

## Validation

기존 stale snapshot의 상태를 유지하는 validation은 P5 Wave 1에서 완료된 계약을 사용한다. 이번 Wave 2에서는 새 snapshot이 없으므로 generated output을 재생성하지 않았다.
