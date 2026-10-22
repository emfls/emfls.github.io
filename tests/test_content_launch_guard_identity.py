import csv
import json
import os
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from scripts.content_url_planner import plan_url
from scripts.external_content_opportunity import launch_readiness
from scripts.content_launch_guard import _validated_c02_034_approval
from scripts.ops_paths import ops_path


REPO = Path(__file__).resolve().parents[1]
GUARD = REPO / "scripts/content_launch_guard.py"
SEOUL = ZoneInfo("Asia/Seoul")
C02_CANDIDATE_ID = "C01-20261011-032-IPHONEDATE"
C02_CANDIDATE_URL = "/kor/report/window/iphone-photos-date-taken.html"
C02_CANDIDATE_PATH = "kor/report/window/iphone-photos-date-taken.html"
C02_CANDIDATE_TITLE = "아이폰 사진 촬영일, 윈도우에서 확인하는 방법"
C02_CANDIDATE_INTENT = "윈도우에서 아이폰 사진의 촬영일을 확인하고 전송 문제를 진단"
C02_034_PRE_PHASE_A_GUARD_BLOB_SHA = "ff29edfa2256f716699a6360414c37be5f25877d"


def write_json(root, relative, value):
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def controlled_experiment_approval(**overrides):
    today = datetime.now(SEOUL).date()
    record = {
        "approvalId": "C02-20261011-034-IPHONE-001",
        "approvalVersion": 1,
        "taskId": "C01-20261011-032",
        "candidateId": C02_CANDIDATE_ID,
        "url": C02_CANDIDATE_URL,
        "canonicalUrl": f"https://emfls.github.io{C02_CANDIDATE_URL}",
        "contentPath": C02_CANDIDATE_PATH,
        "hubPath": "kor/report/window/index.html",
        "sitemapPath": "kor/report/window/sitemap.xml",
        "title": C02_CANDIDATE_TITLE,
        "primaryIntent": C02_CANDIDATE_INTENT,
        "experimentScope": "ONE_PAGE",
        "demandStatus": "VOLUME_UNKNOWN",
        "approvalStatus": "CT_SCOPED_EXPERIMENT_REVIEW_ONLY",
        "approvalBasis": "STANDING_AUTHORIZATION_NARROWED_TO_THIS_TASK",
        "ymyl": False,
        "approvalRefs": [
            "https://app.notion.com/p/3f6db4c0a9918175b79bcbe85fabfbdd",
            "https://app.notion.com/p/3f6db4c0a99181dc8227d7fde28b740a",
        ],
        "validFrom": today.isoformat(),
        "validThrough": (today + timedelta(days=7)).isoformat(),
        "revoked": False,
        "sourceReview": {
            "status": "REPORTED_REVIEWED_BY_C01",
            "reviewedByTask": "C01-20261011-032",
            "reviewedAt": today.isoformat(),
            "recordRef": "https://app.notion.com/p/3f6db4c0a991818ebc3cccfddb68a3c7",
            "sources": [
                {"url": "https://support.apple.com/ko-kr/120267", "supports": "USB and iCloud transfer steps"},
                {"url": "https://support.apple.com/ko-kr/116944", "supports": "HEIF and High Compatibility format facts"},
                {"url": "https://support.microsoft.com/en-us/windows/apps/photos/import-photos-and-videos-from-phone-to-pc", "supports": "Windows Photos import steps"},
                {"url": "https://learn.microsoft.com/en-us/windows/win32/properties/props-system-photo-datetaken", "supports": "System.Photo.DateTaken property meaning"},
                {"url": "https://cipa.jp/std/documents/e/DC-X010-2017.pdf", "supports": "Exif DateTimeOriginal tag semantics"},
            ],
        },
    }
    record.update(overrides)
    return {"schemaVersion": 1, "approvals": [record]}


def keyword_source(keyword, *, category="article", content_types="informational", intent="informational"):
    url = plan_url(keyword, category, content_types, intent)
    return {
        "candidateId": f"keyword:{keyword}",
        "keyword": keyword,
        "url": url,
        "contentPath": f"{url.lstrip('/')}index.html",
        "category": category,
        "content_types": content_types,
        "intent": intent,
        "queue": {
            "keyword": keyword,
            "suggested_url": url,
            "status": "READY_TO_LAUNCH",
            "review_status": "PAGE_REVIEW_READY",
            "category": category,
            "content_types": content_types,
            "intent": intent,
        },
        "master": {
            "keyword": keyword,
            "category": category,
            "content_types": content_types,
            "intent": intent,
            "action": "NEW_PAGE",
            "score_valid": "True",
            "status": "NEW",
        },
    }


def external_source(candidate_id="EXT-SAFE-01"):
    slug = candidate_id.casefold()
    candidate = {
        "candidateId": candidate_id,
        "idea": f"Prepare an external opportunity {candidate_id}",
        "status": "READY_TO_LAUNCH",
        "locale": "ko-KR",
        "url": f"/kor/report/external/{slug}.html",
        "contentPath": f"kor/report/external/{slug}.html",
        "sitemapPath": "kor/report/external/sitemap.xml",
        "hubPath": "kor/report/external/index.html",
        "discovery": {
            "origin": "EXTERNAL_WEB",
            "source": "GOOGLE",
            "method": "RELATED_SEARCH",
            "observedTopic": f"Independent external task {candidate_id}",
            "demandStatus": "OBSERVED_SEARCH_SIGNAL",
            "evidenceRefs": [f"https://example.com/{slug}"],
        },
        "intent": {"primary": f"Independent task {candidate_id}", "secondary": ["verification"]},
        "overlap": {"level": "NO_OVERLAP", "closestUrl": None},
        "contentGap": "An official checklist is missing.",
        "additionalValue": ["CHECKLIST"],
        "officialSources": [{"url": f"https://official.example/{slug}", "reviewedAt": "2026-09-02"}],
        "supportingSources": [],
        "opportunityInputs": {key: 0.9 for key in (
            "demandSignal", "problemStrength", "differentiation", "monetization",
            "sourceReliability", "evergreen", "benefitVsCost",
        )} | {"nonOverlap": 1},
        "qualityInputs": {key: 0.9 for key in (
            "accuracy", "sourceCoverage", "originalStructure", "structuredValue",
            "notThin", "intentCompletion", "maintainability",
        )} | {"officialSources": 1},
        "selectionInputs": {"expectedRevenueImpact": 0.9, "demandConfidence": 0.7,
                            "evergreenPotential": 0.9, "competitionCost": 0.5},
        "brief": {
            "primaryIntent": f"Independent task {candidate_id}",
            "secondaryIntents": ["verification"],
            "keyFacts": ["Official process"],
            "potentialTable": "Checklist comparison",
            "potentialTool": "Lookup checklist",
            "faqCandidates": ["Where can it be verified?"],
            "closestExistingPage": None,
            "internalLinkPlan": ["/kor/"],
            "whySeparatePage": "The existing site does not cover this task.",
        },
    }
    assert launch_readiness(candidate)["status"] == "READY_TO_LAUNCH"
    return candidate


