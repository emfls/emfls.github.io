# North Macedonia Visa SEO Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 한국 여권 사용자가 북마케도니아 단기 방문과 장기체류 요건을 빠르고 정확하게 구분하도록 기존 페이지를 공식 출처 기반으로 개편한다.

**Architecture:** 단일 정적 HTML 페이지의 기존 CSS·검색·FAQ 동작은 유지하고, 메타데이터·본문·구조화 데이터만 목적별 정보 구조로 교체한다. 공통 검증기는 건드리지 않고 페이지 전용 회귀 테스트를 추가해 핵심 문구, 추적 코드, 공식 출처, 제거 대상 표현을 자동 검사한다.

**Tech Stack:** HTML5, CSS(기존 `style.css`), vanilla JavaScript, JSON-LD, Python `unittest`, GitHub Pages

## Global Constraints

- URL `https://emfls.github.io/kor/report/visa/northmacedonia.html`과 canonical을 유지한다.
- 기존 `style.css`, 페이지 검색 필터, FAQ 토글, GA4 `G-QP5Q67GE5B`, AdSense `ca-pub-8830524482034754`를 유지한다.
- 사이트 공통 CSS와 다른 비자 페이지는 수정하지 않는다.
- 확인되지 않은 처리기간·수수료·필수 서류를 추정하지 않는다.
- `완벽`, `최신` 같은 보장 표현과 존재하지 않는 `WebSite/SearchAction`을 사용하지 않는다.
- 최근 확인일과 JSON-LD `dateModified`는 `2026-08-02`로 기록한다.

---

## File Structure

- Modify: `kor/report/visa/northmacedonia.html` — 검색 메타데이터, 첫 답변, 목적별 안내, 공식 출처, 관련 링크, JSON-LD를 제공한다.
- Create: `tests/test_northmacedonia_visa_page.py` — 이 페이지에서 반드시 유지하거나 제거해야 할 정적 계약을 검사한다.
- Modify: `docs/growth/2026-08-01-priority-rollout-log.md` — 배포 커밋, 검증 결과, 공개 페이지 확인과 색인 요청 결과를 누적 기록한다.

### Task 1: 페이지 계약을 회귀 테스트로 고정

**Files:**
- Create: `tests/test_northmacedonia_visa_page.py`
- Test: `tests/test_northmacedonia_visa_page.py`

**Interfaces:**
- Consumes: 저장소 루트 기준 `kor/report/visa/northmacedonia.html`
- Produces: 메타데이터·추적 코드·공식 출처·금지 표현을 검사하는 `NorthMacedoniaVisaPageTests`

- [ ] **Step 1: 현재 페이지에서 실패하는 전용 테스트 작성**

