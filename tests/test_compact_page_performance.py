import hashlib
import json
import subprocess
import sys
from pathlib import Path

import pytest

from scripts.compact_page_performance import project, project_file, serialize_compact


PAGE_FIELDS = {"url", "classification", "cooldown", "cluster", "pageScore"}
CHANNEL_FIELDS = {
    "ga4": {"status", "period", "source", "views", "users", "engagementSeconds", "revenue", "revenueMetric"},
    "google": {"status", "period", "source", "clicks", "impressions", "ctr", "position"},
    "naver": {"status", "period", "source", "clicks", "impressions", "ctr", "position"},
    "adsense": {"status", "period", "source", "revenue", "rpm", "revenueMetric", "coverageStatus"},
}


def _page(url, classification=None):
    return {
        "url": url,
        "classification": classification,
        "cooldown": False,
        "cluster": None,
        "pageScore": 0,
        "ga4": {
            "status": "NOT_CONNECTED", "period": None, "source": None, "views": None,
            "users": None, "engagementSeconds": None, "revenue": None, "revenueMetric": None,
        },
        "google": {
            "status": "NOT_CONNECTED", "period": None, "source": None, "clicks": None,
            "impressions": None, "ctr": None, "position": None,
        },
        "naver": {
            "status": "NOT_CONNECTED", "period": None, "source": None, "clicks": None,
            "impressions": None, "ctr": None, "position": None,
        },
        "adsense": {
            "status": "NOT_CONNECTED", "period": None, "source": None, "revenue": None,
            "rpm": None, "revenueMetric": None, "coverageStatus": None,
        },
    }


def _payload(pages=None):
    pages = pages if pages is not None else [_page("/z/"), _page("/a/")]
    return {
        "schemaVersion": 1,
        "asOf": "2026-10-06",
        "summary": {"evaluatedIndexablePages": len(pages)},
        "pages": pages,
        "generatedAt": "discard-me",
    }


def _write_full_inputs(root, payload):
    full = root / "page-performance-full.json"
    full.write_text(json.dumps(payload), encoding="utf-8")
    page_scores = root / "page-scores.json"
    page_scores.write_text(json.dumps({
        "as_of": payload["asOf"],
        "summary": {"evaluated_indexable_pages": len(payload["pages"])},
        "pages": [{"url": page["url"]} for page in payload["pages"]],
    }), encoding="utf-8")
    return full, page_scores


def test_projector_emits_only_proven_consumer_fields_and_sorts_normalized_urls():
    payload = _payload([_page("/z/"), _page("/a/"), _page("/b/index.html", "WINNER")])
    payload["pages"][0]["internalLinkTargets"] = ["large-unused-field"]
    payload["pages"][0]["ga4"]["diagnostic"] = {"unused": True}

    compact = project(payload)

    assert set(compact) == {"schemaVersion", "asOf", "summary", "pages"}
    assert set(compact["summary"]) == {"evaluatedIndexablePages"}
    assert [page["url"] for page in compact["pages"]] == ["/a/", "/b/index.html", "/z/"]
    assert all(set(page) == PAGE_FIELDS | set(CHANNEL_FIELDS) for page in compact["pages"])
    for page in compact["pages"]:
        for channel, fields in CHANNEL_FIELDS.items():
            assert set(page[channel]) == fields
    assert "internalLinkTargets" not in compact["pages"][-1]
    assert "diagnostic" not in compact["pages"][-1]["ga4"]


def test_identical_input_has_stable_compact_utf8_bytes_and_trailing_newline():
    payload = _payload([_page("/kor/report/camp/테스트/"), _page("/util/a/")])

    first = serialize_compact(project(payload))
    second = serialize_compact(project(payload))

    assert hashlib.sha256(first).digest() == hashlib.sha256(second).digest()
    assert first.endswith(b"\n")
    assert first.count(b"\n") == 1
    assert "테스트".encode("utf-8") in first
    assert json.loads(first) == project(payload)


@pytest.mark.parametrize("mutation", ["row", "classification", "channel", "metric"])
def test_projector_rejects_malformed_rows_without_filling_missing_values(mutation):
    page = _page("/only/")
    if mutation == "row":
        page = "not-an-object"
    elif mutation == "classification":
        page.pop("classification")
    elif mutation == "channel":
        page.pop("naver")
    else:
        page["ga4"].pop("views")

    with pytest.raises(ValueError):
        project(_payload([page]))


def test_project_file_validates_full_input_before_replacing_output(tmp_path):
    page = _page("/only/")
    page.pop("classification")
    full, page_scores = _write_full_inputs(tmp_path, _payload([page]))
    output = tmp_path / "page-performance-compact.json"
    output.write_bytes(b"last-good\n")

    with pytest.raises(ValueError, match="classification"):
        project_file(full, page_scores, output)

    assert output.read_bytes() == b"last-good\n"


def test_projector_cli_runs_as_workflow_invoked_script(tmp_path):
    full, page_scores = _write_full_inputs(tmp_path, _payload([_page("/only/")]))
    output = tmp_path / "compact.json"
    root = Path(__file__).resolve().parents[1]
    completed = subprocess.run(
        [
            sys.executable,
            str(root / "scripts" / "compact_page_performance.py"),
            str(full),
            "--page-scores",
            str(page_scores),
            "--output",
            str(output),
        ],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    assert completed.returncode == 0, completed.stderr
    assert json.loads(output.read_text(encoding="utf-8")) == project(_payload([_page("/only/")]))
