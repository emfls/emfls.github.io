import json
import subprocess
from pathlib import Path

from scripts.content_launch_guard import (
    APPROVED_JP_TRAVEL_CANARY_DELETIONS,
    APPROVED_MONETIZATION_TRANSITIONS,
    _git_changes,
    validate_launch,
)

C33_MAPLE_PATH = "kor/column/maple-planet-no-capital-rice-farming-2026.html"
C33_MAPLE_BASE_BLOB = "fd73fdd0be12fab17f9ab78473c0182956d34098"
C33_MAPLE_REPAIRED_BLOB = "873ab21ba21523a22e83cffaf61e1dab3e4ec5d3"


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def setup_data(root):
    write_json(root / "data/experiments.json", {"experiments": [{"url": "/kor/report/camp/nonsan.html", "status": "OBSERVING"}]})
    write_json(root / "data/revenue-opportunities.json", {"protectedWinners": [
        {"url": "/kor/report/camp/namyangju.html"},
        {"url": "/kor/report/camp/pyeongtaek.html"},
        {"url": "/jp/report/travel/winner.html"},
        {"url": "/ae/util/"},
        {"url": "/ae/util/dice3d/"},
        {"url": "/ae/util/text-cleaner/"},
        {"url": "/ae/util/text-shuffle-sort/"},
    ]})
    write_json(root / "data/site-audit.json", {"pages": []})


def manifest(urls):
    return {"urls": urls, "contentPaths": [u.lstrip("/") for u in urls], "sitemapPaths": ["kor/report/camp/sitemap.xml"], "hubPaths": ["kor/report/camp/index.html"]}


def write_arabic_retirement_override(root):
    write_json(root / "data/locale-retirement-overrides.json", {
        "schemaVersion": 1,
        "locale": "ae",
        "decision": "RETIRED",
        "status": "USER_APPROVED_LOCALE_RETIREMENT_OVERRIDE",
        "approved": True,
        "approvedAt": "2026-10-04",
        "reason": "User-approved Arabic locale retirement; historical value is de minimis relative to site-wide simplification.",
        "preserveRawMeasurements": True,
        "evidence": {
            "ga4": {
                "period": "2026-09-05..2026-10-02",
                "views": 13,
                "users": 12,
                "engagementSeconds": 256,
                "totalAdRevenue": 0.015871,
            },
            "gsc": {"status": "NO_ROW"},
        },
        "urls": [
            "/ae/util/",
            "/ae/util/dice3d/",
            "/ae/util/text-cleaner/",
            "/ae/util/text-shuffle-sort/",
        ],
    })


def test_guard_allows_more_than_three_pages_but_rejects_deletion(tmp_path):
    setup_data(tmp_path)
    changed = [("A", f"kor/report/camp/n-{i}.html") for i in range(4)]
    errors = validate_launch(tmp_path, manifest([f"/kor/report/camp/n-{i}.html" for i in range(4)]), changed)
    assert "NEW_CONTENT_DAILY_LIMIT_EXCEEDED" not in errors
    assert "DELETION_NOT_ALLOWED" in validate_launch(tmp_path, {**manifest([]), "deletions": ["old.html"]}, [("D", "old.html")])


def test_guard_allows_authorized_arabic_retirement_only(tmp_path):
    setup_data(tmp_path)
    assert "DELETION_NOT_ALLOWED" in validate_launch(
        tmp_path,
        manifest([]),
        [("D", "ae/util/dice3d/index.html")],
    )
    write_arabic_retirement_override(tmp_path)

    approved = [
        ("D", "ae/util/index.html"),
        ("D", "ae/util/dice3d/index.html"),
        ("D", "ae/util/text-cleaner/index.html"),
        ("D", "ae/util/text-shuffle-sort/index.html"),
    ]
    assert validate_launch(tmp_path, manifest([]), approved) == []
    for path in ("ae/util/unapproved/index.html", "jp/report/travel/unapproved.html"):
        assert "DELETION_NOT_ALLOWED" in validate_launch(tmp_path, manifest([]), [("D", path)])


