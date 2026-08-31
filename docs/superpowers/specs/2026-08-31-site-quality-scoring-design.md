# 사이트 품질 점수·운영 대시보드 설계

## 목적

`emfls.github.io`의 약 1.9만 개 정적 HTML을 일괄 평가해 저품질 페이지 증가를 감시하고, 검색·수익 영향이 큰 개선 작업을 우선순위로 제시한다. 점수 자체를 높이는 것이 아니라 일 $100 AdSense 목표에 필요한 검색 유입, 페이지 가치, 내부 탐색과 정책 안전성을 관리하는 것이 목적이다.

## 현재 구조와 재사용 범위

사이트는 Jekyll이 아닌 `.nojekyll` 기반 정적 HTML 저장소다. 다음 기존 기능을 재사용한다.

- `scripts/seo_audit.py`: URL, 메타데이터, 링크, 구조화 데이터, 광고·GA4 존재 여부 수집
- `scripts/import_performance_csv.py`: GSC·GA4·AdSense CSV 통합
- `scripts/content_health_reports.py`: 중복, stale, broken link, cannibalization 분석
- `scripts/score_content_priority.py`: 기존 품질·성과 우선순위 로직
- `.github/workflows/seo-qa.yml`: 단일 품질 게이트
- `data/content-metadata.json`: 수동 출처·검토일·검색 의도 sidecar
- `docs/growth/`: 작업 이력과 성과 판단 기록

새 평가기는 이 데이터를 입력으로 사용하며 HTML을 자동 수정하거나 삭제하지 않는다.

## 핵심 설계 결정

### 혼합 판정 모델

각 세부 판정에는 점수와 함께 증거 상태를 저장한다.

- `VERIFIED`: HTML, 로컬 파일, sitemap, sidecar 또는 실제 CSV에서 직접 확인
- `ESTIMATED`: 공개된 결정 규칙으로 정적 신호를 평가
- `NOT_CONNECTED`: 필요한 외부 성과 데이터가 없음
- `MANUAL_REVIEW_REQUIRED`: 경쟁 페이지 대비 가치, AI 복붙 여부처럼 자동 확정할 수 없음

`MANUAL_REVIEW_REQUIRED`를 임의 만점으로 처리하지 않는다. 확인 가능한 관련 신호만 보수적으로 점수에 반영하고, 최종 판정 한계를 페이지 결과에 표시한다.

### 로컬 전용 대시보드

관리 대시보드는 `reports/site-quality-dashboard.html`에 생성한다. 이 파일은 `.gitignore`에 추가해 커밋하지 않으며 GitHub Pages 공개 경로로 복사하거나 sitemap에 포함하지 않는다. 저장소에 커밋되는 점수 데이터와 Markdown 보고서에도 계정 식별 정보나 원본 CSV 행은 포함하지 않고 페이지 공개 지표와 집계값만 저장한다.

### 자동 조치 금지

낮은 점수, 중복 후보 또는 상한 적용만으로 페이지를 삭제·통합·noindex하지 않는다. 검색 클릭이나 세션이 있는 페이지는 반드시 성과를 함께 검토한다.

## 구성요소

### 1. 입력 정규화

`scripts/quality_audit.py`가 다음 입력을 읽는다.

- `data/site-audit.json`
- `data/content-metadata.json`
- 최신 `data/performance/*.json`
- `data/cannibalization-report.json`
- sitemap과 robots.txt
- trust 페이지의 로컬 존재 여부

성과 파일은 날짜가 가장 최신인 유효 파일을 선택한다. 파일이 없거나 필드가 없으면 `NOT_CONNECTED`로 남긴다.

### 2. 페이지 유형 분류

경로, 카테고리, 구조화 데이터와 상호작용 요소를 사용해 다음 중 하나로 분류한다.

- `TRAFFIC`: 정보·여행·캠핑·일반 검색 콘텐츠
- `MONEY`: 금융·세금·보험·대출·고상업 의도 콘텐츠
- `HUB`: 카테고리·국가·주제 탐색 페이지
- `TOOL`: 계산기·변환기·게임 외 기능형 도구
- `TRUST`: About, Contact, Privacy, Terms, Disclaimer, Methodology
- `UTILITY`: 검색, 404, 게임 등 기능 중심 페이지

명시적 sidecar 값이 있으면 자동 분류보다 우선한다. 유형별로 부적절한 규칙은 제외하거나 대체한다. 예를 들어 TRUST 페이지는 관련 글 3개가 없다는 이유로 크게 감점하지 않는다.

### 3. 페이지 점수

총점은 사용자가 제시한 배점을 그대로 사용한다.

- 검색 의도: 20
- 콘텐츠 가치: 20
- SEO: 10
- 신뢰성: 15
- UX: 10
- 내부링크: 10
- 광고 적합성: 5
- 기술 SEO: 10

