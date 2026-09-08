from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/column/palworld-1-0-base-pal-not-working-checklist.html"
URL = "https://emfls.github.io/kor/column/palworld-1-0-base-pal-not-working-checklist.html"


def test_base_troubleshooting_guide_has_index_metadata():
    html = PAGE.read_text(encoding="utf-8")
    assert "<title>팰월드 1.0 거점 팰이 일하지 않을 때" in html
    assert f'<link rel="canonical" href="{URL}">' in html
    assert 'name="description"' in html
    assert 'type="application/ld+json"' in html


def test_base_troubleshooting_guide_answers_problem_intent():
    html = PAGE.read_text(encoding="utf-8")
    for phrase in ["작업 적성", "고정 배치", "동선", "상자 필터", "SAN", "검토일: 2026-09-08"]:
        assert phrase in html


def test_base_troubleshooting_guide_is_connected():
    hub = (ROOT / "kor/column/index.html").read_text(encoding="utf-8")
    sitemap = (ROOT / "kor/sitemap.xml").read_text(encoding="utf-8")
    assert "/kor/column/palworld-1-0-base-pal-not-working-checklist.html" in hub
    assert URL in sitemap

