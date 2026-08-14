from pathlib import Path


PAGE = Path("kor/report/visa/singapore.html")


def test_singapore_page_matches_tourist_and_work_pass_search_intent():
    html = PAGE.read_text(encoding="utf-8")

    assert "싱가포르 비자 2026" in html
    assert "무비자·ONE Pass 해외 네트워크 전문가" in html
    assert "싱가포르 취업비자 종류" in html
    assert "Employment Pass" in html
    assert "S Pass" in html
    assert "ONE Pass" in html
    assert "https://www.mom.gov.sg/passes-and-permits/employment-pass" in html
    assert "https://www.mom.gov.sg/passes-and-permits/s-pass" in html
    assert "고용주 또는 지정 대행사가 신청" in html


def test_singapore_page_keeps_adsense_policy_and_travel_safety_guards():
    html = PAGE.read_text(encoding="utf-8")

    assert "ca-pub-8830524482034754" in html
    assert "입국을 보장" in html
    assert "광고를 클릭" not in html
