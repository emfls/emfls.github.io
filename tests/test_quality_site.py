import unittest

from scripts.quality_site import calculate_revenue_goal, calculate_site_score, rank_priority


class QualityPriorityTest(unittest.TestCase):
    def test_measured_page_outranks_zero_data_page_when_opportunity_is_large(self):
        measured = rank_priority(
            {"score": 72, "type": "TRAFFIC", "issues": ["missing_sources"]},
            {
                "impressions": 20000,
                "organic_clicks": 100,
                "search_ctr": 0.005,
                "average_position": 8,
                "sessions": 900,
                "opportunity_score": 500,
            },
        )
        estimated = rank_priority({"score": 45, "type": "TRAFFIC", "issues": ["thin_content"]}, None)

        self.assertEqual(measured["basis"], "MEASURED")
        self.assertGreater(measured["score"], estimated["score"])
        self.assertEqual(estimated["basis"], "ESTIMATED")

    def test_missing_url_revenue_is_not_replaced_with_site_revenue(self):
        result = rank_priority({"score": 70, "type": "MONEY", "issues": []}, {"impressions": 10})
        self.assertEqual(result["metrics"]["revenue"]["status"], "NOT_CONNECTED")
        self.assertEqual(result["metrics"]["rpm"]["status"], "NOT_CONNECTED")

    def test_small_measured_opportunity_outranks_unmeasured_verification_file(self):
        measured = rank_priority(
            {"score": 70, "type": "TRAFFIC", "issues": ["missing_sources"]},
            {"impressions": 198, "organic_clicks": 2, "average_position": 8, "opportunity_score": 3.5},
        )
        unmeasured = rank_priority(
            {"score": 25, "type": "UTILITY", "issues": ["thin_content", "missing_sources"]},
            None,
        )
        self.assertGreater(measured["score"], unmeasured["score"])


class RevenueAndSiteScoreTest(unittest.TestCase):
    def test_revenue_goal_uses_period_daily_average_and_actual_rpm(self):
        result = calculate_revenue_goal(
            {
                "period": {"start": "2026-08-01", "end": "2026-08-10"},
                "estimated_earnings_usd": 10.0,
                "page_views": 2000,
                "page_rpm": 5.0,
            }
        )
        self.assertEqual(result["daily_revenue_usd"], 1.0)
        self.assertEqual(result["required_growth"], 100.0)
        self.assertEqual(result["required_page_views"], 20000)
        self.assertEqual(result["label"], "period_daily_average")

    def test_missing_adsense_data_is_explicit(self):
        self.assertEqual(calculate_revenue_goal(None)["status"], "DATA NOT AVAILABLE")

    def test_multi_year_adsense_export_is_labeled_historical(self):
        result = calculate_revenue_goal(
            {
                "period": {"start": "2023-08-01", "end": "2026-08-01"},
                "estimated_earnings_usd": 89.81,
                "page_views": 85936,
                "page_rpm": 1.05,
            }
        )
        self.assertEqual(result["label"], "historical_period_daily_average")

    def test_negative_values_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "non-negative"):
            calculate_revenue_goal(
                {
                    "period": {"start": "2026-08-01", "end": "2026-08-01"},
                    "estimated_earnings_usd": -1,
                    "page_views": 1,
                    "page_rpm": 1,
                }
            )

    def test_site_score_aggregates_distribution_and_exact_category_total(self):
        pages = [
            {"url": "/a", "score": 92, "grade": "S", "type": "TOOL", "status": "CORE"},
            {"url": "/b", "score": 84, "grade": "A", "type": "TRAFFIC", "status": "GOOD"},
            {"url": "/c", "score": 55, "grade": "D", "type": "MONEY", "status": "FAIL"},
        ]
        result = calculate_site_score(
            pages,
            {
                "gsc_state": "CSV_CONNECTED",
                "ga4_state": "CSV_CONNECTED",
                "sitemap_ok": True,
                "robots_ok": True,
                "https_ok": True,
                "canonical_ratio": 1.0,
                "breadcrumb_ratio": 0.67,
                "structured_data_ratio": 0.67,
                "orphan_ratio": 0.0,
                "trust_pages": {"about", "contact", "privacy", "terms", "disclaimer", "methodology"},
                "adsense_policy_safe": True,
            },
        )
        self.assertEqual(result["kpis"]["total_pages"], 3)
        self.assertEqual(result["kpis"]["grades"], {"S": 1, "A": 1, "B": 0, "C": 0, "D": 1, "F": 0})
        self.assertEqual(result["score"], sum(section["score"] for section in result["scores"].values()))
        self.assertEqual(sum(section["max"] for section in result["scores"].values()), 100)
if __name__ == "__main__":
    unittest.main()
