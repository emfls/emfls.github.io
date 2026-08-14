import json
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).parents[1]
ANALYTICS = ROOT / "kor/util/tool-analytics.js"
PAGES = (
    ROOT / "kor/util/camping-packing-checklist/index.html",
    ROOT / "kor/util/japan-travel-packing-checklist/index.html",
    ROOT / "kor/util/japan-esim-data-calculator/index.html",
    ROOT / "kor/report/camp/차박.html",
)


class DemandToolAnalyticsTest(unittest.TestCase):
    def test_tracker_emits_only_bounded_non_personal_fields(self):
        script = f"""
const calls = [];
global.gtag = (...args) => calls.push(args);
const {{ trackToolCompletion }} = require({json.dumps(str(ANALYTICS))});
const accepted = trackToolCompletion('japan_esim', 'calculated');
const rejected = trackToolCompletion('unknown tool', 'raw user text');
process.stdout.write(JSON.stringify({{calls, accepted, rejected}}));
"""
        result = subprocess.run(["node", "-e", script], capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)
        self.assertTrue(data["accepted"])
        self.assertFalse(data["rejected"])
        self.assertEqual(data["calls"], [["event", "tool_complete", {
            "tool_name": "japan_esim", "result_type": "calculated"
        }]])

    def test_all_demand_tools_load_tracker_and_call_on_user_action(self):
        for page in PAGES:
            html = page.read_text(encoding="utf-8")
            behavior = html
            if page.name == "차박.html":
                behavior += (page.parent / "car-camping-check.js").read_text(encoding="utf-8")
            else:
                behavior += (page.parent / "app.js").read_text(encoding="utf-8")
            self.assertIn("tool-analytics.js", behavior, page)
            self.assertIn("trackToolCompletion", behavior, page)


if __name__ == "__main__":
    unittest.main()
