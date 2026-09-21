import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "util/date-difference/index.html"


def source():
    return PAGE.read_text(encoding="utf-8")


def node_values(expression):
    script = re.findall(r"<script(?: [^>]*)?>(.*?)</script>", source(), re.S)[-1]
    result = subprocess.run(["node", "-e", script + "\n" + expression], capture_output=True, text=True, check=True)
    return json.loads(result.stdout.strip().splitlines()[-1])


def test_known_dates_and_counting_semantics():
    values = node_values(r'''
const cases = [
  calculateValues("2026-01-01", "2026-01-03", false), calculateValues("2026-01-01", "2026-01-03", true),
  calculateValues("2026-01-01", "2026-01-01", false), calculateValues("2026-01-01", "2026-01-01", true),
  calculateValues("2024-02-28", "2024-03-01", false), calculateValues("2025-02-28", "2025-03-01", false),
  calculateValues("2026-03-07", "2026-03-09", false), calculateValues("2025-01-31", "2025-03-01", false),
]; console.log(JSON.stringify(cases));
''')
    assert (values[0]["signedDays"], values[0]["absDays"], values[0]["selectedRangeDays"], values[0]["weeks"], values[0]["remainingDays"]) == (2, 2, 2, 0, 2)
    assert values[1]["selectedRangeDays"] == 3
    assert values[2]["direction"] == "Dates are the same" and values[2]["selectedRangeDays"] == 0
    assert values[3]["selectedRangeDays"] == 1 and values[3]["weekdays"] + values[3]["weekends"] == 1
    assert values[4]["absDays"] == 2 and values[5]["absDays"] == 1 and values[6]["absDays"] == 2
    assert values[7]["absDays"] == 29 and values[7]["calendar"] == {"years": 0, "months": 1, "days": 1}


def test_weekdays_reverse_and_range_invariants():
    values = node_values(r'''
const forward = calculateValues("2026-09-21", "2026-09-28", false), inclusive = calculateValues("2026-09-21", "2026-09-28", true), reverse = calculateValues("2026-09-28", "2026-09-21", false);
console.log(JSON.stringify({forward, inclusive, reverse}));
''')
    forward, inclusive, reverse = values["forward"], values["inclusive"], values["reverse"]
    assert (forward["weekdays"], forward["weekends"], forward["selectedRangeDays"]) == (5, 2, 7)
    assert (inclusive["weekdays"], inclusive["weekends"], inclusive["selectedRangeDays"]) == (6, 2, 8)
    assert reverse["signedDays"] == -forward["signedDays"]
    for key in ("absDays", "selectedRangeDays", "weeks", "remainingDays", "weekdays", "weekends", "calendar"):
        assert reverse[key] == forward[key]
    for item, include_end in ((forward, False), (inclusive, True), (reverse, False)):
        assert item["weekdays"] + item["weekends"] == item["selectedRangeDays"]
        assert item["selectedRangeDays"] == item["absDays"] + (1 if include_end else 0)


def test_calendar_helpers_and_invalid_dates():
    values = node_values(r'''
console.log(JSON.stringify({year: calendarSpan(parseDate("2025-01-15"), parseDate("2026-01-15")), month: calendarSpan(parseDate("2025-01-15"), parseDate("2025-03-15")), invalid: [parseDate("2026-02-31"), parseDate("bad"), parseDate("2026-13-01")].map(Number.isFinite), dst: calculateValues("2026-03-07", "2026-03-09", false).absDays, today: localToday(new Date(2026, 0, 3))}));
''')
    assert values["year"] == {"years": 1, "months": 0, "days": 0}
    assert values["month"] == {"years": 0, "months": 2, "days": 0}
    assert values["invalid"] == [False, False, False]
    assert values["dst"] == 2 and values["today"] == "2026-01-03"


def test_ui_and_privacy_contract():
    html = source()
    for element_id in ("start", "end", "today-start", "today-end", "swap", "include-end", "calculate", "copy", "reset"):
        assert f'id="{element_id}"' in html
    assert 'role="alert"' in html and 'aria-live="polite"' in html and 'role="status"' in html
    assert 'type="datetime-local"' not in html and "hours/minutes/seconds result" not in html and "Add days" not in html
    assert "targetWidth" not in html and "targetHeight" not in html
    assert "fetch(" not in html and "localStorage" not in html and "sessionStorage" not in html
    assert "G-QP5Q67GE5B" in html and "ca-pub-8830524482034754" in html
