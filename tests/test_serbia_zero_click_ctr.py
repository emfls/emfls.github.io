from pathlib import Path


PAGE = Path("kor/report/visa/serbia.html")


def test_serbia_page_answers_the_korean_passport_question_first():
    html = PAGE.read_text(encoding="utf-8")

    assert "세르비아 비자 필요할까?" in html
    assert "한국 일반여권 단기 방문: 비자 불필요" in html
    assert "최대 90일" in html
    assert "세르비아는 솅겐 가입국이 아닙니다" in html


def test_serbia_page_uses_the_country_specific_official_source():
    html = PAGE.read_text(encoding="utf-8")

    assert "visa-regime/koreja-republika" in html
    assert 'dateModified": "2026-08-13"' in html
    assert "입국을 보장합니다" not in html
