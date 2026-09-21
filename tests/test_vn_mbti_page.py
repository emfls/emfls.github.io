import html as html_lib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "vn/game/MBTI/index.html"
EN_PAGE = ROOT / "game/MBTI/index.html"


def source():
    return PAGE.read_text(encoding="utf-8")


def axis_sequence(path):
    text = path.read_text(encoding="utf-8")
    return re.findall(r'\{\s*q\s*:\s*".*?",\s*a\s*:\s*\[.*?\],\s*t\s*:\s*\["([EISNTFJP])",\s*"([EISNTFJP])"\s*\]', text, re.S)


def script_source():
    return re.findall(r"<script(?: [^>]*)?>(.*?)</script>", source(), re.S)[-1].rsplit("showQuestion();", 1)[0]


def test_inventory_is_twenty_and_balanced():
    questions = re.findall(r'\{\s*q\s*:\s*"(.*?)",\s*a\s*:\s*\[(.*?),\s*(.*?)\],\s*t\s*:\s*\["([EISNTFJP])",\s*"([EISNTFJP])"\]', source(), re.S)
    assert len(questions) == 20
    axes = [tuple(item[3:5]) for item in questions]
    assert {letter: sum(letter in axis for axis in axes) for letter in "EISNTFJP"} == {letter: 5 for letter in "EISNTFJP"}


def test_vietnamese_axis_sequence_matches_english_contract():
    en_axes = axis_sequence(EN_PAGE)
    vn_axes = axis_sequence(PAGE)
    assert len(en_axes) == 20
    assert len(vn_axes) == 20
    assert vn_axes == en_axes


def test_scoring_is_strict_majority_and_close_is_explicit():
    result = subprocess.run(["node", "-e", 'const retry={}; const share={};' + script_source() + '\nconsole.log(JSON.stringify({a: calculateType({E:3,I:2,S:3,N:2,T:3,F:2,J:3,P:2}), b: calculateType({E:2,I:3,S:2,N:3,T:2,F:3,J:2,P:3}), close: [isCloseAxis(3,2), isCloseAxis(4,1)]}));'], capture_output=True, text=True, check=True)
    assert json.loads(result.stdout.strip().splitlines()[-1]) == {"a": "ESTJ", "b": "INFP", "close": [True, False]}


def test_trust_metadata_privacy_and_navigation_contract():
    text = source()
    assert "Trắc nghiệm 16 kiểu tính cách miễn phí – 20 câu hỏi, kết quả nhanh" in text
    assert "Trắc nghiệm 16 kiểu tính cách nhanh" in text
    assert "không phải bài đánh giá MBTI® chính thức" in text
    assert "Cập nhật: 2026-09-21" in text
    assert "Không cần đăng ký" in text
    assert "không được gửi dưới dạng nội dung câu trả lời" in text
    assert "pagead2.googlesyndication.com" not in text
    assert all(term not in text for term in ("fetch(", "localStorage", "sessionStorage"))
    assert 'window.location.href=\'/vn/game/\'' in text
    assert "prefers-reduced-motion" in text
    assert text.count('application/ld+json') == 1
    assert '"@type":"WebApplication"' in text
    assert '"@type":"FAQPage"' not in text


def test_profiles_and_static_sections_are_complete():
    text = source()
    assert "forEach((type" not in text
    for code in ("ISTJ", "ISFJ", "INFJ", "INTJ", "ISTP", "ISFP", "INFP", "INTP", "ESTP", "ESFP", "ENFP", "ENTP", "ESTJ", "ESFJ", "ENFJ", "ENTJ"):
        assert f'<strong>{code}</strong>' in text
    assert all(label in text for label in ("Bài quiz này hoạt động như thế nào?", "4 cặp xu hướng", "Cách chấm điểm", "Khi hai phía gần nhau", "Giới hạn của bài quiz", "Quyền riêng tư"))
    values = subprocess.run(["node", "-e", 'const retry={}; const share={};' + script_source() + "\nconsole.log(JSON.stringify(profiles));"], capture_output=True, text=True, check=True)
    profiles = json.loads(values.stdout.strip().splitlines()[-1])
    assert len(profiles) == 16
    assert all(len(fields) == 4 and all(field.strip() for field in fields) for fields in profiles.values())
    assert len({fields[0] for fields in profiles.values()}) == 16
    assert len({tuple(fields) for fields in profiles.values()}) == 16


def test_hub_and_sitemap_keep_vietnamese_target_once():
    hub = (ROOT / "vn/game/index.html").read_text(encoding="utf-8")
    sitemap = (ROOT / "vn/sitemap.xml").read_text(encoding="utf-8")
    assert "Trắc nghiệm 16 kiểu tính cách" in hub
    assert sitemap.count("https://emfls.github.io/vn/game/MBTI/") == 1
