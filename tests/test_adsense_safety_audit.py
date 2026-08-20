import csv
import tempfile
import unittest
from pathlib import Path

from scripts.adsense_safety_audit import audit_daily_csv


class AdsenseSafetyAuditTests(unittest.TestCase):
    def test_uses_latest_90_days_and_calculates_page_ctr(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "daily.csv"
            with source.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.writer(handle)
                writer.writerow([
                    "Date", "Estimated earnings (USD)", "Page views",
                    "Page RPM (USD)", "Impressions", "Impression RPM (USD)",
                    "Active View Viewable", "Clicks",
                ])
                writer.writerow(["2026-01-01", 1, 100, 10, 400, 2.5, 0.5, 20])
                writer.writerow(["2026-04-01", 2, 200, 10, 800, 2.5, 0.6, 10])
                writer.writerow(["2026-06-29", 3, 300, 10, 1200, 2.5, 0.7, 15])

            result = audit_daily_csv(source, days=90)

        self.assertEqual(result["period_start"], "2026-04-01")
        self.assertEqual(result["period_end"], "2026-06-29")
        self.assertEqual(result["page_views"], 500)
        self.assertEqual(result["clicks"], 25)
        self.assertAlmostEqual(result["page_ctr"], 0.05)
        self.assertAlmostEqual(result["page_rpm"], 10.0)

    def test_flags_daily_ctr_outliers_without_calling_them_policy_violations(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "daily.csv"
            with source.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.writer(handle)
                writer.writerow([
                    "Date", "Estimated earnings (USD)", "Page views",
                    "Page RPM (USD)", "Impressions", "Impression RPM (USD)",
                    "Active View Viewable", "Clicks",
                ])
                writer.writerow(["2026-08-01", 1, 100, 10, 400, 2.5, 0.5, 18])

            result = audit_daily_csv(source, days=90)

        self.assertEqual(result["high_ctr_days"][0]["date"], "2026-08-01")
        self.assertEqual(result["assessment"], "manual_review_required")
        self.assertNotIn("violation", result["assessment"])


if __name__ == "__main__":
    unittest.main()
