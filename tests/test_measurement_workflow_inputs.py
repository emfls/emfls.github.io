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


def test_ga4_refresh_scores_current_html_inventory_before_joining_snapshot_rows():
    workflow = (ROOT / ".github" / "workflows" / "ga4-collection.yml").read_text(encoding="utf-8")
    audit_step = _step_block(workflow, "Regenerate current site audit for GA4 measurement")
    scores_step = _step_block(workflow, "Regenerate current page scores for GA4 measurement")
    revenue_step = _step_block(workflow, "Regenerate measurement artifacts from GA4 snapshot")
    commit_step = _step_block(workflow, "Commit refreshed GA4 measurement artifacts")

    assert "scripts/seo_audit.py . --json /tmp/ga4-site-audit.json" in audit_step
    assert "scripts/quality_audit.py" in scores_step
    assert "--audit /tmp/ga4-site-audit.json" in scores_step
    assert "--page-output /tmp/ga4-page-scores.json" in scores_step
    assert "--audit /tmp/ga4-site-audit.json" in revenue_step
    assert "--page-scores /tmp/ga4-page-scores.json" in revenue_step
    assert "ga4-site-audit.json" not in commit_step
    assert "ga4-page-scores.json" not in commit_step
    assert workflow.index("Regenerate current site audit for GA4 measurement") < workflow.index(
        "Regenerate current page scores for GA4 measurement"
    ) < workflow.index("Regenerate measurement artifacts from GA4 snapshot")


def test_seo_qa_measurement_validator_uses_fresh_page_scores():
    workflow = (ROOT / ".github" / "workflows" / "seo-qa.yml").read_text(encoding="utf-8")

    assert "python3 scripts/validate_measurement_artifact.py data/page-performance.json --page-scores data/page-scores.json" in workflow


def test_ga4_measurement_validator_uses_the_fresh_temporary_page_scores():
    workflow = (ROOT / ".github" / "workflows" / "ga4-collection.yml").read_text(encoding="utf-8")
    validation = _step_block(workflow, "Validate measurement artifacts")

    assert "data/page-performance.json --page-scores /tmp/ga4-page-scores.json" in validation


def test_gsc_refresh_keeps_using_gsc_snapshot_for_measurement_regeneration():
    command = _measurement_command("gsc-collection.yml")

    assert "--gsc-snapshot data/performance/gsc-latest.json" in command


def test_gsc_page_refresh_generates_and_uses_a_fresh_indexable_inventory():
    workflow = _workflow_text()
    audit_step = _step_block(workflow, "Regenerate current site audit for GSC measurement")
    scores_step = _step_block(workflow, "Regenerate current page scores for GSC measurement")
    revenue_step = _step_block(workflow, "Regenerate measurement artifacts from GA4 and GSC snapshots")
    validation_step = _step_block(workflow, "Validate GSC and measurement artifacts")
    page_only = "if: github.event_name != 'workflow_dispatch' || inputs.collection_mode == 'page'"

    assert page_only in audit_step
    assert page_only in scores_step
    assert "scripts/seo_audit.py . --json /tmp/gsc-site-audit.json" in audit_step
    assert "scripts/quality_audit.py" in scores_step
    assert "--audit /tmp/gsc-site-audit.json" in scores_step
    assert "--page-output /tmp/gsc-page-scores.json" in scores_step
    assert "--audit /tmp/gsc-site-audit.json" in revenue_step
    assert "--page-scores /tmp/gsc-page-scores.json" in revenue_step
    assert "data/page-performance.json --page-scores /tmp/gsc-page-scores.json" in validation_step
    assert workflow.index("Regenerate current site audit for GSC measurement") < workflow.index(
        "Regenerate current page scores for GSC measurement"
    ) < workflow.index("Regenerate measurement artifacts from GA4 and GSC snapshots")