def create_base_repo(tmp_path, keywords=(), external=(), decisions=None, counter=None,
                     protected_experiments=(), protected_winners=(), duplicate_queue=(),
                     base_manifest=None, decision_rows=None, experiment_approvals=None):
    root = tmp_path / "repo"
    root.mkdir(parents=True)
    (root / ".gitignore").write_text(".DS_Store\n", encoding="utf-8")
    data = root / "data"
    data.mkdir()
    queue = [candidate["queue"] for candidate in keywords]
    queue.extend(duplicate_queue)
    write_json(root, "data/content-launch-queue.json", {"dailyLimit": 3, "queue": queue})
    write_json(root, "data/content-launch-decisions.json", {
        "schemaVersion": 1,
        "decisions": decision_rows if decision_rows is not None else [
            {"keyword": keyword, "decision": decision, "reason": "Control Tower decision"}
            for keyword, decision in (decisions or {}).items()
        ],
    })
    write_json(root, "data/external-content-opportunities.json", {
        "schemaVersion": 1,
        "candidates": list(external),
        "readyToLaunch": [row["candidateId"] for row in external],
    })
    write_json(root, "data/published_keywords.json", [])
    write_json(root, "data/content-launch-experiments.json", {"experiments": []})
    if experiment_approvals is not None:
        write_json(root, "data/content-launch-experiment-approvals.json", experiment_approvals)
    trusted_manifest = {
        "schemaVersion": 1, "status": "NO_PUBLICATION", "runAt": "2026-01-01T00:00:00+09:00",
        "candidateIds": [], "urls": [], "contentPaths": [], "dailyLimit": 3,
    }
    trusted_manifest.update(base_manifest or {})
    write_json(root, "data/content-launch-manifest.json", trusted_manifest)
    write_json(root, "data/content-launch-counter.json", counter or {
        "schemaVersion": 2, "dailyLimit": 3, "date": "2026-01-01", "launchedCount": 0,
    })
    write_json(root, "data/experiments.json", {"experiments": list(protected_experiments)})
    write_json(root, "data/revenue-opportunities.json", {"protectedWinners": list(protected_winners)})
    write_json(root, "data/site-audit.json", {"pages": []})
    hub = root / "kor/launch-hub.html"
    hub.parent.mkdir(parents=True, exist_ok=True)
    hub.write_text("<!-- existing launch hub -->", encoding="utf-8")
    window_hub = root / "kor/report/window/index.html"
    window_hub.parent.mkdir(parents=True, exist_ok=True)
    window_hub.write_text("<!-- existing Windows guide hub -->", encoding="utf-8")
    (window_hub.parent / "sitemap.xml").write_text("<urlset></urlset>\n", encoding="utf-8")
    master_path = data / "keywords_master.csv"
    master_path.parent.mkdir(parents=True, exist_ok=True)
    fields = ["keyword", "category", "content_types", "intent", "action", "score_valid", "status"]
    with master_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(candidate["master"] for candidate in keywords)

    subprocess.run(["git", "init", "-q"], cwd=root, check=True)
    subprocess.run(["git", "config", "user.name", "Guard Fixture"], cwd=root, check=True)
    subprocess.run(["git", "config", "user.email", "guard-fixture@example.invalid"], cwd=root, check=True)
    subprocess.run(["git", "add", "-A"], cwd=root, check=True)
    subprocess.run(["git", "commit", "-qm", "trusted base"], cwd=root, check=True)
    base_sha = subprocess.run(["git", "rev-parse", "HEAD"], cwd=root, text=True,
                              capture_output=True, check=True).stdout.strip()
    return root, base_sha


