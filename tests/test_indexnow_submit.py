import json
import subprocess
import sys
from pathlib import Path

import pytest

from scripts.indexnow_submit import (
    GateError,
    build_report,
    candidate_urls,
    ensure_same_host_https,
    should_skip_actor,
    submit_urls,
    validate_production_page,
    wait_for_production_ready,
)


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github/workflows/indexnow-submit.yml"


class FakeResponse:
    def __init__(self, status=200, body="", headers=None, url=None):
        self.status = status
        self._body = body.encode("utf-8") if isinstance(body, str) else body
        self.headers = headers or {}
        self._url = url

    def read(self):
        return self._body

    def geturl(self):
        return self._url

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


def test_only_changed_published_content_paths_become_candidates():
    manifest = {
        "status": "PUBLISHED",
        "contentPaths": ["kor/new/index.html", "kor/old.html"],
        "urls": ["/kor/new/", "/kor/old.html"],
    }

    assert candidate_urls(manifest, {"kor/new/index.html", "kor/other.html"}) == [
        "https://emfls.github.io/kor/new/"
    ]


def test_non_published_manifest_has_no_automatic_candidates():
    manifest = {
        "status": "READY_TO_LAUNCH",
        "contentPaths": ["kor/new/index.html"],
        "urls": ["/kor/new/"],
    }

    assert candidate_urls(manifest, {"kor/new/index.html"}) == []


@pytest.mark.parametrize(
    "url",
    [
        "http://emfls.github.io/kor/new/",
        "https://example.com/kor/new/",
        "https://emfls.github.io.evil.example/kor/new/",
    ],
)
def test_only_emfls_https_urls_are_allowed(url):
    with pytest.raises(GateError):
        ensure_same_host_https(url)


def test_bot_commit_is_skipped_without_submitting():
    assert should_skip_actor("github-actions[bot]") is True
    assert should_skip_actor("dependabot[bot]") is True
    assert should_skip_actor("whitesmile") is False


def test_production_gate_requires_matching_key_and_canonical_page():
    key = "a" * 32
    page_url = "https://emfls.github.io/kor/new/"
    html = '<html><head><meta name="robots" content="index,follow"><link rel="canonical" href="%s"></head></html>' % page_url

    def opener(request, timeout=0):
        url = request.full_url
        if url.endswith("/indexnow-key.txt"):
            return FakeResponse(body=key, url=url)
        return FakeResponse(body=html, url=page_url)

    result = validate_production_page(page_url, key, opener=opener)
    assert result == {"url": page_url, "status": "VERIFIED", "httpStatus": 200}


def test_production_gate_rejects_key_mismatch_noindex_and_canonical_mismatch():
    page_url = "https://emfls.github.io/kor/new/"

    def bad_key_opener(request, timeout=0):
        return FakeResponse(body="different", url=request.full_url)

    with pytest.raises(GateError, match="KEY_MISMATCH"):
        validate_production_page(page_url, "a" * 32, opener=bad_key_opener)

    def bad_page_opener(request, timeout=0):
        if request.full_url.endswith("/indexnow-key.txt"):
            return FakeResponse(body="a" * 32, url=request.full_url)
        body = '<meta name="robots" content="noindex"><link rel="canonical" href="https://emfls.github.io/other/">'
        return FakeResponse(body=body, url=page_url)

    with pytest.raises(GateError, match="NOINDEX"):
        validate_production_page(page_url, "a" * 32, opener=bad_page_opener)


def test_production_polling_retries_until_ready_then_submits():
    key = "a" * 32
    page_url = "https://emfls.github.io/kor/new/"
    html = '<link rel="canonical" href="%s">' % page_url
    page_attempts = []
    sleeps = []

    def opener(request, timeout=0):
        url = request.full_url
        if url.endswith("/indexnow-key.txt"):
            return FakeResponse(body=key, url=url)
        if url == page_url:
            page_attempts.append(1)
            if len(page_attempts) < 3:
                return FakeResponse(status=404, url=url)
            return FakeResponse(body=html, url=page_url)
        return FakeResponse(status=202, body="accepted", url=url)

    verified = wait_for_production_ready(
        [page_url],
        key,
        opener=opener,
        sleep=sleeps.append,
        attempts=3,
        interval=30,
    )
    submission = submit_urls([item["url"] for item in verified], key, opener=opener, sleep=lambda _: None)

    assert verified == [{"url": page_url, "status": "VERIFIED", "httpStatus": 200}]
    assert submission == {"status": 202, "submitted": 1}
    assert page_attempts == [1, 1, 1]
    assert sleeps == [30, 30]


