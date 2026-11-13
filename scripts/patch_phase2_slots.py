#!/usr/bin/env python3
"""Patch only reviewed Phase2 calculator anchors and ten-place camping grids."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

try:
    from scripts.patch_adsense_slots import _Spans, ad_slot, build_patch_protection
    from scripts.content_launch_guard import _trusted_base_snapshot, _url_to_content_path
except ModuleNotFoundError:
    from patch_adsense_slots import _Spans, ad_slot, build_patch_protection
    from content_launch_guard import _trusted_base_snapshot, _url_to_content_path

BRANCH = "feature/adsense-phase2-calculators-camp"
LOADER = ('\n<!-- EMFLS_PHASE2_LOADER -->\n'
          '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8830524482034754" crossorigin="anonymous"></script>\n'
          '<!-- /EMFLS_PHASE2_LOADER -->\n')

# (ATF attribute, value, explicitly first match, result attribute, value).
CALCULATORS = {
    "kor/util/overseas-stock-tax-calculator/index.html": ("aria-labelledby", "calculator-heading", False, "id", "result"),
    "kor/util/retirement-pension-withdrawal/index.html": ("aria-labelledby", "calculator-title", False, "class", "results"),
    "kor/util/water-purifier-rental-price-comparison/index.html": ("aria-labelledby", "calculator-title", False, "id", "result"),
    "kor/util/car-inspection-cost/index.html": ("aria-labelledby", "lookup-title", False, "id", "result"),
    "kor/util/road-trip-cost-calculator/index.html": ("aria-labelledby", "calculator-title", False, "id", "result"),
    "kor/util/camping-packing-checklist/index.html": ("class", "panel", True, "id", "list"),
    "kor/util/date-calculator/index.html": ("class", "tabs", False, "id", "weekdays"),
    "kor/util/fin-calc/index.html": ("class", "tab-row", False, "id", "instForm"),
    "util/break-even-calculator/index.html": ("id", "form", False, "id", "result"),
    "util/age/index.html": ("autocomplete", "off", False, "autocomplete", "off"),
}
CAMP_PAGES = {
    "kor/report/camp/autocamping-best.html": ("items-grid", "item-card"),
    "kor/report/camp/backpacking-best.html": ("items-grid", "item-card"),
    **{f"kor/report/camp/{name}.html": ("spots-grid", "spot-card") for name in (
        "jeonnam-best", "gyeongbuk-camping-best", "autumn-camping-top10", "valley-camping-top10",
        "jeju-camping-best", "jeonbuk-camping-best", "gyeonggi-best", "chungcheong-camping-best", "gyeongnam-best")},
    **{f"kor/report/camp/{name}.html": ("camping-grid", "camping-card") for name in (
        "yangyang", "hongcheon", "gwangmyeong", "pohang", "anseong", "ansan", "hoengseong")},
}


class Boundaries(_Spans):
    """Reuse non-rewriting offsets while tracking forms and changing results."""
    VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

    def handle_starttag(self, tag, attrs):
        if tag in self.VOID_TAGS:
            return
        ancestor_attrs = tuple(n["attrs"] for n in self.stack)
        ancestor_tags = tuple(n["html_tag"] for n in self.stack)
        super().handle_starttag("div", attrs)
        self.stack[-1].update(html_tag=tag, attrs=dict(attrs), ancestor_attrs=ancestor_attrs, ancestor_tags=ancestor_tags)

    def handle_endtag(self, tag):
        if tag in self.VOID_TAGS:
            return
        if self.stack and self.stack[-1]["html_tag"] != tag:
            raise ValueError("Unbalanced Phase2 container")
        super().handle_endtag("div")


def _find(nodes, attr, value, first=False):
    matches = sorted((n for n in nodes if (value in n["classes"] if attr == "class" else n["attrs"].get(attr) == value)), key=lambda n: n["start"])
    if not matches or (not first and len(matches) != 1):
        raise ValueError("Ambiguous Phase2 anchor")
    return matches[0]


def _safe_boundary(node):
    return "form" not in node["ancestor_tags"] and not any(
        "aria-live" in a or a.get("role") == "tabpanel" or "hidden" in a
        or a.get("aria-hidden") == "true" or re.search(r"(?:display\s*:\s*none|visibility\s*:\s*hidden)", a.get("style", ""), re.I)
        for a in node["ancestor_attrs"])


def _slot(marker, kind="display", result=False):
    code = ad_slot(marker, 250, kind)
    code = code.replace('class="emfls-ad-slot"', 'class="emfls-ad-slot emfls-phase2"')
    if kind == "feed":
        code = code.replace('text-align:center;clear:both', 'text-align:center;clear:both;background:#fff;border-radius:13px;padding:20px 6px;box-shadow:0 5px 18px rgba(0,0,0,.08);border-top:4px solid #3949ab')
    else:
        code = code.replace("margin:24px 0", "margin:48px 0")
        if result:
            code = code.replace("max-width:100%", "max-width:300px")
    return code + f"<!-- /{marker} -->\n"


def remove_additions(source):
    for marker in ("EMFLS_PHASE2_ATF_SLOT", "EMFLS_PHASE2_RESULT_SLOT", "EMFLS_PHASE2_LOADER", "[EMFLS_AUTO_CAMP_INFEED]"):
        source = re.sub(r"\n<!-- " + re.escape(marker) + r" -->\n.*?<!-- /" + re.escape(marker) + r" -->\n", "", source, flags=re.S)
    return source


def patch_page(path, source):
    if path not in CALCULATORS and path not in CAMP_PAGES:
        return source, "OUT_OF_SCOPE_HOLD"
    markers = ["EMFLS_PHASE2_ATF_SLOT", "EMFLS_PHASE2_RESULT_SLOT"] if path in CALCULATORS else ["[EMFLS_AUTO_CAMP_INFEED]"]
    counts = [source.count(f"<!-- {m} -->") for m in markers]
    ends = [source.count(f"<!-- /{m} -->") for m in markers]
    if any(counts + ends):
        expected = [1, 1] if path in CALCULATORS else [2]
        return source, "ALREADY_PATCHED" if counts == ends == expected else "PARTIAL_MARKER_HOLD"
    if "EMFLS_PHASE2_" in source or "EMFLS_AUTO_FEED_" in source:
        return source, "CONFLICTING_MARKER_HOLD"
    try:
        spans = Boundaries(source)
        if spans.stack:
            raise ValueError("Unclosed Phase2 container")
        if path in CALCULATORS:
            attr, value, first, result_attr, result_value = CALCULATORS[path]
            atf = _find(spans.nodes, attr, value, first)
            result = _find(spans.nodes, result_attr, result_value)
            if atf["start"] >= result["end"] or not all(_safe_boundary(n) for n in (atf, result)):
                raise ValueError("Reversed Phase2 anchors")
            line_start = source.rfind("\n", 0, atf["start"]) + 1
            before = line_start if not source[line_start:atf["start"]].strip() else atf["start"]
            edits = [(before, _slot(markers[0])), (result["end"], _slot(markers[1], result=True))]
        else:
            grid, card = CAMP_PAGES[path]
            cards = sorted((n for n in spans.nodes if card in n["classes"] and any(grid in p for p in n["parents"])), key=lambda n: n["start"])
            if len(cards) != 10 or not all(_safe_boundary(cards[n - 1]) for n in (3, 7)):
                raise ValueError("Not a ten-place grid")
            edits = [(cards[n - 1]["end"], _slot(markers[0], "feed")) for n in (3, 7)]
        loaders = re.findall(r'<script\b[^>]*src=["\']https://pagead2\.googlesyndication\.com/pagead/js/adsbygoogle\.js[^"\']*["\'][^>]*>', source, re.I)
        if len(loaders) > 1 or (loaders and "ca-pub-8830524482034754" not in loaders[0]):
            return source, "LOADER_CONFLICT_HOLD"
        if not loaders:
            if source.lower().count("</head>") != 1:
                raise ValueError("Missing head boundary")
            edits.append((source.lower().index("</head>"), LOADER))
        for at, code in sorted(edits, reverse=True):
            source = source[:at] + code + source[at:]
    except (ValueError, KeyError):
        return source, "ANCHOR_HOLD"
    return source, "PATCHED"


def plan_pages(root, protection, write=False):
    if protection.get("status") != "VERIFIED" or protection.get("errors"):
        raise ValueError("Verified protection required")
    blocked = set(protection.get("phase2PinnedObserving", []))
    for key in ("experiments", "editorialDecisions", "ymyl", "launchQueue"):
        blocked.update(p.lstrip("/") for p in protection.get("routeSets", {}).get(key, []))
    rows = []
    for relative in list(CALCULATORS) + list(CAMP_PAGES):
        path = root / relative
        if path.is_symlink() or any(p.is_symlink() for p in path.parents if p != root):
            rows.append({"path": relative, "status": "SYMLINK_HOLD"})
            continue
        before = path.read_bytes()
        after, state = patch_page(relative, before.decode()) if relative not in blocked else (before.decode(), "PROTECTED_OBSERVING_OR_HOLD")
        after = after.encode()
        if write and after != before:
            temporary = None
            try:
                with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".phase2-", delete=False) as f:
                    temporary = Path(f.name)
                    f.write(after)
                temporary.chmod(path.stat().st_mode & 0o777)
                if path.is_symlink() or path.read_bytes() != before:
                    raise ValueError("Concurrent edit: " + relative)
                os.replace(temporary, path)
            finally:
                if temporary is not None and temporary.exists():
                    temporary.unlink()
        rows.append({"path": relative, "status": state, "before_sha256": hashlib.sha256(before).hexdigest(), "after_sha256": hashlib.sha256(after).hexdigest()})
    return rows


def apply_plan(root, protection):
    branch = subprocess.check_output(["git", "-C", str(root), "branch", "--show-current"], text=True).strip()
    if branch != BRANCH:
        raise ValueError("Apply requires the dedicated feature branch")
    return plan_pages(root, protection, write=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--ops-dir", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    root = args.root.resolve()
    protection = build_patch_protection(root, args.ops_dir)
    if protection.get("trustedPin"):
        documents = _trusted_base_snapshot(root, protection["trustedPin"])["json"]
        protection["phase2PinnedObserving"] = sorted(_url_to_content_path(x.get("url")) for x in documents["data/experiments.json"].get("experiments", []) if x.get("status") == "OBSERVING")
    rows = apply_plan(root, protection) if args.apply else plan_pages(root, protection)
    args.report.write_text(json.dumps({"applied": args.apply, "protection_status": protection["status"], "rows": rows}, ensure_ascii=False, indent=2) + "\n")
    from collections import Counter
    print(json.dumps(dict(Counter(row["status"] for row in rows))))
    return int(any(row["status"].endswith("HOLD") for row in rows))


if __name__ == "__main__":
    raise SystemExit(main())
