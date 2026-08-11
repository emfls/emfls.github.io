from scripts.improve_two_hundred_ga4_pages_common import apply_pages


def test_unicode_casefold_does_not_shift_body_insertion(tmp_path):
    source = '<html><body><p>İstanbul</p>G-QP5Q67GE5B ca-pub-8830524482034754</body></html>'
    (tmp_path / "page.html").write_text(source, encoding="utf-8")
    marker = "unicode-body-position-test"

    changed, skipped = apply_pages(
        tmp_path,
        [("page.html", "WebPage", "travel", "/")],
        marker,
        expected_len=1,
    )

    result = (tmp_path / "page.html").read_text(encoding="utf-8")
    assert (changed, skipped) == (1, 0)
    assert "</body>" in result
    assert result.index(marker) < result.index("</body>")
