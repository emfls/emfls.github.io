import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

PAGES = {
    "car": ("kor/util/car-inspection-cost/index.html", "자동차검사 비용·예약 도우미"),
    "date": ("kor/util/date-calculator/index.html", "날짜 계산기"),
    "pension": (
        "kor/util/retirement-pension-withdrawal/index.html",
        "퇴직연금 수령 시나리오 비교기",
    ),
    "camp": (
        "kor/report/camp/carbon-monoxide-detector.html",
        "캠핑 일산화탄소 경보기 안전 가이드",
    ),
    "esta": (
        "kor/report/visa/esta-application-checklist.html",
        "ESTA 신청 체크 도우미",
    ),
    "pet": (
        "kor/report/animal/pet-food-selector.html",
        "반려동물 사료 선택 도우미",
    ),
}


def read_page(slug):
    relative, _ = PAGES[slug]
    return (ROOT / relative).read_text(encoding="utf-8")


def run_pure(relative, expression):
    html = (ROOT / relative).read_text(encoding="utf-8")
    block = re.search(r"<!-- PURE_START -->(.*?)<!-- PURE_END -->", html, re.S)
    assert block, f"missing pure block: {relative}"
    result = subprocess.run(
        ["node", "-e", block.group(1) + f"\nconsole.log(JSON.stringify({expression}));"],
        text=True,
        capture_output=True,
        check=True,
    )
    return json.loads(result.stdout)


def test_all_pages_meet_shared_publication_contract():
    for relative, h1 in PAGES.values():
        html = (ROOT / relative).read_text(encoding="utf-8")
        assert '<meta name="viewport"' in html
        assert f"<h1>{h1}</h1>" in html
        assert f"https://emfls.github.io/{relative.removesuffix('index.html')}" in html
        assert "G-QP5Q67GE5B" in html
        assert "ca-pub-8830524482034754" in html
        assert "2026-09-10" in html
        assert "application/ld+json" in html
        assert "개인정보" in html or "브라우저" in html