def run_launch(tmp_path, *, sources=(), external=(), decisions=None, proposals=(),
               manifest_override=None, head_changes=None, counter=None,
               protected_experiments=(), protected_winners=(), duplicate_queue=(),
               changed_existing=(), base_manifest=None, decision_rows=None,
               experiment_approvals=None, guard=GUARD):
    root, base_sha = create_base_repo(
        tmp_path, sources, external, decisions, counter,
        protected_experiments, protected_winners, duplicate_queue, base_manifest,
        decision_rows=decision_rows,
        experiment_approvals=experiment_approvals,
    )
    if head_changes:
        for relative, value in head_changes.items():
            path = root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            if isinstance(value, str):
                path.write_text(value, encoding="utf-8")
            else:
                path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    urls = [row.get("url") for row in proposals]
    content_paths = [row.get("contentPath") for row in proposals]
    candidate_ids = [row.get("candidateId") for row in proposals]
    manifest = {
        "schemaVersion": 1,
        "status": "READY",
        "runAt": datetime.now(SEOUL).isoformat(),
        "dailyLimit": 12,
        "publishedToday": (counter or {}).get("launchedCount", 0),
        "urls": urls,
        "contentPaths": content_paths,
        "candidateIds": candidate_ids,
        "sitemapPaths": ["kor/launch-sitemap.xml"],
        "hubPaths": ["kor/launch-hub.html"],
    }
    manifest.update(manifest_override or {})
    write_json(root, "data/content-launch-manifest.json", manifest)
    canonical_urls = manifest.get("urls") or []
    sitemap_text = "\n".join(
        value if str(value).startswith("https://") else f"https://emfls.github.io{value}"
        for value in canonical_urls if value
    )
    for relative in manifest.get("sitemapPaths") or []:
        sitemap = root / relative
        sitemap.parent.mkdir(parents=True, exist_ok=True)
        sitemap.write_text(sitemap_text, encoding="utf-8")
    hub_text = "\n".join(f'<a href="{value}">Launch</a>' for value in canonical_urls if value)
    for relative in manifest.get("hubPaths") or []:
        hub = root / relative
        hub.parent.mkdir(parents=True, exist_ok=True)
        hub.write_text(hub_text, encoding="utf-8")

    for index, proposal in enumerate(proposals):
        relative = proposal.get("filePath") or proposal.get("contentPath")
        if not relative:
            continue
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        title = proposal.get("title") or f"Launch candidate {index}"
        canonical = proposal.get("canonical")
        if canonical is None:
            url = proposal.get("url") or ""
            canonical = url if str(url).startswith("https://") else f"https://emfls.github.io{url}"
        canonical_tag = proposal.get("canonicalTag") or f'<link rel="canonical" href="{canonical}">'
        path.write_text(
            f'<html><head><title>{title}</title>{canonical_tag}'
            '<meta name="viewport" content="width=device-width"></head><body>'
            f'<h1>{title}</h1><script type="application/ld+json">{{}}</script></body></html>',
            encoding="utf-8",
        )
    for relative, content in (changed_existing or ()):
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    subprocess.run(["git", "add", "-A"], cwd=root, check=True)
    subprocess.run(["git", "commit", "-qm", "proposed launch"], cwd=root, check=True)
    result = subprocess.run(
        ["python3", str(guard), "--root", str(root), "--manifest",
         "data/content-launch-manifest.json", "--base-ref", base_sha],
        cwd=REPO, text=True, capture_output=True, check=False,
        env={**os.environ, "PYTHONPATH": str(REPO), "EMFLS_OPS_DIR": str(root)},
    )
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise AssertionError(f"guard did not emit JSON: {result.stdout!r} {result.stderr!r}") from exc
    return payload


def proposal(candidate, **overrides):
    value = {key: candidate[key] for key in ("candidateId", "url", "contentPath")}
    value.update(overrides)
    return value


def controlled_proposal(**overrides):
    candidate = {
        "candidateId": C02_CANDIDATE_ID,
        "url": C02_CANDIDATE_URL,
        "contentPath": C02_CANDIDATE_PATH,
    }
    candidate.update(overrides)
    return {**candidate, "title": candidate.pop("title", C02_CANDIDATE_TITLE)}


def controlled_manifest(**overrides):
    return {
        "taskId": "C01-20261011-032",
        "experimentScope": "ONE_PAGE",
        "demandStatus": "VOLUME_UNKNOWN",
        "dailyLimit": 1,
        "candidateIntents": [C02_CANDIDATE_INTENT],
        "candidateTitles": [C02_CANDIDATE_TITLE],
        "hubPaths": ["kor/report/window/index.html"],
        "sitemapPaths": ["kor/report/window/sitemap.xml"],
        "status": "READY_FOR_REVIEW",
        **overrides,
    }


def published_manifest_record(*, candidate_id="keyword:키보드청소방법", url="/kor/report/it/keyboard-cleaning-guide.html",
                              run_at="2026-10-05T06:48:56+09:00", published_today=1):
    return {
        "schemaVersion": 1,
        "status": "PUBLISHED",
        "runId": "P0-20261005-KEYBOARD-CLEANING",
        "runAt": run_at,
        "dailyLimit": 1,
        "publishedToday": published_today,
        "candidateIds": [candidate_id],
        "urls": [url],
        "contentPaths": [f"{url.lstrip('/')}"],
        "hubPaths": ["kor/report/it/index.html"],
        "sitemapPaths": ["kor/report/it/sitemap.xml"],
    }


def run_controlled_experiment(tmp_path, *, approvals="valid", proposal_overrides=None,
                              manifest_overrides=None, decisions=None,
                              protected_experiments=(), protected_winners=(), head_changes=None,
                              base_manifest=None, guard=GUARD):
    if approvals == "valid":
        approvals = controlled_experiment_approval()
    return run_launch(
        tmp_path,
        proposals=[controlled_proposal(**(proposal_overrides or {}))],
        experiment_approvals=approvals,
        manifest_override=controlled_manifest(**(manifest_overrides or {})),
        decisions=decisions,
        protected_experiments=protected_experiments,
        protected_winners=protected_winners,
        head_changes=head_changes,
        base_manifest=base_manifest,
        guard=guard,
    )


def test_c02_034_exact_approved_unknown_experiment_is_bound_to_trusted_base(tmp_path):
    result = run_controlled_experiment(tmp_path)
    assert result == {"status": "PASS", "errors": []}


def test_c02_034_pre_phase_a_base_guard_still_rejects_the_same_synthetic_page(tmp_path):
    baseline_guard = tmp_path / "baseline-content-launch-guard.py"
    baseline_source = subprocess.run(
        ["git", "show", C02_034_PRE_PHASE_A_GUARD_BLOB_SHA],
        cwd=REPO, text=True, capture_output=True, check=True,
    ).stdout
    baseline_guard.write_text(baseline_source, encoding="utf-8")
    result = run_controlled_experiment(tmp_path / "phase-b", guard=baseline_guard)
    assert result["status"] == "FAIL"
    assert "TRUSTED_CANDIDATE_NOT_FOUND" in result["errors"]


def test_c02_034_checked_in_approval_is_ct_scoped_and_source_backed(monkeypatch):
    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2026, 10, 11, tzinfo=tz)

    monkeypatch.setattr("scripts.content_launch_guard.datetime", FrozenDateTime)
    approvals = json.loads(ops_path("data/content-launch-experiment-approvals.json").read_text(encoding="utf-8"))
    record, issue = _validated_c02_034_approval({"json": {
        "data/content-launch-experiment-approvals.json": approvals,
    }})
    assert issue is None
    assert record["approvalStatus"] == "CT_SCOPED_EXPERIMENT_REVIEW_ONLY"
    assert record["approvalBasis"] == "STANDING_AUTHORIZATION_NARROWED_TO_THIS_TASK"
    assert record["demandStatus"] == "VOLUME_UNKNOWN"
    assert "monthlySearchVolume" not in record


