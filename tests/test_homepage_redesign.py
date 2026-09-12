from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "index.html"


def test_homepage_is_a_search_first_topic_hub():
    html = PAGE.read_text(encoding="utf-8")
    assert 'id="site-search"' in html
    assert 'aria-label="사이트 콘텐츠 검색"' in html
    assert 'id="search-results"' in html
    assert "/data/home-feed-ko.json" in html
    assert "/data/content-index-ko.json" in html
    assert "ensureSearchIndex" in html
    for label in ("캠핑·차박", "여행", "게임", "무료 도구", "자동차·생활", "금융·투자", "AI·테크", "생활정보"):
        assert label in html


def test_homepage_surfaces_current_verified_content():
    html = PAGE.read_text(encoding="utf-8")
    assert "renderHomeFeed" in html
    assert 'id="popular-tags"' in html


def test_homepage_preserves_indexing_analytics_and_ad_contracts():
    html = PAGE.read_text(encoding="utf-8")
    assert '<link rel="canonical" href="https://emfls.github.io/"' in html
    assert "G-QP5Q67GE5B" in html
    assert "ca-pub-8830524482034754" in html
    assert 'aria-label="광고"' in html
    assert "application/ld+json" in html
    assert "SearchAction" not in html
    assert "window.location.href=matches[0].href" not in html


def test_homepage_has_mobile_navigation_and_accessible_focus_styles():
    html = PAGE.read_text(encoding="utf-8")
    assert 'aria-label="주요 메뉴"' in html
    assert 'class="mobile-topic-nav"' in html
    assert ":focus-visible" in html
    assert "@media (max-width: 720px)" in html
