#!/usr/bin/env python3
"""Generate country hubs and contextual links for English travel pages."""

from dataclasses import dataclass
from html import unescape
from pathlib import Path
import re
import unicodedata
from typing import Dict, List, Sequence, Tuple


SITE_ORIGIN = "https://emfls.github.io"
TRAVEL_DIRECTORY = Path("report/travel")


@dataclass(frozen=True)
class TravelPage:
    path: Path
    title: str
    country: str
    city: str
    canonical: str


def country_slug(country: str) -> str:
    normalized = unicodedata.normalize("NFKD", country.replace("’", " ").replace("'", " "))
    ascii_name = normalized.encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", ascii_name))


def _match(html: str, pattern: str) -> str:
    match = re.search(pattern, html, flags=re.IGNORECASE | re.DOTALL)
    return unescape(re.sub(r"<[^>]+>", "", match.group(1)).strip()) if match else ""


def _metadata(path: Path, root: Path) -> Tuple[TravelPage, str]:
    html = path.read_text(encoding="utf-8", errors="ignore")
    canonical = _match(html, r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)["\']')
    if not canonical:
        canonical = _match(html, r'<link[^>]+href=["\']([^"\']+)["\'][^>]+rel=["\']canonical["\']')
    title = _match(html, r"<title[^>]*>(.*?)</title>")
    country = _match(html, r'"addressCountry"\s*:\s*"([^"]+)"')
    city = _match(html, r'"about"\s*:\s*\{.*?"name"\s*:\s*"([^"]+)"')
    if not city:
        city = _match(html, r"<h1[^>]*>(.*?)</h1>") or title
        city = re.sub(r"\s+(?:travel|guide).*", "", city, flags=re.IGNORECASE).strip()
    relative = path.relative_to(root)
    return TravelPage(relative, title or city, country, city, canonical), path.stem


def collect_pages(root: Path) -> Tuple[List[TravelPage], List[Tuple[str, str]]]:
    travel_root = root / TRAVEL_DIRECTORY
    raw = [_metadata(path, root) for path in sorted(travel_root.glob("*.html")) if path.name != "index.html"]
    known = {country_slug(page.country): page.country for page, _ in raw if page.country}
    known_slugs = sorted(known, key=len, reverse=True)
    pages: List[TravelPage] = []
    exceptions: List[Tuple[str, str]] = []
    for page, stem in raw:
        country = page.country
        if not country:
            prefix = next((slug for slug in known_slugs if stem == slug or stem.startswith(slug + "-")), "")
            country = known.get(prefix, "")
        if not country:
            exceptions.append((page.path.as_posix(), "country_not_identified"))
            continue
        if not page.canonical.startswith(SITE_ORIGIN + "/report/travel/"):
            exceptions.append((page.path.as_posix(), "invalid_canonical"))
            continue
        pages.append(TravelPage(page.path, page.title, country, page.city, page.canonical))
    pages.sort(key=lambda page: (page.country.casefold(), page.city.casefold(), page.path.as_posix()))
    return pages, exceptions


def group_by_country(pages: Sequence[TravelPage]) -> Dict[str, List[TravelPage]]:
    groups: Dict[str, List[TravelPage]] = {}
    for page in sorted(pages, key=lambda item: (item.country.casefold(), item.city.casefold(), item.path.as_posix())):
        groups.setdefault(page.country, []).append(page)
    return dict(sorted(groups.items(), key=lambda item: item[0].casefold()))


def related_pages(page: TravelPage, country_pages: Sequence[TravelPage], limit: int = 3) -> List[TravelPage]:
    ordered = sorted(country_pages, key=lambda item: (item.city.casefold(), item.path.as_posix()))
    if page not in ordered or len(ordered) < 2:
        return []
    start = ordered.index(page)
    return [ordered[(start + offset) % len(ordered)] for offset in range(1, min(limit, len(ordered) - 1) + 1)]
