from pathlib import Path


PAGE = Path("game/MBTI/index.html")


def test_quick_mbti_query_gets_an_immediate_search_answer():
    html = PAGE.read_text(encoding="utf-8")

    assert "Quick 16-Type Personality Quiz" in html
    assert "20 original scenario questions · about 3–4 minutes" in html
    assert "No email or sign-up" in html
    assert "E/I, S/N, T/F, and J/P" in html


def test_quick_mbti_page_stays_transparent_and_ad_free():
    html = PAGE.read_text(encoding="utf-8")

    assert "not the official MBTI® assessment" in html
    assert "not affiliated with The Myers-Briggs Company or Myers & Briggs Foundation" in html
    assert "pagead2.googlesyndication.com" not in html
    assert 'dateModified":"2026-09-20"' in html
