from pathlib import Path
from typing import Optional

from scripts.generate_english_travel_links import (
    TravelPage,
    collect_pages,
    country_slug,
    group_by_country,
    related_pages,
)


def write_travel_page(root: Path, filename: str, *, country: Optional[str], city: str) -> Path:
    page = root / "report" / "travel" / filename
    page.parent.mkdir(parents=True, exist_ok=True)
    address = f'"addressCountry": "{country}"' if country else ""
    page.write_text(
        f'''<!doctype html><html lang="en"><head>
        <title>{city} Travel Guide</title>
        <link rel="canonical" href="https://emfls.github.io/report/travel/{filename}">
        <script type="application/ld+json">{{"about":{{"name":"{city}","address":{{{address}}}}}}}</script>
        </head><body><h1>{city} Travel Guide</h1><footer>Footer</footer></body></html>''',
        encoding="utf-8",
    )
    return page


def test_collect_pages_prefers_structured_country_and_uses_known_prefix_fallback(tmp_path):
    write_travel_page(tmp_path, "united-arab-emirates-dubai.html", country="United Arab Emirates", city="Dubai")
    write_travel_page(tmp_path, "united-arab-emirates-abu-dhabi.html", country=None, city="Abu Dhabi")

    pages, exceptions = collect_pages(tmp_path)

    assert [(page.country, page.city) for page in pages] == [
        ("United Arab Emirates", "Abu Dhabi"),
        ("United Arab Emirates", "Dubai"),
    ]
    assert exceptions == []


def test_country_slug_normalizes_spaces_and_punctuation():
    assert country_slug("Côte d’Ivoire") == "cote-d-ivoire"


def test_group_and_related_pages_stay_in_country_and_wrap_deterministically():
    pages = [
        TravelPage(Path(f"usa-{city}.html"), f"USA {city}", "USA", city, f"https://emfls.github.io/report/travel/usa-{city}.html")
        for city in ("Austin", "Boston", "Chicago", "Denver", "Erie")
    ]
    pages.append(
        TravelPage(Path("canada-toronto.html"), "Canada Toronto", "Canada", "Toronto", "https://emfls.github.io/report/travel/canada-toronto.html")
    )

    groups = group_by_country(pages)
    related = related_pages(groups["USA"][4], groups["USA"])

    assert list(groups) == ["Canada", "USA"]
    assert [page.city for page in related] == ["Austin", "Boston", "Chicago"]
    assert all(page.country == "USA" for page in related)
