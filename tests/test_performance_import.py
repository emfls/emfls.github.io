import csv
import io
import tempfile
import unittest
import zipfile
from pathlib import Path

from scripts.import_performance_csv import import_gsc_zip, import_ga4_landing_pages, merge_performance


class PerformanceImportTests(unittest.TestCase):
    def test_imports_gsc_pages_by_header_and_finds_striking_distance(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "gsc.zip"
            with zipfile.ZipFile(archive, "w") as output:
                output.writestr("페이지.csv", "인기 페이지,클릭수,노출,CTR,게재 순위\nhttps://emfls.github.io/a.html,10,1000,1%,8\n")
                output.writestr("차트.csv", "날짜,클릭수,노출,CTR,게재 순위\n2026-05-01,1,10,10%,8\n2026-07-31,2,20,10%,7\n")
            result = import_gsc_zip(archive)
        self.assertEqual(result["period"], {"start": "2026-05-01", "end": "2026-07-31"})
        self.assertEqual(result["pages"][0]["url"], "/a.html")
        self.assertTrue(result["pages"][0]["striking_distance"])
        self.assertGreater(result["pages"][0]["opportunity_score"], 0)

    def test_ga4_comments_and_not_set_rows_are_handled(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "ga.csv"
            source.write_text(
                "# 시작일: 20260704\n# 종료일: 20260731\n"
                "방문 페이지,세션수,활성 사용자,새 사용자 수,세션당 평균 참여 시간,주요 이벤트,총수익,세션 주요 이벤트 비율\n"
                "/a.html,20,10,8,30,0,0,0\n(not set),99,1,0,1,0,0,0\n",
                encoding="utf-8",
            )
            result = import_ga4_landing_pages(source)
        self.assertEqual(result["period"], {"start": "2026-07-04", "end": "2026-07-31"})
        self.assertEqual(len(result["pages"]), 1)
        self.assertEqual(result["pages"][0]["sessions"], 20)
        self.assertEqual(result["missing_url_rows"], 1)
        self.assertEqual(result["duplicate_urls"], [])

    def test_merge_keeps_missing_sources_explicit(self):
        gsc = {"pages": [{"url": "/a", "clicks": 2, "impressions": 20, "ctr": 0.1, "position": 8, "striking_distance": True, "opportunity_score": 1.2}]}
        ga4 = {"pages": [{"url": "/b", "sessions": 5, "active_users": 4, "engagement_seconds": 12}]}
        result = merge_performance(gsc, ga4)
        self.assertEqual([row["url"] for row in result], ["/a", "/b"])
        self.assertIsNone(result[0]["sessions"])
        self.assertIsNone(result[1]["organic_clicks"])


if __name__ == "__main__":
    unittest.main()
