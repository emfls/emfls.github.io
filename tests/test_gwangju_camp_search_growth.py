from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_gwangju_and_gyeonggi_hub_are_bidirectionally_linked():
    page = (ROOT / "kor/report/camp/gwangju-g.html").read_text(encoding="utf-8")
    hub = (ROOT / "kor/report/camp/gyeonggi-best.html").read_text(encoding="utf-8")

    assert 'href="/kor/report/camp/gyeonggi-best.html"' in page
    assert 'href="https://emfls.github.io/kor/report/camp/gwangju-g.html"' in hub


def test_gwangju_related_links_stay_geographically_relevant():
    page = (ROOT / "kor/report/camp/gwangju-g.html").read_text(encoding="utf-8")

    for href in ("seongnam.html", "yongin.html", "icheon.html", "yangpyeong.html"):
        assert f'href="{href}"' in page
