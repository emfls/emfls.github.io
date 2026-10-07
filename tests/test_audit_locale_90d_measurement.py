import importlib.util
import json
import sys
import os
import subprocess
import tempfile
import types
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

import yaml

ROOT = Path(__file__).resolve().parents[1]
AUDIT_PATH = ROOT / "scripts" / "audit_locale_90d_measurement.py"
WORKFLOW_PATH = ROOT / ".github" / "workflows" / "ga4-collection.yml"


def load_audit(test_case):
    test_case.assertTrue(AUDIT_PATH.is_file(), "audit collector is not implemented yet")
    spec = importlib.util.spec_from_file_location("audit_locale_90d_measurement", AUDIT_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ga4_row(path, values):
    return {
        "dimensionValues": [{"value": path}],
        "metricValues": [{"value": str(value)} for value in values],
    }


def ga4_metadata(**overrides):
    result = {
        "currencyCode": "KRW",
        "timeZone": "Asia/Seoul",
        "subjectToThresholding": False,
        "dataLossFromOtherRow": False,
        "samplingMetadatas": [],
    }
    result.update(overrides)
    return result


def ga4_response(row_count, rows, metadata=None):
    return SimpleNamespace(row_count=row_count, rows=rows, metadata=ga4_metadata() if metadata is None else metadata)


def gsc_row(url, clicks=0, impressions=0, position=0.0):
    return {"keys": [url], "clicks": clicks, "impressions": impressions, "ctr": 0.0, "position": position}


def clean_dependencies():
    return {
        "cross_locale_inbound_html": 0,
        "same_locale_inbound_html": 0,
        "code_references": [],
        "sitemap_files": ["id/sitemap.xml"],
        "feed_files": [],
        "index_files": [],
        "cleanup_straightforward": True,
        "unique_value_hold": False,
        "content_signals": {
            "textTokenCount": 30,
            "templateHeavy": True,
            "strongUniqueValueHold": False,
            "exactDuplicateOf": None,
            "wrongLanguage": False,
        },
    }


class LocaleAuditPipelineTest(unittest.TestCase):
    def test_exact_main_manifest_is_conserved_without_api_rows(self):
        audit = load_audit(self)
        index = audit.git_manifest(ROOT, "d87451872ecffe95d0b0e1da8d4a698a76f52e6c")
        rows = audit.classify_manifest_routes(
            index["items"],
            {"complete": True, "zeroEligible": True, "rows": []},
            [],
            protected_routes=set(),
            opportunity_routes=set(),
            experiment_routes=set(),
            dependencies={item["route"]: clean_dependencies() for item in index["items"]},
            gsc_success_locales=set(audit.LOCALES),
        )
        self.assertEqual(len(index["items"]), 5_916)
        self.assertEqual(len(rows), 5_916)
        self.assertEqual(sum(audit._counts(rows).values()), 5_916)
        self.assertEqual(len({item["repoPath"] for item in rows}), 5_916)
        self.assertTrue(set(audit._counts(rows)).issubset({
            "PROTECTED", "MEASURED_POSITIVE", "GA4_90D_NO_ACTIVITY_ROW",
            "NORMALIZATION_COLLISION", "HOLD_DEPENDENCY", "OTHER_UNKNOWN",
        }))

    def test_ga4_paginates_until_row_count_and_captures_zero_gate_metadata(self):
        audit = load_audit(self)
        offsets = []
        responses = [
            ga4_response(3, [ga4_row("/id/a.html", [1, 1, 3, 0.1]), ga4_row("/id/b.html", [0, 0, 0, 0])]),
            ga4_response(3, [ga4_row("/id/c.html", [2, 1, 5, 0.2])]),
        ]

        def fetch(offset, limit):
            offsets.append((offset, limit))
            return responses[len(offsets) - 1]

        result = audit.collect_ga4_report(fetch, requested_rows=2)

        self.assertEqual(offsets, [(0, 2), (2, 2)])
        self.assertEqual(result["rowCount"], 3)
        self.assertEqual(result["retrievedRows"], 3)
        self.assertEqual(result["pagesFetched"], 2)
        self.assertEqual(result["stoppedBecause"], "ROW_COUNT_RETRIEVED")
        self.assertTrue(result["complete"])
        self.assertTrue(result["zeroEligible"])
        self.assertEqual(result["metadata"]["currencyCode"], "KRW")
        self.assertEqual(result["metadata"]["timeZone"], "Asia/Seoul")

    def test_ga4_paginates_beyond_one_hundred_thousand_rows(self):
        audit = load_audit(self)
        offsets = []

        class SyntheticRows:
            def __init__(self, count):
                self.count = count
            def __len__(self):
                return self.count
            def __iter__(self):
                for _ in range(self.count):
                    yield {"dimensionValues": [], "metricValues": []}

        def fetch(offset, limit):
            offsets.append(offset)
            count = 100_000 if offset == 0 else 1
            return ga4_response(100_001, SyntheticRows(count))

        result = audit.collect_ga4_report(fetch, requested_rows=100_000)
        self.assertEqual(offsets, [0, 100_000])
        self.assertEqual(result["retrievedRows"], 100_001)
        self.assertTrue(result["complete"])
        self.assertTrue(result["zeroEligible"])

    def test_ga4_row_count_must_match_and_metadata_must_be_present(self):
        audit = load_audit(self)
        responses = [ga4_response(2, [ga4_row("/id/a.html", [0, 0, 0, 0])]),
                     ga4_response(3, [ga4_row("/id/b.html", [0, 0, 0, 0])])]
        result = audit.collect_ga4_report(lambda offset, limit: responses[0 if offset == 0 else 1], requested_rows=1)
        self.assertFalse(result["rowCountConsistent"])
        self.assertFalse(result["complete"])
        missing = audit.collect_ga4_report(lambda offset, limit: SimpleNamespace(row_count=0, rows=[], metadata=None))
        self.assertTrue(missing["complete"])
        self.assertFalse(missing["zeroEligible"])

    def test_proto_optional_metadata_defaults_do_not_become_false_evidence(self):
        audit = load_audit(self)

        class ProtoMetadata:
            currency_code = "KRW"
            time_zone = "Asia/Seoul"
            subject_to_thresholding = False
            data_loss_from_other_row = False
            sampling_metadatas = []
            present = {"currency_code"}

            def HasField(self, name):
                if name in {"sampling_metadatas", "data_loss_from_other_row"}:
                    raise ValueError("field does not track presence")
                return name in self.present

        result = audit.collect_ga4_report(
            lambda offset, limit: SimpleNamespace(row_count=0, rows=[], metadata=ProtoMetadata())
        )
        self.assertEqual(result["metadata"]["currencyCode"], "KRW")
        self.assertIsNone(result["metadata"]["timeZone"])
        self.assertIsNone(result["metadata"]["subjectToThresholding"])
        self.assertFalse(result["zeroEligible"])

    def test_ga4_empty_page_before_row_count_never_proves_zero(self):
        audit = load_audit(self)
        responses = [ga4_response(3, [ga4_row("/id/a.html", [1, 1, 3, 0.1])]), ga4_response(3, [])]
        result = audit.collect_ga4_report(lambda offset, limit: responses[0 if offset == 0 else 1], requested_rows=2)

        self.assertEqual(result["retrievedRows"], 1)
        self.assertEqual(result["stoppedBecause"], "EMPTY_PAGE_BEFORE_ROW_COUNT")
        self.assertFalse(result["complete"])
        self.assertFalse(result["zeroEligible"])

    def test_ga4_thresholding_or_other_row_loss_disables_zero_classification(self):
        audit = load_audit(self)
        for metadata in (ga4_metadata(subjectToThresholding=True), ga4_metadata(dataLossFromOtherRow=True)):
            result = audit.collect_ga4_report(lambda offset, limit: ga4_response(0, [], metadata), requested_rows=100000)
            self.assertEqual(result["rowsRetrieved"], 0)
            self.assertTrue(result["complete"])
            self.assertFalse(result["zeroEligible"])

    def test_ga4_zero_gate_absent_subject_flag_and_truncation_contract(self):
        audit = load_audit(self)

        def report(metadata):
            return audit.collect_ga4_report(
                lambda offset, limit: ga4_response(0, [], metadata),
                requested_rows=100000,
                keep_empty_rows=False,
            )

        explicit_false = report(ga4_metadata(subjectToThresholding=False))
        self.assertTrue(explicit_false["zeroEligible"])
        self.assertEqual(explicit_false["metadata"]["subjectToThresholdingValue"], False)
        self.assertTrue(explicit_false["metadata"]["subjectToThresholdingPresent"])

        absent_metadata = ga4_metadata()
        del absent_metadata["subjectToThresholding"]
        absent = report(absent_metadata)
        self.assertTrue(absent["zeroEligible"])
        self.assertIsNone(absent["metadata"]["subjectToThresholdingValue"])
        self.assertFalse(absent["metadata"]["subjectToThresholdingPresent"])

        self.assertFalse(report(ga4_metadata(subjectToThresholding=True))["zeroEligible"])
        self.assertFalse(report(ga4_metadata(dataLossFromOtherRow=True))["zeroEligible"])
        self.assertFalse(report(ga4_metadata(samplingMetadatas=[{"samplesReadCount": 5}]))["zeroEligible"])
        truncated = report(ga4_metadata(dataTruncationReasons=[{"type": "ROW_LIMIT"}]))
        self.assertFalse(truncated["zeroEligible"])
        self.assertEqual(truncated["metadata"]["dataTruncationReasons"], [{"type": "ROW_LIMIT"}])

        restricted = report(ga4_metadata(schemaRestrictionResponse={
            "activeMetricRestrictions": [{"metricName": "totalAdRevenue"}],
        }))
        self.assertTrue(restricted["zeroEligible"])
        self.assertEqual(restricted["metadata"]["schemaRestrictionResponse"]["activeMetricRestrictions"][0]["metricName"], "totalAdRevenue")

    def test_ga4_request_explicitly_sets_keep_empty_rows_false(self):
        audit = load_audit(self)
        captured = {}

        class FakeRequest:
            def __init__(self, **kwargs):
                captured.update(kwargs)

        fake_types = types.ModuleType("google.analytics.data_v1beta.types")
        fake_types.DateRange = lambda **kwargs: kwargs
        fake_types.Dimension = lambda **kwargs: kwargs
        fake_types.Metric = lambda **kwargs: kwargs
        fake_types.RunReportRequest = FakeRequest
        module_names = (
            "google", "google.analytics", "google.analytics.data_v1beta",
            "google.analytics.data_v1beta.types",
        )
        fake_modules = {name: types.ModuleType(name) for name in module_names}
        fake_modules["google.analytics.data_v1beta.types"] = fake_types
        with mock.patch.dict(sys.modules, fake_modules):
            result = audit._collect_ga4_period(
                SimpleNamespace(run_report=lambda request: ga4_response(0, [])),
                "123", {"start": "2026-07-09", "end": "2026-10-06"},
                expected_timezone="Asia/Seoul",
            )
        self.assertIs(captured["keep_empty_rows"], False)
        self.assertIs(result["keepEmptyRows"], False)

    def test_gsc_filters_each_locale_to_finalized_pages_and_paginates(self):
        audit = load_audit(self)
        requests = []

        def fetch(body):
            requests.append(body)
            if body["startRow"] == 0:
                return [gsc_row("https://emfls.github.io/jp/a.html", 1, 3, 4), gsc_row("https://emfls.github.io/jp/b.html", 0, 2, 8)]
            return [gsc_row("https://emfls.github.io/jp/c.html", 0, 1, 10)]

        result = audit.collect_gsc_locale(fetch, locale="jp", start_date="2026-07-06", end_date="2026-10-03", row_limit=2)

        self.assertEqual([item["startRow"] for item in requests], [0, 2])
        self.assertEqual(result["rowsRetrieved"], 3)
        self.assertEqual(result["pagesFetched"], 2)
        self.assertEqual(result["stoppedBecause"], "SHORT_PAGE")
        self.assertTrue(result["paginationExhausted"])
        for body in requests:
            self.assertEqual(body["dimensions"], ["page"])
            self.assertEqual(body["dataState"], "final")
            self.assertEqual(body["type"], "web")
            self.assertEqual(body["aggregationType"], "auto")
            self.assertEqual(body["rowLimit"], 2)
            self.assertEqual(body["dimensionFilterGroups"][0]["filters"][0]["dimension"], "page")
            self.assertEqual(body["dimensionFilterGroups"][0]["filters"][0]["operator"], "includingRegex")
            self.assertEqual(body["dimensionFilterGroups"][0]["filters"][0]["expression"], r"^https://emfls\.github\.io/jp/")
        self.assertEqual(result["coverageStatus"], "TOP_ROWS_NOT_GUARANTEED")

    def test_route_alias_collisions_preserve_original_paths(self):
        audit = load_audit(self)
        indexed = audit.build_manifest_index(["jp/report/camp/family/index.html"])
        self.assertEqual(audit.normalize_page_path("/jp/report/camp/family/index.html?source=mail"), "/jp/report/camp/family/")
        grouped = audit.aggregate_ga4_rows([
            ga4_row("/jp/report/camp/family/", [0, 0, 0, 0]),
            ga4_row("/jp/report/camp/family/index.html?source=mail", [0, 0, 0, 0]),
        ], indexed)
        route = "/jp/report/camp/family/"
        self.assertTrue(grouped["routes"][route]["normalizationCollision"])
        self.assertEqual(grouped["routes"][route]["rawPaths"], ["/jp/report/camp/family/", "/jp/report/camp/family/index.html"])

    def test_complete_ga4_zero_distinguishes_gsc_signal_missing_and_protected(self):
        audit = load_audit(self)
        routes = ["/id/no-row.html", "/id/positive.html", "/id/gsc.html", "/id/protected.html", "/id/experiment.html", "/id/dependency.html"]
        ga4 = {
            "complete": True,
            "zeroEligible": True,
            "rows": [ga4_row("/id/positive.html", [1, 1, 4, 0.0])],
        }
        gsc = [gsc_row("https://emfls.github.io/id/gsc.html", clicks=0, impressions=7, position=20)]
        dependencies = {route: clean_dependencies() for route in routes}
        dependencies["/id/dependency.html"]["cross_locale_inbound_html"] = 1
        result = audit.classify_manifest_routes(
            routes, ga4, gsc,
            protected_routes={"/id/protected.html"},
            opportunity_routes=set(),
            experiment_routes={"/id/experiment.html"},
            dependencies=dependencies,
        )
        states = {row["route"]: row["status"] for row in result}
        rows_by_route = {row["route"]: row for row in result}
        self.assertEqual(states["/id/no-row.html"], "GA4_90D_NO_ACTIVITY_ROW")
        self.assertTrue(rows_by_route["/id/no-row.html"]["preAgeCandidateGatePassed"])
        self.assertFalse(rows_by_route["/id/no-row.html"]["candidateGatePassed"])
        self.assertEqual(states["/id/positive.html"], "MEASURED_POSITIVE")
        self.assertEqual(states["/id/gsc.html"], "MEASURED_POSITIVE")
        self.assertEqual(rows_by_route["/id/gsc.html"]["ga4Status"], "NO_ACTIVITY_ROW_ELIGIBLE")
        self.assertFalse(rows_by_route["/id/gsc.html"]["preAgeCandidateGatePassed"])
        self.assertEqual(states["/id/protected.html"], "PROTECTED")
        self.assertEqual(states["/id/experiment.html"], "HOLD_DEPENDENCY")
        self.assertEqual(states["/id/dependency.html"], "HOLD_DEPENDENCY")
        self.assertEqual(len(result), len(routes))
        self.assertEqual(set(states.values()), {
            "GA4_90D_NO_ACTIVITY_ROW", "MEASURED_POSITIVE",
            "PROTECTED", "HOLD_DEPENDENCY",
        })

    def test_incomplete_ga4_absence_is_unknown_not_zero(self):
        audit = load_audit(self)
        result = audit.classify_manifest_routes(
            ["/in/no-row.html"], {"complete": False, "zeroEligible": False, "rows": []}, [],
            protected_routes=set(), opportunity_routes=set(), experiment_routes=set(),
            dependencies={"/in/no-row.html": clean_dependencies()},
        )
        self.assertEqual(result[0]["status"], "OTHER_UNKNOWN")
        self.assertFalse(result[0]["ga4NoActivityRowEligible"])
        self.assertEqual(result[0]["gscStatus"], "NO_GSC_ROW")

    def test_gsc_zero_metric_row_is_unknown_and_alias_collision_is_held(self):
        audit = load_audit(self)
        routes = ["/id/zero-row.html", "id/family/index.html"]
        result = audit.classify_manifest_routes(
            routes,
            {
                "complete": True,
                "zeroEligible": True,
                "rows": [
                    ga4_row("/id/family/", [0, 0, 0, 0]),
                    ga4_row("/id/family/index.html", [0, 0, 0, 0]),
                ],
            },
            [gsc_row("https://emfls.github.io/id/zero-row.html", 0, 0, 0)],
            protected_routes=set(),
            opportunity_routes=set(),
            experiment_routes=set(),
            dependencies={route: clean_dependencies() for route in routes},
            gsc_success_locales={"id"},
        )
        states = {row["route"]: row for row in result}
        self.assertEqual(states["/id/zero-row.html"]["status"], "GA4_90D_NO_ACTIVITY_ROW")
        self.assertEqual(states["/id/zero-row.html"]["gscStatus"], "GSC_ROW_NO_SIGNAL")
        self.assertEqual(states["/id/family/"]["status"], "NORMALIZATION_COLLISION")
        self.assertTrue(states["/id/family/"]["normalizationCollision"])
        self.assertEqual(len(result), len(routes))

    def test_candidate_set_excludes_holds_and_never_exceeds_fifty(self):
        audit = load_audit(self)
        routes = [
            {"route": f"/id/{i:02}.html", "locale": "id", "status": "GA4_90D_NO_ACTIVITY_ROW",
             "preAgeCandidateGatePassed": True, "candidateGatePassed": False, "contentReviewPassed": True,
             "firstSeenCommit": "a" * 40, "firstSeenDate": "2026-06-01"}
            for i in range(55)
        ]
        routes.extend([
            {"route": "/id/protected.html", "status": "PROTECTED", "preAgeCandidateGatePassed": False, "candidateGatePassed": False, "contentReviewPassed": True},
            {"route": "/id/hold.html", "status": "HOLD_DEPENDENCY", "preAgeCandidateGatePassed": False, "candidateGatePassed": False, "contentReviewPassed": True},
        ])
        candidates = audit.select_batch_a(routes, limit=50)
        self.assertEqual(len(candidates), 50)
        self.assertEqual(candidates[0]["route"], "/id/00.html")
        self.assertTrue(all(item["candidateGatePassed"] for item in candidates))
        self.assertNotIn("/id/protected.html", {item["route"] for item in candidates})
        self.assertNotIn("/id/hold.html", {item["route"] for item in candidates})

    def test_batch_a_requires_pre_period_age_and_prioritizes_id_then_in(self):
        audit = load_audit(self)
        rows = [
            {"route": "/jp/report/travel/khagrachari.html", "locale": "jp", "status": "GA4_90D_NO_ACTIVITY_ROW", "preAgeCandidateGatePassed": True, "candidateGatePassed": False, "contentReviewPassed": True,
             "firstSeenCommit": "a" * 40, "firstSeenDate": "2026-06-01"},
            {"route": "/in/a.html", "locale": "in", "status": "GA4_90D_NO_ACTIVITY_ROW", "preAgeCandidateGatePassed": True, "candidateGatePassed": False, "contentReviewPassed": True,
             "firstSeenCommit": "b" * 40, "firstSeenDate": "2026-06-01"},
            {"route": "/id/new.html", "locale": "id", "status": "GA4_90D_NO_ACTIVITY_ROW", "preAgeCandidateGatePassed": True, "candidateGatePassed": False, "contentReviewPassed": True,
             "firstSeenCommit": "c" * 40, "firstSeenDate": "2026-07-09"},
            {"route": "/id/old.html", "locale": "id", "status": "GA4_90D_NO_ACTIVITY_ROW", "preAgeCandidateGatePassed": True, "candidateGatePassed": False, "contentReviewPassed": True,
             "firstSeenCommit": "d" * 40, "firstSeenDate": "2026-06-01"},
            {"route": "/jp/report/travel/ordinary.html", "locale": "jp", "status": "GA4_90D_NO_ACTIVITY_ROW", "preAgeCandidateGatePassed": True, "candidateGatePassed": False, "contentReviewPassed": True,
             "firstSeenCommit": "e" * 40, "firstSeenDate": "2020-01-01"},
        ]
        candidates = audit.select_batch_a(rows, limit=50, period_start="2026-07-09")
        self.assertEqual([item["route"] for item in candidates], [
            "/id/old.html", "/in/a.html", "/jp/report/travel/khagrachari.html", "/jp/report/travel/ordinary.html",
        ])
        self.assertNotIn("/id/new.html", {item["route"] for item in candidates})
        self.assertTrue(all(item["candidateGatePassed"] for item in candidates))
        self.assertEqual(audit.JP_REVIEW_ROUTES, {
            "/jp/report/travel/uk-miltonkeynes.html",
            "/jp/report/travel/bangladesh-joypurhat.html",
            "/jp/report/travel/khagrachari.html",
        })

    def test_git_first_seen_uses_add_commit_not_last_touch(self):
        audit = load_audit(self)
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            subprocess.run(["git", "init", "-q", str(repo)], check=True)
            page = repo / "id" / "old.html"
            page.parent.mkdir()
            page.write_text("first", encoding="utf-8")
            subprocess.run(["git", "-C", str(repo), "add", "id/old.html"], check=True)
            env = dict(os.environ, GIT_AUTHOR_DATE="2026-06-01T12:00:00+00:00", GIT_COMMITTER_DATE="2026-06-01T12:00:00+00:00")
            subprocess.run(["git", "-C", str(repo), "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "add page"], env=env, check=True)
            first_commit = subprocess.check_output(["git", "-C", str(repo), "rev-parse", "HEAD"], text=True).strip()
            page.write_text("updated", encoding="utf-8")
            subprocess.run(["git", "-C", str(repo), "add", "id/old.html"], check=True)
            env = dict(os.environ, GIT_AUTHOR_DATE="2026-10-01T12:00:00+00:00", GIT_COMMITTER_DATE="2026-10-01T12:00:00+00:00")
            subprocess.run(["git", "-C", str(repo), "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "update page"], env=env, check=True)
            first_seen = audit.git_first_seen(repo, "HEAD", "id/old.html")
        self.assertEqual(first_seen["firstSeenCommit"], first_commit)
        self.assertEqual(first_seen["firstSeenDate"], "2026-06-01")

    def test_candidate_content_review_requires_clear_low_value_evidence(self):
        audit = load_audit(self)
        thin = audit._content_review({"textTokenCount": 32, "templateHeavy": True}, 0, 0)
        orphan_only = audit._content_review({"textTokenCount": 700, "templateHeavy": False}, 0, 0)
        unique = audit._content_review({
            "textTokenCount": 900, "templateHeavy": False, "strongUniqueValueHold": True,
        }, 0, 0)
        self.assertTrue(thin["passed"])
        self.assertFalse(orphan_only["passed"])
        self.assertFalse(unique["passed"])

    def test_artifacts_are_exactly_four_outputs(self):
        audit = load_audit(self)
        with tempfile.TemporaryDirectory() as directory:
            paths = audit.write_artifacts(
                directory,
                {"result": "fixture"},
                [{"route": "/id/a.html", "status": "UNKNOWN"}],
                {"reports": {}},
                {"locales": {}},
            )
            self.assertEqual({path.name for path in paths}, {
                "locale-90d-summary.json", "locale-90d-pages.csv",
                "locale-90d-ga4-raw.json", "locale-90d-gsc-raw.json",
            })
            self.assertEqual({path.name for path in Path(directory).iterdir()}, {path.name for path in paths})

    def test_periods_use_full_inclusive_windows_and_finalized_search_console_dates(self):
        audit = load_audit(self)
        periods = audit.build_periods("2026-10-07T00:48:00+00:00")
        self.assertEqual(periods["ga4"]["90d"], {"start": "2026-07-09", "end": "2026-10-06", "days": 90})
        self.assertEqual(periods["ga4"]["latest28d"], {"start": "2026-09-09", "end": "2026-10-06", "days": 28})
        self.assertEqual(periods["ga4"]["prior28d"], {"start": "2026-08-12", "end": "2026-09-08", "days": 28})
        self.assertEqual(periods["gsc"]["90d"], {"start": "2026-07-06", "end": "2026-10-03", "days": 90})

    def test_audit_workflow_runs_read_only_artifact_job_only_on_exact_branch(self):
        workflow = yaml.safe_load(WORKFLOW_PATH.read_text(encoding="utf-8"))
        jobs = workflow["jobs"]
        self.assertIn("audit_locale_measurement", jobs, "audit-only Actions job is not configured yet")
        audit_job = jobs["audit_locale_measurement"]
        self.assertIn("codex/locale-measurement-audit-90d", audit_job["if"])
        self.assertIn("workflow_dispatch", audit_job["if"])
        self.assertEqual(audit_job["permissions"]["contents"], "read")
        self.assertEqual(jobs["collect"]["if"], "github.ref_name != 'codex/locale-measurement-audit-90d'")
        steps = audit_job["steps"]
        checkout = next(step for step in steps if step.get("uses") == "actions/checkout@v4")
        self.assertFalse(checkout["with"]["persist-credentials"])
        self.assertTrue(any(step.get("uses") == "actions/upload-artifact@v4" for step in steps))
        upload = next(step for step in steps if step.get("uses") == "actions/upload-artifact@v4")
        self.assertEqual(upload["with"]["retention-days"], 7)
        self.assertIn("runner.temp", upload["with"]["path"])
        run_scripts = "\n".join(step.get("run", "") for step in steps)
        self.assertIn("audit_locale_90d_measurement.py", run_scripts)
        self.assertIn('--base-sha "$BASE_MAIN_SHA"', run_scripts)
        self.assertIn("BASE_MAIN_SHA=", run_scripts)
        self.assertNotIn("EXPECTED_MAIN_SHA", run_scripts)
        self.assertIn("git fetch --no-tags origin main", run_scripts)
        self.assertNotIn("origin main --depth=1", run_scripts)
        self.assertNotRegex(run_scripts, r"git\s+(?:add|commit|push)")
        self.assertIn("git status --porcelain", run_scripts)
        self.assertIn("locale-90d-ga4-raw.json", run_scripts)


if __name__ == "__main__":
    unittest.main()
