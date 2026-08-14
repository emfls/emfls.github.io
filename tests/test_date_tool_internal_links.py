from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_time_difference_links_to_date_and_timestamp_tools():
    html = (ROOT / "util/time-diff/index.html").read_text(encoding="utf-8")
    assert '/util/date-difference/' in html
    assert '/util/unix-timestamp/' in html
    assert 'Date Difference Calculator' in html
    assert 'Milliseconds &amp; Unix Timestamp Converter' in html


def test_age_calculator_links_to_date_difference_tool():
    html = (ROOT / "util/age/index.html").read_text(encoding="utf-8")
    assert '/util/date-difference/' in html
    assert 'Date Difference Calculator' in html
