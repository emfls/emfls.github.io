import json
import tempfile
import unittest
from pathlib import Path

from scripts.revenue_growth import run_revenue_growth


def write_json(path, payload):
    path.write_text(json.dumps(payload), encoding="utf-8")


class RevenueGrowthIntegrationTest(unittest.TestCase):
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
            write_json(paths["performance"], {"site": {"ga4": {"views": 100, "users": 80, "period": period, "status": "VERIFIED"}}, "pages": [{"url": urls[0], "ga4": {"views": 10, "users": 8, "revenue": 0.5, "period": period, "status": "VERIFIED"}}]})
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
                        "ga4": {"views": 8090, "users": 6035, "revenue": 14.02, "period": period, "status": "VERIFIED"},
                    },
                    "pages": [
                        {"url": "/winner.html", "ga4": {"views": 143, "users": 117, "engagementSeconds": 71, "revenue": 0.88, "period": period, "status": "VERIFIED"}},
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
