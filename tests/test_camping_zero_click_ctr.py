from pathlib import Path


GAPYEONG = Path("kor/report/camp/gapyeong.html")
CHEONGJU = Path("kor/report/camp/cheongju.html")


def test_gapyeong_page_matches_valley_search_without_promising_wild_camping():
    html = GAPYEONG.read_text(encoding="utf-8")

    assert "가평 노지계곡 캠핑 가능할까?" in html
    assert "계곡 공터는 캠핑장이 아닙니다" in html
    assert "자라섬 캠핑장" in html
    assert "/kor/util/camping-packing-checklist/" in html
    assert "무료 노지 캠핑장" not in html


def test_cheongju_page_matches_car_camping_search_without_permission_claims():
    html = CHEONGJU.read_text(encoding="utf-8")

    assert "청주 차박·노지캠핑 가능할까?" in html
    assert "주차 가능이 차박 허용을 뜻하지 않습니다" in html
    assert "문암생태공원 캠핑장" in html
    assert "/kor/util/camping-packing-checklist/" in html
    assert "대표 무료 노지 캠핑장" not in html
    assert "넓은 노지에서 자유로운 캠핑" not in html
    assert "차박명소" not in html


def test_both_pages_keep_measurement_and_avoid_ad_click_prompts():
    for page in (GAPYEONG, CHEONGJU):
        html = page.read_text(encoding="utf-8")
        assert "G-QP5Q67GE5B" in html
        assert "ca-pub-8830524482034754" in html
        assert "광고를 클릭" not in html
