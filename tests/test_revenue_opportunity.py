import unittest

from scripts.revenue_opportunity import empty_channel, freshness_status, normalize_channel


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


if __name__ == "__main__":
    unittest.main()
