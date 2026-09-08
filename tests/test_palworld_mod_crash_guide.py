from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/column/palworld-1-0-mod-crash-fix-checklist.html"
URL = "https://emfls.github.io/kor/column/palworld-1-0-mod-crash-fix-checklist.html"


def test_mod_crash_guide_has_index_metadata():
    html = PAGE.read_text(encoding="utf-8")
    assert "<title>팰월드 1.0 모드 충돌·실행 오류 해결" in html
    assert f'<link rel="canonical" href="{URL}">' in html
    assert 'name="description"' in html
    assert 'type="application/ld+json"' in html


def test_mod_crash_guide_preserves_save_and_follows_official_order():
    html = PAGE.read_text(encoding="utf-8")
    for phrase in ["세이브 백업", "비활성화만으로는", "무결성 검사", "모드 없는 상태", "하나씩", "검토일: 2026-09-08"]:
        assert phrase in html
    assert "guideline.palworldgame.com" in html


def test_mod_crash_guide_is_connected():
    hub = (ROOT / "kor/column/index.html").read_text(encoding="utf-8")
    sitemap = (ROOT / "kor/sitemap.xml").read_text(encoding="utf-8")
    assert "/kor/column/palworld-1-0-mod-crash-fix-checklist.html" in hub
    assert URL in sitemap
