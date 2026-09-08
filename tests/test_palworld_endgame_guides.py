from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "palworld-1-0-awakening-radiant-gem-guide.html": ["각성", "광휘 보석", "세계수"],
    "palworld-1-0-raid-area-preparation-checklist.html": ["레이드 구역", "소환의 제단", "임시 구조물"],
    "palworld-1-0-sunreach-exploration-checklist.html": ["선리치", "소랄라이트", "특수 장비"],
}

def test_endgame_guides_have_metadata_content_and_links():
    hub = (ROOT / "kor/column/index.html").read_text(encoding="utf-8")
    sitemap = (ROOT / "kor/sitemap.xml").read_text(encoding="utf-8")
    for filename, phrases in PAGES.items():
        html = (ROOT / "kor/column" / filename).read_text(encoding="utf-8")
        url = f"https://emfls.github.io/kor/column/{filename}"
        assert f'<link rel="canonical" href="{url}">' in html
        assert 'name="description"' in html and 'application/ld+json' in html
        assert "검토일: 2026-09-09" in html
        for phrase in phrases:
            assert phrase in html
        assert filename in hub and url in sitemap
