import csv
import json
import re
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
URL = "/kor/util/water-purifier-rental-price-comparison/"
PAGE = ROOT / "kor/util/water-purifier-rental-price-comparison/index.html"


def pure(expression):
    html = PAGE.read_text(encoding="utf-8")
    script = re.search(r"<!-- PURE_START -->(.*?)<!-- PURE_END -->", html, re.S)
    assert script
    result = subprocess.run(
        ["node", "-e", script.group(1) + f"\nconsole.log(JSON.stringify({expression}));"],
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(result.stdout)


def test_water_purifier_tool_has_single_canonical_and_primary_intent():
    html = PAGE.read_text(encoding="utf-8")
    assert "<h1>정수기 렌탈 가격 비교 계산기</h1>" in html
    assert "https://emfls.github.io" + URL in html
    for keyword in ("정수기렌탈가격비교", "정수기렌탈가격", "정수기가격비교", "정수기렌탈비교", "정수기렌탈추천"):
        assert keyword in html
    assert "제휴카드 할인 전" in html
    assert "방문관리" in html and "자가관리" in html
    assert "중도해지" in html and "소유권" in html
    assert "https://bestshop.lge.co.kr/story/insight/benefit/IN10009000" in html
    assert "https://www.coway.com/product/detail?optno=12&amp;prdno=211" in html
    assert "body{margin:0;overflow-x:hidden" in html


def test_calculator_uses_actual_input_and_never_makes_card_total_negative():
    result = pure("calculateRentalTotals(30000, 15000, [36, 48, 60, 72])")
    assert result["before"]["36"] == 1080000
    assert result["after"]["72"] == 1080000
    zero = pure("calculateRentalTotals(10000, 15000, [36])")
    assert zero["after"]["36"] == 0


def test_publication_is_registered_without_secondary_doorways():
    sitemap = ET.parse(ROOT / "kor/sitemap.xml")
    locations = {node.text for node in sitemap.iter() if node.tag.endswith("loc")}
    assert "https://emfls.github.io" + URL in locations
    assert URL in (ROOT / "kor/util/index.html").read_text(encoding="utf-8")
    metadata = json.loads((ROOT / "data/content-metadata.json").read_text(encoding="utf-8"))
    entry = next(row for row in metadata if row["url"] == URL)
    assert entry["target_query"] == "정수기렌탈가격비교"
    experiments = json.loads((ROOT / "data/content-launch-experiments.json").read_text(encoding="utf-8"))["experiments"]
    experiment = next(row for row in experiments if row["url"] == URL)
    assert experiment["status"] == "OBSERVING"
    assert experiment["observeUntil"] == "2026-10-10"
    with (ROOT / "data/keywords_master.csv").open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    primary = next(row for row in rows if row["keyword"] == "정수기렌탈가격비교")
    assert primary["status"] == "PUBLISHED"
    assert primary["closest_url"] == URL
    assert not any(row["keyword"] in {"정수기렌탈가격", "정수기가격비교", "정수기렌탈비교", "정수기렌탈추천"} and row["status"] == "PUBLISHED" for row in rows)
