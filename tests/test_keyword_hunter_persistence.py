import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
PERSIST = ROOT / "scripts/keyword_hunter_persist.py"


def _git(cwd, *args, check=True, env=None):
    return subprocess.run(
        ["git", *args], cwd=cwd, text=True, capture_output=True, check=check, env=env
    )


def _write(root, relative, text):
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _seed_repo(root, origin):
    root.mkdir(parents=True)
    _git(root, "init", "--initial-branch=main", "-q")
    _git(root, "config", "user.name", "Keyword Hunter race test")
    _git(root, "config", "user.email", "keyword-hunter-race@example.invalid")
    _write(root, "data/keywords_master.csv", "keyword,status\nbase,NEW\n")
    _write(root, "data/keyword_seeds.json", '{"seeds": []}\n')
    _write(root, "data/keyword_clusters.json", "{}\n")
    _write(root, "data/rejected_keywords.json", "[]\n")
    _write(root, "data/recent_exploration_history.json", '{"runs": []}\n')
    _write(root, "data/api_usage.json", "{}\n")
    _write(root, "data/existing-page-improvement-candidates.json", '{"candidates": []}\n')
    _write(root, "data/content-launch-queue.json", '{"dailyLimit": 3, "queue": []}\n')
    _write(root, "data/published_keywords.json", "[]\n")
    _write(root, "data/content-launch-counter.json", "{}\n")
    _write(root, "data/content-launch-manifest.json", "{}\n")
    _write(root, "data/content-launch-decisions.json", "{}\n")
    _write(root, "data/keyword-targeted-validation/latest.json", '{"status": "baseline"}\n')
    _write(root, "PROJECT_HISTORY.md", "# Project history\n")
    _write(root, "TASKS.md", "# Tasks\n")
    _write(root, "kor/report/stock/example.html", '<a href="old.html">link</a>\n')
    _git(root, "add", "-A")
    _git(root, "commit", "-m", "fixture baseline")
    base_sha = _git(root, "rev-parse", "HEAD").stdout.strip()
    _git(root, "remote", "add", "origin", str(origin))
    _git(root, "push", "-u", "origin", "main")
    return base_sha


def _fixture(tmp_path):
    origin = tmp_path / "origin.git"
    _git(tmp_path, "init", "--bare", "--initial-branch=main", "-q", str(origin))
    seed = tmp_path / "seed"
    base_sha = _seed_repo(seed, origin)
    runner = tmp_path / "runner"
    _git(tmp_path, "clone", str(origin), str(runner))
    _git(runner, "config", "user.name", "Keyword Hunter race test")
    _git(runner, "config", "user.email", "keyword-hunter-race@example.invalid")
    competitor = tmp_path / "competitor"
    _git(tmp_path, "clone", str(origin), str(competitor))
    _git(competitor, "config", "user.name", "Concurrent main update")
    _git(competitor, "config", "user.email", "concurrent-main@example.invalid")
    return origin, base_sha, runner, competitor


def _measurement_outputs(runner, history=True, reports=False):
    _write(runner, "data/keywords_master.csv", "keyword,status\nbase,NEW\nmeasured,NEW\n")
    _write(runner, "data/api_usage.json", '{"run": "once"}\n')
    _write(runner, "data/content-launch-queue.json", '{"dailyLimit": 3, "queue": []}\n')
    if history:
        with (runner / "PROJECT_HISTORY.md").open("a", encoding="utf-8") as f:
            f.write("\n## Keyword Hunter run\n- Measurements collected once.\n")
    if reports:
        _write(runner, "reports/keyword-hunter/2099-12-31-2359.md", "broad report artifact\n")


def _remote_commit(repo, message="Unrelated main update"):
    _git(repo, "add", "-A")
    _git(repo, "commit", "-m", message)
    sha = _git(repo, "rev-parse", "HEAD").stdout.strip()
    _git(repo, "push", "origin", "main")
    return sha


def _run_persist(runner, base_sha, tmp_path, mode="broad", env=None):
    diag = tmp_path / "keyword-hunter-persistence"
    run_env = {
        **os.environ,
        
        "RUNNER_TEMP": str(tmp_path),
        "GITHUB_SHA": base_sha,
        "GITHUB_RUN_ID": "321",
        "GITHUB_RUN_ATTEMPT": "2",
    }
    run_env.update(env or {})
    run_env.pop("PYTHONPATH", None)
    return subprocess.run(
        ["python3", str(PERSIST), "--mode", mode, "--base-sha", base_sha,
         "--root", str(runner), "--diagnostics-dir", str(diag)],
        cwd=runner, env=run_env, text=True, capture_output=True,
    )


