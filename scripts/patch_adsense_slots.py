#!/usr/bin/env python3
"""Plan/apply column slots with the existing fail-closed protection report."""
from __future__ import annotations

import argparse
import hashlib
from html.parser import HTMLParser
import json
import os
import tempfile
from pathlib import Path
import subprocess

CLIENT = "ca-pub-8830524482034754"
DISPLAY_SLOT = "6016035748"
ARTICLE_SLOT = "3423411629"


def ad_slot(marker: str, height: int, kind: str = "display") -> str:
    # Native formats must use their account-generated code, not a display ID.
    attrs = {
        "article": f'data-ad-layout="in-article" data-ad-format="fluid" data-ad-slot="{ARTICLE_SLOT}"',
        "feed": 'data-ad-format="fluid" data-ad-layout-key="-6u+cw+56-h-7x" data-ad-slot="5441320677"',
        "display": f'data-ad-slot="{DISPLAY_SLOT}" data-ad-format="auto" data-full-width-responsive="true"',
    }[kind]
    grid = "grid-column:1/-1;" if kind == "feed" else ""
    return (f'\n<!-- {marker} -->\n'
            f'<aside class="emfls-ad-slot" aria-label="Advertisement" style="{grid}box-sizing:border-box;width:100%;max-width:100%;min-width:0;min-height:{height}px;margin:24px 0;text-align:center;clear:both">\n'
            '<div style="font:12px/20px system-ui,sans-serif;color:#65758b;margin-bottom:8px">Advertisement</div>\n'
            f'<ins class="adsbygoogle" style="display:block;text-align:center;min-height:{height}px" data-ad-client="{CLIENT}" {attrs}></ins>\n'
            '<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>\n</aside>\n')


class _Spans(HTMLParser):
    """Track container boundaries without rewriting legacy HTML or nested cards."""
    def __init__(self, source: str):
        super().__init__(convert_charrefs=False)
        self.source = source
        self.offsets = [0]
        for line in source.splitlines(keepends=True):
            self.offsets.append(self.offsets[-1] + len(line))
        self.stack = []
        self.nodes = []
        self.feed(source)

    def position(self):
        row, col = self.getpos()
        return self.offsets[row - 1] + col

    def handle_starttag(self, tag, attrs):
        if tag in {"div", "header", "section", "aside"}:
            self.stack.append({"tag":tag, "classes":set(dict(attrs).get("class", "").split()),
                               "start":self.position(), "parents":tuple(x["classes"] for x in self.stack)})

    def handle_endtag(self, tag):
        if tag not in {"div", "header", "section", "aside"}:
            return
        # Browsers ignore orphan closers; mismatched nested containers stay unsafe.
        if not self.stack:
            return
        if self.stack[-1]["tag"] != tag:
            raise ValueError("Unbalanced container")
        node = self.stack.pop()
        node["end"] = self.source.index(">", self.position()) + 1
        self.nodes.append(node)


def patch_column(source: str) -> tuple[str, str]:
    counts = [source.count(marker) for marker in ("EMFLS_AUTO_ATF_SLOT", "EMFLS_AUTO_INARTICLE_SLOT")]
    if any(counts):
        return source, "ALREADY_PATCHED" if counts == [1, 1] else "PARTIAL_MARKER_HOLD"
    try:
        spans = _Spans(source)
    except ValueError:
        return source, "ANCHOR_HOLD"
    heroes = [n for n in spans.nodes if "hero" in n["classes"]]
    cards = sorted((n for n in spans.nodes if "card" in n["classes"]
                    and not any("card" in p for p in n["parents"])), key=lambda n:n["start"])
    if spans.stack or len(heroes) != 1 or len(cards) < 3 or heroes[0]["end"] > cards[0]["start"]:
        return source, "ANCHOR_HOLD"
    edits = [(heroes[0]["end"], ad_slot("EMFLS_AUTO_ATF_SLOT", 280)),
             (cards[2]["end"], ad_slot("EMFLS_AUTO_INARTICLE_SLOT", 250, kind="article"))]
    for at, code in sorted(edits, reverse=True):
        source = source[:at] + code + source[at:]
    return source, "PATCHED"


