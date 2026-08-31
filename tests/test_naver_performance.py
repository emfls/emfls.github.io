import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from scripts.naver_performance import (
    build_naver_quality_report,
    load_naver_snapshot,
    match_naver_rows,
    normalize_naver_url,
    validate_naver_row,
)


def verified_row(url, clicks, impressions, ctr=None):
    return {
        "sourceUrl": url,
        "clicks": clicks,
        "impressions": impressions,
        "ctr": ctr if ctr is not None else round(clicks / impressions, 3) if impressions else 0,
        "averageRank": None,
        "rankStatus": "NOT_AVAILABLE",
        "status": "VERIFIED",
    }


def snapshot_with_rows(rows):
    return {
        "source": "NAVER_SEARCH_ADVISOR_UI_TOP_30",
        "periodPreset": "RECENT_30_DAYS",
        "period": {"start": "2026-08-01", "end": "2026-08-30"},
        "dataUpdatedAt": "2026-08-30",
        "rows": rows,
    }


class NaverUrlNormalizationTest(unittest.TestCase):
    def test_removes_origin_query_fragment_and_index(self):
        self.assertEqual(
            normalize_naver_url("https://www.emfls.github.io/kor/report/camp/index.html?x=1#top"),
            "/kor/report/camp/",
        )

    def test_decodes_utf8_once_and_preserves_case(self):
        self.assertEqual(
            normalize_naver_url("https://emfls.github.io/%ED%95%9C%EA%B8%80/A.html"),
            "/한글/A.html",
        )


class NaverRowValidationTest(unittest.TestCase):
    def test_rejects_ctr_that_disagrees_with_visible_click_ratio(self):
        errors = validate_naver_row(
            verified_row("https://emfls.github.io/a.html", 10, 100, ctr=0.05)
        )
        self.assertIn("CTR_MISMATCH", errors)

    def test_accepts_search_advisor_one_decimal_percent_rounding(self):
        errors = validate_naver_row(
            verified_row("https://emfls.github.io/a.html", 138, 1816, ctr=0.076)
        )
        self.assertEqual(errors, [])

    def test_zero_impressions_requires_zero_clicks_and_ctr(self):
        errors = validate_naver_row(
            verified_row("https://emfls.github.io/a.html", 1, 0, ctr=0)
        )
        self.assertIn("CLICKS_WITHOUT_IMPRESSIONS", errors)


class NaverMatchingQualityTest(unittest.TestCase):
    def test_duplicate_normalized_urls_block_quality_gate(self):
        result = match_naver_rows(
            snapshot_with_rows(
                [
                    verified_row("https://emfls.github.io/a.html", 10, 100),
                    verified_row("https://emfls.github.io/a.html?ref=x", 10, 100),
                ]
            ),
            ["/a.html"],
        )
        self.assertEqual(result["quality"]["duplicateNormalizedUrls"], ["/a.html"])
        self.assertFalse(result["quality"]["gatePassed"])

    def test_match_rate_below_95_percent_blocks_quality_gate(self):
        rows = [
            verified_row(f"https://emfls.github.io/p-{index}.html", 1, 10)
            for index in range(20)
        ]
        result = match_naver_rows(
            snapshot_with_rows(rows),
            [f"/p-{index}.html" for index in range(18)],
        )
        self.assertEqual(result["quality"]["matchRate"], 0.9)
        self.assertFalse(result["quality"]["gatePassed"])

    def test_canonical_map_resolves_an_exact_normalized_source(self):
        result = match_naver_rows(
            snapshot_with_rows(
                [verified_row("https://emfls.github.io/old/index.html", 2, 20)]
            ),
            ["/new/"],
            canonical_map={"/old/": "/new/"},
        )
        self.assertEqual(result["quality"]["matched"], 1)
        self.assertIn("/new/", result["matchedByUrl"])


class CheckedInNaverSnapshotTest(unittest.TestCase):
    def test_contains_exactly_30_verified_ui_rows(self):
        snapshot = load_naver_snapshot(
            Path("data/naver/search-advisor-2026-08-30.json")
        )
        self.assertEqual(len(snapshot["rows"]), 30)
        self.assertEqual(snapshot["source"], "NAVER_SEARCH_ADVISOR_UI_TOP_30")
        self.assertEqual(
            snapshot["period"], {"start": "2026-08-01", "end": "2026-08-30"}
        )
        first = snapshot["rows"][0]
        self.assertTrue(first["sourceUrl"].endswith("/kor/report/camp/gyeonggi-best.html"))
        self.assertEqual((first["clicks"], first["impressions"], first["ctr"]), (138, 1816, 0.076))
        self.assertIsNone(first["averageRank"])
        self.assertEqual(first["rankStatus"], "NOT_AVAILABLE")

    def test_real_snapshot_matches_site_inventory_and_reports_limits(self):
        site_urls = [
            row["url"]
            for row in json.loads(Path("data/page-scores.json").read_text())["pages"]
        ]
        result, markdown = build_naver_quality_report(
            Path("data/naver/search-advisor-2026-08-30.json"), site_urls
        )
        self.assertGreaterEqual(result["quality"]["matchRate"], 0.95)
        self.assertTrue(result["quality"]["gatePassed"])
        self.assertEqual(result["quality"]["rankAvailability"], "NOT_AVAILABLE")
        self.assertIn("PERIOD_MISMATCH", markdown)
        self.assertIn("TOP_30_ONLY", markdown)

    def test_quality_report_does_not_label_uncovered_urls_as_zero(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "snapshot.json"
            path.write_text(json.dumps(snapshot_with_rows([verified_row("https://emfls.github.io/a.html", 1, 10)])))
            _, markdown = build_naver_quality_report(path, ["/a.html", "/not-in-top-30.html"])
        self.assertNotIn("/not-in-top-30.html: 0", markdown)
        self.assertIn("TOP 30 밖 사이트 URL은 NOT_AVAILABLE", markdown)

    def test_cli_writes_report_and_returns_nonzero_when_gate_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            snapshot = root / "snapshot.json"
            scores = root / "scores.json"
            report = root / "report.md"
            snapshot.write_text(json.dumps(snapshot_with_rows([verified_row("https://emfls.github.io/missing.html", 1, 10)])))
            scores.write_text(json.dumps({"pages": [{"url": "/known.html"}]}))
            completed = subprocess.run(
                ["python3", "scripts/naver_performance.py", "--snapshot", str(snapshot), "--page-scores", str(scores), "--report", str(report)],
                capture_output=True,
                text=True,
            )
        self.assertEqual(completed.returncode, 2)
        self.assertIn("Quality gate: FAIL", report.read_text() if report.exists() else completed.stdout)


if __name__ == "__main__":
    unittest.main()
