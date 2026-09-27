#!/usr/bin/env python3
"""Submit newly published, production-verifiable URLs to IndexNow."""

import argparse
import json
import os
import re
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


PUBLIC_ORIGIN = "https://emfls.github.io"
PUBLIC_HOST = "emfls.github.io"
KEY_PATH = "/indexnow-key.txt"
INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"
REQUEST_TIMEOUT = 20
MAX_429_RETRIES = 2
PRODUCTION_POLL_ATTEMPTS = 20
PRODUCTION_POLL_INTERVAL = 30
REPORT_SCHEMA_VERSION = 1


class GateError(RuntimeError):
    """A fail-closed production or submission gate failure."""


def ensure_same_host_https(url):
    parsed = urlparse(str(url or ""))
    if parsed.scheme != "https" or parsed.netloc != PUBLIC_HOST or parsed.username or parsed.password:
        raise GateError("URL_HOST_OR_SCHEME_INVALID")
    return url


def should_skip_actor(actor):
    return str(actor or "").lower().endswith("[bot]")


def _manifest_url(manifest, index, path):
    urls = manifest.get("urls") or []
    raw = urls[index] if index < len(urls) else "/" + path.lstrip("/")
    parsed = urlparse(str(raw))
    if not parsed.scheme:
        raw = PUBLIC_ORIGIN + "/" + str(raw).lstrip("/")
    return ensure_same_host_https(raw)


def candidate_urls(manifest, changed_paths):
    """Return only changed contentPaths from a PUBLISHED manifest."""
    if manifest.get("status") != "PUBLISHED":
        return []
    changed = {str(path).lstrip("/") for path in changed_paths}
    paths = manifest.get("contentPaths") or []
    candidates = []
    for index, path in enumerate(paths):
        normalized = str(path).lstrip("/")
        if normalized in changed:
            url = _manifest_url(manifest, index, normalized)
            if url not in candidates:
                candidates.append(url)
    return candidates


def _status(response):
    return int(getattr(response, "status", response.getcode() if hasattr(response, "getcode") else 0))


def _headers(response):
    return getattr(response, "headers", {}) or {}


def _read_response(response):
    body = response.read()
    if isinstance(body, bytes):
        return body.decode("utf-8", errors="replace")
    return str(body)


def _request(opener, request):
    try:
        return opener(request, timeout=REQUEST_TIMEOUT)
    except TypeError:
        return opener(request)


def _get(opener, url):
    request = Request(url, headers={"User-Agent": "emfls-indexnow-submit/1"})
    try:
        with _request(opener, request) as response:
            return _status(response), _headers(response), _read_response(response), response.geturl()
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace") if hasattr(error, "read") else ""
        return int(error.code), getattr(error, "headers", {}) or {}, body, url
    except URLError as error:
        raise GateError("PRODUCTION_REQUEST_FAILED") from error


def verify_key_file(key, opener=urlopen):
    if not key or key.strip() != key or not re.fullmatch(r"[A-Za-z0-9_-]{8,128}", key):
        raise GateError("INDEXNOW_KEY_INVALID")
    key_url = PUBLIC_ORIGIN + KEY_PATH
    status, _headers_value, body, final_url = _get(opener, key_url)
    if status != 200:
        raise GateError("KEY_FILE_HTTP_STATUS")
    ensure_same_host_https(final_url or key_url)
    if body.strip() != key:
        raise GateError("KEY_MISMATCH")
    return key_url


def _attribute(tag, name):
    match = re.search(r"\b" + re.escape(name) + r"\s*=\s*([\"'])(.*?)\1", tag, re.I | re.S)
    return match.group(2).strip() if match else ""


def _has_noindex(html, headers):
    if "noindex" in str(headers.get("X-Robots-Tag", "")).lower():
        return True
    for tag in re.findall(r"<meta\b[^>]*>", html, re.I | re.S):
        if _attribute(tag, "name").lower() == "robots" and "noindex" in _attribute(tag, "content").lower():
            return True
    return False


def _canonical(html):
    for tag in re.findall(r"<link\b[^>]*>", html, re.I | re.S):
        rel = {token.lower() for token in _attribute(tag, "rel").split()}
        if "canonical" in rel:
            return _attribute(tag, "href")
    return ""


def validate_production_page(url, key, opener=urlopen, check_key=True):
    ensure_same_host_https(url)
    if check_key:
        verify_key_file(key, opener=opener)
    status, headers, html, final_url = _get(opener, url)
    if status != 200:
        raise GateError("PAGE_HTTP_STATUS")
    ensure_same_host_https(final_url or url)
    if _has_noindex(html, headers):
        raise GateError("NOINDEX_PAGE")
    if _canonical(html) != url:
        raise GateError("CANONICAL_MISMATCH")
    return {"url": url, "status": "VERIFIED", "httpStatus": status}


def wait_for_production_ready(
    urls,
    key,
    opener=urlopen,
    sleep=time.sleep,
    attempts=PRODUCTION_POLL_ATTEMPTS,
    interval=PRODUCTION_POLL_INTERVAL,
):
    """Poll Pages propagation without retrying invalid input or unsafe URLs."""
    if not urls:
        raise GateError("INDEXNOW_URL_LIST_EMPTY")
    for url in urls:
        ensure_same_host_https(url)

    last_error = None
    for attempt in range(attempts):
        try:
            verify_key_file(key, opener=opener)
            return [
                validate_production_page(url, key, opener=opener, check_key=False)
                for url in urls
            ]
        except GateError as error:
            if str(error) in {"INDEXNOW_KEY_INVALID", "URL_HOST_OR_SCHEME_INVALID"}:
                raise
            last_error = error
            if attempt + 1 < attempts:
                sleep(interval)

    raise GateError("PRODUCTION_NOT_READY") from last_error


