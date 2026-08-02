# Switzerland Visa Revenue SEO Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스위스 비자 페이지가 한국 여권의 90일 무비자, ETIAS, 취업·유학 검색 의도에 공식 정보로 답해 실제 검색 클릭과 수익 가능성을 높이도록 개편한다.

**Architecture:** 기존 단일 정적 HTML, 공통 CSS, 검색 필터와 FAQ 인터페이스는 유지한다. 페이지 전용 Python 회귀 테스트로 검색 답변·공식 출처·구조화 데이터·금지 주장을 고정하고, 배포 후 공개 모바일 화면과 Search Console에서 검증한다.

**Tech Stack:** HTML5, 기존 `style.css`, vanilla JavaScript, JSON-LD, Python `unittest`, GitHub Pages, Google Search Console

## Global Constraints

- URL과 canonical `https://emfls.github.io/kor/report/visa/switzerland.html`을 유지한다.
- GA4 `G-QP5Q67GE5B`, AdSense `ca-pub-8830524482034754`, `searchInput`, `toggleFAQ(element)`를 유지한다.
- 사이트 공통 CSS, 다른 비자 페이지, 광고 수·위치를 변경하지 않는다.
- 최근 확인일과 JSON-LD `dateModified`는 `2026-08-02`로 기록한다.
- `완벽`, `최신`, 특정 연도 보장, 추정 처리기간, 일률적인 신청 서류를 사용하지 않는다.
- ETIAS는 `2026년 4분기 운영 예정`, `현재 신청 불필요`, `구체적 시행일 미발표`로 구분한다.
- 성과는 2026-08-30에 실제 검색 유입과 페이지 수익으로 판정하며 일 수익 100달러를 보장하지 않는다.

---

## File Structure

- Create: `tests/test_switzerland_visa_page.py` — 스위스 페이지의 검색 답변, ETIAS, 추적 코드, 공식 출처, 금지 주장을 검증한다.
- Modify: `kor/report/visa/switzerland.html` — 검색 메타데이터, 한국 여권 답변, ETIAS, 목적별 체류 안내, 공식 링크를 제공한다.
- Modify: `docs/growth/2026-08-01-priority-rollout-log.md` — 기준선, 배포, 공개 검증, 색인 요청, 28일 재평가일을 기록한다.
- Modify: `docs/superpowers/plans/2026-08-02-switzerland-visa-revenue-seo.md` — 실행 완료 체크를 누적한다.

### Task 1: 스위스 페이지 회귀 계약을 RED로 고정

**Files:**
- Create: `tests/test_switzerland_visa_page.py`
- Test: `tests/test_switzerland_visa_page.py`

**Interfaces:**
- Consumes: 저장소 루트의 `kor/report/visa/switzerland.html`
- Produces: 실제 HTML 파싱 결과를 검증하는 `SwitzerlandVisaPageTests`

- [ ] **Step 1: 기존 페이지에서 실패하는 전용 테스트 작성**

`html.parser.HTMLParser`로 title, canonical, 링크, JSON-LD를 수집하고 다음 테스트를 작성한다.

