import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_content_index as builder  # noqa: E402


def test_extract_metadata_and_no_date_invention():
    html = "<title>철원 캠핑</title><meta name='description' content='차박 장소'><h1>철원 캠핑</h1><time datetime='2026-09-01'>확인</time>"
    row = builder.extract_metadata(Path("kor/report/camp/cheorwon.html"), html)
    assert row["title"] == "철원 캠핑"
    assert row["description"] == "차박 장소"
    assert row["h1"] == "철원 캠핑"
    assert row["updated_at"] == "2026-09-01"
    assert builder.extract_metadata(Path("kor/a.html"), "<title>제목</title>")["updated_at"] is None


@pytest.mark.parametrize(("url", "text", "category"), [
    ("/kor/util/qrcode/index.html", "QR 코드 무료 도구", "무료 도구"),
    ("/kor/report/camp/a.html", "철원 캠핑 차박", "캠핑·차박"),
    ("/kor/game/example.html", "예시", "게임"),
    ("/kor/column/palworld-guide.html", "팰월드 공략", "게임"),
    ("/kor/report/travel/a.html", "서울 여행", "여행"),
    ("/kor/report/car/a.html", "자동차 검사", "자동차·생활"),
    ("/kor/report/finance/a.html", "연금 투자 세금", "금융·투자"),
    ("/kor/report/ai/a.html", "인공지능 IT", "AI·테크"),
    ("/kor/column/misc.html", "생활 팁", "생활정보"),
])
def test_fixed_category_rules(url, text, category):
    assert builder.classify_category(url, text, text, text) == category


@pytest.mark.parametrize(("url", "title", "description", "expected"), [
    ("/kor/column/asset-allocation-strategy-2026.html", "2026 자산배분 전략", "ETF와 주식, 채권을 활용한 포트폴리오 자산배분 전략", "금융·투자"),
    ("/kor/column/palworld-example.html", "예시", "", "게임"),
    ("/kor/report/camp/test.html", "예시", "", "캠핑·차박"),
    ("/kor/util/example/index.html", "예시", "", "무료 도구"),
])
def test_regression_category_signals(url, title, description, expected):
    assert builder.classify_category(url, title, description, title) == expected


def test_filters_locales_titles_deduplicates_and_applies_override(tmp_path):
    for path, body in {
        "kor/a.html": "<title>A</title>",
        "kor/a-copy.html": "<title>A</title>",
        "kor/no-title.html": "<h1>없음</h1>",
        "eng/en.html": "<title>EN</title>",
        "jpn/jp.html": "<title>JP</title>",
        "util/old.html": "<title>old</title>",
        "kor/column/palworld.html": "<title>기본</title>",
    }.items():
        target = tmp_path / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(body, encoding="utf-8")
    rows = builder.build_index(tmp_path, {"/kor/column/palworld.html": {"category": "게임", "tags": ["팰월드"], "aliases": ["팔월드"]}})
    urls = {row["url"] for row in rows}
    assert "/kor/no-title.html" not in urls and "/eng/en.html" not in urls and "/util/old.html" not in urls
    pal = next(row for row in rows if row["url"].endswith("palworld.html"))
    assert pal["category"] == "게임" and pal["tags"] == ["팰월드"] and pal["aliases"] == ["팔월드"]
    assert all(len(row["tags"]) <= 8 for row in rows)


def test_home_feed_is_small_and_deterministic(tmp_path):
    (tmp_path / "kor").mkdir()
    for n in range(12):
        (tmp_path / "kor" / f"{n}.html").write_text(f"<title>콘텐츠 {n}</title>", encoding="utf-8")
    rows = builder.build_index(tmp_path, {})
    feed = builder.build_home_feed(rows)
    assert len(json.dumps(feed, ensure_ascii=False)) < len(json.dumps(rows, ensure_ascii=False))
    assert json.dumps(builder.build_index(tmp_path, {}), ensure_ascii=False) == json.dumps(rows, ensure_ascii=False)
