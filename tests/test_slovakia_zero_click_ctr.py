from pathlib import Path


PAGE = Path("kor/report/visa/slovakia.html")


def test_slovakia_page_answers_the_main_visa_question_immediately():
    html = PAGE.read_text(encoding="utf-8")

    assert "슬로바키아 비자 필요할까?" in html
    assert "한국 일반여권 관광·단기 방문: 비자 불필요" in html
    assert "최근 180일 중 최대 90일" in html
    assert "솅겐 국가 체류일을 모두 합산" in html


def test_slovakia_page_keeps_official_sources_and_safe_claims():
    html = PAGE.read_text(encoding="utf-8")

    assert "eur-lex.europa.eu" in html
    assert "mzv.sk" in html
    assert 'dateModified": "2026-08-13"' in html
    assert "입국을 보장합니다" not in html
