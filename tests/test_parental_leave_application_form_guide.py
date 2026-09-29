import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/parenting/parental-leave-application-form-2026.html"
PAGE_ROUTE = "kor/report/parenting/parental-leave-application-form-2026.html"
PAGE_URL = f"https://emfls.github.io/{PAGE_ROUTE}"
FORM_7_2_URL = "https://www.law.go.kr/법령별표서식/(남녀고용평등과%20일ㆍ가정%20양립%20지원에%20관한%20법률%20시행규칙,20260918,서식7의2)"
FORM_100_URL = "https://www.law.go.kr/법령별표서식/(고용보험법 시행규칙,20260820,서식100)"
GOVERNMENT_HOSTS = {
    "law.go.kr",
    "www.law.go.kr",
    "worklife.kr",
    "www.worklife.kr",
    "work24.go.kr",
    "www.work24.go.kr",
    "m.work24.go.kr",
    "ei.work24.go.kr",
}


class CandidatePageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_body = False
        self.in_title = False
        self.in_h1 = False
        self.in_jsonld = False
        self.ignore_visible_text = False
        self.hero_depth = 0
        self.sample_depth = 0
        self.title_parts = []
        self.h1_parts = []
        self.body_parts = []
        self.hero_parts = []
        self.sample_parts = []
        self.jsonld_parts = []
        self.jsonld_documents = []
        self.robots = []
        self.canonicals = []
        self.links = []
        self.h1_count = 0

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "body":
            self.in_body = True
        elif tag == "title":
            self.in_title = True
        elif tag == "h1":
            self.in_h1 = True
            self.h1_count += 1
        elif tag == "meta" and attributes.get("name", "").lower() == "robots":
            self.robots.append(attributes.get("content", ""))
        elif tag == "link" and "canonical" in attributes.get("rel", "").lower().split():
            self.canonicals.append(attributes.get("href", ""))
        elif tag == "a" and attributes.get("href"):
            self.links.append(attributes["href"])
        elif tag == "script":
            if attributes.get("type", "").lower() == "application/ld+json":
                self.in_jsonld = True
                self.jsonld_parts = []
            else:
                self.ignore_visible_text = True
        elif tag == "style":
            self.ignore_visible_text = True

        classes = attributes.get("class", "").split()
        if self.hero_depth == 0 and "hero" in classes:
            self.hero_depth = 1
        elif self.hero_depth:
            self.hero_depth += 1
        if tag == "div":
            if self.sample_depth == 0 and "sample-box" in classes:
                self.sample_depth = 1
            elif self.sample_depth:
                self.sample_depth += 1

    def handle_data(self, data):
        if self.in_jsonld:
            self.jsonld_parts.append(data)
            return
        if self.in_title:
            self.title_parts.append(data)
        if self.in_h1:
            self.h1_parts.append(data)
        if self.in_body and not self.ignore_visible_text:
            self.body_parts.append(data)
            if self.hero_depth:
                self.hero_parts.append(data)
            if self.sample_depth:
                self.sample_parts.append(data)

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        elif tag == "h1":
            self.in_h1 = False
        elif tag == "script":
            if self.in_jsonld:
                self.jsonld_documents.append("".join(self.jsonld_parts))
                self.in_jsonld = False
            else:
                self.ignore_visible_text = False
        elif tag == "style":
            self.ignore_visible_text = False
        else:
            if self.hero_depth:
                self.hero_depth -= 1
        if tag == "div":
            if self.sample_depth:
                self.sample_depth -= 1
        elif tag == "body":
            self.in_body = False


def parsed_page():
    assert PAGE.is_file(), f"unpublished candidate page is missing: {PAGE}"
    parser = CandidatePageParser()
    parser.feed(PAGE.read_text(encoding="utf-8"))
    parser.close()
    return parser


def visible_text(parser):
    return " ".join("".join(parser.body_parts).split())


def test_first_answer_separates_employer_request_and_benefit_application():
    parser = parsed_page()
    first_answer = " ".join("".join(parser.hero_parts).split())

    assert "사업주에게 신청" in first_answer
    assert "고용24" in first_answer and "별도로" in first_answer
    assert "별지 제7호의2" in first_answer
    assert "별지 제100" in first_answer
    assert "급여 신청서" in first_answer


def test_integrated_form_is_not_called_universal():
    parser = parsed_page()
    text = visible_text(parser)

    assert "별지 제7호의2" in text
    assert "함께 신청" in text
    assert "사업주가 별도의 서식을 정한 경우" in text
    assert "모든 단독 신청의 필수 서식은 아닙니다" in text
    assert "유일한 필수 서식" not in text
    assert "시행규칙 제14조의3" in text
    assert "시행령 제11조제5항" in text


