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
            "revenueMetric": "totalAdRevenue",
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

    def test_normalization_preserves_ga4_revenue_metric_metadata(self):
        channel = normalize_channel(
            {"revenue": 0.2, "revenueMetric": "totalAdRevenue", "status": "VERIFIED", "period": {"start": "2026-08-20", "end": "2026-09-16"}},
            ("revenue",), "2026-09-17", ("revenueMetric",),
        )
        self.assertEqual(channel["revenueMetric"], "totalAdRevenue")


class RevenueOpportunityBehaviorTest(unittest.TestCase):
    def test_unavailable_page_url_revenue_is_not_zero_or_mislabeled_as_direct(self):
        record = performance_record(adsense={
            "revenue": None,
            "rpm": None,
            "revenueMetric": "ESTIMATED_EARNINGS",
            "status": "NOT_AVAILABLE",
            "period": {"start": "2026-09-28", "end": "2026-10-04"},
            "source": "DIRECT_ADSENSE_PAGE_URL",
            "coverageStatus": "NOT_AVAILABLE",
        })

        score = score_opportunity(record, {})
        actual_revenue = next(item for item in score["components"] if item["name"] == "actual_revenue")

        self.assertEqual(actual_revenue["inputs"]["revenue"], 0.2)
        self.assertEqual(actual_revenue["inputs"]["revenueSource"], "GA4_TOTAL_AD_REVENUE")
        self.assertIsNone(actual_revenue["inputs"]["revenueSources"]["directAdsenseUrlRevenue"])

    def test_ga4_total_ad_revenue_is_labeled_as_ga4(self):
        record = performance_record()

        score = score_opportunity(record, {})
        actual_revenue = next(item for item in score["components"] if item["name"] == "actual_revenue")
        classification, _, reasons = classify_record(record, score)

        self.assertEqual(actual_revenue["inputs"]["revenueSource"], "GA4_TOTAL_AD_REVENUE")
        self.assertEqual(actual_revenue["reason"], "Verified GA4 totalAdRevenue.")
        self.assertEqual(classification, "WINNER")
        self.assertIn("Verified GA4 totalAdRevenue", reasons)

    def test_direct_adsense_page_url_revenue_is_selected_and_labeled_when_both_sources_exist(self):
        aligned_period = {"start": "2026-09-28", "end": "2026-10-04"}
        record = performance_record(
            ga4={
                **performance_record()["ga4"],
                "period": aligned_period,
            },
            adsense={
                "revenue": 0.75,
                "rpm": 3.6,
                "revenueMetric": "ESTIMATED_EARNINGS",
                "status": "VERIFIED",
                "period": aligned_period,
                "source": "DIRECT_ADSENSE_PAGE_URL",
                "coverageStatus": "PARTIAL",
            }
        )

        score = score_opportunity(record, {})
        actual_revenue = next(item for item in score["components"] if item["name"] == "actual_revenue")
        classification, _, reasons = classify_record(record, score)

        self.assertEqual(actual_revenue["inputs"]["revenue"], 0.75)
        self.assertEqual(actual_revenue["inputs"]["revenueSource"], "DIRECT_ADSENSE_PAGE_URL")
        self.assertEqual(actual_revenue["reason"], "Verified direct AdSense URL revenue.")
        self.assertEqual(actual_revenue["inputs"]["periodComparison"], "MATCH")
        self.assertEqual(record["ga4"]["revenue"], 0.2)
        self.assertEqual(classification, "WINNER")
        self.assertIn("Verified direct AdSense URL revenue", reasons)

    def test_mismatched_periods_keep_both_sources_but_score_ga4_revenue(self):
        record = performance_record(
            ga4={
                **performance_record()["ga4"],
                "period": {"start": "2026-09-06", "end": "2026-10-03"},
            },
            adsense={
                "revenue": 0.75,
                "revenueMetric": "ESTIMATED_EARNINGS",
                "status": "VERIFIED",
                "period": {"start": "2026-09-28", "end": "2026-10-04"},
                "source": "DIRECT_ADSENSE_PAGE_URL",
                "coverageStatus": "PARTIAL",
            },
        )

        actual_revenue = next(
            item for item in score_opportunity(record, {})["components"] if item["name"] == "actual_revenue"
        )

        self.assertEqual(actual_revenue["inputs"]["revenue"], 0.2)
        self.assertEqual(actual_revenue["inputs"]["revenueSource"], "GA4_TOTAL_AD_REVENUE")
        self.assertEqual(actual_revenue["inputs"]["revenueSources"]["ga4TotalAdRevenue"], 0.2)
        self.assertEqual(actual_revenue["inputs"]["revenueSources"]["directAdsenseUrlRevenue"], 0.75)
        self.assertEqual(actual_revenue["inputs"]["periodComparison"], "MISMATCH")

    def test_direct_adsense_without_a_comparability_baseline_is_not_scored_but_can_protect(self):
        record = performance_record(
            ga4={
                "views": 100,
                "users": 80,
                "engagementSeconds": 50,
                "revenue": None,
                "revenueMetric": None,
                "status": "VERIFIED",
            },
            adsense={
                "revenue": 0.75,
                "revenueMetric": "ESTIMATED_EARNINGS",
                "status": "VERIFIED",
                "period": {"start": "2026-09-28", "end": "2026-10-04"},
                "source": "DIRECT_ADSENSE_PAGE_URL",
                "coverageStatus": "PARTIAL",
            },
        )

        score = score_opportunity(record, {})
        actual_revenue = next(item for item in score["components"] if item["name"] == "actual_revenue")
        classification, action, reasons = classify_record(record, score)

        self.assertIsNone(actual_revenue["inputs"]["revenue"])
        self.assertIsNone(actual_revenue["inputs"]["revenueSource"])
        self.assertEqual(actual_revenue["status"], "INSUFFICIENT_DATA")
        self.assertEqual(actual_revenue["inputs"]["periodComparison"], "NO_COMPARABILITY_BASELINE")
        self.assertEqual(actual_revenue["inputs"]["revenueSources"]["directAdsenseUrlRevenue"], 0.75)
        self.assertEqual((classification, action), ("WINNER", "PROTECT"))
        self.assertIn("Verified direct AdSense URL earnings (protection evidence)", reasons)

    def test_mismatched_positive_direct_revenue_can_protect_without_overriding_ga4_zero(self):
        record = performance_record(
            ga4={
                **performance_record()["ga4"],
                "revenue": 0,
                "period": {"start": "2026-09-06", "end": "2026-10-03"},
            },
            adsense={
                "revenue": 0.75,
                "revenueMetric": "ESTIMATED_EARNINGS",
                "status": "VERIFIED",
                "period": {"start": "2026-09-28", "end": "2026-10-04"},
                "source": "DIRECT_ADSENSE_PAGE_URL",
                "coverageStatus": "PARTIAL",
            },
        )

        score = score_opportunity(record, {})
        actual_revenue = next(item for item in score["components"] if item["name"] == "actual_revenue")
        classification, action, reasons = classify_record(record, score)

        self.assertEqual(actual_revenue["inputs"]["revenue"], 0)
        self.assertEqual(actual_revenue["inputs"]["revenueSource"], "GA4_TOTAL_AD_REVENUE")
        self.assertEqual(actual_revenue["inputs"]["revenueSources"]["directAdsenseUrlRevenue"], 0.75)
        self.assertEqual((classification, action), ("WINNER", "PROTECT"))
        self.assertIn("Verified direct AdSense URL earnings (protection evidence)", reasons)

    def test_positive_direct_url_earnings_protect_even_when_ga4_has_no_traffic(self):
        record = performance_record(
            naver={"impressions": 0, "clicks": 0, "ctr": 0.0, "position": None, "status": "VERIFIED"},
            ga4={
                "views": 0,
                "users": 0,
                "revenue": 0,
                "revenueMetric": "totalAdRevenue",
                "status": "VERIFIED",
                "period": {"start": "2026-09-06", "end": "2026-10-03"},
            },
            adsense={
                "revenue": 0.75,
                "revenueMetric": "ESTIMATED_EARNINGS",
                "status": "VERIFIED",
                "period": {"start": "2026-09-28", "end": "2026-10-04"},
                "source": "DIRECT_ADSENSE_PAGE_URL",
                "coverageStatus": "PARTIAL",
            },
            duplicate=True,
            inboundLinks=0,
        )

        classification, action, reasons = classify_record(record, score_opportunity(record, {}))

        self.assertEqual((classification, action), ("WINNER", "PROTECT"))
        self.assertIn("Verified direct AdSense URL earnings (protection evidence)", reasons)
        self.assertNotIn("Verified traffic", reasons)

    def test_verified_legacy_adsense_revenue_without_page_url_source_is_not_used(self):
        record = performance_record(
            ga4={"views": 100, "revenue": None, "revenueMetric": None, "status": "NOT_CONNECTED"},
            adsense={
                "revenue": 0.75,
                "rpm": 3.6,
                "status": "VERIFIED",
                "period": {"start": "2026-09-28", "end": "2026-10-04"},
                "source": "USER_VERIFIED_MANUAL_SNAPSHOT",
            },
        )

        score = score_opportunity(record, {})
        actual_revenue = next(item for item in score["components"] if item["name"] == "actual_revenue")
        classification, _, _ = classify_record(record, score)

        self.assertIsNone(actual_revenue["inputs"]["revenue"])
        self.assertIsNone(actual_revenue["inputs"]["revenueSource"])
        self.assertNotEqual(classification, "WINNER")

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
                "revenueMetric": "totalAdRevenue",
                "status": "VERIFIED",
            },
        )

        classification, action, _ = classify_record(
            record, score_opportunity(record, {"naver_ctr": 0.024})
        )

        self.assertEqual(classification, "WINNER")
        self.assertEqual(action, "PROTECT")

    def test_total_revenue_without_ad_metric_cannot_create_winner(self):
        record = performance_record(ga4={
            "views": 100, "users": 80, "engagementSeconds": 50,
            "revenue": 0.2, "revenueMetric": None, "status": "VERIFIED",
        })
        classification, action, _ = classify_record(record, score_opportunity(record, {}))
        self.assertNotEqual(classification, "WINNER")
        self.assertEqual(action, "IMPROVE_SEARCH_CTR")

    def test_duplicate_normalized_rows_are_aggregated(self):
        from scripts.collect_ga4_snapshot import build_snapshot
        from types import SimpleNamespace
        rows = [
            SimpleNamespace(dimension_values=[SimpleNamespace(value="/x?a=1")], metric_values=[SimpleNamespace(value="2"), SimpleNamespace(value="1"), SimpleNamespace(value="3"), SimpleNamespace(value="0.1")]),
            SimpleNamespace(dimension_values=[SimpleNamespace(value="/x?a=2")], metric_values=[SimpleNamespace(value="4"), SimpleNamespace(value="2"), SimpleNamespace(value="5"), SimpleNamespace(value="0.2")]),
        ]
        snapshot = build_snapshot(rows, period_start="2026-09-01", period_end="2026-09-16", collected_at="2026-09-17T00:00:00+00:00", property_id="226808916")
        self.assertEqual(len(snapshot["pages"]), 1)
        self.assertEqual(snapshot["pages"][0]["ga4"]["views"], 6)
        self.assertAlmostEqual(snapshot["pages"][0]["ga4"]["revenue"], 0.3)

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
                "revenueMetric": "totalAdRevenue",
                "status": "VERIFIED",
            },
            adsense={
                "revenue": 0,
                "revenueMetric": "ESTIMATED_EARNINGS",
                "status": "VERIFIED",
                "source": "DIRECT_ADSENSE_PAGE_URL",
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

    def test_zero_ga4_revenue_without_direct_url_row_is_not_dead_candidate(self):
        record = performance_record(
            naver={"impressions": 0, "clicks": 0, "ctr": 0.0, "position": None, "status": "VERIFIED"},
            ga4={"views": 0, "users": 0, "revenue": 0, "revenueMetric": "totalAdRevenue", "status": "VERIFIED"},
            adsense={"revenue": None, "revenueMetric": "ESTIMATED_EARNINGS", "status": "NOT_AVAILABLE", "source": "DIRECT_ADSENSE_PAGE_URL"},
            duplicate=True,
            inboundLinks=0,
        )

        classification, action, _ = classify_record(record, score_opportunity(record, {}))

        self.assertNotEqual(classification, "DEAD_CANDIDATE")
        self.assertEqual(action, "WAIT_FOR_DATA")
        self.assertNotIn(action, {"DELETE", "NOINDEX", "CHANGE_CANONICAL"})


if __name__ == "__main__":
    unittest.main()
