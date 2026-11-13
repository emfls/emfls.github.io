"""Phase2 owner-approved transitions must not become a wildcard."""
import hashlib
import json
from scripts import content_launch_guard as guard


def registry():
    return getattr(guard, "APPROVED_PHASE2_TRANSITIONS", {})


def fixture(root, observing=False):
    path = "kor/report/camp/autocamping-best.html"
    data = root / "data"
    data.mkdir(exist_ok=True)
    (data / "experiments.json").write_text(json.dumps({"experiments": [{"url": "/" + path, "status": "OBSERVING"}] if observing else []}))
    (data / "revenue-opportunities.json").write_text(json.dumps({"protectedWinners": [{"url": "/" + path}]}))
    return path, {"urls": [], "contentPaths": [], "candidateIds": []}


def test_registry_contains_only_actual_reviewed_28_pages():
    pairs = registry()
    assert len(pairs) == 28
    assert sum(path.startswith("kor/report/camp/") for path in pairs) == 18
    for path, pair in pairs.items():
        assert len(pair) == 2 and all(len(blob) == 40 for blob in pair)
        assert pair in guard.APPROVED_PROTECTED_WINNER_TRANSITIONS.get(path, set())


def test_exact_phase2_transitions_pass(tmp_path):
    _, manifest = fixture(tmp_path)
    assert registry(), "Phase2 exact registry missing"
    assert guard.validate_launch(tmp_path, manifest, [("M", path, *pair) for path, pair in registry().items()]) == []


def test_phase2_mutation_and_observing_remain_blocked(tmp_path):
    path, manifest = fixture(tmp_path)
    before, after = registry().get(path, ("a" * 40, "b" * 40))
    assert "PROTECTED_WINNER_CHANGED" in guard.validate_launch(tmp_path, manifest, [("M", path, before, "c" * 40)])
    fixture(tmp_path, observing=True)
    assert "PROTECTED_EXPERIMENT_CHANGED" in guard.validate_launch(tmp_path, manifest, [("M", path, before, after)])


def test_phase2_deletion_is_not_authorized(tmp_path):
    path, manifest = fixture(tmp_path)
    before, after = registry().get(path, ("a" * 40, "b" * 40))
    assert "DELETION_NOT_ALLOWED" in guard.validate_launch(tmp_path, manifest, [("D", path, before, after)])
