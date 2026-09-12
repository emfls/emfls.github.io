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