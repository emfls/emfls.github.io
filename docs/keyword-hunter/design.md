# Keyword Hunter 설계 및 작업 계획 — 2026-09-09

## 사전 확인
- PROJECT_HISTORY.md 70줄 전체, 상위 AGENTS.md, CLAUDE.md 확인. 기존 사용자 미추적 파일 보존.
- 정적 HTML 19,079개, Python SEO/수익 자동화, JS 도구, 별도 Astro 4 주식 하위 앱. 최상위 README/requirements 없음.
- data/site-audit.json, content-metadata.json, new-content-research.json, external-content-opportunities.json 및 scripts/seo_audit.py, new_content_opportunity.py, search_trend_signals.py 확인.
- GitHub SEO QA는 unittest+pytest 및 데이터랩 실행. 발행 가드/관찰 기록은 유지.

## 설계
Python 표준 라이브러리 기반 CLI와 core/API/site 모듈, CSV/JSON 영구 상태. 별도 DB 서버 불필요. 기존 PageParser와 classify_overlap, collect_naver_datalab, TrendRadar reader 재사용. 별도 대규모 크롤러/임베딩 서비스는 운영 복잡성 때문에 제외.
60/25/15 후보 예산, 최고점+미탐색 seed 순환, category cap, max depth. 외부 RSS 및 기존 외부 관찰 자료에서 새 seed 유입. 동의어/검색 의도/문자 n-gram 기반 보수적 중복 판정, 애매한 결과는 검토 대기. 검색광고 경쟁도는 광고 경쟁의 대리 지표이며 SEO 난이도로 단정하지 않음.
API 결측은 null+confidence 하향. 상태 전이는 명시적 CLI, 자동 발행 없음. 잠금+복구 가능한 쓰기 저널, dry-run은 네트워크/파일 변경 없음. 정기 실행은 로컬 Codex에서 같은 체크아웃 사용.

## 구현·검증 체크리스트
- [x] core: normalization, intent duplicate, score, statuses, allocation 테스트 후 구현
- [x] API: signed Search Ads, DataLab reuse, retry/budget/failure isolation, RSS discovery 테스트 후 구현
- [x] site/state/CLI: 최신 URL/title/headings, 영구 tree, report, 반복 실행 및 dry-run 테스트 후 구현
- [x] 기존 CI 테스트 통합, 문서/환경변수/2시간 프롬프트, 전체 pytest+unittest+JS 검증
- [x] 첫 로컬 실행과 재실행 검증, PROJECT_HISTORY 기록
