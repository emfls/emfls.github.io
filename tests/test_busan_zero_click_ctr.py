from pathlib import Path


PAGE = Path("kor/report/camp/busan.html")


def test_busan_page_matches_wild_camping_search_with_a_safe_answer():
    html = PAGE.read_text(encoding="utf-8")

    assert "부산 노지캠핑 가능할까?" in html
    assert "해수욕장·공원·주차장은 공식 캠핑장이 아닙니다" in html
    assert "공식 예약 캠핑장 5곳" in html
    assert "/kor/util/camping-packing-checklist/" in html


def test_busan_page_does_not_promise_free_or_permitted_wild_camping():
    html = PAGE.read_text(encoding="utf-8")

    assert "무료 노지 캠핑장" not in html
    assert "차박 가능합니다" not in html
    assert "주차 가능 여부가 숙박" in html
    assert "광고를 클릭" not in html