def test_gsc_workflow_defaults_to_page_mode_for_schedule_and_manual_runs():
    workflow = _workflow_text()

    assert "collection_mode:" in workflow
    assert "default: page" in workflow
    assert "options: [page, camping-query, opportunity-query, jp-travel-coverage]" in workflow
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


def test_ga4_jp_travel_coverage_mode_collects_distinct_56d_and_90d_sidecars_only():
    workflow = (ROOT / ".github" / "workflows" / "ga4-collection.yml").read_text(encoding="utf-8")
    coverage_only = "if: github.event_name == 'workflow_dispatch' && inputs.collection_mode == 'jp-travel-coverage'"
    refresh_only = "if: github.event_name != 'workflow_dispatch' || inputs.collection_mode == 'refresh'"

    assert "collection_mode:" in workflow
    assert "options: [refresh, jp-travel-coverage]" in workflow
    assert "default: refresh" in workflow
    for name in (
        "Collect GA4 latest snapshot",
        "Regenerate current site audit for GA4 measurement",
        "Regenerate current page scores for GA4 measurement",
        "Regenerate measurement artifacts from GA4 snapshot",
        "Validate measurement artifacts",
        "Commit refreshed GA4 measurement artifacts",
    ):
        assert refresh_only in _step_block(workflow, name)

    for days in (56, 90):
        collect = _step_block(workflow, f"Collect GA4 JP Travel {days}d coverage")
        assert coverage_only in collect
        assert f"--days {days}" in collect
        assert f"/tmp/ga4-jp-full-{days}d.json" in collect
        assert "--output data/performance/ga4-latest.json" not in collect
        scope = _step_block(workflow, f"Scope GA4 JP Travel {days}d coverage")
        assert coverage_only in scope
        assert "scripts/scope_jp_travel_measurement_snapshot.py" in scope
        assert "--source-type ga4" in scope
        assert f"data/performance/jp-travel-ga4-{days}d.json" in scope

    commit = _step_block(workflow, "Commit GA4 JP Travel coverage sidecars")
    assert coverage_only in commit
    assert "git add data/performance/jp-travel-ga4-56d.json data/performance/jp-travel-ga4-90d.json" in commit
    for forbidden in ("ga4-latest.json", "page-performance.json", "revenue-opportunities.json", "revenue-growth-report.md"):
        assert forbidden not in commit


def test_gsc_jp_travel_coverage_mode_preserves_existing_modes_and_commits_sidecars_only():
    workflow = _workflow_text()
    coverage_only = "if: github.event_name == 'workflow_dispatch' && inputs.collection_mode == 'jp-travel-coverage'"

    assert "options: [page, camping-query, opportunity-query, jp-travel-coverage]" in workflow
    assert "default: page" in workflow
    for days in (56, 90):
        collect = _step_block(workflow, f"Collect GSC JP Travel {days}d coverage")
        assert coverage_only in collect
        assert f"--days {days}" in collect
        assert f"/tmp/gsc-jp-full-{days}d.json" in collect
        assert "--output data/performance/gsc-latest.json" not in collect
        scope = _step_block(workflow, f"Scope GSC JP Travel {days}d coverage")
        assert coverage_only in scope
        assert "scripts/scope_jp_travel_measurement_snapshot.py" in scope
        assert "--source-type gsc" in scope
        assert f"data/performance/jp-travel-gsc-{days}d.json" in scope

    commit = _step_block(workflow, "Commit GSC JP Travel coverage sidecars")
    assert coverage_only in commit
    assert "git add data/performance/jp-travel-gsc-56d.json data/performance/jp-travel-gsc-90d.json" in commit
    for forbidden in ("gsc-latest.json", "page-performance.json", "revenue-opportunities.json", "revenue-growth-report.md"):
        assert forbidden not in commit

    existing_options = _step_block(workflow, "Collect camping query evidence snapshot")
    assert "collection_mode == 'camping-query'" in existing_options
    assert "collection_mode == 'opportunity-query'" in workflow
