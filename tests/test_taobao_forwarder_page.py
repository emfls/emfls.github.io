from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/compare/taobao-forwarder-guide.html"


def test_taobao_forwarder_page_has_safe_content_contract():
    html = PAGE.read_text(encoding="utf-8")
    soup = BeautifulSoup(html, "html.parser")
    assert soup.title.string == "타오바오 배대지 추천 2026 | 배송비·검수·합배송 비교 기준"
    assert soup.find("h1")
    assert soup.find("link", rel="canonical")["href"] == "https://emfls.github.io/kor/report/compare/taobao-forwarder-guide.html"
    assert soup.find("time") is None
    assert "정보 확인일: 2026-09-23" in html
    assert "가격·정책은 변경될 수" in html
    assert "1위로 선정" not in html and "가장 저렴" not in html and "무조건 추천" not in html
    assert "https://www.thebay.co.kr/" in html
    assert "https://www.tabae.co.kr/" in html
    assert "https://joypost.co.kr/" in html
    assert "https://www.tosstoss.co.kr/user/delivery_price.php" in html


def test_taobao_forwarder_page_is_in_korean_sitemap_only_once():
    sitemap = (ROOT / "kor/sitemap.xml").read_text(encoding="utf-8")
    url = "https://emfls.github.io/kor/report/compare/taobao-forwarder-guide.html"
    assert sitemap.count(url) == 1
