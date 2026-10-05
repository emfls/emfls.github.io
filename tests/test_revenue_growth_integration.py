import json
import tempfile
import unittest
from pathlib import Path

from scripts.revenue_growth import content_growth_summary, period_alignment, run_revenue_growth


def write_json(path, payload):
    path.write_text(json.dumps(payload), encoding="utf-8")


class RevenueGrowthIntegrationTest(unittest.TestCase):
    def test_direct_adsense_matched_site_period_is_reported_with_source_labels(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            url = "/known.html"
            period = {"start": "2026-09-28", "end": "2026-10-04", "days": 7, "inclusive": True}
            prior_period = {"start": "2026-09-21", "end": "2026-09-27", "days": 7, "inclusive": True}
            missing_url = "/not-returned.html"
            write_json(root / "scores.json", {"pages": [{"url": url, "score": 75, "type": "UTILITY"}, {"url": missing_url, "score": 70, "type": "UTILITY"}]})
            write_json(root / "audit.json", {"pages": [{"url": url, "indexable": True}, {"url": missing_url, "indexable": True}]})
            write_json(root / "performance.json", {
                "site": {"ga4": {"views": 30, "users": 20, "revenue": 2.4, "revenueMetric": "totalAdRevenue", "source": "GOOGLE_ANALYTICS_DATA_API", "status": "VERIFIED", "period": {"start": "2026-09-06", "end": "2026-10-03"}}},
                "pages": [{"url": url, "ga4": {"views": 5, "users": 4, "revenue": 0.7, "revenueMetric": "totalAdRevenue", "source": "GOOGLE_ANALYTICS_DATA_API", "status": "VERIFIED", "period": {"start": "2026-09-06", "end": "2026-10-03"}}}],
            })
            direct_adsense = {
                "schemaVersion": 1,
                "source": "DIRECT_ADSENSE_MANAGEMENT_API_V2",
                "sourceStatus": "VERIFIED",
                "currency": "USD",
                "site": {
                    "domain": "emfls.github.io",
                    "status": "VERIFIED",
                    "comparisonStatus": "VERIFIED",
                    "dimensions": ["DATE", "OWNED_SITE_DOMAIN_NAME"],
                    "metrics": ["ESTIMATED_EARNINGS", "PAGE_VIEWS", "PAGE_VIEWS_RPM", "IMPRESSIONS", "CLICKS", "COST_PER_CLICK"],
                    "current": {"estimatedEarnings": 18.5, "pageViews": 1000, "pageViewsRPM": 18.5, "impressions": 2000, "clicks": 10, "costPerClick": 1.85},
                    "prior": {"estimatedEarnings": 10.0, "pageViews": 500, "pageViewsRPM": 20.0, "impressions": 1000, "clicks": 5, "costPerClick": 2.0},
                    "absoluteDelta": {"estimatedEarnings": 8.5},
                    "relativeDelta": {"estimatedEarnings": 0.85},
                },
                "currentPeriod": period,
                "priorPeriod": prior_period,
                "reportingTimeZone": {"mode": "ACCOUNT_TIME_ZONE", "id": "Asia/Seoul"},
                "collector": {"scheduleTimeZone": "UTC"},
                "pageUrls": {"source": "DIRECT_ADSENSE_PAGE_URL", "coverageStatus": "PARTIAL", "rows": [{"url": f"https://emfls.github.io{url}", "estimatedEarnings": 0.4}]},
            }
            write_json(root / "adsense.json", direct_adsense)
            write_json(root / "experiments.json", {"experiments": []})
            write_json(root / "history.json", {"pages": []})

            pages, summary = run_revenue_growth(
                page_scores_path=root / "scores.json", audit_path=root / "audit.json",
                performance_path=root / "performance.json", experiments_path=root / "experiments.json",
                optimization_history_path=root / "history.json", as_of="2026-10-05",
                adsense_snapshot_path=root / "adsense.json",
                page_output=root / "pages.json", opportunity_output=root / "opp.json", report_output=root / "report.md",
            )

            self.assertEqual(summary["directAdsense"]["source"], "DIRECT_ADSENSE_MANAGEMENT_API_V2")
            self.assertEqual(summary["directAdsense"]["site"]["current"]["estimatedEarnings"], 18.5)
            self.assertEqual(summary["directAdsense"]["site"]["prior"]["estimatedEarnings"], 10.0)
            direct_page = next(row for row in pages["pages"] if row["url"] == url)
            missing_page = next(row for row in pages["pages"] if row["url"] == missing_url)
            self.assertEqual(direct_page["adsense"]["revenue"], 0.4)
            self.assertEqual(direct_page["adsense"]["revenueMetric"], "ESTIMATED_EARNINGS")
            self.assertEqual(direct_page["adsense"]["source"], "DIRECT_ADSENSE_PAGE_URL")
            self.assertEqual(direct_page["adsense"]["coverageStatus"], "PARTIAL")
            self.assertIsNone(missing_page["adsense"]["revenue"])
            self.assertEqual(missing_page["adsense"]["status"], "NOT_AVAILABLE")
            self.assertEqual(summary["directAdsense"]["pageUrlCoverage"]["status"], "PARTIAL")
            report = (root / "report.md").read_text(encoding="utf-8")
            self.assertIn("DIRECT_ADSENSE_SHORT_WINDOW_SIGNAL", report)
            self.assertIn("Estimated earnings are provisional", report)
            self.assertIn("GA4 site revenue (totalAdRevenue)", report)
            self.assertIn("Not allocated to URLs", report)

    def test_terminal_inconclusive_camping_experiments_release_selector_slots(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            paths = {
                name: root / f"{name}.json"
                for name in ("scores", "audit", "performance", "experiments", "history")
            }
            url = "/util/verified-search-tool.html"
            period = {"start": "2026-09-02", "end": "2026-09-29"}
            write_json(paths["scores"], {"pages": [{"url": url, "score": 75, "type": "UTILITY"}]})
            write_json(paths["audit"], {"pages": [{"url": url, "indexable": True}]})
            write_json(paths["performance"], {
                "site": {},
                "pages": [{
                    "url": url,
                    "google": {
                        "clicks": 5,
                        "impressions": 100,
                        "ctr": 0.05,
                        "position": 10,
                        "period": period,
                        "status": "VERIFIED",
                    },
                }],
            })
            write_json(paths["history"], {"pages": []})

            def registry(status, result):
                return {
                    "experiments": [
                        {
                            "experiment_id": f"EXP-CAMP-{name.upper()}-CTR-20260901",
                            "url": f"/kor/report/camp/{name}.html",
                            "status": status,
                            "result": result,
                        }
                        for name in ("nonsan", "cheorwon", "uljin")
                    ]
                }

            common = {
                "page_scores_path": paths["scores"],
                "audit_path": paths["audit"],
                "performance_path": paths["performance"],
                "experiments_path": paths["experiments"],
                "optimization_history_path": paths["history"],
                "as_of": "2026-09-30",
            }
            write_json(paths["experiments"], registry("OBSERVING", None))
            _, observing = run_revenue_growth(
                **common,
                page_output=root / "observing-pages.json",
                opportunity_output=root / "observing-opportunities.json",
                report_output=root / "observing-report.md",
            )
            self.assertEqual(observing["selectedImprovements"], [])
            self.assertEqual(sum(row["status"] == "OBSERVING" for row in observing["activeExperiments"]), 3)

            write_json(paths["experiments"], registry("INCONCLUSIVE", "INCONCLUSIVE"))
            pages, closed = run_revenue_growth(
                **common,
                page_output=root / "closed-pages.json",
                opportunity_output=root / "closed-opportunities.json",
                report_output=root / "closed-report.md",
            )
            self.assertEqual(sum(row["status"] == "OBSERVING" for row in closed["activeExperiments"]), 0)
            self.assertEqual([row["url"] for row in closed["selectedImprovements"]], [url])
            self.assertIsNone(pages["pages"][0]["ga4"]["revenue"])
            self.assertEqual(pages["pages"][0]["ga4"]["status"], "NOT_CONNECTED")

    def test_ga4_index_alias_rows_aggregate_additive_metrics_without_summing_users(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            url = "/kor/util/date-calculator/"
            period = {"start": "2026-09-02", "end": "2026-09-29"}
            ga4 = {
                "status": "VERIFIED",
                "source": "GOOGLE_ANALYTICS_DATA_API",
                "revenueMetric": "totalAdRevenue",
                "period": period,
            }
            write_json(root / "scores.json", {"pages": [{"url": url, "score": 80, "type": "UTILITY"}]})
            write_json(root / "audit.json", {"pages": [{"url": url, "indexable": True, "canonical": f"https://emfls.github.io{url}"}]})
            write_json(root / "performance.json", {
                "site": {"ga4": {"views": 6, "users": 5, **ga4}},
                "pages": [
                    {"url": url, "ga4": {"views": 4, "users": 4, "engagementSeconds": 18.0, "revenue": 0.0, **ga4}},
                    {"url": "/kor/util/date-calculator/index.html", "ga4": {"views": 2, "users": 2, "engagementSeconds": 0.0, "revenue": 0.0, **ga4}},
                ],
            })
            write_json(root / "experiments.json", {"experiments": []})
            write_json(root / "history.json", {"pages": []})

            pages, _ = run_revenue_growth(
                page_scores_path=root / "scores.json", audit_path=root / "audit.json",
                performance_path=root / "performance.json", experiments_path=root / "experiments.json",
                optimization_history_path=root / "history.json", as_of="2026-09-30",
                page_output=root / "pages.json", opportunity_output=root / "opp.json", report_output=root / "report.md",
            )

            row = next(item for item in pages["pages"] if item["url"] == url)
            self.assertEqual(row["ga4"]["views"], 6)
            self.assertEqual(row["ga4"]["engagementSeconds"], 18.0)
            self.assertEqual(row["ga4"]["revenue"], 0.0)
            self.assertIsNone(row["ga4"]["users"])
            self.assertEqual(row["ga4"]["status"], "VERIFIED")

    def test_unmatched_top30_naver_row_does_not_demote_non_camping_opportunity(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            write_json(root / "scores.json", {"pages": [{"url": "/util/tool.html", "score": 75, "type": "TRAFFIC"}]})
            write_json(root / "audit.json", {"pages": [{"url": "/util/tool.html", "indexable": True}]})
            write_json(root / "performance.json", {"site": {}, "pages": [{"url": "/util/tool.html", "google": {"clicks": 20, "impressions": 100, "ctr": 0.2, "position": 5, "status": "VERIFIED", "period": {"start": "2026-08-19", "end": "2026-09-15"}}}]})
            write_json(root / "experiments.json", {"experiments": []})
            write_json(root / "history.json", {"pages": []})
            write_json(root / "naver.json", {"source": "NAVER_SEARCH_ADVISOR_UI_TOP_30", "periodPreset": "RECENT_30_DAYS", "period": {"start": "2026-08-19", "end": "2026-09-17"}, "dataUpdatedAt": "2026-09-17", "rows": []})
            pages, _ = run_revenue_growth(page_scores_path=root / "scores.json", audit_path=root / "audit.json", performance_path=root / "performance.json", experiments_path=root / "experiments.json", optimization_history_path=root / "history.json", naver_snapshot_path=root / "naver.json", as_of="2026-09-18", page_output=root / "pages.json", opportunity_output=root / "opp.json", report_output=root / "report.md")
            self.assertNotEqual(pages["pages"][0]["classification"], "EXPERIMENT")

    def test_stale_naver_is_preserved_but_does_not_demote_fresh_search_opportunity(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            paths = {name: root / f"{name}.json" for name in ("scores", "audit", "performance", "experiments", "history", "naver")}
            write_json(paths["scores"], {"pages": [{"url": "/kor/report/camp/opportunity.html", "score": 75, "type": "TRAFFIC"}]})
            write_json(paths["audit"], {"pages": [{"url": "/kor/report/camp/opportunity.html", "indexable": True}]})
            write_json(paths["performance"], {"site": {}, "pages": [{"url": "/kor/report/camp/opportunity.html", "google": {"clicks": 20, "impressions": 100, "ctr": 0.2, "position": 5, "status": "VERIFIED", "period": {"start": "2026-08-19", "end": "2026-09-15"}}}]})
            write_json(paths["experiments"], {"experiments": []})
            write_json(paths["history"], {"pages": []})
            write_json(paths["naver"], {"period": {"start": "2026-08-01", "end": "2026-08-30"}, "periodPreset": "RECENT_30_DAYS", "dataUpdatedAt": "2026-08-30", "source": "NAVER_SEARCH_ADVISOR_UI_TOP_30", "rows": [{"sourceUrl": "https://emfls.github.io/kor/report/camp/opportunity.html", "clicks": 5, "impressions": 100, "ctr": 0.05, "averageRank": None, "rankStatus": "NOT_AVAILABLE", "status": "VERIFIED"}]})
            pages, summary = run_revenue_growth(page_scores_path=paths["scores"], audit_path=paths["audit"], performance_path=paths["performance"], experiments_path=paths["experiments"], optimization_history_path=paths["history"], naver_snapshot_path=paths["naver"], as_of="2026-09-18", page_output=root / "pages.json", opportunity_output=root / "opportunities.json", report_output=root / "report.md")
            row = pages["pages"][0]
            self.assertEqual(row["naver"]["status"], "STALE_DATA")
            self.assertEqual(row["naver"]["clicks"], 5)
            self.assertNotEqual(row["classification"], "EXPERIMENT")
    def test_period_alignment_distinguishes_match_offset_overlap_and_non_overlap(self):
        self.assertEqual(period_alignment({"start": "2026-08-01", "end": "2026-08-28"}, {"start": "2026-08-01", "end": "2026-08-28"}), "MATCH")
        self.assertEqual(period_alignment({"start": "2026-08-20", "end": "2026-09-16"}, {"start": "2026-08-19", "end": "2026-09-15"}), "ONE_DAY_OFFSET")
        self.assertEqual(period_alignment({"start": "2026-08-20", "end": "2026-09-16"}, {"start": "2026-08-25", "end": "2026-09-10"}), "OVERLAP")
        self.assertEqual(period_alignment({"start": "2026-08-01", "end": "2026-08-10"}, {"start": "2026-08-11", "end": "2026-08-20"}), "NON_OVERLAP")
        self.assertEqual(period_alignment({}, {"start": "2026-08-11", "end": "2026-08-20"}), "MISSING")

    def test_gsc_snapshot_propagates_verified_google_metrics_without_erasing_ga4(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            common = {
                "pages": [{"url": "/a.html", "score": 70, "type": "TRAFFIC"}],
            }
            write_json(root / "scores.json", common)
            write_json(root / "audit.json", {"pages": [{"url": "/a.html", "indexable": True}]})
            write_json(root / "performance.json", {"site": {"ga4": {"views": 3, "users": 2, "status": "VERIFIED", "period": {"start": "2026-08-20", "end": "2026-09-16"}}}, "pages": [{"url": "/a.html", "ga4": {"views": 3, "users": 2, "status": "VERIFIED", "period": {"start": "2026-08-20", "end": "2026-09-16"}}}]})
            write_json(root / "gsc.json", {"status": "VERIFIED", "pages": [{"url": "/a.html", "google": {"clicks": 4, "impressions": 20, "ctr": 0.2, "position": 5, "status": "VERIFIED", "period": {"start": "2026-08-20", "end": "2026-09-16"}, "source": "GOOGLE_SEARCH_CONSOLE_API"}}]})
            write_json(root / "experiments.json", {"experiments": []})
            write_json(root / "history.json", {"pages": []})
            pages, _ = run_revenue_growth(page_scores_path=root / "scores.json", audit_path=root / "audit.json", performance_path=root / "performance.json", gsc_snapshot_path=root / "gsc.json", experiments_path=root / "experiments.json", optimization_history_path=root / "history.json", as_of="2026-09-17", page_output=root / "out.json", opportunity_output=root / "opp.json", report_output=root / "report.md")
            self.assertEqual(pages["pages"][0]["google"]["status"], "VERIFIED")
            self.assertEqual(pages["pages"][0]["google"]["clicks"], 4)
            self.assertEqual(pages["pages"][0]["ga4"]["views"], 3)

    def test_content_growth_uses_only_mature_launches_for_win_rate(self):
        rows = [
            {"type": "CONTENT_LAUNCH_EXPERIMENT", "publishedOn": "2026-07-01", "status": "COMPLETE", "result": "WINNER", "revenue": None},
            {"type": "CONTENT_LAUNCH_EXPERIMENT", "publishedOn": "2026-07-02", "status": "COMPLETE", "result": "FAILED", "revenue": None},
            {"type": "CONTENT_LAUNCH_EXPERIMENT", "publishedOn": "2026-08-25", "status": "OBSERVING", "result": None, "revenue": None},
        ]
        result = content_growth_summary(rows, "2026-09-01")
        self.assertEqual(result["activeExperiments"], 1)
        self.assertEqual(result["matureCohort"], 2)
        self.assertEqual(result["newPageWinRate"], 0.5)
        self.assertIsNone(result["revenuePerNewPage"])
        self.assertEqual(result["revenuePerNewPageStatus"], "INSUFFICIENT_DATA")
    def test_verified_naver_snapshot_drives_only_eligible_camping_candidates(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            urls = [
                "/kor/report/camp/winner.html",
                "/kor/report/camp/opportunity.html",
                "/kor/report/camp/cooldown.html",
                "/kor/report/camp/low-demand.html",
            ]
            paths = {name: root / f"{name}.json" for name in ("scores", "audit", "performance", "experiments", "history", "naver")}
            write_json(paths["scores"], {"pages": [{"url": url, "score": 20 if "winner" in url else 75, "type": "TRAFFIC"} for url in urls]})
            write_json(paths["audit"], {"pages": [{"url": url, "indexable": True, "duplicate": False} for url in urls]})
            period = {"start": "2026-08-03", "end": "2026-08-30"}
            write_json(paths["performance"], {"site": {"ga4": {"views": 100, "users": 80, "period": period, "status": "VERIFIED"}}, "pages": [{"url": urls[0], "ga4": {"views": 10, "users": 8, "revenue": 0.5, "revenueMetric": "totalAdRevenue", "period": period, "status": "VERIFIED"}}]})
            write_json(paths["experiments"], {"experiments": []})
            write_json(paths["history"], {"pages": [{"url": urls[2], "lastOptimizationDate": "2026-08-25"}]})
            naver_rows = [
                (urls[0], 100, 1000, 0.10),
                (urls[1], 24, 600, 0.04),
                (urls[2], 30, 600, 0.05),
                (urls[3], 10, 100, 0.10),
            ]
            write_json(paths["naver"], {"source": "NAVER_SEARCH_ADVISOR_UI_TOP_30", "periodPreset": "RECENT_30_DAYS", "period": {"start": "2026-08-01", "end": "2026-08-30"}, "dataUpdatedAt": "2026-08-30", "limitations": ["TOP_30_ONLY", "AVERAGE_RANK_NOT_AVAILABLE"], "rows": [{"sourceUrl": f"https://emfls.github.io{url}", "clicks": clicks, "impressions": impressions, "ctr": ctr, "averageRank": None, "rankStatus": "NOT_AVAILABLE", "status": "VERIFIED"} for url, clicks, impressions, ctr in naver_rows]})

            pages, summary = run_revenue_growth(
                page_scores_path=paths["scores"], audit_path=paths["audit"], performance_path=paths["performance"],
                experiments_path=paths["experiments"], optimization_history_path=paths["history"], naver_snapshot_path=paths["naver"],
                as_of="2026-08-31", page_output=root / "pages.json", opportunity_output=root / "opportunities.json", report_output=root / "report.md",
            )

            self.assertTrue(summary["dataQuality"]["naver"]["gatePassed"])
            self.assertEqual(summary["crossSourcePeriodAlignment"], "PERIOD_MISMATCH")
            self.assertEqual([row["url"] for row in summary["eligibleCandidates"]], [urls[1]])
            self.assertEqual(summary["contentChanges"], [])
            winner = next(row for row in pages["pages"] if row["url"] == urls[0])
            low_demand = next(row for row in pages["pages"] if row["url"] == urls[3])
            self.assertEqual((winner["classification"], winner["nextAction"]), ("WINNER", "PROTECT"))
            self.assertEqual(winner["ga4"]["revenueMetric"], "totalAdRevenue")
            self.assertNotEqual(low_demand["classification"], "OPPORTUNITY")
            self.assertEqual(winner["naver"]["positionStatus"], "NOT_AVAILABLE")
            report = (root / "report.md").read_text(encoding="utf-8")
            self.assertIn("Naver URL Data Quality", report)
            self.assertIn("URL match: 4/4 (100.0%)", report)
            self.assertIn("Rank: N/A", report)
            self.assertIn("이번 콘텐츠 실제 수정: 0페이지", report)

    def test_pipeline_protects_selects_and_preserves_missing_values(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            page_scores = root / "page-scores.json"
            audit = root / "site-audit.json"
            performance = root / "performance.json"
            experiments = root / "experiments.json"
            optimization_history = root / "optimization-history.json"
            page_output = root / "page-performance.json"
            opportunity_output = root / "revenue-opportunities.json"
            report_output = root / "revenue-growth-report.md"
            urls = [
                "/winner.html",
                "/kor/report/camp/opportunity.html",
                "/kor/report/camp/cooldown.html",
                "/missing.html",
            ]
            write_json(
                page_scores,
                {
                    "pages": [
                        {"url": url, "score": 30 if url == "/winner.html" else 75, "type": "TRAFFIC"}
                        for url in urls
                    ]
                },
            )
            write_json(
                audit,
                {
                    "pages": [
                        {"url": url, "indexable": True, "internal_links": 2, "duplicate": False}
                        for url in urls
                    ]
                },
            )
            period = {"start": "2026-08-03", "end": "2026-08-30"}
            write_json(
                performance,
                {
                    "as_of": "2026-08-31",
                    "site": {
                        "adsense": {"revenue_28d": 13.88, "period": period, "status": "VERIFIED"},
                        "ga4": {"views": 8090, "users": 6035, "revenue": 14.02, "revenueMetric": "totalAdRevenue", "period": period, "status": "VERIFIED"},
                    },
                    "pages": [
                        {"url": "/winner.html", "ga4": {"views": 143, "users": 117, "engagementSeconds": 71, "revenue": 0.88, "revenueMetric": "totalAdRevenue", "period": period, "status": "VERIFIED"}},
                        {"url": "/kor/report/camp/opportunity.html", "naver": {"impressions": 18000, "clicks": 180, "ctr": 0.01, "position": 18, "period": period, "status": "VERIFIED"}},
                        {"url": "/kor/report/camp/cooldown.html", "naver": {"impressions": 17000, "clicks": 170, "ctr": 0.01, "position": 19, "period": period, "status": "VERIFIED"}},
                    ],
                },
            )
            write_json(experiments, {"schema_version": 1, "experiments": []})
            write_json(
                optimization_history,
                {"pages": [{"url": "/kor/report/camp/cooldown.html", "lastOptimizationDate": "2026-08-25"}]},
            )

            kwargs = dict(
                page_scores_path=page_scores,
                audit_path=audit,
                performance_path=performance,
                experiments_path=experiments,
                optimization_history_path=optimization_history,
                as_of="2026-08-31",
                page_output=page_output,
                opportunity_output=opportunity_output,
                report_output=report_output,
            )
            pages, summary = run_revenue_growth(**kwargs)
            first_page_bytes = page_output.read_bytes()
            first_summary_bytes = opportunity_output.read_bytes()
            run_revenue_growth(**kwargs)

            self.assertEqual(pages["summary"]["evaluatedIndexablePages"], 4)
            self.assertEqual(len(summary["topOpportunities"]), 4)
            self.assertEqual(
                [row["url"] for row in summary["selectedImprovements"]],
                ["/kor/report/camp/opportunity.html"],
            )
            missing = next(row for row in pages["pages"] if row["url"] == "/missing.html")
            winner = next(row for row in pages["pages"] if row["url"] == "/winner.html")
            cooldown = next(row for row in pages["pages"] if row["url"] == "/kor/report/camp/cooldown.html")
            self.assertIsNone(missing["adsense"]["revenue"])
            self.assertEqual(winner["nextAction"], "PROTECT")
            self.assertTrue(cooldown["cooldown"])
            self.assertEqual(page_output.read_bytes(), first_page_bytes)
            self.assertEqual(opportunity_output.read_bytes(), first_summary_bytes)
            self.assertIn("이번 실행 실제 콘텐츠 수정", report_output.read_text(encoding="utf-8"))
            self.assertEqual(summary["revenue"]["twentyEightDays"], 13.88)
            self.assertEqual(summary["traffic"]["views"], 8090)
            self.assertEqual(summary["classificationCounts"]["INSUFFICIENT_DATA"], 1)

    def test_mismatched_periods_are_not_combined(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            inputs = {
                "page_scores_path": root / "page-scores.json",
                "audit_path": root / "site-audit.json",
                "performance_path": root / "performance.json",
                "experiments_path": root / "experiments.json",
                "optimization_history_path": root / "history.json",
            }
            write_json(inputs["page_scores_path"], {"pages": [{"url": "/a.html", "score": 80, "type": "TRAFFIC"}]})
            write_json(inputs["audit_path"], {"pages": [{"url": "/a.html", "indexable": True}]})
            write_json(inputs["experiments_path"], {"experiments": []})
            write_json(inputs["optimization_history_path"], {"pages": []})
            write_json(
                inputs["performance_path"],
                {
                    "site": {
                        "google": {"clicks": 49, "period": {"start": "2026-08-03", "end": "2026-08-30"}, "status": "VERIFIED"},
                        "ga4": {"views": 8090, "users": 6035, "period": {"start": "2026-08-01", "end": "2026-08-28"}, "status": "VERIFIED"},
                    },
                    "pages": [],
                },
            )

            _, summary = run_revenue_growth(
                **inputs,
                as_of="2026-08-31",
                page_output=root / "page-output.json",
                opportunity_output=root / "opportunity-output.json",
                report_output=root / "report.md",
            )

            self.assertEqual(summary["periodCompatibility"], "MISMATCH")
            self.assertIsNone(summary["kpis"]["combinedSearchRevenue"]["value"])


if __name__ == "__main__":
    unittest.main()