def submit_urls(urls, key, opener=urlopen, sleep=time.sleep, max_retries=MAX_429_RETRIES):
    if not urls:
        raise GateError("INDEXNOW_URL_LIST_EMPTY")
    for url in urls:
        ensure_same_host_https(url)
    key_url = PUBLIC_ORIGIN + KEY_PATH
    payload = {
        "host": PUBLIC_HOST,
        "key": key,
        "keyLocation": key_url,
        "urlList": list(urls),
    }
    request = Request(
        INDEXNOW_ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "emfls-indexnow-submit/1"},
        method="POST",
    )
    for attempt in range(max_retries + 1):
        try:
            with _request(opener, request) as response:
                status = _status(response)
                retry_after = _headers(response).get("Retry-After", "")
        except HTTPError as error:
            status = int(error.code)
            retry_after = getattr(error, "headers", {}).get("Retry-After", "")
        except URLError as error:
            raise GateError("INDEXNOW_REQUEST_FAILED") from error
        if status in {200, 202}:
            return {"status": status, "submitted": len(urls)}
        if status == 429 and attempt < max_retries:
            try:
                delay = min(60, max(0, int(retry_after)))
            except (TypeError, ValueError):
                delay = min(60, 2 ** attempt)
            sleep(delay)
            continue
        if status == 429:
            raise GateError("INDEXNOW_429_RETRIES_EXHAUSTED")
        raise GateError("INDEXNOW_HTTP_%s" % status)
    raise GateError("INDEXNOW_429_RETRIES_EXHAUSTED")


def build_report(
    status,
    candidates,
    submitted,
    errors,
    mode="auto",
    before_sha="",
    after_sha="",
    indexnow_status="NOT_SENT",
):
    return {
        "schemaVersion": REPORT_SCHEMA_VERSION,
        "mode": mode,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "beforeSha": before_sha,
        "afterSha": after_sha,
        "host": PUBLIC_HOST,
        "keyLocation": PUBLIC_ORIGIN + KEY_PATH,
        "candidateCount": len(candidates),
        "candidates": list(candidates),
        "submitted": list(submitted),
        "errors": list(errors),
        "status": status,
        "finalStatus": status,
        "indexnowStatus": indexnow_status,
    }


def _write_report(path, report):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _changed_paths(root, before, sha):
    if not before or before == "0" * 40 or before == sha:
        return set()
    result = subprocess.run(
        ["git", "diff", "--name-only", before, sha],
        cwd=str(root),
        text=True,
        capture_output=True,
        check=True,
    )
    return {line.strip() for line in result.stdout.splitlines() if line.strip()}


def _backfill_urls(value):
    return [item.strip() for item in re.split(r"[\n,]+", value or "") if item.strip()]


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--before", default=os.environ.get("EVENT_BEFORE", ""))
    parser.add_argument("--sha", default=os.environ.get("GITHUB_SHA", "HEAD"))
    parser.add_argument("--manifest", type=Path, default=Path("data/content-launch-manifest.json"))
    parser.add_argument("--report", type=Path, default=Path("artifacts/indexnow-report.json"))
    parser.add_argument("--actor", default=os.environ.get("GITHUB_ACTOR", ""))
    parser.add_argument("--backfill-urls", default=os.environ.get("BACKFILL_URLS", ""))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    root = args.root.resolve()
    report_path = args.report if args.report.is_absolute() else root / args.report
    mode = "manual" if os.environ.get("GITHUB_EVENT_NAME") == "workflow_dispatch" else "auto"

    if should_skip_actor(args.actor):
        report = build_report("SKIP_BOT_COMMIT", [], [], [], mode=mode, before_sha=args.before, after_sha=args.sha)
        _write_report(report_path, report)
        print("SKIP_BOT_COMMIT")
        return 0

    manifest_path = args.manifest if args.manifest.is_absolute() else root / args.manifest
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    changed = _changed_paths(root, args.before, args.sha)
    candidates = candidate_urls(manifest, changed)
    for url in _backfill_urls(args.backfill_urls):
        ensure_same_host_https(url)
        if url not in candidates:
            candidates.append(url)

    if not candidates:
        report = build_report(
            "SKIP_NO_CHANGED_LAUNCH_URL",
            [],
            [],
            [],
            mode=mode,
            before_sha=args.before,
            after_sha=args.sha,
        )
        _write_report(report_path, report)
        print("SKIP_NO_CHANGED_LAUNCH_URL")
        return 0

    key = os.environ.get("INDEXNOW_KEY", "")
    try:
        wait_for_production_ready(candidates, key)
        if args.dry_run:
            report = build_report(
                "DRY_RUN_VERIFIED",
                candidates,
                [],
                [],
                mode=mode,
                before_sha=args.before,
                after_sha=args.sha,
            )
        else:
            submitted = submit_urls(candidates, key)
            report = build_report(
                "SUBMITTED",
                candidates,
                candidates,
                [],
                mode=mode,
                before_sha=args.before,
                after_sha=args.sha,
                indexnow_status=submitted["status"],
            )
            report["submission"] = submitted
    except GateError as error:
        report = build_report(
            "FAILED",
            candidates,
            [],
            [str(error)],
            mode=mode,
            before_sha=args.before,
            after_sha=args.sha,
        )
        _write_report(report_path, report)
        print(json.dumps(report, ensure_ascii=False))
        return 1
    _write_report(report_path, report)
    print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
