from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PACKING = "/kor/util/japan-travel-packing-checklist/"
ESIM = "/kor/util/japan-esim-data-calculator/"


def test_priority_japan_pages_link_to_both_travel_tools():
    pages = (
        ROOT / "kor/report/travel/일본-여행.html",
        ROOT / "kor/report/travel/일본-혼자-여행.html",
        ROOT / "kor/report/travel/japan-climate.html",
        ROOT / "kor/report/travel/japan-fukuoka.html",
        ROOT / "kor/report/travel/japan-sapporo.html",
    )

    for page in pages:
        html = page.read_text(encoding="utf-8")
        assert PACKING in html, f"missing packing tool link: {page}"
        assert ESIM in html, f"missing eSIM tool link: {page}"
        assert "일본 여행 준비물 체크리스트" in html
        assert "일본 eSIM 데이터" in html
