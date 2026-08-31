import unittest

from scripts.quality_site import rank_priority


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
if __name__ == "__main__":
    unittest.main()
