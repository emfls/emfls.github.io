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

    assert "シンガポール入国・ビザ｜日本人は観光ビザ不要・SG Arrival Card・就労パス" in html
    assert "日本人向けシンガポール入国・ビザガイド" in html
    assert "日本国旅券" in html
    assert "レジャー・商用目的の事前ビザ申請は不要" in html
    assert "有効期間が6か月以上" in html
    assert "SG Arrival Card" in html
    assert "e-Pass" in html
    assert "Work Pass" in html
    assert "Employment Pass" in html
    assert "S Pass" in html
    assert "ONE Pass" in html


def test_page_uses_official_sources_and_policy_safe_language():
    html = PAGE.read_text(encoding="utf-8")

    assert "https://www.ica.gov.sg/enter-transit-depart/entering-singapore/visa_requirements" in html
    assert "https://www.ica.gov.sg/enter-transit-depart/entering-singapore/sg-arrival-card" in html
    assert "https://eservices.ica.gov.sg/sgarrivalcard/" in html
    assert "https://tokyo.mfa.gov.sg/visa-information/" in html
    assert "https://www.mom.gov.sg/passes-and-permits" in html
    assert "入国を保証するものではありません" in html
    assert "G-QP5Q67GE5B" in html
    assert "ca-pub-8830524482034754" in html
    assert "広告をクリック" not in html


def test_sg_arrival_card_task_can_be_completed_from_the_page():
    html = PAGE.read_text(encoding="utf-8")
    for phrase in ("3日以内", "無料", "MyICA", "乗り継ぎ・トランジット", "acknowledgement email", "DE番号", "Update SGAC", "SGACとe-Passは別", "SG Arrival Cardはビザではありません"):
        assert phrase in html
    assert "ICA公式 SGAC e-Service" in html
    assert "SGAC e-Service" in html


def test_structured_data_and_locale_contract():
    html = PAGE.read_text(encoding="utf-8")
    assert html.count('rel="canonical"') == 1
    assert html.count("<h1>") == 1
    assert html.count('"@type":"WebPage"') == 1
    assert '"@type":"FAQPage"' not in html
    assert '"dateModified":"2026-09-20"' in html
    assert '"inLanguage":"ja-JP"' in html
    assert html.count('hreflang="ja"') == 1
    assert 'hreflang="ko"' not in html
    assert 'hreflang="x-default"' not in html


def test_ad_and_official_cta_contract():
    html = PAGE.read_text(encoding="utf-8")
    assert "G-QP5Q67GE5B" in html
    assert "ca-pub-8830524482034754" in html
    assert 'class="official-cta"' in html
    assert '<ins class="adsbygoogle"' not in html
    assert "passport number" not in html.lower()


def test_japanese_travel_pages_and_sitemap_discover_the_new_page():
    assert len(TRAVEL_PAGES) == 25
    for page in TRAVEL_PAGES:
        html = page.read_text(encoding="utf-8")
        assert '<html lang="ja">' in html
        assert html.count('href="/jp/report/travel/singapore-visa.html"') == 1

    sitemap = (ROOT / "jp/report/travel/sitemap.xml").read_text(encoding="utf-8")
    assert "https://emfls.github.io/jp/report/travel/singapore-visa.html" in sitemap
    target = sitemap.split("https://emfls.github.io/jp/report/travel/singapore-visa.html", 1)[1].split("</url>", 1)[0]
    assert "<lastmod>2026-09-20</lastmod>" in target
