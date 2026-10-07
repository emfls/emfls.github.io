import copy
import json
import tempfile
import unittest
from pathlib import Path

from scripts.build_page_performance_manifest import build_manifest, serialize_manifest
from scripts.validate_page_performance_compact_parity import (
    compare_basic_consumers,
    compare_page_projection,
    compare_revenue_results,
    validate_manifest_for_parity,
)
from scripts.compact_page_performance import project


def channel(status, period=None, source=None, **metrics):
    return {"status": status, "period": period, "source": source, **metrics}


def full_fixture():
    page = {
        "url": "/kor/report/camp/ansan.html",
        "classification": "OPPORTUNITY",
        "cooldown": False,
        "cluster": "camping",
        "pageScore": 70,
        "ga4": channel("VERIFIED", {"start": "2026-09-08", "end": "2026-10-05"}, "GA4", views=500, users=300, engagementSeconds=8000, revenue=2.5, revenueMetric="totalAdRevenue"),
        "google": channel("VERIFIED", {"start": "2026-09-06", "end": "2026-10-03"}, "GSC", clicks=10, impressions=1000, ctr=0.01, position=8.2),
        "naver": channel("NOT_CONNECTED", None, None, clicks=None, impressions=None, ctr=None, position=None),
        "adsense": channel("NOT_AVAILABLE", None, "DIRECT_ADSENSE_PAGE_URL", revenue=None, rpm=None, revenueMetric="ESTIMATED_EARNINGS", coverageStatus="NOT_AVAILABLE"),
    }
    return {
        "schemaVersion": 1,
        "asOf": "2026-10-06",
        "summary": {"evaluatedIndexablePages": 1},
        "pages": [page],
    }


class PagePerformanceCompactParityTests(unittest.TestCase):
    def setUp(self):
        self.full = full_fixture()
        self.compact = project(self.full)

    def test_rejects_dropped_url_classification_channel_field_or_metric(self):
        cases = []
        mutation = copy.deepcopy(self.compact)
        mutation["pages"][0].pop("url")
        cases.append(mutation)
        mutation = copy.deepcopy(self.compact)
        mutation["pages"][0].pop("classification")
        cases.append(mutation)
        mutation = copy.deepcopy(self.compact)
        mutation["pages"][0].pop("google")
        cases.append(mutation)
        mutation = copy.deepcopy(self.compact)
        mutation["pages"][0]["ga4"].pop("revenue")
        cases.append(mutation)
        for candidate in cases:
            with self.subTest(candidate=candidate):
                with self.assertRaisesRegex(ValueError, "compact page projection differs"):
                    compare_page_projection(self.full, candidate)

    def test_keyword_hunter_and_gsc_opportunity_url_sets_match(self):
        opportunities = {"classificationCounts": {"OPPORTUNITY": 1}}
        result = compare_basic_consumers(self.full, self.compact, opportunities)
        self.assertEqual(result["keywordHunterCandidates"], 1)
        self.assertEqual(result["gscOpportunityUrls"], ["/kor/report/camp/ansan.html"])

    def test_revenue_summary_protection_selection_top_rows_and_report_must_match(self):
        page_output = {"pages": [{"url": "/winner/", "classification": "WINNER"}]}
        summary = {
            "revenue": {"sevenDays": 4.5},
            "protectedWinners": [{"url": "/winner/"}],
            "selectedImprovements": [{"url": "/candidate/"}],
            "topOpportunities": [{"url": "/candidate/"}],
        }
        valid = {"pages": page_output, "summary": summary, "report": "same report\n"}
        compare_revenue_results(valid, copy.deepcopy(valid))
        for key in ("revenue", "protectedWinners", "selectedImprovements", "topOpportunities"):
            changed = copy.deepcopy(valid)
            changed["summary"][key] = [] if key != "revenue" else {"sevenDays": 0}
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, "revenue pipeline parity failed"):
                compare_revenue_results(valid, changed)
        changed_report = {**copy.deepcopy(valid), "report": "changed\n"}
        with self.assertRaisesRegex(ValueError, "report text differs"):
            compare_revenue_results(valid, changed_report)

    def test_manifest_hash_mismatch_fails_before_parity(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            full_path = root / "full.json"
            ga4_path = root / "ga4.json"
            gsc_path = root / "gsc.json"
            adsense_path = root / "adsense.json"
            manifest_path = root / "manifest.json"
            full_path.write_text(json.dumps(self.full), encoding="utf-8")
            ga4_path.write_text(json.dumps({"periods": {"ga4": {"start": "2026-09-08", "end": "2026-10-05"}}}), encoding="utf-8")
            gsc_path.write_text(json.dumps({"periodStart": "2026-09-06", "periodEnd": "2026-10-03"}), encoding="utf-8")
            adsense_path.write_text(json.dumps({"currentPeriod": {"start": "2026-09-29", "end": "2026-10-05"}}), encoding="utf-8")
            manifest = build_manifest(full_path, ga4_path, gsc_path, adsense_path, "b" * 40, "44", "1")
            manifest["fullArtifact"]["sha256"] = "0" * 64
            manifest_path.write_bytes(serialize_manifest(manifest))
            with self.assertRaisesRegex(ValueError, "manifest does not match current inputs"):
                validate_manifest_for_parity(
                    manifest_path,
                    full_path,
                    ga4_path,
                    gsc_path,
                    adsense_path,
                    analysis_commit="b" * 40,
                    workflow_run_id="44",
                    workflow_run_attempt="1",
                )


if __name__ == "__main__":
    unittest.main()
