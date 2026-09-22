from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def _measurement_command(workflow):
    text = (ROOT / ".github" / "workflows" / workflow).read_text(encoding="utf-8")
    start = text.index("python3 scripts/revenue_growth.py")
    return text[start : text.index("\n", text.index("--report", start))]


def test_ga4_refresh_regenerates_measurements_with_latest_gsc_snapshot():
    command = _measurement_command("ga4-collection.yml")

    assert "--performance data/performance/ga4-latest.json" in command
    assert "--gsc-snapshot data/performance/gsc-latest.json" in command
    assert "--page-output data/page-performance.json" in command


def test_gsc_refresh_keeps_using_gsc_snapshot_for_measurement_regeneration():
    command = _measurement_command("gsc-collection.yml")

    assert "--gsc-snapshot data/performance/gsc-latest.json" in command