각 영역은 원점수, 근거 상태, 통과 신호, 문제와 권장 조치를 저장한다. 단순 글자 수는 콘텐츠 가치의 보조 신호로만 사용한다.

#### 검색 의도

title·H1 일치, 첫 핵심 답변 위치, 질문·FAQ·하위 제목 범위, 낚시성 표현을 평가한다. 경쟁 상위 페이지 대비 가치는 기본적으로 `MANUAL_REVIEW_REQUIRED`다. GSC 노출·CTR·순위가 있으면 실제 검색 적합성의 보조 증거로 사용한다.

#### 콘텐츠 가치

표·계산·폼·자체 데이터·코드 실행·사례·수치와 섹션 다양성을 평가한다. 동일 템플릿 후보, 중복 title/description 그룹과 본문 유사도 후보는 감점한다. 자동으로 AI 생성 여부를 확정하지 않는다.

#### SEO와 기술 SEO

고유 title, 단일 H1, description, heading 구조, 의미 있는 URL, 이미지 alt, canonical, indexability, sitemap, robots, 내부 깨진 링크, 구조화 데이터와 중복 URL을 확인한다.

#### 신뢰성

출처 링크, 날짜, 운영 주체, 방법·한계, 공식 원본, About/Methodology 연결을 평가한다. 금융·정부지원은 sources, 기준일, 한계와 면책 고지를 더 엄격히 적용한다.

#### UX와 광고 적합성

viewport, 기본 typography, overflow 대응, 팝업·sticky 신호, 광고와 상호작용 요소 간 구조적 분리를 평가한다. 실제 모바일 렌더링과 광고 viewability는 정적 검사만으로 확정하지 않고 `ESTIMATED` 또는 `MANUAL_REVIEW_REQUIRED`로 표시한다. AdSense 클릭 추적 코드는 만들지 않는다.

#### 내부링크

본문 문맥 링크, 관련 글, 상위 허브, breadcrumb, inbound link 자료를 구분한다. footer 링크만으로 강한 내부링크 점수를 주지 않는다.

### 4. 강제 상한

요청된 상한을 그대로 지원하되 자동 확정 가능한 조건과 수동 조건을 분리한다.

- 심각한 중복 문서, 목적 불명확, 검색 의도 불일치: 정적·성과 신호로 `ESTIMATED`
- 출처 없는 금융 데이터: `VERIFIED`
- 광고 중심 또는 심각한 모바일 문제: 정적 후보 후 `MANUAL_REVIEW_REQUIRED`
- 사실상 복붙, AI 추가가치 없음, 오래된 핵심 오류: 자동 확정하지 않고 후보로 표시

상한이 실제 적용되면 `caps`에 코드, 최대점수, 상태, 근거를 저장한다. 수동 검토가 필요한 상한 후보는 총점을 강제로 낮추지 않고 `cap_candidates`에 둔다.

### 5. 등급과 상태

등급:

- S: 90~100
- A: 80~89
- B: 70~79
- C: 60~69
- D: 50~59
- F: 0~49

상태:

- `<60`: `FAIL`
- `60~69`: `NEEDS_WORK`
- `70~79`: `PUBLISHABLE`
- `80~89`: `GOOD`
- `90~100`: `CORE`

### 6. 개선 우선순위

우선순위는 낮은 점수 순이 아니다. 다음 요소를 정규화해 계산한다.

- 품질 격차
- GSC 노출·클릭·평균순위·CTR gap
- GA4 세션·참여
- 페이지 유형과 잠재 상업 가치
- 수정 난이도
- 색인 가능 여부
- 실제 데이터 신뢰도

URL별 AdSense 수익·RPM은 현재 연결되지 않았으므로 사용하지 않고 `NOT_CONNECTED`로 표시한다. 성과 데이터가 있으면 `MEASURED`, 없으면 `ESTIMATED` 우선순위로 구분한다.

## 사이트 점수

요청된 100점 배점을 유지한다.

- 콘텐츠 포트폴리오: 25
- 검색 유입 시스템: 20
- 사이트 구조: 15
- 기술 상태: 15
- 신뢰도: 10
- 수익화 구조: 15

SITE_SCORE는 페이지 점수 분포와 실제 시스템 존재 여부를 함께 사용한다. API가 없다는 이유만으로 CSV importer까지 없는 것으로 처리하지 않는다. 연결 상태는 `CSV_CONNECTED`, `NOT_CONNECTED`, `STALE_DATA`로 구분한다.

Custom domain은 사용하지 않는 것이 운영 결정이므로 결함으로 과도하게 감점하지 않는다. HTTPS와 기준 도메인 일관성을 평가한다.

## 산출물

### 기계 데이터

`data/page-scores.json`