```python
import json
import re
import unittest
from html.parser import HTMLParser
from pathlib import Path

PAGE = Path(__file__).resolve().parents[1] / "kor/report/visa/switzerland.html"
CANONICAL = "https://emfls.github.io/kor/report/visa/switzerland.html"

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.canonical = ""
        self.links = []
        self.json_ld = []
        self._in_title = False
        self._href = None
        self._anchor = []
        self._json = None

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "title": self._in_title = True
        elif tag == "link" and values.get("rel") == "canonical": self.canonical = values.get("href", "")
        elif tag == "a": self._href, self._anchor = values.get("href", ""), []
        elif tag == "script" and values.get("type") == "application/ld+json": self._json = []

    def handle_data(self, data):
        if self._in_title: self.title += data
        if self._href is not None: self._anchor.append(data)
        if self._json is not None: self._json.append(data)

    def handle_endtag(self, tag):
        if tag == "title": self._in_title = False
        elif tag == "a" and self._href is not None:
            self.links.append((self._href, " ".join(self._anchor).strip()))
            self._href, self._anchor = None, []
        elif tag == "script" and self._json is not None:
            self.json_ld.append(json.loads("".join(self._json)))
            self._json = None

class SwitzerlandVisaPageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", cls.html)).strip()
        cls.parser = PageParser()
        cls.parser.feed(cls.html)

    def test_search_result_answers_korean_passport_intent(self):
        self.assertEqual(self.parser.title, "스위스 비자: 한국 여권 90일 무비자·ETIAS·취업 안내")
        self.assertEqual(self.parser.canonical, CANONICAL)
        self.assertIn("180일 내 최대 90일", self.text)

    def test_etias_status_is_current_and_bounded(self):
        self.assertIn("2026년 4분기 운영 예정", self.text)
        self.assertIn("현재 신청할 필요가 없습니다", self.text)
        self.assertIn("구체적인 시행일은 발표되지 않았습니다", self.text)

    def test_measurement_and_interactions_remain(self):
        for marker in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", 'id="searchInput"', "function toggleFAQ(element)"):
            self.assertIn(marker, self.html)

    def test_official_sources_and_freshness_are_present(self):
        self.assertIn("최근 확인: 2026-08-02", self.text)
        hrefs = {href for href, _ in self.parser.links}
        for href in (
            "https://www.schweiz-republikkorea.eda.admin.ch/en/do-i-need-a-schengen-visa",
            "https://travel-europe.europa.eu/en/etias",
            "https://www.sem.admin.ch/sem/en/home/overview-arbeit.html",
            "https://www.sem.admin.ch/sem/en/home/themen/arbeit/nicht-eu_efta-angehoerige.html",
        ):
            self.assertIn(href, hrefs)

    def test_misleading_claims_are_absent(self):
        for phrase in ("완벽 가이드", "2025년부터 ETIAS", "보통 10-15일", "1-2개월", "스위스에서 10년 이상"):
            with self.subTest(phrase=phrase): self.assertNotIn(phrase, self.text)
        self.assertFalse(any(item.get("@type") == "SearchAction" for item in self.parser.json_ld))

    def test_json_ld_describes_this_page(self):
        page = next(item for item in self.parser.json_ld if item.get("@type") == "WebPage")
        self.assertEqual(page["url"], CANONICAL)
        self.assertEqual(page["dateModified"], "2026-08-02")
```

- [ ] **Step 2: RED 실패 이유 확인**

Run: `python3 -m unittest tests.test_switzerland_visa_page -v`

Expected: 낡은 title, ETIAS 문구, 공식 링크, `WebPage` JSON-LD가 없어 FAIL하고 GA4·AdSense·기존 상호작용만 PASS한다.

- [ ] **Step 3: 실패 테스트 커밋**

```bash
git add tests/test_switzerland_visa_page.py
git commit -m "test: define Switzerland visa page contract"
```

### Task 2: 공식 출처 기반 수익형 검색 페이지 구현

**Files:**
- Modify: `kor/report/visa/switzerland.html:1-431`
- Test: `tests/test_switzerland_visa_page.py`

**Interfaces:**
- Consumes: Task 1의 `SwitzerlandVisaPageTests`, 기존 `style.css`, `searchInput`, `toggleFAQ(element)`
- Produces: 검색 가능한 `.visa-category` 섹션과 `WebPage` JSON-LD를 갖춘 정적 페이지

- [ ] **Step 1: 검색 메타데이터와 구조화 데이터 교체**

```html
<title>스위스 비자: 한국 여권 90일 무비자·ETIAS·취업 안내</title>
<meta name="description" content="한국 여권은 스위스·쉥겐 지역에서 180일 내 최대 90일 무비자입니다. ETIAS 시행 상태와 C·D 비자, 취업·유학 허가 차이를 공식 출처로 확인하세요." />
```

