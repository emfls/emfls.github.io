from pathlib import Path


PAGE = Path("kor/report/visa/norway.html")


def test_norway_page_answers_the_main_visa_question_first():
    html = PAGE.read_text(encoding="utf-8")

    assert "노르웨이 비자 필요할까?" in html
    assert "한국 일반여권 단기 방문: 비자 불필요" in html
    assert "솅겐 전체에서 최근 180일 중 최대 90일" in html
    assert "노르웨이는 EU 회원국이 아니지만 솅겐 국가" in html


def test_norway_page_uses_udi_and_keeps_entry_limits_clear():
    html = PAGE.read_text(encoding="utf-8")

    assert "persons-who-do-not-need-a-visa-to-visit-norway" in html
    assert "원격근무를 포함한 취업" in html
    assert 'dateModified": "2026-08-13"' in html
