#!/usr/bin/env python3
"""Fail-closed validation for automated content launch diffs."""

import argparse
import csv
import io
import json
import re
import subprocess
import unicodedata
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
from zoneinfo import ZoneInfo

try:
    from scripts.content_launch_decisions import load_decisions
    from scripts.content_launch_policy import (
        DAILY_PUBLICATION_LIMIT,
        SITE_HOST,
        keyword_from_candidate_id,
        normalize_keyword,
        publication_day,
        published_manifest_dedupe_keys,
        requires_ymyl_review,
    )
    from scripts.content_url_planner import plan_url
    from scripts.external_content_opportunity import launch_readiness
except ModuleNotFoundError:
    from content_launch_decisions import load_decisions
    from content_launch_policy import (
        DAILY_PUBLICATION_LIMIT,
        SITE_HOST,
        keyword_from_candidate_id,
        normalize_keyword,
        publication_day,
        published_manifest_dedupe_keys,
        requires_ymyl_review,
    )
    from content_url_planner import plan_url
    from external_content_opportunity import launch_readiness


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
SEOUL = ZoneInfo("Asia/Seoul")
TRUSTED_BASE_JSON_PATHS = (
    "data/content-launch-queue.json",
    "data/external-content-opportunities.json",
    "data/content-launch-decisions.json",
    "data/published_keywords.json",
    "data/content-launch-counter.json",
    "data/content-launch-manifest.json",
    "data/content-launch-experiments.json",
    "data/experiments.json",
    "data/revenue-opportunities.json",
    "data/site-audit.json",
)
TRUSTED_BASE_CSV_PATHS = ("data/keywords_master.csv",)
TRUSTED_LAUNCH_CODE_PATHS = {
    ".github/workflows/content-index-refresh.yml",
    ".github/workflows/indexnow-submit.yml",
    ".github/workflows/keyword-hunter.yml",
    ".github/workflows/seo-qa.yml",
    "scripts/content_launch_decisions.py",
    "scripts/content_launch_guard.py",
    "scripts/content_launch_policy.py",
    "scripts/content_url_planner.py",
    "scripts/daily_revenue_growth.py",
    "scripts/external_content_opportunity.py",
    "scripts/external_discovery_pipeline.py",
    "scripts/new_content_opportunity.py",
    "scripts/prepare_external_launch.py",
    "scripts/prepare_keyword_launch.py",
}
KEYWORD_CANDIDATE_PATHS = {
    "kor/util/yeoncagaesugyesangi/index.html": "연차개수계산기",
    "kor/util/ingeonbigyesangi/index.html": "인건비계산기",
    "kor/column/enkajunggocagumae/index.html": "엔카중고차구매",
}