def test_sample_is_prominently_non_official():
    parser = parsed_page()
    sample = " ".join("".join(parser.sample_parts).split())

    assert "작성 예시 / 법정 공식 서식 아님" in sample
    assert "정부가 발행한 서식이 아닙니다" in sample
    assert "회사 내부 서식을 먼저 확인" in sample
    assert "임신 중 해당 신청: 성명은 적지 않고 출산 예정일 기재" in sample


def test_current_article_11_fields_and_deadline_are_present():
    parser = parsed_page()
    text = visible_text(parser)

    for required in (
        "시행령 제11조",
        "휴직개시예정일 30일 전",
        "신청인의 성명·생년월일 등 인적사항",
        "대상 자녀의 성명·생년월일",
        "출산 예정일",
        "신청인이 임신 중인 여성 근로자이거나",
        "영유아의 성명을 적지 않고",
        "생년월일 대신 출산 예정일을 적습니다",
        "휴직개시예정일",
        "휴직종료예정일",
        "신청 연월일",
        "제19조제2항",
        "증명서류",
        "제19조제6항",
        "신청 사유",
        "제11조제2항의 경우에는 자녀 출생 후 18개월 이내",
        "출산전후휴가를 청구할 때 또는 배우자 출산전후휴가를 고지할 때",
        "제7호 제외",
        "출산전후휴가 또는 배우자 출산전후휴가의 개시·종료 예정일",
        "육아휴직 신청은 휴직개시예정일 30일 전까지 해야 합니다",
        "휴직개시예정일 7일 전",
        "휴직개시예정일까지",
        "2026-09-18",
        "2026-08-20",
        "최종 확인일: 2026-09-29",
    ):
        assert required in text, f"missing current Article 11 contract: {required}"

    assert "일반 신청 전체에 대한 포괄적 예외가 아닙니다" in text
    assert "방학 사유는 이 당일 신청 예외와 구분" in text
    assert "고용보험법 시행규칙 전체 시행일은 2026-09-18" in text
    assert "별지 제100호서식 1쪽, 같은 서식 2쪽 작성방법란 제5호부터 제14호까지, 3쪽 신청인 첨부서류란 육아휴직 급여 신청 시 제9호의 개정사항은 2026-08-20부터 시행" in text
    assert "별지 제100호서식 1쪽" in text
    assert "같은 서식 2쪽 작성방법란 제5호부터 제14호까지" in text
    assert "3쪽 신청인 첨부서류란 육아휴직 급여 신청 시 제9호" in text


def test_prep_page_has_no_publication_wiring():
    parser = parsed_page()
    text = visible_text(parser)

    assert parser.robots == ["noindex,follow"]
    assert parser.canonicals == [PAGE_URL]
    assert parser.h1_count == 1
    assert parser.title_parts
    title = " ".join("".join(parser.title_parts).split())
    assert "육아휴직 신청서" in title

    documents = json.loads(parser.jsonld_documents[0])
    graph = documents["@graph"]
    webpage = next(node for node in graph if node.get("@type") == "WebPage")
    article = next(node for node in graph if node.get("@type") == "Article")
    assert webpage["url"] == PAGE_URL
    assert webpage["name"] == title
    assert article["headline"] == title
    assert article["mainEntityOfPage"]["@id"] == webpage["@id"]

    external_hosts = {
        urlsplit(href).hostname
        for href in parser.links
        if urlsplit(href).scheme == "https"
        and urlsplit(href).hostname != "emfls.github.io"
    }
    assert external_hosts
    assert external_hosts <= GOVERNMENT_HOSTS
    assert external_hosts & {"law.go.kr", "www.law.go.kr"}
    assert "worklife.kr" in external_hosts
    assert external_hosts & {"work24.go.kr", "www.work24.go.kr", "m.work24.go.kr"}
    assert "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=288723" in parser.links
    assert FORM_7_2_URL in parser.links
    assert FORM_100_URL in parser.links

    discovery_files = set(ROOT.rglob("index.html"))
    discovery_files.update(ROOT.rglob("*sitemap*.xml"))
    discovery_files.update(
        {
            ROOT / "feed.xml",
            ROOT / "data/home-feed-ko.json",
            ROOT / "data/content-index-ko.json",
            ROOT / "data/content-launch-manifest.json",
        }
    )
    excluded_parts = {".git", ".superpowers"}
    for path in discovery_files:
        if excluded_parts.intersection(path.relative_to(ROOT).parts) or not path.is_file():
            continue
        source = path.read_text(encoding="utf-8")
        assert PAGE_ROUTE not in source, f"candidate is wired from {path.relative_to(ROOT)}"

    assert "gov.go.kr" not in text or "정부 공식 사이트가 아닙니다" in text