def test_c02_034_does_not_authorize_another_unknown_candidate(tmp_path):
    result = run_controlled_experiment(
        tmp_path,
        proposal_overrides={
            "candidateId": "EXT-OTHER-UNKNOWN",
            "url": "/kor/report/window/another-unknown.html",
            "contentPath": "kor/report/window/another-unknown.html",
        },
    )
    assert result["status"] == "FAIL"
    assert "TRUSTED_CANDIDATE_NOT_FOUND" in result["errors"]


@pytest.mark.parametrize(("proposal_overrides", "manifest_overrides", "error"), [
    ({"url": "/kor/report/window/changed.html", "contentPath": "kor/report/window/changed.html"}, {}, "CANDIDATE_IDENTITY_MISMATCH"),
    ({"canonical": "https://emfls.github.io/kor/report/window/changed.html"}, {}, "CANONICAL_MISMATCH"),
    ({"title": "다른 주제"}, {}, "CANDIDATE_IDENTITY_MISMATCH"),
    ({}, {"candidateIntents": ["다른 사용자 의도"]}, "CANDIDATE_IDENTITY_MISMATCH"),
    ({}, {"candidateTitles": ["다른 제목"]}, "CANDIDATE_IDENTITY_MISMATCH"),
])
def test_c02_034_identity_intent_title_and_canonical_mismatches_are_blocked(
    tmp_path, proposal_overrides, manifest_overrides, error,
):
    result = run_controlled_experiment(
        tmp_path, proposal_overrides=proposal_overrides, manifest_overrides=manifest_overrides,
    )
    assert result["status"] == "FAIL"
    assert error in result["errors"]


@pytest.mark.parametrize("invalidity", [
    "expired", "revoked", "unreviewed", "missing_source", "altered_source",
    "wrong_candidate", "long_lived",
])
def test_c02_034_stale_revoked_or_unsubstantiated_approval_fails_closed(tmp_path, invalidity):
    approval = controlled_experiment_approval()
    record = approval["approvals"][0]
    if invalidity == "expired":
        record["validThrough"] = (datetime.now(SEOUL).date() - timedelta(days=1)).isoformat()
    elif invalidity == "revoked":
        record["revoked"] = True
    elif invalidity == "unreviewed":
        record["sourceReview"]["status"] = "UNKNOWN"
    elif invalidity == "missing_source":
        record["sourceReview"]["sources"] = []
    elif invalidity == "altered_source":
        record["sourceReview"]["sources"][0]["url"] = "https://example.invalid/fake"
    elif invalidity == "wrong_candidate":
        record["candidateId"] = "EXT-OTHER-UNKNOWN"
    else:
        record["validThrough"] = (datetime.now(SEOUL).date() + timedelta(days=8)).isoformat()
    result = run_controlled_experiment(tmp_path, approvals=approval)
    assert result["status"] == "FAIL"
    assert "APPROVAL_EVIDENCE_UNAVAILABLE" in result["errors"]


def test_c02_034_duplicate_approval_records_are_ambiguous_and_blocked(tmp_path):
    approval = controlled_experiment_approval()
    approval["approvals"].append(dict(approval["approvals"][0]))
    result = run_controlled_experiment(tmp_path, approvals=approval)
    assert result["status"] == "FAIL"
    assert "APPROVAL_EVIDENCE_UNAVAILABLE" in result["errors"]
    assert "AMBIGUOUS_TRUSTED_CANDIDATE" in result["errors"]


def test_c02_034_head_only_approval_cannot_authorize_candidate(tmp_path):
    result = run_controlled_experiment(
        tmp_path, approvals=None,
        head_changes={"data/content-launch-experiment-approvals.json": controlled_experiment_approval()},
    )
    assert result["status"] == "FAIL"
    assert "TRUSTED_CANDIDATE_NOT_FOUND" in result["errors"]
    assert "APPROVAL_EVIDENCE_CHANGED_WITH_CONTENT" in result["errors"]


def test_c02_034_hold_decision_and_protected_candidate_remain_blocked(tmp_path):
    held = run_controlled_experiment(tmp_path / "held", decisions={C02_CANDIDATE_ID: "HOLD"})
    protected = run_controlled_experiment(
        tmp_path / "protected",
        protected_experiments=[{
            "candidateId": C02_CANDIDATE_ID, "url": C02_CANDIDATE_URL, "status": "OBSERVING",
        }],
    )
    assert held["status"] == "FAIL"
    assert "EDITORIAL_DECISION_BLOCKED" in held["errors"]
    assert protected["status"] == "FAIL"
    assert "PROTECTED_EXPERIMENT_CHANGED" in protected["errors"]


@pytest.mark.parametrize("decision", ["HOLD", "NO_NEW_PAGE", "UPDATE_EXISTING"])
def test_c02_034_all_editorial_stop_decisions_remain_blocked(tmp_path, decision):
    result = run_controlled_experiment(tmp_path, decisions={C02_CANDIDATE_ID: decision})
    assert result["status"] == "FAIL"
    assert "EDITORIAL_DECISION_BLOCKED" in result["errors"]


def test_c02_034_ymyl_and_protected_winner_remain_blocked(tmp_path):
    approval = controlled_experiment_approval()
    approval["approvals"][0]["ymyl"] = True
    ymyl = run_controlled_experiment(tmp_path / "ymyl", approvals=approval)
    winner = run_controlled_experiment(
        tmp_path / "winner",
        protected_winners=[{"url": C02_CANDIDATE_URL}],
    )
    assert ymyl["status"] == "FAIL"
    assert "YMYL_REVIEW_REQUIRED" in ymyl["errors"]
    assert winner["status"] == "FAIL"
    assert "PROTECTED_WINNER_CHANGED" in winner["errors"]


def test_c02_034_already_published_candidate_or_url_is_blocked(tmp_path):
    result = run_controlled_experiment(
        tmp_path,
        base_manifest={
            "status": "PUBLISHED",
            "runAt": "2026-10-01T09:00:00+09:00",
            "candidateIds": [C02_CANDIDATE_ID],
            "urls": [C02_CANDIDATE_URL],
            "contentPaths": [C02_CANDIDATE_PATH],
        },
    )
    assert result["status"] == "FAIL"
    assert "CANDIDATE_ALREADY_PUBLISHED" in result["errors"]


