import unittest
from pathlib import Path

from scripts.external_content_opportunity import launch_readiness, normalize_external_candidate
from scripts.content_launch_guard import (
    C01_032_ALLOWED_GUARD_CODE_PATHS,
    TRUSTED_LAUNCH_CODE_PATHS,
    _authorized_c01_032_guard_code_change,
    _trusted_candidate_records,
)

TASK_ID = "C01-20261011-032"
CANDIDATE_ID = "C01-20261011-032-IPHONEDATE"
URL = "/kor/report/window/iphone-photos-date-taken.html"
PATH = "kor/report/window/iphone-photos-date-taken.html"


def approved_candidate():
    return {
        "candidateId": CANDIDATE_ID,
        "url": URL,
        "contentPath": PATH,
        "idea": "윈도우에서 아이폰 사진의 촬영일과 파일 생성일 구별",
        "experiment": {
            "taskId": TASK_ID,
            "approval": "USER_APPROVED",
            "scope": "ONE_PAGE",
        },
        "discovery": {
            "origin": "CONTROL_TOWER_APPROVED_EXPERIMENT",
            "source": "USER_APPROVAL",
            "method": "ONE_PAGE_CANARY",
            "demandStatus": "VOLUME_UNKNOWN",
            "evidenceRefs": [],
        },
        "overlap": {"level": "LOW_OVERLAP", "closestUrl": None},
        "contentGap": "Windows 파일 생성일과 사진 촬영일을 구분하는 공식 안내가 부족하다.",
        "additionalValue": ["DATE_TAKEN_CHECKLIST", "USB_AND_ICLOUD_BRANCHES"],
        "officialSources": [
            {"url": "https://support.apple.com/ko-kr/120267", "reviewedAt": "2026-10-11"},
            {"url": "https://support.microsoft.com/en-us/windows/apps/photos/import-photos-and-videos-from-phone-to-pc", "reviewedAt": "2026-10-11"},
            {"url": "https://learn.microsoft.com/en-us/windows/win32/properties/props-system-photo-datetaken", "reviewedAt": "2026-10-11"},
        ],
        "qualityInputs": {
            "accuracy": 1, "sourceCoverage": 1, "officialSources": 1,
            "originalStructure": 1, "structuredValue": 1, "notThin": 1,
            "intentCompletion": 1, "maintainability": 1,
        },
        "brief": {
            "primaryIntent": "윈도우에서 아이폰 사진의 촬영일을 확인하고 전송 문제를 진단",
            "secondaryIntents": ["USB 전송", "iCloud 사진", "HEIC 호환성"],
            "keyFacts": ["Date taken과 Date created는 다른 값이다."],
            "potentialTable": "Windows 속성의 촬영일·생성일·수정일 비교",
            "potentialTool": "없음",
            "faqCandidates": ["사진 촬영일이 비어 있으면 어떻게 하나요?"],
            "closestExistingPage": None,
            "internalLinkPlan": ["/kor/report/window/index.html"],
            "whySeparatePage": "파일 형식 변환이 아니라 촬영일과 파일 시스템 날짜의 구분에 집중한다.",
        },
    }