def test_protected_winner_deletion_requires_explicit_arabic_retirement_override(tmp_path):
    setup_data(tmp_path)

    errors = validate_launch(tmp_path, manifest([]), [("D", "kor/report/camp/namyangju.html")])

    assert "DELETION_NOT_ALLOWED" in errors
    assert "PROTECTED_WINNER_CHANGED" in errors


def test_override_cannot_authorize_other_locale_protected_winner(tmp_path):
    setup_data(tmp_path)
    write_arabic_retirement_override(tmp_path)

    errors = validate_launch(tmp_path, manifest([]), [("D", "jp/report/travel/winner.html")])

    assert "DELETION_NOT_ALLOWED" in errors
    assert "PROTECTED_WINNER_CHANGED" in errors


def test_raw_ga4_or_gsc_history_deletion_is_always_rejected(tmp_path):
    setup_data(tmp_path)
    write_arabic_retirement_override(tmp_path)

    for path in (
        "data/performance/ga4-latest.json",
        "data/performance/gsc-latest.json",
        "data/performance/2026-08-01.json",
    ):
        errors = validate_launch(tmp_path, manifest([]), [("D", path)])

        assert "RAW_MEASUREMENT_HISTORY_DELETION_NOT_ALLOWED" in errors
        assert "DELETION_NOT_ALLOWED" in errors


def test_guard_allows_only_exact_jp_travel_canary_deletions(tmp_path):
    setup_data(tmp_path)
    assert len(APPROVED_JP_TRAVEL_CANARY_DELETIONS) == 99
    assert "jp/report/travel/malaysia-kuala-terengganu.html" not in APPROVED_JP_TRAVEL_CANARY_DELETIONS

    allowed = [("D", path) for path in sorted(APPROVED_JP_TRAVEL_CANARY_DELETIONS)]
    assert validate_launch(tmp_path, manifest([]), allowed) == []

    for path in (
        "jp/report/travel/malaysia-kuala-terengganu.html",
        "jp/report/travel/unreviewed.html",
        "kor/report/travel/unreviewed.html",
    ):
        assert "DELETION_NOT_ALLOWED" in validate_launch(tmp_path, manifest([]), [("D", path)])
    assert "DELETION_NOT_ALLOWED" in validate_launch(
        tmp_path,
        manifest([]),
        [("R100", "jp/report/travel/bangladesh-satkhira.html")],
    )


def test_guard_allows_the_exact_jp_travel_batch_02_deletions(tmp_path):
    setup_data(tmp_path)
    batch_02 = {
        "jp/report/travel/belgium-arden.html",
        "jp/report/travel/belgium-namur.html",
        "jp/report/travel/belgium-sint-truiden.html",
        "jp/report/travel/czech-svitavy.html",
        "jp/report/travel/czech-zlin.html",
        "jp/report/travel/finland-espoo.html",
        "jp/report/travel/finland-tampere.html",
        "jp/report/travel/france-angers.html",
        "jp/report/travel/france-angouleme.html",
        "jp/report/travel/france-annecy.html",
        "jp/report/travel/france-antibes.html",
        "jp/report/travel/france-argenteuil.html",
        "jp/report/travel/france-avignon.html",
        "jp/report/travel/france-bayonne.html",
        "jp/report/travel/france-bordeaux.html",
        "jp/report/travel/france-bourges.html",
        "jp/report/travel/france-brest.html",
        "jp/report/travel/france-calais.html",
        "jp/report/travel/france-charleville-mezieres.html",
        "jp/report/travel/france-clermont-ferrand.html",
        "jp/report/travel/france-dijon.html",
        "jp/report/travel/france-evianlesbains.html",
        "jp/report/travel/france-lehavre.html",
        "jp/report/travel/france-limoges.html",
        "jp/report/travel/france-lyon.html",
        "jp/report/travel/france-marseille.html",
        "jp/report/travel/france-menton.html",
        "jp/report/travel/france-mont-saint-michel.html",
        "jp/report/travel/france-montpellier.html",
        "jp/report/travel/france-montreuil.html",
        "jp/report/travel/france-mulhouse.html",
        "jp/report/travel/france-nantes.html",
        "jp/report/travel/france-nimes.html",
        "jp/report/travel/france-niort.html",
        "jp/report/travel/france-orleans.html",
        "jp/report/travel/france-paris.html",
        "jp/report/travel/france-perpignan.html",
        "jp/report/travel/france-poitiers.html",
        "jp/report/travel/france-rennes.html",
        "jp/report/travel/france-rouen.html",
        "jp/report/travel/france-saint-etienne.html",
        "jp/report/travel/france-sete.html",
        "jp/report/travel/france-strasbourg.html",
        "jp/report/travel/france-toulon.html",
        "jp/report/travel/france-toulouse.html",
        "jp/report/travel/france-valenciennes.html",
        "jp/report/travel/france-versailles.html",
        "jp/report/travel/italy-perugia.html",
        "jp/report/travel/norway-drobak.html",
        "jp/report/travel/poland-poznan.html",
    }
    assert len(batch_02) == 50

    assert validate_launch(tmp_path, manifest([]), [("D", path) for path in sorted(batch_02)]) == []


