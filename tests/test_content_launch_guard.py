import ast
import json
import subprocess
from pathlib import Path

from scripts.content_launch_guard import (
    APPROVED_TASK11_FOLLOWUP_PROTECTED_TRANSITIONS,
    APPROVED_TASK11_PROTECTED_TRANSITIONS,
    APPROVED_JP_TRAVEL_CANARY_DELETIONS,
    APPROVED_PROTECTED_WINNER_TRANSITIONS,
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
    write_json(root / "data/content-launch-decisions.json", {"schemaVersion": 1, "decisions": [
        {"keyword": "인건비계산기", "decision": "HOLD", "reason": "Control Tower HOLD"},
        {"keyword": "엔카중고차구매", "decision": "NO_NEW_PAGE", "reason": "Control Tower NO_NEW_PAGE"},
    ]})


def manifest(urls):
    return {"urls": urls, "contentPaths": [u.lstrip("/") for u in urls], "candidateIds": [f"keyword:guard-fixture-{i}" for i, _ in enumerate(urls)], "sitemapPaths": ["kor/report/camp/sitemap.xml"], "hubPaths": ["kor/report/camp/index.html"]}


def launch_manifest(url, relative, candidate_ids=None):
    return {"urls": [url], "contentPaths": [relative], "candidateIds": candidate_ids or [], "sitemapPaths": [], "hubPaths": []}


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


def test_official_camp_fact_corrections_allow_only_exact_documented_blob_pairs(tmp_path):
    setup_data(tmp_path)
    experiments_path = tmp_path / "data/experiments.json"
    experiments = json.loads(experiments_path.read_text(encoding="utf-8"))
    # The real nonsan experiment is INCONCLUSIVE; keep the synthetic OBSERVING fixture
    # intact in the separate test that verifies active experiments remain protected.
    experiments["experiments"][0]["status"] = "INCONCLUSIVE"
    write_json(experiments_path, experiments)
    revenue_path = tmp_path / "data/revenue-opportunities.json"
    revenue = json.loads(revenue_path.read_text(encoding="utf-8"))
    paths = (
        "kor/report/camp/ansan.html",
        "kor/report/camp/cheorwon.html",
        "kor/report/camp/pyeongtaek.html",
        "kor/report/camp/gyeonggi-best.html",
        "kor/report/camp/siheung.html",
        "kor/report/camp/suwon.html",
        "kor/report/camp/jinju.html",
        "kor/report/camp/nonsan.html",
        "kor/report/camp/goyang.html",
        "kor/report/camp/free-camping-top20.html",
        "kor/report/camp/sejong.html",
        "kor/report/camp/paju.html",
        "kor/report/camp/boryeong.html",
        "kor/report/camp/iksan.html",
        "kor/report/camp/daebudo-camping.html",
        "kor/report/camp/sokcho.html",
        "kor/report/camp/buyeo.html",
        "kor/report/camp/gumi.html",
    )
    revenue["protectedWinners"].extend({"url": f"/{path}"} for path in paths)
    write_json(revenue_path, revenue)

    for path in paths:
        transition = next(iter(APPROVED_PROTECTED_WINNER_TRANSITIONS[path]))
        assert validate_launch(tmp_path, manifest([]), [("M", path, *transition)]) == []
        assert "PROTECTED_WINNER_CHANGED" in validate_launch(
            tmp_path, manifest([]), [("M", path, transition[0], "f" * 40)]
        )



def test_guard_allows_only_user_approved_gumi_hub_reciprocal_link(tmp_path):
    setup_data(tmp_path)
    revenue_path = tmp_path / "data/revenue-opportunities.json"
    revenue = json.loads(revenue_path.read_text(encoding="utf-8"))
    revenue["protectedWinners"].append({"url": "/kor/report/camp/gumi.html"})
    write_json(revenue_path, revenue)

    before = "ac2d288245094d8fb884f91f3eac1d1c87b6874a"
    after = "3230bfbc1366512bf868eddb3b9809d6afdf00bf"
    path = "kor/report/camp/gumi.html"
    assert (before, after) in APPROVED_PROTECTED_WINNER_TRANSITIONS[path]
    assert validate_launch(tmp_path, manifest([]), [("M", path, before, after)]) == []
    assert "PROTECTED_WINNER_CHANGED" in validate_launch(
        tmp_path, manifest([]), [("M", path, before, "f" * 40)]
    )
    assert "PROTECTED_WINNER_CHANGED" in validate_launch(
        tmp_path, manifest([]), [("M", path, "b" * 40, after)]
    )


def test_guard_allows_only_user_approved_top10_claim_transitions(tmp_path):
    setup_data(tmp_path)
    revenue_path = tmp_path / "data/revenue-opportunities.json"
    revenue = json.loads(revenue_path.read_text(encoding="utf-8"))
    paths = [
        "kor/report/camp/jeongeup.html",
        "kor/report/camp/naju.html",
        "kor/report/camp/jeongseon.html",
        "kor/report/camp/gimhae.html",
        "kor/report/camp/imsil.html",
        "kor/report/camp/hanam.html",
        "kor/report/camp/mungyeong.html",
        "kor/report/camp/yeongju.html",
        "kor/report/camp/danyang.html",
        "kor/report/camp/gunsan.html",
    ]
    revenue["protectedWinners"].extend({"url": f"/{path}"} for path in paths)
    write_json(revenue_path, revenue)

    for path in paths:
        before, after = next(iter(APPROVED_PROTECTED_WINNER_TRANSITIONS[path]))
        assert validate_launch(tmp_path, manifest([]), [("M", path, before, after)]) == []
        assert "PROTECTED_WINNER_CHANGED" in validate_launch(
            tmp_path, manifest([]), [("M", path, before, "f" * 40)]
        )
        assert "PROTECTED_WINNER_CHANGED" in validate_launch(
            tmp_path, manifest([]), [("M", path, "b" * 40, after)]
        )


def test_guard_allows_only_exact_11th_camp_fact_transitions(tmp_path):
    setup_data(tmp_path)
    revenue_path = tmp_path / "data/revenue-opportunities.json"
    revenue = json.loads(revenue_path.read_text(encoding="utf-8"))
    paths = list(APPROVED_TASK11_PROTECTED_TRANSITIONS)
    revenue["protectedWinners"].extend({"url": f"/{path}"} for path in paths)
    write_json(revenue_path, revenue)

    assert len(paths) == 5
    for path in paths:
        before, after = APPROVED_TASK11_PROTECTED_TRANSITIONS[path]
        assert (before, after) in APPROVED_PROTECTED_WINNER_TRANSITIONS[path]
        assert validate_launch(tmp_path, manifest([]), [("M", path, before, after)]) == []
        assert "PROTECTED_WINNER_CHANGED" in validate_launch(
            tmp_path, manifest([]), [("M", path, before, "f" * 40)]
        )
        assert "PROTECTED_WINNER_CHANGED" in validate_launch(
            tmp_path, manifest([]), [("M", path, "b" * 40, after)]
        )


def test_guard_allows_only_exact_12th_camp_fact_transitions(tmp_path):
    from scripts.content_launch_guard import APPROVED_TASK12_PROTECTED_TRANSITIONS

    setup_data(tmp_path)
    revenue_path = tmp_path / "data/revenue-opportunities.json"
    revenue = json.loads(revenue_path.read_text(encoding="utf-8"))
    paths = list(APPROVED_TASK12_PROTECTED_TRANSITIONS)
    revenue["protectedWinners"].extend({"url": f"/{path}"} for path in paths)
    write_json(revenue_path, revenue)

    assert len(paths) == 5
    for path in paths:
        before, after = APPROVED_TASK12_PROTECTED_TRANSITIONS[path]
        assert (before, after) in APPROVED_PROTECTED_WINNER_TRANSITIONS[path]
        assert validate_launch(tmp_path, manifest([]), [("M", path, before, after)]) == []
        assert "PROTECTED_WINNER_CHANGED" in validate_launch(
            tmp_path, manifest([]), [("M", path, before, "f" * 40)]
        )
        assert "PROTECTED_WINNER_CHANGED" in validate_launch(
            tmp_path, manifest([]), [("M", path, "b" * 40, after)]
        )


def test_guard_allows_only_exact_13th_camp_fact_transitions(tmp_path):
    from scripts.content_launch_guard import APPROVED_TASK13_PROTECTED_TRANSITIONS

    setup_data(tmp_path)
    revenue_path = tmp_path / "data/revenue-opportunities.json"
    revenue = json.loads(revenue_path.read_text(encoding="utf-8"))
    paths = list(APPROVED_TASK13_PROTECTED_TRANSITIONS)
    revenue["protectedWinners"].extend({"url": f"/{path}"} for path in paths)
    write_json(revenue_path, revenue)

    assert paths == [
        "kor/report/camp/buan.html",
        "kor/report/camp/mokpo.html",
        "kor/report/camp/dangjin.html",
        "kor/report/camp/jeungpyeong.html",
        "kor/report/camp/namyangju.html",
    ]
    for path in paths:
        before, after = APPROVED_TASK13_PROTECTED_TRANSITIONS[path]
        assert (before, after) in APPROVED_PROTECTED_WINNER_TRANSITIONS[path]
        assert validate_launch(tmp_path, manifest([]), [("M", path, before, after)]) == []
        assert "PROTECTED_WINNER_CHANGED" in validate_launch(
            tmp_path, manifest([]), [("M", path, before, "f" * 40)]
        )
        assert "PROTECTED_WINNER_CHANGED" in validate_launch(
            tmp_path, manifest([]), [("M", path, "b" * 40, after)]
        )


def test_guard_allows_only_exact_14th_camp_fact_transitions(tmp_path):
    from scripts.content_launch_guard import APPROVED_TASK14_PROTECTED_TRANSITIONS

    setup_data(tmp_path)
    revenue_path = tmp_path / "data/revenue-opportunities.json"
    revenue = json.loads(revenue_path.read_text(encoding="utf-8"))
    paths = list(APPROVED_TASK14_PROTECTED_TRANSITIONS)
    revenue["protectedWinners"].extend({"url": f"/{path}"} for path in paths)
    write_json(revenue_path, revenue)

    assert paths == [
        "kor/report/camp/hadong.html",
        "kor/report/camp/sejong.html",
        "kor/report/camp/buyeo.html",
        "kor/report/camp/boryeong.html",
        "kor/report/camp/seocheon.html",
    ]
    for path in paths:
        before, after = APPROVED_TASK14_PROTECTED_TRANSITIONS[path]
        assert (before, after) in APPROVED_PROTECTED_WINNER_TRANSITIONS[path]
        assert validate_launch(tmp_path, manifest([]), [("M", path, before, after)]) == []
        assert "PROTECTED_WINNER_CHANGED" in validate_launch(
            tmp_path, manifest([]), [("M", path, before, "f" * 40)]
        )


def test_guard_allows_only_exact_15th_camp_fact_transitions(tmp_path):
    from scripts.content_launch_guard import APPROVED_TASK15_PROTECTED_TRANSITIONS

    setup_data(tmp_path)
    revenue_path = tmp_path / "data/revenue-opportunities.json"
    revenue = json.loads(revenue_path.read_text(encoding="utf-8"))
    paths = list(APPROVED_TASK15_PROTECTED_TRANSITIONS)
    blocked_16th_paths = [
        "kor/report/camp/uijeongbu.html",
        "kor/report/camp/seosan.html",
        "kor/report/camp/gochang.html",
        "kor/report/camp/chuncheon.html",
    ]
    revenue["protectedWinners"].extend({"url": f"/{path}"} for path in paths + blocked_16th_paths)
    write_json(revenue_path, revenue)

    assert paths == [
        "kor/report/camp/gumi.html",
        "kor/report/camp/jangseong.html",
        "kor/report/camp/gunpo.html",
        "kor/report/camp/daebudo-camping.html",
        "kor/report/camp/gimpo.html",
        "kor/report/camp/dangjin.html",
    ]
    for path in paths:
        before, after = APPROVED_TASK15_PROTECTED_TRANSITIONS[path]
        assert (before, after) in APPROVED_PROTECTED_WINNER_TRANSITIONS[path]
        assert validate_launch(tmp_path, manifest([]), [("M", path, before, after)]) == []
        assert "PROTECTED_WINNER_CHANGED" in validate_launch(
            tmp_path, manifest([]), [("M", path, before, "f" * 40)]
        )
        assert "PROTECTED_WINNER_CHANGED" in validate_launch(
            tmp_path, manifest([]), [("M", path, "b" * 40, after)]
        )

    for path in blocked_16th_paths:
        assert not APPROVED_PROTECTED_WINNER_TRANSITIONS.get(path)
        assert "PROTECTED_WINNER_CHANGED" in validate_launch(
            tmp_path, manifest([]), [("M", path, "b" * 40, "f" * 40)]
        )


def test_guard_allows_only_exact_11th_jindo_winter_followup(tmp_path):
    setup_data(tmp_path)
    revenue_path = tmp_path / "data/revenue-opportunities.json"
    revenue = json.loads(revenue_path.read_text(encoding="utf-8"))
    path = "kor/report/camp/jindo.html"
    revenue["protectedWinners"].append({"url": f"/{path}"})
    write_json(revenue_path, revenue)

    before, after = APPROVED_TASK11_FOLLOWUP_PROTECTED_TRANSITIONS[path]
    assert (before, after) in APPROVED_PROTECTED_WINNER_TRANSITIONS[path]
    assert validate_launch(tmp_path, manifest([]), [("M", path, before, after)]) == []
    assert "PROTECTED_WINNER_CHANGED" in validate_launch(
        tmp_path, manifest([]), [("M", path, before, "f" * 40)]
    )
    assert "PROTECTED_WINNER_CHANGED" in validate_launch(
        tmp_path, manifest([]), [("M", path, "b" * 40, after)]
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


def test_split_guard_bases_reject_unapproved_protected_winner_change(monkeypatch, tmp_path, capsys):
    import sys

    import pytest
    from scripts import content_launch_guard as guard

    setup_data(tmp_path)
    write_json(tmp_path / "data/content-launch-manifest.json", manifest([]))
    trusted_ref = "9a5ef58d459697642f36d2f494be6c48387ac9b3"
    protected_path = "kor/report/camp/namyangju.html"
    trusted_snapshot = {
        "revision": trusted_ref,
        "json": {
            "data/experiments.json": json.loads((tmp_path / "data/experiments.json").read_text()),
            "data/revenue-opportunities.json": json.loads((tmp_path / "data/revenue-opportunities.json").read_text()),
            "data/site-audit.json": json.loads((tmp_path / "data/site-audit.json").read_text()),
        },
        "csv": {},
    }
    trusted_refs, requested_change_refs, diff_refs = [], [], []

    def load_snapshot(root, revision):
        trusted_refs.append(revision)
        return trusted_snapshot

    def resolve_change_base(root, revision):
        requested_change_refs.append(revision)
        return "resolved-origin-main-commit"

    def diff_from(root, revision):
        diff_refs.append(revision)
        return [("M", protected_path, "0" * 40, "1" * 40)]

    monkeypatch.setattr(guard, "_trusted_base_snapshot", load_snapshot)
    monkeypatch.setattr(guard, "_validated_change_base", resolve_change_base)
    monkeypatch.setattr(guard, "_git_changes", diff_from)
    monkeypatch.setattr(sys, "argv", [
        "content_launch_guard.py", "--root", str(tmp_path),
        "--ops-dir", str(tmp_path), "--manifest", "data/content-launch-manifest.json",
        "--base-ref", trusted_ref, "--change-base-ref", "origin/main",
    ])

    with pytest.raises(SystemExit) as exit_info:
        guard.main()

    assert exit_info.value.code == 1
    assert trusted_refs == [trusted_ref]
    assert requested_change_refs == ["origin/main"]
    assert diff_refs == ["resolved-origin-main-commit"]
    payload = json.loads(capsys.readouterr().out)
    assert payload["status"] == "FAIL"
    assert "PROTECTED_WINNER_CHANGED" in payload["errors"]


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
    transition = ("2f4890e73ae705c5347b3755c5fb4ef47ca23e2b", current_blob)

    assert transition in approved
    assert approved == {
        ("94f34228ed8b10213085b3de19bbab14e4fee0de", "83595861b3ea484b7fd9ad0c7fb11515f6516692"),
        ("83595861b3ea484b7fd9ad0c7fb11515f6516692", "2f4890e73ae705c5347b3755c5fb4ef47ca23e2b"),
        transition,
    }
    assert validate_launch(tmp_path, manifest([]), [("M", path, *transition)]) == []
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

    safe_manifest = launch_manifest(url, relative, ["keyword:글자수계산기"])
    safe_manifest["sitemapPaths"] = ["kor/report/camp/sitemap.xml"]
    safe_manifest["hubPaths"] = ["kor/report/camp/index.html"]
    assert validate_launch(tmp_path, safe_manifest, [("A", relative)]) == []


def test_git_changes_ignore_ci_generated_worktree_files(monkeypatch, tmp_path):
    captured = {}

    def fake_run(command, **kwargs):
        captured["command"] = command
        return type("Result", (), {"stdout": "A\tkor/report/camp/new.html\n"})()

    monkeypatch.setattr("scripts.content_launch_guard.subprocess.run", fake_run)
    assert _git_changes(tmp_path, "base-sha") == [("A", "kor/report/camp/new.html")]
    assert captured["command"] == ["git", "diff", "--name-status", "base-sha", "HEAD"]


def test_final_guard_blocks_hold_and_no_new_page_candidates(tmp_path):
    setup_data(tmp_path)
    candidates = (
        ("인건비계산기", "/kor/util/ingeonbigyesangi/", "kor/util/ingeonbigyesangi/index.html"),
        ("엔카중고차구매", "/kor/column/enkajunggocagumae/", "kor/column/enkajunggocagumae/index.html"),
    )
    for keyword, url, relative in candidates:
        errors = validate_launch(
            tmp_path,
            launch_manifest(url, relative, [f"keyword:{keyword}"]),
            [("A", relative)],
        )
        assert "EDITORIAL_DECISION_BLOCKED" in errors, keyword


def test_final_guard_blocks_known_target_route_when_candidate_id_is_missing(tmp_path):
    setup_data(tmp_path)
    url = "/kor/column/enkajunggocagumae/"
    relative = "kor/column/enkajunggocagumae/index.html"
    errors = validate_launch(tmp_path, launch_manifest(url, relative), [("A", relative)])
    assert "EDITORIAL_DECISION_BLOCKED" in errors


def test_final_guard_requires_ymyl_review_but_keeps_safe_candidate_open(tmp_path):
    setup_data(tmp_path)
    url = "/kor/util/yeoncagaesugyesangi/"
    relative = "kor/util/yeoncagaesugyesangi/index.html"
    unreviewed_errors = validate_launch(
        tmp_path,
        launch_manifest(url, relative, ["keyword:연차개수계산기"]),
        [("A", relative)],
    )
    assert "YMYL_REVIEW_REQUIRED" in unreviewed_errors

    write_json(tmp_path / "data/content-launch-decisions.json", {"schemaVersion": 1, "decisions": [
        {"keyword": "연차개수계산기", "decision": "APPROVE", "reason": "explicit YMYL review completed"},
    ]})
    approved_errors = validate_launch(
        tmp_path,
        launch_manifest(url, relative, ["keyword:연차개수계산기"]),
        [("A", relative)],
    )
    assert "YMYL_REVIEW_REQUIRED" not in approved_errors

    safe_errors = validate_launch(
        tmp_path,
        launch_manifest("/kor/util/character-count/", "kor/util/character-count/index.html", ["keyword:글자수계산기"]),
        [("A", "kor/util/character-count/index.html")],
    )
    assert "EDITORIAL_DECISION_BLOCKED" not in safe_errors
    assert "YMYL_REVIEW_REQUIRED" not in safe_errors


def test_final_guard_requires_candidate_id_for_each_added_page(tmp_path):
    setup_data(tmp_path)
    url = "/kor/report/camp/untracked-candidate.html"
    relative = "kor/report/camp/untracked-candidate.html"
    errors = validate_launch(tmp_path, launch_manifest(url, relative), [("A", relative)])
    assert "LAUNCH_CANDIDATE_IDS_REQUIRED" in errors


def test_final_guard_rejects_unresolvable_candidate_ids(tmp_path):
    setup_data(tmp_path)
    url = "/kor/report/camp/untracked-candidate.html"
    relative = "kor/report/camp/untracked-candidate.html"
    content = tmp_path / relative
    content.parent.mkdir(parents=True, exist_ok=True)
    content.write_text(
        f'<html><head><title>New page</title><link rel="canonical" href="https://emfls.github.io{url}"></head><body><h1>New page</h1></body></html>',
        encoding="utf-8",
    )
    errors = validate_launch(
        tmp_path,
        launch_manifest(url, relative, ["opaque-id"]),
        [("A", relative)],
    )
    assert "LAUNCH_KEYWORD_ID_REQUIRED" in errors


def test_final_guard_fails_closed_when_editorial_decisions_are_unavailable(tmp_path):
    setup_data(tmp_path)
    (tmp_path / "data/content-launch-decisions.json").unlink()
    url = "/kor/report/camp/untracked-candidate.html"
    relative = "kor/report/camp/untracked-candidate.html"
    content = tmp_path / relative
    content.parent.mkdir(parents=True, exist_ok=True)
    content.write_text(
        f'<html><head><title>New page</title><link rel="canonical" href="https://emfls.github.io{url}"></head><body><h1>New page</h1></body></html>',
        encoding="utf-8",
    )
    errors = validate_launch(
        tmp_path,
        launch_manifest(url, relative, ["keyword:새후보"]),
        [("A", relative)],
    )
    assert "EDITORIAL_DECISIONS_UNAVAILABLE" in errors


def test_protected_winner_transition_source_has_unique_page_keys():
    source = Path("scripts/content_launch_guard.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    assignment = next(
        node for node in tree.body
        if isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id == "APPROVED_PROTECTED_WINNER_TRANSITIONS" for target in node.targets)
    )
    keys = [ast.literal_eval(key) for key in assignment.value.keys if key is not None]
    assert len(keys) == len(set(keys)), "protected winner page keys must be unique in source"
