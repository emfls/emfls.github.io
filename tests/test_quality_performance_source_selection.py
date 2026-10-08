import json
import tempfile
import unittest
from pathlib import Path

from scripts.quality_audit import run_quality_audit
from scripts.quality_site import load_quality_performance, performance_by_url, rank_priority


AS_OF = "2026-10-08"
GA4_PERIOD = {"start": "2026-09-10", "end": "2026-10-07"}
GSC_PERIOD = {"start": "2026-09-08", "end": "2026-10-05"}
GA4_SOURCE = "GOOGLE_ANALYTICS_DATA_API"
GSC_SOURCE = "GOOGLE_SEARCH_CONSOLE_API"
GSC_PROPERTY = "https://emfls.github.io/"


def ga4_row(url, *, views=0, users=0, engagement=0.0, revenue=None):
    return {
        "url": url,
        "ga4": {
            "views": views,
            "users": users,
            "engagementSeconds": engagement,
            "revenue": revenue,
            "revenueMetric": "totalAdRevenue",
            "period": dict(GA4_PERIOD),
            "source": GA4_SOURCE,
            "status": "VERIFIED",
        },
    }


def ga4_snapshot(rows):
    return {
        "as_of": AS_OF,
        "schema_version": 2,
        "collection": {"collectedAt": "2026-10-08T08:58:12+00:00", "source": GA4_SOURCE},
        "site": {"ga4": {"status": "VERIFIED", "source": GA4_SOURCE, "revenueMetric": "totalAdRevenue", "period": dict(GA4_PERIOD)}},
        "periods": {"ga4": dict(GA4_PERIOD)},
        "pages": list(rows),
    }


def gsc_row(url, *, clicks=0, impressions=0, ctr=0.0, position=0.0, period=None):
    period = dict(period or GSC_PERIOD)
    return {
        "url": url,
        "google": {
            "clicks": clicks,
            "impressions": impressions,
            "ctr": ctr,
            "position": position,
            "period": period,
            "source": GSC_SOURCE,
            "property": GSC_PROPERTY,
            "status": "VERIFIED",
        },
    }


def gsc_snapshot(rows, *, period=None):
    period = dict(period or GSC_PERIOD)
    return {
        "status": "VERIFIED",
        "source": GSC_SOURCE,
        "property": GSC_PROPERTY,
        "periodStart": period["start"],
        "periodEnd": period["end"],
        "generatedAt": "2026-10-08T09:28:53+00:00",
        "periods": {"gsc": dict(period)},
        "pages": list(rows),
    }


def _write(path, payload):
    path.write_text(json.dumps(payload), encoding="utf-8")


