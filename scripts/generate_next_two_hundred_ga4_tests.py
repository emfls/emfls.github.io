#!/usr/bin/env python3
"""Generate the immutable fifth/sixth hundred manifests and their contract tests."""

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
        if Path(filename).name in {"fifth_hundred_ga4_manifest.py", "sixth_hundred_ga4_manifest.py"}:
            continue
        module_name = Path(filename).relative_to(ROOT).with_suffix("").as_posix().replace("/", ".")
        try:
            pages.update(row[0] for row in importlib.import_module(module_name).PAGES)
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
                key.value
                for key in node.value.keys
                if isinstance(key, ast.Constant) and isinstance(key.value, str)
            )
    return pages


def classify(relative: str) -> tuple[str, str]:
    if "/travel/" in relative:
        return "WebPage", "travel"
    if "/visa/" in relative:
        return "WebPage", "visa"
    if "/camp/" in relative:
        return "WebPage", "camp"
    if "/coin/" in relative:
        return "WebPage", "coin"
    if relative.startswith("game/") or "/game/" in relative:
        return "VideoGame", "game"
    if relative.startswith("util/") or "/util/" in relative:
        return "WebApplication", "tool"
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


def select() -> list[tuple[str, str, str, str]]:
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
        schema_type, category = classify(relative)
        selected.append((relative, schema_type, category, hub_for(relative)))
        if len(selected) == 200:
            break
    if len(selected) != 200 or len({row[0] for row in selected}) != 200:
        raise SystemExit("selection must contain 200 unique pages")
    return selected


def write_manifest(path: Path, pages: list[tuple[str, str, str, str]]) -> None:
    body = "PAGES = [\n" + "".join(f"    {row!r},\n" for row in pages) + "]\n\n"
    body += "BATCHES = [PAGES[index:index + 10] for index in range(0, 100, 10)]\n"
    path.write_text(body, encoding="utf-8")


def main() -> None:
    selected = select()
    write_manifest(ROOT / "tests/fifth_hundred_ga4_manifest.py", selected[:100])
    write_manifest(ROOT / "tests/sixth_hundred_ga4_manifest.py", selected[100:])
    for number in range(68, 88):
        manifest = "fifth" if number < 78 else "sixth"
        batch = number - (68 if number < 78 else 78)
        content = (
            "import unittest\n"
            "from tests.two_hundred_ga4_contract import assert_batch\n"
            f"from tests.{manifest}_hundred_ga4_manifest import BATCHES\n\n"
            f"class Ga4PriorityBatch{number}Test(unittest.TestCase):\n"
            "    def test_contract(self):\n"
            f"        assert_batch(self, BATCHES[{batch}], \"{manifest}-hundred-ga4-priority-2026-08-11\")\n"
        )
        (ROOT / f"tests/test_ga4_priority_batch_{number:03d}.py").write_text(content, encoding="utf-8")
    print(f"first={selected[0][0]} hundred={selected[99][0]} second={selected[100][0]} last={selected[-1][0]}")


if __name__ == "__main__":
    main()
