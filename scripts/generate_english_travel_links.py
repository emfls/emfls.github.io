#!/usr/bin/env python3
"""Generate country hubs and contextual links for English travel pages."""

from dataclasses import dataclass
from html import escape, unescape
from pathlib import Path
import argparse
import csv
import io
import os
import re
import unicodedata
from typing import Dict, List, Optional, Sequence, Tuple


SITE_ORIGIN = "https://emfls.github.io"
TRAVEL_DIRECTORY = Path("report/travel")
COUNTRY_ALIASES = {
    "anti is babu": ("Antigua and Barbuda", "antigua-and-barbuda"),
    "arab emirates": ("United Arab Emirates", "united-arab-emirates"),
    "bellless": ("Belize", "belize"),
    "bencyan": ("Benin", "benin"),
    "book macedonia": ("North Macedonia", "north-macedonia"),
    "bosnia herzegovina": ("Bosnia and Herzegovina", "bosnia-and-herzegovina"),
    "butane": ("Bhutan", "bhutan"),
    "carbobert": ("Cabo Verde", "cabo-verde"),
    "catarrh": ("Qatar", "qatar"),
    "cote divoire": ("Côte d’Ivoire", "cote-d-ivoire"),
    "congo democratic republic": ("Democratic Republic of the Congo", "democratic-republic-of-the-congo"),
    "congo republic": ("Republic of the Congo", "republic-of-the-congo"),
    "croatia, bosnia herzegovina": ("Bosnia and Herzegovina", "bosnia-and-herzegovina"),
    "czech republic": ("Czechia", "czechia"),
    "democratic people's republic of korea": ("North Korea", "north-korea"),
    "dominican federation": ("Dominica", "dominica"),
    "equatorial": ("Equatorial Guinea", "equatorial-guinea"),
    "french hangiana": ("French Guiana", "french-guiana"),
    "gaiana": ("Guyana", "guyana"),
    "germany, austria": ("Germany", "germany"),
    "guinea beach sau": ("Guinea-Bissau", "guinea-bissau"),
    "jjibouti": ("Djibouti", "djibouti"),
    "kiribashi": ("Kiribati", "kiribati"),
    "korea": ("South Korea", "south-korea"),
    "maldive islands": ("Maldives", "maldives"),
    "marshall": ("Marshall Islands", "marshall-islands"),
    "marshall islands republic": ("Marshall Islands", "marshall-islands"),
    "method": ("Sudan", "sudan"),
    "micronesia": ("Federated States of Micronesia", "micronesia"),
    "micronesia federation": ("Federated States of Micronesia", "micronesia"),
    "sebum": ("Fiji", "fiji"),
    "sierra lion": ("Sierra Leone", "sierra-leone"),
    "slovenian": ("Slovenia", "slovenia"),
    "st. kitsune bis": ("Saint Kitts and Nevis", "saint-kitts-and-nevis"),
    "st. lucia": ("Saint Lucia", "saint-lucia"),
    "st. vincent grenadin": ("Saint Vincent and the Grenadines", "saint-vincent-and-the-grenadines"),
    "surname": ("Suriname", "suriname"),
    "swiss": ("Switzerland", "switzerland"),
    "trinidad tobago": ("Trinidad and Tobago", "trinidad-and-tobago"),
    "trinidadi tobago": ("Trinidad and Tobago", "trinidad-and-tobago"),
    "uk": ("United Kingdom", "united-kingdom"),
    "usa": ("United States", "united-states"),
    "루마니아": ("Romania", "romania"),
    "카타르": ("Qatar", "qatar"),
    "페루": ("Peru", "peru"),
    "포르투갈": ("Portugal", "portugal"),
    "푸에르토리코": ("Puerto Rico", "puerto-rico"),
}


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


@dataclass(frozen=True)
class GenerationSummary:
    pages: int
    countries: int
    exceptions: int
    changed_files: int


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


def render_related_block(
    page: TravelPage,
    related: Sequence[TravelPage],
    group: Optional[CountryGroup] = None,
) -> str:
    country_name = group.country if group else page.country
    slug = group.slug if group else country_slug(page.country)
    country = escape(country_name)
    country_url = f"{SITE_ORIGIN}/report/travel/country/{slug}/"
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


def _group_slug(country: str, pages: Sequence[TravelPage]) -> str:
    slug = country_slug(country)
    if slug:
        return slug
    stems = [page.path.stem for page in pages]
    prefix = os.path.commonprefix(stems).rstrip("-")
    if not prefix:
        raise ValueError(f"Cannot create country slug for {country}")
    return prefix


def _canonical_country(country: str) -> Tuple[str, str]:
    alias = COUNTRY_ALIASES.get(country.casefold())
    if alias:
        return alias
    display = country.title() if country.islower() else country
    return display, country_slug(display)


