import json
import urllib.parse
import unittest
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import Mock
from urllib.error import HTTPError

from scripts.keyword_hunter_api import Client, search_ads_hint
from scripts.keyword_hunter_core import DEFAULT_CONFIG
from scripts.keyword_hunter_quota import DataLabUsage
from scripts.keyword_hunter_targeted import parse_targets, run_targeted


KST = timezone(timedelta(hours=9))
RUN_AT = datetime(2026, 10, 4, 12, 0, tzinfo=KST)
TARGETS = [
    "CSV 인코딩 변환",
    "JSON 구조 비교",
    "EXIF 메타데이터 제거",
    "PDF 페이지 번호 삽입",
    "SHA-256 파일 체크섬",
]
ENV = {
    "NAVER_SEARCHAD_API_KEY": "test-searchads-key",
    "NAVER_SEARCHAD_SECRET_KEY": "test-searchads-secret",
    "NAVER_SEARCHAD_CUSTOMER_ID": "123456",
    "NAVER_API_HUB_CLIENT_ID": "test-hub-id",
    "NAVER_API_HUB_CLIENT_SECRET": "test-hub-secret",
    "NAVER_WEB_SEARCH_API_HUB_CLIENT_ID": "test-web-id",
    "NAVER_WEB_SEARCH_API_HUB_CLIENT_SECRET": "test-web-secret",
}


def _trend_points():
    end = RUN_AT.date() - timedelta(days=1)
    return [
        {"period": (end - timedelta(days=offset)).isoformat(), "ratio": 2 if offset < 30 else 1}
        for offset in range(120)
    ]


def _client(root, transport):
    usage = DataLabUsage(root, now=lambda: RUN_AT)
    return Client(
        dict(DEFAULT_CONFIG, request_interval=0, retries=0),
        env=ENV,
        transport=transport,
        sleep=Mock(),
        usage_tracker=usage,
    )


class TargetInputTests(unittest.TestCase):
    def test_accepts_one_to_five_json_or_newline_targets_without_rewriting_them(self):
        self.assertEqual(parse_targets('["JSON 구조 비교"]'), ["JSON 구조 비교"])
        self.assertEqual(parse_targets("CSV 인코딩 변환\nSHA-256 파일 체크섬"), [
            "CSV 인코딩 변환", "SHA-256 파일 체크섬"
        ])
        self.assertEqual(parse_targets(json.dumps(TARGETS, ensure_ascii=False)), TARGETS)

    def test_rejects_more_than_five_targets(self):
        with self.assertRaisesRegex(ValueError, "1..5"):
            parse_targets(json.dumps(TARGETS + ["여섯 번째"]))

    def test_rejects_empty_or_non_string_targets(self):
        for raw in ("", "[]", '[""]', '["   "]', '["ok", null]'):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                parse_targets(raw)

    def test_rejects_duplicate_normalized_targets(self):
        with self.assertRaisesRegex(ValueError, "duplicate"):
            parse_targets('["JSON 구조 비교", "json-구조 비교"]')

    def test_rejects_control_characters_and_overlong_keywords(self):
        for raw in ('["JSON\\u0000비교"]', json.dumps(["가" * 101], ensure_ascii=False)):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                parse_targets(raw)


