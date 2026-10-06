import unittest

from scripts.validate_measurement_sources import validate_measurement_sources


AS_OF = "2026-10-06"
GA4_PERIOD = {"start": "2026-09-08", "end": "2026-10-05"}
GSC_PERIOD = {"start": "2026-09-06", "end": "2026-10-03"}


def snapshots():
    ga4 = {
        "as_of": "2026-10-06",
        "collection": {"collectedAt": "2026-10-06T02:00:00+00:00", "source": "GOOGLE_ANALYTICS_DATA_API"},
        "periods": {"ga4": dict(GA4_PERIOD)},
        "site": {"ga4": {"status": "VERIFIED", "source": "GOOGLE_ANALYTICS_DATA_API", "revenueMetric": "totalAdRevenue", "period": dict(GA4_PERIOD)}},
        "pages": [{"url": "/a.html", "ga4": {"status": "VERIFIED", "source": "GOOGLE_ANALYTICS_DATA_API", "revenueMetric": "totalAdRevenue", "period": dict(GA4_PERIOD)}}],
    }
    gsc = {
        "status": "VERIFIED",
        "source": "GOOGLE_SEARCH_CONSOLE_API",
        "property": "https://emfls.github.io/",
        "periodStart": GSC_PERIOD["start"],
        "periodEnd": GSC_PERIOD["end"],
        "periods": {"gsc": dict(GSC_PERIOD)},
        "generatedAt": "2026-10-06T02:30:00+00:00",
        "pages": [{"url": "/a.html", "google": {"status": "VERIFIED", "source": "GOOGLE_SEARCH_CONSOLE_API", "property": "https://emfls.github.io/", "period": dict(GSC_PERIOD)}}],
    }
    adsense = {
        "schemaVersion": 1,
        "source": "DIRECT_ADSENSE_MANAGEMENT_API_V2",
        "generatedAt": "2026-10-06T02:40:00+00:00",
        "account": {"name": "accounts/pub-123"},
        "currency": "USD",
        "site": {"domain": "emfls.github.io", "status": "PARTIAL", "comparisonStatus": "VERIFIED"},
        "currentPeriod": {"start": "2026-09-29", "end": "2026-10-05", "days": 7, "inclusive": True},
        "priorPeriod": {"start": "2026-09-22", "end": "2026-09-28", "days": 7, "inclusive": True},
        "pageUrls": {"source": "DIRECT_ADSENSE_PAGE_URL", "coverageStatus": "PARTIAL", "rows": [], "returnedRowCount": 0},
    }
    return ga4, gsc, adsense


class ValidateMeasurementSourcesTest(unittest.TestCase):
    def test_accepts_current_source_snapshots_and_partial_adsense_with_no_page_rows(self):
        result = validate_measurement_sources(*snapshots(), as_of=AS_OF)
        self.assertEqual(result["ga4"], "VERIFIED")
        self.assertEqual(result["gsc"], "VERIFIED")
        self.assertEqual(result["adsense"], "PARTIAL")

    def test_rejects_gsc_snapshot_older_than_its_three_day_collection_window(self):
        ga4, gsc, adsense = snapshots()
        gsc["periodStart"] = "2026-09-05"
        gsc["periodEnd"] = "2026-10-02"
        gsc["periods"]["gsc"].update(start="2026-09-05", end="2026-10-02")
        gsc["pages"][0]["google"]["period"]["start"] = "2026-09-05"
        gsc["pages"][0]["google"]["period"]["end"] = "2026-10-02"
        with self.assertRaisesRegex(ValueError, "GSC period end"):
            validate_measurement_sources(ga4, gsc, adsense, as_of=AS_OF)

    def test_rejects_ga4_beyond_its_existing_seven_day_freshness_limit(self):
        ga4, gsc, adsense = snapshots()
        stale_period = {"start": "2026-09-01", "end": "2026-09-28"}
        ga4["as_of"] = "2026-10-06"
        ga4["periods"]["ga4"] = dict(stale_period)
        ga4["site"]["ga4"]["period"] = dict(stale_period)
        ga4["pages"][0]["ga4"]["period"] = dict(stale_period)
        with self.assertRaisesRegex(ValueError, "GA4 period is stale"):
            validate_measurement_sources(ga4, gsc, adsense, as_of=AS_OF)

    def test_rejects_adsense_site_summary_without_verified_comparison(self):
        ga4, gsc, adsense = snapshots()
        adsense["site"]["comparisonStatus"] = "NOT_AVAILABLE"
        with self.assertRaisesRegex(ValueError, "AdSense site comparison"):
            validate_measurement_sources(ga4, gsc, adsense, as_of=AS_OF)

    def test_rejects_adsense_period_that_does_not_end_yesterday(self):
        ga4, gsc, adsense = snapshots()
        adsense["currentPeriod"].update(start="2026-09-28", end="2026-10-04")
        adsense["priorPeriod"].update(start="2026-09-21", end="2026-09-27")
        with self.assertRaisesRegex(ValueError, "AdSense current period end is stale"):
            validate_measurement_sources(ga4, gsc, adsense, as_of=AS_OF)


if __name__ == "__main__":
    unittest.main()
