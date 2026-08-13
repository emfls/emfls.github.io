from pathlib import Path


PAGE = Path("kor/report/visa/nigeria.html")


def test_nigeria_page_answers_the_main_visa_question_first():
    html = PAGE.read_text(encoding="utf-8")

    assert "나이지리아 비자 필요할까?" in html
    assert "한국 일반여권: 무비자 입국 대상 아님" in html
    assert "관광 e-Visa F5A" in html
    assert "최대 90일·연장 불가" in html


def test_nigeria_page_warns_against_fake_visa_sites():
    html = PAGE.read_text(encoding="utf-8")

    assert "제3자 급행 승인 사이트" in html
    assert "immigration.gov.ng" in html
    assert 'dateModified":"2026-08-13"' in html
