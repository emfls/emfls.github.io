from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_keyword_hunter_has_bounded_scheduled_workflow():
    text = (ROOT / ".github/workflows/keyword-hunter.yml").read_text(encoding="utf-8")
    assert 'cron: "17 */2 * * *"' in text
    assert "workflow_dispatch:" in text
    assert "contents: write" in text
    assert "python3 scripts/keyword_hunter.py" in text
    assert "NAVER_SEARCHAD_API_KEY: ${{ secrets.NAVER_SEARCHAD_API_KEY }}" in text
    assert "NAVER_API_HUB_CLIENT_ID: ${{ secrets.NAVER_API_HUB_CLIENT_ID }}" in text
    assert "data/existing-page-improvement-candidates.json" in text
    assert "git add data/keywords_master.csv" in text
    assert "git add ." not in text
    assert ".env" not in text
    assert "Protect publication state" in text
    assert "git add data/rejected_keywords.json data/recent_exploration_history.json" in text
    assert "git add data/published_keywords.json" not in text
    assert "prepare_keyword_launch.py" in text
    assert "PAGE_REVIEW_READY" in text
    assert "github-actions[bot]" in text

def test_keyword_hunter_workflow_keeps_publication_state_and_content_protected():
    text = (ROOT / ".github/workflows/keyword-hunter.yml").read_text(encoding="utf-8")
    guard = text.split("- name: Protect publication state", 1)[1].split("- name: Persist measured state", 1)[0]
    for path in (
        "data/published_keywords.json",
        "data/content-launch-counter.json",
        "data/content-launch-manifest.json",
        "data/content-launch-decisions.json",
    ):
        assert path in guard
    assert "^.. kor/.*\\.html$" in guard
    assert "git add data/content-launch-manifest.json" not in text
    assert "git add data/content-launch-counter.json" not in text

def test_targeted_dispatch_is_explicit_and_does_not_change_scheduled_or_default_broad_run():
    text = (ROOT / ".github/workflows/keyword-hunter.yml").read_text(encoding="utf-8")

    assert 'cron: "17 */2 * * *"' in text
    assert "mode:" in text
    assert "default: broad" in text
    assert "options: [broad, targeted]" in text
    assert "KEYWORD_HUNTER_TARGETS_JSON: ${{ inputs.keywords }}" in text
    broad = text.split("- name: Run Keyword Hunter", 1)[1].split("- name:", 1)[0]
    assert "python3 scripts/keyword_hunter.py" in broad
    assert "inputs.mode != 'targeted'" in broad

    targeted = text.split("- name: Run targeted Keyword Hunter measurement", 1)[1].split("- name:", 1)[0]
    assert "inputs.mode == 'targeted'" in targeted
    assert "python3 scripts/keyword_hunter_targeted.py" in targeted
    assert "inputs.keywords" not in targeted
    assert "prepare_keyword_launch.py" not in targeted

def test_targeted_persistence_is_limited_to_measurement_sidecars():
    text = (ROOT / ".github/workflows/keyword-hunter.yml").read_text(encoding="utf-8")
    targeted = text.split("- name: Persist targeted measurement", 1)[1].split("- name:", 1)[0]

    assert "data/keyword-targeted-validation/latest.json" in targeted
    assert "data/api_usage.json" in targeted
    assert "reports/keyword-targeted-validation" in targeted
    for forbidden in (
        "data/keywords_master.csv",
        "data/keyword_seeds.json",
        "data/keyword_clusters.json",
        "data/rejected_keywords.json",
        "data/published_keywords.json",
        "data/content-launch-queue.json",
        "data/content-launch-manifest.json",
        "git add .",
    ):
        assert forbidden not in targeted
