"""Phase2 placement contracts, including live controls and exact source recovery."""
from pathlib import Path
import importlib
import re
import subprocess

import pytest

ROOT = Path(__file__).resolve().parents[1]
BASE = "a56e7bf3c461ed9130f97de652b7718ea94fa535"
CALCULATORS = [
    "kor/util/overseas-stock-tax-calculator/index.html",
    "kor/util/retirement-pension-withdrawal/index.html",
    "kor/util/water-purifier-rental-price-comparison/index.html",
    "kor/util/car-inspection-cost/index.html",
    "kor/util/road-trip-cost-calculator/index.html",
    "kor/util/camping-packing-checklist/index.html",
    "kor/util/date-calculator/index.html",
    "kor/util/fin-calc/index.html",
    "util/break-even-calculator/index.html",
    "util/age/index.html",
]


def implementation():
    try:
        return importlib.import_module("scripts.patch_phase2_slots")
    except ModuleNotFoundError:
        pytest.fail("Phase2 patch implementation is missing")


@pytest.mark.parametrize("path", CALCULATORS)
def test_calculator_has_two_persistent_separate_labeled_slots(path):
    text = (ROOT / path).read_text()
    assert text.count("<!-- EMFLS_PHASE2_ATF_SLOT -->") == 1
    assert text.count("<!-- EMFLS_PHASE2_RESULT_SLOT -->") == 1
    assert text.count("pagead2.googlesyndication.com/pagead/js/adsbygoogle.js") == 1
    module = implementation()
    nodes = module.Boundaries(text).nodes
    for node in (n for n in nodes if "emfls-phase2" in n["classes"]):
        fragment = text[node["start"]:node["end"]]
        assert 'aria-label="Advertisement"' in fragment
        assert "min-height:250px" in fragment and "margin:48px 0" in fragment
        assert "Advertisement</div>" in fragment and "overflow:hidden" not in fragment
        assert not any(p.get("role") == "tabpanel" or p.get("aria-live") for p in node["ancestor_attrs"])
        assert "form" not in node["ancestor_tags"]


def test_campaign_applies_only_actual_ten_place_grids():
    module = implementation()
    assert len(module.CAMP_PAGES) == 18
    for path, (grid, card) in module.CAMP_PAGES.items():
        text = (ROOT / path).read_text()
        assert text.count("<!-- [EMFLS_AUTO_CAMP_INFEED] -->") == 2
        spans = module.Boundaries(text)
        cards = sorted((n for n in spans.nodes if card in n["classes"] and any(grid in p for p in n["parents"])), key=lambda n: n["start"])
        assert len(cards) == 10
        for number in (3, 7):
            assert text[cards[number - 1]["end"]:].lstrip().startswith("<!-- [EMFLS_AUTO_CAMP_INFEED] -->")
        assert text.count('data-ad-slot="5441320677"') == 2
        assert 'data-ad-layout-key="-6u+cw+56-h-7x"' in text
        assert "border-radius:13px" in text


def test_patches_are_idempotent_and_remove_to_exact_original():
    module = implementation()
    for path in CALCULATORS + list(module.CAMP_PAGES):
        original = subprocess.check_output(["git", "-C", str(ROOT), "show", BASE + ":" + path]).decode()
        current = (ROOT / path).read_text()
        patched, state = module.patch_page(path, original)
        assert state == "PATCHED" and patched == current
        assert module.patch_page(path, patched) == (patched, "ALREADY_PATCHED")
        assert module.remove_additions(patched) == original
        # Original business logic, markup and measurements survive byte-for-byte.
        assert module.remove_additions(current).encode() == original.encode()


def test_partial_markers_and_bad_anchors_fail_closed():
    module = implementation()
    path = CALCULATORS[0]
    source = subprocess.check_output(["git", "-C", str(ROOT), "show", BASE + ":" + path]).decode()
    for bad in [source + "<!-- EMFLS_PHASE2_ATF_SLOT -->", source.replace('id="result"', 'id="changed-result"')]:
        actual, state = module.patch_page(path, bad)
        assert actual == bad and state.endswith("HOLD")
    assert module.patch_page("kor/report/camp/glamping-daejeon.html", "unrelated") == ("unrelated", "OUT_OF_SCOPE_HOLD")


def test_mutating_result_nodes_contain_no_advertisements():
    module = implementation()
    dynamic = {"result", "list", "ageResult", "birthResult", "simpleResult", "savingResult", "instResult"}
    for path in CALCULATORS:
        text = (ROOT / path).read_text()
        for node in module.Boundaries(text).nodes:
            if node["attrs"].get("id") in dynamic:
                assert 'class="adsbygoogle"' not in text[node["start"]:node["end"]]


def test_apply_rejects_main_before_writing(tmp_path):
    module = implementation()
    subprocess.run(["git", "init", "-q", "-b", "main", str(tmp_path)], check=True)
    with pytest.raises(ValueError, match="dedicated feature branch"):
        module.apply_plan(tmp_path, {})


@pytest.mark.parametrize("wrapper", ['<form>', '<section aria-live="polite">', '<div role="tabpanel">', '<div hidden>', '<div style="display: none">', '<div aria-hidden="true">', '<article aria-live="polite">', '<fieldset hidden>', '<span hidden>'])
def test_anchor_drift_into_interactive_or_hidden_ancestor_holds(wrapper):
    module = implementation()
    path = CALCULATORS[0]
    original = subprocess.check_output(["git", "-C", str(ROOT), "show", BASE + ":" + path]).decode()
    close = "</" + wrapper.split()[0].lstrip("<").rstrip(">") + ">"
    changed = original.replace('<section class="panel" aria-labelledby="calculator-heading">', wrapper + '<section class="panel" aria-labelledby="calculator-heading">', 1)
    changed = changed.replace("</main>", close + "</main>", 1)
    assert module.patch_page(path, changed) == (changed, "ANCHOR_HOLD")


def test_orphan_camp_closing_marker_holds_without_any_edit():
    module = implementation()
    path = "kor/report/camp/autocamping-best.html"
    original = subprocess.check_output(["git", "-C", str(ROOT), "show", BASE + ":" + path]).decode()
    original += "<!-- /[EMFLS_AUTO_CAMP_INFEED] -->"
    assert module.patch_page(path, original) == (original, "PARTIAL_MARKER_HOLD")


def test_infeed_keeps_250px_even_with_15px_desktop_scrollbar():
    code = implementation()._slot("[EMFLS_AUTO_CAMP_INFEED]", "feed")
    padding = re.search(r"padding:(\d+)px(?:\s+(\d+)px)?", code)
    horizontal = float(padding.group(2) or padding.group(1))
    assert 320 - 15 - 40 - 2 * horizontal >= 250


def test_insertion_preserves_indent_without_adding_whitespace_only_lines():
    from collections import Counter
    module = implementation()
    for path in CALCULATORS:
        original = subprocess.check_output(["git", "-C", str(ROOT), "show", BASE + ":" + path]).decode()
        patched, status = module.patch_page(path, original)
        whitespace = lambda text: Counter(s for s in text.splitlines() if s and not s.strip())
        assert not (whitespace(patched) - whitespace(original))
