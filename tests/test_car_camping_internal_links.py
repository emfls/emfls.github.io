from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TARGET = "/kor/report/camp/%EC%B0%A8%EB%B0%95.html"


def test_high_intent_camping_pages_link_to_permission_checklist():
    pages = (
        ROOT / "kor/report/camp/gapyeong.html",
        ROOT / "kor/report/camp/cheongju.html",
        ROOT / "kor/report/camp/busan.html",
    )

    for page in pages:
        html = page.read_text(encoding="utf-8")
        assert TARGET in html, f"missing car-camping checklist link: {page}"
        assert "차박 가능 여부 체크리스트" in html
