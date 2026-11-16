from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LANGS = ("", "cn", "de", "es", "fr", "id", "in", "jp", "kor", "pt", "ru", "vn")


def interactive_pages():
    for lang in LANGS:
        prefix = ROOT / lang if lang else ROOT
        yield prefix / "util/dice3d/index.html"
        yield prefix / "util/fortune/index.html"


GAME_PAGES = (
    "jp/game/ConnectFour/index.html",
    "jp/game/TicTacToe/index.html",
    "jp/game/CardMatch/index.html",
    "jp/game/SnakeGame/index.html",
    "kor/game/ConnectFour/index.html",
    "kor/game/Gomoku/index.html",
    "game/Gomoku/index.html",
    "game/CardMatch/index.html",
    "game/NumberHunt/index.html",
    "game/TicTacToe/index.html",
)


def test_interactive_ads_have_clear_label_and_safe_spacing():
    for page in interactive_pages():
        html = page.read_text(encoding="utf-8")
        assert 'aria-label="Advertisement"' in html, f"missing ad label: {page}"
        assert '<div class="ad-label">Advertisement</div>' in html, f"missing visible ad label: {page}"
        assert "margin:80px 0 20px!important" in html, f"unsafe control-to-ad spacing: {page}"


def test_no_ad_click_tracking_is_present():
    for page in interactive_pages():
        html = page.read_text(encoding="utf-8").lower()
        assert "ad_click" not in html
        assert "광고를 클릭" not in html
        assert "click the ad" not in html


def test_below_fold_game_pages_have_labelled_spaced_ad_slot():
    for rel in GAME_PAGES:
        html = (ROOT / rel).read_text(encoding="utf-8")
        assert 'aria-label="Advertisement"' in html, f"missing ad label: {rel}"
        assert '<div class="ad-label' in html and "Advertisement</div>" in html, f"missing visible ad label: {rel}"
        assert "margin:80px 0 20px!important" in html, f"unsafe control-to-ad spacing: {rel}"
        assert "pagead2.googlesyndication.com" in html, f"missing adsense loader: {rel}"
        assert html.count('class="adsbygoogle"') == 1, f"expected exactly one ad slot: {rel}"
        assert "AdSense disabled" not in html, f"stale disabled marker: {rel}"


def test_below_fold_game_pages_have_no_ad_click_encouragement():
    for rel in GAME_PAGES:
        html = (ROOT / rel).read_text(encoding="utf-8").lower()
        assert "ad_click" not in html
        for term in ("광고를 클릭", "광고 클릭", "click the ad", "click on the ad", "広告をクリック"):
            assert term not in html, f"{term} in {rel}"