def test_c02_034_phase_b_must_preserve_the_prior_published_manifest_record(tmp_path):
    previous = published_manifest_record()
    retained = run_controlled_experiment(
        tmp_path / "retained",
        base_manifest=previous,
        manifest_overrides={"preservedManifestRecords": [previous]},
    )
    dropped = run_controlled_experiment(
        tmp_path / "dropped",
        base_manifest=previous,
    )
    assert retained == {"status": "PASS", "errors": []}
    assert dropped["status"] == "FAIL"
    assert "PUBLISHED_MANIFEST_HISTORY_DROPPED" in dropped["errors"]


def test_c02_034_preserved_manifest_history_still_blocks_republication_and_daily_overflow(tmp_path):
    already_published = published_manifest_record(
        candidate_id=C02_CANDIDATE_ID, url=C02_CANDIDATE_URL,
    )
    duplicate = run_controlled_experiment(
        tmp_path / "duplicate",
        base_manifest={"preservedManifestRecords": [already_published]},
        manifest_overrides={"preservedManifestRecords": [already_published]},
    )
    today = datetime.now(SEOUL).date().isoformat()
    prior_today = published_manifest_record(
        candidate_id="keyword:prior1", url="/kor/report/prior1.html",
        run_at=f"{today}T09:00:00+09:00", published_today=3,
    )
    prior_today["candidateIds"] = ["keyword:prior1", "keyword:prior2", "keyword:prior3"]
    prior_today["urls"] = ["/kor/report/prior1.html", "/kor/report/prior2.html", "/kor/report/prior3.html"]
    prior_today["contentPaths"] = ["kor/report/prior1.html", "kor/report/prior2.html", "kor/report/prior3.html"]
    overflow = run_controlled_experiment(
        tmp_path / "overflow",
        base_manifest={"preservedManifestRecords": [prior_today]},
        manifest_overrides={"preservedManifestRecords": [prior_today]},
    )
    assert duplicate["status"] == "FAIL"
    assert "CANDIDATE_ALREADY_PUBLISHED" in duplicate["errors"]
    assert overflow["status"] == "FAIL"
    assert "PUBLICATION_LIMIT_EXCEEDED" in overflow["errors"]


def test_c02_034_experiment_limit_and_guard_content_separation_remain_enforced(tmp_path):
    excessive = run_controlled_experiment(tmp_path / "limit", manifest_overrides={"dailyLimit": 2})
    mixed = run_controlled_experiment(
        tmp_path / "mixed",
        head_changes={"scripts/content_launch_guard.py": "# changed guard"},
    )
    assert excessive["status"] == "FAIL"
    assert "PUBLICATION_LIMIT_EXCEEDED" in excessive["errors"]
    assert mixed["status"] == "FAIL"
    assert "LAUNCH_GUARD_CHANGED_WITH_CONTENT" in mixed["errors"]


def test_unapproved_hold_route_cannot_borrow_an_unrelated_safe_keyword_id(tmp_path):
    safe = keyword_source("글자수계산기", category="tool", content_types="calculator/tool", intent="calculator/tool")
    hold = keyword_source("인천공항교통약자우대출구")
    result = run_launch(
        tmp_path, sources=[safe, hold], decisions={"인천공항교통약자우대출구": "HOLD"},
        proposals=[proposal(safe, url=hold["url"], contentPath=hold["contentPath"])],
    )
    assert result["status"] == "FAIL"
    assert "CANDIDATE_IDENTITY_MISMATCH" in result["errors"]


def test_unapproved_ymyl_route_cannot_borrow_an_unrelated_safe_keyword_id(tmp_path):
    safe = keyword_source("글자수계산기", category="tool", content_types="calculator/tool", intent="calculator/tool")
    ymyl = keyword_source("급여세금계산기", category="tool", content_types="calculator/tool", intent="calculator/tool")
    result = run_launch(tmp_path, sources=[safe, ymyl], proposals=[
        proposal(safe, url=ymyl["url"], contentPath=ymyl["contentPath"]),
    ])
    assert result["status"] == "FAIL"
    assert "CANDIDATE_IDENTITY_MISMATCH" in result["errors"]


def test_no_new_page_route_cannot_borrow_an_unrelated_safe_keyword_id(tmp_path):
    safe = keyword_source("글자수계산기", category="tool", content_types="calculator/tool", intent="calculator/tool")
    blocked = keyword_source("엔카중고차구매")
    result = run_launch(
        tmp_path, sources=[safe, blocked], decisions={"엔카중고차구매": "NO_NEW_PAGE"},
        proposals=[proposal(safe, url=blocked["url"], contentPath=blocked["contentPath"])],
    )
    assert result["status"] == "FAIL"
    assert "CANDIDATE_IDENTITY_MISMATCH" in result["errors"]


def test_trusted_keyword_id_url_path_and_canonical_binding_remains_publishable(tmp_path):
    safe = keyword_source("안전검색어")
    result = run_launch(tmp_path, sources=[safe], proposals=[proposal(safe)])
    assert result == {"status": "PASS", "errors": []}


def test_explicit_base_ymyl_approval_remains_publishable_for_matching_candidate(tmp_path):
    approved = keyword_source("급여세금계산기", category="tool", content_types="calculator/tool", intent="calculator/tool")
    result = run_launch(
        tmp_path, sources=[approved], decisions={"급여세금계산기": "APPROVE"},
        proposals=[proposal(approved)],
    )
    assert result == {"status": "PASS", "errors": []}


def test_missing_candidate_id_is_blocked(tmp_path):
    safe = keyword_source("안전검색어")
    result = run_launch(tmp_path, sources=[safe], proposals=[proposal(safe, candidateId=None)])
    assert result["status"] == "FAIL"
    assert "LAUNCH_CANDIDATE_IDS_REQUIRED" in result["errors"]


def test_duplicate_candidate_id_is_blocked(tmp_path):
    first, second = keyword_source("첫번째안전검색어"), keyword_source("두번째안전검색어")
    result = run_launch(tmp_path, sources=[first, second], proposals=[
        proposal(first), proposal(second, candidateId=first["candidateId"]),
    ])
    assert result["status"] == "FAIL"
    assert "LAUNCH_CANDIDATE_IDS_REQUIRED" in result["errors"]