def test_guard_rejects_protected_pages_and_monetization_code(tmp_path):
    setup_data(tmp_path)
    changed = [("M", "kor/report/camp/nonsan.html"), ("M", "kor/report/camp/namyangju.html"), ("M", "assets/js/ga4.js")]
    errors = validate_launch(tmp_path, manifest([]), changed)
    assert {"PROTECTED_EXPERIMENT_CHANGED", "PROTECTED_WINNER_CHANGED", "MONETIZATION_OR_ANALYTICS_CHANGED"} <= set(errors)


def test_guard_allows_only_approved_pyeongtaek_blob_transition(tmp_path):
    setup_data(tmp_path)
    changed = [("M", "kor/report/camp/pyeongtaek.html", "4d95593169e466447ee355429d2822764ca7e1a5", "b4fc13119f1e8cd01d78805d06ee981ac6834236")]

    assert validate_launch(tmp_path, manifest([]), changed) == []


def test_guard_allows_only_exact_c33_maple_integrity_transition(tmp_path):
    setup_data(tmp_path)
    revenue_path = tmp_path / "data/revenue-opportunities.json"
    revenue = json.loads(revenue_path.read_text(encoding="utf-8"))
    revenue["protectedWinners"].append({"url": f"/{C33_MAPLE_PATH}"})
    write_json(revenue_path, revenue)

    exact_transition = [("M", C33_MAPLE_PATH, C33_MAPLE_BASE_BLOB, C33_MAPLE_REPAIRED_BLOB)]
    assert validate_launch(tmp_path, manifest([]), exact_transition) == []
    assert "PROTECTED_WINNER_CHANGED" in validate_launch(
        tmp_path,
        manifest([]),
        [("M", C33_MAPLE_PATH, C33_MAPLE_BASE_BLOB, "a" * 40)],
    )
    assert "PROTECTED_WINNER_CHANGED" in validate_launch(
        tmp_path,
        manifest([]),
        [("M", C33_MAPLE_PATH, "b" * 40, C33_MAPLE_REPAIRED_BLOB)],
    )
    assert "PROTECTED_WINNER_CHANGED" in validate_launch(
        tmp_path,
        manifest([]),
        [("M", "kor/report/camp/namyangju.html", C33_MAPLE_BASE_BLOB, C33_MAPLE_REPAIRED_BLOB)],
    )


def test_guard_rejects_pyeongtaek_with_different_result_blob(tmp_path):
    setup_data(tmp_path)
    changed = [("M", "kor/report/camp/pyeongtaek.html", "4d95593169e466447ee355429d2822764ca7e1a5", "a" * 40)]

    assert "PROTECTED_WINNER_CHANGED" in validate_launch(tmp_path, manifest([]), changed)