def patch_feed(source: str) -> tuple[str, str]:
    if "EMFLS_AUTO_FEED_" in source:
        complete = (source.count("EMFLS_AUTO_FEED_3") == source.count("EMFLS_AUTO_FEED_7") == 1
                    and source.count("EMFLS_AUTO_FEED_") == 2)
        return source, "ALREADY_PATCHED" if complete else "PARTIAL_MARKER_HOLD"
    try:
        spans = _Spans(source)
    except ValueError:
        return source, "ANCHOR_HOLD"
    cards = sorted((n for n in spans.nodes if "item-card" in n["classes"]
                    and any("items-grid" in p for p in n["parents"])), key=lambda n:n["start"])
    if spans.stack or len(cards) != 10:
        return source, "ANCHOR_HOLD"
    for number in (7, 3):
        at = cards[number - 1]["end"]
        source = source[:at] + ad_slot(f"EMFLS_AUTO_FEED_{number}", 250, kind="feed") + source[at:]
    return source, "PATCHED"


def patch_columns(root: Path, protection: dict, write: bool = False) -> list[dict]:
    protected = {p for key, paths in protection.get("routeSets", {}).items()
                 if key != "exceptions" for p in paths}
    rows = []
    for path in sorted((root / "kor/column").glob("*.html")):
        rel = path.relative_to(root).as_posix()
        if path.is_symlink():
            rows.append({"path":rel,"status":"SYMLINK_HOLD"})
            continue
        before = path.read_bytes()
        if protection.get("status") != "VERIFIED" or protection.get("errors"):
            after, state = before, "PROTECTION_UNKNOWN_HOLD"
        elif "/" + rel in protected:
            after, state = before, "PROTECTED_HOLD"
        else:
            result, state = patch_column(before.decode("utf-8"))
            after = result.encode("utf-8")
        if write and after != before:
            # Atomic replacement leaves the original intact if preparation fails.
            temporary = None
            try:
                with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".adsense-", delete=False) as stream:
                    temporary = Path(stream.name)
                    stream.write(after)
                temporary.chmod(path.stat().st_mode & 0o777)
                if path.is_symlink() or path.read_bytes() != before:
                    raise RuntimeError(f"Concurrent edit: {rel}")
                os.replace(temporary, path)
            finally:
                if temporary is not None and temporary.exists():
                    temporary.unlink()
        rows.append({"path":rel,"status":state,
                     "before_sha256":hashlib.sha256(before).hexdigest(),
                     "after_sha256":hashlib.sha256(after).hexdigest()})
    return rows


def build_patch_protection(root: Path, ops_dir: Path) -> dict:
    try:
        from scripts.content_protection_dependency import build_protection_report
        from scripts.content_launch_guard import _trusted_base_snapshot, _url_to_content_path
    except ModuleNotFoundError:
        from content_protection_dependency import build_protection_report
        from content_launch_guard import _trusted_base_snapshot, _url_to_content_path
    report = build_protection_report(root, ops_dir)
    try:
        pin = (ops_dir / "state/content-launch-guard-base-ref.txt").read_text().strip()
        snapshot = _trusted_base_snapshot(root, pin)
        documents = snapshot["json"]
        winners = documents["data/revenue-opportunities.json"]["protectedWinners"]
        experiments = documents["data/experiments.json"]["experiments"]
        protected = {_url_to_content_path(row.get("url")) for row in winners}
        protected.update(_url_to_content_path(row.get("url")) for row in experiments if row.get("status") == "OBSERVING")
        if not protected or any(not path for path in protected):
            raise ValueError("Empty or invalid pinned protection")
        report["routeSets"]["trustedSnapshot"] = sorted("/" + path for path in protected)
        report["trustedPin"] = snapshot["revision"]
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError):
        report["status"] = "UNKNOWN"
        report["errors"].append("TRUSTED_PIN_PROTECTION_UNAVAILABLE")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--ops-dir", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    root = args.root.resolve()
    if args.apply:
        branch = subprocess.check_output(["git","-C",str(root),"branch","--show-current"],text=True).strip()
        if branch != "feature/adsense-rpm-slots-optimization":
            parser.error("Apply requires the dedicated feature branch")
    protection = build_patch_protection(root, args.ops_dir)
    rows = patch_columns(root, protection, write=args.apply)
    result = {"mode":"apply" if args.apply else "dry-run", "protection_status":protection["status"],
              "protection_errors":protection["errors"], "rows":rows}
    args.report.write_text(json.dumps(result, ensure_ascii=False, indent=2)+"\n",encoding="utf-8")
    from collections import Counter
    print(json.dumps({"total":len(rows),"counts":dict(Counter(r["status"] for r in rows)),
                      "mode":result["mode"],"protection_status":protection["status"]}))
    return 0 if protection["status"] == "VERIFIED" else 2


if __name__ == "__main__":
    raise SystemExit(main())
