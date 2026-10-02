import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/car/used-car-buying-sites-guide.html"
URL = "https://emfls.github.io/kor/report/car/used-car-buying-sites-guide.html"


def _article_json_ld(html: str) -> dict:
    match = re.search(
        r'<script type="application/ld\+json">(.*?)</script>',
        html,
        flags=re.DOTALL,
    )
    assert match, "Article JSON-LD is required"
    return json.loads(match.group(1))


def test_used_car_buying_sites_guide_contract():
    assert PAGE.exists()
    html = PAGE.read_text(encoding="utf-8")
    assert '<html lang="ko">' in html
    assert '<meta charset="UTF-8">' in html
    assert '<meta name="viewport" content="width=device-width,initial-scale=1.0">' in html
    assert "<title>중고차 구매 사이트 고르는 법 2026 | 자동차365 매물 검증 체크리스트</title>" in html
    assert '<meta name="description"' in html
    assert '<meta name="robots" content="index,follow">' in html
    assert f'<link rel="canonical" href="{URL}">' in html
    assert html.count("<h1>") == 1
    assert "<h1>중고차 구매 사이트 고르는 법 2026: 사이트 선택보다 중요한 매물 검증</h1>" in html

    article = _article_json_ld(html)
    assert article["@context"] == "https://schema.org"
    assert article["@type"] == "Article"
    assert article["headline"] == "중고차 구매 사이트 고르는 법 2026: 사이트 선택보다 중요한 매물 검증"
    assert article["datePublished"] == "2026-09-27"
    assert article["dateModified"] == "2026-09-27"

    required_terms = (
        "자동차365",
        "성능·상태점검기록부",
        "판매자",
        "사업자",
        "실매물",
        "동일 조건",
        "계약 조건",
        "공식 출처",
        "정보 확인일: 2026-09-27",
        "https://www.encar.com/sg/sg_index_v01.html",
        "https://www.kcar.com/bc/homeSvc/main",
        "https://www.kbchachacha.com/",
        "https://certified.hyundai.com/p/display/buyMycarInfo.do",
        "https://www.car365.go.kr/ccpt/schdcar/trde/prchsGuide.do?_menuId=M630401000&moblYn=Y",
        "https://www.car365.go.kr/ccpt/schdcar/trde/trdeThingView.do?_menuId=M630404000&moblYn=Y",
        "G-QP5Q67GE5B",
        "ca-pub-8830524482034754",
    )
    normalized_html = html.replace("&amp;", "&")
    for term in required_terms:
        assert term in normalized_html

    for forbidden in (
        "TOP 5",
        "1위",
        "최저가",
        "가장 안전",
        "허위매물 없음",
        "추천 업체",
        "affiliate",
        "referral",
        "제휴",
    ):
        assert forbidden not in html


def test_used_car_buying_sites_guide_explains_verification_flow():
    html = PAGE.read_text(encoding="utf-8")
    for step in (
        "STEP 1",
        "STEP 2",
        "STEP 3",
        "STEP 4",
        "STEP 5",
        "STEP 6",
        "STEP 7",
        "차종",
        "세대",
        "연식",
        "주행거리",
        "트림",
        "옵션",
        "사고·보험 이력",
        "용도이력",
        "총비용",
        "배송",
        "보증",
        "환불",
    ):
        assert step in html


def test_used_car_buying_sites_discovery_wiring_contract():
    hub = (ROOT / "kor/report/car/index.html").read_text(encoding="utf-8")
    assert hub.count(
        'href="/kor/report/car/used-car-buying-sites-guide.html"'
    ) == 1
    assert len(re.findall(r'<a class="card" href=', hub)) == 18
    assert "총 18개 콘텐츠" in hub

    car_sitemap = (ROOT / "kor/report/car/sitemap.xml").read_text(encoding="utf-8")
    kor_sitemap = (ROOT / "kor/sitemap.xml").read_text(encoding="utf-8")
    assert car_sitemap.count(f"<loc>{URL}</loc>") == 1
    assert kor_sitemap.count(f"<loc>{URL}</loc>") == 0