```python
import json
import re
import unittest
from pathlib import Path


PAGE = Path(__file__).resolve().parents[1] / "kor/report/visa/northmacedonia.html"


class NorthMacedoniaVisaPageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")

    def test_search_metadata_answers_korean_passport_intent(self):
        self.assertIn("<title>북마케도니아 비자: 한국 여권 90일 무비자·장기체류 안내</title>", self.html)
        self.assertIn("180일 내 최대 90일", self.html)
        self.assertIn('rel="canonical" href="https://emfls.github.io/kor/report/visa/northmacedonia.html"', self.html)

    def test_measurement_and_existing_interactions_remain(self):
        self.assertIn("G-QP5Q67GE5B", self.html)
        self.assertIn("ca-pub-8830524482034754", self.html)
        self.assertIn('id="searchInput"', self.html)
        self.assertIn("function toggleFAQ(element)", self.html)

    def test_official_sources_and_freshness_are_present(self):
        self.assertIn("최근 확인: 2026-08-02", self.html)
        self.assertIn("https://0404.go.kr/ntnSafetyInfo/368/detail", self.html)
        self.assertIn("https://mfa.gov.mk/en-GB/konzularni-uslugi/vidovi-vizi-za-vlez-vo-rsm", self.html)
        self.assertIn("https://mvr.gov.mk/en-GB/uslugi/upatstvo-i-postapka-za-oddelni-prava-baranja-na-strancite", self.html)

    def test_unsupported_or_misleading_claims_are_removed(self):
        for phrase in ("완벽 가이드", "1년 단위 최대 90일", "여행자보험 가입 필수", "단기 취업 (90일 이하)", "보통 15일 이내"):
            self.assertNotIn(phrase, self.html)
        self.assertNotIn('"@type": "SearchAction"', self.html)

    def test_json_ld_describes_this_web_page(self):
        blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>', self.html, re.S)
        documents = [json.loads(block) for block in blocks]
        page = next(item for item in documents if item.get("@type") == "WebPage")
        self.assertEqual(page["url"], "https://emfls.github.io/kor/report/visa/northmacedonia.html")
        self.assertEqual(page["dateModified"], "2026-08-02")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 테스트가 기존의 낡은 콘텐츠 때문에 실패하는지 확인**

Run: `python3 -m unittest tests.test_northmacedonia_visa_page -v`

Expected: 제목, `180일 내 최대 90일`, 공식 URL, `WebPage` JSON-LD 관련 assertion이 FAIL한다.

- [ ] **Step 3: 테스트 파일만 커밋**

```bash
git add tests/test_northmacedonia_visa_page.py
git commit -m "test: define North Macedonia visa page contract"
```

### Task 2: 공식 출처 기반으로 페이지 콘텐츠 교체

**Files:**
- Modify: `kor/report/visa/northmacedonia.html:5-413`
- Test: `tests/test_northmacedonia_visa_page.py`

**Interfaces:**
- Consumes: Task 1의 `NorthMacedoniaVisaPageTests`, 기존 `style.css`, `searchInput`, `toggleFAQ(element)`
- Produces: 검색 가능한 `.visa-category` 섹션과 유효한 `WebPage` JSON-LD를 갖춘 정적 페이지

- [ ] **Step 1: 검색 메타데이터와 JSON-LD 교체**

`title`, description, Open Graph, Twitter를 다음 핵심 문구로 맞춘다.

```html
<title>북마케도니아 비자: 한국 여권 90일 무비자·장기체류 안내</title>
<meta name="description" content="한국 여권의 북마케도니아 무비자 체류는 180일 내 최대 90일입니다. 단기 방문과 C·D 비자, 취업·유학 등 임시거주 절차의 차이를 공식 출처로 확인하세요." />
```

기존 `WebSite/SearchAction` 블록을 다음 페이지 설명으로 교체한다.

```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "북마케도니아 비자: 한국 여권 90일 무비자·장기체류 안내",
  "description": "한국 여권 사용자를 위한 북마케도니아 단기 방문과 장기체류 안내",
  "url": "https://emfls.github.io/kor/report/visa/northmacedonia.html",
  "inLanguage": "ko-KR",
  "dateModified": "2026-08-02"
}
```

- [ ] **Step 2: 첫 화면에 결론과 적용 범위를 먼저 배치**

`<body>`의 기존 `.container` 안에 `<main>`을 추가하고 H1 아래 요약을 다음 의미로 작성한다.

```html
<div class="info-box">
  <strong>먼저 답:</strong> 대한민국 일반여권 소지자는 북마케도니아에 비자 없이 180일 내 최대 90일까지 단기 방문할 수 있습니다. 무비자는 취업·유학·가족결합 같은 장기체류 허가가 아니며, 실제 입국 허용 여부는 국경 당국이 판단합니다.
</div>
<p>최근 확인: 2026-08-02</p>
```

`main`은 본문 콘텐츠와 내부 링크 블록을 감싸고 footer 직전에 닫아 검증기의 `main` 요구를 충족한다.

- [ ] **Step 3: 본문을 목적별 다섯 섹션으로 재작성**

기존 디자인과 검색 동작을 위해 각 섹션에 `.visa-category`를 유지하고 다음 사실만 단정한다.

1. `한국 여권 단기 방문`: 대한민국 외교부 해외안전여행 기준 일반 단수·복수여권 모두 `180일 내 90일`, 도착사증 미발급.
2. `입국 전 확인`: 여권·방문 목적·숙소·귀국 또는 다음 여정·체류비 증빙은 국경에서 요구될 수 있으므로 출발 전 항공사와 관할기관에서 재확인. 여행자보험을 무비자 입국의 일률적 필수조건으로 단정하지 않는다.
3. `C형 비자`: 비자가 필요한 국적자의 단기체류·환승용이며, 공식 외교부가 안내하는 신청 요건은 한국인의 무비자 입국 요건과 구분한다.
4. `D형 비자와 임시거주`: D형은 내무부의 임시거주 결정 후 목적에 맞는 서류를 제출하는 장기체류 절차이며, 사유는 취업·학업·연구·가족결합 등을 포함한다.
5. `취업·유학`: 단기 무비자 방문만으로 근무나 학업 자격이 생기지 않으며, 목적별 임시거주·고용 절차를 북마케도니아 내무부 또는 관할 공관에서 확인한다.

- [ ] **Step 4: FAQ를 검증 가능한 질문 네 개로 교체**

FAQ 답변은 `180일 내 90일 계산`, `무비자로 일할 수 있는지`, `C형과 D형 차이`, `출발 전 어디서 확인하는지`만 다룬다. 처리기간, 일률적 보험 의무, 범죄경력증명서 같은 목적별 변동사항은 확정 답변에서 제거한다.

- [ ] **Step 5: 공식 확인처와 관련 비자 링크 추가**

다음 링크를 표시되는 앵커 텍스트에 `공식`이라는 단어가 포함되도록 추가한다.

```html
<a href="https://0404.go.kr/ntnSafetyInfo/368/detail">대한민국 외교부 해외안전여행 공식 국가정보</a>
<a href="https://mfa.gov.mk/en-GB/konzularni-uslugi/dali-ti-e-potrebna-viza">북마케도니아 외교부 공식 비자 필요 여부</a>
<a href="https://mfa.gov.mk/en-GB/konzularni-uslugi/vidovi-vizi-za-vlez-vo-rsm">북마케도니아 외교부 공식 비자 종류</a>
<a href="https://mvr.gov.mk/en-GB/uslugi/upatstvo-i-postapka-za-oddelni-prava-baranja-na-strancite">북마케도니아 내무부 공식 외국인 체류 안내</a>
```

관련 국가 링크는 실제 파일이 존재하는 `/kor/report/visa/albania.html`, `/kor/report/visa/bulgaria.html`, `/kor/report/visa/serbia.html`, `/kor/report/visa/montenegro.html`만 사용한다.

- [ ] **Step 6: 전용 테스트와 공통 검증 실행**

Run: `python3 -m unittest tests.test_northmacedonia_visa_page tests.test_validate_priority_pages -v`

Expected: 모든 테스트 PASS.

Run: `python3 scripts/validate_priority_pages.py kor/report/visa/northmacedonia.html`

Expected: `PASS kor/report/visa/northmacedonia.html`.

- [ ] **Step 7: HTML·변경사항 정적 검사**

Run: `git diff --check`

Expected: 출력 없이 종료 코드 0.

Run: `rg -n '완벽|최신 정보|1년 단위|여행자보험 가입 필수|SearchAction|보통 15일' kor/report/visa/northmacedonia.html`

Expected: 검색 결과 없음.

- [ ] **Step 8: 페이지 변경 커밋**

```bash
git add kor/report/visa/northmacedonia.html
git commit -m "feat: refresh North Macedonia visa guide"
```

### Task 3: 공개 배포 검증과 성장 기록 갱신

**Files:**
- Modify: `docs/growth/2026-08-01-priority-rollout-log.md`
- Test: public `https://emfls.github.io/kor/report/visa/northmacedonia.html`

