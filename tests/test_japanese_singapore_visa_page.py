from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "jp/report/travel/singapore-visa.html"
TRAVEL_PAGES = [
    page
    for page in sorted((ROOT / "jp/report/travel").glob("singapore-*.html"))
    if page.name != "singapore-visa.html"
]


def test_japanese_singapore_visa_page_answers_observed_search_intent():
    html = PAGE.read_text(encoding="utf-8")

    assert "シンガポールのビザ種類" in html
    assert "日本国旅券" in html
    assert "観光・短期訪問では事前ビザは不要" in html
    assert "SG Arrival Card" in html
    assert "Employment Pass" in html
    assert "S Pass" in html
    assert "ONE Pass" in html


def test_page_uses_official_sources_and_policy_safe_language():
    html = PAGE.read_text(encoding="utf-8")

    assert "https://www.ica.gov.sg/enter-transit-depart/entering-singapore/visa_requirements" in html
    assert "https://eservices.ica.gov.sg/sgarrivalcard/" in html
    assert "https://www.mom.gov.sg/passes-and-permits" in html
    assert "入国を保証するものではありません" in html
    assert "G-QP5Q67GE5B" in html
    assert "ca-pub-8830524482034754" in html
    assert "広告をクリック" not in html


def test_japanese_travel_pages_and_sitemap_discover_the_new_page():
    assert len(TRAVEL_PAGES) == 25
    for page in TRAVEL_PAGES:
        html = page.read_text(encoding="utf-8")
        assert '<html lang="ja">' in html
        assert html.count('href="/jp/report/travel/singapore-visa.html"') == 1

    sitemap = (ROOT / "jp/report/travel/sitemap.xml").read_text(encoding="utf-8")
    assert "https://emfls.github.io/jp/report/travel/singapore-visa.html" in sitemap
