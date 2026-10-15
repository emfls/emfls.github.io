from pathlib import Path

from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parents[1]
PAGES = ("hadong", "sejong", "buyeo", "boryeong", "seocheon")


def soup(name):
    return BeautifulSoup(
        (ROOT / f"kor/report/camp/{name}.html").read_text(encoding="utf-8"),
        "html.parser",
    )


def test_factcheck_14_pages_use_current_date_and_question_titles():
    for name in PAGES:
        page = soup(name)
        title = page.title.get_text(" ", strip=True)
        description = page.find("meta", attrs={"name": "description"})["content"]
        assert "2026" in title and "?" in title
        assert "2026" in description and ("?" in description or "어디" in description)
        assert page.h1 and "2026" in page.h1.get_text(" ", strip=True)
        source_notes = page.select(".source-note")
        assert source_notes, name
        assert all(
            "확인일 2026-10-15" in note.get_text(" ", strip=True)
            for note in source_notes
        ), name


def test_closed_geumgang_campsite_is_not_reintroduced_in_sejong_page():
    html = (ROOT / "kor/report/camp/sejong.html").read_text(encoding="utf-8")
    assert "금강자연휴양림" not in html


def test_boryeong_beach_classification_keeps_only_ordinance_list_as_restricted():
    page = soup("boryeong")
    headings = [h.get_text(" ", strip=True) for h in page.select("h2, h3")]
    for place in ("독산해수욕장", "용두해수욕장", "원산도해수욕장", "사창해수욕장"):
        matches = [h for h in headings if place in h]
        assert matches and all(h.startswith("③") for h in matches), (place, matches)
    for place in ("대천해수욕장", "무창포해수욕장"):
        matches = [h for h in headings if place in h]
        assert matches and all(h.startswith("②") for h in matches), (place, matches)
    for row in page.select(".camping-card"):
        heading = row.find(["h2", "h3"])
        if heading and any(
            name in heading.get_text()
            for name in ("독산해수욕장", "용두해수욕장", "원산도해수욕장", "사창해수욕장")
        ):
            assert "금지됩니다" not in row.get_text(" ", strip=True)


def test_hadong_includes_full_knps_winter_status_reference_separate_from_local_candidates():
    html = (ROOT / "kor/report/camp/hadong.html").read_text(encoding="utf-8")
    for phrase in (
        "국립공원 야영장 동절기 운영 참고",
        "지리산전북",
        "달구1·2",
        "학암포",
        "몽산포",
        "연중 운영",
        "동절기 일부 미운영",
        "동절기 전체 미운영",
        "2026-12-01",
        "2027-03-31",
        "seq=29193",
    ):
        assert phrase in html, phrase
