import html as html_lib
import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "game/MBTI/index.html"


def page_html():
    return PAGE.read_text(encoding="utf-8")


def node_values(expression):
    source = page_html()
    script = re.findall(r"<script(?: [^>]*)?>(.*?)</script>", source, re.S)[-2].rsplit("showQuestion();", 1)[0]
    result = subprocess.run(["node", "-e", script + "\n" + expression], capture_output=True, text=True, check=True)
    return json.loads(result.stdout.strip().splitlines()[-1])


def test_question_inventory_is_twenty_and_balanced():
    source = page_html()
    questions = re.findall(r'\{\s*q: "(.*?)",\s*a: \[(.*?), (.*?)\],\s*t: \["([EISNTFJP])", "([EISNTFJP])"\]', source, re.S)
    assert len(questions) == 20
    axes = [tuple(item[3:5]) for item in questions]
    assert all(len(set(axis)) == 2 for axis in axes)
    assert {letter for axis in axes for letter in axis} == set("EISNTFJP")
    assert {letter: sum(letter in axis for axis in axes) for letter in "EISNTFJP"} == {letter: 5 for letter in "EISNTFJP"}
    assert source.count('a: [') == 20


def test_scoring_is_deterministic_and_close_is_explicit():
    values = node_values(r'''
console.log(JSON.stringify({
  first: calculateType({E:3,I:2,S:3,N:2,T:3,F:2,J:3,P:2}),
  second: calculateType({E:2,I:3,S:2,N:3,T:2,F:3,J:2,P:3}),
  close: [isCloseAxis(3,2), isCloseAxis(4,1)]
}));
''')
    assert values == {"first": "ESTJ", "second": "INFP", "close": [True, False]}


def test_visible_and_schema_faq_answers_match():
    source = page_html()
    blocks = re.findall(r'<details><summary>(.*?)</summary><p>(.*?)</p></details>', source, re.S)
    visible = [(re.sub(r"\s+", " ", html_lib.unescape(q)).strip(), re.sub(r"\s+", " ", html_lib.unescape(a)).strip()) for q, a in blocks]
    schemas = [json.loads(block) for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', source, re.S)]
    faq = next(item for item in schemas if item.get("@type") == "FAQPage")
    schema = [(item["name"], item["acceptedAnswer"]["text"]) for item in faq["mainEntity"]]
    assert visible == schema
    assert len(visible) >= 6


def test_trust_privacy_and_navigation_contract():
    source = page_html()
    assert "Quick MBTI Test" not in re.search(r"<title>(.*?)</title>", source, re.S).group(1)
    assert "Quiz answers are scored in this page and are not sent as answer payloads." in source
    assert "not a hiring, clinical, diagnostic" in source
    assert "pagead2.googlesyndication.com" not in source
    assert "fetch(" not in source and "localStorage" not in source and "sessionStorage" not in source
    assert "My result from this quick 16-type personality quiz is" in source
    assert 'href="/game/"' in source
    assert "prefers-reduced-motion" in source


def test_final_review_cleanup_and_profiles_are_complete():
    source = page_html()
    assert "legacy-faq" not in source
    assert "There are 16 situational questions" not in source
    assert "Reviewed on September 20, 2026" in source
    assert "Reviewed on August 13, 2026" not in source
    assert "All 16 types at a glance" in source
    for type_code in (
        "ISTJ", "ISFJ", "INFJ", "INTJ", "ISTP", "ISFP", "INFP", "INTP",
        "ESTP", "ESFP", "ENFP", "ENTP", "ESTJ", "ESFJ", "ENFJ", "ENTJ",
    ):
        assert f"<strong>{type_code}</strong> —" in source

    profile_script = re.findall(r"<script(?: [^>]*)?>(.*?)</script>", source, re.S)[-2].rsplit("showQuestion();", 1)[0]
    values = subprocess.run(
        ["node", "-e", profile_script + "\nconsole.log(JSON.stringify(profiles));"],
        capture_output=True, text=True, check=True,
    )
    profiles = json.loads(values.stdout.strip().splitlines()[-1])
    expected = {"ISTJ", "ISFJ", "INFJ", "INTJ", "ISTP", "ISFP", "INFP", "INTP", "ESTP", "ESFP", "ENFP", "ENTP", "ESTJ", "ESFJ", "ENFJ", "ENTJ"}
    assert set(profiles) == expected
    assert all(len(fields) == 4 and all(field.strip() for field in fields) for fields in profiles.values())
    for phrase in ("ultimate people magnet", "Born to manage and lead", "Born to move and make things happen", "mastermind who always has a plan"):
        assert phrase not in source
    assert "const descriptions" not in source
