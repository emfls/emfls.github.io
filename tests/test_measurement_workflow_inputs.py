from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def _measurement_command(workflow):
    text = (ROOT / ".github" / "workflows" / workflow).read_text(encoding="utf-8")
    start = text.index("python3 scripts/revenue_growth.py")
    return text[start : text.index("\n", text.index("--report", start))]


def _workflow_text():
    return (ROOT / ".github" / "workflows" / "gsc-collection.yml").read_text(encoding="utf-8")


def _step_block(workflow, name):
    marker = f"      - name: {name}"
    start = workflow.index(marker)
    next_step = workflow.find("\n      - ", start + len(marker))
    return workflow[start : next_step if next_step >= 0 else len(workflow)]


def test_ga4_refresh_regenerates_measurements_with_latest_gsc_snapshot():
    command = _measurement_command("ga4-collection.yml")

    assert "--performance data/performance/ga4-latest.json" in command
    assert "--gsc-snapshot data/performance/gsc-latest.json" in command
    assert "--page-output data/page-performance.json" in command


def test_gsc_refresh_keeps_using_gsc_snapshot_for_measurement_regeneration():
    command = _measurement_command("gsc-collection.yml")

    assert "--gsc-snapshot data/performance/gsc-latest.json" in command


def test_gsc_workflow_defaults_to_page_mode_for_schedule_and_manual_runs():
    workflow = _workflow_text()

    assert "collection_mode:" in workflow
    assert "default: page" in workflow
    assert "options: [page, camping-query]" in workflow
    assert "schedule:" in workflow
    assert "workflow_dispatch:" in workflow

    page_only = "if: github.event_name != 'workflow_dispatch' || inputs.collection_mode == 'page'"
    assert page_only in _step_block(workflow, "Collect GSC page snapshot")
    assert page_only in _step_block(workflow, "Regenerate measurement artifacts from GA4 and GSC snapshots")
    assert page_only in _step_block(workflow, "Validate GSC and measurement artifacts")
    assert page_only in _step_block(workflow, "Commit refreshed GSC measurement artifacts")


def test_page_mode_preserves_old_outputs_without_collecting_or_committing_query_artifact():
    workflow = _workflow_text()
    command = _measurement_command("gsc-collection.yml")

    assert "--gsc-snapshot data/performance/gsc-latest.json" in command
    assert "--page-output data/page-performance.json" in command
    assert "gsc-camp-query-latest.json" not in command
    assert "data/performance/gsc-camp-query-latest.json" not in _step_block(
        workflow, "Commit refreshed GSC measurement artifacts"
    )


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
        "Regenerate measurement artifacts from GA4 and GSC snapshots",
        "Validate GSC and measurement artifacts",
        "Commit refreshed GSC measurement artifacts",
    ):
        assert page_only in _step_block(workflow, name)
