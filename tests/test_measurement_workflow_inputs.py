from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def _workflow_text():
    return (ROOT / ".github" / "workflows" / "gsc-collection.yml").read_text(encoding="utf-8")


def _step_block(workflow, name):
    marker = f"      - name: {name}"
    start = workflow.index(marker)
    next_step = workflow.find("\n      - ", start + len(marker))
    return workflow[start : next_step if next_step >= 0 else len(workflow)]


def test_source_collection_workflows_commit_only_their_source_snapshots():
    expected = {
        "ga4-collection.yml": "git add data/performance/ga4-latest.json",
        "gsc-collection.yml": "git add data/performance/gsc-latest.json",
    }
    derived = (
        "data/page-performance.json",
        "data/revenue-opportunities.json",
        "reports/revenue-growth-report.md",
        "scripts/revenue_growth.py",
    )
    for name, staged_line in expected.items():
        workflow = (ROOT / ".github" / "workflows" / name).read_text(encoding="utf-8")
        assert staged_line in workflow
        for item in derived:
            assert item not in workflow


def test_seo_qa_measurement_validator_uses_fresh_page_scores():
    workflow = (ROOT / ".github" / "workflows" / "seo-qa.yml").read_text(encoding="utf-8")

    assert "python3 scripts/validate_measurement_artifact.py data/page-performance.json --page-scores data/page-scores.json" in workflow


def test_derived_publisher_runs_after_daily_collectors_and_stages_only_derived_outputs():
    workflow = (ROOT / ".github" / "workflows" / "derived-measurement-publisher.yml").read_text(encoding="utf-8")
    assert 'cron: "17 3 * * *"' in workflow
    assert "workflow_dispatch:" in workflow
    assert "group: site-measurement-collection\n  cancel-in-progress: false\n  queue: max" in workflow
    assert "scripts/validate_measurement_sources.py" in workflow
    assert workflow.index("Validate source snapshots") < workflow.index("Regenerate current site audit")
    assert workflow.index("Regenerate current page scores") < workflow.index("Generate derived artifacts")
    assert workflow.index("Generate derived artifacts") < workflow.index("Promote derived artifacts")
    assert workflow.index("Promote derived artifacts") < workflow.index("Commit derived measurement artifacts")
    commit = _step_block(workflow, "Commit derived measurement artifacts")
    assert "git add data/page-performance.json data/revenue-opportunities.json reports/revenue-growth-report.md" in commit
    for source_snapshot in (
        "data/performance/ga4-latest.json",
        "data/performance/gsc-latest.json",
        "data/performance/adsense-latest.json",
    ):
        assert source_snapshot not in commit
    for collector in ("collect_ga4_snapshot.py", "collect_gsc_snapshot.py", "collect_adsense_snapshot.py"):
        assert collector not in workflow
    assert "google-analytics-data" not in workflow
    assert "google-api-python-client" not in workflow


def test_source_collection_schedules_precede_derived_publisher():
    publisher = (ROOT / ".github" / "workflows" / "derived-measurement-publisher.yml").read_text(encoding="utf-8")
    assert 'cron: "47 1 * * *"' in (ROOT / ".github/workflows/adsense-collection.yml").read_text(encoding="utf-8")
    assert 'cron: "17 2 * * *"' in (ROOT / ".github/workflows/ga4-collection.yml").read_text(encoding="utf-8")
    assert 'cron: "47 2 * * *"' in _workflow_text()
    assert 'cron: "17 3 * * *"' in publisher


def test_gsc_workflow_keeps_page_and_sidecar_collection_without_derived_publication():
    workflow = _workflow_text()

    assert "collection_mode:" in workflow
    assert "default: page" in workflow
    assert "options: [page, camping-query, opportunity-query, sitewide-query]" in workflow
    assert "schedule:" in workflow
    assert "workflow_dispatch:" in workflow

    page_only = "if: github.event_name != 'workflow_dispatch' || inputs.collection_mode == 'page'"
    assert page_only in _step_block(workflow, "Collect GSC page snapshot")
    source_commit = _step_block(workflow, "Commit refreshed GSC measurement artifacts")
    assert "git add data/performance/gsc-latest.json" in source_commit
    assert "scripts/revenue_growth.py" not in workflow
    for derived_artifact in ("data/page-performance.json", "data/revenue-opportunities.json", "reports/revenue-growth-report.md"):
        assert derived_artifact not in workflow


def test_page_mode_preserves_old_outputs_without_collecting_or_committing_query_artifact():
    workflow = _workflow_text()
    assert "data/performance/gsc-latest.json" in _step_block(workflow, "Collect GSC page snapshot")
    source_commit = _step_block(workflow, "Commit refreshed GSC measurement artifacts")
    assert "data/performance/gsc-camp-query-latest.json" not in source_commit


