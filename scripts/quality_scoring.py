#!/usr/bin/env python3
"""Deterministic evidence and page-quality scoring primitives."""

import re
from urllib.parse import urlparse

EVIDENCE_STATUSES = {
    "VERIFIED",
    "ESTIMATED",
    "NOT_CONNECTED",
    "MANUAL_REVIEW_REQUIRED",
}
PAGE_TYPES = {"TRAFFIC", "MONEY", "HUB", "TOOL", "TRUST", "UTILITY"}
CATEGORY_MAX = {
    "searchIntent": 20,
    "contentValue": 20,
    "seo": 10,
    "trust": 15,
    "ux": 10,
    "internalLinks": 10,
    "monetization": 5,
    "technical": 10,
}
CLICKBAIT_RE = re.compile(r"(충격|소름|무조건|반드시 클릭|놀라운|secret trick|you won't believe)", re.I)
NUMBER_RE = re.compile(r"\d")

RECOMMENDATIONS = {
    "missing_description": "Add a unique meta description summarizing the page answer, inputs, and limitation in 120–160 characters.",
    "finance_without_sources": "Add dated links to primary financial sources and explain which figures and calculations use each source.",
    "missing_sources": "Add at least one relevant primary source link and identify the claim it supports.",
    "missing_freshness": "Display a verified update date and record the next review interval.",
    "few_internal_links": "Add three contextual links to a useful parent guide, a related detail page, and the next practical action.",
    "missing_breadcrumb": "Add a visible breadcrumb and matching BreadcrumbList structured data.",
    "thin_content": "Add a direct answer plus concrete examples, limitations, and the next decision a search visitor needs.",
    "missing_structured_data": "Add only the structured data type that matches content visibly present on the page.",
    "not_in_sitemap": "Include the canonical indexable URL in the appropriate sitemap segment.",
    "h1_not_one": "Keep exactly one descriptive H1 aligned with the page title and primary search intent.",
    "missing_method": "Explain how calculations, comparisons, or recommendations were produced and where they can be wrong.",
}


def evidence(value, status, reasons=()):
    if status not in EVIDENCE_STATUSES:
        raise ValueError(f"invalid evidence status: {status}")
    return {"value": value, "status": status, "reasons": list(reasons)}


def classify_page(page, metadata):
    explicit = str(metadata.get("page_type") or "").upper()
    if explicit:
        if explicit not in PAGE_TYPES:
            raise ValueError(f"invalid page type: {explicit}")
        return explicit

    path = str(page.get("path") or "").lower()
    category = str(page.get("category") or "").lower()
    schema_types = set(page.get("structured_data_types") or [])

    if any(name in path for name in ("privacy", "terms", "disclaimer", "about", "contact", "methodology")):
        return "TRUST"
    if category == "util" and ("WebApplication" in schema_types or "calculator" in path):
        return "TOOL"
    if category in {"stockwiki", "finance"} or any(
        word in path for word in ("stock", "etf", "tax", "loan", "insurance")
    ):
        return "MONEY"
    if path.endswith("index.html") and int(page.get("internal_links") or 0) >= 12:
        return "HUB"
    if category in {"game", "root"}:
        return "UTILITY"
    return "TRAFFIC"


def grade_for(score):
    score = int(score)
    if score >= 90:
        return "S"
    if score >= 80:
        return "A"
    if score >= 70:
        return "B"
    if score >= 60:
        return "C"
    if score >= 50:
        return "D"
    return "F"


def status_for(score):
    score = int(score)
    if score >= 90:
        return "CORE"
    if score >= 80:
        return "GOOD"
    if score >= 70:
        return "PUBLISHABLE"
    if score >= 60:
        return "NEEDS_WORK"
    return "FAIL"


def _category(score, maximum, checks):
    return {"score": min(int(score), maximum), "max": maximum, "checks": checks}


def _check(code, passed, points, status="VERIFIED"):
    return {"code": code, "passed": bool(passed), "points": points if passed else 0, "status": status}


def _sum(checks):
    return sum(item["points"] for item in checks)


def _meaningful_slug(path):
    stem = str(path or "").lower().replace("/index.html", "").rsplit("/", 1)[-1]
    return bool(stem and stem not in {"index", "page", "post", "article"} and len(stem) >= 3)


def _score_search_intent(page, metadata):
    title = str(page.get("title") or "")
    prefix = str(page.get("visible_text_prefix") or "")
    checks = [
        _check("clear_title", bool(title), 3),
        _check("single_h1", page.get("h1_count") == 1, 3),
        _check("target_query_defined", bool(metadata.get("target_query") or metadata.get("topics")), 3, "ESTIMATED"),
        _check("follow_up_sections", int(page.get("h2_count") or 0) >= 3, 3, "ESTIMATED"),
        _check("substantive_answer", int(page.get("word_count") or 0) >= 400, 3, "ESTIMATED"),
        _check("answer_visible_early", len(prefix.split()) >= 20, 3, "ESTIMATED"),
        _check("non_clickbait_title", not CLICKBAIT_RE.search(title), 2, "ESTIMATED"),
    ]
    return _category(_sum(checks), 20, checks)