class TargetMeasurementTests(unittest.TestCase):
    def setUp(self):
        self.temporary = TemporaryDirectory()
        self.root = Path(self.temporary.name)

    def tearDown(self):
        self.temporary.cleanup()

    def _transport(self, *, exact_first=True, censored_first=False, seen=None):
        seen = seen if seen is not None else []
        by_hint = {search_ads_hint(target): target for target in TARGETS}

        def respond(request):
            seen.append(request)
            parsed = urllib.parse.urlparse(request.full_url)
            if parsed.path == "/keywordstool":
                hint = urllib.parse.parse_qs(parsed.query)["hintKeywords"][0]
                target = by_hint[hint]
                rows = []
                if exact_first and target == TARGETS[0]:
                    rows.append({
                        "relKeyword": target,
                        "monthlyPcQcCnt": "< 10" if censored_first else 40,
                        "monthlyMobileQcCnt": 25 if censored_first else 80,
                        "compIdx": "LOW",
                    })
                rows.append({
                    "relKeyword": target + " 관련어",
                    "monthlyPcQcCnt": 900,
                    "monthlyMobileQcCnt": 1100,
                    "compIdx": "HIGH",
                })
                return json.dumps({"keywordList": rows}, ensure_ascii=False).encode()
            if parsed.path == "/search-trend/v1/search":
                groups = json.loads(request.data)["keywordGroups"]
                return json.dumps({"results": [
                    {"title": group["groupName"], "keywords": group["keywords"], "data": _trend_points()}
                    for group in groups
                ]}, ensure_ascii=False).encode()
            if parsed.path == "/search/v1/webkr":
                return b'{"total":123,"items":[]}'
            raise AssertionError("unexpected API path: " + parsed.path)

        return respond

    def test_collection_calls_only_the_five_explicit_targets_and_writes_separate_sidecars(self):
        seen = []
        protected = [
            "data/keywords_master.csv",
            "data/keyword_seeds.json",
            "data/keyword_clusters.json",
            "data/rejected_keywords.json",
            "data/published_keywords.json",
            "data/content-launch-queue.json",
            "data/content-launch-manifest.json",
            "data/content-launch-counter.json",
            "data/content-launch-decisions.json",
        ]
        before = {}
        for relative in protected:
            path = self.root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("protected:" + relative, encoding="utf-8")
            before[relative] = path.read_bytes()

        result = run_targeted(
            self.root,
            json.dumps(TARGETS, ensure_ascii=False),
            client=_client(self.root, self._transport(seen=seen)),
            run_at=RUN_AT,
        )

        self.assertEqual(result["status"], "VERIFIED")
        self.assertEqual([row["keyword"] for row in result["targets"]], TARGETS)
        search_requests = [request for request in seen if "/keywordstool?" in request.full_url]
        trend_requests = [request for request in seen if "/search-trend/v1/search" in request.full_url]
        web_requests = [request for request in seen if "/search/v1/webkr?" in request.full_url]
        self.assertEqual(len(search_requests), 5)
        self.assertEqual(len(trend_requests), 1)
        self.assertEqual(len(web_requests), 5)
        hints = [urllib.parse.parse_qs(urllib.parse.urlparse(request.full_url).query)["hintKeywords"][0]
                 for request in search_requests]
        self.assertEqual(hints, [search_ads_hint(target) for target in TARGETS])
        self.assertEqual(result["targets"][0]["searchAds"]["monthlyTotal"], 120)
        self.assertEqual(result["targets"][0]["searchAds"]["source"], "NAVER_SEARCH_ADS")
        self.assertEqual(result["targets"][0]["searchAds"]["unit"], "MONTHLY_SEARCHES")
        self.assertEqual(result["targets"][0]["searchAds"]["checkedAt"], RUN_AT.isoformat(timespec="seconds"))
        self.assertEqual(result["targets"][1]["searchAds"]["status"], "TARGET_ROW_NOT_RETURNED")
        self.assertIsNone(result["targets"][1]["searchAds"]["monthlyTotal"])
        self.assertEqual(result["targets"][1]["searchAds"]["relatedRows"][0]["monthlyTotal"], 2000)
        self.assertEqual(result["targets"][0]["dataLab"]["trend1m"], 100.0)
        self.assertEqual(result["targets"][0]["dataLab"]["metricType"], "RELATIVE_INTEREST_CHANGE_PERCENT")
        self.assertEqual(result["targets"][0]["dataLab"]["source"], "NAVER_DATALAB")
        self.assertEqual(result["targets"][0]["dataLab"]["checkedAt"], RUN_AT.isoformat(timespec="seconds"))
        self.assertNotIn("monthlyVolume", result["targets"][0]["dataLab"])
        self.assertEqual(result["targets"][0]["webSearch"]["resultCount"], 123)
        self.assertEqual(result["targets"][0]["webSearch"]["metricType"], "WEB_RESULT_COUNT_NOT_DEMAND")
        self.assertEqual(result["targets"][0]["webSearch"]["source"], "NAVER_WEB_SEARCH")
        self.assertEqual(result["targets"][0]["webSearch"]["checkedAt"], RUN_AT.isoformat(timespec="seconds"))
        for relative in protected:
            self.assertEqual((self.root / relative).read_bytes(), before[relative])
        self.assertTrue((self.root / "data/keyword-targeted-validation/latest.json").exists())
        self.assertTrue(list((self.root / "reports/keyword-targeted-validation").glob("*.json")))
        self.assertTrue((self.root / "data/api_usage.json").exists())

    def test_related_search_ads_volume_is_never_assigned_to_missing_exact_target(self):
        result = run_targeted(
            self.root,
            json.dumps(TARGETS, ensure_ascii=False),
            client=_client(self.root, self._transport(exact_first=False)),
            run_at=RUN_AT,
        )
        for target in result["targets"]:
            self.assertFalse(target["searchAds"]["exactTargetReturned"])
            self.assertEqual(target["searchAds"]["status"], "TARGET_ROW_NOT_RETURNED")
            self.assertIsNone(target["searchAds"]["monthlyPc"])
            self.assertIsNone(target["searchAds"]["monthlyMobile"])
            self.assertIsNone(target["searchAds"]["monthlyTotal"])
            self.assertTrue(target["searchAds"]["relatedRows"])

    def test_censored_under_ten_stays_censored_and_total_is_not_fabricated(self):
        result = run_targeted(
            self.root,
            json.dumps(TARGETS, ensure_ascii=False),
            client=_client(self.root, self._transport(censored_first=True)),
            run_at=RUN_AT,
        )
        ads = result["targets"][0]["searchAds"]
        self.assertTrue(ads["exactTargetReturned"])
        self.assertIsNone(ads["monthlyPc"])
        self.assertEqual(ads["monthlyMobile"], 25)
        self.assertIsNone(ads["monthlyTotal"])
        self.assertEqual(ads["volumeNote"], "LOWER_BOUND_CENSORED")

    def test_api_partial_failure_keeps_last_good_latest_sidecar_and_redacts_transport_detail(self):
        latest = self.root / "data/keyword-targeted-validation/latest.json"
        latest.parent.mkdir(parents=True)
        original = b'{"lastGood":true}\n'
        latest.write_bytes(original)
        secret_echo = "PRIVATE-HEADER-SHOULD-NEVER-APPEAR"

        def fail_search_ads(request):
            if "/keywordstool" in request.full_url:
                raise HTTPError(request.full_url, 401, secret_echo, {}, None)
            return self._transport()(request)

        result = run_targeted(
            self.root,
            json.dumps(TARGETS, ensure_ascii=False),
            client=_client(self.root, fail_search_ads),
            run_at=RUN_AT,
        )

        self.assertEqual(result["status"], "PARTIAL")
        self.assertEqual(latest.read_bytes(), original)
        reports = list((self.root / "reports/keyword-targeted-validation").glob("*.json"))
        self.assertEqual(len(reports), 1)
        report_text = reports[0].read_text(encoding="utf-8")
        self.assertNotIn(secret_echo, report_text)
        self.assertIn("HTTP_401", report_text)


if __name__ == "__main__":
    unittest.main()
