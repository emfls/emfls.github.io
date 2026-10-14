#!/usr/bin/env python3
"""Fail-closed validation for automated content launch diffs."""

import argparse
import csv
import io
import json
import re
import subprocess
import unicodedata
from datetime import date, datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
from zoneinfo import ZoneInfo

try:
    from scripts.content_launch_decisions import decisions_from_document, load_decisions
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
    from content_launch_decisions import decisions_from_document, load_decisions
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
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v3-suwon-siheung-ansan-cheorwon-2026-10-14.md
    "kor/report/camp/ansan.html": {
        ("0d33716b6dd3e8f9c2f8036f437fb79a13d6eacf", "ed7356cd82ca5a73e54be996ee6e64428da531aa"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v3-suwon-siheung-ansan-cheorwon-2026-10-14.md
    "kor/report/camp/cheorwon.html": {
        ("d12c71cd0cdf1fe69cd290697ac92d3fb88e3b57", "7c85a60c9ea3cd772cec71e0628371f3c036ddca"),
    },
    # Preserve the earlier exact internal-link transition and record the separate fact correction.
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v2-pyeongtaek-gyeonggi-2026-10-14.md
    "kor/report/camp/pyeongtaek.html": {
        ("4d95593169e466447ee355429d2822764ca7e1a5", "b4fc13119f1e8cd01d78805d06ee981ac6834236"),
        ("3fd0e1959b4302b3209d4efc37b872c97aded91e", "0fd88c06441a246aa87ddeb72ba29a5f5fb4d5c1"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v2-pyeongtaek-gyeonggi-2026-10-14.md
    "kor/report/camp/gyeonggi-best.html": {
        ("1166dbea157c13f7664c12055d9b5aabb65edb27", "218dd0469056c432b1dcfccbab54d4dbf38c1769"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v3-suwon-siheung-ansan-cheorwon-2026-10-14.md
    "kor/report/camp/siheung.html": {
        ("0560afa99bee22a561ba52fe156ef68a1e34ffe9", "356dc2a0c9925a5d98b491764f82af181e12a607"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v3-suwon-siheung-ansan-cheorwon-2026-10-14.md
    "kor/report/camp/suwon.html": {
        ("ede5c9273cdacf710908bdc0252e6e99ea404389", "c965b510a9044b50ffaf5b3a9d3a2267157a30e6"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v4-top20-goyang-jinju-nonsan-2026-10-14.md
    "kor/report/camp/jinju.html": {
        ("6cf50dd713dda4d144d1749fa748b9726f7b5427", "bc2da49e0032ec84f458b6fa01ecc51f8bacac9d"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v4-top20-goyang-jinju-nonsan-2026-10-14.md
    "kor/report/camp/nonsan.html": {
        ("2f93f3c4abdf9b77d93d70424d805693481189b9", "a4a84d3175068107255d0661f1a6fc5edefce8bd"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v4-top20-goyang-jinju-nonsan-2026-10-14.md
    "kor/report/camp/goyang.html": {
        ("08b645d8f3a014fb9e4eaf5e3fd1b98ea9375977", "9825bef7a105c317d2e8ef6864d09f39cb98effa"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v4-top20-goyang-jinju-nonsan-2026-10-14.md
    "kor/report/camp/free-camping-top20.html": {
        ("d1c1bb873396962201feb6c19611453abec93190", "9e43505ea55269bd15b40203ac8d87ba2182168c"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v5-paju-boryeong-iksan-sejong-2026-10-14.md
    "kor/report/camp/sejong.html": {
        ("d8b89c2137a5d61b261b8c0c512df84ed127ecbd", "88683b5569912dd2a7cb07c1002dcec1da05c838"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v5-paju-boryeong-iksan-sejong-2026-10-14.md
    "kor/report/camp/paju.html": {
        ("29a9cfca373bd008396d7450ea4dad2bd4da09f6", "6d1f2a222f150c88a00b3ad3bafc1213761a8fe6"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v5-paju-boryeong-iksan-sejong-2026-10-14.md
    "kor/report/camp/boryeong.html": {
        ("bfbe722f3545e3f3d1aebe35cc1cfd5c9a807b68", "8049f09e81190d4cb87d086a80dccb6bb664b938"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v5-paju-boryeong-iksan-sejong-2026-10-14.md
    "kor/report/camp/iksan.html": {
        ("e145697177cdc049889db9dfdb356cad63a358fc", "46bc4a8bb456cf19d6fdf8a13ec04ce6cf84bdbc"),
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
    "data/content-launch-experiment-approvals.json",
)
EXPERIMENT_APPROVAL_JSON_PATH = "data/content-launch-experiment-approvals.json"
C02_034_EXPERIMENT = {
    "taskId": "C01-20261011-032",
    "candidateId": "C01-20261011-032-IPHONEDATE",
    "url": "/kor/report/window/iphone-photos-date-taken.html",
    "canonicalUrl": "https://emfls.github.io/kor/report/window/iphone-photos-date-taken.html",
    "contentPath": "kor/report/window/iphone-photos-date-taken.html",
    "hubPath": "kor/report/window/index.html",
    "sitemapPath": "kor/report/window/sitemap.xml",
    "title": "아이폰 사진 촬영일, 윈도우에서 확인하는 방법",
    "primaryIntent": "윈도우에서 아이폰 사진의 촬영일을 확인하고 전송 문제를 진단",
    "experimentScope": "ONE_PAGE",
    "demandStatus": "VOLUME_UNKNOWN",
    "approvalId": "C02-20261011-034-IPHONE-001",
    "approvalStatus": "CT_SCOPED_EXPERIMENT_REVIEW_ONLY",
    "approvalBasis": "STANDING_AUTHORIZATION_NARROWED_TO_THIS_TASK",
    "approvalRefs": (
        "https://app.notion.com/p/3f6db4c0a9918175b79bcbe85fabfbdd",
        "https://app.notion.com/p/3f6db4c0a99181dc8227d7fde28b740a",
    ),
    "sourceReviewRef": "https://app.notion.com/p/3f6db4c0a991818ebc3cccfddb68a3c7",
    "officialSourceUrls": frozenset({
        "https://support.apple.com/ko-kr/120267",
        "https://support.apple.com/ko-kr/116944",
        "https://support.microsoft.com/en-us/windows/apps/photos/import-photos-and-videos-from-phone-to-pc",
        "https://learn.microsoft.com/en-us/windows/win32/properties/props-system-photo-datetaken",
        "https://cipa.jp/std/documents/e/DC-X010-2017.pdf",
    }),
}
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
        result = subprocess.run(
            ["git", "show", f"{resolved}:{relative}"],
            cwd=str(root), text=True, capture_output=True, check=False,
        )
        if result.returncode != 0:
            if relative == EXPERIMENT_APPROVAL_JSON_PATH:
                snapshot["json"][relative] = None
                continue
            raise subprocess.CalledProcessError(result.returncode, result.args, result.stdout, result.stderr)
        snapshot["json"][relative] = json.loads(result.stdout)
    for relative in TRUSTED_BASE_CSV_PATHS:
        raw = subprocess.run(
            ["git", "show", f"{resolved}:{relative}"],
            cwd=str(root), text=True, capture_output=True, check=True,
        ).stdout
        snapshot["csv"][relative] = list(csv.DictReader(io.StringIO(raw)))
    return snapshot


def _decision_map(document):
    return decisions_from_document(document)


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


class _PageTitleParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_title = False
        self.in_h1 = False
        self.title_parts = []
        self.h1_parts = []

    def handle_starttag(self, tag, attrs):
        if tag.casefold() == "title":
            self.in_title = True
        elif tag.casefold() == "h1":
            self.in_h1 = True

    def handle_endtag(self, tag):
        if tag.casefold() == "title":
            self.in_title = False
        elif tag.casefold() == "h1":
            self.in_h1 = False

    def handle_data(self, data):
        if self.in_title:
            self.title_parts.append(data)
        if self.in_h1:
            self.h1_parts.append(data)

    @property
    def title(self):
        return " ".join("".join(self.title_parts).split())

    @property
    def h1(self):
        return " ".join("".join(self.h1_parts).split())


def _validated_c02_034_approval(snapshot):
    document = snapshot.get("json", {}).get(EXPERIMENT_APPROVAL_JSON_PATH)
    if not isinstance(document, dict) or document.get("schemaVersion") != 1:
        return None, "missing_or_invalid"
    rows = document.get("approvals")
    if not isinstance(rows, list) or len(rows) != 1 or not isinstance(rows[0], dict):
        return None, "ambiguous_or_invalid"
    record = rows[0]
    expected = C02_034_EXPERIMENT
    for key in (
        "approvalId", "taskId", "candidateId", "url", "canonicalUrl", "contentPath",
        "hubPath", "sitemapPath", "title", "primaryIntent", "experimentScope",
        "demandStatus", "approvalStatus",
        "approvalBasis",
    ):
        if record.get(key) != expected[key]:
            return None, "identity_or_scope_mismatch"
    if record.get("approvalVersion") != 1 or record.get("revoked") is not False:
        return None, "version_or_revocation_invalid"
    if record.get("ymyl") not in (False, True) or type(record.get("ymyl")) is not bool:
        return None, "ymyl_flag_invalid"
    refs = record.get("approvalRefs")
    if (
        not isinstance(refs, list)
        or len(refs) != len(expected["approvalRefs"])
        or any(not isinstance(value, str) for value in refs)
    ):
        return None, "approval_refs_invalid"
    if set(refs) != set(expected["approvalRefs"]):
        return None, "approval_refs_invalid"
    try:
        valid_from = date.fromisoformat(record.get("validFrom"))
        valid_through = date.fromisoformat(record.get("validThrough"))
        today = datetime.now(SEOUL).date()
    except (TypeError, ValueError):
        return None, "approval_dates_invalid"
    if not (valid_from <= today <= valid_through) or (valid_through - valid_from).days > 7:
        return None, "approval_expired_or_stale"

    review = record.get("sourceReview")
    if not isinstance(review, dict) or not (
        review.get("status") == "REPORTED_REVIEWED_BY_C01"
        and review.get("reviewedByTask") == expected["taskId"]
        and review.get("recordRef") == expected["sourceReviewRef"]
    ):
        return None, "source_review_unavailable"
    try:
        reviewed_at = date.fromisoformat(review.get("reviewedAt"))
    except (TypeError, ValueError):
        return None, "source_review_date_invalid"
    if not (valid_from <= reviewed_at <= today):
        return None, "source_review_date_invalid"
    source_rows = review.get("sources")
    if not isinstance(source_rows, list) or len(source_rows) != len(expected["officialSourceUrls"]):
        return None, "official_sources_unavailable"
    if any(
        not isinstance(source, dict) or not isinstance(source.get("supports"), str)
        or not source["supports"].strip() or not isinstance(source.get("url"), str)
        for source in source_rows
    ) or {source.get("url") for source in source_rows} != set(expected["officialSourceUrls"]):
        return None, "official_sources_unavailable"
    if any(key in record for key in (
        "monthlySearchVolume", "estimatedMonthlyVolume", "demandConfidence", "opportunityScore",
    )):
        return None, "unsupported_demand_claim"
    return record, None


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

    expected = C02_034_EXPERIMENT
    experiment_approval, experiment_approval_issue = _validated_c02_034_approval(snapshot)
    if experiment_approval is not None:
        candidate_id = expected["candidateId"]
        intent_key = normalize_keyword(expected["primaryIntent"])
        candidate_key = normalize_keyword(candidate_id)
        records.append({
            "candidateId": candidate_id,
            "keyword": expected["primaryIntent"],
            "editorialKeys": list(dict.fromkeys(key for key in (intent_key, candidate_key) if key)),
            "approvalKey": None,
            "ymyl": experiment_approval["ymyl"] or requires_ymyl_review({"keyword": expected["primaryIntent"]}),
            "url": expected["url"],
            "urlIdentity": _normalized_launch_url(expected["url"]),
            "contentPath": expected["contentPath"],
            "title": expected["title"],
            "primaryIntent": expected["primaryIntent"],
            "approval": experiment_approval,
            "source": "controlled_experiment",
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
        "experimentApprovalIssue": experiment_approval_issue,
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
    published_external_ids = set()
    preserved_manifests = manifest.get("preservedManifestRecords", [])
    if not isinstance(preserved_manifests, list) or any(not isinstance(row, dict) for row in preserved_manifests):
        raise ValueError("invalid preserved publication manifest records")
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
    for previous in preserved_manifests:
        previous_urls = previous.get("urls") or []
        previous_ids = previous.get("candidateIds") or []
        previous_paths = previous.get("contentPaths") or []
        if not all(isinstance(values, list) for values in (previous_urls, previous_ids, previous_paths)):
            raise ValueError("invalid preserved publication manifest identities")
        for value in previous_urls:
            identity = _normalized_launch_url(value)
            if identity is None:
                raise ValueError("invalid preserved publication manifest URL")
            manifest_urls.add(identity)
        for value in previous_ids:
            if not isinstance(value, str) or not value.strip():
                raise ValueError("invalid preserved publication candidate ID")
            keyword = keyword_from_candidate_id(value)
            if keyword:
                published_keywords_set.add(keyword)
            else:
                published_external_ids.add(value)
    published_urls.update(manifest_urls)
    published_keywords_set.update(manifest_keywords)
    published_external_ids.update({
        str(value) for value in (manifest.get("candidateIds") or [])
        if str(manifest.get("status") or "").upper() in {"PUBLISHED", "LAUNCHED"}
        and isinstance(value, str) and value.strip() and not keyword_from_candidate_id(value)
    })
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
    if not isinstance(manifest, dict):
        raise ValueError("invalid published content launch manifest")
    history = manifest.get("preservedManifestRecords", [])
    if not isinstance(history, list) or any(not isinstance(row, dict) for row in history):
        raise ValueError("invalid preserved publication manifest records")
    historical_counts = []
    for row in history:
        if publication_day(row.get("runAt") or row.get("publicationAccountingDate")) == day:
            historical_counts.append(max(
                len(row.get("candidateIds") or []),
                len(row.get("urls") or []),
                len(row.get("contentPaths") or []),
                int(row.get("publishedToday") or 0),
            ))
    if historical_counts:
        counts.append(sum(historical_counts))
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
    if base_decisions != head_decisions:
        errors.add("EDITORIAL_DECISION_TAMPERING")
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

    experiment = C02_034_EXPERIMENT
    if experiment["candidateId"] in candidate_ids:
        if not (
            candidate_ids == [experiment["candidateId"]]
            and urls == [experiment["url"]]
            and paths == [experiment["contentPath"]]
            and added_html == {experiment["contentPath"]}
            and manifest.get("taskId") == experiment["taskId"]
            and manifest.get("experimentScope") == experiment["experimentScope"]
            and manifest.get("demandStatus") == experiment["demandStatus"]
            and manifest.get("status") == "READY_FOR_REVIEW"
            and manifest.get("candidateIntents") == [experiment["primaryIntent"]]
            and manifest.get("candidateTitles") == [experiment["title"]]
            and manifest.get("hubPaths") == [experiment["hubPath"]]
            and manifest.get("sitemapPaths") == [experiment["sitemapPath"]]
        ):
            errors.add("CANDIDATE_IDENTITY_MISMATCH")
        if daily_limit != 1:
            errors.add("PUBLICATION_LIMIT_EXCEEDED")
        base_manifest = snapshot["json"].get("data/content-launch-manifest.json") or {}
        if not isinstance(base_manifest, dict):
            errors.add("PUBLISHED_MANIFEST_HISTORY_DROPPED")
        else:
            base_history = base_manifest.get("preservedManifestRecords", [])
            if not isinstance(base_history, list):
                errors.add("PUBLISHED_MANIFEST_HISTORY_DROPPED")
            else:
                required_history = list(base_history)
                if any(base_manifest.get(key) for key in ("candidateIds", "urls", "contentPaths")):
                    required_history.append(base_manifest)
                head_history = manifest.get("preservedManifestRecords", [])
                if head_history != required_history:
                    errors.add("PUBLISHED_MANIFEST_HISTORY_DROPPED")

    for candidate_id, url, content_path in zip(candidate_ids, urls, paths):
        if not isinstance(candidate_id, str) or not candidate_id.strip():
            errors.add("LAUNCH_CANDIDATE_IDS_REQUIRED")
            errors.add("CANDIDATE_IDENTITY_MISMATCH")
            continue
        matches = sources["byId"].get(candidate_id, [])
        if (
            candidate_id == experiment["candidateId"]
            and sources.get("experimentApprovalIssue") is not None
        ):
            errors.add("APPROVAL_EVIDENCE_UNAVAILABLE")
            if sources["experimentApprovalIssue"] == "ambiguous_or_invalid":
                errors.add("AMBIGUOUS_TRUSTED_CANDIDATE")
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
        if source["source"] == "controlled_experiment" and source["ymyl"]:
            errors.add("YMYL_REVIEW_REQUIRED")
        for identity in editorial_keys:
            base_decision = base_decisions.get(identity)
            if base_decision in {"HOLD", "NO_NEW_PAGE", "UPDATE_EXISTING"}:
                errors.add("EDITORIAL_DECISION_BLOCKED")
            if source["ymyl"] and identity == source.get("approvalKey", identity) and base_decision != "APPROVE":
                errors.add("YMYL_REVIEW_REQUIRED")

        page_path = root / manifest_path
        try:
            page_path.resolve().relative_to(root.resolve())
            if page_path.is_symlink():
                raise ValueError("content path must not be a symlink")
            html = page_path.read_text(encoding="utf-8")
            parser = _CanonicalLinkParser()
            parser.feed(html)
            title_parser = _PageTitleParser()
            title_parser.feed(html)
        except (OSError, ValueError):
            errors.add("CANDIDATE_IDENTITY_MISMATCH")
            continue
        if (
            len(parser.hrefs) != 1
            or _normalized_launch_url(parser.hrefs[0], require_absolute=True) != url_identity
        ):
            errors.add("CANONICAL_MISMATCH")
        if source["source"] == "controlled_experiment" and (
            title_parser.title != source["title"] or title_parser.h1 != source["title"]
        ):
            errors.add("CANDIDATE_IDENTITY_MISMATCH")


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
    if launch_changed and EXPERIMENT_APPROVAL_JSON_PATH in changed_names:
        errors.add("APPROVAL_EVIDENCE_CHANGED_WITH_CONTENT")
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
