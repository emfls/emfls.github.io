from pathlib import Path


PAGE = Path("kor/report/visa/uae.html")


def test_uae_page_answers_dubai_employment_visa_intent():
    html = PAGE.read_text(encoding="utf-8")

    assert "두바이 고용 비자" in html
    assert "고용주가 신청" in html
    assert "정식 일자리 제안" in html
    assert "취업허가 → 입국·신분변경 → 건강검진·Emirates ID → 거주허가" in html


def test_uae_page_links_current_official_employment_sources():
    html = PAGE.read_text(encoding="utf-8")

    assert "residence-visa-for-working-in-the-uae" in html
    assert "expatriates-employment-in-private-sector" in html
    assert "gdrfad.gov.ae" in html
    assert 'dateModified":"2026-08-13"' in html
