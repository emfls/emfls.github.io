"""Regression vectors for the inline functions delivered by the Korean tools."""
import json
from pathlib import Path
import re
import subprocess
import zlib

ROOT = Path(__file__).resolve().parents[1]


def run_function(slug, name, expressions):
    html = (ROOT / "kor" / "util" / slug / "index.html").read_text()
    definition = re.search(
        rf"^(?P<indent> +)function {name}\([^\n]*\) \{{.*?^(?P=indent)\}}",
        html,
        re.MULTILINE | re.DOTALL,
    )
    assert definition, f"{slug}: {name}"
    program = definition.group() + "\nconsole.log(JSON.stringify([" + ",".join(expressions) + "]));"
    return json.loads(subprocess.check_output(["node", "-e", program], text=True))


def test_birthday_uses_calendar_dates_at_noon_and_on_either_side():
    yesterday, today, tomorrow = run_function("age", "calcAge", [
        f"calcAge('2000-11-20', new Date(2026, 10, {day}, 12))" for day in (19, 20, 21)
    ])
    assert "D-1 " in yesterday and "<span>25</span>" in yesterday
    assert "D-0" in today and "<span>26</span>" in today
    assert "D-364 " in tomorrow and "<span>26</span>" in tomorrow


def test_crc32_matches_independent_reference_for_all_byte_values():
    vectors = [b"", b"123456789", bytes(range(256)), "한글 😀".encode()]
    actual = run_function("crc", "crc32", [
        f"crc32(Uint8Array.from({list(value)}))" for value in vectors
    ])
    assert actual == [f"{zlib.crc32(value):08X}" for value in vectors]


def test_month_end_deposits_at_zero_and_nonzero_rates():
    actual = run_function("compound-interest", "compoundWithDeposit", [
        f"compoundWithDeposit(1000, 100, 0, {frequency}, 1)" for frequency in (1, 2, 4, 12, 365)
    ] + ["compoundWithDeposit(1000, 100, .12, 12, 1)"])
    assert actual[:5] == [2200] * 5
    balance = 1000
    for _ in range(12):
        balance = balance * 1.01 + 100
    assert abs(actual[-1] - balance) < 1.e-8