def test_guard_rejects_pyeongtaek_with_different_base_blob(tmp_path):
    setup_data(tmp_path)
    changed = [("M", "kor/report/camp/pyeongtaek.html", "b" * 40, "b4fc13119f1e8cd01d78805d06ee981ac6834236")]

    assert "PROTECTED_WINNER_CHANGED" in validate_launch(tmp_path, manifest([]), changed)


def test_guard_rejects_other_protected_winner_and_missing_blob_proof(tmp_path):
    setup_data(tmp_path)
    other_winner = [("M", "kor/report/camp/namyangju.html", "4d95593169e466447ee355429d2822764ca7e1a5", "b4fc13119f1e8cd01d78805d06ee981ac6834236")]
    unproven_pyeongtaek = [("M", "kor/report/camp/pyeongtaek.html")]

    assert "PROTECTED_WINNER_CHANGED" in validate_launch(tmp_path, manifest([]), other_winner)
    assert "PROTECTED_WINNER_CHANGED" in validate_launch(tmp_path, manifest([]), unproven_pyeongtaek)


def test_guard_allows_only_ga4_collection_orchestration_workflow(tmp_path):
    setup_data(tmp_path)

    assert validate_launch(
        tmp_path,
        manifest([]),
        [("M", ".github/workflows/ga4-collection.yml")],
    ) == []
    assert "MONETIZATION_OR_ANALYTICS_CHANGED" in validate_launch(
        tmp_path,
        manifest([]),
        [("M", ".github/workflows/ga4-collection.yaml")],
    )


def test_guard_allows_only_control_tower_approved_adsense_initial_additions(tmp_path):
    setup_data(tmp_path)
    approved_additions = [
        ("A", ".github/workflows/adsense-collection.yml"),
        ("A", "scripts/collect_adsense_snapshot.py"),
    ]

    assert validate_launch(tmp_path, manifest([]), approved_additions) == []


def test_guard_allows_only_exact_adsense_documentation_additions(tmp_path):
    setup_data(tmp_path)
    approved_docs = [
        ("A", "docs/analytics/adsense-storage-retention.md"),
        ("A", "docs/superpowers/plans/2026-10-06-adsense-daily-observability.md"),
        ("A", "docs/superpowers/plans/2026-10-07-adsense-storage-safe-finalization.md"),
        ("A", "docs/superpowers/plans/2026-10-07-adsense-page-url-probe.md"),
    ]

    assert validate_launch(tmp_path, manifest([]), approved_docs) == []
    assert "MONETIZATION_OR_ANALYTICS_CHANGED" in validate_launch(
        tmp_path, manifest([]), [(*approved_docs[0][:1], "docs/analytics/adsense-unreviewed.md")]
    )


def test_guard_reblocks_future_adsense_modifications_unknown_additions_and_html_ads(tmp_path):
    setup_data(tmp_path)
    for path in (
        ".github/workflows/adsense-collection.yml",
        "scripts/collect_adsense_snapshot.py",
    ):
        assert "MONETIZATION_OR_ANALYTICS_CHANGED" in validate_launch(
            tmp_path, manifest([]), [("M", path)]
        )

    for path in (
        ".github/workflows/adsense-unreviewed.yml",
        "scripts/adsense_unreviewed_collector.py",
    ):
        assert "MONETIZATION_OR_ANALYTICS_CHANGED" in validate_launch(
            tmp_path, manifest([]), [("A", path)]
        )

    assert "MONETIZATION_OR_ANALYTICS_CHANGED" in validate_launch(
        tmp_path, manifest([]), [("M", "assets/js/ad-loader.js")]
    )
    assert "MONETIZATION_OR_ANALYTICS_CHANGED" in validate_launch(
        tmp_path, manifest([]), [("M", "kor/report/ad-placement.html")]
    )
    assert "PROTECTED_WINNER_CHANGED" in validate_launch(
        tmp_path, manifest([]), [("M", "kor/report/camp/namyangju.html")]
    )