def _read(path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def _trusted_base_snapshot(root, base_ref):
    """Read launch authority only from an immutable commit that is an ancestor of HEAD."""
    root = Path(root)
    resolved = subprocess.run(
        ["git", "rev-parse", "--verify", f"{base_ref}^{{commit}}"],
        cwd=str(root), text=True, capture_output=True, check=True,
    ).stdout.strip()
    ancestor = subprocess.run(
        ["git", "merge-base", "--is-ancestor", resolved, "HEAD"],
        cwd=str(root), text=True, capture_output=True, check=False,
    )
    if ancestor.returncode != 0:
        raise ValueError("trusted base revision is not an ancestor of the checked head")

    snapshot = {"revision": resolved, "json": {}, "csv": {}}
    for relative in TRUSTED_BASE_JSON_PATHS:
        raw = subprocess.run(
            ["git", "show", f"{resolved}:{relative}"],
            cwd=str(root), text=True, capture_output=True, check=True,
        ).stdout
        snapshot["json"][relative] = json.loads(raw)
    for relative in TRUSTED_BASE_CSV_PATHS:
        raw = subprocess.run(
            ["git", "show", f"{resolved}:{relative}"],
            cwd=str(root), text=True, capture_output=True, check=True,
        ).stdout
        snapshot["csv"][relative] = list(csv.DictReader(io.StringIO(raw)))
    return snapshot


def _decision_map(document):
    if not isinstance(document, dict) or document.get("schemaVersion") != 1 or not isinstance(document.get("decisions"), list):
        raise ValueError("invalid content-launch decision store")
    decisions = {}
    allowed = {"HOLD", "NO_NEW_PAGE", "UPDATE_EXISTING", "APPROVE"}
    for row in document["decisions"]:
        if not isinstance(row, dict):
            raise ValueError("invalid content-launch decision row")
        keyword = normalize_keyword(row.get("keyword"))
        decision = row.get("decision")
        if not keyword or decision not in allowed:
            raise ValueError("invalid content-launch decision")
        if keyword in decisions and decisions[keyword] != decision:
            raise ValueError("conflicting content-launch decisions")
        decisions[keyword] = decision
    return decisions


def _normalized_launch_url(value, *, require_absolute=False):
    """Return a same-site route identity, rejecting URL spellings that map ambiguously."""
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text or text != value:
        return None
    try:
        parsed = urlsplit(text)
        if parsed.query or parsed.fragment:
            return None
        if parsed.scheme or parsed.netloc:
            if (
                parsed.scheme.casefold() != "https"
                or (parsed.hostname or "").casefold() != SITE_HOST
                or parsed.username is not None
                or parsed.password is not None
                or parsed.port not in (None, 443)
            ):
                return None
        elif require_absolute or text.startswith("//"):
            return None
        path = parsed.path or "/"
    except ValueError:
        return None
    if (
        not path.startswith("/")
        or re.search(r"%(?![0-9a-fA-F]{2})", path)
        or re.search(r"%(?:2f|5c|2e)", path, re.I)
    ):
        return None
    decoded = unicodedata.normalize("NFC", unquote(path))
    if "\\" in decoded or "\x00" in decoded or "//" in decoded:
        return None
    segments = decoded.split("/")
    if any(part in {".", ".."} for part in segments) or any(not part for part in segments[1:-1]):
        return None
    if decoded.endswith("/index.html"):
        decoded = decoded[:-len("index.html")]
    return decoded


def _content_path_for_url(value):
    identity = _normalized_launch_url(value)
    if identity is None:
        return None
    if identity.endswith("/"):
        return f"{identity.lstrip('/')}index.html"
    if identity.casefold().endswith(".html"):
        return identity.lstrip("/")
    return None


def _safe_content_path(value):
    if not isinstance(value, str) or not value or value.startswith("/") or "\\" in value:
        return None
    path = Path(value)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in value.split("/")):
        return None
    if not value.casefold().endswith(".html"):
        return None
    return value


class _CanonicalLinkParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        if tag.casefold() != "link":
            return
        attrs = {str(key).casefold(): value for key, value in attrs}
        if "canonical" in str(attrs.get("rel") or "").casefold().split():
            self.hrefs.append(attrs.get("href"))


class _AnchorParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        if tag.casefold() == "a":
            attrs = {str(key).casefold(): value for key, value in attrs}
            if attrs.get("href"):
                self.hrefs.append(attrs["href"])