def _remote_sha(origin):
    return _git(origin.parent, "--git-dir", str(origin), "rev-parse", "refs/heads/main").stdout.strip()


def _show(repo, sha, path):
    return _git(repo, "show", f"{sha}:{path}").stdout


def test_scheduled_persistence_recovers_non_fast_forward_without_losing_pr64_changes(tmp_path):
    origin, base_sha, runner, competitor = _fixture(tmp_path)
    _measurement_outputs(runner)
    with (competitor / "PROJECT_HISTORY.md").open("a", encoding="utf-8") as f:
        f.write("\n## PR 64\n- Preserved unrelated project history.\n")
    _write(competitor, "TASKS.md", "# Tasks\nPR 64 update\n")
    _write(competitor, "kor/report/stock/example.html", '<a href="new.html">link</a>\n')
    competitor_sha = _remote_commit(competitor, "PR 64 unrelated update")

    result = _run_persist(runner, base_sha, tmp_path)
    assert result.returncode == 0, result.stderr + result.stdout
    final_sha = _remote_sha(origin)
    assert "measured,NEW" in _show(runner, final_sha, "data/keywords_master.csv")
    assert _show(runner, final_sha, "TASKS.md") == "# Tasks\nPR 64 update\n"
    assert _show(runner, final_sha, "kor/report/stock/example.html") == '<a href="new.html">link</a>\n'
    history = _show(runner, final_sha, "PROJECT_HISTORY.md")
    assert "Preserved unrelated project history." in history
    assert "Measurements collected once." in history
    assert _show(runner, final_sha, "data/published_keywords.json") == "[]\n"
    assert _git(runner, "merge-base", "--is-ancestor", competitor_sha, final_sha, check=False).returncode == 0
    provenance = json.loads((tmp_path / "keyword-hunter-persistence/persistence-provenance.json").read_text())
    assert provenance["pushAttempts"] == 2
    assert provenance["result"] == "recovered_and_pushed"


def test_no_concurrent_change_pushes_normally(tmp_path):
    origin, base_sha, runner, _ = _fixture(tmp_path)
    _measurement_outputs(runner)
    result = _run_persist(runner, base_sha, tmp_path)
    assert result.returncode == 0, result.stderr + result.stdout
    assert _git(runner, "merge-base", "--is-ancestor", base_sha, _remote_sha(origin), check=False).returncode == 0
    assert "measured,NEW" in _show(runner, _remote_sha(origin), "data/keywords_master.csv")
    provenance = json.loads((tmp_path / "keyword-hunter-persistence/persistence-provenance.json").read_text())
    assert provenance["pushAttempts"] == 1


def test_same_measurement_file_change_fails_closed_and_retains_patch(tmp_path):
    origin, base_sha, runner, competitor = _fixture(tmp_path)
    _measurement_outputs(runner)
    _write(competitor, "data/api_usage.json", '{"concurrent": "newer"}\n')
    _remote_commit(competitor)
    result = _run_persist(runner, base_sha, tmp_path)
    assert result.returncode != 0
    final_sha = _remote_sha(origin)
    assert _show(runner, final_sha, "data/api_usage.json") == '{"concurrent": "newer"}\n'
    diag = tmp_path / "keyword-hunter-persistence"
    assert (diag / "pending-all-approved-state.patch").is_file()
    assert "Remote measurement output changed" in (diag / "failure.txt").read_text()
    provenance = json.loads((diag / "persistence-provenance.json").read_text())
    assert provenance["pushAttempts"] == 1
    assert provenance["result"] == "failed_closed"


def test_remote_publication_state_change_fails_closed_and_preserves_state(tmp_path):
    origin, base_sha, runner, competitor = _fixture(tmp_path)
    _measurement_outputs(runner)
    _write(competitor, "data/published_keywords.json", '[{"keyword": "published-new"}]\n')
    _remote_commit(competitor)
    result = _run_persist(runner, base_sha, tmp_path)
    assert result.returncode != 0
    assert _show(runner, _remote_sha(origin), "data/published_keywords.json") == '[{"keyword": "published-new"}]\n'
    assert "Remote publication state changed" in (tmp_path / "keyword-hunter-persistence/failure.txt").read_text()


