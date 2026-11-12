"""Exact owner-approved RPM transitions, including negative release gates."""
import hashlib
import json

from scripts import content_launch_guard as guard

DOC = "docs/adsense-slots-2026-11-13.md"
PAGE = "kor/column/ackman-microsoft-google-ai-investment-2026.html"


def setup(root, observing=False):
    data = root / "data"
    data.mkdir(exist_ok=True)
    (data / "experiments.json").write_text(json.dumps({"experiments":[{"url":"/"+PAGE,"status":"OBSERVING"}] if observing else []}))
    (data / "revenue-opportunities.json").write_text(json.dumps({"protectedWinners":[{"url":"/"+PAGE}]}))
    return {"urls":[],"contentPaths":[],"candidateIds":[]}


def approved():
    return getattr(guard,"APPROVED_RPM_OPTIMIZATION_20261113_TRANSITIONS",{})


def test_registry_matches_owner_approved_241_blob_pairs_exactly():
    transitions = approved()
    assert len(transitions) == 241
    serialized = json.dumps(transitions,sort_keys=True,separators=(",",":"))
    assert hashlib.sha256(serialized.encode()).hexdigest() == "e57490fd96798e4830971fb130cb98da761a0f237f992efbcf3b75779cfbceda"
    for path,pair in transitions.items():
        assert pair in guard.APPROVED_PROTECTED_WINNER_TRANSITIONS.get(path,set())


def test_all_exact_approved_changes_pass_both_gates(tmp_path):
    manifest = setup(tmp_path)
    transitions = approved()
    assert transitions, "approved registry missing"
    changed = [("A" if before is None else "M",path,before,after) for path,(before,after) in transitions.items()]
    assert guard.validate_launch(tmp_path,manifest,changed) == []


def test_changed_before_or_after_blob_still_blocks_monetization(tmp_path):
    manifest = setup(tmp_path)
    before,after = approved().get(DOC,(None,"b"*40))
    for row in [("A",DOC,before,"a"*40),("M",DOC,"a"*40,after),("A",DOC,"a"*40,after),("M",DOC,None,after)]:
        assert "MONETIZATION_OR_ANALYTICS_CHANGED" in guard.validate_launch(tmp_path,manifest,[row])


def test_unreviewed_path_cannot_reuse_approved_content(tmp_path):
    manifest=setup(tmp_path)
    before,after=approved().get(DOC,(None,"b"*40))
    assert "MONETIZATION_OR_ANALYTICS_CHANGED" in guard.validate_launch(tmp_path,manifest,[("A","docs/adsense-unreviewed.md",before,after)])


def test_modified_winner_and_observing_still_fail_closed(tmp_path):
    manifest=setup(tmp_path)
    before,after=approved().get(PAGE,("a"*40,"b"*40))
    assert "PROTECTED_WINNER_CHANGED" in guard.validate_launch(tmp_path,manifest,[("M",PAGE,before,"c"*40)])
    setup(tmp_path,observing=True)
    assert "PROTECTED_EXPERIMENT_CHANGED" in guard.validate_launch(tmp_path,manifest,[("M",PAGE,before,after)])


def test_deletion_and_rename_cannot_use_approved_tuple(tmp_path):
    manifest=setup(tmp_path)
    before,after=approved().get(DOC,(None,"b"*40))
    for status in ["D","R100"]:
        errors=guard.validate_launch(tmp_path,manifest,[(status,DOC,before,after)])
        assert "DELETION_NOT_ALLOWED" in errors
        assert "MONETIZATION_OR_ANALYTICS_CHANGED" in errors


def test_real_git_addition_hashes_reach_monetization_validation(tmp_path,monkeypatch):
    import subprocess
    def git(*args):
        return subprocess.check_output(['git','-C',str(tmp_path),'-c','user.name=Fixture','-c','user.email=fixture@example.invalid',*args],text=True).strip()
    git('init','-q')
    (tmp_path/'README.md').write_text('base')
    git('add','README.md');git('commit','-qm','base')
    base=git('rev-parse','HEAD')
    target=tmp_path/DOC;target.parent.mkdir(parents=True);target.write_text('approved RPM fixture')
    git('add',DOC);git('commit','-qm','approved addition')
    after=git('rev-parse','HEAD:'+DOC)
    monkeypatch.setattr(guard,'APPROVED_RPM_OPTIMIZATION_20261113_TRANSITIONS',{DOC:(None,after)})
    changed=guard._git_changes(tmp_path,base)
    assert changed==[('A',DOC,None,after)]
    assert guard.validate_launch(tmp_path,setup(tmp_path),changed)==[]
    target.write_text('unapproved revised content')
    git('add',DOC);git('commit','-qm','unapproved mutation')
    assert 'MONETIZATION_OR_ANALYTICS_CHANGED' in guard.validate_launch(tmp_path,setup(tmp_path),guard._git_changes(tmp_path,base))
