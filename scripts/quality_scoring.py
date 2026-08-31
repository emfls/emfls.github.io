#!/usr/bin/env python3
"""Deterministic evidence and page-quality scoring primitives."""

EVIDENCE_STATUSES = {
    "VERIFIED",
    "ESTIMATED",
    "NOT_CONNECTED",
    "MANUAL_REVIEW_REQUIRED",
}
PAGE_TYPES = {"TRAFFIC", "MONEY", "HUB", "TOOL", "TRUST", "UTILITY"}


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