def test_manifest_url_must_map_to_the_exact_added_content_path(tmp_path):
    safe = keyword_source("안전검색어")
    wrong = "kor/column/someone-elses-page/index.html"
    result = run_launch(tmp_path, sources=[safe], proposals=[proposal(safe)],
                        manifest_override={"contentPaths": [wrong]})
    assert result["status"] == "FAIL"
    assert "CANDIDATE_IDENTITY_MISMATCH" in result["errors"]


def test_swapping_candidate_ids_between_two_pages_is_blocked(tmp_path):
    first, second = keyword_source("첫번째안전검색어"), keyword_source("두번째안전검색어")
    result = run_launch(tmp_path, sources=[first, second], proposals=[
        proposal(first, candidateId=second["candidateId"]),
        proposal(second, candidateId=first["candidateId"]),
    ])
    assert result["status"] == "FAIL"
    assert "CANDIDATE_IDENTITY_MISMATCH" in result["errors"]


def test_candidate_added_only_to_pr_head_is_not_a_trusted_source(tmp_path):
    safe = keyword_source("새후보")
    head_queue = {"dailyLimit": 3, "queue": [safe["queue"]]}
    head_master = "keyword,category,content_types,intent,action,score_valid,status\n" \
                  "새후보,article,informational,informational,NEW_PAGE,True,NEW\n"
    result = run_launch(tmp_path, proposals=[proposal(safe)], head_changes={
        "data/content-launch-queue.json": head_queue,
        "data/keywords_master.csv": head_master,
    })
    assert result["status"] == "FAIL"
    assert "TRUSTED_CANDIDATE_NOT_FOUND" in result["errors"]


def test_duplicate_trusted_source_mapping_is_ambiguous_and_blocked(tmp_path):
    safe = keyword_source("안전검색어")
    result = run_launch(tmp_path, sources=[safe], duplicate_queue=[safe["queue"]], proposals=[proposal(safe)])
    assert result["status"] == "FAIL"
    assert "AMBIGUOUS_TRUSTED_CANDIDATE" in result["errors"]


def test_pr_queue_mutation_cannot_fabricate_candidate_authority(tmp_path):
    existing = keyword_source("기존안전후보")
    fabricated = keyword_source("조작된후보")
    result = run_launch(
        tmp_path, sources=[existing], proposals=[proposal(fabricated)],
        head_changes={
            "data/content-launch-queue.json": {"dailyLimit": 3, "queue": [fabricated["queue"]]},
            "data/keywords_master.csv": "keyword,category,content_types,intent,action,score_valid,status\n"
                                         "조작된후보,article,informational,informational,NEW_PAGE,True,NEW\n",
        },
    )
    assert result["status"] == "FAIL"
    assert "TRUSTED_CANDIDATE_NOT_FOUND" in result["errors"]


@pytest.mark.parametrize("head_decisions", [
    {"schemaVersion": 1, "decisions": []},
    {"schemaVersion": 1, "decisions": [{"keyword": "안전검색어", "decision": "APPROVE", "reason": "self approval"}]},
])
def test_pr_cannot_remove_hold_or_insert_approval_to_change_base_decision(tmp_path, head_decisions):
    safe = keyword_source("안전검색어")
    result = run_launch(
        tmp_path, sources=[safe], decisions={"안전검색어": "HOLD"}, proposals=[proposal(safe)],
        head_changes={"data/content-launch-decisions.json": head_decisions},
    )
    assert result["status"] == "FAIL"
    assert "EDITORIAL_DECISION_BLOCKED" in result["errors"]


def test_pr_inserted_ymyl_approval_is_not_authoritative(tmp_path):
    ymyl = keyword_source("급여세금계산기", category="tool", content_types="calculator/tool", intent="calculator/tool")
    result = run_launch(
        tmp_path, sources=[ymyl], proposals=[proposal(ymyl)],
        head_changes={"data/content-launch-decisions.json": {
            "schemaVersion": 1,
            "decisions": [{"keyword": "급여세금계산기", "decision": "APPROVE", "reason": "self approval"}],
        }},
    )
    assert result["status"] == "FAIL"
    assert "YMYL_REVIEW_REQUIRED" in result["errors"]


def test_new_html_blocks_removal_of_unrelated_hold(tmp_path):
    safe = keyword_source("안전검색어")
    result = run_launch(
        tmp_path, sources=[safe], decisions={"기존보호키워드": "HOLD"},
        proposals=[proposal(safe)],
        head_changes={"data/content-launch-decisions.json": {
            "schemaVersion": 1, "decisions": [],
        }},
    )
    assert result["status"] == "FAIL"
    assert "EDITORIAL_DECISION_TAMPERING" in result["errors"]


def test_new_html_blocks_insertion_of_unrelated_ymyl_approval(tmp_path):
    safe = keyword_source("안전검색어")
    result = run_launch(
        tmp_path, sources=[safe], decisions={"기존보호키워드": "HOLD"},
        proposals=[proposal(safe)],
        head_changes={"data/content-launch-decisions.json": {
            "schemaVersion": 1,
            "decisions": [
                {"keyword": "기존보호키워드", "decision": "HOLD"},
                {"keyword": "급여세금계산기", "decision": "APPROVE"},
            ],
        }},
    )
    assert result["status"] == "FAIL"
    assert "EDITORIAL_DECISION_TAMPERING" in result["errors"]


@pytest.mark.parametrize(("old_decision", "new_decision"), [
    ("NO_NEW_PAGE", "UPDATE_EXISTING"),
    ("NO_NEW_PAGE", None),
    ("UPDATE_EXISTING", None),
])
def test_new_html_blocks_unrelated_no_new_page_and_update_existing_changes(
    tmp_path, old_decision, new_decision,
):
    safe = keyword_source("안전검색어")
    decisions = {"기존보호키워드": old_decision}
    head_decisions = [] if new_decision is None else [
        {"keyword": "기존보호키워드", "decision": new_decision},
    ]
    result = run_launch(
        tmp_path, sources=[safe], decisions=decisions, proposals=[proposal(safe)],
        head_changes={"data/content-launch-decisions.json": {
            "schemaVersion": 1, "decisions": head_decisions,
        }},
    )
    assert result["status"] == "FAIL"
    assert "EDITORIAL_DECISION_TAMPERING" in result["errors"]


