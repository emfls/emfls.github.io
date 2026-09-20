import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "util/aspect-ratio/index.html"


def source():
    return PAGE.read_text(encoding="utf-8")


def node_values(expression):
    script = re.findall(r"<script(?: [^>]*)?>(.*?)</script>", source(), re.S)[-1]
    result = subprocess.run(["node", "-e", script + "\n" + expression], capture_output=True, text=True, check=True)
    return json.loads(result.stdout.strip().splitlines()[-1])


def node_ui_values(expression):
    script = re.findall(r"<script(?: [^>]*)?>(.*?)</script>", source(), re.S)[-1]
    harness = r'''
class Element {
  constructor(id, value = "") { this.id = id; this.value = value; this.hidden = false; this.textContent = ""; this.style = {}; this.attributes = {}; this.onclick = null; this.dataset = {}; this.classList = { values: new Set(), add: (...xs) => xs.forEach(x => this.classList.values.add(x)), remove: (...xs) => xs.forEach(x => this.classList.values.delete(x)), toggle: (x, force) => force === undefined ? (this.classList.values.has(x) ? this.classList.values.delete(x) : this.classList.values.add(x)) : (force ? this.classList.values.add(x) : this.classList.values.delete(x)) }; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
}
const elements = {};
const add = (id, value = "") => elements[id] = new Element(id, value);
add("dimensions-tab"); elements["dimensions-tab"].attributes["aria-controls"] = "dimensions-mode"; elements["dimensions-tab"].attributes["aria-selected"] = "true";
add("resize-tab"); elements["resize-tab"].attributes["aria-controls"] = "resize-mode"; elements["resize-tab"].attributes["aria-selected"] = "false";
add("dimensions-mode"); add("resize-mode"); elements["resize-mode"].hidden = true;
add("width", "1920"); add("height", "1080"); add("ratio-width", "16"); add("ratio-height", "9"); add("known-side", "width"); add("known-dimension", "1280");
add("error"); elements["error"].hidden = true; add("result"); elements["result"].textContent = "Result appears here."; add("copy-status"); add("preview-rectangle"); add("orientation");
["calculate-dimensions","calculate-resize","swap-dimensions","swap-ratio","copy-ratio","copy-dimensions","reset"].forEach(add);
["16:9","9:16","4:3","3:2","1:1","4:5","16:10","21:9"].forEach((value, i) => { const item = add("preset-" + i); item.dataset.preset = value; });
globalThis.document = { getElementById: id => elements[id], querySelectorAll: selector => selector === '[role="tab"]' ? [elements["dimensions-tab"], elements["resize-tab"]] : selector === "[data-preset]" ? Object.values(elements).filter(x => x.dataset.preset) : [], querySelector: selector => elements["dimensions-tab"] };
'''
    result = subprocess.run(["node", "-e", harness + script + "\n" + expression], capture_output=True, text=True, check=True)
    return json.loads(result.stdout.strip().splitlines()[-1])


def test_known_answers_and_exactness():
    values = node_values(r'''
console.log(JSON.stringify({
  landscape: ratioFromInputs("1920", "1080"),
  portrait: ratioFromInputs("1080", "1350"),
  square: ratioFromInputs("1000", "1000"),
  width: resizeFromRatio("16", "9", "width", "1280"),
  height: resizeFromRatio("9", "16", "height", "1920"),
  portraitWidth: resizeFromRatio("4", "5", "width", "1080"),
  ultrawide: ratioFromInputs("3440", "1440")
}));
''')
    assert values["landscape"]["width"] == 16 and values["landscape"]["height"] == 9
    assert values["portrait"]["width"] == 4 and values["portrait"]["height"] == 5
    assert values["square"]["width"] == 1 and values["square"]["height"] == 1
    assert values["width"]["height"] == 720
    assert values["height"]["width"] == 1080
    assert values["portraitWidth"]["height"] == 1350
    assert values["ultrawide"]["width"] == 43 and values["ultrawide"]["height"] == 18


def test_round_trip_swap_and_scale_invariants():
    values = node_values(r'''
const scaled = [[1920,1080],[3840,2160],[960,540]].map(([w,h]) => ratioFromInputs(String(w), String(h)));
console.log(JSON.stringify({
  roundTrip: resizeFromRatio("16", "9", "width", "1920").height,
  swapped: ratioFromInputs("1080", "1920"),
  scaled
}));
''')
    assert values["roundTrip"] == 1080
    assert (values["swapped"]["width"], values["swapped"]["height"]) == (9, 16)
    assert all((item["width"], item["height"]) == (16, 9) for item in values["scaled"])


