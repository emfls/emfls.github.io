import unittest

from scripts.revenue_opportunity import (
    classify_record,
    cooldown_state,
    empty_channel,
    freshness_status,
    normalize_channel,
    score_opportunity,
    select_improvements,
)


def performance_record(**overrides):
    record = {
        "url": "/kor/report/camp/example.html",
        "pageScore": 70,
        "pageType": "TRAFFIC",
        "cluster": "camping",
        "naver": {
            "impressions": 10000,
            "clicks": 100,
            "ctr": 0.01,
            "position": 18,
            "status": "VERIFIED",
        },
        "google": {
            "impressions": None,
            "clicks": None,
            "ctr": None,
            "position": None,
            "status": "NOT_CONNECTED",
        },
        "ga4": {
            "views": 100,
            "users": 80,
            "engagementSeconds": 50,
            "revenue": 0.2,
            "status": "VERIFIED",
        },
        "adsense": {"revenue": None, "rpm": None, "status": "NOT_CONNECTED"},
        "lastOptimizationDate": None,
        "cooldown": False,
    }
    record.update(overrides)
    return record


class RevenueOpportunityDataTest(unittest.TestCase):
    def test_data_older_than_seven_days_is_stale(self):
        channel = {
            "period": {"start": "2026-08-01", "end": "2026-08-20"},
            "status": "VERIFIED",
        }

        self.assertEqual(freshness_status(channel, "2026-08-31"), "STALE_DATA")

    def test_missing_channel_uses_null_not_zero(self):
        channel = empty_channel(("impressions", "clicks", "ctr"))

        self.assertEqual(channel["status"], "NOT_CONNECTED")
        self.assertIsNone(channel["impressions"])
        self.assertIsNone(channel["clicks"])
        self.assertIsNone(channel["ctr"])

    def test_normalization_preserves_verified_zero(self):
        channel = normalize_channel(
            {
                "impressions": 0,
                "clicks": 0,
                "ctr": 0.0,
                "status": "VERIFIED",
                "period": {"start": "2026-08-25", "end": "2026-08-30"},
            },
            ("impressions", "clicks", "ctr"),
            "2026-08-31",
        )

        self.assertEqual(channel["impressions"], 0)
        self.assertEqual(channel["status"], "VERIFIED")