기존 `WebSite/SearchAction`을 다음 JSON-LD로 교체한다.

```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "스위스 비자: 한국 여권 90일 무비자·ETIAS·취업 안내",
  "description": "한국 여권 사용자를 위한 스위스 단기 방문, ETIAS와 장기체류 안내",
  "url": "https://emfls.github.io/kor/report/visa/switzerland.html",
  "inLanguage": "ko-KR",
  "dateModified": "2026-08-02"
}
```

- [ ] **Step 2: 첫 화면 답변과 최근 확인일 추가**

```html
<div class="info-box">
  <strong>먼저 답:</strong> 대한민국 여권 소지자는 스위스와 쉥겐 지역에서 <strong>180일 내 최대 90일</strong>까지 단기 방문 비자가 필요하지 않습니다. 무비자는 취업이나 90일 초과 체류 허가가 아닙니다.
</div>
<p>최근 확인: 2026-08-02</p>
```

본문과 관련 링크를 `<main>`으로 감싼다.

- [ ] **Step 3: 검색 가능한 여섯 개 콘텐츠 섹션 작성**

각 섹션에 `.visa-category`와 검색어를 포함한 `data-category`를 유지한다.

1. `한국 여권 90일 무비자`: 주한 스위스대사관 기준 대한민국 국적은 C형 쉥겐 비자가 필요 없고 180일 내 90일 체류 가능.
2. `체류일수와 입국 전 확인`: 쉥겐 전체 체류일 합산, 여권·방문 목적·숙소·출국 계획·재정 증빙을 출발 전 확인.
3. `ETIAS`: EU 공식 기준 2026년 4분기 운영 예정, 현재 신청 불필요, 구체적 시행일 미발표.
4. `C형과 D형`: C형은 비자가 필요한 국적자의 90일 이하 단기체류, D형은 90일 초과 국가 비자이며 한국인의 단기 무비자와 구분.
5. `한국 국적자 취업`: 비EU/EFTA 제3국 국민, 취업허가 필요, 고숙련·쿼터·노동시장 우선 원칙, 고용주가 관할 당국에 신청.
6. `유학·가족결합`: 목적과 칸톤별 장기체류 승인 후 국가 비자·입국 절차를 대사관과 관할 당국에서 확인.

- [ ] **Step 4: FAQ를 검색 의도 네 개로 교체**

질문은 `스위스 여행에 비자가 필요한가요?`, `ETIAS를 지금 신청해야 하나요?`, `무비자로 일할 수 있나요?`, `C형과 D형은 무엇이 다른가요?`로 제한한다. 고정 처리기간·서류·비용은 답변하지 않는다.

- [ ] **Step 5: 공식 출처와 실제 내부 링크 추가**

```html
<a href="https://www.schweiz-republikkorea.eda.admin.ch/en/do-i-need-a-schengen-visa">주한 스위스대사관 공식 단기비자 안내</a>
<a href="https://travel-europe.europa.eu/en/etias">유럽연합 공식 ETIAS 안내</a>
<a href="https://www.sem.admin.ch/sem/en/home/overview-arbeit.html">스위스 연방 이민청 공식 취업 안내</a>
<a href="https://www.sem.admin.ch/sem/en/home/themen/arbeit/nicht-eu_efta-angehoerige.html">스위스 연방 이민청 공식 비EU/EFTA 취업 안내</a>
```

관련 링크는 `/kor/report/visa/france.html`, `germany.html`, `italy.html`, `austria.html`, `liechtenstein.html`만 사용한다.

- [ ] **Step 6: 모바일 광고 가로 넘침 차단**

페이지 `<head>`에만 다음 스타일을 추가해 공통 CSS와 광고 배치를 바꾸지 않는다.

```css
html,
body {
    max-width: 100%;
    overflow-x: hidden;
}
```

- [ ] **Step 7: GREEN 검증**