def test_second_remote_advance_is_bounded_and_keeps_recovery_diagnostics(tmp_path):
    origin, base_sha, runner, competitor = _fixture(tmp_path)
    _measurement_outputs(runner)
    _write(competitor, "TASKS.md", "# Tasks\nfirst concurrent update\n")
    _remote_commit(competitor, "first concurrent update")
    racing = tmp_path / "racing"
    _git(tmp_path, "clone", str(origin), str(racing))
    _git(racing, "config", "user.name", "Second concurrent update")
    _git(racing, "config", "user.email", "second-concurrent@example.invalid")

    shim_dir = tmp_path / "git-shim"
    shim_dir.mkdir()
    count_file = tmp_path / "push-count"
    shim = shim_dir / "git"
    shim.write_text(
        "#!/usr/bin/env python3\n"
        "import os, pathlib, subprocess, sys\n"
        "real = os.environ['REAL_GIT']\n"
        "args = sys.argv[1:]\n"
        "if args and args[0] == 'push':\n"
        " p=pathlib.Path(os.environ['PUSH_COUNT_FILE']); n=int(p.read_text() if p.exists() else '0')+1; p.write_text(str(n))\n"
        " if n == 2:\n"
        "  r=os.environ['RACING_REPO']; pathlib.Path(r, 'TASKS.md').write_text('# Tasks\\nsecond concurrent update\\n')\n"
        "  subprocess.run([real, 'add', 'TASKS.md'], cwd=r, check=True)\n"
        "  subprocess.run([real, 'commit', '-m', 'second concurrent update'], cwd=r, check=True, stdout=subprocess.DEVNULL)\n"
        "  subprocess.run([real, 'push', 'origin', 'main'], cwd=r, check=True, stdout=subprocess.DEVNULL)\n"
        "r=subprocess.run([real, *args]); sys.exit(r.returncode)\n",
        encoding="utf-8",
    )
    shim.chmod(0o755)
    env = {
        "PATH": str(shim_dir) + os.pathsep + os.environ["PATH"],
        "REAL_GIT": shutil.which("git"),
        "PUSH_COUNT_FILE": str(count_file),
        "RACING_REPO": str(racing),
    }
    result = _run_persist(runner, base_sha, tmp_path, env=env)
    assert result.returncode != 0
    assert count_file.read_text() == "2"
    assert "Single recovery push failed" in (tmp_path / "keyword-hunter-persistence/failure.txt").read_text()
    assert (tmp_path / "keyword-hunter-persistence/pending-measurements.patch").is_file()


def test_invalid_measurement_output_is_not_promoted(tmp_path):
    origin, base_sha, runner, _ = _fixture(tmp_path)
    _write(runner, "data/keywords_master.csv", "wrong,columns\nno,status\n")
    result = _run_persist(runner, base_sha, tmp_path)
    assert result.returncode != 0
    assert _remote_sha(origin) == base_sha
    assert "Invalid master schema" in result.stderr


def test_no_generated_changes_create_no_commit_or_push(tmp_path):
    origin, base_sha, runner, _ = _fixture(tmp_path)
    result = _run_persist(runner, base_sha, tmp_path)
    assert result.returncode == 0, result.stderr + result.stdout
    assert _remote_sha(origin) == base_sha
    assert _git(runner, "rev-parse", "HEAD").stdout.strip() == base_sha
    assert json.loads((tmp_path / "keyword-hunter-persistence/persistence-provenance.json").read_text())["result"] == "no_changes"


def test_recovery_failure_has_clear_error_and_preserved_evidence(tmp_path):
    origin, base_sha, runner, competitor = _fixture(tmp_path)
    _measurement_outputs(runner)
    _write(competitor, "scripts/keyword_hunter_core.py", "# changed execution policy\n")
    _remote_commit(competitor, "concurrent policy change")
    result = _run_persist(runner, base_sha, tmp_path)
    assert result.returncode != 0
    diag = tmp_path / "keyword-hunter-persistence"
    assert "Remote data or execution policy changed" in (diag / "failure.txt").read_text()
    assert (diag / "pending-all-approved-state.patch").is_file()
    assert json.loads((diag / "persistence-provenance.json").read_text())["result"] == "failed_closed"


