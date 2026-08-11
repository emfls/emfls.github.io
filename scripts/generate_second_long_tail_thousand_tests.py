#!/usr/bin/env python3
"""Generate the second ten long-tail GA4 manifests and contract tests."""

from __future__ import annotations

import ast
import glob
import importlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import scripts.generate_next_thousand_ga4_tests as base


def prior_pages() -> set[str]:
    pages: set[str] = set()
    for filename in glob.glob(str(ROOT / "tests/*manifest.py")):
        if Path(filename).name.startswith("second_long_tail_ga4_"):
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


def main() -> None:
    base.prior_pages = prior_pages
    pages = base.select()
    for index in range(1, 11):
        subset = pages[(index - 1) * 100 : index * 100]
        manifest = "PAGES = [\n" + "".join(f"    {row!r},\n" for row in subset) + "]\n"
        (ROOT / f"tests/second_long_tail_ga4_{index:02d}_manifest.py").write_text(manifest, encoding="utf-8")
        number = 97 + index
        marker_number = 10 + index
        test = (
            "import unittest\n"
            "from tests.long_tail_ga4_contract import assert_manifest\n"
            f"from tests.second_long_tail_ga4_{index:02d}_manifest import PAGES\n\n"
            f"class Ga4PriorityBatch{number}Test(unittest.TestCase):\n"
            "    def test_contract(self):\n"
            f"        assert_manifest(self, PAGES, \"ga4-long-tail-{marker_number:02d}-priority-2026-08-11\")\n"
        )
        (ROOT / f"tests/test_ga4_priority_batch_{number:03d}.py").write_text(test, encoding="utf-8")
    print(f"first={pages[0][0]} last={pages[-1][0]}")


if __name__ == "__main__":
    main()
