from pathlib import Path


PAGE = Path("util/url-encoder/index.html")


def test_url_encoder_matches_encodeurl_and_javascript_search_intent():
    html = PAGE.read_text(encoding="utf-8")

    assert "URL Encode & Decode Online" in html
    assert "encodeURIComponent" in html
    assert "Encode full URL" in html
    assert "Decode full URL" in html
    assert "encodeURI" in html
    assert "decodeURI" in html


def test_url_encoder_keeps_privacy_measurement_and_safe_errors():
    html = PAGE.read_text(encoding="utf-8")

    assert "processed in your browser" in html
    assert "Malformed percent encoding" in html
    assert "G-QP5Q67GE5B" in html
    assert "ca-pub-8830524482034754" in html
    assert "광고를 클릭" not in html
