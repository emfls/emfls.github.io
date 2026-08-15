from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
CAMP = ROOT / "kor/report/camp"
LINKING_PAGES = (
    CAMP / "index.html",
    CAMP / "asan.html",
    CAMP / "damyang.html",
    CAMP / "gimpo.html",
    CAMP / "gongju.html",
    CAMP / "yeongdong.html",
)


def test_cheongju_inbound_links_match_car_camping_decision_intent():
    for page in LINKING_PAGES:
        html = page.read_text(encoding="utf-8")
        assert 'href="cheongju.html"' in html
        assert "청주 차박 허용·예약 확인" in html
        assert "청주 노지캠핑" not in html


def test_camp_hub_does_not_repeat_outdated_cheongju_claims():
    html = (CAMP / "index.html").read_text(encoding="utf-8")
    card = re.search(r'<a class="card" href="cheongju\.html">(.*?)</a>', html, re.S).group(1)
    assert "청주 차박 장소 2026" in card
    assert "문암생태공원 공식 예약" in card
    assert "청주시 노지 캠핑장 완전 가이드 2025" not in card
    assert "캠핑 성지 8곳" not in card