def test_guard_allows_only_the_exact_adsense_collector_diagnostic_transition(tmp_path):
    setup_data(tmp_path)
    path = "scripts/collect_adsense_snapshot.py"
    approved = APPROVED_MONETIZATION_TRANSITIONS[path]
    diagnostic_transition = (
        "94f34228ed8b10213085b3de19bbab14e4fee0de",
        "83595861b3ea484b7fd9ad0c7fb11515f6516692",
    )
    assert diagnostic_transition in approved
    before_blob, after_blob = diagnostic_transition
    assert len(after_blob) == 40

    assert validate_launch(tmp_path, manifest([]), [("M", path, before_blob, after_blob)]) == []
    assert "MONETIZATION_OR_ANALYTICS_CHANGED" in validate_launch(
        tmp_path, manifest([]), [("M", path, "0" * 40, after_blob)]
    )
    assert "MONETIZATION_OR_ANALYTICS_CHANGED" in validate_launch(
        tmp_path, manifest([]), [("M", path, before_blob, "f" * 40)]
    )
    assert "MONETIZATION_OR_ANALYTICS_CHANGED" in validate_launch(
        tmp_path, manifest([]), [("M", path)]
    )


def test_guard_allows_only_the_exact_stage_aware_empty_rows_collector_transition(tmp_path):
    setup_data(tmp_path)
    path = "scripts/collect_adsense_snapshot.py"
    current_blob = subprocess.run(
        ["git", "hash-object", path], cwd=Path(__file__).resolve().parents[1],
        text=True, capture_output=True, check=True,
    ).stdout.strip()
    approved = APPROVED_MONETIZATION_TRANSITIONS[path]
    historical_transition = ("7e462d5e1ccedfba022594d98cabf4aa3697ca01", "085f253a3ba6c98b3318a99d7a03b63c1398f761")
    transition = ("085f253a3ba6c98b3318a99d7a03b63c1398f761", current_blob)
    base_to_final_transition = ("7e462d5e1ccedfba022594d98cabf4aa3697ca01", current_blob)

    assert historical_transition in approved
    assert transition in approved
    assert base_to_final_transition in approved
    assert approved == {
        ("94f34228ed8b10213085b3de19bbab14e4fee0de", "83595861b3ea484b7fd9ad0c7fb11515f6516692"),
        ("83595861b3ea484b7fd9ad0c7fb11515f6516692", "2f4890e73ae705c5347b3755c5fb4ef47ca23e2b"),
        ("2f4890e73ae705c5347b3755c5fb4ef47ca23e2b", "7e462d5e1ccedfba022594d98cabf4aa3697ca01"),
        historical_transition,
        ("085f253a3ba6c98b3318a99d7a03b63c1398f761", "114d91de1a6e22103f7c697c7df229fa2ac1a0ad"),
        ("7e462d5e1ccedfba022594d98cabf4aa3697ca01", "114d91de1a6e22103f7c697c7df229fa2ac1a0ad"),
        ("085f253a3ba6c98b3318a99d7a03b63c1398f761", "d387a34a2fd020b3f64e3ee6fe9e90c744d1fb3f"),
        ("114d91de1a6e22103f7c697c7df229fa2ac1a0ad", "d387a34a2fd020b3f64e3ee6fe9e90c744d1fb3f"),
        ("7e462d5e1ccedfba022594d98cabf4aa3697ca01", "d387a34a2fd020b3f64e3ee6fe9e90c744d1fb3f"),
        transition,
        base_to_final_transition,
        ("114d91de1a6e22103f7c697c7df229fa2ac1a0ad", current_blob),
        ("7e462d5e1ccedfba022594d98cabf4aa3697ca01", current_blob),
    }
    assert validate_launch(tmp_path, manifest([]), [("M", path, *historical_transition)]) == []
    assert validate_launch(tmp_path, manifest([]), [("M", path, *transition)]) == []
    assert validate_launch(tmp_path, manifest([]), [("M", path, *base_to_final_transition)]) == []
    assert "MONETIZATION_OR_ANALYTICS_CHANGED" in validate_launch(
        tmp_path, manifest([]), [("M", path, "0" * 40, current_blob)]
    )
    assert "MONETIZATION_OR_ANALYTICS_CHANGED" in validate_launch(
        tmp_path, manifest([]), [("M", path, transition[0], "f" * 40)]
    )
    assert "MONETIZATION_OR_ANALYTICS_CHANGED" in validate_launch(
        tmp_path, manifest([]), [("M", path, transition[0], "a" * 40)]
    )
    assert "MONETIZATION_OR_ANALYTICS_CHANGED" in validate_launch(
        tmp_path, manifest([]), [("M", ".github/workflows/adsense-collection.yml")]
    )