def test_invalid_input_contract_and_no_legacy_precedence():
    values = node_values(r'''
const invalid = [
  () => ratioFromInputs("", "1080"),
  () => ratioFromInputs("0", "1080"),
  () => ratioFromInputs("-1", "1080"),
  () => ratioFromInputs("1920.5", "1080"),
  () => resizeFromRatio("", "9", "width", "1280"),
  () => resizeFromRatio("16", "0", "width", "1280"),
  () => resizeFromRatio("16", "9", "width", "")
];
console.log(JSON.stringify({invalid: invalid.map(fn => { try { fn(); return false; } catch (error) { return true; } })}));
''')
    assert all(values["invalid"])
    html = source()
    assert "targetWidth" not in html and "targetHeight" not in html
    assert "if(tw>0)" not in html and "else if(th>0)" not in html


def test_ui_contract_presets_accessibility_and_schema():
    html = source()
    for preset in ("16:9", "9:16", "4:3", "3:2", "1:1", "4:5", "16:10", "21:9"):
        assert f'data-preset="{preset}"' in html
    assert len(re.findall(r'<button[^>]+role="tab"', html)) == 2
    assert html.count('type="button"') >= 14
    assert 'aria-live="polite"' in html
    assert 'role="alert"' in html
    assert '"@type":"WebApplication"' in html
    assert '"@type":"FAQPage"' not in html
    assert "3440×1440" in html and "43:18" in html
    assert "21:9" in html and "common category label" in html
    assert "percentage-calculator" not in html
    assert "/util/imagetool/" in html
    assert "/util/ImageCompressor/" in html
    assert "/util/imageformatconverter/" in html
    assert "localStorage" not in html and "sessionStorage" not in html and "fetch(" not in html
    assert 'dateModified":"2026-09-21"' in html
    assert "Reviewed: 2026-09-21" in html
    assert '<lastmod>2026-09-21</lastmod>' in (ROOT / "util/sitemap.xml").read_text(encoding="utf-8")


def test_mode_a_uses_original_dimensions_for_display_and_copy():
    values = node_ui_values(r'''
elements["width"].value = "1920";
elements["height"].value = "1080";
runDimensions();
console.log(JSON.stringify({result: elements["result"].textContent, lastResult, lastDimensions}));
''')
    assert "Exact ratio: 16:9" in values["result"]
    assert "1920 × 1080" in values["result"]
    assert values["lastResult"] == "16:9"
    assert values["lastDimensions"] == "1920 × 1080"
    assert "16 × 9" not in values["result"]


def test_reset_restores_deterministic_initial_ui_state():
    values = node_ui_values(r'''
elements["resize-tab"].onclick();
elements["preset-5"].onclick();
elements["known-dimension"].value = "1080";
runResize();
resetAll();
console.log(JSON.stringify({
  dimensionsSelected: elements["dimensions-tab"].attributes["aria-selected"],
  resizeSelected: elements["resize-tab"].attributes["aria-selected"],
  dimensionsHidden: elements["dimensions-mode"].hidden,
  resizeHidden: elements["resize-mode"].hidden,
  selectedPresets: Object.values(elements).filter(x => x.dataset.preset && x.classList.values.has("is-selected")).length,
  width: elements["width"].value, height: elements["height"].value,
  ratioWidth: elements["ratio-width"].value, ratioHeight: elements["ratio-height"].value,
  knownSide: elements["known-side"].value, knownDimension: elements["known-dimension"].value,
  result: elements["result"].textContent, errorHidden: elements["error"].hidden, error: elements["error"].textContent,
  copyStatus: elements["copy-status"].textContent, preview: elements["preview-rectangle"].style.aspectRatio,
  orientation: elements["orientation"].textContent
}));
''')
    assert values == {"dimensionsSelected": "true", "resizeSelected": "false", "dimensionsHidden": False, "resizeHidden": True, "selectedPresets": 0, "width": 1920, "height": 1080, "ratioWidth": 16, "ratioHeight": 9, "knownSide": "width", "knownDimension": 1280, "result": "Result appears here.", "errorHidden": True, "error": "", "copyStatus": "", "preview": "16 / 9", "orientation": "Orientation: Landscape"}