def build_country_groups(pages: Sequence[TravelPage]) -> List[CountryGroup]:
    aliases: Dict[str, List[str]] = {}
    merged: Dict[str, List[TravelPage]] = {}
    for country, country_pages in group_by_country(pages).items():
        display, slug = _canonical_country(country)
        if not slug:
            slug = _group_slug(country, country_pages)
        aliases.setdefault(slug, []).append(display)
        merged.setdefault(slug, []).extend(country_pages)

    result = []
    for slug, country_pages in merged.items():
        display = sorted(aliases[slug], key=str.casefold)[0]
        normalized = tuple(
            sorted(
                (
                    TravelPage(page.path, page.title, display, page.city, page.canonical)
                    for page in country_pages
                ),
                key=lambda page: (page.city.casefold(), page.path.as_posix()),
            )
        )
        result.append(CountryGroup(display, slug, normalized))
    return sorted(result, key=lambda group: (group.country.casefold(), group.slug))


def _render_country_directory(groups: Sequence[CountryGroup]) -> str:
    links = "\n".join(
        '<li><a href="{origin}/report/travel/country/{slug}/">{country} travel guides</a> '
        '<span>({count} destinations)</span></li>'.format(
            origin=SITE_ORIGIN,
            slug=group.slug,
            country=escape(group.country),
            count=len(group.pages),
        )
        for group in groups
    )
    return (
        '<section class="country-directory" aria-labelledby="country-directory-title">'
        '<h2 id="country-directory-title">Browse travel guides by country</h2>'
        '<p>Choose a country to find city itineraries, preparation tips, costs, and safety information.</p>'
        f'<ul class="country-directory-list">{links}</ul></section>'
    )


def _exception_csv(exceptions: Sequence[Tuple[str, str]]) -> str:
    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(("path", "reason"))
    writer.writerows(exceptions)
    return output.getvalue()


def _write_if_changed(path: Path, content: str, check: bool) -> int:
    current = path.read_text(encoding="utf-8", errors="ignore") if path.exists() else None
    if current == content:
        return 0
    if not check:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(path.name + ".tmp-emfls")
        temporary.write_text(content, encoding="utf-8")
        temporary.replace(path)
    return 1


def generate(root: Path, check: bool = False) -> GenerationSummary:
    pages, exceptions = collect_pages(root)
    groups = build_country_groups(pages)
    changed = 0

    for group in groups:
        for page in group.pages:
            path = root / page.path
            original = path.read_text(encoding="utf-8", errors="ignore")
            related = related_pages(page, group.pages)
            updated = apply_generated_block(
                original,
                "travel-related",
                render_related_block(page, related, group),
                "<footer",
            )
            changed += _write_if_changed(path, updated, check)

    expected_hubs = set()
    for group in groups:
        page_count = max(1, (len(group.pages) + 99) // 100)
        for page_number in range(1, page_count + 1):
            relative = (
                TRAVEL_DIRECTORY / "country" / group.slug / "index.html"
                if page_number == 1
                else TRAVEL_DIRECTORY / "country" / group.slug / "page" / str(page_number) / "index.html"
            )
            expected_hubs.add((root / relative).resolve())
            changed += _write_if_changed(root / relative, render_country_hub(group, page_number), check)

    country_root = root / TRAVEL_DIRECTORY / "country"
    stale_hubs = sorted(
        (path for path in country_root.rglob("*.html") if path.resolve() not in expected_hubs),
        reverse=True,
    ) if country_root.exists() else []
    changed += len(stale_hubs)
    if not check:
        for path in stale_hubs:
            path.unlink()
        for directory in sorted((path for path in country_root.rglob("*") if path.is_dir()), reverse=True):
            if not any(directory.iterdir()):
                directory.rmdir()

    index_path = root / TRAVEL_DIRECTORY / "index.html"
    index_html = index_path.read_text(encoding="utf-8", errors="ignore")
    index_updated = apply_generated_block(
        index_html,
        "country-directory",
        _render_country_directory(groups),
        "</body>",
    )
    changed += _write_if_changed(index_path, index_updated, check)
    changed += _write_if_changed(
        root / "docs/growth/2026-08-12-english-travel-link-exceptions.csv",
        _exception_csv(exceptions),
        check,
    )
    return GenerationSummary(len(pages), len(groups), len(exceptions), changed)


def _target_path(root: Path, href: str) -> Path:
    relative = href.removeprefix(SITE_ORIGIN).split("#", 1)[0].split("?", 1)[0].lstrip("/")
    path = root / relative
    return path / "index.html" if href.split("#", 1)[0].split("?", 1)[0].endswith("/") else path


def validate_generated_links(root: Path) -> List[Tuple[str, str]]:
    missing = []
    for path in (root / TRAVEL_DIRECTORY).rglob("*.html"):
        html = path.read_text(encoding="utf-8", errors="ignore")
        blocks = re.findall(r"<!-- emfls:(?:travel-related|country-directory):start -->(.*?)<!-- emfls:.*?:end -->", html, re.DOTALL)
        if "/country/" in path.as_posix():
            blocks.append(html)
        for block in blocks:
            for href in re.findall(r'href=["\']([^"\']+)["\']', block, re.IGNORECASE):
                if href.startswith(SITE_ORIGIN + "/") and not _target_path(root, href).exists():
                    missing.append((path.relative_to(root).as_posix(), href))
    return sorted(set(missing))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    summary = generate(args.root, check=args.check)
    missing = validate_generated_links(args.root) if args.check else []
    print(
        f"pages={summary.pages} countries={summary.countries} exceptions={summary.exceptions} "
        f"changed_files={summary.changed_files} missing_links={len(missing)}"
    )
    return 1 if summary.changed_files or missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
