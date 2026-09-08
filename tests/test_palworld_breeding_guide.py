from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/column/palworld-1-0-breeding-start-checklist.html"
URL = "https://emfls.github.io/kor/column/palworld-1-0-breeding-start-checklist.html"


def test_breeding_guide_has_index_metadata():
    html = PAGE.read_text(encoding="utf-8")
    assert "<title>팰월드 1.0 교배 공략" in html
    assert f'<link rel="canonical" href="{URL}">' in html
    assert 'name="description"' in html
    assert 'type="application/ld+json"' in html


def test_breeding_guide_covers_version_sensitive_workflow():
    html = PAGE.read_text(encoding="utf-8")
    for phrase in ["교배 시작 체크리스트", "부모 팰", "액티브 스킬", "돌연변이", "케이크", "검토일: 2026-09-08"]:
        assert phrase in html
    assert "2024년 조합표를 그대로" in html


def test_breeding_guide_uses_official_source_and_is_connected():
    html = PAGE.read_text(encoding="utf-8")
    hub = (ROOT / "kor/column/index.html").read_text(encoding="utf-8")
    sitemap = (ROOT / "kor/sitemap.xml").read_text(encoding="utf-8")
    assert "store.steampowered.com/news" in html
    assert "/kor/column/palworld-1-0-breeding-start-checklist.html" in hub
    assert URL in sitemap