def _score_content_value(page, context):
    words = int(page.get("word_count") or 0)
    prefix = str(page.get("visible_text_prefix") or "")
    has_own_value = bool(page.get("has_table") or page.get("has_form") or page.get("interactive_controls"))
    checks = [
        _check("not_known_duplicate", page.get("url") not in context.get("severe_duplicate_urls", set()), 4, "ESTIMATED"),
        _check("own_data_or_tool", has_own_value, 4, "ESTIMATED"),
        _check("numeric_example", bool(NUMBER_RE.search(prefix)) or has_own_value, 3, "ESTIMATED"),
        _check("beyond_summary", int(page.get("h2_count") or 0) >= 3 and words >= 600, 4, "ESTIMATED"),
        _check("adequate_depth", words >= 800, 3, "ESTIMATED"),
        _check("not_artificially_bloated", 250 <= words <= 4000, 2, "ESTIMATED"),
    ]
    return _category(_sum(checks), 20, checks)


def _score_seo(page, metadata, context):
    url = page.get("url")
    images = int(page.get("images") or 0)
    alt_missing = int(page.get("image_alt_missing") or 0)
    title = str(page.get("title") or "")
    checks = [
        _check("unique_title", bool(title) and url not in context.get("duplicate_title_urls", set()), 2),
        _check("single_h1", page.get("h1_count") == 1, 2),
        _check("natural_keyword", bool(metadata.get("target_query") or title), 1, "ESTIMATED"),
        _check("unique_description", bool(page.get("description")) and url not in context.get("duplicate_description_urls", set()), 1),
        _check("heading_structure", int(page.get("h2_count") or 0) >= 1, 1),
        _check("meaningful_url", _meaningful_slug(page.get("path")), 1, "ESTIMATED"),
        _check("image_alt", images == 0 or alt_missing == 0, 1),
        _check("non_clickbait_title", not CLICKBAIT_RE.search(title), 1, "ESTIMATED"),
    ]
    return _category(_sum(checks), 10, checks)


def _score_trust(page, metadata, page_type):
    sources = metadata.get("sources") or []
    has_date = bool(metadata.get("last_verified") or metadata.get("updated") or page.get("updated_date"))
    editorial_sources_required = page_type in {"MONEY", "TRAFFIC", "HUB"}
    checks = [
        _check("reference_links", not editorial_sources_required or int(page.get("external_links") or 0) > 0, 3),
        _check("freshness_date", has_date, 2),
        _check("author_or_operator", bool(page.get("has_author_signal")), 2, "ESTIMATED"),
        _check("method_explained", bool(page.get("has_method_signal")), 2, "ESTIMATED"),
        _check("limitations_explained", bool(page.get("has_limitation_signal")), 2, "ESTIMATED"),
        _check("curated_primary_sources", not editorial_sources_required or bool(sources), 2),
        _check("about_or_methodology_link", bool(page.get("has_about_methodology_link")), 2),
    ]
    return _category(_sum(checks), 15, checks)


def _score_ux(page, context):
    url = page.get("url")
    has_table = bool(page.get("has_table"))
    checks = [
        _check("mobile_viewport", bool(page.get("has_viewport")), 2),
        _check("core_content_visible", bool(page.get("visible_text_prefix")), 2, "ESTIMATED"),
        _check("ad_content_separation", url not in context.get("ad_ux_warning_urls", set()), 2, "ESTIMATED"),
        _check("readable_typography", bool(page.get("has_viewport")), 1, "ESTIMATED"),
        _check("responsive_tables", not has_table or bool(page.get("has_table_overflow")), 1, "ESTIMATED"),
        _check("no_intrusive_popup", not bool(page.get("has_intrusive_popup")), 1, "ESTIMATED"),
        _check("navigation_present", int(page.get("internal_links") or 0) > 0, 1),
    ]
    return _category(_sum(checks), 10, checks)


def _score_internal_links(page, page_type, context):
    url = page.get("url")
    links = int(page.get("internal_links") or 0)
    inbound = int(context.get("inbound_links", {}).get(url, 0))
    if page_type == "TRUST":
        checks = [
            _check("site_navigation", links >= 1, 4),
            _check("reachable_from_site", inbound >= 1, 4),
            _check("trust_context_links", bool(page.get("has_about_methodology_link")) or links >= 1, 2),
        ]
    else:
        checks = [
            _check("three_related_links", links >= 3, 3, "ESTIMATED"),
            _check("contextual_links", links >= 1, 2, "ESTIMATED"),
            _check("parent_hub_link", bool(page.get("has_parent_hub_link")) or links >= 1, 1, "ESTIMATED"),
            _check("related_section", bool(page.get("has_related_section")), 1),
            _check("not_orphan", inbound >= 1, 2),
            _check("breadcrumb", bool(page.get("has_breadcrumb")), 1),
        ]
    return _category(_sum(checks), 10, checks)


