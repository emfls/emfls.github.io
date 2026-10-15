from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGES = ("hadong", "sejong", "buyeo", "boryeong", "seocheon")


class CampPageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = []
        self.h1 = []
        self.description = ""
        self.headings = []
        self.source_notes = []
        self.cards = []
        self._capture = None
        self._heading = None
        self._card = None
        self._source_note = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = set((attrs.get("class") or "").split())
        if tag == "meta" and attrs.get("name", "").lower() == "description":
            self.description = attrs.get("content", "")
        if tag == "title":
            self._capture = "title"
        elif tag == "h1":
            self._capture = "h1"
        if tag in {"h2", "h3"}:
            self._heading = []
        if tag == "article" and "camping-card" in classes:
            self._card = {"heading": "", "text": []}
        if "source-note" in classes:
            self._source_note = []

    def handle_endtag(self, tag):
        if tag in {"title", "h1"}:
            self._capture = None
        if tag in {"h2", "h3"} and self._heading is not None:
            text = " ".join("".join(self._heading).split())
            self.headings.append(text)
            if self._card is not None:
                self._card["heading"] = text
            self._heading = None
        if tag == "article" and self._card is not None:
            self._card["text"] = " ".join("".join(self._card["text"]).split())
            self.cards.append(self._card)
            self._card = None
        if tag == "p" and self._source_note is not None:
            self.source_notes.append(" ".join("".join(self._source_note).split()))
            self._source_note = None

    def handle_data(self, data):
        if self._capture == "title":
            self.title.append(data)
        elif self._capture == "h1":
            self.h1.append(data)
        if self._heading is not None:
            self._heading.append(data)
        if self._card is not None:
            self._card["text"].append(data)
        if self._source_note is not None:
            self._source_note.append(data)


def page(name):
    parser = CampPageParser()
    parser.feed((ROOT / f"kor/report/camp/{name}.html").read_text(encoding="utf-8"))
    parser.close()
    return parser


def test_factcheck_14_pages_use_current_date_and_question_titles():
    for name in PAGES:
        parsed = page(name)
        title = " ".join("".join(parsed.title).split())
        h1 = " ".join("".join(parsed.h1).split())
        assert "2026" in title and "?" in title
        assert "2026" in parsed.description and ("?" in parsed.description or "어디" in parsed.description)
        assert "2026" in h1
        assert parsed.source_notes, name
        assert all("확인일 2026-10-15" in note for note in parsed.source_notes), name


def test_closed_geumgang_campsite_is_not_reintroduced_in_sejong_page():
    html = (ROOT / "kor/report/camp/sejong.html").read_text(encoding="utf-8")
    assert "금강자연휴양림" not in html


def test_boryeong_beach_classification_keeps_only_ordinance_list_as_restricted():
    parsed = page("boryeong")
    for place in ("독산해수욕장", "용두해수욕장", "원산도해수욕장", "사창해수욕장"):
        matches = [heading for heading in parsed.headings if place in heading]
        assert matches and all(heading.startswith("③") for heading in matches), (place, matches)
    for place in ("대천해수욕장", "무창포해수욕장"):
        matches = [heading for heading in parsed.headings if place in heading]
        assert matches and all(heading.startswith("②") for heading in matches), (place, matches)
    for card in parsed.cards:
        if any(
            name in card["heading"]
            for name in ("독산해수욕장", "용두해수욕장", "원산도해수욕장", "사창해수욕장")
        ):
            assert "금지됩니다" not in card["text"]


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