def _trusted_candidate_records(snapshot):
    documents = snapshot["json"]
    queue_doc = documents["data/content-launch-queue.json"]
    external_doc = documents["data/external-content-opportunities.json"]
    if not isinstance(queue_doc, dict) or not isinstance(queue_doc.get("queue"), list):
        raise ValueError("invalid trusted keyword launch queue")
    if not isinstance(external_doc, dict) or not isinstance(external_doc.get("candidates"), list):
        raise ValueError("invalid trusted external candidate source")
    master_rows = snapshot["csv"]["data/keywords_master.csv"]
    master_by_keyword = {}
    for row in master_rows:
        identity = normalize_keyword(row.get("keyword"))
        if identity:
            master_by_keyword.setdefault(identity, []).append(row)

    records = []
    ambiguous_ids = set()
    queue_by_keyword = {}
    for row in queue_doc["queue"]:
        if not isinstance(row, dict):
            continue
        keyword = str(row.get("keyword") or "").strip()
        identity = normalize_keyword(keyword)
        if identity:
            queue_by_keyword.setdefault(identity, []).append(row)
    for identity, queue_rows in queue_by_keyword.items():
        if len(queue_rows) != 1:
            ambiguous_ids.add(f"keyword:{queue_rows[0].get('keyword', '')}")
            continue
        queue_row = queue_rows[0]
        if queue_row.get("status") != "READY_TO_LAUNCH" or queue_row.get("review_status") != "PAGE_REVIEW_READY":
            continue
        matches = master_by_keyword.get(identity, [])
        if len(matches) != 1:
            if len(matches) > 1:
                ambiguous_ids.add(f"keyword:{queue_row.get('keyword', '')}")
            continue
        master = matches[0]
        keyword = str(master.get("keyword") or "").strip()
        if (
            str(master.get("action") or "NEW_PAGE") != "NEW_PAGE"
            or str(master.get("score_valid") or "").casefold() not in {"true", "1", "yes"}
            or str(master.get("status") or "").upper() in {"PUBLISHED", "REJECTED", "COOLDOWN", "EXPIRED"}
        ):
            continue
        category = str(master.get("category") or "")
        content_types = str(master.get("content_types") or "")
        intent = str(master.get("intent") or "")
        planned_url = plan_url(keyword, category, content_types, intent)
        queue_url = queue_row.get("suggested_url")
        if (
            normalize_keyword(queue_row.get("keyword")) != identity
            or (queue_row.get("category") and str(queue_row.get("category")) != category)
            or _normalized_launch_url(queue_url) != _normalized_launch_url(planned_url)
        ):
            ambiguous_ids.add(f"keyword:{keyword}")
            continue
        records.append({
            "candidateId": f"keyword:{keyword}",
            "keyword": keyword,
            "editorialKeys": [identity],
            "ymyl": requires_ymyl_review({
                "keyword": keyword, "category": category, "content_types": content_types,
            }),
            "url": planned_url,
            "urlIdentity": _normalized_launch_url(planned_url),
            "contentPath": _content_path_for_url(planned_url),
            "source": "keyword",
        })

    ready_ids = external_doc.get("readyToLaunch") or []
    if not isinstance(ready_ids, list):
        raise ValueError("invalid trusted external ready list")
    ready_counts = {}
    for value in ready_ids:
        if isinstance(value, str) and value.strip():
            ready_counts[value] = ready_counts.get(value, 0) + 1
    external_by_id = {}
    for candidate in external_doc["candidates"]:
        if not isinstance(candidate, dict):
            continue
        candidate_id = candidate.get("candidateId")
        if isinstance(candidate_id, str) and candidate_id.strip():
            external_by_id.setdefault(candidate_id, []).append(candidate)
    for candidate_id, candidates in external_by_id.items():
        if len(candidates) > 1 or (candidate_id in ready_counts and ready_counts[candidate_id] > 1):
            ambiguous_ids.add(candidate_id)
            continue
        if ready_counts.get(candidate_id) != 1:
            continue
        if candidate_id != candidate_id.strip():
            ambiguous_ids.add(candidate_id)
            continue
        candidate = candidates[0]
        if launch_readiness(candidate).get("status") != "READY_TO_LAUNCH":
            continue
        declared_ymyl = candidate.get("ymyl")
        if declared_ymyl is not None and type(declared_ymyl) is not bool:
            ambiguous_ids.add(candidate_id)
            continue
        url = candidate.get("url")
        content_path = _safe_content_path(candidate.get("contentPath"))
        if not url or not content_path or _content_path_for_url(url) != content_path:
            ambiguous_ids.add(candidate_id)
            continue
        identity_texts = [
            candidate.get("keyword"), candidate.get("idea"),
            (candidate.get("discovery") or {}).get("observedTopic"),
            (candidate.get("intent") or {}).get("primary"),
            (candidate.get("brief") or {}).get("primaryIntent"),
        ]
        keyword = str(candidate.get("keyword") or candidate_id)
        editorial_key = normalize_keyword(keyword)
        candidate_key = normalize_keyword(candidate_id)
        editorial_keys = list(dict.fromkeys(key for key in (editorial_key, candidate_key) if key))
        records.append({
            "candidateId": candidate_id,
            "keyword": keyword,
            "editorialKeys": editorial_keys,
            "approvalKey": editorial_key or candidate_key,
            "ymyl": declared_ymyl is True or any(
                requires_ymyl_review({"keyword": value}) for value in identity_texts if value
            ),
            "url": url,
            "urlIdentity": _normalized_launch_url(url),
            "contentPath": content_path,
            "source": "external",
        })

    by_id = {}
    by_url = {}
    by_path = {}
    for record in records:
        by_id.setdefault(record["candidateId"], []).append(record)
        if record["urlIdentity"]:
            by_url.setdefault(record["urlIdentity"], []).append(record)
        if record["contentPath"]:
            by_path.setdefault(record["contentPath"], []).append(record)
    for identity, matches in by_id.items():
        if len(matches) > 1:
            ambiguous_ids.add(identity)
    ambiguous_urls = {identity for identity, matches in by_url.items() if len(matches) > 1}
    ambiguous_paths = {identity for identity, matches in by_path.items() if len(matches) > 1}
    return {
        "byId": by_id,
        "byUrl": by_url,
        "byPath": by_path,
        "ambiguousIds": ambiguous_ids,
        "ambiguousUrls": ambiguous_urls,
        "ambiguousPaths": ambiguous_paths,
    }