def test_guard_allows_only_the_exact_adsense_workflow_breakdown_transition(tmp_path):
    setup_data(tmp_path)
    path = ".github/workflows/adsense-collection.yml"
    current_blob = subprocess.run(
        ["git", "hash-object", path], cwd=Path(__file__).resolve().parents[1],
        text=True, capture_output=True, check=True,
    ).stdout.strip()
    transition = ("90f64a3d00d901f9052fc1fe20fc86372c90e014", current_blob)

    historical_transition = ("90f64a3d00d901f9052fc1fe20fc86372c90e014", "893889ceac2620250a6752d93aeb66c2a131b136")
    prior_transition = ("90f64a3d00d901f9052fc1fe20fc86372c90e014", "791cae6496af09dd8ad32e4893e25736e5e02157")
    assert APPROVED_MONETIZATION_TRANSITIONS[path] == {historical_transition, prior_transition, transition}
    assert validate_launch(tmp_path, manifest([]), [("M", path, *transition)]) == []
    assert "MONETIZATION_OR_ANALYTICS_CHANGED" in validate_launch(
        tmp_path, manifest([]), [("M", path, transition[0], "f" * 40)]
    )


def test_git_changes_captures_blobs_for_the_approved_adsense_collector_transition(monkeypatch, tmp_path):
    path = "scripts/collect_adsense_snapshot.py"
    before_blob, after_blob = (
        "94f34228ed8b10213085b3de19bbab14e4fee0de",
        "83595861b3ea484b7fd9ad0c7fb11515f6516692",
    )
    calls = []

    def fake_run(command, **kwargs):
        calls.append(command)
        if command[:3] == ["git", "diff", "--name-status"]:
            return type("Result", (), {"stdout": f"M\t{path}\n"})()
        if command == ["git", "rev-parse", f"base-sha:{path}"]:
            return type("Result", (), {"stdout": before_blob + "\n"})()
        if command == ["git", "rev-parse", f"HEAD:{path}"]:
            return type("Result", (), {"stdout": after_blob + "\n"})()
        raise AssertionError(f"unexpected git invocation: {command}")

    monkeypatch.setattr("scripts.content_launch_guard.subprocess.run", fake_run)

    assert _git_changes(tmp_path, "base-sha") == [("M", path, before_blob, after_blob)]
    assert len(calls) == 3


def test_git_changes_captures_the_blob_for_the_exact_initial_diagnostics_addition(monkeypatch, tmp_path):
    path = "data/performance/adsense-diagnostics-latest.json"
    expected_blob = "6649da69660e608f2b47a48cc46b72e8023ba2af"
    calls = []

    def fake_run(command, **kwargs):
        calls.append(command)
        if command[:3] == ["git", "diff", "--name-status"]:
            return type("Result", (), {"stdout": f"A\t{path}\n"})()
        if command == ["git", "rev-parse", f"HEAD:{path}"]:
            return type("Result", (), {"stdout": expected_blob + "\n"})()
        raise AssertionError(f"unexpected git invocation: {command}")

    monkeypatch.setattr("scripts.content_launch_guard.subprocess.run", fake_run)

    assert _git_changes(tmp_path, "base-sha") == [("A", path, None, expected_blob)]
    assert len(calls) == 2


def test_guard_continues_blocking_ads_runtime_assets(tmp_path):
    setup_data(tmp_path)

    errors = validate_launch(
        tmp_path,
        manifest([]),
        [("M", "assets/js/adsense.js"), ("M", "assets/js/ad-loader.js")],
    )

    assert "MONETIZATION_OR_ANALYTICS_CHANGED" in errors


