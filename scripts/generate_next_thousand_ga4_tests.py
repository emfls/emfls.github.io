#!/usr/bin/env python3
"""Generate ten immutable long-tail GA4 manifests and contract tests."""

from __future__ import annotations

import ast
import csv
import glob
import importlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
CSV_PATH = Path("/Users/whitesmile/Downloads/방문_페이지_방문_페이지.csv")
HUB_NAMES = {"util", "game", "camp", "visa", "travel", "coin", "stock", "report"}


def prior_pages() -> set[str]:
    pages: set[str] = set()
    for filename in glob.glob(str(ROOT / "tests/*manifest.py")):
        if Path(filename).name.startswith("long_tail_ga4_"):
            continue
        module = Path(filename).relative_to(ROOT).with_suffix("").as_posix().replace("/", ".")
        try:
            pages.update(row[0] for row in importlib.import_module(module).PAGES)
        except (AttributeError, ImportError, TypeError):
            pass
    for filename in glob.glob(str(ROOT / "tests/test_*ga4_priority_batch.py")):
        tree = ast.parse(Path(filename).read_text(encoding="utf-8"))
        for node in tree.body:
            if not isinstance(node, ast.Assign) or not isinstance(node.value, ast.Dict):
                continue
            if not any(isinstance(target, ast.Name) and target.id == "PAGES" for target in node.targets):
                continue
            pages.update(
                key.value for key in node.value.keys
                if isinstance(key, ast.Constant) and isinstance(key.value, str)
            )
    return pages


def classify(relative: str) -> tuple[str, str]:
    for token, category in (
        ("/travel/", "travel"), ("/visa/", "visa"), ("/camp/", "camp"), ("/coin/", "coin"),
    ):
        if token in relative:
            return "WebPage", category
    if relative.startswith("util/") or "/util/" in relative:
        return "WebApplication", "tool"
    if relative.startswith("game/") or "/game/" in relative:
        return "VideoGame", "game"
    if any(token in relative for token in ("/stock/", "/finance/", "/sec/")):
        return "WebPage", "finance"
    return "WebPage", "article"


def hub_for(relative: str) -> str:
    parent = Path(relative).parent.as_posix()
    while parent and not (ROOT / parent / "index.html").is_file():
        parent = Path(parent).parent.as_posix()
        if parent == ".":
            parent = ""
    return f"/{parent}/" if parent else "/"


def select(limit: int = 1000) -> list[tuple[str, str, str, str]]:
    rows = list(csv.reader(CSV_PATH.open(encoding="utf-8-sig")))
    header = next(i for i, row in enumerate(rows) if row and row[0] == "방문 페이지")
    ranked: dict[str, tuple[float, float]] = {}
    for row in rows[header + 1 :]:
        if len(row) < 5:
            continue
        url = row[0].split("?", 1)[0].split("#", 1)[0].strip()
        try:
            score = float(row[1]), float(row[4])
        except ValueError:
            continue
        if url not in ranked or score > ranked[url]:
            ranked[url] = score
    excluded = prior_pages()
    selected: list[tuple[str, str, str, str]] = []
    for url, _ in sorted(ranked.items(), key=lambda item: (-item[1][0], -item[1][1], item[0])):
        if not url.startswith("/") or url == "/":
            continue
        raw = url.strip("/")
        relative = next(
            (candidate for candidate in (raw, raw + ".html", raw + "/index.html") if (ROOT / candidate).is_file()),
            None,
        )
        if not relative or relative in excluded or relative == "kor/report/travel/mexico-merida.html":
            continue
        path = Path(relative)
        if path.name == "index.html" and path.parent.name in HUB_NAMES:
            continue
        if any(token in path.name.lower() for token in ("privacy", "contact")):
            continue
        schema, category = classify(relative)
        selected.append((relative, schema, category, hub_for(relative)))
        if len(selected) == limit:
            break
    if len(selected) != limit or len({row[0] for row in selected}) != limit:
        raise SystemExit(f"selection must contain {limit:,} unique pages")
    return selected


def main() -> None:
    pages = select()
    for batch in range(1, 11):
        subset = pages[(batch - 1) * 100 : batch * 100]
        manifest = "PAGES = [\n" + "".join(f"    {row!r},\n" for row in subset) + "]\n"
        (ROOT / f"tests/long_tail_ga4_{batch:02d}_manifest.py").write_text(manifest, encoding="utf-8")
        number = 87 + batch
        test = (
            "import unittest\n"
            "from tests.long_tail_ga4_contract import assert_manifest\n"
            f"from tests.long_tail_ga4_{batch:02d}_manifest import PAGES\n\n"
            f"class Ga4PriorityBatch{number}Test(unittest.TestCase):\n"
            "    def test_contract(self):\n"
            f"        assert_manifest(self, PAGES, \"ga4-long-tail-{batch:02d}-priority-2026-08-11\")\n"
        )
        (ROOT / f"tests/test_ga4_priority_batch_{number:03d}.py").write_text(test, encoding="utf-8")
    print(f"first={pages[0][0]} last={pages[-1][0]}")


if __name__ == "__main__":
    main()