class ControlledExperimentTests(unittest.TestCase):
    def test_user_approved_unknown_volume_experiment_is_explicit_and_not_scored_as_demand(self):
        row = approved_candidate()
        normalized = normalize_external_candidate(row, "2026-10-11")
        result = launch_readiness(row)
        self.assertEqual(normalized["discovery"]["demandStatus"], "VOLUME_UNKNOWN")
        self.assertNotIn("monthlySearchVolume", normalized["discovery"])
        self.assertEqual(result["status"], "READY_TO_LAUNCH")
        self.assertEqual(result["decision"], "CONTROLLED_EXPERIMENT")
        self.assertEqual(result["demandStatus"], "VOLUME_UNKNOWN")
        self.assertIsNone(result["opportunityScore"])
        self.assertGreaterEqual(result["qualityScore"], 75)

    def test_other_unknown_volume_candidates_remain_blocked(self):
        row = approved_candidate()
        row["candidateId"] = "EXT-OTHER-UNKNOWN"
        row["experiment"]["taskId"] = "C01-OTHER"
        row["discovery"]["origin"] = "EXTERNAL_WEB"
        result = launch_readiness(row)
        self.assertEqual(result["status"], "RESEARCHING")
        self.assertNotIn("monthlySearchVolume", row["discovery"])

    def test_exact_candidate_cannot_change_route_or_claim_numeric_volume(self):
        wrong_route = approved_candidate()
        wrong_route["url"] = "/kor/report/window/other.html"
        self.assertEqual(launch_readiness(wrong_route)["status"], "RESEARCHING")

        fake_volume = approved_candidate()
        fake_volume["discovery"]["monthlySearchVolume"] = 120
        self.assertEqual(launch_readiness(fake_volume)["status"], "RESEARCHING")

        nested_fake_volume = approved_candidate()
        nested_fake_volume["qualityInputs"]["monthlySearchVolume"] = 120
        self.assertEqual(launch_readiness(nested_fake_volume)["status"], "RESEARCHING")

    def test_only_the_exact_task_candidate_is_a_trusted_launch_source(self):
        other = approved_candidate()
        other["candidateId"] = "EXT-OTHER-UNKNOWN"
        other["experiment"]["taskId"] = "C01-OTHER"
        snapshot = {
            "json": {
                "data/content-launch-queue.json": {"queue": []},
                "data/external-content-opportunities.json": {
                    "candidates": [other],
                    "readyToLaunch": [other["candidateId"]],
                },
            },
            "csv": {"data/keywords_master.csv": []},
        }
        sources = _trusted_candidate_records(snapshot)
        self.assertEqual(len(sources["byId"][CANDIDATE_ID]), 1)
        self.assertNotIn("EXT-OTHER-UNKNOWN", sources["byId"])
        self.assertEqual(
            sources["byId"][CANDIDATE_ID][0]["contentPath"],
            PATH,
        )

    def test_code_change_exception_is_bound_to_one_review_manifest_and_two_files(self):
        manifest = {
            "taskId": TASK_ID,
            "candidateIds": [CANDIDATE_ID],
            "urls": [URL],
            "contentPaths": [PATH],
            "experimentScope": "ONE_PAGE",
            "demandStatus": "VOLUME_UNKNOWN",
            "dailyLimit": 1,
            "status": "READY_FOR_REVIEW",
        }
        changed = set(C01_032_ALLOWED_GUARD_CODE_PATHS) | {
            "kor/report/window/index.html",
            "kor/report/window/sitemap.xml",
            "data/content-launch-manifest.json",
            PATH,
        }
        self.assertTrue(
            _authorized_c01_032_guard_code_change(manifest, {PATH}, changed)
        )
        self.assertEqual(
            set(C01_032_ALLOWED_GUARD_CODE_PATHS),
            set(C01_032_ALLOWED_GUARD_CODE_PATHS) & TRUSTED_LAUNCH_CODE_PATHS,
        )
        self.assertFalse(
            _authorized_c01_032_guard_code_change(
                manifest, {"kor/report/window/other.html"}, changed
            )
        )
        self.assertFalse(
            _authorized_c01_032_guard_code_change(
                manifest, {PATH}, changed | {"scripts/content_launch_policy.py"}
            )
        )

    def test_article_hub_and_section_sitemap_bind_one_route_without_ad_scripts(self):
        repo = Path(__file__).resolve().parents[1]
        page = (repo / PATH).read_text(encoding="utf-8")
        hub = (repo / "kor/report/window/index.html").read_text(encoding="utf-8")
        sitemap = (repo / "kor/report/window/sitemap.xml").read_text(encoding="utf-8")
        root_sitemap = (repo / "sitemap.xml").read_text(encoding="utf-8")

        self.assertEqual(
            page.count(
                '<link rel="canonical" href="https://emfls.github.io'
                + URL
                + '">'
            ),
            1,
        )
        self.assertEqual(hub.count('href="iphone-photos-date-taken.html"'), 1)
        self.assertEqual(
            sitemap.count(
                "<loc>https://emfls.github.io"
                + URL
                + "</loc>"
            ),
            1,
        )
        self.assertIn(
            "https://emfls.github.io/kor/report/window/sitemap.xml",
            root_sitemap,
        )
        self.assertNotIn("adsbygoogle", page.casefold())
        self.assertNotIn("googletagmanager", page.casefold())
