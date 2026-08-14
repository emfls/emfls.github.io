from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TARGET = "/kor/report/visa/singapore.html"


def test_priority_singapore_guides_link_to_visa_page():
    pages = (
        "singapore-marinabay.html",
        "singapore-orchard.html",
        "singapore-central.html",
        "singapore-jurong-east.html",
        "singapore-woodlands.html",
    )

    for filename in pages:
        html = (ROOT / "kor/report/travel" / filename).read_text(encoding="utf-8")
        assert TARGET in html, f"missing visa link: {filename}"
        assert "싱가포르 비자·입국·취업 패스 안내" in html
