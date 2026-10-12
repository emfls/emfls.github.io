from scripts.keyword_hunter_improvements import select_improvement_candidates
import unittest


def page(url, *, classification=None, cluster=None, cooldown=False, google=None, naver=None, ga4=None, page_score=80):
    return {
        "url": url,
        "classification": classification,
        "cluster": cluster,
        "cooldown": cooldown,
        "pageScore": page_score,
        "google": google or {"status": "NOT_CONNECTED"},
        "naver": naver or {"status": "NOT_AVAILABLE"},
        "ga4": ga4 or {"status": "NOT_CONNECTED"},
    }


def test_selects_only_measured_non_protected_pages():
    payload = {
        "asOf": "2026-09-12",
        "pages": [
            page("/winner", classification="WINNER", cluster="camp", naver={"status": "VERIFIED", "impressions": 500, "clicks": 30, "ctr": .06}),
            page("/cluster-peer", cluster="camp", naver={"status": "VERIFIED", "impressions": 300, "clicks": 20, "ctr": .067}),
            page("/google-position", google={"status": "VERIFIED", "impressions": 80, "clicks": 4, "ctr": .05, "position": 12}),
            page("/naver-low-ctr", naver={"status": "VERIFIED", "impressions": 200, "clicks": 2, "ctr": .01}),
            page("/traffic-structure", ga4={"status": "VERIFIED", "views": 100}, page_score=65),
            page("/cooldown", cooldown=True, naver={"status": "VERIFIED", "impressions": 500, "clicks": 1, "ctr": .002}),
            page("/no-data", page_score=20),
        ],
    }

    result = select_improvement_candidates(payload)
    urls = {row["url"] for row in result["candidates"]}
    assert urls == {"/cluster-peer", "/google-position", "/naver-low-ctr", "/traffic-structure"}
    assert result["candidateCount"] == 4
    assert all(row["reasons"] for row in result["candidates"])


def test_does_not_invent_missing_metrics():
    result = select_improvement_candidates({"asOf": "2026-09-12", "pages": [page("/empty")]})
    assert result == {"schemaVersion": 1, "asOf": "2026-09-12", "candidateCount": 0, "candidates": []}


class TestCandidateEvidenceProvenance(unittest.TestCase):
    def test_preserves_verified_source_windows_and_marks_candidate_as_heuristic(self):
        result = select_improvement_candidates({
            "asOf": "2026-10-11",
            "pages": [page(
                "/window-mismatch",
                google={
                    "status": "VERIFIED",
                    "source": "GOOGLE_SEARCH_CONSOLE_API",
                    "period": {"start": "2026-09-01", "end": "2026-09-30"},
                    "impressions": 120,
                    "clicks": 2,
                    "ctr": 2 / 120,
                    "position": 12,
                },
                ga4={
                    "status": "VERIFIED",
                    "source": "GOOGLE_ANALYTICS_DATA_API",
                    "period": {"start": "2026-09-02", "end": "2026-10-01"},
                    "views": 80,
                    "users": 30,
                    "revenue": 1.25,
                    "revenueMetric": "totalAdRevenue",
                },
            )],
        })
        candidate = result["candidates"][0]

        self.assertEqual(candidate["observedMetrics"]["google"].get("source"), "GOOGLE_SEARCH_CONSOLE_API")
        self.assertEqual(candidate["observedMetrics"]["google"].get("status"), "VERIFIED")
        self.assertEqual(candidate["observedMetrics"]["google"].get("period"), {"start": "2026-09-01", "end": "2026-09-30"})
        self.assertEqual(candidate["observedMetrics"]["google"].get("periodStatus"), "AVAILABLE")
        self.assertEqual(candidate["observedMetrics"]["ga4"].get("source"), "GOOGLE_ANALYTICS_DATA_API")
        self.assertEqual(candidate["observedMetrics"]["ga4"].get("period"), {"start": "2026-09-02", "end": "2026-10-01"})
        self.assertEqual(candidate["observedMetrics"]["ga4"].get("periodStatus"), "AVAILABLE")
        self.assertEqual(candidate["observedMetrics"]["ga4"].get("revenueMetric"), "totalAdRevenue")
        self.assertEqual(candidate.get("periodAlignment"), "MISMATCH")
        self.assertEqual(candidate.get("evidenceStatus"), "HEURISTIC_REVIEW_ONLY")
        self.assertTrue(candidate.get("requiresReproducibleIssue"))
        self.assertNotIn("adsense", candidate["observedMetrics"])
        self.assertNotIn("naver", candidate["observedMetrics"])

    def test_missing_and_invalid_windows_are_unknown_not_as_of(self):
        result = select_improvement_candidates({
            "asOf": "2026-10-11",
            "pages": [page(
                "/unknown-windows",
                google={
                    "status": "VERIFIED",
                    "source": "GOOGLE_SEARCH_CONSOLE_API",
                    "impressions": 120,
                    "clicks": 2,
                    "ctr": 2 / 120,
                    "position": 12,
                },
                ga4={
                    "status": "VERIFIED",
                    "source": "GOOGLE_ANALYTICS_DATA_API",
                    "period": {"start": "2026-09-01", "end": "not-a-date"},
                    "views": 80,
                    "users": 30,
                },
            )],
        })
        candidate = result["candidates"][0]

        self.assertIsNone(candidate["observedMetrics"]["google"].get("period"))
        self.assertEqual(candidate["observedMetrics"]["google"].get("periodStatus"), "UNKNOWN")
        self.assertIsNone(candidate["observedMetrics"]["ga4"].get("period"))
        self.assertEqual(candidate["observedMetrics"]["ga4"].get("periodStatus"), "UNKNOWN")
        self.assertEqual(candidate.get("periodAlignment"), "UNKNOWN")
        self.assertNotEqual(candidate["observedMetrics"]["google"].get("period"), {"start": "2026-10-11", "end": "2026-10-11"})

    def test_identical_source_windows_are_explicitly_aligned(self):
        shared_period = {"start": "2026-09-01", "end": "2026-09-30"}
        result = select_improvement_candidates({
            "asOf": "2026-10-11",
            "pages": [page(
                "/aligned-windows",
                google={
                    "status": "VERIFIED",
                    "source": "GOOGLE_SEARCH_CONSOLE_API",
                    "period": shared_period,
                    "impressions": 120,
                    "clicks": 2,
                    "ctr": 2 / 120,
                    "position": 12,
                },
                ga4={
                    "status": "VERIFIED",
                    "source": "GOOGLE_ANALYTICS_DATA_API",
                    "period": shared_period,
                    "views": 80,
                    "users": 30,
                },
            )],
        })

        self.assertEqual(result["candidates"][0].get("periodAlignment"), "MATCH")
