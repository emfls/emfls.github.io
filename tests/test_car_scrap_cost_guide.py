from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/car/car-scrap-cost-guide.html"
URL = "https://emfls.github.io/kor/report/car/car-scrap-cost-guide.html"


def test_car_scrap_guide_publication_contract():
    html = PAGE.read_text(encoding="utf-8")
    assert "<title>자동차 폐차 비용 2026 | 보상금·견적 비교·말소 절차</title>" in html
    assert '<meta name="description"' in html
    assert "<h1>자동차 폐차 비용 2026: 보상금·견적 비교·말소 절차</h1>" in html
    assert f'<link rel="canonical" href="{URL}">' in html
    assert '<meta name="robots" content="index,follow">' in html
    assert '"@type":"Article"' in html
    assert "https://www.car365.go.kr/ccpt/carlife/scrcar/ersrPrcsProcssView.do" in html
    assert "https://law.go.kr/lumLsLinkPop.do?lspttninfSeq=118180" in html
    assert "정보 확인일: 2026-09-24" in html
    assert "평가액과 폐차비용" in html
    assert "견적 비교 체크리스트" in html
    assert "관허폐차장" in html and "폐차인수증명서" in html and "말소등록" in html
    assert "무조건 무료" in html
    assert "경차 20~40만원" not in html
    assert "SUV 100~150만원" not in html
    assert "TOP 5" not in html and "최저가" not in html and "전화 상담" not in html
    assert "G-QP5Q67GE5B" in html
    assert "ca-pub-8830524482034754" in html


def test_car_scrap_guide_is_in_car_discoverability_and_sitemaps_once():
    hub = (ROOT / "kor/report/car/index.html").read_text(encoding="utf-8")
    sitemap = (ROOT / "kor/report/car/sitemap.xml").read_text(encoding="utf-8")
    root_sitemap = (ROOT / "kor/sitemap.xml").read_text(encoding="utf-8")
    assert "car-scrap-cost-guide.html" in hub
    assert sitemap.count(URL) == 1
    assert root_sitemap.count(URL) == 1
