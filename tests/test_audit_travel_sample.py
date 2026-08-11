from pathlib import Path
import importlib.util


SCRIPT = Path(__file__).parents[1] / "scripts" / "audit_travel_sample.py"
spec = importlib.util.spec_from_file_location("audit_travel_sample", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_classification_uses_policy_safe_quality_thresholds():
    assert module.classify({"text_chars": 700, "internal_links": 8, "canonical": True, "description": True})[0] == "exclude"
    assert module.classify({"text_chars": 2100, "internal_links": 6, "canonical": False, "description": True})[0] == "exclude"
    assert module.classify({"text_chars": 1200, "internal_links": 2, "canonical": True, "description": True})[0] == "improve"
    assert module.classify({"text_chars": 2100, "internal_links": 6, "canonical": True, "description": True})[0] == "maintain"


def test_sample_is_deterministic_unique_and_language_stratified():
    candidates = []
    for language in ("en", "ko", "ja"):
        candidates.extend((Path(f"{language}/report/travel/page-{i}.html"), language) for i in range(100))
    first = module.select_sample(candidates, 200, "2026-08-12")
    second = module.select_sample(candidates, 200, "2026-08-12")
    assert first == second
    assert len(first) == 200
    assert len({path for path, _ in first}) == 200
    assert {language for _, language in first} == {"en", "ko", "ja"}