def test_new_html_allows_semantically_identical_editorial_decisions(tmp_path):
    safe = keyword_source("안전검색어")
    result = run_launch(
        tmp_path, sources=[safe], decisions={"기존보호키워드": "HOLD"},
        proposals=[proposal(safe)],
        head_changes={"data/content-launch-decisions.json":
            '{ "decisions" : [ { "reason": "reformatted", "decision": "HOLD", '
            '"keyword": "기존보호키워드" } ], "schemaVersion" : 1 }\n'},
    )
    assert result == {"status": "PASS", "errors": []}


def test_editorial_only_review_change_without_new_html_remains_passable(tmp_path):
    result = run_launch(
        tmp_path, decisions={"검토대상키워드": "HOLD"},
        head_changes={"data/content-launch-decisions.json": {
            "schemaVersion": 1,
            "decisions": [{"keyword": "검토대상키워드", "decision": "APPROVE"}],
        }},
    )
    assert result == {"status": "PASS", "errors": []}


def test_pr_cannot_change_launch_authority_code_and_add_html_in_the_same_head(tmp_path):
    safe = keyword_source("안전검색어")
    result = run_launch(
        tmp_path, sources=[safe], proposals=[proposal(safe)],
        head_changes={"scripts/content_url_planner.py": "def plan_url(*args, **kwargs): return '/forged/'\n"},
    )
    assert result["status"] == "FAIL"
    assert "LAUNCH_GUARD_CHANGED_WITH_CONTENT" in result["errors"]


def test_seo_qa_uses_immutable_pr_base_and_its_guard_implementation():
    workflow = (REPO / ".github/workflows/seo-qa.yml").read_text(encoding="utf-8")
    assert "BASE_SHA: ${{ github.event.pull_request.base.sha }}" in workflow
    assert 'git archive "$COMPARE_REF" scripts' in workflow
    assert '"$TRUSTED_GUARD_DIR/scripts/content_launch_guard.py"' in workflow
    assert 'COMPARE_REF="origin/$BASE_REF"' not in workflow


def test_valid_opaque_external_candidate_id_binds_to_trusted_external_record(tmp_path):
    external = external_source()
    result = run_launch(tmp_path, external=[external], proposals=[proposal(external)])
    assert result == {"status": "PASS", "errors": []}


def test_external_candidate_with_forged_url_or_content_path_is_blocked(tmp_path):
    external = external_source()
    result = run_launch(tmp_path, external=[external], proposals=[proposal(
        external, url="/kor/report/external/forged.html", contentPath="kor/report/external/forged.html",
    )])
    assert result["status"] == "FAIL"
    assert "CANDIDATE_IDENTITY_MISMATCH" in result["errors"]


def test_external_candidate_id_added_only_to_pr_head_is_not_trusted(tmp_path):
    external = external_source()
    result = run_launch(
        tmp_path, proposals=[proposal(external)],
        head_changes={"data/external-content-opportunities.json": {
            "schemaVersion": 1, "candidates": [external], "readyToLaunch": [external["candidateId"]],
        }},
    )
    assert result["status"] == "FAIL"
    assert "TRUSTED_CANDIDATE_NOT_FOUND" in result["errors"]


def test_duplicate_trusted_external_candidate_mapping_is_ambiguous(tmp_path):
    external = external_source()
    result = run_launch(tmp_path, external=[external, external], proposals=[proposal(external)])
    assert result["status"] == "FAIL"
    assert "AMBIGUOUS_TRUSTED_CANDIDATE" in result["errors"]


def test_external_candidate_hold_is_enforced_by_its_trusted_opaque_id(tmp_path):
    external = external_source()
    result = run_launch(
        tmp_path, external=[external], decisions={external["candidateId"]: "HOLD"},
        proposals=[proposal(external)],
    )
    assert result["status"] == "FAIL"
    assert "EDITORIAL_DECISION_BLOCKED" in result["errors"]


def test_external_source_ymyl_flag_requires_explicit_base_approval(tmp_path):
    external = external_source("EXT-NEUTRAL-YMYL-01")
    external.update({"ymyl": True, "limitations": "Scope is limited.", "disclaimer": "Verify official guidance."})
    result = run_launch(tmp_path, external=[external], proposals=[proposal(external)])
    assert result["status"] == "FAIL"
    assert "YMYL_REVIEW_REQUIRED" in result["errors"]


def test_external_source_ymyl_flag_passes_with_explicit_base_approval(tmp_path):
    external = external_source("EXT-NEUTRAL-YMYL-APPROVED-01")
    external.update({"ymyl": True, "limitations": "Scope is limited.", "disclaimer": "Verify official guidance."})
    result = run_launch(
        tmp_path, external=[external], decisions={external["candidateId"]: "APPROVE"},
        proposals=[proposal(external)],
    )
    assert result == {"status": "PASS", "errors": []}


def test_percent_encoded_published_url_alias_blocks_duplicate_launch(tmp_path):
    external = external_source("EXT-URL-ALIAS-01")
    external["url"] = "/kor/report/external/unique~topic.html"
    external["contentPath"] = "kor/report/external/unique~topic.html"
    result = run_launch(
        tmp_path, external=[external], proposals=[proposal(external)],
        base_manifest={
            "status": "PUBLISHED", "runAt": "2026-10-01T00:00:00+09:00",
            "candidateIds": ["EXT-OLD-URL"],
            "urls": ["/kor/report/external/unique%7Etopic.html"],
            "contentPaths": ["kor/report/external/unique~topic.html"],
        },
    )
    assert result["status"] == "FAIL"
    assert "CANDIDATE_ALREADY_PUBLISHED" in result["errors"]


def test_existing_published_manifest_without_new_html_changes_passes(tmp_path):
    root, base_sha = create_base_repo(tmp_path)
    write_json(root, "data/content-launch-manifest.json", {
        "schemaVersion": 1, "status": "PUBLISHED", "runAt": "2026-10-01T09:00:00+09:00",
        "candidateIds": ["keyword:already-published"], "urls": ["/kor/column/old/"],
        "contentPaths": ["kor/column/old/index.html"], "dailyLimit": 3,
    })
    subprocess.run(["git", "add", "-A"], cwd=root, check=True)
    subprocess.run(["git", "commit", "-qm", "manifest bookkeeping only"], cwd=root, check=True)
    result = subprocess.run(
        ["python3", str(GUARD), "--root", str(root), "--manifest",
         "data/content-launch-manifest.json", "--base-ref", base_sha],
        cwd=REPO, text=True, capture_output=True, check=False,
        env={**os.environ, "PYTHONPATH": str(REPO)},
    )
    assert json.loads(result.stdout) == {"status": "PASS", "errors": []}


