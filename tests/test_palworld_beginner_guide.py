from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/column/palworld-1-0-beginner-first-day-guide.html"
URL = "https://emfls.github.io/kor/column/palworld-1-0-beginner-first-day-guide.html"


def test_palworld_guide_has_search_and_index_metadata():
    html = PAGE.read_text(encoding="utf-8")

    assert "<title>팰월드 1.0 초보 공략" in html
    assert f'<link rel="canonical" href="{URL}">' in html
    assert 'name="viewport"' in html
    assert 'type="application/ld+json"' in html
    assert 'name="description"' in html


def test_palworld_guide_answers_first_day_intent_without_fake_precision():
    html = PAGE.read_text(encoding="utf-8")

    assert "첫날 진행 순서" in html
    assert "현재 임무" in html
    assert "작업 적성" in html
    assert "팰 스피어" in html
    assert "막혔을 때" in html
    assert "검토일: 2026-09-08" in html
    assert "정확한 좌표" not in html


def test_palworld_guide_cites_official_version_and_product_sources():
    html = PAGE.read_text(encoding="utf-8")

    assert "store.steampowered.com/news" in html
    assert "store.steampowered.com/app/1623730" in html
    assert "팰월드 1.0" in html


def test_palworld_guide_is_connected_to_hub_and_sitemap():
    hub = (ROOT / "kor/column/index.html").read_text(encoding="utf-8")
    sitemap = (ROOT / "kor/sitemap.xml").read_text(encoding="utf-8")

    assert "palworld-1-0-beginner-first-day-guide.html" in hub
    assert URL in sitemap