Run: `python3 -m unittest tests.test_switzerland_visa_page tests.test_validate_priority_pages -v`

Expected: 모든 테스트 PASS.

Run: `python3 scripts/validate_priority_pages.py kor/report/visa/switzerland.html`

Expected: `PASS kor/report/visa/switzerland.html`.

Run: `git diff --check && rg -n '완벽|최신 정보|2025년부터 ETIAS|보통 10-15일|1-2개월|SearchAction' kor/report/visa/switzerland.html`

Expected: diff 오류와 검색 결과 없음.

- [ ] **Step 8: 페이지 변경 커밋**

```bash
git add kor/report/visa/switzerland.html
git commit -m "feat: refresh Switzerland visa revenue guide"
```

### Task 3: 배포·모바일·색인·수익 측정 기록

**Files:**
- Modify: `docs/growth/2026-08-01-priority-rollout-log.md`
- Modify: `docs/superpowers/plans/2026-08-02-switzerland-visa-revenue-seo.md`
- Test: `https://emfls.github.io/kor/report/visa/switzerland.html`

**Interfaces:**
- Consumes: Task 2의 최신 커밋과 GitHub Pages 공개 URL
- Produces: 공개 검증·Search Console 재요청·2026-08-30 수익 판정 기준이 기록된 로그

- [ ] **Step 1: 전체 테스트 후 메인 배포**

Run: `python3 -m unittest discover -s tests -v && git diff --check && git status --short`

Expected: 모든 테스트 PASS, diff 오류 없음, 작업 트리 깨끗함.

```bash
git push origin main
```

- [ ] **Step 2: 공개 데스크톱·모바일·상호작용 검증**

공개 URL에서 새 title, H1, `최근 확인: 2026-08-02`, 공식 링크 4개, GA4·AdSense를 확인한다. 375×844 화면에서 문서 폭이 viewport를 넘지 않아야 한다. 검색창에 `ETIAS`를 입력하면 ETIAS 섹션만 관련 결과로 남고, `무비자로 일할 수 있나요?` FAQ를 클릭하면 답변이 열린다.

- [ ] **Step 3: Search Console 색인 재요청**

로그인된 Search Console의 URL 검사에서 공개 URL을 검사하고 `색인 생성 요청`을 실행한다. 성공 메시지, 기존 대기열, 일일 한도 중 실제 표시 결과를 기록한다.

- [ ] **Step 4: 성장 로그와 체크리스트 갱신**

```markdown
## 2026-08-02 — 2차 우선순위 2: 스위스 비자

- 기준선: 클릭 1, 노출 97, CTR 1.03%, 평균순위 10.71
- 변경: 한국 여권 180일 내 90일 답변, ETIAS 현재 상태, C/D 비자와 취업·유학 허가 분리
- 제거: 낡은 연도 표현, 추정 처리기간, 일률적 서류, 허가증별 과도한 일반화, SearchAction
- 검증: 전용·공통 테스트, 공개 데스크톱·375px 모바일, 검색·FAQ 동작
- 배포: 페이지 변경 커밋 직후 `git rev-parse --short=10 HEAD`로 확인한 해시 기록
- Search Console: URL 검사 화면에 표시된 성공·기존 대기열·일일 한도 중 해당 문구를 그대로 기록
- 수익 판정: 2026-08-30에 검색 세션·페이지뷰·참여시간·예상수익·페이지 RPM 비교
```

계획 문서의 모든 완료 단계도 `- [x]`로 바꾼다.

- [ ] **Step 5: 기록 커밋·푸시·원격 일치 확인**

```bash
git add docs/growth/2026-08-01-priority-rollout-log.md docs/superpowers/plans/2026-08-02-switzerland-visa-revenue-seo.md
git commit -m "docs: log Switzerland visa revenue rollout"
git push origin main
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

Expected: 로컬 HEAD와 원격 `main` 해시가 동일하고 작업 트리가 깨끗하다.