def test_camping_query_mode_isolated_from_page_and_revenue_outputs():
    workflow = _workflow_text()
    query_only = "if: github.event_name == 'workflow_dispatch' && inputs.collection_mode == 'camping-query'"

    assert query_only in _step_block(workflow, "Collect camping query evidence snapshot")
    assert query_only in _step_block(workflow, "Validate camping query evidence snapshot")
    assert query_only in _step_block(workflow, "Commit camping query evidence snapshot")
    assert "scripts/collect_gsc_camp_query_snapshot.py" in _step_block(
        workflow, "Collect camping query evidence snapshot"
    )
    assert "scripts/revenue_growth.py" not in _step_block(
        workflow, "Collect camping query evidence snapshot"
    )
    query_commit = _step_block(workflow, "Commit camping query evidence snapshot")
    assert "git add data/performance/gsc-camp-query-latest.json" in query_commit
    for forbidden in (
        "gsc-latest.json",
        "page-performance.json",
        "revenue-opportunities.json",
        "revenue-growth-report.md",
    ):
        assert forbidden not in query_commit


def test_camping_query_mode_skips_all_page_mode_collection_steps():
    workflow = _workflow_text()
    page_only = "if: github.event_name != 'workflow_dispatch' || inputs.collection_mode == 'page'"

    for name in (
        "Collect GSC page snapshot",
        "Commit refreshed GSC measurement artifacts",
    ):
        assert page_only in _step_block(workflow, name)


def test_opportunity_query_mode_isolated_and_commits_only_sidecar_artifact():
    workflow = _workflow_text()
    query_only = "if: github.event_name == 'workflow_dispatch' && inputs.collection_mode == 'opportunity-query'"

    for name in (
        "Collect current revenue opportunity query evidence",
        "Validate revenue opportunity query evidence snapshot",
        "Commit revenue opportunity query evidence snapshot",
    ):
        assert query_only in _step_block(workflow, name)
    collection = _step_block(workflow, "Collect current revenue opportunity query evidence")
    assert "scripts/collect_gsc_opportunity_query_snapshot.py" in collection
    commit = _step_block(workflow, "Commit revenue opportunity query evidence snapshot")
    assert "git add data/performance/gsc-opportunity-queries-latest.json" in commit
    for forbidden in (
        "gsc-latest.json",
        "page-performance.json",
        "revenue-opportunities.json",
        "revenue-growth-report.md",
        "gsc-camp-query-latest.json",
    ):
        assert forbidden not in commit
    page_only = "if: github.event_name != 'workflow_dispatch' || inputs.collection_mode == 'page'"
    assert page_only in _step_block(workflow, "Collect GSC page snapshot")
    assert "opportunity-query" in workflow


def test_sitewide_query_mode_is_manual_only_and_skips_page_refresh():
    workflow = _workflow_text()
    scheduled = workflow.split("  workflow_dispatch:", 1)[0]
    collect = _step_block(workflow, "Collect site-wide page-query evidence snapshot")
    page_only = "if: github.event_name != 'workflow_dispatch' || inputs.collection_mode == 'page'"

    assert "sitewide-query" not in scheduled
    assert "if: github.event_name == 'workflow_dispatch' && inputs.collection_mode == 'sitewide-query'" in collect
    assert "scripts/collect_gsc_sitewide_query_snapshot.py" in collect
    assert "$RUNNER_TEMP/gsc-sitewide-query.json" in collect
    assert page_only in _step_block(workflow, "Collect GSC page snapshot")
    assert "scripts/revenue_growth.py" not in workflow


def test_sitewide_query_mode_validates_and_uploads_bounded_artifact():
    workflow = _workflow_text()
    manual_only = "if: github.event_name == 'workflow_dispatch' && inputs.collection_mode == 'sitewide-query'"
    validation = _step_block(workflow, "Validate site-wide page-query evidence snapshot")
    upload = _step_block(workflow, "Upload site-wide page-query evidence artifact")

    assert manual_only in validation
    assert "validate_snapshot" in validation
    assert "$RUNNER_TEMP/gsc-sitewide-query.json" in validation
    assert manual_only in upload
    assert "actions/upload-artifact@v4" in upload
    assert "${{ runner.temp }}/gsc-sitewide-query.json" in upload
    assert "retention-days: 7" in upload
    assert "if-no-files-found: error" in upload


def test_sitewide_raw_artifact_is_never_added_or_committed():
    workflow = _workflow_text()
    collect = _step_block(workflow, "Collect site-wide page-query evidence snapshot")
    validate = _step_block(workflow, "Validate site-wide page-query evidence snapshot")
    upload = _step_block(workflow, "Upload site-wide page-query evidence artifact")

    assert "git add" not in collect + validate + upload
    assert "git commit" not in collect + validate + upload
    assert "Commit site-wide page-query" not in workflow
    assert "git add data/performance/gsc-sitewide-query" not in workflow
    assert "git commit -m" not in upload


def test_existing_query_modes_keep_their_scoped_conditions_and_outputs():
    workflow = _workflow_text()
    assert "if: github.event_name == 'workflow_dispatch' && inputs.collection_mode == 'camping-query'" in _step_block(
        workflow, "Collect camping query evidence snapshot"
    )
    assert "if: github.event_name == 'workflow_dispatch' && inputs.collection_mode == 'opportunity-query'" in _step_block(
        workflow, "Collect current revenue opportunity query evidence"
    )
    assert "git add data/performance/gsc-camp-query-latest.json" in _step_block(
        workflow, "Commit camping query evidence snapshot"
    )
    assert "git add data/performance/gsc-opportunity-queries-latest.json" in _step_block(
        workflow, "Commit revenue opportunity query evidence snapshot"
    )
