import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse

from scripts.content_health_reports import find_broken_internal_links


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ORIGIN = "https://emfls.github.io"
BROKEN_TARGET = "/kor/report/stock/2025/hyundaienc-000720.html"
EXPECTED_TARGET = "/kor/report/stock/hyundaienc-000720.html"
AMOREPACIFIC_BROKEN_TARGET = "/kor/report/stock/2025/amorepacific-090430.html"
AMOREPACIFIC_EXPECTED_TARGET = "/kor/report/stock/amorepacific-090430.html"
SOURCE_PAGES = (
    "/kor/report/stock/2025/ecoprobm-247540.html",
    "/kor/report/stock/2025/hana-086790.html",
    "/kor/report/stock/2025/kakao-035720.html",
    "/kor/report/stock/2025/poscofuturem-003670.html",
    "/kor/report/stock/2025/samsunglife-032830.html",
    "/kor/report/stock/2025/shinhan-055550.html",
    "/kor/report/stock/2025/skhynix-000660.html",
    "/kor/report/stock/2025/skt-017670.html",
)
AMOREPACIFIC_SOURCE_PAGES = (
    "/kor/report/stock/2025/celltrion-068270.html",
    "/kor/report/stock/2025/doosan-034020.html",
    "/kor/report/stock/2025/hyundai-005380.html",
    "/kor/report/stock/2025/hyundaimobis-012330.html",
    "/kor/report/stock/2025/lgup-032640.html",
    "/kor/report/stock/2025/posco-005490.html",
    "/kor/report/stock/2025/samsung-005930.html",
)


class AnchorParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.anchors = []
        self.current = None

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "a":
            self.current = [dict(attrs).get("href", ""), []]

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self.current is not None:
            self.anchors.append((self.current[0], "".join(self.current[1])))
            self.current = None

    def handle_data(self, data):
        if self.current is not None:
            self.current[1].append(data)


class InternalLinkRecoveryTests(unittest.TestCase):
    def test_hyundai_e_and_c_related_stock_links_use_existing_canonical_route(self):
        broken = find_broken_internal_links(ROOT)
        stale_links = [
            item for item in broken
            if item["source"] in SOURCE_PAGES and item["target"] == BROKEN_TARGET
        ]
        self.assertEqual([], stale_links)

        for source in SOURCE_PAGES:
            parser = AnchorParser()
            parser.feed((ROOT / source.lstrip("/")).read_text(encoding="utf-8"))
            matching = [
                href for href, text in parser.anchors
                if "현대건설(000720)" in " ".join(text.split())
            ]
            self.assertEqual(1, len(matching), source)
            resolved_path = urlparse(urljoin(PUBLIC_ORIGIN + source, matching[0])).path
            self.assertEqual(EXPECTED_TARGET, resolved_path, source)

    def test_amorepacific_stock_links_resolve_to_existing_canonical_route(self):
        broken = find_broken_internal_links(ROOT)
        stale_links = [
            item for item in broken
            if item["source"] in AMOREPACIFIC_SOURCE_PAGES
            and item["target"] == AMOREPACIFIC_BROKEN_TARGET
        ]
        self.assertEqual([], stale_links, f"stale Amorepacific links: {stale_links}")
        self.assertTrue((ROOT / AMOREPACIFIC_EXPECTED_TARGET.lstrip("/")).is_file())

        for source in AMOREPACIFIC_SOURCE_PAGES:
            parser = AnchorParser()
            parser.feed((ROOT / source.lstrip("/")).read_text(encoding="utf-8"))
            matching = [
                href for href, text in parser.anchors
                if "아모레퍼시픽(090430)" in " ".join(text.split())
            ]
            self.assertEqual(1, len(matching), source)
            resolved_path = urlparse(urljoin(PUBLIC_ORIGIN + source, matching[0])).path
            self.assertEqual(AMOREPACIFIC_EXPECTED_TARGET, resolved_path, source)


if __name__ == "__main__":
    unittest.main()