def test_production_polling_fails_closed_after_max_attempts():
    key = "a" * 32
    page_url = "https://emfls.github.io/kor/new/"
    sleeps = []

    def opener(request, timeout=0):
        if request.full_url.endswith("/indexnow-key.txt"):
            return FakeResponse(body=key, url=request.full_url)
        return FakeResponse(status=404, url=request.full_url)

    with pytest.raises(GateError, match="PRODUCTION_NOT_READY"):
        wait_for_production_ready(
            [page_url],
            key,
            opener=opener,
            sleep=sleeps.append,
            attempts=3,
            interval=30,
        )

    assert sleeps == [30, 30]


def test_invalid_input_fails_without_polling():
    sleeps = []

    with pytest.raises(GateError, match="INDEXNOW_KEY_INVALID"):
        wait_for_production_ready(
            ["https://emfls.github.io/kor/new/"],
            "bad key",
            sleep=sleeps.append,
            attempts=3,
            interval=30,
        )

    assert sleeps == []


def test_bulk_submission_accepts_200_and_202():
    requests = []

    def opener(request, timeout=0):
        requests.append(json.loads(request.data.decode("utf-8")))
        return FakeResponse(status=202, body="accepted", url=request.full_url)

    result = submit_urls(
        ["https://emfls.github.io/kor/new/"],
        "a" * 32,
        opener=opener,
        sleep=lambda _: None,
    )
    assert result["status"] == 202
    assert requests[0]["urlList"] == ["https://emfls.github.io/kor/new/"]
    assert requests[0]["host"] == "emfls.github.io"


def test_bulk_submission_retries_429_with_bounded_attempts():
    attempts = []

    def opener(request, timeout=0):
        attempts.append(1)
        return FakeResponse(status=429, headers={"Retry-After": "0"}, url=request.full_url)

    with pytest.raises(GateError, match="INDEXNOW_429_RETRIES_EXHAUSTED"):
        submit_urls(
            ["https://emfls.github.io/kor/new/"],
            "a" * 32,
            opener=opener,
            sleep=lambda _: None,
            max_retries=2,
        )
    assert len(attempts) == 3


def test_artifact_report_never_contains_key():
    report = build_report(
        status="SKIP_NO_CHANGED_LAUNCH_URL",
        candidates=[],
        submitted=[],
        errors=[],
    )
    encoded = json.dumps(report, ensure_ascii=False)
    assert "INDEXNOW_KEY" not in encoded
    assert "aaaaaaaa" not in encoded


def test_report_contract_contains_runtime_fields_without_secret():
    report = build_report(
        status="SUBMITTED",
        candidates=["https://emfls.github.io/kor/new/"],
        submitted=["https://emfls.github.io/kor/new/"],
        errors=[],
        mode="manual",
        before_sha="before",
        after_sha="after",
        indexnow_status=202,
    )

    assert report["schemaVersion"] == 1
    assert report["mode"] == "manual"
    assert report["beforeSha"] == "before"
    assert report["afterSha"] == "after"
    assert report["host"] == "emfls.github.io"
    assert report["keyLocation"] == "https://emfls.github.io/indexnow-key.txt"
    assert report["candidateCount"] == 1
    assert report["submitted"] == ["https://emfls.github.io/kor/new/"]
    assert report["finalStatus"] == "SUBMITTED"
    assert report["indexnowStatus"] == 202
    assert "aaaaaaaa" not in json.dumps(report)


def test_workflow_contract_is_present():
    source = WORKFLOW.read_text(encoding="utf-8")
    script = (ROOT / "scripts/indexnow_submit.py").read_text(encoding="utf-8")
    assert "workflow_dispatch" in source
    assert "branches: [main]" in source or "- main" in source
    assert "INDEXNOW_KEY" in source
    assert "api.indexnow.org/indexnow" in script
    assert "upload-artifact@v4" in source
    assert "github-actions[bot]" in source
    assert "timeout-minutes: 15" in source
    assert "GITHUB_STEP_SUMMARY" in source
    assert "submitted URLs" in source
    assert "IndexNow HTTP status" in source


def test_cli_dry_run_reports_no_changed_launch_url(tmp_path):
    root = tmp_path
    (root / "data").mkdir()
    (root / "data/content-launch-manifest.json").write_text(
        json.dumps({"status": "PUBLISHED", "contentPaths": ["kor/new.html"], "urls": ["/kor/new.html"]}),
        encoding="utf-8",
    )
    report = root / "report.json"
    result = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts/indexnow_submit.py"),
            "--root",
            str(root),
            "--before",
            "same",
            "--sha",
            "same",
            "--report",
            str(report),
        ],
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0
    assert "SKIP_NO_CHANGED_LAUNCH_URL" in result.stdout
    assert json.loads(report.read_text(encoding="utf-8"))["status"] == "SKIP_NO_CHANGED_LAUNCH_URL"
