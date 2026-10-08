import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github/workflows/seo-qa.yml"


class SeoQaWorkflowTests(unittest.TestCase):
    def test_workflow_runs_audit_gate_and_full_tests_without_rewriting_baseline(self):
        source = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("scripts/seo_audit.py", source)
        self.assertIn("scripts/seo_qa.py", source)
        self.assertIn("scripts/quality_audit.py", source)
        self.assertIn("/tmp/site-quality-dashboard.html", source)
        self.assertIn("SITE_SCORE.md", source)
        self.assertIn("python3 -m unittest discover -s tests -q", source)
        self.assertIn("python3 -m pytest -q", source)
        self.assertIn("pip install pytest requests", source)
        self.assertNotIn("--write-baseline", source)

    def test_workflow_has_read_only_repository_permissions(self):
        source = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("permissions:\n  contents: read", source)

    def test_workflow_uses_the_sites_korean_operating_date(self):
        source = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("TZ: Asia/Seoul", source)

    def test_workflow_keeps_compact_inventory_committed_and_scores_from_full_transient_audit(self):
        source = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn(
            "scripts/seo_audit.py . --json /tmp/site-audit-full.json --compact-json data/site-audit.json",
            source,
        )
        self.assertEqual(source.count("--audit /tmp/site-audit-full.json"), 2)
        self.assertIn("--audit data/site-audit.json", source)

    def test_default_quality_cli_rebuilds_transient_audit_when_no_path_is_supplied(self):
        quality = (ROOT / "scripts" / "quality_audit.py").read_text(encoding="utf-8")
        self.assertIn("audit = audit_site(root) if audit_path is None", quality)
        self.assertIn('parser.add_argument("--audit", type=Path, help=', quality)

    def test_workflow_generates_revenue_opportunities_before_final_dashboard_and_tests(self):
        source = WORKFLOW.read_text(encoding="utf-8").split("  measurement-parity:", 1)[0]
        audit = source.index("scripts/seo_audit.py")
        quality = source.index("scripts/quality_audit.py")
        revenue = source.index("scripts/revenue_growth.py")
        dashboard = source.rindex("scripts/quality_audit.py")
        tests = source.index("python3 -m unittest discover")

        self.assertLess(audit, quality)
        self.assertLess(quality, revenue)
        self.assertLess(revenue, dashboard)
        self.assertLess(dashboard, tests)
        self.assertIn("data/revenue-opportunities.json", source)
        self.assertIn("reports/revenue-growth-report.md", source)

    def test_workflow_revenue_refresh_uses_current_ga4_and_gsc_measurement_artifacts(self):
        source = WORKFLOW.read_text(encoding="utf-8")
        start = source.index("python3 scripts/revenue_growth.py")
        command = source[start : source.index("\n", start)]

        self.assertIn("--performance data/page-performance.json", command)
        self.assertIn("--gsc-snapshot data/performance/gsc-latest.json", command)

    def test_workflow_validates_daily_launch_without_cron_or_write_permission(self):
        source = WORKFLOW.read_text(encoding="utf-8").split("  measurement-parity:", 1)[0]
        revenue = source.index("scripts/revenue_growth.py")
        daily = source.index("scripts/daily_revenue_growth.py")
        guard = source.index("scripts/content_launch_guard.py")
        dashboard = source.rindex("scripts/quality_audit.py")
        tests = source.index("python3 -m unittest discover")
        self.assertLess(revenue, daily)
        self.assertLess(daily, guard)
        self.assertLess(guard, dashboard)
        self.assertLess(dashboard, tests)
        self.assertNotIn("schedule:", source)
        self.assertIn("permissions:\n  contents: read", source)
        self.assertNotIn("git push", source)

    def test_push_guard_fetches_event_before_commit_in_shallow_checkout(self):
        source = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("fetch-depth: 0", source)
        push_branch = source.index('COMPARE_REF="$EVENT_BEFORE"')
        fetch_before = source.index('git fetch origin "$EVENT_BEFORE" --depth=1')
        guard = source.index("scripts/content_launch_guard.py")
        self.assertLess(fetch_before, push_branch)
        self.assertLess(push_branch, guard)

    def test_guard_reads_committed_manifest_snapshot(self):
        source = WORKFLOW.read_text(encoding="utf-8")
        snapshot = source.index("git show HEAD:data/content-launch-manifest.json > /tmp/content-launch-manifest.json")
        guard = source.index("scripts/content_launch_guard.py")
        self.assertLess(snapshot, guard)
        self.assertIn("--manifest /tmp/content-launch-manifest.json", source)

    def test_pr_has_independent_nonpublishing_measurement_parity_job(self):
        source = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("  measurement-parity:", source)
        job = source.split("  measurement-parity:", 1)[1]
        self.assertIn("if: github.event_name == 'pull_request'", job)
        self.assertIn("permissions:\n      contents: read", job)
        self.assertIn("fetch-depth: 0", job)
        for required in (
            "scripts/validate_measurement_sources.py",
            "scripts/resolve_eligible_adsense_snapshot.py",
            "scripts/seo_audit.py",
            "scripts/quality_audit.py",
            "scripts/revenue_growth.py",
            "scripts/compact_page_performance.py",
            "scripts/build_page_performance_manifest.py",
            "scripts/validate_page_performance_compact_parity.py",
            "--naver-snapshot",
            "--naver \"$NAVER_SNAPSHOT\"",
            "--adsense-source-revision \"$ADSENSE_SOURCE_REVISION\"",
            '"$GITHUB_SHA"',
            '"$GITHUB_RUN_ID"',
            '"$GITHUB_RUN_ATTEMPT"',
            "PR_HEAD_SHA: ${{ github.event.pull_request.head.sha }}",
            '--pull-request-head-sha "$PR_HEAD_SHA"',
            "actions/upload-artifact@v4",
            "measurement-parity-report.json",
            "${{ runner.temp }}/measurement-parity-report.json",
        ):
            self.assertIn(required, job)
        for forbidden in (
            "git push",
            "git commit",
            "promote_measurement_artifacts.py",
            "workflow_dispatch",
            "vercel deploy",
        ):
            self.assertNotIn(forbidden, job.lower())
        self.assertNotIn("data/page-performance.json", job)
        self.assertNotIn("data/revenue-opportunities.json", job)
        self.assertEqual(job.count('--adsense-snapshot "$ADSENSE_SNAPSHOT"'), 2)
        self.assertIn('--adsense "$ADSENSE_SNAPSHOT"', job)
        resolver = job.index("scripts/resolve_eligible_adsense_snapshot.py")
        source_validation = job.index("scripts/validate_measurement_sources.py")
        revenue_generation = job.index("scripts/revenue_growth.py")
        manifest_generation = job.index("scripts/build_page_performance_manifest.py")
        parity_validation = job.index("scripts/validate_page_performance_compact_parity.py")
        self.assertLess(resolver, source_validation)
        self.assertLess(source_validation, revenue_generation)
        self.assertLess(revenue_generation, manifest_generation)
        self.assertLess(manifest_generation, parity_validation)
        self.assertEqual(job.count('--adsense "$ADSENSE_SNAPSHOT"'), 2)

    def test_derived_publisher_pins_one_naver_snapshot_for_revenue_and_manifest(self):
        publisher = (ROOT / ".github/workflows/derived-measurement-publisher.yml").read_text(encoding="utf-8")
        self.assertIn("Resolve the exact Naver snapshot path once", publisher)
        self.assertIn('env.write(f"NAVER_SNAPSHOT={path.as_posix()}\\n")', publisher)
        self.assertEqual(publisher.count('--naver-snapshot "$NAVER_SNAPSHOT"'), 2)
        self.assertEqual(publisher.count('--naver "$NAVER_SNAPSHOT"'), 1)


if __name__ == "__main__":
    unittest.main()
