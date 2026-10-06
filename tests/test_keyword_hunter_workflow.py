import json
from pathlib import Path
import os
import re
import subprocess


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


def _review_queue_item(**overrides):
    item = {
        "status": "READY_TO_LAUNCH",
        "review_status": "PAGE_REVIEW_READY",
        "suggested_url": "/kor/guide/example.html",
    }
    item.update(overrides)
    return item


def _run_review_queue_validator(queue, root):
    queue_path = root / "data" / "content-launch-queue.json"
    queue_path.parent.mkdir(parents=True, exist_ok=True)
    queue_path.write_text(json.dumps(queue), encoding="utf-8")

    workflow = (ROOT / ".github/workflows/keyword-hunter.yml").read_text(encoding="utf-8")
    script = _step_script(_workflow_step(workflow, "Validate supervised review queue"))
    return subprocess.run(
        ["bash", "-e", "-o", "pipefail", "-c", script],
        cwd=root,
        env={**os.environ, "PYTHONPATH": str(ROOT)},
        text=True,
        capture_output=True,
    )


def test_supervised_queue_validator_accepts_one_two_and_three_items_at_daily_limit_three(tmp_path):
    for count in (1, 2, 3):
        result = _run_review_queue_validator(
            {"dailyLimit": 3, "queue": [_review_queue_item() for _ in range(count)]},
            tmp_path,
        )
        assert result.returncode == 0, result.stderr + result.stdout


def test_supervised_queue_validator_rejects_four_items_at_daily_limit_three(tmp_path):
    result = _run_review_queue_validator(
        {"dailyLimit": 3, "queue": [_review_queue_item() for _ in range(4)]},
        tmp_path,
    )
    assert result.returncode != 0


def test_supervised_queue_validator_rejects_daily_limit_above_canonical_policy(tmp_path):
    result = _run_review_queue_validator(
        {"dailyLimit": 4, "queue": [_review_queue_item()]},
        tmp_path,
    )
    assert result.returncode != 0


def test_supervised_queue_validator_rejects_non_integer_daily_limit(tmp_path):
    result = _run_review_queue_validator(
        {"dailyLimit": "999", "queue": [_review_queue_item()]},
        tmp_path,
    )
    assert result.returncode != 0


def test_supervised_queue_validator_keeps_ready_to_launch_guard(tmp_path):
    result = _run_review_queue_validator(
        {"dailyLimit": 3, "queue": [_review_queue_item(status="CANDIDATE")]},
        tmp_path,
    )
    assert result.returncode != 0


def test_supervised_queue_validator_keeps_page_review_ready_guard(tmp_path):
    result = _run_review_queue_validator(
        {"dailyLimit": 3, "queue": [_review_queue_item(review_status="HOLD")]},
        tmp_path,
    )
    assert result.returncode != 0


def test_supervised_queue_validator_keeps_korean_url_guard(tmp_path):
    result = _run_review_queue_validator(
        {"dailyLimit": 3, "queue": [_review_queue_item(suggested_url="/eng/guide/example.html")]},
        tmp_path,
    )
    assert result.returncode != 0


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


def _workflow_step(text, name):
    marker = f"      - name: {name}"
    start = text.index(marker)
    end = text.find("\n      - name:", start + len(marker))
    return text[start:] if end < 0 else text[start:end]


def _step_script(step):
    lines = step.splitlines()
    run_index = next(i for i, line in enumerate(lines) if line.strip() == "run: |")
    script = []
    for line in lines[run_index + 1:]:
        if line.strip() and len(line) - len(line.lstrip()) < 10:
            break
        script.append(line[10:] if line.strip() else "")
    return "\n".join(script)


def _git(root, *args):
    return subprocess.run(
        ["git", *args], cwd=root, text=True, capture_output=True, check=True
    )


def _init_persistence_fixture(root):
    _git(root, "init", "-q")
    _git(root, "config", "user.name", "C13 persistence test")
    _git(root, "config", "user.email", "c13-test@example.invalid")
    paths = (
        "data/keywords_master.csv",
        "data/keyword_seeds.json",
        "data/keyword_clusters.json",
        "data/rejected_keywords.json",
        "data/recent_exploration_history.json",
        "data/api_usage.json",
        "data/existing-page-improvement-candidates.json",
        "data/content-launch-queue.json",
        "data/published_keywords.json",
        "data/content-launch-counter.json",
        "data/content-launch-manifest.json",
        "data/content-launch-decisions.json",
        "data/keyword-targeted-validation/latest.json",
        "PROJECT_HISTORY.md",
        "reports/keyword-hunter/2026-01-01-0000.md",
        "reports/keyword-targeted-validation/1-1.json",
        "kor/c13-persistence-fixture.html",
    )
    for relative in paths:
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("baseline\n", encoding="utf-8")
    _git(root, "add", "-A")
    _git(root, "commit", "-m", "fixture baseline")


def _stage_names(root):
    return set(_git(root, "diff", "--cached", "--name-only").stdout.splitlines())


def _broad_report_guard(script):
    lines = script.splitlines()
    start = next((i for i, line in enumerate(lines)
                  if line.startswith("if git diff --cached --name-only | grep -Eq ")), None)
    if start is None:
        return None
    end = next((i for i in range(start + 1, len(lines)) if lines[i] == "fi"), None)
    return None if end is None else "\n".join(lines[start:end + 1])