def test_guard_allows_bounded_tool_completion_allowlist_for_new_tool(tmp_path):
    setup_data(tmp_path)
    assert validate_launch(
        tmp_path,
        manifest([]),
        [("M", "kor/util/tool-analytics.js")],
    ) == []


def test_new_page_requires_canonical_sitemap_hub_and_viewport(tmp_path):
    setup_data(tmp_path)
    page = tmp_path / "kor/report/camp/new.html"
    page.parent.mkdir(parents=True)
    page.write_text('<html><head><title>New</title><link rel="canonical" href="https://emfls.github.io/wrong.html"></head><body><h1>New</h1></body></html>')
    (tmp_path / "kor/report/camp/sitemap.xml").write_text("<urlset></urlset>")
    (tmp_path / "kor/report/camp/index.html").write_text("<html></html>")
    errors = validate_launch(tmp_path, manifest(["/kor/report/camp/new.html"]), [("A", "kor/report/camp/new.html")])
    assert {"CANONICAL_MISMATCH", "SITEMAP_ENTRY_MISSING", "HUB_LINK_MISSING", "VIEWPORT_MISSING"} <= set(errors)


def test_no_publication_manifest_passes_without_html_changes(tmp_path):
    setup_data(tmp_path)
    assert validate_launch(tmp_path, manifest([]), [("M", "reports/daily-revenue-growth.md")]) == []


def test_prior_published_manifest_does_not_block_unrelated_followup_commit(tmp_path):
    setup_data(tmp_path)
    prior_manifest = manifest(["/kor/util/already-published/index.html"])

    assert validate_launch(
        tmp_path,
        prior_manifest,
        [("M", "scripts/daily_revenue_growth.py"), ("M", "tests/test_daily_revenue_growth.py")],
    ) == []


def test_manifest_only_counter_reset_does_not_require_new_html_diff(tmp_path):
    setup_data(tmp_path)
    prior_manifest = manifest(["/kor/util/already-published/index.html"])

    assert validate_launch(
        tmp_path,
        prior_manifest,
        [
            ("M", "data/content-launch-manifest.json"),
            ("A", "data/content-launch-counter.json"),
        ],
    ) == []


def test_regenerated_audit_does_not_treat_manifest_page_as_existing_duplicate(tmp_path):
    setup_data(tmp_path)
    url = "/kor/report/camp/new.html"
    relative = "kor/report/camp/new.html"
    page = tmp_path / relative
    page.parent.mkdir(parents=True)
    page.write_text(
        '<html><head><meta name="viewport" content="width=device-width">'
        '<title>새 독립 제목</title><link rel="canonical" '
        f'href="https://emfls.github.io{url}"><script type="application/ld+json">{{}}</script>'
        '</head><body><h1>새 독립 제목</h1></body></html>',
        encoding="utf-8",
    )
    (tmp_path / "kor/report/camp/sitemap.xml").write_text(
        f"<urlset><loc>https://emfls.github.io{url}</loc></urlset>", encoding="utf-8"
    )
    (tmp_path / "kor/report/camp/index.html").write_text(
        f'<a href="{url}">새 페이지</a>', encoding="utf-8"
    )
    write_json(
        tmp_path / "data/site-audit.json",
        {"pages": [{"path": relative, "url": url, "title": "새 독립 제목", "h1": "새 독립 제목"}]},
    )

    assert validate_launch(tmp_path, manifest([url]), [("A", relative)]) == []


def test_git_changes_ignore_ci_generated_worktree_files(monkeypatch, tmp_path):
    captured = {}

    def fake_run(command, **kwargs):
        captured["command"] = command
        return type("Result", (), {"stdout": "A\tkor/report/camp/new.html\n"})()

    monkeypatch.setattr("scripts.content_launch_guard.subprocess.run", fake_run)
    assert _git_changes(tmp_path, "base-sha") == [("A", "kor/report/camp/new.html")]
    assert captured["command"] == ["git", "diff", "--name-status", "base-sha", "HEAD"]
