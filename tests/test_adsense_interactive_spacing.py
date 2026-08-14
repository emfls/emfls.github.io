from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LANGS = ("", "ae", "cn", "de", "es", "fr", "id", "in", "jp", "kor", "pt", "ru", "vn")


def interactive_pages():
    for lang in LANGS:
        prefix = ROOT / lang if lang else ROOT
        yield prefix / "util/dice3d/index.html"
        yield prefix / "util/fortune/index.html"


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
