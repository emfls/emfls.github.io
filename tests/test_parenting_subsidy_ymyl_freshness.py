from html.parser import HTMLParser
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/parenting/parenting-subsidy-2026.html"
TARGET_HEADING = "육아휴직·출산휴가 급여 — 직장인 부모 필수 확인"


class TargetSectionParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.section_depth = 0
        self.in_heading = False
        self.heading_parts = []
        self.capturing = False
        self.found = False
        self.text_parts = []
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "div":
            classes = attrs.get("class", "").split()
            if self.section_depth == 0 and "section" in classes:
                self.section_depth = 1
            elif self.section_depth:
                self.section_depth += 1
        elif tag == "h2":
            self.in_heading = True
            self.heading_parts = []
        elif tag == "a" and self.capturing and attrs.get("href"):
            self.links.append(attrs["href"])

    def handle_data(self, data):
        if self.in_heading:
            self.heading_parts.append(data)
        elif self.capturing:
            self.text_parts.append(data)

    def handle_endtag(self, tag):
        if tag == "h2" and self.in_heading:
            heading = " ".join("".join(self.heading_parts).split())
            self.in_heading = False
            if heading == TARGET_HEADING:
                self.capturing = True
                self.found = True
        elif tag == "div" and self.section_depth:
            if self.capturing and self.section_depth == 1:
                self.capturing = False
            self.section_depth -= 1


def target_section():
    parser = TargetSectionParser()
    parser.feed(PAGE.read_text(encoding="utf-8"))
    assert parser.found, f"Target section not found: {TARGET_HEADING}"
    text = " ".join("".join(parser.text_parts).split())
    return text, parser.links


def test_parental_leave_benefit_summary_matches_current_work24_contract():
    text, _ = target_section()

    assert "1~3개월 통상임금의 80%" not in text
    assert "4~6개월 50%" not in text
    assert "7개월 이후 50%" not in text
    assert "1~3개월" in text and "100%" in text and "250만원" in text
    assert "4~6개월" in text and "200만원" in text
    assert "7개월 이후" in text and "80%" in text and "160만원" in text
    assert "일반 기준" in text
    assert "일반 급여에는 별도 수급 요건이 있습니다" in text
    assert "생후 18개월 이내" in text and "동시 또는 순차" in text
    assert "첫 6개월" in text and "250·250·300·350·400·450만원" in text
    assert "첫 3개월 급여 100%" not in text
    assert "한부모 특례" in text
    assert "실제 수급 자격" in text and "고용24에서 확인하세요" in text
    assert "사업주에게 신청" in text and "고용24에 별도로 신청" in text
    assert "누구나 월 210만원" not in text


def test_special_leave_seven_day_benefit_threshold_excludes_maternity_overlap():
    text, links = target_section()

    assert (
        "법 제19조제1항에 따른 일반 육아휴직은 출산전후휴가와 중복되는 기간을 제외하고 "
        "30일 이상, 법 제19조제6항 특례 육아휴직은 같은 중복기간을 제외하고 7일 이상이어야 합니다."
    ) in text
    assert (
        "두 경우 모두 육아휴직 시작 전 피보험단위기간 합산 180일 이상 요건이 적용됩니다."
    ) in text
    assert "https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1021698255" in links


def test_spouse_leave_is_not_stated_as_ten_days():
    text, _ = target_section()

    assert not re.search(r"배우자.{0,24}10일", text)
    assert re.search(r"배우자 출산전후휴가.{0,24}20일.{0,12}유급", text)


def test_maternity_leave_claims_are_scoped_to_current_law():
    text, _ = target_section()

    assert "90일" in text and "다태아" in text and "120일" in text
    assert "미숙아" in text and "100일" in text
    assert "출산 후 45일 이상" in text
    assert "다태아는 60일 이상" in text
    assert "사업장 유형" in text and "고용보험" in text


def test_official_sources_and_review_date_are_visible():
    text, links = target_section()

    assert "법령 기준일: 2026-09-18" in text
    assert "일부 제11조·제13조 개정 조항은 2026-08-20" in text
    assert "최종 확인일: 2026-09-29" in text
    assert "고용24 안내 최종 수정: 2025-09-15" in text
    assert any("law.go.kr" in href and "lspttninfSeq=71235" in href for href in links)
    assert "https://www.law.go.kr/lsInfoP.do?lsiSeq=288719&viewCls=lsRvsDocInfoR" in links
    assert any("lsJoLnkSeq=900552022" in href for href in links)
    assert any("lsJoLnkSeq=1000446318" in href for href in links)
    assert any("ei.work24.go.kr" in href for href in links)
    assert any("m.work24.go.kr" in href for href in links)
