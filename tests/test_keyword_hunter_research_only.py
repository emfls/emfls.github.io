"""Fail-closed contract tests for the isolated Keyword Hunter research lane."""

import json
from pathlib import Path
import tempfile
import unittest

try:
    from scripts import keyword_hunter_research_only as lane
except ImportError:
    lane = None


def _hypothesis(phrase="검증용 테스트 가설", **overrides):
    value = {
        "exactPhrase": phrase,
        "hypothesisGroup": "B1",
        "reviewStatus": "REVIEWED_HYPOTHESIS",
        "reviewer": "fixture-only",
        "reviewedAt": "2026-10-10T12:00:00+09:00",
    }
    value.update(overrides)
    return value


def _write_hypotheses(root, hypotheses=None):
    path = root / "data" / "keyword-hunter-research-only" / "hypotheses.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "lane": "RESEARCH_ONLY",
                "hypotheses": hypotheses if hypotheses is not None else [_hypothesis()],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    return path


def _response(phrase, rows, **overrides):
    from scripts.keyword_hunter_api import search_ads_hint

    value = {
        "exactPhrase": phrase,
        "sentHint": search_ads_hint(phrase),
        "payload": {"keywordList": rows, "total": len(rows)},
    }
    value.update(overrides)
    return value


class ResearchOnlyLaneTests(unittest.TestCase):
    def require_lane(self):
        self.assertIsNotNone(
            lane,
            "research-only provenance module is not implemented yet",
        )
        return lane

    def make_bundle(self, root, rows=None, **overrides):
        module = self.require_lane()
        _write_hypotheses(root)
        hypotheses = module.load_hypotheses(root)
        response = _response(
            hypotheses[0].exact_phrase,
            rows if rows is not None else [],
        )
        run_id = overrides.pop("run_id", "fixture-run-001")
        return module.build_capture_bundle(
            hypotheses,
            [response],
            run_id=run_id,
            observed_at="2026-10-10T12:34:56+09:00",
            **overrides,
        )

    def test_missing_and_corrupt_input_fail_closed(self):
        module = self.require_lane()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaises(module.ResearchOnlyError):
                module.load_hypotheses(root)

            path = _write_hypotheses(root)
            path.write_text("{not-json", encoding="utf-8")
            with self.assertRaises(module.ResearchOnlyError):
                module.load_hypotheses(root)

            valid_hypothesis = json.dumps(_hypothesis(), ensure_ascii=False)
            path.write_text(
                '{"schemaVersion": 1, "schemaVersion": 1, "lane": "RESEARCH_ONLY", '
                f'"hypotheses": [{valid_hypothesis}]' + "}",
                encoding="utf-8",
            )
            with self.assertRaises(module.ResearchOnlyError):
                module.load_hypotheses(root)

            valid_input = json.dumps(
                {"schemaVersion": 1, "lane": "RESEARCH_ONLY", "hypotheses": [_hypothesis()]},
                ensure_ascii=False,
            )
            path.write_text(" " * 32769 + valid_input, encoding="utf-8")
            with self.assertRaises(module.ResearchOnlyError):
                module.load_hypotheses(root)

    def test_reads_only_the_separate_reviewed_hypothesis_path(self):
        module = self.require_lane()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _write_hypotheses(
                root,
                [
                    _hypothesis("검증용 가설 하나", hypothesisGroup="B1"),
                    _hypothesis("검증용 가설 둘", hypothesisGroup="A3"),
                ],
            )
            (root / "data").mkdir(exist_ok=True)
            (root / "data" / "keyword_seeds.json").write_text(
                '{"seeds": []}\n', encoding="utf-8"
            )

            values = module.load_hypotheses(root)

            self.assertEqual([x.exact_phrase for x in values], ["검증용 가설 하나", "검증용 가설 둘"])
            self.assertEqual([x.hypothesis_group for x in values], ["B1", "A3"])
            self.assertEqual(values[0].review_status, "REVIEWED_HYPOTHESIS")
            self.assertEqual(
                (root / "data" / "keyword_seeds.json").read_text(encoding="utf-8"),
                '{"seeds": []}\n',
            )

    def test_caps_hypotheses_at_six_and_rejects_normalized_duplicates(self):
        module = self.require_lane()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _write_hypotheses(root, [_hypothesis(f"검증용 가설 {i}") for i in range(7)])
            with self.assertRaises(module.ResearchOnlyError):
                module.load_hypotheses(root)

            _write_hypotheses(root, [_hypothesis("검증용 중복"), _hypothesis("검증용  중복")])
            with self.assertRaises(module.ResearchOnlyError):
                module.load_hypotheses(root)

    def test_rejects_unreviewed_wrong_group_non_korean_and_non_kst_hypotheses(self):
        module = self.require_lane()
        invalid = (
            _hypothesis(reviewStatus="APPROVED"),
            _hypothesis(hypothesisGroup="OTHER"),
            _hypothesis("plain English hypothesis"),
            _hypothesis(reviewedAt="2026-10-10T03:00:00Z"),
            _hypothesis("검증용 가설", unexpected="not-allowed"),
        )
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for value in invalid:
                with self.subTest(value=value):
                    _write_hypotheses(root, [value])
                    with self.assertRaises(module.ResearchOnlyError):
                        module.load_hypotheses(root)

    def test_capture_preserves_phrase_hint_returned_term_and_source_provenance(self):
        module = self.require_lane()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _write_hypotheses(root)
            hypotheses = module.load_hypotheses(root)
            responses = [
                _response(
                    "검증용 테스트 가설",
                    [
                        {
                            "relKeyword": "검증 결과 용어",
                            "monthlyPcQcCnt": "120",
                            "monthlyMobileQcCnt": 0,
                        }
                    ],
                )
            ]
            bundle = module.build_capture_bundle(
                hypotheses,
                responses,
                run_id="fixture-run-001",
                observed_at="2026-10-10T12:34:56+09:00",
            )

            record = bundle["records"][0]
            result = record["results"][0]
            self.assertEqual(bundle["lane"], "RESEARCH_ONLY")
            self.assertEqual(bundle["runId"], "fixture-run-001")
            self.assertEqual(bundle["observedAt"], "2026-10-10T12:34:56+09:00")
            self.assertEqual(bundle["observedTimezone"], "Asia/Seoul")
            self.assertEqual(bundle["source"]["name"], "NAVER_SEARCH_ADS")
            self.assertEqual(bundle["source"]["endpoint"], "/keywordstool")
            self.assertEqual(bundle["source"]["apiVersion"], "UNVERSIONED")
            self.assertEqual(bundle["reportingPeriod"], {"status": "NOT_AVAILABLE", "start": None, "end": None})
            self.assertEqual(record["exactPhrase"], "검증용 테스트 가설")
            self.assertEqual(record["sentHint"], "검증용테스트가설")
            self.assertEqual(result["returnedRelKeyword"], "검증 결과 용어")
            self.assertEqual(result["monthlyPcQcCnt"]["raw"], "120")
            self.assertEqual(result["monthlyPcQcCnt"]["exactValue"], 120)
            self.assertEqual(result["monthlyMobileQcCnt"]["exactValue"], 0)
            self.assertIn("integrity", bundle)

    def test_zero_censored_and_missing_counts_keep_distinct_states(self):
        module = self.require_lane()
        with tempfile.TemporaryDirectory() as directory:
            bundle = self.make_bundle(
                Path(directory),
                [
                    {"relKeyword": "검증 영 값", "monthlyPcQcCnt": "0", "monthlyMobileQcCnt": 0},
                    {"relKeyword": "검증 검열 값", "monthlyPcQcCnt": "< 10"},
                    {"relKeyword": "검증 누락 값"},
                ],
            )

            exact, censored, missing = bundle["records"][0]["results"]
            self.assertEqual(exact["monthlyPcQcCnt"]["status"], "EXACT")
            self.assertEqual(exact["monthlyPcQcCnt"]["exactValue"], 0)
            self.assertEqual(exact["monthlyPcQcCnt"]["raw"], "0")
            self.assertEqual(censored["monthlyPcQcCnt"]["status"], "CENSORED")
            self.assertTrue(censored["monthlyPcQcCnt"]["isCensored"])
            self.assertEqual(censored["monthlyPcQcCnt"]["raw"], "< 10")
            self.assertIsNone(censored["monthlyPcQcCnt"]["exactValue"])
            self.assertEqual(censored["monthlyPcQcCnt"]["censorOperator"], "<")
            self.assertEqual(censored["monthlyPcQcCnt"]["censorThreshold"], 10)
            self.assertEqual(missing["monthlyPcQcCnt"]["status"], "MISSING")
            self.assertFalse(missing["monthlyPcQcCnt"]["sourceFieldPresent"])
            self.assertIsNone(missing["monthlyPcQcCnt"]["exactValue"])

    def test_empty_provider_response_is_not_a_zero_measurement(self):
        module = self.require_lane()
        with tempfile.TemporaryDirectory() as directory:
            bundle = self.make_bundle(Path(directory), [])
            record = bundle["records"][0]
            self.assertEqual(record["responseStatus"], "NO_RESULTS")
            self.assertEqual(record["results"], [])

    def test_invalid_count_text_is_preserved_without_becoming_zero(self):
        module = self.require_lane()
        with tempfile.TemporaryDirectory() as directory:
            bundle = self.make_bundle(
                Path(directory),
                [
                    {"relKeyword": "검증 오류 값", "monthlyPcQcCnt": "unknown"},
                    {"relKeyword": "검증 음수 값", "monthlyMobileQcCnt": -2},
                ],
            )
            invalid_text, invalid_number = bundle["records"][0]["results"]
            self.assertEqual(invalid_text["monthlyPcQcCnt"]["status"], "INVALID")
            self.assertEqual(invalid_text["monthlyPcQcCnt"]["raw"], "unknown")
            self.assertIsNone(invalid_text["monthlyPcQcCnt"]["exactValue"])
            self.assertEqual(invalid_number["monthlyMobileQcCnt"]["status"], "INVALID")
            self.assertEqual(invalid_number["monthlyMobileQcCnt"]["raw"], -2)
            self.assertIsNone(invalid_number["monthlyMobileQcCnt"]["exactValue"])

    def test_reported_row_count_marks_partial_capture_without_truncating(self):
        module = self.require_lane()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _write_hypotheses(root)
            hypotheses = module.load_hypotheses(root)
            response = _response(
                "검증용 테스트 가설",
                [{"relKeyword": "검증 반환 행", "monthlyPcQcCnt": 4}],
            )
            response["payload"]["total"] = 2
            bundle = module.build_capture_bundle(
                hypotheses,
                [response],
                run_id="fixture-run-001",
                observed_at="2026-10-10T12:34:56+09:00",
            )
            record = bundle["records"][0]
            self.assertEqual(record["capturedRowCount"], 1)
            self.assertEqual(record["providerReportedTotal"], 2)
            self.assertEqual(record["rowCoverage"], "PARTIAL")
            self.assertEqual(len(record["results"]), 1)

            response["payload"].pop("total")
            unavailable = module.build_capture_bundle(
                hypotheses,
                [response],
                run_id="fixture-run-002",
                observed_at="2026-10-10T12:34:56+09:00",
            )
            self.assertEqual(unavailable["records"][0]["rowCoverage"], "NOT_AVAILABLE")

    def test_capture_rejects_unbounded_rows_and_bundle_bytes(self):
        module = self.require_lane()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _write_hypotheses(root)
            hypotheses = module.load_hypotheses(root)
            too_many_rows = [
                {"relKeyword": f"검증 행 {index}", "monthlyPcQcCnt": 1}
                for index in range(1001)
            ]
            with self.assertRaises(module.ResearchOnlyError):
                module.build_capture_bundle(
                    hypotheses,
                    [_response("검증용 테스트 가설", too_many_rows)],
                    run_id="fixture-run-001",
                    observed_at="2026-10-10T12:34:56+09:00",
                )

            huge_keyword = "검증" * 600_000
            with self.assertRaises(module.ResearchOnlyError):
                module.build_capture_bundle(
                    hypotheses,
                    [_response("검증용 테스트 가설", [{"relKeyword": huge_keyword}])],
                    run_id="fixture-run-002",
                    observed_at="2026-10-10T12:34:56+09:00",
                )

    def test_capture_revalidates_hypothesis_objects_not_only_loaded_files(self):
        module = self.require_lane()
        with tempfile.TemporaryDirectory() as directory:
            _write_hypotheses(Path(directory))
            forged = module.Hypothesis(
                exact_phrase="검증용 테스트 가설",
                hypothesis_group=[],
                review_status="APPROVED",
                reviewer="fixture-only",
                reviewed_at="2026-10-10T12:00:00+09:00",
            )
            with self.assertRaises(module.ResearchOnlyError):
                module.build_capture_bundle(
                    [forged],
                    [_response("검증용 테스트 가설", [])],
                    run_id="fixture-run-001",
                    observed_at="2026-10-10T12:34:56+09:00",
                )

    def test_malformed_or_mismatched_provider_capture_fails_closed(self):
        module = self.require_lane()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _write_hypotheses(root)
            hypotheses = module.load_hypotheses(root)
            invalid_responses = (
                [{"exactPhrase": "검증용 테스트 가설", "sentHint": "wrong", "payload": {"keywordList": []}}],
                [{"exactPhrase": "검증용 테스트 가설", "sentHint": "검증용테스트", "payload": {"keywordList": "not-a-list"}}],
                [{"exactPhrase": "검증용 테스트 가설", "sentHint": "검증용테스트", "payload": {}}],
                [
                    _response("검증용 테스트 가설", []),
                    _response("검증용 테스트 가설", []),
                ],
                [_response("검증용 외부 가설", [])],
            )
            for responses in invalid_responses:
                with self.subTest(responses=responses):
                    with self.assertRaises(module.ResearchOnlyError):
                        module.build_capture_bundle(
                            hypotheses,
                            responses,
                            run_id="fixture-run-001",
                            observed_at="2026-10-10T12:34:56+09:00",
                        )

            with self.assertRaises(module.ResearchOnlyError):
                self.make_bundle(root, [{"monthlyPcQcCnt": {"unexpected": "object"}}])

    def test_run_id_and_kst_observation_timestamp_are_validated(self):
        module = self.require_lane()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _write_hypotheses(root)
            hypotheses = module.load_hypotheses(root)
            response = [_response("검증용 테스트 가설", [])]
            for run_id, observed_at in (
                ("../escape", "2026-10-10T12:34:56+09:00"),
                ("fixture-run-002", "2026-10-10T03:34:56Z"),
                ("fixture-run-003", "not-a-date"),
            ):
                with self.subTest(run_id=run_id, observed_at=observed_at):
                    with self.assertRaises(module.ResearchOnlyError):
                        module.build_capture_bundle(
                            hypotheses,
                            response,
                            run_id=run_id,
                            observed_at=observed_at,
                        )

    def test_input_and_output_symlinks_cannot_escape_root(self):
        module = self.require_lane()
        with tempfile.TemporaryDirectory() as directory, tempfile.TemporaryDirectory() as outside:
            root = Path(directory)
            _write_hypotheses(root)
            original = root / "data" / "keyword-hunter-research-only"
            moved = root / "data" / "research-input"
            original.rename(moved)
            original.symlink_to(Path(outside), target_is_directory=True)
            with self.assertRaises(module.ResearchOnlyError):
                module.load_hypotheses(root)

        with tempfile.TemporaryDirectory() as directory, tempfile.TemporaryDirectory() as outside:
            root = Path(directory)
            bundle = self.make_bundle(root, [])
            target = root / "reports" / "keyword-hunter" / "research-only"
            target.parent.mkdir(parents=True)
            target.symlink_to(Path(outside), target_is_directory=True)
            with self.assertRaises(module.ResearchOnlyError):
                module.write_capture(root, bundle)
            self.assertEqual(list(Path(outside).iterdir()), [])

    def test_writer_replaces_one_bounded_latest_artifact_and_preserves_production_state(self):
        module = self.require_lane()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            protected = {
                "data/keyword_seeds.json": '{"seeds": []}\n',
                "data/keywords_master.csv": "keyword,status\nbase,NEW\n",
                "data/recent_exploration_history.json": '{"runs": []}\n',
                "data/content-launch-queue.json": '{"queue": []}\n',
                "data/content-launch-decisions.json": '{"decisions": []}\n',
                "data/content-launch-manifest.json": '{"published": []}\n',
                "data/content-launch-counter.json": '{"launchedCount": 0}\n',
                "data/published_keywords.json": "[]\n",
                "kor/research-only-fixture.html": "protected fixture\n",
            }
            for relative, value in protected.items():
                path = root / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(value, encoding="utf-8")
            bundle = self.make_bundle(root, [])

            output = module.write_capture(root, bundle)

            self.assertEqual(output.relative_to(root.resolve()).as_posix(), "reports/keyword-hunter/research-only/latest.json")
            self.assertTrue(output.is_file())
            self.assertTrue(module.verify_capture_bundle(json.loads(output.read_text(encoding="utf-8"))))
            for relative, value in protected.items():
                self.assertEqual((root / relative).read_text(encoding="utf-8"), value)
            with self.assertRaises(module.ResearchOnlyError):
                module.write_capture(root, bundle)

            newer = self.make_bundle(root, [], run_id="fixture-run-002")
            self.assertEqual(module.write_capture(root, newer), output)
            self.assertEqual(json.loads(output.read_text(encoding="utf-8"))["runId"], "fixture-run-002")
            self.assertEqual([path.name for path in output.parent.iterdir()], ["latest.json"])

    def test_writer_fails_closed_on_legacy_or_unexpected_output_files(self):
        module = self.require_lane()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            bundle = self.make_bundle(root, [])
            output_dir = root / "reports" / "keyword-hunter" / "research-only"
            output_dir.mkdir(parents=True)
            legacy = output_dir / "fixture-run-old.json"
            legacy.write_text("{}\n", encoding="utf-8")

            with self.assertRaises(module.ResearchOnlyError):
                module.write_capture(root, bundle)

            self.assertEqual(legacy.read_text(encoding="utf-8"), "{}\n")
            self.assertFalse((output_dir / "latest.json").exists())

    def test_checksum_detects_capture_tampering(self):
        module = self.require_lane()
        with tempfile.TemporaryDirectory() as directory:
            bundle = self.make_bundle(
                Path(directory),
                [{"relKeyword": "검증 결과 용어", "monthlyPcQcCnt": 2}],
            )
            self.assertTrue(module.verify_capture_bundle(bundle))
            bundle["records"][0]["results"][0]["returnedRelKeyword"] = "바뀐 결과"
            with self.assertRaises(module.ResearchOnlyError):
                module.verify_capture_bundle(bundle)

    def test_hint_generation_matches_the_existing_request_contract(self):
        module = self.require_lane()
        from scripts.keyword_hunter_api import search_ads_hint

        for phrase in ("검증용 테스트 가설", "가" * 25, "사진·위치 정보 2026"):
            with self.subTest(phrase=phrase):
                self.assertEqual(module.search_ads_hint(phrase), search_ads_hint(phrase))

    def test_research_lane_is_not_wired_into_production_collection_or_persistence(self):
        module = self.require_lane()
        root = Path(__file__).resolve().parents[1]
        for relative in (
            ".github/workflows/keyword-hunter.yml",
            "scripts/keyword_hunter.py",
            "scripts/prepare_keyword_launch.py",
        ):
            with self.subTest(path=relative):
                text = (root / relative).read_text(encoding="utf-8")
                self.assertNotIn("keyword_hunter_research_only", text)
                self.assertNotIn("keyword-hunter-research-only", text)

        from scripts.keyword_hunter_persist import BROAD_PATHS, TARGETED_FIXED_PATHS

        self.assertNotIn("data/keyword-hunter-research-only/hypotheses.json", BROAD_PATHS + TARGETED_FIXED_PATHS)
        self.assertFalse(any(path.startswith("reports/keyword-hunter/research-only") for path in BROAD_PATHS))
        self.assertNotIn("client.request(", Path(module.__file__).read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