**Interfaces:**
- Consumes: Task 2의 커밋과 GitHub Pages 공개 URL
- Produces: 검증·배포·색인 요청 상태가 남은 성장 로그

- [ ] **Step 1: 전체 변경과 테스트를 최종 재검증**

Run: `python3 -m unittest discover -s tests -v`

Expected: 모든 테스트 PASS.

Run: `git diff --check && git status --short`

Expected: diff 오류 없음. 성장 로그 갱신 전에는 작업 트리가 깨끗함.

- [ ] **Step 2: 메인 브랜치를 GitHub에 배포**

```bash
git push origin main
```

Expected: 원격 `main`이 Task 2의 최신 커밋으로 이동한다.

- [ ] **Step 3: 공개 URL에서 배포 결과 확인**

GitHub Pages 반영을 기다린 뒤 공개 URL의 HTTP 200, 새 `<title>`, `최근 확인: 2026-08-02`, 세 공식 출처 도메인, GA4·AdSense ID를 확인한다. 모바일 폭에서는 가로 넘침이 없고 검색 필터와 FAQ 토글이 동작해야 한다.

- [ ] **Step 4: Search Console URL 검사에서 색인 생성 요청**

Chrome의 로그인된 Search Console에서 `https://emfls.github.io/kor/report/visa/northmacedonia.html`을 검사하고 `색인 생성 요청`을 실행한다. 이미 대기열에 있거나 일일 한도에 걸리면 그 상태를 성공으로 가장하지 말고 로그에 그대로 기록한다.

- [ ] **Step 5: 성장 로그에 결과 추가**

다음 형식으로 `docs/growth/2026-08-01-priority-rollout-log.md`에 추가한다.

```markdown
## 2026-08-02 — 2차 우선순위 1: 북마케도니아 비자

- 기준선: 클릭 4, 노출 104, CTR 3.85%, 평균순위 5.65
- 변경: 한국 여권 180일 내 90일 답변 우선 배치, C/D 비자와 임시거주 분리, 공식 출처·최근 확인일·WebPage JSON-LD 추가
- 제거: 1년 단위 계산, 무비자 보험 의무, 단기취업 가능, 추정 처리기간, SearchAction
- 검증: 전용·공통 테스트, 정적 검사, 공개 URL 및 모바일 동작 확인
- 배포: `<실제 커밋>`
- Search Console: `<실제 요청 결과>`
- 28일 재평가일: 2026-08-30
```

- [ ] **Step 6: 로그 커밋과 원격 일치 확인**

```bash
git add docs/growth/2026-08-01-priority-rollout-log.md
git commit -m "docs: log North Macedonia visa rollout"
git push origin main
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

Expected: 로컬 HEAD와 원격 `refs/heads/main` 해시가 동일하다.
