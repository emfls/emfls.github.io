from pathlib import Path


PAGE = Path("kor/report/visa/qatar.html")


def test_qatar_page_answers_the_korean_passport_question_first():
    html = PAGE.read_text(encoding="utf-8")

    assert "카타르 비자 필요할까?" in html
    assert "한국 일반여권 관광: 무료 도착 관광 허가" in html
    assert "최대 90일·연장 불가" in html
    assert "여권 유효기간 최소 3개월" in html


def test_qatar_page_uses_current_official_sources_without_guarantees():
    html = PAGE.read_text(encoding="utf-8")

    assert "portal.moi.gov.qa" in html
    assert "visitqatar.com" in html
    assert 'dateModified": "2026-08-13"' in html
    assert "입국을 보장합니다" not in html