def _base_published_identities(snapshot):
    documents = snapshot["json"]
    published_keywords = documents["data/published_keywords.json"]
    if not isinstance(published_keywords, list):
        raise ValueError("invalid published keywords registry")
    published_keywords_set = set()
    published_urls = set()
    for row in published_keywords:
        if not isinstance(row, dict):
            continue
        identity = normalize_keyword(row.get("keyword"))
        url_identity = _normalized_launch_url(row.get("url"))
        if identity:
            published_keywords_set.add(identity)
        if url_identity:
            published_urls.add(url_identity)
    manifest = documents["data/content-launch-manifest.json"]
    if not isinstance(manifest, dict):
        raise ValueError("invalid published content launch manifest")
    _, manifest_keywords = published_manifest_dedupe_keys(manifest)
    is_final_manifest = str(manifest.get("status") or "").upper() in {"PUBLISHED", "LAUNCHED"}
    manifest_url_values = manifest.get("urls") or []
    if is_final_manifest and not isinstance(manifest_url_values, (list, tuple)):
        raise ValueError("invalid published manifest URLs")
    manifest_urls = set()
    for value in manifest_url_values:
        url_identity = _normalized_launch_url(value)
        if url_identity is None:
            if is_final_manifest:
                raise ValueError("invalid published manifest URL")
            continue
        manifest_urls.add(url_identity)
    published_urls.update(manifest_urls)
    published_keywords_set.update(manifest_keywords)
    published_external_ids = {
        str(value) for value in (manifest.get("candidateIds") or [])
        if str(manifest.get("status") or "").upper() in {"PUBLISHED", "LAUNCHED"}
        and isinstance(value, str) and value.strip() and not keyword_from_candidate_id(value)
    } if isinstance(manifest, dict) else set()
    experiment_doc = documents["data/content-launch-experiments.json"]
    if not isinstance(experiment_doc, dict):
        raise ValueError("invalid content launch experiments")
    rows = experiment_doc.get("experiments", [])
    if not isinstance(rows, list):
        raise ValueError("invalid content launch experiments")
    for row in rows or []:
        if isinstance(row, dict) and row.get("candidateId"):
            published_external_ids.add(str(row["candidateId"]))
        if isinstance(row, dict):
            identity = _normalized_launch_url(row.get("url"))
            if identity:
                published_urls.add(identity)
    return published_keywords_set, published_urls, published_external_ids


