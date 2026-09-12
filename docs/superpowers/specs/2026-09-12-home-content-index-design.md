# emfls 블로그형 홈·검색 인덱스 설계

## 목적

emfls.github.io의 약 19,000개 기존 HTML URL을 이동하거나 개별 수정하지 않고,
루트 홈페이지 위에 티스토리/블로그스팟과 유사한 논리적 콘텐츠 구조를 만든다.

메인 홈페이지는 한국어 콘텐츠만 대상으로 한다.

대상:
- `/kor/` 이하 한국어 콘텐츠
- `/kor/util/` 이하 한국어 도구

제외:
- `/eng/`
- `/jpn/`
- 루트 `/util/`의 영문 레거시 도구
- 생성용/관리용 HTML
- sitemap, redirect, 오류 페이지 등 콘텐츠가 아닌 문서

## 핵심 원칙

1. 기존 콘텐츠 URL을 이동하지 않는다.
2. 19,000개 HTML에 카테고리/태그를 직접 삽입하지 않는다.
3. Python이 기존 HTML을 스캔해 검색 인덱스를 생성한다.
4. 카테고리는 소수의 고정 분류를 사용한다.
5. 태그는 검색용으로 자동 생성한다.
6. 자동 분류 오류는 override JSON으로 보정한다.
7. 홈페이지 초기 로딩 시 전체 검색 인덱스를 내려받지 않는다.
8. 사용자가 검색을 시작할 때 전체 검색 인덱스를 지연 로딩한다.
9. 기존 GA4, AdSense, Google/Naver 인증, canonical은 보존한다.

## 메인 카테고리

고정 카테고리는 다음 8개다.

- 캠핑·차박
- 여행
- 게임
- 무료 도구
- 자동차·생활
- 금융·투자
- AI·테크
- 생활정보

실제 디렉터리 구조와 카테고리는 분리한다.

예:

`/kor/column/palworld-...html`
→ 게임

`/kor/report/car/...`
→ 자동차·생활

`/kor/util/...`
→ 무료 도구

## 생성 파일

### scripts/build_content_index.py

한국어 HTML을 스캔하고 메타데이터를 추출한다.

추출 대상:
- URL
- title
- meta description
- H1
- 날짜(확인 가능한 경우)
- 기존 경로

이 정보를 바탕으로:
- category
- tags
- aliases
- searchable_text

를 생성한다.

### data/content-index-ko.json

전체 한국어 검색용 인덱스.

예:

```json
{
  "title": "철원 캠핑·차박 장소 정리",
  "url": "/kor/report/camp/cheorwon.html",
  "description": "철원 캠핑과 차박 장소 이용 전 확인할 정보를 정리합니다.",
  "category": "캠핑·차박",
  "tags": ["철원", "캠핑", "차박", "한탄강"],
  "aliases": [],
  "updated_at": "2026-09-01"
}
```

### data/home-feed-ko.json

홈페이지 전용 소형 데이터.

포함:
- 최신 콘텐츠
- 카테고리별 대표/최신 콘텐츠
- 인기 태그 후보

전체 19,000개 데이터를 포함하지 않는다.

### data/content-overrides-ko.json

자동분류 예외를 수동 보정한다.

예:

```json
{
  "/kor/column/palworld-1-0-beginner-first-day-guide.html": {
    "category": "게임",
    "tags": ["팰월드", "초보", "공략"],
    "aliases": ["팔월드"]
  }
}
```

## 홈페이지 구조

루트 `index.html`은 다음 구조로 변경한다.

1. 사이트 헤더
2. 대형 검색창
3. 인기 태그
4. 최신 콘텐츠 피드
5. 주요 카테고리 섹션
   - 캠핑·차박
   - 게임
   - 무료 도구
   - 여행
   - 자동차·생활
6. 보조 카테고리
   - 금융·투자
   - AI·테크
   - 생활정보
7. 광고
8. Footer

