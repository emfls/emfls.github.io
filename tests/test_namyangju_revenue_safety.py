from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/camp/namyangju.html"


def test_search_snippet_does_not_promise_unverified_free_camping():
    html = PAGE.read_text(encoding="utf-8")
    head = html.split("</head>", 1)[0]

    assert "2026" in re.search(r"<title>(.*?)</title>", head, re.S).group(1)
    for claim in ("완전무료", "무료 차박 성지", "무료 캠핑의 모든", "무료 취사 차박"):
        assert claim not in head


def test_location_cards_require_current_fee_and_permission_checks():
    html = PAGE.read_text(encoding="utf-8")

    for claim in ("완전무료", "취사가능", "완전 무료 + 취사 가능", "한강변 무료 캠핑"):
        assert claim not in html
    assert html.count("요금확인") >= 5
    assert html.count("허용확인") >= 3
