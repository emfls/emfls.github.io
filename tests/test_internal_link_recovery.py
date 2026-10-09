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
CELLTRION_SOURCE = "/kor/report/stock/2025/celltrion-068270.html"
SM_BROKEN_TARGET = "/kor/report/stock/2025/smsoft-041510.html"
SM_EXPECTED_TARGET = "/kor/report/stock/smsoft-041510.html"
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
SM_REMAINING_ELIGIBLE_SOURCE_PAGES = (
    "/kor/report/stock/2025/doosan-034020.html",
    "/kor/report/stock/2025/ecoprobm-247540.html",
    "/kor/report/stock/2025/kt-030200.html",
    "/kor/report/stock/2025/samsungbio-207940.html",
    "/kor/report/stock/2025/samsungelec-009150.html",
    "/kor/report/stock/2025/samsungsdi-006400.html",
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


class CanonicalParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.canonicals = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "link":
            return
        attributes = dict(attrs)
        if attributes.get("rel", "").lower() == "canonical":
            self.canonicals.append(attributes.get("href", ""))


class InternalLinkRecoveryTests(unittest.TestCase):
    def test_eligible_remaining_sm_related_stock_links_use_existing_canonical_route(self):
        broken = find_broken_internal_links(ROOT)
        stale_links = [
            item for item in broken
            if item["source"] in SM_REMAINING_ELIGIBLE_SOURCE_PAGES
            and item["target"] == SM_BROKEN_TARGET
        ]
        self.assertEqual([], stale_links, f"stale remaining SM links: {stale_links}")

        target_path = ROOT / SM_EXPECTED_TARGET.lstrip("/")
        self.assertTrue(target_path.is_file())
        target_canonical = CanonicalParser()
        target_canonical.feed(target_path.read_text(encoding="utf-8"))
        self.assertEqual([PUBLIC_ORIGIN + SM_EXPECTED_TARGET], target_canonical.canonicals)

        for source in SM_REMAINING_ELIGIBLE_SOURCE_PAGES:
            source_html = (ROOT / source.lstrip("/")).read_text(encoding="utf-8")
            source_canonical = CanonicalParser()
            source_canonical.feed(source_html)
            self.assertEqual([PUBLIC_ORIGIN + source], source_canonical.canonicals, source)

            anchors = AnchorParser()
            anchors.feed(source_html)
            matching = [
                href for href, text in anchors.anchors
                if "에스엠(041510)" in " ".join(text.split())
            ]
            self.assertEqual(1, len(matching), source)
            resolved_path = urlparse(urljoin(PUBLIC_ORIGIN + source, matching[0])).path
            self.assertEqual(SM_EXPECTED_TARGET, resolved_path, source)

    def test_celltrion_sm_related_stock_link_uses_existing_canonical_route(self):
        source_html = (ROOT / CELLTRION_SOURCE.lstrip("/")).read_text(encoding="utf-8")
        target_path = ROOT / SM_EXPECTED_TARGET.lstrip("/")
        self.assertTrue(target_path.is_file())
        self.assertFalse((ROOT / SM_BROKEN_TARGET.lstrip("/")).exists())

        source_canonical = CanonicalParser()
        source_canonical.feed(source_html)
        self.assertEqual(
            [PUBLIC_ORIGIN + CELLTRION_SOURCE],
            source_canonical.canonicals,
        )

        target_canonical = CanonicalParser()
        target_canonical.feed(target_path.read_text(encoding="utf-8"))
        self.assertEqual(
            [PUBLIC_ORIGIN + SM_EXPECTED_TARGET],
            target_canonical.canonicals,
        )

        anchors = AnchorParser()
        anchors.feed(source_html)
        matching = [
            href for href, text in anchors.anchors
            if "에스엠(041510)" in " ".join(text.split())
        ]
        self.assertEqual(1, len(matching))
        self.assertEqual("../smsoft-041510.html", matching[0])
        resolved_path = urlparse(urljoin(PUBLIC_ORIGIN + CELLTRION_SOURCE, matching[0])).path
        self.assertEqual(SM_EXPECTED_TARGET, resolved_path)

        broken = find_broken_internal_links(ROOT)
        stale_links = [
            item for item in broken
            if item["source"] == CELLTRION_SOURCE and item["target"] == SM_BROKEN_TARGET
        ]
        self.assertEqual([], stale_links, f"stale Celltrion to SM links: {stale_links}")

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
