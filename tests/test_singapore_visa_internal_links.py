from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TARGET = "/kor/report/visa/singapore.html"


def test_all_singapore_guides_link_once_to_visa_page():
    pages = sorted((ROOT / "kor/report/travel").glob("singapore-*.html"))
    assert len(pages) == 25

    for page in pages:
        html = page.read_text(encoding="utf-8")
        assert html.count(f'href="{TARGET}"') == 1, f"wrong visa-link count: {page.name}"
        assert "싱가포르 비자·입국·취업 패스 안내" in html
