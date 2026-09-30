import json
import re
import subprocess
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ROUTE = "kor/report/parenting/parental-leave-application-form-2026.html"
URL = f"https://emfls.github.io/{ROUTE}"
FORM_7_2 = "https://www.law.go.kr/법령별표서식/(남녀고용평등과%20일ㆍ가정%20양립%20지원에%20관한%20법률%20시행규칙,20260918,서식7의2)"
FORM_7_2_PDF = "https://www.law.go.kr/LSW/flDownload.do?flSeq=168822173&bylClsCd=110202"
FORM_100 = "https://www.law.go.kr/LSW/lsBylInfoP.do?bylSeq=18479369&lsiSeq=288723&efYd=20260918&directYn=Y"
FORM_100_PDF = "https://www.law.go.kr/LSW/flDownload.do?flSeq=169482859&bylClsCd=110202"
WORK24_PROCESS = "https://www.work24.go.kr/cm/c/f/1100/selecSystInfo.do?currentPageNo=1&recordCountPerPage=10&systClId=SC00000251&systCnntId=CI00001655&systId=SI00000402"
WORK24_CENTRE_POST = "https://ei.work24.go.kr/ei/eim/eg/ei/eiEminsr/retrievePb0302Info.do"


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = False
        self.h1 = False
        self.jsonld = False
        self.ignore_visible = False
        self.title_text = []
        self.h1_text = []
        self.jsonld_text = []
        self.body_text = []
        self.robots = []
        self.canonicals = []
        self.links = []
        self.h1_count = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "title":
            self.title = True
        elif tag == "h1":
            self.h1 = True
            self.h1_count += 1
        elif tag == "meta" and attrs.get("name", "").lower() == "robots":
            self.robots.append(attrs.get("content", ""))
        elif tag == "link" and "canonical" in attrs.get("rel", "").lower().split():
            self.canonicals.append(attrs.get("href", ""))
        elif tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])
        elif tag == "script" and attrs.get("type", "").lower() == "application/ld+json":
            self.jsonld = True
        elif tag in {"script", "style"}:
            self.ignore_visible = True

    def handle_data(self, data):
        if not self.ignore_visible and not self.jsonld:
            self.body_text.append(data)
        if self.title:
            self.title_text.append(data)
        if self.h1:
            self.h1_text.append(data)
        if self.jsonld:
            self.jsonld_text.append(data)

    def handle_endtag(self, tag):
        if tag == "title":
            self.title = False
        elif tag == "h1":
            self.h1 = False
        elif tag == "script":
            self.jsonld = False
            self.ignore_visible = False
        elif tag == "style":
            self.ignore_visible = False


def page_parser():
    path = ROOT / ROUTE
    assert path.is_file(), f"published guide missing: {ROUTE}"
    parser = PageParser()
    parser.feed(path.read_text(encoding="utf-8"))
    parser.close()
    return parser