기존 거대한 이미지 카테고리 중심 홈에서
실제 글 목록 중심의 블로그형 홈으로 전환한다.

## 검색

현재 홈페이지 `.search-item`만 대상으로 하는 검색은 제거한다.

검색 흐름:

사용자 입력  
→ `content-index-ko.json` 지연 로딩  
→ title/category/tags/aliases/description 검색  
→ 점수순 검색 결과 표시

검색 버튼을 눌러도 첫 번째 결과로 자동 이동하지 않는다.

검색 결과는 사용자가 선택한다.

검색 랭킹 기본 우선순위:

1. title 정확 일치
2. title 부분 일치
3. aliases
4. tags
5. category
6. description

## 태그

태그는 별도의 SEO 페이지를 자동 생성하지 않는다.

태그의 목적:
- 홈페이지 검색
- 관련 콘텐츠 탐색
- 사용자 필터

자동 태그는 title, description, H1, URL slug를 기반으로 생성한다.

불용어와 지나치게 일반적인 단어는 제외한다.

태그는 기본적으로 최대 8개까지만 저장한다.

## 날짜

HTML에서 명확한 날짜를 찾을 수 있는 경우에만 사용한다.

허용 예:
- `<time datetime="YYYY-MM-DD">`
- `datePublished`
- `dateModified`

파일 수정시간(mtime)을 게시일로 사용하지 않는다.

날짜를 신뢰할 수 없는 페이지에는 임의의 날짜를 생성하지 않는다.

홈의 최신 콘텐츠는 신뢰 가능한 날짜가 있는 콘텐츠를 우선하고,
날짜가 없는 콘텐츠는 안정적인 deterministic 정렬 규칙을 사용한다.

## 카테고리 분류

분류는 URL만 기준으로 하지 않는다.

다음을 함께 사용한다.

- URL
- title
- meta description
- H1

최소 규칙:

- `/kor/util/` → 무료 도구
- `/kor/report/camp/` → 캠핑·차박
- `palworld`, `팰월드`, `maple`, `nikke` 등 게임성 콘텐츠 → 게임
- `/kor/report/travel/`, 여행·비자 관련 콘텐츠 → 여행
- `car`, 자동차, 차량, 검사 → 자동차·생활
- `finance`, `stock`, `coin`, 투자, 연금, 세금 → 금융·투자
- `ai`, `tech`, `it`, `window`, 인공지능 → AI·테크
- 그 외 불확실한 콘텐츠 → 생활정보

예를 들어 물리 경로가:

`/kor/column/palworld-1-0-beginner-first-day-guide.html`

이어도 카테고리는 반드시 `게임`으로 분류한다.

## Override

자동 분류가 틀린 경우 기존 HTML을 수정하지 않고
`data/content-overrides-ko.json`에서 보정한다.

지원 항목:

- category
- tags
- aliases

override 값이 존재하면 자동 생성값보다 우선한다.

## 실패 처리

HTML 파싱에 실패한 페이지 하나 때문에 전체 생성이 중단되지 않는다.

필수 title 또는 URL이 없는 문서는 검색 인덱스에서 제외하고 경고를 출력한다.

자동분류가 불확실한 경우 기본 카테고리 `생활정보`를 사용한다.

허위 날짜, 허위 태그, 허위 검색 수치를 생성하지 않는다.

URL 중복은 제거한다.

동일한 입력으로 실행했을 때 동일한 JSON이 생성되도록
출력 순서와 정렬은 deterministic하게 유지한다.

## 홈페이지 데이터 로딩

홈페이지 접속 시 전체 `content-index-ko.json`을 즉시 다운로드하지 않는다.

초기 로딩:

`index.html`
→ `data/home-feed-ko.json`

만 사용한다.

사용자가 검색창에 입력하거나 검색을 실행할 때:

`data/content-index-ko.json`

을 최초 1회 지연 로딩하고 이후 메모리에 재사용한다.

## 검색 결과

검색 대상:

- title
- aliases
- tags
- category
- description