def _published_count_for_day(snapshot, day):
    documents = snapshot["json"]
    counter = documents["data/content-launch-counter.json"]
    if not isinstance(counter, dict):
        raise ValueError("invalid publication counter")
    counts = []
    counter_day = publication_day(counter.get("date"))
    if counter_day is None:
        return DAILY_PUBLICATION_LIMIT
    if counter_day == day:
        count = counter.get("launchedCount")
        if type(count) is int and count >= 0:
            counts.append(count)
        else:
            counts.append(DAILY_PUBLICATION_LIMIT)
    manifest = documents["data/content-launch-manifest.json"]
    if not isinstance(manifest, dict):
        raise ValueError("invalid published content launch manifest")
    if isinstance(manifest, dict) and str(manifest.get("status") or "").upper() in {"PUBLISHED", "LAUNCHED"}:
        if publication_day(manifest.get("runAt") or manifest.get("publicationAccountingDate")) == day:
            counts.append(max(
                len(manifest.get("candidateIds") or []),
                len(manifest.get("urls") or []),
                len(manifest.get("contentPaths") or []),
                int(manifest.get("publishedToday") or 0),
            ))
    experiment_doc = documents["data/content-launch-experiments.json"]
    if not isinstance(experiment_doc, dict) or not isinstance(experiment_doc.get("experiments", []), list):
        raise ValueError("invalid content launch experiments")
    rows = experiment_doc.get("experiments", [])
    counts.append(sum(
        1 for row in rows or []
        if isinstance(row, dict)
        and publication_day(row.get("publishedAt") or row.get("publishedOn")) == day
    ))
    published_keywords = documents["data/published_keywords.json"]
    if not isinstance(published_keywords, list):
        raise ValueError("invalid published keywords registry")
    counts.append(sum(
        1 for row in published_keywords if isinstance(row, dict)
        and publication_day(row.get("at") or row.get("publishedAt")) == day
    ))
    return max(counts, default=0)