- 실행일과 입력 데이터 기간
- 평가 규칙 버전
- 전체 페이지별 점수·등급·유형·상태
- 영역별 점수와 증거 상태
- 상한·상한 후보
- 문제·강점·구체적 권장 조치
- 성과 데이터와 연결 상태
- 개선 우선순위와 `MEASURED`/`ESTIMATED`

`data/site-score.json`

- SITE_SCORE와 등급
- 영역별 점수·증거
- 페이지 분포·KPI
- 외부 데이터 연결 상태
- AdSense $100/day 계산 입력과 결과

### 사람이 읽는 보고서

`SITE_SCORE.md`

- 현재 점수와 이전 실행 대비 변화
- 등급 분포와 목표 차이
- 가장 큰 사이트 문제 10개
- 우선 개선 페이지 10개
- 데이터 제한과 다음 작업

### 로컬 대시보드

`reports/site-quality-dashboard.html`

- SITE_SCORE와 페이지 등급 분포
- 80점 이상·60점 미만 비율
- 일 $100 진행률
- 우선순위, 저품질, 기술 문제 표
- URL·유형·등급·상태 필터
- 페이지별 세부 점수와 권장 조치

대시보드는 외부 라이브러리 없이 정적 HTML·CSS·JavaScript로 동작한다. 1.9만 행을 초기 DOM에 모두 넣지 않고 JSON을 로드해 페이지 단위로 표시한다.
대시보드 파일은 로컬 산출물이며 Git 추적 대상이 아니다.

## AdSense $100/day 계산

최신 유효 AdSense 데이터에 수익, PV, RPM이 있으면 해당 기간의 일평균을 사용한다.

- 일평균 수익 = 기간 수익 / 일수
- 달성률 = 일평균 수익 / 100
- 필요 성장 = 100 / 일평균 수익
- 필요 PV = 100 / RPM × 1000

기간이나 RPM이 없으면 `DATA NOT AVAILABLE`로 표시한다. 오늘 값인 것처럼 과거 기간 평균을 표시하지 않는다.

## 자동화와 배포

기존 `SEO QA` workflow에 다음 단계를 추가한다.

1. site audit 재생성
2. 품질 점수 생성
3. 결과 스키마와 결정성 검사
4. 기존 SEO 회귀 검사
5. 전체 unittest·pytest

초기 도입에서는 SITE_SCORE 하락이나 낮은 페이지 비율만으로 CI를 실패시키지 않는다. 다음은 실패 조건이다.

- 평가 실행 오류
- 출력 스키마 오류
- 동일 입력에서 비결정적 결과
- 신규 페이지가 평가 결과에서 누락
- 상한 근거 없는 적용
- 존재하지 않는 외부 데이터를 실측값으로 표시

대시보드는 GitHub Pages용 sitemap과 공개 내비게이션에 포함하지 않는다.

## 테스트 전략

- 페이지 유형별 고정 fixture로 영역별 점수 검증
- 각 강제 상한의 적용·미적용 검증
- 수동 상한 후보가 실제 총점을 임의 변경하지 않는지 검증
- TRUST·TOOL·MONEY 유형별 예외 검증
- 성과 데이터 유무에 따른 `MEASURED`/`ESTIMATED` 검증
- AdSense 데이터 부재 시 허위 수치가 없는지 검증
- 1.9만 페이지 전체가 정확히 한 번 평가되는지 통합 검증
- 동일 입력 두 번 실행 결과가 같은지 검증
- 기존 SEO QA와 전체 테스트 유지

## 단계적 구현

1. 평가 데이터 모델과 fixture 기반 페이지 점수
2. 전체 site-audit 입력과 페이지 유형 분류
3. 강제 상한·구체적 권장 조치
4. 성과 기반 우선순위
5. SITE_SCORE와 $100/day 상태
6. Markdown·로컬 HTML 대시보드
7. 기존 SEO QA 통합
8. 전체 사이트 실행·결과 검토·작업 이력 기록

## 비목표

- 자동 noindex·삭제·통합
- URL 변경
- 광고 추가·클릭 유도·광고 클릭 추적
- Search Console·AdSense API 연결을 가장한 가짜 데이터
- 1.9만 페이지의 AI 브라우저 전수 평가
- 점수를 높이기 위한 기준 완화

## 완료 기준

- 전체 index 가능 페이지가 한 번씩 평가됨
- 페이지별 8개 영역 점수와 판정 근거가 존재함
- 상한 적용 이유가 기계 데이터와 보고서에 표시됨
- SITE_SCORE, 등급 분포, 목표 차이와 우선 페이지 10개가 생성됨
- 성과가 없는 항목은 명시적으로 연결 상태를 표시함
- 로컬 대시보드가 결과를 필터·조회할 수 있음
- 기존 SEO QA와 전체 테스트가 통과함
- 구현과 제한사항이 `docs/growth/`에 기록됨