def test_daily_publication_limit_allows_twelve_but_rejects_thirteen(tmp_path):
    candidates = [keyword_source(f"안전후보{i}") for i in range(13)]
    twelve = run_launch(tmp_path / "twelve", sources=candidates[:12],
                        proposals=[proposal(row) for row in candidates[:12]])
    thirteen = run_launch(tmp_path / "thirteen", sources=candidates,
                          proposals=[proposal(row) for row in candidates])
    assert twelve == {"status": "PASS", "errors": []}
    assert thirteen["status"] == "FAIL"
    assert "PUBLICATION_LIMIT_EXCEEDED" in thirteen["errors"]


def test_unparseable_base_publication_counter_fails_closed(tmp_path):
    safe = keyword_source("안전검색어")
    result = run_launch(
        tmp_path, sources=[safe], proposals=[proposal(safe)],
        counter={"schemaVersion": 2, "dailyLimit": 3, "date": "unknown", "launchedCount": 0},
    )
    assert result["status"] == "FAIL"
    assert "PUBLICATION_LIMIT_EXCEEDED" in result["errors"]


def test_base_winner_and_active_experiment_remain_protected_after_pr_removes_their_records(tmp_path):
    winner = "kor/report/camp/winner.html"
    experiment = "kor/report/camp/experiment.html"
    result = run_launch(
        tmp_path,
        head_changes={
            "data/revenue-opportunities.json": {"protectedWinners": []},
            "data/experiments.json": {"experiments": []},
        },
        protected_winners=[{"url": "/kor/report/camp/winner.html"}],
        protected_experiments=[{"url": "/kor/report/camp/experiment.html", "status": "OBSERVING"}],
        changed_existing=[(winner, "<html>edited</html>"), (experiment, "<html>edited</html>")],
    )
    assert result["status"] == "FAIL"
    assert "PROTECTED_WINNER_CHANGED" in result["errors"]
    assert "PROTECTED_EXPERIMENT_CHANGED" in result["errors"]


def test_absolute_manifest_url_and_canonical_attribute_order_are_normalized(tmp_path):
    safe = keyword_source("안전검색어")
    absolute = "https://EMFLS.github.io" + safe["url"]
    result = run_launch(
        tmp_path, sources=[safe], proposals=[proposal(
            safe, url=absolute, canonical=absolute,
            canonicalTag=f'<link href="{absolute}" rel="canonical">',
        )],
    )
    assert result == {"status": "PASS", "errors": []}


@pytest.mark.parametrize("bad_url", [
    "https://evil.example/kor/column/anjeongeomsaekeo/",
    "/kor/column/anjeongeomsaekeo/?tracking=1",
    "/kor/column/%2e%2e/secret/",
    "/kor//column/anjeongeomsaekeo/",
])
def test_url_normalization_rejects_cross_origin_query_and_ambiguous_paths(tmp_path, bad_url):
    safe = keyword_source("안전검색어")
    result = run_launch(
        tmp_path, sources=[safe], proposals=[proposal(safe, url=bad_url, canonical=bad_url)],
    )
    assert result["status"] == "FAIL"
    assert "CANDIDATE_IDENTITY_MISMATCH" in result["errors"]


@pytest.mark.parametrize("candidate,decision", [
    ("인천공항교통약자우대출구", "HOLD"),
    ("엔카중고차구매", "NO_NEW_PAGE"),
])
def test_previously_confirmed_editorial_bypasses_are_blocked(candidate, decision, tmp_path):
    blocked = keyword_source(candidate)
    result = run_launch(tmp_path, sources=[blocked], decisions={candidate: decision},
                        proposals=[proposal(blocked)])
    assert result["status"] == "FAIL"
    assert "EDITORIAL_DECISION_BLOCKED" in result["errors"]


def test_content_path_must_be_the_path_encoded_by_the_trusted_candidate_url(tmp_path):
    safe = keyword_source("안전검색어")
    mismatched = "kor/column/other/index.html"
    result = run_launch(tmp_path, sources=[safe], proposals=[proposal(
        safe, contentPath=mismatched, filePath=mismatched,
    )])
    assert result["status"] == "FAIL"
    assert "CANDIDATE_IDENTITY_MISMATCH" in result["errors"]


@pytest.mark.parametrize(("base_aliases", "head_aliases"), [
    ([], ["별칭후보"]),
    (["별칭후보"], []),
])
def test_new_html_blocks_unrelated_hold_alias_changes(tmp_path, base_aliases, head_aliases):
    safe = keyword_source("안전검색어")
    base_decisions = [{
        "keyword": "기존보호키워드",
        "decision": "HOLD",
        "reason": "Control Tower decision",
    }]
    if base_aliases:
        base_decisions[0]["holdAliases"] = base_aliases
    head_decisions = [{
        "keyword": "기존보호키워드",
        "decision": "HOLD",
        "reason": "Control Tower decision",
    }]
    if head_aliases:
        head_decisions[0]["holdAliases"] = head_aliases

    result = run_launch(
        tmp_path,
        sources=[safe],
        proposals=[proposal(safe)],
        decision_rows=base_decisions,
        head_changes={"data/content-launch-decisions.json": {
            "schemaVersion": 1,
            "decisions": head_decisions,
        }},
    )

    assert result["status"] == "FAIL"
    assert "EDITORIAL_DECISION_TAMPERING" in result["errors"]


def test_editorial_only_hold_alias_change_remains_reviewable_without_new_html(tmp_path):
    result = run_launch(
        tmp_path,
        decisions={"기존보호키워드": "HOLD"},
        head_changes={"data/content-launch-decisions.json": {
            "schemaVersion": 1,
            "decisions": [{
                "keyword": "기존보호키워드",
                "decision": "HOLD",
                "holdAliases": ["별칭후보"],
            }],
        }},
    )
    assert result == {"status": "PASS", "errors": []}
