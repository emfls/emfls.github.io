from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "util/reading-time/index.html"


def test_reading_time_exposes_clear_word_count_next_step_without_runtime_changes():
    html = PAGE.read_text(encoding="utf-8")
    assert '<a href="/util/EasyLetterWordCounter/">Count words first</a>' in html
    assert '<link rel="canonical" href="https://emfls.github.io/util/reading-time/">' in html
    assert 'G-QP5Q67GE5B' in html
    assert 'adsbygoogle.js?client=ca-pub-8830524482034754' in html
