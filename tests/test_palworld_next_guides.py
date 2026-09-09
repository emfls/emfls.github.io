from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "palworld-1-0-4-beyond-dimensions-quest-guide.html": ["차원을 넘어", "달의 저편에서", "어부의 마을"],
    "palworld-1-0-fishing-bait-rod-guide.html": ["낚시", "미끼", "선리치", "세계수"],
    "palworld-world-tree-holy-water-guide.html": ["세계수 성수", "대형 낚시 연못", "무게"],
}


def test_next_palworld_guides_are_complete_and_discoverable():
    hub = (ROOT / "kor/column/index.html").read_text(encoding="utf-8")
    sitemap = (ROOT / "kor/sitemap.xml").read_text(encoding="utf-8")
    for filename, phrases in PAGES.items():
        html = (ROOT / "kor/column" / filename).read_text(encoding="utf-8")
        url = f"https://emfls.github.io/kor/column/{filename}"
        assert f'<link rel="canonical" href="{url}">' in html
        assert 'name="description"' in html
        assert 'name="viewport"' in html
        assert 'application/ld+json' in html
        assert "검토일: 2026-09-09" in html
        assert "공식 자료" in html
        for phrase in phrases:
            assert phrase in html
        assert f'href="/kor/column/{filename}"' in hub
        assert url in sitemap


def test_next_palworld_guides_do_not_claim_unverified_search_volume():
    for filename in PAGES:
        html = (ROOT / "kor/column" / filename).read_text(encoding="utf-8")
        assert "월 검색량" not in html
        assert "검색량 1" not in html
