#!/usr/bin/env python3
"""Generate country hubs and contextual links for English travel pages."""

from dataclasses import dataclass
from html import escape, unescape
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


@dataclass(frozen=True)
class CountryGroup:
    country: str
    slug: str
    pages: Tuple[TravelPage, ...]


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


def render_related_block(page: TravelPage, related: Sequence[TravelPage]) -> str:
    country = escape(page.country)
    country_url = f"{SITE_ORIGIN}/report/travel/country/{country_slug(page.country)}/"
    related_links = "".join(
        f'<li><a href="{escape(item.canonical, quote=True)}">{escape(item.city)} travel guide</a></li>'
        for item in related
    )
    related_section = (
        f'<h3>Related cities in {country}</h3><ul>{related_links}</ul>' if related_links else ""
    )
    return (
        '<section class="section emfls-travel-related" aria-labelledby="explore-more-destinations">'
        '<h2 id="explore-more-destinations">Explore more destinations</h2>'
        '<p class="emfls-travel-breadcrumbs">'
        f'<a href="{SITE_ORIGIN}/report/travel/">All travel guides</a> · '
        f'<a href="{country_url}">{country} travel guides</a>'
        "</p>"
        f"{related_section}</section>"
    )


def apply_generated_block(html: str, marker: str, block: str, before: str) -> str:
    start = f"<!-- emfls:{marker}:start -->"
    end = f"<!-- emfls:{marker}:end -->"
    generated = f"{start}\n{block}\n{end}"
    pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.DOTALL)
    if pattern.search(html):
        return pattern.sub(generated, html, count=1)
    position = html.lower().find(before.lower())
    if position < 0:
        raise ValueError(f"Insertion point not found: {before}")
    return html[:position] + generated + "\n" + html[position:]


def _hub_url(group: CountryGroup, page_number: int) -> str:
    base = f"{SITE_ORIGIN}/report/travel/country/{group.slug}/"
    return base if page_number == 1 else f"{base}page/{page_number}/"


def render_country_hub(group: CountryGroup, page_number: int) -> str:
    per_page = 100
    page_count = max(1, (len(group.pages) + per_page - 1) // per_page)
    if page_number < 1 or page_number > page_count:
        raise ValueError(f"Invalid page number {page_number} for {group.country}")
    selected = group.pages[(page_number - 1) * per_page : page_number * per_page]
    city_links = "\n".join(
        f'<li><a class="travel-city-link" href="{escape(page.canonical, quote=True)}">{escape(page.city)} travel guide</a></li>'
        for page in selected
    )
    pagination_links = []
    for number in range(1, page_count + 1):
        current = ' aria-current="page"' if number == page_number else ""
        pagination_links.append(f'<a href="{_hub_url(group, number)}"{current}>{number}</a>')
    pagination = " ".join(pagination_links)
    country = escape(group.country)
    canonical = _hub_url(group, page_number)
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{country} Travel Guides: {len(group.pages)} Destinations</title>
<meta name="description" content="Explore {len(group.pages)} destination guides for {country}, including itineraries, preparation tips, costs, and safety information.">
<link rel="canonical" href="{canonical}">
<style>
body{{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.6;color:#263238;background:#f5f7fb;margin:0}}
main{{max-width:1000px;margin:0 auto;padding:32px 20px}}a{{color:#3157a4}}.city-grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;padding:0;list-style:none}}.city-grid li{{background:#fff;border:1px solid #dfe5ef;border-radius:10px;padding:14px}}.pagination{{margin-top:24px;display:flex;gap:10px;flex-wrap:wrap}}.pagination a{{background:#fff;border:1px solid #ccd5e3;border-radius:8px;padding:7px 11px;text-decoration:none}}.pagination [aria-current="page"]{{background:#3157a4;color:#fff}}
</style>
</head>
<body><main>
<nav aria-label="Breadcrumb"><a href="{SITE_ORIGIN}/report/travel/">All travel guides</a> / {country}</nav>
<h1>{country} travel guides</h1>
<p>Browse {len(group.pages)} destination guides for {country}. Choose a city to see suggested itineraries, preparation tips, expected costs, and practical precautions.</p>
<ul class="city-grid">{city_links}</ul>
<nav class="pagination" aria-label="Country guide pages">{pagination}</nav>
</main></body></html>
'''
