import hashlib
import json
import subprocess
import sys

import pytest

from scripts import content_launch_guard as guard
from scripts.content_launch_guard import validate_launch


@pytest.mark.parametrize("case,path,status", [
    ("approved", "kor/old space.html", "D"),
    ("unapproved", "old.html", "D"),
    ("winner", "kor/winner.html", "D"),
    ("observing", "observing.html", "D"),
    ("cluster", "cluster/old.html", "D"),
    ("sitemap", "old/index.html", "D"),
    ("rename", "old.html", "R100"),
    ("measurement", "data/performance/stale.csv", "D"),
    ("calculator", "util/calculator/index.html", "D"),
    ("fake_calculator", "kor/util/calculator/index.html", "D"),
    ("calculator_config", "util/calculator/config.json", "D"),
    ("noindex_calculator", "util/retired/index.html", "D"),
    ("duplicate_calculator", "kor/util/duplicate/index.html", "D"),
    ("bad_hash", "old.html", "D"),
    ("working_ledger", "old.html", "D"),
    ("deleted_sitemap", "old/index.html", "D"),
    ("ops_winner", "ops-winner.html", "D"),
])
def test_batch_pruning(tmp_path, monkeypatch, capsys, case, path, status):
    root = tmp_path
    page = root / path
    page.parent.mkdir(parents=True, exist_ok=True)
    robots = {
        "approved": '<meta content="follow, noindex" name="robots">',
        "noindex_calculator": '<meta name="robots" content="noindex">',
        "duplicate_calculator": '<meta name="robots" content="index" content="noindex">',
    }.get(case, '<!-- <meta name="robots" content="noindex"> -->')
    page.write_text(f"<head>{robots}</head>")
    allowed = {} if case == "unapproved" else {
        path: "0" * 64 if case == "bad_hash" else hashlib.sha256(page.read_bytes()).hexdigest()
    }
    ledger = {"schemaVersion": 2, "batchIds": ["BATCH_01", "BATCH_02"], "sha256ByPath": allowed}
    ledger_path = "data/approved-pruning-ledger.json"
    (root / "data").mkdir(exist_ok=True)
    (root / ledger_path).write_text(json.dumps(ledger))
    docs = {
        "data/revenue-opportunities.json": {"protectedWinners": [{"url": "https://emfls.github.io/kor/winner.html"}]},
        "data/experiments.json": {"experiments": [{"url": "/observing.html", "status": "OBSERVING"}]},
        "data/cluster-exclusions.json": {"cluster_exclusions": ["/cluster/"]},
    }
    if case == "ops_winner":
        (root / "data/revenue-opportunities.json").write_text(json.dumps(
            {"protectedWinners": [{"url": "/ops-winner.html"}]}
        ))
    if case in {"sitemap", "deleted_sitemap"}:
        (root / "sitemap-old.xml").write_text(
            '<urlset><url><loc>https://emfls.github.io/old/</loc></url></urlset>'
        )

    def git(*args):
        return subprocess.check_output(["git", *args], cwd=root, text=True).strip()

    git("init", "-q")
    git("add", ".")
    git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "base")
    revision = git("rev-parse", "HEAD")
    page.unlink()
    if case == "deleted_sitemap":
        (root / "sitemap-old.xml").unlink()
    errors = validate_launch(
        root, {}, [(status, path)], trusted_base={"json": docs, "revision": revision},
        change_base_ref=None if case == "working_ledger" else revision,
    )
    if case == "approved":
        assert errors == []
    else:
        assert "DELETION_NOT_ALLOWED" in errors
    if case.endswith("calculator") or case == "calculator_config":
        assert "CALCULATOR_DELETION_BLOCKED" in errors
    if case == "fake_calculator":
        git("add", "-u")
        git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "delete")
        monkeypatch.setattr(guard, "_trusted_base_snapshot", lambda *_: {"json": docs, "revision": revision})
        monkeypatch.setattr(sys, "argv", ["guard", "--root", str(root), "--base-ref", revision])
        with pytest.raises(SystemExit) as result:
            guard.main()
        assert result.value.code == 1
        assert "CALCULATOR_DELETION_BLOCKED" in json.loads(capsys.readouterr().out)["errors"]