검색 결과는 합리적인 개수로 제한한다.

검색 submit 시 첫 결과로 자동 이동하지 않는다.

사용자가 결과 목록에서 원하는 콘텐츠를 직접 선택한다.

태그 버튼을 클릭하면 해당 태그를 검색어로 사용해 같은 검색 UI를 사용한다.

## 자동화

초기 구현이 안정화되면 GitHub Actions에서 인덱스 생성 스크립트를 실행한다.

새 콘텐츠가 추가되면:

HTML 추가  
→ Python 인덱스 재생성  
→ home-feed 갱신  
→ 테스트  
→ 배포

순으로 자동 반영한다.

초기 1차 구현에서는 기존 Keyword Hunter workflow와 강하게 결합하지 않는다.

GitHub Actions 변경은 홈·검색 기능이 안정화된 뒤 별도 단계로 진행한다.

## 보존해야 하는 기존 기능

루트 `index.html` 개편 시 다음은 반드시 보존한다.

- canonical
- Google Analytics `G-QP5Q67GE5B`
- AdSense `ca-pub-8830524482034754`
- Google 사이트 인증
- Naver 사이트 인증
- 모바일 반응형 구조
- 키보드 focus 접근성
- 개인정보/정책 관련 Footer 링크

현재 제거된 `SearchAction` structured data는
실제 검색 URL 구조가 확정되기 전까지 다시 추가하지 않는다.

## 테스트

최소 다음을 검증한다.

- `/kor/` 콘텐츠만 포함
- `/eng/` 콘텐츠 제외
- `/jpn/` 콘텐츠 제외
- 루트 `/util/` 제외
- 고정 카테고리 8개 외 값 생성 금지
- `/kor/util/` → 무료 도구
- `/kor/report/camp/` → 캠핑·차박
- `/kor/column/palworld-*` → 게임
- URL 중복 제거
- title 없는 문서 제외
- override category 적용
- override tags 적용
- override aliases 적용
- 태그 최대 8개
- 날짜 임의 생성 금지
- JSON deterministic
- home-feed가 전체 검색 인덱스보다 충분히 작음
- 홈페이지가 `home-feed-ko.json`을 사용
- 전체 검색 인덱스는 검색할 때만 lazy load
- 검색 submit 시 첫 결과 자동 redirect 없음
- canonical/GA4/AdSense/접근성 유지

## 이번 작업에서 하지 않는 것

- 19,000개 기존 URL 이동
- 기존 페이지 대량 rewrite
- 기존 콘텐츠 HTML에 태그 삽입
- 자동 태그 SEO 랜딩페이지 생성
- 영어/일본어 통합 검색
- Elasticsearch 등 서버 검색엔진 도입
- 외부 검색 API 도입
- npm/package 추가
- Keyword Hunter 구조 변경
- 기존 WINNER/COOLDOWN 콘텐츠 본문 수정
- 개별 카테고리 `index.html` 대량 수정
- GitHub Actions 즉시 통합

## 1차 구현 대상 파일

- `scripts/build_content_index.py`
- `data/content-overrides-ko.json`
- `data/content-index-ko.json`
- `data/home-feed-ko.json`
- `tests/test_content_index.py`
- `index.html`
- `tests/test_homepage_redesign.py`

## 성공 기준

사용자가 메인 홈페이지에서:

- 최신 한국어 콘텐츠를 확인할 수 있다.
- 주요 카테고리별 글을 탐색할 수 있다.
- 태그를 눌러 관련 콘텐츠를 찾을 수 있다.
- 검색창에서 한국어 사이트 전체 콘텐츠를 제목·태그 기준으로 검색할 수 있다.

새 콘텐츠가 추가되어도 개별 홈페이지 HTML을 수정하지 않고
Python 인덱스 재생성만으로 홈과 검색에 반영된다.

기존 19,000개 콘텐츠 URL과 검색엔진 색인 자산은 그대로 유지한다.