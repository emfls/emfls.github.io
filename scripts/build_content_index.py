#!/usr/bin/env python3
"""Build deterministic Korean content and compact home indexes."""
from __future__ import annotations

import argparse
import html as html_lib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

CATEGORIES = ("캠핑·차박", "여행", "게임", "무료 도구", "자동차·생활", "금융·투자", "AI·테크", "생활정보")
TAG_STOPWORDS = {"가이드", "정보", "정리", "확인", "방법", "내용", "페이지", "추천", "위한", "및", "하기", "있는", "무료"}
DATE_RE = re.compile(r"(?:datePublished|dateModified)\"?\s*:\s*\"(\d{4}-\d{2}-\d{2})|<time[^>]+datetime=[\"'](\d{4}-\d{2}-\d{2})", re.I)


def _text(value: str) -> str:
    return re.sub(r"\s+", " ", html_lib.unescape(re.sub(r"<[^>]+>", " ", value))).strip()


def extract_metadata(path: Path, source: str) -> dict:
    title_match = re.search(r"<title[^>]*>(.*?)</title>", source, re.I | re.S)
    description_match = re.search(r"<meta[^>]+(?:name|property)=[\"']description[\"'][^>]+content=[\"'](.*?)[\"']", source, re.I | re.S)
    if not description_match:
        description_match = re.search(r"<meta[^>]+content=[\"'](.*?)[\"'][^>]+(?:name|property)=[\"']description[\"']", source, re.I | re.S)
    h1_match = re.search(r"<h1[^>]*>(.*?)</h1>", source, re.I | re.S)
    date_match = DATE_RE.search(source)
    return {
        "title": _text(title_match.group(1)) if title_match else "",
        "description": _text(description_match.group(1)) if description_match else "",
        "h1": _text(h1_match.group(1)) if h1_match else "",
        "updated_at": next((item for item in date_match.groups() if item), None) if date_match else None,
        "url": "/" + path.as_posix().lstrip("/"),
    }


def classify_category(url: str, title: str, description: str, h1: str) -> str:
    url_lower = url.lower()
    text = " ".join((url_lower, title, description, h1)).lower()
    if url_lower.startswith("/kor/util/"):
        return "무료 도구"
    if "/report/camp/" in url_lower or any(word in text for word in ("캠핑", "차박")):
        return "캠핑·차박"
    if "/kor/game/" in url_lower:
        return "게임"
    if any(word in text for word in ("palworld", "팰월드", "팔월드", "maple", "메이플", "nikke", "게임")):
        return "게임"
    if "/report/travel/" in url_lower or any(word in text for word in ("여행", "visa", "비자")):
        return "여행"
    if any(word in text for word in ("car", "자동차", "차량", "검사")):
        return "자동차·생활"
    if any(word in text for word in ("finance", "stock", "coin", "asset allocation", "자산배분", "포트폴리오", "etf", "주식", "배당", "채권", "bond", "투자", "연금", "금융", "세금")):
        return "금융·투자"
    if any(word in text for word in ("ai", "tech", "인공지능", "it", "window", "윈도우")):
        return "AI·테크"
    return "생활정보"


def make_tags(url: str, title: str, description: str, h1: str) -> list[str]:
    tokens = re.findall(r"[가-힣]{2,}|[A-Za-z][A-Za-z0-9-]{2,}", " ".join((title, h1, description, url.replace("/", " "))))
    result = []
    for token in tokens:
        normalized = token.lower() if token.isascii() else token
        if normalized in TAG_STOPWORDS or normalized in result or len(normalized) < 2:
            continue
        result.append(normalized)
        if len(result) == 8:
            break
    return result


def _excluded(path: Path) -> bool:
    url = "/" + path.as_posix().lstrip("/")
    name = path.name.lower()
    hub_index = url in {"/kor/index.html", "/kor/util/index.html", "/kor/report/index.html", "/kor/column/index.html"}
    return (not url.startswith("/kor/")) or url.startswith("/kor/sitemap") or (name == "index.html" and hub_index) or name in {"404.html", "error.html", "redirect.html"} or any(part in {"sitemap", "redirect", "error", "admin", " 관리"} for part in path.parts)


def build_index(root: Path, overrides: dict) -> list[dict]:
    rows = []
    seen = set()
    for path in sorted((root / "kor").rglob("*.html")):
        relative = path.relative_to(root)
        if _excluded(relative):
            continue
        source = path.read_text(encoding="utf-8", errors="ignore")
        meta = extract_metadata(relative, source)
        if not meta["title"] or meta["url"] in seen:
            continue
        seen.add(meta["url"])
        override = overrides.get(meta["url"], {})
        row = {"title": meta["title"], "url": meta["url"], "description": meta["description"], "category": classify_category(meta["url"], meta["title"], meta["description"], meta["h1"]), "tags": make_tags(meta["url"], meta["title"], meta["description"], meta["h1"]), "aliases": [], "updated_at": meta["updated_at"]}
        for key in ("category", "tags", "aliases"):
            if key in override:
                row[key] = override[key]
        if row["category"] not in CATEGORIES:
            row["category"] = "생활정보"
        row["tags"] = list(dict.fromkeys(str(tag) for tag in row["tags"]))[:8]
        row["aliases"] = list(dict.fromkeys(str(alias) for alias in row["aliases"]))
        rows.append(row)
    return rows


def build_home_feed(rows: list[dict]) -> dict:
    dated = sorted(rows, key=lambda row: (row["updated_at"] is not None, row["updated_at"] or "", row["url"]), reverse=True)
    def card(row: dict) -> dict:
        return {key: row[key] for key in ("title", "url", "description", "category", "tags")}

    latest = [card(row) for row in dated[:6]]
    categories = {category: [card(row) for row in dated if row["category"] == category][:3] for category in CATEGORIES}
    counts = Counter(tag for row in rows for tag in row["tags"])
    popular = [tag for tag, _ in sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:20]]
    return {"latest": latest, "categories": categories, "popular_tags": popular}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    root = args.root.resolve()
    override_path = root / "data/content-overrides-ko.json"
    overrides = json.loads(override_path.read_text(encoding="utf-8")) if override_path.exists() else {}
    rows = build_index(root, overrides)
    feed = build_home_feed(rows)
    (root / "data/content-index-ko.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (root / "data/home-feed-ko.json").write_text(json.dumps(feed, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    counts = Counter(row["category"] for row in rows)
    print(json.dumps({"entries": len(rows), "categories": {category: counts[category] for category in CATEGORIES}, "latest": len(feed["latest"]), "popular_tags": len(feed["popular_tags"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