def _score_monetization(page, page_type, context):
    url = page.get("url")
    words = int(page.get("word_count") or 0)
    checks = [
        _check("substantive_content", words >= 250 or page_type == "TOOL", 1, "ESTIMATED"),
        _check("clear_ad_separation", url not in context.get("ad_ux_warning_urls", set()), 1, "ESTIMATED"),
        _check("ads_do_not_dominate", words >= 250 or not page.get("adsense"), 1, "ESTIMATED"),
        _check("advertiser_demand_possible", page_type in {"MONEY", "TOOL", "TRAFFIC"}, 1, "ESTIMATED"),
        _check("content_first", words >= 250 or bool(page.get("has_form")), 1, "ESTIMATED"),
    ]
    return _category(_sum(checks), 5, checks)


def _score_technical(page, context):
    url = page.get("url")
    canonical = str(page.get("canonical") or "")
    checks = [
        _check("indexable", bool(page.get("indexable")), 1),
        _check("in_sitemap", url in context.get("sitemap_urls", set()), 1),
        _check("self_canonical", bool(canonical) and urlparse(canonical).path.rstrip("/") == str(url).rstrip("/"), 2),
        _check("https_canonical", canonical.startswith("https://"), 1),
        _check("robots_accessible", bool(context.get("robots_ok", True)), 1),
        _check("no_broken_internal_links", url not in context.get("broken_link_sources", set()), 1),
        _check("structured_data", bool(page.get("structured_data_types")), 1),
        _check("visible_content", int(page.get("word_count") or 0) > 0, 1),
        _check("unique_canonical", url not in context.get("duplicate_canonical_urls", set()), 1),
    ]
    return _category(_sum(checks), 10, checks)


def _issue_codes(scores, page_type):
    issues = []
    for category in scores.values():
        for check in category["checks"]:
            if not check["passed"]:
                issues.append(check["code"])
    if page_type != "TRUST" and scores["internalLinks"]["checks"][0]["passed"] is False:
        issues.append("fewer_than_three_related_pages")
    aliases = {
        "unique_description": "missing_description",
        "freshness_date": "missing_freshness",
        "reference_links": "missing_sources",
        "curated_primary_sources": "missing_sources",
        "method_explained": "missing_method",
        "three_related_links": "few_internal_links",
        "breadcrumb": "missing_breadcrumb",
        "adequate_depth": "thin_content",
        "structured_data": "missing_structured_data",
        "in_sitemap": "not_in_sitemap",
        "single_h1": "h1_not_one",
    }
    return sorted({aliases.get(code, code) for code in issues})


def score_page(page, metadata, context):
    page_type = classify_page(page, metadata)
    scores = {
        "searchIntent": _score_search_intent(page, metadata),
        "contentValue": _score_content_value(page, context),
        "seo": _score_seo(page, metadata, context),
        "trust": _score_trust(page, metadata, page_type),
        "ux": _score_ux(page, context),
        "internalLinks": _score_internal_links(page, page_type, context),
        "monetization": _score_monetization(page, page_type, context),
        "technical": _score_technical(page, context),
    }
    raw_score = sum(category["score"] for category in scores.values())
    caps = []
    if page_type == "MONEY" and not metadata.get("sources"):
        caps.append({
            "code": "finance_without_sources",
            "max_score": 55,
            "status": "VERIFIED",
            "evidence": "No curated sources are recorded for a finance page.",
        })
    if page.get("url") in context.get("severe_duplicate_urls", set()):
        caps.append({
            "code": "severe_duplicate_document",
            "max_score": 50,
            "status": "VERIFIED",
            "evidence": "The URL is in the confirmed severe duplicate set.",
        })
    if not page.get("title") and int(page.get("word_count") or 0) < 100:
        caps.append({
            "code": "unclear_page_purpose",
            "max_score": 60,
            "status": "VERIFIED",
            "evidence": "The page has no title and fewer than 100 visible words.",
        })
    caps.sort(key=lambda item: (item["max_score"], item["code"]))
    cap_candidates = []
    if context.get("duplicate_body_candidate") or page.get("url") in context.get("duplicate_body_candidate_urls", set()):
        cap_candidates.append({
            "code": "possible_ai_or_template_copy",
            "max_score": 40,
            "status": "MANUAL_REVIEW_REQUIRED",
            "evidence": "Static similarity signals require a human originality review.",
        })
    score = min([raw_score] + [cap["max_score"] for cap in caps])
    issues = _issue_codes(scores, page_type)
    if any(cap["code"] == "finance_without_sources" for cap in caps):
        issues.append("finance_without_sources")
    issues = sorted(set(issues))
    recommendations = [RECOMMENDATIONS[code] for code in issues if code in RECOMMENDATIONS]
    strengths = sorted(
        check["code"]
        for category in scores.values()
        for check in category["checks"]
        if check["passed"]
    )
    return {
        "url": page.get("url"),
        "type": page_type,
        "raw_score": raw_score,
        "score": score,
        "grade": grade_for(score),
        "status": status_for(score),
        "scores": scores,
        "caps": caps,
        "cap_candidates": cap_candidates,
        "issues": issues,
        "strengths": strengths,
        "recommendations": recommendations,
    }