class QualityPerformanceSourceSelectionTest(unittest.TestCase):
    def test_mixed_directory_uses_valid_page_sources_and_ignores_sidecars(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            _write(directory / "ga4-latest.json", ga4_snapshot([ga4_row("/a.html", views=0)]))
            _write(directory / "gsc-latest.json", gsc_snapshot([gsc_row("/a.html", clicks=0, impressions=0, position=0.0)]))
            _write(directory / "gsc-opportunity-queries-latest.json", {"source": GSC_SOURCE, "pages": [{"url": "/a.html", "queries": [{"query": "sidecar only"}]}]})
            _write(directory / "gsc-camp-query-latest.json", {"source": GSC_SOURCE, "rows": [{"page": "/a.html", "query": "camp query"}]})
            _write(directory / "adsense-latest.json", {"source": "DIRECT_ADSENSE_MANAGEMENT_API_V2", "pageUrls": {"rows": []}})
            _write(directory / "2026-08-31.json", {"pages": [ga4_row("/a.html", views=999)]})

            performance = load_quality_performance(directory, AS_OF)
            by_url = performance_by_url(performance)
            priority = rank_priority({"score": 70, "type": "TRAFFIC", "issues": []}, by_url["/a.html"])

            self.assertEqual(performance["periods"], {"ga4": GA4_PERIOD, "gsc": GSC_PERIOD})
            self.assertEqual(performance["source_selection"]["ga4"]["status"], "VERIFIED")
            self.assertEqual(performance["source_selection"]["gsc"]["status"], "VERIFIED")
            self.assertEqual(performance["source_selection"]["ga4"]["normalized_url_collisions"], 0)
            self.assertEqual(by_url["/a.html"]["views"], 0)
            self.assertEqual(by_url["/a.html"]["impressions"], 0)
            self.assertEqual(priority["basis"], "MEASURED")
            self.assertEqual(priority["metrics"]["views"], {"value": 0, "status": "VERIFIED", "source": GA4_SOURCE, "period": GA4_PERIOD})
            self.assertEqual(priority["metrics"]["clicks"]["value"], 0)
            self.assertEqual(priority["metrics"]["clicks"]["status"], "VERIFIED")
            self.assertIsNone(priority["metrics"]["sessions"]["value"])
            self.assertEqual(priority["metrics"]["sessions"]["status"], "NOT_AVAILABLE")
            self.assertEqual(priority["metrics"]["revenue"]["status"], "NOT_CONNECTED")
            self.assertIsNone(priority["metrics"]["revenue"]["value"])
            self.assertEqual(priority["metrics"]["rpm"]["status"], "NOT_CONNECTED")
            missing_priority = rank_priority({"score": 70, "type": "TRAFFIC", "issues": []}, None)
            self.assertEqual(missing_priority["basis"], "ESTIMATED")
            self.assertEqual(missing_priority["metrics"]["views"]["status"], "NOT_CONNECTED")

    def test_old_sidecars_and_manual_snapshot_alone_do_not_become_performance(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            _write(directory / "gsc-opportunity-queries-latest.json", {"source": GSC_SOURCE, "pages": [{"url": "/a.html", "queries": []}]})
            _write(directory / "2026-08-31.json", {"pages": [ga4_row("/a.html", views=999)]})
            performance = load_quality_performance(directory, AS_OF)

            self.assertEqual(performance["pages"], [])
            self.assertEqual(performance["periods"], {})
            self.assertEqual(performance["source_selection"]["ga4"]["status"], "NOT_CONNECTED")
            self.assertEqual(performance["source_selection"]["gsc"]["status"], "NOT_CONNECTED")

    def test_wrong_source_schema_or_missing_metric_fails_closed(self):
        bad_inputs = []
        wrong_source = gsc_snapshot([gsc_row("/a.html", impressions=3)])
        wrong_source["source"] = "UNTRUSTED_SOURCE"
        bad_inputs.append(("wrong-source", "source metadata", "gsc-latest.json", wrong_source))

        wrong_schema = ga4_snapshot([ga4_row("/a.html")])
        wrong_schema["schema_version"] = 1
        bad_inputs.append(("wrong-schema", "schema_version", "ga4-latest.json", wrong_schema))

        external_url = ga4_snapshot([ga4_row("https://example.test/a.html")])
        bad_inputs.append(("external-url", "outside emfls.github.io", "ga4-latest.json", external_url))

        missing_metric = ga4_snapshot([ga4_row("/a.html")])
        del missing_metric["pages"][0]["ga4"]["views"]
        bad_inputs.append(("missing-metric", "views", "ga4-latest.json", missing_metric))

        for name, message, filename, payload in bad_inputs:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as temporary:
                directory = Path(temporary)
                _write(directory / filename, payload)
                with self.assertRaisesRegex(ValueError, message):
                    load_quality_performance(directory, AS_OF)

    def test_stale_channel_is_not_used_and_is_reported_explicitly(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            _write(directory / "ga4-latest.json", ga4_snapshot([ga4_row("/a.html", views=7)]))
            stale_period = {"start": "2026-09-07", "end": "2026-10-04"}
            _write(directory / "gsc-latest.json", gsc_snapshot([gsc_row("/a.html", impressions=8, position=8.0, period=stale_period)], period=stale_period))

            performance = load_quality_performance(directory, AS_OF)
            metrics = performance_by_url(performance)["/a.html"]

            self.assertEqual(performance["source_selection"]["gsc"]["status"], "STALE_DATA")
            self.assertEqual(performance["source_selection"]["ga4"]["status"], "VERIFIED")
            self.assertEqual(performance["periods"], {"ga4": GA4_PERIOD})
            self.assertNotIn("google", metrics)
            self.assertEqual(metrics["views"], 7)

    def test_ga4_aliases_sum_additive_metrics_but_do_not_sum_users(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            _write(directory / "ga4-latest.json", ga4_snapshot([
                ga4_row("/a.html", views=3, users=2, engagement=4.0, revenue=0.1),
                ga4_row("/%61.html", views=4, users=3, engagement=5.0, revenue=0.2),
            ]))

            performance = load_quality_performance(directory, AS_OF)
            rows = performance_by_url(performance)

            self.assertEqual(list(rows), ["/a.html"])
            self.assertEqual(rows["/a.html"]["views"], 7)
            self.assertIsNone(rows["/a.html"]["users"])
            self.assertAlmostEqual(rows["/a.html"]["ga4"]["revenue"], 0.3)
            self.assertEqual(performance["source_selection"]["ga4"]["normalized_url_collisions"], 1)

    def test_quality_audit_site_score_uses_channel_periods_and_preserves_page_grades(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            performance_dir = root / "performance"
            performance_dir.mkdir()
            _write(performance_dir / "ga4-latest.json", ga4_snapshot([ga4_row("/a.html", views=0)]))
            _write(performance_dir / "gsc-latest.json", gsc_snapshot([gsc_row("/a.html", impressions=5, position=12.0)]))
            _write(performance_dir / "gsc-opportunity-queries-latest.json", {"pages": [{"url": "/a.html", "queries": []}]})
            audit_path = root / "audit.json"
            _write(audit_path, {"pages": [{"url": "/a.html", "path": "a.html", "title": "A page", "description": "A description", "word_count": 900, "h1_count": 1, "h2_count": 2, "h3_count": 0, "canonical": "https://emfls.github.io/a.html", "internal_links": 1, "images": 0, "structured_data_types": [], "indexable": True, "adsense": True, "ga4": True, "parse_warnings": []}]})

            _, site = run_quality_audit(
                root=root,
                audit_path=audit_path,
                metadata_path=root / "missing-metadata.json",
                performance_dir=performance_dir,
                cannibalization_path=root / "missing-cannibalization.json",
                as_of=AS_OF,
                page_output=root / "scores.json",
                site_output=root / "site-score.json",
            )

            self.assertEqual(site["connections"]["ga4"], "CSV_CONNECTED")
            self.assertEqual(site["connections"]["gsc"], "CSV_CONNECTED")
            self.assertEqual(site["measurement_sources"]["ga4"]["period"], GA4_PERIOD)
            self.assertEqual(site["measurement_sources"]["gsc"]["period"], GSC_PERIOD)
            self.assertEqual(sum(site["kpis"]["grades"].values()), 1)


if __name__ == "__main__":
    unittest.main()
