from pathlib import Path


WORKFLOW = Path(__file__).parents[1] / ".github/workflows/keyword-hunter.yml"


def test_targeted_canary_is_read_only_and_artifact_only():
    workflow = WORKFLOW.read_text(encoding="utf-8")

    assert "on:\n  workflow_dispatch:" in workflow
    assert "permissions:\n  contents: read" in workflow
    assert "KEYWORD_HUNTER_TARGETS_JSON: '[\"윈도우 11 검색 창 새 UI 안 보임\"]'" in workflow
    assert "python3 scripts/keyword_hunter_targeted.py --root ." in workflow
    assert "actions/upload-artifact@v4" in workflow
    assert "retention-days: 7" in workflow
    assert "if-no-files-found: error" in workflow
    assert "reports/keyword-targeted-validation/${{ github.run_id }}-${{ github.run_attempt }}.json" in workflow
    assert "  validate-canary:" in workflow
    validation_job = workflow.split("  validate-canary:", 1)[1].split("  targeted-canary:", 1)[0]
    assert "secrets." not in validation_job

    for forbidden in (
        "keyword_hunter_persist.py",
        "git push",
        "git commit",
        "contents: write",
        "actions/deploy-pages",
        "upload-pages-artifact",
        "pages: write",
        "id-token: write",
        "  schedule:",
        "  push:",
        "  pull_request:",
    ):
        assert forbidden not in workflow

    assert workflow.count("scripts/keyword_hunter_targeted.py") == 1
