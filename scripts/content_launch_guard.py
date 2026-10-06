#!/usr/bin/env python3
"""Fail-closed validation for automated content launch diffs."""

import argparse
import json
import re
import subprocess
from pathlib import Path


MEASUREMENT_WORKFLOW_ALLOWLIST = {".github/workflows/ga4-collection.yml"}
APPROVED_MONETIZATION_ADDITIONS = frozenset({
    ".github/workflows/adsense-collection.yml",
    "scripts/collect_adsense_snapshot.py",
})
APPROVED_PROTECTED_WINNER_TRANSITIONS = {
    "kor/report/camp/pyeongtaek.html": {
        ("4d95593169e466447ee355429d2822764ca7e1a5", "b4fc13119f1e8cd01d78805d06ee981ac6834236"),
    },
    # C33's user-approved factual and policy-integrity repair; the exact blob pair keeps all other edits protected.
    "kor/column/maple-planet-no-capital-rice-farming-2026.html": {
        ("fd73fdd0be12fab17f9ab78473c0182956d34098", "873ab21ba21523a22e83cffaf61e1dab3e4ec5d3"),
    },
}
APPROVED_MONETIZATION_TRANSITIONS = {
    "scripts/collect_adsense_snapshot.py": {
        ("94f34228ed8b10213085b3de19bbab14e4fee0de", "83595861b3ea484b7fd9ad0c7fb11515f6516692"),
        ("83595861b3ea484b7fd9ad0c7fb11515f6516692", "2f4890e73ae705c5347b3755c5fb4ef47ca23e2b"),
        ("2f4890e73ae705c5347b3755c5fb4ef47ca23e2b", "7e462d5e1ccedfba022594d98cabf4aa3697ca01"),
        ("7e462d5e1ccedfba022594d98cabf4aa3697ca01", "085f253a3ba6c98b3318a99d7a03b63c1398f761"),
        ("085f253a3ba6c98b3318a99d7a03b63c1398f761", "114d91de1a6e22103f7c697c7df229fa2ac1a0ad"),
    },
    ".github/workflows/adsense-collection.yml": {
        ("90f64a3d00d901f9052fc1fe20fc86372c90e014", "893889ceac2620250a6752d93aeb66c2a131b136"),
    },
}
APPROVED_JP_TRAVEL_CANARY_DELETIONS = {
    "jp/report/travel/bangladesh-lalmonirhat.html",
    "jp/report/travel/bangladesh-satkhira.html",
    "jp/report/travel/bangladesh-sirajganj.html",
    "jp/report/travel/barbados-bathsheba.html",
    "jp/report/travel/barbados-bridgetown.html",
    "jp/report/travel/botswana-ramotshwa.html",
    "jp/report/travel/brazil-curitiba.html",
    "jp/report/travel/brazil-rio.html",
    "jp/report/travel/canada-london.html",
    "jp/report/travel/chile-san-pedro-atacama.html",
    "jp/report/travel/colombia-santa-marta.html",
    "jp/report/travel/costa-rica-san-jose.html",
    "jp/report/travel/croatia-dubrovnik.html",
    "jp/report/travel/dominican-montecristi.html",
    "jp/report/travel/dominican-puntacana.html",
    "jp/report/travel/finland-helsinki.html",
    "jp/report/travel/greece-astypalaia.html",
    "jp/report/travel/greece-corfu.html",
    "jp/report/travel/greece-lefkada.html",
    "jp/report/travel/greece-mytilene.html",
    "jp/report/travel/india-ahmedabad.html",
    "jp/report/travel/india-delhi.html",
    "jp/report/travel/indonesia-ambon.html",
    "jp/report/travel/indonesia-medan.html",
    "jp/report/travel/indonesia-palembang.html",
    "jp/report/travel/ireland-cork.html",
    "jp/report/travel/ireland-waterford.html",
    "jp/report/travel/kenya-nairobi.html",
    "jp/report/travel/laos-luangprabang.html",
    "jp/report/travel/laos-pakse.html",
    "jp/report/travel/malaysia-kota-kinabalu.html",
    "jp/report/travel/maldives-male.html",
    "jp/report/travel/panama-city.html",
    "jp/report/travel/papua-new-guinea-port-moresby.html",
    "jp/report/travel/philippines-gensan.html",
    "jp/report/travel/philippines-iloilo.html",
    "jp/report/travel/portugal-aguassantas.html",
    "jp/report/travel/somalia-bosaso.html",
    "jp/report/travel/south-africa-cape-town.html",
    "jp/report/travel/south-africa-mossel-bay.html",
    "jp/report/travel/south-africa-paradise.html",
    "jp/report/travel/taiwan-taipei.html",
    "jp/report/travel/thailand-phuket.html",
    "jp/report/travel/thailand-ratchaburi.html",
    "jp/report/travel/thailand-tak.html",
    "jp/report/travel/thailand-udonthani.html",
    "jp/report/travel/uae-dubai.html",
    "jp/report/travel/uk-edinburgh.html",
    "jp/report/travel/uk-sheffield.html",
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
ARABIC_RETIREMENT_OVERRIDE_PATH = "data/locale-retirement-overrides.json"
APPROVED_ARABIC_RETIREMENT_URLS = frozenset({
    "/ae/util/",
    "/ae/util/dice3d/",
    "/ae/util/text-cleaner/",
    "/ae/util/text-shuffle-sort/",
})
ARABIC_RETIREMENT_EVIDENCE = {
    "period": "2026-09-05..2026-10-02",
    "views": 13,
    "users": 12,
    "engagementSeconds": 256,
    "totalAdRevenue": 0.015871,
}
RAW_MEASUREMENT_HISTORY_PREFIX = "data/performance/"


def _read(path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def _url_to_path(url):
    return str(url or "").split("?", 1)[0].lstrip("/")


def _url_to_content_path(url):
    clean = str(url or "").split("?", 1)[0]
    path = clean.lstrip("/")
    return f"{path}index.html" if clean.endswith("/") else path


def _approved_arabic_retirement_paths(root):
    record = _read(Path(root) / ARABIC_RETIREMENT_OVERRIDE_PATH, {})
    if not isinstance(record, dict):
        return set()
    urls = record.get("urls")
    evidence = record.get("evidence")
    if not isinstance(evidence, dict):
        return set()
    ga4 = evidence.get("ga4")
    gsc = evidence.get("gsc")
    if not isinstance(ga4, dict) or not isinstance(gsc, dict):
        return set()
    if not (
        record.get("schemaVersion") == 1
        and record.get("locale") == "ae"
        and record.get("decision") == "RETIRED"
        and record.get("status") == "USER_APPROVED_LOCALE_RETIREMENT_OVERRIDE"
        and record.get("approved") is True
        and record.get("preserveRawMeasurements") is True
        and bool(str(record.get("reason") or "").strip())
        and isinstance(urls, list)
        and len(urls) == len(APPROVED_ARABIC_RETIREMENT_URLS)
        and all(isinstance(url, str) for url in urls)
        and set(urls) == APPROVED_ARABIC_RETIREMENT_URLS
        and all(url.startswith("/ae/") for url in urls)
        and ga4 == ARABIC_RETIREMENT_EVIDENCE
        and gsc == {"status": "NO_ROW"}
    ):
        return set()
    return {_url_to_content_path(url) for url in urls}


def _changed_tuple(item):
    if not isinstance(item, tuple):
        return "M", item, None, None
    if len(item) == 2:
        return item[0], item[1], None, None
    if len(item) == 4:
        return item
    raise ValueError("changed path entries must contain status/path or status/path/blob transition")


def validate_launch(root, manifest, changed_paths):
    root = Path(root)
    changed = [_changed_tuple(row) for row in changed_paths]
    errors = set()
    changed_names = {row[1] for row in changed}
    approved_arabic_retirement_paths = _approved_arabic_retirement_paths(root)
    added_html = {row[1] for row in changed if row[0] == "A" and row[1].endswith(".html")}
    expected_html = set(manifest.get("contentPaths") or [_url_to_path(url) for url in manifest.get("urls") or []])
    # A manifest can change for launch bookkeeping without adding content.
    # Only a newly added HTML file starts content-launch validation; when HTML
    # is added, it must still match the manifest exactly.
    launch_changed = bool(added_html)
    if launch_changed and added_html != expected_html:
        errors.add("MANIFEST_DIFF_MISMATCH")
    # Only exact, evidenced Arabic retirement exceptions and this exact JP
    # Travel canary are authorized; keep every other deletion and rename closed.
    unauthorized_deletion = any(
        row[0].startswith(("D", "R"))
        and not (
            row[0] == "D"
            and (row[1] in approved_arabic_retirement_paths or row[1] in APPROVED_JP_TRAVEL_CANARY_DELETIONS)
        )
        for row in changed
    )
    if manifest.get("deletions") or unauthorized_deletion:
        errors.add("DELETION_NOT_ALLOWED")
    if any(
        status.startswith("D") and path.startswith(RAW_MEASUREMENT_HISTORY_PREFIX)
        for status, path, _, _ in changed
    ):
        errors.add("RAW_MEASUREMENT_HISTORY_DELETION_NOT_ALLOWED")

    ctr = _read(root / "data/experiments.json", {"experiments": []})
    protected_experiments = {_url_to_path(row.get("url")) for row in ctr.get("experiments") or [] if row.get("status") == "OBSERVING"}
    revenue = _read(root / "data/revenue-opportunities.json", {})
    protected_winners = {_url_to_content_path(row.get("url")) for row in revenue.get("protectedWinners") or []}
    if changed_names & protected_experiments:
        errors.add("PROTECTED_EXPERIMENT_CHANGED")
    for path in changed_names & protected_winners:
        path_changes = [row for row in changed if row[1] == path]
        approved = APPROVED_PROTECTED_WINNER_TRANSITIONS.get(path, set())
        if (
            len(path_changes) == 1
            and path_changes[0][0] == "D"
            and path in approved_arabic_retirement_paths
        ):
            continue
        if (
            len(path_changes) != 1
            or path_changes[0][0] != "M"
            or (path_changes[0][2], path_changes[0][3]) not in approved
        ):
            errors.add("PROTECTED_WINNER_CHANGED")
    if any(
        path not in MEASUREMENT_WORKFLOW_ALLOWLIST
        and not (status == "A" and path in APPROVED_MONETIZATION_ADDITIONS)
        and not (
            status == "M"
            and path in APPROVED_MONETIZATION_TRANSITIONS
            and (before_blob, after_blob) in APPROVED_MONETIZATION_TRANSITIONS[path]
        )
        and (
            path in APPROVED_MONETIZATION_ADDITIONS
            or re.search(r"(^|/)(ads?|adsense|ga4|analytics)([._/-]|$)", path, re.I)
        )
        for status, path, before_blob, after_blob in changed
    ):
        errors.add("MONETIZATION_OR_ANALYTICS_CHANGED")

    if not launch_changed:
        return sorted(errors)

    audit = _read(root / "data/site-audit.json", {"pages": []})
    manifest_urls = set(manifest.get("urls") or [])
    existing_rows = [
        row
        for row in audit.get("pages") or []
        if row.get("path") not in expected_html and row.get("url") not in manifest_urls
    ]
    existing_titles = {row.get("title") for row in existing_rows if row.get("title")}
    existing_h1 = {row.get("h1") for row in existing_rows if row.get("h1")}
    titles, headings, canonicals = set(), set(), set()
    sitemap_text = "\n".join((root / path).read_text(encoding="utf-8") for path in manifest.get("sitemapPaths") or [] if (root / path).exists())
    hub_text = "\n".join((root / path).read_text(encoding="utf-8") for path in manifest.get("hubPaths") or [] if (root / path).exists())
    for url, relative in zip(manifest.get("urls") or [], manifest.get("contentPaths") or []):
        path = root / relative
        if not path.exists():
            errors.add("CONTENT_FILE_MISSING")
            continue
        html = path.read_text(encoding="utf-8")
        title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
        h1_match = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.I | re.S)
        canonical_match = re.search(r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)', html, re.I)
        title = re.sub(r"<[^>]+>", "", title_match.group(1)).strip() if title_match else None
        h1 = re.sub(r"<[^>]+>", "", h1_match.group(1)).strip() if h1_match else None
        canonical = canonical_match.group(1) if canonical_match else None
        expected_canonical = "https://emfls.github.io" + url
        if not title or title in titles or title in existing_titles:
            errors.add("TITLE_MISSING_OR_DUPLICATE")
        if not h1 or h1 in headings or h1 in existing_h1:
            errors.add("H1_MISSING_OR_DUPLICATE")
        if canonical != expected_canonical or canonical in canonicals:
            errors.add("CANONICAL_MISMATCH")
        titles.add(title); headings.add(h1); canonicals.add(canonical)
        if not re.search(r'<meta[^>]+name=["\']viewport["\']', html, re.I):
            errors.add("VIEWPORT_MISSING")
        if 'application/ld+json' not in html:
            errors.add("JSON_LD_MISSING")
        if expected_canonical not in sitemap_text:
            errors.add("SITEMAP_ENTRY_MISSING")
        if (f'href="{url}"' not in hub_text) and (f"href='{url}'" not in hub_text):
            errors.add("HUB_LINK_MISSING")
    return sorted(errors)


def _git_changes(root, base_ref):
    result = subprocess.run(["git", "diff", "--name-status", base_ref, "HEAD"], cwd=str(root), text=True, capture_output=True, check=True)
    rows = []
    for line in result.stdout.splitlines():
        parts = line.split("\t")
        if len(parts) >= 2:
            status, path = parts[0], parts[-1]
            if status == "M" and (
                path in APPROVED_PROTECTED_WINNER_TRANSITIONS
                or path in APPROVED_MONETIZATION_TRANSITIONS
            ):
                before = subprocess.run(
                    ["git", "rev-parse", f"{base_ref}:{path}"],
                    cwd=str(root), text=True, capture_output=True, check=True,
                ).stdout.strip()
                after = subprocess.run(
                    ["git", "rev-parse", f"HEAD:{path}"],
                    cwd=str(root), text=True, capture_output=True, check=True,
                ).stdout.strip()
                rows.append((status, path, before, after))
            else:
                rows.append((status, path))
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--manifest", type=Path, default=Path("data/content-launch-manifest.json"))
    parser.add_argument("--base-ref", default="HEAD")
    args = parser.parse_args()
    manifest = _read(args.root / args.manifest, {})
    errors = validate_launch(args.root, manifest, _git_changes(args.root, args.base_ref))
    print(json.dumps({"status": "FAIL" if errors else "PASS", "errors": errors}))
    raise SystemExit(1 if errors else 0)


if __name__ == "__main__":
    main()
