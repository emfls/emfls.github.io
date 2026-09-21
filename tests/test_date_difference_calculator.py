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


def node_ui_values(expression):
    script = re.findall(r"<script(?: [^>]*)?>(.*?)</script>", source(), re.S)[-1]
    harness = r'''
class Element { constructor(id, value = "") { this.id=id; this.value=value; this.checked=false; this.hidden=false; this.textContent=""; this.onclick=null; this.classList={add:()=>{},remove:()=>{}}; } }
const elements={}; const add=(id,value="")=>elements[id]=new Element(id,value);
["start","end","today-start","today-end","swap","include-end","calculate","copy","reset","copy-status","error","result"].forEach(id=>add(id));
elements["error"].hidden=true; elements["result"].textContent="Choose two dates.";
globalThis.document={getElementById:id=>elements[id]}; globalThis.navigator={clipboard:{writeText:async()=>{}}};
'''
    result = subprocess.run(["node", "-e", harness + script + "\n" + expression], capture_output=True, text=True, check=True)
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


def test_partial_swap_preserves_values_and_clears_neutral_state():
    values = node_ui_values(r'''
elements["start"].value="2026-01-01"; elements["swap"].onclick();
const startOnly={start:elements["start"].value,end:elements["end"].value,result:elements["result"].textContent,error:elements["error"].hidden,lastText};
elements["start"].value=""; elements["end"].value="2026-01-03"; elements["swap"].onclick();
console.log(JSON.stringify({startOnly,endOnly:{start:elements["start"].value,end:elements["end"].value,result:elements["result"].textContent,error:elements["error"].hidden,lastText}}));
''')
    assert values["startOnly"] == {"start": "", "end": "2026-01-01", "result": "Choose two dates.", "error": True, "lastText": ""}
    assert values["endOnly"] == {"start": "2026-01-03", "end": "", "result": "Choose two dates.", "error": True, "lastText": ""}


def test_full_swap_today_shortcuts_and_copy_status_regressions():
    values = node_ui_values(r'''
elements["start"].value="2026-01-01"; elements["end"].value="2026-01-03"; elements["calculate"].onclick();
const before=JSON.parse(JSON.stringify({text:elements["result"].textContent,lastText})); elements["copy-status"].textContent="Copied"; elements["swap"].onclick();
const swapped={start:elements["start"].value,end:elements["end"].value,text:elements["result"].textContent};
elements["start"].value=""; elements["end"].value=""; elements["today-start"].onclick(); const startToday={start:elements["start"].value,end:elements["end"].value,error:elements["error"].hidden,result:elements["result"].textContent,lastText};
elements["today-end"].onclick(); const bothToday={start:elements["start"].value,end:elements["end"].value,result:elements["result"].textContent};
console.log(JSON.stringify({before,swapped,startToday,bothToday,copyStatus:elements["copy-status"].textContent}));
''')
    assert "Signed elapsed days: 2" in values["before"]["text"]
    assert values["swapped"]["start"] == "2026-01-03" and values["swapped"]["end"] == "2026-01-01"
    assert "Signed elapsed days: -2" in values["swapped"]["text"]
    assert values["startToday"]["start"] and values["startToday"]["end"] == "" and values["startToday"]["error"] is True and values["startToday"]["lastText"] == ""
    assert values["bothToday"]["start"] == values["bothToday"]["end"] and "Dates are the same" in values["bothToday"]["result"]
    assert values["copyStatus"] == ""


def test_explicit_invalid_calculation_and_reset_clear_stale_state():
    values = node_ui_values(r'''
elements["start"].value="2026-01-01"; elements["end"].value="2026-01-03"; elements["calculate"].onclick(); elements["copy-status"].textContent="Copied"; elements["end"].value=""; elements["calculate"].onclick();
const invalid={error:elements["error"].hidden,result:elements["result"].textContent,lastText,copy:elements["copy-status"].textContent}; elements["include-end"].checked=true; elements["reset"].onclick();
console.log(JSON.stringify({invalid,reset:{start:elements["start"].value,end:elements["end"].value,includeEnd:elements["include-end"].checked,result:elements["result"].textContent,error:elements["error"].hidden,copy:elements["copy-status"].textContent,lastText}}));
''')
    assert values["invalid"]["error"] is False and values["invalid"]["result"] == "Choose two dates." and values["invalid"]["lastText"] == "" and values["invalid"]["copy"] == ""
    assert values["reset"] == {"start":"","end":"","includeEnd":False,"result":"Choose two dates.","error":True,"copy":"","lastText":""}
