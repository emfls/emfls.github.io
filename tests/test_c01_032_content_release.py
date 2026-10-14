import json
import re
import subprocess
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT_PATH = "kor/report/window/iphone-photos-date-taken.html"
ROUTE = "/kor/report/window/iphone-photos-date-taken.html"
CANONICAL = "https://emfls.github.io" + ROUTE
TITLE = "아이폰 사진 촬영일, 윈도우에서 확인하는 방법"
INTENT = "윈도우에서 아이폰 사진의 촬영일을 확인하고 전송 문제를 진단"
CANDIDATE_ID = "C01-20261011-032-IPHONEDATE"

PREVIOUS_PUBLISHED_MANIFEST = {
    "candidateIds": ["keyword:키보드청소방법"],
    "contentPaths": ["kor/report/it/keyboard-cleaning-guide.html"],
    "dailyLimit": 1,
    "hubPaths": ["kor/report/it/index.html"],
    "publishedToday": 1,
    "remainingCapacity": 0,
    "runAt": "2026-10-05T06:48:56+09:00",
    "runId": "P0-20261005-KEYBOARD-CLEANING",
    "schemaVersion": 1,
    "sitemapPaths": ["kor/report/it/sitemap.xml"],
    "status": "PUBLISHED",
    "urls": ["/kor/report/it/keyboard-cleaning-guide.html"],
}


def read_committed_json(relative_path):
    result = subprocess.run(
        ["git", "show", f"HEAD:{relative_path}"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def c01_032_manifest():
    """Validate this immutable release record even after a newer launch."""
    current = read_committed_json("data/content-launch-manifest.json")
    records = [current, *current.get("preservedManifestRecords", [])]
    matches = [r for r in records if r.get("candidateIds") == [CANDIDATE_ID]]
    if len(matches) != 1:
        raise AssertionError("exactly one preserved C01-032 release record is required")
    return matches[0]


class C01032ContentReleaseTests(unittest.TestCase):
    def test_manifest_binds_one_exact_review_only_approval(self):
        manifest = c01_032_manifest()
        approval = read_committed_json("data/content-launch-experiment-approvals.json")["approvals"][0]
        self.assertEqual(approval["candidateId"], CANDIDATE_ID)
        self.assertEqual(approval["title"], TITLE)
        self.assertEqual(approval["primaryIntent"], INTENT)
        self.assertEqual(approval["approvalStatus"], "CT_SCOPED_EXPERIMENT_REVIEW_ONLY")
        self.assertEqual(approval["demandStatus"], "VOLUME_UNKNOWN")
        self.assertFalse(approval["ymyl"])
        self.assertEqual(approval["validThrough"], "2026-10-18")
        self.assertEqual(manifest["taskId"], "C01-20261011-032")
        self.assertEqual(manifest["candidateIds"], [CANDIDATE_ID])
        self.assertEqual(manifest["candidateTitles"], [TITLE])
        self.assertEqual(manifest["candidateIntents"], [INTENT])
        self.assertEqual(manifest["urls"], [ROUTE])
        self.assertEqual(manifest["contentPaths"], [CONTENT_PATH])
        self.assertEqual(manifest["hubPaths"], ["kor/report/window/index.html"])
        self.assertEqual(manifest["sitemapPaths"], ["kor/report/window/sitemap.xml"])
        self.assertEqual(manifest["experimentScope"], "ONE_PAGE")
        self.assertEqual(manifest["demandStatus"], "VOLUME_UNKNOWN")
        self.assertEqual(manifest["status"], "READY_FOR_REVIEW")
        self.assertEqual(manifest["dailyLimit"], 1)
        policy = (ROOT / "scripts/content_launch_policy.py").read_text(encoding="utf-8")
        self.assertRegex(policy, r"(?m)^DAILY_PUBLICATION_LIMIT\s*=\s*3\s*$")

    def test_prior_published_manifest_is_preserved_as_the_exact_object(self):
        manifest = c01_032_manifest()
        self.assertEqual(manifest["preservedManifestRecords"], [PREVIOUS_PUBLISHED_MANIFEST])
        self.assertEqual(PREVIOUS_PUBLISHED_MANIFEST["status"], "PUBLISHED")
        self.assertNotIn(PREVIOUS_PUBLISHED_MANIFEST["urls"][0], manifest["urls"])

    def test_article_identity_matches_the_trusted_candidate(self):
        article_path = ROOT / CONTENT_PATH
        self.assertTrue(article_path.is_file(), "approved article file is missing")
        article = article_path.read_text(encoding="utf-8")
        self.assertEqual(re.findall(r"<title>(.*?)</title>", article, re.S), [TITLE])
        self.assertEqual(re.findall(r"<h1[^>]*>(.*?)</h1>", article, re.S), [TITLE])
        self.assertEqual(
            re.findall(r'<link\s+rel="canonical"\s+href="([^"]+)"', article),
            [CANONICAL],
        )

    def test_hub_and_leaf_sitemap_reference_the_new_page_once(self):
        hub = (ROOT / "kor/report/window/index.html").read_text(encoding="utf-8")
        self.assertEqual(
            len(re.findall(r'href="/kor/report/window/iphone-photos-date-taken\.html"', hub)),
            1,
        )
        self.assertIn(f"총 128개 콘텐츠", hub)
        self.assertIn(TITLE, hub)

        namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        leaf = ET.parse(ROOT / "kor/report/window/sitemap.xml").getroot()
        leaf_urls = [node.text for node in leaf.findall("s:url/s:loc", namespace)]
        self.assertEqual(leaf_urls.count(CANONICAL), 1)

        root = ET.parse(ROOT / "sitemap.xml").getroot()
        child_sitemaps = [node.text for node in root.findall("s:sitemap/s:loc", namespace)]
        self.assertEqual(child_sitemaps.count("https://emfls.github.io/kor/report/window/sitemap.xml"), 1)


if __name__ == "__main__":
    unittest.main()