def _validate_candidate_bindings(root, manifest, added_html, snapshot, errors):
    root = Path(root)
    if not isinstance(snapshot, dict):
        errors.add("TRUSTED_BASE_REVISION_UNAVAILABLE")
        return
    try:
        sources = _trusted_candidate_records(snapshot)
        base_decisions = _decision_map(snapshot["json"]["data/content-launch-decisions.json"])
        head_decisions = _decision_map(_read(root / "data/content-launch-decisions.json", {}))
        published_keywords, published_urls, published_external_ids = _base_published_identities(snapshot)
    except (KeyError, TypeError, ValueError, OSError, csv.Error):
        errors.add("TRUSTED_BASE_REVISION_UNAVAILABLE")
        return

    urls = manifest.get("urls")
    paths = manifest.get("contentPaths")
    candidate_ids = manifest.get("candidateIds")
    if not all(isinstance(values, list) for values in (urls, paths, candidate_ids)):
        errors.add("CANDIDATE_IDENTITY_MISMATCH")
        return
    if not (len(urls) == len(paths) == len(candidate_ids) == len(added_html)):
        errors.add("CANDIDATE_IDENTITY_MISMATCH")
    if (
        len(set(value for value in urls if isinstance(value, str))) != len(urls)
        or len(set(value for value in paths if isinstance(value, str))) != len(paths)
        or len(set(value for value in candidate_ids if isinstance(value, str))) != len(candidate_ids)
    ):
        errors.add("CANDIDATE_IDENTITY_MISMATCH")
        if len(set(value for value in candidate_ids if isinstance(value, str))) != len(candidate_ids):
            errors.add("LAUNCH_CANDIDATE_IDS_REQUIRED")

    if not (
        isinstance(candidate_ids, list)
        and len(candidate_ids) == len(added_html)
        and isinstance(urls, list)
        and isinstance(paths, list)
        and len(urls) == len(paths) == len(candidate_ids)
    ):
        return

    if set(paths) != added_html:
        errors.add("CANDIDATE_IDENTITY_MISMATCH")
    today = datetime.now(SEOUL).date()
    daily_limit = manifest.get("dailyLimit", DAILY_PUBLICATION_LIMIT)
    if type(daily_limit) is not int or not 0 <= daily_limit <= DAILY_PUBLICATION_LIMIT:
        errors.add("PUBLICATION_LIMIT_EXCEEDED")
        daily_limit = DAILY_PUBLICATION_LIMIT
    if len(added_html) + _published_count_for_day(snapshot, today) > daily_limit:
        errors.add("PUBLICATION_LIMIT_EXCEEDED")

    for candidate_id, url, content_path in zip(candidate_ids, urls, paths):
        if not isinstance(candidate_id, str) or not candidate_id.strip():
            errors.add("LAUNCH_CANDIDATE_IDS_REQUIRED")
            errors.add("CANDIDATE_IDENTITY_MISMATCH")
            continue
        matches = sources["byId"].get(candidate_id, [])
        if candidate_id in sources["ambiguousIds"] or len(matches) > 1:
            errors.add("AMBIGUOUS_TRUSTED_CANDIDATE")
            continue
        if len(matches) != 1:
            errors.add("TRUSTED_CANDIDATE_NOT_FOUND")
            continue
        source = matches[0]
        url_identity = _normalized_launch_url(url)
        manifest_path = _safe_content_path(content_path)
        if (
            url_identity is None
            or manifest_path is None
            or source["urlIdentity"] is None
            or source["urlIdentity"] != url_identity
            or source["contentPath"] != manifest_path
            or _content_path_for_url(url) != manifest_path
            or url_identity in sources["ambiguousUrls"]
            or manifest_path in sources["ambiguousPaths"]
        ):
            errors.add("CANDIDATE_IDENTITY_MISMATCH")
            continue
        if source["source"] == "keyword":
            identity = normalize_keyword(source["keyword"])
            if identity in published_keywords:
                errors.add("CANDIDATE_ALREADY_PUBLISHED")
        elif candidate_id in published_external_ids:
            errors.add("CANDIDATE_ALREADY_PUBLISHED")
        if url_identity in published_urls:
            errors.add("CANDIDATE_ALREADY_PUBLISHED")

        editorial_keys = source["editorialKeys"]
        for identity in editorial_keys:
            base_decision = base_decisions.get(identity)
            if head_decisions.get(identity) != base_decision:
                errors.add("EDITORIAL_DECISION_TAMPERING")
            if base_decision in {"HOLD", "NO_NEW_PAGE", "UPDATE_EXISTING"}:
                errors.add("EDITORIAL_DECISION_BLOCKED")
            if source["ymyl"] and identity == source.get("approvalKey", identity) and base_decision != "APPROVE":
                errors.add("YMYL_REVIEW_REQUIRED")

        page_path = root / manifest_path
        try:
            page_path.resolve().relative_to(root.resolve())
            if page_path.is_symlink():
                raise ValueError("content path must not be a symlink")
            parser = _CanonicalLinkParser()
            parser.feed(page_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            errors.add("CANDIDATE_IDENTITY_MISMATCH")
            continue
        if (
            len(parser.hrefs) != 1
            or _normalized_launch_url(parser.hrefs[0], require_absolute=True) != url_identity
        ):
            errors.add("CANONICAL_MISMATCH")


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


def validate_launch(root, manifest, changed_paths, trusted_base=None):
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
    if launch_changed and changed_names & TRUSTED_LAUNCH_CODE_PATHS:
        errors.add("LAUNCH_GUARD_CHANGED_WITH_CONTENT")
    if launch_changed and trusted_base is None:
        repository_check = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=str(root), text=True, capture_output=True, check=False,
        )
        if repository_check.returncode == 0:
            errors.add("TRUSTED_BASE_REVISION_REQUIRED")
    if launch_changed:
        if trusted_base is not None:
            _validate_candidate_bindings(root, manifest, added_html, trusted_base, errors)
        else:
            candidate_ids = manifest.get("candidateIds")
            if (
                not isinstance(candidate_ids, list)
                or len(candidate_ids) != len(added_html)
                or any(not isinstance(value, str) or not value.strip() for value in candidate_ids)
                or len(set(candidate_ids)) != len(candidate_ids)
            ):
                errors.add("LAUNCH_CANDIDATE_IDS_REQUIRED")
            candidate_keywords = set()
            if isinstance(candidate_ids, list):
                for value in candidate_ids:
                    keyword = keyword_from_candidate_id(value)
                    if keyword:
                        candidate_keywords.add(keyword)
                    else:
                        errors.add("LAUNCH_KEYWORD_ID_REQUIRED")
            candidate_keywords.update(
                KEYWORD_CANDIDATE_PATHS[path]
                for path in added_html
                if path in KEYWORD_CANDIDATE_PATHS
            )
            try:
                editorial_decisions = load_decisions(root / "data/content-launch-decisions.json")
            except (OSError, TypeError, ValueError):
                editorial_decisions = {}
                errors.add("EDITORIAL_DECISIONS_UNAVAILABLE")
            for keyword in candidate_keywords:
                decision = editorial_decisions.get(keyword)
                if decision in {"HOLD", "NO_NEW_PAGE", "UPDATE_EXISTING"}:
                    errors.add("EDITORIAL_DECISION_BLOCKED")
                if requires_ymyl_review({"keyword": keyword}) and decision != "APPROVE":
                    errors.add("YMYL_REVIEW_REQUIRED")
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

    base_documents = trusted_base.get("json", {}) if trusted_base else {}
    ctr = base_documents.get("data/experiments.json") or _read(root / "data/experiments.json", {"experiments": []})
    protected_experiments = {_url_to_path(row.get("url")) for row in ctr.get("experiments") or [] if row.get("status") == "OBSERVING"}
    revenue = base_documents.get("data/revenue-opportunities.json") or _read(root / "data/revenue-opportunities.json", {})
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

    audit = base_documents.get("data/site-audit.json") or _read(root / "data/site-audit.json", {"pages": []})
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
    hub_parser = _AnchorParser()
    hub_parser.feed(hub_text)
    hub_url_identities = {
        identity for href in hub_parser.hrefs
        if (identity := _normalized_launch_url(href)) is not None
    }
    for url, relative in zip(manifest.get("urls") or [], manifest.get("contentPaths") or []):
        path = root / relative
        if not path.exists():
            errors.add("CONTENT_FILE_MISSING")
            continue
        html = path.read_text(encoding="utf-8")
        title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
        h1_match = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.I | re.S)
        title = re.sub(r"<[^>]+>", "", title_match.group(1)).strip() if title_match else None
        h1 = re.sub(r"<[^>]+>", "", h1_match.group(1)).strip() if h1_match else None
        canonical_parser = _CanonicalLinkParser()
        canonical_parser.feed(html)
        canonical = canonical_parser.hrefs[0] if len(canonical_parser.hrefs) == 1 else None
        expected_identity = _normalized_launch_url(url)
        expected_canonical = f"https://{SITE_HOST}{expected_identity}" if expected_identity else None
        if not title or title in titles or title in existing_titles:
            errors.add("TITLE_MISSING_OR_DUPLICATE")
        if not h1 or h1 in headings or h1 in existing_h1:
            errors.add("H1_MISSING_OR_DUPLICATE")
        canonical_identity = _normalized_launch_url(canonical, require_absolute=True) if canonical else None
        if canonical_identity != expected_identity or canonical_identity in canonicals:
            errors.add("CANONICAL_MISMATCH")
        titles.add(title); headings.add(h1); canonicals.add(canonical_identity)
        if not re.search(r'<meta[^>]+name=["\']viewport["\']', html, re.I):
            errors.add("VIEWPORT_MISSING")
        if 'application/ld+json' not in html:
            errors.add("JSON_LD_MISSING")
        if expected_identity and expected_identity not in sitemap_text:
            errors.add("SITEMAP_ENTRY_MISSING")
        if expected_identity and expected_identity not in hub_url_identities:
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
    try:
        trusted_base = _trusted_base_snapshot(args.root, args.base_ref)
        changed_paths = _git_changes(args.root, trusted_base["revision"])
        errors = validate_launch(args.root, manifest, changed_paths, trusted_base=trusted_base)
    except (OSError, TypeError, ValueError, KeyError, subprocess.CalledProcessError, csv.Error):
        errors = ["TRUSTED_BASE_REVISION_UNAVAILABLE"]
    print(json.dumps({"status": "FAIL" if errors else "PASS", "errors": errors}))
    raise SystemExit(1 if errors else 0)


if __name__ == "__main__":
    main()
