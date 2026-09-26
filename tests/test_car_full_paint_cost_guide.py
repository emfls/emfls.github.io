import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/car/car-full-paint-cost-guide.html"
URL = "https://emfls.github.io/kor/report/car/car-full-paint-cost-guide.html"


def test_full_paint_guide_contract():
    html = PAGE.read_text(encoding="utf-8")
    assert '<title>차량 전체도색 비용 2026 | 견적이 달라지는 이유·비교 체크리스트</title>' in html
    assert '<h1>차량 전체도색 비용 2026: 견적 차이와 비교 체크리스트</h1>' in html
    assert f'<link rel="canonical" href="{URL}">' in html
    assert '<meta name="robots" content="index,follow">' in html
    assert '"@type":"Article"' in html
    for text in ("정보 확인일: 2026-09-26", "https://kidi.or.kr/user/nd97494.do", "https://www.kidi.or.kr/user/nd74052.do", "https://www.law.go.kr/법령/자동차관리법/제58조", "견적 비교 체크리스트", "판금", "탈부착", "VAT", "정비견적서", "정비명세서", "G-QP5Q67GE5B", "ca-pub-8830524482034754"):
        assert text in html
    assert not re.search(r"(?:경차|세단|SUV|수입차)\s*\d+[~〜-]\d+\s*만원", html)
    assert not re.search(r"평균\s*\d+만원", html)
    assert not any(text in html for text in ("최저가", "TOP 5", "전화 상담", "제휴", "추천 업체"))


def test_full_paint_discovery_and_sitemaps():
    hub = (ROOT / "kor/report/car/index.html").read_text(encoding="utf-8")
    car_sitemap = (ROOT / "kor/report/car/sitemap.xml").read_text(encoding="utf-8")
    root_sitemap = (ROOT / "kor/sitemap.xml").read_text(encoding="utf-8")
    assert 'href="/kor/report/car/car-full-paint-cost-guide.html"' in hub
    assert car_sitemap.count(URL) == 1
    assert root_sitemap.count(URL) == 1
    assert hub.count('class="card"') == 17
    assert "총 17개 콘텐츠" in hub


def test_full_paint_launch_manifest():
    manifest = json.loads((ROOT / "data/content-launch-manifest.json").read_text(encoding="utf-8"))
    assert manifest["candidateIds"] == ["keyword:차량전체도색비용"]
    assert manifest["contentPaths"] == ["kor/report/car/car-full-paint-cost-guide.html"]
    assert manifest["hubPaths"] == ["kor/report/car/index.html"]
    assert manifest["sitemapPaths"] == ["kor/sitemap.xml"]
    assert manifest["urls"] == ["/kor/report/car/car-full-paint-cost-guide.html"]
    assert manifest["publishedToday"] == 1
    assert manifest["dailyLimit"] == 1
    assert manifest["remainingCapacity"] == 0
    assert manifest["status"] == "PUBLISHED"
