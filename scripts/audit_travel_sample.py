#!/usr/bin/env python3
"""Create a deterministic quality audit of travel pages."""

from __future__ import annotations

import argparse
import csv
import hashlib
from collections import Counter, defaultdict
from html.parser import HTMLParser
from pathlib import Path
import re


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.hidden = 0
        self.text: list[str] = []
        self.internal_links = 0
        self.canonical = False
        self.description = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag in {"script", "style", "noscript"}:
            self.hidden += 1
        if tag == "a":
            href = values.get("href") or ""
            if href.startswith(("/", "./", "../", "https://emfls.github.io")):
                self.internal_links += 1
        if tag == "link" and values.get("rel") == "canonical" and values.get("href"):
            self.canonical = True
        if tag == "meta" and values.get("name", "").lower() == "description" and values.get("content", "").strip():
            self.description = True

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript"} and self.hidden:
            self.hidden -= 1

    def handle_data(self, data: str) -> None:
        if not self.hidden:
            self.text.append(data)


def classify(metrics: dict[str, object]) -> tuple[str, str]:
    exclusion = []
    improvement = []
    if int(metrics["text_chars"]) < 800:
        exclusion.append("본문 800자 미만")
    if not bool(metrics["canonical"]):
        exclusion.append("canonical 없음")
    if exclusion:
        return "exclude", "; ".join(exclusion)
    if int(metrics["text_chars"]) < 1600:
        improvement.append("본문 1,600자 미만")
    if int(metrics["internal_links"]) < 3:
        improvement.append("내부 링크 3개 미만")
    if not bool(metrics["description"]):
        improvement.append("meta description 없음")
    if improvement:
        return "improve", "; ".join(improvement)
    return "maintain", "기본 품질 기준 충족"


def language_for(path: Path) -> str:
    if path.parts[0] == "report":
        return "en"
    return {"kor": "ko", "jp": "ja"}.get(path.parts[0], path.parts[0])


def discover(root: Path) -> list[tuple[Path, str]]:
    result = []
    for path in root.glob("**/report/travel/*.html"):
        relative = path.relative_to(root)
        if path.name == "index.html" or "/countries/" in relative.as_posix():
            continue
        result.append((relative, language_for(relative)))
    return sorted(result)


def select_sample(candidates: list[tuple[Path, str]], size: int, seed: str) -> list[tuple[Path, str]]:
    groups: dict[str, list[tuple[Path, str]]] = defaultdict(list)
    for item in candidates:
        groups[item[1]].append(item)
    ordered_groups = {}
    for language, items in groups.items():
        ordered_groups[language] = sorted(
            items,
            key=lambda item: hashlib.sha256(f"{seed}:{item[0].as_posix()}".encode()).hexdigest(),
        )
    selected = []
    languages = sorted(ordered_groups)
    index = 0
    while len(selected) < min(size, len(candidates)):
        language = languages[index % len(languages)]
        group = ordered_groups[language]
        group_index = index // len(languages)
        if group_index < len(group):
            selected.append(group[group_index])
        index += 1
    return selected


def inspect_page(path: Path) -> dict[str, object]:
    parser = PageParser()
    parser.feed(path.read_text(encoding="utf-8", errors="replace"))
    text = re.sub(r"\s+", " ", " ".join(parser.text)).strip()
    return {
        "text_chars": len(text),
        "internal_links": parser.internal_links,
        "canonical": parser.canonical,
        "description": parser.description,
    }


def write_outputs(root: Path, csv_path: Path, md_path: Path, size: int, seed: str) -> list[dict[str, object]]:
    sample = select_sample(discover(root), size, seed)
    rows = []
    for relative, language in sample:
        metrics = inspect_page(root / relative)
        classification, reasons = classify(metrics)
        rows.append({"path": relative.as_posix(), "language": language, **metrics, "classification": classification, "reasons": reasons})
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    fields = ["path", "language", "text_chars", "internal_links", "canonical", "description", "classification", "reasons"]
    with csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    totals = Counter(str(row["classification"]) for row in rows)
    languages = Counter(str(row["language"]) for row in rows)
    md_path.write_text(
        "# 여행 페이지 품질 표본 감사 (200개)\n\n"
        f"- 기준일: 2026-08-12\n- 표본 방식: 언어별 순환 층화, SHA-256 고정 시드 `{seed}`\n"
        f"- 결과: 유지 {totals['maintain']} / 개선 {totals['improve']} / 제외 검토 {totals['exclude']}\n"
        f"- 언어 분포: " + ", ".join(f"{key} {value}" for key, value in sorted(languages.items())) + "\n\n"
        "제외 검토는 즉시 삭제를 뜻하지 않습니다. 본문 800자 미만 또는 canonical 누락 페이지를 수동 검토한 뒤 광고 제외·보강·통합 중 하나를 선택합니다.\n",
        encoding="utf-8",
    )
    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--csv", type=Path, required=True)
    parser.add_argument("--markdown", type=Path, required=True)
    parser.add_argument("--size", type=int, default=200)
    parser.add_argument("--seed", default="2026-08-12")
    args = parser.parse_args()
    rows = write_outputs(args.root.resolve(), args.csv, args.markdown, args.size, args.seed)
    totals = Counter(str(row["classification"]) for row in rows)
    print(f"rows={len(rows)} maintain={totals['maintain']} improve={totals['improve']} exclude={totals['exclude']}")


if __name__ == "__main__":
    main()
