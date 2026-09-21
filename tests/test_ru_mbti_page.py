import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "ru/game/MBTI/index.html"
EN_PAGE = ROOT / "game/MBTI/index.html"


def source(path=PAGE):
    return path.read_text(encoding="utf-8")


def axis_sequence(path):
    return re.findall(
        r'\{\s*q\s*:\s*".*?",\s*a\s*:\s*\[.*?\],\s*t\s*:\s*\["([EISNTFJP])",\s*"([EISNTFJP])"\s*\]',
        source(path), re.S,
    )


def script_source():
    return re.findall(r"<script(?: [^>]*)?>(.*?)</script>", source(), re.S)[-1].rsplit("showQuestion();", 1)[0]


def test_question_inventory_is_twenty_and_balanced():
    questions = re.findall(r'\{\s*q\s*:\s*"(.*?)",\s*a\s*:\s*\[(.*?),\s*(.*?)\],\s*t\s*:\s*\["([EISNTFJP])",\s*"([EISNTFJP])"\]', source(), re.S)
    assert len(questions) == 20
    assert {letter: sum(letter in item[3:5] for item in questions) for letter in "EISNTFJP"} == {letter: 5 for letter in "EISNTFJP"}
    assert len(re.findall(r'\ba\s*:\s*\[', source())) == 20


def test_ru_axis_sequence_matches_root_contract():
    assert len(axis_sequence(EN_PAGE)) == 20
    assert len(axis_sequence(PAGE)) == 20
    assert axis_sequence(PAGE) == axis_sequence(EN_PAGE)


def test_scoring_is_strict_majority_and_close_is_explicit():
    result = subprocess.run(
        ["node", "-e", "const retry={}; const share={};" + script_source() + '\nconsole.log(JSON.stringify({a:calculateType({E:3,I:2,S:3,N:2,T:3,F:2,J:3,P:2}),b:calculateType({E:2,I:3,S:2,N:3,T:2,F:3,J:2,P:3}),close:[isCloseAxis(3,2),isCloseAxis(2,3),isCloseAxis(4,1),isCloseAxis(5,0)]}));'],
        capture_output=True, text=True, check=True,
    )
    assert json.loads(result.stdout.strip().splitlines()[-1]) == {"a": "ESTJ", "b": "INFP", "close": [True, True, False, False]}


def test_profiles_are_explicit_unique_and_complete():
    text = source()
    assert "forEach((type" not in text
    values = subprocess.run(["node", "-e", "const retry={}; const share={};" + script_source() + "\nconsole.log(JSON.stringify(profiles));"], capture_output=True, text=True, check=True)
    profiles = json.loads(values.stdout.strip().splitlines()[-1])
    expected = {"ISTJ", "ISFJ", "INFJ", "INTJ", "ISTP", "ISFP", "INFP", "INTP", "ESTP", "ESFP", "ENFP", "ENTP", "ESTJ", "ESFJ", "ENFJ", "ENTJ"}
    assert set(profiles) == expected
    assert all(len(fields) == 4 and all(field.strip() for field in fields) for fields in profiles.values())
    assert len({fields[0] for fields in profiles.values()}) == 16
    assert len({tuple(fields) for fields in profiles.values()}) == 16


def test_trust_privacy_schema_and_navigation_contract():
    text = source()
    assert "Бесплатный тест на 16 типов личности — быстро и без регистрации" in text
    assert "Быстрый тест на 16 типов личности" in text
    assert "не является официальной оценкой MBTI®" in text
    assert "The Myers-Briggs Company" in text
    assert "20 вопросов" in text and "без регистрации" in text
    assert "Обновлено: 21 сентября 2026 г." in text
    assert "Ответы подсчитываются прямо на этой странице" in text
    assert "Реклама в этом тесте сейчас отключена" in text
    assert "pagead2.googlesyndication.com/pagead/js/adsbygoogle.js" not in text
    assert "adsbygoogle.push" not in text
    assert all(term not in text for term in ("fetch(", "XMLHttpRequest", "localStorage", "sessionStorage"))
    assert 'window.location.href = "/ru/game/"' in text
    assert "prefers-reduced-motion" in text
    schemas = [json.loads(item) for item in re.findall(r'<script type="application/ld\+json">(.*?)</script>', text, re.S)]
    assert [item["@type"] for item in schemas].count("WebApplication") == 1
    assert all(item["@type"] not in {"VideoGame", "FAQPage"} for item in schemas)
    webapp = next(item for item in schemas if item["@type"] == "WebApplication")
    assert webapp["url"] == "https://emfls.github.io/ru/game/MBTI/"
    assert webapp["inLanguage"] == "ru"
    assert webapp["dateModified"] == "2026-09-21"
    assert webapp["isAccessibleForFree"] is True


def test_static_sections_and_hub_contract():
    text = source()
    for section in ("Как работает этот тест?", "Четыре пары предпочтений", "Как считается результат", "Если результат близкий", "16 типов личности — краткий обзор", "Что этот тест не может определить", "Конфиденциальность"):
        assert section in text
    for code in ("ISTJ", "ISFJ", "INFJ", "INTJ", "ISTP", "ISFP", "INFP", "INTP", "ESTP", "ESFP", "ENFP", "ENTP", "ESTJ", "ESFJ", "ENFJ", "ENTJ"):
        assert f"<strong>{code}</strong>" in text
    hub = source(ROOT / "ru/game/index.html")
    assert "Тест на 16 типов личности" in hub
    assert "20 ситуационных вопросов, бесплатно, без регистрации и с быстрым результатом." in hub
