from pathlib import Path


PAGE = Path("game/MBTI/index.html")


def test_quick_mbti_query_gets_an_immediate_search_answer():
    html = PAGE.read_text(encoding="utf-8")

    assert "Quick MBTI Test" in html
    assert "16 questions · about 3 minutes" in html
    assert "No email or sign-up" in html
    assert "E/I, S/N, T/F, and J/P" in html


def test_quick_mbti_page_stays_transparent_and_ad_free():
    html = PAGE.read_text(encoding="utf-8")

    assert "not a clinical or professional assessment" in html
    assert "pagead2.googlesyndication.com" not in html
    assert 'dateModified":"2026-08-13"' in html