class RevenueOpportunityBehaviorTest(unittest.TestCase):
    def test_high_impressions_low_ctr_scores_above_low_demand_page(self):
        high = score_opportunity(performance_record(), {"naver_ctr": 0.024})
        low = score_opportunity(
            performance_record(
                naver={
                    "impressions": 10,
                    "clicks": 0,
                    "ctr": 0.0,
                    "position": 80,
                    "status": "VERIFIED",
                }
            ),
            {"naver_ctr": 0.024},
        )

        self.assertGreater(high["score"], low["score"])
        self.assertEqual(sum(item["max"] for item in high["components"]), 100)

    def test_low_page_score_does_not_unprotect_winner(self):
        record = performance_record(
            pageScore=30,
            ga4={
                "views": 143,
                "users": 117,
                "engagementSeconds": 71,
                "revenue": 0.88,
                "status": "VERIFIED",
            },
        )

        classification, action, _ = classify_record(
            record, score_opportunity(record, {"naver_ctr": 0.024})
        )

        self.assertEqual(classification, "WINNER")
        self.assertEqual(action, "PROTECT")

    def test_cooldown_is_excluded_from_improvement_selection(self):
        record = performance_record(lastOptimizationDate="2026-08-25")
        record.update(cooldown_state(record["lastOptimizationDate"], "2026-08-31"))
        record.update(
            {
                "classification": "OPPORTUNITY",
                "nextAction": "IMPROVE_SEARCH_CTR",
                "revenueOpportunityScore": 95,
                "dataStatus": "VERIFIED",
            }
        )

        self.assertEqual(select_improvements([record]), [])

    def test_selection_is_capped_at_three(self):
        rows = []
        for index in range(8):
            row = performance_record(url=f"/p-{index}.html")
            row.update(
                {
                    "classification": "OPPORTUNITY",
                    "nextAction": "IMPROVE_SEARCH_CTR",
                    "revenueOpportunityScore": 90 - index,
                    "dataStatus": "VERIFIED",
                }
            )
            rows.append(row)

        self.assertEqual(len(select_improvements(rows)), 3)

    def test_three_active_experiments_block_additional_improvement_selection(self):
        row = performance_record()
        row.update(
            {
                "classification": "OPPORTUNITY",
                "nextAction": "IMPROVE_SEARCH_CTR",
                "revenueOpportunityScore": 90,
                "dataStatus": "VERIFIED",
            }
        )
        self.assertEqual(select_improvements([row], active_experiments=3), [])

    def test_adsense_ctr_cannot_change_score(self):
        first = performance_record(
            adsense={
                "revenue": None,
                "rpm": None,
                "ctr": 0.01,
                "status": "NOT_CONNECTED",
            }
        )
        second = performance_record(
            adsense={
                "revenue": None,
                "rpm": None,
                "ctr": 0.99,
                "status": "NOT_CONNECTED",
            }
        )

        self.assertEqual(
            score_opportunity(first, {"naver_ctr": 0.024}),
            score_opportunity(second, {"naver_ctr": 0.024}),
        )

    def test_missing_naver_rank_keeps_ranking_component_zero_and_unavailable(self):
        record = performance_record(
            naver={
                "impressions": 704,
                "clicks": 40,
                "ctr": 0.057,
                "position": None,
                "positionStatus": "NOT_AVAILABLE",
                "status": "VERIFIED",
            }
        )
        result = score_opportunity(
            record,
            {"naver_ctr": 0.084, "naver_impressions": 450, "naver_max_impressions": 1816, "naver_max_clicks": 138},
        )
        ranking = next(item for item in result["components"] if item["name"] == "ranking_upside")
        self.assertEqual(ranking["score"], 0)
        self.assertEqual(ranking["status"], "NOT_AVAILABLE")

    def test_low_ctr_does_not_score_ctr_gap_below_cluster_exposure_median(self):
        record = performance_record(
            naver={"impressions": 100, "clicks": 1, "ctr": 0.01, "position": None, "status": "VERIFIED"}
        )
        result = score_opportunity(
            record,
            {"naver_ctr": 0.084, "naver_impressions": 450, "naver_max_impressions": 1816, "naver_max_clicks": 138},
        )
        ctr = next(item for item in result["components"] if item["name"] == "search_ctr_gap")
        self.assertEqual(ctr["score"], 0)

    def test_not_available_metrics_cannot_create_dead_candidate(self):
        record = performance_record(
            naver={"impressions": None, "clicks": None, "ctr": None, "position": None, "status": "NOT_AVAILABLE"},
            ga4={"views": 0, "users": 0, "engagementSeconds": 0, "revenue": 0, "status": "VERIFIED"},
            duplicate=True,
            inboundLinks=0,
        )
        classification, action, _ = classify_record(record, score_opportunity(record, {}))
        self.assertNotEqual(classification, "DEAD_CANDIDATE")
        self.assertEqual(action, "WAIT_FOR_DATA")

    def test_search_volume_score_blends_cluster_percentile_with_log_scale(self):
        record = performance_record(url="/kor/report/camp/example.html")
        low_percentile = score_opportunity(
            record,
            {"naver_ctr": 0.024, "naver_max_impressions": 10000, "naver_max_clicks": 100, "naver_percentiles": {record["url"]: {"impressions": 0.2, "clicks": 0.2}}},
        )
        high_percentile = score_opportunity(
            record,
            {"naver_ctr": 0.024, "naver_max_impressions": 10000, "naver_max_clicks": 100, "naver_percentiles": {record["url"]: {"impressions": 1.0, "clicks": 1.0}}},
        )
        self.assertGreater(high_percentile["score"], low_percentile["score"])
        impressions = next(item for item in high_percentile["components"] if item["name"] == "search_impressions")
        self.assertEqual(impressions["inputs"]["clusterPercentile"], 1.0)
        self.assertIn("logNormalized", impressions["inputs"])

    def test_dead_candidate_only_returns_review_action(self):
        record = performance_record(
            naver={
                "impressions": 0,
                "clicks": 0,
                "ctr": 0.0,
                "position": None,
                "status": "VERIFIED",
            },
            ga4={
                "views": 0,
                "users": 0,
                "engagementSeconds": 0,
                "revenue": 0,
                "status": "VERIFIED",
            },
            duplicate=True,
            inboundLinks=0,
        )

        classification, action, _ = classify_record(
            record, score_opportunity(record, {"naver_ctr": 0.024})
        )

        self.assertEqual(
            (classification, action),
            ("DEAD_CANDIDATE", "DEAD_CANDIDATE_REVIEW"),
        )
        self.assertNotIn(action, {"DELETE", "NOINDEX", "CHANGE_CANONICAL"})


if __name__ == "__main__":
    unittest.main()
