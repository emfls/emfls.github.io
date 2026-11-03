import json
import os
import re
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github/workflows/keyword-hunter-targeted-artifact.yml"


class TargetedArtifactWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = WORKFLOW.read_text(encoding="utf-8")

    def test_manual_dispatch_is_the_only_automatic_entry_point(self):
        lines = self.source.splitlines()
        trigger = lines.index("on:")
        self.assertEqual(lines[trigger + 1], "  workflow_dispatch:")
        next_top_level = next(
            (line for line in lines[trigger + 2 :] if line and not line.startswith(" ")),
            None,
        )
        self.assertEqual(next_top_level, "permissions:")
        self.assertNotIn("schedule:", "\n".join(lines[trigger:]))

    def test_permissions_and_checkout_are_read_only(self):
        self.assertRegex(self.source, r"(?m)^permissions:\n  contents: read$")
        self.assertIn("persist-credentials: false", self.source)
        self.assertNotRegex(self.source, r"(?m)^\s+contents:\s*write\s*$")

    def test_measurement_workflow_cannot_persist_or_publish(self):
        forbidden = (
            "keyword_hunter_persist.py",
            "git push",
            "git commit",
            "actions/deploy-pages",
        )
        for token in forbidden:
            with self.subTest(token=token):
                self.assertNotIn(token, self.source)
        self.assertIn("git status --porcelain --untracked-files=all | grep -E", self.source)
        self.assertIn("HTML changed during targeted measurement", self.source)

    def test_publication_and_measurement_inputs_are_checked_after_collection(self):
        self.assertIn("- name: Verify no persistent or publication state changed", self.source)
        self.assertIn("if: always() && steps.measure.outcome != 'skipped'", self.source)
        for path in (
            "data/keywords_master.csv",
            "data/published_keywords.json",
            "data/content-launch-counter.json",
            "data/content-launch-manifest.json",
            "data/content-launch-decisions.json",
            "data/content-launch-queue.json",
            "data/revenue-opportunities.json",
            "data/adsense/2026-08-01-safety-baseline.json",
        ):
            with self.subTest(path=path):
                self.assertIn(path, self.source)

    def test_only_existing_naver_secrets_are_injected_without_echo(self):
        for name in (
            "NAVER_SEARCHAD_API_KEY",
            "NAVER_SEARCHAD_SECRET_KEY",
            "NAVER_SEARCHAD_CUSTOMER_ID",
            "NAVER_API_HUB_CLIENT_ID",
            "NAVER_API_HUB_CLIENT_SECRET",
            "NAVER_WEB_SEARCH_API_HUB_CLIENT_ID",
            "NAVER_WEB_SEARCH_API_HUB_CLIENT_SECRET",
        ):
            with self.subTest(name=name):
                self.assertIn(f"{name}: ${{{{ secrets.{name} }}}}", self.source)
        self.assertNotRegex(self.source, r"(?m)^\s*(?:echo|printenv)\s+.*(?:SECRET|KEY|TOKEN)")
        self.assertNotIn("set -x", self.source)

    def test_secrets_are_scoped_to_validation_and_measurement_steps(self):
        job_scope = re.split(r"(?m)^    steps:$", self.source, maxsplit=1)[0]
        self.assertNotIn("secrets.", job_scope)
        for secret in ("NAVER_SEARCHAD_API_KEY", "NAVER_SEARCHAD_SECRET_KEY", "NAVER_SEARCHAD_CUSTOMER_ID"):
            self.assertEqual(self.source.count(f"{secret}: ${{{{ secrets.{secret} }}}}"), 2)

    def test_artifact_is_one_sanitized_run_file_with_short_retention(self):
        self.assertIn("retention-days: 7", self.source)
        self.assertIn("${{ github.run_id }}-${{ github.run_attempt }}", self.source)
        self.assertIn("${{ runner.temp }}/keyword-hunter-targeted-artifact.json", self.source)
        self.assertNotIn("reports/keyword-hunter/", self.source)
        self.assertNotIn("reports/keyword-targeted-validation/\n", self.source)

    def test_sanitizer_keeps_exact_status_and_null_without_private_fields(self):
        marker = "      - name: Sanitize the run report"
        start = self.source.index(marker)
        block = self.source[start:]
        run_start = block.index("        run: |\n") + len("        run: |\n")
        script_lines = []
        for line in block[run_start:].splitlines():
            if line.startswith("      - "):
                break
            script_lines.append(line[10:] if line.startswith("          ") else line)
        shell = "\n".join(script_lines).strip() + "\n"
        self.assertIn("python3 - <<'PY'", shell)
        python_script = shell.split("python3 - <<'PY'\n", 1)[1].rsplit("\nPY", 1)[0]

        sentinel = "do-not-export-auth-secret"
        sample = {
            "schemaVersion": 1,
            "mode": "targeted_measurement",
            "status": "PARTIAL",
            "checkedAt": "2026-10-13T20:00:00+09:00",
            "targetCount": 1,
            "sourceStatuses": {"NAVER_SEARCH_ADS": "AUTH_ERROR", "NAVER_DATALAB": "API_ERROR"},
            "apiCalls": {"total": 99},
            "errors": [{"source": "NAVER_SEARCHAD", "code": "AUTH_ERROR", "body": sentinel}],
            "targets": [{
                "keyword": "현대자동차정비예약",
                "searchAds": {
                    "status": "TARGET_ROW_NOT_RETURNED", "source": "NAVER_SEARCH_ADS",
                    "unit": "MONTHLY_SEARCHES", "checkedAt": "2026-10-13T20:00:00+09:00",
                    "exactTargetReturned": False, "monthlyPc": None, "monthlyMobile": None,
                    "monthlyTotal": None, "competition": None, "volumeNote": None,
                    "relatedRows": [{"keyword": "private-expanded-term", "monthlyTotal": 123}],
                },
                "dataLab": {
                    "status": "NO_VALIDATED_TREND", "source": "NAVER_DATALAB",
                    "checkedAt": "2026-10-13T20:00:00+09:00",
                    "metricType": "RELATIVE_INTEREST_CHANGE_PERCENT", "trend1m": None,
                    "trend3m": None, "trendMomentum": None, "seasonality": None,
                },
                "webSearch": {
                    "status": "UNVERIFIED", "source": "NAVER_WEB_SEARCH",
                    "checkedAt": "2026-10-13T20:00:00+09:00",
                    "metricType": "WEB_RESULT_COUNT_NOT_DEMAND", "resultCount": None,
                },
            }],
            "limitations": ["Missing metrics are not zero."],
        }
        with tempfile.TemporaryDirectory() as tmp:
            tmpdir = Path(tmp)
            report = tmpdir / "report.json"
            output = tmpdir / "artifact.json"
            report.write_text(json.dumps(sample), encoding="utf-8")
            env = dict(os.environ, INPUT_REPORT_PATH=str(report), OUTPUT_REPORT_PATH=str(output), KEYWORD_HUNTER_RUN_ID="12-1")
            result = subprocess.run(["python3", "-c", python_script], env=env, text=True, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            artifact = output.read_text(encoding="utf-8")
            clean = json.loads(artifact)
        self.assertNotIn(sentinel, artifact)
        self.assertNotIn("private-expanded-term", artifact)
        self.assertNotIn("apiCalls", clean)
        self.assertNotIn("errors", clean)
        self.assertEqual(clean["status"], "PARTIAL")
        self.assertEqual(clean["sourceStatuses"]["NAVER_SEARCH_ADS"], "AUTH_ERROR")
        self.assertEqual(clean["sourceStatuses"]["NAVER_DATALAB"], "API_ERROR")
        self.assertEqual(clean["targets"][0]["searchAds"]["checkedAt"], "2026-10-13T20:00:00+09:00")
        self.assertIsNone(clean["targets"][0]["searchAds"]["monthlyTotal"])
        self.assertEqual(clean["targets"][0]["searchAds"]["status"], "TARGET_ROW_NOT_RETURNED")


if __name__ == "__main__":
    unittest.main()
