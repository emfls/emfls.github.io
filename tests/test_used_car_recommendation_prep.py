from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/car/used-car-recommendation-guide.html"
URL = "https://emfls.github.io/kor/report/car/used-car-recommendation-guide.html"
BUYING_SITES_URL = "/kor/report/car/used-car-buying-sites-guide.html"


class PageContractParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = []
        self.h1 = []
        self.meta = {}
        self.canonicals = []
        self.links = []
        self.text = []
        self.tables = []
        self._capture = None
        self._table = None
        self._row = None
        self._cell = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "title":
            self._capture = "title"
        elif tag == "h1":
            self._capture = "h1"
        elif tag == "meta":
            name = attrs.get("name")
            if name:
                self.meta[name] = attrs.get("content", "")
        elif tag == "link" and attrs.get("rel") == "canonical":
            self.canonicals.append(attrs.get("href", ""))
        elif tag == "a":
            self.links.append(attrs.get("href", ""))
        elif tag == "table":
            self._table = {"id": attrs.get("id"), "rows": []}
        elif tag == "tr" and self._table is not None:
            self._row = []
        elif tag in {"th", "td"} and self._row is not None:
            self._cell = []

    def handle_endtag(self, tag):
        if tag in {"title", "h1"}:
            self._capture = None
        elif tag in {"th", "td"} and self._cell is not None:
            self._row.append("".join(self._cell).strip())
            self._cell = None
        elif tag == "tr" and self._row is not None:
            self._table["rows"].append(self._row)
            self._row = None
        elif tag == "table" and self._table is not None:
            self.tables.append(self._table)
            self._table = None

    def handle_data(self, data):
        if self._capture == "title":
            self.title.append(data)
        elif self._capture == "h1":
            self.h1.append(data)
        if data.strip():
            self.text.append(data.strip())
        if self._cell is not None:
            self._cell.append(data)


def load_page():
    assert PAGE.is_file(), "The used-car recommendation PREP page is missing"
    html = PAGE.read_text(encoding="utf-8")
    parser = PageContractParser()
    parser.feed(html)
    return html, parser


def test_prep_page_is_noindex_self_canonical_and_separate_by_intent():
    _, page = load_page()

    assert "".join(page.title) == "중고차 추천, 예산과 사용 목적에 맞는 차종 고르는 기준"
    assert "".join(page.h1) == "내게 맞는 중고차 고르는 기준: 예산·사용 목적·차급 비교"
    assert page.meta.get("robots") == "noindex,nofollow"
    assert page.canonicals == [URL]
    assert "PREP 검토용" in " ".join(page.text)
    assert BUYING_SITES_URL in page.links
    assert "차급" in " ".join(page.text)
    assert "용도별" in " ".join(page.text)


def test_page_gives_static_three_candidate_worksheet_with_decision_inputs():
    _, page = load_page()
    worksheet = next(table for table in page.tables if table["id"] == "candidate-worksheet")

    assert worksheet["rows"][0] == ["비교 항목", "후보 1", "후보 2", "후보 3"]
    labels = {row[0] for row in worksheet["rows"][1:]}
    assert {
        "예산 범위(직접 입력)",
        "주 사용 거리·환경",
        "필요 승차 인원",
        "주차 공간",
        "짐·적재 필요",
        "선호 차급",
        "필수 옵션",
        "피하고 싶은 조건",
    } <= labels


def test_page_uses_use_case_and_class_tradeoffs_without_rankings_or_financial_advice():
    html, page = load_page()
    text = " ".join(page.text)

    for term in ("첫차", "출퇴근", "도심", "장거리", "가족", "적재", "업무용", "경차", "준중형", "SUV", "MPV", "가솔린", "디젤", "하이브리드", "전기차", "배터리", "충전 환경", "보증"):
        assert term in text

    lowered = html.lower()
    for forbidden in ("top 10", "top10", "1위", "최저가", "고장 안 나는 차", "가장 안전한 차", "믿을 만한 차종", "대출 추천", "할부 추천", "취득세 계산기", "보험료 계산기", "월 납입금"):
        assert forbidden not in lowered
    assert "20만원" not in text
    assert "2026년 중고차 가격표" not in text


def test_official_automotive365_sources_and_non_conclusive_missing_lookup_notice_exist():
    _, page = load_page()

    assert "https://www.car365.go.kr/ccpt/schdcar/trde/prchsGuide.do?_menuId=M630401000&moblYn=Y" in page.links
    assert "https://www.car365.go.kr/ccpt/schdcar/trde/schdTrdeVhclView.do?_menuId=M630103000" in page.links
    assert "https://www.car365.go.kr/ccpt/schdcar/unityhstry/utztnView.do?_menuId=M630201000" in page.links
    text = " ".join(page.text)
    assert "매매용 차량 조회 결과는 참고 정보" in text
    assert "조회 결과가 없다는 이유만으로 허위매물이라고 단정하지 않습니다" in text
    assert "자료 확인일: 2026년 10월 4일" in text


def test_prep_url_has_no_publication_wiring_or_tracking_scripts():
    html, _ = load_page()
    relative_path = "/kor/report/car/used-car-recommendation-guide.html"

    for path in (
        "kor/report/car/index.html",
        "kor/report/car/sitemap.xml",
        "kor/sitemap.xml",
        "data/content-launch-manifest.json",
    ):
        assert relative_path not in (ROOT / path).read_text(encoding="utf-8")

    assert "googletagmanager.com/gtag/js" not in html
    assert "ca-pub-8830524482034754" not in html
    assert "IndexNow" not in html
