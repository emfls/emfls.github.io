import html as html_lib
import json
import re
import subprocess
from pathlib import Path

import pytest


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

OFFICIAL_SOURCES = {
    "car": (
        "https://main.kotsa.or.kr/portal/contents.do?menuCode=01010102",
        "https://main.kotsa.or.kr/portal/contents.do?menuCode=01010000",
        "https://www.cyberts.kr/",
    ),
    "pension": (
        "https://www.moel.go.kr/retirementpay.do",
        "https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1032588861",
        "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7888&mi=2312",
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


def test_car_tool_has_bounded_fee_lookup_and_official_handoff():
    result = run_pure(PAGES["car"][0], "lookupInspectionFee('unknown','unknown')")
    assert result["status"] == "unknown"
    html = read_page("car")
    assert "대행 수수료와 검사 수수료는 다릅니다" in html
    assert "확정 견적이 아닙니다" in html
    assert all(source in html for source in OFFICIAL_SOURCES["car"])


@pytest.mark.parametrize(
    ("inspection_type", "vehicle_class", "fee"),
    [
        ("정기검사", "경형", 17000),
        ("정기검사", "소형", 23000),
        ("정기검사", "중형", 26500),
        ("정기검사", "대형", 29000),
        ("종합검사(부하)", "경형", 48000),
        ("종합검사(부하)", "소형", 54000),
        ("종합검사(부하)", "중형", 56000),
        ("종합검사(부하)", "대형", 65000),
        ("종합검사(무부하)", "경형", 34000),
        ("종합검사(무부하)", "소형", 39000),
        ("종합검사(무부하)", "중형", 45000),
        ("종합검사(무부하)", "대형", 49000),
        ("종합검사(배출면제)", "경형", 15000),
        ("종합검사(배출면제)", "소형", 20000),
        ("종합검사(배출면제)", "중형", 24000),
        ("종합검사(배출면제)", "대형", 26000),
    ],
)
def test_car_tool_returns_only_verified_fee_mappings(inspection_type, vehicle_class, fee):
    result = run_pure(
        PAGES["car"][0],
        f"lookupInspectionFee({inspection_type!r}, {vehicle_class!r})",
    )
    assert result == {
        "status": "known",
        "fee": fee,
        "label": f"{inspection_type} · {vehicle_class}",
    }


@pytest.mark.parametrize(
    ("inspection_type", "vehicle_class"),
    [("정기검사", "알수없음"), ("알수없음", "소형")],
)
def test_car_tool_rejects_partially_unknown_fee_mappings(inspection_type, vehicle_class):
    result = run_pure(
        PAGES["car"][0],
        f"lookupInspectionFee({inspection_type!r}, {vehicle_class!r})",
    )
    assert result == {"status": "unknown", "fee": None, "label": "확인 필요"}


def test_date_calculator_handles_leap_reverse_inclusive_and_weekdays():
    path = PAGES["date"][0]
    assert run_pure(path, "daysBetween('2024-02-28','2024-03-01',false)")["days"] == 2
    assert run_pure(path, "daysBetween('2024-03-01','2024-02-28',false)")["days"] == -2
    assert run_pure(path, "daysBetween('2024-02-28','2024-03-01',true)")["days"] == 3
    assert run_pure(path, "shiftDate('2024-02-28',1)")["date"] == "2024-02-29"
    assert run_pure(path, "weekdaysBetween('2026-09-07','2026-09-13',true)")["days"] == 5


def test_date_calculator_excludes_both_weekday_endpoints_when_not_inclusive():
    path = PAGES["date"][0]
    assert run_pure(path, "weekdaysBetween('2026-09-07','2026-09-11',false)")["days"] == 3
    assert run_pure(path, "weekdaysBetween('2026-09-11','2026-09-07',false)")["days"] == -3


def test_date_calculator_rejects_out_of_range_integer_shift():
    result = run_pure(PAGES["date"][0], "shiftDate('2024-02-28', 10 ** 12)")
    assert result["error"]


def test_date_calculator_pure_block_is_executable_once():
    html = read_page("date")
    assert re.search(r"<script>\s*<!-- PURE_START -->", html)
    assert html.count("function parseUtcDate") == 1


def test_pension_tool_calculates_only_gross_illustrations():
    path = PAGES["pension"][0]
    result = run_pure(path, "calculatePensionIllustration(12000000,10,0)")
    assert result["zeroReturnMonthly"] == 100000
    assert result["assumedReturnMonthly"] == 100000
    assert "세금·수수료를 계산하지 않습니다" in read_page("pension")
    assert "수익률을 직접 입력" in read_page("pension")


def test_pension_tool_requires_explicit_return_and_rejects_invalid_inputs():
    path = PAGES["pension"][0]
    without_return = run_pure(path, "calculatePensionIllustration(12000000,10,null)")
    assert without_return == {
        "status": "ok",
        "zeroReturnMonthly": 100000,
        "assumedReturnMonthly": None,
    }
    assert run_pure(path, "calculatePensionIllustration(12000000,10,3)") == {
        "status": "ok",
        "zeroReturnMonthly": 100000,
        "assumedReturnMonthly": 115873,
    }
    for expression in (
        "calculatePensionIllustration(0,10,null)",
        "calculatePensionIllustration(12000000,0,null)",
        "calculatePensionIllustration(12000000,10,-100)",
        "calculatePensionIllustration(Infinity,10,null)",
    ):
        assert run_pure(path, expression) == {
            "status": "invalid",
            "zeroReturnMonthly": None,
            "assumedReturnMonthly": None,
        }


@pytest.mark.parametrize(
    "expression",
    [
        "calculatePensionIllustration(12000000,1e308,null)",
        "calculatePensionIllustration(Number.MAX_VALUE,Number.MIN_VALUE,null)",
    ],
)
def test_pension_tool_rejects_extreme_finite_inputs_with_invalid_monthly_amounts(expression):
    assert run_pure(PAGES["pension"][0], expression) == {
        "status": "invalid",
        "zeroReturnMonthly": None,
        "assumedReturnMonthly": None,
    }


def test_pension_tool_rejects_assumed_payment_that_rounds_to_zero():
    assert run_pure(
        PAGES["pension"][0],
        "calculatePensionIllustration(12000000,17,-99.99)",
    ) == {
        "status": "invalid",
        "zeroReturnMonthly": None,
        "assumedReturnMonthly": None,
    }


def test_pension_page_uses_official_handoffs_and_dom_safe_output():
    html = read_page("pension")
    assert all(source in html_lib.unescape(html) for source in OFFICIAL_SOURCES["pension"])
    assert 'id="annual-rate"' in html
    assert 'id="annual-rate" type="number"' in html
    assert ".innerHTML" not in html
    assert ".textContent" in html
    assert '"@type":"FAQPage"' in html


def test_pension_page_leaves_assumed_return_blank_and_neutral_by_default():
    html = read_page("pension")
    rate_input = re.search(r'<input\b(?=[^>]*\bid="annual-rate")[^>]*>', html)
    assert rate_input, "missing annual return input"
    value = re.search(r'\bvalue\s*=\s*(["\'])(.*?)\1', rate_input.group(0))
    assert value is None or value.group(2) == ""
    initial_result = re.search(r'<strong id="assumed-result">([^<]*)</strong>', html)
    assert initial_result and initial_result.group(1).strip() == "수익률을 입력하면 표시"