def test_measured_persistence_stages_state_but_not_reports_or_content(tmp_path):
    _init_persistence_fixture(tmp_path)
    state_paths = {
        "data/keywords_master.csv",
        "data/keyword_seeds.json",
        "data/keyword_clusters.json",
        "data/rejected_keywords.json",
        "data/recent_exploration_history.json",
        "data/api_usage.json",
        "data/existing-page-improvement-candidates.json",
        "data/content-launch-queue.json",
        "PROJECT_HISTORY.md",
    }
    protected_paths = {
        "data/published_keywords.json",
        "data/content-launch-counter.json",
        "data/content-launch-manifest.json",
        "data/content-launch-decisions.json",
        "kor/c13-persistence-fixture.html",
        "data/keyword-targeted-validation/latest.json",
        "reports/keyword-targeted-validation/1-1.json",
    }
    for relative in state_paths | protected_paths:
        (tmp_path / relative).write_text("updated\n", encoding="utf-8")
    report = "reports/keyword-hunter/2099-12-31-2359.md"
    report_path = tmp_path / report
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text("generated broad report\n", encoding="utf-8")

    workflow = (ROOT / ".github/workflows/keyword-hunter.yml").read_text(encoding="utf-8")
    script = _step_script(_workflow_step(workflow, "Persist measured state"))
    add_commands = [line for line in script.splitlines() if line.strip().startswith("git add ")]
    guard = _broad_report_guard(script)
    shell = "\n".join(add_commands + ([guard] if guard else []))
    result = subprocess.run(
        ["bash", "-e", "-o", "pipefail", "-c", shell],
        cwd=tmp_path, text=True, capture_output=True,
    )
    assert result.returncode == 0, result.stderr + result.stdout

    staged = _stage_names(tmp_path)
    assert staged == state_paths
    assert report not in staged
    assert not (staged & protected_paths)


def test_measured_persistence_guard_rejects_accidentally_staged_broad_report(tmp_path):
    _init_persistence_fixture(tmp_path)
    report = "reports/keyword-hunter/2099-12-31-2359.md"
    path = tmp_path / report
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("generated broad report\n", encoding="utf-8")
    _git(tmp_path, "add", report)

    workflow = (ROOT / ".github/workflows/keyword-hunter.yml").read_text(encoding="utf-8")
    script = _step_script(_workflow_step(workflow, "Persist measured state"))
    guard = _broad_report_guard(script)
    assert guard is not None
    result = subprocess.run(
        ["bash", "-e", "-o", "pipefail", "-c", guard],
        cwd=tmp_path, text=True, capture_output=True,
    )
    assert result.returncode != 0
    assert "::error::" in result.stdout


def test_targeted_persistence_stages_only_targeted_measurements(tmp_path):
    _init_persistence_fixture(tmp_path)
    expected = {
        "data/keyword-targeted-validation/latest.json",
        "data/api_usage.json",
        "reports/keyword-targeted-validation/321-2.json",
    }
    for relative in expected:
        path = tmp_path / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("targeted result\n", encoding="utf-8")
    broad = tmp_path / "reports/keyword-hunter/2099-12-31-2359.md"
    broad.write_text("generated broad report\n", encoding="utf-8")
    (tmp_path / "kor/c13-persistence-fixture.html").write_text("changed html\n", encoding="utf-8")

    workflow = (ROOT / ".github/workflows/keyword-hunter.yml").read_text(encoding="utf-8")
    script = _step_script(_workflow_step(workflow, "Persist targeted measurement"))
    stop = script.index("git diff --cached --quiet || git commit")
    result = subprocess.run(
        ["bash", "-e", "-o", "pipefail", "-c", script[:stop]],
        cwd=tmp_path, env={**os.environ, "GITHUB_RUN_ID": "321", "GITHUB_RUN_ATTEMPT": "2"},
        text=True, capture_output=True,
    )
    assert result.returncode == 0, result.stderr + result.stdout
    assert _stage_names(tmp_path) == expected


def test_report_artifact_upload_is_bounded_and_keeps_targeted_directory():
    workflow = (ROOT / ".github/workflows/keyword-hunter.yml").read_text(encoding="utf-8")
    upload = _workflow_step(workflow, "Upload latest reports")
    assert "uses: actions/upload-artifact@v4" in upload
    assert "reports/keyword-hunter/" in upload
    assert "reports/keyword-targeted-validation/" in upload
    assert re.search(r"(?m)^\s*retention-days:\s*30\s*$", upload)


def test_historical_broad_reports_remain_tracked_and_unmodified():
    tracked = subprocess.check_output(
        ["git", "ls-tree", "-r", "--name-only", "HEAD", "reports/keyword-hunter"],
        cwd=ROOT, text=True,
    ).splitlines()
    assert len(tracked) >= 131
    assert all((ROOT / relative).is_file() for relative in tracked)
    for args in (
        ["diff", "--name-status", "HEAD"],
        ["diff", "--cached", "--name-status", "HEAD"],
    ):
        changes = subprocess.check_output(["git", *args], cwd=ROOT, text=True).splitlines()
        assert not any(
            line.startswith("D\t") and line.split("\t", 1)[1].startswith("reports/keyword-hunter/")
            for line in changes
        )