def committed_launch_manifest():
    result = subprocess.run(
        ["git", "show", "HEAD:data/content-launch-manifest.json"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def visible_text(parser):
    return " ".join("".join(parser.body_text).split())


def test_published_page_has_current_law_contract_and_clear_first_answer():
    parser = page_parser()
    text = visible_text(parser)
    first_answer = " ".join("".join(parser.h1_text).split()) + " " + text[:900]

    assert parser.robots == ["index,follow"]
    assert parser.canonicals == [URL]
    assert parser.h1_count == 1
    assert "사업주에게 신청" in first_answer
    assert "고용24" in first_answer and "별도로" in first_answer
    assert "별지 제7호의2" in first_answer
    assert "별지 제100" in first_answer
    assert "PREP ONLY" not in text and "NOT PUBLISHED" not in text
    assert "시행규칙 제14조의3" in text
    assert "2026-09-18" in text and "최종 공식 출처 확인일: 2026-09-30" in text


def test_form_and_application_scope_are_not_overstated():
    text = visible_text(page_parser())
    assert "출산전후휴가를 청구하거나" in text
    assert "배우자 출산전후휴가를 고지할 때" in text
    assert "함께 신청" in text
    assert "사업주가 이 통합 신청에 별도 서식을 정한 경우" in text
    assert "이 서식 대체 규정은 통합 신청에 관한 것입니다" in text
    assert "일반적인 단독 신청은 시행령 제11조의 기한·기재사항" in text
    assert "단독 신청에도 회사의 접수 양식이 있을 수 있으므로 회사에 확인합니다" in text
    assert "유일한 필수 서식" not in text


def test_male_pregnancy_care_leave_requires_qualifying_diagnosed_risk_condition():
    text = visible_text(page_parser())
    assert "임신 중인 배우자를 돌보기 위한 남성 근로자의 육아휴직은 임신 사실만으로 인정되는 것이 아닙니다" in text
    assert "법 제19조제1항" in text
    assert "시행규칙 제14조의2" in text
    assert "별표 3에서 정한 위험 질환을 진단받은" in text
    assert "의료기관의 진단서" in text
    assert "제14조의2는 이 자격 요건에 관한 조문" in text
    assert "통합 신청서 근거는 제14조의3" in text


def test_employer_notice_is_written_or_electronic_and_deemed_approval_is_as_requested():
    text = visible_text(page_parser())
    assert "서면 또는 전자적 방식으로 알려야 합니다" in text
    assert "신청한 대로 육아휴직을 허용한 것으로 봅니다" in text
    assert "기한이 지난 신청에서" in text
    assert "그 사실을 서면 또는 전자적 방식으로 알려야 합니다" in text


def test_deadlines_distinguish_30_day_7_day_and_same_day_rules():
    text = visible_text(page_parser())
    for required in (
        "휴직개시예정일 30일 전",
        "휴직개시예정일 7일 전",
        "임신 중인 여성 근로자",
        "출산 예정일 전에 자녀가 출생",
        "배우자의 사망·부상·질병",
        "시행령 제11조제4항",
        "시행령 제11조제7항",
        "시행규칙 제15조제2항",
        "휴직개시예정일까지",
        "방학 사유는 이 당일 신청 예외와 구분",
        "신청일부터 30일 이내에",
        "신청일부터 7일 이내에",
        "사업주가 휴직개시일을 지정해 허용",
        "신청일부터 14일 이내",
        "신청일부터 3일 이내",
        "지체 없이",
    ):
        assert required in text, f"missing current application rule: {required}"


def test_official_sources_point_to_current_rules_and_forms():
    parser = page_parser()
    assert FORM_7_2 in parser.links
    assert FORM_7_2_PDF in parser.links
    assert FORM_100 in parser.links
    assert any("lspttninfSeq=71235" in href for href in parser.links)
    assert any("lspttninfSeq=201379" in href for href in parser.links)
    assert any("lsiSeq=288939" in href for href in parser.links)
    assert any("lsiSeq=288723" in href for href in parser.links)
    assert WORK24_PROCESS in parser.links
    assert WORK24_CENTRE_POST in parser.links
    assert any("lsJoLnkSeq=1031081237" in href for href in parser.links)
    assert FORM_100 in parser.links
    assert FORM_100_PDF in parser.links
    assert all("20260820,서식100" not in href for href in parser.links)
    assert all("flSeq=168498995" not in href for href in parser.links)


def test_employer_requested_evidence_is_distinct_from_benefit_claim_attachments():
    text = visible_text(page_parser())
    assert "제11조제8항은 사업주가" in text
    assert "육아휴직 확인서" in text
    assert "통상임금 확인 자료" in text
    assert "육아휴직 확인서는 최초 급여 청구 때 한 번 제출합니다" in text
    assert "통상임금 확인 자료는 급여 청구 첨부자료로 제출해야 하며" in text
    assert "사업주가 휴직 기간 중 금품을 지급한 경우에는 그 지급 자료도 첨부해야 합니다" in text
    assert "임신 중 사용한 육아휴직에 대한 급여를 청구하는 여성 근로자는 해당 육아휴직 신청 당시 임신 중이었음을 증명하는 서류를 제출해야 합니다." in text
    assert "남성 근로자의 위험 임신 배우자 돌봄 신청에는 별표 3 질환 진단서" in text
    assert "시행규칙 제15조제1항 사유 증명자료" in text
    assert "행정정보 공동이용" in text
    assert "확인에 동의하지 않으면 신청인이 해당 서류를 첨부" in text


def test_benefit_application_routes_and_jurisdiction_are_distinguished():
    text = visible_text(page_parser())
    assert "고용24 온라인 신청은 회사가 육아휴직 확인서를 먼저 제출" in text
    assert "방문·우편" in text
    assert "별도 고용보험 접수 안내 페이지에는 고용센터 방문·우편 경로" in text
    assert "우편 주소와 제출 자료는 관할 고용센터에 확인" in text
    assert "해당 페이지에 함께 표시된 급여액·수급요건은 과거 내용" in text
    assert "우편 접수 절차만 참고합니다" in text
    assert "거주지 또는 사업장 소재지 관할" in text
    assert "개인별 수급 자격·급여액을 판정하거나 보장하지 않습니다" in text


def test_short_leave_scope_and_vacation_schedule_change_limits_are_explicit():
    text = visible_text(page_parser())
    assert "연 1회에 한정" in text
    assert "1주 또는 2주" in text
    assert "전체 육아휴직 기간에 포함" in text
    assert "방학기간" in text and "사업 운영에 막대한 지장" in text
    assert "육아휴직 신청이 집중될 수 있는 방학기간에 한정하여" in text
    assert "근로자와 협의" in text
    assert "시기변경 사유와 변경한 육아휴직 기간 등을 근로자에게 서면으로 알려야 합니다" in text


def test_page_metadata_and_shared_measurement_tags_are_present():
    parser = page_parser()
    assert parser.title_text
    title = " ".join("".join(parser.title_text).split())
    assert "육아휴직 신청서" in title
    assert "G-QP5Q67GE5B" in (ROOT / ROUTE).read_text(encoding="utf-8")
    assert "ca-pub-8830524482034754" in (ROOT / ROUTE).read_text(encoding="utf-8")
    graph = json.loads("".join(parser.jsonld_text))["@graph"]
    assert any(node.get("@type") == "Article" for node in graph)
    assert any(node.get("@type") == "WebPage" and node.get("url") == URL for node in graph)


def test_publication_manifest_hub_and_sitemaps_register_the_page_once():
    manifest = committed_launch_manifest()
    assert manifest["status"] == "PUBLISHED"
    assert manifest["candidateIds"] == ["keyword:육아휴직신청서양식"]
    assert manifest["contentPaths"] == [ROUTE]
    assert manifest["urls"] == [f"/{ROUTE}"]
    assert manifest["hubPaths"] == ["kor/report/parenting/index.html"]
    assert manifest["sitemapPaths"] == ["kor/report/parenting/sitemap.xml", "kor/sitemap.xml"]
    assert manifest["runAt"].startswith("2026-10-01T")
    assert manifest["runId"] == "P0-20261001-PARENTAL-LEAVE-APPLICATION"
    assert manifest["dailyLimit"] == 1
    assert manifest["publishedToday"] == 1 and manifest["remainingCapacity"] == 0

    hub = (ROOT / "kor/report/parenting/index.html").read_text(encoding="utf-8")
    assert f'href="/{ROUTE}"' in hub
    assert "총 5개 콘텐츠" in hub
    for sitemap_path in manifest["sitemapPaths"]:
        sitemap_root = ET.parse(ROOT / sitemap_path).getroot()
        locs = [node.text for node in sitemap_root.findall("{*}url/{*}loc")]
        assert locs.count(URL) == 1, f"expected exactly one entry in {sitemap_path}"
    sitemap_index = ET.parse(ROOT / "sitemap.xml").getroot()
    indexes = [node.text for node in sitemap_index.findall("{*}sitemap/{*}loc")]
    assert indexes.count("https://emfls.github.io/kor/report/parenting/sitemap.xml") == 1

    content_index = json.loads((ROOT / "data/content-index-ko.json").read_text(encoding="utf-8"))
    row = next(item for item in content_index if item["url"] == f"/{ROUTE}")
    assert row["title"] == "육아휴직 신청서 작성 가이드 2026 | 사업주 신청·급여 신청 구분"
    home_latest = json.loads((ROOT / "data/home-feed-ko.json").read_text(encoding="utf-8"))["latest"]
    assert home_latest[0]["url"] == f"/{ROUTE}"