def test_targeted_mode_only_persists_targeted_outputs(tmp_path):
    origin, base_sha, runner, _ = _fixture(tmp_path)
    _write(runner, "data/keyword-targeted-validation/latest.json", '{"status": "validated"}\n')
    _write(runner, "data/api_usage.json", '{"targeted": true}\n')
    _write(runner, "reports/keyword-targeted-validation/321-2.json", '{"target": "example"}\n')
    _write(runner, "reports/keyword-hunter/new-report.md", "artifact only\n")
    result = _run_persist(runner, base_sha, tmp_path, mode="targeted")
    assert result.returncode == 0, result.stderr + result.stdout
    committed = set(_git(runner, "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD").stdout.splitlines())
    assert committed == {
        "data/keyword-targeted-validation/latest.json",
        "data/api_usage.json",
        "reports/keyword-targeted-validation/321-2.json",
    }
    assert _git(runner, "cat-file", "-e", "HEAD:reports/keyword-hunter/new-report.md", check=False).returncode != 0


def test_broad_reports_stay_out_of_git_and_diagnostics_are_uploaded_by_workflow(tmp_path):
    origin, base_sha, runner, _ = _fixture(tmp_path)
    _measurement_outputs(runner, reports=True)
    result = _run_persist(runner, base_sha, tmp_path)
    assert result.returncode == 0, result.stderr + result.stdout
    assert _git(runner, "cat-file", "-e", "HEAD:reports/keyword-hunter/2099-12-31-2359.md", check=False).returncode != 0
    workflow = (ROOT / ".github/workflows/keyword-hunter.yml").read_text(encoding="utf-8")
    upload = workflow.split("- name: Upload latest reports", 1)[1]
    assert "$" + "{{ runner.temp }}/keyword-hunter-persistence/" in upload
    assert "retention-days: 30" in upload


def test_broad_direct_entrypoint_runs_without_pythonpath(tmp_path):
    origin, base_sha, runner, _ = _fixture(tmp_path)
    _measurement_outputs(runner)

    result = _run_persist(runner, base_sha, tmp_path)

    assert result.returncode == 0, result.stderr + result.stdout
    final_sha = _remote_sha(origin)
    assert "measured,NEW" in _show(runner, final_sha, "data/keywords_master.csv")


def test_targeted_direct_entrypoint_runs_without_pythonpath(tmp_path):
    origin, base_sha, runner, _ = _fixture(tmp_path)
    _write(runner, "data/keyword-targeted-validation/latest.json", '{"status": "validated"}\n')
    _write(runner, "data/api_usage.json", '{"targeted": true}\n')
    _write(runner, "reports/keyword-targeted-validation/321-2.json", '{"target": "example"}\n')

    result = _run_persist(runner, base_sha, tmp_path, mode="targeted")

    assert result.returncode == 0, result.stderr + result.stdout
    final_sha = _remote_sha(origin)
    assert _show(runner, final_sha, "reports/keyword-targeted-validation/321-2.json") == '{"target": "example"}\n'


def test_targeted_direct_entrypoint_recovers_safe_concurrent_main_update_without_pythonpath(tmp_path):
    origin, base_sha, runner, competitor = _fixture(tmp_path)
    _write(runner, "data/keyword-targeted-validation/latest.json", '{"status": "validated"}\n')
    _write(runner, "data/api_usage.json", '{"targeted": true}\n')
    _write(runner, "reports/keyword-targeted-validation/321-2.json", '{"target": "example"}\n')
    _write(competitor, "TASKS.md", "# Tasks\nUnrelated concurrent update\n")
    competitor_sha = _remote_commit(competitor)

    result = _run_persist(runner, base_sha, tmp_path, mode="targeted")

    assert result.returncode == 0, result.stderr + result.stdout
    final_sha = _remote_sha(origin)
    assert _show(runner, final_sha, "TASKS.md") == "# Tasks\nUnrelated concurrent update\n"
    assert _show(runner, final_sha, "reports/keyword-targeted-validation/321-2.json") == '{"target": "example"}\n'
    assert _git(runner, "merge-base", "--is-ancestor", competitor_sha, final_sha, check=False).returncode == 0
    provenance = json.loads((tmp_path / "keyword-hunter-persistence/persistence-provenance.json").read_text())
    assert provenance["pushAttempts"] == 2
    assert provenance["result"] == "recovered_and_pushed"

